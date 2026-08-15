---
title: "1 · `TextEncoder` and `TextDecoder`"
sidebar_label: "1 · TextEncoder and TextDecoder"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`TextEncoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), [`TextEncoder.encode()`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encode), [`TextEncoder.encodeInto()`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encodeInto), [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder), [`TextDecoder()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder), [`TextDecoder.decode()`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode), [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream), [UTF-8](https://developer.mozilla.org/en-US/docs/Glossary/UTF-8), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize). Documentation-validated; **no timings**.

## `TextEncoder` — always UTF-8

```js
const bytes = new TextEncoder().encode("héllo");   // a Uint8Array
```

**`TextEncoder` encodes UTF-8 and nothing else.** It takes no encoding argument, and that
is deliberate — the web platform settled on UTF-8 for output, so there is no choice to get
wrong.

🔴 **The byte count is not the string length**, and that is the whole reason this API
exists:

```js
"héllo".length;                                // 5 — UTF-16 code units
new TextEncoder().encode("héllo").length;      // 6 — é takes two bytes in UTF-8
new TextEncoder().encode("日本").length;        // 6 — three bytes each
```

⚠️ **Anywhere a size limit is in bytes** — a request body cap, a database column, a
storage quota, a protocol field — `str.length` is the wrong number. Encode and measure.

**`encodeInto` writes into a buffer you already own**, for the case where you are filling
a fixed region and want to avoid an allocation:

```js
const target = new Uint8Array(64);
const { read, written } = new TextEncoder().encodeInto(str, target);
```

**It reports how much it consumed and how much it wrote**, because the string may not fit
— it truncates at a character boundary rather than producing a half-character.

## `TextDecoder` — bytes back to text

```js
new TextDecoder().decode(bytes);                       // UTF-8 by default
new TextDecoder("iso-8859-1").decode(legacyBytes);     // a labelled legacy encoding
new TextDecoder("utf-16le").decode(bytes);
```

**Unlike the encoder, the decoder speaks many encodings**, because you do not control what
arrives. The label comes from the WHATWG Encoding registry — `"utf-8"`, `"utf-16le"`,
`"iso-8859-2"`, `"shift_jis"` and so on.

**It accepts an `ArrayBuffer` or any view over one**, so a `Uint8Array`, a `DataView` or a
`subarray` all work directly ([25 · 01](../25-typed-arrays/01-buffers-and-views.md)).

### `fatal` — fail loudly or replace silently

```js
new TextDecoder().decode(bad);                       // ⚠️ invalid bytes become U+FFFD �
new TextDecoder("utf-8", { fatal: true }).decode(bad);   // 🔴 throws TypeError
```

**By default, invalid byte sequences become the replacement character** — the `�` you have
seen on mis-encoded pages. That is right for rendering a best effort and wrong for
validation.

✅ **Use `{ fatal: true }` when the bytes are supposed to be valid** — a file you are
importing, a protocol frame, anything where corruption should stop the operation rather
than quietly enter your data.

**`{ ignoreBOM: true }`** keeps a leading byte-order mark as a character instead of
stripping it. The default strips it, which is almost always what you want; the option
exists for formats where the BOM is data.

## 🔴 `{ stream: true }` — the chunked-decoding trap

```js
// 🔴 WRONG — decodes each chunk independently
for await (const chunk of stream) {
  text += new TextDecoder().decode(chunk);
}
```

**A multi-byte character can be split across two chunks.** UTF-8 encodes `é` as two bytes;
if the first lands at the end of one chunk and the second at the start of the next, each
chunk decodes to a replacement character and both bytes are lost. The output looks *almost*
right, which is why it survives testing on short ASCII payloads and breaks on real data.

✅ **The fix is one decoder, reused, with `{ stream: true }`:**

```js
const decoder = new TextDecoder();
let text = "";
for await (const chunk of stream) {
  text += decoder.decode(chunk, { stream: true });   // ✅ holds partial sequences
}
text += decoder.decode();                            // ✅ flush the tail
```

**`stream: true` tells the decoder to keep any trailing incomplete sequence** and prepend
it to the next call. The final bare `decode()` flushes whatever is left — and omitting it
silently drops a character at the very end.

⚠️ **Two things follow.** The decoder is **stateful**, so one decoder per stream and never
share it. And on the web there is a ready-made version:

```js
response.body.pipeThrough(new TextDecoderStream());   // ✅ handles all of this
```

**Prefer `TextDecoderStream` when you are already in a stream pipeline** — it is the same
logic with no chance of forgetting the flush. The stream side of this belongs to
**Phase 11 · Streams** *(not written yet)*.

## Where encoding actually bites

- **Byte-length limits.** As above — `str.length` is code units, not bytes.
- **Crypto.** `crypto.subtle` takes bytes, so every string must be encoded first, and the
  same string must encode identically on both sides.
- **Hashing and signatures.** Two strings that *look* the same can differ in bytes if one
  uses a combining accent and the other a precomposed character. `String.prototype.normalize()`
  is what makes them comparable before encoding.
- **`localStorage` and JSON.** Both are text-only, so binary data has to become text
  first — which is [chunk 2](./02-base64.md).
- **Anything reading a file.** A `.txt` produced on an older system may not be UTF-8 at
  all, which is where a labelled `TextDecoder` earns its keep.

⚠️ **`Content-Type` is a claim, not a fact.** A response labelled `charset=utf-8` can still
carry mis-encoded bytes; `{ fatal: true }` is how you find out at the boundary rather than
three screens later.

## Gotchas

**Symptom:** Text from a stream had `�` scattered through it
**Cause:** Each chunk was decoded independently, splitting multi-byte characters.
**Fix:** One `TextDecoder`, `{ stream: true }` on every chunk, and a final bare `decode()`.

**Symptom:** The last character of a stream went missing
**Cause:** The flush call was omitted, so a held partial sequence was never emitted.
**Fix:** `decoder.decode()` with no arguments at the end.

**Symptom:** A length check passed but the server rejected the payload as too large
**Cause:** `str.length` counts UTF-16 code units; the limit is in bytes.
**Fix:** `new TextEncoder().encode(str).length`.

**Symptom:** Corrupt input silently produced `�` instead of an error
**Cause:** The decoder replaces invalid sequences by default.
**Fix:** `{ fatal: true }` where the bytes are supposed to be valid.

**Symptom:** A legacy file decoded to gibberish
**Cause:** It is not UTF-8; the decoder defaulted to it.
**Fix:** Construct with the right encoding label.

**Symptom:** Two visually identical strings produced different hashes
**Cause:** Different Unicode normalisation — a combining accent versus a precomposed
character.
**Fix:** `str.normalize("NFC")` before encoding, on both sides.

**Symptom:** `TextEncoder` ignored the encoding argument
**Cause:** It does not take one — UTF-8 only, by design.
**Fix:** If you must produce another encoding, you need a library.

## Interview questions

**★ Why does decoding a stream need `{ stream: true }`?**
Because a multi-byte UTF-8 character can straddle a chunk boundary. Decoding each chunk
independently turns both halves into replacement characters. With `{ stream: true }` a
single reused decoder holds the trailing incomplete sequence and prepends it to the next
call — and a final bare `decode()` flushes whatever remains, without which the last
character is dropped. `TextDecoderStream` packages all of it.

**★ Why is `str.length` the wrong number for a byte limit?**
It counts UTF-16 code units. In UTF-8 an accented Latin character is two bytes and a CJK
character is three, so `"héllo"` is 5 in length and 6 in bytes. Encode and take the array's
length when the limit is expressed in bytes.

**★ What does `fatal: true` change?**
Invalid byte sequences throw a `TypeError` instead of becoming U+FFFD. The default is a
best-effort render, which is right for display and wrong for validation — for imported
files or protocol frames you want the failure at the boundary rather than corrupt data in
storage.

**★ Why does `TextEncoder` take no encoding argument?**
Because the web platform standardised on UTF-8 for output, so there is nothing to choose.
`TextDecoder` does take a label, because you do not control what arrives — legacy files and
older systems still produce other encodings.

**Two identical-looking strings hash differently. Why?**
Unicode normalisation. The same character can be a single precomposed code point or a base
letter plus a combining mark, and those are different bytes. `normalize("NFC")` on both
sides before encoding makes them comparable.

---

[Topic index](./README.md) · Next: [2 · Base64, and its Unicode failure](./02-base64.md) →
