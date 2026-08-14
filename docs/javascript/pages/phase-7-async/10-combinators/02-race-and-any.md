---
title: "10.2 · race and any"
sidebar_label: "02 · race and any"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any). Documentation-validated.

**Both take the first winner. They disagree about what counts as winning** — and that single
difference decides which one is correct in almost every case.

## `Promise.race` — first to **settle**

MDN:

> "This returned promise settles with the eventual state of the **first promise that
> settles**. In other words, it **fulfills if the first promise to settle is fulfilled, and
> rejects if the first promise to settle is rejected**."

🔴 **A fast failure wins the race.** `race` is not "first success" — a promise that rejects
in 5 ms beats one that fulfils in 50 ms, and the whole race rejects.

That makes `race` the wrong tool for redundancy ("try three mirrors, take whichever
answers"), and the right tool for **imposing a deadline**, where you *want* the loser's
outcome to be authoritative.

### The timeout pattern

This is what `race` is actually for:

```js
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
  );
}

const data = await Promise.race([fetchData(), timeout(5000)]);
```

Whichever settles first decides. If the fetch is slow, the timer's rejection wins and you get
a clean error.

Two caveats, both important:

- **The fetch keeps running.** `race` does not cancel anything (see
  [chunk 03](./03-choosing-and-the-losers.md)). The request completes, its response is
  discarded, and the socket stays busy. For a real timeout that frees resources you want
  `AbortSignal.timeout()` passed into `fetch`, not a race.
- **The timer keeps running too**, holding the event loop awake until it fires — which in
  Node can delay process exit. Clear it in a `finally` if the timeout is long.

### `race` with an already-settled input

MDN:

> "If the iterable contains one or more non-promise values or already settled promises,
> `Promise.race()` will settle to the **first of these values found in the iterable**"

```js
const arr = [foreverPendingPromise, alreadyFulfilledProm, "non-Promise value"];
const p = Promise.race(arr);
// fulfilled with 100 — the already-settled promise, not the bare string after it
```

So with pre-settled inputs the *array position* decides, not timing. Worth knowing when a
race includes a cached value alongside a network call: the cache wins deterministically only
if it comes first in the array.

### The empty-iterable trap

MDN:

> "An empty iterable causes the returned promise to be **forever pending**"

```js
const foreverPendingPromise = Promise.race([]);
// Promise { <state>: "pending" } — still pending later
```

🔴 **`Promise.race([])` hangs forever.** No error, no rejection, no timeout. This is the one
combinator that fails silently on an empty array, and it is easy to hit when the array is
built dynamically:

```js
await Promise.race(candidates.map(tryEndpoint));   // ⚠️ hangs if candidates is empty
```

Guard the empty case explicitly.

## `Promise.any` — first to **fulfil**

MDN:

> "fulfills when **any** of the input's promises fulfills, with this first fulfillment
> value… `Promise.any()` fulfills with the first promise to fulfill, **even if a promise
> rejects first**."

And explicitly against `race`:

> "Unlike `Promise.race()`, which returns the first *settled* value (either fulfillment or
> rejection), this method returns the first *fulfilled* value. **This method ignores all
> rejected promises up until the first promise that fulfills.**"

**This is the redundancy combinator.** Three mirrors, four DNS servers, two payment
providers — you want the first one that *works*, and failures along the way are noise.

```js
const data = await Promise.any([
  fetch(primary), fetch(mirror1), fetch(mirror2),
]);
```

### When everything fails: `AggregateError`

MDN:

> "It rejects when **all** of the input's promises reject (including when an empty iterable
> is passed), with an **`AggregateError`** containing an array of rejection reasons."

The reasons live on the `errors` property:

```js
try {
  const data = await Promise.any(sources.map(fetchFrom));
} catch (e) {
  if (e instanceof AggregateError) {
    for (const err of e.errors) log.warn(err);   // every source's failure
  }
  throw e;
}
```

🔴 **`AggregateError` is the only combinator error that carries *all* the reasons.**
`Promise.all` gives you one (the first to reject) and discards the rest; `any` gives you the
complete set, because with `any` every failure is part of the story.

MDN's example of the message when there is nothing to report:

```js
Promise.any([failure]).catch((err) => {
  console.log(err);
});
// AggregateError: No Promise in Promise.any was resolved
```

### Empty iterable

MDN: **"already rejected"** if the iterable is empty — with an `AggregateError`.

Note how differently the four behave here; that comparison is tabulated in
[chunk 03](./03-choosing-and-the-losers.md).

## The one-line distinction

| | Settles on | A rejection is |
|---|---|---|
| **`race`** | the first promise to **settle** | a **winner** — it settles the race |
| **`any`** | the first promise to **fulfil** | **ignored**, until they all reject |

**If you are choosing between them, ask whether an early failure should end the operation.**
Yes → `race` (a deadline). No → `any` (redundancy).

Reaching for `race` when you meant `any` is the classic bug here: it works in testing, where
nothing fails, and breaks the first time a mirror is down — the very case the redundancy was
built for.

## Gotchas

**Symptom:** A "try several mirrors" race fails as soon as one mirror is down
**Cause:** `race` settles on the first **settled** promise, and a fast rejection is a
settlement.
**Fix:** `Promise.any`, which *"ignores all rejected promises up until the first promise that
fulfills"*.

**Symptom:** `Promise.race([])` never settles and the code hangs with no error
**Cause:** MDN: an empty iterable makes it *"forever pending"*.
**Fix:** Guard the empty case before racing a dynamically built array.

**Symptom:** A timeout fires but the request still reaches the server
**Cause:** `race` does not cancel the loser; the fetch runs to completion and its result is
discarded.
**Fix:** `AbortSignal.timeout()` passed to `fetch` for a timeout that frees resources.

**Symptom:** A Node process will not exit after a `race` resolves
**Cause:** The losing `setTimeout` is still pending and keeps the loop awake.
**Fix:** `clearTimeout` in a `finally`.

**Symptom:** A cached value did not win a race against the network
**Cause:** With already-settled inputs, MDN says the result is *"the first of these values
found in the iterable"* — **array position** decides, not timing.
**Fix:** Put the cached value first.

**Symptom:** `Promise.any` rejected and the error has no `message` you recognise
**Cause:** It is an **`AggregateError`**; the individual reasons are on `.errors`.
**Fix:** Iterate `e.errors`. This is the only combinator that preserves every failure.

**Symptom:** `Promise.any([])` rejected immediately
**Cause:** Documented — an empty iterable is *"already rejected"* with an `AggregateError`.
**Fix:** Guard the empty case, as with `race`.

## Interview questions

**★ What is the difference between `Promise.race` and `Promise.any`?**
`race` settles with the **first to settle**, so a fast **rejection wins** and rejects the
race. `any` fulfils with the **first to fulfil** and *"ignores all rejected promises up until
the first promise that fulfills"*. `race` is for deadlines; `any` is for redundancy.

**★ Which do you use for "try three mirrors, take whichever answers first"?**
`Promise.any`. Using `race` there is the classic bug: it passes testing, where nothing fails,
and breaks the moment a mirror is down.

**★ What does `Promise.any` reject with?**
An **`AggregateError`** whose `errors` property holds every rejection reason — the only
combinator that preserves all of them. `Promise.all` gives you just the first to reject.

**★ What does `Promise.race([])` do?**
Stays **forever pending** — no error, no timeout. It is the one combinator that fails
silently on an empty array. `Promise.any([])` by contrast is *"already rejected"*.

**★ Does a `race`-based timeout cancel the slow request?**
No. The loser runs to completion and its result is discarded; the socket stays busy. Use
`AbortSignal.timeout()` with `fetch` for a timeout that actually frees resources. The losing
timer also keeps the Node event loop awake unless cleared.

**With already-settled inputs, what decides a race?**
Array position. MDN: it settles to *"the first of these values found in the iterable"* — so
a cached value only beats the network if it comes first in the array.

---

← Prev [01 · `all` and `allSettled`](./01-all-and-allsettled.md) · [Topic index](./README.md) · Next → [03 · Choosing, and the losers](./03-choosing-and-the-losers.md)
