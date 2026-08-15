---
title: "FROM"
sidebar_label: "01 · FROM"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — FROM](https://docs.docker.com/reference/dockerfile/#from),
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/) and
> [Docker — base images](https://docs.docker.com/build/building/base-images/).
> **No sandbox** — no console output on this page.

**`FROM` sets the base image and starts a build stage.** It is the first
instruction in almost every Dockerfile, your largest dependency, and — because a
Dockerfile may have several — the mechanism behind multi-stage builds.

## The forms

```dockerfile
FROM node:24-slim                          # a base image
FROM node:24-slim AS build                 # a NAMED stage
FROM --platform=linux/amd64 node:24-slim   # pin the platform
FROM scratch                               # start from nothing
```

`AS <name>` names the stage so a later stage can copy from it. Naming is free and
makes the file readable; the alternative is referring to stages by index, which
breaks the moment somebody inserts one.

## `ARG` may come before `FROM`

The only instruction allowed before `FROM` is `ARG`, and it exists so the base
image itself can be parameterised:

```dockerfile
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim
```

🔴 **A pre-`FROM` `ARG` is not visible inside the stage.** It is global-scope,
usable in `FROM` lines; to use it after `FROM`, redeclare it:

```dockerfile
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim
ARG NODE_VERSION            # redeclared - now usable in this stage
RUN echo "built on Node ${NODE_VERSION}"
```

Without the redeclaration the variable expands to an empty string, with no
error. Page 07 covers the scoping rules in full; this is the case that bites in
`FROM`.

## Several `FROM`s: multi-stage

Each `FROM` starts a new stage with a fresh filesystem. Only the **last** stage
becomes the image; earlier ones exist to produce artefacts the last stage copies:

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim                 # a clean filesystem
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev             # production dependencies only
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]
```

The compiler, the dev dependencies and the source are all in the first stage and
none of them ship. This is the single most effective image-size technique, and
Phase 4 covers it properly.

## What `FROM` inherits

The new stage starts with the base image's filesystem **and** its config: `ENV`,
`WORKDIR`, `USER`, `ENTRYPOINT`, `CMD`, `EXPOSE`, `VOLUME`, `STOPSIGNAL`.

Three consequences that surprise people:

- **A base image's `ENV` is present in yours.** `docker image inspect` on the
  base tells you what you inherited ([Phase 2, page 07](../phase-2-images-and-registries/07-image-config.md)).
- **A base image's `USER` applies.** If the base ends with a non-root user, your
  `RUN` instructions run as that user and may fail to install packages. The fix
  is `USER root` before them and a non-root `USER` at the end — page 09.
- **A base image's `ENTRYPOINT` applies** unless you override it, which is why
  some images seem to ignore your `CMD`.

## Pin it

Everything in [Phase 2, page 02](../phase-2-images-and-registries/02-tags-vs-digests.md)
applies here, and this is where it is written down:

```dockerfile
# Readable AND reproducible
FROM node:24.9.0-slim@sha256:9f2c…
```

Fully qualify for Podman's benefit
([Phase 2, page 01](../phase-2-images-and-registries/01-image-references.md)) —
`docker.io/library/node:...` — and automate the digest bump with Renovate or
Dependabot so pinning does not become staleness.

## `FROM scratch`

An empty base. No shell, no libc, no CA certificates, no `/tmp`. Only for
statically linked binaries, and you must supply anything the program expects:

```dockerfile
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /app/server /server
ENTRYPOINT ["/server"]
```

The CA certificate line is the one everybody forgets, and the symptom is TLS
failures against every HTTPS endpoint.

## Podman

`FROM` behaves identically — `podman build` and `buildah` parse the same
Dockerfile. The only practical difference is short-name resolution, so write the
registry into the reference.

## Gotchas

**Symptom:** A pre-`FROM` `ARG` is empty inside the build.
**Cause:** Pre-`FROM` args are global scope and are not inherited by stages.
**Fix:** Redeclare `ARG NAME` after the `FROM` that needs it.

**Symptom:** `RUN apt-get install` fails with permission errors and no `USER` is
in your Dockerfile.
**Cause:** The base image ends with a non-root `USER`, which you inherited.
**Fix:** `USER root` before the install, and set the non-root user again at the
end.

**Symptom:** Your `CMD` is ignored and the container runs something else.
**Cause:** The base image sets an `ENTRYPOINT`, so your `CMD` became its
arguments.
**Fix:** Override with `ENTRYPOINT` — including `ENTRYPOINT []` to clear it.
Page 05.

**Symptom:** A `scratch`-based image cannot make HTTPS requests.
**Cause:** No CA certificate bundle.
**Fix:** `COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/`.

## Interview questions

**★ What does `FROM` do beyond choosing a base image?**
It starts a build stage. A Dockerfile can have several, and only the last becomes
the image — which is what multi-stage builds exploit. It also inherits the base's
config: `ENV`, `USER`, `WORKDIR`, `ENTRYPOINT`, `CMD` and more.

**★ Why is a pre-`FROM` `ARG` empty inside the build?**
Pre-`FROM` args are global scope, usable in `FROM` lines only. To use one inside
a stage you must redeclare `ARG NAME` after that `FROM`. Otherwise it expands to
an empty string with no error.

**★ What does a multi-stage build buy you?**
The final image contains only what the last stage put there, so compilers, dev
dependencies and source never ship. It is the most effective size technique and
also removes build tooling from the runtime attack surface.

**When is `FROM scratch` appropriate, and what must you add?**
Only for statically linked binaries. You must supply anything the program
assumes — most commonly the CA certificate bundle, without which every HTTPS call
fails.

**Why can a base image's `USER` break your build?**
Because it applies to your instructions too. If the base ends as a non-root user,
your `RUN apt-get install` runs as that user and fails. Set `USER root` for the
install and drop back to a non-root user at the end.

---

← Index: [Phase 3](README.md) · Next → [RUN](02-run.md)
