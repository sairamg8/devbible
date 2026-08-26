---
title: "on PostgreSQL a failed migration usually leaves nothing behind at all — no schema change and no history row — and the cases where it does leave a row are exactly the cases where the migration could not run inside a transaction"
sidebar_label: "03b · When a migration fails"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `DbMigrate` and `PostgreSQLParser` source
> ([DbMigrate.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/command/DbMigrate.java),
> [PostgreSQLParser.java](https://github.com/flyway/flyway/blob/main/flyway-database/flyway-database-postgresql/src/main/java/org/flywaydb/database/postgresql/PostgreSQLParser.java)),
> the *Migration transaction handling* concept page
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)),
> the *Execute In Transaction*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-execute-in-transaction-setting-277578997.html)),
> *Mixed* and *Group* settings, and PostgreSQL 18's `CREATE INDEX`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-createindex.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**PostgreSQL runs DDL inside transactions, and Flyway writes the history row inside the same
transaction as the migration that earned it. So a failed migration on PostgreSQL is normally a
non-event in the database: the `CREATE TABLE` is gone, the row is gone, and the schema is exactly
where it was. The migration that leaves wreckage is the one that could not be in a transaction —
and Flyway decides that for you, from the statements you wrote, whether or not you noticed.**

## The two paths, from the source

`DbMigrate` branches once, immediately after catching a migration failure:

- If the database **supports DDL transactions** and the migration was **executed in one**, Flyway
  reports that the changes were rolled back and writes **no history row at all**.
- Otherwise it inserts a history row with `success = false`, and logs that you should restore
  backups and roll back the database and the code.

That is the whole decision. There is no third case, and no configuration that makes a rolled-back
migration leave a `success = false` row behind.

| The migration ran… | The schema after a failure | The history table after a failure |
|---|---|---|
| in a transaction (the default on PostgreSQL) | untouched | no row |
| outside a transaction | partially changed, by hand | one row, `success = false` |

⚠️ **This is why "the migration failed but there is no row for it" is the *good* outcome.** People
go looking for the failed row, find nothing, and conclude that Flyway never got as far as running
it. It ran, it failed, and it undid itself. The absence of the row is the proof that the rollback
worked.

## When PostgreSQL cannot be in a transaction, and who decides

Flyway's PostgreSQL parser inspects each statement and marks it non-transactional when it matches
one of a short, fixed list. From `PostgreSQLParser`:

| Pattern | Statements it covers |
|---|---|
| `^(CREATE\|DROP) (DATABASE\|TABLESPACE\|SUBSCRIPTION)` | creating or dropping a database, tablespace or subscription |
| `^ALTER SYSTEM` | server configuration changes |
| `^(CREATE\|DROP)( UNIQUE)? INDEX CONCURRENTLY` | the one everybody meets |
| `^REINDEX( VERBOSE)? (SCHEMA\|DATABASE\|SYSTEM)` | wide reindexes |
| `^VACUUM` | any form of `VACUUM` |
| `^DISCARD ALL` | session reset |

There is a seventh — `^ALTER TYPE( .*)? ADD VALUE` — but Flyway applies it **only when the server
version is below 12**. On PostgreSQL 18, adding a value to an enum is transactional and Flyway
treats it as such.

**You do not opt into this detection and you cannot easily opt out of it.** Writing
`CREATE INDEX CONCURRENTLY` in a migration silently changes that migration's failure semantics
from "rolled back cleanly" to "left half-done with a `success = false` row" — which is the correct
behaviour and is also exactly why concurrent index builds get their own treatment in
[08b · Locks and long migrations](08b-locks-and-long-migrations.md).

## The three ways a migration ends up non-transactional

**One statement Flyway detects.** As above. The migration becomes non-transactional because it has
to.

**`execute-in-transaction: false`**, globally or per script. The Flyway reference describes it as
*"Whether Flyway should execute SQL within a transaction"*, default `true`, and notes it *"can be
set from Script Configuration in addition to project configuration"* — meaning a `.conf` file
named after one migration can turn transactions off for that migration alone, which is almost
always what you want rather than turning them off for everything.

```
# db/migration/V12__create_index_concurrently.sql.conf
executeInTransaction=false
```

**`mixed: true`.** *"Whether to allow mixing transactional and non-transactional statements within
the same migration. Enabling this automatically causes the entire affected migration to be run
without a transaction."* Note what that costs: it does not run the transactional statements in a
transaction and the others outside one. It gives up the transaction for the **whole migration**.

⚠️ **`mixed: true` is a bigger concession than it reads as.** A migration with nine safe DDL
statements and one `CREATE INDEX CONCURRENTLY` runs all ten without a transaction, so a failure in
statement nine leaves eight applied. The alternative — splitting the concurrent index into its own
migration — costs one extra file and keeps nine statements atomic.

## `group` moves the boundary outwards

`group: true` *"group[s] all pending migrations together in the same transaction when applying
them (only recommended for databases with support for DDL transactions)"*. With it on, `DbMigrate`
takes the lock and starts the transaction before the first migration, so a failure in the fifth
pending migration rolls back the first four as well — **including their history rows**.

Two notes the reference gives that matter more than the feature does:

- *"If `executeInTransaction` is set to false, this parameter will have no impact."*
- *"This parameter does not apply to callbacks, which can't be included in the same transaction."*

And `DbMigrate` warns explicitly when `group` is enabled on a database without DDL transactions,
because there the setting promises something the database cannot deliver.

**On PostgreSQL, `group: true` is a defensible default for a service that deploys several
migrations at once** — it makes a deployment atomic in the schema, rather than each migration
being atomic separately. It is defensible and not automatic, because one long-running statement
now holds every lock the earlier migrations took, for the length of the whole run.

## What a `success = false` row does next

It stops everything. `DbMigrate` checks for failed migrations *before* it applies anything, and
throws with a message naming the version — the schema *"contains a failed migration to version"*.
Not "skips it", not "retries it": the next deployment does not start.

That is deliberate and it is right. Flyway knows the migration ran outside a transaction, so it
knows some unknown prefix of the statements took effect. Continuing would apply `V13` to a schema
that is neither at `V12` nor at `V11`.

Recovery is a fixed sequence and there is no shortcut in it:

1. **Read the migration** and work out how far it got. This is manual and it is why
   non-transactional migrations should contain as few statements as possible.
2. **Undo the part that applied**, by hand, or make it idempotent so re-running is safe.
3. **`repair`**, which *"remove[s] any failed migrations"* — with the documentation's own caveat,
   *"User objects left behind must still be cleaned up manually."*
4. **Deploy again.**

Step 3 without step 2 is how a database ends up with an invalid index nobody remembers creating —
[04b · Repair](04b-repair-and-when-it-is-legitimate.md) sets out what `repair` does and does not
touch.

## The one failure Flyway will tolerate

`ignore-migration-patterns` defaults to `["*:future"]` in Spring Boot, and a *future* migration is
one that is in the history table with a version higher than anything resolvable locally — usually
a rolled-back deployment whose migrations went with it.

`DbMigrate` has a matching special case: a single failed migration in the `FUTURE_FAILED` state,
with `future` ignored, is downgraded from an exception to a warning. So a database that failed
halfway through a *newer* release than the one you are deploying will let the older release
proceed.

⚠️ **That tolerance is narrow and worth knowing precisely.** It applies to exactly one failed
migration, in exactly the future state. Two failures, or one ordinary failure, still stop the
deployment.

## Gotchas

**★ A failed transactional migration leaves no evidence in the history table.** The rollback is
complete, including the row. If you need to know that it happened, the deployment logs are the
only record.

**★ `CREATE INDEX CONCURRENTLY` changes a migration's failure semantics without you asking.**
Flyway's parser detects it and runs the migration outside a transaction, so a failure now leaves
partial DDL and a `success = false` row.

**★ PostgreSQL leaves an invalid index behind when a concurrent build fails.** The docs are
explicit that a failed `CREATE INDEX CONCURRENTLY` will *"leave behind an 'invalid' index"*.
Repairing the history row does not drop it; only `DROP INDEX` or
`REINDEX INDEX CONCURRENTLY` does.

**★ `mixed: true` gives up the transaction for the whole migration, not for the offending
statement.** Nine atomic statements become nine non-atomic ones because of the tenth.

**★ `execute-in-transaction: false` set globally is almost always a mistake.** It turns every
migration in the project non-transactional to accommodate one. The per-script `.conf` file exists
precisely so you do not have to.

**★ `group: true` has no effect when `execute-in-transaction` is `false`.** The reference says so
directly, and the combination reads as if it should be the safest of all.

**★ `group: true` makes one slow migration hold every earlier migration's locks.** Atomicity
across a deployment is bought with a longer lock window, which on a live service is the more
dangerous of the two.

**★ A `success = false` row blocks migrations that have nothing to do with it.** It is a global
stop, not a per-version one.

**★ `repair` clears the row but never the wreckage.** *"User objects left behind must still be
cleaned up manually"* is the sentence people skip, and it is the whole difficulty of recovering
from a non-transactional failure.

**★ The `future` tolerance covers one failed migration, not a general "ignore failures".** It is
also the default, so a database can be carrying a failed future migration while every deployment
reports success.

**★ `ALTER TYPE ... ADD VALUE` is transactional on PostgreSQL 18 and was not before 12.** Advice
found online about enum values needing a non-transactional migration is version-specific and now
usually wrong.

**★ Nothing here applies to a database without DDL transactions.** On MySQL or Oracle every failed
migration leaves partial DDL and a `success = false` row, which is why so much Flyway folklore
assumes a manual cleanup step that PostgreSQL users never need.

## Interview questions

**★ A migration failed on PostgreSQL and there is no row in `flyway_schema_history`. What
happened?**
It ran inside a transaction, failed, and the transaction rolled back — taking both the schema
changes and the history row with it. That is the intended outcome; the absence of a row is
evidence the rollback worked, not evidence that the migration never ran.

**★ When *does* Flyway write a `success = false` row?**
Only when the migration could not be executed in a transaction: the database does not support DDL
transactions, or `execute-in-transaction` was false, or `mixed` was on, or Flyway's parser detected
a statement that PostgreSQL refuses to run in a transaction block.

**★ Which PostgreSQL statements does Flyway treat as non-transactional?**
`CREATE`/`DROP` of a `DATABASE`, `TABLESPACE` or `SUBSCRIPTION`; `ALTER SYSTEM`;
`CREATE`/`DROP INDEX CONCURRENTLY`; wide `REINDEX`; `VACUUM`; `DISCARD ALL`. Plus
`ALTER TYPE ... ADD VALUE`, but only on servers older than PostgreSQL 12.

**★ What does a failed migration do to the next deployment?**
It stops it before anything is applied. `migrate` reports that the schema contains a failed
migration to a specific version and refuses to continue, because it cannot know how much of that
migration took effect.

**★ How do you recover from a failed non-transactional migration?**
Read the migration, determine how far it got, undo the applied part by hand or make it idempotent,
run `repair` to clear the failed row, then deploy again. `repair` does not clean up objects the
migration created — the documentation says so explicitly.

**★ What does `mixed: true` actually do, and what is the alternative?**
It allows transactional and non-transactional statements in one migration by running the entire
migration without a transaction. The alternative, which is nearly always better, is to move the
non-transactional statement into its own migration and leave everything else atomic.

**★ Would you turn `group` on?**
On PostgreSQL, often yes: it makes a whole deployment's worth of migrations atomic rather than
each one atomic separately, which is what you actually want when a release ships four related
changes. The cost is that the first migration's locks are held until the last one finishes, so on
a busy table it is the wrong trade.

**★ Why does `group` have no effect when `execute-in-transaction` is false?**
Because `group` widens a transaction boundary that no longer exists. The reference states it
plainly, and the combination is easy to configure by accident when someone disables transactions
globally to work around one migration.

**★ What is a "future" migration and why is it ignored by default?**
It is a row in the history table whose version is higher than any migration resolvable locally —
typically the residue of a rolled-back release. Boot defaults `ignore-migration-patterns` to
`*:future` so that redeploying the previous version still works. Flyway extends the same tolerance
to exactly one *failed* future migration, downgrading it to a warning.

**★ Your migration created an index concurrently and failed. What is left in the database?**
An invalid index, which PostgreSQL will not use and will not automatically remove, plus a
`success = false` row. Both have to be dealt with: drop or reindex the index, then `repair`.

**★ Should `execute-in-transaction: false` ever be set globally?**
No. It is a per-script setting for a reason — a `.conf` file alongside the one migration that
needs it. Setting it globally quietly removes the safety net from every other migration in the
project.

{/* FOOTER */}
