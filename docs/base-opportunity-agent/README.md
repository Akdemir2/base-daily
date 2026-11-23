# Base Opportunity Agent

A read-only research module alongside Base Daily that investigates the Base ecosystem, real-world assets (RWAs), companies, and protocol relationships.

## User Interface

The research dashboard is available at `/agent`.

The dashboard includes:
- A market snapshot dated 23 November 2026 from RWA Foundation research.
- A functional map of companies and projects building on Base.
- Reported partnership, integration, collateral, and trading-route relationships.
- A source-backed registry of selected Base RWA contracts.
- Links to the related JSON API endpoints.

## API Endpoints

- `GET /api/agent/report` — reports Base Daily product activity, indexing progress, Builder Code configuration, and airdrop-eligibility status. Airdrop eligibility remains `unknown`.
- `GET /api/agent/opportunities` — combines the dated RWA research catalogue, opportunities, risk checks, live RWA/Coinbase data, the company map, and the contract registry.
- `GET /api/agent/builders` — returns the company/project map and relationship records curated from the RWA Foundation report.
- `GET /api/agent/contracts` — API version 3; returns selected Base RWA contract addresses, sources, bytecode/supply/decimals checks, and GLDY-specific live permission/reserve configuration.
- `GET /api/agent/rwa` — returns Base-chain TVL, APY, holder, and classification data from RWA Pipe.
- `GET /api/agent/tokenized-stocks` — returns Coinbase tokenized-stock listings and incremental `totalSupply()` checks on Base.

All research endpoints are read-only. They do not initiate wallet connections, request private keys, sign transactions, transfer, swap, bridge, mint, claim, or write to smart contracts.

## RWA Foundation Company Map

Source: [RWA Foundation — Who Builds on Base?](https://www.rwaf.xyz/research/live/who-builds-on-base-the-companies-behind-coinbase-s-rwa-chain-2124877138004263087/)

- Source snapshot: **23 November 2026**.
- Map coverage: **97 company/project records**, eight activity groups, and **20 relationship records**.
- Activity groups: RWA issuers; payments/stablecoins; lending and trading; oracles/data; bridges and messaging; custody/wallets/compliance; distribution/NFTs; developer and data infrastructure.

Relationships represent integrations, partnerships, asset usage, or trading routes reported in the article; they do not imply common ownership. The map is a manually curated, source-backed starting point, not a complete automated crawl of the Base ecosystem.

## Dated Market Snapshot

The RWA Foundation research reports the following figures for 23 November 2026:

- Distributed RWA: **$735.95 million**, 30-day change **+86.43%**.
- RWA holder addresses: **197,485**, 30-day change **+11.66%**.
- Represented assets: **$24.13 million**.
- DefiLlama Active RWA AUM: **$464.75 million**.
- Stablecoin supply: **$4.919 billion**.
- Reported lending-market supply: **$5.91 billion**, with **$2.14 billion** borrowed.

These indicators measure different things. Distributed RWA, represented assets, stablecoin supply, lending balances, and DefiLlama TVL **must not be added together**. Protocol/vault/curator/collateral balances may count the same underlying assets more than once. Holder counts are not counts of unique people and do not prove purchases. All figures are dated third-party research data; they are not presented as live prices, audited AUM, or executable liquidity.

## Base RWA Contract Registry

The registry is maintained in `lib/server/base-rwa-contract-registry.ts`. The current build contains **15 product records and 15 Base addresses matched to sources**: nine addresses are published in issuer/protocol documentation, five match official documentation and BaseScan, and one matches a BaseScan label and issuer product page but still lacks an explicit issuer-published address list. There are no unresolved addresses; one alternative-address data warning is retained for GromaCoin.

- Centrifuge / Anemoy: SPXA, deSPXA, JTRSY, deJTRSY, JAAA, deJAAA, and ACRDX.
- Spiko: USTBL, EUTBL, UKTBL, SPKCC, and eurSPKCC.
- Streamex: GLDY.
- Midas: mGLO.
- Groma: GromaCoin (GRO). The contract-specification link on Groma's official whitepaper page opens BaseScan address `0xdb433b2c714d898Fdb81fEE9a6ca4a3f1c2A79a5`. The different address `0x3dCce9e05Fc9c30A6a4E9FC1c0ec1Ff15C16e0b5` on Coinbase's price page does not match that official link and is retained as an alternative-address discrepancy.

Address-evidence statuses are distinguished:
- `issuer_published`: the address is listed in issuer/protocol-published documentation.
- `docs_and_explorer_match`: issuer documentation and the BaseScan record match.
- `explorer_labelled_needs_issuer_confirmation`: a BaseScan label and product link exist, but an explicit issuer-published address list is still awaited.
- `conflicting_sources`: public sources disagree; no single address is selected.

Examples:
- Centrifuge's official deployment table lists SPXA, deSPXA, JTRSY, deJTRSY, JAAA, deJAAA, and ACRDX on Base: [Centrifuge deployments](https://developer.centrifuge.io/developer/protocol/deployments/).
- Spiko's official address table lists USTBL, EUTBL, UKTBL, SPKCC, and eurSPKCC on Base: [Spiko addresses and audits](https://docs.spiko.io/documentation/tokenization/addresses/).
- Streamex's GLDY announcement explicitly provides the Base address: [GLDY launch announcement](https://www.globenewswire.com/news-release/2026/02/25/3244661/22558/en/streamex-corp-announces-gldy-is-now-live-and-available-for-purchase.html).
- BaseScan labels mGLO as Midas Fasanara Global Open; a match against an issuer-published address list is still pending.
- For GromaCoin, the contract-specification link on Groma's own whitepaper page opens BaseScan address `0xdb433b2c714d898Fdb81fEE9a6ca4a3f1c2A79a5`. The alternative address `0x3dCce9e05Fc9c30A6a4E9FC1c0ec1Ff15C16e0b5` on Coinbase's price page does not match the official link and is retained as an unverified data discrepancy; it must not be used in place of the official-source address.

**Important limitation:** Publication of an address in official documentation does not prove a security audit, reserves, legal rights, or investor access. Onchain checks now run incrementally through `GET /api/agent/contracts`; up to three addresses are checked per refresh using `eth_getCode`, `totalSupply()`, and `decimals()`. Verification progress and RPC errors are exposed separately in the response. These checks are not security audits; proxy implementations and administrator permissions require separate review.

### Onchain Contract Verification

In addition to the address registry, `GET /api/agent/contracts` provides incremental bytecode and ERC-20 data checks through Base RPC.

- Up to **3 contracts** are checked per refresh; a Redis cursor advances to the next addresses.
- In the initial Preview test, bytecode was found for the first **3 of 15** contracts; `totalSupply()` and `decimals()` were read with no RPC errors. The remaining 12 addresses were pending at that time. This count changes as checks progress.
- `eth_getCode` checks for bytecode; `totalSupply()` and `decimals()` are read where supported.
- The EIP-1967 implementation, admin, and beacon storage slots are inspected. If a beacon is found, its `implementation()` method is called; bytecode is checked at implementation and beacon-implementation addresses.
- The English `/agent` dashboard shows verification progress, supply and decimals data, proxy implementation/admin/beacon addresses, and RPC notes.
- Results are considered fresh for 15 minutes and retained in Redis for up to seven days.
- Addresses not yet checked remain pending; RPC errors are explicitly marked.
- `bytecodePresent = true` does not mean a contract is secure, audited, or legally valid. Reading an admin address from an EIP-1967 slot does not verify the administrator's identity/reputation or multisig security. Other proxy standards may not be detected by this check.

The `GET /api/agent/opportunities` response includes these checks under `liveData.rwaContractVerification`. This endpoint performs read-only RPC checks alongside the RWA and Coinbase data-source requests.

### GLDY Due Diligence

GLDY is currently the only product in the registry with a deep-dive review, shown in the dashboard as **9 sourced findings**. Findings are labeled separately as issuer disclosures, issuer financial filings, verified source code, and third-party onchain/risk reviews. The other 14 products have not yet received the same depth of due diligence.

**Contract technology and permissions**
- BaseScan marks the GLDY proxy source code as Exact Match and lists implementation address `0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5`. Sourcify also marks this implementation as Exact Match.
- The implementation uses AccessControl, Pausable, and UUPS components. Its source includes TREASURY_ROLE / OPERATOR_ROLE, a transfer whitelist, address freezing, pause controls, batch minting, and Chainlink Proof of Reserve configuration.
- The BaseScan page states that no contract security audit report has been submitted. Exact Match does not mean an independent audit.
- Pharos's onchain reviews dated 1–19 October 2026 list candidate addresses for the Treasury Safe (2-of-3), Admin Safe (3-of-5), and OPERATOR_ROLE. The agent now rechecks membership of these three candidates directly through Base RPC using `hasRole`; this does not enumerate every role holder. Owner addresses and threshold values for the Treasury/Admin Safes are also read live through `getOwners()` / `getThreshold()`.
- Based on GLDY's verified Sourcify storage layout, the `whitelistEnabled`, `chainlinkPoRFeed`, `porDecimals`, `useChainlinkPoR`, `allowOracleFallback`, `manualReserveAmount`, and `manualReserveTimestamp` fields are read from proxy storage. `paused()` is queried separately.

**Governance and investor rights**
- Streamex's Form 10-Q, filed on 12 November 2026, states that as of 30 September 2026 the company held approximately **82.30%** of GLDY supply and other token holders held **17.70%**.
- The same filing says GLDY token-holder interests carry no voting rights; governance control rests with a management share carrying the sole vote, and day-to-day operations are delegated to the company's consolidated servicer.
- This is not evidence of insufficient reserves, but it does indicate that token holders have limited governance power and economic ownership.

**Reserves, yield, and exit**
- Streamex's announcement dated 18 November 2026 says each GLDY is backed 1:1 by one fine troy ounce of physical gold, reports an independent reserve examination, and points to Chainlink Proof of Reserve visibility. The same announcement describes a **3.5% target annual yield** from gold leasing; this is not guaranteed.
- Pharos notes that the Chainlink feed carries the ounce amount reported by the issuer and is not, by itself, an independent reserve attestation. The issuer disclosure, external examination report, and oracle data source are different forms of evidence.
- According to the Form 10-Q, the gold supporting the GLDY program had a cost basis of **$16.467 million** and a market value of approximately **$13.993 million** as of 30 September 2026 (about 15% below cost). The company recorded no impairment in its recoverability test based on a seven-year assumed holding period and expected leasing cash flows. This accounting measurement is not a current reserve ratio per token.
- The Form 10-Q says redemption and secondary sales are possible, while transaction timing and size depend on market liquidity, counterparty availability, and gold-leasing arrangements. It also reports an unsecured, non-interest-bearing liquidity-support loan to a liquidity provider consisting of **5.0 million USDC and 1,069 GLDY**; this single arrangement does not prove depth across the entire market.
- Pharos's **C (56/100)** assessment dated 11 November 2026 reflects its own preliminary methodology; it is not a regulatory grade, credit rating, or security rating.
- The dashboard queries `whitelistEnabled`, `paused`, `useChainlinkPoR`, `allowOracleFallback`, manual reserve slots, and the current Chainlink feed reading through Base RPC. The feed value may carry data reported by the issuer and is not an independent reserve attestation. The feed's `decimals()` and `latestRoundData()` are queried, and the response timestamp and age are displayed. The feed value is not a separate independent reserve audit.

Sources:
- [Sourcify — GLDYTokenERC20 implementation](https://repo.sourcify.dev/8453/0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5)
- [BaseScan — GLDY proxy](https://basescan.org/address/0x632db1aAaCe73401a5dc8cDE6e9062B8eC0FD819)
- [Streamex Form 10-Q, 30 September 2026](https://ir.streamex.com/static-files/b3771e82-8d83-4777-a235-a69c5ae6b6ed)
- [Streamex, GLDY announcement dated 18 November 2026](https://ir.streamex.com/news-releases/news-release-details/streamex-announces-gldy-now-live-equity-trust-company-its-first-tokenized-asset-self-directed-iras)
- [Pharos — GLDY risk and controls review](https://pharos.watch/stablecoin/gldy-streamex/)

The purpose of this section is not to recommend the product. It makes clear that technical checks, legal/corporate rights, reserve evidence, and exit mechanisms have different evidence levels.

## Live RWA Data

The RWA Pipe service calls market and token endpoints filtered for Base. Stablecoins are excluded; the following categories are also not automatically included in the conservative RWA total:
- Wrapped crypto assets.
- Stablecoin lending-vault shares.
- Unsupported/general categories.

Each record is classified as `candidate_rwa`, `needs_classification`, or `excluded_non_rwa`. The provider's raw total and the classified candidate total are kept separate. TVL is not the same as executable DEX liquidity or issuer redemption capacity.

## Coinbase Tokenized Stocks

Products and Base network parameters are read through the Coinbase Tokenized Stocks API. Checking every contract in a single server request caused timeouts, so each refresh checks at most **three** tokens using Base `totalSupply()`. A Redis-backed round-robin cursor stores results and advances to the next products on subsequent refreshes.

Tokens not yet checked remain in `needs_review`. Issuer-reported supply and Base onchain supply are kept in separate fields. The NAV reference price is not an executable bid/ask quote. A successful `totalSupply()` call is not proof of a contract security audit, legal status, reserves, or redemption rights.

## Base Daily Indexer

The current indexer:
- Uses PublicNode as the default Base RPC; it can be overridden server-side with `BASE_RPC_URL`.
- Starts `eth_getLogs` queries with a 50,000-block range and halves the range when the provider returns range/timeout errors.
- Stores the accepted range per RPC hostname in Redis.
- Paces requests according to rate limits and retries transient 429 responses.
- Preserves the Redis cursor, lock, and transaction-hash/log-index deduplication.

The existing Vercel Cron schedule remains unchanged: once daily at 08:00 UTC. The daily task refreshes RWA Pipe data, Coinbase tokenized-stock data, and onchain checks for up to three RWA contracts, then runs the indexer. The indexer has a work budget of up to 600 chunks or 220 seconds, whichever comes first. Actual progress depends on RPC latency, provider limits, and the number of logs returned.

## Environment and Test Safety

Preview and Production environments share the same Upstash Redis connection. Calling `/api/agent/report` or the indexer from Preview can advance the shared Redis cursor/cache state. This does not change Production code, deploy to Production, or send an onchain transaction; however, the shared state must be considered when running tests.

## Security and Interpretation Rules

- The agent is in research mode; it does not request private keys, seed phrases, or wallet credentials.
- No automated swaps, bridges, minting, claims, or transfers are performed.
- Wallet/address counts must not be interpreted as counts of unique people.
- No activity is described as a confirmed airdrop criterion unless Base explicitly publishes such a rule.
- RWA tokenization does not remove issuer, custody, legal-structure, service-provider, oracle, smart-contract, liquidity, or counterparty risk.
- Opportunity scores represent research priority; they are not return forecasts, investment advice, or airdrop probabilities.
