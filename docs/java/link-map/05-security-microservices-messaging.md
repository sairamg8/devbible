---
title: "Link map · Java · Part 5 (phases 13–14–15–16)"
sidebar_label: "05 · security microservices messaging"
sidebar_position: 5
---

# Link map · Java · Part 5 (phases 13–14–15–16)

Covers every topic row of `docs/java/syllabus/05-distributed.md` in phase 13 (T13-01 to T13-14, OAuth2, OIDC and service security), phase 14 (T14-01 to T14-12, microservice architecture), phase 15 (T15-01 to T15-14, messaging and event-driven architecture) and phase 16 (T16-01 to T16-13, resilience and operating the fleet). That is 53 rows. Written pages today: phase 13 rows 1–8, phase 14 rows 1, 2 and 4 (the other phase 14 topic directories hold only a `_plan.md`), nothing in phases 15 and 16.

*read* = I read the passage; *headings only* = fetched with HTTP 200 and the page title checked, passage not read. Dates are given only where the page shows one. No `#anchors` are given.

🔴 **Search caveat.** No WebSearch was available to the researcher or to the verification pass (the search budget was exhausted both times), so no topic was searched. Every pick is a well-known canonical source that was fetched directly with HTTP 200 and its text checked. Where a "Beyond the docs" line is missing, either no candidate I could name was fetchable, or I did not reach one; it does not mean none exists. Baeldung and Netflix Tech Blog pages returned 403 to the fetcher and are not used; the GitHub page for ShedLock returns 403 to a plain fetch, so its README was read from the raw file instead. A re-run with search available would improve the third-party picks.

🔴 **Version note.** The syllabus targets **Java 25 LTS** (`docs/java/README.md`). Spring Security, Spring Kafka and Spring Cloud pages are the unversioned "current" reference pages as fetched on 2026-10-13, not pinned to the version our pages use. Resilience4j docs live on readme.io. The Kafka links point at the 4.3 docs, the latest series at fetch time; the unversioned `kafka.apache.org/documentation/` URL is only a JavaScript redirect stub. The OAuth browser-based-apps guidance is now a published RFC (10017, August 2026).

---

## Phase 13 — OAuth2, OIDC and service security

### T13-01 · Why OAuth2 exists — Understand · ✅ written `docs/java/pages/phase-13-oauth2-oidc/01-why-oauth2-exists/01-the-password-anti-pattern.md`
- **Read this:** [RFC 6749, The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749) · IETF · the introduction lists the problems of third parties storing the owner's password, which the spec was written to remove · covers our angle: **partial** — a spec, not a story · fetched 2026-10-13 (*read*)
- **Also good:** [OAuth 2.0](https://oauth.net/2/) · oauth.net · short map of the spec family and extensions · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Background](https://www.oauth.com/oauth2-servers/background/) · OAuth 2.0 Simplified (Aaron Parecki's book site) · opens with the pre-OAuth habit of handing a third-party app your password (the Twitter-stats-app example) and why those apps stored passwords in plain text; page shows no date · fetched 2026-10-13 (*read*)
- **Our delta:** the password anti-pattern told as the incident that forced the protocol, and "authorization is not authentication".

### T13-02 · The four roles — Master · ✅ written `docs/java/pages/phase-13-oauth2-oidc/02-the-four-roles/01-the-four-roles.md`
- **Read this:** [RFC 6749, The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749) · IETF · section 1.1 defines the four roles: resource owner, resource server, client and authorization server · covers our angle: **partial** — no SPA + Spring API + Keycloak mapping · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [OAuth 2 Simplified](https://aaronparecki.com/oauth-2-simplified/) · Aaron Parecki · explains the roles (client, resource server, resource owner) and the grant types in plain language; the page says it was updated from its July 2012 original to current best practice, and it now describes PKCE and the implicit flow as superseded · fetched 2026-10-13 (*read*)
- **Our delta:** mapping each role onto a concrete SPA, Spring API and Keycloak.

### T13-03 · Authorization code flow with PKCE — Master · ✅ written `docs/java/pages/phase-13-oauth2-oidc/03-authorization-code-pkce/01-the-flow-end-to-end.md`
- **Read this:** [PKCE](https://oauth.net/2/pkce/) · oauth.net · the extension in brief, with links to the RFC · covers our angle: **partial** — the step-by-step redirect is not here · fetched 2026-10-13 (*headings only*)
- **Also good:** [RFC 7636, PKCE](https://datatracker.ietf.org/doc/html/rfc7636) · IETF · the verifier/challenge definition · [RFC 9700, OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700) · IETF · the source for dropping implicit and password grants: it says the password grant MUST NOT be used and clients SHOULD NOT use the implicit grant · [Authorization Code Flow with Proof Key for Code Exchange (PKCE)](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) · Auth0 Docs · vendor page that narrates the redirect, `code_verifier` and `code_challenge` step by step · fetched 2026-10-13 (RFC 9700 and Auth0 *read*; RFC 7636 *headings only*)
- **Beyond the docs:** [Protecting Apps with PKCE](https://www.oauth.com/oauth2-servers/pkce/) · OAuth 2.0 Simplified (Parecki's book site) · the client makes a per-request secret and reuses it at the code exchange, so a stolen code is useless; recommends PKCE for every client type; page shows no date · fetched 2026-10-13 (*read*)
- **Our delta:** the whole flow narrated step by step, and why implicit and password are deprecated.

### T13-04 · Client credentials flow — Understand · ✅ written `docs/java/pages/phase-13-oauth2-oidc/04-client-credentials/01-the-grant-with-no-user.md`
- **Read this:** [Client Credentials](https://www.oauth.com/oauth2-servers/access-tokens/client-credentials/) · OAuth 2.0 Simplified · the machine-to-machine grant with a worked request · covers our angle: **partial** — client secret only · fetched 2026-10-13 (*read*)
- **Also good:** [RFC 7523, JWT Profile for OAuth 2.0 Client Authentication and Authorization Grants](https://datatracker.ietf.org/doc/html/rfc7523) · IETF · using a signed JWT as the client's credential, the basis of private-key JWT (OpenID Connect Core names the `private_key_jwt` method) · fetched 2026-10-13 (*headings only*)
- **Our delta:** private-key JWT as the better credential and service-scoped claims.

### T13-05 · The three tokens — Master · ✅ written `docs/java/pages/phase-13-oauth2-oidc/05-the-three-tokens/01-three-tokens-three-roles.md`
- **Read this:** [ID Tokens vs Access Tokens](https://oauth.net/id-tokens-vs-access-tokens/) · oauth.net · access tokens are for the API to inspect, ID tokens describe the login for the client to read, and ID tokens should never be sent to an API; page shows no date (*read*) · covers our angle: **partial** — nothing on refresh tokens · fetched 2026-10-13
- **Also good:** [RFC 7662, Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662) · IETF · the opaque-token side · [Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation) · Auth0 Docs · rotation and automatic reuse detection in a vendor's words · fetched 2026-10-13 (RFC 7662 *headings only*; Auth0 *read*)
- **Our delta:** the three tokens as three audiences, and where each one expires.

### T13-06 · JWT anatomy and validation — Master · ✅ written `docs/java/pages/phase-13-oauth2-oidc/06-jwt-anatomy-and-validation/01-encoded-not-encrypted.md`
- **Read this:** [RFC 8725, JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725) · IETF · the attack and validation checklist (section 3 lists algorithm verification, issuer and subject validation, and audience validation) · covers our angle: **partial** — no JWKS rotation recipe · fetched 2026-10-13 (*headings only*)
- **Also good:** [RFC 7519, JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519) · IETF · the claim definitions · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [JWT attacks](https://portswigger.net/web-security/jwt) · PortSwigger Web Security Academy · covers `alg` set to none, algorithm confusion and injected `jwk` and `jku` keys, with labs to try · fetched 2026-10-13 (*read*)
- **Also good (older):** [Critical vulnerabilities in JSON Web Token libraries](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/) · Auth0 blog · guest post by Tim McLean, the original `alg: none` and key-confusion write-up; the page notes an update on 2015-04-20 · fetched 2026-10-13 (*read*)
- **Our delta:** the missing `aud` check and key rotation through the JWKS endpoint.

### T13-07 · OpenID Connect — Understand · ✅ written `docs/java/pages/phase-13-oauth2-oidc/07-openid-connect/01-the-layer-oauth2-was-missing.md`
- **Read this:** [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) · OpenID Foundation · ID token claims and the UserInfo endpoint (errata set 2) · covers our angle: **partial** — discovery is a separate spec · fetched 2026-10-13 (*read*)
- **Also good:** [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) · OpenID Foundation · the `/.well-known/openid-configuration` document that providers MUST publish · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Identity, Claims, and Tokens: An OpenID Connect Primer, Part 1 of 3](https://developer.okta.com/blog/2017/07/25/oidc-primer-part-1) · Okta Developer blog · a readable primer on identity, claims, scopes and the id_token, access_token and refresh_token; vendor blog by Micah Silverman, July 25, 2017 · fetched 2026-10-13 (*read*)
- **Our delta:** why `issuer-uri` becomes one line of config.

### T13-08 · Spring Security as resource server — Master · ✅ written `docs/java/pages/phase-13-oauth2-oidc/08-spring-security-resource-server/01-what-the-starter-gives-you.md`
- **Read this:** [OAuth 2.0 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html) · Spring Security reference · `issuer-uri` autoconfiguration, key rotation and the `JwtAuthenticationConverter` · covers our angle: **partial** — Keycloak realm and resource roles are not covered · fetched 2026-10-13 (*read*)
- **Our delta:** the custom converter every Keycloak project ends up writing.

### T13-09 · Spring as OAuth2 client — Understand · 🔲 not written
- **Read this:** [OAuth 2.0 Client](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/index.html) · Spring Security reference · `oauth2Login` and client registrations · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Authorized Client Features](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/authorized-clients.html) · Spring Security reference · `OAuth2AuthorizedClientManager`, plus a `RestClient` Integration section (`OAuth2ClientHttpRequestInterceptor`) that adds the Bearer token and refreshes an expired one; this is the closest page to the syllabus row · fetched 2026-10-13 (*read*)
- **Our delta:** attaching tokens to outbound `RestClient` calls without hand-rolled refresh.

### T13-10 · Method security — Understand · 🔲 not written
- **Read this:** [Method Security](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html) · Spring Security reference · `@EnableMethodSecurity`, `@PreAuthorize` and SpEL · covers our angle: **partial** — no roles-vs-scopes-vs-permissions guidance · fetched 2026-10-13 (*read*)
- **Our delta:** one authorization layer, not three.

### T13-11 · Running vs buying the authorization server — Know · 🔲 not written
- **Read this:** [Keycloak documentation](https://www.keycloak.org/documentation) · Keycloak · the self-hosted option's own docs · covers our angle: **partial** — no honest operating-cost comparison · fetched 2026-10-13 (*headings only*)
- **Also good:** [Spring Authorization Server Reference](https://docs.spring.io/spring-authorization-server/reference/index.html) · Spring · the build-your-own option · fetched 2026-10-13 (*headings only*)
- **Our delta:** the cost of owning identity, set against Auth0, Cognito and Entra ID.

### T13-12 · Token relay across microservices — Understand · 🔲 not written
- **Read this:** [RFC 8693, OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) · IETF · swapping the caller's token for another, with delegation and impersonation semantics and an `audience` parameter naming the target service · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [TokenRelay GatewayFilter Factory](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/gatewayfilter-factories/tokenrelay-factory.html) · Spring Cloud Gateway · forwards the incoming access token to outgoing requests (relay, not exchange) · fetched 2026-10-13 (*read*)
- **Our delta:** `aud` per service as a blast-radius limiter.

### T13-13 · Sessions vs tokens, BFF pattern — Understand · 🔲 not written
- **Read this:** [RFC 10017, OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/html/rfc10017) · IETF, Best Current Practice, August 2026 · section 6.1 describes the Backend For Frontend (BFF) architecture, ranked first of its patterns by security · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Protecting Single Page Apps with Token Handler Pattern](https://curity.io/resources/learn/the-token-handler-pattern/) · Curity · a small backend does the token exchange and gives the SPA HTTP-only cookies, so script cannot read tokens; page shows "Last updated" 2024-03-28; vendor material · fetched 2026-10-13 (*read*)
- **Our delta:** why "JWT in localStorage" keeps failing security reviews.

### T13-14 · mTLS and workload identity — Know · 🔲 not written
- **Read this:** [SPIFFE Overview](https://spiffe.io/docs/latest/spiffe-about/overview/) · SPIFFE · workload identity through short-lived cryptographic identity documents (SVIDs) with automatic rotation · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [RFC 8705, OAuth 2.0 Mutual-TLS Client Authentication](https://datatracker.ietf.org/doc/html/rfc8705) · IETF · certificate-bound tokens · fetched 2026-10-13 (*headings only*)
- **Our delta:** where a service mesh does this for you (phase 16).

---

## Phase 14 — Microservice architecture

### T14-01 · Monolith first — Understand · ✅ written `docs/java/pages/phase-14-microservice-architecture/01-monolith-first/01-the-question-behind-the-question.md`
- **Read this:** [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) · Martin Fowler, 2015-06-03 · build a monolith first because boundaries are hard to predict early (*read*) · covers our angle: **partial** — no modular-monolith tooling · fetched 2026-10-13
- **Also good:** [Spring Modulith](https://docs.spring.io/spring-modulith/reference/) · Spring · module boundaries inside one deployable · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html) · Martin Fowler · what microservices buy and cost, with distribution and eventual consistency listed as the main costs · fetched 2026-10-13 (*read*)
- **Our delta:** the team-size threshold below which microservices only cost.

### T14-02 · Service boundaries from bounded contexts — Master · ✅ written `docs/java/pages/phase-14-microservice-architecture/02-service-boundaries/01-what-a-boundary-is.md`
- **Read this:** [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html) · Martin Fowler · the DDD idea behind a boundary · covers our angle: **partial** — nothing on splitting Order and Inventory by invariants · fetched 2026-10-13 (*read*)
- **Also good:** [Microservices](https://martinfowler.com/articles/microservices.html) · Martin Fowler and James Lewis · componentization and business capabilities · fetched 2026-10-13 (*headings only*)
- **Our delta:** the wrong-boundary tell, two services that always deploy together.

### T14-03 · Database-per-service — Understand · 🔲 not written
- **Read this:** [Pattern: Database per service](https://microservices.io/patterns/data/database-per-service.html) · microservices.io (Chris Richardson) · one private store per service · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Pattern: API Composition](https://microservices.io/patterns/data/api-composition.html) · microservices.io · the read-path answer to lost joins · [Pattern: Shared database](https://microservices.io/patterns/data/shared-database.html) · microservices.io · the alternative and its coupling · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Integration Database](https://martinfowler.com/bliki/IntegrationDatabase.html) · Martin Fowler, 2004-05-25 (page notes a 2015-07-01 update) · short note on why a database shared by several applications becomes deep coupling and is best avoided; the "just share the DB" trap in one paragraph · fetched 2026-10-13 (*read*)
- **Our delta:** duplicated reference data by design.

### T14-04 · Sync vs async as the coupling decision — Master · ✅ written `docs/java/pages/phase-14-microservice-architecture/04-sync-vs-async/01-coupling-is-the-decision.md`
- **Read this:** [Microservices](https://martinfowler.com/articles/microservices.html) · Martin Fowler and James Lewis · the communication-style discussion · covers our angle: **partial** — no availability arithmetic · fetched 2026-10-13 (*headings only*)
- **Also good:** [Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html) · Martin Fowler · distribution costs · fetched 2026-10-13 (*headings only*)
- **Our delta:** five 99.9% services in a call chain give about 99.5%.

### T14-05 · Inter-service REST that survives change — Understand · 🔲 not written
- **Read this:** [REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html) · Spring Framework reference · `RestClient` · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html) · Martin Fowler · ignore what you do not use · fetched 2026-10-13 (*headings only*)
- **Our delta:** breaking a consumer as a deploy-order deadlock.

### T14-06 · gRPC — Know · 🔲 not written
- **Read this:** [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/) · grpc.io · protobuf contracts and call types · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Deadlines](https://grpc.io/docs/guides/deadlines/) · grpc.io · fetched 2026-10-13 (*headings only*)
- **Our delta:** where REST wins back, browser and debug friction.

### T14-07 · API gateway with Spring Cloud Gateway — Understand · 🔲 not written
- **Read this:** [Spring Cloud Gateway](https://docs.spring.io/spring-cloud-gateway/reference/) · Spring Cloud · routes, predicates, filters · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Pattern: API Gateway / Backends for Frontends](https://microservices.io/patterns/apigateway.html) · microservices.io · fetched 2026-10-13 (*headings only*)
- **Our delta:** business logic creeping into the gateway as an anti-pattern.

### T14-08 · Service discovery — Understand · 🔲 not written
- **Read this:** [Service](https://kubernetes.io/docs/concepts/services-networking/service/) · Kubernetes · Services and DNS as the platform answer · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Spring Cloud Netflix Features](https://docs.spring.io/spring-cloud-netflix/reference/spring-cloud-netflix.html) · Spring Cloud Netflix · Eureka, the client-side style · fetched 2026-10-13 (*headings only*)
- **Our delta:** recognizing both because production has both.

### T14-09 · Centralized configuration — Know · 🔲 not written
- **Read this:** [Spring Cloud Config](https://docs.spring.io/spring-cloud-config/reference/) · Spring Cloud · config server and clients · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [The Twelve-Factor App: Config](https://12factor.net/config) · 12factor.net · config in the environment · fetched 2026-10-13 (*headings only*)
- **Our delta:** ConfigMaps and Secrets against Config Server, rotation without redeploy.

### T14-10 · Correlation across services — Understand · 🔲 not written
- **Read this:** [Trace Context](https://www.w3.org/TR/trace-context/) · W3C · the `traceparent` header · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Micrometer Tracing](https://docs.micrometer.io/tracing/reference/) · Micrometer · the Spring side · [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) · OpenTelemetry · fetched 2026-10-13 (*headings only*)
- **Our delta:** wiring trace ids through MDC.

### T14-11 · Consumer-driven contract testing — Understand · 🔲 not written
- **Read this:** [Pact Docs](https://docs.pact.io/) · Pact · consumer-driven contracts · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Spring Cloud Contract Reference](https://docs.spring.io/spring-cloud-contract/reference/) · Spring · the provider-side-first alternative · [Consumer-Driven Contracts: A Service Evolution Pattern](https://martinfowler.com/articles/consumerDrivenContracts.html) · Ian Robinson on martinfowler.com · the origin of the idea · fetched 2026-10-13 (*headings only*)
- **Our delta:** the contract as the provider's CI gate.

### T14-12 · The distributed monolith — Understand · 🔲 not written
- **Read this:** [Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html) · Martin Fowler · the costs that a bad split inherits · covers our angle: **partial** — the phrase itself is not used on this page or on Microservice Prerequisites · fetched 2026-10-13 (*read*)
- **Also good:** [Microservice Prerequisites](https://martinfowler.com/bliki/MicroservicePrerequisites.html) · Martin Fowler · fetched 2026-10-13 (*headings only*)
- **Our delta:** the tells and the honest fix, merge back or re-draw.

---

## Phase 15 — Messaging and event-driven architecture

### T15-01 · Why queues — Understand · 🔲 not written
- **Read this:** [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials) · RabbitMQ · work queues show load leveling and temporal decoupling · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [What is Amazon Simple Queue Service?](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) · AWS · a cloud queue's own framing · fetched 2026-10-13 (*headings only*)
- **Our delta:** the price list, eventual consistency, ordering, duplicates.

### T15-02 · RabbitMQ model — Master · 🔲 not written
- **Read this:** [Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx) · RabbitMQ · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Exchanges](https://www.rabbitmq.com/docs/exchanges) · RabbitMQ · [Consumer Acknowledgements and Publisher Confirms](https://www.rabbitmq.com/docs/confirms) · RabbitMQ · [Spring AMQP](https://docs.spring.io/spring-amqp/reference/) · Spring · fetched 2026-10-13 (*headings only*)
- **Our delta:** the poison message that loops forever without a DLQ.

### T15-03 · Kafka is a log, not a queue — Master · 🔲 not written
- **Read this:** [Introduction](https://kafka.apache.org/43/getting-started/introduction/) · Apache Kafka 4.3 docs · events and topics; states that events are not deleted after consumption, unlike traditional messaging · covers our angle: **partial** — partitions and offsets are on the Design page · fetched 2026-10-13 (*read*)
- **Also good:** [Design](https://kafka.apache.org/43/design/design/) · Apache Kafka 4.3 docs · the log, consumer position and delivery semantics · [Apache Kafka 101: events](https://developer.confluent.io/courses/apache-kafka/events/) · Confluent Developer course · a gentle start · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Apache Kafka as an Event-Driven Backbone for Service Architectures](https://www.confluent.io/blog/apache-kafka-for-service-architectures/) · Confluent blog · Ben Stopford, July 19, 2017 · the append-only log, partitions and key ordering, consumer groups, retention and compacted topics as a shared source for services; vendor material that advocates Kafka · fetched 2026-10-13 (*read*)
- **Our delta:** the model shift for queue thinkers.

### T15-04 · Producing from Spring — Understand · 🔲 not written
- **Read this:** [Spring for Apache Kafka](https://docs.spring.io/spring-kafka/reference/) · Spring · `KafkaTemplate` · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Producer Configs](https://kafka.apache.org/43/configuration/producer-configs/) · Apache Kafka 4.3 docs · `acks`, `enable.idempotence`, `linger.ms` · [Top 5 Things Every Apache Kafka Developer Should Know](https://www.confluent.io/blog/5-things-every-kafka-developer-should-know/) · Confluent blog · fetched 2026-10-13 (*headings only*)
- **Our delta:** keys decide partition, and therefore ordering.

### T15-05 · Consuming: groups, commits, lag — Understand · 🔲 not written
- **Read this:** [Consumer and Share Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/) · Apache Kafka 4.3 docs · `group.id`, `enable.auto.commit` and the rest of the consumer configuration · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Spring for Apache Kafka](https://docs.spring.io/spring-kafka/reference/) · Spring · listener containers and ack modes · fetched 2026-10-13 (*headings only*)
- **Our delta:** consumer lag as the health metric, and why a slow consumer stalls its partitions.

### T15-06 · Spring Kafka in practice — Understand · 🔲 not written
- **Read this:** [Non-Blocking Retries](https://docs.spring.io/spring-kafka/reference/retrytopic.html) · Spring Kafka · retry topics · covers our angle: **partial** — the retry-topic half only; `DefaultErrorHandler` is on the next page · fetched 2026-10-13 (*headings only*)
- **Also good:** [Handling Exceptions](https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html) · Spring Kafka · `DefaultErrorHandler`, back-off and dead-letter recovery · fetched 2026-10-13 (*headings only*)
- **Our delta:** one bad event must not stall a partition.

### T15-07 · Delivery semantics, honestly — Master · 🔲 not written
- **Read this:** [Kafka Message Delivery Guarantees](https://docs.confluent.io/kafka/design/delivery-semantics.html) · Confluent Documentation · at-most-once, at-least-once and exactly-once within Kafka Streams and transactional producers and consumers · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Exactly-once Semantics is Possible: Here's How Apache Kafka Does it](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/) · Confluent blog, published 2017-06-30, updated March 2025 · states the guarantee is within Kafka Streams' own processing, so external calls are not covered (*read*) · [Transactions in Apache Kafka](https://www.confluent.io/blog/transactions-apache-kafka/) · Confluent blog · fetched 2026-10-13 (*headings only*)
- **Our delta:** cross-system exactly-once as a lie you build around.

### T15-08 · Idempotent consumers — Master · 🔲 not written
- **Read this:** [Idempotent Receiver](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html) · Enterprise Integration Patterns · the pattern's definition · covers our angle: **partial** — no processed-events table or SQL · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Pattern: Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html) · microservices.io (Chris Richardson) · records processed message ids in a `PROCESSED_MESSAGES` table, or in the business entities, and uses the AccountDebited balance example for a non-idempotent consumer · fetched 2026-10-13 (*read*)
- **Our delta:** unique constraint as the enforcer, `SET status` against `balance += x`.

### T15-09 · The transactional outbox — Master · 🔲 not written
- **Read this:** [Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) · microservices.io · the message is stored in the same database transaction, then relayed by log tailing or a polling publisher (*read*) · covers our angle: **partial** — no Spring code · fetched 2026-10-13
- **Also good:** [Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) · Debezium documentation · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Reliable Microservices Data Exchange With the Outbox Pattern](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/) · Gunnar Morling, Debezium blog, 2019-02-19 · explains the dual-write problem first, then the outbox table read by log-based CDC into Kafka (*read*) · fetched 2026-10-13
- **Our delta:** the poller against CDC trade-off in a Spring service.

### T15-10 · Sagas — Understand · 🔲 not written
- **Read this:** [Pattern: Saga](https://microservices.io/patterns/data/saga.html) · microservices.io · choreography and orchestration · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Saga Design Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) · Microsoft Learn · compensating transactions · fetched 2026-10-13 (*headings only*)
- **Our delta:** worked on this bible's order, payment, inventory flow.

### T15-11 · Event design — Know · 🔲 not written
- **Read this:** [What do you mean by "Event-Driven"?](https://martinfowler.com/articles/201701-event-driven.html) · Martin Fowler, 2017-02-07 · names event notification, event-carried state transfer, event sourcing and CQRS as separate patterns (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none needed beyond Java examples.

### T15-12 · Schema evolution on the wire — Know · 🔲 not written
- **Read this:** [Schema Evolution and Compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) · Confluent Documentation · backward and forward compatibility · covers our angle: **partial** — Confluent specific · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Schema evolution in Avro, Protocol Buffers and Thrift](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html) · Martin Kleppmann, 05 Dec 2012 · how each format's encoding (tag numbers, field names) decides which schema changes old and new producers and consumers survive; format-level, not Schema Registry · fetched 2026-10-13 (*read*)
- **Our delta:** the consumer that crashes on a renamed field, caught at publish time.

### T15-13 · Spring Cloud Stream — Know · 🔲 not written
- **Read this:** [Spring Cloud Stream](https://docs.spring.io/spring-cloud-stream/reference/) · Spring · binder abstraction · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Our delta:** what it hides, and when plain Spring Kafka is clearer.

### T15-14 · Choosing the broker — Understand · 🔲 not written
- **Read this:** [Kafka vs RabbitMQ](https://aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/) · AWS · a side-by-side; vendor page · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [When to use RabbitMQ or Apache Kafka](https://www.cloudamqp.com/blog/when-to-use-rabbitmq-or-apache-kafka/) · CloudAMQP blog · written by a RabbitMQ host, so read with that bias in mind · [What is Pub/Sub?](https://docs.cloud.google.com/pubsub/docs/overview) · Google Cloud · fetched 2026-10-13 (*headings only*)
- **Our delta:** choose by access pattern, not fashion.

---

## Phase 16 — Resilience and operating the fleet

### T16-01 · Timeouts first, everywhere — Master · 🔲 not written
- **Read this:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · Amazon Builders' Library, now on AWS Builder Center · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) · Google SRE Book · fetched 2026-10-13 (*headings only*)
- **Our delta:** the default-is-infinite audit and a budget across hops.

### T16-02 · Retries without making it worse — Master · 🔲 not written
- **Read this:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · Amazon Builders' Library · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) · Microsoft Learn · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · Marc Brooker, AWS Architecture Blog, 2015-03-04 (page notes a May 2023 update) · compares Full, Equal and Decorrelated Jitter against plain backoff; jittered variants cut client work (*read*) · fetched 2026-10-13
- **Our delta:** retry amplification, three layers by three retries gives 27 requests.

### T16-03 · Circuit breakers with Resilience4j — Master · 🔲 not written
- **Read this:** [CircuitBreaker](https://resilience4j.readme.io/docs/circuitbreaker) · Resilience4j · states and thresholds · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html) · Martin Fowler · the idea itself · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Implementing a Circuit Breaker with Resilience4j](https://reflectoring.io/circuitbreaker-with-resilience4j/) · reflectoring.io, December 21, 2020 · worked Java examples of count-based and time-based breakers, fallback methods, events and metrics; written for Resilience4j 1.x · fetched 2026-10-13 (*read*)
- **Our delta:** fallbacks that degrade honestly.

### T16-04 · Bulkheads and rate limiting — Understand · 🔲 not written
- **Read this:** [Bulkhead](https://resilience4j.readme.io/docs/bulkhead) · Resilience4j · semaphore and thread-pool types · covers our angle: **partial** — nothing on virtual threads · fetched 2026-10-13 (*headings only*)
- **Also good:** [RateLimiter](https://resilience4j.readme.io/docs/ratelimiter) · Resilience4j · [Bulkhead pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead) · Microsoft Learn · fetched 2026-10-13 (*headings only*)
- **Our delta:** virtual threads change the math but not the principle.

### T16-05 · Composing the decorators — Understand · 🔲 not written
- **Read this:** [Getting Started](https://resilience4j.readme.io/docs/getting-started-3) · Resilience4j · the Spring Boot 2 and 3 starter page: annotations and AOP aspects, fallback methods and a stated aspect order · covers our angle: **partial** — the page's default order is Retry ( CircuitBreaker ( RateLimiter ( TimeLimiter ( Bulkhead ( Function ) ) ) ) ), which differs from the order in the syllabus row, so check before copying it · fetched 2026-10-13 (*read*)
- **Also good:** [Endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html) · Spring Boot · Actuator endpoints for the metrics · fetched 2026-10-13 (*headings only*)
- **Our delta:** the canonical decorator order.

### T16-06 · Load shedding and backpressure — Know · 🔲 not written
- **Read this:** [Using load shedding to avoid overload](https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload) · Amazon Builders' Library · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) · Google SRE Book · fetched 2026-10-13 (*headings only*)
- **Our delta:** bounded queues, an unbounded queue is a deferred OOM.

### T16-07 · Health checks that don't lie — Understand · 🔲 not written
- **Read this:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · Kubernetes · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Health Endpoint Monitoring pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring) · Microsoft Learn · fetched 2026-10-13 (*headings only*)
- **Our delta:** the readiness check that pings a dependency.

### T16-08 · Deploying without downtime — Understand · 🔲 not written
- **Read this:** [Blue Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html) · Martin Fowler · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Canary Release](https://martinfowler.com/bliki/CanaryRelease.html) · Martin Fowler · [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html) · Martin Fowler's site · [Graceful Shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html) · Spring Boot · fetched 2026-10-13 (*headings only*)
- **Our delta:** flag debt as real debt.

### T16-09 · Kubernetes for the Java developer — Understand · 🔲 not written
- **Read this:** [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) · Kubernetes · requests and limits · covers our angle: **partial** — nothing on `MaxRAMPercentage` or HPA warm-up · fetched 2026-10-13 (*headings only*)
- **Also good:** [Pods](https://kubernetes.io/docs/concepts/workloads/pods/) · Kubernetes · fetched 2026-10-13 (*headings only*)
- **Our delta:** limits against the JVM's heap sizing.

### T16-10 · Service mesh — Know · 🔲 not written
- **Read this:** [The Istio service mesh](https://istio.io/latest/about/service-mesh/) · Istio · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [What is a service mesh?](https://linkerd.io/what-is-a-service-mesh/) · Linkerd · fetched 2026-10-13 (*headings only*)
- **Our delta:** why a five-service shop does not need one.

### T16-11 · Observability across the fleet — Understand · 🔲 not written
- **Read this:** [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · Google SRE Book · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [The RED Method](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) · Grafana Labs blog · [Sampling](https://opentelemetry.io/docs/concepts/sampling/) · OpenTelemetry · fetched 2026-10-13 (*headings only*)
- **Our delta:** one incident, one trace id.

### T16-12 · Distributed locks and leader election — Know · 🔲 not written
- **Read this:** [ShedLock](https://github.com/lukas-krecan/ShedLock) · lukas-krecan on GitHub · keeps a scheduled task from running on several nodes at once; the lock is always released after `lockAtMostFor`, and a task that runs longer may be executed by more than one node (*read*, from the raw README because the GitHub page returns 403 to a plain fetch) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · Martin Kleppmann, 2016-02-08 · argues Redlock is unsafe for correctness because it has no fencing tokens (*read*) · fetched 2026-10-13
- **Our delta:** database locks over DIY Redis locks, and the lock as a design smell.

### T16-13 · Chaos engineering — When Needed · 🔲 not written
- **Read this:** [Principles of Chaos Engineering](https://principlesofchaos.org/) · principlesofchaos.org, last update March 2019 · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Also good:** [Chaos Mesh Overview](https://chaos-mesh.org/docs/) · Chaos Mesh · Kubernetes fault injection · fetched 2026-10-13 (*headings only*)
- **Our delta:** testing the resilience config before production does.
