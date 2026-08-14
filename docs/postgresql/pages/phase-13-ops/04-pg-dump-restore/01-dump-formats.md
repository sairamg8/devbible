---
title: "Dump formats and what is in them"
sidebar_label: "01 · Dump formats"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> client tools **18.4**. Script: `sandbox/pg-api/ex52-backup-restore.sh`.

**`pg_dump` produces a logical backup: SQL statements that recreate the database,
taken from a single consistent snapshot.** The format you choose decides what you
can do at restore time, and it is not reversible after the fact — a plain-text
dump can never be restored selectively.

Measured against a 202 MB database: 2 000 000 orders, 50 000 audit rows, one
index, one view, one grant.

## The four formats

```console
$ ./ex52-backup-restore.sh
=== 1. the four formats — size and wall time ===
  -Fp    2.37 s
  -Fc    2.55 s
  -Ft    2.41 s
  -Fd    2.53 s
  dump.p           121493.4 KB
  dump.c            16314.4 KB
  dump.t           121502.5 KB
  dump.d            16294.5 KB
    dir entry: 3487.dat.gz
    dir entry: 3489.dat.gz
    dir entry: toc.dat
```

**121 MB against 16 MB — 7.5× — for identical content**, at the same wall time.
The compressed formats cost nothing here because the work is dominated by reading
and transferring rows, not by compressing them.

| Flag | Format | Compressed | Selective restore | Parallel | Restore with |
|---|---|---|---|---|---|
| `-Fp` | plain SQL | no | **no** | no | `psql` |
| `-Fc` | custom | yes | yes | restore only | `pg_restore` |
| `-Fd` | directory | yes | yes | **dump and restore** | `pg_restore` |
| `-Ft` | tar | no | yes | restore only | `pg_restore` |

**`-Fc` is the default choice** and the one to use unless you have a specific
reason not to: compressed, indexed, restorable in parallel and selectively, and a
single file. `-Fd` adds parallel *dumping* at the cost of being a directory.

`-Ft` is rarely the answer — it is as large as plain text without being readable
as SQL. `-Fp` earns its place only when a human needs to read or edit the SQL, or
when the target is not PostgreSQL.

## Compression is not the reason to choose custom

```console
=== 2. plain text piped through gzip, vs -Fc ===
  dump.sql.gz       16366.0 KB
  dump.c            16314.4 KB
  ↑ same compression, but only -Fc can be restored selectively or in parallel
```

`pg_dump -Fp | gzip` produced 16 366 KB against the custom format's 16 314 KB —
within 0.3 %. If size were the only concern, the piped version would be fine.

It is not the only concern: the gzipped plain dump is an opaque stream that must
be restored in full, in order, by `psql`. The custom format at the same size
carries a table of contents, so you can restore one table, reorder, skip the
indexes, or run it across four workers. **Choose the format for what restore day
needs, not for the file size.**

## The table of contents

```console
=== 4. what is inside a custom dump — the table of contents ===
  222; 1259 29314 TABLE public audit_log devbible
  221; 1259 29313 SEQUENCE public audit_log_id_seq devbible
  220; 1259 29299 TABLE public orders devbible
  3496; 0 0 ACL public TABLE orders devbible
  223; 1259 29322 VIEW public open_orders devbible
  3489; 0 29314 TABLE DATA public audit_log devbible
  3487; 0 29299 TABLE DATA public orders devbible
  3497; 0 0 SEQUENCE SET public audit_log_id_seq devbible
  3335; 2606 29311 CONSTRAINT public orders orders_pkey devbible
```

`pg_restore -l` prints the manifest without restoring anything. Each line is one
restorable item, and the split between `TABLE` (the definition) and `TABLE DATA`
(the rows) is what makes schema-only and data-only restores possible.

The manifest is also editable, which is the most useful trick here:

```bash
pg_restore -l backup.dump > toc.list      # list every item
$EDITOR toc.list                          # comment out items with a leading ;
pg_restore -L toc.list -d target backup.dump
```

That is how you restore everything *except* one enormous audit table, or skip a
materialized view that takes an hour to build.

Note `SEQUENCE SET` in the list: sequence *positions* are captured, so a restored
database does not reissue identity values that already exist. A restore that
misses those lines produces duplicate-key errors on the first insert.

## What a dump does not contain

```console
=== 5. roles and grants: what a database dump does NOT contain ===
  CREATE ROLE statements in the dump: 0
  GRANT statements in the dump:      1
    GRANT SELECT ON TABLE public.orders TO p13_reader;
  ↑ the GRANT is dumped, the role it references is not — restore into a new
    cluster fails unless pg_dumpall --roles-only ran too
  CREATE ROLE in pg_dumpall --roles-only: 7
```

**The grant is in the dump; the role it names is not.** Roles are cluster-wide
objects, and `pg_dump` dumps one database. Restore into a fresh cluster and the
`GRANT SELECT … TO p13_reader` line fails because `p13_reader` does not exist.

This is the single most common surprise in a disaster drill, and it is why a
complete logical backup is **two** commands:

```bash
pg_dumpall --roles-only -f roles.sql     # roles, passwords, role memberships
pg_dump -d appdb -Fc -f appdb.dump       # one database, schema + data
```

Also absent from a `pg_dump`, for the same reason:

- **Tablespaces** — cluster-level (`pg_dumpall --tablespaces-only`).
- **Other databases** in the cluster, including `postgres` itself.
- **Server configuration** — `postgresql.conf`, `pg_hba.conf`, and anything set
  by `ALTER SYSTEM`. Those are files on the server, not database contents.
- **Replication slots and subscriptions**, which are cluster state.

`pg_dumpall` without flags dumps everything as plain SQL — which sounds ideal
until you notice it can only produce `-Fp`, so you lose selective and parallel
restore for the databases inside it. The usual practice is `pg_dumpall
--globals-only` plus a per-database `pg_dump -Fc`.

## `--no-owner` and `--no-acl`

```console
=== 12. --no-owner and --no-acl, for restoring as a different role ===
  with owner:    ALTER TABLE public.audit_log OWNER TO devbible;
  with owner:    ALTER TABLE public.orders OWNER TO devbible;
  --no-owner --no-acl → OWNER TO lines: 0
  --no-owner --no-acl → GRANT lines:    0
```

By default a dump reassigns ownership and re-applies grants, both of which fail
if those roles do not exist on the target. `--no-owner --no-acl` strips both, and
everything restored is owned by whoever runs the restore.

That is what you want when moving production data into a developer's local
database or a scratch environment where the role names differ. It is *not* what
you want for a real recovery: you would be discarding the privilege model along
with the ownership, and restoring a database where the application role has no
grants at all.

## Version compatibility

One rule, and it is the opposite of most people's assumption: **`pg_dump` may be
newer than the server, never older.** Use the client tools from the *highest*
version involved.

Restoring a dump into an older major version is not supported and generally
fails, because the dump contains syntax and defaults the older server does not
know. Moving *down* a version is a job for logical replication
([Logical replication](../16-logical-replication.md)), not for `pg_dump`.

The practical failure this causes: a server upgraded to 18 while a backup host
still runs the 16 client, and nightly dumps start failing with `server version
mismatch`. Both the dump host's client version and the server version belong in
your backup monitoring.

## Trade-off

A logical dump is portable, inspectable, restorable into a different major
version, and selective — and it is **slow to restore**, because the target rebuilds
every index and revalidates every constraint from scratch. On the 202 MB sandbox
that is ten seconds; on 500 GB it is hours, and the restore time grows faster
than the data.

That is the boundary between this topic and
[physical backup and PITR](../15-physical-backup/README.md): logical dumps for
portability, per-table recovery and moving data between versions; physical
backups for restoring a large production database quickly and to a chosen point
in time. Most production systems need both, for different failures.

## Gotchas

**Symptom:** Restore into a new cluster fails with `role "x" does not exist`
**Cause:** `pg_dump` dumps one database; roles are cluster-wide. Measured: the
`GRANT` was in the dump, zero `CREATE ROLE` statements were.
**Fix:** `pg_dumpall --roles-only` alongside the dump, restored first. Or
`--no-owner --no-acl` if the privilege model does not need to survive.

**Symptom:** A dump cannot be restored selectively
**Cause:** It is `-Fp`. The format decision is made at dump time and cannot be
changed afterwards.
**Fix:** Use `-Fc` by default. Measured: it is the same size as gzipped plain
text and loses nothing.

**Symptom:** Duplicate-key errors immediately after a successful restore
**Cause:** Sequence positions were not restored — the `SEQUENCE SET` items were
skipped, or only table data was restored.
**Fix:** Restore the full dump, or reset sequences with `setval()` afterwards.

**Symptom:** Nightly dumps fail after a server upgrade with a version mismatch
**Cause:** The backup host's `pg_dump` is older than the server. The client must
be at least the server's version.
**Fix:** Upgrade the client tools on the backup host; monitor both versions.

**Symptom:** The restored database is missing `postgresql.conf` settings, or
`pg_hba.conf` rules
**Cause:** Those are server files, never part of a logical dump. Neither is
`ALTER SYSTEM` state.
**Fix:** Back up the config directory separately — a restore drill that only
restores the dump will not produce a working server.

## Interview questions

**★ Which dump format would you use and why?**
`-Fc`. Measured: it is 7.5× smaller than plain text at the same wall time, and
within 0.3 % of plain-text-through-gzip — but unlike either it carries a table of
contents, so it can be restored selectively, reordered, or run in parallel. The
format cannot be changed after the dump is taken.

**★ What is in a `pg_dump` that a restore into a fresh cluster still cannot use?**
Grants whose roles do not exist. Measured: one `GRANT` statement, zero
`CREATE ROLE`. Roles, tablespaces, other databases, and all server configuration
are outside a single-database dump — a complete logical backup is `pg_dumpall
--roles-only` plus `pg_dump`.

**★ Can you restore a PostgreSQL 18 dump into a version 16 server?**
Not reliably — dumps go forward, not backward, and `pg_dump` itself must be at
least as new as the server it reads. Downgrading is a logical-replication job.

**What does `pg_restore -l` give you?**
The manifest of restorable items, split into definitions (`TABLE`) and data
(`TABLE DATA`), plus constraints, ACLs and `SEQUENCE SET` entries. Edited and fed
back with `-L`, it is how you restore everything except one huge table.

**Why do sequences matter on restore?**
The dump records each sequence's current value as a `SEQUENCE SET` item. Skip
those and the restored database reissues identity values that already exist,
producing duplicate-key errors on the first insert.

---

← [Topic index](README.md) · Next → [Restoring](02-restoring.md)
