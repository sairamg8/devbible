---
title: "Docker & Podman — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against the Docker Engine release notes, the Dockerfile
> reference, the Compose Specification and the Podman documentation. **No
> sandbox** — every claim on these pages is documentation-validated and names its
> source. Nothing was run to produce a console block.

The complete topic inventory for containers, tiered for **mastery in fullstack
application development**. **13 phases, 192 topics**, split into 4 parts to stay
under the 300-line file cap.

Both engines are taught together, because in practice you meet both: Docker is
what the ecosystem assumes, Podman is what your Linux distribution ships. They
implement the same OCI specifications, so **95% of what you learn transfers
unchanged** — the syllabus calls out the 5% that does not, rather than pretending
either one is the only engine in the world.

## Version facts

| | |
|---|---|
| Docker Engine | **29.7.2** — released **5 Aug 2026** |
| Docker Compose | **v5.4.0** (3 Aug 2026), bundling **BuildKit v0.32.1** |
| Dockerfile frontend | **v1.26.0** — pinned per-file with `# syntax=docker/dockerfile:1` |
| Bundled runtime | **runc v1.4.3** |
| Podman | **6.1.0** current; **5.8.4** is what this machine runs |
| Podman 6 breaking changes | **cgroups v1 support removed**; BoltDB dropped, auto-migrated to SQLite; Intel macOS and Windows 10 hosts dropped |
| Compose file format | The **Compose Specification** — `version:` at the top of the file is **obsolete** |
| Build on today | **Docker Engine 29** or **Podman 5.8+** · Compose v5 · BuildKit as the builder |

Two facts here are load-bearing and are the ones most often stated wrongly:
**`docker-compose` (the hyphenated Python v1) is dead** — the command is
`docker compose`, a Go plugin, and the file no longer carries a `version:` key.
And **BuildKit is the builder**, not an opt-in — `DOCKER_BUILDKIT=1` is a flag
you no longer need to set.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[How containers work](syllabus/01-how-containers-work.md)** | Kernel primitives, running containers, images and registries | 0–2 |
| 2 | **[Building images](syllabus/02-building-images.md)** | The Dockerfile, build strategy and cache, image quality | 3–5 |
| 3 | **[Running a real stack](syllabus/03-running-a-stack.md)** | Storage, networking, Compose, the MERN/PERN stack | 6–9 |
| 4 | **[Production and depth](syllabus/04-production-and-depth.md)** | Production operation, Podman in depth, delivery and CI | 10–12 |

## Explanations

The explanations live separately, in **[Explanations](./pages/README.md)** —
one page per topic, with commands, gotchas and interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="docker" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up flags freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 55 | 29% |
| <span className="db-tier t-understand">Understand</span> | 85 | 44% |
| <span className="db-tier t-know">Know</span> | 44 | 23% |
| <span className="db-tier t-when">When Needed</span> | 8 | 4% |
| **Total** | **192** | |

By part: How containers work 45 · Building images 46 · Running a stack 57 ·
Production and depth 44. Counted from the tier badges in the four part files,
not estimated.

If you only ever finish the <span className="db-tier t-master">Master</span> set,
you can containerise an application, run the whole stack locally, and debug it
when it breaks. The rest is range.

## Prerequisites

Comfort in a Linux shell — processes, signals, file permissions, environment
variables, and what a port is. **Node.js through Phase 5** if you want the
application phases to land, because Phase 9 containerises exactly that.

You do **not** need Kubernetes, and you should not learn it first. It is a layer
above everything here; Phase 12 is its on-ramp.

## Reading order

Phases are sequential and the order is load-bearing. Three rules:

1. **Do not skip Phase 0.** Almost every "Docker is confusing" complaint is
   really "I never learned that a container is a process." Namespaces and cgroups
   are 40 minutes that save you weeks.
2. **Do not start Compose before Phase 7.** Compose is a thin orchestration file
   over the networking and volume primitives. Learning it first means memorising
   YAML you cannot debug.
3. **Do not go near production (Phase 10) before you can build a small, non-root,
   multi-stage image (Phases 3–5).** Production problems are mostly image
   problems wearing a different hat.

Phases 11 and 12 are more parallelizable — Podman depth and CI delivery can run
alongside whatever you are building.

## What is deliberately not here

- **Kubernetes** — a layer above this track, parked in the project brief. Phase
  12 covers what your image and Compose file translate to, and stops there.
- **Docker Swarm** beyond a single "does this still matter?" row.
- **Cloud-specific container services** (ECS, Cloud Run, App Runner) — the image
  you build here is the input to all of them; their consoles change quarterly.

## Sources

- [Docker Engine release notes](https://docs.docker.com/engine/release-notes/) · [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Compose Specification](https://docs.docker.com/reference/compose-file/) · [Compose release notes](https://docs.docker.com/compose/release-notes/)
- [BuildKit / build release notes](https://docs.docker.com/build/release-notes/)
- [Podman documentation](https://docs.podman.io/en/latest/) · [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html)
- [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) · [Podman releases](https://github.com/containers/podman/releases)
- [OCI Image Spec](https://github.com/opencontainers/image-spec) · [OCI Runtime Spec](https://github.com/opencontainers/runtime-spec)
