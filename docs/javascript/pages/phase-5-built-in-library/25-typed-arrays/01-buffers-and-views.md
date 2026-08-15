---
title: "1 · Buffers and views"
sidebar_label: "1 · Buffers and views"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [JavaScript typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays), [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray), [`TypedArray.prototype.set()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set), [`TypedArray.prototype.subarray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray), [`Uint8ClampedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray), [`ArrayBuffer.isView()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/isView), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no timings**.

## `ArrayBuffer` holds bytes and nothing else

```js
const buffer = new ArrayBuffer(16);
buffer.byteLength;    // 16
buffer[0];            // 🔴 undefined — you cannot index a buffer
```

**An `ArrayBuffer` is a block of memory with no interpretation at all.** It has no
elements, no type, no indices. The only things you can do with it directly are read
`byteLength` and `slice()` a copy. **To read or write, you need a view.**

## Views: the eleven typed arrays

| View | Element | Bytes |
|---|---|---|
| `Int8Array` / `Uint8Array` | 8-bit integer | 1 |
| `Uint8ClampedArray` | 8-bit, clamped 0–255 | 1 |
| `Int16Array` / `Uint16Array` | 16-bit integer | 2 |
| `Int32Array` / `Uint32Array` | 32-bit integer | 4 |
| `Float32Array` | single-precision float | 4 |
| `Float64Array` | double — a normal JS number | 8 |
| `BigInt64Array` / `BigUint64Array` | 64-bit integer, `BigInt` elements | 8 |

**Each carries `BYTES_PER_ELEMENT`**, and there is a newer `Float16Array` — check your
targets before using it.

```js
Uint32Array.BYTES_PER_ELEMENT;   // 4
```

**Three ways to make one:**

```js
new Uint8Array(16);                      // its own new 16-byte buffer
new Uint8Array([1, 2, 3]);               // from an array-like or iterable
new Uint8Array(buffer, 4, 8);            // a view over an EXISTING buffer:
                                         //   8 elements starting at byte 4
```

⚠️ **The offset must be aligned to the element size.** `new Uint32Array(buffer, 3)` throws
a `RangeError`, because a 4-byte integer cannot start at byte 3. `DataView`
([chunk 2](./02-dataview-and-endianness.md)) is the one that does not care.

**Every view exposes where it sits:**

```js
view.buffer;       // the underlying ArrayBuffer
view.byteOffset;   // where this view starts
view.byteLength;   // how many bytes it spans
view.length;       // how many ELEMENTS — not the same number
```

🔴 **`length` and `byteLength` differ for anything wider than a byte**, and mixing them up
is the most common off-by-four in this corner of the language.

## Several views, one buffer

```js
const buffer = new ArrayBuffer(4);
const bytes = new Uint8Array(buffer);
const word = new Uint32Array(buffer);

bytes[0] = 0xff;
word[0];        // 🔴 changed — the same four bytes, read differently
```

**This is the point of the design, not a hazard to avoid.** A binary protocol has a
one-byte header and a four-byte payload; a WebGL buffer is floats to the shader and bytes
to the uploader. One allocation, several interpretations, no copying.

⚠️ **But it means aliasing is real.** Two views over the same buffer are not independent,
and passing one to a function that writes to it changes the other. When you want
independence, copy:

```js
const copy = new Uint8Array(original);              // ✅ new buffer
const copy2 = original.slice();                     // ✅ also copies
const alias = original.subarray(0, 4);              // ⚠️ same buffer, shared memory
```

🔴 **`slice` copies; `subarray` aliases.** They read almost identically and do opposite
things — the single most useful fact on this page.

## What typed arrays can and cannot do

**They have most of the array methods:**

```js
u8.map((x) => x * 2);      // ✅ — returns a Uint8Array, not an Array
u8.filter(Boolean);        // ✅
u8.forEach(f);             // ✅
u8.reduce(f, 0);           // ✅
u8.sort();                 // ✅ and it sorts NUMERICALLY by default
u8.indexOf(5);             // ✅
[...u8];                   // ✅ iterable
```

🔴 **`sort()` on a typed array sorts numerically** — unlike `Array.prototype.sort`, which
compares stringified values and puts `10` before `9`
([06 · `sort`](../06-sort/README.md)). One of the few places the typed version is friendlier.

**They cannot change length:**

```js
u8.push(1);       // 🔴 not a function
u8.pop();         // 🔴
u8.splice();      // 🔴
u8.concat(other); // 🔴
```

**The length is fixed at construction**, because the buffer is. To grow, allocate a bigger
one and copy in with `set`:

```js
const bigger = new Uint8Array(u8.length * 2);
bigger.set(u8);          // copy at offset 0
bigger.set(more, u8.length);
```

⚠️ **`Array.isArray(u8)` is `false`.** A typed array is array-like and iterable but is not
an `Array` ([22 · 01](../22-array-likes-and-iterables/01-the-two-contracts.md)). The
matching test is `ArrayBuffer.isView(u8)`, which is `true` for every typed array and for a
`DataView`.

## Out-of-range writes do not throw

```js
const u8 = new Uint8Array(1);
u8[0] = 300;      // 🔴 44 — wraps modulo 256
u8[0] = -1;       // 🔴 255
u8[5] = 1;        // 🔴 silently ignored — out of bounds, no error, no growth
u8[5];            // undefined
```

🔴 **Nothing throws.** A value too large wraps, and an index past the end is dropped
entirely — the write simply does not happen. That is unlike a normal array, where `a[5] =
1` extends it.

**`Uint8ClampedArray` is the exception, and it exists for pixels:**

```js
const c = new Uint8ClampedArray(1);
c[0] = 300;       // ✅ 255 — clamped, not wrapped
c[0] = -5;        // ✅ 0
c[0] = 1.6;       // ✅ 2 — rounded
```

**Canvas `ImageData` uses it** precisely because a brightness calculation overshooting 255
should saturate to white, not wrap around to black.

⚠️ **Float views lose precision quietly.** A `Float32Array` stores a single-precision
value, so writing a normal JS number and reading it back can give a different number
([Phase 1 · 06 · Numbers are doubles](../../phase-1-values-and-coercion/06-numbers-are-doubles.md)).

## Detached buffers

```js
worker.postMessage(buffer, [buffer]);   // transfer, not copy
buffer.byteLength;                      // 🔴 0 — detached
view[0];                                // 🔴 undefined
```

🔴 **Transferring a buffer moves it.** The sending side is left with a detached buffer:
`byteLength` becomes 0 and every view over it stops working. That is the whole point —
it is how a large payload crosses a worker boundary without being copied
([21 · `structuredClone`](../21-structuredclone.md)) — but it means the sender must not
keep using it.

⚠️ **The symptom is confusing:** no exception, just a view full of `undefined` and a
`byteLength` of 0. If a buffer mysteriously empties right after a `postMessage`, it was
transferred.

**Newer engines also have resizable `ArrayBuffer`s** (`maxByteLength` plus `resize()`) —
check your targets, and note that views track the resize.

## Gotchas

**Symptom:** Writing to one view changed another
**Cause:** They share a buffer — by design.
**Fix:** `slice()` or `new Uint8Array(other)` to copy; `subarray` deliberately aliases.

**Symptom:** `subarray` and `slice` behaved differently
**Cause:** `subarray` returns a view on the same memory; `slice` copies.
**Fix:** Pick by whether you want aliasing.

**Symptom:** `push is not a function`
**Cause:** Typed arrays are fixed-length.
**Fix:** Allocate a larger one and `set()` the old contents in.

**Symptom:** A value became something unrecognisable after assignment
**Cause:** Integer views wrap modulo their range; nothing throws.
**Fix:** Range-check first, or use `Uint8ClampedArray` where saturation is wanted.

**Symptom:** An assignment past the end did nothing
**Cause:** Out-of-bounds writes are silently dropped — typed arrays do not grow.
**Fix:** Check `length` before writing.

**Symptom:** `RangeError` constructing a view over an existing buffer
**Cause:** The byte offset is not aligned to the element size.
**Fix:** Align it, or use a `DataView`.

**Symptom:** `Array.isArray` returned `false` for a typed array
**Cause:** It is not an `Array`.
**Fix:** `ArrayBuffer.isView(x)`.

**Symptom:** A buffer emptied right after `postMessage`
**Cause:** It was transferred, and the sender's copy is detached.
**Fix:** Copy before sending, or accept the move and stop using it.

**Symptom:** A float read back differently from what was written
**Cause:** `Float32Array` is single-precision; JS numbers are doubles.
**Fix:** `Float64Array` where the precision matters.

## Interview questions

**★ What is the relationship between `ArrayBuffer` and a typed array?**
The buffer is raw memory with no interpretation — you cannot index it. A typed array is a
*view* that gives those bytes a numeric type and a length. Several views can cover the same
buffer at once, so writing through one is immediately visible through the others; that
aliasing is the design, and it is how a binary format is parsed without copying.

**★ What is the difference between `slice` and `subarray`?**
`slice` copies into a new buffer; `subarray` returns another view over the *same* buffer.
They look alike and do opposite things — one gives you independence, the other gives you
shared memory.

**★ What happens when you write 300 into a `Uint8Array`?**
It wraps to 44 — modulo 256, with no error. Writing past the end is silently dropped
rather than growing the array. `Uint8ClampedArray` clamps to 0–255 and rounds instead,
which is why canvas `ImageData` uses it: an overshooting brightness should saturate to
white, not wrap to black.

**★ Why does a buffer become unusable after `postMessage`?**
Because it was **transferred**, not copied — ownership moved to the other side and the
sender's buffer is detached, with `byteLength` 0 and every view reading `undefined`. That
is what makes a large binary payload cheap to send; the cost is that the sender must stop
using it.

**Is a typed array an array?**
No — `Array.isArray` returns `false`. It is array-like and iterable and has most array
methods, but no length-changing ones, and `map`/`filter` return the same typed type.
`ArrayBuffer.isView` is the test that says yes.

**Why does `sort()` behave differently here?**
Typed arrays sort numerically by default, whereas `Array.prototype.sort` compares
stringified values and would put `10` before `9`. It is one of the few places the typed
version has the friendlier default.

---

[Topic index](./README.md) · Next: [2 · `DataView`, endianness and where they show up](./02-dataview-and-endianness.md) →
