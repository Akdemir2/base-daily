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
const BLOCKS_PER_CHUNK = BigInt(100);
const MAX_CHUNKS_PER_RUN = 5;

const RPC_URL =
  process.env.BASE_RPC_URL ??
  "https://base-mainnet.g.alchemy.com/public";

const PREFIX = "base-daily:leaderboard:v1";
const CURSOR_KEY = `${PREFIX}:cursor`;
const EVENTS_KEY = `${PREFIX}:events`;
const EVENT_IDS_KEY = `${PREFIX}:event-ids`;
const EVENT_DATA_KEY = `${PREFIX}:event-data`;
const LOCK_KEY = `${PREFIX}:lock`;

const DAILY_CLAIMED_EVENT = parseAbiItem(
  "event DailyClaimed(address indexed user, uint256 indexed questionId, uint256 indexed day, bool correct, uint256 pointsEarned, uint256 totalPoints, uint256 totalCorrect, uint256 currentStreak)",
);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, {
    timeout: 15_000,
    retryCount: 1,
  }),
});

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

export async function syncLeaderboardIndex(maxChunks = MAX_CHUNKS_PER_RUN) {
  const lockToken = randomUUID();

  const lockResult = await redis.set(LOCK_KEY, lockToken, {
    nx: true,
    ex: 300,
  });

  if (lockResult !== "OK") {
    return {
      locked: true,
      chunksProcessed: 0,
      eventsStored: 0,
      caughtUp: false,
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

    let chunksProcessed = 0;
    let eventsStored = 0;

    while (
      cursor <= latestBlock &&
      chunksProcessed < maxChunks
    ) {
      const fromBlock = cursor;
      const candidateEnd = fromBlock + BLOCKS_PER_CHUNK - BigInt(1);
      const toBlock =
        candidateEnd > latestBlock ? latestBlock : candidateEnd;

      const logs = await publicClient.getLogs({
        address: BASE_DAILY_ADDRESS,
        event: DAILY_CLAIMED_EVENT,
        fromBlock,
        toBlock,
      });

      const events: IndexedLeaderboardEvent[] = [...logs]
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber < b.blockNumber ? -1 : 1;
          }
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

      const nextCursor = (toBlock + BigInt(1)).toString();

      const inserted = await redis.eval(
        STORE_CHUNK_SCRIPT,
        [EVENT_IDS_KEY, EVENTS_KEY, EVENT_DATA_KEY, CURSOR_KEY],
        [JSON.stringify(events), nextCursor],
      );

      eventsStored += Number(inserted);
      cursor = toBlock + BigInt(1);
      chunksProcessed += 1;
    }

    return {
      locked: false,
      latestBlock: latestBlock.toString(),
      nextBlock: cursor.toString(),
      chunksProcessed,
      eventsStored,
      caughtUp: cursor > latestBlock,
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
