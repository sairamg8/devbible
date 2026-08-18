---
title: "Strings"
sidebar_label: "06 · Strings"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `String` Javadoc, the JLS (§3.10.5
> string literals, §15.28 constant expressions), JEP 280 (indify string
> concatenation, 9) and JEP 254 (compact strings, 9).

**`String` is the most-used class in Java and the most misused. It is
immutable — every "modification" is an allocation — its literals are pooled
and therefore sometimes `==`-equal by accident, and its API has half a dozen
methods whose behaviour (regex `split`, ASCII-only `trim`) is subtler than
the name suggests. The `==` vs `equals` distinction alone has shipped real
bugs in every Java codebase old enough to vote.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Immutability, the pool and equality](01-immutability-pool-equality.md)** | Why strings can't change, where literals live, `==` vs `equals`, constant folding |
| 2 | **[Building and formatting](02-building-and-formatting.md)** | Concatenation's real cost, `StringBuilder` in loops, `format`/`formatted`, `join` |
| 3 | **[The API worth knowing](03-the-api-worth-knowing.md)** | `split`'s regex surprise, `strip` vs `trim`, `isBlank`, case operations and locales |

## Why this is a Master topic

Three separate production-bug families live here:

- **Identity vs equality** — `if (status == "ACTIVE")` works in the unit test
  (both literals, pooled) and fails on the value that arrived over HTTP
  (chunk 1).
- **Accidental quadratic work** — `+=` in a loop over ten thousand rows
  (chunk 2).
- **API semantics that differ from the name** — `split(".")` returning an
  empty array, `trim` missing Unicode whitespace, `replaceAll` treating its
  argument as a regex (chunk 3).

## Phase gate contribution

The gate asks what `"a" + "b" == "ab"` evaluates to. After chunk 1 you can
answer for that case *and* for the run-time variants that look identical and
behave differently.

---

← Index: [Phase 1 — Language core](../README.md) · Next → [Text blocks](../07-text-blocks.md)
