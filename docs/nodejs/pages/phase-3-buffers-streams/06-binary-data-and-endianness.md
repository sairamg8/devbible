---
title: "Binary data and endianness"
sidebar_label: "06 · Binary data, endianness"
sidebar_position: 6
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Reading a number out of bytes requires agreeing on byte order. Get it wrong and
`0x1234` reads back as `0x3412` — a valid number, no error, wrong answer.**

Skip this page until a project hands you a binary format: a wire protocol, a
file header, a PostgreSQL `bytea` column with packed fields, a WebSocket frame,
an image's magic bytes.

## Reading and writing typed values

```js
// typed.mjs
const buf = Buffer.alloc(8);
buf.writeUInt16BE(0x1234, 0);      // big-endian at offset 0
buf.writeUInt16LE(0x1234, 2);      // little-endian at offset 2

console.log('hex        ', buf.toString('hex'));
console.log('BE read    ', buf.readUInt16BE(0).toString(16));
console.log('LE read    ', buf.readUInt16LE(2).toString(16));
console.log('BE bytes read as LE:', buf.readUInt16LE(0).toString(16));
```

```console
$ node typed.mjs
hex         1234341200000000
BE read     1234
LE read     1234
BE bytes read as LE: 3412
```

The same two bytes, `12 34`, are `0x1234` big-endian and `0x3412` little-endian.
That is the entire concept: **BE stores the most significant byte first, LE the
least significant first.**

The method family is uniform — `read`/`write`, then the type, then `BE`/`LE`:

| Type | Methods | Range |
|---|---|---|
| 8-bit | `readUInt8` / `readInt8` (no suffix — one byte has no order) | 0–255 / −128–127 |
| 16-bit | `readUInt16BE/LE`, `readInt16BE/LE` | 0–65535 / ±32k |
| 32-bit | `readUInt32BE/LE`, `readInt32BE/LE` | 0–4294967295 |
| 64-bit | `readBigUInt64BE/LE`, `readBigInt64BE/LE` | BigInt |
| Float | `readFloatBE/LE` (4 bytes), `readDoubleBE/LE` (8) | IEEE 754 |
| Variable | `readUIntBE/LE(offset, byteLength)` up to 6 bytes | for 24/40/48-bit fields |

```js
// signed.mjs
const i = Buffer.alloc(4);
i.writeInt32BE(-2);
console.log('int32BE -2      ', i.toString('hex'));
console.log('read as unsigned', i.readUInt32BE(0));

const big = Buffer.alloc(8);
big.writeBigUInt64BE(2n ** 63n);
console.log('bigint          ', big.toString('hex'), big.readBigUInt64BE(0));

const f = Buffer.alloc(8);
f.writeDoubleBE(1.5);
console.log('double 1.5      ', f.toString('hex'));
```

```console
$ node signed.mjs
int32BE -2       fffffffe
read as unsigned 4294967294
bigint           8000000000000000 9223372036854775808n
double 1.5       3ff8000000000000
```

**Signedness is a read-time decision, not a property of the bytes.** `fffffffe`
is −2 or 4 294 967 294 depending on which method you call. Anything above
2^53 must go through the `BigInt` variants — a JS number cannot hold a 64-bit
integer exactly, which is why database IDs and Snowflake IDs are read with
`readBigInt64BE`.

## Which order does the wire use?

| Context | Order |
|---|---|
| **Network protocols** — TCP/IP, DNS, TLS, HTTP/2, WebSocket frames | **Big-endian** ("network byte order") |
| **x86 / ARM memory**, most binary file formats, protobuf, MessagePack | Little-endian |
| PNG, JPEG, Java class files, PostgreSQL wire protocol | Big-endian |
| ZIP, BMP, WAV, sqlite (mixed) | Little-endian |

```js
import { endianness } from 'node:os';
console.log(endianness());   // 'LE' on x86-64 and Apple Silicon
```

`os.endianness()` tells you the *host's* order. It is almost never what you
should branch on — the format defines the order, not your CPU. Hard-code the
format's choice; portability comes from being explicit.

## Bounds checking is real

```js
// bounds.mjs
try { Buffer.alloc(2).writeUInt32BE(1, 0); } catch (e) { console.log('too small ->', e.code, '|', e.message); }
try { Buffer.alloc(4).writeUInt8(256, 0); }  catch (e) { console.log('bad value ->', e.code, '|', e.message); }
try { Buffer.alloc(2).readUInt32BE(0); }     catch (e) { console.log('read past ->', e.code); }

const b = Buffer.alloc(1);
b[0] = 256;                       // index assignment does NOT check
console.log('index assign 256 ->', b[0]);
```

```console
$ node bounds.mjs
too small -> ERR_BUFFER_OUT_OF_BOUNDS | Attempt to access memory outside buffer bounds
bad value -> ERR_OUT_OF_RANGE | The value of "value" is out of range. It must be >= 0 and <= 255. Received 256
read past -> ERR_BUFFER_OUT_OF_BOUNDS
index assign 256 -> 0
```

The `read*`/`write*` methods validate; **`buf[i] = value` does not** — it wraps
modulo 256 in silence. In parser code, use the named methods precisely because
they throw on a malformed frame instead of producing a plausible wrong number.

## A length-prefixed protocol, end to end

The pattern behind almost every binary protocol: a fixed header giving the type
and the payload length, then the payload.

```js
// framing.mjs
function frame(type, payload) {
  const head = Buffer.alloc(5);
  head.writeUInt8(type, 0);
  head.writeUInt32BE(payload.length, 1);      // network byte order
  return Buffer.concat([head, payload], 5 + payload.length);
}

function* parse(buf) {
  let off = 0;
  while (off + 5 <= buf.length) {             // enough for a header?
    const type = buf.readUInt8(off);
    const len = buf.readUInt32BE(off + 1);
    if (off + 5 + len > buf.length) return;   // incomplete frame — wait for more bytes
    yield { type, body: buf.subarray(off + 5, off + 5 + len).toString() };
    off += 5 + len;
  }
}

const wire = Buffer.concat([frame(1, Buffer.from('hello')), frame(2, Buffer.from('世界'))]);
console.log('wire :', wire.toString('hex'));
console.log('parse:', [...parse(wire)]);
```

```console
$ node framing.mjs
wire : 010000000568656c6c6f0200000006e4b896e7958c
parse: [ { type: 1, body: 'hello' }, { type: 2, body: '世界' } ]
```

Three things in that parser are load-bearing, and all three are where real
implementations fail:

1. **`off + 5 <= buf.length`** before reading the header. TCP gives you arbitrary
   fragments; the header itself can be split.
2. **Return, do not throw, on an incomplete frame.** Over a socket the rest is
   still in flight; you keep the remainder and prepend it to the next chunk.
3. **`len` comes from the wire, so it is attacker-controlled.** A four-byte
   length field can claim 4 GB. Reject anything above your maximum frame size
   *before* allocating — this is the classic memory-exhaustion DoS.

Over a real socket, wrap it in a Transform that keeps the leftover tail; the
structure is the same as the line splitter on [page 13](./transform-streams/).

## When to use DataView instead

`DataView` covers the same ground with explicit per-call endianness
(`getUint32(offset, littleEndian)`), works on plain `ArrayBuffer`s and is
portable to the browser. Buffer's named methods are more readable and slightly
faster in Node. Use `DataView` in code shared with the frontend; use Buffer
methods in Node-only parsers.

## Gotchas

**Symptom:** Numbers are wildly wrong but never throw — 4096 instead of 16
**Cause:** Endianness mismatch (`0x1000` vs `0x0010`).
**Fix:** Match the format's byte order. Network formats are big-endian.

**Symptom:** Large IDs come back off by a few
**Cause:** A 64-bit integer read into a JS number loses precision above 2^53.
**Fix:** `readBigInt64BE` / `readBigUInt64BE` and keep it a BigInt.

**Symptom:** Negative numbers appear as ~4 billion
**Cause:** Read with an unsigned method.
**Fix:** `readInt32BE`, not `readUInt32BE`.

**Symptom:** `ERR_BUFFER_OUT_OF_BOUNDS` when parsing socket data
**Cause:** A frame arrived split across chunks; the header or payload is
incomplete.
**Fix:** Buffer the remainder and only parse when the full frame is present.

**Symptom:** Process OOMs when a client connects
**Cause:** Allocated a buffer from a length field on the wire.
**Fix:** Validate the length against a maximum before allocating.

**Symptom:** Values silently wrap instead of throwing
**Cause:** `buf[i] = v` bypasses validation.
**Fix:** Use `writeUInt8(v, i)`.

**Symptom:** A float comes back as `NaN` or nonsense
**Cause:** Read as `readFloatBE` (4 bytes) when the format stores a double
(8 bytes), or vice versa.
**Fix:** Match the width; check the spec.

## Interview questions

**★ What is endianness and where does it bite you in Node?**
The order multi-byte integers are stored in. Big-endian puts the most significant
byte first and is the convention for network protocols; little-endian is what x86
and ARM use in memory. Reading with the wrong one gives a valid but wrong number
with no error — so it is caught by tests, or not at all.

**★ How do you read a 64-bit integer safely?**
`readBigInt64BE` / `readBigUInt64BE`, which return a BigInt. A JS number only
holds integers exactly up to 2^53−1, so reading a 64-bit ID as two 32-bit halves
or as a double silently corrupts large values.

**★ Why is `buf[0] = 300` dangerous in a parser?**
Index assignment does no range checking — it stores `300 % 256 = 44` and moves
on. `writeUInt8(300, 0)` throws `ERR_OUT_OF_RANGE`, which is what you want when
the input is malformed.

**★ You are parsing a length-prefixed protocol off a TCP socket. What are the two
mistakes everyone makes?**
Assuming one `data` event equals one frame — TCP is a byte stream, frames split
and coalesce, so you must buffer a remainder. And trusting the length field —
it is attacker-controlled, so validate it against a maximum before allocating.

**When would you use `DataView` over Buffer's read methods?**
When the code must also run in the browser, or when you are working with a plain
`ArrayBuffer`. `DataView` takes endianness as an argument rather than baking it
into the method name.

---

← Prev: [string_decoder](05-string-decoder.md) · Next → [Why streams exist](07-why-streams.md)
