---
title: "Bind mounts and tmpfs"
sidebar_label: "02 · Bind mounts and tmpfs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/),
> [Compose file reference — services](https://docs.docker.com/reference/compose-file/services/) and
> [Podman — podman-run](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**A bind mount hides whatever was at that path; a `tmpfs` mount puts an empty
filesystem in RAM there.** Neither copies anything from the image, which is
exactly where they part company with volumes — and exactly where the bugs are.

## Bind mounts

A bind mount maps a path that already exists on the host into the container.
Docker's documentation puts it plainly: *"a file or directory on the host machine
is mounted from the host into a container"*. There is no engine-managed object,
nothing in `docker volume ls`, and no lifecycle beyond the host filesystem's own.

```bash
docker run --mount type=bind,src="$(pwd)",dst=/app node:22
docker run -v "$(pwd)":/app node:22                          # same thing
docker run --mount type=bind,src="$(pwd)/nginx.conf",dst=/etc/nginx/nginx.conf,readonly nginx
```

**The source must be an absolute path** in `docker run` — `"$(pwd)"` is the
portable habit. In Compose it is different and better: a relative path is
resolved against the project directory, so `./src:/app/src` is both normal and
correct there.

### Bind mounts obscure, they do not merge

The contrast with volumes is the single most important fact in this topic. From
the bind-mount documentation:

> *"the directory's existing contents are obscured by the bind mount"*

Mount a host directory over a container path that already has files, and those
files are **not deleted and not merged** — they are simply not visible while the
mount is in place, exactly as a Linux mount over a non-empty directory behaves.
Remove the mount and they are back, untouched, because they were never modified:
they are still in the image's read-only layers.

| | Volume over a non-empty container directory | Bind mount over a non-empty container directory |
|---|---|---|
| First time | image content is **copied into** the volume | image content is **hidden** |
| Later | volume content wins; the image is ignored | host content wins, always |
| Undo the mount | volume keeps its copy | image's files reappear |

Those rows explain, between them, the `node_modules` trap, "why is my volume not
empty?", and "why did mounting my source directory break the container" — all
three are this table. Page 04 walks the `node_modules` case end to end.

### The other bind-mount options

- **`readonly`** (or `ro`) — the container cannot write to your host filesystem.
  Correct for every mounted config file, and cheap insurance against a container
  rewriting something on your laptop.
- **`bind-create-src`** — opt in to `--mount` creating a missing source path.
  That is `-v`'s unconditional default behaviour, and the subject of page 03.
- **Bind propagation** — `rprivate` (the default), `private`, `shared`, `slave`,
  `rshared`, `rslave`. This controls whether mounts made *inside* the
  bind-mounted tree propagate between host and container. You need it roughly
  never; when you do — a container managing mounts for the host — you already
  know why.

⚠️ **A bind mount is a hole in the container's isolation, by design.** The
container writes to your real filesystem with whatever privileges it has.
`-v /:/host` is the classic container escape, and mounting the Docker socket
(`/var/run/docker.sock`) hands the container control of the engine. Neither is
a bug; both are reasons to mount narrowly and `readonly` by default.

## `tmpfs` mounts

A `tmpfs` mount is a filesystem in host memory, mounted into the container. The
documentation is explicit about the trade:

> *"a tmpfs mount is temporary, and only persisted in the host memory"*

> *"When the container stops, the tmpfs mount is removed, and files written
> there won't be persisted."*

```bash
docker run --tmpfs /tmp nginx
docker run --mount type=tmpfs,dst=/tmp,tmpfs-size=64m,tmpfs-mode=1777 nginx
```

**Defaults, from the reference:** with `tmpfs-size` unset, *"the default maximum
size of a tmpfs volume is 50% of the host's total RAM"*, and `tmpfs-mode`
*"defaults to `1777` or world-writable"*.

Three limitations decide when you can use it:

- **Linux only** — *"This functionality is only available if you're running
  Docker on Linux."* On Docker Desktop it applies inside the Linux VM, which is
  usually what you want anyway.
- **Not shareable** — *"You can't share tmpfs mounts between containers."*
  There is no `tmpfs` equivalent of one volume mounted by two services.
- **It is RAM.** Filling an unbounded `tmpfs` is your *host* running out of
  memory, not the container hitting a disk-full error. Always set `tmpfs-size`
  on anything a request can write to.

The two jobs it is genuinely right for: **the writable scratch space a
`--read-only` container still needs** (page 08), and **a secret that must never
touch disk**.

## All three in Compose

```yaml
services:
  api:
    image: myapp:1.4
    read_only: true
    volumes:
      - uploads:/srv/uploads                    # named volume, short syntax
      - ./src:/app/src                          # bind mount, relative to the project
      - ./nginx.conf:/etc/nginx/nginx.conf:ro   # bind mount, read-only
    tmpfs:
      - /tmp

  db:
    image: postgres:17
    volumes:
      - type: volume                            # long syntax — explicit, and the
        source: pgdata                          # only way to reach some options
        target: /var/lib/postgresql/data
        volume:
          nocopy: false

volumes:
  uploads:
  pgdata:
```

**Compose infers the type from the short syntax**: a first field with a `/` or a
`.` is a bind mount, anything else is a named volume. That inference is the
reason `- pgdata:/var/lib/postgresql/data` and `- ./pgdata:/var/lib/postgresql/data`
are one character apart and completely different things — the first is an
engine-managed volume, the second a directory in your repository.

⚠️ **The top-level `volumes:` block is what makes `docker compose down -v`
dangerous.** `-v` removes exactly the named volumes the file declares. That is
the command that deletes your development database, and it is one keystroke away
from the command that does not.

## Docker and Podman

**All three mount types work the same way**, with the same `--mount` and `-v`
syntax and the same `podman volume create / ls / inspect / rm / prune`
subcommands. Four differences are real:

1. **Location.** Rootless Podman keeps volumes under
   `~/.local/share/containers/storage/volumes/`, rootful Podman under
   `/var/lib/containers/storage/volumes/`. The two stores are separate — a
   volume created rootless is invisible to `sudo podman volume ls`.
2. **SELinux.** On Fedora, RHEL and CentOS a bind mount without `:z` or `:Z`
   gets "permission denied" even when the file mode is right. Page 07.
3. **Ownership.** Rootless bind mounts land in the middle of a UID mapping, so a
   file the container writes is owned on the host by a high subordinate UID.
   Pages 05 and 09.
4. **Extra mount types.** Podman's `--mount` also accepts `type=image` (another
   image's rootfs, read-only), `type=devpts` and `type=ramfs`. Useful, and not
   portable to Docker.

## Gotchas

**Symptom:** Mounting the project directory into `/app` made the container fail
to start with "module not found".
**Cause:** The bind mount obscured everything the image had installed at `/app`,
including `node_modules`.
**Fix:** Mount the source *subdirectory* only, or shadow `node_modules` with an
anonymous volume. Page 04 is the full treatment.

**Symptom:** `--mount type=bind` fails with an error about the source path, but
the same path worked yesterday with `-v`.
**Cause:** The path does not exist. `-v` creates it as an empty directory;
`--mount` refuses unless you pass `bind-create-src`.
**Fix:** Fix the path. This is `--mount` doing its job — page 03.

**Symptom:** A `tmpfs` mount worked in CI and does nothing on a colleague's
machine.
**Cause:** `tmpfs` is Linux-only. It works on Docker Desktop because there is a
Linux VM underneath, and is unsupported for native Windows containers.
**Fix:** Fine for Linux hosts and Desktop's Linux containers; do not make it the
only writable path in an image that has to run anywhere.

**Symptom:** The host ran out of memory while a container was handling uploads.
**Cause:** An unbounded `tmpfs` — the default cap is half of host RAM, and
`tmpfs` pages *are* RAM.
**Fix:** Always set `tmpfs-size` on any `tmpfs` a request can write to, sized for
the worst concurrent case rather than the average one.

## Interview questions

**★ What is the single biggest behavioural difference between a volume and a
bind mount at the same path?**
What happens to the image's existing content there. An **empty volume is
pre-populated** with it — files, ownership and permissions copied in. A **bind
mount obscures** it: the files are still in the image but invisible while the
mount is in place, and they reappear if you remove it. That one difference
explains the `node_modules` trap and "why isn't my volume empty".

**★ Why is a named volume the right home for a database and a bind mount is
not?**
The volume is engine-managed, so it is not entangled with host paths, host UIDs
or host SELinux labels; it is listable and backup-able as an object; and it
avoids the bind-mount performance penalty on macOS and Windows, where every
access crosses a VM boundary (page 12). A bind mount ties the database to one
machine's directory layout and, on Desktop, to a filesystem translation layer
that databases behave badly on.

**★ What are the practical limits of `tmpfs`, and what is it actually for?**
Linux only, not shareable between containers, removed when the container stops,
and it consumes host RAM — default maximum 50% of host memory, default mode
`1777`. It is for the scratch space a `--read-only` container still needs, and
for a secret that must never touch disk. Anything user-writable needs an
explicit `tmpfs-size`, because filling it is a host OOM rather than a disk-full
error.

**How does Compose decide whether `- something:/data` is a volume or a bind
mount?**
By the shape of the first field: a path containing `/` or starting with `.` is a
bind mount, anything else is a named volume. So `pgdata:/data` and `./pgdata:/data`
differ by two characters and are completely different objects — one managed by
the engine, one a directory in your repository.

**Why is a bind mount a security consideration and a volume less so?**
Because it is a deliberate hole in the container's isolation into the real host
filesystem, written to with whatever privileges the container has. `-v /:/host`
is the classic escape, and mounting `/var/run/docker.sock` hands over the
engine. Mount narrowly, mount `readonly` unless writes are the point, and never
mount a parent directory when a child will do.

**Is any of this different under Podman?**
The three types, the flags and the `volume` subcommands are the same. What
differs: rootless volumes live under your home directory in a store `sudo
podman` cannot see, SELinux hosts need `:z`/`:Z` on bind mounts, rootless UID
mapping changes who owns bind-mounted files, and Podman accepts a few extra
mount types such as `type=image`.

---

← Prev: [The three types, and named volumes](01-named-volumes.md) · Index: [Volumes, binds and tmpfs](README.md) · Next → [`-v` short syntax vs `--mount`](../03-v-vs-mount.md)
