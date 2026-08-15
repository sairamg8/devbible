---
title: "08 · Custom error classes"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof) — and Node.js [Errors § `error.code`](https://nodejs.org/api/errors.html#errorcode). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *the prototype fix, error codes, `cause` chains, and typed errors at a module
boundary*.

⚠️ **The prototype fix and the constructor mechanics are Master material**
([03 · Custom errors](../03-error-and-subclasses/02-custom-errors.md)) and are not repeated here.
**This topic is the design layer**: which classes should exist, what they carry, and what happens
to them at a boundary.

🔴 **A custom error exists so a caller can branch on it without reading the message.** If no
caller will branch, you need a better message, not a class.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Designing the taxonomy](./01-designing-the-taxonomy.md)** | The "what will the `catch` block do differently" test; class **and** `code` for different jobs, and why messages are never a contract; a five-category taxonomy with a shared base so anticipated failures separate from bugs; putting machine-readable fields on the error and what must never go on one; where the classes live and why a shared `errors.js` is a cycle source; and not re-wrapping platform errors |
| 02 | **[Cause chains and boundaries](./02-cause-chains-and-boundaries.md)** | Building a chain at each layer that adds meaning; walking one safely; translating at a boundary so the contract is yours and `cause` stays diagnostics; the boundary table — `JSON.stringify` giving `{}`, structured clone flattening your subclass, `instanceof` failing across realms and duplicated packages; a deliberate wire form; and `AggregateError` for several failures at once |

## Four facts worth carrying out of this topic

- **If two classes always take the same branch, they are one class.**
- **A class answers "whose problem is this?"; a `code` answers "which failure?"** — and only the
  code survives serialisation and realm boundaries.
- **`JSON.stringify(err)` is `{}`.** `message` and `stack` are non-enumerable; your own fields do
  survive.
- **`cause` is diagnostics, not contract.** A caller branching on `err.cause.code` is coupled to
  your implementation.

## Phase gate

You can justify every error class in a module in terms of what a caller does differently, explain
why `instanceof` fails for an error received from a Web Worker, and design a wire format for an
error that a client can branch on without leaking anything internal.

## Where this connects

- [03 · Custom errors](../03-error-and-subclasses/02-custom-errors.md) — how to write the class,
  at Master depth
- [03 · The `Error` object](../03-error-and-subclasses/01-the-error-object.md) — `message`,
  `name`, `stack`, `cause`
- [07 · The statements](../07-throw-try-catch/01-the-statements.md) — rethrowing with `{ cause }`
  and letting bugs through
- [06 · Diagnosing and fixing](../06-circular-imports/02-diagnosing-and-fixing.md) — why a shared
  `errors.js` grab-bag turns into a cycle
- [Phase 7 · 15 · What is safe to retry](../../phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md)
  — the retry decision your taxonomy has to support
- **09 · Failing well** · **10 · Global error handling** · **16 · `AggregateError`**
  *(not written yet)*

---

Start → [01 · Designing the taxonomy](./01-designing-the-taxonomy.md)
