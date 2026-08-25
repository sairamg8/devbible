---
title: "At READ COMMITTED each statement gets its own snapshot, which is how a withdrawal silently loses money"
sidebar_label: "5 · Read Committed"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.1 *Read Committed
> Isolation Level*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> and the `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Read Committed is the default, and the unit it protects is the *statement*, not
the transaction. The manual is exact: a `SELECT` "sees a snapshot of the database
as of the instant the query begins to run", and *"two successive `SELECT`
commands can see different data, even though they are within a single
transaction"*. That one sentence is the whole level. Wrapping code in a
transaction does **not** give you a stable view of the data — it gives you
atomicity for your writes and nothing at all for the stability of your reads. So
every read-then-write sequence you express as two statements is a race, and the
most common one in business software loses money without raising an error.**

## The rule, stated once

At Read Committed:

- A `SELECT` sees rows committed **before that statement started**. Not before the
  transaction started. Not as of any later moment.
- It never sees uncommitted data — there is no mechanism for a dirty read at all,
  per [chunk 4](04-postgresql-has-three-levels.md).
- It **does** see your own uncommitted writes: *"`SELECT` does see the effects of
  previous updates executed within its own transaction, even though they are not
  yet committed."*
- Ten statements in one transaction take ten snapshots, each fresher than the
  last.

A transaction at this level is a sequence of consistent photographs, not one
consistent view. Between photograph three and photograph four, the world moved.

## The lost update, written out in Java

This is the shape. It is in every codebase.

```java
// ❌ read-modify-write across two statements — a race, transaction or not
c.setAutoCommit(false);

BigDecimal balance;
try (PreparedStatement ps = c.prepareStatement(
        "SELECT balance FROM accounts WHERE id = ?")) {
    ps.setLong(1, accountId);
    try (ResultSet rs = ps.executeQuery()) {
        rs.next();
        balance = rs.getBigDecimal("balance");   // snapshot A
    }
}

BigDecimal updated = balance.subtract(amount);   // computed in the JVM

try (PreparedStatement ps = c.prepareStatement(
        "UPDATE accounts SET balance = ? WHERE id = ?")) {
    ps.setBigDecimal(1, updated);                // writes a value from snapshot A
    ps.setLong(2, accountId);
    ps.executeUpdate();
}
c.commit();
```

Two requests run this concurrently against a balance of £100, each withdrawing
£30.

1. Request 1's `SELECT` starts. It reads 100.
2. Request 2's `SELECT` starts. Nothing has committed yet, so it also reads 100.
3. Request 1 computes 70 and updates. Commits.
4. Request 2 computes 70 — from its own read of 100 — and updates. Commits.

The balance is 70. **Two withdrawals of £30 happened and £30 vanished.** No
exception was thrown, no constraint was violated, nothing appeared in a log. The
second `UPDATE` reported one row affected, which is exactly what success looks
like.

## Why the transaction did not save you

Be precise about what the transaction *did* do here, because the mental model "I
wrapped it in a transaction so it's safe" is the actual bug.

| Property | Does a transaction at Read Committed give it? |
|---|---|
| Both statements commit or neither does | ✅ yes |
| Nobody sees my half-finished state | ✅ yes |
| The row I read is still what I read when I write it | ❌ **no** |
| My two `SELECT`s return the same thing | ❌ **no** |

The third row is what this page is about. Atomicity guarantees both statements
land together. It says nothing about whether the value the first statement read is
still true when the second statement runs. That is isolation, and Read Committed
does not provide it across statements.

## The fix that costs nothing: do it in one statement

```java
// ✅ one statement — the read and the write are the same operation
try (PreparedStatement ps = c.prepareStatement(
        "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?")) {
    ps.setBigDecimal(1, amount);
    ps.setLong(2, accountId);
    ps.setBigDecimal(3, amount);
    int rows = ps.executeUpdate();
    if (rows == 0) {
        throw new InsufficientFunds(accountId);   // guard failed, nothing changed
    }
}
```

`balance = balance - ?` is evaluated **by the server, on the row it locked**.
There is no window between reading and writing because there is no separate read.
Two concurrent executions cannot both compute from 100: the second waits for the
first to commit and then works from 70.

🔴 **The `rows == 0` check is load-bearing and is the part people leave out.**
Without the `AND balance >= ?` guard the balance goes negative silently. With the
guard but without the check, the withdrawal is reported as successful when nothing
happened. The update count is how a guarded single statement reports failure — it
has no other channel.

⚠️ There is a fourth "fix" that is not one: **checking first.**
`SELECT ...; if (balance >= amount) { UPDATE ... }` has the same race as the
original, with a comforting `if` in front of it. The check and the write are still
two statements and the world still moves between them.

## What the manual says happens when two writers collide

Read Committed does not simply let the second writer trample the first:

> `UPDATE`, `DELETE`, `SELECT FOR UPDATE`, and `SELECT FOR SHARE` commands behave
> the same as `SELECT` in terms of searching for target rows ... However, such a
> target row might have already been updated (or deleted or locked) by another
> concurrent transaction by the time it is found. In this case, the would-be
> updater will **wait** for the first updating transaction to commit or roll back.

And then the part that makes the single-statement fix work:

> If the first updater commits, the second updater will ignore the row if the
> first updater deleted it, otherwise it will attempt to apply its operation to
> the updated version of the row. **The search condition of the command (the
> `WHERE` clause) is re-evaluated** to see if the updated version of the row still
> matches the search condition.

So `UPDATE accounts SET balance = balance - 30 WHERE id = 7` waits, then re-reads
the row it locked, and `balance` in the expression means the *current* balance.
That re-evaluation also has a surprising side, which is
[chunk 5b](05b-when-re-evaluation-surprises-you.md).

## Gotchas

**⚠️ "It's in a transaction, so the read is stable"**
**Symptom:** a lost update in production that nobody can reproduce locally,
because it needs two requests to interleave inside a few milliseconds.
**Cause:** conflating atomicity with isolation. The transaction guarantees both
statements commit together; it does not freeze the row between them.
**Fix:** make the read and write one statement, or lock the row at read time with
[`SELECT ... FOR UPDATE`](12-locking-and-select-for-update.md).

**⚠️ A `SELECT` guard in front of an `UPDATE`**
**Symptom:** overdrafts, oversold inventory, duplicate rows past a uniqueness
check — all past an explicit `if` that was supposed to prevent exactly that.
**Cause:** the check ran under one statement's snapshot and the write under
another's. Nothing held the row in between.
**Fix:** move the guard into the `UPDATE`'s `WHERE` clause and act on the update
count.

**⚠️ Ignoring the update count from a guarded single statement**
**Symptom:** the API returns 200, the balance is unchanged, and the customer is
told the withdrawal succeeded.
**Cause:** with the guard in the `WHERE` clause, a failed guard is not an
exception. It is zero rows.
**Fix:** always branch on `executeUpdate()`'s return value when the statement
carries a condition that can legitimately fail.

**⚠️ Copying "the manual's transfer example is safe" without copying its shape**
**Symptom:** a team cites the manual's two-`UPDATE` transfer as proof their
read-then-write transfer is fine.
**Cause:** the manual's example is safe *because* each statement is
`SET balance = balance ± 100 WHERE acctnum = ?` — an expression over the row's own
current value, affecting a predetermined row. The Java version that reads into a
`BigDecimal` first is a different program.
**Fix:** ask whether the new value is computed by the server from the row, or by
the JVM from a stale read.

**⚠️ Retrying the failed request as the mitigation**
**Symptom:** a lost update is noticed, and the response is to add a retry.
**Cause:** retries answer failures. A lost update is not a failure — both writes
succeeded. There is nothing to retry, and the retry will lose an update too.
**Fix:** the race has to be closed at the statement or the level. Retries belong
with `40001`, [chunk 14](14-retrying-safely.md), and are irrelevant here.

## Interview questions

**★ Explain the lost update problem.**
Two transactions read the same row, each computes a new value from what it read,
and each writes it back. The second write is based on a value that was already
stale, so it overwrites the first transaction's change and that change is lost.
The classic form is a balance: two withdrawals of £30 from £100 both read 100,
both compute 70, both write 70, and the account ends at 70 instead of 40. Nothing
errors — the second `UPDATE` reports one row affected, which is indistinguishable
from success. It happens at Read Committed because each statement takes its own
snapshot, so the read that fed the computation is not protected until the write.

**★ Does wrapping the read and the write in one transaction fix it?**
No, and this is the most common misconception about transactions. A transaction
gives you atomicity — both statements commit or neither does — and it hides your
half-finished state from others. It does not freeze the rows you read. At Read
Committed the `SELECT` sees a snapshot taken when that `SELECT` started, and by
the time the `UPDATE` runs another transaction may have committed a change to the
row. You need one of three things instead: express the change as a single
statement so the server computes from the current row, lock the row at read time
with `SELECT ... FOR UPDATE`, or move to Repeatable Read where the conflict
becomes a detectable `40001` abort rather than a silent overwrite.

**★ Why is `UPDATE accounts SET balance = balance - 30 WHERE id = 7` safe when
the Java read-then-write is not?**
Because `balance` in that expression is evaluated by the server against the row it
has locked, so there is no window between the read and the write — they are the
same operation. The manual describes the rule precisely: if the target row has
already been updated by a concurrent transaction, the second updater *waits* for
that transaction to finish, then applies its operation to the updated version of
the row and re-evaluates the `WHERE` clause against it. The second withdrawal
therefore computes from 70, not from the 100 it might have read a moment earlier.
The Java version has no such protection because the subtraction happened in the
JVM, from a value that was only ever a snapshot.

**★ If a lost update leaves no error, how do you find one?**
Not from the database's output, because there is none — the losing write is a
perfectly ordinary successful `UPDATE`. You find it by auditing the code for the
shape: a `SELECT` whose result is used to compute a value that is then written
back, with anything at all in between. Grep for the pattern, not the symptom. In
production you detect the *consequence* instead — a ledger that does not tie out,
a stock count that drifts, a counter lower than the number of events that
incremented it. The other half of the answer is prevention as a review rule: any
read-modify-write that is not a single statement must justify why not, and name
the lock or the isolation level that makes it safe.

**★ Why does a `SELECT` in a transaction still see that transaction's own
uncommitted writes?**
Because the snapshot rule is about *other* transactions. The manual says a
`SELECT` "does see the effects of previous updates executed within its own
transaction, even though they are not yet committed" — otherwise a transaction
could not read back a row it had just inserted, and nothing multi-step would work.
It is worth stating explicitly because it is the one case where a Read Committed
statement sees data that is not committed, and it is easy to misread the level's
guarantee as "only committed data, full stop".

---

← Prev: [4 · Three levels, four names](04-postgresql-has-three-levels.md) · Index: [Transactions at the JDBC level](README.md) · Next → [5b · The inconsistent snapshot](05b-when-re-evaluation-surprises-you.md)
