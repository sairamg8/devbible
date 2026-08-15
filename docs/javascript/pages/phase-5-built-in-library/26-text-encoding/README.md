---
title: "26 · Text encoding"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`TextEncoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder), [`Window.btoa()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa), [`Window.atob()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/atob), [Base64](https://developer.mozilla.org/en-US/docs/Glossary/Base64), [`Uint8Array.prototype.toBase64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64), [UTF-8](https://developer.mozilla.org/en-US/docs/Glossary/UTF-8). Documentation-validated; **no timings**.

**A JavaScript string is UTF-16 in memory. Almost everything outside the program is
UTF-8 bytes.** Encoding is the conversion between them, and it is the last piece of
[25 · Typed arrays](../25-typed-arrays/README.md) — you now have the bytes, and this is
how they become text.

🔴 **The two failures this topic exists to prevent are both silent-ish and both common:**
decoding a stream chunk by chunk and corrupting every character that straddles a chunk
boundary, and calling `btoa` on a string with an accent and getting an exception in
production that never appeared in testing.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`TextEncoder` and `TextDecoder`](./01-textencoder-and-textdecoder.md)** | UTF-16 in, UTF-8 out; `encode` and `encodeInto`; decoding other encodings by label; 🔴 **`{ stream: true }`** and why chunked decoding is wrong without it; `fatal` versus the replacement character; and where the byte count differs from the string length |
| 2 | **[Base64, and its Unicode failure](./02-base64.md)** | What base64 is for and its size cost; 🔴 **why `btoa("héllo")` throws**, and the correct encode/decode pair; base64url and why JWTs need it; the newer `Uint8Array` base64 methods; data URLs; and what to use instead of base64 most of the time |

## The four conversions

```js
new TextEncoder().encode(str);          // string → Uint8Array (UTF-8)
new TextDecoder().decode(bytes);        // Uint8Array/ArrayBuffer → string

btoa(binaryString);                     // bytes-as-a-string → base64 text
atob(base64);                           // base64 text → bytes-as-a-string
```

⚠️ **The two pairs solve different problems and are constantly confused.** Encoding turns
*text into bytes*. Base64 turns *bytes into text that survives a text-only channel*. Going
from a Unicode string to base64 needs **both**, in that order — which is exactly the bug in
[chunk 2](./02-base64.md).

## Phase gate

You are done with this topic when you can say **why decoding a stream in chunks needs
`{ stream: true }`**, and **why `btoa` throws on a string containing `é`**.

## Where this connects

- [25 · Typed arrays, `ArrayBuffer`, `DataView`](../25-typed-arrays/README.md) — the bytes these functions consume and produce
- [Phase 1 · 10 · Strings are UTF-16](../../phase-1-values-and-coercion/10-strings-are-utf16.md) — what a string is before encoding
- [20 · 03 · `Segmenter`](../20-intl/03-text-collator-list-plural-segmenter.md) — counting characters, a different question from counting bytes
- [09 · `JSON`](../09-json/README.md) — the other text-serialisation layer, and the one you usually want
- **Phase 11 · Streams**, **Phase 11 · Uploading files** *(other topics in this chunk, not written yet)* — where chunked decoding matters

---

Start → [1 · `TextEncoder` and `TextDecoder`](./01-textencoder-and-textdecoder.md)
