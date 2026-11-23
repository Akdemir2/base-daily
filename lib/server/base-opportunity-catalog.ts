import { buildBaseBuilderMap } from "@/lib/server/base-builder-map";
import { buildBaseRwaContractRegistry } from "@/lib/server/base-rwa-contract-registry";

export type BaseOpportunityCategory =
  | "rwa-tokenized-equities"
  | "rwa-treasuries"
  | "rwa-private-credit"
  | "rwa-commodities"
  | "rwa-real-estate"
  | "rwa-defi-liquidity"
  | "rwa-infrastructure"
  | "agentic-payments"
  | "identity-and-miniapps"
  | "builder-attribution"
  | "ecosystem-discovery";

export type OpportunityStatus =
  | "research"
  | "monitor"
  | "needs_due_diligence"
  | "actionable";

export type EvidenceClass =
  | "official_base"
  | "official_issuer_or_protocol"
  | "third_party_analytics";

export type RwaRiskCheck = {
  field:
    | "issuer_and_legal_structure"
    | "custody_and_asset_backing"
    | "holder_rights_and_redemption"
    | "jurisdiction_and_eligibility"
    | "contract_and_admin_controls"
    | "audit_and_attestations"
    | "oracle_and_nav"
    | "liquidity_and_exit"
    | "fees_and_yield_source"
    | "bridge_and_counterparty_risk";
  whyItMatters: string;
  status: "not_checked" | "partially_checked" | "verified";
};

export type OpportunityScore = {
  score: number | null;
  label: "research_priority" | "not_scored";
  dimensions: {
    BaseFit: number | null;
    evidenceQuality: number | null;
    userUtility: number | null;
    actionability: number | null;
    costEfficiency: number | null;
  };
  methodology: string;
};

export type BaseOpportunity = {
  id: string;
  title: string;
  category: BaseOpportunityCategory;
  status: OpportunityStatus;
  publisher: string;
  evidenceClass: EvidenceClass;
  summary: string;
  whyItMatters: string;
  recommendedNextStep: string;
  sourceUrl: string;
  publishedAt: string | null;
  reviewedAt: string;
  score: OpportunityScore;
  riskChecks: RwaRiskCheck[];
  caveats: string[];
};

export type RwaMarketLead = {
  name: string;
  assetClass: string;
  reportedValueOnBaseUsd: number | null;
  reportedChange7dPercent: number | null;
  reportedChange30dPercent: number | null;
  issuer: string | null;
  status: "discovery_only";
};

const REVIEWED_AT = "2026-11-23";
const SCORE_METHOD =
  "Research priority, not investment advice and not an airdrop probability. " +
  "Weighted score: Base fit 30%, evidence quality 25%, user utility 20%, " +
  "actionability 15%, cost efficiency 10%. Each dimension is rated 1-5; " +
  "missing or unverified evidence is not silently treated as a positive score.";

const FULL_RWA_CHECKLIST: RwaRiskCheck[] = [
  {
    field: "issuer_and_legal_structure",
    whyItMatters: "Identify the legal issuer, SPV/fund, governing law, insolvency treatment, and the exact claim the token holder owns.",
    status: "not_checked",
  },
  {
    field: "custody_and_asset_backing",
    whyItMatters: "Confirm the named custodian, segregation of assets, independent attestations, and reconciliation frequency.",
    status: "not_checked",
  },
  {
    field: "holder_rights_and_redemption",
    whyItMatters: "Verify who can redeem, minimum size, notice period, fees, settlement asset, gates, and suspension rights.",
    status: "not_checked",
  },
  {
    field: "jurisdiction_and_eligibility",
    whyItMatters: "Check KYC/AML, accredited-investor or professional-client restrictions, sanctioned jurisdictions, and transfer allowlists.",
    status: "not_checked",
  },
  {
    field: "contract_and_admin_controls",
    whyItMatters: "Review verified contract source, proxy/upgrades, pause/freeze/blacklist powers, multisig and timelock controls.",
    status: "not_checked",
  },
  {
    field: "audit_and_attestations",
    whyItMatters: "Find independent smart-contract audits, proof-of-reserves/asset attestations, scope, date, and unresolved findings.",
    status: "not_checked",
  },
  {
    field: "oracle_and_nav",
    whyItMatters: "Understand NAV/price source, update cadence, stale-price protections, oracle dependencies, and market-hours mismatch.",
    status: "not_checked",
  },
  {
    field: "liquidity_and_exit",
    whyItMatters: "Measure executable Base liquidity, spread, depth, holder concentration, redemption route, and stressed exit capacity.",
    status: "not_checked",
  },
  {
    field: "fees_and_yield_source",
    whyItMatters: "Separate gross yield from net yield; identify management, performance, protocol, redemption, and transaction fees and the real source of returns.",
    status: "not_checked",
  },
  {
    field: "bridge_and_counterparty_risk",
    whyItMatters: "Check whether the token is native to Base or bridged, plus bridge, issuer, administrator, custodian, and servicing concentration.",
    status: "not_checked",
  },
];

function makeScore(
  dimensions: OpportunityScore["dimensions"],
): OpportunityScore {
  const values = Object.values(dimensions);
  if (values.some((value) => value === null)) {
    return {
      score: null,
      label: "not_scored",
      dimensions,
      methodology: SCORE_METHOD,
    };
  }

  const score =
    ((dimensions.BaseFit as number) * 30 +
      (dimensions.evidenceQuality as number) * 25 +
      (dimensions.userUtility as number) * 20 +
      (dimensions.actionability as number) * 15 +
      (dimensions.costEfficiency as number) * 10) /
    5;

  return {
    score: Math.round(score),
    label: "research_priority",
    dimensions,
    methodology: SCORE_METHOD,
  };
}

function baseOpportunity(
  input: Omit<BaseOpportunity, "reviewedAt">,
): BaseOpportunity {
  return { ...input, reviewedAt: REVIEWED_AT };
}

export const BASE_ECOSYSTEM_SOURCES = [
  {
    id: "base-trading",
    name: "Base Trading — asset issuers and DeFi",
    publisher: "Base",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/trading",
    purpose: "Official Base directory of trading infrastructure and asset issuers, including Centrifuge.",
  },
  {
    id: "base-tokenized-stocks",
    name: "Stocks just got updated",
    publisher: "Base",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/blog/tokenized-stocks",
    purpose: "Official announcement about native Base tokenized stocks, the B20 standard, custody, and DeFi composability.",
  },
  {
    id: "base-b20-spec",
    name: "B20: The Standard Behind Tokenized Stocks on Base",
    publisher: "Base Engineering Team",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/blog/b20-tokenized-stocks-on-base",
    purpose: "Verify B20 token multipliers, transfer policies, freeze/pause controls, and AP-only mint/redeem restrictions for tokenized stocks.",
  },
  {
    id: "base-centrifuge-case",
    name: "How Centrifuge brought the S&P 500 onchain",
    publisher: "Base",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/customers/centrifuge",
    purpose: "Research Centrifuge's Base-native S&P 500 exposure, deSPXA integrations, eligibility limits, and Morpho collateral use case.",
  },
  {
    id: "base-stocksmaxxing",
    name: "Stocks Maxxing Season",
    publisher: "Base",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/stocksmaxxing",
    purpose: "Track the time-bound tokenized-stock builder program, its tracks, deadline, partner prizes, and official rules.",
  },
  {
    id: "base-ecosystem",
    name: "Base Ecosystem Directory",
    publisher: "Base",
    evidenceClass: "official_base" as const,
    url: "https://www.base.org/ecosystem",
    purpose: "Discover Base products and categories. Directory inclusion is discovery evidence, not a security or quality endorsement.",
  },
  {
    id: "rwa-tracker-base",
    name: "RWA Tracker — Base",
    publisher: "RWA Tracker",
    evidenceClass: "third_party_analytics" as const,
    url: "https://www.rwatracker.app/chains/base/",
    purpose: "Third-party discovery and market-size snapshot for identified tokenized RWA products on Base.",
  },
  {
    id: "rwa-foundation-base-builders",
    name: "Who Builds on Base — RWA Foundation",
    publisher: "RWA Foundation",
    evidenceClass: "third_party_analytics" as const,
    url: "https://www.rwaf.xyz/research/live/who-builds-on-base-the-companies-behind-coinbase-s-rwa-chain-2124877138004263087/",
    purpose: "Dated 23 Nov 2026 research map of Base RWA issuers, payment rails, DeFi utility, oracles, bridges, custody, compliance and developer infrastructure.",
  },
  {
    id: "defillama-rwa",
    name: "DefiLlama RWA Dashboard",
    publisher: "DefiLlama",
    evidenceClass: "third_party_analytics" as const,
    url: "https://defillama.com/rwa",
    purpose: "Cross-check chain-level RWA AUM, DeFi active TVL, lending, and liquidity trends.",
  },
];

export const BASE_RWA_MARKET_SNAPSHOT = {
  asOf: "2026-11-23",
  source: "RWA Tracker",
  sourceUrl: "https://www.rwatracker.app/chains/base/",
  reportedProducts: 18,
  reportedAssetClasses: 11,
  reportedKnownValueUsd: 28_100_000,
  reportedChainRankByKnownValue: 11,
  reportedShareOfAllRwasPercent: 0.1,
  reportedIssuers: ["Centrifuge", "Franklin Templeton"],
  reportedLargestLeads: [
    "Ember",
    "Brickken BKN",
    "Anemoy Capital",
    "Re RE",
    "RealtyX",
    "8lends",
  ],
  note:
    "Third-party discovery snapshot only. Coverage, issuer attribution, valuations, and product classifications may be incomplete. Not independently reconciled against issuers or onchain contracts.",
};

export const BASE_RWA_LEADS: RwaMarketLead[] = [
  { name: "Ember", assetClass: "Strategies", reportedValueOnBaseUsd: 13_000_000, reportedChange7dPercent: -4.3, reportedChange30dPercent: -11.8, issuer: null, status: "discovery_only" },
  { name: "Brickken BKN", assetClass: "Commodities", reportedValueOnBaseUsd: 5_100_000, reportedChange7dPercent: -0.1, reportedChange30dPercent: 0.2, issuer: null, status: "discovery_only" },
  { name: "Anemoy Capital", assetClass: "Treasuries", reportedValueOnBaseUsd: 4_620_000, reportedChange7dPercent: 9.4, reportedChange30dPercent: -90.7, issuer: "Centrifuge", status: "discovery_only" },
  { name: "Re RE", assetClass: "Bonds", reportedValueOnBaseUsd: 4_340_000, reportedChange7dPercent: -6.5, reportedChange30dPercent: -3.6, issuer: null, status: "discovery_only" },
  { name: "RealtyX", assetClass: "Real estate", reportedValueOnBaseUsd: 550_000, reportedChange7dPercent: 0, reportedChange30dPercent: 0.8, issuer: null, status: "discovery_only" },
  { name: "8lends 8LNDS", assetClass: "Private credit", reportedValueOnBaseUsd: 438_000, reportedChange7dPercent: -13.6, reportedChange30dPercent: -25.9, issuer: null, status: "discovery_only" },
  { name: "LiveArt ART", assetClass: "Collectibles", reportedValueOnBaseUsd: 36_100, reportedChange7dPercent: 0, reportedChange30dPercent: 0, issuer: null, status: "discovery_only" },
  { name: "Unblock Equity", assetClass: "Real estate", reportedValueOnBaseUsd: 23_900, reportedChange7dPercent: 0.3, reportedChange30dPercent: 1.1, issuer: null, status: "discovery_only" },
  { name: "Mountain Protocol", assetClass: "Treasuries", reportedValueOnBaseUsd: 4_270, reportedChange7dPercent: 0.2, reportedChange30dPercent: null, issuer: null, status: "discovery_only" },
  { name: "Tokeshare", assetClass: "Commodities", reportedValueOnBaseUsd: 2_130, reportedChange7dPercent: -6.6, reportedChange30dPercent: -17.3, issuer: null, status: "discovery_only" },
  { name: "Subunit", assetClass: "Real estate", reportedValueOnBaseUsd: 435, reportedChange7dPercent: 0.2, reportedChange30dPercent: 0.2, issuer: null, status: "discovery_only" },
  { name: "Sweep", assetClass: "Money market funds", reportedValueOnBaseUsd: 143, reportedChange7dPercent: 0.1, reportedChange30dPercent: 0.1, issuer: null, status: "discovery_only" },
  { name: "BasaFish", assetClass: "Bonds", reportedValueOnBaseUsd: 100, reportedChange7dPercent: 1.0, reportedChange30dPercent: 1.0, issuer: null, status: "discovery_only" },
  { name: "Travessia Credit", assetClass: "Private credit", reportedValueOnBaseUsd: 58, reportedChange7dPercent: 0.2, reportedChange30dPercent: 59.6, issuer: null, status: "discovery_only" },
  { name: "Boson Protocol BOSON", assetClass: "Collectibles", reportedValueOnBaseUsd: 22, reportedChange7dPercent: -0.2, reportedChange30dPercent: -0.4, issuer: null, status: "discovery_only" },
  { name: "Florence Finance", assetClass: "Private credit", reportedValueOnBaseUsd: null, reportedChange7dPercent: null, reportedChange30dPercent: null, issuer: null, status: "discovery_only" },
  { name: "ALTA Finance", assetClass: "Private credit", reportedValueOnBaseUsd: null, reportedChange7dPercent: null, reportedChange30dPercent: null, issuer: null, status: "discovery_only" },
  { name: "Franklin Templeton BENJI", assetClass: "Money market funds", reportedValueOnBaseUsd: null, reportedChange7dPercent: null, reportedChange30dPercent: null, issuer: "Franklin Templeton", status: "discovery_only" },
];

export const BASE_OPPORTUNITIES: BaseOpportunity[] = [
  baseOpportunity({
    id: "base-native-tokenized-stocks",
    title: "Base-native tokenized stocks (B20)",
    category: "rwa-tokenized-equities",
    status: "research",
    publisher: "Base",
    evidenceClass: "official_base",
    summary:
      "Base announced that Coinbase-issued tokenized stocks built on the B20 standard were live natively on Base. Base's launch post describes shares held 1:1 by a regulated custodian and use across Base DeFi. The B20 technical post explains multiplier-based corporate actions, transfer policies, freeze/pause controls, and that minting/redemption against underlying shares is restricted to KYC-onboarded Authorized Participants.",
    whyItMatters:
      "This creates a meaningful RWA research lane around issuer terms, token-holder rights, eligible users, secondary liquidity, and whether specific assets can be used as DeFi collateral.",
    recommendedNextStep:
      "Build a token-by-token register from the official stock list and B20 documentation: verified contract address, reference share, multiplier(), custody, holder rights, jurisdiction, transfer policy, trading hours, AP redemption, and DeFi integrations. Confirm eligibility for each asset and user jurisdiction; do not infer access from being able to connect a wallet.",
    sourceUrl: "https://www.base.org/blog/tokenized-stocks",
    publishedAt: "2026-08-24",
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 5,
      userUtility: 5,
      actionability: 4,
      costEfficiency: 4,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "This is an ecosystem research lead, not a recommendation to buy tokenized securities.",
      "Base says the assets are only available to persons in eligible jurisdictions outside the United States; the user must verify current country eligibility with the issuer.",
      "The B20 standard supports transfer policies and freeze/pause controls; issuer/admin permissions and legal recourse must be checked contract by contract.",
      "Minting and redemption against underlying shares are restricted to KYC-onboarded Authorized Participants, so ordinary holders may rely on secondary markets.",
      "The Base announcement is not a substitute for the issuer's current prospectus, terms, eligibility rules, or legal disclosures.",
    ],
  }),
  baseOpportunity({
    id: "centrifuge-base-rwa",
    title: "Centrifuge — tokenized private-credit and Treasury pools",
    category: "rwa-private-credit",
    status: "research",
    publisher: "Centrifuge / Base",
    evidenceClass: "official_base",
    summary:
      "Base's official Trading page identifies Centrifuge as an institutional RWA issuer bringing tokenized private-credit and Treasury pools to Base.",
    whyItMatters:
      "This is a direct Base-native route into institutional RWA issuance and pool-level research. Individual pools can differ substantially in collateral, borrower concentration, duration, seniority, liquidity, and investor eligibility.",
    recommendedNextStep:
      "Review every Base-available pool individually. Capture the legal vehicle, underlying loans or Treasury exposure, servicing, waterfall, loss history, pool term, redemption mechanics, minimum investment, and token contract.",
    sourceUrl: "https://www.base.org/trading",
    publishedAt: null,
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 5,
      userUtility: 5,
      actionability: 4,
      costEfficiency: 3,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "Base's directory confirms ecosystem positioning, not the quality or safety of a specific pool.",
      "Private-credit yield compensates for borrower, servicing, liquidity, and legal-enforcement risks; it is not equivalent to a Treasury yield.",
      "Investor eligibility and redemption terms may prevent open access.",
    ],
  }),
  baseOpportunity({
    id: "base-rwa-market-map",
    title: "Base RWA market map — 18 products reported",
    category: "rwa-infrastructure",
    status: "needs_due_diligence",
    publisher: "RWA Tracker",
    evidenceClass: "third_party_analytics",
    summary:
      "RWA Tracker's Base page reported 18 tokenized RWA products and approximately $28.1 million of identified value on Base as of 23 November 2026. It listed Ember, Brickken BKN, Anemoy Capital, Re RE, RealtyX, and 8lends among the largest leads.",
    whyItMatters:
      "This provides a starting universe for issuer-by-issuer research across strategies, commodities, Treasuries, bonds, real estate, and private credit.",
    recommendedNextStep:
      "Resolve each product to the issuer's official site and the Base contract address, then verify token supply, holders, pool TVL, executable liquidity, legal documents, and redemption. Remove duplicate or misclassified products before ranking.",
    sourceUrl: "https://www.rwatracker.app/chains/base/",
    publishedAt: null,
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 3,
      userUtility: 4,
      actionability: 4,
      costEfficiency: 5,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "Figures are third-party aggregator data, not independently confirmed AUM.",
      "Reported market value is not the same as available liquidity or redeemable value.",
      "The snapshot does not establish issuer solvency, asset backing, holder rights, or investor eligibility.",
    ],
  }),
  baseOpportunity({
    id: "centrifuge-despxa-sp500",
    title: "Centrifuge deSPXA — tokenized S&P 500 exposure and DeFi collateral",
    category: "rwa-tokenized-equities",
    status: "needs_due_diligence",
    publisher: "Centrifuge / Base",
    evidenceClass: "official_base",
    summary:
      "Base's Centrifuge customer story describes SPXA as a licensed S&P 500 index-fund token and deSPXA as an onchain product available to eligible non-US investors. It reports trading integrations with Uniswap and Aerodrome on Base and a Morpho route to borrow USDC against deSPXA, subject to eligibility.",
    whyItMatters:
      "This is a concrete Base RWA use case connecting a regulated offchain index exposure with onchain trading and secured borrowing. It is a higher-priority research lead than a token with no clear use or liquidity route.",
    recommendedNextStep:
      "Verify the current deSPXA contract, legal fund documents, issuer/custodian, country eligibility, oracle/NAV, Morpho market collateral parameters, borrow capacity, liquidation route, pool depth, fees, and all redemption gates before considering any use.",
    sourceUrl: "https://www.base.org/customers/centrifuge",
    publishedAt: null,
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 5,
      userUtility: 5,
      actionability: 3,
      costEfficiency: 3,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "Base's case study is product information, not an investment recommendation or guarantee of performance.",
      "deSPXA is available only to eligible non-US investors; the precise jurisdiction and KYC conditions must be confirmed with the issuer.",
      "Morpho borrowing is subject to live market parameters and liquidity; do not assume an advertised integration guarantees available borrow capacity.",
      "The Base case study cites platform TVL and Q2 2026 trading volume, not a current Base-only TVL figure.",
    ],
  }),
  baseOpportunity({
    id: "stocks-maxxing-season-2026",
    title: "Stocks Maxxing Season — tokenized-stock builder rewards",
    category: "rwa-tokenized-equities",
    status: "actionable",
    publisher: "Base",
    evidenceClass: "official_base",
    summary:
      "Base lists a builder season running 5 November through 5 December 2026 with $100,000+ in rewards. Tracks include Agentic Stock Finance (agents that research, earn, or trade around tokenized stocks) and Programmable Stock Markets. The page describes building a new product or adding a stock-linked feature to an already-live project.",
    whyItMatters:
      "This is a time-limited builder opportunity that directly intersects with the proposed Base Opportunity Agent. A carefully scoped tokenized-stock research and risk agent could be a relevant project direction, subject to the official rules.",
    recommendedNextStep:
      "Read the official rules and partner track terms immediately. Assess whether the agent can ship a meaningful tokenized-stock research feature before the 5 December submission deadline. Do not assume eligibility or reward qualification.",
    sourceUrl: "https://www.base.org/stocksmaxxing",
    publishedAt: null,
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 5,
      userUtility: 4,
      actionability: 4,
      costEfficiency: 4,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "This is a builder competition/rewards program, not a consumer airdrop and not a guaranteed payment.",
      "Base's page says partner incentives are administered under separate partner terms; details and availability vary.",
      "The project must satisfy the official rules, eligibility and submission requirements by the stated deadline.",
    ],
  }),
  baseOpportunity({
    id: "rwa-defi-collateral-map",
    title: "RWA collateral and lending integrations on Base",
    category: "rwa-defi-liquidity",
    status: "monitor",
    publisher: "Base / DeFi protocol documentation",
    evidenceClass: "official_base",
    summary:
      "Base describes tokenized assets as composable with DeFi, while its Trading page identifies lending and liquidity infrastructure such as Morpho and Aerodrome alongside RWA issuers.",
    whyItMatters:
      "If a specific RWA token is accepted as collateral or has a robust secondary market, users may gain lending or liquidity utility. This is also where oracle, liquidation, and liquidity-mismatch risks become especially important.",
    recommendedNextStep:
      "Maintain a token-to-market map: collateral status, LTV, liquidation threshold, oracle, caps, borrow utilization, pool depth, withdrawal queue, and asset eligibility. Only mark an integration as live after verifying the protocol's own market page and contract.",
    sourceUrl: "https://www.base.org/trading",
    publishedAt: null,
    score: makeScore({
      BaseFit: 5,
      evidenceQuality: 3,
      userUtility: 5,
      actionability: 3,
      costEfficiency: 3,
    }),
    riskChecks: FULL_RWA_CHECKLIST,
    caveats: [
      "A protocol being present on Base does not mean every RWA asset is supported as collateral.",
      "Lending APY, utilization, collateral parameters, and pool depth change over time and must be re-read before acting.",
    ],
  }),
];

export function buildBaseOpportunityReport() {
  return {
    builderMap: buildBaseBuilderMap(),
    contractRegistry: buildBaseRwaContractRegistry(),
    agent: "base-opportunity-agent",
    version: 2,
    generatedAt: new Date().toISOString(),
    network: "base-mainnet",
    mode: "research-only",
    coverage: {
      rwa: true,
      categories: [
        "tokenized equities",
        "Treasuries and money-market products",
        "private credit",
        "commodities",
        "real estate",
        "RWA-backed lending and liquidity",
        "RWA infrastructure and issuers",
      ],
      sourceMode: "curated source registry and dated discovery snapshot",
      automatedLiveCrawling: false,
    },
    scoring: SCORE_METHOD,
    sources: BASE_ECOSYSTEM_SOURCES,
    rwaMarketSnapshot: BASE_RWA_MARKET_SNAPSHOT,
    rwaLeads: BASE_RWA_LEADS,
    opportunities: BASE_OPPORTUNITIES,
    globalCaveats: [
      "Research priority is not expected return, an investment recommendation, or an airdrop probability.",
      "No opportunity is a confirmed Base airdrop criterion unless Base publishes explicit eligibility rules.",
      "RWA tokenization does not remove issuer, custodian, legal, servicing, oracle, smart-contract, liquidity, or counterparty risk.",
      "RWA market values and 7D/30D changes are a third-party snapshot dated 23 November 2026. They are not live quotes, independent AUM attestations, or measures of executable liquidity.",
      "The curated research catalogue does not yet resolve every builder or RWA lead to verified contracts, live balances, yield, executable liquidity, country eligibility, or redemption status. Separate liveData feeds cover only the RWA Pipe provider snapshot and the Coinbase tokenized-stock API/Base supply checks; they do not replace issuer-level due diligence.",
      "Stocks Maxxing Season is listed as a time-sensitive builder program and must be checked against the current official rules before action.",
    ],
  };
}
