---
title: "pipeline over pipe"
sidebar_label: "10 · pipeline over pipe"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`.pipe()` does not forward errors and does not clean up. One failure mid-chain
leaves every other stream open, leaking file descriptors and sockets — or crashes
the process outright. `stream.pipeline` exists to fix exactly that, and there is
no case where `.pipe()` is the better choice in application code.**

## What `.pipe()` leaves behind

```js
// pipe-leak.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';

const boom = () => new Transform({ transform(c, e, cb) { cb(new Error('transform blew up')); } });

const src = createReadStream('big.log');
const mid = boom();
const dst = createWriteStream('out1.bin');
mid.on('error', (err) => console.log('.pipe()    -> handled:', err.message));
src.pipe(mid).pipe(dst);

setTimeout(() => {
  console.log('.pipe()    -> source destroyed?', src.destroyed, '| dest destroyed?', dst.destroyed, '| dest still open?', !dst.closed);
  process.exit(0);
}, 300);
```

```console
$ node pipe-leak.mjs
.pipe()    -> handled: transform blew up
.pipe()    -> source destroyed? false | dest destroyed? false | dest still open? true
```

The transform failed. **Both the source file handle and the destination file
handle are still open**, and the destination holds a partially written file that
will never be finished. In a request handler that runs a few hundred times a
minute, that is `EMFILE: too many open files` within the hour.

And that was the *good* case, because I attached an error handler. Without one:

```console
$ node -e "const {Readable,Transform}=require('node:stream');
Readable.from(['a']).pipe(new Transform({transform(c,e,cb){cb(new Error('boom'))}}))"
node:events:487
      throw er; // Unhandled 'error' event
      ^
Error: boom
$ echo $?
1
```

**An unhandled stream error is an unhandled `'error'` event, which throws and
kills the process.** `.pipe()` requires an error handler on *every* stream in the
chain — miss one and a single malformed upload takes down the server.

## What `pipeline` does instead

```js
// pipeline-ok.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const boom = () => new Transform({ transform(c, e, cb) { cb(new Error('transform blew up')); } });
const src = createReadStream('big.log');
const dst = createWriteStream('out2.bin');

try {
  await pipeline(src, boom(), dst);
} catch (err) {
  console.log('pipeline() -> caught:', err.message, '| source destroyed?', src.destroyed, '| dest destroyed?', dst.destroyed);
}
```

```console
$ node pipeline-ok.mjs
pipeline() -> caught: transform blew up | source destroyed? true | dest destroyed? true
```

One `try`/`catch`. Every stream destroyed. No leaked descriptors, no unhandled
event, no partially open file.

`pipeline` guarantees three things:

1. **Errors from any stage** surface in one place — the rejected promise.
2. **Every stream is destroyed** when the pipeline ends, successfully or not.
3. **Backpressure is wired** between every pair of stages.

## Always import from `node:stream/promises`

```js
import { pipeline } from 'node:stream/promises';   // ✅ returns a promise
import { pipeline } from 'node:stream';            // callback-style
```

The callback form is the older one and takes a final `(err) => {}` argument. In
async code the promise version is strictly better; mixing them up produces
`ERR_INVALID_ARG_TYPE: The "streams[stream.length - 1]" property must be of type
function` — which is Node telling you it expected a callback where you passed
nothing.

## Stages can be functions

`pipeline` accepts async generators and async functions as stages, which removes
most reasons to write a Transform class:

```js
// stages.mjs
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';

const lines = createInterface({ input: createReadStream('big.log'), crlfDelay: Infinity });

const count = await pipeline(
  Readable.from(lines),
  async function* onlyErrors(source) {              // a filter stage
    for await (const line of source) if (line.includes('ERROR')) yield line;
  },
  async function tally(source) {                    // a sink stage — its return value resolves
    let n = 0;
    for await (const _ of source) n++;
    return n;
  },
);
console.log('ERROR lines:', count);
```

```console
$ node stages.mjs
ERROR lines: 500000
```

**`pipeline` resolves to the return value of the last stage** when that stage is
a plain async function. With a Writable at the end it resolves to `undefined`.

## Cancellation

```js
// abort.mjs
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';

const ac = new AbortController();
setTimeout(() => ac.abort(), 50);

try {
  await pipeline(createReadStream('big.log'), createWriteStream('out.bin'), { signal: ac.signal });
} catch (err) {
  console.log('aborted:', err.name, err.code);
}
```

```console
$ node abort.mjs
aborted: AbortError ABORT_ERR
```

The `signal` option is what makes a streaming endpoint cancellable when the
client disconnects — pass `AbortSignal` from your request context and the whole
chain tears down. That connects directly to
[AbortController](../phase-2-async/19-abortcontroller.md) from Phase 2.

`{ end: false }` is the other option worth knowing: it stops `pipeline` from
calling `end()` on the destination, which you want when writing several sources
into one sink sequentially.

## The one real use for `.pipe()`

Interactive plumbing where you genuinely do not care about errors and the process
is short-lived — a one-off script piping to `process.stdout`. Even there,
`pipeline` costs one extra import.

In a server: never. Every `.pipe()` in a request handler is a latent descriptor
leak.

## Gotchas

**Symptom:** `EMFILE: too many open files` after some hours of traffic
**Cause:** `.pipe()` chains that errored left source and destination handles
open.
**Fix:** `pipeline`, which destroys every stream on any outcome.

**Symptom:** Process exits with `Unhandled 'error' event`
**Cause:** A stream in a `.pipe()` chain had no `'error'` listener.
**Fix:** `pipeline` — one `catch` covers the chain.

**Symptom:** Zero-byte or truncated output files after a failure
**Cause:** The destination was never destroyed, so the partial file remains and
looks complete.
**Fix:** `pipeline`, plus delete the partial file in the `catch`. Better: write
to a temp file and rename on success (Phase 4).

**Symptom:** `ERR_INVALID_ARG_TYPE ... must be of type function`
**Cause:** Imported `pipeline` from `node:stream` (callback form) but awaited it.
**Fix:** Import from `node:stream/promises`.

**Symptom:** `ERR_STREAM_PREMATURE_CLOSE`
**Cause:** A stream in the chain was destroyed before finishing — often the HTTP
response when the client disconnected mid-download.
**Fix:** Expected for client disconnects; catch it and log at debug level rather
than as an error. Use a `signal` so the teardown is deliberate.

**Symptom:** The destination closes when you wanted to keep writing to it
**Cause:** `pipeline` calls `end()` on the last stream.
**Fix:** `{ end: false }`.

**Symptom:** `pipeline` resolves but the file is incomplete
**Cause:** The last stage was a Writable created with `emitClose: false`, or a
custom Writable whose `_final` completed before flushing.
**Fix:** Flush in `_final` and call its callback only when done.

## Interview questions

**★ Why is `.pipe()` considered unsafe?**
It does not forward errors and does not clean up. A failure in any stage leaves
the other streams open — leaking file descriptors and sockets — and an error on a
stream with no `'error'` listener throws as an unhandled event, killing the
process. Verified: after a Transform error, `src.destroyed` and `dst.destroyed`
were both `false`.

**★ What three things does `pipeline` guarantee?**
Errors from any stage arrive in one place; every stream is destroyed on any
outcome; backpressure is wired between all stages.

**★ Which import do you use and why?**
`node:stream/promises`, so it returns a promise and works with `try`/`catch`.
The `node:stream` export is callback-style and awaiting it throws
`ERR_INVALID_ARG_TYPE`.

**★ How do you cancel a pipeline when the client disconnects?**
Pass `{ signal }` with an `AbortSignal`. Aborting destroys every stream in the
chain and rejects with an `AbortError` (`code: 'ABORT_ERR'`).

**What does `pipeline` resolve to?**
`undefined` when the last stage is a Writable; the return value of the last stage
when it is a plain async function — which makes "stream and count/reduce" a
one-liner.

**You see `ERR_STREAM_PREMATURE_CLOSE` in the logs for a download endpoint. Bug?**
Usually not — it is what a client disconnecting mid-download looks like. Catch it
and log at debug level, and make sure the teardown released the underlying
resources.

---

← Prev: [Backpressure](09-backpressure.md) · Next → [Consuming with for await](11-for-await-of.md)
