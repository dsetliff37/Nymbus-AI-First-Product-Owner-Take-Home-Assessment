# PRD: AI-Powered Spending Insights (Voice/Text Query Feature)

**Status:** Draft  
**PM Owner:** [David Setliff]  
**Last Updated:** 2026-06-29  
**Target Release:** MVP Demo — 1 week | Production Compliance Review — Phase 2 (TBD)  
**Stakeholders:** Nymbus product leadership, Compliance & Legal, Engineering, Product Design

---

## 1. Overview

### Problem Statement

App users aged 16-35 in small individual non-business accounts do not actively monitor their spending or budgeting habits. Current budgeting systems are too data-intensive and non-intuitive, resulting in 90% of customers using existing tools fewer than once per month. These users want to understand their spending without navigating complex dashboards — they want simple, natural answers to simple questions.

### Proposed Solution

Build an AI-powered voice/text feature that allows users to ask natural language questions about their spending habits ("How much did I spend on takeout last month?" or "Compare my groceries vs. dining out"). The system will:
1. Accept user query via voice or text input
2. Interpret the query using LLMs to identify transaction categories and time ranges
3. Retrieve relevant transactions from the user's account
4. Return a simple, human-readable answer (spoken via TTS and displayed on screen)
5. Demo-ready MVP with voice + text in 1 week; full compliance validation in Phase 2

### Strategic Alignment

| Goal | How This Feature Contributes |
|---|---|
| **Activation** | Increases engagement with spending data from 1x/month (current) to 3+x/month (target), improving time-to-value for non-technical users |
| **Retention** | Builds financial awareness habit; positions platform as trusted financial advisor (vs. just transaction ledger) |
| **Revenue** | Opens pathway to upsell savings products, investment accounts, and credit products once users understand their cash flow |

---

## 2. Goals & Non-Goals

### Goals

- [ ] **User Goal:** Users can ask natural language questions about their spending via voice or text and receive clear, accurate answers without navigating complex dashboards
- [ ] **User Goal:** Voice-first interaction enables hands-free use on mobile (while driving, cooking, shopping)
- [ ] **Business Goal:** Achieve 70% of target user segment interacting with feature 3+ times per month
- [ ] **Business Goal:** <2% user drop-off rate (before answer returned or due to unclear translation)
- [ ] **Product Goal:** Demo-ready MVP with voice + text in 1 week with AI-assisted build

### Non-Goals

- This feature will NOT provide investment advice (Phase 2 consideration)
- This feature will NOT integrate KYC/AML/compliance validation in MVP (Phase 2 work)
- This feature will NOT upsell financial products in MVP (Phase 2 work)
- This feature will NOT support multi-user or business accounts
- This feature will NOT replace existing transaction search or filtering tools

---

## 3. User Stories

| # | User Story | Priority |
|---|---|---|
| US-01 | As a 22-year-old user, I want to say "How much did I spend on takeout last month?" and hear a spoken answer | **Must Have** |
| US-02 | As a user, I want to ask comparative questions by voice ("Groceries vs. takeout?") and hear the comparison | **Must Have** |
| US-03 | As a user, I want to type the question if speaking is inconvenient | **Must Have** |
| US-04 | As a user, I want to clarify if the system misheard me | **Must Have** |
| US-05 | As a user, I want to see AND hear the answer | **Should Have** |

---

## 4. Functional Requirements - Core (Must Have)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-01 | Accept voice input | User taps mic → speaks → transcription appears → processes |
| FR-02 | Accept text input (fallback) | User types → system processes |
| FR-03 | Voice transcription ≥90% accuracy | Test 50 samples; target 90%+ match |
| FR-04 | Interpret spending query | LLM extracts: {category, timeframe, intent} |
| FR-05 | Retrieve transactions | Query backend → aggregate results |
| FR-06 | Text-to-speech answer | TTS engine reads answer aloud |
| FR-07 | Display answer on screen | Visual display of answer text |
| FR-08 | Measure drop-off | Log events: {query, voice/text, answered, drop_off} |

---

## 5. Non-Functional Requirements

| Category | Requirement | Rationale |
|---|---|---|
| **Performance** | Voice query-to-answer latency: <5 seconds P95 | Users expect conversational speed |
| **Scalability** | MVP supports 10–100 concurrent users (demo scale) | Demo only; production scaling in Phase 2 |
| **Accessibility** | Text input keyboard-accessible; WCAG AA button contrast | Varied digital literacy in target segment |
| **Security** | No transaction data in logs; existing auth used | PII protection; compliance review in Phase 2 |
| **Privacy** | Queries not retained for training; session-only history | User privacy expectation |
| **Reliability** | No crashes during sample queries; graceful error handling | Feature must appear stable in demo |

---

## 6. Out of Scope

- KYC/AML/REG Z compliance (Phase 2 blocker)
- Spending recommendations (Phase 2 feature)
- Budget alerts / notifications (Phase 3+)
- Multi-user or business accounts (individual-only MVP)
- Financial product upsells (Phase 2)

---

## 7. Dependencies

| Dependency | Type | Risk if Not Ready |
|---|---|---|
| Voice transcription API (iOS Speech Recog / Cloud STT) | Third-party | Cannot accept voice input |
| Text-to-speech API (iOS AVSpeechSynthesizer / Cloud TTS) | Third-party | Cannot speak answers |
| LLM API (OpenAI, Anthropic) | Third-party | Cannot interpret queries |
| Mobile app (iOS or Android) | Internal | No platform for feature |
| Transaction data API | Internal | Cannot retrieve spending data |

---

## 8. Open Questions

| # | Question | Owner | Needed By |
|---|---|---|---|
| OQ-01 | Which LLM provider? Integration cost/latency? | Engineering | Day 1 |
| OQ-02 | Transaction categorization status in backend? | Data / Backend | Day 0 |
| OQ-03 | Which voice transcription API? | Engineering | Day 0 |
| OQ-04 | Realistic transcription accuracy baseline? | Engineering | Day 1 testing |
| OQ-05 | Specific regulatory items for demo? | Legal | Stakeholder alignment |

---

## 9. Metrics & Success

### North Star Metric

**Feature Adoption Rate (Monthly Active Users)**
- **Target:** 70% of target segment (ages 16-35) within 30 days
- **Voice adoption:** 60%+ of queries via voice within 30 days
- **Voice accuracy:** ≥90% transcription accuracy
- **Voice latency P95:** <3 seconds
- **Drop-off rate:** <2%

### Guardrail Metrics

| Metric | Acceptable Floor |
|---|---|
| Voice transcription accuracy | ≥85% |
| Voice query latency (P95) | <5 seconds |
| Drop-off rate | <2% |
| Mobile app crash rate on voice | <0.5% |

---

## 10. Critical Risks

### 🔴 CRITICAL RISK 1: Voice Transcription Accuracy <85%
- **Mitigation:** Run 50-sample accuracy test on Day 2; optimize if <85%
- **Owner:** Engineering
- **Trigger:** Accuracy <80% on Day 2

### 🔴 CRITICAL RISK 2: Voice Latency >5 Seconds
- **Mitigation:** Benchmark full latency on Day 2; optimize or descope
- **Owner:** Engineering
- **Trigger:** P95 latency >5 seconds on Day 2

### 🟡 WATCH RISK: Voice Fails in Real-World Noise
- **Trigger:** User testing shows <85% accuracy in noisy environments
- **Owner:** Engineering / Design

---

## 11. MVP Build Plan (1 Week, AI-Assisted)

### Timeline

- **Day 0:** De-risk & alignment (voice API confirmation, mobile integration path, LLM selection, legal sign-off)
- **Days 1–2:** Foundation & testing (voice transcription integration, LLM prompts, 50-sample accuracy test)
- **Days 3–4:** Core integration (LLM + TTS, voice button + result display, latency benchmarking)
- **Days 5–6:** Polish & user testing (clarification flow, instrumentation, TTS quality testing)
- **Day 7:** Demo & wrap (end-to-end demo, stakeholder presentation, Phase 2 alignment)

### Rollout Strategy

- ✅ Day 7: Internal demo to Nymbus product leadership
- ⚠️ Days 7–10: Closed beta with 20 internal users
- ❌ NOT: Full production launch yet (Phase 2 compliance required)

---

## 12. MVP Hypothesis

We believe that building a natural-language voice/text query interface for spending questions for young, non-budget-savvy users will result in significantly higher engagement with their spending data.

**Success criteria:**
→ 70% of target segment tries feature within 30 days
→ Users average 3+ queries per month
→ Drop-off rate <2%
→ 60%+ of queries via voice

**If true →** Proceed to Phase 2 (compliance + scale + upsell)
**If false →** Pivot to dashboard redesign or hold for better LLM models

---

## 13. Phase 2 Work (Post-MVP)

- Compliance & Legal: Full KYC/AML/REG Z review; voice data privacy
- Scale & Performance: Optimize for 1000+ concurrent users
- Enhanced Queries: Comparative queries, flexible time ranges
- Upsell Strategy: Product recommendation messaging
- Closed Beta: 20–50 users before general release

---

## Summary

This PRD defines a 1-week MVP to test voice-powered spending Q&A for young, non-budget-savvy users. Critical success factors are transcription accuracy ≥85%, latency <5 seconds, 70% adoption within 30 days, <2% drop-off, and 60%+ voice adoption. If all gates are achieved, Phase 2 scales with compliance + upsell. If any critical gate fails, escalate for pivot decision.

---

*AI-Powered Spending Insights PRD | Generated 2026-06-29 | AI-Assisted Build | Claude Haiku 4.5*
