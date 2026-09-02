"use client";

import { useEffect, useState } from "react";

type QuestionResponse = {
  day: number;
  id: number;
  question: string;
  options: [string, string];
};

export default function Home() {
  const [dailyQuestion, setDailyQuestion] =
    useState<QuestionResponse | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestion() {
      try {
        const response = await fetch("/api/question", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load today's question.");
        }

        const data = (await response.json()) as QuestionResponse;

        if (!cancelled) {
          setDailyQuestion(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Today's question could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQuestion();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-5 pb-8 pt-6">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9db0c5]">
              Base Daily
            </div>

            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.04em]">
              {dailyQuestion ? `DAY #${dailyQuestion.day}` : "DAY"}
            </h1>
          </div>

          <button
            type="button"
            className="rounded-full border border-[#5f7892]/40 bg-[#26394d]/60 px-4 py-2 text-xs font-semibold text-[#dbe6f0] backdrop-blur-sm transition hover:border-[#456fff]/70 hover:bg-[#2c4259]/80"
          >
            Connect
          </button>
        </header>

        <section className="mt-16">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5d86ff]">
            Today&apos;s Question
          </div>

          <h2 className="mt-3 text-[34px] font-bold leading-[1.08] tracking-[-0.045em]">
            One question.
            <br />
            Every day.
          </h2>

          <p className="mt-4 max-w-sm text-[15px] leading-6 text-[#a7b8c9]">
            Answer today&apos;s Base question, claim your points and keep your
            streak alive.
          </p>
        </section>

        <section className="mt-10">
          {loading && (
            <p className="text-[15px] font-medium text-[#a7b8c9]">
              Loading today&apos;s question...
            </p>
          )}

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-[14px] text-red-100">
              {error}
            </div>
          )}

          {dailyQuestion && !loading && !error && (
            <>
              <p className="text-[20px] font-semibold tracking-[-0.025em]">
                {dailyQuestion.question}
              </p>

              <div className="mt-5 flex flex-col gap-3">
                {dailyQuestion.options.map((answer, index) => {
                  const selected = selectedAnswer === index;

                  return (
                    <button
                      key={`${dailyQuestion.id}-${index}`}
                      type="button"
                      onClick={() => setSelectedAnswer(index)}
                      className={`flex min-h-[62px] w-full items-center justify-between rounded-2xl border px-5 text-left text-[15px] font-semibold backdrop-blur-sm transition ${
                        selected
                          ? "border-[#5d86ff] bg-[#456fff]/20 text-white shadow-[0_0_24px_rgba(69,111,255,0.10)]"
                          : "border-[#7790a8]/25 bg-[#31475d]/45 text-[#eef4f9] hover:border-[#8ca4ba]/45 hover:bg-[#365069]/55"
                      }`}
                    >
                      <span>{answer}</span>

                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected
                            ? "border-[#5d86ff] bg-[#456fff]"
                            : "border-[#a4b5c5]/55"
                        }`}
                      >
                        {selected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedAnswer === null}
                className="mt-5 h-[58px] w-full rounded-2xl bg-[#456fff] text-[15px] font-bold shadow-[0_8px_28px_rgba(27,48,81,0.22)] transition hover:bg-[#557bff] disabled:cursor-not-allowed disabled:bg-[#34485d]/70 disabled:text-[#8295a9]"
              >
                Submit Answer
              </button>
            </>
          )}
        </section>

        <section className="mt-auto pt-14">
          <div className="grid grid-cols-3 divide-x divide-[#8299af]/20 rounded-2xl border border-[#8299af]/25 bg-[#293e53]/45 py-4 backdrop-blur-sm shadow-[0_10px_40px_rgba(10,20,32,0.14)]">
            <div className="text-center">
              <div className="text-[17px] font-bold">24</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Points
              </div>
            </div>

            <div className="text-center">
              <div className="text-[17px] font-bold">🔥 10</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Streak
              </div>
            </div>

            <div className="text-center">
              <div className="text-[17px] font-bold">✓ 7</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Correct
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-[#72a0ff] transition hover:text-white"
          >
            <span>🏆</span>
            <span>View Leaderboard</span>
          </button>
        </section>
      </div>
    </main>
  );
}