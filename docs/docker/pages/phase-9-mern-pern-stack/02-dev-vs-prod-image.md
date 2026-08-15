---
title: "Dev image vs prod image"
sidebar_label: "02 · Dev vs prod image"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — Containerize a Node.js application](https://docs.docker.com/guides/nodejs/containerize/),
> [the Compose `build` element](https://docs.docker.com/reference/compose-file/build/),
> [the Dockerfile reference](https://docs.docker.com/reference/dockerfile/) and
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/).
> **No sandbox** — no console output on this page.

**One Dockerfile, two targets — not two Dockerfiles.** The moment there is a
`Dockerfile.dev`, the two files start drifting, and the drift is only discovered
in production, where the difference lives.

## The shape

Topic 01's file grows one stage. Nothing else changes:

```dockerfile
# ---------- deps / build / runtime, exactly as in topic 01 ----------

FROM node:24-slim AS dev
ENV NODE_ENV=development
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci                      # ALL dependencies — the toolchain is the point
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]       # the watcher, not the server
```

Docker's own Node guide is built this way: a `dev` stage whose command is
`npm run dev`, and a production stage that runs `node` on the built entry point.

```bash
docker build --target dev -t api:dev .
docker build -t api:prod .       # no --target: the last stage, runtime
```

`--target` builds a named stage and **stops there** — the later stages are never
executed, so a production-only step costs a development build nothing
([Phase 4 · `--target`](../phase-4-build-strategy/06-target.md)).

In Compose, the same switch is one line, and it is the natural thing to put in an
override file ([Phase 8 · Override files](../phase-8-compose/11-override-files.md)):

```yaml
# compose.yaml — the shared definition
services:
  api:
    build:
      context: .
    environment:
      DATABASE_URL: postgres://app:devonly@db:5432/app

# compose.override.yaml — development only, applied automatically
services:
  api:
    build:
      target: dev          # "defines the stage to build as defined inside a multi-stage Dockerfile"
    command: npm run dev
    volumes:
      - ./src:/app/src
    ports:
      - "3000:3000"
      - "9229:9229"        # the inspector
```

⚠️ **Naming any file with `-f` suppresses the automatic override**, which is what
keeps a production invocation from silently inheriting the dev mounts. That is
the mechanism, and it only works if the dev-only keys live in the override file
rather than in the base.

## What dev needs that prod must not have

| | `dev` | `runtime` |
|---|---|---|
| Dependencies | **all** — compiler, watcher, test runner | production only (`npm ci --omit=dev`) |
| Source | the whole tree, usually bind-mounted or synced | the build output only |
| Command | a watcher (`npm run dev`, `tsx watch`, `nodemon`) | `node dist/index.js` |
| `NODE_ENV` | `development` | `production` |
| Debug port | published (`9229`) | **never** |
| Source maps | yes | a decision, not a default — see below |
| Shell, `curl`, editors' helpers | convenient | more tools for whoever gets in |

🔴 **The debug port is the one that must not leak.** `--inspect` is a full
remote-execution channel into the process. It belongs in the override file, and
the base file should not mention 9229 at all.

**Source maps in production are a real trade-off, not an oversight.** They make
stack traces readable and they hand a copy of your source to anyone who can read
the image. The defensible middle ground is to generate them, ship them to the
error tracker, and not put them in the image — but *decide*, rather than
inheriting whatever the build tool defaults to.

## Why not two Dockerfiles

The argument is drift, and it is always the same story:

- The base image is bumped in one file and not the other, so development runs a
  different Node minor than production for six months.
- A `RUN apt-get install` that the application quietly depends on exists only in
  the dev file, and the production image fails the first time that code path runs.
- Nobody notices, because the two files are never read side by side.

**One file with named stages makes the difference explicit and reviewable.** The
diff between dev and prod is the stage list, which a reviewer can see in one
screen. It also means the shared parts — the base image, the install command, the
non-root user — are shared *by construction* rather than by discipline.

⚠️ **The exception that earns a second file** is a genuinely different artefact:
a migration runner, a CI image with cloud tooling in it, a documentation builder.
Those are not "the same app in development"; they are other programs, and
pretending otherwise makes the stage list a mess.

## Bind mount, sync, or neither

The dev stage answers *what is in the image*. How your edits reach the running
container is a separate question with three answers, all covered elsewhere:

| Approach | What it is | Where |
|---|---|---|
| **Bind mount** | the host tree covers the container's | [Phase 6 · Bind mounts in development](../phase-6-storage/04-bind-mounts-in-development/README.md) |
| **`develop.watch`** | Compose copies changes in | [Phase 8 · `develop.watch`](../phase-8-compose/13-develop-watch.md) |
| **Rebuild** | `up -d --build`, no live reload at all | fine for a service you edit twice a month |

🔴 **The `node_modules` shadowing trap belongs to the bind-mount answer only.**
Mounting `./` over `/app` hides the image's `node_modules`; the anonymous-volume
shield or a narrower mount is the fix, and `watch` avoids the problem by not
covering anything ([Phase 8 · Volumes in Compose](../phase-8-compose/08-volumes.md)).
Topic 05 is the full treatment.

## The one image that ships

**The image you test is the image you deploy.** Once the `runtime` stage is built
in CI, that exact artefact — by digest — is what goes to staging and then to
production ([Phase 2 · Tags versus digests](../phase-2-images-and-registries/02-tags-vs-digests.md)).
Rebuilding "the same" image for production from the same commit is not the same
thing: a floating base tag, a transitive dependency and a build cache can all
differ.

Configuration is what changes between environments, and it arrives at run time —
environment variables and mounted secrets, never a rebuild
([Phase 10 · Configuration and secrets](../phase-10-production/05-config-and-secrets.md)).
If a deploy requires a rebuild to change a URL, that URL was baked in at build
time and should not have been.

## Gotchas

**Symptom:** Production is missing a package that development has.
**Cause:** It is in `devDependencies` and the runtime stage installed with
`--omit=dev`, so the failure appears only on the code path that requires it.
**Fix:** Move the package to `dependencies`. Do not "fix" it by dropping
`--omit=dev`, which ships the whole toolchain to production.

**Symptom:** The production container starts a file watcher, or exits
immediately.
**Cause:** `command:` from the dev override leaked into the production
invocation, usually via `docker compose up` in a directory containing
`compose.override.yaml`.
**Fix:** Name the files explicitly outside development:
`-f compose.yaml -f compose.prod.yaml`. Passing any `-f` disables the automatic
override.

**Symptom:** Port 9229 is open on a production host.
**Cause:** The inspector's port was published in the base compose file rather
than the dev override.
**Fix:** Move it to the override, and audit what else is published. `--inspect`
is remote code execution by design.

**Symptom:** Development and production disagree about the Node version.
**Cause:** Two Dockerfiles, bumped independently.
**Fix:** One Dockerfile with a `dev` stage and `--target`. If the two really are
different programs, name the second file after what it is — not after an
environment.

## Interview questions

**★ One Dockerfile with two targets, or two Dockerfiles?**
One, with named stages. The stages share the base image, the install command and
the non-root user by construction, so they cannot drift; and the difference
between development and production is a stage list a reviewer can read in one
screen. Two files drift silently — a bumped base in one, a system package
installed in only one — and the discovery happens in production. A genuinely
different artefact, such as a CI or migration image, is the exception, and it
should be named after what it is rather than after an environment.

**★ What must the development image have that the production image must not?**
All dependencies including the toolchain, the source tree, a watcher as its
command, `NODE_ENV=development`, and the inspector port published. Production gets
production dependencies, the build output, `node` as its command,
`NODE_ENV=production`, and no debug port — `--inspect` is a remote-execution
channel, so it is the one item on that list that is a security issue rather than a
size one.

**★ How does `--target` interact with the build cache?**
It builds the named stage and stops, so stages after it never run. Stages the
target does not depend on are skipped entirely, which is why a `dev` build costs
nothing for production-only steps, and why the `deps` and `build` stages'
caches stay independent of each other.

**Where does the dev-only configuration belong in Compose, and why there?**
In `compose.override.yaml`, which is merged automatically for a bare
`docker compose up` and suppressed the moment any `-f` is passed. That asymmetry
is the safety property: a production invocation names its files and therefore
cannot inherit a bind mount or a published debugger from a file that happened to
be in the directory.

**Should production images contain source maps?**
It is a decision to make, not a default to inherit. They make stack traces
readable and they also hand your source to anyone who can pull the image. The
usual answer is to generate them, upload them to the error tracker, and keep them
out of the image.

---

← Prev: [Containerising a Node/Express API](01-node-api-dockerfile/README.md) · Index: [Phase 9](README.md) · Next → [PostgreSQL in a container](03-postgres-in-a-container/README.md)
