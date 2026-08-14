---
title: "09.1 · What is happening right now"
sidebar_label: "01 · Right now"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [The statistics collector / `pg_stat_activity`](https://www.postgresql.org/docs/18/monitoring-stats.html),
> [`pg_locks`](https://www.postgresql.org/docs/18/view-pg-locks.html),
> [system administration functions](https://www.postgresql.org/docs/18/functions-admin.html).
> **Not sandbox-measured** — no console output on this page. The related
> *measured* results live on the pages this one links to: the lock and
> idle-in-transaction behaviour in [Phase 11](../../phase-11-mvcc/README.md), and
> pool exhaustion in [07 · PgBouncer](../07-pgbouncer/03-exhaustion-and-sizing.md).

**When the database is on fire, you have about ninety seconds and one query.**
This chunk is that query, and what each column of it means.

## The one view to know

`pg_stat_activity` has one row per server process — every client connection plus
the background workers. It is the "what is happening this instant" view, and it
is the first thing to run during an incident:

```sql
SELECT pid,
       now() - xact_start   AS xact_age,
       now() - query_start  AS query_age,
       state,
       wait_event_type, wait_event,
       left(query, 80)      AS query
  FROM pg_stat_activity
 WHERE backend_type = 'client backend'
   AND state <> 'idle'
 ORDER BY xact_start NULLS LAST;
```

Four decisions are baked into that query and each one is deliberate.

**`backend_type = 'client backend'`** filters out the machinery. Without it you
are reading the checkpointer, the autovacuum launcher, the WAL writer and the
background writer alongside your application. Documented backend types include
`autovacuum launcher`, `autovacuum worker`, `checkpointer`, `background writer`,
`archiver`, `walwriter`, `walsender`, `walreceiver`, `parallel worker` and
`client backend`.

**`state <> 'idle'`** removes connections sitting doing nothing. Note carefully
that this does **not** remove `idle in transaction`, which is the state you most
want to see.

**Ordering by `xact_start`** puts the oldest transaction first. That is almost
always the row that matters — the oldest transaction is what holds locks back,
what pins the vacuum horizon, and what is occupying a pooled connection.

**`now() - xact_start` and `now() - query_start` are different questions.**
`query_age` is how long the current statement has run. `xact_age` is how long the
whole transaction has been open, and it is the one that causes collateral damage.
A transaction with `xact_age` of 20 minutes and `query_age` of 3 milliseconds is
not slow — it is *idle in transaction*, which is worse.

## The `state` column, and the one that ruins your night

The documented values:

| `state` | Meaning |
|---|---|
| `starting` | initial startup; client authentication happens here |
| `active` | executing a query |
| `idle` | waiting for a new client command — healthy |
| **`idle in transaction`** | **in a transaction, not executing anything** |
| `idle in transaction (aborted)` | same, but a statement in it errored |
| `fastpath function call` | executing a fast-path function |
| `disabled` | `track_activities` is off for this backend |

`idle in transaction` means your application ran `BEGIN`, did something, and then
went away — to call an HTTP API, to await a slow computation, or because a code
path forgot to commit. The transaction is open. Everything that costs comes from
that fact:

- it **holds every lock** it has taken, blocking DDL and conflicting writes;
- it **pins the vacuum horizon**, so dead rows across the database cannot be
  cleaned up and tables bloat ([Phase 11](../../phase-11-mvcc/README.md) measures
  precisely which transactions do and do not have this effect);
- and behind a pooler it **holds a backend**, which is how five of them exhaust a
  pool and stall the entire application — measured at
  [07 · PgBouncer](../07-pgbouncer/03-exhaustion-and-sizing.md).

Find them directly:

```sql
SELECT pid, usename, application_name,
       now() - state_change AS idle_for,
       left(query, 60)      AS last_query
  FROM pg_stat_activity
 WHERE state IN ('idle in transaction', 'idle in transaction (aborted)')
   AND now() - state_change > interval '1 minute'
 ORDER BY state_change;
```

`state_change` is documented as the time the state was last changed, so
`now() - state_change` is how long it has been sitting in this state. Note the
`query` column here shows the *last* statement run, not a running one — that is
your clue to which code path opened the transaction, which is usually all you
need to find the missing `COMMIT` or the missing `release()` in a `finally`.

**`application_name` is worth setting for exactly this moment.** Set it per
service in the connection string (`?application_name=orders-api`) and an incident
query tells you which service is responsible instead of showing you fifty
identical rows.

## Wait events: what a query is stuck on

`wait_event_type` and `wait_event` are NULL when a backend is running and
non-NULL when it is waiting. The type is the useful triage signal:

| `wait_event_type` | It is waiting for | Typical reading |
|---|---|---|
| `Lock` | a heavyweight lock held by another transaction | **blocking — go find the blocker** |
| `LWLock` | an internal shared-memory lock | contention, often buffer-related |
| `IO` | a read or write | disk-bound; check the query plan |
| `Client` | the client to send or receive | usually `ClientRead` — the *application* is slow, not the database |
| `IPC` | another server process | commonly parallel workers |
| `BufferPin`, `Timeout`, `Extension`, `Activity` | as named | `Activity` on background workers is idle, not a problem |

`Client` / `ClientRead` deserves a note because it is so often misread. It means
the backend is waiting for the client to say something. On an `idle in
transaction` connection that is your application holding the transaction open —
the database is waiting on *you*. It is not a database problem, and tuning the
database will not fix it.

## Finding who is blocking whom

When `wait_event_type = 'Lock'`, the next question is who holds it.
`pg_blocking_pids()` answers it directly and is far easier than joining `pg_locks`
to itself:

```sql
SELECT a.pid,
       pg_blocking_pids(a.pid)          AS blocked_by,
       now() - a.xact_start             AS waiting_for,
       left(a.query, 60)                AS blocked_query
  FROM pg_stat_activity a
 WHERE cardinality(pg_blocking_pids(a.pid)) > 0
 ORDER BY a.xact_start;
```

Then look up the blocker's row in `pg_stat_activity` by pid. In the common case
you will find a chain: one long transaction at the root, several blocked behind
it, and the queue growing. **Fix the root, not the queue.**

`pg_locks` itself is the underlying detail — one row per held or awaited lock,
with `granted` distinguishing the two. Reach for it when you need to know exactly
*which* lock mode on *which* object is involved; `pg_blocking_pids()` is enough
for most incidents. The DDL lock-conflict table in
[12 · Zero-downtime DDL](../12-zero-downtime-ddl/README.md) is what makes the
answer actionable.

## Ending it: cancel, then terminate

Two functions, and the difference matters:

```sql
SELECT pg_cancel_backend(pid);      -- cancels the running query, keeps the session
SELECT pg_terminate_backend(pid);   -- kills the whole session
```

**Try `pg_cancel_backend()` first.** It is the equivalent of Ctrl-C: the
statement stops, the transaction remains open, and the client gets an error it
can handle. It is safe.

`pg_terminate_backend()` closes the connection entirely, rolling back the
transaction. That is what you need for an `idle in transaction` session, because
there is no running query to cancel — cancelling does nothing to a backend that
is not executing anything. It is also the blunter tool: the client sees its
connection drop, and a pool may log errors.

Neither corrupts data. A terminated backend's transaction is rolled back exactly
as any aborted transaction is.

The properly automated version of the same thing is
`idle_in_transaction_session_timeout` (default **0**, disabled), which makes the
server terminate these itself rather than waiting for a human to notice. Set it,
and treat manual termination as the fallback.

## What to check, in order, during an incident

1. **Connection count** — near `max_connections`?
   `SELECT count(*) FROM pg_stat_activity;`
2. **Oldest transaction** — the query at the top of this page. Anything with a
   large `xact_age` is a suspect.
3. **`idle in transaction`** — how many, held for how long, and from which
   `application_name`.
4. **Blocking** — `pg_blocking_pids()`; find the root of the chain.
5. **Wait events** — `Lock` means blocking, `IO` means disk, `Client` means the
   application.
6. *Then* the cumulative view — which query is expensive in aggregate — which is
   [chunk 02](02-pg-stat-statements.md).

That order is deliberate: steps 1–5 are about *right now* and are what you act on
during an outage. `pg_stat_statements` is for the investigation afterwards, and
reaching for it first is a common way to spend an outage reading averages.

## Trade-off

`pg_stat_activity` is cheap to query and truthful about the present instant, and
it remembers **nothing**. The problem that ended thirty seconds ago is invisible,
which is why an incident you did not watch live can be impossible to diagnose
from it. That is the gap `pg_stat_statements` (cumulative) and slow-query logging
([11 · Logging](../11-logging/README.md)) exist to fill, and why a monitoring setup needs
all three rather than a favourite.

There is also a cost to the visibility itself: `track_activities` is what
populates the `query` and state columns, and turning it off (the `disabled` state)
removes the overhead and the ability to diagnose anything. That is not a trade
worth taking on a production system.

## Gotchas

**Symptom:** `pg_stat_activity` is full of rows you do not recognise
**Cause:** Background processes are included — checkpointer, autovacuum, WAL
writer.
**Fix:** Filter `backend_type = 'client backend'`.

**Symptom:** A transaction looks slow but the query is fast
**Cause:** You compared `query_start`, not `xact_start`. Long `xact_age` with
short `query_age` is `idle in transaction`.
**Fix:** Order by `xact_start` and read `state`. Treat it as an application bug,
not a slow query.

**Symptom:** `pg_cancel_backend()` did nothing
**Cause:** It cancels a *running query*; an `idle in transaction` backend has
none.
**Fix:** `pg_terminate_backend()`, and set
`idle_in_transaction_session_timeout` so it does not recur.

**Symptom:** `wait_event = ClientRead` on many backends
**Cause:** The database is waiting for the application. This is not a database
problem.
**Fix:** Look at the application — usually a transaction held open across an
external call.

**Symptom:** Fifty identical rows and no idea which service they are
**Cause:** `application_name` is unset, so every connection looks alike.
**Fix:** Set it per service in the connection string. Do this before the
incident.

**Symptom:** A query on `pg_stat_activity` shows nothing during a spike
**Cause:** It is an instantaneous view; short queries are rarely caught in the
act.
**Fix:** Use `pg_stat_statements` for aggregate cost and slow-query logging for
individual slow statements.

## Interview questions

**★ A production database is unresponsive. What do you run first?**
`pg_stat_activity`, filtered to client backends and non-idle, ordered by
`xact_start` — oldest transaction first. That single query tells you the
connection count, whether anything is `idle in transaction`, what each backend is
waiting on, and which statement is at the root. Aggregate views come after the
incident, not during it.

**★ What is `idle in transaction` and why does it matter so much?**
The backend has an open transaction but is executing nothing — the application
ran `BEGIN` and then went away. It holds locks, pins the vacuum horizon so dead
rows cannot be cleaned up, and behind a pooler occupies a server connection.
That is why one forgotten `COMMIT` on a rare code path can stall an entire
application.

**★ What is the difference between `pg_cancel_backend` and `pg_terminate_backend`?**
`pg_cancel_backend` cancels the running statement and leaves the session open —
the safe first choice, and useless against a backend that is not running
anything. `pg_terminate_backend` closes the session and rolls back its
transaction, which is what an `idle in transaction` backend needs. Neither risks
data corruption.

**★ How do you find what is blocking a query?**
`pg_blocking_pids(pid)` returns the pids holding the locks it is waiting for;
join it against `pg_stat_activity` to see their queries. Blocking usually forms a
chain, so follow it to the root transaction and deal with that one rather than
the queue behind it.

**What does `wait_event_type = 'Client'` tell you?**
That the backend is waiting on the client — typically `ClientRead`, the
application not sending the next statement. Combined with `idle in transaction`
it means your code is holding a transaction open across something slow. No amount
of database tuning addresses it.

**Why filter on `backend_type`?**
Because `pg_stat_activity` includes background processes — autovacuum workers,
the checkpointer, WAL senders — and during an incident they are noise that hides
the client backends you actually need to see.

---

← [Phase index](../README.md) · Next → [pg_stat_statements](02-pg-stat-statements.md)
