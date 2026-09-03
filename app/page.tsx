"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { baseSepolia } from "viem/chains";

import {
  BASE_DAILY_ABI,
  BASE_DAILY_ADDRESS,
} from "@/lib/contract/baseDaily";

import {
  connectWallet,
  discoverWallets,
  getConnectedAccount,
  type EthereumProvider,
  type WalletProvider,
} from "@/lib/wallet/provider";

type QuestionResponse = {
  day: number;
  id: number;
  question: string;
  options: [string, string];
};

type AnswerResponse = {
  day: number;
  questionId: number;
  correct: boolean;
  points: number;
  signature: `0x${string}`;
  alreadyAnswered: boolean;
};

type UserStats = {
  totalPlayed: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  lastPlayedDay: number;
};

const BASE_SEPOLIA_CHAIN_ID = "0x14a34";

function isBaseSepoliaChain(chainId: unknown) {
  if (typeof chainId === "number") {
    return chainId === 84532;
  }


  if (typeof chainId !== "string") {
    return false;
  }

  const value = chainId.trim().toLowerCase();

  if (value.startsWith("0x")) {
    return Number.parseInt(value, 16) === 84532;
  }

  return Number.parseInt(value, 10) === 84532;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const [dailyQuestion, setDailyQuestion] =
    useState<QuestionResponse | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimHash, setClaimHash] = useState<`0x${string}` | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(
    null,
  );
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const [wallets, setWallets] = useState<WalletProvider[]>([]);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const cleanupListenersRef = useRef<(() => void) | null>(null);

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

  useEffect(() => {
    void tryAutoReconnect();
    // Run only once when the app starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
    };
  }, []);

  async function readChain(
    providerToRead: EthereumProvider,
    retry = false,
  ) {
    const attempts = retry ? 4 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const chainId = await providerToRead.request({
        method: "eth_chainId",
      });


      if (isBaseSepoliaChain(chainId)) {
        setWrongNetwork(false);
        return true;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    setWrongNetwork(true);
    return false;
  }

  function attachProviderListeners(activeProvider: EthereumProvider) {
    cleanupListenersRef.current?.();

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const nextAccount = accounts?.[0];

      setSelectedAnswer(null);
      setAnswerResult(null);
      setAnswerError(null);
      setClaimError(null);
      setClaimHash(null);
      setUserStats(null);
      setWalletError(null);

      if (nextAccount?.startsWith("0x")) {
        const address = nextAccount as `0x${string}`;
        setWalletAddress(address);
        await readUserStats(address);
      } else {
        handleDisconnect();
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainId = args[0];

      if (typeof chainId === "string") {
        setWrongNetwork(
          !isBaseSepoliaChain(chainId),
        );
      }

      setSelectedAnswer(null);
      setWalletError(null);
    };

    activeProvider.on?.("accountsChanged", handleAccountsChanged);
    activeProvider.on?.("chainChanged", handleChainChanged);

    cleanupListenersRef.current = () => {
      activeProvider.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );
      activeProvider.removeListener?.(
        "chainChanged",
        handleChainChanged,
      );
    };
  }

  async function handleConnectButton() {
    if (walletAddress) {
      setShowAccountMenu((current) => !current);
      setShowWalletPicker(false);
      return;
    }

    setWalletBusy(true);
    setWalletError(null);

    try {
      const discovered = await discoverWallets();

      if (discovered.length === 0) {
        throw new Error("No compatible wallet was found.");
      }

      if (discovered.length === 1) {
        await handleWalletSelection(discovered[0]);
        return;
      }

      setWallets(discovered);
      setShowWalletPicker(true);
    } catch (err) {
      setWalletError(
        err instanceof Error
          ? err.message
          : "Wallet discovery failed.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  async function tryAutoReconnect() {
    if (window.localStorage.getItem("base-daily-disconnected") === "1") {
      return;
    }

    try {
      const discoveredWallets = await discoverWallets();

      if (discoveredWallets.length === 0) {
        return;
      }

      setWallets(discoveredWallets);

      const preferredWalletId = window.localStorage.getItem(
        "base-daily-wallet-id",
      );

      const orderedWallets = preferredWalletId
        ? discoveredWallets.filter(
            (wallet) => wallet.id === preferredWalletId,
          )
        : discoveredWallets;

      for (const wallet of orderedWallets) {
        const account = await getConnectedAccount(wallet.provider);

        if (!account) {
          continue;
        }

        setProvider(wallet.provider);
        setWalletAddress(account);
        attachProviderListeners(wallet.provider);
        window.localStorage.setItem("base-daily-wallet-id", wallet.id);

        await readChain(wallet.provider, true);
        await readUserStats(account);
        return;
      }
    } catch (err) {
      console.error("[Base Daily] auto reconnect failed", err);
    }
  }

  async function handleWalletSelection(wallet: WalletProvider) {
    setWalletBusy(true);
    setWalletError(null);
    setShowWalletPicker(false);

    try {
      const account = await connectWallet(wallet.provider);

      setProvider(wallet.provider);
      setWalletAddress(account);

      attachProviderListeners(wallet.provider);

      const confirmedAccount = await getConnectedAccount(wallet.provider);

      if (confirmedAccount) {
        setWalletAddress(confirmedAccount);
        window.localStorage.removeItem("base-daily-disconnected");
        window.localStorage.setItem("base-daily-wallet-id", wallet.id);
        await readUserStats(confirmedAccount);
      }
      // Some injected wallets briefly report a stale chain after connecting.
      // Retry the selected provider before showing a network warning.
      await readChain(wallet.provider, true);
    } catch (err) {
      setProvider(null);
      setWalletAddress(null);

      setWalletError(
        err instanceof Error
          ? err.message
          : "Wallet connection failed.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  async function readUserStats(address: `0x${string}`) {
    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http("https://sepolia.base.org"),
      });

      const stats = await publicClient.readContract({
        address: BASE_DAILY_ADDRESS,
        abi: BASE_DAILY_ABI,
        functionName: "getUserStats",
        args: [address],
      });

      setUserStats({
        totalPlayed: Number(stats.totalPlayed),
        totalCorrect: Number(stats.totalCorrect),
        currentStreak: Number(stats.currentStreak),
        bestStreak: Number(stats.bestStreak),
        totalPoints: Number(stats.totalPoints),
        lastPlayedDay: Number(stats.lastPlayedDay),
      });
    } catch (err) {
      console.error("[Base Daily] unable to read user stats", err);
      setUserStats(null);
    }
  }

  async function handleSubmitAnswer() {

    if (
      !provider ||
      !walletAddress ||
      !dailyQuestion ||
      selectedAnswer === null ||
      wrongNetwork
    ) {
      return;
    }

    setAnswerBusy(true);
    setAnswerError(null);

    try {
      const currentAccount = await getConnectedAccount(provider);

      if (
        !currentAccount ||
        currentAccount.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        throw new Error(
          "Your active wallet account changed. Please reconnect and try again.",
        );
      }

      const chainId = await provider.request({
        method: "eth_chainId",
      });

      if (!isBaseSepoliaChain(chainId)) {
        setWrongNetwork(true);
        throw new Error("Switch to Base Sepolia before submitting.");
      }

      const response = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: currentAccount,
          questionId: dailyQuestion.id,
          answer: selectedAnswer,
        }),
      });

      const data = (await response.json()) as
        | AnswerResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to submit answer.",
        );
      }

      setAnswerResult(data as AnswerResponse);
    } catch (err) {
      setAnswerError(
        err instanceof Error
          ? err.message
          : "Unable to submit answer.",
      );
    } finally {
      setAnswerBusy(false);
    }
  }

  async function handleClaim() {
    if (
      !provider ||
      !walletAddress ||
      !answerResult ||
      wrongNetwork
    ) {
      return;
    }

    setClaimBusy(true);
    setClaimError(null);
    setClaimHash(null);

    try {
      const currentAccount = await getConnectedAccount(provider);

      if (
        !currentAccount ||
        currentAccount.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        throw new Error(
          "Your active wallet account changed. Please reconnect and try again.",
        );
      }

      const chainId = await provider.request({
        method: "eth_chainId",
      });

      if (!isBaseSepoliaChain(chainId)) {
        setWrongNetwork(true);
        throw new Error("Switch to Base Sepolia before claiming.");
      }

      const walletClient = createWalletClient({
        account: currentAccount,
        chain: baseSepolia,
        transport: custom(provider),
      });

      const hash = await walletClient.writeContract({
        address: BASE_DAILY_ADDRESS,
        abi: BASE_DAILY_ABI,
        functionName: "claimDaily",
        args: [
          BigInt(answerResult.questionId),
          BigInt(answerResult.day),
          answerResult.correct,
          answerResult.signature,
        ],
      });

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http("https://sepolia.base.org"),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        throw new Error("Claim transaction failed.");
      }

      setClaimHash(hash);
    await readUserStats(currentAccount);
    } catch (err) {
      setClaimError(
        err instanceof Error
          ? err.message
          : "Unable to claim points.",
      );
    } finally {
      setClaimBusy(false);
    }
  }
  async function handleSwitchNetwork() {
    if (!provider) {
      return;
    }

    setWalletBusy(true);
    setWalletError(null);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID,
          },
        ],
      });

      await readChain(provider);
    } catch (err) {
      setWalletError(
        err instanceof Error
          ? err.message
          : "Could not switch to Base Sepolia.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  function handleDisconnect() {
    window.localStorage.setItem("base-daily-disconnected", "1");
    cleanupListenersRef.current?.();
    cleanupListenersRef.current = null;

    setProvider(null);
    setWalletAddress(null);
    setUserStats(null);
    setWrongNetwork(false);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setAnswerError(null);
    setClaimError(null);
    setClaimHash(null);
    setWalletError(null);
    setShowAccountMenu(false);
    setShowWalletPicker(false);
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-5 pb-8 pt-6">
        <header className="relative flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9db0c5]">
              Base Daily
            </div>

            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.04em]">
              {dailyQuestion ? `DAY #${dailyQuestion.day}` : "DAY"}
            </h1>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={handleConnectButton}
              disabled={walletBusy}
              className="rounded-full border border-[#5f7892]/40 bg-[#26394d]/60 px-4 py-2 text-xs font-semibold text-[#dbe6f0] backdrop-blur-sm transition hover:border-[#456fff]/70 hover:bg-[#2c4259]/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {walletBusy
                ? "Connecting..."
                : walletAddress
                  ? shortenAddress(walletAddress)
                  : "Connect"}
            </button>

            {showWalletPicker && (
              <div className="absolute right-0 top-12 z-50 w-[230px] overflow-hidden rounded-2xl border border-[#71879c]/30 bg-[#1c3043] p-2 shadow-2xl">
                <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8299af]">
                  Choose Wallet
                </div>

                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleWalletSelection(wallet)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-[#30485f]"
                  >
                    {wallet.icon ? (
                      <img
                        src={wallet.icon}
                        alt=""
                        className="h-7 w-7 rounded-lg"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#456fff] text-xs">
                        W
                      </div>
                    )}

                    <span>{wallet.name}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowWalletPicker(false)}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-xs font-semibold text-[#8fa3b7] transition hover:bg-[#30485f] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {showAccountMenu && walletAddress && (
              <div className="absolute right-0 top-12 z-50 w-[190px] rounded-2xl border border-[#71879c]/30 bg-[#1c3043] p-2 shadow-2xl">
                <div className="px-3 py-2 text-xs text-[#9db0c5]">
                  {shortenAddress(walletAddress)}
                </div>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-red-400/10"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </header>


        {walletError && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-[13px] text-red-100">
            {walletError}
          </div>
        )}

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

          {dailyQuestion && !loading && !error && !answerResult && (
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
                onClick={wrongNetwork ? handleSwitchNetwork : handleSubmitAnswer}
                disabled={
                  !walletAddress ||
                  walletBusy ||
                  answerBusy ||
                  (!wrongNetwork && selectedAnswer === null)
                }
                className="mt-5 h-[58px] w-full rounded-2xl bg-[#456fff] text-[15px] font-bold shadow-[0_8px_28px_rgba(27,48,81,0.22)] transition hover:bg-[#557bff] disabled:cursor-not-allowed disabled:bg-[#34485d]/70 disabled:text-[#8295a9]"
              >
                {!walletAddress
                  ? "Connect Wallet to Answer"
                  : wrongNetwork
                    ? "Switch to Base Sepolia"
                    : answerBusy
                      ? "Submitting..."
                      : "Submit Answer"}
              </button>
            </>
          )}
        </section>

          {answerError && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-[14px] text-red-100">
              {answerError}
            </div>
          )}

          {answerResult && (
            <div className="rounded-3xl border border-[#7790a8]/25 bg-[#293e53]/45 px-6 py-7 text-center backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5d86ff]">
                Your Result
              </div>

              <h3 className="mt-4 text-[32px] font-bold tracking-[-0.04em]">
                {answerResult.correct ? "Correct!" : "Not quite"}
              </h3>

              <p className="mt-3 text-[15px] leading-6 text-[#a7b8c9]">
                {answerResult.correct
                  ? "You earned 3 points today."
                  : "You earned 1 participation point today."}
              </p>

              {claimError && (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-[13px] text-red-100">
                  {claimError}
                </div>
              )}

              {claimHash ? (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                  <div className="text-[15px] font-bold text-emerald-100">
                    Points claimed!
                  </div>
                  <div className="mt-1 text-xs text-[#a7b8c9]">
                    Your Base Sepolia transaction was confirmed.
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claimBusy || wrongNetwork}
                  className="mt-6 h-[58px] w-full rounded-2xl bg-[#456fff] text-[15px] font-bold shadow-[0_8px_28px_rgba(27,48,81,0.22)] transition hover:bg-[#557bff] disabled:cursor-not-allowed disabled:bg-[#34485d]/70 disabled:text-[#8295a9]"
                >
                  {claimBusy
                    ? "Claiming..."
                    : `CLAIM +${answerResult.points} POINTS`}
                </button>
              )}
            </div>
          )}
        <section className="mt-auto pt-14">
          <div className="grid grid-cols-3 divide-x divide-[#8299af]/20 rounded-2xl border border-[#8299af]/25 bg-[#293e53]/45 py-4 backdrop-blur-sm shadow-[0_10px_40px_rgba(10,20,32,0.14)]">
            <div className="text-center">
              <div className="text-[17px] font-bold">{userStats?.totalPoints ?? 0}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Points
              </div>
            </div>

            <div className="text-center">
              <div className="text-[17px] font-bold">{userStats?.currentStreak ?? 0}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Streak
              </div>
            </div>

            <div className="text-center">
              <div className="text-[17px] font-bold">{userStats?.totalCorrect ?? 0}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c2]">
                Correct
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-[#72a0ff] transition hover:text-white"
          >
            <span>View Leaderboard</span>
          </button>
        </section>
      </div>
    </main>
  );
}
