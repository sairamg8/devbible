---
title: "The folklore that no longer holds"
sidebar_label: "01 · Outdated folklore"
sidebar_position: 1
---

# The folklore that no longer holds

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **MySQL 8.4.11** (`mysql:8`, `127.0.0.1:55440`), **SQLite 3.53.3** via `node:sqlite`,
> **Node 24.19.0**. Scripts: `sandbox/pg-api/ex56-vs-sqlite.mjs`,
> `sandbox/pg-api/ex57-vs-mysql.sh`.

**Three of the four things people say about MySQL stopped being true years ago. The
one that is still true is the one that matters most.**

## The one that actually changes your migrations

**MySQL cannot roll back DDL. PostgreSQL and SQLite both can.**

```console
$ ./ex57-vs-mysql.sh
=== 1. can you roll back a CREATE TABLE? ===
  postgres   t
  mysql      0
```

```console
$ node ex56-vs-sqlite.mjs
=== 4. can you roll back a CREATE TABLE? ===
  postgres   OK   [{"gone":true}]
  sqlite     OK   [{"gone":1}]
```

In MySQL, `CREATE TABLE` causes an **implicit commit** — the transaction you thought
you were in ended before the statement ran, so a later failure leaves the schema
half-migrated with no way back. This is why MySQL migration tools ship "down" scripts
and why PostgreSQL ones often do not need them: on PostgreSQL you wrap the whole
migration in `BEGIN … COMMIT` and a failure anywhere undoes all of it.

Note the shape of this result. The usual framing is "PostgreSQL has transactional DDL
and the toy database does not". Measured, **SQLite sides with PostgreSQL** and MySQL
is the outlier.

## Type strictness — the folklore is a version behind

The old complaint about MySQL silently truncating your data is **fixed**. Strict mode
has been the default since 5.7, and both engines reject the same bad input:

```console
=== 2. does an out-of-range value raise or get silently changed? ===
  postgres   ERROR: smallint out of range
  mysql      ERROR 1264 (22003) at line 1: Out of range value for column 'v' at row 1

=== 3. varchar(3) overflow ===
  postgres   ERROR: value too long for type character varying(3)
  mysql      ERROR 1406 (22001) at line 1: Data too long for column 'c' at row 1
```

**SQLite is the loose one**, and it is loose by design — column types are
*affinities*, not constraints:

```console
=== 1. does the engine enforce column types? ===
  postgres   ERR  22P02 invalid input syntax for type integer: "not-a-number"
  sqlite     OK   []
  sqlite→    OK   [{"id":1,"qty":"not-a-number","type":"text"}]

=== 2. is varchar(3) a limit or a suggestion? ===
  postgres   ERR  22001 value too long for type character varying(3)
  sqlite     OK   []
  sqlite→    OK   [{"code":"abcdefgh","len":8}]
```

A text value sits in an `integer` column and `typeof()` reports `text`. `varchar(3)`
holds eight characters. If you are prototyping on SQLite and deploying on PostgreSQL,
this is where the surprises come from — SQLite accepts rows your production database
will reject.

`STRICT` tables (SQLite 3.37+) opt back into type enforcement, and are worth using for
exactly this reason.

## `CHECK` constraints and `GROUP BY` — also fixed

Two more pieces of folklore that no longer reproduce:

```console
=== 10. CHECK constraint enforcement ===
  postgres   ERROR: new row for relation "t_chk" violates check constraint "t_chk_age_check"
  mysql      ERROR 3819 (HY000) at line 1: Check constraint 't_chk_chk_1' is violated.

=== 6. GROUP BY with a non-aggregated column ===
  postgres   ERROR: column "t_g.v" must appear in the GROUP BY clause …
  mysql      ERROR 1055 (42000) at line 1: Expression #2 of SELECT list is not in
             GROUP BY clause and contains nonaggregated column 'devbible.t_g.v' …
             this is incompatible with sql_mode=only_full_group_by
```

MySQL parsed and ignored `CHECK` until 8.0.16; it enforces them now.
`ONLY_FULL_GROUP_BY` has been in the default `sql_mode` since 5.7. Both of the "MySQL
lets you write nonsense" arguments are answered on a current server.

## One thing that is the same everywhere

**Sequence gaps.** A rolled-back insert consumes its id on all three engines:

```console
=== 11. one sequence/AUTO_INCREMENT after a rolled-back insert ===
  postgres   1,3
  mysql      1,3
```

Ids 1 and 3 survive; 2 is gone. This is not a PostgreSQL quirk to be worked around —
sequences are non-transactional by design so they never block, and every engine here
makes the same trade. Never present ids to users as a count.

> **This measurement was wrong the first time.** Several statements in one `psql -c`
> share a single implicit transaction, so the embedded `ROLLBACK` discarded the *first*
> insert too and PostgreSQL appeared to keep only `3` — a difference that does not
> exist. Each statement now gets its own `-c`. A "measured" number is not automatically
> a correct one.

## Trade-off

Believing the outdated version of this comparison costs you in both directions: you
rule out MySQL for strictness reasons that no longer apply, and you trust SQLite in
places its type system will not protect you. The check is cheap — run the statement
against the actual server version you are targeting.

## Gotchas

**Symptom:** A migration failed halfway and left the schema broken — on MySQL only
**Cause:** DDL causes an implicit commit; there was no transaction left to roll back.
**Fix:** Write down-migrations, or run schema changes one statement at a time with a
verified recovery path. On PostgreSQL, wrap the migration in `BEGIN … COMMIT`.

**Symptom:** Rows that were fine in SQLite are rejected by PostgreSQL
**Cause:** SQLite column types are affinities — a text value sits in an `integer`
column and `varchar(3)` holds eight characters.
**Fix:** `STRICT` tables in SQLite, and run the real schema in CI.

**Symptom:** Ids have gaps and someone filed it as a bug
**Cause:** Sequences are non-transactional — measured identically on PostgreSQL and
MySQL.
**Fix:** Nothing. Do not use ids as counts.

**Symptom:** A comparison benchmark shows a difference that vanishes on re-run
**Cause:** Statement batching changed the transaction boundaries on one side only.
**Fix:** One statement per invocation when transaction semantics are what you are
measuring.

## Interview questions

**★ What is the most important practical difference between PostgreSQL and MySQL?**
Transactional DDL. PostgreSQL can roll back a `CREATE TABLE`; MySQL implicitly commits
before it, so a failed migration leaves the schema half-applied. Measured: the same
`BEGIN … CREATE TABLE … ROLLBACK` left the table gone on PostgreSQL and present on
MySQL 8.4.

**★ Is MySQL still loose about data types?**
No — that is a version behind. Strict mode has been default since 5.7; measured, MySQL
8.4 rejects an out-of-range `smallint` (1264) and an oversized `varchar` (1406) just as
PostgreSQL does. It also enforces `CHECK` (since 8.0.16) and defaults to
`ONLY_FULL_GROUP_BY`. **SQLite** is the permissive one.

**Do sequence gaps mean something is broken?**
No, and it is not PostgreSQL-specific — measured identically on PostgreSQL and MySQL, a
rolled-back insert consumes its id on both. Sequences are non-transactional so they
never become a contention point.

**Which engine has transactional DDL?**
PostgreSQL and SQLite. MySQL does not — which inverts the usual "the embedded one is
the limited one" assumption.

---

← [Overview](README.md) · Next → [The differences that survive](02-real-differences.md)
