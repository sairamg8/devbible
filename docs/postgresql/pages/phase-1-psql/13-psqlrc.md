---
title: ".psqlrc, the prompt and history"
sidebar_label: "13 · .psqlrc"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**`~/.psqlrc` runs before your first prompt. Five lines in it remove most of psql's daily
friction — and because scripts inherit it too, every script you write should pass `-X`.**

## It loads, and `-X` ignores it

```console
$ ./ex32-psql-io.sh
=== 13a. a .psqlrc, and proof that -X ignores it ===
--- with PSQLRC pointing at it ---
.psqlrc loaded
   n
--------
 (null)
(1 row)

--- same command with -X (no startup file) ---
 n
---

(1 row)
```

The same query, twice. With the startup file, `NULL` displayed as `(null)`; with `-X` it
was blank again. **That difference is exactly why scripts need `-X`**: a colleague's
`.psqlrc` can change how your script's output parses.

## The file worth having

```bash
# ~/.psqlrc
\set QUIET 1                        -- suppress startup noise while this file runs

\timing on                          -- always know how long it took
\x auto                             -- expanded output only when the row is too wide
\pset null '(null)'                 -- NULL and '' stop looking identical
\set ON_ERROR_ROLLBACK interactive  -- a typo does not kill the whole transaction
\set COMP_KEYWORD_CASE upper        -- tab completion produces SELECT, not select
\set VERBOSITY verbose              -- errors include the SQLSTATE

\set HISTSIZE 20000
\set HISTFILE ~/.psql_history-:DBNAME   -- separate history per database
\set HISTCONTROL ignoredups

\set PROMPT1 '%[%033[1;32m%]%n@%/%[%033[0m%]%R%# '
\set PROMPT2 '%[%033[1;33m%]%R%# %[%033[0m%]'

\set QUIET 0
```

The four that pay for themselves immediately:

- **`\pset null '(null)'`** — measured above. Without it a `NULL` and an empty string are
  the same blank cell, and they behave completely differently in every predicate.
- **`\x auto`** — [expanded output](04-output-control.md) only when needed.
- **`\timing on`** — free, and you always want it retrospectively.
- **`\set ON_ERROR_ROLLBACK interactive`** — psql takes an implicit savepoint before each
  statement in an interactive transaction, so a typo aborts only that statement rather than
  the whole transaction. Interactive only: scripts still fail properly. This is the one
  that saves a long hand-built transaction from `25P02`
  ([see savepoints](../phase-11-mvcc/09-savepoints.md)).

`\set QUIET 1` at the top and `0` at the bottom stops the file from printing a line per
setting.

## The prompt

`PROMPT1` is the main prompt, `PROMPT2` the continuation prompt shown mid-statement.

| Escape | Shows |
|---|---|
| `%n` | user name |
| `%/` | current database |
| `%M` / `%m` | host (full / short) |
| `%>` | port |
| `%R` | `=` normal, `-` mid-statement, `'` in a string, `(` unbalanced parens |
| `%#` | `#` for superuser, `>` otherwise |
| `%x` | transaction status: empty, `*` in a transaction, `!` failed, `?` unknown |
| `%[…%]` | wraps terminal escape codes (colour) |

Two are genuinely load-bearing:

- **`%x`** — an asterisk telling you a transaction is open. Without it, forgetting a
  `COMMIT` is invisible until something blocks
  ([idle in transaction](../phase-11-mvcc/14-idle-in-transaction.md)).
- **`%#`** — `#` means superuser. A visible reminder of the thing that
  [makes permission testing meaningless](12-who-and-privileges.md).

Colour the production prompt red and you will hesitate before typing there — the cheapest
safety measure available:

```bash
\set PROMPT1 '%[%033[1;31m%]PROD %n@%/%[%033[0m%]%x%R%# '
```

## Per-connection configuration

`.psqlrc` also supports a version-specific file (`~/.psqlrc-18.4`), and `PSQLRC` overrides
the location entirely — which is how the measurement above was made without touching a real
home directory:

```bash
PSQLRC=/path/to/other/psqlrc psql …
```

Since `.psqlrc` is just psql commands, it can branch on the database:

```sql
SELECT current_database() = 'production' AS is_prod \gset
\if :is_prod
  \set PROMPT1 '%[%033[1;31m%]PROD %/%[%033[0m%]%x%# '
  \echo 'CONNECTED TO PRODUCTION'
\endif
```

## Query shortcuts

```sql
\set activity 'SELECT pid, state, left(query,30) AS q FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();'
\set blocked  'SELECT pid, wait_event, pg_blocking_pids(pid) FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;'
\set biggest  'SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;'
```

Typing `:activity` then runs the stored text. It works because
[variables are textual substitution](08-variables.md) — the same mechanism that makes them
injectable makes this possible.

## History

```console
=== 13c. where the history lives ===
HISTFILE as a variable : :HISTFILE
(unexpanded above means it is unset - psql then uses the default path)
HISTSIZE is 500
```

`HISTFILE` is **unset by default** — the unexpanded `:HISTFILE` above proves it — and psql
falls back to `~/.psql_history`. The default `HISTSIZE` is 500 entries, which is small
enough to lose a query you wrote yesterday.

Setting `HISTFILE` to include `:DBNAME` gives one history per database, so pressing up-arrow
in the analytics database does not offer you migrations from the app database.

## Trade-off

**`.psqlrc` makes your psql pleasant and everyone else's psql different from yours.**
Instructions that assume your settings mislead colleagues; scripts that inherit them break
in ways that are hard to see. The resolution is the split this page keeps returning to:
configure interactive use freely, and pass **`-X` in every script, every CI job, every
`docker exec`** so automation runs against psql's defaults. Where `.psqlrc` reaches into
behaviour rather than display — `ON_ERROR_ROLLBACK`, `AUTOCOMMIT` — restrict it to
`interactive` so it cannot alter how a script fails.

## Gotchas

**Symptom:** A script's output format differs between machines
**Cause:** Someone's `.psqlrc` is being loaded
**Fix:** `-X` / `--no-psqlrc` in every non-interactive invocation

**Symptom:** `.psqlrc` prints a wall of confirmation lines at startup
**Cause:** Each `\set`/`\pset` reports itself
**Fix:** `\set QUIET 1` at the top, `\set QUIET 0` at the bottom

**Symptom:** History from yesterday is gone
**Cause:** `HISTSIZE` defaults to 500 — measured
**Fix:** `\set HISTSIZE 20000`, and consider a per-database `HISTFILE`

**Symptom:** A typo aborted a long hand-built transaction
**Cause:** Any error aborts the transaction (`25P02`) without an implicit savepoint
**Fix:** `\set ON_ERROR_ROLLBACK interactive`

**Symptom:** Ran a destructive statement against production by mistake
**Cause:** Nothing in the prompt distinguished it
**Fix:** A red `PROMPT1` with the database name and `%#`

**Symptom:** A transaction was left open without noticing
**Cause:** The default prompt does not show transaction state
**Fix:** Add `%x` to `PROMPT1` — it shows `*` while a transaction is open

## Interview questions

**★ What is `.psqlrc` and when does it run?**
A file of psql commands executed at startup, before the first prompt. `~/.psqlrc`, or a
version-specific `~/.psqlrc-18.4`, or wherever `PSQLRC` points.

**★ Why must scripts pass `-X`?**
Because they inherit the startup file otherwise. Measured: the same query printed `(null)`
with the file loaded and blank with `-X` — enough to break any script parsing the output.

**★ What are the highest-value settings to put in it?**
`\pset null '(null)'`, `\x auto`, `\timing on`, and `\set ON_ERROR_ROLLBACK interactive`.

**★ What does `ON_ERROR_ROLLBACK interactive` do?**
Takes an implicit savepoint before each statement in an interactive transaction, so a
failing statement does not abort the whole transaction. It deliberately does not apply to
scripts.

**★ What do `%x` and `%#` in the prompt tell you?**
`%x` shows transaction state (`*` when one is open), `%#` shows `#` for a superuser. The
two things most worth knowing before pressing enter.

**Where does psql history go by default?**
`~/.psql_history`, with `HISTSIZE` 500. `HISTFILE` is unset by default — measured, it
printed unexpanded.

**How do you make a query shortcut?**
`\set name 'SELECT …;'` then run it as `:name`. It works because variables are textual
substitution.

---

← [\conninfo \du \dp](12-who-and-privileges.md) · Next → [\errverbose and SQLSTATE](14-errverbose.md)
