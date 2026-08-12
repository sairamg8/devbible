---
title: "Encodings, async work and the alternatives"
sidebar_label: "02 · Encodings and async"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Chapter 2 of [Transform streams](README.md).** What arrives at `_transform` and
in what type, how to do async work without scrambling order, and when not to write
a class at all.


## `decodeStrings` and encodings

By default a Transform converts string input to Buffers before `_transform` sees
it. Two options change that:

| Option | Effect |
|---|---|
| `decodeStrings: false` | Strings arrive as strings, not Buffers |
| `encoding: 'utf8'` | The readable side emits strings |
| `objectMode: true` | Both sides pass arbitrary values (see [page 14](../14-object-mode.md)) |
| `readableObjectMode` / `writableObjectMode` | Object mode on one side only |

`readableObjectMode: true` with a byte writable side — as in `SplitLines` above —
is the standard "bytes in, records out" shape.

For text specifically, remember that chunk boundaries also split **characters**,
not just lines. If your transform decodes bytes to text itself, it needs a
`StringDecoder` ([page 05](../05-string-decoder.md)); the `SplitLines` example gets
away with implicit `String(chunk)` only because the tail concatenation happens to
re-join split characters on the next chunk — which is *not* true if a multi-byte
character is split and the transform pushes the tail in `_flush`. Use a
`StringDecoder` when the input can be non-ASCII.

## Async work inside a transform

`_transform` may be an async function, or you can call the callback from a
promise:

```js
// async-transform.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const enrich = new Transform({
  objectMode: true,
  async transform(id, encoding, callback) {
    try {
      await sleep(10);                          // a DB lookup, an API call
      callback(null, { id, name: `user-${id}` });
    } catch (err) {
      callback(err);
    }
  },
});

const out = [];
const t = Date.now();
await pipeline(Readable.from([1, 2, 3]), enrich, async function* (s) { for await (const v of s) out.push(v); });
console.log(out, Date.now() - t, 'ms — strictly sequential');
```

```console
$ node async-transform.mjs
[
  { id: 1, name: 'user-1' },
  { id: 2, name: 'user-2' },
  { id: 3, name: 'user-3' }
] 39 ms — strictly sequential
```

**A Transform processes one chunk at a time.** That is a guarantee (order is
preserved) and a limit (no parallelism). For concurrent per-item work, use
`readable.map(fn, { concurrency: 5 })` or a bounded pool
([Phase 2, concurrency control](../../phase-2-async/14-concurrency-control.md)) —
not a hand-rolled queue inside `_transform`.

## Often you do not need a class at all

```js
// generator-stage.mjs
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const out = [];
await pipeline(
  Readable.from(['a', 'b', 'c']),
  async function* upper(source) { for await (const c of source) yield c.toUpperCase(); },
  async function* exclaim(source) { for await (const c of source) yield c + '!'; },
  async function collect(source) { for await (const c of source) out.push(c); },
);
console.log(out);
```

```console
$ node generator-stage.mjs
[ 'A!', 'B!', 'C!' ]
```

An async generator stage gives you the same backpressure and error propagation
with no `_transform`/`callback` contract to get wrong. **Write a Transform class
when you need to reuse it as an object** (pass it around, `compose()` it, unit
test it in isolation) or when you need `_writev`, `_destroy` or custom high water
marks. Otherwise use a generator.
## Gotchas

**Symptom:** Output order is scrambled
**Cause:** Fired async work without awaiting it before calling `callback`.
**Fix:** Await inside `_transform`; a Transform is sequential by design.

**Symptom:** `_transform` receives Buffers when you expected strings
**Cause:** The default `decodeStrings: true`.
**Fix:** Pass `decodeStrings: false`, or call `.toString()` — with a
`StringDecoder` if the data can be multi-byte.

**Symptom:** Multi-byte characters come out mangled
**Cause:** `chunk.toString()` on a chunk that ends mid-character.
**Fix:** A `StringDecoder`, which holds the partial sequence until the rest
arrives — the same class of boundary bug as chapter 1, at the byte level.

**Symptom:** A Transform is slow despite doing little work
**Cause:** One await per chunk, serialised by design, on a stream of tiny chunks.
**Fix:** Batch before the async stage, or move concurrency upstream with
`readable.map(fn, { concurrency })`.

## Interview questions

**★ Can a Transform process chunks concurrently?**
No. It handles one at a time, which preserves order. For concurrency use
`readable.map(fn, { concurrency })` or a bounded pool upstream.

**★ What does `decodeStrings: false` change?**
By default a Writable/Transform converts written strings to Buffers before
`_transform` sees them. `decodeStrings: false` passes the original string
through, which avoids a needless round trip when the stage is text-only.

**When would you write a Transform class instead of an async generator stage?**
When you need it as a reusable object — composed, passed around, unit tested —
or when you need `_writev`, `_destroy`, or per-stream high water marks.
Otherwise the generator is less code and fewer contracts to break.

**Why is `StringDecoder` needed if you already framed the data?**
Framing solves *record* boundaries; `StringDecoder` solves *character*
boundaries. A UTF-8 character can be split across chunks just as a line can, and
`toString()` on the fragment produces a replacement character rather than
waiting.

---

← [Writing a Transform, and the boundary problem](01-transform-and-boundaries.md) · Next → [Object mode](../14-object-mode.md)
