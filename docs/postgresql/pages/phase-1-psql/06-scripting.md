---
title: "Scripting psql"
sidebar_label: "06 · Scripting"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**The default is the dangerous one: a script hits an error, prints it, and keeps going —
exiting 0. `ON_ERROR_STOP=1` and `--single-transaction` are what turn psql into something
safe to put in a deploy pipeline.**

## The default keeps going after an error

```console
$ ./ex31-psql-basics.sh
=== 06b. WITHOUT ON_ERROR_STOP a script keeps going after an error ===
CREATE TABLE
INSERT 0 1
psql:/tmp/p1_script.sql:3: ERROR:  relation "no_such_table" does not exist
LINE 1: SELECT * FROM no_such_table;
                      ^
INSERT 0 1
 rows_inserted
---------------
             2
(1 row)

exit=0
```

**The error was printed, the script continued, and psql exited 0.** A CI step running this
migration reports success. The next statements ran against a half-applied state.

```console
=== 06c. WITH ON_ERROR_STOP=1 it stops at the first error ===
INSERT 0 1
psql:/tmp/p1_script.sql:3: ERROR:  relation "no_such_table" does not exist
exit=3
```

One flag changes both behaviours: execution stops, and the exit code becomes **3**.

```bash
psql -v ON_ERROR_STOP=1 -f migrate.sql
```

**Put `-v ON_ERROR_STOP=1` on every non-interactive psql invocation you write.** There is
no situation in a script where continuing past an error is what you wanted.

## Exit codes

```console
=== 06a. -c runs one command and exits; exit code says what happened ===
 ok
----
  1
(1 row)

exit=0
ERROR:  relation "no_such_table" does not exist
exit=1
```

| Code | Meaning |
|---|---|
| **0** | success |
| **1** | psql's own fatal error (out of memory, file not found, `-c` failed) |
| **2** | the connection went bad or was lost |
| **3** | a SQL error occurred **and** `ON_ERROR_STOP` was set |

`3` is the one to test for in CI, and it only ever appears when `ON_ERROR_STOP` is on —
another reason the flag matters. Without it, SQL errors are invisible to the exit code.

## Atomic scripts

Stopping at the first error still leaves earlier statements applied.
`--single-transaction` wraps the whole file:

```console
=== 06d. --single-transaction makes the whole file atomic ===
psql:/tmp/p1_atomic.sql:2: ERROR:  relation "no_such_table" does not exist
0
```

The file inserted a customer, then failed. The final `0` is the count of rows left behind:
**the insert was rolled back with the failure.** Without `--single-transaction` each
statement is its own transaction and that row would have survived.

```bash
psql -v ON_ERROR_STOP=1 --single-transaction -f migrate.sql
```

That pair is the standard invocation for a migration. Two limits to know:

- **Some statements cannot run inside a transaction** — `CREATE DATABASE`, `VACUUM`,
  `CREATE INDEX CONCURRENTLY`, `ALTER SYSTEM`. Those files cannot use it.
- **The whole file holds its locks until the end.** A long migration wrapped this way holds
  every lock it took for the full duration — see
  [table locks and DDL](../phase-11-mvcc/10-table-locks-ddl.md).

## `-c` versus `-f` versus stdin

```console
=== 06f. several -c flags run as separate statements ===
 first
-------
     1
(1 row)

 second
--------
      2
(1 row)
```

```bash
psql -c 'SELECT 1'                    # one command, then exit
psql -c 'SELECT 1' -c 'SELECT 2'      # several, in order, separate transactions
psql -f script.sql                    # a file
psql < script.sql                     # stdin — equivalent for most purposes
psql <<'SQL'                          # heredoc, handy in shell scripts
SELECT 1;
SQL
```

The difference that bites: **`-c` does not expand psql variables.** A `:var` inside `-c`
is sent to the server literally and produces a syntax error — measured in
[psql variables](08-variables.md). Use `-f` or stdin whenever variables are involved.

Multiple `-c` flags are separate statements, so a `BEGIN` in one and a `COMMIT` in another
do work (same session), but each `-c` without them is its own transaction.

## Echoing for logs

```console
=== 06e. -e echoes the SQL, -a echoes everything (for logs) ===
SELECT 42 AS answer;
 answer
--------
     42
```

- **`-e`** echoes the SQL statements sent to the server.
- **`-a`** echoes every input line, including comments and meta-commands.
- **`-q`** suppresses the informational chatter (`CREATE TABLE`, `INSERT 0 1`).

For a deploy log, `-e` is usually right: you want to see which statement failed without
the noise of the file's comments.

## The script to copy

```bash
#!/usr/bin/env bash
set -euo pipefail

psql \
  --no-psqlrc \
  --single-transaction \
  -v ON_ERROR_STOP=1 \
  -q -e \
  -f "migrations/$1.sql"
```

Every flag is doing work: `--no-psqlrc` (`-X`) so a developer's
[`.psqlrc`](13-psqlrc.md) cannot change behaviour, `--single-transaction` for atomicity,
`ON_ERROR_STOP=1` for a real exit code, `-q -e` for a readable log. `set -euo pipefail` on
the shell side so the failure propagates.

## Trade-off

**`--single-transaction` buys atomicity with lock duration.** A ten-minute migration in one
transaction holds every lock it acquires for ten minutes and blocks everything queued
behind it. For small schema changes that is free and correct. For large backfills the right
shape is the opposite: many small transactions, each idempotent, so a failure resumes rather
than rolls back — and `ON_ERROR_STOP=1` still guarantees you find out. Choose per script,
not per project.

## Gotchas

**Symptom:** A failed migration reported success in CI
**Cause:** Without `ON_ERROR_STOP`, SQL errors do not affect the exit code — measured `exit=0`
**Fix:** `-v ON_ERROR_STOP=1` on every scripted invocation

**Symptom:** A migration left the schema half-applied
**Cause:** Each statement was its own transaction
**Fix:** `--single-transaction`, or make each statement idempotent

**Symptom:** `CREATE INDEX CONCURRENTLY` fails inside a script that works otherwise
**Cause:** It cannot run inside a transaction block
**Fix:** Run it in its own psql call without `--single-transaction`

**Symptom:** `:variable` produces a syntax error in a `-c` command
**Cause:** `-c` does not interpolate psql variables
**Fix:** Use `-f`, stdin or a heredoc

**Symptom:** A script behaves differently on a colleague's machine
**Cause:** Their `.psqlrc` is being loaded
**Fix:** `-X` / `--no-psqlrc` in every script

**Symptom:** Exit code 2 rather than 3
**Cause:** The connection failed or dropped — not a SQL error
**Fix:** Distinguish the codes: 1 psql error, 2 connection, 3 SQL error with `ON_ERROR_STOP`

## Interview questions

**★ What does psql do by default when a statement in a script fails?**
Prints the error, continues with the next statement, and exits 0. Measured: the file
carried on and inserted the following row.

**★ How do you make a psql script fail properly?**
`-v ON_ERROR_STOP=1` — execution halts at the first error and the exit code becomes 3.

**★ How do you make a script atomic?**
`--single-transaction`. Measured: a failing second statement rolled back the successful
first insert (0 rows left). It cannot be used with statements that forbid a transaction
block.

**★ What do psql's exit codes mean?**
0 success, 1 psql's own error, 2 connection failure, 3 SQL error with `ON_ERROR_STOP` set.

**★ Why put `-X` in scripts?**
So a developer's `.psqlrc` cannot alter formatting or settings the script depends on.

**Why can `-c` not use `:variables`?**
`-c` sends the string without psql's variable interpolation. Use `-f` or stdin.

**When is `--single-transaction` the wrong choice?**
On long backfills, where holding every lock for the duration is worse than partial
progress. Use many small idempotent transactions instead.

---

← [\? and \h](05-help.md) · Next → [Query buffer and editor](07-query-buffer.md)
