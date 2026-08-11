---
title: "stream/promises, consumers and compose"
sidebar_label: "18 · promises & compose"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Three small modules remove most of the ceremony around streams:
`stream/promises` (await a pipeline), `stream/consumers` (collect one), and
`compose()` (glue several stages into one reusable stream).**

## `stream/promises` — two functions

```js
import { pipeline, finished } from 'node:stream/promises';
```

`pipeline` is [page 10](10-pipeline.md). `finished` is the other half: one
promise for "this stream is over, however it ended".

```js
// finished.mjs
import { createReadStream } from 'node:fs';
import { finished } from 'node:stream/promises';

const rs = createReadStream('big.log', { end: 100 });
rs.resume();                              // consume it, otherwise it never ends
await finished(rs);
console.log('finished() resolved; destroyed:', rs.destroyed);

try { await finished(createReadStream('nope')); }
catch (err) { console.log('finished() rejected with', err.code); }
```

```console
$ node finished.mjs
finished() resolved; destroyed: true
finished() rejected with ENOENT
```

`finished` collapses `'end'`, `'finish'`, `'error'` and `'close'` into one
awaitable, which is exactly what you want for cleanup: it fires on every path,
unlike `'end'`. Use it when you hand a stream to something else (`res`,
a library) and need to know when it is safe to release a resource.

`finished` also accepts `{ signal }` for cancellation, and `{ cleanup: true }`
to remove its listeners when it settles — worth setting if you call it in a loop
over long-lived streams, otherwise the listeners accumulate.

## `stream/consumers` — collect a whole stream

```js
// consumers.mjs
import { Readable } from 'node:stream';
import { text, json, buffer } from 'node:stream/consumers';

console.log('text  :', JSON.stringify(await text(Readable.from(['a', 'b']))));
console.log('json  :', await json(Readable.from(['{"ok":', 'true}'])));
console.log('buffer:', (await buffer(Readable.from([Buffer.from('hi')]))).toString());
```

```console
$ node consumers.mjs
text  : "ab"
json  : { ok: true }
buffer: hi
```

Five functions: `text`, `json`, `buffer`, `arrayBuffer`, `blob`. They accept Node
streams, web streams and async iterables alike, which makes them the one-liner
for "read this request body".

**They impose no size limit.** `await json(req)` on an unbounded request body is
a memory-exhaustion DoS. Size-limit first ([page 01](01-buffer-basics.md)), then
collect. And `text` handles multi-byte boundaries correctly, so it is also the
short answer to [page 05](05-string-decoder.md) when the data is small.

## `compose()` — several stages, one stream

```js
// compose.mjs
import { Readable, compose, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const trim = new Transform({ objectMode: true, transform(l, e, cb) { cb(null, String(l).trim()); } });
const nonEmpty = new Transform({ objectMode: true, transform(l, e, cb) { cb(null, l ? l : null); } });

const clean = compose(trim, nonEmpty);              // one Duplex, reusable

const out = [];
await pipeline(Readable.from(['  a  ', '   ', 'b']), clean, async function* (s) { for await (const v of s) out.push(v); });
console.log('compose ->', out);

const doubled = compose(async function* (source) { for await (const n of source) yield n * 2; });
const out2 = [];
await pipeline(Readable.from([1, 2, 3]), doubled, async function* (s) { for await (const v of s) out2.push(v); });
console.log('compose(async gen) ->', out2);
```

```console
$ node compose.mjs
compose -> [ 'a', 'b' ]
compose(async gen) -> [ 2, 4, 6 ]
```

`compose(...stages)` returns a single Duplex whose writable side is the first
stage and whose readable side is the last. It accepts Transforms, async
generators, async functions and even web `TransformStream`s.

Why it matters: **it lets you ship a multi-stage pipeline as one value.** A
`parseNdjson()` helper that is really "split lines → JSON.parse → validate"
becomes one stream that callers drop into their own `pipeline`, instead of three
they have to wire in the right order.

```js
// reusable.mjs — a library-shaped export
import { compose, Transform } from 'node:stream';

export function parseNdjson() {
  const split = new Transform({
    readableObjectMode: true,
    construct(cb) { this.tail = ''; cb(); },
    transform(chunk, e, cb) {
      const lines = (this.tail + chunk).split('\n');
      this.tail = lines.pop();
      for (const l of lines) if (l.trim()) this.push(l);
      cb();
    },
    flush(cb) { if (this.tail.trim()) this.push(this.tail); cb(); },
  });
  const parse = new Transform({ objectMode: true, transform(l, e, cb) {
    try { cb(null, JSON.parse(l)); } catch (err) { cb(new Error(`bad JSON: ${l.slice(0, 40)}`, { cause: err })); }
  } });
  return compose(split, parse);
}
```

`compose` is **Stability 1 – Experimental** in the Node 24 docs. It has been
stable in practice since v16, but that marker is a real risk for a published
library — pin your Node range or wrap it.

## `Readable.from` and the iterator helpers

```js
// from.mjs
import { Readable } from 'node:stream';

console.log(await Readable.from([1, 2, 3]).map((n) => n * 2).toArray());
console.log(await Readable.from('abc').toArray());       // special-cased: one chunk, not one per char
```

```console
$ node from.mjs
[ 2, 4, 6 ]
[ 'abc' ]
```

That second line is worth checking rather than assuming: strings are iterable, so
`Readable.from` "should" emit one chunk per character, and plenty of older
answers say it does. **Node special-cases strings and Buffers and emits them
whole** — verified on 24.19.0. Other iterables (a `Set`, a generator) do get one
chunk per item.

The helpers (`map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray`,
`some`, `every`, `find`, `forEach`) are the **Iterable Streams API** the syllabus
names, also **Stability 1 – Experimental**. `map` and `filter` take
`{ concurrency }`, which is the neatest bounded-parallel primitive in the
standard library:

```js
const enriched = await Readable.from(ids)
  .map(async (id) => fetchUser(id), { concurrency: 5 })   // at most 5 in flight
  .toArray();
```

## What to reach for

| Task | Use |
|---|---|
| Await a whole pipeline | `pipeline` from `stream/promises` |
| Know when one stream is done, however it ended | `finished` |
| Read a small, already-limited body | `text` / `json` / `buffer` |
| Ship a multi-stage transform as one value | `compose` |
| Turn an iterable/generator into a stream | `Readable.from` |
| Bounded parallel work over a stream | `.map(fn, { concurrency })` |

## Gotchas

**Symptom:** `finished()` never resolves
**Cause:** Nobody consumed the readable, so it never ends.
**Fix:** Consume, `resume()`, or `destroy()` it.

**Symptom:** Listener accumulation warnings around `finished`
**Cause:** Called repeatedly on long-lived streams without cleanup.
**Fix:** `finished(stream, { cleanup: true })`.

**Symptom:** OOM on a large request body
**Cause:** `await json(req)` with no size limit.
**Fix:** Enforce the limit while reading, then collect.

**Symptom:** `Readable.from(someSet)` emits one chunk per element into a byte
stream and throws `ERR_INVALID_ARG_TYPE`
**Cause:** Non-string, non-Buffer iterables are iterated element by element, and
`Readable.from` defaults to object mode — piping that into a byte sink fails.
**Fix:** Convert elements to Buffers/strings, or keep the whole pipeline in
object mode.

**Symptom:** A composed stream swallows errors
**Cause:** `compose` returns a Duplex — if you never pipeline it or attach an
`'error'` handler, the error has nowhere to go.
**Fix:** Always consume it through `pipeline`.

**Symptom:** A library using `compose` or `.map()` breaks on a Node upgrade
**Cause:** Both are Stability 1 – Experimental.
**Fix:** Pin the supported Node range, or implement the stage by hand in
published packages.

## Interview questions

**★ What does `stream.finished()` give you that listening for `'end'` does not?**
It resolves or rejects for every termination path — `'end'`, `'finish'`,
`'error'`, `'close'` — so cleanup runs whether the stream succeeded or failed.
`'end'` never fires on an errored stream.

**★ What is `compose()` for?**
It glues several stages into a single Duplex whose writable side is the first
stage and readable side is the last, so a multi-stage pipeline can be exported
and reused as one value. It is still marked experimental.

**★ What is the risk of `stream/consumers`?**
No size limit. `await json(req)` will happily buffer a 2 GB body. Enforce the
limit while reading and only then collect.

**★ How do you run bounded-concurrency work over a stream?**
`readable.map(fn, { concurrency: n })`, which keeps at most `n` in flight while
preserving order. It is part of the experimental iterator helpers, so pin your
Node range in a library.

**Does `Readable.from('abc')` emit one chunk or three?**
One — Node special-cases strings and Buffers rather than iterating them
character by character. Other iterables are iterated per element.

---

← Prev: [Custom Readable and Writable](17-custom-readable-writable.md) · Next → [High water marks and tuning](19-highwatermark-tuning.md)
