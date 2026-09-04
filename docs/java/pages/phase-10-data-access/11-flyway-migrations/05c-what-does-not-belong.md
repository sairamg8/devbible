---
title: "Everything on the do-not-put-this-in-a-repeatable-migration list fails loudly on the second run except one entry, and that one entry is the reason the list is worth memorising rather than derived each time"
sidebar_label: "05c · What does not belong"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the *Repeatable migrations* concept page
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations)),
> PostgreSQL 18's `CREATE MATERIALIZED VIEW`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-creatematerializedview.html)),
> `REFRESH MATERIALIZED VIEW`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html))
> and Flyway 12's `SqlMigrationResolver`
> ([SqlMigrationResolver.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/resolver/sql/SqlMigrationResolver.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[05b](05b-what-belongs-in-a-repeatable-migration.md) listed the objects a repeatable migration can
legitimately describe. This is the complement, and it is the more useful half, because the failure
modes are not symmetrical. Almost everything on this list errors on the second run and gets fixed
within the hour. Exactly one entry succeeds, changes the data, and does it again on every subsequent
deployment — and that one is worth being able to recognise on sight.**

## What does not belong, and why

| Statement | Why it fails as a repeatable migration |
|---|---|
| `CREATE TABLE` | not replaceable; the second run fails |
| `ALTER TABLE ADD COLUMN` | not idempotent; the second run fails on the existing column |
| `INSERT` without `ON CONFLICT` | the second run duplicates the rows |
| `UPDATE … SET n = n + 1` | ⛔ **the second run applies it again** — silent, cumulative corruption |
| `DELETE FROM …` | re-deletes rows a later step may have legitimately re-created |
| Anything with `now()` or a sequence | produces different data every run, and the checksum never changes |
| A data backfill | belongs in a versioned migration — see **[10 · Data migrations](10-data-migrations.md)** |

The `UPDATE … SET n = n + 1` row is the dangerous one because it is the only entry that **does not
fail**. Everything else on the list errors on the second run and gets fixed within an hour. A
non-idempotent `UPDATE` succeeds, changes the data, and does it again on every deployment that
happens to touch the file.

The test that catches all of them: **run this file twice against the same database in your head. Is
the end state identical?** If the second run errors, you will find out immediately. If it succeeds
and produces a different state, you have a bug that will take a very long time to attribute.

## Materialized views are a trap worth naming

A materialized view looks like a view and behaves like a table. `CREATE OR REPLACE MATERIALIZED
VIEW` does not exist in PostgreSQL, so a repeatable migration has to drop and recreate — which
**re-runs the query and rebuilds the data** every time the file changes. On a large materialized
view that is a long-running statement holding a lock, inside a deployment, which is
[08b · Locks and long migrations](08b-locks-and-long-migrations.md)'s subject and not something to
discover by accident.

The definition can still live in a repeatable migration; the point is to know that changing it is a
data operation, not a metadata one, and to size the deployment accordingly. `REFRESH MATERIALIZED
VIEW` is a scheduled job's business, not a migration's.

## The naming convention that saves you later

Two properties are worth encoding in the description, because neither is recoverable afterwards:
the **dependency order**, and the **kind of object**.

```
R__010_fn_normalise_postcode.sql
R__020_vw_customer_activity.sql
R__030_vw_customer_activity_summary.sql
R__100_ref_countries.sql
R__110_ref_currencies.sql
```

The numbers give a total order that the alphabetical sort respects, with gaps for insertions; the
`fn_` / `vw_` / `ref_` tags group by kind. And because the description *is* the identity of a
repeatable migration ([05](05-repeatable-migrations.md)), renumbering later means every renamed
file becomes `Missing` — so leave gaps generously the first time.

## Gotchas

**★ Only one entry on the list fails silently, and it is the non-idempotent `UPDATE`.** `SET n = n + 1`
runs again on every deployment that touches the file, and the damage accumulates until somebody
notices a number that is wrong by a factor nobody can explain.

**★ Everything else on the list errors on the second run**, which is a gift. A `CREATE TABLE` or an
unguarded `INSERT` announces itself within one deployment.

**★ `DELETE FROM …` in a repeatable migration re-deletes.** Rows a later process legitimately
re-created disappear again the next time the file changes.

**★ Anything using `now()`, `random()`, `uuid_generate_v4()` or a sequence produces different data on
every run while the checksum stays identical.** The file looks unchanged and the database is not.

**★ A `TRUNCATE … ; INSERT …` pair looks idempotent and is not safe.** It is idempotent in end state
and catastrophic in effect — every run destroys anything else that wrote to the table, and
`TRUNCATE` takes an `ACCESS EXCLUSIVE` lock.

**★ Data backfills do not belong in repeatable migrations**, however tempting the re-runnability
looks. They are a one-time transformation of existing rows and they belong to a version.

**★ There is no `CREATE OR REPLACE MATERIALIZED VIEW` in PostgreSQL.** A repeatable migration for
one is a drop-and-rebuild, which re-runs the whole query under a lock inside your deployment.

**★ A materialized view is a table wearing a view's name.** Everything about sizing a data operation
applies to it, and none of the intuition from ordinary views does.

**★ `REFRESH MATERIALIZED VIEW` is a job's business, not a migration's.** A migration that refreshes
one has made every deployment as slow as the query.

**★ Renumbering the description prefixes later renames the migrations.** The description is the
identity, so every renamed file becomes `Missing` and needs a `repair`. Leave gaps generously the
first time.

**★ Prefix gaps of ten are not generous enough for a long-lived project.** Steps of ten fill up;
steps of a hundred with kind-tags in between survive.

**★ "It is idempotent because I wrapped it in `IF NOT EXISTS`" is often false for data.**
`IF NOT EXISTS` is a DDL guard. Data needs `ON CONFLICT`, and the two are not interchangeable.

**★ The check that catches all of it takes ten seconds: run the file twice in your head.** If the
second run errors you will find out anyway; if it succeeds and leaves a different state, you have a
bug nobody will attribute to this file.

## Interview questions

**★ Which mistake in a repeatable migration is the most dangerous, and why?**
A non-idempotent `UPDATE`, because it is the only one that succeeds. Everything else — a plain
`CREATE TABLE`, an `INSERT` without a conflict clause — fails on the second run and gets noticed
immediately. An `UPDATE` that increments quietly does its damage again on every deployment.

**★ What is the practical test for whether a file can be a repeatable migration?**
Run it twice against the same database in your head and ask whether the end state is identical. It
catches every entry on the list, and it does not require remembering which statements happen to be
idempotent.

**★ Why is a `TRUNCATE` followed by an `INSERT` a bad pattern even though the end state is stable?**
Because idempotent in end state is not the same as safe. Every run destroys whatever else wrote to
the table, and `TRUNCATE` takes an `ACCESS EXCLUSIVE` lock — a deployment-time outage for a table
somebody is reading.

**★ Why can a repeatable migration containing `now()` be wrong even though nothing errors?**
Because the checksum is computed from the file, which has not changed, while the data it writes is
different every time it does run. The record says one thing happened; several different things did.

**★ How do you handle a materialized view?**
Carefully. There is no replace-in-place form, so the repeatable migration drops and recreates it,
which rebuilds all the data under a lock. That is a data operation inside a deployment and it needs
to be sized like one. Refreshing it on a schedule is a job's responsibility, not a migration's.

**★ Is `CREATE TABLE IF NOT EXISTS` acceptable in a repeatable migration?**
It will not error, which is not the same as being right. A table is structure and belongs to a
version — putting it in a repeatable migration means the schema's shape has no place in the ordered
history, and the second developer to change that table has nowhere sensible to put the change.

**★ Why do you number the descriptions rather than relying on the file order?**
Because the ordering is alphabetical on the description and nothing else. Zero-padded numeric
prefixes make the string sort match the intended dependency order, and gaps let you insert later
without renaming anything.

**★ Why is renaming a repeatable migration more disruptive than renaming a versioned one?**
Because the description is its identity — there is no version. A renamed file is a brand-new
migration that will run, and the old one becomes `Missing` and fails validation until it is
repaired or the name is restored.

**★ You inherit a project where a data backfill lives in a repeatable migration. What do you do?**
Establish first whether it has been re-running — the history table shows every re-application. Then
move the transformation into a versioned migration and reduce the repeatable file to whatever part
of it is genuinely a state, or delete it and `repair`. Do not simply stop touching the file; the
next person to edit it will re-run the backfill.

**★ Someone argues a repeatable migration is the ideal place for seed data because it is easy to
change. What is the counter?**
That ease of change is exactly the problem for anything the application also writes. Reference data
the application never modifies is fine as an upsert. Seed data that a running system mutates gets
silently overwritten on the next deployment that touches the file.

{/* FOOTER */}
