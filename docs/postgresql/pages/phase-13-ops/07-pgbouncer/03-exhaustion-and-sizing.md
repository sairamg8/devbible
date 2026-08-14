---
title: "07.3 · Exhaustion, sizing and the Node side"
sidebar_label: "03 · Exhaustion & sizing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. **Mixed provenance, marked inline.**
> The pool-exhaustion timings are **sandbox-measured** on **PgBouncer 1.25.2**
> (transaction mode, `default_pool_size=5`) in front of **PostgreSQL 18.4**,
> Node 24, `pg` — script `sandbox/pg-api/ex54-pgbouncer.mjs`, section 2.
> Defaults and behaviour are validated against the **PgBouncer documentation**
> ([config](https://www.pgbouncer.org/config.html)) and the **PostgreSQL 18**
> docs ([client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> ⚠️ `ex54`'s `SHOW POOLS`, latency and connect-cost sections ran but were
> **never captured**, so no numbers from them appear here.

**One misbehaving client takes down every other client behind the pool.** That is
the sentence to remember from this chunk, and it is measurable.

## Measured: what exhaustion actually looks like

`ex54` §2, with `default_pool_size = 5` and **seven** clients each issuing `BEGIN`
and then holding the transaction open:

| Clients | Outcome | Time |
|---|---|---|
| 0–4 (five clients) | got a backend PID | **1–2 ms** |
| 5 and 6 (two clients) | **failed** — `08P01`, `query_wait_timeout` | **120 204 ms** |

Read the second row carefully, because three separate things in it are the
lesson.

**They waited, they did not fail fast.** Over two minutes elapsed before the
error. From the application's point of view those requests were not rejected —
they hung. Every timeout upstream (load balancer, HTTP client, browser) fires
long before PgBouncer gives up, so what you observe is not "database errors", it
is *the service stopped responding*.

**120 seconds is the default.** `query_wait_timeout` defaults to **120.0
seconds**, and the sandbox deliberately waited it out rather than lowering it,
because the default is the finding. Almost nobody wants a two-minute wait; almost
nobody changes it.

**Five open transactions were enough.** Not five thousand queries — five
transactions left open. Which is exactly what one `idle in transaction` bug
produces.

## Why idle-in-transaction is the outage

Chunk 02's happy result — 40 clients on 1 backend — depends entirely on
transactions being *short*. In transaction pooling, the server connection is held
for the duration of the transaction. So:

- a transaction that is open for 200 ms holds a backend for 200 ms;
- a transaction left open while the code does an HTTP call, or awaits something,
  or simply forgot to commit, holds a backend for as long as that lasts;
- and `default_pool_size` of them held simultaneously means **every other client
  in the application waits**, then fails at 120 s.

This is the mechanism by which a bug in one endpoint — an unclosed transaction on
a rarely-hit code path — presents as a total outage of an unrelated endpoint. The
blast radius of `idle in transaction` is the whole pool.

Two defences, and you want both:

```sql
-- server side: PostgreSQL kills transactions left open
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
```

`idle_in_transaction_session_timeout` defaults to **0 (disabled)**. Setting it
means the server terminates a connection that sits idle inside a transaction
past the limit, releasing the backend. The client gets an error — which is the
point; an error on the buggy request is enormously better than a stall on every
other one.

```sql
-- also worth having, for the other half of the problem
ALTER SYSTEM SET statement_timeout = '30s';
```

`statement_timeout` (default **0**, disabled) bounds a single statement.
`idle_in_transaction_session_timeout` bounds the gaps *between* statements in a
transaction. They catch different bugs, so set both — and set them per role or
per transaction rather than globally where a migration or a report legitimately
runs long.

On the pooler side, lower `query_wait_timeout` so that exhaustion surfaces as a
fast error rather than a two-minute hang. A value in the low single-digit seconds
turns the failure into something your retry logic and your alerting can both see.

## Sizing the pool

The counter-intuitive result, and the one most teams get wrong: **a smaller pool
is usually faster.**

The database can only actually execute so much at once — bounded by CPU cores and
by disk. Beyond that point, more concurrent backends do not add throughput; they
add context switching, lock contention and memory pressure, and every individual
query gets slower. A queue in front of a busy resource is not a failure mode, it
is how you keep latency predictable.

A defensible starting point:

```
default_pool_size  ≈  cores × 2   (+ a little for disk-bound waits)
```

then measure and adjust. For a small managed instance that is often something
like 10–25, not 200. The instinct to raise the pool when things are slow is
usually the wrong direction: if the pool is saturated, the question is why
transactions are slow or long, not how to run more of them at once.

Related PgBouncer settings worth knowing:

| Setting | Default | What it is for |
|---|---|---|
| `default_pool_size` | 20 | server connections **per user/database pair** |
| `max_client_conn` | 100 | total *client* connections PgBouncer accepts |
| `min_pool_size` | 0 | keep this many warm, to avoid connect cost on a spike |
| `reserve_pool_size` | 0 | extra connections for a pool that is starved |
| `query_wait_timeout` | 120.0 s | **how long a client waits for a backend** |

`max_client_conn` is the one people forget to raise. It bounds connections *to
PgBouncer*, and those are cheap — this is the number that should be large. The
shape of a correct configuration is **large `max_client_conn`, small
`default_pool_size`**: accept many clients, run few queries. Leaving
`max_client_conn` at 100 while scaling the application defeats the purpose, and
its failure mode is refusal at the pooler.

## Trade-off

A **small** pool means requests queue under load — you are choosing to make some
requests wait so that the ones running stay fast, instead of letting everything
degrade together. That is the right choice, but it only works if waiting is
bounded: a small pool with the default 120-second `query_wait_timeout` gives you
the queueing without the fast failure, which is the worst of both.

**Size the pool small and the timeout short, or neither.** The instinct to raise
`default_pool_size` when things are slow is usually backwards — past the
database's real concurrency limit you are buying contention, not throughput, and
the useful question is why transactions are long rather than how to run more of
them at once.

## Gotchas

**Symptom:** Requests hang for two minutes, then fail with `08P01`
**Cause:** Pool exhausted; `query_wait_timeout` defaults to 120 s. Measured —
clients 5 and 6 waited **120 204 ms** behind five open transactions.
**Fix:** Lower `query_wait_timeout` to a few seconds so exhaustion is an error,
and fix what is holding transactions open.

**Symptom:** One endpoint's bug takes down unrelated endpoints
**Cause:** `idle in transaction` sessions holding backends; in transaction
pooling the backend is held for the whole transaction. Five were enough.
**Fix:** `idle_in_transaction_session_timeout`, and release clients in `finally`.
Alert on `pg_stat_activity` where `state = 'idle in transaction'`.

**Symptom:** Raising `default_pool_size` made things slower
**Cause:** Past the database's real concurrency limit, extra backends add
contention and memory pressure rather than throughput.
**Fix:** Size near cores × 2 and reduce transaction duration instead.

**Symptom:** PgBouncer refuses connections although backends are idle
**Cause:** `max_client_conn` (default 100) is the *client-side* limit and is
separate from `default_pool_size`.
**Fix:** Raise `max_client_conn` — client connections are cheap. Large
`max_client_conn`, small `default_pool_size` is the intended shape.

**Symptom:** Exhaustion recurs after every deploy
**Cause:** Rolling deploys briefly double the number of application instances,
and each brings its own pool.
**Fix:** Size for peak instance count including deploy overlap, not steady state.

## Interview questions

**★ What happens when a PgBouncer pool is exhausted?**
Clients queue rather than failing, and are only refused after
`query_wait_timeout` — **120 seconds by default**. Measured: with pool size 5 and
seven clients holding transactions open, two waited 120 204 ms and failed with
`08P01`. In practice every upstream timeout fires first, so it presents as the
service hanging rather than as database errors.

**★ Why does one `idle in transaction` bug affect the whole application?**
In transaction pooling a server connection is held for the entire transaction, so
transactions left open consume the pool. Once `default_pool_size` of them are
held, every other client waits — measured, five were enough. The fix is
`idle_in_transaction_session_timeout` server-side plus releasing clients in a
`finally` block.

**★ Should a bigger pool make things faster?**
Usually not. The database executes only so much concurrently before contention
and memory pressure dominate, so beyond roughly cores × 2 more backends make
every query slower without adding throughput. If the pool is saturated the real
question is why transactions are long.

**★ What is the relationship between `max_client_conn` and `default_pool_size`?**
`max_client_conn` bounds connections *to PgBouncer* — cheap, should be large.
`default_pool_size` bounds connections *to PostgreSQL* per user/database pair —
expensive, should be small. Accept many clients, run few queries. Leaving
`max_client_conn` at its default of 100 while scaling out is a common
self-inflicted refusal.

**Why is a two-minute default timeout worse than a two-second one?**
Because it converts a bounded failure into an unbounded stall. At two seconds the
application gets an error it can retry, shed or surface; at 120 seconds every
upstream timeout fires first and the symptom is "the service stopped responding",
with nothing in the database logs to explain it.

---

← [Pool modes](02-pool-modes.md) · Next → [The Node side and observing](04-node-and-observing.md)
