---
title: "Custom Readable and Writable"
sidebar_label: "17 · Custom streams"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Before writing one: `Readable.from(asyncGenerator())` replaces most custom
Readables, and a generator stage in `pipeline` replaces most Transforms. Write
the class when you need pull control, `_writev` batching, or `_destroy` cleanup —
which is a real but narrow set of cases.**

## A custom Readable

`_read(size)` is called by the machinery whenever the internal buffer drops below
the high water mark. Push data; push `null` to end.

```js
// page-reader.mjs
import { Readable } from 'node:stream';

class PageReader extends Readable {
  #page = 0;
  constructor(pages) { super({ objectMode: true, highWaterMark: 2 }); this.pages = pages; }
  _read(size) {
    console.log(`  _read(${size}) called, page ${this.#page}`);
    if (this.#page >= this.pages) return this.push(null);      // end of stream
    this.push({ page: this.#page++, rows: 100 });
  }
}

const pages = [];
for await (const p of new PageReader(3)) pages.push(p.page);
console.log('pages read:', pages);
```

```console
$ node page-reader.mjs
  _read(2) called, page 0
  _read(2) called, page 1
  _read(2) called, page 2
  _read(2) called, page 3
pages read: [ 0, 1, 2 ]
```

The contract:

- **`_read` is a request, not a command.** Push at least one chunk, or push
  nothing now and push later (asynchronously) — but if you never push again the
  stream stalls.
- **`push()` returns `false`** when the buffer is full. That is your signal to
  stop pushing; `_read` will be called again when there is room.
- **`push(null)` ends it.** Exactly once.
- **Never call `_read` yourself.**
- Errors go through `this.destroy(err)`, never `throw`.

The async version, where `_read` starts work and pushes when it resolves:

```js
// async-read.mjs
import { Readable } from 'node:stream';

class ApiPages extends Readable {
  #cursor = null;
  #done = false;
  constructor() { super({ objectMode: true }); }
  async _read() {
    if (this.#done) return;
    try {
      const { items, next } = await fakeFetch(this.#cursor);
      for (const item of items) this.push(item);
      this.#cursor = next;
      if (!next) { this.#done = true; this.push(null); }
    } catch (err) {
      this.destroy(err);                       // NOT throw
    }
  }
}

let call = 0;
async function fakeFetch(cursor) {
  call++;
  return call < 3 ? { items: [`item-${call}a`, `item-${call}b`], next: `c${call}` } : { items: ['last'], next: null };
}

console.log(await new ApiPages().toArray());
```

```console
$ node async-read.mjs
[ 'item-1a', 'item-1b', 'item-2a', 'item-2b', 'last' ]
```

**And here is the same thing with a generator:**

```js
// generator-version.mjs
import { Readable } from 'node:stream';

async function* apiPages() {
  let cursor = null;
  do {
    const { items, next } = await fakeFetch(cursor);
    yield* items;
    cursor = next;
  } while (cursor);
}

console.log(await Readable.from(apiPages()).toArray());
```

Same behaviour, no `_read` contract, no re-entrancy to reason about, errors
propagate as ordinary exceptions. **Reach for the class only when the generator
genuinely cannot express it** — typically when you need to respond to the `size`
hint, or when the source is push-based (an event emitter) rather than pull-based.

For push-based sources, `Readable` with `read() {}` (a no-op) plus `push()` from
the event handler works, but you must check `push()`'s return value and pause the
underlying source — otherwise you have reinvented the unbounded queue.

## A custom Writable

`_write` handles one chunk; `_writev` handles a queued batch; `_final` runs after
`end()`.

```js
// batch-writer.mjs
import { Writable, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

class BatchWriter extends Writable {
  #batch = [];
  constructor(size) { super({ objectMode: true }); this.size = size; }

  _write(row, enc, cb) {
    this.#batch.push(row);
    if (this.#batch.length < this.size) return cb();
    this.#flush().then(() => cb(), cb);
  }

  _writev(chunks, cb) {                      // called when several writes are queued
    console.log('  _writev with', chunks.length, 'queued rows');
    this.#batch.push(...chunks.map((c) => c.chunk));
    this.#flush().then(() => cb(), cb);
  }

  _final(cb) { this.#flush().then(() => cb(), cb); }   // flush the partial batch

  async #flush() {
    if (!this.#batch.length) return;
    console.log('  INSERT', this.#batch.length, 'rows');
    this.#batch = [];
  }
}

await pipeline(Readable.from([1, 2, 3, 4, 5, 6, 7]), new BatchWriter(3));
```

```console
$ node batch-writer.mjs
  INSERT 3 rows
  _writev with 4 queued rows
  INSERT 4 rows
```

This is the pattern worth knowing, because "stream rows into a database" written
naively does one `INSERT` per row. Batching in `_writev` turns it into one
statement per queue drain.

- **`_writev(chunks, cb)`** receives `[{ chunk, encoding }, …]`. It is optional;
  implement it and Node hands you the whole queued batch instead of calling
  `_write` repeatedly.
- **`_final(cb)`** is the only place to flush a partial batch. Forget it and the
  last few rows are silently lost.
- **Call `cb` exactly once**, with an error to fail the stream.

## `_destroy` — releasing resources

```js
// destroy.mjs
import { Writable } from 'node:stream';

class Res extends Writable {
  _write(c, e, cb) { cb(); }
  _destroy(err, cb) {
    console.log('  _destroy ran, err =', err?.message ?? null, '(release the connection here)');
    cb(err);
  }
}
const res = new Res();
res.on('error', () => {});
res.destroy(new Error('client gone'));
```

```console
$ node destroy.mjs
  _destroy ran, err = client gone (release the connection here)
```

`_destroy` runs **exactly once**, on success and on failure, which makes it the
only correct place to release a database connection, close a file handle, or
delete a temp file. `pipeline` calls `destroy()` on every stream, so implementing
`_destroy` is what makes your stream safe inside one.

## Which to write, in one table

| Need | Write |
|---|---|
| An array/iterable as a stream | `Readable.from(iterable)` |
| A paged API or cursor as a stream | `Readable.from(asyncGenerator())` |
| Per-chunk transformation | a generator stage in `pipeline` |
| A reusable, composable transform | `Transform` subclass ([page 13](13-transform-streams.md)) |
| A push-based source (events, a socket library) | `Readable` with manual `push` + backpressure checks |
| A sink that batches | `Writable` with `_writev` and `_final` |
| Anything holding a resource | any of the above, plus `_destroy` |

## Gotchas

**Symptom:** The stream produces nothing and hangs
**Cause:** `_read` did not push and never pushed later.
**Fix:** Every `_read` must eventually push or end.

**Symptom:** Memory grows in a push-based Readable
**Cause:** Ignored `push()`'s `false` return and kept pushing from an event
handler.
**Fix:** Pause the underlying source when `push` returns `false`; resume in
`_read`.

**Symptom:** The last rows are missing from the database
**Cause:** No `_final`, so the partial batch was never flushed.
**Fix:** Implement `_final`.

**Symptom:** A connection leaks on error
**Cause:** Cleanup in `_final` only — it does not run when the stream is
destroyed.
**Fix:** Clean up in `_destroy`, which runs on every path.

**Symptom:** `ERR_MULTIPLE_CALLBACK`
**Cause:** `cb` called twice — commonly `.then(() => cb(), cb)` where the success
handler also throws.
**Fix:** One call per invocation.

**Symptom:** `Error [ERR_STREAM_PUSH_AFTER_EOF]`
**Cause:** Pushed after `push(null)`.
**Fix:** Guard with a `#done` flag; an in-flight async `_read` that resolves
after the end is the usual cause.

**Symptom:** Throwing inside `_read`/`_write` crashes the process
**Cause:** Exceptions there are not converted to stream errors.
**Fix:** `this.destroy(err)` in a Readable; `cb(err)` in a Writable.

## Interview questions

**★ When should you NOT write a custom stream class?**
Almost always. `Readable.from(asyncGenerator())` covers sources and a generator
stage in `pipeline` covers transforms, with no `_read`/`callback` contract to get
wrong. Write the class for pull control, `_writev` batching, or `_destroy`
cleanup.

**★ What does `_read(size)` mean and what must it do?**
It is the machinery asking for more data because the buffer fell below the high
water mark. It must eventually `push()` something or `push(null)` — otherwise the
stream stalls forever. `size` is a hint you may ignore.

**★ What is `_writev` for?**
Node calls it with the whole queued batch of writes instead of calling `_write`
once per chunk. It turns "one INSERT per row" into "one INSERT per drain", which
is the main reason to hand-write a Writable at all.

**★ Why put cleanup in `_destroy` rather than `_final`?**
`_final` only runs on the successful `end()` path. `_destroy` runs exactly once
on every path — success, error, and external `destroy()` — and `pipeline`
destroys every stream, so it is the only place that always executes.

**How do you signal an error from a custom stream?**
`this.destroy(err)` in a Readable, `cb(err)` in a Writable or Transform. Throwing
inside the underscore methods escapes the stream machinery and crashes the
process.

**How do you apply backpressure in a push-based Readable?**
Check `push()`'s return value. `false` means the buffer is full — pause the
underlying source and resume it in the next `_read`.

---

← Prev: [zlib — gzip and brotli](16-zlib.md) · Next → [stream/promises and compose](18-stream-promises-and-compose.md)
