---
title: "Multi-factor authentication and TOTP"
sidebar_label: "07 · MFA and TOTP"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — the implementation below reproduces all
> **RFC 6238 test vectors** for SHA-1 and SHA-256.

**A second factor turns a stolen password into a failed login.** TOTP is thirty lines of
`node:crypto` and no dependency — worth understanding even if you end up using a library,
because the parts that go wrong are the parts a library cannot decide for you.

## TOTP is HMAC over a clock

The whole algorithm: HMAC the current 30-second time step with a shared secret, take four
bytes from a position the MAC itself picks, truncate to six digits.

```js
import {createHmac} from 'node:crypto';

function hotp(secret, counter, digits = 6, algo = 'sha1') {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algo, secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;               // dynamic truncation
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16)
            | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const totp = (secret, t = Date.now(), step = 30, digits = 6, algo = 'sha1') =>
  hotp(secret, Math.floor(t / 1000 / step), digits, algo);
```

Checked against the RFC's published vectors:

```console
RFC 6238 vectors (8 digits):
  T=        59  sha1 94287082 OK   sha256 46119246 OK
  T=1111111109  sha1 07081804 OK   sha256 68084774 OK
  T=1234567890  sha1 89005924 OK   sha256 91819424 OK
  T=2000000000  sha1 69279037 OK   sha256 90698825 OK
```

**SHA-1 here is not a weakness.** HMAC-SHA1 is unaffected by the collision attacks that
retired SHA-1 for signatures, and it is what every authenticator app implements. Use
SHA-1 unless you control both ends.

## Verification is where the bugs are

```js
export function verifyTotp(secret, code, {window = 1, step = 30} = {}) {
  const now = Date.now();
  for (let drift = -window; drift <= window; drift++) {
    const expected = totp(secret, now + drift * step * 1000, step);
    if (expected.length === code.length &&
        timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return Math.floor(now / 1000 / step) + drift;        // return the step used
    }
  }
  return null;
}
```

Three things that are not optional:

**A drift window of ±1 step.** Phone clocks are not your clock. Adjacent steps produce
completely different codes:

```console
window -1/0/+1: 535386 821630 373381
```

±1 accepts a 90-second span. Wider gets sloppy; narrower generates support tickets.

**`timingSafeEqual`, not `===`** ([page 16](./16-timing-attacks.md)). Guard the length
first — it throws on mismatched buffers.

**Return and record the step that matched.** Codes are valid for a whole step, so a code
observed in transit can be replayed within it. Store the last accepted step per user and
reject anything less than or equal to it. **Without this, TOTP is not single-use** — and
it is the check most hand-rolled implementations omit.

## Enrolment and recovery

The secret goes to the app as a `otpauth://` URI, usually rendered as a QR code:

```js
const uri = `otpauth://totp/${encodeURIComponent(`Shop:${user.email}`)}` +
  `?secret=${base32(secret)}&issuer=Shop&algorithm=SHA1&digits=6&period=30`;
```

The secret is base32, not hex — that is the format authenticator apps expect.

**Require a valid code before enabling MFA.** Otherwise a mis-scanned QR locks the user
out permanently, and you will find out weeks later.

**Recovery codes decide whether this feature helps or hurts.** Generate ten single-use
codes at enrolment, hash them like passwords
([page 01](./01-password-storage.md)) — they are credentials — and mark each used. A
lost phone without recovery codes means account recovery by support, which is a social
engineering surface that can be weaker than the password you just strengthened.

**Store the secret encrypted at rest** (page 26). It is
symmetric: anyone with the secret can generate codes forever.

## What TOTP does and does not stop

**Stops:** credential stuffing, password reuse, offline password cracking. That is the
overwhelming majority of account takeover, which is why any MFA beats none.

**Does not stop:** real-time phishing. A proxy page that relays the code to the real site
within its 30-second window works fine — the user typed a valid code, into the wrong
place. TOTP is a *shared secret*, so it can be replayed by whoever receives it.

**WebAuthn/passkeys close that gap**, because the credential is bound to the origin and
the browser refuses to sign for a lookalike domain. It is phishing-resistant in a way
TOTP structurally cannot be. If you are choosing a second factor today and your users'
platforms support it, passkeys are the stronger answer; TOTP remains the pragmatic
fallback with universal support.

**SMS is the weakest option** — SIM swap, SS7 interception, delivery failures. Still
better than nothing, and better than losing users who will not install an app.

## Where MFA belongs beyond login

Re-prompt for the second factor at genuinely dangerous moments: changing the password or
email, disabling MFA, adding a payout destination, deleting the account. A session that
has been open for six hours is weaker evidence than a fresh code.

And rotate the session on MFA completion — privilege genuinely increased
([page 05](./05-session-management.md)).

## Gotchas

**Symptom:** Valid codes rejected for some users
**Cause:** No drift window; their phone clock is seconds off.
**Fix:** Accept ±1 step, and check your own server's clock sync.

**Symptom:** The same code works twice
**Cause:** No replay protection — a code is valid for the whole step.
**Fix:** Record the accepted step per user; reject steps at or below it.

**Symptom:** Users locked out immediately after enabling MFA
**Cause:** MFA enabled without confirming a working code.
**Fix:** Require one valid code before switching it on.

**Symptom:** Support is resetting MFA by email constantly
**Cause:** No recovery codes, so support became the recovery path.
**Fix:** Issue hashed single-use recovery codes at enrolment.

**Symptom:** Authenticator apps reject the QR code
**Cause:** Secret encoded as hex or base64 rather than base32.
**Fix:** base32, in an `otpauth://` URI.

**Symptom:** Users phished despite MFA
**Cause:** TOTP is a shared secret and can be relayed in real time.
**Fix:** WebAuthn/passkeys for phishing resistance; MFA is not a phishing cure.

**Symptom:** A database leak exposes every MFA secret
**Cause:** Secrets stored in plaintext.
**Fix:** Encrypt at rest with a key held outside the database.

## Interview questions

**★ How does TOTP work?**
HMAC of the current 30-second time counter with a shared secret, dynamically truncated to
six digits. Both sides compute it independently, so nothing is transmitted but the code.
Verified here against the RFC 6238 vectors for SHA-1 and SHA-256.

**★ Why is a drift window needed, and what does it cost?**
Client clocks drift, so the code the phone shows may belong to an adjacent step. A ±1
window accepts a 90-second span. The cost is a slightly longer replay window, which is
why recording the accepted step matters.

**★ What stops a TOTP code being used twice?**
Nothing, unless you implement it. A code is valid for its whole time step and window, so
you must record the last accepted step per user and reject anything not strictly newer.
This is the most commonly omitted part of a hand-rolled implementation.

**★ Does MFA stop phishing?**
Not TOTP. A real-time proxy relays the code within its validity window, and the user
supplied a genuine code to a fake site. WebAuthn/passkeys do stop it, because the
credential is bound to the origin and will not sign for a lookalike domain.

**Is HMAC-SHA1 in TOTP a problem?**
No. The attacks that retired SHA-1 are collision attacks against signatures; HMAC-SHA1
is not affected. It is also what authenticator apps implement, so deviating breaks
compatibility for no gain.

**How should recovery codes be stored?**
Hashed, like passwords, and marked single-use. They are credentials with the same power
as the second factor, and they are the reason a lost phone does not become a support
ticket that bypasses MFA entirely.

---

← Prev: [OAuth 2.0 and OIDC](./06-oauth-oidc.md) · Next → [Injection](./08-injection.md)
