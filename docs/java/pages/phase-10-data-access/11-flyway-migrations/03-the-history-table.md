---
title: "flyway_schema_history is not a log — it is the authoritative record of what this particular database has actually had done to it, and every decision Flyway makes is a comparison between that record and the files on your classpath"
sidebar_label: "03 · The history table"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's own source and reference documentation —
> `SchemaHistoryItem` and `JdbcTableSchemaHistory`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/schemahistory/JdbcTableSchemaHistory.java)),
> `CoreMigrationType` and `BaselineMigrationType`
> ([CoreMigrationType.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/CoreMigrationType.java)),
> *Migrate* ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/migrate)),
> *Validate* ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/validate))
> and the *Flyway Table Setting* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-table-setting-277579042.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Everything Flyway does is one comparison. On one side, the migrations it can resolve from
`locations` — the files. On the other, the rows in `flyway_schema_history` — the facts. `migrate`
applies the difference, `validate` asserts the two agree about the past, and `info` prints the
comparison. There is no third source of truth, no cache and no state in the application. Delete
the table and Flyway believes the database is brand new; keep the table and lose the files and
Flyway believes you have deleted history. Both beliefs are wrong in the same way, and the ten
columns below are the whole of what Flyway remembers.**

## Where it lives and when it appears

The table is created by `migrate`, not by the application starting and not by a setup step you
run. The *Migrate* reference is explicit: *"Flyway will create the schema history table
automatically if it doesn't exist."* It is created inside the same lock that guards the
migration run, and Flyway retries the creation up to ten times at one-second intervals — which
matters when ten pods start simultaneously against an empty database and all ten try to create
it at once.

Its name defaults to `flyway_schema_history` and is set by `spring.flyway.table`. Its schema is
*"the default schema for the connection provided by the datasource"* in single-schema mode, and
the configured default schema when `spring.flyway.default-schema` or the environment's `schemas`
is set.

```yaml
spring:
  flyway:
    table: flyway_schema_history      # the default; shown to make the coupling visible
    default-schema: app               # if set, the history table follows it
```

⚠️ **Changing `table` or `default-schema` on a live service points Flyway at a table that does
not exist**, so it creates an empty one and concludes that nothing has ever been applied. It
then tries to run every migration from `V1` against a fully populated database. This is the
single most destructive misconfiguration in the whole topic and it produces no warning at all
before it starts.

## The ten columns

Flyway 12 writes and reads exactly ten columns. They are the fields of `SchemaHistoryItem` in
the source, and `JdbcTableSchemaHistory` reads them back by lower-cased name, which is why the
column *names* are the contract rather than their order.

| Column | What it holds | Null when |
|---|---|---|
| `installed_rank` | integer; the order this database applied things, and the primary key | never |
| `version` | the version parsed from the file name, as text | repeatable migrations |
| `description` | the description from the file name, underscores turned into spaces | never |
| `type` | which kind of thing this row records — `SQL`, `JDBC`, `BASELINE`, … | never |
| `script` | the migration's path, relative to its location | never |
| `checksum` | the CRC32 of the migration's contents | `BASELINE` and `SCHEMA` rows |
| `installed_by` | the database user that applied it | never |
| `installed_on` | timestamp, defaulted by the database at insert | never |
| `execution_time` | milliseconds the migration itself took | never |
| `success` | boolean; whether it completed | never |

Several of them are the answer to a question that only comes up during an incident, so they are
worth taking in the order they matter rather than the order they appear.

### `installed_rank` — the only column that records what happened

`installed_rank` is the primary key and it is a plain increasing integer, assigned at insert
time. It is **not** derived from `version`. When `out-of-order` is enabled and a straggling `V2`
arrives after `V3` has run, `V2` gets the *higher* `installed_rank` — because that is the order
this database did the work in.

That distinction is the whole reason the column exists. `version` is what a migration *claims*;
`installed_rank` is what a database *did*. Reconstructing a timeline from `version` gives you
the intended history; reconstructing it from `installed_rank` gives you the real one, and the
two disagree exactly when something went wrong —
[02c · Choosing version numbers](02c-choosing-version-numbers.md) covers when that happens.

### `version` — nullable, and that is the design

Repeatable migrations have no version, so this column is null for them. Two consequences follow
immediately: the table cannot carry a unique constraint on `version`, and any query you write
that groups or joins on `version` has to decide what to do with nulls. A repeatable migration
applied four times is four rows with the same description, four different `installed_rank`s and
four nulls in `version`.

### `type` — a small closed set, and some of it is synthetic

The values come from two enums. `CoreMigrationType` supplies `SCHEMA`, `BASELINE`, `DELETE`,
`SQL`, `JDBC`, `SCRIPT`, `UNDO_SCRIPT` and `CUSTOM`; `BaselineMigrationType` adds `SQL_BASELINE`
and `JDBC_BASELINE` for `B`-prefixed baseline migrations.

Three of them are marked `synthetic` in the source — *"only ever present in the schema history
table, but never discovered by migration resolvers"*:

| Type | Written by | Means |
|---|---|---|
| `SCHEMA` | Flyway, when it creates a schema for you | "I created this schema; `clean` may drop it" |
| `BASELINE` | the `baseline` command | "everything at or below this version is assumed present" |
| `DELETE` | `repair`, marking a missing migration | "this ran once, the file is gone, stop complaining" |

Because they are synthetic, no file on your classpath will ever match them. That is deliberate:
a `SCHEMA` or `BASELINE` row is a fact about this database, not a fact about the repository, so
`validate` must not go looking for a corresponding file. `SQL` and `JDBC` rows are the opposite —
every one of them is a claim that a specific file exists and has a specific checksum.

### `script` — the string `validate` compares, and a portability trap

`script` holds the path of the migration relative to the location it was found in. For a plain
`db/migration` layout that is just the file name; for a nested layout it carries the
subdirectory too. It is compared as a string, so **moving a migration into a subdirectory after
it has been applied changes `script` and is a validation failure**, even though the file's
contents never changed and its checksum still matches.

### `checksum` — nullable, integer, CRC32

*"Validate works by storing a checksum (CRC32 for SQL migrations) when a migration is executed."*
It is a 32-bit integer, which is why the column is an `INTEGER` and why the value reads as
negative about half the time. Synthetic rows carry no checksum, because there is no file to
checksum. Everything else the checksum implies gets its own chunk —
[04 · Checksums and immutability](04-checksums-and-immutability.md).

### `description` — cosmetic for `V`, load-bearing for `R`

For a versioned migration the description is documentation: it appears in `info` and in the
table, and changing it after the fact fails `validate` on the *name* comparison rather than the
checksum one. For a **repeatable** migration it is the identity — there is no version, so the
description is what Flyway matches a row against a file by, and renaming an applied `R__` file
makes Flyway treat it as a brand new migration while the old row becomes missing.

### `installed_by` and `installed_on` — the audit half

`installed_by` is the database user Flyway was connected as, taken from the connection rather
than from any application-level identity. If every environment migrates as the same pooled
application user, this column tells you nothing useful; if the pipeline migrates as a dedicated
`migrator` role and the application connects as `app`, it tells you at a glance whether a
migration was applied by the pipeline or by somebody with a `psql` session open.

⚠️ **`installed_on` is the database's clock, not the application's.** It is defaulted by the
column definition at insert time. On a database whose timezone differs from the application's,
this timestamp will not line up with your application logs — the same trap set out in
[03 · JDBC and transactions · 13b · The four clocks](../03-jdbc-transactions/13b-the-four-clocks.md).

### `execution_time` — milliseconds, and narrower than you think

It measures the migration's execution and nothing else. It excludes waiting for Flyway's lock,
excludes connection acquisition, and on a grouped run is still recorded per migration. A
migration showing an `execution_time` of 40 inside a deploy that hung for nine minutes did not
take nine minutes — it waited for something, and the history table is not where that waiting is
recorded.

## Gotchas

**★ The table is created by `migrate`, so an empty table proves nothing ran — not that nothing
was needed.** An application that never reached `migrate` and one whose migrations were all
skipped look identical from the table alone.

**★ Pointing Flyway at a different `table` or `default-schema` resets its entire memory.** It
creates a new empty history table, sees no applied migrations, and attempts `V1` against a
populated database. There is no confirmation step and no warning.

**★ `installed_rank` and `version` disagree by design once anything runs out of order.** Sorting
by `version` while investigating an incident silently reorders reality.

**★ `version` is null for every repeatable migration.** Queries that assume it is populated
either drop repeatables or fail on the null, and the same repeatable appears once per
application rather than once in total.

**★ Moving a migration file into a subdirectory changes `script` and fails `validate`.** The
contents are identical and the checksum still matches; the path does not, and `validate` checks
*"differences in migration names, types or checksums"*.

**★ Renaming an applied `R__` file is not cosmetic.** The description *is* the repeatable
migration's identity, so a rename creates a new migration and orphans the old row.

**★ Synthetic rows have no file and never will.** `SCHEMA`, `BASELINE` and `DELETE` are facts
about this database. Trying to "fix" one by creating a matching migration file produces a
duplicate-version conflict instead.

**★ `checksum` is a signed 32-bit integer and prints negative about half the time.** That is
CRC32 in a Java `int`, not corruption.

**★ `installed_on` comes from the database clock.** Correlating it with application logs across a
timezone difference or clock skew produces a timeline that is subtly wrong in exactly the
situation where you need it right.

**★ `execution_time` does not include lock waiting.** A deployment that took ten minutes because
another pod held the lock records a two-millisecond migration, which sends people looking in the
wrong place.

**★ Two applications sharing one schema and one history table each try to apply the other's
migrations.** The table has no concept of ownership. Two applications sharing a schema need two
history tables via `spring.flyway.table` — and even then they are sharing a schema, which is a
separate problem.

**★ `description` is derived from the file name, not from a comment in the file.** Underscores
become spaces and that is the entire transformation; there is no way to write a longer
description into the row.

## Interview questions

**★ What is `flyway_schema_history` and what does Flyway use it for?**
It is the record of every migration applied to that specific database. Flyway compares it
against the migrations it can resolve from `locations`: `migrate` applies the difference,
`validate` asserts the two agree about what already ran, and `info` prints the comparison. It is
the only state Flyway has — nothing is cached in the application.

**★ Why is `installed_rank` the primary key rather than `version`?**
Because `version` is not unique — repeatable migrations have no version at all — and because
`installed_rank` records the order this database actually applied things, which diverges from
version order as soon as an out-of-order migration is allowed.

**★ When is the table created, and by what?**
By `migrate`, automatically, if it does not exist. Not by the application starting and not by a
separate setup step. It is created inside Flyway's lock, with retries, so concurrent starters do
not fight over it.

**★ What does the `type` column contain, and which values are synthetic?**
`SQL`, `JDBC`, `SCRIPT`, `CUSTOM` and `UNDO_SCRIPT` for real migrations; `SQL_BASELINE` and
`JDBC_BASELINE` for `B`-prefixed baseline migrations; and three synthetic values — `SCHEMA`,
`BASELINE` and `DELETE` — which exist only in the table and never correspond to a file.

**★ Somebody changed `spring.flyway.table` in production. What happens?**
Flyway finds no table under the new name, creates an empty one, concludes the database has never
been migrated, and starts applying `V1`. It is the most destructive single-property change in
Flyway's configuration and it gives no warning beforehand.

**★ What exactly does `script` hold, and why does that matter?**
The migration's path relative to the location it was resolved from — so a file name for a flat
layout, and a subdirectory-qualified path for a nested one. It is compared as a string during
`validate`, which is why reorganising migration directories after they have been applied is a
breaking change.

**★ Why is `version` nullable?**
Because repeatable migrations do not have one. Their identity is the description, and the same
repeatable produces a new row every time its checksum changes and it is re-applied.

**★ Where does `installed_by` come from — the application user or the database user?**
The database user on the connection Flyway used. It is genuinely useful only if migrations run
as a different role than the application, which is a good reason to arrange exactly that.

**★ Why does `execution_time` sometimes look absurdly small for a deployment that took minutes?**
Because it times the migration's own execution. Lock waiting, connection acquisition and
application startup are all outside it. A slow deploy with a fast migration is almost always the
lock.

**★ You are reconstructing what happened during a bad release. Which columns do you read, and in
what order?**
Order by `installed_rank` descending, and read `type`, `success`, `installed_by` and
`installed_on` together. `installed_rank` gives the real order, `installed_by` separates pipeline
runs from manual ones, and `success` tells you whether Flyway stopped or carried on.

{/* FOOTER */}
