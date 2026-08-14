---
title: "07.4 · The Node side, observing, and alternatives"
sidebar_label: "04 · Node, observing, alternatives"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PgBouncer documentation**
> ([config](https://www.pgbouncer.org/config.html)) and the **PostgreSQL 18**
> docs. **Not sandbox-measured** — no console output on this page; the measured
> exhaustion timings are in [chunk 03](03-exhaustion-and-sizing.md).
> ⚠️ `ex54`'s `SHOW POOLS`, latency and connect-cost sections ran but were
> **never captured**, so no numbers from them appear here.

**A correctly sized pool still fails if the client is configured to wait
forever.** This chunk is the application side of the same problem.

## The Node side

```js
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,   // the POOLER endpoint
  max: 10,                     // per process — multiply by replica count
  idleTimeoutMillis: 30_000,   // release idle clients back
  connectionTimeoutMillis: 5_000,  // fail fast instead of hanging
});
```

Three things to get right, in order of how often they are got wrong:

**`connectionTimeoutMillis` is not set by default.** Without it, `pool.connect()`
waits indefinitely for a client — so a saturated pool produces hanging requests
rather than errors, the same failure shape as the 120-second measurement above.
Set it, and make it shorter than your upstream HTTP timeout.

**`max` is per process.** Chunk 01's arithmetic: replicas × `max` is your real
number. With a pooler in front this is much less dangerous, because PgBouncer
bounds the total — but `max_client_conn` still has to accommodate it.

**Always release, and release in `finally`.** The single most common way to
produce the exhaustion measured above is a `client` that is never released on the
error path:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // …
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();     // ← the line whose absence is the outage
}
```

Phase 9 covers the `withTransaction` helper that makes this structurally
impossible to get wrong, and it is the right abstraction to adopt once rather
than repeat.

## Observing a pooler

PgBouncer has an admin console — connect to the `pgbouncer` pseudo-database and
run its `SHOW` commands:

| Command | Answers |
|---|---|
| `SHOW POOLS` | how many clients are **waiting**, and `maxwait` |
| `SHOW SERVERS` | the actual server connections and their state |
| `SHOW CLIENTS` | who is connected, and for how long |
| `SHOW STATS` | request rates and average query time per database |

**`cl_waiting` and `maxwait` from `SHOW POOLS` are the two numbers to alert on.**
A non-zero `maxwait` means clients are queuing for a backend — the leading
indicator of the 120-second failure, visible long before anything errors. On the
PostgreSQL side, pair it with `pg_stat_activity` filtered to
`state = 'idle in transaction'`, which finds the cause rather than the symptom.
See [09 · Monitoring views](../09-monitoring/README.md).

## Alternatives

PgBouncer is not the only option, and on a managed platform the choice may
already be made for you:

- **pgcat** — a newer pooler in Rust, adds load balancing and sharding.
- **Odyssey** — Yandex's pooler, multi-threaded.
- **RDS Proxy / Neon / Supabase poolers** — provider-managed; Supabase's pooler
  is PgBouncer-compatible and exposed on a separate port from the direct
  connection. Getting this wrong — pointing at the direct endpoint from a
  serverless function — is the single most common connection incident on those
  platforms. See [13 · Managed PostgreSQL](../13-managed-postgres/README.md).

The pool-mode semantics in chunk 02 apply to all of them, because they are
imposed by PostgreSQL's session model rather than by any particular pooler.

## Trade-off

A pooler buys bounded backends and survives client churn, and charges you an
extra network hop, an extra process to run and monitor, and the session-state
restrictions of chunk 02. For anything with more than a couple of application
instances that trade is clearly worth it.

The sharper trade is in the sizing itself. A **small** pool means requests queue
under load — you are choosing to make some requests wait so that the ones running
stay fast, instead of letting everything degrade together. That is the right
choice, but it only works if waiting is bounded: a small pool with the default
120-second `query_wait_timeout` gives you the queueing without the fast failure,
which is the worst of both. **Size the pool small and the timeout short, or
neither.**

## Gotchas

**Symptom:** Requests hang for two minutes, then fail with `08P01`
**Cause:** Pool exhausted; `query_wait_timeout` defaults to 120 s. Measured —
clients 5 and 6 waited **120 204 ms** behind five open transactions.
**Fix:** Lower `query_wait_timeout` to a few seconds so exhaustion is an error,
and fix what is holding transactions open.

**Symptom:** One endpoint's bug takes down unrelated endpoints
**Cause:** `idle in transaction` sessions holding backends; in transaction
pooling the backend is held for the whole transaction. Five were enough.
**Fix:** `idle_in_transaction_session_timeout`, and `client.release()` in
`finally`. Alert on `pg_stat_activity` where `state = 'idle in transaction'`.

**Symptom:** `pool.connect()` never returns
**Cause:** `connectionTimeoutMillis` is unset in `pg`, so it waits forever.
**Fix:** Set it, shorter than the upstream HTTP timeout.

**Symptom:** Raising `default_pool_size` made things slower
**Cause:** Past the database's real concurrency limit, extra backends add
contention and memory pressure rather than throughput.
**Fix:** Size near cores × 2 and reduce transaction duration instead. Treat
saturation as a "why is this slow" question, not a "run more" question.

**Symptom:** PgBouncer refuses connections although backends are idle
**Cause:** `max_client_conn` (default 100) is the *client-side* limit and it is
separate from `default_pool_size`.
**Fix:** Raise `max_client_conn` — client connections are cheap. Large
`max_client_conn`, small `default_pool_size` is the intended shape.

**Symptom:** Serverless functions exhaust connections despite a pooler existing
**Cause:** Connecting to the direct endpoint rather than the pooler endpoint.
**Fix:** Use the pooler URL. On Supabase/Neon these are different hostnames or
ports; the direct one is for migrations and admin work.

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

**How do you tell a pooler is about to become your outage?**
`SHOW POOLS` on the PgBouncer admin console: `cl_waiting` and `maxwait` go
non-zero as soon as clients start queuing, well before anything times out. Alert
on `maxwait`, and correlate with `pg_stat_activity` filtered to `idle in
transaction` to find the cause.

**Which `pg` setting most often turns a saturated pool into a hang?**
`connectionTimeoutMillis`, which is unset by default — so `pool.connect()` waits
indefinitely. Setting it to a few seconds converts a hang into a handleable
error.

---


---

← [Exhaustion and sizing](03-exhaustion-and-sizing.md) · Next → [Streaming replication replicas](../08-replication/README.md)
