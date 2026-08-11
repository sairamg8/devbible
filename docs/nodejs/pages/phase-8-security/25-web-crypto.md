---
title: "Web Crypto API"
sidebar_label: "25 · Web Crypto"
sidebar_position: 25
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — every output below is from
> `sandbox/p8-security/ex23-webcrypto.mjs`.

The same primitives as [page 20](./20-node-crypto.md), through the standard the browser
uses. It is a global, it is entirely async, and it is stricter than `node:crypto` in ways
that are mostly to your benefit.

## It is already there

```console
globalThis.crypto                 -> Crypto
globalThis.crypto === crypto.webcrypto -> true
globalThis.crypto.subtle          -> SubtleCrypto
```

No import. The same object is reachable as `require('node:crypto').webcrypto`, so there is
no second implementation to keep in step.

**Every operation on `subtle` returns a promise** — `encrypt`, `decrypt`, `sign`, `verify`,
`digest`, `generateKey`, `deriveKey`, `deriveBits`, `importKey`, `exportKey`, `wrapKey`,
`unwrapKey`, and the newer KEM methods. There is no sync escape hatch, which is a design
decision, not an oversight: it keeps the API identical to the browser's, where the
implementation may live outside the JS thread.

## The same answers, more ceremony

```console
subtle.digest('SHA-256', …) -> 2cf24dba5fb0a30e26e83b2ac5b9e29e…
crypto.hash('sha256', …)    -> 2cf24dba5fb0a30e26e83b2ac5b9e29e…
identical -> true
```

HMAC needs a key object first, and the extra step is the whole difference in feel:

```js
const key = await subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const sig = await subtle.sign('HMAC', key, data);
const ok  = await subtle.verify('HMAC', key, sig, data);
```

`verify()` is worth noticing: **the constant-time comparison is inside the API**, so there
is no `timingSafeEqual` for you to forget ([page 16](./16-timing-attacks.md)).

**Import the key once.** Doing it per call more than doubles the cost:

```console
subtle.sign, key imported once     43.11 µs
subtle.sign, importKey each time   97.63 µs
node createHmac (string key)        8.85 µs
```

Web Crypto is several times slower than `node:crypto` here — the promise, the key object
and the argument validation are not free. At tens of microseconds it does not matter for
a per-request signature; it would matter in a tight loop over millions of records.

## What it refuses to do

Strictness is the reason to choose it:

```console
subtle.digest('MD5', …)                      -> NotSupportedError
importKey(…, 'scrypt', …)                    -> NotSupportedError
exportKey on an extractable:false key        -> InvalidAccessError: key is not extractable
```

No MD5. No SHA-1 signing. **And `extractable: false` is a property `node:crypto` cannot
express** — a `KeyObject` can always be exported. A non-extractable key still encrypts and
signs; the bytes simply never become something your code can print into a log or send in
an error. For a long-lived key held in a service, that is a real containment property.

Keys also carry their permitted operations, so a verify-only key cannot sign:

```console
public key as JWK -> {"key_ops":["verify"],"ext":true,"alg":"Ed25519","crv":"Ed25519",…}
```

## Choosing between the two

| | `node:crypto` | Web Crypto |
|---|---|---|
| Sync API | ✅ | ❌ async only |
| Streaming (`Cipher`, `Hash` as streams) | ✅ | ❌ one-shot buffers |
| scrypt, legacy digests, X.509, DH groups | ✅ | ❌ |
| `extractable: false` | ❌ | ✅ |
| Constant-time verify built in | ❌ (`timingSafeEqual`) | ✅ |
| Runs unchanged in browsers, Deno, Bun, Workers | ❌ | ✅ |
| Speed | faster | ~4–5× slower at this scale |

The rule that survives contact with a real codebase:

- **Code shared with the browser or an edge runtime → Web Crypto.** A token verifier used
  by both a Node API and a Cloudflare Worker should exist once.
- **Server-only, streaming, or password hashing → `node:crypto`.** Streaming a 2 GB file
  through `createHash` has no Web Crypto equivalent, and scrypt/argon2 are not in the
  standard.
- **Do not mix them for one concern.** Two ways to make a signature in one repo is how the
  second one ends up without `timingSafeEqual`.

## Password hashing is the trap

`deriveKey` with PBKDF2 exists and is not the answer to password *storage*:

```console
PBKDF2 600k iterations -> 292.9 ms, key type AES-GCM
```

That is deriving an **encryption key from a passphrase**, which is a legitimate use. For
storing user passwords you want a memory-hard function, and Web Crypto has none — see
[page 01](./01-password-storage.md). PBKDF2 is the fallback where nothing better exists,
at a high iteration count, and it is materially weaker against GPU attack than scrypt or
argon2.

## Gotchas

**Symptom:** `NotSupportedError` from `subtle.digest`
**Cause:** MD5 or another legacy algorithm — Web Crypto does not implement them. Verified.
**Fix:** Use SHA-256. If you genuinely need MD5 for a legacy checksum, that is a `node:crypto` job.

**Symptom:** Signing shows up in a profile
**Cause:** `importKey` on every call — measured 97.63 µs versus 43.11 µs with the key imported once.
**Fix:** Import at startup and reuse the `CryptoKey`.

**Symptom:** `InvalidAccessError: key is not extractable`
**Cause:** The key was generated with `extractable: false`, which is usually correct.
**Fix:** Do not export it. If you must persist it, generate it extractable and wrap it with `wrapKey`.

**Symptom:** `The operation failed for an operation-specific reason` on decrypt
**Cause:** `OperationError` from AES-GCM — a wrong key, wrong IV, wrong AAD, or tampered ciphertext. The API deliberately does not say which.
**Fix:** Check your IV and AAD handling; see [page 26](./26-encryption-and-keys.md).

**Symptom:** A key signs when it should only verify
**Cause:** Over-broad `keyUsages` at import.
**Fix:** Pass the minimum — `['verify']` for a public key — since usages are enforced.

## Interview questions

**★ When would you choose Web Crypto over `node:crypto`?**
When the code must also run in a browser, a Worker or another runtime — the API is
identical everywhere. Also when you want `extractable: false`, which `node:crypto` cannot
express, or the built-in constant-time `verify()`. Stay on `node:crypto` for streaming,
scrypt, X.509 and sync calls.

**★ What does `extractable: false` buy you?**
The key material can never be read back into JavaScript — verified, `exportKey` throws
`InvalidAccessError`. The key still encrypts and signs, so a bug or an injected dependency
cannot log or exfiltrate the bytes. There is no equivalent for a `node:crypto` `KeyObject`.

**★ Why is everything on `subtle` async?**
Because the standard is the browser's, where the implementation may run off-thread or in
hardware. It also means you cannot accidentally block the event loop on a key derivation —
`deriveKey` at 600 000 PBKDF2 iterations took 292.9 ms, which would be a disaster
synchronously.

**Is it slower?**
Yes, at this scale — 43.11 µs per HMAC signature against 8.85 µs for `node:crypto` with a
string key, and worse if you re-import the key each time. Irrelevant per request,
significant in a tight loop.

**Can you hash passwords with it?**
Not well. There is no scrypt or argon2 — `importKey(…, 'scrypt', …)` throws
`NotSupportedError`. PBKDF2 at a high iteration count is the fallback; page 01 is the real
answer.

---

← Prev: [The Permission Model](./24-permission-model.md) · Next → [Encryption, signing and key management](./26-encryption-and-keys.md)
