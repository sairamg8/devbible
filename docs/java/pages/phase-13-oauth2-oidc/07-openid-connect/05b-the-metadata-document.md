---
title: "Seven metadata members are REQUIRED and one of them carries a guarantee you can build a validator on, while the members everyone actually reads are optional — and an optional member a provider omits tells you nothing about whether the feature works"
sidebar_label: "05b · The metadata document"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Discovery 1.0 §3 (OpenID Provider Metadata) —
> the REQUIRED member list and the RS256 guarantee on
> `id_token_signing_alg_values_supported` — and §4, §4.3, at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 8414 §2 (Authorization Server Metadata)
> ([datatracker.ietf.org/doc/html/rfc8414](https://datatracker.ietf.org/doc/html/rfc8414));
> RFC 9700 §2.1.1 (authorization servers MUST support PKCE)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> Spring Boot 4.1.0 `spring.security.oauth2.client.provider.*.issuer-uri` and Spring Security
> 7.x `ClientRegistrations.fromIssuerLocation`
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.
> **No sandbox** — the JSON below is a structural example assembled from §3's member
> definitions, not a captured response from any provider.

**[The previous chunk](05-discovery-and-the-well-known-document.md) argued that discovery is
safe because of one identity rule. This one is about what the document actually contains and
how to read it without over-trusting it. Two traps live here and both come from the same
misreading: treating the document as a statement about *you* rather than about the *provider*.
`scopes_supported` is what the provider knows how to issue, not what your client is allowed
to ask for. And an absent optional member — `code_challenge_methods_supported` is the one
that bites — means the provider chose not to advertise, never that the feature is missing.**

The one member that does give you something to build on is
`id_token_signing_alg_values_supported`, because §3 requires RS256 to be in it. That is a
guarantee across every conforming provider, and it is what lets a validator pin an algorithm
instead of reading one out of the token it is about to verify.

## The REQUIRED metadata members

§3 defines many members; these are the ones marked REQUIRED, and they are the ones your
client actually consumes:

| Member | What it is |
|---|---|
| `issuer` | The URL the OP asserts as its Issuer Identifier — the value §4.3 pins |
| `authorization_endpoint` | Where the front-channel redirect goes |
| `token_endpoint` | Where the back-channel exchange goes (REQUIRED unless only the Implicit Flow is used) |
| `jwks_uri` | The JWK Set document, over `https` — where signature keys come from |
| `response_types_supported` | Which `response_type` values the OP accepts |
| `subject_types_supported` | `public`, `pairwise`, or both |
| `id_token_signing_alg_values_supported` | JWS algorithms for the ID token — **RS256 MUST be included** |

The last row is worth noticing: RS256 is guaranteed to be in that list, which is why RS256 is
a safe default to pin when you want to stop reading `alg` from the token header at all — see
[03b · Signature, time and the rest](03b-signature-time-and-the-conditional-checks.md).

Optional but heavily used in practice: `userinfo_endpoint`, `end_session_endpoint`,
`scopes_supported`, `claims_supported`, `code_challenge_methods_supported`,
`token_endpoint_auth_methods_supported`, `revocation_endpoint`, `introspection_endpoint`.

🔴 **Optional means a provider may omit it while still supporting the feature.** §3 is
explicit that some of these lists are advisory; a missing `code_challenge_methods_supported`
is not proof that PKCE is unsupported, and a missing `scopes_supported` is not proof a scope
will be rejected. Treat presence as evidence and absence as unknown.

## What a document looks like

```json
{
  "issuer": "https://idp.example.com/realms/corp",
  "authorization_endpoint": "https://idp.example.com/realms/corp/protocol/openid-connect/auth",
  "token_endpoint": "https://idp.example.com/realms/corp/protocol/openid-connect/token",
  "userinfo_endpoint": "https://idp.example.com/realms/corp/protocol/openid-connect/userinfo",
  "end_session_endpoint": "https://idp.example.com/realms/corp/protocol/openid-connect/logout",
  "jwks_uri": "https://idp.example.com/realms/corp/protocol/openid-connect/certs",
  "response_types_supported": ["code", "id_token", "code id_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256", "ES256"],
  "scopes_supported": ["openid", "profile", "email", "offline_access"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "private_key_jwt"]
}
```

*(A structurally-accurate example assembled from §3's member definitions — not a captured
response from any provider.)*

## What this looks like in Spring

One property replaces the nine:

```yaml
spring:
  security:
    oauth2:
      client:
        provider:
          corp:
            issuer-uri: https://idp.example.com/realms/corp   # the only value
        registration:
          corp:
            provider: corp
            client-id: s6BhdRkqt3
            client-secret: "{client-secret}"
            authorization-grant-type: authorization_code
            scope: openid,profile,email
```

Spring resolves that with `ClientRegistrations.fromIssuerLocation(...)`, which probes the
known metadata layouts, reads the endpoints out of the document, and — importantly —
**asserts §4.3's first `MUST` itself**: the `issuer` member must equal the location you gave.
When people report that "Spring is stricter than the spec here", it is not; it is enforcing
the sentence most hand-rolled clients skip.

The equivalent on the resource-server side is `NimbusJwtDecoder.withIssuerLocation(...)`,
which does the same probe and then adds a `JwtIssuerValidator` for the same string — the
two-hats argument in
[08 · `issuer-uri`](../08-spring-security-resource-server/02-issuer-uri.md).

## What discovery does not do

- **It does not authenticate the provider.** The trust comes from TLS to the issuer's host
  plus §4.3's identity rule. If you fetch discovery over plain HTTP, or with certificate
  validation disabled "for the test environment", you have handed an attacker the ability to
  nominate the authorization endpoint *and* the key set.
- **It does not stay fresh on its own.** Endpoints are read once at startup or on first use.
  Key material is a separate concern with its own refresh policy — that is `jwks_uri` and
  key rotation, not this document.
- **It does not tell you what your client is allowed to do.** `scopes_supported` describes the
  provider, not your registration. A scope in that list may still be refused for your client.

## Gotchas

**★ Discovery is fetched at startup and the service will not boot when the IdP is down.**
Symptom: a deployment that cannot roll out during an identity-provider incident. Cause: an
eager resolution — often the application's own `@PostConstruct` or an eagerly-initialised
bean — rather than the framework's deferred one. Fix: let resolution be lazy, and decide
deliberately whether you want fail-fast; the argument is
[08 · Startup coupling](../08-spring-security-resource-server/03-startup-coupling.md).

**★ `scopes_supported` is treated as an entitlement list.**
Symptom: a scope that is present in the document is still rejected for your client. Cause:
the document describes the provider's capabilities, not your registration's grants. Fix: read
it as a *possibility* list and confirm the actual grant in your client registration at the
provider.

**★ The absence of `code_challenge_methods_supported` is read as "PKCE unsupported".**
Symptom: PKCE is disabled against a provider that supports it, weakening the flow for no
reason. Cause: an optional member treated as authoritative. Fix: absence is unknown; send
PKCE anyway — RFC 9700 §2.1.1 requires authorization servers to support it, and a server that
ignores the parameters is no worse off than one you never sent them to.

**★ The discovery document is cached forever.**
Symptom: a provider migrates an endpoint and the client keeps calling the old one long after
the change. Cause: endpoints resolved once at boot and never revisited. Fix: this is usually
acceptable — endpoints rarely move and a restart picks them up — but it is a decision to make
knowingly, and it is *not* the same as caching the JWK set, which must refresh on key
rotation.

**★ A multi-tenant service builds one `ClientRegistration` per tenant at startup.**
Symptom: startup time proportional to the number of tenants, and a boot failure if any single
provider is unreachable. Cause: eager discovery in a loop. Fix: resolve per tenant lazily and
cache, so one unhealthy tenant does not stop the service — the dynamic-tenant argument is
**09b · Dynamic tenants** *(not written yet)* in topic 08.

**★ The document is parsed strictly and an unknown member causes a failure.**
Symptom: a client that worked last month breaks after the provider ships a release, with a
deserialisation error naming a member nobody asked for. Cause: a strict JSON binding over a
document §3 explicitly allows to carry additional members. Fix: ignore unknown properties —
metadata is extensible by design, and every new specification (DPoP, PAR, RAR) adds members.

```java
ObjectMapper mapper = JsonMapper.builder()
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .build();
```

**★ `end_session_endpoint` is assumed present because the provider has a logout page.**
Symptom: an NPE, or a logout that silently does nothing, against a provider that implements
logout but does not advertise it in this document. Cause: `end_session_endpoint` is defined by
RP-Initiated Logout rather than by Discovery's core member list, and support for it varies.
Fix: treat its absence as "no protocol logout available" and fall back to clearing your own
session — which is what **10 · Logout** *(not written yet)* argues you should be doing
anyway.

**★ `jwks_uri` is fetched once and the response cached with the discovery document.**
Symptom: every login fails for the length of the cache after the provider rotates a signing
key. Cause: conflating two caches with very different correct lifetimes. Fix: keep them
separate — endpoints can be cached for the process lifetime, the key set must refresh when an
unknown `kid` appears.

## Interview questions

**★ What does discovery actually save you, and what does it cost?**
It replaces nine independently-wrong configuration values — authorization endpoint, token
endpoint, JWKS URI, UserInfo endpoint, end-session endpoint, and the supported-algorithm,
scope and response-type lists, plus the issuer — with one: the issuer. The cost is an
outbound HTTP dependency at startup or first use, and a trust decision: whatever that document
says becomes your authorization endpoint and your key source. §4.3's identity rule is what
makes that trust safe, and TLS to the issuer's host is what makes §4.3 meaningful.

**★ Which metadata members are REQUIRED, and which one gives you a guarantee you can build
on?**
`issuer`, `authorization_endpoint`, `token_endpoint` (unless only the Implicit Flow is used),
`jwks_uri`, `response_types_supported`, `subject_types_supported` and
`id_token_signing_alg_values_supported`. The last one carries a guarantee: RS256 MUST be
included. That is what lets you pin RS256 as the accepted algorithm in your validator rather
than trusting the `alg` header of the token you are about to verify.

**★ `scopes_supported` lists `offline_access` but your client gets an error asking for it.
Whose bug is it?**
Nobody's, in the protocol sense. The metadata describes what the provider is capable of, not
what your particular client registration is permitted to request. The fix is at the provider's
client configuration, and the general lesson is that discovery answers questions about the
*server*, never about your grants.

**★ If discovery gives you `jwks_uri`, do you still need to think about key rotation?**
Yes, and they are separate concerns with separate lifetimes. Discovery tells you *where* the
keys are, once. Rotation is about how often you re-read that location and what happens when a
token arrives signed with a `kid` you have not seen. Caching the discovery document forever is
usually harmless; caching the JWK set forever is an outage on the provider's next rotation.

**★ The provider's metadata gains a member you have never seen. What should your client do?**
Ignore it. §3 allows the document to carry members beyond those it defines, and in practice
every extension specification — PAR, DPoP, rich authorization requests — adds some. A client
that fails to deserialise an unknown member has coupled its uptime to the provider's release
schedule for no benefit.

**★ Which cache lifetimes are appropriate for the discovery document versus the JWK set, and
why are they different?**
The discovery document names endpoints, which change on the order of migrations — caching it
for the process lifetime is normal, and a restart picks up a move. The JWK set names signing
keys, which change on the provider's rotation schedule and can change without warning; it must
be refreshable on demand, typically when a token arrives carrying a `kid` the cache does not
contain, with a rate limit so an attacker cannot use unknown `kid` values to force unbounded
fetches.

---

← [Discovery](05-discovery-and-the-well-known-document.md) · [Topic index](README.md) · Next → **Standard scopes and claims** *(not written yet)*
