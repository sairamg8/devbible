---
title: "Configs section — live progress tracker"
sidebar_label: "Snipperts progress · live"
sidebar_position: 2
---

:::info Live tracker — updated as work happens
This file is the **single source of truth for where the Jest / RTL / Vitest config
section is sitting right now.** It is updated **when a topic is picked up** (→ 🔨 Working
on it) and again **the moment its explanation is written** (→ ✅ Completed).

**A session that dies mid-run is resumed from the START HERE block below, not from the
git log.**
:::

> Plan this tracks: [Configs section proposal](./configs-section-proposal.md)
> Last updated: **2026-08-20 07:51**

---

## 🔴 START HERE — resume point

| | |
|---|---|
| **Next topic to pick up** | `README.md` — the configs index (three config surfaces + runner decision table) |
| **Currently working on** | — nothing in flight |
| **Blocked on** | 🔴 **Decision 1 and Decision 2** — see *Open decisions* below |
| **Target directory** | `docs/jest-rtl/configs/` — **not yet created** |

---

## Status legend

| Mark | Meaning |
|---|---|
| ⬜ | **Not started** — planned, nothing on disk |
| 🔨 | **Working on it** — picked up, file being written right now |
| ✅ | **Completed** — explanation written, line cap checked, links resolved |
| ⏸ | **Parked** — deliberately deferred, reason given |
| 🚫 | **Dropped** — out of scope, reason given |

**The rule for this file:** mark 🔨 *before* writing a line of the topic, mark ✅ *the
moment the explanation is finished*. Never batch the updates at the end — that is exactly
what a usage cut-off destroys.

---

## Progress

**0 of 8 topics complete · 0 files written · 0 lines**

| # | Topic | Target path | Status | Files | Lines | Finished |
|---|---|---|---|---|---|---|
| — | **Configs index** — three config surfaces, which-runner decision table | `configs/README.md` | ⬜ | — | — | — |
| 01 | **Where config lives and how it resolves** — `package.json#jest` vs `jest.config.*` vs `--config`; `vitest.config.ts` vs `test:` in `vite.config.ts`; `rootDir` and `<rootDir>`; `extends` vs `mergeConfig` | `configs/01-where-config-lives.md` | ⬜ | — | — | — |
| 02 | **`jest.config` reference** — discovery · environments · transforms · resolution · mock state · coverage · performance · `projects` · reporters · Jest 29→30 | `configs/02-jest-config-reference/` | ⬜ | — | — | — |
| 03 | **The setup lifecycle** — `globalSetup` → `setupFiles` → framework install → `setupFilesAfterEnv` → test file → `globalTeardown`, with Vitest's equivalents beside it | `configs/03-setup-lifecycle.md` | ⬜ | — | — | — |
| 04 | **RTL configuration** — `configure()` · `setupTests.ts` anatomy · polyfill checklist · `RTL_SKIP_AUTO_CLEANUP` · `userEvent.setup()` options | `configs/04-rtl-configuration/` | ⬜ | — | — | — |
| 05 | **`vitest.config` reference** — environment · globals · `pool`/`isolate` · `server.deps.inline` · coverage · workspace · browser mode | `configs/05-vitest-config-reference/` | ⬜ | — | — | — |
| 06 | **The annotated configs** — one React+TS app configured twice, every line with a "why" row | `configs/06-annotated-configs/` | ⬜ | — | — | — |
| 07 | **Jest → Vitest, key by key** — config-level map first, then API-level | `configs/07-jest-to-vitest-map.md` | ⬜ | — | — | — |

### Sub-chunks

Chunked topics get their chunk rows added **here, at the moment the split is decided** —
not planned up front, because the split falls on whatever concept boundaries the written
content actually produces (global rule 1: write first, then split).

| Topic | Chunk | Status | Lines |
|---|---|---|---|
| — | *none yet* | — | — |

---

## Housekeeping items

| Item | Status | Note |
|---|---|---|
| Delete `docs/jest-rtl/syllabus/#-snippet.md` | ⬜ | `#` is a URL fragment character — the filename cannot ship. Replaced by `configs/README.md` |
| Create `configs/_category_.json` | ⬜ | `{"label":"Configs","position":3,"collapsed":true}` |
| Update `src/data/progress.js` jest-rtl row + `updated:` stamp | ⬜ | Global rules 9 and 15 |
| Update `docs/jest-rtl/README.md` — add the Configs section | ⬜ | |
| Update `docs/jest-rtl/pages/README.md` if 06 is superseded | ⬜ | Depends on how much of the 163-line page moves |
| Update `docs/README.md` jest-rtl row | ⬜ | |

---

## 🔴 Open decisions — work is blocked on these

Both are stated in full in the
[proposal](./configs-section-proposal.md).

| # | Decision | Options | Answer |
|---|---|---|---|
| 1 | What "move the existing vitest files" means — there is no standalone Vitest folder | **(a)** absorb, do not move *(recommended)* · **(b)** relocate `docs/vite/pages/14-testing-integration/` · **(c)** new top-level `docs/vitest/` | 🔴 **pending** |
| 2 | Is `configs/` a repo-wide convention or jest-rtl only? | **repo-wide** → README written as a reusable seven-slot template · **jest-rtl only** → bespoke | 🔴 **pending** |

---

## Session log

Newest first. One line per working session — what moved, and where it stopped.

| When | Session | What happened |
|---|---|---|
| 2026-08-20 07:51 | `13263a40` | Surveyed the repo, wrote [`configs-section-proposal.md`](./configs-section-proposal.md) (167 lines) and this tracker. **No content pages written** — blocked on decisions 1 and 2. Flagged at ~90% usage, so both files were committed before any writing began. |

---

## Contract reminders for whoever picks this up

- **300 lines is a file-size cap, never a content budget.** Write the explanation the
  option group deserves, *then* split on a concept boundary into `NN-topic/` chunks.
- **Section counts are not capped.** Gotchas, pitfalls, examples and Q&A run to as many
  entries as the topic actually has — never a uniform five per page.
- **No sandbox, no console blocks.** Validate against jestjs.io, vitest.dev and
  testing-library.com; name the source on every `> Verified:` line.
- **Every link ends in `.md`** and keeps every numeric prefix.
- **Update this file at pick-up and at completion** — not at the end of a batch.
