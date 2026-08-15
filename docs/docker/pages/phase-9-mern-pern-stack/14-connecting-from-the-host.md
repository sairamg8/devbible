---
title: "Connecting from the host"
sidebar_label: "14 · Connecting from the host"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [`docker compose exec`](https://docs.docker.com/reference/cli/docker/compose/exec/),
> [`docker compose run`](https://docs.docker.com/reference/cli/docker/compose/run/),
> [the `services` element (`ports`)](https://docs.docker.com/reference/compose-file/services/#ports),
> [the official `postgres`](https://hub.docker.com/_/postgres),
> [`mongo`](https://hub.docker.com/_/mongo) and
> [`redis`](https://hub.docker.com/_/redis) image documentation and
> [`podman-run(1)`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**You need a shell on the database roughly once a day, and the obvious way to get
one — publish the port — is the thing you should not ship.** There are three ways
in, they differ in what they leave behind, and only one of them requires nothing to
be installed on your machine.

## The three routes

| Route | Needs on the host | Leaves behind |
|---|---|---|
| **`compose exec`** | nothing | nothing |
| **`compose run --rm`** | nothing | nothing (a new container, removed) |
| **a published port** | the client installed | ⚠️ a listening socket, for as long as the stack is up |

### `compose exec` — the default answer

```bash
docker compose exec db    psql   -U acme -d acme
docker compose exec mongo mongosh -u "$MONGO_USER" acme
docker compose exec cache redis-cli
```

It *"execute[s] a command in a running container"* and is *"the equivalent of
`docker exec` targeting a Compose service"*. Three things make it the right default:

- 🔴 **The client is already in the image.** `psql` ships with `postgres`, `mongosh`
  with `mongo`, `redis-cli` with `redis` — so there is nothing to install and no
  version skew between your client and the server.
- **It allocates a TTY by default.** The docs note that *"commands allocate a TTY by
  default, so you can use a command such as `docker compose exec web sh` to get an
  interactive prompt"* — unlike `docker exec`, which wants explicit flags.
- **It targets a service, not a container id**, so it keeps working after every
  recreate.

⚠️ **In a script, turn the TTY off.** `-T` / `--no-tty` disables allocation, and
`--interactive=false` is documented for *"when `docker compose exec` command is used
inside a script"*. A TTY in CI produces control characters in captured output and
can hang on a job with no terminal.

**With replicas, address one:** `--index` is *"index of the container if service has
multiple replicas"*. Without it you get whichever one Compose picks, which is a
confusing way to read logs.

`--user`, `--workdir` and `--env` are the other three flags worth knowing — *"run
the command as this user"*, *"path to workdir directory for this command"*, and
*"set environment variables"*.

### `compose run --rm` — when the container is not running

`exec` needs a running container. If the stack is down, or the service is a one-shot
job, `run` starts a new one ([topic 10](10-migrations-and-seeds.md)):

```bash
docker compose run --rm db psql -h db -U acme -d acme
```

⚠️ **Note the `-h db`.** This is a *new* container, so `localhost` is itself — the
database is at the service name. That is the same "localhost is the container" trap
as [phase 7](../phase-7-networking/03-localhost-is-the-container.md), and it catches
people who copy an `exec` command into a `run`.

Two documented behaviours make it safe alongside a running stack: it publishes
nothing — *"the `docker compose run` command does not create any of the ports
specified in the service configuration"* — and `--rm` removes *"the container after
running while overriding the container's restart policy"*.

### A published port — for GUI tools, and only in development

Some things genuinely cannot go through `exec`: pgAdmin, DataGrip, MongoDB Compass,
a profiler. For those, publish — carefully, and in the **override** file so it
cannot reach production:

```yaml
# compose.override.yaml — development only
services:
  db:
    ports:
      - "127.0.0.1:55432:5432"
  cache:
    ports:
      - "127.0.0.1:56379:6379"
```

Two deliberate choices:

- 🔴 **`127.0.0.1:` is not optional.** Without a host IP the documentation warns
  Docker *"binds to all interfaces (`0.0.0.0`), bypassing host firewall rules"* — so
  a development database with a development password becomes reachable from every
  network the laptop joins.
- **An unusual host port** (`55432` rather than `5432`) means it never collides with
  a locally installed PostgreSQL, and never accidentally receives traffic meant for
  one. Remember the host port and the container port *"serve different purposes"* —
  nothing inside the stack changes.

## Why not in production

The reasons compound, and none of them is theoretical:

1. **It is a listening socket for the life of the stack**, not for the ten minutes
   you needed it.
2. **The credentials are usually the development ones**, because the compose file
   that published the port is the one that set them.
3. **`exec` already covers the legitimate case**, without a socket and without
   installing anything.
4. **The database has no business being on the host network at all** — that is what
   the `internal: true` network in [topic 07](07-the-whole-stack/03-the-wiring.md)
   is for, and a published port routes straight around it.

🔴 **The safe habit: grep the base compose file for `ports:` before every release.**
There should be exactly one, and it should be the proxy's. Anything else is a
debugging session somebody forgot to revert.

For a genuine production incident the answer is a bastion or an SSH tunnel to the
host, then `exec` locally there — the same shape as Node's advice for the debugger
in [topic 11](11-debugging-node.md), and for the same reason.

## Podman

Identical in every respect that matters here: `podman exec`, `podman compose exec`
through the compose provider, and the same host-IP rule on `-p`. The one difference
worth remembering is that **rootless containers cannot bind host ports below 1024**
without configuration ([phase 7](../phase-7-networking/09-privileged-ports-rootless.md))
— irrelevant for `55432`, and the reason a rootless `-p 80:80` fails where Docker's
would not.

## Gotchas

**Symptom:** `docker compose exec db psql` says the command is not found.
**Cause:** The service name is wrong, or the image genuinely does not carry the
client — an Alpine-based image built to be minimal may not.
**Fix:** Check `docker compose ps` for the service name. If the client really is
absent, `compose run --rm` a full image of the same database and connect over the
network with `-h <service>`.

**Symptom:** A CI step using `compose exec` hangs, or its output is full of escape
codes.
**Cause:** Compose allocates a TTY by default.
**Fix:** `-T` / `--no-tty`, or `--interactive=false`, which the documentation
recommends for exactly this case.

**Symptom:** Connecting to the published database port reaches a *different*
database.
**Cause:** A PostgreSQL installed on the host is already on 5432, and the mapping
either failed or you connected to the host's server without noticing.
**Fix:** Publish on an unusual host port and bind it to `127.0.0.1`. The container
port is unchanged, so nothing inside the stack is affected.

**Symptom:** A security review finds the database reachable from the office network.
**Cause:** `ports:` on a data service in the **base** compose file, with no host IP.
**Fix:** Move it to `compose.override.yaml` — passing any `-f` disables the
automatic override, so production cannot inherit it — and always write the
`127.0.0.1:` prefix.

## Interview questions

**★ How do you get a `psql` prompt against a containerised database without
publishing a port?**
`docker compose exec db psql -U acme -d acme`. It runs the command in the already
running container, which is documented as the equivalent of `docker exec` targeting a
Compose service, and it allocates a TTY by default so you get an interactive prompt.
The client ships inside the official image, so nothing is installed on the host and
there is no version skew. If the stack is down, `docker compose run --rm` starts a
throwaway container instead — remembering that in a *new* container the database is
at the service name, not `localhost`.

**★ When is publishing a database port acceptable, and how do you publish it
safely?**
When a tool genuinely cannot go through `exec` — a GUI client or a profiler — and
only in development. Safely means two things: put it in `compose.override.yaml`, so
that passing any `-f` in production drops it; and always bind an explicit host
interface, because without one Docker binds `0.0.0.0` and, in its own words,
bypasses host firewall rules. Using an unusual host port also stops it colliding with
a locally installed server, which is a confusing failure because you connect
successfully — to the wrong database.

**★ Why does `docker compose run --rm db psql` need `-h db` when `exec` does not?**
Because `run` creates a *new* container. Inside it, `localhost` is that container,
which is not running a database — the server is reachable at its Compose service
name over the network. `exec` runs inside the container that already *is* the
database, so the default socket or loopback connection works. It is the same
"localhost is the container" rule that catches published ports, the Node inspector
and the Vite dev server, seen from a third angle.

**What do `-T` and `--index` do on `compose exec`?**
`-T` (`--no-tty`) disables the TTY that Compose allocates by default, which is what
you want inside a script or CI job — the documentation names that case explicitly for
`--interactive=false`. `--index` selects which container to enter when a service has
multiple replicas; without it you get whichever one Compose chooses, which makes
reading logs or state from a scaled service unreliable.

**What is the single check that stops a database being published by accident?**
Grep the base compose file for `ports:` before release. In this stack there should be
exactly one entry and it should belong to the proxy. Everything else that needs host
access uses `exec`, and anything genuinely needed for development lives in the
override file, which production never loads.

---

← Prev: [Nginx in front of the API](13-nginx-in-front.md) · Index: [Phase 9](README.md) · Next → [Phase 10 · Running containers in production](../phase-10-production/README.md)
