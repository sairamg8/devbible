---
title: "--target to stop at a stage"
sidebar_label: "06 · --target"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/),
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**`--target` names which stage the build should finish at, so one Dockerfile can
produce a development image, a test image and a production image without
duplication.** It is the flag that makes multi-stage more than a size trick.

## What it does

> "`--target` — Set the target build stage to build."
>
> "When building a Dockerfile with multiple build stages, `--target` can be used
> to specify an intermediate build stage by name as a final stage for the
> resulting image. The builder skips commands after the target stage."

Without it, the build finishes at the **last** stage in the file. With it, the
named stage becomes the result, and everything below is never executed.

```bash
docker build --target build -t hello .
```

Crucially, this is not "build everything and throw some away". BuildKit builds
only what the target depends on:

> "BuildKit only builds the stages that the target stage depends on."

So a stage that the target does not need costs nothing at all — which is what
makes the pattern below practical rather than wasteful.

## One Dockerfile, three images

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---------- dev: everything, plus the watcher ----------
FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

# ---------- test: dev plus a test command ----------
FROM dev AS test
RUN npm run lint
CMD ["npm", "test"]

# ---------- build: compile the artefact ----------
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---------- prod: the default, and the smallest ----------
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Three commands, three images, one file:

```bash
docker build --target dev  -t app:dev  .
docker build --target test -t app:test .
docker build              -t app:prod .     # prod is last, so it is the default
```

The `prod` build never executes `dev` or `test`, because `prod` depends on
`build` and `base` only. The stages are a graph, not a sequence
([page 04](04-multi-stage-builds.md)).

## Where it earns its keep

**Debugging a build failure.** When a stage fails, target the stage *before* it
and get a shell in exactly the state the failing command saw:

```bash
docker build --target build -t debug .
docker run --rm -it debug sh
```

That is far more useful than reading the failure log, because you can run the
failing command by hand with the real filesystem in front of you.

**Inspecting an intermediate artefact.** Target the build stage and look at what
it produced before the runtime stage copies a subset of it.

**Running tests in CI as a build.** A `test` stage that fails fails the build,
with no container to start and no exit code to plumb through:

```bash
docker build --target test .
```

**Development containers.** The `dev` target keeps dev dependencies and a file
watcher, while production stays lean — from the same file, so the two cannot
drift apart the way two Dockerfiles always do.

Compose can select the stage per service through the service's build
configuration, which is how a `compose.yaml` runs the `dev` target locally and
the same file builds `prod` in CI — that is **Phase 8 · Compose** *(another
chunk's phase, not written yet)*.

## The trap: the default target is "the last stage"

The default is positional, not semantic. Append a stage to the bottom of the file
— a scratch experiment, a debug variant, a stage someone added to try something —
and **that** becomes what a plain `docker build` produces. Nothing warns you.

Two habits that prevent it:

- **Keep the production stage last**, and treat that position as load-bearing.
- **Name the target explicitly in CI** — `--target prod` — so the pipeline does
  not depend on file order at all.

## The other trap: `--target` does not mean "only this stage"

It means "finish here". Everything the target *depends on* still builds:
`--target test` in the example above builds `base` and `dev` first, because
`test` is `FROM dev`. If you expected a lone stage to build in isolation, the
chain is the reason it did not.

## Podman

Same flag, same meaning, and the skipping behaviour matches BuildKit rather than
the legacy builder:

> "`--target` — Set the target build stage to build. When building a Containerfile
> with multiple build stages, `--target` can be used to specify an intermediate
> build stage by name as the final stage for the resulting image. Commands after
> the target stage is skipped."

Podman also exposes the skipping as an explicit flag —
**`--skip-unused-stages`**, "skip stages in multi-stage builds which don't affect
the target stage. (Default: **true**)" — so the default behaviour matches
BuildKit and you can turn it off if a stage has a side effect you actually want.

## Gotchas

**Symptom:** `docker build` with no `--target` suddenly produces a huge image.
**Cause:** A stage was appended below the production stage and became the default
target.
**Fix:** Move production back to the bottom, and pass `--target` explicitly in
CI.

**Symptom:** `--target test` builds more than the test stage.
**Cause:** The target's dependencies build too — `test` is `FROM dev`, so `dev`
and `base` build first.
**Fix:** Nothing to fix; it is correct. If you wanted isolation, the stage should
not be `FROM` another stage.

**Symptom:** The stage name is not found.
**Cause:** A typo, or the stage has no `AS <name>` and can only be referenced by
index.
**Fix:** Name every stage with `AS`. Index references are fragile for the same
reason.

**Symptom:** A `test` stage slows the production build.
**Cause:** A legacy builder, which "processes all stages of a Dockerfile leading
up to the selected `--target`".
**Fix:** Build with BuildKit, or under Podman leave `--skip-unused-stages` at its
default of true.

## Interview questions

**★ What does `--target` do, and what is the default?**
It sets which stage the build finishes at; the builder skips commands after that
stage. The default is the **last** stage in the file, which is positional — so
appending a stage silently changes what a plain build produces.

**★ Does `--target foo` build only stage `foo`?**
No. It builds `foo` and everything `foo` depends on, and skips everything else.
On BuildKit that skipping is real — stages the target does not depend on are not
built at all.

**★ How do you get one Dockerfile to serve dev, test and production?**
Give each its own stage, share the expensive setup in a common `base`, and select
with `--target`. Because unused stages are skipped, the extra stages cost the
production build nothing, and dev and prod cannot drift apart the way two
separate Dockerfiles do.

**How does `--target` help debug a failing build?**
Target the stage before the failure, run a shell in the resulting image, and
execute the failing command by hand against the real filesystem — much more
informative than the log.

**Is there a Podman equivalent?**
The same `--target` flag, plus `--skip-unused-stages` (default true) that makes
the stage-skipping explicit.

---

← Prev: [`RUN --mount=type=secret`](05-mount-type-secret.md) · Index: [Phase 4](README.md) · Next → [`COPY --from`](07-copy-from.md)
