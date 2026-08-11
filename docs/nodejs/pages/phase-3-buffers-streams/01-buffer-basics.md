---
title: "Buffer basics"
sidebar_label: "01 · Buffer basics"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A `Buffer` is a fixed-length chunk of raw bytes living outside the V8 heap. It
is what every byte that crosses your process boundary — file, socket, hash,
upload — actually is before you decide to call it text.**

JavaScript strings are UTF-16 sequences of code units. The network and the disk
deal in bytes. `Buffer` is the type that sits between them, and the whole of Node
I/O hands you one.

## Creating a Buffer

Three constructors, and you will use all three.

```js
// buffer-create.mjs
const fromString = Buffer.from('héllo');            // encode text to bytes (utf8 default)
const fromArray  = Buffer.from([0x68, 0x69]);       // exact bytes
const zeroed     = Buffer.alloc(4);                 // 4 zero bytes, safe
const filled     = Buffer.alloc(4, 0x61);           // 4 bytes of 'a'

console.log(fromString, fromArray, zeroed, filled);
console.log(fromString.length, 'bytes for', 'héllo'.length, 'characters');
```

```console
$ node buffer-create.mjs
<Buffer 68 c3 a9 6c 6c 6f> <Buffer 68 69> <Buffer 00 00 00 00> <Buffer 61 61 61 61>
6 bytes for 5 characters
```

**`.length` is bytes, never characters.** `é` costs two bytes in UTF-8, so a
five-character string is a six-byte buffer. Use `Buffer.byteLength(str)` when you
need the size *before* allocating — that is the number a `Content-Length` header
wants, and the number a size limit must be compared against.

```js
Buffer.byteLength('héllo');           // 6
'héllo'.length;                        // 5  ← wrong for any byte budget
```

`new Buffer()` is <strong>⚠ Deprecated</strong> (DEP0005) and unsafe — it changed
behaviour based on argument type. Never write it; `Buffer.from` / `Buffer.alloc`
replaced it in Node 4.5.

## Reading and converting

```js
// buffer-read.mjs
const buf = Buffer.from('héllo');

console.log(buf[0]);                    // 104   — a plain byte, 0-255
console.log(buf.toString());            // héllo — utf8 by default
console.log(buf.toString('hex'));       // 68c3a96c6c6f
console.log(buf.toString('utf8', 0, 1));// h     — decode a byte range
console.log(buf.indexOf('llo'));        // 3     — byte offset, not char offset
console.log(buf.includes('é'));         // true
console.log(JSON.stringify(Buffer.from('hi')));
```

```console
$ node buffer-read.mjs
104
héllo
68c3a96c6c6f
h
3
true
{"type":"Buffer","data":[104,105]}
```

That last line is the one that bites: **`JSON.stringify` on a Buffer produces
`{"type":"Buffer","data":[...]}`**, not a string. Ship a buffer inside an API
response body without converting it and the client receives an array of 4 000
integers. Convert explicitly — `buf.toString('base64')` for binary, `.toString()`
for text.

## Slicing shares memory

```js
// buffer-slice.mjs
const original = Buffer.from('hello');
const view = original.subarray(0, 2);   // NO copy — a window onto the same bytes

view[0] = 0x48;                          // write 'H' through the view
console.log(original.toString());        // Hello  ← the original changed

const copy = Buffer.from(original.subarray(0, 2));  // explicit copy
copy[0] = 0x58;
console.log(original.toString(), copy.toString());
```

```console
$ node buffer-slice.mjs
Hello
Hello He
```

`subarray` (and its older alias `slice`) return a **view**, not a copy. This is a
feature: parsing a 10 MB frame into thirty fields costs nothing. It is also the
single most common Buffer bug — hand a caller a `subarray` of your read buffer,
reuse that read buffer for the next chunk, and their data silently mutates.

**Rule: return a `subarray` for something you read immediately, a copy for
anything you store.**

`Buffer.prototype.slice` behaves like `subarray` (shares memory), unlike
`Array.prototype.slice` and `Uint8Array.prototype.slice`, which copy. It is
documented as deprecated in favour of `subarray`; it prints no runtime warning on
24.19.0, so linting is your only guard. Prefer `subarray` everywhere.

## Joining, comparing, copying

```js
// buffer-ops.mjs
const parts = [Buffer.from('ab'), Buffer.from('cd')];
console.log(Buffer.concat(parts).toString());          // abcd
console.log(Buffer.concat(parts, 3).toString());       // abc  — totalLength truncates

console.log(Buffer.from('ab').equals(Buffer.from('ab')));   // true   (value equality)
console.log(Buffer.from('ab') === Buffer.from('ab'));       // false  (object identity)
console.log(Buffer.compare(Buffer.from('a'), Buffer.from('b')));  // -1  → sortable

const target = Buffer.alloc(5, 0x2e);                  // '.....'
Buffer.from('ab').copy(target, 1);                     // write into an existing buffer
console.log(target.toString());                        // .ab..
```

```console
$ node buffer-ops.mjs
abcd
abc
true
false
-1
.ab..
```

Pass `totalLength` to `Buffer.concat` whenever you know it. Without it, Node walks
the array twice to sum the lengths. With a size limit already enforced upstream you
know the number anyway.

**Never compare secrets with `equals`** — it short-circuits on the first differing
byte, which is a timing oracle. Use `crypto.timingSafeEqual` for tokens, HMACs and
password hashes (Phase 8 covers this properly).

## Where buffers show up in a fullstack app

| Situation | What you get |
|---|---|
| `fs.readFile(path)` with no encoding | `Buffer` |
| `req` body chunks on an HTTP server | `Buffer` per chunk |
| `crypto.randomBytes(32)` | `Buffer` |
| `createHash('sha256').digest()` | `Buffer` |
| A `multipart/form-data` file part | `Buffer` |
| `await response.arrayBuffer()` from `fetch` | `ArrayBuffer` → wrap with `Buffer.from` |
| A `bytea` column from PostgreSQL (`pg`) | `Buffer` |
| A MongoDB `BinData` field | `Buffer` (via `Binary`) |

Collecting a request body is the canonical use, and the canonical mistake:

```js
// collect-body.mjs — the shape you will write a hundred times
const LIMIT = 1024 * 1024;               // 1 MB

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMIT) {
      req.destroy();
      throw Object.assign(new Error('payload too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);    // one allocation, exact size
}
```

Concatenating with `body += chunk` instead would decode each chunk to a string
separately — corrupting any multi-byte character that straddles a chunk boundary.
That is [page 05](05-string-decoder.md), and it is why the loop above collects
buffers and joins once.

## Gotchas

**Symptom:** `Content-Length` is wrong and the client hangs or truncates
**Cause:** Used `str.length` (UTF-16 code units) instead of the byte count.
**Fix:** `Buffer.byteLength(str)`. Any non-ASCII character makes them differ.

**Symptom:** A size limit lets through payloads twice the size you set
**Cause:** Counting characters, not bytes. One emoji is four bytes.
**Fix:** Sum `chunk.length` on the buffers, as the example above does.

**Symptom:** JSON response contains `{"type":"Buffer","data":[72,105]}`
**Cause:** A Buffer was serialized directly.
**Fix:** `buf.toString('base64')` (binary) or `buf.toString('utf8')` (text)
before it reaches `res.json`.

**Symptom:** Data mutates under a consumer that never wrote to it
**Cause:** You handed out a `subarray`/`slice` of a buffer you later reused.
**Fix:** Copy with `Buffer.from(view)` for anything you retain, or allocate a
fresh buffer per read.

**Symptom:** `Buffer.alloc(n)` throws `ERR_OUT_OF_RANGE` — *the value of `size`
is out of range, it must be `>= 0` and `<= 9007199254740991`*
**Cause:** `n` is negative, `NaN`, or above the maximum. On 64-bit Node 24 the
cap is `buffer.constants.MAX_LENGTH` = 2^53−1, but you will hit real memory long
before that.
**Fix:** Validate `n` before allocating — it usually comes from a client-supplied
length field.

**Symptom:** `buf[0] = 300` silently stores `44`
**Cause:** Bytes wrap modulo 256; index assignment does not throw.
**Fix:** Use `buf.writeUInt8(value, 0)`, which throws `ERR_OUT_OF_RANGE`
(see [page 06](06-binary-data-and-endianness.md)).

**Symptom:** Reading `buf[10]` on a 4-byte buffer gives `undefined` instead of throwing
**Cause:** Index access is a plain TypedArray read; out of range is `undefined`.
**Fix:** Check `buf.length` first, or use `buf.readUInt8(10)`, which throws
`ERR_OUT_OF_RANGE` instead of quietly returning nothing.

## Interview questions

**★ What is a Buffer and why does Node need one?**
A fixed-length region of raw bytes allocated outside the V8 heap. JavaScript
strings are UTF-16 text; files, sockets and crypto operate on bytes. Buffer is the
byte type that lets Node do I/O without forcing every byte through a string
conversion — and without the V8 heap size limit applying to it.

**★ Why does `'héllo'.length` differ from `Buffer.from('héllo').length`?**
The string length counts UTF-16 code units (5). The buffer length counts UTF-8
bytes (6), because `é` encodes as two bytes. Any size limit, `Content-Length`, or
storage budget must use the byte count.

**★ Does `subarray` copy?**
No. It returns a view over the same memory, so writes through it are visible in
the original. `Uint8Array.prototype.slice` copies; `Buffer.prototype.slice` does
not — it is an alias for `subarray`, which is exactly the inconsistency that
causes the bug. Copy explicitly with `Buffer.from(view)` when you retain the data.

**★ How do you collect an HTTP request body safely?**
Push each chunk into an array while summing lengths, reject past a limit, then
`Buffer.concat(chunks, size)` once. Never string-concatenate chunks — a multi-byte
character split across two chunks decodes to replacement characters.

**Why is `Buffer.concat(parts, totalLength)` better than `Buffer.concat(parts)`?**
Without the length Node iterates the array once to sum sizes and again to copy.
If you already tracked the total while reading — which a size limit forces you to
do — passing it removes a pass.

**Why not use `buf.equals()` to compare an API token?**
It returns on the first differing byte, so comparison time leaks how much of the
prefix matched. Use `crypto.timingSafeEqual`, which is constant-time for equal
lengths.

---

← Phase index: [Buffers and streams](README.md) · Next → [Encodings](02-encodings.md)
