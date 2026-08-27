---
title: "The ALTER TABLE that took the site down was not slow — it was blocked, and because PostgreSQL queues lock requests per object every query arriving behind it inherited the block"
sidebar_label: "08b · Locks and the queue behind them"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)),
> `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html)),
> `CREATE INDEX`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-createindex.html))
> and `pg_locks`
> ([postgresql.org](https://www.postgresql.org/docs/18/view-pg-locks.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[08a](08a-adding-things-safely.md) and [08a2](08a2-adding-indexes-and-enum-values.md) were about
statements that do too much work. This chunk is about the statement that does *no* work at all and
still takes the service down. A migration that has to wait for a lock does not merely wait: the lock
it wants conflicts with everything, so every query arriving after it also waits, and the table goes
dark for the duration. The slow migration is survivable; the blocked one is the outage.
[08b2](08b2-seeing-it-and-bounding-it.md) is how you see it coming and how you defuse it — this page
is why you have to.**

## What `ALTER TABLE` takes, and what that conflicts with

PostgreSQL states the default plainly for `ALTER TABLE`:

> *"An `ACCESS EXCLUSIVE` lock is acquired unless explicitly noted."*

The exceptions are the ones [08a](08a-adding-things-safely.md) catalogued — `ADD FOREIGN KEY` takes
`SHARE ROW EXCLUSIVE`, `VALIDATE CONSTRAINT` takes `SHARE UPDATE EXCLUSIVE` — and everything else
takes the strongest lock the system has:

> *"Conflicts with locks of all modes (`ACCESS SHARE`, `ROW SHARE`, `ROW EXCLUSIVE`, `SHARE UPDATE
> EXCLUSIVE`, `SHARE`, `SHARE ROW EXCLUSIVE`, `EXCLUSIVE`, and `ACCESS EXCLUSIVE`). This mode
> guarantees that the holder is the only transaction accessing the table in any way."*

On the other side of that conflict is every plain `SELECT` your application issues:

> *"The `SELECT` command acquires a lock of this mode on referenced tables. In general, any query
> that only reads a table and does not modify it will acquire this lock mode."*

which the documentation then summarises from the reader's point of view:

> *"Only an `ACCESS EXCLUSIVE` lock blocks a `SELECT` (without `FOR UPDATE`/`SHARE`) statement."*

Those three sentences are the whole hazard. `ACCESS EXCLUSIVE` is the *only* mode a reader cares
about, and `ALTER TABLE` takes it by default. So the review question for a migration is never "is
this statement fast" — most of them are, because `ADD COLUMN … DEFAULT 'x'` is a catalogue update
measured in microseconds. The question is **"can this statement get its lock immediately, and what
happens to everyone else for as long as it cannot."**

⚠️ The mode names mislead. `ACCESS EXCLUSIVE` is self-conflicting and conflicts with all others;
`ROW EXCLUSIVE`, despite the name, is a *shareable* table lock that ordinary `UPDATE` takes and that
many transactions hold at once. The documentation says so directly: *"The only real difference
between one lock mode and another is the set of lock modes with which each conflicts."* Do not
reason from the names — read the conflict table.

## The queue is the outage

Here is the sequence. None of the steps are exotic and every one happens weekly in a normal system.

**1. Something already holds `ACCESS SHARE` on `orders`.** A thirty-second analytics query. A
connection sitting `idle in transaction` because a service call inside a `@Transactional` method is
waiting on a socket timeout. It does not have to be doing anything at all, because locks are held to
the end of the transaction, not the end of the statement:

> *"Once acquired, a lock is normally held until the end of the transaction."*

**2. Your migration issues `ALTER TABLE orders ADD COLUMN region text`.** It requests `ACCESS
EXCLUSIVE`, which conflicts with the `ACCESS SHARE` already held, so it waits. The documentation is
explicit about how long:

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or
> row-level lock will wait indefinitely for conflicting locks to be released. This means it is a bad
> idea for applications to hold transactions open for long periods of time (e.g., while waiting for
> user input)."*

**3. 🔴 The next ordinary `SELECT … FROM orders` now waits too.** It does not slip past the waiting
`ALTER TABLE` just because its own mode is compatible with the lock currently *held*. PostgreSQL
maintains wait queues per lockable object, and the `pg_locks` documentation refers to them directly
when explaining what the view cannot show you:

> *"the `pg_locks` view does not expose information about which processes are ahead of which others
> in lock wait queues"*

The `granted` column's description says the same from the other side: a false value *"implies that
at least one other process is holding **or waiting for** a conflicting lock mode on the same
lockable object."* Another process merely *waiting* is enough to make you wait.

**4. Every subsequent query against `orders` joins that queue.** Your application does not observe a
slow table. It observes every request touching `orders` hanging, with no error, indefinitely.

**5. 🔴 Those hanging requests are each holding a pooled connection.** Within seconds the pool has
no free connection for *any* query, including queries on tables that have nothing to do with
`orders`. The failure that pages your on-call engineer is
[`Connection is not available, request timed out`](../02-connection-pooling/05-connection-is-not-available.md)
— a pool-exhaustion incident whose root cause is one `ALTER TABLE` waiting on one forgotten
reporting query, and whose alert text mentions neither.

That escalation, from "one table is blocked" to "the entire service is down", is why this deserves
its own page. The `ALTER TABLE` would have taken a millisecond. The analytics query would have
finished on its own. What took the site down is that the two of them met, and that the pool turned a
localised stall into a global one.

## Why a bigger pool makes it worse

The instinctive remedy is to raise `maximum-pool-size` so the hanging requests stop starving
everything else. It does the opposite. Every extra connection is another backend that can join the
lock queue, so a bigger pool converts a fast, obvious failure — requests rejected at the pool — into
a slower and much larger one: hundreds of server processes parked in a queue, each holding memory
and lock-table space. Both advisory and regular locks live in a fixed shared pool sized by
`max_locks_per_transaction` and `max_connections`, and the documentation warns that *"Care must be
taken not to exhaust this memory or the server will be unable to grant any locks at all."*

The pool's job during a lock storm is to be the fuse.
[02 · 02 · Why a small pool is faster](../02-connection-pooling/02-why-a-small-pool-is-faster.md)
makes the general argument; the lock queue is its sharpest instance.

## Which migrations are exposed

Not all of them. Sorting a migration by lock mode is the first review question.

| Statement | Lock | Blocks readers? |
|---|---|---|
| `ALTER TABLE … ADD COLUMN` | `ACCESS EXCLUSIVE` | yes |
| `ALTER TABLE … DROP COLUMN` | `ACCESS EXCLUSIVE` | yes |
| `ALTER TABLE … ALTER COLUMN TYPE` | `ACCESS EXCLUSIVE` | yes, *and* rewrites |
| `ALTER TABLE … ADD CONSTRAINT … CHECK` | `ACCESS EXCLUSIVE` | yes, and scans unless `NOT VALID` |
| `ALTER TABLE … ADD FOREIGN KEY` | `SHARE ROW EXCLUSIVE` | no — blocks writers |
| `ALTER TABLE … VALIDATE CONSTRAINT` | `SHARE UPDATE EXCLUSIVE` | no |
| `CREATE INDEX` | `SHARE` | no — blocks writers for the whole build |
| `CREATE INDEX CONCURRENTLY` | `SHARE UPDATE EXCLUSIVE` | no |
| `DROP TABLE`, `TRUNCATE` | `ACCESS EXCLUSIVE` | yes |

Every row in the "yes" column is a candidate for the queue. Every row in the "no" column can still
be slow, which is [08b4](08b4-how-long-is-too-long.md)'s subject — a `CREATE INDEX CONCURRENTLY`
running for an hour blocks nothing and is still a problem.

⚠️ **`ACCESS EXCLUSIVE` reaches further than the table you named.** `ALTER TABLE` on a partitioned
parent locks the partitions it has to touch, and adding a foreign key locks the *referenced* table
as well as the referencing one — so a migration that names one small table can queue readers off a
large one. Read both sides of every constraint before deciding a migration is safe.

## Gotchas

**★ The dangerous migration is the one that waits, not the one that works.** `ADD COLUMN` with a
constant default is a catalogue change. It is still an outage if it spends four minutes queued
behind an analytics query, because every reader queues behind *it*.

**★ A *waiting* `ACCESS EXCLUSIVE` request blocks readers that would not have conflicted with the
lock actually held.** This is the fact that surprises people and it is the entire mechanism.
Requests queue per object; a `SELECT` arriving after the blocked `ALTER TABLE` does not overtake it.

**★ The symptom is pool exhaustion, not a lock error.** Every hung request holds a connection, so
the alert that fires is `Connection is not available`
([02 · 05](../02-connection-pooling/05-connection-is-not-available.md)) and the blocked table's name
appears nowhere in it. Check `pg_locks` before you touch the pool.

**★ Raising the pool size makes it worse.** More connections means more backends in the queue, more
lock-table space consumed, and a larger and slower failure. The pool refusing work is the system
limiting the blast radius.

**★ An `idle in transaction` session is the usual culprit and it is running nothing.** It holds
every lock it has already taken until the transaction ends, and it will not end on its own. That is
what `idle_in_transaction_session_timeout` exists for, and it is `0` by default
([08b4](08b4-how-long-is-too-long.md)).

**★ A lock wait is not a deadlock and PostgreSQL will not break it for you.** Deadlock detection
fires only on a cycle. A one-directional wait is documented as waiting *indefinitely*.

**★ The lock is held to the end of the transaction, not the end of the statement.** A migration file
with an `ALTER TABLE` at line 1 and a slow `UPDATE` at line 40 holds `ACCESS EXCLUSIVE` for the
whole file, because Flyway runs the file in one transaction. Reordering statements inside the file
does not help; splitting the file does.

**★ The lock is also held across everything Flyway does after your SQL** — inserting the
`flyway_schema_history` row, and every remaining migration if `group` is enabled. `group: true` puts
all pending migrations in one transaction, so the first `ACCESS EXCLUSIVE` taken is held until the
last migration commits.

**★ Adding a foreign key locks both tables.** The referencing table takes `SHARE ROW EXCLUSIVE`, and
the referenced table is locked too. A migration whose diff mentions only `orders` can stall reads on
`customers`.

**★ `CREATE INDEX` without `CONCURRENTLY` does not block readers and is still an outage.** It takes
`SHARE`, which conflicts with the `ROW EXCLUSIVE` that `INSERT`, `UPDATE` and `DELETE` take. Every
write waits for the whole build. "Reads still work" is not the same as "the service still works".

**★ `TRUNCATE` is not a cheap `DELETE` from a locking point of view.** The documentation gives it as
its own example: *"`TRUNCATE` cannot safely be executed concurrently with other operations on the
same table, so it obtains an `ACCESS EXCLUSIVE` lock on the table to enforce that."*

**★ Staging proves nothing about this.** Staging has no forgotten analytics query, no connection
stuck `idle in transaction` and no traffic, so the lock is always free and the migration always
takes a millisecond. This failure mode is a property of *concurrency*, not of the SQL, and it is
therefore invisible to any test that runs the migration against a quiet database.

**★ A retry of the deployment can be worse than the first attempt.** If the blocker is still there,
the second `ALTER TABLE` joins the same queue while the readers from the first attempt are still
queued behind it. Fix the blocker, do not re-run the deploy.

## Interview questions

**★ Why can a migration that takes one millisecond cause a ten-minute outage?**
Because the millisecond is the execution time, not the wall time. `ALTER TABLE` requests
`ACCESS EXCLUSIVE`, which conflicts with every other lock mode including the `ACCESS SHARE` that a
plain `SELECT` takes. If any session already holds a conflicting lock the `ALTER TABLE` queues, and
once it is queued every subsequent query on that table queues behind it. The table is offline for
the length of the wait, not the length of the statement.

**★ Why does a `SELECT` arriving after the blocked `ALTER TABLE` have to wait, when it would not
have conflicted with the lock that is actually held?**
Because PostgreSQL queues lock requests per object rather than granting compatible requests out of
order. The documentation acknowledges the queues exist when it says `pg_locks` cannot tell you which
process is ahead of which in them, and the `granted` column's description notes that another process
merely *waiting for* a conflicting mode is enough. Granting the later `SELECT` immediately would
starve the `ALTER TABLE` indefinitely.

**★ Your service starts throwing `Connection is not available` during a deployment. Where do you
look first?**
At `pg_locks` joined to `pg_stat_activity`, not at the pool. Pool exhaustion during a deploy is
usually a downstream symptom: something is blocked in the database, the blocked requests are each
sitting on a connection, and the pool is simply the first component with a timeout short enough to
complain. Enlarging the pool lengthens the queue rather than shortening it.

**★ Which `ALTER TABLE` forms do *not* block readers?**
`ADD FOREIGN KEY` takes `SHARE ROW EXCLUSIVE`, which blocks writers but not readers. `VALIDATE
CONSTRAINT`, `SET STATISTICS`, per-attribute and cluster options, and `ATTACH PARTITION` on the
parent take `SHARE UPDATE EXCLUSIVE`, which blocks neither. Everything else takes `ACCESS EXCLUSIVE`
unless the documentation explicitly says otherwise.

**★ `CREATE INDEX` does not take `ACCESS EXCLUSIVE`, so why is it still dangerous?**
It takes `SHARE`, which conflicts with the `ROW EXCLUSIVE` mode that every `INSERT`, `UPDATE` and
`DELETE` acquires. Reads keep working; writes stop for the entire duration of the build, which on a
large table is minutes. For most services that is indistinguishable from an outage.

**★ Why is "the migration ran fine in staging" not evidence?**
Because the property that fails is contention, and staging has none. Every lock is free there, so
the statement's execution time is the only thing measured — and execution time was never the risk.
The way to get evidence is to reason about the lock mode and to bound the wait explicitly with
`lock_timeout` ([08b2](08b2-seeing-it-and-bounding-it.md)), not to run it again somewhere quiet.

**★ Why does `group: true` make lock exposure worse?**
Because it wraps every pending migration in a single transaction, and locks are held to the end of
the transaction. The `ACCESS EXCLUSIVE` taken by the first migration in the batch is not released
until the last one commits, so the exposure window becomes the total runtime of the whole
deployment's migrations rather than of one file.

{/* FOOTER */}
