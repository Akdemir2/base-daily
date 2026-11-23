import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  decodeEventLog,
  http,
  parseAbiItem,
} from "viem";
import { base } from "viem/chains";

import { redis } from "@/lib/server/redis";
import {
  BASE_DAILY_ABI,
  BASE_DAILY_ADDRESS,
} from "@/lib/contract/baseDaily";

const START_BLOCK = BigInt(51991571);

// PublicNode's Base endpoint has been measured accepting up to 50,000 blocks
// for filtered eth_getLogs queries. If it rejects a range or times out, the
// range is halved and saved for the next run.
const PREFERRED_BLOCKS_PER_CHUNK = BigInt(50_000);
const MIN_BLOCKS_PER_CHUNK = BigInt(100);
const DEFAULT_MAX_CHUNKS_PER_RUN = 5;
const DEFAULT_MAX_DURATION_MS = 12_000;
const MAX_CHUNKS_PER_RUN = 600;
const MAX_DURATION_MS = 240_000;

const RPC_URL =
  process.env.BASE_RPC_URL ??
  "https://base-rpc.publicnode.com";

const PREFIX = "base-daily:leaderboard:v1";
const CURSOR_KEY = `${PREFIX}:cursor`;
const EVENTS_KEY = `${PREFIX}:events`;
const EVENT_IDS_KEY = `${PREFIX}:event-ids`;
const EVENT_DATA_KEY = `${PREFIX}:event-data`;
const LOCK_KEY = `${PREFIX}:lock`;
const RPC_PROVIDER_ID = (() => {
  try {
    return new URL(RPC_URL).hostname.replace(/[^a-z0-9.-]/gi, "-");
  } catch {
    return "custom-rpc";
  }
})();
const RANGE_HINT_KEY = `${PREFIX}:range-hint:${RPC_PROVIDER_ID}`;

const DAILY_CLAIMED_EVENT = parseAbiItem(
  "event DailyClaimed(address indexed user, uint256 indexed questionId, uint256 indexed day, bool correct, uint256 pointsEarned, uint256 totalPoints, uint256 totalCorrect, uint256 currentStreak)",
);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, {
    timeout: 10_000,
    retryCount: 0,
  }),
});

// Keep heavy eth_getLogs calls paced rather than flooding a public endpoint.
// The Redis lock serializes indexer invocations across Vercel instances.
let nextHeavyRpcSlotAt = 0;

async function waitForHeavyRpcSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextHeavyRpcSlotAt - now);

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  nextHeavyRpcSlotAt = Math.max(Date.now(), nextHeavyRpcSlotAt) + 220;
}

export type IndexedLeaderboardEvent = {
  id: string;
  address: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  transactionHash: `0x${string}`;
  questionId: number;
  day: number;
  correct: boolean;
  pointsEarned: number;
  totalPoints: number;
  totalCorrect: number;
  currentStreak: number;
};

export type LeaderboardSyncOptions = {
  maxChunks?: number;
  maxDurationMs?: number;
  preferredBlocksPerChunk?: number;
};

type LogChunk = {
  logs: Awaited<ReturnType<typeof publicClient.getLogs>>;
  fromBlock: bigint;
  toBlock: bigint;
  blockRange: bigint;
};

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return `${error.name} ${error.message} ${cause ? getErrorText(cause) : ""}`;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    return [
      value.message,
      value.shortMessage,
      value.details,
      value.code,
      value.status,
      value.statusCode,
      value.cause ? getErrorText(value.cause) : "",
    ].filter(Boolean).join(" ");
  }

  return String(error);
}

function isRateLimitError(error: unknown): boolean {
  const value = error as { status?: unknown; statusCode?: unknown };
  const message = getErrorText(error).toLowerCase();

  return (
    value?.status === 429 ||
    value?.statusCode === 429 ||
    /rate limit|rate-limit|too many requests|throttl|quota exceeded|request limit reached/.test(message)
  );
}

function shouldReduceBlockRange(error: unknown): boolean {
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const message = getErrorText(error).toLowerCase();

  // -32005 is provider-specific: it may mean a rate limit, not a block-range
  // failure. Never shrink the query for a pure throttling response.
  if (isRateLimitError(error)) return false;

  if (
    value &&
    (value.status === 413 ||
      value.statusCode === 413 ||
      value.code === 413)
  ) {
    return true;
  }

  return (
    /block.{0,40}range|range.{0,40}(too large|exceed|limit)/.test(message) ||
    /too many (logs|results|blocks)|query returned more than|query exceeds max results|logs matched.*exceed/.test(message) ||
    /response.{0,20}(too large|size)|payload too large|request too large/.test(message) ||
    /timed out|timeout|deadline exceeded|request took too long/.test(message)
  );
}

async function readSavedBlockRange(): Promise<bigint | null> {
  const saved = await redis.get<string | number>(RANGE_HINT_KEY);
  if (saved === null) return null;

  const parsed = Number(saved);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < Number(MIN_BLOCKS_PER_CHUNK) ||
    parsed > Number(PREFERRED_BLOCKS_PER_CHUNK)
  ) {
    return null;
  }

  return BigInt(parsed);
}

async function fetchLogChunk(
  fromBlock: bigint,
  latestBlock: bigint,
  initialRange: bigint,
): Promise<LogChunk> {
  let blockRange = initialRange;

  let rateLimitRetries = 0;

  while (true) {
    const candidateEnd = fromBlock + blockRange - BigInt(1);
    const toBlock = candidateEnd > latestBlock ? latestBlock : candidateEnd;

    try {
      await waitForHeavyRpcSlot();
      const logs = await publicClient.getLogs({
        address: BASE_DAILY_ADDRESS,
        event: DAILY_CLAIMED_EVENT,
        fromBlock,
        toBlock,
      });

      return { logs, fromBlock, toBlock, blockRange };
    } catch (error) {
      if (isRateLimitError(error) && rateLimitRetries < 3) {
        rateLimitRetries += 1;
        const delayMs = 250 * 2 ** (rateLimitRetries - 1);
        console.warn(
          `[Base Daily] RPC rate limited log query; retry ${rateLimitRetries}/3 in ${delayMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!shouldReduceBlockRange(error) || blockRange <= MIN_BLOCKS_PER_CHUNK) {
        throw error;
      }

      const reduced = blockRange / BigInt(2);
      blockRange =
        reduced < MIN_BLOCKS_PER_CHUNK ? MIN_BLOCKS_PER_CHUNK : reduced;
      rateLimitRetries = 0;

      // Persist the provider's accepted range so future invocations start
      // with a known-safe value rather than repeating failed large queries.
      await redis.set(RANGE_HINT_KEY, blockRange.toString());
      console.warn(
        `[Base Daily] RPC rejected a log range; reducing to ${blockRange.toString()} blocks.`,
      );
    }
  }
}

const STORE_CHUNK_SCRIPT = `
local idsKey = KEYS[1]
local eventsKey = KEYS[2]
local eventDataKey = KEYS[3]
local cursorKey = KEYS[4]

local events = cjson.decode(ARGV[1])
local nextCursor = ARGV[2]
local inserted = 0

for _, event in ipairs(events) do
  local added = redis.call("SADD", idsKey, event.id)

  if added == 1 then
    redis.call("HSET", eventDataKey, event.id, cjson.encode(event))
    redis.call("ZADD", eventsKey, event.blockNumber, event.id)
    inserted = inserted + 1
  end
end

redis.call("SET", cursorKey, nextCursor)
return inserted
`;

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export async function syncLeaderboardIndex(
  options: LeaderboardSyncOptions = {},
) {
  const maxChunks = clampInteger(
    options.maxChunks,
    DEFAULT_MAX_CHUNKS_PER_RUN,
    1,
    MAX_CHUNKS_PER_RUN,
  );
  const maxDurationMs = clampInteger(
    options.maxDurationMs,
    DEFAULT_MAX_DURATION_MS,
    1_000,
    MAX_DURATION_MS,
  );
  const requestedRange = clampInteger(
    options.preferredBlocksPerChunk,
    Number(PREFERRED_BLOCKS_PER_CHUNK),
    Number(MIN_BLOCKS_PER_CHUNK),
    Number(PREFERRED_BLOCKS_PER_CHUNK),
  );

  const lockToken = randomUUID();
  const startedAt = Date.now();

  const lockResult = await redis.set(LOCK_KEY, lockToken, {
    nx: true,
    ex: 360,
  });

  if (lockResult !== "OK") {
    return {
      locked: true,
      chunksProcessed: 0,
      eventsStored: 0,
      caughtUp: false,
      timeBudgetReached: false,
      latestBlock: null,
      nextBlock: null,
      blockRange: null,
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    const latestBlock = await publicClient.getBlockNumber();
    const savedCursor = await redis.get<string | number>(CURSOR_KEY);

    let cursor =
      savedCursor === null
        ? START_BLOCK
        : BigInt(savedCursor);

    if (cursor < START_BLOCK) cursor = START_BLOCK;

    const savedRange = await readSavedBlockRange();
    let blockRange = savedRange
      ? (savedRange < BigInt(requestedRange) ? savedRange : BigInt(requestedRange))
      : BigInt(requestedRange);

    let chunksProcessed = 0;
    let eventsStored = 0;

    while (
      cursor <= latestBlock &&
      chunksProcessed < maxChunks &&
      Date.now() - startedAt < maxDurationMs
    ) {
      const chunk = await fetchLogChunk(cursor, latestBlock, blockRange);
      blockRange = chunk.blockRange;

      const events: IndexedLeaderboardEvent[] = [...chunk.logs]
        .sort((a, b) => {
          if (a.blockNumber === null) {
            return b.blockNumber === null ? 0 : -1;
          }
          if (b.blockNumber === null) return 1;
          if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber < b.blockNumber ? -1 : 1;
          }
          if (a.logIndex === null) {
            return b.logIndex === null ? 0 : -1;
          }
          if (b.logIndex === null) return 1;
          return a.logIndex - b.logIndex;
        })
        .map((log) => {
          if (
            log.blockNumber === null ||
            log.transactionHash === null ||
            log.logIndex === null
          ) {
            throw new Error("A leaderboard log is missing its identity.");
          }

          const decoded = decodeEventLog({
            abi: BASE_DAILY_ABI,
            eventName: "DailyClaimed",
            data: log.data,
            topics: log.topics,
          });

          const args = decoded.args;

          return {
            id: `${log.transactionHash.toLowerCase()}:${log.logIndex}`,
            address: args.user,
            blockNumber: Number(log.blockNumber),
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            questionId: Number(args.questionId),
            day: Number(args.day),
            correct: args.correct,
            pointsEarned: Number(args.pointsEarned),
            totalPoints: Number(args.totalPoints),
            totalCorrect: Number(args.totalCorrect),
            currentStreak: Number(args.currentStreak),
          };
        });

      const nextCursor = (chunk.toBlock + BigInt(1)).toString();

      const inserted = await redis.eval(
        STORE_CHUNK_SCRIPT,
        [EVENT_IDS_KEY, EVENTS_KEY, EVENT_DATA_KEY, CURSOR_KEY],
        [JSON.stringify(events), nextCursor],
      );

      eventsStored += Number(inserted);
      cursor = chunk.toBlock + BigInt(1);
      chunksProcessed += 1;

      // A successful query is also a provider capability check. Save the
      // actual accepted range for the next invocation.
      await redis.set(RANGE_HINT_KEY, blockRange.toString());
    }

    const durationMs = Date.now() - startedAt;
    const caughtUp = cursor > latestBlock;

    return {
      locked: false,
      latestBlock: latestBlock.toString(),
      nextBlock: cursor.toString(),
      chunksProcessed,
      eventsStored,
      caughtUp,
      timeBudgetReached: !caughtUp && durationMs >= maxDurationMs,
      blockRange: Number(blockRange),
      durationMs,
    };
  } finally {
    try {
      await redis.eval(
        RELEASE_LOCK_SCRIPT,
        [LOCK_KEY],
        [lockToken],
      );
    } catch (error) {
      console.error("[Base Daily] Failed to release indexer lock", error);
    }
  }
}

export async function fetchLeaderboardEvents(): Promise<
  IndexedLeaderboardEvent[]
> {
  const ids = await redis.zrange<string[]>(EVENTS_KEY, 0, -1);

  if (ids.length === 0) return [];

  const events: IndexedLeaderboardEvent[] = [];
  const batchSize = 200;

  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const batchIds = ids.slice(offset, offset + batchSize);
    const records = await redis.hmget<Record<string, unknown>>(
      EVENT_DATA_KEY,
      ...batchIds,
    );

    if (!records) continue;

    for (const id of batchIds) {
      const raw = records[id];

      if (raw === null || raw === undefined) continue;

      try {
        const event =
          typeof raw === "string"
            ? (JSON.parse(raw) as IndexedLeaderboardEvent)
            : (raw as IndexedLeaderboardEvent);

        if (
          event &&
          event.id === id &&
          typeof event.address === "string" &&
          typeof event.blockNumber === "number" &&
          typeof event.logIndex === "number"
        ) {
          events.push(event);
        } else {
          console.warn("[Base Daily] Invalid indexed event fields.", { id });
        }
      } catch (error) {
        console.warn("[Base Daily] Could not parse indexed event.", {
          id,
          error: String(error),
        });
      }
    }
  }

  return events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    return a.logIndex - b.logIndex;
  });
}
