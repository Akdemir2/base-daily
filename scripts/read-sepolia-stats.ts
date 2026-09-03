import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const CONTRACT_ADDRESS =
  "0xEDc599d1d184E2dDdFb44299a0a13eD2DCB2e322";

const USER =
  "0xf6627465d9a5db57c0efde2abe46d906e46d5a31";

const TX_HASH =
  "0xed38eabd3a4f50cb3b63d8be898c714fea663583a8150c7e0fe24f04b0ca91ce";

const abi = [
  {
    type: "function",
    name: "canClaim",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getUserStats",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "totalPlayed", type: "uint32" },
          { name: "totalCorrect", type: "uint32" },
          { name: "currentStreak", type: "uint32" },
          { name: "bestStreak", type: "uint32" },
          { name: "totalPoints", type: "uint32" },
          { name: "lastPlayedDay", type: "uint32" },
        ],
      },
    ],
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const receipt = await client.getTransactionReceipt({
    hash: TX_HASH,
  });

  const stats = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "getUserStats",
    args: [USER],
  });

  const canClaim = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "canClaim",
    args: [USER],
  });

  console.log("Receipt status:", receipt.status);
  console.log("Block:", receipt.blockNumber.toString());

  console.log("Stats:", {
    totalPlayed: Number(stats.totalPlayed),
    totalCorrect: Number(stats.totalCorrect),
    currentStreak: Number(stats.currentStreak),
    bestStreak: Number(stats.bestStreak),
    totalPoints: Number(stats.totalPoints),
    lastPlayedDay: Number(stats.lastPlayedDay),
  });

  console.log("Can claim:", canClaim);
}

main().catch(console.error);