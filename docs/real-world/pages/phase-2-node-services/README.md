---
title: "Phase 2 — Node services"
sidebar_label: "Overview"
sidebar_position: 0
---

> The processes around the API: boot, the data layer, uploads, the worker and
> its jobs, the cache, health, and the ops CLI. Concepts live in
> [Node.js phases 3–7 and 10–11](../../../nodejs/README.md); these chapters
> assemble them into the storefront's services from
> [Phase 0's architecture](../phase-0-the-app/02-architecture-and-data-model.md).

**Prerequisites:** Node phases 2 (async), 3 (streams), 5 (HTTP & processes),
6 (data access), 7 (background work).

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[The API boot, assembled](01-the-api-boot.md)** | <span className="db-tier t-master">Master</span> | validate env → migrate → pool → listen → ready, and the mirror-image shutdown with a watchdog |
| 02 | **[The data layer over raw `pg`](02-the-data-layer.md)** | <span className="db-tier t-master">Master</span> | One pool, ALS-propagated transactions that join not nest, and repos that return plain objects |
| 03 | **[The upload service](03-the-upload-service.md)** | <span className="db-tier t-master">Master</span> | Socket to storage in constant memory: mid-stream limits, magic-number sniffing, temp-then-rename, cleanup on every path |
| 04 | **The outbox relay and email worker** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 05 | **Scheduled jobs** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 06 | **The webhook dispatcher** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 07 | **The search indexer job** | <span className="db-tier t-know">Know</span> | *(not written yet)* |
| 08 | **The cache layer** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 09 | **The health and metrics kit** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 10 | **The ops CLI** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: API and worker booting from the same code base,
and an order placed while the email worker is stopped delivers exactly once
when it restarts.

## Where this connects

Phase 1's queries run inside chapter 02's modules; Phase 3's endpoints import
everything here; the containers that run these processes are
[Docker phase 9's](../../../docker/pages/phase-9-mern-pern-stack/README.md).
