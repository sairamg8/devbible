---
title: "OAuth2 has exactly four roles because the whole point was to break apart one party that used to be three — and almost every confused conversation about OAuth2 is two people who have silently assigned the same component to different roles"
sidebar_label: "01 · The four roles"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.1 (Roles), §1.2 (Protocol Flow), §2.1 (Client
> Types), §2.2 (Client Identifier) and the Abstract, at
> [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Before OAuth2 there was one party on the far side of the wire: "the server". It stored your
password, checked it, held your data and decided who could read it. OAuth2's contribution is
to split that party into three — an authorization server that authenticates and issues, a
resource server that holds data and checks, and a client that acts — with the human as a
fourth role that grants rather than performs. Four roles is not a taxonomy exercise; it is
the separation that makes delegation expressible at all. And in practice, the single most
common source of confusion in an OAuth2 design discussion is that two engineers have
assigned the same running process to different roles without noticing.**

## The definitions, verbatim

RFC 6749 §1.1 defines all four. They repay reading slowly, because each is defined by a
**capability**, not by a deployment shape:

- **Resource owner** — *"An entity capable of granting access to a protected resource. When
  the resource owner is a person, it is referred to as an end-user."*
- **Resource server** — *"The server hosting the protected resources, capable of accepting
  and responding to protected resource requests using access tokens."*
- **Client** — *"An application making protected resource requests on behalf of the resource
  owner and with its authorization."*
- **Authorization server** — *"The server issuing access tokens to the client after
  successfully authenticating the resource owner and obtaining authorization."*

## Read each definition for the word that is doing the work

**Resource owner: "capable of granting".** Not "the user", not "the person who owns the
account" — *the entity that can grant access*. This is why the client credentials grant is
coherent despite having no human anywhere: the client is acting on its own behalf, and there
simply is no resource owner in that flow. It is also why "resource owner" is not a synonym
for "end-user": §1.1 says a resource owner is *called* an end-user when it happens to be a
person, which implies it need not be.

**Resource server: "using access tokens".** The definition builds the token in. A resource
server is defined by *how* it makes its decision — by presented access token — not by what
it stores. An API that checks a session cookie is not playing the resource-server role, even
if it serves exactly the same JSON.

**Client: "on behalf of the resource owner and with its authorization".** Both halves are
load-bearing. *On behalf of* is delegation; *with its authorization* is consent. A component
that acts on its own behalf with nobody's permission is not a client in this sense — which
is exactly the ambiguity the client credentials grant lives in, and why that grant feels
different from the others.

**Authorization server: "after successfully authenticating the resource owner".** The
authentication event is *in the definition of the AS*, and nowhere else. This is the
sentence that settles the argument in
[01 · Authorization is not authentication](../01-why-oauth2-exists/02-authorization-is-not-authentication.md):
somebody authenticates the user, and it is structurally the authorization server, not the
client.

## Why four and not three

Collapse any two and something you need disappears:

| Collapse | What you lose |
|---|---|
| **AS + RS into one** | Nothing, technically — this is legal and common. What you lose is the ability to have many resource servers trust one issuer, which is the whole basis of SSO across services. |
| **AS + client** | The client is now authenticating the user, which is the anti-pattern the framework exists to remove. |
| **Client + resource owner** | This is not a collapse but a *legitimate* case — the client credentials grant. Note that consent vanishes with it. |
| **Client + RS** | The component both holds the data and acts on the owner's behalf, so there is nothing to delegate. You have a first-party application, and probably do not need OAuth2 — see [When you don't need it](../01-why-oauth2-exists/05-when-you-do-not-need-oauth2.md). |

🔴 **Only the AS/RS collapse is routine, and it is worth naming when it happens.** A single
Spring Boot application can issue and validate its own tokens. It works. What it forecloses
is the moment a second service needs to trust the same tokens, at which point you discover
your issuer is an application rather than an issuer.

## The map, with the six steps drawn on it

RFC 6749 §1.2 sequences the roles as steps (A)–(F). Assign each step an actor and the map
falls out:

| Step | From | To | What moves |
|---|---|---|---|
| (A) | Client | Resource owner *(preferably via the AS)* | The authorization request |
| (B) | Resource owner | Client | The authorization grant |
| (C) | Client | **Authorization server** | The grant, plus client authentication |
| (D) | Authorization server | Client | The access token |
| (E) | Client | **Resource server** | The access token, with the API request |
| (F) | Resource server | Client | The protected resource |

🔴 **The authorization server and the resource server never talk to each other in this
diagram.** Not in step (D), not in step (F). The resource server learns to trust the token
out-of-band — by fetching the issuer's public keys once and caching them, or by calling an
introspection endpoint, both of which are outside the flow. That absence is the design
feature that lets one AS serve fifty resource servers it has never heard of, and it is the
thing a whiteboard diagram most often gets wrong by drawing an arrow that does not exist.

**And note step (A)'s parenthesis: "preferably indirectly via the authorization server as an
intermediary".** The word *preferably* in 2012 became normative practice later: the user
interacts with the AS, in the AS's own browser context, and the client never sees the
credentials. A design where the client collects them is the resource-owner-password grant,
which RFC 9700 §2.4 now says MUST NOT be used.

## One process, several roles — the thing that actually confuses people

Roles are **per-interaction**, not per-deployable. A single Spring Boot service routinely
plays two:

```java
// The SAME application, in two roles, in two beans.

// ROLE: resource server — it validates tokens presented to IT.
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .authorizeHttpRequests(a -> a.anyRequest().hasAuthority("SCOPE_orders:read"))
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .build();
}

// ROLE: client — it obtains and presents tokens to SOMEONE ELSE.
@Bean
RestClient inventoryClient(OAuth2AuthorizedClientManager manager) {
    return RestClient.builder()
        .baseUrl("https://inventory.internal")
        .requestInterceptor(bearerTokenFrom(manager))   // outbound token
        .build();
}
```

When someone says "the service uses OAuth2", ask **which direction**. Inbound token
validation and outbound token acquisition are different roles, different configuration,
different failure modes, and different chapters — inbound is
[08 · Spring Security as resource server](../08-spring-security-resource-server/README.md), outbound is
**09 · Spring as OAuth2 client** *(not written yet)*.

## Gotchas

**★ "Client" means the application, never the human, and never the browser.**
This is the single most common vocabulary error. In everyday usage the client is the person
or the front end; in OAuth2 the client is *the registered application making the request*,
identified by a `client_id`. The browser is a **user agent** — it carries the front channel
and is not a role at all.

**★ Your React SPA is a client. Your Spring API is a resource server. They are not the same
thing having a front and a back.** Treating them as one application is how audience
validation and token storage both end up nowhere.

**★ One deployable can be two roles at once, and usually is.**
A service that validates inbound tokens *and* calls another service with an outbound token
is a resource server and a client simultaneously. Neither configuration implies the other,
and having one does not give you the other.

**★ The resource owner is not always a person.**
§1.1 says "when the resource owner is a person, it is referred to as an end-user" — the
qualifier is deliberate. In client credentials there is no resource owner at all, which is
why there is no consent screen and no refresh token in that grant.

**★ The AS and RS do not communicate during the flow.**
Any diagram with an arrow from the resource server to the authorization server *inside* the
six steps is wrong. Trust is established out of band, before or beside the flow — JWKS fetch
or introspection. Drawing the arrow leads to designs that make the AS a synchronous
dependency of every API call.

**★ `client_id` is not a secret and must never be treated as one.**
§2.2: it *"is not a secret"* and *"MUST NOT be used alone for client authentication"*. It is
visible in every authorization URL by construction. A design that treats a `client_id` as a
credential is broken at the specification level.

**★ Merging the AS into your application is legal and quietly limiting.**
It works until a second service must trust the same tokens. Then your issuer is an
application with an application's deploy cadence, uptime and key management. Decide it
deliberately — **11 · Running vs buying the AS** *(not written yet)*.

**★ "The API talks to the identity provider on every request" is usually a design smell.**
It describes introspection, which is a legitimate choice with real costs — latency on every
call and a hard AS dependency. If it was not chosen deliberately, it is often a
misunderstanding of the role map.

**★ A gateway is not a role.**
An API gateway may act as a resource server (validating at the edge), as a client (calling
downstream with a token), or as neither (passing bytes through). Say which, because "the
gateway does OAuth2" describes three different security postures — **12 · Token relay**
*(not written yet)*.

## Interview questions

**★ Name the four OAuth2 roles and define each in one sentence.**
The **resource owner** is the entity capable of granting access to a protected resource,
called an end-user when it is a person. The **client** is the application making protected
resource requests on the resource owner's behalf and with their authorization. The
**authorization server** issues access tokens to the client after authenticating the
resource owner and obtaining authorization. The **resource server** hosts the protected
resources and accepts requests using access tokens. Each is defined by a capability, not by
a deployment shape.

**★ In a React SPA calling a Spring Boot API, with Keycloak as the identity provider, who is
who?** The user is the resource owner; the React application is the client (a public one —
it cannot keep a secret); Keycloak is the authorization server; the Spring Boot API is the
resource server. The browser is a user agent, not a role. If the Spring API in turn calls a
second internal service with a token, it is *also* a client for that call.

**★ Can one deployable be more than one role?**
Yes, and it usually is. A Spring service validating inbound access tokens is a resource
server; the same service calling a downstream API with an outbound token is a client; and a
Spring Authorization Server embedded in the same application would make it an AS too. Roles
are per-interaction. It matters because the configuration, the failure modes and the
security review questions are different for each.

**★ Why doesn't the resource server call the authorization server during the flow?**
Because the trust relationship is established out of band, not per request. The resource
server either fetches and caches the issuer's public keys and verifies signatures locally,
or calls an introspection endpoint — and the second is a deliberate trade of latency and
availability for immediate revocation. Keeping the AS off the per-request path is what lets
one authorization server serve many resource servers, including ones it does not know about.

**★ Where does the user actually authenticate, and to whom?**
At the authorization server, in the authorization server's own browser context. RFC 6749
§1.1 puts it in the AS's definition: it issues tokens "after successfully authenticating the
resource owner and obtaining authorization". The client is not in the room and does not
learn the result — which is exactly why OIDC's ID token had to be invented.

**★ Is `client_id` a credential?**
No. RFC 6749 §2.2 states it "is not a secret" and "MUST NOT be used alone for client
authentication". It appears in the authorization URL in the user's browser on every flow, so
it cannot be. Authentication of a confidential client is a separate mechanism — a client
secret, a signed assertion, or mTLS.

**★ What breaks if you merge the authorization server into your API?**
Nothing immediately — it is a legal and common arrangement. What you lose is the ability for
other services to trust the same issuer independently, which is the basis of SSO and of
service-to-service token relay. You also couple key rotation, availability and deploy
cadence of your identity system to one application's release cycle. Merge deliberately, and
know it is the decision you will revisit when the second service arrives.

**★ In the client credentials grant, who is the resource owner?**
Nobody. There is no resource owner in that flow — the client acts on its own behalf. That is
why there is no consent screen, no user interaction, no refresh token, and why any code
expecting a `sub` that identifies a person will get either a client identifier or nothing.
It is the clearest demonstration that "resource owner" is a role that may be absent, rather
than a synonym for "user".

---

← [Topic index](README.md) · Next → [Confidential vs public](02-confidential-and-public-clients.md)
