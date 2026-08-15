---
title: "Multi-stage builds"
sidebar_label: "04 · Multi-stage builds"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/),
> [the Dockerfile reference — `FROM` and `COPY --from`](https://docs.docker.com/reference/dockerfile/),
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**One stage has the toolchain and does the work; the next starts from a clean
base and receives only the artefact.** Everything the build needed — compilers,
headers, dev dependencies, the source itself — is left behind in a stage that is
never shipped.

## The problem it solves

A single-stage build ships everything it touched. Compile a Go binary in
`golang:1.26` and the image contains the Go toolchain — hundreds of megabytes to
run a file that is a few. Build a TypeScript service and the image contains
TypeScript, the test runner, the linter and every dev dependency, forever,
because deleting them in a later instruction does not shrink the image
([Phase 2 · layers](../phase-2-images-and-registries/04-layers.md)).

The instinct — "delete the toolchain at the end" — cannot work. Layers are
additive; a later `RUN rm` adds a layer that hides files without removing their
bytes. Multi-stage sidesteps the problem entirely by **never putting them in the
shipped stage at all**.

## The mechanism

> "Multi-stage builds… use multiple `FROM` statements in your Dockerfile. Each
> `FROM` instruction can use a different base, and each of them begins a new
> stage of the build. You can selectively copy artifacts from one stage to
> another, leaving behind everything you don't want in the final image."

The canonical example from the documentation:

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.26 AS build
WORKDIR /src
COPY . .
RUN go build -o /bin/hello ./main.go

FROM scratch
COPY --from=build /bin/hello /bin/hello
CMD ["/bin/hello"]
```

Two `FROM`s, two stages. The final image is whatever the **last** stage
produces — `scratch` plus one binary. The Go toolchain existed during the build
and is in no layer of the result.

**Name your stages with `AS`.** The documentation notes that referring to a stage
by index (`COPY --from=0`) works but is fragile: "named stages ensure references
remain valid if the Dockerfile is reorganized." Adding a stage in the middle
silently renumbers every index below it.

## The boundary is real

The single most useful thing to internalise: **nothing crosses between stages
except what you explicitly `COPY --from`.** Not the working directory, not the
environment variables, not the user, not the installed packages.

| Set in the build stage | Present in the runtime stage? |
|---|---|
| `RUN apt-get install gcc` | ✗ — a different filesystem entirely |
| `ENV NODE_ENV=production` | ✗ — set it again if the runtime needs it |
| `WORKDIR /src` | ✗ — the new stage starts from its own base's config |
| `USER build` | ✗ |
| `COPY --from=build /app/dist ./dist` | ✓ — the only thing that crosses |

Each stage inherits its configuration from **its own** `FROM` base, exactly as a
single-stage build would ([Phase 3 · FROM](../phase-3-dockerfile/01-from.md)).
This is the cause of most "it worked in the build stage" confusion: the runtime
stage is not a continuation, it is a fresh start with one directory copied in.

## A worked Node service

Combining the pattern with [page 03](03-dependency-install-pattern.md):

```dockerfile
# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                      # dev dependencies included — the build needs them
COPY . .
RUN npm run build               # produces ./dist

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev           # production dependencies only
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Note what is **not** done: the runtime stage does not copy `node_modules` from
the build stage. It installs its own, production-only, from the same lockfile.
Copying the build stage's `node_modules` would bring every dev dependency across
and defeat the split. (Copying it and then pruning is the other option, and it is
worse — you pay the copy and keep the layer.)

Both stages run `npm ci`, which looks wasteful and is not: they are independent
cache chains, both protected by the manifest-first ordering, and the runtime
install is the smaller of the two.

## Stages are a graph, not a list

BuildKit resolves stages as a dependency graph, with two consequences worth
knowing:

**Independent stages build in parallel.** Two stages that do not reference each
other run at the same time, so a build with a separate asset pipeline and API
compile is bounded by the slower of the two, not their sum.

**Unused stages are skipped.** The documentation is explicit about the
difference:

> "BuildKit only builds the stages that the target stage depends on… the legacy
> Docker Engine builder processes all stages of a Dockerfile leading up to the
> selected `--target`."

So a `test` stage that nothing depends on costs nothing in a production build —
which is what makes one Dockerfile serving dev, test and prod practical
([page 06 · `--target`](06-target.md)).

A stage may also be *based* on an earlier stage, which is how you share expensive
setup between several:

```dockerfile
FROM alpine:latest AS builder
RUN apk --no-cache add build-base

FROM builder AS build1
COPY source1.cpp source.cpp
RUN g++ -o /binary source.cpp

FROM builder AS build2
COPY source2.cpp source.cpp
RUN g++ -o /binary source.cpp
```

`build1` and `build2` share `builder`'s layers and then diverge — and, being
independent of each other, build in parallel.

## What it does and does not do for the cache

**Size and cache are separate wins, and multi-stage only guarantees the first.**
The build stage's layers are still cached locally — that is what makes the second
build fast — they are simply not part of the published image. So:

- Ordering rules still apply **inside** each stage; a badly ordered build stage is
  just as slow as a badly ordered single-stage file.
- The final image is unaffected by how many layers the build stage created.
- On a fresh runner with a cold cache, the build stage is rebuilt in full. Cache
  export can carry build-stage layers too — **page 12 · Cache import and export**
  *(not written yet)*.

## The trap: native modules and mismatched bases

If you *do* copy `node_modules` (or any compiled artefact) between stages, the
two bases must be compatible. A native module compiled against glibc in
`node:22` will not load in `node:22-alpine`, which is musl — and the failure
appears at container start, not at build time, as a missing shared object.

The rule: **`COPY --from` across different base images is only safe for
artefacts with no runtime linkage** — a static binary, a bundle of JavaScript, a
directory of compiled CSS. Anything compiled against a libc must be built on the
base it will run on.

## Podman

Multi-stage builds work the same way, and the stage-skipping behaviour matches
BuildKit rather than the legacy builder: `podman build` documents
**`--skip-unused-stages`** as "skip stages in multi-stage builds which don't
affect the target stage. (Default: **true**)", and `--target` as setting the
final stage, after which "commands after the target stage is skipped".

The `COPY --from=<image>` form pulls that image, so it obeys Podman's short-name
resolution rules — spell external images fully qualified
(`docker.io/library/nginx:1.29`) in a Dockerfile that must build under both
engines.

## Gotchas

**Symptom:** The final image still contains the compiler or the dev
dependencies.
**Cause:** The `COPY --from` pulled a directory that contains them, or the
"runtime" stage is `FROM build` rather than from a clean base.
**Fix:** Start the last stage from the runtime base and copy only the artefact.

**Symptom:** `WORKDIR`, an `ENV` or a `USER` set in the build stage has no effect
at runtime.
**Cause:** Stage configuration does not cross the boundary; only copied files do.
**Fix:** Set them again in the final stage. This is expected, not a bug.

**Symptom:** The container starts and dies with an error about a missing shared
library.
**Cause:** A native module or binary was compiled in one stage's base and copied
into an incompatible one — classically glibc → musl.
**Fix:** Build on the base you ship on, or ship a fully static artefact.

**Symptom:** A `test` stage in the Dockerfile slows the production build.
**Cause:** The legacy builder, which processes every stage up to the target. With
BuildKit — and with Podman's default `--skip-unused-stages` — it would be
skipped.
**Fix:** Build with BuildKit (the default in Docker Engine 29.x) and confirm you
are not on a legacy builder.

## Interview questions

**★ Why can't you just delete the build toolchain at the end of a single-stage
build?**
Because layers are additive. A later `RUN rm` writes a layer that hides the files
but does not remove their bytes from the earlier layer, so the image still
carries them. Multi-stage avoids the problem by never putting them in the shipped
stage.

**★ What crosses from one stage to the next?**
Only what you `COPY --from`. Environment variables, working directory, user and
installed packages do not — each stage inherits configuration from its own `FROM`
base.

**★ What is the difference between BuildKit and the legacy builder for stages?**
BuildKit builds only the stages the target depends on, and builds independent
stages in parallel; the legacy builder processes all stages leading up to the
target. That is why an unused `test` stage is free on BuildKit and not on the
legacy builder. Podman defaults to `--skip-unused-stages=true`, which is the same
behaviour.

**Why not copy `node_modules` from the build stage into the runtime stage?**
It contains dev dependencies, which is the thing you were trying to leave behind,
and native modules in it may be linked against the build stage's libc. Install
production dependencies fresh in the runtime stage from the same lockfile.

**Does multi-stage make builds faster?**
Not directly — it makes images smaller. Build-stage layers are still cached
locally, so a warm rebuild is fast, but a cold build does all the same work.
Speed comes from ordering and from cache reuse; size comes from staging.

**How do you refer to a stage, and why prefer names?**
`COPY --from=<name>`, `--from=<index>`, or `--from=<image>` for an external
image. Prefer `AS <name>`: indices shift when a stage is inserted, silently
copying from the wrong place.

---

← Prev: [The dependency-install pattern](03-dependency-install-pattern.md) · Index: [Phase 4](README.md) · Next → [`RUN --mount=type=secret`](05-mount-type-secret.md)
