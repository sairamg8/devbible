---
title: "Part 2 — The network path and caching"
sidebar_label: "2 · Network path & caching"
sidebar_position: 2
---

> Phases 2–3 · Everything between the user's tap and your service, and every place an answer can be served early

Two building blocks appear in every design: the path a request takes to reach code, and the
caches along that path that stop most requests from ever reaching it. Interviewers probe both
because they are where latency, cost and correctness collide — a cache is a deliberate
decision to be wrong for a while, and a senior can say for how long and why it is acceptable.

The mechanics live elsewhere in the bible: [Nginx](../../nginx/README.md) for the proxy and
the balancer, [Redis](../../redis/README.md) for the distributed cache, Node's
[observability phase](../../nodejs/pages/phase-10-observability/README.md) for measuring any
of it. This part is the decisions those mechanics serve.

---

## Phase 2 — The request path: DNS to gateway

Trace one request from a phone to a pod and back, naming every hop and what it costs. The
design questions — where to terminate TLS, where to rate-limit, where state lives, why a
retry made the outage worse — all fall out of that trace.

| Topic | Tier |
|---|---|
| **From the tap to the first byte** — DNS lookup, TCP and TLS handshakes, the CDN edge, the load balancer, the gateway, the service, the store; the latency each hop adds and the hops that can answer without the rest | <span className="db-tier t-master">Master</span> |
| **Load balancing, layer 4 vs layer 7** — connection-level vs request-level, the algorithms (round robin, least connections, weighted, hash-based stickiness), health checks and connection draining; when a network balancer is enough and when you need request routing | <span className="db-tier t-master">Master</span> |
| **Reverse proxies and API gateways** — routing, authentication offload, rate limiting, TLS, compression, request shaping; the gateway as the one policy point and the one point of failure | <span className="db-tier t-master">Master</span> |
| **Stateless services, and where the state went** — sessions in Redis, uploads to object storage, nothing on local disk; horizontal scaling and safe restarts as *consequences* of statelessness, not features you add later | <span className="db-tier t-master">Master</span> |
| **CDNs** — edge caching of static and semi-static content, cache keys, TTL vs purge, origin shields, signed URLs, dynamic acceleration; the storefront's images and catalogue pages served from the edge | <span className="db-tier t-master">Master</span> |
| **Long-lived connections** — WebSockets, server-sent events and long polling compared; connections per node, routing a message to the node that holds the socket, reconnection storms after a deploy | <span className="db-tier t-master">Master</span> |
| **Rate limiting** — token bucket, leaky bucket, fixed window, sliding log and sliding counter; per user, per IP, per API key; distributed counters in Redis; the 429 contract; *where* in the path to enforce it and why the answer is "more than one place" | <span className="db-tier t-master">Master</span> |
| **Timeouts, retries and budgets along the path** — per-hop timeouts that add up to more than the client's, retry amplification through three layers, retry budgets and jitter; the slow dependency that became an outage | <span className="db-tier t-master">Master</span> |
| **DNS as a component** — TTLs, anycast, geo-routing, health-checked failover; DNS as the coarsest load balancer and the slowest failover you own | <span className="db-tier t-understand">Understand</span> |
| **TLS termination and where it lives** — at the edge, at the balancer, or in the pod; certificates at scale, mutual TLS inside the network, the cost of a handshake and what session resumption buys | <span className="db-tier t-understand">Understand</span> |
| **HTTP/1.1, HTTP/2 and HTTP/3** — head-of-line blocking, multiplexing, QUIC over UDP; what changes for a mobile client on a bad network, and what changes nothing on the server | <span className="db-tier t-understand">Understand</span> |
| **Service discovery** — DNS-based, registry-based, Kubernetes services; client-side vs server-side balancing between services; ties to [Java's microservice phase](../../java/pages/phase-14-microservice-architecture/README.md) | <span className="db-tier t-understand">Understand</span> |
| **Serialization on the wire** — JSON vs Protobuf vs MessagePack, gzip vs brotli vs zstd; payload size as a latency lever on mobile and a CPU cost on the server | <span className="db-tier t-understand">Understand</span> |
| **Connection pooling and keep-alive** — between services and to the database; pool sizing from concurrency, the herd of new connections after a restart | <span className="db-tier t-understand">Understand</span> |
| **The path in the storefront** — a catalogue request and a checkout request traced through the same edge, taking different caching, authentication and rate-limit decisions at each hop | <span className="db-tier t-understand">Understand</span> |
| **Service mesh** — sidecars, mutual TLS, retries and timeouts as infrastructure, traffic splitting; when a mesh earns its cost and when it is bureaucracy with latency | <span className="db-tier t-know">Know</span> |
| **Gateway patterns** — backend-for-frontend, aggregation, a GraphQL layer at the edge; detailed in **Part 6** *(not written yet)* | <span className="db-tier t-know">Know</span> |
| **Abuse at the edge** — volumetric vs application-layer attacks, WAF rules, bot detection, challenge pages; what the CDN absorbs and what still reaches you; detailed in **Part 9** *(not written yet)* | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can draw the storefront's request path from a phone to
PostgreSQL, name what each hop adds in latency order-of-magnitude, place rate limiting and
TLS termination with a reason, and explain why a 2-second timeout at the client became a
14-second outage at the database.

---

## Phase 3 — Caching everywhere

A cache is a decision to serve a possibly stale answer in exchange for latency and load. The
senior questions are all about the "possibly": how stale, who invalidates, what happens when
the cache is cold, empty, full, or lying. The Redis mechanics are in the
[Redis track](../../redis/README.md); this phase is the design layer over them.

| Topic | Tier |
|---|---|
| **Where a cache can live** — browser, CDN, gateway, in-process memory, a distributed cache, the database's own buffers; the hit ratio, latency and consistency each layer offers, and why a design usually has three of them | <span className="db-tier t-master">Master</span> |
| **Cache-aside, read-through, write-through, write-behind** — who populates, who invalidates, what breaks when the cache disappears; choosing per data type rather than per system | <span className="db-tier t-master">Master</span> |
| **Invalidation** — TTL vs event-driven, versioned keys, tag-based purge; why the storefront's *price* cache is the hard case and its *description* cache is not | <span className="db-tier t-master">Master</span> |
| **Stampede and thundering herd** — request coalescing (single-flight), locks, probabilistic early expiration, jittered TTLs, warming before a sale; the outage that started when one popular key expired | <span className="db-tier t-master">Master</span> |
| **Consistent hashing** — the ring, virtual nodes, minimal movement when a node joins or leaves; why it underlies Memcached clients, Dynamo-style stores and partition assignment everywhere | <span className="db-tier t-master">Master</span> |
| **Hot keys and skew** — a celebrity's profile, a flash-sale SKU; a local cache in front of the distributed one, key replication, request splitting | <span className="db-tier t-master">Master</span> |
| **HTTP caching semantics** — `Cache-Control`, `ETag` and conditional requests, `Vary`, stale-while-revalidate, private vs shared caches; the browser and the CDN as caches you *configure* rather than build | <span className="db-tier t-master">Master</span> |
| **What not to cache** — anything money-shaped, inventory at the moment of checkout, permissions; the cache that caused a double sale, and the pattern (cache the read, verify on the write) that prevents it | <span className="db-tier t-master">Master</span> |
| **Eviction policies** — LRU, LFU, adaptive variants, TTL-first; approximated LRU and memory policies in Redis; what "the cache is full" should mean for each workload | <span className="db-tier t-understand">Understand</span> |
| **Distributed caches** — Redis Cluster vs Memcached, replication and persistence trade-offs, client-side sharding; sizing from the working set rather than the dataset | <span className="db-tier t-understand">Understand</span> |
| **Caching computed results** — fan-out results, search pages, dashboard aggregates; materialised views and precomputation as caching by another name | <span className="db-tier t-understand">Understand</span> |
| **Negative caching and penetration** — caching "not found", a bloom filter in front of the cache, defending against enumeration of keys that do not exist | <span className="db-tier t-understand">Understand</span> |
| **Measuring a cache** — hit ratio, p99 with and without it, memory per key, eviction rate; the cache with a 95 % hit rate that does nothing for tail latency | <span className="db-tier t-understand">Understand</span> |
| **In-process caches in Node and Java** — a bounded LRU in Node, Caffeine on the JVM; drift between instances, memory pressure, and when to promote to Redis | <span className="db-tier t-understand">Understand</span> |
| **Caching in the storefront** — the catalogue listing, product detail, search results and the cart: four different TTL and invalidation answers, and the reasons | <span className="db-tier t-understand">Understand</span> |
| **Cache coherence across regions** — replicated caches, regional TTLs, invalidation over a message bus; accepting staleness by design and documenting the window | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a one-page caching plan for the storefront naming, per data type,
the layer, the strategy, the TTL, the invalidation trigger and the failure behaviour — with
the flash-sale SKU handled explicitly.

---

{/* NAV */}
