---
title: "During any rolling deployment two versions of your code run against one database at the same time, so every migration has to be compatible with the version it is replacing as well as the one it is introducing — which is why renaming a column is three deployments and not one"
sidebar_label: "08 · Migrating a live service"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html)),
> the Flyway *Migrations* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migrations-271585107.html))
> and Spring Boot 4.1's `FlywayAutoConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayAutoConfiguration.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Everything up to here has treated a migration as something that happens to a database. In a
running service it happens to a database that code is actively using — and during a rolling
deployment, *two versions* of that code are using it at once. That single fact rules out most of
the migrations people naturally write, and it is why a rename, which is one line of SQL and one
line of Java, is three separate deployments.**

## The overlap window

A rolling deployment replaces instances one at a time so the service stays up. For the duration —
seconds if you are lucky, an hour if a canary is involved, indefinitely if a rollback happens and
nobody notices — the following is true:

- **version N** of the code is running on some instances,
- **version N+1** is running on the others,
- and there is exactly **one** database.

Under Spring Boot, migrations run at startup ([07](07-boot-integration.md)), so the moment the
first N+1 instance comes up, the schema has already changed **for every instance, including all the
N ones**.

That gives the rule, and everything else on this page is a consequence:

> 🔴 **Every migration must leave the schema working for the code that is already running, and every
> code version must work with the schema both before and after its own migration.**

Two compatibility directions, not one. Most schema changes people write satisfy neither.

## The failure, concretely

```sql
-- V42__Rename_customer_name.sql
ALTER TABLE customers RENAME COLUMN name TO full_name;
```

One line, obviously correct, and it takes the service down. The instant the first N+1 pod runs it,
every N pod is issuing `SELECT … name FROM customers`, and that column no longer exists. Errors
until the rollout finishes — and if the rollout is *paused* because the errors triggered an alert,
the outage lasts as long as the pause.

It is worse than it looks, because the obvious remedy makes it permanent. Rolling back to N does
not roll back the migration: Flyway has no undo in the Community edition
([01 · Why schema is code](01-why-schema-is-code.md)), the column is still called `full_name`, and
now *every* instance is broken rather than half of them.

## Expand / migrate / contract

The pattern that makes the rule satisfiable. Three phases, and — this is the part that gets
compressed and then goes wrong — **each is its own deployment**.

| Phase | Schema | Code |
|---|---|---|
| **Expand** | add the new thing; keep the old | unchanged, or writes both |
| **Migrate** | backfill; both work | reads new, writes both |
| **Contract** | remove the old thing | reads and writes new only |

The invariant at every point: **the schema supports both the code that is running and the code that
is about to run.** Never one or the other.

## A rename, done properly

### Deploy 1 — expand

```sql
-- V42__Add_full_name.sql
ALTER TABLE customers ADD COLUMN full_name text;
```

⚠️ **Nullable, and with no default.** PostgreSQL is explicit that `ADD COLUMN` with a non-volatile
default or no default requires no rewrite: *"In neither case is a rewrite of the table required."*
A `NOT NULL` here would fail immediately on the existing rows, and a volatile default would rewrite
the table — [08b · Locks and long migrations](08b-locks-and-long-migrations.md) has that half.

Code in deploy 1 **writes both columns and reads the old one**:

```java
customer.setName(name);
customer.setFullName(name);   // dual write; nothing reads it yet
```

At the end of this deploy every *new* and *updated* row has both. Old rows do not.

### Deploy 2 — migrate

```sql
-- V43__Backfill_full_name.sql
UPDATE customers SET full_name = name WHERE full_name IS NULL;
```

⚠️ A single `UPDATE` over a large table is a long transaction holding row locks — **[10 · Data migrations](10-data-migrations.md)** is about doing this in batches. For a small table this is fine as
written.

Code in deploy 2 **reads the new column and still writes both.** Writing both is what makes deploy 2
rollback-safe: if you go back to deploy 1, `name` is still current.

### Deploy 3 — contract

Only once you are confident deploy 2 will not be rolled back:

```sql
-- V44__Drop_name.sql
ALTER TABLE customers DROP COLUMN name;
```

Code in deploy 3 stops writing `name`. And the ordering *within* this deploy matters: the code
must stop writing the old column **before** the column disappears, which means deploy 3's code
change and `V44` cannot safely be in the same deployment either — unless the column is left
nullable, so an N-version instance writing to it during the window is harmless right up to the
moment it is dropped.

**In practice this is why the pattern is often described as four steps rather than three**: expand,
dual-write, read-new, contract. The extra one exists because "stop writing the old column" is
itself a code change that has to roll out fully before the column can go.

## Why not just take the service down?

Sometimes that *is* the right answer, and pretending otherwise is how teams end up with an
elaborate three-deploy dance for a table with four hundred rows in a system with a nightly
maintenance window.

The honest decision inputs: how long the change takes, whether the service has a maintenance
window, what an outage costs, and how many people have to coordinate. A five-second change to a
small table during a scheduled window is one deployment. The same change to a two-hundred-million
row table in a service with an availability commitment is three deployments and a fortnight.

⚠️ **What is not defensible is doing the one-deployment version by accident**, discovering the
overlap window during the rollout, and finding out that rolling back does not help.

## Gotchas

**★ Two versions of your code run against one database during every rolling deployment.** That is
the whole source of the problem, and it is easy to forget in a codebase where deployments usually
go fine.

**★ The schema changes for *all* instances the moment the first new one starts.** Boot runs
migrations during context refresh, so there is no window in which only the new pods see the new
schema.

**★ Rolling back the code does not roll back the schema.** Flyway Community has no undo, so a
breaking migration plus a rollback is worse than a breaking migration alone.

**★ A rename is the worst case disguised as the simplest.** One line of SQL, and it breaks every
running instance instantly.

**★ Expand/contract is three deployments, and often four.** "Stop writing the old column" is a code
change that must roll out completely before the contract migration is safe.

**★ The expand column must be nullable.** `ADD COLUMN … NOT NULL` without a default fails on
existing rows, and the version of the code that is still running does not know to populate it.

**★ Dual-writing is what makes the middle deployment reversible.** Skip it and deploy 2 becomes a
one-way door.

**★ The backfill is a data migration and needs to be treated as one.** A single `UPDATE` over a
large table is a long-running transaction, not a schema change.

**★ Backfill with a `WHERE` that makes it re-runnable.** `WHERE full_name IS NULL` means a
half-finished backfill can simply be run again.

**★ Waiting between deploy 2 and deploy 3 is the point, not an inconvenience.** Contracting while a
rollback to deploy 1 is still plausible re-creates the original outage.

**★ Adding a column with a *volatile* default rewrites the whole table.** PostgreSQL's own wording;
the non-volatile case does not. Getting this wrong turns an instant migration into a table rewrite
under a lock.

**★ Sometimes a maintenance window is the correct engineering answer.** Expand/contract has a real
cost in elapsed time and coordination, and it is not always worth paying.

**★ The pattern is not about databases specifically.** It is the general shape of changing an
interface two parties depend on while both are live — the same argument as a wire-format or an API
version.

## Interview questions

**★ Why can you not just rename a column in a migration?**
Because during a rolling deployment the old code is still running and still referring to the old
name. The moment the first new instance applies the migration, every old instance is querying a
column that no longer exists.

**★ Does rolling back the deployment fix it?**
No, and that is what makes it dangerous. The migration is not undone by a code rollback — Flyway
Community has no undo — so after the rollback every instance is broken instead of half of them.

**★ What is the rule that governs migrations on a live service?**
Every migration must leave the schema working for the code already running, and every code version
must work with the schema both before and after its own migration. Two directions of
compatibility, not one.

**★ Describe expand/contract.**
Expand: add the new structure while keeping the old, and start writing both. Migrate: backfill
existing rows and switch reads to the new structure, still writing both. Contract: stop writing the
old structure and then remove it. Each phase is a separate deployment.

**★ Why is a rename three deployments rather than two?**
Because there has to be a period in which both columns are correct, so that either version of the
code is safe. Collapse expand and contract into one deployment and you are back to the original
outage. In practice it is often four, because "stop writing the old column" is itself a change that
must complete before the drop.

**★ Why must the new column be nullable in the expand phase?**
Because the code still running does not populate it, and `NOT NULL` without a default fails against
existing rows anyway. Nullable is what lets both versions coexist.

**★ What makes the middle deployment reversible?**
Continuing to write the old column. If deploy 2 is rolled back to deploy 1, the old column is still
current and nothing is lost. Stop dual-writing too early and the middle deployment becomes a
one-way door.

**★ How do you write the backfill so it can be interrupted?**
Make it re-runnable with a predicate that skips what is already done — `WHERE full_name IS NULL` —
and, on a large table, in batches rather than one transaction.

**★ How long should you wait before the contract phase?**
Long enough that a rollback past the migrate phase is no longer plausible. That is a judgement
about your release process, not a fixed number, and the waiting is the mechanism rather than an
inconvenience.

**★ When is it right to skip all this and take a maintenance window?**
When the change is short, the table is small, the service has a window, and the coordination cost
of three deployments exceeds the cost of the outage. That is a legitimate answer and stating it
explicitly is better than performing expand/contract on a four-hundred-row table.

**★ Why does adding a column with a default sometimes rewrite the table?**
Because PostgreSQL can only store a *non-volatile* default as metadata. A volatile default has to
be evaluated per row, so the whole table and its indexes are rewritten — which is a very different
operation from the instant one you expected.

**★ Where else does this pattern appear?**
Anywhere two parties depend on a shared interface and both are live: API versioning, message
formats, serialized cache entries. The database is just the case where the shared thing is durable,
which makes getting it wrong more expensive.

{/* FOOTER */}
