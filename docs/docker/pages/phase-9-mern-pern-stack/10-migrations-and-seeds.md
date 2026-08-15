---
title: "Migrations and seeds"
sidebar_label: "10 · Migrations and seeds"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`docker compose run`](https://docs.docker.com/reference/cli/docker/compose/run/),
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/),
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/#depends_on),
> [the `services` top-level element](https://docs.docker.com/reference/compose-file/services/),
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres) and
> [the official `mongo` image documentation](https://hub.docker.com/_/mongo).
> **No sandbox** — no console output on this page.

**A migration is the one thing in the stack that must run exactly once, in order,
before anything serves a request — and "exactly once" is precisely what containers
make hard, because they are designed to be started repeatedly and in parallel.**
Everything on this page is about making that guarantee explicit instead of hoping.

## Four places it could go, and only one is right

| Where | Runs when | Why not |
|---|---|---|
| `/docker-entrypoint-initdb.d` | first boot of an **empty** volume | ⛔ never runs again — cannot evolve a schema |
| the API's startup path | every API container start | ⛔ replicas race; a failure becomes a crash loop |
| **a one-shot service** | once per `up`, gated | ✅ this one |
| `docker compose run --rm` | when you type it | ✅ for ad-hoc and for CI, not for `up` |

### Init scripts are a bootstrap, not a migration

Both database images say the same thing in their own words. PostgreSQL's scripts
run only *"if you start the container with a data directory that is empty"*;
MongoDB's *"will execute files … when a container is started for the first time"*,
and *"none of the variables below will have any effect if you start the container
with a data directory that already contains a database"*.

🔴 **So editing a file in `db/init/` changes nothing on any machine that has
already run the stack.** It works perfectly on a fresh clone and silently does
nothing everywhere else — which is the worst possible failure shape, because the
person who wrote it sees it work.

Put *structure that a brand-new volume needs* there — extensions, a role, an
initial index — and nothing whose absence you would notice next month.

### Startup migrations race

Running migrations from inside the API's boot sequence is one line and it is wrong
for two reasons that only appear later:

- **Two replicas run them at the same time.** `docker compose up --scale api=3`
  starts three containers that all begin migrating. Some migration tools take an
  advisory lock and survive this; relying on that is relying on a detail you did
  not choose.
- **A failed migration becomes a crash loop.** With `restart: unless-stopped` the
  API exits, restarts, fails again — and the signal you get is a restarting
  container rather than "migration 014 failed on line 3".

## The one-shot service

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

Three attributes, each doing one job:

- **`<<: *api-base`** — the API's own image, so the migration runs with the same
  driver, TLS settings and credentials as production traffic
  ([topic 07](07-the-whole-stack/01-the-file.md)).
- 🔴 **`restart: "no"`, quoted.** A job that exits 0 under any other policy is
  restarted forever. Unquoted, YAML reads `no` as the boolean `false` and the key
  does not mean what it says.
- **`condition: service_healthy` on the database** — so it does not start against a
  server that is still running `initdb`.

And the gate on the other side:

```yaml
  api:
    depends_on:
      migrate:
        condition: service_completed_successfully
```

**`service_completed_successfully` is the only condition that means *finished*** —
`service_started` means launched, `service_healthy` means answering. Both halves
are required: without `restart: "no"` the completed job restarts forever; without
the completion condition the API races it.

⚠️ **A failed migration now stops the deploy**, which is the whole point.
`docker compose up --wait` returns non-zero, CI fails on the migration, and nobody
debugs a stream of 500s to discover a missing column.

## `docker compose run --rm` for everything ad-hoc

```bash
docker compose run --rm api npm run migrate:make -- add_orders_table
docker compose run --rm api npm run seed:demo
docker compose run --rm --no-deps api npm run lint
```

The documented behaviours that make this the right tool:

- It *"runs a one-time command against a service"*, starting *"in new containers
  with configuration defined by that of the service"* — and **"the command passed
  by `run` overrides the command defined in the service configuration"**.
- **`--rm`** is described as removing *"the container after running while overriding
  the container's restart policy"*. Both halves matter: without it you accumulate
  exited containers, and the restart policy would otherwise apply to a one-off.
- 🔴 **Ports are not published.** *"the `docker compose run` command does not create
  any of the ports specified in the service configuration"* — which is exactly why
  it does not collide with the stack already running. `--service-ports` opts back
  in, and is almost never what you want here.
- **Dependencies still start.** If the service is configured with links, `run`
  *"first checks to see if the linked service is running and starts the service if
  it is stopped"*; **`--no-deps`** turns that off, which is right for a command that
  needs no database at all.

⚠️ **`run` is not a substitute for the one-shot service.** They answer different
questions: `run` is *a person or a CI step deciding to do this now*; the `migrate`
service is *this must have happened before the API starts*. A stack that relies on
somebody remembering to type the command is not a stack that clones and runs.

## Seeds are not migrations

They get lumped together and they behave differently in every way that matters:

| | Migration | Seed |
|---|---|---|
| Runs | once, in order, everywhere | on demand, usually only in dev and test |
| Idempotent | no — each runs exactly once, tracked | **must be**, because you will run it twice |
| In the boot path | yes, gated | no |
| In production | yes | almost never |

🔴 **Make seeds idempotent and make that a rule, not an aspiration.** `INSERT …
ON CONFLICT DO NOTHING`, upserts keyed on a natural key, or a truncate-then-insert
that is explicitly labelled destructive. A seed that fails the second time is a
seed that will be run twice on the day it matters.

The clean split in Compose is a **profile**, so the seed exists in the file but is
off unless asked for ([Phase 8 · `profiles`](../phase-8-compose/12-profiles.md)):

```yaml
  seed:
    <<: *api-base
    command: ["node", "dist/seed.js"]
    profiles: ["seed"]
    depends_on:
      migrate:
        condition: service_completed_successfully
    restart: "no"
```

`docker compose --profile seed up` runs it; a plain `up` never does. ⚠️ Remember
that *"services without a `profiles` attribute are always enabled"*, and that a
`down` without the profile leaves those containers behind as orphans.

## Where the tool runs, and the file it writes

Generating a migration is the one command that writes **into your working tree**:

```bash
docker compose run --rm api npm run migrate:make -- add_orders_table
```

⚠️ **The new file arrives owned by the container's user.** If the service runs as
root, you get a root-owned file in your repository that your editor cannot save
and `git` reports as modified-but-unstageable. That is
[phase 6's UID mismatch](../phase-6-storage/05-uid-mismatch/README.md), and the fix
is the same: run the container as your own UID for that command, or run the
generator on the host and only *apply* migrations in containers.

**Applying is the part that belongs in a container**, because it must use the same
driver and network path as the application. **Generating** is a developer tool and
is fine on the host.

## Rolling back

The honest position: **`down` is not a rollback**, and most teams do not roll
migrations back in production.

- A `down` migration that has never been executed is not a plan, it is a comment.
- The reliable pattern is **forward-only and additive**: add the column, deploy
  code that writes both, backfill, deploy code that reads the new one, drop the old
  one in a later release. Every step is safe to stop at.
- The rollback that always works is **restoring a backup**, which is why the
  backup matters more than the `down` script
  ([Phase 6 · Backing up a volume](../phase-6-storage/10-backup-and-restore.md)).

`down` migrations are still worth writing for local development, where the cost of
being wrong is `docker compose down -v`.

## Gotchas

**Symptom:** A schema change works on a colleague's fresh clone and does nothing on
every existing machine.
**Cause:** It was added to `/docker-entrypoint-initdb.d`, which both database images
document as running only against an empty data directory.
**Fix:** Move it to a migration. Keep init scripts for what a brand-new volume
needs and nothing else — and treat "it worked on a fresh clone" as evidence of
this bug rather than of correctness.

**Symptom:** The migration container restarts forever after the migration succeeded.
**Cause:** It inherited a restart policy, or `restart: no` was written unquoted so
YAML made it the boolean `false`.
**Fix:** `restart: "no"` on the job, and `condition: service_completed_successfully`
on whatever waits for it.

**Symptom:** With multiple API replicas, migrations sometimes fail with a duplicate
or lock error.
**Cause:** Migrations run in the API's startup path, so every replica starts them
at once.
**Fix:** One gated one-shot service. The API's job is to serve; making it also the
schema owner is what creates the race.

**Symptom:** A generated migration file is owned by root and cannot be edited.
**Cause:** `compose run` wrote into a bind-mounted working tree as the container's
user.
**Fix:** Pass your own UID for that command, or generate on the host. Applying
migrations belongs in the container; generating them does not.

## Interview questions

**★ Where do migrations run in a containerised stack, and why not at API startup?**
In a dedicated one-shot service that uses the API's own image with a different
command, `restart: "no"` so a clean exit is final, and a `depends_on` on the
database with `condition: service_healthy`. Everything that needs the schema then
depends on *it* with `condition: service_completed_successfully`. Not at API
startup, because multiple replicas would run them concurrently and because a
failed migration under a restart policy becomes a crash loop instead of a clear
error that stops the deploy.

**★ Why can't schema changes live in `/docker-entrypoint-initdb.d`?**
Because both the PostgreSQL and MongoDB images document those scripts as running
only when the data directory is empty — first boot of a fresh volume and never
again. Editing one therefore works on a clean clone and silently does nothing on
every machine that already has data, which is the most misleading failure mode
available: the author sees it work. Init scripts are a bootstrap for a brand-new
volume; evolution is a migration.

**★ What is the difference between a migration and a seed, operationally?**
A migration runs exactly once, in order, on every environment including production,
and is tracked so it is never repeated. A seed is on-demand, usually
development-and-test only, and **must be idempotent**, because it will be run
twice. That difference drives the wiring: the migration is a gated one-shot service
in the boot path, while the seed sits behind a Compose profile so it exists in the
file and never runs unless asked for.

**What does `docker compose run --rm` actually change compared with `up`?**
It runs a one-time command against a service in a new container, with the given
command overriding the service's own. It publishes none of the service's ports by
default, which is why it does not collide with a stack that is already up;
`--service-ports` opts back in. `--rm` removes the container afterwards and
overrides its restart policy, and `--no-deps` stops it from starting the service's
dependencies. It is the right tool for ad-hoc work and CI steps, and the wrong tool
for a guarantee, because it only happens when somebody types it.

**Why is a generated migration file sometimes owned by root?**
Because `compose run` wrote it into a bind-mounted working tree as the container's
user, and the container runs as root unless told otherwise. It is the same UID
mismatch that bites every bind mount. The practical split is that *applying*
migrations belongs in a container — same driver, same network path as the
application — while *generating* them is a developer tool that can run on the host.

**How do you roll a migration back?**
Usually you do not. `docker compose down` stops containers and has nothing to do
with schema, and a `down` script that has never been executed is not a tested path.
The dependable approach is forward-only, additive changes — add, dual-write,
backfill, switch reads, drop later — where every intermediate state is safe to stop
at. The rollback that genuinely works is restoring a backup, which is why the
backup is the thing worth testing.

---

← Prev: [Redis in a container](09-redis-in-a-container.md) · Index: [Phase 9](README.md) · Next → **Debugging Node inside a container** *(not written yet)*
