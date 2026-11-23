"use client";

import { useEffect, useState } from "react";

type ProxyInspection = {
  standard: "eip1967" | "not_detected" | "rpc_error";
  implementationAddress: string | null;
  implementationBytecodePresent: boolean | null;
  adminAddress: string | null;
  beaconAddress: string | null;
  beaconBytecodePresent: boolean | null;
  beaconImplementationAddress: string | null;
  beaconImplementationBytecodePresent: boolean | null;
  notes: string[];
};

type GldyLiveControls = {
  checkedAt: string;
  whitelistEnabled: boolean | null;
  paused: boolean | null;
  useChainlinkPoR: boolean | null;
  allowOracleFallback: boolean | null;
  chainlinkPoRFeedAddress: string | null;
  porDecimals: number | null;
  manualReserveAmountRaw: string | null;
  manualReserveAmount: string | null;
  manualReserveTimestamp: string | null;
  roleCandidates: {
    role: "TREASURY_ROLE" | "DEFAULT_ADMIN_ROLE" | "OPERATOR_ROLE";
    address: string;
    isMember: boolean | null;
  }[];
  safeWallets: {
    role: "TREASURY_ROLE" | "DEFAULT_ADMIN_ROLE";
    address: string;
    bytecodePresent: boolean | null;
    threshold: number | null;
    owners: string[] | null;
  }[];
  chainlinkFeed: {
    address: string;
    decimals: number | null;
    answerRaw: string | null;
    answer: string | null;
    updatedAt: string | null;
    ageSeconds: number | null;
  } | null;
  notes: string[];
};

type ContractCheck = {
  recordId: string;
  contractAddress: string;
  checkedAt: string;
  bytecodePresent: boolean | null;
  onchainSupply: string | null;
  decimals: number | null;
  proxy: ProxyInspection | null;
  gldyControls: GldyLiveControls | null;
  status: "code_present" | "no_code" | "rpc_error";
  notes: string[];
};

type ContractRecord = {
  id: string;
  assetName: string;
  symbol: string | null;
  contractAddress: string | null;
  onchainVerification: ContractCheck | null;
};

type ApiResponse = {
  records: ContractRecord[];
  liveVerification: {
    checkedAt: string | null;
    cacheState: "fresh" | "refreshed" | "stale_fallback";
    progress: {
      eligibleContracts: number;
      checkedContracts: number;
      pendingContracts: number;
      checkedThisRefresh: number;
      bytecodePresentCount: number;
      noCodeCount: number;
      rpcErrorCount: number;
      batchSize: number;
      cursorIndex: number;
    };
    caveats: string[];
    refreshError?: string;
  };
};

function formatTime(value: string | null) {
  if (!value) return "Not checked yet";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Istanbul",
  }).format(time);
}

function yesNoUnknown(value: boolean | null) {
  if (value === true) return "Bulundu";
  if (value === false) return "Not found";
  return "Could Not Verify";
}

export default function ContractLiveStatus() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/agent/contracts", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            payload &&
              typeof payload === "object" &&
              "error" in payload &&
              typeof payload.error === "string"
              ? payload.error
              : "Unable to retrieve contract verification data.",
          );
        }
        setData(payload as ApiResponse);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unknown connection error.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">
        Loading the latest contract checks from Base…
      </div>
    );
  }

  if (error || !data?.liveVerification) {
    return (
      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p className="text-sm font-medium text-amber-100">Live verification data is unavailable</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">
          {error ?? "The API response did not include verification data."}
        </p>
        <a
          href="/api/agent/contracts"
          className="mt-3 inline-block text-xs text-blue-200 underline underline-offset-4"
        >
          Open the contract API
        </a>
      </div>
    );
  }

  const verification = data.liveVerification;
  const progress = verification.progress;
  const percentage =
    progress.eligibleContracts > 0
      ? Math.round(
          (progress.checkedContracts / progress.eligibleContracts) * 100,
        )
      : 0;
  const checkedRecords = data.records.filter(
    (record) => record.onchainVerification !== null,
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Onchain Verification Progress</p>
            <p className="mt-1 text-xs text-slate-400">
              Last checked: {formatTime(verification.checkedAt)}
            </p>
          </div>
          <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300">
            {verification.cacheState === "fresh"
              ? "Cache is fresh"
              : verification.cacheState === "refreshed"
                ? "New checks completed"
                : "Using previous results"}
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {progress.checkedContracts}/{progress.eligibleContracts}
            <span className="ml-2 text-sm font-normal text-slate-400">contracts checked</span>
          </p>
          <p className="text-sm font-semibold text-blue-200 tabular-nums">%{percentage}</p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Contract verification progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className="h-full rounded-full bg-blue-400 transition-all"
            style={{ width: percentage + "%" }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric label="Bytecode found" value={progress.bytecodePresentCount} />
          <MiniMetric label="No bytecode" value={progress.noCodeCount} />
          <MiniMetric label="RPC error" value={progress.rpcErrorCount} />
          <MiniMetric label="Pending" value={progress.pendingContracts} />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          Up to {progress.batchSize} contracts are checked per refresh.
          Bu yenilemede {progress.checkedThisRefresh} new checks completed in this refresh.
        </p>
        {verification.refreshError ? (
          <p className="mt-2 text-xs leading-5 text-amber-200">
            Refresh note: {verification.refreshError}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {checkedRecords.length === 0 ? (
          <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">
            No contract check results are available yet.
          </p>
        ) : (
          checkedRecords.map((record) => {
            const check = record.onchainVerification;
            if (!check) return null;
            const proxy = check.proxy;
            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-slate-950/25 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white">
                      {record.assetName}
                      {record.symbol ? (
                        <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                          {record.symbol}
                        </span>
                      ) : null}
                    </h4>
                    <p className="mt-1 break-all font-mono text-xs text-slate-400">
                      {check.contractAddress}
                    </p>
                  </div>
                  <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                    {check.status === "code_present"
                      ? "Bytecode found"
                      : check.status === "no_code"
                        ? "Bytecode not found"
                        : "RPC error"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoLine label="Onchain Supply" value={check.onchainSupply ?? "Unreadable"} />
                  <InfoLine
                    label="Decimals"
                    value={check.decimals === null ? "Unreadable" : String(check.decimals)}
                  />
                  <InfoLine
                    label="EIP-1967 proxy"
                    value={
                      proxy?.standard === "eip1967"
                        ? "Detected"
                        : proxy?.standard === "not_detected"
                          ? "Not detected in standard slots"
                          : proxy?.standard === "rpc_error"
                            ? "Storage slot could not be read"
                            : "Not checked"
                    }
                  />
                  <InfoLine
                    label="Implementation bytecode"
                    value={yesNoUnknown(proxy?.implementationBytecodePresent ?? null)}
                  />
                </div>

                {proxy?.implementationAddress ? (
                  <InfoLine label="Implementation Address" value={proxy.implementationAddress} mono />
                ) : null}
                {proxy?.adminAddress ? (
                  <InfoLine label="Proxy Admin Address" value={proxy.adminAddress} mono />
                ) : null}
                {proxy?.beaconAddress ? (
                  <InfoLine label="Beacon Address" value={proxy.beaconAddress} mono />
                ) : null}
                {proxy?.beaconImplementationAddress ? (
                  <InfoLine
                    label="Beacon implementation"
                    value={
                      proxy.beaconImplementationAddress +
                      " · bytecode " +
                      yesNoUnknown(proxy.beaconImplementationBytecodePresent)
                    }
                    mono
                  />
                ) : null}

                {check.gldyControls ? (
                  <div className="mt-4 rounded-xl border border-amber-200/15 bg-amber-100/[0.025] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-sm font-semibold text-amber-100">GLDY Live Permissions and Reserve Feed Checks</h5>
                      <span className="text-xs text-slate-400">
                        {formatTime(check.gldyControls.checkedAt)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <InfoLine label="Transfer Whitelist" value={yesNoUnknown(check.gldyControls.whitelistEnabled)} />
                      <InfoLine label="Contract Paused" value={yesNoUnknown(check.gldyControls.paused)} />
                      <InfoLine label="Chainlink PoR Enabled" value={yesNoUnknown(check.gldyControls.useChainlinkPoR)} />
                      <InfoLine label="Oracle Fallback Allowed" value={yesNoUnknown(check.gldyControls.allowOracleFallback)} />
                      <InfoLine label="PoR Decimals" value={check.gldyControls.porDecimals === null ? "Unreadable" : String(check.gldyControls.porDecimals)} />
                      <InfoLine label="Manual Reserve Timestamp" value={check.gldyControls.manualReserveTimestamp ?? "Unreadable"} />
                      <InfoLine label="Manual Reserve Amount (raw)" value={check.gldyControls.manualReserveAmountRaw ?? "Unreadable"} />
                      <InfoLine label="Manual Reserve Amount (scaled)" value={check.gldyControls.manualReserveAmount ?? "Unreadable"} />
                    </div>

                    {check.gldyControls.chainlinkPoRFeedAddress ? (
                      <InfoLine label="Chainlink PoR Feed" value={check.gldyControls.chainlinkPoRFeedAddress} mono />
                    ) : null}

                    {check.gldyControls.chainlinkFeed ? (
                      <div className="mt-3 rounded-lg border border-white/10 p-3">
                        <p className="text-xs font-semibold text-white">Latest Chainlink Feed Reading</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <InfoLine label="Feed Value (as Reported)" value={check.gldyControls.chainlinkFeed.answer ?? "Unreadable"} />
                          <InfoLine label="Feed Decimals" value={check.gldyControls.chainlinkFeed.decimals === null ? "Unreadable" : String(check.gldyControls.chainlinkFeed.decimals)} />
                          <InfoLine label="Last Updated" value={check.gldyControls.chainlinkFeed.updatedAt ?? "Unreadable"} />
                          <InfoLine label="Data Age" value={check.gldyControls.chainlinkFeed.ageSeconds === null ? "Unreadable" : (check.gldyControls.chainlinkFeed.ageSeconds.toLocaleString("en-US") + " seconds")} />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <p className="text-xs font-semibold text-white">Live Membership of Known Role Addresses</p>
                      <div className="mt-2 space-y-2">
                        {check.gldyControls.roleCandidates.map((candidate) => (
                          <div key={candidate.role} className="rounded-lg border border-white/10 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-200">{candidate.role}</span>
                              <span className="text-xs text-slate-300">
                                {candidate.isMember === true
                                  ? "Role Member"
                                  : candidate.isMember === false
                                    ? "Not a Member of This Role"
                                    : "Could Not Verify"}
                              </span>
                            </div>
                            <p className="mt-1 break-all font-mono text-xs text-slate-400">{candidate.address}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-white">Safe Multisig Configuration</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {check.gldyControls.safeWallets.map((safe) => (
                          <div key={safe.role} className="rounded-lg border border-white/10 p-3">
                            <p className="text-xs font-semibold text-slate-200">{safe.role}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-400">{safe.address}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <InfoLine label="Bytecode" value={yesNoUnknown(safe.bytecodePresent)} />
                              <InfoLine label="Threshold" value={safe.threshold === null ? "Unreadable" : safe.threshold + " signatures"} />
                              <InfoLine label="Owner Count" value={safe.owners === null ? "Unreadable" : String(safe.owners.length)} />
                            </div>
                            {safe.owners && safe.owners.length > 0 ? (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-blue-200">Owner Addresses</summary>
                                <ul className="mt-2 space-y-1">
                                  {safe.owners.map((owner) => (
                                    <li key={owner} className="break-all font-mono text-xs text-slate-400">{owner}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {check.gldyControls.notes.length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                        {check.gldyControls.notes.map((note, index) => <li key={index}>{note}</li>)}
                      </ul>
                    ) : null}
                    <p className="mt-3 text-xs leading-5 text-amber-100/80">
                      Role checks test the known candidate addresses published by Pharos; they do not enumerate every role holder. Safe owners and thresholds are read onchain, but Safe modules, guards, and operational security require separate review. The Chainlink feed value is not an independent proof of reserves.
                    </p>
                  </div>
                ) : null}

                {check.notes.length > 0 || proxy?.notes.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                    {[...check.notes, ...(proxy?.notes ?? [])].map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <p className="text-xs leading-5 text-slate-400">
        These checks are onchain technical indicators only. The presence of bytecode or an implementation does not prove that the code is secure, and an admin address does not prove that its controller is trustworthy.
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function InfoLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={"mt-1 break-all text-xs text-slate-200" + (mono ? " font-mono" : "")}>
        {value}
      </p>
    </div>
  );
}
