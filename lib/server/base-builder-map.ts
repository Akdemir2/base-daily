export type BaseBuilderGroupId =
  | "asset-issuers"
  | "payments-and-stablecoins"
  | "lending-and-trading"
  | "oracles-and-market-data"
  | "bridges-and-messaging"
  | "custody-wallets-and-compliance"
  | "distribution-and-nfts"
  | "developer-and-data-infrastructure";

export type BaseBuilderEntry = {
  id: string;
  name: string;
  group: BaseBuilderGroupId;
  role: string;
  products: string[];
  relationships: string[];
  evidenceNotes: string[];
  rwaRelevance: "direct-issuer" | "asset-utility" | "payments" | "infrastructure" | "adjacent";
};

export const BASE_BUILDER_MAP_SOURCE = {
  title: "Who Builds on Base, the Companies Behind Coinbase's RWA Chain",
  publisher: "RWA Foundation",
  sourceUrl:
    "https://www.rwaf.xyz/research/live/who-builds-on-base-the-companies-behind-coinbase-s-rwa-chain-2124877138004263087/",
  reviewedAt: "2026-11-23",
  dataAsOf: "2026-11-23",
  evidenceClass: "third_party_research" as const,
  scope:
    "Base mainnet only. The report combines issuer disclosures, Base documentation and third-party analytics; company inclusion is ecosystem evidence, not an endorsement.",
};

export const BASE_BUILDER_GROUPS = [
  {
    id: "asset-issuers",
    title: "RWA Issuers and Asset Platforms",
    description:
      "Companies and platforms issuing or managing tokenized funds, equities, credit, bonds, commodities, real estate, insurance-linked assets, or carbon assets.",
  },
  {
    id: "payments-and-stablecoins",
    title: "Payments, Stablecoins, and Institutional Money",
    description:
      "Payment acceptance, fiat conversion, recurring transfers, stablecoins, local-currency tokens, and institutional deposit tokens. These balances are not included in distributed RWA totals.",
  },
  {
    id: "lending-and-trading",
    title: "Lending, Trading, and Asset Utility",
    description:
      "Markets and applications that trade Base assets, accept them as collateral, manage vaults, or route positions. Protocol TVL is not additional RWA AUM.",
  },
  {
    id: "oracles-and-market-data",
    title: "Oracles and Market Data",
    description:
      "Price feeds and data services. An oracle price alone does not prove asset reserves, legal ownership, or issuer solvency.",
  },
  {
    id: "bridges-and-messaging",
    title: "Bridges and Cross-Chain Messaging",
    description:
      "Token transfer and cross-chain messaging infrastructure. A bridged representation is not a new underlying asset.",
  },
  {
    id: "custody-wallets-and-compliance",
    title: "Custody, Wallets, Identity, and Compliance",
    description:
      "Institutional custody, wallet infrastructure, smart accounts, transaction screening, and onchain monitoring.",
  },
  {
    id: "distribution-and-nfts",
    title: "Distribution, Marketplaces, and NFT Tooling",
    description:
      "Digital-asset distribution and checkout infrastructure. NFT and digital-art volume is excluded from the report’s RWA figures.",
  },
  {
    id: "developer-and-data-infrastructure",
    title: "Developer, RPC, and Data Infrastructure",
    description:
      "RPC, developer tooling, indexing, and block explorers used to build and verify Base applications.",
  },
] as const;

export const BASE_BUILDERS: BaseBuilderEntry[] = [
  // RWA issuance and platforms
  { id: "townsquare", name: "TownSquare", group: "asset-issuers", role: "RWA platform and token issuer", products: ["townREIT real-estate token", "townAIROBO AI/robotics credit token", "townBATT battery/energy token"], relationships: [], evidenceNotes: ["RWA.xyz value reported at $304.6m across four Base assets on 23 Nov 2026; townREIT was reported at $193.9m."], rwaRelevance: "direct-issuer" },
  { id: "midas", name: "Midas", group: "asset-issuers", role: "Tokenized investment-product issuer", products: ["mGLO / Fasanara Global Open fund"], relationships: [], evidenceNotes: ["RWA.xyz value reported at $103.6m across two Base assets."], rwaRelevance: "direct-issuer" },
  { id: "groma", name: "Groma", group: "asset-issuers", role: "Real-estate token issuer", products: ["GromaCoin"], relationships: [], evidenceNotes: ["RWA.xyz value reported at $100.2m on Base; managed by Groma Advisor."], rwaRelevance: "direct-issuer" },
  { id: "coinbase", name: "Coinbase", group: "asset-issuers", role: "Tokenized-stock issuer and Base ecosystem operator", products: ["Coinbase tokenized stocks", "Base", "Commerce Payments Protocol"], relationships: ["aave", "bitwise", "glider", "shopify", "1inch"], evidenceNotes: ["RWA.xyz reported $48.1m across 393 Coinbase Global assets on Base; the report says +33.44% over 30 days.", "Base's stock page describes 1:1 backing by shares held in regulated, bankruptcy-remote custody and jurisdiction restrictions."], rwaRelevance: "direct-issuer" },
  { id: "dinari", name: "Dinari", group: "asset-issuers", role: "Tokenized US-equity issuer", products: ["dShares"], relationships: [], evidenceNotes: ["Its documentation lists dShares on Base mainnet."], rwaRelevance: "direct-issuer" },
  { id: "centrifuge", name: "Centrifuge", group: "asset-issuers", role: "Tokenized fund, private-credit and Treasury infrastructure", products: ["SPXA / deSPXA", "JAAA", "other tokenized pools"], relationships: ["janus-henderson", "sp-dow-jones-indices", "uniswap", "aerodrome", "morpho", "steakhouse", "clearstar"], evidenceNotes: ["RWA.xyz reported $31.5m across seven Centrifuge assets on Base.", "The article identifies deSPXA as a transferable onchain version for eligible investors and describes trading and Morpho collateral integrations."], rwaRelevance: "direct-issuer" },
  { id: "janus-henderson", name: "Janus Henderson", group: "asset-issuers", role: "Licensed S&P 500 index-fund partner", products: ["SPXA"], relationships: ["centrifuge"], evidenceNotes: ["Named as a partner for the SPXA licensed index-fund token."], rwaRelevance: "direct-issuer" },
  { id: "sp-dow-jones-indices", name: "S&P Dow Jones Indices", group: "asset-issuers", role: "Index licensing partner", products: ["S&P 500 index reference for SPXA"], relationships: ["centrifuge"], evidenceNotes: ["Named as an index partner for the Centrifuge/Janus Henderson SPXA product."], rwaRelevance: "direct-issuer" },
  { id: "maple-finance", name: "Maple Finance", group: "asset-issuers", role: "Yield-bearing dollar and institutional credit platform", products: ["syrupUSDC"], relationships: ["chainlink"], evidenceNotes: ["The article says syrupUSDC is bridged between Ethereum and Base using Chainlink CCIP and has a price feed."], rwaRelevance: "direct-issuer" },
  { id: "etherfuse", name: "Etherfuse", group: "asset-issuers", role: "Tokenized sovereign-debt issuer", products: ["Stablebonds", "Mexican government debt", "US Treasuries"], relationships: [], evidenceNotes: ["Publishes Base addresses for Stablebonds."], rwaRelevance: "direct-issuer" },
  { id: "franklin-templeton", name: "Franklin Templeton", group: "asset-issuers", role: "Institutional tokenized-fund issuer", products: ["Benji / BENJI"], relationships: [], evidenceNotes: ["Benji has been offered on Base to institutions since October 2024; RWA.xyz reported $27.7m in BENJI there."], rwaRelevance: "direct-issuer" },
  { id: "wisdomtree", name: "WisdomTree", group: "asset-issuers", role: "Tokenized-fund issuer", products: ["WisdomTree Connect funds"], relationships: [], evidenceNotes: ["The report says Base was added to Connect funds on 3 April 2025; eligibility and share-class rules still apply."], rwaRelevance: "direct-issuer" },
  { id: "spiko", name: "Spiko", group: "asset-issuers", role: "Tokenized cash-management fund issuer", products: ["Tokenized cash-management funds"], relationships: [], evidenceNotes: ["RWA.xyz reported $39.9m across nine Spiko assets on Base."], rwaRelevance: "direct-issuer" },
  { id: "re", name: "Re", group: "asset-issuers", role: "Reinsurance-linked token issuer", products: ["reUSD"], relationships: [], evidenceNotes: ["The report says reUSD went live on Base on 17 June 2026 and takes USDC deposits; it is not an insurance policy."], rwaRelevance: "direct-issuer" },
  { id: "syntetika", name: "Syntetika", group: "asset-issuers", role: "Managed investment-strategy infrastructure", products: ["cbBTC-funded strategies"], relationships: [], evidenceNotes: ["The article says Syntetika launched on Base on 10 August 2026; the described deposit asset is cbBTC, so this is not itself proof of a tokenized offchain asset."], rwaRelevance: "asset-utility" },
  { id: "streamex", name: "Streamex", group: "asset-issuers", role: "Gold-backed token issuer", products: ["GLDY"], relationships: [], evidenceNotes: ["The article describes GLDY as a gold-backed security with income from gold leasing; Token Terminal reported $13.2m on Base."], rwaRelevance: "direct-issuer" },
  { id: "dgld", name: "DGLD", group: "asset-issuers", role: "Allocated-gold token project", products: ["DGLD gold token"], relationships: [], evidenceNotes: ["The report flags a February 2026 exploit and a replacement Base gold contract in June 2026; old contract references must not be reused."], rwaRelevance: "direct-issuer" },
  { id: "anzen", name: "Anzen", group: "asset-issuers", role: "Dollar-token issuer", products: ["USDz", "sUSDz"], relationships: ["spark"], evidenceNotes: ["DefiLlama was cited at $5.84m for USDz on Base; verify the underlying collateral and yield terms."], rwaRelevance: "direct-issuer" },
  { id: "spark", name: "Spark", group: "asset-issuers", role: "Stablecoin and savings-token issuer", products: ["USDS", "sUSDS", "sUSDC"], relationships: ["morpho"], evidenceNotes: ["The article distinguishes savings tokens from base stablecoins and cites $11.1m Spark TVL on Base from Token Terminal."], rwaRelevance: "direct-issuer" },
  { id: "toucan", name: "Toucan Protocol", group: "asset-issuers", role: "Carbon-credit token infrastructure", products: ["CHAR biochar carbon-credit pool"], relationships: [], evidenceNotes: ["The article distinguishes the pool token from underlying project credits and links CHAR to carbon removal."], rwaRelevance: "direct-issuer" },
  { id: "backed", name: "Backed", group: "asset-issuers", role: "Tokenized-security issuer", products: ["bIB01"], relationships: [], evidenceNotes: ["The article says Backed is winding down its bTokens by the end of 2026 as it moves to xStocks; treat this as a time-sensitive transition."], rwaRelevance: "direct-issuer" },
  { id: "kaio", name: "KAIO", group: "asset-issuers", role: "Tokenized-fund platform", products: ["Two reported Base assets"], relationships: [], evidenceNotes: ["RWA.xyz reported $30.7m across two KAIO assets on Base."], rwaRelevance: "direct-issuer" },
  { id: "drvn", name: "DRVN Labs", group: "asset-issuers", role: "Fractional rare-car asset application", products: ["BSTR", "DRVN/VHCLS"], relationships: [], evidenceNotes: ["The report describes an app for fractional shares of rare cars; verify legal ownership and redemption before classifying its tokens as direct RWA claims."], rwaRelevance: "direct-issuer" },

  // Payments and stablecoins
  { id: "shopify", name: "Shopify", group: "payments-and-stablecoins", role: "Merchant payments distribution", products: ["Commerce Payments Protocol"], relationships: ["coinbase"], evidenceNotes: ["The report attributes 448,000+ payments and about $42.1m net settled volume to the whole protocol, not to Shopify sales alone."], rwaRelevance: "payments" },
  { id: "stripe", name: "Stripe", group: "payments-and-stablecoins", role: "Machine-payment and USDC rails", products: ["x402 USDC machine payments on Base"], relationships: [], evidenceNotes: ["Availability depends on product and country."], rwaRelevance: "payments" },
  { id: "stablecoin", name: "Stablecoin", group: "payments-and-stablecoins", role: "Fiat-to-stablecoin conversion", products: ["Base USDC and USDB conversion"], relationships: [], evidenceNotes: ["Listed as a payment acceptance and conversion provider."], rwaRelevance: "payments" },
  { id: "tuyo", name: "Tuyo", group: "payments-and-stablecoins", role: "Card and account fintech", products: ["USDC-linked spending card"], relationships: [], evidenceNotes: ["The Base case study describes card/account services; strategy balances are held outside insured deposits."], rwaRelevance: "payments" },
  { id: "superfluid", name: "Superfluid", group: "payments-and-stablecoins", role: "Streaming payments and payroll", products: ["Money streaming on Base"], relationships: ["sablier"], evidenceNotes: ["Launched Base mainnet support in August 2023."], rwaRelevance: "payments" },
  { id: "sablier", name: "Sablier", group: "payments-and-stablecoins", role: "Token streaming and distribution", products: ["Base mainnet token streams"], relationships: [], evidenceNotes: ["Lists Base as a supported mainnet."], rwaRelevance: "payments" },
  { id: "transak", name: "Transak", group: "payments-and-stablecoins", role: "Fiat on-ramp", products: ["ETH and USDC on-ramp to Base"], relationships: ["ramp"], evidenceNotes: ["On-ramp funding does not override fund subscription checks or asset eligibility."], rwaRelevance: "payments" },
  { id: "ramp", name: "Ramp Network", group: "payments-and-stablecoins", role: "Fiat on-ramp", products: ["ETH and USDC on-ramp to Base"], relationships: [], evidenceNotes: ["On-ramp availability and fund eligibility remain separate."], rwaRelevance: "payments" },
  { id: "circle", name: "Circle", group: "payments-and-stablecoins", role: "Native stablecoin issuer", products: ["USDC", "EURC"], relationships: [], evidenceNotes: ["Native Base contracts are distinct from older bridged USDC and interest-bearing vault shares; stablecoins are not included in distributed RWA AUM."], rwaRelevance: "payments" },
  { id: "jpmorgan", name: "JPMorgan", group: "payments-and-stablecoins", role: "Institutional deposit-token issuer", products: ["JPM Coin / JPMD"], relationships: ["b2c2", "coinbase", "mastercard"], evidenceNotes: ["JPMD was reported available to institutional clients on Base from 12 November 2025; it is a bank-issued USD deposit token, not a stablecoin."], rwaRelevance: "payments" },
  { id: "b2c2", name: "B2C2", group: "payments-and-stablecoins", role: "Institutional digital-asset market participant", products: ["JPMD test transactions"], relationships: ["jpmorgan", "coinbase", "mastercard"], evidenceNotes: ["Named as a participant in test transactions involving JPM Coin on Base."], rwaRelevance: "payments" },
  { id: "mastercard", name: "Mastercard", group: "payments-and-stablecoins", role: "Payment-network participant", products: ["JPMD test transactions"], relationships: ["jpmorgan", "coinbase", "b2c2"], evidenceNotes: ["Named as a participant in test transactions involving JPM Coin on Base."], rwaRelevance: "payments" },
  { id: "idrx", name: "IDRX", group: "payments-and-stablecoins", role: "Local-currency token issuer", products: ["Indonesian rupiah token"], relationships: [], evidenceNotes: ["The article lists a Base deployment for its rupiah token."], rwaRelevance: "payments" },
  { id: "zarp", name: "ZARP", group: "payments-and-stablecoins", role: "Local-currency token issuer", products: ["South African rand token"], relationships: [], evidenceNotes: ["The article lists a Base issuance and redemption contract for the rand token."], rwaRelevance: "payments" },
  { id: "vnx", name: "VNX", group: "payments-and-stablecoins", role: "Local-currency token issuer", products: ["VCHF", "VGBP"], relationships: [], evidenceNotes: ["The report says VNX publishes Base addresses for Swiss-franc and sterling tokens."], rwaRelevance: "payments" },
  { id: "crown", name: "Crown", group: "payments-and-stablecoins", role: "Local-currency token issuer", products: ["BRLV Brazilian real token"], relationships: [], evidenceNotes: ["Token Terminal was cited at $61.1m for BRLV; do not confuse this payment token figure with distributed RWA AUM."], rwaRelevance: "payments" },
  { id: "open-standard", name: "Open Standard", group: "payments-and-stablecoins", role: "Stablecoin issuer", products: ["OUSD"], relationships: [], evidenceNotes: ["The report cites $93.13m of OUSD on Base, within the separate stablecoin supply category."], rwaRelevance: "payments" },
  { id: "multiplifi", name: "Multiplifi", group: "payments-and-stablecoins", role: "Stablecoin issuer", products: ["rwaUSDi"], relationships: [], evidenceNotes: ["The report lists rwaUSDi at $169.05m on Base in its separate stablecoin-supply section; that balance is not distributed RWA AUM."], rwaRelevance: "payments" },
  { id: "ethena", name: "Ethena", group: "payments-and-stablecoins", role: "Synthetic-dollar protocol and stablecoin issuer", products: ["USDe"], relationships: [], evidenceNotes: ["The report lists USDe at $101.86m on Base in its stablecoin-supply section."], rwaRelevance: "payments" },
  { id: "cygnus-finance", name: "Cygnus Finance", group: "payments-and-stablecoins", role: "Stablecoin issuer", products: ["cgUSD"], relationships: [], evidenceNotes: ["The report lists cgUSD at $75.64m on Base in its stablecoin-supply section."], rwaRelevance: "payments" },
  { id: "metronome", name: "Metronome", group: "payments-and-stablecoins", role: "Stablecoin issuer", products: ["msUSD"], relationships: [], evidenceNotes: ["The report lists msUSD at $12.78m on Base in its stablecoin-supply section."], rwaRelevance: "payments" },

  // Lending, markets and asset utility
  { id: "bitwise", name: "Bitwise", group: "lending-and-trading", role: "Automated token portfolio designer", products: ["Automated Token Portfolios"], relationships: ["coinbase", "glider"], evidenceNotes: ["The article says Bitwise launched the portfolios on 25 August 2026 and does not hold investor assets."], rwaRelevance: "asset-utility" },
  { id: "glider", name: "Glider", group: "lending-and-trading", role: "Self-custodial portfolio execution", products: ["Investor-wallet portfolio execution"], relationships: ["coinbase", "bitwise"], evidenceNotes: ["Executes trades through wallet permissions granted by the user; the portfolio is not a pooled fund."], rwaRelevance: "asset-utility" },
  { id: "one-inch", name: "1inch", group: "lending-and-trading", role: "Trade aggregation and routing", products: ["Coinbase tokenized-stock routing"], relationships: ["coinbase"], evidenceNotes: ["Routing is for supported stocks and eligible users; jurisdiction restrictions still apply."], rwaRelevance: "asset-utility" },
  { id: "aave", name: "Aave", group: "lending-and-trading", role: "Lending market and tokenized-equity collateral", products: ["Equities Hub", "USDC borrowing against Coinbase stock tokens"], relationships: ["coinbase", "ipor"], evidenceNotes: ["The article says Equities Hub opened on Base on 25 September 2026 for eligible investors outside the US; stock price feeds run 24/5 while the market is open 24/7."], rwaRelevance: "asset-utility" },
  { id: "morpho", name: "Morpho", group: "lending-and-trading", role: "Lending markets and collateral vault infrastructure", products: ["USDC loans against deSPXA", "RWA collateral markets"], relationships: ["centrifuge", "steakhouse", "clearstar"], evidenceNotes: ["The article cites $3.505bn Base TVL and $1.795bn active loans; these are protocol metrics, not RWA AUM."], rwaRelevance: "asset-utility" },
  { id: "steakhouse", name: "Steakhouse", group: "lending-and-trading", role: "Morpho vault curator", products: ["deSPXA-backed USDC vaults"], relationships: ["centrifuge", "morpho", "clearstar"], evidenceNotes: ["The article cites $1.218bn curated by Steakhouse; curator TVL overlaps underlying markets."], rwaRelevance: "asset-utility" },
  { id: "clearstar", name: "Clearstar Labs", group: "lending-and-trading", role: "Morpho vault curator", products: ["deSPXA-backed USDC vaults"], relationships: ["centrifuge", "morpho", "steakhouse"], evidenceNotes: ["The article cites $43.89m for Clearstar on Base; this is not an additional pool of underlying RWA."], rwaRelevance: "asset-utility" },
  { id: "uniswap", name: "Uniswap", group: "lending-and-trading", role: "Decentralized exchange", products: ["deSPXA markets", "tokenized-stock and RWA trading"], relationships: ["centrifuge", "aerodrome"], evidenceNotes: ["The report names Uniswap as a trading venue for deSPXA."], rwaRelevance: "asset-utility" },
  { id: "aerodrome", name: "Aerodrome", group: "lending-and-trading", role: "Base decentralized exchange", products: ["deSPXA markets", "GLDY liquidity pools"], relationships: ["centrifuge", "uniswap", "streamex", "klimadao"], evidenceNotes: ["The report names Aerodrome as a deSPXA venue and as the liquidity venue for Klima 2.0 pools."], rwaRelevance: "asset-utility" },
  { id: "moonwell", name: "Moonwell", group: "lending-and-trading", role: "Lending markets", products: ["Base lending markets"], relationships: [], evidenceNotes: ["Publishes a Base lending controller address."], rwaRelevance: "asset-utility" },
  { id: "compound", name: "Compound", group: "lending-and-trading", role: "Lending markets", products: ["Base lending markets"], relationships: ["defisaver"], evidenceNotes: ["The report lists Compound among Base lending markets."], rwaRelevance: "asset-utility" },
  { id: "euler", name: "Euler", group: "lending-and-trading", role: "Lending markets", products: ["Base lending markets"], relationships: [], evidenceNotes: ["DefiLlama tracks Euler Base activity separately."], rwaRelevance: "asset-utility" },
  { id: "defisaver", name: "DeFi Saver", group: "lending-and-trading", role: "DeFi position management", products: ["Compound and Fluid position management"], relationships: ["compound", "fluid"], evidenceNotes: ["The article lists its position-management support on Base."], rwaRelevance: "asset-utility" },
  { id: "fluid", name: "Fluid", group: "lending-and-trading", role: "Lending and liquidity protocol", products: ["Base lending/liquidity markets"], relationships: ["defisaver"], evidenceNotes: ["The report lists Fluid among the markets whose positions can be managed through DeFi Saver."], rwaRelevance: "asset-utility" },
  { id: "gauntlet", name: "Gauntlet", group: "lending-and-trading", role: "Risk management and vault curation", products: ["Curated Base lending exposure"], relationships: ["grove"], evidenceNotes: ["DefiLlama was cited at $705.74m curated by Gauntlet on Base; curator balances can overlap the underlying assets."], rwaRelevance: "asset-utility" },
  { id: "grove", name: "Grove", group: "lending-and-trading", role: "Onchain capital allocator", products: ["Base capital-allocation strategies"], relationships: ["gauntlet"], evidenceNotes: ["The article cites $400.48m held by Grove on Base; not all of it should be treated as direct tokenized RWA issuance."], rwaRelevance: "asset-utility" },
  { id: "pendle", name: "Pendle", group: "lending-and-trading", role: "Yield-trading infrastructure", products: ["Base yield-trading contracts"], relationships: [], evidenceNotes: ["The report lists a Base deployment; yield splitting does not by itself create legal claims on offchain assets."], rwaRelevance: "asset-utility" },
  { id: "reserve", name: "Reserve Protocol", group: "lending-and-trading", role: "Tokenized basket infrastructure", products: ["Token-folio infrastructure"], relationships: [], evidenceNotes: ["The article describes token baskets, not a standalone underlying RWA issuer."], rwaRelevance: "asset-utility" },
  { id: "pancakeswap", name: "PancakeSwap", group: "lending-and-trading", role: "Decentralized exchange and yield venues", products: ["Base trading and yield balances"], relationships: [], evidenceNotes: ["Included as active DeFi infrastructure; protocol balances overlap asset and vault values."], rwaRelevance: "asset-utility" },
  { id: "sushiswap", name: "SushiSwap", group: "lending-and-trading", role: "Decentralized exchange", products: ["Base trading balances"], relationships: [], evidenceNotes: ["Included as active trading infrastructure; volumes are not a direct measure of RWA adoption."], rwaRelevance: "asset-utility" },
  { id: "beefy", name: "Beefy", group: "lending-and-trading", role: "Yield vault aggregator", products: ["Base yield balances"], relationships: [], evidenceNotes: ["Vault balances may overlap underlying protocol TVL and should not be double-counted."], rwaRelevance: "asset-utility" },
  { id: "ipor", name: "IPOR", group: "lending-and-trading", role: "Structured vault and strategy infrastructure", products: ["IPOR Fusion vaults"], relationships: ["aave", "coinbase"], evidenceNotes: ["The report says some vaults use Coinbase tokenized stocks as collateral on Aave; vault settings determine permitted assets and markets."], rwaRelevance: "asset-utility" },

  // Market data and oracles
  { id: "pyth", name: "Pyth Network", group: "oracles-and-market-data", role: "Oracle price feeds", products: ["Base price feeds"], relationships: [], evidenceNotes: ["The report says Pyth has supplied prices on Base since August 2023."], rwaRelevance: "infrastructure" },
  { id: "redstone", name: "RedStone", group: "oracles-and-market-data", role: "Oracle price feeds", products: ["Base mainnet oracle contract"], relationships: [], evidenceNotes: ["The article identifies a published Base mainnet oracle contract."], rwaRelevance: "infrastructure" },
  { id: "chainlink", name: "Chainlink", group: "oracles-and-market-data", role: "Price feeds and cross-chain messaging", products: ["Base price feeds", "CCIP"], relationships: ["maple-finance"], evidenceNotes: ["The report links Chainlink to syrupUSDC cross-chain messaging and tokenized-stock lending price feeds; oracle data does not attest reserves or legal title."], rwaRelevance: "infrastructure" },
  { id: "api3", name: "API3", group: "oracles-and-market-data", role: "First-party oracle data feeds", products: ["Base data feeds for crypto, FX, equities and commodities"], relationships: [], evidenceNotes: ["The report dates its Base feed availability to October 2023."], rwaRelevance: "infrastructure" },

  // Bridges and messaging
  { id: "across", name: "Across Protocol", group: "bridges-and-messaging", role: "Intent-based fast bridge", products: ["Base bridge routes"], relationships: [], evidenceNotes: ["Listed in Base's bridge guide; the article does not establish a direct technical dependency on LayerZero."], rwaRelevance: "infrastructure" },
  { id: "stargate", name: "Stargate Finance", group: "bridges-and-messaging", role: "Liquidity-pool bridge", products: ["Base bridge routes"], relationships: ["layerzero"], evidenceNotes: ["The report identifies Stargate as a LayerZero-powered liquidity-pool bridge."], rwaRelevance: "infrastructure" },
  { id: "layerzero", name: "LayerZero", group: "bridges-and-messaging", role: "Cross-chain messaging", products: ["Base mainnet endpoint", "Stargate messaging"], relationships: ["stargate", "maple-finance"], evidenceNotes: ["The article notes a separately documented Base mainnet endpoint."], rwaRelevance: "infrastructure" },
  { id: "lifi", name: "LI.FI", group: "bridges-and-messaging", role: "Bridge and swap route aggregation", products: ["Jumper"], relationships: ["socket"], evidenceNotes: ["Routes depend on different relayers, liquidity and messaging; bridging does not create a new asset."], rwaRelevance: "infrastructure" },
  { id: "socket", name: "Socket", group: "bridges-and-messaging", role: "Cross-chain route aggregation", products: ["Bungee"], relationships: ["lifi"], evidenceNotes: ["The report identifies Socket as the infrastructure behind Bungee routes."], rwaRelevance: "infrastructure" },
  { id: "axelar", name: "Axelar", group: "bridges-and-messaging", role: "Cross-chain connectivity", products: ["Base connectivity and validation"], relationships: [], evidenceNotes: ["The article says Axelar connects Base to other chains and validators verify Base as a consensus chain."], rwaRelevance: "infrastructure" },

  // Custody, account, identity and compliance
  { id: "fireblocks", name: "Fireblocks", group: "custody-wallets-and-compliance", role: "Institutional custody and transaction infrastructure", products: ["Base custody and contract interaction"], relationships: [], evidenceNotes: ["The report dates Base custody support to August 2023."], rwaRelevance: "infrastructure" },
  { id: "civic", name: "Civic", group: "custody-wallets-and-compliance", role: "Identity and embedded wallet", products: ["Base embedded-wallet support"], relationships: [], evidenceNotes: ["The report dates embedded-wallet support to March 2025."], rwaRelevance: "infrastructure" },
  { id: "trm-labs", name: "TRM Labs", group: "custody-wallets-and-compliance", role: "Blockchain tracing and screening", products: ["Base tracing, screening and monitoring"], relationships: [], evidenceNotes: ["Listed as a Base risk and compliance service."], rwaRelevance: "infrastructure" },
  { id: "chainalysis", name: "Chainalysis", group: "custody-wallets-and-compliance", role: "Blockchain analytics and security monitoring", products: ["Hexagate security support"], relationships: [], evidenceNotes: ["The article mentions Chainalysis/Hexagate support for Base applications."], rwaRelevance: "infrastructure" },
  { id: "safe", name: "Safe", group: "custody-wallets-and-compliance", role: "Smart-account infrastructure", products: ["Base smart accounts"], relationships: [], evidenceNotes: ["Support documentation covers deployed Base accounts and network limits."], rwaRelevance: "infrastructure" },
  { id: "privy", name: "Privy", group: "custody-wallets-and-compliance", role: "Embedded wallet and app connectivity", products: ["Base wallet connections"], relationships: [], evidenceNotes: ["The article points to documented Base app and wallet features."], rwaRelevance: "infrastructure" },
  { id: "biconomy", name: "Biconomy", group: "custody-wallets-and-compliance", role: "Modular execution and account infrastructure", products: ["Base mainnet deployments"], relationships: [], evidenceNotes: ["Listed among services for transaction approval and gas sponsorship."], rwaRelevance: "infrastructure" },
  { id: "turnkey", name: "Turnkey", group: "custody-wallets-and-compliance", role: "Wallet infrastructure and builder attribution tooling", products: ["Base builder-code integration"], relationships: [], evidenceNotes: ["The report says Turnkey provides a Base builder-code integration."], rwaRelevance: "infrastructure" },
  { id: "rainbow", name: "Rainbow", group: "custody-wallets-and-compliance", role: "Wallet", products: ["Base network support"], relationships: [], evidenceNotes: ["Listed as a supported Base wallet network."], rwaRelevance: "infrastructure" },

  // Distribution and NFT tooling
  { id: "opensea", name: "OpenSea", group: "distribution-and-nfts", role: "NFT marketplace", products: ["Base marketplace support"], relationships: [], evidenceNotes: ["NFT/digital-art volume is excluded from the report's RWA totals."], rwaRelevance: "adjacent" },
  { id: "manifold", name: "Manifold", group: "distribution-and-nfts", role: "NFT publishing tools", products: ["Base NFT contracts"], relationships: [], evidenceNotes: ["Supports publishing NFT contracts on Base; not counted as direct RWA by the report."], rwaRelevance: "adjacent" },
  { id: "crossmint", name: "Crossmint", group: "distribution-and-nfts", role: "Marketplace payments and checkout", products: ["Base marketplace checkout"], relationships: ["highlight"], evidenceNotes: ["The article says Crossmint supports Highlight contracts and checkout flows for users without crypto-funded wallets."], rwaRelevance: "adjacent" },
  { id: "highlight", name: "Highlight", group: "distribution-and-nfts", role: "NFT and digital-asset checkout", products: ["Base contracts and checkout flows"], relationships: ["crossmint"], evidenceNotes: ["Digital-art volume is excluded from the report's RWA totals."], rwaRelevance: "adjacent" },
  { id: "zora", name: "Zora", group: "distribution-and-nfts", role: "Creator coin protocol", products: ["Base coin factory", "Uniswap V4 pools"], relationships: ["uniswap"], evidenceNotes: ["Included as a Base creator-coin app, not as a direct issuer of offchain RWA."], rwaRelevance: "adjacent" },

  // Developer and data infrastructure
  { id: "alchemy", name: "Alchemy", group: "developer-and-data-infrastructure", role: "Base RPC and developer infrastructure", products: ["Base RPC"], relationships: ["quicknode", "chainstack"], evidenceNotes: ["Listed as a Base RPC/data service provider, not an asset issuer."], rwaRelevance: "infrastructure" },
  { id: "quicknode", name: "QuickNode", group: "developer-and-data-infrastructure", role: "Base RPC and developer infrastructure", products: ["Base RPC"], relationships: ["alchemy", "chainstack"], evidenceNotes: ["Listed as a Base RPC/data service provider, not an asset issuer."], rwaRelevance: "infrastructure" },
  { id: "chainstack", name: "Chainstack", group: "developer-and-data-infrastructure", role: "Base RPC and infrastructure", products: ["Base RPC"], relationships: ["alchemy", "quicknode"], evidenceNotes: ["Listed as a Base RPC/data service provider, not an asset issuer."], rwaRelevance: "infrastructure" },
  { id: "thirdweb", name: "thirdweb", group: "developer-and-data-infrastructure", role: "Developer and app deployment tooling", products: ["Base deployment and app tooling"], relationships: [], evidenceNotes: ["Listed as developer infrastructure rather than an asset issuer."], rwaRelevance: "infrastructure" },
  { id: "the-graph", name: "The Graph", group: "developer-and-data-infrastructure", role: "Blockchain indexing", products: ["Base transfers, balances and lending-event indexing"], relationships: ["blockscout"], evidenceNotes: ["An indexed transfer proves a token moved; it does not prove a purchase or beneficial ownership change."], rwaRelevance: "infrastructure" },
  { id: "blockscout", name: "Blockscout", group: "developer-and-data-infrastructure", role: "Block explorer", products: ["Base explorer"], relationships: ["the-graph"], evidenceNotes: ["Listed as a tool for inspecting and reconciling Base activity."], rwaRelevance: "infrastructure" },
  { id: "klimadao", name: "KlimaDAO", group: "developer-and-data-infrastructure", role: "Carbon-credit infrastructure", products: ["Klima 2.0", "Base carbon-credit contracts and tokens"], relationships: ["aerodrome"], evidenceNotes: ["The article says Klima 2.0 went live on 24 February 2026 and its liquidity pools run on Aerodrome."], rwaRelevance: "direct-issuer" },
];

export const BASE_BUILDER_RELATIONSHIPS = [
  { from: "shopify", to: "coinbase", type: "built-payment-protocol-with", detail: "Commerce Payments Protocol for eligible Shopify merchants to accept USDC on Base." },
  { from: "coinbase", to: "aave", type: "tokenized-stock-collateral", detail: "Coinbase tokenized stocks are used as collateral in Aave's Base Equities Hub for eligible investors." },
  { from: "coinbase", to: "bitwise", type: "portfolio-underlying-assets", detail: "Bitwise Automated Token Portfolios use Coinbase tokenized stocks." },
  { from: "bitwise", to: "glider", type: "portfolio-execution", detail: "Glider executes the model portfolio in the investor's own wallet under granted permissions." },
  { from: "centrifuge", to: "janus-henderson", type: "fund-partner", detail: "SPXA is described as a licensed S&P 500 index fund token developed with Janus Henderson." },
  { from: "centrifuge", to: "sp-dow-jones-indices", type: "index-partner", detail: "S&P Dow Jones Indices is named in the SPXA partnership." },
  { from: "centrifuge", to: "uniswap", type: "trading-venue", detail: "deSPXA is reported to trade on Uniswap." },
  { from: "centrifuge", to: "aerodrome", type: "trading-venue", detail: "deSPXA is reported to trade on Aerodrome." },
  { from: "centrifuge", to: "morpho", type: "collateral-integration", detail: "deSPXA backs USDC loans through Morpho vaults." },
  { from: "morpho", to: "steakhouse", type: "vault-curator", detail: "Steakhouse curates Morpho vaults using deSPXA collateral." },
  { from: "morpho", to: "clearstar", type: "vault-curator", detail: "Clearstar Labs is named as another curator for deSPXA-backed USDC vaults." },
  { from: "maple-finance", to: "chainlink", type: "cross-chain-messaging-and-pricing", detail: "The article names Chainlink CCIP and a price feed in Maple's syrupUSDC Base setup." },
  { from: "jpmorgan", to: "b2c2", type: "institutional-deposit-token-test", detail: "B2C2, Coinbase and Mastercard completed JPM Coin test transactions." },
  { from: "jpmorgan", to: "mastercard", type: "institutional-deposit-token-test", detail: "Mastercard participated in JPM Coin test transactions on Base." },
  { from: "jpmorgan", to: "coinbase", type: "institutional-deposit-token-test", detail: "Coinbase participated in JPM Coin test transactions on Base." },
  { from: "ipor", to: "aave", type: "structured-vault-market-route", detail: "Some IPOR Fusion vaults post Coinbase tokenized stocks as collateral on Aave." },
  { from: "across", to: "layerzero", type: "bridge-stack-reference", detail: "The article separately lists Across and Stargate/LayerZero as bridge infrastructure; do not infer a direct Across dependency on LayerZero." },
  { from: "stargate", to: "layerzero", type: "built-on-messaging", detail: "Stargate is described as a liquidity-pool bridge built on LayerZero." },
  { from: "crossmint", to: "highlight", type: "checkout-integration", detail: "Crossmint supports Highlight contracts and checkout flows." },
  { from: "klimadao", to: "aerodrome", type: "liquidity-venue", detail: "Klima 2.0 liquidity pools are reported on Aerodrome." },
];

export const BASE_RWA_RESEARCH_METRICS = {
  asOf: "2026-11-23",
  source: "RWA Foundation research, using RWA.xyz, DefiLlama, Token Terminal and named project/Base sources",
  distributedRwa: {
    valueUsd: 735_950_000,
    change30dPercent: 86.43,
    holders: 197_485,
    holdersChange30dPercent: 11.66,
    meaning: "Investor-held RWAs that holders can move onchain; stablecoin holders are counted separately.",
  },
  representedRwa: {
    valueUsd: 24_130_000,
    meaning: "Assets represented for recordkeeping; holders cannot move them onchain.",
  },
  defillamaActiveRwaAumUsd: 464_750_000,
  tokenTerminalMarketCapByAssetClassUsd: {
    tokenizedFunds: 665_500_000,
    tokenizedStocks: 54_200_000,
    tokenizedCommodities: 16_300_000,
  },
  stablecoinSupplyUsd: 4_919_000_000,
  lendingMarkets: {
    suppliedUsd: 5_910_000_000,
    borrowedUsd: 2_140_000_000,
    defiLlamaLendingTvlUsd: 4_042_000_000,
    protocolCount: 76,
    meaning: "Supplied/borrowed market totals and DefiLlama lending TVL use different definitions and are not additive.",
  },
  growthLeaders: [
    { name: "TownSquare", valueUsd: 304_600_000, note: "It was below $1 million in the previous 30-day comparison." },
    { name: "Midas", valueUsd: 103_600_000, note: "It roughly doubled over the previous 30 days." },
    { name: "Coinbase tokenized stocks", valueUsd: 48_100_000, change30dPercent: 33.44 },
  ],
  methodologyWarnings: [
    "The $735.95m distributed RWA total, $24.13m represented value, $464.75m DefiLlama Active RWA AUM, and Token Terminal asset-class market caps are different measures. Do not add them together.",
    "Stablecoin supply and lending-market supply/borrowing are separate ecosystem measures, not additional distributed RWA AUM.",
    "Lending, vault curator, bridge and aggregator balances may overlap underlying tokens. Do not sum protocol TVL as if each value were a distinct RWA.",
    "A transfer or indexed holder count does not prove a purchase, beneficial ownership, legal rights or unique human holders.",
    "All values are a dated 23 November 2026 research snapshot and must be refreshed before being presented as current.",
  ],
};

export function buildBaseBuilderMap() {
  return {
    source: BASE_BUILDER_MAP_SOURCE,
    groups: BASE_BUILDER_GROUPS,
    builders: BASE_BUILDERS,
    relationships: BASE_BUILDER_RELATIONSHIPS,
    marketMetrics: BASE_RWA_RESEARCH_METRICS,
    coverage: {
      namedBuilderRecords: BASE_BUILDERS.length,
      relationshipRecords: BASE_BUILDER_RELATIONSHIPS.length,
      automatedDiscovery: false,
      note: "Curated from the RWA Foundation report. This is a source-backed starting map, not a complete live crawl of all Base builders.",
    },
    caveats: [
      "The map records what the cited report says; company presence does not imply endorsement, investment quality, user eligibility, or a Base airdrop criterion.",
      "Market metrics are a point-in-time snapshot. Different providers use different definitions and are intentionally kept separate.",
      "Relationships are reported integrations or partnerships from the article, not a graph of common ownership.",
      "Payment stablecoins, bank deposit tokens, generic DeFi TVL and NFT activity are not included in distributed RWA AUM.",
    ],
  };
}
