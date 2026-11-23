import { NextResponse } from "next/server";

import { buildBaseBuilderMap } from "@/lib/server/base-builder-map";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      agent: "base-opportunity-agent",
      version: 1,
      mode: "research-only",
      generatedAt: new Date().toISOString(),
      ...buildBaseBuilderMap(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
