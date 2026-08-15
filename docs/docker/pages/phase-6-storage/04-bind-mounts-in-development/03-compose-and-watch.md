---
title: "Compose in development, and watch"
sidebar_label: "03 · Compose and watch"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — Compose file watch](https://docs.docker.com/compose/how-tos/file-watch/),
> [Compose file reference — services](https://docs.docker.com/reference/compose-file/services/),
> [Docker — merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/) and
> [Podman — podman-compose](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
> **No sandbox** — no console output on this page.

**Compose is where the development mount stops being a flag you remember and
becomes a file you commit — and `develop.watch` is where you stop needing the
mount at all.** Sync copies changed files into the container instead of covering
the container's filesystem with yours, which removes the `node_modules` trap by
removing its cause.

## The dev Compose file

```yaml
services:
  api:
    build:
      context: .
      target: dev              # a multi-stage build's development stage
    command: npm run dev
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
    volumes:
      - ./src:/app/src         # only what you edit
      - ./package.json:/app/package.json:ro
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: devonly
    volumes:
      - pgdata:/var/lib/postgresql/data     # a volume, never a host directory
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

Two habits worth taking from that file:

- **The database is a named volume**, so it survives `down` and dies only on
  `down -v`. A host directory here would cost you the performance of page 12 and
  the ownership problems of page 05, for nothing.
- **The source mount is narrow and the config mount is read-only.** Both are
  chunk 01's rules, written down where the whole team gets them.

## Override files, so production is not carrying dev mounts

Compose reads `compose.yaml` and, if it exists, `compose.override.yaml`
automatically, merging the second over the first. That is the idiomatic split:

```
compose.yaml            # the service definitions everyone shares
compose.override.yaml   # bind mounts, dev command, exposed debugger port
compose.prod.yaml       # what CI and the server use
```

```bash
docker compose up                                  # base + override, automatically
docker compose -f compose.yaml -f compose.prod.yaml up -d   # base + prod, explicitly
```

⚠️ **Naming the files explicitly with `-f` suppresses the automatic override.**
That is the point — a production invocation must not silently pick up
`compose.override.yaml` because it happened to be in the working directory.
Merge rules are per-key: scalars are replaced, and sequences such as `volumes:`
and `ports:` are appended, which is a common surprise when you meant to replace
a list rather than add to it.

## `develop.watch`

`watch` reacts to changes on the host by acting on the container, rather than by
sharing a filesystem with it. Three actions are available:

| Action | What Compose does |
|---|---|
| **`sync`** | *"Compose makes sure any changes made to files on your host automatically match with the corresponding files within the service container."* |
| **`rebuild`** | *"Compose automatically builds a new image with BuildKit and replaces the running service container."* |
| **`sync+restart`** | *"Compose synchronizes your changes with the service containers and restarts them."* |

```yaml
services:
  api:
    build: .
    command: npm start
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - node_modules/
        - action: sync+restart
          path: ./config
          target: /app/config
        - action: rebuild
          path: package.json
```

```bash
docker compose watch          # watch events on their own, separate from app logs
docker compose up --watch     # the same, interleaved with the logs
```

Read that block as a policy rather than three settings: **source changes sync,
config changes sync and restart the process, and a dependency change rebuilds
the image.** The last line is the one that matters — `package.json` changing
triggers a real rebuild, so a new dependency is installed properly, inside the
container, for the container's platform. That is the failure mode of the
shadowing-volume fix, gone.

Other fields:

- **`path`** — the host source, relative to the project directory.
- **`target`** — the destination inside the container. Required for `sync`
  actions; `rebuild` does not need one.
- **`ignore`** — patterns relative to `path`. Put `node_modules/` here.
- **`initial_sync`** — synchronise before the watch session starts, so the
  container begins from your current tree rather than the image's.

⚠️ **The target path must be writable by the container's user.** The
documentation is explicit that files should normally be copied in during the
build with `COPY --chown` so ownership is right — a container running as a
non-root user ([Phase 3, page 09](../../phase-3-dockerfile/09-user.md)) cannot
receive a sync into a root-owned directory.

## Watch or mount?

| | Bind mount | `watch` with `sync` |
|---|---|---|
| The container's filesystem | **covered** by yours | its own; files are copied in |
| `node_modules` trap | yes, needs one of the four fixes | **no** — nothing is obscured |
| New dependency | manual rebuild, and possibly `down -v` | `action: rebuild` on `package.json` |
| Native modules | the host copy can leak in | cannot — the image's own tree is untouched |
| Event delivery on macOS/Windows | needs polling flags | Compose does the watching on the host |
| Files written by the container | land in your working tree | stay in the container |
| Editor sees generated files | yes | **no** — this is the real trade-off |

That last row is the honest cost. Anything the container generates — a code
generator's output, a migration file, a formatter's rewrite — is invisible to
your editor under `sync`, because the copy only goes one way. Where a workflow
depends on reading generated files, a narrow bind mount on *that* directory,
alongside `watch` for the rest, is a reasonable hybrid.

## Docker and Podman

`develop.watch` is a **Compose** feature, not an engine feature, so what matters
is which Compose you are running.

`podman compose` is *"a thin wrapper around an external compose provider such as
docker-compose or podman-compose"*. The provider is chosen by
`compose_providers` in the `[engine]` table of `containers.conf`, or by the
`PODMAN_COMPOSE_PROVIDER` environment variable, and **`docker-compose` takes
precedence when both are installed**. By default the wrapper *"will emit a
warning saying that it executes an external command"*, silenced with
`compose_warning_logs=false` or `PODMAN_COMPOSE_WARNING_LOGS=false`.

**So: `docker compose`'s features, including `watch`, are available under Podman
exactly when the provider is `docker-compose`.** With `podman-compose` as the
provider, treat anything beyond the core Compose Specification as unsupported
until you have checked. Everything else on this page — the override-file split,
the narrow mounts, the named volume for the database — works either way. Phase 8
is the full Compose treatment.

## Gotchas

**Symptom:** A production deploy came up with the development bind mounts
applied.
**Cause:** `docker compose up` in a directory containing
`compose.override.yaml`, which is merged automatically.
**Fix:** Name the files explicitly for anything non-local:
`-f compose.yaml -f compose.prod.yaml`. Keep every dev-only mount in the
override file, never in the base.

**Symptom:** You meant to replace `ports:` in an override and ended up with both
sets.
**Cause:** Compose merges sequences by appending, not by replacing.
**Fix:** Restructure so the base file does not declare the list you intend to
override, or use `!reset` / `!override` tags on that key.

**Symptom:** `docker compose watch` syncs nothing, or errors on permissions.
**Cause:** The `target` directory is owned by root while the container runs as a
non-root user.
**Fix:** `COPY --chown=app:app` the directory during the build so the running
user owns it, then re-run `watch`.

**Symptom:** `watch` triggers a full rebuild on every keystroke.
**Cause:** A `rebuild` rule with too broad a `path` — `.` rather than
`package.json`.
**Fix:** `rebuild` belongs on the dependency manifest and the Dockerfile. Source
directories get `sync` or `sync+restart`.

## Interview questions

**★ How does `docker compose watch` avoid the `node_modules` trap entirely?**
Because it copies changed files into the container instead of mounting your
filesystem over the container's. Nothing is obscured, so the image's
`node_modules` stays reachable, and a `rebuild` rule on `package.json` installs
new dependencies properly inside the container for its own platform — which is
exactly what the shadowing-volume fix cannot do.

**★ What are the three watch actions and when do you use each?**
`sync` copies changed files in — for source a running process re-reads or a
watcher notices. `sync+restart` copies and restarts the container — for config a
process only reads at start-up. `rebuild` builds a new image with BuildKit and
replaces the container — for `package.json`, the lockfile and the Dockerfile.

**★ What is the trade-off you accept by choosing `sync` over a bind mount?**
The copy goes one way. Anything the container generates — code generation,
migrations, a formatter's output — never appears in your working tree, because
the container's filesystem is its own. Where that matters, bind-mount that one
directory and let `watch` handle the rest.

**Why does the override-file split matter, and how does it go wrong?**
`compose.override.yaml` is merged automatically over `compose.yaml`, so
development mounts and commands apply locally without touching the shared
definitions. It goes wrong when a non-local invocation runs plain
`docker compose up` in a directory that contains the override — always name the
files with `-f` outside development.

**Does any of this work under Podman?**
`watch` is a Compose feature, and `podman compose` is a thin wrapper around an
external provider — `docker-compose` or `podman-compose`, selected by
`compose_providers` in `containers.conf` or `PODMAN_COMPOSE_PROVIDER`, with
`docker-compose` winning when both are present. With `docker-compose` as the
provider you get `watch`; with `podman-compose`, assume only the core Compose
Specification until you have checked.

---

← Prev: [The `node_modules` trap](02-the-node-modules-trap.md) · Index: [Bind mounts in development](README.md) · Next → **File ownership and UID mismatch** *(not written yet)*
