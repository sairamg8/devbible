---
title: "One setting decides whether your service refuses to start when the database is down, or starts and serves errors — and both answers are defensible"
sidebar_label: "8 · Starting up, or failing fast"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README `initializationFailTimeout`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP),
> raw at tag `HikariCP-7.0.2`) and the Spring Boot 4.1 reference *Actuator →
> Endpoints → Kubernetes Probes*
> ([docs.spring.io/spring-boot/reference/actuator/endpoints.html](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**When a pool is created and the database is unreachable, there are two
reasonable behaviours. **Refuse to start**, so a broken deployment never replaces
a working one. Or **start anyway** and keep trying in the background, so a
temporary database blip does not turn every restarting instance into a crash
loop. HikariCP lets you choose with one number, and the choice is genuinely a
choice — but it only works if you also get a second thing right, and most people
only configure the first.**

## The three behaviours

> *This property controls whether the pool will "fail fast" if the pool cannot be
> seeded with an initial connection successfully.* ... *Default: 1*

| `initializationFailTimeout` | What happens at pool creation |
|---|---|
| **positive** (default `1`) | block trying to acquire an initial connection for that many milliseconds; **throw** if it fails. The exception is raised after the `connectionTimeout` period |
| **zero** | attempt to obtain and validate a connection. *"If a connection is obtained, but fails validation, an exception will be thrown and the pool not started."* If a connection cannot be obtained at all, the pool **starts** |
| **negative** | skip the initial attempt entirely; the pool **starts immediately** and acquires connections in the background |

🔴 **The default is fail-fast.** A value of `1` is not "try for one millisecond
and give up"; the attempt itself is bounded by `connectionTimeout`, and the
initialization timeout is applied on top of that. So a default pool blocks
startup for up to roughly `connectionTimeout` and then throws.

⚠️ **Zero is the strangest of the three**, and it is worth reading twice: it fails
on a connection that is obtained and then fails *validation*, but tolerates not
being able to obtain one at all. It distinguishes "the database answered and
something is wrong" from "the database did not answer".

## Fail fast is usually right, and the reason is deployment safety

```yaml
spring:
  datasource:
    hikari:
      initialization-fail-timeout: 1      # the default — keep it
      connection-timeout: 3000
```

In a rolling deployment, a pod that crashes at startup never becomes ready, the
rollout stalls, and **the previous version keeps serving traffic**. So a release
with a wrong password, a wrong host, a missing database or a forgotten firewall
rule cannot replace a working release. The failure is loud, immediate, and
contained to the new pods.

🔴 **That property is worth more than it sounds.** The alternative — starting
successfully and failing every request — produces a rollout that completes, an
old version that is gone, and an outage that has to be diagnosed rather than
simply rolled back.

## When starting degraded is the better answer

Three situations:

- **Local development and `docker compose`**, where the application and the
  database start together and the application usually wins the race. Failing fast
  there means a crash loop on every `up`, which teaches people to add sleeps.
- **A service that is genuinely useful without the database** — one that serves
  cached data, or whose database dependency is behind a circuit breaker.
- **A restart during a database incident.** If every instance is restarting while
  the database is down, fail-fast means none of them can come back until the
  database does, and then all of them start at once.

```yaml
spring:
  datasource:
    hikari:
      initialization-fail-timeout: -1     # start now, connect later
```

⛔ **But this is only half a configuration**, and the other half —
readiness — is [chunk 8b](08b-readiness-liveness-and-shutdown.md). Choosing to
start degraded without also changing the readiness probe is strictly worse than
not choosing it at all.

## The trade-off

Fail-fast trades availability during a dependency outage for safety during a
deployment. Start-degraded trades the opposite way. Neither is universally
correct, and the useful framing is: *which failure would you rather explain?* A
deploy that refused to roll out, or a deploy that rolled out and took the service
down. Most teams prefer the first, which is why the default is the default —
and the ones who prefer the second usually have not configured readiness to make
it safe.

## Gotchas

**⚠️ Expecting `-1` to let the application start without a database**
**Symptom:** it still fails at boot, now with a Flyway error.
**Cause:** migrations run at startup and need a connection of their own.
**Fix:** the setting only governs the pool. Disable or defer migrations too, if
that is really what you want.

**⚠️ Reading the default `1` as "one millisecond"**
**Symptom:** surprise that startup blocked for thirty seconds.
**Cause:** the attempt is bounded by `connectionTimeout`, and the initialization
timeout applies on top of that.
**Fix:** if you want a fast failure at startup, lower `connectionTimeout` — it is
the number that dominates.

**⚠️ Setting `0` thinking it means "do not fail"**
**Symptom:** the application refuses to start when the database is reachable but
returning errors, and starts when the database is completely unreachable — the
opposite of the intuition.
**Cause:** zero fails on a *validation* failure and tolerates an *acquisition*
failure.
**Fix:** use a positive value for fail-fast and a negative one for
start-degraded. Zero is a specialist choice.

**⚠️ A long `connection-timeout` making startup slow**
**Symptom:** pods take thirty seconds longer than expected to become ready during
a database blip, and the deployment's progress deadline expires.
**Cause:** startup blocks for the connection attempt.
**Fix:** the request-path value from [chunk 4](04-the-six-clocks.md) — a second or
two — is also the right startup value.

**⚠️ Different settings in development and production**
**Symptom:** a configuration that works locally behaves differently in the one
place it matters.
**Cause:** `-1` added to `application-local.yaml` to fix `docker compose`, then
copied into the shared profile.
**Fix:** if the values must differ, keep the difference in the local profile
only, and make sure production's readiness configuration matches production's
choice.

**⚠️ Assuming a stalled rollout is a failure**
**Symptom:** an incident is declared because a deployment will not progress.
**Cause:** it is doing exactly what it should — refusing to replace a working
version with a broken one.
**Fix:** read the crash-looping pod's first exception. It usually names the
misconfiguration directly.

## Interview questions

**★ What does `initializationFailTimeout` control?**
Whether the pool fails fast when it cannot obtain a connection at creation. A
positive value — the default is 1 — makes pool construction block for the
connection attempt and throw if it fails, so the application does not start. A
negative value skips the initial attempt entirely and the pool starts
immediately, acquiring connections in the background. Zero is a middle case: it
obtains and validates a connection, throws if validation fails, but starts the
pool if a connection could not be obtained at all — so it distinguishes "the
database answered and something is wrong" from "the database did not answer".

**★ Why is failing fast usually the right default?**
Because of what it does to a rolling deployment. A pod that cannot start never
becomes ready, so the rollout stalls and the previous version keeps serving
traffic — which means a release with a wrong password, a wrong host or a missing
firewall rule cannot replace a working release. The failure is loud, immediate,
and confined to the new pods. The alternative is a rollout that completes
successfully, an old version that no longer exists, and an outage that has to be
diagnosed under pressure instead of simply not happening.

**★ When would you deliberately start without a database?**
When the application can do something useful without it — serving cached data, or
running with circuit breakers and fallbacks — or in local development and
`docker compose`, where the application and the database start together and the
application usually wins the race. There is also an argument for it during a
database incident: with fail-fast, no instance can restart until the database
returns, and then every instance starts at once. In all of those cases the
negative value must be paired with a readiness probe that checks the database, or
the pod will be handed traffic it cannot serve.

**★ Does `-1` let an application with Flyway migrations start without a database?**
No. `initializationFailTimeout` governs the pool's own initial connection and
nothing else. Migrations run during application startup and need a connection of
their own, so the failure simply moves from HikariCP to Flyway and the
application still does not start. That is usually the correct outcome — an
application whose schema may be out of date is not one you want serving traffic —
but it is worth knowing, because the setting is often added in the belief that it
makes startup independent of the database, and it does not.

**★ How does the default value of 1 interact with `connectionTimeout`?**
The number is not the whole wait. HikariCP's attempt to obtain the initial
connection is itself bounded by `connectionTimeout`, and the initialization
timeout is applied after that period — so a default pool with the default
thirty-second `connectionTimeout` blocks startup for roughly thirty seconds
before throwing, not for one millisecond. If you want a genuinely quick failure
at boot, the lever is `connectionTimeout`, which is also the value you want short
on a request path. It is a good example of the settings in this topic composing
rather than acting independently.

---

← Prev: [7d · Connection-level defaults](07d-connection-level-defaults.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8b · Readiness, liveness and shutdown](08b-readiness-liveness-and-shutdown.md)
