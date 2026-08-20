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
> Last updated: **2026-08-20 08:34**

---

## 🔴 START HERE — resume point

| | |
|---|---|
| **Next topic to pick up** | `03-setup-lifecycle.md` |
| **Currently working on** | 🔨 `configs/02-jest-config-reference/` — 6 chunks |
| **Blocked on** | — nothing. ✅ **Both decisions answered 2026-08-20** |
| **Target directory** | `docs/jest-rtl/configs/` |
| **Scope** | **Jest + RTL + Vitest combined in this one track.** No `docs/vitest/`, nothing moved out of `docs/vite/` |

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

**2 of 8 topics complete · 2 files written · 434 lines**

| # | Topic | Target path | Status | Files | Lines | Finished |
|---|---|---|---|---|---|---|
| — | **Configs index** — three config surfaces, which-runner decision table | `configs/README.md` | ✅ | 1 | 145 | 2026-08-20 08:09 |
| 01 | **Where config lives and how it resolves** — `package.json#jest` vs `jest.config.*` vs `--config`; `vitest.config.ts` vs `test:` in `vite.config.ts`; `rootDir` and `<rootDir>`; `extends` vs `mergeConfig` | `configs/01-where-config-lives.md` | ✅ | 1 | 289 | 2026-08-20 08:16 |
| 02 | 🔨 **`jest.config` reference** — discovery · environments · transforms · resolution · mock state · coverage · performance · `projects` · reporters · Jest 29→30 | `configs/02-jest-config-reference/` | ⬜ | — | — | — |
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
| 02 | `README.md` — index | ✅ | 72 |
| 02 | `01-discovery-and-environments.md` | ✅ | 197 |
| 02 | `02-the-transform-pipeline.md` | ✅ | 194 |
| 02 | `03-module-resolution.md` | ✅ | 209 |
| 02 | `04-mock-state-and-timers.md` | ✅ | 201 |
| 02 | `05-coverage.md` | ⬜ | — |
| 02 | `06-workers-and-projects.md` | ⬜ | — |

---

## Housekeeping items

| Item | Status | Note |
|---|---|---|
| Delete `docs/jest-rtl/syllabus/#-snippet.md` | ⬜ | `#` is a URL fragment character — the filename cannot ship. Replaced by `configs/README.md` |
| Create `configs/_category_.json` | ✅ | `{"label":"Configs","position":3,"collapsed":true}` |
| Update `src/data/progress.js` jest-rtl row + `updated:` stamp | ⬜ | Global rules 9 and 15 |
| Update `docs/jest-rtl/README.md` — add the Configs section | ⬜ | |
| Update `docs/jest-rtl/pages/README.md` if 06 is superseded | ⬜ | Depends on how much of the 163-line page moves |
| Update `docs/README.md` jest-rtl row | ⬜ | |

---

## ✅ Decisions — both answered

Background in the
[proposal](./configs-section-proposal.md).

| # | Decision | Options | Answer |
|---|---|---|---|
| 1 | What "move the existing vitest files" means — there is no standalone Vitest folder | (a) absorb · (b) relocate the Vite page · (c) new `docs/vitest/` | ✅ **(a) — combine.** *"Combine vitest jest and rtl"*. Vitest is written fresh **inside this track**; `docs/vite/pages/14-testing-integration/` stays put and gets a pointer link only |
| 2 | Is `configs/` a repo-wide convention or jest-rtl only? | repo-wide template · jest-rtl only | ✅ **jest-rtl only.** *"for now jest-rtl-vitest only"* — written bespoke to these three tools. Generalising to other technologies needs a new instruction |

---

## Session log

Newest first. One line per working session — what moved, and where it stopped.

| When | Session | What happened |
|---|---|---|
| 2026-08-20 08:34 | `13263a40` | `03-module-resolution.md` (209), `04-mock-state-and-timers.md` (201). 5 of 7 chunks in topic 02. |
| 2026-08-20 08:26 | `13263a40` | Topic 02 started — `README.md` (72), `01-discovery-and-environments.md` (197), `02-the-transform-pipeline.md` (194). 3 of 7 chunks. |
| 2026-08-20 08:16 | `13263a40` | Wrote **`01-where-config-lives.md` (289 lines)** — Jest's 4 config sources and the package.json/config-file trap, `rootDir` vs `<rootDir>`, Vitest's 3 sources and the `vite` vs `vitest/config` import, shallow `extends` vs deep `mergeConfig`, `projects`. **8 gotchas, 7 interview questions.** |
| 2026-08-20 08:09 | `13263a40` | Decisions answered — **combine Jest + RTL + Vitest in this one track**, jest-rtl only. Created `docs/jest-rtl/configs/` + `_category_.json`, wrote **`README.md` (145 lines)** — three config surfaces, runner decision table, the three-places-alias seam, chunk index, versions. 10/10 links verified. |
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
