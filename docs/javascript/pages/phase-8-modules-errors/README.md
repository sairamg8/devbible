---
title: "Phase 8 — Modules, errors, memory and the toolchain"
sidebar_label: "Overview"
sidebar_position: 0
---

*18 topics.* What turns a file of JavaScript into a program someone else can maintain: how
code is split, how failure is represented, and what the garbage collector will and will not
do for you.

## Status — Master ✅ 4/4 · 🚧 Understand under way (**5/18 written**)

Phase 8 has **four** Master topics — 01 through 04 — written in syllabus order. **ALL 4 DONE —
the Master tier of phase 8 is COMPLETE.**

Phase 8 belongs to **chunk C** of the four-way JavaScript split, whose other phase,
[Phase 7](../phase-7-async/README.md), is ✅ complete at every tier. The work here is the
**Understand** tier (05–14) followed by **Know** (15–18), lowest unwritten number first.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[ES modules](./01-es-modules/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Modules are singletons, strict, deferred and hoisted](./02-module-semantics/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[`Error` and its subclasses](./03-error-and-subclasses/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Leaks you will actually cause](./04-leaks/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Dynamic `import()`](./05-dynamic-import/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | Circular imports | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 07 | `throw`, `try`/`catch`/`finally` | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 08 | Custom error classes | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 09 | Failing well | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 10 | Global error handling | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 11 | The memory model | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 12 | Finding a leak | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 13 | Bundlers and the build | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 14 | Testing JavaScript | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 15 | CommonJS in a modern world | <span className="db-tier t-know">Know</span> | ⏳ |
| 16 | `AggregateError` | <span className="db-tier t-know">Know</span> | ⏳ |
| 17 | Mark-and-sweep and generational GC | <span className="db-tier t-know">Know</span> | ⏳ |
| 18 | Linting and formatting | <span className="db-tier t-know">Know</span> | ⏳ |

## How these pages are verified

**Documentation-validated** — no new measurement sandboxes. Each page's `> Verified:` line
names the MDN pages and specification sections it was checked against.

## Where this connects

- [Phase 0 · 07 · Loading scripts](../phase-0-how-javascript-runs/07-loading-scripts.md) — how a module script reaches the engine
- [Phase 7 · 07 · `async`/`await`](../phase-7-async/07-async-await/README.md) — top-level `await` and what it does to the module graph
- [Phase 3 · 08 · Hoisting and the TDZ](../phase-3-functions/08-hoisting-and-tdz/README.md) — the hoisting rules imports extend

---

Start → [01 · ES modules](./01-es-modules/README.md)
