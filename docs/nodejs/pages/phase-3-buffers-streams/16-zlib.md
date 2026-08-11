---
title: "zlib — gzip and brotli as streams"
sidebar_label: "16 · zlib"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`node:zlib` gives you gzip, deflate and brotli as Transform streams, so
compression drops into a pipeline with no buffering. The decision that matters is
not which algorithm — it is which *level*, and brotli's default will cost you 75
seconds where quality 4 costs 0.7.**

## Compression in a pipeline

```js
// compress.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

await pipeline(createReadStream('big.log'), createGzip(), createWriteStream('big.log.gz'));
console.log('done');
```

Three streams, constant memory, backpressure end to end. Reversing it is
`createGunzip()`.

| Factory | Format | Decompress with |
|---|---|---|
| `createGzip()` | gzip (RFC 1952) — has a header and CRC | `createGunzip()` |
| `createDeflate()` | zlib (RFC 1950) | `createInflate()` |
| `createDeflateRaw()` | raw deflate, no header | `createInflateRaw()` |
| `createBrotliCompress()` | brotli (RFC 7932) | `createBrotliDecompress()` |
| `createUnzip()` | auto-detects gzip vs deflate | — |

There are `*Sync` and callback variants of each (`gzipSync`, `gunzip`) for small
in-memory values. Use the streams for anything file- or response-sized.

## Level is the decision

```console
$ node zcomp.mjs
source 19.1 MB
gzip (default, 6)         784 ms   3.64 MB   5.2x
gzip level 1              368 ms   4.24 MB   4.5x
gzip level 9             1765 ms   3.61 MB   5.3x
brotli quality 4          667 ms   3.52 MB   5.4x
brotli default (11)     75729 ms   1.91 MB   10.0x
```

```js
// zcomp.mjs
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { createGzip, createBrotliCompress, constants } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const src = 'slice.log', size = statSync(src).size;
async function run(label, make) {
  const t = Date.now();
  await pipeline(createReadStream(src), make(), createWriteStream('tmp.out'));
  const out = statSync('tmp.out').size;
  console.log(`${label.padEnd(22)} ${String(Date.now() - t).padStart(6)} ms   ${(out / 1024 / 1024).toFixed(2)} MB   ${(size / out).toFixed(1)}x`);
}
await run('gzip (default, 6)', () => createGzip());
await run('gzip level 1', () => createGzip({ level: 1 }));
await run('gzip level 9', () => createGzip({ level: 9 }));
await run('brotli quality 4', () => createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }));
await run('brotli default (11)', () => createBrotliCompress());
```

Read that table twice, because it contains the two facts people get wrong:

1. **gzip level 9 is not worth it.** 2.2× the CPU of level 6 for 0.8% smaller
   output. Level 1 is half the CPU for 16% larger. For dynamic responses, **level
   1 is usually the right answer**; for static assets compressed once at build
   time, level 9 or brotli 11.
2. **`createBrotliCompress()` with no options uses quality 11** — 75 seconds for
   19 MB, roughly **100× slower than gzip** for twice the compression. It is
   intended for pre-compressed static assets. Using it on a dynamic response is a
   self-inflicted outage: one request pins a thread pool slot for a minute.
   Quality 4 is the usual choice when brotli must run per request.

```js
// dynamic responses: cheap and fast
createGzip({ level: 1 });
createBrotliCompress({ params: {
  [constants.BROTLI_PARAM_QUALITY]: 4,
  [constants.BROTLI_PARAM_SIZE_HINT]: knownLength,   // helps brotli pick a window
} });
```

## It runs on the thread pool

zlib's stream operations are **asynchronous and executed on the libuv thread
pool** ([Phase 0](../phase-0-runtime-model/04-libuv-thread-pool.md)) — four
threads by default.

```console
$ node zpool.mjs
1 gzip : 712 ms
4 gzip : 679 ms
8 gzip : 1317 ms   UV_THREADPOOL_SIZE=4 (default)

$ UV_THREADPOOL_SIZE=8 node zpool.mjs
4 gzip : 789 ms
8 gzip : 1014 ms   UV_THREADPOOL_SIZE=8
```

Four concurrent compressions cost the same as one — they run in parallel on the
four pool threads. The eighth doubles the wall time, because the pool is
saturated and jobs queue. **And `fs` operations and `dns.lookup` share that same
pool**, so heavy compression makes unrelated file reads slow.

The `*Sync` variants are worse: they run **on the main thread** and block the
event loop for the whole duration.

```console
$ node -e "const t=Date.now(); require('node:zlib').gzipSync(require('node:fs').readFileSync('slice.log')); console.log(Date.now()-t,'ms')"
640 ms
```

640 ms in which your server answers nothing at all.

## Where compression actually belongs

**Usually not in Node.** Put it in nginx or your CDN:

- nginx compresses with C code outside your process and outside your event loop;
- static assets should be compressed once at build time and served
  pre-compressed (`gzip_static` / `brotli_static`);
- a CDN does it at the edge, closer to the user.

Compress inside Node when:
- you are writing a file yourself (log rotation, an export, a backup);
- you are talking to an upstream that requires it;
- there is no proxy in front — a serverless function, a local tool.

```js
// export-gz.mjs — the legitimate in-process case
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

async function streamCsvGz(rows, res) {
  res.writeHead(200, {
    'Content-Type': 'text/csv',
    'Content-Encoding': 'gzip',            // you MUST set this if you compress yourself
    'Content-Disposition': 'attachment; filename="orders.csv.gz"',
  });
  await pipeline(rows, createGzip({ level: 1 }), res);
}
```

Setting `Content-Encoding` is not optional — omit it and the client receives
binary garbage. And never compress a response the proxy will compress again.

## Decompressing untrusted input

```js
// zerr.mjs
import { gzipSync, gunzipSync, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const packed = gzipSync(Buffer.from('hello '.repeat(20)));
console.log('120 bytes ->', packed.length, 'bytes; magic', packed.subarray(0, 2).toString('hex'));

try { gunzipSync(Buffer.from('not gzip at all')); } catch (e) { console.log('corrupt ->', e.code, '|', e.message); }

const truncated = packed.subarray(0, packed.length - 5);
try {
  await pipeline(Readable.from([truncated]), createGunzip(), async function* (s) { for await (const _ of s); });
} catch (e) { console.log('truncated ->', e.code, '|', e.message); }
```

```console
$ node zerr.mjs
120 bytes -> 29 bytes; magic 1f8b
corrupt -> Z_DATA_ERROR | incorrect header check
truncated -> Z_BUF_ERROR | unexpected end of file
```

Two security notes for decompressing anything a client sent:

- **Zip bombs.** A few KB of gzip can expand to gigabytes. Cap the output —
  count bytes in a Transform after the gunzip and destroy the pipeline past a
  limit. `maxOutputLength` on the zlib options does this for you and throws
  `ERR_BUFFER_TOO_LARGE`.
- **`Z_BUF_ERROR` on truncation is a feature.** A silently truncated stream
  would otherwise look like valid short data.

```js
createGunzip({ maxOutputLength: 10 * 1024 * 1024 });   // hard cap, throws past it
```

```console
$ node bomb.mjs
bomb:  4893 bytes -> 5000000 bytes, 1022x
maxOutputLength -> ERR_BUFFER_TOO_LARGE | Cannot create a Buffer larger than 1048576 bytes
```

4.9 KB expanding to 5 MB — a ratio of 1022× — from three lines of code. A real
bomb reaches 1000000×.

## Gotchas

**Symptom:** A response takes a minute and pins CPU
**Cause:** `createBrotliCompress()` with default quality 11 on a dynamic
response.
**Fix:** `BROTLI_PARAM_QUALITY: 4`, or gzip level 1.

**Symptom:** Unrelated file reads slow down under compression load
**Cause:** zlib and `fs` share the four-thread libuv pool.
**Fix:** Raise `UV_THREADPOOL_SIZE`, or move compression to nginx.

**Symptom:** The event loop stalls for hundreds of milliseconds
**Cause:** `gzipSync` / `gunzipSync` on a large buffer — main thread.
**Fix:** Use the stream or async form.

**Symptom:** The client shows binary garbage
**Cause:** Compressed the body without setting `Content-Encoding: gzip`.
**Fix:** Set it — or let the proxy compress.

**Symptom:** Output is double-compressed and larger than the input
**Cause:** Node gzipped it and nginx gzipped it again.
**Fix:** Compress in exactly one place.

**Symptom:** `Z_BUF_ERROR: unexpected end of file`
**Cause:** Truncated compressed input — an interrupted upload or a partial file.
**Fix:** Treat it as a corrupt-input error, not a bug; re-fetch.

**Symptom:** Memory explodes while decompressing an upload
**Cause:** A zip bomb, or simply a very compressible large file.
**Fix:** `maxOutputLength`, and check the ratio.

**Symptom:** Compressed output is bigger than the input
**Cause:** The data is already compressed (JPEG, PNG, MP4, another gzip) or is
tiny — gzip adds ~20 bytes of framing.
**Fix:** Skip compression below ~1 KB and for already-compressed media types.

## Interview questions

**★ Where should compression happen in a typical Node deployment?**
In nginx or the CDN, not in the Node process — it keeps the CPU work out of the
event loop and off the libuv thread pool. Compress inside Node only when writing
files yourself, when an upstream requires it, or when there is no proxy.

**★ What is wrong with `createBrotliCompress()` on a dynamic response?**
The default is quality 11, tuned for pre-compressing static assets. Measured on
19 MB: 75.7 s versus 0.78 s for gzip level 6. Per-request brotli needs quality
around 4.

**★ Does zlib block the event loop?**
The stream and callback APIs do not — they run on the libuv thread pool (4
threads by default), which is why four concurrent gzips take the same wall time
as one and eight take twice as long. The `*Sync` variants *do* block the main
thread.

**★ How do you protect against a zip bomb?**
Cap the decompressed size — `maxOutputLength` on the zlib options, which throws
`ERR_BUFFER_TOO_LARGE`, or count bytes downstream and destroy the pipeline. Never
decompress untrusted input without a ceiling.

**Is gzip level 9 worth it?**
Rarely. Measured: level 9 was 2.2× the CPU of level 6 for 0.8% smaller output.
Level 1 halves the CPU for about 16% more bytes, which is the right trade for
dynamic content. Level 9 belongs in a build step.

**Why is my compressed output larger than the input?**
The input is already compressed, or it is small enough that gzip's ~20-byte
header and framing dominate. Skip compression for media types and tiny bodies.

---

← Prev: [Web Streams](15-web-streams.md) · Next → [Custom Readable and Writable](17-custom-readable-writable.md)
