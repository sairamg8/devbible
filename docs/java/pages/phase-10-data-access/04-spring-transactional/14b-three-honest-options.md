---
title: "There are exactly three honest things to do when something fails inside a transactional method, and 'catch it and carry on' is not one of them"
sidebar_label: "14b · Three honest options"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> *Rolling back a declarative transaction*
> ([.../declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> the `TransactionAspectSupport` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> and the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**Something inside a transactional method failed and you do not want to simply
propagate it. There are three designs that are actually coherent. Pick one on
purpose — the fourth option, catching and continuing, is a silent decision to
commit half of a unit of work.**

## 1 · Let it throw

The default, and correct far more often than people expect. The unit of work
fails as a unit, the transaction rolls back, and the caller finds out.

```java
@Transactional
public void importBatch(List<Row> rows) {
    for (Row row : rows) {
        productRepository.save(Product.from(row));
        auditRepository.save(AuditEntry.imported(row.id()));
    }
}
```

If the exception is checked, make sure a rollback rule covers it — see
[13b · Changing the rule](13b-changing-the-rule.md). If you want a better message,
catch it, wrap it, and **rethrow**; the exception still escapes, so the rules
still apply. Be aware that the rules are evaluated on the type that actually
escapes, so wrapping a `RuntimeException` in a checked one under the default rule
converts a rollback into a commit.

## 2 · Catch it, and mark the transaction rollback-only

For when the caller needs a returned value rather than an exception — a report, a
result object, an HTTP body describing what went wrong.

```java
@Transactional
public ImportReport importBatch(List<Row> rows) {
    var report = new ImportReport();
    for (Row row : rows) {
        try {
            productRepository.save(Product.from(row));
            report.ok(row.id());
        } catch (DataAccessException ex) {
            report.failed(row.id(), ex.getMessage());
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        }
    }
    return report;      // returns a value; nothing is committed
}
```

The writes are undone; the caller still gets structure. The catch is that nothing
throws, so the caller *must* inspect the report — see the trade-off in
[14 · The caught exception](14-the-caught-exception.md).

## 3 · Give the failing part its own transaction

This is the only design where "skip the bad row and keep going" is correct, and
it requires the per-item work to run in a **separate physical transaction**. Two
shapes work, and one of them is much better than the other.

**Shape A — an outer method with no transaction, calling a transactional one.**

```java
@Service
class ImportService {

    private final RowImporter importer;      // a different bean

    ImportReport importBatch(List<Row> rows) {          // NOT @Transactional
        var report = new ImportReport();
        for (Row row : rows) {
            try {
                importer.importOne(row);                // its own transaction
                report.ok(row.id());
            } catch (RuntimeException ex) {
                report.failed(row.id(), ex.getMessage());
            }
        }
        return report;
    }
}

@Service
class RowImporter {
    @Transactional
    void importOne(Row row) {
        productRepository.save(Product.from(row));
        auditRepository.save(AuditEntry.imported(row.id()));
    }
}
```

Each row commits or rolls back on its own. The `catch` sits **outside** every
transactional boundary, which is why it is safe here and unsafe in the version at
the top of [14](14-the-caught-exception.md). One connection is in use at a time.
Note that `importer` is a *different bean* — calling `this.importOne(row)` would
be a self-invocation and no transaction would start at all.

**Shape B — a `REQUIRES_NEW` boundary inside an outer transaction.** Same
per-item independence, but the outer transaction stays open while each inner one
runs, and the propagation reference is blunt about the consequence:

> The resources attached to the outer transaction will remain bound there while
> the inner transaction acquires its own resources such as a new database
> connection. This may lead to exhaustion of the connection pool and potentially
> to a deadlock… Do not use `PROPAGATION_REQUIRES_NEW` unless your connection
> pool is appropriately sized, exceeding the number of concurrent threads by at
> least 1.

Prefer shape A. Reach for `REQUIRES_NEW` only when the outer transaction genuinely
must exist at the same time — the classic case being an audit record that has to
survive the outer rollback. Detail in **[10 · REQUIRES\_NEW](10-requires-new.md)**.

## What all three have in common

The `catch` is never between a write and the boundary that owns it. Either there is no
`catch` (option 1), or the `catch` explicitly tells the boundary to roll back (option 2),
or the `catch` is outside the boundary entirely (option 3). Any `catch` that sits inside
a boundary and does not mark it is a commit. `NESTED` is a fourth shape: a savepoint that
skips a failed step inside one atomic transaction ([14c](14c-what-the-database-did.md)).

## The trade-off

Per-item transactions buy independence and cost atomicity. After a partial
failure the database holds a genuinely partial batch — but a *deliberately*
partial one, with a report saying exactly which items are in it, rather than an
accidental one nobody can reconstruct. They also cost a transaction and a
connection round-trip per item, which for a large import is the dominant cost;
batching items into groups of a few hundred, each group its own transaction, is
the usual compromise and it moves the failure granularity to the group.

Option 1 costs you nothing and gives you nothing to negotiate with: the whole
batch fails on one bad row. For most operations that is exactly right, and the
instinct to make it "more robust" is what produces the corrupt-data bugs.

## Gotchas

**⚠️ Calling the transactional per-item method on `this`**
**Symptom:** shape A compiles, reads correctly, and every row shares one
non-existent transaction.
**Cause:** a self-invocation never passes through the proxy, so `@Transactional`
on `importOne` does nothing — see **03 · The self-invocation trap** *(not written
yet)*.
**Fix:** the per-item method must live on a different bean, injected. This is the
single most common way shape A is got wrong.

**⚠️ Making the outer loop method `@Transactional` "just in case"**
**Symptom:** shape A silently degrades into the original bug — one transaction
around everything, and the inner boundaries merely participate in it.
**Cause:** the default propagation is `REQUIRED`, so the inner method joins the
outer transaction instead of starting its own.
**Fix:** the outer method must have no transaction, or the inner one must be
`REQUIRES_NEW`. Half of this arrangement does not work.

**⚠️ A `finally` block that writes**
**Symptom:** a record of the failed attempt is written on the failure path, and
then vanishes.
**Cause:** `finally` runs before the interceptor decides anything, so its writes
join the same transaction and share its fate. The row you wrote *because* the
operation failed is precisely the one guaranteed not to survive.
**Fix:** the attempt record needs its own transaction, or an `AFTER_COMPLETION`
listener — see [19 · Transactional events](19-transactional-events.md).

**⚠️ Retrying inside the transaction**
**Symptom:** a retry loop around a failing statement that never succeeds, and on
PostgreSQL every subsequent statement fails too.
**Cause:** once a statement fails, the database transaction is in an aborted
state and rejects further commands until it is rolled back. Retrying without
leaving the boundary cannot work.
**Fix:** retry *around* the boundary, restarting the transaction each time — see
[21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md). The
JDBC-level mechanics are **Topic 03 — Transactions at the JDBC level** *(not
written yet)*.

**⚠️ Rethrowing a different exception type without checking the rules**
**Symptom:** wrapping an exception "for a better message" changes whether the
transaction rolls back.
**Cause:** the rules are evaluated on the type that escapes. Wrapping an
unchecked exception in a checked one turns a rollback into a commit under the
default rule.
**Fix:** wrap into an unchecked domain exception, or set `rollbackFor`, or use
the global `ALL_EXCEPTIONS` switch so the wrapping cannot change the outcome.

**⚠️ Reaching for `TransactionSynchronizationManager` when you wanted the local
boundary, or the reverse**
**Symptom:** transaction metadata describing a different transaction from the one
you meant.
**Cause:** the javadoc's distinction — `currentTransactionStatus()` "exposes the
locally declared transaction boundary with its declared name and
characteristics", which at runtime "may participate in an outer transaction", and
it points you at `TransactionSynchronizationManager` for the actual resource
transaction.
**Fix:** for *setting* rollback-only, the local boundary is the right handle. For
*asking* whether a real transaction is active, use
`TransactionSynchronizationManager`.

**⚠️ Per-item transactions with a batch that must be all-or-nothing**
**Symptom:** an import that leaves half a ledger posted.
**Cause:** somebody applied option 3 to an operation whose whole point was
atomicity, because "skip bad rows" sounded more robust.
**Fix:** ask what the caller does with a partial result. If there is no sensible
answer, option 1 is the design and the batch should fail.

## Interview questions

**★ You are asked to "skip bad rows and import the rest". How do you implement
it?**
Not with a `try`/`catch` inside a single transactional method — that commits
whatever happened to succeed, in a state nobody designed. Each row has to be its
own unit of work, so each row needs its own physical transaction. The shape I
would reach for is an outer loop method with **no** transaction that calls a
transactional per-row method on a different bean, catching per row outside every
boundary. The alternative, `REQUIRES_NEW` on the per-row method inside an outer
transaction, gives the same independence but holds the outer transaction's
connection open while each inner one takes a second, which the propagation
reference warns can exhaust the pool and deadlock. I would also make the skipped
rows a returned report rather than only a log line.

**★ Where should a `try`/`catch` around business logic live?**
Outside the transactional boundary — in the controller, the scheduled task, the
message listener, wherever the unit of work is invoked from. At that point the
transaction has already been resolved, so catching can change the response but
not the data. The rule to hold on to is that the `catch` must be on the other
side of the boundary from the writes. "Which method the `catch` is written in" is
a proxy for that which is often wrong: a `catch` in a caller that is itself
`@Transactional` swallows the exception just as effectively as one in the callee.

**★ Does a `try`/`finally` behave differently from a `try`/`catch` here?**
`finally` does not stop propagation, so the exception still escapes and the rules
still apply — the transaction rolls back as normal. The mistake people make is
writing to the database in the `finally` block, typically to record that the
attempt happened. Those writes are in the same transaction and are rolled back
with everything else, so the record you wanted specifically because the operation
failed is the one thing guaranteed not to survive. That work needs a separate
transaction or an `AFTER_COMPLETION` listener.

**★ Why is shape A better than `REQUIRES_NEW` for a batch import?**
Because it uses one connection at a time. In shape A the outer method holds no
transaction, so when the inner one runs it is the only transaction on the thread
and the only connection checked out. With `REQUIRES_NEW`, the outer transaction's
connection stays bound to the thread while the inner transaction acquires a
second one — for the duration of every item. With enough concurrent threads doing
this, the pool runs out and the threads holding an outer connection are waiting
for an inner one that will never come. The propagation reference states the
requirement directly: the pool must exceed the number of concurrent threads by at
least one. Shape A does not need that condition to hold.

**★ Someone argues that catching per row inside one big transaction is fine
because "the failures are rare". What do you say?**
That rarity is what makes it dangerous rather than what makes it acceptable. A
failure mode that fires rarely is one that is never exercised in testing, has no
alerting around it, and produces its damage — a half-imported batch — at a moment
nobody is watching. The cost of doing it properly is one extra bean and a report
object. The cost of getting it wrong is data that has to be reconciled by hand,
and nobody can reconstruct which rows made it because the only evidence is a
warning in a log that has since rotated.

**★ Is there ever a reason to catch inside the boundary and *not* mark rollback-only?**
Only when the failing work genuinely is not part of the unit — and if that is
true, it should not be inside the boundary in the first place. Sending a
notification, warming a cache, recording a metric: those are things that may fail
without invalidating the business operation, and the right fix is to move them
out of the transaction entirely, usually to an `AFTER_COMMIT` listener. Catching
them inside the boundary appears to achieve the same thing but leaves them able
to hold the transaction open while they fail slowly, which is
[21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md).

**★ You use option 2 in a method that turns out to be called from inside another
transaction. What happens?**
Your report becomes a lie. `currentTransactionStatus()` gives the *locally declared*
boundary — the javadoc: it "exposes the locally declared transaction boundary… At
runtime, the local boundary may participate in an outer transaction" — so marking it
rollback-only sets the flag on the shared physical transaction. Your method returns
an `ImportReport` naming three failed rows and the rest as successes, the caller
accepts that and carries on, and its commit is then refused with
`UnexpectedRollbackException`. Nothing succeeded. Option 2 is honest only at a
boundary you own: the outermost transactional method, or a `REQUIRES_NEW` one, or a
report saying "everything was rolled back" rather than enumerating successes.

---

← Prev: [14 · The caught exception](14-the-caught-exception.md) · Index: [Spring @Transactional](README.md) · Next → [14c · What the database did](14c-what-the-database-did.md)
