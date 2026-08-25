---
title: "DEFERRABLE is the one Serializable mode that cannot be aborted — and Serializable still cannot save a transaction that skips the check"
sidebar_label: "7c · DEFERRABLE and its limits"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.3 *Serializable
> Isolation Level*, including the unique-constraint note and the deferrable
> read-only paragraph
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> and the `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18. No sandbox: no console output, no timings.

**Two loose ends from [chunk 7](07-serializable-and-ssi.md) and
[chunk 7b](07b-making-serializable-perform.md), and both are the kind of detail
that decides whether a design works. `SERIALIZABLE READ ONLY DEFERRABLE` is the
one configuration in which a Serializable transaction **cannot** be aborted at
`40001` — it pays for that by waiting at the start, and it is the only case where
Serializable blocks and Repeatable Read would not. And Serializable is not a
blanket safety net: it can still raise a unique-constraint violation that no
serial execution would have produced, if even one code path inserts a key without
checking first. That makes the check a codebase-wide invariant rather than a
per-transaction one.**

## `SERIALIZABLE READ ONLY DEFERRABLE` — the report mode

`DEFERRABLE` only does something when both `SERIALIZABLE` and `READ ONLY` are set.
The `SET TRANSACTION` page describes the effect: the transaction *"may block when
acquiring its snapshot, then runs without the normal `SERIALIZABLE` overhead and
without risk of serialization failure"*, and calls it ideal for long-running
reports or backups.

The isolation chapter explains what the blocking buys: *"If you explicitly request
a `SERIALIZABLE READ ONLY DEFERRABLE` transaction, it will block until it can
establish this fact. (This is the **only** case where Serializable transactions
block but Repeatable Read transactions don't.)"* — "this fact" being that no
conflict can still occur that would lead to an anomaly.

So the three properties, together:

| | Behaviour |
|---|---|
| Waits at the start | until a safe snapshot is available |
| Runs | without SSI's tracking overhead |
| Can it be aborted at `40001`? | **no** |
| Is the data it reads valid immediately? | **yes** — the one exception to the rule above |

⚠️ **The price is an unbounded wait at the start.** On a busy system that snapshot
may not become available quickly, and there is no code path in which a deferrable
transaction fails fast. Pair it with a
[timeout](13b-the-four-clocks.md) if the report has a deadline.

There is no JDBC method for this. `Connection.setReadOnly(true)` covers half of it
and `DEFERRABLE` has no API at all — it must be set with SQL, which is
[chunk 8](08-setting-the-level-from-java.md)'s subject.

## Serializable does not prevent every error

> In particular, it is possible to see unique constraint violations caused by
> conflicts with overlapping Serializable transactions even after explicitly
> checking that the key isn't present before attempting to insert it. This can be
> avoided by making sure that **all** Serializable transactions that insert
> potentially conflicting keys explicitly check if they can do so first.

The manual's example is an application that either asks the user for a key and
checks it does not exist, or generates one by selecting the maximum and adding
one. If *some* transaction inserts keys without following that protocol, unique
violations can be reported "even in cases where they could not occur in a serial
execution".

**One code path that skips the check breaks the guarantee for everybody else.**
That makes it a codebase-wide invariant, not a per-transaction one — the sort of
thing that belongs in a review checklist rather than in a comment.

⚠️ And note the class: a `23505` unique violation is **not** a `40001`. It must not
be retried blindly — [chunk 14](14-retrying-safely.md).

## The trade-off

| You gain | You pay |
|---|---|
| Protection from serialization anomalies — the only thing RR lacks | an abort rate you cannot predict per transaction |
| Correctness reviewable one transaction at a time | a generalized retry boundary is mandatory infrastructure |
| Explicit locks and `FOR UPDATE` can often be deleted | SSI tracking overhead, and a failure rate sensitive to plans and memory |
| Read-only transactions can avoid taking predicate locks at all | `DEFERRABLE` reports trade that for an unbounded initial wait |

## Gotchas
**⚠️ Retrying a `23505` because "it's a concurrency error"**
**Symptom:** a retry loop spins on a unique violation and eventually gives up, or
worse, succeeds by luck and hides a duplicate.
**Cause:** class 23 is an integrity constraint violation, not a serialization
failure. Serializable can *surface* one, but the fix is the check-first protocol,
not a retry.
**Fix:** retry class 40 only.

**⚠️ Using `DEFERRABLE` for anything that has a deadline**
**Symptom:** a report that "hangs", with the session waiting before it has run a
single query.
**Cause:** a deferrable transaction blocks until it can acquire a snapshot known to
be conflict-free, and on a busy system that may take a while. It is the only case
where Serializable blocks and Repeatable Read does not.
**Fix:** it is the right tool for a backup or an overnight report; give it a
timeout, or use plain Repeatable Read if the wait is unacceptable.

**⚠️ Setting `DEFERRABLE` and forgetting `READ ONLY`**
**Symptom:** a transaction marked `DEFERRABLE` still gets aborted at `40001`, and
nobody can see why the flag did nothing.
**Cause:** `DEFERRABLE` has an effect only when the transaction is **both**
`SERIALIZABLE` and `READ ONLY`. On its own it is accepted and inert.
**Fix:** all three modes together —
`BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE;`

**⚠️ Expecting `Connection.setReadOnly(true)` to be enough for a deferrable report**
**Symptom:** the JDBC call is made, the transaction is still abortable, and there
is no obvious place to put `DEFERRABLE`.
**Cause:** JDBC has no API for `DEFERRABLE` at all, and pgJDBC's `setReadOnly`
does not always send SQL — its behaviour depends on the `readOnlyMode` connection
property.
**Fix:** issue the SQL yourself on the connection before the first query —
[chunk 8](08-setting-the-level-from-java.md) and
[chunk 11](11-read-only-transactions.md).

## Interview questions
**★ Does Serializable eliminate all errors that a serial execution would not
produce?**
No, and the manual calls this out for unique constraints. You can still see a
unique violation from a conflict with an overlapping Serializable transaction even
after explicitly checking the key was absent — unless *every* Serializable
transaction that inserts potentially conflicting keys follows the same check-first
protocol. One code path that inserts without checking breaks the guarantee for
everyone. So Serializable prevents anomalies among transactions that participate
correctly; it does not retrofit safety onto a transaction that skips the check.
Practically, that also means a `23505` must not be swept into the `40001` retry
path.

**★ What does DEFERRABLE do and when would you use it?**
It only has an effect when the transaction is both `SERIALIZABLE` and `READ ONLY`.
Such a transaction blocks at the start until it can acquire a snapshot guaranteed
to be free of the conditions that cause anomalies, and then runs without SSI's
normal overhead and with no risk of a serialization failure. It is the only case
where a Serializable transaction blocks and a Repeatable Read one would not. Use it
for long-running reports and backups, where a wait at the start is acceptable and
being aborted after an hour of reading is not. It is also the single exception to
the rule that data read at Serializable is not valid until commit — a deferrable
read-only transaction's data is known to be valid as soon as it is read. There is
no JDBC method for it; it has to be set with SQL.

**★ Why does a deferrable transaction have to wait, and what is it waiting for?**
It is waiting for a snapshot it can prove is safe. A normal Serializable
transaction takes a snapshot immediately and then has to be monitored for the rest
of its life, because a conflict can still develop. A deferrable read-only
transaction refuses to start reading until it can establish that no conflict which
would lead to an anomaly can still occur — the manual says a read-only transaction
"will often be able to establish that fact at startup and avoid taking any
predicate locks", and `DEFERRABLE` is the mode that makes it block until it can.
Once that is established the transaction needs no tracking and cannot be aborted,
which is exactly the trade a long report wants: pay the uncertainty up front
rather than an hour in.

**★ Why is the unique-violation caveat a codebase-wide rule rather than a
per-transaction one?**
Because the protocol only works if everyone follows it. Serializable can prevent
the *anomaly*, but a unique index still raises an error when two overlapping
transactions insert the same key, and the manual says this can happen "even after
explicitly checking that the key isn't present". The avoidance the manual
describes is that **all** Serializable transactions inserting potentially
conflicting keys check first. If one batch importer or one admin script inserts
directly, every careful transaction elsewhere can still be hit. So it belongs on a
review checklist for the table, not in a comment on one method.

**★ Should a read-only reporting transaction use Repeatable Read or Serializable
read-only deferrable?**
Repeatable Read is the simpler answer and is often right: it gives the whole
transaction one snapshot, and the manual says read-only transactions never have
serialization conflicts at that level, so there is no retry path to build. Choose
`SERIALIZABLE READ ONLY DEFERRABLE` when the report's *conclusions* have to be
consistent with some serial execution — the manual's own warning is that even a
read-only Repeatable Read transaction can observe a control record marked complete
while missing a detail row of that batch. The cost of the stronger choice is the
initial wait, and both choices share the bigger operational cost: a long
transaction pins a snapshot and holds back vacuum for the whole database.

---

← Prev: [7b · Living with Serializable](07b-making-serializable-perform.md) · Index: [Transactions at the JDBC level](README.md) · Next → [8 · Setting the level](08-setting-the-level-from-java.md)
