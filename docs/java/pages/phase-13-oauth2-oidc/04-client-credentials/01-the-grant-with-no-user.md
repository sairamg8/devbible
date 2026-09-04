---
title: "Client credentials is the OAuth2 grant with no resource owner in it, which means it is not delegation at all — and reading it as 'the flow for services' rather than 'the flow where nobody delegates anything' is what leads teams to expect a user, a consent screen and a refresh token that the specification explicitly forbids"
sidebar_label: "01 · The grant with no user"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 §1.3.4 (Client Credentials), §4.4 (Client Credentials
> Grant), §4.4.1 (Authorization Request and Response), §4.4.2 (Access Token Request), §4.4.3
> (Access Token Response), §5.1 (Successful Response), §6 (Refreshing an Access Token) and
> §2.3 (Client Authentication) — at
> [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Every other grant in OAuth2 exists to answer "how does this application act on a person's
behalf". Client credentials answers a different question — "how does this application prove
it is itself" — and it is filed in the same specification because it reuses the same token
endpoint and the same token format. Once you see that there is no resource owner in §4.4,
three things stop being surprising: there is no consent screen, there is no browser
redirect, and RFC 6749 §4.4.3 states outright that "the authorization server MUST NOT issue
a refresh token".**

## What §1.3.4 actually permits

RFC 6749 §1.3.4 is precise about when this grant is appropriate: the client credentials
*"can be used as an authorization grant when the authorization scope is limited to the
protected resources under the control of the client"*.

🔴 **"Under the control of the client"** is the constraint, and it is routinely ignored. The
grant is for resources the client itself owns or administers. It is *not* a general-purpose
way to reach any resource — and in particular, a token obtained this way carries no user's
authority, so using it to read a specific person's data is asserting a permission nobody
granted. That is the anti-pattern this topic keeps returning to.

## The whole flow

There is no authorization endpoint and no front channel. §4.4.1 has no redirect because
there is no user agent to redirect — the client goes straight to the token endpoint.

§4.4.2 fixes the request. It is `application/x-www-form-urlencoded` to the token endpoint
with:

- **`grant_type`** — *"Value MUST be set to `client_credentials`"*.
- **`scope`** — *"OPTIONAL. The scope of the access request."*

and the authentication requirement: *"If the client type is confidential or the client was
issued client credentials (or assigned other authentication requirements), the client MUST
authenticate with the authorization server."*

That is the entire request. Two parameters and client authentication.

```yaml
# Spring Boot 4.1 — the whole client-credentials configuration.
spring:
  security:
    oauth2:
      client:
        registration:
          inventory:
            client-id: orders-service
            client-secret: ${ORDERS_CLIENT_SECRET}
            authorization-grant-type: client_credentials      # no redirect-uri: there is no redirect
            scope: inventory:read,inventory:reserve
        provider:
          inventory:
            token-uri: https://auth.internal/oauth2/token     # token endpoint only
```

Note what is absent: no `redirect-uri`, no `authorization-uri`, no `user-info-uri`. A
configuration carrying those for a client-credentials registration is a copied block, and
the extra values are inert at best.

## 🔴 No refresh token — and it is a MUST NOT

§4.4.3 says the authorization server *"MUST NOT issue a refresh token"* for this grant.

The reasoning is clean once the role map is clear. A refresh token exists so a client can
obtain new access tokens **without the user being present again** — it is a stand-in for an
absent resource owner's consent. Here the resource owner was never present and the client
still holds its own credentials, so it can simply ask for another access token whenever it
wants. A refresh token would be a second, longer-lived credential granting exactly what the
client secret already grants, with nothing gained and more to leak.

**So the renewal strategy is: request a new token.** Not refresh. If a provider returns a
refresh token for a client-credentials grant, it is non-conformant — ignore it rather than
building on it.

## Caching is not optional

Because renewal means a full token request, and because that request goes to the
authorization server, a naive client makes the AS a synchronous dependency of **every**
outbound call. Cache the token for its lifetime, minus a safety margin.

```java
// Spring's OAuth2AuthorizedClientManager caches per (registrationId, principal) and
// re-requests when expired. The default clock skew is why the margin exists at all.
@Bean
OAuth2AuthorizedClientManager clientManager(
        ClientRegistrationRepository registrations,
        OAuth2AuthorizedClientService clients) {

    var provider = OAuth2AuthorizedClientProviderBuilder.builder()
            .clientCredentials(c -> c.clockSkew(Duration.ofSeconds(60)))  // renew 60s early
            .build();

    var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clients);
    manager.setAuthorizedClientProvider(provider);
    return manager;
}
```

The `clockSkew` here is not about clock correctness — it is the margin that stops a token
expiring *in flight*, between the moment you decide it is still valid and the moment the
resource server checks `exp`. Without it, a token with one second left is considered fresh,
sent, and rejected.

## What the token looks like on the other side

The resource server receives a token with no human behind it. Concretely:

- **`sub`** identifies the **client**, not a person. Commonly the `client_id`, sometimes a
  service-account subject, sometimes absent entirely.
- **No `nonce`**, no `auth_time`, and no OIDC-style user claims — this is not an
  authentication of anybody.
- **`scope`** is what the client was configured to receive, not what a user approved.
- Some providers add a claim distinguishing a machine token — Keycloak, for example, marks
  service-account tokens with a recognisable subject convention. **Check yours**, because
  the ability to tell a machine caller from a human one is what the next chunks build on.

## Gotchas

**★ There is no resource owner, so `sub` is not a user.**
Code that logs `sub` as a user id, looks it up in a `users` table, or renders it as "acting
user" will find a client identifier or nothing. Handle machine callers as an explicit case,
not as a user who happens to be missing.

**★ A refresh token here is forbidden by the specification, not merely unnecessary.**
§4.4.3: the authorization server "MUST NOT issue a refresh token". If your provider returns
one, that is a provider bug — do not store it and do not build renewal on it. Ask for a new
token instead.

**★ Not caching the token makes the authorization server a dependency of every request.**
Two network round trips per outbound call, and an AS blip becomes a full outage of a path
with no users involved. Cache for the token's lifetime, minus a margin.

**★ Caching without a renewal margin produces intermittent 401s that are impossible to
reproduce.** A token with a second left passes your freshness check and fails the resource
server's `exp` check. Renew early — Spring's `clockSkew` on the client-credentials provider
defaults to a minute for exactly this reason.

**★ A client-credentials token carries no user's authority, so it must not be used to read a
specific user's data.** §1.3.4 limits the grant to resources "under the control of the
client". A background job reading one customer's records with a service token is asserting a
permission nobody granted — and there is no consent record, no scope limitation tied to that
user, and no audit trail naming a person.

**★ Public clients cannot use this grant.**
It *is* client authentication, and §2.3 forbids relying on public client authentication to
identify the client. A browser or mobile app cannot use client credentials, and any design
that has one doing so has published the credential.

**★ Copying an authorization-code configuration block leaves inert `redirect-uri` and
`authorization-uri` values.** Harmless but misleading — a reader assumes a browser flow
exists. Delete them.

**★ One shared service account for every service is the machine equivalent of a shared
admin password.** Its scopes become the union of everything anyone needed, no call is
attributable, and revoking it stops everything. One registration per calling service.

**★ Scopes on a machine token still need to be narrow.**
There is no user to constrain the token, so the scope list is the *only* constraint. A
service account with `*` or with every scope in the realm turns a single compromised pod
into full API access.

**★ The token endpoint is rate limited, and a cold start can hit it hard.**
A fleet restarting simultaneously requests tokens simultaneously. Jitter the initial
request, or accept that a deploy can look like an attack to your own AS.

## Interview questions

**★ What is the client credentials grant for?**
For a client acting on its own behalf, with no user involved — RFC 6749 §1.3.4 permits it
"when the authorization scope is limited to the protected resources under the control of the
client". Typical uses are service-to-service calls, background jobs and scheduled tasks. It
is the one grant in the specification with no resource owner in it, which is why there is no
consent screen and no browser redirect.

**★ Why is there no refresh token?**
Because §4.4.3 forbids one — "the authorization server MUST NOT issue a refresh token" — and
the reason is that a refresh token substitutes for an absent resource owner's consent. Here
no resource owner was ever present, and the client still holds its own credentials, so it
can obtain a new access token at any time. A refresh token would be a second long-lived
credential conferring exactly what the client secret already confers, with nothing gained
and more surface to leak.

**★ How do you renew the token then?**
Request a new one, and cache aggressively in between. Cache per client registration for the
token's lifetime minus a margin, so the authorization server is not on the path of every
outbound call and a token never expires in flight. In Spring, `OAuth2AuthorizedClientManager`
with a `clientCredentials` provider does this, and the provider's `clockSkew` is the renewal
margin.

**★ A batch job uses a client-credentials token to read one customer's orders. What is
wrong?** The token carries no user's authority. §1.3.4 limits the grant to resources under
the client's own control, and nothing in this token says any customer consented to anything —
so the job is asserting a permission that was never granted, with no consent record and no
audit trail naming a person. If the job genuinely acts for a user, it needs a token obtained
on that user's behalf: an authorization-code grant with offline access, or token exchange
(RFC 8693) from a user token it already holds. If it genuinely acts for the organisation,
say so explicitly and scope it to organisation-level resources rather than per-customer
reads.

**★ Can a single-page application use client credentials?**
No. The grant is client authentication, and an SPA is a public client that cannot hold a
credential — RFC 6749 §2.3 also forbids the authorization server from relying on public
client authentication to identify the client. Any SPA "using client credentials" has shipped
a client secret to every browser, and anyone can extract it and mint tokens with that
client's full scope.

**★ What does `sub` contain on a client-credentials token?**
The client, not a person — usually the `client_id` or a service-account subject, and
sometimes nothing at all. It is provider-specific, which matters because code that treats
`sub` as a user identifier will silently mis-attribute machine traffic. Determine how your
provider marks machine tokens and handle that case explicitly.

**★ What is the risk of one shared service account across all internal services?**
Its scope list becomes the union of what every service ever needed, so a compromise anywhere
grants everything; nothing is attributable, because every call looks identical in the audit
log; and revocation or rotation is all-or-nothing across the fleet. It is the machine
equivalent of a shared admin password. One registration per calling service, scoped to what
that service actually calls.

---

← [Topic index](README.md) · Next → [Why not just an API key](02-why-not-just-an-api-key.md)
