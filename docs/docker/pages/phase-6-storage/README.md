---
title: "Phase 6 — Storage: volumes, mounts and data"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.**
> Every page is **documentation-validated** against docs.docker.com,
> docs.podman.io and the relevant manual pages, with the sources named per page.
> **No sandbox** — nothing was run, so no page carries console output.

**The writable layer is not storage. Everything in this phase follows from
that.** A container's filesystem is scratch space with the container's own
lifetime; anything you want to keep has to live somewhere the engine did not
create for the container and will not delete with it.

Twelve topics. **Pages 01, 02, 04 and 05 are the load-bearing set** — they are
the difference between "my database survived a redeploy" and a support ticket.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The container filesystem is disposable](01-filesystem-is-disposable.md)** | <span className="db-tier t-master">Master</span> | `rm` deletes the writable layer, and that is the design |
| 02 | **[Volumes, bind mounts and tmpfs](02-volumes-bind-mounts-tmpfs/README.md)** | <span className="db-tier t-master">Master</span> | Engine-managed, host-mapped, or RAM — and which job wants which |
| 03 | **[`-v` short syntax vs `--mount`](03-v-vs-mount.md)** | <span className="db-tier t-understand">Understand</span> | A typo becomes an empty directory with `-v` and an error with `--mount` |
| 04 | **[Bind mounts in development](04-bind-mounts-in-development/README.md)** | <span className="db-tier t-master">Master</span> | Live edits, and the `node_modules` trap that follows from them |
| 05 | **[File ownership and UID mismatch](05-uid-mismatch/README.md)** | <span className="db-tier t-master">Master</span> | Why a file your container wrote is owned by `165536` |
| 06 | **[Volume lifecycle](06-volume-lifecycle.md)** | <span className="db-tier t-understand">Understand</span> | `create` / `ls` / `inspect` / `rm` / `prune`, and how anonymous volumes pile up |
| 07 | **[SELinux `:z` and `:Z`](07-selinux-z-and-Z.md)** | <span className="db-tier t-understand">Understand</span> | The two-character fix for "permission denied" on Fedora and RHEL |
| 08 | **[`--read-only` and `tmpfs`](08-read-only-rootfs.md)** | <span className="db-tier t-know">Know</span> | The production posture, and what breaks first |
| 09 | **[`--userns=keep-id`](09-userns-keep-id.md)** | <span className="db-tier t-understand">Understand</span> | Podman's answer to bind-mount ownership |
| 10 | **[Backing up and restoring a volume](10-backup-and-restore.md)** | <span className="db-tier t-understand">Understand</span> | The tar-through-a-throwaway-container idiom, and why a database needs more |
| 11 | **[Volume drivers and network storage](11-volume-drivers.md)** | <span className="db-tier t-know">Know</span> | When the `local` driver is not enough |
| 12 | **Bind-mount performance on macOS and Windows** *(not written yet)* | <span className="db-tier t-know">Know</span> | A VM boundary you cannot see, and what VirtioFS changed |

## Coverage

Twelve syllabus topics across twelve pages. Nothing merged, nothing dropped.

| Syllabus topic | Page |
|---|---|
| The container filesystem is disposable | 01 |
| Named volumes vs bind mounts vs tmpfs | 02 |
| `-v` short syntax vs `--mount` | 03 |
| Bind mounts in development, and the `node_modules` trap | 04 |
| File ownership and UID mismatch | 05 |
| Volume lifecycle, and anonymous volumes | 06 |
| SELinux `:z` and `:Z` | 07 |
| `--read-only` root filesystem plus `tmpfs` | 08 |
| `--userns=keep-id` (Podman) | 09 |
| Backing up and restoring a volume | 10 |
| Volume drivers and network storage | 11 |
| Bind-mount performance on macOS and Windows, and VirtioFS | 12 |

## Phase gate

Move on to Phase 7 when you can explain:

- **why your database survived `docker compose down` but not
  `docker compose down -v`** — one removes containers and networks, the other
  also removes the named volumes the file declares;
- **why a file your container created is owned by `165536` on the host** — the
  rootless user-namespace mapping, and the two ways to fix it;
- and **why mounting your source directory over `/app` deleted the
  `node_modules` the image built** — a bind mount replaces the directory, it
  does not merge with it.

## Where this connects

- **Phase 0** supplied the mechanism:
  [OverlayFS](../phase-0-what-a-container-is/07-overlayfs.md) is the writable
  layer this phase tells you not to use, and
  [rootless](../phase-0-what-a-container-is/11-rootless.md) is the whole of
  page 05.
- **Phase 1** is where the flags first appeared:
  [`docker run` anatomy](../phase-1-running-containers/01-docker-run-anatomy.md),
  [detached and cleanup](../phase-1-running-containers/02-detached-and-cleanup.md)
  for `--rm`, and
  [reclaiming disk](../phase-1-running-containers/13-reclaiming-disk.md) for
  `prune`.
- **Phase 3** already argued the Dockerfile side:
  [`VOLUME`](../phase-3-dockerfile/13-volume.md) is why anonymous volumes exist
  at all, and [`USER`](../phase-3-dockerfile/09-user.md) is the other half of
  page 05.
- **Phase 7 — Networking** is the sibling: storage and networking are the two
  things a container needs from the host, and rootless UID mapping and rootless
  networking are the same user-namespace story told twice.
- **Phase 8 — Compose** is where `volumes:` stops being a flag and becomes a
  declaration, and **Phase 9** mounts one under a real Postgres and Mongo.

---

← Syllabus: [Part 3 — Running a real stack](../../syllabus/03-running-a-stack.md) · Prev phase: [Phase 3](../phase-3-dockerfile/README.md) · Start → [The container filesystem is disposable](01-filesystem-is-disposable.md)
