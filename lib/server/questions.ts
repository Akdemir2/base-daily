export type DailyQuestion = {
  id: number;
  question: string;
  options: readonly [string, string];
  correctOption: 0 | 1;
};

export const questions: readonly DailyQuestion[] = [
  {
    id: 1,
    question: "Which came first?",
    options: ["Base Mainnet", "Farcaster Frames"],
    correctOption: 1,
  },
  {
    id: 2,
    question: "Base was incubated by which company?",
    options: ["Coinbase", "Optimism"],
    correctOption: 0,
  },
  {
    id: 3,
    question: "Base is built using which Ethereum scaling stack?",
    options: ["OP Stack", "Polygon CDK"],
    correctOption: 0,
  },
  {
    id: 4,
    question: "Base settles its transactions to which network?",
    options: ["Ethereum", "Solana"],
    correctOption: 0,
  },
  {
    id: 5,
    question: "What type of Ethereum network is Base?",
    options: ["Layer 2", "Layer 1"],
    correctOption: 0,
  },
  {
    id: 6,
    question: "Which organization develops the OP Stack?",
    options: ["Optimism", "Arbitrum"],
    correctOption: 0,
  },
  {
    id: 7,
    question: "Does Base have a native network token?",
    options: ["No", "Yes"],
    correctOption: 0,
  },
  {
    id: 8,
    question: "Which asset is used to pay gas fees on Base?",
    options: ["ETH", "BASE"],
    correctOption: 0,
  },
  {
    id: 9,
    question: "Base is compatible with which virtual machine?",
    options: ["EVM", "SVM"],
    correctOption: 0,
  },
  {
    id: 10,
    question: "Base Mainnet launched publicly in which year?",
    options: ["2023", "2021"],
    correctOption: 0,
  },
];

export function getUtcDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function getQuestionForDay(day: number): DailyQuestion {
  const index = day % questions.length;
  return questions[index];
}