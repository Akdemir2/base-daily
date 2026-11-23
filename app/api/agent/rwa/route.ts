import { NextResponse } from "next/server";

import { getBaseRwaMarketSnapshot } from "@/lib/server/rwa-market";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await getBaseRwaMarketSnapshot();

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
    console.error("[Base Opportunity Agent] Live RWA report failed.", error);
    return NextResponse.json(
      {
        error: "Unable to retrieve the Base RWA market snapshot.",
        source: "RWA Pipe",
      },
      { status: 503 },
    );
  }
}
