import { NextResponse } from "next/server";

import {
  fetchLeaderboardEvents,
  syncLeaderboardIndex,
} from "@/lib/server/leaderboard-indexer";

const NEYNAR_BULK_BY_ADDRESS_API =
  "https://api.neynar.com/v2/farcaster/user/bulk-by-address/";

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
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn(
        `[Base Daily] Neynar profile enrichment failed (${response.status}).`,
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
    console.warn("[Base Daily] Neynar profile enrichment failed", error);
  }

  return profiles;
}

export async function GET() {
  try {
    const sync = await syncLeaderboardIndex();
    const events = await fetchLeaderboardEvents();

    const latestByUser = new Map<string, LeaderboardEntry>();

    for (const event of events) {
      const key = normalize(event.address);
      const previous = latestByUser.get(key);

      latestByUser.set(key, {
        address: event.address,
        totalPoints: event.totalPoints,
        currentStreak: event.currentStreak,
        totalCorrect: event.totalCorrect,
        totalPlayed: (previous?.totalPlayed ?? 0) + 1,
        lastPlayedDay: event.day,
      });
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
      index: {
        caughtUp: sync.locked ? false : sync.caughtUp,
        locked: sync.locked,
        chunksProcessed: sync.chunksProcessed,
      },

    });
  } catch (error) {
    console.error("[Base Daily] leaderboard error", error);

    return NextResponse.json(
      { error: "Unable to load leaderboard." },
      { status: 500 },
    );
  }
}
