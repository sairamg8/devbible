---
title: "Discovery turns nine configuration values into one, and the rule that makes it work is that the issuer string you configured, the issuer member of the document you fetched and the iss claim of every token must be byte-identical — three copies of one string, and the specification says MUST twice about it"
sidebar_label: "05 · Discovery"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Discovery 1.0 §2 (OpenID Provider Issuer
> Discovery), §3 (OpenID Provider Metadata), §4 (Obtaining OpenID Provider Configuration
> Information) and §4.3 (OpenID Provider Configuration Validation), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> OpenID Connect Core 1.0 §3.1.3.7 rule 2, at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> RFC 8414 (OAuth 2.0 Authorization Server Metadata)
> ([datatracker.ietf.org/doc/html/rfc8414](https://datatracker.ietf.org/doc/html/rfc8414));
> the Spring Security 7.x `ClientRegistrations.fromIssuerLocation` /
> `NimbusJwtDecoder.withIssuerLocation` behaviour
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — quoted specification text and illustrative configuration; the metadata
> document shown is a structural example, not a captured response.

**Without discovery you configure an authorization endpoint, a token endpoint, a JWKS URI, a
UserInfo endpoint, an end-session endpoint, a supported-algorithm list, a supported-scope
list, a supported-response-type list and an issuer — nine values, each of which can be
individually wrong and each of which changes when the provider changes. With discovery you
configure one: the issuer. Everything else is fetched from a JSON document at a path the
specification computes from that one string. That is the entire value proposition, and it is
why `issuer-uri` is one line in a Spring Boot properties file.**

The part that repays careful reading is not the convenience — it is §4.3, which turns the
issuer into an identity check rather than a lookup key. The issuer you configured, the
`issuer` member of the document that came back, and the `iss` claim of every token the
provider mints must all be **the same string**. That single rule is what stops discovery
being a redirect an attacker can point somewhere else, and it is also the source of the most
frequent configuration failure in this phase.

## The path is computed, not configured

> §4: *"OpenID Providers supporting Discovery MUST make a JSON document available at the path
> formed by concatenating the string `/.well-known/openid-configuration` to the Issuer."*

Concatenating — not "at the root of the host". The distinction matters the moment the issuer
has a path component, which every Keycloak realm does:

| Issuer | Discovery document |
|---|---|
| `https://idp.example.com` | `https://idp.example.com/.well-known/openid-configuration` |
| `https://example.com/issuer1` | `https://example.com/issuer1/.well-known/openid-configuration` |
| `https://kc.example.com/realms/corp` | `https://kc.example.com/realms/corp/.well-known/openid-configuration` |

A terminating `/` on the issuer is removed before appending, so
`https://example.com/issuer1/` and `https://example.com/issuer1` produce the same document
URL — **but they are still different issuer strings for §4.3 and for Core §3.1.3.7 rule 2.**
Two paths that lead to the same document do not make two strings equal.

⚠️ **RFC 8414 computes it differently, and both exist.** The OAuth 2.0 Authorization Server
Metadata RFC inserts the well-known segment *before* the path component —
`https://example.com/.well-known/oauth-authorization-server/issuer1` — where OIDC Discovery
appends it. A provider may publish at one, the other, or both, which is why Spring's
`issuer-uri` handling probes more than one layout rather than assuming.

## §4.3 — the rule that makes discovery safe

> §4.3: *"The issuer value returned MUST be identical to the Issuer URL that was used as the
> prefix to `/.well-known/openid-configuration` to retrieve the configuration information.
> This MUST also be identical to the `iss` Claim value in ID Tokens issued from this Issuer."*

Two `MUST`s in two sentences, and they close a loop:

```text
   configured issuer  ──used to build──▶  /.well-known/openid-configuration
          ▲                                          │
          │                                    returns a document whose
          └────────── MUST be identical ◀───────  "issuer" member is
          ▲
          └────────── MUST be identical ◀───────  the "iss" claim of every token
```

Without the first `MUST`, a document served at your issuer's well-known path could name a
*different* issuer and hand you that issuer's endpoints and keys — discovery would become a
delegation you never intended. Without the second, the metadata would describe one provider
while the tokens came from another.

**In practice you meet this as a 401, not as a security incident.** The classic shape:
Keycloak reachable inside the cluster as `http://keycloak:8080/realms/corp`, exposed to
browsers as `https://idp.example.com/realms/corp`, and configured to stamp the public value
into `iss`. The service fetches discovery from the internal URL; the document says
`"issuer": "https://idp.example.com/realms/corp"`; the strings differ; validation fails. The
fix is configuration, not code — the service must reach the provider *at the public issuer
identifier* (typically split-horizon DNS), or the provider must be told which hostname is
canonical. **Never relax the comparison to make it pass.**

## Gotchas

**★ The issuer works in one environment and 401s in another.**
Symptom: identical code, identical provider software, `Invalid issuer` in production only.
Cause: the URL the service uses to reach the provider is not the string the provider stamps
into `iss` — internal DNS name, `http` versus `https`, a port, or a trailing slash. Fix:
make the service reach the provider at the canonical public issuer identifier, or configure
the provider's canonical hostname. Both `MUST`s in §4.3 are then satisfied by construction.

**★ A trailing slash is added to `issuer-uri` "to be safe".**
Symptom: startup fails with a message about the issuer not matching, or every token is
rejected. Cause: `https://idp.example.com/realms/corp/` and `.../corp` fetch the same
document but are different strings, and §4.3 requires identity with the `issuer` member. Fix:
copy the value from the document's own `issuer` member, character for character.

**★ The well-known path is hand-built by string concatenation with a slash.**
Symptom: a double slash — `https://idp.example.com//.well-known/openid-configuration` — and a
404 from providers that do not normalise. Cause: appending without checking for a terminating
`/`. Fix: strip one trailing `/` from the issuer before concatenating, exactly as §4 says.

```java
String base = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
URI wellKnown = URI.create(base + "/.well-known/openid-configuration");
```

**★ RFC 8414's layout is assumed to be the same as OIDC's.**
Symptom: a 404 against a provider that publishes only the OAuth 2.0 metadata document.
Cause: RFC 8414 inserts `/.well-known/oauth-authorization-server` *before* the path
component, where OIDC appends. Fix: probe both layouts, or use a library that already does —
Spring's issuer-location resolution tries more than one.

**★ Discovery is fetched over HTTP, or with TLS verification disabled in a test profile that
reaches production.**
Symptom: none, until someone is on the path. Cause: a `trust-all` `RestClient` copied from a
local-development profile. Fix: never ship it; the whole security argument for discovery is
TLS to the issuer's host plus §4.3.

## Interview questions

**★ Why must the `issuer` member of the document equal the URL you fetched it from?**
Because without that rule the document is a redirect. A response served at your issuer's
well-known path could name a different issuer and supply that issuer's endpoints and keys,
and your client would follow it — an attacker who can serve one JSON document would own your
authentication. §4.3 closes the loop by requiring the configured issuer, the document's
`issuer` member and the `iss` claim of every token to be the same string.

**★ Your service reaches Keycloak at `http://keycloak:8080/realms/corp` and every token is
rejected. What is happening and what do you change?**
The `iss` claim carries the public issuer identifier — say
`https://idp.example.com/realms/corp` — and Core §3.1.3.7 rule 2 requires an *exact* match
against the issuer you configured, which is the internal URL. Discovery §4.3 makes the same
demand of the document. The change is environmental: resolve the public hostname from inside
the cluster (split-horizon DNS or a hosts entry) so one string is used everywhere, or
configure the provider's canonical hostname. Relaxing the comparison would remove the only
check that ties tokens to a specific provider.

**★ How is the discovery URL constructed when the issuer has a path?**
By concatenation onto the issuer, after removing a terminating slash — so
`https://example.com/issuer1` yields
`https://example.com/issuer1/.well-known/openid-configuration`, not
`https://example.com/.well-known/openid-configuration`. RFC 8414's OAuth 2.0 metadata document
uses the other arrangement, inserting the well-known segment before the path, which is why
libraries probe more than one layout.

---

← [Generating and storing them](04b-generating-and-storing-them.md) · [Topic index](README.md) · Next → [The metadata document](05b-the-metadata-document.md)
