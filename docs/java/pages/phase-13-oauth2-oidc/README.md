---
title: "Phase 13 — OAuth2, OIDC and service security"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: OAuth 2.0 + RFC 9700 best practice · OIDC 1.0 · Spring Security
> 7.x on Spring Boot 4.1.0 / Framework 7.0.8 / JDK 25.** Documentation-validated — every page names its sources on a
> `> Verified:` line (the RFCs — 6749, 6750, 7636, 9700 —
> openid.net specs, the Spring Security reference, jwt.io/RFC 7519 for JWT).
> No sandbox: pages carry config and code, never fabricated tokens or HTTP
> transcripts (illustrative token *structure* is labeled as such).

Phase 9 configured a JWT resource server; this phase teaches the protocol that
issued the token. OAuth2 is the most cargo-culted technology in backend work —
flows copied from blog posts, tokens validated by accident. These pages go
protocol-first: once you can narrate the authorization code flow from memory,
every framework config becomes readable.

🚧 **2 of 14 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Why OAuth2 exists](01-why-oauth2-exists/README.md)** | <span className="db-tier t-understand">Understand</span> | Delegated authorization; the password anti-pattern it killed |
| 02 | **[The four roles](02-the-four-roles/README.md)** | <span className="db-tier t-master">Master</span> | Resource owner, client, AS, RS — mapped onto your actual stack |
| 03 | **Authorization code flow with PKCE** *(not written yet)* | <span className="db-tier t-master">Master</span> | The one flow to know cold; why implicit and password died |
| 04 | **Client credentials flow** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Machine-to-machine tokens for service-to-service calls |
| 05 | **The three tokens** *(not written yet)* | <span className="db-tier t-master">Master</span> | Access, refresh (rotation), ID — and where each may appear |
| 06 | **JWT anatomy and validation** *(not written yet)* | <span className="db-tier t-master">Master</span> | RS256, `iss`/`aud`/`exp`, JWKS rotation, the classic attacks |
| 07 | **OpenID Connect** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The authentication layer; discovery makes config one line |
| 08 | **Spring Security as resource server** *(not written yet)* | <span className="db-tier t-master">Master</span> | `issuer-uri`, authorities mapping, the Keycloak converter |
| 09 | **Spring as OAuth2 client** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `oauth2Login`, `OAuth2AuthorizedClientManager` for outbound |
| 10 | **Method security** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `@PreAuthorize`, roles vs scopes vs permissions, one layer |
| 11 | **Running vs buying the AS** *(not written yet)* | <span className="db-tier t-know">Know</span> | Keycloak / Spring Authorization Server vs Auth0/Cognito/Entra |
| 12 | **Token relay across microservices** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Audience per service; the internal god-token anti-pattern |
| 13 | **Sessions vs tokens, honestly** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The BFF pattern; why "JWT in localStorage" fails review |
| 14 | **mTLS and workload identity** *(not written yet)* | <span className="db-tier t-know">Know</span> | SPIFFE, rotation — and where the mesh does it for you |

## Phase gate

Move on when you can whiteboard the authorization code + PKCE flow with every
redirect and back-channel call labeled, say which token appears where, and
explain why the API validates `iss`, `aud` and `exp` but never sees a refresh
token.

## Where this connects

- **[Phase 9](../phase-9-spring-boot/README.md)** topic 11 is the config this
  phase explains from the protocol up.
- **Phase 14's gateway** centralizes token validation at the edge;
  **Phase 16's mesh** owns topic 14's mTLS at scale.
- The [Node.js section](../../../nodejs/README.md) implements the same flows
  in Express — the protocol is identical, which is the point.
