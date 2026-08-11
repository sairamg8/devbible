---
title: "Buffer is a Uint8Array"
sidebar_label: "04 · Buffer is a Uint8Array"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`Buffer extends Uint8Array`. Every TypedArray method works on it, every Web
API that takes a `Uint8Array` takes a Buffer — and the two disagree about
`slice()` and `toString()` in ways that produce silent bugs.**

```js
// is-a.mjs
const buf = Buffer.from([1, 2, 3, 4]);
console.log(buf instanceof Uint8Array);                       // true
console.log(ArrayBuffer.isView(buf));                         // true
console.log(Object.getPrototypeOf(Buffer.prototype).constructor.name);  // Uint8Array
```

```console
$ node is-a.mjs
true
true
Uint8Array
```

That inheritance is why `crypto.subtle`, `fetch`, `TextDecoder`, `structuredClone`
and Web Streams all accept a Buffer without conversion. Buffer is the Node-flavoured
subclass: same memory model, extra methods (`toString(encoding)`, `readUInt32BE`,
`equals`, `write`), plus the pool from [page 03](03-alloc-vs-allocunsafe.md).

## The two disagreements that bite

```js
// disagree.mjs
const u8 = new Uint8Array([1, 2, 3]);
const buf = Buffer.from([1, 2, 3]);

// 1. slice()
const uSlice = u8.slice(0, 2);   uSlice[0] = 9;
const bSlice = buf.slice(0, 2);  bSlice[0] = 9;
console.log('Uint8Array.slice copies :', u8[0]);      // 1  — original untouched
console.log('Buffer.slice shares     :', buf[0]);     // 9  — original mutated

// 2. toString()
console.log('Uint8Array.toString():', new Uint8Array([104, 105]).toString());
console.log('Buffer.toString()    :', Buffer.from([104, 105]).toString());
```

```console
$ node disagree.mjs
Uint8Array.slice copies : 1
Buffer.slice shares     : 9
Uint8Array.toString(): 104,105
Buffer.toString()    : hi
```

**`Buffer.prototype.slice` overrides the TypedArray method and does not copy.**
Code written against `Uint8Array` semantics — or a helper that works on both —
behaves differently depending on which one it receives. Use `subarray` when you
want a view and `Buffer.from(view)` when you want a copy, and the ambiguity
disappears.

`toString()` differs too: joining with commas versus decoding as UTF-8. Anything
doing string interpolation on "some byte array" gets a different result per type.

## What inherited methods return

```js
// species.mjs
const buf = Buffer.from([1, 2, 3, 4]);
console.log(buf.map(x => x * 2).constructor.name, buf.map(x => x * 2));
console.log(buf.filter(x => x > 2).constructor.name);
console.log([...buf], Array.from(buf));
console.log(buf.at(-1), buf.includes(3), buf.indexOf(3));
```

```console
$ node species.mjs
Buffer <Buffer 02 04 06 08>
Buffer
[ 1, 2, 3, 4 ] [ 1, 2, 3, 4 ]
4 true 2
```

`map` and `filter` return **Buffers**, not `Uint8Array`s, because the species
constructor is inherited. Note `map` clamps to 0–255 per element like any
`Uint8Array` — `x => x * 200` wraps rather than overflowing into a wider type.

## Converting between them, without accidental copies

```js
// convert.mjs
// ArrayBuffer -> Buffer: SHARES memory
const ab = new ArrayBuffer(4);
const view = Buffer.from(ab);
view[0] = 7;
console.log('shares:', new Uint8Array(ab)[0]);                       // 7

// Uint8Array -> Buffer: COPIES
const src = new Uint8Array([1]);
const copied = Buffer.from(src);
copied[0] = 9;
console.log('copied:', src[0]);                                      // 1

// Uint8Array -> Buffer without copying: pass the triple
const wrapped = Buffer.from(src.buffer, src.byteOffset, src.length);
wrapped[0] = 9;
console.log('wrapped:', src[0]);                                     // 9
```

```console
$ node convert.mjs
shares: 7
copied: 1
wrapped: 9
```

Three overloads of the same function with three different memory behaviours:

| Call | Copies? |
|---|---|
| `Buffer.from(arrayBuffer)` | No — view over the whole `ArrayBuffer` |
| `Buffer.from(arrayBuffer, byteOffset, length)` | No — view over a region |
| `Buffer.from(typedArray)` | **Yes** — copies the bytes |
| `Buffer.from(buffer)` | **Yes** |
| `Buffer.from(string, enc)` | Yes — encodes |

The copying overload is the safe default and the one people are surprised by in
hot paths. Wrap explicitly with the triple when the copy matters.

## Interop that this buys you

```js
// interop.mjs
const buf = Buffer.from('héllo');

console.log(new TextDecoder().decode(buf));                    // héllo
const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
console.log('DataView byte 2:', dv.getUint8(2));

const digest = await crypto.subtle.digest('SHA-256', buf);     // Web Crypto takes it directly
console.log('sha256:', Buffer.from(digest).toString('hex').slice(0, 16) + '…');

const res = new Response(buf);                                 // fetch/Response take it directly
console.log('body bytes:', (await res.arrayBuffer()).byteLength);
```

```console
$ node interop.mjs
héllo
DataView byte 2: 169
sha256: 3c48591d8d098a45…
body bytes: 6
```

Note the `DataView` construction: **offset and length are mandatory in practice**
because `buf.buffer` may be the 64 KB pool slab. The same applies to
`new Uint8Array(buf.buffer)` and to `postMessage` transfer lists.

## When to prefer plain Uint8Array

Buffer is Node-only. If the code also runs in a browser, a Cloudflare Worker or
Deno, write against `Uint8Array` + `TextEncoder`/`TextDecoder` and keep Buffer at
the Node edges. The trade-off is losing `readUInt32BE`, `toString('base64')` and
`equals` — replaceable with `DataView`, `btoa`/`Uint8Array.prototype.toBase64`,
and a manual loop, at some verbosity cost.

## Gotchas

**Symptom:** A helper mutates the caller's data when given a Buffer but not a Uint8Array
**Cause:** `Buffer.prototype.slice` returns a view; `Uint8Array.prototype.slice`
copies.
**Fix:** Use `subarray` (always a view) or `Buffer.from(x.subarray(...))` (always
a copy) so behaviour does not depend on the input type.

**Symptom:** String interpolation yields `104,105` instead of `hi`
**Cause:** The value is a `Uint8Array`, not a Buffer.
**Fix:** `Buffer.from(u8).toString()` or `new TextDecoder().decode(u8)`.

**Symptom:** `new Uint8Array(buf.buffer)` contains 65 536 bytes of unrelated data
**Cause:** Pooled buffers share one `ArrayBuffer`.
**Fix:** `new Uint8Array(buf.buffer, buf.byteOffset, buf.length)`.

**Symptom:** `Buffer.from(u8)` shows up hot in a profile
**Cause:** That overload copies.
**Fix:** `Buffer.from(u8.buffer, u8.byteOffset, u8.length)` when a view is
acceptable.

**Symptom:** `buf.map(b => b * 3)` produces wrong values
**Cause:** Results are clamped to a byte and wrap modulo 256.
**Fix:** `Array.from(buf).map(...)` if you need numbers larger than 255.

**Symptom:** Code works in Node, fails in the browser bundle with `Buffer is not defined`
**Cause:** Buffer is a Node global, not a web standard.
**Fix:** Use `Uint8Array` and `TextEncoder`/`TextDecoder` in shared code.

## Interview questions

**★ Is a Buffer a TypedArray?**
Yes — `Buffer extends Uint8Array`. It adds encoding-aware methods and numeric
read/write helpers, and it allocates from a shared pool, but it is the same
memory model, which is why Web APIs accept it directly.

**★ What does `Buffer.prototype.slice` do that surprises people?**
It returns a view sharing memory, unlike `Uint8Array.prototype.slice`, which
copies. Writes through the "slice" mutate the original. `subarray` is the
explicit name for that behaviour and the one to use.

**★ Does `Buffer.from(uint8Array)` copy?**
Yes. `Buffer.from(arrayBuffer)` and `Buffer.from(arrayBuffer, offset, length)` do
not — they create views. Three overloads, two memory behaviours.

**★ Why must you pass `byteOffset` and `length` when building a view from `buf.buffer`?**
Because a buffer under 32 KB is a window into a shared 64 KB pool slab. Using
`buf.buffer` alone exposes — or transfers — everything else in that slab.

**When would you use `Uint8Array` instead of `Buffer`?**
In code that must also run outside Node. Buffer is a Node global; `Uint8Array`
plus `TextDecoder` is the portable equivalent.

---

← Prev: [alloc vs allocUnsafe](03-alloc-vs-allocunsafe.md) · Next → [string_decoder](05-string-decoder.md)
