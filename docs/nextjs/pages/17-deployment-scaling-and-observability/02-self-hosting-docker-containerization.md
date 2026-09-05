---
title: "output: 'standalone' traces your dependency graph and copies only what the server actually loads — but it deliberately leaves out public/ and .next/static, and every broken self-hosted Docker image starts with someone not knowing that"
sidebar_label: "02 · Self-hosting: standalone and Docker"
sidebar_position: 4
description: "Output file tracing and what the standalone folder really contains, the official multi-stage Dockerfile line by line, PORT and HOSTNAME, sharp on glibc, outputFileTracingIncludes for the native modules static analysis cannot see, and the exec-form CMD that graceful shutdown depends on."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) (`version: 16.3.4`, `lastUpdated: 2025-10-08`), [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) (`lastUpdated: 2026-08-25`), [Deploying](https://nextjs.org/docs/app/getting-started/deploying) (`2026-08-25`) and [Deploying to platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) (`2026-03-30`), the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated: 2026-08-25`), and the official [`examples/with-docker` Dockerfile](https://github.com/vercel/next.js/tree/canary/examples/with-docker) fetched 2026-09-04.
> Target: **Next.js 16.3.4** · Node `>= 20.9`. Documentation-verified, **no sandbox run**, no image sizes and no timings.

**Self-hosting Next.js is not hard, and the documentation says so in an unusually blunt sentence: to run Next.js your platform needs a Node.js server, that's it. What is hard is the container, and specifically `output: 'standalone'` — a mode that runs `@vercel/nft` over your import graph, works out which files the server actually touches, and copies just those into `.next/standalone` along with a minimal `server.js`. It is excellent, and it has one documented behaviour that produces more broken deployments than everything else in this chapter combined: it does not copy `public/` or `.next/static`, on the grounds that a CDN should be serving them. Nothing warns you. `next build` succeeds, the image builds, the container starts, and the site loads with no CSS. This page is the mechanism, the official Dockerfile with every non-obvious line explained, and the failures that are invisible until production.**

## The baseline: what Next.js actually requires

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*

> *"A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*

> *"The only additional dependency is the `sharp` package, which is required for Image Optimization."*

And the deployment-options table confirms there is no feature penalty for containers:

| Deployment option | Feature support |
|---|---|
| Node.js server | All |
| Docker container | **All** |
| Static export | Limited |
| Adapters | Varies |

Everything that follows is about *size, startup and correctness under orchestration*, not about capability. If someone tells you a feature "only works on Vercel", the documented answer is the table above plus [17 · Deploying beyond Vercel](17-choosing-a-deployment-target-beyond-vercel.md).

## Output file tracing, and what standalone is

> *"During `next build`, Next.js will use `@vercel/nft` to statically analyze `import`, `require`, and `fs` usage to determine all files that a page might load."*

That trace is written to `.nft.json` files whether or not you opt into standalone. `output: 'standalone'` is the mode that *acts* on it:

> *"Next.js can automatically create a `standalone` folder that copies only the necessary files for a production deployment including select files in `node_modules`."*

```js
// next.config.js
module.exports = {
  output: 'standalone',
}
```

> *"This will create a folder at `.next/standalone` which can then be deployed on its own without installing `node_modules`."*

Note the consequence: **the runtime image never runs an install.** No lockfile resolution at deploy time, no network access needed, no chance of a different transitive version than the one you built against.

### 🔴 The two folders it leaves behind

> *"Additionally, a minimal `server.js` file is also output which can be used instead of `next start`. This minimal server does not copy the `public` or `.next/static` folders by default as these should ideally be handled by a CDN instead, although these folders can be copied to the `standalone/public` and `standalone/.next/static` folders manually, after which `server.js` file will serve these automatically."*

Two things in that sentence matter equally. First, the omission is deliberate — a CDN is the intended home for both. Second, `server.js` *will* serve them if you put them there, so the local fix is a copy, not a code change:

```bash
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js
```

The symptom when you skip it is uniquely misleading: the HTML renders (it comes from the server), so the page is not blank — it is unstyled, with 404s for every `/_next/static/*` chunk and every file from `public/`. It reads like a routing problem and it is a copy problem.

### The two environment variables `server.js` reads

> *"If your project needs to listen to a specific port or hostname, you can define `PORT` or `HOSTNAME` environment variables before running `server.js`. For example, run `PORT=8080 HOSTNAME=0.0.0.0 node server.js` to start the server on `http://0.0.0.0:8080`."*

`HOSTNAME=0.0.0.0` is not optional in a container. A server bound to a loopback interface is unreachable from outside the container's network namespace, and the failure is a connection refused from the health check — with a perfectly healthy process inside.

## The official Dockerfile, explained

This is the upstream `examples/with-docker` Dockerfile. Three stages: install, build, run. The lines worth understanding are annotated.

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=24.13.0-slim

# ---------- 1. dependencies ----------
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app
# Lockfiles first, so a source-only change reuses this layer.
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
  elif [ -f yarn.lock ]; then corepack enable yarn && yarn install --frozen-lockfile --production=false; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else echo "No lockfile found." && exit 1; fi

# ---------- 2. build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ---------- 3. run ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=node:node /app/public ./public

# The prerender cache is written at runtime, so .next must exist and be
# writable by the unprivileged user before the server starts.
RUN mkdir .next
RUN chown node:node .next

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

Four lines deserve a second look.

**`COPY .../public` and `COPY .../.next/static`** are the manual copy the `output` reference describes, expressed as Docker layers. Delete either and you get the unstyled-site failure above.

**`RUN mkdir .next` / `RUN chown node:node .next`** exist because the standalone copy lands *into* `.next` and the running server writes the prerender cache there. The upstream comment is literally `# Set the correct permission for prerender cache`. Drop these and ISR fails at runtime with permission errors on a container that started cleanly — and only on the routes that revalidate, which may be hours later.

**`USER node`** is the reason the two lines above are needed at all. Running as root would make them unnecessary and the image worse.

**The build cache mount is a deliberate trade, not a free win.** The upstream comment states it exactly:

> *"If you want to speed up Docker rebuilds, you can cache the build artifacts by adding: `--mount=type=cache,target=/app/.next/cache`. This caches the `.next/cache` directory across builds, but it also prevents `.next/cache/fetch-cache` from being included in the final image, meaning cached fetch responses from the build won't be available at runtime."*

So: faster builds, colder first requests. If you want the build's fetch cache to ship, the runner stage has a commented line for that too — `COPY --from=builder --chown=node:node /app/.next/cache ./.next/cache`.

## `sharp`, and the glibc allocator footnote

Image optimization works self-hosted with no configuration:

> *"Image Optimization through `next/image` works self-hosted with zero configuration when deploying using `next start`."*

> *"Note that images are optimized at runtime, not during the build."*

But there is a real operational note that only shows up under load:

> *"On glibc-based Linux systems, Image Optimization may require additional configuration to prevent excessive memory usage."*

The link is to `sharp`'s own guidance on the Linux memory allocator. The symptom is a container whose resident memory climbs and never returns after serving images — which looks like a leak in your code and is allocator fragmentation. On a `-slim` (Debian, glibc) base this applies; Alpine's musl allocator behaves differently, and brings its own `sharp` build considerations.

Because `sharp` has native binaries, it is also the canonical case for the tracing escape hatch below.

## When tracing gets it wrong

> *"There are some cases in which Next.js might fail to include required files, or might incorrectly include unused files. In those cases, you can leverage `outputFileTracingExcludes` and `outputFileTracingIncludes` respectively"*

Keys are route globs, values are globs from the project root:

```js
// next.config.js
module.exports = {
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*', 'node_modules/aws-crt/dist/bin/**/*'],
    '/api/reports/*': ['src/templates/**/*.hbs'],
  },
  outputFileTracingExcludes: {
    '/api/*': ['src/temp/**/*', 'public/large-logs/**/*'],
  },
}
```

Two limits that decide whether this option can help you at all:

> *"These options are applied to server traces and do not affect routes that do not produce a server trace file: Edge Runtime routes are not affected. Fully static pages are not affected."*

And the monorepo case has its own knob, because tracing is rooted at the project directory by default:

```js
// packages/web-app/next.config.js
const path = require('path')

module.exports = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/route1': ['../shared/assets/**/*'],
  },
}
```

> *"Keep patterns as narrow as possible to avoid oversized traces (avoid `**/*` at the repo root)."*

The failure mode of *not* setting this in a monorepo is the classic one: files outside `packages/web-app` are simply not traced, so a shared package's runtime assets are missing from the image, and the error is `MODULE_NOT_FOUND` at request time on a build that passed.

## Graceful shutdown, because `after()` is real work

> *"`after` is fully supported when self-hosting with `next start`."*

> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting. The Next.js server will finish in-flight requests and execute any pending `after()` callbacks before exiting. Platforms should allow a configurable drain period (10-30 seconds is recommended) to ensure all background work completes."*

Two things have to be true for that to work. The orchestrator has to allow the window — `terminationGracePeriodSeconds` in Kubernetes — and the signal has to actually reach Node:

```dockerfile
# ✅ exec form: the container's PID 1 is node, so SIGTERM reaches it
CMD ["node", "server.js"]

# ❌ shell form: PID 1 is /bin/sh, which does not forward SIGTERM
CMD node server.js
```

Everything *around* the container — the reverse proxy, streaming pass-through, and the cache once there is more than one replica — is [02b](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md). Environment variables in the image follow the same build-time/runtime split as on Vercel: [01b](01b-vercel-environments-and-the-build-time-runtime-split.md).

## Gotchas

**★ Symptom: the containerised site renders unstyled with 404s on every `/_next/static/*` file.** Cause: `output: 'standalone'` *"does not copy the `public` or `.next/static` folders by default"*, and nothing warns you. Fix: copy them into the standalone tree — as Docker layers in the runner stage, or with the documented `cp` for a local check:

```dockerfile
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
```

**★ Symptom: the container starts, logs that it is listening, and every health check times out.** Cause: `server.js` bound to the default hostname rather than all interfaces, so nothing outside the container's network namespace can reach it. Fix: `ENV HOSTNAME="0.0.0.0"` in the image, per the documented `PORT`/`HOSTNAME` note. Setting only `PORT` does not help.

**★ Symptom: ISR revalidation fails at runtime with permission errors, hours after a clean start.** Cause: the image runs as `node` but `.next` was created by the `COPY` as root, and the prerender cache is written there at runtime. Fix: the two lines the official Dockerfile carries for exactly this reason, before the standalone copy:

```dockerfile
RUN mkdir .next
RUN chown node:node .next
```

**★ Symptom: `MODULE_NOT_FOUND` at request time for a native dependency the build never complained about.** Cause: `@vercel/nft` traces `import`, `require` and `fs` usage statically, and a binary loaded through a path it cannot see is not traced. Fix: name it explicitly — this is the documented use of `outputFileTracingIncludes`, and `sharp` is the documented example:

```js
outputFileTracingIncludes: { '/*': ['node_modules/sharp/**/*'] }
```

**★ Symptom: a monorepo build produces an image missing every shared-package asset.** Cause: *"the project directory is used for tracing by default"*, so anything outside `packages/web-app` is excluded. Fix: set `outputFileTracingRoot` to the monorepo root and add the specific shared paths — do not widen it to `**/*`, which the docs warn produces oversized traces.

**★ Symptom: `outputFileTracingIncludes` has no effect on the route you added it for.** Cause: the option applies only to routes that produce a server trace file — *"Edge Runtime routes are not affected. Fully static pages are not affected."* Fix: check what the route actually is. If it is static, the asset must be in `public/` or imported so the bundler sees it; if it is an Edge route, tracing is not the mechanism at all.

**★ Symptom: `after()` callbacks stop running during rolling deploys.** Cause: the orchestrator kills the container before the drain completes, or `SIGTERM` never reaches Node. Fix: allow the documented 10–30 second drain window and use exec-form `CMD ["node", "server.js"]` so the Node process is PID 1.

**★ Symptom: enabling the `.next/cache` build mount made the first requests after every deploy slow.** Cause: the documented trade — the mount *"prevents `.next/cache/fetch-cache` from being included in the final image, meaning cached fetch responses from the build won't be available at runtime"*. Fix: decide which you want. Keep the mount for fast CI, or drop it and copy `/app/.next/cache` into the runner stage so build-time fetches ship with the image.

**Symptom: memory climbs steadily on a container serving optimized images and never returns.** Cause: on glibc-based Linux, image optimization *"may require additional configuration to prevent excessive memory usage"* — allocator fragmentation, not a leak in your code. Fix: follow `sharp`'s Linux memory-allocator guidance for your base image, and do not spend the afternoon heap-profiling your route handlers first.

**Symptom: `PORT` is set in `.env` and the server still listens on 3000.** Cause: the CLI reference states `PORT` cannot be set in `.env` *"as booting up the HTTP server happens before any other code is initialized"*. Fix: set it in the image or the orchestrator — `ENV PORT=3000` in the Dockerfile, or the environment block of your compose or pod spec.

**Symptom: the image contains a stale `.next` from a local `next dev` run.** Cause: `COPY . .` in the builder stage copies whatever is in the working tree. Since 16, `next dev` writes to `.next/dev` rather than `.next`, so a development directory can ride along without colliding visibly. Fix: a `.dockerignore` that excludes `.next`, `node_modules` and `.env*`.

**Symptom: the image is enormous despite `output: 'standalone'`.** Cause: the builder stage's `node_modules` or the source tree was copied into the runner, defeating the point — standalone exists so that *"which can then be deployed on its own without installing `node_modules`"* is true. Fix: the runner stage should copy exactly three things from the builder: `public`, `.next/standalone`, `.next/static`. Nothing else.

**Symptom: `next build` inside Docker cannot reach the database and fails during prerendering.** Cause: build-time data fetching for statically generated routes runs in the builder stage, which usually has no network route to production data. Fix: this is a rendering-strategy decision, not a Docker one — see [chapter 6 · generateStaticParams at scale](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md). Either give the build a reachable read-replica, or make those routes dynamic or ISR so the fetch happens at runtime.

## Interview questions

**★ What does `output: 'standalone'` actually do, and what does it deliberately not do?**
It acts on the output file trace that `next build` already produces — `@vercel/nft` statically analysing `import`, `require` and `fs` usage — by copying the traced files, including select files from `node_modules`, into `.next/standalone` along with a minimal `server.js`. The result runs without an install step. What it deliberately does not copy is `public/` and `.next/static`, on the stated reasoning that those should ideally be handled by a CDN. `server.js` will serve them if you place them at `standalone/public` and `standalone/.next/static`, so the fix is a copy rather than a configuration change.

**★ A self-hosted container serves HTML but no CSS or JavaScript. Walk through the diagnosis.**
The HTML rendering proves the server is fine, so the problem is asset serving, not routing. Check whether `.next/static` was copied into the standalone tree; if it was not, every `/_next/static/*` request 404s while the document itself is served normally. The same omission hits `public/`, so favicons and images fail too. It is the single most common standalone mistake because nothing in the build output flags it — the copy is documented in the `output` reference and shown as two `COPY` lines in the official Dockerfile.

**★ Why does the official Dockerfile `mkdir .next` and `chown` it before copying anything into it?**
Because the runtime writes there. The standalone server maintains the prerender cache under `.next`, and the image runs as the unprivileged `node` user while the `COPY` instructions run as root. Creating and chowning the directory first makes it writable by the process that will use it. Skip it and the container starts perfectly, serves prerendered pages perfectly, and fails only when a route first tries to revalidate — which may be long after the deploy is considered successful.

**★ Your team wants faster Docker builds and adds a cache mount for `.next/cache`. What did they just trade away?**
The build-time fetch cache. The upstream comment is explicit: the mount caches `.next/cache` across builds but prevents `.next/cache/fetch-cache` from being included in the final image, so cached fetch responses from the build are not available at runtime. Practically, the first request to each ISR route after a deploy does the upstream fetch itself rather than starting from a warm cache. If that matters more than build time, drop the mount and copy `.next/cache` into the runner stage instead; the Dockerfile carries a commented line for it.

**★ When is `outputFileTracingIncludes` the right tool, and when is reaching for it a sign you have misdiagnosed the problem?**
It is right when a *server* route needs a file that static analysis cannot see: a native binary loaded by path, a template read with `fs` at runtime, a locale JSON resolved dynamically. It is the wrong tool when the route in question is fully static or runs on the Edge Runtime, because the documentation states those routes are not affected — they produce no server trace file for the option to modify. If adding an include changes nothing, that is usually the reason, and the real fix is to import the asset so the bundler sees it, or to move it into `public/`.

**★ The docs say a single `next start` process handles every Next.js feature correctly. So what do you actually lose by self-hosting?**
Nothing functional, on one instance. What you take on is operational: a CDN in front of `/_next/static`, a reverse proxy for request validation and streaming pass-through, `sharp`'s allocator behaviour on glibc, a graceful-shutdown window for `after()`, and — the moment there is a second instance — a shared cache, tag coordination, a stable Server Function encryption key and a deployment ID. The framework docs frame this as functional fidelity versus performance fidelity: a Node server has full functional fidelity, and the rest is infrastructure you now own.

**★ Why does exec-form `CMD` matter for `after()`?**
Because shell-form `CMD` makes `/bin/sh` PID 1, and it does not forward `SIGTERM` to the Node process. The container is then killed by the eventual `SIGKILL` instead of shutting down gracefully, so in-flight requests are dropped and pending `after()` callbacks never run. Since `after()` is where teams put analytics writes, audit logging and cache warming, the loss is silent and only shows up as gaps in data that correlate with deploys.

**★ Why is "the image never runs an install" a correctness property and not just a speed one?**
Because an install at deploy time can resolve a different dependency tree than the one you built and tested against — a transitive range that moved, a registry that is momentarily inconsistent, a platform-specific optional dependency that resolves differently on the runtime image than on the build image. Standalone copies the *actual* files the build used, so the runtime graph is the graph you tested. The speed and size benefits are real but secondary to that.

**How would you decide between `output: 'standalone'` and plain `next start` in a container?**
`next start` needs the full `node_modules` present, so the image carries development dependencies and the install step, and rebuilds are slower and larger. Standalone carries only traced files. The case for plain `next start` is a build where tracing is unreliable — heavy dynamic `require`, plugin systems that resolve modules at runtime — and you would rather ship everything than maintain an `outputFileTracingIncludes` list. That is a legitimate choice; it is just a much larger image, and it should be a decision rather than a default.

---

← [The edge network and skew protection](01c-the-edge-network-and-skew-protection.md) · [Chapter 16 overview](01-explanation.md) · Next → [Caching and the `CacheHandler` across containers](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md)
