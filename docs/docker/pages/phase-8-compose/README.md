---
title: "Phase 8 — Compose"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Compose v5.4.0 (3 Aug 2026) · Docker Engine 29.7.2 · Podman 6.1.0.**
> Every page is **documentation-validated** against the Compose Specification, the
> `docker compose` CLI reference and the Podman documentation, with sources named
> per page. **No sandbox** — nothing was run, so no page carries console output.

🚧 **In progress — 6 of 17 topics written.**

One file, many services, one lifecycle. Phases 6 and 7 gave you volumes and
networks as primitives; this phase is where they turn into something a teammate
can run with one command on a clean machine.

The load-bearing set is **02, 03, 04, 05, 06 and 08** — the file format, the
lifecycle commands, the service block, readiness gating, healthchecks that are
actually true, and volumes. Everything else refines those.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Compose is](01-what-compose-is.md)** | <span className="db-tier t-understand">Understand</span> | A declarative file plus a CLI that reconciles reality to it — not a script runner, not an orchestrator |
| 02 | **[`compose.yaml` and the Compose Specification](02-compose-yaml-and-the-spec/README.md)** | <span className="db-tier t-master">Master</span> | One schema, always the newest — `version:` is obsolete; and the YAML that silently mis-parses your ports |
| 03 | **[`up`, `down` and the lifecycle](03-up-and-down/README.md)** | <span className="db-tier t-master">Master</span> | `up` reconciles and recreates; `down -v` is the command that deletes your development database |
| 04 | **[The `services` block](04-services-block/README.md)** | <span className="db-tier t-master">Master</span> | `image` vs `build`, the `entrypoint` that discards your `CMD`, and the port mapping that binds every interface |
| 05 | **[`depends_on` with `condition: service_healthy`](05-depends-on.md)** | <span className="db-tier t-master">Master</span> | Plain `depends_on` waits for *started*, not ready — and it does nothing at all after boot |
| 06 | **[Healthchecks in Compose](06-healthchecks/README.md)** | <span className="db-tier t-master">Master</span> | The defaults are wrong, `start_period` + `start_interval` fix them, and a check that lies is worse than none |
| 07 | Networks in Compose | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 08 | Volumes in Compose | <span className="db-tier t-master">Master</span> | _not written yet_ |
| 09 | The project name | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 10 | Environment and interpolation | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 11 | Override files | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 12 | `profiles` | <span className="db-tier t-know">Know</span> | _not written yet_ |
| 13 | `develop.watch` | <span className="db-tier t-know">Know</span> | _not written yet_ |
| 14 | Day-to-day commands | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 15 | `podman compose` and `podman-compose` | <span className="db-tier t-understand">Understand</span> | _not written yet_ |
| 16 | `include` and `extends` | <span className="db-tier t-know">Know</span> | _not written yet_ |
| 17 | `--scale` and the honest limits | <span className="db-tier t-know">Know</span> | _not written yet_ |

## Coverage

Seventeen syllabus topics, seventeen pages — one to one, nothing merged and
nothing dropped.

| Syllabus topic | Page |
|---|---|
| What Compose is | 01 |
| `compose.yaml` and the Compose Specification | 02 (chunked: the Spec and the file · the YAML that bites) |
| `up` / `down` / `-d` / `--build` | 03 (chunked: `up` · `down`) |
| The `services` block | 04 (chunked: what runs · how it is wired) |
| `depends_on` with `condition: service_healthy` | 05 |
| Healthchecks in Compose | 06 (chunked: the keys · checks that are true) |
| Networks in Compose | 07 |
| Volumes in Compose | 08 |
| The project name | 09 |
| Environment and interpolation | 10 |
| Override files | 11 |
| `profiles` | 12 |
| `develop.watch` | 13 |
| Day-to-day commands | 14 |
| `podman compose` and `podman-compose` | 15 |
| `include` and `extends` | 16 |
| `--scale`, and the honest limits of Compose as a scaling tool | 17 |

## Phase gate

**Deliverable:** a `compose.yaml` that brings up an API, Postgres and Redis, where
the API genuinely waits for a *ready* database, and a teammate can run it with one
command on a clean machine.

Three checks that the file is actually right, not merely working on your laptop:

- **Delete the containers and volumes, then `up` again.** If it does not come back
  clean, something was hand-fixed and never written down.
- **Kill the database container while the stack runs.** The API should recover when
  the database returns. `depends_on` covers startup only — it does nothing after
  boot.
- **Run the same file from a second checkout at the same time.** If it collides,
  you have a project-name problem (page 09), not a Compose problem.

## Where this connects

- **Phase 3 — The Dockerfile** supplies what `build:` builds:
  [CMD versus ENTRYPOINT](../phase-3-dockerfile/05-cmd-vs-entrypoint.md),
  [exec versus shell form](../phase-3-dockerfile/06-exec-vs-shell-form.md) and
  [HEALTHCHECK](../phase-3-dockerfile/11-healthcheck.md), which page 06 either
  inherits or overrides.
- **Phase 1 — Running containers** is the command-line mirror of every service
  key: [environment](../phase-1-running-containers/06-environment.md),
  [restart policies](../phase-1-running-containers/12-restart-policies.md) and
  [the two signals](../phase-1-running-containers/08-stop-is-two-signals.md).
- **Phase 6 — Storage** and **Phase 7 — Networking** *(not written yet)* are the
  primitives this phase declares rather than explains.
- **Phase 9 — The MERN/PERN stack in containers** is this phase applied: its
  worked `compose.yaml` is the deliverable above, with a frontend and a proxy
  added.

---

← Syllabus: [Part 3 — Running a real stack](../../syllabus/03-running-a-stack.md) · Start → [What Compose is](01-what-compose-is.md)
