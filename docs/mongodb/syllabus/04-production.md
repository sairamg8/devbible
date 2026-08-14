---
title: "Part 4 — Production"
sidebar_label: "04 · Production"
sidebar_position: 4
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual. Tiers are assigned for
> fullstack application development.

**Phases 11–14 · 18 topics.** The cluster, the operations, the security posture,
and one applied phase that builds the storefront's data layer end to end.

Sharding is deliberately <span className="db-tier t-know">Know</span>: a MERN
application reaches a replica set long before it needs a shard key, and the shard
key is the one decision here you cannot take back.

---

## Phase 11 — Replication, sharding and the cluster

*4 topics.* What "the database" actually is once it is more than one process.

| Topic | Tier |
|---|---|
| 🔴 **Replica sets** — primary, secondaries, and why even a single-node development setup should be one (transactions and change streams require it) | <span className="db-tier t-master">Master</span> |
| **Elections and failover** — what triggers one, how long it takes, and what happens to in-flight operations | <span className="db-tier t-master">Master</span> |
| **Reading from secondaries** — the scaling advice that is usually wrong, revisited from Phase 10 | <span className="db-tier t-master">Master</span> |
| **When you do *not* need sharding** — the honest scaling ladder: indexes, schema, vertical, replica set, then shard | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 8 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate:** you can say what happens to a write that was acknowledged with `w: 1`
when the primary fails a second later, and what you would have set instead.

---

## Phase 12 — Performance, monitoring and operations

*3 topics.* Finding the problem before the users do.

| Topic | Tier |
|---|---|
| 🔴 **The slow query log and the profiler** — `slowms`, profiling levels, and reading `system.profile` | <span className="db-tier t-master">Master</span> |
| **The working set** — the concept that explains why performance falls off a cliff rather than degrading smoothly | <span className="db-tier t-master">Master</span> |
| **Capacity: connections and pool exhaustion** — the driver-side and server-side limits, and how they interact | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 8 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate:** given "the app got slow this week", you can name the three things you
would look at first, in order, and what each would tell you.

---

## Phase 13 — Security and deployment

*5 topics.* The configuration failures that make the news.

| Topic | Tier |
|---|---|
| 🔴 **Authentication** — SCRAM, users, and ⚠️ the unauthenticated-instance-on-the-public-internet failure that keeps happening | <span className="db-tier t-master">Master</span> |
| **Authorization** — built-in roles, custom roles, and least privilege for an application user | <span className="db-tier t-master">Master</span> |
| **The application user** — why it is not the admin user, and exactly which privileges it needs | <span className="db-tier t-master">Master</span> |
| **Network exposure** — `bindIp`, firewalls, VPC peering, Atlas IP access lists | <span className="db-tier t-master">Master</span> |
| 🔴 **NoSQL injection** — how an object in a query position becomes an operator, and why this is a real vulnerability in Express apps | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 5 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate:** you can write the exact role and connection string an Express API should
use, and explain how `{"$ne": null}` arriving as a JSON body becomes an
authentication bypass.

---

## Phase 14 — The storefront data layer

*6 topics.* Applied. One coherent build rather than isolated examples, reusing the
schema designed in Phase 3.

| Topic | Tier |
|---|---|
| **Products, variants and inventory** — the schema, and the queries the catalogue screens need | <span className="db-tier t-master">Master</span> |
| **Catalogue browsing** — filtering, faceted counts and pagination in one aggregation | <span className="db-tier t-master">Master</span> |
| **The cart** — atomic add/update/remove without transactions, and TTL expiry | <span className="db-tier t-master">Master</span> |
| **Checkout and stock** — the decrement-and-order problem from Phase 10, resolved in the schema | <span className="db-tier t-master">Master</span> |
| **Orders and history** — the read patterns, and what to denormalise onto the order | <span className="db-tier t-master">Master</span> |
| 🔴 **The index set for the whole application** — every index the storefront needs, justified by a named query, with nothing speculative | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 2 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — the syllabus is complete when:** you can build the storefront's data
layer from an empty database — schema, indexes, queries, driver setup and
security — and justify every modelling decision against the queries it serves.

---

← Prev: **[Part 3 — MongoDB from Node](03-from-node.md)** ·
Index: **[MongoDB syllabus](../README.md)**
