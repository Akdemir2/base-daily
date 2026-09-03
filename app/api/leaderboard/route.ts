import { NextResponse } from "next/server";
import { decodeEventLog } from "viem";

import {
  BASE_DAILY_ABI,
  BASE_DAILY_ADDRESS,
} from "@/lib/contract/baseDaily";

const BLOCKSCOUT_API = "https://base-sepolia.blockscout.com/api";

const NEYNAR_BULK_BY_ADDRESS_API =
  "https://api.neynar.com/v2/farcaster/user/bulk-by-address/";

const DAILY_CLAIMED_TOPIC =
  "0xd86d84111472a12500023ca08d5f1394e9e00a1571717990c87d1d185a60beef";

type BlockscoutLog = {
  address: `0x${string}`;
  blockNumber: string;
  data: `0x${string}`;
  logIndex: string;
  topics: [`0x${string}`, ...`0x${string}`[]];
  transactionHash: `0x${string}`;
};

type BlockscoutResponse = {
  status: string;
  message: string;
  result: BlockscoutLog[] | string;
};

type NeynarUser = {
  fid?: number;
  custody_address?: string;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};

type NeynarBulkResponse = Record<string, NeynarUser[]>;

type FarcasterProfile = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
};

type LeaderboardEntry = {
  address: `0x${string}`;
  totalPoints: number;
  currentStreak: number;
  totalCorrect: number;
  totalPlayed: number;
  lastPlayedDay: number;
};

function normalize(address: string) {
  return address.toLowerCase();
}

async function fetchFarcasterProfiles(addresses: `0x${string}`[]) {
  const profiles = new Map<string, FarcasterProfile>();
  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey || addresses.length === 0) {
    return profiles;
  }

  const uniqueAddresses = [...new Set(addresses.map(normalize))];

  try {
    const url = new URL(NEYNAR_BULK_BY_ADDRESS_API);
    url.searchParams.set("addresses", uniqueAddresses.join(","));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      const text = await response.text();

      console.warn(
        `[Base Daily] Neynar profile enrichment failed (${response.status}): ${text.slice(
          0,
          300,
        )}`,
      );

      return profiles;
    }

    const payload = (await response.json()) as NeynarBulkResponse;

    for (const address of uniqueAddresses) {
      const matchingKey = Object.keys(payload).find(
        (key) => normalize(key) === address,
      );

      const users =
        payload[address] ??
        (matchingKey ? payload[matchingKey] : undefined) ??
        [];

      if (!Array.isArray(users) || users.length === 0) {
        continue;
      }

      const user =
        users.find(
          (candidate) =>
            candidate.custody_address &&
            normalize(candidate.custody_address) === address,
        ) ?? users[0];

      if (
        typeof user.fid !== "number" ||
        typeof user.username !== "string" ||
        !user.username
      ) {
        continue;
      }

      profiles.set(address, {
        fid: user.fid,
        username: user.username,
        displayName:
          typeof user.display_name === "string" && user.display_name
            ? user.display_name
            : user.username,
        pfpUrl: typeof user.pfp_url === "string" ? user.pfp_url : "",
      });
    }
  } catch (error) {
    // Farcaster enrichment must never take the onchain leaderboard down.
    console.warn("[Base Daily] Neynar profile enrichment failed", error);
  }

  return profiles;
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      fromBlock: "46264823",
      toBlock: "latest",
      address: BASE_DAILY_ADDRESS,
      topic0: DAILY_CLAIMED_TOPIC,
    });

    const response = await fetch(`${BLOCKSCOUT_API}?${params}`, {
      next: {
        revalidate: 30,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockscout returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as BlockscoutResponse;

    if (!Array.isArray(payload.result)) {
      throw new Error(
        typeof payload.result === "string"
          ? payload.result
          : "Invalid Blockscout response.",
      );
    }

    const sortedLogs = [...payload.result].sort((a, b) => {
      const blockA = BigInt(a.blockNumber);
      const blockB = BigInt(b.blockNumber);

      if (blockA < blockB) return -1;
      if (blockA > blockB) return 1;

      const logIndexA = BigInt(a.logIndex);
      const logIndexB = BigInt(b.logIndex);

      if (logIndexA < logIndexB) return -1;
      if (logIndexA > logIndexB) return 1;

      return 0;
    });

    const latestByUser = new Map<string, LeaderboardEntry>();

    for (const log of sortedLogs) {
      try {
        const decoded = decodeEventLog({
          abi: BASE_DAILY_ABI,
          eventName: "DailyClaimed",
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args;

        const address = args.user;
        const key = normalize(address);

        const previous = latestByUser.get(key);

        latestByUser.set(key, {
          address,
          totalPoints: Number(args.totalPoints),
          currentStreak: Number(args.currentStreak),
          totalCorrect: Number(args.totalCorrect),
          totalPlayed: (previous?.totalPlayed ?? 0) + 1,
          lastPlayedDay: Number(args.day),
        });
      } catch {
        // Ignore malformed or unrelated logs.
      }
    }

    const entries = Array.from(latestByUser.values());

    const farcasterProfiles = await fetchFarcasterProfiles(
      entries.map((entry) => entry.address),
    );

    const leaderboard = entries
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }

        if (b.currentStreak !== a.currentStreak) {
          return b.currentStreak - a.currentStreak;
        }

        if (b.totalCorrect !== a.totalCorrect) {
          return b.totalCorrect - a.totalCorrect;
        }

        return a.address.localeCompare(b.address);
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
        farcaster:
          farcasterProfiles.get(normalize(entry.address)) ?? null,
      }));

    return NextResponse.json({
      leaderboard,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Base Daily] leaderboard error", error);

    return NextResponse.json(
      {
        error: "Unable to load leaderboard.",
      },
      {
        status: 500,
      },
    );
  }
}