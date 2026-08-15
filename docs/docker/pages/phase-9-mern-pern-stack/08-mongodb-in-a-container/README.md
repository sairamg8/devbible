---
title: "MongoDB in a container"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the official `mongo` image documentation](https://hub.docker.com/_/mongo),
> [the `mongo` image Dockerfile](https://github.com/docker-library/mongo),
> [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/),
> [change streams](https://www.mongodb.com/docs/manual/changeStreams/),
> [`rs.initiate()`](https://www.mongodb.com/docs/manual/reference/method/rs.initiate/),
> [deploy a replica set with keyfile access control](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/) and
> [the `ping` command](https://www.mongodb.com/docs/manual/reference/command/ping/).
> **No sandbox** — no console output on this page.

**A single `mongod` in a container is four lines and works immediately — and then
one day you write a transaction and it fails.** The easy part is genuinely easy;
what bites is a deployment requirement, not a container one, and it stays invisible
until the feature is used.

## The two halves

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Running one](01-running-one.md)** | The service, the `MONGO_INITDB_*` variables that only ever run once, `_FILE`, init scripts, and a healthcheck that does not lie |
| 02 | **[The replica set](02-the-replica-set.md)** | Why transactions and change streams need one, the single-member set for development, and why adding authentication is a bigger step than it looks |

🔴 **The dividing line is worth stating plainly:** everything in chunk 01 works on a
plain standalone `mongod`. Chunk 02 is the one feature class that does not, and no
amount of container configuration substitutes for it.

## Where this connects

- **[Topic 03 · PostgreSQL in a container](../03-postgres-in-a-container/README.md)**
  is the same shape for the other database — and shares the once-only
  initialisation rule exactly.
- **[Topic 06 · Secrets in dev vs prod](../06-secrets-dev-vs-prod.md)** is the
  `_FILE` convention this page leans on.
- **[Topic 10 · Migrations and seeds](../10-migrations-and-seeds.md)** is where the
  data that init scripts cannot manage belongs.
- **[Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)** is
  the reference behind the `mongosh` exit-code trap.
- **[MongoDB](../../../../mongodb/README.md)** is the track this containerises.

---

← Prev: [The whole stack in one file](../07-the-whole-stack/README.md) · Index: [Phase 9](../README.md) · Start → [Running one](01-running-one.md)
