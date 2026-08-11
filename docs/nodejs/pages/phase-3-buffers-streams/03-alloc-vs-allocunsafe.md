---
title: "alloc vs allocUnsafe"
sidebar_label: "03 · alloc vs allocUnsafe"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`Buffer.allocUnsafe` hands you memory that was in use a moment ago, contents
intact. It is roughly 20× faster than `Buffer.alloc` and it will leak other
requests' data into your response if you do not overwrite every byte.**

## The difference, shown

```js
// unsafe.mjs
console.log('allocUnsafe :', Buffer.allocUnsafe(24).toString('hex'));
console.log('alloc       :', Buffer.alloc(24).toString('hex'));
```

```console
$ node unsafe.mjs
allocUnsafe : 002222000023220000242200002522000026220000272200
alloc       : 000000000000000000000000000000000000000000000000
```

`alloc` zero-fills. `allocUnsafe` skips that step and returns whatever those
bytes already held — here, fragments of V8 heap pointers.

## Why it is genuinely dangerous

The bytes are not random. They are your process's recently freed memory: request
bodies, session tokens, decrypted secrets.

```js
// leak.mjs — a real recovery, not a theoretical one
for (let i = 0; i < 5000; i++) {
  Buffer.from(`{"password":"hunter2","token":"tok_live_${i}"}`);  // request bodies, now garbage
}

let hits = 0, sample = null;
for (let i = 0; i < 5000; i++) {
  const scratch = Buffer.allocUnsafe(80).toString('latin1');
  if (scratch.includes('hunter2')) { hits++; sample ??= scratch; }
}
console.log('recovered', hits, 'of 5000 =>', sample && JSON.stringify(sample.slice(0, 60)));
```

```console
$ node leak.mjs
recovered 2189 of 5000 => "oken\":\"tok_live_1084\"}\u0000\u0000{\"password\":\"hunter2\",\"token\":\"tok_l"
```

Forty-four percent of the "fresh" buffers contained a previous request's
password. This is not a contrived reproduction — it is the mechanism behind
CVE-2016-2216-class bugs and the reason `new Buffer(n)` was deprecated: it called
`allocUnsafe` under the hood, so `new Buffer(req.body.size)` was a remote memory
disclosure primitive.

**If you call `allocUnsafe`, you owe the buffer a complete overwrite before
anything reads it.**

## What it buys you

```js
// bench.mjs
const N = 2e5;
let t = process.hrtime.bigint();
for (let i = 0; i < N; i++) Buffer.alloc(1024);
const safe = Number(process.hrtime.bigint() - t) / 1e6;

t = process.hrtime.bigint();
for (let i = 0; i < N; i++) Buffer.allocUnsafe(1024);
const unsafe = Number(process.hrtime.bigint() - t) / 1e6;

console.log(`alloc ${safe.toFixed(0)}ms  allocUnsafe ${unsafe.toFixed(0)}ms  ratio ${(safe / unsafe).toFixed(1)}x`);
```

```console
$ node bench.mjs
alloc 690ms  allocUnsafe 32ms  ratio 21.6x
```

200 000 allocations of 1 KB: 690 ms versus 32 ms. Two things make the gap that
large — skipping the memset, and the **pool** (below). Per allocation the saving
is about 3 µs, so it only shows up in hot loops that allocate constantly: a
parser, a codec, a protocol implementation. For a per-request buffer it is noise.

## The pool — why allocUnsafe is fast for small sizes

```js
// pool.mjs
console.log('poolSize', Buffer.poolSize, '| pooled below', Buffer.poolSize >>> 1);
for (const n of [100, 32767, 32768, 40000]) {
  const b = Buffer.allocUnsafe(n);
  console.log(String(n).padStart(6), 'pooled:', b.buffer.byteLength === Buffer.poolSize,
              '| byteOffset', b.byteOffset, '| underlying', b.buffer.byteLength);
}
const a = Buffer.allocUnsafe(8), c = Buffer.allocUnsafe(8);
console.log('two small buffers share one ArrayBuffer:', a.buffer === c.buffer, a.byteOffset, c.byteOffset);
```

```console
$ node pool.mjs
poolSize 65536 | pooled below 32768
   100 pooled: true | byteOffset 1456 | underlying 65536
 32767 pooled: true | byteOffset 1624 | underlying 65536
 32768 pooled: false | underlying 32768
 40000 pooled: false | underlying 40000
two small buffers share one ArrayBuffer: true 10704 10712
```

Node keeps a 64 KB slab (`Buffer.poolSize`, **65536 in Node 24** — older articles
say 8192). Any `allocUnsafe` **below half the pool size** is carved out of the
current slab by bumping an offset; one `malloc` serves thousands of buffers.
Requests at or above 32 768 bytes get their own allocation.

Three consequences that matter:

- **`buf.buffer` is not yours.** For a pooled buffer, `buf.buffer` is the whole
  64 KB slab shared with unrelated buffers. Passing `buf.buffer` to a Web API,
  a worker `postMessage` transfer, or `new Uint8Array(buf.buffer)` exposes 64 KB
  of other data. Always pass the triple:
  `new Uint8Array(buf.buffer, buf.byteOffset, buf.length)`.
- **A pooled buffer keeps the whole slab alive.** Retain one 20-byte header
  parsed out of a pooled read and you pin 64 KB. In a cache of a million headers
  that is a memory leak with a plausible-looking heap snapshot.
- `Buffer.allocUnsafeSlow(n)` opts out of the pool: its own `ArrayBuffer`, exact
  size, `byteOffset` 0. Use it for anything long-lived.

`Buffer.from(string)` and `Buffer.concat` also use the pool. `Buffer.alloc` never
does — it always allocates fresh, zeroed memory.

## Which to call

| Case | Call |
|---|---|
| Anything holding user data, secrets, or crossing a response boundary | **`Buffer.alloc`** |
| A buffer you immediately and completely overwrite (`fs.read`, `socket.read`, a codec's scratch space) | `Buffer.allocUnsafe` |
| A long-lived buffer kept in a cache or a class field | `Buffer.allocUnsafeSlow`, or `alloc` |
| You are not sure | **`Buffer.alloc`** |

The default is `alloc`. Reach for `allocUnsafe` when a profiler has told you
allocation is hot, not before — 3 µs is not the reason your endpoint is slow.

## The safe pattern for the fast path

```js
// read-into.mjs — the one legitimate everyday allocUnsafe
import { open } from 'node:fs/promises';

const file = await open('big.log');
const buf = Buffer.allocUnsafe(64 * 1024);        // scratch space
try {
  const { bytesRead } = await file.read(buf, 0, buf.length, 0);
  // ✅ only ever touch the region the read actually filled
  process.stdout.write(buf.subarray(0, bytesRead).toString().slice(0, 40) + '…\n');
} finally {
  await file.close();
}
```

The rule that makes this safe is `subarray(0, bytesRead)`. Using `buf` whole
would append stale pool bytes to every short read.

## Gotchas

**Symptom:** Response bodies occasionally contain fragments of other users' data
**Cause:** `allocUnsafe` (or `new Buffer(n)`) partially filled, then sent whole.
**Fix:** `Buffer.alloc`, or slice to exactly the bytes you wrote.

**Symptom:** A short read appends junk to the end of the data
**Cause:** Used the whole scratch buffer instead of `subarray(0, bytesRead)`.
**Fix:** Always slice to `bytesRead`.

**Symptom:** `new Uint8Array(buf.buffer)` is 65536 bytes long for a 20-byte buffer
**Cause:** `buf.buffer` is the shared pool slab.
**Fix:** `new Uint8Array(buf.buffer, buf.byteOffset, buf.length)`.

**Symptom:** Heap grows steadily while the cached objects are tiny
**Cause:** Small pooled buffers retained long-term, each pinning a 64 KB slab.
**Fix:** Copy on store (`Buffer.from(view)`), or allocate with
`allocUnsafeSlow`/`alloc`.

**Symptom:** Transferring a buffer to a worker throws or corrupts other data
**Cause:** Transferring `buf.buffer` moves the entire shared pool slab.
**Fix:** Copy into a dedicated buffer first, or use `allocUnsafeSlow`.

**Symptom:** A security scanner flags `new Buffer()`
**Cause:** It is the deprecated API that dispatched to `allocUnsafe` for a
numeric argument.
**Fix:** `Buffer.from` for data, `Buffer.alloc` for size. Deprecated as DEP0005
since Node 6.

## Interview questions

**★ What is unsafe about `Buffer.allocUnsafe`?**
It returns memory without zeroing it, so the buffer starts life holding whatever
was there before — often recently freed request bodies or secrets. If you send
the buffer without fully overwriting it, you disclose that memory. Demonstrably:
after churning 5 000 fake request bodies, 44% of subsequent 80-byte `allocUnsafe`
calls contained the password string.

**★ When is `allocUnsafe` the right call?**
When the buffer is filled completely and immediately by the very next operation —
a `read()` into scratch space, a codec's working buffer — and allocation showed up
in a profile. Then slice to the bytes actually written.

**★ How much faster is it, really?**
About 20× per call in a tight loop (690 ms vs 32 ms for 200 000 × 1 KB), which is
roughly 3 µs each. Irrelevant per request; significant in a parser that allocates
per frame.

**★ Why can `buf.buffer` be bigger than `buf`?**
Small buffers are carved out of a shared 64 KB pool, so `buf.buffer` is the whole
slab and `buf.byteOffset` is where your bytes start. Constructing a view from
`buf.buffer` alone exposes unrelated data — pass offset and length too.

**Why was `new Buffer()` deprecated?**
Its behaviour depended on argument type: a string copied data, a number returned
uninitialized memory. `new Buffer(userSuppliedLength)` was therefore a memory
disclosure bug. Split into `Buffer.from` and `Buffer.alloc`.

**What does `Buffer.allocUnsafeSlow` do differently?**
It skips the pool and gives the buffer its own exactly-sized `ArrayBuffer`. Still
uninitialized, but safe to retain long-term and safe to hand `buffer` to APIs
that expect to own it.

---

← Prev: [Encodings](02-encodings.md) · Next → [Buffer is a Uint8Array](04-buffer-as-uint8array.md)
