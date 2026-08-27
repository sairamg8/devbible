---
title: "A backfill has to commit between batches, PostgreSQL forbids COMMIT inside a transaction block, and Flyway puts every migration in one — so the whole technique rests on one line in a .conf file next to the migration"
sidebar_label: "10b · Batching a backfill"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's PL/pgSQL *Transaction Management*
> ([postgresql.org](https://www.postgresql.org/docs/18/plpgsql-transactions.html)),
> `CALL` ([postgresql.org](https://www.postgresql.org/docs/18/sql-call.html)),
> *Client Connection Defaults*
> ([postgresql.org](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> `SELECT` ([postgresql.org](https://www.postgresql.org/docs/18/sql-select.html)),
> Flyway 12's *Script Configuration* and `executeInTransaction` reference
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/documentation/Reference))
> and Flyway's *Migration Transaction Handling*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[10](10-data-migrations.md) argued that a single large `UPDATE` is a bad idea: it doubles the
table, holds a row lock per row, blocks the vacuum that would clean up behind it and loses all its
work on failure. The fix is to commit every few thousand rows. Doing that inside a Flyway migration
requires defeating the one guarantee Flyway works hardest to give you, and the mechanics are exact —
there is a specific reason `COMMIT` fails, a specific file that fixes it, and a specific set of
things you give up in exchange. Making each batch actually cheap is
[10b2](10b2-keeping-each-batch-cheap.md).**

## Why `COMMIT` fails, precisely

PL/pgSQL can end transactions:

> *"In procedures invoked by the `CALL` command as well as in anonymous code blocks (`DO` command),
> it is possible to end transactions using the commands `COMMIT` and `ROLLBACK`. A new transaction is
> started automatically after a transaction is ended using these commands, so there is no separate
> `START TRANSACTION` command."*

But only from the top level:

> *"If `CALL` is executed in a transaction block, then the called procedure cannot execute
> transaction control statements. Transaction control statements are only allowed if `CALL` is
> executed in its own transaction."*

Flyway, by default, executes every migration in a transaction — `executeInTransaction` defaults to
`true`, and on PostgreSQL that is what buys you *"failed migrations will always be rolled back"*. So
your `DO $$ … COMMIT … $$` is inside a transaction block, and it is rejected. This is not a Flyway
bug and it is not something you can work around inside the SQL.

## The one line that fixes it

Flyway's per-script configuration is a sibling file:

> *"This is achieved by creating a script configuration file in the same folder as the migration. The
> script configuration file name must match the migration file name, with the `.conf` suffix added.
> … For example, a migration file `V2__my_script.sql` would have a script configuration file
> `V2__my_script.sql.conf`."*

`executeInTransaction` is listed there as an override of the global setting, tier **Community**. So:

```
db/migration/
  V44__Backfill_customer_region.sql
  V44__Backfill_customer_region.sql.conf
```

```properties
# V44__Backfill_customer_region.sql.conf
executeInTransaction=false
```

That is the whole mechanism. The migration now runs outside a transaction, the `DO` block is at the
top level, and `COMMIT` works.

🔴 **What you gave up is the rollback.** Flyway is explicit that the automatic rollback applies
*"unless they were marked as non-transactional"*, and `DbMigrate` takes the other branch: on failure
it writes a `success = false` history row and logs *"Please restore backups and roll back database
and code!"*. Everything in [03b · When a migration fails](03b-when-a-migration-fails.md) now applies
to this migration, and `repair` becomes part of the recovery path
([04d](04d-what-repair-actually-does.md), [04e](04e-when-repair-is-the-right-answer.md)).

## The loop

```sql
-- V44__Backfill_customer_region.sql
SET statement_timeout = 0;

DO $$
DECLARE
    batch  constant int := 5000;
    done   int;
BEGIN
    LOOP
        UPDATE customers c
        SET    region = 'unknown'
        WHERE  c.id IN (
                   SELECT id
                   FROM   customers
                   WHERE  region IS NULL
                   ORDER  BY id
                   LIMIT  batch
                   FOR UPDATE
               );

        GET DIAGNOSTICS done = ROW_COUNT;
        EXIT WHEN done = 0;

        COMMIT;
        PERFORM pg_sleep(0.05);
    END LOOP;
END $$;

RESET statement_timeout;
```

Four things in there are load-bearing.

**`WHERE region IS NULL` is the resumability contract.** Every batch re-derives what is left to do
from the data itself. Kill the migration at any point and re-running it continues rather than
restarts — which matters enormously, because a non-transactional migration that fails halfway
*has* left rows behind.

**`FOR UPDATE` locks the batch's rows before updating them**, so two concurrent runs of this
migration cannot pick the same rows. That should not happen — Flyway's advisory lock serialises
runs ([09](09-many-instances-one-database.md)) — but it costs nothing and the migration may also be
run by hand.

**`COMMIT` after each batch** releases those row locks, ends the transaction that was blocking
vacuum, and makes the progress durable.

**`pg_sleep` between batches** hands time back to autovacuum, to replicas replaying your WAL, and to
the application. It is the difference between a backfill and a self-inflicted incident.

## `statement_timeout` is the trap in this design

The whole `DO $$ … $$` is **one command**, and the documentation defines the timeout accordingly:

> *"The timeout is measured from the time a command arrives at the server until it is completed by
> the server."*

So a non-zero `statement_timeout` kills the entire backfill regardless of how often it commits. The
commits do not reset it, because the commits are not the boundary it measures. `SET statement_timeout
= 0` at the top of the file is the fix — and it must be a plain `SET`, because there is no
transaction for `SET LOCAL` to be local to, which in turn means the `RESET` at the bottom is
mandatory or the setting leaks into the connection pool
([02 · 7b](../02-connection-pooling/07b-what-sql-leaves-behind.md)).

⚠️ **The same reasoning applies to `transaction_timeout`.** Each committed batch is its own short
transaction, so `transaction_timeout` is measured per batch and is generally harmless here — but it
is worth checking rather than assuming, because *"If `transaction_timeout` is shorter or equal to
`idle_in_transaction_session_timeout` or `statement_timeout` then the longer timeout is ignored."*

## Gotchas

**★ `COMMIT` inside a Flyway migration fails until you set `executeInTransaction=false`.** The error
is about transaction control in a transaction block and says nothing about Flyway, which makes it
one of the more confusing first encounters in this topic.

**★ The `.conf` file must match the migration filename exactly, with `.conf` appended.** A typo
produces no error and no effect: the file is simply not a script configuration for anything, the
migration runs in a transaction, and the `COMMIT` fails. Nothing tells you the `.conf` was ignored.

**★ Turning off the transaction turns on every failure mode in [03b](03b-when-a-migration-fails.md).**
A failed batch leaves a `success = false` row *and* real, committed, partial data. The next `migrate`
refuses to run until you `repair`.

**★ Partial data is fine only because the migration is resumable.** `WHERE region IS NULL` is what
makes "half done" a legitimate state. Write a backfill without a predicate that excludes finished
rows and the non-transactional failure mode becomes genuinely dangerous.

**★ A non-zero `statement_timeout` kills the whole `DO` block, commits notwithstanding.** The timeout
measures one command from arrival to completion, and the entire anonymous block is one command.

**★ `SET statement_timeout = 0` here has to be a plain `SET`, so it leaks.** There is no transaction
for `SET LOCAL`, and Flyway does not reset the session. The `RESET` at the end of the file is not
optional.

**★ You cannot wrap the loop in an exception handler.** *"a block with exception handlers forms a
subtransaction, which means that transactions cannot be ended inside such a block."* Retrying and
committing are mutually exclusive in PL/pgSQL — which is the same constraint
[08b3](08b3-retrying-a-blocked-migration.md) hit from the other direction.

**★ Transaction control only works from the top level.** *"Transaction control is only possible in
`CALL` or `DO` invocations from the top level or nested `CALL` or `DO` invocations without any other
intervening command."* Refactoring the loop into a `SELECT my_backfill()` helper silently breaks it,
because a `SELECT` in the call stack disqualifies everything below it.

**★ `COMMIT` is also forbidden inside a cursor loop over a writing statement.** *"Transaction
commands are not allowed in cursor loops driven by commands that are not read-only (for example
`UPDATE … RETURNING`)."* The `LIMIT`-and-`COMMIT` shape above exists partly to avoid that.

**★ A backfill in the deployment path is still a backfill in the deployment path.** All of this makes
the migration survivable; none of it makes it fast, and none of it makes each batch cheap — that is
[10b2](10b2-keeping-each-batch-cheap.md). [10c](10c-when-it-should-not-be-a-migration.md) argues
that most of these belong outside the deploy entirely.

## Interview questions

**★ Why can't you just put a `COMMIT` in a Flyway migration?**
Because Flyway executes migrations inside a transaction by default, and PostgreSQL only allows
transaction control in a `DO` block or procedure invoked at the top level — not inside a transaction
block. You have to set `executeInTransaction=false`, either globally or, better, in a `.conf` file
named after that one migration.

**★ What do you lose by setting `executeInTransaction=false`?**
The automatic rollback. Flyway's documentation says failed migrations are always rolled back *unless
they were marked as non-transactional*, and in the non-transactional path Flyway instead records a
`success = false` history row and tells you to restore backups. A failure now leaves committed
partial data, and the next `migrate` refuses to proceed until you run `repair`.

**★ If a batched backfill can fail halfway, how is that acceptable?**
Because the batches are derived from the data. Each iteration selects rows that still need the
update, so "half done" is a valid state and re-running continues from where it stopped. Resumability
is what makes the loss of atomicity tolerable; a backfill without a predicate that excludes finished
rows does not have that property and should not be run this way.

**★ You set `executeInTransaction=false` and the backfill still dies after ninety seconds. Why?**
Almost certainly `statement_timeout`. The entire `DO` block is a single command, and the timeout is
measured from when the command arrives until it completes — the internal `COMMIT`s do not reset it.
Set `statement_timeout = 0` for that migration, with a matching `RESET`, because outside a
transaction there is no `SET LOCAL` and the value would otherwise leak into the pool.

**★ Why can't the loop retry on failure?**
Because a PL/pgSQL block with an exception handler is a subtransaction, and transactions cannot be
ended inside a subtransaction. Committing and catching are mutually exclusive. If the backfill needs
both, the retry has to live outside the database — re-run the migration, which is safe precisely
because it is resumable.

{/* FOOTER */}
