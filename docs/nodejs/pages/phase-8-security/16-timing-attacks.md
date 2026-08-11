---
title: "Timing attacks"
sidebar_label: "16 · Timing attacks"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — all timings measured on this machine,
> 200 000 iterations per data point.

**How long your code takes is data you are returning.** A comparison that stops at the
first wrong byte tells the caller how many bytes were right; a login that only hashes a
password when the account exists tells the caller which accounts exist. Neither appears
in the response body.

## The leak, measured

A first-mismatch comparison against a 64-character secret:

```js
function naiveEqual(x, y) {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
```

```console
 0 chars match ->   5.4 ms / 200k
16 chars match ->  42.9 ms / 200k
32 chars match ->  78.9 ms / 200k
48 chars match -> 109.6 ms / 200k
63 chars match -> 141.2 ms / 200k
```

A clean staircase: the runtime is proportional to the length of the matching prefix. An
attacker who can time your endpoint guesses one character at a time — 64 × 62 tries
instead of 62<sup>64</sup>.

`crypto.timingSafeEqual` over the same inputs:

```console
 0 chars match -> 40.0 ms / 200k
32 chars match -> 44.9 ms / 200k
63 chars match -> 38.0 ms / 200k
```

Flat — 63 matching characters came out *below* 0 matching characters, which is noise, not
signal. That is the property you want: the work does not depend on where the difference is.

**Note the per-call cost.** 40 ms per 200 000 calls is 0.2 µs. Constant-time comparison
is free at request scale; there is never a performance reason to skip it.

## Using it correctly

```js
import crypto from 'node:crypto';

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;      // required: see below
  return crypto.timingSafeEqual(ab, bb);
}
```

**It throws on unequal lengths:**

```console
ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH | Input buffers must have the same byte length
```

It cannot hide a length difference, so it refuses to pretend. Two consequences:

1. **Guard the length yourself** or an attacker sending a short token gets a 500 instead
   of a 401.
2. **The length must not be secret.** For a fixed-width token — a 32-byte HMAC, a session
   id you generated — it isn't, and returning `false` early leaks nothing.

Where the length *could* be secret, hash both sides to a fixed width first:

```js
export function equalAnyLength(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);          // always 32 bytes each
}
```

```console
same        -> true
diff length -> false      (no throw)
```

Two hashes cost about a microsecond and remove the length question entirely. This is the
standard shape for comparing webhook signatures, where the header is attacker-controlled
and can be any length.

## The one that actually gets exploited: user enumeration

Byte-level comparison timing over a network is hard. **Endpoint-level timing is easy**,
because the difference is milliseconds, not microseconds:

```js
// the leak
const user = await users.findByEmail(email);
if (!user) return res.status(401).end();              // returns immediately
const ok = await verifyPassword(password, user.hash); // ~85 ms of scrypt
```

```console
unknown user -> 0.0 ms
known user   -> 83.6 ms
```

Eighty-three milliseconds is visible through any amount of network jitter. The endpoint
is a free "does this email have an account here?" oracle — which matters for a dating
site, a medical service, or anywhere a list of your users is itself the prize.

**The fix is to do the work either way:**

```js
const DUMMY_HASH = await hashPassword(crypto.randomBytes(32).toString('hex'));  // once, at boot

const user = await users.findByEmail(email);
const ok = await verifyPassword(password, user?.hash ?? DUMMY_HASH);
if (!user || !ok) return res.status(401).json({ error: 'invalid credentials' });
```

```console
fixed, unknown -> 71.2 ms
fixed, known   -> 69.5 ms
```

Indistinguishable. The dummy hash must use the **same parameters** as your real ones, or
the timing difference comes straight back.

Timing is only half of it — the response must also be identical. One error message for
both cases (`invalid credentials`, never "no such user"), the same status code, and the
same behaviour on signup and password reset, which leak the same fact more obviously.

## Where else it applies

- **API keys and webhook signatures** — the classic `timingSafeEqual` case; the caller can
  retry indefinitely and time each attempt.
- **TOTP codes** ([page 07](./07-mfa-totp.md)) — six digits, low entropy, worth protecting.
- **Password reset and email-verification tokens.**
- **CSRF tokens** ([page 11](./11-csrf.md)).
- **Session ids**, if you compare them anywhere other than a datastore lookup.

Not everything needs it. A comparison against a value the attacker already knows, or one
they cannot repeat, leaks nothing useful. The test is: *can they retry, and does the
comparison involve a secret?*

## Honest limits

`crypto.timingSafeEqual` guarantees the comparison is constant time. It does not make
your handler constant time — a database lookup, a cache hit, a JIT deoptimisation or a GC
pause all vary. Remote timing attacks against microsecond differences need many thousands
of samples and statistics; even locally, five `setTimeout(1)` calls measured 4.36, 1.15,
1.12, 1.33 and 1.23 ms, and a network adds far more than that.

So treat constant-time comparison as **removing an unnecessary leak, cheaply**, not as
the thing standing between you and a break-in. **Rate limiting is the control that
actually stops the attack** — every timing attack needs many samples, and
[page 21](./21-rate-limiting.md) takes the samples away. Use both.

Deliberately adding random delay is not a fix: it adds noise the attacker averages out
over more samples, while costing you real latency.

## Gotchas

**Symptom:** `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` in production logs, 500s on the endpoint
**Cause:** `timingSafeEqual` throws when the buffers differ in length.
**Fix:** Compare lengths first and return `false`, or hash both sides to a fixed width.

**Symptom:** The login endpoint answers much faster for unregistered emails
**Cause:** Password verification is skipped when the user is not found — verified, 0.0 ms vs 83.6 ms.
**Fix:** Verify against a dummy hash with the same parameters in both paths.

**Symptom:** Timing is equalised but accounts are still enumerable
**Cause:** Different error messages, status codes, or signup/reset behaviour.
**Fix:** One generic response for every failure, across every endpoint that touches an email.

**Symptom:** `timingSafeEqual` throws `ERR_INVALID_ARG_TYPE`
**Cause:** Strings passed directly; it takes `Buffer`/`TypedArray`/`DataView`.
**Fix:** `Buffer.from(value)` on both sides.

**Symptom:** A dummy hash was added and unknown users are still faster
**Cause:** The dummy uses different cost parameters than the real hashes.
**Fix:** Generate it with the same algorithm and parameters, once at startup.

**Symptom:** Random delay was added and the attack still works
**Cause:** Noise averages out over samples; it hides nothing.
**Fix:** Constant-time comparison plus rate limiting.

## Interview questions

**★ What does `crypto.timingSafeEqual` protect against, and how?**
Leaking *where* two values differ. A first-mismatch loop runs longer the more characters
match — verified, a clean staircase from 5.4 ms to 141.2 ms per 200 000 calls as the
matching prefix grows from 0 to 63 characters. `timingSafeEqual` compares every byte
regardless, and measured flat at 38–45 ms across the same inputs.

**★ Why does it throw on different lengths instead of returning `false`?**
Because it cannot hide the length difference — the work is proportional to the buffer
size. Refusing is honest. Guard the length yourself, and where the length might itself be
secret, hash both sides to a fixed width first.

**★ Which timing leak is most likely to be exploited in a real app?**
User enumeration on login, not byte-level comparison. Skipping password verification for
an unknown email is an 83 ms difference — verified — which survives network jitter easily.
Byte-level differences are microseconds and need thousands of samples.

**★ How do you make login constant time?**
Hash against a dummy hash generated at boot with the same parameters when the user is not
found, so both paths do the same work — measured 71.2 ms vs 69.5 ms. Then return an
identical response for both cases.

**Is constant-time comparison enough on its own?**
No. It removes one leak. The handler is still variable — database lookups, GC, the
network — and any timing attack needs many samples, so rate limiting is the control that
actually prevents it. Use both, and don't add random delay; it is noise the attacker
averages away.

**Where would you *not* bother?**
Comparing values that are not secret, or that the attacker cannot retry against. At 0.2 µs
per call the cost is negligible, so the honest default is to use it whenever a secret is
on one side of the `===`.

---

← Prev: [Deserialization, open redirects, mass assignment](./15-deserialization-redirects-mass-assignment.md) · Next → [Input validation at the boundary](./17-input-validation.md)
