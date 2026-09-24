---
name: progress-javascript-phase3-worktree
description: devbible — JavaScript Phase 3, worktree handoff
metadata:
  type: progress
---


:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::
# devbible — JavaScript Phase 3, worktree handoff

**2026-08-13.** Working in a **git worktree**, at the user's explicit instruction
("make sure to work on different tree than current one").

| | |
|---|---|
| Worktree | `/mnt/Storage/Backup/Knowledge/devbible/.claude/worktrees/javascript-phases` |
| Branch | `worktree-javascript-phases`, based on `2285dac` |
| Commits | `2ccd649` (topics 02–05) · `9e14092` (topics 06–07 + rule-8 markers) · topic 07 chunk 2 |
| `node_modules` | **symlinked** from the main checkout — a worktree has none and `yarn build` needs it |
| **Merged** | ✅ **into `main` as `5650954`** (`--no-ff`, no conflicts), 2026-08-13 |

🔴 **The branch is merged but NOT deleted, and this worktree is still `locked`.**
If you resume here, you are branching from the **pre-merge** point — that is fine,
the next merge absorbs it. Do not delete the branch or remove the worktree.

## Scope decision — Master-first

The user rejected the full-corpus estimate (**~45 sessions / ~90 h**) and chose
**Master-tier only, run as parallel sessions**: ~64 Master topics left, ~11
sessions, ~22 h effort / ~8–10 h elapsed at 3× parallelism. Understand/Know tiers
are deferred and filled in on demand. Phases are largely independent — the
syllabus itself says Part 4 runs in parallel with anything.

## Where JavaScript stands

337 topics. Phases 0–2 pre-existing (44). **Phase 3 Master tier is COMPLETE
(01–08).** Phase 4 Master tier is **in progress**. Phases 5–18 untouched.

> 🔴 **The resume point is now Phase 4 topic 04 (shallow vs deep copy).** All work
> below happened **on `main`**, not in the worktree — `main` already carried the
> merge plus the `f719d8f` link fix, so branching from the pre-merge worktree would
> have re-broken six links. The worktree stays locked and untouched.

### Phase 3 — done

| Topic | State | Lines |
|---|---|---|
| 01 declarations/expressions/arrows | pre-existing, **corrected** | 279 |
| 02 parameters | ✅ chunked dir, 3 files | 596 |
| 03 `this` | ✅ chunked dir, 3 files | 573 |
| 04 arrow functions and `this` | ✅ chunked dir, 3 files | 508 |
| 05 `call`/`apply`/`bind` | ✅ chunked dir, 4 files | 675 |
| 06 closures | ✅ chunked dir, 3 files | 503 |
| 07 lexical scope | ✅ chunked dir, 3 files | 534 |
| **08 hoisting and the TDZ** | ✅ **chunked dir, 6 files** — first rule-8 topic | 1360 |
| 09–20 | **deferred** under Master-first (09–17 Understand, 18–20 Know) | — |

### Phase 4 — in progress

`docs/javascript/pages/phase-4-objects-and-classes/`, scaffolded this session.

| Topic | Tier | State | Lines |
|---|---|---|---|
| 01 object literals | Master | ✅ chunked dir, 4 files | 990 |
| 02 property access | Understand | deferred | — |
| **03 existence checks and `delete`** | Master | ✅ chunked dir, 3 files | 930 |
| **04 shallow vs deep copy** | Master | **← RESUME HERE** | — |
| 05 the prototype chain | Master | not started | — |
| 06 `class` | Master | not started | — |
| 07 `this` in methods, losing it | Master | not started | — |
| 08 `Object.keys`/`values`/`entries` | Master | not started | — |
| 09–20 | Understand/Know | deferred | — |

Note the topic numbers follow the **syllabus order**, so Master topics are 01, 03,
04, 05, 06, 07, 08 — 02 is an Understand topic and is deliberately skipped.

### Commits on `main` this session

`ae18809` topic 08 · `1397730` phase 4 scaffold + topics 01 and 03 ·
`9db85ac` the cap-violation split (below).

### 🔴 The mistake worth not repeating: I broke the 300-line cap

**Five files shipped at 327, 315, 411, 350, 362 and 349 lines** before I checked.
The depth was right; the *splitting* never happened. Fixed in `9db85ac` — 3 chunks
became 6 for topic 08, 2 became 4 for phase-4 topic 01, 2 became 3 for topic 03.
All ten now land **168–279**, and the spread is varied rather than clustered.

**The lesson is procedural, not conceptual:** I knew the rule and could recite it.
What I did not do was `wc -l` the files before committing. **Run
`find docs/<lang> -name '*.md' -exec wc -l {} + | awk '$1>300'` before every
commit** — it is the only thing that actually catches this, and it caught it here
only because I ran it late.

## 🔴 Rule 8 — sandboxing is closed

Set by the user 2026-08-13 across every session; written into `~/.claude/CLAUDE.md`
§8 and `MEMORY.md` non-negotiable 7 **by the parallel PostgreSQL session**, not
this one. Read it there — it is authoritative.

What it meant *here*:

- **`sandbox/js-p3/` was deleted mid-session and then restored.** The user said
  "I do not want sandbox"; rule 8 as written says existing sandboxes **stay**. The
  delete was the wrong half of the instruction. 9 scripts came back from
  `2ccd649`; **`ex6`, `ex7`, `ex7b` were uncommitted when deleted and had to be
  rewritten from context.** All 12 re-run clean. **Commit before deleting again.**
- **Topic 08 onward is documentation-validated**, not measured: cite MDN / TC39 /
  release notes by name, and **print no console block that no run produced.**
  Prose or a `VERIFY` marker instead. Benchmarks and timings are out of scope
  entirely — no document states "3× faster on your machine".

### 🔴 Do NOT mark provenance per page — user instruction, 2026-08-13

A per-page `sandbox-proven` marker was added to all 20 phase-3 pages and then
**removed at the user's explicit request**: *"you do not need to mark separately
what are with sandbox and what not."*

- Pages keep only their plain `> Verified: … Script(s): …` line. Nothing labels a
  page as proven vs unproven.
- **Validation status is tracked in one place instead** — this file. Everything
  from **topic 08 onward is UNVALIDATED until reviewed** against documentation,
  and that status lives here, not in the pages.
- Do not re-add per-page markers.

### Validation ledger

| Topics | Provenance | Validated? |
|---|---|---|
| Phase 3, 01–07 | measured, scripts in `sandbox/js-p3/` | ✅ + MDN re-review (table below) |
| **Phase 3, 08** | **documentation** — MDN pages named and linked per chunk | ✅ written and validated |
| **Phase 4, 01 and 03** | **documentation** — MDN + V8 blog, named and linked | ✅ written and validated |
| Phase 3, 09–20 · Phase 4, 04–20 · Phases 5–18 | to be written from documentation | ❌ not yet written |

**Rule-8 practice that worked and should be repeated:**

- **Fetch the MDN page and quote it**, rather than writing from memory and calling
  it validated. Every load-bearing claim in topics 08 / 01 / 03 came from an actual
  fetch, and several are quoted inline so a reader can check them.
- **MDN's own code examples are usable evidence** — they are documentation, not
  invented output. `Reflect.ownKeys`'s ordering example (showing `"-1"` sorting
  among the *strings*, not the indices) settled a claim I would otherwise have had
  to hedge.
- **When an existing sandbox run already covers a fact, link to the page that owns
  it** instead of reproducing the console block. Phase-4 topic 08's parameter-TDZ
  claim points at `02-parameters/01-defaults-and-scope.md`, which was measured.
- 🔴 **When documentation does not settle it, say so on the page.** The `delete`
  performance section states exactly what V8's *Fast properties* blog claims —
  frequent add/delete overhead, dictionary mode being slower because inline caches
  do not apply — and then **explicitly says** the blog does *not* claim a single
  `delete` demotes an object and gives **no multiplier**. That paragraph is the
  model for every performance claim from here on.
- Two fetches (the TC39 spec pages for `FunctionDeclarationInstantiation` and
  `OrdinaryOwnPropertyKeys`) returned only the table of contents, not the numbered
  steps. **Do not treat a fetch summary that reconstructs steps as a primary
  source** — I fell back to MDN quotes instead, which is the right call.

## Documentation re-review done this session (all confirmed against MDN)

| Claim | Verdict |
|---|---|
| Arrows have no **own** `this`/`arguments`/`super`/`new.target` — all **inherited**; `prototype` genuinely absent | ✅ confirmed |
| `call`/`apply`/`bind` cannot change an arrow's `this` | ✅ confirmed |
| No generator arrow syntax exists | ✅ confirmed |
| `bind`: name `"bound X"`, `length` reduced (min 0), `new` ignores bound `this` but keeps bound args, no own `prototype`, cannot be re-bound | ✅ all confirmed |
| `flatMap` **does** take `thisArg`; `reduce` does not (2nd arg is `initialValue`, callback gets `undefined` as `this`, → `globalThis` if non-strict) | ✅ confirmed |
| `fn.length`: counts only before the first default, rest excluded, each destructuring pattern counts as 1 | ✅ confirmed |
| `arguments` aliases **only** in non-strict functions with a *simple* parameter list (no rest/default/destructured) | ✅ confirmed |

## Six errors caught by running what an earlier pass had written

The reason the `sandbox-proven` pages are trustworthy — each was already written
and looked right:

1. A strict-mode row labelled "linked (sloppy-mode aliasing)" — modules are
   strict, nothing was aliased. Needed a `.cjs` companion to show the real `99`.
2. `JSON.stringify` printing `undefined` as `null` in two places, misreporting a
   missing argument as an explicit `null`. → `util.inspect`.
3. `flatMap`'s `thisArg` asserted wrongly; replaced with a 10-method probe.
4. The `call`/`apply` benchmark **confounded by constant folding** — constant
   args let V8 fold the direct call only, faking ~6×. Varying the argument and
   asserting equal checksums gave a real ~3×.
5. Page 01 claimed arrows "lack `super`/`new.target`" — they inherit both.
6. The heap experiment used a `Uint8Array`, whose backing store is **external
   memory** and invisible to `heapUsed` — reported `+0` for both arms twice
   before switching to plain objects (+0 vs **+69 MB**).

## Standing traps

- **`yarn build` prints `[SUCCESS]` with broken links present.** Always
  `rm -rf .docusaurus build`, then `yarn build 2>&1 | grep -iE 'warning|broken'`.
- Remaining phase-3 broken links are forward refs to unwritten topics 08–20 and
  resolve as those are written. Three TypeScript ones are pre-existing.
- 🔴 **Six links in this phase pointed at `05-call-apply-bind.md` and
  `07-lexical-scope.md` after both topics became directories** — fixed on `main` in
  `f719d8f`, each retargeted to `…/README.md`. **This branch still carries the
  broken form**; if you resume in the worktree, take the fix from `main` rather than
  re-breaking it. Files touched: `03-this/README.md`,
  `03-this/01-the-four-rules.md`, `04-arrow-functions-and-this/README.md`,
  `04-arrow-functions-and-this/02-syntax-and-when-not-to.md`,
  `06-closures/README.md`, `06-closures/02-state-and-memory.md`.
  **Chunking a topic is not done until you grep for inbound links to its old flat
  path** — see [[devbible-postgresql-repo-and-build]], where this is now the most
  repeated mistake in the corpus. `fixlinks.py` **cannot** catch it.
- **`instructions.md` §6 lines 151–155 still carry the OLD, WRONG link rule**
  ("routes drop the numeric prefix… `./ddl-from-node/`") — the form that broke 188
  links. Global rule (`.md` links, keep every prefix) wins. **Flagged to the user
  twice; not changed, because changing it was never instructed.**
- Every Master topic so far needed **2–6 chunks**, never one file. A rule-8
  documentation-validated Master topic runs **900–1400 lines total** — topic 08 came
  to 1360 across 6 chunks. Budget chunks, not depth.
- 🔴 **`wc -l` every file before committing.** See the cap-violation note above:
  `find docs/<lang> -name '*.md' -exec wc -l {} + | awk '$1>300'`.
- **Other sessions share this working tree.** During this session the broken-link
  count moved 21 → 31 → 19 from *other sessions'* uncommitted PostgreSQL and React
  edits, with no commits of theirs in between. So: `git add` **only your own
  paths**, never `git add -A`, and when the build reports broken links, check whose
  page they are on before assuming you caused them.
- **Phase and page READMEs are the cross-session handoff.** Both the phase-3 and
  phase-4 READMEs now carry a **Status** block saying what is written, what is
  deferred and *why* (Master-first), and `pages/README.md` carries the two
  provenances and the working order. Update these in the same commit as the
  content — a parallel session reads them, not this file.
