---
title: "Phase 8 — Modules, errors, memory and the toolchain"
sidebar_label: "Overview"
sidebar_position: 0
---

*18 topics.* What turns a file of JavaScript into a program someone else can maintain: how
code is split, how failure is represented, and what the garbage collector will and will not
do for you.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 8 has **four** Master topics — 01 through 04 — written in
syllabus order. **ALL 4 DONE — the Master tier of phase 8 is COMPLETE.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[ES modules](./01-es-modules/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Modules are singletons, strict, deferred and hoisted](./02-module-semantics/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[`Error` and its subclasses](./03-error-and-subclasses/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Leaks you will actually cause](./04-leaks/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05–14 | Dynamic `import()`, circular imports, `throw`/`try`/`catch`, custom errors, failing well, global error handling, the memory model, finding a leak, bundlers, testing | <span className="db-tier t-understand">Understand</span> | deferred |
| 15–18 | CommonJS, `AggregateError`, mark-and-sweep GC, linting | <span className="db-tier t-know">Know</span> | deferred |

## How these pages are verified

**Documentation-validated** — no new measurement sandboxes. Each page's `> Verified:` line
names the MDN pages and specification sections it was checked against.

## Where this connects

- [Phase 0 · 07 · Loading scripts](../phase-0-how-javascript-runs/07-loading-scripts.md) — how a module script reaches the engine
- [Phase 7 · 07 · `async`/`await`](../phase-7-async/07-async-await/README.md) — top-level `await` and what it does to the module graph
- [Phase 3 · 08 · Hoisting and the TDZ](../phase-3-functions/08-hoisting-and-tdz/README.md) — the hoisting rules imports extend

---

Start → [01 · ES modules](./01-es-modules/README.md)
