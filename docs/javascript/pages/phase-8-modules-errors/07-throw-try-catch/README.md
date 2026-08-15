---
title: "07 · `throw`, `try`/`catch`/`finally`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`throw`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw), [`try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Error.prototype.stack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack), [`Promise.prototype.finally()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally) — and ECMAScript [§ The `try` Statement](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-try-statement). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *optional catch binding, what `finally` can override, and throwing
non-`Error` values* — three details that each cost real debugging time.

⚠️ **The `Error` object is Master material**
([03 · The `Error` object](../03-error-and-subclasses/01-the-error-object.md)). This topic is the
**statements**, and the ways their control flow surprises people.

🔴 **The two facts that matter most:** a `try` block that is wider than the risky operation turns
your own bugs into handled errors, and a `return` inside `finally` silently discards a pending
exception.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`throw`, `try`, `catch`](./01-the-statements.md)** | Why `throw` accepts anything and you should still throw an `Error` (the stack is captured at construction); rethrowing with `{ cause }`; narrow `try` blocks and rethrowing what is not yours; the optional catch binding versus the empty-catch smell; what `catch` cannot see — timers, listeners, un-awaited promises; a throw inside `catch`; and the block-scoped catch parameter |
| 02 | **[`finally`, and what it can override](./02-finally.md)** | The exact order — value computed, `finally`, then return; `try`/`finally` with no `catch`; 🔴 `return`/`break`/`continue`/`throw` in `finally` replacing a pending exception; what belongs in `finally` and wrapping risky cleanup; `await` in `finally`; the statement versus `promise.finally()`; and `using` where available |

## Four facts worth carrying out of this topic

- **A stack is captured when the `Error` is constructed**, so a thrown string has no origin
  information at all.
- **A wide `try` block reclassifies your bugs as handled failures** — the `TypeError` from a typo
  gets reported as a network error.
- **`try`/`catch` catches a rejection only through `await`.** A floating promise is not covered.
- **`return` in `finally` overrides everything, including a pending throw.** Enable
  `no-unsafe-finally`.

## Phase gate

You can say what a function returns when its `try` throws and its `finally` returns, explain why
an error from a `setTimeout` callback escapes an enclosing `try`, and rewrite a broad
`try`/`catch` so that only the operation that can genuinely fail is inside it.

## Where this connects

- [03 · The `Error` object](../03-error-and-subclasses/01-the-error-object.md) — `message`,
  `name`, `stack`, `cause`, and classifying without string matching
- [03 · Custom errors](../03-error-and-subclasses/02-custom-errors.md) — the subclasses you
  rethrow as
- [Phase 7 · 08 · Try/catch around await](../../phase-7-async/08-error-handling/01-try-catch-around-await.md)
  — the async half of the same statement
- [Phase 7 · 11 · Floating promises](../../phase-7-async/11-anti-patterns/02-floating-promises.md)
  — the rejection a `try` cannot see
- [Phase 7 · 06 · `finally` and timing](../../phase-7-async/06-chaining/03-finally-and-timing.md)
  — `promise.finally()` in a chain
- **08 · Custom error classes** · **09 · Failing well** · **10 · Global error handling** ·
  **16 · `AggregateError`** *(not written yet)*

---

Start → [01 · `throw`, `try`, `catch`](./01-the-statements.md)
