---
title: "PostgreSQL does not prevent deadlocks — it waits a second, notices the cycle, and kills one of you"
sidebar_label: "13 · Deadlocks"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.3.4 *Deadlocks*
> ([postgresql.org/docs/18/explicit-locking.html](https://www.postgresql.org/docs/18/explicit-locking.html)),
> the `deadlock_timeout` and `max_locks_per_transaction` entries in *Lock
> Management*
> ([postgresql.org/docs/18/runtime-config-locks.html](https://www.postgresql.org/docs/18/runtime-config-locks.html)),
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**A deadlock is two transactions each holding a lock the other is waiting for.
PostgreSQL's answer is not to prevent it — it is to detect it after a delay and
abort one participant with SQLSTATE `40P01`, `deadlock_detected`. Two details make
this practical rather than alarming. First, *"exactly which transaction will be
aborted is difficult to predict and should not be relied upon"* — so the victim is
whichever one the server picked, and both sides need the same handling. Second,
and the one that is routinely misread: **`deadlock_timeout` is not a limit on how
long you may hold a lock.** It is how long the server waits before bothering to
look for a cycle, because looking is expensive. Nothing about it bounds a lock
wait, and a transaction not in a cycle waits forever.**

## Deadlocks do not need explicit locking

The manual's own example uses nothing but ordinary `UPDATE`s.

Transaction 1:

```sql
UPDATE accounts SET balance = balance + 100.00 WHERE acctnum = 11111;
```

Transaction 2, concurrently:

```sql
UPDATE accounts SET balance = balance + 100.00 WHERE acctnum = 22222;
UPDATE accounts SET balance = balance - 100.00 WHERE acctnum = 11111;   -- waits on T1
```

Transaction 1 then continues:

```sql
UPDATE accounts SET balance = balance - 100.00 WHERE acctnum = 22222;   -- waits on T2
```

*"Thus, transaction one is blocked on transaction two, and transaction two is
blocked on transaction one: a deadlock condition. PostgreSQL will detect this
situation and abort one of the transactions."*

🔴 **Neither transaction wrote `FOR UPDATE`.** Every `UPDATE` and `DELETE` takes a
row lock ([chunk 12](12-locking-and-select-for-update.md)), so any transaction that
writes more than one row can deadlock. The manual says so directly: *"deadlocks can
also occur as the result of row-level locks (and thus, they can occur even if
explicit locking is not used)."*

**The only difference between those two transactions is the order they touched the
rows.** That is the whole bug and the whole fix.

## In Java: the same transfer, written twice

```java
// ❌ order depends on the request. Two requests in opposite directions deadlock.
void transfer(Connection c, long from, long to, BigDecimal amount) {
    debit(c, from, amount);
    credit(c, to, amount);
}
```

`transfer(A, B)` locks A then B. `transfer(B, A)` locks B then A. Run them at the
same time and one of them dies at `40P01`.

```java
// ✅ a total order over the rows, independent of the request
void transfer(Connection c, long from, long to, BigDecimal amount) {
    long first  = Math.min(from, to);
    long second = Math.max(from, to);

    lockAccount(c, first);            // SELECT ... WHERE id = ? FOR UPDATE
    lockAccount(c, second);

    debit(c, from, amount);
    credit(c, to, amount);
}
```

Now every transaction in the system takes account locks in ascending id order, so a
cycle cannot form: to wait on you, I must want a higher id than one I hold, and you
must want a lower one — which no transaction ever does.

🔴 **This is the only real prevention, and the manual says exactly that:** *"the
best defense against deadlocks is generally to avoid them by being certain that all
applications using a database acquire locks on multiple objects in a consistent
order. In the example above, if both transactions had updated the rows in the same
order, no deadlock would have occurred."*

⚠️ **"All applications."** A consistent order is a property of the whole system, not
of one method. One batch job or one admin script that iterates in a different order
reintroduces the cycle for everybody. It is a codebase-wide invariant, like the
check-first protocol at [Serializable](07c-deferrable-and-the-limits.md).

## The second half of the manual's advice, which is usually skipped

> One should also ensure that the first lock acquired on an object in a transaction
> is the most restrictive mode that will be needed for that object.

**Lock upgrades deadlock even under a consistent order.** If two transactions both
take `FOR SHARE` on a row and both then want to upgrade to `FOR UPDATE`, each is
waiting for the other's shared lock to go away. The order was identical and they
still deadlocked.

So: if you know you will update the row, take `FOR UPDATE` on the first read. Do
not read with `FOR SHARE` and upgrade later.

## `deadlock_timeout` is a detection delay

This is the most-misunderstood setting in the area, and its documentation is
unambiguous:

> This is the amount of time to wait on a lock before checking to see if there is a
> deadlock condition. The check for deadlock is relatively expensive, so the server
> doesn't run it every time it waits for a lock. We optimistically assume that
> deadlocks are not common in production applications and just wait on the lock for
> a while before checking for a deadlock. ... The default is one second (`1s`),
> which is probably about the smallest value you would want in practice.

| It is | It is not |
|---|---|
| how long a waiter waits before running the cycle check | a maximum time a lock may be held |
| a knob trading CPU against detection latency | a timeout that will rescue a stuck transaction |
| default `1s`, and *"probably about the smallest value you would want"* | something to lower to "fix" contention |

⚠️ **Lowering it does not reduce deadlocks.** It only makes the server look for
them more often, which the manual explicitly frames as a cost: *"increasing this
value reduces the amount of time wasted in needless deadlock checks, but slows down
reporting of real deadlock errors."* Its own tuning advice points the other way:
*"ideally the setting should exceed your typical transaction time, so as to improve
the odds that a lock will be released before the waiter decides to check for
deadlock."*

The one legitimate reason to lower it: it doubles as the delay before
`log_lock_waits` logs a lock wait — *"if you are trying to investigate locking
delays you might want to set a shorter than normal `deadlock_timeout`."* That is a
diagnostic move, temporary and deliberate.

## Without a cycle, the wait is unbounded

> So long as no deadlock situation is detected, a transaction seeking either a
> table-level or row-level lock will wait indefinitely for conflicting locks to be
> released. This means it is a bad idea for applications to hold transactions open
> for long periods of time (e.g., while waiting for user input).

🔴 **There is no default timeout on a lock wait.** A transaction blocked on a lock
that is simply held for a long time will sit there until the holder finishes,
however long that takes — no `40P01`, no error, just a request that never returns.
Bounding that is a separate decision, and it is
[chunk 13b](13b-the-four-clocks.md).

## Handling it in Java

```java
catch (SQLException e) {
    String state = e.getSQLState();
    if ("40001".equals(state) || "40P01".equals(state)) {
        // class 40 — Transaction Rollback. Retry the WHOLE transaction.
    }
}
```

`40P01` sits alongside `40001` in class 40, and the handling is identical: the
transaction is already dead, roll back and run the whole unit of work again. The
retry usually succeeds, because the other transaction has finished by then and the
lock it held is gone.

The manual endorses this as the fallback: *"if it is not feasible to verify this in
advance, then deadlocks can be handled on-the-fly by retrying transactions that
abort due to deadlocks."*

⚠️ **But treat a rising deadlock rate as a design signal, not a retry-budget
problem.** Deadlocks are almost always an ordering bug, and every one of them costs
a full transaction's work plus at least `deadlock_timeout` of waiting.

## Gotchas

**⚠️ Believing you cannot deadlock because you never wrote `FOR UPDATE`**
**Symptom:** `40P01` in an application with no explicit locking anywhere.
**Cause:** every `UPDATE` and `DELETE` takes a row lock. Two rows touched in
different orders is all it takes.
**Fix:** impose an order on the rows a transaction writes — sort the ids before
acting on them.

**⚠️ Lowering `deadlock_timeout` to reduce deadlocks**
**Symptom:** the deadlock rate is unchanged and the server does more work.
**Cause:** the setting controls when the *check* runs, not how long a lock may be
held. The deadlock already existed; you only found it sooner.
**Fix:** fix the lock ordering. Lower it only temporarily, with `log_lock_waits`,
to investigate.

**⚠️ Sorting inside one method and not another**
**Symptom:** deadlocks that only involve one particular background job.
**Cause:** a consistent order is a property of every application touching the
database — the manual says "all applications". One iterator in insertion order
reintroduces the cycle.
**Fix:** put the ordering in the shared repository or DAO layer, not in each caller.

**⚠️ Reading with `FOR SHARE` and upgrading to `FOR UPDATE`**
**Symptom:** deadlocks between two transactions that touch the same single row in
the same order.
**Cause:** a lock upgrade. Both hold the shared lock; each waits for the other to
release it. Ordering cannot help, because there is only one object.
**Fix:** the manual's second rule — take the most restrictive mode you will need on
the first acquisition.

**⚠️ Expecting a stuck request to eventually time out**
**Symptom:** a request hangs for minutes; no error is ever produced; the thread is
consumed until something else gives up.
**Cause:** without a cycle, a lock wait is indefinite by design and there is no
default limit.
**Fix:** set `lock_timeout` — [chunk 13b](13b-the-four-clocks.md).

**⚠️ Retrying only `40001` and not `40P01`**
**Symptom:** serialization failures recover cleanly and deadlocks surface as 500s.
**Cause:** the retry predicate was written against one code.
**Fix:** retry on class 40 — check `getSQLState().startsWith("40")`, or list both
codes explicitly.

## Interview questions

**★ What is SQLSTATE 40P01?**
`deadlock_detected`, in class 40 — Transaction Rollback. It means PostgreSQL found
a cycle of transactions each waiting on a lock another one holds, and broke the
cycle by aborting yours. The manual is explicit that "exactly which transaction
will be aborted is difficult to predict and should not be relied upon", so you
cannot design around being the survivor — every participant needs the same
handling. Since it is in class 40, the response is the same as for a serialization
failure: the transaction is already dead, so roll back and retry the whole unit of
work. The retry usually succeeds, because the transaction that beat you has
finished and released its locks.

**★ Can you deadlock without using explicit locks?**
Yes, and it is the common case. Every `UPDATE` and `DELETE` takes a row-level lock,
so any two transactions that write the same two rows in opposite orders can
deadlock. The manual's own example is a pair of ordinary balance updates: one
transaction touches account 11111 then 22222, the other touches 22222 then 11111,
and they block on each other. Nothing in either statement mentions locking. That is
why "we do not use `SELECT FOR UPDATE`" is not an argument that deadlocks are
impossible.

**★ How do you prevent deadlocks?**
By acquiring locks on multiple objects in a consistent order, everywhere. The
manual calls this "the best defense" and points out that in its example, if both
transactions had updated the rows in the same order, no deadlock would have
occurred. In practice that means sorting: before writing a set of rows, sort their
keys and act in that order, and put the sorting in a shared layer rather than in
each caller, because the invariant only holds if *all* applications follow it.
There is a second rule people skip — make the first lock you take on an object the
most restrictive mode you will need — because a lock upgrade from shared to
exclusive can deadlock two transactions that used identical ordering.

**★ What does `deadlock_timeout` control?**
How long a transaction waits on a lock before the server checks whether a deadlock
exists. It is a detection delay, not a lock-holding limit. The reasoning in the
documentation is that the check is relatively expensive, so rather than run it on
every lock wait, the server optimistically waits — one second by default — and only
then looks. The consequences are the opposite of what people assume: lowering it
does not reduce deadlocks, it only reports them sooner at the cost of more checking,
and the documentation says one second "is probably about the smallest value you
would want in practice" and that ideally the setting should exceed your typical
transaction time. The one good reason to lower it temporarily is that it also
controls the delay before `log_lock_waits` logs a lock wait.

**★ How long will a transaction wait for a lock it cannot get?**
Forever, unless there is a cycle or you have configured a limit. The manual: "so
long as no deadlock situation is detected, a transaction seeking either a
table-level or row-level lock will wait indefinitely for conflicting locks to be
released". So a transaction blocked behind a genuinely long-running holder produces
no error at all — just a request that never returns and a thread that stays
consumed. The manual draws the conclusion itself: it is a bad idea to hold
transactions open for long periods, for example while waiting for user input. If
you need a bound, that is `lock_timeout`, which is off by default.

**★ Two transactions read the same row with `FOR SHARE` and then both update it.
What happens, and why does lock ordering not help?**
They deadlock. Each holds a shared lock on the row and each needs an exclusive lock,
which conflicts with the other's shared lock — so both wait and neither can
proceed. Lock ordering is no defence because there is only one object involved;
there is no order to get wrong. This is a lock *upgrade*, and it is why the manual's
advice has a second clause: ensure the first lock acquired on an object is the most
restrictive mode that will be needed for it. If the transaction is going to update
the row, it should read it with `FOR UPDATE` in the first place.

---

← Prev: [12b · NOWAIT, SKIP LOCKED, scope](12b-nowait-skip-locked-and-scope.md) · Index: [Transactions at the JDBC level](README.md) · Next → [13b · Which clock, and how to tell](13b-the-four-clocks.md)
