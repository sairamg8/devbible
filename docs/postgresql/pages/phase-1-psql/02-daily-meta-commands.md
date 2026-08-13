---
title: "Daily meta-commands"
sidebar_label: "02 · Daily meta-commands"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**Backslash commands are psql features, not SQL — they never reach the server as typed.
`\d`-family commands run catalog queries for you. Eight of them cover almost everything
you do daily.**

## The `\d` family

```console
$ ./ex31-psql-basics.sh
=== 02a. \dt — tables in the current schema ===
              List of tables
 Schema |     Name     | Type  |  Owner
--------+--------------+-------+----------
 public | p1_customers | table | devbible
 public | p1_orders    | table | devbible
(2 rows)
```

| Command | Lists |
|---|---|
| `\l` | databases |
| `\dn` | schemas |
| `\dt` | tables |
| `\di` | indexes |
| `\dv` | views |
| `\ds` | sequences |
| `\df` | functions |
| `\dm` | materialized views |

The pattern is `\d` plus a letter for the object type. Three modifiers compose with all of
them:

- **`+`** — more detail (size, description, persistence).
- **`S`** — include **S**ystem objects, which are hidden by default.
- **a pattern** — restrict by name.

```console
=== 02b. \dt+ adds size and description ===
                                              List of tables
 Schema |   Name    | Type  |  Owner   | Persistence | Access method | Size  |        Description
--------+-----------+-------+----------+-------------+---------------+-------+----------------------------
 public | p1_orders | table | devbible | permanent   | heap          | 16 kB | One row per customer order
```

**`\dt+` is how you find the big tables.** `Persistence` also shows `unlogged` or
`temporary` here — a fast way to spot a table that is not crash-safe.

## Patterns

```console
=== 02e. patterns: schema-qualified, wildcards, and S for system objects ===
              List of tables
 Schema |     Name     | Type  |  Owner
--------+--------------+-------+----------
 public | p1_customers | table | devbible
(1 row)

            List of tables
   Schema   | Name  | Type  |  Owner
------------+-------+-------+----------
 pg_catalog | pg_am | table | devbible
(1 row)
```

```bash
\dt p1_*                 # wildcard on the name
\dt public.p1_c*         # schema-qualified
\dtS pg_catalog.pg_am    # S to reach system catalogs
\dt *.*                  # every table in every schema
```

Patterns use `*` and `?`, **not** SQL's `%` and `_` — the most common thing to get wrong
here. A pattern with no wildcard is an exact match. Names are case-folded to lower unless
quoted, so `\dt "MyTable"` is how you find a mixed-case name.

## What `\l` and `\dn` are actually for

```console
=== 02c. \l databases, \dn schemas ===
                                                    List of databases
   Name    |  Owner   | Encoding | Locale Provider |  Collate   |   Ctype    |
-----------+----------+----------+-----------------+------------+------------+
 devbible  | devbible | UTF8     | libc            | en_US.utf8 | en_US.utf8 |
 postgres  | devbible | UTF8     | libc            | en_US.utf8 | en_US.utf8 |
 template0 | devbible | UTF8     | libc            | en_US.utf8 | en_US.utf8 |

      List of schemas
  Name  |       Owner
--------+-------------------
 public | pg_database_owner
```

`\l` is not just a list — it shows **encoding and locale provider per database**, which is
where text-sorting surprises come from. `\l+` adds size and the connection limit.

`\dn` matters more than it looks: `\dt` only shows what is on your `search_path`. A table
"that does not exist" is very often in a schema you are not looking at. `\dn` first, then
`\dt otherschema.*`.

## Switching around

```bash
\c otherdb              # connect to another database (same host/user)
\c otherdb otheruser    # and as another user
\c - otheruser          # same database, different user
```

`\c` reconnects. Anything session-local — `SET`, temp tables, prepared statements, an open
transaction — is gone afterwards. That is the surprise: `\c` in the middle of a debugging
session silently discards your temp table.

## `\df` for functions

```console
                              List of functions
   Schema   |      Name      | Result data type | Argument data types | Type
------------+----------------+------------------+---------------------+------
 pg_catalog | pg_size_pretty | text             | bigint              | func
 pg_catalog | pg_size_pretty | text             | numeric             | func
(2 rows)
```

Two rows for one name — overloads. When a call fails with "function does not exist", `\df
name` is the fastest way to see which argument types actually exist, which is nearly
always the real problem.

## These are not SQL

Backslash commands are interpreted by psql itself. Consequences:

- **They do not work from your application.** There is no `\dt` in `pg`, Prisma or any
  driver. The equivalent is querying `information_schema` or `pg_catalog`.
- **They cannot be mixed into a statement.** They are line-oriented, and take effect where
  they appear.
- **`-E` reveals the query behind each one**, which is how you steal it for your own
  tooling:

```bash
psql -E -c '\dt'   # prints the catalog query psql runs, then the result
```

That is the honest route from "I like `\dt`" to "my admin endpoint needs this list".

## Trade-off

**Meta-commands are convenience, and convenience that does not travel.** Everything here
is available to your application only as a `pg_catalog` query, and the shapes differ
between PostgreSQL versions — psql ships a matching query per version, your hand-written
one does not. Use the meta-commands freely while exploring; when the same information is
needed in code, take the query from `-E` and pin it to the version you target.

## Gotchas

**Symptom:** `\dt` shows nothing but the table definitely exists
**Cause:** It is in a schema outside your `search_path`
**Fix:** `\dn` to list schemas, then `\dt schemaname.*`

**Symptom:** A pattern with `%` matches nothing
**Cause:** psql patterns use `*` and `?`, not SQL wildcards
**Fix:** `\dt p1_*`

**Symptom:** A mixed-case table is not found
**Cause:** Patterns are folded to lowercase unless quoted
**Fix:** `\dt "MyTable"`

**Symptom:** System catalogs missing from `\dt`
**Cause:** System objects are hidden without `S`
**Fix:** `\dtS`, or `\dtS+` with a pattern

**Symptom:** Temp table vanished mid-session
**Cause:** `\c` reconnected — temp objects, `SET`s and open transactions do not survive
**Fix:** Do the reconnect before creating session state

**Symptom:** `function does not exist` for a function you can see
**Cause:** Wrong argument types; the name is overloaded
**Fix:** `\df thename` to see every signature

## Interview questions

**★ Are backslash commands SQL?**
No. psql interprets them locally and issues catalog queries on your behalf. They are
unavailable from any driver — the equivalent is querying `pg_catalog` or
`information_schema`.

**★ What do `+` and `S` do?**
`+` adds detail (size, description, persistence); `S` includes system objects, which are
hidden by default. Both compose with any `\d` variant.

**★ `\dt` shows nothing — what do you check first?**
`search_path`. `\dt` lists only visible schemas; run `\dn` and then qualify the pattern
with the schema name.

**★ How do you find out what query `\d` runs?**
Start psql with `-E`. It echoes the catalog query behind every meta-command — the way to
port one into application code.

**★ What does `\l` tell you beyond a list of names?**
Encoding, locale provider and collation per database. These explain sorting differences
between environments.

**What happens to your session when you use `\c`?**
It reconnects, discarding temp tables, `SET` values, prepared statements and any open
transaction.

**Why does `\df` sometimes show several rows for one function?**
Overloads. Each row is a distinct signature, and "function does not exist" usually means
the argument types do not match any of them.

---

← [Connecting with psql](01-connecting.md) · Next → [\d and \d+ in full](03-describe-table.md)
