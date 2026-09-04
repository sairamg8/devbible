---
title: "UserInfo is the one place in OIDC where your client presents an access token, which makes it the one place where the ID token's audience rule does not protect you — and the cross-check that closes the gap is a single comparison almost nobody writes"
sidebar_label: "07 · The UserInfo endpoint"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §2 (`sub` as the Subject Identifier)
> and §3.1.2.1, at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §3 (`userinfo_endpoint`, `claims_supported`), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 6750 §2.1 (Authorization Request Header Field), §3 (`WWW-Authenticate`)
> ([rfc-editor.org/rfc/rfc6750](https://www.rfc-editor.org/rfc/rfc6750.txt)); the Spring
> Security 7.x `OidcUserService` / `DefaultOAuth2UserService` behaviour
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
>
> ⚠️ **Provenance limit.** OIDC Core **§5.3 (UserInfo Endpoint)** and **§5.3.2 (Successful
> UserInfo Response)** could not be read in this pass — the published HTML truncates before
> §5 and two fetch attempts returned nothing for those sections. The `sub` cross-check
> described below is presented as **the well-established practice the specification's own
> `sub` semantics require**, not as a quotation from §5.3.2. Confirm the exact wording against
> your own copy of the specification before citing it in a review. Banked quotes:
> `research_java_p13_t07_oidc.md` in the memory store.

**UserInfo is a protected resource: your client calls it with the *access token*, and it
returns a JSON object of claims about the user who authorised that token. That one sentence
contains the whole reason this page exists. Everywhere else in OIDC your client works with the
ID token, whose `aud` is your own `client_id` — a token that is verifiably *for you*. At
UserInfo you are holding a bearer credential whose audience is the provider's UserInfo
endpoint, and the response is a plain JSON body with no signature and no audience of its own.
The binding back to the login you just performed is the `sub` claim, and comparing it to the
ID token's `sub` is the check that makes the response trustworthy.**

The second reason to read this page is a design question rather than a security one. Every
claim UserInfo returns *could* have been in the ID token, and providers differ on which are.
Calling UserInfo costs a network round trip on every login — and, if you use it for
freshness, on more than that. Knowing when it earns its cost is most of the practical value.

## What it is and how you call it

- **Protected resource**, not an identity endpoint you can call anonymously.
- **Credential: the access token**, presented as a bearer token in the `Authorization` header
  exactly as RFC 6750 §2.1 prescribes.
- **Location: `userinfo_endpoint`** in the discovery document. It is not a REQUIRED metadata
  member, so its absence means "this provider does not offer one", not "look somewhere else".
- **Response: a JSON object** whose `sub` identifies the user, plus whatever claims the
  granted scopes and the provider's policy allow.

```java
Map<String, Object> userInfo = restClient.get()
        .uri(metadata.getUserInfoEndpoint())
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken.getTokenValue())
        .retrieve()
        .body(new ParameterizedTypeReference<>() {});
```

That is the whole protocol. The interesting part is the line that has to come next.

## 🔴 The `sub` cross-check

```java
String idTokenSub = idToken.getSubject();
String userInfoSub = (String) userInfo.get("sub");

if (userInfoSub == null || !userInfoSub.equals(idTokenSub)) {
    throw new OAuth2AuthenticationException(
            "UserInfo sub does not match the ID token sub");
}
```

**Why it matters.** The ID token is bound to your client by `aud` and to your flow by `nonce`.
The UserInfo response has neither. It is an unsigned JSON body returned in exchange for a
bearer token — and a bearer token, by definition, says only that its holder may ask. If a
client sends the *wrong* access token (a stale one from a previous session, one belonging to
a different user in a mishandled cache, or one substituted by an attacker who obtained it),
UserInfo answers faithfully about *that* token's user. Nothing in the response says "this is
about the person who just logged in" except `sub`.

Because `sub` is defined in §2 as *"locally unique and never reassigned … within the Issuer"*,
the comparison is only meaningful together with the issuer — you are asserting that
`(iss, sub)` from the ID token equals `(same iss, sub)` from UserInfo. In a single-provider
application the issuer is fixed and the string comparison is enough; in a multi-provider one,
compare the pair.

Spring's `OidcUserService` performs this check for you when it fetches UserInfo during an
`oauth2Login` flow. **A hand-rolled call does not get it for free.**

## When it earns its round trip

| Situation | Call UserInfo? |
|---|---|
| The claims you need are already in the ID token | **No** — you have them, and the ID token is signed |
| The provider delivers `email`/`name` only from UserInfo | **Yes**, at login, once |
| You need current values rather than issue-time values | **Yes**, on demand — that is its distinguishing property |
| You want to check the user still exists / is not disabled | **Sometimes** — it is a weak signal; providers differ on whether a disabled user's token still resolves |
| A back-end service wants identity for a request | **No** — it has an access token and should validate that; identity for an API is [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md) |
| Every request, to "keep the profile fresh" | 🔴 **No** — this is the anti-pattern; you have added a synchronous dependency on the IdP to every page load |

The last row is the one that reaches production. UserInfo is not a cache-friendly endpoint —
its whole value is freshness — so calling it per request makes the identity provider a
hard dependency of your application's request path, with its latency and its availability.
Call it at login, persist what you need against `(iss, sub)`, and refresh on a schedule or on
an explicit user action.

## ID token versus UserInfo — the same claims, different properties

| | ID token claim | UserInfo claim |
|---|---|---|
| Integrity | signed by the issuer | none of its own; TLS to the endpoint |
| Audience | your `client_id`, checked | the endpoint; nothing ties the body to you |
| Freshness | issue time, frozen | current at the moment of the call |
| Cost | free — it already arrived | one HTTP round trip, plus the IdP's availability |
| Bound to your flow | yes, via `nonce` | only via the `sub` cross-check you write |
| Offline verification | yes | no |

The row worth memorising is the first. **An ID token is evidence you can re-verify later; a
UserInfo response is not.** If you need to be able to prove afterwards what the provider
asserted, keep the ID token; if you need to know what is true right now, call UserInfo.

## Gotchas

**★ The `sub` cross-check is missing from a hand-rolled client.**
Symptom: none, until an access token from a different user or a stale session is used and the
application attaches the wrong profile to a session. Cause: the UserInfo body has no audience
and no signature; `sub` is the only binding. Fix: the comparison above, and treat a mismatch
as an authentication failure rather than a warning.

**★ UserInfo is called with the ID token instead of the access token.**
Symptom: 401 with `invalid_token`, or — worse — success at a provider that is lax about which
token it accepts. Cause: two tokens arrived together and the wrong one was reached for. Fix:
UserInfo is a protected resource; it takes the access token. The ID token is never sent
anywhere.

**★ UserInfo is called on every request.**
Symptom: page latency tracking the identity provider's, and a total outage of your
application when the IdP is briefly unavailable. Cause: treating it as a profile lookup. Fix:
call it at login, persist against `(iss, sub)`, refresh deliberately.

**★ `userinfo_endpoint` is assumed present.**
Symptom: an NPE, or a login that fails against a provider that does not offer the endpoint.
Cause: it is not a REQUIRED discovery member. Fix: treat absence as "claims come from the ID
token only" and degrade.

**★ The response is parsed as a fixed record and a provider adds a field.**
Symptom: deserialisation failure after a provider release. Cause: strict binding against an
open-ended JSON object. Fix: read into a map, or disable failure on unknown properties — the
claim set is provider-specific and extensible by design.

**★ A 403 from UserInfo is read as "the user does not exist".**
Symptom: users incorrectly deprovisioned by a synchronisation job. Cause: RFC 6750 maps
insufficient scope to 403 with `insufficient_scope`, which is a statement about the *token*,
not about the user. Fix: distinguish the `WWW-Authenticate` error codes — `invalid_token` (401)
means get a new token, `insufficient_scope` (403) means ask for more scope, and neither means
the account is gone.

**★ Claims from UserInfo are merged over ID token claims without deciding precedence.**
Symptom: two sources disagree and which one wins depends on map iteration order. Cause: a
blind `putAll`. Fix: decide explicitly. The defensible default is that **the ID token wins for
identity** (`sub`, `iss`, `auth_time`, `acr`) because it is signed, and **UserInfo wins for
profile** (`name`, `picture`, `email`) because it is current.

```java
Map<String, Object> merged = new LinkedHashMap<>(userInfo);   // profile: fresher
merged.put("sub", idToken.getSubject());                      // identity: signed
merged.put("iss", idToken.getIssuer().toString());
```

**★ The UserInfo response is cached with a long TTL.**
Symptom: the endpoint's one advantage — freshness — is discarded while its cost is kept.
Cause: a generic HTTP cache in front of the call. Fix: if you want cached data, cache it in
your own store at login and skip the call entirely; do not pay a round trip for a stale
answer.

**★ UserInfo is called from a back-end service that received a bearer token.**
Symptom: an internal service that cannot start when the IdP is down, and a fan-out of IdP
traffic proportional to internal request volume. Cause: reaching for identity where
authorisation was needed. Fix: a resource server validates the access token locally and takes
what it needs from the token's claims; if it genuinely needs profile data, that belongs in a
service it owns, not in the identity provider.

**★ The endpoint is called over a connection with no timeout.**
Symptom: threads accumulating on a login path during an IdP slowdown, and a service that
degrades far worse than the dependency did. Cause: a default-configured HTTP client. Fix:
explicit connect and read timeouts, and a failure mode that completes the login with ID-token
claims only rather than failing it.

## Interview questions

**★ Which token do you send to UserInfo, and why does that choice have a security
consequence?**
The access token — UserInfo is a protected resource and RFC 6750's bearer scheme applies. The
consequence is that, unlike the ID token, nothing about the response is bound to your client:
there is no `aud`, no signature and no `nonce`. Whoever holds the access token gets an answer
about that token's user, so the client must tie the response back to the login it just
performed by comparing `sub` against the ID token's `sub`.

**★ What exactly does the `sub` cross-check defend against?**
Attaching the wrong user's profile to a session. A UserInfo body arrives unsigned and
unaddressed; if the access token used was stale, belonged to a different user through a cache
or session-handling bug, or was supplied by an attacker, the endpoint answers correctly about
*that* user and your client has no other signal that it is the wrong one. Comparing `sub` —
and, across multiple providers, `(iss, sub)` — is the only thing that binds the response to
the authentication that just happened.

**★ When is calling UserInfo the wrong choice?**
When the claims you need are already in the ID token, because you would be paying a round trip
for data you hold in signed form; and on every request, because that makes the identity
provider a synchronous dependency of your request path. The endpoint's distinguishing property
is freshness — call it when you specifically need current values, and otherwise persist what
you learned at login against `(iss, sub)`.

**★ A UserInfo claim and an ID token claim disagree. Which do you use?**
It depends what the claim is *for*. For identity — `sub`, `iss`, and the authentication facts
`auth_time` and `acr` — the ID token wins, because it is signed and re-verifiable and the
UserInfo body is neither. For profile attributes such as display name, picture or email,
UserInfo wins, because it reflects the present rather than issue time. What is not acceptable
is leaving the precedence to whichever map you merged into last.

**★ Can you verify a UserInfo response after the fact, the way you can re-verify an ID token?**
Not in the default case: the response is a plain JSON body whose only protection is the TLS
connection you fetched it over, so once the connection closes there is nothing to re-check.
The specification does allow a signed and/or encrypted UserInfo response as a JWT for clients
that register for it, which restores offline verifiability at the cost of configuration. If
you need durable evidence of what the provider asserted, the ID token is the artefact designed
for that.

**★ Your login latency doubles during an identity-provider incident even though tokens are
still being issued. What would you look at first?**
A UserInfo call on the login path with no timeout and no fallback. Token issuance and the
UserInfo endpoint can degrade independently, and a client that blocks on the second will
inherit its latency entirely. The fix is a short read timeout plus a degraded path that
completes the login using ID-token claims and refreshes the profile later.

**★ How would you decide whether your application should call UserInfo at all?**
List the claims the product actually needs, check `claims_supported` in the provider's
discovery document, then check which of them the provider puts in the ID token. If the
intersection covers the list, do not call it. If it does not, call it once at login and
persist. Add a periodic or event-driven refresh only if the product genuinely requires values
to be current rather than correct-at-login.

---

← [Standard scopes and claims](06-standard-scopes-and-claims.md) · [Topic index](README.md) · Next → **`sub` is not an email** *(not written yet)*
