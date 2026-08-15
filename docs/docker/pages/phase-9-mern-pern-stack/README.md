---
title: "Phase 9 — The MERN/PERN stack in containers"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.**
> Every page is **documentation-validated** against docs.docker.com,
> docs.podman.io, the official image documentation and the relevant project
> manuals, with the sources named per page. **No sandbox** — nothing was run, so
> no page carries console output.

🏁 **Complete — 14 of 14 topics**, at every tier (Master 5/5 · Understand 7/7 ·
Know 2/2). **32 files, 6,501 lines, largest 297, 0 over the 300-line cap, 281 internal
links resolved against the filesystem** — link-checked, **not built**.

**Everything so far, applied to the actual stack this bible is about.** Phase 8
gave you Compose as a language; this phase is what you say in it — a Node API, a
database that is genuinely ready before the API talks to it, a frontend, and a
proxy in front.

The load-bearing set is **01, 03, 04, 05 and 07**: the API image, the database
with its volume and its init scripts, the two halves of waiting for it, hot
reload that actually reloads, and the worked file that ties them together.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Containerising a Node/Express API](01-node-api-dockerfile/README.md)** | <span className="db-tier t-master">Master</span> | Three stages, `npm ci`, `USER node`, and the `CMD` line that decides whether deploys drop requests |
| 02 | **[Dev image vs prod image](02-dev-vs-prod-image.md)** | <span className="db-tier t-understand">Understand</span> | One Dockerfile, two targets — because two Dockerfiles drift, and the drift surfaces in production |
| 03 | **[PostgreSQL in a container](03-postgres-in-a-container/README.md)** | <span className="db-tier t-master">Master</span> | The data path moved in 18, init scripts run only on an empty directory, and `pg_isready` lies over the socket |
| 04 | **[Waiting for the database](04-waiting-for-the-database/README.md)** | <span className="db-tier t-master">Master</span> | Two halves, both required — Compose gates the first boot, and only the app survives the 3am restart |
| 05 | **[Hot reload inside a container](05-hot-reload/README.md)** | <span className="db-tier t-master">Master</span> | Two failure classes — the file never arrived, or the watcher never noticed — and they are fixed in different places |
| 06 | **[Secrets in dev vs prod](06-secrets-dev-vs-prod.md)** | <span className="db-tier t-understand">Understand</span> | Four places a value can come from, and only the build `ARG` is unrecoverable — rotate, do not rebuild |
| 07 | **[The whole stack in one file](07-the-whole-stack/README.md)** | <span className="db-tier t-master">Master</span> | Six services, one published port — and five lines that fail silently if you get them wrong |
| 08 | **[MongoDB in a container](08-mongodb-in-a-container/README.md)** | <span className="db-tier t-understand">Understand</span> | Four lines that work immediately — and a transaction that needs a replica set to exist at all |
| 09 | **[Redis in a container](09-redis-in-a-container.md)** | <span className="db-tier t-know">Know</span> | RDB vs AOF, and the `maxmemory` default of zero that gets the container OOM-killed |
| 10 | **[Migrations and seeds](10-migrations-and-seeds.md)** | <span className="db-tier t-understand">Understand</span> | Exactly once, in order, before anything serves — and why init scripts and startup migrations both fail that |
| 11 | **[Debugging Node inside a container](11-debugging-node.md)** | <span className="db-tier t-understand">Understand</span> | The inspector is an unauthenticated shell — bind wide inside the namespace, publish narrow on the host |
| 12 | **[A React/Vite frontend](12-react-vite-frontend.md)** | <span className="db-tier t-understand">Understand</span> | Two containers wearing one name — and a bundle whose API URL was decided at build time |
| 13 | **[Nginx in front of the API](13-nginx-in-front.md)** | <span className="db-tier t-understand">Understand</span> | One origin, the SPA fallback, hop-by-hop headers, and the API losing track of who the client is |
| 14 | **[Connecting from the host](14-connecting-from-the-host.md)** | <span className="db-tier t-know">Know</span> | `exec` needs nothing installed and leaves nothing behind; a published port is a socket for the life of the stack |

## Coverage

Fourteen syllabus topics, fourteen pages — one to one, nothing merged and nothing
dropped.

| Syllabus topic | Page |
|---|---|
| Containerising a Node/Express API | 01 (chunked: the build · the runtime) |
| Dev image vs prod image | 02 |
| PostgreSQL in a container | 03 (chunked: the data directory · initialisation and connecting) |
| Waiting for the database | 04 (chunked: the startup gate · surviving a restart) |
| Hot reload inside a container | 05 (chunked: getting the file in · making the change noticed) |
| Secrets in dev vs prod | 06 |
| The whole stack in one file | 07 (chunked: the file · the anchor · the wiring · the stateful services · the API and the frontend · the proxy · the boot and proving it) |
| MongoDB in a container | 08 (chunked: running one · the replica set) |
| Redis in a container | 09 |
| Migrations and seeds | 10 |
| Debugging Node inside a container | 11 |
| A React/Vite frontend | 12 |
| Nginx in front of the API | 13 |
| Connecting from the host | 14 |

## Phase gate

**Deliverable:** clone the project on a machine with nothing installed but an
engine, run one command, and have a working application with a seeded database —
and be able to explain every line of the file that made it happen.

Three checks that it is actually true, not true on your laptop:

- **A clean machine, or at least `down -v` plus a pruned build cache.** Anything
  that only works because of state you already had is not in the file.
- **Restart the database while the stack runs.** The API must recover on its own;
  `depends_on` covers startup and nothing after it.
- **Read the image, not the Dockerfile.** `docker history` and the image config
  say what actually shipped — development dependencies, a root `USER`, a missing
  `CMD` are all visible there.

## Where this connects

- **[Phase 8 · Compose](../phase-8-compose/README.md)** is the language this
  phase writes in. Every healthcheck, `depends_on`, volume and interpolation
  argument is made there and only *used* here.
- **[Phase 3 · The Dockerfile](../phase-3-dockerfile/README.md)**,
  **[Phase 4 · Build strategy](../phase-4-build-strategy/README.md)** and
  **[Phase 5 · Image quality](../phase-5-image-quality/README.md)** are what
  topic 01 spends.
- **[Phase 10 · Running containers in production](../phase-10-production/README.md)**
  picks up where this phase stops: the same image, on a server, with nobody
  watching.
- **[Node.js](../../../nodejs/README.md)**, **[PostgreSQL](../../../postgresql/README.md)**
  and **[MongoDB](../../../mongodb/README.md)** are the tracks this phase
  containerises.

---

← Syllabus: [Part 3 — Running a real stack](../../syllabus/03-running-a-stack.md) · Start → [Containerising a Node/Express API](01-node-api-dockerfile/README.md) · Next phase → [Phase 10 · Running containers in production](../phase-10-production/README.md)
