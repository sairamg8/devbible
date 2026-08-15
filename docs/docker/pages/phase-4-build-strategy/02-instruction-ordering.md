---
title: "Instruction ordering"
sidebar_label: "02 · Instruction ordering"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — optimize cache usage](https://docs.docker.com/build/cache/optimize/),
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/),
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) and
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/).
> **No sandbox** — no console output on this page.

**Sort your Dockerfile by how often each line's input changes, not by how the
work reads.** Page 01 established that a miss cascades to the end of the stage;
this page is the single decision that follows from it, and it is most of build
performance.

## The rule, as the documentation states it

> "To optimize reusability, arrange instructions from least to most frequently
> changed."

and, from the optimization guide:

> "A change causes a rebuild for steps that follow… try to make expensive steps
> appear near the beginning of the Dockerfile."

Those two sentences are not quite the same rule, and holding both is the skill.
One is about **volatility**, the other about **cost**. You are ordering by the
product of the two.

## The two axes

Every instruction has a position on each:

| | What it means | Examples |
|---|---|---|
| **Volatility** | How often its input changes | Source files: every save. Lockfile: weekly. Base image: monthly. |
| **Cost** | What it costs to re-execute | `npm ci`: minutes. `apt-get install`: minutes. `WORKDIR`: nothing. |

The instruction you most want to protect is the one that is **expensive and
stable** — a dependency install. The instruction you must place last is the one
that is **cheap and volatile** — copying the source. Getting this backwards is
not a small inefficiency: it converts a build that should cost seconds into one
that reinstalls the world on every keystroke.

A useful way to hold it: **an instruction's real cost is its own cost plus the
cost of everything below it, multiplied by how often it misses.** A cheap
instruction placed high is expensive, because it drags the whole tail with it.

## What you are allowed to move

Ordering is constrained by two things, and only two:

1. **Real dependencies.** `RUN npm ci` needs `package.json` present, so the
   `COPY` of the manifest must precede it. You cannot install before the
   manifest exists.
2. **Instruction semantics.** `WORKDIR` affects the instructions *after* it.
   `USER` affects who runs the instructions after it — which is why installs
   happen as root and the `USER` switch comes near the end
   ([Phase 3 · USER](../phase-3-dockerfile/09-user.md)).

Everything else is free, and most Dockerfiles never exercise that freedom because
they were written in the order the author thought about the problem.

## The reordering, line by line

The unordered version — correct, and slow on every edit:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
ENV APP_VERSION=1.4.2
LABEL org.opencontainers.image.revision=$GIT_SHA
WORKDIR /app
COPY . .
RUN apk add --no-cache tini
RUN npm ci
RUN npm run build
USER node
CMD ["node", "dist/main.js"]
```

Four separate ordering faults, from worst to mildest:

**`COPY . .` above the install.** The one that matters. Any source edit
invalidates it and therefore invalidates `apk add`, `npm ci` and `npm run build`
below it. This is the fault that costs minutes.

**`apk add` below the `COPY`.** System packages change roughly never; they belong
directly under `FROM`, above anything that reads the context.

**`LABEL` with a git SHA near the top.** The SHA changes on every single commit,
so this line misses on *every* build and takes the entire file with it. Metadata
that carries a commit, a build number or a timestamp is the most volatile line in
the file and belongs at the **bottom**
([Phase 3 · LABEL and image metadata](../phase-3-dockerfile/12-label-and-metadata.md)).

**`ENV APP_VERSION` near the top.** Same problem, smaller blast radius: every
version bump invalidates everything below. Also note that "each `ENV` line creates
a new intermediate layer, just like `RUN` commands", so a stack of them near the
top is a stack of cache boundaries in the worst place.

Reordered by volatility, with nothing removed:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine

# 1. changes ~never — system packages
RUN apk add --no-cache tini
WORKDIR /app

# 2. changes ~weekly — dependencies, and only the manifest is copied
COPY package.json package-lock.json ./
RUN npm ci

# 3. changes constantly — the source
COPY . .
RUN npm run build

# 4. changes every commit — metadata, deliberately last
ARG GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV APP_VERSION=1.4.2
USER node
CMD ["node", "dist/main.js"]
```

Now a source edit misses at `COPY . .` and re-runs exactly two instructions plus
the four cheap ones at the bottom. `npm ci` is untouched, which is the entire
point. The manifest-first split is important enough to have its own page —
[page 03 · The dependency-install pattern](03-dependency-install-pattern.md).

## Grouping: one `COPY` per volatility class

The corollary of ordering is that a single `COPY` mixing volatility classes
destroys the ordering you just did. `COPY . .` is one hash over everything, so
the README, the CI config and the source all invalidate the same layer.

Split by **how often it changes**, not by what directory it lives in:

```dockerfile
COPY package.json package-lock.json ./     # weekly
RUN npm ci
COPY tsconfig.json ./                      # monthly
COPY src/ ./src/                           # constantly
```

Do not take this to an extreme. Every `COPY` is a layer, and thirty of them is
its own problem — file-by-file copying makes the Dockerfile fragile and the image
metadata bloated for a benefit you stop being able to measure. Three or four
groups is where the return flattens.

## Ordering across stages, and why it is different

In a multi-stage build, BuildKit builds a graph rather than a list, so **stages
that do not depend on each other build in parallel** and a stage nothing depends
on is not built at all. Within one stage the ordering rule above holds exactly.
Between stages, the question becomes which stage depends on which — and the way
to protect an expensive stage is to make sure your volatile source is not one of
its inputs. That is [page 04 · Multi-stage builds](04-multi-stage-builds.md) and
[page 08 · BuildKit](08-buildkit.md).

## Finding the first miss

You do not have to guess which line breaks the chain. Build with plain progress
output, where each step is printed in order with its status:

```bash
docker build --progress=plain -t app .
```

`--progress` takes `auto`, `none`, `plain`, `quiet`, `rawjson` or `tty`; `auto`
picks `tty` for a terminal and `plain` otherwise. `plain` is the one to use when
you are reading rather than watching — every step is on its own line, in order,
and the first step that is not reported as cached is the line to move.

:::note No output shown, deliberately
This track has no sandbox, so this page does not print what that command
produces. Run it against your own Dockerfile — the first non-cached step is the
answer, and it is nearly always a `COPY` that is one line too high.
:::

## Podman

Ordering is a property of the Dockerfile, not of the builder, so the rule is
**identical** under `podman build` and `buildah bud`. The only engine-specific
caveat carries over from page 01: intermediate-layer caching must be on
(`--layers`, default `true`) for good ordering to pay anything at all.

## Gotchas

**Symptom:** The build reinstalls dependencies even though only a component
changed.
**Cause:** A `COPY` of the whole context sits above the install.
**Fix:** Copy the manifest and lockfile first, install, then copy the source.

**Symptom:** Nothing is ever cached — every build runs every step from `FROM`.
**Cause:** A line near the top whose value changes each build: a `LABEL` or `ENV`
carrying a git SHA or build number, or an `ARG` consumed high in the file.
**Fix:** Move all commit- and build-derived metadata to the bottom of the stage.

**Symptom:** Reordering helped locally and did nothing in CI.
**Cause:** The CI runner starts with an empty build cache, so there was nothing to
hit. Ordering makes a cache *usable*; it does not create one.
**Fix:** Export and import the cache — [page 12 · Cache import and export](12-cache-import-export.md).

**Symptom:** Editing the README invalidates the dependency install.
**Cause:** One `COPY . .` hashing files of wildly different volatility together.
**Fix:** Group copies by how often they change, and keep documentation and CI
configuration out of the context entirely with `.dockerignore`
([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).

## Interview questions

**★ What is the ordering rule, and why does it work?**
Arrange instructions from least to most frequently changed, and put expensive
steps early. It works because a cache miss cascades — everything after the miss
re-executes — so the earlier an instruction sits, the more work its invalidation
destroys.

**★ Given a Dockerfile, how do you find the line to move?**
Ask which line's *input* changes most often relative to its position. In practice
it is almost always a `COPY` of the whole context placed above the dependency
install. `docker build --progress=plain` confirms it: the first step not reported
as cached is the one to move.

**★ Why does a `LABEL` carrying the git SHA belong at the bottom?**
Because its value changes on every commit, so it misses on every build, and every
instruction below it misses too. Placed last, it invalidates only itself. The
same argument applies to any `ENV` or `ARG` derived from a build number or
timestamp.

**What limits how freely you can reorder?**
Only real data dependencies — an install needs its manifest copied first — and
the instructions whose semantics apply downward, such as `WORKDIR` and `USER`.
Everything else can move.

**Is splitting `COPY . .` into many small copies always better?**
No. Split by volatility class — manifests, configuration, source — not per file.
Each `COPY` is a layer, and past three or four groups you add fragility and layer
count for a saving you can no longer observe.

**Does the ordering rule differ between Docker and Podman?**
No. It is a property of the Dockerfile. The only engine caveat is that Podman
must be caching intermediate layers at all (`--layers`, on by default) for the
ordering to buy anything.

---

← Prev: [How the layer cache decides](01-how-the-cache-decides.md) · Index: [Phase 4](README.md) · Next → [The dependency-install pattern](03-dependency-install-pattern.md)
