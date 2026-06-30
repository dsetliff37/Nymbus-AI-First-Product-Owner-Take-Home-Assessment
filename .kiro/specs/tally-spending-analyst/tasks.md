# Implementation Plan: Tally Spending Analyst

## Overview

Implementation proceeds in six phases: project scaffolding → data layer (sample dataset + CSV parser) → intent layer (LLM service + validation) → calculation engine → UI layer (query input, answer display, voice, TTS) → wiring and integration. All code is TypeScript/React/Next.js. Property-based tests use **fast-check** (≥ 100 runs each). Unit tests use **Jest** + **React Testing Library**. Accessibility checks use **jest-axe**.

---

## Tasks

- [ ] 1. Scaffold project structure and shared types
  - Initialize Next.js app with TypeScript; install dependencies: `recharts`, `papaparse`, `fast-check`, `jest-axe`, `@testing-library/react`, `@testing-library/jest-dom`, `axios` (or native fetch).
  - Create `src/types/index.ts` defining: `Transaction`, `ParsedIntent`, `IntentType`, `DateRange`, `CalculationResult`, `CompareValues`, `CsvUploadResult`, `CsvError`, `IntentResult`, `IntentError`.
  - Configure Jest with TypeScript (`ts-jest`) and `jest-axe` setup file.
  - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [ ] 2. Implement `DatasetProvider` and sample dataset
  - [ ] 2.1 Create the static sample dataset
    - Write `src/data/sampleTransactions.ts` containing 200–400 `Transaction` rows spanning ≥ 90 days across ≥ 6 categories (Groceries, Dining Out, Transport, Entertainment, Utilities, Shopping).
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Implement `DatasetProvider` context
    - Create `src/context/DatasetProvider.tsx` with `transactions`, `categories` (memoized distinct sorted names), `loadSampleDataset()`, and `uploadCsv(file)` from the `DatasetContextValue` interface.
    - Load sample dataset on mount via `useEffect`.
    - _Requirements: 1.1, 1.4, 9.2_

- [ ] 3. Implement the CSV parser
  - [ ] 3.1 Write `src/lib/csvParser.ts`
    - Use PapaParse to parse the file in-browser.
    - Validate file size ≤ 10 MB; if exceeded, return `CsvError { type: 'file_too_large' }`.
    - Check for required columns (`date`, `amount`, `description`, `category`); return `CsvError { type: 'missing_columns', missingColumns }` if any are absent.
    - For each row: attempt `YYYY-MM-DD` then `MM/DD/YYYY` date parse; attempt `parseFloat(amount)`; skip row and increment `rowsSkipped` on failure; trim `description` and `category`.
    - If all rows skipped, return `CsvError { type: 'no_valid_rows' }`.
    - Otherwise return `{ ok: true, rowsLoaded, rowsSkipped }`.
    - _Requirements: 1.3, 1.5, 1.6_

  - [ ]* 3.2 Write property test — Property 1: CSV parse round-trip preserves valid rows
    - **Property 1: CSV parse round-trip preserves valid rows**
    - **Validates: Requirements 1.3, 1.6**
    - Use fast-check to generate arbitrary arrays of valid rows; assert loaded count equals input count and field values match.

  - [ ]* 3.3 Write property test — Property 2: Invalid-amount rows are always skipped
    - **Property 2: Invalid-amount rows are always skipped**
    - **Validates: Requirements 1.6**
    - Use fast-check to generate CSV files with a random subset of rows containing non-numeric amounts; assert those rows are excluded and loaded count equals valid-amount row count.

  - [ ]* 3.4 Write property test — Property 3: Missing required columns reject the file
    - **Property 3: Missing required columns reject the file**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate CSV files missing one or more required columns; assert `missing_columns` error is returned identifying all absent columns.

  - [ ]* 3.5 Write unit tests for CSV parser
    - Valid file loads all rows.
    - All-rows-invalid returns `no_valid_rows` error.
    - Partial-skip emits correct `rowsSkipped` count.
    - File-too-large returns `file_too_large` error.
    - Both date formats (`YYYY-MM-DD` and `MM/DD/YYYY`) are accepted.
    - _Requirements: 1.3, 1.5, 1.6_

- [ ] 4. Checkpoint — ensure data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement `intentService` (LLM query parser)
  - [ ] 5.1 Write `src/services/intentService.ts`
    - Implement `interpretQuery(queryText, availableCategories)` returning `IntentResult`.
    - Build the LLM prompt using only `queryText` and the list of category names — no amounts, descriptions, or dates.
    - Set a 5-second timeout; return `{ ok: false, error: { type: 'api_timeout' } }` on timeout.
    - Validate the JSON response for required fields (`intent_type`, `categories`, `timeframe`); return `missing_fields` error if any are absent or wrong type.
    - Return `unsupported_intent_type` error if `intent_type` is not one of the four supported values.
    - Return `unresolvable_fields` error if the LLM sets any field to `null`.
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 5.2 Write property test — Property 12: Privacy — no amounts/descriptions/dates in LLM payload
    - **Property 12: Privacy — no amounts/descriptions/dates in LLM payload**
    - **Validates: Requirements 4.2, 9.1**
    - Use fast-check to generate arbitrary `Transaction[]` and query strings; spy on the LLM call; assert the captured payload contains only `queryText` and category names — no amount, description, or date values.

  - [ ]* 5.3 Write unit tests for `intentService`
    - Correctly rejects responses missing `intent_type`, `categories`, or `timeframe`.
    - Correctly handles `null` fields (maps to `unresolvable_fields`).
    - Rejects unknown `intent_type` strings.
    - Returns `api_timeout` error when the API call exceeds 5 seconds.
    - _Requirements: 4.6, 4.7, 4.8_

- [ ] 6. Implement the Calculation Engine
  - [ ] 6.1 Write `src/lib/calculationEngine.ts`
    - Implement `calculate(intent, transactions)` as a pure synchronous function with no API calls.
    - Filter transactions by case-insensitive category match and inclusive date range.
    - `sum`: return arithmetic sum of `amount` fields, rounded to 2 d.p. (half-up).
    - `average`: return mean of `amount` fields, rounded to 2 d.p. (half-up).
    - `compare`: compute `sumA`, `sumB`, `difference = sumA - sumB`, each rounded to 2 d.p.
    - `count`: return number of matching rows.
    - If no rows match, return `0` and set `zeroMatch: true`.
    - Sort `sourceTransactions` most-recent-first; ties broken alphabetically ascending by `description`; cap at 100 rows.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.4, 6.5_

  - [ ]* 6.2 Write property test — Property 5: Calculation Engine sum correctness
    - **Property 5: Calculation Engine sum correctness**
    - **Validates: Requirements 5.1, 5.2**
    - Use fast-check to generate arbitrary datasets and `sum` intents; assert result equals independently computed arithmetic sum.

  - [ ]* 6.3 Write property test — Property 6: Calculation Engine average correctness
    - **Property 6: Calculation Engine average correctness**
    - **Validates: Requirements 5.1, 5.4, 5.6**
    - Use fast-check to generate datasets and `average` intents; assert result equals sum/count rounded half-up to 2 d.p.

  - [ ]* 6.4 Write property test — Property 7: Calculation Engine compare correctness
    - **Property 7: Calculation Engine compare correctness**
    - **Validates: Requirements 5.1, 5.3**
    - Use fast-check to generate datasets and `compare` intents with two categories; assert `difference === sumA - sumB` and each sum matches independent calculation.

  - [ ]* 6.5 Write property test — Property 8: Zero-match returns zero and sets zeroMatch flag
    - **Property 8: Zero-match returns zero and sets zeroMatch flag**
    - **Validates: Requirements 5.7, 5.8**
    - Use fast-check to generate intents whose category/timeframe filters are guaranteed to match no rows; assert `value === 0` and `zeroMatch === true`.

  - [ ]* 6.6 Write property test — Property 9: Calculation uses only LLM-provided intent fields
    - **Property 9: Calculation uses only LLM-provided intent fields**
    - **Validates: Requirements 4.4, 5.9**
    - Use fast-check to generate two identical `ParsedIntent` objects with different accompanying query strings; assert the two `CalculationResult` outputs are identical (pure function of intent + dataset).

  - [ ]* 6.7 Write property test — Property 10: Source transaction list is correctly sorted
    - **Property 10: Source transaction list is correctly sorted**
    - **Validates: Requirements 6.5**
    - Use fast-check to generate non-empty `sourceTransactions`; assert list is sorted most-recent-date-first, then alphabetically by description for ties.

  - [ ]* 6.8 Write property test — Property 11: Source transaction list is capped at 100
    - **Property 11: Source transaction list is capped at 100**
    - **Validates: Requirements 6.4**
    - Use fast-check to generate datasets where > 100 rows match the intent filters; assert `sourceTransactions.length <= 100`.

  - [ ]* 6.9 Write property test — Property 14: Category match is case-insensitive
    - **Property 14: Category match is case-insensitive**
    - **Validates: Requirements 5.1**
    - Use fast-check to generate transactions with randomly cased category strings that match intent categories modulo case; assert those rows are included in the result.

  - [ ]* 6.10 Write unit tests for Calculation Engine
    - Returns zero and `zeroMatch: true` when no rows match.
    - Includes negative-amount transactions (refunds) in sums.
    - Rounds correctly to 2 d.p. using half-up rounding.
    - _Requirements: 5.1, 5.6, 5.7_

- [ ] 7. Checkpoint — ensure calculation engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement query validation and clarification state
  - [ ] 8.1 Write `src/lib/queryValidation.ts`
    - Implement `isBlankQuery(text: string): boolean` — returns `true` for empty or whitespace-only strings.
    - Implement `exceedsMaxLength(text: string): boolean` — returns `true` if `text.length > 500`.
    - _Requirements: 2.5, 2.6_

  - [ ]* 8.2 Write property test — Property 4: Whitespace-only queries are rejected
    - **Property 4: Whitespace-only queries are rejected**
    - **Validates: Requirements 2.5**
    - Use fast-check to generate strings composed entirely of whitespace characters; assert `isBlankQuery` returns `true` for all of them and that no API call is triggered.

  - [ ] 8.3 Implement clarification round counter logic in page reducer
    - Add `clarificationRound: 0 | 1 | 2` to the page-level reducer.
    - On clarification failure, increment counter; if counter reaches 2, transition to terminal error state and reset to idle.
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 8.4 Write property test — Property 15: Clarification round counter never exceeds 2
    - **Property 15: Clarification round counter never exceeds 2**
    - **Validates: Requirements 8.4**
    - Use fast-check to enumerate sequences of query submissions and clarification responses; assert counter never exceeds 2 and terminal error is shown after two consecutive failures.

  - [ ]* 8.5 Write unit tests for clarification flow
    - Round 1 shows clarification prompt.
    - Round 2 shows second clarification prompt.
    - Round 2 failure shows terminal error message and resets to idle.
    - _Requirements: 8.1, 8.4_

- [ ] 9. Implement `useSpeechInput` hook
  - [ ] 9.1 Write `src/hooks/useSpeechInput.ts`
    - Wrap `window.SpeechRecognition` / `window.webkitSpeechRecognition`; set `supported: false` when API is absent.
    - Implement silence detection: 1500 ms timer restarted on each `onresult`; fires `recognition.stop()` on expiry.
    - Implement no-speech timeout: 10 s timer fires `stop()` and emits `'no_speech'` if `onresult` never fires.
    - Expose states: `idle | requesting_permission | recording | finalizing | error`.
    - On `permission_denied`, emit `SpeechInputError = 'permission_denied'`.
    - On init failure, emit `SpeechInputError = 'init_failed'`.
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 9.2 Write unit tests for `useSpeechInput`
    - Returns `supported: false` when `SpeechRecognition` is absent from the browser.
    - Emits `no_speech` after 10 s of silence.
    - Transitions through `idle → recording → finalizing` correctly.
    - _Requirements: 3.5, 3.7_

- [ ] 10. Implement `useTts` hook
  - [ ] 10.1 Write `src/hooks/useTts.ts`
    - Wrap `window.SpeechSynthesis`; set `supported: false` when API is absent.
    - Implement `speak(text)`, `replay()`, `stop()`.
    - Track state: `idle | playing | played | error`.
    - On mid-speech error, transition to `error` state and re-enable replay button.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 10.2 Write unit tests for `useTts`
    - Returns `supported: false` when `SpeechSynthesis` is absent.
    - Transitions to `played` state after successful playback.
    - Transitions to `error` state and re-enables replay on mid-speech failure.
    - _Requirements: 7.7, 7.8_

- [ ] 11. Build UI components
  - [ ] 11.1 Implement `DatasetUpload` component
    - File picker accepting CSV; max size 10 MB enforced client-side before calling `uploadCsv`.
    - Display `PrivacyNotice` persistently before and after file selection.
    - Show success banner with `rowsLoaded` / `rowsSkipped`; show error message for `missing_columns`, `no_valid_rows`, `file_too_large`.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 9.5_

  - [ ] 11.2 Implement `QueryInput` component
    - Text field: max 500 chars; Tab-focusable; Enter-submittable; inline validation messages for blank or over-length input.
    - `MicButton`: shown only when `useSpeechInput.supported === true` and permission not denied; animated recording indicator while active; ARIA label.
    - Display live transcript while recording; pre-populate text field on finalization.
    - Show appropriate messages when voice is unavailable or permission is denied.
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 11.3 Implement `InterpretedQueryBadge` component
    - Renders the plain-English interpretation of a `ParsedIntent` (e.g., "I'll calculate: Total spent in Groceries from May 1 – May 31").
    - Shown above the answer while an answer is visible.
    - _Requirements: 4.3, 6.6_

  - [ ] 11.4 Implement `SummaryText` component
    - Renders the plain-English answer sentence for all four `intent_type` values.
    - Shows "no transactions found" message when `zeroMatch === true`.
    - _Requirements: 6.1, 5.8_

  - [ ] 11.5 Implement `ChartPanel` component
    - Renders bar chart (Recharts) for `compare` intent_type.
    - Renders donut chart (Recharts) for `sum`, `average`, `count`.
    - Includes visually-hidden ARIA description listing each category label and its numeric value for screen readers.
    - Chart data navigable via keyboard.
    - Hidden (replaced by zero-match message) when `zeroMatch === true`.
    - _Requirements: 6.2, 6.3, 6.8, 11.4, 11.5_

  - [ ] 11.6 Implement `SourceTransactionList` component
    - Renders up to 100 rows: date, description, category, amount.
    - Rows are pre-sorted by the Calculation Engine (most-recent-first, then description alpha).
    - Hidden when `zeroMatch === true`.
    - _Requirements: 6.4, 6.5_

  - [ ] 11.7 Implement `TtsControls` component (`AudioIndicator` + `ReplayButton`)
    - `AudioIndicator`: shows active / played / hidden states.
    - `ReplayButton`: disabled during playback; hidden when TTS not supported; accessible name via ARIA label.
    - Auto-play triggered when query source is `'voice'` and a new result arrives.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 11.8 Implement `ClarificationPanel` component
    - Displays unresolved field names and available categories.
    - Shows empty category list with inline message when no dataset is loaded.
    - Accepts user text response via `onRespond` callback.
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 11.9 Write snapshot tests for UI components
    - `ChartPanel` renders consistent bar/donut markup for a fixed `CalculationResult`.
    - `AnswerDisplay` renders consistently for loading, answered, zero-match, and error states.
    - _Requirements: 6.1, 6.2, 6.3, 6.8_

  - [ ]* 11.10 Write accessibility tests with jest-axe
    - Run `jest-axe` on all major page states: initial load, query submitting, answered, zero-match, clarification, error.
    - Assert no WCAG 2.1 AA violations are detected by automated checks.
    - Verify ARIA labels on microphone button, submit button, and replay button.
    - Verify ARIA live region exists for STT state transitions.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 12. Checkpoint — ensure UI component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Wire everything together on the index page
  - [ ] 13.1 Implement page-level reducer and connect all components
    - Create `src/pages/index.tsx` (or `app/page.tsx`).
    - Wrap the page in `DatasetProvider`.
    - Implement the page reducer with states: `idle | submitting | clarifying | answered | error`.
    - Connect `QueryInput` → `intentService` → `calculationEngine` → `AnswerDisplay`.
    - Track `querySource: 'text' | 'voice'`; pass to `TtsControls` for auto-play decision.
    - Clear previous answer, chart, and source transactions immediately when a new query is submitted (Property 13).
    - Show `InterpretedQueryBadge` above the answer while answered.
    - Show loading indicator (Requirement 2.4) while query is processing.
    - Respect 200 ms / 2 s processing start latency thresholds.
    - _Requirements: 2.2, 2.4, 4.3, 4.4, 6.6, 6.7, 7.1, 9.2, 9.4, 10.3_

  - [ ]* 13.2 Write property test — Property 13: No data persistence across queries
    - **Property 13: No data persistence across queries**
    - **Validates: Requirements 6.7, 9.2, 9.4**
    - Use fast-check to generate sequences of queries; after each new query submission, assert that answer data, chart data, and source transactions from the prior query are cleared from state.

  - [ ]* 13.3 Write integration tests — end-to-end query flows
    - Text query flow: submit text → mocked LLM returns `ParsedIntent` → Calculation Engine runs → answer displayed.
    - CSV upload → dataset replace → text query → verify answer reflects new data.
    - Voice query flow: mocked `SpeechRecognition` fires transcript → text field pre-populated → user submits → answer displayed → TTS auto-plays.
    - Clarification flow: LLM returns `unresolvable_fields` → clarification prompt shown → user responds → second LLM call → answer displayed.
    - _Requirements: 2.2, 3.8, 4.3, 6.1, 7.1, 8.1, 8.2_

- [ ] 14. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 4, 7, 12, 14) ensure incremental validation at layer boundaries.
- Property-based tests use **fast-check** with a minimum of 100 runs per suite; each suite is tagged `// Feature: tally-spending-analyst, Property N: <property_text>`.
- Unit tests use **Jest** + **React Testing Library**; accessibility tests use **jest-axe**.
- The Calculation Engine (task 6) is a pure function — all of its PBT sub-tasks (6.2–6.9) can be written and run without any UI dependency.
- Privacy invariant (Property 12, task 5.2) is verified by spying on the outbound LLM fetch call inside `intentService`.
- Full WCAG 2.1 AA compliance requires manual testing with assistive technologies beyond the automated `jest-axe` checks in task 11.10.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "9.1", "10.1"] },
    { "id": 6, "tasks": ["8.4", "8.5", "9.2", "10.2", "11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8"] },
    { "id": 7, "tasks": ["11.9", "11.10", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3"] }
  ]
}
```
