export const BASE_DAILY_ADDRESS =
  "0xEDc599d1d184E2dDdFb44299a0a13eD2DCB2e322" as const;

export const BASE_DAILY_ABI = [
  {
    type: "function",
    name: "claimDaily",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "questionId",
        type: "uint256",
      },
      {
        name: "day",
        type: "uint256",
      },
      {
        name: "correct",
        type: "bool",
      },
      {
        name: "signature",
        type: "bytes",
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getUserStats",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
    ],
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
  {
    type: "function",
    name: "canClaim",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },
] as const;