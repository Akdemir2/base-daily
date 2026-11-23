import type { IndexedLeaderboardEvent } from "@/lib/server/leaderboard-indexer";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DailyActivityPoint = {
  date: string;
  claims: number;
  uniqueWallets: number;
};

export type BaseDailyActivitySnapshot = {
  totalIndexedClaims: number;
  totalUniqueWallets: number;
  claimsLast7Days: number;
  claimsPrevious7Days: number;
  activeWallets7Days: number;
  activeWallets30Days: number;
  newWalletsLast30Days: number;
  claimsChangePercent: number | null;
  dailyActivity: DailyActivityPoint[];
  latestActivityDate: string | null;
};

function utcDateFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function buildBaseDailyActivitySnapshot(
  events: IndexedLeaderboardEvent[],
  now = new Date(),
): BaseDailyActivitySnapshot {
  const today = Math.floor(now.getTime() / DAY_MS);
  const sevenDayStart = today - 6;
  const previousSevenDayStart = today - 13;
  const thirtyDayStart = today - 29;

  const allWallets = new Set<string>();
  const walletsLast7Days = new Set<string>();
  const walletsLast30Days = new Set<string>();
  const firstSeenDayByWallet = new Map<string, number>();
  const claimsByDay = new Map<number, number>();
  const walletsByDay = new Map<number, Set<string>>();

  let claimsLast7Days = 0;
  let claimsPrevious7Days = 0;
  let newWalletsLast30Days = 0;
  let latestActivityDay: number | null = null;

  for (const event of events) {
    const wallet = event.address.toLowerCase();
    const day = event.day;

    allWallets.add(wallet);
    claimsByDay.set(day, (claimsByDay.get(day) ?? 0) + 1);

    const walletsForDay = walletsByDay.get(day) ?? new Set<string>();
    walletsForDay.add(wallet);
    walletsByDay.set(day, walletsForDay);

    const firstSeen = firstSeenDayByWallet.get(wallet);
    if (firstSeen === undefined || day < firstSeen) {
      firstSeenDayByWallet.set(wallet, day);
    }

    if (latestActivityDay === null || day > latestActivityDay) {
      latestActivityDay = day;
    }

    if (day >= sevenDayStart && day <= today) {
      claimsLast7Days += 1;
      walletsLast7Days.add(wallet);
    } else if (day >= previousSevenDayStart && day < sevenDayStart) {
      claimsPrevious7Days += 1;
    }

    if (day >= thirtyDayStart && day <= today) {
      walletsLast30Days.add(wallet);
    }
  }

  for (const firstSeenDay of firstSeenDayByWallet.values()) {
    if (firstSeenDay >= thirtyDayStart && firstSeenDay <= today) {
      newWalletsLast30Days += 1;
    }
  }

  const dailyActivity: DailyActivityPoint[] = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = today - offset;
    dailyActivity.push({
      date: utcDateFromDay(day),
      claims: claimsByDay.get(day) ?? 0,
      uniqueWallets: walletsByDay.get(day)?.size ?? 0,
    });
  }

  return {
    totalIndexedClaims: events.length,
    totalUniqueWallets: allWallets.size,
    claimsLast7Days,
    claimsPrevious7Days,
    activeWallets7Days: walletsLast7Days.size,
    activeWallets30Days: walletsLast30Days.size,
    newWalletsLast30Days,
    claimsChangePercent:
      claimsPrevious7Days === 0
        ? null
        : Number(
            (
              ((claimsLast7Days - claimsPrevious7Days) /
                claimsPrevious7Days) *
              100
            ).toFixed(2),
          ),
    dailyActivity,
    latestActivityDate:
      latestActivityDay === null ? null : utcDateFromDay(latestActivityDay),
  };
}
