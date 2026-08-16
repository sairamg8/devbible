---
title: "Named volumes, bind mounts and tmpfs"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — storage overview](https://docs.docker.com/engine/storage/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/),
> [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/) and
> [Podman — podman-run](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**There are three ways to put a filesystem path inside a container that is not
part of the image, and the choice is decided by one question: who owns this
data's lifetime — the engine, the host, or nobody?** Everything else about them
follows from that answer.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The three types, and named volumes](01-named-volumes.md)** | The comparison table, the `local` driver, and **pre-population** — the behaviour that makes volumes unlike everything else |
| 02 | **[Bind mounts and `tmpfs`](02-bind-mounts-and-tmpfs.md)** | Mounting a host path and why it **obscures** rather than merges, `tmpfs` in host memory, all three in Compose, and the Podman differences |

## Phase gate

You are done with this topic when you can say, without looking, what happens to
the image's existing files at a mount point — copied in for an empty volume,
hidden for a bind mount — and why that one difference is the root of half the
storage bugs in this phase.

## Where this connects

- **[01 · The container filesystem is disposable](../01-filesystem-is-disposable.md)**
  is the problem all three of these solve.
- [04 · Bind mounts in development](../04-bind-mounts-in-development/README.md) is the obscuring rule
  applied to `node_modules`.
- **[Phase 3 · `VOLUME`](../../phase-3-dockerfile/13-volume.md)** is where
  anonymous volumes come from.

---

← Prev: [The container filesystem is disposable](../01-filesystem-is-disposable.md) · Index: [Phase 6](../README.md) · Start → [The three types, and named volumes](01-named-volumes.md)
