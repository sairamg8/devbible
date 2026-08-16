---
title: "Bind mounts in development"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — Compose file watch](https://docs.docker.com/compose/how-tos/file-watch/) and
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/).
> **No sandbox** — no console output on this page.

**A development bind mount trades a rebuild for a save.** Your source lives on
the host, your editor edits it there, and the process inside the container sees
the change immediately. The cost is that the mount **obscures** whatever the
image put at that path — and what the image put there is `node_modules`.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The development loop](01-the-development-loop.md)** | The pattern, what belongs in the image and what belongs in the mount, and why file watching sometimes does not fire |
| 02 | **[The `node_modules` trap](02-the-node-modules-trap.md)** | Why `Cannot find module 'express'` happens the moment you mount, the four fixes, and the architecture mismatch behind the worst version of it |
| 03 | **[Compose in development, and `watch`](03-compose-and-watch.md)** | The dev Compose file, override files, and `develop.watch` — the way out of bind-mounting altogether |

## Phase gate

You are done with this topic when you can explain, in one sentence each, why
mounting your project over `/app` breaks `node_modules`, why an anonymous volume
at `/app/node_modules` fixes it, and why that fix then goes stale when you add a
dependency.

## Where this connects

- **[02 · Volumes, bind mounts and tmpfs](../02-volumes-bind-mounts-tmpfs/02-bind-mounts-and-tmpfs.md)**
  states the obscuring rule this whole topic is an application of.
- [05 · File ownership and UID mismatch](../05-uid-mismatch/README.md) is the other half
  of the dev bind mount: who owns the files it writes back to your host.
- [12 · Bind-mount performance on macOS and Windows](../12-bind-mount-performance.md) is why
  this pattern feels different on a Mac.
- **[Phase 3 · `.dockerignore`](../../phase-3-dockerfile/08-dockerignore.md)** —
  the same `node_modules` question, one build stage earlier.

---

← Prev: [`-v` short syntax vs `--mount`](../03-v-vs-mount.md) · Index: [Phase 6](../README.md) · Start → [The development loop](01-the-development-loop.md)
