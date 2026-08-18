---
title: "Optional used correctly"
sidebar_label: "07 · Optional used correctly"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the `java.util.Optional` Javadoc (JDK 25 API
> documentation, including its API-note on intended use and the value-based
> class warning), the `OptionalInt`/`OptionalLong`/`OptionalDouble` Javadoc,
> and the `java.util.stream` package documentation.

**`Optional` is not "the fix for null". It is a narrow API-design tool with a
documented intended use — *a method return type for a result that may
legitimately be absent* — and almost every `Optional` bug in real codebases
comes from using it outside that lane: as a field, as a parameter, as a
collection element, or as a fancy `if`-statement via `isPresent()` + `get()`.
Used in its lane, it does one thing brilliantly: it makes "there might be no
result" impossible for the caller to ignore, because the absence is in the
*type*, not in a Javadoc sentence nobody read.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The contract — what `Optional` is for](01-the-contract.md)** | The Javadoc's own intended-use note, return type not field/parameter/element, value-based identity warnings, `of`/`ofNullable`/`empty`, where `Optional`s come from (`findFirst`, `max`, `reduce`), `Optional` vs empty collection |
| 2 | **[The operative API](02-the-operative-api.md)** | `orElse` (always evaluated!) vs `orElseGet`, `orElseThrow`, `map`/`flatMap`/`filter` chains replacing `isPresent`+`get`, `ifPresent`/`ifPresentOrElse`, `or`, `stream()` |
| 3 | **[The boundaries](03-the-boundaries.md)** | Fields, records and DTOs; interop with null-returning APIs; `OptionalInt`/`Long`/`Double`; when plain null + `@Nullable` is the honest choice; JSpecify and where the ecosystem is heading |

## Why this is a Master topic

- **Every stream terminal that can come up empty returns one** — `findFirst`,
  `findAny`, `min`, `max`, one-arg `reduce`. You cannot finish this phase
  without reading and chaining `Optional`s fluently.
- **It is an API-design decision you make daily** — every service method
  that "might not find it" forces the choice between `Optional<T>`, null,
  an exception, or a sentinel. Interviewers probe exactly this judgement.
- **Spring Data leans on it** — repository `findById` returns
  `Optional<T>`; the `orElseThrow` chain into a 404 is one of the most-typed
  lines in Spring backends (phase 10 builds on this page).
- **The failure modes are quiet** — `orElse` eagerly evaluating an expensive
  default, `isPresent`+`get` re-creating the null-check it was meant to
  replace, `Optional` fields breaking serialization. None of them fail to
  compile.

## Phase gate contribution

The gate's pipeline ends in `findFirst()` and a default. Writing that as
`.findFirst().map(...).orElseGet(...)` — and saying *why* `orElseGet`, not
`orElse` — is exactly chunks 1 and 2.

---

[← Prev: `reduce` and primitive streams](../06-reduce-primitive-streams.md) · Index: [Phase 4 — Lambdas, streams and `Optional`](../README.md) · Next → [Streams vs loops](../08-streams-vs-loops.md)
