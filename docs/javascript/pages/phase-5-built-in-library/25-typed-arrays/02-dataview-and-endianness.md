---
title: "2 · `DataView`, endianness and where they show up"
sidebar_label: "2 · DataView and endianness"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`DataView`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView), [`DataView.prototype.getInt32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt32), [`DataView.prototype.setFloat64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat64), [JavaScript typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays), [`Response.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/arrayBuffer), [`Blob.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [`FileReader.readAsArrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsArrayBuffer), [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData), [`SubtleCrypto.digest()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder). Documentation-validated; **no timings**.

## Why `DataView` exists

A `Uint32Array` can already read a 32-bit number out of a buffer. **`DataView` exists
because it can do two things typed arrays cannot:**

1. **Read any type at any byte offset**, with no alignment requirement.
2. **Choose the byte order explicitly**, per call.

```js
const view = new DataView(buffer);

view.getUint8(0);
view.getInt32(1);                 // ✅ offset 1 — a typed array would throw
view.getFloat64(4, true);         // true = little-endian
view.setUint16(12, 500, false);   // false / omitted = BIG-endian
```

**Every method is `get`/`set` plus the type**, taking a byte offset and — for anything
wider than a byte — an optional `littleEndian` flag.

⚠️ **Mixed-type formats are what it is for.** A file header with a one-byte version, a
four-byte length and an eight-byte timestamp is one `DataView` and three calls. Doing it
with typed arrays means a separate view per field, each with an alignment problem.

## Endianness

**Endianness is the order the bytes of a multi-byte number are stored in.** The number
`0x12345678` is either `12 34 56 78` (big-endian) or `78 56 34 12` (little-endian).

🔴 **The two APIs have opposite defaults, and this is the trap:**

| | Byte order |
|---|---|
| **typed arrays** | the **platform's** — whatever the CPU uses |
| **`DataView`** | **big-endian** unless you pass `true` |

**Almost every CPU you will meet is little-endian**, so a `Uint32Array` reads
little-endian in practice. But that is a property of the machine, not a promise — and
**network byte order is big-endian**, which is why most binary wire formats are too.

```js
new DataView(buf).getUint32(0);         // big-endian — the wire-format default
new DataView(buf).getUint32(0, true);   // little-endian — most file formats
new Uint32Array(buf)[0];                // 🔴 whatever this CPU does
```

⚠️ **The rule: whenever bytes came from outside this process — a network, a file, another
machine — use `DataView` and state the endianness.** Typed arrays are for memory you own,
where platform order is fine because nothing else reads it.

**Detecting the platform's order**, if you ever need to:

```js
const isLittleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
```

**Writing `1` as a 32-bit number and asking which byte holds it** is the whole test — the
low byte comes first on a little-endian machine.

## Where these actually arrive

**You almost never construct these yourself. Something hands you one:**

```js
const buf = await response.arrayBuffer();         // fetch
const buf2 = await blob.arrayBuffer();            // Blob / File
const buf3 = await file.stream()…                 // streams
new FileReader().readAsArrayBuffer(file);         // the older API
socket.binaryType = "arraybuffer";                // WebSocket binary frames
ctx.getImageData(0, 0, w, h).data;                // Uint8ClampedArray of RGBA
await crypto.subtle.digest("SHA-256", data);      // an ArrayBuffer of hash bytes
crypto.getRandomValues(new Uint8Array(16));       // filled in place
```

**And in Node, `Buffer` is a `Uint8Array` subclass** — so everything on this page applies
to it, plus Node's own extra methods.

⚠️ **`ImageData.data` is a `Uint8ClampedArray` of RGBA bytes**, four per pixel, row by
row. That layout plus the clamping rule from
[chunk 1](./01-buffers-and-views.md) is most of what pixel manipulation needs.

**And the reason chunk A pairs phase 5 with phase 11:** every one of those sources belongs
to the network-and-storage phase. **Phase 11 · `Blob`, `File` and `FileReader`**,
**Phase 11 · Streams** and **Phase 11 · WebSocket** *(not written yet)* all hand you
exactly these objects.

## Bytes and text

**Bytes are not a string, and the conversion needs an encoding:**

```js
const text = new TextDecoder().decode(buffer);        // bytes → string (UTF-8)
const bytes = new TextEncoder().encode("héllo");      // string → Uint8Array (UTF-8)
```

🔴 **This is the correct conversion, and the improvised ones are wrong.**
`String.fromCharCode(...bytes)` treats each byte as a code unit — which corrupts any
multi-byte character and blows the argument limit on a large buffer. **26 · Text
encoding** *(next in this phase)* is the full treatment, including why `btoa` fails on
non-ASCII.

**A quick hex dump**, which is the debugging tool you actually want when a format does not
parse:

```js
const hex = [...new Uint8Array(buffer)]
  .map((b) => b.toString(16).padStart(2, "0"))
  .join(" ");
```

## When none of this is your problem

✅ **Most application code never touches a byte.** JSON over `fetch`, form submissions,
`localStorage`, images through `<img>` — all of it is handled above this layer, and
reaching for a `DataView` in ordinary product code is usually a sign of solving the wrong
problem.

**The cases where it genuinely is the job:**

- **Parsing or writing a binary format** — a file header, a protocol frame, a WASM module.
- **Pixel manipulation** on a canvas.
- **Crypto and hashing**, where the API speaks buffers.
- **Moving large numeric data to a worker or WebAssembly** without copying, which is the
  transferable story from [21 · `structuredClone`](../21-structuredclone.md).
- **Reading a file's magic bytes** to check what it really is before trusting its
  extension.

⚠️ **And one honest note on performance:** typed arrays are often described as "fast
arrays". They are not a general replacement for `Array` — they are a different data model,
and using them for ordinary lists of numbers costs you `push`, mixed types and array
methods in exchange for a benefit most code cannot measure. Use them when the *shape* of
the data is bytes, not as an optimisation.

## Gotchas

**Symptom:** A parsed binary field had a wildly wrong value
**Cause:** Endianness. The typed array read platform order; the format is big-endian, or
the other way round.
**Fix:** `DataView` with an explicit `littleEndian` argument on every multi-byte read.

**Symptom:** `DataView` reads disagreed with `Uint32Array` reads of the same bytes
**Cause:** `DataView` defaults to **big**-endian; the typed array uses the platform's
order, which is almost always little.
**Fix:** Pass `true` for little-endian, and be explicit everywhere.

**Symptom:** `RangeError` from a typed-array view at an odd offset
**Cause:** Offsets must be aligned to the element size.
**Fix:** Use a `DataView`, which has no alignment requirement.

**Symptom:** Text from a buffer was mangled for accented or non-Latin characters
**Cause:** `String.fromCharCode` over bytes treats each byte as a code unit.
**Fix:** `new TextDecoder().decode(buffer)`.

**Symptom:** `String.fromCharCode(...bytes)` threw on a large buffer
**Cause:** Spreading a huge array exceeds the argument limit.
**Fix:** `TextDecoder`, which has no such limit.

**Symptom:** Canvas pixel edits produced dark artefacts where values overflowed
**Cause:** A calculation exceeded 255. With a plain `Uint8Array` that wraps to black.
**Fix:** `ImageData.data` is already a `Uint8ClampedArray` — write to it directly rather
than through a copy in another view type.

**Symptom:** A hash compared unequal to an expected string
**Cause:** `crypto.subtle.digest` returns an `ArrayBuffer`, not hex.
**Fix:** Convert the bytes to hex explicitly.

## Interview questions

**★ Why does `DataView` exist when typed arrays can already read numbers?**
Two reasons: it reads any type at any byte offset with no alignment requirement, and it
lets you choose the byte order per call. That makes it the right tool for a mixed-type
binary format — a header with a one-byte version, a four-byte length and an eight-byte
timestamp is three `DataView` calls instead of three separate aligned views.

**★ What is endianness, and what are the defaults here?**
The order the bytes of a multi-byte number are stored in. **Typed arrays use the
platform's order** — almost always little-endian, but that is a property of the machine.
**`DataView` defaults to big-endian** and takes a `littleEndian` flag. Since network byte
order is big-endian, anything crossing a process boundary should be read with an explicit
`DataView` call.

**★ Where do buffers come from in real code?**
`response.arrayBuffer()`, `blob.arrayBuffer()`, `FileReader.readAsArrayBuffer`, WebSocket
binary frames, `getImageData().data`, WebCrypto digests and random values, and WebAssembly
memory. In Node, `Buffer` is a `Uint8Array` subclass. You rarely construct one yourself.

**★ How do you turn a buffer into a string?**
`new TextDecoder().decode(buffer)`, and `new TextEncoder().encode(str)` the other way —
both UTF-8. `String.fromCharCode(...bytes)` is wrong: it treats each byte as a UTF-16 code
unit, corrupting multi-byte characters, and spreading a large buffer exceeds the argument
limit.

**Are typed arrays just faster arrays?**
No — they are a different data model. Fixed length, one numeric type, no `push`, and views
that alias shared memory. Use them when the data genuinely is bytes; using them as an
optimisation for ordinary numeric lists trades away real ergonomics for a benefit most code
cannot measure.

**How would you check a file is really a PNG?**
Read the first few bytes with a `DataView` or a `Uint8Array` and compare the magic number,
rather than trusting the extension or the client-supplied MIME type.

---

← [1 · Buffers and views](./01-buffers-and-views.md) · [Topic index](./README.md) · [Phase index](../README.md) →
