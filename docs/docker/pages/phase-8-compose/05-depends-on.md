---
title: "depends_on with condition: service_healthy"
sidebar_label: "05 · depends_on"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/) and
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/).
> **No sandbox** — no console output on this page.

**Plain `depends_on` waits for *started*, not for *ready* — and that one word is
why your API crashes on the first `docker compose up` and works on the second.**
The documentation says it outright: "With short syntax, Compose does not wait for
dependency services to be 'healthy' before starting a dependent service."

## What the short syntax actually guarantees

```yaml
services:
  web:
    image: myapp/web
    depends_on:
      - db
      - redis
  db:
    image: postgres:18
  redis:
    image: redis:8-alpine
```

Three guarantees, all about **order**, none about readiness:

- "Compose creates services in dependency order" — `db` and `redis` are created
  before `web`.
- "Compose guarantees dependency services have been started before starting a
  dependent service."
- "Compose removes services in dependency order" — `web` is removed before `db`
  and `redis`.

That last one is quietly valuable: on `down`, the thing holding connections goes
away before the thing holding data.

## The gap between started and ready

"Started" means the container's process was launched. For a database that is
nowhere near enough:

| What happens | Elapsed |
|---|---|
| Container created, process launched — **`depends_on` is satisfied here** | ~0s |
| Postgres initialises the data directory on a fresh volume | seconds |
| Postgres starts, then **restarts itself** as part of first-time setup | more seconds |
| The socket accepts connections and authenticates | finally |

Your API connects during the first row and gets `ECONNREFUSED`. It exits. Compose
restarts it (if you set a policy), by which time the database is up, and everything
works — which is exactly why this bug is reported as "it works the second time" and
is so often shrugged off.

## The long syntax, and the three conditions

```yaml
services:
  api:
    image: myapp/api
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```

| Condition | Documented meaning |
|---|---|
| `service_started` | "An equivalent of the short syntax described previously" |
| `service_healthy` | "Specifies that a dependency is expected to be 'healthy' (as indicated by `healthcheck`) before starting a dependent service" |
| `service_completed_successfully` | "Specifies that a dependency is expected to run to successful completion before starting a dependent service" |

And two more fields on the long form:

| Field | Documented meaning |
|---|---|
| `restart` | "When set to `true` Compose restarts this service after it updates the dependency service" |
| `required` | "When set to `false` Compose only warns you when the dependency service isn't started or available." Default `true` |

### `service_healthy` — the one you came for

It is only as good as the healthcheck behind it. `condition: service_healthy`
against a service whose healthcheck is `test: ["CMD", "true"]` buys you nothing but
a longer boot. [Page 06](06-healthchecks.md) is about writing checks that are
actually true, and it is not optional reading — **this feature and that one are one
mechanism split across two pages.**

### `service_completed_successfully` — the migration gate

This is how you run migrations before the API starts, without putting them in the
API's startup path:

```yaml
services:
  migrate:
    build: .
    command: ["npm", "run", "migrate"]
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  api:
    build: .
    depends_on:
      migrate:
        condition: service_completed_successfully
```

`migrate` waits for a healthy database, runs, and exits 0. Only then does `api`
start. Note `restart: "no"` on the one-shot service — a restart policy on a job
that is *supposed* to exit turns a successful migration into a restart loop.

### `restart: true` — bouncing dependents

```yaml
depends_on:
  config-service:
    condition: service_healthy
    restart: true
```

When Compose updates `config-service`, the dependent is restarted too. Useful when
the dependent caches something from the dependency at startup; unnecessary noise
when it does not.

### `required: false` — optional dependencies

Downgrades a missing dependency from an error to a warning. The honest use is an
optional profile-gated service ([page 12](12-profiles.md)) that may not be part of
this run.

## 🔴 What `depends_on` does not do

This is the part that separates a working development stack from a working system,
and it deserves to be stated flatly:

**`depends_on` is a startup-ordering feature. It has no effect after startup.**

- The database restarts at 3am → nothing re-orders anything. Your API sees dropped
  connections and must handle them.
- The database becomes unhealthy → the API is not stopped, restarted or told.
  "Docker reports; something else must act"
  ([Phase 3, page 11](../phase-3-dockerfile/11-healthcheck.md)).
- A network blip → same.

So the correct posture is **both**: `condition: service_healthy` so the first boot
is not a race, *and* retry-with-backoff in the application so the hundredth hour is
not an outage. An application that cannot survive its database restarting is broken
regardless of what the compose file says — **Phase 9 · Waiting for the database**
*(not written yet)* is where the application-side half is written.

`depends_on` also does not survive `--no-deps`: `docker compose up --no-deps api`
starts the API alone and ignores the dependency graph entirely
([page 03](03-up-and-down/01-up.md)).

## Interaction with `up --wait`

Two different questions that are easy to conflate:

| Feature | Question it answers |
|---|---|
| `depends_on: condition: service_healthy` | Should service B *start* yet? |
| `up -d --wait` | Should the *`up` command* return yet? |

You usually want both in CI: the dependency graph gets the boot order right, and
`--wait` stops the test step from beginning before the stack is ready.

## Podman

`podman compose` delegates ([page 01](01-what-compose-is.md)), so condition support
is the provider's. With `docker-compose` as the provider all three conditions
behave as documented. With `podman-compose`, dependency conditions are exactly the
kind of surface that has historically lagged, and the failure is quiet — the
dependent starts anyway and the race comes back. **If your stack relies on
`service_healthy` and must run under Podman, pin the provider**
(`PODMAN_COMPOSE_PROVIDER`) and say so in the README rather than assuming
([page 15](15-podman-compose.md)).

The healthcheck itself also differs under Podman: checks are driven by **systemd
timers** rather than by a daemon
([Phase 3, page 11](../phase-3-dockerfile/11-healthcheck.md)), so a rootless
container without linger can stop being checked at all.

## Gotchas

**Symptom:** The API crashes on the first `up` and works on the second.
**Cause:** Plain `depends_on` waits for the dependency to be *started*, not ready.
**Fix:** `condition: service_healthy` plus a real healthcheck on the dependency.
Adding a `sleep 10` to the API's command is the popular wrong answer — slower, and
still racy on a cold machine.

**Symptom:** `condition: service_healthy` never satisfies and `up` hangs.
**Cause:** The dependency's healthcheck never reports healthy — often a wrong
command, a missing binary in a slim image, or a check that needs a `start_period`.
**Fix:** `docker compose ps` shows the health state; `docker inspect` shows the last
check output. Fix the check, not the condition
([page 06](06-healthchecks.md)).

**Symptom:** A one-shot migration service restarts forever.
**Cause:** A restart policy was applied to a service that is supposed to exit.
**Fix:** `restart: "no"` on the job, and gate the API on
`condition: service_completed_successfully`.

**Symptom:** Everything is gated on `service_healthy` and the stack takes minutes to
come up.
**Cause:** Healthcheck `interval` and `start_period` defaults are conservative, and
each gate is serialised.
**Fix:** Tune the dependency's `interval`/`start_period` rather than removing the
gate. Only gate on what genuinely blocks startup.

**Symptom:** The API kept failing after the database was restarted by hand, even
though `depends_on` is configured.
**Cause:** `depends_on` affects startup order only. It does nothing at runtime.
**Fix:** Retry-with-backoff in the application. This is an application defect that
the compose file cannot fix.

## Interview questions

**★ Why does `depends_on` not stop your API from crashing on boot?**
Because it waits for the dependency to be *started*, not ready — the documentation
states that the short syntax does not wait for services to be healthy. A Postgres
container is "started" the moment its process launches, seconds before it accepts
connections. The fix is the long syntax with `condition: service_healthy`, backed by
a healthcheck that genuinely tests readiness.

**★ What are the three `depends_on` conditions and when do you use each?**
`service_started` is the default and equivalent to the short syntax.
`service_healthy` waits for the dependency's healthcheck to pass — the right gate
for databases and caches. `service_completed_successfully` waits for the dependency
to run to completion and exit 0 — the right gate for migrations and seed jobs.

**★ If you gate on `service_healthy`, do you still need retries in the
application?**
Yes, and this is the important half. `depends_on` is a startup-ordering feature with
no effect at runtime. The database will restart, the network will blip, and nothing
in Compose will re-order anything when it does. Use `service_healthy` so the first
boot is not a race and retry-with-backoff so the running system survives — they
solve different problems.

**How do you run database migrations before the API starts?**
A one-shot service that depends on the database with `condition: service_healthy`,
runs the migration and exits; then the API depends on *it* with
`condition: service_completed_successfully`. Give the one-shot service
`restart: "no"`, or a restart policy will turn a completed job into a loop.

**What is the difference between `depends_on` and `up --wait`?**
`depends_on` decides when a *service* may start, relative to other services.
`--wait` decides when the *`up` command* returns to your shell or CI script. They
are complementary: the first orders the boot, the second stops the next CI step from
racing it.

**What does `required: false` do?**
It downgrades a missing or unstarted dependency from an error to a warning. It is
for genuinely optional services — typically ones gated behind a profile that is not
enabled in this run.

---

← Prev: [The services block](04-services-block/README.md) · Index: [Phase 8](README.md) · Next → [Healthchecks in Compose](06-healthchecks.md)
