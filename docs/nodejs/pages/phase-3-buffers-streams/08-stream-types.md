---
title: "The four stream types"
sidebar_label: "08 · The four types"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Readable, Writable, Duplex, Transform. Everything in Node I/O is one of these
four, and knowing which one you are holding tells you what you are allowed to
do with it.**

| Type | Direction | You call | Examples |
|---|---|---|---|
| **Readable** | out of a source | `.read()`, `for await`, `.pipe(dest)` | `fs.createReadStream`, `req` on a server, `process.stdin`, `res.body` from fetch |
| **Writable** | into a sink | `.write()`, `.end()` | `fs.createWriteStream`, `res` on a server, `process.stdout` |
| **Duplex** | both, independent | both | `net.Socket`, `tls.TLSSocket`, `WebSocket` streams |
| **Transform** | both, connected | both, via `.pipe()` | `zlib.createGzip()`, `crypto.createCipheriv()`, your own |

```js
// which.mjs
import { Readable, Writable, Duplex, Transform } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

const check = (name, s) => console.log(
  name.padEnd(14),
  'Readable:', String(s instanceof Readable).padEnd(5),
  'Writable:', String(s instanceof Writable).padEnd(5),
  'Duplex:', String(s instanceof Duplex).padEnd(5),
  'Transform:', s instanceof Transform,
);

check('read stream', createReadStream('big.log'));
check('write stream', createWriteStream('/dev/null'));
check('gzip', createGzip());
check('stdout', process.stdout);
```

```console
$ node which.mjs
read stream    Readable: true  Writable: false Duplex: false Transform: false
write stream   Readable: false Writable: true  Duplex: false Transform: false
gzip           Readable: true  Writable: true  Duplex: true  Transform: true
stdout         Readable: false Writable: true  Duplex: false Transform: false
```

Note **Transform is a Duplex is a Readable**. `gzip instanceof Readable` is true,
which is why a Transform can sit anywhere in a pipeline.

## Readable — a source

Three ways to consume one. Pick one; mixing them loses data.

```js
// readable.mjs
import { Readable } from 'node:stream';
const make = () => Readable.from(['alpha ', 'beta ', 'gamma']);

// 1. for await — the default choice
let out = '';
for await (const chunk of make()) out += chunk;
console.log('for await :', out);

// 2. pipe / pipeline — when the destination is another stream
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
const sink = new Writable({ write(c, e, cb) { process.stdout.write('pipe      : ' + c + '\n'); cb(); } });
await pipeline(Readable.from(['one chunk']), sink);

// 3. events — only when you need per-event control
await new Promise((resolve) => {
  const parts = [];
  const s = make();
  s.on('data', (c) => parts.push(c));
  s.on('end', () => { console.log('events    :', parts.join('')); resolve(); });
});
```

```console
$ node readable.mjs
for await : alpha beta gamma
pipe      : one chunk
events    : alpha beta gamma
```

A Readable is a **pull** source in the paused mode `for await` uses: nothing is
read from the OS until you ask. That is where backpressure comes from for free
([page 09](09-backpressure.md)).

## Writable — a sink

```js
// writable.mjs
import { Writable } from 'node:stream';

const collected = [];
const sink = new Writable({
  write(chunk, encoding, callback) {          // one chunk at a time
    collected.push(chunk.toString());
    callback();                                // ← MUST be called, or the stream stalls forever
  },
  final(callback) {                            // after .end(), before 'finish'
    console.log('final: flushing', collected.length, 'chunks');
    callback();
  },
});

sink.write('a');
sink.write('b');
sink.end('c');
sink.on('finish', () => console.log('finish:', collected.join('')));
```

```console
$ node writable.mjs
final: flushing 3 chunks
finish: abc
```

**The `callback()` in `_write` is the contract.** It means "I am done with this
chunk, send the next". Forget it — or forget it on one error branch — and the
stream hangs with no error, forever. That is the single most common custom-stream
bug.

`end()` is not optional either: without it `final` never runs, `finish` never
fires, and an `fs` write stream never flushes its last chunk.

## Duplex — two independent channels

A `net.Socket` is the canonical one: what you write goes to the peer, what you
read came from the peer. The two sides are **unrelated** — the readable half can
end while the writable half stays open (a half-open TCP connection).

```js
// duplex.mjs
import { createServer, connect } from 'node:net';

const server = createServer((socket) => {
  socket.on('data', (d) => socket.write(`echo:${d}`));   // read side and write side
});
await new Promise((r) => server.listen(0, r));

const client = connect(server.address().port);
client.write('ping');
client.on('data', (d) => {
  console.log('client got:', d.toString());
  console.log('readable ended?', client.readableEnded, '| writable ended?', client.writableEnded);
  client.end();
  server.close();
});
```

```console
$ node duplex.mjs
client got: echo:ping
readable ended? false | writable ended? false
```

Because the halves are independent, `stream.finished(socket)` waits for **both**,
and closing one does not close the other. `socket.end()` sends FIN on the write
side; you may still receive data afterwards.

## Transform — a Duplex where output derives from input

```js
// transform.mjs
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const upper = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());   // (error, transformedChunk)
  },
});

let out = '';
await pipeline(Readable.from(['hello ', 'world']), upper, async function* (s) { for await (const c of s) out += c; });
console.log(out);
```

```console
$ node transform.mjs
HELLO WORLD
```

Transforms are the composable middle of every pipeline: gzip, cipher, CSV
formatter, redactor, line splitter. [Page 13](./transform-streams/) covers
writing them properly.

**`PassThrough`** is a Transform that changes nothing. It is useful for tapping a
pipeline (tee to a hash while streaming to disk) or for handing out a stream
before you know its source.

## Choosing what to implement

You will implement a custom stream far less often than you think.

| Need | Do |
|---|---|
| Turn an array/iterable into a stream | `Readable.from(iterable)` |
| Turn an async generator into a pipeline stage | pass the generator to `pipeline` directly |
| Transform chunk-by-chunk | `new Transform({ transform })` |
| A source that pages an API or DB cursor | `Readable.from(asyncGenerator())` first; a custom `Readable` only if you need `_read` pull control |
| A sink that batches into a DB | custom `Writable` with `_write`/`_writev`/`_final` |

`Readable.from(asyncGenerator)` replaces most custom Readables and is much harder
to get wrong — see [page 17](17-custom-readable-writable.md) for when it is not
enough.

## Gotchas

**Symptom:** A pipeline stalls with no error and no CPU use
**Cause:** `_write` (or `_transform`) never called its `callback`, usually on an
error or early-return branch.
**Fix:** Call the callback exactly once on every path; pass the error as its
first argument instead of throwing.

**Symptom:** The last part of a file is missing
**Cause:** `end()` was never called on the Writable, so `_final` never flushed.
**Fix:** Call `end()`, or use `pipeline`, which does it for you.

**Symptom:** `TypeError: dest.on is not a function`
**Cause:** Piping into something that is not a Writable — often an async function
or a plain object.
**Fix:** Check with `instanceof Writable`; wrap generators with `Readable.from`.

**Symptom:** Data goes missing when both `.on('data')` and `for await` are used
**Cause:** Two consumers of one Readable; the first to attach starts the flow and
takes the chunks.
**Fix:** One consumer per stream. To fan out, use `PassThrough` or `.tee()` on a
web stream.

**Symptom:** A socket closes unexpectedly after `end()`
**Cause:** Assumed a Duplex's halves are linked. `end()` closes only the write
side; the read side stays open until the peer closes it.
**Fix:** Use `stream.finished(socket)` to wait for both, and `destroy()` when you
really mean "tear it all down".

**Symptom:** `callback()` called twice, `ERR_MULTIPLE_CALLBACK`
**Cause:** A callback invoked in both a success and an error path.
**Fix:** `return callback(err)` on error branches.

## Interview questions

**★ Name the four stream types and one real example of each.**
Readable (`fs.createReadStream`, an HTTP `req`), Writable (`res`,
`createWriteStream`), Duplex (`net.Socket` — independent read and write halves),
Transform (`zlib.createGzip()` — output derived from input). Transform extends
Duplex, which extends Readable and implements Writable.

**★ What is the difference between a Duplex and a Transform?**
Both are readable and writable. In a Duplex the two halves are unrelated — a TCP
socket sends and receives different data. In a Transform the readable side *is*
the writable side after processing.

**★ What happens if `_write` never calls its callback?**
The stream waits forever. No error, no timeout, no CPU — writes queue until
memory is exhausted. It is the most common custom-stream bug, and it usually hides
on an error branch.

**★ Why can't you attach both `.on('data')` and `for await` to one stream?**
Both are consumers. `.on('data')` switches the stream to flowing mode and starts
emitting immediately; whichever attaches first takes the chunks, and the other
sees a partial stream or nothing.

**How do you turn an async generator into a stream?**
`Readable.from(generator())`, or pass the generator function straight to
`pipeline` as a stage. Both avoid hand-writing `_read`.

**What is `PassThrough` for?**
A Transform that forwards unchanged — used to tap a pipeline (hash while writing
to disk), to expose a stream before its source exists, or as a placeholder in
tests.

---

← Prev: [Why streams exist](07-why-streams.md) · Next → [Backpressure](09-backpressure.md)
