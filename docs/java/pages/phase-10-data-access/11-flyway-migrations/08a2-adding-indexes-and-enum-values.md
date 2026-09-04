---
title: "An index and an enum value cannot be deferred the way a constraint can — CREATE INDEX CONCURRENTLY buys you the write lock back at the price of running outside a transaction, which is the one migration Flyway cannot roll back for you"
sidebar_label: "08a2 · Adding indexes and enum values"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html)),
> `CREATE INDEX`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-createindex.html)),
> `ALTER TYPE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertype.html))
> and Flyway 12's `PostgreSQLParser`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/flyway-database/flyway-database-postgresql)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[08a](08a-adding-things-safely.md) covered the additions that `NOT VALID` makes cheap: columns,
`CHECK` constraints and foreign keys. This chunk covers the three that it does not help with at all.
An index has no "add it now, prove it later" form — the build is the whole cost — and an enum value
has no removal at all. Both push you out of the transactional model Flyway normally gives you, which
changes what a failure leaves behind.**

## Add an index

```sql
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders (customer_id);
```

A plain `CREATE INDEX` *"locks the table to be indexed against writes"*, which on a busy table is
an outage. `CONCURRENTLY` avoids it at a real cost: two table scans, and it waits for existing
transactions to finish.

🔴 **And it cannot run inside a transaction**, which collides directly with how Flyway works:

> *"a regular `CREATE INDEX` command can be performed within a transaction block, but `CREATE INDEX
> CONCURRENTLY` cannot"*

Flyway's PostgreSQL parser knows this — `detectCanExecuteInTransaction` returns `false` for
`^(CREATE|DROP)( UNIQUE)? INDEX CONCURRENTLY` — so the migration runs outside a transaction
automatically. The consequences of that are exactly [03b](03b-when-a-migration-fails.md)'s subject:
a failure leaves a `success = false` row **and** wreckage.

The wreckage here is specific and documented: a failed `CREATE INDEX CONCURRENTLY` *"leave[s] behind
an 'invalid' index"*, which `\d` reports as `INVALID`. Recovery is to drop it and retry, or
`REINDEX INDEX CONCURRENTLY`.

⚠️ **Put a concurrent index in a migration of its own**, with nothing else in the file. Mixing it
with transactional statements means either `mixed: true` or a migration that half-applied.

## Add a unique constraint

The naive form builds a unique index under a write lock. The safe form separates the two operations
using a documented `ALTER TABLE` variant:

```sql
-- migration 1, alone in its file, non-transactional
CREATE UNIQUE INDEX CONCURRENTLY customers_email_uq ON customers (lower(email));
```

⚠️ That expression index cannot then be promoted, which is the trap. The `USING INDEX` form is
restricted:

> *"The index cannot have expression columns nor be a partial index. Also, it must be a b-tree index
> with default sort ordering."*

For a plain column it works:

```sql
CREATE UNIQUE INDEX CONCURRENTLY customers_email_uq ON customers (email);

-- migration 2
ALTER TABLE customers ADD CONSTRAINT customers_email_uq UNIQUE USING INDEX customers_email_uq;
```

> *"This form adds a new `PRIMARY KEY` or `UNIQUE` constraint to a table based on an existing unique
> index. All the columns of the index will be included in the constraint."*

For an expression or partial index, the unique *index* is the enforcement and there is no
constraint to add — which is fine, and is worth stating in the migration so the next reader does not
"fix" it.

## Add a value to an enum type

```sql
ALTER TYPE order_status ADD VALUE 'refunded';
```

Historically this could not run in a transaction, and a great deal of advice still says so.
Flyway's parser encodes the real rule: `^ALTER TYPE( .*)? ADD VALUE` is non-transactional **only
when the server is below version 12**. On PostgreSQL 18 it is transactional like anything else.

⚠️ The deployment concern is the other direction: **adding an enum value is expand, and removing one
is not possible at all.** PostgreSQL has no `DROP VALUE`. An enum that changes is an argument for a
lookup table instead — a decision to make before the first migration, not after.

## Gotchas

**★ `CREATE INDEX` without `CONCURRENTLY` locks the table against writes.** On a busy table that is
an outage, not a slow migration — reads continue, every write waits for the build.

**★ `CREATE INDEX CONCURRENTLY` cannot run inside a transaction**, so Flyway detects it and runs
that migration non-transactionally. That is the one case where a failure leaves both a
`success = false` history row **and** half-applied DDL.

**★ A failed `CREATE INDEX CONCURRENTLY` leaves an `INVALID` index behind**, and it still costs
maintenance on every write while it sits there. Drop it or `REINDEX INDEX CONCURRENTLY` — do not
simply re-run the migration, because the name is already taken.

**★ `CONCURRENTLY` is not free, it is *deferred*.** Two table scans instead of one, and a wait for
every transaction open when it starts. A long-running transaction elsewhere stalls the build
indefinitely without any error to look at.

**★ Put a concurrent index alone in its own migration file.** Mixing it with transactional
statements forces `mixed: true` or produces a migration that half-applied — and the half that
applied is the part Flyway will not re-run.

**★ `ADD CONSTRAINT … USING INDEX` refuses expression and partial indexes**, and requires a b-tree
with default sort ordering. A unique index on `lower(email)` can never be promoted to a constraint,
so the index itself has to be the enforcement — say so in the migration, or somebody later "fixes"
it.

**★ The unique-constraint recipe is two migrations, not one.** The `CREATE UNIQUE INDEX
CONCURRENTLY` has to be committed and non-transactional before the `ALTER TABLE … USING INDEX` that
promotes it can see it.

**★ `ALTER TYPE … ADD VALUE` is transactional from PostgreSQL 12 onward** — Flyway's own parser only
treats it as non-transactional below 12. Advice saying otherwise is describing a server that is
years out of support.

**★ You cannot remove an enum value, ever.** There is no `DROP VALUE`. The set only grows, so an
enum whose membership is expected to change should have been a lookup table from the first
migration.

**★ A new enum value that old code does not know about is still an expand/contract problem.** The
value can be added safely; what is not safe is *writing* it while a previous deployment is still
running a `switch` that has no branch for it. That is [08](08-migrating-a-live-service.md)'s rule
applied to a type rather than a column.

## Interview questions

**★ How do you add an index to a busy table?**
`CREATE INDEX CONCURRENTLY`, alone in its own migration file. A plain `CREATE INDEX` locks the table
against writes for the whole duration of the build, which on a large table is an outage.

**★ What does `CONCURRENTLY` actually cost you?**
Two table scans instead of one, a wait for every transaction that was open when it started, the
inability to run inside a transaction — and a failure mode where an `INVALID` index is left behind
that must be dropped or reindexed before you can retry.

**★ Why does `CREATE INDEX CONCURRENTLY` collide with Flyway specifically?**
Flyway runs each migration in a transaction wherever the database allows it. This statement does
not allow it, so Flyway's PostgreSQL parser marks the migration non-transactional. The consequence
is that a failure cannot be rolled back: you get a `success = false` row *and* real wreckage to
clean up by hand.

**★ You re-run a failed concurrent-index migration and it fails again immediately. Why?**
The failed build left an invalid index with the same name. The retry collides with it. Drop the
invalid index (or `REINDEX INDEX CONCURRENTLY`) first, then re-run.

**★ How do you add a unique constraint safely?**
Build the index first with `CREATE UNIQUE INDEX CONCURRENTLY` in its own non-transactional
migration, then promote it in a second migration with `ALTER TABLE … ADD CONSTRAINT … UNIQUE USING
INDEX`. The promotion is instant because the index already exists.

**★ When can you not use `USING INDEX`?**
When the index has expression columns, is partial, or is not a b-tree with default sort ordering.
For a unique index on `lower(email)` there is no constraint to add at all — the index is the
enforcement, and that is a legitimate end state rather than a missing step.

**★ Can `ALTER TYPE … ADD VALUE` run inside a transaction?**
On PostgreSQL 12 and later, yes. Flyway's parser only marks it non-transactional below 12. The
widespread advice to the contrary describes servers that are now well out of support.

**★ Why is an enum a deployment risk even though adding values is easy?**
Because the operation is one-way — there is no `DROP VALUE` — and because writing a new value is
only safe once every running instance can read it. Adding is expand; starting to write it is a
second deployment.

{/* FOOTER */}
