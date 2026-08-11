---
title: "node:crypto"
sidebar_label: "20 · node:crypto"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (OpenSSL 3.5.7) — every number below is from
> `sandbox/p8-security/ex19-crypto.mjs` on this machine.

`node:crypto` is 52 hash algorithms and 134 ciphers, and you need about six calls from
it. This page is those six, the performance facts that contradict the folklore, and the
two mistakes that turn correct primitives into broken security.

## Hashing

```js
crypto.hash('sha256', data, 'hex');                        // one shot
crypto.createHash('sha256').update(a).update(b).digest();  // streaming
```

`crypto.hash()` is the newer one-shot form and it is meaningfully faster, because it skips
the object:

```console
createHash sha256   713.3 ms / 200k = 3.57 µs
crypto.hash sha256  494.7 ms / 200k = 2.47 µs      same digest -> true
```

Use `createHash` when the input arrives in pieces — a file stream, a request body — and
`crypto.hash` for a value you already hold.

**The algorithm folklore is out of date.** Over a 1 KB input:

```console
md5          5.11 µs        sha256      3.68 µs
sha1         3.42 µs        sha512      6.59 µs
                            blake2b512  4.98 µs
```

**MD5 is the slowest of the three "fast" options here.** Modern CPUs have SHA extensions;
MD5 does not benefit. So "MD5 for speed" is wrong twice over — it is broken *and* slower
than the thing you should have used. There is no remaining reason to choose it, including
for checksums, where sha256 costs less.

`sha512` being slower than `sha256` on a small input is normal at this size; it wins on
large inputs on 64-bit hardware. Neither difference should drive a decision.

## Hashing is not signing

A hash proves the content, not the sender. `sha256(secret + message)` looks like a
signature and is not one:

```console
sha256(secret+msg) -> bb10f1c2e494a9fa61c79f5f4b67b72b…
hmac-sha256        -> 3c820cba9c49eef06147ab7cd053b8be…
```

The naive construction has a specific break: **SHA-2 is length-extendable.** Given
`H(secret‖msg)` and the length of the secret — but *not* the secret itself — an attacker
can compute `H(secret‖msg‖padding‖evil)`, a valid tag for a message they extended. The
classic victim is a signed query string: `user=alice&role=user` becomes
`user=alice&role=user…&role=admin`, and the last value wins.

HMAC exists to close that. It costs 6.87 µs against 3.68 µs for the bare hash — double,
and irrelevant against any I/O:

```js
const tag = crypto.createHmac('sha256', key).update(body).digest();
if (!crypto.timingSafeEqual(tag, Buffer.from(received, 'hex'))) throw new Error('bad signature');
```

Compare with `timingSafeEqual`, never `===` ([page 16](./16-timing-attacks.md)). And note
what HMAC does *not* give you: both sides hold the same key, so it proves *someone with
the key* sent it. Proving *which* party requires asymmetric signing, which is
[page 26](./26-encryption-and-keys.md).

**Pass a `KeyObject`, not a `Buffer`.** The key type changes the cost by 4×, for identical
output:

```console
createHmac(string key)      8.85 µs        createCipheriv(KeyObject)  13.07 µs
createHmac(KeyObject)       9.41 µs        createCipheriv(Buffer key) 38.48 µs
createHmac(Buffer key)     35.91 µs
```

A raw `Buffer` is converted on every call; `crypto.createSecretKey(buf)` once at startup
does it a single time. Since a long-lived key is exactly what you have, this is free
speed — and it applies to ciphers as well as MACs.

## Randomness

Three sources, and only one of them is not for security:

```console
Math.random()                       0.03 µs     NOT random enough for anything secret
crypto.randomUUID()                 0.45 µs
crypto.randomInt(100)               0.08 µs
crypto.randomBytes(16)              5.35 µs
crypto.randomFillSync(buf)          3.29 µs
webcrypto.getRandomValues(u8)       5.52 µs
```

`Math.random()` is a fast PRNG whose internal state is recoverable from a handful of
outputs. Never for tokens, session ids, password-reset links, filenames of anything
private, or shuffling anything that matters.

**`randomUUID` is 12× faster than `randomBytes(16)`** for the same 16 bytes, because it
draws from an internal entropy cache. Turning that off shows the real cost of a syscall
per call:

```console
randomUUID()                             0.45 µs
randomUUID({disableEntropyCache: true})  3.92 µs
```

The cache is fine — it is filled from the same CSPRNG. The option exists for the rare
process that must not hold unused entropy in memory (a forked worker, a hardened
environment).

**A UUIDv4 is 122 bits, not 128** — four bits encode the version and two the variant. For
a session id that is plenty; for a value doing the work of a secret, prefer
`randomBytes(32)`.

```console
randomBytes(16).toString('hex')        32 chars, 128 bits
randomBytes(16).toString('base64url')  22 chars, 128 bits
randomBytes(32).toString('base64url')  43 chars, 256 bits
```

`base64url` is the right encoding for anything that lands in a URL or a header — same
entropy, two-thirds the length, no `+`, `/` or `=` to escape.

**Async when it is large.** `randomBytes(n, cb)` goes to the libuv thread pool; the sync
form blocks:

```console
8 × 1 MB async -> 4.2 ms          8 × 1 MB sync -> 8.2 ms, on the event loop
```

For 16 or 32 bytes the sync call is the right choice — the callback costs more than the
work. For anything kilobyte-scale in a request path, use the async form.

## Modulo bias is real and measurable

The obvious way to get a number in a range is wrong:

```js
crypto.randomBytes(1)[0] % 100        // biased
crypto.randomInt(100)                 // uniform
```

256 does not divide by 100. Values 0–55 can be produced three ways, 56–99 only twice.
Three million samples:

```console
byte % 100       -> min 23207  max 35431  expected 30000   spread 40.7%
                    bucket 0: 35392   bucket 99: 23317
crypto.randomInt -> min 29600  max 30458  expected 30000   spread  2.9%
```

Half the buckets are **50% more likely** than the other half. In a shuffle, a lottery, a
sharding decision or a numeric OTP that is a real exploitable skew, and `crypto.randomInt`
costs 0.08 µs. There is no reason to hand-roll it.

## The two mistakes

**Encoding is not hashing.** Base64 is reversible and carries no secrecy at all:

```console
base64('hunter2') -> aHVudGVyMg==  ->  reversible -> hunter2
```

**A general-purpose hash is not password storage.** `sha256` at 3.68 µs is *designed* to
be fast, which is precisely why it is the wrong tool — see [page 01](./01-password-storage.md)
for scrypt and argon2, where slowness is the feature. The same reasoning makes
`crypto.pbkdf2` acceptable and `crypto.createHash` never acceptable for a password.

## What you actually use

| Need | Call |
|---|---|
| Fingerprint some content | `crypto.hash('sha256', data, 'hex')` |
| Same, streaming | `createHash('sha256').update(…).digest()` |
| Prove a message came from a key holder | `createHmac('sha256', key)` + `timingSafeEqual` |
| Session id, request id | `crypto.randomUUID()` |
| Token, reset link, API key | `crypto.randomBytes(32).toString('base64url')` |
| A number in a range | `crypto.randomInt(max)` |
| Compare two secrets | `crypto.timingSafeEqual` |
| Store a password | none of the above — [page 01](./01-password-storage.md) |

`crypto.webcrypto` is the standards-based alternative to all of this, and it is page 25.

## Gotchas

**Symptom:** A "signed" token can be extended with extra parameters
**Cause:** `sha256(secret + message)` — SHA-2 is length-extendable, so a suffix can be appended without the key.
**Fix:** HMAC. It costs 6.87 µs versus 3.68 µs and closes the construction entirely.

**Symptom:** MD5 was chosen "because it's faster"
**Cause:** Folklore. Measured, MD5 is 5.11 µs against sha256's 3.68 µs on this CPU — SHA extensions, no MD5 equivalent.
**Fix:** sha256 everywhere, including non-security checksums.

**Symptom:** Generated codes or shuffles are visibly skewed
**Cause:** `% n` on random bytes. Measured 40.7% spread across buckets versus 2.9% for `randomInt`.
**Fix:** `crypto.randomInt(max)` — 0.08 µs, uniform, already there.

**Symptom:** Token generation shows up in a profile
**Cause:** `randomBytes` per call, or `disableEntropyCache`, at 5.35 µs and 3.92 µs against `randomUUID`'s 0.45 µs.
**Fix:** `randomUUID()` for ids. Keep `randomBytes(32)` for values that must be secrets — it is not the hot path.

**Symptom:** The event loop stalls when large keys or nonces are generated
**Cause:** Sync `randomBytes` for kilobyte-scale output. Measured 8.2 ms blocking for 8 MB against 4.2 ms async.
**Fix:** The callback form for large sizes; sync is correct for 16–32 bytes.

**Symptom:** Session ids are predictable after a restart
**Cause:** `Math.random()` — a PRNG whose state is recoverable from a few outputs.
**Fix:** `crypto.randomUUID()` or `randomBytes`. `Math.random` is never acceptable for anything secret.

## Interview questions

**★ Why HMAC instead of `hash(secret + message)`?**
Because SHA-2 is length-extendable: knowing `H(secret‖msg)` and the secret's length lets an
attacker compute a valid tag for `msg‖padding‖evil` without ever learning the secret. HMAC's
inner/outer construction prevents it. The cost is 6.87 µs versus 3.68 µs.

**★ Is MD5 faster than SHA-256?**
No, not on modern hardware. Measured on Node 24 / OpenSSL 3.5.7: MD5 5.11 µs, SHA-256
3.68 µs over a 1 KB input, because CPUs have SHA extensions and no MD5 equivalent. MD5 is
broken *and* slower.

**★ What is wrong with `randomBytes(1)[0] % 100`?**
Modulo bias. 256 is not a multiple of 100, so the low buckets are reachable three ways and
the high ones twice — measured, a 40.7% spread over three million samples against 2.9%
for `crypto.randomInt(100)`.

**★ `randomUUID()` or `randomBytes(32)` for a session token?**
Either is fine for a session id; `randomUUID` is 12× faster (0.45 µs vs 5.35 µs) thanks to
its entropy cache, and 122 bits is ample. For a value that *is* a secret — an API key, a
password-reset token — use `randomBytes(32)`, 256 bits, encoded `base64url`.

**When does randomness need the async API?**
When the output is large. `randomBytes(n, cb)` uses the thread pool: 8 MB took 4.2 ms
async against 8.2 ms of blocked event loop synchronously. For 16–32 bytes the sync call is
correct — the callback overhead exceeds the work.

**Why is SHA-256 the wrong way to store a password?**
Because it is fast, which is the attacker's advantage — 3.68 µs per guess. Password
hashing wants a deliberately expensive, memory-hard function: scrypt or argon2, page 01.

---

← Prev: [HTTPS, HSTS and cookie flags](./19-https-hsts-cookies.md) · Next → [Rate limiting](./21-rate-limiting.md)
