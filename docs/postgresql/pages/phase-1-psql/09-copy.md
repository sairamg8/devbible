---
title: "\\copy vs COPY"
sidebar_label: "09 · \\copy vs COPY"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**`COPY` is SQL and reads files on the *server*. `\copy` is a psql command and reads files
where *psql runs*. One backslash decides whether your CSV is found at all — and with a
containerised or managed database, `COPY` usually cannot see your file no matter what path
you give it.**

## The distinction, and the hint that explains it

```console
$ ./ex32-psql-io.sh
=== 09a. COPY (server-side) tries to read a file on the SERVER ===
ERROR:  could not open file "/tmp/does-not-exist-on-server.csv" for reading: No such file or directory
HINT:  COPY FROM instructs the PostgreSQL server process to read a file. You may want a client-side facility such as psql's \copy.
```

PostgreSQL's own hint is the whole page. The file existed nowhere on the server, and it
would not have mattered if it existed on your laptop — the server process is what opens it.

Three consequences:

- **`COPY` requires superuser or the `pg_read_server_files` / `pg_write_server_files`
  role.** Reading arbitrary server files is a privilege, correctly.
- **With a container or a managed service, the server's filesystem is not yours.** `/tmp`
  inside the container is not your `/tmp`.
- **`\copy` has neither problem**: psql reads the file with your permissions and streams the
  contents over the existing connection.

```console
=== 09b. \copy (client-side) reads the file where psql runs ===
COPY 3
 id |   name    | amount
----+-----------+--------
  1 | Widget    |  10.50
  2 | Gadget    |  99.99
  3 | Doohickey |   0.75
(3 rows)
```

```sql
\copy p1_import FROM '/tmp/p1_work/import.csv' WITH (FORMAT csv, HEADER)
```

**Default to `\copy`.** Reach for server-side `COPY` only when the file genuinely lives on
the server and is large enough that streaming it through the client matters.

## Exporting

```console
=== 09c. exporting: \copy TO, and the same thing as csv ===
COPY 2
id,name,amount
1,Widget,10.50
2,Gadget,99.99
```

```sql
-- a query, not just a table
\copy (SELECT * FROM p1_import WHERE amount > 1) TO '/tmp/export.csv' WITH (FORMAT csv, HEADER)

-- straight to stdout, for piping
\copy p1_import TO STDOUT WITH (FORMAT csv)
```

```console
=== 09d. \copy TO STDOUT streams to the terminal or a pipe ===
1,Widget,10.50
2,Gadget,99.99
3,Doohickey,0.75
```

`\copy (query) TO` is the workhorse: any `SELECT`, including joins and CTEs, exported
directly. `TO STDOUT` streams so it can feed `gzip`, `wc` or another `psql` without a
temporary file:

```bash
psql -c "\copy (SELECT * FROM big) TO STDOUT WITH (FORMAT csv)" | gzip > big.csv.gz
```

`\copy … TO STDOUT` differs from `--csv` in an important way: it streams row by row from
the server rather than buffering the full result, so it is the right tool for exports
larger than memory. Compare [cursors](../phase-7-pg-driver/15-cursors.md) for the
equivalent from Node.

## It is one transaction — all or nothing

```console
=== 09e. a bad row aborts the whole \copy — it is one transaction ===
ERROR:  invalid input syntax for type numeric: "not-a-number"
CONTEXT:  COPY p1_import, line 3, column amount: "not-a-number"
3
```

The file had three rows: a good one, a bad one, a good one. **Nothing was imported** — the
count stayed at 3 from the earlier load. `COPY` is a single statement, so one malformed
value rolls back the entire load.

The `CONTEXT:` line is the useful part: **line 3, column `amount`, and the offending
value.** That is enough to fix the file without hunting.

There is no "skip bad rows" option. The options are:

- **Clean the file first** — the usual answer.
- **Load into a staging table of all `text` columns**, then `INSERT … SELECT` with casts
  and a `WHERE` that filters the bad rows. This is the standard pattern for untrusted CSV.
- **`ON_ERROR ignore`** (PostgreSQL 17+), which skips malformed rows and reports the count
  — useful, but it silently discards data, so `LOG_VERBOSITY verbose` should accompany it.

```sql
-- the staging-table pattern
CREATE TEMP TABLE staging (id text, name text, amount text);
\copy staging FROM 'input.csv' WITH (FORMAT csv, HEADER)
INSERT INTO p1_import (id, name, amount)
SELECT id::int, name, amount::numeric
FROM staging
WHERE amount ~ '^[0-9]+(\.[0-9]+)?$';
```

## The receipt

```console
=== 09f. COPY reports a row count; that is your receipt ===
ERROR:  duplicate key value violates unique constraint "p1_import_pkey"
DETAIL:  Key (id)=(1) already exists.
TRUNCATE TABLE
COPY 3
```

`COPY 3` is the confirmation — the number of rows actually loaded. **Check it.** A load
that silently imported fewer rows than the file contains is otherwise invisible, and the
`COPY n` line is the only receipt you get.

The error above is the other common one: `\copy` does not upsert. Loading a file twice
violates the primary key. The idiom for repeatable loads is staging plus
[`INSERT … ON CONFLICT`](../phase-4-crud/06-on-conflict.md).

## Options worth knowing

```sql
WITH (FORMAT csv, HEADER)              -- skip the header row on import, write one on export
WITH (FORMAT csv, HEADER, DELIMITER ';')
WITH (FORMAT csv, NULL '\N')           -- how NULL is represented
WITH (FORMAT csv, QUOTE '"', ESCAPE '"')
WITH (FORMAT csv, FORCE_NOT_NULL (note))
WITH (FORMAT text)                     -- the default: tab-separated, backslash escapes
WITH (FORMAT binary)                   -- fastest, PostgreSQL-only, version-sensitive
\copy t (id, name) FROM 'f.csv' ...    -- import a subset of columns
```

`HEADER` on import only *skips* the first line by default — it does not match column names
to it. `HEADER MATCH` (PostgreSQL 16+) does verify the header against the column list,
which is worth using whenever the file comes from elsewhere.

## Trade-off

**`\copy` trades throughput for reach.** The data travels through the psql client rather
than being read directly by the server, which is slower for very large files on the same
host — but it works from your machine, needs no server privileges, and is the only option
against a managed database. For bulk loading from Node the comparison is measured in
[COPY from Node](../phase-8-schema-from-node/09-copy-streams.md), where `COPY` beat multi-row
`INSERT`s. Here the practical rule is simpler: `\copy` unless the file is on the server and
big enough to care.

## Gotchas

**Symptom:** `could not open file … No such file or directory` for a file you can see
**Cause:** `COPY` reads on the server; your file is on the client
**Fix:** Use `\copy` — the error's own `HINT` says so

**Symptom:** `must be superuser or have privileges of the pg_read_server_files role`
**Cause:** Server-side `COPY` requires that privilege
**Fix:** `\copy`, which needs no server-side rights

**Symptom:** An import of 10 000 rows loaded nothing
**Cause:** One malformed value aborted the whole statement — it is a single transaction
**Fix:** Read the `CONTEXT:` line for the row and column, fix the file, or use a text staging table

**Symptom:** Re-running an import fails with a duplicate key
**Cause:** `COPY` only inserts; it has no conflict handling
**Fix:** Load to a staging table, then `INSERT … ON CONFLICT`

**Symptom:** The first data row is missing after import
**Cause:** `HEADER` was specified for a file with no header, so a real row was skipped
**Fix:** Drop `HEADER`, or use `HEADER MATCH` to verify

**Symptom:** Empty strings arrived as `NULL`, or the reverse
**Cause:** The default `NULL` representation differs between csv and text formats
**Fix:** Set `NULL` explicitly, and `FORCE_NOT_NULL` for columns where `''` is meaningful

## Interview questions

**★ What is the difference between `COPY` and `\copy`?**
`COPY` is SQL executed by the server and reads/writes files on the server's filesystem,
requiring privileges. `\copy` is a psql command that reads the file locally and streams it
over the connection.

**★ Which do you use with a containerised or managed database?**
`\copy` — the server's filesystem is not accessible to you, so `COPY` cannot see your file
regardless of path.

**★ What happens if one row in a CSV is malformed?**
The entire `COPY` aborts; it is one statement in one transaction. Measured: a three-row
file with one bad value loaded zero rows. `CONTEXT:` names the line, column and value.

**★ How do you load a file that may contain bad rows?**
Stage it into an all-`text` table, then `INSERT … SELECT` with casts and a filter. Or
`ON_ERROR ignore` on PostgreSQL 17+, accepting that it discards rows silently.

**★ How do you export the result of a join to CSV?**
`\copy (SELECT …) TO 'file' WITH (FORMAT csv, HEADER)` — any query works, not just a table
name.

**Why does `\copy … TO STDOUT` matter for large exports?**
It streams rather than buffering the whole result, so memory stays flat and the output can
be piped straight into `gzip` or another process.

**How do you know the load worked?**
The `COPY n` line is the row count actually loaded — the only receipt, and worth asserting
on in scripts.

---

← [psql variables](08-variables.md) · Next → [\timing and \watch](10-timing-watch.md)
