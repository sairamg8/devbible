---
title: "Once a value is on the security side of the line, the API choice is small and mostly mechanical — getRandomValues or randomUUID in JavaScript, SecureRandom in Java — and the mistakes that remain are about which constructor, where crypto resolves from, and the fact that setSeed means the opposite thing on the secure class"
sidebar_label: "10j · The secure APIs, in both languages"
sidebar_position: 10.45
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN
> [`Crypto.getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
> and the JDK 25 javadocs for
> [`java.security.SecureRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/SecureRandom.html)
> and [`java.util.concurrent.ThreadLocalRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadLocalRandom.html)
> — every quoted sentence below is verbatim from those pages. ⚠️ Token lengths, storage and
> comparison advice are **common security practice, stated as such and not cited**. ⚠️ Nothing is
> claimed about whether `getInstanceStrong` blocks on entropy, or about Node's `crypto` module
> resolution beyond what is stated as mechanism. Java targets **JDK 25**. **No sandbox run.**

**[10e](10e-the-security-boundary.md) decides which side of the line a value is on; this chunk is
what you actually type once it is on the secure side.** The API surface is small, which is the good
news, and the remaining mistakes are not about randomness at all — they are about which constructor
you called, which `crypto` the identifier resolved to, and one method that means the opposite of
what the same name means on the non-secure class.

## JavaScript

```ts
// A URL-safe token. 32 bytes = 256 bits of entropy.
function token(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const id = crypto.randomUUID();   // a v4 UUID, for when you want an id rather than a secret
```

`getRandomValues` accepts integer typed arrays only, and MDN documents the ceiling —
*"`QuotaExceededError` - Thrown if the `byteLength` of `typedArray` exceeds 65,536"* — which is
generous for a token and a real limit if you try to fill a pool in one call.

⚠️ **`crypto.randomUUID()` produces a 128-bit value of which some bits are fixed** by the UUID
version and variant, so it is **not** 128 bits of entropy. It is an excellent identifier and an
adequate secret for many purposes; if you need a *stated* number of bits, generate the bytes
yourself and say how many.

🔴 **`crypto` is a global in browsers and in modern Node, but the identifier can still resolve to
something else** — a bundler shim, a polyfill package, an application-level `crypto` import. If the
generator is security-relevant, import it explicitly (`import { webcrypto } from 'node:crypto'`, or
`node:crypto`'s `randomBytes`) rather than relying on a bare global whose provenance a reader
cannot see from the call site.

## Java

```java
// Long-lived, high-value secrets.
SecureRandom strong = SecureRandom.getInstanceStrong();

// General security-relevant randomness.
SecureRandom rnd = new SecureRandom();
byte[] buf = new byte[32];
rnd.nextBytes(buf);
String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
```

The javadoc's own guidance on `getInstanceStrong`:

> *"Returns a `SecureRandom` object that was selected by using the algorithms/providers specified in
> the `securerandom.strongAlgorithms` `Security` property. Some situations require strong random
> values, such as when creating high-value/long-lived secrets like RSA public/private keys."*

⚠️ Whether `getInstanceStrong` can block waiting for system entropy depends on the configured
provider and the platform's entropy source. **The javadoc fetched for this page does not say so, and
this page therefore does not claim it** — but it is the question to ask before calling it on a
request path, and it is the reason `new SecureRandom()` is the usual choice for per-request tokens
while `getInstanceStrong` is reserved for key material generated once at setup.

## The one method that inverts

> *"The seed supplements, rather than replaces, the existing seed. Thus, repeated calls are
> guaranteed never to reduce randomness."* — `SecureRandom.setSeed`

`new Random(42)` **replaces** the seed and makes the sequence reproducible;
`secureRandom.setSeed(42)` does not, and cannot be used to make a `SecureRandom` deterministic.
That is a deliberate design difference — a security class must not offer an API that weakens it —
and it is why the seeded-for-testing pattern ([10f](10f-seeding-and-reproducibility.md)) has to
*inject a different generator* rather than seed the secure one.

`ThreadLocalRandom` goes further and refuses outright: `setSeed` is documented to throw
`UnsupportedOperationException`. It is also documented as *"not cryptographically secure"*, so it
belongs on the other side of the line entirely — it is a contention fix, never a security fix.

## Choosing, in one table

| Need | JavaScript | Java |
|---|---|---|
| session token, reset link, API key | `crypto.getRandomValues` | `new SecureRandom()` |
| long-lived key material | `crypto.getRandomValues`, more bytes | `SecureRandom.getInstanceStrong()` |
| a public identifier, unguessability not required | `crypto.randomUUID()` | `UUID.randomUUID()` |
| a randomised pivot, jitter, sampling | `Math.random()` | `ThreadLocalRandom.current()` |
| reproducible test data | a seeded PRNG you control | `new Random(seed)` |

🔴 **The bottom two rows are not a compromise, they are the correct answer.** Reaching for
`SecureRandom` inside a sorting loop or a retry-jitter calculation buys nothing and costs
throughput; see [10g](10g-the-randomised-pivot.md).

## Gotchas

**★ Symptom: `ThreadLocalRandom.current().setSeed(…)` throws
`UnsupportedOperationException`.** Cause: it is documented not to be seedable — the class exists to
remove contention, and a per-thread generator whose seed a caller can pin is not that. Fix: inject a
`Random(seed)` for the test path; do not attempt to make `ThreadLocalRandom` deterministic.

**★ Symptom: security-relevant randomness generated in a Node process and `crypto` resolves to the
wrong thing** — a bundler shim, a userland package, an application module of the same name. Cause:
relying on a bare global identifier for a security decision. Fix: import explicitly from
`node:crypto` and let the call site name its source; a reviewer should not have to resolve module
scope to know whether a token is secure.

**★ Symptom: a UUID used where a stated number of entropy bits was required.** Cause: reading "128
bits" off the length. Fix: a v4 UUID fixes several bits for version and variant, so the entropy is
less than the length suggests. Generate bytes explicitly whenever the requirement is expressed in
bits.

**★ Symptom: `getInstanceStrong` called per request and latency becomes erratic under load.**
Cause: treating the strong instance as the default rather than as the setup-time choice. Fix: use
`new SecureRandom()` on the request path and reserve `getInstanceStrong` for key material; if the
strong instance is genuinely required, create it once and reuse it rather than per call.

**★ Symptom: `getRandomValues` throws `QuotaExceededError`.** Cause: asking for more than the
documented 65,536-byte ceiling in a single call, usually while pre-filling a pool. Fix: loop in
chunks — or, better, stop pooling, since a pool of random bytes is a secret at rest with none of the
protections a secret at rest normally gets.

**Symptom: a `SecureRandom` created per call in a tight loop.** Cause: symmetry with
`new Random()`, which is cheap. Fix: `SecureRandom` instances are thread-safe and intended to be
reused; construct once and share. The construction, not the generation, is the expensive part.

**Symptom: a token generated correctly and then truncated for a prettier URL.** Cause: treating the
encoded string as cosmetic. Fix: the entropy is in the bytes; cutting the base64 output cuts the
entropy proportionally, and a 43-character token trimmed to 12 has 72 bits, not 256. Decide the byte
count first and encode all of it.

## Interview questions

**★ `Random`, `ThreadLocalRandom`, `SecureRandom` — when each?**
`Random` when you want a reproducible sequence from a seed: test fixtures, simulations, anything you
must be able to replay. `ThreadLocalRandom` when you want the same statistical quality without the
contention of one shared instance across threads — the javadoc names that contention explicitly as
the reason it exists — and it is documented as not cryptographically secure, so it is a performance
choice and never a security one. `SecureRandom` whenever an adversary who has seen previous outputs
must not be able to predict the next one: tokens, reset links, API keys, anything that grants
access. The tell that someone has the model right is whether they mention that `ThreadLocalRandom`
is *not* a security upgrade over `Random` — the two sit on the same side of the line.

**★ Why can `Random` be seeded and `SecureRandom` not, when both have a `setSeed` method?**
Because a security class must not expose an API that weakens it. `Random(seed)` replaces the
generator's state, which is exactly the reproducibility people want from it; `SecureRandom.setSeed`
is documented to *supplement* rather than replace — *"repeated calls are guaranteed never to reduce
randomness"* — so a caller cannot pin the sequence even by calling it. `ThreadLocalRandom` takes the
strictest line and throws. The practical consequence is that "seed it for the test" is not available
for secure generators, and a testable design has to inject the generator instead.

**★ How do you make a token generator testable without weakening it?**
Inject the source. The production wiring passes a `SecureRandom` or `crypto.getRandomValues`; the
test passes a stub that yields a scripted byte sequence. What gets tested is the encoding, the
length, the URL-safety and the storage path — none of which needs real randomness — while the
generator itself stays unseedable in production. The anti-pattern is a `testMode` flag inside the
generator, because it puts a code path that produces predictable tokens inside the shipped binary.

**Someone proposes pre-generating a pool of tokens at startup for latency. What do you say?**
That it converts a cheap per-request operation into a secret at rest. The pool has to live
somewhere — memory, a table, a cache — and every one of those has weaker protections than "generated
and immediately hashed". It also complicates the failure story: a process restart either wastes the
pool or, worse, persists it. `getRandomValues` and `SecureRandom.nextBytes` are not the bottleneck
in a request that also touches a database, so the latency argument usually does not survive being
measured — and the right first move is to ask for that measurement.

**Why import `crypto` explicitly rather than use the global?**
Because a security property should be readable at the call site. A bare `crypto` can resolve to the
Web Crypto global, a bundler's polyfill, a userland package or an application module with the same
name, and the four differ in exactly the property that matters. `import { randomBytes } from
'node:crypto'` states the source in the file that depends on it, so a reviewer can confirm the
guarantee without resolving module scope — and a build change that swaps the implementation breaks
the import rather than silently downgrading the randomness.

---

← Prev: [10e · The security boundary](10e-the-security-boundary.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [10f · Seeding and reproducibility](10f-seeding-and-reproducibility.md)
