---
title: "07.3 · Reading the ordering"
sidebar_label: "03 · Reading the ordering"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**The interview question is always an ordering question.** This chunk is the method for
answering it, built from two rules already established rather than from memorised outputs.

## The two rules, and nothing else

1. **Everything up to and including the first `await` runs synchronously** — MDN,
   [chunk 02](./02-where-it-suspends.md).
2. **Each `await` suspends and resumes in a microtask**, always, even on an already-settled
   value.

Every ordering puzzle in this area is those two rules plus the drain order from
[03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md): all synchronous
code, then the entire microtask queue, then one task.

## The method

Read the program in three passes.

**Pass 1 — walk the synchronous path.** Enter every `async` function that gets called, run
it until its first `await`, note that the `await`ed expression *is evaluated*, then jump
back to the caller. Collect everything logged along the way.

**Pass 2 — drain the microtask queue.** Resume each suspended continuation in the order it
was queued. A continuation that hits another `await` suspends again, queuing behind whatever
is already there.

**Pass 3 — run one task**, then drain microtasks again, and repeat.

### Worked example

```js
async function f() {
  console.log("1");
  await null;
  console.log("2");
  await null;
  console.log("3");
}

console.log("0");
f();
setTimeout(() => console.log("timer"), 0);
Promise.resolve().then(() => console.log("then"));
console.log("4");
```

**Pass 1 (synchronous):** `0` · `f()` is called and runs to its first `await`, printing `1`,
then suspends · the `setTimeout` is registered · the `.then` is registered · `4`.
→ **`0, 1, 4`**

**Pass 2 (microtask drain):** two microtasks are queued — `f`'s continuation (queued first)
and the `.then` (queued second). `f` resumes and prints `2`, then hits its **second**
`await`, which queues a *third* microtask behind the `.then`. The `.then` runs, printing
`then`. Then `f`'s second continuation runs, printing `3`.
→ **`2, then, 3`**

**Pass 3 (task):** `timer`.

**Full output: `0, 1, 4, 2, then, 3, timer`.**

> This ordering is **derived from the documented rules above**, not copied from a run — no
> sandbox was used for it. The derivation is the point: if you can reproduce the three
> passes, you do not need to remember the answer.

🔴 **The instructive part is `2, then, 3`.** A function with two `await`s does not resume all
at once — it rejoins the back of the queue at each one. That is why interleaving with other
microtasks is possible, and it is the thing that cannot be guessed without the method.

## `await` does not block the thread

Worth restating because the syntax invites the opposite reading. From
[01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md): `await` suspends the
**function**, not the thread. While one function is suspended, the caller continues, other
handlers run, and the page stays responsive.

The corollary is the one that gets tested:

```js
async function slow() {
  await null;
  for (let i = 0; i < 1e9; i++) {}   // ⚠️ still freezes everything
}
```

**`await` cannot rescue a synchronous hot loop.** Once the continuation resumes, it runs to
completion like any other job — run-to-completion applies to continuations exactly as it
applies to functions.

## Two `async` functions interleave

```js
async function a() { console.log("a1"); await null; console.log("a2"); }
async function b() { console.log("b1"); await null; console.log("b2"); }
a();
b();
```

Pass 1 gives `a1, b1` — both run synchronously to their first `await`. Pass 2 gives
`a2, b2`, in queue order. **The two functions are interleaved, not run one after another**,
which is concurrency without parallelism: one thread, two suspended functions taking turns.

This is the whole reason a thousand concurrent `fetch`es are cheap.

## `await` in a loop is sequential

```js
for (const id of ids) {
  const user = await getUser(id);   // ⚠️ one round trip at a time
  results.push(user);
}
```

Each iteration suspends until its request settles, so ten IDs are ten sequential round
trips. The loop reads like ordinary code and behaves like a waterfall — this is the single
most common performance bug written with `async`/`await`, and it gets its own topic in
[09 · Sequential vs parallel `await`](../README.md).

The distinction to hold now: **a loop is the correct shape when each step depends on the
previous one**, and the wrong shape when the steps are independent.

### And `await` inside `forEach` does nothing at all

```js
ids.forEach(async (id) => {
  const user = await getUser(id);   // ⚠️ forEach ignores the returned promise
});
console.log("done");                // runs immediately, nothing is loaded
```

`forEach` has no idea its callback returned a promise; it discards the return value and
moves on. The callbacks all start, none are awaited, and rejections inside them float free —
the callback trap covered from the array side in
[Phase 5 · 04 · 02](../../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md).
Use `for...of` to sequence, or `Promise.all(ids.map(…))` to run concurrently.

## Gotchas

**Symptom:** A two-`await` function's second half runs after an unrelated `.then`
**Cause:** Each `await` re-queues the continuation at the **back** of the microtask queue.
**Fix:** Expected. Two `await`s means two separate resumptions, each interleavable.

**Symptom:** An `async` function's first lines ran before the caller's next line
**Cause:** Everything up to the first `await` runs **synchronously**, on the caller's stack.
**Fix:** Expected. Only what follows an `await` is deferred.

**Symptom:** The page froze even though the function was `async`
**Cause:** `await` suspends the **function**, not the thread. A synchronous hot loop in a
continuation blocks exactly as it would anywhere else.
**Fix:** Chunk the work across tasks or move it to a worker.

**Symptom:** A loop of `await`s is far slower than expected
**Cause:** Each iteration waits for the previous — sequential round trips.
**Fix:** If the steps are independent, start them all and await together.

**Symptom:** `forEach` with an `async` callback completes instantly and loads nothing
**Cause:** `forEach` discards the callback's return value, so nothing is awaited and
rejections float.
**Fix:** `for...of` with `await` to sequence, or `Promise.all(arr.map(fn))` to run
concurrently.

**Symptom:** Two `async` functions' logs are interleaved rather than grouped
**Cause:** Both run synchronously to their first `await`, then resume in queue order — one
thread, taking turns.
**Fix:** Expected, and the point. Await one before calling the other if you need strict
ordering.

## Interview questions

**★ Predict the output:** `console.log(0)`, an `async` `f()` logging `1` before `await null`
and `2` after, a `setTimeout` logging `timer`, a `.then` logging `then`, `console.log(4)`.
`0, 1, 4, then/2 in queue order, timer`. Method: synchronous pass first (`0`, `1` — because
code up to the first `await` runs synchronously — then `4`), then the microtask drain in the
order the continuations were queued, then the task.

**★ Why does a function with two `await`s interleave with other microtasks?**
Because each `await` queues its continuation at the **back** of the microtask queue. The
function resumes, runs to the next `await`, and re-queues — so anything queued in between
runs first.

**★ Does `await` block the thread?**
No — it suspends the **function**. The caller resumes immediately and other work continues.
But once a continuation resumes it runs to completion, so a synchronous hot loop after an
`await` freezes everything just the same.

**★ Why is `await` in a `for` loop slow?**
Each iteration waits for the previous to settle, giving sequential round trips. Correct when
each step depends on the last; a waterfall when the steps are independent.

**★ What does `await` inside `forEach` do?**
Nothing useful. `forEach` discards the callback's return value, so the promises are never
awaited and their rejections float free. Use `for...of` to sequence or
`Promise.all(arr.map(fn))` to run concurrently.

**How do two `async` functions called back-to-back interleave?**
Both run synchronously to their first `await` (so both "first halves" print first), then
their continuations resume in queue order. One thread, two suspended functions taking turns —
concurrency without parallelism.

---

← Prev [02 · Where it suspends](./02-where-it-suspends.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
