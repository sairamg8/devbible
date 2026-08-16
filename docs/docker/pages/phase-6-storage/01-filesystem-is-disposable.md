---
title: "The container filesystem is disposable"
sidebar_label: "01 · The filesystem is disposable"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — storage overview](https://docs.docker.com/engine/storage/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/),
> [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/),
> [docker container diff](https://docs.docker.com/reference/cli/docker/container/diff/) and
> [Podman — podman-diff](https://docs.podman.io/en/latest/markdown/podman-diff.1.html).
> **No sandbox** — no console output on this page.

**A container's filesystem is scratch space with the container's lifetime, and
`rm` deletes it. That is not a limitation to work around — it is the property
that makes the rest of the model work.** Every volume, bind mount and `tmpfs` in
this phase exists because something needed to escape it.

## What the writable layer actually is

An image is a stack of read-only layers
([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)). Starting a
container does **not** copy them. The engine stacks them with a union filesystem
— OverlayFS on Linux
([Phase 0, page 07](../phase-0-what-a-container-is/07-overlayfs.md)) — and adds
**one thin writable layer on top**, private to that container.

That layer is the container's entire mutable filesystem. Docker's own storage
documentation is blunt about what it is for:

> *"Data written to the container layer doesn't persist when the container is
> destroyed."*

and

> *"The writable layer is unique per container."*

Two containers from the same image share every read-only layer on disk and share
**nothing** writable. That is why starting a hundred containers from a 400 MB
image does not cost 40 GB — and it is the same fact that means each of those
hundred containers has its own private, unbacked-up, about-to-be-deleted scratch
disk.

## The lifecycle, precisely — and where people get it wrong

The single most common misunderstanding is thinking the data is lost when the
container **stops**. It is not.

| Command | The writable layer |
|---|---|
| `docker stop` / `docker kill` | **survives** — the process is gone, the filesystem is intact |
| `docker start` on the same container | the same layer, exactly as it was left |
| `docker restart` | the same layer |
| `docker rm` | **deleted** |
| `docker run --rm` (on exit) | **deleted**, along with any anonymous volumes |
| `docker compose down` | **deleted** — `down` removes containers |
| host reboot | survives (the container is stopped, not removed) |

So a container is not a fragile thing that loses state at the first breath. It
loses state at exactly one moment: **removal**. The reason it feels fragile is
that removal is the normal operation — every `docker compose up --build`, every
redeploy, every `--rm`, every `docker rm -f` in a script does it.

**Recovering data from a stopped container is possible and often forgotten.**
`docker cp` works on stopped containers
([Phase 1, page 15](../phase-1-running-containers/15-docker-cp.md)), so if you
have realised the mistake but have not run `rm` yet, the data is still there:

```bash
docker cp mycontainer:/var/lib/postgresql/data ./rescued-data
```

Once `rm` has run, there is nothing to recover. There is no undelete, no
`docker volume ls` entry, no dangling directory the engine keeps for you.

## Why the design is right

It is worth being able to argue this rather than treating it as an inconvenience.

**1. It is what makes an image a reliable unit.** If containers accumulated
state, "run the image" would mean something different on the tenth run than the
first. Every guarantee about reproducibility
([Phase 0, page 12](../phase-0-what-a-container-is/12-works-on-my-machine.md))
depends on the container starting from a known filesystem every single time.

**2. It forces the state to be named.** A system where data lives inside
containers has state you cannot enumerate. A system where every durable thing is
a named volume or a bind mount has state you can list, back up and move —
`docker volume ls` is a complete inventory of what matters. Disposability does
not remove state; it makes state **declare itself**.

**3. Sharing read-only layers is the whole storage saving.** Copy-on-write only
works if the shared part is never written.

**4. Replaceability is the operational model.** Rolling updates, autoscaling,
crash-restart, moving a workload to another host — all of them assume killing a
container costs nothing. A container that holds the only copy of something is a
pet, and everything above it stops working.

## What using the writable layer as storage actually costs

Beyond "you will lose it", there are three concrete costs, and they show up
before you lose anything.

**Copy-up on first write.** OverlayFS is copy-on-write at *file* granularity.
Modifying one byte of a 2 GB file that lives in a read-only layer copies the
entire 2 GB into the writable layer first. Databases and log files hit this
hardest, which is why running a database on the writable layer is slow in a way
that has nothing to do with the disk.

**The disk usage is invisible where you look for it.** A container's writable
layer is not an image, so `docker images` does not show it, and not a volume, so
`docker volume ls` does not either. It is reported by `docker system df` and by
the `--size` flag on `ps`, and by nothing else. Docker's reference defines the
two numbers exactly:

> *"The 'size' information shows the amount of data (on disk) that is used for
> the writable layer of each container"*

> *"The 'virtual size' is the total amount of disk-space used for the read-only
> image data used by the container and the writable layer."*

```bash
docker ps -s              # SIZE column: writable layer (virtual TOTAL)
docker system df -v       # containers, images and volumes, itemised
podman ps -s              # identical flag and meaning
```

**It cannot be extracted cleanly.** There is no "export the writable layer"
operation. `docker commit` turns it into an image layer, which is a bad way to
keep data — you now have data inside an image, versioned by nothing, and it grows
every commit.

## Seeing what your container has written

`docker diff` lists every change the container made to its filesystem relative to
the image, which is the fastest way to find out whether a container is
accumulating state you did not intend:

```bash
docker diff mycontainer
podman diff mycontainer
```

Three letters, per the reference: **`A`** — a file or directory was added,
**`C`** — a file or directory was changed, **`D`** — a file or directory was
deleted.

Run it against a long-lived container and the output is a candidate list for
"things that should have been a volume". A steadily growing `A /app/uploads` is
the shape of a bug you have not hit yet.

⚠️ **Paths that are mounted are excluded from the diff** — a volume or bind
mount is not part of the writable layer, so it does not appear. That is exactly
the signal you want: a clean `docker diff` means everything durable is already
outside the container.

## The three ways out

All of Phase 6 is these three, and page 02 is the full comparison:

| Escape | What it is | Deleted by `docker rm`? |
|---|---|---|
| **Named volume** | storage the engine creates and manages, outside the container's layers | no |
| **Bind mount** | a host directory mapped straight into the container | no — it is the host's |
| **`tmpfs` mount** | memory, never touching disk | yes, and on stop too — deliberately |

A mount point is a hole in the union filesystem. Writes to it never reach the
writable layer at all, do not pay copy-up, and are not reported by `docker diff`.

## Docker and Podman

**The semantics are identical** — same layer model, same removal behaviour, same
`--size`, `diff`, `cp` and `commit`. The one difference worth knowing is *where*
the data sits, because it decides who can delete it:

| | Docker | Podman (rootless) |
|---|---|---|
| Container and image storage | `/var/lib/docker/` (root-owned) | `~/.local/share/containers/storage/` |
| Volumes | `/var/lib/docker/volumes/` | `~/.local/share/containers/storage/volumes/` |

Rootless Podman puts everything under your home directory, which has two
practical consequences: **your container storage counts against a home-directory
quota**, and a well-meaning "clean up my home directory" script can destroy every
volume you own without needing root. Rootful Podman (`sudo podman`) uses
`/var/lib/containers/` instead, and is a **completely separate** store — a volume
you created rootless is invisible to `sudo podman volume ls`, which surprises
people at least once each.

## Gotchas

**Symptom:** "My database was fine yesterday and is empty today", after a
`docker compose up --build`.
**Cause:** The service has no `volumes:` entry, so the data lived in the writable
layer. `--build` recreated the container, and recreation is removal plus create.
**Fix:** A named volume on the data directory. Then verify it by removing the
container on purpose and starting it again — an untested persistence claim is
not a persistence claim.

**Symptom:** `docker ps -s` shows a container with a 12 GB writable layer.
**Cause:** The application is writing logs, uploads or a cache to a path that is
not mounted.
**Fix:** `docker diff` to find the paths, then mount them — a volume for the
uploads, `tmpfs` for the cache, and logs to stdout so the log driver handles
them.

**Symptom:** A file you `docker cp`-ed into a running container is gone after a
redeploy.
**Cause:** `docker cp` writes into the writable layer, so it has the container's
lifetime. It is a debugging tool, not a deployment mechanism.
**Fix:** Bake the file into the image, or mount it. If it is a config file, mount
it read-only.

**Symptom:** `docker commit` was used to "save" a container's state and the image
is now enormous and unbuildable.
**Cause:** Each commit freezes the writable layer as a new layer on top of an
already-committed stack, and nothing about how it got there is recorded.
**Fix:** Treat `commit` as a forensic tool for capturing a broken container to
inspect later. What belongs in an image goes in a Dockerfile; what is data goes
in a volume.

## Interview questions

**★ Where does a container's data go, and when is it lost?**
Into a thin writable layer that the union filesystem stacks on top of the
image's read-only layers, private to that container. It survives `stop`,
`start` and `restart`, and is deleted by `docker rm` — including the implicit
`rm` in `--rm`, `compose down` and any recreate-on-deploy. Stopping does not
lose it; removing does.

**★ Why is "the container filesystem is disposable" a design decision rather
than a shortcoming?**
Because it is what makes the image the unit of truth. If containers kept state,
the tenth run of an image would not match the first, and copy-on-write layer
sharing would not be safe. It also forces every durable thing to be named — a
volume or a bind mount you can list, back up and move — instead of hiding state
inside containers nobody can enumerate.

**★ What does it cost to write a lot of data to the writable layer, apart from
losing it?**
Copy-up: OverlayFS copies a whole file into the writable layer on the first
write to it, so modifying one byte of a large file in a lower layer copies the
whole file. The space is also awkward to see — it is not an image and not a
volume, so only `docker system df` and `docker ps -s` report it — and there is
no clean way to extract it; `docker commit` turns data into an unversioned image
layer.

**How do you find out whether a running container is accumulating state?**
`docker diff <container>`, which lists added (`A`), changed (`C`) and deleted
(`D`) paths relative to the image, and `docker ps -s` for the size of the
writable layer. Mounted paths are excluded from the diff, so anything that shows
up is by definition unprotected.

**A colleague removed a container and wants the data back. What are the
options?**
None, once `rm` has completed — there is no undelete. Before removal, `docker
cp` works on a stopped container, so the recovery path only exists while the
container still exists. The real answer is the preventive one: the data should
not have been in the writable layer.

**Is the data in the same place for Docker and rootless Podman?**
The behaviour is identical, the location is not. Docker keeps containers and
volumes under `/var/lib/docker/`, owned by root. Rootless Podman keeps them
under `~/.local/share/containers/storage/`, which means your own scripts and
your home-directory quota can affect them without root, and that rootful
`sudo podman` uses a completely separate store under `/var/lib/containers/`.

---

← Index: [Phase 6](README.md) · Next → [Volumes, bind mounts and tmpfs](02-volumes-bind-mounts-tmpfs/README.md)
