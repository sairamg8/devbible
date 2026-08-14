---
title: "03 · Error and its subclasses"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.prototype.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Error.captureStackTrace()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace). Documentation-validated.

**An error is an ordinary object, and the whole topic is about giving handlers something
stable to branch on** — which the message never is.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The `Error` object](./01-the-error-object.md)** | `message`, `name`, `cause`, and **`stack` being non-standard** so it must never be parsed; why branching on the message couples control flow to copy, and the three better tests; the built-in subclasses with what each means in practice; **`cause` chaining** and the `super(message, options)` requirement; and why throwing a non-`Error` costs you everything |
| 2 | **[Custom error classes](./02-custom-errors.md)** | MDN's template unpacked into its four jobs — forwarding `options` or **silently losing `cause`**, setting `name` (and why not `this.constructor.name`), the V8-only `captureStackTrace`, and carrying the fields the handler needs; typed errors at a module boundary, the class-explosion failure mode, and the ES5 `setPrototypeOf` workaround as a legacy artefact |

## The three sentences to keep

1. **Never branch on `message`, never parse `stack`.** Use a class or a `code`.
2. **`cause` is how you re-throw without destroying the evidence** — and a subclass that
   forgets to forward `options` throws it away silently.
3. **A few classes with a `code` beat a class per failure mode.**

## Phase gate

You are done with this topic when you can say which `Error` properties are standard, write a
custom error class that preserves `cause` and reports its own `name`, and explain the two
reasons `instanceof` can fail on an error you defined yourself.

## Where this connects

- [Phase 7 · 08 · Error handling in async code](../../phase-7-async/08-error-handling/README.md) — where these errors arrive from
- [Phase 7 · 10 · 02 · `race` and `any`](../../phase-7-async/10-combinators/02-race-and-any.md) — `AggregateError` in use
- [02 · 01 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md) — why a duplicated module can break `instanceof`

---

Start → [01 · The `Error` object](./01-the-error-object.md)
