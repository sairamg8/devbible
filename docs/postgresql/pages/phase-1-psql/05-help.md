---
title: "\\? and \\h — the built-in reference"
sidebar_label: "05 · \\? and \\h"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**`\?` for psql's own commands, `\h` for SQL syntax. Both are offline, both match the
exact server version in front of you, and `\h` prints the full grammar plus a link to the
matching documentation page — which is more reliable than a search engine that may return
a page for a different major version.**

## `\?` — psql's commands

```console
$ ./ex31-psql-basics.sh
=== 05a. \? lists every meta-command (first lines) ===
General
  \copyright             show PostgreSQL usage and distribution terms
  \crosstabview [COLUMNS] execute query and display result in crosstab
  \errverbose            show most recent error message at maximum verbosity
  \g [(OPTIONS)] [FILE]  execute query (and send result to file or |pipe);
                         \g with no arguments is equivalent to a semicolon
  \gdesc                 describe result of query, without executing it
  \gexec                 execute query, then execute each value in its result
  \gset [PREFIX]         execute query and store result in psql variables
  \gx [(OPTIONS)] [FILE] as \g, but forces expanded output mode
  \q                     quit psql
```

Grouped by category — General, Query Buffer, Input/Output, Conditional, Informational,
Formatting, Connection, Operating System, Variables, Large Objects. Reading it once
end-to-end is worth the five minutes; `\gdesc` (describe a result without running it) and
`\gexec` (run the SQL your query produced) are both in there and both routinely
rediscovered years late.

`\?` takes an argument for two sub-topics:

```console
=== 05d. \? variables — the built-in psql variables ===
List of specially treated variables

psql variables:
Usage:
  psql --set=NAME=VALUE
  or \set NAME VALUE inside psql

  AUTOCOMMIT
    if set, successful SQL commands are automatically committed
  COMP_KEYWORD_CASE
```

- **`\? variables`** — every special psql variable, including `ON_ERROR_STOP`,
  `VERBOSITY`, `AUTOCOMMIT` and the prompt variables. See [psql variables](08-variables.md).
- **`\? options`** — the command-line flags, the same as `psql --help`.

## `\h` — SQL syntax

```console
=== 05b. \h SQL-COMMAND gives the grammar ===
Command:     CREATE INDEX
Description: define a new index
Syntax:
CREATE [ UNIQUE ] INDEX [ CONCURRENTLY ] [ [ IF NOT EXISTS ] name ] ON [ ONLY ] table_name [ USING method ]
    ( { column_name | ( expression ) } [ COLLATE collation ] [ opclass [ ( opclass_parameter = value [, ... ] ) ] ] [ ASC | DESC ] [ NULLS { FIRST | LAST } ] [, ...] )
    [ INCLUDE ( column_name [, ...] ) ]
    [ NULLS [ NOT ] DISTINCT ]
    [ WITH ( storage_parameter [= value] [, ... ] ) ]
    [ TABLESPACE tablespace_name ]
    [ WHERE predicate ]

URL: https://www.postgresql.org/docs/18/sql-createindex.html
```

Three things this gives you that a web search does not:

- **The grammar for the version you are connected to.** The URL says `/docs/18/`,
  generated from the client version — no chance of reading the PostgreSQL 12 page by
  accident.
- **Every optional clause in one block.** `INCLUDE`, `NULLS NOT DISTINCT`, `WHERE
  predicate` — the features you would only find by knowing they exist.
- **It works offline**, which matters more than it sounds when debugging a production
  database from a locked-down host.

`\h` is loose about the command name: `\h create index`, `\h CREATE INDEX` and `\h alter
table` all work, and multi-word commands do not need quoting.

```console
=== 05c. \h with no argument lists what it knows ===
Available help:
  ABORT                            CREATE USER MAPPING
  ALTER AGGREGATE                  CREATE VIEW
  ALTER COLLATION                  DEALLOCATE
```

With no argument it lists every SQL command it has help for — a usable index of the SQL
surface.

## The three-command loop

Most "how do I…" questions in psql resolve with:

```bash
\?                   # is there a meta-command for this?
\h SOME COMMAND      # what is the exact syntax?
\dt / \d thing       # what does the schema actually look like?
```

Then, for the things `\h` does not cover — function signatures and behaviour:

```sql
\df pg_size_pretty       -- signatures
\dfS+ generate_series    -- system functions, with detail
\sf some_function        -- the source of a user function
```

`\h` covers SQL *commands*, not *functions*. `date_trunc` and `jsonb_set` have no `\h`
entry; `\df` plus the documentation is the route for those.

## Trade-off

**Built-in help is exact and terse — it gives grammar, not judgement.** `\h CREATE INDEX`
tells you `CONCURRENTLY` exists; it does not tell you it takes two table scans and cannot
run inside a transaction. Use it to settle syntax questions in one second without leaving
the terminal, and the documentation (or these pages) for when and why. The version
guarantee is the part worth relying on: the syntax it shows is the syntax your server
accepts.

## Gotchas

**Symptom:** `\h` finds nothing for a function name
**Cause:** `\h` covers SQL commands only
**Fix:** `\df name` for signatures, `\sf name` for source

**Symptom:** Syntax from a blog post is rejected by the server
**Cause:** It targets a different major version
**Fix:** `\h THE COMMAND` — the grammar and doc URL match your version

**Symptom:** `\?` output scrolls past
**Cause:** It is long and the pager may be off
**Fix:** `\pset pager on`, or `\? | grep something`

**Symptom:** Cannot recall the name of a psql variable
**Cause:** They are not in the main `\?` list
**Fix:** `\? variables`

**Symptom:** `\h` on a multi-word command seems not to match
**Cause:** Usually a typo — quoting is not required
**Fix:** `\h` with no argument lists every command name it knows

## Interview questions

**★ What is the difference between `\?` and `\h`?**
`\?` documents psql's own backslash commands; `\h` documents SQL syntax. `\?` also takes
`variables` and `options` for those sub-topics.

**★ Why prefer `\h` over a web search?**
It matches the connected server's version, works offline, and prints the doc URL for that
exact major version — measured, `https://www.postgresql.org/docs/18/sql-createindex.html`.

**★ Does `\h` help with functions?**
No, only SQL commands. Use `\df` for signatures and `\sf` to print a function's source.

**★ How do you discover psql features you do not know about?**
Read `\?` once end to end. `\gexec`, `\gdesc`, `\crosstabview` and `\errverbose` are all
there and commonly missed.

**How do you list the special psql variables?**
`\? variables` — it covers `ON_ERROR_STOP`, `VERBOSITY`, `AUTOCOMMIT` and the prompt
settings.

**What does `\h` show with no argument?**
Every SQL command it has help for, which doubles as an index of the SQL surface.

---

← [Output control](04-output-control.md) · Next → [Scripting psql](06-scripting.md)
