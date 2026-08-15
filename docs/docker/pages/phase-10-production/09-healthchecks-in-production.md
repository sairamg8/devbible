---
title: "Healthchecks in production"
sidebar_label: "09 · Healthchecks in production"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — `HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck),
> [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/),
> [docker system events](https://docs.docker.com/reference/cli/docker/system/events/),
> the [Compose file reference — `healthcheck` and `depends_on`](https://docs.docker.com/reference/compose-file/services/)
> and [podman-healthcheck-run(1)](https://docs.podman.io/en/latest/markdown/podman-healthcheck-run.1.html).
> **No sandbox** — no console output on this page.

**A health check is only worth what the thing consuming it does.** Docker sets a
status and emits an event; it removes nothing from anything, because there is
nothing to remove it from. So the design question is never "what should the check
test" in isolation — it is **who is asking, and what will they do with the
answer**.

[Phase 3](../phase-3-dockerfile/11-healthcheck.md) covered the instruction and its
options — `--interval` 30s, `--timeout` 30s, `--start-period` 0s, `--retries` 3,
exit `0` healthy and `1` unhealthy. This page is what to do with it once
something depends on the result.

## Liveness and readiness are two different questions

They are usually served by one endpoint, and that is the root of both failure
modes in [the catalogue](06-failure-catalogue/02-still-running-and-useless.md).

| | **Liveness** | **Readiness** |
|---|---|---|
| Asks | "Am I broken beyond recovery?" | "Should I be sent traffic *now*?" |
| Right answer to a failure | **Restart me** | **Stop routing to me** — do not restart |
| Should it check dependencies? | **No** | Yes, carefully |
| Cost | Must be trivial | May do real work |
| Frequency | Rare, tolerant | Frequent, responsive |

**The failure of merging them is symmetrical**, which is why it is hard to argue
about in the abstract:

- **Too shallow** (a framework `GET /` returning 200): the process is up while
  the database pool is exhausted, the queue consumer is wedged and the disk is
  full. The dashboard is green throughout the outage.
- **Too deep** (the liveness check queries the database): a two-second database
  blip marks **every replica** unhealthy at once, and a restart-on-unhealthy
  policy then restarts the entire fleet — during a dependency incident, which is
  the worst possible moment.

🔴 **The rule: liveness must not depend on anything you do not control.
Readiness may, and readiness failures must never cause a restart.**

## What a readiness check should actually assert

Something narrower than "everything works" and wider than "the process runs":
**can I serve a request right now?**

- The HTTP server is listening and accepting.
- The connection pool can hand out a connection — not that a query succeeds, but
  that the pool is not exhausted.
- Migrations or warm-up that must finish before serving have finished.
- The shutting-down flag is not set ([02 · Graceful shutdown](02-graceful-shutdown/01-the-deadline.md)) —
  this is the one that makes zero-downtime deploys work at all.

And what it should not do: run a query per probe against your primary database.
At a 5-second interval across twenty replicas that is 240 queries a minute of
pure overhead, and it couples your availability to your database's latency.

## What consumes the status, and what does not

| Consumer | What it does with `unhealthy` |
|---|---|
| **Docker on its own** | **Nothing.** Sets the status, emits a `health_status` event |
| `docker ps` | Shows it in the `STATUS` column |
| **Compose `depends_on: condition: service_healthy`** | Delays *starting* dependants. **Startup only** |
| A load balancer / reverse proxy | Stops routing — the useful one, and it polls your endpoint directly |
| An orchestrator | Restarts on liveness, de-routes on readiness |

⚠️ **`depends_on: service_healthy` is a startup gate, not supervision.** Once the
stack is up it never reconsiders; a service that becomes unhealthy an hour later
keeps receiving traffic from its dependants. It solves the startup race and
nothing else — the detail belongs to Compose in phase 8.

So on a single host with no orchestrator, the check's value is **observability
plus start-up ordering**, and turning it into action means one of:

- **Alerting on `health_status` events** from `docker events` — the cheapest real
  win, because the event is emitted whether or not anyone listens.
- **A reverse proxy that polls the endpoint** and drops the backend. That is what
  actually stops traffic reaching a broken container.
- **Restart on unhealthy**, which Docker does not do natively; under systemd it is
  expressible, and it is dangerous for exactly the "too deep" reason above.

## Tuning the numbers so they mean something

The defaults are conservative to the point of being misleading: `--timeout` 30s
means a hung service stays healthy for the timeout plus three intervals — around
a minute and a half — before anyone is told.

```dockerfile
HEALTHCHECK --interval=10s --timeout=2s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/readyz || exit 1
```

- **`--timeout` should be smaller than a healthy response by a wide margin.** A
  probe that takes two seconds is already a failure in disguise.
- **`--start-period` is the option that prevents restart loops.** Set it above
  realistic worst-case startup — migrations, cache warming, a cold JIT — because
  failures inside it do not count toward `--retries`. It is also the option most
  often left at its `0s` default.
- **`--interval` × `--retries` is your detection time.** 10s × 3 is thirty
  seconds; 30s × 3 is a minute and a half. Pick it against how long you are
  willing to serve errors.

⚠️ **The check runs inside the container and consumes its resources**, so
`curl`-based checks need `curl` in the image — an argument against them in
distroless and scratch images, where a tiny compiled health binary or the
application's own `--healthcheck` mode is the answer
([12 · Debugging a container you cannot shell into](12-debugging-without-a-shell.md)).

## Podman

The semantics match; the mechanism is different, and it shows:

- **There is no daemon polling on a timer.** Something outside the engine has to
  fire each check, and `podman-run(1)` says so only obliquely: an `--health-interval`
  of `disable` "results in no **automatic timer setup**". ⚠️ **The reference does
  not name what provides that timer**, so this page does not either — what it does
  say is that on a host where nothing is scheduling the checks, they may simply not
  run, and a container that was never marked unhealthy is not thereby healthy.
- `podman healthcheck run <container>` "runs the healthcheck command defined in a
  running container manually", which is the honest way to test one.
- **`--health-on-failure` interacts with supervision**: "do not combine the
  `restart` action with the `--restart` flag. When running inside of a systemd
  unit, consider using the `kill` or `stop` action instead to make use of
  systemd's restart policy" — the one-supervisor rule again.
- Under [Quadlet](../phase-11-podman-in-depth/04-quadlet/README.md) the check is
  part of the generated unit set, and `HealthCmd=` is expressed in the
  `.container` file.

🔴 **"The health status never changed" means something different on each engine** —
under Docker it means the check passed; under rootless Podman it may mean nothing
ran it.

## Gotchas

**Symptom:** Everything is green during a full outage.
**Cause:** The check asserts that the process is up, which was never in question.
**Fix:** Make readiness assert what a request actually needs — a pool connection,
warm-up complete, not shutting down.

**Symptom:** A database blip restarted every replica simultaneously.
**Cause:** A liveness check that queries the database, plus restart-on-unhealthy.
**Fix:** Liveness must not touch external dependencies. Only readiness may, and
readiness must not trigger restarts.

**Symptom:** A slow-starting service is killed and restarted forever.
**Cause:** `--start-period` left at its default of `0s`, so startup failures count
against `--retries`.
**Fix:** Set it above worst-case startup time.

**Symptom:** A container became unhealthy and its dependants kept sending traffic.
**Cause:** `depends_on: service_healthy` gates startup only and never reconsiders.
**Fix:** Something that polls continuously — a proxy or an orchestrator. Compose's
condition is a start-up ordering tool.

## Interview questions

**★ What is the difference between liveness and readiness?**
Liveness asks whether the process is broken beyond recovery — its remedy is a
restart. Readiness asks whether traffic should be sent now — its remedy is to stop
routing. Liveness must not depend on anything external; readiness may, and a
readiness failure must never cause a restart.

**★ What does Docker do with an unhealthy container?**
Sets the status and emits a `health_status` event, and nothing else — there is no
built-in load balancer to remove it from. Something must consume the status:
alerting on the event, a reverse proxy polling the endpoint, or an orchestrator.

**★ Why can a health check that queries the database make an outage worse?**
Because a brief dependency failure marks every replica unhealthy at once, turning
degradation into correlated failure — and with restart-on-unhealthy, it restarts
the whole fleet during the dependency's incident.

**Which `HEALTHCHECK` option prevents restart loops on a slow-starting service?**
`--start-period`. Failures inside it do not count toward `--retries`. It defaults
to `0s`, which is why a service with a 20-second startup is marked unhealthy
before it has had a chance.

**How long does it take to notice a hung service with the defaults?**
Roughly `--timeout` plus `--interval` × `--retries` — with 30s, 30s and 3, about a
minute and a half. Set the timeout well below a healthy response time and pick
interval × retries against how long you will tolerate serving errors.

**What is different about healthchecks under Podman?**
There is no daemon polling them. The engine sets up a timer — `--health-interval
disable` "results in no automatic timer setup" — but the reference does not say
what provides it, and on a host where nothing fires the checks they may not
execute at all, so "never marked unhealthy" is not evidence of health.
`podman healthcheck run` executes one on demand, and `--health-on-failure` should
use `kill` or `stop` rather than `restart` inside a systemd unit, so there is one
supervisor.

---

← Prev: [Log drivers and rotation](08-log-drivers-and-rotation.md) · Index: [Phase 10](README.md) · Next → [Hardening at run time](10-hardening/README.md)
