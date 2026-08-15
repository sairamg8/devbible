---
title: "The data directory"
sidebar_label: "01 · The data directory"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the official `postgres` image documentation](https://hub.docker.com/_/postgres),
> [the `postgres` image Dockerfile (18/trixie)](https://github.com/docker-library/postgres),
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/) and
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/).
> **No sandbox** — no console output on this page.

**If you mount nothing, it still works — and that is the trap.** The image
declares a `VOLUME`, so Postgres always has somewhere to write. Without an
explicit named volume that somewhere is *anonymous*, and anonymous volumes are
how development databases disappear.

## 🔴 The path changed in Postgres 18

The image's own Dockerfile is explicit. For **18 and later**:

```dockerfile
ENV PGDATA /var/lib/postgresql/18/docker
VOLUME /var/lib/postgresql
```

with the comment: *"in 18+, `PGDATA` has changed to match the `pg_ctlcluster`
standard directory structure, and the `VOLUME` has moved from
`/var/lib/postgresql/data` to `/var/lib/postgresql`"*.

| Version | Mount your volume at |
|---|---|
| **18 and later** | `/var/lib/postgresql` |
| **17 and earlier** | `/var/lib/postgresql/data` |

⚠️ **This is not cosmetic, and the documentation says so in capitals:** mounts at
the old path *"WILL NOT PERSIST database data"* on 18+ when containers are
re-created. The symptom is the worst kind — everything works, the volume exists,
`docker volume ls` shows it, and the data is gone after the next `up` that
recreates the container, because the real `PGDATA` was inside the container's
writable layer all along.

**Check it on any stack you inherit**, especially one written before the change
and later bumped to `postgres:18`. Older releases can opt in to the new layout by
setting `PGDATA` explicitly, which is the honest way to make a file
version-agnostic.

## Named volume, not a bind mount

```yaml
    volumes:
      - pgdata:/var/lib/postgresql        # ✅ a named volume
    # - ./pgdata:/var/lib/postgresql      # ⛔ a host directory
```

The named volume is right for three separate reasons, all established in phase 6:

- **Ownership.** The image's entrypoint expects to own `PGDATA`. A host directory
  arrives with your UID and, under rootless Podman, with a mapping that makes it
  unwritable to the container user
  ([Phase 6 · UID mismatch](../../phase-6-storage/05-uid-mismatch/README.md)).
- **SELinux.** On Fedora and RHEL a bind mount needs `:z` or `:Z` relabelling; a
  named volume does not
  ([Phase 6 · SELinux `:z` and `:Z`](../../phase-6-storage/07-selinux-z-and-Z.md)).
- **Performance and correctness on macOS and Windows.** The database's file
  access patterns are exactly what the virtualised filesystem handles worst
  ([Phase 6 · Bind-mount performance](../../phase-6-storage/12-bind-mount-performance.md)).

**Bind-mount the init scripts, never the data.** `./db/init` read-only into
`/docker-entrypoint-initdb.d` is the correct use of a host path here: small,
read-only, and something you actually edit.

## What `down -v` removes

`docker compose down` keeps volumes by default. `-v` removes *"named volumes
declared in the `volumes` section of the Compose file and anonymous volumes
attached to containers"* — which is precisely your database
([Phase 8 · `up`, `down` and the lifecycle](../../phase-8-compose/03-up-and-down/README.md)).

| Command | Your data |
|---|---|
| `docker compose down` | survives |
| `docker compose down -v` | **gone, with no undo** |
| `docker compose rm` | survives — removes containers only |
| `docker volume prune` | survives if the volume is named and in use; an anonymous one may not |

Two ways to make the destructive case deliberate:

```yaml
volumes:
  pgdata:
    name: myapp_pgdata        # "the name is used as is and is not scoped with the stack name"
```

```yaml
volumes:
  pgdata:
    external: true            # lifecycle managed elsewhere — down -v cannot touch it
```

🔴 **`external: true` is the guard for anything you would be upset to lose.**
Compose will not create it and cannot delete it; you create it once with
`docker volume create` and it outlives every `down -v` somebody types in a hurry.

⚠️ **`down -v` is also a legitimate development command** — it is how you get a
genuinely empty data directory so the init scripts run again. The point is not to
avoid it; it is to know exactly which volumes it takes.

## Backups are not the volume

A volume is not a backup: it lives on the same disk, in the same failure domain,
and a `DROP TABLE` is faithfully persisted to it.

- **Volume-level** copy — the tar-through-a-throwaway-container pattern, covered
  in [Phase 6 · Backing up and restoring a volume](../../phase-6-storage/10-backup-and-restore.md).
  It is engine-generic and requires the database to be stopped to be consistent.
- **Database-level** dump — `pg_dump` or `pg_dumpall` run through
  `docker compose exec`, which is consistent on a running database and restorable
  into a different major version.

For a development stack, a `pg_dump` before a risky migration is the cheap
insurance. For anything real, the database's own tooling is the answer and the
container changes nothing about it.

## Ownership and `--user`

The image documents a genuine constraint: `postgres` accepts any UID as long as
it owns `PGDATA`, but **`initdb` requires the user to exist in `/etc/passwd`**.
So `user: "1000:1000"` on a first run fails with a "user does not exist" error,
while a user already present in the image works. The documented workarounds
involve `nss_wrapper` or an existing account — this is one of the few places
where the general "run as your own UID" advice from phase 6 does not apply
cleanly, and it is worth knowing *why* rather than fighting it.

**Under rootless Podman, a named volume sidesteps all of this**, because the
volume is created inside the user namespace with the right ownership already.

## Gotchas

**Symptom:** The database is empty after a `docker compose up` that recreated the
container, even though a volume is declared.
**Cause:** On Postgres 18+ the volume is mounted at `/var/lib/postgresql/data`,
which is no longer where `PGDATA` points — so the real data directory was inside
the container's writable layer.
**Fix:** Mount at `/var/lib/postgresql` for 18+, or set `PGDATA` explicitly to
pin the layout. Check this first on any file that predates the change.

**Symptom:** Data disappears between sessions and there is a growing pile of
unnamed volumes.
**Cause:** No volume was declared, so the image's `VOLUME` created an anonymous
one per container.
**Fix:** Declare a named volume in both the service and the top-level `volumes:`
section. Clean up the strays with `docker volume ls -f dangling=true`.

**Symptom:** `initdb` fails with a permissions error, or the container exits
immediately after a bind mount was added for the data directory.
**Cause:** A host directory brings host ownership, and under rootless Podman a
UID mapping that the container user cannot write.
**Fix:** Use a named volume for `PGDATA`. Keep bind mounts for the read-only init
scripts, where ownership does not matter.

**Symptom:** Somebody ran `docker compose down -v` and the team lost the local
database.
**Cause:** `-v` removes named volumes declared in the file, by design.
**Fix:** For volumes that must survive, `external: true` — Compose cannot delete
what it did not create. And keep a `pg_dump` habit for anything that took effort
to build.

## Interview questions

**★ Where does the data go if you mount nothing?**
Into an anonymous volume, because the image declares a `VOLUME`. It works, which
is why the mistake survives: the database persists across a restart, and then
vanishes the first time the container is removed and recreated. The fix is a
named volume declared in both the service and the top-level `volumes:` section.

**★ What changed about the data path in Postgres 18, and how does it fail?**
`PGDATA` became version-specific — `/var/lib/postgresql/18/docker` — and the
declared `VOLUME` moved from `/var/lib/postgresql/data` to
`/var/lib/postgresql`. A file written for 17 keeps mounting the old path, which
on 18 is no longer the data directory, so the data lives in the container's
writable layer and the documentation warns in capitals that it will not persist.
Nothing errors; the loss shows up at the next recreate.

**★ Named volume or bind mount for `PGDATA`, and why?**
Named volume. The entrypoint needs to own the directory, and a host path brings
host ownership plus, on rootless Podman, a user-namespace mapping the container
user cannot write; on Fedora it needs SELinux relabelling; and on macOS and
Windows the virtualised filesystem is worst at exactly the access pattern a
database has. Bind mounts are right for the init scripts — small, read-only,
frequently edited.

**How do you stop `down -v` from destroying a volume you care about?**
`external: true`, so Compose neither creates nor removes it; you create it once
yourself. A fixed `name:` also helps by making the volume identifiable outside
the project's namespace. Neither is a backup — a volume shares a failure domain
with the host and faithfully persists a mistaken `DROP TABLE`.

**Is a volume a backup?**
No. It is on the same disk, in the same failure domain, and it records
destructive statements as faithfully as useful ones. The container-generic
answer is a volume-level tar taken while the database is stopped; the correct
answer for a database is its own tooling — `pg_dump` through `compose exec`,
which is consistent on a running instance and restorable across major versions.

---

← Prev: [PostgreSQL in a container](README.md) · Index: [Phase 9](../README.md) · Next → [Initialisation and connecting](02-initialisation-and-connecting.md)
