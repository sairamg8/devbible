---
title: "10 · Promise.all vs allSettled vs race vs any"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any). Documentation-validated.

**Four joins over a set of promises, separated by two questions:** do you need every result
or just one, and should a failure fail the operation?

|  | Need **all** results | Need **one** result |
|---|---|---|
| A failure **fails** the operation | **`all`** | **`race`** |
| A failure is **tolerable** | **`allSettled`** | **`any`** |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`all` and `allSettled`](./01-all-and-allsettled.md)** | `all`'s **input-order** guarantee, its fail-fast reason being the first *in time* rather than in position, and bare values passing through; `allSettled`'s `{status, value\|reason}` shape with `value`/`reason` **absent** rather than `undefined`; MDN's own dependent-vs-independent rule; and the silent-failure trap of a combinator that never rejects |
| 2 | **[`race` and `any`](./02-race-and-any.md)** | `race` settling on the first to **settle**, so a fast rejection wins — right for deadlines, wrong for redundancy; the timeout pattern and its two caveats; **`Promise.race([])` hanging forever**; `any` ignoring rejections until one fulfils, and its **`AggregateError`** carrying every reason |
| 3 | **[Choosing, and the losers](./03-choosing-and-the-losers.md)** | The 2×2 worked through; **no combinator cancels anything** — losers keep running, keep sockets, keep their side effects; why losing rejections do *not* become unhandled reports and what that hides; the empty-iterable table where all four differ; and why none of them is a scheduler |

## The three sentences to keep

1. **`race` is a deadline; `any` is redundancy.** A fast rejection wins a race.
2. **Nothing is cancelled.** Fail-fast stops the waiting, not the work.
3. **They are joins, not schedulers.** Every task starts at once.

## Phase gate

You are done with this topic when you can place all four in the 2×2 without hesitating, say
what `Promise.race([])` does, explain why `Promise.any`'s error is an `AggregateError`, and
say what happens to the promises that lose.

## Where this connects

- [09 · Sequential vs parallel `await`](../09-sequential-vs-parallel/README.md) — where `Promise.all` comes from, and the hoisting hazard it avoids
- [08 · 03 · Unhandled rejections](../08-error-handling/03-unhandled-rejections.md) — the reports combinators suppress
- [05 · 02 · `then`, `catch`, `finally`](../05-promises/02-then-catch-finally.md) — why a logging `catch` on an input must re-throw

---

Start → [01 · `all` and `allSettled`](./01-all-and-allsettled.md)
