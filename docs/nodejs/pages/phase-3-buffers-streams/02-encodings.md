---
title: "Encodings"
sidebar_label: "02 · Encodings"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**An encoding is the rule for turning bytes into text and back. Pick the wrong
one and nothing throws — you get mojibake, silent truncation, or a size limit
that is off by 33%.**

`buf.toString(encoding)` and `Buffer.from(str, encoding)` are the two ends. Node
24 supports eight names.

## The eight, and what each is for

```js
// encodings.mjs
const s = 'Grüße, 世界 🎉';
const buf = Buffer.from(s, 'utf8');

for (const enc of ['utf8', 'base64', 'base64url', 'hex', 'latin1', 'ascii', 'utf16le']) {
  console.log(enc.padEnd(10), JSON.stringify(buf.toString(enc)));
}
```

```console
$ node encodings.mjs
utf8       "Grüße, 世界 🎉"
base64     "R3LDvMOfZSwg5LiW55WMIPCfjok="
base64url  "R3LDvMOfZSwg5LiW55WMIPCfjok"
hex        "4772c3bcc39f652c20e4b896e7958c20f09f8e89"
latin1     "GrÃ¼Ãe, ä¸ç ð"
ascii      "GrC<C\u001fe, d8\u0016g\u0015\f p\u001f\u000e\t"
utf16le    "片볃鿃ⱥ隸闧₌鿰覎"
```

| Encoding | Bytes per char | Use it for | Never use it for |
|---|---|---|---|
| **`utf8`** (default) | 1–4 | All text. The default for a reason | — |
| **`base64`** | 4 chars per 3 bytes | Binary inside JSON, data URIs, Basic auth | Large payloads (+33% size) |
| **`base64url`** | same | JWTs, URL/filename-safe tokens | Anything expecting standard base64 |
| **`hex`** | 2 chars per byte | Hashes, IDs, debugging dumps | Payloads (+100% size) |
| **`latin1`** (`binary`) | exactly 1 | Byte↔char round-trip, legacy protocols | Actual text |
| **`ascii`** | 1, high bit **discarded** | Nothing, realistically | Any input you did not generate |
| **`utf16le`** (`ucs2`) | 2 or 4 | Windows APIs, some DB drivers | Wire formats |

## Only three are lossless for arbitrary text

```js
// roundtrip.mjs
const s = 'Grüße, 世界 🎉';
for (const enc of ['utf8', 'base64', 'hex', 'latin1', 'ascii']) {
  const back = Buffer.from(Buffer.from(s, 'utf8').toString(enc), enc).toString('utf8');
  console.log(enc.padEnd(8), back === s ? 'lossless' : 'LOSSY -> ' + JSON.stringify(back));
}
```

```console
$ node roundtrip.mjs
utf8     lossless
base64   lossless
hex      lossless
latin1   lossless
ascii    LOSSY -> "GrC<C\u001fe, d8\u0016g\u0015\f p\u001f\u000e\t"
```

`latin1` survives the round-trip because it is a **byte-preserving** map: byte
`n` becomes code point `n`, always. That makes it a valid transport for bytes —
but the intermediate string is meaningless as text, so never log it, never store
it, never send it as text to a client.

**`ascii` masks off the high bit** and destroys every byte above 127 with no
error. There is no case where `ascii` is the right choice over `utf8`: for pure
ASCII input they produce identical results, and for anything else `utf8` is
correct while `ascii` is corrupt.

## base64 vs base64url

```js
// b64.mjs
const bin = Buffer.from([0xfb, 0xff, 0xbf]);
console.log('base64   ', bin.toString('base64'));
console.log('base64url', bin.toString('base64url'));

// decoding accepts both alphabets and tolerates missing padding
console.log(Buffer.from('aGVsbG8', 'base64').toString());
console.log(Buffer.from('aGV%%sbG8=', 'base64').toString());
```

```console
$ node b64.mjs
base64    +/+/
base64url -_-_
hello
hello
```

Two things there matter.

1. **`base64url` swaps `+/` for `-_` and drops the `=` padding.** That is what
   JWT segments and URL-safe tokens use. Feeding a `base64url` string to a
   decoder that expects standard base64 usually works in Node (it accepts both),
   but will fail in other languages — do not rely on the leniency across a
   service boundary.
2. **Node's base64 decoder silently ignores characters outside the alphabet.**
   `aGV%%sbG8=` decodes cleanly to `hello`. So decoding is *not* validation: a
   corrupted or attacker-modified token can decode to something plausible. If the
   input must be well-formed base64, check it with a regex or compare
   `Buffer.from(x,'base64').toString('base64')` against the input before trusting
   it.

## Size, which is the reason to care

```js
// size.mjs
const payload = Buffer.alloc(1000);
console.log('raw', payload.length, '| base64', payload.toString('base64').length, '| hex', payload.toString('hex').length);
```

```console
$ node size.mjs
raw 1000 | base64 1336 | hex 2000
```

Base64 costs **+33%**, hex **+100%**. A 5 MB upload embedded as base64 in a JSON
body is a 6.7 MB request, and your 5 MB body limit rejects it. This is why file
uploads go through `multipart/form-data` (raw bytes) rather than base64 JSON, and
why base64 in a database column is a design smell — store `bytea`/`BinData` and
pay nothing.

**The trade-off:** base64 buys you "binary that survives any text channel"
(JSON, headers, URLs, logs) for a third more bytes and a CPU pass in each
direction. Worth it for a 200-byte token, wrong for a 5 MB image.

## Invalid UTF-8 does not throw

```js
// invalid.mjs
console.log(JSON.stringify(Buffer.from([0xff, 0xfe, 0x41]).toString('utf8')));
```

```console
$ node invalid.mjs
"��A"
```

Undecodable bytes become U+FFFD (`�`), the replacement character. No exception,
no signal — the corruption travels into your database. If input must be valid
UTF-8, validate before storing:

```js
// strict decode: throws on malformed input instead of substituting
const strict = new TextDecoder('utf8', { fatal: true });
try {
  strict.decode(Buffer.from([0xff, 0xfe, 0x41]));
} catch (err) {
  console.log(err.name, err.message);   // TypeError The encoded data was not valid for encoding utf-8
}
```

`TextDecoder` with `fatal: true` is the only built-in way to make bad bytes
loud. Reach for it at trust boundaries — an uploaded CSV, a message off a queue.

## Choosing, in one table

| You have | You want | Do |
|---|---|---|
| A hash / random ID to put in a URL | Short text | `.toString('hex')` or `base64url` |
| An image to embed in JSON | Text | `.toString('base64')` — but prefer multipart |
| A JWT segment | Bytes | `Buffer.from(seg, 'base64url')` |
| A file that may not be UTF-8 | Text | `TextDecoder` with the right charset, `fatal: true` |
| Bytes to move through a string-only API | Bytes back | `latin1`, both directions |
| A Basic auth header | `user:pass` | `Buffer.from(cred).toString('base64')` |

## Gotchas

**Symptom:** Text arrives as `Ã¼` where `ü` should be
**Cause:** UTF-8 bytes decoded as `latin1` — classic mojibake.
**Fix:** Decode as `utf8`. If the data is genuinely Latin-1 (an old export),
decode `latin1` and re-encode `utf8` once, at the boundary.

**Symptom:** Every non-ASCII character is replaced by garbage, no error
**Cause:** `ascii` encoding stripped the high bit.
**Fix:** Use `utf8`. There is no scenario where `ascii` beats it.

**Symptom:** A JWT fails to verify only for some tokens
**Cause:** Decoded with `base64` when the segments are `base64url`, or a `+`/`/`
in the signature got URL-decoded into a space.
**Fix:** `base64url` on both ends.

**Symptom:** Upload rejected as too large, but the file is under the limit
**Cause:** Base64 inflated it by 33% before the body-size check.
**Fix:** Compare against the encoded size, or switch to multipart uploads.

**Symptom:** Database rows contain `�`
**Cause:** Invalid bytes were decoded to text with substitution and stored.
**Fix:** Validate at ingest with `new TextDecoder('utf8', { fatal: true })`;
store raw bytes when the charset is unknown.

**Symptom:** `Buffer.from(x, 'base64')` succeeds on obvious garbage
**Cause:** Node's decoder skips characters outside the alphabet instead of
throwing.
**Fix:** Validate the shape first; do not treat "it decoded" as "it was valid".

## Interview questions

**★ Why is base64 33% larger, and when is that acceptable?**
It encodes 3 bytes into 4 ASCII characters, so 4/3 of the size. Acceptable for
small values that must survive a text-only channel — tokens, data URIs, JSON
fields. Not acceptable for file payloads, where multipart or a direct binary body
avoids the cost entirely.

**★ What is the difference between `latin1` and `ascii` in Node?**
`latin1` maps every byte 0–255 to the code point of the same value, so it
round-trips bytes losslessly. `ascii` masks off the high bit, destroying any byte
above 127 silently. `latin1` is a legitimate byte transport; `ascii` is a bug
waiting to happen.

**★ What happens when you decode invalid UTF-8?**
Each invalid sequence becomes U+FFFD and nothing throws. To detect it you need
`new TextDecoder('utf8', { fatal: true })`, which throws a `TypeError` instead.

**★ Why does `base64url` exist?**
Standard base64 uses `+`, `/` and `=`, all of which are unsafe or ambiguous in
URLs, query strings and filenames. `base64url` substitutes `-` and `_` and drops
padding. JWTs use it for exactly this reason.

**Is decoding base64 a validation step?**
No. Node's decoder ignores characters outside the alphabet and tolerates missing
padding, so malformed input still "decodes". Validate separately if the format
matters.

**Which encoding would you use to store a SHA-256 digest in a URL path?**
`hex` if readability and copy-paste matter (64 chars), `base64url` if length
matters (43 chars). Not plain `base64` — the `+` and `/` need escaping.

---

← Prev: [Buffer basics](01-buffer-basics.md) · Next → [alloc vs allocUnsafe](03-alloc-vs-allocunsafe.md)
