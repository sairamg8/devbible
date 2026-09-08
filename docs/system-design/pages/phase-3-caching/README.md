---
title: "Phase 3 — Caching everywhere"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-08. Protocol claims on every page name their primary source on a `> Verified:`
> line — RFC 9111 (HTTP caching: freshness, the response directives, `Vary`, serving stale,
> invalidation by unsafe methods), RFC 9110 (validators, safe and idempotent methods), RFC 5861
> (`stale-while-revalidate`, `stale-if-error`), RFC 8246 (`immutable`), MDN's `Cache-Control` page,
> the Redis key-eviction documentation (approximated LRU, LFU, `maxmemory`, the hit-ratio formula),
> Caffeine's efficiency notes (W-TinyLFU), and Cassandra's documentation for the token ring and
> virtual nodes. The **patterns** — cache-aside, read-through, write-through, write-behind,
> single-flight, probabilistic early expiration, TTL jitter, negative caching, hot-key replication
> — are common practice and are stated as such rather than cited. **No sandbox run**; no hit ratio,
> latency or memory figure appears unless it is quoted.

**A cache is a decision to serve a possibly stale answer in exchange for latency and load, and
every senior question in this phase is about the word "possibly".** How stale, who invalidates,
and what happens when the cache is cold, empty, full, or lying. [Phase 2](../phase-2-request-path/README.md)
walked the request from the tap to the first byte and found a cache at almost every hop — the
browser, the CDN edge, the gateway, the process, the distributed store, the database's own buffers.
This phase is the design layer over them: where each layer can live and what it offers, the four
population strategies and who invalidates in each, the failure modes that only appear under load
(the stampede when one popular key expires, the celebrity key that lands on one shard), the ring
that decides which node holds what, the protocol you *configure* rather than build, and the short
list of things that must never be cached at all. The Redis mechanics themselves are in the
[Redis track](../../../redis/README.md); the running example throughout is the bible's
[PERN storefront](../../../real-world/README.md) — the catalogue, the product page, search, the
cart, and the flash-sale SKU that breaks every naive answer.

🚧 **0 of 16 topics written.**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | Where a cache can live | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 02 | Cache-aside, read-through, write-through, write-behind | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 03 | Invalidation | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 04 | Stampede and thundering herd | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 05 | Consistent hashing | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 06 | Hot keys and skew | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 07 | HTTP caching semantics | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 08 | What not to cache | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 09 | Eviction policies | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 10 | Distributed caches | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 11 | Caching computed results | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 12 | Negative caching and penetration | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 13 | Measuring a cache | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 14 | In-process caches in Node and Java | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 15 | Caching in the storefront | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 16 | Cache coherence across regions | <span className="db-tier t-know">Know</span> | ⬜ not written yet |

## Phase gate

A one-page caching plan for the storefront naming, per data type, the layer, the strategy, the
TTL, the invalidation trigger and the failure behaviour — with the flash-sale SKU handled
explicitly.

## Where this connects

- [Part 2 of the syllabus](../../syllabus/02-the-network-path-and-caching.md) is the inventory this
  phase is written from; part 3 there (storage and data) is next.
- [Phase 2 · CDNs](../phase-2-request-path/05-cdns.md) and
  [Phase 2 · Reverse proxies and API gateways](../phase-2-request-path/03-reverse-proxies-and-api-gateways.md)
  own the *hops*; this phase owns what they store and for how long.
- [Phase 1 · Non-functional requirements](../phase-1-the-method/02-non-functional-requirements.md)
  is where a staleness budget is supposed to be written down in the first place.
- The [Redis track](../../../redis/README.md) holds the mechanics in full — this phase is the
  design layer over them, and links rather than restates.

← Index: [System Design](../../README.md)
