---
name: progress-jest-rtl-configs-section
description: devbible — Jest / RTL / Vitest configs section
metadata:
  type: progress
---

# devbible — Jest / RTL / Vitest configs section

**Started 2026-08-20 by session `13263a40`.** Status: 🔴 **6 of 8 topics written — 18
files, 3,303 lines.** Both decisions answered; **not blocked**. Checkpointed at the usage
limit 2026-08-20 09:21.

## What is left — exactly two topics

| # | Topic | Target | Notes for whoever picks it up |
|---|---|---|---|
| **06** | **The annotated configs** | `configs/06-annotated-configs/` | The payload page. One React + TypeScript app configured **twice** — full `jest.config.ts` + `setupTests.ts`, then full `vitest.config.ts` + the same setup file — with **every line carrying a "why it is there" table row**, exactly like `docs/typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md`. Chunk it: one chunk per config, plus a shared `setupTests.ts` chunk |
| **07** | **Jest → Vitest, key by key** | `configs/07-jest-to-vitest-map.md` | **Config level first**, then API level. The mappings already argued in the written chunks: `moduleNameMapper` → `resolve.alias`, `transformIgnorePatterns` (negation) → `server.deps.inline` (allowlist), `setupFilesAfterEnv` → `test.setupFiles`, `maxWorkers` → `poolOptions`, `coverageProvider` babel→v8 default flip, `collectCoverageFrom` → `coverage.include` |

**Then the 5 UI-board items** in the tracker's Housekeeping table — `src/data/progress.js`
(+ `updated:` stamp, rule 15), `docs/jest-rtl/README.md`, `docs/jest-rtl/pages/README.md`,
`docs/README.md`, and the `#-snippet.md` deletion.

## 🔴 Written so far — 18 files, 3,303 lines, largest 232, none over 300

| Topic | Files | Lines |
|---|---|---|
| `configs/README.md` | 1 | 145 |
| `01-where-config-lives.md` | 1 | 289 |
| `02-jest-config-reference/` | 7 | 1,252 |
| `03-setup-lifecycle.md` | 1 | 215 |
| `04-rtl-configuration/` | 4 | 706 |
| `05-vitest-config-reference/` | 4 | 696 |

Commits: `d2eaf379` `a2186b2f` `dc1f291e` `a8611f8a` `b5acd0cb` `59744e58` `d53ddc02`
`ca8521a2`.

## 🔴 START HERE

The live cursor is **in the repo, not here**:
`docs/jest-rtl/reviews/snipperts-progress.md`

That file carries the START HERE block, the 8-topic table with per-topic status
(⬜ / 🔨 working on it / ✅ completed), the housekeeping checklist and the session log.
**Open it first.** This memory file only records why the work exists and what was found.

The plan itself: `docs/jest-rtl/reviews/configs-section-proposal.md` (167 lines).

Commit: `1b06e145`.

## What the user asked for

A dedicated **config reference** for Jest, React Testing Library **and Vitest**, explained
option by option "just like tsconfig.json and its compiler options". Their framing:
*"each language may or may not have configs"* — so this is a potential new repo-wide
convention, a third sibling folder next to `syllabus/` and `pages/`.

They also asked, twice, that the **proposal itself live in a reviews folder** (not
`docs/reviews/`, and not moved into the docs tree) and that a **live progress tracker**
exist so work is resumable — they flagged being at ~90% usage.

## Survey findings (2026-08-20, verified by inspection)

- `docs/jest-rtl/syllabus/#-snippet.md` — a 5-line untracked stub the user created.
  ⚠️ **`#` is a URL fragment character; the filename cannot ship.** Still on disk,
  untracked, awaiting the decision to delete it.
- 🔴 **There is no standalone Vitest folder anywhere in the repo.** Vitest exists only as
  scattered prose: `docs/vite/pages/14-testing-integration/01-vitest-relationship.md`
  (99 lines, an argument not a reference), `docs/nodejs/pages/phase-9-testing/12-vitest-and-jest.md`,
  `docs/react/pages/phase-14-correctness/07-jest-or-vitest.md`. So "move the existing
  vitest files" has nothing to move — hence Decision 1.
- `docs/jest-rtl/syllabus/04-production-ci.md` has **three syllabus rows promising
  `vitest.config.ts`, none written**.
- Existing config coverage is **one 163-line page**,
  `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md` — narrative, and
  missing `setupFiles` vs `setupFilesAfterEnv` ordering (its own syllabus marks that
  **Master**), `projects`, `coverageProvider`, the clearMocks/resetMocks/restoreMocks
  distinction, RTL `configure()`, and Vitest entirely.
- **The model to copy:** `docs/typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/`
  — its `04-the-annotated-configs.md` prints complete configs and gives **every line a
  "why it is there" table row** — paired with
  `docs/typescript/pages/phase-0-how-typescript-runs/06-tsconfig-anatomy.md`.
- **Folder convention:** all 29 technologies have `pages/`, most have `syllabus/`, only
  `expressjs` / `nodejs` / `postgresql` had `reviews/`. **`jest-rtl` is now the fourth.**
  **No technology has a `configs/`** — this would be the first.

## The 8 planned topics

Target `docs/jest-rtl/configs/`, position 3, `_category_.json` label "Configs".

README (index + runner decision table) · 01 where config lives and resolves · 02
`jest.config` reference (chunked) · 03 the setup lifecycle · 04 RTL configuration
(chunked — `configure()`, `setupTests.ts`, polyfills, `userEvent.setup`) · 05
`vitest.config` reference (chunked) · 06 the annotated configs (the payload — one
React+TS app configured twice, every line justified) · 07 Jest→Vitest key by key.

**The cross-cutting trap worth space in 06:** a path alias must be declared in *three*
places — `tsconfig.json#paths`, `jest.config#moduleNameMapper`, `vite.config#resolve.alias`
— and Vitest collapses that to two. It is the concrete version of the drift argument
`docs/vite` currently makes abstractly.

## ✅ Decisions — both answered 2026-08-20

The user's words: *"Combine vitest jest and rtl for now jest-rtl-vitest only"*.

1. **Combine.** Vitest is written **fresh inside this track**. `docs/vite/` was **not**
   touched — its testing-integration page stays put and receives a pointer link only.
   No `docs/vitest/` was created.
2. **jest-rtl only.** Written bespoke to these three tools; **not** a repo-wide `configs/`
   convention. Generalising needs a new instruction.

⚠️ **One open reading, flagged to the user and not acted on:** "jest-rtl-vitest" was read
as *scope*, so the folder is still `docs/jest-rtl/`. If the user meant renaming the
technology folder to `docs/jest-rtl-vitest/`, that is a separate pass across
`sidebars.js`, `src/data/progress.js`, `docs/README.md` and inbound links.

⚠️ **`docs/jest-rtl/syllabus/#-snippet.md` is STILL on disk, untracked.** `#` is a URL
fragment character and Docusaurus reads the filesystem, not git — so it will be picked up
on the next build. Left in place because deleting a user's file was not instructed.

## Contract for the pages

Documentation-validated only (jestjs.io, vitest.dev, testing-library.com), version-stamped
Jest 30 / Vitest 3 / RTL 16. **No sandbox, no console blocks** (rule 8). 300-line cap is a
file-size rule — write then split (rule 1). Section counts uncapped (rule 13). Every link
ends in `.md`.

## Claim state

`docs/README.md` line 153 shows Jest & RTL as *"Syllabus & Explanations Validated"* under
the frontend-toolchain lane (session `0fe4e7e0`, 2026-08-14). **No row was added for this
work yet** — do that before writing content pages.
