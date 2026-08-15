---
title: "Initialisation and connecting"
sidebar_label: "02 · Init and connecting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres),
> [the `postgres` image Dockerfile (18/trixie)](https://github.com/docker-library/postgres),
> [the Compose `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/) and
> [`docker compose exec`](https://docs.docker.com/reference/cli/docker/compose/exec/).
> **No sandbox** — no console output on this page.

**Every `POSTGRES_*` variable and every init script obeys one rule: they act only
when the data directory is empty.** The image says it twice, and it explains
almost every "my change did nothing" report about a containerised database.

## The variables

| Variable | Required? | What it does |
|---|---|---|
| **`POSTGRES_PASSWORD`** | 🔴 **yes** | The superuser password. *"must not be empty or undefined"* — without it the container refuses to start |
| `POSTGRES_USER` | no | The superuser to create; defaults to `postgres`, and a database of the same name is created |
| `POSTGRES_DB` | no | The default database; defaults to the value of `POSTGRES_USER` |
| `POSTGRES_INITDB_ARGS` | no | *"space separated string of arguments"* passed to `initdb` — `--data-checksums` is the one worth knowing |
| `POSTGRES_INITDB_WALDIR` | no | Puts the write-ahead log somewhere other than `PGDATA` |
| `POSTGRES_HOST_AUTH_METHOD` | no | Auth for host connections. Defaults to **`scram-sha-256`** on PostgreSQL 14+ (`md5` on older) |
| `PGDATA` | no | The data directory. Set it explicitly to pin the layout across major versions |

🔴 **All of them are once-only:** *"The Docker specific variables will only have
an effect if you start the container with a data directory that is empty."*
Changing `POSTGRES_PASSWORD` in the compose file on an existing volume changes
nothing at all — the password lives in the database, which already exists. Either
change it with `ALTER USER`, or `down -v` and start again.

⛔ **`POSTGRES_HOST_AUTH_METHOD=trust` is documented with a warning:** *"It is not
recommended to use `trust` since it allows anyone to connect without a
password."* It turns up in tutorials as a fix for a password problem that is
almost always the once-only rule instead.

## `/docker-entrypoint-initdb.d`

```yaml
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d:ro
```

```
db/init/
├── 01-schema.sql
├── 02-extensions.sql
└── 03-seed.sh
```

The documented behaviour, precisely:

- `*.sql`, `*.sql.gz` and `*.sh` files are supported, executable or not.
- They run **"in sorted name order as defined by the current locale"** — which is
  why the numeric prefixes are not decoration.
- They run **as the `postgres` user** (or the custom `--user` if one is set).
- 🔴 They run **"only if you start the container with a data directory that is
  empty"**. Pre-existing databases are left untouched.

That last rule is the whole ergonomics of the directory. It is an *initialiser*,
not a migration system: it makes a fresh database correct, and it will never
apply the file you added yesterday to the database you created last month. Real
schema change belongs in migrations
(**topic 10 · Migrations and seeds**, *not written yet*).

### 🔴 The socket-only trap

The image is explicit that during initialisation *"the temporary daemon listens
only on the Unix socket"*, and that scripts should use `psql` without a hostname
and with `--username "$POSTGRES_USER"`.

Two consequences, and the second one bites far outside init scripts:

1. **Inside an init script**, a `psql -h localhost` fails — there is no TCP
   listener yet. Omit the host so `psql` uses the socket.
2. **A socket-based `pg_isready` passes during that window**, which means a
   healthcheck written the obvious way reports *healthy* while the database is
   still running `initdb` and cannot accept a single connection from the API.

## The healthcheck that is actually true

```yaml
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
```

- 🔴 **`-h 127.0.0.1` forces TCP**, so the check can only pass once the real
  server is accepting network connections — which is what the API actually needs
  ([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)).
- **`-U` and `-d`** make it a check of *your* database and role, not merely of a
  listening port.
- **`CMD-SHELL`**, because `["CMD", "pg_isready -h 127.0.0.1"]` — one string
  containing spaces — is the classic permanently-failing healthcheck.
- **`start_period: 30s`** covers first-run `initdb`, which on a fresh volume with
  seed data is not instant.

⚠️ **This gates startup only.** `depends_on: condition: service_healthy` is
consulted when the stack comes up and never again — the database restarting at
3am re-orders nothing. The application must survive it independently, which is
topic 04.

## Configuration

The image's `CMD` is `["postgres"]`, so anything you pass as a Compose `command`
becomes arguments to the server:

```yaml
    command: ["postgres", "-c", "shared_buffers=256MB", "-c", "log_statement=all"]
```

```yaml
    volumes:
      - ./db/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
```

⚠️ **Repeat `postgres` as the first element.** A non-null `command` replaces the
image's `CMD` entirely; writing only the flags leaves the container trying to
execute `-c` ([Phase 3 · `CMD` versus `ENTRYPOINT`](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md)).
`-c` flags are a good fit for the handful of settings a development stack changes;
a mounted config file is better once there are more than a few.

## Shutdown: the image already fixed the hard part

```dockerfile
STOPSIGNAL SIGINT
```

with the Dockerfile's own explanation: *"We set the default `STOPSIGNAL` to
`SIGINT`, which corresponds to what PostgreSQL calls 'Fast Shutdown mode' wherein
new connections are disallowed and any in-progress transactions are aborted,
allowing PostgreSQL to stop cleanly and flush tables to disk."*

This is worth understanding rather than just inheriting: Postgres treats the
*default* `SIGTERM` as **smart shutdown**, which waits for every client to
disconnect — so with the default signal a stop would hang for the full grace
period whenever a connection pool was attached, and then be `SIGKILL`ed mid-flush
([Phase 3 · `STOPSIGNAL`](../../phase-3-dockerfile/16-stopsignal-and-shell.md)).
🔴 **Do not override `stop_signal:` for this service** — that is the one change
that turns a clean stop into an unclean one.

## Connecting

```yaml
      DATABASE_URL: postgres://app:devonly@db:5432/app
```

- **From another container: the service name and the container port.** `db:5432`,
  regardless of what is published — the host port is irrelevant to
  container-to-container traffic
  ([Phase 8 · Networks](../../phase-8-compose/07-networks.md)).
- **From your host: only if you publish**, and then it is `localhost:<host port>`.
  `"5433:5432"` is the usual choice, because a locally installed Postgres already
  owns 5432.
- **Without publishing at all:** `docker compose exec db psql -U app -d app` gives
  you a shell against the running database, which is the better default —
  publishing a database port binds `0.0.0.0` unless you say otherwise, and that
  is worth avoiding on any shared machine
  ([Phase 8 · Day-to-day commands](../../phase-8-compose/14-day-to-day-commands/02-getting-inside.md)).

## Gotchas

**Symptom:** You changed `POSTGRES_PASSWORD` (or `POSTGRES_DB`) and nothing
happened.
**Cause:** The Docker-specific variables only take effect on an empty data
directory. The database already exists and carries its own credentials.
**Fix:** `ALTER USER … PASSWORD …` for a real change, or `down -v` to start
clean. Do not reach for `POSTGRES_HOST_AUTH_METHOD=trust` — it is disabling
authentication to work around a misunderstanding.

**Symptom:** A new file in `/docker-entrypoint-initdb.d` is ignored.
**Cause:** Same rule: scripts run only when the data directory is empty.
**Fix:** `down -v` in development. For an existing database, that is what
migrations are for.

**Symptom:** The API connects before the database is ready, despite
`condition: service_healthy`.
**Cause:** A socket-based `pg_isready` passes during first-run initialisation,
when the temporary daemon listens only on the Unix socket.
**Fix:** `pg_isready -h 127.0.0.1`, plus a `start_period` generous enough to
cover `initdb`.

**Symptom:** `docker compose stop` on the database takes the full grace period.
**Cause:** Something overrode `stop_signal`, so Postgres received `SIGTERM` —
smart shutdown — and waited for every client to disconnect.
**Fix:** Remove the override. The image's `STOPSIGNAL SIGINT` is deliberate and
correct.

## Interview questions

**★ Why did changing `POSTGRES_PASSWORD` in the compose file do nothing?**
Because the Docker-specific variables only have an effect when the container
starts with an *empty* data directory. On an existing volume the database already
exists and holds its own credentials, so the variable is read and ignored. The
real fixes are `ALTER USER` or a deliberate `down -v`; setting
`POSTGRES_HOST_AUTH_METHOD=trust` "to make it work" disables authentication
entirely, and the documentation explicitly recommends against it.

**★ Why does `pg_isready` need `-h 127.0.0.1`?**
Because during first-run initialisation the temporary daemon listens only on the
Unix socket. A socket-based check therefore passes while the database is still
initialising and cannot accept a TCP connection — so `depends_on:
condition: service_healthy` releases the API too early. Forcing TCP makes the
check assert the thing the application actually depends on.

**★ What is `/docker-entrypoint-initdb.d` for, and what is it not?**
It runs `.sql`, `.sql.gz` and `.sh` files in locale-sorted name order, as the
`postgres` user, **only** when the data directory is empty. It is an initialiser
for a fresh database — extensions, roles, a starting schema, seed data. It is not
a migration system: it will never touch a database that already exists, which is
exactly the property you want from initialisation and exactly the property that
makes it useless for schema change.

**Why does the official image set `STOPSIGNAL SIGINT`?**
Because `SIGINT` is Postgres's fast shutdown — new connections refused, in-flight
transactions aborted, tables flushed. The default `SIGTERM` is *smart* shutdown,
which waits for clients to disconnect, so with a connection pool attached the
container would sit out the whole grace period and then be killed mid-flush. It
is one of the clearest examples of an image encoding a correctness decision, and
overriding `stop_signal` undoes it.

**How should the API address the database, and should you publish 5432?**
By service name and container port — `db:5432` — because container-to-container
traffic never goes through a published host port. Publishing is only for tools on
your machine, and then usually as `"5433:5432"` to avoid a locally installed
Postgres. On a shared or exposed host, prefer `docker compose exec db psql`, since
a published port binds all interfaces by default.

---

← Prev: [The data directory](01-the-data-directory.md) · Index: [PostgreSQL in a container](README.md) · Next → **Waiting for the database** *(not written yet)*
