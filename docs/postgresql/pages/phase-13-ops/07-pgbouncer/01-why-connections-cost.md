---
title: "07.1 · Why a connection costs something"
sidebar_label: "01 · Why connections cost"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [Connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html),
> [Resource consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html),
> [Architectural fundamentals](https://www.postgresql.org/docs/18/tutorial-arch.html).
> **Not sandbox-measured** — this chunk carries no console output. The measured
> numbers in this topic are in [chunk 02](02-pool-modes.md) and
> [chunk 03](03-exhaustion-and-sizing.md).

**A PostgreSQL connection is an operating-system process, not a thread.** Every
other fact on this page follows from that one, including why the answer to "we
need more connections" is almost never `max_connections = 500`.

## One connection, one process

The PostgreSQL docs describe the architecture plainly: the server (`postgres`)
"starts ('forks') a new process for each connection". A client connection is not
a lightweight handle multiplexed onto a worker pool — it is a full backend
process with its own memory context, its own catalog caches, its own prepared
statements and its own snapshot.

That buys PostgreSQL a great deal. Process isolation is why one backend
segfaulting cannot corrupt another's memory, and why `pg_cancel_backend()` is a
clean operation. It also sets the price:

| Cost | Where it lands |
|---|---|
| Process creation | fork + backend initialisation on every new connection |
| Baseline memory | per-backend catalog and relation caches, which grow as the backend touches more objects |
| `work_mem`, potentially several times over | **per sort/hash node, per backend** — not per connection |
| Snapshot and lock-table participation | every active backend is visible to every other one |

The third row is the one that surprises people, and it is the reason connection
count and memory are not independent knobs. `work_mem` is documented as the
memory used "by a query operation before writing to temporary disk files" — and
a single query with several sorts and hash joins can allocate it more than once,
concurrently. A `work_mem` of 64 MB is not "64 MB of risk"; it is 64 MB × nodes ×
backends of risk. This is covered properly in
[10 · Key configuration](../10-config-keys/README.md).

## What `max_connections` actually reserves

`max_connections` defaults to **100** and its context is **postmaster** — you
cannot raise it with a reload, only a restart. The docs are explicit that
PostgreSQL "sizes certain resources based directly on this value", so raising it
increases shared-memory allocation whether or not the connections are ever used.

Two reserves sit behind it, both also restart-only:

| Parameter | Default | What it protects |
|---|---|---|
| `superuser_reserved_connections` | **3** | the final emergency reserve — superusers only |
| `reserved_connections` | **0** | slots for roles granted `pg_use_reserved_connections` |

The ordering matters when you are the one locked out at 3am. As free slots fall,
the server first stops accepting ordinary connections while still admitting roles
with `pg_use_reserved_connections`, and then stops admitting those too, leaving
only the superuser reserve. That is the design intent: **the last three slots
exist so an administrator can still get in to fix whatever exhausted the rest.**

The failure a client sees is:

```
FATAL:  sorry, too many clients already
```

Note what that is *not*: it is not a queue, not a retry, and not a slow
connection. The server refuses. An application without a pool in front of it
turns a traffic spike directly into connection refusals.

## The multiplication problem

Here is the arithmetic that catches most teams, and it has nothing to do with
PostgreSQL's configuration:

```
containers × pg.Pool max = connections to the database
```

A `pg.Pool` with the driver's default `max` of **10** looks modest. Ten replicas
of that service is 100 connections — the whole of a default `max_connections`,
before the migration runner, the admin's `psql`, the metrics exporter, the
background worker, or a second service. Scale to 30 replicas during a deploy
(old pods draining while new pods start) and you are at 300 against a limit of
100.

**`pg.Pool` does not know about the other pods.** It is an in-process pool: it
bounds one Node process's concurrency and has no view of the cluster. That is the
gap a server-side pooler fills, and it is the entire argument for PgBouncer.

## Two different things both called "the pool"

Conflating these two is the most common source of confusion in this topic, so
name them separately:

| | `pg.Pool` (client-side) | PgBouncer (server-side) |
|---|---|---|
| Lives in | your Node process | its own process, usually beside the database |
| Bounds | that one process's concurrent queries | **total** backends across every client |
| Knows about other services | no | yes — that is the point |
| Survives your process restarting | no | yes |
| Costs you | nothing, it is in the driver | another hop, another thing to operate |

They are complementary, not alternatives. In production you generally run
**both**: `pg.Pool` to avoid a connect-per-request inside the process, and a
server-side pooler to bound the total. The mistake is running only the first and
believing it is the second.

## Why the connect itself is expensive

Opening a PostgreSQL connection is not one round trip. It is, in order:

1. TCP handshake
2. **TLS negotiation**, if enabled — see [06 · TLS](../06-tls.md)
3. the startup packet, then SCRAM authentication (a multi-message exchange)
4. backend process fork and initialisation

That is several round trips plus process creation before the first query is even
sent. On a LAN it is milliseconds; across an availability zone with TLS it is
noticeably more. The cost is paid *per connection*, which is exactly why a pool
that holds connections open is worth having, and why a serverless function that
connects on every invocation is the pathological case:

- it pays the full handshake on every cold start,
- it cannot reuse a connection between invocations,
- and concurrency is set by the platform, not by you — a thousand concurrent
  invocations means a thousand connection attempts.

This is why every serverless PostgreSQL product ships a pooler in front by
default (Neon, Supabase, RDS Proxy). It is not an upsell; it is the only way the
architecture works. See [13 · Managed PostgreSQL](../13-managed-postgres/README.md).

## What to take from this chunk

- A connection is a **process**, so connections are not free and not elastic.
- `max_connections` is a **restart-only** ceiling that also sizes shared memory.
- Your real connection count is **replicas × pool max**, plus everything else.
- `pg.Pool` bounds one process; only a server-side pooler bounds the total.

The next chunk is what a server-side pooler actually does with those
connections — and the pool mode that makes it either transparent or a source of
very confusing bugs.

## Trade-off

Process-per-connection is a deliberate trade PostgreSQL made: strong isolation
and a simpler, safer backend, paid for with a connection that is too expensive to
create casually and too heavy to have ten thousand of. A thread-per-connection or
async server (as MySQL and others use) inverts it — cheaper connections, weaker
isolation.

You are not going to change that trade, so the practical form of it is: **do not
try to make PostgreSQL hold many connections; put something in front of it that
holds many connections and needs few.** The cost of that is one more component in
the path, which is the subject of the rest of this topic.

## Gotchas

**Symptom:** `FATAL: sorry, too many clients already` under normal-looking load
**Cause:** replicas × per-process pool `max` exceeds `max_connections`. Each pool
is doing exactly what it was configured to do; nothing coordinates them.
**Fix:** Count the real total across every replica, worker, cron job and admin
session. Lower per-process `max`, or put a server-side pooler in front.

**Symptom:** Raising `max_connections` did not take effect
**Cause:** Its context is **postmaster** — a reload is not enough.
**Fix:** Restart. And treat the need to raise it as a signal to add a pooler
instead: more slots means more shared memory and more concurrent `work_mem`.

**Symptom:** The database is fine but a deploy causes connection errors
**Cause:** During a rolling deploy old and new pods are both up, doubling the
pool count for the overlap window.
**Fix:** Size for peak replica count including deploy overlap, not steady state.

**Symptom:** An administrator cannot connect to diagnose an outage
**Cause:** All slots consumed — this is the case `superuser_reserved_connections`
(default 3) exists for, and it works only if the ordinary application role is not
a superuser.
**Fix:** Never let the application connect as a superuser
([03 · App role should not own schema](../03-app-role-not-owner.md)). Grant
`pg_use_reserved_connections` to an operator role and set `reserved_connections`.

**Symptom:** Latency is dominated by connecting, in a serverless function
**Cause:** No connection reuse across invocations, plus the full TCP + TLS +
SCRAM + fork cost each time.
**Fix:** Connect through the provider's pooler endpoint, not the direct one.

## Interview questions

**★ Why is a PostgreSQL connection expensive?**
Because it is a separate operating-system process, forked per connection, with
its own memory contexts and caches — not a thread from a pool. That gives strong
isolation and makes each connection cost real memory and real setup time, which
is why PostgreSQL deployments put a pooler in front rather than raising
`max_connections`.

**★ Your API runs 20 replicas with a `pg.Pool` of 10. What is your connection count?**
Up to 200, against a default `max_connections` of 100 — and more during a rolling
deploy when old and new replicas overlap. `pg.Pool` bounds one process only; it
has no idea the other 19 exist. This is the arithmetic that requires a
server-side pooler.

**★ What is the difference between `pg.Pool` and PgBouncer?**
`pg.Pool` is a client-side pool inside one Node process, bounding that process's
concurrency. PgBouncer is a separate server-side process that bounds the *total*
number of backends across every client. They solve different halves of the
problem and are normally used together.

**Why can't you just raise `max_connections` to 1000?**
It is restart-only, it increases shared-memory allocation whether or not the
slots are used, and every additional active backend can allocate `work_mem` one
or more times over. You would be buying connection slots with memory that the
queries themselves need, and adding contention on shared structures.

**What are `superuser_reserved_connections` and `reserved_connections` for?**
They hold back slots so that exhaustion does not lock out the people who can fix
it. `superuser_reserved_connections` (default 3) is the last-resort superuser
reserve; `reserved_connections` (default 0) reserves slots for roles granted
`pg_use_reserved_connections`. Both are restart-only.

**Why is serverless especially bad for PostgreSQL connections?**
There is no reuse between invocations, so every cold start pays TCP + TLS + SCRAM
+ backend fork, and platform-controlled concurrency means a spike becomes a spike
in *connection attempts* rather than in queries on existing connections. Hence a
pooler endpoint being the default on every serverless PostgreSQL product.

---

← [TLS to the database](../06-tls.md) · Next → [Pool modes](02-pool-modes.md)
