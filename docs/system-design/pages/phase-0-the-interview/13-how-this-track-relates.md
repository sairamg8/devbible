---
title: "The storefront supplies the examples, the other tracks supply the mechanics, and this track adds the decisions — where each concept lives in the bible, and what this track says about it that the others do not"
sidebar_label: "13 · How this track relates"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the bible's own directory tree — every link below was checked
> against a file on disk at the time of writing. The division of labour between tracks is the
> project's standing rule (`instructions.md`, the drafting brief for these two tracks). **No
> sandbox run.**

**This track does not teach Redis, Kafka, PostgreSQL indexes or Kubernetes. The bible already
does, one track each, at the level of mechanism. What this track adds is the layer above: which
one to choose, what it costs, where it breaks, and how to say so under a clock.** The running
example throughout is the bible's own PERN storefront — catalog, cart, checkout, orders, reviews —
because it is the application the reader is actually building, and because every classic design
question (a flash sale, search, notifications, payments) is one of its features at scale. When a
page here needs a mechanism, it links to the track that owns it rather than re-teaching it; when
a track's page needs a decision, it should link here. Knowing the map saves reading the same
concept twice and, more importantly, tells you which track to open when an interviewer's follow-up
goes below the level this track works at.

## The division of labour

| Question | Owner |
|---|---|
| *How does it work?* — the command, the API, the configuration, the failure message | the technology's track |
| *Which one, and why?* — the choice between two mechanisms, the cost, the trigger to switch | **this track** |
| *What is the code?* — the storefront's actual implementation of a feature | the [real-world track](../../../real-world/README.md) |
| *Can I implement the algorithm behind it?* — consistent hashing, LRU, rate limiting as code | the [DSA track](../../../dsa/README.md) |

The test for whether a paragraph belongs here or in another track: if it would be equally true
with a different product substituted — Redis for Memcached, Kafka for a managed log — it is a
decision and belongs here; if it depends on the product's own behaviour, it belongs in the
product's track.

## Where each concept lives

The concepts this track leans on most, with the track that owns the mechanism and the angle this
track adds:

| Concept | Mechanism lives in | This track adds |
|---|---|---|
| **Caching** | [Redis](../../../redis/README.md) — the data types, the Node client, cache-aside and its production behaviour | when a cache pays for itself, hit-rate arithmetic, invalidation as a design decision, the stampede and its remedies as trade-offs (phase 3) |
| **Transactions, isolation, indexes** | [PostgreSQL](../../../postgresql/README.md) — the planner, index types, isolation levels as the engine implements them | choosing a store from the access pattern, replication topology, when to shard and by what key, read-your-writes after checkout (phases 4–5) |
| **Document stores** | [MongoDB](../../../mongodb/README.md) — the document model, the aggregation pipeline | SQL vs document vs wide-column vs KV, chosen by access pattern, never by habit (phase 4) |
| **Messaging and events** | [Java's messaging phase](../../../java/pages/phase-14-microservice-architecture/README.md) and the microservices reference — producers, consumers, the outbox as code | queue vs log, delivery guarantees, ordering and its cost, choosing a broker (phases 8–9) |
| **Observability** | [Node's observability phase](../../../nodejs/pages/phase-10-observability/README.md) — structured logs, metrics, tracing in the process | what each signal cannot tell you, sampling, SLO-based alerting, cost (phase 16) |
| **Containers and the edge** | [Docker](../../../docker/README.md), [Nginx](../../../nginx/README.md) — images, compose, the reverse proxy configuration | the request path from DNS to gateway as a set of decisions, Kubernetes above Docker, IaC (phases 2, 12–14) |
| **The HTTP layer** | [Express](../../../expressjs/README.md), [Java's Spring Boot phases](../../../java/README.md) — routing, middleware, validation, error handling as code | REST done properly as a contract — idempotency keys, pagination, versioning, webhooks — and the GraphQL/gRPC/tRPC decision table (phases 10–11) |
| **The client** | [React](../../../react/README.md), [Next.js](../../../nextjs/README.md) — rendering, data fetching, the framework's own caching | the BFF and aggregation decisions, realtime transport choice, edge caching as it affects the client (phases 2, 11) |
| **The languages** | [JavaScript](../../../javascript/README.md), [TypeScript](../../../typescript/README.md), [Java](../../../java/README.md) | nothing — the design layer is language-neutral; examples are TypeScript first, Java second, per the reader's profile |
| **Distributed theory** | [Java's distributed-systems syllabus part](../../../java/syllabus/05-distributed.md) — the concepts as the Java track introduces them | consistency models, clocks, consensus, sagas and idempotency as design decisions with named costs (phases 6–7) |
| **Algorithms behind the systems** | [DSA phases 17–18](../../../dsa/README.md) — consistent hashing, rate limiters, Bloom filters, LRU as code | where each one belongs in a design and what it costs to run at scale |

Two things the table makes visible. First, **the storefront's backend has two implementations
in the bible** — Node/Express and Java/Spring Boot — and this track's examples are deliberately
written so that either can be the target; a design decision does not change with the language.
Second, **the real-world track and this one meet at the code**: the outbox, the idempotency key,
the reservation ledger are *designed* here and *implemented* there.

## The storefront as the running example

The bible's [PERN storefront](../../../real-world/README.md) is the recurring scenario for
every part of this track, and the map of which feature carries which design lesson:

| Storefront feature | The design question it carries | Track phases |
|---|---|---|
| Catalog and product pages | the read path, caching, CDN, search freshness | 2, 3, 5 |
| Cart | eventual consistency by choice, sessions, a store that tolerates merge | 3, 6 |
| Checkout and inventory | contention on the hot row, reservation vs decrement, the payment boundary, idempotency | 4, 7, 15 |
| Orders and the outbox | durability, event publication, sagas across services | 7, 8, 9 |
| Reviews with uploads | object storage, presigned uploads, async processing | 5, 8 |
| Notifications | fan-out, delivery guarantees, provider failure | 8, 15 |
| Search | inverted index, sync from the primary, relevance | 5, 9 |
| The sale day | traffic shape, load shedding, the flash-sale checkout in the HLD catalogue | 1, 15, 22 |
| Admin dashboard | OLTP vs OLAP, the read replica, the reporting store | 5 |
| An LLM feature | where a model belongs in the storefront and where it does not | 18 |

The advantage of one running example is that follow-ups compound: the inventory row that phase 4
introduces is the same row phase 15 puts an SLO on and phase 22 breaks at a sale. A reader who has
built the storefront in the real-world track meets every design question here as a question about
code they have written.

## The interview layer, split across two tracks

The senior loop has more than the design rounds, and the two new tracks divide it:

- **This track** — HLD (phases 1–18 and the catalogue in 21–22), LLD and machine coding
  (phases 19–20), and the loop itself (phase 23): levelling, behavioural rounds, proof of work,
  the combined plan.
- **The [DSA track](../../../dsa/README.md)** — the coding rounds: patterns, the problem ladder,
  the practice system, and the algorithms that reappear inside systems (its phases 17–18, which
  point back here).

The phase-23 plan interleaves the two; neither track's plan is complete on its own.

## What this phase assumed, and where it goes next

Phase 0 has been about the round and the rubric; nothing in it required a mechanism from another
track, which is why its links are to whole tracks rather than to pages. From phase 1 onward the
links get specific, and the rule tightens: a page here links to the *page* that owns a mechanism,
and never restates it. The [syllabus](../../syllabus/01-the-interview-and-the-method.md) for
phase 1 — the method, requirements to deep dives — is the next thing to read, and it is written
against the same storefront.

## Gotchas

**★ Symptom: a design page here explains how Redis eviction works, and the Redis track says
something different.** Cause: mechanism restated in the decision layer, and the two drifted. Fix:
the decision layer links to the mechanism and states only the trade-off; if you find a
restatement, treat the owning track as authoritative and report the drift.

**Symptom: you read the caching phase here and cannot configure a cache.** Cause: expecting the
mechanism from the decision layer. Fix: that is by design — the Redis track owns the mechanism;
this track tells you when and why, and links to the how.

**Symptom: a design question's follow-up goes below this track's level — "what isolation level
exactly?"** Cause: the interviewer moved from decision to mechanism. Fix: know which track to have
read — for that question, PostgreSQL's isolation pages — and answer from there; the map above is
what tells you where the depth lives.

**Symptom: the Java and Node backends give different answers to the same design question.**
Cause: a language-specific mechanism mistaken for a design decision. Fix: the decision is the same
— an outbox, an idempotency key, a reservation — and only its implementation differs; if the
*decision* differs, one of the two implementations is wrong.

**Symptom: the algorithm behind a design component is hand-waved.** Cause: consistent hashing or
a rate limiter treated as a box. Fix: the DSA track's applied-algorithms phase owns the
implementation; a senior candidate can go one level down when asked, and that is where the code
is.

## Interview questions

**★ How does this track divide the work with the technology tracks and the real-world track?**
The technology tracks own the mechanism — how a thing works, its API and configuration, its
failure messages. This track owns the decision — which mechanism, what it costs, where it breaks,
when to switch. The real-world track owns the storefront's actual code, so a decision made here is
implemented there. The DSA track owns the algorithms that appear inside systems. The test for
where a paragraph belongs is whether it would stay true with a different product substituted: if
yes, it is a decision and lives here.

**Why does the track use one running example rather than a fresh system per topic?**
Because follow-ups compound. The inventory row introduced with storage engines is the same row
that gets an SLO in reliability and breaks at a flash sale in the catalogue, so each phase deepens
a question the reader already has code for rather than starting a new one. It also matches the
reader's own project, so every design question here is a question about something they have
built.

**Where do you go when an interviewer's follow-up drops below the decision level?**
To the track that owns the mechanism: PostgreSQL for isolation levels and index types, Redis for
data types and eviction, the Java or Node track for how the outbox is implemented, the DSA track
for the algorithm behind a component. The design layer says which and why; the mechanism layer is
what a senior candidate can go one level down into when asked, and knowing which track holds it is
part of the preparation.

**Why are the design examples written to work for both the Node and the Java backend?**
Because a design decision does not depend on the language — an outbox, an idempotency key, a
reservation ledger are the same decision in either — and the bible implements the storefront in
both. Writing examples in TypeScript first and Java second follows the reader's profile without
making the design layer language-specific; if the two implementations ever disagreed on the
*decision*, one of them would be wrong.

---

← Prev: [12 · Primary sources](12-primary-sources.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next phase → [Part 1 of the syllabus — the method](../../syllabus/01-the-interview-and-the-method.md)
