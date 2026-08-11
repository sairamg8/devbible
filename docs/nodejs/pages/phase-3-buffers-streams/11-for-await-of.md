---
title: "Consuming with for await...of"
sidebar_label: "11 · for await...of"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Every Readable is an async iterable. `for await...of` gives you backpressure,
`try`/`catch` error handling and automatic cleanup, in ordinary loop syntax —
which is why it should be your default way to read a stream.**

## The default shape

```js
// consume.mjs
import { createReadStream } from 'node:fs';

const stream = createReadStream('big.log', { highWaterMark: 64 * 1024 });
let chunks = 0, bytes = 0;
for await (const chunk of stream) {
  chunks++;
  bytes += chunk.length;
}
console.log(chunks, 'chunks,', (bytes / 1024 / 1024).toFixed(1), 'MB');
```

```console
$ node consume.mjs
3464 chunks, 216.4 MB
```

Compare with the event version it replaces:

```js
// the old way — three handlers and a manual promise
await new Promise((resolve, reject) => {
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  stream.on('end', () => resolve(Buffer.concat(chunks)));
  stream.on('error', reject);
});
```

The loop is not just shorter. **The `data` version has no backpressure**: chunks
arrive as fast as the source produces them whatever the loop body does. In the
`for await` version the source is only asked for the next chunk when the previous
iteration finishes.

## Backpressure comes free

```js
// slow-body.mjs
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

const source = Readable.from(['a', 'b', 'c', 'd']);
const t = Date.now();
for await (const chunk of source) {
  await sleep(50);                     // a slow consumer — a DB insert, an API call
  process.stdout.write(chunk);
}
console.log('\ntook', Date.now() - t, 'ms — the source waited for us');
```

```console
$ node slow-body.mjs
abcd
took 203 ms — the source waited for us
```

An `await` in the loop body pauses the source. Written with `.on('data')` and an
async handler, the same code would fire four overlapping inserts immediately and
buffer nothing usefully — the classic "why is my rate limiter not working"
report.

## Errors throw

```js
// errors.mjs
import { createReadStream } from 'node:fs';
try {
  for await (const _ of createReadStream('nope.log')) { /* … */ }
} catch (err) {
  console.log('caught:', err.code);
}
```

```console
$ node errors.mjs
caught: ENOENT
```

One `try`/`catch` covers the source's errors and anything your loop body throws.
No `'error'` listener, no unhandled event, no process crash.

## Breaking out destroys the stream

```js
// break.mjs
import { createReadStream } from 'node:fs';
const s = createReadStream('big.log');
let chunks = 0;
for await (const _ of s) { if (++chunks === 3) break; }
console.log('broke after', chunks, 'chunks; destroyed?', s.destroyed);
```

```console
$ node break.mjs
broke after 3 chunks; destroyed? true
```

`break`, `return` and a thrown error all call the iterator's `return()`, which
destroys the stream and releases the file descriptor. This is the behaviour you
want — and the thing to know when it *isn't*:

**A destroyed stream cannot be resumed.** If you break out to inspect something
and then want the rest, you must not break — filter inside the loop, or open the
stream again.

## Collecting, when the data is bounded

```js
// collect.mjs
import { Readable } from 'node:stream';
import { text, json, buffer } from 'node:stream/consumers';

const parts = [];
for await (const chunk of Readable.from([Buffer.from('{"a":'), Buffer.from('1}')])) parts.push(chunk);
console.log('manual   :', JSON.parse(Buffer.concat(parts).toString()));

console.log('consumers:', await json(Readable.from(['{"a":', '1}'])));
```

```console
$ node collect.mjs
manual   : { a: 1 }
consumers: { a: 1 }
```

`stream/consumers` (`text`, `json`, `buffer`, `arrayBuffer`, `blob`) is the short
form for "this is small, give me the whole thing". Use it for request bodies you
have already size-limited. It has **no size limit of its own**, so never point it
at unbounded input.

## Reading lines, not chunks

Chunks split lines. For line-oriented data use `readline`, which is itself async
iterable:

```js
// lines.mjs
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('big.log'), crlfDelay: Infinity });
let errors = 0;
for await (const line of rl) if (line.includes('ERROR')) errors++;
console.log('ERROR lines:', errors);
```

```console
$ node lines.mjs
ERROR lines: 500000
```

`crlfDelay: Infinity` makes `\r\n` count as one break — without it, Windows files
give you a stray `\r` on every line.

## Streams have iterator helpers too

Since v17 Readables carry `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`,
`toArray`, `some`, `every`, `find` and `forEach`. They are still marked
**Stability 1 – Experimental** in the Node 24 docs.

```js
// helpers.mjs
import { Readable } from 'node:stream';

const total = await Readable.from([1, 2, 3, 4, 5])
  .filter((n) => n % 2 === 1)
  .map((n) => n * 10)
  .reduce((a, b) => a + b, 0);
console.log('total:', total);

const firstTwo = await Readable.from(['a', 'b', 'c']).take(2).toArray();
console.log('take(2):', firstTwo);
```

```console
$ node helpers.mjs
total: 90
take(2): [ 'a', 'b' ]
```

`map` and `filter` accept a `{ concurrency }` option, which makes them a neat
bounded-parallelism primitive over a stream. Being experimental, they can change
in a minor release — fine in application code you control, risky in a published
library.

## When not to use `for await`

- **Piping straight to another stream** — `pipeline` is fewer moving parts and
  handles the destination's lifecycle.
- **You need per-event control** (`'close'` vs `'end'`, `'drain'` timing) — use
  events.
- **Two consumers** — an async iterator is a single consumer. Tee with
  `PassThrough` first.

## Gotchas

**Symptom:** Only part of the stream is processed
**Cause:** `break`/`return` destroyed it, or a second consumer took chunks.
**Fix:** One consumer; filter inside the loop instead of breaking if you need the
rest.

**Symptom:** `ERR_STREAM_PREMATURE_CLOSE` after breaking out early
**Cause:** Something else was waiting on the stream finishing normally.
**Fix:** Expected — treat early exit as a deliberate destroy and catch it.

**Symptom:** No backpressure despite using async code
**Cause:** `.on('data', async () => …)` — the handler's promise is ignored, so
the source never pauses.
**Fix:** `for await`, where the loop body is awaited.

**Symptom:** Memory grows while "streaming"
**Cause:** Pushing every chunk into an array inside the loop. That is buffering
with extra steps.
**Fix:** Process incrementally, or accept that you are buffering and enforce a
limit.

**Symptom:** Lines contain a trailing `\r`
**Cause:** CRLF input without `crlfDelay: Infinity`.
**Fix:** Set it, or `line.trimEnd()`.

**Symptom:** `TypeError: stream is not async iterable`
**Cause:** It is a Writable, or a web `ReadableStream` on a Node version before
16.5 (fine on 24).
**Fix:** Check the direction; use `Readable.fromWeb` for older interop.

**Symptom:** An error thrown inside the loop leaves the file descriptor open
**Cause:** It does not — the iterator's `return()` destroys the stream. If you
see a leak, the handle came from somewhere else, such as a `fs.open` you never
closed.
**Fix:** Look for the manual `open`/`close` pair.

## Interview questions

**★ Why is `for await...of` preferred over `.on('data')`?**
It provides backpressure automatically — the next chunk is only requested when
the loop body finishes — errors surface through `try`/`catch` instead of an
`'error'` event that can crash the process, and leaving the loop destroys the
stream and releases its resources.

**★ What happens when you `break` out of the loop?**
The iterator's `return()` runs, which destroys the stream and closes the
underlying handle. The stream cannot be resumed afterwards.

**★ Someone writes `stream.on('data', async (chunk) => await save(chunk))` and
sees thousands of concurrent inserts. Why?**
`.on()` ignores the returned promise, so the stream keeps emitting at full speed
while every handler runs concurrently. `for await` awaits each iteration, which
pauses the source.

**★ How do you read a file line by line?**
`readline.createInterface({ input: createReadStream(path), crlfDelay: Infinity })`
and `for await` over it. Chunk boundaries do not align with lines, so consuming
chunks directly means reassembling them yourself.

**Can two consumers iterate the same stream?**
No — chunks go to whoever asks first. To fan out, pipe into two `PassThrough`
streams (or `tee()` a web stream).

**What is `stream/consumers` for, and what is its risk?**
`text`, `json`, `buffer` collect an entire stream in one call. Convenient for
already-limited request bodies; dangerous on unbounded input because they impose
no size cap.

---

← Prev: [pipeline over pipe](10-pipeline.md) · Next → [Stream events, flowing and paused](12-stream-events-and-modes.md)
