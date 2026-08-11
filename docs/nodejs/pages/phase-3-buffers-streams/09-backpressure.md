---
title: "Backpressure"
sidebar_label: "09 · Backpressure"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`write()` returns `false` to tell you the destination is full. Ignoring it does
not slow anything down — it moves the data into an unbounded in-memory queue, and
your "constant memory" stream becomes a buffer with extra steps.**

This is the concept that separates people who use streams from people who
understand them.

## The mechanism

A Writable has a `highWaterMark` — 64 KB by default for byte streams. Write into
it and one of two things happens:

- **queued bytes below the mark** → `write()` returns `true`: keep going.
- **queued bytes at or above it** → `write()` returns `false`: stop, wait for
  `'drain'`.

`false` does **not** mean the write failed. The chunk was accepted and queued.
It means *"the queue is now over budget; anything more is on you."*

## The measurement

```js
// bp-ignore.mjs
import { createWriteStream } from 'node:fs';
const out = createWriteStream('out.bin');
let peakQueued = 0, peakRss = 0;
for (let i = 0; i < 4000; i++) {
  out.write(Buffer.alloc(64 * 1024, 0x61));            // return value ignored
  peakQueued = Math.max(peakQueued, out.writableLength);
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
}
out.end(() => console.log(`ignored   : peak queued ${(peakQueued / 1024 / 1024).toFixed(0)} MB, peak RSS ${(peakRss / 1024 / 1024).toFixed(0)} MB`));
```

```js
// bp-respect.mjs
import { createWriteStream } from 'node:fs';
const out = createWriteStream('out.bin');
let peakQueued = 0, peakRss = 0, drains = 0;
for (let i = 0; i < 4000; i++) {
  if (!out.write(Buffer.alloc(64 * 1024, 0x61))) {      // false = "stop, I am full"
    drains++;
    await new Promise((r) => out.once('drain', r));
  }
  peakQueued = Math.max(peakQueued, out.writableLength);
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
}
await new Promise((r) => out.end(r));
console.log(`respected : ${drains} drain waits, peak queued ${(peakQueued / 1024).toFixed(0)} KB, peak RSS ${(peakRss / 1024 / 1024).toFixed(0)} MB`);
```

```console
$ node bp-ignore.mjs
ignored   : peak queued 250 MB, peak RSS 309 MB
$ node bp-respect.mjs
respected : 4000 drain waits, peak queued 0 KB, peak RSS 82 MB
```

250 MB sitting in the stream's internal queue, 309 MB RSS — for a loop that
"streams" data to disk. The disk never went faster; the queue simply absorbed
everything the loop produced. Respecting the return value: 82 MB, flat.

**`writableLength` is the number to watch.** It is the queued byte count, and it
is the thing that grows without bound when backpressure is ignored.

## The write-loop pattern

Whenever you generate data yourself — rather than piping from another stream —
this is the shape:

```js
// generate.mjs
async function writeAll(sink, iterable) {
  for await (const chunk of iterable) {
    if (!sink.write(chunk)) {
      await new Promise((resolve) => sink.once('drain', resolve));
    }
  }
  await new Promise((resolve, reject) => sink.end((err) => (err ? reject(err) : resolve())));
}
```

Two details people get wrong:

- **`once`, not `on`.** A persistent `'drain'` listener added inside a loop leaks
  one listener per iteration and triggers the
  `MaxListenersExceededWarning` at 11.
- **Await `end()`.** `end()` is asynchronous; the file is not on disk when it
  returns.

Better still: don't write the loop. `pipeline` handles backpressure for you and
handles the errors too ([page 10](10-pipeline.md)).

## Backpressure propagates through a pipeline

```js
// propagate.mjs
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

await pipeline(
  createReadStream('big.log'),   // reads only when gzip asks
  createGzip(),                  // compresses only when the disk asks
  createWriteStream('big.log.gz'),
);
```

The write stream fills → gzip's writes return `false` → gzip stops pulling → the
read stream stops reading from disk. **The slowest stage sets the pace for the
whole chain, and nothing accumulates.** That is the entire value of a pipeline,
and it is why `.pipe()` and `pipeline()` are preferred over manual loops.

`for await...of` gets the same property for free: the loop body only asks for the
next chunk when it is ready, so an `await` inside the loop pauses the source.

## Where ignoring it actually happens

Nobody writes `bp-ignore.mjs` on purpose. They write these:

```js
// ❌ 1. Piping into a slow sink from a fast source, by hand
source.on('data', (chunk) => {
  slowDestination.write(chunk);          // return value dropped
});

// ❌ 2. Fan-out to N destinations
source.on('data', (chunk) => {
  for (const client of subscribers) client.write(chunk);   // one slow client, unbounded queue
});

// ❌ 3. A websocket/SSE broadcast loop
for (const ws of clients) ws.send(payload);                // ws has bufferedAmount for exactly this

// ❌ 4. Writing DB rows to a response without awaiting
for (const row of rows) res.write(JSON.stringify(row) + '\n');
```

Case 2 is the production incident: **one slow consumer makes the server buffer
the whole stream for everyone.** A client on a mobile connection reading a live
feed at 10 KB/s while the source produces 10 MB/s grows a queue at 10 MB/s until
the process dies. The fix is to check `write()`'s return value per client and
drop, throttle, or disconnect the ones that fall behind — `res.writableLength >
someLimit` is a legitimate disconnect condition.

## Reading side: pause and resume

The mirror-image control exists on Readables.

```js
source.pause();      // stop emitting 'data'
source.resume();     // start again
source.isPaused();   // where am I
```

You need these only in event-based code. `for await` and `pipeline` pause and
resume for you, correctly, which is the argument for using them.

## Gotchas

**Symptom:** RSS grows steadily during a "streaming" job
**Cause:** `write()`'s return value ignored; data queues in `writableLength`.
**Fix:** Await `'drain'`, or use `pipeline`.

**Symptom:** `MaxListenersExceededWarning: 11 drain listeners added`
**Cause:** `sink.on('drain', ...)` inside a loop.
**Fix:** `once`, and only when `write()` returned `false`.

**Symptom:** One slow client degrades the whole server
**Cause:** Fan-out writes without per-destination backpressure.
**Fix:** Check the return value per client; drop or disconnect laggards past a
queue threshold.

**Symptom:** File is truncated even though every write "succeeded"
**Cause:** Process exited before the queue flushed; `end()`'s callback was never
awaited.
**Fix:** Await `end()` or `finished(stream)`.

**Symptom:** Backpressure "does not work" — the loop never sees `false`
**Cause:** A synchronous `for` loop with no `await` never yields to the event
loop, so the sink never drains and `writableLength` only grows.
**Fix:** Await the drain, which yields.

**Symptom:** Memory fine on localhost, terrible in production
**Cause:** On localhost the sink (loopback socket, SSD) is faster than the
source, so the queue never builds.
**Fix:** Test against a throttled sink, or just respect the protocol.

## Interview questions

**★ What does `write()` returning `false` mean?**
That the destination's internal queue has reached its high water mark. The chunk
was still accepted — nothing failed — but you should stop writing until `'drain'`
fires. Ignoring it moves data into an unbounded in-memory queue.

**★ What actually happens if you ignore it?**
Nothing slows down; memory grows. Measured: 4 000 × 64 KB writes to a file
peaked at 250 MB queued and 309 MB RSS when ignored, versus 0 KB queued and
82 MB RSS when respected. Same data, same duration.

**★ How does backpressure propagate through a three-stage pipeline?**
The final sink fills and returns `false` to the stage before it, which stops
pulling from its own source, which stops reading. The slowest stage sets the rate
for the chain, so no stage accumulates. `pipeline` and `for await` do this
automatically.

**★ Why is fan-out to many clients the dangerous case?**
Each destination has its own queue. One slow client's queue grows at the full
production rate while everyone else is fine, so a single mobile connection can
OOM the server. You need a per-client check and a policy — throttle, drop, or
disconnect.

**What is `writableLength` and when do you look at it?**
The number of bytes (or objects, in object mode) currently queued in a Writable.
It is the direct measure of backpressure — use it for metrics and as the
threshold for disconnecting a slow consumer.

**Why `once('drain')` rather than `on('drain')`?**
`on` inside a loop adds a listener per iteration, leaking memory and tripping the
max-listeners warning at 11. You want exactly one wake-up per stall.

---

← Prev: [The four stream types](08-stream-types.md) · Next → [pipeline over pipe](10-pipeline.md)
