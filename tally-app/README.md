# Tally – AI Spending Analyst

Tally is a natural-language spending analyst that lets you ask plain-English questions about your transaction data — by voice or text. It parses your question into a structured intent using an LLM, performs all financial calculations deterministically from local data, and returns an auditable answer with a supporting chart and the source transactions that produced it.

## Prerequisites

- Node.js 18+
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment example file and add your OpenAI API key:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and replace `sk-your-key-here` with your actual OpenAI API key. You can get one at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).

3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

4. Run tests:

```bash
npm test
```

## Architecture

Tally's core architecture separates concerns into three layers:

| Layer | Responsibility |
|-------|---------------|
| **UI Layer** | React components for input (text + voice), answer display (summary, chart, source list), and TTS playback controls |
| **Intent Layer** | Calls the LLM API with only the query text and available category names; returns a structured `ParsedIntent` object |
| **Calculation Layer** | A fully deterministic, synchronous module that filters and aggregates the in-memory transaction dataset using only the structured intent |

The LLM is used solely as a query parser — all arithmetic and aggregation is performed by the deterministic Calculation Engine.

## Key Features

- **Natural-language queries** — ask spending questions in plain English (e.g., "How much did I spend on groceries last month?")
- **Voice input** — speak your question using the browser's Web Speech API
- **Text-to-speech answers** — hear the answer read aloud after a voice query
- **Four calculation types** — sum, compare, average, and count
- **Visual charts** — bar charts for comparisons, donut charts for single-category results
- **Source transactions** — see exactly which transactions produced the answer
- **CSV upload** — bring your own transaction data (up to 10 MB)
- **Built-in sample dataset** — start exploring immediately with 90+ days of sample transactions across 6 categories
- **Clarification flow** — Tally asks follow-up questions if it can't understand your query

## Privacy

Tally is designed with privacy in mind:

- **No data is persisted** — transaction data, query history, and answers exist only in browser memory for the current session
- **Minimal LLM exposure** — only category names are sent to the LLM API for intent parsing; no transaction amounts, descriptions, or dates ever leave the browser
- **No analytics tracking** of query text or financial data
