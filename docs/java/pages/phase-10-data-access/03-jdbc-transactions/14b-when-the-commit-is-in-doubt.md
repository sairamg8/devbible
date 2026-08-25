---
title: "If the connection dies during commit you cannot know whether it landed, and no retry policy can tell you"
sidebar_label: "14b · The commit in doubt"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Appendix A *Error Codes*, Class 08 and Class 40
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> the PostgreSQL 18 manual §13.5 *Serialization Failure Handling*
> ([postgresql.org/docs/18/mvcc-serialization-failure-handling.html](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)),
> and the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**[Chunk 14](14-retrying-safely.md) sorted errors into retryable and not. There is
a third category it deferred, and it is the one that keeps people up at night:
errors where the transaction's *outcome is unknown*. Your code sent `COMMIT`. The
connection died. Did the server receive it? Did it apply it? You have no way to
find out from the exception, because the channel that would have told you is the
one that broke. PostgreSQL has two SQLSTATEs whose entire purpose is to name this
condition — `08007 transaction_resolution_unknown` and `40003
statement_completion_unknown` — and the honest engineering answer is that no retry
policy resolves it. You either make the operation safe to repeat, or you build a
way to ask afterwards what happened.**

## Why the doubt is real

`commit()` is a request and a response. Four things can happen and only two of them
tell you anything:

| | Server received `COMMIT`? | Server applied it? | You learn |
|---|---|---|---|
| 1 | no | no | the exception — safe to retry |
| 2 | yes | no (it failed) | the error — safe to retry |
| 3 | yes | **yes** | ✅ normal return |
| 4 | yes | **yes** | 🔴 **nothing — the response never arrived** |

Row 4 is indistinguishable from rows 1 and 2 at the point where you catch the
exception. The work is committed and durable, and your Java believes it failed.

🔴 **Retrying in row 4 applies the work twice.** Not "possibly" — if the operation
is not idempotent, definitely. Two ledger entries, two charges, two emails queued.

⚠️ **This is not a PostgreSQL limitation.** It is a property of any request over an
unreliable channel, and it is why "exactly once" is a claim to distrust everywhere.
What PostgreSQL does contribute is honesty: it gives the condition its own error
codes rather than pretending the outcome is knowable.

## The two codes that name it

**`08007` — `transaction_resolution_unknown`**, in Class 08, Connection Exception.
The name is the definition. Something went wrong with the connection at a point
where the transaction's resolution — committed or rolled back — could not be
determined.

**`40003` — `statement_completion_unknown`**, in Class 40, Transaction Rollback.
This is the reason [chunk 14](14-retrying-safely.md)'s predicate excludes it
explicitly:

```java
// ✅ class 40 is retryable EXCEPT the one that means "I don't know"
static boolean isRetryable(SQLException e) {
    String s = e.getSQLState();
    return s != null && s.startsWith("40") && !"40003".equals(s);
}
```

A predicate of `startsWith("40")` alone quietly puts the in-doubt case on the
automatic retry path, which is the worst possible destination for it.

⚠️ **And the doubt is not limited to those two codes.** A plain `08006
connection_failure` raised *from the `commit()` call itself* is in exactly the same
position. **What creates the doubt is where in the transaction the failure
happened, not which code came back.** That is why the retry decision needs to know
whether the failure was before or during the commit — and a `catch` block placed
around the whole unit of work does not know.

## Making the position knowable

The first move costs nothing: separate the commit from everything else, so the
`catch` can tell which side of it you were on.

```java
boolean commitAttempted = false;
try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    try {
        doTheWork(c);
        commitAttempted = true;    // ← set immediately BEFORE the call
        c.commit();
    } catch (SQLException e) {
        if (commitAttempted) {
            throw new OutcomeUnknown(operationId, e);   // do NOT retry
        }
        c.rollback();
        throw e;                                        // safe to retry
    }
}
```

That does not tell you the outcome. It tells you **that you do not know it**, which
is a different and much more actionable thing: it lets the in-doubt case take a
different path from the ordinary retryable one.

⚠️ **`commitAttempted` must be set before the call, not after.** After is a value
that is only ever true when nothing went wrong.

## The two real fixes

### 1 · Make the transaction idempotent

If repeating the work is harmless, the doubt evaporates and you can retry freely.

An **idempotency key** is the general mechanism: the caller supplies a unique id for
the operation, the transaction records it, and a uniqueness constraint makes a
second attempt fail visibly instead of duplicating.

```java
// the key is written in the SAME transaction as the work
try (PreparedStatement ps = c.prepareStatement(
        "INSERT INTO processed_operations (operation_id) VALUES (?)")) {
    ps.setString(1, operationId);
    ps.executeUpdate();          // 23505 on a repeat → the work already happened
}
doTheWork(c);
c.commit();
```

🔴 **The key insert and the work must be in the same transaction**, or the guard can
commit without the work, or the work without the guard. That is the entire design:
the atomicity you already have is what makes the guard trustworthy.

Now a retry after an unknown outcome is safe. If the first attempt committed, the
retry gets `23505` on the key and you know the work was done. If it did not, the
retry succeeds.

⚠️ **Note the irony:** this is one of the few situations where a `23505` is *good
news*, and it is not the manual's narrow "derived key" exception from
[chunk 14](14-retrying-safely.md). It is a deliberate signal you built, on a table
you control, and it is checked by shape rather than by a blanket retry rule.

### 2 · Make the outcome discoverable

If the operation cannot be made idempotent, the alternative is to be able to ask
later whether it happened.

- **Write a record of the operation inside the transaction** — a status row keyed by
  the operation id. After an unknown outcome, a query for that id answers the
  question definitively, because the record is atomic with the work.
- **Reconcile.** A background process finds operations in an unknown state and
  resolves them against the record.
- **Never resolve it by guessing.** "It probably failed, retry it" is a policy that
  is wrong some fraction of the time, and that fraction is duplicate financial
  transactions.

## The trade-off

| You gain | You pay |
|---|---|
| Retries become safe rather than hopeful | an idempotency key table, and a column on every request |
| The in-doubt case is separated from the retryable one | a second error path callers must understand |
| Side effects survive rollbacks and retries correctly ([chunk 15](15-where-the-boundary-belongs.md)) | an outbox, plus a process to drain it |
| A definitive answer to "did it happen?" | a status record written in every transaction |

## Gotchas

**⚠️ Retrying on the same `Connection`**
**Symptom:** the retry throws a connection error rather than re-running the work.
**Cause:** if the failure was class 08 the connection is dead, and even after
`40001` the connection is mid-abort until it is cleaned up.
**Fix:** acquire the connection inside the loop, so each attempt gets a healthy one
from the pool.

**⚠️ A retry predicate of `startsWith("40")` with no exclusion**
**Symptom:** an operation is applied twice after a network blip, with no error
anywhere.
**Cause:** `40003` is `statement_completion_unknown` and sits in the same class as
the two codes you do want to retry.
**Fix:** exclude it explicitly, and route it to the in-doubt path.

**⚠️ Setting the "commit attempted" flag after the commit**
**Symptom:** the in-doubt branch never runs.
**Cause:** the flag is only reached when `commit()` returned normally, which is
exactly the case that has no doubt.
**Fix:** set it on the line immediately before the call.

**⚠️ Writing the idempotency key in a separate transaction**
**Symptom:** duplicate work despite a key table, or work that is permanently blocked
by a key recorded for an attempt that failed.
**Cause:** two transactions can succeed or fail independently, so the guard and the
work are no longer atomic with each other.
**Fix:** one transaction. The key insert and the work commit together or not at all.

**⚠️ Swallowing the exhausted-retries case**
**Symptom:** a request returns 200 having done nothing.
**Cause:** the loop ends by falling out rather than by throwing.
**Fix:** the manual is explicit that retries may not succeed. Exhaustion is a
failure and must propagate.

**⚠️ Treating "unknown" as "failed" in the API response**
**Symptom:** a caller is told the operation failed, retries it themselves, and it is
applied twice.
**Cause:** the in-doubt case was collapsed into the failure case at the boundary.
**Fix:** either resolve it before responding — query the operation record — or
respond in a way that makes the caller's retry safe, which is the idempotency key
again, now supplied by them.

## Interview questions

**★ Your `commit()` throws a connection error. Did the transaction commit?**
You do not know, and nothing in the exception can tell you. The commit request may
never have reached the server, may have reached it and failed, or may have reached
it and succeeded with only the response lost. The first two are safe to retry; the
third is not, and all three look identical from the `catch` block. PostgreSQL names
the condition rather than pretending otherwise — `08007` is literally
`transaction_resolution_unknown` and `40003` is `statement_completion_unknown`. The
resolution is not a better retry policy; it is either making the transaction
idempotent so repeating it is harmless, or recording enough inside the transaction
that you can ask afterwards what happened.

**★ How does an idempotency key work, and what makes it correct?**
The caller supplies a unique id for the operation and the transaction inserts it
into a table with a unique constraint, in the same transaction as the actual work.
If a second attempt runs, the insert fails with `23505` and that failure is the
proof that the first attempt committed — because the key could only be present if
the transaction that wrote it committed, and that transaction also contained the
work. The correctness rests entirely on that atomicity: split the key insert into
its own transaction and the guarantee collapses, because the guard can commit
without the work or the work without the guard. It is also the rare case where a
unique violation is good news, and it is recognised by shape — an insert into a
table you control — not by a blanket rule that `23505` is retryable.

**★ How would you respond to an HTTP caller when the outcome is unknown?**
Not with a plain failure, because the caller will retry and may duplicate the work.
There are two defensible answers. Resolve it before responding: if the transaction
wrote a status record keyed by the operation id, query for that id on a fresh
connection and turn the unknown into a known. Or make the caller's retry safe by
requiring them to supply an idempotency key, so a repeat of the same request is
recognised and returns the original outcome rather than doing the work again. What
you must not do is guess. "It probably failed" is a policy that is wrong some
fraction of the time, and in a payments or ledger system that fraction is duplicated
money.

---

← Prev: [14 · What to retry](14-retrying-safely.md) · Index: [Transactions at the JDBC level](README.md) · Next → [15 · Where the boundary belongs](15-where-the-boundary-belongs.md)
