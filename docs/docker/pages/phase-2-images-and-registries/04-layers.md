---
title: "Layers"
sidebar_label: "04 · Layers"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md),
> [Docker — storage drivers](https://docs.docker.com/engine/storage/drivers/) and
> [Docker — the overlayfs storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/).
> **No sandbox** — no console output on this page.

**Each layer is a tar archive of filesystem changes, addressed by the hash of its
contents.** Two properties follow — layers are **shared** and layers are
**immutable** — and between them they explain image size, pull speed, build cache
and why deleting a file does not help.

## What a layer is

A layer records a **diff**: files added, changed or removed relative to the layer
beneath it. Not a snapshot of the whole filesystem, just the delta.

The instructions that produce a layer are the ones that change the filesystem —
`RUN`, `COPY`, `ADD`. Metadata-only instructions (`ENV`, `WORKDIR`, `LABEL`,
`EXPOSE`, `CMD`, `ENTRYPOINT`, `USER`) change the image **config** rather than the
filesystem, so they do not add filesystem layers.

```dockerfile
FROM node:24-slim          # the base image's layers
WORKDIR /app               # config only
COPY package*.json ./      # a layer
RUN npm ci                 # a layer
COPY . .                   # a layer
CMD ["node", "server.js"]  # config only
```

## Sharing: why containers are cheap

Layers are content-addressed, so **identical layers are stored once**. Ten images
built `FROM node:24-slim` share those base layers on disk; ten containers from
one image share all of its layers and add one thin writable layer each.

The same property makes pulls fast: `docker pull` fetches only the layers you do
not already have. A new version of your application that changed only the last
layer transfers only that layer.

This is why a "small" base image is not automatically the right choice. If every
image on the host already shares a 180 MB Debian-slim base, an Alpine-based
service that is 40 MB by itself may add *more* unique bytes than a slim-based one
that adds 12 MB on top of layers already present. Phase 5 revisits this honestly.

## Immutability: why deleting does not shrink

A layer, once written, never changes. A later layer can only **add** — including
adding a whiteout that hides a file
([Phase 0, page 07](../phase-0-what-a-container-is/07-overlayfs.md)).

```dockerfile
# ❌ Still ships the 400 MB. The second RUN adds a whiteout; the first layer stays.
RUN curl -O https://example.com/toolchain.tar.gz && tar xzf toolchain.tar.gz
RUN rm -rf toolchain.tar.gz /opt/toolchain

# ✅ One layer. The intermediate files never become part of it.
RUN curl -O https://example.com/toolchain.tar.gz \
 && tar xzf toolchain.tar.gz \
 && make install \
 && rm -rf toolchain.tar.gz /opt/toolchain
```

**The unit of cleanup is the layer, not the image.** Anything you want gone must
never be committed in the first place — cleaned in the same `RUN`, kept out by
`.dockerignore`, mounted rather than copied, or left behind in an earlier
multi-stage stage. Phases 3, 4 and 5 are the practice; this is the reason.

## Order determines the cache

Because each layer is identified by its inputs, changing one invalidates every
layer after it. That single fact is most of build performance:

```dockerfile
COPY package*.json ./      # changes rarely
RUN npm ci                 # expensive - cached while the lockfile is unchanged
COPY . .                   # changes constantly
```

Reverse those and every source edit reinstalls every dependency. Phase 4 is the
full treatment; the mechanism is here.

## Seeing them

```bash
docker history node:24-slim              # per-layer sizes and the instruction
docker history --no-trunc myapi:1.4.2    # full commands, for finding the culprit
docker image inspect --format '{{json .RootFS.Layers}}' myapi:1.4.2
docker system df -v                      # what is actually on disk, shared or not
```

`docker history` is where you find the 400 MB layer. Page 06 reads it properly.

## How many layers?

Old advice said to minimise layer count aggressively. That advice is stale:

- There is no meaningful hard limit in practice.
- **More layers can be better**, because they cache independently and transfer
  independently.
- What matters is **what is in them** and **their order**, not how many there are.

Chain commands with `&&` when the steps belong together and their intermediate
files must not persist — not to hit a layer-count target.

## Podman

Identical, because the format is the OCI image spec. `podman history` and
`podman image inspect` mirror Docker's. Podman stores layers under
`containers/storage`; rootless, that is inside your home directory, which is
worth knowing when a quota is involved.

## Gotchas

**Symptom:** An image is 1.2 GB although the final filesystem holds 300 MB.
**Cause:** Files added in one layer and deleted in a later one. Both layers ship.
**Fix:** Clean in the same `RUN`, or use a multi-stage build so the final image
is assembled fresh. `docker history` finds the layer.

**Symptom:** Every build reinstalls all dependencies although only source
changed.
**Cause:** `COPY . .` before the dependency install, so the install layer is
invalidated every time.
**Fix:** Copy the manifest and lockfile first, install, then copy the source.
Phase 4.

**Symptom:** A pull that should be small downloads hundreds of megabytes.
**Cause:** An early layer changed — a new base image, or an instruction near the
top — so every layer after it is new.
**Fix:** Expected, not a fault. Keep volatile instructions late so most pulls
stay small.

**Symptom:** Deleting a secret in a later `RUN` and a scanner still finds it.
**Cause:** Whiteouts hide; the earlier layer is intact and extractable.
**Fix:** Rotate the secret — treat it as leaked — then prevent it structurally
with `.dockerignore`, single-`RUN` cleanup, secret mounts or multi-stage.
Phase 5.

## Interview questions

**★ What is a layer?**
A tar archive of filesystem changes relative to the layer below, addressed by the
hash of its content. `RUN`, `COPY` and `ADD` create them; metadata instructions
like `ENV` and `CMD` change the image config instead.

**★ Why does deleting a file in a later layer not shrink the image?**
Layers are immutable and additive. The later layer can only add a whiteout that
hides the file; the bytes remain in the earlier layer and still ship. Clean
within the same `RUN`, or never add it.

**★ Why are ten containers from one image cheap?**
They share the same read-only layers, stored once, and add only a thin writable
layer each. Content addressing means identical layers are stored once across
images too.

**Should you minimise the number of layers?**
Not as a goal. Layer count is not the constraint; content and order are. More
layers can help, because they cache and transfer independently. Chain commands
when their intermediate files must not persist, not to hit a count.

**Which Dockerfile instructions create layers?**
The ones that change the filesystem — `RUN`, `COPY`, `ADD`. `ENV`, `WORKDIR`,
`LABEL`, `EXPOSE`, `USER`, `CMD` and `ENTRYPOINT` modify the image configuration
rather than adding filesystem layers.

---

← Prev: [pull, push, images, tag and rmi](03-pull-push-tag.md) · Index: [Phase 2](README.md) · Next → [Choosing a base image](05-choosing-a-base-image.md)
