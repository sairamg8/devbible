---
title: "07 · async/await"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**Syntax over the machinery of [06 · Chaining](../06-chaining/README.md), with one thing
genuinely added: the pieces share a scope.**

> "Async functions **always** return a promise. If the return value of an async function is
> not explicitly a promise, it will be implicitly wrapped in a promise." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Always a promise](./01-always-a-promise.md)** | The three exits — return, return-a-promise (adopted), throw (**rejects, never throws synchronously**); why `try { asyncFn() }` catches nothing and where synchronous validation must live instead; MDN's `p === basicReturn()` vs `p === asyncReturn()` identity difference; what `await 1` desugars to; and what you actually gain over a chain |
| 2 | **[Exactly where it suspends](./02-where-it-suspends.md)** | Everything up to and including the first `await` runs **synchronously**; the three things `await` does, including that the **expression is evaluated immediately** — which is what makes concurrency possible; the **one-tick minimum** with no fast path; awaiting non-promises and thenables; and where `await` is allowed, including what top-level `await` does to the module graph |
| 3 | **[Reading the ordering](./03-reading-the-ordering.md)** | The three-pass method for any ordering question, worked end to end; why a two-`await` function **interleaves** with other microtasks; that `await` suspends the function and not the thread; and the two loop shapes — `for...of` sequencing vs `forEach` doing nothing at all |

## The three sentences to keep

1. **An `async` function never throws synchronously** — a throw becomes a rejection, so a
   bare `try`/`catch` around the call catches nothing.
2. **`await` evaluates its expression immediately** and defers only the code that depends on
   it. Waterfalls are a choice, not a consequence.
3. **Every `await` costs a tick, even on an already-settled value**, and re-queues the
   continuation at the back of the microtask queue.

## Phase gate

You are done with this topic when you can say what an `async` function returns in all three
exit cases, explain precisely which code runs synchronously, derive the output of an
interleaved ordering puzzle rather than recalling it, and say why `await` in `forEach`
silently does nothing.

## Where this connects

- [06 · Chaining](../06-chaining/README.md) — the chain this syntax writes for you
- [05 · Promises](../05-promises/README.md) — adoption, which is why `return p` does not nest
- [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md) — the queue every continuation joins
- [01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md) — `await` suspends the function, not the thread

---

Start → [01 · Always a promise](./01-always-a-promise.md)
