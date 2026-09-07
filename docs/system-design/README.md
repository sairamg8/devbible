---
title: "System Design — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09 — the inventory is written against the primary sources listed under
> *Sources* below. Version-sensitive facts are deliberately kept out of the topic rows; each
> is pinned and cited when its explanation page is written.

The complete topic inventory for system design, tiered for **the senior and staff loop at
product companies**: **24 phases, 472 topics**, split into 13 parts to stay under the
300-line file cap. High-level design, low-level design, the platform the design runs on, the
AI feature every product now wants, and the loop that examines all of it.

This track sits *above* the rest of the bible. The mechanics — how PostgreSQL locks a row,
how Redis evicts, how a container gets a signal — are taught in their own tracks and are not
repeated here. What this track adds is the **decision layer**: which store, which broker,
which consistency, at what cost, and how to defend the choice under three follow-ups. The
running example is the bible's own [PERN storefront](../real-world/README.md), because the
classic interview questions — the flash sale, the search index, the notification fan-out,
the payment ledger — are its features at a hundred times the scale.

## Where this sits, as of September 2026

| | |
|---|---|
| Reader | Backend in **Node.js and Java (Spring Boot)**, frontend in **React / Next.js**; PostgreSQL first, MongoDB as the MERN mirror |
| Target | The senior and staff band: HLD + LLD rounds at product companies, plus the platform ownership those roles expect |
| Runtime pins | The bible's targets — Node's current Active LTS, Java 25, the PostgreSQL major used by the PostgreSQL track — are inherited, never restated here |
| Companion | [DSA](../dsa/README.md) covers the coding rounds of the same loop; the two tracks share Part 13's plan |

| The mechanics live in | This track adds |
|---|---|
| [Node.js](../nodejs/README.md) · [Express](../expressjs/README.md) · [Java](../java/README.md) | which service owns what, the saga, the outbox, the platform they run on |
| [PostgreSQL](../postgresql/README.md) · [MongoDB](../mongodb/README.md) · [Redis](../redis/README.md) | choosing the store, replication and sharding decisions, caching strategy, the data estate |
| [Docker](../docker/README.md) · [Nginx](../nginx/README.md) | Kubernetes, cloud primitives, infrastructure as code, delivery |
| [React](../react/README.md) · [Next.js](../nextjs/README.md) · [Frontend architecture](../frontend-architecture/README.md) | the API contract the client consumes, BFFs, realtime, streaming |
| [Real World](../real-world/README.md) | the same storefront at scale — every catalogue problem starts from its features |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[The interview and the method](syllabus/01-the-interview-and-the-method.md)** | What the rounds grade, the method from requirements to deep dives | 0–1 | 31 |
| 2 | **[The network path and caching](syllabus/02-the-network-path-and-caching.md)** | The request path, load balancing, rate limiting, caching at every layer | 2–3 | 34 |
| 3 | **[Storage and data](syllabus/03-storage-and-data.md)** | Storage engines, transactions, replication, sharding, the data estate | 4–5 | 34 |
| 4 | **[Distributed systems theory](syllabus/04-distributed-systems-theory.md)** | Consistency, clocks, consensus, sagas, idempotency, IDs, probabilistic structures | 6–7 | 35 |
| 5 | **[Event streaming and async](syllabus/05-event-streaming-and-async.md)** | Messaging guarantees, choosing a broker, Kafka, CDC, event sourcing | 8–9 | 37 |
| 6 | **[API design and contracts](syllabus/06-api-design-and-contracts.md)** | REST done properly; GraphQL, gRPC, tRPC, realtime, contract testing | 10–11 | 36 |
| 7 | **[Cloud, Kubernetes and infrastructure as code](syllabus/07-cloud-kubernetes-and-iac.md)** | AWS and its map, Kubernetes, Terraform and the delivery pipeline | 12–14 | 58 |
| 8 | **[Reliability and observability](syllabus/08-reliability-and-observability.md)** | SLOs and error budgets, resilience, DR, incidents, observability | 15–16 | 32 |
| 9 | **[Security and compliance at scale](syllabus/09-security-and-compliance.md)** | Threat modelling, authn/authz, secrets, encryption, compliance regimes | 17 | 25 |
| 10 | **[AI systems design](syllabus/10-ai-systems-design.md)** | LLM features in the stack: streaming, tools, RAG with pgvector, evals, cost | 18 | 28 |
| 11 | **[Low-level design and the machine-coding round](syllabus/11-low-level-design.md)** | OO design, patterns, concurrency, the machine-coding round, 30 LLD problems | 19–20 | 51 |
| 12 | **[The HLD problem catalogue](syllabus/12-the-hld-catalogue.md)** | 53 HLD problems, classic and India-scale, each with its deep dive | 21–22 | 53 |
| 13 | **[The senior loop and proof of work](syllabus/13-the-senior-loop-and-proof-of-work.md)** | The loop, levelling, behavioural stories, proof of work, the 12-week plan | 23 | 18 |

## Explanations

Not started — the syllabus comes first; explanation pages follow once it is approved, phase
by phase in reading order. Status lives in **[Explanations](./pages/README.md)**.

import Progress from '@site/src/components/Progress';

<Progress lang="system-design" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Will be asked, and asked *why*; design with it and defend it with no notes |
| <span className="db-tier t-understand">Understand</span> | Know how it works and what it costs; look up the details freely |
| <span className="db-tier t-know">Know</span> | Know what, why and when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 220 | 47% |
| <span className="db-tier t-understand">Understand</span> | 194 | 41% |
| <span className="db-tier t-know">Know</span> | 58 | 12% |
| <span className="db-tier t-when">When Needed</span> | 0 | 0% |
| **Total** | **472** | |

By part: The interview and the method 31 · The network path and caching 34 · Storage and data 34 · Distributed systems theory 35 · Event streaming and async 37 · API design and contracts 36 · Cloud, Kubernetes and infrastructure as code 58 · Reliability and observability 32 · Security and compliance at scale 25 · AI systems design 28 · Low-level design and the machine-coding round 51 · The HLD problem catalogue 53 · The senior loop and proof of work 18.

Master runs high on purpose, as it does in the Real World track: a design track *is* the
"defend it with no notes" material, and the rows tiered Master are the ones a senior loop
asks about directly. Nothing is tiered *When Needed* — the topics that would earn it were
left to the explanation pages rather than listed as rows.

## Prerequisites

The Node or Java track through its production phases, PostgreSQL through indexing and
transactions, and enough Redis and Docker to read a diagram that uses them. Part 1 has no
prerequisites and should be read first by everyone.

## Reading order

Parts are sequential and the order is load-bearing:

1. **Part 1 first, always.** The method is what every later part is applied through.
2. **Parts 2–5 before the catalogue.** The building blocks and the theory are what the
   classic problems are made of; reading the catalogue first produces memorised diagrams.
3. **Parts 6–10 in any order** once 2–5 are done — API design, the platform, reliability,
   security and AI systems are independent deep dives.
4. **Part 11 (LLD) can run in parallel** with everything from Part 2 onward; it shares more
   with the [DSA track](../dsa/README.md) than with HLD.
5. **Parts 12 and 13 last** — the catalogue is practice, and the loop is what the practice
   is for.

## Sources

- Martin Kleppmann, *Designing Data-Intensive Applications* — the reference behind Parts 3–5
- [Site Reliability Engineering](https://sre.google/books/) (Google) — SLOs, error budgets, incident practice in Part 8
- The [Dynamo](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html) and [Raft](https://raft.github.io/) papers — Part 4
- [Apache Kafka documentation](https://kafka.apache.org/documentation/) · [Debezium documentation](https://debezium.io/documentation/) — Part 5
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) · [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457) · [GraphQL specification](https://spec.graphql.org/) · [gRPC documentation](https://grpc.io/docs/) — Part 6
- [Kubernetes documentation](https://kubernetes.io/docs/) · [Terraform documentation](https://developer.hashicorp.com/terraform/docs) · [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) — Part 7
- [OpenTelemetry documentation](https://opentelemetry.io/docs/) — Part 8
- [OWASP API Security Top 10](https://owasp.org/API-Security/) — Part 9
- [Claude API documentation](https://docs.claude.com) · [pgvector](https://github.com/pgvector/pgvector) — Part 10
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/) — wherever a row leans on the database
