---
title: "Inheritance"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.1.4 (superclasses), §8.4.8
> (inheritance, overriding, and hiding), §8.4.8.3 (requirements in
> overriding), §12.5 (instance creation), §6.6.2 (`protected` access), and
> the `@Override` Javadoc in the JDK 25 API documentation.

**`extends` buys you code reuse at the price of the strongest coupling Java
has: the subclass depends on its parent's *implementation details*, forever,
across every parent version. The mechanics — overriding rules, `super`,
hiding vs overriding — are exact and learnable; the judgement is knowing
that most inheritance in application code is a mistake that composition or
an interface would have made cheaper.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`extends`, `super` and construction](01-extends-super-construction.md)** | What is inherited, constructor chains, `super(...)` and `super.method()`, construction order, the overridable-call-in-constructor bug |
| 2 | **[Overriding vs hiding — the exact rules](02-overriding-rules-hiding.md)** | The override contract (covariant returns, exception narrowing, visibility), `@Override`, accidental overloads, field and static hiding, bridge methods |
| 3 | **[The fragile base class, and designing for extension](03-fragile-base-design.md)** | Self-use coupling, the `InstrumentedHashSet` demo, `protected`'s real meaning, `final`, equals-under-subclassing, when inheritance is the right tool |

## Why this is a Master topic

Every framework you will touch — Spring proxies, JPA entities, servlet
APIs, test bases — is built on these rules, and the three most expensive
inheritance bugs are all silent: an accidental *overload* that leaves
`Object.equals` in force (entities vanish from `HashSet`s), an overridable
call in a constructor that reads uninitialized subclass state (NPE from a
field "that is definitely initialized"), and a base-class change that
breaks subclasses three modules away without a compile error. The
`java.sql.Timestamp`/`java.util.Date` and `Stack extends Vector` designs
in the JDK itself are the permanent reminders of what this costs.

## Phase gate contribution

The gate asks why calling an overridable method from a constructor is a
bug, and what `@Override` actually checks — chunk 1 and chunk 2
respectively, each with the failing code.

---

← Prev: [Encapsulation and access modifiers](../02-encapsulation-access/README.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [Polymorphism and dynamic dispatch](../04-polymorphism-dispatch/README.md)
