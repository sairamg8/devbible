---
title: "09.2 · Starting work before awaiting it"
sidebar_label: "02 · Starting before awaiting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**The fix follows directly from what `await` does: the expression runs immediately, so
separate the *calling* from the *waiting*.**

```js
const userP = getUser(id);              // in flight
const settingsP = getSettings(id);      // in flight
const notificationsP = getNotifications(id);   // in flight

const user = await userP;
const settings = await settingsP;
const notifications = await notificationsP;
```

All three requests start in the same synchronous pass, before any `await` runs. Total time
is now the **slowest** call, not the sum. The three `await`s cost nothing extra: by the time
the first resolves, the others are already in flight, and awaiting an already-settled promise
costs one tick.

A naming convention helps a lot here — suffix the *promise* variables (`userP`, or
`userPromise`) so the difference between "started" and "resolved" is visible at a glance.

## `Promise.all` is the same thing, said better

```js
const [user, settings, notifications] = await Promise.all([
  getUser(id),
  getSettings(id),
  getNotifications(id),
]);
```

Identical concurrency, and better in three ways: the intent is explicit, destructuring keeps
the names next to the calls, and error handling is unified rather than spread across three
awaits.

MDN's guarantee about the result:

> Returns "an **array of fulfillment values in the order of the promises passed**, regardless
> of completion order"

🔴 **Order of results is input order, not completion order.** This is what makes
destructuring safe, and it is worth stating because "the fastest one is first" is a common
wrong assumption.

Two more documented details worth knowing:

- **Non-promises are allowed.** MDN's example fulfils `Promise.all([1, 2, 3])` with
  `[1, 2, 3]`, and mixes plain values with promises freely. So you never need to wrap a
  value you already have.
- **An empty iterable fulfils synchronously** — MDN: *"already fulfilled synchronously"* with
  `[]`. Useful to know when the array is built dynamically and may be empty.

### With a list: `map` then `all`

```js
const users = await Promise.all(ids.map((id) => getUser(id)));
```

This is the fix for the `await`-in-a-loop case from
[chunk 01](./01-the-accidental-waterfall.md). `map` starts every request — they are all in
flight before `Promise.all` is even called — and `Promise.all` provides the join and the
ordering.

Note the shape `ids.map((id) => getUser(id))` rather than `ids.map(getUser)`: `map` passes
`(element, index, array)`, so a point-free version hands the index as a second argument to
`getUser`, which is a real bug when the function takes options there.

## The mixed case: partial dependency

Most real functions are neither fully sequential nor fully parallel.

```js
// getConfig needs nothing; getPosts needs the user
const configP = getConfig();                 // start it now
const user = await getUser(id);
const posts = await getPosts(user.id);
const config = await configP;                // already resolved by now, most likely
```

**Start the independent work first, then do the dependent chain.** The total is
`max(config, user → posts)` rather than the sum. This is the pattern that most often turns a
slow handler into a fast one, and it does not need `Promise.all` at all.

## The hazard of hoisting: a rejection with nobody watching

Separating the call from the `await` creates a window where a promise exists with no handler
attached. If it rejects during that window, it is an **unhandled rejection**
([08 · 03](../08-error-handling/03-unhandled-rejections.md)) — in Node, by default, raised as
an uncaught exception.

```js
const aP = mightFail();          // rejects in 10 ms
const b = await slowThing();     // takes 500 ms
const a = await aP;              // ⚠️ too late — already reported unhandled
```

Node's window is *"within a turn of the event loop"*, so a rejection that arrives while you
are awaiting something else has already been counted.

**`Promise.all` does not have this problem**, and MDN says why: it *"immediately marks all
promises as 'handled'"* by calling their `.then()` methods when it is called. Every input
gets a handler in the same turn.

🔴 **So prefer `Promise.all` over hand-hoisted variables**, and when you must hoist — as in
the mixed case above — attach a handler at the start point:

```js
const configP = getConfig().catch((e) => {   // handled in the same turn
  log.warn("config failed", e);
  return DEFAULTS;
});
```

## What `Promise.all` does on failure

MDN:

> "Rejects immediately upon **any** of the input promises rejecting", with "the rejection
> reason of the **first** promise that was rejected".

And the part people expect to be different:

> The promises themselves "are not explicitly cancelled — they continue their internal
> execution."

**Fail-fast is about the aggregate promise, not about the work.** The other requests keep
running to completion; you simply stop waiting for them. There is no cancellation in
`Promise.all`, and if you need it, that is `AbortController` and
[14 · Cancellation](../README.md).

One useful consequence, also documented: because all inputs were marked handled at the start,
**later rejections do not produce unhandled-rejection reports**. So a `Promise.all` that
fails fast does not also spam your error handler with the stragglers.

If you need every result regardless of failures, that is `Promise.allSettled` —
[10 · The combinators](../README.md).

## When sequential is the right answer

Parallel is not automatically better. Keep it sequential when:

| Reason | Example |
|---|---|
| **Genuine dependency** | `getPosts(user.id)` needs the user |
| **Ordering matters at the target** | writes that must be applied in order |
| **Rate limits** | an API allowing N requests per second — sequencing *is* the throttle |
| **Resource pressure** | 10 000 concurrent requests will exhaust sockets, memory or the target |

That last row is the one that bites at scale: `Promise.all(hugeArray.map(fn))` starts
**every** request at once. For large lists the correct shape is a bounded worker pool —
[16 · Concurrency limiting](../README.md) — not `Promise.all`.

**The decision rule:** parallel for a handful of independent calls, sequential for
dependencies and ordering, bounded concurrency for lists of unknown size.

## Gotchas

**Symptom:** Hoisting the calls did not speed anything up
**Cause:** The calls were still made one per `await`, or the function was awaited inside a
helper.
**Fix:** Check that every call is made **before** the first `await`. Only then are they
concurrent.

**Symptom:** An unhandled rejection appears after splitting a call from its `await`
**Cause:** The promise rejected during the window before its `await` — Node's window is one
turn of the event loop.
**Fix:** Use `Promise.all`, which MDN says *"immediately marks all promises as handled"*, or
attach a `.catch` at the start point.

**Symptom:** Results came back in the wrong order from `Promise.all`
**Cause:** They did not. MDN guarantees *"the order of the promises passed, regardless of
completion order"*.
**Fix:** Look for a bug in how the input array was built.

**Symptom:** `ids.map(getUser)` behaves oddly
**Cause:** `map` passes `(element, index, array)`, so the index is handed to `getUser` as a
second argument.
**Fix:** `ids.map((id) => getUser(id))`.

**Symptom:** One failure in `Promise.all` and the other requests still hit the server
**Cause:** MDN: the promises *"are not explicitly cancelled — they continue their internal
execution."* Fail-fast stops the waiting, not the work.
**Fix:** Expected. Use `AbortController` if the work must actually stop.

**Symptom:** `Promise.all` over a large list exhausts sockets or memory
**Cause:** It starts **every** task at once.
**Fix:** A bounded worker pool. `Promise.all` is for a handful of known calls.

**Symptom:** You need results even when some fail, but `Promise.all` rejects
**Cause:** `Promise.all` is fail-fast by design.
**Fix:** `Promise.allSettled`, which never rejects.

## Interview questions

**★ How do you fix an async waterfall?**
Separate calling from waiting: make all the independent calls first, then `await` them —
or, better, `await Promise.all([...])`. Because `await` evaluates its expression
immediately, everything called before the first `await` is already in flight.

**★ Why is `Promise.all` preferable to hoisting the promises into variables?**
Intent, destructuring and unified error handling — plus a real safety property: MDN says
`Promise.all` *"immediately marks all promises as handled"*. Hand-hoisted promises have a
window with no handler attached, and a rejection in that window is reported unhandled.

**★ In what order does `Promise.all` return results?**
**Input order**, regardless of which settled first — which is what makes destructuring safe.

**★ When one promise in `Promise.all` rejects, what happens to the others?**
The aggregate rejects immediately with the first rejection reason, but the other promises
*"are not explicitly cancelled — they continue their internal execution."* Fail-fast stops
the waiting, not the work. Real cancellation needs `AbortController`.

**★ Is `Promise.all(bigArray.map(fn))` a good idea?**
Not for a large or unknown-size list — it starts every task at once and can exhaust sockets,
memory or the target service. Use bounded concurrency. `Promise.all` is for a handful of
known calls.

**When should work stay sequential?**
Genuine dependencies, ordering requirements at the target, rate limits where sequencing is
the throttle, and resource pressure. Parallel is not automatically better.

**How do you handle a function with mixed dependencies?**
Start the independent work first, then run the dependent chain, awaiting the independent
promise at the end — total time becomes the max rather than the sum. Attach a `.catch` at the
start point so the hoisted promise is never unowned.

---

← Prev [01 · The accidental waterfall](./01-the-accidental-waterfall.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
