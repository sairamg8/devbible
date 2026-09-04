---
title: "The token endpoint's six error codes each name a different party as the one at fault, and reading them correctly is the difference between fixing a client registration and paging the identity team at 3am"
sidebar_label: "03b · The token error response"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §5.2 (Error Response), §3.2.1 (Client
> Authentication), §6 (Refreshing an Access Token)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7009 §2.2.1 (Error
> Response) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7009.txt));
> RFC 9449 §5 (DPoP Access Token Request)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9449.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**A token endpoint failure is not a generic "auth broke". RFC 6749 §5.2 defines six error
codes, and each of them points at a specific, different thing: your client registration,
your client secret, the grant you presented, the grant *type*, or the scopes you asked for.
Learning to read them turns a class of incident from "something is wrong with SSO" into a
one-line diagnosis. And exactly one of them — `invalid_grant` — is the one that will wake
you up, because it is the code an authorization server returns for a refresh token that has
expired, been revoked, or been rotated out from under you.**

## The response shape

§5.2 opens with the status code rule, and the parenthesis matters:

> *"The authorization server responds with an HTTP 400 (Bad Request) status code (unless
> specified otherwise) and includes the following parameters with the response"*

Body is JSON at the top level, same serialisation rules as §5.1. Three parameters:

- **`error`** — REQUIRED, *"A single ASCII error code from the following"*, with a character
  restriction: *"Values for the `error` parameter MUST NOT include characters outside the set
  %x20-21 / %x23-5B / %x5D-7E."* (That set is printable ASCII minus `"` and `\`, because the
  value also has to be safe inside a `WWW-Authenticate` quoted string.)
- **`error_description`** — OPTIONAL, *"Human-readable ASCII text providing additional
  information, used to assist the client developer in understanding the error that
  occurred."* Note: *the client developer*. It is not a message to show an end user, and it
  is not a stable machine-readable field.
- **`error_uri`** — OPTIONAL, *"A URI identifying a human-readable web page with information
  about the error."*

Illustrative shape, per §5.2's own example:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json;charset=UTF-8
Cache-Control: no-store
Pragma: no-cache

{
  "error": "invalid_request"
}
```

## The six codes, verbatim, and who is at fault

| Code | RFC 6749 §5.2 definition | Whose bug it usually is |
|---|---|---|
| `invalid_request` | *"The request is missing a required parameter, includes an unsupported parameter value (other than grant type), repeats a parameter, includes multiple credentials, utilizes more than one mechanism for authenticating the client, or is otherwise malformed."* | the client's request construction |
| `invalid_client` | *"Client authentication failed (e.g., unknown client, no client authentication included, or unsupported authentication method)."* | the client's credentials or registration |
| `invalid_grant` | *"The provided authorization grant (e.g., authorization code, resource owner credentials) or refresh token is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client."* | **the state of the grant — often nobody's bug** |
| `unauthorized_client` | *"The authenticated client is not authorized to use this authorization grant type."* | AS-side client configuration |
| `unsupported_grant_type` | *"The authorization grant type is not supported by the authorization server."* | the client asked for a grant this AS does not implement |
| `invalid_scope` | *"The requested scope is invalid, unknown, malformed, or exceeds the scope granted by the resource owner."* | the client's scope string, or a scope not registered on the AS |

Notice how narrowly each is drawn. `unauthorized_client` and `unsupported_grant_type` are
easy to confuse and mean different things: the first is *"this client may not use this grant
type"*, the second is *"this server does not implement this grant type at all"*. If you get
`unauthorized_client` for `client_credentials`, the grant is enabled on the server and
disabled on your client registration — a checkbox, not a deployment.

## `invalid_client` is the one that is not a 400

§5.2 carves out a status-code exception for it, and the second half of the carve-out is a
`MUST`:

> *"The authorization server MAY return an HTTP 401 (Unauthorized) status code to indicate
> which HTTP authentication schemes are supported. If the client attempted to authenticate
> via the `Authorization` request header field, the authorization server MUST respond with an
> HTTP 401 (Unauthorized) status code and include the `WWW-Authenticate` response header
> field matching the authentication scheme used by the client."*

So: `client_secret_basic` (credentials in the `Authorization` header) → **401 with a
`WWW-Authenticate`**. `client_secret_post` (credentials in the form body) → the AS *may*
still use 401, or may use 400. A client that only handles 400 from the token endpoint will
misclassify a bad client secret as a transport failure and retry it, which is how a wrong
secret becomes a lockout.

## `invalid_grant` is the one that matters operationally

Read its definition again and count the distinct situations it covers:

1. the authorization code is invalid,
2. the authorization code has expired,
3. the code has already been used (replay),
4. the `redirect_uri` does not match the one from the authorization request,
5. the code or refresh token was issued to a **different client**,
6. **the refresh token has expired**,
7. **the refresh token has been revoked**,
8. **the refresh token was rotated and this is the old one**.

Eight distinct causes, one code, and the AS is not obliged to distinguish them —
`error_description` may or may not help and is not machine-readable. Cases 6–8 are not bugs:
they are the normal end of a session and the normal outcome of rotation. A client that
treats `invalid_grant` on the refresh grant as an error to retry will hammer the token
endpoint; a client that treats it as fatal-and-silent will strand the user on a broken page.

The correct client behaviour on `invalid_grant` from a refresh request is a single rule:
**discard the tokens and start a fresh authorization code flow.** Nothing else. Do not
retry, do not back off and retry, do not try the same refresh token again.

```java
// Sketch of the only correct branch. Real wiring is Spring's
// OAuth2AuthorizedClientManager; see 09 · Spring as OAuth2 client.
try {
    tokens = tokenClient.refresh(currentRefreshToken);
} catch (OAuth2AuthorizationException ex) {
    if ("invalid_grant".equals(ex.getError().getErrorCode())) {
        tokenStore.remove(principal);          // the grant is gone; do not retry it
        throw new ReauthenticationRequiredException(ex);
    }
    throw ex;                                   // transport / 5xx / other codes: retryable
}
```

The distinction the code above draws is the important one: `invalid_grant` is **terminal**;
a 503 or a connection reset is **retryable**. Collapsing the two is the most common
client-side defect in this area, and it is what turns a rotation race
(**11 · The rotation race** *(not written yet)*) into a thundering herd.

## Codes defined by extensions

The list in §5.2 is not closed; extensions register more, and you will meet these at the
token endpoint:

- **`unsupported_token_type`** — RFC 7009 §2.2.1, at the *revocation* endpoint:
  *"The authorization server does not support the revocation of the presented token type.
  That is, the client tried to revoke an access token on a server not supporting this
  feature."*
- **`invalid_dpop_proof`** — RFC 9449 §5, when the DPoP proof accompanying a token request
  fails validation. RFC 9449 §5 says the AS *"responds with an error response per Section 5.2
  of [RFC6749] with `invalid_dpop_proof`"*, which is the pattern: extensions add codes into
  §5.2's frame rather than inventing a new error format.
- **`use_dpop_nonce`** — RFC 9449, signalling that the AS requires a nonce in the next proof.
  Unlike the others this one is *recoverable*: the client retries with the supplied nonce.

## What a 503 means and does not mean

RFC 7009 §2.2.1 says it explicitly for the revocation endpoint, and the reasoning generalises:

> *"If the server responds with HTTP status code 503, the client must assume the token still
> exists and may retry after a reasonable delay. The server may include a `Retry-After`
> header in the response to indicate how long the service is expected to be unavailable to
> the requesting client."*

A 503 is not a token error. It carries no information about the token's state. Treat it as
transport, honour `Retry-After`, and — importantly — **do not discard the token**, because a
client that clears its refresh token on a transient AS outage logs out every user
simultaneously when the AS comes back.

## Gotchas

**★ `invalid_grant` on a refresh is usually not an error and must never be retried.**
It covers an expired refresh token, a revoked one, and a rotated-out one — all normal
lifecycle events. The only correct response is to drop the stored tokens and re-run the
authorization code flow. Retrying with the same refresh token, in a rotation deployment,
looks exactly like an attacker replaying a stolen token and can trigger reuse detection.

**★ A bad client secret can come back as 401, not 400.**
§5.2 requires 401 when the client authenticated via the `Authorization` header. Client code
that only parses a JSON error body on 400 will see a 401 with a `WWW-Authenticate` header,
fail to parse, and report a generic failure. Handle both statuses at the token endpoint.

**★ `error_description` is for the client *developer* and is not a contract.**
The RFC calls it *"Human-readable ASCII text […] used to assist the client developer"*.
Branching on its content couples you to a vendor's wording, which changes between releases.
Branch on `error`; log `error_description`.

**★ Never surface `error_description` to an end user.**
It routinely contains internal detail — client ids, realm names, sometimes the reason a
grant was rejected. It is a developer aid at a machine boundary, not a UI string.

**★ `unauthorized_client` and `unsupported_grant_type` are not synonyms.**
`unauthorized_client` = the server supports this grant, this client is not permitted to use
it (fix the client registration). `unsupported_grant_type` = the server does not implement
it at all (fix the design, or the AS deployment). Misdiagnosing one as the other sends you
to the wrong team.

**★ Do not log the request body of a failed token request.**
The natural debugging reflex — log the whole request on error — writes the client secret,
the authorization code or the refresh token into your logs. Log the grant type, the client
id, the status and the `error` code. Nothing else.

**★ The error body is still subject to the cache headers.**
§5.2's own example carries `Cache-Control: no-store` and `Pragma: no-cache`, because the
request that produced it contained credentials and a cached error can leak request context.

**★ A conformant AS deliberately does not tell you *which* of the eight `invalid_grant`
causes applied.**
Distinguishing "code already used" from "code expired" is an oracle for an attacker probing
codes. Do not build client logic that assumes a specific cause, and do not file a bug asking
the identity team to be more specific.

## Interview questions

**★ Your service starts logging `invalid_grant` from the token endpoint on the refresh
grant, at a low but steady rate. Is this an incident?**
Probably not, and the rate is the diagnostic. `invalid_grant` on a refresh covers an expired
refresh token, a revoked one (user logged out or changed their password — RFC 9700 §4.14.2
lists both as events after which an AS *"MAY revoke refresh tokens automatically"*), and a
rotated-out one. A low steady rate is the normal tail of sessions ending. It becomes an
incident when it spikes, when it correlates with a deploy, or when the same principal
produces it repeatedly — the last of which means your client is retrying a dead grant instead
of re-authenticating, or you have a rotation race.

**★ What is the difference between `invalid_client` and `unauthorized_client`?**
`invalid_client` is an authentication failure: the AS could not establish *who* the client
is — unknown client id, wrong secret, missing or unsupported client authentication method.
`unauthorized_client` is an authorization failure: the client authenticated successfully, and
is not permitted to use the grant type it asked for. The first is a credentials or
registration problem; the second is a permissions checkbox on the client registration.
`invalid_client` is also the one that may legitimately arrive as a 401 rather than a 400.

**★ Why must a client never retry a refresh request that returned `invalid_grant`?**
Because the grant is gone and no amount of retrying brings it back — the definition covers
invalid, expired, revoked, and issued-to-another-client. Worse, in a deployment using
refresh token rotation, presenting an already-invalidated refresh token is exactly the signal
the AS uses to detect replay: RFC 9700 §4.14.2 describes rotation as working because *"If a
refresh token is compromised and subsequently used by both the attacker and the legitimate
client, one of them will present an invalidated refresh token, which will inform the
authorization server of the breach"*, after which it *"will revoke the active refresh
token"*. Your retry loop can therefore destroy a perfectly good session that a concurrent
request had just refreshed.

**★ How should a client distinguish a terminal token-endpoint failure from a retryable one?**
By the error code, not the status. `invalid_grant`, `invalid_client`, `invalid_scope`,
`unauthorized_client` and `unsupported_grant_type` are terminal — retrying an identical
request produces an identical answer, and in the case of `invalid_grant` the retry is
actively harmful. Transport failures, 5xx responses and 503 with `Retry-After` are
retryable, and RFC 7009 §2.2.1 states the rule for 503 explicitly: the client *"must assume
the token still exists and may retry after a reasonable delay"* — so a 503 must not cause the
client to discard tokens, or an AS outage logs everyone out at once.

**★ An engineer proposes parsing `error_description` to tell "expired code" from "already
used code" for better telemetry. What do you say?**
Two objections. `error_description` is defined as human-readable text for the client
developer, not a machine-readable field; its wording is vendor-specific and changes between
releases, so the telemetry will silently stop working. And the distinction is one a
conformant AS deliberately withholds, because telling a caller *why* a code was rejected is
an oracle for someone probing codes. If you need that telemetry, it belongs on the AS side
where the truth lives, not inferred from a string on the client.

---

← [The token response](03-the-token-response.md) · [Topic index](README.md) · Next → [Bearer tokens](04-bearer-tokens-and-the-authorization-header.md)
