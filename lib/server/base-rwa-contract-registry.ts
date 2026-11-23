export type RwaContractEvidence =
  | "official_issuer"
  | "official_protocol_docs"
  | "official_docs_and_explorer_label"
  | "explorer_labelled"
  | "third_party_conflict";

export type RwaContractStatus =
  | "issuer_published"
  | "docs_and_explorer_match"
  | "explorer_labelled_needs_issuer_confirmation"
  | "conflicting_sources"
  | "awaiting_primary_source";

export type RwaDiligenceFinding = {
  id: string;
  topic: "source-code" | "smart-contract-controls" | "governance" | "redemption-liquidity" | "reserves" | "yield";
  evidenceType:
    | "source_code_verification"
    | "issuer_disclosure"
    | "issuer_filing"
    | "third_party_onchain_review"
    | "third_party_risk_review";
  asOf: string;
  finding: string;
  limitation: string;
  sourceName: string;
  sourceUrl: string;
};

export type BaseRwaContractRecord = {
  id: string;
  builderId: string;
  issuer: string;
  assetName: string;
  symbol: string | null;
  chain: "base";
  chainId: 8453;
  contractAddress: string | null;
  contractAddressCandidates: {
    address: string;
    sourceName: string;
    sourceUrl: string;
    evidence: string;
  }[];
  evidenceClass: RwaContractEvidence;
  status: RwaContractStatus;
  primarySourceUrl: string;
  explorerUrl: string | null;
  productType: string;
  accessNotes: string[];
  diligenceFindings?: RwaDiligenceFinding[];
  reviewedAt: "2026-11-23";
  notes: string[];
};

const BASESCAN = "https://basescan.org/address/";

export const BASE_RWA_CONTRACTS: BaseRwaContractRecord[] = [
  {
    id: "centrifuge-spxa",
    builderId: "centrifuge",
    issuer: "Centrifuge / Anemoy",
    assetName: "Anemoy S&P 500 Index Fund token",
    symbol: "SPXA",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x09b61343097c1f9b159a3ae7151298efd10f0db2",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0x09b61343097c1f9b159a3ae7151298efd10f0db2",
    productType: "Licensed S&P 500 index fund token",
    accessNotes: [
      "SPXA and deSPXA are separate tokens; do not substitute one address for the other.",
      "Confirm fund and token eligibility rules with Centrifuge and the issuer.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "The Base address is explicitly published in Centrifuge's official deployment documentation.",
      "This record matches an address to its source; it is not a legal review or smart-contract audit.",
    ],
  },
  {
    id: "centrifuge-despxa",
    builderId: "centrifuge",
    issuer: "Centrifuge / Anemoy",
    assetName: "deSPXA transferable S&P 500 exposure token",
    symbol: "deSPXA",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x9c5C365e764829876243d0b289733B9D2b729685",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0x9c5C365e764829876243d0b289733B9D2b729685",
    productType: "Transferable tokenized exposure to the SPXA fund",
    accessNotes: [
      "The Base case study says deSPXA is available only to eligible investors outside the United States.",
      "Centrifuge states that NAV-based minting and redemption are available to non-US Authorized Participants; other holders may depend on secondary markets.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "The Base address is explicitly published in Centrifuge's official deployment documentation.",
      "The associated USDC settlement token is a separate asset and is not this RWA token.",
    ],
  },
  {
    id: "streamex-gldy",
    builderId: "streamex",
    issuer: "Streamex Corp.",
    assetName: "Gold Yield Token",
    symbol: "GLDY",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x632db1aAaCe73401a5dc8cDE6e9062B8eC0FD819",
    contractAddressCandidates: [],
    evidenceClass: "official_issuer",
    status: "issuer_published",
    primarySourceUrl: "https://ir.streamex.com/news-releases/news-release-details/streamex-corp-announces-gldy-now-live-and-available-purchase",
    explorerUrl: BASESCAN + "0x632db1aAaCe73401a5dc8cDE6e9062B8eC0FD819",
    productType: "Gold-backed tokenized security",
    accessNotes: [
      "According to Streamex's launch announcement, investor onboarding requires completion of KYC and subscription documentation.",
      "The issuer describes GLDY as 1:1 exposure to physical gold; yield expected from gold leasing is not guaranteed.",
      "The contract code includes a whitelist, address freezing, pause controls, role-based permissions, and UUPS upgradeability. These features create investor-access and governance risks.",
    ],
    diligenceFindings: [
      {
        id: "gldy-source-verified",
        topic: "source-code",
        evidenceType: "source_code_verification",
        asOf: "2026-07-09",
        finding: "Sourcify marks the GLDYTokenERC20 implementation as an Exact Match. BaseScan also marks the proxy source code as an Exact Match and identifies the implementation address as 0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5.",
        limitation: "A source-code match is not an independent security audit. The BaseScan page states that no contract security audit report has been submitted.",
        sourceName: "Sourcify and BaseScan",
        sourceUrl: "https://repo.sourcify.dev/8453/0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5",
      },
      {
        id: "gldy-control-surface",
        topic: "smart-contract-controls",
        evidenceType: "source_code_verification",
        asOf: "2026-07-09",
        finding: "The verified implementation uses AccessControl, Pausable, and UUPS components. The source includes TREASURY_ROLE and OPERATOR_ROLE, a transfer whitelist, address freezing, pause controls, batch minting, and Chainlink Proof of Reserve configuration.",
        limitation: "The presence of a function in source code does not establish which address currently holds that permission or which configuration is active. Proxy admin/implementation details and role holders must be checked onchain separately.",
        sourceName: "Sourcify — GLDYTokenERC20 Source Code",
        sourceUrl: "https://repo.sourcify.dev/8453/0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5",
      },
      {
        id: "gldy-role-observation",
        topic: "governance",
        evidenceType: "third_party_onchain_review",
        asOf: "2026-10-19",
        finding: "Pharos's observation at Base block 52800765 (19 October 2026) reports whitelistEnabled=true and paused=false. OPERATOR_ROLE (0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929) is true for address 0xa50fc96f444c2922ca80cc7e56fd8e10633ce983; this role is associated with address freezing and removal from the whitelist. Pharos also reports a 2-of-3 Safe for TREASURY_ROLE at 0xaab923eefe8f3264d08b4610c6969d6d98104165 and a 3-of-5 Safe for DEFAULT_ADMIN_ROLE at 0x05ed6826524ebe9f3df837b06803ff797f4e2130.",
        limitation: "These address and status details come from Pharos block observations dated 1–19 October 2026; the application now rechecks them directly through Base RPC. Role queries test membership only for known candidate addresses; they do not discover every role member.",
        sourceName: "Pharos — GLDY Controls and Risk Profile",
        sourceUrl: "https://pharos.watch/stablecoin/gldy-streamex/",
      },
      {
        id: "gldy-governance-concentration",
        topic: "governance",
        evidenceType: "issuer_filing",
        asOf: "2026-09-30",
        finding: "Streamex's Form 10-Q filed on 12 November 2026 states that, as of 30 September 2026, the company held approximately 82.30% of GLDY supply and other token holders held 17.70%. Token-holder interests carry no voting rights; voting control rests with a management share carrying the sole vote, while day-to-day operating authority is held by the company's consolidated servicer.",
        limitation: "These ownership percentages are a snapshot from the financial report dated 30 September 2026, not the current token distribution. Management/servicer control alone does not mean reserves are insufficient, but it does indicate governance concentration.",
        sourceName: "Streamex Corp. Form 10-Q, 30 September 2026",
        sourceUrl: "https://ir.streamex.com/static-files/b3771e82-8d83-4777-a235-a69c5ae6b6ed",
      },
      {
        id: "gldy-redemption-and-liquidity",
        topic: "redemption-liquidity",
        evidenceType: "issuer_filing",
        asOf: "2026-09-30",
        finding: "The Form 10-Q states that GLDY holders may redeem with the issuer or sell through permissioned onchain secondary markets / institutional liquidity providers. It also says transaction timing and size depend on market liquidity, counterparty availability, and gold-leasing arrangements; the company disclosed an unsecured, non-interest-bearing support loan to a liquidity provider consisting of 5.0 million USDC and 1,069 GLDY.",
        limitation: "24/7 trading or the existence of a liquidity provider does not guarantee immediate, unconditional redemption at every size. The reported loan is one specific liquidity arrangement and does not prove the depth of the entire secondary market.",
        sourceName: "Streamex Corp. Form 10-Q, 30 September 2026",
        sourceUrl: "https://ir.streamex.com/static-files/b3771e82-8d83-4777-a235-a69c5ae6b6ed",
      },
      {
        id: "gldy-gold-market-vs-carrying-value",
        topic: "reserves",
        evidenceType: "issuer_filing",
        asOf: "2026-09-30",
        finding: "Streamex's 10-Q records the gold supporting the GLDY program at a cost basis of $16.467 million as of 30 September 2026; its market value on that date was approximately $13.993 million, about 15% below cost. The company recorded no impairment, concluding in its recoverability test that undiscounted cash flows exceeded carrying value, based on an assumed seven-year holding period and expected leasing cash flows.",
        limitation: "This is the company's accounting value and its own recoverability test; it is not a current reserve ratio per token or an independent liquidity measure. Gold market value and book value are different measurements; the decline alone does not establish that GLDY is unbacked or that a reserve shortfall exists.",
        sourceName: "Streamex Corp. Form 10-Q, Note 10 — Other Assets — Gold",
        sourceUrl: "https://ir.streamex.com/static-files/b3771e82-8d83-4777-a235-a69c5ae6b6ed",
      },
      {
        id: "gldy-reserve-evidence",
        topic: "reserves",
        evidenceType: "issuer_disclosure",
        asOf: "2026-11-18",
        finding: "Streamex states that each GLDY is backed 1:1 by one fine troy ounce of physical gold, that an independent reserve examination was performed by EisnerAmper, and that reserve data is viewable through a Chainlink Proof of Reserve feed on Base.",
        limitation: "Pharos notes that the Chainlink feed carries the ounce amount reported by the issuer and is not, by itself, an independent reserve attestation. The scope and date of the issuer disclosure and independent examination report must be verified separately.",
        sourceName: "Streamex investor announcement and Pharos reserve review",
        sourceUrl: "https://ir.streamex.com/news-releases/news-release-details/streamex-announces-gldy-now-live-equity-trust-company-its-first-tokenized-asset-self-directed-iras",
      },
      {
        id: "gldy-target-yield",
        topic: "yield",
        evidenceType: "issuer_disclosure",
        asOf: "2026-11-18",
        finding: "Streamex states that GLDY targets an annual 3.5% yield in gold from its gold-leasing program.",
        limitation: "This is a target yield, not a guaranteed return or fixed coupon. Gold-leasing counterparties, lease duration, and distribution terms create yield and liquidity risks.",
        sourceName: "Streamex investor announcement",
        sourceUrl: "https://ir.streamex.com/news-releases/news-release-details/streamex-announces-gldy-now-live-equity-trust-company-its-first-tokenized-asset-self-directed-iras",
      },
      {
        id: "gldy-third-party-risk-grade",
        topic: "redemption-liquidity",
        evidenceType: "third_party_risk_review",
        asOf: "2026-11-11",
        finding: "In its preliminary assessment dated 11 November 2026, Pharos assigns GLDY a C (56/100), citing access restrictions, freezing powers, governance concentration, and disclosure gaps around redemption capacity.",
        limitation: "This reflects Pharos's own methodology; it is not a regulatory grade, credit rating, or definitive security judgment. The score may change over time.",
        sourceName: "Pharos — GLDY Safety Score",
        sourceUrl: "https://pharos.watch/stablecoin/gldy-streamex/",
      },
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "The Base address is explicitly stated in Streamex's issuer announcement.",
      "BaseScan identifies the contract as GLDYProxy; its source code is marked Exact Match and points to implementation address 0xd3a66BF0ecBf910AFCc91Bd2af3E724656448Cb5.",
      "The BaseScan page states that no contract security audit report has been submitted; a source-code match is not an audit.",
    ],
  },
  {
    id: "spiko-ustbl",
    builderId: "spiko",
    issuer: "Spiko",
    assetName: "Spiko US T-Bills Money Market Fund",
    symbol: "USTBL",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xe4880249745eAc5F1eD9d8F7DF844792D560e750",
    contractAddressCandidates: [],
    evidenceClass: "official_docs_and_explorer_label",
    status: "docs_and_explorer_match",
    primarySourceUrl: "https://docs.spiko.io/documentation/tokenization/addresses/",
    explorerUrl: BASESCAN + "0xe4880249745eAc5F1eD9d8F7DF844792D560e750",
    productType: "US Treasury Bill Money Market Fund Token",
    accessNotes: [
      "Spiko states that Base fund shares may only be held by allowlisted addresses.",
      "Spiko documents onchain redemption through its Redemption Manager; an event indicating that redemption was executed does not, by itself, prove that payment has settled.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "Spiko's official address table links the Base deployment; BaseScan resolves the link to this full address and labels it USTBL.",
    ],
  },
  {
    id: "spiko-eutbl",
    builderId: "spiko",
    issuer: "Spiko",
    assetName: "Spiko EU T-Bills Money Market Fund",
    symbol: "EUTBL",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xa0769f7A8fC65e47dE93797b4e21C073c117Fc80",
    contractAddressCandidates: [],
    evidenceClass: "official_docs_and_explorer_label",
    status: "docs_and_explorer_match",
    primarySourceUrl: "https://docs.spiko.io/documentation/tokenization/addresses/",
    explorerUrl: BASESCAN + "0xa0769f7A8fC65e47dE93797b4e21C073c117Fc80",
    productType: "Eurozone Treasury Bill Money Market Fund Token",
    accessNotes: [
      "Spiko states that Base fund shares may only be held by allowlisted addresses.",
      "Check EUTBL share-class documentation and investor jurisdiction before assuming access.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "Spiko's official address table links the Base deployment; BaseScan resolves the link to this full address.",
    ],
  },
  {
    id: "spiko-uktbl",
    builderId: "spiko",
    issuer: "Spiko",
    assetName: "Spiko UK T-Bills Money Market Fund",
    symbol: "UKTBL",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xA8De1f55Aa0E381cb456e1DcC9ff781eA0079068",
    contractAddressCandidates: [],
    evidenceClass: "official_docs_and_explorer_label",
    status: "docs_and_explorer_match",
    primarySourceUrl: "https://docs.spiko.io/documentation/tokenization/addresses/",
    explorerUrl: BASESCAN + "0xA8De1f55Aa0E381cb456e1DcC9ff781eA0079068",
    productType: "UK Treasury Bill Money Market Fund Token",
    accessNotes: [
      "Spiko states that Base fund shares may only be held by allowlisted addresses.",
      "Check UKTBL share-class documentation and investor jurisdiction before assuming access.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "Spiko's official address table links the Base deployment; BaseScan resolves the link to this full address.",
    ],
  },
  {
    id: "spiko-spkcc",
    builderId: "spiko",
    issuer: "Spiko",
    assetName: "Spiko Cash & Carry",
    symbol: "SPKCC",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xf695Df6c0f3bB45918A7A82e83348FC59517734E",
    contractAddressCandidates: [],
    evidenceClass: "official_docs_and_explorer_label",
    status: "docs_and_explorer_match",
    primarySourceUrl: "https://docs.spiko.io/documentation/tokenization/addresses/",
    explorerUrl: BASESCAN + "0xf695Df6c0f3bB45918A7A82e83348FC59517734E",
    productType: "Cash-and-Carry Strategy Fund Token",
    accessNotes: [
      "Check fund terms, permitted assets, and redemption rules; this product is not the same as a conventional Treasury bill fund.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "Spiko's official address table links the Base deployment; BaseScan resolves the link to this full address.",
    ],
  },
  {
    id: "spiko-eurspkcc",
    builderId: "spiko",
    issuer: "Spiko",
    assetName: "Spiko Cash & Carry Euro",
    symbol: "eurSPKCC",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x4f33aCf823E6eEb697180d553cE0c710124C8D59",
    contractAddressCandidates: [],
    evidenceClass: "official_docs_and_explorer_label",
    status: "docs_and_explorer_match",
    primarySourceUrl: "https://docs.spiko.io/documentation/tokenization/addresses/",
    explorerUrl: BASESCAN + "0x4f33aCf823E6eEb697180d553cE0c710124C8D59",
    productType: "Euro Cash-and-Carry Strategy Fund Token",
    accessNotes: [
      "Check fund terms, permitted assets, and redemption rules; this product is not the same as a conventional Treasury bill fund.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "Spiko's official address table links the Base deployment; BaseScan resolves the link to this full address.",
    ],
  },

  {
    id: "centrifuge-jtrsy",
    builderId: "centrifuge",
    issuer: "Janus Henderson / Anemoy via Centrifuge",
    assetName: "Janus Henderson Treasury Fund",
    symbol: "JTRSY",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x8c213ee79581ff4984583c6a801e5263418c4b86",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0x8c213ee79581ff4984583c6a801e5263418c4b86",
    productType: "Tokenized Share of a Short-Term Treasury Fund",
    accessNotes: ["Confirm fund share-class terms, investor eligibility, and current redemption arrangements directly with the issuer."],
    reviewedAt: "2026-11-23",
    notes: ["Base address is explicitly listed in Centrifuge's official deployment documentation."],
  },
  {
    id: "centrifuge-dejtrsy",
    builderId: "centrifuge",
    issuer: "Janus Henderson / Anemoy via Centrifuge",
    assetName: "DeJTRSY transferable Treasury exposure",
    symbol: "deJTRSY",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xa6233014b9b7aaa74f38fa1977ffc7a89642dc72",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0xa6233014b9b7aaa74f38fa1977ffc7a89642dc72",
    productType: "Transferable onchain representation associated with JTRSY",
    accessNotes: ["Verify the legal relationship to JTRSY, redemption mechanics, and secondary-market liquidity separately."],
    reviewedAt: "2026-11-23",
    notes: ["Base address is explicitly listed in Centrifuge's official deployment documentation."],
  },

  {
    id: "centrifuge-acrdx",
    builderId: "centrifuge",
    issuer: "Anemoy / Centrifuge / Apollo",
    assetName: "Anemoy Tokenized Apollo Diversified Credit Fund",
    symbol: "ACRDX",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x9477724Bb54AD5417de8Baff29e59DF3fB4DA74f",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0x9477724Bb54AD5417de8Baff29e59DF3fB4DA74f",
    productType: "Tokenized fund share providing access to the Apollo diversified credit strategy",
    accessNotes: [
      "Centrifuge's deployment documentation lists the Base address; the latest DefiLlama RWA view shows zero Base AUM. The presence of an address does not prove active issuance, balances, or investor access on Base.",
      "Anemoy's launch announcement describes ACRDX as an institutional feeder fund for eligible investors; current network and jurisdiction eligibility should be confirmed directly with the issuer.",
      "ACRDX is not the same product as ACRED, which is issued by Securitize.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "The Base contract address appears in Centrifuge's official deployment documentation.",
      "Anemoy's ACRDX launch announcement was used for product details.",
    ],
  },
  {
    id: "centrifuge-jaaa",
    builderId: "centrifuge",
    issuer: "Janus Henderson / Anemoy via Centrifuge",
    assetName: "Janus Henderson AAA CLO ETF",
    symbol: "JAAA",
    chain: "base",
    chainId: 8453,
    contractAddress: "0x5a0F93D040De44e78F251b03c43be9CF317Dcf64",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0x5a0F93D040De44e78F251b03c43be9CF317Dcf64",
    productType: "Tokenized exposure to an AAA CLO ETF",
    accessNotes: ["Review the fund's underlying CLO exposure, tranche risks, investor eligibility, and redemption terms."],
    reviewedAt: "2026-11-23",
    notes: ["Base address is explicitly listed in Centrifuge's official deployment documentation."],
  },
  {
    id: "centrifuge-dejaaa",
    builderId: "centrifuge",
    issuer: "Janus Henderson / Anemoy via Centrifuge",
    assetName: "DeJAAA transferable CLO ETF exposure",
    symbol: "deJAAA",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xaaa0008c8cf3a7dca931adaf04336a5d808c82cc",
    contractAddressCandidates: [],
    evidenceClass: "official_protocol_docs",
    status: "issuer_published",
    primarySourceUrl: "https://developer.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: BASESCAN + "0xaaa0008c8cf3a7dca931adaf04336a5d808c82cc",
    productType: "Transferable onchain representation associated with JAAA",
    accessNotes: ["Verify the legal relationship, redemption mechanics and secondary-market liquidity separately from JAAA."],
    reviewedAt: "2026-11-23",
    notes: ["Base address is explicitly listed in Centrifuge's official deployment documentation."],
  },
  {
    id: "midas-mglo",
    builderId: "midas",
    issuer: "Midas / Fasanara",
    assetName: "Fasanara Global Open",
    symbol: "mGLO",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xfcc9cc1209651ed8867332d6f664cf82743a2584",
    contractAddressCandidates: [],
    evidenceClass: "explorer_labelled",
    status: "explorer_labelled_needs_issuer_confirmation",
    primarySourceUrl: "https://midas.app/mglo",
    explorerUrl: BASESCAN + "0xfcc9cc1209651ed8867332d6f664cf82743a2584",
    productType: "Tokenized exposure to the Fasanara Global Open strategy",
    accessNotes: [
      "BaseScan labels this Base token mGLO and links to Midas's official product page.",
      "Secondary product data indicates that minting and redemption are permissioned; current issuer terms should be checked before relying on this information.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "BaseScan labels the address Midas Fasanara Global Open (mGLO) and links to the issuer's product page; however, it should be matched against an issuer-published address list before being treated as fully issuer-verified.",
      "BaseScan identifies this address as a proxy; the implementation and administrator permissions should also be reviewed as part of contract due diligence.",
    ],
  },
  {
    id: "groma-gro",
    builderId: "groma",
    issuer: "Groma",
    assetName: "GromaCoin",
    symbol: "GRO",
    chain: "base",
    chainId: 8453,
    contractAddress: "0xdb433b2c714d898Fdb81fEE9a6ca4a3f1c2A79a5",
    contractAddressCandidates: [
      {
        address: "0x3dCce9e05Fc9c30A6a4E9FC1c0ec1Ff15C16e0b5",
        sourceName: "Coinbase price page (non-issuer asset data)",
        sourceUrl:
          "https://www.coinbase.com/en-de/price/gromacoin-base-0x3dcce9e05fc9c30a6a4e9fc1c0ec1ff15c16e0b5",
        evidence:
          "Coinbase's price page lists a different Base address for GRO; it does not match the link in Groma's own technical documentation.",
      },
    ],
    evidenceClass: "official_issuer",
    status: "issuer_published",
    primarySourceUrl: "https://whitepaper.groma.com/",
    explorerUrl: BASESCAN + "0xdb433b2c714d898Fdb81fEE9a6ca4a3f1c2A79a5",
    productType: "Permissioned-transfer token representing a real-estate investment trust share",
    accessNotes: [
      "The contract specification link in Groma's technical documentation points directly to this BaseScan token address.",
      "GromaCoin is described as a security; wallets must be allowlisted after KYC/AML.",
      "Proxy implementation and administrator permissions require separate review.",
    ],
    reviewedAt: "2026-11-23",
    notes: [
      "The 'contract specification' link on Groma's official whitepaper page opens this BaseScan address.",
      "BaseScan identifies the contract as an ERC-1967 proxy; because the implementation address can change, inspecting only the proxy address is insufficient.",
      "The alternative address on Coinbase's price page is retained as an unverified data discrepancy and must not replace the address linked from the official source.",
    ],
  },
];

export function buildBaseRwaContractRegistry() {
  const resolved = BASE_RWA_CONTRACTS.filter((record) => record.contractAddress !== null);
  const unresolved = BASE_RWA_CONTRACTS.filter((record) => record.contractAddress === null);

  return {
    sourceDate: "2026-11-23",
    chain: "base",
    chainId: 8453,
    records: BASE_RWA_CONTRACTS,
    summary: {
      records: BASE_RWA_CONTRACTS.length,
      addressesResolved: resolved.length,
      issuerPublished: BASE_RWA_CONTRACTS.filter(
        (record) => record.status === "issuer_published",
      ).length,
      docsAndExplorerMatched: BASE_RWA_CONTRACTS.filter(
        (record) => record.status === "docs_and_explorer_match",
      ).length,
      explorerLabelledAwaitingIssuer: BASE_RWA_CONTRACTS.filter(
        (record) => record.status === "explorer_labelled_needs_issuer_confirmation",
      ).length,
      unresolvedConflicts: unresolved.length,
      alternateAddressWarnings: BASE_RWA_CONTRACTS.filter(
        (record) => record.contractAddress !== null && record.contractAddressCandidates.length > 0,
      ).length,
      deepDivedRecords: BASE_RWA_CONTRACTS.filter(
        (record) => (record.diligenceFindings?.length ?? 0) > 0,
      ).length,
      diligenceFindingCount: BASE_RWA_CONTRACTS.reduce(
        (count, record) => count + (record.diligenceFindings?.length ?? 0),
        0,
      ),
      onchainCodeVerification: "not_started",
    },
    coverage: {
      automatedContractDiscovery: false,
      onchainCodeVerification: false,
      notes:
        "A source-backed contract register for selected Base RWA products. Full addresses are source-resolved, but live bytecode, token metadata, proxy implementation and current issuer status are not automatically checked by this endpoint.",
    },
    caveats: [
      "Publication of an address does not prove a smart-contract audit, reserves, legal ownership, redemption rights, or investor eligibility.",
      "A proxy implementation can change while the token address remains the same; proxy and administrator permissions must be reviewed separately.",
      "For GromaCoin, the BaseScan link in the official whitepaper is treated as canonical; the different address on Coinbase's price page is retained as an alternative-address warning.",
      "The registry covers selected leading products; it is not a complete contract list for all 97 companies or every product in the RWA Foundation report.",
    ],
  };
}
