---
title: "Once the wait is bounded you get to choose what happens when it expires, and the two useful answers are to take the lock explicitly at the top of the transaction or to retry in a subtransaction that gives its locks back on every failed attempt"
sidebar_label: "08b3 · Retrying a blocked migration"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)),
> `LOCK` ([postgresql.org](https://www.postgresql.org/docs/18/sql-lock.html)),
> PL/pgSQL *Transaction Management*
> ([postgresql.org](https://www.postgresql.org/docs/18/plpgsql-transactions.html)),
> Flyway 12's `DbMigrate` and `RetryStrategy`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/flyway-core/src/main/java/org/flywaydb/core/internal))
> and Flyway's *Migration Transaction Handling* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[08b2](08b2-seeing-it-and-bounding-it.md) put a bound on the wait. A bound turns a silent outage
into a failed deployment, which is a strict improvement — but on a table that is never truly idle,
"failed deployment" every time is not a working process either. This chunk is the two patterns that
get you a deployment that succeeds without ever holding the table hostage: acquiring the lock
explicitly and once, and retrying in a subtransaction. It also explains the two things a retry
cannot do, one of which is the reason backfills need a different shape entirely.**

## Take the lock once, at the top

`lock_timeout` has an awkward property that [08b2](08b2-seeing-it-and-bounding-it.md) flagged: *"The
time limit applies separately to each lock acquisition attempt."* A migration file with five
`ALTER TABLE` statements against the same table therefore has five independent waits, and its
worst-case exposure is five times the number you configured.

`LOCK TABLE` collapses that into one:

```sql
-- V44__Restructure_orders.sql
SET LOCAL lock_timeout = '3s';
LOCK TABLE orders IN ACCESS EXCLUSIVE MODE;

ALTER TABLE orders ADD COLUMN region text;
ALTER TABLE orders ADD COLUMN region_set_at timestamptz;
ALTER TABLE orders ALTER COLUMN legacy_code DROP NOT NULL;
```

> *"`LOCK TABLE` obtains a table-level lock, waiting if necessary for any conflicting locks to be
> released. … Once obtained, the lock is held for the remainder of the current transaction. (There
> is no `UNLOCK TABLE` command; locks are always released at transaction end.)"*

The three `ALTER TABLE` statements that follow already hold the strongest lock, so none of them
waits. Either the migration gets `orders` within three seconds or it fails within three seconds.
That is a much easier property to reason about than "somewhere between zero and fifteen seconds
depending on the interleaving".

There is a second reason to do this, and the documentation states it as deadlock advice:

> *"One should also ensure that the first lock acquired on an object in a transaction is the most
> restrictive mode that will be needed for that object."*

🔴 That is a direct warning about a shape people write constantly: a migration that `SELECT`s from a
table to decide what to do, and then `ALTER`s it. The `SELECT` takes `ACCESS SHARE`; the `ALTER`
then tries to *upgrade* to `ACCESS EXCLUSIVE` while another session may be doing the same thing in
the other order. `LOCK TABLE` at the top removes the upgrade.

⚠️ **`NOWAIT` is the fail-instantly variant**, when even three seconds of exposure is too much:

> *"Specifies that `LOCK TABLE` should not wait for any conflicting locks to be released: if the
> specified lock(s) cannot be acquired immediately without waiting, the transaction is aborted."*

`NOWAIT` and `lock_timeout` are alternatives, not partners — `NOWAIT` never waits at all, so the
timeout has nothing to measure.

## Retrying in a subtransaction

Retrying is safe for a specific documented reason:

> *"Once acquired, a lock is normally held until the end of the transaction. But if a lock is
> acquired after establishing a savepoint, the lock is released immediately if the savepoint is
> rolled back to. … The same holds for locks acquired within a PL/pgSQL exception block: an error
> escape from the block releases locks acquired within it."*

A PL/pgSQL block with an exception handler *is* a subtransaction, so a failed attempt returns
whatever it managed to take instead of accumulating locks across attempts:

```sql
-- V44__Restructure_orders.sql
DO $$
DECLARE
    attempts int := 0;
BEGIN
    LOOP
        BEGIN
            SET LOCAL lock_timeout = '2s';
            LOCK TABLE orders IN ACCESS EXCLUSIVE MODE;

            ALTER TABLE orders ADD COLUMN region text;
            ALTER TABLE orders ADD COLUMN region_set_at timestamptz;
            RETURN;
        EXCEPTION WHEN lock_not_available THEN
            attempts := attempts + 1;
            IF attempts >= 10 THEN
                RAISE;
            END IF;
            PERFORM pg_sleep(3 + random() * 2);
        END;
    END LOOP;
END $$;
```

`lock_not_available` is the condition `lock_timeout` and `NOWAIT` both raise. Ten attempts of two
seconds with three-to-five-second gaps is under a minute of trying, during which the table is never
blocked for more than two seconds at a stretch — and if it never wins it re-raises, and the
deployment fails cleanly with the original error.

The `random()` in the sleep is not decoration. A fixed interval can phase-lock with a periodic job:
if the blocker is a cron report that runs every five seconds, a five-second retry can miss the gap
every single time.

⚠️ **`RETURN` is what exits the loop.** Without it the successful branch falls through to the next
iteration and the DDL runs again. For `ADD COLUMN` that is an immediate error, so you will find out;
for an idempotent statement it is an infinite loop inside a migration holding `ACCESS EXCLUSIVE`,
which is the worst outcome on this page.

## The two things a retry cannot do

**It cannot commit.** The documentation is explicit:

> *"PL/pgSQL does not support savepoints … Typical usage patterns for savepoints can be replaced by
> blocks with exception handlers … Under the hood, a block with exception handlers forms a
> subtransaction, which means that transactions cannot be ended inside such a block."*

So the exception-handler retry and the batched backfill are mutually exclusive designs. A backfill
needs a commit between batches so the row locks and the dead tuples are released as it goes;
[10b](10b-batching-a-backfill.md) uses a procedure with `executeInTransaction` turned off instead,
and gets no exception-handler retries in exchange.

**It cannot help a statement that is slow once it holds the lock.** Retrying bounds contention, not
work. `ALTER COLUMN … TYPE` rewrites the table after it wins the lock, and it holds
`ACCESS EXCLUSIVE` for the whole rewrite. No amount of retrying changes that;
[08b4](08b4-how-long-is-too-long.md) is where that problem lives.

## Retrying at the deployment level instead

There is a reason you often do not need any of this on PostgreSQL. When the migration transaction
rolls back, Flyway writes nothing at all — `DbMigrate` takes the rollback branch when the database
supports DDL transactions, and only writes a `success = false` row in the non-transactional case
([03b · When a migration fails](03b-when-a-migration-fails.md)). Flyway's own documentation puts it
plainly:

> *"failed migrations will always be rolled back (unless they were marked as non-transactional)"*

So a lock-timeout failure leaves the migration `Pending`, and simply running the deployment again
runs it again. Pipeline-level retry is free and correct — **provided the migration was
transactional.** A `CREATE INDEX CONCURRENTLY` migration
([08a2](08a2-adding-indexes-and-enum-values.md)) is not, and re-running it collides with the
`INVALID` index the failed attempt left behind.

🔴 What makes this decision *not* free is the other lock. While your `DO` block sits there retrying,
the Flyway run that owns it is still holding Flyway's advisory lock, and every other instance
starting up is burning its own `lockRetryCount` budget waiting for it —
[09 · Many instances, one database](09-many-instances-one-database.md). A migration that retries for
fifty seconds consumes the *entire* default retry budget of every other pod in the rollout.

## Gotchas

**★ `lock_timeout` is per acquisition attempt, so a multi-statement migration multiplies it.** Five
`ALTER TABLE` statements against one table is five independent waits. `LOCK TABLE` at the top of the
transaction collapses them into one bounded wait.

**★ A migration that reads a table and then alters it performs a lock upgrade.** `ACCESS SHARE`
followed by `ACCESS EXCLUSIVE` on the same object is exactly the shape the documentation warns
about: *"the first lock acquired on an object in a transaction is the most restrictive mode that
will be needed."* Take the strong lock first.

**★ `NOWAIT` and `lock_timeout` do not combine.** `NOWAIT` aborts the moment the lock is
unavailable, so the timeout never gets to run. Pick one: instant failure, or a bounded wait.

**★ The retry handler must name `lock_not_available`.** A handler on `others` will retry a syntax
error ten times, sleep for forty seconds doing it, and then report the wrong cause at the wrong
time.

**★ The retry loop cannot commit.** A block with exception handlers is a subtransaction and
transaction control is forbidden inside one. Any migration that needs both retries and intermediate
commits is really two migrations.

**★ A missing `RETURN` turns the success path into an infinite loop** — while holding
`ACCESS EXCLUSIVE`. This is the one bug on the page that is worse than the problem it was written to
solve.

**★ A fixed retry interval can phase-lock with the blocker.** If the thing holding the lock runs on
a schedule, a retry on the same period can miss the window every time. Add jitter.

**★ Retrying inside the migration spends every other instance's Flyway lock budget.** Flyway's
default `lockRetryCount` is 50 with a fixed one-second wait, so roughly fifty seconds. A migration
that retries for fifty seconds leaves the rest of the fleet with nothing
([09](09-many-instances-one-database.md)).

**★ On PostgreSQL, a failed transactional migration is safe to re-run and leaves no trace.** That
makes pipeline-level retry a legitimate strategy and often the simplest one. It stops being true the
moment `executeInTransaction: false` or `mixed: true` appears in the migration.

**★ A retry loop hides a systemic problem.** If a migration needs eight attempts every deployment,
the answer is not twelve attempts — it is that something holds long transactions on that table, and
that is going to hurt you in ways that have nothing to do with migrations.

**★ `LOCK TABLE` requires privileges.** The documentation ties the mode to the grant: `ACCESS
EXCLUSIVE` needs `MAINTAIN`, `UPDATE`, `DELETE` or `TRUNCATE` on the table. A migration user with
only DDL ownership normally has this; a deliberately restricted migration role may not, and it fails
at `LOCK`, not at `ALTER`.

**★ The explicit `LOCK TABLE` does not cover tables you did not name.** A foreign key locks the
referenced table too, and that acquisition is a separate attempt with its own timeout. Lock both
sides, or accept the second wait.

## Interview questions

**★ Why acquire the lock explicitly with `LOCK TABLE` when `ALTER TABLE` would acquire it anyway?**
Two reasons. First, `lock_timeout` applies separately to each acquisition attempt, so a file with
several statements against one table has several independent waits; one `LOCK TABLE` at the top
collapses that into a single bounded wait, after which nothing else in the transaction can queue.
Second, it prevents lock upgrades — the documentation advises taking the most restrictive mode you
will need on an object first, and a migration that reads a table before altering it violates that.

**★ How would you make a migration retry instead of fail when it cannot get its lock?**
Wrap the DDL in a PL/pgSQL block with an exception handler for `lock_not_available`, set a short
`SET LOCAL lock_timeout` inside it, and loop with a jittered `pg_sleep` between attempts, bounded by
a counter that re-raises. It is safe because a block with an exception handler is a subtransaction,
and PostgreSQL documents that locks acquired inside it are released when an error escapes the block,
so failed attempts do not accumulate locks.

**★ What can that retry loop *not* do, and why does it matter?**
It cannot commit — a block with exception handlers forms a subtransaction and transactions cannot be
ended inside one. It matters because a batched data backfill needs a commit between batches to
release row locks and let vacuum reclaim dead tuples, so backfills cannot use this pattern and need
a procedure with `executeInTransaction: false` instead.

**★ Is it better to retry inside the migration or to retry the deployment?**
On PostgreSQL, retrying the deployment is usually simpler and equally correct, because a failed
transactional migration rolls back completely and Flyway writes no history row, so the migration is
still `Pending` and the next run picks it up. Retrying inside the migration is worth it when the
window of opportunity is short and frequent — but it costs you Flyway's advisory lock for the whole
retry period, which every other instance in the rollout is waiting on.

**★ When is re-running a failed migration *not* safe?**
When it was not transactional. `CREATE INDEX CONCURRENTLY` cannot run in a transaction, so Flyway
runs that migration outside one, records a `success = false` row and leaves the half-built
`INVALID` index behind. Re-running collides with the index name. That case needs manual cleanup and
`repair`, not a pipeline retry.

**★ Why put jitter in the sleep?**
Because the thing holding the lock is often periodic. A retry interval that matches or divides the
blocker's period can land in the same busy window on every attempt and never see the gap. Randomised
backoff decorrelates the two.

**★ What does `NOWAIT` buy you over a short `lock_timeout`?**
Certainty that you contributed zero waiting time. `NOWAIT` aborts the transaction the instant the
lock is unavailable, so the table is never blocked by your attempt at all. The cost is that you fail
on the smallest contention, which on a busy table means you fail almost always — so it suits a
retry loop with many attempts rather than a single-shot migration.

**★ A migration needs eight retries in every environment. What does that tell you?**
That the table is under a sustained long-transaction load, and migrations are only where you noticed
it. The same long transactions are preventing vacuum from reclaiming dead tuples and are one
coincidence away from a lock-queue outage that has nothing to do with a deployment. Raising the
retry count treats the symptom.

{/* FOOTER */}
