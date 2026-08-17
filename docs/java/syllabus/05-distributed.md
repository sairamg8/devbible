---
title: "Part 5 — Distributed Java"
sidebar_label: "5 · Distributed"
sidebar_position: 5
---

> Phases 13–16 · OAuth2 and OIDC, microservice architecture, messaging, resilience

Everything before this part is one service done properly. This part is what
changes when there are ten of them: identity that crosses service boundaries,
communication that fails partially, data that no longer fits in one
transaction, and the resilience machinery that keeps a fleet degraded instead
of down. It deliberately mirrors this bible's Node.js microservices reference —
same patterns, Java's implementations.

---

## Phase 13 — OAuth2, OIDC and service security

Phase 9 configured a JWT resource server; this phase teaches the protocol that
issued the token. OAuth2 is the most cargo-culted technology in backend work —
flows copied from blog posts, tokens validated by accident. The syllabus goes
protocol-first: once you can narrate the authorization code flow from memory,
every framework config becomes readable.

| Topic | Tier |
|---|---|
| **Why OAuth2 exists**: delegated *authorization*, not authentication — the password anti-pattern it killed (give app B your app-A password), and why "login with Google" needed a protocol at all | <span className="db-tier t-understand">Understand</span> |
| **The four roles**: resource owner, client, authorization server, resource server — mapped concretely onto your SPA + Spring API + Keycloak, because every OAuth2 bug report starts by confusing two of them | <span className="db-tier t-master">Master</span> |
| **Authorization code flow with PKCE**, step by step: the redirect, the code, the back-channel exchange, the verifier/challenge pair — and why implicit and password grants are formally deprecated (RFC 9700, OAuth 2.1 direction). The one flow to know cold | <span className="db-tier t-master">Master</span> |
| **Client credentials flow** — machine-to-machine tokens for service-to-service calls: no user, no redirect, just a client secret (or better, private-key JWT) for a token with service-scoped claims | <span className="db-tier t-understand">Understand</span> |
| **The three tokens**: access (short-lived, for the API), refresh (long-lived, rotation and reuse detection), ID (OIDC, for the client's eyes only — never send it to your API). JWT vs opaque + introspection, and where each expires | <span className="db-tier t-master">Master</span> |
| **JWT anatomy and validation done right**: header/claims/signature, RS256 vs HS256 (asymmetric so the resource server holds no secret), `iss`/`aud`/`exp`/`nbf` checks, the **JWKS endpoint and key rotation**, and the classic attacks — `alg: none`, key confusion, missing `aud` check | <span className="db-tier t-master">Master</span> |
| **OpenID Connect**: the authentication layer on top of OAuth2 — ID token claims, the UserInfo endpoint, and the discovery document (`/.well-known/openid-configuration`) that makes `issuer-uri` config one line | <span className="db-tier t-understand">Understand</span> |
| **Spring Security as resource server**: `oauth2ResourceServer().jwt()`, `issuer-uri` autoconfiguration, mapping scopes and realm/resource roles into `GrantedAuthority` — the custom converter every Keycloak project ends up writing | <span className="db-tier t-master">Master</span> |
| Spring as OAuth2 *client*: `oauth2Login()` for server-rendered apps, client registrations, and `OAuth2AuthorizedClientManager` — attaching tokens to outbound `RestClient` calls without hand-rolling refresh | <span className="db-tier t-understand">Understand</span> |
| **Method security**: `@PreAuthorize` with SpEL, `@EnableMethodSecurity`, roles vs scopes vs fine-grained permissions — and why authorization logic belongs in one layer, not sprinkled across three | <span className="db-tier t-understand">Understand</span> |
| Running vs buying the authorization server: Keycloak and Spring Authorization Server vs Auth0/Cognito/Entra ID — the operational cost of owning identity stated honestly | <span className="db-tier t-know">Know</span> |
| **Token relay across microservices**: propagating the caller's token vs exchanging for a service token, audience per service (`aud` as the blast-radius limiter), and why forwarding one god-token everywhere recreates the password anti-pattern internally | <span className="db-tier t-understand">Understand</span> |
| **Sessions vs tokens, honestly**: when a server-side session is simpler *and* safer, the **BFF pattern** for SPAs (tokens never touch the browser), and why "JWT in localStorage" keeps failing security reviews | <span className="db-tier t-understand">Understand</span> |
| mTLS and workload identity: certificates for service-to-service trust, SPIFFE/SPIRE ids, rotation — and where a service mesh does this for you (Phase 16) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can whiteboard the authorization code + PKCE flow
with every redirect and back-channel call labeled, say which token appears
where, and explain to a reviewer why the API validates `iss`, `aud` and `exp`
but never sees a refresh token.

---

## Phase 14 — Microservice architecture

The decision layer. Most microservice pain is not Kafka config — it is
boundaries drawn wrong, sync calls where events belonged, and a distributed
system nobody priced in. This phase is deliberately opinionated: monolith
first, split on proof, and every split pays the availability math.

| Topic | Tier |
|---|---|
| **Monolith first — honestly**: the modular monolith (Spring Modulith enforces module boundaries inside one deployable), what microservices actually buy (independent deploy/scale/ownership), and the team-size threshold below which they only cost | <span className="db-tier t-understand">Understand</span> |
| **Service boundaries from bounded contexts**: DDD's rule applied — a service owns one business capability *and its data*; "Order" and "Inventory" split by invariants, not by nouns. The wrong-boundary tell: two services that always deploy together | <span className="db-tier t-master">Master</span> |
| **Database-per-service** and the joins you lose: no cross-service foreign keys, API composition for read paths, duplicated reference data by design — the schema-coupling trap of "just share the DB" spelled out | <span className="db-tier t-understand">Understand</span> |
| **Sync vs async as the coupling decision**: temporal coupling, the availability multiplication (five 99.9% services in a call chain ≈ 99.5%), latency budgets across hops — the single decision that shapes everything in Phase 15 | <span className="db-tier t-master">Master</span> |
| Inter-service REST that survives change: `RestClient` with per-service config, DTO versioning, the **tolerant reader** (ignore unknown fields — Jackson config from Phase 7 becomes policy), and why breaking a consumer is a deploy-order deadlock | <span className="db-tier t-understand">Understand</span> |
| **gRPC**: protobuf contracts, code generation into Java, unary vs streaming calls, deadlines — where it beats REST (internal high-QPS, typed contracts) and where its browser/debug friction loses | <span className="db-tier t-know">Know</span> |
| **API gateway with Spring Cloud Gateway**: one edge for routing, authentication (Phase 13's resource-server config lives here once), rate limiting and CORS — and the anti-pattern of business logic creeping into the gateway | <span className="db-tier t-understand">Understand</span> |
| **Service discovery**: client-side (Eureka/Consul) vs the platform answer — Kubernetes Services + DNS made discovery libraries mostly legacy; recognize both because production has both | <span className="db-tier t-understand">Understand</span> |
| Centralized configuration: Spring Cloud Config vs env vars + ConfigMaps/Secrets — 12-factor config (Phase 9) at fleet scale, and secret rotation without redeploy | <span className="db-tier t-know">Know</span> |
| **Correlation across services**: trace ids propagated via W3C `traceparent`, Micrometer Tracing + OpenTelemetry wired through MDC — Phase 12's tracing row, now load-bearing: without it, a fleet incident is archaeology | <span className="db-tier t-understand">Understand</span> |
| **Consumer-driven contract testing**: Spring Cloud Contract or Pact — the consumer's expectations run as the provider's CI gate, so integration breaks at build time, not in staging | <span className="db-tier t-understand">Understand</span> |
| **The distributed monolith** — the failure mode that combines both costs: the tells (lockstep deploys, chatty sync chains, shared database, one change touching four repos) and the honest fix (merge back, or re-draw boundaries) | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** given "split this order system", you can argue *against*
the split for a two-team shop, and for the split at scale — naming the
boundaries by invariant, the sync/async choice per interaction, and the
availability cost of each sync hop.

---

## Phase 15 — Messaging and event-driven architecture

Where the hardest correctness bugs in distributed Java live. The theme
throughout: **at-least-once delivery is the reality, so idempotency is not
optional** — everything else is detail on top of that sentence.

| Topic | Tier |
|---|---|
| **Why queues**: temporal decoupling (consumer down ≠ producer blocked), load leveling, fan-out — and the price: eventual consistency, ordering questions, duplicate delivery | <span className="db-tier t-understand">Understand</span> |
| **RabbitMQ model**: exchanges (direct/topic/fanout), queues, bindings, ack/nack/requeue, prefetch, **dead-letter exchanges** — Spring AMQP's `@RabbitListener`, retry with backoff, and the poison message that loops forever without a DLQ | <span className="db-tier t-master">Master</span> |
| **Kafka is a log, not a queue**: topics, partitions, offsets, consumer groups, retention — messages aren't deleted on read, consumers track position; the model shift that explains every Kafka behaviour that surprises queue thinkers | <span className="db-tier t-master">Master</span> |
| Producing from Spring: `KafkaTemplate`, **keys decide partition and therefore ordering**, `acks=all` + idempotent producer for no-loss writes, batching/linger for throughput | <span className="db-tier t-understand">Understand</span> |
| Consuming: consumer groups and rebalancing (why a slow consumer stalls its partitions), commit strategies (auto vs manual, commit-after-process), and **consumer lag as the health metric** | <span className="db-tier t-understand">Understand</span> |
| **Spring Kafka in practice**: `@KafkaListener`, `DefaultErrorHandler` with backoff, **retry topics and `DeadLetterPublishingRecoverer`** — the non-blocking retry pattern that keeps one bad event from stalling a partition | <span className="db-tier t-understand">Understand</span> |
| **Delivery semantics, honestly**: at-most-once vs at-least-once vs "exactly-once" — what Kafka transactions actually guarantee (exactly-once *processing within Kafka*, not across your database), and why cross-system exactly-once is a lie you build around | <span className="db-tier t-master">Master</span> |
| **Idempotent consumers**: dedup by event id (processed-events table, unique constraint as the enforcer), naturally idempotent operations (`SET status = 'paid'` vs `balance += x`) — the pattern that makes at-least-once safe | <span className="db-tier t-master">Master</span> |
| **The transactional outbox**: the dual-write problem (DB commit + publish cannot be atomic), the fix — events written to an outbox table *in the business transaction*, relayed by a poller or **CDC with Debezium**; the single most asked-about pattern in event-driven interviews | <span className="db-tier t-master">Master</span> |
| **Sagas**: a business transaction across services — choreography (events, no coordinator) vs orchestration (explicit state machine), **compensating transactions** for rollback, worked on the order → payment → inventory flow this bible's Node microservices implement with RabbitMQ | <span className="db-tier t-understand">Understand</span> |
| Event design: notification ("order placed, come ask") vs **event-carried state transfer** (the payload is the data) vs event sourcing (events *are* the store) — three different architectures hiding under the word "event" | <span className="db-tier t-know">Know</span> |
| Schema evolution on the wire: Avro/Protobuf + Schema Registry, backward vs forward compatibility — the consumer that crashes on a renamed field, prevented at publish time | <span className="db-tier t-know">Know</span> |
| Spring Cloud Stream: binder abstraction over Kafka/Rabbit — what it standardizes, what it hides, and when plain Spring Kafka is the clearer choice | <span className="db-tier t-know">Know</span> |
| **Choosing the broker**: Kafka (replay, ordering, throughput, stream processing) vs RabbitMQ (routing, per-message ack, work queues) vs cloud queues (SQS/Pub/Sub — operational zero) — by access pattern, not fashion | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can explain the dual-write bug in the naive
"save then publish" code, fix it with an outbox on paper, and state what the
consumer must do because the relay delivers at-least-once — without using the
phrase "exactly-once" incorrectly.

---

## Phase 16 — Resilience and operating the fleet

A distributed system is a machine for turning one service's bad day into
everyone's. Resilience4j is the Java toolkit, but the patterns are the
syllabus: timeouts, retries, breakers, bulkheads — in that order, because each
protects against the previous one's failure mode.

| Topic | Tier |
|---|---|
| **Timeouts first, everywhere**: connect vs read vs total, a budget across hops (the caller's timeout must exceed the callee's), and the default-is-infinite audit — most cascading failures are missing timeouts wearing a costume | <span className="db-tier t-master">Master</span> |
| **Retries without making it worse**: exponential backoff + jitter, retry only idempotent operations, cap the attempts — and **retry amplification** (three layers × three retries = 27 requests) as the storm that takes down the recovering service | <span className="db-tier t-master">Master</span> |
| **Circuit breakers with Resilience4j**: closed → open → half-open, failure-rate and slow-call thresholds, fallbacks that degrade honestly (cached data, default response, fast failure) — failing fast so threads aren't parked on a dead dependency | <span className="db-tier t-master">Master</span> |
| **Bulkheads and rate limiting**: semaphore vs thread-pool isolation (one slow dependency can no longer eat every request thread — virtual threads change the math but not the principle), Resilience4j `RateLimiter` for outbound courtesy | <span className="db-tier t-understand">Understand</span> |
| Composing the decorators: the canonical order (rate limiter → bulkhead → breaker → retry → timeout around the call), Spring Boot annotations vs functional style, and metrics for every state change via Actuator | <span className="db-tier t-understand">Understand</span> |
| Load shedding and backpressure: reject early at the edge when saturated (a fast 503 beats a slow 200), bounded queues everywhere — the "unbounded queue = deferred OOM" lesson from Phase 6, fleet edition | <span className="db-tier t-know">Know</span> |
| **Health checks that don't lie**: liveness (restart me) vs readiness (route around me) vs startup, what belongs in each — and the classic self-inflicted outage: a readiness check that pings a dependency, turning its blip into your fleet-wide removal | <span className="db-tier t-understand">Understand</span> |
| **Deploying without downtime**: rolling, blue-green, canary; graceful shutdown (Phase 12) as the precondition; **feature flags** decoupling deploy from release — and flag debt as real debt | <span className="db-tier t-understand">Understand</span> |
| **Kubernetes for the Java developer**: what the platform provides (discovery, config, scaling, self-healing) so Spring Cloud stops reinventing it; requests/limits interacting with `MaxRAMPercentage` (Phase 12's cgroup lesson, applied); HPA vs JVM warm-up tension | <span className="db-tier t-understand">Understand</span> |
| Service mesh (Istio/Linkerd): mTLS, retries and traffic policy moved into sidecars/nodes — what it takes off the application, what it costs, and why a five-service shop doesn't need one | <span className="db-tier t-know">Know</span> |
| **Observability across the fleet**: RED per service and per edge, trace sampling decisions, log correlation via trace id — one incident, one trace id, every service's view; the Phase 12 toolkit becomes the fleet's nervous system | <span className="db-tier t-understand">Understand</span> |
| Distributed locks and leader election: ShedLock for "this scheduled job runs once across N replicas", why database locks beat DIY Redis locks, and the design smell a distributed lock usually is | <span className="db-tier t-know">Know</span> |
| Chaos engineering: injecting failure on purpose (latency, pod kills) to test the resilience config before production does | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** the Phase 9/10 service split into two (order + payment)
with: client-credentials auth between them, an outbox-relayed event consumed
idempotently, Resilience4j timeout + retry + breaker on the sync path, and
readiness checks that do *not* include each other — plus a one-paragraph
narrative of what happens when payment goes down for five minutes.

---

← Prev: [Part 4 — Production](04-production.md) · Index: [Java](../README.md)
