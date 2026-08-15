---
title: "How the layer cache decides"
sidebar_label: "01 · How the layer cache decides"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/),
> [Docker — build cache](https://docs.docker.com/build/cache/),
> [Docker — optimize cache usage](https://docs.docker.com/build/cache/optimize/),
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**The cache is a per-instruction lookup, and the thing being looked up is almost
always the literal text of the instruction — not the state of the filesystem it
would produce.** Understand that one sentence and every "why did it rebuild?"
and every "why did it *not* rebuild?" answers itself.

## The builder's loop

A build walks the Dockerfile top to bottom. Before executing an instruction, the
builder asks whether it already has the result of running *that* instruction on
top of *this exact* parent layer. From the invalidation reference:

> "The builder begins by checking if the base image is already cached. Each
> subsequent instruction is compared against the cached layers."
>
> "If no cached layer matches the instruction exactly, the cache is invalidated."

So a cache entry is identified by a pair:

| Part of the key | What it is |
|---|---|
| **The parent** | The layer produced by every instruction before this one |
| **The instruction** | The instruction's own text, after `ARG` substitution |

The parent half is why the cache behaves as a **chain** rather than a set of
independent lookups, and it is the half people forget. Two Dockerfiles with an
identical `RUN npm ci` line share nothing if the lines above them differ, because
the parent is different.

## Most instructions are compared as text, and only as text

This is the rule that surprises everyone, and the docs state it flatly:

> "Aside from the `ADD` and `COPY` commands, cache checking doesn't look at the
> files in the container to determine a cache match."

`RUN apt-get update` matches a cached layer because the *string*
`RUN apt-get update` matches — not because the package lists are still current.
The builder has no idea what the command did, no idea that upstream published a
security patch this morning, and no intention of finding out.

> "The cache for `RUN` instructions isn't invalidated automatically between
> builds."

That is the mechanism behind two very different everyday experiences:

- The good one — `RUN npm ci` costing four minutes on Monday and zero seconds
  every day after, because nothing above it changed.
- The bad one — an image built from `RUN apt-get update && apt-get install -y
  curl` that has been reusing a package index from three months ago, and will
  keep doing so forever unless something above it changes or you force a miss.

## The two exceptions that read files

Three instruction forms genuinely inspect the build context, because for them
the text alone would be meaningless — `COPY . .` says nothing about what is in
`.`:

> "For the `ADD` and `COPY` instructions, and for `RUN` instructions with bind
> mounts, the builder calculates a cache checksum from file metadata to
> determine whether cache is valid."

So `COPY package.json ./` misses when `package.json` changes and hits when it
does not, which is the entire foundation of the dependency-install pattern two
pages from here.

One deliberate exclusion, and it is the reason `git checkout` does not wreck
your cache:

> "The modification time of a file (`mtime`) is not taken into account when
> calculating the cache checksum. If only the `mtime` of the copied files have
> changed, the cache is not invalidated."

A fresh clone, a `git checkout` of the same content, a `touch` across the tree —
all of them rewrite mtimes and none of them cost you a rebuild. Content is what
counts.

:::note What the docs do not settle
The reference says "a cache checksum from file metadata" without enumerating the
fields. Whether a permission or ownership change alone — same bytes, different
mode — invalidates the cache is **not stated in the documentation**, and there is
no sandbox on this track to settle it by measurement. Treat a `chmod` in the
context as *possibly* cache-invalidating and do not build a workflow that
depends on either answer.
:::

## The cascade — one miss poisons the rest

> "Once the cache is invalidated, all subsequent Dockerfile commands generate new
> images and the cache isn't used."

There is no re-synchronisation. The builder does not look further down and
notice that instruction 9 would have produced the same result anyway. Once the
parent differs, every child key differs, all the way to the end of the stage.

Read this Dockerfile as the builder does:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine          # 1
WORKDIR /app                 # 2
COPY . .                     # 3   ← the whole repo
RUN npm ci                   # 4
RUN npm run build            # 5
CMD ["node", "dist/main.js"] # 6
```

Change one character in one component file and the build behaves like this:

| # | Instruction | Result | Why |
|---|---|---|---|
| 1 | `FROM node:22-alpine` | **hit** | Same base, already resolved |
| 2 | `WORKDIR /app` | **hit** | Same text, same parent |
| 3 | `COPY . .` | **MISS** | Checksum of the context changed |
| 4 | `RUN npm ci` | miss | Parent changed — reinstalls every package |
| 5 | `RUN npm run build` | miss | Parent changed |
| 6 | `CMD [...]` | miss | Parent changed |

Nothing about `npm ci` changed. It reinstalls anyway, because instruction 3 sits
above it and instruction 3 saw a different context. That is the whole of build
performance in one table, and the fix — splitting the `COPY` so the manifest
arrives before the source — is [page 03 · The dependency-install pattern](03-dependency-install-pattern.md).

## What else moves the key

Beyond the obvious "you edited the line", these change an instruction's key or
its parent, and each one has caught somebody out:

- **A build argument the instruction uses.** `ARG` values are substituted before
  comparison, so `RUN echo $VERSION` with a new `--build-arg VERSION=` is a
  different instruction. An `ARG` that is *declared* but unused in an instruction
  does not change that instruction's key — see
  [Phase 3 · ENV versus ARG](../phase-3-dockerfile/07-env-vs-arg.md).
- **The base image resolving to a different digest.** A moving tag like
  `node:22-alpine` is the same *text* but a different *image* after upstream
  republishes it, so the whole chain rebuilds the first time the builder resolves
  it afresh. Digest-pinning removes the surprise, at the cost of the patches.
- **`.dockerignore`.** It decides what is in the context, so editing it changes
  what any `COPY .` hashes — including the notorious case of `.git` being present
  and every commit producing a new checksum
  ([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).
- **`WORKDIR` with a dynamic `SOURCE_DATE_EPOCH`.** The `WORKDIR` instruction
  takes `SOURCE_DATE_EPOCH` into account when checking the cache, so feeding it a
  git commit timestamp invalidates on every commit. The docs call this
  intentional and suggest `--build-arg SOURCE_DATE_EPOCH=0` when you want
  reproducibility without the invalidation.

And one thing that pointedly does **not**:

> "The contents of build secrets are not part of the build cache."

Changing the *value* behind `--secret` does not force a re-run — the secret's id
and mount path do participate, but its bytes do not. If a rotated token must
actually be used, pair it with a changing build argument, exactly as the
reference shows:

```dockerfile
FROM alpine
ARG CACHEBUST
RUN --mount=type=secret,id=TOKEN,env=TOKEN \
    some-command ...
```

```bash
TOKEN="tkn_pat123456" docker build --secret id=TOKEN --build-arg CACHEBUST=1 .
```

## Forcing a miss on purpose

Three levers, in increasing order of violence:

```bash
# 1. one stage only — re-run the stage named `install`, keep the rest cached
docker build --no-cache-filter install .

# 2. the whole build — every instruction re-executes
docker build --no-cache .

# 3. delete the cache itself, for every build on this machine
docker builder prune
```

`--no-cache-filter` is the one worth remembering, because it is the surgical
answer to a stale `apt-get update` or a package index you actually want
refreshed. `--no-cache` on a CI job is usually a sign that something else is
wrong: it converts a 40-second build into an 11-minute one to solve a problem
that a correctly-ordered Dockerfile would not have.

## Podman and Buildah

Same Dockerfile, different builder, and the difference is worth knowing before
you assume a build is broken.

| | Docker (BuildKit) | Podman (Buildah) |
|---|---|---|
| Caching intermediate layers | Always | `--layers`, **default `true`**; overridable with the `BUILDAH_LAYERS` environment variable |
| Skip the cache | `--no-cache` | `--no-cache` — "Build from the start with a new set of cached layers" |
| Age out old entries | — | `--cache-ttl <duration>`; setting it to zero "is equivalent to using `--no-cache`" |
| Remote cache | `--cache-from` / `--cache-to` | `--cache-from` / `--cache-to`, and **both are ignored unless `--layers` is specified** |

That last row is the trap. A Podman CI job that sets `BUILDAH_LAYERS=false` (or
an older habit of passing `--layers=false`) and then carefully configures
`--cache-from` gets **no caching at all and no warning** — the flags are simply
ignored. Remote cache is **page 12 · Cache import and export** *(not written yet)*; the point here is
that the layer cache has to exist locally before anything can be imported into
it.

## Gotchas

**Symptom:** Editing a single source file reinstalls every npm package.
**Cause:** `COPY . .` sits above `RUN npm ci`, so the install's parent changed.
**Fix:** Copy `package.json` and the lockfile, install, *then* copy the source —
[page 03 · The dependency-install pattern](03-dependency-install-pattern.md).

**Symptom:** A rebuilt image still contains a package version that was patched
weeks ago.
**Cause:** `RUN apt-get update && apt-get install …` matched on its text. The
builder never re-ran it and never looked at what it had produced.
**Fix:** `docker build --no-cache-filter <stage>` when you need the refresh, and
schedule a periodic `--no-cache` rebuild rather than assuming daily builds are
picking up patches.

**Symptom:** CI misses the cache on every run although the source is identical.
**Cause:** The build cache is local to a builder, and a fresh CI runner has an
empty one — nothing to do with your Dockerfile.
**Fix:** Export and import it — `--cache-to` / `--cache-from`, **page 12 · Cache import and export** *(not written yet)*.
Check the ordering first, though; importing a cache for a badly ordered
Dockerfile buys very little.

**Symptom:** A colleague's identical checkout hits the cache and yours does not.
**Cause:** Something in the context differs that is not source — a local `dist/`,
a `.env`, a stray `node_modules` — and `COPY . .` hashes all of it.
**Fix:** A `.dockerignore` that excludes build output and local noise. The
difference is in the context, not in the Dockerfile.

## Interview questions

**★ What is the cache key for a Dockerfile instruction?**
The instruction's own text after `ARG` substitution, combined with the layer
produced by everything above it. For `ADD`, `COPY` and `RUN --mount=type=bind`
the builder additionally computes a checksum from the files' metadata, because
the text alone (`COPY . .`) would not distinguish two different contexts.

**★ Why does `RUN apt-get update` keep returning a stale package index?**
Because cache matching for `RUN` compares the command string and nothing else —
"cache checking doesn't look at the files in the container to determine a cache
match." The instruction produced a layer once; that layer is reused forever until
something above it changes or you pass `--no-cache` / `--no-cache-filter` /
prune the cache.

**★ One line in the middle of a Dockerfile changes. What rebuilds?**
That line and **everything after it**, in that stage — "once the cache is
invalidated, all subsequent Dockerfile commands generate new images." There is no
recovery further down, which is why instruction order is the single biggest
lever on build time.

**Does touching a file invalidate the `COPY` that copies it?**
No. `mtime` is explicitly excluded from the checksum, so a `git checkout` or a
fresh clone that rewrites timestamps without changing content still hits the
cache.

**Does changing a build secret's value force the `RUN` that uses it to re-run?**
No — secret *contents* are not part of the cache key, though the secret's id and
mount path are. If the new value must actually be used, change something that is
part of the key alongside it, such as a `--build-arg CACHEBUST`.

**Why might a Podman build ignore your `--cache-from`?**
Because `--cache-from` and `--cache-to` "are ignored unless `--layers` is
specified". `--layers` defaults to true, but `BUILDAH_LAYERS=false` in the
environment turns intermediate-layer caching off, and then the remote-cache flags
silently do nothing.

---

← Index: [Phase 4](README.md) · Next → [Instruction ordering](02-instruction-ordering.md)
