---
title: "RFC 6749 calls itself a framework and means it literally — it leaves the token format, the scope vocabulary, the user-consent screen, the error semantics and the discovery mechanism entirely undefined, which is why two conformant OAuth2 implementations can be completely unable to talk to each other"
sidebar_label: "04 · A framework, not a protocol"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 — the Abstract, §1.3 (Authorization Grant), §1.8
> (Interoperability), §3.3 (Access Token Scope), §7.1 (Access Token Types) — and RFC 8414
> (*OAuth 2.0 Authorization Server Metadata*), RFC 9068 (*JWT Profile for OAuth 2.0 Access
> Tokens*) and OpenID Connect Discovery 1.0, at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**"We support OAuth2" is not an interoperability claim. It is roughly as informative as "we
speak over HTTP". The specification says so about itself, in §1.8, in unusually candid
language: a rich and highly extensible framework with many optional components "is likely to
produce a wide range of non-interoperable implementations". Every integration surprise you
will ever hit with a third-party provider comes out of the list of things RFC 6749 chose not
to decide — and knowing that list in advance turns those surprises into expected questions.**

## The candid paragraph

RFC 6749 §1.8, verbatim in its essentials:

> *"OAuth 2.0 provides a rich authorization framework with well-defined security properties.
> However, as a rich and highly extensible framework with many optional components, on its
> own, this specification is likely to produce a wide range of non-interoperable
> implementations… This framework was designed with the clear expectation that future work
> will define prescriptive profiles and extensions necessary to achieve full web-scale
> interoperability."*

Two things to take from it. First, the non-interoperability is **acknowledged and
intentional**, not a defect report. Second, the repair strategy is **profiles** — narrower
specifications that pin down what the framework left open. OpenID Connect, RFC 8414, RFC
9068 and RFC 9700 are those profiles. This is why the phase teaches the RFC *set* rather
than "OAuth2".

## The list of what is genuinely undefined

**The access token's format.** RFC 6749 §7.1 leaves the token type and format to the
authorization server. It may be a random opaque string, a JWT, a structured reference, an
encrypted blob. Nothing in the core specification lets a client or a resource server assume
otherwise. RFC 9068 later defines the `application/at+jwt` profile for those that choose
JWT — a profile, precisely because the core does not.

**How the resource server validates the token.** The core specification describes issuance,
not validation. Local signature verification, introspection (RFC 7662), a vendor-specific
endpoint, or a shared cache are all outside RFC 6749. Two providers with equally conformant
implementations may require completely different resource-server code.

**The scope vocabulary.** §3.3 defines scope as a space-delimited, case-sensitive list of
strings whose values are *"defined by the authorization server"*. `read`, `photos:read`,
`https://graph.example.com/Files.Read`, `openid profile email` — all conformant. There is no
standard scope in OAuth2 at all; even `openid` is OIDC's, not OAuth2's. Any code that
pattern-matches scope strings is provider-specific by construction.

**The consent screen.** What the user sees, whether consent is remembered, whether it can be
partially granted, whether the user may de-select individual scopes — none of it is
specified. This is why "the user only approved two of the three scopes we asked for" is a
real production case at some providers and impossible at others.

**Error semantics beyond the wire format.** §5.2 fixes the *codes* (`invalid_request`,
`invalid_client`, `invalid_grant`, and so on) but not which condition maps to which, nor the
human-readable `error_description`. Providers disagree about whether an expired refresh
token is `invalid_grant` or `invalid_request`, so client refresh logic ends up
provider-specific — the single most common source of "it works with Keycloak but not with
the vendor".

**Discovery.** The core has none. You learn the endpoints from documentation, by hand. RFC
8414 (AS metadata) and OIDC Discovery add
`/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`, and once
a provider supports one of them, Spring's `issuer-uri` can configure a resource server in a
single line — that is **08 · Spring Security as resource server** *(being written)*.

**Client registration.** Manual, out of band, in the core. RFC 7591 adds dynamic
registration; most providers do not enable it.

**Token lifetimes, refresh-token rotation policy, and revocation.** `expires_in` is
communicated but its value is policy. Whether refresh tokens rotate, whether reuse is
detected, whether there is a revocation endpoint at all (RFC 7009 is separate) — all
provider decisions. **05 · The three tokens** *(being written)* has the detail.

## The five grants, and how few of them you should use

§1.3 defines four grant types plus extensions. In 2026 the live picture is much narrower:

| Grant | RFC 6749 § | Status in 2026 |
|---|---|---|
| Authorization code | §1.3.1 | ✅ **The one to know**, with PKCE |
| Implicit | §1.3.2 | ⛔ RFC 9700 §2.1.2: clients **SHOULD NOT** use it |
| Resource owner password credentials | §1.3.3 | ⛔ RFC 9700 §2.4: **MUST NOT** be used |
| Client credentials | §1.3.4 | ✅ Machine-to-machine, no user involved |
| *(extension)* Device authorization, RFC 8628 | — | ✅ For TVs, CLIs, input-constrained devices |
| *(extension)* Token exchange, RFC 8693 | — | ✅ Service-to-service delegation |

🔴 **Two of the four grants in the original specification are now discouraged or forbidden,
and two of the ones you will actually use are not in it.** That is the framework working as
intended — profiles and extensions arriving, deprecations landing in a BCP — and it is
exactly why quoting RFC 6749 alone is not enough to be current.

## What this means when you integrate

The practical consequence is a checklist. For every provider you integrate with, these are
provider-specific until proven otherwise, and every one of them has broken a real
integration:

1. Is the access token opaque or a JWT? If JWT, does it follow RFC 9068?
2. Is there a discovery document, and at which of the two `/.well-known` paths?
3. What is the scope vocabulary, and is there a scope required to get an ID token or a
   refresh token at all? (Many providers require `offline_access` for a refresh token.)
4. Do refresh tokens rotate? Is reuse detected and the family revoked?
5. Which `error` code does an expired refresh token produce?
6. Is `aud` on the access token the resource server, the client, or absent? (Absent is
   common, and it is why audience validation so often has to be configured by hand.)
7. Where do roles live — `scope`, a custom claim, `realm_access.roles`, `groups`?
8. Is consent remembered, and can the user grant a subset of the requested scopes?

Write the answers down next to the integration. They are the integration.

## Gotchas

**★ "We are OAuth2 compliant" is not a compatibility statement.**
Ask which profile: OIDC? RFC 9068 access tokens? RFC 8414 discovery? RFC 9700's BCP? Two
fully conformant implementations can require entirely different client and resource-server
code, and §1.8 says as much.

**★ There are no standard scopes in OAuth2.**
§3.3 says scope values are defined by the authorization server. `openid`, `profile` and
`email` come from OpenID Connect, not from OAuth2. Any switch statement over scope strings
is provider-coupled — isolate it.

**★ Scope is space-delimited and case-sensitive.**
Comma-separating scopes is a classic bug that some providers tolerate and others reject, and
`Read` is not `read`. Both are in §3.3 and both get missed.

**★ A missing `aud` on an access token is common and is not a provider bug.**
The core specification does not require it. It does mean the resource server must be
configured to require and check a specific audience explicitly, or it will accept tokens
minted for a different service in the same realm. See **08 · Spring Security as resource
server** *(being written)*.

**★ Do not build refresh logic on one provider's error codes.**
§5.2 fixes the code list, not the mapping. Handle "the refresh failed for any reason" as one
branch that restarts the authorization flow, rather than switching on `invalid_grant`.

**★ Requesting a refresh token often needs a scope you have to ask for.**
`offline_access` at many providers, a client setting at others, unavailable to public
clients at some. "We do not get a refresh token" is usually configuration, not a bug.

**★ Two `/.well-known` paths exist and they are not the same document.**
`/.well-known/openid-configuration` is OIDC Discovery; `/.well-known/oauth-authorization-server`
is RFC 8414. A provider may serve one, both, or neither, and Spring's `issuer-uri` probes for
them — a failure here at startup is usually the wrong path or a trailing-slash mismatch on
the issuer.

**★ The framework's flexibility is why "just use a library" is right, and also why the
library needs configuring.** A library implements the framework; the provider-specific
answers to the eight questions above are still yours to supply.

## Interview questions

**★ Why is OAuth 2.0 called a framework rather than a protocol?**
Because it standardises the roles, the grant types and the shape of the exchanges, but
deliberately leaves the token format, the validation mechanism, the scope vocabulary, the
consent experience, discovery and client registration to the implementer. RFC 6749 §1.8 says
so explicitly and predicts "a wide range of non-interoperable implementations", expecting
later "prescriptive profiles and extensions" — which is what OIDC, RFC 8414, RFC 9068 and
RFC 9700 turned out to be.

**★ Name things the core specification does not decide.**
Access-token format (§7.1 leaves it to the AS), how the resource server validates a token,
the scope vocabulary (§3.3: values are defined by the AS), the consent UI and whether
partial consent is possible, discovery of endpoints, client registration, token lifetimes
and refresh-token rotation policy, and the mapping of conditions to the §5.2 error codes.

**★ Which OAuth2 grant types should a new system use in 2026?**
Authorization code with PKCE for anything involving a user, and client credentials for
machine-to-machine. Device authorization (RFC 8628) if a device cannot host a browser, and
token exchange (RFC 8693) for delegation between services. Implicit is a SHOULD NOT under
RFC 9700 §2.1.2 and the password grant is a MUST NOT under §2.4 — note that two of the four
original grants are now off the table and two of the useful ones are extensions, so the
current answer is not readable from RFC 6749 alone.

**★ A provider's access tokens have no `aud` claim. Is the provider broken?**
No — the core specification does not require it, and plenty of providers omit it. It is
still a real risk for you: without an audience your resource server may accept a token
minted for a different service, so you must configure the required audience explicitly, or
use per-service issuers, or introspect. Treat it as a configuration obligation rather than a
vendor defect.

**★ Your integration works against Keycloak in test and fails against the customer's Entra
ID in production. Where do you look first?** The list of undefined things. Token format
(opaque vs JWT vs a JWT you are not entitled to parse), the discovery path, the scope
vocabulary and whether a scope is required to get a refresh token or an ID token at all,
whether `aud` is present and what it contains, where roles live, and which error code a
failed refresh produces. None of those are guaranteed to match between two conformant
providers, and each has broken real integrations.

**★ Why does this phase teach a set of RFCs instead of just RFC 6749?**
Because RFC 6749 on its own is neither sufficient nor current. Sufficient interoperability
comes from profiles — OIDC for identity, RFC 9068 for JWT access tokens, RFC 8414 for
discovery — and currency comes from RFC 9700, which deprecates grants the core still
describes as normal. Reading only the core leaves you implementing 2012.

{/* FOOTER */}
