---
title: "Piping psql into other tools"
sidebar_label: "15 · Piping psql"
sidebar_position: 15
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**With `-At` psql becomes an ordinary Unix filter: SQL in, plain lines out. That covers
most ad-hoc reporting and cron work without writing a program — provided you remember that
a pipeline hides psql's exit code by default.**

## `-At` is the mode

```console
$ ./ex32-psql-io.sh
=== 15a. -At is the pipe-friendly mode: no headers, no padding ===
1:Widget
2:Gadget
3:Doohickey

=== 15b. feeding a shell loop ===
processing Widget
processing Gadget
processing Doohickey
```

```bash
psql -Atc "SELECT id || ':' || name FROM p1_import ORDER BY id"

psql -Atc "SELECT name FROM p1_import ORDER BY id" | while read -r n; do
  echo "processing $n"
done
```

`-A` drops the column padding, `-t` drops the header and the `(N rows)` footer. What
remains is exactly the data — which is what `read`, `xargs`, `grep` and `jq` expect.

For a single value it gives you the value alone, ready for a shell variable:

```bash
COUNT=$(psql -Atc "SELECT count(*) FROM p1_import")
```

## CSV for anything structured

```console
=== 15c. csv straight to a file, and counting it ===
4
id,name,amount
1,Widget,10.50
```

```bash
psql --csv -c "SELECT * FROM p1_import ORDER BY id" > report.csv
```

Four lines: a header plus three rows. Use `--csv` rather than `-A -F ','` whenever a value
could contain a comma or quote — `--csv` quotes properly, a separator flag does not
([see output control](04-output-control.md)).

For exports larger than memory, stream instead:

```bash
psql -c "\copy (SELECT * FROM big) TO STDOUT WITH (FORMAT csv, HEADER)" | gzip > big.csv.gz
```

JSON travels well too, since PostgreSQL can build it server-side:

```bash
psql -Atc "SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM p1_import) t" | jq '.[0]'
```

## The trap: exit codes disappear in a pipe

```console
=== 15d. exit codes survive the pipe only if you ask ===
naive exit=0
with pipefail exit=1
```

```bash
psql -Atc "SELECT * FROM no_such_table" | cat   # $? is cat's status: 0

set -o pipefail
psql -Atc "SELECT * FROM no_such_table" | cat   # $? is now 1
```

**A pipeline reports the last command's status.** psql failed, `cat` succeeded, and the
script sees success. Every psql pipeline in a script needs:

```bash
set -euo pipefail
```

And, because [SQL errors do not affect psql's exit code without it](06-scripting.md),
`-v ON_ERROR_STOP=1` as well. The two together are what make a pipeline honest.

## `\gexec` — run the SQL a query generates

```console
=== 15e. generating SQL and executing it with \gexec ===
COMMENT
COMMENT
COMMENT
 Schema |   Name    | Type  |  Owner   | ... |  Description
--------+-----------+-------+----------+-----+----------------
 public | p1_import | table | devbible | ... | auto-commented
```

```sql
SELECT format('COMMENT ON TABLE %I IS %L', tablename, 'auto-commented')
FROM pg_tables WHERE tablename LIKE 'p1_%'
\gexec
```

`\gexec` runs the buffer, then executes **each returned value as SQL**. It is the idiom for
bulk schema operations — reindex every table over a size, grant on everything in a schema,
drop every table matching a prefix:

```sql
SELECT format('REINDEX INDEX CONCURRENTLY %I.%I', schemaname, indexname)
FROM pg_indexes WHERE schemaname = 'public'
\gexec
```

**Always run the `SELECT` alone first** and read the statements it produced. `\gexec` on a
query you have not inspected is how a `DROP` reaches more tables than intended.

`format()` with `%I` (identifier) and `%L` (literal) does the quoting; string concatenation
does not, and generated DDL is exactly where an unquoted mixed-case name breaks.

## Health checks and cron

```console
=== 15f. one-liner health check suitable for cron ===
1
healthcheck exit=0
```

```bash
#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD  # or use ~/.pgpass

ACTIVE=$(psql -X -w -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")

if [ "$ACTIVE" -gt 50 ]; then
  echo "WARNING: $ACTIVE active queries" >&2
  exit 1
fi
```

The flags are the whole lesson of this phase in one line: **`-X`** so no `.psqlrc`
interferes, **`-w`** so it fails instead of hanging on a password prompt,
**`-v ON_ERROR_STOP=1`** so SQL errors set the exit code, **`-At`** so the output is a bare
value.

## Where to stop

psql pipelines are excellent for one-off reports, health checks and glue. They stop being
the right tool when you need error handling per row, retries, typed data, or anything a
person other than you will maintain. At that point the same work in Node with `pg` is
shorter and far easier to test — see
[the pg driver](../phase-7-pg-driver/01-install-wire.md). The signal is usually the second
`awk` in the pipeline.

## Trade-off

**Shell pipelines are the fastest thing to write and the easiest thing to get subtly
wrong.** Text has no types, so a `NULL` becomes an empty string and a numeric comparison on
it silently misbehaves; a value containing your delimiter corrupts the parse; and the exit
code vanishes unless you set `pipefail`. For a report you run once, none of that matters.
For anything scheduled and trusted, write it in a real language with real error handling —
the flags above make the shell version survivable, not robust.

## Gotchas

**Symptom:** A failing query in a pipeline does not fail the script
**Cause:** The pipeline reports the last command's exit code — measured `exit=0`
**Fix:** `set -o pipefail`, plus `-v ON_ERROR_STOP=1`

**Symptom:** Parsed output has stray spaces or a trailing `(3 rows)`
**Cause:** Default aligned output
**Fix:** `-At`

**Symptom:** A CSV export breaks on a value containing a comma
**Cause:** `-A -F ','` joins without quoting
**Fix:** `--csv`

**Symptom:** A cron job hangs forever
**Cause:** psql is waiting on a password prompt
**Fix:** `-w`, with credentials in `~/.pgpass`

**Symptom:** `\gexec` did more than expected
**Cause:** The generating query matched more rows than intended
**Fix:** Run the `SELECT` alone and read every statement first

**Symptom:** Generated DDL fails on a mixed-case or reserved name
**Cause:** String concatenation instead of proper quoting
**Fix:** `format()` with `%I` for identifiers and `%L` for literals

**Symptom:** A `NULL` became an empty string and broke a numeric test
**Cause:** Everything through a pipe is text
**Fix:** `coalesce()` in the query, or move the logic into SQL

## Interview questions

**★ What flags make psql pipe-friendly?**
`-A` (unaligned) and `-t` (tuples only), usually written `-At`. For structured data,
`--csv`, which quotes correctly.

**★ Why can a failing psql command not fail your script?**
Two independent reasons: without `ON_ERROR_STOP` a SQL error does not set psql's exit code
at all, and in a pipeline the shell reports the *last* command's status. Measured: `exit=0`
naively, `exit=1` with `pipefail`.

**★ What is `\gexec`?**
It executes each value returned by the query as a SQL statement — the idiom for generating
bulk DDL. Always inspect the generated statements by running the `SELECT` alone first.

**★ How do you safely build dynamic SQL in a generating query?**
`format()` with `%I` for identifiers and `%L` for literals, so quoting and escaping are
handled. Concatenation is not safe.

**★ What flags belong on a psql command in cron?**
`-X` (ignore `.psqlrc`), `-w` (never prompt), `-v ON_ERROR_STOP=1` (real exit code), `-At`
(bare output), and `set -euo pipefail` on the shell side.

**How do you export a table larger than memory?**
`\copy (SELECT …) TO STDOUT WITH (FORMAT csv)` piped onward — it streams rather than
buffering the whole result.

**When should this become a program instead?**
When you need per-row error handling, retries, or types — roughly the point where a second
`awk` appears in the pipeline.

---

← [\errverbose and SQLSTATE](14-errverbose.md) · [Phase index](README.md)
