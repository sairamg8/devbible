---
title: "RUN --mount=type=cache"
sidebar_label: "09 · RUN --mount=type=cache"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Dockerfile reference — `RUN --mount=type=cache`](https://docs.docker.com/reference/dockerfile/#run---mounttypecache),
> [Docker — optimize cache usage](https://docs.docker.com/build/cache/optimize/) and
> [Docker — BuildKit](https://docs.docker.com/build/buildkit/).
> **No sandbox** — no console output on this page.

**A cache mount is a directory that survives between builds and is in no layer of
the image.** It is what makes the *miss* cheap, where correct instruction
ordering ([page 02](02-instruction-ordering.md)) makes the miss *rare*. The two
are complementary, and most fast builds use both.

## The problem it solves

Layer caching is all-or-nothing per instruction. Add one dependency and
`RUN npm ci` misses — and then re-downloads all nine hundred packages, not the
one that changed, because the layer was thrown away wholesale.

A cache mount gives that `RUN` a persistent directory for the package manager's
*own* cache. The instruction still re-executes; it just does not re-download.

> "Contents of the cache directories persists between builder invocations without
> invalidating the instruction cache."

Read that sentence carefully — it makes two promises. The directory persists,
**and** its contents are not part of the cache key, so a changed cache does not
cause spurious rebuilds.

## The syntax

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm install
```

`target` is the directory inside the build container that BuildKit backs with
persistent storage. Nothing else changes: the instruction runs normally, writes
its cache there, and finds it again next time.

## The options

| Option | Meaning |
|---|---|
| `id` | "Optional ID to identify separate/different caches. Defaults to value of `target`." |
| `target`, `dst`, `destination` | Mount path |
| `ro`, `readonly` | Read-only if set |
| `sharing` | `shared`, `private` or `locked` — **defaults to `shared`** |
| `from` | Build stage, context or image name to use as a base of the cache mount |
| `source` | Subpath in the `from` to mount; defaults to its root |
| `mode` | File mode for a new cache directory, octal, default `0755` |
| `uid` / `gid` | Owner of a new cache directory, default `0` |

**`sharing` is the one that matters.** With the default `shared`, concurrent
builds use the same directory at the same time — fine for a content-addressed
store, wrong for anything that takes a lock or rewrites an index.

- `shared` — concurrent access allowed (default)
- `locked` — a second build **waits** for the first
- `private` — a second build gets its own new cache

**`uid`/`gid` matter as soon as the build does not run as root.** The default
owner is `0`, so a `RUN` after a `USER` switch may not be able to write to its
own cache; set them to the build user.

## Per-ecosystem recipes

The documentation is explicit that this is not one-size-fits-all: "package
managers have different requirements for how they use the cache, and using the
wrong options can lead to unexpected behavior."

**Apt** — needs exclusive access, so both directories are `locked`:

```dockerfile
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt update && apt-get --no-install-recommends install -y gcc
```

> "Apt needs exclusive access to its data, so the caches use the option
> `sharing=locked` to ensure parallel builds using the same cache mount wait for
> each other and not access the same cache files at the same time."

**Go** — module cache and build cache, two mounts:

```dockerfile
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app/hello
```

**Node** — npm's cache directory:

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm install
```

**Python** — pip's:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

The general instruction from the docs applies to anything not listed: "read the
documentation for the build tool you're using to make sure you're using the
correct cache mount options" — the right `target` is whatever that tool
documents as its cache directory, and nothing else works.

## The rule you must not break

> "Cache mounts should only be used for better performance. Your build should
> work with any contents of the cache directory as another build may overwrite
> the files or GC may clean it if more storage space is needed."

This is a hard constraint, not advice. A cache mount is **not** storage:

- It can be empty at any time — garbage collection, a fresh builder, a different
  machine.
- Another concurrent build may have overwritten it.
- It is local to the builder, so CI runners generally start without it.

So never put a *build output* in one. If the artefact only exists because a
previous build left it there, the build is not reproducible and will fail the
first time the cache is cleared — usually in CI, usually at the worst moment.

## Combining it with the ordering pattern

They solve different halves and both are worth having:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app

# ordering: this layer misses only when dependencies actually change
COPY package.json package-lock.json ./

# cache mount: and when it does miss, the download is mostly local
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build
```

Ordering means the install rarely runs. The cache mount means that when it does,
it is cheap. Drop either and you feel it.

One caveat specific to `npm ci`: it removes `node_modules` before installing
([page 03](03-dependency-install-pattern.md)), so mounting a cache over
`node_modules` accomplishes nothing. The cache belongs on `~/.npm`, npm's
download cache — not on the installed tree.

## What it is not

**Not the layer cache.** The layer cache decides whether the instruction runs at
all; a cache mount is a directory that instruction can use when it does run.
They are separate mechanisms with separate storage.

**Not a volume.** Volumes are a runtime concept for containers; this exists only
during a build.

**Not shared with other builders by default.** A `docker-container` builder, a
remote builder and the bundled one each keep their own. Moving cache between
machines is cache **export**, not cache mounts — [page 12 · Cache import and
export](12-cache-import-export.md).

## Podman

Buildah implements the same `RUN --mount=type=cache` syntax, and the Podman
documentation uses `dst`/`destination` as spellings alongside `target`. Because
Buildah ignores the `# syntax=` directive ([page 08](08-buildkit.md)), which
mount options are honoured depends on the installed Buildah version rather than
on a pinned frontend. Verify the specific options — `sharing` in particular —
before relying on them in a build that must run under both engines.

## Gotchas

**Symptom:** The build works locally and fails in CI with a missing file.
**Cause:** Something the build needs was only in a cache mount, which the CI
runner does not have.
**Fix:** Treat cache mounts as disposable. Anything the build *requires* must be
produced by the build or copied in.

**Symptom:** Parallel builds corrupt the apt cache or fail with lock errors.
**Cause:** The default `sharing=shared` with a package manager that needs
exclusive access.
**Fix:** `sharing=locked` on the apt cache mounts.

**Symptom:** Permission denied writing to the cache directory.
**Cause:** The mount is created owned by UID 0, but the `RUN` executes as a
non-root user.
**Fix:** Set `uid` and `gid` on the mount to match the build user.

**Symptom:** A cache mount on `node_modules` appears to do nothing.
**Cause:** `npm ci` deletes `node_modules` before installing.
**Fix:** Mount npm's download cache (`/root/.npm`) instead.

## Interview questions

**★ What does a cache mount do that layer caching does not?**
Layer caching decides whether an instruction runs. A cache mount gives the
instruction a directory that persists across builds when it *does* run — so a
missed `npm ci` re-installs but does not re-download. Its contents do not
participate in the instruction cache key.

**★ Why must a build work with an empty cache mount?**
Because the documentation guarantees nothing about persistence: another build may
overwrite the files, and garbage collection may clear them when space is needed.
Cache mounts are strictly a performance optimisation, so no build output may live
only there.

**★ What is `sharing=locked` for?**
Concurrency. The default is `shared`, meaning parallel builds use the same
directory simultaneously. Apt needs exclusive access to its data, so `locked`
makes a second build wait rather than corrupt the cache; `private` gives it a
separate cache instead.

**Where do you point the mount for npm, pip and Go?**
`/root/.npm` for npm, `/root/.cache/pip` for pip, and both `/go/pkg/mod` and
`/root/.cache/go-build` for Go. The correct target is whatever the tool documents
as its cache directory.

**Does a cache mount help a fresh CI runner?**
No — the mount is local to the builder, so a new runner starts empty. Carrying
cache between machines is cache export/import, a different mechanism.

---

← Prev: [BuildKit](08-buildkit.md) · Index: [Phase 4](README.md) · Next → [`RUN --mount=type=bind`](10-mount-type-bind.md)
