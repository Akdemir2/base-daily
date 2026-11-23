import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { syncLeaderboardIndex } from "@/lib/server/leaderboard-indexer";
import { syncBaseRwaMarketSnapshot } from "@/lib/server/rwa-market";
import { syncBaseTokenizedStocks } from "@/lib/server/tokenized-stocks";
import { getBaseRwaContractVerification } from "@/lib/server/base-rwa-contract-verification";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

function refreshSummary(
  result: PromiseSettledResult<unknown>,
  source: string,
) {
  if (result.status === "rejected") {
    return {
      ok: false,
      source,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown refresh error.",
    };
  }

  const value = result.value as {
    checkedAt?: string;
    tokens?: unknown[];
    totals?: { tokensListed?: number };
    summary?: { tokens?: number | null; totalTvlUsd?: number | null };
    cacheState?: string;
    progress?: {
      eligibleContracts?: number;
      checkedContracts?: number;
      pendingContracts?: number;
      checkedThisRefresh?: number;
      rpcErrorCount?: number;
    };
  };

  return {
    ok: true,
    source,
    checkedAt: value.checkedAt ?? null,
    cacheState: value.cacheState ?? "refreshed",
    tokens:
      value.totals?.tokensListed ??
      value.summary?.tokens ??
      value.tokens?.length ??
      null,
    totalTvlUsd: value.summary?.totalTvlUsd ?? null,
    verificationProgress: value.progress ?? null,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[Base Daily] CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron authentication is not configured." },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  // Refresh market datasets first. These are independent, read-only API
  // requests; a provider outage must not block the Base Daily event indexer.
  const [rwaRefresh, tokenizedStocksRefresh, contractVerificationRefresh] =
    await Promise.allSettled([
      syncBaseRwaMarketSnapshot(),
      syncBaseTokenizedStocks(),
      getBaseRwaContractVerification(),
    ]);

  const dataRefresh = {
    rwaMarket: refreshSummary(rwaRefresh, "RWA Pipe"),
    tokenizedStocks: refreshSummary(
      tokenizedStocksRefresh,
      "Coinbase Tokenized Stocks API + Base RPC",
    ),
    rwaContracts: refreshSummary(
      contractVerificationRefresh,
      "Base RPC: RWA bytecode, totalSupply() and decimals()",
    ),
  };

  try {
    const result = await syncLeaderboardIndex({
      maxChunks: 600,
      maxDurationMs: 220_000,
      preferredBlocksPerChunk: 50_000,
    });

    return NextResponse.json({
      ok: true,
      dataRefresh,
      leaderboardIndex: result,
    });
  } catch (error) {
    console.error("[Base Daily] Cron indexer failed.", error);

    return NextResponse.json(
      {
        ok: false,
        dataRefresh,
        error: "Leaderboard indexing failed.",
      },
      { status: 500 },
    );
  }
}
