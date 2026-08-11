---
title: "Web Streams"
sidebar_label: "15 · Web Streams"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`ReadableStream`, `WritableStream` and `TransformStream` are the WHATWG
standard, available as globals in Node since v18. You meet them whether you want
to or not, because `fetch` bodies are web streams — and you convert at the
boundary with `Readable.toWeb` / `Readable.fromWeb`.**

## The three types, and how they differ from Node's

```js
// basics.mjs
const rs = new ReadableStream({
  start(controller) {
    controller.enqueue('alpha ');
    controller.enqueue('beta');
    controller.close();
  },
});

let out = '';
for await (const chunk of rs) out += chunk;      // async-iterable in Node
console.log('for await:', JSON.stringify(out));

const upper = new TransformStream({ transform(c, ctrl) { ctrl.enqueue(String(c).toUpperCase()); } });
const rs2 = new ReadableStream({ start(c) { c.enqueue('hello '); c.enqueue('world'); c.close(); } });
let out2 = '';
for await (const c of rs2.pipeThrough(upper)) out2 += c;
console.log('pipeThrough:', JSON.stringify(out2));
```

```console
$ node basics.mjs
for await: "alpha beta"
pipeThrough: "HELLO WORLD"
```

| Node stream | Web stream | Note |
|---|---|---|
| `Readable` | `ReadableStream` | Web version has no `'data'` event; you pull |
| `Writable` | `WritableStream` | Write through a *writer*, not directly |
| `Transform` | `TransformStream` | `readable` and `writable` are separate properties |
| `.pipe()` / `pipeline` | `.pipeTo()` / `.pipeThrough()` | `pipeTo` returns a promise and does clean up |
| `objectMode` | any value is allowed by default | no mode switch needed |
| `highWaterMark` in bytes | `CountQueuingStrategy` / `ByteLengthQueuingStrategy` | explicit strategy object |

**`async iteration over a `ReadableStream` is a Node extension.** It is not in
the WHATWG spec and does not work in every browser, so code meant to run in both
places uses a reader loop:

```js
const reader = stream.getReader();
try {
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // … use value
  }
} finally {
  reader.releaseLock();
}
```

## Where you meet them in Node

```js
// fetch-body.mjs
console.log('Response.body is a', Object.getPrototypeOf(new Response('x').body).constructor.name);

const res = await fetch('https://nodejs.org/dist/index.json');
let bytes = 0;
for await (const chunk of res.body) bytes += chunk.length;   // Uint8Array chunks
console.log('streamed', bytes, 'bytes without buffering the whole body');
```

```console
$ node fetch-body.mjs
Response.body is a ReadableStream
streamed 328491 bytes without buffering the whole body
```

The list of places web streams show up in a Node backend:

- **`fetch`** — `res.body` (Readable) and the `body` you pass to a request.
- **`Response` / `Request`** from undici, including streaming uploads.
- **`Blob.stream()`** and `File.stream()`.
- **`crypto.subtle`** adjacent APIs, and `CompressionStream` /
  `DecompressionStream` (gzip and deflate, standard, available in Node 24).
- **Edge/serverless runtimes** (Cloudflare Workers, Deno, Vercel Edge) where web
  streams are the *only* stream type — the portability argument.

## Converting at the boundary

```js
// interop.mjs
import { Readable, Writable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { text } from 'node:stream/consumers';

// Node -> Web
const web = Readable.toWeb(createReadStream('big.log', { end: 60 }));
console.log('toWeb gives a', web.constructor.name, '| chunks are', (await web.getReader().read()).value.constructor.name);

// Web -> Node
const back = Readable.fromWeb(new ReadableStream({
  start(c) { c.enqueue(new TextEncoder().encode('from web')); c.close(); },
}));
console.log('fromWeb ->', await text(back));

// Writable both ways
const chunks = [];
const webWritable = Writable.toWeb(new Writable({ write(c, e, cb) { chunks.push(c.toString()); cb(); } }));
const writer = webWritable.getWriter();
await writer.write(new TextEncoder().encode('via web writer'));
await writer.close();
console.log('Writable.toWeb ->', chunks);
```

```console
$ node interop.mjs
toWeb gives a ReadableStream | chunks are Uint8Array
fromWeb -> from web
Writable.toWeb -> [ 'via web writer' ]
```

Four functions, all on the Node classes: `Readable.toWeb`, `Readable.fromWeb`,
`Writable.toWeb`, `Writable.fromWeb` (plus `Duplex.toWeb`/`fromWeb`). Note the
chunk type changes: **Node streams give Buffers, web streams give
`Uint8Array`.** A Buffer *is* a Uint8Array ([page 04](04-buffer-as-uint8array.md)),
so Node→Web is transparent, but Web→Node gives you plain Uint8Arrays with no
`.toString('utf8')` — wrap with `Buffer.from(chunk)` if you want Buffer methods.

**The trade-off with conversion:** each `toWeb`/`fromWeb` adds a wrapper layer
and its own queue. Convert once at the boundary, not repeatedly inside a
pipeline.

## Streaming a fetch response to disk

The everyday task that requires the conversion:

```js
// download.mjs
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const res = await fetch('https://nodejs.org/dist/index.json');
if (!res.ok) throw new Error(`HTTP ${res.status}`);

await pipeline(Readable.fromWeb(res.body), createWriteStream('index.json'));
console.log('saved');
```

```console
$ node download.mjs
saved
```

`await res.json()` would buffer the whole body; this holds one chunk at a time.
For a large download that is the difference between constant memory and the
file's size in RAM.

## Locking and tee

```js
// locking.mjs
const rs = new ReadableStream({ start(c) { c.close(); } });
rs.getReader();
try { rs.getReader(); } catch (err) { console.log('second getReader ->', err.constructor.name + ':', err.message); }

const rs2 = new ReadableStream({ start(c) { c.enqueue('x'); c.close(); } });
const [a, b] = rs2.tee();
console.log('tee ->', (await a.getReader().read()).value, (await b.getReader().read()).value);
```

```console
$ node locking.mjs
second getReader -> TypeError: Invalid state: ReadableStream is locked
tee -> x x
```

**A web stream can have exactly one reader at a time**, and taking one *locks*
the stream — `for await`, `pipeTo` and `getReader` all lock. This is stricter
than Node streams and it is why "body already consumed" errors are common with
`fetch`: `res.json()` locks and drains the body, so a later `res.text()` fails.
`res.clone()` or `tee()` is the fix, at the cost of buffering whatever the slower
branch has not read yet.

## Which to use in your own code

**Default to Node streams in a Node backend.** They have `pipeline`, better
ergonomics, object mode, and every Node API speaks them.

Use web streams when:
- the code must also run on an edge runtime or in the browser;
- you are handling a `fetch`/`Response` body and never leave that world;
- you want `CompressionStream`, which is the standard API.

Convert once, at the edge, and stay in one world inside your own pipeline.

## Gotchas

**Symptom:** `TypeError: Invalid state: ReadableStream is locked`
**Cause:** Something already took a reader — `for await`, `pipeTo`, or an earlier
`getReader`.
**Fix:** One consumer, or `tee()` first. Release with `reader.releaseLock()`.

**Symptom:** `TypeError: Body is unusable: Body has already been read`
**Cause:** A `Response` body was consumed twice (`res.json()` then `res.text()`).
**Fix:** Read once, or `res.clone()` before the first read.

**Symptom:** `chunk.toString('utf8')` returns `[object Uint8Array]`-ish garbage
**Cause:** Web stream chunks are plain `Uint8Array`s, whose `toString` joins
numbers with commas.
**Fix:** `Buffer.from(chunk).toString()` or `new TextDecoder().decode(chunk)`.

**Symptom:** A fetch download uses as much memory as the file
**Cause:** `await res.arrayBuffer()` / `res.json()` buffers everything.
**Fix:** `pipeline(Readable.fromWeb(res.body), sink)`.

**Symptom:** `stream.pipe is not a function` on `res.body`
**Cause:** It is a web stream; `pipe` is the Node API.
**Fix:** `Readable.fromWeb(res.body)`, then `pipeline`.

**Symptom:** Cancelling a `pipeTo` leaves the source running
**Cause:** `pipeTo` accepts `preventCancel`/`preventClose`/`preventAbort`
options, and the defaults may not be what you assumed.
**Fix:** Pass an `AbortSignal` in `pipeTo(dest, { signal })` and leave the
prevent flags alone unless you have a reason.

## Interview questions

**★ Where do web streams appear in a Node backend even if you never create one?**
`fetch`. `Response.body` and `Request.body` are `ReadableStream`s, as are
`Blob.stream()` and the bodies undici produces. Any code that streams an HTTP
response has to deal with them.

**★ How do you pipe a fetch response to a file?**
`await pipeline(Readable.fromWeb(res.body), createWriteStream(path))`. Using
`res.arrayBuffer()` instead buffers the entire download in memory.

**★ What is different about consuming a web stream versus a Node Readable?**
Web streams lock: exactly one reader, and taking it excludes everyone else. There
is no `'data'` event; you pull with a reader (async iteration over one is a Node
extension, not in the spec). Chunks are `Uint8Array`, not Buffer.

**★ Why does `res.json()` followed by `res.text()` fail?**
The first call locks and drains the body stream. A body can be consumed once. Use
`res.clone()` beforehand or read once into a variable.

**When would you choose web streams for your own code?**
When it must run on an edge runtime or in the browser, or when it lives entirely
inside `fetch`/`Response`. Inside Node, Node streams have `pipeline`, object mode
and better interop.

**What does `tee()` cost?**
It duplicates the stream into two branches, but the faster branch's data must be
buffered until the slower one reads it — so an abandoned branch grows memory
without bound.

---

← Prev: [Object mode](14-object-mode.md) · Next → [zlib — gzip and brotli](16-zlib.md)
