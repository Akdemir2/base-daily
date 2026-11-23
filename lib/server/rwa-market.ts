import { randomUUID } from "node:crypto";

import { redis } from "@/lib/server/redis";

const API_BASE = "https://rwapipe.com/api";
const MARKET_CACHE_KEY = "base-opportunity-agent:rwa-market:v1";
const MARKET_LOCK_KEY = "base-opportunity-agent:rwa-market:refresh-lock";
const CACHE_TTL_SECONDS = 60 * 60 * 30;
const FRESH_FOR_SECONDS = 60 * 60 * 4;
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_LIMIT = 500;

type UnknownRecord = Record<string, unknown>;

export type RwaPipeToken = {
  name: string | null;
  symbol: string | null;
  chain: string;
  contractAddress: string | null;
  issuer: string | null;
  category: string | null;
  tvlUsd: number | null;
  apyPercent: number | null;
  holderCount: number | null;
  change24hPercent: number | null;
  change7dPercent: number | null;
  change30dPercent: number | null;
  riskScore: number | null;
  riskLevel: string | null;
  lastUpdated: string | null;
  classification: "candidate_rwa" | "needs_classification" | "excluded_non_rwa";
  classificationReason: string | null;
};

export type ExcludedRwaProviderToken = {
  name: string | null;
  symbol: string | null;
  category: string | null;
  tvlUsd: number | null;
  reason: string;
};

export type BaseRwaMarketSnapshot = {
  checkedAt: string;
  providerUpdatedAt: string | null;
  chain: "base";
  chainId: 8453;
  provider: {
    name: "RWA Pipe";
    marketApi: string;
    tokenApi: string;
    dataDisclaimer: string;
  };
  providerSummary: {
    tokens: number | null;
    totalTvlUsd: number | null;
    averageApyPercent: number | null;
    sumOfReturnedTokenTvlUsd: number;
    tokenRecordsReturned: number;
    responseComplete: boolean;
    methodologyNote: string;
  };
  rwaSummary: {
    candidateTokens: number;
    candidateTvlUsd: number;
    unclassifiedTokens: number;
    unclassifiedTvlUsd: number;
    excludedTokens: number;
    excludedTvlUsd: number;
  };
  tokens: RwaPipeToken[];
  excludedProviderTokens: ExcludedRwaProviderToken[];
  coverage: {
    stablecoinsExcluded: true;
    apiLimit: string;
    tokensLimit: number;
  };
  caveats: string[];
  cachedAt?: string;
  cacheState?: "fresh" | "stale_fallback" | "refreshed";
  refreshError?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function firstDefined(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return null;
}

async function fetchProviderJson(url: string): Promise<UnknownRecord> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.RWAPIPE_API_KEY) {
    headers["X-API-Key"] = process.env.RWAPIPE_API_KEY;
  }

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers,
  });

  if (!response.ok) {
    throw new Error(`RWA Pipe API failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.success === false) {
    throw new Error("RWA Pipe returned an unsuccessful or malformed payload.");
  }

  return payload;
}

function normaliseToken(item: unknown): RwaPipeToken | null {
  if (!isRecord(item)) return null;

  const chain = toStringOrNull(firstDefined(item, ["chain", "network"]));
  if (chain && chain.toLowerCase() !== "base") return null;

  const name = toStringOrNull(firstDefined(item, ["name", "tokenName", "token_name"]));
  const symbol = toStringOrNull(firstDefined(item, ["symbol", "ticker"]));
  const category = toStringOrNull(firstDefined(item, ["category", "type", "assetType", "asset_type"]));
  const tvlUsd = toNumber(
    firstDefined(item, ["tvl", "tvlUsd", "tvl_usd", "currentTVL", "current_tvl", "valueUsd", "value_usd"]),
  );

  const normalizedName = (name ?? "").toLowerCase();
  const normalizedSymbol = (symbol ?? "").toLowerCase();
  const isWrappedCrypto =
    /^(cbbtc|wbtc|tbtc|btc\.b|cbeth|weth|reth|steth)$/.test(normalizedSymbol) ||
    /wrapped (bitcoin|btc|ethereum|ether)/.test(normalizedName);
  const isStablecoinLendingVault =
    /morpho|steakhouse/.test(normalizedName) &&
    /(usdc|usdt|stablecoin)/.test(`${normalizedName} ${normalizedSymbol}`);

  const supportedCategories = new Set([
    "us-treasury",
    "non-us-debt",
    "private-credit",
    "commodity",
    "equity",
    "real-estate",
    "real-estate-debt",
    "bond",
    "bonds",
    "money-market",
    "institutional-fund",
    "active-strategies",
  ]);

  let classification: RwaPipeToken["classification"] = "needs_classification";
  let classificationReason: string | null =
    "Provider category needs manual review before inclusion in strict RWA totals.";

  if (isWrappedCrypto) {
    classification = "excluded_non_rwa";
    classificationReason = "Wrapped crypto asset, not an offchain real-world asset.";
  } else if (isStablecoinLendingVault) {
    classification = "excluded_non_rwa";
    classificationReason = "Stablecoin lending/vault share, not the underlying real-world asset.";
  } else if (category && supportedCategories.has(category.toLowerCase())) {
    classification = "candidate_rwa";
    classificationReason = null;
  }

  return {
    name,
    symbol,
    chain: "base",
    contractAddress: toStringOrNull(
      firstDefined(item, ["address", "contractAddress", "contract_address", "tokenAddress", "token_address"]),
    ),
    issuer: toStringOrNull(firstDefined(item, ["issuer", "issuerName", "issuer_name"])),
    category,
    tvlUsd,
    apyPercent: toNumber(
      firstDefined(item, ["apy", "currentApy", "current_apy", "currentAPY", "apyPercent", "apy_percent"]),
    ),
    holderCount: toNumber(
      firstDefined(item, ["holderCount", "holder_count", "holders", "holdersCount"]),
    ),
    change24hPercent: toNumber(
      firstDefined(item, ["change24h", "change_24h", "change24hPct", "change_24h_pct"]),
    ),
    change7dPercent: toNumber(
      firstDefined(item, ["change7d", "change_7d", "change7dPct", "change_7d_pct"]),
    ),
    change30dPercent: toNumber(
      firstDefined(item, ["change30d", "change_30d", "change30dPct", "change_30d_pct"]),
    ),
    riskScore: toNumber(firstDefined(item, ["risk_score", "riskScore"])),
    riskLevel: toStringOrNull(firstDefined(item, ["risk_level", "riskLevel"])),
    lastUpdated: toStringOrNull(
      firstDefined(item, ["lastUpdated", "last_updated", "updatedAt", "updated_at", "timestamp"]),
    ),
    classification,
    classificationReason,
  };
}

function extractArray(payload: UnknownRecord, key: string): unknown[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function numberFromSummary(summary: UnknownRecord, keys: string[]) {
  return toNumber(firstDefined(summary, keys));
}

async function buildSnapshot(): Promise<BaseRwaMarketSnapshot> {
  const marketUrl = new URL(`${API_BASE}/market`);
  marketUrl.searchParams.set("chain", "base");
  marketUrl.searchParams.set("excludeStablecoins", "true");

  const tokensUrl = new URL(`${API_BASE}/tokens`);
  tokensUrl.searchParams.set("chain", "base");
  tokensUrl.searchParams.set("limit", String(TOKEN_LIMIT));
  tokensUrl.searchParams.set("sortBy", "tvl");
  tokensUrl.searchParams.set("order", "desc");
  tokensUrl.searchParams.set("excludeStablecoins", "true");

  const [marketPayload, tokenPayload] = await Promise.all([
    fetchProviderJson(marketUrl.toString()),
    fetchProviderJson(tokensUrl.toString()),
  ]);

  const marketSummary = isRecord(marketPayload.summary)
    ? marketPayload.summary
    : {};
  const tokenItems = extractArray(tokenPayload, "data");
  const marketItems = extractArray(marketPayload, "data");
  const sourceItems = tokenItems.length > 0 ? tokenItems : marketItems;

  if (sourceItems.length === 0) {
    throw new Error("RWA Pipe returned no Base token records.");
  }

  const normalised = sourceItems
    .map(normaliseToken)
    .filter((token): token is RwaPipeToken => token !== null);

  const tokens = normalised
    .filter((token) => token.symbol || token.name)
    .sort((a, b) => (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1));

  const recordsWithTvl = tokens.filter((token) => token.tvlUsd !== null);
  const sumOfReturnedTokenTvlUsd = recordsWithTvl.reduce(
    (sum, token) => sum + (token.tvlUsd ?? 0),
    0,
  );
  const excludedProviderTokens = tokens
    .filter((token) => token.classification === "excluded_non_rwa")
    .map((token) => ({
      name: token.name,
      symbol: token.symbol,
      category: token.category,
      tvlUsd: token.tvlUsd,
      reason: token.classificationReason ?? "Excluded from strict RWA totals.",
    }));
  const unclassifiedTokens = tokens.filter(
    (token) => token.classification === "needs_classification",
  );
  const candidateTokens = tokens.filter(
    (token) => token.classification === "candidate_rwa",
  );
  const sumTvl = (rows: RwaPipeToken[]) =>
    rows.reduce((sum, token) => sum + (token.tvlUsd ?? 0), 0);

  const generatedAt =
    toStringOrNull(firstDefined(marketPayload, ["generated_at", "generatedAt", "lastUpdated", "last_updated"])) ??
    toStringOrNull(firstDefined(tokenPayload, ["generated_at", "generatedAt", "lastUpdated", "last_updated"]));

  return {
    checkedAt: new Date().toISOString(),
    providerUpdatedAt: generatedAt,
    chain: "base",
    chainId: 8453,
    provider: {
      name: "RWA Pipe",
      marketApi: marketUrl.toString(),
      tokenApi: tokensUrl.toString(),
      dataDisclaimer:
        "Third-party indexed market data. Values, APY, holder counts and classifications may be delayed or incomplete and are not issuer attestations.",
    },
    providerSummary: {
      tokens: numberFromSummary(marketSummary, ["totalTokens", "total_tokens", "tokenCount", "token_count"]) ?? tokens.length,
      totalTvlUsd: numberFromSummary(marketSummary, ["totalTVL", "totalTvl", "total_tvl", "total_tvl_usd"]),
      averageApyPercent: numberFromSummary(marketSummary, ["avgApy", "avgAPY", "averageApy", "average_apy"]),
      sumOfReturnedTokenTvlUsd,
      tokenRecordsReturned: tokens.length,
      responseComplete: tokens.length < TOKEN_LIMIT,
      methodologyNote:
        "Raw provider total may include wrapped crypto or DeFi vault shares. Use rwaSummary for the conservative, category-filtered candidate set.",
    },
    rwaSummary: {
      candidateTokens: candidateTokens.length,
      candidateTvlUsd: sumTvl(candidateTokens),
      unclassifiedTokens: unclassifiedTokens.length,
      unclassifiedTvlUsd: sumTvl(unclassifiedTokens),
      excludedTokens: excludedProviderTokens.length,
      excludedTvlUsd: sumTvl(tokens.filter((token) => token.classification === "excluded_non_rwa")),
    },
    tokens,
    excludedProviderTokens,
    coverage: {
      stablecoinsExcluded: true,
      apiLimit: process.env.RWAPIPE_API_KEY
        ? "RWA Pipe authenticated free/API-key bucket"
        : "RWA Pipe anonymous public limit documented at 100 requests/minute per IP",
      tokensLimit: TOKEN_LIMIT,
    },
    caveats: [
      "Provider data is third-party indexed data, not direct issuer certification or audited AUM.",
      "A token's TVL is not the same as executable DEX liquidity, redemption capacity, or investor-accessible liquidity.",
      "APY may be unavailable, stale, or calculated under provider methodology; compare its observation time and yield source before relying on it.",
      "Holder statistics can reflect indexed transfer history and may not represent complete holder balances.",
      "Issuer legal rights, custody, eligibility, redemption, audit coverage, contract controls and source of yield must be checked against primary documents.",
      "Stablecoins are excluded from this Base RWA snapshot to reduce the chance of presenting payment tokens as tokenized real-world assets.",
      "Wrapped crypto assets (for example cbBTC) and stablecoin lending vault shares (for example a Morpho USDC vault token) are excluded from the conservative RWA candidate total even if the provider labels them as commodity or money-market products.",
      "Provider rows with an unsupported or generic category are shown as unclassified and excluded from the conservative RWA candidate total until manually reviewed.",
      "The token list is capped at 500 records; if the provider returns the full cap, responseComplete remains false and coverage must be considered partial.",
    ],
  };
}

async function readCachedSnapshot(): Promise<BaseRwaMarketSnapshot | null> {
  const cached = await redis.get<BaseRwaMarketSnapshot | string>(MARKET_CACHE_KEY);
  if (!cached) return null;

  if (typeof cached === "string") {
    try {
      return JSON.parse(cached) as BaseRwaMarketSnapshot;
    } catch {
      return null;
    }
  }

  return cached;
}

export async function syncBaseRwaMarketSnapshot(): Promise<BaseRwaMarketSnapshot> {
  const lockToken = randomUUID();
  const lock = await redis.set(MARKET_LOCK_KEY, lockToken, {
    nx: true,
    ex: 120,
  });

  if (lock !== "OK") {
    throw new Error("A Base RWA market refresh is already running.");
  }

  try {
    const snapshot = await buildSnapshot();
    await redis.set(MARKET_CACHE_KEY, snapshot, { ex: CACHE_TTL_SECONDS });

    return {
      ...snapshot,
      cachedAt: snapshot.checkedAt,
      cacheState: "refreshed",
    };
  } finally {
    try {
      await redis.eval(
        `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end return 0`,
        [MARKET_LOCK_KEY],
        [lockToken],
      );
    } catch (error) {
      console.error("[Base Opportunity Agent] Unable to release RWA market lock.", error);
    }
  }
}

export async function getBaseRwaMarketSnapshot(options: {
  forceRefresh?: boolean;
} = {}): Promise<BaseRwaMarketSnapshot> {
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
    return {
      ...cached,
      cachedAt: cached.checkedAt,
      cacheState: "fresh",
    };
  }

  try {
    return await syncBaseRwaMarketSnapshot();
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        cachedAt: cached.checkedAt,
        cacheState: "stale_fallback",
        refreshError: error instanceof Error ? error.message : "Unknown RWA provider error.",
      };
    }

    throw error;
  }
}
