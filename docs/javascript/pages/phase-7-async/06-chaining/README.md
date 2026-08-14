---
title: "06 · Chaining"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`then`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`finally`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally). Documentation-validated.

**One fact generates the whole topic: `then` returns a *new* promise**, representing the
previous step **and** your handler.

> "This enables creating longer chains of processing where each promise represents the
> completion of one asynchronous step." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Flattening](./01-flattening.md)** | Why a chain is flat where a callback pyramid was not; MDN's **"always return promises"** rule with the floating-promise race condition it prevents; that a chain is **strictly sequential**, so chaining independent work is an accidental waterfall; and the `reduce` idiom for sequencing a list |
| 2 | **[Error propagation](./02-error-propagation.md)** | Propagation as *"modeled after how synchronous code works"*, catching *"even thrown exceptions and programming errors"*; why there is **no propagation mechanism** — just the default thrower firing per link; why `.then(f, g)` ≠ `.then(f).catch(g)`; chaining **after** a `catch`; and MDN's deliberate **nesting to scope a `catch`** |
| 3 | **[`finally` and timing](./03-finally-and-timing.md)** | `finally` runs **where you put it**, not at the end — before vs after the `catch`; why a chain ending in `.finally()` still reports an unhandled rejection; **every link costs a microtask tick**; and MDN's ordering example showing the executor is **synchronous** |

## The three sentences to keep

1. **Return the promise.** A floating promise breaks sequencing *and* error handling, and
   the second failure is the one you will not notice.
2. **A rejection walks the chain link by link** — the "skip to the catch" behaviour is the
   default `(x) => { throw x; }` firing repeatedly, nothing more.
3. **`finally` is a link, not a clause.** It runs at its position and marks nothing handled.

## Phase gate

You are done with this topic when you can say what a missing `return` costs (both things),
derive rejection propagation from the default handler, explain when nesting is correct
rather than a bug, and place a `finally` before or after a `catch` on purpose.

## Where this connects

- [05 · Promises](../05-promises/README.md) — the six return outcomes and the handler defaults this topic builds on
- [04 · 04 · Callback hell](../04-callbacks/04-callback-hell.md) — the pyramid the flat chain replaces, and why it formed
- [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md) — the queue each link is scheduled on

---

Start → [01 · Flattening](./01-flattening.md)
