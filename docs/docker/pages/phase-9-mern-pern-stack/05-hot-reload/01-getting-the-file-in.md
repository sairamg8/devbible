---
title: "Getting the file in"
sidebar_label: "01 · Getting the file in"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — Compose file watch](https://docs.docker.com/compose/how-tos/file-watch/),
> [the Compose `develop` element](https://docs.docker.com/reference/compose-file/develop/),
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/) and
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/).
> **No sandbox** — no console output on this page.

**A container's filesystem comes from the image; your editor writes to the host.**
Three mechanisms bridge that gap, they fail differently, and picking the wrong one
is the source of most "hot reload doesn't work in Docker" folklore.

| | How the bytes move | Container FS at that path |
|---|---|---|
| **Bind mount** | the host directory *becomes* the path | **replaced** by yours |
| **`develop.watch` sync** | Compose copies changed files in | its own, unchanged |
| **Rebuild** | a new image, a new container | rebuilt |

## Bind mount: your tree covers theirs

```yaml
services:
  api:
    build:
      context: .
      target: dev
    command: npm run dev
    volumes:
      - ./src:/app/src                        # narrow, deliberate
      - ./package.json:/app/package.json:ro
```

🔴 **Mount narrowly.** `- ./:/app` is the version everyone writes first and it
causes every problem below at once. Mounting `./src` mounts what you actually
edit and leaves the rest of the image alone.

### The `node_modules` trap, mechanically

Mount `./` over `/app` and the image's `/app/node_modules` is **hidden** — not
deleted, just covered, because a mount replaces what is at that path. If your host
has no `node_modules`, the container now has none either and the process dies on
its first `import`. If your host *does* have one, it is worse: those are binaries
built for **your** platform and libc, being loaded by a container that may be
neither ([Phase 2 · Base images](../../phase-2-images-and-registries/05-choosing-a-base-image.md)).

Four fixes, in the order they are worth trying:

| Fix | How | Cost |
|---|---|---|
| **Narrow the mount** | mount `./src`, not `./` | none — nothing is covered |
| **`develop.watch` sync** | copy files in instead of mounting over | the container's writes stay in the container |
| **Anonymous-volume shield** | `- /app/node_modules` after the bind mount | it is **sticky** — see below |
| **Install into a different directory** | `NODE_PATH` outside the mounted tree | unusual; a last resort |

```yaml
    volumes:
      - ./:/app                # hides /app/node_modules …
      - /app/node_modules      # … and this layers a second mount back on top
```

The shield works because an **anonymous volume starts empty and is therefore
populated from the image** at that exact path. It is the documented behaviour of
volumes, not a hack — but it has a real cost.

### 🔴 The anonymous volume goes stale

Once created, that volume is **reused by the recreated container**. Add a
dependency, rebuild the image, `up -d` — and the container still mounts the old
volume with the old `node_modules`. The image has the new package; the container
cannot see it.

```bash
docker compose up -d --build -V     # -V = --renew-anon-volumes
docker compose down -v && docker compose up -d --build
```

**"I installed it and it is not there" is this, almost every time.** `-V` is the
switch that starts anonymous volumes empty again.

## `develop.watch`: copy in, do not cover

```yaml
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
          ignore: [node_modules/]
        - action: sync+restart
          path: ./config
          target: /app/config
        - action: rebuild
          path: package.json
```

```bash
docker compose watch          # events only
docker compose up --watch     # events interleaved with logs
```

**The `node_modules` problem does not arise**, because nothing is covered — and
the `rebuild` rule on `package.json` means a new dependency is installed *inside*
the container, for the container's platform, which the shield can never do
([Phase 8 · `develop.watch`](../../phase-8-compose/13-develop-watch.md)).

Two requirements from the documentation, both easy to trip over: watch is
*"designed to work with services built from local source code using the `build`
attribute"* and does not track services using `image:`; and the image must contain
**`stat`, `mkdir` and `rmdir`** with the target writable by the container's user —
hence `COPY --chown` at build time.

⚠️ **The trade-off is one-way copying.** Files the container generates — a
scaffolder's output, a new migration, a formatter's rewrite — never reach your
editor. Where that matters, bind-mount that one directory and let `watch` handle
the rest.

## Rebuild: not always wrong

```bash
docker compose up -d --build api
```

For a service you touch twice a month — a worker, an admin job — no watcher, no
mount, no shield. The build cache makes it seconds
([Phase 4 · How the layer cache decides](../../phase-4-build-strategy/01-how-the-cache-decides.md)),
and there is nothing to explain to the next person. **Reserve the machinery for
the services you edit all day.**

## Ownership, and Podman

A bind mount arrives with **host** ownership. If the image runs as `node`
(UID 1000) and your files are UID 1000, this is invisible; when the UIDs differ,
the container cannot write — and under **rootless Podman** the mapping shifts
everything, so root-in-container is you-outside and UID 1000 inside is some high
number outside ([Phase 6 · UID mismatch](../../phase-6-storage/05-uid-mismatch/README.md)).

On Fedora and RHEL a bind mount also needs SELinux relabelling — `:z` for shared,
`:Z` for private, and `:Z` relabels **recursively**, which is not what you want on
a directory you also use outside the container
([Phase 6 · SELinux](../../phase-6-storage/07-selinux-z-and-Z.md)).

**`develop.watch` sidesteps both**, because there is no mount — the files are
copied in as the container's own user.

## Gotchas

**Symptom:** The container starts and immediately fails to find a module.
**Cause:** A bind mount of `./` over `/app` hid the image's `node_modules`.
**Fix:** Narrow the mount, add the anonymous-volume shield, or switch to `watch`.

**Symptom:** A newly installed package is missing inside the container even after
`--build`.
**Cause:** The anonymous `node_modules` volume was reused; it is populated once
and then kept.
**Fix:** `up -d --build -V`, or `down -v`. Or use `action: rebuild` on
`package.json` and stop maintaining the shield.

**Symptom:** A native module crashes only inside the container.
**Cause:** A host `node_modules` reached the container through the mount, with
binaries for the wrong platform or libc.
**Fix:** Never mount `node_modules` in. Keep it in `.dockerignore` too, so the
build cannot copy it either.

**Symptom:** The container cannot write to a mounted directory.
**Cause:** Host ownership, or a rootless UID mapping, or an SELinux label.
**Fix:** `:z`/`:Z` on Fedora, matching UIDs or `--userns=keep-id` under Podman —
or avoid the mount entirely with `watch`.

## Interview questions

**★ Explain the `node_modules` trap mechanically, and give two different fixes.**
A mount replaces whatever is at that path, so bind-mounting the project root over
`/app` hides the image's `node_modules` — the files still exist in the image, they
are simply covered. Fix one: mount only `./src`, so nothing is covered. Fix two:
add an anonymous volume at `/app/node_modules`, which layers a second mount on
that one path; because it starts empty it is populated from the image. The second
fix is sticky, though — the volume is reused on recreate, so a new dependency
needs `-V` or `down -v`.

**★ Why does `develop.watch` avoid the problem instead of solving it?**
Because it copies changed files into the container rather than mounting your
filesystem over the container's. Nothing is obscured, so there is nothing to
shield, and a `rebuild` rule on `package.json` installs new dependencies inside
the container for the container's own platform. The cost is that the copy goes one
way: anything the container generates never appears in your working tree.

**★ "I installed a package and the container cannot see it." Diagnose it.**
Almost certainly the anonymous `node_modules` volume being reused by the recreated
container: the rebuilt image has the package, the mounted volume does not.
`docker compose up -d --build -V` renews anonymous volumes; `down -v` is the
bigger hammer. If the project instead mounts a host `node_modules`, the answer is
the opposite — stop doing that, because those binaries are built for the wrong
platform.

**When is plain `--build` the right development workflow?**
For services you rarely edit. It needs no mount, no shield and no watcher, the
layer cache makes it fast, and there is nothing surprising for the next person to
learn. Reserve mounts and watchers for the services you are actually iterating on
— the machinery has a maintenance cost that a rarely-touched worker does not repay.

---

← Prev: [Hot reload inside a container](README.md) · Index: [Phase 9](../README.md) · Next → [Making the change noticed](02-making-it-noticed.md)
