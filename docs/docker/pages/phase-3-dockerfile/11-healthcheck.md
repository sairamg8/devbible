---
title: "HEALTHCHECK"
sidebar_label: "11 · HEALTHCHECK"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck),
> [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/) and
> [Compose — depends_on and healthcheck](https://docs.docker.com/reference/compose-file/services/).
> **No sandbox** — no console output on this page.

**A healthcheck answers "is this container actually working?", which is a
different question from "is the process running?"** Docker reports the answer
and, on its own, does nothing else with it — which is the part people get wrong.

## The instruction

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/healthz || exit 1

HEALTHCHECK NONE      # disable one inherited from the base image
```

| Option | Default | Meaning |
|---|---|---|
| `--interval` | **30s** | How often to run the check |
| `--timeout` | **30s** | A check taking longer than this is a failure |
| `--start-period` | **0s** | Grace window at startup; failures do not count toward `--retries` |
| `--retries` | **3** | Consecutive failures before the container is marked unhealthy |
| `--start-interval` | — | A shorter interval during the start period; a newer option, check your engine's docs for its default |

**Exit status:** `0` means healthy, `1` means unhealthy. Exit code `2` is
documented as reserved — do not use it.

The defaults are conservative. A 30-second timeout on an HTTP check is far longer
than any healthy response, so a hung service stays "healthy" for a minute and a
half before three failures accumulate. Set `--timeout` to something realistic —
seconds, not tens of seconds.

## `--start-period` is the one that matters most

Without it, a service that takes 20 seconds to start is marked unhealthy during
startup, and under an orchestrator may be killed and restarted forever. Failures
inside the start period do not count toward the retry limit.

Set it slightly above your realistic worst-case startup time — migrations, cache
warming, JIT.

## Writing a check that is actually true

The check should exercise the thing that matters, and nothing more:

```dockerfile
# ✅ the app's own readiness endpoint - it knows whether it is ready
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD curl -fsS http://localhost:3000/healthz || exit 1

# ⚠️ proves a port is open, not that the service works
HEALTHCHECK CMD nc -z localhost 3000 || exit 1

# ❌ proves the container can run a process
HEALTHCHECK CMD echo ok
```

Two design rules:

- **Check readiness, not liveness of dependencies.** If your `/healthz` returns
  unhealthy because the *database* is down, every application container is marked
  unhealthy during a database blip and a rolling restart makes it worse. Report
  your own readiness; monitor dependencies separately.
- **Keep it cheap.** It runs every interval, forever, in every replica. A check
  that queries the database is a query you are running on a timer.

Per-service examples that are true rather than decorative:

```yaml
# Postgres - is it accepting connections for THIS database and user?
test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]

# Redis
test: ["CMD", "redis-cli", "ping"]

# Mongo
test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
```

## The tool must exist in the image

A `curl`-based check in a distroless or minimal image fails permanently, because
there is no `curl`. Options, in order of preference:

1. **A language-native check** — `node -e "fetch('http://localhost:3000/healthz')…"`
   uses the runtime already present.
2. **A tiny static health binary** copied in during the build.
3. **Install `curl`**, accepting the size and the extra CVE surface.

Adding `curl` to a distroless image to run a healthcheck undoes much of why you
chose distroless.

## What Docker does with the result

**It reports it, and that is all.**

```bash
docker ps                    # STATUS shows (healthy) / (unhealthy) / (health: starting)
docker inspect --format '{{.State.Health.Status}}' api
docker inspect --format '{{json .State.Health.Log}}' api    # recent check output
```

🔴 **An unhealthy container keeps running and keeps receiving traffic.** Nothing
restarts it, nothing removes it from a load balancer. Restart policies react to
*exit*, not to health
([Phase 1, page 12](../phase-1-running-containers/12-restart-policies.md)).

The value appears when something acts on it:

- **Compose** — `depends_on` with `condition: service_healthy` waits for it
  before starting dependants (Phase 8). This is the single most useful
  consumer.
- **Orchestrators** — Kubernetes has its own probes and ignores the Dockerfile's
  `HEALTHCHECK`; Swarm uses it.
- **Proxies and supervisors** that read health status.

## Podman

Podman supports `HEALTHCHECK` and `podman healthcheck run`, but 🔴 **the periodic
execution is driven by systemd timers rather than a daemon loop**. Practical
consequences: the timer must exist for checks to run on schedule, behaviour under
rootless-without-lingering differs, and `podman inspect` is where you confirm
what is actually happening. Phase 11.

## Gotchas

**Symptom:** A container is marked unhealthy immediately after starting.
**Cause:** No `--start-period`, so startup failures counted toward `--retries`.
**Fix:** Set `--start-period` above realistic worst-case startup time.

**Symptom:** The container says `(unhealthy)` and is still serving traffic.
**Cause:** Docker reports health; it does not act on it.
**Fix:** Have something consume it — Compose's `service_healthy`, an
orchestrator, or a proxy. The status alone changes nothing.

**Symptom:** The healthcheck fails with "curl: not found".
**Cause:** The tool is not in the image.
**Fix:** Use a language-native check or a small static binary, rather than
installing `curl` into a minimal image.

**Symptom:** Every application container goes unhealthy when the database
restarts.
**Cause:** `/healthz` checks dependencies rather than the service's own
readiness.
**Fix:** Report your own readiness. Monitor dependencies separately, and let the
application retry.

## Interview questions

**★ What does `HEALTHCHECK` do when the check fails?**
It marks the container unhealthy after `--retries` consecutive failures, and
reports that in `docker ps` and `docker inspect`. It does **not** restart,
remove, or de-route the container — something else must act on the status.

**★ What is `--start-period` for?**
A grace window at startup during which failures do not count toward the retry
limit. Without it, a service that takes 20 seconds to start is marked unhealthy
while starting, and under a supervisor may restart forever.

**★ Why should a healthcheck not test its dependencies?**
Because a database blip then marks every application container unhealthy at once,
turning a partial outage into a full one — often with a restart storm. Report
your own readiness and let the application retry its dependencies.

**What are the defaults, and are they good?**
30s interval, 30s timeout, 0s start period, 3 retries. The timeout is far too
generous for an HTTP check — a hung service stays "healthy" for around 90 seconds
— and a 0s start period is wrong for anything with a real startup sequence.

**How is Podman's healthcheck execution different?**
It is driven by systemd timers rather than a daemon loop, so the timer must exist
for periodic checks to run and behaviour differs under rootless without
lingering. `podman inspect` confirms what is actually happening.

---

← Prev: [EXPOSE publishes nothing](10-expose.md) · Index: [Phase 3](README.md) · Next → [LABEL and image metadata](12-label-and-metadata.md)
