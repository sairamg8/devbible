---
title: "Part 3 — Running a real stack"
sidebar_label: "3 · Running a real stack"
sidebar_position: 3
---

> Phases 6–9 · Storage, networking, Compose, the MERN/PERN stack

One container is a demo. A stack is an API, a database, a cache, a proxy and a
frontend that all have to find each other, keep their data, and come up in an
order that works. This is the part you use every day.

---

## Phase 6 — Storage: volumes, mounts and data

The writable layer is not storage. Everything in this phase follows from that.

| Topic | Tier |
|---|---|
| **The container filesystem is disposable** — `docker rm` deletes it, and that is the design, not a bug | <span className="db-tier t-master">Master</span> |
| **Named volumes vs bind mounts vs tmpfs** — managed by the engine, mapped from the host, or held in RAM; and which one each job wants | <span className="db-tier t-master">Master</span> |
| **`-v` short syntax vs `--mount`** — the short form creates a directory when you typo a path; `--mount` errors. Prefer `--mount` | <span className="db-tier t-understand">Understand</span> |
| **Bind mounts in development** — source on the host, live edits inside; and the **`node_modules` trap** where the host directory shadows the image's | <span className="db-tier t-master">Master</span> |
| **File ownership and UID mismatch** — the single most common rootless problem: files written by the container are owned by a UID that does not exist on the host | <span className="db-tier t-master">Master</span> |
| **Volume lifecycle** — `volume create` / `ls` / `inspect` / `rm` / `prune`, anonymous volumes, and how they accumulate silently | <span className="db-tier t-understand">Understand</span> |
| **SELinux `:z` and `:Z`** — the two-character fix for "permission denied" on Fedora, RHEL and CentOS bind mounts, and the difference between shared and private labels | <span className="db-tier t-understand">Understand</span> |
| **`--read-only` root filesystem** plus `tmpfs` for `/tmp` — the production posture, and what breaks first when you turn it on | <span className="db-tier t-know">Know</span> |
| **`--userns=keep-id`** (Podman) — make the container's user *be* your host user, so bind-mounted files have sane ownership | <span className="db-tier t-understand">Understand</span> |
| **Backing up and restoring a volume** — the tar-through-a-throwaway-container idiom, and doing it for a database *correctly* | <span className="db-tier t-understand">Understand</span> |
| Volume drivers and network storage — when the local driver is not enough | <span className="db-tier t-know">Know</span> |
| Bind-mount performance on macOS and Windows vs native Linux, and what VirtioFS changed | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why your database survived
`docker compose down` but not `docker compose down -v`, and why a file your
container created is owned by `165536` on the host.

---

## Phase 7 — Networking

The layer where "it can't connect" gets solved. Almost every such bug is one of
four things, and this phase names all four.

| Topic | Tier |
|---|---|
| **The default bridge vs a user-defined bridge** — only user-defined networks give you DNS by container name. This is why Compose works and `docker run` alone does not | <span className="db-tier t-master">Master</span> |
| **Service discovery** — containers on the same user-defined network reach each other by name, on the *container* port, with no published port at all | <span className="db-tier t-master">Master</span> |
| **`localhost` inside a container is the container** — the number-one connection bug, and why `DB_HOST=localhost` fails but `DB_HOST=postgres` works | <span className="db-tier t-master">Master</span> |
| **Publishing ports** — `-p`, the host interface you bind to, and the firewall rules the engine writes on your behalf | <span className="db-tier t-understand">Understand</span> |
| **Network drivers**: `bridge`, `host`, `none`, `macvlan`, `ipvlan`, `overlay` — what each is for in one sentence | <span className="db-tier t-know">Know</span> |
| **`network create` / `ls` / `inspect` / `connect` / `disconnect`**, and attaching a running container to a second network | <span className="db-tier t-understand">Understand</span> |
| **Reaching the host from inside** — `host.docker.internal`, `host.containers.internal`, and the Linux caveat | <span className="db-tier t-understand">Understand</span> |
| **Rootless networking** — `pasta` (and previously `slirp4netns`), why source IPs look wrong in your logs, and the performance difference | <span className="db-tier t-understand">Understand</span> |
| **Privileged ports rootless** — why binding 80 fails as a user, and `net.ipv4.ip_unprivileged_port_start` | <span className="db-tier t-understand">Understand</span> |
| **`--network=host`** — no isolation, no port mapping, native performance; when that trade is right | <span className="db-tier t-know">Know</span> |
| **Debugging the network** — `netshoot`, `nsenter`, `podman unshare`, and checking DNS from *inside* the container rather than guessing | <span className="db-tier t-understand">Understand</span> |
| **Podman's stack**: `netavark` and `aardvark-dns` replacing CNI — what changed and what error messages come from where | <span className="db-tier t-understand">Understand</span> |
| Custom subnets, IPv6, and the address clash with your corporate VPN | <span className="db-tier t-know">Know</span> |
| Overlay networks and multi-host container networking | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** given "the API cannot reach the database", you can find
the cause in under two minutes with `inspect`, a DNS lookup from inside the
container, and a port check — without editing any YAML.

---

## Phase 8 — Compose

One file, many services, one lifecycle. Compose is where all the primitives from
Phases 6 and 7 turn into something you can hand to a teammate.

| Topic | Tier |
|---|---|
| **What Compose is** — a declarative description of a set of containers, networks and volumes, plus a CLI that reconciles reality to it | <span className="db-tier t-understand">Understand</span> |
| **`compose.yaml` and the Compose Specification** — the modern filename, and that a top-level `version:` key is **obsolete** and should be deleted | <span className="db-tier t-master">Master</span> |
| **`up` / `down` / `-d` / `--build`** — and that `down -v` is the command that deletes your development database | <span className="db-tier t-master">Master</span> |
| **The `services` block** — `image` vs `build`, `command`, `environment`, `ports`, `volumes`, `restart` | <span className="db-tier t-master">Master</span> |
| **`depends_on` with `condition: service_healthy`** — plain `depends_on` waits for *started*, not *ready*, which is why your API still crashes on boot | <span className="db-tier t-master">Master</span> |
| **Healthchecks in Compose** — `test`, `interval`, `retries`, `start_period`; writing one for Postgres, Mongo and Redis that is actually true | <span className="db-tier t-master">Master</span> |
| **Networks in Compose** — the implicit default network, service-name DNS, and defining extra networks to segment a stack | <span className="db-tier t-understand">Understand</span> |
| **Volumes in Compose** — named volumes for data, bind mounts for source, and the anonymous-volume trick for `node_modules` | <span className="db-tier t-master">Master</span> |
| **The project name** — how it namespaces containers, networks and volumes, `-p` / `COMPOSE_PROJECT_NAME`, and why two checkouts collide without it | <span className="db-tier t-understand">Understand</span> |
| **Environment and interpolation** — `environment` vs `env_file` vs the `.env` file next to the compose file; the precedence order, and that they are three different mechanisms | <span className="db-tier t-understand">Understand</span> |
| **Override files** — `compose.override.yaml` by default, `-f a.yaml -f b.yaml` stacking, and how the merge rules treat lists vs maps | <span className="db-tier t-understand">Understand</span> |
| **`profiles`** — optional services that only start when asked | <span className="db-tier t-know">Know</span> |
| **`develop.watch`** — `sync`, `rebuild`, `sync+restart`: file watching without bind-mount ownership pain | <span className="db-tier t-know">Know</span> |
| **Day-to-day commands** — `logs -f`, `exec`, `run --rm`, `ps`, `top`, and `config` to see the file *after* interpolation | <span className="db-tier t-understand">Understand</span> |
| **`podman compose` and `podman-compose`** — what Podman does with a Compose file, which one you actually get, and where behaviour diverges | <span className="db-tier t-understand">Understand</span> |
| `include` and `extends` — splitting a large stack without copy-paste | <span className="db-tier t-know">Know</span> |
| `--scale`, and the honest limits of Compose as a scaling tool | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a `compose.yaml` that brings up an API, Postgres and
Redis, where the API genuinely waits for a *ready* database, and a teammate can
run it with one command on a clean machine.

---

## Phase 9 — The MERN/PERN stack in containers

Everything so far, applied to the actual stack this bible is about.

| Topic | Tier |
|---|---|
| **Containerising a Node/Express API** — the Dockerfile that is small, cached, non-root and shuts down cleanly | <span className="db-tier t-master">Master</span> |
| **Dev image vs prod image** — one Dockerfile, two targets; what dev needs that prod must not have | <span className="db-tier t-understand">Understand</span> |
| **PostgreSQL in a container** — the data volume, `POSTGRES_*` variables, `/docker-entrypoint-initdb.d`, and why init scripts run only on an empty volume | <span className="db-tier t-master">Master</span> |
| **Waiting for the database** — healthchecks plus retry-with-backoff in the application; why the app must survive the database restarting anyway | <span className="db-tier t-master">Master</span> |
| **Hot reload inside a container** — bind mount plus a watcher, the `node_modules` shadowing fix, and file-watching that works across the mount | <span className="db-tier t-master">Master</span> |
| **Secrets in dev vs prod** — `.env` is convenience, not a secret store; what changes when the same image reaches production | <span className="db-tier t-understand">Understand</span> |
| **The whole stack in one file** — a worked `compose.yaml`: API, Postgres, Redis, frontend, proxy, with healthchecks and named volumes | <span className="db-tier t-master">Master</span> |
| **MongoDB in a container** — the data volume, and the replica-set requirement if you want transactions or change streams | <span className="db-tier t-understand">Understand</span> |
| **Redis in a container** — RDB vs AOF persistence, and whether your cache should persist at all | <span className="db-tier t-know">Know</span> |
| **Migrations and seeds** — a one-shot service or `compose run --rm`, and keeping them out of the API's startup path | <span className="db-tier t-understand">Understand</span> |
| **Debugging Node inside a container** — `--inspect=0.0.0.0:9229`, publishing the port, attaching from the host, and source maps | <span className="db-tier t-understand">Understand</span> |
| **A React/Vite frontend** — the dev-server container versus a static build served by Nginx, and why the API URL is a build-time problem | <span className="db-tier t-understand">Understand</span> |
| **Nginx in front of the API** — reverse proxy, one origin, no CORS, and where TLS terminates | <span className="db-tier t-understand">Understand</span> |
| **Connecting from the host** — `psql`, `mongosh`, `redis-cli` against a published port, and why you should not publish them in production | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** clone the project on a machine with nothing installed but
an engine, run one command, and have a working application with a seeded
database — and be able to explain every line of the file that made it happen.

---

← Prev: [Part 2 — Building images](02-building-images.md) · Index: [Docker & Podman](../README.md) · Next → [Part 4 — Production and depth](04-production-and-depth.md)
