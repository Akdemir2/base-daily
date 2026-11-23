import { NextResponse } from "next/server";

import { BASE_DAILY_ADDRESS } from "@/lib/contract/baseDaily";
import {
  fetchLeaderboardEvents,
  syncLeaderboardIndex,
} from "@/lib/server/leaderboard-indexer";
import { buildBaseDailyActivitySnapshot } from "@/lib/server/base-opportunity-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Reuse the existing, lock-protected event indexer. No wallet actions are
    // performed by this endpoint.
    const indexing = await syncLeaderboardIndex();
    const events = await fetchLeaderboardEvents();
    const activity = buildBaseDailyActivitySnapshot(events);
    const remainingBlocks =
      indexing.latestBlock !== null && indexing.nextBlock !== null
        ? (
            BigInt(indexing.latestBlock) >= BigInt(indexing.nextBlock)
              ? BigInt(indexing.latestBlock) - BigInt(indexing.nextBlock) + BigInt(1)
              : BigInt(0)
          ).toString()
        : null;
    const latestBlock = "latestBlock" in indexing ? indexing.latestBlock : null;
    const nextBlock = "nextBlock" in indexing ? indexing.nextBlock : null;

    return NextResponse.json(
      {
        agent: "base-opportunity-agent",
        version: 1,
        generatedAt: new Date().toISOString(),
        network: "base-mainnet",
        mode: "read-only",
        rpcProvider: process.env.BASE_RPC_URL
          ? "custom BASE_RPC_URL"
          : "PublicNode Base public RPC",
        baseDaily: {
          contractAddress: BASE_DAILY_ADDRESS,
          activity,
          indexing: {
            locked: indexing.locked,
            caughtUp: indexing.caughtUp,
            chunksProcessed: indexing.chunksProcessed,
            eventsStored: indexing.eventsStored,
            latestBlock,
            nextBlock,
            remainingBlocks,
            blockRange: indexing.blockRange,
            durationMs: indexing.durationMs,
            timeBudgetReached: indexing.timeBudgetReached,
          },
        },
        builderAttribution: {
          configuredInApp: true,
          code: "bc_xvhlznzj",
          registrationVerified: false,
        },
        airdropEligibility: {
          status: "unknown",
          note: "This report measures Base Daily product activity. It does not establish or predict Base airdrop eligibility.",
        },
        limitations: [
          "Metrics cover DailyClaimed events indexed by the existing Base Daily indexer.",
          "Wallet counts are addresses, not verified unique people.",
          "Builder Code configuration is read from the app source; registry status is not checked here.",
          "No swaps, transfers, claims, signatures, or other write actions are initiated.",
        ],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[Base Opportunity Agent] report error:", error);
    return NextResponse.json(
      { error: "Unable to generate the Base Opportunity Agent report." },
      { status: 503 },
    );
  }
}
