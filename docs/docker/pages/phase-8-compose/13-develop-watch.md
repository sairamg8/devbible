---
title: "develop.watch"
sidebar_label: "13 · develop.watch"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/),
> [the `develop` element](https://docs.docker.com/reference/compose-file/develop/),
> [`docker compose watch`](https://docs.docker.com/reference/cli/docker/compose/watch/) and
> [`podman-compose(1)`](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
> **No sandbox** — no console output on this page.

**A bind mount makes the container read your filesystem; `watch` makes Compose
push changes into the container.** That inversion is the whole feature — nothing
of the container's own filesystem is covered, so the `node_modules` problem from
[page 08](08-volumes.md) has no cause to be fixed.

## What it is, and what it needs

`develop.watch` is a per-service list of rules. Compose monitors the host paths
and acts on the container when they change. The `develop` section has been in
Compose since **v2.22.0**.

The documented constraint is the one to remember: watch is *"designed to work
with services built from local source code using the `build` attribute"* and
**does not track changes for services relying on pre-built images specified by
the `image` attribute**. Watching a service you only pull is not a supported
configuration — there is nothing to rebuild and nothing local that corresponds
to its contents.

Two further requirements come from *how* the sync is performed — Compose runs
commands inside the container to place files:

- The image must contain **`stat`, `mkdir` and `rmdir`**. A `scratch` or
  distroless image ([Phase 2, page 05](../phase-2-images-and-registries/05-choosing-a-base-image.md))
  has none of them, so it cannot be a sync target.
- **The container's user must be able to write the target path.** The docs'
  recommendation is to establish ownership at build time with `COPY --chown`
  rather than fixing it at run time.

```dockerfile
FROM node:24
RUN useradd -ms /bin/sh -u 1001 app
USER app
COPY --chown=app:app . /app
```

## The five actions

| Action | What Compose does | Since |
|---|---|---|
| **`sync`** | *"Compose makes sure any changes made to files on your host automatically match with the corresponding files within the service container."* | v2.22.0 |
| **`rebuild`** | *"Compose automatically builds a new image with BuildKit and replaces the running service container."* Equivalent to `up --build <svc>` | v2.22.0 |
| **`sync+restart`** | *"Compose synchronizes your changes with the service containers and restarts them."* | v2.23.0 |
| **`restart`** | Restarts the service container without syncing anything | v2.32.0 |
| **`sync+exec`** | Syncs, then runs a command **inside** the container | v2.32.0 |

Read a watch block as a policy, not as settings:

```yaml
services:
  api:
    build: .
    command: npm start
    develop:
      watch:
        - action: sync                 # source: the process re-reads it
          path: ./src
          target: /app/src
          ignore:
            - node_modules/

        - action: sync+restart         # config: only read at start-up
          path: ./config
          target: /app/config

        - action: rebuild              # dependencies: a new image is required
          path: package.json
```

**Source syncs · config syncs and restarts · the manifest rebuilds.** The last
rule is the one that earns the feature: a changed `package.json` triggers a real
build, so the dependency is installed inside the container, for the container's
platform — which is exactly what a shadowing anonymous volume cannot do.

## The fields

| Field | Meaning |
|---|---|
| **`path`** (required) | The host path to watch, **relative to the project directory** |
| **`action`** (required) | One of the five above |
| **`target`** | Where the files land inside the container. Applies to the `sync` actions |
| **`ignore`** | `.dockerignore` syntax; patterns are relative to **`path`**, not to the project |
| **`include`** | The inverse — only matching files trigger the rule |
| **`initial_sync`** | Sync once when the session starts, so the container begins from your tree rather than the image's |

`target` is a mapping, not a mount: with `path: ./app/html` and
`target: /app/html`, a change to `./app/html/index.html` appears at
`/app/html/index.html` in the container.

⚠️ **A pattern starting with `*` must be quoted** — YAML reads a bare leading
asterisk as an alias reference:

```yaml
        - action: sync
          path: ./src
          target: /app/src
          include:
            - "*.ts"
```

## `sync+exec`

`sync+exec` covers the case where a change needs a *command* run rather than a
process bounced — regenerating a client, applying a migration, rebuilding a CSS
bundle:

```yaml
        - action: sync+exec
          path: ./prisma
          target: /app/prisma
          exec:
            command: npx prisma generate
            user: app                  # defaults to the main command's user
            working_dir: /app          # defaults to the main command's directory
            environment:
              - NODE_ENV=development
            privileged: false
```

Only `command` is required, in shell or exec form. Preferring `sync+exec` over
`sync+restart` keeps the process — and its warm caches and open connections —
alive across the change.

## Running it

```bash
docker compose watch          # watch events only, no application logs
docker compose up --watch     # the same, interleaved with the logs
```

`docker compose watch` is documented as *"watch build context for service and
rebuild/refresh containers when files are updated"*, and takes three options:

| Option | Default | What it does |
|---|---|---|
| `--no-up` | — | *"Do not build & start services before watching"* — attach to a stack that is already up |
| `--prune` | `true` | *"Prune dangling images on rebuild"* — on by default, so `rebuild` rules do not accumulate garbage |
| `--quiet` | — | Hide build output |

Use `watch` in one terminal and `logs -f` in another
([page 14](14-day-to-day-commands.md)) when the rebuild chatter and the
application output start competing.

## Path rules that catch people out

- **All paths are relative to the project directory**, "apart from ignore file
  patterns" — those are relative to the rule's own `path`.
- **Directories are watched recursively.**
- 🔴 **Glob patterns are not supported** in `path`. `./src/**/*.ts` is not a
  path; watch the directory and narrow with `include`.
- **`.dockerignore` rules apply**, and `ignore` adds to them rather than
  replacing them. Common editor temporary and backup files, and `.git`, are
  ignored automatically.
- **Syncing `node_modules/` is explicitly not recommended** — the docs cite
  performance and multi-platform portability. It belongs in `ignore`, and its
  changes belong to a `rebuild` rule on the manifest.

## Watch or bind mount?

The documentation's own framing is that watch *"doesn't replace bind mounts but
complements them with greater granularity"*, and both are legitimate:

| | Bind mount | `watch` with `sync` |
|---|---|---|
| The container's filesystem at that path | **covered** by yours | its own; files are copied in |
| `node_modules` shadowing | needs the anonymous-volume fix | does not arise |
| A new dependency | rebuild, often `up -d --build -V` | a `rebuild` rule on `package.json` |
| Files the **container** writes | appear in your working tree | **stay in the container** |

That last row is the real trade-off and the reason to keep both tools. Anything
generated inside the container — a scaffolder's output, a new migration file, a
formatter's rewrite — is invisible to your editor under `sync`, because the copy
only goes one way. The pragmatic shape is `watch` for source plus a narrow bind
mount on the one directory whose output you need to read. The mount side of this
argument is
[Phase 6, page 04](../phase-6-storage/04-bind-mounts-in-development/README.md).

## Podman

`develop.watch` is a **Compose** feature, not an engine feature, so what decides
support is the compose provider rather than the runtime. `podman compose` is
*"a thin wrapper around an external compose provider"* and prefers
`docker-compose` when both are installed — with that provider, watch behaves as
documented. With `podman-compose`, treat anything past the core Specification as
unverified until checked ([page 15](15-podman-compose.md)).

## Gotchas

**Symptom:** `docker compose watch` reports nothing to watch, or ignores a
service entirely.
**Cause:** The service is defined with `image:` and no `build:`. Watch is
designed for services built from local source and does not track changes for
pre-built images.
**Fix:** Give the service a `build:` section, or accept that a pulled image is
not a development target.

**Symptom:** Sync fails with a permission error, or silently places nothing.
**Cause:** The `target` directory is root-owned while the container runs as a
non-root user — or the image lacks `stat`, `mkdir` and `rmdir`.
**Fix:** `COPY --chown=app:app` the directory during the build. Distroless and
`scratch` images cannot be sync targets at all.

**Symptom:** Every keystroke triggers a full image build.
**Cause:** A `rebuild` rule with too broad a `path` — `.` instead of the
manifest.
**Fix:** `rebuild` belongs on `package.json`, the lockfile and the Dockerfile.
Source directories get `sync`, config gets `sync+restart`.

**Symptom:** `path: ./src/**/*.js` matches nothing.
**Cause:** Glob patterns are not supported in `path`.
**Fix:** Watch the directory — it is recursive — and use `include: ["*.js"]`,
quoted, to narrow it.

## Interview questions

**★ What does `develop.watch` do that a bind mount does not?**
It pushes changes into the container instead of covering the container's
filesystem with the host's. Nothing is obscured, so the image's own
`node_modules` stays reachable and the `node_modules` shadowing problem does not
arise; and a `rebuild` rule on `package.json` installs a new dependency properly,
inside the container, for the container's platform. The cost is that files the
container writes never appear in your working tree.

**★ Name the actions and say when each is right.**
`sync` for source a running process or a framework watcher re-reads. `restart`
when the container must be bounced and nothing needs copying. `sync+restart` for
configuration a process only reads at start-up — an `nginx.conf`, say.
`sync+exec` when a change needs a command run inside the container, such as
regenerating a client. `rebuild` for the dependency manifest, the lockfile and
the Dockerfile, where a new image is genuinely required.

**★ Which services can watch actually watch?**
Ones built from local source with `build:`. The documentation is explicit that
watch does not track changes for services relying on pre-built images. The image
must also contain `stat`, `mkdir` and `rmdir`, and the container's user must be
able to write the target path — which is why the recommended pattern is
`COPY --chown` at build time.

**Where are `ignore` patterns relative to?**
To the rule's own `path`, not to the project directory — the one exception to
"all paths are relative to the project directory". `.dockerignore` rules apply on
top, and `ignore` adds to them.

**Why is `path: ./src/**/*.ts` wrong?**
Glob patterns are not supported for `path`. Directories are watched recursively
already, so the correct form is `path: ./src` with `include: ["*.ts"]` — quoted,
because YAML reads a leading `*` as an alias.

**What does `--no-up` give you?**
It attaches the watcher to a stack that is already running instead of building
and starting services first — useful when the stack was brought up with a
different set of files or flags and you only want the file-watching half.

---

← Prev: [`profiles`](12-profiles.md) · Index: [Phase 8](README.md) · Next → [Day-to-day commands](14-day-to-day-commands.md)
