---
title: "PostgreSQL in a container"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres),
> [the `postgres` image Dockerfile (18/trixie)](https://github.com/docker-library/postgres),
> [the Compose `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/).
> **No sandbox** — no console output on this page.

**A database in a container is one service where getting it wrong is not
recoverable.** Every other mistake in this track costs a rebuild; this one costs
the data. Two things carry the whole topic: **where the data directory is**, and
**that initialisation happens exactly once**.

## The service, whole

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: devonly        # required — "must not be empty or undefined"
      POSTGRES_USER: app
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql      # 🔴 18+ path. 17 and below: /var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
    # no ports: — the API reaches it by service name

volumes:
  pgdata:
```

Five lines in that block are the topic, and each has a failure mode with a name:

| Line | What it prevents |
|---|---|
| `pgdata:/var/lib/postgresql` | The data living in an anonymous volume that nobody can find and `down -v` deletes |
| the version-specific path | A "persistent" volume mounted at a path Postgres 18 no longer uses |
| `POSTGRES_PASSWORD` | The container refusing to start at all |
| `/docker-entrypoint-initdb.d` | Hand-run schema that exists only on the machine where it was run |
| `pg_isready -h 127.0.0.1` | A healthcheck that passes *during* initialisation, before the database accepts TCP |

## The chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The data directory](01-the-data-directory.md)** | `PGDATA`, the 18+ path change, named volume versus bind mount, ownership, and what `down -v` actually removes |
| 02 | **[Initialisation and connecting](02-initialisation-and-connecting.md)** | The `POSTGRES_*` variables, `/docker-entrypoint-initdb.d` and its once-only rule, the socket-only trap, healthchecks, configuration and shutdown |

## Where this connects

- **[Phase 8 · Volumes in Compose](../../phase-8-compose/08-volumes.md)** is the
  volume mechanics; this topic is the one service where they are load-bearing.
- **[Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)**
  already establishes the `pg_isready` socket trap — here it is in its natural
  habitat.
- **[Phase 6 · Backing up and restoring a volume](../../phase-6-storage/10-backup-and-restore.md)**
  is the half this page deliberately does not repeat.
- [Topic 04 · Waiting for the database](../04-waiting-for-the-database/README.md) is the
  application's side of the same problem.
- **[PostgreSQL](../../../../postgresql/README.md)** is the database itself —
  this page is only about running it in a container.

---

← Prev: [Dev image vs prod image](../02-dev-vs-prod-image.md) · Index: [Phase 9](../README.md) · Start → [The data directory](01-the-data-directory.md)
