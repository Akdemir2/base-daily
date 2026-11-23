import { NextResponse } from "next/server";

import { buildBaseOpportunityReport } from "@/lib/server/base-opportunity-catalog";
import { getBaseRwaMarketSnapshot } from "@/lib/server/rwa-market";
import { getBaseTokenizedStocksSnapshot } from "@/lib/server/tokenized-stocks";
import { getBaseRwaContractVerification } from "@/lib/server/base-rwa-contract-verification";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const [rwaResult, tokenizedStocksResult, contractVerificationResult] =
    await Promise.allSettled([
      getBaseRwaMarketSnapshot(),
      getBaseTokenizedStocksSnapshot(),
      getBaseRwaContractVerification(),
    ]);

  const report = buildBaseOpportunityReport();
  const contractVerification =
    contractVerificationResult.status === "fulfilled"
      ? contractVerificationResult.value
      : null;
  const contractVerificationStatus = contractVerification
    ? contractVerification.progress.pendingContracts > 0
      ? "in_progress"
      : contractVerification.progress.rpcErrorCount > 0
        ? "completed_with_errors"
        : "completed"
    : "unavailable";

  return NextResponse.json(
    {
      ...report,
      contractRegistry: {
        ...report.contractRegistry,
        summary: {
          ...report.contractRegistry.summary,
          onchainCodeVerification: contractVerificationStatus,
        },
        liveVerification: contractVerification ?? {
          status: "unavailable",
          error:
            contractVerificationResult.status === "rejected"
              ? contractVerificationResult.reason instanceof Error
                ? contractVerificationResult.reason.message
                : "Unknown Base RPC verification error."
              : "Base RPC verification result is unavailable.",
        },
      },
      liveData: {
        rwaMarket:
          rwaResult.status === "fulfilled"
            ? rwaResult.value
            : {
                status: "unavailable",
                error:
                  rwaResult.reason instanceof Error
                    ? rwaResult.reason.message
                    : "Unknown RWA provider error.",
              },
        tokenizedStocks:
          tokenizedStocksResult.status === "fulfilled"
            ? tokenizedStocksResult.value
            : {
                status: "unavailable",
                error:
                  tokenizedStocksResult.reason instanceof Error
                    ? tokenizedStocksResult.reason.message
                    : "Unknown tokenized-stocks provider error.",
              },
        rwaContractVerification:
          contractVerificationResult.status === "fulfilled"
            ? contractVerificationResult.value
            : {
                status: "unavailable",
                error:
                  contractVerificationResult.reason instanceof Error
                    ? contractVerificationResult.reason.message
                    : "Unknown Base RPC verification error.",
              },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
