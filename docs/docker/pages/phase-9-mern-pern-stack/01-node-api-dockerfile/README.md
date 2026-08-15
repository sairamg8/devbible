---
title: "Containerising a Node/Express API"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — Containerize a Node.js application](https://docs.docker.com/guides/nodejs/containerize/),
> [the Dockerfile reference](https://docs.docker.com/reference/dockerfile/),
> [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci) and
> [the Node.js `process` documentation](https://nodejs.org/api/process.html).
> **No sandbox** — no console output on this page.

**Every technique in Part 2 exists to produce this one file, and every mistake it
avoids has already cost somebody a night.** Phases 3, 4 and 5 taught the
instructions, the cache and the size; this topic spends them on the actual
artefact — a Node API image that is small, rebuilds fast, runs as nobody, and
stops when you ask it to.

## The file, whole

```dockerfile
# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ---------- deps: production dependencies only ----------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --omit=dev

# ---------- build: everything needed to compile ----------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci
COPY . .
RUN npm run build

# ---------- runtime: what actually ships ----------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Three stages, and each one exists for a reason the next chunk defends: `deps`
installs only what runs, `build` installs everything and throws the toolchain
away, `runtime` copies two directories and nothing else.

⚠️ **This is the shape, not a template to paste unread.** A JavaScript-only
project has no `build` stage; a project using `pnpm` or `yarn` changes the
install lines; a project with native modules changes the base image. What does
not change is the reasoning, which is what the two chunks are about.

## The chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The build](01-the-build.md)** | Stage by stage: why `npm ci` and not `npm install`, the cache and bind mounts, why `package*.json` is copied before the source, what `.dockerignore` has to contain |
| 02 | **[The runtime](02-the-runtime.md)** | What ships and what must not: the non-root `node` user, exec form and signals, `NODE_ENV`, `EXPOSE`, healthchecks, and configuration at run time |

## The five properties to check

A Node API image is right when all five hold. Each is a section in one of the
chunks, and each has a failure mode you can name:

| Property | The failure when it is missing |
|---|---|
| **Small** | The compiler, the test framework and the source tree ship to production |
| **Cached** | Every one-line code change reinstalls every dependency |
| **Reproducible** | The image built in CI has different dependency versions from yours |
| **Non-root** | A container escape starts as root; policies that require a numeric UID reject the image |
| **Stops cleanly** | Every deploy takes the full grace period and drops in-flight requests |

## Where this connects

- **[Phase 3 · The Dockerfile](../../phase-3-dockerfile/README.md)** is the
  instruction reference this file uses —
  [`CMD` versus `ENTRYPOINT`](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md),
  [exec versus shell form](../../phase-3-dockerfile/06-exec-vs-shell-form.md),
  [`USER`](../../phase-3-dockerfile/09-user.md) and
  [`.dockerignore`](../../phase-3-dockerfile/08-dockerignore.md).
- **[Phase 4 · Build strategy](../../phase-4-build-strategy/README.md)** is why
  the install lines look like that — layer caching, multi-stage builds and
  `RUN --mount`.
- **[Phase 5 · Image quality](../../phase-5-image-quality/README.md)** is the
  size and supply-chain argument, including the `-slim` versus Alpine versus
  distroless choice.
- **[Phase 10 · PID 1](../../phase-10-production/01-pid-1/README.md)** and
  **[graceful shutdown](../../phase-10-production/02-graceful-shutdown/README.md)**
  are the production consequences of the last two lines of this Dockerfile.

---

← Prev: **Phase 8 · `--scale` and the honest limits** — [index](../../phase-8-compose/17-scale-and-limits.md) · Index: [Phase 9](../README.md) · Start → [The build](01-the-build.md)
