---
title: "04.1 · all and allSettled"
sidebar_label: "01 · all and allSettled"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Documentation-validated; **no timings**.

**`Promise.all` is four lines and three edge cases**, and the edge cases are the whole question:
the empty iterable, non-promise values, and preserving order when results arrive out of order.

## What the specification requires

MDN:

> "The **`Promise.all()`** static method takes an iterable of promises as input and returns a
> single `Promise`. This returned promise fulfills when **all** of the input's promises fulfill
> (including when an empty iterable is passed), with an array of the fulfillment values. It rejects
> when **any** of the input's promises rejects, with this first rejection reason."

> "**Already fulfilled**, if the `iterable` passed is empty."

> "`Promise.all` resolves **synchronously** if and only if the `iterable` passed is empty."

> "`Promise.all()` will reject immediately upon **any** of the input promises rejecting."

> "If the `iterable` contains non-promise values, they will be ignored, but still counted in the
> returned promise array value."

🔴 **All four of those sentences are the implementation.**

## The implementation

```js
function all(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);           // 🔴 iterable, not just array
    const results = new Array(items.length);
    let remaining = items.length;

    if (remaining === 0) {                        // 🔴 empty → fulfil immediately
      resolve(results);
      return;
    }

    items.forEach((item, index) => {
      Promise.resolve(item).then(                 // 🔴 wraps non-promises AND thenables
        (value) => {
          results[index] = value;                 // 🔴 index preserves order
          remaining--;
          if (remaining === 0) resolve(results);
        },
        reject,                                    // first rejection wins; later ones are ignored
      );
    });
  });
}
```

Five details, each of which is a follow-up question:

- 🔴 **The empty case must resolve, and it is the one people forget.** An implementation that only
  resolves inside the `then` never settles for `[]`, and the symptom is a hang with no error.
- 🔴 **`results[index] = value`, not `results.push(value)`.** Results arrive in completion order;
  the output must be in **input** order. `push` is the single most common bug here, and it passes
  any test where the promises happen to settle in order.
- 🔴 **`Promise.resolve(item)`** handles both non-promises and **thenables** — any object with a
  `.then` method. Calling `item.then(...)` directly throws on a plain value.
- **`remaining`, not `results.length`.** A sparse `results` array has a misleading `length`, and
  counting completions is what you actually need.
- **Passing `reject` directly** is correct: a promise can only settle once, so subsequent
  rejections are silently ignored — which is exactly the specified "first rejection reason"
  behaviour.

⚠️ **`Array.from(iterable)`, not a parameter typed as an array.** All four combinators take
**iterables** — a `Set`, a generator, a `Map`'s values. Assuming an array is a real limitation.

## The behaviour that matters in production

🔴 **`Promise.all` does not cancel the other promises when one rejects.** They keep running; you
just stop hearing about them. That means:

- **In-flight requests continue** and their responses are discarded. If cancellation matters, an
  `AbortSignal` shared across them is the mechanism
  ([Phase 11 · 03 · 05](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md)).
- 🔴 **A later rejection from a sibling can become an unhandled rejection**, because after the
  first rejection nothing is attached to the others' failure paths in some implementations. In
  practice engines treat promises passed to `all` as handled — but code that builds the array,
  awaits `all`, and catches, has no handler on the individual promises.

**And the classic ordering trap:**

```js
// ❌ sequential — each await waits for the previous
for (const url of urls) results.push(await fetch(url));

// ✅ parallel — all requests start, then we wait
const results = await Promise.all(urls.map((url) => fetch(url)));
```

⚠️ **The promises must already be *started* when they reach `Promise.all`.** Passing an array of
functions does nothing — `Promise.all(urls.map(url => () => fetch(url)))` resolves immediately with
an array of functions, because a function is a non-promise value that is "ignored, but still
counted".

## `allSettled` — never rejects

```js
function allSettled(iterable) {
  const items = Array.from(iterable);
  return all(
    items.map((item) =>
      Promise.resolve(item).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason }),
      ),
    ),
  );
}
```

🔴 **Implementing it in terms of `all` is the elegant answer**: turn every rejection into a
fulfilment carrying the reason, and then nothing can reject. Writing it from scratch with its own
counter also works and is longer.

**The result shape is specified exactly**: `{ status: "fulfilled", value }` or
`{ status: "rejected", reason }` — `value` and `reason`, not `result` and `error`. Getting the
property names wrong is a real answer-level mistake.

**When to use it:** anything where partial success is acceptable — sending analytics to three
endpoints, warming several caches, a dashboard where one failed widget should not blank the page.
🔴 **`Promise.all` is the wrong choice whenever one failure should not discard the other results**,
and that is more often than people reach for `allSettled`.

## Gotchas

**Symptom:** `Promise.all([])` never settles
**Cause:** The empty case resolves nowhere — nothing runs the `then`.
**Fix:** Resolve immediately when the input is empty. MDN: *"Already fulfilled, if the `iterable`
passed is empty."*

**Symptom:** Results come back in the wrong order
**Cause:** `results.push(value)` — completion order, not input order.
**Fix:** `results[index] = value`.

**Symptom:** `item.then is not a function`
**Cause:** A non-promise value in the input.
**Fix:** `Promise.resolve(item)` — which also handles thenables.

**Symptom:** A `Set` or generator input fails
**Cause:** The implementation assumed an array.
**Fix:** `Array.from(iterable)`.

**Symptom:** Requests keep running after one rejects
**Cause:** `Promise.all` does not cancel anything.
**Fix:** A shared `AbortSignal` if cancellation is required.

**Symptom:** `Promise.all` resolves instantly with an array of functions
**Cause:** Functions were passed instead of started promises — non-promise values are counted as-is.
**Fix:** Call them: `.map(fn => fn())`.

**Symptom:** Requests run sequentially despite `Promise.all`
**Cause:** `await` inside the loop that builds the array.
**Fix:** Build the array of promises first, then await once.

**Symptom:** `allSettled` results are read as `.error`
**Cause:** The specified property is `reason`.
**Fix:** `{ status, value }` / `{ status, reason }`.

## Interview questions

**★ Implement `Promise.all`.**
A counter and an indexed results array. Resolve immediately on an empty input; wrap each item in
`Promise.resolve` so non-promises and thenables work; **assign by index** so order is input order,
not completion order; decrement a counter and resolve at zero; pass `reject` straight through.

**★ What does `Promise.all([])` do?**
Fulfils immediately with `[]` — MDN even specifies that it *"resolves synchronously if and only if
the iterable passed is empty."* An implementation that only resolves inside a `then` hangs forever,
with no error.

**★ Why `results[index] = value` rather than `push`?**
Because promises settle in completion order and the result must be in **input** order. `push`
passes any test where they happen to finish in order, which is why it survives review.

**★ Does `Promise.all` cancel the others when one rejects?**
No. They keep running and their results are discarded — you only stop hearing about them. If
cancellation matters, share an `AbortSignal` across the requests.

**★ Implement `allSettled` in one line of thought.**
Map each input through a `then` that converts fulfilment to `{status: "fulfilled", value}` and
rejection to `{status: "rejected", reason}`, then hand it to `all`. Once nothing can reject, `all`
does the rest.

**★ When is `Promise.all` the wrong choice?**
Whenever one failure should not discard the successes — analytics fan-out, dashboard widgets, cache
warming. That is more often than people reach for `allSettled`.

**Why does `Promise.all(urls.map(u => () => fetch(u)))` resolve instantly?**
Because a function is a non-promise value: MDN says non-promise values are *"ignored, but still
counted"*, so it fulfils immediately with the array of functions. The promises must already be
started.

---

[Topic index](./README.md) · Next → [02 · race and any](./02-race-and-any.md)
