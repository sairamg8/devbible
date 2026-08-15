---
title: "02 · The bounded pool"
sidebar_label: "02 · The bounded pool"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Array.prototype.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/entries), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted). Documentation-validated; **no timings, no console blocks**.

Two patterns get used for "N at a time". One is right and one is a trap that looks simpler, so
it is worth seeing the wrong one first.

## The batching trap

```js
// ❌ chunk the list and Promise.all each chunk
for (const batch of chunk(ids, 6)) {
  results.push(...await Promise.all(batch.map(getItem)));
}
```

It bounds concurrency, so it is not *wrong* — but it wastes most of what bounding was supposed
to buy.

🔴 **Every batch waits for its own slowest item before the next one starts.** Five fast requests
and one slow one means five idle slots for the whole duration of the slow one. Concurrency
sawtooths between 6 and 1, and the total time becomes the sum of the per-batch maxima rather
than anything close to the ideal.

It also inherits `Promise.all`'s fail-fast behaviour **per batch**: one failure aborts the loop
with the remaining batches untouched and the rest of the current batch still running.

**The property you actually want is a *steady* N**: the moment one task finishes, the next one
starts. That is a worker pool, not a batch loop.

## The worker pool

The whole trick is that **N workers share one iterator**. Each worker takes the next item, does
the work, and comes back for another; the iterator's own cursor is the queue.

```js
async function mapLimit(items, limit, fn, { signal } = {}) {
  const it = items.entries();                 // shared cursor: [index, value]
  const results = new Array(items.length);

  async function worker() {
    for (const [i, item] of it) {             // ✅ each worker pulls the NEXT untaken item
      signal?.throwIfAborted();
      results[i] = await fn(item, i, { signal });
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

Four things in nine lines, each doing real work:

| | Why it is there |
|---|---|
| `items.entries()` | one iterator, shared — `for…of` over it in several workers hands each iteration to whichever worker asked first, so no two workers take the same item |
| `results[i] = …` | writing **by index** keeps output order identical to input order, even though completion order is not |
| `Math.min(limit, items.length)` | never start more workers than there is work |
| `Promise.all(workers)` | joins the *workers*, of which there are exactly N — not the tasks, of which there may be fifty thousand |

**Concurrency here is genuinely steady.** A worker that finishes a fast item immediately pulls
the next one while the slow item is still running; the pool only drops below N when the iterator
runs dry.

⚠️ **The shared-iterator step is the part to understand rather than memorise.** `for…of` calls
`next()` on the *same* iterator object in every worker, and each call returns the following
entry — that is the whole queue. The iteration protocol underneath it is
**Phase 6 · 04 · The iteration protocols** *(not written yet)*.

## Errors: fail-fast or collect

The pool above is fail-fast: a rejection from `fn` rejects its worker, and `Promise.all` over
the workers rejects immediately — while the other N−1 workers **keep going**, exactly the
problem from [01](./01-why-unbounded-breaks.md).

For bulk work you almost always want the other behaviour. Record the outcome per item and let
the caller decide:

```js
async function mapSettled(items, limit, fn, { signal } = {}) {
  const it = items.entries();
  const results = new Array(items.length);

  async function worker() {
    for (const [i, item] of it) {
      if (signal?.aborted) return;
      try {
        results[i] = { status: 'fulfilled', value: await fn(item, i, { signal }) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };     // 🔴 the worker survives
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

The shape matches `Promise.allSettled`'s deliberately — `{ status, value }` or
`{ status, reason }` — so callers already know how to read it, and one failed row out of ten
thousand no longer discards the other 9 999.

**Then decide what "failed" means for the operation as a whole.** Three reasonable policies,
and the caller picks:

| Policy | Implementation |
|---|---|
| Best effort | return the settled array; caller filters |
| All or nothing | collect, then throw if any rejected — with the reasons attached |
| Stop early | abort the shared signal on the first rejection, so workers stop pulling |

```js
const failures = results.filter((r) => r.status === 'rejected');
if (failures.length) {
  throw new AggregateError(failures.map((f) => f.reason), `${failures.length} of ${results.length} failed`);
}
```

`AggregateError` carries every reason instead of the first one, which is what a bulk report
needs. It is **Phase 8 · 16 · `AggregateError`** *(not written yet)*.

## Cancellation, and stopping early

Two different things, worth keeping separate:

**Cancelling the whole operation** is the caller's signal, threaded down: checked before each
pull (`throwIfAborted()`), and passed into `fn` so the in-flight request itself aborts rather
than merely being ignored ([14 · Cancellation](../14-cancellation/01-the-model.md)).

**Stopping early on failure** is the pool's own controller, composed with the caller's:

```js
const ac = new AbortController();
const inner = signal ? AbortSignal.any([signal, ac.signal]) : ac.signal;
// …on the first rejection: ac.abort(reason)
```

🔴 **Without an abort, "stop early" only stops *queuing*.** The N tasks already in flight run to
completion and their results are thrown away — the same waste `Promise.all` makes, at a smaller
scale.

## Results, memory and streaming

`mapLimit` allocates a result array as long as the input, which is right for a few thousand rows
and wrong for a few million. When the point is the effect rather than the values — writing to a
database, uploading files — **do not accumulate**:

```js
async function forEachLimit(items, limit, fn, { signal } = {}) {
  const it = items[Symbol.iterator]();
  const worker = async () => {
    for (const item of it) { signal?.throwIfAborted(); await fn(item); }
  };
  await Promise.all(Array.from({ length: limit }, worker));
}
```

**And note the input is an iterator, not an array.** The pool never indexes `items`, so it works
over a generator or a paged API just as well — which is how you process more rows than fit in
memory. Feeding it from an async source, and what to do when the producer outruns the pool, is
**22 · Async work and backpressure** *(not written yet)*.

## Deduplicating in-flight work

Two requests for the same key occupy two slots for one answer. Cache the **promise**, not the
result, so the second caller joins the first:

```js
const inFlight = new Map();

function once(key, fn) {
  if (!inFlight.has(key)) {
    inFlight.set(key, fn().finally(() => inFlight.delete(key)));   // 🔴 clear on settle
  }
  return inFlight.get(key);
}
```

`.finally` removing the entry is what stops this becoming a cache — and an unbounded one at
that. Leaving it in place caches failures forever, which is
[Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) in
miniature.

## Reaching for a library

`p-limit`, `p-map` and `p-queue` do exactly this, with priorities, pause/resume and per-interval
rate limiting added. **Using one is the right call in an application**; being able to write the
nine-line version is what interviews ask for, and the full hand-rolled queue — with priorities,
pause, and a pending count — is **Phase 17 · 07 · A concurrency-limited task queue**
*(not written yet)*.

## Gotchas

**Symptom: concurrency sawtooths and the job takes far longer than expected.**
Cause — batching with `Promise.all` per chunk; every batch waits for its slowest item.
Fix — a worker pool over a shared iterator, so a finished worker starts the next item at once.

**Symptom: two workers processed the same item.**
Cause — each worker got its own iterator (e.g. `for (const x of items)` inside the worker).
Fix — create the iterator **once**, outside, and share it.

**Symptom: results come back in completion order, not input order.**
Cause — pushing into an array as tasks finish.
Fix — write by index: `results[i] = …`.

**Symptom: one bad row aborts a 10 000-row import.**
Cause — fail-fast joining.
Fix — capture per-item outcomes in the worker's `try`/`catch` and report with `AggregateError`.

**Symptom: "stop early" still hammered the API for another few seconds.**
Cause — stopping the queue does not cancel in-flight tasks.
Fix — an internal `AbortController`, composed with the caller's signal and passed into `fn`.

**Symptom: memory grows with the input size even at a limit of six.**
Cause — a result array as long as the input, or the whole input materialised.
Fix — a `forEach`-style pool with no accumulation, fed from an iterator or a paged source.

**Symptom: the same key is fetched several times concurrently.**
Cause — no in-flight deduplication.
Fix — cache the promise by key and delete it in `.finally`.

## Interview questions

**★ Implement "run N promises at a time".**
Create one iterator over the input, start N workers, and have each worker `for…of` the shared
iterator — take the next item, await it, write the result by index, repeat. Join the N workers
with `Promise.all`.

**★ Why is the shared iterator the key part?**
Because it *is* the queue. Every worker's `next()` call returns the following item, so no two
workers take the same one and a free worker always picks up the next available item immediately.

**★ Why not just batch the list into groups of N?**
Each batch waits for its slowest member, so concurrency sawtooths from N down to 1 and the total
time is the sum of the per-batch maxima. A pool keeps N in flight continuously.

**★ How do you keep the results in input order?**
Write to `results[i]` using the index from the iterator, rather than pushing on completion.

**★ How does one item's failure not kill the whole run?**
Catch inside the worker and record `{ status, reason }` per item — the `allSettled` shape — then
decide the policy at the end, reporting every reason with `AggregateError`.

**★ How do you stop a pool early, properly?**
Abort an internal controller composed with the caller's signal: it stops workers pulling *and*,
because the signal is passed into each task, cancels what is already in flight.

**Would you write this or use a library?**
A library in production — `p-limit` and friends add priorities and rate limiting. The nine-line
version is what you should be able to write on demand.

---

← [01 · Why unbounded parallelism breaks](./01-why-unbounded-breaks.md) · [Topic index](./README.md)
