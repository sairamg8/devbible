---
title: "The resource server has exactly three things to say about a token and each maps to a different HTTP status, so a 401 and a 403 from an API are not two shades of failure — they are two different instructions to the client"
sidebar_label: "05 · WWW-Authenticate challenges"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §3 (The WWW-Authenticate Response Header Field) and
> §3.1 (Error Codes) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt));
> RFC 9068 §4 (Validating JWT Access Tokens)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9068.txt)); RFC 9449 §7.1 (The DPoP
> Authentication Scheme) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9449.txt));
> `BearerTokenAuthenticationEntryPoint` source on `main`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-security));
> Spring Security 7.x reference — Bearer Tokens
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/bearer-tokens.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A client that cannot tell "your token is broken, get a new one" from "your token is fine
but it does not cover this" will either refresh pointlessly forever or log the user out for
clicking a button they lack permission for. RFC 6750 §3.1 draws that line with three error
codes and three status codes, and Spring implements it exactly. Getting this right is what
makes a client's retry logic correct rather than superstitious.**

## When the challenge is mandatory

RFC 6750 §3:

> *"If the protected resource request does not include authentication credentials or does not
> contain an access token that enables access to the protected resource, the resource server
> MUST include the HTTP `WWW-Authenticate` response header field; it MAY include it in
> response to other conditions as well."*

> *"All challenges defined by this specification MUST use the auth-scheme value `Bearer`.
> This scheme MUST be followed by one or more auth-param values."*

So an API that returns a bare 401 with no `WWW-Authenticate` header is non-conformant, and it
is depriving the client of the only structured information it has.

## The auth-params

| Param | Requirement | RFC 6750 §3 |
|---|---|---|
| `realm` | MAY | *"A `realm` attribute MAY be included to indicate the scope of protection […] The `realm` attribute MUST NOT appear more than once."* |
| `scope` | OPTIONAL | *"a space-delimited list of case-sensitive scope values indicating the required scope of the access token for accessing the requested resource"* |
| `error` | SHOULD, when a token was presented and failed | *"If the protected resource request included an access token and failed authentication, the resource server SHOULD include the `error` attribute"* |
| `error_description` | MAY | *"a human-readable explanation that is not meant to be displayed to end-users"* |
| `error_uri` | MAY | *"an absolute URI identifying a human-readable web page explaining the error"* |

The `scope` parameter is the useful one nobody uses. §3 says of it:

> *"In some cases, the `scope` value will be used when requesting a new access token with
> sufficient scope of access to utilize the protected resource."*

That is a machine-readable "here is what you would need" — a client can take it, request an
incremental authorization with exactly those scopes, and retry. Most resource servers never
emit it, which is why most clients never implement the recovery.

The RFC's own examples of scope values, which it takes from OIDC and the OATC protocol:

```
scope="openid profile email"
scope="urn:example:channel=HBO&urn:example:rating=G,PG-13"
```

## The three error codes, verbatim, with their statuses

> **`invalid_request`** — *"The request is missing a required parameter, includes an
> unsupported parameter or parameter value, repeats the same parameter, uses more than one
> method for including an access token, or is otherwise malformed. The resource server SHOULD
> respond with the HTTP 400 (Bad Request) status code."*

> **`invalid_token`** — *"The access token provided is expired, revoked, malformed, or invalid
> for other reasons. The resource SHOULD respond with the HTTP 401 (Unauthorized) status code.
> The client MAY request a new access token and retry the protected resource request."*

> **`insufficient_scope`** — *"The request requires higher privileges than provided by the
> access token. The resource server SHOULD respond with the HTTP 403 (Forbidden) status code
> and MAY include the `scope` attribute with the scope necessary to access the protected
> resource."*

Three codes, three statuses, three client behaviours:

| Code | Status | What the client should do |
|---|---|---|
| `invalid_request` | 400 | Fix the request. Do not refresh. Do not retry unchanged. |
| `invalid_token` | 401 | **Refresh once, retry once.** The RFC explicitly permits it. |
| `insufficient_scope` | 403 | **Do not refresh.** A new token with the same grant has the same scopes. Either request incremental authorization for the named scopes, or surface a permission error. |

The 401-versus-403 split is the whole payoff. `invalid_token` means *the credential is
broken* — a fresh one may work. `insufficient_scope` means *the credential is fine and
insufficient* — a fresh one from the same grant will be equally insufficient. A client that
refreshes on 403 will loop.

## The fourth case: no credentials at all

§3.1's last paragraph is the one people skip:

> *"If the request lacks any authentication information (e.g., the client was unaware that
> authentication is necessary or attempted using an unsupported authentication method), the
> resource server SHOULD NOT include an error code or other error information."*

So an unauthenticated request gets a bare challenge:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="example"
```

while an authenticated request with a dead token gets a challenge with a reason:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="example",
                  error="invalid_token",
                  error_description="The access token expired"
```

Both examples are RFC 6750 §3's own. The distinction matters because "no token" and "bad
token" call for different client behaviour: the first means "authenticate the user", the
second means "you have a session, refresh it".

## Where the implementation lives

Building the challenge, reading it on the client side, and the parallel `DPoP` challenge are
[05b · Implementing and consuming the challenge](05b-implementing-and-consuming-the-challenge.md).

## Gotchas

**★ 401 means "the credential is broken"; 403 means "the credential is fine and
insufficient". Refreshing on 403 is an infinite loop waiting to happen.**
`insufficient_scope` is a 403 precisely so the client does not treat it as a credential
problem. The grant that produced the token does not include the scope, so a new token from
the same grant will not either.

**★ A bare 401 with no `WWW-Authenticate` header is non-conformant and blinds your clients.**
§3 makes the header a `MUST` for the missing-or-insufficient-token cases. Hand-rolled
`@ControllerAdvice` handlers that return `ResponseEntity.status(401).build()` are the usual
culprit — they bypass the entry point entirely.

**★ A 401 with `error="invalid_token"` from a resource server does not tell you *why*.**
The definition covers *"expired, revoked, malformed, or invalid for other reasons"* — that
includes an `aud` mismatch, an unresolvable `kid`, clock skew and a wrong issuer. When
refreshing does not fix it, the diagnosis is on the resource-server side, not the client's,
and `error_description` is your only hint.

**★ `error_description` is *"not meant to be displayed to end-users"*, and §3 says so.**
It leaks internal detail and is not translated. Log it; do not render it.

**★ Emitting the `scope` parameter costs nothing and enables a recovery path.**
Most resource servers omit it, so most clients cannot do incremental authorization. If your
API knows which scope the caller was missing, put it in the challenge — it is the only
machine-readable way to say so.

**★ Values in the challenge are restricted to specific character sets.**
§3: `error` and `error_description` *"MUST NOT include characters outside the set %x20-21 /
%x23-5B / %x5D-7E"* — printable ASCII without `"` or `\`. If you build a custom
`AuthenticationEntryPoint` and interpolate an exception message into `error_description`, an
embedded quote produces a malformed header that clients cannot parse.

## Interview questions

**★ Your API returns 403 for a request whose token lacks the required scope. Your client
refreshes the token and retries. What happens?**
It gets another 403, refreshes again, and loops until something breaks — usually the
authorization server's rate limiter. `insufficient_scope` is a 403 rather than a 401
specifically to signal that the credential is not the problem: RFC 6750 §3.1 defines it as
*"The request requires higher privileges than provided by the access token"*. The scope came
from the grant, so a new token minted from the same grant carries the same scopes. The correct
handling is either an incremental authorization request for the scopes named in the
challenge's `scope` parameter, or a permission-denied message to the user.

**★ Distinguish the three RFC 6750 error codes and give the status for each.**
`invalid_request` (400) — the request is malformed, missing a parameter, or uses more than one
method to carry the token; the client must fix the request. `invalid_token` (401) — the token
is *"expired, revoked, malformed, or invalid for other reasons"*, and the RFC explicitly says
*"The client MAY request a new access token and retry"*. `insufficient_scope` (403) — the
token is valid but does not carry the required privileges, and the server *"MAY include the
`scope` attribute with the scope necessary"*.

**★ Why does an unauthenticated request get a challenge with no error code?**
RFC 6750 §3.1: *"If the request lacks any authentication information […] the resource server
SHOULD NOT include an error code or other error information."* There is nothing to report a
failure about — no credential was presented and none failed — and emitting an error would
imply one did. It also avoids leaking anything to an unauthenticated prober. Practically it
lets a client distinguish "I have no session, start login" from "I have a session, refresh
it", which are different user experiences.

---

← [The form and query transports](04c-the-form-and-query-transports.md) · [Topic index](README.md) · Next → [Implementing the challenge](05b-implementing-and-consuming-the-challenge.md)
