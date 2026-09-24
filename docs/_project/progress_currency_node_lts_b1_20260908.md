---
name: devbible-currency-node-lts-b1-20260908
description: 2026-09-08 — tier B1 (the Node 26 LTS deadline) is DONE and pushed. 140 pages de-expired. What the sweep actually was, why it is not a 24→26 bump, and the two things it deliberately left.
metadata:
  type: project
---

# B1 — the Node "Active LTS" expiry — CLOSED 2026-09-08

**Two commits: `ef8a3cc02` (120 files, mechanical) and the follow-up (20 files, judgment).**

## 🔴 The thing to understand before re-opening this

**B1 was never a Node 24 → 26 version bump, and doing it as one would have put 140 wrong
pages live for seven weeks.** Node 26 does not become Active LTS until **2026-10-28**.

The correct treatment is triage class 6 (`event`) in
`.agents/skills/devbible-currency/references/triage-ladder.md`: **grep the phrase that
expires, not the version.** `Node 24 (Active LTS)` goes false on 2026-10-28;
`Node 24 (LTS)` stays true to 2028-04-30. The version string `24.19.0` was not touched
anywhere, and no `> Verified:` date moved.

## The dates, confirmed against endoflife.date on 2026-09-08

| Cycle | Released | Active LTS | EOL |
|---|---|---|---|
| 26 | 2026-05-05 | **2026-10-28** | 2029-04-30 |
| 24 | 2025-05-06 | 2025-10-28 | **2028-04-30** |
| 22 | 2024-04-24 | 2024-10-29 | 2027-04-30 |
| 20 | 2023-04-18 | 2023-10-24 | 2026-04-30 |

## What changed

- **120 files, one line each** — 106 `> Verified … **Node 24.19.0** (Active LTS)` → `(LTS)`,
  and 14 nodejs phase-README banners → `> **Target runtime: Node 24 (LTS) — supported to
  30 April 2028.**`
- **20 files read and rewritten** — release-model tables, deployment parity rules and
  cross-track pin rows, where the phrase was doing teaching work. The substantive one is
  `docs/nodejs/pages/phase-0-runtime-model/07-choosing-a-version.md`: its snapshot table
  said *"Status now"* / *"use this in production today"*; the rows now carry absolute
  promotion **and demotion** dates and the prose teaches reading the table against a
  calendar. The Active/Maintenance/Current distinction is kept — it is the lesson.

## ⛔ Deliberately NOT touched — do not "fix" these

- **Every `docs/nextjs` page naming Active LTS.** That is *Next.js's own* 16.x/15.x support
  model, a different product with a different meaning for the words. 17 files.
- **`docs/java` "current LTS"** — Java 25. Same reason.
- **`docs/expressjs/reviews/proposed-syllabus/README.md`** lines 19 and 38 still say
  `Node 24 Active LTS`. Reviews are historical records; the edit contract forbids updating
  them. This is correct, not an oversight.

## Left open

A content conflict found in passing, not a currency defect:
`docs/python/pages/phase-0-runtime/10-python-vs-node/01-the-real-question.md` teaches the
even/odd LTS rule as live, while `07-choosing-a-version.md` teaches that the rule dies
with v27. One of them is wrong. Owner: whoever next takes python or nodejs.

Related: [[devbible-cursor-audit]] · [[devbible-feedback-never-run-local-build-or-check-ci]] ·
[[devbible-locks]]
