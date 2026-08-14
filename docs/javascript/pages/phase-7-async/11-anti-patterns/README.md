---
title: "11 · Promise anti-patterns"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [`then`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then). Documentation-validated.

**The review checklist for this phase.** Nearly every entry is a mechanism from topics 04–10
applied in the wrong place, so this topic is also a way of checking that the earlier ones
landed.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The explicit-construction anti-pattern](./01-explicit-construction.md)** | Wrapping a promise in `new Promise`, and the four concrete harms — a missing `reject` path that **hangs forever**, executor throws that convert to nothing, the lost reference, and hidden intent; the deferred variant and where `Promise.withResolvers` belongs; and the one correct use, MDN's *"wrap the callback-accepting functions at the lowest possible level"* |
| 2 | **[Floating promises and the forgotten `return`](./02-floating-promises.md)** | One bug in four disguises, led by MDN's worked example where the list is **always** empty rather than sometimes; the missing `await` that makes a function report the wrong result; `forEach` and the `filter(async …)` variant that keeps everything; deliberate fire-and-forget; and the type-aware lint rules that are the only reliable defence |
| 3 | **[`return await`, and the small ones](./03-return-await-and-others.md)** | Why `return await` is redundant outside a `try` and **required inside one** — including the `try`/`finally` case where cleanup runs before the work finishes; `async` with no `await`; mixing `await` with `.then`; `.then(fn())`; and the whole list as a review table |

## The three sentences to keep

1. **If there is already a promise in the executor, you do not need `new Promise`.**
2. **Every promise gets an owner** — `await`ed, `return`ed, or `.catch`ed in the same turn.
3. **`return await` is redundant outside a `try` and required inside one.**

## Phase gate

You are done with this topic when you can spot all four floating-promise disguises in
unfamiliar code, say what harm the constructor anti-pattern actually causes rather than that
it is verbose, and explain the `try`/`finally` case for `return await`.

## Where this connects

- [08 · Error handling](../08-error-handling/README.md) — the failure modes most of these produce
- [09 · Sequential vs parallel `await`](../09-sequential-vs-parallel/README.md) — the loop anti-pattern in full
- [06 · 02 · Error propagation](../06-chaining/02-error-propagation.md) — `.then(f, g)`, and when nesting is justified
- [04 · Callbacks](../04-callbacks/README.md) — the constructor anti-pattern is the callback contract rebuilt by hand

---

Start → [01 · The explicit-construction anti-pattern](./01-explicit-construction.md)
