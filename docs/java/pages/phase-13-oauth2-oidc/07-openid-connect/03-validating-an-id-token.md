---
title: "OIDC Core §3.1.3.7 spells out thirteen numbered rules for validating an ID token, and the reason it is a numbered list rather than a paragraph is that skipping any single one of them turns a signed assertion about a named person into a token anybody can mint"
sidebar_label: "03 · Validating an ID token"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.3.7 (ID Token Validation) — all
> thirteen numbered rules quoted below — and §2 (ID Token), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> RFC 7515 §4.1.1 (`alg`) ([rfc-editor.org/rfc/rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt));
> RFC 8725 §3.1, §3.2 (JWT BCP)
> ([datatracker.ietf.org/doc/html/rfc8725](https://datatracker.ietf.org/doc/html/rfc8725));
> the Spring Security 7.x `OidcIdTokenValidator` and `OidcIdTokenDecoderFactory` javadocs
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · **Spring Security 7.x**.
> **No sandbox** — the rules are quoted from the specification; the Java is illustrative
> client code and the tokens shown are structural, never real.

**This is the one page in the topic to know cold, because an ID token is the *only* thing
standing between an anonymous HTTP request and "this is Alice". §3.1.3.7 gives thirteen
numbered rules, and unlike most specification lists this one is not a checklist of
independent good ideas — it is a chain, and the chain has exactly two links that convert a
missing check into a total authentication bypass: rule 3, which requires `aud` to contain
your `client_id`, and rule 6, which requires you to validate the signature. Everything else
narrows the window; those two decide whether there is a lock on the door at all.**

The frame worth carrying: an ID token is a claim *by a named issuer*, *to a named client*,
*about a named subject*, *at a named time*. Rules 2, 3, 6–8 and 9–10 are the four halves of
that sentence being checked — issuer, audience, signature, time. Rules 11–13 check the extra
questions your request asked. And rule 1 is about a form of ID token most deployments never
see.

## The thirteen rules, verbatim

> *"Clients MUST validate the ID Token in the Token Response in the following manner:"*

| # | §3.1.3.7 | Force |
|---|---|---|
| 1 | *"If the ID Token is encrypted, decrypt it using the keys and algorithms that the Client specified during Registration that the OP was to use to encrypt the ID Token."* | conditional |
| 2 | *"The Issuer Identifier for the OpenID Provider (which is typically obtained during Discovery) MUST exactly match the value of the `iss` (issuer) Claim."* | **MUST** |
| 3 | *"The Client MUST validate that the `aud` (audience) Claim contains its `client_id` value registered at the Issuer identified by the `iss` (issuer) Claim as an audience. The `aud` (audience) Claim MAY contain an array with more than one element. The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience, or if it contains additional audiences not trusted by the Client."* | 🔴 **MUST** |
| 4 | *"If the implementation is using extensions (which are beyond the scope of this specification) that result in the `azp` (authorized party) Claim being present, it SHOULD validate the `azp` value as specified by those extensions."* | SHOULD, conditional |
| 5 | *"This validation MAY include that when an `azp` (authorized party) Claim is present, the Client SHOULD verify that its `client_id` is the Claim Value."* | MAY / SHOULD, conditional |
| 6 | *"If the ID Token is received via direct communication between the Client and the Token Endpoint (which it is in this flow), the TLS server validation MAY be used to validate the issuer in place of checking the token signature. The Client MUST validate the signature of all other ID Tokens according to [JWS] using the algorithm specified in the JWT `alg` Header Parameter."* | 🔴 **MUST** (MAY, for this flow only) |
| 7 | *"The `alg` value SHOULD be the default of RS256 or the algorithm sent by the Client in the `id_token_signed_response_alg` parameter during Registration."* | SHOULD |
| 8 | *"If the JWT `alg` Header Parameter uses a MAC based algorithm such as HS256, HS384, or HS512, the octets of the UTF-8 representation of the `client_secret` corresponding to the `client_id` contained in the `aud` (audience) Claim are used as the key to validate the signature. For MAC based algorithms, the behavior is unspecified if the `aud` is multi-valued."* | conditional |
| 9 | *"The current time MUST be before the time represented by the `exp` Claim."* | **MUST** |
| 10 | *"The `iat` Claim can be used to reject tokens that were issued too far away from the current time, limiting the amount of time that nonces need to be stored to prevent attacks. The acceptable range is Client specific."* | informative |
| 11 | *"If a `nonce` value was sent in the Authentication Request, a `nonce` Claim MUST be present and its value checked to verify that it is the same value as the one that was sent in the Authentication Request. The Client SHOULD check the `nonce` value for replay attacks. The precise method for detecting replay attacks is Client specific."* | **MUST**, conditional |
| 12 | *"If the `acr` Claim was requested, the Client SHOULD check that the asserted Claim Value is appropriate. The meaning and processing of `acr` Claim Values is out of scope for this specification."* | SHOULD, conditional |
| 13 | *"If the `auth_time` Claim was requested, either through a specific request for this Claim or by using the `max_age` parameter, the Client SHOULD check the `auth_time` Claim value and request re-authentication if it determines too much time has elapsed since the last End-User authentication."* | SHOULD, conditional |

## Rule 2 — "exactly match" means string equality, not URL equivalence

The word is *exactly*, and it is doing the same work as RFC 9700's exact-string-matching rule
for redirect URIs. `https://idp.example.com` and `https://idp.example.com/` are different
issuers. So are `http` and `https` versions, and so is the internal DNS name your pods use
versus the public name the provider stamps into `iss`.

```java
// Correct: string equality against the issuer you obtained from discovery.
if (!expectedIssuer.equals(idToken.getIssuer().toString())) {
    throw new OAuth2AuthenticationException("iss mismatch");
}

// Wrong in two different ways: URI normalisation quietly makes distinct issuers equal,
// and a prefix test accepts https://idp.example.com.attacker.test
// if (URI.create(expectedIssuer).equals(idToken.getIssuer())) { ... }
// if (idToken.getIssuer().toString().startsWith(expectedIssuer)) { ... }
```

This is also why OIDC Discovery §4.3 exists and is worth quoting here:

> *"The issuer value returned MUST be identical to the Issuer URL that was used as the prefix
> to `/.well-known/openid-configuration` to retrieve the configuration information. This MUST
> also be identical to the `iss` Claim value in ID Tokens issued from this Issuer."*

Three values, one string: your configured issuer, the `issuer` member of the metadata
document, and the `iss` claim. If they are not byte-identical, something is misconfigured and
the specification says so.

## Rule 3 — the check that makes the ID token an ID token

🔴 **This is the rule.** Everything OIDC added over OAuth2 comes down to the ID token being
addressed to *you*, and rule 3 is the check that reads the address. A validator that verifies
the signature and the issuer but not the audience will happily accept an ID token that the
same identity provider minted for a completely different application — including one the
attacker registered themselves five minutes ago.

The failure is worth stating concretely. Attacker registers a client at the same public
identity provider. Attacker signs in to their own application, receives a genuine, correctly
signed, unexpired ID token with `sub` set to the victim's subject identifier — because the
victim previously used that provider — and posts it to your endpoint. Signature: valid.
Issuer: correct. Expiry: fine. Only `aud` distinguishes it, and only if you look.

```java
// aud may be a single value or an array (§2 requires your client_id as *an* audience).
List<String> audiences = idToken.getAudience();
if (!audiences.contains(clientId)) {
    throw new OAuth2AuthenticationException("aud does not contain our client_id");
}
```

Note `contains`, not `equals` — §2 requires your `client_id` to be *an* audience value, not
the only one, and a validator written as `aud.equals(clientId)` rejects perfectly good
multi-audience tokens, which is the failure that pushes teams to delete the check entirely.

🔴 **But membership alone is not the rule.** Rule 3 has a second half that is easy to miss and
inverts the risk:

> *"The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience,
> **or if it contains additional audiences not trusted by the Client**."*

So a token whose `aud` is `["your-client", "attacker-client"]` passes `contains` and **must
still be rejected** unless you trust every other audience in the list. Membership is necessary
and not sufficient:

```java
// §3.1.3.7 rule 3, both halves.
List<String> audiences = idToken.getAudience();
if (!audiences.contains(clientId)) {
    throw new OAuth2AuthenticationException("aud does not contain our client_id");
}
if (!trustedAudiences.containsAll(audiences)) {
    throw new OAuth2AuthenticationException("aud contains an untrusted audience");
}
```

For the overwhelmingly common single-audience deployment, `trustedAudiences` is just
`Set.of(clientId)` and the second check collapses to "`aud` is exactly us" — which is why the
two-line version looks redundant right up until the day a provider starts issuing
multi-audience tokens.

⚠️ **A multi-valued `aud` also makes rule 8 undefined.** Where the token is MAC-signed
(`HS256`/`HS384`/`HS512`), the key is derived from the `client_secret` belonging to *the*
`client_id` in `aud` — and the specification says outright that *"the behavior is unspecified
if the `aud` is multi-valued."* Asymmetric signing does not have this problem, which is one
more reason RS256 is the default rule 7 points at.

## Gotchas

**★ The audience check is written as equality and then deleted when it breaks.**
Symptom: multi-audience tokens from the provider are rejected; somebody "fixes" it by
removing the check. Cause: §2 requires your `client_id` as *an* audience value, so `aud` may
legitimately be an array. Fix: membership rather than equality — **and then reject any
audience you do not trust**, which is the second half of rule 3 that the shortened form of
the check leaves out.
Deleting rule 3 is the single largest step down in security available in this topic.

**★ The issuer is compared after URI normalisation.**
Symptom: two issuers that differ only by a trailing slash or by scheme compare equal. Cause:
`URI.equals` and various HTTP client normalisations are not string equality, and rule 2 says
*exactly match*. Fix: compare the raw strings, and make the expected value come from the
discovery document so all three copies are the same string.

**★ Validation is performed on the ID token but the session is built from the access token.**
Symptom: all the validation code is correct and the application still logs in the wrong user.
Cause: two tokens arrive together and the identity is read from the wrong one. Fix: identity
comes from the validated ID token's `(iss, sub)` and from nowhere else — see
**08 · `sub` is not an email** *(not written yet)*.

**★ The ID token is validated once at login and then trusted for the life of the session.**
Symptom: a session that outlives every guarantee the token made, including `auth_time`
freshness for privileged operations. Cause: conflating "the assertion was valid when made"
with "the assertion is still true". Fix: your session is your own object with its own
lifetime; carry the assurance facts you care about onto it and re-run the flow when a
privileged action needs a fresher assertion.

## Interview questions

**★ Which two of the thirteen rules, if skipped, are a complete authentication bypass, and
why those two?**
Rule 3 and rule 6. Rule 6 is the signature: without it anyone can mint a token with any
claims, so nothing else in the list means anything. Rule 3 is the audience: with the
signature checked but the audience unchecked, an attacker who registers their own client at
the same identity provider can obtain a genuine, correctly signed token carrying the victim's
`sub` and present it at your application. Every other rule narrows a window; these two decide
whether there is a check at all.

**★ Why is `aud` checked with membership rather than equality?**
Because §2 requires the ID token's `aud` to *contain* the client's `client_id` as an audience
value, not to equal it. Multi-audience ID tokens are legal and providers issue them. A
validator written as equality rejects valid tokens, and the usual "fix" is to delete the
audience check — which removes the only thing that makes the token specific to your
application.

**★ Your provider's `iss` is `https://idp.example.com/auth/realms/corp` and your service
reaches it at `http://keycloak.internal:8080/auth/realms/corp`. What breaks and what is the
fix?**
Rule 2 breaks: the issuer must *exactly* match the `iss` claim, and the internal URL is a
different string. Discovery §4.3 makes it worse, because the `issuer` member of the metadata
document must also be identical to the URL used to fetch it. The fix is configuration, not
code: the provider must be configured with the public issuer identifier, and the service must
reach that same identifier — typically by resolving the public hostname internally rather
than by rewriting the URL. Never "fix" it by relaxing the comparison.

**★ Is validating an ID token the same as validating an access token?**
No, and the differences are the point. The ID token's audience is your `client_id` and it is
validated by the *client*; a JWT access token's audience is the resource server and it is
validated by the *API*. The ID token has a specified set of claims and a specified validation
procedure in §3.1.3.7; an access token's format is an implementation choice of the
authorization server that clients are forbidden to depend on. And the ID token answers "who",
while the access token answers "may". Running either through the other's validator is a
category error even when it happens to succeed.

---

← [Asking about the human](02b-the-parameters-about-the-human.md) · [Topic index](README.md) · Next → [Signature, time and the conditional checks](03b-signature-time-and-the-conditional-checks.md)
