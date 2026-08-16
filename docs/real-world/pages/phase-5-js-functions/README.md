---
title: "Phase 5 — JavaScript custom functions"
sidebar_label: "Overview"
sidebar_position: 0
---

> Framework-free functions the storefront uses everywhere. The from-scratch
> foundations — EventEmitter, debounce, task queues, retry, LRU — live in
> [JavaScript Phase 17 — Machine coding](../../../javascript/pages/phase-17-machine-coding/README.md);
> these chapters **apply** them to this app and never re-implement what
> phase 17 already built.

**Prerequisites:** JavaScript phases 5 (built-ins), 7 (async), 17 (machine
coding); the Phase 3 API contract.

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[The fetch wrapper](01-the-fetch-wrapper.md)** | <span className="db-tier t-master">Master</span> | Timeout, retry and dedupe as composable wrappers — and the retry-eligibility law |
| 02 | **[The TTL cache with stale-while-revalidate](02-the-ttl-cache.md)** | <span className="db-tier t-master">Master</span> | Fresh / stale / expired as three behaviours; promises in the map keep both stampedes single-flight |
| 03 | **[The concurrency-limited task queue](03-the-task-queue.md)** | <span className="db-tier t-master">Master</span> | Phase-17’s primitive plus application policy: priorities as intent, dequeue-time cancellation, idempotent prefetch |
| 04 | **The event bus** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 05 | **The form validation engine** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 06 | **Money and dates with `Intl`** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 07 | **Slug and search normalization** | <span className="db-tier t-know">Know</span> | *(not written yet)* |
| 08 | **Feature flags with a local override** | <span className="db-tier t-know">Know</span> | *(not written yet)* |
| 09 | **Optimistic-update helpers** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 10 | **Debounce and throttle, applied** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: search, cart and reviews all running through
the wrapper, cache and queue — and a network throttled to 3G still leaves
the UI responsive.

## Where this connects

Phase 4's hooks consume these functions; Phase 6 types them. Where a
chapter needs a phase-17 building block, it imports the idea by link —
the test of the no-duplication rule.
