---
title: "The SQLSTATE class decides whether a retry is correct, and only class 40 is a yes without conditions"
sidebar_label: "14 · What to retry"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.5 *Serialization Failure
> Handling*
> ([postgresql.org/docs/18/mvcc-serialization-failure-handling.html](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)),
> §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Every level above Read Committed hands you failures that are *expected* — `40001`
from a write conflict, `40P01` from a deadlock — and the only correct response is
to run the whole transaction again. The trap is generalising from that. A retry
predicate written as "is this a database error?" will retry a constraint violation
forever, retry a timeout by doing the slow thing again, and retry a programming
mistake until the attempt cap saves you. The appendix gives the discriminator for
free: *"the first two characters of an error code denote a class of errors."*
**Class 40 is retryable. Class 23 is a fact about your data. Class 25 is a bug in
your code. Class 08 is the hard one, because the transaction may have committed.**
The generic loop — fresh connection inside the loop, capped attempts, jittered
backoff — is [retrying and translating](../01-jdbc/21e-retrying-and-translating.md)
in topic 01. This page is about the predicate that loop asks.**

## The classes, and the verdict on each

| Class | Name | Examples | Retry? |
|---|---|---|---|
| **40** | Transaction Rollback | `40001` serialization_failure · `40P01` deadlock_detected | ✅ **yes** |
| **40** | — | `40003` statement_completion_unknown | ⚠️ **in doubt** — [chunk 14b](14b-when-the-commit-is-in-doubt.md) |
| **23** | Integrity Constraint Violation | `23505` unique_violation · `23503` foreign_key_violation · `23502` not_null_violation · `23514` check_violation | ❌ **no** — with one narrow exception |
| **25** | Invalid Transaction State | `25P02` in_failed_sql_transaction · `25P01` no_active_sql_transaction · `25006` read_only_sql_transaction | ❌ **never** — these are code bugs |
| **08** | Connection Exception | `08006` connection_failure · `08003` connection_does_not_exist | ⚠️ **only if idempotent or guarded** |
| **08** | — | `08007` transaction_resolution_unknown | ⚠️ **in doubt** — [chunk 14b](14b-when-the-commit-is-in-doubt.md) |
| **55** | Object Not In Prerequisite State | `55P03` lock_not_available (`NOWAIT`) | ❌ not automatically |
| **57** | Operator Intervention | `57014` query_canceled · `57P01` admin_shutdown | ⚠️ rarely, and never blindly |
| **3B** | Savepoint Exception | `3B001` invalid_savepoint_specification | ❌ never — a code bug |

## Class 40: the yes

The manual could not be clearer: *"while it's recommendable to just retry
`serialization_failure` errors unconditionally, more care is needed when retrying
these other error codes, since they might represent persistent error conditions
rather than transient failures."*

**Unconditionally.** No inspection of the message, no heuristics, no attempt to
work out whether this particular conflict will recur. `40001` means the server
detected a conflict your transaction could not be allowed to resolve, and a fresh
attempt against a fresh snapshot usually has no conflict at all
([chunk 6](06-repeatable-read.md)).

`40P01` is second on the manual's list — *"it may also be advisable to retry
deadlock failures"* — and the retry usually succeeds because the transaction that
beat you has finished. But a rising deadlock rate is a lock-ordering bug, not a
retry-budget problem ([chunk 13](13-deadlocks-and-timeouts.md)).

```java
static boolean isRetryable(SQLException e) {
    String s = e.getSQLState();
    return s != null && s.startsWith("40") && !"40003".equals(s);
}
```

🔴 **Test the class prefix, never the message.** The two causes of `40001` have
completely different message text ([chunk 7](07-serializable-and-ssi.md)), messages
are translated, and none of them is contractual.

## Class 23: a fact, not a failure

A `23505` means a row with that key already exists. Running the same transaction
again will find it still exists. Retrying a constraint violation is a loop that
burns your attempt budget and then reports the same error later, with less
information about when it started.

The manual carves out exactly one exception and describes it narrowly: a
`23505` or `23P01` *may* be worth retrying when *"the application selects a new
value for a primary key column after inspecting the currently stored keys"* and a
concurrent instance chose the same value — *"this is effectively a serialization
failure"* that the server could not detect as one, because it cannot connect the
inserted value to the earlier reads.

⚠️ **That exception applies to a specific shape: read the keys, derive a new one,
insert it.** If your keys come from a sequence, a UUID, or the user, it does not
apply, and the violation is exactly what it says. Do not widen it into "we retry
`23505`".

The manual attaches the warning itself, and it is the sentence to remember:
*"more care is needed when retrying these other error codes, since they might
represent persistent error conditions rather than transient failures."*

## Class 25: never

`25P02` in a retry predicate is the tell that something is very wrong. It means the
transaction was already aborted when the statement ran, so the error you are
retrying is not the error that happened
([chunk 10](10-the-aborted-transaction.md)). Retrying it re-runs a statement into
the same dead transaction.

`25P01` ("no active transaction"), `25006` ("read-only transaction") and `25001`
("in the middle of a transaction") are all statements about your code doing
something in the wrong order. No amount of repetition changes the order.

## Class 08: retry only what you can prove is safe

A connection failure means the statement may or may not have reached the server,
and if it did, it may or may not have taken effect. There are three cases and only
one of them is comfortable:

| When it failed | Safe to retry? |
|---|---|
| While acquiring the connection (`08001`, `08004`) | ✅ yes — nothing was sent |
| Mid-transaction, before `commit()` | ✅ yes — the server rolls back an abandoned transaction |
| **During or after `commit()`** | 🔴 **unknown** — see [chunk 14b](14b-when-the-commit-is-in-doubt.md) |

The middle row is safe for a specific reason: a transaction whose connection dies
before commit is never committed. The server discards it. So retrying the whole
unit of work from the start cannot double-apply anything.

⚠️ **The `08007` code exists precisely to name the third case**, and it is called
`transaction_resolution_unknown` for a reason.

## Class 57 and 55: read what actually happened

`57014`, `query_canceled`, is what a `statement_timeout` or a
`Statement.cancel()` produces. Retrying it means running the same slow statement
again, against a system that was already too busy to finish it — which is how a
retry loop turns a slow query into an outage.

`55P03`, `lock_not_available`, comes from `NOWAIT`
([chunk 12b](12b-nowait-skip-locked-and-scope.md)). Somebody holds the lock *right
now*; an immediate retry asks the identical question. If a retry is right at all it
is on a human timescale, and usually the right answer is to tell the caller the
record is busy.

`57P01`, `admin_shutdown`, means the server is going away. A retry belongs at the
connection level with a backoff, not inside a transaction loop.

## 🔴 The scope of a retry is the whole transaction

The manual states this and then states the consequence, and both halves matter:

> It is important to retry the complete transaction, including all logic that
> decides which SQL to issue and/or which values to use. Therefore, PostgreSQL does
> not offer an automatic retry facility, since it cannot do so with any guarantee
> of correctness.

**No layer below your application can do this for you.** The database cannot,
because the decisions live in your Java. A driver cannot, for the same reason. Any
component that replays a *statement* rather than a *unit of work* is producing an
outcome nobody specified.

So the retried block must contain the reads as well as the writes:

```java
// ❌ the reads are outside — the retry writes values derived from the stale snapshot
var input = readInputs(c);
retry(() -> applyAndCommit(c, input));

// ✅ everything the decision depends on is inside the retried block
retry(() -> {
    try (Connection c = ds.getConnection()) {     // fresh connection each attempt
        c.setAutoCommit(false);
        var input = readInputs(c);                // re-read under a NEW snapshot
        applyBusinessRules(c, input);
        c.commit();
    }
});
```

⚠️ A retry that reuses the old read has not retried anything meaningful. At
Repeatable Read the whole point is that the second attempt sees a *new* snapshot
including the change that caused the conflict — the manual's words: *"the second
time through, the transaction will see the previously-committed change as part of
its initial view of the database, so there is no logical conflict."*

## And it is not guaranteed to work

> Transaction retry does not guarantee that the retried transaction will complete;
> multiple retries may be needed. In cases with very high contention, it is possible
> that completion of a transaction may take many attempts.

Which is why the loop has a cap, and why exhausting the cap must be a real failure
that reaches the caller — not a silent success and not a swallowed exception.

## Gotchas

**⚠️ A retry predicate of "is it a `SQLException`?"**
**Symptom:** constraint violations retried three times before failing, timeouts
retried into a heavier outage, and a code bug retried until the cap.
**Cause:** the predicate does not distinguish transient from persistent.
**Fix:** switch on the SQLSTATE class. Class 40 yes; everything else needs an
argument.

**⚠️ Matching on the error message**
**Symptom:** retry logic that stops working after a server upgrade or on a
non-English locale.
**Cause:** messages are translated and uncontracted, and `40001` has two entirely
different ones.
**Fix:** `getSQLState()`, and compare the two-character class prefix.

**⚠️ Retrying `23505` as a matter of policy**
**Symptom:** an insert that will never succeed is attempted repeatedly, and the
eventual error is reported far from where it started.
**Cause:** the manual's exception was read as a general rule. It applies only when
the application derived the key by inspecting existing keys.
**Fix:** retry `23505` only in that specific shape, and treat every other unique
violation as the durable fact it is.

**⚠️ Retrying a statement instead of the transaction**
**Symptom:** the retry fails immediately with `25P02`.
**Cause:** after any error the transaction is aborted, so the statement cannot run
in it.
**Fix:** roll back, take a fresh connection, and re-run the whole unit of work
including the reads.

**⚠️ Reusing values read before the retry**
**Symptom:** a retry loop that appears to work and keeps producing the same
conflict, or writes stale values successfully.
**Cause:** the reads were outside the retried block, so the new attempt writes
conclusions drawn from the old snapshot.
**Fix:** put every read and every decision inside the block.

**⚠️ Retrying without jitter after a deadlock**
**Symptom:** two transactions deadlock, both retry after the same fixed delay, and
deadlock again in the same order.
**Cause:** synchronised retries reproduce the interleaving that caused the problem.
**Fix:** randomised backoff, so the participants separate.

## Interview questions

**★ Which SQLSTATEs should a transaction retry, and which must it not?**
Class 40 — Transaction Rollback — is the yes. The manual says it is "recommendable
to just retry `serialization_failure` errors unconditionally", and that it "may also
be advisable to retry deadlock failures", so `40001` and `40P01` are the two you
retry without argument. Class 23 is a no in almost every case: a unique or foreign
key violation is a durable fact about the data, and running the same transaction
again finds the same fact. Class 25 is never — those are ordering bugs in your own
code. Class 08 depends on when the connection died, and if it died during the commit
you do not know whether the work landed. Classes 55 and 57 are usually a no:
retrying a `NOWAIT` failure asks the same question of the same lock holder, and
retrying a cancelled query means running the slow thing again.

**★ What is the one case where retrying a unique violation is defensible?**
When the application picked the key by looking at what was already there — the
manual's example is selecting the maximum existing key and adding one, or checking
that a user-supplied key is absent before inserting it. Two instances doing that
concurrently can both choose the same value, and the resulting `23505` is, in the
manual's words, "effectively a serialization failure" that the server could not
identify as one because it cannot connect the inserted value to the earlier reads.
Outside that shape — a sequence, a UUID, a key the caller supplied — the violation
means what it says, and the manual attaches its own warning that these codes "might
represent persistent error conditions rather than transient failures".

**★ Why must you retry the whole transaction rather than the failed statement?**
Two reasons, one mechanical and one logical. Mechanically, the transaction is
aborted after any error, so the statement simply will not run — you get `25P02`
instead. Logically, the manual says it is important to retry "the complete
transaction, including all logic that decides which SQL to issue and/or which values
to use", because the values you were about to write were derived from reads that the
conflict has invalidated. A second attempt has to re-read under a new snapshot; at
Repeatable Read that is precisely what removes the conflict, because the new snapshot
includes the change that caused it. The manual draws the conclusion itself:
PostgreSQL offers no automatic retry facility, "since it cannot do so with any
guarantee of correctness".

**★ Is a retry guaranteed to succeed?**
No, and the manual says so: "transaction retry does not guarantee that the retried
transaction will complete; multiple retries may be needed. In cases with very high
contention, it is possible that completion of a transaction may take many attempts."
That has two design consequences. The loop needs a cap, so a permanently contended
transaction does not spin forever and consume a connection while doing it. And
exhausting the cap has to be a real failure that reaches the caller — a loop that
falls out silently reports success for work that never happened, which is worse than
the original error.

**★ Why does backoff need jitter?**
Because deadlocks and serialization conflicts are caused by interleaving, and a
fixed delay preserves the interleaving. Two transactions that deadlocked started at
roughly the same time; if both wait exactly 50ms and retry, they start at roughly
the same time again and can deadlock in exactly the same way. Randomising the delay
separates them, so one gets through and the other finds the locks free. The same
argument applies at scale to `40001` under load: synchronised retries produce a
thundering herd that keeps the contention high, which is the condition the manual
warns can make a transaction take many attempts.

---

← Prev: [13b · Which clock, and how to tell](13b-the-four-clocks.md) · Index: [Transactions at the JDBC level](README.md) · Next → [14b · The commit in doubt](14b-when-the-commit-is-in-doubt.md)
