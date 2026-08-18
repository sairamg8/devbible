---
title: "equals and hashCode — the contract"
sidebar_label: "06 · equals and hashCode"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.lang.Object#equals` and `#hashCode`
> Javadoc (JDK 25 API documentation), JEP 395 (records), and the Hibernate ORM
> 6.x user guide's "identifiers and equality" guidance for the JPA chunk.

**`equals` and `hashCode` are one contract wearing two methods. Every hash-based
collection — `HashMap`, `HashSet`, and therefore half the standard library and
every cache you will ever write — assumes that equal objects have equal hashes
and that both answers never change while the object is inside the collection.
Break either assumption and objects don't "become buggy" — they *disappear*:
present in the set, invisible to `contains`.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The contract](01-the-contract.md)** | The five rules, why the two methods are paired, and what `HashMap` actually does with them |
| 2 | **[Implementing it right](02-implementing-it-right.md)** | Records, `Objects.hash`, IDE generation; `instanceof` vs `getClass`; nulls, arrays, `BigDecimal` |
| 3 | **[Where it breaks in production](03-where-it-breaks-in-production.md)** | The mutated key, JPA entities, subclass symmetry violations |

## Why this is a Master topic

Three daily activities depend on getting it right without thinking:

- **Every `HashSet`/`HashMap` key** — domain objects, DTOs, composite keys in
  caches. Chunk 1 shows why the contract is load-bearing, not etiquette.
- **Every test assertion** — `assertEquals(expected, actualOrder)` is a call
  to your `equals`. A wrong implementation makes tests pass that should fail.
- **Every deduplication, diff, or reconciliation** — `List.contains`,
  `distinct()`, `Set` arithmetic all resolve to `equals`.

## Phase gate contribution

The phase deliverable requires an immutable `Money` record whose `equals`
"behaves in a `HashSet`" — chunks 2 and 3 are exactly that skill.

---

← Prev: [Abstract classes vs interfaces](../05-abstract-vs-interfaces/README.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [toString](../07-tostring.md)
