import { NextResponse } from "next/server";
import { decodeEventLog } from "viem";

import {
  BASE_DAILY_ABI,
  BASE_DAILY_ADDRESS,
} from "@/lib/contract/baseDaily";

const BLOCKSCOUT_API = "https://base-sepolia.blockscout.com/api";

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

type LeaderboardEntry = {
  address: `0x${string}`;
  totalPoints: number;
  currentStreak: number;
  totalCorrect: number;
  totalPlayed: number;
  lastPlayedDay: number;
};

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
        const key = address.toLowerCase();

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

    const leaderboard = Array.from(latestByUser.values())
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
