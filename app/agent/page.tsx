import type { Metadata } from "next";

import ContractLiveStatus from "@/app/agent/contract-live-status";

import {
  BASE_BUILDER_GROUPS,
  BASE_RWA_RESEARCH_METRICS,
  buildBaseBuilderMap,
} from "@/lib/server/base-builder-map";
import {
  buildBaseRwaContractRegistry,
  type RwaContractStatus,
  type RwaDiligenceFinding,
} from "@/lib/server/base-rwa-contract-registry";

export const metadata: Metadata = {
  title: "Base Opportunity Agent | Base Daily",
  description:
    "A read-only research dashboard for the Base ecosystem, real-world assets, companies, and contracts.",
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const contractStatusLabels: Record<RwaContractStatus, string> = {
  issuer_published: "Published in issuer documentation",
  docs_and_explorer_match: "Official documentation matches BaseScan",
  explorer_labelled_needs_issuer_confirmation: "Labeled by BaseScan; issuer confirmation pending",
  conflicting_sources: "Conflicting sources",
  awaiting_primary_source: "Awaiting primary source",
};

const diligenceTopicLabels: Record<RwaDiligenceFinding["topic"], string> = {
  "source-code": "Source Code and Verification",
  "smart-contract-controls": "Smart Contract Controls",
  governance: "Governance and Permissions",
  "redemption-liquidity": "Redemption and Liquidity",
  reserves: "Reserves and Collateral",
  yield: "Yield",
};

const diligenceEvidenceLabels: Record<RwaDiligenceFinding["evidenceType"], string> = {
  source_code_verification: "Source Code Verification",
  issuer_disclosure: "Issuer Disclosure",
  issuer_filing: "Issuer Filing",
  third_party_onchain_review: "Third-Party Onchain Review",
  third_party_risk_review: "Third-Party Risk Assessment",
};

const relationshipHighlights = [
  {
    title: "Tokenized Stocks → Aave",
    detail:
      "Coinbase tokenized stocks can be used as collateral in Aave Equities Hub by eligible investors.",
  },
  {
    title: "Centrifuge → DeFi Markets",
    detail:
      "deSPXA is reported to trade on Uniswap and Aerodrome and can serve as collateral for USDC borrowing through Morpho vaults.",
  },
  {
    title: "Bitwise → Glider",
    detail:
      "Bitwise designs model portfolios; Glider executes transactions in the investor’s own wallet within the permissions granted.",
  },
  {
    title: "JPMorgan → Institutional Payment Tests",
    detail:
      "The report identifies B2C2, Coinbase, and Mastercard as participants in JPM Coin test transactions.",
  },
];

export default function BaseOpportunityAgentPage() {
  const map = buildBaseBuilderMap();
  const contractRegistry = buildBaseRwaContractRegistry();
  const buildersByGroup = BASE_BUILDER_GROUPS.map((group) => ({
    ...group,
    count: map.builders.filter((builder) => builder.group === group.id).length,
    samples: map.builders
      .filter((builder) => builder.group === group.id)
      .slice(0, 5),
  }));

  const growthLeaders = BASE_RWA_RESEARCH_METRICS.growthLeaders;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-10 text-white sm:px-8 lg:px-10">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-9 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            READ-ONLY RESEARCH
          </div>
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-200/70">
            Base Daily / Intelligence
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Base Opportunity Agent
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            A research dashboard mapping companies that issue assets, build payment
            infrastructure and markets, and provide technical services across Base,
            together with their ecosystem relationships.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/agent/builders"
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-blue-300/60 hover:bg-white/5"
          >
            Company Map JSON
          </a>
          <a
            href="/api/agent/opportunities"
            className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Opportunity Report
          </a>
        </div>
      </header>

      <section className="grid gap-3 py-8 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Distributed RWA"
          value={formatUsd(BASE_RWA_RESEARCH_METRICS.distributedRwa.valueUsd)}
          detail={`+%${BASE_RWA_RESEARCH_METRICS.distributedRwa.change30dPercent}`}
        />
        <MetricCard
          label="RWA Holder Addresses"
          value={BASE_RWA_RESEARCH_METRICS.distributedRwa.holders.toLocaleString("en-US")}
          detail={`+%${BASE_RWA_RESEARCH_METRICS.distributedRwa.holdersChange30dPercent}`}
        />
        <MetricCard
          label="Stablecoin Supply"
          value={formatUsd(BASE_RWA_RESEARCH_METRICS.stablecoinSupplyUsd)}
          detail="Measured separately from distributed RWA"
        />
        <MetricCard
          label="Lending Market Supply"
          value={formatUsd(BASE_RWA_RESEARCH_METRICS.lendingMarkets.suppliedUsd)}
          detail={`${formatUsd(BASE_RWA_RESEARCH_METRICS.lendingMarkets.borrowedUsd)} borrowed`}
        />
      </section>

      <p className="mb-8 text-xs leading-5 text-slate-400">
        Source snapshot: 23 November 2026. Data comes from the RWA Foundation report
        and the analytics providers it cites. Distributed RWA, represented assets,
        stablecoin supply, lending balances, and protocol TVL use different definitions
        and must not be added together.
      </p>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-200">Market Activity</p>
              <h2 className="mt-1 text-2xl font-semibold">Largest Reported Growth Segments</h2>
            </div>
            <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-300">
              30-Day Snapshot
            </span>
          </div>
          <div className="mt-6 space-y-5">
            {growthLeaders.map((leader) => (
              <div key={leader.name} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{leader.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{leader.note}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums">
                  {formatUsd(leader.valueUsd)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
          <p className="text-sm font-medium text-blue-200">Research Coverage</p>
          <h2 className="mt-1 text-2xl font-semibold">Company and Project Universe</h2>
          <p className="mt-3 text-4xl font-semibold tabular-nums">
            {map.coverage.namedBuilderRecords}
            <span className="ml-2 text-base font-normal text-slate-400">records</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {map.coverage.relationshipRecords} reported integrations, partnerships,
            trading routes, and collateral relationships.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/api/agent/rwa" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5">
              Live RWA Data
            </a>
            <a href="/api/agent/tokenized-stocks" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5">
              Tokenized Stocks
            </a>
            <a href="/api/agent/report" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5">
              Base Daily Status
            </a>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <p className="text-sm font-medium text-blue-200">Ecosystem Structure</p>
          <h2 className="mt-1 text-2xl font-semibold">Who Is Building on Base?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Companies are grouped by the roles described in the source report.
            Inclusion is discovery evidence, not an endorsement of security, quality,
            or investment merit.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {buildersByGroup.map((group) => (
            <div
              key={group.id}
              className="rounded-2xl border border-white/10 bg-slate-950/30 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-5">{group.title}</h3>
                <span className="rounded-md bg-blue-400/10 px-2 py-1 text-xs font-semibold text-blue-200">
                  {group.count}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{group.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.samples.map((builder) => (
                  <span
                    key={builder.id}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200"
                  >
                    {builder.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-slate-950/35 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-200">Base Mainnet</p>
            <h2 className="mt-1 text-2xl font-semibold">RWA Contract Registry</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Selected product addresses published in issuer and protocol documentation.
              Source verification does not mean that onchain bytecode checks or smart-contract
              security reviews have been completed.
            </p>
          </div>
          <a href="/api/agent/contracts" className="shrink-0 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-100 hover:bg-white/5">
            Contract Registry and Live Checks
          </a>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Products" value={String(contractRegistry.summary.records)} detail="Selected Base RWA products" />
          <MetricCard label="Addresses Matched to Sources" value={String(contractRegistry.summary.addressesResolved)} detail="Base contract address identified" />
          <MetricCard label="Issuer Documentation" value={String(contractRegistry.summary.issuerPublished)} detail="Official deployment or product source" />
          <MetricCard label="Alternative Address Warning" value={String(contractRegistry.summary.alternateAddressWarnings)} detail="A secondary source lists a different GromaCoin address" />
          <MetricCard label="Due Diligence Findings" value={String(contractRegistry.summary.diligenceFindingCount)} detail={`${contractRegistry.summary.deepDivedRecords} products with sourced due-diligence findings`} />
        </div>
        <ContractLiveStatus />
        <div className="mt-6 space-y-3">
          {contractRegistry.records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{record.assetName}</h3>
                    {record.symbol ? <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-200">{record.symbol}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{record.issuer}</p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-300">
                    {record.contractAddress ?? "Contract address not resolved"}
                  </p>
                </div>
                <span className="w-fit max-w-full rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300">
                  {contractStatusLabels[record.status]}
                </span>
              </div>
              {record.contractAddressCandidates.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
                  <p className="text-xs font-semibold text-amber-100">Conflicting Address Sources</p>
                  {record.contractAddressCandidates.map((candidate) => (
                    <p key={candidate.address} className="mt-2 break-all text-xs leading-5 text-slate-300">
                      {candidate.sourceName}: <span className="font-mono">{candidate.address}</span>
                    </p>
                  ))}
                </div>
              ) : null}
              {record.accessNotes.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                  {record.accessNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              ) : null}
              {record.diligenceFindings && record.diligenceFindings.length > 0 ? (
                <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-100">
                    Detailed Due Diligence ({record.diligenceFindings.length} findings)
                  </summary>
                  <div className="mt-3 space-y-3">
                    {record.diligenceFindings.map((finding) => (
                      <div key={finding.id} className="rounded-xl border border-white/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {diligenceTopicLabels[finding.topic]}
                          </p>
                          <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-300">
                            {finding.asOf}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-blue-200">
                          {diligenceEvidenceLabels[finding.evidenceType]} · {finding.sourceName}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{finding.finding}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          Limitation: {finding.limitation}
                        </p>
                        <a
                          href={finding.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-blue-200 underline underline-offset-4"
                        >
                          Open Source
                        </a>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                {record.explorerUrl ? <a href={record.explorerUrl} target="_blank" rel="noreferrer" className="text-blue-200 underline underline-offset-4">View on BaseScan</a> : null}
                <a href={record.primarySourceUrl} target="_blank" rel="noreferrer" className="text-blue-200 underline underline-offset-4">Source Documentation</a>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">
          Bytecode, totalSupply(), decimals(), and EIP-1967 proxy checks run through the /api/agent/contracts
          endpoint, with up to three products checked per refresh. These checks are not security
          audits. The BaseScan address linked from Groma's official technical documentation is
          treated as canonical; Coinbase's different price-page address is shown as unverified.
        </p>
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-slate-950/35 p-6">
        <p className="text-sm font-medium text-blue-200">Connected Use Cases</p>
        <h2 className="mt-1 text-2xl font-semibold">From Asset to Utility</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {relationshipHighlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Data Measurement Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Distributed RWA: {formatUsd(BASE_RWA_RESEARCH_METRICS.distributedRwa.valueUsd)}.</li>
            <li>Represented assets: {formatUsd(BASE_RWA_RESEARCH_METRICS.representedRwa.valueUsd)}; recordkeeping only.</li>
            <li>DefiLlama Active RWA AUM: {formatUsd(BASE_RWA_RESEARCH_METRICS.defillamaActiveRwaAumUsd)}.</li>
            <li>Stablecoin supply and lending balances are tracked separately.</li>
            <li>Protocol, curator, vault, and collateral values may count the same underlying asset more than once.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Agent Safety Boundaries</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Research-only mode. No private keys, wallet signatures, or contract write operations.</li>
            <li>Company relationships represent reported integrations, not common ownership.</li>
            <li>Market value is not executable liquidity or redemption capacity.</li>
            <li>No activity is presented as a confirmed Base airdrop criterion.</li>
          </ul>
        </div>
      </section>

      <footer className="mt-10 border-t border-white/10 py-6 text-xs leading-5 text-slate-400">
        Research source:{" "}
        <a
          href={map.source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-200 underline underline-offset-4"
        >
          RWA Foundation — Who Is Building on Base?
        </a>
        . Last reviewed: 23 November 2026. Before acting, verify issuer terms, custody,
        investor eligibility, liquidity, and contract addresses against current primary sources.
      </footer>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
