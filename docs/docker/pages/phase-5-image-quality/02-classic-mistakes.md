---
title: "The classic mistakes"
sidebar_label: "02 · The classic mistakes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/),
> [Docker — build secrets](https://docs.docker.com/build/building/secrets/),
> [the Dockerfile reference — `.dockerignore`](https://docs.docker.com/reference/dockerfile/#dockerignore-file),
> [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci) and
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
> **No sandbox** — no console output on this page.

**Six mistakes account for most bad images, and they are the same six every
time.** They share one root cause — **a layer records what happened, and nothing
later can unhappen it** — so every fix is the same shape: do not create it, or
clean it up in the same instruction.

## 1. Package lists left in the layer

```dockerfile
# ✗
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

Three separate faults in three lines. The lists downloaded by line 1 are in line
1's layer; line 3 adds a fourth layer that hides them and reclaims nothing. And
splitting `update` from `install` means a cached `update` can feed a later
`install` a stale index — which is why the guide states it as a rule:

> "Always combine `RUN apt-get update` with `apt-get install` in the same `RUN`
> statement."

```dockerfile
# ✓
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

Alpine's `apk add --no-cache` never writes the index at all. The modern option
for both is a cache mount, which keeps the cache outside every layer and speeds
the build as well
([Phase 4 · cache mounts](../phase-4-build-strategy/09-mount-type-cache.md)).

## 2. The npm cache

`npm ci` writes a download cache to `~/.npm` and leaves it there. In a
single-stage image, that cache ships.

```dockerfile
# ✗
RUN npm ci

# ✓ — cleaned in the same layer
RUN npm ci && npm cache clean --force

# ✓✓ — never in a layer at all
RUN --mount=type=cache,target=/root/.npm npm ci
```

The cache-mount form is better than the clean: the clean removes the bytes but
you paid to download them again next build, while the mount keeps them for the
next build *and* keeps them out of the image
([Phase 4 · cache mounts](../phase-4-build-strategy/09-mount-type-cache.md)).

The same shape applies to pip (`/root/.cache/pip`), Go (`/go/pkg/mod`) and
composer. Every package manager caches; every one of them ships that cache if you
let it.

## 3. `.git` in the image

`COPY . .` with no `.dockerignore` copies the entire repository history. Three
costs, and the third is the one people miss:

- **Size** — often the largest single item in a long-lived repository.
- **Cache** — every commit changes the context checksum, so the `COPY` layer and
  everything below it rebuild even when no source changed
  ([Phase 4 · how the cache decides](../phase-4-build-strategy/01-how-the-cache-decides.md)).
- **Disclosure** — deleted files, old branches, and any credential that was ever
  committed and later removed are all still in the history. An image with `.git`
  in it is a full disclosure of everything the repository ever contained.

The fix is one line in `.dockerignore`
([Phase 3](../phase-3-dockerfile/08-dockerignore.md)), and it is the highest
value-per-character change available to most Dockerfiles.

## 4. `node_modules` copied, then reinstalled

```dockerfile
# ✗
COPY . .          # includes the host's node_modules
RUN npm ci        # deletes it and installs again
```

npm's documentation is explicit — "if a `node_modules` is already present, it
will be automatically removed before `npm ci` begins its install" — so the copy
achieved nothing except:

- transferring thousands of files into the build context;
- invalidating the `COPY` layer whenever any of them changed;
- and, in a single-stage build, potentially leaving the host's
  platform-specific native modules in an earlier layer.

That last point is the sharp one. A native module built on macOS or against a
different libc does not run in the image, and the failure appears at container
start as a missing or incompatible shared object rather than at build time.

`node_modules` belongs in `.dockerignore`. Always.

## 5. Secrets in an early layer

The most expensive mistake on this page, because the cost is not size.

```dockerfile
# ✗ — all three of these publish the credential
ARG NPM_TOKEN
COPY .npmrc /root/.npmrc
RUN npm ci && rm /root/.npmrc
```

- A build argument "persist[s] in the final image" and is visible in
  `docker history`.
- A copied file is in its layer regardless of the later `rm`.
- And an image that was pushed cannot be un-pushed.

> "Build arguments and environment variables are inappropriate for passing
> secrets to your build, because they persist in the final image."

```dockerfile
# ✓
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

**The remediation, when it has already happened, is rotation.** Rebuilding does
not unpublish; deleting the tag does not remove the layer from anyone who pulled
it. Treat any credential that reached a published image as compromised and issue
a new one
([Phase 4 · build secrets](../phase-4-build-strategy/05-mount-type-secret.md)).

## 6. Shipping the toolchain

```dockerfile
# ✗
FROM node:22
RUN npm ci && npm run build
CMD ["node", "dist/main.js"]
```

Correct, and it ships TypeScript, the test runner, the linter, every dev
dependency and the full base image with build tooling. The instinct to add
`RUN npm prune --omit=dev` at the end does not help in a single-stage build,
because the un-pruned tree already exists in an earlier layer.

The fix is structural, not incremental:

```dockerfile
# ✓
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

([Phase 4 · multi-stage builds](../phase-4-build-strategy/04-multi-stage-builds.md))

## The single rule underneath all six

**A layer is append-only. Deleting a file in a later instruction records a
deletion; it does not reclaim the bytes, and it does not remove the file from
anyone who inspects the earlier layer.**

Which gives two ways to be correct, and only two:

1. **Never create it in the shipped stage** — a mount, a separate build stage, an
   exclusion in `.dockerignore`.
2. **Create and remove it inside one instruction**, so no layer boundary falls
   between the two.

Anything that reads as "add it, then tidy up afterwards" across two instructions
is the mistake wearing a different hat.

## Podman

All six are properties of the image and the Dockerfile, so nothing here differs.
`podman build` honours `.dockerignore` (and `.containerignore`), implements
`--secret`, and produces the same layer semantics — the same fixes apply
unchanged.

## Gotchas

**Symptom:** `docker history` shows a large layer for a `RUN` that "only
installs curl".
**Cause:** The apt index is in that layer, because the cleanup is a separate
instruction or absent.
**Fix:** Chain `update`, `install` and `rm -rf /var/lib/apt/lists/*` in one
`RUN`, or use a cache mount.

**Symptom:** The image builds fine and crashes at start with a missing shared
object.
**Cause:** Host `node_modules` copied in, containing native modules built for a
different platform.
**Fix:** Exclude `node_modules` in `.dockerignore` and let the image install its
own.

**Symptom:** A scanner reports a credential inside a published image.
**Cause:** A build argument, a copied config file, or an `ENV` — all of which
persist.
**Fix:** **Rotate the credential first.** Then move to
`RUN --mount=type=secret`.

**Symptom:** The cache misses on every commit although no source file changed.
**Cause:** `.git` in the build context, so `COPY . .` sees a new checksum each
time.
**Fix:** Exclude `.git` in `.dockerignore`.

## Interview questions

**★ What do all the classic size and safety mistakes have in common?**
They add something to a layer and try to remove it in a later instruction. Layers
are append-only, so the later removal records a whiteout without reclaiming the
bytes or hiding them from anyone inspecting the earlier layer. The two correct
patterns are: never create it in the shipped stage, or create and remove it
within one instruction.

**★ Why must `apt-get update` and `apt-get install` be in the same `RUN`?**
Two reasons. Cache correctness — a cached `update` layer can feed a later
`install` a stale package index, since `RUN` instructions are matched by text
alone. And size — the downloaded lists live in whichever layer created them, so
the cleanup has to be in that same instruction.

**★ A token was passed with `--build-arg` and the image was pushed. What do you
do?**
Rotate the credential. Build arguments persist in the image configuration and are
visible in `docker history`; rebuilding does not unpublish, and deleting the tag
does not recall what was pulled. After rotating, switch to
`RUN --mount=type=secret`.

**Why is copying `node_modules` into the image actively harmful?**
`npm ci` removes any existing `node_modules` before installing, so the copy is
wasted transfer and a spurious cache dependency — and host-built native modules
may be linked against a different platform, producing a runtime failure rather
than a build failure.

**Does `npm prune --omit=dev` at the end of a Dockerfile fix a fat image?**
Only in the same layer as the install, and even then it is inferior to staging.
In a single-stage build the un-pruned tree is already in an earlier layer, so the
image keeps the bytes. Build in one stage and install production dependencies
fresh in the runtime stage.

---

← Prev: [Where size actually goes](01-where-size-goes.md) · Index: [Phase 5](README.md) · Next → **Least privilege in the image** *(not written yet)*
