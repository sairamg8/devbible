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
| 05 | `call`, `apply` and `bind` | <span className="db-tier t-master">Master</span> | planned |
| 06 | Closures | <span className="db-tier t-master">Master</span> | planned |
| 07 | Lexical scope and the scope chain | <span className="db-tier t-master">Master</span> | planned |
| 08 | Hoisting and the temporal dead zone | <span className="db-tier t-master">Master</span> | planned |
| 09 | Higher-order functions | <span className="db-tier t-understand">Understand</span> | planned |
| 10 | Debounce and throttle | <span className="db-tier t-understand">Understand</span> | planned |
| 11 | Currying and partial application | <span className="db-tier t-understand">Understand</span> | planned |
| 12 | Composition | <span className="db-tier t-understand">Understand</span> | planned |
| 13 | Memoization | <span className="db-tier t-understand">Understand</span> | planned |
| 14 | Recursion | <span className="db-tier t-understand">Understand</span> | planned |
| 15 | Pure functions and side effects | <span className="db-tier t-understand">Understand</span> | planned |
| 16 | There is no function overloading | <span className="db-tier t-understand">Understand</span> | planned |
| 17 | Closure and default-parameter gotchas | <span className="db-tier t-understand">Understand</span> | planned |
| 18 | IIFE and the module pattern | <span className="db-tier t-know">Know</span> | planned |
| 19 | Function properties | <span className="db-tier t-know">Know</span> | planned |
| 20 | `new.target` and constructor guards | <span className="db-tier t-know">Know</span> | planned |

## Phase gate

**Move on when** you can write `bind`, `debounce` and a counter factory from an
empty file, and say what each closes over.

## How these pages are verified

Every console block on these pages was produced by a script in
`sandbox/js-p3/`, run on **Node 24.19.0** (V8 13.6). Where a behaviour only
exists in sloppy mode or CommonJS, there is a `.cjs` companion script — an ES
module cannot demonstrate it, and presenting module output as if it showed
sloppy-mode behaviour would be wrong.

## Where this connects

- [Phase 2 · Operators, expressions and control flow](../phase-2-operators/README.md) — precedence and ASI, which decide how a function expression parses
- [Phase 4 · Objects, prototypes and classes](../../syllabus/01-language-core.md) — where `new` and the prototype chain are finished
- [Phase 7 · Asynchronous JavaScript](../../syllabus/02-data-and-async.md) — closures are what make callbacks and promises hold state

---

Start → [01 · Declarations, expressions and arrow functions](./01-declarations-expressions-arrows.md)
