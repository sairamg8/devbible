---
title: "The database sets a hard ceiling at boot, only part of it is yours, and it cannot be raised during the incident it causes"
sidebar_label: "3c · The server-side ceiling"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation *Connections and
> Authentication* (`max_connections`, `reserved_connections`,
> `superuser_reserved_connections`)
> ([postgresql.org/docs/18/runtime-config-connection.html](https://www.postgresql.org/docs/18/runtime-config-connection.html))
> and the PostgreSQL 18 error-code appendix, SQLSTATE class 53
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

**`maximumPoolSize` looks like a property of your service. It is not. It is a
withdrawal from a single account the database opened when it started, and the
account cannot be topped up without restarting the server. Before you can budget
your pool ([chunk 3d](03d-the-fleet-budget.md)) you need to know exactly how big
the account is, how much of it is already reserved for other people, and what
happens the moment it is empty.**

## What the ceiling is

PostgreSQL 18's `max_connections`:

> *Determines the maximum number of concurrent connections to the database
> server. The default is typically 100 connections, but might be less if your
> kernel settings will not support it (as determined during initdb). **This
> parameter can only be set at server start.***
>
> *PostgreSQL sizes certain resources based directly on the value of
> `max_connections`. Increasing its value leads to higher allocation of those
> resources, including shared memory.*

Three consequences, all load-bearing:

- 🔴 **It is per *server*, not per database.** Ten databases in one cluster share
  one `max_connections`. A per-team budget that is not also a per-server budget
  is not a budget.
- 🔴 **It cannot be changed without a restart.** You cannot raise it during the
  incident it is causing. It is a planning-time parameter that presents itself as
  an operational one.
- 🔴 **Raising it is not free.** Shared memory is sized directly from it, and each
  connection is a separate backend process with its own private memory
  ([topic 01 chunk 4](../01-jdbc/04-connection-is-expensive.md)). A value of 500
  costs memory at boot whether or not anyone connects.

There is one more sentence worth carrying, because it catches people running
read replicas:

> *When running a standby server, you must set this parameter to the same or
> higher value than on the primary server. Otherwise, queries will not be allowed
> in the standby server.*

## Not all of it is yours

Two settings carve reserved slots out of the top, and they nest:

| Setting | Default | Who may use the slots it reserves |
|---|---|---|
| `superuser_reserved_connections` | **3** | superusers only — *"final reserve for emergency use"* |
| `reserved_connections` | **0** | superusers **and** roles with `pg_use_reserved_connections` |

The documentation describes the two tiers precisely:

> *Whenever the number of free connection slots is greater than
> `superuser_reserved_connections` but less than or equal to the sum of
> `superuser_reserved_connections` and `reserved_connections`, new connections
> will be accepted only for superusers and roles with privileges of
> `pg_use_reserved_connections`. If `superuser_reserved_connections` or fewer
> connection slots are available, new connections will be accepted only for
> superusers.*

So the number available to an ordinary application role is:

```
usable = max_connections - superuser_reserved_connections - reserved_connections
```

On a default install that is `100 - 3 - 0 = 97`.

⚠️ **`reserved_connections` defaults to zero, which means there is no middle tier
unless someone configured one.** That tier exists so an on-call engineer's
read-only diagnostic role can still connect while the application cannot — which
is precisely the moment you want it. Setting it is a five-minute change you can
only make *before* you need it:

```sql
-- at server start, in postgresql.conf
-- reserved_connections = 5

GRANT pg_use_reserved_connections TO oncall_readonly;
```

## What refusal looks like from Java

When the server has no slot left, the connection attempt fails with SQLSTATE
**`53300`** — condition name `too_many_connections`, in class 53, *insufficient
resources*. Two things about it surprise people.

**It is a rejection, not a timeout.** The server answers immediately. There is no
slow degradation to watch; connections succeed and then, one attempt later, they
do not.

🔴 **It is a failure to *create*, not a failure to *borrow*, so it usually
arrives wrapped.** HikariCP's own `SQLTransientConnectionException ... request
timed out after 30000ms` is what your `catch` block sees. The `53300` is
underneath it, reachable through `getNextException()`. A handler that logs only
`e.getMessage()` turns "the database refused us" into "the pool was busy", and
those have opposite fixes. [Chunk 5b](05b-the-exception-underneath.md) is
entirely about that.

⚠️ Note also that class 53 covers more than connections — `53200`
`out_of_memory`, `53100` `disk_full`, `53400` `configuration_limit_exceeded`.
Matching on the class alone is too coarse; match the five-character SQLSTATE.
The class structure is in
[topic 01 chunk 21c](../01-jdbc/21c-what-pgjdbc-throws.md).

## Defending the budget in the database itself

PostgreSQL will enforce a per-role or per-database cap for you, which turns "a
buggy service ate the whole server" into "a buggy service ate its own
allocation":

```sql
ALTER ROLE     shop_app  CONNECTION LIMIT 40;
ALTER DATABASE analytics CONNECTION LIMIT 10;
```

🔴 **This is the highest-value change in this chunk.** It costs nothing, it
survives a deploy that changes `maximumPoolSize` by accident, it survives an
autoscaler that runs away, and it converts a fleet-wide outage into one service's
problem. A service that exceeds its role limit is refused with `53300` while
every other service keeps working — which is a page for one team instead of an
incident for all of them.

## The trade-off

Every slot you reserve — for superusers, for the diagnostic role, for a
per-service cap — is a slot the application cannot use, so a tight budget gets
tighter. You are buying the ability to *diagnose and contain* an exhaustion with
capacity that would otherwise serve requests. That is a good trade, because
capacity you cannot get back into is worth less than capacity you can inspect.
The bad trade is the opposite instinct: raising `max_connections` so nothing has
to be reserved, which spends memory and scheduler time to remove a safety net.

## Gotchas

**⚠️ Assuming `max_connections` can be raised now**
**Symptom:** an incident bridge decides to bump it and discovers it needs a
restart of the thing that is already on fire.
**Cause:** *"This parameter can only be set at server start."*
**Fix:** during the incident the levers are shrinking pools, scaling in, and
terminating idle sessions. The parameter is for the post-mortem.

**⚠️ Raising `max_connections` as the standing fix**
**Symptom:** it is now 500, the database is measurably slower, and it still runs
out.
**Cause:** shared memory and per-backend memory both scale with it, and
[chunk 2's](02-why-a-small-pool-is-faster.md) argument still applies — more
concurrent work on a saturated server is slower work, so each connection is held
longer and the exhaustion returns.
**Fix:** if you genuinely need thousands of client connections, that is what a
pooler in front of the database is for ([chunk 8e](08e-pgbouncer-in-front.md)),
not a bigger ceiling.

**⚠️ Treating idle pooled connections as free**
**Symptom:** `pg_stat_activity` is full of `idle` backends and the server still
refuses new connections.
**Cause:** a slot is occupied by the connection *existing*, not by it being busy.
HikariCP's default `minimumIdle` equals `maximumPoolSize`, so a pool is
fixed-size and holds its full allocation whether or not traffic is arriving.
**Fix:** budget the maximum, never the average. If you want the pool to shrink
when idle, that is `minimumIdle` plus `idleTimeout` —
[chunk 4d](04d-idletimeout-and-minimumidle.md) — and it has its own costs.

**⚠️ Multiple databases on one cluster budgeted independently**
**Symptom:** each team's numbers are individually fine and the server still hits
the ceiling.
**Cause:** `max_connections` is per *server*. Databases are not isolation
boundaries for it.
**Fix:** one budget per server, owned by someone, with `ALTER DATABASE ...
CONNECTION LIMIT` enforcing the split so the arithmetic is checked by the
database rather than by a wiki page.

**⚠️ No `reserved_connections`, so nobody can get in to diagnose it**
**Symptom:** the application is refused and so are you, unless someone has the
superuser password to hand.
**Cause:** the default is zero, so the only reserve is the superuser one, and
using it means connecting as a superuser during an incident.
**Fix:** set it and grant `pg_use_reserved_connections` to the diagnostic role
in advance.

**⚠️ A standby with a smaller `max_connections` than the primary**
**Symptom:** the replica refuses queries entirely, not just at high connection
counts.
**Cause:** the documented requirement that a standby's value be at least the
primary's.
**Fix:** set them together, and remember the replica has its own ceiling that
your read-only pool spends from.

**⚠️ Matching on SQLSTATE class `53` rather than `53300`**
**Symptom:** a "too many connections, back off and retry" handler fires on
`disk_full`.
**Cause:** class 53 is *insufficient resources* generally.
**Fix:** compare the full five characters.

## Interview questions

**★ Why is the default `max_connections` only 100?**
Because each PostgreSQL connection is a separate operating-system process with
its own memory, and because several shared-memory structures are sized directly
from the parameter — the documentation says that in as many words. A high value
costs memory at boot whether or not the connections are used, and costs scheduler
pressure and lock contention when they are. The default is effectively a
statement that a hundred concurrent backends is already a great deal of
simultaneous work for one server, which is the same conclusion the client-side
pool-sizing guidance reaches from the other direction.

**★ How many connections can your application actually use?**
`max_connections` minus `superuser_reserved_connections` minus
`reserved_connections`, and then minus everything else pointed at that server —
other services, the migration runner, monitoring, humans, reporting tools. On a
default install the first calculation gives 97, and the second is the one that
matters. It is also per *server*, so every database in the cluster draws on the
same figure.

**★ What are the two tiers of reserved connections for?**
They keep the last slots away from the application so a human can still get in.
Once free slots fall to the sum of `superuser_reserved_connections` and
`reserved_connections`, only superusers and roles granted
`pg_use_reserved_connections` are accepted; once they fall to
`superuser_reserved_connections` or fewer, only superusers are. The defaults are
3 and 0, so out of the box there is only the superuser reserve — which means
diagnosing an exhaustion requires superuser credentials unless you set the middle
tier up in advance.

**★ Your application logs "Connection is not available, request timed out". How do you tell whether the database refused you?**
Read the chained exception. HikariCP's timeout exception copies the SQLState and
error code of the last failed connection attempt and chains the real driver
exception with `setNextException`, so `getNextException()` carries `53300` if the
server refused, or an authentication or DNS failure if that was the cause. If
`getNextException()` is null and the pool's own numbers show connections active
and in use, the pool is simply too small or too slow to turn over. The two cases
look identical in the top-level message and have completely different fixes.

**★ How would you stop one service from consuming the whole server?**
Enforce it in the database rather than trusting configuration: give each service
its own role and set `ALTER ROLE ... CONNECTION LIMIT`, or cap per database with
`ALTER DATABASE ... CONNECTION LIMIT`. A service that misconfigures its pool then
exhausts only its own allocation and fails alone, while everything else keeps
working. It also puts the budget in one auditable place instead of leaving it
implied by a YAML file in each repository.

**★ The database is at its connection ceiling right now. What can you actually do?**
Nothing that involves `max_connections`, because it needs a restart. The
available moves are all on the client side or in the database's own session
table: scale the offending deployment in, cut `maximumPoolSize` and redeploy,
terminate idle sessions with `pg_terminate_backend` against
`pg_stat_activity` rows that are `idle` and old, and — if you configured it
beforehand — connect through the reserved tier to look. Everything else is a
post-mortem action item, which is exactly why the reserved slots and the per-role
limits have to exist before the incident.

---

← Prev: [3b · Reducing Cm](03b-reducing-cm.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3d · The fleet budget](03d-the-fleet-budget.md)
