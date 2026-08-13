---
title: "Phase 4 — Objects, prototypes and classes"
sidebar_label: "Overview"
sidebar_position: 0
---

*20 topics.* Everything non-primitive in JavaScript is here. The prototype rows
are what make `class` stop being magic, and the copy row is the one that costs
teams real money.

Phase 3 was about functions as *behaviour*. This phase is about the objects that
behaviour hangs off: how a property is found, what `class` desugars to, and why
"copying" an object is four different operations with four different failure
modes.

## Status — **in progress** (2026-08-13)

**Master tier first.** The seven Master topics are written in syllabus order;
Understand and Know tiers are *deferred*, not forgotten — they are filled in on
demand once the Master topics of every phase are done.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Object literals](./01-object-literals/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | Property access | <span className="db-tier t-understand">Understand</span> | deferred |
| 03 | **[Existence checks and `delete`](./03-existence-checks-and-delete/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Shallow vs deep copy](./04-shallow-vs-deep-copy/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[The prototype chain](./05-the-prototype-chain/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[`class`](./06-class/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | `this` inside methods, and losing it | <span className="db-tier t-master">Master</span> | planned |
| 08 | `Object.keys` / `values` / `entries` / `fromEntries` | <span className="db-tier t-master">Master</span> | planned |
| 09 | `extends` and `super` | <span className="db-tier t-understand">Understand</span> | deferred |
| 10 | Getters and setters | <span className="db-tier t-understand">Understand</span> | deferred |
| 11 | Property descriptors | <span className="db-tier t-understand">Understand</span> | deferred |
| 12 | `Object.freeze` and `seal` | <span className="db-tier t-understand">Understand</span> | deferred |
| 13 | `instanceof` and `Symbol.hasInstance` | <span className="db-tier t-understand">Understand</span> | deferred |
| 14 | Object creation patterns | <span className="db-tier t-understand">Understand</span> | deferred |
| 15 | Normalising untrusted shapes | <span className="db-tier t-understand">Understand</span> | deferred |
| 16 | Prototype patterns to avoid | <span className="db-tier t-understand">Understand</span> | deferred |
| 17 | `toString`, `valueOf`, `Symbol.toPrimitive` | <span className="db-tier t-know">Know</span> | deferred |
| 18 | Mixins and composition over inheritance | <span className="db-tier t-know">Know</span> | deferred |
| 19 | `Proxy` and `Reflect` | <span className="db-tier t-know">Know</span> | deferred |
| 20 | Private state before `#` | <span className="db-tier t-know">Know</span> | deferred |

## Phase gate

**Move on when** you can draw the prototype chain for an instance of a subclass,
and explain what `super.method()` looks up.

## How these pages are verified

**Documentation-validated**, under the standing rule that no new measurement
sandboxes are built. Each page's `> Verified:` line names the MDN pages and
specification sections it was checked against, with links. **No run means no
console block** — where there is no script, the page explains the behaviour in
prose rather than printing output nobody produced.

## Where this connects

- [Phase 3 · Functions, scope and closures](../phase-3-functions/README.md) — `this`, closures and the scope chain, all of which this phase assumes
- [Phase 1 · Values, types and coercion](../phase-1-values-and-coercion/README.md) — why every property key is a string or a symbol, and what happens when you use anything else
- [Phase 5 · The built-in library](../../syllabus/02-data-and-async.md) — `Map` and `Set`, and how their keys differ from an object's

---

Start → [01 · Object literals](./01-object-literals/README.md)
