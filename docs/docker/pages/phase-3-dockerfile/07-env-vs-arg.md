---
title: "ENV versus ARG"
sidebar_label: "07 · ENV versus ARG"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the [Dockerfile reference — ENV](https://docs.docker.com/reference/dockerfile/#env),
> [Dockerfile reference — ARG](https://docs.docker.com/reference/dockerfile/#arg) and
> [Docker — build arguments](https://docs.docker.com/build/building/variables/).
> **No sandbox** — no console output on this page.

**`ARG` exists only during the build. `ENV` persists into the running
container.** Confusing them either leaks a secret or produces a variable that is
mysteriously empty.

## The distinction

| | `ARG` | `ENV` |
|---|---|---|
| Available at build time | ✅ | ✅ |
| Available at run time | ❌ | ✅ |
| In the final image config | ❌ | ✅ |
| Set from outside | `--build-arg NAME=value` | `-e NAME=value` at run time |
| **Visible in `docker history`** | 🔴 **Yes** | Yes (in the config) |

```dockerfile
ARG NODE_VERSION=24          # build only
ENV NODE_ENV=production      # build AND run
```

## Scoping — where the empties come from

Three rules, and every "my ARG is empty" is one of them.

**1. Scope starts at the declaration.** A reference before the `ARG` line
resolves to an empty string, silently.

**2. A pre-`FROM` `ARG` is global scope and is not inherited by stages.**
Redeclare it inside the stage that needs it (page 01):

```dockerfile
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim
ARG NODE_VERSION             # ← required to use it below
RUN echo "built on ${NODE_VERSION}"
```

**3. Each stage needs its own `ARG`.** Multi-stage builds do not carry build
arguments across a `FROM`:

```dockerfile
FROM node:24-slim AS build
ARG APP_VERSION
RUN echo "${APP_VERSION}" > /version

FROM node:24-slim
ARG APP_VERSION              # ← declare again, or it is empty here
LABEL org.opencontainers.image.version="${APP_VERSION}"
```

**And one precedence rule:** where both exist with the same name, `ENV` wins
inside `RUN` instructions.

## 🔴 `ARG` is not a secret mechanism

This is the load-bearing safety point of the page.

Build arguments are recorded in the image and visible to **anyone who has the
image**:

```bash
docker history --no-trunc myimage       # build args appear here
```

So this is a leak, permanently, for every copy of the image that was ever
pushed:

```dockerfile
# ❌ NEVER
ARG NPM_TOKEN
RUN npm ci
```

The correct mechanism is a secret mount, which exists for exactly this and puts
nothing in any layer:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

⚠️ **If a token has ever been passed as a build arg, rotate it.** Rebuilding
without it does not unpublish the image that already carried it.

## What each is actually for

**`ARG`** — parameterising the build itself: base image version, target
platform, build-time feature flags, a version string to bake into a label.

```dockerfile
ARG NODE_VERSION=24
ARG APP_VERSION=dev
FROM node:${NODE_VERSION}-slim
ARG APP_VERSION
LABEL org.opencontainers.image.version="${APP_VERSION}"
```

**`ENV`** — defaults for the running container, overridable at run time:

```dockerfile
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info
```

One `ENV` with several assignments is one config change rather than several, and
reads better than a stack of separate lines.

## The trap: `ENV` for build-time only

```dockerfile
# ❌ Now every container carries a variable nobody needs at run time
ENV BUILD_DEPS="gcc make"
RUN apt-get install -y $BUILD_DEPS && ... && apt-get purge -y $BUILD_DEPS
```

The variable persists in the image config forever. Use `ARG` for values only the
build needs — and remember that `ENV` values are visible in `docker inspect`,
which is another reason not to put anything sensitive there
([Phase 1, page 06](../phase-1-running-containers/06-environment.md)).

## Predefined build args

BuildKit provides several without declaration, useful for cross-compilation:

`TARGETPLATFORM` · `TARGETOS` · `TARGETARCH` · `BUILDPLATFORM` · `BUILDOS` ·
`BUILDARCH`

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.23 AS build
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /app .
```

This is how you cross-compile natively instead of paying for QEMU emulation
([Phase 2, page 10](../phase-2-images-and-registries/10-multi-arch.md)).
The proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) are also
predefined and are excluded from the build cache and from `docker history`.

## Podman

Same semantics. `podman build --build-arg` and `--secret` both work, and
`podman history` shows build args exactly as Docker's does — so the leak is
identical and the rule is the same.

## Gotchas

**Symptom:** An `ARG` is empty inside a stage.
**Cause:** Declared before `FROM` and not redeclared, declared in another stage,
or referenced above its own declaration.
**Fix:** Declare `ARG NAME` inside each stage that uses it, above first use.

**Symptom:** A token appears in `docker history`.
**Cause:** It was passed as a build arg.
**Fix:** Rotate it, then use `RUN --mount=type=secret`. The published image is
already compromised.

**Symptom:** A variable set with `--build-arg` is not present at run time.
**Cause:** Correct — `ARG` is build-only.
**Fix:** If it is needed at run time, set `ENV NAME=${ARG_NAME}` to promote it,
understanding that it then ships in the image config.

**Symptom:** `ENV` and `ARG` with the same name behave unexpectedly in a `RUN`.
**Cause:** `ENV` takes precedence over an `ARG` of the same name.
**Fix:** Do not reuse the name. It reads ambiguously even when it works.

## Interview questions

**★ What is the difference between `ARG` and `ENV`?**
`ARG` is build-time only and is not in the final image's environment. `ENV`
persists into the running container and is part of the image config. `ARG` is set
with `--build-arg`, `ENV` overridden with `-e` at run time.

**★ Why must you never pass a secret as a build argument?**
Build args are recorded in the image and readable with `docker history` by anyone
who has it. Use `RUN --mount=type=secret`, which exposes the value to one
instruction and leaves it in no layer. A token already passed as an arg must be
rotated.

**★ Why is an `ARG` declared before `FROM` empty inside the build?**
Pre-`FROM` args are global scope, usable in `FROM` lines only. Each stage must
redeclare `ARG NAME` to use it, and multi-stage builds do not carry args across
stages.

**How do you make a build-time value available at run time?**
Promote it: `ARG APP_VERSION` then `ENV APP_VERSION=${APP_VERSION}`. It then
lives in the image config — which is fine for a version string and wrong for
anything sensitive.

**What are `TARGETARCH` and `BUILDPLATFORM` for?**
Predefined build args describing the target and build platforms, used to
cross-compile natively in a multi-platform build instead of running the toolchain
under QEMU emulation.

---

← Prev: [Exec form versus shell form](06-exec-vs-shell-form.md) · Index: [Phase 3](README.md) · Next → [.dockerignore](08-dockerignore.md)
