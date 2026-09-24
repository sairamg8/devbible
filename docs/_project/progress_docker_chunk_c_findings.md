---
name: devbible-docker-chunk-c-findings
description: Docker chunk C (phases 8 Compose + 9 MERN/PERN) — the verified per-page claims and fixed filenames. Open only when WRITING in phase 8 or 9; the cursor and handoff stay in the parent.
metadata:
  type: progress
---

Split out of [[devbible-docker-split-4way]] on 2026-08-15 because the parent hit **828 lines**
against the 300-line memory cap ([[devbible-memory-file-cap]]). **The parent keeps the cursor,
the handoff and the rules; this file keeps the evidence.** Open it only when you are about to
write in phase 8 or phase 9 — every claim below is quoted from primary documentation and must
not be re-derived or contradicted.

### Chunk C · phase 9, filenames fixed in advance

🔴 **Fix them now so cross-links written today resolve as the phase fills.** Do not rename:
`01-node-api-dockerfile/` (written), `02-dev-vs-prod-image.md`, `03-postgres-in-a-container`,
`04-waiting-for-the-database`, `05-hot-reload`, `06-secrets-dev-vs-prod.md`,
`07-the-whole-stack` (**written — SEVEN chunks:** `01-the-file.md` · `02-the-anchor.md` ·
`03-the-wiring.md` · `04-the-stateful-services.md` · `05-the-api-and-the-frontend.md` ·
`06-the-proxy.md` · `07-the-boot-and-proving-it.md`),
`08-mongodb-in-a-container/` (**a DIRECTORY, not the reserved `.md`** — `01-running-one.md` ·
`02-the-replica-set.md`; inbound links repointed to `08-mongodb-in-a-container/README.md`),
`09-redis-in-a-container.md`,
`10-migrations-and-seeds.md`, `11-debugging-node.md`, `12-react-vite-frontend.md`,
`13-nginx-in-front.md`, `14-connecting-from-the-host.md`. 🏁 **ALL FOURTEEN ARE WRITTEN —
phase 9 closed 2026-08-15.** The Master rows that became chunk directories: **01** (3 files),
**03** (3), **04** (3), **05** (3), **07** (7 — the phase deliverable).

🔴 **Verified facts for phase 9 topic 14 (`docker compose exec`).** *"Execute a command in a
running container"*, *"the equivalent of `docker exec` targeting a Compose service"*.
🔴 **It allocates a TTY BY DEFAULT** — *"Commands allocate a TTY by default, so you can use a
command such as `docker compose exec web sh` to get an interactive prompt"* — unlike `docker
exec`; `-T`/`--no-tty` disables it and `--interactive=false` is documented for *"when `docker
compose exec` command is used inside a script"*. `--index` = *"Index of the container if service
has multiple replicas"*; `--user` = *"Run the command as this user"*; `--workdir` = *"Path to
workdir directory for this command"*; `--env` = *"Set environment variables"*. ⚠️ **The
reference page says nothing about exit codes** — do not assert one.

🔴 **Verified facts from phase 9 topic 01 — reuse, do not re-derive.**
**`npm ci`:** *"must have an existing `package-lock.json` or `npm-shrinkwrap.json`"*; on a
mismatch it *"will exit with an error, instead of updating the package lock"*; an existing
`node_modules` is *"automatically removed"*; it *"never write[s] to `package.json` or any of
the package-locks: installs are essentially frozen"*; and it *"can only install entire
projects at a time"*. `--omit=dev` is the current flag — ⚠️ the npm docs do **not** call
`--production` deprecated, only less preferred, so do not claim deprecation.
**Docker's own Node guide** uses `RUN --mount=type=cache,target=/root/.npm` ("to speed up
subsequent builds") plus `--mount=type=bind,source=package.json,…` (avoids "having to copy it
into this layer"), `COPY --chown=node:node` on the production stage, and **`CMD ["node",
"dist/index.js"]` in production versus `npm run dev` in the dev stage**. ⚠️ **The guide now
bases its examples on Docker Hardened Images (`dhi.io/node:24-alpine…`)** — worth mentioning,
not worth rewriting the track's `-slim` recommendation around.
**THREE stages, not two**, is this track's own argument: the stage that compiles must install
dev dependencies, so a separate `deps` stage running `npm ci --omit=dev` is the only way the
shipped `node_modules` never saw the toolchain.

🔴 **Verified facts from phase 9 topic 03 (the `postgres` image) — the highest-value block in
the phase so far. Reuse verbatim; do NOT re-derive.**
- 🔴 **THE PATH MOVED IN POSTGRES 18.** The image's own Dockerfile: `ENV PGDATA
  /var/lib/postgresql/18/docker` and `VOLUME /var/lib/postgresql`, with the comment *"in 18+,
  PGDATA has changed to match the pg_ctlcluster standard directory structure, and the VOLUME
  has moved from /var/lib/postgresql/data to /var/lib/postgresql"*. The Hub docs warn that
  mounts at the old path **"WILL NOT PERSIST database data"**. ⚠️ Phase 8's example pages use
  `image: postgres:18` — and **four of them DID mount `/var/lib/postgresql/data`. Fixed
  2026-08-15 in `f9f11d3f`** (01-what-compose-is ×2, 08-volumes ×2, 04-services-block ×2),
  with the reason recorded inline on `08-volumes.md`. ⚠️ **Phase 6 and phase 3 also use that
  path but pair it with `postgres:17`, where it is correct** — do not "fix" those, and do not
  touch them anyway: they belong to other chunks.
- **`STOPSIGNAL SIGINT`** is in the image, with the comment *"which corresponds to what
  PostgreSQL calls 'Fast Shutdown mode' wherein new connections are disallowed and any
  in-progress transactions are aborted, allowing PostgreSQL to stop cleanly and flush tables
  to disk."* Default `SIGTERM` = **smart** shutdown = waits for clients → never override
  `stop_signal` on this service. `ENTRYPOINT ["docker-entrypoint.sh"]`, `CMD ["postgres"]`,
  `EXPOSE 5432` — so a Compose `command:` must repeat `postgres` as element 0.
- 🔴 **Everything `POSTGRES_*` is ONCE-ONLY:** *"The Docker specific variables will only have
  an effect if you start the container with a data directory that is empty."* Same rule for
  `/docker-entrypoint-initdb.d`, whose scripts run *"in sorted name order as defined by the
  current locale"*, as the `postgres` user, `.sql`/`.sql.gz`/`.sh`. `POSTGRES_PASSWORD`
  *"must not be empty or undefined"*. `POSTGRES_HOST_AUTH_METHOD` defaults to
  **scram-sha-256** on 14+, and *"it is not recommended to use `trust`"*.
- **The socket-only window:** during init *"the temporary daemon listens only on the Unix
  socket"* — hence `pg_isready -h 127.0.0.1` in the healthcheck, and no `-h` inside init
  scripts.
- **Arbitrary `--user`:** postgres accepts any UID owning `PGDATA`, but **`initdb` requires
  the user to exist in `/etc/passwd`**, so `user: "1000:1000"` fails on first run;
  `nss_wrapper` or an existing account are the documented ways round it.

🔴 **Verified facts from phase 9 topic 04 (node-postgres `Pool`) — the crash nobody expects.**
Defaults: **`max` 10**, **`idleTimeoutMillis` 10000**, and 🔴 **`connectionTimeoutMillis` 0,
which means NO timeout** — always set it in a container. The load-bearing quote: when the
database goes away *"all the idle, connected clients in your application will emit an error
through the pool's error event emitter"*, and *"if a pool emits an `error` event and no
listeners are added node will emit an uncaught error and potentially crash your node
process."* So **`pool.on('error', …)` is three lines that prevent a database restart taking
the API down** — and the handler must NOT `process.exit()`. The page's thesis: do the
application half FIRST (error listener → connection timeout → jittered capped backoff →
split `/healthz` liveness from `/readyz` readiness), and `depends_on: service_healthy`
becomes a nicety rather than a correctness mechanism.

🔴 **Verified facts from phase 9 topic 05 (Vite server options) — the browser half.**
**`server.host` defaults to `'localhost'`**; the docs say *"Specify which IP addresses the
server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses"* — in a
container `localhost` = that container, so the published port hits nothing. **`server.port`
5173, `strictPort` false** — *"if the port is already being used, Vite will automatically try
the next available port so this may not be the actual port the server ends up listening on"*,
which silently breaks a fixed compose mapping → set `strictPort: true`. **`server.watch`
passes options to chokidar**; for WSL2 with Windows-side files watching *"fails when Windows
applications edit files"*, and the fallback is `{ usePolling: true }` which *"significantly
increases CPU usage"*; *"Network filesystem limitations also apply similarly"*.
⚠️ **The old `hmr.protocol/host/port/clientPort` options are DEPRECATED and consolidated into
`server.ws`** — the page says so and tells the reader to check their own Vite's docs rather
than quoting a spelling that may not match. ⚠️ Do **not** assert nodemon's polling flag name
(`--legacy-watch` / `CHOKIDAR_USEPOLLING`) as verified — it was not checked against nodemon's
own docs, and the page words it as "check your watcher's documentation".

🔴 **Verified facts from phase 9 topic 06 (Compose secrets).** *"Secrets are mounted as a file
in `/run/secrets/<secret_name>` inside the container."* Two sources — **`file:`** and
**`environment:`**. A service gets only the secrets it lists: *"granular access control within
a service container via standard filesystem permissions"*. ⚠️ *"Secrets are supported on Linux
containers only"* (delivery is a single-file bind mount; Windows containers bind-mount
directories only). The env-var warning, quotable: they are *"often available to all
processes"* and *"can be printed in logs when debugging errors without your knowledge"*.
🔴 **Compose `secrets:` works with a plain `docker compose up` — `docker secret` is the
Swarm-only one**, and confusing the two is the "you need Swarm for secrets" folklore. Podman's
`--secret` defaults to `type=mount` at the same `/run/secrets/<name>` path with **mode 0444,
world-readable inside the container**. The page's reusable device is the **`_FILE` convention**
(an env var naming a path, with fallback), which is what lets ONE image take `environment:` in
dev and `secrets:` in prod with no code change.

🔴 **Verified facts fetched 2026-08-15 for phase 9 topic 07 — reuse, do NOT re-fetch.**
- **`postgres` image `_FILE`:** *"`_FILE` may be appended to some of the previously listed
  environment variables, causing the initialization script to load the values for those
  variables from files present in the container"* — works for `POSTGRES_PASSWORD`,
  `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_INITDB_ARGS`. ⚠️ **node-postgres has NO `_FILE`
  support**, so the API half is the topic-06 helper in application code.
- **`redis` image:** *"If persistence is enabled, data is stored in the `VOLUME /data`"*; the
  docs' own example is `--save 60 1`; a custom conf goes at
  `/usr/local/etc/redis/redis.conf` and *"the mapped directory should be writable"*;
  `redis-cli` IS in the image (the docs' "Connecting via `redis-cli`" example runs
  `docker run … redis redis-cli -h some-redis`). ⚠️ The Hub page does **not** spell out the
  appendonly defaults — do not assert them; that is topic 09's job against redis.io.
- 🔴 **Redis `PING` is a READINESS check, quotable:** *"Verifying the server's ability to serve
  data - an error is returned when this isn't the case (for example, during load from
  persistence data or accessing a stale replica)"*. Returns `PONG`.
- **`nginx` image Dockerfile (verbatim):** `ENTRYPOINT ["/docker-entrypoint.sh"]`, `EXPOSE 80`,
  🔴 **`STOPSIGNAL SIGQUIT`**, `CMD ["nginx", "-g", "daemon off;"]`, and it copies
  `10-listen-on-ipv6-by-default.sh`, `15-local-resolvers.envsh`,
  `20-envsubst-on-templates.sh`, `30-tune-worker-processes.sh` into `/docker-entrypoint.d`.
  nginx.org's signals table: **QUIT = graceful shutdown, TERM/INT = fast shutdown**, HUP =
  reload. So the image's `STOPSIGNAL` is already the graceful one — do not override it.
- **The envsubst templating, mechanically** (from `20-envsubst-on-templates.sh`): templates at
  `/etc/nginx/templates/*.template` → `envsubst` → `/etc/nginx/conf.d/`. Env vars:
  `NGINX_ENVSUBST_TEMPLATE_DIR`, `_SUFFIX` (`.template`), `_OUTPUT_DIR` (`/etc/nginx/conf.d`),
  `NGINX_ENVSUBST_FILTER` (empty). 🔴 **The script builds an EXPLICIT shell-format list**
  (`printf '${%s} ' …` over `ENVIRON`, filtered by the regex), so only variables **present in
  the container's environment** are substituted — nginx's own `$host`/`$scheme` survive unless
  an env var of that exact name exists. `NGINX_ENVSUBST_FILTER` is the documented narrowing.
  ⚠️ **The output dir must be WRITABLE** — the script logs *"ERROR: … is not writable"* and
  gives up, which is what bites `read_only: true`. Hub also: *"If you add a custom `CMD` in the
  Dockerfile, be sure to include `-g daemon off;`"*, static root `/usr/share/nginx/html`.
- **nginx `proxy_pass` + DNS:** the docs say *"Parameter value can contain variables. In this
  case, if an address is specified as a domain name, the name is searched among the described
  server groups, and, if not found, is determined using a `resolver`"*. ⚠️ **The docs do NOT
  state when a LITERAL name is re-resolved** — do not claim "nginx caches DNS forever" or a
  cache duration; say only that the resolver is consulted for the variable form. `resolver`
  takes `valid=time` (default: the answer's TTL) and `ipv6=off`.
- **Docker's embedded DNS:** *"The embedded DNS server address is `127.0.0.11`"*, containers on
  a custom network *"use Docker's embedded DNS server"*, and there is **no IPv6 equivalent**
  though the IPv4 address works in IPv6-only containers.

🔴 **Verified facts fetched 2026-08-15 for phase 9 topic 08 (MongoDB) — reuse, do NOT re-fetch.**
- **`mongo` image Dockerfile:** `VOLUME /data/db /data/configdb`, `ENTRYPOINT
  ["docker-entrypoint.sh"]`, `CMD ["mongod"]`, `EXPOSE 27017`; user `mongodb` at **uid/gid 999**
  with home `/data/db`; ⚠️ **no `STOPSIGNAL` and no `USER` instruction**. `/data/configdb` is
  only for `--configsvr`.
- 🔴 **`MONGO_INITDB_ROOT_USERNAME`/`_PASSWORD`:** *"Both variables are required for a user to
  be created. If both are present then MongoDB will start with authentication enabled (`mongod
  --auth`)"* — so **auth is a side effect of creating the user**, and setting only one silently
  does nothing. *"none of the variables below will have any effect if you start the container
  with a data directory that already contains a database"* (same rule as postgres).
- **`_FILE` on the mongo image is NARROWER than postgres's:** *"Currently, this is only
  supported for `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`."*
- **initdb.d:** *"When a container is started for the first time it will execute files with
  extensions `.sh` and `.js` that are found in `/docker-entrypoint-initdb.d`. Files will be
  executed in alphabetical order"*; `.js` runs under **`mongosh`** (*"`mongo` on versions below
  6"*) against `MONGO_INITDB_DATABASE` *"or `test` otherwise"*. ⚠️ **`MONGO_INITDB_DATABASE`
  does NOT create a database** — *"MongoDB is fundamentally designed for 'create on first use',
  so if you do not insert data with your JavaScript files, then no database is created."*
- 🔴 **Transactions and change streams BOTH need a replica set.** Transactions: *"MongoDB
  supports distributed transactions, including transactions on replica sets and sharded
  clusters"*, FCV ≥ **4.0** (replica set) / **4.2** (sharded). Change streams: *"Change streams
  are available for replica sets and sharded clusters"*, **WiredTiger** + protocol **`pv1`**;
  majority read concern may be enabled or disabled. ⚠️ **Neither page describes standalone
  support** — state it that way, do not write "standalone is unsupported" as a quote.
- **`rs.initiate()`** *"initiates a replica set"*; with no argument *"MongoDB uses a default
  replica set configuration"* (names the member by the machine hostname — wrong inside a
  container), run on **only one** mongod, and the manual says *"use DNS hostnames instead of IP
  addresses"*. Explicit dev form: `rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})`.
- 🔴 **`--keyFile` implies client access control:** *"Running mongod with the `--keyFile`
  command-line option or the `security.keyFile` configuration file setting enforces both
  Self-Managed Internal/Membership Authentication and Role-Based Access Control"*. Keyfile:
  *"A key's length must be between 6 and 1024 characters and may only contain characters in the
  base64 set"*, and *"on UNIX systems, the keyfile must not have group or world permissions"* —
  `chmod 400`, owned by the mongod user. ⚠️ **This is why a bind-mounted keyfile fails** and a
  Compose secret with explicit `mode:`/`uid:` is the container answer.
- **`ping`:** *"a no-op used to test whether a server is responding to commands"*, *"will return
  immediately even if the server is write-locked"*. ⚠️ **Its reference page does NOT state
  whether it requires authentication** — the page says so rather than claiming exemption.

🔴 **Verified facts fetched 2026-08-15 for phase 9 topic 09 (Redis) — reuse, do NOT re-fetch.**
- **RDB:** *"performs point-in-time snapshots of your dataset at specified intervals"*;
  `save 60 1000` = *"automatically dump the dataset to disk every 60 seconds if at least 1000
  keys changed"*, into `dump.rdb`; *"the only work the Redis parent process needs to do in order
  to persist is forking a child"*; ⚠️ *"you should be prepared to lose the latest minutes of
  data"*.
- **AOF `appendfsync`, all three quoted:** `always` = *"fsync every time new commands are
  appended to the AOF. Very very slow, very safe"*; `everysec` = *"fsync every second. Fast
  enough … and you may lose 1 second of data if there is a disaster"* and is *"the suggested
  (and default) policy"*; `no` = *"Never fsync, just put your data in the hands of the Operating
  System"*.
- 🔴 **Both enabled → AOF wins on restart:** *"the AOF file will be used to reconstruct the
  original dataset since it is guaranteed to be the most complete."* Docs recommend both if you
  want *"a degree of data safety comparable to what PostgreSQL can provide you"*, and
  **discourage AOF alone**.
- 🔴 **Since Redis 7.0 the AOF is a DIRECTORY** — base file + incremental files + a manifest,
  in the directory named by `appenddirname`. Backup scripts written for a single
  `appendonly.aof` silently break. Backing it up requires disabling auto-rewrite first
  (`CONFIG SET auto-aof-rewrite-percentage 0`) or you *"might end up with an invalid backup"*.
- 🔴 **Switching RDB → AOF is a PROCEDURE:** *"not following this procedure (e.g. just changing
  the config and restarting the server) can result in data loss!"* — `CONFIG SET appendonly
  yes` on the live server, then persist the config.
- 🔴 **The container-specific one — `maxmemory` defaults to ZERO on 64-bit:** *"Set maxmemory
  to zero to specify that you don't want to limit the memory for the dataset. This is the
  default behavior for 64-bit systems, while 32-bit systems use an implicit memory limit of
  3GB."* So an unconfigured Redis in a memory-limited container is OOM-killed (exit 137) rather
  than evicting. ⚠️ Buffers for replication/persistence are *"not included in the total that is
  compared to maxmemory"*, so leave headroom.
- **`maxmemory-policy`:** `noeviction` = *"Keys are not evicted but the server will return an
  error when you try to execute commands that cache new data"*; `allkeys-lru` is the docs' rule
  of thumb, *"a good default option if you have no reason to prefer any others"*; ⚠️ the
  `volatile-*` policies *"behave like `noeviction` if no keys have an associated expiration"*.
  ⚠️ **The eviction page does NOT state a default for `maxmemory-policy`** — do not assert one.
  Mixed cache+persistent keys: *"you should consider running two separate Redis instances"*.
- **Custom config path** is `/usr/local/etc/redis/redis.conf`, and *"the mapped directory should
  be writable, as depending on the configuration and mode of operation, Redis may need to create
  additional configuration files or rewrite existing ones"*.

🔴 **Verified facts for phase 9 topic 10 (`docker compose run`) — reuse, do NOT re-fetch.**
*"Runs a one-time command against a service"*, starting *"in new containers with configuration
defined by that of the service"*, and **"the command passed by `run` overrides the command
defined in the service configuration"**. 🔴 **Ports are NOT published:** *"the `docker compose
run` command does not create any of the ports specified in the service configuration"* —
`--service-ports` opts back in. **`--rm`** removes *"the container after running while
overriding the container's restart policy"*. Dependencies DO start — with links it *"first
checks to see if the linked service is running and starts the service if it is stopped"* — and
**`--no-deps`** turns that off. ⚠️ **The reference page says nothing about exit codes** — do not
assert one.
| **D** | 10 | 🏁 **16/16 DONE** | ▶ **RESUMED 2026-08-15** (*"docker and podman pick d"*). 🏁 **PHASE 10 CLOSED 2026-08-15 — 16/16, 29 files, 5,645 lines, 0 over cap, link-checked (not built).** Next phase is 11 · 01 Daemonless; **Master tier DONE 5/5**; ⚠️ **10 is a CHUNKED DIRECTORY** `10-hardening/` (545 lines: 01 the-four-switches 240 · 02 enforcing-it 236 · README 69) — the first draft hit 348 and was split on a concept boundary, not trimmed | 🔴 session `6d88f249` (2026-08-15, took over from `2f38bb4d`) |
| **D** | 11 | 0/16 | 🔴 **01 · Daemonless** (Master) — **PHASE 10 IS CLOSED, this is the live cursor** | 🔴 session `6d88f249` (2026-08-15) |
| **D** | 12 | 0/12 | **01 · Tag strategy** (Master) — after phase 11 closes | 🔴 session `6d88f249` (2026-08-15) |

### Chunk C · phase 8, file by file

🔴 **The filenames are fixed in advance**, so cross-links inside the phase are written once
and resolve as the phase fills. Do not rename them: `01-what-compose-is.md`,
`02-compose-yaml-and-the-spec/`, `03-up-and-down/`, `04-services-block/`,
`05-depends-on.md`, `06-healthchecks/`, `07-networks.md`, `08-volumes.md`,
`09-project-name.md`, `10-environment-and-interpolation.md`, `11-override-files.md`,
`12-profiles.md`, `13-develop-watch.md`, `14-day-to-day-commands.md`,
`15-podman-compose.md`, `16-include-and-extends.md`, `17-scale-and-limits.md`.

| Topic | Files | Lines | Sources named on the page |
|---|---|---|---|
| ✅ **01 · What Compose is** (Understand) | `01-what-compose-is.md` | 286 | Compose overview, the Compose application model, version-and-name, the `docker compose` CLI reference, `podman-compose(1)`, the Compose v5.4.0 release |
| ✅ **02 · `compose.yaml` and the Spec** (Master) | `02-compose-yaml-and-the-spec/` — README + 2 chunks | 54 / 190 / 229 | Compose file reference, version-and-name, application model, services, fragments, extensions, CLI reference |
| ✅ **03 · `up`, `down` and the lifecycle** (Master) | `03-up-and-down/` — README + 2 chunks | 54 / 248 / 201 | `docker compose up`, `docker compose down`, `docker compose stop`, `docker compose restart`, CLI reference |
| ✅ **04 · The `services` block** (Master) | `04-services-block/` — README + 2 chunks | 58 / 240 / 259 | the `services` top-level element (restart, command, entrypoint, env_file, pull_policy, ports, volumes), the `build` section |
| ✅ **05 · `depends_on` with `condition: service_healthy`** (Master) | `05-depends-on.md` | 271 | the `depends_on` attribute (short/long syntax, the three conditions, `restart`, `required`), `docker compose up` |
| ✅ **06 · Healthchecks in Compose** (Master) | `06-healthchecks/` — README + 2 chunks | 51 / 225 / 242 | the `healthcheck` attribute, the Dockerfile `HEALTHCHECK` reference, the official `postgres` image docs, the MongoDB Shell docs |
| ✅ **07 · Networks in Compose** (Understand) | `07-networks.md` | 253 | Compose networking how-to, the top-level `networks` element, the `services` element |
| ✅ **08 · Volumes in Compose** (Master) | `08-volumes.md` | 254 | the top-level `volumes` element, the `services` element, `docker compose down` |
| ✅ **09 · The project name** (Understand) | `09-project-name.md` | 198 | Specify a project name, version-and-name, the application model, the CLI reference |
| ✅ **10 · Environment and interpolation** (Understand) | `10-environment-and-interpolation.md` | 225 | Interpolation reference, environment-variables precedence, the `services` element, the CLI reference |
| ✅ **11 · Override files** (Understand) | `11-override-files.md` | 237 | Merge Compose files how-to, the Compose file merge reference (`!reset`/`!override`), the CLI reference |
| ✅ **12 · `profiles`** (Know) | `12-profiles.md` | 189 | Use service profiles how-to, the `services` element, the CLI reference |
| ✅ **13 · `develop.watch`** (Know) | `13-develop-watch.md` | 270 | Use Compose Watch how-to, the `develop` element reference, `docker compose watch` CLI reference, `podman-compose(1)` |
| ✅ **14 · Day-to-day commands** (Understand) | `14-day-to-day-commands/` — README + 2 chunks | 68 / 189 / 274 | the `docker compose` CLI reference index plus the `ps`, `logs`, `exec`, `run`, `config` and `top` subcommand pages, `podman-compose(1)` |
| ✅ **15 · `podman compose` and `podman-compose`** (Understand) | `15-podman-compose.md` | 227 | `podman-compose(1)`, `containers.conf(5)`, the containers/podman-compose README, the `docker compose` CLI reference, the Compose Specification |
| ✅ **16 · `include` and `extends`** (Know) | `16-include-and-extends.md` | 250 | the `include` top-level element, the `extends` attribute, Merge Compose files, the CLI reference |
| ✅ **17 · `--scale` and the honest limits** (Know) | `17-scale-and-limits.md` | 216 | `docker compose scale`, `docker compose up` (`--scale`), the `services` element (`container_name`, `scale`), the `deploy` element |

🏁 **PHASE 8 CLOSED 2026-08-15.** Two more load-bearing claims from topic 17, both quoted:
🔴 **`container_name` makes scaling impossible** — *"Compose does not scale a service beyond
one container if the Compose file specifies a `container_name`. Attempting to do so results
in an error."* And **`scale` (service level) must be consistent with `deploy.replicas`** when
both are set; `--scale` *"Overrides the `scale` setting in the Compose file if present."*
⚠️ **The port-collision block is NOT quoted anywhere in the docs** — the page states it as
mechanics ("a host port binds once") and says so explicitly rather than implying a source.
`--index` on `logs`/`exec` is how you address one replica of several.

Topic 02 split on the boundary between **the Specification and the file** (schema,
top-level elements, `version:` obsolete, filename resolution and the parent-directory
search) and **the YAML that bites** (port/boolean quoting, fragments, `x-`, `config`).

⚠️ **Mid-phase forward links are expected** — topics 01 and 02 link ahead to
`03-up-and-down.md`, `05-depends-on.md`, `09-project-name.md`,
`10-environment-and-interpolation.md`, `11-override-files.md`, `12-profiles.md`,
`14-day-to-day-commands.md`, `15-podman-compose.md`, `16-include-and-extends.md` and
`17-scale-and-limits.md`. **Not** the rule-1 slug bug; they resolve as the phase fills.

🔴 **Load-bearing claims established in phase 8, all quoted from the docs — do not
contradict them later.**

- **`version:` is obsolete.** Compose "always uses the most recent schema to validate the
  Compose file, regardless of the `version` field" and warns if it is used. Support for a
  key comes from the **binary**, never from a number in the file.
- **`compose.yaml` is canonical** — "if both files exist, Compose prefers the canonical
  `compose.yaml`". With no `-f`, Compose searches the working directory **and its
  parents**, and `--project-directory` is what relative paths resolve against.
- **Compose reconciles, it does not run a script.** `up` on an unchanged stack does
  nothing; after one edit it recreates only that service; after a deletion it removes the
  container. v5.4.0 (3 Aug 2026) is itself a release about reconciling volumes and
  networks.
- **`podman compose` is "a thin wrapper around an external compose provider"**, defaults
  to `docker-compose` over `podman-compose` when both are installed "since it is the
  original implementation", and warns that it shells out. Pin it with
  `PODMAN_COMPOSE_PROVIDER` / `compose_providers`.
- **`x-` is the sole exception where Compose silently ignores unrecognised fields** — so
  every *other* unknown key is an error, which is why a typo is caught.
- **YAML merge applies to mappings only, not sequences** — the reason `environment` is
  written in the `KEY: value` map form throughout this phase.
- **Quote `"8000:8000"`** ("to avoid conflicts with YAML base-60 float") and quote
  boolean-looking environment values ("should be enclosed in quotes to ensure they are not
  converted to True or False").
- **`up` recreates on change and preserves mounted volumes** — the docs' words are that it
  "picks up the changes by stopping and recreating the containers (preserving mounted
  volumes)". Attached, Ctrl-C stops the stack **with exit code 0**.
- **`restart` does NOT apply compose-file changes** — "these changes are not reflected after
  running this command". The pair to memorise: changed the file or the code → `up -d`
  (`--build` if the image must change); want the process bounced → `restart`. Using
  `restart` to apply a change is the commonest Compose mistake and it fails *silently*.
- **`down` keeps volumes and images by default**; `-v` removes "named volumes declared in
  the `volumes` section of the Compose file **and** anonymous volumes attached to
  containers"; `external` networks and volumes "are never removed".
  ⚠️ **The `down` blurb itself is misleading** — it reads "removes containers, networks,
  volumes, and images created by `up`", which is wrong about the defaults. The option table
  is the authority, and the page says so explicitly rather than repeating the blurb.
- **`--wait` "implies detached mode"** and is what makes a CI script honest, because plain
  `up -d` returns when containers are *started*, not ready.
- **Anonymous volumes are reused by a recreated container** — `-V`/`--renew-anon-volumes` is
  the switch that starts them empty, and it is why stale state survives `--force-recreate`.
- 🔴 **A non-null `entrypoint` DISCARDS the image's `CMD`** — "if `entrypoint` is non-null,
  Compose ignores any default command from the image". Override `entrypoint` and you must
  supply `command` too. Same rule as a Dockerfile `ENTRYPOINT` clearing an inherited `CMD`.
- **`image` + `build` together = build it and NAME it that** — "it follows the rules defined
  by the `pull_policy` attribute". `image` is not "pull instead"; it is what makes the built
  image pushable.
- **`pull_policy` has time-based values** — `always`/`never`/`missing`/`build`/`daily`/
  `weekly`/`every_<duration>`. The time-based ones are the sane middle ground given Hub's
  pull limits.
- **`environment` beats `env_file`** — "values set by `environment` have precedence". And
  `env_file` (into the container) is a DIFFERENT mechanism from the project `.env`
  (interpolation in the file); conflating them is the commonest environment bug.
- 🔴 **`ports` binds `0.0.0.0` by default** and the docs say so with a warning: without a
  host IP "Docker binds to all interfaces (`0.0.0.0`), bypassing host firewall rules".
  Also: **ports must not be combined with `network_mode: host`** — runtime error.
- **`restart: "no"` must be quoted** or YAML makes it the boolean `false`. The four values
  are `"no"` / `always` / `on-failure[:n]` / `unless-stopped`; `always` vs `unless-stopped`
  differ only after a manual stop plus a reboot.
- **Short-syntax `volumes` infers named-volume vs bind-mount from the string shape** — the
  long syntax with an explicit `type:` is the Compose equivalent of preferring `--mount`.
- 🔴 **"With short syntax, Compose does not wait for dependency services to be 'healthy'"** —
  the documented sentence the whole `depends_on` page hangs on. Short syntax guarantees
  *creation order, start order and removal order* only. "It works the second time" is the
  field signature.
- **Three conditions:** `service_started` (= short syntax) · `service_healthy` · 
  `service_completed_successfully` (the migration gate — pair it with `restart: "no"` on the
  one-shot job or a completed migration becomes a restart loop). Plus `restart: true`
  (bounce dependents when the dependency updates) and `required: false` (warn, not error).
- 🔴 **`depends_on` is STARTUP-ONLY and has no runtime effect** — the DB restarting at 3am
  re-orders nothing. The correct posture is BOTH `service_healthy` *and* retry-with-backoff
  in the app. Phase 9's "Waiting for the database" is the application half.
- **`depends_on` vs `up --wait` are different questions** — should service B *start* yet,
  versus should the *`up` command* return yet. CI usually wants both.
- **`healthcheck` "operates identically to the `HEALTHCHECK` Dockerfile instruction"**, so it
  inherits its defaults: interval **30s**, timeout **30s**, start_period **0s**, retries
  **3**. The 30s timeout × 3 retries is ~**90 seconds** of a wedged service reporting healthy.
- 🔴 **`start_period` + `start_interval` together remove the usual trade-off** — a generous
  grace window with a 2s check interval *inside* it means readiness is detected within
  seconds without hammering a running service forever. This is the most useful fact on the
  topic and the gap it closes is added directly to every `condition: service_healthy` boot.
- **`test` has four forms:** `NONE` · `CMD` (no shell) · `CMD-SHELL` · a bare string
  (= `CMD-SHELL`). `["CMD", "pg_isready -U postgres"]` — one string with spaces — is the
  classic permanent failure.
- **Disable with `disable: true`, never with `test: ["CMD","true"]`** — the latter *reports
  healthy*, and `condition: service_healthy` acts on the lie.
- 🔴 **The `pg_isready` trap, documented via the postgres image:** "the temporary daemon
  started for these initialization scripts listens only on the Unix socket". So a
  socket-based `pg_isready` can pass during first-run initdb. **Use `-h 127.0.0.1`** to force
  TCP. Also: initdb scripts "are only run if you start the container with a data directory
  that is empty" — the honest reason `down -v` is part of a dev workflow.
- **`mongosh` exits 0 when the shell runs, not when the command succeeds** — pipe through
  `grep -q 1`. ⚠️ Could NOT confirm from primary docs which MongoDB release dropped the
  legacy `mongo` binary; the page says so and tells the reader to check their image tag.
  Do not later assert a version number for this without a source.
- **Healthchecks must not test dependencies** — a DB blip then marks every replica unhealthy
  at once. And prefer the runtime already in the image over installing `curl`.
- **The default network is `<project-name>_default`**, bridge driver; "services without an
  explicit `networks` declaration are connected by Compose to this `default` network", and
  each service is "discoverable by its service name".
- 🔴 **Service-to-service traffic uses the CONTAINER port, not the published one** — "the
  `HOST_PORT` and `CONTAINER_PORT` serve different purposes". `"8001:5432"` means the host
  uses 8001 and the API uses `db:5432`.
- **A recreated container "joins the network under a different IP address but the same
  name"** — the documented reason hardcoding an IP fails on the *second* `up`.
- **`links` "are not required for basic service-to-service communication"** — legacy; use
  network `aliases`.
- **`internal: true`** = "externally isolated" (no outbound route) — the cheap way to make a
  DB unable to phone home. Two networks + the API on both is the standard segmentation.
- **A named volume is declared TWICE** — in the service and under top-level `volumes:`. It is
  project-scoped unless `name:` is set, and "the name is used as is and is not scoped with
  the stack name". `external: true` = lifecycle managed elsewhere, so `down -v` cannot
  delete it — a deliberate guard.
- 🔴 **The `node_modules` shield explained mechanically:** the bind mount of `./` at `/app`
  *hides* the image's `node_modules`; an anonymous volume at `/app/node_modules` layers a
  second mount on top of that one path and is populated from the image because it starts
  empty. ⚠️ It is **sticky** — adding a dependency and rebuilding does nothing until
  `up -d --build -V` or `down -v`. That is the "I installed it and it is not there" report.
- **Project-name precedence:** `-p` > `COMPOSE_PROJECT_NAME` > top-level `name:` > base name
  of the compose file's directory > base name of the cwd. Names must be "only lowercase
  letters, decimal digits, dashes, and underscores, and must begin with a lowercase letter or
  decimal digit". ⚠️ **Project names namespace Compose's resources, NOT host ports** — two
  projects publishing `"3000:3000"` still collide. `docker compose ls` is the
  what-did-I-leave-running command.
- 🔴 **THREE environment mechanisms, and conflating them is the commonest Compose bug:**
  the project `.env` fills `${...}` **in the compose file** (nothing reaches a container);
  `env_file:` and `environment:` fill **the container**. The bare-name list entry
  (`environment: - FOO`) passing the ambient value through is what makes `.env` *look* like
  it feeds containers.
- **Interpolation:** `${VAR:-d}` / `${VAR-d}` / `${VAR:?err}` / `${VAR?err}` / `${VAR:+r}` /
  `${VAR+r}`. **The colon is the whole distinction** — colon = "set and non-empty",
  no colon = "set". `$$` escapes a literal dollar (bcrypt hashes, crontabs, `$` in
  passwords). `${VAR:?err}` is the underused one: fail at `up` instead of an hour later.
- **Precedence into the container, highest first:** `run -e` > interpolated
  `environment`/`env_file` > literal `environment` > `env_file` > the image's `ENV`.
  Short form: CLI beats file, interpolated beats literal, Compose beats the image.
- 🔴 **Merge rules, three categories:** single values **replace**; sequences
  **CONCATENATE** ("`ports`, `expose`, `external_links`, `dns`, `dns_search`, and `tmpfs`");
  mappings **merge by key** (`environment`, `labels`, `volumes`, `devices` — keyed by
  variable/label name or by container mount path). The ports-append surprise is the page's
  headline. Fixes: **`!override`** (replace wholesale) and **`!reset`** (`ports: !reset []`,
  `FOO: !reset null`).
- **Passing ANY `-f` disables the automatic `compose.override.yaml`** — that is what keeps
  production from inheriting dev bind mounts, and it is the "my override stopped applying"
  answer. Files apply left to right.
- **Relative paths in an override resolve against the BASE compose file's directory**, not
  the override's own — "all relative paths … are resolved relative to the base Compose file".
- **Another reason for map-form `environment`:** as a list it is a *sequence*, so it
  concatenates and the variable appears twice.
- **"Services without a `profiles` attribute are always enabled"** — profiles make a service
  opt-in, and there is no other "off by default" switch. Any one of a service's profiles
  enables it.
- **Targeting a profiled service by name enables its profile implicitly**, and starts "only
  the targeted service (and any of its declared dependencies via `depends_on`)".
- ⚠️ **A dependency in a DIFFERENT, un-enabled profile is not pulled in** — it must share the
  profile, be unassigned, or be started separately. **Rule: keep infrastructure unassigned;
  profiles are for leaves.**
- **`down` without the profile leaves those containers behind** as orphans on the next `up`.
- 🔴 **`develop.watch` has FIVE actions, not the three chunk B's phase-6 page lists** —
  `sync` and `rebuild` (Compose **v2.22.0**, when `develop` arrived), `sync+restart`
  (**v2.23.0**), and **`restart` and `sync+exec` (v2.32.0)**. Not a contradiction of phase 6,
  an extension; do not "correct" it back to three.
- **Watch is "designed to work with services built from local source code using the `build`
  attribute" and does NOT track changes for services using `image:`.** Plus two mechanical
  requirements: the image must contain **`stat`, `mkdir` and `rmdir`** (so distroless and
  `scratch` can never be sync targets) and the container user must be able to write `target`
  — the docs' fix is `COPY --chown` at build time, not a run-time `chown`.
- 🔴 **Glob patterns are NOT supported in `path`.** Directories are watched recursively;
  narrow with `include`, and **quote a pattern starting with `*`** or YAML reads it as an
  alias. `ignore` patterns are relative to the rule's own `path` — the single exception to
  "all paths are relative to the project directory" — and `.dockerignore` rules apply on top.
- **Syncing `node_modules/` is explicitly not recommended** (performance, multi-platform
  portability). `docker compose watch` flags are exactly three: `--no-up`, `--prune`
  (default **true**), `--quiet`.
- 🔴 **THREE programs share the Compose name and the space/hyphen matters:** `docker compose`
  (the reference impl), **`podman compose`** = *"a thin wrapper around an external compose
  provider"* which **prefers `docker-compose` when both are installed** *"since it is the
  original implementation … and is widely used on the supported platforms"*, and
  **`podman-compose`** = *"An implementation of Compose Spec with Podman backend"*, a Python
  script that execs `podman` directly. Provider is pinned by `compose_providers` in the
  `[engine]` table of `containers.conf(5)` or `PODMAN_COMPOSE_PROVIDER`; the external-command
  warning is silenced by `compose_warning_logs` / `PODMAN_COMPOSE_WARNING_LOGS`.
- **The wrapper's actual job:** it *"sets up the environment to let the compose provider
  communicate transparently with the local Podman socket"*. ⚠️ The `DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock`
  + `systemctl --user enable --now podman.socket` recipe is **community-documented
  (containers/podman discussion #10644), NOT man-page text** — the page says so inline rather
  than passing it off as primary. And per podman-compose's README, over the socket
  *"you lose the process-model (ex. `docker-compose build` will send a possibly large context
  tarball to the daemon)"*.
- 🔴 **`include` and `extends` resolve relative paths from OPPOSITE places** — the single most
  confusable pair in phase 8. `include`: *"Relative paths in Compose files being referred by
  `include` are resolved relative to their own Compose file path, not based on the local
  project's directory"* (override with `project_directory:`). `extends`'s `file:` is
  *"relative to the location of the main Compose file"*. Stacked `-f` files resolve against
  the BASE file — three mechanisms, three rules.
- **`include` is recursive** and **refuses to merge conflicts** — *"Compose displays a warning
  if resource names conflict and doesn't try to merge them"* — which is exactly what makes it
  scale where stacked `-f` does not. The local project's environment takes precedence.
- 🔴 **`extends` shares configuration, NOT referenced resources** — *"Compose does not
  automatically import these referenced resources into the extended model"*: `volumes`,
  `networks`, `configs`, `secrets`, `links`, `volumes_from`, `depends_on`, and
  `service:{name}` references in `ipc`/`pid`/`network_mode` must be re-declared. Merge is the
  same three categories as override files, but sequences put **referenced items first, main
  after, duplicates removed**. Circular `extends` is an error; chaining iterates until no
  `extends` remains. For reuse *within one file*, YAML anchors + `x-` beat `extends`.
- **The honest trade-off vs a bind mount:** the copy goes ONE way, so anything the container
  generates never reaches your working tree. The docs' own framing is that watch
  *"doesn't replace bind mounts but complements them with greater granularity"*.


🔴 **Verified facts for phase 9 topic 11 (Node inspector) — reuse, do NOT re-fetch.**
Defaults: **`--inspect` / `--inspect-brk` / `--inspect-wait` all default to `127.0.0.1:9229`**;
`--inspect-brk` *"break[s] at start of user script"*, `--inspect-wait` (v22.2.0/v20.15.0)
*"wait[s] for debugger to be attached"*; *"If port `0` is specified, a random available port
will be used"*. 🔴 **The security wording, quotable:** *"Binding the inspector to a public IP
(including `0.0.0.0`) with an open port is insecure, as it allows external hosts to connect to
the inspector and perform a remote code execution attack"*; *"Since the debugger has full access
to the Node.js execution environment, a malicious actor able to connect to this port may be able
to execute arbitrary code on behalf of the Node.js process"*; and the guide's *"We recommend that
you never have the debugger listen on a public IP address. If you need to allow remote debugging
connections we recommend the use of ssh tunnels instead."* The docs' escape condition is *"the
host is not accessible from public networks"* OR *"a firewall disallows unwanted connections on
the port"* — which is why bind-`0.0.0.0`-inside + publish-`127.0.0.1`-outside is defensible.
**`--disable-sigusr1`** (v23.7.0/v22.14.0, non-experimental v24.8.0/v22.20.0) = *"Disable the
ability of starting a debugging session by sending a `SIGUSR1` signal to the process"* — which
is the documentation confirming SIGUSR1 starts one by default. **`--enable-source-maps`**
*"enables caching of Source Maps and makes a best effort to report stack traces relative to the
original source file"*; ⚠️ *"enabling source maps can introduce latency to your application when
`Error.stack` is accessed"* and *"Overriding `Error.prepareStackTrace` may prevent
`--enable-source-maps` from modifying the stack trace"*. **`NODE_OPTIONS`** *"accepts a
space-separated list of command-line options"* that *"appear as if they had been specified on the
command line before any command-line arguments"*, with the command line taking precedence.
⚠️ **`localRoot`/`remoteRoot` were NOT verified against VS Code's own docs** — the page names
them as VS Code's spelling and tells the reader to check their own debugger, same treatment as
nodemon's polling flag on topic 05.

🔴 **Verified facts for phase 9 topic 12 (Vite env) — reuse, do NOT re-fetch.**
`import.meta.env` constants are *"statically replaced at build time"*. Only `VITE_`-prefixed
variables reach client code (`VITE_SOME_KEY=123` yes, `DB_PASSWORD=foobar` no; the prefix is
configurable via `envPrefix`). 🔴 **The quotable warning:** *"`VITE_*` variables should not
contain sensitive information such as API keys."* Built-ins: `MODE`, `PROD`, `DEV`, `BASE_URL`,
`SSR`. `.env` load order: `.env` → `.env.local` (git-ignored) → `.env.[mode]` →
`.env.[mode].local` (git-ignored), mode-specific overriding generic, `*.local` in `.gitignore`.
⚠️ **Vite's `.env` is NOT Compose's `.env`** — unrelated mechanisms, same filename.
⚠️ **Whether Vite reads plain process env vars in addition to `.env` files was NOT verified** —
topic 12 hedges it and relies only on "the value is fixed when the build runs".

🔴 **Verified facts for phase 9 topic 13 (nginx as a reverse proxy) — reuse, do NOT re-fetch.**
**`try_files`** *"Checks the existence of files in the specified order and uses the first found
file for request processing … If none of the files were found, an internal redirect to the `uri`
specified in the last parameter is made"*; the last parameter may instead be `=code` (since
0.7.51), and the docs' own example ends `=404`. SPA fallback = `try_files $uri $uri/ /index.html`.
🔴 **WebSocket proxying:** *"since the 'Upgrade' is a hop-by-hop header, it is not passed from a
client to proxied server"*, so *"these headers have to be passed explicitly"*; nginx tunnels
*"since version 1.3.13"* when the upstream returns **101 Switching Protocols**. ⚠️ **The current
docs show `proxy_http_version 1.1;` COMMENTED with `# before version 1.29.7`** — required only on
older nginx; do not present it as always-needed. 🔴 **The 60-second trap:** *"By default, the
connection will be closed if the proxied server does not transmit any data within 60 seconds"* —
raise `proxy_read_timeout` or send ping frames. The `map $http_upgrade $connection_upgrade` form
is documented but ⚠️ **`map` is `http`-context only**, so it cannot go in a `conf.d/` file (which
is already inside `http`) — the image's template mechanism writes there too.
⚠️ **`app.set('trust proxy', …)` was NOT verified against Express's docs** — topic 13 names it and
defers the framework side to the Express track.
