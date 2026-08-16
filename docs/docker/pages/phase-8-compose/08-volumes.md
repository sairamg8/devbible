---
title: "Volumes in Compose"
sidebar_label: "08 · Volumes"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/),
> [the `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/).
> **No sandbox** — no console output on this page.

**Three kinds of mount, three different jobs, and one trick that makes the
development loop work.** Named volumes hold data you must not lose. Bind mounts put
your editor's files inside the container. Anonymous volumes are mostly an accident
— except once, where they are the answer.

## The three kinds, and when each is right

```yaml
services:
  db:
    image: postgres:18
    volumes:
      - pgdata:/var/lib/postgresql           # named volume — data (18+ path)
  api:
    build: .
    volumes:
      - ./src:/app/src                       # bind mount — source
      - /app/node_modules                    # anonymous volume — a shield

volumes:
  pgdata:
```

🔴 **The container path is the image's business, and it changes.** The official
`postgres` image moved its declared `VOLUME` from `/var/lib/postgresql/data` to
**`/var/lib/postgresql`** in version 18, and its documentation warns that mounts
at the old path *"WILL NOT PERSIST database data"*. Nothing errors — the volume
exists, the container runs, and the data is in the writable layer. **Read the
image's documentation for the path rather than copying one from a tutorial**, and
see [Phase 9 · PostgreSQL in a container](../phase-9-mern-pern-stack/03-postgres-in-a-container/01-the-data-directory.md).

| Kind | How you write it | What it is for |
|---|---|---|
| **Named volume** | `name:/path/in/container`, plus an entry under top-level `volumes:` | Data that must outlive a container: databases, uploads, caches worth keeping |
| **Bind mount** | `./host/path:/container/path` | Source code in development, and configuration files |
| **Anonymous volume** | `/container/path` — a single path, no source | Almost never on purpose. The `node_modules` case below is the exception |

The short syntax decides which one you meant by looking at the string
([page 04](04-services-block/02-how-it-is-wired.md)), which is why the long form —
with an explicit `type: volume` or `type: bind` — is better in anything shared.

## Named volumes must be declared twice

This catches everyone once:

```yaml
services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql        # 1. used here

volumes:                                   # 2. and declared here
  pgdata:
```

The top-level element declares "named volumes that can be reused across multiple
services", and to share one you "explicitly grant each service access by using the
volumes attribute". The empty value under `pgdata:` is not a mistake — it means "the
defaults", which is the local driver.

Compose scopes the volume to the project, so the real volume is
`<project>_pgdata`. Two useful keys change that:

| Key | Effect |
|---|---|
| `name` | "The name is used as is and is not scoped with the stack name" — an escape hatch, and a way to parameterise from an environment variable |
| `external: true` | "This volume already exists on the platform and its lifecycle is managed outside of that of the application." Compose does not create it and errors if it is absent. Every attribute except `name` becomes irrelevant |

`external: true` is also a **safety device**: `docker compose down -v` will not
delete a volume Compose did not create. For a volume holding data you would be
sorry to lose on a shared machine, that is a reasonable belt-and-braces measure.

Compose sets `com.docker.compose.project` and `com.docker.compose.volume` labels
automatically, which is how `docker volume ls` can be filtered back to a project.

## 🔴 The `node_modules` trick

The single most useful pattern in this phase, and it looks like nonsense until you
see why.

```yaml
services:
  api:
    build: .
    volumes:
      - ./:/app                 # your source, live-edited
      - /app/node_modules       # ← an anonymous volume, deliberately
```

**The problem.** The image was built with `npm ci`, so `/app/node_modules` inside the
image is populated and correct for the container's platform. Then the bind mount
lands `./` on top of `/app` — and a mount **hides** whatever was underneath it. Your
host directory becomes `/app`, so the container now sees *your* `node_modules`: the
wrong platform's native binaries if you are on macOS or Windows, or nothing at all
if you never ran `npm install` locally.

**The fix.** Mounting an anonymous volume at `/app/node_modules` puts a second mount
*on top of the bind mount*, at that one path. Because the volume is empty when first
created, the engine populates it from the image's contents at that path — so the
container gets back the `node_modules` the image built, while the rest of `/app`
stays live-editable.

Two consequences worth knowing before you rely on it:

- **The anonymous volume is sticky.** Adding a dependency and rebuilding the image
  does **not** refresh it — the existing volume is reused. Bring the change through
  with `docker compose up -d --build -V` (`--renew-anon-volumes`) or
  `docker compose down -v`. This is the most common "I installed the package and the
  container cannot find it" report.
- **It is a workaround, not the only option.** `develop.watch` with `sync` avoids
  the whole shadowing problem by not bind-mounting at all
  ([page 13](13-develop-watch.md)), and a named volume in place of the anonymous one
  makes the lifecycle explicit at the cost of a line in `volumes:`.

## Read-only, and `tmpfs`

```yaml
services:
  api:
    volumes:
      - ./config:/etc/app:ro          # short syntax
      - type: bind
        source: ./config
        target: /etc/app
        read_only: true               # long syntax, same thing
      - type: tmpfs
        target: /tmp
```

`:ro` on configuration you mount in is close to free and prevents a container from
scribbling on your working tree. `tmpfs` puts a path in RAM — it never touches disk
and never survives the container, which is what you want for scratch space when the
root filesystem is read-only.

## What survives what

| Action | Named volume | Bind mount | Anonymous volume |
|---|---|---|---|
| Container recreated by `up` | ✅ survives | ✅ (it is your directory) | ✅ **reused** — this is the sticky case |
| `docker compose down` | ✅ survives | ✅ | ✅ survives |
| `docker compose down -v` | ⛔ **deleted** | ✅ (untouched — it is not Compose's) | ⛔ **deleted** |
| `up -V` / `--renew-anon-volumes` | ✅ survives | ✅ | ⛔ recreated empty |

`down -v` removes "named volumes declared in the `volumes` section of the Compose
file and anonymous volumes attached to containers"
([page 03](03-up-and-down/02-down.md)). Bind mounts are host directories — Compose
never deletes them.

## Podman

Two divergences that change what you do, not just what you know:

- **Rootless ownership.** Files a container writes into a bind mount are owned by a
  subordinate UID on the host — root inside the container is *you*, but UID 1000
  inside maps to something like 100999 outside. The fix is `podman unshare chown`,
  **never `sudo chown`**, and `--userns=keep-id` when you want the container's user
  to *be* your host user
  ([Phase 0, page 11](../phase-0-what-a-container-is/11-rootless.md)).
- **SELinux.** On Fedora, RHEL and CentOS a bind mount needs `:z` (shared) or `:Z`
  (private) or the container gets permission denied
  ([Phase 0, page 10](../phase-0-what-a-container-is/10-seccomp-apparmor-selinux.md)).
  `:Z` relabels recursively, which is a real consideration on a large directory.
- **Rootless volumes live under your home directory** and bill against its quota
  ([Phase 2, page 13](../phase-2-images-and-registries/13-storage-on-disk.md)).

The mechanics are [Phase 6 · Storage](../phase-6-storage/README.md); this page is only the
Compose-facing half.

## Gotchas

**Symptom:** `service "db" refers to undefined volume pgdata`.
**Cause:** The volume is used in a service but not declared under the top-level
`volumes:` key.
**Fix:** Add `pgdata:` at the top level. An empty value is correct and means "local
driver, defaults".

**Symptom:** You installed a package, rebuilt, and the container still cannot find
it.
**Cause:** The anonymous `node_modules` volume was reused rather than repopulated.
**Fix:** `docker compose up -d --build -V`, or `down -v` and up again. Rebuilding the
image alone does not touch an existing anonymous volume.

**Symptom:** Native modules fail with an architecture or ABI error only inside the
container.
**Cause:** A bind mount of the project root shadowed the image's `node_modules` with
the host's, built for a different platform.
**Fix:** The anonymous-volume shield above, or `develop.watch` with `sync` so nothing
is shadowed.

**Symptom:** The database survived `down` but not the next `down -v`, and nobody
meant to run it.
**Cause:** `-v` deletes named volumes declared in the file.
**Fix:** For a volume that must not be casually destroyed, create it out of band and
mark it `external: true` — Compose then refuses to manage its lifecycle at all.

**Symptom:** Permission denied writing to a bind mount, on Fedora or RHEL.
**Cause:** SELinux labelling, not file permissions.
**Fix:** `:z` or `:Z` on the mount. Do **not** disable SELinux, and do not `chmod
777` the directory — both replace a specific fix with a permanent hole.

## Interview questions

**★ What is the difference between a named volume, a bind mount and an anonymous
volume?**
A named volume is managed by the engine, declared under the top-level `volumes:`
key, scoped to the project, and survives `down` but not `down -v` — it is where data
belongs. A bind mount maps a host directory in, which is how source code is
live-edited in development; Compose never deletes it. An anonymous volume is a
mount target with no source: it is created automatically, reused when the container
is recreated, and deleted by `down -v`. It is almost always accidental — the
exception being the `node_modules` shield.

**★ Explain the `- /app/node_modules` line in a development compose file.**
The service bind-mounts the project root at `/app`, and a mount hides what was
underneath it — so the container would see the host's `node_modules` instead of the
one the image built, which is wrong or missing. Mounting an anonymous volume at
`/app/node_modules` layers a second mount on top of the bind mount at that one path;
because it starts empty it is populated from the image, so the container gets the
image's dependencies while the rest of the tree stays live.

**★ You added a dependency, rebuilt, and the container still cannot find it. Why?**
The anonymous `node_modules` volume is reused across container recreation — it is
populated only when first created. Rebuilding the image does not refresh it. Use
`up -d --build -V` to renew anonymous volumes, or `down -v`.

**Why must a named volume appear twice in the file?**
Once inside the service that mounts it, and once under the top-level `volumes:` key
where it is declared. The top-level declaration is what lets several services share
the same volume, and each of them still has to grant itself access with its own
`volumes:` entry.

**What does `external: true` do to a volume, and when is that useful?**
It tells Compose the volume's lifecycle is managed elsewhere: Compose will not
create it, errors if it is missing, and will not delete it on `down -v`. It is how
you share one volume between projects, and it is a deliberate guard for data you
would be sorry to lose to a stray `-v`.

**What is the ownership problem with bind mounts under rootless Podman, and what is
the wrong fix?**
Files the container writes are owned by a subordinate UID on the host — UID 1000
inside maps to something like 100999 outside — so they look unowned to you. The fix
is `podman unshare chown`, or `--userns=keep-id` so the container's user is your
host user. The wrong fix is `sudo chown`, which changes ownership in the host's
namespace and breaks it from the container's side instead.

---

← Prev: [Networks in Compose](07-networks.md) · Index: [Phase 8](README.md) · Next → [The project name](09-project-name.md)
