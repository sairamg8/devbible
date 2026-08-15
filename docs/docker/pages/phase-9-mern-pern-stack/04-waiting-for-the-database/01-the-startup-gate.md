---
title: "The startup gate"
sidebar_label: "01 · The startup gate"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/),
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/),
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/) and
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres).
> **No sandbox** — no console output on this page.

**Compose can hold a service back until another one is healthy, and that is the
entire extent of its help.** Getting the gate right is cheap; believing it is the
whole answer is what the next chunk is about.

## Short syntax does not wait for ready

```yaml
services:
  api:
    depends_on:
      - db          # ⛔ start ORDER only
```

The documentation is explicit: *"With short syntax, Compose does not wait for
dependency services to be 'healthy'"* — it guarantees creation order, start order
and removal order, nothing more. The database container being *started* says
nothing about Postgres accepting connections, and on a first run with `initdb` the
gap is seconds to tens of seconds.

## The long syntax, and the three conditions

```yaml
services:
  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
        restart: true            # bounce the API if db is updated
      migrate:
        condition: service_completed_successfully
```

| Condition | Means |
|---|---|
| `service_started` | The same as short syntax |
| **`service_healthy`** | The dependency's **healthcheck** passes — the one you want for a database |
| `service_completed_successfully` | The dependency **exited 0** — the migration gate |

Two extras worth knowing: **`restart: true`** re-starts the dependent service when
the dependency is updated, and **`required: false`** downgrades a missing
dependency from an error to a warning.

🔴 **`condition: service_healthy` is only as good as the healthcheck**, and the
default healthcheck is *no* healthcheck — a service with none can never report
healthy, so a `depends_on` naming it will simply wait. The database must define
one.

## The healthcheck that gates correctly

```yaml
  db:
    image: postgres:18
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
      start_interval: 2s
```

Every line is doing work:

- 🔴 **`-h 127.0.0.1` forces TCP.** During initialisation the image's temporary
  daemon *"listens only on the Unix socket"*, so a socket-based check reports
  healthy while the database still cannot accept a connection from another
  container. This is the single most common way a correct-looking gate lets the
  API through too early.
- **`start_period` + `start_interval` remove the usual trade-off** — a generous
  grace window, checked every two seconds *inside* it, so readiness is noticed in
  seconds without polling a healthy database forever
  ([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)).
- **The defaults are wrong for this job:** interval 30s, timeout 30s, retries 3 —
  roughly ninety seconds before a wedged service is called unhealthy, and up to
  thirty seconds of delay noticing a healthy one.
- **`CMD-SHELL`**, because `["CMD", "pg_isready -h 127.0.0.1"]` is one string with
  spaces and fails permanently.
- ⛔ **Never `test: ["CMD", "true"]` to "disable" a check.** It reports *healthy*,
  and every `condition: service_healthy` in the file then acts on the lie. The
  documented way to switch one off is `disable: true`.

## `up --wait` is a different question

```bash
docker compose up -d --wait --wait-timeout 120
```

`--wait` *"wait[s] for services to be running|healthy"* and *"implies detached
mode"*. The distinction is worth being precise about:

| | Question |
|---|---|
| `depends_on` | Should **service B start** yet? |
| `up --wait` | Should the **`up` command return** yet? |

A CI script usually wants both: `depends_on` so the stack boots in a sane order,
and `--wait` so the next line of the script does not run against a stack that is
merely *started*. Plain `up -d` returns when containers have been started, not
when anything is ready — which is why so many pipelines have a `sleep 10` in them
that fails once a month.

## Gating migrations

The migration is a one-shot service, and it needs gating from both sides:

```yaml
services:
  migrate:
    build: .
    command: npm run migrate
    restart: "no"                     # ⚠️ quoted — bare no is the boolean false
    depends_on:
      db:
        condition: service_healthy

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```

🔴 **`restart: "no"` is load-bearing on a one-shot service.** With a restart
policy inherited from a template or set globally, a *successfully completed*
migration is a container that exited — so the policy starts it again, and again.
The quoting matters for a different reason: unquoted, YAML reads `no` as the
boolean `false`.

Topic 10 is the wider migration argument; the point here is only that
`service_completed_successfully` exists and is the right gate.

## What the gate does not do

| | |
|---|---|
| Re-checked after boot? | ⛔ **No.** `depends_on` is consulted once |
| Restarts the API when the DB comes back? | ⛔ No — unless you set `restart: true`, and even then only on an *update* |
| Removes an unhealthy container from service? | ⛔ No. It stays on the network and keeps its DNS name |
| Helps a `docker run` or a plain `podman run`? | ⛔ No — this is entirely a Compose-level feature |

**Podman:** `depends_on` is resolved by the compose provider, but the healthcheck
that feeds it is executed by the engine — and **Podman drives healthchecks from
systemd timers**, so without a systemd user session the check may never run and
`service_healthy` may never be satisfied. That is a startup hang with a
non-obvious cause ([Phase 8 · `podman compose`](../../phase-8-compose/15-podman-compose.md)).

## Gotchas

**Symptom:** The API still crashes on `up`, despite `depends_on`.
**Cause:** Short syntax — it waits for *started*, not *ready*.
**Fix:** Long syntax with `condition: service_healthy`, and a healthcheck on the
database that actually tests TCP.

**Symptom:** The healthcheck passes but the API cannot connect.
**Cause:** `pg_isready` over the Unix socket succeeds while the initialisation
daemon is running, before the real server listens on TCP.
**Fix:** `pg_isready -h 127.0.0.1`, with `start_period` long enough to cover
`initdb`.

**Symptom:** `docker compose up -d` returns and the next CI step fails.
**Cause:** `up -d` returns when containers are started, not ready.
**Fix:** `--wait` (and `--wait-timeout`). It implies detached mode, so it replaces
the `-d`.

**Symptom:** The migration service restarts forever after succeeding.
**Cause:** A restart policy applied to a container that is *supposed* to exit.
**Fix:** `restart: "no"` on one-shot services — quoted, or YAML turns it into
`false`.

## Interview questions

**★ Why does plain `depends_on` not fix "the API crashes on boot"?**
Because it only orders creation, start and removal — the documentation says it
does not wait for dependencies to be healthy. The database container being
started tells you the process launched, not that Postgres is accepting
connections, and on a first run `initdb` makes that gap tens of seconds long. The
fix is the long syntax with `condition: service_healthy`, backed by a healthcheck
that tests what the API actually needs.

**★ What is the difference between `depends_on` and `up --wait`?**
They answer different questions: `depends_on` decides when *service B* may start;
`--wait` decides when the *`up` command* returns. CI usually wants both, because
`up -d` returns on "started" and the next script line then runs against a stack
that is not ready. `--wait` implies detached mode, so it replaces `-d` rather than
joining it.

**★ Your healthcheck passes and the API still cannot connect. What is happening?**
The check is passing over the Unix socket during first-run initialisation, when
the image's temporary daemon listens only there. Forcing TCP with
`pg_isready -h 127.0.0.1` makes the check assert the same thing the application
depends on, and `start_period` gives `initdb` room without making the interval
long.

**When would you use `service_completed_successfully`?**
For a one-shot job that must finish before dependents start — a migration or a
seed. It gates on exit code 0. Pair it with `restart: "no"` on that service, or
the restart policy treats the successful exit as a crash and loops; and quote the
`"no"`, because YAML otherwise reads it as boolean false.

**Does any of this help after the stack is up?**
No, and that is the point of the next chunk. `depends_on` is evaluated once at
startup. An unhealthy container keeps its place on the network and keeps
receiving traffic; a database that restarts at 3am triggers no re-ordering. Only
the application can handle that.

---

← Prev: [Waiting for the database](README.md) · Index: [Phase 9](../README.md) · Next → [Surviving a restart](02-surviving-a-restart.md)
