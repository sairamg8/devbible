---
title: "The timeout exception carries a four-number snapshot of the pool, and those four numbers tell you which of five different problems you have"
sidebar_label: "5 · Connection is not available"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`pool/HikariPool.java` `createTimeoutException()` and `logPoolState()`, read
> at tag `HikariCP-7.0.2`) and the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18.

**`Connection is not available, request timed out` is the most-seen and
least-read message HikariCP produces. People stop at the words and conclude the
pool is too small. The message does not stop there — it carries the pool's exact
state at the instant of failure, four numbers that distinguish an undersized pool
from a leak from slow queries from a database that is refusing connections
outright. Those four cases have four different fixes, and one of them is made
*worse* by the change everybody reaches for.**

## The message

`createTimeoutException()` builds it from the pool's live state. The format,
from the source:

```
<poolName> - Connection is not available, request timed out after <elapsedMillis>ms (total=<n>, active=<n>, idle=<n>, waiting=<n>)
```

The exception type is `SQLTransientConnectionException` — a subclass of
`SQLException` whose contract says the operation may succeed if retried
([topic 01 chunk 21b](../01-jdbc/21b-the-subclass-hierarchy.md)). That type is a
claim about the *pool*, not about the database, and
[chunk 5b](05b-the-exception-underneath.md) is about why it can be misleading.

## What each number means

| Field | Meaning |
|---|---|
| `total` | connections the pool currently holds — created and not yet retired |
| `active` | of those, how many are **handed out** to threads right now |
| `idle` | of those, how many are **available** to be borrowed |
| `waiting` | threads currently blocked inside `getConnection()` |
| `elapsedMillis` | how long *this* thread waited before giving up |

In normal operation `total = active + idle`. `waiting` is not part of that sum at
all — it counts *threads*, not connections, and it is the number that tells you
how bad the queue is rather than how big the pool is.

🔴 **The single most useful comparison is `total` against your configured
`maximumPoolSize`.** If `total` is at the maximum, the pool built everything it
was allowed to and the problem is on the *usage* side. If `total` is *below* the
maximum while threads are waiting, the pool wanted to create more connections and
**could not** — which means the problem is the database or the network, and no
amount of pool tuning will touch it.

## The diagnostic matrix

| `total` vs max | `active` | `idle` | `waiting` | What it is |
|---|---|---|---|---|
| at max | = `total` | 0 | high, **rising, never falls** | 🔴 **deadlock or leak** — nothing is being returned |
| at max | = `total` | 0 | high, **oscillating with load** | pool genuinely too small, or queries slower than the budget |
| **below max** | low | low | high | 🔴 **the database is refusing or unreachable** — creation is failing |
| at max | < `total` | **> 0** | > 0 | 🔴 **every connection is dead** — borrows keep failing validation |
| 0 | 0 | 0 | any | the pool has nothing at all — a startup failure, or total loss of connectivity |

Read the third row twice. **Threads waiting while the pool is below its maximum
is not a pool-size problem**, and it is the one case where raising
`maximumPoolSize` is guaranteed to achieve nothing: the pool already has
permission to create connections it cannot create. The reason is in the chained
exception ([chunk 5b](05b-the-exception-underneath.md)) — commonly PostgreSQL's
`53300 too_many_connections` ([chunk 3c](03c-the-server-side-ceiling.md)), an
authentication failure after a credential rotation, or DNS after a failover.

And the fourth row is the one nobody predicts. **Connections are sitting idle and
threads are still timing out** — which sounds impossible until you remember that
a borrow validates before handing over. If every connection in the pool is dead
(a failover, a firewall flush, a database restart), each borrow takes an idle
connection, fails to validate it, evicts it, and tries again. Connections are
available and none of them work. The fix is not a bigger pool; it is
[chunk 4c's](04c-keepalive-and-the-reapers.md) clocks and a retry.

## Distinguishing a leak from a small pool

Rows one and two look identical in a single exception. They are told apart by
**time**, which is why one exception is never enough:

| | undersized pool | leak or deadlock |
|---|---|---|
| `waiting` over time | rises and falls with traffic | rises monotonically |
| success rate | some requests succeed | goes to zero and stays there |
| recovery when traffic stops | recovers within seconds | does not recover at all |
| restart | comes back and degrades again under load | comes back and degrades again over *time* |
| `active` | at maximum only during peaks | pinned at maximum, including at 3 a.m. |

🔴 **"Recovers when traffic stops" is the discriminator.** Connections that are
leaked are never returned, so a quiet period does not help. A pool that is merely
too small empties and refills constantly.

⚠️ **A third case hides in row two: queries got slower.** The pool size did not
change and the traffic did not change, but a missing index or a bloated table
doubled every query's duration, so each connection is held twice as long and the
pool's effective capacity halved. The pool metrics look exactly like an
undersized pool. What separates them is that query latency moved and pool size
did not — which is why pool graphs are close to useless without query-latency
graphs beside them.

## Watching it continuously

You do not have to wait for an exception. HikariCP logs a pool snapshot at DEBUG,
in the same shape, on its housekeeping cycle. The format from the source:

```
<poolName> - <prefix>stats (total=<n>/<max>, idle=<n>/<min>, active=<n>, waiting=<n>)
```

Note that this one shows the **limits** alongside the values — `total` against
`maximumPoolSize` and `idle` against `minimumIdle` — which is the comparison the
exception makes you do in your head.

```yaml
logging:
  level:
    com.zaxxer.hikari.pool.HikariPool: DEBUG
```

⚠️ **Turn it on when investigating, not permanently.** It logs on every
housekeeping sweep, forever, for every pool. The durable equivalent is the
metrics ([chunk 8c](08c-watching-the-pool.md)), which give you the same numbers
as time series you can graph and alert on.

## What to do for each diagnosis

| Diagnosis | The fix | The change that makes it worse |
|---|---|---|
| leak | find the unclosed borrow ([chunk 6](06-leak-detection.md)) | raising `maximumPoolSize` — it delays the outage |
| deadlock | reduce `Cm` ([chunk 3b](03b-reducing-cm.md)) | raising `connectionTimeout` |
| genuinely too small | raise the pool, within the fleet budget ([chunk 3d](03d-the-fleet-budget.md)) | raising it past what the database can serve |
| slow queries | fix the queries; add `statement_timeout` | raising the pool — more concurrent slow queries |
| database refusing | read the chained exception ([chunk 5b](05b-the-exception-underneath.md)) | anything in the pool configuration |
| all connections dead | `maxLifetime` / `keepaliveTime` and a retry | validation tuning |

## The trade-off

These four numbers are a snapshot from the instant of failure, and a snapshot
cannot show a trend. That is a genuine limitation, not something to work around
by staring harder at one stack trace: telling a leak from an undersized pool
requires two observations at different times. The reason to read the numbers at
all is that they *eliminate* possibilities cheaply — `total` below maximum rules
out every pool-sizing explanation in one glance — and cheap elimination is worth
a great deal at three in the morning.

## Gotchas

**⚠️ Reading the message and not the numbers**
**Symptom:** `maximumPoolSize` is raised, and the incident continues or worsens.
**Cause:** "timed out" is the symptom of five different problems.
**Fix:** read `total`, `active`, `idle` and `waiting` before changing anything.

**⚠️ Ignoring `total` when it is below the maximum**
**Symptom:** hours spent tuning a pool that is not the problem.
**Cause:** the pool could not create the connections it was allowed to create.
**Fix:** that is a database or network failure. Go to the chained exception.

**⚠️ Assuming `idle` greater than zero means connections are usable**
**Symptom:** timeouts with idle connections apparently available.
**Cause:** every borrow validates, fails, evicts and retries — the connections
exist and are all dead.
**Fix:** treat it as a connectivity event, not a sizing one.

**⚠️ Diagnosing a leak from one exception**
**Symptom:** a genuine capacity shortage is chased as a leak for a week.
**Cause:** the two look identical in a single snapshot.
**Fix:** compare `waiting` over time, and check whether the pool recovers when
traffic stops.

**⚠️ Forgetting that queries can get slower without anything changing**
**Symptom:** a pool that was correctly sized for a year starts timing out with no
deployment.
**Cause:** data growth crossed a threshold and a query plan changed; each
connection is now held longer.
**Fix:** put query latency and pool utilisation on the same graph. The pool is
downstream of query duration.

**⚠️ Logging only `e.getMessage()`**
**Symptom:** the four numbers are in the log but the real cause is not.
**Cause:** the driver's exception is chained, not concatenated
([chunk 5b](05b-the-exception-underneath.md)).
**Fix:** log the whole exception, including `getNextException()`.

**⚠️ Leaving `HikariPool` at DEBUG in production**
**Symptom:** log volume grows by a snapshot per pool per housekeeping sweep,
forever.
**Cause:** the pool-state logging is unconditional at that level.
**Fix:** enable it for an investigation; use metrics for the permanent view.

**⚠️ Alerting on the exception rather than on `waiting`**
**Symptom:** the first signal is a user-facing failure.
**Cause:** by the time the exception is thrown, threads have already waited the
entire `connectionTimeout`.
**Fix:** alert on `hikaricp.connections.pending` above zero for a sustained
period — it rises before anything fails.

## Interview questions

**★ What does `Connection is not available, request timed out after 30000ms` actually tell you?**
On its own, only that a thread waited the full `connectionTimeout` without being
handed a connection. The useful part is the parenthesis that follows it:
`total`, `active`, `idle` and `waiting` — the pool's state at that instant.
`total` against your configured maximum says whether the pool built everything it
was allowed to; `active` against `total` says whether the connections are handed
out; `idle` says whether any were available; and `waiting` says how many threads
are queued behind you. Those four distinguish an undersized pool, a leak, a
deadlock, slow queries and a database refusing connections, which have completely
different fixes.

**★ `waiting` is high but `total` is below `maximumPoolSize`. What is happening?**
The pool wanted to create more connections and could not. It has permission —
`total` is under the maximum — so the failure is in creating the connection
itself: the database is refusing (`53300 too_many_connections` if the server is at
its ceiling), credentials have changed, DNS is pointing at a host that is gone
after a failover, or the network is unreachable. This is the one case where
raising `maximumPoolSize` is guaranteed to do nothing at all, and the real
diagnosis is in the chained exception, which carries the driver's own error.

**★ How do you tell a connection leak from a pool that is simply too small?**
By watching over time rather than reading one exception, because in a single
snapshot they are identical. An undersized pool has `waiting` rising and falling
with traffic, some requests succeeding throughout, and recovery within seconds
when load drops. A leak has `waiting` rising monotonically, a success rate that
goes to zero and stays there, and — the decisive test — no recovery at all when
traffic stops, because leaked connections are never returned. A leak also
degrades as a function of *time* after a restart rather than as a function of
load.

**★ Can you time out while connections are idle?**
Yes, and it is the most confusing row in the table. Every borrow validates the
connection before handing it over, so if all the connections in the pool are dead
— after a failover, a database restart, or a firewall flushing its state table —
each borrow takes an idle connection, fails validation, evicts it, and tries the
next. Connections are available and none of them are usable, so threads time out
with a non-zero `idle` count. The fix is the connection-age settings and a retry,
not the pool size.

**★ Nothing was deployed and the pool started timing out. What is your first hypothesis?**
That queries got slower. The pool's effective capacity is its size divided by how
long each connection is held, so a query whose plan changed — because a table
grew past the point where the planner switches strategies, or because statistics
went stale — halves the pool's throughput without anybody touching it. From the
pool's metrics this is indistinguishable from being undersized, which is exactly
why pool utilisation and query latency belong on the same dashboard. Raising the
pool in this case adds more concurrent slow queries to a database that is already
struggling.

**★ How would you get a continuous view instead of waiting for the exception?**
Two ways, with different lifetimes. For an investigation, set
`com.zaxxer.hikari.pool.HikariPool` to DEBUG and HikariCP logs the same four
numbers on every housekeeping sweep — and helpfully includes the limits, so you
see `total` against the maximum and `idle` against the minimum without doing the
comparison yourself. For the permanent view, use the Micrometer metrics, which
expose the same values as time series. The signal worth alerting on is pending
threads sustained above zero, because that rises well before the first request
actually fails.

**★ Which change makes each of these worse?**
Raising `maximumPoolSize` makes a leak worse, because it postpones the outage and
lets more connections be lost before anyone notices. Raising `connectionTimeout`
makes a deadlock worse, because a longer wait cannot resolve a cycle and simply
holds request threads for longer. Raising the pool makes slow queries worse,
because it puts more concurrent work on a database that is already the
bottleneck. And nothing in the pool configuration touches a database that is
refusing connections. Every one of those is the change people reach for first,
which is the argument for reading the four numbers before touching anything.

---

← Prev: [4e · When a clock is silently disabled](04e-when-a-clock-is-silently-disabled.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [5b · The exception underneath](05b-the-exception-underneath.md)
