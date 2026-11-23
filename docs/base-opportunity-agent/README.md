# Base Opportunity Agent

A read-only, server-side research and reporting module planned alongside Base Daily.

## Goals

- Discover Base ecosystem projects and official opportunities from curated sources.
- Evaluate protocol and campaign information with clear source URLs, timestamps, and confidence.
- Produce a transparent opportunity score based on utility, evidence quality, cost, risk, and relevance.
- Monitor Base Daily product health and on-chain activity without changing its existing contract or user flow.
- Keep all on-chain write actions out of the MVP.

## Existing project context

Base Daily is a Next.js 16.3.4 application with a Farcaster Mini App manifest, a Base Mainnet contract, API routes for daily questions and answers, a Redis-backed answer record, and an indexed on-chain leaderboard.

The deployed contract is read-oriented for this agent: `getUserStats(address)`, `canClaim(address)`, and the `DailyClaimed` event can support public activity summaries. Do not automate `claimDaily` or sign wallet transactions.

## MVP architecture

1. **Opportunity discovery** — curated official sources and project announcements.
2. **Evidence registry** — title, URL, publisher, publication date, retrieval date, and confidence.
3. **Protocol review** — utility, user value, liquidity/fees where verifiable, contract/security signals, and caveats.
4. **Base Daily monitor** — availability, API health, leaderboard/indexer status, and aggregate on-chain engagement.
5. **Opportunity ranking** — transparent heuristic score; no claim that it predicts an airdrop.
6. **Daily report** — actionable shortlist, evidence, estimated costs, and risks.

## Safety constraints

- Read-only by default. No private keys, seed phrases, signing keys, or wallet credentials in the agent.
- No automated swaps, bridging, minting, claiming, or transactions in the MVP.
- Do not create or operate wallet farms, wash activity, Sybil patterns, or artificial volume.
- Never describe a project or activity as a confirmed Base airdrop criterion unless Base publishes an explicit rule.
- Clearly separate official facts, third-party reports, and agent inference.
- Any future write capability requires a separate design review, explicit user approval, spending caps, and a dedicated limited wallet.

## Proposed API shape

A future `GET /api/agent/report` endpoint may return:

- `generatedAt`
- `summary`
- `opportunities[]` with `name`, `category`, `score`, `rationale`, `risks[]`, `estimatedCost`, `sources[]`
- `baseDailyHealth`
- `limitations[]`

This document is the design baseline only. It does not yet add a scheduled job, call external APIs, or execute transactions.
