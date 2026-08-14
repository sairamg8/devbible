---
title: "10.1 · all and allSettled"
sidebar_label: "01 · all and allSettled"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**Both wait for everything. They differ entirely in what a failure means.** `all` treats one
failure as the failure of the whole operation; `allSettled` treats failure as a result to be
reported.

## `Promise.all` — one failure kills the aggregate

MDN:

> "takes an iterable of promises as input and returns a single `Promise`… useful when you
> have **multiple related asynchronous tasks that all need to complete successfully**."

Three documented behaviours, each worth knowing precisely.

**Results come back in input order:**

> an "array of fulfillment values **in the order of the promises passed, regardless of
> completion order**"

```js
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]);
```

That guarantee is what makes destructuring safe. "Fastest first" is a common and wrong
assumption.

**It is fail-fast:**

> "Rejects immediately upon **any** of the input promises rejecting", with "the rejection
> reason of the **first** promise that was rejected".

Note *first to reject*, not "first in the array". If two fail, you see the one that failed
sooner, and the other reason is simply not available to you.

**Non-promises pass straight through.** MDN's example fulfils `Promise.all([1, 2, 3])` with
`[1, 2, 3]`, and mixes values and promises freely — so there is never a need to wrap a value
you already have in `Promise.resolve`.

### `all` is the "related tasks" combinator

The decision is not about how many promises you have; it is about whether a partial result
is meaningful.

```js
// ✅ all: a dashboard that cannot render without every panel's data
const [user, orders, balance] = await Promise.all([
  getUser(id), getOrders(id), getBalance(id),
]);
```

If any one of these fails, there is no dashboard to draw, so failing the whole thing
immediately is correct and simplifies everything downstream.

## `Promise.allSettled` — failure is a result

MDN:

> "returns a single `Promise`… that **fulfills when all of the input's promises settle**
> (including when an empty iterable is passed), with an array of objects that describe the
> outcome of each promise."

And the fact that defines its use:

> "**`Promise.allSettled()` never rejects.**"

The result shape, quoted:

> - **`status`**: A string, either `"fulfilled"` or `"rejected"`…
> - **`value`**: Only present if `status` is `"fulfilled"`…
> - **`reason`**: Only present if `status` is `"rejected"`…

```js
[
  { status: 'fulfilled', value: 33 },
  { status: 'fulfilled', value: 66 },
  { status: 'fulfilled', value: 99 },
  { status: 'rejected', reason: Error: an error }
]
```

🔴 **`value` and `reason` are *absent*, not `undefined`-and-present.** So branch on `status`
rather than on the presence of a value — a task that legitimately fulfils with `undefined` is
indistinguishable otherwise.

```js
const results = await Promise.allSettled(ids.map(getUser));

const users  = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
const failed = results.filter((r) => r.status === "rejected");

if (failed.length) log.warn({ count: failed.length }, "some users failed to load");
```

### MDN's own framing of the choice

> **`Promise.all()`**: "May be more appropriate if tasks are **dependent on each other**, or
> if you'd like to **immediately reject upon any of them rejecting**."
>
> **`Promise.allSettled()`**: "Typically used when you have multiple asynchronous tasks that
> are **not dependent on one another**, or when you'd **always like to know the result of
> each promise**, regardless of success or failure."

That is the clearest statement of it: **dependent → `all`; independent → `allSettled`.**

## The `allSettled` trap: a silent failure

Because it never rejects, `allSettled` will happily hand you an array in which everything
failed, and code that only reads the fulfilled entries sees an empty list rather than an
error.

```js
const results = await Promise.allSettled(ids.map(getUser));
const users = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);          // ⚠️ silently [] if every request failed
render(users);                    // renders an empty page, reports nothing
```

**`allSettled` moves the responsibility for noticing failure onto you.** That is the trade —
you asked not to be interrupted, so you must inspect. Always do something with the rejected
entries, even if it is only a log; and consider whether "all of them failed" should be
escalated:

```js
if (failed.length === results.length && results.length > 0) {
  throw new AggregateError(failed.map((r) => r.reason), "every request failed");
}
```

## Empty iterables

Both handle it, and both are documented as **synchronous**:

- `Promise.all([])` — MDN: "already fulfilled **synchronously**" with `[]`.
- `Promise.allSettled([])` — MDN: "the returned promise is **already fulfilled**
  (synchronously)".

MDN adds a subtlety for `allSettled` worth noting: *"if the iterable is non-empty but
contains no pending promises, the returned promise is still **asynchronously** fulfilled"*.
So "already settled inputs" is not the same case as "no inputs".

This matters when the array is built dynamically — `Promise.all(items.map(fn))` on an empty
`items` does the sensible thing rather than hanging, which is **not** true of every
combinator ([chunk 03](./03-choosing-and-the-losers.md)).

## Gotchas

**Symptom:** Results appear in completion order rather than the order you passed them
**Cause:** They do not. MDN guarantees *"the order of the promises passed, regardless of
completion order"*.
**Fix:** Look at how the input array was built.

**Symptom:** `Promise.all` reported one failure but two things were broken
**Cause:** It rejects with *"the rejection reason of the first promise that was rejected"* —
first by time, not by position. The other reason is unavailable.
**Fix:** Use `allSettled` when you need every failure.

**Symptom:** An `allSettled` result's `value` is `undefined` and you cannot tell why
**Cause:** `value` is **absent** on rejected entries, not `undefined`; and a fulfilled task
may legitimately produce `undefined`.
**Fix:** Branch on `status`, never on the presence of `value`.

**Symptom:** A page renders empty and nothing is logged
**Cause:** `allSettled` never rejects; code filtered for fulfilled entries and got `[]`.
**Fix:** Inspect the rejected entries. Escalate if everything failed.

**Symptom:** Wrapping a plain value in `Promise.resolve` before `Promise.all`
**Cause:** Unnecessary — MDN's own example passes bare values.
**Fix:** Pass the value directly.

**Symptom:** `Promise.all` over an empty array behaves unexpectedly
**Cause:** It fulfils **synchronously** with `[]`, which is almost always what you want.
**Fix:** Expected. Note that `Promise.race([])` does *not* behave this sensibly.

## Interview questions

**★ What is the difference between `Promise.all` and `Promise.allSettled`?**
`all` is **fail-fast** — it rejects immediately on the first rejection, with that reason.
`allSettled` **never rejects**; it fulfils once everything has settled, with one
`{status, value|reason}` object per input. MDN's rule: `all` for tasks *"dependent on each
other"*, `allSettled` when they are *"not dependent on one another"* or when you *"always
like to know the result of each"*.

**★ In what order does `Promise.all` resolve its results?**
**Input order**, regardless of completion order — which is what makes destructuring safe.

**★ If two promises in `Promise.all` reject, which reason do you get?**
The **first to reject** in time, not the first in the array. The other reason is not
available; use `allSettled` if you need all of them.

**★ What is the danger of `allSettled`?**
It never rejects, so a total failure looks like an empty success. Code that filters for
fulfilled entries silently gets `[]`. You take on the duty of inspecting the rejected
entries, and of deciding whether "everything failed" should escalate.

**★ How do you read an `allSettled` result correctly?**
Branch on `status`. `value` and `reason` are **absent** rather than `undefined` on the
opposite branch, and a fulfilled task may legitimately produce `undefined`.

**What does `Promise.all([])` do?**
Fulfils **synchronously** with `[]`. `allSettled([])` likewise — though MDN notes a non-empty
iterable of already-settled promises still fulfils *asynchronously*.

---

[Topic index](./README.md) · Next → [02 · `race` and `any`](./02-race-and-any.md)
