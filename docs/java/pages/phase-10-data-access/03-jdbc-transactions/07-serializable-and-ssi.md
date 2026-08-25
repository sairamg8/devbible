---
title: "SERIALIZABLE catches the anomaly nobody can see from inside a single transaction, by watching for dependency cycles instead of locking"
sidebar_label: "7 · Serializable and SSI"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.3 *Serializable
> Isolation Level*, including the `mytab` example and the predicate-locking
> paragraphs
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Serializable is Repeatable Read plus a detective. The manual: *"this isolation
level works exactly the same as Repeatable Read except that it also monitors for
conditions which could make execution of a concurrent set of serializable
transactions behave in a manner inconsistent with all possible serial (one at a
time) executions"*. The monitoring is called Serializable Snapshot Isolation, SSI,
and its defining property is that it **does not block**. It takes predicate locks
that no transaction ever waits on, watches for read/write dependency cycles among
concurrent transactions, and when it finds one it aborts a participant with
`40001` and the message `could not serialize access due to read/write dependencies
among transactions`. You cannot predict which transaction loses by reading its
code, because the conflict is a property of the *group*. So a retry loop is not a
recommendation at this level. It is part of the level.**

## The anomaly, using the manual's own table

`mytab` contains:

```
 class | value
-------+-------
     1 |    10
     1 |    20
     2 |   100
     2 |   200
```

Transaction A computes `SELECT SUM(value) FROM mytab WHERE class = 1` — it gets
30 — and inserts a new row with `value = 30, class = 2`.

Concurrently, transaction B computes `SELECT SUM(value) FROM mytab WHERE class = 2`
— it gets 300 — and inserts a new row with `value = 300, class = 1`.

Now ask what a *serial* execution would have produced.

| Order | A sees | B sees |
|---|---|---|
| A then B | class 1 sums to 30 | class 2 now contains A's row, so B sums to **330** |
| B then A | class 1 now contains B's row, so A sums to **330** | class 2 sums to 300 |
| concurrent | 30 | 300 |

🔴 **The concurrent result (30 and 300) matches neither ordering.** Every read was
of committed data. Neither transaction touched a row the other wrote — they wrote
into each other's *search conditions*, not each other's rows. So there is no row
conflict to detect, no lock that would have been contended, and nothing at all for
Repeatable Read to object to. The manual is explicit: *"if either transaction were
running at the Repeatable Read isolation level, both would be allowed to commit"*.

At Serializable, one of them is rolled back with:

```
ERROR:  could not serialize access due to read/write dependencies among transactions
```

**This is what "serialization anomaly" means in practice, and it is the only
phenomenon Serializable adds protection against on PostgreSQL.** Dirty reads,
nonrepeatable reads and phantoms are already gone at Repeatable Read
([chunk 6](06-repeatable-read.md)).

## Why "write skew" is the shape to memorise

The `mytab` example is abstract. The same shape in production looks like this:

```java
// ⚠️ both transactions check a condition, both find it satisfied, both act.
// At Repeatable Read this commits and violates the rule.
int onCall = countDoctorsOnCall(c, shiftId);   // reads the SET of on-call doctors
if (onCall > 1) {
    setOffCall(c, myDoctorId);                 // writes ONE row in that set
}
c.commit();
```

Two doctors go off call simultaneously. Each reads "2 doctors on call", each
concludes it is safe, each writes a different row. Zero doctors are on call and
the invariant — *at least one doctor on call* — was never violated by either
transaction considered alone.

**Each transaction read a set and then wrote into a set the other read.** No row
was written by both, so there is no lost update and no row-level conflict. That is
write skew, and it is the canonical reason to reach for Serializable.

⚠️ **Notice what would not have helped.** `SELECT ... FOR UPDATE` locks the rows
you read, but each transaction wrote a *different* row, so the locks never
collide. A unique constraint has nothing to be unique on. The invariant is over a
count, and only something that watches the *condition* can catch it.

## Predicate locks, and why they never block

To detect this, PostgreSQL has to know what each transaction *read*, not just what
it wrote. The manual:

> To guarantee true serializability PostgreSQL uses **predicate locking**, which
> means that it keeps locks which allow it to determine when a write would have had
> an impact on the result of a previous read from a concurrent transaction, had it
> run first. In PostgreSQL these locks do not cause any blocking and therefore can
> **not** play any part in causing a deadlock.

Three consequences worth separating out.

**They are not really locks.** Nothing waits on them. They are a record of "this
transaction read this thing", used afterwards to spot a cycle. Calling them locks
is a historical accident of the literature, and it misleads people into expecting
blocking.

**They are visible.** They appear in `pg_locks` with a `mode` of `SIReadLock`, so
an operator can see what a Serializable transaction has been reading.

**They are based on what you actually accessed, and their granularity depends on
the plan.** The manual: *"The particular locks acquired during execution of a
query will depend on the plan used by the query, and multiple finer-grained locks
(e.g., tuple locks) may be combined into fewer coarser-grained locks (e.g., page
locks) during the course of the transaction to prevent exhaustion of the memory
used to track the locks."*

🔴 **That last sentence is a performance cliff hiding in an aside.** Coarser locks
mean more apparent conflicts, which means more aborts — from a query plan change,
not from a code change. It is why "the same code suddenly started failing at
`40001` after the table grew" is a real and confusing incident, and it is handled
in [chunk 7b](07b-making-serializable-perform.md).

## `40001` again, and why the message matters even though you must not match on it

Serialization failures — the manual says it flatly — *"always return with an
SQLSTATE value of `'40001'`"*. Same code as the Repeatable Read write conflict,
class 40, `serialization_failure`.

```java
catch (SQLException e) {
    if ("40001".equals(e.getSQLState())) {
        // retry the WHOLE transaction. Same handling at RR and at SER.
    }
}
```

Match on the SQLSTATE. But **read** the message when you are diagnosing, because
the two causes are genuinely different problems:

| Message | Cause | Usual fix |
|---|---|---|
| `could not serialize access due to concurrent update` | you wrote a row somebody else already changed | retry; consider a single statement or a row lock |
| `could not serialize access due to read/write dependencies among transactions` | SSI found a dependency cycle among a group | retry; the shape is write skew, and there is often no per-row fix |

The first tells you two transactions fought over a row. The second tells you
several transactions collectively did something impossible, and there may be **no
pair** you can point at.

## Gotchas
**⚠️ Expecting Serializable to block instead of abort**
**Symptom:** a design review concludes Serializable will "serialize the traffic"
and queue requests behind each other, and it is rejected without measurement.
**Cause:** the name, and intuition from lock-based engines. SSI's predicate locks
never block anything.
**Fix:** the cost model is aborts and tracking overhead, not waiting. The question
to ask is "do we have a generalized retry path?", not "will this queue?".

**⚠️ Looking for the conflicting pair after a read/write dependency failure**
**Symptom:** an engineer reads the aborted transaction's code, finds nothing that
touches a row another transaction writes, and concludes the error is spurious.
**Cause:** the conflict is a cycle among a *group*, formed through read sets, not
through shared rows. Neither transaction need touch a row the other wrote.
**Fix:** look for the write-skew shape — a transaction that reads a set to make a
decision and then writes into a set another transaction read.

**⚠️ Adding `SELECT ... FOR UPDATE` to fix a write skew**
**Symptom:** row locks are added, the aborts continue, and concurrency drops.
**Cause:** the two transactions write different rows, so their row locks never
meet. The shared thing is the *condition*, which only predicate locking covers.
**Fix:** either let Serializable do its job and retry, or lock something both
transactions must take — the parent row, an advisory lock — which is a
deliberate serialisation, not a free fix.

**⚠️ Assuming old code that says `SERIALIZABLE` wanted this**
**Symptom:** a migration forward produces read/write dependency aborts in code that
never had a retry loop.
**Cause:** before PostgreSQL 9.1 the `SERIALIZABLE` keyword gave what is now
Repeatable Read. SSI arrived in 9.1 and the keyword's meaning changed under the
same spelling.
**Fix:** decide deliberately. The manual's advice for legacy behaviour is to
request Repeatable Read explicitly.

## Interview questions
**★ What does SERIALIZABLE add over REPEATABLE READ on PostgreSQL?**
Exactly one thing: protection from serialization anomalies. Dirty reads,
nonrepeatable reads and phantoms are all already prevented at Repeatable Read on
this engine. The manual says Serializable "works exactly the same as Repeatable
Read except that it also monitors for conditions which could make execution of a
concurrent set of serializable transactions behave in a manner inconsistent with
all possible serial executions". So it is the same snapshot behaviour plus
detection of read/write dependency cycles, and the same `40001` SQLSTATE with a
different message when one is found.

**★ Explain write skew.**
Two transactions each read a set of rows, each makes a decision based on what it
read, and each writes a different row. Neither writes a row the other wrote, so
there is no lost update and no row-level conflict to detect — but their combined
effect violates an invariant that neither one violated by itself. The standard
example is a rule that at least one doctor must be on call: two doctors each read
"two on call", each conclude it is safe to go off call, and both write. Zero
doctors are on call. Row locks do not help because the rows written are different;
what is shared is the *condition*, which is why it takes predicate locking to
catch.

**★ What is SSI and what is a predicate lock?**
Serializable Snapshot Isolation — snapshot isolation plus checks for serialization
anomalies. To perform those checks the server has to know what each transaction
read, so it takes predicate locks, which the manual describes as locks that "allow
it to determine when a write would have had an impact on the result of a previous
read from a concurrent transaction, had it run first". The critical property is
that they do not block: nothing waits on them, and the manual says they "can *not*
play any part in causing a deadlock". They show in `pg_locks` with mode
`SIReadLock`. Their granularity follows the query plan, and finer-grained locks
can be promoted to coarser ones when the tracking memory runs short, which
increases the false-conflict rate.

**★ Why does the same SQLSTATE 40001 appear at both Repeatable Read and
Serializable?**
Because both are serialization failures, and the manual states that serialization
failures "always return with an SQLSTATE value of '40001'". The handling is
identical — roll back and retry the whole transaction — which is exactly why one
code covers both. The messages differ and are worth reading during diagnosis:
"could not serialize access due to concurrent update" means you wrote a row
somebody else had changed, and "could not serialize access due to read/write
dependencies among transactions" means SSI found a cycle. Never match on those
strings in code; they are translated and uncontracted.

**★ Why can't you predict which transaction will be aborted?**
Because the conflict is a property of the group, not of any transaction. SSI
detects a cycle in the read/write dependencies among concurrent transactions, and
which participant it cancels depends on the interleaving, the plans, and the
granularity of the predicate locks in play. The manual says as much when it
insists on a "generalized way of handling serialization failures ... because it
will be very hard to predict exactly which transactions might contribute to the
read/write dependencies and need to be rolled back". The practical consequence is
architectural: the retry must live at one boundary that every transaction passes
through, because you cannot know in advance which call sites need it.

---

← Prev: [6b · What RR does not fix](06b-what-repeatable-read-still-cannot-promise.md) · Index: [Transactions at the JDBC level](README.md) · Next → [7b · Living with Serializable](07b-making-serializable-perform.md)
