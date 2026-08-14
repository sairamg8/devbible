---
title: "09.1 · The accidental waterfall"
sidebar_label: "01 · The accidental waterfall"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all). Documentation-validated.

**This is the most common performance bug written with `async`/`await`, and it is invisible
because the code is correct.** It does what it says. It just does it one thing at a time.

```js
const user = await getUser(id);
const settings = await getSettings(id);      // ⚠️ waited for getUser for no reason
const notifications = await getNotifications(id);
```

Three round trips in series. If each takes 200 ms the function takes 600 ms, and nothing in
the code says the second call needed the first.

## Why the syntax invites it

From [07 · 02](../07-async-await/02-where-it-suspends.md): `await` evaluates its expression
**immediately** and defers only the code that depends on the result. The three things happen
in this order:

1. `getUser(id)` is called — request in flight.
2. The function suspends.
3. Control returns to the caller.

The problem is that **line 2 does not exist yet** while the function is suspended. The call
to `getSettings` has not happened, cannot happen, and will not happen until `getUser`
settles. The `await` did not slow down `getUser`; it delayed the *start* of everything after
it.

🔴 **`await` is a barrier, not a wait.** Everything textually after it is fenced behind it,
whether or not it depends on the value. Reading `await` as "block until this is ready" is
what makes the waterfall invisible — read it as "nothing below this line starts yet".

## Spotting it: the dependency test

For each `await`, ask one question: **does this call use a value produced by an earlier call
in this function?**

```js
const user = await getUser(id);
const posts = await getPosts(user.id);       // ✅ genuinely dependent — user.id is needed
```

```js
const user = await getUser(id);
const config = await getConfig();            // ⚠️ takes no argument from user — independent
```

If the argument list of a call contains nothing derived from a previous `await`, that call
did not need to wait. The test is mechanical and catches almost every case.

The subtler variant is a **partial** dependency:

```js
const user = await getUser(id);
const posts = await getPosts(user.id);       // needs user
const config = await getConfig();            // needs nothing
```

`getConfig` could have started at the top, in parallel with `getUser`. A chain of two
dependent calls plus one independent call should take `max(2 hops, 1 hop)`, not three hops.

## The loop is the expensive version

```js
const users = [];
for (const id of ids) {
  users.push(await getUser(id));             // ⚠️ N sequential round trips
}
```

With 50 IDs and a 100 ms call, that is **5 seconds**. The loop reads like ordinary
synchronous code and costs like a queue.

It is correct only when the iterations are genuinely dependent — each step needs the previous
one's result, or the target imposes an ordering:

```js
let cursor = null;
do {
  const page = await fetchPage(cursor);      // ✅ each call needs the previous cursor
  cursor = page.next;
} while (cursor);
```

**Pagination is the canonical legitimate `await`-in-a-loop.** So is anything writing to a
resource that requires ordering, and anything rate-limited where sequencing *is* the
throttle.

## Two loop shapes that do not do what they look like

### `forEach` — nothing is awaited

```js
ids.forEach(async (id) => {
  const user = await getUser(id);
  users.push(user);
});
console.log(users.length);                   // ⚠️ 0 — nothing has finished
```

`forEach` discards the callback's return value, so the promises are never awaited and the
function proceeds immediately. Every rejection also floats
([08 · 02](../08-error-handling/02-rejections-that-vanish.md)). This is the *opposite*
failure from the waterfall — maximum concurrency and no waiting at all — and it is worse,
because the result is wrong rather than slow.

### `map` without `Promise.all` — an array of promises

```js
const users = ids.map(async (id) => await getUser(id));
console.log(users[0].name);                  // ⚠️ undefined — users[0] is a Promise
```

`map` *does* keep the return values, so this is recoverable — it is exactly the input
`Promise.all` wants ([chunk 02](./02-starting-before-awaiting.md)). All the requests are
already in flight; the only thing missing is the join.

## What it costs, and what it does not

**The waterfall costs latency, not CPU.** Ten sequential requests use no more of the thread
than ten concurrent ones; the thread is idle either way
([01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md)). What you lose is
wall-clock time, and it compounds: a waterfall inside a function called in a waterfall is
quadratic in hops.

This is also why the bug survives code review and local testing. On a fast local network the
difference between 3 hops and 1 is milliseconds; against a real backend it is the difference
between 60 ms and 600 ms, and it only shows up in production traces.

🔴 **Look for it in request handlers and page loaders first** — the places where several
independent resources are gathered to build one response. That is where waterfalls both
occur most and cost most.

## Gotchas

**Symptom:** A function that makes three independent calls takes three times as long as one
**Cause:** Each was `await`ed before the next was started, so the later calls had not been
made yet.
**Fix:** Start them all first, then await — [chunk 02](./02-starting-before-awaiting.md).

**Symptom:** A loop over 50 IDs takes 5 seconds
**Cause:** `await` in the loop body serialises the round trips.
**Fix:** If the iterations are independent, `Promise.all(ids.map(getUser))`. If not, the loop
is correct — pagination genuinely needs it.

**Symptom:** `forEach` with an `async` callback finishes instantly with nothing loaded
**Cause:** `forEach` discards the returned promises; nothing is awaited and rejections float.
**Fix:** `for...of` to sequence, or `Promise.all(arr.map(fn))` to run concurrently.

**Symptom:** `map` with an `async` callback gives an array of `Promise` objects
**Cause:** Expected — `async` callbacks return promises.
**Fix:** `await Promise.all(arr.map(fn))`. The requests are already in flight; you only
lacked the join.

**Symptom:** Performance is fine locally and slow in production
**Cause:** A waterfall costs **latency**, which is negligible on a local network.
**Fix:** Count the hops in the code rather than trusting local timings.

**Symptom:** A refactor that extracted a helper made a page slower
**Cause:** The helper `await`s internally, so calls to it now serialise where the inlined
code had been parallel.
**Fix:** Have the helper return a promise the caller can start early, rather than awaiting
inside.

## Interview questions

**★ What is an async waterfall?**
Independent asynchronous calls made in series because each is `await`ed before the next is
started. `await` is a **barrier**: it fences everything textually after it, whether or not
that code depends on the value. Three 200 ms calls become 600 ms instead of 200 ms.

**★ How do you spot one?**
For each `await`, check whether the call's arguments contain anything derived from an earlier
`await` in the same function. If not, that call did not need to wait. The test is mechanical.

**★ When is `await` in a loop correct?**
When the iterations are genuinely dependent — **pagination** with a cursor is the canonical
case — or when the target requires ordering, or when sequencing *is* the rate limit.
Otherwise it is N round trips in series.

**★ What does `forEach(async …)` do?**
Starts every callback and awaits none of them, because `forEach` discards the return value.
The surrounding code proceeds immediately with nothing loaded, and every rejection floats.
It fails in the opposite direction from a waterfall, and worse — the result is wrong, not
just slow.

**★ Does a waterfall waste CPU?**
No — it wastes **wall-clock latency**. The thread is idle during every wait either way. That
is also why it survives review and local testing, and only shows up in production traces.

**Why can a refactor introduce one?**
Extracting a helper that `await`s internally makes calls to that helper serialise. A helper
that returns a promise instead lets the caller start it early.

---

[Topic index](./README.md) · Next → [02 · Starting work before awaiting it](./02-starting-before-awaiting.md)
