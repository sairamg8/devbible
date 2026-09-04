---
title: "Access, refresh and ID are not three flavours of the same thing — they are three different protocol roles with three different audiences, three different lifetimes and three different places they are legally allowed to appear"
sidebar_label: "01 · Three tokens, three roles"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.4 (Access Token), §1.5 (Refresh Token), §5.1
> (Successful Response) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt));
> RFC 6750 §1.2 (Terminology) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt));
> OpenID Connect Core 1.0 §2 (ID Token) and §3.1.3.3 (Successful Token Response)
> ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html));
> RFC 9068 §6 (Privacy Considerations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9068.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Almost every OAuth2 bug that reaches production is a token in the wrong place. A refresh
token that a resource server can see. An ID token used as an API credential. An access
token that a client parses. None of these are "wrong" because a library rejected them —
they are wrong because each token is defined by *who it is for*, and moving it changes what
an attacker who steals it can do. This chunk fixes the three roles in your head before any
of the mechanics arrive, because every later argument in this topic is a consequence of
them.**

## Three questions, three tokens

A token in OAuth2/OIDC is not a data structure. It is an answer to a question, and the
three tokens answer three different questions:

| Token | Answers | Issued to | Presented to | Understood by |
|---|---|---|---|---|
| **Access token** | *"May this request touch this resource?"* | the client | the **resource server** | the AS and the RS — **not the client** |
| **Refresh token** | *"May this client get another access token without the user?"* | the client | the **authorization server, only** | the AS only |
| **ID token** | *"Did this user authenticate, when, and who are they?"* | the client | **nobody — the client consumes it** | the client (as relying party) |

Read the last column again. It is the whole topic. The audience of a token is not a
suggestion; it determines the token's format guarantee, its lifetime, its storage rules and
what happens when it leaks.

## The specification's own definitions

RFC 6749 §1.4 defines the access token:

> *"Access tokens are credentials used to access protected resources. An access token is a
> string representing an authorization issued to the client. The string is usually opaque
> to the client."*

RFC 6749 §1.5 defines the refresh token, and the second sentence is the one people forget:

> *"Refresh tokens are credentials used to obtain access tokens. […] Unlike access tokens,
> refresh tokens are intended for use only with authorization servers and are never sent
> to resource servers."*

OpenID Connect Core 1.0 §2 defines the ID token:

> *"The ID Token is a security token that contains Claims about the Authentication of an
> End-User by an Authorization Server when using a Client, and potentially other requested
> Claims. The ID Token is represented as a JSON Web Token (JWT)."*

Three sentences, three different jobs. Note what §2 says that §1.4 does not: the ID token
**is** a JWT, by definition. The access token is a *string*, and the spec only says it is
"usually opaque". That asymmetry is the single most valuable idea in this topic and gets
its own chunk: [02 · The access token is opaque by contract](02-the-access-token-is-opaque-by-contract.md).

## Where each one legally appears

Draw the four parties and the arrows are almost the whole protocol:

```
                      +---------------------+
  user's browser ---->|  Authorization      |
                      |  Server (AS)        |
   client ----------->|                     |
     |  token request |  token endpoint     |
     |  refresh grant |  revocation (7009)  |
     |  revocation    |  introspection(7662)|
     |                +---------------------+
     |                          ^
     |  Authorization: Bearer   |  introspection call (opaque tokens only)
     v                          |
  +---------------------+       |
  |  Resource Server    |-------+
  |  (your API)         |
  +---------------------+
```

- **Access token**: client → resource server, in the `Authorization: Bearer` header. Also
  client → AS when the client calls a userinfo endpoint. Never in a log, never in a URL.
- **Refresh token**: client → **AS token endpoint only**. It appears in exactly two
  requests in the whole system: the refresh grant (RFC 6749 §6) and revocation (RFC 7009).
  An arrow from the client to the resource server carrying a refresh token is a design bug,
  not a configuration issue.
- **ID token**: AS → client, and then it **stops**. The client validates it, reads `sub`,
  establishes its own session or its own notion of "who is logged in", and does not forward
  it anywhere. There is no protocol arrow that carries an ID token to an API.

## The three lifetimes, and why they differ

| Token | Typical order of magnitude | Why |
|---|---|---|
| Access token | minutes to one hour | It is presented to many parties on every request; a leak is exploitable until expiry, and it usually cannot be revoked in time. |
| Refresh token | hours to months | It is presented to exactly one party over TLS, is bound to the client, and can be rotated and revoked at the point of use. |
| ID token | minutes | It is consumed once, immediately, by the client that requested it. It is a receipt for an authentication event, not a session. |

RFC 6750 §5.3 makes the access-token side of this a recommendation with a number in it:

> *"Issue short-lived bearer tokens: Token servers SHOULD issue short-lived (one hour or
> less) bearer tokens, particularly when issuing tokens to clients that run within a web
> browser or other environments where information leakage may occur."*

The full argument — including the arithmetic of what a lifetime actually buys you — is in
[07 · Access-token lifetime as a design decision](07-access-token-lifetime-as-a-design-decision.md).

OIDC Core §2 adds a warning about the ID token's `exp` that people routinely miss:

> *"NOTE: The ID Token expiration time is unrelated the lifetime of the authenticated
> session between the RP and the OP."*

An ID token expiring in five minutes does not mean the user is logged out in five minutes.
It means the *proof of the login event* is only fresh for five minutes.

## What arrives in a single token response

All three can be in one HTTP response. This is the shape defined by RFC 6749 §5.1 plus
OIDC Core §3.1.3.3 — **illustrative structure, not a real token**:

```json
{
  "access_token": "<opaque-or-jwt-access-token>",
  "token_type": "Bearer",
  "expires_in": 300,
  "refresh_token": "<opaque-refresh-token>",
  "scope": "orders:read orders:write",
  "id_token": "<header>.<payload>.<base64url-signature>"
}
```

The client's job on receiving that object is three different jobs:

1. `access_token` — store it, attach it to outbound API calls, **do not open it**.
2. `refresh_token` — store it in the most protected place the client type has, use it only
   against the token endpoint.
3. `id_token` — validate it (signature, `iss`, `aud`, `exp`, `nonce`), read `sub`, then
   **throw it away**. It is not a credential for anything downstream.

Field-by-field treatment of that response is [03 · The token response](03-the-token-response.md).

## The three failure modes this topic exists to prevent

Each of the three roles has one dominant way teams get it wrong, and each gets a chunk:

1. **The client parses the access token** and builds UI or logic on its claims — then the
   AS changes format and the client breaks with no recourse. RFC 9068 §6 states the rule as
   a `MUST NOT`. See [02](02-the-access-token-is-opaque-by-contract.md) and
   [02b](02b-what-parsing-an-access-token-costs-you.md).
2. **A refresh token reaches the resource server** — usually because someone made the API
   "handle refresh for the mobile app". Now a read-only service holds a credential that
   mints full-scope access. See [08b](08b-why-a-resource-server-must-never-see-one.md).
3. **The ID token is sent to the API as the access token** — because it is a JWT, it has a
   `sub`, and it validates. It is the most seductive of the three because it *works*. See
   **17b** *(not written yet)*.

## What this topic does not cover

- **The wire format of a JWT** — header, payload, signature, `alg`, JWKS, `kid` rotation,
  `alg: none`, HS/RS confusion. That is [06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md). This topic stops at "the AS may choose JWT" and hands off.
- **OIDC semantics** — `nonce`, discovery, UserInfo, standard scopes and claims, `sub` is
  not an email. That is **07 · OpenID Connect** *(not written yet)*. This topic covers the
  ID token only as a *role*.
- **The BFF pattern in depth** and the session-versus-token argument — that is
  **13 · Sessions vs tokens, honestly** *(not written yet)*.
- **Wiring a resource server** — `issuer-uri`, authorities mapping, multi-tenancy — is
  [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md).

## Gotchas

**★ "Token" on its own is not a word you can use in a design discussion.**
If someone says "we put the token in a cookie", the first question is *which* token. The
answer changes the threat model completely: an access token in a cookie is a bounded,
short-lived exposure; a refresh token in a cookie readable by JavaScript is long-term
account takeover. Insist on the noun.

**★ The three tokens are not distinguished by format.**
An access token can be a JWT. An ID token is always a JWT. Both can have `sub`, `iss`,
`aud`, `exp`. A resource server that accepts "a valid JWT from our issuer" accepts both,
and that is exactly the anti-pattern in
**17b** *(not written yet)*. Role is carried by `aud` and by
`typ`, not by shape.

**★ `expires_in` describes the access token only.**
It is a property of `access_token`, not of the response. Nothing in RFC 6749 §5.1 tells the
client how long the refresh token lives — the client discovers refresh-token expiry the
hard way, by getting `invalid_grant`. Any client that assumes "refresh token lives as long
as the session" is guessing.

**★ There is no `refresh_token_expires_in` in RFC 6749 §5.1.**
Several vendors emit one. It is a vendor extension, not a standard field, and a client that
requires it will not port. Treat it as a hint at best, and always handle `invalid_grant` on
refresh regardless of what it said.

**★ A token response is a secret in its entirety and must not be cached.**
RFC 6749 §5.1: *"The authorization server MUST include the HTTP `Cache-Control` response
header field […] with a value of `no-store` in any response containing tokens, credentials,
or other sensitive information, as well as the `Pragma` response header field […] with a
value of `no-cache`."* If a CDN or a reverse proxy in front of the AS strips or overrides
those, you have built a token-sharing service.

**★ "The API validates the ID token" is a sentence that should stop a code review.**
An API has no business seeing an ID token at all. If it is validating one, either the ID
token is being used as an access token, or the API is doing the client's job. Both are
findings.

## Interview questions

**★ Name the three tokens and say, for each, who issues it, who receives it and who is
allowed to read its contents.**
The access token is issued by the authorization server to the client, presented by the
client to the resource server, and read by the AS and RS — never by the client, which by
RFC 6749 §1.4 must treat it as opaque. The refresh token is issued by the AS to the client,
presented only back to the AS's token endpoint, and read only by the AS; RFC 6749 §1.5 says
refresh tokens *"are intended for use only with authorization servers and are never sent to
resource servers"*. The ID token is issued by the AS to the client, consumed by the client,
and read by the client — it is proof of an authentication event and is never forwarded to
an API.

**★ Why do access tokens have short lifetimes and refresh tokens long ones, when the
refresh token is strictly more powerful?**
Because exposure surface, not power, drives lifetime. The access token is presented on
every API call, to potentially many resource servers, and lands in proxies, logs, traces
and client memory; it is a bearer credential that anyone in possession can replay, and in a
JWT deployment it usually cannot be revoked before it expires — so its lifetime *is* its
blast radius. The refresh token is presented to exactly one endpoint, over TLS, with client
authentication where the client is confidential, and the AS can rotate it, detect reuse and
revoke it at the moment it is used. Concentrating the power in the token you can supervise
and shortening the one you cannot is the entire trade.

**★ A colleague says "we'll just use the ID token as the API credential — it's a JWT, it's
signed, it has the user's identity." What is wrong with that?**
Four things. Its `aud` is the client, not the API, so an API that accepts it is either
skipping audience validation or has been misconfigured to accept the client id as its own
audience — in both cases it will now accept ID tokens minted for *other* clients of the
same issuer. It carries no `scope`, so there is no delegated authorization to enforce and
every call runs with the user's full identity. It cannot be refreshed with the refresh
grant in the way an access token can, so client code ends up re-running the login flow or
caching the ID token past its purpose. And it defeats the whole point of OAuth2, which is
that the API grants access to a *delegated* subset, not to "whoever this human is". The
full treatment is in **17b** *(not written yet)*.

**★ Where, precisely, may a refresh token appear in a correctly built system?**
In exactly two requests: the refresh grant to the AS token endpoint (RFC 6749 §6) and a
revocation request to the AS revocation endpoint (RFC 7009 §2.1). Everywhere else it is at
rest in the client's storage. It never appears in a request to a resource server, never in
a URL, never in an `Authorization` header to an API, never in a log line, and never in a
service-to-service call between your own microservices.

**★ Your architect proposes that the gateway extract the user's email from the access token
and put it in a header for downstream services. What do you say?**
Two separate objections. First, the gateway is acting as a resource server there, not a
client, so reading the token is legitimate for it — but only if the token is a JWT it
validated, and that couples the gateway to the AS's format choice, which the AS is free to
change. Second, and more seriously, `sub` is the stable identifier and email is not: emails
are reassignable and mutable, and OIDC Core is explicit that email-shaped claims must not
be used as unique identifiers. Propagating identity between your own services is
**12 · Token relay across microservices** *(not written yet)*; the stable-identifier
argument is **07 · OpenID Connect** *(not written yet)*.

---

← [Topic index](README.md) · Next → [Opaque by contract](02-the-access-token-is-opaque-by-contract.md)
