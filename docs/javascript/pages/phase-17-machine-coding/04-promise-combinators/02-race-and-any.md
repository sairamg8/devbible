---
title: "04.2 · race and any"
sidebar_label: "02 · race and any"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static). Documentation-validated; **no timings**.

**`race` settles on the first result; `any` fulfils on the first *success*.** One word apart, and
the difference decides whether a single early failure sinks the whole thing.

## `race` — first to settle, either way

```js
function race(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) {
      Promise.resolve(item).then(resolve, reject);    // 🔴 first settle wins; the rest are ignored
    }
  });
}
```

**Three lines, because a promise can only settle once** — every subsequent `resolve` or `reject`
call is a no-op, so no counter is needed. That is the elegant part of the answer.

🔴 **`Promise.race([])` never settles.** There is nothing to attach to, so the returned promise
stays pending forever. It does not throw and it does not resolve — MDN describes the empty case as
*"forever pending"*. **This is the opposite of `Promise.all([])`, which fulfils immediately**, and
the contrast is the question.

⚠️ **A non-promise value in the input wins instantly**, because `Promise.resolve(value)` is already
fulfilled. `Promise.race([fetch(url), "fallback"])` resolves with `"fallback"` on the next
microtask — occasionally deliberate, usually a bug.

## `any` — first to fulfil

MDN:

> "This returned promise fulfills when **any** of the input's promises fulfills, with this first
> fulfillment value."

> "It rejects when **all** of the input's promises reject (including when an empty iterable is
> passed), with an `AggregateError` containing an array of rejection reasons."

> "**Already rejected**, if the `iterable` passed is empty."

> "Unlike `Promise.race()`, which returns the first *settled* value (either fulfillment or
> rejection), this method returns the first *fulfilled* value. This method **ignores all rejected
> promises** up until the first promise that fulfills."

```js
function any(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const errors = new Array(items.length);
    let remaining = items.length;

    if (remaining === 0) {                             // 🔴 empty → REJECT, not hang
      reject(new AggregateError([], "All promises were rejected"));
      return;
    }

    items.forEach((item, index) => {
      Promise.resolve(item).then(resolve, (reason) => {
        errors[index] = reason;                        // 🔴 indexed, like `all`'s results
        remaining--;
        if (remaining === 0) {
          reject(new AggregateError(errors, "All promises were rejected"));
        }
      });
    });
  });
}
```

🔴 **`any` is the mirror image of `all`**: `all` collects values and rejects on the first failure;
`any` collects *errors* and resolves on the first success. Seeing that symmetry is worth more than
memorising both.

**The `AggregateError` matters** — it carries `.errors`, an array of every rejection reason in
input order, and that is the specified failure shape. Rejecting with a plain `Error` loses all the
diagnostics, which is the point of the combinator.

## The four, side by side

| | Fulfils when | Rejects when | Empty input |
|---|---|---|---|
| `all` | **all** fulfil | **any** rejects (first reason) | 🔴 **fulfils** with `[]`, synchronously |
| `allSettled` | always, once all settle | **never** | fulfils with `[]` |
| `race` | first to **settle** fulfils | first to **settle** rejects | 🔴 **forever pending** |
| `any` | first to **fulfil** | **all** reject (`AggregateError`) | 🔴 **rejects** with `AggregateError` |

⚠️ **The empty-input column is the whole comparison question**, because all four differ and two of
them are surprising.

## What they are actually for

**`race` — timeouts and cancellation.** The classic use:

```js
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms),
    ),
  ]);
```

🔴 **This does not cancel the underlying work** — the slow promise keeps running, and for a `fetch`
the request is still in flight. **`AbortSignal.timeout()` is the correct mechanism for a fetch**
([Phase 11 · 03 · 05](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md)),
because it actually aborts the request. `race` is the fallback for work that has no cancellation
mechanism at all.

⚠️ **And the timer leaks.** If the real promise wins, the `setTimeout` is still pending, keeping the
timer and its closure alive until it fires. A production version clears it in a `finally`.

**`any` — fallbacks and redundancy.** Query three mirrors and take whichever answers first
successfully; try a primary endpoint and a backup. **`race` would be wrong here**, because the
first *failure* would sink it — which is precisely the distinction.

## The one to be careful with

🔴 **`race` with a rejecting promise defeats the point of the fallback.** This is the mistake:

```js
// ❌ if the primary fails fast, the whole thing rejects even though the mirror succeeds
Promise.race([fetchPrimary(), fetchMirror()]);

// ✅
Promise.any([fetchPrimary(), fetchMirror()]);
```

**"First response wins" almost always means `any`, not `race`.** `race` is right only when a
rejection is genuinely a valid outcome of the race — as in the timeout pattern, where the timer's
rejection is the point.

## Gotchas

**Symptom:** `Promise.race([])` hangs
**Cause:** Nothing to settle it — it stays pending forever.
**Fix:** Guard against an empty input, or use a combinator whose empty case suits you.

**Symptom:** `Promise.any([])` rejects with an odd error
**Cause:** Specified — `AggregateError` with an empty `errors` array.
**Fix:** Expected; check `.errors`.

**Symptom:** A `race` resolves instantly with a plain value
**Cause:** A non-promise in the input is already fulfilled.
**Fix:** Only pass promises, or make it deliberate.

**Symptom:** A fallback rejects even though one source succeeded
**Cause:** `race` used where `any` was meant — the first failure won.
**Fix:** `Promise.any`.

**Symptom:** A timeout fires but the request continues
**Cause:** `race` does not cancel anything.
**Fix:** `AbortSignal.timeout()` for fetch; `race` only where cancellation is impossible.

**Symptom:** A timer stays alive after the real promise wins
**Cause:** The `setTimeout` in the timeout pattern is never cleared.
**Fix:** Clear it in a `finally`.

**Symptom:** `any` rejects with something that has no detail
**Cause:** A plain `Error` was used instead of `AggregateError`.
**Fix:** `new AggregateError(errors, message)` — `.errors` is the diagnostic.

**Symptom:** `any` returns errors in completion order
**Cause:** `errors.push` instead of indexed assignment.
**Fix:** `errors[index] = reason`, exactly as `all` does with values.

## Interview questions

**★ Implement `Promise.race`.**
Attach `resolve` and `reject` to every input. It is three lines because **a promise can settle only
once**, so every later call is a no-op and no counter is needed.

**★ What does `Promise.race([])` do?**
Stays **pending forever** — there is nothing to settle it. That is the opposite of
`Promise.all([])`, which fulfils immediately with `[]`, and the contrast is usually the real
question.

**★ `race` versus `any` in one sentence.**
`race` settles on the first promise to **settle**, success or failure; `any` fulfils on the first
to **succeed** and ignores rejections until they are all in. "First response wins" almost always
means `any`.

**★ Implement `Promise.any`, and say what it rejects with.**
The mirror of `all`: collect **errors** by index, resolve on the first fulfilment, and when the
counter hits zero reject with an `AggregateError` carrying every reason in input order. An empty
input rejects immediately with an `AggregateError` holding an empty array.

**★ Give the empty-input behaviour of all four.**
`all` fulfils with `[]` (synchronously); `allSettled` fulfils with `[]`; `race` is **pending
forever**; `any` **rejects** with an `AggregateError`. All four differ, which is why it is asked.

**★ Write a timeout with `race`. What is wrong with it?**
It works, but it **does not cancel** the underlying work — a fetch stays in flight — and the loser
timer leaks unless cleared in a `finally`. `AbortSignal.timeout()` is correct for fetch; `race` is
for work with no cancellation mechanism.

**Why is `race` the wrong choice for redundant requests?**
Because the first *failure* wins the race. If the primary fails fast, the whole thing rejects even
though the mirror would have succeeded. That is exactly what `any` fixes.

---

← [01 · all and allSettled](./01-all-and-allsettled.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
