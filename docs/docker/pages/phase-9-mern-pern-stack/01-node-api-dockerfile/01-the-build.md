---
title: "The build"
sidebar_label: "01 · The build"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — Containerize a Node.js application](https://docs.docker.com/guides/nodejs/containerize/),
> [the Dockerfile reference](https://docs.docker.com/reference/dockerfile/),
> [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci) and
> [`.dockerignore`](https://docs.docker.com/build/concepts/context/#dockerignore-files).
> **No sandbox** — no console output on this page.

**Two decisions decide whether a Node build takes four seconds or four minutes,
and neither is about Docker.** They are: what gets copied before the install, and
which install command runs. Everything else on this page follows from those.

## Why `npm ci`, not `npm install`

The npm documentation is unambiguous about what `ci` is for: it is *"similar to
`npm install`, except it's meant to be used in automated environments such as
test platforms, continuous integration, and deployment."* A container build is
exactly that environment.

| | `npm install` | `npm ci` |
|---|---|---|
| Lockfile | optional; **updated** when it disagrees with `package.json` | *"The project **must** have an existing `package-lock.json` or `npm-shrinkwrap.json`"* |
| On a mismatch | resolves and rewrites the lock | *"will exit with an error, instead of updating the package lock"* |
| Existing `node_modules` | reused and patched | *"automatically removed before `npm ci` begins its install"* |
| Writes to your files | may write `package.json` and the lock | *"never write to `package.json` or any of the package-locks: installs are essentially frozen"* |
| Partial installs | `npm install <pkg>` | *"can only install entire projects at a time"* |

🔴 **The reproducibility argument is the whole point.** With `npm install`, an
image built today and the same image built next month can contain different
transitive dependency versions, from the same commit, with no diff to show for
it. `ci` fails loudly instead — which is the behaviour you want in a build that
nobody is watching.

**`--omit=dev`** is the modern flag for leaving development dependencies out. It
belongs on the `deps` stage — the one whose `node_modules` actually ships — and
must **not** be on the `build` stage, which needs the compiler.

## The cache and bind mounts

```dockerfile
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --omit=dev
```

Docker's own Node guide uses this shape and explains both halves: the cache mount
to `/root/.npm` is there "to speed up subsequent builds", and the bind mount
avoids "having to copy it into this layer".

Read them as two different savings:

- **The cache mount** persists npm's own download cache *between builds*, so a
  cache-invalidating change still does not re-download every tarball from the
  registry. It is not part of the image, so it costs nothing in the final size
  ([Phase 4 · `RUN --mount=type=cache`](../../phase-4-build-strategy/09-mount-type-cache.md)).
- **The bind mount** makes `package.json` visible to that one command without
  adding a layer that contains it. The layer records the *result* of the install,
  not the manifests.

⚠️ **A cache mount is not a substitute for layer caching.** If the layer is
invalidated, the command still runs — it just runs faster. The next section is
what stops it running at all.

## Copy the manifests before the source

If you do not use bind mounts, the equivalent — and the older, more widely
recognised form — is:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
```

🔴 **The order is the optimisation.** A layer's cache key includes the contents
of what it copies, so `COPY . .` before the install means every source edit
invalidates the install layer and reinstalls every dependency
([Phase 4 · How the layer cache decides](../../phase-4-build-strategy/01-how-the-cache-decides.md)).
Copying only the manifests first means the install layer's key changes **only
when the dependencies change**, which is the behaviour everyone assumes they
already have.

The failure mode is not an error — it is a build that is quietly slow forever,
and the tell is a full `npm ci` in the log after a one-character change.

## `.dockerignore` is not optional here

```
node_modules
npm-debug.log
.git
.env
dist
coverage
.vscode
Dockerfile
compose*.yaml
```

Three separate problems, and the middle one is the expensive one:

1. **Upload size.** A local `node_modules` is often the largest thing in the
   repository, and without an ignore file it is sent to the builder as part of
   the context.
2. 🔴 **Cache invalidation.** `.git` changes on **every commit**, so a context
   that includes it changes the hash of every `COPY . .` — the single commonest
   reason "the cache does not work"
   ([Phase 3 · `.dockerignore`](../../phase-3-dockerfile/08-dockerignore.md)).
3. **Secrets.** `.env` copied into a layer is published with the image, and
   rebuilding does not unpublish it. The response to a leaked value is always to
   **rotate it**, never to rebuild.

⚠️ **`node_modules` in `.dockerignore` is load-bearing for correctness, not just
speed.** A host `node_modules` copied into the image brings binaries compiled for
the host's platform and libc — the "works on my machine, `exec format error` in
the container" report ([Phase 2 · Base images](../../phase-2-images-and-registries/05-choosing-a-base-image.md)).

## Why three stages

```dockerfile
FROM node:24-slim AS deps      # production dependencies only
FROM node:24-slim AS build     # all dependencies + the compiler
FROM node:24-slim AS runtime   # neither — just the results
```

The naive two-stage version (`build` then copy `node_modules` from it) ships
development dependencies, because the stage that compiled the code had to install
them. A separate `deps` stage exists purely so that the `node_modules` directory
that ships was **never** contaminated by the toolchain
([Phase 4 · Multi-stage builds](../../phase-4-build-strategy/04-multi-stage-builds.md)).

The cost is one extra install. The cache mount makes it cheap, and the two
installs invalidate independently — which is why this is a better trade than it
looks.

**A plain JavaScript service with no build step drops the middle stage
entirely.** Two stages, `deps` and `runtime`. Do not keep a `build` stage that
runs nothing to look symmetrical.

## `ARG NODE_VERSION` and pinning

```dockerfile
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS deps
```

A pre-`FROM` `ARG` is global scope, which is what allows it in the `FROM` line —
and it is **not** visible inside a stage unless redeclared there, with no error to
warn you ([Phase 3 · `FROM`](../../phase-3-dockerfile/01-from.md)).

On the tag itself: `node:24-slim` is a subscription, not a version — it moves as
patches land ([Phase 2 · Tags versus digests](../../phase-2-images-and-registries/02-tags-vs-digests.md)).
For a service you deploy, pin the digest and keep the readable tag beside it, and
automate the bump so pinning does not become "years behind on patches". Docker's
own guide now builds its Node examples on **Docker Hardened Images**
(`dhi.io/node:…`), which is the same argument taken one step further: a smaller,
maintained base with less in it to patch.

## Gotchas

**Symptom:** Every build reinstalls all dependencies, even after a one-line
source change.
**Cause:** `COPY . .` runs before the install, so the install layer's cache key
includes every source file.
**Fix:** Copy `package.json` and the lockfile first, install, then copy the
source. Or bind-mount the manifests into the `RUN` as the guide does.

**Symptom:** The build works locally and fails in CI with a lockfile error.
**Cause:** `npm ci` exits when `package-lock.json` disagrees with
`package.json`, rather than silently updating it.
**Fix:** Run `npm install` locally, commit the updated lockfile, and let CI keep
failing loudly — that error is the feature.

**Symptom:** A native module crashes at start-up with an ELF or `exec format`
error.
**Cause:** A host `node_modules` was copied into the image, carrying binaries
built for the host's platform and libc.
**Fix:** `node_modules` in `.dockerignore`, always. Let the image build its own.

**Symptom:** The production image contains TypeScript, ESLint and the test
runner.
**Cause:** The stage that ships copied `node_modules` from the stage that
compiled.
**Fix:** A separate `deps` stage with `npm ci --omit=dev`, and copy
`node_modules` from *that* stage.

## Interview questions

**★ Why `npm ci` rather than `npm install` in a Dockerfile?**
Because a build is an automated environment and should be frozen. `ci` requires a
lockfile, errors instead of updating it when it disagrees with `package.json`,
removes any existing `node_modules` first, and never writes to your manifests. The
practical effect is that the same commit produces the same dependency tree in
January and in June — and when it cannot, the build fails instead of quietly
drifting.

**★ Why copy `package.json` before the source, and what does it cost if you do
not?**
The install layer's cache key is derived from what was copied into it. Copying
the whole tree first means every source edit invalidates the install, so every
build reinstalls every dependency. Copying only the manifests first means the
install layer changes only when dependencies do. It is not an error when you get
it wrong — just a build that is permanently slow, which is why it survives so
long in real projects.

**★ Why three stages rather than two?**
Because the stage that compiles must install development dependencies, so its
`node_modules` is contaminated. A separate `deps` stage running
`npm ci --omit=dev` produces a `node_modules` that never saw the toolchain, and
the runtime stage copies from there. The cost is a second install, which the npm
cache mount makes cheap.

**What does a cache mount give you that layer caching does not?**
Layer caching skips the command entirely when nothing relevant changed. A cache
mount helps in the case where the command *does* run: npm's download cache
survives between builds, so a changed dependency does not mean re-fetching every
unrelated tarball. They solve different halves, and the mount is not part of the
image.

**What belongs in `.dockerignore` for a Node project, and which entry matters
most?**
`node_modules`, `.git`, `.env`, build output, coverage, editor directories, and
the Dockerfile and compose files themselves. `.git` is the one people miss and it
matters most for the cache — it changes every commit, so it changes the hash of
every `COPY . .`. `node_modules` matters most for correctness, because host-built
native modules do not run in the container.

---

← Prev: [Containerising a Node/Express API](README.md) · Index: [Phase 9](../README.md) · Next → [The runtime](02-the-runtime.md)
