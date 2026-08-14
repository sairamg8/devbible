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

## Status — **Understand tier under way** (2026-08-14)

🚧 **14 of 20 written.** All seven Master topics are done — 01, 03, 04, 05, 06, 07,
08 in syllabus order — and the **Master-first plan is finished across every phase**,
so the work here is now the **Understand and Know tiers**, in that order.

**Next here: 15 · Normalising untrusted shapes**, then 16 (Understand), then 17–20 (Know).

**Coverage:** Master **7 / 7** ✅ · Understand **7 / 9** · Know **0 / 4**.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Object literals](./01-object-literals/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Property access](./02-property-access.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 03 | **[Existence checks and `delete`](./03-existence-checks-and-delete/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Shallow vs deep copy](./04-shallow-vs-deep-copy/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[The prototype chain](./05-the-prototype-chain/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[`class`](./06-class/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[`this` inside methods, and losing it](./07-this-in-methods/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 08 | **[`Object.keys` / `values` / `entries` / `fromEntries`](./08-keys-values-entries/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 09 | **[`extends` and `super`](./09-extends-and-super/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[Getters and setters](./10-getters-and-setters.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[Property descriptors](./11-property-descriptors.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[`Object.freeze` and `seal`](./12-freeze-and-seal/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[`instanceof` and `Symbol.hasInstance`](./13-instanceof-and-hasinstance/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14 | **[Object creation patterns](./14-object-creation-patterns/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
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
