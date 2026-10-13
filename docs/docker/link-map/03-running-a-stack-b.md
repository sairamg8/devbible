---
title: "Link map · Docker · Part 3b (phase 9)"
sidebar_label: "03b · The MERN/PERN stack"
sidebar_position: 4
---

# Link map · Docker · Part 3b (phase 9)

Continues `03-running-a-stack.md` (split to stay under the 300-line cap). Covers T09-01 to T09-14, the 14 topic rows of phase 9 in `docs/docker/syllabus/03-running-a-stack.md`. Each has a page of ours (✅); where a page folder carries the row, the path is the folder README.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.

🔴 **Version notes (2026-10-12).** The Docker Node.js guide (modified 2026-09-07) builds on `dhi.io/node:24-alpine3.23-dev`, Docker Hardened Images. The Postgres image README lists 18.6 as `latest`, and says the image's `PGDATA` became version specific from PostgreSQL 18 (`/var/lib/postgresql/18/docker`), so the data volume mounts at `/var/lib/postgresql` rather than `/var/lib/postgresql/data`. Check the mount point on every Postgres page we write.

---

## Phase 9 — The MERN/PERN stack in containers

### T09-01 · Containerising a Node/Express API — Master · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/01-node-api-dockerfile/README.md`
- **Read this:** [Node.js language-specific guide](https://docs.docker.com/guides/nodejs/) · docs.docker.com · a multi-stage Dockerfile (builder, production-deps and runner stages) using cache and bind mounts; it runs `npm install`, with `npm ci` only as a commented-out upgrade; modified 2026-09-07 (*read* the Dockerfile; the rest *headings only*, 78k characters) · covers our angle: **partial** — uses Docker Hardened Images, and the signal-handling and non-root detail was not checked in the guide's runner stage · fetched 2026-10-12
- **Also good:** [Docker and Node.js Best Practices (raw)](https://raw.githubusercontent.com/nodejs/docker-node/main/docs/BestPractices.md) · nodejs/docker-node · `NODE_ENV=production`; Node as PID 1 ignores `SIGINT`, so use `--init` or Tini; the `node` user has uid 1000 (*read*) · fetched 2026-10-12
- **Beyond the docs:** [node-docker-good-defaults README (raw)](https://raw.githubusercontent.com/BretFisher/node-docker-good-defaults/main/README.md) · BretFisher/node-docker-good-defaults · a worked repo showing why to run `node` directly instead of npm (npm does not pass SIGTERM on), the `/healthz` HEALTHCHECK, and dependencies kept outside the bind mount; the official guide does not argue these choices · fetched 2026-10-13 (*read*)
- **Our delta:** the `CMD ["node", ...]` exec form and graceful shutdown handler are ours; the public `node` image's `node` user versus the Hardened Images user.

### T09-02 · Dev image vs prod image — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/02-dev-vs-prod-image.md`
- **Read this:** [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) · docs.docker.com · named stages, `--target`, stop at a stage; modified 2024-09-10 (*read*) · covers our angle: **partial** — no Node dev-dependency story · fetched 2026-10-12
- **Also good:** [Node.js language-specific guide](https://docs.docker.com/guides/nodejs/) · docs.docker.com · the "Use containers for Node.js development" section: updated Docker assets for dev, local database, watch, debug (*headings only*) · fetched 2026-10-12
- **Our delta:** what dev needs that prod must not have (`devDependencies`, inspector, source mounts).

### T09-03 · PostgreSQL in a container — Master · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/03-postgres-in-a-container/README.md`
- **Read this:** [postgres image README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/postgres/README.md) · docker-library/docs · `POSTGRES_*` variables, `/docker-entrypoint-initdb.d` scripts run only when the data directory is empty, and the PostgreSQL 18 `PGDATA` change (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the named-volume mount path for 18+, and recovering from "my init script did not run".

### T09-04 · Waiting for the database — Master · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/04-waiting-for-the-database/README.md`
- **Read this:** [Control startup and shutdown order in Compose](https://docs.docker.com/compose/how-tos/startup-order/) · docs.docker.com · `service_healthy` with a `pg_isready` check; says the app should also re-establish connections itself (*read*; modified 2025-12-03) · covers our angle: **partial** — nothing on retry with backoff in application code · fetched 2026-10-12
- **Our delta:** retry-with-backoff in the Node pool and surviving a database restart: web search found no authoritative page, so our page owns the argument.

### T09-05 · Hot reload inside a container — Master · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/05-hot-reload/README.md`
- **Read this:** [Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) · docs.docker.com · `sync` and `rebuild` actions, ignore `node_modules/`; modified 2026-08-19 (*read*) · covers our angle: **partial** — no Node watcher, and no bind-mount polling detail · fetched 2026-10-12
- **Also good:** [Node.js CLI](https://nodejs.org/api/cli.html) · nodejs.org · lists `--watch`, `--watch-path`, `--watch-preserve-output` (*headings only*; the option text was not read) · fetched 2026-10-12
- **Also good:** [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) · docs.docker.com · the shadowing rule behind the `node_modules` fix (*read*) · fetched 2026-10-12
- **Our delta:** file-watch events across a Mac or Windows bind mount (polling flags): not confirmed by any page read.

### T09-06 · Secrets in dev vs prod — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/06-secrets-dev-vs-prod.md`
- **Read this:** [Use secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/) · docs.docker.com · secrets avoid the exposure risk of environment variables; a service gets only the secrets it is granted; modified 2026-08-13 (*read*) · covers our angle: **partial** — a mechanism, not the dev-versus-prod policy · fetched 2026-10-12
- **Also good:** [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · OWASP · lifecycle and principles for secrets (*headings only*, 67k characters) · fetched 2026-10-12
- **Also good:** [Node.js language-specific guide](https://docs.docker.com/guides/nodejs/) · docs.docker.com · a worked `POSTGRES_PASSWORD_FILE=/run/secrets/db-password` stack (*read*) · fetched 2026-10-12
- **Our delta:** `.env` is convenience, not a store; the image must be identical in both environments.

### T09-07 · The whole stack in one file — Master · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/07-the-whole-stack/README.md`
- **Read this:** [Node.js language-specific guide](https://docs.docker.com/guides/nodejs/) · docs.docker.com · one `compose.yaml` with an app, Postgres, `depends_on` `service_healthy`, a password secret, a named data volume and `develop.watch` (*read* the Compose file) · covers our angle: **partial** — no Redis, no frontend, no proxy · fetched 2026-10-12
- **Also good:** [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) · docs.docker.com · API, Postgres and Redis with a healthy-database gate (*read*) · fetched 2026-10-12
- *Checked, not chosen:* [awesome-compose react-express-mongodb (raw)](https://raw.githubusercontent.com/docker/awesome-compose/master/react-express-mongodb/README.md) · its sample output shows `node:13.13.0-stretch-slim`, far out of date.
- **Our delta:** all five services in one file, which no page found does.

### T09-08 · MongoDB in a container — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/08-mongodb-in-a-container/README.md`
- **Read this:** [mongo image README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/mongo/README.md) · docker-library/docs · data lives in `/data/db`; mount a volume or host directory there; flags pass through to `mongod` (*read*) · covers our angle: **partial** — no replica-set recipe for Docker · fetched 2026-10-12
- **Also good:** [Convert a standalone to a replica set](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/) · mongodb.com · `rs.initiate()` once, `rs.conf()`, `rs.status()` (*read*) · fetched 2026-10-12
- **Also good:** [Change streams](https://www.mongodb.com/docs/manual/changestreams/) · mongodb.com · available for replica sets and sharded clusters (*read*) · fetched 2026-10-12
- **Beyond the docs:** [MongoDB composed](https://dev.to/rannn505/mongodb-composed-156g) · Ran Cohen, DEV Community (2023-06-13) · a complete single-node replica set in Compose with a `rs.initiate()` / `rs.status()` healthcheck, key file, and the `replicaSet=rs0` plus `directConnection=true` connection string, which the image README lacks · fetched 2026-10-13 (*read*)
- **Our delta:** a single-node replica set in Compose, with a healthcheck that waits for it. Transactions: the MongoDB transactions manual page names replica sets and sharded clusters but does not say a standalone fails (not confirmed; page not linked).

### T09-09 · Redis in a container — Know · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/09-redis-in-a-container.md`
- **Read this:** [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) · redis.io · RDB snapshots, AOF write log, none ("sometimes used when caching"), or both; modified 2026-09-30 (*read*) · covers our angle: **partial** — not Docker specific · fetched 2026-10-12
- **Also good:** [redis image README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/redis/README.md) · docker-library/docs · `redis-server --save 60 1` for persistent storage; points to the persistence page (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Redis: cache vs store](https://docs.railway.com/guides/redis-cache-vs-store) · Railway guides · frames the cache-or-durable decision with concrete flags: `--save "" --appendonly no` plus `allkeys-lru` for a cache; AOF `everysec`, a `/data` volume and `noeviction` for a store; the persistence page gives no such decision rule · fetched 2026-10-13 (*read*)
- **Our delta:** whether a cache should persist at all, and the volume path.

### T09-10 · Migrations and seeds — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/10-migrations-and-seeds.md`
- **Read this:** [Use init containers in Compose](https://docs.docker.com/compose/how-tos/init-containers/) · docs.docker.com · `pre_start` runs a migration in an ephemeral container after the database is healthy, before the app starts; compares it with a one-shot service plus `service_completed_successfully`; modified 2026-08-19 (*read*) · covers our angle: **partial** — a `manage.py migrate` example, no Node tool · fetched 2026-10-12
- **Also good:** [docker compose run](https://docs.docker.com/reference/cli/docker/compose/run/) · docs.docker.com · one-off commands with `--rm` (*headings only*) · fetched 2026-10-12
- **Our delta:** the minimum Compose version for `pre_start` is not on the page (not confirmed); a Node tool's migrate command is ours.

### T09-11 · Debugging Node inside a container — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/11-debugging-node.md`
- **Read this:** [Debugging Node.js](https://nodejs.org/learn/getting-started/debugging) · nodejs.org · `--inspect` listens on `127.0.0.1:9229` by default; binding to `0.0.0.0` lets anyone who can reach it run code (*read*) · covers our angle: **partial** — no Docker publishing · fetched 2026-10-12
- **Also good:** [Node.js language-specific guide](https://docs.docker.com/guides/nodejs/) · docs.docker.com · `--inspect=0.0.0.0:9229` in the dev script, attach from VS Code or Chrome DevTools; its launch config sets `sourceMaps` (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Setting up Node.js in a Docker container](https://mybyways.com/blog/setting-up-node-js-in-a-docker-container) · mybyways.com (2019-04-12) · pairs `--inspect=0.0.0.0:9229` in the container with `-p 127.0.0.1:9229:9229` on the host and says why: exposing the debug port publicly is unsafe · fetched 2026-10-13 (*read*)
- **Our delta:** publish `127.0.0.1:9229:9229` only (host side), never in prod.

### T09-12 · A React/Vite frontend — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/12-react-vite-frontend.md`
- **Read this:** [Containerize a React.js application](https://docs.docker.com/guides/reactjs/) · docs.docker.com · multi-stage build into a custom Nginx config, non-root `nginx` user; modified 2026-07-21 (*read* the runner stage) · covers our angle: **partial** — no API-URL build-time discussion · fetched 2026-10-12
- **Also good:** [Vite · Env variables and modes](https://vite.dev/guide/env-and-mode) · vite.dev · `VITE_` variables are replaced into the client code at build time and are public (*read*) · fetched 2026-10-12
- **Also good:** [Vite · Deploying a static site](https://vite.dev/guide/static-deploy) · vite.dev · build and preview, host options (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Runtime environment variables for React apps with Nginx and Docker](https://dev.to/imzihad21/runtime-environment-variables-for-react-apps-with-nginx-and-docker-3p62) · ZèD (imzihad21), DEV Community (2025-12-25) · states that bundlers inline config at build time, then shows the alternative of an `envsubst` template run from `/docker-entrypoint.d/` so one image serves many environments; the Docker and Vite pages stop at the build-time rule · fetched 2026-10-13 (*read*)
- **Our delta:** why the API URL cannot change at container start; use a relative `/api` behind the proxy (T09-13).

### T09-13 · Nginx in front of the API — Understand · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/13-nginx-in-front.md`
- **Read this:** [NGINX reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) · docs.nginx.com · `proxy_pass` inside a `location`, passing headers, buffering; modified 2026-07-02 (*read*) · covers our angle: **partial** — no Docker service names and no TLS · fetched 2026-10-12
- **Also good:** [nginx image README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/nginx/README.md) · docker-library/docs · `/etc/nginx/templates/*.template` with `envsubst`, a Compose example (*read*) · fetched 2026-10-12
- **Also good:** [Beginner's guide](https://nginx.org/en/docs/beginners_guide.html) · nginx.org · serving static files and proxying, config structure (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [full-stack-js-docker-tutorial README (raw)](https://raw.githubusercontent.com/daniil/full-stack-js-docker-tutorial/master/README.md) · daniil/full-stack-js-docker-tutorial · a step-by-step Compose build of React, Express, MySQL and an NGINX service routing `/api` to Express and the rest to the UI, which shows the one-origin layout end to end (uses MySQL, not Postgres) · fetched 2026-10-13 (*read*)
- **Our delta:** `proxy_pass http://api:3000`, one origin and no CORS, TLS termination: ours.

### T09-14 · Connecting from the host — Know · ✅ written `docs/docker/pages/phase-9-mern-pern-stack/14-connecting-from-the-host.md`
- **Read this:** [postgres image README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/postgres/README.md) · docker-library/docs · connecting with `psql` from a second container on the same network (*read*) · covers our angle: **partial** — no host-published-port example · fetched 2026-10-12
- **Also good:** [Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/) · docs.docker.com · `-p 192.168.1.100:8080:80` binds one host address; plain `-p` listens on any (*read*) · fetched 2026-10-12
- **Also good:** [psql](https://www.postgresql.org/docs/current/app-psql.html) · postgresql.org · connection options `-h`, `-p`, `-U`, `-d` (*headings only*, 127k characters) · fetched 2026-10-12
- **Beyond the docs:** [Docker ports bypass UFW](https://www.ssdnodes.com/learn/docker-ports-bypass-ufw) · SSD Nodes, Matt Connor (2026-10-11) · explains why a plain published port is reachable despite a firewall rule (Docker's DNAT happens before UFW's INPUT chain) and why `-p 127.0.0.1:...` is the fix, with an `ss -tlnp` check; the port-publishing page does not spell out the firewall consequence · fetched 2026-10-13 (*read*)
- **Our delta:** `mongosh` and `redis-cli` equivalents, and not publishing database ports in production.
