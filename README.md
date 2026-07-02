# Tally – AI Spending Insights

A natural-language spending analyst embedded in a mobile banking experience. Users ask plain-English questions about their spending — by voice or text — and get clear answers with charts, breakdowns, and source transactions.

Built for the Nymbus AI-First Product Owner Take-Home Assessment.



**Live Demo:** *(clone and run locally — see setup below)*

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
4. Supports follow-up questions with conversational context

### Supported Questions (22 calculation types)

| Category | Example Questions |
|----------|------------------|
| **Totals** | "How much did I spend last month?" / "Total groceries in June" |
| **Comparisons** | "Groceries vs dining out" / "More or less than last month?" |
| **Averages** | "Average grocery purchase?" / "How much per month on dining?" / "Daily spending?" |
| **Counts & Frequency** | "How many times did I eat out?" / "How often do I shop?" |
| **Extremes** | "Biggest purchase this year?" / "Cheapest entertainment?" |
| **Trends** | "Is my spending going up?" / "Grocery trend over 6 months" |
| **Breakdowns** | "Where does my money go?" / "Top 5 categories" |
| **Merchants** | "Where do I spend most on groceries?" / "How much at Amazon?" |
| **Time patterns** | "What day do I spend the most?" / "This week vs last week?" |
| **Recurring** | "What subscriptions am I paying?" / "Show recurring charges" |
| **Projections** | "At this rate, how much will I spend this month?" / "Am I on pace to go over?" |
| **Net spending** | "Money left after bills?" / "Show my refunds" |

---

## API Integration

| API | Purpose | Why |
|-----|---------|-----|
| **OpenAI GPT-4o-mini** (Chat Completions) | Query intent parsing | Translates natural language into structured intent (category + timeframe + calculation type). The LLM is a parser, not a calculator — all arithmetic is deterministic and auditable. |
| **Web Speech API** (browser-native) | Voice input (STT) + answer playback (TTS) | Enables hands-free interaction. Degrades gracefully — text input always works if speech isn't available. |

**Privacy constraint:** Only category names and the query text are sent to OpenAI. Transaction amounts, descriptions, and dates never leave the browser.

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- npm
- An OpenAI API key with credits ([get one here](https://platform.openai.com/api-keys))

### Setup

```bash
cd tally-app
npm install
cp .env.local.example .env.local
# Edit .env.local and paste your OpenAI API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Tests

```bash
cd tally-app
npm test
```

---

## Product Decisions & Reasoning

| Decision | Reasoning |
|----------|-----------|
| **Mobile banking app shell** | The feature is designed to live inside a banking app. The UI mirrors a real mobile banking experience (dark theme, balance card, tab bar) so stakeholders can see exactly where this fits in the product. |
| **LLM for intent parsing only — not calculation** | Financial accuracy requires deterministic math. Using the LLM to calculate would make answers non-reproducible and unauditable. Separating parsing from calculation means every answer can be verified against source transactions. |
| **Categories and timeframes are optional** | Real users ask vague questions ("what's my biggest expense?"). Instead of forcing clarification, the system defaults to all categories and the full year when unspecified. |
| **Follow-up context** | After getting an answer, the user's next question includes context about the previous result — enabling conversational flows like "What about dining out?" after asking about groceries. |
| **Sample data (Jan–Jun 2026)** | Eliminates OAuth complexity, PII risk, and API key management for a demo. Users can upload their own CSV. The product logic is identical regardless of data source. |
| **Privacy-first architecture** | Only category names leave the browser. No transaction data is ever transmitted. This is both a user trust decision and a regulatory posture. |
| **Browser-native STT/TTS** | Zero additional API cost, no audio data transmitted to third parties. Degrades silently — text input always works. |
| **GPT-4o-mini over GPT-4o** | 20x cheaper, fast enough for query parsing. The LLM only classifies intent — it doesn't need GPT-4o-level reasoning. |
| **22 calculation types** | Covers the real questions users ask (validated against user research). Not just totals — trends, projections, recurring charges, day-of-week patterns, and comparative analysis. |
| **Property-based testing** | The calculation engine is a pure function with a large input space — ideal for PBT. Catches edge cases that example-based tests miss. |

---

## Architecture

```
User → QueryInput (text/voice) → intentService (LLM) → calculationEngine (deterministic) → Display
                                        ↓                          ↓
                                  Only query text +         Filters & aggregates
                                  category names            in-memory transactions
                                  sent to OpenAI            (pure, no side effects)
```

Three layers with strict boundaries:
- **UI Layer** — React components for input, display, voice, TTS, and charts
- **Intent Layer** — LLM API call that receives only query text + category names
- **Calculation Layer** — Pure synchronous function, no API calls, fully testable

---

## What I'd Change With More Time

1. Live bank integration with Auth and consent flows
2. Server-side LLM proxy move the API key server-side 
3. Push notifications: "You've spent 40% more on dining this month vs. last"
4. Budget goals "Alert me if I spend more than $500 on dining this month"
5. Full conversation history for complex follow-ups 
6. React Native for better voice UX and push notifications
7. Production metrics Latency monitoring, error rates, anonymous usage analytics

---

## Repository Structure

```
├── README.md                          ← You are here
├── AI_COLLABORATION.md                ← AI collaboration process & decisions
├── PRD_AI_Spending_Insights.md        ← Product Requirements Document
├── .kiro/specs/                       ← Kiro spec artifacts (requirements, design, tasks)
└── tally-app/                         ← The application
    ├── app/page.tsx                   ← Main page (mobile banking shell + Tally feature)
    ├── src/
    │   ├── components/                ← UI components (QueryInput, ChartPanel, SummaryText, etc.)
    │   ├── context/                   ← DatasetProvider (transaction state management)
    │   ├── data/                      ← Sample transaction dataset (Jan–Jun 2026)
    │   ├── hooks/                     ← useSpeechInput, useTts
    │   ├── lib/                       ← calculationEngine (22 types), csvParser
    │   ├── services/                  ← intentService (LLM query parsing)
    │   └── types/                     ← Shared TypeScript interfaces
    └── src/lib/__tests__/             ← Unit + property-based tests
```

---

## Kiro Spec Artifacts

The project was built using Kiro's spec-driven workflow. Spec artifacts live in `.kiro/specs/` and include:

- **requirements.md** — User stories and acceptance criteria covering data loading, query input, voice, intent parsing, calculation, display, TTS, clarification, privacy, performance, and accessibility
- **design.md** — System architecture, component interfaces, data models, correctness properties, error handling strategy, and testing approach
- **tasks.md** — Implementation tasks organized in phases, executed through Kiro's task runner

---

## Tech Stack

- **Framework:** Next.js 16 (React 19, App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts
- **LLM:** OpenAI GPT-4o-mini (Chat Completions API)
- **Voice:** Web Speech API (browser-native)
- **Testing:** Jest, React Testing Library, fast-check (property-based)

---

## License

This project was built as a take-home assessment and is not licensed for production use.
