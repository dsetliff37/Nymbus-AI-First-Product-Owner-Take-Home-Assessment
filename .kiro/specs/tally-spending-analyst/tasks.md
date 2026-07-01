# Implementation Plan: Tally Spending Analyst

## Overview

Implementation proceeds in six phases: project scaffolding → data layer (sample dataset + CSV parser) → intent layer (LLM service + validation) → calculation engine → UI layer (query input, answer display, voice, TTS) → wiring and integration. All code is TypeScript/React/Next.js. Property-based tests use **fast-check** (≥ 100 runs each). Unit tests use **Jest** + **React Testing Library**. Accessibility checks use **jest-axe**.

---

## Tasks

- [x] 1. Scaffold project structure and shared types
  - [x] 1.1 Initialize Next.js app with TypeScript and install dependencies
    - Install: `recharts`, `papaparse`, `fast-check`, `jest-axe`, `@testing-library/react`, `@testing-library/jest-dom`, `axios` (or native fetch).
    - Configure Jest with TypeScript (`ts-jest`) and `jest-axe` setup file.
    - _Requirements: 1.1, 2.1, 4.1, 5.1_
  - [x] 1.2 Create shared TypeScript types
    - Create `src/types/index.ts` defining: `Transaction`, `ParsedIntent`, `IntentType`, `DateRange`, `CalculationResult`, `CompareValues`, `CsvUploadResult`, `CsvError`, `IntentResult`, `IntentError`.
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 5.4, 5.5_


- [x] 2. Implement `DatasetProvider` and sample dataset
  - [x] 2.1 Create the static sample dataset
    - Write `src/data/sampleTransactions.ts` containing 200–400 `Transaction` rows spanning ≥ 90 days across ≥ 6 categories (Groceries, Dining Out, Transport, Entertainment, Utilities, Shopping).
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement `DatasetProvider` context
    - Create `src/context/DatasetProvider.tsx` with `transactions`, `categories` (memoized distinct sorted names), `loadSampleDataset()`, and `uploadCsv(file)` from the `DatasetContextValue` interface.
    - Load sample dataset on mount via `useEffect`.
    - Ensure no transaction data is written to `localStorage`, `sessionStorage`, or any server-side store.
    - _Requirements: 1.1, 1.4, 9.2, 9.4_

- [x] 3. Implement the CSV parser
  - [x] 3.1 Write `src/lib/csvParser.ts`
    - Use PapaParse to parse the file in-browser.
    - Validate file size ≤ 10 MB; if exceeded, return `CsvError { type: 'file_too_large' }`.
    - Check for required columns (`date`, `amount`, `description`, `category`); return `CsvError { type: 'missing_columns', missingColumns }` if any are absent, retaining the previous dataset.
    - For each row: attempt `YYYY-MM-DD` then `MM/DD/YYYY` date parse; attempt `parseFloat(amount)`; skip row and increment `rowsSkipped` on failure; trim `description` and `category`.
    - If all rows skipped, return `CsvError { type: 'no_valid_rows' }`.
    - Otherwise return `{ ok: true, rowsLoaded, rowsSkipped }`.
    - _Requirements: 1.3, 1.5, 1.6_

  - [x] 3.2 Write property test — Property 1: CSV parse round-trip preserves valid rows
    - **Property 1: CSV parse round-trip preserves valid rows**
    - **Validates: Requirements 1.3, 1.6**
    - Use fast-check to generate arbitrary arrays of valid rows; assert loaded count equals input count and field values match.

  - [x] 3.3 Write property test — Property 2: Invalid-amount rows are always skipped
    - **Property 2: Invalid-amount rows are always skipped**
    - **Validates: Requirements 1.6**
    - Use fast-check to generate CSV files with a random subset of rows containing non-numeric amounts; assert those rows are excluded and loaded count equals valid-amount row count.

  - [x] 3.4 Write property test — Property 3: Missing required columns reject the file
    - **Property 3: Missing required columns reject the file**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate CSV files missing one or more required columns; assert `missing_columns` error is returned identifying all absent columns and the previously active dataset is retained.

  - [x] 3.5 Write unit tests for CSV parser
    - Valid file loads all rows.
    - All-rows-invalid returns `no_valid_rows` error.
    - Partial-skip emits correct `rowsSkipped` count with warning.
    - File-too-large returns `file_too_large` error.
    - Both date formats (`YYYY-MM-DD` and `MM/DD/YYYY`) are accepted.
    - _Requirements: 1.3, 1.5, 1.6_


- [x] 4. Checkpoint — ensure data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement `intentService` (LLM query parser)
  - [x] 5.1 Write `src/services/intentService.ts`
    - Implement `interpretQuery(queryText, availableCategories)` returning `IntentResult`.
    - Build the LLM prompt using only `queryText` and the list of category names — no amounts, descriptions, or dates.
    - Set a 5-second timeout; return `{ ok: false, error: { type: 'api_timeout' } }` on timeout.
    - Validate the JSON response for required fields (`intent_type`, `categories`, `timeframe`); return `missing_fields` error if any are absent or wrong type.
    - Return `unsupported_intent_type` error if `intent_type` is not one of the four supported values (`sum`, `compare`, `average`, `count`).
    - Return `unresolvable_fields` error if the LLM sets any required field to `null`.
    - Resolve relative timeframes (e.g., "last month") against `Date.now()` in the user's local timezone.
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 5.2 Implement category mismatch detection in `intentService`
    - After parsing a valid `ParsedIntent`, check each returned category name against the active dataset's category list (case-insensitive).
    - If one or more category names do not match, surface them to the page for the clarification prompt (Requirement 4.10).
    - _Requirements: 4.10, 8.1, 8.3_

  - [x] 5.3 Write property test — Property 12: Privacy — no amounts/descriptions/dates in LLM payload
    - **Property 12: Privacy — no amounts/descriptions/dates in LLM payload**
    - **Validates: Requirements 4.2, 9.1**
    - Use fast-check to generate arbitrary `Transaction[]` and query strings; spy on the LLM call; assert the captured payload contains only `queryText` and category names — no amount, description, or date values.

  - [x] 5.4 Write unit tests for `intentService`
    - Correctly rejects responses missing `intent_type`, `categories`, or `timeframe`.
    - Correctly handles `null` fields (maps to `unresolvable_fields`).
    - Rejects unknown `intent_type` strings.
    - Returns `api_timeout` error when the API call exceeds 5 seconds.
    - _Requirements: 4.6, 4.7, 4.8_

