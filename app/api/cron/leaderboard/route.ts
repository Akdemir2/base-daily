import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncLeaderboardIndex } from "@/lib/server/leaderboard-indexer";

export const dynamic = "force-dynamic";

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

  try {
    const result = await syncLeaderboardIndex();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[Base Daily] Cron indexer failed.", error);

    return NextResponse.json(
      { error: "Leaderboard indexing failed." },
      { status: 500 },
    );
  }
}
