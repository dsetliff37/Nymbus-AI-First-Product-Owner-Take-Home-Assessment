# Requirements Document

## Introduction

Tally is a natural-language spending analyst for personal finance. It allows users to ask plain-English questions — by voice or text — about their transaction data, such as "How much did I spend on groceries last month vs. eating out?" The application parses each question into a structured intent, performs all financial calculations deterministically from local transaction data (a sample dataset or user-uploaded CSV), and returns an auditable answer with a supporting chart and the source transactions that produced it.

Tally is a web application (React/Next.js) targeting users aged 16–35 who want spending awareness without navigating complex dashboards. It is a demo-ready MVP built for the Nymbus AI-First Product Owner assessment. It does not connect to live bank accounts, does not store user data between sessions, and does not provide financial advice.

---

## Glossary

- **Tally**: The application described by this document.
- **User**: A person interacting with Tally via a web browser.
- **Query**: A natural-language question submitted by the User about their spending.
- **Voice Query**: A Query captured via the browser's microphone using the Web Speech API.
- **Text Query**: A Query entered by the User via a keyboard input field.
- **Interpreted Query**: A structured representation of the User's Query, expressed in plain English, that shows what category, timeframe, and calculation Tally will perform.
- **Transaction**: A single row of financial data with fields: `date`, `amount`, `description`, `category`.
- **Transaction Dataset**: The set of Transaction records available during a session — either the built-in sample dataset or a User-uploaded CSV file.
- **Category**: A spending label assigned to a Transaction (e.g., "Groceries", "Dining Out", "Transport").
- **Answer**: The final human-readable response Tally returns to a Query, including a summary text, a supporting Chart, and a list of Source Transactions.
- **Chart**: A visual representation (bar chart or donut chart) of the numerical result of a Query.
- **Source Transactions**: The specific Transaction records used to compute the Answer.
- **LLM**: A large language model API (e.g., OpenAI GPT-4o) used solely to interpret Query intent.
- **Calculation Engine**: The deterministic, rule-based module within Tally that performs all arithmetic on Transaction data. It does not use the LLM for computation.
- **TTS**: Text-to-speech, the mechanism by which Tally reads the Answer aloud.
- **STT**: Speech-to-text, the mechanism by which Tally transcribes a Voice Query using the Web Speech API.
- **Session**: A single browser session. No data persists across sessions.
- **Drop-off**: A Query that does not result in an Answer being returned to the User.

---

## Requirements

---

### Requirement 1: Transaction Data Loading

**User Story:** As a user, I want Tally to have transaction data available when I open the app, so that I can ask spending questions immediately without any setup.

#### Acceptance Criteria

1. THE Tally application SHALL load a built-in sample Transaction Dataset on startup, without requiring any user action.
2. THE sample Transaction Dataset SHALL contain at least 90 days of transactions spanning a minimum of 6 spending categories (e.g., Groceries, Dining Out, Transport, Entertainment, Utilities, Shopping).
3. WHEN the User selects the option to upload a CSV file, THE Tally application SHALL accept a file up to 10 MB in size with the columns: `date` (YYYY-MM-DD or MM/DD/YYYY format), `amount` (positive or negative decimal), `description`, and `category`.
4. WHEN a CSV file is uploaded, THE Tally application SHALL replace the active Transaction Dataset with the uploaded file's data for the duration of the Session.
5. IF a user-uploaded CSV file is missing one or more required columns (`date`, `amount`, `description`, `category`), THEN THE Tally application SHALL display an error message identifying which columns are absent and SHALL retain the previously active Transaction Dataset.
6. IF a user-uploaded CSV file contains rows with values that cannot be parsed according to the accepted date or amount formats defined in Criterion 3, THEN THE Tally application SHALL skip those rows; IF all rows are unparseable, THE Tally application SHALL reject the file entirely, display an error message stating that no valid rows were found, and retain the previously active Transaction Dataset; OTHERWISE THE Tally application SHALL display a warning stating how many rows were skipped and SHALL load the remaining valid rows.
7. THE Tally application SHALL NOT persist any uploaded transaction data beyond the current browser Session.

---

### Requirement 2: Text Query Input

**User Story:** As a user, I want to type a spending question in plain English, so that I can get an answer without speaking aloud.

#### Acceptance Criteria

1. THE Tally application SHALL display a text input field that accepts a natural-language spending Query of up to 500 characters.
2. WHEN the User submits a text Query, THE Tally application SHALL begin processing the Query within 200 milliseconds of submission; IF processing cannot begin within 200 milliseconds but does begin within 2 seconds, THE Tally application SHALL display a status message informing the User that processing is starting; IF processing does not begin within 2 seconds, THE Tally application SHALL display an error message.
3. THE text input field SHALL be focusable via the Tab key and submittable via the Enter key, without requiring a mouse.
4. WHILE a Query is being processed, THE Tally application SHALL display a loading indicator that remains visible until a response or error is shown.
5. IF the text input field is empty or contains only whitespace when the User attempts to submit, THEN THE Tally application SHALL prevent submission and display an inline prompt asking the User to enter a question.
6. IF the text input field contains more than 500 characters when the User attempts to submit, THEN THE Tally application SHALL prevent submission and display an inline message indicating the character limit has been exceeded.

---

### Requirement 3: Voice Query Input

**User Story:** As a user, I want to ask my spending question by speaking, so that I can get answers hands-free.

#### Acceptance Criteria

1. THE Tally application SHALL provide a microphone button that initiates voice capture via the browser Web Speech API when activated.
2. WHEN the microphone button is activated, THE STT module SHALL begin transcription and display the transcript, updating within 1 second of each spoken word, as the User speaks.
3. WHEN the STT module detects 1.5 seconds of continuous silence after the User has spoken, THE STT module SHALL finalize the transcript and stop recording.
4. WHILE voice capture is active, THE microphone button SHALL display an animated recording indicator that is visually distinct from its inactive state.
5. IF the browser does not support the Web Speech API, OR IF voice input initialization fails for any reason, THEN THE Tally application SHALL hide the microphone button and display a message informing the User that voice input is unavailable in their browser, without affecting text input functionality.
6. IF the User denies microphone permission, THEN THE Tally application SHALL hide the microphone button and display a message informing the User that microphone access was denied and they may use text input instead.
7. IF the STT module does not detect any speech within 10 seconds of the microphone being activated, THEN THE Tally application SHALL stop recording, display an error message asking the User to try again, and return focus to the text input field.
8. WHEN a voice transcript is finalized, THE Tally application SHALL pre-populate the text input field with the transcript, allowing the User to review and edit it before manually submitting.

---

### Requirement 4: Query Intent Interpretation

**User Story:** As a user, I want the app to understand what I'm asking, so that it calculates the right answer from my transactions.

#### Acceptance Criteria

1. WHEN a Query is submitted, THE LLM SHALL extract a structured intent object containing: `intent_type` (one of: sum, compare, average, count), `categories` (a list of 1–10 category name strings, each no longer than 100 characters), and `timeframe` (an explicit date range with start and end dates in YYYY-MM-DD format).
2. THE LLM SHALL be given only the Query text and the list of available category names as context — no transaction amounts, descriptions, or dates SHALL be sent to the LLM.
3. WHEN the LLM returns a structured intent, THE Tally application SHALL display the Interpreted Query to the User in plain English within the visible UI before showing the Answer (e.g., "I'll calculate: Total spent in Groceries from May 1 – May 31").
4. THE Calculation Engine SHALL use the structured intent from the LLM as its sole input for determining what to calculate — it SHALL NOT use the LLM to perform arithmetic or aggregation.
5. IF a mismatch is detected between the intent_type value in the LLM response and the value passed to the Calculation Engine, THEN THE Tally application SHALL use exactly the intent_type returned by the LLM without modification.
6. IF the LLM returns an intent_type that is not one of the four supported types (sum, compare, average, count), THEN THE Tally application SHALL display a message informing the User that the question type is not yet supported and SHALL suggest a rephrasing.
7. IF the LLM API call fails or does not return a response within 5 seconds, THEN THE Tally application SHALL display a descriptive error message and SHALL NOT attempt to calculate an Answer.
8. IF the LLM API call succeeds but the response is missing one or more required fields (`intent_type`, `categories`, `timeframe`) or contains values of an unexpected type, THEN THE Tally application SHALL display a message explaining that the query could not be understood and SHALL invite the User to rephrase their question.
9. WHEN a timeframe is expressed relatively (e.g., "last month", "this year", "past 3 weeks"), THE LLM SHALL resolve it to an explicit date range based on the current date in the user's device local timezone at the time of the Query.
10. IF one or more category names returned by the LLM do not match any category name in the active Transaction Dataset (case-insensitive), THEN THE Tally application SHALL display a clarification prompt listing the available categories and asking the User to confirm or correct the category.

---

### Requirement 5: Deterministic Calculation Engine

**User Story:** As a user, I want the spending figures in my answer to be calculated directly from my transaction data — not estimated or generated by AI — so that I can trust the numbers.

#### Acceptance Criteria

1. WHEN the Calculation Engine receives a structured intent, THE Calculation Engine SHALL filter the Transaction Dataset to only rows where the `category` field matches one of the values in the intent's `categories` list (case-insensitive) and where the `date` field falls within the intent's `timeframe` date range, inclusive of both the start and end dates; negative-amount transactions (refunds) SHALL be included in the filtered set.
2. WHEN the intent_type is `sum`, THE Calculation Engine SHALL return the arithmetic sum of the `amount` field for all matching Transactions.
3. WHEN the intent_type is `compare`, THE Calculation Engine SHALL compute a separate sum for each requested category and return both values alongside their signed difference (first category minus second category).
4. WHEN the intent_type is `average`, THE Calculation Engine SHALL return the arithmetic mean of the `amount` field across all matching Transactions.
5. WHEN the intent_type is `count`, THE Calculation Engine SHALL return the number of matching Transaction rows.
6. THE Calculation Engine SHALL round all currency output to two decimal places using half-up rounding.
7. IF no Transactions match the intent's filters, THEN THE Calculation Engine SHALL return a result of zero.
8. WHEN the Calculation Engine returns a result of zero due to no matching transactions, THE Tally application SHALL display a message informing the User that no transactions were found for the specified category and timeframe.
9. THE Calculation Engine SHALL NOT invoke the LLM API at any point during calculation.

---

### Requirement 6: Answer Display

**User Story:** As a user, I want to see a clear, human-readable answer with supporting visuals and source data, so that I can understand and verify my spending.

#### Acceptance Criteria

1. WHEN an Answer is ready, THE Tally application SHALL display a summary text sentence stating the result in plain English (e.g., "You spent $342.50 on Groceries in May.").
2. WHEN an Answer is ready and the intent_type is `compare`, THE Tally application SHALL display a bar chart comparing the values for each requested category.
3. WHEN an Answer is ready and the intent_type is `sum`, `average`, or `count`, THE Tally application SHALL display a donut chart representing the result for the single requested category.
4. WHEN an Answer is ready, THE Tally application SHALL display the list of Source Transactions used in the calculation, including each transaction's date, description, category, and amount, up to a maximum of 100 transactions.
5. THE Source Transactions list SHALL be sorted by date, most recent first; transactions with the same date SHALL be sorted alphabetically by description as a tiebreaker.
6. WHILE an Answer is visible, THE Tally application SHALL display the Interpreted Query above the Answer so the User can verify what was calculated.
7. WHEN the User submits a new Query, THE Tally application SHALL immediately clear the previous Answer, Chart, and Source Transactions and display a loading indicator while the new Answer is being computed.
8. IF the Calculation Engine returns a result of zero due to no matching transactions, THE Tally application SHALL display a message stating that no transactions were found for the specified category and timeframe in place of the Chart and Source Transactions list.

---

### Requirement 7: Text-to-Speech Answer Playback

**User Story:** As a user, I want the app to read the answer aloud after I ask by voice, so that I can get a hands-free experience end to end.

#### Acceptance Criteria

1. WHEN an Answer is produced in response to a Voice Query, THE TTS module SHALL automatically read the summary text sentence aloud using the browser Web Speech API.
2. WHILE TTS playback is active, THE Tally application SHALL display a visible audio indicator showing that audio is playing.
3. WHEN TTS playback ends without error, THE Tally application SHALL transition the audio indicator to a "played" state, visually distinct from both the active playback state and the idle state, to signal that audio was played.
4. IF an Answer was produced in response to a Text Query, THE TTS module SHALL NOT automatically play audio; the User MAY trigger playback manually via the replay button.
5. WHILE TTS playback is active, THE Tally application SHALL disable the replay button to prevent concurrent playback.
6. THE Tally application SHALL provide a replay button that allows the User to replay the TTS answer on demand after playback has ended.
7. IF TTS playback fails after it has started (e.g., the speech engine encounters an error mid-sentence), THEN THE Tally application SHALL stop playback, display an error message informing the User that audio playback failed, and ensure the replay button is re-enabled.
8. IF the browser does not support TTS, THE Tally application SHALL silently skip audio playback, SHALL hide both the audio indicator and the replay button, and SHALL NOT display an error for TTS unavailability.

---

### Requirement 8: Query Clarification Flow

**User Story:** As a user, I want the app to ask me to clarify if it couldn't understand my question, so that I can rephrase and still get an answer.

#### Acceptance Criteria

1. IF the LLM returns a structured intent where one or more required fields (`intent_type`, `categories`, `timeframe`) are null or flagged as unresolvable, THEN THE Tally application SHALL display a clarification prompt that identifies each unresolved field by name and asks the User to provide the missing information.
2. WHEN the User responds to a clarification prompt, THE Tally application SHALL combine the clarification response with the original Query context and re-submit the combined input to the Calculation Engine.
3. THE clarification prompt SHALL display the available category names from the loaded Transaction Dataset to guide the User. IF no Transaction Dataset is loaded, THE clarification prompt SHALL display an empty category list and an inline message informing the User that no data is available.
4. IF the User responds to a clarification prompt and the resulting combined input still produces an unresolvable structured intent, THE Tally application SHALL display a second and final clarification prompt; IF the second clarification also fails to produce a resolvable intent, THE Tally application SHALL display a message indicating that the query could not be completed and invite the User to submit a new Query.
5. IF the User does not respond to a clarification prompt before submitting a new Query or navigating away from the application, THE Tally application SHALL take no further action on the original Query.

---

### Requirement 9: Session Privacy and Data Handling

**User Story:** As a user, I want to be confident that my financial data is not stored or sent anywhere without my knowledge, so that I can use the app safely.

#### Acceptance Criteria

1. THE Tally application SHALL NOT transmit transaction amounts, descriptions, or dates to any API outside the browser; category names from the active Transaction Dataset MAY be transmitted to the LLM API as permitted by Requirement 4 Criterion 2.
2. THE Tally application SHALL NOT persist any transaction data, query history, or answers to browser local storage, session storage, or any server-side store.
3. THE Tally application SHALL NOT include query text or transaction data in any analytics event payload; non-financial metadata (e.g., input modality, whether an answer was returned or a drop-off occurred) MAY be included in analytics payloads.
4. WHEN a new browser Session begins, THE Tally application SHALL contain no transaction data, query history, or answers from any prior Session.
5. THE Tally application SHALL display a privacy notice persistently visible before and after a file is selected on the data upload screen, stating that uploaded data is used only within the current session and is never transmitted or stored.

---

### Requirement 10: Performance and Latency

**User Story:** As a user, I want answers to return quickly, so that the experience feels conversational rather than like a slow database query.

#### Acceptance Criteria

1. WHEN a Query is submitted under a network connection of 10 Mbps or greater with latency under 100 ms, THE Tally application SHALL return a fully rendered Answer (summary text, Chart, and Source Transactions visible in the UI) within 5 seconds at the 95th percentile.
2. WHEN the Calculation Engine is given a Transaction Dataset of up to 10,000 rows, THE Calculation Engine SHALL complete its computation and return results within 500 milliseconds; IF the Transaction Dataset exceeds 10,000 rows, THE Tally application SHALL display a warning informing the User that performance may be degraded.
3. WHILE TTS or STT is initializing, THE Tally application SHALL display a visible loading indicator in the UI and SHALL NOT block the User from submitting a text Query during initialization.
4. IF TTS or STT initialization does not complete within 10 seconds, THE Tally application SHALL stop initialization, hide the corresponding UI control, and display a message informing the User that the feature failed to initialize and they may use the text input instead.

---

### Requirement 11: Accessibility

**User Story:** As a user, I want the application to be usable regardless of my input preference or assistive technology, so that I'm not excluded from the experience.

#### Acceptance Criteria

1. THE Tally application SHALL meet WCAG 2.1 Level AA color contrast requirements for all interactive elements and text.
2. THE Tally application SHALL provide a visible keyboard focus indicator on all interactive controls such that the focused state is visually distinguishable from the unfocused state.
3. THE microphone button, submit button, and replay button SHALL each have an accessible name exposed to screen readers via ARIA labels.
4. THE Chart SHALL include a text summary as an ARIA description or visually-hidden caption that lists each category label alongside its corresponding numeric value, accessible to screen readers.
5. THE Tally application SHALL be fully operable using keyboard navigation alone — specifically: the microphone button SHALL be activatable via keyboard, the submit button SHALL be activatable via keyboard, the replay button SHALL be activatable via keyboard, and chart data SHALL be navigable via keyboard.
6. WHEN the STT module transitions between inactive, recording, and finalizing states, THE Tally application SHALL announce each state change via an ARIA live region so that screen reader users receive the recording status without visual focus.

---

## Non-Goals (Out of Scope for This MVP)

- Connecting to live bank accounts or any Open Banking API
- Persisting data or query history between sessions
- Providing spending recommendations, budget alerts, or financial advice
- Supporting business, joint, or multi-user accounts
- KYC, AML, or regulatory compliance validation
- Spending trend prediction or ML-based categorization
- Replacing existing bank transaction search or filtering tools
- Mobile-native app (iOS or Android)
