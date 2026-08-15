---
title: "The image is not the container"
sidebar_label: "04 · Image vs container"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md),
> [Docker — the overlayfs storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/)
> and [Docker — storage overview](https://docs.docker.com/engine/storage/).
> **No sandbox** — no console output on this page.

**An image is a stack of read-only layers plus a configuration. A container is
that stack with one thin writable layer on top, plus a running process.** Every
question about "where did my data go" answers itself once this is solid.

## Two nouns people use as one

| | Image | Container |
|---|---|---|
| What it is | A build artefact: layers + config JSON | A running (or stopped) instance of one |
| Mutable? | **No.** Immutable, content-addressed | Yes — it has a writable layer |
| Where it lives | Local image store; a registry | The engine's container store |
| Lifetime | Until you `rmi` it | Until you `rm` it — and its writable layer dies with it |
| How many | One | Many, all sharing the same read-only layers |
| Analogy | A class, or an installer | An instance, or an installed running program |

The relationship is one-to-many, and it is why containers are cheap: **ten
containers from one image do not use ten copies of the filesystem.** They share
the same read-only layers and get one small writable layer each.

## The writable layer is where the data loss lives

When a container writes a file, it does not modify the image. It writes into its
own **writable layer**, sometimes called the container layer. That layer:

- is created when the container is created,
- is **destroyed** when the container is removed,
- is not shared with any other container,
- is not part of the image, and does not survive a rebuild.

So the rule you should be able to state without thinking:

> **Anything written inside a container, that is not on a volume or a bind
> mount, is deleted when the container is removed.**

This is not a bug or a limitation to work around. It is the design: containers
are meant to be disposable, and durable data is meant to be explicit. Phase 6 is
the whole story of making it explicit.

Note the precise verb — **removed**, not stopped. A stopped container still has
its writable layer, which is why `docker start` on a stopped container brings
back the files it wrote. `docker rm` is when they go. And `--rm` on `run` means
the removal happens automatically the moment the process exits, which is exactly
the surprise it sounds like if you were not expecting it.

## How the layers are stacked: OverlayFS

The stacking is done by a union filesystem, in practice **OverlayFS** (the
`overlay2` driver for Docker, `containers/storage` for Podman). It has four
parts:

| Part | Role |
|---|---|
| **`lowerdir`** | The read-only image layers |
| **`upperdir`** | The container's writable layer |
| **`merged`** | The unified view — what the process sees as `/` |
| **`workdir`** | Internal scratch space OverlayFS needs to do atomic operations |

Reading a file looks top-down through the stack and returns the first copy
found. Writing is where it gets interesting, and that is
[OverlayFS and copy-up](07-overlayfs.md).

The one consequence worth carrying now: **OverlayFS works at file granularity,
not block granularity.** Changing one byte of a 2 GB file in a lower layer
copies the entire 2 GB file up into the writable layer first. Databases and
other write-heavy workloads therefore belong on volumes, which bypass the union
filesystem completely — and Docker's own documentation says exactly that.

## What an image actually contains

Per the OCI Image Specification, an image is not one file. It is:

1. A **manifest** — a JSON document listing the config and the layers by digest.
2. A **config** — JSON holding `Env`, `Entrypoint`, `Cmd`, `User`, `WorkingDir`,
   `Labels`, `ExposedPorts`, and the ordered list of layer diff IDs.
3. The **layers** themselves — tar archives, each addressed by the SHA-256 digest
   of its content.

Two things follow directly:

- **The config is why an image is more than a filesystem.** It carries the
  default command, the environment and the user. This is what `export`/`import`
  loses and `save`/`load` keeps — a distinction that catches people out in
  Phase 2.
- **Content addressing is why layers deduplicate.** Two images built `FROM
  node:24` share those layers byte-for-byte, stored once, because identical
  content produces an identical digest.

## Seeing both halves

```bash
# Images: what you can run
docker images
docker image inspect node:24

# Containers: instances, running and stopped
docker ps          # running only
docker ps -a       # including exited ones, whose writable layers still exist
docker inspect myapp

# Where the disk actually went
docker system df        # images vs containers vs volumes vs build cache
docker system df -v     # per-object detail
```

`docker system df` is the command that ends the "why is my disk full" argument,
because it separates the four things that grow independently. The same commands
work under `podman`.

## Gotchas

**Symptom:** "I installed a package inside the container and after a restart it
was gone."
**Cause:** Either the container was removed and recreated (`--rm`, or
`compose up` rebuilding), so the writable layer went with it — or a volume is
mounted over the path.
**Fix:** Install it in the **Dockerfile**. Changes made by hand inside a running
container are debugging, never configuration. If you need it to persist, it
belongs in the image or on a volume.

**Symptom:** `docker rm` frees far less disk than expected.
**Cause:** The container's writable layer was small; the space is in images,
volumes or build cache, which `rm` does not touch.
**Fix:** `docker system df` to find where it actually is, then the matching
prune. ⚠️ `docker system prune --volumes` deletes anonymous volumes — that is the
one that eats a development database.

**Symptom:** Two containers from the same image are "sharing state" — one sees a
file the other wrote.
**Cause:** They are not sharing the writable layer, which is impossible. They
are sharing a **volume**, a bind mount, or a network service.
**Fix:** Look at `docker inspect` → `Mounts`. Writable layers are strictly
per-container; anything shared came in through a mount.

**Symptom:** The image is 1.2 GB but the application is 40 MB.
**Cause:** Layers are cumulative and additive. Deleting a file in a later layer
does not remove it from the earlier layer where it was added — it only hides it
with a whiteout.
**Fix:** Do not add it in the first place: clean in the *same* `RUN`, and use
multi-stage builds so the toolchain never reaches the final image. Phases 4 and 5.

## Interview questions

**★ What is the difference between an image and a container?**
An image is an immutable, content-addressed stack of read-only layers plus a
config. A container is a running or stopped instance of one, with a thin writable
layer added and a process attached. One image, many containers, shared layers.

**★ What happens to data written inside a container?**
It goes to the container's writable layer and is destroyed when the container is
removed. Only volumes and bind mounts survive. Stopping does not lose it;
removing does.

**★ Why is starting ten containers from one image cheap?**
The read-only layers are shared — stored once and mounted into each container.
Each container adds only its own small writable layer, so the marginal cost is
one thin layer plus a process, not a filesystem copy.

**Why does changing one byte of a large file in a container cost so much?**
OverlayFS copies at file granularity. The first write to a file that lives in a
lower layer triggers `copy_up` of the whole file into the writable layer.
Write-heavy files belong on a volume, which does not go through the union
filesystem.

**What is in an OCI image besides the filesystem?**
A manifest listing config and layers by digest, and a config JSON carrying the
default `Entrypoint`/`Cmd`, `Env`, `User`, `WorkingDir`, labels and exposed
ports. That config is why an image is runnable rather than merely unpackable.

**A colleague fixed production by `docker exec`-ing in and editing a config
file. What do you say?**
That the fix will vanish the next time the container is replaced, and that the
next deploy will silently revert it. The change belongs in the image, in a
mounted config, or in an environment variable. Exec is for diagnosis.

---

← Prev: [cgroups v2](03-cgroups.md) · Index: [Phase 0](README.md) · Next → [The runtime stack, Docker](05-runtime-stack-docker.md)
