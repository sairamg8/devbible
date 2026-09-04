---
title: "The three bindings are only as strong as the randomness that made them and the storage that remembers them, and both halves fail quietly — a predictable state is a forgeable response, and a session-scoped slot is a login that breaks whenever the user opens a second tab"
sidebar_label: "04b · Generating and storing them"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against RFC 6749 §4.1.1 and §10.12 (on `state` being non-guessable)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7636 §4.1
> and §7.1 (Entropy of the `code_verifier`)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> OpenID Connect Core 1.0 §3.1.2.1 and §3.1.3.7 rules 10–11, at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> RFC 9700 §2.1, §4.5 (Security BCP)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> `java.security.SecureRandom` and `java.util.Base64.getUrlEncoder()` javadocs, JDK 25
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/SecureRandom.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — illustrative client code; no measurement, no captured values.

**[The previous chunk](04-nonce-state-and-the-three-bindings.md) argued that the three values
defend three different things. This one is about the two ways an implementation that sends
all three still fails. The first is entropy: every one of these is a guessing game, and a
`state` built from a session id, a timestamp or `Math.random()` is a `state` the attacker can
construct. The second is lifecycle, and it is the one that reaches production — the values
are per *authorization request* and get stored per *session*, so the second browser tab
silently overwrites the first, and the resulting failure is intermittent, unreproducible and
usually "fixed" by weakening the check.**

Neither failure has a symptom until it matters. That is the argument for writing the storage
once, as a keyed record with a time-based prune, rather than as three session attributes
added at three different times by three different people.

## Storing them: one entry per flow, not one per session

Every one of these values is per-*authorization-request*, and the commonest implementation
bug is storing them per-*session*. A user with three tabs open starts three flows; the third
overwrites the first's stored values, and the first callback fails with a mismatch that
"goes away on retry".

```java
/** Everything one in-flight authorization request needs to verify its own response. */
record PendingAuth(String nonce, String codeVerifier, Instant startedAt) {}

// Keyed by state, so concurrent flows never collide.
Map<String, PendingAuth> pending = ...;   // session-scoped map, or a short-TTL server store

void prune(Map<String, PendingAuth> pending) {
    Instant cutoff = Instant.now().minus(Duration.ofMinutes(10));
    pending.values().removeIf(p -> p.startedAt().isBefore(cutoff));
}
```

The ten-minute prune is not arbitrary — it is
[03b's rule 10](03b-signature-time-and-the-conditional-checks.md) working in the other
direction: if you reject ID tokens issued more than ten minutes ago, then a `nonce` older
than ten minutes can never be needed again.

## Gotchas

**★ `state` is compared but not removed.**
Symptom: the callback URL works when replayed from browser history, minutes or hours later.
Cause: the stored value is still there. Fix: treat it as single-use — read it, delete it, and
fail if it was already gone. The code above does this with `removeAttribute`.

**★ All three values are derived from one seed, or `state` and `nonce` are the same string.**
Symptom: nothing, until an attacker who learns one learns them all. Cause: a helper that
returns a single random value used everywhere. Fix: three independent draws from a
cryptographically secure source. They are cheap.

```java
private static String randomUrlSafe(int bytes) {
    byte[] b = new byte[bytes];
    new SecureRandom().nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
}
// state, nonce and the code_verifier each get their own call.
```

**★ `state` carries the return URL, and that is the only thing it carries.**
Symptom: an open redirect, or a `state` an attacker can construct because it is a
predictable encoding of a path. Cause: using `state` as a data channel instead of as an
unguessable token. Fix: keep `state` opaque and random; store the return URL server-side in
the `PendingAuth` entry it keys.

**★ The nonce store grows without bound.**
Symptom: session memory growth, or a database table that is never pruned. Cause: entries are
written before the redirect and only removed on a successful callback, so every abandoned
login leaks one. Fix: prune on time, as above — most started flows never complete.

**★ The three values are stored in `localStorage` by a browser client.**
Symptom: any script on the page — including a compromised dependency — can read the
`code_verifier` and the `nonce`. Cause: treating them as UI state. Fix: for a
browser-resident client they belong in `sessionStorage` at worst and behind a
backend-for-frontend at best; the BFF argument is **13 · Sessions vs tokens, honestly**
*(not written yet)*.

**★ `state` mismatch is logged and swallowed, and the login is retried automatically.**
Symptom: the CSRF check exists and never fails, because a retry loop starts a fresh flow that
succeeds. Cause: treating a mismatch as a transient error. Fix: a `state` mismatch is an
attack signal or a serious bug; surface it, do not paper over it with a retry.

**★ `SecureRandom.getInstanceStrong()` is used and the application hangs at startup.**
Symptom: the first login blocks for seconds or minutes on a freshly-booted container.
Cause: `getInstanceStrong()` may map to a blocking entropy source, and a container with a
cold entropy pool has nothing to give it. Fix: `new SecureRandom()` is the right call here —
it is a CSPRNG, it does not block, and RFC 7636 §7.1's requirement is for cryptographic
randomness rather than for a blocking source.

```java
// Correct for state/nonce/verifier: non-blocking CSPRNG, reused.
private static final SecureRandom RANDOM = new SecureRandom();
```

**★ The values are base64 rather than base64url, and one of them breaks the redirect.**
Symptom: an occasional `invalid_request`, or a `state` that does not round-trip, roughly one
login in ten. Cause: standard base64 emits `+`, `/` and `=`, all of which need percent-encoding
in a URL and all of which some intermediary will mangle. Fix: `Base64.getUrlEncoder().withoutPadding()`,
which is also what RFC 7636 Appendix A requires for the `code_verifier`.

**★ The pending record is stored in the HTTP session behind a load balancer with no session
affinity.**
Symptom: `state` mismatches proportional to the number of application instances. Cause: the
authorization request was served by one pod and the callback by another, and the session was
never shared. Fix: a shared session store, or a short-TTL server-side store keyed by `state`
that every instance can reach. Do not solve it by putting the values in a cookie the client
can read.

**★ The `code_verifier` is logged.**
Symptom: nothing, until the log aggregator is the breach. Cause: a debug statement that dumps
the whole pending record. Fix: give the record a `toString()` that redacts, and treat the
verifier with the same care as a `client_secret`.

```java
record PendingAuth(String nonce, String codeVerifier, Instant startedAt) {
    @Override public String toString() {
        return "PendingAuth[nonce=<redacted>, codeVerifier=<redacted>, startedAt=" + startedAt + "]";
    }
}
```

## Interview questions

**★ Why does `state` have to be consumed rather than just compared?**
Because a value that survives the comparison makes the callback replayable. Anyone who
recovers the callback URL — from browser history, a `Referer` header, an access log, an APM
trace — can navigate to it again and, if the stored `state` is still present, drive another
token exchange. The authorization code is single-use, so the second exchange fails at the AS,
but you have still executed your callback logic on an attacker-supplied request. Delete on
read.

**★ A user reports intermittent "invalid state" errors that resolve on retry. What is your
first hypothesis?**
Concurrent flows sharing one storage slot — typically a session attribute called `state`
overwritten by a second tab, or a login page that pre-fetches the authorization URL. The fix
is to key the pending-authorization record by the `state` value itself, so any number of
in-flight flows coexist, with a time-based prune for the ones that are abandoned. The second
hypothesis is a session that is not sticky across a load balancer, which produces the same
symptom for a different reason.

**★ How large should these values be, and what happens if you get it wrong?**
Large enough to be unguessable — 128 bits or more from a cryptographically secure source, and
RFC 7636 §7.1 wants 256 bits of entropy behind the `code_verifier` specifically. A guessable
`state` lets an attacker construct a response your callback will accept; a guessable `nonce`
lets an ID token be pre-fabricated for a flow that has not happened yet. Using
`Math.random()`, a timestamp, a session id or a counter is the failure, not the length.

**★ Where should a single-page application store the `code_verifier` and the `nonce`?**
Not in `localStorage`, where every script on the origin can read them and where they survive
tab closure. `sessionStorage` is better but still readable by injected script, which is why
RFC 9700's direction of travel and most current advice is to move the flow behind a
backend-for-frontend: the browser holds a normal session cookie, and the tokens, verifier and
nonce never exist in JavaScript at all.

**★ Why `new SecureRandom()` rather than `SecureRandom.getInstanceStrong()`?**
Because `getInstanceStrong()` is documented to return an implementation suitable for
generating high-value long-lived keys, and on many platforms that means a blocking entropy
source — which in a freshly-started container can stall the first request for a long time.
The values on this page are short-lived per-request nonces, not key material; a non-blocking
CSPRNG is exactly the right tool, and the practical failure of choosing the stronger-sounding
API is an application that appears to hang on its first login.

**★ Where should the pending-authorization record live in a horizontally-scaled service?**
Somewhere every instance can read, because the authorization request and the callback are two
separate HTTP requests that may land on different pods. A shared session store or a
short-TTL server-side cache keyed by `state` both work. What does not work is a local
in-memory map, and what is tempting and wrong is moving the values into a cookie or into
`state` itself — that puts the secret the check depends on into the hands of the party the
check is defending against.

**★ How long should a pending entry live, and what sets the number?**
Long enough for a real human to complete an authentication — including an MFA prompt, a
password reset, or switching to another device — and no longer. A few minutes to ten is the
usual range, and the upper bound is worth tying to the maximum `iat` age you will accept on
an ID token: §3.1.3.7 rule 10 points out that rejecting old tokens is what bounds how long
nonces must be remembered. Pick one number and use it for both.

---

← [The three bindings](04-nonce-state-and-the-three-bindings.md) · [Topic index](README.md) · Next → **Discovery and the `/.well-known` document** *(not written yet)*
