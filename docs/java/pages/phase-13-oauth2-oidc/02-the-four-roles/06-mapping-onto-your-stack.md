---
title: "Six architectures you will actually be handed, with every component labelled — because the roles are easy in the abstract and the whole difficulty is that a real system contains three things that each look like they might be the client"
sidebar_label: "06 · Mapping onto your stack"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.1 (Roles), §2.1 (Client Types), §4.4 (Client
> Credentials Grant); RFC 9700 §2.1.1 (PKCE); RFC 8693 (*OAuth 2.0 Token Exchange*); and the
> Spring Security 7.x reference (OAuth2 Resource Server, OAuth2 Client) — at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6749) and
> [docs.spring.io/spring-security/reference](https://docs.spring.io/spring-security/reference/).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Everything so far has been definitions. This chunk is the exercise: six architectures,
each drawn as a table of components with a role and a client type against every one. Do this
on a whiteboard before you configure anything, because the configuration is derivable from
the labels and the arguments are always about the labels.**

## 1 · Server-rendered web application (Thymeleaf, Spring MVC)

| Component | Role | Client type | Notes |
|---|---|---|---|
| The person | Resource owner | — | |
| Browser | *(user agent — not a role)* | — | Holds a session cookie to the app |
| The Spring app | **Client** | **Confidential** | `oauth2Login`; holds the secret and the tokens |
| Keycloak / Entra / Auth0 | Authorization server | — | |
| A downstream API the app calls | Resource server | — | The app is also a *client* for that call |

The cleanest case, and the one to reach for. The browser never sees a token; the app keeps
a server-side session and holds the tokens itself. This is the BFF shape by default rather
than by effort.

## 2 · SPA + API, tokens in the browser

| Component | Role | Client type | Notes |
|---|---|---|---|
| The person | Resource owner | — | |
| React/Angular app | **Client** | 🔴 **Public** | Code + PKCE. No secret, ever |
| The Spring API | **Resource server** | — | Validates the token presented to it |
| Keycloak | Authorization server | — | |

The most-deployed shape and the one with the most sharp edges: the access token lives in
JavaScript, so any XSS is a token theft, and refresh tokens need rotation with reuse
detection to be defensible at all. RFC 9700 §2.1.1 makes PKCE a MUST here — the SPA is a
public client by §2.1's criterion, no matter who wrote it.

## 3 · SPA + BFF (the same product, done differently)

| Component | Role | Client type | Notes |
|---|---|---|---|
| React app | *(not a role)* | — | 🔴 Holds a **cookie**, never a token |
| The BFF | **Client** | **Confidential** | Does the flow, holds the tokens, adds them outbound |
| The Spring API | Resource server | — | Sees a token, from the BFF |
| Keycloak | Authorization server | — | |

The same product as case 2 with the client moved to a server you control. The SPA stops
being a client at all. XSS can now abuse the session but cannot steal a bearer token to
replay elsewhere. The cost is a hop, a session store and CSRF back in scope —
**13 · Sessions vs tokens, honestly** *(not written yet)*.

## 4 · Mobile app + API

| Component | Role | Client type | Notes |
|---|---|---|---|
| The person | Resource owner | — | |
| iOS/Android app | **Client** | 🔴 **Public** | Code + PKCE, in a system browser — not an embedded webview |
| The Spring API | Resource server | — | |
| Its own backend, if it has one | Separate **client** | Confidential | Two registrations, not one |

First-party changes nothing: §2.1 classifies native applications as public because the
binary is on the user's device. The mobile-specific rules — a system browser rather than an
in-app webview, so credentials are never in the app's process; and the `localhost` port
carve-out for the loopback redirect — come from that one fact.

## 5 · Service to service, no user anywhere

| Component | Role | Client type | Notes |
|---|---|---|---|
| Nobody | 🔴 **No resource owner** | — | This is why there is no consent and no refresh token |
| Service A | **Client** | Confidential | Client credentials grant, RFC 6749 §4.4 |
| Service B | Resource server | — | |
| Keycloak | Authorization server | — | |

The role map is genuinely different: §4.4 has no resource owner, so nothing is delegated.
The `sub` on the resulting token is the client, not a person, and any code expecting a human
identity will find one or the other of "the client id" and "nothing". Whether this is the
right choice at all is
[When you don't need it](../01-why-oauth2-exists/05-when-you-do-not-need-oauth2.md).

## 6 · Gateway in front, services behind

| Component | Role | Client type | Notes |
|---|---|---|---|
| Browser or mobile app | Client | Public | |
| API gateway | **Resource server** at the edge, and possibly a **client** onward | — | 🔴 Say which |
| Service A | Resource server | — | Must it re-validate? Decide and write it down |
| Service B | Resource server | — | |

The gateway is where role confusion does the most damage, because "the gateway handles
auth" is compatible with at least three designs: it validates and forwards the same token;
it validates and exchanges for a narrower one (RFC 8693); or it validates and forwards a
header the services trust. The third is safe only if the services are genuinely unreachable
except through the gateway, which is a network claim someone must own. Token relay and the
internal god-token anti-pattern are **12 · Token relay across microservices** *(not written
yet)*.

## The four questions that settle any diagram

Ask these about every box and the labels fall out:

1. **Does it hold protected resources and check a presented access token?** → resource
   server.
2. **Does it obtain or present tokens on someone's behalf?** → client. (A box can be both
   1 and 2 — most services are.)
3. **If it is a client, can it keep a secret from the person running it?** → confidential,
   otherwise public. §2.1's criterion, and no other consideration enters.
4. **Is there a human whose consent is being recorded?** → if not, there is no resource
   owner and you are in client credentials.

## The Spring configuration is derivable from the labels

Nothing here is a new decision — each starter follows from a role already assigned:

| Label | Starter | The bean you write |
|---|---|---|
| Resource server | `spring-boot-starter-oauth2-resource-server` | `SecurityFilterChain` with `oauth2ResourceServer` |
| Client, user-facing | `spring-boot-starter-oauth2-client` | `SecurityFilterChain` with `oauth2Login` |
| Client, outbound service call | `spring-boot-starter-oauth2-client` | `OAuth2AuthorizedClientManager` + a `RestClient` interceptor |
| Both | both starters | Two `SecurityFilterChain` beans, `@Order`ed, with distinct `securityMatcher`s |

🔴 **"Both" is the case that trips people.** Two chains in one application need explicit
`securityMatcher`s and an explicit order, or the first matching chain swallows every
request — typically the `oauth2Login` chain redirecting API calls to a login page instead of
returning `401`. The mechanics are **08 · Spring Security as resource server** *(being
written)*.

## Gotchas

**★ Three things in a typical stack look like the client; only one is.**
The browser, the SPA and the backend all "make requests". The client is the registered
application that obtains and presents tokens. Write down which, before configuring anything.

**★ A service that calls another service is a client, whatever else it is.**
Being a resource server does not make you a client. They are separate configurations, and
having `oauth2ResourceServer` gives you nothing outbound.

**★ "The gateway handles auth" describes three different architectures.**
Validate-and-forward, validate-and-exchange, and validate-and-inject-a-trusted-header have
very different properties. Name the one you have, and say whether downstream services
re-validate.

**★ A trusted header from the gateway is only as strong as the network.**
If any service is reachable without going through the gateway, a forged header is a full
authentication bypass. Someone must own that network claim, and it must be tested.

**★ In client credentials there is no user, so `sub` is not a person.**
Code that logs `sub` as a user id, or looks it up in a `users` table, will find a client
identifier or nothing. Handle machine callers explicitly.

**★ A mobile app must use the system browser, not an embedded webview.**
A webview inside the app puts the authorization server's login page in a process the app
controls, which recreates the credential exposure the redirect exists to prevent. It is also
why many providers reject webview user agents outright.

**★ Registering a mobile app and its backend as one client is a category error.**
They have different client types. One registration cannot be both public and confidential,
and the secret ends up in the app.

**★ Two `SecurityFilterChain` beans without matchers and order is the classic Spring
mistake.** API requests get redirected to a login page instead of receiving `401`. Give each
chain a `securityMatcher` and an explicit `@Order`.

**★ The BFF changes the role map, not just the token storage.**
In the BFF shape the SPA is not a client at all. If your diagram still labels it one, the
tokens are probably still reaching the browser and you have the costs of a BFF without its
benefit.

**★ "First-party" never appears in RFC 6749's role definitions.**
It is a useful business distinction — it may justify skipping a consent screen — and it
changes nothing about client type, grant choice or PKCE.

## Interview questions

**★ Walk me through the roles in a React SPA calling a Spring API through Keycloak.**
User is the resource owner; the React application is the client and it is public, because
anything shipped to a browser is readable by the user, so no client secret and PKCE is a
MUST under RFC 9700 §2.1.1; the Spring API is the resource server, validating the access
token presented to it; Keycloak is the authorization server. The browser is a user agent,
not a role. If the API calls a second service with a token, it is also a client for that
call.

**★ How does that change with a BFF?**
The SPA stops being a client. The BFF becomes the client — confidential, holding the secret
and the tokens — and gives the browser a session cookie instead. The API is still the
resource server but now receives its token from the BFF. The security gain is that no bearer
token is reachable from JavaScript, so XSS can abuse the session but cannot steal a portable
credential. The cost is an extra hop, a session store, and CSRF returning to scope.

**★ A service validates inbound tokens and also calls two downstream services with tokens.
How many roles does it play?** Two. It is a resource server for traffic arriving at it and a
client for traffic it originates. In Spring that is two starters and two distinct
configurations: `oauth2ResourceServer` on a `SecurityFilterChain` for inbound, and an
`OAuth2AuthorizedClientManager` with a `RestClient` interceptor for outbound. Neither implies
the other, and the commonest bug is assuming resource-server configuration gives you
outbound tokens.

**★ In the client credentials grant, who consents?**
Nobody. There is no resource owner in that flow — the client acts on its own behalf — so
there is no consent screen, no user interaction and no refresh token. It matters in code
because `sub` identifies the client rather than a person, and any user lookup on it will
fail or, worse, silently match nothing.

**★ Your gateway validates the JWT and forwards `X-User-Id` to services that trust it. Is
that acceptable?** Only if the services are genuinely unreachable except through the
gateway, and someone owns and tests that claim. Otherwise anyone who can route to a service
directly forges the header and becomes any user — a complete authentication bypass with no
cryptography involved. The safer designs are forwarding the original token so each service
validates it, or exchanging it for a narrower audience-scoped token per service under RFC
8693. If you keep the header approach, treat the network boundary as a security control with
an owner, a test and an alert.

**★ Why must a mobile app use the system browser rather than an embedded webview?**
Because an embedded webview runs inside the app's own process, so the app can read the
credentials the user types into the authorization server's login page — which is precisely
the exposure the redirect model exists to eliminate. The system browser keeps the login in a
context the app cannot inspect, and it lets the user see the real address bar and reuse an
existing session. Many providers refuse webview user agents for this reason.

**★ What four questions do you ask to label an unfamiliar architecture?**
Does the box hold protected resources and check presented access tokens — if so it is a
resource server. Does it obtain or present tokens on someone's behalf — if so it is a
client, and a box can be both. If it is a client, can it keep a secret from the person
running it — confidential if yes, public if no, and nothing else bears on that. And is there
a human whose consent is being recorded — if not, there is no resource owner and you are in
client credentials.

---

← [Registration and redirect URIs](05-registration-and-redirect-uris.md) · [Topic index](README.md) · Next topic → [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md)
