---
title: "The three types, and named volumes"
sidebar_label: "01 · The three types, and volumes"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — storage overview](https://docs.docker.com/engine/storage/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/) and
> [docker volume inspect](https://docs.docker.com/reference/cli/docker/volume/inspect/).
> **No sandbox** — no console output on this page.

**A volume is storage the engine owns.** It is created on demand, outlives every
container that uses it, appears in `docker volume ls`, and — uniquely among the
three mount types — **copies the image's existing content in when it is empty**.

## The three, in one table

| | **Named volume** | **Bind mount** | **`tmpfs` mount** |
|---|---|---|---|
| What it is | storage the engine creates and manages | a host path mapped straight in | host memory |
| Who owns the lifetime | the **engine** — outlives every container | the **host** — the engine never created it | **nobody** — gone when the container stops |
| Lives at | `/var/lib/docker/volumes/<name>/_data` | wherever you said | RAM only, never on disk |
| Survives `rm` | ✅ | ✅ (it is the host's directory) | ❌ |
| Survives `stop` | ✅ | ✅ | ❌ |
| Portable to another host | ✅ (back it up, recreate it) | ❌ (the path must exist there too) | n/a |
| Engine can list it | ✅ `docker volume ls` | ❌ — only via container inspect | ❌ |
| Pre-populated from the image | ✅ **yes**, when the volume is empty | ❌ **no** — it *hides* what was there | ❌ |
| Host tooling can see the files | awkwardly (root-owned engine path) | ✅ trivially | ❌ |
| Linux only | no | no | ✅ **yes** |
| Typical use | database data, uploads, anything durable | source code in development, a config file | secrets, scratch, `/tmp` under `--read-only` |

Read that table as one decision, not eleven: **engine-owned and durable → a
volume. Host-owned and shared with your editor → a bind mount. Nobody should own
it → `tmpfs`.**

## Creating and mounting a volume

```bash
docker volume create pgdata
docker run --mount type=volume,src=pgdata,dst=/var/lib/postgresql/data postgres:17
docker run -v pgdata:/var/lib/postgresql/data postgres:17          # same thing
```

You rarely need the first line. **A volume named in a `run` or a Compose file is
created on demand if it does not exist** — which is convenient, and is also why
a typo in a volume name silently gives you a brand-new empty volume instead of
an error. That failure mode is the whole argument of page 03.

**The default `local` driver** keeps the data on this host under
`/var/lib/docker/volumes/`, and `inspect` will tell you exactly where:

```bash
docker volume inspect pgdata --format '{{.Mountpoint}}'
# a path of the form /var/lib/docker/volumes/pgdata/_data
```

⚠️ **Knowing that path is not permission to use it.** Reading and writing under
`/var/lib/docker` behind the engine's back is how volumes get corrupted; the
path is root-owned, it is not stable across engines (rootless Podman puts it in
your home directory), and on Docker Desktop it is inside a VM and does not exist
on your Mac at all. The supported ways in are **a container** or **`docker cp`**
— page 10 turns that into a backup procedure.

## Pre-population: the behaviour that makes volumes different

This is the one property people rely on without knowing they do. From the
volumes documentation:

> *"if you mount an **empty volume** into a directory in the container in which
> files or directories exist, these files or directories are propagated (copied)
> into the volume by default"*

Mount a brand-new volume over `/usr/share/nginx/html` and you get a volume
containing the image's default page — not an empty directory, and not a broken
nginx. Four consequences worth holding on to:

**1. Only when the volume is empty.** The second container gets whatever the
first left behind; the image's copy is never re-applied. This is the cause of
"I changed the file, rebuilt the image, and nothing happened" — the volume
already had content, so the new image's version was never copied in.

**2. Ownership and permissions come across too.** The copy preserves the mode
and owner of the image's files, which is what makes volumes mostly painless in
exactly the places bind mounts hurt (page 05). A Postgres volume ends up owned by
the image's `postgres` user without you doing anything.

**3. It can be turned off.** `--mount type=volume,...,volume-nocopy` gives you an
empty directory instead. Useful when the image ships a large default tree you
have no intention of using.

**4. It does not apply to bind mounts or `tmpfs`, ever.** Those two hide the
image's content instead. That contrast is the next chunk, and it is the most
load-bearing sentence in this phase.

## Anonymous volumes

An anonymous volume is the same object without a name. Two things create them:

```bash
docker run -v /var/lib/postgresql/data postgres:17     # a destination with no source
```

```dockerfile
VOLUME /var/lib/postgresql/data                         # a line in the image
```

They get a random 64-hex-character name, they behave exactly like named volumes
in every other respect, and they are **what `--rm` deletes**:

> *"the anonymous volume associated with the container is destroyed"*

Named volumes are not touched by `--rm`. That asymmetry is the whole reason to
prefer a name: a named volume is identifiable, greppable, backup-able and
survives a careless flag, and an anonymous one is a hash you will not recognise
in six weeks. [Phase 3, page 13](../../phase-3-dockerfile/13-volume.md) argues
the Dockerfile side of the same point; page 06 is how you clean up the ones you
already have.

## Volume options worth knowing

```bash
# read-only, so the container cannot modify shared reference data
docker run --mount type=volume,src=refdata,dst=/data,readonly myapp

# mount one subdirectory of a volume rather than the whole thing
docker run --mount type=volume,src=shared,dst=/app/cache,volume-subpath=cache myapp

# driver options — the local driver can wrap an NFS or CIFS mount
docker volume create --driver local \
  --opt type=nfs --opt o=addr=10.0.0.5,rw --opt device=:/exports/data nfsdata
```

`volume-subpath` is newer and genuinely useful: one volume, several services,
each pinned to its own directory inside it, with no chance of one service
walking over another's tree. The `--opt` form is the seam into network storage —
page 11.

## Gotchas

**Symptom:** A named volume mounted over an image directory already has files in
it, and you expected it empty.
**Cause:** Pre-population — mounting an *empty* volume over a non-empty
container directory copies the image's content in.
**Fix:** That is usually what you want. When it is not, use
`--mount type=volume,...,volume-nocopy`, or use a bind mount, which hides rather
than copies.

**Symptom:** You changed a file in the image, rebuilt, and the container still
serves the old one.
**Cause:** A volume is mounted at that path. It was populated from the *first*
image and is no longer empty, so the new image's copy is never applied.
**Fix:** `docker volume rm` the volume and let it repopulate — after checking it
holds nothing you need. The durable lesson is that **application code belongs in
the image, not in a volume**.

**Symptom:** A service came up against an empty database after a rename in the
Compose file.
**Cause:** Volumes are created on demand, so a renamed or mistyped volume is a
*new, empty* volume rather than an error. The old data is still there under the
old name.
**Fix:** `docker volume ls` to find the original, and either rename back or copy
the data across with a throwaway container (page 10).

**Symptom:** Editing files directly under `/var/lib/docker/volumes/...` had no
effect, or corrupted the volume.
**Cause:** That path is an engine implementation detail — root-owned, not
present on Docker Desktop hosts, and different under rootless Podman.
**Fix:** Go through a container or `docker cp`. Treat `inspect`'s `Mountpoint`
as diagnostic information, not an API.

## Interview questions

**★ What is a volume, and what makes it different from just writing to the
container?**
It is storage the engine creates and manages outside the container's layers, with
its own lifecycle — it survives `rm`, appears in `docker volume ls`, can be
backed up and moved to another host, and does not pay the union filesystem's
copy-up cost. The container's own filesystem has none of those properties.

**★ What happens when you mount an empty volume onto a container directory that
already contains files?**
The image's files, with their ownership and permissions, are **copied into the
volume**. It only happens while the volume is empty — once there is content, the
image's version is ignored for ever — and `volume-nocopy` disables it. This is
also why a rebuilt image does not update a file that lives in a volume.

**★ Named or anonymous — does it matter?**
Yes. Anonymous volumes are deleted by `--rm`, named ones are not; anonymous ones
get a random hex name nobody can identify later, so they accumulate as
unreclaimable clutter. Anything durable gets a name, and the name goes in the
Compose file where a reader can see the state exists.

**Where does a volume actually live, and should you touch it there?**
Under `/var/lib/docker/volumes/<name>/_data` for the default `local` driver on
Linux Docker — but that is an implementation detail. It is root-owned, it lives
inside the VM on Docker Desktop, and rootless Podman uses your home directory
instead. Go through a container or `docker cp`.

**How would you share one volume between services without them colliding?**
`--mount type=volume,src=shared,dst=/app/cache,volume-subpath=cache` — each
service mounts its own subdirectory of the same volume, so there is one thing to
back up and no chance of one service walking over another's tree.

---

Index: [Volumes, binds and tmpfs](README.md) · Next → [Bind mounts and `tmpfs`](02-bind-mounts-and-tmpfs.md)
