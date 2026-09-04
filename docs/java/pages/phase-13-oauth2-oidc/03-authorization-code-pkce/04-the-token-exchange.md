---
title: "The token exchange is the only authenticated hop in the flow and the only place the authorization server can enforce anything, so it performs five independent checks in one request and reports every failure with the same error code"
sidebar_label: "04 · The token exchange"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1.3 (Access Token Request), §4.1.4 (Access Token
> Response), §5.1 (Successful Response), §5.2 (Error Response), §3.2 (Token Endpoint), §3.2.1
> (Client Authentication) ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt));
> RFC 7636 §4.5 (Client Sends the Authorization Code and the Code Verifier to the Token
> Endpoint), §4.6 (Server Verifies code_verifier before Returning the Tokens)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Everything before this point was the browser carrying opaque strings around. The token
request is your server talking directly to the authorization server over TLS, presenting
client credentials, and asking a question whose answer is a bearer credential. It is a
`POST` with an `application/x-www-form-urlencoded` body, it is not cacheable, it is not
idempotent, and its failure mode is deliberately uninformative — because a token endpoint
that explained *which* check failed would be a very useful oracle for an attacker.**

## The request

RFC 6749 §4.1.3 with RFC 7636 §4.5's addition. `POST`, form-encoded body, UTF-8:

| Parameter | Status | RFC's definition |
|---|---|---|
| `grant_type` | REQUIRED | *"Value MUST be set to `authorization_code`."* |
| `code` | REQUIRED | *"The authorization code received from the authorization server."* |
| `redirect_uri` | REQUIRED, conditionally | *"if the `redirect_uri` parameter was included in the authorization request as described in Section 4.1.1, and their values MUST be identical."* |
| `client_id` | REQUIRED, conditionally | *"if the client is not authenticating with the authorization server as described in Section 3.2.1."* |
| `code_verifier` | REQUIRED (RFC 7636 §4.5) | *"Code verifier."* |

Illustrative structure — the parameter shapes are from the RFCs, the values are placeholders
except `SplxlOBeZQQYbYS6WxSbIA`, which is RFC 6749's own example code, and
`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`, which is RFC 7636 Appendix B's example
verifier:

```http
POST /token HTTP/1.1
Host: server.example.com
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=SplxlOBeZQQYbYS6WxSbIA
&redirect_uri=https%3A%2F%2Fclient.example.com%2Flogin%2Foauth2%2Fcode%2Fexample
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Three points about the transport that people get wrong:

- **`POST` only.** RFC 6749 §3.2: *"The client MUST use the HTTP `POST` method when making
  access token requests."* A `GET` to the token endpoint puts the code and possibly the
  client secret in a URL — the exact thing the flow spent three redirects avoiding.
- **Form-encoded, not JSON.** The request is
  `application/x-www-form-urlencoded`; the *response* is JSON. That asymmetry is unusual
  enough that a client hand-rolled with a JSON-by-default HTTP library will get
  `invalid_request` from every conforming server.
- **`client_id` in the body is for clients that are *not* authenticating.** If you send an
  `Authorization: Basic` header, `client_id` in the body is redundant; §5.2 lists *"utilizes
  more than one mechanism for authenticating the client"* as `invalid_request`, so some
  servers reject the combination. Public clients must send it in the body, because they have
  nothing else.

## The five checks the server performs

RFC 6749 §4.1.3, with §4.6 of RFC 7636 as the fifth. The server:

> *"authenticates the client if client authentication is included, ensures that the
> authorization code was issued to the authenticated confidential client, or if the client is
> public, ensures that the code was issued to `client_id` in the request, verifies that the
> authorization code is valid, and ensures that the `redirect_uri` parameter is present if the
> `redirect_uri` parameter was included in the initial authorization request as described in
> Section 4.1.1, and if included ensure that their values are identical."*

1. **Client authentication.** Wrong or missing credentials → `invalid_client`, and per §5.2 an
   HTTP 401 if the client attempted to authenticate via the `Authorization` header.
2. **Code belongs to this client.** For a confidential client, the *authenticated* identity;
   for a public client, the asserted `client_id`. Mismatch → `invalid_grant`.
3. **Code is valid** — exists, not expired, not already used. → `invalid_grant`.
4. **`redirect_uri` present-if-it-was-present, and identical.** → `invalid_grant`.
5. **PKCE.** RFC 7636 §4.6: the server calculates the challenge from the received
   `code_verifier` and compares it to the stored `code_challenge`; *"If the values are equal,
   the token endpoint MUST continue processing as normal. If the values are not equal, an
   error response indicating `invalid_grant` MUST be returned."*

Four of the five report `invalid_grant`. That is intentional and it is the reason
**20 · Reading the errors** *(not written yet)* is a chunk of its own: the error code
does not tell you which check failed, and the `error_description` — if the server sends one
— is not standardised.

## The response

RFC 6749 §4.1.4 defers to §5.1. The RFC's own example, verbatim, including its deliberately
fake `token_type`:

```http
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8
Cache-Control: no-store
Pragma: no-cache

{
  "access_token":"2YotnFZFEjr1zCsicMWpAA",
  "token_type":"example",
  "expires_in":3600,
  "refresh_token":"tGzv3JOkF0XG5Qx2TlKWIA",
  "example_parameter":"example_value"
}
```

| Field | Status | Notes |
|---|---|---|
| `access_token` | REQUIRED | Opaque to the client. Its format is the AS's business. |
| `token_type` | REQUIRED | In practice always `Bearer` (RFC 6750). Case-insensitive. |
| `expires_in` | RECOMMENDED | Seconds. *Not* an absolute time, and *not* guaranteed present. |
| `refresh_token` | OPTIONAL | May be absent even if you expected one. |
| `scope` | conditional | REQUIRED if the granted scope differs from the requested scope (§3.3). |
| `id_token` | OIDC | Present when `openid` was in the scope. Owned by topic 07. |

`Cache-Control: no-store` in the RFC's example is normative in §5.1: *"The authorization
server MUST include the HTTP `Cache-Control` response header field [RFC2616] with a value of
`no-store` in any response containing tokens, credentials, or other sensitive information, as
well as the `Pragma` response header field [RFC2616] with a value of `no-cache`."* If you put
an HTTP cache in front of a token endpoint, you have built a token-sharing service.

What the tokens *are*, how long they should live and how refresh works belongs to [05 · The three tokens](../05-the-three-tokens/README.md). What the `id_token` contains belongs to **07 · OpenID
Connect** *(not written yet)*.

## What the client must do with the response

- **Treat `access_token` as an opaque string.** Do not parse it. It may be a JWT; that is an
  authorization-server implementation choice, not a protocol guarantee, and a client that
  depends on it breaks when the AS switches to reference tokens.
- **Read `scope`.** §3.3 permits a narrower grant than requested and only requires the server
  to report it.
- **Convert `expires_in` to an absolute instant immediately**, using the clock at the moment
  the response was read, and subtract a safety margin. `expires_in` is relative to when the
  server issued it, so network latency and any queuing on your side is already eaten out of
  it.
- **Not log the body.** The `access_token` and `refresh_token` are credentials.

## Gotchas

**★ The request body is form-encoded and the response body is JSON.**
Every hand-rolled client gets this backwards at least once. With `RestClient`, that means
`.contentType(MediaType.APPLICATION_FORM_URLENCODED)` and a `MultiValueMap` body, with a JSON
message converter for the response. Spring Security's
`RestClientAuthorizationCodeTokenResponseClient` already does both.

**★ `expires_in` is optional and some servers omit it.**
§5.1 marks it RECOMMENDED, and adds that if it is omitted *"the authorization server SHOULD
provide the expiration time via other means or document the default value"*. A client that
does `response.expiresIn()` and NPEs, or that treats a missing value as "never expires", has
two different bugs waiting on the same provider change.

**★ Sending both an `Authorization: Basic` header and `client_id`/`client_secret` in the body
is an error, not belt-and-braces.**
§5.2's `invalid_request` covers a request that *"includes multiple credentials, utilizes more
than one mechanism for authenticating the client"*. Pick one mechanism, matching the client's
registered `clientAuthenticationMethod`.

**★ A retry on the token endpoint is not safe.**
It is not idempotent — the code is consumed. See
[03 · The authorization code](03-the-authorization-code.md). Configure your HTTP client so
this specific call does not retry, including at the connection-failure level, because a
connection reset after the server processed the request is indistinguishable from one before.

**★ `invalid_client` comes back as 401 with a `WWW-Authenticate` header when you used the
`Authorization` header.**
§5.2: *"If the client attempted to authenticate via the `Authorization` request header field,
the authorization server MUST respond with an HTTP 401 (Unauthorized) status code and include
the `WWW-Authenticate` response header field."* An HTTP client with a generic 401 interceptor
that tries to "re-authenticate" will loop.

**★ A 200 response with an error body is a non-conforming server, and they exist.**
§5.2 requires HTTP 400 for errors. Some providers return 200 with `{"error": "..."}`. A client
that keys only on the status code will treat the failure as a success and then fail later with
a null access token. Check for the presence of `error` regardless of status.

**★ `token_type` is case-insensitive and is not always literally `Bearer`.**
RFC 6749 §7.1 says the client *"MUST NOT use an access token if it does not understand the
token type"*, and RFC 6750 defines `Bearer` with case-insensitive matching. A client doing
`"Bearer".equals(tokenType)` will reject a provider that sends `bearer`.

**★ Client secrets rotate, and the token endpoint is where that surfaces.**
Nothing else in the flow uses the secret. A rotated or expired secret produces successful
redirects, a successful consent screen, and then `invalid_client` — which reads like a client
*registration* problem rather than a credential problem.

**★ The token endpoint is a back-channel call from your servers, which means egress rules,
proxies and DNS.**
The browser reaching the authorization server proves nothing about whether your pods can. A
flow that works for the developer on a laptop and fails in the cluster with a connect timeout
is usually egress policy, not OAuth.

## Interview questions

**★ Which parameters does the token request carry, and which of them are conditionally
required?**
`grant_type=authorization_code` and `code` are unconditional. `redirect_uri` is required *if
and only if* it was in the authorization request, and RFC 6749 §4.1.3 says *"their values MUST
be identical"*. `client_id` is required only if the client is not authenticating by some other
means — so a confidential client using HTTP Basic omits it, and a public client must include
it. `code_verifier` is required whenever PKCE was used, per RFC 7636 §4.5. The conditionals are
the interesting part: two of the five parameters are present or absent depending on decisions
made earlier in the flow.

**★ The token endpoint returns `invalid_grant`. What are all the things that could mean?**
The code does not exist, has expired, or has already been used; the code was issued to a
different client than the one now authenticating; the `redirect_uri` does not byte-match the
one from the authorization request, or is missing when it should be present; or the
`code_verifier` does not hash to the stored `code_challenge`. RFC 6749 §5.2's own definition
lists most of these: *"The provided authorization grant ... is invalid, expired, revoked, does
not match the redirection URI used in the authorization request, or was issued to another
client."* The single error code across all of them is deliberate — distinguishing them would
give an attacker an oracle.

**★ Why is client authentication only at the token endpoint and not at the authorization
endpoint?**
Because the authorization endpoint is reached by the user's browser, not by the client. There
is no connection between the client's server and the authorization server at that point, so
there is nothing to authenticate — and putting a client secret into a URL a browser fetches
would publish it. The consequence is that the authorization endpoint can only ever
*identify* the client (via the public `client_id`) and not *authenticate* it, which is why the
code is bound to the client and re-checked at redemption.

**★ Your `access_token` looks like a JWT. Can you decode it to get the user's email?**
You can, and you should not. RFC 6749 defines the access token as opaque to the client; the
format is a choice of the authorization server, which may switch to reference tokens or change
its claims without notice, and it is not obliged to tell you. The token that is a JWT *by
specification* and is intended for the client to read is the OIDC ID token. If you need user
attributes, use the ID token or the UserInfo endpoint — topic 07. This is one of the four
facts the phase notes flag as making most online material wrong.

**★ How should a client handle `expires_in`?**
Convert it to an absolute instant at the moment of receipt and refresh before that instant
with a margin, because the value is relative to issuance and everything between issuance and
your reading it has already consumed part of it. Handle its absence: it is only RECOMMENDED,
and a missing value means "consult the provider's documentation", not "never expires". Do not
use it to decide whether a token is valid for a *resource server* call — that decision belongs
to the resource server validating `exp`, and clock skew between the two is a real effect, which
is topic 06's material.

**★ Someone puts a caching proxy in front of the token endpoint to reduce load. What happens?**
In the best case nothing, because RFC 6749 §5.1 requires the response to carry `Cache-Control:
no-store` and `Pragma: no-cache` and a well-behaved cache honours it. In the worst case the
proxy is configured to ignore those headers "for performance" and now two different users'
token requests can collide on a cache key, handing one user another's access token. The
request is also a POST with a single-use credential in the body, so caching it is meaningless
even when it is not dangerous.

---

← [The authorization code](03-the-authorization-code.md) · [Topic index](README.md) · Next → [Client authentication](04b-client-authentication.md)
