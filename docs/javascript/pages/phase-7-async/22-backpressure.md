---
title: "22 · Async work and backpressure"
sidebar_label: "22 · Backpressure"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against Node.js — [Stream § Buffering and `writable.write()`](https://nodejs.org/api/stream.html#buffering), [`stream.pipeline()`](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-callback), [`Readable[Symbol.asyncIterator]`](https://nodejs.org/api/stream.html#readablesymbolasynciterator) — and MDN [Streams API concepts](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts), [`WritableStreamDefaultWriter.ready`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStreamDefaultWriter/ready), [`CountQueuingStrategy`](https://developer.mozilla.org/en-US/docs/Web/API/CountQueuingStrategy), [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of). Documentation-validated; **no timings, no console blocks**.

```js
const results = await Promise.all(rows.map(process));   // rows.length === 50_000
```

[16 · Concurrency limiting](./16-concurrency-limiting/README.md) answered one half of why this is
a bug: fifty thousand operations start at once. **This page is the other half — the half a
concurrency limiter does not fix.**

🔴 **Bound the concurrency to six and you still hold fifty thousand items in memory, waiting.**
The limiter controls how many run; it says nothing about how many are *queued*. Backpressure is
the missing signal: **a consumer telling a producer to slow down.**

## The shape of the problem

```
producer  ──────►  queue  ──────►  consumer
 (fast)          (unbounded)         (slow)
```

When the producer is faster than the consumer and nothing connects them, the queue absorbs the
difference — and an unbounded queue is not a buffer, it is a **memory leak with a schedule**.
The symptoms arrive in a predictable order:

| Stage | What you see |
|---|---|
| 1 | memory climbs steadily, in proportion to input size |
| 2 | GC pressure — pauses get longer, throughput drops |
| 3 | latency for *everything else* rises; the queue is ahead of new work |
| 4 | the process is killed by the OOM killer, or the tab crashes |

⚠️ **Stage 1 looks like success.** The program is reading fast, the CPU is busy, and nothing has
failed. That is why this survives testing on a small fixture and appears on the first real
dataset.

**Backpressure is the fix, and it is one idea:** make the producer's "give me more" step *wait*
on the consumer's capacity. Every mechanism below is that sentence implemented differently.

## Pull beats push

```js
// ❌ push: the producer decides the rate, nothing can slow it
source.on('data', (row) => save(row));            // save() returns a promise nobody awaits

// ✅ pull: the consumer asks for the next item only when it is ready
for await (const row of source) await save(row);
```

🔴 **`for await…of` is backpressure by construction.** The loop calls `next()` only after the
body finishes, so the producer is never asked for more than one item ahead. It is the single
most useful thing to know here — the pull model makes the queue depth *one*, without a queue.

**The push version is the classic Node bug**: the `'data'` handler returns immediately because
`save()` is async, so the stream keeps emitting and every pending `save` piles up. The handler's
return value is ignored, so nothing can signal "not yet".

⚠️ **The trade-off is real: pull is serial.** One at a time is correct and slow. When you want
both — bounded concurrency *and* a bounded queue — feed the pool from the iterator itself rather
than from a materialised array
([16 · The bounded pool](./16-concurrency-limiting/02-the-bounded-pool.md) works on an iterator
for exactly this reason).

## The stream mechanisms, and what each one is telling you

Streams are where backpressure is built in, and both stream families expose the same signal in
their own shape.

### Node streams: `write()` returns `false`

```js
if (!writable.write(chunk)) {
  await once(writable, 'drain');       // 🔴 the buffer is over its high-water mark — wait
}
```

`writable.write()` returning `false` **is** the backpressure signal: the internal buffer has
exceeded `highWaterMark`, and you are asked to stop until `'drain'` fires. Ignoring the return
value is the whole bug — the write still *succeeds*, it just buffers, so nothing appears wrong
until memory does.

**`highWaterMark` is a threshold, not a hard cap.** The default is 16 KiB for byte streams and
**16 objects** in object mode; raising it buys latency headroom and costs memory.

🔴 **You should almost never handle `drain` yourself.** `pipe()` and `pipeline()` implement this
correctly, including error propagation and cleanup, and `pipeline` is the one to use because it
destroys every stream in the chain on failure:

```js
await pipeline(readable, transform, writable);    // backpressure and teardown, both handled
```

### Web Streams: `await writer.ready`

```js
const writer = writable.getWriter();
for (const chunk of chunks) {
  await writer.ready;                  // resolves when the queue has room
  writer.write(chunk);                 // do not await this to signal capacity
}
```

The Streams API models the same thing as a promise: `writer.ready` settles when `desiredSize` is
positive again, and the queuing strategy (`CountQueuingStrategy`,
`ByteLengthQueuingStrategy`, or your own) sets the `highWaterMark` that defines "room".

**`pipeTo()` and `pipeThrough()` do it for you**, exactly as `pipeline` does in Node — and they
take a `signal`, so cancellation composes with
[14 · Cancellation](./14-cancellation/README.md).

## Do not materialise what you can page

The most common backpressure failure has no stream in it at all:

```js
// ❌ every row in memory before any work starts
const rows = await db.query('SELECT * FROM events');
await mapLimit(rows, 6, process);

// ✅ page the source; the queue never exceeds one page
for await (const page of pages(db, { size: 500 })) {
  await mapLimit(page, 6, process);
}
```

**The `await` on the array is the bug.** It converts a producer that could have been paced into
a fixed memory cost proportional to the dataset. Cursors, `LIMIT`/`OFFSET` or keyset paging,
`Readable.from`, and async generators all avoid it — and an async generator is the most direct
expression:

```js
async function* pages(db, { size }) {
  for (let after = null; ; ) {
    const batch = await db.query(nextPage(after, size));
    if (!batch.length) return;
    yield batch;                         // 🔴 suspends here until the consumer asks again
    after = batch.at(-1).id;
  }
}
```

The generator does not fetch the next page until the consumer's loop comes back for it — pull
semantics, from a source that has no stream API. Generators in full are
**Phase 6 · 06 · Async iterators** *(not written yet)*.

## When you cannot slow the producer

Some producers do not take instruction: an event feed, a WebSocket, a user typing. The queue is
then a design decision, and there are only three honest answers:

| Strategy | Keep | Use when |
|---|---|---|
| **Bounded queue + block** | everything, eventually | you control the producer and can pause it |
| **Drop oldest** | the newest state | only the latest value matters — cursor position, live price |
| **Drop newest / reject** | what is already accepted | admission control; tell the caller no |
| **Sample / coalesce** | one item per window | high-frequency events — throttling, in effect |

🔴 **"Keep everything" is not on the list unless you can pause the producer.** An unbounded queue
does not preserve data; it delays the crash that loses all of it. Choosing to drop is the
responsible option, and the choice belongs in the code where a reader can see it.

## Gotchas

**Symptom: memory grows in proportion to input size even with a concurrency limit.**
Cause — the limiter bounds what runs, not what is queued.
Fix — page or stream the source so the queue is bounded too.

**Symptom: a Node stream pipeline uses gigabytes.**
Cause — the return value of `writable.write()` was ignored; buffered writes accumulated.
Fix — `pipeline()`, or honour `false` and wait for `'drain'`.

**Symptom: `stream.on('data', async …)` processes out of order and never slows down.**
Cause — the handler's promise is ignored, so the stream keeps pushing.
Fix — `for await…of`, which pulls one item at a time.

**Symptom: the process dies on the production dataset and is fine in tests.**
Cause — the whole result set was materialised with a single `await`.
Fix — a cursor, keyset paging, or an async generator that yields pages.

**Symptom: an event feed backs up until the tab crashes.**
Cause — an unbounded queue in front of a producer you cannot pause.
Fix — pick a drop policy deliberately: newest-wins, drop-oldest, or sample.

**Symptom: raising `highWaterMark` "fixed" the memory warning.**
Cause — it moved the threshold; the imbalance is unchanged.
Fix — fix the rate mismatch; the high-water mark is a tuning knob, not a solution.

**Symptom: cancelling a pipeline leaves file handles open.**
Cause — `pipe()` does not destroy the chain on error.
Fix — `pipeline()` in Node, `pipeTo(…, { signal })` in Web Streams.

## Interview questions

**★ Why is `await Promise.all(items.map(fn))` over 50 000 items a bug?**
Two reasons. Fifty thousand operations start at once, and every promise, result and input is held
in memory simultaneously. A concurrency limit fixes the first; only paging or streaming fixes the
second.

**★ What is backpressure?**
A consumer signalling a producer to slow down. Without it, the difference in rate accumulates in
a queue, and an unbounded queue is a scheduled out-of-memory failure.

**★ How does `for await…of` provide backpressure?**
It is pull-based: `next()` is called only after the loop body completes, so the producer is never
asked for more than one item ahead.

**★ What does `writable.write()` returning `false` mean?**
The internal buffer has passed `highWaterMark`. The write is still accepted, but you should stop
writing until `'drain'`. Ignoring it is how a stream pipeline exhausts memory.

**★ Why prefer `pipeline()` over `.pipe()`?**
It handles backpressure *and* propagates errors, destroying every stream in the chain on failure —
`pipe()` leaves them open.

**★ Your producer cannot be paused. Now what?**
Choose a drop policy explicitly — drop oldest, drop newest, or sample — and make it visible in the
code. An unbounded queue is not "keeping everything"; it is postponing the loss of all of it.

**Does raising `highWaterMark` solve a backpressure problem?**
No. It changes when the signal fires. The rate mismatch is still there.

---

← [21 · Thenables](./21-thenables.md) · [Phase index](./README.md)
