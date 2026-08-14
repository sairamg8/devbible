---
title: "Phase 3 — Functions, scope and closures"
sidebar_label: "Overview"
sidebar_position: 0
---

*20 topics.* The brief names **custom functions** explicitly, and this is where
that starts: not just calling functions, but designing and writing them.
[Phase 17](../../syllabus/04-dsa-and-machine-coding.md) finishes the job by
implementing the library ones from scratch.

This is the phase where JavaScript stops being "a language with C-like syntax"
and starts being its own thing. `this`, closures and the scope chain are the
three mechanisms every later phase assumes, and they are the three that
interviews actually probe.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Declarations, expressions and arrow functions](./01-declarations-expressions-arrows.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Parameters](./02-parameters/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[`this`](./03-this/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Arrow functions and `this`](./04-arrow-functions-and-this/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[`call`, `apply` and `bind`](./05-call-apply-bind/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[Closures](./06-closures/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[Lexical scope and the scope chain](./07-lexical-scope/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 08 | **[Hoisting and the temporal dead zone](./08-hoisting-and-tdz/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 09 | **[Higher-order functions](./09-higher-order-functions.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[Debounce and throttle](./10-debounce-and-throttle.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[Currying and partial application](./11-currying-and-partial-application.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[Composition (`pipe` and `compose`)](./12-composition.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[Memoization](./13-memoization.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14 | **[Recursion](./14-recursion.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 15 | **[Pure functions and side effects](./15-pure-functions.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 16 | **[There is no function overloading](./16-no-function-overloading.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 17 | **[Closure and default-parameter gotchas](./17-closure-and-default-gotchas/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 18 | **[IIFE and the module pattern](./18-iife-and-the-module-pattern.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 19 | **[Function properties](./19-function-properties.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 20 | **[`new.target` and constructor guards](./20-new-target-and-constructor-guards.md)** | <span className="db-tier t-know">Know</span> | ✅ |

## Status — **Master tier complete · Understand tier under way** (2026-08-14)

✅ **20 of 20 written — PHASE 3 IS COMPLETE at every tier.** All eight Master topics (01–08) are done, and the Master
tier of **every** phase 0–18 is now closed — so the standing Master-first plan is
finished and the work has moved to the **Understand and Know tiers**, phase by
phase. Topics 09–17 are the Understand tier, and it is now complete.

**Phase 3 is finished.** Next in lane A: **phase 4 · Objects, prototypes and classes**, topic 02 onward (Master 01, 03–08 are already written).

**Coverage:** Master **8 / 8** ✅ · Understand **9 / 9** ✅ · Know **3 / 3** ✅.

## Phase gate

**Move on when** you can write `bind`, `debounce` and a counter factory from an
empty file, and say what each closes over.

## How these pages are verified

Two provenances, both named in each page's `> Verified:` line — read that line to
know which one you are looking at.

- **Topics 01–07** were measured. Every console block on those pages was produced
  by a script in `sandbox/js-p3/`, run on **Node 24.19.0** (V8 13.6). Where a
  behaviour only exists in sloppy mode or CommonJS, there is a `.cjs` companion
  script — an ES module cannot demonstrate it, and presenting module output as if
  it showed sloppy-mode behaviour would be wrong.
- **Topic 08 onward is validated against documentation** — MDN and the
  specification, cited by name and link. No new measurement sandboxes are built,
  and **no run means no console block**: where there is no script, the page
  explains the behaviour in prose rather than showing output nobody produced.
  Where such a page needs a measured fact that an *existing* run already covers,
  it links to the page that owns that output instead of reproducing it.

## Where this connects

- [Phase 2 · Operators, expressions and control flow](../phase-2-operators/README.md) — precedence and ASI, which decide how a function expression parses
- [Phase 4 · Objects, prototypes and classes](../../syllabus/01-language-core.md) — where `new` and the prototype chain are finished
- [Phase 7 · Asynchronous JavaScript](../../syllabus/02-data-and-async.md) — closures are what make callbacks and promises hold state

---

Start → [01 · Declarations, expressions and arrow functions](./01-declarations-expressions-arrows.md)
