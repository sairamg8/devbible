---
title: "Dockerizing Node properly — multi-stage, non-root, layer cache"
sidebar_label: "03 · Dockerizing Node"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against common Node image practice on **Node 24** Active LTS tags.
> Pin digest/tags in your registry; do not invent a tag that was not pulled here.

**A good Node image is small, runs as non-root, caches dependencies separately from app
code, and does not copy secrets or `node_modules` from a laptop. Multi-stage builds are
how you get there without shipping compilers into production.**

## Multi-stage shape

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --immutable

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && yarn build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --system --uid 1001 nodeapp
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER nodeapp
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

| Stage | Job |
|---|---|
| **deps** | Install with only lockfiles — max cache hits |
| **build** | Compile TypeScript / bundle if needed |
| **runner** | Production bits only, non-root |

Copy **lockfile + package.json** before the rest of the source so code edits do not
invalidate the dependency layer.

## .dockerignore

```dockerignore
node_modules
.git
.env
.env.*
coverage
build
.docusaurus
**/*.md
```

Without this you send host `node_modules` and secrets into the build context — slow and
dangerous.

## Non-root is not optional

CVE classes that write to the filesystem or load code become worse as root. `USER` after
files are copied with correct ownership (`COPY --chown=nodeapp:nodeapp` when needed).

## PID 1 and the CMD form

Prefer `CMD ["node", "dist/server.js"]` (exec form) so Node is PID 1 and receives
signals. `CMD npm start` is a different footgun — [page 04](./04-pid1-and-signals.md).

## Gotchas

**Symptom:** Every code change reinstalls all dependencies
**Cause:** `COPY . .` before `yarn install`
**Fix:** Copy manifests first, install, then copy source

**Symptom:** Image contains `.env` with production secrets
**Cause:** No `.dockerignore`; `COPY . .`
**Fix:** Ignore env files; inject secrets at runtime

**Symptom:** App cannot write uploads
**Cause:** Non-root user, directory owned by root
**Fix:** `chown` the writable paths or use a volume with correct mode

**Symptom:** `sharp` / native addons fail on Alpine
**Cause:** musl vs glibc, missing build tools
**Fix:** Match libc to your addons ([page 09](./09-image-size-hardening.md))

**Symptom:** DevDependencies missing at build, present at runtime
**Cause:** `yarn install --production` too early
**Fix:** Install full deps for build stage; production node_modules only in runner

## Interview questions

**★ Why multi-stage Docker builds for Node?**
Separate install/build tools from the runtime image; smaller attack surface and better
layer caching.

**★ Why copy package.json and the lockfile before application source?**
So dependency layers cache until dependencies change, not on every source edit.

**Why run as non-root?**
Limits blast radius of filesystem and some remote exploits; required by many policies.

**What belongs in `.dockerignore`?**
`node_modules`, `.git`, env files, build outputs, anything not needed for the image.

**Exec form vs shell form CMD?**
Exec form runs Node directly as PID 1 so `SIGTERM` reaches your process.

---

← Prev: [Boot sequence](./02-boot-sequence.md) · Next → [PID 1 and signals](./04-pid1-and-signals.md)
