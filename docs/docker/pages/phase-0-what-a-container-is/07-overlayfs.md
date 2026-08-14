---
title: "OverlayFS and copy-up"
sidebar_label: "07 · OverlayFS and copy-up"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — the overlayfs storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/),
> [Docker — storage drivers](https://docs.docker.com/engine/storage/drivers/) and
> [overlayfs — Linux kernel documentation](https://docs.kernel.org/filesystems/overlayfs.html).
> **No sandbox** — no console output on this page.

**OverlayFS is what makes layers into a filesystem.** It presents a stack of
read-only directories plus one writable directory as a single tree. Understanding
its one non-obvious behaviour — **copy-up** — explains a whole family of
performance problems and image-size mysteries.

## The four directories

| Directory | What it holds |
|---|---|
| **`lowerdir`** | The read-only image layers. Multiple, stacked |
| **`upperdir`** | The container's writable layer — every change lands here |
| **`merged`** | The unified view. This is what the container sees as `/` |
| **`workdir`** | Internal scratch space OverlayFS uses to make operations atomic |

Reads walk the stack from the top down and return the first copy found. That is
why a file in a later image layer shadows an identically-named file in an
earlier one — and why layer order in a Dockerfile is semantically meaningful,
not just a build detail.

## Copy-up: the behaviour that surprises people

When a process **modifies** a file that lives in a `lowerdir`, OverlayFS cannot
write to it — lower layers are read-only. So it performs a `copy_up`: the file
is copied whole into the `upperdir`, and the write is applied to the copy. From
then on, that container sees its own copy.

Docker's documentation is explicit about the consequence:

> OverlayFS works at the file level rather than the block level. This means that
> all OverlayFS `copy_up` operations copy the entire file.

So:

- Appending one line to a 2 GB log file that came from the image copies **2 GB**
  before the append happens.
- The cost is paid **once per file per container** — the second write is cheap,
  because the file now lives in the `upperdir`.
- The copy consumes space in the writable layer, on top of the space the image
  already uses.

This is the single strongest technical argument for volumes: **write-heavy paths
should not go through the union filesystem at all.** A database's data
directory, an upload directory, a cache — all of them belong on a volume, which
bypasses OverlayFS entirely and writes straight to the host filesystem. Docker's
own guidance says to use volumes for write-heavy workloads.

## Deletion is not deletion

You cannot remove a file from a read-only lower layer either. OverlayFS fakes it:

- **Deleting a file** creates a **whiteout** entry in the `upperdir`, which hides
  the lower copy. The original bytes are still there, in the lower layer.
- **Deleting a directory** creates an **opaque directory** in the `upperdir`,
  which hides the whole lower directory.

This is the mechanism behind the most common image-size mistake in existence:

```dockerfile
# ❌ The secret is still in the image. Both layers ship.
COPY credentials.json /tmp/credentials.json
RUN some-setup-tool && rm /tmp/credentials.json
```

The `rm` adds a whiteout in a *later* layer. The earlier layer still contains
`credentials.json`, and anyone who pulls the image can extract it. The same
applies to a 400 MB build toolchain "removed" in a later `RUN`: the image is
still 400 MB heavier.

The fixes are structural rather than clever, and they belong to later phases:
never add it (`.dockerignore`), add and remove within **one** `RUN`, use
`RUN --mount=type=secret` so it never enters a layer, or use a multi-stage build
so the final image is assembled from scratch. Phases 3, 4 and 5.

## Page cache sharing — the upside

Because the lower layers are the *same files on disk* for every container using
them, the kernel's page cache is shared. Ten containers running the same image
share one cached copy of its libraries in memory. This is a large part of why
container density is high, and it is lost when each container has its own copy of
a file — another reason copy-up is worth avoiding on hot paths.

## Looking at it

```bash
# Which driver is in use, and how much it is storing
docker info | grep -i "storage driver"
docker system df -v

# Podman's equivalent
podman info --format '{{.Store.GraphDriverName}}'
```

Docker's `overlay2` and Podman's `containers/storage` both use OverlayFS
underneath; the names differ because the storage *managers* differ, not the
kernel mechanism.

## Gotchas

**Symptom:** Writes inside the container are far slower than on the host, and it
gets worse with file size.
**Cause:** Copy-up on first write to files that came from the image.
**Fix:** Put the write-heavy directory on a **volume**. This is not a
micro-optimisation — for a database it is the difference between usable and not.

**Symptom:** `du` inside the container and the container's actual disk usage
disagree.
**Cause:** `du` sees the merged view. The real consumption is the `upperdir`
plus the shared lower layers, which `du` cannot distinguish.
**Fix:** `docker ps -s` shows the container's writable-layer size (`SIZE`)
separately from the image (`virtual`). `docker system df -v` gives the full
breakdown.

**Symptom:** A secret was removed in a later `RUN` but a scanner still finds it
in the image.
**Cause:** Whiteouts hide; they do not delete. The earlier layer is intact and
extractable.
**Fix:** Treat any secret that ever entered a layer as leaked — rotate it. Then
prevent it structurally: `.dockerignore`, single-`RUN` cleanup, secret mounts, or
multi-stage. Phase 5.

**Symptom:** Two containers from the same image get different results from the
same file after one of them writes to it.
**Cause:** Correct behaviour — copy-up gave the writer its own copy. Lower
layers are never modified.
**Fix:** Nothing to fix. If they must share, that is a volume or a service, not
a filesystem coincidence.

## Interview questions

**★ What is copy-up, and why does it matter?**
When a container writes to a file from a read-only image layer, OverlayFS copies
the entire file into the writable layer first, because it works at file
granularity rather than block granularity. It makes the first write to a large
file expensive and is the main reason write-heavy paths belong on volumes.

**★ How is a file deleted from an image layer inside a container?**
It is not. A whiteout entry in the upper layer hides it (an opaque directory for
a whole directory). The original data remains in the lower layer, which is why
deleting a secret in a later `RUN` does not remove it from the image.

**★ Why does removing files in a later Dockerfile layer not shrink the image?**
Layers are additive and immutable. A later layer can only add a whiteout marker;
the bytes stay in the earlier layer and still ship. To actually shrink, avoid
adding the file, clean within the same `RUN`, or build the final image in a
separate stage.

**What are lowerdir, upperdir, merged and workdir?**
`lowerdir` is the read-only image layers, `upperdir` the container's writable
layer, `merged` the unified view the container sees as `/`, and `workdir`
internal scratch space OverlayFS uses for atomic operations.

**Why do containers from the same image use so little extra memory?**
The lower layers are the same files on disk, so the kernel's page cache is
shared across every container using that image. Copy-up breaks that sharing for
the copied file, which is one more reason to keep hot files off the union
filesystem.

---

← Prev: [The runtime stack, Podman](06-runtime-stack-podman.md) · Index: [Phase 0](README.md) · Next → [The OCI specifications](08-oci-specs.md)
