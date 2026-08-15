---
title: "The stateful services"
sidebar_label: "04 · The stateful services"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres),
> [the official `redis` image documentation](https://hub.docker.com/_/redis),
> [Redis `PING`](https://redis.io/docs/latest/commands/ping/),
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/#healthcheck) and
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/#depends_on).
> **No sandbox** — no console output on this page.

**`db`, `cache` and `migrate` are the three services where a mistake is
expensive, because two of them hold data and the third changes its shape.** Each
one is a handful of lines, and in each handful there is exactly one line that
quietly decides whether you still have a database next week.

## `db` — PostgreSQL

```yaml
  db:
    image: postgres:18
    environment:
      POSTGRES_USER: acme
      POSTGRES_DB: acme
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - db-data:/var/lib/postgresql
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
      start_interval: 2s
    networks: [backend]
    restart: unless-stopped
```

### The mount path moved in PostgreSQL 18

🔴 **This is the single most expensive line on the page.** The image's own
Dockerfile now sets `PGDATA` to `/var/lib/postgresql/18/docker` and declares
`VOLUME /var/lib/postgresql`, with the comment that *"in 18+, PGDATA has changed
to match the pg_ctlcluster standard directory structure, and the VOLUME has moved
from /var/lib/postgresql/data to /var/lib/postgresql"*.

The image documentation states the consequence plainly: a mount at the old path
**"WILL NOT PERSIST database data"**.

| Tag | Mount |
|---|---|
| `postgres:18` and later | `db-data:/var/lib/postgresql` |
| `postgres:17` and earlier | `db-data:/var/lib/postgresql/data` |

⚠️ **It does not fail.** The container starts, the API connects, everything works
all day — the writes are landing in the container's own writable layer, and the
next `up` that recreates the container takes them with it. The tag and the path
have to agree, and a version bump is therefore a two-line change
([topic 03](../03-postgres-in-a-container/01-the-data-directory.md)).

### `_FILE`, for free

```yaml
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
```

The image supports the convention natively: *"`_FILE` may be appended to some of
the previously listed environment variables, causing the initialization script to
load the values for those variables from files present in the container"* — for
`POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` and `POSTGRES_INITDB_ARGS`.
So the database side of [topic 06](../06-secrets-dev-vs-prod.md) costs one line
and no code.

⚠️ **The API side does not get that for free.** node-postgres has no `_FILE`
support, so the `DATABASE_PASSWORD_FILE` in the anchor is read by *your* code —
the six-line helper on topic 06. Worth doing anyway: it is what lets one image
take a plain `environment:` value in development and a mounted secret in
production with no rebuild.

### Init scripts run once, and only once

`./db/init:/docker-entrypoint-initdb.d:ro` runs `.sql`, `.sql.gz` and `.sh` files
*"in sorted name order as defined by the current locale"* — but only *"if you
start the container with a data directory that is empty"*. The same is true of
every `POSTGRES_*` variable: *"The Docker specific variables will only have an
effect if you start the container with a data directory that is empty."*

🔴 **That is why schema changes cannot live here.** An init script is a one-time
bootstrap for a brand-new volume; changing it does nothing to a database that
already exists. Schema evolution is `migrate`'s job, below, and conflating the two
is how a team ends up with a `db/init` nobody dares to run.

It is also the honest reason `down -v` is part of a development workflow: the only
way to re-run the bootstrap is to start from an empty volume.

### A healthcheck that is not lying

```yaml
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U $$POSTGRES_USER -d $$POSTGRES_DB"]
```

Two traps in one line:

- 🔴 **`-h 127.0.0.1` forces TCP.** During first-run initialisation *"the
  temporary daemon started for these initialization scripts listens only on the
  Unix socket"*, so a socket-based `pg_isready` reports ready while the database
  is not accepting a single network connection — which is the transport the API
  actually uses. This is the documented mechanism behind "it works the second
  time".
- **`$$` escapes the dollar** so Compose does not interpolate `$POSTGRES_USER`
  out of *your shell's* environment — where it does not exist — and hand the
  container an empty string.

And `start_period: 30s` with `start_interval: 2s` is the pairing worth
remembering: a generous grace window, checked every two seconds *inside* it, so a
fast boot is noticed in seconds and a slow one is not marked failed
([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)).

⚠️ **Never `stop_signal: SIGTERM` on this service.** The image ships
`STOPSIGNAL SIGINT` on purpose — it *"corresponds to what PostgreSQL calls 'Fast
Shutdown mode' wherein new connections are disallowed and any in-progress
transactions are aborted, allowing PostgreSQL to stop cleanly and flush tables to
disk"*. The default `SIGTERM` is *smart* shutdown, which waits for clients and
therefore runs out the ten-second grace period and gets killed.

## `cache` — Redis

```yaml
  cache:
    image: redis:8-alpine
    command: ["redis-server", "--save", "60", "1"]
    volumes:
      - cache-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

The image documentation is short and the two facts that matter are: *"If
persistence is enabled, data is stored in the `VOLUME /data`"*, and `redis-cli`
ships **inside the image** — its own "Connecting via `redis-cli`" example runs
`docker run … redis redis-cli -h some-redis`. So the healthcheck installs nothing.

🔴 **`PING` is a genuine readiness check, not a liveness one**, and the Redis
documentation says why: it is useful for *"verifying the server's ability to serve
data — an error is returned when this isn't the case (for example, during load
from persistence data or accessing a stale replica)"*. A Redis restoring a large
dump accepts the TCP connection and fails `PING`, which is exactly the window
`condition: service_healthy` exists to cover.

Whether a cache should persist at all is
[topic 09](../09-redis-in-a-container.md)'s question. The volume is in the file so
that the answer is a one-line edit rather than a redesign — and so that an
accidental `down -v` is the only way to lose a warm cache.

⚠️ **A cache with a volume is not a database.** If losing it would break the
application rather than slow it down, the data is not cache-shaped and belongs in
Postgres. The test is simple: delete the volume and see whether anything is
*wrong* or merely *slow*.

## `migrate` — the one-shot job

```yaml
  migrate:
    <<: *api-base
    command: ["node", "dist/migrate.js"]
    depends_on:
      db:
        condition: service_healthy
    networks: [backend]
    restart: "no"
```

It is the API's image with a different command, which is what guarantees the
migrations run against the same driver, the same TLS settings and the same
credentials as the application.

🔴 **`restart: "no"` is not optional, and neither are the quotes.** A one-shot job
that exits 0 under any other policy is a container the engine keeps starting
again: a migration loop that reads as a crash loop in the logs. Unquoted, YAML
reads `no` as the boolean `false` and the key does not mean what it says
([Phase 8 · The `services` block](../../phase-8-compose/04-services-block/02-how-it-is-wired.md)).

The `api` service then waits on it:

```yaml
    depends_on:
      migrate:
        condition: service_completed_successfully
```

**`service_completed_successfully` is the only condition that means *finished*** —
`service_started` means the process launched and `service_healthy` means it is
answering. The pairing is the whole migration gate, and each half is useless
alone: without `restart: "no"` the finished job restarts forever; without the
completion condition the API races it and serves against a half-migrated schema.

⚠️ **A failed migration should stop the deploy.** That is what this gate buys —
the API never starts, `docker compose up --wait` returns non-zero, and CI fails on
the migration rather than on a stream of confusing 500s.

Running migrations from the API's own startup path looks simpler and is worse:
with more than one API replica they race, and a migration failure becomes a crash
loop instead of a clear error ([topic 10](../10-migrations-and-seeds.md)).

## Gotchas

**Symptom:** The database is empty after a machine restart, but it worked all day.
**Cause:** A `postgres:18` image with the volume mounted at the pre-18
`/var/lib/postgresql/data`. The image documentation says such a mount "WILL NOT
PERSIST database data"; the writes went to the container's writable layer, which
the next `up` discarded.
**Fix:** Mount `/var/lib/postgresql` on 18 and later, `/var/lib/postgresql/data`
on 17 and earlier. Treat a major-version bump as a change to both lines.

**Symptom:** A change to `db/init/01-schema.sql` has no effect.
**Cause:** Init scripts and every `POSTGRES_*` variable only run *"if you start
the container with a data directory that is empty"*. The volume already has a
database in it.
**Fix:** For development, `down -v` and start again. For anything that has to work
against an existing database, it is a migration — that is what `migrate` is for.

**Symptom:** `migrate` runs on every `up` and the stack never comes up.
**Cause:** The job inherited a restart policy, or `restart: no` was written
unquoted so YAML turned it into the boolean `false`.
**Fix:** `restart: "no"` on the job and `condition:
service_completed_successfully` on everything that waits for it.

**Symptom:** The database reports healthy, then the API's first query is refused.
**Cause:** `pg_isready` ran over the Unix socket during first-run initialisation,
when the temporary daemon listens on the socket only.
**Fix:** `pg_isready -h 127.0.0.1`, forcing the same transport the application
uses. A healthcheck that tests a different path from the client is not a
healthcheck.

## Interview questions

**★ Why does the PostgreSQL healthcheck pass `-h 127.0.0.1`?**
Because `pg_isready` defaults to the Unix socket, and during first-run
initialisation the image runs a temporary daemon that listens **only** on the
socket while it executes the init scripts. A socket check therefore passes while
no TCP connection can be made — so `condition: service_healthy` releases the API,
whose first query is refused. Forcing TCP makes the check use the same transport
the client does, which is the general rule: a healthcheck that tests a different
path from the caller is not testing anything the caller cares about.

**★ Why is the migration a separate service instead of running at API startup?**
Because startup migrations race. With more than one API container they run
concurrently against the same schema, and a failure becomes a crash loop rather
than a clear error. A one-shot service with `restart: "no"` runs exactly once,
exits with a status, and gates the API through `condition:
service_completed_successfully` — so a bad migration stops the deploy instead of
producing 500s. It also uses the API's own image, which keeps the driver, TLS
settings and credentials identical to production traffic.

**★ You bumped `postgres:17` to `postgres:18` and the data disappeared. What
happened?**
The image's data path moved. From 18, `PGDATA` is `/var/lib/postgresql/18/docker`
and the declared `VOLUME` is `/var/lib/postgresql`, so a volume still mounted at
the old `/var/lib/postgresql/data` no longer covers the data directory — the
documentation says such a mount will not persist data. Nothing errors; writes go
to the container's writable layer and vanish when it is recreated. The fix is to
move the mount, and the lesson is that a major-version bump of a database image is
a data-path change, not a tag change.

**Why is a Redis `PING` healthcheck better than a TCP port check?**
Because Redis accepts connections before it can serve data. The documentation
says `PING` verifies *"the server's ability to serve data - an error is returned
when this isn't the case (for example, during load from persistence data or
accessing a stale replica)"*, so an instance restoring a large dump fails `PING`
while a port check already reports success. And it costs nothing: `redis-cli` is
in the official image.

**What happens if you change `db/init/*.sql` on a project that already has a
database?**
Nothing. Init scripts run only against an empty data directory, as do all the
`POSTGRES_*` variables. That is deliberate — it makes the bootstrap idempotent
across restarts — but it means `docker-entrypoint-initdb.d` cannot be used for
schema evolution. Once a volume exists, the only supported route is a migration.

**Should the cache have a volume?**
It depends on what losing it costs. If an empty cache means the application is
slow for a minute, the volume is a convenience. If an empty cache means the
application is *wrong*, the data is not cache-shaped and belongs in the database.
The volume here exists so the decision is visible in the file and reversible in one
line, rather than being made implicitly by whoever wrote the service first.

---

← Prev: [The wiring](03-the-wiring.md) · Index: [Phase 9](../README.md) · Next → [The application services](05-the-api-and-the-frontend.md)
