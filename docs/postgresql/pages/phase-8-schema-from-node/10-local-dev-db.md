---
title: "A local development database in Podman/Docker"
sidebar_label: "10 · Local dev database"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 with **podman**, images `postgres:18-alpine` and `postgres:18`,
> **PostgreSQL 18.4**, **Node 24.19.0**, `pg` 8.23.0. Every command below was run;
> see `sandbox/README.md` and `sandbox/pg-api/ex6-collation.mjs`.

**A local database should be disposable, version-matched to production, and on a
port that collides with nothing.** All three are one command.

## The command

```bash
podman run -d --name devbible-pg \
  -e POSTGRES_PASSWORD=devbible \
  -e POSTGRES_USER=devbible \
  -e POSTGRES_DB=devbible \
  -p 55432:5432 \
  docker.io/library/postgres:18-alpine
```

```console
$ podman exec devbible-pg psql -U devbible -d devbible -c "select version();"
                                         version
-----------------------------------------------------------------------------------------
 PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

`docker` accepts the identical arguments. The three `POSTGRES_*` variables are read
only on first initialisation — changing them later does nothing unless you delete
the volume, which is a common source of "the password didn't change".

**Port 55432, not 5432.** A non-default host port cannot collide with a
system-installed PostgreSQL or another project's container, and it makes it
impossible to point a script at production by forgetting to change a port.

## Connect on `127.0.0.1`, never `localhost`

This has cost real time in three separate phases of this project:

```
DATABASE_URL=postgres://devbible:devbible@127.0.0.1:55432/devbible
```

Node's DNS resolution order is `verbatim` by default, so `localhost` resolves `::1`
(IPv6) first. A container published on IPv4 only is not listening there, and you get
`connection refused` — or, worse, an intermittent failure depending on the machine's
`/etc/hosts`. Use the literal IPv4 address in every connection string and every
`psql -h`.

## Persistence — and why you may not want it

By default the data lives in an anonymous volume that survives `stop`/`start` but
not `rm`. Two deliberate choices:

```bash
# durable: survives podman rm, data lives in a named volume
podman run -d --name devbible-pg -v devbible-pgdata:/var/lib/postgresql/data ...

# disposable: everything vanishes when the container stops
podman run -d --rm --name devbible-pg --tmpfs /var/lib/postgresql/data ...
```

The disposable form is the better default for a project with working migrations and
seeds: the database is rebuilt from files in seconds, so there is no state to drift.
The durable form matters when you have hand-made local data you would be annoyed to
lose.

`--tmpfs` also makes the database noticeably faster by removing disk sync, which is
fine for development and must never be used anywhere it would be mistaken for a real
deployment.

## The reset script

The single most useful thing to add. One command back to a known state:

```bash
#!/usr/bin/env bash
set -euo pipefail

podman rm -f devbible-pg 2>/dev/null || true
podman run -d --name devbible-pg \
  -e POSTGRES_PASSWORD=devbible -e POSTGRES_USER=devbible -e POSTGRES_DB=devbible \
  -p 55432:5432 docker.io/library/postgres:18-alpine >/dev/null

until podman exec devbible-pg pg_isready -U devbible -q 2>/dev/null; do sleep 0.3; done

node migrate.js
node seed.js
echo "ready on 127.0.0.1:55432"
```

**`pg_isready` in a loop, not `sleep 5`.** The container reports "running" as soon
as the process starts, several seconds before the server accepts connections — and
the initialisation on first run takes longer than on subsequent starts. A fixed
sleep is either too short (flaky CI) or too long (slow every time).

Note that `postgres` images start the server *twice* during first-time
initialisation: once on a Unix socket to run init scripts, then again on TCP. A
readiness check that passes too early can connect during the first phase and then
lose the connection.

## Match the production version — and the base image

Running 16 locally and 18 in production means the features you use may not exist
where it counts. Pin the exact tag, and update it deliberately.

The base image matters too, not just the version number. From
[`ORDER BY`](../phase-4-crud/10-order-by.md), measured on the same PostgreSQL 18.4:

```console
alpine (musl):  Banana, Date, apple, cherry, elderberry
debian (glibc): apple, Banana, cherry, Date, elderberry
```

Same declared `en_US.utf8` collation, different sort order — because musl's locale
support is a stub and falls back to byte order. Develop on `alpine` and deploy on
`postgres:18` (Debian) and your `ORDER BY` results change in production. Either
match the base image, or pin an ICU collation so ordering does not depend on it.

## Compose, for more than one service

```yaml
# compose.yaml
services:
  db:
    image: docker.io/library/postgres:18-alpine
    environment:
      POSTGRES_USER: devbible
      POSTGRES_PASSWORD: devbible
      POSTGRES_DB: devbible
    ports: ["55432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devbible"]
      interval: 2s
      timeout: 3s
      retries: 15
    tmpfs: ["/var/lib/postgresql/data"]
```

`podman compose up -d` or `docker compose up -d`. The `healthcheck` is what lets
other services declare `depends_on: {db: {condition: service_healthy}}` and start in
the right order — the same readiness problem as the shell loop, solved once.

## Trade-off

A container gives you the production version exactly, isolation from other projects,
and a reset that takes seconds. It costs a container runtime, a little RAM, and a
startup wait that a system-installed PostgreSQL does not have.

The alternative — one PostgreSQL installed on the host, shared by every project — is
faster to start and immediately wrong the moment two projects need different major
versions, or one project's reset script truncates another's tables. The container is
worth it as soon as you have two projects.

## Gotchas

**Symptom:** `connection refused` from Node, but `psql` works
**Cause:** `localhost` resolved to `::1`; the container publishes on IPv4.
**Fix:** `127.0.0.1` everywhere.

**Symptom:** A script connects during startup and then errors
**Cause:** The container is "running" before the server accepts TCP connections;
first-time init starts the server twice.
**Fix:** Loop on `pg_isready`, or a compose `healthcheck`.

**Symptom:** Changing `POSTGRES_PASSWORD` has no effect
**Cause:** Those variables apply only on first initialisation of the data directory.
**Fix:** Remove the volume and recreate, or `ALTER USER … PASSWORD`.

**Symptom:** `ORDER BY` results differ between local and production
**Cause:** alpine (musl) sorts by byte value; Debian (glibc) applies real locale
rules — measured on identical PostgreSQL 18.4.
**Fix:** Match the base image, or pin an ICU collation.

**Symptom:** Port 5432 is already in use
**Cause:** A host PostgreSQL or another project's container.
**Fix:** Publish on a project-specific port such as 55432.

**Symptom:** The dev database is slow
**Cause:** Disk sync on every commit.
**Fix:** `--tmpfs /var/lib/postgresql/data` for a disposable local database.

**Symptom:** Data unexpectedly gone after a rebuild
**Cause:** The default anonymous volume does not survive `podman rm`.
**Fix:** A named volume if you need durability — but prefer migrations and seeds
that rebuild it.

## Interview questions

**★ How do you run a local PostgreSQL matching production?**
A container pinned to the exact tag — `postgres:18-alpine` — on a non-default host
port such as 55432 so it cannot collide with a host install or another project.
Pair it with a reset script that removes the container, recreates it, waits on
`pg_isready`, and runs migrations and seeds.

**★ Why `127.0.0.1` rather than `localhost`?**
Node resolves DNS in `verbatim` order by default, so `localhost` yields `::1` first.
A container published on IPv4 is not listening on IPv6, giving `connection refused`.
The literal address removes the ambiguity.

**★ Why not `sleep 5` before running migrations?**
The container reports running before the server accepts connections, and first-time
initialisation starts the server twice — once on a socket for init scripts, then on
TCP. A fixed sleep is flaky or slow; poll `pg_isready`, or use a compose
`healthcheck`.

**★ Does the container's base image matter if the PostgreSQL version matches?**
Yes. Measured on identical PostgreSQL 18.4, alpine (musl) sorted text by byte value
while Debian (glibc) applied real locale rules, from the same declared
`en_US.utf8`. That changes `ORDER BY` output and range-query results. Match the base
image or pin an ICU collation.

**★ Should the local database persist between runs?**
Usually not. With working migrations and seeds it is rebuilt in seconds, so a
disposable database (`--tmpfs`) is faster and cannot drift. Use a named volume only
when you have hand-made local data worth keeping.

**Why does changing `POSTGRES_PASSWORD` do nothing?**
Those environment variables are read only when the data directory is initialised.
On an existing volume the server ignores them — delete the volume or use
`ALTER USER`.

---

← [`COPY FROM STDIN`](09-copy-streams.md) · Next → [Resetting between test runs](11-test-reset.md)
