---
title: "There is a hard line between randomness that only has to look shuffled and randomness that has to be unguessable by someone who has already seen a thousand of your outputs, and both platforms print the warning in their own docs — Math.random and java.util.Random are on the wrong side of it"
sidebar_label: "10e · The security boundary"
sidebar_position: 10.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN,
> [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)
> and [`Crypto.getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues),
> and the JDK 25 javadocs for
> [`java.util.Random`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html),
> [`java.util.concurrent.ThreadLocalRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadLocalRandom.html)
> and [`java.security.SecureRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/SecureRandom.html)
> — every warning below is quoted verbatim from the class that carries it. ⚠️ Token lengths,
> expiry policies and storage advice are **common security practice, stated as such and not cited**;
> no standard is quoted for them. ⚠️ Nothing is claimed about how any specific generator's state can
> be recovered, or about whether `getInstanceStrong` blocks — see the notes in the text.
> **No sandbox run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Both platforms ship the warning in the documentation of the function people misuse, and both
warnings are one sentence long.** The distinction they are drawing is not "good randomness" versus
"bad randomness" — it is *statistical quality* versus *unpredictability to an adversary who has
observed your previous output*. A generator can pass every distribution test and still be trivially
predictable, because those are different design goals, and a fast generator has been optimised for
the first at the explicit expense of the second. This page draws the line, quotes both platforms,
and then walks the values in a typical PERN storefront to say which side of the line each one sits
on — because the interesting cases are not "session token: obviously secure" but the ones where it
depends on what the value is used for. The APIs themselves, once a value is on the secure side, are
[10j](10j-the-secure-apis-in-both-languages.md).

## The two warnings, verbatim

MDN, on `Math.random()`:

> *"`Math.random()` does not provide cryptographically secure random numbers. Do not use them for
> anything related to security. Use the Web Crypto API instead, and more precisely the
> `Crypto.getRandomValues()` method."*

The JDK, on `java.util.Random`:

> *"Instances of `java.util.Random` are not cryptographically secure. Consider instead using
> `SecureRandom` to get a cryptographically secure pseudo-random number generator for use by
> security-sensitive applications."*

And on `ThreadLocalRandom`, which people reach for as the "modern" `Random` and which carries the
same warning:

> *"Instances of `ThreadLocalRandom` are not cryptographically secure."*

Three classes, three explicit disclaimers. **There is no version of this argument where you have to
infer the risk.**

## What the boundary actually is

A pseudo-random generator maintains internal state and produces output as a deterministic function
of it. "Statistically good" means the output passes tests for uniformity and independence.
"Cryptographically secure" is a strictly stronger and quite different requirement: an observer who
has seen arbitrarily many outputs must be unable to predict the next one or recover the previous
ones. The JDK states that requirement directly:

> *"This class provides a cryptographically strong random number generator (RNG)."*

> *"A cryptographically strong random number minimally complies with the statistical random number
> generator tests specified in *FIPS 140-2, Security Requirements for Cryptographic Modules*,
> section 4.9.1."*

> *"Additionally, `SecureRandom` must produce non-deterministic output. Therefore, any seed material
> passed to a `SecureRandom` object must be unpredictable, and all `SecureRandom` output sequences
> must be cryptographically strong, as described in *RFC 4086: Randomness Requirements for
> Security*."*

Notice that the statistical tests are the **minimum**, and non-determinism is stated as an
additional requirement on top. That is the boundary in one sentence: a fast generator is designed to
satisfy the first clause and is not designed to satisfy the second.

⚠️ This page does **not** claim how many outputs of any particular non-cryptographic generator
suffice to recover its state. That number depends on the algorithm, none of the fetched documents
gives one, and a figure invented here would be worthless. The load-bearing fact is the design goal,
and the documentation states it.

MDN's description of the secure side is equally careful, and worth quoting because it corrects a
common misreading:

> *"To guarantee enough performance, implementations are not using a truly random number generator,
> but they are using a pseudo-random number generator seeded with a value with enough entropy. The
> pseudo-random number generator algorithm (PRNG) may vary across user agents, but is suitable for
> cryptographic purposes."*

So `crypto.getRandomValues` is still a *pseudo*-random generator. What makes it usable for security
is the seeding from a high-entropy source and the algorithm's resistance to prediction — not some
notion of "true" randomness.

## Which values in a storefront are on which side

Walk the actual values, because the classification is not obvious for half of them.

**Unambiguously security-relevant — must be `crypto.getRandomValues` / `SecureRandom`:**

- **Session identifiers and "remember me" tokens.** Possession of the value *is* authentication.
- **Password reset links.** Same: the token in the URL is a temporary credential, and it arrives by
  email, which is a channel you do not control.
- **Email verification and invite codes**, for the same reason.
- **CSRF tokens**, whose entire job is being unguessable to a third-party page.
- **API keys and webhook signing secrets**, which are long-lived.
- **One-time passcodes**, where the space is small — six digits — so predictability and rate
  limiting are the whole defence.

**Not security-relevant, so `Math.random()` is fine:**

- A shuffled recommendation strip, a randomised A/B bucket, jitter on a retry backoff, a random
  pivot in quickselect ([10g](10g-the-randomised-pivot.md)), the random keys in a sampling
  algorithm.

**It depends, and this is where the real bugs are:**

- **Order ids.** If an order id is only an identifier and every read of an order is authorised
  against the session, a sequential id is fine and predictability is not a vulnerability. If the
  order page is reachable by URL without an authorisation check, the id *is* the credential and a
  guessable one is an enumeration hole — the classic insecure-direct-object-reference. **The bug is
  the missing authorisation check, and an unguessable id is defence in depth, not a substitute.**
  Say both halves of that in an interview; saying only the second is the common wrong answer.
- **Sequential ids leak volume.** Even when authorisation is correct, ids that increment tell any
  customer how many orders you took between two purchases. Whether that matters is a business
  question, not a security one, but it is the reason many public-facing ids are random.
- **Uploaded file names.** A file name derived from `Math.random()` is both guessable and
  collision-prone; if uploads are served from a public bucket, the name is again the credential.
- **Coupon and referral codes.** A code that is short enough to be typed is short enough to be
  brute-forced, so the defence is rate limiting plus enough entropy, and generating them from a
  fast generator undermines both.

## Gotchas

**★ Symptom: password reset tokens generated with `Math.random().toString(36).slice(2)`.** Cause: the
idiom is everywhere and looks like a random string. Fix: `crypto.getRandomValues`. Two independent
problems: the generator is not cryptographically secure — MDN says so in the method's own
documentation — and the base-36 string carries only as many bits as the underlying double supplied,
which is far short of what a credential wants. **This is the single highest-severity misuse in this
whole topic.**

**★ Symptom: a "secure" token built by concatenating several `Math.random()` calls to get more
characters.** Cause: mistaking length for entropy. Fix: length from a predictable generator is not
entropy — successive outputs come from the same evolving state, so an observer who can predict one
can predict the rest. More calls to the wrong generator do not add unpredictability.

**★ Symptom: `SecureRandom` used for the random pivot inside a hot sorting loop.** Cause: treating
"more secure" as "strictly better". Fix: use a fast generator where predictability is not a threat.
The pivot in [10g](10g-the-randomised-pivot.md) is only adversarially relevant if an attacker
controls the input *and* can observe timing precisely enough to infer your pivots — a real concern
in a public API accepting arbitrary arrays, and irrelevant for an internal batch job. Name the
threat model, then choose.

**★ Symptom: `ThreadLocalRandom` adopted specifically to fix a security review finding.** Cause:
reading it as the modern replacement for `Random` in all respects. Fix: it is the modern replacement
for *contention*, and its javadoc carries the identical warning — *"Instances of `ThreadLocalRandom`
are not cryptographically secure."* The security fix is `SecureRandom`; the contention fix is
`ThreadLocalRandom`; they are orthogonal.

**★ Symptom: a token compared with `==` or `String.equals` and a security review flags it.** Cause:
a comparison that returns early on the first differing byte leaks, through timing, how much of the
guess was right. Fix: a constant-time comparison — `MessageDigest.isEqual` in Java. ⚠️ This is
**common practice stated as such**; no javadoc was fetched for it on this page. It is included
because generating a token correctly and then comparing it carelessly is a complete pair of
mistakes and people fix only the first.

**★ Symptom: reset tokens stored in the database in plain text.** Cause: treating the token as data
rather than as a credential. Fix: store a hash of it, exactly as you would a password, so that a
database read does not hand over live reset links. Also single-use and short-expiry. ⚠️ Common
practice, not cited here.

**★ Symptom: an order id switched to a UUID and the authorisation check quietly dropped because "the
id is unguessable now".** Cause: substituting entropy for access control. Fix: keep the check. An
unguessable id narrows the attack surface and does nothing about a leaked URL, a referrer header, a
shared screenshot, or an authenticated user probing another tenant's ids that they legitimately
learned.

**★ Why can't you use `Math.random()` for a session token?**
Because it is not designed to be unpredictable, and MDN says so in its own documentation:
*"`Math.random()` does not provide cryptographically secure random numbers. Do not use them for
anything related to security."* The design goal of a fast generator is statistical quality — passing
uniformity and independence tests — while a cryptographic generator must additionally resist an
adversary who has observed prior output from predicting future output. A session token's entire
security property is unpredictability, so the wrong generator makes the token forgeable in
principle, regardless of how random the output looks. Use `crypto.getRandomValues`.

**★ Is a UUID a secure token?**
A version-4 UUID is 128 bits with several fixed for the version and variant, generated — in a
correct implementation — from a cryptographic source, so it is unguessable in practice and is widely
used as one. Two caveats worth stating. It is not 128 bits of entropy, so if you have a stated
entropy requirement, generate raw bytes instead. And UUIDs from other versions are not random at all
— time- and node-based versions are structured and partially predictable — so "it's a UUID" is not
by itself an answer; "it's a v4 UUID from a cryptographic source" is.

**★ Should order ids be random?**
It depends on what the id does. If every read is authorised against the session, a sequential id is
not a vulnerability and a random one is defence in depth. If the order page is reachable by URL
alone, the id is a credential and must be unguessable — but the actual bug is then the missing
authorisation check, and fixing only the id leaves the hole open to anyone who obtains a URL.
Separately, sequential ids leak business volume to anyone who places two orders, which is a
commercial argument for randomising them that has nothing to do with security. The answer that
scores is naming all three considerations and saying which is the bug.

**★ How much entropy does a token need?**
Enough that brute force is infeasible given your rate limits and the token's lifetime, which are the
two variables that actually matter. 128 bits is the conventional floor for something long-lived and
256 bits — 32 random bytes — costs nothing more, so there is rarely a reason to economise. A
six-digit one-time code has about 20 bits, which is fine *only* because it expires in minutes and is
rate-limited to a handful of attempts; remove either control and it is trivially broken. ⚠️ Those
figures are common practice rather than a cited standard, and the framing — entropy is meaningful
only against a stated attempt budget — is the part that matters.

**★ You must ship a deterministic test for a token generator. How?**
Not by seeding the secure generator: `SecureRandom.setSeed` is documented to supplement rather than
replace, *"guaranteed never to reduce randomness"*, so it cannot be forced into a fixed sequence.
Inject the source instead — take a `RandomGenerator`, or a `() => Uint8Array` function, as a
constructor parameter, pass a scripted fake in the test and the real one in production. Then the
test asserts the encoding, the length and the alphabet, which is what you actually wanted to test;
the randomness itself is not a testable property. [10f](10f-seeding-and-reproducibility.md) is that
pattern in general.

---

← Prev: [10d · Uniform integers and modulo bias](10d-uniform-integers-and-modulo-bias.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [10j · The secure APIs, in both languages](10j-the-secure-apis-in-both-languages.md)
