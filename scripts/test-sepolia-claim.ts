import { network } from "hardhat";

const CONTRACT_ADDRESS =
  "0xEDc599d1d184E2dDdFb44299a0a13eD2DCB2e322";

const QUESTION_ID = 9n;
const DAY = 20698n;
const CORRECT = true;

const SIGNATURE =
  "0xcd2e5309decf0191fbdf1439a7bf096d7ef07a02c83af4869ad223a91a8fc7294526a27ce762816ae30a3839c63c3e60cf047785ab9ce5e826c751ce2e8f9cd21c";

const abi = [
  {
    type: "function",
    name: "claimDaily",
    stateMutability: "nonpayable",
    inputs: [
      { name: "questionId", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "correct", type: "bool" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
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
  const { viem } = await network.connect();

  const [walletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const user = walletClient.account.address;

  console.log("Wallet:", user);

  const canClaimBefore = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "canClaim",
    args: [user],
  });

  console.log("Can claim before:", canClaimBefore);

  if (!canClaimBefore) {
    throw new Error("Wallet cannot claim today.");
  }

  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "claimDaily",
    args: [
      QUESTION_ID,
      DAY,
      CORRECT,
      SIGNATURE,
    ],
  });

  console.log("Transaction:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });

  console.log("Receipt status:", receipt.status);
  console.log("Block:", receipt.blockNumber.toString());

  const stats = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "getUserStats",
    args: [user],
  });

  console.log("Stats:", {
    totalPlayed: Number(stats.totalPlayed),
    totalCorrect: Number(stats.totalCorrect),
    currentStreak: Number(stats.currentStreak),
    bestStreak: Number(stats.bestStreak),
    totalPoints: Number(stats.totalPoints),
    lastPlayedDay: Number(stats.lastPlayedDay),
  });

  const canClaimAfter = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "canClaim",
    args: [user],
  });

  console.log("Can claim after:", canClaimAfter);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});