import { randomUUID } from "node:crypto";

import { redis } from "@/lib/server/redis";

const COINBASE_BASE_URL = "https://api.coinbase.com/v1/tokenized-stocks";
const DEFAULT_BASE_RPC_URL = "https://base-rpc.publicnode.com";
const CACHE_KEY = "base-opportunity-agent:tokenized-stocks:v1";
const LOCK_KEY = "base-opportunity-agent:tokenized-stocks:refresh-lock";
const VERIFICATION_CACHE_KEY = "base-opportunity-agent:tokenized-stocks:verification:v1";
const VERIFICATION_CURSOR_KEY = "base-opportunity-agent:tokenized-stocks:verification-cursor:v1";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const FRESH_FOR_SECONDS = 60 * 15;
const MAX_ONCHAIN_VERIFICATIONS_PER_REFRESH = 3;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const COINBASE_API_TIMEOUT_MS = 8_000;
const RPC_TIMEOUT_MS = 4_000;
const HEAVY_RPC_INTERVAL_MS = 260;

type CoinbaseToken = {
  contract_address?: string;
  symbol?: string;
  name?: string;
  decimals?: number | string;
  total_supply?: number | string;
  isin?: string;
  multiplier?: number;
  paused_features?: number[];
  nav_price?: number | string;
  nav_price_updated_at?: string;
  first_mint_date?: string;
};

type CoinbaseChain = {
  chain_id?: string | number;
  chain?: string;
  policy_registry_address?: string;
  token_supply_manager_address?: string;
  token_factory_address?: string;
};

type RpcCallResponse = {
  result?: string;
  error?: { code?: number; message?: string };
};

export type VerifiedTokenizedStock = {
  symbol: string;
  name: string;
  contractAddress: string;
  decimals: number | null;
  isin: string | null;
  codeDeployed: boolean | null;
  onchainSupplyRaw: string | null;
  onchainSupply: string | null;
  issuerReportedSupply: number | null;
  multiplier: number | null;
  pausedFeatures: number[];
  navReferencePrice: number | null;
  navUpdatedAt: string | null;
  navAgeSeconds: number | null;
  firstMintDate: string | null;
  prospectusUrl: string;
  status: "live_supply" | "deployed_zero_supply" | "needs_review";
  verificationNotes: string[];
};

export type TokenizedStocksSnapshot = {
  checkedAt: string;
  network: "base-mainnet";
  chainId: 8453;
  source: {
    issuerApi: string;
    chainContractsApi: string;
    rpc: string;
    priceMeaning: string;
    supplyMeaning: string;
  };
  chainContracts: {
    chain: string | null;
    policyRegistry: string | null;
    tokenSupplyManager: string | null;
    tokenFactory: string | null;
  };
  pagination: {
    complete: boolean;
    pagesFetched: number;
    recordsReceived: number;
    nextPagePresent: boolean;
  };
  totals: {
    tokensListed: number;
    onchainSupplyVerified: number;
    liveSupply: number;
    zeroSupply: number;
    needsReview: number;
    navPriceAvailable: number;
    staleNavPrice: number;
  };
  verificationProgress: {
    checkedThisRefresh: number;
    checkedTotal: number;
    pending: number;
    cursorIndex: number;
    batchSize: number;
  };
  tokens: VerifiedTokenizedStock[];
  caveats: string[];
  cachedAt?: string;
  cacheState?: "fresh" | "stale_fallback" | "refreshed";
  refreshError?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatUnits(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();

  const negative = raw < BigInt(0);
  const absolute = negative ? -raw : raw;
  const padded = absolute.toString().padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, -decimals);
  const fractionalPart = padded.slice(-decimals).replace(/0+$/, "");

  return `${negative ? "-" : ""}${integerPart}${fractionalPart ? `.${fractionalPart}` : ""}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(COINBASE_API_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Coinbase tokenized-stocks API failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

async function fetchAllCoinbaseTokens() {
  const tokens: CoinbaseToken[] = [];
  let pageToken: string | null = null;
  let pagesFetched = 0;
  let nextPagePresent = false;

  while (pagesFetched < MAX_PAGES) {
    const url = new URL(COINBASE_BASE_URL);
    url.searchParams.set("page_size", String(PAGE_SIZE));
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const response = await fetchJson<{
      tokens?: CoinbaseToken[];
      next_page_token?: string;
    }>(url.toString());

    if (!Array.isArray(response.tokens)) {
      throw new Error("Coinbase tokenized-stocks API returned no tokens array.");
    }

    tokens.push(...response.tokens);
    pagesFetched += 1;

    const nextToken = safeString(response.next_page_token);
    nextPagePresent = Boolean(nextToken);
    if (!nextToken) break;
    pageToken = nextToken;
  }

  return {
    tokens,
    pagesFetched,
    paginationComplete: !nextPagePresent,
    nextPagePresent,
  };
}

async function fetchOnchainTotalSupply(address: string): Promise<RpcCallResponse> {
  const rpcUrl = process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL;

  const response = await fetch(rpcUrl, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: address, data: "0x18160ddd" }, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Base RPC eth_call failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error("Base RPC returned an invalid JSON-RPC response.");
  }

  return payload as RpcCallResponse;
}

async function verifyTokensOnchain(tokens: CoinbaseToken[]) {
  const verified = new Map<
    string,
    { codeDeployed: boolean | null; supplyRaw: string | null; notes: string[] }
  >();

  // Nodely documents a 5 req/s ceiling for heavy eth_call requests. Read one
  // token at a time and leave a small margin rather than sending an oversized
  // batch, which could be rejected by public RPC providers.
  for (let index = 0; index < tokens.length; index += 1) {
    if (index > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, HEAVY_RPC_INTERVAL_MS),
      );
    }

    const token = tokens[index];
    const address = safeString(token.contract_address);
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) continue;

    const notes: string[] = [];

    try {
      const response = await fetchOnchainTotalSupply(address);
      if (
        response.result &&
        /^0x[0-9a-fA-F]{64}$/.test(response.result)
      ) {
        const supplyRaw = BigInt(response.result).toString();
        verified.set(address.toLowerCase(), {
          // A successful ERC-20 totalSupply() read confirms that the address
          // responds to the token contract selector; it is not a full code audit.
          codeDeployed: true,
          supplyRaw,
          notes,
        });
      } else {
        notes.push(
          response.error?.message ?? "The onchain totalSupply() read returned no valid uint256.",
        );
        verified.set(address.toLowerCase(), {
          codeDeployed: null,
          supplyRaw: null,
          notes,
        });
      }
    } catch (error) {
      notes.push(
        error instanceof Error ? error.message : "Unknown Base RPC read error.",
      );
      verified.set(address.toLowerCase(), {
        codeDeployed: null,
        supplyRaw: null,
        notes,
      });
    }
  }

  return verified;
}

function validateChainContracts(chains: CoinbaseChain[]) {
  const baseChain = chains.find((chain) => Number(chain.chain_id) === 8453);

  return {
    chain: safeString(baseChain?.chain),
    policyRegistry: safeString(baseChain?.policy_registry_address),
    tokenSupplyManager: safeString(baseChain?.token_supply_manager_address),
    tokenFactory: safeString(baseChain?.token_factory_address),
  };
}

type OnchainVerification = {
  codeDeployed: boolean | null;
  supplyRaw: string | null;
  notes: string[];
};

async function readVerificationCache(): Promise<Record<string, OnchainVerification>> {
  const cached = await redis.get<Record<string, OnchainVerification> | string>(
    VERIFICATION_CACHE_KEY,
  );
  if (!cached) return {};

  if (typeof cached === "string") {
    try {
      const parsed: unknown = JSON.parse(cached);
      return isRecord(parsed) ? (parsed as Record<string, OnchainVerification>) : {};
    } catch {
      return {};
    }
  }

  return isRecord(cached)
    ? (cached as Record<string, OnchainVerification>)
    : {};
}

async function buildSnapshot(): Promise<TokenizedStocksSnapshot> {
  const [coinbase, chainsResponse] = await Promise.all([
    fetchAllCoinbaseTokens(),
    fetchJson<{ chains?: CoinbaseChain[] }>(`${COINBASE_BASE_URL}/chains`),
  ]);

  if (!Array.isArray(chainsResponse.chains)) {
    throw new Error("Coinbase tokenized-stocks chains endpoint returned no chains array.");
  }

  const chainContracts = validateChainContracts(chainsResponse.chains);
  if (!chainContracts.chain) {
    throw new Error("Coinbase tokenized-stocks API did not return Base chain (8453).");
  }

  const baseTokens = coinbase.tokens.filter((token) => {
    const address = safeString(token.contract_address);
    const symbol = safeString(token.symbol);
    return Boolean(
      address &&
        /^0x[a-fA-F0-9]{40}$/.test(address) &&
        symbol &&
        token.decimals !== undefined,
    );
  });

  // Verify a small round-robin batch on each refresh. Coinbase's stock
  // catalogue can contain many contracts; reading all of them in one serverless
  // invocation caused timeouts. Prior results are retained in Redis.
  const previousVerification = await readVerificationCache();
  const savedCursor = Number(
    await redis.get<number | string>(VERIFICATION_CURSOR_KEY),
  );
  const cursorIndex =
    Number.isInteger(savedCursor) && savedCursor >= 0 && savedCursor < baseTokens.length
      ? savedCursor
      : 0;
  const checkedTokens =
    baseTokens.length === 0
      ? []
      : Array.from(
          { length: Math.min(MAX_ONCHAIN_VERIFICATIONS_PER_REFRESH, baseTokens.length) },
          (_, offset) => baseTokens[(cursorIndex + offset) % baseTokens.length],
        );
  const onchainBatch = await verifyTokensOnchain(checkedTokens);
  const onchain = {
    ...previousVerification,
    ...Object.fromEntries(onchainBatch.entries()),
  };
  const nextCursorIndex =
    baseTokens.length === 0
      ? 0
      : (cursorIndex + checkedTokens.length) % baseTokens.length;

  const checkedTotal = baseTokens.filter((token) => {
    const address = safeString(token.contract_address);
    return Boolean(address && onchain[address.toLowerCase()]);
  }).length;

  await Promise.all([
    redis.set(VERIFICATION_CACHE_KEY, onchain, { ex: CACHE_TTL_SECONDS }),
    redis.set(VERIFICATION_CURSOR_KEY, String(nextCursorIndex), {
      ex: CACHE_TTL_SECONDS,
    }),
  ]);

  const checkedAt = new Date().toISOString();

  const tokens: VerifiedTokenizedStock[] = baseTokens.map((token) => {
    const address = safeString(token.contract_address) as string;
    const symbol = safeString(token.symbol) as string;
    const result = onchain[address.toLowerCase()];
    const decimals = safeNumber(token.decimals);
    const supplyRaw = result?.supplyRaw ?? null;
    const issuerReportedSupply = safeNumber(token.total_supply);
    const navReferencePrice = safeNumber(token.nav_price);
    const navUpdatedAt = safeString(token.nav_price_updated_at);
    const parsedNavDate = navUpdatedAt ? new Date(navUpdatedAt).getTime() : NaN;
    const navAgeSeconds = Number.isFinite(parsedNavDate)
      ? Math.max(0, Math.floor((Date.now() - parsedNavDate) / 1000))
      : null;

    const verificationNotes = [...(result?.notes ?? [])];
    if (!result) {
      verificationNotes.push(
        "Onchain verification is pending; the agent checks a small rotating batch on each refresh.",
      );
    }
    if (decimals === null) {
      verificationNotes.push("Issuer API did not provide valid token decimals.");
    }
    if (issuerReportedSupply === null) {
      verificationNotes.push("Issuer API did not provide total_supply.");
    }
    if (navReferencePrice !== null && navAgeSeconds === null) {
      verificationNotes.push("NAV reference update time is missing or invalid.");
    }

    let status: VerifiedTokenizedStock["status"] = "needs_review";
    if (result?.codeDeployed === true && supplyRaw !== null) {
      status = BigInt(supplyRaw) > BigInt(0)
        ? "live_supply"
        : "deployed_zero_supply";
    }

    return {
      symbol,
      name: safeString(token.name) ?? symbol,
      contractAddress: address,
      decimals,
      isin: safeString(token.isin),
      codeDeployed: result?.codeDeployed ?? null,
      onchainSupplyRaw: supplyRaw,
      onchainSupply:
        supplyRaw !== null && decimals !== null
          ? formatUnits(BigInt(supplyRaw), decimals)
          : null,
      issuerReportedSupply,
      multiplier: safeNumber(token.multiplier),
      pausedFeatures: Array.isArray(token.paused_features)
        ? token.paused_features.filter((item) => Number.isInteger(item))
        : [],
      navReferencePrice,
      navUpdatedAt,
      navAgeSeconds,
      firstMintDate: safeString(token.first_mint_date),
      prospectusUrl: `${COINBASE_BASE_URL}/prospectus/${encodeURIComponent(symbol)}.pdf`,
      status,
      verificationNotes,
    };
  });

  return {
    checkedAt,
    network: "base-mainnet",
    chainId: 8453,
    source: {
      issuerApi: COINBASE_BASE_URL,
      chainContractsApi: `${COINBASE_BASE_URL}/chains`,
      rpc: process.env.BASE_RPC_URL ? "Configured BASE_RPC_URL" : DEFAULT_BASE_RPC_URL,
      priceMeaning:
        "navReferencePrice is the issuer's Chainlink NAV/reference value, not an executable bid/ask or guaranteed fill price. It may be stale outside market hours.",
      supplyMeaning:
        "Onchain totalSupply() is read from Base and normalized using issuer API decimals. The issuer-reported supply is retained separately for comparison.",
    },
    chainContracts,
    pagination: {
      complete: coinbase.paginationComplete,
      pagesFetched: coinbase.pagesFetched,
      recordsReceived: coinbase.tokens.length,
      nextPagePresent: coinbase.nextPagePresent,
    },
    totals: {
      tokensListed: tokens.length,
      onchainSupplyVerified: tokens.filter((token) => token.onchainSupplyRaw !== null).length,
      liveSupply: tokens.filter((token) => token.status === "live_supply").length,
      zeroSupply: tokens.filter((token) => token.status === "deployed_zero_supply").length,
      needsReview: tokens.filter((token) => token.status === "needs_review").length,
      navPriceAvailable: tokens.filter((token) => token.navReferencePrice !== null).length,
      staleNavPrice: tokens.filter(
        (token) => token.navAgeSeconds !== null && token.navAgeSeconds > 24 * 60 * 60,
      ).length,
    },
    verificationProgress: {
      checkedThisRefresh: checkedTokens.length,
      checkedTotal,
      pending: Math.max(0, tokens.length - checkedTotal),
      cursorIndex: nextCursorIndex,
      batchSize: MAX_ONCHAIN_VERIFICATIONS_PER_REFRESH,
    },
    tokens,
    caveats: [
      "The issuer API is read-only reference data; listing a token does not establish that a particular user is legally eligible to buy or transfer it.",
      "Base says Coinbase Tokenized Stocks are available only to people in eligible jurisdictions outside the United States; confirm current eligibility and terms with the issuer.",
      "A successful totalSupply() call confirms an ERC-20-style response, not source-code safety, legal status, or redeemability.",
      "Issuer-reported supply and Base onchain totalSupply() are shown separately; discrepancies need investigation rather than silent reconciliation.",
      "NAV/reference price is not a bid, ask, executable quote, or proof of current secondary-market liquidity.",
      "This endpoint does not read DEX pool depth, trading volume, redemption queues, or the issuer's current legal documents beyond linking to its prospectus.",
      "Coinbase API pagination must complete before the snapshot is considered a full issuer list.",
    ],
  };
}

async function readCachedSnapshot(): Promise<TokenizedStocksSnapshot | null> {
  const cached = await redis.get<TokenizedStocksSnapshot | string>(CACHE_KEY);
  if (!cached) return null;

  if (typeof cached === "string") {
    try {
      return JSON.parse(cached) as TokenizedStocksSnapshot;
    } catch {
      return null;
    }
  }

  return cached;
}

export async function syncBaseTokenizedStocks(): Promise<TokenizedStocksSnapshot> {
  const lockToken = randomUUID();
  const lock = await redis.set(LOCK_KEY, lockToken, { nx: true, ex: 180 });

  if (lock !== "OK") {
    throw new Error("A tokenized-stocks refresh is already running.");
  }

  try {
    const snapshot = await buildSnapshot();
    await redis.set(CACHE_KEY, snapshot, { ex: CACHE_TTL_SECONDS });
    return { ...snapshot, cachedAt: snapshot.checkedAt, cacheState: "refreshed" };
  } finally {
    try {
      await redis.eval(
        `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end return 0`,
        [LOCK_KEY],
        [lockToken],
      );
    } catch (error) {
      console.error("[Base Opportunity Agent] Unable to release tokenized-stocks refresh lock.", error);
    }
  }
}

export async function getBaseTokenizedStocksSnapshot(options: {
  forceRefresh?: boolean;
} = {}): Promise<TokenizedStocksSnapshot> {
  const cached = await readCachedSnapshot();
  const cacheAgeSeconds = cached
    ? Math.max(0, Math.floor((Date.now() - new Date(cached.checkedAt).getTime()) / 1000))
    : null;

  if (
    !options.forceRefresh &&
    cached &&
    cacheAgeSeconds !== null &&
    cacheAgeSeconds < FRESH_FOR_SECONDS
  ) {
    return { ...cached, cachedAt: cached.checkedAt, cacheState: "fresh" };
  }

  try {
    return await syncBaseTokenizedStocks();
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        cachedAt: cached.checkedAt,
        cacheState: "stale_fallback",
        refreshError: error instanceof Error ? error.message : "Unknown refresh error.",
      };
    }
    throw error;
  }
}
