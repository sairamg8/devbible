---
title: "Phase 7 — Background work and resilience"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example was executed on **Node 24.19.0** against real servers:
> **Redis 8.10.0** and **PostgreSQL 17.10**, with `bullmq` 6.0.10, `ioredis` 6.0.0
> and `pg` 8.23.0.

**Complete — 16 pages.** Everything here is framework-free: `AbortSignal`, plain
functions and separate processes. No Express required, which is exactly why it belongs
in Node rather than in a framework section. Redis mechanics belong to the Redis
section; these pages cover the producer/consumer shape and what it takes to make it
correct.

## Background work

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Sync vs background](./01-sync-vs-background.md)** | <span className="db-tier t-master">Master</span> | 120 ms of inline work produced a p95 of 1246 ms; queued, 19 ms |
| 02 | **[Job queues](./02-job-queues.md)** | <span className="db-tier t-understand">Understand</span> | `for update skip locked` — 20 jobs, 3 workers, 20 unique claims and no double delivery |
| 03 | **[Worker processes](./03-worker-processes.md)** | <span className="db-tier t-understand">Understand</span> | One image, two commands. Why `concurrency` must match the database pool |
| 04 | **[Retries and stalled jobs](./04-retries-and-stalled-jobs.md)** | <span className="db-tier t-understand">Understand</span> | A `SIGKILL`ed worker left the job `active` with no error — retries and redelivery are different mechanisms |
| 05 | **[Job idempotency](./05-job-idempotency.md)** | <span className="db-tier t-master">Master</span> | Run twice: 2 emails, or 1 and a `rowCount` of 0 |
| 06 | **[The transactional outbox](./06-transactional-outbox.md)** | <span className="db-tier t-understand">Understand</span> | The order committed and nothing was ever enqueued. One transaction fixes it |
| 07 | **[Dead-letter queues](./07-dead-letter-queues.md)** | <span className="db-tier t-know">Know</span> | BullMQ has no DLQ — the `failed` set is a holding area, and moving jobs out is yours |
| 08 | **[Scheduled and recurring jobs](./08-scheduled-jobs.md)** | <span className="db-tier t-know">Know</span> | `setInterval` drifted 35 ms in 8 ticks and ran three copies at once |
| 09 | **[Outbound side-effects](./09-outbound-side-effects.md)** | <span className="db-tier t-know">Know</span> | Their uptime becomes yours. One job per subscriber, never one job per fan-out |
| 10 | **[Time on the server](./10-time-on-the-server.md)** | <span className="db-tier t-know">Know</span> | The same instant is the 10th and the 11th. `+7 days` in milliseconds moved an hour across DST |
| 11 | **[Graceful worker shutdown](./11-graceful-shutdown.md)** | <span className="db-tier t-master">Master</span> | `SIGTERM` finished the job in 2125 ms; `SIGKILL` left it `active` with nobody working it |

## Resilience

| # | Page | Tier | In one line |
|---|---|---|---|
| 12 | **[Timeout budgets](./12-timeout-budgets.md)** | <span className="db-tier t-master">Master</span> | `fetch` has no timeout. A 500 ms budget gave the second call 300 ms, not a fresh 500 |
| 13 | **[Deadline propagation](./13-deadline-propagation.md)** | <span className="db-tier t-understand">Understand</span> | One `abort()`, three children cancelled, and the reason travelled with it |
| 14 | **[Retry only what is safe](./14-retry-safe-failures.md)** | <span className="db-tier t-master">Master</span> | Two questions, and three of the four answers are "do not retry" |
| 15 | **[Backoff and jitter](./15-backoff-and-jitter.md)** | <span className="db-tier t-master">Master</span> | Without jitter all 500 clients retried in one 100 ms bucket |
| 16 | **[Concurrency limiting](./16-concurrency-limiting.md)** | <span className="db-tier t-master">Master</span> | `Promise.all` peaked at 200 in-flight; `mapLimit(8)` at 8 |

## Where this connects

- **[Phase 2 — async](../phase-2-async/README.md)** owns `AsyncLocalStorage` and the
  `Promise.all` outage that [page 16](./16-concurrency-limiting.md) is the production
  fix for.
- **[Phase 5 — HTTP and processes](../phase-5-http-processes/README.md)** owns signals and
  graceful HTTP shutdown; [page 11](./11-graceful-shutdown.md) is the worker half.
- **[Phase 6 — data access](../phase-6-data-access/README.md)** supplies transactions for the
  outbox, `skip locked` for the queue, and the database-specific retry codes that
  [page 14](./14-retry-safe-failures.md) generalises.
- **Phase 8 — security** covers signing outbound webhooks and the SSRF risk in a
  user-supplied URL ([page 09](./09-outbound-side-effects.md)).
- **Phase 10 — observability** covers the correlation id that a dead-letter entry
  should carry, and alerting on queue age rather than depth.

---

← Phase 6: [Data access](../phase-6-data-access/README.md) · Start → [Sync vs background](./01-sync-vs-background.md)
