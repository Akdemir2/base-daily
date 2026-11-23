import { NextResponse } from "next/server";

import { getBaseTokenizedStocksSnapshot } from "@/lib/server/tokenized-stocks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await getBaseTokenizedStocksSnapshot();

    return NextResponse.json(
      {
        agent: "base-opportunity-agent",
        version: 1,
        mode: "read-only",
        ...snapshot,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[Base Opportunity Agent] Tokenized-stocks report failed.", error);
    return NextResponse.json(
      {
        error: "Unable to retrieve and verify the Base tokenized-stocks snapshot.",
        source: "Coinbase Tokenized Stocks API and Base RPC",
      },
      { status: 503 },
    );
  }
}
