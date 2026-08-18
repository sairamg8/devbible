---
title: "Phase 2 — Classes and objects, done properly"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the Java Language Specification, the JDK 25
> API documentation, and the JEP that finalized each feature). No sandbox:
> pages carry Java code, never fabricated program output.

Java is object-oriented with no escape hatch — every line you ship lives in a
class. This phase is the difference between classes that model the domain and
classes that are bags of getters: the `equals` contract that decides whether
your entity survives a `HashSet`, records as the default data carrier, sealed
types as compiler-checked domain modelling, and immutability as the cheapest
concurrency strategy you will ever buy.

🚧 **14 of 15 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Class anatomy and construction](01-class-anatomy.md)** | <span className="db-tier t-master">Master</span> | Fields, constructors, `this`, initialization order, chaining |
| 02 | **[Encapsulation and access modifiers](02-encapsulation-access.md)** | <span className="db-tier t-master">Master</span> | Package-private: the underrated default for internals |
| 03 | **[Inheritance](03-inheritance.md)** | <span className="db-tier t-master">Master</span> | `extends`, `super`, `@Override` — and why deep hierarchies rot |
| 04 | **[Polymorphism and dynamic dispatch](04-polymorphism-dispatch.md)** | <span className="db-tier t-master">Master</span> | The mechanism every framework is built on |
| 05 | **[Abstract classes vs interfaces](05-abstract-vs-interfaces.md)** | <span className="db-tier t-master">Master</span> | "Is-a with shared state" vs "can-do contract" |
| 06 | **[`equals`/`hashCode` — the contract](06-equals-hashcode/README.md)** | <span className="db-tier t-master">Master</span> | The entity that vanishes from a `HashSet` |
| 07 | **[`toString`](07-tostring.md)** | <span className="db-tier t-understand">Understand</span> | For logs, not for parsing; no secrets, no lazy graphs |
| 08 | **[Records](08-records/README.md)** | <span className="db-tier t-master">Master</span> | The default data carrier; compact constructors for validation |
| 09 | **[Sealed types + records + `switch` = ADTs](09-sealed-adts.md)** | <span className="db-tier t-understand">Understand</span> | `PaymentResult` with compiler-checked exhaustiveness |
| 10 | **Enums** *(not written yet)* | <span className="db-tier t-master">Master</span> | Fields, methods, per-constant behaviour — status machines |
| 11 | **[Nested classes](11-nested-classes.md)** | <span className="db-tier t-understand">Understand</span> | Static vs inner — and the outer reference inner classes secretly hold |
| 12 | **[Designing immutable classes](12-immutable-design.md)** | <span className="db-tier t-master">Master</span> | Final fields, defensive copies, no leaked `this` |
| 13 | **[Composition over inheritance](13-composition-over-inheritance.md)** | <span className="db-tier t-understand">Understand</span> | Delegate instead of extend; the `extends ArrayList` mistake |
| 14 | **[Object lifecycle](14-object-lifecycle.md)** | <span className="db-tier t-know">Know</span> | Allocation, reachability, no destructors; `Cleaner`, not finalizers |
| 15 | **[The rest of `Object`](15-rest-of-object.md)** | <span className="db-tier t-know">Know</span> | `clone` (broken by design), `getClass`, legacy `wait`/`notify` |

## Phase gate

**Deliverable:** model a small order domain — `Order`, `OrderStatus` enum,
sealed `PaymentResult`, an immutable `Money` record over `BigDecimal` — where
invalid states don't compile and `equals` behaves in a `HashSet`.

## Where this connects

- **[Phase 1 — Language core](../phase-1-language-core/README.md)** supplies
  the value semantics (`==` vs `equals`, `final`) this phase's contracts build on.
- **Phase 5 — Exceptions** picks up constructor failure design.
- **Phase 6 — Concurrency** is where immutability (topic 12) pays out.
- **Phase 9 — Spring** is dynamic dispatch (topic 04) industrialized: proxies,
  and the framework calling your overrides.
