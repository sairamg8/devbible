---
title: "Reclaiming disk space"
sidebar_label: "13 · Reclaiming disk space"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — pruning unused objects](https://docs.docker.com/engine/manage-resources/pruning/),
> [docker system df](https://docs.docker.com/reference/cli/docker/system/df/) and
> [podman-system-prune(1)](https://docs.podman.io/en/latest/markdown/podman-system-prune.1.html).
> **No sandbox** — no console output on this page.

**Four things grow independently: images, containers, volumes and build cache.**
"Docker is using 60 GB" is never one problem, and the command that clears the
most is also the one that can delete your development database.

## First, find out where it went

```bash
docker system df        # the four categories, with reclaimable amounts
docker system df -v     # per image, per container, per volume
```

This is the command to run **before** any prune. It splits the total into the
four categories and tells you how much of each is actually reclaimable, which
usually makes the decision for you.

## The prune commands, precisely

| Command | Removes |
|---|---|
| `docker container prune` | All **stopped** containers and their writable layers |
| `docker image prune` | **Dangling** images — untagged and unreferenced |
| `docker image prune -a` | **All unused** images, including tagged ones no container uses |
| `docker volume prune` | **Anonymous** unused volumes |
| `docker volume prune -a` | Also **named** volumes not attached to a container |
| `docker network prune` | Networks no container uses |
| `docker buildx prune` | Build cache for the current builder |
| `docker system prune` | Stopped containers + unused networks + dangling images + unused build cache |
| `docker system prune -a` | The above, plus **all unused images** |
| `docker system prune --volumes` | The above, plus **anonymous** volumes |

Docker's own warning text is worth reading rather than dismissing — it enumerates
exactly what is about to go, and it differs between the flags.

## The two that bite

### `--volumes` deletes data

`docker system prune --volumes` removes **anonymous volumes not used by at least
one container**. If your local Postgres was started without a named volume — very
common when following a quick tutorial — its data directory is an anonymous
volume, and if the container is stopped, that data is now unused and gets
deleted.

> **Use named volumes for anything you would be upset to lose.** Named volumes
> survive `system prune --volumes`; only `volume prune -a` reaches them.

### `-a` deletes images you will want back

`docker image prune -a` removes every image not currently used by a container —
including base images you will pull again in five minutes, and images you built
locally and never pushed. On a slow connection or a rate-limited registry that is
a genuinely expensive mistake.

## The routine that is safe

In escalating order, stopping when you have enough space:

```bash
docker system df                 # 1. look
docker container prune           # 2. stopped containers - always safe
docker image prune               # 3. dangling images only - safe
docker buildx prune              # 4. build cache - safe, costs rebuild time
docker system df                 # 5. look again
docker image prune -a            # 6. only if needed, and you can re-pull
```

**Build cache is usually the surprise.** A machine that builds frequently can
carry tens of gigabytes of cache, and clearing it costs nothing but the next
build's time. `docker buildx prune --filter until=168h` keeps a week and drops
the rest — often the best single habit.

## Filters

```bash
docker image prune -a --filter "until=720h"        # older than 30 days
docker container prune --filter "until=24h"
docker buildx prune --filter "until=168h"
```

`until` on a scheduled prune is far safer than a blanket `-a`, because it keeps
what you are actively using.

## Podman

`podman system df` and `podman system prune` mirror Docker's, with the same
`-a` and `--volumes` flags and the same warnings. One difference worth knowing:
rootless Podman stores everything under `~/.local/share/containers`, so its disk
use counts against your **home directory** — and against a quota, if the host has
one. `podman system df` is the same first step.

## Gotchas

**Symptom:** A local database was empty after a cleanup.
**Cause:** `docker system prune --volumes` removed an anonymous volume whose
container was stopped.
**Fix:** Name your volumes. Recovery is not possible after the fact — this is the
one prune mistake with no undo.

**Symptom:** `docker system prune` freed almost nothing and the disk is still
full.
**Cause:** The space is in **tagged** images or **named** volumes, neither of
which the default prune touches.
**Fix:** `docker system df -v` to see which, then decide deliberately. Do not
reach straight for `-a --volumes` because the first attempt disappointed.

**Symptom:** Disk keeps filling on a build server despite regular pruning.
**Cause:** Build cache, which the container/image prunes do not clear.
**Fix:** `docker buildx prune --filter until=168h` on a schedule.

**Symptom:** An image "in use" cannot be removed.
**Cause:** A container references it — often a **stopped** one.
**Fix:** `docker ps -a --filter ancestor=<image>` to find it, remove the
container, then the image. `docker rmi -f` only removes the tag and leaves the
layers if a container still holds them.

## Interview questions

**★ What does `docker system prune` remove by default?**
Stopped containers, networks no container uses, dangling images, and unused build
cache. Not tagged images, and not volumes — those need `-a` and `--volumes`
respectively.

**★ Which prune flag is dangerous, and why?**
`--volumes`. It deletes anonymous volumes not attached to a running container,
which is where a casually-started database keeps its data. Named volumes are the
protection, and there is no recovery afterwards.

**★ Where does disk space actually go, and how do you find out?**
Four independent categories — images, containers' writable layers, volumes and
build cache. `docker system df` splits them and shows what is reclaimable;
`-v` breaks it down per object. Always look before pruning.

**Why does the disk stay full after `docker system prune`?**
Because the space is in tagged images or named volumes, which the default prune
deliberately leaves alone. Check `docker system df -v` and decide explicitly
rather than escalating flags blindly.

**How do you keep a build server from filling up without losing useful cache?**
A scheduled `docker buildx prune --filter until=168h`, keeping a week of cache.
Time-filtered pruning preserves what is actively in use, unlike a blanket `-a`.

---

← Prev: [Restart policies](12-restart-policies.md) · Index: [Phase 1](README.md) · Next → [user, workdir, hostname, add-host](14-user-workdir-hostname.md)
