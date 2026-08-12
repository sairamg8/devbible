---
title: "Object mode"
sidebar_label: "14 · Object mode"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Object mode lets a stream carry arbitrary JavaScript values instead of bytes,
and changes the high water mark from a byte count to an item count. It is what
makes streams useful for database rows and parsed records rather than just
files.**

## Without it, non-bytes are rejected

```js
// reject.mjs
import { Writable } from 'node:stream';
const w = new Writable({ write(c, e, cb) { cb(); } });
try { w.write({ id: 1 }); } catch (err) { console.log('binary-mode write({}) throws SYNCHRONOUSLY ->', err.code); }
```

```console
$ node reject.mjs
binary-mode write({}) throws SYNCHRONOUSLY -> ERR_INVALID_ARG_TYPE
```

A default stream accepts strings, Buffers, TypedArrays and DataViews. Anything
else throws — **synchronously**, so a `try`/`catch` catches it and an `'error'`
handler does not.

## The high water mark changes units

```js
// hwm.mjs
import { Writable } from 'node:stream';
const objects = new Writable({ objectMode: true, highWaterMark: 2, write(c, e, cb) { setTimeout(cb, 10); } });
const bytes = new Writable({ write(c, e, cb) { cb(); } });

console.log('objectMode hwm:', objects.writableHighWaterMark, 'items | binary hwm:', bytes.writableHighWaterMark, 'bytes');
console.log('write 1 ->', objects.write({ a: 1 }), '| write 2 ->', objects.write({ a: 2 }), '| write 3 ->', objects.write({ a: 3 }), '| queued:', objects.writableLength);
```

```console
$ node hwm.mjs
objectMode hwm: 2 items | binary hwm: 65536 bytes
write 1 -> true | write 2 -> false | write 3 -> false | queued: 3
```

**Defaults: 65536 bytes in binary mode, 16 items in object mode.**
`stream.getDefaultHighWaterMark(true)` returns 16.

That difference matters more than it looks. Sixteen *items* is sixteen database
rows — which might be 16 KB or 16 MB depending on the row. **In object mode the
high water mark controls count, not memory**, so a stream of large objects can
use far more memory than its high water mark suggests. If your objects are
heavy, lower it.

## One-sided object mode

```js
// one-sided.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const sizes = new Transform({
  readableObjectMode: true,               // bytes in, objects out
  transform(chunk, e, cb) { cb(null, { size: chunk.length }); },
});

const got = [];
await pipeline(Readable.from([Buffer.from('abc'), Buffer.from('de')]), sizes, async function* (s) { for await (const o of s) got.push(o); });
console.log(got);
```

```console
$ node one-sided.mjs
[ { size: 3 }, { size: 2 } ]
```

| Option | Writable side | Readable side |
|---|---|---|
| `objectMode: true` | objects | objects |
| `writableObjectMode: true` | objects | bytes |
| `readableObjectMode: true` | bytes | objects |

`readableObjectMode` is the parser shape — bytes in, records out — and
`writableObjectMode` is the serialiser shape — records in, bytes out. A full
pipeline usually goes bytes → objects → bytes.

## `null` is the terminator, not a value

```js
// null.mjs
import { Readable } from 'node:stream';
const s = new Readable({ objectMode: true, read() { this.push(null); } });
const items = [];
for await (const i of s) items.push(i);
console.log('pushing null as a value ends the stream instead:', items);
```

```console
$ node null.mjs
pushing null as a value ends the stream instead: []
```

`push(null)` means end-of-stream in every mode. If your data legitimately
contains `null` — a nullable DB column streamed as bare values — wrap it:
`push({ value: null })`. `undefined` is likewise unusable as a value.

## Where you actually use it

```js
// rows.mjs — the everyday shape: DB rows → filter → CSV bytes → gzip → disk
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

async function* fakeRows() {                       // stand-in for a cursor
  for (let i = 1; i <= 5; i++) yield { id: i, amount: i * 100, region: i % 2 ? 'eu' : 'us' };
}

const bigOnly = new Transform({
  objectMode: true,
  transform(row, e, cb) { cb(null, row.amount >= 300 ? row : null); },
});

const toCsv = new Transform({
  writableObjectMode: true,                        // objects in, bytes out
  transform(row, e, cb) { cb(null, `${row.id},${row.amount},${row.region}\n`); },
});

await pipeline(Readable.from(fakeRows()), bigOnly, toCsv, createGzip(), createWriteStream('rows.csv.gz'));
console.log('written');
```

```console
$ node rows.mjs
written
$ zcat rows.csv.gz
3,300,eu
4,400,us
5,500,eu
```

Real sources that give you object streams:

| Source | How |
|---|---|
| PostgreSQL (`pg`) | `pg-query-stream` — rows as objects |
| MongoDB | `collection.find().stream()` |
| `readline` | one line per item (strings, still object mode) |
| CSV | `csv-parse` — one record per item |
| `Readable.from(asyncGenerator)` | anything you can generate |

`Readable.from` is object mode by default, and its high water mark is **1** —
lazy by design, so a generator wrapping an API call does not fetch ahead.

```js
console.log(Readable.from([1]).readableObjectMode, Readable.from([1]).readableHighWaterMark);
// true 1
```

## The cost

Object mode gives up the two things byte streams are good at:

- **No coalescing.** Sixteen small objects are sixteen separate `_write` calls;
  bytes would have been merged into one 64 KB chunk. Per-item overhead dominates
  for tiny items — batch in the sink (`_writev`) rather than streaming one row
  per insert.
- **Memory is unmeasured.** The high water mark counts items, so nothing protects
  you from 16 × 10 MB documents.

For a pipeline moving millions of tiny records, a byte stream of NDJSON with a
batching sink is often faster than an object stream. Measure before assuming.

## Gotchas

**Symptom:** `ERR_INVALID_ARG_TYPE: The "chunk" argument must be of type string
or an instance of Buffer…`
**Cause:** Wrote an object to a byte-mode stream.
**Fix:** `objectMode: true` on that stream — and note the throw is synchronous,
so an `'error'` handler will not see it.

**Symptom:** The stream ends early and silently
**Cause:** A `null` (or `undefined`) value was pushed as data.
**Fix:** Wrap values: `push({ value })`.

**Symptom:** Memory blows up despite a small high water mark
**Cause:** 16 items of unbounded size.
**Fix:** Lower the high water mark, or cap the item size upstream.

**Symptom:** Throughput is terrible on millions of small records
**Cause:** Per-object overhead; no coalescing in object mode.
**Fix:** Batch in the sink with `_writev`, or move bytes (NDJSON) and parse in
batches.

**Symptom:** `_transform` receives a string when the upstream pushed an object
**Cause:** Only one side is in object mode.
**Fix:** Check `readableObjectMode` / `writableObjectMode` on **every** stage —
the mismatch is at the boundary between two stages, not inside one.

**Symptom:** A generator-backed stream fetches far ahead of the consumer
**Cause:** A high water mark above 1 on an object stream that wraps paged API
calls.
**Fix:** `Readable.from` already defaults to 1; keep it there.

## Interview questions

**★ What does `objectMode: true` change?**
Two things: the stream accepts arbitrary JavaScript values instead of only
strings/Buffers/TypedArrays, and the high water mark counts items rather than
bytes — default 16 items instead of 65 536 bytes.

**★ What is the memory risk in object mode?**
The high water mark bounds the item count, not the bytes. Sixteen buffered
documents of 10 MB each is 160 MB, and nothing in the stream machinery objects.
Lower the high water mark when items are large.

**★ Why can't you push `null` as a value?**
`push(null)` is the end-of-stream signal in every mode, so a legitimate `null`
value terminates the stream instead of being delivered. Wrap it in an object.

**★ What is `readableObjectMode` for?**
Object mode on one side only. `readableObjectMode: true` means bytes in, objects
out — the parser shape. `writableObjectMode: true` is the reverse, the serialiser
shape.

**When is a byte stream faster than an object stream?**
When records are small and numerous. Byte streams coalesce into 64 KB chunks;
object streams pay per-item overhead on every one. NDJSON plus batched parsing
often beats one object per row.

**What is the default high water mark for `Readable.from`?**
1, and object mode is on. It is deliberately lazy so wrapping a paged API in a
generator does not prefetch.

---

← Prev: [Transform streams](./transform-streams/) · Next → [Web Streams](15-web-streams.md)
