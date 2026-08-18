---
title: "Enums — constants with behaviour"
sidebar_label: "10 · Enums"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JLS §8.9 (Enum Types), the `java.lang.Enum`,
> `java.util.EnumSet` and `java.util.EnumMap` Javadoc (JDK 25 API
> documentation), and JEP 441 (pattern matching for switch) for the
> exhaustiveness rules.

**A Java enum is not a list of named integers — it is a final class whose
every instance the compiler creates for you, exactly once, before any code
can ask for them. That singleton guarantee is why `==` is correct, why
`switch` can prove exhaustiveness, and why an enum constant can carry
fields, methods, even a per-constant method body. Used fully, an enum
replaces three things you would otherwise hand-write: the constants file,
the strategy dispatch table, and the state machine's transition rules.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The machinery](01-the-machinery.md)** | What an enum compiles to, the singleton guarantee, `name`/`ordinal`/`values`/`valueOf`, why persisting `ordinal()` is a time bomb |
| 2 | **[Behaviour per constant](02-behaviour-per-constant.md)** | Fields and constructors, per-constant method bodies, interfaces, the order-status state machine and the strategy table |
| 3 | **[Collections, boundaries, persistence](03-collections-boundaries-persistence.md)** | `EnumSet`/`EnumMap`, switch exhaustiveness, `valueOf` at API boundaries, JSON and database mapping |

## Why this is a Master topic

- **Every domain model has them** — order status, payment method, user
  role, currency. The difference between an enum used as a C-style constant
  and an enum used as a class shows up in every service you will read.
- **They are the safe half of two dangerous APIs**: `switch` over an enum
  can be compiler-checked exhaustive; `Map<Status, Handler>` becomes an
  allocation-free `EnumMap`. Both die if you model the constants as strings.
- **The failure modes are silent and production-shaped**: a reordered
  constant corrupting every row that persisted `ordinal()`, a renamed
  constant breaking every stored `name()`, an unknown value in a JSON
  payload throwing `IllegalArgumentException` at the edge.

## Phase gate contribution

The phase deliverable's `OrderStatus` — legal transitions only, illegal ones
rejected with a named error — is chunk 2's worked example, and its safe
JSON/database round-trip is chunk 3's.

---

← Prev: [Sealed types + records + switch](../09-sealed-adts.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [Nested classes](../11-nested-classes.md)
