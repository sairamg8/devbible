---
title: "Backing up and restoring a volume"
sidebar_label: "10 · Backup and restore"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — volumes (back up, restore, or migrate data volumes)](https://docs.docker.com/engine/storage/volumes/),
> [Podman — podman-volume-export](https://docs.podman.io/en/latest/markdown/podman-volume-export.1.html),
> [Podman — podman-volume-import](https://docs.podman.io/en/latest/markdown/podman-volume-import.1.html) and
> [PostgreSQL — SQL dump](https://www.postgresql.org/docs/current/backup-dump.html).
> **No sandbox** — no console output on this page.

**A volume has no backup command, because the engine has no idea what is inside
it.** What it gives you is a way to reach the bytes; deciding whether copying
those bytes produces a *usable* backup is your job, and for a running database
the answer is usually no.

## The idiom: a throwaway container with two mounts

The volume is only reachable from inside a container, so you start one whose
only purpose is to hold both the volume and a place to write:

```bash
docker run --rm \
  --volumes-from dbstore \
  -v "$(pwd)":/backup \
  ubuntu tar cvf /backup/backup.tar /dbdata
```

That is Docker's own documented form. Restoring is the same shape in reverse,
into a container that already has the target volume:

```bash
docker run --rm \
  --volumes-from dbstore2 \
  -v "$(pwd)":/backup \
  ubuntu bash -c "cd /dbdata && tar xvf /backup/backup.tar --strip 1"
```

Read the parts:

- **`--volumes-from <container>`** copies another container's mount definitions,
  so you get the volume at the same path without naming it.
- **`-v "$(pwd)":/backup`** is where the tarball lands — on your host, outside
  everything.
- **`--rm`** because the container has no reason to survive its one command.
- **`ubuntu`** is just something with `tar` in it. `alpine` is smaller;
  `busybox` smaller still.

Without a source container to copy from, mount the volume directly, which is
clearer for scripts:

```bash
docker run --rm \
  --mount type=volume,src=pgdata,dst=/data,readonly \
  --mount type=bind,src="$(pwd)",dst=/backup \
  alpine tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
```

⚠️ **`-C /data .` rather than `/data`** — that stores paths relative to the
volume root, so the restore does not need `--strip`. Half the restore failures
in this idiom are a tarball whose paths do not line up with where you are
untarring it.

## Restoring into a fresh volume

```bash
docker volume create pgdata_restored
docker run --rm \
  --mount type=volume,src=pgdata_restored,dst=/data \
  --mount type=bind,src="$(pwd)",dst=/backup,readonly \
  alpine sh -c 'tar xzf /backup/pgdata-2026-08-15.tar.gz -C /data'
```

**Restore into a new volume, then point the service at it.** Untarring over a
live volume mixes old and new files — `tar` overwrites what matches and leaves
everything else in place, so a restore that should have rolled you back to
Tuesday leaves Wednesday's stray files behind. A fresh volume makes the result
exactly the backup.

## Podman's shortcut

Podman has first-class commands for this and Docker does not. `podman volume
export` *"exports the contents of a podman volume and saves it as a tarball on
the local machine"*, writing to standard output unless `-o` names a file:

```bash
podman volume export pgdata -o pgdata.tar
podman volume import pgdata_restored pgdata.tar
```

No throwaway container, no `tar` flags to get wrong. It is genuinely nicer, and
it is **not portable** — a backup script that has to work under both engines
uses the container idiom.

## Why this is not a database backup

The idiom copies files. A running database is not a set of files that can be
copied consistently:

- Pages are being written while `tar` reads them, so a file can be captured
  half-updated.
- The write-ahead log and the data files are copied at different moments, so
  they disagree about what committed.
- Cached state in memory has not reached disk at all.

The result is a backup that restores, starts, and is subtly wrong — or refuses
to start with a corruption error, which is the *lucky* outcome because at least
you find out.

**Use the database's own tool, and run it inside a container that can reach the
database:**

```bash
# PostgreSQL
docker exec -t pg pg_dump -U postgres -Fc appdb > appdb-$(date +%F).dump
docker exec -i pg pg_restore -U postgres -d appdb --clean < appdb-2026-08-15.dump

# MongoDB
docker exec -t mongo mongodump --archive --gzip > mongo-$(date +%F).gz
docker exec -i mongo mongorestore --archive --gzip < mongo-2026-08-15.gz

# Redis — trigger a save, then copy the resulting file
docker exec redis redis-cli BGSAVE
```

These are *logical* backups: consistent by construction, portable across
versions and architectures, and restorable into a differently configured
server. The file-level tar is a *physical* backup — faster and exact, but only
trustworthy when the database is **stopped**, or when the storage layer can take
an atomic snapshot underneath it.

**So the honest rule:**

| Volume holds | Back up with |
|---|---|
| a running database | the database's own dump tool |
| a stopped database | either; tar is fine and faster |
| uploads, generated files, caches | the tar idiom |
| anything you cannot afford to lose | both, plus a tested restore |

## Cross-check the phase's other traps

Two things from earlier pages that bite exactly here:

**Ownership.** A tarball created inside a rootless container records the
container's UIDs. Restoring it through another container puts them back
consistently — but untarring it *on the host* gives you files owned by
subordinate UIDs (topic 05). **Restore the same way you backed up.** `tar
--numeric-owner` is worth adding so names are never re-resolved against the
wrong `/etc/passwd`.

**SELinux.** The `-v "$(pwd)":/backup` bind mount needs `:z` on Fedora, RHEL or
CentOS (topic 07), or the container cannot write the tarball at all.

## Making it a real backup

A file on the same disk as the volume is not a backup; it is a copy. The parts
that make the difference are unglamorous:

1. **Off the host.** Object storage, another machine, anything that survives the
   disk dying.
2. **Tested restore.** A backup nobody has restored is a hypothesis. Restore
   into a scratch volume on a schedule and check the data is there.
3. **Retention with an expiry**, so you have last night's *and* last month's.
4. **The version that wrote it**, recorded next to it. Restoring a Postgres 17
   physical backup into 18 does not work, and a logical dump is much more
   forgiving.
5. **Encryption if it leaves the machine.** A database dump is the whole
   database.

## Gotchas

**Symptom:** The restore put files in `/data/data/...` instead of `/data/...`.
**Cause:** The tarball stored absolute or nested paths.
**Fix:** Create it with `tar czf … -C /data .`, or restore with the matching
`--strip-components`. Check with `tar tzf backup.tar.gz | head` before untarring
anything.

**Symptom:** A restored database starts and then reports corruption, or missing
recent writes.
**Cause:** A file-level copy taken while the database was running.
**Fix:** Restore from a logical dump instead. For physical backups, stop the
container first or use a storage-level snapshot.

**Symptom:** The backup container exits with "permission denied" writing to
`/backup`.
**Cause:** SELinux on the bind mount, or a rootless UID that cannot write to the
host directory.
**Fix:** Add `:z` to the bind mount (topic 07), and check the host directory is
writable by your mapped UID (topic 05).

**Symptom:** Restoring on another machine produced files owned by strange UIDs.
**Cause:** The tar recorded container-side numeric owners, and it was extracted
in a different context.
**Fix:** Restore through a container the same way you created it, and use `tar
--numeric-owner` at both ends.

## Interview questions

**★ How do you back up a Docker volume?**
Run a throwaway container with the volume mounted and a host directory bind
mounted, and `tar` from one to the other —
`docker run --rm --mount type=volume,src=pgdata,dst=/data,readonly --mount
type=bind,src="$(pwd)",dst=/backup alpine tar czf /backup/pgdata.tar.gz -C /data .`
Docker's own documented form uses `--volumes-from` to inherit the mounts from an
existing container. Podman can skip the container entirely with `podman volume
export`.

**★ Why is that not a valid backup of a running database?**
Because it copies files while they are being written. Pages can be captured
half-updated, the write-ahead log and data files are read at different moments,
and in-memory state has not been flushed — producing a backup that either fails
to start or, worse, starts and is subtly wrong. Use `pg_dump`, `mongodump` or
the equivalent, which is consistent by construction.

**★ What is the difference between a logical and a physical backup here?**
A logical backup (`pg_dump`, `mongodump`) records the data as statements or
documents: consistent while the server runs, portable across versions and
architectures, slower to restore. A physical backup (the tar of the volume)
copies the on-disk files: fast and exact, but only trustworthy with the database
stopped or under an atomic storage snapshot, and tied to the version and
platform that wrote it.

**Why restore into a fresh volume rather than over the existing one?**
Because `tar` overwrites matching files and leaves everything else alone, so
untarring over a live volume leaves stray files from the state you were trying
to abandon. A new volume makes the restored state exactly the backup, and keeps
the original around until you have checked.

**What turns a copy into a backup?**
Being off the host, having a restore that someone has actually performed,
retention that keeps more than the most recent copy, a record of the software
version that wrote it, and encryption if it leaves the machine. A tarball beside
the volume is none of those things.

---

← Prev: [`--userns=keep-id`](09-userns-keep-id.md) · Index: [Phase 6](README.md) · Next → **Volume drivers and network storage** *(not written yet)*
