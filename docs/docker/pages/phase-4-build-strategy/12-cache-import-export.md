---
title: "Cache import and export"
sidebar_label: "12 · Cache import and export"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Docker — cache storage backends](https://docs.docker.com/build/cache/backends/),
> [Docker — builders](https://docs.docker.com/build/builders/),
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**The build cache lives on the builder, so a fresh CI runner has none — cache
export and import are how you carry it between machines.** Everything else in
this phase makes a *warm* build fast; this is what makes a cold one fast.

## The shape

```bash
docker buildx build --push -t <registry>/<image> \
  --cache-to   type=registry,ref=<registry>/<cache-image>[,parameters...] \
  --cache-from type=registry,ref=<registry>/<cache-image>[,parameters...] .
```

`--cache-to` writes the cache somewhere durable at the end of the build;
`--cache-from` reads it at the start. In CI you almost always pass both: import
what the last run produced, export what this run produced.

## The backends

| Backend | Where the cache goes |
|---|---|
| `inline` | Embedded into the image itself |
| `registry` | A separate image pushed to a dedicated location |
| `local` | A directory on the local filesystem |
| `gha` | GitHub Actions cache (beta) |
| `s3` | An AWS S3 bucket (unreleased) |
| `azblob` | Azure Blob Storage (unreleased) |

`registry` is the general-purpose answer: the cache is an artefact in the same
registry you already push to, reachable from any runner. `inline` is the
simplest — no second artefact to manage — but it can only carry what the final
image carries, which rules out multi-stage build caches. `gha` is the natural fit
inside GitHub Actions. `local` is for a builder with persistent disk between
runs.

**Which of these you can use depends on the driver**, and the documentation is
specific:

> "The default `docker` driver supports the `inline`, `local`, `registry`, and
> `gha` cache backends, but only if you have enabled the containerd image store.
> Other cache backends require you to select a different driver."

So a cache backend that "does not work" is usually a driver problem, not a
configuration one — `docker buildx create --driver docker-container --use`
([page 11](11-buildx-and-platforms.md)).

## `mode=min` versus `mode=max`

The single most consequential parameter, supported by every backend except
`inline`:

- **`mode=min`** (default) — "only layers exported to the final image are cached"
- **`mode=max`** — "all layers, including intermediate steps, are cached"

> "While `min` cache is typically smaller… `max` cache is more likely to get more
> cache hits."

For a **multi-stage build this is the difference between a useful cache and a
pointless one.** The expensive work — `npm ci`, the compile — happens in the
*build* stage, whose layers are not in the final image. Under `min`, none of that
is exported, so a cold CI run redoes all of it and only skips the trivial runtime
stage. `mode=max` is what you want in CI, at the cost of a larger cache artefact
and more upload time.

```bash
docker buildx build --push -t registry.example.com/app:1.0 \
  --cache-to   type=registry,ref=registry.example.com/app:buildcache,mode=max \
  --cache-from type=registry,ref=registry.example.com/app:buildcache .
```

## Where it fits with everything else

Three mechanisms, three different jobs — a fast pipeline uses all three:

| Mechanism | Makes the build fast by |
|---|---|
| [Instruction ordering](02-instruction-ordering.md) | Making misses **rare** |
| [Cache mounts](09-mount-type-cache.md) | Making a miss **cheap** |
| Cache import/export | Giving a **cold** builder a warm cache |

The order to apply them is the order of that table. Importing a cache into a
badly ordered Dockerfile buys very little, because the first `COPY . .` misses
and everything after it is invalidated regardless of what was imported.

:::note Cache mounts are not exported by default
Cache-mount contents are a different thing from layer cache. Do not assume
`--cache-to` carries your `~/.npm` directory between runners; treat cache mounts
as builder-local ([page 09](09-mount-type-cache.md)) and rely on ordering plus
layer cache import for cross-machine speed.
:::

## Practical notes

**The cache reference is a tag you own.** `app:buildcache` alongside `app:1.0` is
the common convention. It is an artefact in your registry — it costs storage, and
it should be subject to whatever retention policy the registry has.

**Branch topology matters.** Importing the cache from `main` when building a
feature branch is usually the right default: the branch's first build reuses
`main`'s dependency layers. Some pipelines import from both the branch and
`main`; `--cache-from` may be given more than once.

**Secrets do not travel.** Secret contents are not part of the cache
([page 05](05-mount-type-secret.md)), so an exported cache does not carry them.
That is a property to rely on, not to test — do not export cache from a build
whose layers you would not publish.

## Podman

Podman implements `--cache-from` and `--cache-to` against a repository:

> `--cache-from` — "repository to utilize as a potential cache source. When
> specified, Buildah tries to look for cache images in the specified repository
> and attempts to pull cache images instead of actually executing the build steps
> locally."
>
> `--cache-to` — "set this flag to specify a remote repository that is used to
> store cache images. Buildah attempts to push newly built cache image to the
> remote repository."

🔴 **Both flags are "ignored unless `--layers` is specified."** `--layers`
defaults to true, but a pipeline that sets `BUILDAH_LAYERS=false` gets no caching
and no warning that its carefully configured `--cache-from` did nothing.

Podman also has **`--cache-ttl`**, which limits cache use "to only consider
images with created timestamps less than *duration* ago" — with zero being
"equivalent to using `--no-cache`". Docker has no direct equivalent; it is a neat
way to say "cache, but nothing older than a day".

## Gotchas

**Symptom:** CI imports a cache and the build is still slow.
**Cause:** `mode=min` on a multi-stage build, so the build stage's layers — where
the expensive work happens — were never exported.
**Fix:** `mode=max` on `--cache-to`.

**Symptom:** `--cache-to type=registry` errors about the backend not being
supported.
**Cause:** The default `docker` driver without the containerd image store.
**Fix:** Enable the containerd image store, or create a `docker-container`
builder.

**Symptom:** The cache import succeeds but nothing hits.
**Cause:** The first instruction that reads the context misses — usually a
`COPY . .` too high in the file — so everything below it is invalidated whatever
was imported.
**Fix:** Fix the ordering first ([page 02](02-instruction-ordering.md)); cache
import amplifies a good Dockerfile, it does not rescue a bad one.

**Symptom:** A Podman pipeline's `--cache-from` appears to do nothing at all.
**Cause:** `--layers` is off, and the cache flags are then ignored silently.
**Fix:** Ensure `--layers` (or `BUILDAH_LAYERS=true`).

## Interview questions

**★ Why does a CI build not benefit from the build cache by default?**
Because the cache lives on the builder, and a fresh runner starts with an empty
one. `--cache-to` exports it to a durable backend and `--cache-from` imports it
on the next run.

**★ What is the difference between `mode=min` and `mode=max`?**
`min` (the default) exports only the layers that are in the final image; `max`
exports all layers including intermediate steps. For multi-stage builds `max` is
usually essential, because the expensive stages are precisely the ones not in the
final image.

**★ What are the cache backends and how do you choose?**
`inline`, `registry`, `local`, `gha`, and the unreleased `s3` and `azblob`.
`registry` for the general case, `gha` inside GitHub Actions, `local` for a
builder with persistent disk, `inline` when you want no second artefact and can
live without intermediate layers. Which are available depends on the driver — the
default `docker` driver supports `inline`, `local`, `registry` and `gha`, and only
with the containerd image store.

**Does cache import make ordering unnecessary?**
No. The imported cache is still invalidated by the first miss, so a `COPY . .`
above the install defeats it exactly as it defeats a local cache. Order first,
import second.

**What is Podman's equivalent, and what is the catch?**
The same `--cache-from` / `--cache-to` flags against a repository, plus
`--cache-ttl` for age limits. The catch is that both flags are ignored unless
`--layers` is specified.

---

← Prev: [`buildx` and platforms](11-buildx-and-platforms.md) · Index: [Phase 4](README.md) · Next → [Build args versus runtime env](13-build-args-vs-runtime-env.md)
