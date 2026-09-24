---
name: devbible-typescript-syllabus
description: The TypeScript syllabus — 13 phases, 187 topics, written 2026-08-13 and wired into the UI; the measured TS 7.0.2 version facts and the Part 3 boundary question
metadata:
  type: project
---

Written 2026-08-13 on the user's instruction ("pick up typescript, only typescript"),
**after** PostgreSQL phases 9/12 and while a co-session was writing the JavaScript
pages. Syllabus only — **no explanation pages exist yet**.

## Where it lives

`docs/typescript/` — `README.md` + `syllabus/01…04` + both `_category_.json` files.
Placed straight in its final home (the JavaScript precedent), **not** under
`reviews/proposed-syllabus/` the way PostgreSQL's was.

## Shape

**13 phases · 187 topics · 4 parts.** Master 54 (29 %) · Understand 95 (51 %) ·
Know 32 (17 %) · When Needed 6 (3 %). Inside the brief's 25–30 % Master band.

| Part | Phases | Topics | Master |
|---|---|---|---|
| 1 The type system — how TS runs, vocabulary, narrowing, generics | 0–3 | 57 | 27 |
| 2 Types at scale — classes/augmentation, type-level programming, modules & build | 4–6 | 46 | 7 |
| 3 In the stack — Node/Express, React, the untyped boundary | 7–9 | 44 | 15 |
| 4 Rigour and tooling — strictness, migration, tooling/performance | 10–12 | 40 | 5 |

Master is deliberately front-loaded: 27 of 54 sit in Part 1, because the vocabulary
and narrowing rows are the ones used hourly with no documentation open.

## Version facts — measured, not recalled (2026-08-13)

Ran in the scratchpad, not the repo sandbox (a syllabus needs no persisted scripts):

1. **`typescript@7.0.2` is `latest`.** Dist-tags: `beta` 6.0.0-beta, `rc` 7.0.1-rc,
   `next` 7.1.0-dev. Last 5.x is **5.9.3**.
2. **TS 7 is the native (Go) compiler.** The package ships platform binaries as
   optional deps (`@typescript/typescript-linux-x64` …), 3.6 MB installed, one bin `tsc`.
3. **The JavaScript compiler API is gone.** `require('typescript')` exports exactly
   **two** keys — `version`, `versionMajorMinor`. `ts.createProgram` is `undefined`.
   This is the fact to check before any AST tool (ts-morph, custom transformers,
   type-aware lint plugins) is recommended on a page.
4. **Node 24.19.0 runs `.ts` with no flag.** `node ok.ts` printed output and exited 0.
5. **Strip-only mode is real:** a file with `enum E { A }` fails with
   `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported
   in strip-only mode`. This is why `erasableSyntaxOnly` exists, and it made Phase 0.
6. Flags confirmed present in 7.0.2: `--erasableSyntaxOnly`, `--verbatimModuleSyntax`,
   `--isolatedDeclarations`, `--noUncheckedIndexedAccess`, `--exactOptionalPropertyTypes`.

## The open question — Part 3's boundary

Phases 7–9 type Express handlers, React components and DB rows, which overlaps three
other syllabi. Proposed rule, stated in the part file and the README: **"they own the
mechanism, TypeScript owns the typing of it"** — same shape as the PG/Node boundary
exception ([[devbible-postgresql-syllabus]]). Rows link out instead of re-explaining.
**Not yet answered.** If the user prefers, Part 3 collapses to one phase and the typing
rows move into React and Express.

## The phase that was added and removed the same session

A Phase 13 "Typing a real application" (commerce domain modelling — order state
machines, branded `Money`, cart pipelines, payment webhooks) was written after the user
mentioned building a Flipkart/Walmart clone, then **deleted on their correction**:
*"No need to add modelling thats not the point … its the way i have to learn my self to
do it."*

**The lesson, and it generalises:** "no knowledge gaps for building X" is a demand for
**complete coverage of the language**, not for a phase that models X. The syllabus
supplies the type-system capability; choosing the domain model is the user's own work,
and the brief already calls application layering project-based
([[devbible-scope-boundaries]]). Do not re-add a domain phase to any syllabus.

## UI wiring — done, on the user's instruction

"Make sure to upto date with UI so i can see all the time." Four files touched:

- `sidebars.js` — added `typescriptSidebar` (JavaScript still has **no** sidebar entry).
- `src/data/progress.js` — `typescript` block, 13 phases, every `pages: 0`.
- `src/pages/index.js` — card 03 activated with live `summarise('typescript')` stats.
- `docs/README.md` — the TypeScript row now links to the syllabus.

## Build state

Clean rebuild: **TypeScript produced zero warnings**; all five routes exist
(`/docs/typescript/` + four syllabus pages) and the `<Progress>` block renders 0 %.
Every remaining warning in the build belongs to **`docs/javascript/pages/`**, which a
co-session is writing concurrently — the user's standing instruction is to *skip a
failing build caused by their work and re-check a few minutes later*, not to fix it.

Related: [[devbible-brief]] · [[devbible-progress]] · [[devbible-scope-boundaries]] ·
[[devbible-never-compress-to-fit-cap]]
