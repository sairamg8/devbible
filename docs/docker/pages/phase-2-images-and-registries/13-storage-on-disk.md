---
title: "Where layers live on disk"
sidebar_label: "13 · Storage on disk"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker — storage drivers](https://docs.docker.com/engine/storage/drivers/),
> [docker system df](https://docs.docker.com/reference/cli/docker/system/df/),
> [dockerd — data-root](https://docs.docker.com/reference/cli/dockerd/) and
> [containers-storage.conf(5)](https://github.com/containers/storage/blob/main/docs/containers-storage.conf.5.md).
> **No sandbox** — no console output on this page.

**Everything the engine stores lives under one root directory, and knowing which
one turns "the disk is full" into a solvable problem.**

## The roots

| Engine | Default location |
|---|---|
| **Docker** (rootful) | `/var/lib/docker` |
| **Docker** (rootless) | `~/.local/share/docker` |
| **Podman** (rootful) | `/var/lib/containers/storage` |
| **Podman** (rootless) | `~/.local/share/containers/storage` |

```bash
docker info | grep -i "docker root dir"
podman info --format '{{.Store.GraphRoot}}'
```

🔴 **The rootless rows are the operationally interesting ones.** Under rootless
Podman — the default on Fedora and RHEL — every image, layer and volume counts
against your **home directory**, and therefore against any home quota. A
developer who has never thought about `/var` filling up can absolutely fill `~`.

## What is inside

Under Docker's root, the directories that matter:

| Directory | Holds |
|---|---|
| `overlay2/` | The layers themselves — almost always the biggest |
| `image/` | Image metadata, the layer database |
| `containers/` | Per-container state **and the JSON log files** |
| `volumes/` | Named and anonymous volume data |
| `buildkit/` | Build cache |
| `network/` | Network state |

The one that catches people is `containers/<id>/<id>-json.log`. With the default
`json-file` driver and no rotation configured, a chatty service writes an
unbounded log file. Phase 10 sets `max-size` and `max-file`; the point here is
that it lives with the container's state, not somewhere you would think to look.

## Do not manage it by hand

**Never delete files under the storage root directly.** The layer database and
the filesystem must agree; removing a directory that the database still
references produces an engine that fails in confusing ways, and there is no
repair tool. Use `docker rm`, `docker rmi`, `docker volume rm` and the prune
commands, which update both.

The one supported blunt instrument is stopping the engine and deleting the
**entire** root — a full reset, losing every image, container and volume.

## Moving the root

Worth doing when `/var` is small and a data disk is large:

```json
// /etc/docker/daemon.json
{ "data-root": "/mnt/data/docker" }
```

Stop the daemon, copy the existing tree preserving ownership (`rsync -aHAX`),
update the config, start it. **Test the copy before deleting the original** —
SELinux labels and hard links matter, and an incomplete copy is discovered at the
worst moment.

Podman's equivalent is `graphroot` in `storage.conf`
(`/etc/containers/storage.conf`, or `~/.config/containers/storage.conf`
rootless).

## Storage drivers

`overlay2` is the default and correct answer on every current Linux
distribution. Historical alternatives — `devicemapper`, `aufs`, `btrfs`, `zfs`,
`vfs` — appear mostly on old hosts or in constrained environments.

`vfs` deserves one line because you may meet it: it has **no** copy-on-write, so
every layer is a full copy. It is used as a fallback where overlay is
unavailable, and images take enormous space. Seeing `vfs` in `docker info` is
worth investigating rather than accepting.

## Finding what is using the space

```bash
docker system df          # the four categories
docker system df -v       # per image, per container, per volume
podman system df
```

Always the first step. The four categories grow independently, and the answer
decides which prune to run
([Phase 1, page 13](../phase-1-running-containers/13-reclaiming-disk.md)).

## Gotchas

**Symptom:** `/var` is full on a server that runs a handful of containers.
**Cause:** Usually image layers and build cache; occasionally an unrotated
container log file.
**Fix:** `docker system df -v`. If it is logs, configure `max-size`/`max-file`
(Phase 10) — deleting the log file while the container runs frees nothing,
because the process still holds the descriptor.

**Symptom:** A developer's home directory filled up on a Fedora workstation.
**Cause:** Rootless Podman stores everything under
`~/.local/share/containers/storage`.
**Fix:** `podman system df`, then prune. If it recurs, move `graphroot` to a
larger filesystem via `storage.conf`.

**Symptom:** The engine misbehaves after somebody deleted directories under
`/var/lib/docker`.
**Cause:** The layer database now references content that is gone.
**Fix:** There is no supported repair. Stop the engine, remove the whole root,
and start over. Then use the CLI's own removal commands.

**Symptom:** `docker info` reports the `vfs` storage driver and images are
enormous.
**Cause:** Overlay is unavailable — an unsupported kernel or filesystem, or a
nested-container environment.
**Fix:** Investigate why. `vfs` copies every layer in full and is a fallback, not
a choice.

## Interview questions

**★ Where does Docker store images, and where does Podman?**
Docker under `/var/lib/docker` (rootless: `~/.local/share/docker`); Podman under
`/var/lib/containers/storage` (rootless: `~/.local/share/containers/storage`).
The rootless paths matter because storage then counts against the user's home
directory and any quota on it.

**★ Why should you never delete files under the storage root by hand?**
The layer database and the on-disk content must stay consistent. Removing
directories the database still references leaves the engine in a broken state
with no repair tool. Use `rm`/`rmi`/`volume rm`/prune, which update both.

**★ How do you move Docker's storage to a bigger disk?**
Stop the daemon, copy the tree preserving ownership and hard links, set
`data-root` in `/etc/docker/daemon.json`, restart, and verify before deleting the
original. Podman's equivalent is `graphroot` in `storage.conf`.

**What is the `vfs` storage driver and why does it matter?**
A fallback with no copy-on-write, so every layer is a full copy and disk use is
enormous. Seeing it in `docker info` means overlay was unavailable, which is
worth investigating rather than accepting.

**A container's log file has grown to 40 GB. Where is it and what do you do?**
Under `containers/<id>/<id>-json.log` in the storage root, from the default
`json-file` driver with no rotation. Configure `max-size` and `max-file`;
deleting the file while the container runs does not free the space, because the
process still holds the descriptor.

---

← Prev: [Podman's registries.conf](12-podman-registries-conf.md) · Index: [Phase 2](README.md) · Next → [Running your own registry](14-your-own-registry.md)
