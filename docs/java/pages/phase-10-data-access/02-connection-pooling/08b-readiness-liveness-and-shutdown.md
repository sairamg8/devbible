---
title: "A pod that started without a database is marked ready by default, and that turns a startup failure into a traffic-serving failure"
sidebar_label: "8b · Readiness, liveness and shutdown"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Actuator → Endpoints →
> Kubernetes Probes*
> ([docs.spring.io/spring-boot/reference/actuator/endpoints.html](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)),
> *Web → Graceful Shutdown*
> ([docs.spring.io/spring-boot/reference/web/graceful-shutdown.html](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)),
> and the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**[Chunk 8](08-starting-up-or-failing-fast.md) chose whether the pool blocks
startup. This chunk is the half that makes that choice safe — what the
orchestrator is told about the instance afterwards, and what happens to the pool
when the instance goes away again. Both ends are configured somewhere other than
the pool, which is why they are missed.**

## Readiness does not check the database by default

If the pool starts without a database, the application starts, the HTTP port
opens, and — unless something stops it — the orchestrator routes traffic to a pod
that cannot serve a single request.

🔴 **Spring Boot's readiness probe does not check the database by default.** The
reference is explicit:

> *By default, Spring Boot does not add other health indicators to these groups.*

The `readiness` group contains the application's own readiness state, not the
`db` health indicator. To make readiness mean "can actually serve", you have to
say so:

```yaml
management:
  endpoint:
    health:
      group:
        readiness:
          include: "readinessState,db"
```

The `db` indicator asks the `DataSource` for a connection and validates it, so
including it makes the probe reflect the pool's actual ability to hand one out —
which is the question the orchestrator is really asking.

## Boot tells you to think before doing that

On the **liveness** probe the documentation is unambiguous:

> *The "liveness" probe should not depend on health checks for external systems.
> If the liveness state of an application is broken, Kubernetes tries to solve
> that problem by restarting the application instance. This means that if an
> external system (such as a database, a Web API, or an external cache) fails,
> Kubernetes might restart all application instances and create cascading
> failures.*

⛔ **Never put `db` in the liveness group.** A database outage would restart every
instance in the fleet simultaneously — losing every warm cache and every in-flight
request, and achieving nothing, because restarting an application does not fix a
database.

On **readiness** it is a judgement call, and the documentation frames it as one:

> *As for the "readiness" probe, the choice of checking external systems must be
> made carefully by the application developers... Some external systems might not
> be shared by application instances, in which case they could be included in a
> readiness probe. Other external systems might not be essential to the
> application (the application could have circuit breakers and fallbacks), in
> which case they definitely should not be included.*

| Your service | `db` in readiness? |
|---|---|
| every endpoint needs the database | ✅ yes — an instance that cannot reach it should not get traffic |
| has caches, fallbacks or circuit breakers | ⛔ no — you would remove the whole fleet over a dependency it survives |
| the database is shared by every instance | ⚠️ careful — a database outage takes the *entire* fleet out of rotation at once, which is the same as being down |

🔴 **That last row is the subtle one.** If every instance shares one database and
`db` is in readiness, a database blip marks every pod unready simultaneously.
There is nothing left to route to, so the readiness check has converted a
partially-degraded service into a fully unavailable one — and unlike liveness, it
does at least not restart anything.

## The three-way interaction

| `initializationFailTimeout` | `db` in readiness | Result when the database is down at boot |
|---|---|---|
| positive | either | pod crash-loops; **rollout stalls; old version keeps serving** |
| negative | ✅ yes | pod starts, stays unready, **receives no traffic**; recovers on its own |
| negative | ⛔ no | 🔴 pod starts, **is marked ready, receives traffic, fails every request** |

The third row is the one that gets shipped, because
`initialization-fail-timeout: -1` is a single line that solves a visible
local-development annoyance, and the readiness half is invisible until
production.

⚠️ **Note the interaction with [chunk 3d](03d-the-fleet-budget.md).** If the
database is at `max_connections`, fail-fast means every newly scaled pod
crash-loops, the deployment replaces them, and each attempt asks the exhausted
server for more connections. Fail-fast is right, and it does not break that loop.

## The other end: shutting the pool down

An instance that is going away has the mirror-image problem — the pool must not
close while requests are still using it.

Spring Boot handles the web half. Graceful shutdown is **enabled by default** with
the embedded servers:

> *Existing requests will be allowed to complete* ... *No new requests will be
> permitted*

and the grace period is `spring.lifecycle.timeout-per-shutdown-phase`:

```yaml
server:
  shutdown: graceful          # the default; "immediate" disables it
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

`HikariDataSource` implements `Closeable`, so Spring closes the pool when the
context shuts down, and bean destruction order means beans that depend on the
`DataSource` are destroyed first. Combined with graceful shutdown, in-flight
requests finish before the pool goes.

⚠️ **The grace period must exceed your slowest request**, or requests are cut off
mid-transaction — which is safe (the database rolls back) but produces errors for
users who were mid-checkout. And it must be shorter than the orchestrator's own
termination grace period, or the process is killed outright and graceful shutdown
never completes.

⛔ **A pool created by hand outside Spring is yours to close.** A
`new HikariDataSource(config)` in a `main` method, a test fixture or a CLI tool
holds connections until the JVM exits, and on a long-lived process that is a
leak of `maximumPoolSize` server slots ([chunk 3c](03c-the-server-side-ceiling.md)).

## The trade-off

Every check on this page moves a decision out of the application and into the
platform, which is where it belongs and also where the application's authors
cannot see it. A readiness group defined in a Helm values file, a termination
grace period in a deployment manifest, and a pool setting in `application.yaml`
together determine what happens during a database outage — and no one file shows
the answer. The mitigation is to write the three-way table above down somewhere,
because the failure mode is not that any single value is wrong, it is that
nobody checked they compose.

## Gotchas

**⚠️ `initialization-fail-timeout: -1` without a database readiness check**
**Symptom:** pods report ready, receive traffic, and fail every request.
**Cause:** Boot's readiness group does not include the `db` indicator by default.
**Fix:** add `db` to `management.endpoint.health.group.readiness.include`, or do
not use a negative value.

**⚠️ Putting `db` in the liveness group**
**Symptom:** a database outage restarts every instance in the fleet.
**Cause:** liveness failure means "restart me", and restarting does not fix a
database.
**Fix:** the documentation says plainly not to. Readiness only.

**⚠️ Adding `db` to readiness for a service with fallbacks**
**Symptom:** the whole fleet leaves rotation over a dependency the service was
designed to survive.
**Cause:** readiness is binary and fleet-wide when the dependency is shared.
**Fix:** if the service has circuit breakers, let them do their job and keep the
probe about the application.

**⚠️ Forgetting `readinessState` when overriding the group**
**Symptom:** the pod is ready during startup, before the application is.
**Cause:** `include` replaces the group's contents; omitting `readinessState`
removes Boot's own signal.
**Fix:** `include: "readinessState,db"`, never just `db`.

**⚠️ A grace period shorter than the slowest request**
**Symptom:** errors for a small number of users on every deploy.
**Cause:** in-flight requests are cut off when the phase times out.
**Fix:** set `spring.lifecycle.timeout-per-shutdown-phase` above your p99.9
request duration — and below the orchestrator's termination grace period.

**⚠️ An orchestrator grace period shorter than the application's**
**Symptom:** graceful shutdown is configured and makes no difference.
**Cause:** the process is killed before the shutdown phase completes.
**Fix:** the platform's grace period must be the larger of the two.

**⚠️ A hand-built `HikariDataSource` that is never closed**
**Symptom:** a CLI tool or test suite holds connections for its whole run and the
database's connection count creeps up.
**Cause:** nothing closes a pool you created yourself.
**Fix:** try-with-resources, or an explicit `close()`. `HikariDataSource` is
`Closeable`.

**⚠️ Treating a stalled rollout as an incident**
**Symptom:** an alert fires because a deployment will not progress.
**Cause:** it is doing exactly what fail-fast is for — refusing to replace a
working version with a broken one.
**Fix:** read the crash-looping pod's first exception; it usually names the
misconfiguration.

## Interview questions

**★ You set `initializationFailTimeout` to a negative value. What else must you change?**
The readiness probe. Spring Boot's readiness health group does not include the
`db` indicator by default — the reference says Boot does not add other health
indicators to those groups — so the application starts, the port opens, the pod is
marked ready, and the orchestrator sends it traffic it cannot serve. Making
readiness mean "can actually serve" requires adding `db` explicitly to
`management.endpoint.health.group.readiness.include`, keeping `readinessState`
alongside it. Without that second change, starting degraded converts a startup
failure into a traffic-serving failure, which is strictly worse.

**★ Should the database be part of the liveness probe?**
No, and Boot's documentation says so directly: the liveness probe should not
depend on health checks for external systems, because a liveness failure tells
Kubernetes to restart the instance, and restarting does not fix a database. If
the database goes down and `db` is in the liveness group, every instance in the
fleet is restarted simultaneously — losing every warm cache and every in-flight
request, and creating exactly the cascading failure the probe was meant to
prevent. Readiness is the correct place for the question, and even there the
documentation frames it as a judgement call.

**★ When should the database *not* be in the readiness probe either?**
When the service is useful without it. Boot's wording is that external systems
which are not essential — where the application has circuit breakers and
fallbacks — definitely should not be included. There is also a subtler case: if
every instance shares one database, putting `db` in readiness means a database
blip marks the entire fleet unready at once, so there is nothing left to route
to. The readiness check has then converted a partially degraded service into a
fully unavailable one. It is still better than liveness, which would also restart
everything, but it is not free.

**★ What happens to the pool when the application shuts down?**
`HikariDataSource` implements `Closeable`, so Spring closes it when the
application context shuts down, and bean destruction order means anything
depending on the `DataSource` is destroyed first. Boot's graceful shutdown is
enabled by default for the embedded servers: existing requests are allowed to
complete and no new requests are permitted, within
`spring.lifecycle.timeout-per-shutdown-phase`. The two together mean in-flight
work finishes before the connections go. A pool you constructed yourself — in a
`main` method, a CLI tool or a test fixture — has none of that and must be closed
explicitly.

**★ How would you choose the shutdown grace period?**
Longer than your slowest legitimate request, so in-flight work is not cut off,
and shorter than the orchestrator's termination grace period, so the process is
not killed before the shutdown phase completes. Getting the second relationship
backwards is common and makes graceful shutdown appear not to work at all: the
application is doing the right thing and is simply killed part way through. It is
worth noting that being cut off is *safe* — the database rolls back the open
transaction — but it produces errors for users who were mid-request, on every
single deploy.

**★ Where does the answer to "what happens during a database outage" actually live?**
Spread across at least three files: the pool's `initializationFailTimeout` in
`application.yaml`, the readiness group in the actuator configuration, and the
probe and grace-period settings in a deployment manifest. No single one of them
determines the behaviour — they compose, and the interesting failure is when the
composition is wrong rather than when any individual value is. That is why the
three-way table is worth writing down explicitly: the most common production
surprise here is not a wrong setting, it is two settings that were each chosen
sensibly by different people.

---

← Prev: [8 · Starting up, or failing fast](08-starting-up-or-failing-fast.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8c · Watching the pool](08c-watching-the-pool.md)
