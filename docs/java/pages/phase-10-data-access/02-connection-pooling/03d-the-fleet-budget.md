---
title: "The autoscaler multiplies your pool size, and the sum is what hits the database — at the exact moment you are under load"
sidebar_label: "3d · The fleet budget"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation *Connections and
> Authentication*
> ([postgresql.org/docs/18/runtime-config-connection.html](https://www.postgresql.org/docs/18/runtime-config-connection.html)),
> the HikariCP 7.0.2 README `minimumIdle` / `maximumPoolSize` entries
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> and the HikariCP wiki *About Pool Sizing*
> ([github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**[Chunk 3c](03c-the-server-side-ceiling.md) established that the database has a
fixed, boot-time budget and that only part of it is yours.
This chunk spends it. The arithmetic is trivial — multiplication — and almost
nobody does it, because `maximumPoolSize` is configured in a file that belongs to
one service and the budget belongs to a server none of those files mention.**

## The calculation nobody does until the first outage

```
total connections = instances x maximumPoolSize
                  + migration runner
                  + scheduled / batch workloads
                  + monitoring agent
                  + human sessions
                  + BI and reporting tools
                  + anything else pointed at this server
```

A worked budget against the default `max_connections = 100`, so
`usable = 100 - 3 - 0 = 97`:

| Consumer | Slots |
|---|---|
| 6 application pods x pool of 10 | 60 |
| a second service, 3 pods x pool of 8 | 24 |
| Flyway migration runner during a deploy | 1 |
| a `postgres_exporter` scrape | 1–2 |
| two engineers in `psql` | 2 |
| a BI tool | 5 |
| **total** | **~93** |
| **usable** | **97** |

It fits — with four slots of headroom, which is to say it does not really fit at
all. One extra pod, one extra engineer, or one rolling deploy and it is over.

🔴 **Budget the pool's *maximum*, never its average.** HikariCP's `minimumIdle`
defaults to `maximumPoolSize`, and the README recommends leaving it that way:

> *we recommend not setting this value and instead allowing HikariCP to act as a
> fixed size connection pool.*

A fixed-size pool tends toward holding all of its connections open whether or not
it is using them. An idle service still occupies its full allocation. That is a
feature — it is why borrows are fast and why traffic spikes do not have to wait
for connection setup — but it makes the average irrelevant to the budget.

## What autoscaling does to it

Here the arithmetic turns hostile, because a horizontal autoscaler multiplies the
left-hand term while nothing multiplies the budget:

| Replicas | Pool 10 | Pool 20 |
|---|---|---|
| 3 | 30 | 60 |
| 6 | 60 | 120 ⛔ |
| 20 | 200 ⛔ | 400 ⛔ |

**It is the sum that hits the server, and the sum is what scales.** So the pool
size is not chosen for one instance; it is chosen so that the *fleet at maximum
replicas* fits:

```
maximumPoolSize <= (usable - fixed consumers) / max_replicas
```

With 97 usable, roughly 10 fixed consumers and an HPA ceiling of 20 replicas,
that is `87 / 20 ≈ 4`.

**Four.** Which sounds absurd until you put it next to
[chunk 2](02-why-a-small-pool-is-faster.md): twenty replicas times four is eighty
concurrent queries, and the wiki's own PostgreSQL benchmark note is that *"TPS
rates start to flatten out at around 50 connections"*. Eighty is already past the
useful range. The small per-instance number is not a sacrifice; it is the same
answer arriving from a different direction.

⚠️ **Add the deploy surge.** A rolling update runs old and new instances together
— Kubernetes' default `maxSurge` is 25%, so a 20-replica deployment briefly runs
25. Budget the surge, not the steady state, or every deploy during peak traffic
is an incident. The corrected form:

```
maximumPoolSize <= (usable - fixed consumers) / (max_replicas x (1 + maxSurge))
```

## Why the failure is always at the worst moment

🔴 **The failure mode is a positive feedback loop, and it is correlated with load
by construction:**

1. Traffic rises.
2. The autoscaler adds pods.
3. Each new pod opens a full pool.
4. The fleet crosses `max_connections`.
5. Connections are refused — `53300`, across *every* pod, including the healthy
   ones that were coping.
6. Health checks fail. The orchestrator restarts pods, which reopen pools.
7. More replicas are added, because the service still looks unhealthy.

The scale-out that was meant to absorb the spike is what breaks the service, and
step 7 makes it self-sustaining. It does not recover on its own; someone has to
scale *in*.

This is the argument for hard limits in the database
([chunk 3c](03c-the-server-side-ceiling.md)): with `ALTER ROLE ... CONNECTION
LIMIT` the loop still starts, but it stops at the boundary of one service instead
of taking the server with it.

## Writing it down where it can be checked

The budget belongs somewhere both teams can see, and the pool size should be
derived from it rather than typed in:

```yaml
# derived from: usable 97 − fixed 10 = 87; max_replicas 20 × 1.25 surge = 25
# 87 / 25 = 3.48 → 3
spring:
  datasource:
    hikari:
      pool-name: shop-primary
      maximum-pool-size: 3
```

⚠️ **A comment is not enforcement.** The enforcement is the role's
`CONNECTION LIMIT` and an alert on `pg_stat_activity` count as a fraction of
`max_connections`. The comment is there so the next person to double
`max-replicas` knows they have just spent a budget they did not know existed.

## The trade-off

Sizing pools against a fleet budget means each instance gets a small pool, so a
single instance under a burst queues sooner and `connectionTimeout`
([chunk 4](04-the-six-clocks.md)) starts to matter a great deal more. You are
choosing per-instance queuing over fleet-wide refusal. That is the right choice
every time: queuing is bounded, visible per request, and recovers by itself,
whereas exhausting `max_connections` takes down services that had nothing to do
with the burst and does not recover without intervention.

## Gotchas

**⚠️ Sizing the pool per instance and letting the autoscaler multiply it**
**Symptom:** the service is stable at three replicas and falls over at ten.
**Cause:** `instances x maximumPoolSize` crossed the usable budget.
**Fix:** derive `maximumPoolSize` from the budget divided by the *maximum*
replica count.

**⚠️ Budgeting the steady-state replica count**
**Symptom:** every deploy at peak causes a brief outage; the same deploy at night
is fine.
**Cause:** `maxSurge` runs old and new instances simultaneously, so the peak
footprint is above the configured maximum.
**Fix:** budget `max_replicas x (1 + maxSurge)`.

**⚠️ Forgetting the migration runner**
**Symptom:** the deploy fails at the Flyway step with a connection error, and the
schema is left partly applied.
**Cause:** the migration needs a connection *and* a lock at the exact moment new
pods are starting their pools — the busiest instant in the whole budget.
**Fix:** run migrations before the new pods start, from a dedicated role with its
own small `CONNECTION LIMIT` so it cannot be crowded out.

**⚠️ Counting only the primary**
**Symptom:** the read-replica pool is sized generously because "reads are cheap".
**Cause:** each application instance may hold two pools, and the replica has its
own ceiling.
**Fix:** budget every server separately, and count both pools per instance.

**⚠️ Serverless or per-request instances holding pools**
**Symptom:** connection counts that bear no relation to the configured pool size.
**Cause:** each function instance carries its own pool, and the platform may run
hundreds of them; scale-to-zero and cold starts make the count unpredictable.
**Fix:** a pool of 1–2 per instance, plus a pooler in front of the database
([chunk 8e](08e-pgbouncer-in-front.md)). This is the case a pooler exists for.

**⚠️ A `@Scheduled` job on every replica**
**Symptom:** the connection count spikes on the hour, every hour.
**Cause:** the job runs on all instances rather than on one, and each needs a
connection while the request path is still using its pool.
**Fix:** elect a leader or use a scheduling lock, so the job costs one connection
rather than `instances`.

**⚠️ Treating the budget as a property of the application repository**
**Symptom:** a team doubles `max-replicas` and a different team's service starts
failing.
**Cause:** the constraint lives on a server nobody's YAML mentions.
**Fix:** one budget document per database server, per-role `CONNECTION LIMIT`
enforcing it, and an alert on connection count against `max_connections`.

**⚠️ Load-testing one instance**
**Symptom:** a single pod handles the target throughput comfortably, and the
fleet does not.
**Cause:** the single-instance test never exercises the shared ceiling, and a
lone pod with the whole budget to itself behaves like a much bigger pool.
**Fix:** test at the replica count you intend to run, against a database
configured like production's.

## Interview questions

**★ How do you choose `maximumPoolSize` for a service that autoscales?**
Not from the service. Start from the database's usable budget —
`max_connections` minus the two reserved settings — subtract every fixed consumer
such as migrations, monitoring, humans and reporting, and divide what remains by
the maximum replica count including deploy surge. Then take the smaller of that
and the throughput number from the sizing formula. The result is often
uncomfortably small, three or four, and that is usually correct: twenty replicas
with a pool of four still permit eighty concurrent queries, which is already past
where the wiki says PostgreSQL throughput flattens out.

**★ A service is fine at 3 replicas and falls over at 20. First hypothesis?**
That the fleet crossed `max_connections`. Twenty replicas times a pool of ten is
two hundred connections against a default ceiling of a hundred, and because
`minimumIdle` defaults to `maximumPoolSize` each instance tries to hold its full
pool whether busy or not — so the footprint is the configured maximum, not the
observed usage. The confirming evidence is `53300` on the chained exception under
HikariCP's timeout message, and a `pg_stat_activity` count pinned at the ceiling.
The tell that separates it from a slow-query problem is that instances which were
previously healthy start failing at the same instant the new ones start.

**★ Why does this failure mode always happen under load?**
Because the thing that consumes the last connections is the autoscaler, and the
autoscaler is triggered by load. Worse, it is self-sustaining: refused
connections fail health checks, failed health checks look like insufficient
capacity, and the orchestrator adds more instances, each of which opens another
pool. The loop does not converge and does not recover without someone scaling in.
Designing against it means the fleet's *maximum* footprint must fit the budget —
the autoscaler must not be able to write a cheque the database cannot cash.

**★ Why does an idle service still count against the budget?**
Because HikariCP's default `minimumIdle` equals `maximumPoolSize`, which the
README explicitly recommends, making the pool fixed-size: it opens connections up
to its maximum and keeps them. A connection occupies a server slot by existing,
not by being busy, and each one is a live backend process. So the budget is a sum
of configured maximums, not of observed concurrency, and an idle overnight fleet
consumes exactly what a busy one does.

**★ Is a smaller pool per instance not just moving the queue into the application?**
Yes, and that is the point. The queue has to be somewhere. Inside the
application it is bounded by `connectionTimeout`, visible per request, attributed
to the service that caused it, and it drains on its own. In the database it is
`max_connections` refusing everybody, which is unbounded in blast radius, not
attributable, and does not drain. So moving the queue into the application is
not a workaround — it is choosing the failure mode you can survive, which is the
same axiom the pool-sizing guidance states as *"a small pool, saturated with
threads waiting for connections"*.

**★ What breaks first when a serverless platform runs your service?**
The assumption that instance count is bounded and known. Each function instance
carries its own pool, cold starts create instances unpredictably, and the
platform's scaling limit is usually far above anything you would run in a
container fleet. So `instances x maximumPoolSize` becomes both large and
unknowable, and the fleet formula has no usable input. The two responses are a
pool of one or two per instance, and a transaction-mode pooler in front of the
database so that client connections and server backends stop being the same
number.

**★ How would you make the budget hard to violate rather than merely documented?**
Three layers. In the database, `ALTER ROLE ... CONNECTION LIMIT` per service so
one service can only exhaust its own allocation, plus `reserved_connections` so
diagnosis stays possible. In the deployment, derive `maximum-pool-size` from the
budget with the calculation written next to it, so raising `max-replicas` forces
someone to look at it. In monitoring, alert on `pg_stat_activity` count as a
fraction of `max_connections`, well before it reaches the ceiling — that is the
only one of the three that warns you *before* the incident rather than containing
it during.

---

← Prev: [3c · The server-side ceiling](03c-the-server-side-ceiling.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3e · Two pools, not one bigger](03e-two-pools-not-one-bigger.md)
