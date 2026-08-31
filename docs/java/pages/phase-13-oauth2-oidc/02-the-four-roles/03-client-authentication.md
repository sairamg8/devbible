---
title: "Client authentication is the one place OAuth2 lets you replace a shared secret with something that cannot be stolen from a log, a heap dump or a database, and almost nobody does — because the default works and the alternatives require a key pair"
sidebar_label: "03 · Client authentication"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §2.3 (Client Authentication) and §2.3.1 (Client
> Password); RFC 7523 §2.2 (Using JWTs for Client Authentication) and §3 (JWT Format and
> Processing Requirements); RFC 8705 (*OAuth 2.0 Mutual-TLS Client Authentication and
> Certificate-Bound Access Tokens*); and RFC 9700 §2.2.1 — at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc7523).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**A client secret is a bearer credential for your entire application. It goes over the wire
on every token request, sits in a configuration store, gets copied into a `.env`, appears in
a heap dump, and is one careless `log.debug` from a permanent compromise that nobody
notices. OAuth2 has had better answers since 2015 — a signed assertion proving possession of
a private key that never leaves your process, or a client certificate — and the reason
almost every deployment still uses `client_secret_basic` is that it is the default and it
works. This chunk is about knowing what you are choosing when you accept that default.**

## The methods, and what each actually proves

| Method | Proves | Secret on the wire? | Defined in |
|---|---|---|---|
| `none` | Nothing | — | RFC 6749 §2.3 (public clients) |
| `client_secret_basic` | Knowledge of a shared secret | ✅ every request | RFC 6749 §2.3.1 |
| `client_secret_post` | Same, in the body | ✅ every request | RFC 6749 §2.3.1 (alternative form) |
| `client_secret_jwt` | Knowledge of a shared secret, via HMAC | ⛔ never transmitted | RFC 7523 |
| `private_key_jwt` | **Possession of a private key** | ⛔ never transmitted, and the AS never holds it | RFC 7523 |
| `tls_client_auth` | Possession of a private key, via mTLS with a CA-issued cert | ⛔ | RFC 8705 |
| `self_signed_tls_client_auth` | Same, with a registered self-signed cert | ⛔ | RFC 8705 |

🔴 **The line that matters runs between rows 3 and 4.** Above it, the authorization server
stores something that lets it *impersonate* your client; a breach of the AS's client table is
a breach of every client. Below it, the AS stores only a public key or a certificate — a
breach leaks nothing usable.

## `client_secret_basic` — the default, honestly described

RFC 6749 §2.3.1 defines it and requires support: authorization servers *"MUST support the
HTTP Basic authentication scheme"* for clients issued a password. The client id and secret
go in the `Authorization` header, URL-encoded and base64'd, on every call to the token
endpoint.

```yaml
# Spring Boot 4.1 — the default for a confidential client.
spring:
  security:
    oauth2:
      client:
        registration:
          orders:
            client-id: orders-service
            client-secret: ${ORDERS_CLIENT_SECRET}      # never a literal
            client-authentication-method: client_secret_basic
            authorization-grant-type: client_credentials
            scope: inventory:read
```

What it gives you: simplicity, universal support, no key management. What it costs:

- The secret is transmitted on every token request. TLS protects it in transit and nothing
  protects it at the endpoints.
- The authorization server must store something it can verify against. Good ones store a
  hash; many store it reversibly so it can be displayed in an admin console — and a console
  that can *show* you the secret is a console that stores it recoverably.
- Rotation is a coordinated deployment. Providers that allow two live secrets make this
  survivable; those that do not force a window of downtime or a risky swap.
- It appears in the places secrets appear: environment dumps, CI logs, error reports,
  `kubectl describe`, a `curl` someone pasted into a ticket.

## `client_secret_post` — the same thing, in the body

Identical security properties; the credentials move from the header to form parameters.
Prefer Basic: request bodies are logged by more middleware than headers, and some proxies
log bodies for non-2xx responses by default. Use `post` only when a provider requires it.

## `private_key_jwt` — the one worth the effort

The client builds a short-lived JWT, signs it with a private key that never leaves the
process, and sends *that* instead of a secret. RFC 7523 §2.2 fixes the parameters: the
`client_assertion_type` is the URN
`urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, and the `client_assertion`
parameter *"contains a single JWT. It MUST NOT contain more than one JWT."*

RFC 7523 §3 fixes what must be in it:

- **`iss`** — *"a unique identifier for the entity that issued the JWT"*.
- **`sub`** — *"For client authentication, the subject MUST be the `client_id` of the OAuth
  client."*
- **`aud`** — *"a value that identifies the authorization server as an intended audience"*.
- **`exp`** — REQUIRED, and *"limits the time window during which the JWT can be used"*.
- **`nbf`**, **`iat`**, **`jti`** — all MAY.

🔴 **`jti` is only a MAY, and it is the replay defence.** RFC 7523 does not require it, but an
assertion without a unique identifier cannot be single-use, so an intercepted assertion is
replayable until `exp`. Send a `jti`, keep `exp` to a minute or two, and expect the AS to
reject duplicates — check that it does, because not all do.

```java
// The shape of a private_key_jwt client assertion. Keep exp short and always send jti.
JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(clientId)                       // RFC 7523 §3: iss
        .subject(clientId)                      // §3: MUST be the client_id
        .audience(tokenEndpointOrIssuer)        // §3: identifies the AS
        .jwtID(UUID.randomUUID().toString())    // §3: MAY — send it anyway, it is the replay defence
        .issueTime(Date.from(now))
        .expirationTime(Date.from(now.plusSeconds(60)))   // §3: exp is REQUIRED
        .build();
// Signed with a private key that never leaves this process; the AS holds only the public key.
```

Spring Security 7.x supports this through the client registration's
`client-authentication-method: private_key_jwt` together with a configured JWT assertion
signer; the exact bean wiring belongs to **09 · Spring as OAuth2 client** *(not written
yet)*. What matters here is the property: **the authorization server never possesses a
credential that would let it, or an attacker who breaches it, act as your client.**

## `client_secret_jwt` — the awkward middle

An HMAC over the same claim set, keyed with the client secret. The secret is not transmitted,
which removes the on-the-wire and in-the-log exposure — but the AS still stores a symmetric
secret, so the impersonation risk after an AS breach remains. Take it when a provider offers
it and not `private_key_jwt`; do not take it as equivalent.

## mTLS — RFC 8705

The client presents a certificate during the TLS handshake and the AS binds the token to it.
Two variants: `tls_client_auth` against a CA-issued certificate with a registered subject,
and `self_signed_tls_client_auth` against a certificate registered directly.

Its real significance is beyond authentication: RFC 8705 also defines **certificate-bound
access tokens**, and RFC 9700 §2.2.1 recommends exactly this — *"Authorization and resource
servers SHOULD use mechanisms for sender-constraining access tokens, such as mutual TLS for
OAuth 2.0 [RFC8705] or OAuth 2.0 Demonstrating Proof of Possession (DPoP) [RFC9449]"*. That
turns a stolen access token into a useless one, which is the property OAuth 1.0 had and
bearer tokens gave away. **14 · mTLS and workload identity** *(not written yet)* takes it
further.

## `none` — public clients

Not a weakness, a statement of fact: a public client has nothing to authenticate with. §2.3
is explicit that authorization servers *"MUST NOT rely on public client authentication for
the purpose of identifying the client"*. The protection comes from exact redirect-URI
matching and PKCE instead.

## Choosing

1. **Public client** → `none` + PKCE. There is no decision to make.
2. **Confidential client, provider supports it** → `private_key_jwt`. No shared secret
   anywhere, no rotation coordination, nothing to leak in a log.
3. **You already have a mesh or a PKI** → mTLS, and take certificate-bound tokens with it.
4. **Otherwise** → `client_secret_basic`, with the secret in a real secret manager, rotation
   rehearsed, and logging configured so it cannot be printed.

## Gotchas

**★ A client secret in an authorization server's database is an impersonation credential.**
Symmetric methods require the AS to hold something equivalent to what you hold. `private_key_jwt`
and mTLS break that symmetry — the AS holds only a public key or certificate.

**★ `exp` is required on a client assertion but `jti` is not, and that gap is the replay
window.** RFC 7523 §3 makes `jti` a MAY. Without it, an intercepted assertion is reusable
until it expires. Always send one, keep `exp` to a minute or two, and verify the AS rejects
duplicates.

**★ `sub` on a client assertion must be the `client_id`, not a user.**
RFC 7523 §3 is explicit. Reusing a user-oriented JWT builder here produces an assertion the
AS rejects with an unhelpful `invalid_client`.

**★ The `aud` on a client assertion is the authorization server, not your API.**
Getting this wrong is a common `invalid_client`. Providers differ on whether it should be
the issuer or the token endpoint URL — check the provider's documentation, and if it accepts
either, send the one its docs name first.

**★ `client_secret_post` puts the secret where more things log it.**
Bodies are logged by more middleware than headers are, especially on error paths. Prefer
Basic unless the provider requires otherwise.

**★ Rotating a client secret without dual-secret support is a downtime event.**
Check before you need to. If only one secret can be live, plan a maintenance window rather
than discovering it during an incident.

**★ A secret in a container image layer is permanent.**
Baking it into an image publishes it to every registry replica and every cached layer,
including after you "remove" it in a later layer. Inject at runtime.

**★ Never log the token request.**
An HTTP client logger at DEBUG will print the `Authorization` header. Configure redaction
before you enable request logging, not after an incident.

**★ Confirm which methods your provider actually supports before designing around one.**
The `token_endpoint_auth_methods_supported` field in the AS metadata document (RFC 8414 /
OIDC Discovery) lists them. Designing for `private_key_jwt` and discovering the provider
does not offer it is a late and avoidable surprise.

**★ mTLS terminating at a load balancer is not mTLS client authentication.**
If the balancer terminates TLS, the AS never sees the client certificate. It must be passed
through, or the connection must terminate at the AS. Half-configured mTLS looks like it is
working right up until you check what the AS actually verified.

## Interview questions

**★ What client authentication methods does OAuth2 support, and how do they differ?**
`none` for public clients; `client_secret_basic` and `client_secret_post`, which transmit a
shared secret on every token request (RFC 6749 §2.3.1, with Basic mandatory for servers to
support); `client_secret_jwt`, an HMAC-signed assertion that keeps the secret off the wire
but still shared; `private_key_jwt` (RFC 7523), an assertion signed with a private key the AS
never holds; and mTLS (RFC 8705), in CA-issued and self-signed variants. The dividing line is
whether the authorization server stores something that could impersonate your client.

**★ Why is `private_key_jwt` better than a client secret?**
Because the credential is never transmitted and never shared. The client signs a short-lived
assertion with a private key that stays in its process; the AS holds only the public key. A
breach of the authorization server's client store leaks nothing usable, the secret cannot
appear in a log or a heap dump on the wire, and rotation is publishing a new public key
rather than coordinating a shared value across two parties.

**★ What must a client assertion contain?**
Per RFC 7523 §3: `iss`, a unique identifier for the issuer; `sub`, which for client
authentication MUST be the `client_id`; `aud`, identifying the authorization server; and
`exp`, which is required and bounds the usable window. `nbf`, `iat` and `jti` are MAY — but
send `jti` and keep `exp` short, because without a unique id the assertion is replayable
until it expires. It is sent as `client_assertion`, with `client_assertion_type` set to
`urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, and must contain exactly one JWT.

**★ Our provider only supports `client_secret_basic`. What do you do to make it as safe as
possible?** Keep the secret in a real secret manager and inject it at runtime, never in an
image layer or a repository. Configure HTTP client and framework logging to redact the
`Authorization` header before enabling any request logging. Confirm whether the provider
supports two live secrets and rehearse rotation on that basis. Scope the client narrowly so
a compromise is bounded. And treat the secret as a credential with a blast radius equal to
everything that client may do, because that is exactly what it is.

**★ What is a certificate-bound access token and why does it matter?**
Under RFC 8705, the authorization server binds the issued access token to the client
certificate used at the token endpoint, and the resource server checks that the presenting
client used the same certificate. A stolen token is then useless without the private key, so
it restores proof-of-possession — the property OAuth 1.0 had and bearer tokens abandoned.
RFC 9700 §2.2.1 recommends this, or DPoP, as the sender-constraining mechanism.

**★ How would you decide between these methods for a new service?**
If the client is public there is no choice: `none` plus PKCE. If it is confidential, prefer
`private_key_jwt` when the provider supports it — check
`token_endpoint_auth_methods_supported` in the discovery document rather than assuming. If
you already run a mesh or a PKI, mTLS is better still because it brings certificate-bound
tokens with it. Fall back to `client_secret_basic` when the provider forces it, and then
spend the effort you saved on secret storage, redacted logging and a rehearsed rotation.

**★ A colleague says mTLS is configured because the load balancer requires client
certificates. Is client authentication happening?** Not at the authorization server. If TLS
terminates at the balancer, the AS never sees the certificate and cannot bind a token to it,
so `tls_client_auth` is not in effect no matter what the balancer enforces. Either the
certificate must be passed through in a way the AS trusts and verifies, or the TLS connection
must terminate at the AS itself. This is the most common way mTLS ends up half-configured
and believed complete.

{/* FOOTER */}
