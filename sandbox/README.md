# Sandbox

The scripts that produced the numbers on the explanation pages. **Every timing, error
code and console line in `docs/nodejs/pages/` was executed, not recalled** — this is
where it was executed.

Not part of the site. It lives outside `docs/` and `src/`, so Docusaurus never sees it
and `yarn build` never touches it. It has no relationship to the site's `package.json`
— each phase folder is its own npm project.

## Layout

```
sandbox/
├── README.md               # this file
├── p7-background-work/     # Phase 7 — queues, workers, outbox, shutdown, resilience
└── p8-security/            # Phase 8 — in progress
```

One folder per phase, named for the phase directory in `docs/nodejs/pages/`. Scripts
are `exN-topic.mjs`, numbered in the order they were written, not the order of the
pages.

## Running a phase

Each folder is self-contained:

```bash
cd sandbox/p7-background-work
npm install
node ex1-outbox.mjs
```

Deps are installed with **npm**, deliberately — the site uses yarn 4, and keeping the
two apart means a sandbox install can never disturb the site's lockfile. `node_modules`
here is disposable; delete it any time and re-install.

## Containers

Phases that need real servers use podman, on non-default ports so nothing collides
with anything already running on the machine.

**Phase 7:**

```bash
podman run -d --name p7-pg    -e POSTGRES_PASSWORD=devbible -e POSTGRES_DB=shop \
  -p 55432:5432 postgres:17-alpine
podman run -d --name p7-redis -p 56379:6379 redis:8-alpine
```

Tear down with `podman rm -f p7-pg p7-redis`.

**Connect with `127.0.0.1`, never `localhost`.** Node's DNS resolution order is
`verbatim` by default, so `localhost` resolves `::1` first and every connection to a
container published on IPv4 fails — `write ECONNRESET` from MongoDB, connection refused
from Postgres. This has cost real time in three separate phases.

## What is here and what is not

| Phase | Scripts | Measurements |
|---|---|---|
| 0–5 | **Gone** — ran in session scratchpads that no longer exist | Curated findings only, in the memory store |
| 6 — data access | **Gone**, same reason | **Complete**, in the memory store |
| 7 — background work | **Here**, all 10 | **Complete**, in the memory store |
| 8 — security | In progress | In progress |

Phases 0–7 were measured before this folder existed; only Phase 7's scripts were still
on disk when it was created. **Nothing is lost that the pages depend on** — the numbers
themselves live in the memory store, one `reference_phaseN_measurements.md` per phase,
which is what the pages were written from.

Phase 6's scripts could be reconstructed from its measurements file if the containers
are brought back up. That has not been done; it would be a reconstruction, not the
original.

**From Phase 8 onward, sandbox work starts here** rather than in a session scratchpad,
so it survives the session that produced it.

## Rules

- **Run before you write.** A number on a page that was not produced by a script in
  here does not belong on the page.
- **Capture into the memory store as you go**, not at the end. The scripts are the
  evidence; the measurements file is what the pages are written from, and it is what
  survives if this folder is ever lost again.
- **Scripts print, they do not assert.** They are experiments, not a test suite — the
  output is the artifact.
- **Leave the failures in.** Several scripts here deliberately demonstrate the broken
  version alongside the fixed one; that contrast is what the pages are built on.

## pg-api — PostgreSQL Phase 4/8/9 measurements

Backs the rewritten pages for schema-from-Node, dynamic `WHERE`, allowlists,
soft delete and `ORDER BY`.

```bash
podman run -d --name devbible-pg -e POSTGRES_PASSWORD=devbible \
  -e POSTGRES_USER=devbible -e POSTGRES_DB=devbible \
  -p 55432:5432 docker.io/library/postgres:18-alpine

# glibc comparison, for the collation measurement only
podman run -d --name devbible-pg-glibc -e POSTGRES_PASSWORD=devbible \
  -e POSTGRES_USER=devbible -e POSTGRES_DB=devbible \
  -p 55433:5432 docker.io/library/postgres:18
```

| Script | What it measures |
|---|---|
| `ex1-ddl-from-node.mjs` | DDL through `pg`: return shape, `$1` in an identifier slot, transactional rollback, multi-statement calls |
| `ex2-ddl-edges.mjs` | Empty-vs-non-empty params array (protocol switch); the `CREATE TABLE IF NOT EXISTS` race — **228/500 fail** |
| `ex3-advisory-fix.mjs` | Same race behind `pg_advisory_xact_lock` — **500/500 clean** |
| `ex4-soft-delete.mjs` | Hard vs soft delete, cascade behaviour, partial unique index, partial-index plans |
| `ex5-filter-sort.mjs` | `ORDER BY $1` silent no-op, concatenated-identifier injection, dynamic `WHERE`, `ILIKE` wildcards, allowlists, NULL ordering, unstable pagination |
| `ex6-collation.mjs` | Collation providers; musl vs glibc ordering under the same declared locale |
| `ex7-ddl-locks.mjs` | Lock modes per statement, `ADD COLUMN` rewrite check, the lock-queue pile-up, `lock_timeout` |

**Alpine sorts `en_US.utf8` by byte value** (musl has stub locale support), Debian
applies real dictionary rules — same PostgreSQL 18.4. That is why `ex6` needs both
containers.
