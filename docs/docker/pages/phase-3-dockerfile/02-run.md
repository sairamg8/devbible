---
title: "RUN"
sidebar_label: "02 · RUN"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the [Dockerfile reference — RUN](https://docs.docker.com/reference/dockerfile/#run),
> [Docker — build cache](https://docs.docker.com/build/cache/) and
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**Every `RUN` executes a command at build time and commits the result as a
layer.** Two rules follow, and between them they decide your image's size and
your build's speed: **clean in the same layer**, and **order by volatility**.

## The two forms

```dockerfile
RUN apt-get update && apt-get install -y curl     # shell form: /bin/sh -c "..."
RUN ["/usr/bin/apt-get", "install", "-y", "curl"] # exec form: no shell
```

For `RUN`, the **shell form is normally what you want** — you need `&&`, pipes
and variable expansion, and none of those exist without a shell. This is the
opposite of the advice for `CMD` and `ENTRYPOINT`, where exec form matters for
signal handling (page 06). The distinction is worth holding: **shell form for
`RUN`, exec form for the entrypoint.**

## Clean in the same layer

A layer is immutable. Anything a `RUN` leaves behind is committed, and a later
`RUN` that deletes it only adds a whiteout
([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)).

```dockerfile
# ❌ Two layers. The apt cache ships forever.
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# ✅ One layer. The cache never becomes part of it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

`--no-install-recommends` is worth its own mention: without it apt pulls in
suggested packages that frequently double the install size for no benefit.

The same pattern per ecosystem:

```dockerfile
RUN apk add --no-cache curl                                  # Alpine: no cache written at all
RUN dnf install -y curl && dnf clean all                     # Fedora/RHEL
RUN npm ci --omit=dev && npm cache clean --force             # Node
RUN pip install --no-cache-dir -r requirements.txt           # Python
```

## `apt-get update` must share the layer with `install`

This one is subtle and causes real incidents:

```dockerfile
# ❌ Cache-poisoned. update is cached; install fetches versions the cached index knows nothing about.
RUN apt-get update
RUN apt-get install -y curl
```

If `update` is served from cache on a later build while the package index has
moved on, `install` requests versions that no longer exist and the build fails —
or, worse, installs something stale. Docker's own best-practices guidance calls
this out. Keep them in one `RUN`, always.

## Order by volatility

The cache key for a `RUN` is its command text plus everything before it. One
change invalidates the rest of the file
([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)):

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package*.json ./     # changes rarely
RUN npm ci                # expensive - stays cached while the lockfile is unchanged
COPY . .                  # changes constantly
```

Reverse the last two and every source edit reinstalls every dependency. Phase 4
is the full treatment.

## Cache and secret mounts

BuildKit adds mounts that make `RUN` dramatically better, and they are the modern
answer to two old problems:

```dockerfile
# syntax=docker/dockerfile:1

# A package cache that persists across builds without entering a layer
RUN --mount=type=cache,target=/root/.npm npm ci

# A secret readable during this RUN and present in NO layer
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

The second is the correct way to use a private registry token at build time.
`ARG` is not — build args are visible in `docker history`
([Phase 2, page 06](../phase-2-images-and-registries/06-history.md)). Phase 4
covers both mounts in depth.

## How many `RUN`s?

Enough to keep related work together and to let unrelated work cache separately.
The old "minimise layers" advice is stale
([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)):

- **Chain with `&&`** when steps produce intermediate files that must not
  persist — the install-and-clean pattern.
- **Separate `RUN`s** when steps are independent, so a change to one does not
  invalidate the other.

## Podman

Identical parsing, and `podman build` supports `RUN --mount=type=cache` and
`type=secret`. Coverage of newer BuildKit-specific `RUN` options can lag; if an
option is not recognised, that is a builder-capability difference rather than a
Dockerfile error. Phase 4.

## Gotchas

**Symptom:** The image is hundreds of megabytes larger than the packages
installed.
**Cause:** Package-manager caches committed in the install layer, and
recommended packages pulled in.
**Fix:** Clean in the same `RUN` and add `--no-install-recommends`.

**Symptom:** A build that worked last week fails with "version not found" for a
package.
**Cause:** A cached `apt-get update` layer with a stale index, and `install` in a
separate `RUN`.
**Fix:** Put `update` and `install` in one `RUN`.

**Symptom:** Every build reinstalls all dependencies although only source
changed.
**Cause:** `COPY . .` before the install.
**Fix:** Copy the manifest and lockfile first, install, then copy source.

**Symptom:** A token used in a `RUN` shows up in `docker history`.
**Cause:** It was passed as an `ARG` or echoed into the command.
**Fix:** Rotate it, then use `RUN --mount=type=secret`. The image is already
compromised; rebuilding does not unpublish what was pushed.

## Interview questions

**★ Why must `apt-get update` and `apt-get install` be in the same `RUN`?**
Because layers cache independently. A cached `update` with a stale package index
followed by a fresh `install` requests versions that no longer exist — the build
fails, or installs something unintended. One `RUN` keeps them consistent.

**★ Why does deleting files in a later `RUN` not shrink the image?**
Layers are immutable and additive; the later layer only adds a whiteout that
hides the files. The bytes remain in the earlier layer and still ship. Clean
inside the same `RUN`.

**★ Shell form or exec form for `RUN`?**
Shell form, normally — you need `&&`, pipes and variable expansion, none of which
exist without a shell. Exec form matters for `CMD` and `ENTRYPOINT`, where it
determines whether your process is PID 1 and receives signals.

**How do you use a private registry token during a build without leaking it?**
`RUN --mount=type=secret`, which makes the secret readable for that instruction
only and puts it in no layer. Build args are visible in `docker history` and are
not a secret mechanism.

**Should you minimise the number of `RUN` instructions?**
No — group by purpose, not by count. Chain steps whose intermediate files must
not persist; keep independent steps separate so a change to one does not
invalidate the other's cache.

---

← Prev: [FROM](01-from.md) · Index: [Phase 3](README.md) · Next → [COPY versus ADD](03-copy-vs-add.md)
