---
title: "string_decoder"
sidebar_label: "05 · string_decoder"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Calling `chunk.toString()` on each chunk of a stream corrupts every multi-byte
character that lands on a chunk boundary. `StringDecoder` holds the incomplete
bytes back until the rest arrives.**

This is the bug that only appears in production, because your test fixture is
ASCII and small enough to arrive in one chunk.

## The corruption

```js
// corrupt.mjs
import { StringDecoder } from 'node:string_decoder';

const full = Buffer.from('héllo 世界');
const a = full.subarray(0, 2);      // splits 'é' (0xc3 0xa9) down the middle
const b = full.subarray(2);

console.log('naive   :', JSON.stringify(a.toString('utf8') + b.toString('utf8')));

const decoder = new StringDecoder('utf8');
console.log('decoder :', JSON.stringify(decoder.write(a) + decoder.write(b) + decoder.end()));
```

```console
$ node corrupt.mjs
naive   : "h��llo 世界"
decoder : "héllo 世界"
```

`é` is two bytes. The first chunk ends after the first of them. `toString()` on
each half sees an incomplete sequence, substitutes U+FFFD, and the character is
gone — permanently, because the replacement is not reversible.

Nothing throws. The data is simply wrong from that point on.

## What StringDecoder does

It buffers a **partial trailing sequence** and prepends it to the next write.

```js
// bytewise.mjs
import { StringDecoder } from 'node:string_decoder';

const emoji = Buffer.from('🎉');            // 4 bytes
console.log('bytes:', emoji.length);

const d = new StringDecoder('utf8');
let out = '';
for (const byte of emoji) out += d.write(Buffer.from([byte]));
console.log('one byte at a time:', JSON.stringify(out), '| end():', JSON.stringify(d.end()));

const d2 = new StringDecoder('utf8');
console.log('truncated input   :', JSON.stringify(d2.write(emoji.subarray(0, 2)) + d2.end()));
```

```console
$ node bytewise.mjs
bytes: 4
one byte at a time: "🎉" | end(): ""
truncated input   : "�"
```

Fed one byte at a time, the first three writes return `''` and the fourth
returns the whole emoji. `end()` flushes whatever is left — and if the stream
really did end mid-character, *that* is when you get the replacement character,
which is the correct place for it.

**`end()` is not optional.** Skip it and a trailing partial character is dropped
silently.

## Where you actually need it

Three situations, and only three:

1. **You are writing a Transform that emits strings** and cannot use
   `setEncoding`.
2. **You are decoding a byte stream by hand** — a socket, a child process's
   stdout, a WebSocket frame reassembler.
3. **You are chunking output** for SSE or a streamed LLM response and must not
   split a character across two SSE events.

```js
// transform.mjs — a Transform that emits correctly-decoded text
import { Transform, Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { pipeline } from 'node:stream/promises';

class Decode extends Transform {
  #decoder = new StringDecoder('utf8');
  constructor() { super({ readableObjectMode: true }); }
  _transform(chunk, enc, cb) { cb(null, this.#decoder.write(chunk)); }
  _flush(cb) { cb(null, this.#decoder.end()); }
}

const bytes = Buffer.from('héllo 世界');
const out = [];
await pipeline(
  Readable.from([bytes.subarray(0, 2), bytes.subarray(2, 9), bytes.subarray(9)]),
  new Decode(),
  async function* (s) { for await (const t of s) out.push(t); },
);
console.log(out, '->', JSON.stringify(out.join('')));
```

```console
$ node transform.mjs
[ 'h', 'éllo ', '世界', '' ] -> "héllo 世界"
```

The trailing `''` is `_flush` pushing the decoder's empty remainder — harmless
here, and the slot where a truncated character would have surfaced.

## The three ways to avoid needing it

Most application code should not touch `StringDecoder` at all.

```js
// alternatives.mjs
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { text } from 'node:stream/consumers';

// 1. setEncoding — the stream decodes for you, using a StringDecoder internally
const s1 = createReadStream('big.log', { end: 200 });
s1.setEncoding('utf8');
for await (const chunk of s1) { console.log('setEncoding  :', typeof chunk, JSON.stringify(chunk.slice(0, 24))); break; }

// 2. readline — line-oriented, boundary-safe
const rl = createInterface({ input: createReadStream('big.log'), crlfDelay: Infinity });
for await (const line of rl) { console.log('readline     :', JSON.stringify(line.slice(0, 24))); break; }
rl.close();

// 3. collect the whole thing (only when it is small)
console.log('consumers    :', JSON.stringify((await text(createReadStream('big.log', { end: 23 }))).slice(0, 24)));
```

```console
$ node alternatives.mjs
setEncoding  : string "2026-08-10T09:01:07.001Z"
readline     : "2026-08-10T09:01:07.001Z"
consumers    : "2026-08-10T09:01:07.001Z"
```

| Situation | Reach for |
|---|---|
| Reading text line by line | `readline` (or a line-splitting Transform) |
| Want string chunks from a stream | `stream.setEncoding('utf8')` |
| Whole thing fits in memory | `await text(stream)` from `stream/consumers` |
| Writing a Transform that emits text | `StringDecoder` |
| Manually reassembling a protocol | `StringDecoder` |

`setEncoding` uses a `StringDecoder` internally — that is the same fix, applied
for you. **The trade-off:** once a stream is in string mode you cannot get the
exact bytes back, and byte-based size limits become approximate. For anything
where bytes matter (hashing, size enforcement, binary passthrough), stay in
buffers and decode once at the end.

## The other boundary bug: splitting on a pattern

`StringDecoder` fixes *character* boundaries. It does nothing for *token*
boundaries. A regex applied per chunk still misses a match split across two
chunks:

```js
// naive per-chunk regex, both chunks decoded correctly
'user=ada token=tok_' + 'live_9f3a'
// .replace(/tok_live_\w+/g, '[REDACTED]') matches in neither chunk
```

The fix is a Transform that holds an incomplete tail — usually by splitting on
newlines and keeping the last partial line. That pattern is on
[page 13](13-transform-streams.md).

## Gotchas

**Symptom:** `�` appears at random positions in stored text, only for non-English content
**Cause:** Per-chunk `toString()` split a multi-byte character.
**Fix:** `setEncoding('utf8')`, `readline`, or a `StringDecoder`.

**Symptom:** Works locally with a 2 KB fixture, breaks on a 5 MB upload
**Cause:** Small inputs arrive in one chunk, so no boundary exists to split.
**Fix:** Test with a fixture larger than the high water mark (64 KB), or feed the
stream byte by byte in a test.

**Symptom:** The last character of a file is missing
**Cause:** `decoder.end()` was never called.
**Fix:** Call it in `_flush`, or on `'end'`.

**Symptom:** Size limit lets through more bytes than configured
**Cause:** Counting `chunk.length` after `setEncoding` — that is characters now,
not bytes.
**Fix:** Enforce limits before decoding, on the buffers.

**Symptom:** A base64 stream decodes to garbage
**Cause:** `StringDecoder` supports `utf8`, `utf16le`, `latin1` and `base64`, but
base64 alignment is 3 bytes, not 1 — a decoder per chunk without one shared
instance mis-aligns.
**Fix:** Use one `StringDecoder` instance for the whole stream, never one per
chunk.

**Symptom:** SSE clients render `?` mid-word on streamed AI output
**Cause:** A chunk boundary split a multi-byte character inside a `data:` frame.
**Fix:** Decode with a single `StringDecoder` before framing.

## Interview questions

**★ Why does `chunk.toString()` inside a stream handler corrupt data?**
Chunk boundaries fall on byte offsets, not character boundaries. A UTF-8
character is 1–4 bytes, so a chunk can end mid-character; decoding each chunk
independently substitutes U+FFFD for both halves and the character is lost
irreversibly.

**★ What does `StringDecoder` do about it?**
It retains the trailing incomplete byte sequence and prepends it to the next
`write()`. Complete characters are returned immediately, partial ones held.
`end()` flushes the remainder, emitting a replacement character only if the input
genuinely ended mid-sequence.

**★ Why does the bug never show up in tests?**
Test fixtures are usually ASCII (no multi-byte characters) and smaller than one
chunk (64 KB), so no boundary is crossed. It appears with real user content in
production.

**★ What is the simpler alternative in application code?**
`stream.setEncoding('utf8')` — it installs a `StringDecoder` internally — or
`readline` for line-oriented text. Only reach for `StringDecoder` directly when
writing a Transform or reassembling a protocol by hand.

**Does `StringDecoder` also fix a regex that spans two chunks?**
No. It fixes character boundaries only. A token split across chunks needs a
Transform that buffers an incomplete tail, typically by splitting on newlines.

**What breaks if you forget `end()`?**
Any trailing partial sequence is dropped silently — the last character of the
stream disappears.

---

← Prev: [Buffer is a Uint8Array](04-buffer-as-uint8array.md) · Next → [Binary data and endianness](06-binary-data-and-endianness.md)
