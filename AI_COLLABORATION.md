# AI Collaboration Log

A chronological record of how AI was used throughout this project — what changed, what AI contributed, what decisions I made manually, and tradeoffs discovered along the way.

---

## Process Overview

**Primary tool:** Kiro (spec-driven development — requirements → design → tasks → implementation)
**Supplementary AI:** Claude (PRD brainstorming, research on Web Speech API compatibility)
**Human decisions:** Problem framing, scope cuts, privacy architecture, UX flow, what to reject from AI suggestions

The Kiro spec workflow drove the entire build. I started with a PRD written collaboratively with Claude, then moved into Kiro to formalize requirements, generate the technical design, and execute implementation tasks. At each phase boundary I reviewed and edited the output before proceeding.

---

## 2026-06-29 — Problem Discovery & PRD

### What changed
Created `PRD_AI_Spending_Insights.md` — the product requirements document defining the problem, user, goals, and MVP plan.

### AI contribution
Used Claude to brainstorm problem spaces in fintech. It suggested several directions (loan calculators, credit score explainers, budget trackers). I chose "natural-language spending queries" because it demonstrates product thinking (LLM as parser, not calculator) and has a clear user pain point.

Claude helped structure the PRD format (goals/non-goals, user stories, risks, metrics) and suggested the drop-off rate as a key metric I hadn't initially considered.

### Human decision
- Chose voice + text over text-only — voice is the differentiator that makes this feel like a product, not just a dashboard widget.
- Scoped to individual non-business accounts only.
- Decided NOT to integrate live bank data in MVP — privacy risk too high for a demo, and it doesn't prove the core hypothesis.

### Tradeoff
The PRD describes a mobile-native app with 70% adoption targets — that's aspirational product context. The actual build is a web demo focused on proving the interaction model works.

---

## 2026-06-30 — Requirements Spec (Kiro)

### What changed
Created the Kiro requirements spec (`.kiro/specs/tally-spending-analyst/requirements.md`) with 11 requirements, user stories, and acceptance criteria.

### AI contribution
Kiro converted the PRD into structured requirements following EARS syntax (WHEN/IF/THEN/SHALL). It generated acceptance criteria I hadn't explicitly thought about:
- Character limit on text input (500 chars)
- Silence detection timeout (1.5s) for voice
- Clarification flow capped at 2 rounds
- Privacy notice must be "persistently visible" on the upload screen

Kiro also ran an automated requirements analysis that surfaced ambiguities (e.g., "what happens if the LLM returns a category that doesn't exist in the dataset?") which led to the category mismatch detection requirement.

### Human decision
- Rejected Kiro's suggestion to add multi-language support — out of scope.
- Added Requirement 9 (Session Privacy) explicitly — Kiro's initial draft didn't have a dedicated privacy requirement, just scattered references. I consolidated them.
- Set the 5-second LLM timeout — Kiro suggested 10s, but that feels too long for a "conversational" experience.

### Tradeoff
The requirements are intentionally strict about what goes to the LLM (only category names). This limits the LLM's ability to disambiguate but protects user privacy. I'd rather have a clarification prompt than leak financial data.

---

## 2026-06-30 — Design Document (Kiro)

### What changed
Generated the technical design document with architecture, interfaces, data models, 15 correctness properties, error handling strategy, and testing approach.

### AI contribution
Kiro produced the three-layer architecture (UI → Intent → Calculation) and defined all TypeScript interfaces. The correctness properties were particularly valuable — I wouldn't have thought to formalize "category match is case-insensitive" or "source list capped at 100" as testable properties without the PBT framework Kiro suggested.

Kiro also designed the error isolation principle: "STT failures never block text input" — which is exactly right for graceful degradation.

### Human decision
- Chose Recharts over D3 — simpler API, good enough for bar/donut charts, less bundle size.
- Decided against Redux or Zustand — React context + useState is sufficient for a single-page app with no persistence.
- Insisted on `DatasetProvider` wrapping the entire app rather than prop-drilling — cleaner architecture even if it's "overkill" for one page.

### Tradeoff
The design is deliberately over-engineered for a demo (formal correctness properties, PBT) because the assessment evaluates product thinking. In production I'd balance test coverage with shipping speed.

---

## 2026-07-01 — Implementation Phase 1–5 (Kiro Task Runner)

### What changed
Built the data layer (sample dataset, DatasetProvider, CSV parser) and intent service through Kiro's task execution system.

### AI contribution
Kiro generated all implementation code through its spec-task-execution subagent. Highlights:
- 247-row sample dataset with realistic retailer names and amounts
- PapaParse CSV parser with dual date format support
- Property-based tests that caught a bug in the date generator (fc.date() can produce Invalid Date objects)
- IntentService with proper AbortController timeout handling

The PBT for CSV parsing caught an edge case where `fc.date()` generated dates that format as `"NaN-NaN-NaN"` — the test framework fixed it by switching to integer-based date generation.

### Human decision
- Kept the sample dataset at 247 rows (not 400) — enough to be meaningful without bloating the bundle.
- Used `fetch` instead of `axios` for the LLM call — one fewer dependency, native API.
- Decided to stub the CSV parser before implementing it fully — lets DatasetProvider compile and test independently.

### Tradeoff
Property-based tests add ~15 seconds to the test suite. Worth it for the Calculation Engine (pure function, large input space) but arguably overkill for the CSV parser where example tests suffice.

---

## 2026-07-01 — Implementation Phase 6: Calculation Engine

### What changed
Implemented the deterministic calculation engine and its property-based test suite (7 properties, 100 runs each).

### AI contribution
Kiro wrote a clean implementation on the first try — the `calculate()` function correctly handles all four intent types, case-insensitive filtering, date range inclusivity, half-up rounding, and the 100-row source cap.

The property tests were generated correctly and all passed immediately. This is the strongest validation of the PBT approach — the engine is a pure function where properties are unambiguous.

### Human decision
- Accepted Kiro's implementation without modification — it matched the design spec exactly.
- Reviewed the rounding logic manually (`Math.round(x * 100) / 100`) — confirmed it handles the half-up case correctly for financial amounts.

### Tradeoff
None — this phase went smoothly because the design was tight.

---

## 2026-07-01 — Implementation Phase 7: UI Components

### What changed
Built all React components: QueryInput, useSpeechInput, useTts, TtsControls, SummaryText, ChartPanel, SourceTransactionList, InterpretedQueryBadge, ClarificationPanel, DatasetUpload.

### AI contribution
Kiro generated all components with Tailwind styling, ARIA labels, keyboard accessibility, and proper error states. The ClarificationPanel got 19 unit tests covering all interaction paths.

Notable: Kiro created a `src/types/speech-recognition.d.ts` type declaration file for the Web Speech API — TypeScript doesn't include these types in its default lib, and Kiro knew to add them.

### Human decision
- Would have preferred a more polished visual design (the Tailwind defaults are functional but generic). With more time I'd add custom colors, typography, and micro-interactions.
- Accepted the animated ping indicator on the mic button — it's a nice touch for recording feedback.
- The TtsControls component auto-plays only for voice queries, not text — this was my explicit requirement to avoid jarring unexpected audio.

### Tradeoff
Components are functional but visually minimal. A real product would need a design system pass.

---

## 2026-07-01 — Implementation Phase 8–9: Wiring, Integration, Polish

### What changed
Wired all components into `app/page.tsx` with a state machine (idle → submitting → clarifying/answered/error). Added integration tests, accessibility audit, README, and .env setup.

### AI contribution
Kiro implemented the full page state management with proper error handling, clarification flow (combined queries on retry), TTS auto-play logic, and answer clearing on new submission.

The integration test correctly computes the expected Groceries sum from the sample dataset rather than hardcoding a magic number — good practice that makes the test resilient to dataset changes.

### Human decision
- Reviewed the state transitions to ensure "clear previous answer on new query" works correctly (Requirement 6.7).
- Confirmed the accessibility audit mocks Recharts rather than trying to axe-check SVG — the right pragmatic choice.

### Tradeoff
The page component is large (~200 lines). In a production app I'd extract the query state machine into a custom hook. For a demo, co-location keeps it readable.

---

## Reflections

### What worked well about AI collaboration
- **Spec-driven development** forced clear thinking before implementation. Kiro's requirements analysis caught ambiguities early.
- **Property-based testing** was a natural fit for the Calculation Engine. AI generated properties I might have missed (case sensitivity, 100-row cap).
- **Parallel task execution** let multiple components build simultaneously with no conflicts.

### Where I overrode AI
- Rejected multi-language support, Redux, and 10-second timeouts.
- Consolidated scattered privacy requirements into a dedicated section.
- Scoped down to web-only (the PRD describes mobile-native aspirationally).

### What AI couldn't do well
- **Visual design** — the generated UI is functional but generic. Product differentiation comes from design craft that AI doesn't bring autonomously.
- **Product judgment calls** — AI can generate options but can't decide "this is too complex for the user." Scope decisions were all human.
- **Real-world testing** — AI tests code correctness but can't tell you if the voice experience feels good in a noisy room.

### Key learning
The best use of AI in product development is as a **tireless implementer with perfect memory of the spec** — but the spec itself has to come from human product thinking. The gap between "technically correct" and "good product" is still a human gap.
