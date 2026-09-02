import { NextResponse } from "next/server";
import { getQuestionForDay, getUtcDay } from "@/lib/server/questions";

export const dynamic = "force-dynamic";

export async function GET() {
  const day = getUtcDay();
  const question = getQuestionForDay(day);

  return NextResponse.json(
    {
      day,
      id: question.id,
      question: question.question,
      options: question.options,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}