---
title: "up, down and the lifecycle"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/),
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**`up` makes reality match the file. `down` destroys what the project owns. And
`down -v` is the command that deletes your development database.** Those three
sentences are the whole topic; the rest is the flags that decide how much gets
recreated and how much gets destroyed.

This is the pair of commands you will run more than any other, which is exactly
why the defaults are worth knowing precisely rather than by habit.

| Chunk | What it covers |
|---|---|
| **[01 · `up` and what it recreates](01-up.md)** | Reconciliation, the recreation rule, `-d` and what Ctrl-C does, `--build` versus `--pull`, `--force-recreate` and `--no-recreate`, `--wait`, `--remove-orphans`, `--no-deps`, `-V` |
| **[02 · `down`, and the command that deletes your database](02-down.md)** | What `down` removes and what it deliberately leaves, `-v` and its exact scope, `--rmi`, external resources, and where `stop` / `start` / `restart` fit instead |

## The one-line summary to keep

| Command | What it does |
|---|---|
| `docker compose up -d` | Create or update everything the file describes, in the background |
| `docker compose up -d --build` | The same, but rebuild images from source first |
| `docker compose stop` | Stop the containers, keep them |
| `docker compose start` | Start the stopped containers back up |
| `docker compose down` | Remove containers and networks. **Keeps volumes** |
| `docker compose down -v` | The above, **and delete the data** |

## Where this connects

- **[02 · compose.yaml and the Spec](../02-compose-yaml-and-the-spec/README.md)** —
  `up` acts on the *resolved* file, so `docker compose config` is the first thing
  to check when `up` does something unexpected.
- **[05 · depends_on](../05-depends-on.md)** is what decides the order `up` starts
  things in — and `--wait` is the related question of when `up` returns.
- **[08 · Volumes in Compose](../08-volumes.md)** is why `down -v` is dangerous and
  named volumes are the protection.
- **[Phase 1, page 07 — the container lifecycle](../../phase-1-running-containers/07-lifecycle.md)**
  is the same distinction one level down: stopping ends the process, removing
  destroys the container.

---

← Prev: [compose.yaml and the Spec](../02-compose-yaml-and-the-spec/README.md) · Index: [Phase 8](../README.md) · Start → [`up` and what it recreates](01-up.md)
