import fs from "node:fs";
import { network } from "hardhat";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT = "0xEDc599d1d184E2dDdFb44299a0a13eD2DCB2e322" as const;
const EXPECTED_SIGNER = "0x50DD6732B41d33A0E6442ea959A43467212740D8";
const QUESTION_ID = 1n;

const { viem } = await network.connect();

const publicClient = await viem.getPublicClient();
const [walletClient] = await viem.getWalletClients();

if (!walletClient?.account) {
  throw new Error("Deployer wallet was not loaded.");
}

const artifact = await import(
  "../artifacts/contracts/BaseDaily.sol/BaseDaily.json",
  { with: { type: "json" } }
);

const abi = artifact.default.abi;

const rawKey = fs.readFileSync(".signer-temp", "utf8").trim();

if (!/^0x[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error("Invalid backend signer private key file.");
}

const backendSigner = privateKeyToAccount(rawKey as `0x${string}`);

if (backendSigner.address.toLowerCase() !== EXPECTED_SIGNER.toLowerCase()) {
  throw new Error(
    `Signer mismatch. Expected ${EXPECTED_SIGNER}, got ${backendSigner.address}`
  );
}

const [day, canClaim] = await Promise.all([
  publicClient.readContract({
    address: CONTRACT,
    abi,
    functionName: "currentDay",
  }),
  publicClient.readContract({
    address: CONTRACT,
    abi,
    functionName: "canClaim",
    args: [walletClient.account.address],
  }),
]);

console.log("User:", walletClient.account.address);
console.log("Backend signer:", backendSigner.address);
console.log("Current day:", day.toString());
console.log("Can claim:", canClaim);

if (!canClaim) {
  throw new Error("This wallet has already claimed today.");
}

const correct = true;

const signature = await backendSigner.signTypedData({
  domain: {
    name: "Base Daily",
    version: "1",
    chainId: 84532,
    verifyingContract: CONTRACT,
  },
  types: {
    DailyClaim: [
      { name: "user", type: "address" },
      { name: "questionId", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "correct", type: "bool" },
    ],
  },
  primaryType: "DailyClaim",
  message: {
    user: walletClient.account.address,
    questionId: QUESTION_ID,
    day,
    correct,
  },
});

const { request } = await publicClient.simulateContract({
  account: walletClient.account,
  address: CONTRACT,
  abi,
  functionName: "claimDaily",
  args: [QUESTION_ID, day, correct, signature],
});

const txHash = await walletClient.writeContract(request);

console.log("Transaction:", txHash);

const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
});

console.log("Status:", receipt.status);

const stats = await publicClient.readContract({
  address: CONTRACT,
  abi,
  functionName: "getUserStats",
  args: [walletClient.account.address],
});

console.log("Stats after claim:", stats);
