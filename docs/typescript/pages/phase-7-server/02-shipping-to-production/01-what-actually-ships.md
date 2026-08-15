---
title: "What actually ships"
sidebar_label: "01 · What actually ships"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Modules: TypeScript* —
> type stripping stability and version gates, the `node_modules` refusal;
> *Command-line API* — `--no-strip-types`, `--input-type`, `NODE_OPTIONS`
> precedence) and the **`tsconfig` reference** on typescriptlang.org
> (`declaration`, `declarationMap`, `incremental`, `removeComments`). **No
> sandbox, no console block** — nothing on this page was run, and no stack trace
> or build transcript is reproduced from memory.

[Topic 01](../01-tsconfig-for-a-node-service/README.md) chose between two ways of
turning TypeScript into a running process. This topic asks the question that
choice actually decides: **what is in the artefact?**

It is a more consequential question than it sounds, because the two paths
produce images with different contents, different attack surfaces, different
failure modes, and — this is the part that surprises people — **different
answers to "is the type checker involved at all?"**

> **The single rule worth carrying out of this page:** the type checker must run
> *somewhere* in the pipeline, and on Path B that somewhere is never the thing
> that starts your process. If nobody wired `tsc --noEmit` into CI, the service
> is not type-checked. It is merely written in a language that has types.

## Path A — build, then throw the compiler away

```dockerfile
# ---- build stage
FROM node:24-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile        # includes devDependencies: tsc lives here
COPY . .
RUN yarn tsc --noEmit false               # or just `yarn build`

# ---- runtime stage
FROM node:24-slim
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]
```

The shape is a **multi-stage build**, and the reason is not image size — it is
that TypeScript is a *development* dependency that has no business existing in
the runtime image. It is several megabytes of compiler that can read your source
and write files, present in production, for no reason.

What ships: `dist/*.js`, production `node_modules`, `package.json`. What does
not: your `.ts` sources, `tsconfig.json`, `typescript` itself, the test suite.

### The `package.json` half nobody writes down

The build produces `dist/`, but nothing yet *points* at it. Three fields do:

```json
{
  "type": "module",
  "main": "./dist/server.js",
  "engines": { "node": ">=24.12.0" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "start": "node dist/server.js"
  }
}
```

- **`type`** is the field that decided your entire module format back in
  [topic 01 chunk 02](../01-tsconfig-for-a-node-service/02-the-module-format.md).
  It is not a production concern *per se*, but it is the field most likely to be
  changed by someone who does not know that.
- **`engines`** is the only place the Node version requirement is written down as
  data rather than as a base-image tag. On Path B it is not documentation, it is
  a **correctness constraint** — see below.
- **`typecheck` as a separate script** so CI has something to call that is not
  the build. On Path A it is arguably redundant; making it exist anyway means
  the CI config does not have to change if you ever switch paths.

⚠️ A **library** additionally needs `types`/`exports` with a `types` condition,
`declaration: true`, and — genuinely worth it — `declarationMap: true`, which
generates a source map for the `.d.ts` files so that a consumer's *Go to
Definition* lands in your original `.ts` rather than in a generated declaration.
A service needs none of that, and turning `declaration` on for a service just
slows the build down.

## Path B — ship the sources, let Node strip them

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY src ./src
CMD ["node", "src/server.ts"]
```

Shorter, and genuinely simpler — there is no build step to get wrong, no `dist/`
to fall out of sync, no source-map plumbing ([chunk 02](./02-source-maps-and-stack-traces.md)
explains why that last one is free rather than skipped).

It also has a real production characteristic in its favour: **the file you read
when debugging is the file that is running.** No mental translation, no
"which line of the compiled output is this".

### 🔴 What Path B demands in return

**Pin the Node version, and mean it.** Type stripping is documented as *Stable*
as of **v25.2.0 and v24.12.0**, on by default since **v23.6.0 and v22.18.0**, and
`--experimental-transform-types` was **removed in v26.0.0**. A base image tag of
`node:24` floats within the 24 line; `node:24.19-slim` plus an `engines` field
does not. On Path A a Node mismatch usually shows up as a syntax error at load;
on Path B it can show up as `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` for one code path
that only executes on Tuesdays.

**`tsc --noEmit` must be a CI gate.** This is the point worth being blunt about:
`node src/server.ts` will happily start a service riddled with type errors,
because stripping is not checking. The pipeline needs an explicit step, and it
needs to fail the build.

**Your `.dockerignore` matters more.** Shipping `src/` means shipping whatever
else is in it — fixtures, `.env.example`, a scratch script someone left. On Path
A the `dist/` boundary quietly filtered that out for you.

**`node_modules` cannot contain TypeScript.** Node deliberately refuses to handle
`.ts` files inside `node_modules`, so a dependency published as raw TypeScript
does not work on this path. This is a constraint on your *dependencies*, not just
your code.

## Choosing, honestly

| | Path A — build to `dist/` | Path B — ship `.ts` |
|---|---|---|
| Compiler in the runtime image | no (multi-stage) | no — Node does it |
| Type checking in production pipeline | the build does it | **a separate CI step, or nothing** |
| Startup | plain JS | per-file stripping on first load |
| Debugging | `dist/` + source maps | the file that is running |
| Non-erasable syntax (`enum`, decorators, parameter properties) | fine | **rejected** |
| Node version sensitivity | base image tag | **a correctness constraint** |
| Extra moving parts | a build step, `rootDir`/`outDir`, source maps | a `.dockerignore` you must get right |

📌 **The decision is usually made for you by one row.** If the codebase has
decorators — NestJS, TypeORM, `class-validator`, `type-graphql` — Path B is
unavailable, full stop. If it does not, and the team is disciplined about the CI
gate, Path B removes an entire class of "the build output is stale" incident.

## The antipatterns, named

**`ts-node` in production, or `tsc` at container start.** This puts the compiler
in the runtime image and moves a build failure to *startup time*, where it takes
down a rolling deploy instead of failing a pipeline. Node's own stripping made
the "run TypeScript directly" use case legitimate; it did not make running the
type checker at boot legitimate.

**Building inside the runtime stage.** A single-stage `Dockerfile` that runs
`yarn install` (with devDependencies) then `tsc` then `CMD node dist/server.js`
ships the compiler, the sources, the test suite and every dev dependency. It is
also usually *slower* to rebuild, because a source change invalidates the
dependency layer.

**`NODE_ENV=production` as a type-safety measure.** It is not one. It changes
library behaviour and dependency installation; it has no relationship to
anything TypeScript does, because [types are erased](../../phase-0-how-typescript-runs/02-erasure.md)
long before any environment variable is read.

**Committing `dist/`.** It goes stale, it produces merge conflicts nobody can
review, and it makes the "which source produced this artefact" question
unanswerable. Build in CI.

## Gotchas

**Symptom:** the container starts, then exits with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
on a code path that works locally.
**Cause:** Path B on a Node older than the one you develop on, or a rarely
executed module containing an `enum` / parameter property / decorator.
**Fix:** `erasableSyntaxOnly` so `TS1294` catches it at check time, plus a pinned
base-image tag and an `engines` field.

**Symptom:** CI is green, production has a type error's worth of `undefined`.
**Cause:** Path B with no `tsc --noEmit` step. Nothing in the pipeline ever
type-checked anything.
**Fix:** an explicit `typecheck` script wired into CI as a required step. This is
the single most common Path B failure and it is entirely procedural.

**Symptom:** the image is 900 MB and contains your source code.
**Cause:** single-stage build, devDependencies installed, `COPY . .` with a thin
`.dockerignore`.
**Fix:** multi-stage on Path A; a tight `.dockerignore` and
`--production` install on either.

**Symptom:** a deploy runs code from a commit that is not the one being deployed.
**Cause:** `dist/` committed to the repository and stale, so the runtime stage
copied an old build rather than the one just produced.
**Fix:** `dist/` in `.gitignore`, built in CI, never committed.

**Symptom:** *Go to Definition* on your published package lands in a `.d.ts`
instead of the source.
**Cause:** `declarationMap` is off. (Library concern only — a service should not
be emitting declarations at all.)
**Fix:** `declarationMap: true` alongside `declaration: true`, and ship the
`.d.ts.map` files.

## Interview questions

**Why is a TypeScript service's `Dockerfile` almost always multi-stage?**
Because `typescript` is a devDependency: it is needed to produce the artefact and
has no role in running it. A multi-stage build lets the compiler exist in the
build stage and be absent from the image that reaches production, along with the
sources, the tests and every other dev dependency.

**On the type-stripping path, what type-checks your code?**
Nothing, unless you arranged it. Node replaces types with whitespace and runs the
result; it performs no checking of any kind. `tsc --noEmit` has to be an explicit,
required CI step, and a project that skips it is not loosely typed — it is
unchecked.

**Why does the Node version become a correctness constraint on Path B and not on
Path A?**
Because on Path B the runtime is also the compiler. Stripping stability and the
set of accepted syntax are properties of the Node version — stable at 24.12+ /
25.2+, default-on since 23.6 / 22.18, with `--experimental-transform-types`
removed in 26.0. On Path A the artefact is plain JavaScript and Node's TypeScript
support is irrelevant to it.

**What is wrong with running `tsc` as the container's entrypoint?**
It relocates a build failure from the pipeline to a rolling deploy, ships the
compiler in the runtime image, and adds compile time to every container start —
including every autoscale event and every restart after a crash.

---

← [Topic index](./README.md) · Next → [02 · Source maps and stack traces](./02-source-maps-and-stack-traces.md)
