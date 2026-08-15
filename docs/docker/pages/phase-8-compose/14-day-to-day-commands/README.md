---
title: "Day-to-day commands"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/) and
> its subcommand pages —
> [`ps`](https://docs.docker.com/reference/cli/docker/compose/ps/),
> [`logs`](https://docs.docker.com/reference/cli/docker/compose/logs/),
> [`exec`](https://docs.docker.com/reference/cli/docker/compose/exec/),
> [`run`](https://docs.docker.com/reference/cli/docker/compose/run/),
> [`config`](https://docs.docker.com/reference/cli/docker/compose/config/),
> [`top`](https://docs.docker.com/reference/cli/docker/compose/top/) — and
> [`podman-compose(1)`](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
> **No sandbox** — no console output on this page.

**`up` and `down` are the two commands people learn; these six are the ones that
decide how long a bad afternoon lasts.**

Two properties hold for every command in this topic, and they are the whole
ergonomic difference from the plain engine CLI of
[Phase 1](../../phase-1-running-containers/README.md):

- **Everything is scoped to the project.** A command run in this directory sees
  this stack and no other, because the project name namespaces the containers,
  networks and volumes ([page 09](../09-project-name.md)).
- **Everything is addressed by service name**, not by container name. You never
  type `myproject-api-1`.

## The triage order

Four questions, in the order they are worth asking:

| Question | Command | Chunk |
|---|---|---|
| What is actually running, and did anything exit? | `docker compose ps -a` | [01](01-reading-the-stack.md) |
| What did it say before it stopped? | `docker compose logs --tail=100 <svc>` | [01](01-reading-the-stack.md) |
| Is the container's *reality* what I think it is? | `docker compose exec <svc> sh` | [02](02-getting-inside.md) |
| Is the *file* what I think it is, after interpolation and merging? | `docker compose config` | [02](02-getting-inside.md) |

The fourth is the one people skip, and it is the one that resolves the "but the
variable is set" arguments.

## The chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Reading a running stack](01-reading-the-stack.md)** | `ps`, `logs` and `top` — observation from outside the containers, and the defaults that hide the thing you are looking for |
| 02 | **[Getting inside, and asking the file](02-getting-inside.md)** | `exec`, `run` and `config`, the rest of the command surface, and the global options including `--dry-run` |

## Where this connects

- **[Phase 1 · `ps`, `inspect`, `logs`, `stats`](../../phase-1-running-containers/03-ps-inspect-logs-stats.md)**
  is the same triage without a project — read it for what each command *means*;
  this topic is what changes when Compose is in front of it.
- **[Phase 1 · `exec` versus `run`](../../phase-1-running-containers/04-exec-vs-run.md)**
  is the underlying distinction, and it survives intact at the Compose layer.
- **[Page 10 · Environment and interpolation](../10-environment-and-interpolation.md)**
  and **[page 11 · Override files](../11-override-files.md)** are the two topics
  `config` exists to settle.

---

← Prev: [`develop.watch`](../13-develop-watch.md) · Index: [Phase 8](../README.md) · Start → [Reading a running stack](01-reading-the-stack.md)
