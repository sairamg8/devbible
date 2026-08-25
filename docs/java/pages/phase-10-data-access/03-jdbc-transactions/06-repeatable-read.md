---
title: "REPEATABLE READ gives the whole transaction one snapshot, and hands you SQLSTATE 40001 as the price"
sidebar_label: "6 · Repeatable Read"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.2 *Repeatable Read
> Isolation Level*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> the `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Repeatable Read moves the snapshot from the statement to the transaction. The
manual: a query "sees a snapshot as of the start of the first
non-transaction-control statement in the *transaction*, not as of the start of the
current statement". Every read in the transaction then agrees with every other
read, and PostgreSQL throws in phantom protection the standard does not require.
What you buy that with is a **new failure mode**: if you try to write a row a
concurrent transaction already changed, your transaction is aborted with
`ERROR: could not serialize access due to concurrent update`, SQLSTATE `40001`.
That is not a bug, an outage, or something to log and move past. It is the level
working, and a Repeatable Read transaction without a retry path is an unfinished
one.**

## Where the snapshot is taken, exactly

*"The first non-transaction-control statement."* That phrase does real work.

`BEGIN` does not take a snapshot. Neither does `SET TRANSACTION ISOLATION LEVEL`.
The snapshot is taken by the first `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
`MERGE`, `FETCH` or `COPY` — the same list `SET TRANSACTION` uses to say when the
level can no longer be changed.

```java
c.setAutoCommit(false);                       // pgjdbc has not sent BEGIN yet
c.setTransactionIsolation(
    Connection.TRANSACTION_REPEATABLE_READ);  // still no snapshot

Thread.sleep(5_000);                          // ⚠️ nothing is frozen here

readSomething(c);   // ← the snapshot is taken NOW
```

🔴 **The clock that matters starts at the first query, not at `setAutoCommit(false)`
and not at `BEGIN`.** So a transaction that opens, does slow work in Java, and
then queries is not holding an old snapshot — it is holding an idle connection,
which is a different problem with a different fix. Conversely, a transaction that
queries early and then does slow work in Java *is* pinning a snapshot for that
whole duration.

## What it fixes: the two reads now agree

The count from [chunk 5b](05b-when-re-evaluation-surprises-you.md) becomes
meaningful:

```java
c.setAutoCommit(false);
c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);

int orders   = countPendingOrders(c);
BigDecimal v = sumPendingValue(c);
int lines    = countPendingLines(c);
c.commit();

// all three describe the SAME instant. They can be compared, divided, reconciled.
```

At Read Committed those three numbers came from three moments and could not be
combined. At Repeatable Read they are one photograph of the database. That is the
entire reason to reach for this level for reporting, exports, invariant checks and
anything that reads several tables and expects them to tie out.

And PostgreSQL gives you more than the standard asks. The manual: this *"prevents
all of the phenomena described in Table 13.1 except for serialization anomalies.
As mentioned above, this is specifically allowed by the standard, which only
describes the **minimum** protections each isolation level must provide."* So
phantoms are gone too — [chunk 3](03-what-isolation-actually-means.md) — and
`TRANSACTION_SERIALIZABLE` is not the level you need merely to stop them.

## What it costs: the write conflict becomes an abort

Here is the mechanism, in the manual's words:

> `UPDATE`, `DELETE`, `MERGE`, `SELECT FOR UPDATE`, and `SELECT FOR SHARE`
> commands behave the same as `SELECT` in terms of searching for target rows: they
> will only find target rows that were committed as of the **transaction** start
> time. However, such a target row might have already been updated (or deleted or
> locked) by another concurrent transaction by the time it is found. In this case,
> the repeatable read transaction will wait for the first updating transaction to
> commit or roll back. If the first updater rolls back, then its effects are
> negated and the repeatable read transaction can proceed with updating the
> originally found row. But if the first updater commits (and actually updated or
> deleted the row, not just locked it) then the repeatable read transaction will be
> rolled back with the message
>
> ```
> ERROR:  could not serialize access due to concurrent update
> ```

Compare that with Read Committed, which in the same situation *re-evaluates the
`WHERE` clause and carries on*. Repeatable Read cannot do that: re-reading the new
version would mean seeing data from after its snapshot, which is precisely the
guarantee it exists to provide. **It has no legal move except to abort.**

The manual explains the exit: *"When an application receives this error message, it
should abort the current transaction and retry the whole transaction from the
beginning. The second time through, the transaction will see the previously
committed change as part of its initial view of the database, so there is no
logical conflict in using the new version of the row as the starting point for the
new transaction's update."*

**Retry the whole transaction. Not the statement.** That distinction is the
subject of [chunk 14](14-retrying-safely.md) and it is where most retry code is
wrong.

## What this does to the lost update

This is the good news that is easy to miss. Take
[chunk 5](05-read-committed-in-practice.md)'s read-then-write withdrawal — the one
that silently lost £30 — and run it at Repeatable Read.

Request 1 reads 100 and updates to 70. Request 2 reads 100 under its own snapshot,
tries to update, waits, and when request 1 commits it is **aborted at `40001`**.

🔴 **Repeatable Read converts a silent lost update into a loud, catchable
failure.** The money is not lost; a transaction failed and told you so. That is
often the single most valuable thing this level does for an application that has
read-modify-write code it cannot easily rewrite as one statement.

⚠️ It is not a licence to stop caring. The Java code is still wrong in shape — it
now depends on a retry loop for correctness — and a rewrite to a single statement
or a locked read is still better. But the failure is now visible, which is a
categorical improvement over money quietly disappearing.

## Catching it in Java

```java
// SQLSTATE 40001 — the manual: serialization failures "always return with an
// SQLSTATE value of '40001'". Class 40 = Transaction Rollback.
catch (SQLException e) {
    if ("40001".equals(e.getSQLState())) {
        // the whole transaction must be retried from the beginning
    }
}
```

Match on **`getSQLState()`**, never on the message text. The message is
translated, it differs between the two causes of `40001`
([chunk 7](07-serializable-and-ssi.md) has the other one), and it is not part of
any contract. The SQLSTATE is.

⚠️ `40001` is also **not** the code for a deadlock. That is `40P01`,
`deadlock_detected`, same class and a different condition —
[chunk 13](13-deadlocks-and-timeouts.md).

## Gotchas
**⚠️ Treating `40001` as an outage**
**Symptom:** alerts firing on serialization failures, and an engineer investigating
each one.
**Cause:** the level's normal operation was wired to the error channel. Under
Repeatable Read a write conflict is *expected* at some rate.
**Fix:** retry the transaction, and alert on the **rate** or on retries exhausted —
not on the individual failure.

**⚠️ Retrying the failed statement instead of the transaction**
**Symptom:** the retry immediately fails with `25P02`, `in_failed_sql_transaction`.
**Cause:** the transaction is aborted. Every subsequent statement in it is refused
until it ends — [chunk 10](10-the-aborted-transaction.md).
**Fix:** roll back, start a new transaction, and re-run the whole unit of work
from the beginning, including the reads.

**⚠️ Matching on the error message text**
**Symptom:** retry logic that stops working after a server upgrade or on a
non-English locale.
**Cause:** `could not serialize access due to concurrent update` is a translated,
uncontracted string, and `40001` has a second cause with a completely different
message.
**Fix:** `"40001".equals(e.getSQLState())`.

**⚠️ Setting the level after the first query**
**Symptom:** the transaction behaves as Read Committed, or the driver throws
`Cannot change transaction isolation level in the middle of a transaction.`
**Cause:** the snapshot is taken by the first non-transaction-control statement,
and `SET TRANSACTION`'s reference page says the level "cannot be changed after the
first query or data-modification statement has been executed".
**Fix:** set it before any statement runs — [chunk 8](08-setting-the-level-from-java.md).

## Interview questions
**★ When is the snapshot taken at Repeatable Read?**
At the start of the first non-transaction-control statement in the transaction —
the first `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `FETCH` or `COPY`. Not
at `BEGIN`, and not when `setAutoCommit(false)` is called, which on pgJDBC does
not even send anything to the server. This matters in both directions: a
transaction that opens and then does five seconds of work in Java before its first
query has frozen nothing, and a transaction that queries first and then does five
seconds of Java work has pinned a snapshot for that whole time. It is also the
same statement list that determines when the isolation level can no longer be
changed.

**★ What is SQLSTATE 40001 and what should you do about it?**
It is `serialization_failure`, in class 40, Transaction Rollback. At Repeatable
Read it means you tried to update, delete or lock a row that a concurrent
transaction had already changed and committed since your snapshot — the message is
"could not serialize access due to concurrent update". The transaction is already
aborted when you receive it; there is nothing to salvage. The correct response is
the manual's: roll back and retry the *whole* transaction from the beginning,
because the new attempt takes a fresh snapshot that includes the other
transaction's change and therefore has no conflict. Match on `getSQLState()`, not
on the message, because the message is translated and `40001` has a second cause at
Serializable with entirely different wording.

**★ Why can't Repeatable Read just re-evaluate the row like Read Committed does?**
Because re-evaluating would mean reading a row version committed after the
transaction's snapshot, and the whole guarantee of the level is that the
transaction sees one consistent point in time. Read Committed is free to do it
precisely because it has no such promise — each statement gets a fresh snapshot
anyway, so seeing the new version is consistent with its own rules. At Repeatable
Read there is no legal move: it cannot use the old version, because writing over a
committed change would lose it, and it cannot use the new one, because that would
break the snapshot. So it aborts.

**★ Does Repeatable Read fix the lost update?**
It converts it from silent to loud, which is the important part. Two concurrent
read-then-write withdrawals no longer both succeed with one overwriting the other;
the second one is aborted at `40001` and you find out. It does not make the code
*right* — the read-modify-write shape now depends on a retry loop for correctness,
and a single statement or a `SELECT ... FOR UPDATE` is still the better fix — but
a visible failure with a retry is categorically better than money disappearing
with no error anywhere.

---

← Prev: [5b · The inconsistent snapshot](05b-when-re-evaluation-surprises-you.md) · Index: [Transactions at the JDBC level](README.md) · Next → [6b · What RR does not fix](06b-what-repeatable-read-still-cannot-promise.md)
