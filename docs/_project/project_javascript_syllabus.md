---
name: devbible-javascript-syllabus
description: The JavaScript syllabus — 19 phases, 337 topics, 5 parts; the three-track structure plus the applied storefront phase, the boundaries against Node/Express/React, the settled verification policy, and Phase 0's 12 written pages
metadata:
  type: project
---

Written **2026-08-13**, in one session, after PostgreSQL phase 12. The user's ask was
*"work on javascript explanations — first we need to create syllabus just like how the
rest of other syllabus structured"*, followed mid-session by **"your focus is purely
with javascript"** — so nothing outside `docs/javascript/` was touched except the two
wiring steps `instructions.md` mandates for adding a language.

## Where it stands — Phase 0 pages are WRITTEN

**19 phases, 337 topics, 5 parts. Phase 0 complete: 12 pages, 2 536 lines.**
Clean build, zero `warning|broken`, site at **692 HTML pages**. Progress UI is live —
`src/data/progress.js` has a `javascript` entry with all 19 phases, the homepage card is
active, and `docs/javascript/README.md` + `pages/README.md` carry `<Progress lang="javascript" />`.

**Phase 1 COMPLETE — 17 pages, 3 563 lines.** Was: 6 of 17 written — the entire Master set at the checkpoint.** Sandbox `sandbox/js-p1/`, scripts `ex1`–`ex10`.

**Phase 2 COMPLETE — 15 pages.** Running total across phases 0–2: **44 pages, 9 332
lines**, all measured. **Next: Phase 3 — Functions, scope and closures (20 topics)**;
needs a new `sandbox/js-p3/`.

Phase 2's most useful measured results: `-7 % 3` is **-1** (remainder, not modulo);
`2 ** 3 ** 2` is **512** and `-2 ** 2` is a **SyntaxError**; `obj.b ||= 2` performs
**zero** setter writes where `obj.b = obj.b || 2` performs one; **`?.` guards only its
own link** — `v?.profile.name` still throws when `profile` is missing, and
`(u?.profile).name` throws even when `u` is null; `3 > 2 > 1` is **false** (comparisons
do not chain); `{} <= {}` is **true**; ASI turns `return` + newline into `undefined`, and
the five dangerous line starts were each measured — `+`/`-` fail **silently**.

Per-file resume state lives in [[devbible-javascript-build-progress]] — updated after
every page on the user's instruction.

## What exists

`docs/javascript/` — `_category_.json` (position **4**), `README.md`, `syllabus/` with
five parts, and `pages/` with the Phase 0 explanations. **Build verified clean** from
scratch, zero `warning|broken`; site at **692** HTML pages.

| Part | File | Phases | Topics | Master | Lines |
|---|---|---|---|---|---|
| 1 Language core | `01-language-core.md` | 0–4 | 84 | 29 | 184 |
| 2 Data & async | `02-data-and-async.md` | 5–8 | 79 | 26 | 167 |
| 3 Web APIs | `03-web-apis.md` | 9–12 | 75 | 18 | 167 |
| 4 DSA & machine coding | `04-dsa-and-machine-coding.md` | 13–17 | 81 | 20 | 189 |
| 5 Applied storefront | `05-applied-storefront.md` | 18 | 18 | 7 | 93 |

**337 topics · 100 Master (30%) · 170 Understand · 66 Know · 4 When Needed.** The
largest syllabus in the bible — three subjects (language, Web APIs, DSA) under one name,
which is what `instructions.md` §2 lists for JavaScript, plus the applied part.

**Part 5 was added 2026-08-13 on the user's framing:** *"the whole point is to work with
fullstack application without having any knowledge gaps — e.g. build an exact Walmart or
Flipkart clone."* Phase 18 is 18 framework-free storefront scenarios (product grid with
URL-as-state, search race conditions, cart state machine, money in minor units, optimistic
rollback, client idempotency key, virtualisation, SSE order tracking). **The user asked for
a recommendation on whether to cut 319 topics; the answer was the opposite — do not cut,
add the applied phase**, because cutting Phase 12/16 would create exactly the gaps the
Flipkart bar is meant to close.

Phases: 0 how JS runs · 1 values/coercion · 2 operators · 3 functions/closures ·
4 objects/prototypes · 5 built-in library · 6 iteration/generators · 7 **async** ·
8 modules/errors/memory · 9 DOM · 10 events · 11 network/storage · 12 browser platform ·
13 complexity · 14 structures · 15 patterns · 16 DP · 17 **machine coding** ·
18 **applied storefront**.

## The two decisions that shaped it

1. **The event loop is split down the language/runtime seam.** Job queue, microtasks
   and promise resolution are JS Phase 7. libuv phases, `setImmediate` and
   `process.nextTick` stay in Node Phase 2. Neither re-explains the other.
2. **Network is split at the wire.** `fetch`, `AbortController`, `FormData` and how
   CORS *fails in the console* are JS Phase 11; status-code design and the headers a
   server sends stay in Express. Consistent with [[devbible-scope-boundaries]] —
   pick the layer, never split one concept across two syllabi.

**Phase 17 is the brief's "custom functions" requirement made concrete** — `map`/
`bind`/`debounce`/`Promise.all`/`EventEmitter`/LRU implemented from an empty file. It
was given its own phase rather than being scattered, because it doubles as the test
that Parts 1–2 actually landed.

## Master tier needed rebalancing — it drafted at 32%

First pass came out **103 Master / 319 = 32%**, over the brief's 25–30% band. Ten rows
were demoted to Understand (`const` is not immutable, compound assignment, property
access, `slice`/`splice`/`at`, template literals, timers ×2, binary trees, recursion
tree, `EventEmitter`) → **93 = 29%**. **Count the badges with a script before writing
the distribution table into the README** — the drafted per-part header numbers were all
wrong and had to be corrected against `grep -o 't-master"' | wc -l`.

## Verification policy — SETTLED 2026-08-13, do not re-litigate

The user said **"for now continue without verifying"**. Read as *do not block on browser
tooling*, **not** as *invent output* — the never-invent rule is a hard global rule.
Written into `docs/javascript/README.md`:

| Parts | How |
|---|---|
| 1, 2, 4 | Run in **Node 24.19.0** in `sandbox/js-*/`; pages carry `> Verified:` |
| 3, 5 | What Node can run is measured; DOM/event/CORS output gets a `{/* VERIFY */}` marker and **no `Verified:` line** |

Part 4 gets a `node:test` suite instead of console transcripts, so correctness *and* the
complexity claim are asserted. Page 07 (loading scripts) is the first page written under
this policy — it carries a VERIFY marker and **no console block at all**.

## Traps hit while writing

- **A raw `|` inside a code span still breaks a markdown table cell.** `` `&&`/`||` ``
  and the bitwise row had to be written `` `\|\|` `` and `` `\|` ``. GFM unescapes them
  back to `|` inside the code span, and the build is clean — verified in the built HTML,
  89 `<tr>` = 84 topic rows + 5 headers.
- No precedent for that escape existed anywhere in the three older corpora, so there was
  nothing to copy.

## Phase 0 — the measured findings worth keeping

Sandbox `sandbox/js-p0/`, scripts `ex1`–`ex12`, all on Node 24.19.0 / V8 13.6.233.17.

1. **The stack ceiling is bytes, not calls.** A zero-local function reached **12 524**
   frames; one with 6 args + an array local reached **5 442** — same run. "About 10 000
   calls" is not a budget.
2. **`await` does not consume stack** — async recursion **200 000** deep returned fine,
   16× past the sync ceiling.
3. **`navigator` is `true` in Node 24** (added in Node 21). Every
   `typeof navigator !== 'undefined'` browser check is now inverted on the server. This
   is the single most useful fact in the phase and it recurs in Phase 3/6/10.
4. **Cold vs warm is 28×** on the identical function (0.208 ms → 0.0074 ms), reproduced
   across two runs — the concrete reason micro-benchmarks lie.
5. 🔴 **Dead-code elimination did NOT reproduce.** The folklore "return the value or V8
   deletes your benchmark loop" measured **30.10 ms discarded vs 29.13 ms returned** —
   no elimination on V8 13.6. Page 11 reports this as folklore that failed, per
   [[devbible-verify-your-own-measurements]]. Do not "correct" it back.
6. Everything through **ES2025 is present** on Node 24 (set methods, iterator helpers,
   `RegExp.escape`); **`Temporal` and decorators are absent** — the Stage-3 line drawn in
   one run, and why `Temporal` is tiered Know.
7. Strict mode measured in full, both directions: 3 of the 6 remaining differences are
   **`SyntaxError`s** (duplicate params, octal, `with`, `delete x`), so they fail at parse.

## Phase 1 — measured findings (sandbox/js-p1/)

1. **`null >= 0` is `true`, `null > 0` is `false`, `null == 0` is `false`.** Relational
   operators use `ToNumber` (so `0 >= 0`); equality has a special rule making `null` equal
   only `undefined`. A `null` silently passes a `>= 0` bounds check.
2. **`(1.005).toFixed(2)` is `"1.00"`** and `(8.345).toFixed(2)` is `"8.35"` — `toFixed`
   is not half-up, it inherits float representation error, and it returns a **string**.
3. **`JSON.parse` corrupts IDs past 2⁵³** — `9007199254740993` arrives as `...992`. The
   ES2025 reviver third arg (`ctx.source`) recovers it via `BigInt`; **this works on Node 24**.
4. **`[NaN].includes(NaN)` true, `[NaN].indexOf(NaN)` -1** — SameValueZero vs strict.
   Four equality algorithms differ only on `NaN` and `-0`.
5. **Family emoji `👨‍👩‍👧`: `.length` 8, spread 5, graphemes 1.** Three defensible answers to
   "how long is this string".
6. **Exactly 8 falsy values** measured: `false 0 -0 0n "" null undefined NaN`.
   `new Boolean(false)` is **truthy** (object).
7. **Defaults fire only on `undefined`** — `f(null)` returns `null`, not the default.
   Same for destructuring defaults. This is why API `null`s bypass defaults.
8. **`{} + []` is `0` as a statement but `"[object Object]"` as an expression** — measured
   both ways; the statement form is a block plus unary `+`.
9. **`parseInt('0o755')` and `parseInt('0b1010')` are both `0`** — parsing stops at the
   letter. `Number()` handles all three prefixes. Another reason `Number` is the default.
10. **`_1000` is a `ReferenceError`, not a `SyntaxError`** — a leading underscore makes it
   a legal identifier. Only `1000_`, `1._5` and `1__0` are syntax errors.
11. **`Math.max()` with no args is `-Infinity`**, so `Math.max(...[])` on an empty array
   returns `-Infinity` rather than throwing.

## Two never-invent slips caught during Phase 1 — both before shipping

1. Page 14: typed a JSON block as `{"n":NaN,"i":Infinity}` when `ex8` had printed
   `{"n":null,"i":null}`. **Retyping a console block from memory is how invented output
   gets in.** Re-run and copy from the terminal.
2. Page 16: asserted `Math.max()`, `Math.atan2` and `String(-0)` behaviour from knowledge
   with no script. Wrote `ex9-zero-infinity.mjs`; all 13 claims held, and the measured
   block is now on the page. Page 17 got the same treatment via `ex10-literals.mjs`.

**The rule that catches both: if a page states a behaviour, a script must exist for it —
even when you are certain.** [[devbible-verify-your-own-measurements]]

## Not done, deliberately

- Not committed — devbible commits need an explicit instruction ([[devbible-progress]]).
- Phases 1–18 unwritten.

## Concurrency note — two other sessions are in this repo

2026-08-13: sessions writing **TypeScript** and **CSS** are editing the same shared files
(`sidebars.js`, `src/data/progress.js`, `docs/README.md`). Edits merged cleanly by
touching only my own keys. **A build failure may not be yours** — one failed entirely on
`docs/css/` (missing `04-at-scale.md`, and `<Progress lang="css" />` with no `css` entry
in progress.js). The user's instruction: **wait a few minutes and re-check rather than
chase it**; it cleared on its own. Never fix another language's half-written files.

Related: [[devbible-brief]] · [[devbible-scope-boundaries]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-incremental-scope]]
