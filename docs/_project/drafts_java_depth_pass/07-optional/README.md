---
title: "Optional, used correctly"
sidebar_label: "07 · Optional"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.util.Optional` Javadoc and its API note
> (JDK 25 API documentation), the `OptionalInt`/`OptionalLong`/`OptionalDouble`
> Javadoc, and the JDK's value-based classes documentation
> (`java.lang.doc-files/ValueBased`).

**`Optional` is a return type — that is the whole design, stated in its own
Javadoc: a limited mechanism for library return types where "no result" needs
to be unmissable. Used that way, it turns the silent `null`-return that
callers forget to check into a type the compiler makes them unwrap. Used
anywhere else — fields, parameters, collection elements — it adds allocation
and ceremony while *reintroducing* the very `null` questions it was built to
remove. The API rewards one style: compose with `map`/`flatMap`/`filter`,
finish with an `orElse*` — and know that `orElse` always evaluates its
argument, the most-shipped `Optional` bug there is.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What Optional is for](01-what-optional-is-for.md)** | The Javadoc's own scope statement; why not fields, parameters, or elements; creation (`of`/`ofNullable`/`empty`); value-based identity and serialization caveats |
| 2 | **[The API, chained](02-the-api-chains.md)** | `map`/`flatMap`/`filter` vs `isPresent`+`get`; **`orElse` vs `orElseGet`**; `orElseThrow`, `ifPresent`/`ifPresentOrElse`, `or`; `Optional.stream()`; the primitive optionals and their missing methods |
| 3 | **[Optional in practice](03-optional-in-practice.md)** | Boundary patterns (repositories, config, parsing); interop with `null` code; the anti-pattern catalogue; cost honesty and testing |

## Why this is a Master topic

Every modern API hands you one — `findFirst()`, `findAny()`, `max()`,
repository lookups — so misuse compounds across a codebase fast. The three
recurring production bugs live here: `orElse(expensiveDefault())` running the
default on *every* call, `opt.get()` without a presence check crashing exactly
like the NPE it replaced, and `Optional` fields breaking serialization and
equality in entities. The fix for all three is fluency, not caution.

## Phase gate contribution

The gate's pipeline — "group orders by customer, keep the three most recent" —
ends in lookups that return `Optional`; chaining them without a single
`isPresent()` is the skill this topic certifies.

---

← Prev: [`reduce` and primitive streams](../06-reduce-primitive-streams.md) · Index: [Phase 4 — Lambdas, streams and Optional](../README.md) · Next → [Streams vs loops](../08-streams-vs-loops.md)
