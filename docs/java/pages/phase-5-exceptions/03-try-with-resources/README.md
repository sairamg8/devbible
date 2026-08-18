---
title: "try-with-resources"
sidebar_label: "03 · try-with-resources"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20.3 (try-with-resources,
> including the basic/extended forms and the specified desugaring), the
> JDK 25 Javadoc for `AutoCloseable`, `Closeable` and
> `Throwable.getSuppressed`/`addSuppressed`, and JEP 213 (Milling Project
> Coin — the JDK 9 effectively-final resource form).

**Before JDK 7, every correctly-closed stream took six lines of
`try`/`finally`, and even the correct shape had a flaw the language
couldn't express: when body and close both threw, the interesting
exception was destroyed by the boring one. try-with-resources fixed the
boilerplate *and* the semantics — resources close automatically in reverse
order, a failed close attaches to the primary as a *suppressed* exception
instead of replacing it, and connection/handle leaks stopped being a
routine class of production incident.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The statement and its desugaring](01-the-desugaring.md)** | The header syntax, what the compiler generates (shown), implicitly-final resource variables, the JDK 9 effectively-final existing-variable form, multiple resources and reverse close order, null resources |
| 2 | **[Suppressed exceptions](02-suppressed-exceptions.md)** | Body-throws/close-throws in all four combinations, `getSuppressed` vs the cause chain, reading suppression in stack traces, `addSuppressed` by hand, where suppression is disabled |
| 3 | **[`AutoCloseable` in practice](03-autocloseable-in-practice.md)** | `AutoCloseable` vs `Closeable` (idempotency), JDBC's three-deep resource stacks, `Stream`s that need closing (`Files.lines`), writing your own `AutoCloseable` honestly, when close-failure matters (buffered writers) |

## Why this is a Master topic

- **It is the resource idiom** — files, sockets, JDBC connections,
  statements, result sets, `Files.lines`, HTTP responses in most client
  libraries: daily code, all of it, goes through this statement.
- **The suppression model is the part people can't reconstruct** — which
  exception propagates when both body and close throw, and where the
  other one *went*, is a precision question interviews lean on.
- **Leak-shaped incidents trace back to its absence** — "connection pool
  exhausted" post-mortems still regularly end at a manually-closed
  resource on an early-return path.
- **Writing an `AutoCloseable` correctly is API design** — idempotency,
  what to throw from `close`, whether to declare `Exception` — and
  most first attempts get at least one wrong.

## Where this connects

- **[`finally` — the fine print](../02-try-catch-finally/02-finally-the-fine-print.md)** —
  the masking flaw this statement exists to fix.
- **[Object lifecycle](../../phase-2-classes-objects/14-object-lifecycle.md)** —
  why cleanup can't be left to finalization/GC in the first place.
- **[The stream pipeline in practice](../../phase-4-lambdas-streams/03-stream-pipeline/03-pipelines-in-practice.md)** —
  `Files.lines` inside TWR, the I/O-backed stream contract.

---

← Prev: [`try`/`catch`/`finally` mechanics](../02-try-catch-finally/README.md) · Index: [Phase 5 — Exceptions and failure design](../README.md) · Next → [The statement and its desugaring](01-the-desugaring.md)
