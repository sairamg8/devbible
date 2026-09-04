---
title: "The token response is a five-field JSON document with two conditional fields, two mandatory cache headers and one parameter whose absence means the opposite of what most clients assume"
sidebar_label: "03 · The token response"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §5.1 (Successful Response), §3.3 (Access Token
> Scope), §7.1 (Access Token Types)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 6750 §1.2, §6.1.1
> (The "Bearer" OAuth Access Token Type)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); OpenID Connect Core 1.0
> §3.1.3.3 (Successful Token Response)
> ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Everything the client is entitled to know about its tokens arrives in one JSON object, and
that object is specified tightly enough that you should be able to recite it. Five
parameters, two of them conditional, one of them case-insensitive, two mandatory response
headers, and a `200 OK`. Most client bugs in this area are a misreading of one of the two
conditional fields.**

## The five parameters, verbatim

RFC 6749 §5.1 opens:

> *"The authorization server issues an access token and optional refresh token, and
> constructs the response by adding the following parameters to the entity-body of the HTTP
> response with a 200 (OK) status code"*

| Parameter | Requirement | Definition (RFC 6749 §5.1, verbatim) |
|---|---|---|
| `access_token` | REQUIRED | *"The access token issued by the authorization server."* |
| `token_type` | REQUIRED | *"The type of the token issued as described in Section 7.1. Value is case insensitive."* |
| `expires_in` | RECOMMENDED | *"The lifetime in seconds of the access token. For example, the value `3600` denotes that the access token will expire in one hour from the time the response was generated."* |
| `refresh_token` | OPTIONAL | *"The refresh token, which can be used to obtain new access tokens using the same authorization grant as described in Section 6."* |
| `scope` | OPTIONAL/REQUIRED | *"OPTIONAL, if identical to the scope requested by the client; otherwise, REQUIRED. The scope of the access token as described by Section 3.3."* |

And the serialisation rule:

> *"The parameters are included in the entity-body of the HTTP response using the
> `application/json` media type […] The parameters are serialized into a JavaScript Object
> Notation (JSON) structure by adding each parameter at the highest structure level.
> Parameter names and string values are included as JSON strings. Numerical values are
> included as JSON numbers. The order of parameters does not matter and can vary."*

"At the highest structure level" rules out a nested `{"data": {...}}` envelope. "Numerical
values are included as JSON numbers" rules out `"expires_in": "3600"` as a string — several
vendors have shipped that, and a strict parser will reject it.

## The two mandatory headers

> *"The authorization server MUST include the HTTP `Cache-Control` response header field
> with a value of `no-store` in any response containing tokens, credentials, or other
> sensitive information, as well as the `Pragma` response header field with a value of
> `no-cache`."*

Two independent `MUST`s, and note the scope: *any* response containing tokens — so the
refresh response and the revocation response fall under it too. `Pragma: no-cache` is an
HTTP/1.0 relic that RFC 6749 nonetheless mandates; OIDC Core §3.1.3.3, written later,
requires only `Cache-Control: no-store`. If you are building an authorization server, emit
both and you satisfy both specs.

The practical failure here is not the AS: it is an API gateway, CDN or reverse proxy in
front of it that rewrites cache headers by policy. A shared cache that stores a token
response is a token-distribution service.

## The shape, illustrative

This is the structure defined by §5.1 with placeholder values — **not a real token**:

```http
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8
Cache-Control: no-store
Pragma: no-cache

{
  "access_token": "<opaque-access-token>",
  "token_type": "Bearer",
  "expires_in": 300,
  "refresh_token": "<opaque-refresh-token>",
  "scope": "orders:read"
}
```

RFC 6749's own §5.1 example uses `2YotnFZFEjr1zCsicMWpAA` as the access token and
`tGzv3JOkF0XG5Qx2TlKWIA` as the refresh token; those literals are safe to reuse in teaching
material precisely because they are the RFC's own published examples, and they are not
credentials for anything.

## `token_type` and what it does not tell you

§5.1 points at §7.1 for the meaning. In practice there are two values you will meet:
`Bearer` (RFC 6750) and `DPoP` (RFC 9449). RFC 6750 §6.1.1 registers `Bearer`; OIDC Core
§3.1.3.3 constrains it further for OIDC flows:

> *"The OAuth 2.0 `token_type` response parameter value MUST be `Bearer`, as specified in
> OAuth 2.0 Bearer Token Usage […] unless another Token Type has been negotiated with the
> Client."*

Two things follow. First, the value is **case insensitive** — `bearer`, `Bearer` and
`BEARER` are all the same token type, and a client that does `"Bearer".equals(tokenType)` is
one vendor away from a bug. Second, `token_type` says how to *present* the token, not what
is *inside* it. There is no value that means "this is a JWT" and no value that means "this
is opaque". A client cannot learn the format from this field, which is another way of
observing that it is not supposed to want to.

## The OIDC addition

OIDC Core §3.1.3.3 adds exactly one parameter and makes it mandatory for OIDC flows:

> *"In addition to the response parameters specified by OAuth 2.0, the following parameters
> MUST be included in the response: `id_token` — ID Token value associated with the
> authenticated session."*

So an OIDC token response is an OAuth2 token response plus `id_token`. The ID token's role
is **17 · The ID token as a token role** *(not written yet)*; its claims and
validation are **07 · OpenID Connect** *(not written yet)* and
[06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md).

## How Spring models it

`OAuth2AccessTokenResponse` is a direct mapping of §5.1, and the mapping is worth seeing
because it tells you which fields Spring treats as first-class:

```java
OAuth2AccessTokenResponse response = ...;

OAuth2AccessToken accessToken = response.getAccessToken();
accessToken.getTokenType();      // OAuth2AccessToken.TokenType.BEARER
accessToken.getTokenValue();     // the String
accessToken.getIssuedAt();
accessToken.getExpiresAt();      // issuedAt + expires_in, null if expires_in absent
accessToken.getScopes();         // from the `scope` response parameter

OAuth2RefreshToken refreshToken = response.getRefreshToken(); // may be null
Map<String, Object> extras      = response.getAdditionalParameters(); // e.g. id_token
```

Note where `id_token` lands: in `getAdditionalParameters()`, not on a typed accessor,
because it is an OIDC extension to an OAuth2 structure. Spring's OIDC support pulls it out
of there.

Note also that `getExpiresAt()` is derived, not read from the token — the whole argument of
[02b](02b-what-parsing-an-access-token-costs-you.md).

## Gotchas

**★ An absent `scope` means "exactly what you asked for", not "no scopes".**
This is the single most misread line in §5.1. `scope` is *"OPTIONAL, if identical to the
scope requested by the client; otherwise, REQUIRED"* — so a fully-granted request may
legitimately come back with no `scope` field at all. Client code that treats an empty scope
set as "denied" breaks on the happy path.

**★ `token_type` is case insensitive and the RFC says so in the field definition itself.**
*"Value is case insensitive."* Real deployments have shipped `bearer` in lowercase. Compare
with `equalsIgnoreCase`, or use a library that already does.

**★ `expires_in` is a JSON *number*, and vendors ship it as a string.**
§5.1: *"Numerical values are included as JSON numbers."* A quoted `"3600"` is
non-conformant. A hand-rolled client with a strict mapper will throw; a lenient one will
coerce. Know which you have before you debug it at 2am.

**★ `expires_in` is measured from when the response was *generated*, not received.**
Between generation and your code running there is serialisation, network, TLS, a queue and a
JSON parse. Always subtract a skew — Spring Security's
`RefreshTokenOAuth2AuthorizedClientProvider` defaults to 60 seconds — and never treat
`expires_in` as a countdown starting at your parse.

**★ `refresh_token` is OPTIONAL and its absence is normal, not an error.**
Client credentials responses should not carry one at all (that is
[04 · Client credentials](../04-client-credentials/README.md)), and an AS may decline to issue one for a
browser client. RFC 9700 §4.14.2 makes this an explicit AS decision: *"Authorization servers
MUST determine, based on a risk assessment, whether to issue refresh tokens to a certain
client."*

**★ There is no standard field telling you when the *refresh* token expires.**
Vendors emit `refresh_token_expires_in` or `refresh_expires_in`; neither is in RFC 6749
§5.1. Any client that depends on one will not port, and any client that lacks a robust
`invalid_grant` path on refresh will fail in production regardless of what the field said.

**★ `Cache-Control: no-store` is the AS's obligation but your proxy's failure mode.**
The `MUST` binds the authorization server. If you front the AS with a gateway or CDN that
applies a caching policy by route, verify the token endpoint is excluded, and verify it
after every gateway config change — this is a silent, catastrophic misconfiguration with no
error message.

**★ A `200 OK` with an `error` field in the body is a non-conformant AS, and clients get
this wrong in both directions.**
RFC 6749 §5.1 is `200 OK` for success; §5.2 is `400 Bad Request` (unless specified
otherwise) for failure. Clients that branch on the presence of `access_token` rather than on
the status code will silently treat some error responses as success if the AS is sloppy.
Branch on status, then parse.

**★ Do not assume the fields you got last time.**
"The order of parameters does not matter and can vary", and an AS may add parameters. A
client that deserialises into a strict record with `FAIL_ON_UNKNOWN_PROPERTIES` enabled will
break the day the AS adds a field — which it is allowed to do.

## Interview questions

**★ Recite the token response.**
`200 OK`, `Content-Type: application/json`, with `Cache-Control: no-store` and
`Pragma: no-cache` both mandatory. Body is a flat JSON object with `access_token`
(REQUIRED), `token_type` (REQUIRED, case-insensitive, `Bearer` in practice), `expires_in`
(RECOMMENDED, seconds, a JSON number, measured from response generation), `refresh_token`
(OPTIONAL) and `scope` (OPTIONAL if it exactly matches what was requested, otherwise
REQUIRED). An OIDC response adds `id_token`, which OIDC Core §3.1.3.3 makes mandatory for
OIDC flows.

**★ The token response came back without a `scope` field. What happened?**
Most likely nothing went wrong: RFC 6749 §5.1 makes `scope` optional when the granted scope
is identical to the requested scope, so a fully-granted request may omit it. The client
should treat that as "I got what I asked for" and carry its requested scopes forward — which
is exactly what Spring's `RestClientRefreshTokenTokenResponseClient` does, copying the
previous token's scopes when the response has none. Treating it as an empty grant is a
common bug that disables client functionality on successful authorizations.

**★ Why does RFC 6749 mandate `Cache-Control: no-store` and `Pragma: no-cache`, and where
does that requirement actually break?**
Because the response body is a bearer credential, and any shared cache that stores it will
hand it to the next requester. `Pragma: no-cache` is there for HTTP/1.0 caches that do not
understand `Cache-Control`. The requirement binds the authorization server, but the failure
in practice is downstream: a CDN, reverse proxy or API gateway in front of the AS applying a
blanket caching policy, or an over-eager HTTP client library caching `200 OK` responses. It
is silent — there is no error, just tokens being served to the wrong caller.

**★ What does `token_type` tell you, and what does it not?**
It tells you how to present the token on a request: `Bearer` means the RFC 6750 scheme, so
`Authorization: Bearer <token>`; `DPoP` means RFC 9449, so the `Authorization: DPoP` scheme
plus a `DPoP` proof header. It does not tell you anything about the token's internal format
— there is no value meaning "JWT" and no value meaning "opaque". It is also case
insensitive, which the field definition states explicitly, so string comparison must ignore
case.

**★ Your client stores `expiresAt = now() + expires_in` and refreshes exactly at
`expiresAt`. What goes wrong in production?**
Intermittent 401s clustered at the boundary. `expires_in` is counted from when the AS
*generated* the response, so by the time the client computes `now()` the token has already
lost the serialisation, network and parse time; add clock drift between the client host and
the AS host and the client's idea of expiry can be seconds later than the server's. The fix
is a skew: treat the token as expired early. Spring Security's refresh provider does
`clock.instant().isAfter(expiresAt.minus(clockSkew))` with a 60-second default, and that
default exists for exactly this reason.

---

← [What parsing costs you](02b-what-parsing-an-access-token-costs-you.md) · [Topic index](README.md) · Next → [The token error response](03b-the-token-error-response.md)
