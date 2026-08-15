---
title: "Where size actually goes"
sidebar_label: "01 · Where size actually goes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`docker image ls`](https://docs.docker.com/reference/cli/docker/image/ls/),
> [`docker system df`](https://docs.docker.com/reference/cli/docker/system/df/),
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) and
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
> **No sandbox** — no console output on this page.

**Almost all of a bloated image is one of four things, and only one of them is
your application.** Knowing which four turns "why is this 1.4 GB?" from a
mystery into a checklist.

## The four

| Source | Typical scale | Why it is there |
|---|---|---|
| **The base image** | 5 MB – 1 GB | You chose it once and never revisited it |
| **Package manager caches** | 20 – 300 MB | Downloaded, installed, and never cleaned in the same layer |
| **Dev dependencies** | 100 – 900 MB | Installed for the build, never removed |
| **The build toolchain** | 100 MB – 1 GB | Compilers and headers left in the shipped stage |

Your application code is almost never the answer. A Node service is a few
megabytes of JavaScript; if the image is 1.2 GB, 1.19 GB of it is on that list.

## 1. The base image

The floor of your image is whatever you put after `FROM`, and the range is
enormous — from a handful of megabytes for a minimal distribution to close to a
gigabyte for a full language image with build tooling included.

Two things worth separating, because they get conflated:

- **A `-slim` variant** is the same distribution with the documentation, headers
  and optional packages stripped. Low risk, immediate saving.
- **A different libc** (Alpine/musl) is a genuinely different runtime, and is a
  trade rather than a free win — that is topic 05 of this phase.

The base is also the part you did not write, and therefore the part whose
vulnerabilities are not yours to fix — which is why it turns up again in the
supply-chain topics later in this phase.

## 2. Package manager caches

The classic. A package manager downloads an archive, installs from it, and keeps
the archive. If the cleanup is not in the **same layer** as the install, the
bytes stay in the image forever, because a later deletion adds a layer that
hides files rather than removing them
([Phase 2 · layers](../phase-2-images-and-registries/04-layers.md)).

The rule from the best-practices guide — "always combine `RUN apt-get update`
with `apt-get install` in the same `RUN` statement" — exists for correctness as
well as for size, and the cleanup belongs in the same statement:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

The alpine equivalent is `apk add --no-cache`, which never writes the index in
the first place. The modern alternative for both is a cache mount, which keeps
the cache *outside* the layer entirely
([Phase 4 · `RUN --mount=type=cache`](../phase-4-build-strategy/09-mount-type-cache.md)) —
faster builds and no image cost at all.

`--no-install-recommends` deserves its own mention: apt pulls "recommended"
packages by default, and in a container almost none of them are wanted.

## 3. Dev dependencies

`npm ci` installs everything in `package.json`, including TypeScript, the test
runner, the linter, the bundler and their transitive trees. All of it is needed
to *build* and none of it to *run*.

Two ways to not ship it, both from Phase 4:

- **A separate runtime install** — `npm ci --omit=dev` in a runtime stage that
  starts from a clean base
  ([Phase 4 · multi-stage builds](../phase-4-build-strategy/04-multi-stage-builds.md)).
- **A prune in the same layer** — `npm prune --omit=dev` chained onto the install
  with `&&`. It works, and it is strictly worse than staging, because the
  intermediate state still existed in a layer of a single-stage build.

## 4. The build toolchain

The heaviest single item when it is present. `golang:1.26`, `node:22` with
`build-essential`, `python:3.13` with `gcc` — each of them exists to produce an
artefact, and each of them is hundreds of megabytes that the artefact does not
need.

Multi-stage removes this completely, and it is the single largest reduction
available to most images: build in the toolchain stage, `COPY --from` the
artefact into a clean runtime base, ship nothing else.

## What "size" means when you measure it

Before optimising, know what the number is:

> "The `SIZE` is the cumulative space taken up by the image and all its parent
> images."

So the `docker images` figure is the **uncompressed total including everything
inherited from the base** — not the download size, and not this image's own
contribution. Two images built from the same base each report the full base in
their size, while on disk that base exists once. Adding up the column
overstates real usage, sometimes wildly.

`docker system df -v` reports the honest split:

- **SHARED SIZE** — "the amount of space that an image shares with another one
  (i.e. their common data)"
- **UNIQUE SIZE** — "the amount of space that's only used by a given image"

Which gives the practical rule: **if every one of your images shares a base,
shrinking that base helps everything at once, and it only helps once.**
Registry transfer is different again — layers are compressed, and a layer the
puller already has is not transferred at all.

Layer-by-layer attribution is `docker history`, which is topic 04 of this phase.

## The order to attack it

Effort against saving, in the order that actually pays:

1. **Multi-stage** — removes the toolchain and dev dependencies together.
   Usually the largest single win and often the only change needed.
2. **`.dockerignore`** — stops `node_modules`, `.git` and build output entering
   the context, so a broad `COPY` cannot bring them in
   ([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).
3. **Clean in the same layer**, or use cache mounts — reclaims the package
   caches.
4. **A slimmer base** — real, and the one with a compatibility cost, so it comes
   last rather than first.

Doing (4) first is the common mistake: switching to Alpine to save 80 MB while a
900 MB toolchain is still in the final stage, and inheriting musl's compatibility
questions for nothing.

## Podman

Sizes and their causes are properties of the image, not of the engine, so
everything here applies unchanged. `podman images` and `podman system df` report
the same information with the same meaning.

## Gotchas

**Symptom:** A `RUN rm -rf` of a large directory did not reduce the image.
**Cause:** The deletion is in a later layer; the bytes remain in the earlier one.
**Fix:** Delete in the same `RUN` that created the files, or avoid creating them
in the shipped stage at all.

**Symptom:** The image is huge although the application is small.
**Cause:** Toolchain and dev dependencies in the final stage.
**Fix:** Multi-stage — build in one stage, ship the artefact from a clean base.

**Symptom:** `docker images` totals suggest far more disk use than the machine
shows.
**Cause:** The column includes all parent layers, so shared bases are counted
once per image.
**Fix:** `docker system df -v` for SHARED and UNIQUE sizes.

**Symptom:** Switching to Alpine barely helped.
**Cause:** The base was never the dominant term.
**Fix:** Measure with `docker history` first, and fix the biggest layer.

## Interview questions

**★ Where does image size actually come from?**
Four places: the base image, package-manager caches left in a layer, dev
dependencies installed for the build, and the build toolchain left in the shipped
stage. Application code is almost never significant.

**★ Why does deleting files in a later `RUN` not shrink the image?**
Because layers are additive — the deletion records a whiteout in a new layer
while the bytes remain in the earlier one. Cleanup must happen in the same
instruction that created the files, or the files must never enter the shipped
stage.

**★ What does the `SIZE` column in `docker images` actually report?**
"The cumulative space taken up by the image and all its parent images" —
uncompressed, including everything inherited. It is not the download size and not
this image's unique contribution; summing it across images that share a base
overstates disk usage. `docker system df -v` gives SHARED and UNIQUE sizes.

**In what order would you attack a 1.4 GB image?**
Multi-stage first (toolchain and dev dependencies), then `.dockerignore`, then
same-layer cleanup or cache mounts for package caches, and only then a slimmer
base — which is the one with a compatibility cost.

**Why is `--no-install-recommends` worth adding?**
Apt installs recommended packages by default, and in a container they are almost
never wanted. It is one flag for a consistent saving with no behavioural risk to
the packages you actually asked for.

---

← Index: [Phase 5](README.md) · Next → [The classic mistakes](02-classic-mistakes.md)
