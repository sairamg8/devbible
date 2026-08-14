---
title: "09 · Sequential vs parallel await"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**The most common performance bug written with `async`/`await`, and it is invisible because
the code is correct.** It does exactly what it says — one thing at a time.

The whole topic rests on one fact from
[07 · 02](../07-async-await/02-where-it-suspends.md): **`await` evaluates its expression
immediately** and fences only the code after it. So concurrency is a matter of *where you
put the `await`*, not of any special API.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The accidental waterfall](./01-the-accidental-waterfall.md)** | Why the syntax invites it — **`await` is a barrier, not a wait**; the mechanical dependency test for spotting one; the loop that costs N round trips and the pagination case where it is correct; the two loop shapes that fail in the *opposite* direction (`forEach`, bare `map`); and why it costs latency rather than CPU, so it survives review and local testing |
| 2 | **[Starting work before awaiting it](./02-starting-before-awaiting.md)** | Separating the call from the wait; `Promise.all` and its **input-order** guarantee; `map` + `all` for lists, and why `ids.map(getUser)` is a bug; the mixed-dependency pattern; the **unhandled-rejection window** that hoisting opens and why `Promise.all` avoids it; what fail-fast does **not** do (no cancellation); and when sequential or bounded concurrency is the right answer |

## The three sentences to keep

1. **`await` is a barrier.** Nothing textually below it has started yet — that is the bug,
   stated exactly.
2. **Start everything, then await.** `Promise.all` is that idea with better ergonomics and
   one safety property hoisting lacks.
3. **Fail-fast stops the waiting, not the work.** `Promise.all` does not cancel anything.

## Phase gate

You are done with this topic when you can apply the dependency test to a function at a
glance, rewrite a waterfall two ways (hoisting and `Promise.all`), say why hoisting can cause
an unhandled rejection, and name the cases where sequential or bounded concurrency beats
parallel.

## Where this connects

- [07 · 02 · Where it suspends](../07-async-await/02-where-it-suspends.md) — the immediate evaluation this whole topic depends on
- [08 · 03 · Unhandled rejections](../08-error-handling/03-unhandled-rejections.md) — the window hoisting opens
- [06 · 01 · Flattening](../06-chaining/01-flattening.md) — the same waterfall in chain form

---

Start → [01 · The accidental waterfall](./01-the-accidental-waterfall.md)
