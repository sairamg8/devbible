---
title: "The dependency-install pattern"
sidebar_label: "03 · The dependency-install pattern"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — optimize cache usage](https://docs.docker.com/build/cache/optimize/),
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/),
> [the Dockerfile reference — `COPY`](https://docs.docker.com/reference/dockerfile/#copy),
> [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**Copy the manifest, install, *then* copy the source.** Three lines in that order
are the single highest-value edit you can make to a Dockerfile, and they are the
concrete application of everything in pages 01 and 02.

## Why the order is forced

`RUN npm ci` is compared by its text alone, so it re-executes only when its
*parent layer* changes ([page 01](01-how-the-cache-decides.md)). The parent is
whatever `COPY` sits above it. So the question is not "did the dependencies
change?" — the builder never asks that. The question is "did the thing I copied
before installing change?"

Copy the whole repository and the answer is *yes, constantly*. Copy only
`package.json` and the lockfile and the answer is *no, until someone adds a
dependency* — which is exactly the truth you wanted the cache to express.

## The pattern

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app

# 1. the manifest and the lockfile — and nothing else
COPY package.json package-lock.json ./

# 2. the expensive step, now protected
RUN npm ci

# 3. the volatile part, after the expensive step
COPY . .
RUN npm run build
```

Two files decide whether step 2 runs. Edit a component and step 2 is a cache
hit; add a dependency and it correctly re-runs. That is the whole idea, and
everything below is either a variation of it or a way it goes wrong.

## Use the lockfile-strict install, not the ordinary one

`npm install` is the wrong command inside a build, and npm's own documentation
says why:

> "The project **must** have an existing `package-lock.json` or
> `npm-shrinkwrap.json`."
>
> "If dependencies in the package lock do not match those in `package.json`,
> `npm ci` will exit with an error, instead of updating the package lock."
>
> "It will never write to `package.json` or any of the package-locks: installs
> are essentially frozen."

Three consequences that matter in a container build:

- **It is deterministic.** The image contains what the lockfile says, not
  whatever the registry resolved this morning. Two builds of the same commit
  install the same tree.
- **A drifted lockfile fails the build** instead of silently producing an image
  nobody can reproduce. That is the behaviour you want in CI.
- **It removes `node_modules` first** — "if a `node_modules` is already present,
  it will be automatically removed before `npm ci` begins its install" — which is
  why copying `node_modules` into the image before installing is pure waste, and
  why `node_modules` belongs in `.dockerignore`
  ([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).

The equivalents elsewhere follow the same principle — install from the lock, do
not resolve.

## The same shape in other ecosystems

The manifest files change; the pattern does not.

| Stack | Copy first | Then install |
|---|---|---|
| **Node (npm)** | `package.json`, `package-lock.json` | `npm ci` |
| **Node (pnpm)** | `package.json`, `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| **Node (yarn)** | `package.json`, `yarn.lock` | `yarn install --immutable` |
| **Python (pip)** | `requirements.txt` | `pip install -r requirements.txt` |
| **Python (Poetry)** | `pyproject.toml`, `poetry.lock` | `poetry install --no-root` |
| **Go** | `go.mod`, `go.sum` | `go mod download` |
| **Rust** | `Cargo.toml`, `Cargo.lock` | a dependency-only pre-build |
| **Java (Maven)** | `pom.xml` | `mvn dependency:go-offline` |
| **Ruby** | `Gemfile`, `Gemfile.lock` | `bundle install` |
| **PHP** | `composer.json`, `composer.lock` | `composer install --no-scripts` |

Rust is the awkward one: Cargo has no "download only my dependencies" command
that also compiles them, so the common workaround is to copy the manifests,
create a dummy `src/main.rs`, build once to compile the dependency graph, then
copy the real source. It works, and it is a workaround — a cache mount
(**page 09 · `RUN --mount=type=cache`**, *not written yet*) is the cleaner
modern answer.

## Monorepos, where it usually breaks

A workspace repository has many manifests:

```
package.json
pnpm-lock.yaml
packages/api/package.json
packages/web/package.json
packages/shared/package.json
```

The instinctive line does **not** work:

```dockerfile
COPY package.json packages/*/package.json ./     # ✗ wrong
```

`COPY` matches wildcards using Go's `filepath.Match` rules, and when the
destination is a directory each matched file lands *in* that directory — the
`packages/api/` part of the path is not preserved, so three `package.json` files
collide at `./package.json` and the workspace layout is lost.

Two correct answers:

**1. `COPY --parents`,** which exists for exactly this and "preserves parent
directories for `src` entries" (Dockerfile frontend **1.20** and later; it
defaults to `false`):

```dockerfile
# syntax=docker/dockerfile:1
COPY --parents package.json pnpm-lock.yaml packages/*/package.json ./
RUN pnpm install --frozen-lockfile
```

**2. Copy each manifest explicitly** — verbose, works on any frontend, and the
one to reach for when the build must also run under Buildah (see below):

```dockerfile
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json     packages/api/
COPY packages/web/package.json     packages/web/
COPY packages/shared/package.json  packages/shared/
RUN pnpm install --frozen-lockfile
```

The verbosity has a real cost: add a package and forget the line, and the
install silently proceeds without it. Prefer `--parents` where the builder
supports it, and treat the explicit list as something CI should check.

## What this pattern does not solve

**It does not make the install itself fast** — it makes it *rare*. When it does
miss, you still pay the full download. Pairing the pattern with a cache mount on
the package manager's own cache directory is what makes even the miss cheap;
that is **page 09 · `RUN --mount=type=cache`** *(not written yet)*, and the two
compose rather than compete.

**It does not keep the dependencies out of the final image.** `npm ci` installs
dev dependencies and build toolchains that a running service never needs.
Removing them is the job of a multi-stage build — **page 04 · Multi-stage
builds** *(not written yet)* — and of Phase 5.

**It does not help a cold cache.** A fresh CI runner has nothing to hit. See
**page 12 · Cache import and export** *(not written yet)*.

## Podman

The pattern itself is builder-independent and works identically under
`podman build`. One caveat is specific to the `--parents` variant: **Buildah does
not fetch BuildKit frontends and ignores the `# syntax=` directive**, so pinning
`docker/dockerfile:1` does not upgrade the Dockerfile language there — available
features follow the installed Buildah version instead. If the same Dockerfile
must build under both engines, prefer the explicit-manifest form, or confirm
`--parents` support in your Buildah version before relying on it.
*(Source: the Buildah project's own
[Containerfile versus Dockerfile discussion](https://github.com/containers/buildah/discussions/3170)
— this is a project statement, not Podman reference documentation, and there is
no sandbox on this track to verify it by running anything.)*

## Gotchas

**Symptom:** `npm ci` re-runs on every build although dependencies never change.
**Cause:** Something volatile is copied above it — usually `COPY . .`, sometimes a
`COPY` of a config file that a formatter rewrites.
**Fix:** Copy only the manifest and lockfile before the install.

**Symptom:** The build fails with a lockfile-mismatch error that does not happen
locally.
**Cause:** `npm ci` refuses to reconcile a lockfile that disagrees with
`package.json` — locally you had been running `npm install`, which silently
updates it.
**Fix:** Commit the regenerated lockfile. The build is right and the local
workflow was hiding drift.

**Symptom:** In a monorepo, the install fails saying a workspace package is
missing, or only one `package.json` is present.
**Cause:** `COPY packages/*/package.json ./` flattened every match into one
destination path.
**Fix:** `COPY --parents`, or one explicit `COPY` per workspace manifest.

**Symptom:** The image is enormous although the pattern is correct.
**Cause:** Correct caching, no stage separation — dev dependencies and the build
toolchain are still in the shipped layer.
**Fix:** A multi-stage build. Caching and size are different problems with the
same fix.

## Interview questions

**★ Why copy `package.json` before the source instead of copying everything
once?**
Because `RUN npm ci` re-runs whenever its parent layer changes, and the parent is
the preceding `COPY`. Copying the whole context makes every source edit
invalidate the install; copying only the manifest and lockfile makes the install
depend on exactly the thing that determines its result.

**★ Why `npm ci` rather than `npm install` in a Dockerfile?**
`npm ci` requires a lockfile, installs strictly from it, never writes to
`package.json` or the lock, and errors when the two disagree — so the image is
reproducible and drift fails the build instead of shipping. It also removes any
existing `node_modules` before installing.

**★ How do you apply the pattern to a workspace monorepo?**
Copy the root manifest and lockfile plus every workspace `package.json` *with
their paths preserved* — `COPY --parents` (frontend 1.20+), or one explicit
`COPY` per package. A bare `packages/*/package.json ./` flattens the matches into
a single destination and loses the layout.

**Does this pattern make the install faster?**
No — it makes it *rarer*. The miss still costs a full install; a cache mount on
the package manager's cache directory is what makes the miss itself cheap, and
the two are used together.

**Where should `node_modules` come from?**
The install inside the image, never the host. Host `node_modules` may contain
platform-specific native builds, and `npm ci` deletes the directory before
installing anyway — so copying it in is wasted context and a source of confusing
bugs. Exclude it in `.dockerignore`.

**Does the pattern change under Podman?**
No. Only the `--parents` variant needs care: Buildah ignores the `# syntax=`
directive, so newer Dockerfile features depend on the installed Buildah version
rather than on a pinned frontend.

---

← Prev: [Instruction ordering](02-instruction-ordering.md) · Index: [Phase 4](README.md) · Next → **Multi-stage builds** *(not written yet)*
