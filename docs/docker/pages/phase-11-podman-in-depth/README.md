---
title: "Phase 11 — Podman in depth"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.** Every page is
> **documentation-validated** against docs.podman.io, docs.docker.com, the OCI
> specifications, the Linux man pages or the release notes, with the sources named
> per page. **No sandbox** — nothing was run, so no page carries console output.

Podman is not "Docker with a different name". The daemonless, rootless design
changes real things. This phase is where those differences live, so the rest of
the track can stay engine-neutral.

🏁 **Complete — 16 of 16 topics** (Master 4/4 · Understand 8/8 · Know 4/4).

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Daemonless](01-daemonless/README.md)** | <span className="db-tier t-master">Master</span> | No `dockerd`, no root socket — the container is a child of your session, and that changes restart, logs and `systemctl` |
| 02 | **[Rootless by default](02-rootless-by-default/README.md)** | <span className="db-tier t-master">Master</span> | User namespaces, `/etc/subuid`, and the UID arithmetic behind every ownership surprise |
| 03 | **[Pods](03-pods.md)** | <span className="db-tier t-understand">Understand</span> | A shared network namespace plus an infra container — the one place `localhost` means "my neighbour" |
| 04 | **[Quadlet](04-quadlet/README.md)** | <span className="db-tier t-master">Master</span> | `.container`, `.pod`, `.volume`, `.network`, `.kube`, `.build` units and the systemd generator behind them |
| 05 | **[Where Podman will bite you](05-where-podman-bites/README.md)** | <span className="db-tier t-master">Master</span> | Lingering, systemd-timer healthchecks, netavark errors, and the Compose gaps |
| 06 | **[`podman unshare`](06-podman-unshare.md)** | <span className="db-tier t-understand">Understand</span> | A shell inside the user namespace your containers already run in — the only place container UIDs are real |
| 07 | **[`--userns`: `keep-id`, `nomap`, `auto`](07-userns-modes.md)** | <span className="db-tier t-understand">Understand</span> | Choosing the mapping instead of fighting it — six modes, and the pod that silently ignores all of them |
| 08 | **[`podman pod create` / `ps` / `rm`](08-pod-commands.md)** | <span className="db-tier t-understand">Understand</span> | Driving a pod, and the decision that matters: a pod, or a user-defined network |
| 09 | **[Quadlet vs `podman generate systemd`](09-quadlet-vs-generate-systemd.md)** | <span className="db-tier t-understand">Understand</span> | Generated units drift because they are derived data; Quadlet inverts the direction |
| 10 | **[`podman auto-update`](10-auto-update.md)** | <span className="db-tier t-know">Know</span> | Image-driven updates for systemd-managed services — and why rollback needs SDNOTIFY to mean anything |
| 11 | **[`podman kube play` / `generate kube`](11-kube-play.md)** | <span className="db-tier t-understand">Understand</span> | Kubernetes YAML as a file format for one host — the unsupported fields are ignored, not rejected |
| 12 | **[Buildah and Skopeo](12-buildah-and-skopeo.md)** | <span className="db-tier t-know">Know</span> | Three tools, three privilege levels — and Skopeo copies between registries without a local pull |
| 13 | **[Docker CLI compatibility](13-docker-cli-compatibility.md)** | <span className="db-tier t-understand">Understand</span> | Three levels — artefacts, CLI, API — and why an alias is the one that breaks in scripts |
| 14 | **[Podman 6 breaking changes](14-podman-6-breaking-changes.md)** | <span className="db-tier t-understand">Understand</span> | A removal release — cgroups v1, BoltDB, CNI, slirp4netns, iptables and two host platforms |
| 15 | **[`podman machine`](15-podman-machine.md)** | <span className="db-tier t-know">Know</span> | The Linux VM behind Podman on macOS and Windows — your CLI is a remote client, and that explains everything |
| 16 | **[Podman Desktop](16-podman-desktop.md)** | <span className="db-tier t-know">Know</span> | A view, not a source of truth — plus the licence threshold that decides it for organisations |

## Coverage

Sixteen syllabus topics, sixteen pages — nothing merged and nothing dropped. Four
rows are **Master** (01, 02, 04, 05) and are chunked directories; the eight
Understand and four Know rows are single pages.

## Phase gate

Run one of your project's services rootless as a Quadlet unit that survives a
reboot, and explain the UID mapping of a file it wrote to a bind-mounted
directory.

## Where this phase sits

The rest of the track teaches both engines together and calls out the differences
per topic. This phase is where the differences are collected and argued properly,
so **[Phase 0 · 06 · The runtime stack, Podman](../phase-0-what-a-container-is/06-runtime-stack-podman.md)**
can stay an overview and
**[Phase 10 · 14 · Running containers under systemd](../phase-10-production/14-under-systemd.md)**
can stop at "on Podman you should not be hand-writing the unit at all".

---

← Prev: [Phase 10 — Running containers in production](../phase-10-production/README.md) · Index: [Docker & Podman pages](../README.md) · Next → [Phase 12 — Delivery, CI and orchestration](../phase-12-delivery-and-ci/README.md)
