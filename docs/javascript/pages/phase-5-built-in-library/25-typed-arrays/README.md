---
title: "25 · Typed arrays, `ArrayBuffer` and `DataView`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [JavaScript typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays), [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray), [`DataView`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView), [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no timings**.

**A normal array holds JavaScript values. A typed array holds bytes.** That is the whole
distinction, and everything else follows from it: fixed length, one numeric type
throughout, no holes, no `push`, and several views able to look at the same memory at
once.

🔴 **You rarely reach for these deliberately — you meet them because an API hands you
one.** `response.arrayBuffer()`, a file read, a WebSocket message, canvas pixel data,
WebCrypto, WebAssembly memory, a Node `Buffer`. This topic is here so that when one
arrives you know what you are holding.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Buffers and views](./01-buffers-and-views.md)** | `ArrayBuffer` as bytes with no meaning, and typed arrays as *views* over it; the eleven view types and `BYTES_PER_ELEMENT`; 🔴 **several views sharing one buffer**; which array methods exist and which cannot; `subarray` versus `slice`; wrapping versus clamping on overflow; and detached buffers |
| 2 | **[`DataView`, endianness and where they show up](./02-dataview-and-endianness.md)** | Why `DataView` exists when typed arrays already read numbers; 🔴 **endianness** — typed arrays use the platform's order while `DataView` defaults to big-endian; unaligned reads; the APIs that hand you a buffer in real code; conversion to and from text and `Blob`s; and an honest note on when none of this is your problem |

## The model in four lines

```js
const buffer = new ArrayBuffer(8);       // 8 raw bytes — no type, no meaning
const bytes = new Uint8Array(buffer);    // view: 8 unsigned 8-bit integers
const words = new Uint32Array(buffer);   // view: 2 unsigned 32-bit integers
bytes[0] = 255;                          // 🔴 words[0] changed too — same memory
```

**The buffer owns the memory; a view decides how to read it.** Two views over one buffer
are two interpretations of the same bytes, not two copies.

## Phase gate

You are done with this topic when you can say **what changes in `words` when you write to
`bytes`**, and **why `DataView` exists when `Uint32Array` can already read a 32-bit
number**.

## Where this connects

- [21 · `structuredClone`](../21-structuredclone.md) — buffers are transferable, which is how they cross a worker boundary without a copy
- [22 · 01 · The two contracts](../22-array-likes-and-iterables/01-the-two-contracts.md) — typed arrays are array-like *and* iterable, but `Array.isArray` says no
- [Phase 1 · 06 · Numbers are doubles](../../phase-1-values-and-coercion/06-numbers-are-doubles.md) — what a `Float64Array` element actually is
- [Phase 1 · 13 · `BigInt`](../../phase-1-values-and-coercion/13-bigint.md) — the element type of `BigInt64Array`
- **26 · Text encoding** *(next in this phase)* — turning bytes into strings and back
- **Phase 11 · `Blob`, `File` and streams**, **Phase 12 · Web Workers** *(other topics)* — where these arrive from

---

Start → [1 · Buffers and views](./01-buffers-and-views.md)
