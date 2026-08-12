---
title: "Writing a Transform, and the boundary problem"
sidebar_label: "01 · Transform and boundaries"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Chapter 1 of [Transform streams](README.md).** The two methods that make a
Transform, and the one problem that makes writing them harder than it looks:
chunk boundaries do not respect your data's structure.


## The minimal Transform

```js
// upper.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const upper = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());   // (error, output)
  },
});

let out = '';
await pipeline(Readable.from(['hello ', 'world']), upper, async function* (s) { for await (const c of s) out += c; });
console.log(out);
```

```console
$ node upper.mjs
HELLO WORLD
```

The signature contract:

- **`callback(null, value)`** emits one chunk. **`this.push(value)`** emits as
  many as you like; then call `callback()` with no value.
- **`callback(err)`** fails the stream — the error reaches `pipeline`'s catch.
- **Call it exactly once, on every path.** Never calling it hangs the pipeline
  silently; calling it twice throws `ERR_MULTIPLE_CALLBACK`.
- **Emit nothing** by calling `callback()` with no arguments — that is how you
  filter.
- **`_flush(callback)`** runs after the input ends, before `'end'` is emitted
  downstream. It is where buffered state gets emitted.

```js
// filter-expand.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const evens = new Transform({ objectMode: true, transform(n, e, cb) { cb(null, n % 2 === 0 ? n : null); } });
const pairs = new Transform({ objectMode: true, transform(n, e, cb) { this.push(n); this.push(n * 10); cb(); } });

const out = [];
await pipeline(Readable.from([1, 2, 3, 4]), evens, pairs, async function* (s) { for await (const v of s) out.push(v); });
console.log(out);
```

```console
$ node filter-expand.mjs
[ 2, 20, 4, 40 ]
```

One in, zero out (filter). One in, many out (expand). Both are ordinary
Transforms.

## The boundary problem, and the fix

The naive Transform applies its logic per chunk, and chunks split your data
wherever the 64 KB mark happens to land.

```js
// naive.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const naive = new Transform({
  transform(c, e, cb) { cb(null, String(c).replace(/tok_live_\w+/g, 'tok_live_[REDACTED]')); },
});

let bad = '';
await pipeline(
  Readable.from([Buffer.from('user=ada token=tok_'), Buffer.from('live_9f3a\n')]),
  naive,
  async function* (s) { for await (const c of s) bad += c; },
);
console.log('naive per-chunk regex ->', JSON.stringify(bad));
```

```console
$ node naive.mjs
naive per-chunk regex -> "user=ada token=tok_live_9f3a\n"
```

**The secret was not redacted.** The token straddled the chunk boundary, so it
matched in neither chunk. In production this is a compliance incident that passes
every unit test, because unit tests feed the transform one chunk.

The fix is to hold back the incomplete tail. For line-oriented data — which
covers logs, CSV, NDJSON and most text protocols — the tail is "everything after
the last newline":

```js
// split-lines.mjs
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Bytes in, one complete line out per push. The trailing partial line is held. */
class SplitLines extends Transform {
  #tail = '';
  constructor() { super({ readableObjectMode: true }); }
  _transform(chunk, encoding, callback) {
    const lines = (this.#tail + chunk).split('\n');
    this.#tail = lines.pop();                 // last element is incomplete (or '')
    for (const line of lines) this.push(line);
    callback();
  }
  _flush(callback) {                          // input ended: emit what is left
    if (this.#tail) this.push(this.#tail);
    callback();
  }
}

const redact = new Transform({
  objectMode: true,
  transform(line, enc, cb) { cb(null, line.replace(/tok_live_\w+/g, 'tok_live_[REDACTED]')); },
});

const out = [];
await pipeline(
  Readable.from([
    Buffer.from('user=ada token=tok_'),
    Buffer.from('live_9f3a\nuser=bob token=tok_live_c'),
    Buffer.from('44d\nuser=eve'),
  ]),
  new SplitLines(),
  redact,
  async function* (s) { for await (const l of s) out.push(l); },
);
console.log(out);
```

```console
$ node split-lines.mjs
[
  'user=ada token=tok_live_[REDACTED]',
  'user=bob token=tok_live_[REDACTED]',
  'user=eve'
]
```

Note the third line: `user=eve` had no trailing newline and was emitted by
`_flush`. **Forgetting `_flush` silently drops the last record of every file that
does not end in a newline** — and plenty do not.

This two-stage split is the shape to reach for generally: **one stage that
re-frames the bytes into records, then stages that work on whole records.** Once
the framing is right, every downstream transform is trivially correct.
## Gotchas

**Symptom:** A pattern is not matched even though it is clearly in the data
**Cause:** It spanned a chunk boundary; each chunk was searched separately.
**Fix:** Re-frame first (split into records), then match per record.

**Symptom:** The last record of a file is missing
**Cause:** No `_flush`, so the buffered tail was dropped. Files without a
trailing newline hit this every time.
**Fix:** Emit the remainder in `_flush`.

**Symptom:** The pipeline hangs with no error
**Cause:** `callback` was not called on some path.
**Fix:** One call per invocation, every branch. Prefer an async `_transform`,
where a thrown error becomes a rejection.

**Symptom:** `ERR_MULTIPLE_CALLBACK`
**Cause:** Called `callback` twice — commonly a success path that also runs after
an error path.
**Fix:** `return callback(err)`.

**Symptom:** Memory grows inside a Transform
**Cause:** Buffering unbounded state — accumulating all rows to sort, or a tail
that never gets flushed because the delimiter never appears.
**Fix:** Cap the buffered tail and error out past a maximum record size; a 1 GB
"line" is malformed input, not data.

## Interview questions

**★ What are `_transform` and `_flush` for?**
`_transform(chunk, encoding, callback)` handles each incoming chunk and emits
zero or more outputs. `_flush(callback)` runs once after the input ends and
before the stream finishes — it is where buffered state, such as a trailing
partial line, gets emitted.

**★ Why does a regex inside a Transform miss matches?**
Chunks are byte-count-driven, so a token can straddle two chunks and match in
neither. Verified: a `tok_live_…` secret split across two chunks was not
redacted. The fix is a framing stage that emits complete records first.

**★ What happens if `callback` is never called?**
The stream stalls forever — no error, no timeout. It is the classic custom-stream
bug and it usually hides on an error branch.

**How do you emit several chunks from one input chunk?**
`this.push(value)` as many times as needed, then `callback()` with no value.
`callback(null, value)` is shorthand for exactly one output.

---

← [Topic index](README.md) · Next → [Encodings, async work and the alternatives](02-encodings-and-async.md)
