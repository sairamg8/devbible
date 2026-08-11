---
title: "High water marks and buffer tuning"
sidebar_label: "19 · High water marks"
sidebar_position: 19
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**The high water mark is how much a stream buffers before applying backpressure.
The default is right almost always. Learn this page when a profiler says syscall
overhead or buffer memory is your bottleneck — not before.**

## The defaults

```js
// defaults.mjs
import { Readable, Writable, getDefaultHighWaterMark } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';

console.log('binary default    :', getDefaultHighWaterMark(false), 'bytes');
console.log('objectMode default:', getDefaultHighWaterMark(true), 'items');
console.log('fs read           :', createReadStream('big.log').readableHighWaterMark);
console.log('fs write          :', createWriteStream('/dev/null').writableHighWaterMark);
console.log('generic Readable  :', new Readable({ read() {} }).readableHighWaterMark);
console.log('objectMode Readable:', new Readable({ objectMode: true, read() {} }).readableHighWaterMark);
console.log('Readable.from     :', Readable.from([1]).readableHighWaterMark);
```

```console
$ node defaults.mjs
binary default    : 65536 bytes
objectMode default: 16 items
fs read           : 65536
fs write          : 65536
generic Readable  : 65536
objectMode Readable: 16
Readable.from     : 1
```

**64 KB, not 16 KB.** The byte default was raised from 16 KiB to 64 KiB in Node
22, so every article written before 2024 has the wrong number.

`Readable.from` uses 1 deliberately: a generator wrapping an API call should not
prefetch pages nobody asked for.

## What changing it actually does

```js
// hwm.mjs
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

for (const hwm of [4 * 1024, 16 * 1024, 64 * 1024, 256 * 1024, 1024 * 1024]) {
  const t = Date.now();
  let chunks = 0;
  await pipeline(createReadStream('big.log', { highWaterMark: hwm }), async function* (s) {
    for await (const c of s) chunks++;
  });
  console.log(`hwm ${String(hwm / 1024).padStart(5)} KB -> ${String(chunks).padStart(6)} chunks, ${Date.now() - t} ms`);
}
```

```console
$ node hwm.mjs
hwm     4 KB ->  55412 chunks, 1424 ms
hwm    16 KB ->  13853 chunks, 387 ms
hwm    64 KB ->   3464 chunks, 146 ms
hwm   256 KB ->    866 chunks, 119 ms
hwm  1024 KB ->    217 chunks, 121 ms
```

Read the shape, not the numbers: **4 KB is 10× slower than 64 KB, and 1 MB is no
faster than 256 KB.** Each chunk costs a `read()` syscall plus an event loop
turn, so tiny chunks are dominated by overhead; past a point the syscall cost
disappears and you are only adding memory.

The default sits right where the curve flattens. That is not an accident.

## When raising it helps

- **Sequential reads of large files** on fast storage, where you measured
  syscall overhead. 256 KB is a reasonable ceiling; beyond that you pay memory
  for nothing.
- **A high-latency source** where each read has fixed cost — a network filesystem
  or an object store.

## When lowering it helps

- **Object mode with large items.** 16 documents of 10 MB is 160 MB buffered.
  Lower it to 2–4 when items are heavy.
- **Many concurrent streams.** 1 000 sockets × 64 KB is 64 MB of buffers before
  any of your own code holds anything. A server proxying thousands of connections
  can lower it deliberately.
- **Latency-sensitive streaming** — SSE, live logs, a chat feed. A large mark
  means the consumer waits for the buffer to fill before seeing anything.

```js
// tuning by case
createReadStream(bigFile, { highWaterMark: 256 * 1024 });      // sequential bulk read
new Writable({ objectMode: true, highWaterMark: 2 });           // heavy objects
new Readable({ highWaterMark: 4 * 1024, read() {} });           // many concurrent, small
```

## Memory maths worth doing once

Peak buffered memory for one pipeline is roughly the sum of every stage's high
water mark, plus whatever your own code retains:

```
readStream(64 KB) → gzip(64 KB in + 64 KB out) → writeStream(64 KB)  ≈ 256 KB
```

A quarter of a megabyte per pipeline. At 1 000 concurrent requests that is
256 MB — which is the number that matters, and the reason "just raise the high
water mark" is a bad instinct on a server. **Tune per-stream marks down on
high-concurrency paths and up on single-job batch paths.**

## Measuring instead of guessing

```js
// observe.mjs — the two numbers to log
setInterval(() => {
  console.log('queued bytes:', stream.writableLength, '/', stream.writableHighWaterMark);
  console.log('needDrain   :', stream.writableNeedDrain);
}, 1000);
```

`writableLength` sitting at the high water mark means the sink is the bottleneck
— raising the mark just hides it behind more memory. `writableLength` at zero
with high CPU means the source is the bottleneck, and a bigger read size may
help.

`stream.readableLength`, `readableFlowing` and `writableNeedDrain` are the other
three worth exporting as metrics on a streaming service.

## The trade-off, stated plainly

| Higher mark | Lower mark |
|---|---|
| Fewer syscalls, better throughput | Less memory per stream |
| More memory per stream | More syscalls, more event loop turns |
| Higher latency to first chunk | Lower latency, smoother backpressure |
| Good for one big job | Good for many concurrent streams |

## Gotchas

**Symptom:** Throughput collapses on a file copy
**Cause:** A tiny `highWaterMark` (4 KB) — 10× more syscalls and event loop
turns.
**Fix:** Leave it at the default, or raise to 256 KB for bulk sequential work.

**Symptom:** Raising the high water mark did not help
**Cause:** The bottleneck is the sink or the CPU, not read size. Past ~256 KB the
curve is flat.
**Fix:** Measure `writableLength` to find the real constraint.

**Symptom:** Memory scales with connection count
**Cause:** Per-stream buffers — every socket owns its own high water mark.
**Fix:** Lower it on high-concurrency paths; count stages × mark × connections.

**Symptom:** Object-mode stream OOMs with a small high water mark
**Cause:** It counts items, not bytes.
**Fix:** Lower it further, or cap item size upstream.

**Symptom:** An SSE/live feed is laggy in bursts
**Cause:** The consumer only sees data once the buffer fills.
**Fix:** Lower the mark, and flush explicitly on the response.

**Symptom:** `highWaterMark: 0` behaves strangely
**Cause:** Zero means "always over the mark", so `write()` always returns
`false`. It is legal and occasionally useful for strict lockstep, but it is not
"unlimited".
**Fix:** Use a small positive number unless lockstep is the goal.

## Interview questions

**★ What is the high water mark and what is the default?**
The amount a stream buffers internally before `write()` returns `false` (or a
Readable stops pulling). Defaults on Node 24: **65 536 bytes** for byte streams
and **16 items** in object mode — the byte default was raised from 16 KiB in Node
22.

**★ Would raising it make a slow pipeline faster?**
Only if the bottleneck is per-chunk overhead. Measured on a 216 MB file: 4 KB
took 1424 ms, 64 KB took 146 ms, and 1 MB took 121 ms — flat past 256 KB. If the
sink is the constraint, a larger mark just buffers more.

**★ Why lower it?**
Memory. Every stream owns its buffer, so 1 000 concurrent connections × 64 KB ×
number of stages is real memory. In object mode the mark counts items, so heavy
objects need a much smaller number.

**★ How do you tell whether the source or the sink is the bottleneck?**
Watch `writableLength` against `writableHighWaterMark`. Pinned at the mark means
the sink cannot keep up; near zero with high CPU means the source or the
transform is the limit.

**What does `highWaterMark: 0` do?**
Makes every `write()` return `false`, forcing strict lockstep with `'drain'`. It
means "buffer nothing", not "buffer everything".

---

← Prev: [stream/promises and compose](18-stream-promises-and-compose.md) · Phase index → [Buffers and streams](README.md)
