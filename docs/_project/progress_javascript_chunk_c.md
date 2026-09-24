---
name: devbible-javascript-chunk-c
description: JavaScript chunk C (phases 7 async + 8 modules/errors/memory/toolchain) — ✅ COMPLETE 2026-08-15 (7: 22/22, 8: 18/18). Per-topic log, claims and traps. Session f7bca7a9.
metadata:
  type: progress
---

🔴 **Chunk C of the four-way JavaScript split.** The split itself, the worklists and the shared
rules are in [[devbible-javascript-split-4way]] — **read that first**; this file is only the
per-topic log and the traps found while writing chunk C.

🔴🔴 **CADENCE TIGHTENED TO PER *FILE*, 2026-08-15** — the user warned the account is **above 90%
usage and may hit the limit at any moment**: *"make sure your saving memory per file progress now
onwards"*. Write a file → boards → commit → **write this memory** → next file. A death must cost
at most one file.

📐 **Per-file commits and the link rule.** A chunk file is committed before its siblings exist, so
**write each file's footer with backward links only** — no `./README.md`, no forward `./02-*.md`
— and add the index/forward links in the same edit that creates the topic README at topic close.
That way **every committed state has zero broken links**, which matters because other sessions
build `main`.

**Held by session `f7bca7a9` from 2026-08-15** (took over from `f6dffd4a`). Claimed in both boards
(`docs/README.md` chunk C row, `docs/javascript/pages/README.md` chunk table) on takeover.

## Scope

| Phase | Topics left at claim | Order |
|---|---|---|
| **7 · Asynchronous JavaScript** | 11 — topics 12–22 | Understand 12–19, then Know 20–22 |
| **8 · Modules, errors, memory, toolchain** | 14 — topics 05–18 | Understand 05–14, then Know 15–18 |

Phase 7 is finished before phase 8 starts. Master is **closed** in both (7: 01–11, 8: 01–04) and
is not reopened for depth.

## Cursor

✅✅ **PHASE 7 IS COMPLETE AT EVERY TIER — 22/22.** Master 11/11 (pre-existing), Understand 8/8
(12–19) and Know 3/3 (20–22) written in this session. **69 files, 11,962 lines, 0 over the
300-line cap, 0 broken links inside the phase.**

✅ **TOPIC 13 · Bundlers and the build is DONE — phase 8 is 13/18.** 4 files, 639 lines,
0 over the cap: `01-what-a-bundler-does.md` 186 · `02-tree-shaking.md` 245 ·
`03-analysing-and-shrinking.md` 204 · `README.md`. Commits `9221a182`, `19146b8f`, `d83be401`,
`dfc4434b` (index + all four boards).

📐 **The planned single file `02-tree-shaking-and-size.md` was SPLIT into 02 + 03** — rule 1,
write it then split, on the concept boundary between *why code survives shaking* and *how you
find and remove weight*.

✅ **TOPIC 14 · Testing JavaScript is DONE — the UNDERSTAND TIER OF PHASE 8 IS COMPLETE (05–14),
phase 8 is 14/18.** 4 files, 667 lines, 0 over the cap: `01-the-shape-of-a-test.md` 199 ·
`02-faking-time-network-modules.md` 219 · `03-what-is-worth-testing.md` 185 · `README.md`.
Commits `e7e745aa`, `c4896d4e`, `ed2f9119`, `81ce9fbc` (index + all four boards).

✅ **TOPIC 15 · CommonJS in a modern world is DONE — phase 8 is 15/18.** 3 files, 457 lines,
0 over the cap: `01-the-commonjs-model.md` 190 · `02-interop-both-ways.md` 202 · `README.md`.
Commits `80681283`, `5b8dcde4`, `464ddbf0` (index + all four boards). Written as two chunks, not a
flat Know-tier file — the interop half is where the real errors live (rule 1: depth first, then
split).

✅ **TOPIC 16 · `AggregateError` is DONE — phase 8 is 16/18.** ONE flat file,
`16-aggregate-error.md`, 197 lines (Know tier, correctly not a directory — phase 7/10 already owns
the combinators). Commit `cbd45dd1` (page + all four boards).

✅ **TOPIC 17 · Mark-and-sweep and generational GC is DONE — phase 8 is 17/18.** ONE flat file,
`17-gc-mark-sweep-generational.md`, 183 lines. Commit `b43a5e12` (page + all four boards).

✅✅✅ **TOPIC 18 · Linting and formatting is DONE — PHASE 8 IS COMPLETE AT EVERY TIER, 18/18,
AND CHUNK C IS FINISHED.** `18-linting-and-formatting.md`, 1 flat file, 195 lines. Commit
`9def318a` — page + all four boards, and **`pagesPlanned` was dropped from the phase-8 row in
`src/data/progress.js`**, which is what marks the phase finished (rule 9).

## ✅ CHUNK C IS COMPLETE — nothing is queued

⚠️ **BUILD STATUS, stated honestly:** the whole-site `yarn build` was **never completed in this
session** — the first run was killed at the foreground timeout and the re-run was still going when
the session was asked to save. **What is verified:** every relative `.md` link inside
`docs/javascript/pages/phase-8-modules-errors/` resolves on disk (script-checked) and **no file in
the phase exceeds 300 lines**. Anyone picking this up should run the build and tally warnings **by
language** (rule 4) rather than assume it is clean. Session record:
[[devbible-session-20260815-javascript-chunk-c]].


| Phase | State |
|---|---|
| **7 · Asynchronous JavaScript** | ✅ **22/22** — Master 11 (pre-existing) + Understand 8 + Know 3 |
| **8 · Modules, errors, memory, toolchain** | ✅ **18/18** — Master 4 (pre-existing) + Understand 10 + Know 4 |

🔴 **If the user says "javascript C" again: say it is complete and let them choose.** Chunk C's lock
covers phases 7 and 8 **only** — do not drift into another chunk's phases (A: 5, 11 · B: 6, 17 ·
D: 12, 18); those belong to live sessions in the same checkout.

**Written in this session (`f7bca7a9`), phase 8 topics 13–18:** 13 Bundlers (4 files, 639) ·
14 Testing (4, 667) · 15 CommonJS (3, 457) · 16 `AggregateError` (1, 197) · 17 GC (1, 183) ·
18 Linting (1, 195) — **6 topics, 14 files, 2,338 lines, 0 over the 300-line cap**, per-file
commits throughout.


## Written in this chunk

| Topic | Files | Lines | Notes |
|---|---|---|---|
| **7 · 12 · Timers** ✅ 2026-08-15 | 4 (`12-timers/` + README) | 822 | 01 the API and clearing · 02 why `0` is not `0` · 03 drift and repeating work |
| **7 · 13 · Creating promises** ✅ 2026-08-15 | 3 (`13-creating-promises/` + README) | 533 | 01 the executor and its five rules · 02 promisifying a callback API |
| **7 · 14 · Cancellation** ✅ 2026-08-15 | 3 (`14-cancellation/` + README) | 548 | 01 the model (controller/signal/reason) · 02 composing and propagating signals |
| **7 · 15 · Timeouts, retries, backoff** ✅ 2026-08-15 | 3 (`15-timeouts-retries-backoff/` + README) | 486 | 01 what is safe to retry · 02 the wrapper (backoff, jitter, deadline) |
| **7 · 16 · Concurrency limiting** ✅ 2026-08-15 | 3 (`16-concurrency-limiting/` + README) | 506 | 01 why unbounded breaks · 02 the bounded pool |
| **7 · 17 · Race conditions in a UI** ✅ 2026-08-15 | 3 (`17-race-conditions-ui/` + README) | 497 | 01 the stale response · 02 the other UI races |
| **7 · 18 · `queueMicrotask`** ✅ 2026-08-15 | 3 (`18-queuemicrotask/` + README) | 442 | 01 choosing a deferral · 02 microtask hazards |
| **7 · 19 · Event loop: browser vs Node** ✅ 2026-08-15 | 4 (`19-event-loop-browser-vs-node/` + README) | 563 | 01 the browser loop · 02 the Node loop · 03 writing for both |
| **7 · 20 · `Promise.withResolvers`** ✅ 2026-08-15 | 1 (flat `20-promise-withresolvers.md`) | 199 | Know tier — flat file, no chunking needed |
| **7 · 21 · Thenables** ✅ 2026-08-15 | 1 (flat `21-thenables.md`) | 213 | Know tier — flat file |
| **7 · 22 · Async work and backpressure** ✅ 2026-08-15 | 1 (flat `22-backpressure.md`) | 232 | Know tier — **closes phase 7 at 22/22** |
| **8 · 05 · Dynamic `import()`** ✅ 2026-08-15 | 3 (`05-dynamic-import/` + README) | 493 | 01 the expression · 02 code splitting in practice |
| **8 · 06 · Circular imports** ✅ 2026-08-15 | 3 (`06-circular-imports/` + README) | 474 | 01 what actually happens · 02 diagnosing and fixing |
| **8 · 07 · `throw`, `try`/`catch`/`finally`** ✅ 2026-08-15 | 3 (`07-throw-try-catch/` + README) | 510 | 01 the statements · 02 `finally` and what it can override |
| **8 · 08 · Custom error classes** ✅ 2026-08-15 | 3 (`08-custom-error-classes/` + README) | 468 | 01 designing the taxonomy · 02 cause chains and boundaries |
| **8 · 09 · Failing well** ✅ 2026-08-15 | 3 (`09-failing-well/` + README) | 463 | 01 validate at the boundary · 02 results versus exceptions |
| **8 · 10 · Global error handling** ✅ 2026-08-15 | 3 (`10-global-error-handling/` + README) | 521 | 01 the handlers · 02 shipping errors to a reporter |
| **8 · 11 · The memory model** ✅ 2026-08-15 | 3 (`11-the-memory-model/` + README) | 494 | 01 stack, heap and what a variable holds · 02 cost is retention — **first topic written under the per-FILE cadence** |
| **8 · 12 · Finding a leak** ✅ 2026-08-15 | 3 (`12-finding-a-leak/` + README) | 380 | 01 proving there is one · 02 reading a snapshot — **zero reproduced tool output** |
| **8 · 13 · Bundlers and the build** ✅ 2026-08-15 | 4 (`13-bundlers-and-the-build/` + README) | 639 | 01 what a bundler does · 02 tree shaking and what defeats it · 03 analysing and shrinking — **planned as one file, split on the concept boundary**
| **8 · 14 · Testing JavaScript** ✅ 2026-08-15 | 4 (`14-testing-javascript/` + README) | 667 | 01 the shape of a test · 02 faking time, network and modules · 03 what is worth testing — **closes the Understand tier of phase 8** |
| **8 · 15 · CommonJS in a modern world** ✅ 2026-08-15 | 3 (`15-commonjs-today/` + README) | 457 | 01 the CommonJS model · 02 interop both ways — **first Know-tier topic of phase 8** |
| **8 · 16 · `AggregateError`** ✅ 2026-08-15 | 1 (flat `16-aggregate-error.md`) | 197 | Know tier — flat file, phase 7/10 owns the combinators |
| **8 · 17 · Mark-and-sweep and generational GC** ✅ 2026-08-15 | 1 (flat `17-gc-mark-sweep-generational.md`) | 183 | Know tier — flat file; the collector's view only, 8/04 owns reachability |
| **8 · 18 · Linting and formatting** ✅ 2026-08-15 | 1 (flat `18-linting-and-formatting.md`) | 195 | Know tier — **closes phase 8 at 18/18 and closes chunk C** |



## What phase 8 topic 18 asserts, and where each claim came from

Sources fetched and read this session: **ESLint** [Configuration Files] and the [Rules reference];
**Prettier** [Prettier vs. Linters].

- 🔴 **Prettier's sentence settles the whole configuration debate** and is quoted:
  *"use Prettier for formatting and linters for catching bugs!"* — with its reasoning, that a
  formatter *"alleviates the need for this whole category of rules"* by reprinting the program,
  while code-quality rules *"are likely to catch real bugs with your code"*. `eslint-config-prettier`
  is named as the mechanism for switching the overlapping rules off.
- **Flat config**: `eslint.config.js` (+ `.mjs`/`.cjs`/TS variants) in the project root, **exporting
  an array of configuration objects**.
- 🔴 **Order decides**, quoted: *"the configuration objects are merged with later objects overriding
  previous objects when there is a conflict"* — shared configs first, overrides last. This is the
  page's "why doesn't my rule work" answer.
- **An object without `files`/`ignores` applies to whatever the other objects match**;
  `languageOptions` carries `ecmaVersion`, `sourceType` (`script`/`module`/`commonjs`), `globals`
  and `parser`; severity is `"off"`/`"warn"`/`"error"` = `0`/`1`/`2`, options via `['error', {...}]`.
- **Default lint patterns are `**/*.js`, `**/*.cjs`, `**/*.mjs`** — anything else needs its own
  object with a glob, parser and plugin.
- **The bug-catching shortlist** (ESLint groups these under *Possible Problems*): `no-unused-vars`,
  `no-undef`, `no-dupe-keys`, `no-fallthrough`, `no-constant-condition`,
  `no-unsafe-optional-chaining`, `no-async-promise-executor`, `require-atomic-updates`, plus
  `eqeqeq`. 🔴 The async pair ties straight back to phase 7/13's "async executor is always a bug".

⚠️ **Deliberately NOT asserted:** which rules are in the `recommended` set and which are `--fix`able
**per rule**. The docs index marks these per rule, but the fetched summary flattened them
(it labelled every rule recommended *and* fixable, which is wrong — `eqeqeq` and `no-await-in-loop`
are not in recommended, and `no-unused-vars` is not auto-fixable). The page therefore says only that
ESLint *marks* which rules are fixable, and names no rule's status. **A second fetch would be needed
before making any per-rule claim.**

⚠️ **MDX trap found here:** a bold span wrapping inline code that itself contains `**`
(`**By default ESLint lints `**/*.js`…**`) risks mis-pairing the emphasis markers. Rewritten as
plain text. Watch for this whenever a glob appears in a heading or bold line.

## What phase 8 topic 17 asserts, and where each claim came from

Sources fetched and read this session: MDN **Memory management** (+ `WeakMap`, `WeakRef`) and the
V8 blog **Trash talk: the Orinoco garbage collector**. ⚠️ The page recommends **no flags** and
prints **no measurements** — the syllabus row caps it at *"enough to reason about allocation
patterns, not to tune a flag"*.

- **MDN's substitution is the spine of the page**: *"an object is no longer needed"* → **"an object
  is unreachable"**, walked from **roots** (MDN names the global object).
- **Reference counting is dead** — MDN: *"No modern JavaScript engine uses reference-counting for
  garbage collection anymore"*, and it cannot free cycles (MDN calls circular references *"a common
  cause of memory leaks"* under that scheme). Mark-and-sweep collects a cycle with no special case.
- **Generational hypothesis, quoted from V8**: *"most objects die young"* — most objects are
  allocated and almost immediately become unreachable.
- 🔴 **The load-bearing asymmetry:** the young collector's cost tracks **what survives** (it copies
  survivors and never visits the dead), the old collector's tracks **what the heap holds**. That is
  why short-lived allocation is close to free and why pooling can make things worse by promoting.
- **Promotion is by survival** — V8's scavenger: nursery → intermediate after surviving one
  collection → old generation after a second.
- **Pauses**: V8 marks **concurrently** (*"entirely in the background while JavaScript is
  executing"*), scavenges in **parallel**, sweeps into a **free-list**; what is left is **marking
  finalisation**, which V8 names as the main-thread pause of a major GC.
- **You cannot trigger collection** — MDN: *"not possible to programmatically trigger garbage
  collection in JavaScript — and will likely never be within the core language."* Hence: never
  assert on reclamation in a test.
- **Weak references**, MDN quoted: a weakly held `x` is not considered reachable *"if nothing else
  strongly holds to it"*; `WeakRef.deref()` returns `undefined` after collection. ⛔ The page states
  flatly that they are **not a performance trick** — if something survives, a strong retainer exists.

⚠️ **Deliberately NOT asserted:** any heap sizes, pause durations, generation sizes, promotion
thresholds beyond V8's own "two survivals", or engine behaviour outside V8 — the page says engine
internals are engine-specific and change.

## What phase 8 topic 16 asserts, and where each claim came from

Sources: MDN `AggregateError`, `Promise.any()`, `Promise.allSettled()`, `Error`, `Error.cause` —
fetched and read this session.

🔑 **Load-bearing claims, all MDN-validated:** `AggregateError` **subclasses `Error`**, so it
travels through existing handlers; the payload is the **`errors` array**; `Promise.any` rejects with
one when every input rejects, and 🔴 **`errors` is in the order the promises were PASSED, not
completion order** (MDN says so explicitly — that is what makes index-alignment safe); **an empty
iterable is *already rejected***; ⚠️ **never match the message** — MDN's own examples show
different wording for the same case; `race` settles on first *settled*, `any` on first *fulfilled*;
the producer pattern is `allSettled` → wrap each failure with context + `cause` → throw one
aggregate; 🔴 **`errors` (a set) and `cause` (a chain) answer different questions and a good report
keeps both**; the silent-truncation trap — a serialiser copying name/message/stack drops `errors`
entirely; `instanceof` is realm-fragile, so test `err.name` / `Array.isArray(err.errors)`.

## What phase 8 topic 15 asserts, and where each claim came from

Sources fetched and read this session: **Node.js** [Modules: CommonJS modules] and
[Modules: ECMAScript modules § Interoperability with CommonJS]; **TypeScript** reference
[`esModuleInterop`]. MDN `import` for the ESM side.

- 🔴 **The whole topic hangs on one sentence:** `require` is a **function call**, `import` is a
  **declaration**. Module scope, `__dirname`, cycles, caching, tree shaking and every interop error
  are consequences.
- **The module wrapper is documented**: `(function (exports, require, module, __filename, __dirname)
  { … })` — five parameters, five consequences, including **top-level `this` is `module.exports`**
  (vs `undefined` in an ES module).
- **`exports` vs `module.exports`** — assigning to `exports` rebinds the parameter and exports
  nothing; Node recommends assigning to `module.exports` when replacing, and shows
  `module.exports = exports = fn`.
- **Cache key is the RESOLVED FILENAME**, so `./foo` vs `./FOO` on a case-insensitive filesystem are
  two entries, and the same package from two `node_modules` locations is cached twice.
  🔴 **`require.cache` is NOT used by `import`** — Node states the ESM loader has its own cache.
  `node:`-prefixed built-ins bypass the cache.
- **Cycles return the unfinished `exports`** — Node's own a.js/b.js example, where `b` sees
  `a.done === false`. Contrasted with ESM's TDZ (phase 8/06 owns that).
- **Importing CJS from ESM**: default = `module.exports`; named exports come from *"a heuristic
  static analysis … against the source text"* → a **best-effort** list, so computed exports are not
  detected and the fallback is default-import + destructure. The
  `does not provide an export named` error is a **link-time SyntaxError**, uncatchable.
- **`require(esm)`**: docs record it **added v22.0.0, stable v25.4.0**; **synchronous ESM only**,
  top-level `await` → **`ERR_REQUIRE_ASYNC_MODULE`**; returns the **namespace object** (default on
  `.default`) unless the package uses the documented `'module.exports'` export name.
  ⚠️ The page carries a banner that version numbers move — check the runtime's own docs.
- **Missing-in-ESM table**, all from the docs: `require`, `__filename`, `__dirname`, `require.main`,
  `require.resolve`, `require.cache`, native addons, `NODE_PATH` — with `import.meta.filename` /
  `dirname` / `resolve` / `main` and `module.createRequire()` as replacements, plus the
  `new URL('./x', import.meta.url)` file-reading idiom.
- **`__esModule` interop**: transpiled ESM marks itself, helpers branch on the mark. TypeScript's
  `esModuleInterop` reference is quoted for the namespace-import problem (*"not valid according to
  the spec"*), the `__importDefault`/`__importStar` helpers, and that it implies
  `allowSyntheticDefaultImports`. This is the origin of the *"default import is not a function"*
  bug that differs between toolchains.
- **Dual-package hazard** restated from the two separate caches: two module states → singleton and
  `instanceof` failures; fix by forcing one condition, deduplicating, and branching on `code`.

## What phase 8 topic 14 asserts, and where each claim came from

Sources fetched and read in this session: **Vitest** [API § `vi`], [Guide § Mocking],
[Guide § Coverage]; **Jest** [Timer Mocks]; **Node.js** [Test runner]; **MSW** docs. MDN for
`Error`/`Math.random`/`Intl.DateTimeFormat`. **No test was run** — every sample is illustrative and
the pages say so.

- 🔴 **The unawaited-promise pass** is the topic's opening claim: a `.catch(...)` assertion inside a
  non-async test runs after the test returned, so the runner records a pass. Fix is
  `await expect(p).rejects.toThrow()` — **with the outer `await`** — and `expect(() => fn())` for a
  synchronous throw.
- **Isolation is per FILE, not per test** (runner model: find → transform → environment → isolate),
  which is why the cleanup rule is not optional.
- **Vitest's cleanup sentence is quoted verbatim**: *"Always remember to clear or restore mocks
  before or after each test run to undo mock state changes between runs!"*, plus the `restoreMocks`
  / `unstubGlobals` config.
- **`vi.useFakeTimers` replaces `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`,
  `setImmediate`, `clearImmediate` AND `Date`** (Vitest API). Jest swaps the timer functions and is
  restored with `useRealTimers()`. Node: `mock.timers.enable({apis:[...]})` + `tick()`.
- **`runAllTimers`** — Vitest's words, *"invoke every initiated timer until the timer queue is
  empty"*. 🔴 **Jest aborts on a self-rescheduling timer** with *"Aborting after running 100000
  timers, assuming an infinite loop!"* and documents `runOnlyPendingTimers()` as the fix.
- 🔴 **Advancing the clock does not flush microtasks** — hence `advanceTimersByTimeAsync`. This is
  the phase-7 task/microtask split reused, and it is the page's most useful non-obvious claim.
- **`vi.setSystemTime` does not reset between tests** (Vitest guide warns), which is the leaked-date
  failure.
- **MSW's own framing is quoted in substance**: intercept at the network level rather than
  *"patching `fetch` and meddling with your application's integrity"*; class extension in Node;
  handlers as *"a single source of truth for your network behavior"*. Practical payoff on the page:
  404/500/network-error are three different caller paths and `fetch` rejects only on the last.
- **`vi.mock` is hoisted** — *"The call to `vi.mock` is hoisted, so it doesn't matter where you call
  it"* — and therefore *"you cannot use any variables inside the factory that are defined outside
  the factory"*; `vi.hoisted()` / `vi.doMock` are the documented escapes, `importOriginal` the
  partial-mock shape. Node's three levels are `mock.fn` / `mock.method` / `mock.module`, with
  context-scoped auto-cleanup.

⚠️ **Marked as judgement, not documentation, IN THE PAGE ITSELF** (file 03 carries a banner saying
so): what deserves a test, the two lists, the flakiness table, coverage-as-diagnostic, and the suite
shape. Vitest's coverage guide documents *how* coverage is collected and takes **no** position on
thresholds — checked, and the page says the position is its own. This is the rule-8 "state it as
yours" case rather than an invented citation.

## What phase 8 topic 13 asserts, and where each claim came from

Sources: MDN [JavaScript modules], [Tree shaking], [Minification], [Source map], `import()`,
`Content-Encoding`; **Node.js Packages § `exports` / § `type`**; **webpack Guides § Tree Shaking**;
**Rollup Configuration options § `treeshake`**; **esbuild API § metafile / § analyze**; and
**web.dev · Reduce JavaScript payloads with code splitting**. All four non-MDN sources were fetched
and read in this session — nothing here is from memory.

- 🔴 **Tree shaking is *keeping*, not removing.** The bundler starts at the entry, follows static
  `import`/`export` edges and emits what it can prove reachable. MDN's definition is quoted in
  substance: it "relies on the `import` and `export` statements to detect if code modules are
  exported and imported for use between JavaScript files".
- **Why ESM only** — a specifier is a literal and bindings are known before execution; `require()`
  is a call and `module.exports` is mutable, so a CJS module's shape needs running it.
  webpack's guide names transpiling modules to CommonJS as the thing that kills shaking
  (`modules: false`).
- **Side effects are the real blocker.** Rollup's `treeshake.moduleSideEffects` default assumes
  imported modules may have side effects; only `false` retains code purely on used exports.
- **`sideEffects` in `package.json`**, webpack's wording quoted: *"If no direct export from a
  module flagged with no-sideEffects is used, the bundler can skip evaluating the module for side
  effects."* Three forms — `true` (default) · `false` · an array of globs.
- 🔴 **The CSS trap is documented, not folklore.** webpack warns that any imported file is subject
  to tree shaking, so `import './x.css'` is dropped under `"sideEffects": false`;
  `["**/*.css"]` is the fix. Same reasoning covers polyfills and registration files.
- **`sideEffects` beats unused-export elimination**, in webpack's own words — it "allows to skip
  whole modules/files and the complete subtree", while `usedExports` works statement-by-statement
  and cannot skip dependencies.
- **`/*#__PURE__*/`** marks a call removable when its result is unused (both webpack and Rollup);
  webpack also documents **`/*#__NO_SIDE_EFFECTS__*/`** on a function *declaration*. Rollup's
  `propertyReadSideEffects` and its **safest vs smallest** presets are named as
  correctness-for-size trades to reach for last.
- **The six defeats**, in the order met: a CommonJS dependency · a **re-export barrel** · a
  namespace import indexed dynamically (`icons[name]`) · your own top-level work · class
  fields/decorators/getters · development mode.
- **Three different "sizes"**: raw (parse/compile cost) · transfer after `Content-Encoding`
  (MDN lists `gzip`, `br`, `zstd`) · executed (coverage). Compression flatters a change that did
  not reduce parse work.
- **Minification ≠ tree shaking** — MDN's framing: it removes what is unnecessary for execution
  but not for a reader. It shrinks bytes without removing a module.
- **esbuild `metafile`** produces JSON of inputs, outputs, byte counts and import relationships;
  `--analyze` prints a human-readable form. ⚠️ Analyser counts are **pre-compression** and are
  used on the page only as *relative* weight.
- **Remove → defer → shrink**, and 🔴 **splitting moves bytes rather than deleting them** —
  web.dev's guidance is to send only what is necessary at the very beginning.

⚠️ **Deliberately not asserted anywhere in the topic:** any byte count, percentage, build time or
analyser output. The `> Verified:` lines say so explicitly on all four files, and the topic README
repeats it. ⚠️ The exact set of dependencies that are "usually" heavy is written as *shapes to
recognise* (duplicate copies, one-big-module, locale data, low transpile target, dev-only code,
inlined maps/assets) — **no named package is claimed to be a given size**.

## What topic 12 asserts, and where each claim came from

Documentation-validated only — **no sandbox, no timings, no console blocks** (rule 8).
Sources: MDN `setTimeout`/`setInterval`/`clearTimeout`/`Performance.now`/`requestAnimationFrame`,
the **HTML Standard § Timers** (timer initialisation steps), and the **Node.js `timers`** docs.

- **The delay is a floor, not a target.** The spec wording is "wait until *at least* `timeout`
  ms have passed, **then queue a task**" — two separate weakenings, and the whole topic hangs
  off that sentence.
- **The 4 ms nesting clamp is in the specification**, not folklore: once timers nest more than
  five levels deep, a requested delay under 4 ms is raised to 4 ms. Consequence used on the
  page: a self-rescheduling `setTimeout(…, 0)` loop settles around 250 iterations/second — this
  is stated as arithmetic from the clamp, **not as a measurement**.
- **Node's floor is different** — a delay below `1` becomes `1`.
- **32-bit ceiling: 2,147,483,647 ms ≈ 24.8 days.** Browsers fire immediately on overflow; Node
  clamps to 1 ms and warns `TimeoutOverflowWarning`.
- **Inactive tabs clamp timers to ≥ 1 s** (MDN), with Chrome intensive throttling layered on top
  and `requestAnimationFrame` stopping entirely.
- **Return values differ by runtime** — a positive integer ID in browsers, a `Timeout` object in
  Node with `unref()`/`ref()`/`refresh()`. Browsers share one ID pool between `setTimeout` and
  `setInterval`, which MDN notes and the page tells you not to exploit.
- **MDN's own advice on `setInterval`** ("ensure that execution duration is shorter than
  interval frequency") is quoted in substance: use a recursive `setTimeout` when the work can
  outlast the interval, because queued-up requests need not return in order.

⚠️ **Deliberately hedged, because documentation does not settle it:** the exact re-arm point of
`setInterval` relative to the callback. The page says only that `setInterval` aims at a period
between *starts* while a recursive `setTimeout` guarantees a gap after the previous run
*finishes*, and that **neither is a clock** — it does not assert engine-internal scheduling.

⚠️ **`this` in a timer callback:** MDN's documented value is the **global object in browsers**,
and strict mode does not change it because the platform is the caller. The page does **not**
claim a specific value for Node — it says only "not what you meant" and points at arrow
functions / `bind`.

## What topic 13 asserts, and where each claim came from

Sources: MDN `Promise()` constructor / `Promise.resolve` / `Promise.reject` / `Promise.try` /
`AbortController` / `Error.cause`, ECMAScript **§ Promise Objects**, Node `util.promisify` and
`fs/promises`.

- **Five rules of the executor**, and every constructor bug falls out of one of them: it runs
  **synchronously** during `new Promise`; settle-once makes later `resolve`/`reject`/throw silent
  no-ops; a throw rejects **only while pending**; **`resolve` adopts a thenable while `reject`
  never does** (MDN calls this asymmetry out); the executor's **return value is discarded**, so a
  branch that skips `resolve` hangs forever with no error.
- **`new Promise(async …)` is always a bug** — an async executor reports failure by *returning* a
  rejected promise, which the constructor discards: unhandled rejection outside, pending forever
  inside.
- **Resolving a promise with itself** → `TypeError: Chaining cycle detected`.
- **`Promise.resolve(p) === p`** for a native promise; a new following promise for a thenable.
- **`Promise.try(fn, ...args)`** is the sanctioned replacement for
  `new Promise(r => r(fn()))` — it routes a *synchronous* throw into the rejection.
- **Promisifying**: call the wrapped fn **inside** the executor so a sync throw becomes a
  rejection; keep the receiver; a promise carries **one** value (Node's answer is the
  `util.promisify.custom` symbol); prefer `fs/promises` / `timers/promises` over hand-rolling.
- **The event-wrapper leak and its fix**: listeners registered in an executor outlive settlement
  and pin `resolve`/`reject`; register them with `{ signal }` from an **internal**
  `AbortController` and `abort()` on settle, with an optional **external** signal for real
  cancellation. Check `signal.aborted` first — an already-aborted signal fires no event.
- **`Promise.race` against a timeout is not cancellation** — the work continues, only the result
  is ignored.
- **A repeating event cannot be a promise** (settle-once); that is an async-iterator shape.

⚠️ **Hedged deliberately:** the page says adoption "costs extra microtask ticks" without naming a
tick count, since the exact number is an implementation-visible spec detail not worth asserting.

## What topic 14 asserts, and where each claim came from

Sources: MDN `AbortController` / `AbortController.abort()` / `AbortSignal` (+ `reason`,
`throwIfAborted`, the `abort` event, the `abort`/`timeout`/`any` statics) / `DOMException` /
`addEventListener` § signal / `Promise.race`, and the **DOM Standard § Aborting ongoing
activities**.

- **A promise cannot be cancelled** — the premise the whole topic is built on. `AbortController`
  cancels the *operation*; the promise then rejects with `signal.reason`.
- **Two halves on purpose**: pass the **signal** (read-only), never the controller.
- **Abort is cooperative** — nothing preempts synchronous JavaScript; only signal-aware APIs stop.
- **Default reason is a `DOMException` named `AbortError`**; `AbortSignal.timeout(ms)` aborts with
  **`TimeoutError`** instead. 🔴 That difference is the page's practical payoff — retry a timeout,
  stay silent on a cancellation. Test with `err.name`, not `instanceof`.
- **An already-aborted signal fires no `abort` event** → every entry point checks `signal.aborted`
  / `throwIfAborted()` first. Stated as the most common hand-rolled-cancellation bug.
- **`throwIfAborted()` throws the signal's own reason** — the loop checkpoint after each `await`.
- **`AbortSignal.any([...])` takes the reason of whichever input fired first**, and handles an
  input that was already aborted.
- **`abort()` twice is a no-op; the first reason wins.**
- **`addEventListener(..., { signal })`** is the non-network use that makes a controller a
  *scope* handle — one `abort()` as whole-component teardown.
- **`Promise.race` + timer is not a timeout** — the loser keeps running, holds resources, and can
  reject later with no handler.

⚠️ **Hedged deliberately:** the GC/retention behaviour of `AbortSignal.any` composites against a
long-lived source signal. The page gives the practical rule (keep per-operation controllers
local, do not stash composites) without asserting a specific collection guarantee.

## What topic 15 asserts, and where each claim came from

Sources: MDN `fetch()` § Exceptions, HTTP request methods, `Retry-After`, 429, 503,
`AbortSignal.timeout`/`any`/`throwIfAborted`, `Error.cause`, `Math.random`; **RFC 9110 § 9.2**
(method properties) and **§ 10.2.3** (`Retry-After`); and the **AWS Builders' Library** article
*Timeouts, retries and backoff with jitter*.

- **Two questions gate every retry** — is the failure transient, and is repeating the operation
  safe. Both must be yes.
- 🔴 **`fetch` fulfils on 4xx/5xx and rejects only on a network failure (a `TypeError`)** — so a
  rejection-only predicate never sees a 503. The page's `isRetryable` classifies `Response` *and*
  error.
- **Never retry your own `AbortError`.** This is the payoff of the `TimeoutError` vs `AbortError`
  split recorded under topic 14.
- **`Retry-After` outranks computed backoff**, and comes in two forms — delta-seconds or an
  HTTP-date. The page caps it against the caller's deadline.
- **RFC 9110's idempotent set**: GET, HEAD, PUT, DELETE, OPTIONS, TRACE — POST and PATCH are not.
  A timeout on a non-idempotent write is the dangerous case; **an idempotency key is generated
  once per operation, never per attempt**.
- **Three distinct limits**: per-attempt timeout, total deadline, attempt cap. A per-attempt
  timeout alone leaves total time unbounded.
- **Retry amplification** — 3 layers × 3 attempts = 27 requests; own retries in one layer.
  Sourced to the AWS article, which is also the source for the thundering-herd argument.
- **Full jitter** — `Math.random() * min(cap, base · 2**n)` — is the variant the page recommends;
  the table also names fixed, plain-exponential and equal jitter.
- **The wrapper's five encoded decisions**: `throwIfAborted()` before each attempt, per-attempt
  timeout composed with the overall signal, the signal passed **down** into the attempt,
  `AbortError` rethrown first, and `new Error(msg, { cause })` on exhaustion.
- **Returns a non-retryable `Response` rather than throwing** — a 404 is an answer; turning
  non-`ok` into an exception is the caller's policy.

⚠️ **No numbers are asserted as measured** — `base`, `cap`, `timeoutMs` and `deadlineMs` appear
only as defaults in a code sample, and the page explicitly says to choose the per-attempt timeout
from observed behaviour rather than a round number.

## What topic 16 asserts, and where each claim came from

Sources: MDN `Promise.all` / `Promise.allSettled` / `Promise.race`, **Connection management in
HTTP/1.x**, Evolution of HTTP (HTTP/2), 429, Iteration protocols, `Array.prototype.entries`,
`AbortSignal.throwIfAborted`; Node **`http.Agent` § `maxSockets`**.

- 🔴 **`Promise.all` does not control concurrency — `.map` already started everything.** The
  combinator is the join, not the fan-out. This is the page's thesis.
- **Browsers cap HTTP/1.1 connections per origin (commonly 6)**, so an unbounded fan-out *queues*
  rather than failing — which is why it looks fine in development and starves the rest of the page
  in production. Under HTTP/2 the binding limit is the server's concurrent-stream setting instead.
- **Node has no safety net** — `http.Agent`'s `maxSockets` defaults to `Infinity`, so the failure
  is `EMFILE` or a dependency falling over.
- **`Promise.all` is fail-fast and cancels nothing** — one failure discards 9 999 successes while
  the work continues; `allSettled` is the honest bulk combinator.
- **Batching ≠ pooling.** Chunk-and-`Promise.all` waits for each batch's slowest member, so
  concurrency sawtooths N → 1 and total time is the sum of per-batch maxima.
- **The worker pool is N workers `for…of`-ing ONE shared iterator** (`items.entries()`), writing
  `results[i]` by index so output order matches input order, joined with `Promise.all` over the
  **workers** (N), not the tasks.
- **Per-item outcomes use the `allSettled` shape** and report with `AggregateError`.
- **"Stop early" needs an internal `AbortController` composed with the caller's signal** —
  otherwise it stops queuing but not the in-flight tasks.
- **In-flight dedup caches the promise and deletes it in `.finally`** — without that it becomes an
  unbounded cache that also caches failures.
- **N is chosen from the binding constraint** (documented rate limit, per-origin cap, HTTP/2
  streams, DB pool size, memory per item, cores) — 🔴 **no number is recommended**, deliberately.
- **Retries live inside the task**, or N workers become a burst of 3N.

⚠️ **Hedged:** the HTTP/2 concurrent-stream figure is given as "a settings value, often around
100" — server-configured, not a spec constant.

## What topic 17 asserts, and where each claim came from

Sources: MDN `AbortController` / `AbortSignal.throwIfAborted` / `fetch` / `addEventListener`
§ signal / `ETag` / `If-Match` / **412 Precondition Failed**; **RFC 9110 § 13** (conditional
requests).

- 🔴 **The one-sentence rule the whole topic reduces to:** *a response may only write shared state
  if it is still the newest request for that state — and if its scope is still alive.*
- **A single thread still races** — it forbids interleaved statements, not out-of-order
  completions. **Every `await` between a read and a write is the seam.**
- **Three defences, layered not alternative:** cancel the previous (`AbortController` — removes
  the race and stops the server work), ignore a mismatched key (needs a stable key, composes with
  caching), monotonic sequence number (works for unkeyed actions; one counter per screen region).
- **Compare against LIVE state, not a captured copy** — `if (q !== capturedQ)` is always true.
- **Loading flags and error banners race too** — an older call's `finally` clears a newer call's
  spinner. Guard every shared-state write with the sequence check.
- **Debouncing is a rate control, not a correctness control** — stated explicitly, because
  treating it as the fix is why the bug ships.
- **Double submit**: a disabled button guards the control, not the operation → single-flight the
  promise, and deduplicate server-side with an idempotency key.
- **Optimistic UI races in the ROLLBACK** — version the intent per item; only the newest attempt
  may correct the UI.
- **Lost update**: last-write-wins is a decision. `If-Match` + ETag → **412**, per RFC 9110.
- **Serialising per key** chains onto the previous promise with `prev.catch(() => {})` before
  `.then` — without that one failure freezes every later write to that key — and prunes the map in
  `finally` when the entry is still the tail.

⚠️ **Framework-neutral on purpose.** The "wrote to a component that is gone" section talks about a
scope and a teardown hook, not React — the old React unmounted-setState warning was removed in
React 18 and is not something to assert here.

## What topic 18 asserts, and where each claim came from

🔴 **Written as CONCEPT + CHOICE, not a second explanation.** Master topic **03/02 · Using
microtasks deliberately** already owns the drain order and MDN's two documented uses, so topic 18
links to it and covers only the *decision* and its consequences — the §11b shape rule (the phase 3
topic 10 precedent).

Sources: MDN `queueMicrotask()`, **Using microtasks in JavaScript**, `requestAnimationFrame`,
`requestIdleCallback`, `MessageChannel`, `MutationObserver`, `error` / `unhandledrejection`
events; **HTML Standard § Microtask queue**; Node `process.nextTick()` and `setImmediate`.

- 🔴 **The one question that resolves the choice: does the browser get to render between now and
  the callback?** Microtasks no; tasks and frame callbacks yes.
- **`queueMicrotask` over `Promise.resolve().then`** — no promise allocated, and 🔴 **errors route
  differently**: a throw in `queueMicrotask` is an **uncaught exception** (`error` event); a throw
  in `.then` becomes an **unhandled rejection**. Both global handlers are needed.
- **The "spinner never appears" bug** is the concrete payoff — neither sync code nor a microtask
  yields a rendering opportunity.
- **`await` is not a yield** — awaiting a resolved value resumes in the same drain. Said twice on
  purpose; it is the most commonly assumed-wrong fact in the topic.
- **Deferring inside a `.then` detaches the error from the chain** — the surrounding `.catch`
  never sees it.
- **`MutationObserver` callbacks are microtasks** (the source people miss); thenable adoption is
  another.
- **Node: `process.nextTick`'s queue drains BEFORE the promise microtask queue**, so it can jump
  ahead of an earlier `.then`; Node recommends `queueMicrotask` for new code. `setImmediate` vs
  `setTimeout(fn, 0)` order at top level is **explicitly stated as not guaranteed** — inside an
  I/O callback `setImmediate` wins.
- **Test flushing**: `await Promise.resolve()` = one microtask turn (not the whole chain);
  `await new Promise(r => setTimeout(r, 0))` also lets timers and rendering run.
- **`scheduler.postTask`/`yield` are feature-detect-then-fallback**, availability not assumed.

## What topic 19 asserts, and where each claim came from

Sources: **HTML Standard § Event loops — processing model** and § Microtask queue; **ECMAScript
§ Jobs and Agents**; the **Node.js guide *The Node.js Event Loop*** plus `process.nextTick()` and
`setImmediate()` API docs; MDN Execution model, `requestAnimationFrame`, `ResizeObserver`,
`requestIdleCallback`, `structuredClone`.

- 🔴 **The organising line: ECMAScript owns the promise job queue, the HOST owns everything else.**
  So *microtasks drain before the loop continues* is the **only** portable ordering fact; frames,
  phases, `setImmediate`, `nextTick` and throttling are host details.
- **Browser turn**: one task → microtask checkpoint → *if a rendering opportunity* update the
  rendering (rAF callbacks, ResizeObserver, style/layout/paint) → idle callbacks.
- 🔴 **Rendering is NOT once per task** — it happens at rendering opportunities the browser picks
  from the display refresh, and not at all while hidden. Several tasks can pass between paints.
- **Nested `rAF` is the idiom for *after* the paint** (the first callback still precedes it).
- **Multiple task queues exist and the browser may prioritise between them** — ordering is
  guaranteed *within* a queue only. The page says never to rely on a timer beating an input event.
- **Node's six phases**: timers → pending callbacks → idle/prepare (internal) → **poll** (where
  the loop waits) → **check** (`setImmediate`) → close callbacks.
- 🔴 **`setImmediate` vs `setTimeout(fn, 0)`: NOT guaranteed at the top level** (Node documents
  this explicitly — it depends on process performance), **deterministic inside an I/O callback**
  because check follows poll.
- **`process.nextTick` is outside the phases**, drained after the current operation regardless of
  phase and **before the promise microtask queue**; recursive use freezes the loop. Node
  recommends `queueMicrotask` for new code. Its one genuine use: deferring an emit so a caller can
  attach `.on('error')` first.
- **Blocking cost differs in blast radius, not in kind** — one tab vs every in-flight request on
  the process.
- **Not all Node I/O is on the loop** — fs and some crypto/compression use the thread pool
  (`UV_THREADPOOL_SIZE`, 4 by default); sockets do not.
- 🔴 **`typeof window === 'undefined'` is NOT a Node check** — also true in Web Workers, service
  workers and edge runtimes. Feature-detect the function you are about to call.
- **`setTimeout(fn, 0)` is the only task primitive both runtimes share** → the portable yield.
- **Fake timers do not fake microtasks** — an `await` is still needed after advancing the clock.

⚠️ **Hedged deliberately:** the exact set of callbacks delivered in the rendering step. The page
names `requestAnimationFrame` and `ResizeObserver` (both documented as running before paint) and
does not claim a position for `IntersectionObserver`.

## What topic 20 asserts, and where each claim came from

Sources: MDN `Promise.withResolvers()` and the `Promise()` constructor, `unhandledrejection`;
ECMAScript **§ Promise.withResolvers**.

- **It is the standardised deferred**; the hand-rolled version works *because the executor is
  synchronous* — which is the link back to topic 13.
- **It is generic**: the spec constructs using `this`, so `MySubclass.withResolvers()` yields a
  `MySubclass`. 🔴 The polyfill therefore uses **`new this`**, not `new Promise`.
- **Same decision as the constructor** — bridge a non-promise source, otherwise it is the
  explicit-construction anti-pattern. Its distinctive win is the **correlate-by-id** shape where
  the resolver must be *stored* (worker/WebSocket RPC, `postMessage`).
- **Three hazards**: a promise nobody settles is silent forever (add a timeout, clear it in
  `finally`); resolvers are **capabilities** — return only the promise; the pending `Map` leaks
  unless deleted on every path.
- **Rejecting before attaching `.catch` is fine within the same task** — unhandled-rejection
  detection runs at the microtask checkpoint. Later task = a genuine `unhandledrejection`.
- **ES2024**, widely available; the two-line deferred is the polyfill.

📐 **Format note: this is the first FLAT topic file in chunk C** (`20-promise-withresolvers.md`,
199 lines, no directory). Know-tier topics that do not exceed the cap are written flat — phase 3's
`10-debounce-and-throttle.md` is the precedent. ⚠️ **A flat file's links are one level shallower**:
`./13-creating-promises/…` and `../phase-8-modules-errors/…` — the first draft got the phase-8 link
wrong by copying a chunk file's `../../` form, and a forward link to the not-yet-written
`21-thenables.md` had to be removed rather than shipped broken.

## What topic 21 asserts, and where each claim came from

Sources: MDN `Promise.resolve()`, the `Promise()` constructor, `await`, Using promises;
ECMAScript **§ NewPromiseResolveThenableJob** and **§ Promise resolve functions**.

- 🔴 **A thenable is any object or function with a CALLABLE `then`** — the language never checks
  for `Promise`, which is exactly why jQuery's jqXHR, Bluebird and `$q` interoperate with `await`.
- **The five resolution steps**, each mapped to a failure mode: object check → **read `.then`
  once** (a throwing getter rejects) → **callable?** (if not, it is a plain value) → **queue a job
  to call it** (adoption is async and costs extra ticks) → **the resolving functions are one-shot**
  (a bad thenable cannot corrupt a native promise).
- **`resolve` adopts, `reject` does not** — restated as the same fact as topic 13 rule 4.
- 🔴 **An `async` function CANNOT return a thenable** — the return value is resolved, so the
  caller gets what the thenable settles with; a `then` that never calls back hangs forever with no
  error. **Wrapping (`{ value }` / `[x]`) is the only mechanism** — there is no "resolve as value"
  flag.
- **The deliberate lazy builder** (knex/Prisma-style `await db.select()…`) with three rules:
  return a real promise from `then` (never `this`), also provide `catch`/`finally`, and decide what
  a second `await` does. Plus the quiet bug: **never awaited = never ran**, and no floating-promise
  lint catches it because there is no promise.
- **`instanceof Promise` is the wrong check** — false for non-native thenables and **across
  realms** (iframe, `vm`). Duck-type `typeof v.then === 'function'`, or just `await`.
- **`Promise.resolve` is identity for a native promise, a new following promise for a thenable** —
  the boundary normaliser.

## What topic 22 asserts, and where each claim came from

Sources: Node **Stream § Buffering / `writable.write()`**, `stream.pipeline()`,
`Readable[Symbol.asyncIterator]`; MDN **Streams API concepts**,
`WritableStreamDefaultWriter.ready`, `CountQueuingStrategy`, `for await...of`.

- 🔴 **The framing that keeps it distinct from topic 16:** a concurrency limiter bounds what
  **runs**, not what is **queued**. Backpressure is the missing signal.
- **An unbounded queue is "a memory leak with a schedule"**, and stage 1 of the failure *looks
  like success* — which is why it survives testing.
- **Pull beats push.** `for await…of` is backpressure by construction (queue depth one); the
  `stream.on('data', async …)` handler's promise is ignored, which is the classic Node bug. The
  trade-off — pull is serial — is stated, with the pool-over-an-iterator answer.
- **Node: `writable.write()` returning `false` IS the signal** (buffer past `highWaterMark`, wait
  for `'drain'`); defaults **16 KiB for byte streams, 16 objects in object mode**. 🔴 Prefer
  **`pipeline()`** — it also destroys the chain on error, which `pipe()` does not.
- **Web Streams: `await writer.ready`**, `desiredSize`, queuing strategies; `pipeTo`/`pipeThrough`
  do it for you and take a `signal`.
- **The `await` on a whole result array is the bug** — page with a cursor / keyset / async
  generator; the generator suspends at `yield` until the consumer returns.
- **When the producer cannot be paused there are only three honest policies** — bounded+block,
  drop (oldest/newest), sample/coalesce. 🔴 "Keep everything" is not one of them.
- **Raising `highWaterMark` is not a fix** — it moves the threshold.

## What phase 8 topic 05 asserts, and where each claim came from

Sources: MDN `import()`, JavaScript modules, `import.meta`, namespace import,
`<link rel="modulepreload">` / `rel="preload"`, `navigator.connection`, the `error` event;
ECMAScript **§ import calls** and **§ Cyclic Module Records**.

- 🔴 **Static `import` is a DECLARATION, `import()` is an EXPRESSION** — the organising sentence.
- **It is an operator, not a function**: cannot be aliased, `.call`ed or passed as a value; wrap it
  in an arrow. It *does* work in classic scripts and CommonJS, unlike static `import`.
- **Resolves to the module namespace object** — sealed, read-only, **default under `.default`**
  (the most common slip).
- **Modules are singletons keyed by resolved specifier**, and 🔴 **a top-level throw is cached with
  the module** — re-importing rejects with the same error and does not re-run it.
- ⚠️ **Hedged: network-failure re-fetch behaviour is host-dependent** and the page says so rather
  than asserting it; the practical advice is *reload, don't retry*.
- **Load errors and init errors need separate `try` blocks** — one `catch` makes an infrastructure
  failure indistinguishable from an application bug.
- **Specifiers resolve relative to the importing MODULE**, not the page → `new URL(p,
  import.meta.url).href`, or `import.meta.resolve` for bare specifiers.
- **Import attributes (`with: { type: 'json' }`) are a SECURITY requirement, not a hint** — a
  mismatched response is rejected, not executed. Availability + the older `assert` spelling hedged.
- **The static-analysis rule**: a literal, or a template with a **static prefix and extension**;
  a fully dynamic specifier yields no chunk (works in dev, 404s in prod) — **and interpolating user
  input into a specifier is a security bug**. The explicit loader map is the recommended shape.
- **Chunk-load failure after a deploy** → 🔴 **reload once, guarded by a `sessionStorage` flag**,
  and report separately from application errors.
- **`modulepreload` fetches the module AND its dependency graph without executing** — that is what
  distinguishes it from `preload`.
- **Warming a load creates a floating promise** → attach a deliberate `.catch(() => {})`.
- **On the server it is start-up cost, not download cost**, and the CJS→ESM interop bridge.

## What phase 8 topic 06 asserts, and where each claim came from

🔴 Written as CONSEQUENCES, not mechanism — Master **02/02 · Deferred and hoisted** already owns
link-then-evaluate and "why a circular import lands in the TDZ", so topic 06 links to it.

Sources: MDN JavaScript modules, `import`, `import()`, `let` § TDZ, Hoisting; ECMAScript
**§ Cyclic Module Records** (`Link`, `Evaluate`); Node **Modules: CommonJS § Cycles**.

- **A cycle is not a load error** — fetching, parsing and linking all succeed; only *evaluation*
  can fail.
- 🔴 **The predictive table**: `function` declaration ✅ (initialised during linking) ·
  `class`/`const`/`let` 🔴 TDZ `ReferenceError` · `var` ⚠️ silent `undefined`. **This is why most
  cycles work by accident.**
- **When you read matters as much as what** — a top-level read runs mid-unwind; a read inside a
  function runs later and sees the live binding.
- 🔴 **The ENTRY POINT changes the answer** — depth-first evaluation means the same cycle throws
  from one entry and works from another. "A cycle that works is not a cycle that is safe."
- **`class B extends A` in a cycle fails reliably** — `extends` evaluates at class-definition
  time, so it is always an early read with no deferral available.
- **Top-level `await` inside a cycle can deadlock** — named as a shape to avoid.
- **CommonJS returns a PARTIALLY POPULATED `module.exports`** (Node docs), so the missing property
  is `undefined` with no error — harder to trace than ESM's `ReferenceError`. Plus the
  `module.exports = {…}` reassignment trap (earlier requirers keep the old object).
- **Detection**: bundler warnings → `eslint-plugin-import` `no-cycle` → `madge --circular`.
  🔴 Enable `no-cycle` **early**, or it gets disabled under a wall of errors. The stack trace names
  the *victim*, not the loop.
- **Four fixes ranked**: 1 extract to a third module (the only one that *removes* it) · 2 invert
  the dependency · 3 defer with a dynamic import (outside the static graph, but makes the caller
  async) · 4 move the read later (**explicitly labelled as not a real fix**).
- **Barrel files are a cycle factory** — never import your own barrel from inside it; keep barrels
  at package boundaries. Also hurts tree-shaking.
- **A cycle is acceptable only when everything crossing it is a hoisted function declaration and
  nothing reads across it at the top level** — and then document the constraint.

## What phase 8 topic 07 asserts, and where each claim came from

Sources: MDN `throw`, `try...catch` (incl. § The `finally` block), `Error`, `Error.cause`,
`Error.prototype.stack`, Control flow and error handling, `Promise.prototype.finally()`;
ECMAScript **§ The `try` Statement**.

- **`throw` accepts any value** — the cost table is practical: no stack, no `message`, no
  `instanceof`, reporters discard it, nothing to hang `cause` on. 🔴 **The stack is captured at
  CONSTRUCTION, not at the throw** — that is why a thrown string has no origin at all.
- **Rethrow with `{ cause }`**; `throw new Error(err.message)` destroys the original stack.
- 🔴 **A wide `try` block converts your own bugs into handled errors** — the worked example is a
  typo (`user.naem`) reported as a network failure. Narrow the `try`; rethrow what is not yours.
- **Optional catch binding is for when the error carries nothing you need** — distinguished
  explicitly from the empty-`catch` smell.
- **`catch` protects the LEXICAL block only** — a `setTimeout` callback's throw escapes, and
  🔴 **a rejection is caught only through `await`**; a floating promise is not covered.
- **A throw inside `catch` is unprotected** and hides the original → risky cleanup goes in
  `finally` or its own `try`.
- **The catch parameter is block-scoped and shadows** — name nested ones distinctly.
- **`finally` order**: return value computed → `finally` runs → the return happens.
- 🔴 **`return`/`break`/`continue`/`throw` in `finally` REPLACE a pending exception, silently.**
  Table included; `no-unsafe-finally` named.
- **`try`/`finally` with no `catch`** = "clean up but do not pretend to handle this".
- **`await` in `finally` delays propagation and its rejection can mask the real error** →
  fire-and-forget with a deliberate `.catch(() => {})` for non-essential teardown.
- **`promise.finally(fn)` vs the statement**: one promise vs a block; the callback takes no
  arguments and can only alter the outcome by throwing.
- ⚠️ **`using` / `await using` is hedged** as newer-than-everything-else, with `finally` named as
  the portable answer.

## What phase 8 topic 08 asserts, and where each claim came from

🔴 **Third CONCEPT+CHOICE topic in this chunk** (after 7/18 and 8/06). Master **03/02 ·
Custom errors** already owns the constructor, forwarding `options` for `cause`, `name` as a
literal, `captureStackTrace` and the transpilation trap — so topic 08 is the **design layer** and
says so at the top. ⚠️ Its syllabus row wording overlaps the Master page almost exactly; the split
is *mechanics there, taxonomy/boundaries here*.

Sources: MDN `Error`, `Error.cause`, `Error.prototype.name`, `instanceof`, `DOMException`,
`AggregateError`, `structuredClone`, the structured clone algorithm, `JSON.stringify`;
Node **Errors § `error.code`**.

- 🔴 **The test: what will the `catch` block do differently?** *If two classes always take the
  same branch, they are one class.*
- **Class vs `code` table**: a class answers "whose problem", a code answers "which failure";
  **only the code survives serialisation, realms and duplicated package copies**. Node's own
  `ENOENT`-style codes are the precedent.
- **Never branch on `err.message`.**
- **A shared base (`AppError`) makes `if (!(err instanceof AppError)) throw err` possible** — the
  single most useful branch, and the design version of the narrow-`try` rule from topic 07.
- **Never put secrets or whole payloads on an error** — they get logged and shipped to third
  parties; carry ids.
- **Errors live next to the code that throws them**; a shared `errors.js` grab-bag is unowned and
  a classic cycle source (ties back to topic 06).
- **Do not re-wrap platform errors** (`AbortError`, `TimeoutError`, `ENOENT`) unless translating
  at a boundary.
- **Wrap only where meaning is added**; walk a chain with a **depth cap** (re-wrapping can create
  a cycle).
- 🔴 **`cause` is diagnostics, not contract** — a caller branching on `err.cause.code` is coupled
  to your implementation; and the inner message must not reach a user.
- **The boundary table**: `JSON.stringify(err)` → **`{}`** (message/stack non-enumerable, but your
  own fields DO serialise) · structured clone keeps message/name/stack/cause but **flattens your
  subclass to plain `Error`** · `instanceof` fails across realms and duplicate package copies.
- **`AggregateError`** for several failures at once.

## What phase 8 topic 09 asserts, and where each claim came from

Sources: MDN `try...catch`, `JSON.parse`, `Response.json`, `fetch`, `URLSearchParams`,
`localStorage`, the `message` event, `Number.isFinite`, `Promise.allSettled`, `Error.cause`,
`AggregateError`, `console.error`, `unhandledrejection`.

- 🔴 **Parse, do not merely check** — the boundary emits a value whose shape is guaranteed, so
  nothing downstream re-verifies. That is the difference between "we validated it somewhere" and
  "it cannot be wrong here".
- **The boundary table**, with ⚠️ **versioned storage called out as the one people miss** — values
  written by a previous release survive upgrades; treat a version mismatch as absent.
- **Scattered defensive checks inside internal functions are a smell** — their fallbacks hide
  bugs (`return 0` turns a malformed order into a free one). ⚠️ **Exception: a library's exported
  functions ARE a boundary.**
- **`fetch` has three separate failures in three lines**: it rejects only on network failure (so
  `res.ok` is explicit), `res.json()` throws on a non-JSON body (the classic `Unexpected token <`
  from an HTML error page), and valid JSON can still be the wrong shape.
- **Fail-fast vs degrade is decided per boundary, by what the user loses** — a missing avatar
  falls back to a placeholder; **a missing price does not fall back to zero**. Config is strict:
  fail the boot.
- **`event.origin` is checked BEFORE `event.data`.**
- 🔴 **Expected failures are values; unexpected failures are exceptions; programmer errors are
  exceptions never caught locally.** Deciding question: *will most callers immediately
  `try`/`catch` this?*
- **Practical split: results at the boundary, exceptions inside.** ⚠️ Threading `{ ok: false }`
  by hand through five layers is exception handling reimplemented in `if`s.
- **`Promise.allSettled`'s shape is the standard-library result object** — copy it.
- **Every `catch` must handle, translate, report or rethrow**; a deliberate ignore **needs a
  comment**, because code cannot distinguish a decision from an oversight.
- **Log where you handle, not where you pass through** — layered logging is why logs stop being
  read; the same applies to one toast per layer.
- 🔴 **Fallbacks that lie**: `catch { return [] }` claims "there are none" for a failure to find
  out → model **loading / empty / error as three states**.
- **User-facing vs log-facing table**, plus: give the user a next action, and include a
  correlation id.

## What phase 8 topic 10 asserts, and where each claim came from

Sources: MDN `Window: error` event, `ErrorEvent`, `unhandledrejection`, `rejectionhandled`,
`PromiseRejectionEvent`, `HTMLElement: error` event, `crossorigin`, `securitypolicyviolation`,
`Navigator.sendBeacon`, `fetch` § `keepalive`, `visibilitychange`, `Error.prototype.stack`,
`crypto.randomUUID`, Source map; Node **`process` § `uncaughtException`** and
**§ `unhandledRejection`**.

- 🔴 **A global handler REPORTS; it does not handle.**
- 🔴 **Four non-overlapping browser channels**: `error` · `unhandledrejection` ·
  **capture-phase** resource errors (they do **not** bubble — hence the `true` argument, and
  `event.target` distinguishes them) · `securitypolicyviolation`. Installing only the first is the
  usual state of a codebase.
- **`onerror`'s legacy positional signature** vs the event; **suppression differs** —
  `return true` vs `event.preventDefault()`; the page advises **not** suppressing by default.
- **`rejectionhandled` exists because "unhandled" is decided at the microtask checkpoint** — a
  later `.catch` makes the first report a false positive.
- **`event.reason` can be anything** → normalise to an `Error` before reporting.
- 🔴 **"Script error." needs BOTH `crossorigin="anonymous"` AND `Access-Control-Allow-Origin`** —
  the highest-value fix for a dashboard full of blanks.
- **Node: since v15 an unhandled rejection throws by default**; **`uncaughtException` is NOT
  recovery** (Node's docs: the stack has already unwound) → report, flush, **exit**; let the
  supervisor restart. **Workers need their own handlers** (both `worker_threads` and Web Workers).
- **Install first, and the handler must never throw** — otherwise it re-enters itself in a loop.
- **What they cannot see**: worker scopes, `console.error`, swallowed errors, never-observed
  rejections, cross-origin iframes.
- **Reporting payload**: stack + flattened `cause` chain + `code` + 🔴 **release id** and
  🔴 **correlation id** (the two forgotten, the two support asks for) + route + breadcrumbs.
- **Never send** credentials/bodies/personal data; **scrub on the way OUT** because call sites
  cannot be audited. The form-submission payload is the classic leak.
- **Dedup on a stable key** (not the interpolated message), **rate-limit per session**, **sample
  and send the count** — ⚠️ silent sampling makes an error look ten times rarer.
- **`sendBeacon` / `fetch` `keepalive`, flushed on `visibilitychange` to hidden, not `unload`**
  (unreliable on mobile).
- **Upload source maps per release id**; do not serve them publicly.
- **Alert on new groups, spikes and rates — never raw counts.**

## What phase 8 topic 11 asserts, and where each claim came from

🔴 **Fourth CONCEPT+CHOICE topic.** Phase 1/02 owns values-vs-references and Master 04/01 owns
reachability/mark-and-sweep/WeakMap — topic 11 is explicitly *the model in between*, and hands the
profiler off to topic 12.

Sources: MDN **Memory management**, Data structures, Closures, Equality comparisons, `WeakMap`,
`WeakRef`, `FinalizationRegistry`, `structuredClone`, `Object.freeze`, `addEventListener` § signal;
ECMAScript **§ ECMAScript Language Types**.

- 🔴 **The reframing the topic exists for: an object's cost is not its size, it is what it keeps
  alive.**
- 🔴 **Stack/heap is a MODEL, not a specification** — stated explicitly, with the note that engines
  may use registers, avoid allocating small integers, share string representations or move objects.
  **This is the rule-8 guard on the whole page**: reason with the model, never depend on it, and
  make no performance claims.
- **Copy table**: spread/`Object.assign` (one level, nested shared) · `structuredClone` (cycles,
  `Date`/`Map`/`Set`, **throws** on functions/DOM/prototypes) · JSON round-trip (lossy list given).
  ⚠️ Plus: `structuredClone` **duplicates memory**.
- **Shallow size vs retained size** introduced here deliberately as vocabulary for topic 12.
- **The retainer chain** — break it *anywhere*, which is why nulling one variable frees nothing.
- 🔴 **The four anchors**: module state (a cache with no eviction is "a leak with a hit rate") ·
  closures · registrations (the registration IS the retainer) · the DOM (removal ≠ release; the
  whole subtree stays).
- ⚠️ **Closure trimming is hedged**: MDN's model is that the enclosing scope is retained; engines
  usually keep only what is referenced but **that is an optimisation, not a guarantee** — so the
  advice is to extract the small value before creating the closure rather than rely on it.
- **`FinalizationRegistry` callbacks may never run** (MDN) → never put required cleanup there.
- **The leak tell: growth per INTERACTION, not per unit of data loaded.**

## What phase 8 topic 12 asserts, and where each claim came from

🔴 **The rule-8 shape of this topic: it teaches a PROCEDURE and prints nothing.** Every number a
heap profiler shows is build/browser/machine specific and none was produced here — both chunks say
so in their `> Verified:` line and again in the body.

Sources: MDN Memory management, `Performance.measureUserAgentSpecificMemory`, `PerformanceObserver`,
`WeakRef`, `FinalizationRegistry`, `WeakMap`, `addEventListener` § signal, `Element.remove`;
Node `process.memoryUsage()`, `v8.getHeapStatistics()`, `v8.writeHeapSnapshot()`, Diagnostics —
memory.

- 🔴 **Three things look identical on a memory graph**: a leak (grows per *interaction*), a large
  working set (grows per *data size*), and lazy collection. **A single reading proves nothing.**
- **Compare TROUGHS, never peaks** — peak height depends on when the collector last ran.
- **The repeatable cycle, with the warm-up run discarded**, is the precondition for everything.
- **Forcing collection** — devtools control, Node's `global.gc()` behind `--expose-gc` — is **for
  measurement only**; behaviour must never depend on it.
- **The tools measure different numbers**: JS heap vs the agent-wide measurement vs Node's
  `external`/`arrayBuffers` (**outside** the JS heap — where an "invisible" leak usually lives).
  Detached DOM nodes are cheap in the JS heap and expensive in the browser → **watch node count**.
- **`FinalizationRegistry` as a diagnostic: silence proves NOTHING**; only a fired callback is
  information. **Instance counting is the sturdier version** and needs no tooling.
- **Three-snapshot technique**; a snapshot forces a collection first, which is what makes the diff
  trustworthy. **Counts that are a multiple of the cycle count** identify the retained unit.
- **Diff, do not browse** — a real heap is almost entirely legitimate.
- **Columns**: count for the ratio, retained size to choose a target, shallow size says little.
- 🔴 **Break the LEFTMOST wrong link in the retainer path** — a later one shrinks the leak and
  leaves the object retained. Naming closures/classes/collections is a debuggability decision that
  pays off precisely here.
- **`Detached` is the first thing to search**; a detached node retained by another detached node is
  not the leak.
- 🔴 **A fix is a CONSTANT count across cycles, not a smaller one** — "lower but still rising" is
  the classic false victory.
- **Node: the cycle is a request**; snapshots pause the process and cost disk.

## Traps and conventions for this chunk

- **Cross-chunk and not-yet-written references are bold plain text with *(not written yet)***,
  never links — that includes topics later in **my own** phases (13, 14, 15, 17, 18), because an
  unwritten target breaks the build just the same.
- **Same-chunk written targets used so far:** `../03-microtasks-vs-macrotasks/01-the-drain-order.md`,
  `../02-the-event-loop/01-stack-queue-heap.md`, `../11-anti-patterns/01-explicit-construction.md`,
  `../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md`,
  `../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md`.
- **Phase 7's README topic table was a single "12–22 deferred" row** — it is now expanded to one
  row per topic with ⏳ markers, so each close is a one-line edit.
- **Boards touched per topic:** `src/data/progress.js` (phase 7/8 rows only), the phase README,
  `docs/javascript/pages/README.md` (phases table + chunk C claim row), `docs/README.md`
  (chunk C row only). The 308-line over-cap file in `phase-5-built-in-library/18-object-statics/`
  belongs to **chunk A** — left alone deliberately.
- **Link check used instead of a full build** (other sessions are mid-write on `main`): a small
  Python pass that resolves every relative `.md` link in the new topic directory against the
  filesystem.

## Where this connects

[[devbible-javascript-split-4way]] — the split, the worklists, the shared rules.
[[devbible-javascript-build-progress]] and [[devbible-javascript-lane-b]] — history only, for
traps and concepts; their lane letters are dead.
