---
title: "An access token is opaque to the client by contract, and the fact that it is often a JWT is a private implementation choice of the authorization server that a client is forbidden to depend on"
sidebar_label: "02 · Opaque by contract"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.4 (Access Token) and §5.1 (Successful Response)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9068 §1
> (Introduction), §2.1 (Header), §4 (Validating JWT Access Tokens) and §6 (Privacy
> Considerations) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9068.txt));
> RFC 7009 §3 (Implementation Note)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7009.txt)); OpenID Connect Core 1.0 §2
> ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Because every tutorial pastes an access token into jwt.io and it decodes, an entire
generation of client code was written on the assumption that an access token is a JWT. It
is not. OAuth 2.0 defines an access token as a *string*, and the specification that
standardised the JWT form says in its own words that the client MUST NOT look inside it.
This is not pedantry: a client that reads an access token has taken a private, unversioned,
unannounced dependency on a format the authorization server is entitled to change on a
Tuesday.**

## What RFC 6749 actually says

§1.4, in full, is short and worth reading closely:

> *"Access tokens are credentials used to access protected resources. An access token is a
> string representing an authorization issued to the client. The string is usually opaque
> to the client. Tokens represent specific scopes and durations of access, granted by the
> resource owner, and enforced by the resource server and authorization server."*

And the next paragraph names both possibilities as equally legitimate:

> *"The token may denote an identifier used to retrieve the authorization information or may
> self-contain the authorization information in a verifiable manner (i.e., a token string
> consisting of some data and a signature)."*

Then the closing paragraph:

> *"Access tokens can have different formats, structures, and methods of utilization (e.g.,
> cryptographic properties) based on the resource server security requirements. Access token
> attributes and the methods used to access protected resources are beyond the scope of this
> specification."*

Read that as a contract clause. The format is *out of scope of the standard*, which is
another way of saying: nothing in the protocol lets a client rely on it.

## The prohibition is explicit, and it is in the JWT profile itself

The delicious part is that the strongest statement of "clients do not read access tokens"
appears in **RFC 9068, the specification whose entire job is to define the JWT access-token
format**. §6, Privacy Considerations:

> *"The client MUST NOT inspect the content of the access token: the authorization server
> and the resource server might decide to change the token format at any time (for example,
> by switching from this profile to opaque tokens); hence, any logic in the client relying
> on the ability to read the access token content would break without recourse. The OAuth
> 2.0 framework assumes that access tokens are treated as opaque by clients."*

"Would break without recourse" is the operative phrase. There is no negotiation mechanism,
no version header, no capability announcement. If the AS switches to opaque tokens — or
encrypts them, which RFC 9068 §6 lists as an available privacy measure — every client that
was parsing them fails at once and cannot detect the change in advance.

## Contrast: the ID token *is* a JWT, by specification

This is the asymmetry to hold in your head. OpenID Connect Core 1.0 §2:

> *"The ID Token is represented as a JSON Web Token (JWT)."*

No "usually". No "may". The ID token's format is part of its definition, because its
consumer is the client, and a token you expect the client to read has to have a format the
client can rely on. That is precisely why the ID token exists as a separate token instead
of the client just reading the access token: **OIDC needed a token the client is allowed to
open, and rather than change the access token's contract, it added one.**

If you take away one thing from this topic, take that.

## The three parties and what each may know

| Party | May read the access token? | On what basis |
|---|---|---|
| Authorization server | yes | it minted it |
| Resource server | yes | it is the audience; RFC 9068 §4 defines exactly how it validates one |
| **Client** | **no** | RFC 6749 §1.4 "usually opaque"; RFC 9068 §6 "MUST NOT inspect" |

Note the asymmetry in the middle row. RFC 9068 §4 spells out a full validation algorithm
*for resource servers* — check `typ` is `at+jwt`, check `iss` exactly matches, check `aud`
contains this RS, verify the signature, reject `alg: none`, check `exp`. The RS is a
first-class reader of the token. The client is not mentioned in §4 at all, and is
prohibited in §6.

## But the token is right there in the client's memory

Yes. RFC 9068 §6 opens by admitting exactly that:

> *"As JWT access tokens carry information by value, it now becomes possible for clients and
> potentially even end users to directly peek inside the token claims collection of
> unencrypted tokens."*

Being *able* to read it is not permission to read it. The RFC's guidance to authorization
server operators is the mirror image: *"Administrators of authorization servers should also
take into account that the content of an access token is visible to the client. Whenever
client access to the access token content presents privacy issues for a given scenario, the
authorization server needs to take explicit steps to prevent them."* — and it lists those
steps: *"encrypting the access token, encrypting the sensitive claims, omitting the
sensitive claims or not using this profile, and falling back on opaque access tokens."*

So the AS is actively told it may make the token unreadable. A client built on reading it is
built on something the AS has been advised it may take away.

## Why "opaque" is not the same as "opaque tokens"

Two different words that sound identical in a meeting:

- **Opaque *to the client*** — a contract property. True of every access token, always,
  including JWT ones.
- **An *opaque token*** — a format choice by the AS, meaning a handle/reference token with
  no content, whose meaning lives in the AS's database and is retrieved via introspection
  (RFC 7662). RFC 7009 §3 describes both designs precisely, calling the second *"access
  tokens that are handles referring to authorization data stored at the authorization
  server."*

A JWT access token is opaque to the client and *not* an opaque token. Both statements are
true simultaneously, and conflating them is how "we use JWTs so clients can read the user's
role" gets into a design document. The format trade-off itself is
**15 · Opaque vs JWT as an AS choice** *(not written yet)*.

## What a Java client looks like when it obeys the contract

The correct client-side model of an access token is a string plus an expiry that the AS
told you — never a parsed claim set. Spring Security's own client-side type reflects this:

```java
// org.springframework.security.oauth2.core.OAuth2AccessToken — the shape the client sees
OAuth2AccessToken token = authorizedClient.getAccessToken();

String value      = token.getTokenValue();   // an opaque String. Do not parse it.
Instant expiresAt = token.getExpiresAt();    // derived from expires_in, NOT from an exp claim
Set<String> scopes = token.getScopes();      // from the `scope` response field, NOT a claim
```

Everything the client legitimately knows about the token came from the **token response**
(RFC 6749 §5.1), not from the token. `getExpiresAt()` is computed from `expires_in`;
`getScopes()` is parsed from the `scope` response parameter. There is no
`getClaims()` on `OAuth2AccessToken`, and that is deliberate.

Compare with the ID token, which Spring models as a `Jwt` subtype with claims, because
reading it is the point:

```java
// org.springframework.security.oauth2.core.oidc.OidcIdToken extends AbstractOAuth2Token
OidcIdToken idToken = oidcUser.getIdToken();
String subject   = idToken.getSubject();      // "sub"
Instant authTime = idToken.getAuthenticatedAt();
```

Two types, two contracts, and the type system is telling you which is which.

## Gotchas

**★ "It decodes on jwt.io" is not evidence that you may decode it.**
It is evidence that this AS, today, in this environment, issues JWTs. Staging and production
are frequently configured differently; a Keycloak realm and an Auth0 tenant will not agree;
and an AS migration is exactly the moment your parsing client dies. RFC 9068 §6: *"any logic
in the client relying on the ability to read the access token content would break without
recourse."*

**★ The access token you get in a dev environment may be a JWT and the production one may
not.**
Vendors offer both. Some issue a JWT only when the request includes a `resource` or
`audience` parameter naming a registered API, and an opaque token otherwise — which means
whether it is a JWT depends on a request parameter your client may or may not send. Testing
against dev proves nothing about format.

**★ Encrypted access tokens (JWE) are a supported and non-exotic option.**
RFC 9068 §4 explicitly handles the case: *"If the JWT access token is encrypted, decrypt it
using the keys and algorithms that the resource server specified during registration."*
A client that parses tokens breaks the day the security team turns encryption on for a
privacy review, and that change will not appear in any client-facing changelog.

**★ The resource server reading the token is not the same permission as the client reading
it.**
People generalise from "our API reads the JWT" to "so the SPA can too". The RS is the
audience — its whole job is to validate and read. The client is not. If your SPA needs the
user's name, that is what the ID token and the UserInfo endpoint are for.

**★ A client that reads `exp` from the token instead of `expires_in` from the response is
already broken.**
Not just contractually — practically. The moment the AS switches to opaque tokens, or
shortens tokens, or introduces a leeway, the client's expiry logic silently diverges from
the AS's. `expires_in` is the AS *telling* the client the answer, and it is available for
every token format.

**★ There is no standard way for a client to ask what format it is getting.**
`token_type` is `Bearer` for both JWT and opaque tokens — it describes *how to present* the
token (RFC 6750), not what is inside it. There is no `token_format` parameter. The absence
of a negotiation mechanism is itself the argument: a dependency you cannot negotiate is a
dependency you cannot safely take.

**★ Logging a decoded access token is the same violation with worse consequences.**
"We only decode it for debugging" puts subject identifiers, entitlements and sometimes email
addresses into log aggregation, which is a privacy incident independent of the coupling
argument. RFC 9068 §6 is in the *Privacy* Considerations section for a reason.

## Interview questions

**★ Is an access token a JWT?**
Not by specification. RFC 6749 §1.4 defines it as *"a string representing an authorization
issued to the client"* and says *"The string is usually opaque to the client"*, and it
explicitly permits both a reference/handle design and a self-contained signed design. JWT is
one popular concrete format, standardised after the fact by RFC 9068 as a profile — an
option the authorization server may take, not a property of OAuth2. The ID token, by
contrast, *is* a JWT by definition, per OpenID Connect Core §2.

**★ The specification says access tokens are "usually" opaque to the client. Is a client
allowed to parse one when it happens to be a JWT?**
No. RFC 6749's "usually" is descriptive; RFC 9068 §6 is normative and says *"The client MUST
NOT inspect the content of the access token"*, giving the reason: the AS or RS may change the
format at any time, including switching to opaque tokens, and *"any logic in the client
relying on the ability to read the access token content would break without recourse."*
There is no protocol mechanism by which a client could detect or negotiate such a change, so
the dependency is uninsurable.

**★ Why does OIDC introduce a separate ID token instead of letting the client read the
access token, which already contains `sub`?**
Because the access token's contract with the client is opacity, and OIDC needed a token the
client is entitled to read and validate. Adding a second token preserved the access token's
freedom to change format, to be opaque, or to be encrypted, while giving the relying party a
stable, specified JWT with a defined `aud` (the client id), a defined `nonce` binding, and a
defined validation algorithm. Overloading the access token would have made every AS's format
choice a breaking change for every client.

**★ Your SPA needs the user's display name. Where does it get it, if not from the access
token?**
Three legitimate sources, in order of preference: the `id_token`, which is a JWT the client
is meant to read and which carries the standard profile claims when the `profile` scope was
granted; the UserInfo endpoint, which the client calls with the access token and which
returns claims about the authenticated subject; or the application's own backend, which
knows the user by `sub` and can return whatever the product needs. All three are stable
contracts. Reading the access token is not. The OIDC side of that — scopes, claims, UserInfo
— is **07 · OpenID Connect** *(not written yet)*.

**★ What breaks, concretely, on the day the authorization server switches from JWT access
tokens to opaque ones?**
Every resource server that validates locally with a `JwtDecoder` starts rejecting every
request, because an opaque handle is not a parseable JWS — that is a planned migration and
is visible immediately. What is *not* visible immediately is the client side: any client
code that decoded the token to find the expiry, the scopes, the tenant, or a display name
now throws or silently produces nulls, and because clients are deployed independently
(especially mobile apps already in users' hands), you cannot roll them forward. That
asymmetry — the server breaks loudly and rolls back, the client breaks quietly and cannot —
is why the prohibition is aimed at clients.

---

← [Three tokens, three roles](01-three-tokens-three-roles.md) · [Topic index](README.md) · Next → [What parsing costs you](02b-what-parsing-an-access-token-costs-you.md)
