---
title: "try/catch/finally mechanics"
sidebar_label: "02 · try/catch/finally mechanics"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20 (The `try` statement,
> including §14.20.2 Execution of `try`-`finally`), §11.2.2 (exception
> analysis of statements), and the precise-rethrow rules of §11.2.2/§14.20.

**`try`/`catch`/`finally` looks like the first thing everyone learns about
exceptions, and its edges are where senior interviews go: catch-clause
ordering is a compile-time subtype proof, multi-catch types its parameter
as the sharpest common supertype and makes it final, and `finally` — the
part with real guarantees — can silently *discard* exceptions and override
return values if you put the wrong statement in it. The JLS defines every
one of these outcomes exactly; this topic walks them.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Catch clauses, ordering and multi-catch](01-catch-ordering-multicatch.md)** | Clause selection top-to-bottom, subtype-first or unreachable-code error, multi-catch's sharpest-common-supertype typing and its implicitly final parameter, what a catch parameter may be reassigned to |
| 2 | **[`finally` — the guarantees and the fine print](02-finally-the-fine-print.md)** | What `finally` actually promises (and the cases where it never runs), `return` in `finally` swallowing exceptions *and* overriding returns — both shown, exception-in-`finally` replacing the primary, the evaluated-before-`finally` return value |
| 3 | **[Precise rethrow, and control flow through `try`](03-rethrow-and-control-flow.md)** | The JLS's effectively-final rethrow analysis (catch broad, rethrow narrow), `break`/`continue`/labeled exits running `finally` on the way out, `try`/`finally` vs try-with-resources for cleanup, nested `try` shapes that survive review |

## Why this is a Master topic

- **`finally`'s traps are silent** — a `return` in `finally` compiles, passes
  tests, and eats exceptions in production; nothing warns except a linter
  and this knowledge.
- **Multi-catch is everyday syntax with a typed core** — knowing *why* the
  parameter is final and what type it has is the difference between using
  it and fighting it.
- **Precise rethrow explains real signatures** — `catch (Exception e) {
  log(); throw e; }` compiling inside a method that declares only
  `IOException` surprises everyone who learned Java before 7.
- **It is the substrate of the next topic** — try-with-resources desugars
  into exactly these semantics plus suppression; you can't reason about
  one without the other.

## Where this connects

- **[The hierarchy](../01-hierarchy-checked-unchecked/README.md)** — clause
  ordering is the tree of chunk 1 applied top-to-bottom.
- **[try-with-resources](../03-try-with-resources/README.md)** — replaces
  the cleanup use of `finally` and fixes its exception-masking flaw.
- **[Object lifecycle](../../phase-2-classes-objects/14-object-lifecycle.md)** —
  where cleanup obligations come from in the first place.

---

← Prev: [The hierarchy, checked vs unchecked](../01-hierarchy-checked-unchecked/README.md) · Index: [Phase 5 — Exceptions and failure design](../README.md) · Next → [Catch clauses, ordering and multi-catch](01-catch-ordering-multicatch.md)
