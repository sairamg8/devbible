---
title: "01 · Randomness and hashing"
sidebar_label: "01 · Randomness and hashing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), [`Crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [`Crypto.getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), [`SubtleCrypto.digest()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random), [`isSecureContext`](https://developer.mozilla.org/en-US/docs/Web/API/isSecureContext). Documentation-validated; **no timings and no console output**.

Two thirds of the honest uses of WebCrypto in a front end are **an id** and **a hash**. Both are
one line, both are hard to get wrong, and both replace something people otherwise hand-roll badly.
The rest of the API is [02 · The rest, and why you should not](./02-the-rest-and-why-not.md).

## Random ids

```js
crypto.randomUUID();   // "9c9f4e5c-…" — a version 4 UUID, cryptographically random
```

🔴 **This replaces every hand-rolled id generator**, including the `Math.random().toString(36)`
one that appears in every codebase. It is not a style preference:

**`Math.random()` is not random enough to be an identifier.** The specification requires no
cryptographic quality at all — engines use a fast PRNG, its output is predictable from previous
outputs, and it can and does repeat across tabs and across reloads. It is for shuffling and
sampling, not for anything that must be unique or unguessable.

| Need | Use |
|---|---|
| A unique id — request, key, correlation | `crypto.randomUUID()` |
| Random bytes — a token, a salt, a nonce | `crypto.getRandomValues()` |
| A random number for a jitter, an animation, a sample | `Math.random()` is fine |

⚠️ **`randomUUID()` requires a secure context.** On plain HTTP it is `undefined` — the same trap
as the rest of the capability APIs ([09 · 02 · navigator and screen](../09-window-document-navigator/02-navigator-and-screen.md)).

## Random bytes

```js
const bytes = crypto.getRandomValues(new Uint8Array(32));
const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
```

It fills the typed array **in place** and returns it, synchronously. Two limits worth knowing:
the array must be an integer typed array (not `Float32Array`), and a single call takes at most
**65 536 bytes** — ask for more and it throws `QuotaExceededError`. Loop if you genuinely need
more, which you almost certainly do not.

**Unlike the rest of the API this is synchronous**, because it is just entropy — there is no key
material and nothing to schedule.

## Hashing with `subtle.digest`

```js
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

Four things are happening, and each is a place people go wrong:

1. **Encode the string to bytes first.** A hash is defined over bytes, and `TextEncoder` gives
   UTF-8 — the encoding everything else on the wire assumes.
2. **`digest()` returns a promise of an `ArrayBuffer`.** Not a string, not hex.
3. **Convert deliberately.** Hex as above, or base64 via `Uint8Array.prototype.toBase64()` where
   available.
4. **Algorithms:** `SHA-256`, `SHA-384`, `SHA-512` — and `SHA-1`, which exists only for legacy
   interoperability and is **not** to be used for anything security-relevant. MD5 is not offered
   at all, which is the correct answer.

### The things hashing is for

| Use | Why it works |
|---|---|
| A cache key or ETag for content | equal content → equal digest |
| Detecting a changed file before re-upload | cheap comparison of a fixed-size value |
| Subresource-integrity style verification | compare against a known digest |
| A deterministic id for deduplication | same input, same id, everywhere |

**Hashing a file, without loading it into a string:**

```js
const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
```

⚠️ **`arrayBuffer()` reads the whole file into memory.** For large uploads that is the wrong
shape — and there is no incremental digest in WebCrypto, which is one of the few genuine gaps.
The workarounds are a WASM hasher or hashing on the server (**Phase 11 · 11 · Uploading files**
*(not written yet)*).

### 🔴 The things hashing is not for

**Passwords.** A SHA-256 of a password is a password stored in a form an attacker can brute-force
at billions of guesses per second. Passwords are hashed **on the server** with a deliberately slow,
salted, memory-hard function — Argon2, scrypt or bcrypt. Hashing in the browser first changes
nothing: the hash becomes the password.

**Secrecy.** A hash is one-way, not encrypted. If the input space is small — an email address, a
phone number, a numeric id — the digest is trivially reversible by trying every input. "We hash
the email so it is anonymous" is not true.

**Integrity against a determined attacker, on its own.** Anyone who can change the content can
change the stored digest. Integrity needs a **signature or a MAC** with a key they do not have —
which is [02](./02-the-rest-and-why-not.md).

## Everything else in `crypto.subtle` is async, and secure-context only

`crypto.subtle` is `undefined` outside a secure context — no `subtle`, no digest, no keys. It is
available in workers, which is where a big hash belongs anyway
([07 · Web Workers](../07-web-workers/03-deciding-and-patterns.md)).

**Feature-detect at the boundary, not per call:**

```js
const canHash = typeof crypto !== 'undefined' && 'subtle' in crypto;
```

## Gotchas

**Symptom: `crypto.randomUUID is not a function`.**
Cause — not a secure context, or an old engine.
Fix — serve over HTTPS (localhost counts); fall back to `getRandomValues` and format the UUID
yourself only if you must support the old engine.

**Symptom: ids collide across users or tabs.**
Cause — `Math.random()`-based generation.
Fix — `crypto.randomUUID()`. The specification never promised uniqueness or unpredictability.

**Symptom: `QuotaExceededError` from `getRandomValues`.**
Cause — asking for more than 65 536 bytes in one call.
Fix — loop in chunks; reconsider why you need that much entropy.

**Symptom: the digest of the same string differs between client and server.**
Cause — different byte encodings, or hashing a JavaScript string representation rather than bytes.
Fix — `TextEncoder` (UTF-8) on both sides, and compare hex of the same case.

**Symptom: `crypto.subtle` is `undefined` on the staging box.**
Cause — plain HTTP.
Fix — HTTPS; check `isSecureContext` in diagnostics before hunting for a browser bug.

**Symptom: hashing a large file freezes the page.**
Cause — `arrayBuffer()` plus a synchronous conversion loop on the main thread.
Fix — do it in a worker, and transfer the buffer rather than copying it.

**Symptom: "we hashed the emails so the data is anonymous" fails review.**
Cause — a small input space makes a hash reversible by enumeration.
Fix — do not treat hashing as anonymisation; use a keyed MAC or do not store the field.

## Interview questions

**★ Why not `Math.random()` for ids or tokens?**
Because the specification requires no cryptographic quality: the sequence is predictable from
prior outputs and collisions across tabs and reloads are real. `crypto.randomUUID()` and
`crypto.getRandomValues()` come from the platform's CSPRNG.

**★ What does `crypto.subtle.digest()` return, and what do you do with it?**
A promise for an `ArrayBuffer`. Wrap it in a `Uint8Array` and convert to hex or base64 yourself —
there is no string form built in — and encode the input with `TextEncoder` first so both sides
agree on bytes.

**★ Is SHA-256 an acceptable way to store passwords?**
No. Fast hashes are exactly what makes password cracking cheap. Passwords are salted and hashed
on the server with a slow, memory-hard function such as Argon2, scrypt or bcrypt — and hashing in
the browser just makes the hash the new password.

**★ Why is `getRandomValues` synchronous when everything else in the API is not?**
Because it only draws entropy — no key material, no algorithm negotiation, nothing that needs to
be scheduled or moved to another thread.

**★ When is hashing in the browser genuinely useful?**
Content-addressed cache keys, detecting an unchanged file before re-uploading it, verifying
something against a digest you already trust. All comparisons, not secrets.

**Why is `crypto.subtle` missing over HTTP?**
It is a secure-context API. So are `randomUUID`, the Clipboard API, service workers and media
devices — the platform will not hand out powerful capabilities to a page an attacker can rewrite
in transit.

---

[Topic index](./README.md) · [02 · The rest, and why you should not](./02-the-rest-and-why-not.md) →
