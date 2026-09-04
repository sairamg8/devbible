---
title: "The second half of §3.1.3.7 is where the ID token stops being about identity and starts being about cryptography and clocks — which key, which algorithm, how old is too old, and which of the checks you skipped were conditional on something your own request did"
sidebar_label: "03b · Signature, time and the rest"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.3.7 rules 5–13 (ID Token
> Validation) and §2 (ID Token), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> RFC 7515 §4.1.1 (`alg`) ([rfc-editor.org/rfc/rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt));
> RFC 8725 §3.1 (Perform Algorithm Verification), §3.2 (Use Appropriate Algorithms)
> ([datatracker.ietf.org/doc/html/rfc8725](https://datatracker.ietf.org/doc/html/rfc8725));
> the Spring Security 7.x `OidcIdTokenValidator`, `OidcIdTokenDecoderFactory` and
> `DelegatingOAuth2TokenValidator` javadocs
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · **Spring Security 7.x**.
> **No sandbox** — rules quoted from the specification; the Java is illustrative client code.

**[The first half](03-validating-an-id-token.md) checked *who said this and to whom*. This
half checks *is it genuine and is it current*, and it is where the two subtlest traps in the
whole topic live. Rule 5 grants permission to skip signature validation in one narrow case,
and taking that permission one inch wider turns a client into an unauthenticated login
endpoint. Rule 8 makes your `client_secret` a legitimate verification key, which is precisely
the shape of the algorithm-confusion attack — so the algorithm has to be decided by
registration and never by reading the token's own header.**

The three conditional rules that close the list — 11, 12 and 13 — share one property: they
are conditional on **what your own request asked for**, not on what the token contains. That
is what makes them easy to skip and impossible to notice: nothing in the response tells you
that a check was owed.

## Rules 5 to 8 — the signature, and the two ways to get it wrong

Rule 5 is the one that surprises people: over the back channel, *TLS server validation MAY be
used to validate the issuer in place of checking the token signature*. The reasoning is that
the token came directly from the token endpoint over an authenticated TLS connection to the
host you resolved from the issuer, so the transport already establishes provenance.

🔴 **Take that permission narrowly.** It applies only to a token received by direct
communication with the token endpoint. It does not apply to a token that arrived in a
redirect, in a request body, from a mobile client, or from anywhere else — and rule 6 puts a
**MUST** on validating the signature of *all other* ID tokens. A client that skips signature
validation because "rule 5 says we can" and later accepts an ID token posted by a browser has
turned a documented optimisation into an unauthenticated login endpoint.

Rules 7 and 8 are about which key. RS256 is the default; the client can register a different
`id_token_signed_response_alg`. The one to read twice is **rule 8**: with a MAC algorithm the
key is the UTF-8 octets of your `client_secret`. That is a legitimate mode, and it is also
exactly the shape of the RS-to-HS confusion attack from
[06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/03-the-jose-header.md) —
which is why the accepted algorithm must be decided by *registration*, not by reading the
header:

```java
// Decide the algorithm out of band; let the header pick only from what you already accept.
OidcIdTokenDecoderFactory decoderFactory = new OidcIdTokenDecoderFactory();
decoderFactory.setJwsAlgorithmResolver(registration -> SignatureAlgorithm.RS256);
```

## Rules 9 and 10 — time, and the sentence about nonce storage

Rule 9 is absolute and unqualified: *"The current time MUST be before the time represented by
the `exp` Claim."* No grace period is granted by the specification; small clock skew
allowances are an implementation convention, and every second of skew you allow is a second
of extra validity for a stolen token.

Rule 10 is the only informative entry in the list, and it explains something non-obvious:
using `iat` to reject old tokens *"limit[s] the amount of time that nonces need to be
stored"*. If you will refuse any token issued more than, say, ten minutes ago, then a `nonce`
older than ten minutes can be discarded — which turns nonce storage from an unbounded set
into a small expiring one. That is the practical reason to implement rule 10, and it is
easy to miss when reading the list as a security checklist.

```java
Instant issuedAt = idToken.getIssuedAt();
if (issuedAt.isBefore(Instant.now().minus(MAX_TOKEN_AGE))) {   // e.g. 10 minutes
    throw new OAuth2AuthenticationException("id_token issued too long ago");
}
// ...which is what makes this bounded:
pendingNonces.removeIf(entry -> entry.createdAt().isBefore(Instant.now().minus(MAX_TOKEN_AGE)));
```

## Rules 11 to 13 — verify what you asked for

All three are conditional on the request, and all three fail the same way in practice: the
request half gets written, the check half does not.

- **11 (`nonce`) is a MUST** once you sent one, and the claim must be *present* as well as
  equal. Absence is a failure, not a pass.
- **12 (`acr`) and 13 (`auth_time`) are SHOULDs**, but a SHOULD you skip means the policy you
  believe you enforced does not exist. [02b · Asking about the
  human](02b-the-parameters-about-the-human.md) has the enforcement pattern.

## What Spring Security actually does

`OidcIdTokenValidator` performs the standard set — `iss`, `aud`, `exp`, `iat`, `azp` when
present, and `nonce` when the authorization request carried one — and the signature is
verified by the decoder that `OidcIdTokenDecoderFactory` builds from the `ClientRegistration`.
What it does **not** do is check `acr` or `auth_time` against a policy, because it has no way
to know yours. Those are yours to add, and the place to add them is a validator you compose
rather than one you substitute:

```java
@Bean
JwtDecoderFactory<ClientRegistration> idTokenDecoderFactory() {
    OidcIdTokenDecoderFactory factory = new OidcIdTokenDecoderFactory();
    factory.setJwtValidatorFactory(registration -> new DelegatingOAuth2TokenValidator<>(
            new OidcIdTokenValidator(registration),        // keep the standard rules
            new AuthTimeValidator(Duration.ofMinutes(5))));// add yours alongside
    return factory;
}
```

🔴 **Replacing `OidcIdTokenValidator` rather than delegating to it removes rules 2, 3, 9 and
11 in one line** — the same trap as `setJwtValidator` on the resource-server side, described
in [08 · Composing validators](../08-spring-security-resource-server/06b-composing-validators.md).

## Gotchas

**★ Signature validation is skipped on the strength of rule 5.**
Symptom: a client that accepts an ID token from anywhere. Cause: rule 5's permission is
scoped to *direct communication between the Client and the Token Endpoint*; rule 6 puts a
MUST on every other case. Fix: validate the signature unconditionally. The saving from not
doing it is a JWKS lookup that is cached anyway.

**★ The accepted signing algorithm is read from the header.**
Symptom: a token signed HS256 with a key the attacker controls is accepted by a client that
expects RS256. Cause: rule 8 makes the `client_secret` a legitimate HMAC key, so a validator
that trusts `alg` can be steered into using a value the attacker knows or can guess. Fix:
pin the algorithm from registration — `setJwsAlgorithmResolver(r -> SignatureAlgorithm.RS256)`
— per RFC 8725 §3.1.

**★ `nonce` absence is treated as "not applicable".**
Symptom: an ID token with no `nonce` claim passes even though the request sent one. Cause: a
null-safe comparison that returns true when both sides are absent, or a check guarded by
`if (idToken.getNonce() != null)`. Fix: rule 11 requires the claim to be **present** and
equal when a nonce was sent — absence is a validation failure.

```java
if (sentNonce != null && !sentNonce.equals(idToken.getClaimAsString("nonce"))) {
    throw new OAuth2AuthenticationException("nonce missing or mismatched");
}
```

**★ `exp` is checked with a generous clock skew that nobody chose.**
Symptom: expired tokens accepted for minutes. Cause: a default skew copied from a sample, or
a skew widened during an NTP incident and never narrowed. Fix: pick a number deliberately —
seconds, not minutes — and treat repeated skew failures as a clock problem to fix rather than
a threshold to raise.

**★ `azp` is validated when it is absent, or ignored when it is present and wrong.**
Symptom: valid tokens rejected from providers that never emit `azp`; or a token issued to
another party accepted. Cause: rule 4 is conditional — *"If the implementation is using
extensions … that result in the `azp` … Claim being present"*. Fix: validate it if and only
if it is present, and never require it.

**★ A custom validator is set instead of composed.**
Symptom: `iss`, `aud`, `exp` and `nonce` silently stop being checked the moment an
`auth_time` rule is added. Cause: `setJwtValidatorFactory` replaces rather than appends. Fix:
`DelegatingOAuth2TokenValidator` with `new OidcIdTokenValidator(registration)` as the first
delegate.

**★ Rule 10 is skipped and the nonce store grows without bound.**
Symptom: memory growth in the client, or a nonce table that is never pruned. Cause: without a
maximum acceptable `iat` age there is no point at which a stored nonce can be safely
discarded. Fix: reject tokens older than a fixed age, and expire stored nonces on the same
clock — which is exactly what rule 10 is telling you.

**★ Rule 1 is ignored because "we don't use encrypted ID tokens" — and then a provider is
switched on that does.**
Symptom: the ID token has five dot-separated segments instead of three and every parser
fails. Cause: rule 1 covers JWE-wrapped ID tokens, requested by registering
`id_token_encrypted_response_alg`; a client that never registered one will not see them, but
a migration to a provider or a tenant that mandates them will. Fix: detect the shape rather
than assuming it, and fail with a message that names the cause:

```java
long segments = compactToken.chars().filter(c -> c == '.').count() + 1;
if (segments == 5) {
    throw new IllegalStateException(
            "id_token is a JWE (5 segments); this client registered no decryption key");
}
```

**★ The validation is written against the *access* token's decoder.**
Symptom: an ID token rejected for the wrong reason, or accepted with the wrong audience rule,
because the resource-server decoder was reused. Cause: the two tokens have different
audiences — your `client_id` versus the API's identifier — and different validators.
Fix: build the ID token decoder from the `ClientRegistration` via
`OidcIdTokenDecoderFactory`, and keep it a separate bean from the resource server's
`JwtDecoder`.

**★ Clock skew is applied in one direction only.**
Symptom: `exp` failures under skew are handled but `iat` "in the future" failures are not, or
vice versa. Cause: the two checks are usually written by different people at different times.
Fix: use a single configured skew value for every time comparison on the token, and make it
small enough that its being wrong is a visible operational problem rather than a silent
extension of validity.

## Interview questions

**★ Rule 5 says TLS validation MAY replace signature checking. When can you actually use
that, and would you?**
Only for an ID token received by direct communication between the client and the token
endpoint — the back-channel leg of the authorization code flow — because there the TLS
connection to the host resolved from the issuer already establishes who sent it. Rule 6 puts
a MUST on validating the signature of every other ID token. In practice it is not worth
taking: the key set is cached, the check is cheap, and the moment any code path accepts an ID
token from elsewhere the omission becomes an unauthenticated login.

**★ What is rule 10 actually for? It is the only one with no MUST or SHOULD.**
It is a hint about bounding state. Rejecting tokens whose `iat` is too far in the past puts a
maximum age on any token you will accept, which in turn puts a maximum lifetime on the
`nonce` values you must remember in order to satisfy rule 11. Without it, nonce storage has
no safe expiry policy. It is a performance and operability rule that falls out of a security
one.

**★ Rule 8 says a MAC algorithm uses the `client_secret` as the key. Why is that a hazard?**
Because it makes "verify with a symmetric key" a legitimate mode, so a validator that decides
which key to use by reading the `alg` header can be steered from asymmetric verification into
symmetric verification. That is the RS-to-HS confusion family. The defence is that the
accepted algorithm is fixed at registration — rule 7's `id_token_signed_response_alg` — and
the header may select only from what you already accept, never widen it.

**★ You add an `auth_time` policy check to a Spring Security OIDC client. What is the
mistake waiting for you?**
Setting a validator rather than composing one. `OidcIdTokenDecoderFactory.setJwtValidatorFactory`
replaces the validator entirely, so supplying only your `auth_time` rule silently removes
`OidcIdTokenValidator` and with it the issuer, audience, expiry and nonce checks. The correct
form wraps both in a `DelegatingOAuth2TokenValidator` with `new OidcIdTokenValidator(registration)`
first.

**★ Why are rules 11, 12 and 13 conditional on the request rather than on the token?**
Because they verify that the authorization server answered a question you asked. `nonce`,
`acr` and `auth_time` only have meaning relative to a request that sent a nonce, requested an
`acr` or set `max_age`. That makes them the easiest checks in the list to lose: nothing in
the response signals that a check was owed, so the code path that skips them looks identical
to a correct one. The defensive pattern is to carry what you asked for into the callback —
stored server-side against `state` — so the validator is told what to verify rather than
having to infer it.

**★ Two clients at the same provider both validate correctly, and one of them is compromised.
Does that compromise the other?**
Not through the ID token, provided rule 3 is implemented. Each client's tokens carry its own
`client_id` in `aud`, so a token stolen from the compromised client fails the audience check
at the other. What *is* shared is the signing key material at the provider and, under rule 8,
nothing — because each client's `client_secret` is its own. The shared risk is the user's
session at the authorization server, not the tokens.

**★ Your provider rotates its signing key and every login fails for five minutes. Which rule
is involved and what is the real fix?**
Rule 6 — signature validation — failing because the cached JWK set predates the new `kid`.
The correct behaviour is a decoder that refetches the key set when it encounters an unknown
`kid`, subject to a rate limit, rather than one that only refreshes on a fixed timer. The
operational half is the provider's: publish the new key in the JWK set before signing with
it, so both keys overlap for longer than the longest cache lifetime downstream.

---

← [Validating an ID token](03-validating-an-id-token.md) · [Topic index](README.md) · Next → **`nonce`, `state` and the three bindings** *(not written yet)*
