---
title: "13.2 · The providers, and connecting correctly"
sidebar_label: "02 · Providers & connecting"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against provider documentation —
> [Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
> [Supabase connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres),
> [AWS RDS parameters](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Parameters.html)
> — and the **PostgreSQL 18** docs. **Not sandbox-measured** — no console output
> on this page.
> ⚠️ **These are the fastest-moving facts in this corpus.** Every provider detail
> below was checked on **2026-08-13** and should be re-checked against current
> documentation before you rely on it.

**The most common connection incident on a managed platform is using the wrong
endpoint.** Every provider gives you at least two, they differ in one character,
and the wrong one fails only under load.

## The endpoint choice, which is the whole game

Providers expose a **direct** endpoint and a **pooled** endpoint. The direct one
is a real PostgreSQL backend; the pooled one is a pooler in front of it, with all
the transaction-pooling semantics from
[07 · PgBouncer](../07-pgbouncer/02-pool-modes.md).

**Neon** (documented 2026-08-13) uses **PgBouncer**, and the pooled endpoint is
distinguished by `-pooler` in the hostname:

```
direct:  ep-cool-darkness-123456.us-east-2.aws.neon.tech
pooled:  ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech
```

It runs `pool_mode=transaction` and documents up to **10 000** concurrent client
connections through the pooler, against a `max_connections` on the compute itself
that varies with size. The unsupported feature list matches PgBouncer's exactly —
`SET`/`RESET`, `LISTEN`/`NOTIFY`, temp tables, SQL-level `PREPARE`/`DEALLOCATE`,
session-level advisory locks — while **protocol-level prepared statements remain
supported**, consistent with PgBouncer 1.21+.

**Supabase** (documented 2026-08-13) uses **Supavisor**, and distinguishes by
**port**:

| Mode | Port | Use for |
|---|---|---|
| Direct connection | 5432 | persistent servers, VMs, long-lived containers |
| Supavisor **session** mode | 5432 | as a direct-connection substitute on IPv4-only networks |
| Supavisor **transaction** mode | **6543** | serverless and edge functions — many transient connections |

Two Supabase-specific details that catch people:

- Its documentation states transaction mode **does not support prepared
  statements**, and that you must disable them in your client library. This
  differs from Neon's PgBouncer, which does support the protocol-level form —
  a good illustration of why "PgBouncer behaviour" is not automatically "my
  provider's pooler behaviour".
- Direct connections use **IPv6** by default; Supavisor is IPv4-only. On an
  IPv4-only network the session-mode pooler is the documented substitute for a
  direct connection, and the IPv4 add-on swaps rather than dual-stacks.

**AWS RDS / Aurora** gives you an instance endpoint, and **RDS Proxy** as a
separate managed pooler. Aurora additionally provides a **reader endpoint** that
load-balances across replicas — which is a routing decision with all the
read-your-writes consequences from
[08 · Replicas](../08-replication/02-conflicts-and-routing.md), not a free
performance win.

### The rule

| Workload | Endpoint |
|---|---|
| Serverless / Lambda / edge functions | **pooled**, transaction mode |
| Long-lived containers and VMs | either; direct is fine with a sane `pg.Pool` |
| Migrations and DDL | **direct** — see below |
| `LISTEN`/`NOTIFY` workers | **direct** or a session-mode pool |
| `psql` for admin work | direct |

**Migrations should use the direct endpoint.** They need session semantics,
advisory locks (most migration tools take one to prevent concurrent runs), and
`CREATE INDEX CONCURRENTLY` — which cannot run in a transaction block and is
poorly served by transaction pooling. Pointing a migration tool at a
transaction-mode pooler produces confusing intermittent failures.

## Connection strings and TLS

```
postgresql://user:password@host:5432/dbname?sslmode=verify-full
```

Managed providers all offer TLS and most require it. The important point from
[06 · TLS](../06-tls.md) applies with full force here, because your traffic
crosses a network you do not control: **`sslmode=require` encrypts but verifies
nothing.** Use `verify-full` with the provider's CA bundle.

```js
import pg from 'pg';
import {readFileSync} from 'node:fs';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,   // the POOLED endpoint
  ssl: {
    ca: readFileSync(process.env.PGSSLROOTCERT),  // provider's CA bundle
    rejectUnauthorized: true,                     // chain + hostname
  },
  max: 10,
  connectionTimeoutMillis: 5_000,
});
```

Do **not** reach for `rejectUnauthorized: false` when a private CA fails —
that reduces you to `require`: encrypted and unauthenticated.

## Serverless is a different problem

The pathology from [07 · chunk 01](../07-pgbouncer/01-why-connections-cost.md):
a serverless function cannot reuse connections between invocations, and
concurrency is set by the platform. A thousand concurrent invocations means a
thousand connection attempts, each paying TCP + TLS + SCRAM + backend fork.

What actually works:

- **Always the pooled endpoint.** Non-negotiable.
- **Reuse the pool across invocations** by declaring it at module scope, outside
  the handler, so a warm container reuses it.
- **Keep `max` small** — often 1–2 per instance. Each concurrent instance has its
  own pool, so per-instance concurrency should be low.
- **Set `connectionTimeoutMillis`** so a saturated pool fails fast rather than
  holding the invocation open (and billing you for the wait).
- **Consider an HTTP-based driver** where offered — Neon's serverless driver
  connects over HTTP/WebSocket rather than the PostgreSQL wire protocol, which
  sidesteps connection setup entirely for one-shot queries. It has its own
  constraints (notably around transactions), so read before adopting.

## Choosing, briefly

Not an endorsement — the useful thing is knowing what each optimises for:

| Provider | Optimises for | Watch out for |
|---|---|---|
| **RDS** | control, maturity, ecosystem | you operate more of it; parameter groups; cost |
| **Aurora** | scale, fast failover, storage | cost model; reader endpoint routing semantics |
| **Cloud SQL / Azure** | integration with their platform | comparable trade-offs to RDS |
| **Neon** | serverless, scale-to-zero, branching | cold starts; connection model |
| **Supabase** | full backend (auth, storage, realtime), **RLS-centric** | Supavisor prepared-statement limits; IPv6 defaults |
| **Render / Fly / Railway** | simplicity | fewer knobs, smaller feature surface |

**Supabase deserves a specific note** because its authorization model is
row-level security applied directly against the database, with the user's
identity carried in the request. That makes
[14 · Row-level security](../14-rls/README.md) not a "should know" topic but the
central one if you build there — and it makes the `SET` vs `SET LOCAL` rule from
[07 · chunk 02](../07-pgbouncer/02-pool-modes.md) a **security** requirement
rather than a hygiene one.

## Trade-off

Provider-managed connection infrastructure trades **a decision you would have got
wrong for a decision you cannot revisit**. You do not have to deploy and operate
PgBouncer; you also cannot tune `default_pool_size`, choose your pool mode
freely, or fix a pooler limitation that blocks your ORM. Supabase's documented
prepared-statement restriction is exactly that shape — a constraint on your
application code, imposed by an infrastructure choice you did not make.

The second trade is **portability against convenience**. Your *data* is portable
— `pg_dump` works everywhere, and that is a real guarantee worth valuing. Your
*operational setup* is not: endpoints, pooler semantics, parameter groups,
extension availability and backup tooling are all provider-shaped, and switching
means redoing that layer.

The honest advice is to depend on **PostgreSQL** as heavily as you like and on
**provider-specific features** as little as you can bear, and to know which of
your dependencies is which.

## Gotchas

**Symptom:** Serverless functions exhaust connections despite a pooler existing
**Cause:** Connecting to the **direct** endpoint. The two hostnames differ by one
token (`-pooler`) or one port (5432 vs 6543).
**Fix:** Use the pooled endpoint. Verify the actual value in the deployed
environment, not in your local `.env`.

**Symptom:** Prepared statement errors through Supabase's transaction pooler
**Cause:** Supavisor's transaction mode is documented as not supporting prepared
statements — unlike PgBouncer 1.21+, which supports the protocol-level form.
**Fix:** Disable prepared statements in the client, or use session mode / a
direct connection for that workload.

**Symptom:** Migrations fail intermittently on a managed platform
**Cause:** They are running through a transaction-mode pooler — advisory locks
and `CREATE INDEX CONCURRENTLY` do not survive it.
**Fix:** Point migrations at the **direct** endpoint.

**Symptom:** Cannot connect from CI, works locally
**Cause:** Often IPv6 — Supabase direct connections are IPv6 by default while
many CI networks are IPv4-only.
**Fix:** Use the pooler (IPv4) or the IPv4 add-on.

**Symptom:** TLS works locally, fails in production with the provider's CA
**Cause:** `ssl: true` verifies against the system CA store.
**Fix:** Pass the provider's CA bundle as `ssl.ca` with
`rejectUnauthorized: true`. Never `rejectUnauthorized: false`.

**Symptom:** Reads are stale after switching to Aurora's reader endpoint
**Cause:** It load-balances across replicas — asynchronous ones.
**Fix:** This is read-your-writes; route reads that follow writes, and reads that
feed writes, to the primary
([08 · chunk 02](../08-replication/02-conflicts-and-routing.md)).

## Interview questions

**★ Why do managed providers give you two endpoints?**
One is a direct PostgreSQL connection and the other goes through a pooler. The
pooled endpoint multiplexes many clients onto few backends — essential for
serverless — but imposes transaction-pooling semantics. Using the direct endpoint
from serverless code exhausts connections; using the pooled endpoint for
migrations breaks advisory locks and `CREATE INDEX CONCURRENTLY`.

**★ Which workloads must use the direct endpoint?**
Migrations and DDL (advisory locks, `CREATE INDEX CONCURRENTLY`, session
semantics), `LISTEN`/`NOTIFY` workers, and interactive admin sessions. Everything
transient and high-concurrency should use the pooled endpoint.

**★ Do prepared statements work through a managed pooler?**
It depends on the pooler, which is the point. Neon runs PgBouncer and documents
protocol-level named prepared statements as supported; Supabase's Supavisor
documents transaction mode as **not** supporting prepared statements and tells
you to disable them client-side. "PgBouncer supports it" does not transfer
automatically to another provider's pooler.

**★ How should a serverless function manage its database connections?**
Pooled endpoint, pool declared at module scope so warm containers reuse it, small
`max` (1–2) because each instance has its own pool,
`connectionTimeoutMillis` set so saturation fails fast, and optionally an
HTTP-based driver where the provider offers one.

**What is portable between providers and what is not?**
The data and the SQL are portable — `pg_dump` works everywhere. The operational
layer is not: endpoints, pooler semantics, parameter groups, extension
availability and backup tooling are provider-shaped. Depend on PostgreSQL
heavily, on provider-specific features sparingly, and know which is which.

**Why does row-level security matter more on Supabase than elsewhere?**
Because it is the platform's authorization model — clients talk to the database
with the end user's identity, and RLS policies are what stop one user reading
another's rows. That promotes RLS from "should know" to central, and makes the
`SET LOCAL` versus `SET` distinction on pooled connections a security
requirement.

---

← [What you give up](01-what-you-give-up.md) · Next → [Row-level security](../14-rls/README.md)
