import { NextResponse } from "next/server";
import {
  createWalletClient,
  getAddress,
  http,
  isAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { redis } from "@/lib/server/redis";
import { getQuestionForDay, getUtcDay } from "@/lib/server/questions";

export const dynamic = "force-dynamic";

const signerPrivateKey = process.env.BASE_DAILY_SIGNER_PRIVATE_KEY;

if (!signerPrivateKey) {
  throw new Error("BASE_DAILY_SIGNER_PRIVATE_KEY is missing.");
}

if (!/^0x[0-9a-fA-F]{64}$/.test(signerPrivateKey)) {
  throw new Error("BASE_DAILY_SIGNER_PRIVATE_KEY is invalid.");
}

const signerAccount = privateKeyToAccount(
  signerPrivateKey as `0x${string}`,
);

const walletClient = createWalletClient({
  account: signerAccount,
  chain: baseSepolia,
  transport: http(),
});

const domain = {
  name: "Base Daily",
  version: "1",
  chainId: baseSepolia.id,
  verifyingContract:
    "0xEDc599d1d184E2dDdFb44299a0a13eD2DCB2e322",
} as const;

const types = {
  DailyClaim: [
    { name: "user", type: "address" },
    { name: "questionId", type: "uint256" },
    { name: "day", type: "uint256" },
    { name: "correct", type: "bool" },
  ],
} as const;

type AnswerRequest = {
  wallet?: unknown;
  questionId?: unknown;
  answer?: unknown;
};

type StoredAnswer = {
  version: 1;
  answer: 0 | 1;
  day: number;
  questionId: number;
  correct: boolean;
  points: number;
  signature: `0x${string}`;
};

function parseStoredAnswer(value: unknown): StoredAnswer | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredAnswer>;

    if (
      parsed.version !== 1 ||
      (parsed.answer !== 0 && parsed.answer !== 1) ||
      typeof parsed.day !== "number" ||
      typeof parsed.questionId !== "number" ||
      typeof parsed.correct !== "boolean" ||
      typeof parsed.points !== "number" ||
      typeof parsed.signature !== "string" ||
      !parsed.signature.startsWith("0x")
    ) {
      return null;
    }

    return parsed as StoredAnswer;
  } catch {
    return null;
  }
}

function responseFromStoredAnswer(
  stored: StoredAnswer,
  alreadyAnswered: boolean,
) {
  return NextResponse.json({
    day: stored.day,
    questionId: stored.questionId,
    correct: stored.correct,
    points: stored.points,
    signature: stored.signature,
    alreadyAnswered,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnswerRequest;

    if (
      typeof body.wallet !== "string" ||
      !isAddress(body.wallet)
    ) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400 },
      );
    }

    if (
      typeof body.questionId !== "number" ||
      !Number.isSafeInteger(body.questionId)
    ) {
      return NextResponse.json(
        { error: "Invalid question ID." },
        { status: 400 },
      );
    }

    if (body.answer !== 0 && body.answer !== 1) {
      return NextResponse.json(
        { error: "Invalid answer." },
        { status: 400 },
      );
    }

    const day = getUtcDay();
    const question = getQuestionForDay(day);

    if (body.questionId !== question.id) {
      return NextResponse.json(
        { error: "This is not today's question." },
        { status: 400 },
      );
    }

    const wallet = getAddress(body.wallet);
    const answerKey =
      `base-daily:answer:${day}:${wallet.toLowerCase()}`;

    const existingValue = await redis.get<unknown>(answerKey);

    if (existingValue !== null) {
      const existing =
        typeof existingValue === "string"
          ? parseStoredAnswer(existingValue)
          : parseStoredAnswer(JSON.stringify(existingValue));

      if (existing) {
        return responseFromStoredAnswer(existing, true);
      }

      // Compatibility with the old Redis format, which stored only
      // "0" or "1". Do not allow a second answer for that wallet/day.
      return NextResponse.json(
        {
          error:
            "You have already answered today, but the previous claim data uses the old format.",
        },
        { status: 409 },
      );
    }

    const answer = body.answer as 0 | 1;
    const correct = answer === question.correctOption;
    const points = correct ? 3 : 1;

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType: "DailyClaim",
      message: {
        user: wallet,
        questionId: BigInt(question.id),
        day: BigInt(day),
        correct,
      },
    });

    const stored: StoredAnswer = {
      version: 1,
      answer,
      day,
      questionId: question.id,
      correct,
      points,
      signature,
    };

    const locked = await redis.set(
      answerKey,
      JSON.stringify(stored),
      {
        nx: true,
        ex: 60 * 60 * 48,
      },
    );

    if (locked === "OK") {
      return responseFromStoredAnswer(stored, false);
    }

    // Another request won the race. Always return the first stored
    // answer instead of allowing the answer to change.
    const winningValue = await redis.get<unknown>(answerKey);

    const winning =
      typeof winningValue === "string"
        ? parseStoredAnswer(winningValue)
        : winningValue !== null
          ? parseStoredAnswer(JSON.stringify(winningValue))
          : null;

    if (winning) {
      return responseFromStoredAnswer(winning, true);
    }

    return NextResponse.json(
      { error: "Unable to recover today's saved answer." },
      { status: 409 },
    );
  } catch (error) {
    console.error("Answer API error:", error);

    return NextResponse.json(
      { error: "Unable to process answer." },
      { status: 500 },
    );
  }
}