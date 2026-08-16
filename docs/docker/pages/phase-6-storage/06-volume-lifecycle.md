---
title: "Volume lifecycle"
sidebar_label: "06 · Volume lifecycle"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker volume ls](https://docs.docker.com/reference/cli/docker/volume/ls/),
> [docker volume prune](https://docs.docker.com/reference/cli/docker/volume/prune/),
> [docker volume inspect](https://docs.docker.com/reference/cli/docker/volume/inspect/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/) and
> [Podman — podman-volume](https://docs.podman.io/en/latest/markdown/podman-volume.1.html).
> **No sandbox** — no console output on this page.

**A volume is an object with a lifecycle the engine will never end on its
own.** Nothing about removing a container removes its volumes — that
independence is the feature — and the price is that volumes accumulate silently
until someone goes looking. This page is the five commands and the two habits
that keep it from becoming a disk-space incident.

## The five commands

```bash
docker volume create pgdata          # rarely needed — a named volume is created on demand
docker volume ls                     # everything the engine knows about
docker volume inspect pgdata         # driver, mountpoint, labels, creation time
docker volume rm pgdata              # refuses while a container references it
docker volume prune                  # remove the unused ones
```

`podman volume` has the same five subcommands with the same meanings, plus
`podman volume export` and `import`, which Docker has no equivalent of and which
page 10 uses.

## `ls`, and the filters that make it useful

An unfiltered `docker volume ls` on a working machine is a wall of hashes. The
filters are what turn it into an answer:

```bash
docker volume ls --filter dangling=true      # not referenced by any container
docker volume ls --filter name=pg            # substring match on the name
docker volume ls --filter label=project=shop
docker volume ls --filter driver=local
docker volume ls -q                          # names only, for piping
```

The reference defines the important one exactly:

> *"The `dangling` filter matches on all volumes not referenced by any
> containers"*

⚠️ **"Not referenced by any container" is not the same as "unwanted".** A volume
whose container you removed last week is dangling and may hold your only copy of
something. A volume declared in a Compose file that is currently `down` is
dangling too. Read the list before acting on it — `dangling` is a candidate
list, not a verdict.

## `inspect`, and what it is actually good for

```bash
docker volume inspect pgdata
docker volume inspect pgdata --format '{{.Mountpoint}}'
docker volume inspect pgdata --format '{{.CreatedAt}} {{json .Labels}}'
```

Three fields earn their keep:

- **`Mountpoint`** — where the `local` driver put the data. Diagnostic only
  (topic 02): do not edit it behind the engine's back.
- **`CreatedAt`** — the only clue you will get about an anonymous volume's
  origin. When you are staring at forty hashes, creation time is what lets you
  correlate them with a deploy.
- **`Labels`** — the field almost nobody sets, and the one that would have made
  the previous point unnecessary.

**Which container is using it** is the question `inspect` does *not* answer, and
it is the one you want. Ask from the container side instead:

```bash
docker ps -a --filter volume=pgdata
docker inspect <container> --format '{{json .Mounts}}'
```

## Labels: the two-line habit that prevents the mess

```bash
docker volume create --label project=shop --label role=postgres shop_pgdata
```

```yaml
volumes:
  pgdata:
    labels:
      project: shop
      role: postgres
```

With labels, six months later you can answer "what is this volume and can I
delete it" from `ls` alone, and you can prune by project rather than by nerve:

```bash
docker volume ls --filter label=project=shop
docker volume prune --filter label=project=shop
```

Compose applies its own labels to the volumes it creates, which is why
`docker compose down -v` can find exactly the project's volumes and nothing
else. Doing it by hand is the same trick.

## `rm` and `prune`, precisely

`docker volume rm` **refuses while any container — even a stopped one —
references the volume.** That is a safety feature and the usual cause of "volume
is in use": the container you thought you removed is stopped, not gone.

```bash
docker ps -a --filter volume=pgdata      # find the holder
docker rm <container>                    # then the volume will go
```

`prune` is where the important detail lives. From the reference:

> *"By default, it only removes anonymous volumes."*

> *"Unused local volumes are those which are not referenced by any containers."*

```bash
docker volume prune                                  # anonymous, unreferenced only
docker volume prune --all                            # named ones too (API 1.42+)
docker volume prune --filter label=project=shop
docker volume prune --filter label!=keep
```

**`--filter` on `prune` supports only `label`** — there is no `until` here, which
there is on `docker system prune`. And the default's conservatism is deliberate:
anonymous volumes are the ones that accumulate by accident, named ones were
named on purpose.

🔴 **`docker volume prune --all` is the command that deletes your development
databases.** It removes every named volume no running or stopped container
references — which includes every project you are not currently running. Type
the label filter, every time.

## Where the accumulation comes from

Anonymous volumes are created by two things, neither of which announces itself:

1. **A `VOLUME` line in an image.** Every container from that image gets a fresh
   anonymous volume ([Phase 3, page 13](../phase-3-dockerfile/13-volume.md)).
   Run the image fifty times, get fifty volumes.
2. **`-v /path` with no source**, including in a Compose `volumes:` entry that
   names only a container path — the `- /app/node_modules` shadowing trick from
   topic 04 is exactly this.

`--rm` deletes the anonymous volumes of *that* container as it exits, which is
why `docker run --rm` users see less of this and `docker compose` users see more.

The counter-habit is short:

```bash
docker system df -v                     # volumes, sized, alongside images and containers
docker volume ls --filter dangling=true
```

`docker system df -v` is the single most useful command here, because it puts a
size next to each volume — turning "forty hashes" into "one 14 GB hash and
thirty-nine empty ones", which is a decision you can actually make.

## Compose's lifecycle, which is different

| Command | Containers | Networks | Named volumes |
|---|---|---|---|
| `docker compose stop` | stopped | kept | kept |
| `docker compose down` | **removed** | **removed** | **kept** |
| `docker compose down -v` | **removed** | **removed** | 🔴 **REMOVED** |
| `docker compose down --rmi local` | removed | removed | kept (images also removed) |

**`down` keeps your data and `down -v` destroys it**, and they are one flag
apart. Two mitigations worth adopting: never put `-v` in a script or an alias
that runs unattended, and back up anything you would mind losing (page 10) —
because there is no confirmation prompt and no undo.

## Docker and Podman

The subcommands, the filters and the `dangling` semantics match. Four
differences:

- **Location** — rootless Podman keeps volumes under
  `~/.local/share/containers/storage/volumes/`; the rootful store is separate
  and `sudo podman volume ls` shows a different world.
- **`podman volume export` / `import`** — a tar of a volume's contents, straight
  in and out, with no throwaway container. Convenient, and Podman-only (page 10).
- **`podman volume create --opt`** supports the same `local`-driver options plus
  Podman-specific ones such as `o=noquota` and image-backed volumes.
- **`podman volume prune`** prompts for confirmation by default; `-f` skips it.

## Gotchas

**Symptom:** `docker volume rm` says the volume is in use, and nothing is
running.
**Cause:** A **stopped** container still references it — `ps` without `-a` does
not show it.
**Fix:** `docker ps -a --filter volume=<name>`, remove the container, then the
volume.

**Symptom:** `docker volume prune` freed nothing, even though `ls` is full of
volumes.
**Cause:** The default only removes **anonymous** volumes, and only those no
container references.
**Fix:** `--all` for named ones — with a `--filter label=` so it stays a
decision rather than a coin toss.

**Symptom:** A development database vanished after a disk-cleanup session.
**Cause:** `docker volume prune --all` or `docker system prune --volumes`
removed every volume not referenced by a container, including projects that were
merely `down`.
**Fix:** Restore from backup — there is no undo. Label volumes by project and
prune by label from then on.

**Symptom:** Forty anonymous volumes appeared over a week and nobody added one.
**Cause:** An image with a `VOLUME` declaration, run repeatedly without `--rm`.
**Fix:** Mount a **named** volume at that path so future containers stop
creating anonymous ones, then prune the old ones after checking `system df -v`
for anything with size.

## Interview questions

**★ What does `docker volume prune` remove, and what does it leave?**
By default only **anonymous** volumes that no container — running or stopped —
references. Named volumes are left alone unless you pass `--all`. The filter
supports `label` only. The default is conservative on purpose: anonymous volumes
accumulate by accident, named ones were created deliberately.

**★ Why does `docker compose down` keep your database but `down -v` destroy
it?**
`down` removes the containers and networks the project created; the named
volumes it declares are a separate lifecycle and are kept. `-v` extends the
removal to those volumes. There is no prompt and no undo, which is why it should
never appear in an unattended script.

**★ `docker volume rm` says "volume is in use" and nothing is running. Why?**
Because a stopped container still references it, and plain `docker ps` hides
stopped containers. `docker ps -a --filter volume=<name>` finds the holder;
removing the container releases the volume.

**How do you tell which volumes are safe to delete?**
Start from `docker volume ls --filter dangling=true` for the ones no container
references, then `docker system df -v` for their sizes — an empty volume is not
worth thinking about, and a 14 GB one deserves a look inside before anything
else. Labels applied at creation are what make this a query instead of an
archaeology exercise.

**Where do all the anonymous volumes come from?**
Two sources: a `VOLUME` instruction in an image, which creates one per container,
and `-v /path` with no source — including the `- /app/node_modules` shadowing
idiom. `--rm` cleans up the ones belonging to that container, which is why they
pile up faster under Compose than under `docker run --rm`.

---

← Prev: [File ownership and UID mismatch](05-uid-mismatch/README.md) · Index: [Phase 6](README.md) · Next → [SELinux `:z` and `:Z`](07-selinux-z-and-Z.md)
