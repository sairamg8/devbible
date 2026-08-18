---
title: "UUID and randomness"
sidebar_label: "07 · UUID and randomness"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `UUID`, `Random`,
> `ThreadLocalRandom`, `SecureRandom`, `SplittableRandom` and
> `RandomGenerator`, JEP 356 (Enhanced Pseudo-Random Number Generators,
> JDK 17), and RFC 9562 (UUID formats, including version 7).

**Java gives you four ways to ask for randomness, and exactly one of them
is safe for anything an attacker might want to guess. `Random` is a
predictable formula, `ThreadLocalRandom` is the same formula without the
contention, `SplittableRandom` is for forking parallel work — and
`SecureRandom` is the only cryptographically strong source. The daily
decision is not "which is fastest", it is "does anyone benefit from
predicting this value" — session tokens, password-reset links, API keys:
`SecureRandom`, no exceptions.**

## `UUID.randomUUID()` — what you actually get

`randomUUID()` returns a **version 4** UUID: 122 random bits (6 of the 128
are fixed as version and variant markers), generated internally from a
`SecureRandom` instance. That means:

- Collisions are a non-concern at any realistic scale — the birthday bound
  on 122 bits sits far beyond what a service will ever generate.
- The value is safe to expose in URLs and APIs: it is unguessable *because
  the JDK used a CSPRNG*, not because UUIDs are magic.

```java
UUID id = UUID.randomUUID();          // version 4, SecureRandom-backed
String wire = id.toString();          // 36 chars: 8-4-4-4-12 lowercase hex
UUID back = UUID.fromString(wire);
```

`UUID` is a value class holding two `long`s — `equals`, `hashCode` and
`compareTo` all work; it is fine as a `HashMap` key or a record component.

### v4 vs v7 — the database argument

RFC 9562 (2024) standardized **version 7**: a 48-bit Unix-millisecond
timestamp followed by random bits. The point is **index locality**: v4
keys arrive in random order, so a B-tree primary key on v4 takes inserts
at random leaf pages — page splits, cold caches, write amplification. v7
keys arrive roughly ordered, so inserts append like a sequence while
staying globally unique and non-coordinated.

**The JDK has no v7 generator** — `UUID.randomUUID()` is v4 only, and no
`UUID` factory for v7 exists as of JDK 25. If you want v7 you build the 16
bytes yourself per the RFC (timestamp + `SecureRandom` bits, set version
and variant fields) and wrap them via the `UUID(long, long)` constructor,
or use a library. The class stores whatever bits you give it —
`version()` simply reports the marker bits.

Practical stance: v4 for tokens and identifiers that never hit a clustered
index; consider v7 (or a DB sequence) when the UUID is a primary key in a
write-heavy table.

## The four generators, and the one decision

| Class | Backed by | Safe for tokens? | Use it for |
|---|---|---|---|
| `Random` | LCG formula, 48-bit state | **No** — fully predictable from outputs | legacy APIs, reproducible tests via a fixed seed |
| `ThreadLocalRandom` | same family, per-thread state | **No** | simulations, jitter, load-test data on many threads |
| `SplittableRandom` | splittable stream algorithm | **No** | forked parallel tasks; `splits()` feed independent streams |
| `SecureRandom` | OS entropy + CSPRNG | **Yes** | tokens, keys, IVs, password-reset links, anything guessable-matters |

Two mechanics worth knowing:

- `Random` is thread-safe but contended — every `nextInt` CASes shared
  state. `ThreadLocalRandom.current().nextInt(...)` removes the
  contention; never call `current()` once and stash the instance in a
  field another thread might use.
- Since **JEP 356 (JDK 17)** all of these implement the
  `RandomGenerator` interface, and
  `RandomGenerator.of("L64X128MixRandom")` (or `.getDefault()`) selects
  from a family of modern LXM algorithms with better statistical
  behaviour than `Random`'s 1995 LCG. Code against `RandomGenerator` when
  the algorithm is a detail; the interface also carries the full
  `ints()`/`longs()`/`doubles()` stream methods.

## `SecureRandom` in practice

```java
SecureRandom rng = new SecureRandom();   // the right default
byte[] tokenBytes = new byte[32];        // 256 bits of entropy
rng.nextBytes(tokenBytes);
String token = Base64.getUrlEncoder().withoutPadding()
                     .encodeToString(tokenBytes);  // 43 chars, URL-safe
```

That is the whole token recipe: **`SecureRandom` bytes → Base64url**.
Entropy sizing: 128 bits (16 bytes) is the accepted floor for an
unguessable token; 256 bits costs nothing and ends the conversation.

- `new SecureRandom()` picks the platform's preferred strong-enough
  implementation (`NativePRNG`/`DRBG` family on Linux). It is what you
  want in services.
- `SecureRandom.getInstanceStrong()` returns the platform's *strongest*
  configured algorithm — on Linux historically `/dev/random`-backed. The
  Javadoc positions it for high-value, long-lived key material (e.g. RSA
  keypairs), not per-request tokens.
- **The blocking myth**: "SecureRandom blocks and is slow" dates from
  `/dev/random`'s old entropy-pool accounting. Modern Linux kernels
  (5.6+) make `getrandom(2)` non-blocking once the pool is initialized,
  and the JDK's default `NativePRNG` reads `/dev/urandom` for `nextBytes`
  anyway. After boot-time initialization, the default `SecureRandom` does
  not meaningfully block. Don't downgrade to `Random` "for performance" —
  measure first, and generate tokens, not excuses.
- Never seed it yourself with `setSeed` at construction "to add entropy" —
  for `NativePRNG` the call *supplements* the seed, but hand-rolled seed
  material is at best a no-op and at worst (with explicit `SHA1PRNG` and
  setSeed-before-use) **replaces** OS entropy with your guessable value.

## Reproducibility — the legitimate use of seeds

```java
Random fixture = new Random(42L);        // same sequence every run
```

Tests and simulations *want* determinism: a seeded `Random` (or better,
`RandomGenerator.of("L64X128MixRandom")` seeded via a factory) gives
reproducible failures. That is the flip side of the same property that
disqualifies these classes for security: given the seed — or, for
`Random`, roughly two consecutive outputs — the entire future sequence is
computable.

For parallel streams, prefer `SplittableRandom`/the LXM generators:
`ThreadLocalRandom` inside a parallel pipeline works, but
`new SplittableRandom(seed).split()` per task gives independent,
reproducible sub-sequences — which a shared seeded `Random` cannot
(interleaving destroys determinism; see
[parallel streams](../phase-4-lambdas-streams/09-parallel-streams.md)).

## Gotchas

**Symptom:** password-reset tokens occasionally guessed; audit finds `new Random()` feeding the token generator
**Cause:** `Random`'s 48-bit LCG state is recoverable from a couple of observed outputs; every future token becomes predictable
**Fix:** `SecureRandom` bytes → Base64url; rotate anything issued under the old generator

**Symptom:** `Math.random()` used for a shuffle key; duplicate "random" values across service instances started at the same time
**Cause:** `Math.random()` is one shared seeded `Random`; identical seed timing produces correlated sequences — and it returns `double`, tempting truncation bugs
**Fix:** `ThreadLocalRandom.current()` for non-security randomness; `SecureRandom` when guessing matters

**Symptom:** throughput collapses on a 32-core box in code that calls `sharedRandom.nextInt()` in a hot loop
**Cause:** `Random` is thread-safe via CAS on one shared seed — all cores serialize on that state
**Fix:** `ThreadLocalRandom.current().nextInt()` at the call site (do not cache the instance in a field)

**Symptom:** `ThreadLocalRandom` stored in a field at startup; two request threads see interleaved, statistically broken sequences
**Cause:** `current()` returns the *calling* thread's generator; sharing the reference reuses one thread's state from many threads without the thread-local guarantee
**Fix:** always `ThreadLocalRandom.current()` inline; if an instance must be passed around, use `SplittableRandom` splits or a `RandomGenerator` per task

**Symptom:** UUID primary key table shows heavy page splits and a bloated index; DBA blames "UUIDs"
**Cause:** v4 values are uniformly random, so B-tree inserts land on random pages — no locality
**Fix:** v7 (time-ordered) via a library or hand-built per RFC 9562, or keep v4 for the API and use a bigserial surrogate as the clustered key

**Symptom:** startup on a hermetic CI container hangs in key generation
**Cause:** `getInstanceStrong()` on a blocking entropy source before the kernel pool initializes — rare on modern kernels but real in minimal VMs early in boot
**Fix:** default `new SecureRandom()` for runtime needs; reserve `getInstanceStrong()` for long-lived key material generated where entropy is known-good

**Symptom:** code review finds `UUID.fromString(userInput)` throwing `IllegalArgumentException` intermittently in prod logs
**Cause:** `fromString` requires the exact 8-4-4-4-12 hyphenated form; clients sent unhyphenated or uppercase-with-braces variants
**Fix:** validate/normalize at the boundary; treat the exception as a 400, not a 500

## Interview questions

**★ Which of Java's random generators is safe for session tokens, and why are the others not?**
Only `SecureRandom` — it draws from OS entropy through a CSPRNG, so outputs are computationally unpredictable. `Random`, `ThreadLocalRandom` and `SplittableRandom` are deterministic formulas: observing a little output (or knowing the seed) reveals the whole sequence.

**★ What does `UUID.randomUUID()` guarantee, and what version is it?**
Version 4: 122 random bits from an internal `SecureRandom`, plus fixed version/variant bits. Collision probability is negligible at any practical scale, and values are unguessable — safe to expose.

**★ Why do time-ordered UUIDs (v7) matter for databases, and can the JDK make them?**
v4 keys insert at random B-tree pages → splits and cache misses; v7 leads with a millisecond timestamp, so inserts cluster like a sequence while staying distributed-safe. The JDK has no v7 factory as of 25 — build the bytes per RFC 9562 or use a library.

**★ `Random` vs `ThreadLocalRandom` — what problem does the latter solve?**
Contention, not quality: `Random` is one CAS-guarded state shared across threads; `ThreadLocalRandom.current()` gives each thread its own state with the same statistical family. Neither is cryptographically safe.

**★ What did JEP 356 change?**
A common `RandomGenerator` interface over all generators, named algorithms (`RandomGenerator.of("L64X128MixRandom")`), and the LXM family with better statistical properties and splittable/jumpable capabilities — so code can depend on the interface and choose algorithms by name.

**★ Sketch a correct API-token generator.**
`SecureRandom.nextBytes` into a 32-byte array, encode with `Base64.getUrlEncoder().withoutPadding()`. 256 bits of entropy, URL-safe, no format to validate — compare with `MessageDigest.isEqual` if tokens are stored hashed.

**★ When is seeding a generator correct, and when is it a bug?**
Correct for reproducibility — tests, simulations, generated fixtures — on `Random`/`SplittableRandom`/LXM generators. A bug when applied to `SecureRandom` in the belief it "adds entropy": the OS already seeds it; explicit seeding of some algorithms replaces good entropy with guessable material.

---

← Prev: [Regex](06-regex.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [Java serialization](08-java-serialization.md)
