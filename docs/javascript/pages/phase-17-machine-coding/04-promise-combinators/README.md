---
title: "04 · Promise.all, race, any, allSettled"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError). Documentation-validated; **no timings**.

**Four combinators, four different answers for an empty input**, and that column is usually the
real question. The implementations are short; the edge cases are the content.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[all and allSettled](./01-all-and-allsettled.md)** | `all` from MDN's own four specified sentences; the five implementation details — 🔴 **the empty case that fulfils immediately** (an implementation without it hangs silently), 🔴 **indexed assignment rather than `push`** so output order is input order, `Promise.resolve` for non-promises and thenables, a completion counter, and passing `reject` straight through; `Array.from` because all four take **iterables**; 🔴 **`all` does not cancel anything** when one rejects; the sequential-`await` trap and the array-of-functions trap; and `allSettled` built **in terms of `all`**, with its exact `{status, value}` / `{status, reason}` shape |
| 2 | **[race and any](./02-race-and-any.md)** | `race` in three lines, because **a promise settles once**; 🔴 **`race([])` is pending forever** — the exact opposite of `all([])`; `any` as **the mirror image of `all`** (collect errors, resolve on first success) rejecting with an `AggregateError` carrying `.errors`; the four-way comparison table whose **empty-input column is the question**; what each is actually for — `race` for timeouts, with ⚠️ **the warning that it cancels nothing and leaks the loser timer**, and `any` for fallbacks; and 🔴 **"first response wins" almost always meaning `any`, not `race`** |

## The three sentences to keep

1. **`all` resolves by index, not by completion order** — `push` is the bug that passes most tests.
2. **The empty input differs for all four**: `all` fulfils, `allSettled` fulfils, `race` hangs
   forever, `any` rejects with an `AggregateError`.
3. **None of them cancel anything.** A rejected `all` and a lost `race` both leave the other work
   running.

## Phase gate

You are done with this topic when you can write all four from an empty file with the empty-input
and non-promise cases handled, state what each does with `[]` without hesitating, explain why `any`
is the mirror of `all`, and say why a `race`-based timeout does not stop the request.

## Where this connects

- [Phase 7 · 10 · Combinators](../../phase-7-async/10-combinators/README.md) — using these rather than building them
- [Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md) — the `await`-in-a-loop trap
- [Phase 11 · 03 · 05 · Timeouts and cancellation](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md) — `AbortSignal`, which actually cancels
- [Phase 11 · 03 · 04 · Auth and the 401 refresh](../../phase-11-network-storage/03-fetch-wrapper/04-auth-and-refresh.md) — the shared-promise pattern these build on

---

Start → [01 · all and allSettled](./01-all-and-allsettled.md)
