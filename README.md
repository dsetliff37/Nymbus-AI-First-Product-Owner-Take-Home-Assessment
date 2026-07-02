# Tally – AI Spending Analyst

A natural-language spending analyst that lets users ask plain-English questions about their transaction data — by voice or text — and get auditable answers backed by deterministic calculations, supporting charts, and source transactions.

**Built for the Nymbus AI-First Product Owner Take-Home Assessment.**

---

## The Problem

Young adults (16–35) don't actively monitor their spending. Existing budgeting tools are data-intensive, dashboard-heavy, and unintuitive — resulting in 90%+ of users engaging less than once per month. These users want simple answers to simple questions: "How much did I spend on groceries last month?" — not a pivot table.

## The User

A non-budget-savvy individual account holder who wants spending awareness without navigating complex financial dashboards. They think in natural language, not in filters and date ranges.

## What Tally Does

Ask a question in plain English (typed or spoken), and Tally:
1. Parses the question into a structured intent using an LLM (category, timeframe, calculation type)
2. Runs a deterministic calculation against local transaction data — no AI math
3. Returns a human-readable answer, a supporting chart, and the exact transactions that produced the result

---

## API Integration

| API | Purpose | Why |
|-----|---------|-----|
| **OpenAI GPT-4o** (Chat Completions) | Query intent parsing | Translates natural language into structured intent (category + timeframe + calculation type). The LLM is a parser, not a calculator — all arithmetic is deterministic and auditable. |
| **Web Speech API** (browser-native) | Voice input (STT) + answer playback (TTS) | Enables hands-free interaction. Degrades gracefully — text input always works if speech isn't available. |

**Privacy constraint:** Only category names are sent to OpenAI. Transaction amounts, descriptions, and dates never leave the browser.

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- npm
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Setup

```bash
cd tally-app
npm install
cp .env.local.example .env.local
# Edit .env.local and add your OpenAI API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Tests

```bash
cd tally-app
npm test
```

The test suite includes unit tests, property-based tests (fast-check), integration tests, and accessibility audits (jest-axe).

---

## Product Decisions & Reasoning

| Decision | Reasoning |
|----------|-----------|
| **Sample data instead of live bank connections** | Eliminates OAuth complexity, PII risk, and API key management for a demo. Users can still upload their own CSV. The product logic is identical regardless of data source. |
| **LLM for intent parsing only — not calculation** | Financial accuracy requires deterministic math. Using the LLM to calculate would make answers non-reproducible and unauditable. Separating parsing from calculation means every answer can be verified against source transactions. |
| **Privacy-first architecture** | Only category names leave the browser. This is both a user trust decision and a regulatory posture — it avoids PII transmission entirely rather than relying on terms-of-service coverage. |
| **Browser-native STT/TTS (Web Speech API)** | Zero additional API cost, no audio data transmitted to third parties, works offline for TTS. Degrades silently — text input always works. |
| **Clarification flow (max 2 rounds)** | Rather than failing silently on ambiguous queries, Tally asks for specifics. Capping at 2 rounds prevents infinite loops while covering most disambiguation cases. |
| **Property-based testing for correctness** | The Calculation Engine is a pure function with a large input space — ideal for PBT. This catches edge cases (negative amounts, case sensitivity, rounding) that example-based tests miss. |
| **Single-page app, no persistence** | No database, no server state, no session cookies. This makes the demo trivially deployable and eliminates an entire class of security concerns. |

---

## Architecture

```
User → QueryInput (text/voice) → intentService (LLM) → calculationEngine (deterministic) → AnswerDisplay
                                        ↓                          ↓
                                  Only category names       Filters & aggregates
                                  sent to OpenAI            in-memory transactions
```

Three layers with strict boundaries:
- **UI Layer** — React components for input, display, voice, and TTS
- **Intent Layer** — LLM API call that receives only query text + category names
- **Calculation Layer** — Pure synchronous function, no API calls, fully testable

---

## What I'd Change With More Time

1. **Live bank integration** — Connect via Plaid or Open Banking to pull real transaction data, with proper OAuth and consent flows.
2. **Spending trends over time** — "Show me my grocery spending trend over 6 months" with line charts and month-over-month comparisons.
3. **Proactive insights** — Push notifications: "You've spent 40% more on dining this month vs. last month."
4. **Multi-turn conversation memory** — "What about last year?" following up on a previous query without re-specifying the category.
5. **Mobile-native app** — React Native or Swift for better voice UX, background audio, and push notifications.
6. **Budget goal setting** — "Alert me if I spend more than $500 on dining this month."
7. **Deployment with edge caching** — Host on Vercel with edge functions for the LLM proxy to reduce latency and protect the API key server-side.
8. **Production observability** — Latency monitoring, error rate tracking, and anonymous usage analytics (input modality, query success rate) without logging PII.

---

## Repository Structure

```
├── README.md                          ← You are here
├── AI_COLLABORATION.md                ← AI collaboration process log
├── PRD_AI_Spending_Insights.md        ← Product Requirements Document
├── .kiro/specs/tally-spending-analyst/ ← Kiro spec artifacts
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
└── tally-app/                         ← The application
    ├── app/page.tsx                   ← Main page (wires everything together)
    ├── src/
    │   ├── components/                ← UI components
    │   ├── context/                   ← DatasetProvider
    │   ├── data/                      ← Sample transaction dataset
    │   ├── hooks/                     ← useSpeechInput, useTts
    │   ├── lib/                       ← calculationEngine, csvParser
    │   ├── services/                  ← intentService (LLM)
    │   └── types/                     ← Shared TypeScript interfaces
    └── ...
```

---

## Kiro Spec Artifacts

The project was built using Kiro's spec-driven workflow. The spec artifacts live in `.kiro/specs/tally-spending-analyst/` and include:

- **requirements.md** — 11 requirements with user stories and acceptance criteria covering data loading, query input, voice, intent parsing, calculation, display, TTS, clarification, privacy, performance, and accessibility.
- **design.md** — System architecture, component interfaces, data models, correctness properties (15 formal properties), error handling strategy, and testing approach.
- **tasks.md** — 34 implementation tasks organized in 9 phases, executed sequentially through Kiro's task runner.

---

## License

This project was built as a take-home assessment and is not licensed for production use.
