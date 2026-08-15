---
title: "The whole stack in one file"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the Compose file reference](https://docs.docker.com/reference/compose-file/),
> the official
> [`postgres`](https://hub.docker.com/_/postgres),
> [`redis`](https://hub.docker.com/_/redis) and
> [`nginx`](https://hub.docker.com/_/nginx) image documentation,
> [nginx `proxy_pass`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) and
> [Docker DNS services](https://docs.docker.com/engine/network/#dns-services).
> **No sandbox** — no console output on this page.

**This is what phase 8 was for.** One file, six services, one published port — and
every attribute in it already argued somewhere in phase 8, so the work here is
choosing rather than explaining.

The deliverable behind the whole phase: clone the project on a machine with
nothing installed but an engine, run **one command**, and have a working
application with a seeded database — and be able to explain every line of the file
that made it happen.

## The stack

| Service | Image | Job |
|---|---|---|
| `proxy` | `nginx` | the single origin — `/api/` to the API, everything else to the frontend |
| `web` | built here | the frontend: a static build in production, a dev server in development |
| `api` | built here | the Node/Express API — the only service on both networks |
| `migrate` | the API's image | a one-shot job that runs migrations and exits |
| `db` | `postgres:18` | PostgreSQL, with the volume path that changed in 18 |
| `cache` | `redis` | Redis |

## The chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The file and its shape](01-the-file.md)** | The complete worked `compose.yaml`, why there is no `version:`, and the `x-` anchor that keeps `api` and `migrate` from drifting apart |
| 02 | **[The wiring](02-the-wiring.md)** | One published port and why, two networks with `internal: true`, volumes declared twice, and secrets delivered as files |
| 03 | **[The stateful services](03-the-stateful-services.md)** | `db`, `cache`, `migrate` — the PostgreSQL 18 data path, `_FILE`, init scripts that run once, and the migration gate |
| 04 | **[The API and the frontend](04-the-api-and-the-frontend.md)** | `api` and `web` — readiness versus liveness, and why the frontend's API URL is a build-time problem |
| 05 | **[The proxy](05-the-proxy.md)** | What the nginx image already does, the envsubst template mechanism, and the DNS trap that turns every API rebuild into a 502 |
| 06 | **[The boot, and proving it](06-the-boot-and-proving-it.md)** | The startup order end to end, and the three checks that show the stack works on a machine that is not yours |

## The five lines that carry the risk

If you read nothing else, read these — each one fails **silently**:

| Line | What goes wrong |
|---|---|
| `db-data:/var/lib/postgresql` | on `postgres:18` the old `/data` path no longer persists anything, and nothing errors |
| `restart: "no"` on `migrate` | unquoted, YAML makes it `false` and the migration loops forever |
| `pg_isready -h 127.0.0.1` | without `-h`, the check passes over the Unix socket while TCP is still refused |
| `set $api http://${API_UPSTREAM};` | a literal upstream name leaves the proxy pointed at the old container's IP after a rebuild |
| `condition: service_healthy` | in short syntax there is no condition at all, and the stack "works the second time" |

## Where this connects

- **[Phase 8 · Compose](../../phase-8-compose/README.md)** is where every attribute
  used here was argued. This topic cites it constantly and re-explains none of it.
- **[Topic 01 · Containerising a Node/Express API](../01-node-api-dockerfile/README.md)**
  and **[topic 02 · Dev image vs prod image](../02-dev-vs-prod-image.md)** are the
  `api` and `web` builds this file consumes.
- **[Topic 03 · PostgreSQL in a container](../03-postgres-in-a-container/README.md)**
  and **[topic 04 · Waiting for the database](../04-waiting-for-the-database/README.md)**
  are the `db` service and the half of readiness that lives in the application.
- **[Topic 06 · Secrets in dev vs prod](../06-secrets-dev-vs-prod.md)** is the
  `secrets:` block and the `_FILE` helper.
- **[Phase 10 · Running containers in production](../../phase-10-production/README.md)**
  takes the same file to a server, where nobody is watching it start.

---

← Prev: [Secrets in dev vs prod](../06-secrets-dev-vs-prod.md) · Index: [Phase 9](../README.md) · Start → [The file and its shape](01-the-file.md)
