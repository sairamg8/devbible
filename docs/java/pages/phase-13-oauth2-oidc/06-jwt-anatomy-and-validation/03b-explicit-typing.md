---
title: "typ is optional in RFC 7515 and mandatory in RFC 9068, and the reason a one-string header comparison earned a MUST is that an authorization server signs every kind of token it issues with the same key"
sidebar_label: "05 · Explicit typing"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7515 §4.1.9 (`typ`); RFC 7519 §5.1 (`typ`);
> RFC 8725 §2.8 (Cross-JWT Confusion), §3.11 (Use Explicit Typing), §3.12 (Use Mutually
> Exclusive Validation Rules for Different Kinds of JWTs); RFC 9068 §2.1 (Header),
> §4 (Validating JWT Access Tokens), §5 (Security Considerations); Spring Security 7.x
> `JwsHeader`, `JwtClaimsSet`, `JwtEncoderParameters` javadocs.
> ([rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt),
> [rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt))
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**An authorization server signs every kind of token it issues with the same key: ID tokens,
access tokens, logout tokens, DPoP proofs, software statements. A resource server that checks
only the signature, `iss`, `aud` and `exp` therefore cannot tell them apart — and the ID
token is the one the *client* holds and can read, which makes it by far the easiest of the
set for an attacker to obtain. `typ` is the one-string-comparison fix, and RFC 9068 makes it
the first step of access-token validation. The collision this creates with Spring Security
7's defaults is [03c](03c-the-spring-7-typ-collision.md); this chunk is why the header
matters at all.**

## What the specifications say

RFC 7519 §5.1, the baseline:

> *"The `'typ'` (type) Header Parameter defined by [JWS] and [JWE] is used by JWT
> applications to declare the media type of this complete JWT. … Use of this Header
> Parameter is OPTIONAL."*

RFC 8725 §3.11 promotes it from cosmetic to defensive:

> *"Explicit JWT typing is accomplished by using the `'typ'` Header Parameter."*
> … *"It is RECOMMENDED that the `'application/'` prefix be omitted from the `'typ'`
> value."*

RFC 8725 §2.8 names the threat:

> *"JWT tokens that have been issued for one purpose being subverted and used for another …
> If the JWT could be used in an application context in which it could be confused with other
> kinds of JWTs, then mitigations MUST be employed."*

and §3.12 states the requirement in its general form:

> *"If more than one kind of JWT can be issued by the same issuer, the validation rules for
> those JWTs MUST be written such that they are mutually exclusive, rejecting JWTs of the
> wrong kind."*

RFC 9068 §2.1 makes it mandatory for OAuth2 access tokens:

> *"JWT access tokens MUST include this media type in the `'typ'` header parameter to
> explicitly declare that the JWT represents an access token complying with this profile.
> … the `'typ'` value used SHOULD be `'at+jwt'`."*

and §4 makes it the *first* validation step a resource server performs:

> *"The resource server MUST verify that the `'typ'` header value is `'at+jwt'` or
> `'application/at+jwt'` and reject tokens carrying any other value."*

RFC 9068 §5 states the payoff:

> *"The explicit typing required in this profile, in line with the recommendations in
> [RFC8725], helps the resource server to distinguish between JWT access tokens and OpenID
> Connect ID Tokens."*

## The attack, concretely

Consider an OIDC deployment with one authorization server and one API:

1. A user logs into the SPA. The SPA legitimately receives an **ID token** (`aud` = client
   id, `typ` = `JWT`) and an **access token** (`aud` = the API, `typ` = `at+jwt`).
2. The API's resource server is configured with `issuer-uri` and nothing else. Spring's
   defaults validate the signature, `exp`, `nbf` and `iss`. **They do not validate `aud`.**
3. The SPA — or anything that can read the SPA's storage, which for an ID token in a browser
   is a long list — sends the *ID token* in the `Authorization` header.
4. Signature: valid, same key. `iss`: matches. `exp`/`nbf`: valid. The API accepts it.

Nothing was forged. No key was compromised. A token that was issued for one purpose was
accepted for another, exactly as RFC 8725 §2.8 describes. The severity depends on what the ID
token's claims map to — if your authorities converter reads `scope` and the ID token has
none, the caller lands as an authenticated principal with no authorities, which some codebases
treat as "logged in" and is enough.

The related case is **substitution**, RFC 8725 §2.7:

> *"One recipient will be given a JWT that was intended for it and will attempt to use it at a
> different recipient for which that JWT was not intended."*

That one is about `aud` across *services* rather than about token *kind*, and it is
**11d** *(not written yet)*.

## Why `aud` is not enough on its own

The instinctive objection is "surely the audience already separates them". In a
well-configured deployment it does: the ID token's `aud` is the client id, the access token's
`aud` is the resource server's identifier, and a resource server that requires its own
identifier in `aud` rejects the ID token.

It fails in two very common configurations:

- **Single-application deployments** where somebody set both the client id and the API
  identifier to `my-app`, because that seemed tidy. Now the two tokens are indistinguishable
  by audience.
- **Resource servers that do not validate `aud` at all.** This is the Spring default unless
  you set `spring.security.oauth2.resourceserver.jwt.audiences` or add a validator;
  `JwtValidators.createDefault()` contains no audience validator.

RFC 8725 §3.12 lists explicit typing first among the mitigations precisely because it does not
depend on anyone having configured anything else correctly. It is a property of the format,
checked before any claim is read.

## Choosing what `typ` values to accept

| Policy | Accept | When |
|---|---|---|
| RFC 9068 strict | `at+jwt`, `application/at+jwt` | Your AS follows RFC 9068 and you want cross-JWT confusion structurally impossible |
| Vendor | e.g. Keycloak's `Bearer` | You cannot change the AS; still mutually exclusive from the ID token's `JWT` |
| Permissive | `JWT` or absent | Legacy issuers; you must then rely on `aud` and required-claim differences for §3.12 mutual exclusivity |

The permissive option is not automatically wrong — RFC 8725 §3.12 offers several mechanisms
and explicit typing is only one — but if you choose it you *must* positively validate `aud`
and at least one claim that ID tokens do not carry. Write that decision down where a reviewer
will find it, because the next person will read the permissive config as "we check nothing".

Vendor values you will actually meet: **Keycloak** emits `typ: Bearer` on access tokens and
`typ: JWT` on ID tokens (so it is mutually exclusive, just not RFC 9068-spelled).
**Auth0** and several others emit `typ: JWT` on both by default and rely on `aud`. Check your
own issuer rather than assuming; it is one decoded header away.

## If you also mint tokens

Set `typ` on the way out. With `NimbusJwtEncoder`, the header is yours to build:

```java
JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256)
        .type("at+jwt")                 // JoseHeaderNames.TYP
        .build();

JwtClaimsSet claims = JwtClaimsSet.builder()
        .issuer(this.issuer)
        .subject(userId)
        .audience(List.of("https://orders.example.com"))
        .issuedAt(now)
        .expiresAt(now.plus(Duration.ofMinutes(10)))
        .id(UUID.randomUUID().toString())
        .build();

Jwt token = this.encoder.encode(JwtEncoderParameters.from(header, claims));
```

If you issue more than one kind of token from the same key — an access token and, say, an
internal service ticket — give each kind a distinct `typ` and make each verifier demand
exactly one. That is RFC 8725 §3.12 satisfied by construction rather than by discipline.
**13 · JwtEncoder** *(not written yet)* covers minting properly, including the trap that
`NimbusJwtEncoder` defaults the `typ` header to `JWT`.

## Gotchas

**★ You must accept both `at+jwt` and `application/at+jwt`.**
RFC 9068 §4 requires verifying the value *"is `'at+jwt'` or `'application/at+jwt'`"*. RFC
8725 §3.11 recommends producers omit the prefix, but nothing forbids sending it. Configure
both, or you will spend an afternoon debugging an issuer that is entirely conformant.

**★ `typ` is optional in RFC 7515/7519, so "the token has no `typ`" is not an anomaly by
itself.**
It is only an anomaly for a token claiming to follow RFC 9068. Do not build alerting on absent
`typ` for generic JWTs; build mutually exclusive validation rules per RFC 8725 §3.12 instead.

**★ `aud` does not separate ID tokens from access tokens when the client id and the API
identifier are the same string.**
This is common in single-application deployments where one identifier felt tidier. The two
token kinds then differ only by `typ` and by which claims they carry.

**★ Spring validates `aud` only if you tell it to.**
`JwtValidators.createDefault()` has no audience validator, and `issuer-uri` alone does not add
one. If you were relying on audience to keep ID tokens out, check that you configured
`spring.security.oauth2.resourceserver.jwt.audiences` or added a `JwtAudienceValidator`.

**★ An accepted ID token often produces an authenticated principal with zero authorities, not
an error.**
Because it has no `scope` claim, Spring's default converter maps no `SCOPE_` authorities. Any
endpoint guarded only by `authenticated()` therefore lets it through. The failure is silent
and looks like a working request.

**★ Turning off type checking to make an upgrade compile is a security regression, not a
workaround.**
The correct move is to change *which* values are accepted, never to stop checking. If you
genuinely cannot pin a `typ`, compensate with a strict `aud` check plus a required claim that
ID tokens do not have, and record the decision.

**★ Explicit typing does not help if only one side does it.**
An AS that stamps `at+jwt` on access tokens buys nothing unless resource servers demand it,
and a resource server that demands it breaks when the AS does not stamp it. It is a two-sided
agreement; treat it as part of the AS onboarding checklist for a new service.

## Interview questions

**★ What is cross-JWT confusion and how does `typ` prevent it?**
An issuer usually signs several kinds of JWT with the same key — ID tokens, access tokens,
logout tokens, DPoP proofs, software statements. A resource server that checks only
signature, `iss`, `aud` and `exp` cannot distinguish them, so an ID token — which the client
legitimately holds and can read out of browser storage — can be presented as an access token.
RFC 8725 §2.8 names this and §3.12 requires that *"the validation rules for those JWTs MUST be
written such that they are mutually exclusive."* `typ` is the cheapest discriminator: RFC 9068
requires `at+jwt` on access tokens, so a resource server that demands it rejects an ID token
structurally, before reading a single claim. The alternatives from the same section — distinct
`aud` values, distinct required claims, separate signing keys, separate issuers — all work;
`typ` is the one that costs nothing and does not depend on somebody else's configuration
being right.

**★ Why is explicit typing described as a defence rather than as metadata?**
Because every alternative discriminator is something a developer can forget, and `typ` is
something the *format* carries. `aud` only discriminates if the ID token's audience differs
from the resource server's identifier — true in a well-configured deployment, false in a lazy
one where everything got `aud: my-app`, and irrelevant if the resource server never checks
`aud`, which is Spring's default. Required-claim differences only discriminate if you actually
require them. Separate signing keys only discriminate if the AS bothers. A `typ` check is a
single string comparison performed before any of that, and RFC 9068 §5 says it exists
specifically to help the resource server *"distinguish between JWT access tokens and OpenID
Connect ID Tokens."*

**★ Your authorization server is a vendor product you cannot change, and it emits a `typ`
value that is neither `JWT` nor `at+jwt`. What do you do?**
Configure a type validator for exactly that value. The security property you need is *mutual
exclusivity*, not conformance to RFC 9068's spelling: as long as the value on an access token
differs from the value on an ID token, and your resource server demands the access-token
value, cross-JWT confusion is closed. Put the vendor value in configuration with a comment
citing RFC 8725 §3.12, and add a test that fails if an ID token from the same issuer is
accepted — that test is the thing that survives the next upgrade or vendor change.

**★ If `typ` is optional per RFC 7515, is a token without it invalid?**
No. RFC 7515 §4.1.9 and RFC 7519 §5.1 both make it optional. What is invalid is an *RFC 9068
access token* without it, because §2.1 of that profile says MUST. So the answer depends on
which contract the token claims to satisfy — which is itself a small lesson in why explicit
typing is useful: without it, you cannot tell which contract to apply, which is the confusion
the header exists to remove.

**★ Show me the failure mode when an ID token is accepted as an access token. What does the
application actually see?**
It sees an authenticated request. The `Authentication` is a `JwtAuthenticationToken` whose
principal is the `Jwt`; `sub` is populated, so any code that does `jwt.getSubject()` gets a
plausible user id. What is missing is the `scope` claim, so Spring's default
`JwtGrantedAuthoritiesConverter` produces no `SCOPE_` authorities. That means endpoints
guarded by `hasAuthority('SCOPE_orders:read')` deny it — good — while endpoints guarded only
by `authenticated()` allow it. So the blast radius is exactly your set of
merely-authenticated endpoints, which in most codebases is larger than anyone remembers.

---

← [The header contract and alg](03-the-jose-header.md) · [Topic index](README.md) · Next → [The Spring 7 typ collision](03c-the-spring-7-typ-collision.md)
