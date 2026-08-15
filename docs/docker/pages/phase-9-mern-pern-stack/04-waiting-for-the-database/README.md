---
title: "Waiting for the database"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/),
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/),
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/),
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres) and
> [the node-postgres `Pool` API](https://node-postgres.com/apis/pool).
> **No sandbox** — no console output on this page.

**"It works the second time" is a complete diagnosis.** It means the API started
before the database was ready, crashed, and was restarted into a world where the
database happened to be up. The fix has two halves and **both are required** —
Compose can order the start, and only the application can survive what happens
afterwards.

| Half | Who does it | What it covers |
|---|---|---|
| **The startup gate** | Compose — `depends_on` + `healthcheck` | The first boot: do not start the API until the database answers |
| **Reconnection** | the application — retry with backoff | Everything after the first boot: restarts, failovers, network blips, the 3am maintenance window |

🔴 **Neither half is optional, and doing only the first is the common mistake.**
`depends_on` is consulted **once**, when the stack comes up. The database
restarting an hour later re-orders nothing and notifies nobody; an application
that only survives because Compose sequenced its first boot will fall over the
first time anything moves underneath it.

## The two chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The startup gate](01-the-startup-gate.md)** | `depends_on` conditions, healthchecks that are true, `start_period`, `up --wait`, and one-shot migration gating |
| 02 | **[Surviving a restart](02-surviving-a-restart.md)** | Retry with backoff, connection pools, the pool `error` event that crashes Node, readiness endpoints, and where a restart policy fits |

## Where this connects

- **[Phase 8 · `depends_on`](../../phase-8-compose/05-depends-on.md)** is the
  reference for the attribute; this topic is what to do about its limits.
- **[Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)**
  is where the defaults and the `pg_isready` socket trap are argued.
- **[Topic 03 · PostgreSQL in a container](../03-postgres-in-a-container/README.md)**
  is the other side of the same boot: what the database is doing while the API
  waits.
- **[Phase 10 · Healthchecks in production](../../phase-10-production/09-healthchecks-in-production.md)**
  and
  **[restart policies as supervision](../../phase-10-production/07-restart-as-supervision.md)**
  are what this looks like on a server.

---

← Prev: [PostgreSQL in a container](../03-postgres-in-a-container/README.md) · Index: [Phase 9](../README.md) · Start → [The startup gate](01-the-startup-gate.md)
