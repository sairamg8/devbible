---
title: "Disk growth"
sidebar_label: "13 · Disk growth"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker system df](https://docs.docker.com/reference/cli/docker/system/df/),
> [docker system prune](https://docs.docker.com/reference/cli/docker/system/prune/),
> [docker builder prune](https://docs.docker.com/reference/cli/docker/builder/prune/),
> [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/) and
> [podman-system-prune(1)](https://docs.podman.io/en/latest/markdown/podman-system-prune.1.html).
> **No sandbox** — no console output on this page.

**A production host does not fill up because of one big thing; it fills up because
four pools grow independently and nobody owns any of them.**
[Phase 1 · Reclaiming disk](../phase-1-running-containers/13-reclaiming-disk.md)
covered the commands. This page is the production posture: which pool actually
grows on a server, what is safe to automate, and the two prunes that destroy data
you cannot get back.

The stakes are set in [the failure
catalogue](06-failure-catalogue/02-still-running-and-useless.md): when the disk
fills, **every container on the host fails at once**, including the ones that were
healthy, and the engine itself may not be able to start a replacement.

## Find out where it went, before deciding anything

> "displays information regarding the amount of disk space used by the Docker
> daemon"

```bash
docker system df        # the four pools, with RECLAIMABLE per pool
docker system df -v     # per image, container and volume
```

`TYPE`, `TOTAL`, `ACTIVE`, `SIZE` and `RECLAIMABLE` are the columns; networks are
excluded "because it doesn't consume disk space". The verbose form is the one that
answers *which* — and its three size columns are worth understanding before you
read them as a bill:

- **"SHARED SIZE is the amount of space that an image shares with another one"**
- **"UNIQUE SIZE is the amount of space that's only used by a given image"**
- **"SIZE is the virtual size of the image, it's the sum of SHARED SIZE and
  UNIQUE SIZE"**

🔴 **So the `SIZE` column does not add up to the disk you will get back.** Ten
images built from one base share that base; deleting one of them frees its
`UNIQUE SIZE` and nothing more. `RECLAIMABLE` is the honest number.

## What actually grows on a production host

| Pool | Why it grows in production | Bounded by |
|---|---|---|
| **Logs** | The default `json-file` driver does **no rotation** | A driver and rotation settings — [topic 08](08-log-drivers-and-rotation.md) |
| **Images** | Every deploy pulls a new tag and nothing removes the old one | A prune policy |
| **Containers** | Each recreate leaves the old container, with its writable layer | `--rm`, or removing on deploy |
| **Volumes** | Each recreate can leave an anonymous volume behind | Named volumes and an owner |
| **Build cache** | Only on hosts that build | `builder prune`, on a schedule |

⚠️ **On an application server the answer is usually logs, and on a build server it
is usually build cache.** Both are invisible in the "how big is my image" thinking
that dominates before a host has been running for six months.

**Anonymous volumes are the quiet one.** A recreate cycle — a deploy, a crash loop
with a restart policy, `compose up` after an edit — can leave one behind each time,
each holding whatever the container wrote. They have no names, so nothing in a
dashboard names them either.

## Pruning, from safest to most dangerous

```bash
docker container prune          # stopped containers
docker image prune              # dangling images only
docker builder prune            # build cache
docker image prune -a           # every image not used by a container
docker system prune             # the four above, dangling only
docker system prune -a --volumes  # 🔴 the one that deletes data
```

**What `docker system prune` removes by default**, in the documentation's words:
"all stopped containers", "all networks not used by at least one container", "all
dangling images" and "unused build cache".

- **`--all/-a`** — "Remove all unused images not just dangling ones."
- **`--volumes`** — "Prune anonymous volumes."

> "By default, volumes aren't removed to prevent important data from being deleted
> if there is currently no container using the volume."

🔴 **That sentence is the whole risk.** A stopped database container's volume is
"currently not used by any container". `--volumes` deletes it, and there is no undo
— the data is gone with the volume. Anything that matters should be a **named**
volume with a backup ([phase 6 · Backing up and restoring a
volume](../phase-6-storage/10-backup-and-restore.md)), and `--volumes` should never
appear in an automated job.

⚠️ **`-a` has a smaller but real cost on a production host:** it deletes images not
currently used by a container, which includes **the previous version you would roll
back to**. On a host with no registry access during an incident, that turns a
30-second rollback into an outage.

## The blurb contradicts the option table

The command's own summary line reads *"Remove all unused containers, networks,
images (both dangling and unused), and optionally, volumes"* — but the detail and
the `--all` description say only **dangling** images go by default, and `-a` is
what extends it to all unused ones.

🔴 **The option table is the authority.** Read the blurb as marketing for the
command, not as its behaviour — the same trap Compose's `down` documentation
carries. Anyone quoting the summary line will predict the wrong outcome in both
directions: too much deleted on a laptop, too little reclaimed on a server.

## Filters are what make automation safe

Both `prune` commands take filters, and an age filter turns a blunt command into a
policy:

```bash
docker image prune -a --filter "until=168h"      # nothing newer than a week
docker builder prune --filter "until=168h"
docker system prune --filter "label!=keep"
```

- **`until=`** — "only remove containers, images, and networks created before given
  timestamp".
- **`label=` / `label!=`** — "only remove containers, images, networks, and volumes
  with (or without, in case `label!=...` is used) the specified labels", which is
  how a long-lived container or image opts *out* of the sweep.
- **`docker builder prune`** also takes `--keep-storage`, "amount of disk space to
  keep for cache" — a ceiling rather than a purge, and the right shape for a build
  host that wants cache hits *and* a bounded footprint.

**The rule for a cron job:** age-filtered, never `--volumes`, and `-a` only where a
registry is reachable. Everything outside that is a human decision made while
looking at `docker system df -v`.

## Pruning during an incident deletes the evidence

The instinct when a host fills is to run the most powerful prune available. Two
reasons not to:

- **A stopped container is the crash you are investigating.** Its logs, its exit
  code and its filesystem all disappear with it, and
  [topic 12](12-debugging-without-a-shell.md) needed exactly those.
- **It hides the cause.** Freeing 40 GB tells you nothing about which pool produced
  it, so the same incident recurs on the same schedule.

🔴 **Free the minimum, note what it was, then fix the pool.** If logs filled the
disk, the fix is a rotating log driver, not a weekly prune; a prune that has to run
weekly is a rotation setting that was never configured.

## Podman

`podman system prune` removes the same categories by default — "all stopped
containers", "all networks not used by at least one container", "all dangling
images" and "all dangling build cache" — with `--all` for all unused images and
`--volumes` for "volumes currently unused by any container".

Two Podman-specific points:

- ⚠️ **`--volumes` is broader than Docker's.** Docker's flag is documented as
  pruning *anonymous* volumes; Podman's is documented as unused volumes, named ones
  included. The same command line is more destructive here.
- **`--external`** removes storage left by unclean shutdowns; it "drops the default
  behaviour of removing unused resources" and cannot be combined with `--all` or
  `--filter`. It is a repair tool, not part of a routine.

**Rootless storage lives under the user's home**, so disk growth counts against a
home or `/home` quota rather than a system partition — and a per-user quota is
usually far smaller, so rootless hosts hit the wall sooner than the raw disk size
suggests.

## Gotchas

**Symptom:** The host filled and every container failed at once, including healthy
ones.
**Cause:** A shared disk with no per-pool bound — usually unrotated `json-file`
logs.
**Fix:** Set a log driver with rotation, then prune. Rotation is the fix; the prune
is first aid.

**Symptom:** A prune freed far less than `docker system df` suggested.
**Cause:** `SIZE` is virtual and includes shared layers; only `RECLAIMABLE` is
reclaimable, and tagged images and named volumes are not touched by a default
prune.
**Fix:** `docker system df -v`, then decide per image or volume deliberately.

**Symptom:** A database volume disappeared after a cleanup.
**Cause:** `--volumes`. The volume was not in use by a running container, which is
exactly the condition the flag acts on.
**Fix:** There is no recovery. Name volumes, back them up, and keep `--volumes` out
of every script — this is the flag that deletes data.

**Symptom:** A rollback failed during an incident because the previous image was
gone.
**Cause:** `docker image prune -a` on a schedule, which removes any image no
container is using — including the one you were about to roll back to.
**Fix:** Age-filter the prune, keep the last few tags, and confirm the registry is
reachable before relying on re-pulling.

## Interview questions

**★ A production host is out of disk. What do you look at, in what order?**
`docker system df` for which of the four pools grew, then `-v` for which item
inside it. On an application server the usual answer is logs from the unrotated
`json-file` driver; on a build server it is build cache. Free the minimum needed to
restore service, record what it was, and fix the pool — a prune that must run
weekly is a missing rotation setting.

**★ Which prune flag deletes data, and why is it so easy to run by accident?**
`--volumes`. The documentation says volumes are excluded by default "to prevent
important data from being deleted if there is currently no container using the
volume" — and a stopped database container's volume is exactly that. There is no
undo. It should never appear in an automated job.

**★ Why does `docker system df` overstate what you will get back?**
Because `SIZE` is the virtual size — "the sum of SHARED SIZE and UNIQUE SIZE" — and
images built from a common base share most of it. Deleting one image frees only its
unique portion. `RECLAIMABLE` is the column that answers the question.

**What does `docker system prune` remove by default, and what does the summary line
get wrong?**
Stopped containers, unused networks, dangling images and unused build cache. Its
own one-line description says images "both dangling and unused", which contradicts
the `--all` option — `-a` is what extends it to all unused images. The option table
is the authority.

**How do you make automated pruning safe on a production host?**
Filter by age (`until=168h`), never pass `--volumes`, and use `-a` only where the
registry is reachable so a rollback can re-pull. Label long-lived resources and
exclude them with `label!=`. On build hosts prefer `builder prune --keep-storage`,
which bounds the cache instead of emptying it.

**What is different about disk growth under Podman?**
`--volumes` is documented as removing unused volumes rather than only anonymous
ones, so the same command is more destructive; `--external` exists to clean up
storage left by unclean shutdowns and is a repair tool, not routine. And rootless
storage lives under the user's home directory, so it consumes a home-directory or
per-user quota, which is typically much smaller than the system partition.

---

← Prev: [Debugging a container you cannot shell into](12-debugging-without-a-shell.md) · Index: [Phase 10](README.md) · Next → [Running containers under systemd](14-under-systemd.md)
