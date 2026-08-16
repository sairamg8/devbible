---
title: "Checks that are actually true"
sidebar_label: "02 · Checks that are true"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/),
> the [official `postgres` image documentation](https://hub.docker.com/_/postgres) and
> [the MongoDB Shell documentation](https://www.mongodb.com/docs/mongodb-shell/).
> **No sandbox** — no console output on this page.

**"Healthy" has to mean "a client's next request will succeed". Most healthchecks
in the wild mean "the process has not exited", which the engine already knew.**

Here are the four checks you will actually write, and what is wrong with the
obvious version of each.

## PostgreSQL

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 60s
      start_interval: 2s
```

`pg_isready` is the right tool — it is Postgres's own "can a client connect"
probe. **The `-h 127.0.0.1` is the part that is easy to leave off and matters.**

Here is why. The official image documentation says that on first run, scripts in
`/docker-entrypoint-initdb.d` run against a temporary daemon, and that "the
temporary daemon started for these initialization scripts listens only on the Unix
socket, so any `psql` usage should drop the hostname portion". A `pg_isready` with
no host talks to that Unix socket — so during initialisation it can be answered by
a server that is deliberately not accepting network connections yet. Forcing the
check over TCP means it can only pass once the server your application will
actually connect to is listening.

⚠️ **`POSTGRES_PASSWORD` "is required for you to use the PostgreSQL image. It must
not be empty or undefined."** A missing password is a container that never starts,
which presents as a healthcheck that never passes — look at the logs before you
blame the check.

Two related facts worth carrying into [page 08](../08-volumes.md): the init scripts
"are only run if you start the container with a data directory that is empty", so
editing a seed file and running `up` again does nothing until the volume is
destroyed. That is the honest reason `down -v` exists in a development workflow.

## MongoDB

```yaml
services:
  mongo:
    image: mongo:8
    healthcheck:
      test: ["CMD-SHELL", "mongosh --quiet --eval 'db.adminCommand({ping: 1}).ok' | grep -q 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
      start_interval: 2s
```

`mongosh` is "a JavaScript and Node.js REPL environment for interacting with
MongoDB deployments", and it is the shell shipped in current images. ⚠️ **Older
image tags shipped the legacy `mongo` binary instead** — check which one exists in
the tag you pin rather than copying a check between projects. I could not confirm
from the primary documentation exactly which MongoDB release dropped the legacy
shell, so treat the binary name as image-specific and verify it for your tag.

`db.adminCommand({ping: 1})` is the cheapest command that proves the server is
answering. Note the `grep -q 1`: `mongosh` exits 0 even when the command inside it
reports failure, so without inspecting the output the check reports healthy
whenever the shell *starts*. That is the general shape of a false check — the
binary succeeded, the question was never asked.

**If you need transactions or change streams, a single `mongod` is not enough** —
those require a replica set, and a `ping` will happily report healthy on a
standalone server that cannot serve them. The check is true about the server and
silent about the capability.

## Redis

```yaml
services:
  cache:
    image: redis:8-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s
```

The simplest of the four, and the one where `CMD` (no shell) is genuinely right:
three separate list items, no shell features needed. `redis-cli ping` answers
`PONG` and exits 0.

Redis starts fast, so a short `start_period` is enough — unless it is loading a
large RDB or AOF file from disk, in which case it is not accepting commands yet and
the period needs to cover the load. Whether your cache should persist at all is
[Phase 9 · Redis in a container](../../phase-9-mern-pern-stack/09-redis-in-a-container.md).

If the instance requires a password, `redis-cli` needs it too, and putting it in
the `test` string means it is visible in `docker inspect` — which is another
argument for `CMD-SHELL` with a variable the container already has, rather than a
literal.

## A Node/Express API

```yaml
services:
  api:
    build: .
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 20s
      start_interval: 2s
```

Two deliberate choices here:

1. **No `curl`.** Slim and Alpine base images usually do not have it, and
   installing a package purely for a healthcheck adds bytes and a CVE surface to
   every image you ship. The runtime you already have can make an HTTP request —
   that is the pattern for Node, Python, Go and anything else.
2. **`127.0.0.1`, not `localhost`.** Inside the container `localhost` is the
   container ([Phase 1, page 05](../../phase-1-running-containers/05-publishing-ports.md)),
   which is correct here — but `localhost` can resolve to `::1` first, and a server
   bound only to IPv4 will refuse it. The literal address removes the question.

**And the endpoint itself is the real design decision.** `/healthz` should confirm
that *this process* can serve — the HTTP server is listening, the config loaded,
the app finished booting. It should **not** query the database, call another
service, or run a migration check. If it does, one slow dependency marks every
replica unhealthy at the same moment, which turns a degraded dependency into a
total outage.

## What a check must not do

| Anti-pattern | Why it is wrong |
|---|---|
| `test: ["CMD", "true"]` | Reports healthy always. Worse than no check, because `condition: service_healthy` believes it |
| Checking the dependency's health | Couples failures. One database blip fails the whole fleet at once |
| A check that runs a query with real cost | It runs every `interval`, forever, on every replica |
| Anything needing a binary the image lacks | Fails permanently, and looks like the service is broken |
| A `timeout` longer than a few seconds | Lets a hung service keep serving while the check waits |

## Podman

The checks above are commands inside the container, so they are engine-independent.
What differs is the **scheduling**: Podman runs healthchecks from systemd timers
([Phase 3, page 11](../../phase-3-dockerfile/11-healthcheck.md)), so a rootless
container whose user session ends without linger can stop being checked entirely —
its health freezes at the last recorded value rather than going stale visibly.
`podman healthcheck run <container>` forces one on demand.

## Gotchas

**Symptom:** Postgres reports healthy, and the API still cannot connect on first
boot.
**Cause:** `pg_isready` with no host went over the Unix socket, which the temporary
initialisation daemon also answers.
**Fix:** `pg_isready -U postgres -h 127.0.0.1`, so the check can only pass once the
server is listening on TCP.

**Symptom:** A seed script in `/docker-entrypoint-initdb.d` was edited and nothing
changed.
**Cause:** Those scripts "are only run if you start the container with a data
directory that is empty".
**Fix:** `docker compose down -v` and bring it back up — deliberately, knowing what
`-v` deletes ([page 03](../03-up-and-down/02-down.md)).

**Symptom:** The Mongo healthcheck passes while the server is rejecting commands.
**Cause:** `mongosh` exits 0 because the *shell* ran, regardless of what the command
inside it returned.
**Fix:** Inspect the output — pipe through `grep -q 1`, or have the eval script call
`quit(1)` on failure.

**Symptom:** `curl: not found` in the healthcheck output.
**Cause:** Slim and Alpine images do not ship `curl`.
**Fix:** Use the language runtime already in the image to make the request. Do not
install `curl` into a production image for the sake of a healthcheck.

## Interview questions

**★ Write a healthcheck for Postgres, and explain the flag people leave off.**
`test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1"]` with a generous
`start_period` and a short `start_interval`. The `-h 127.0.0.1` is the important
part: the official image's first-run initialisation runs against a temporary daemon
that listens only on the Unix socket, so a socket-based check can pass before the
server is accepting network connections. Forcing TCP means the check tests the same
path the application will use.

**★ Why should an API's healthcheck not check the database?**
Because it converts a dependency problem into a fleet-wide one — a two-second
database hiccup marks every replica unhealthy simultaneously, and anything acting on
that health (a load balancer, an orchestrator, `depends_on`) reacts to all of them
at once. The check should answer "can this process serve a request", and nothing
more.

**★ What is wrong with `test: ["CMD", "true"]`?**
It always reports healthy, which is strictly worse than having no healthcheck at
all: with no check the state is "none" and nothing acts on it, while a check that
always passes is a false claim that `condition: service_healthy` and any external
consumer will act on. If you want to switch a check off, use `disable: true`.

**How do you write a healthcheck for an image with no `curl`?**
Use the runtime that is already there. For Node, `node -e` with a `fetch` that exits
non-zero on a bad response; the same shape works for Python, Go or anything else.
Installing a package solely to run a healthcheck adds size and attack surface to
every image you ship.

**Why `127.0.0.1` rather than `localhost` in a container healthcheck?**
`localhost` may resolve to `::1` first, and a server bound only to IPv4 will refuse
that connection — a healthcheck that fails for a reason that has nothing to do with
the service's health. The literal address removes the resolution step.

**Does a passing `ping` on MongoDB mean your application will work?**
Only that the server is answering. If the application needs transactions or change
streams it needs a replica set, and a standalone `mongod` will answer `ping`
perfectly while being unable to serve either. A healthcheck is true about what it
tests and silent about everything else.

---

← Prev: [The keys](01-the-keys.md) · Topic index: [Healthchecks in Compose](README.md) · Next → [Networks in Compose](../07-networks.md)
