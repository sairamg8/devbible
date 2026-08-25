---
title: "A stable view is not a correct one — what Repeatable Read still cannot promise, and what it costs the rest of the database"
sidebar_label: "6b · What RR does not fix"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.2 *Repeatable Read
> Isolation Level*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> and §25.1 *Routine Vacuuming*
> ([postgresql.org/docs/18/routine-vacuuming.html](https://www.postgresql.org/docs/18/routine-vacuuming.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**[Chunk 6](06-repeatable-read.md) bought a whole-transaction snapshot and paid
for it in `40001` aborts. This chunk is the rest of the invoice. Repeatable Read
still permits serialization anomalies, and the manual's own example of one is a
read-only transaction seeing a batch marked complete while missing a row that
belongs to it. The level has a naming history that makes old advice actively
misleading. Read-only transactions get the good half for free. And the part nobody
budgets for: a long Repeatable Read transaction pins a snapshot, which stops
vacuum reclaiming superseded row versions **across the whole database**, not just
in the tables you touched.**

## The serialization anomaly, in the manual's own words

The manual is unusually blunt about the limit of this level:

> The Repeatable Read mode provides a rigorous guarantee that each transaction
> sees a completely stable view of the database. However, this view will not
> necessarily always be consistent with some serial (one at a time) execution of
> concurrent transactions of the same level. For example, even a read-only
> transaction at this level may see a control record updated to show that a batch
> has been completed but *not* see one of the detail records which is logically
> part of the batch because it read an earlier revision of the control record.

Read that example twice. A batch is marked complete. Its detail rows were written
in the same transaction that marked it complete. A reader at Repeatable Read sees
the "complete" flag from a later revision it happened to read, and misses a detail
row, because the *set* it read for the details was fixed at its snapshot while the
control record it read was not what it thought.

The manual's conclusion: *"Attempts to enforce business rules by transactions
running at this isolation level are not likely to work correctly without careful
use of explicit locks to block conflicting transactions."*

**Repeatable Read protects a transaction from the outside world. It does not make
a group of transactions collectively sensible.** That is the serialization
anomaly, and Serializable is the level for it.

## The names, and the history

Two naming facts save real confusion.

**Repeatable Read here *is* Snapshot Isolation.** The manual: *"The Repeatable
Read isolation level is implemented using a technique known in academic database
literature and in some other database products as Snapshot Isolation ... Some
other systems may even offer Repeatable Read and Snapshot Isolation as distinct
isolation levels with different behavior."* So a paper or a blog post about
"snapshot isolation anomalies" is about this level, under a different name.

**Before PostgreSQL 9.1, `SERIALIZABLE` meant this.** *"Prior to PostgreSQL version
9.1, a request for the Serializable transaction isolation level provided exactly
the same behavior described here. To retain the legacy Serializable behavior,
Repeatable Read should now be requested."* Old code and old advice that says
`SERIALIZABLE` may mean Repeatable Read, and on a modern server it will get the
stronger, more expensive level instead. That is safe but not free.

## Read-only transactions get the guarantee for free

> Note that only updating transactions might need to be retried; read-only
> transactions will never have serialization conflicts.

At Repeatable Read, a transaction that only reads cannot hit `40001`, because
`40001` here is raised by a write meeting a concurrent write. So a reporting
transaction gets the stable snapshot with **no** new failure mode and no retry
loop.

That is the strongest practical argument for this level: reports and exports get
consistency for free, and only the write paths need retry machinery. Declaring
those transactions read-only makes the intent explicit and buys more at
Serializable — [chunk 11](11-read-only-transactions.md).

## The cost nobody budgets for: a pinned snapshot

A Repeatable Read transaction's snapshot has to stay usable for as long as the
transaction runs, and that means the row versions it might need cannot be cleaned
up. The vacuuming chapter states the underlying rule: *"an `UPDATE` or `DELETE` of
a row does not immediately remove the old version of the row ... the row version
must not be deleted while it is still potentially visible to other transactions."*

So a two-hour report at Repeatable Read holds back cleanup of every superseded row
version in the database for two hours. The consequence the manual names is bloat:
*"if a table has an unexpected spike in update activity, it may get bloated to the
point that `VACUUM FULL` is really necessary to reclaim space."*

The vacuuming chapter also tells you exactly how an operator finds the culprit —
*"End long-running open transactions. You can find these by checking
`pg_stat_activity` for rows where `age(backend_xid)` or `age(backend_xmin)` is
large."*

⚠️ **This cost is paid by the whole database, not by your session.** Your report
runs fine. Somebody else's table doubles in size. It is the reason "just run the
report at Repeatable Read" is a conversation with the operations team, and the
reason a long analytical transaction should consider
`SERIALIZABLE READ ONLY DEFERRABLE` instead — [chunk 11](11-read-only-transactions.md).

## The trade-off

| You gain | You pay |
|---|---|
| Every read in the transaction agrees with every other | write conflicts become `40001` aborts, and you must retry the whole transaction |
| No phantoms, beyond what the standard requires | more code paths: every write transaction needs a retry boundary |
| Lost updates become loud instead of silent | the retry loop is now load-bearing for correctness |
| Reads never conflict — reports are free of `40001` | a long transaction pins a snapshot and holds back vacuum for the whole database |
| No extra blocking versus Read Committed | still no protection against serialization anomalies |

## Gotchas
**⚠️ A long report at Repeatable Read on a busy OLTP database**
**Symptom:** table bloat and vacuum falling behind, correlated with a nightly job
that reads for hours.
**Cause:** the pinned snapshot prevents removal of superseded row versions
database-wide for the transaction's whole life.
**Fix:** shorten the transaction, move the report to a replica, or use
`SERIALIZABLE READ ONLY DEFERRABLE` — and give operations `age(backend_xmin)` in
`pg_stat_activity` as the thing to watch.

**⚠️ Reading "repeatable read" as "correct"**
**Symptom:** a business rule enforced by reading a control row and then writing
detail rows, at Repeatable Read, that occasionally produces an inconsistent batch.
**Cause:** a stable view is not a serializable one. The manual's own control-record
example shows a read-only transaction observing a state no serial execution could
produce.
**Fix:** explicit locks, or Serializable — [chunk 7](07-serializable-and-ssi.md).

**⚠️ Assuming old `SERIALIZABLE` code wanted today's SERIALIZABLE**
**Symptom:** a pre-9.1-era codebase migrated forward starts producing `40001` from
read/write dependency cycles nobody wrote code for.
**Cause:** before 9.1, `SERIALIZABLE` gave exactly Repeatable Read behaviour. The
same keyword now buys SSI.
**Fix:** the manual's own advice — "to retain the legacy Serializable behavior,
Repeatable Read should now be requested." Decide deliberately which you want.

## Interview questions
**★ What can still go wrong at Repeatable Read?**
Serialization anomalies. A stable view per transaction does not mean the set of
transactions is collectively equivalent to running them one at a time. The manual
gives a read-only example: a transaction can see a control record marked as
"batch complete" while not seeing one of the detail records that logically belongs
to the batch, because it read an earlier revision of the control record. Its own
conclusion is that enforcing business rules at this level is "not likely to work
correctly without careful use of explicit locks to block conflicting
transactions". The alternatives are explicit locking or Serializable.

**★ Can a read-only transaction get 40001 at Repeatable Read?**
No. The manual says directly that "only updating transactions might need to be
retried; read-only transactions will never have serialization conflicts" at this
level, because the conflict is raised when a write meets a concurrent committed
write. That is why Repeatable Read is such a good fit for reporting: you get the
whole-transaction snapshot with no new failure mode and no retry loop. Note that
this changes at Serializable, where a read-only transaction *can* be aborted as
part of a dependency cycle — which is why declaring it `READ ONLY`, and possibly
`DEFERRABLE`, matters more there.

**★ What does a long Repeatable Read transaction cost the rest of the database?**
It holds back cleanup. Under MVCC an `UPDATE` or `DELETE` leaves the old row
version in place, and the vacuuming chapter says that version "must not be deleted
while it is still potentially visible to other transactions". Your snapshot keeps
old versions potentially visible for as long as your transaction lives, so vacuum
cannot reclaim them anywhere in the database — not just in the tables you touched.
On a busy system that shows up as table bloat, and the manual's own remediation
list tells operators to find the offender by looking for large `age(backend_xid)`
or `age(backend_xmin)` in `pg_stat_activity`. It is the reason a multi-hour report
at this level is an operational decision, not just a code decision.

**★ Is PostgreSQL's Repeatable Read the same as another database's?**
Not necessarily, and the manual says so. PostgreSQL implements it as Snapshot
Isolation — no read locks, no blocking of readers, aborts on write conflicts —
whereas a lock-based engine may implement the same level by holding read locks and
making writers wait. It also prevents phantoms, which the standard permits at this
level. The manual even notes that some systems offer Repeatable Read and Snapshot
Isolation as *distinct* levels with different behaviour. And on PostgreSQL
specifically, anything written before 9.1 that says `SERIALIZABLE` means what is
now called Repeatable Read.

---

← Prev: [6 · Repeatable Read](06-repeatable-read.md) · Index: [Transactions at the JDBC level](README.md) · Next → [7 · Serializable and SSI](07-serializable-and-ssi.md)
