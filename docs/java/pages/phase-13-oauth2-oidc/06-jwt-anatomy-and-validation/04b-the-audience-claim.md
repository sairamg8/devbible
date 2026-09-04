---
title: "aud is the claim that says this token was minted for this service and no other, it is the only defence against a token legitimately issued to one recipient being replayed at another, and Spring does not check it unless you tell it to"
sidebar_label: "10 · The audience claim"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7519 §4.1.3 (`aud`); RFC 8725 §2.7 (Substitution
> Attacks), §2.8 (Cross-JWT Confusion), §3.9 (Use and Validate Audience);
> RFC 9068 §2.2 (Data Structure), §4 (Validating JWT Access Tokens),
> §5 (Security Considerations); RFC 8707 (Resource Indicators for OAuth 2.0);
> Spring Security 7.x `JwtAudienceValidator`, `JwtClaimValidator`, `Jwt#getAudience`,
> `MappedJwtClaimSetConverter`; Spring Security reference *OAuth 2.0 Resource Server JWT*,
> "Supplying Audiences".
> ([rfc7519](https://www.rfc-editor.org/rfc/rfc7519.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt),
> [rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt),
> [Spring reference](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**`aud` is the single most consequential claim in a JWT and the one most often left
unchecked. This chunk is what the claim means and what it defends against; configuring the
check in Spring, and choosing good audience values, is
[11 · Configuring audience validation](04c-configuring-audience-validation.md). Every other validation asks "is this token genuine?" — `aud` asks "was it genuine
*for me*?". Without it, any service that trusts your issuer can take a token a user handed it
and replay that token against any other service that trusts the same issuer, with a perfect
signature and a valid expiry. Spring Security's defaults do not check `aud`. Configuring
`issuer-uri` and nothing else buys you signature, `exp`, `nbf` and `iss` — and a token
minted for a different API sails straight through.**

## What RFC 7519 says

§4.1.3, in full:

> *"The `'aud'` (audience) claim identifies the recipients that the JWT is intended for. Each
> principal intended to process the JWT MUST identify itself with a value in the audience
> claim. If the principal processing the claim does not identify itself with a value in the
> `'aud'` claim when this claim is present, then the JWT MUST be rejected. In the general case,
> the `'aud'` value is an array of case-sensitive strings, each containing a StringOrURI value.
> In the special case when the JWT has one audience, the `'aud'` value MAY be a single
> case-sensitive string containing a StringOrURI value. The interpretation of audience values
> is generally application specific. Use of this claim is OPTIONAL."*

Two independent facts live in there.

**The MUST is conditional.** *"…when this claim is present."* If `aud` is present and does not
contain you, rejection is mandatory. If `aud` is **absent**, RFC 7519 imposes nothing at all.
That gap is the whole problem, and RFC 8725 §3.9 closes it:

> *"If the same issuer can issue JWTs that are intended for use by more than one relying party
> or application, the JWT MUST contain an `'aud'` (audience) claim."*
> … *"The relying party or application MUST validate the audience value, and if the audience
> value is not present or not associated with the recipient, it MUST reject the JWT."*

**Absent `aud` is a rejection.** Not a pass, not a warning.

**The type is string-or-array.** `"aud": "https://orders.example.com"` and
`"aud": ["https://orders.example.com"]` are both legal and mean the same thing. Any code doing
`(String) claims.get("aud")` throws a `ClassCastException` against half the issuers in the
world. Spring normalises it — `Jwt#getAudience()` returns a `List<String>` either way, via
`MappedJwtClaimSetConverter` — but a hand-rolled parser must handle both.

## What it defends against

**Substitution.** RFC 8725 §2.7:

> *"One recipient will be given a JWT that was intended for it and will attempt to use it at a
> different recipient for which that JWT was not intended."*

Concretely, in a microservice estate where every service trusts the same issuer:

1. A user calls `reporting-service` with their access token. This is entirely legitimate.
2. `reporting-service` — compromised, buggy, or simply written by someone taking a shortcut —
   forwards that same token to `payments-service`.
3. `payments-service` verifies the signature (same issuer, same JWK set), checks `exp`, checks
   `iss`. All pass. The token was never intended for it, and it has no way to know.

Nothing was forged. The token was legitimately issued. That is what makes substitution
insidious: there is no anomaly to detect, only a missing check. Audience-per-service is the
fix, and the broader argument — including why a single "internal" token for all services is an
anti-pattern — is **12 · Token relay across microservices** *(not written yet)*.

**Cross-JWT confusion.** RFC 8725 §2.8. An ID token and an access token from the same issuer
share a signing key. If the resource server checks no audience, an ID token — which the browser
holds and any script on the page can read — is accepted as an access token. That story in full
is [05 · Explicit typing](03b-explicit-typing.md); `aud` is the second half of the defence and
`typ` is the first.

## What RFC 9068 requires

§2.2 makes `aud` **REQUIRED** for JWT access tokens. §4 tells the resource server what to do:

> *"The resource server MUST validate that the `'aud'` claim contains a resource indicator
> value corresponding to an identifier the resource server expects for itself."*

and §5 puts the matching obligation on the authorization server:

> *"To prevent cross-JWT confusion, authorization servers MUST use a distinct identifier as an
> `'aud'` claim value to uniquely identify access tokens issued by the same issuer for distinct
> resources."*

That "resource indicator" language is RFC 8707: the client asks for a token for a specific
resource by sending a `resource` parameter to the token endpoint, and the AS mints a token
whose `aud` is that resource. If your AS supports it, a client that needs to call three
services gets three tokens, each usable at exactly one — which is the shape you want, and the
reason "just cache one token and use it everywhere" is a design smell.

## Gotchas

**★ Absent `aud` must be a rejection, and RFC 7519 alone will not tell you that.**
§4.1.3's MUST fires only *"when this claim is present"*. The rule you implement comes from RFC
8725 §3.9 — reject when the audience is *"not present or not associated with the recipient"* —
and from RFC 9068 §2.2, which makes it REQUIRED outright.

**★ `aud` is a string OR an array, and issuers split roughly evenly between them.**
`(String) claims.get("aud")` throws a `ClassCastException` against the other half. Use
`Jwt#getAudience()`, which returns a `List<String>` in both cases.

**★ An empty array is present-and-empty, and must also fail.**
`"aud": []` triggers §4.1.3's conditional MUST — the claim is present and you are not in it.
Make sure your predicate does not treat an empty list as "unconstrained"; `contains(...)` gives
you that for free, while a hand-rolled `aud.stream().allMatch(...)` is vacuously true on an
empty list and passes.

**★ Audience matching must be exact-value membership, never a prefix or substring test.**
`aud.stream().anyMatch(a -> a.startsWith("https://orders"))` also matches
`https://orders.attacker.example`. Compare with `equals` against a configured constant.

**★ Setting `aud` to the client id makes ID tokens and access tokens indistinguishable.**
The ID token's audience *is* the client id, by OIDC's definition. If the API's identifier is the
same string, the audience check stops separating them and you are relying on `typ` alone —
see [05 · Explicit typing](03b-explicit-typing.md).

**★ A shared `internal` audience across all services is audience validation that validates
nothing.**
Every service accepts every other service's tokens, which is exactly the substitution attack you
were trying to prevent, now with a config file that looks like you prevented it.

**★ `aud` says nothing about *which client* obtained the token.**
That is `client_id` (RFC 9068 §2.2). A common review error is treating `aud` as the caller's
identity; it is the *callee's*. If you need to know who called, look at `client_id` or at `sub`.

**★ `aud` values are case-sensitive StringOrURI values, so `HTTPS://Orders.Example.com` is a
different audience.**
URL case-insensitivity for hosts does not apply here — RFC 7519 §4.1.3 says *"case-sensitive
strings"*. Copy the identifier from the authorization server's configuration rather than
retyping it.

**★ Multiple audiences in one token are legal and mean the token is valid at several
services.**
That is not an error, but it widens the blast radius by exactly the number of entries. If your
AS is emitting three audiences on every token, ask why — usually it is a client that did not
use RFC 8707 resource indicators and the AS defaulted to "everything this client may reach".

## Interview questions

**★ What actually goes wrong if you do not validate `aud`?**
Substitution, which RFC 8725 §2.7 defines as one recipient taking a JWT that was legitimately
issued to it and presenting it somewhere else. Concretely: a low-trust internal service, or a
partner integration, receives a token from a user and replays it against your payments API.
Same issuer, valid signature, valid `exp`, correct user — everything checks out except that the
token was never meant for you. The second failure is cross-JWT confusion: an ID token, which the
browser holds and any script on the page can read, has the same issuer and signature as an
access token, so without an audience check it is accepted as one. Both are closed by requiring
that `aud` contain a configured identifier for *this* service, and RFC 9068 §5 puts the matching
obligation on the AS: distinct `aud` values per resource.

**★ A token arrives with no `aud` claim at all. What does the specification say and what do you
do?**
RFC 7519 §4.1.3's MUST is conditional — it fires *"when this claim is present"* — so the base
specification does not require rejection. RFC 8725 §3.9 closes that gap and is the rule to
follow: if the issuer can issue tokens for more than one relying party then the JWT MUST contain
`aud`, and the recipient *"MUST reject the JWT"* if the audience is *"not present or not
associated with the recipient."* RFC 9068 §2.2 makes it REQUIRED for access tokens outright. So:
reject, and treat it as a finding against the authorization server's configuration rather than
as something to tolerate — an audience-less token is by construction replayable at every service
that trusts that issuer.

**★ Why is the API validating `iss`, `aud` and `exp` but never seeing a refresh token?**
Those three are the resource server's entire contract with the token. `iss` says which
authorization server minted it and therefore which keys may verify it. `aud` says it was minted
*for this API* and not for some other service that might replay it. `exp` bounds the damage
window, because a self-contained signed token cannot be un-issued. A refresh token is a
different animal: it is a credential the *client* presents to the *authorization server* to
obtain new access tokens, it is long-lived, and it is not a bearer credential for any API. A
resource server that ever saw one would be holding something far more dangerous than the access
token it needs. Keeping refresh tokens off the resource-server path is why a leaked access token
costs you minutes rather than months. [05 · The three tokens](../05-the-three-tokens/README.md) owns the
rest.

**★ Your architect proposes one `aud: internal` value for all twenty microservices, to simplify
configuration. What is your objection?**
That it is audience validation that validates nothing. The purpose of `aud` is to ensure a token
handed to service A cannot be replayed at service B; a shared value makes every token valid
everywhere, which is precisely the substitution attack RFC 8725 §2.7 describes, now wearing a
config file that looks like a control. RFC 9068 §5 requires the opposite — *"authorization
servers MUST use a distinct identifier as an `'aud'` claim value to uniquely identify access
tokens issued by the same issuer for distinct resources."* The operational objection is just as
strong: with per-service audiences, a compromised service holds tokens useful only against
itself, so the blast radius of an incident is one service instead of the estate. If the concern
is client complexity, the answer is RFC 8707 resource indicators — the client asks for a token
per resource — not a shared audience.

**★ Is `aud` the caller's identity?**
No, and confusing the two is a common review finding. `aud` identifies the *recipient* — the
service the token is meant for. The caller is identified by `sub` (the resource owner, or the
client in a client-credentials flow) and by `client_id`, which RFC 9068 §2.2 makes REQUIRED for
access tokens. Code that authorises on `aud` — "this token has `aud: payments`, so it may
perform payments" — has authorised on the wrong end of the relationship, and will grant access
to any token that names your service in its audience regardless of who obtained it or what
scopes it carries.

**★ Why does RFC 7519 allow `aud` to be either a string or an array?**
Compactness for the common case. Most tokens have exactly one audience, and forcing a
single-element array on every token costs two bytes per token on every request forever — which
in a format explicitly designed to be *"compact"* is a real consideration. The cost is that
every consumer must handle both shapes, and that is exactly where hand-rolled parsers break: a
cast to `String` works in development against one issuer and throws in production against
another. The lesson generalises: a union type in a wire format saves bytes and moves the burden
onto every implementer, so if you design one, ship a reference parser.

---

← [iss and sub](04-registered-claims-identity.md) · [Topic index](README.md) · Next → [Configuring audience validation](04c-configuring-audience-validation.md)
