---
title: "Start from the SQLSTATE, not from the stack trace — a debugging order for transaction problems, and a checklist to apply before they happen"
sidebar_label: "15b · Checklist and debugging order"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> §27.2.3 *pg_stat_activity*
> ([postgresql.org/docs/18/monitoring-stats.html](https://www.postgresql.org/docs/18/monitoring-stats.html)),
> and §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Transaction bugs are diagnosed badly because the obvious evidence is usually the
wrong evidence. The loudest error is often a consequence (`25P02`). The statement in
the log is often innocent. A blocked query and a slow query look identical from
Java. And the worst failure of all — a lost update — produces no error at all. This
chunk is the order to work in, and the checklist that stops most of it happening.**

## The debugging order

**1 · Get the SQLSTATE.** Not the message, not the exception class. `getSQLState()`
is the only stable identifier, and its first two characters name the class
([chunk 14](14-retrying-safely.md)). If your logging does not print it, fix that
first — everything below depends on it.

**2 · If it is `25P02`, the error you have is not the error you want.** The
transaction was already aborted. Search backwards in the log for the first error in
that transaction with a different SQLSTATE ([chunk 10](10-the-aborted-transaction.md)).
Do not read the statement named in the `25P02`; it was never even parsed.

**3 · Classify it.**

| SQLSTATE | Meaning | Go to |
|---|---|---|
| `40001` | serialization failure — read the *message* to tell the two causes apart | [6](06-repeatable-read.md) · [7](07-serializable-and-ssi.md) |
| `40P01` | deadlock — a lock-ordering bug | [13](13-deadlocks-and-timeouts.md) |
| `40003`, `08007` | **outcome unknown** — do not retry blindly | [14b](14b-when-the-commit-is-in-doubt.md) |
| `25P02` | consequence of an earlier error | [10](10-the-aborted-transaction.md) |
| `25P01` | commit/rollback with autocommit on — two owners of one boundary | [2](02-commit-rollback-and-the-shape-that-survives.md) |
| `25001` | isolation level or read-only changed mid-transaction | [8](08-setting-the-level-from-java.md) · [11](11-read-only-transactions.md) |
| `25006` | write in a read-only transaction — often a leaked session setting | [11](11-read-only-transactions.md) · [8b](08b-the-level-and-the-pool.md) |
| `25P03`, `25P04` | a session-terminating timeout fired | [13b](13b-the-four-clocks.md) |
| `55P03` | `NOWAIT` could not get the lock | [12b](12b-nowait-skip-locked-and-scope.md) |
| `23505` | a real constraint violation — almost never retryable | [14](14-retrying-safely.md) |
| `3B001` | savepoint no longer valid | [9](09-savepoints.md) |

**4 · If there is no error at all, look for the shape.** A lost update, a missed
row and a stale read are all successful operations. Grep for a `SELECT` whose result
is computed on and written back ([chunk 5](05-read-committed-in-practice.md)), and
for a set-based `UPDATE`/`DELETE` whose count is being trusted
([chunk 5b](05b-when-re-evaluation-surprises-you.md)).

**5 · If it is slow rather than wrong, go to `pg_stat_activity`.** `state` and
`wait_event_type` separate four different problems in one query, and the one people
miss is `active` + `wait_event_type = 'Lock'`, which is *not* a slow query
([chunk 13b](13b-the-four-clocks.md)).

**6 · Only then look at the query plan.** An optimisation pass on a statement that
is blocked, or on a statement whose transaction is fine and whose *boundary* is
wrong, is time spent on the wrong thing.

## The symptom index

| Symptom | Most likely cause | Chunk |
|---|---|---|
| Money/stock/counters drift with no errors | read-modify-write across two statements | [5](05-read-committed-in-practice.md) |
| Two reads in one transaction disagree | per-statement snapshots at Read Committed | [5b](05b-when-re-evaluation-surprises-you.md) |
| A `DELETE` misses rows that match | re-evaluation against a moving set | [5b](05b-when-re-evaluation-surprises-you.md) |
| `40001` under load | expected at RR/SER — check the retry path exists | [6](06-repeatable-read.md) · [14](14-retrying-safely.md) |
| `40001` rate rose with no code change | a plan flipped to a sequential scan, or predicate-lock promotion | [7b](07b-making-serializable-perform.md) |
| Hundreds of identical "transaction is aborted" | one real error plus a catch-and-continue loop | [10](10-the-aborted-transaction.md) |
| An unrelated endpoint suddenly at `40001` or `25006` | session state leaked through the pool via raw SQL | [8b](08b-the-level-and-the-pool.md) · [11](11-read-only-transactions.md) |
| Sessions `idle in transaction` | non-database work inside the boundary, or a missing commit | [15](15-where-the-boundary-belongs.md) |
| Table bloat, vacuum falling behind | a long transaction pinning a snapshot | [6b](06b-what-repeatable-read-still-cannot-promise.md) |
| Requests hang and never time out | an unbounded lock wait with no `lock_timeout` | [13](13-deadlocks-and-timeouts.md) |
| Deadlocks in code with no explicit locks | `UPDATE`/`DELETE` take row locks; the order differs | [13](13-deadlocks-and-timeouts.md) |
| Workers competing over the same jobs | a queue claim without `SKIP LOCKED` | [12b](12b-nowait-skip-locked-and-scope.md) |
| An operation applied twice after a network blip | a retry over an in-doubt commit | [14b](14b-when-the-commit-is-in-doubt.md) |

## The checklist

Run this over a service before it has a problem. Each line is a question with a
right answer.

**Boundaries**

- [ ] Does any transaction contain an HTTP call, a message publish, an email, a file
      write or a `Thread.sleep`? → it must not.
- [ ] Is the boundary opened immediately before the first statement and committed
      immediately after the last?
- [ ] Does exactly one layer own the boundary, with repositories never touching
      transaction state?
- [ ] Is every transaction ended on every path — including early `return`s and
      exception paths?

**Correctness**

- [ ] Is every read-modify-write either a single statement, a `SELECT ... FOR
      UPDATE`, or running at a level where the conflict aborts?
- [ ] Is the update count checked wherever a statement carries a guard in its
      `WHERE` clause?
- [ ] Does any invariant span several rows or tables? → Read Committed is not enough.
- [ ] Does any transaction write more than one row without a defined ordering?
      → a deadlock waiting to happen.

**Failure handling**

- [ ] Is there a retry path, at **one** boundary, and is its predicate the SQLSTATE
      class rather than the message?
- [ ] Does the retried block include the reads and the decision logic, on a fresh
      connection each attempt?
- [ ] Does it exclude `40003` and route in-doubt outcomes somewhere else?
- [ ] Is the attempt cap enforced, and is exhaustion a failure that propagates?
- [ ] Is `rollback()` nested in its own `try` with `addSuppressed`?

**Configuration**

- [ ] Is the isolation level set per transaction rather than globally — and if a
      global default was raised, does every write path have a retry?
- [ ] Is any session state (`SET SESSION CHARACTERISTICS`, `search_path`,
      `statement_timeout`) set with raw SQL on a pooled connection?
- [ ] Are `lock_timeout`, `statement_timeout` and
      `idle_in_transaction_session_timeout` set, and is the pool validating
      connections on borrow so terminated sessions are discarded?
- [ ] Are long-running reports on a separate `DataSource`, declared read-only?

**Observability**

- [ ] Does every logged `SQLException` include `getSQLState()`?
- [ ] Is there an alert on `now() - xact_start`, not on `query_start`?
- [ ] Is the `40001` **rate** alerted on rather than each occurrence?

## Gotchas

**⚠️ Optimising the statement in the stack trace**
**Symptom:** days spent on a query that turns out to be fast.
**Cause:** the visible error was `25P02`, or the statement was blocked rather than
slow.
**Fix:** SQLSTATE first, `pg_stat_activity` second, query plan last.

**⚠️ Alerting on every `40001`**
**Symptom:** on-call fatigue, and eventually the alert being muted — including for
the day the rate really does spike.
**Cause:** at Repeatable Read and Serializable a serialization failure is normal
operation, not an incident.
**Fix:** alert on the rate and on retries exhausted.

**⚠️ Logging exceptions without the SQLSTATE**
**Symptom:** every transaction incident starts with an hour of guessing.
**Cause:** the log line has a message and a stack trace, and the one stable
identifier was dropped.
**Fix:** put `getSQLState()` in the log format for `SQLException`, everywhere.

**⚠️ Treating the checklist as a one-off**
**Symptom:** a service passes the review, and six months later an HTTP call has been
added inside a transaction.
**Cause:** the boundary rules are invariants of the codebase, not properties of a
release.
**Fix:** the questions that can be automated should be — a lint or an architecture
test that fails when a transactional method calls an HTTP client.

## Interview questions

**★ You get a production error. What is the first thing you look at?**
The SQLSTATE, from `getSQLState()`. Not the message, which is translated and
uncontracted, and not the exception class, which is coarse. The first two characters
name the class and that alone decides most of the response: class 40 is a retry,
class 23 is a fact about the data, class 25 is a bug in the code's ordering, class 08
may mean the outcome is unknown. The second thing is a specific check: if the code
is `25P02` then this error is a consequence and the real one is earlier in the same
transaction, so the search moves backwards rather than into the named statement.

**★ How do you investigate a transaction problem that produces no error?**
By looking for the shape rather than the symptom, because the failure modes that are
silent are all recognisable in code. A lost update is a `SELECT` whose result is
computed on and written back with anything in between. A miscounted sweep is a
set-based `UPDATE` or `DELETE` whose update count is being reported as
"rows that qualified". A stale comparison is two reads in one transaction being
subtracted from each other at Read Committed. None of these produces an exception —
the writes succeed — so grep is a better tool than the logs. In production you detect
the consequence instead: a ledger that does not reconcile, a counter lower than the
events that incremented it.

**★ A query has "got slow". Walk me through it.**
First check whether it is running or waiting, because from JDBC those are identical
and the fixes are opposite. In `pg_stat_activity`, `state = 'active'` with
`wait_event_type` NULL is genuinely executing and is a plan problem; `state =
'active'` with `wait_event_type = 'Lock'` is blocked, and `pg_blocking_pids()` names
the transaction actually responsible. If it is blocked, the problem is somebody
else's transaction being too long, and the query is innocent. Only once you know it
is executing does the plan become the right thing to look at — and even then, check
whether the transaction *boundary* around it is doing something it should not, like
waiting on an API call.

**★ What single change most often fixes a transaction problem?**
Making the transaction shorter — specifically, taking non-database work out of it.
Almost every operational symptom in this topic traces back to duration: lock
contention, `idle in transaction` sessions, pool exhaustion, table bloat, and a
raised abort rate at the higher isolation levels. And duration is usually
non-database work sitting inside the boundary: an HTTP call, a computation, a
serialisation step. Restructuring into read / act / record — with a guard on the
recording statement so it cannot double-apply — costs more code and fixes the
category rather than an instance.

**★ Which parts of your checklist would you automate?**
The ones with an objective answer. Whether a `@Transactional` or transaction-scoped
method calls an HTTP client, a mail sender or a message producer is an architecture
test that can fail a build. Whether `getSQLState()` appears in the logging format for
`SQLException` is a lint rule. Whether raw `SET SESSION CHARACTERISTICS` appears
anywhere in the codebase is a grep in CI. The judgement-heavy ones stay human: which
invariants need to be atomic, which isolation level a unit of work needs, and whether
a given read-modify-write is genuinely inexpressible as a single statement.

**★ How would you introduce Serializable to an existing service?**
Not by flipping `default_transaction_isolation`, which applies the new failure mode
to every transaction at once including the ones with no retry path. Build the retry
boundary first — one place, keyed on the SQLSTATE class, with a fresh connection per
attempt, a cap, jittered backoff, and no side effects inside the block. Then move
transactions to the level one unit of work at a time, declaring read-only ones
`READ ONLY` so they can often avoid predicate locks entirely. Watch the `40001` rate
as you go, and work the manual's checklist if it climbs: smaller transactions, fewer
active connections, index scans rather than sequential ones, and removing the
explicit locks the level has made redundant.

---

← Prev: [15 · Where the boundary belongs](15-where-the-boundary-belongs.md) · Index: [Transactions at the JDBC level](README.md)
