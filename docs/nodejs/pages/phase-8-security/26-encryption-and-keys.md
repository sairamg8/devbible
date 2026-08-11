---
title: "Encryption, signing and key management"
sidebar_label: "26 · Encryption and keys"
sidebar_position: 26
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — every output below is from
> `sandbox/p8-security/ex24-encryption-keys.mjs`.

Most application code needs exactly one encryption primitive — **AES-256-GCM** — used
correctly. This page is what "correctly" means, why the modes people reach for first are
wrong, and the key management that decides whether you can ever change anything.

## Why AEAD, and not the mode you learned first

**ECB reproduces structure.** Encrypt the same block twice and get the same ciphertext:

```console
block 0 -> dfe7b06d7fa6cb9189444ed07a3828b5
block 1 -> dfe7b06d7fa6cb9189444ed07a3828b5      <- identical plaintext block
block 2 -> b80a32bd5fccb83b9b7d96a5c4c5e275
```

The plaintext repeated and so did the ciphertext. That is why the famous encrypted-penguin
image is still recognisable.

**CBC hides the pattern and does not detect tampering.** Flip one bit of a CBC ciphertext
and decryption succeeds:

```console
tampered CBC decrypted to -> "h?b?D??T?^R?o]?[ alicd"
no error. CBC has no integrity check; the plaintext just changed.
```

An attacker cannot choose the result, but they can corrupt it, and a system that acts on
corrupted plaintext is exploitable. The failure mode where decryption *does* error —
padding — is worse: it is the oracle behind padding-oracle attacks.

**GCM authenticates.** Same tamper:

```console
ciphertext 22 bytes + tag 16 bytes
tampered GCM -> Unsupported state or unable to authenticate data
```

AEAD — Authenticated Encryption with Associated Data — gives confidentiality and integrity
in one primitive, which is why "encrypt-then-MAC by hand" is no longer a thing you should
build. `AES-256-GCM` in `node:crypto`, or `{ name: 'AES-GCM' }` in Web Crypto
([page 25](./25-web-crypto.md)).

## The one rule: never reuse an IV with the same key

This is not a style preference. Encrypt two messages under one key and one IV, and the
second plaintext falls out with no key involved:

```console
c1 ^ c2 ^ known plaintext -> "transfer $900 to mallo"
```

GCM is a stream cipher: identical key and IV produce an identical keystream, so XORing two
ciphertexts cancels it. An attacker who knows or guesses one message recovers the other —
and with enough reuse, the authentication key itself becomes forgeable.

Two safe patterns:

- **Random 96-bit IV per message.** Simple, and safe to roughly 2³² messages per key
  (~4.3 billion) before birthday collisions matter.
- **A counter**, which is exact — but must be per-key, persisted, and never reset. A
  restart that returns the counter to zero reproduces the output above exactly.

`Buffer.alloc(12)` as an IV, an IV stored in config, or an IV derived from the record id
are all the same bug.

**AAD binds context.** Additional authenticated data is not encrypted but is covered by the
tag, so a ciphertext cannot be moved somewhere it does not belong:

```console
AAD bound -> OperationError with a different AAD
```

Pass the row's owner, the tenant id, or the field name. It turns "swap two users'
encrypted columns" from an attack into a decryption failure.

## Symmetric or asymmetric

```console
HMAC-SHA256 (KeyObject)   9.41 µs     proves "someone with the key" sent it
Ed25519 sign             151.43 µs    proves "this specific holder" sent it
Ed25519 verify           425.44 µs
```

Symmetric is ~16× cheaper and requires the verifier to hold the same secret — which means
the verifier can also forge. That is fine inside one service, and wrong the moment a third
party verifies. Asymmetric costs more and the public key is not a secret.

Among asymmetric options the choice is easy on current Node:

```console
RSA-2048 keygen -> 107.2 ms       Ed25519 keygen -> 0.4 ms
RSA-2048 sign   -> 997.53 µs      Ed25519 sign   -> 151.43 µs
RSA-2048 verify -> 118.73 µs      Ed25519 verify -> 425.44 µs
signature bytes -> 256            signature bytes -> 64
```

**Ed25519 for anything new** — smaller keys, smaller signatures, faster signing, no
parameter choices to get wrong. RSA verifies faster, which matters only if you verify far
more than you sign and cannot change the format; keep it for interoperability, not by
default.

And note the asymmetry in the asymmetry: with RSA the *sign* side is expensive, with
Ed25519 the *verify* side is. Benchmark the direction you actually do most.

## Pass a `KeyObject`

The same finding as [page 20](./20-node-crypto.md), and it applies to ciphers:

```console
gcm encrypt, Buffer key    38.48 µs
gcm encrypt, KeyObject     13.07 µs
```

`crypto.createSecretKey(buf)` once at startup, then reuse it. Identical output, a third of
the cost.

## Key management is the part that decides everything

The algorithm is a one-line decision. These are the ones that hurt later.

**Envelope encryption.** One key-encryption key (KEK) from a KMS, a fresh data-encryption
key (DEK) per row or per file, and the wrapped DEK stored beside the ciphertext:

```console
{"v":1,"kid":"kek-2026-08","iv":"Q/cZaH4K5ZdAmINf","ct":"ymGluk+e…",
 "tag":"1G2cEIxp9FwSdmahYMRtHA==","wrapIv":"bYcRtj4tOgJkJHsU","wrappedDek":"RXF6nfE9…"}
```

Rotating the KEK re-wraps N small DEKs and never re-encrypts the data — which is the
difference between a rotation that takes minutes and one nobody ever performs.

**Every ciphertext carries `v` and `kid`.** Without a version you cannot change algorithm;
without a key id you cannot rotate. Both are two bytes of JSON and the reason a migration
is possible at all.

**Two keys valid at once.** Verification looks up by `kid`, so old and new coexist during
the overlap:

```console
new token verifies -> true
old token verifies -> true      <- both accepted during the overlap
retired kid        -> unknown kid
```

Signing always uses the current key; verification accepts any key still in the map.
Retiring a key is then deleting one entry, and `unknown kid` is a clean, loggable failure
rather than an outage.

**Do not invent the format.** A blob must carry version, key id, IV, tag and ciphertext,
and getting that wrong is discovered years later when you cannot decrypt. Prefer a KMS
that hands you the envelope, libsodium's `crypto_secretbox`, or JWE if you need
interoperability. Hand-rolled formats are where the IV ends up missing.

## Gotchas

**Symptom:** Encrypted columns with the same value look identical in the database
**Cause:** ECB, or a fixed IV. Verified — identical plaintext blocks produced identical ciphertext blocks.
**Fix:** AES-256-GCM with a fresh random IV per message.

**Symptom:** Decryption succeeds but the plaintext is garbage
**Cause:** CBC without a MAC — there is no integrity check, so a corrupted ciphertext just decrypts wrong. Verified.
**Fix:** GCM. Tampering then fails loudly with an authentication error.

**Symptom:** Two ciphertexts under one key reveal each other
**Cause:** IV reuse. Verified — XORing two ciphertexts and one known plaintext recovered the second message.
**Fix:** A random 96-bit IV per message, stored alongside; never a constant, never a resettable counter.

**Symptom:** An encrypted value from one record decrypts in another
**Cause:** No associated data binding the ciphertext to its context.
**Fix:** Pass the owner or field identity as AAD; a mismatch then fails to decrypt.

**Symptom:** You cannot rotate the encryption key without downtime
**Cause:** No `kid` in the stored blob, and the data encrypted directly under the master key.
**Fix:** Envelope encryption plus `v`/`kid`. Rotation re-wraps DEKs instead of re-encrypting data.

**Symptom:** Crypto is unexpectedly slow in a hot path
**Cause:** A raw `Buffer` key on every call — 38.48 µs versus 13.07 µs with a `KeyObject`.
**Fix:** `crypto.createSecretKey` once at startup.

## Interview questions

**★ Why AES-GCM rather than AES-CBC?**
GCM is authenticated: tampering fails with an authentication error, verified. CBC has no
integrity check — a flipped bit decrypted to garbage with no error at all — and its padding
errors are the oracle behind padding-oracle attacks. AEAD gives both properties in one
primitive.

**★ What happens if you reuse an IV in GCM?**
Total loss of confidentiality for those messages. Same key and IV means the same keystream,
so `c1 ^ c2` cancels it — verified, XORing two ciphertexts and one known plaintext returned
the other message in full. With enough reuse the authentication key becomes forgeable too.

**★ How do you rotate an encryption key without re-encrypting the data?**
Envelope encryption: a per-record DEK encrypts the data, the KEK wraps the DEK, and the
wrapped DEK is stored beside the ciphertext with a `kid`. Rotating the KEK re-wraps the
DEKs only. Without `v` and `kid` in the stored format, none of this is possible.

**★ HMAC or a signature?**
HMAC when both sides are yours — measured 9.41 µs, and the verifier holds the same secret,
so it can also forge. An asymmetric signature when a third party verifies, or when
non-repudiation matters: Ed25519 at 151.43 µs to sign, and the public key is not a secret.

**★ RSA or Ed25519 for new work?**
Ed25519. Measured: keygen 0.4 ms versus 107.2 ms, signing 151 µs versus 998 µs, 64-byte
signatures versus 256, and no parameter choices to get wrong. RSA verifies faster
(119 µs versus 425 µs), so keep it only for interoperability or verify-heavy legacy
formats.

**What must a stored ciphertext contain?**
Version, key id, IV/nonce, authentication tag and the ciphertext itself. Miss the version
and you cannot change algorithm; miss the key id and you cannot rotate; miss the IV and you
cannot decrypt at all. Prefer a KMS envelope, libsodium or JWE over a hand-rolled format.

---

← Prev: [Web Crypto API](./25-web-crypto.md) · Next → [Audit logging](./27-audit-logging.md)
