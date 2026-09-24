---
name: devbible-session-20260815-js-chunk-b
description: Session 233dede7 — JavaScript chunk B finished (phase 17 closed 18/18). What was written, the sources quoted, and what is left in JavaScript.
metadata:
  type: progress
---

# Session `233dede7` — 2026-08-15 · JavaScript chunk B, finished

**Instruction:** *"Pick javascript b and review memories and instructions for hard rules"* — the
§11b trigger, so no clarifying question was asked. Cursor read from
[[devbible-javascript-split-4way]]: **phase 17 · topic 14 · `promisify`**.

**Claim taken over from session `7c6611b4`** before any writing, in both boards (the chunk table in
`docs/javascript/pages/README.md` and the chunk-B row in `docs/README.md`), commit `b47a92d8`.

## 🏁 Outcome — chunk B has no work left

| | |
|---|---|
| Phase 6 · Iteration, destructuring and generators | ✅ **13/13** (closed by the previous session) |
| Phase 17 · Machine coding | ✅ **18/18, every tier** — Master 4/4 · Understand 11/11 · Know 3/3 |
| Written this session | **5 topics · 15 files · ~2,760 lines · 0 over the 300-line cap** |
| Commits | 16 in devbible, 13 in the store — **per-file cadence held throughout** |

| Topic | Lines | Shape |
|---|---|---|
| **14 · `promisify` and a callback↔promise bridge** | 614 | `01-writing-it` 286 · `02-what-it-cannot-bridge` 262 · README |
| **15 · A rate limiter** | 598 | `01-the-token-bucket` 272 · `02-windows-and-the-server` 261 · README |
| **16 · `new`, `Object.create` and `instanceof` by hand** | 478 | `01-new-and-object-create` 226 · `02-instanceof` 198 · README |
| **17 · A tiny pub/sub and a reactive `signal`** | 580 | `01-from-pubsub-to-tracking` 251 · `02-making-it-real` 271 · README |
| **18 · A virtual-DOM diff in outline** | 458 | `01-the-diff` 196 · `02-keys-and-the-cost` 209 · README |

Every chunk carries its own tier badge, `> Verified:` line, Gotchas (symptom → cause → fix) and
Interview questions — verified mechanically across all 15 files before the phase was closed.

## The overlap decision that shaped topic 14 — reuse it

**Phase 7 · 13 · `13-creating-promises/02-promisifying.md` (chunk C's phase, already written) owns
*which shapes exist and when to wrap*.** It even forward-references this topic as *(not written
yet)*. So phase 17 · 14 was written as **the implementation**, and links there for the decision
layer. That is the same CONCEPT-and-CHOICE rule phase 5 used against phase 4 — **when an
Understand/Know topic overlaps one that exists, write the half the other page does not own and
link, never a second implementation.**

## Sources fetched and quoted this session (primary, not memory)

- **Node `util.promisify` / `util.callbackify` / `child_process.exec` docs** — the error-first
  contract, *"If `original` is a function but its last argument is not an error-first callback, it
  will still be passed an error-first callback as its last argument"*, the registered
  `Symbol.for('nodejs.util.promisify.custom')`, the falsy-rejection `reason` wrapping, and exec's
  `{stdout, stderr}` promise. ⚠️ **No `fs.exists` sentence could be confirmed in the current docs —
  do not quote one.**
- **Node source `lib/internal/util.js`** — `if (err)` truthiness, `resolve(values[0])`,
  `ReflectApply`, prototype + own-descriptor copying, the self-referential `[promisify.custom]`
  stamp (idempotence), the internal non-public `Symbol('customPromisifyArgs')`, and **DEP0174**.
- **MDN** — `Promise()` (executor synchronous · throw rejects *unless already settled* · settle
  once), `performance.now()` (*"a monotonic clock: its current time never decreases and isn't
  subject to adjustments"*, coarsened 5 µs / 100 µs), `429`, `Retry-After` (two syntaxes),
  `Geolocation.getCurrentPosition` (the two-callback shape), `new` (the four numbered steps),
  `new.target`, `Object.create` (descriptors; *"By default properties are not writable, enumerable
  or configurable"*), `instanceof`, and `Function.prototype[Symbol.hasInstance]` (*"all functions
  inherit from `Function.prototype` by default"*; non-configurable and non-writable).
- **IETF `RateLimit` header fields** — an **Internet-Draft, not a standard**: *"Clients MUST NOT
  assume that a positive remaining value is a guarantee that further requests will be served"* and
  the fields *"do not mandate any correlation between the RateLimit header field values and the
  returned status code."*
- **TC39 proposal-signals — Stage 1**: auto-discovery of dependencies, *"Computation is
  'glitch-free'"*, not eagerly evaluated, and *"The API is not targeted to most application
  developers."*
- **React docs** — Reconciliation (*"the state of the art algorithms have a complexity in the order
  of O(n3)"*, the two assumptions, tear-down on a type change, attribute-only update on a match)
  and Rendering lists (the rules of keys, the index-as-key pitfall, the `Math.random()` passage).

No sandbox, no timings, **no console blocks anywhere** — rule 8 held.

## Verification

- **Link sweep: 4,395 relative links, 0 broken under phase 6 or phase 17.** The breaks the sweep
  reported were `phase-11-network-storage/14-same-origin-and-postmessage/` (chunk A) and
  `phase-12-browser-platform/16-clipboard-share-files/` (chunk D) — other sessions mid-write, left
  alone deliberately.
- **300-line cap: 0 files over**, checked before every commit with
  `find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'`.
- ⏳ **The isolated production build did not finish inside the session.** Four sessions were
  building the same checkout; the first run was killed after ~20 min and a second
  (`DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-jsb yarn build --out-dir build-jsb`) was still
  compiling at hand-off. **It was never reported as green** — the artifact check
  (`ls build-jsb/index.html`) is the one that matters, per the lane-B lesson that a killed build
  greps identically to a clean one.

## Boards updated (after every topic, all four)

`src/data/progress.js` — phase 17 `pages: 18`, `pagesPlanned` removed at the close · the phase
README (status line, every topic row, the verification paragraph rewritten to name the new
sources) · `docs/javascript/pages/README.md` (phase table, chunk table, chunk-claims table) ·
`docs/README.md` (the chunk-B row **and**, at the phase close, the JavaScript technology row —
now **266 of 316 in scope, 495 leaf pages**, phases **0–10, 16, 17** complete at every tier).

`~/.claude/CLAUDE.md` §11b and its store backup both show chunk B as finished.

## 🔴 What is left in JavaScript, and who holds it

| Chunk | Phases | State |
|---|---|---|
| **A** | 5, 11 | phase 5 ✅ 26/26; phase 11 Know tier in progress — session `3d9f98b8` |
| **B** | 6, 17 | ✅ **FINISHED** |
| **C** | 7, 8 | phase 7 ✅ 22/22; phase 8 ✅ 18/18 as of this session's last look |
| **D** | 12, 18 | phase 12 Know tier in progress; phase 18's three kept topics after — session `dbaa68e7` |

Phases **13, 14, 15 are parked** and **16 is dropped** — reopening any of them needs a new
instruction from the user.

**If the user says "javascript B" again, there is nothing queued.** Say so and let them choose:
another chunk (all currently held by live sessions), a review pass over phases 6 and 17, or a
parked phase.

Related: [[devbible-javascript-split-4way]] · [[devbible-javascript-lane-b]] ·
[[devbible-javascript-build-progress]] · [[devbible-parallel-sessions]] ·
[[devbible-never-compress-to-fit-cap]]
