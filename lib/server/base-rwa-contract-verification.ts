import { randomUUID } from "node:crypto";

import { keccak256, stringToHex, toFunctionSelector } from "viem";

import { redis } from "@/lib/server/redis";
import { buildBaseRwaContractRegistry } from "@/lib/server/base-rwa-contract-registry";

const DEFAULT_BASE_RPC_URL = "https://base-rpc.publicnode.com";
const CACHE_KEY = "base-opportunity-agent:rwa-contract-verification:v3";
const CURSOR_KEY = "base-opportunity-agent:rwa-contract-verification-cursor:v3";
const LOCK_KEY = "base-opportunity-agent:rwa-contract-verification-lock";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const FRESH_FOR_SECONDS = 60 * 15;
const MAX_CHECKS_PER_REFRESH = 3;
const RPC_TIMEOUT_MS = 2_500;
const RPC_INTERVAL_MS = 260;

type RpcResponse = {
  result?: string;
  error?: { code?: number; message?: string };
};

export type Eip1967ProxyInspection = {
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

export type GldyLiveControls = {
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

export type RwaContractVerification = {
  recordId: string;
  contractAddress: string;
  checkedAt: string;
  bytecodePresent: boolean | null;
  onchainSupplyRaw: string | null;
  decimals: number | null;
  onchainSupply: string | null;
  proxy: Eip1967ProxyInspection | null;
  gldyControls: GldyLiveControls | null;
  status: "code_present" | "no_code" | "rpc_error";
  notes: string[];
};

type VerificationCache = {
  checkedAt: string;
  byRecordId: Record<string, RwaContractVerification>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toHexUint(value: string | undefined): bigint | null {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return BigInt(value);
}

function formatUnits(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const padded = raw.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fractional = padded.slice(-decimals).replace(/0+$/, "");
  return fractional ? whole + "." + fractional : whole;
}

let rpcCallCount = 0;
let nextRpcStartAt = 0;

async function rpc(method: string, params: unknown[]): Promise<string> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextRpcStartAt);
  nextRpcStartAt = scheduledAt + RPC_INTERVAL_MS;
  if (scheduledAt > now) {
    await new Promise((resolve) => setTimeout(resolve, scheduledAt - now));
  }
  rpcCallCount += 1;

  const response = await fetch(
    process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcCallCount,
        method,
        params,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Base RPC request failed (" + response.status + ").");
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error("Base RPC returned an invalid JSON-RPC response.");
  }

  if (isRecord(payload.error)) {
    const message =
      typeof payload.error.message === "string"
        ? payload.error.message
        : "Unknown JSON-RPC error.";
    throw new Error(message);
  }

  if (typeof payload.result !== "string") {
    throw new Error("Base RPC response did not contain a result field.");
  }

  return payload.result;
}

type RpcBatchCall = {
  key: string;
  method: string;
  params: unknown[];
};

type RpcBatchValue = {
  result?: string;
  error?: string;
};

async function rpcBatch(calls: RpcBatchCall[]): Promise<Map<string, RpcBatchValue>> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextRpcStartAt);
  nextRpcStartAt = scheduledAt + RPC_INTERVAL_MS;
  if (scheduledAt > now) {
    await new Promise((resolve) => setTimeout(resolve, scheduledAt - now));
  }

  const requestIds = new Map<number, string>();
  const requests = calls.map((call) => {
    const id = ++rpcCallCount;
    requestIds.set(id, call.key);
    return {
      jsonrpc: "2.0",
      id,
      method: call.method,
      params: call.params,
    };
  });

  const response = await fetch(
    process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    },
  );

  if (!response.ok) {
    throw new Error("Base RPC batch request failed (" + response.status + ").");
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    // Some public RPC providers disable JSON-RPC batching. Fall back to
    // bounded individual reads rather than failing the entire GLDY record.
    const fallback = new Map<string, RpcBatchValue>();
    for (const call of calls) {
      try {
        fallback.set(call.key, {
          result: await rpc(call.method, call.params),
        });
      } catch (error) {
        fallback.set(call.key, {
          error:
            error instanceof Error ? error.message : "Unknown RPC error.",
        });
      }
    }
    return fallback;
  }

  const output = new Map<string, RpcBatchValue>();
  for (const item of payload) {
    if (!isRecord(item) || typeof item.id !== "number") continue;
    const key = requestIds.get(item.id);
    if (!key) continue;
    if (isRecord(item.error)) {
      output.set(key, {
        error:
          typeof item.error.message === "string"
            ? item.error.message
            : "Unknown JSON-RPC error.",
      });
    } else if (typeof item.result === "string") {
      output.set(key, { result: item.result });
    } else {
      output.set(key, { error: "Batch RPC response is missing a result field." });
    }
  }

  for (const call of calls) {
    if (!output.has(call.key)) {
      output.set(call.key, { error: "Batch RPC response did not include a result for this query." });
    }
  }

  return output;
}

function readBatchResult(
  values: Map<string, RpcBatchValue>,
  key: string,
  notes: string[],
): string | null {
  const value = values.get(key);
  if (!value?.result) {
    notes.push(
      key + " query could not be read: " + (value?.error ?? "No response."),
    );
    return null;
  }
  return value.result;
}

function boolFromHex(value: string | null): boolean | null {
  const decoded = toHexUint(value ?? undefined);
  return decoded === null ? null : decoded !== BigInt(0);
}

function formatSignedUnits(raw: bigint, decimals: number): string {
  return formatUnits(raw, decimals);
}

function decodeAbiAddressArray(value: string | null): string[] | null {
  if (!value || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const data = value.slice(2);
  if (data.length < 128 || data.length % 64 !== 0) return null;

  try {
    const offsetBytes = Number(BigInt("0x" + data.slice(0, 64)));
    if (!Number.isSafeInteger(offsetBytes) || offsetBytes < 0) return null;
    const arrayStart = offsetBytes * 2;
    if (arrayStart + 64 > data.length) return null;
    const countBig = BigInt("0x" + data.slice(arrayStart, arrayStart + 64));
    if (countBig > BigInt(100)) return null;
    const count = Number(countBig);
    const owners: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const start = arrayStart + 64 + index * 64;
      const word = data.slice(start, start + 64);
      if (word.length !== 64) return null;
      const address = "0x" + word.slice(-40);
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
      owners.push(address);
    }
    return owners;
  } catch {
    return null;
  }
}

async function inspectGldyLiveControls(
  tokenProxyAddress: string,
): Promise<GldyLiveControls> {
  const checkedAt = new Date().toISOString();
  const notes: string[] = [];
  const treasuryRole = keccak256(stringToHex("TREASURY_ROLE"));
  const operatorRole = keccak256(stringToHex("OPERATOR_ROLE"));
  const defaultAdminRole = "0x" + "0".repeat(64);
  const roleCandidates = [
    {
      role: "TREASURY_ROLE" as const,
      roleId: treasuryRole,
      address: "0xaab923eefe8f3264d08b4610c6969d6d98104165",
    },
    {
      role: "DEFAULT_ADMIN_ROLE" as const,
      roleId: defaultAdminRole,
      address: "0x05ed6826524ebe9f3df837b06803ff797f4e2130",
    },
    {
      role: "OPERATOR_ROLE" as const,
      roleId: operatorRole,
      address: "0xa50fc96f444c2922ca80cc7e56fd8e10633ce983",
    },
  ];

  const hasRoleSelector = toFunctionSelector("hasRole(bytes32,address)");
  const pausedSelector = toFunctionSelector("paused()");
  const getThresholdSelector = toFunctionSelector("getThreshold()");
  const getOwnersSelector = toFunctionSelector("getOwners()");
  const safeCandidates = [
    {
      role: "TREASURY_ROLE" as const,
      address: "0xaab923eefe8f3264d08b4610c6969d6d98104165",
    },
    {
      role: "DEFAULT_ADMIN_ROLE" as const,
      address: "0x05ed6826524ebe9f3df837b06803ff797f4e2130",
    },
  ];
  const firstBatch = await rpcBatch([
    {
      key: "whitelist",
      method: "eth_getStorageAt",
      params: [tokenProxyAddress, "0x0", "latest"],
    },
    {
      key: "packedConfig",
      method: "eth_getStorageAt",
      params: [tokenProxyAddress, "0x3", "latest"],
    },
    {
      key: "manualReserveAmount",
      method: "eth_getStorageAt",
      params: [tokenProxyAddress, "0x4", "latest"],
    },
    {
      key: "manualReserveTimestamp",
      method: "eth_getStorageAt",
      params: [tokenProxyAddress, "0x5", "latest"],
    },
    {
      key: "paused",
      method: "eth_call",
      params: [{ to: tokenProxyAddress, data: pausedSelector }, "latest"],
    },
    ...roleCandidates.map((candidate, index) => ({
      key: "role-" + index,
      method: "eth_call",
      params: [
        {
          to: tokenProxyAddress,
          data:
            hasRoleSelector +
            candidate.roleId.slice(2) +
            candidate.address.slice(2).toLowerCase().padStart(64, "0"),
        },
        "latest",
      ],
    })),
    ...safeCandidates.flatMap((candidate, index) => [
      {
        key: "safe-" + index + "-code",
        method: "eth_getCode",
        params: [candidate.address, "latest"],
      },
      {
        key: "safe-" + index + "-threshold",
        method: "eth_call",
        params: [
          { to: candidate.address, data: getThresholdSelector },
          "latest",
        ],
      },
      {
        key: "safe-" + index + "-owners",
        method: "eth_call",
        params: [
          { to: candidate.address, data: getOwnersSelector },
          "latest",
        ],
      },
    ]),
  ]);

  const whitelistWord = readBatchResult(firstBatch, "whitelist", notes);
  const packedConfig = readBatchResult(firstBatch, "packedConfig", notes);
  const manualReserveAmountHex = readBatchResult(
    firstBatch,
    "manualReserveAmount",
    notes,
  );
  const manualReserveTimestampHex = readBatchResult(
    firstBatch,
    "manualReserveTimestamp",
    notes,
  );
  const pausedHex = readBatchResult(firstBatch, "paused", notes);

  const whitelistEnabled = boolFromHex(whitelistWord);
  const paused = boolFromHex(pausedHex);
  let chainlinkPoRFeedAddress: string | null = null;
  let porDecimals: number | null = null;
  let useChainlinkPoR: boolean | null = null;
  let allowOracleFallback: boolean | null = null;

  if (packedConfig && /^0x[0-9a-fA-F]{64}$/.test(packedConfig)) {
    const word = BigInt(packedConfig);
    const packedAddress = "0x" + packedConfig.slice(-40);
    if (!/^0x0{40}$/i.test(packedAddress)) {
      chainlinkPoRFeedAddress = packedAddress;
    }
    porDecimals = Number((word >> BigInt(160)) & BigInt("0xff"));
    useChainlinkPoR = ((word >> BigInt(168)) & BigInt("0xff")) !== BigInt(0);
    allowOracleFallback = ((word >> BigInt(176)) & BigInt("0xff")) !== BigInt(0);
  } else if (packedConfig) {
    notes.push("The GLDY configuration slot is not in the expected 32-byte format.");
  }

  const manualReserveAmountRawBig = toHexUint(
    manualReserveAmountHex ?? undefined,
  );
  const manualReserveTimestampBig = toHexUint(
    manualReserveTimestampHex ?? undefined,
  );
  const manualReserveAmountRaw = manualReserveAmountRawBig?.toString() ?? null;
  const manualReserveTimestamp =
    manualReserveTimestampBig !== null &&
    manualReserveTimestampBig > BigInt(0) &&
    manualReserveTimestampBig <= BigInt(8640000000000)
      ? new Date(Number(manualReserveTimestampBig) * 1000).toISOString()
      : null;
  const manualReserveAmount =
    manualReserveAmountRawBig !== null && porDecimals !== null
      ? formatUnits(manualReserveAmountRawBig, porDecimals)
      : null;

  const liveRoles = roleCandidates.map((candidate, index) => ({
    role: candidate.role,
    address: candidate.address,
    isMember: boolFromHex(
      readBatchResult(firstBatch, "role-" + index, notes),
    ),
  }));
  const safeWallets = safeCandidates.map((candidate, index) => {
    const code = readBatchResult(firstBatch, "safe-" + index + "-code", notes);
    const thresholdWord = toHexUint(
      readBatchResult(firstBatch, "safe-" + index + "-threshold", notes) ?? undefined,
    );
    const ownersHex = readBatchResult(
      firstBatch,
      "safe-" + index + "-owners",
      notes,
    );
    const owners = decodeAbiAddressArray(ownersHex);
    if (ownersHex && owners === null) {
      notes.push(candidate.role + " The Safe owner list could not be decoded as ABI data.");
    }
    return {
      role: candidate.role,
      address: candidate.address,
      bytecodePresent:
        code === null ? null : code !== "0x" && code.length > 2,
      threshold:
        thresholdWord !== null && thresholdWord <= BigInt(100)
          ? Number(thresholdWord)
          : null,
      owners,
    };
  });

  let chainlinkFeed: GldyLiveControls["chainlinkFeed"] = null;
  if (chainlinkPoRFeedAddress) {
    try {
      const feedBatch = await rpcBatch([
        {
          key: "feedDecimals",
          method: "eth_call",
          params: [
            { to: chainlinkPoRFeedAddress, data: toFunctionSelector("decimals()") },
            "latest",
          ],
        },
        {
          key: "feedRound",
          method: "eth_call",
          params: [
            { to: chainlinkPoRFeedAddress, data: "0xfeaf968c" },
            "latest",
          ],
        },
      ]);

      const decimalsHex = readBatchResult(feedBatch, "feedDecimals", notes);
      const feedDecimalsWord = toHexUint(decimalsHex ?? undefined);
      const feedDecimals =
        feedDecimalsWord !== null && feedDecimalsWord <= BigInt(255)
          ? Number(feedDecimalsWord)
          : null;
      const round = readBatchResult(feedBatch, "feedRound", notes);

      let answerRaw: bigint | null = null;
      let updatedAtBig: bigint | null = null;
      if (round && /^0x[0-9a-fA-F]{320}$/.test(round)) {
        const answerWord = BigInt("0x" + round.slice(66, 130));
        answerRaw =
          answerWord >= (BigInt(1) << BigInt(255))
            ? answerWord - (BigInt(1) << BigInt(256))
            : answerWord;
        updatedAtBig = BigInt("0x" + round.slice(194, 258));
      } else if (round) {
        notes.push("The Chainlink latestRoundData() response is not in the expected ABI format.");
      }

      const updatedAt =
        updatedAtBig !== null &&
        updatedAtBig > BigInt(0) &&
        updatedAtBig <= BigInt(Number.MAX_SAFE_INTEGER)
          ? new Date(Number(updatedAtBig) * 1000).toISOString()
          : null;
      const ageSeconds =
        updatedAtBig !== null &&
        updatedAtBig > BigInt(0) &&
        updatedAtBig <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Math.max(0, Math.floor(Date.now() / 1000 - Number(updatedAtBig)))
          : null;

      chainlinkFeed = {
        address: chainlinkPoRFeedAddress,
        decimals: feedDecimals,
        answerRaw: answerRaw?.toString() ?? null,
        answer:
          answerRaw !== null && feedDecimals !== null
            ? formatSignedUnits(answerRaw, feedDecimals)
            : null,
        updatedAt,
        ageSeconds,
      };
      notes.push(
        "According to Pharos's review, the Chainlink PoR feed carries the reserve ounces reported by the issuer; this query reads the feed data and does not provide an independent reserve attestation.",
      );
    } catch (error) {
      notes.push(
        "Chainlink PoR feed query failed: " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
    }
  } else {
    notes.push("No Chainlink PoR feed address was found in the GLDY configuration slot.");
  }

  return {
    checkedAt,
    whitelistEnabled,
    paused,
    useChainlinkPoR,
    allowOracleFallback,
    chainlinkPoRFeedAddress,
    porDecimals,
    manualReserveAmountRaw,
    manualReserveAmount,
    manualReserveTimestamp,
    roleCandidates: liveRoles,
    safeWallets,
    chainlinkFeed,
    notes,
  };
}

const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const EIP1967_BEACON_SLOT =
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

function decodeStorageAddress(value: string | null): string | null {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  const address = "0x" + value.slice(-40);
  return /^0x0{40}$/i.test(address) ? null : address;
}

async function inspectEip1967Proxy(
  address: string,
): Promise<Eip1967ProxyInspection> {
  const notes: string[] = [];
  const readSlot = async (slot: string) => {
    try {
      return await rpc("eth_getStorageAt", [address, slot, "latest"]);
    } catch (error) {
      notes.push(
        "Unable to read EIP-1967 storage slot: " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
      return null;
    }
  };

  const [implementationSlot, adminSlot, beaconSlot] = await Promise.all([
    readSlot(EIP1967_IMPLEMENTATION_SLOT),
    readSlot(EIP1967_ADMIN_SLOT),
    readSlot(EIP1967_BEACON_SLOT),
  ]);

  if (
    implementationSlot === null &&
    adminSlot === null &&
    beaconSlot === null
  ) {
    return {
      standard: "rpc_error",
      implementationAddress: null,
      implementationBytecodePresent: null,
      adminAddress: null,
      beaconAddress: null,
      beaconBytecodePresent: null,
      beaconImplementationAddress: null,
      beaconImplementationBytecodePresent: null,
      notes,
    };
  }

  const implementationAddress = decodeStorageAddress(implementationSlot);
  const adminAddress = decodeStorageAddress(adminSlot);
  const beaconAddress = decodeStorageAddress(beaconSlot);
  const detected = Boolean(
    implementationAddress || adminAddress || beaconAddress,
  );

  let implementationBytecodePresent: boolean | null = null;
  if (implementationAddress) {
    try {
      const implementationCode = await rpc("eth_getCode", [
        implementationAddress,
        "latest",
      ]);
      implementationBytecodePresent =
        implementationCode !== "0x" && implementationCode.length > 2;
      if (!implementationBytecodePresent) {
        notes.push("No bytecode was found at the EIP-1967 implementation address.");
      }
    } catch (error) {
      notes.push(
        "Implementation bytecode check failed: " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
    }
  }

  let beaconBytecodePresent: boolean | null = null;
  let beaconImplementationAddress: string | null = null;
  let beaconImplementationBytecodePresent: boolean | null = null;
  if (beaconAddress) {
    try {
      const beaconCode = await rpc("eth_getCode", [beaconAddress, "latest"]);
      beaconBytecodePresent = beaconCode !== "0x" && beaconCode.length > 2;
      if (!beaconBytecodePresent) {
        notes.push("No bytecode was found at the EIP-1967 beacon address.");
      } else {
        // EIP-1967 beacon contracts expose implementation() (0x5c60da1b).
        const implementationResult = await rpc("eth_call", [
          { to: beaconAddress, data: "0x5c60da1b" },
          "latest",
        ]);
        beaconImplementationAddress = decodeStorageAddress(implementationResult);
        if (beaconImplementationAddress) {
          const implementationCode = await rpc("eth_getCode", [
            beaconImplementationAddress,
            "latest",
          ]);
          beaconImplementationBytecodePresent =
            implementationCode !== "0x" && implementationCode.length > 2;
          if (!beaconImplementationBytecodePresent) {
            notes.push("No bytecode was found at the implementation address reported by the beacon.");
          }
        } else {
          notes.push("A valid address could not be read from the beacon implementation() call.");
        }
      }
    } catch (error) {
      notes.push(
        "Beacon or implementation check failed: " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
    }
  }

  if (!detected) {
    notes.push(
      "No address was found in the EIP-1967 implementation, admin, or beacon slots. This does not mean the contract is not a proxy; other proxy standards require separate inspection.",
    );
  } else {
    notes.push(
      "Proxy components were read from EIP-1967 slots. This check does not establish that the proxy administrator is trustworthy or that the implementation code is secure.",
    );
  }

  return {
    standard: detected ? "eip1967" : "not_detected",
    implementationAddress,
    implementationBytecodePresent,
    adminAddress,
    beaconAddress,
    beaconBytecodePresent,
    beaconImplementationAddress,
    beaconImplementationBytecodePresent,
    notes,
  };
}

function unavailableGldyControls(error: unknown): GldyLiveControls {
  const reason =
    error instanceof Error ? error.message : "Unknown Base RPC error.";
  return {
    checkedAt: new Date().toISOString(),
    whitelistEnabled: null,
    paused: null,
    useChainlinkPoR: null,
    allowOracleFallback: null,
    chainlinkPoRFeedAddress: null,
    porDecimals: null,
    manualReserveAmountRaw: null,
    manualReserveAmount: null,
    manualReserveTimestamp: null,
    roleCandidates: [
      {
        role: "TREASURY_ROLE",
        address: "0xaab923eefe8f3264d08b4610c6969d6d98104165",
        isMember: null,
      },
      {
        role: "DEFAULT_ADMIN_ROLE",
        address: "0x05ed6826524ebe9f3df837b06803ff797f4e2130",
        isMember: null,
      },
      {
        role: "OPERATOR_ROLE",
        address: "0xa50fc96f444c2922ca80cc7e56fd8e10633ce983",
        isMember: null,
      },
    ],
    safeWallets: [
      {
        role: "TREASURY_ROLE",
        address: "0xaab923eefe8f3264d08b4610c6969d6d98104165",
        bytecodePresent: null,
        threshold: null,
        owners: null,
      },
      {
        role: "DEFAULT_ADMIN_ROLE",
        address: "0x05ed6826524ebe9f3df837b06803ff797f4e2130",
        bytecodePresent: null,
        threshold: null,
        owners: null,
      },
    ],
    chainlinkFeed: null,
    notes: ["Unable to retrieve GLDY-specific live checks: " + reason],
  };
}

async function verifyOne(
  recordId: string,
  address: string,
): Promise<RwaContractVerification> {
  const checkedAt = new Date().toISOString();
  const notes: string[] = [];

  try {
    const bytecode = await rpc("eth_getCode", [address, "latest"]);
    if (bytecode === "0x" || bytecode.length <= 2) {
      return {
        recordId,
        contractAddress: address,
        checkedAt,
        bytecodePresent: false,
        onchainSupplyRaw: null,
        decimals: null,
        onchainSupply: null,
        proxy: null,
        gldyControls: null,
        status: "no_code",
        notes: ["Base RPC reports that no bytecode exists at this address."],
      };
    }

    const proxy = await inspectEip1967Proxy(address);
    let gldyControls: GldyLiveControls | null = null;
    if (recordId === "streamex-gldy") {
      try {
        gldyControls = await inspectGldyLiveControls(address);
      } catch (error) {
        gldyControls = unavailableGldyControls(error);
      }
    }

    let supplyRaw: bigint | null = null;
    let decimals: number | null = null;

    try {
      const totalSupply = await rpc("eth_call", [
        { to: address, data: "0x18160ddd" },
        "latest",
      ]);
      supplyRaw = toHexUint(totalSupply);
      if (supplyRaw === null) {
        notes.push("The totalSupply() response could not be decoded as a valid uint256.");
      }
    } catch (error) {
      notes.push(
        "Unable to read totalSupply(): " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
    }

    try {
      const decimalsHex = await rpc("eth_call", [
        { to: address, data: "0x313ce567" },
        "latest",
      ]);
      const decoded = toHexUint(decimalsHex);
      if (decoded !== null && decoded <= BigInt(255)) {
        decimals = Number(decoded);
      } else {
        notes.push("The decimals() response was not in the expected uint8 format.");
      }
    } catch (error) {
      notes.push(
        "Unable to read decimals(): " +
          (error instanceof Error ? error.message : "Unknown RPC error."),
      );
    }

    return {
      recordId,
      contractAddress: address,
      checkedAt,
      bytecodePresent: true,
      onchainSupplyRaw: supplyRaw?.toString() ?? null,
      decimals,
      onchainSupply:
        supplyRaw !== null && decimals !== null
          ? formatUnits(supplyRaw, decimals)
          : null,
      proxy,
      gldyControls,
      status: "code_present",
      notes,
    };
  } catch (error) {
    return {
      recordId,
      contractAddress: address,
      checkedAt,
      bytecodePresent: null,
      onchainSupplyRaw: null,
      decimals: null,
      onchainSupply: null,
      proxy: null,
      gldyControls: null,
      status: "rpc_error",
      notes: [
        error instanceof Error ? error.message : "Unknown Base RPC error.",
      ],
    };
  }
}

async function readCache(): Promise<VerificationCache | null> {
  const value = await redis.get<VerificationCache | string>(CACHE_KEY);
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        isRecord(parsed) &&
        typeof parsed.checkedAt === "string" &&
        isRecord(parsed.byRecordId)
      ) {
        return parsed as VerificationCache;
      }
      return null;
    } catch {
      return null;
    }
  }

  return isRecord(value) &&
    typeof value.checkedAt === "string" &&
    isRecord(value.byRecordId)
    ? (value as VerificationCache)
    : null;
}

export async function getBaseRwaContractVerification(): Promise<{
  checkedAt: string | null;
  cacheState: "fresh" | "refreshed" | "stale_fallback";
  results: Record<string, RwaContractVerification>;
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
}> {
  const registry = buildBaseRwaContractRegistry();
  const eligible = registry.records.filter(
    (record) => record.contractAddress !== null,
  );
  const cached = await readCache();
  const ageSeconds = cached
    ? Math.max(0, Math.floor((Date.now() - Date.parse(cached.checkedAt)) / 1000))
    : null;

  const makeResult = (
    state: "fresh" | "refreshed" | "stale_fallback",
    results: Record<string, RwaContractVerification>,
    checkedAt: string | null,
    checkedThisRefresh: number,
    cursorIndex: number,
    refreshError?: string,
  ) => ({
    checkedAt,
    cacheState: state,
    results,
    progress: {
      eligibleContracts: eligible.length,
      checkedContracts: eligible.filter((record) => Boolean(results[record.id])).length,
      pendingContracts:
        eligible.length - eligible.filter((record) => Boolean(results[record.id])).length,
      checkedThisRefresh,
      bytecodePresentCount: Object.values(results).filter(
        (entry) => entry.bytecodePresent === true,
      ).length,
      noCodeCount: Object.values(results).filter(
        (entry) => entry.bytecodePresent === false,
      ).length,
      rpcErrorCount: Object.values(results).filter(
        (entry) => entry.status === "rpc_error",
      ).length,
      batchSize: MAX_CHECKS_PER_REFRESH,
      cursorIndex,
    },
    caveats: [
      "eth_getCode, totalSupply(), and decimals() data are read from Base RPC in read-only mode.",
      "The presence of bytecode does not prove that a contract is secure, audited, or legally valid.",
      "EIP-1967 implementation, admin, and beacon slots are inspected in read-only mode; other proxy standards may not be detected by this check.",
      "The presence of implementation bytecode does not prove that the code is secure, and finding an admin address does not prove that its controller is trustworthy.",
      "For GLDY, the whitelist, pause state, PoR configuration, and membership of known role addresses are queried directly. These checks test known candidate addresses; they do not enumerate all role holders or the complete Safe owner/threshold configuration.",
      "totalSupply() and decimals() calls may fail; this does not invalidate a successful bytecode check.",
      "Up to three products are checked per refresh; remaining products are checked in subsequent refreshes.",
    ],
    ...(refreshError ? { refreshError } : {}),
  });

  if (
    cached &&
    ageSeconds !== null &&
    ageSeconds < FRESH_FOR_SECONDS
  ) {
    return makeResult(
      "fresh",
      cached.byRecordId,
      cached.checkedAt,
      0,
      Number(await redis.get<number | string>(CURSOR_KEY)) || 0,
    );
  }

  const lockToken = randomUUID();
  const lock = await redis.set(LOCK_KEY, lockToken, { nx: true, ex: 120 });
  if (lock !== "OK") {
    if (cached) {
      return makeResult(
        "stale_fallback",
        cached.byRecordId,
        cached.checkedAt,
        0,
        Number(await redis.get<number | string>(CURSOR_KEY)) || 0,
        "Another contract verification refresh is already in progress.",
      );
    }
    throw new Error("Could not acquire the Base RWA contract verification lock.");
  }

  try {
    rpcCallCount = 0;
    const results = { ...(cached?.byRecordId ?? {}) };
    const savedCursor = Number(
      await redis.get<number | string>(CURSOR_KEY),
    );
    const cursorIndex =
      Number.isInteger(savedCursor) && savedCursor >= 0 && savedCursor < eligible.length
        ? savedCursor
        : 0;
    const batch =
      eligible.length === 0
        ? []
        : Array.from(
            { length: Math.min(MAX_CHECKS_PER_REFRESH, eligible.length) },
            (_, offset) => eligible[(cursorIndex + offset) % eligible.length],
          );

    for (const record of batch) {
      if (!record.contractAddress) continue;
      results[record.id] = await verifyOne(record.id, record.contractAddress);
    }

    const nextCursor =
      eligible.length === 0
        ? 0
        : (cursorIndex + batch.length) % eligible.length;
    const checkedAt = new Date().toISOString();

    await Promise.all([
      redis.set(CACHE_KEY, { checkedAt, byRecordId: results }, {
        ex: CACHE_TTL_SECONDS,
      }),
      redis.set(CURSOR_KEY, String(nextCursor), {
        ex: CACHE_TTL_SECONDS,
      }),
    ]);

    return makeResult(
      "refreshed",
      results,
      checkedAt,
      batch.length,
      nextCursor,
    );
  } catch (error) {
    if (cached) {
      return makeResult(
        "stale_fallback",
        cached.byRecordId,
        cached.checkedAt,
        0,
        Number(await redis.get<number | string>(CURSOR_KEY)) || 0,
        error instanceof Error ? error.message : "Unknown refresh error.",
      );
    }
    throw error;
  } finally {
    try {
      await redis.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end return 0',
        [LOCK_KEY],
        [lockToken],
      );
    } catch (error) {
      console.error(
        "[Base Opportunity Agent] Failed to release the contract verification lock.",
        error,
      );
    }
  }
}
