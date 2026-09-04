---
title: "Every concrete thing a client wants from inside an access token has a supported source outside it, and the four places teams reach into the token are the four places to replace with a contract"
sidebar_label: "02b · What parsing costs you"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §5.1 (Successful Response) and §3.3 (Access Token
> Scope) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9068 §6
> (Privacy Considerations) and §2.2 (Data Structure)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9068.txt)); OpenID Connect Core 1.0 §2
> (ID Token) ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html));
> Spring Security 7.x reference — OAuth 2.0 Client, Authorized Clients
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/authorized-clients.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**[02](02-the-access-token-is-opaque-by-contract.md) argued the rule. This chunk is the
practical half: teams do not parse access tokens out of malice, they parse them because they
needed a fact and the token was the nearest place holding it. There are exactly four such
facts in practice, each has a supported alternative, and knowing the alternative is what
turns "don't do that" into a code review someone can act on.**

## The four reaches, and what to do instead

| What the client wanted | Where it reached | What it should use |
|---|---|---|
| "When does this expire, so I can refresh early?" | the `exp` claim | `expires_in` from the token response (RFC 6749 §5.1) |
| "What is this token allowed to do, so I can hide a button?" | the `scope` claim | the `scope` **response parameter** (RFC 6749 §5.1 / §3.3) — or better, ask the API |
| "Who is the user, so I can show their name?" | `sub`, `email`, `name` claims | the **ID token**, or the UserInfo endpoint |
| "Which tenant/org is this, so I can route?" | a vendor claim like `org_id` | the client's own configuration, or the API's response |

Each row is a coupling being traded for a contract. Work through them.

### 1 · Expiry

RFC 6749 §5.1 defines the field whose entire purpose is telling the client this:

> *"expires_in — RECOMMENDED. The lifetime in seconds of the access token. For example, the
> value `3600` denotes that the access token will expire in one hour from the time the
> response was generated."*

It is `RECOMMENDED`, not `REQUIRED`, and the spec says what to do when it is missing:
*"If omitted, the authorization server SHOULD provide the expiration time via other means or
document the default value."* So a robust client handles absence — but by falling back to a
configured default, not by opening the token.

Spring Security already does exactly this. `OAuth2AccessToken` carries `issuedAt` and
`expiresAt` computed from the response, and the refresh provider compares against them with
a skew:

```java
// RefreshTokenOAuth2AuthorizedClientProvider (Spring Security 7.x)
private Duration clockSkew = Duration.ofSeconds(60);

private boolean hasTokenExpired(OAuth2Token token) {
    Instant expiresAt = token.getExpiresAt();
    return expiresAt != null && this.clock.instant().isAfter(expiresAt.minus(this.clockSkew));
}
```

That is the whole mechanism: "expired" means "within 60 seconds of the expiry the AS told
us about". No claim is read. Note the second consequence — `expiresAt` can be `null`, and
the provider then treats the token as *not* expired and never refreshes. If your AS omits
`expires_in`, configure a default rather than letting that branch decide for you.

### 2 · Scope

RFC 6749 §5.1 defines `scope` as a response parameter with a conditional requirement:

> *"scope — OPTIONAL, if identical to the scope requested by the client; otherwise,
> REQUIRED. The scope of the access token as described by Section 3.3."*

That conditional is the important bit and it catches people: **if the AS grants exactly what
you asked for, it is entitled to omit `scope` entirely.** A client that reads
`tokenResponse.getScopes()` and finds it empty has not been granted nothing — it has been
granted what it asked for. Spring's refresh client handles precisely this:

```java
// RestClientRefreshTokenTokenResponseClient (Spring Security 7.x)
if (CollectionUtils.isEmpty(accessTokenResponse.getAccessToken().getScopes())) {
    tokenResponseBuilder.scopes(grantRequest.getAccessToken().getScopes());
}
```

An empty `scope` on a refresh response means "same as before", so it copies the previous
token's scopes forward. Your own code needs the same rule if it tracks scopes.

And the deeper point: **a client should not be making authorization decisions from scope at
all.** Scope tells the client what it asked for and got; it does not tell the client what
the *user* may do. Hiding a button because a scope is absent is a UX nicety that will
disagree with the API sooner or later, because the API applies user authorities too. The
`scope` versus `role` versus permission argument belongs to **10 · Method security**
*(not written yet)*; the rule here is narrower — get scope from the response, and treat it
as advisory.

### 3 · Identity

This is the reach with the strongest alternative, because OIDC exists to provide it. The ID
token is a JWT *by specification* (OIDC Core §2) and the client is its intended reader. In
Spring:

```java
@GetMapping("/me")
public String me(@AuthenticationPrincipal OidcUser user) {
    String subject = user.getSubject();       // "sub" — stable, from the ID token
    String name    = user.getFullName();      // "name" — present when `profile` was granted
    return name + " (" + subject + ")";
}
```

If the claim you need is not in the ID token, the UserInfo endpoint is the second supported
source and the client calls it with the access token. Neither route requires opening the
access token. RFC 9068 §2.2.2 even explains why identity claims land in access tokens at
all — so the *resource server* can use them *"without any further round trips to
introspection […] or UserInfo […] endpoints"*. The beneficiary named is the resource server.
Not the client.

### 4 · Tenant / routing

A client that inspects a vendor claim like `org_id` or `tid` to decide which backend to call
has embedded the AS's tenancy model into the client. That is the most brittle of the four,
because vendor claim names are not standardised at all and change across product tiers. The
answer is that routing is configuration, or it is something the API tells you — never
something you infer from a credential.

## What the coupling actually costs, in order of pain

1. **You cannot change identity providers.** Every migration — Keycloak to Entra ID, Auth0
   to Cognito — becomes a client rewrite, because claim names differ and the format may
   differ. This is the cost that turns up years later in a procurement conversation.
2. **You cannot turn on token encryption.** RFC 9068 §6 lists encrypting the access token as
   a first-class privacy measure. If clients parse tokens, security cannot use it.
3. **You cannot shrink the token.** Removing a claim to get under a header size limit — a
   real and common operational fix — becomes a breaking change to deployed mobile apps.
4. **Mobile clients cannot be rolled forward.** A server you can redeploy in minutes; an app
   in users' hands you cannot. The parsing client is the one that pins the whole system.
5. **Your logs now contain claims.** Decoding for "debugging" puts `sub`, entitlements and
   sometimes email into log aggregation, which is a separate incident class.

## The one legitimate exception, and its boundary

A single deployable that is *both* the client and the resource server — a classic
server-rendered Spring MVC app calling its own API in-process — may read the token, because
in that role it is the resource server. The boundary is precise: it reads the token because
it is the **audience**, having validated `aud` against itself, not because it holds it.
The moment that code is extracted into a service that forwards the token elsewhere, the same
line becomes a violation. Write it as resource-server code (a `JwtAuthenticationToken`), not
as client code reaching into `OAuth2AccessToken`, and the distinction stays visible.

## Gotchas

**★ `expires_in` is `RECOMMENDED`, not `REQUIRED` — handle its absence.**
RFC 6749 §5.1 permits an AS to omit it and to *"document the default value"* instead. Spring
will then leave `expiresAt` null and `RefreshTokenOAuth2AuthorizedClientProvider` will never
consider the token expired, so it will never proactively refresh — you will only discover
expiry through 401s from the API.

**★ An absent `scope` in the response means "exactly what you asked for", not "nothing".**
The RFC makes `scope` OPTIONAL *"if identical to the scope requested by the client"*. Client
code that treats an empty scope set as "no permissions" will disable its own UI on every
successful, fully-granted token.

**★ `expires_in` is relative to when the response was *generated*, not when you parsed it.**
Network latency, a queued response and a slow JSON parse all eat into it. Compute
`expiresAt = responseReceivedAt + expires_in` and then subtract a skew — Spring uses 60
seconds by default. Treating `expires_in` as if the clock started when your code ran is how
you get 401s at the boundary.

**★ Reading the token "just for a metric" is still reading the token.**
Emitting `token.claim("tid")` as a metric dimension has the same coupling and the same
cardinality-plus-privacy problem. If you need tenant on a metric, the client already knows
its tenant from configuration.

**★ Nimbus is on the classpath, so parsing is one line away and nothing stops you.**
`SignedJWT.parse(tokenValue).getJWTClaimsSet()` compiles, runs, and needs no key. This is
why the rule has to be a review rule: there is no compile error and no runtime failure until
the AS changes. Grep your client modules for `SignedJWT.parse`, `JWTParser`, and any manual
`split("\\.")` on a token value.

**★ "We validate the signature first, so it's safe" misses the point entirely.**
Signature validation addresses forgery. The prohibition is about *coupling*: a
correctly-signed token whose claim set changes shape still breaks you. And a client cannot
validate the signature properly anyway — it has no `aud` of its own to check against, so it
would be accepting any token from the issuer.

**★ Two Spring types, two contracts — let the type system carry the rule.**
`OAuth2AccessToken` deliberately has no claim accessors; `OidcIdToken` and `Jwt` do. If your
client code needs a `Jwt`, it is either the resource server (fine) or it is about to violate
the contract (not fine). The cast or the extra parse is the smell.

## Interview questions

**★ A client needs to refresh its access token 30 seconds before it expires. Where does it
get the expiry?**
From `expires_in` in the token response (RFC 6749 §5.1), recorded against the time the
response was received, never from an `exp` claim inside the token. Spring Security models
this on `OAuth2AccessToken.getExpiresAt()` and
`RefreshTokenOAuth2AuthorizedClientProvider` applies a configurable `clockSkew`, defaulting
to 60 seconds, so the token is treated as expired 60 seconds early. If the AS omits
`expires_in`, the correct fallback is a configured default that the AS has documented — the
spec says the AS *"SHOULD provide the expiration time via other means or document the default
value"* — not opening the token.

**★ Your SPA hides an admin button unless the access token contains `scope: admin`. What is
wrong, and what would you do instead?**
Three things. It parses the access token, which RFC 9068 §6 forbids. It reads scope from the
wrong place — `scope` is a response parameter, and the AS may legitimately omit it when the
grant matches the request, so the button vanishes on a fully-successful authorization. And
it confuses scope with authority: scope is what the *client* was allowed to ask for, not
what the *user* may do, so the UI will eventually disagree with what the API enforces. The
fix is to ask the API: an endpoint that returns the current user's capabilities, computed by
the same code that enforces them, so the UI and the enforcement cannot drift.

**★ Is there ever a legitimate reason for code you own to decode an access token?**
Yes — when that code is the resource server, which is the token's audience. RFC 9068 §4
defines a full validation algorithm for resource servers precisely because reading is their
job: verify `typ` is `at+jwt`, verify `iss` exactly matches the expected issuer, verify
`aud` contains an identifier for this resource server, verify the signature and reject
`alg: none`, and check `exp`. The distinction is role, not repository: a monolith that is
both client and RS may read the token in its RS role, and the same code becomes a violation
the moment it is deployed as a client that forwards tokens onward.

**★ What would you grep for in a code review to find this violation?**
On the client side: `SignedJWT.parse`, `JWTParser.parse`, `JwtDecoder` used on a value that
came from `OAuth2AccessToken.getTokenValue()`, `Base64` decoding of anything named `token`,
and any `split("\\.")` applied to a token string. Also any log statement or metric tag
sourced from a token claim. On the boundary: a `Jwt` or `JWTClaimsSet` type appearing in a
module whose role is client rather than resource server.

**★ The team argues that reading the token saves a network call to UserInfo, so it is a
performance optimisation worth the coupling. Respond.**
The premise is usually false and the conclusion is wrong either way. It is usually false
because the ID token already carries the profile claims when `profile` was granted, and the
client already has it — no network call is being saved. Where it is true, the saving is one
call per login, not per request, and it is bought with a dependency the client cannot
version, cannot negotiate and cannot roll back, on deployables (mobile apps) it cannot
update. If the round trip genuinely matters, the supported optimisation is for the client's
own backend to cache the profile keyed by `sub`.

---

← [Opaque by contract](02-the-access-token-is-opaque-by-contract.md) · [Topic index](README.md) · Next → [The token response](03-the-token-response.md)
