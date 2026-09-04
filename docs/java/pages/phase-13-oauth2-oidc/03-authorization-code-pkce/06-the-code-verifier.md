---
title: "The code verifier is the only cryptographic material a client generates in this flow, and every one of its constraints — 43 to 128 characters, unreserved characters only, 256 bits of entropy, fresh per request — exists to defeat a specific attack rather than to satisfy a style guide"
sidebar_label: "06 · The code_verifier"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7636 §4.1 (Client Creates a Code Verifier), §7.1 (Entropy
> of the code_verifier), §7.3 (Salting the code_challenge), Appendix A (Notes on Implementing
> Base64url Encoding without Padding), Appendix B (Example for the S256 code_challenge_method)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 3986 §2.3 (Unreserved Characters)
> ([rfc-editor.org/rfc/rfc3986](https://www.rfc-editor.org/rfc/rfc3986.txt)); RFC 9700 §2.1.1
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> `java.security.SecureRandom` and `java.util.Base64.getUrlEncoder()` javadocs, JDK 25
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/SecureRandom.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A verifier is 32 bytes from a cryptographically secure random source, base64url-encoded
without padding, generated fresh for every single authorization request and held in
server-side state keyed to the user's browser session until the token exchange. Every phrase
in that sentence is load-bearing. The most common real-world PKCE bug is not a wrong hash —
it is a verifier that is not random enough, not fresh enough, or not scoped to the right
session.**

## The specification's definition

RFC 7636 §4.1:

> *"code_verifier = high-entropy cryptographic random STRING using the unreserved characters
> `[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"` from Section 2.3 of [RFC3986], with a
> minimum length of 43 characters and a maximum length of 128 characters."*

The ABNF:

```abnf
code-verifier = 43*128unreserved
unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
ALPHA         = %x41-5A / %x61-7A
DIGIT         = %x30-39
```

And the recommendation that turns the constraint into an implementation:

> *"It is RECOMMENDED that the output of a suitable random number generator be used to create
> a 32-octet sequence. The octet sequence is then base64url-encoded to produce a 43-octet URL
> safe string to use as the code verifier."*

Three separate requirements are hiding in there, and each has its own reason:

- **The character set is RFC 3986's unreserved set** so the verifier survives being placed in
  a URL query parameter, an HTTP form body and a JSON document unchanged, with no encoding
  ambiguity. If it had to be percent-encoded, two implementations could encode it differently
  and the server's byte comparison would fail.
- **43 characters minimum** is not an arbitrary number: it is the base64url length of 32
  octets. The minimum length *is* the entropy requirement expressed as a length.
- **128 characters maximum** bounds what a server must store and hash.

## The entropy requirement, and why it is stated as bits

RFC 7636 §7.1:

> *"The security model relies on the fact that the code verifier is not learned or guessed by
> the attacker. It is vitally important to adhere to this principle. As such, the code
> verifier has to be created in such a manner that it is cryptographically random and has high
> entropy that it is not practical for the attacker to guess."*

and the concrete guidance:

> *"The client SHOULD create a `code_verifier` with a minimum of 256 bits of entropy. This can
> be done by having a suitable random number generator create a 32-octet sequence."*

§7.3 explains why no salt is involved:

> *"Salting is not used in the production of the code challenge, as the code verifier contains
> sufficient entropy to prevent brute-force attacks."*

That is worth pausing on. Password hashing needs salt and work factors because passwords have
low entropy. A verifier has 256 bits of entropy and is used exactly once, so a plain SHA-256
is sufficient and adding PBKDF2-style stretching would be pure cost. If you find yourself
reaching for a KDF here, the reason you would need one has already been designed away.

## Generating one in Java

```java
import java.security.SecureRandom;
import java.util.Base64;

public final class CodeVerifiers {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder URL_ENCODER =
            Base64.getUrlEncoder().withoutPadding();

    private CodeVerifiers() { }

    /**
     * RFC 7636 section 4.1: 32 random octets, base64url-encoded without padding,
     * yielding a 43-character string over the unreserved character set.
     */
    public static String newVerifier() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return URL_ENCODER.encodeToString(bytes);
    }
}
```

Four decisions in ten lines:

- **`SecureRandom`, never `java.util.Random` or `Math.random()`.** `Random` is a 48-bit linear
  congruential generator; observing a couple of outputs lets you predict the rest. Its javadoc
  says so: *"Instances of `java.util.Random` are not cryptographically secure."*
- **`Base64.getUrlEncoder()`, not `getEncoder()`.** The standard alphabet contains `+` and `/`,
  neither of which is in RFC 3986's unreserved set. Using it produces a verifier that must be
  percent-encoded and that some servers will reject.
- **`.withoutPadding()`.** Base64 padding is `=`, also outside the unreserved set. RFC 7636
  Appendix A exists entirely because implementers get this wrong — it shows stripping trailing
  `=` characters and replacing the non-URL-safe alphabet characters.
- **A single shared `SecureRandom` instance is fine and preferable.** It is thread-safe, and
  reseeding or reconstructing one per call costs entropy-pool time for no benefit.

The output is 43 characters — the minimum the RFC allows and the exact length its own
recommendation produces.

## Where it lives between the two requests

The verifier must be retrievable at the token exchange, and only by the same user session that
created it. RFC 9700 §2.1.1 states the binding requirement:

> *"In any case, the PKCE challenge or OpenID Connect `nonce` MUST be transaction-specific and
> securely bound to the client and the user agent in which the transaction was started."*

"Transaction-specific" rules out a per-user or per-installation verifier. "Securely bound to
... the user agent in which the transaction was started" rules out a global map keyed by
`state` alone that any browser could hit, and rules out storing it anywhere the browser can
read it. In a Spring Security servlet client, this is the `HttpSession` via the
`AuthorizationRequestRepository`; in a native app it is process memory or the platform
keystore for the duration of the flow.

Storage options ranked:

| Where | Verdict |
|---|---|
| Server-side session, keyed to the session cookie | Correct for a web client. |
| In-memory in the app process, for the flow's duration | Correct for a native/desktop client. |
| An encrypted, `HttpOnly`, `SameSite` cookie holding the verifier | Workable for stateless servers; the cookie must be `HttpOnly` or a script can read it. |
| `sessionStorage` / `localStorage` in a browser SPA | The only option a pure SPA has, and it is why a pure SPA is a weaker deployment than a BFF. Any XSS reads it. |
| A global in-memory map keyed only by `state` | Wrong — no binding to the user agent. |
| Recomputed from something deterministic | Wrong — not random, therefore not a verifier. |

## The worked example, from Appendix B

RFC 7636's own numbers, reproduced because the RFC publishes them:

```text
octets      [116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173,
             187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83,
             132, 141, 121]

verifier    dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

43 characters, unreserved set only, no padding. That string is a useful fixture for a unit
test of your own generator's *encoding* — never as a fixed verifier in anything that runs.

## Gotchas

**★ `java.util.Random` produces a verifier an attacker can predict.**
It is a 48-bit LCG; a handful of observed outputs determines the seed. Because both the
verifier's encoding and its length look correct, nothing in testing catches this. Static
analysis rules for insecure randomness exist precisely for this class of bug — enable them.

**★ `Base64.getEncoder()` instead of `getUrlEncoder()` produces `+` and `/`.**
Both are outside RFC 3986's unreserved set. Against a lenient server it works; against a
strict one you get `invalid_request` at the authorization endpoint or `invalid_grant` at the
token endpoint depending on where the mismatch bites, and it only fails for roughly the
fraction of random verifiers that happen to contain one of those characters — so it fails
intermittently, which is the worst possible failure mode.

**★ Forgetting `.withoutPadding()` puts `=` in the verifier.**
Same shape of bug, and it fails *every* time for 32 bytes, since 32 bytes is not a multiple of
3 and so always pads. That at least makes it obvious.

**★ Hashing a UUID is not 256 bits of entropy.**
A type-4 UUID has 122 random bits. Its string form is 36 characters — below the 43-character
minimum — so implementations that use one often concatenate two, which produces 73 characters
and 244 bits and is *nearly* compliant in a way that will pass review by eye. Use 32 bytes from
`SecureRandom` and stop improvising.

**★ Reusing a verifier across authorization requests defeats the point.**
RFC 9700 §2.1.1 requires it to be transaction-specific. A cached verifier is a long-lived
secret; an attacker who obtains it once can redeem every subsequent code that used it. This
happens in practice when someone "optimises" the generation out of a hot path.

**★ Storing the verifier where JavaScript can read it means XSS is a full account
compromise.**
For a pure browser SPA there is no alternative, which is the honest argument for putting the
flow behind a backend instead. `HttpOnly` cookies and server-side sessions are not available
to a client that has no server.

**★ A verifier generated on one instance and redeemed on another needs shared session
state.**
The verifier lives with the authorization request. Two application replicas with local
in-memory sessions and no sticky routing will lose it between the redirect out and the
callback in, producing a login that fails roughly (N−1)/N of the time. Covered in
**19 · Where the defaults leave you exposed** *(not written yet)*.

**★ Do not log the verifier.**
It is a secret for the duration of the flow. It is short, looks like an opaque id, and is
exactly the kind of thing that ends up in a debug log next to the `state`. Logging both makes
the log a complete PKCE bypass for anyone who can read it within the code's lifetime.

**★ The minimum length is 43 and the RFC's recommendation produces exactly 43.**
So a "let's use a longer one for safety" instinct gives you no extra security — the entropy
comes from the 32 octets, not from the character count — while a "let's use a shorter one, it
is only a URL parameter" instinct produces a non-conforming request that some servers reject
outright.

## Interview questions

**★ How do you generate a code verifier, and what would you get wrong?**
32 bytes from `SecureRandom`, base64url-encoded without padding, giving a 43-character string —
that is RFC 7636 §4.1's own recommendation. The three things people get wrong are the random
source (`java.util.Random` is a predictable 48-bit LCG), the alphabet (`Base64.getEncoder()`
emits `+` and `/`, which are not in RFC 3986's unreserved set), and the padding (`=` is also
outside it). The first is a security hole that never fails a test; the second fails
intermittently, only for verifiers that happen to contain the offending character; the third
fails consistently.

**★ Why does the RFC specify a *character set* for the verifier rather than just a length?**
Because the verifier travels as an HTTP parameter and must round-trip byte-identically for the
server's comparison to work. RFC 3986's unreserved characters need no percent-encoding
anywhere, so there is no way for two implementations to disagree about the encoded form. If the
verifier could contain reserved characters, one library might encode `+` as `%2B` and another
leave it, and the server would compute a different hash from the one the client did.

**★ Why is there no salt, and no key stretching, on the code challenge?**
RFC 7636 §7.3: *"Salting is not used in the production of the code challenge, as the code
verifier contains sufficient entropy to prevent brute-force attacks."* Salt and work factors
exist to make low-entropy secrets — passwords — expensive to attack offline. A code verifier
has 256 bits of entropy and is single-use, so there is nothing to brute-force and no rainbow
table to defeat. Adding a KDF would add latency to every login for no security gain.

**★ Where do you store the verifier between the authorization request and the token request?**
In server-side state bound to the user's browser session — in Spring Security's servlet client
that is the `HttpSession`, via the `AuthorizationRequestRepository`, which holds the whole
`OAuth2AuthorizationRequest` including the verifier as an attribute. RFC 9700 §2.1.1 requires
it be *"transaction-specific and securely bound to the client and the user agent in which the
transaction was started"*, so a global map keyed only by `state` is insufficient and anything
readable by page scripts is a risk. The practical consequence in production is that a
multi-replica deployment needs a shared session store or sticky sessions, because losing that
state is losing the login.

**★ A candidate says "we use a UUID as the code verifier". What is your response?**
Two problems. A type-4 UUID carries 122 bits of randomness, not the 256 RFC 7636 §7.1 asks for;
and its canonical string form is 36 characters, below the 43-character minimum in §4.1, so the
request is non-conforming and a strict authorization server may reject it. The usual patch —
concatenating two UUIDs — gets the length above the floor but is still improvising a random
string generator when `SecureRandom.nextBytes(new byte[32])` is one line and exactly what the
specification recommends.

---

← [The interception attack](05-the-interception-attack.md) · [Topic index](README.md) · Next → [S256 vs plain](07-s256-vs-plain.md)
