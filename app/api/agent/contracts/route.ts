import { NextResponse } from "next/server";

import { buildBaseRwaContractRegistry } from "@/lib/server/base-rwa-contract-registry";
import { getBaseRwaContractVerification } from "@/lib/server/base-rwa-contract-verification";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const registry = buildBaseRwaContractRegistry();
    const verification = await getBaseRwaContractVerification();
    const records = registry.records.map((record) => ({
      ...record,
      onchainVerification: verification.results[record.id] ?? null,
    }));

    return NextResponse.json(
      {
        agent: "base-opportunity-agent",
        version: 3,
        mode: "research-only",
        generatedAt: new Date().toISOString(),
        ...registry,
        records,
        summary: {
          ...registry.summary,
          onchainCodeVerification:
            verification.progress.pendingContracts > 0
              ? "in_progress"
              : verification.progress.rpcErrorCount > 0
                ? "completed_with_errors"
                : "completed",
        },
        liveVerification: verification,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[Base Opportunity Agent] Base RWA contract checks failed.", error);
    return NextResponse.json(
      {
        error: "Unable to retrieve Base RWA contract records and onchain checks.",
        source: "Official issuer documentation and Base RPC",
      },
      { status: 503 },
    );
  }
}
