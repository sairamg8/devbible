---
title: "Phase 2 — The request path: DNS to gateway"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Protocol claims on every page name their primary source on a `> Verified:`
> line — RFC 9110 (HTTP semantics, Retry-After, 503), RFC 6585 (429), RFC 9113 (HTTP/2),
> RFC 9000 and RFC 9114 (QUIC and HTTP/3), RFC 8446 (TLS 1.3), RFC 6455 (WebSocket), MDN
> (server-sent events), the Kubernetes documentation (Services). Balancing algorithms, gateway
> patterns, rate-limiter algorithms, retry budgets and pool sizing are **common practice** and are
> stated as such; latency figures are the Norvig table and the circulated Dean list, orders of
> magnitude only. **No sandbox run.**

**Trace one request from a phone to a pod and back, naming every hop and what it costs.** The
design questions of this phase — where to terminate TLS, where to rate-limit, where state lives,
why a retry made the outage worse — all fall out of that trace. [Phase 1](../phase-1-the-method/README.md)
drew the diagram's boxes; this phase is the arrows between the client and the first service: DNS,
the handshakes, the CDN edge, the balancer, the gateway, the long-lived connection, the rate
limiter, the timeout and the retry, the connection pool — each with its latency, its failure mode
and the decision it forces on the bible's [PERN storefront](../../../real-world/README.md).

✅ **Phase complete — 18 of 18 written (34 files: topics 01–15 plus 16, 17 and 18 each split across several files).**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | **[From the tap to the first byte](./01-from-the-tap-to-the-first-byte.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | **[Load balancing, layer 4 vs layer 7](./02-load-balancing-layer-4-vs-layer-7.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | **[Reverse proxies and API gateways](./03-reverse-proxies-and-api-gateways.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | **[Stateless services, and where the state went](./04-stateless-services-and-where-the-state-went.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | **[CDNs](./05-cdns.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | **[Long-lived connections](./06-long-lived-connections.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 07 | **[Rate limiting](./07-rate-limiting.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 08 | **[Timeouts, retries and budgets along the path](./08-timeouts-retries-and-budgets.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 09 | **[DNS as a component](./09-dns-as-a-component.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 10 | **[TLS termination and where it lives](./10-tls-termination-and-where-it-lives.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 11 | **[HTTP/1.1, HTTP/2 and HTTP/3](./11-http-1-1-http-2-and-http-3.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 12 | **[Service discovery](./12-service-discovery.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 13 | **[Serialization on the wire](./13-serialization-on-the-wire.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 14 | **[Connection pooling and keep-alive](./14-connection-pooling-and-keep-alive.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 15 | **[The path in the storefront](./15-the-path-in-the-storefront.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 16 | **[Service mesh](./16-service-mesh.md)** | <span className="db-tier t-know">Know</span> | ✅ written |
| 16b | **[Mesh mTLS and workload identity](./16b-mesh-mtls-and-workload-identity.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 16c | **[Mesh retries, timeouts, breakers](./16c-mesh-retries-timeouts-and-circuit-breaking.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 16d | **[Mesh splitting and canaries](./16d-mesh-traffic-splitting-and-canaries.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 16e | **[What a mesh costs](./16e-what-a-service-mesh-costs.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 16f | **[North-south and east-west](./16f-north-south-and-east-west.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 16g | **[When a mesh earns its cost](./16g-when-a-mesh-earns-its-cost.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 17 | **[Gateway patterns](./17-gateway-patterns.md)** | <span className="db-tier t-know">Know</span> | ✅ written |
| 17b | **[Aggregation and partial failure](./17b-aggregation-and-partial-failure.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 17c | **[The fan-out N+1](./17c-the-fan-out-n-plus-1.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 17d | **[Routing versus orchestration](./17d-routing-versus-orchestration.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 17e | **[GraphQL at the edge](./17e-graphql-at-the-edge.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 17f | **[Graph authorisation, cost and federation](./17f-graphql-authorisation-cost-and-federation.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 18 | **[Abuse at the edge](./18-abuse-at-the-edge.md)** | <span className="db-tier t-know">Know</span> | ✅ written |
| 18b | **[The WAF and its false positives](./18b-the-waf-and-its-false-positives.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 18c | **[Bots, challenges and the ladder](./18c-bots-challenges-and-the-ladder.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 18d | **[Abuse that is business logic](./18d-abuse-that-is-business-logic.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 18e | **[Degrading instead of falling over](./18e-degrading-instead-of-falling-over.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |

## Phase gate

Draw the storefront's request path from a phone to PostgreSQL, name what each hop adds in
latency to an order of magnitude, place rate limiting and TLS termination with a reason, and
explain why a 2-second timeout at the client became a 14-second outage at the database.

## Where this connects

- [Part 2 of the syllabus](../../syllabus/02-the-network-path-and-caching.md) is the inventory
  this phase is written from; phase 3 there (caching everywhere) is next.
- [Phase 1 · The high-level diagram](../phase-1-the-method/07-the-high-level-diagram.md) and
  [Phase 1 · Bottlenecks and single points of failure](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md)
  are the boxes and the failure walk these hops belong to.
- [Phase 0 · The latency ladder](../phase-0-the-interview/05-the-latency-ladder.md) is the
  table every "what does this hop cost" answer is read from.
