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


propagate it. There are three designs that are actually coherent. Pick one on
purpose — the fourth option, catching and continuing, is a silent decision to
commit half of a unit of work.**


Options 1 and 2 are here; option 3 — giving the failing part its own transaction — is
[14b2](14b2-its-own-transaction.md), along with what all three have in common.

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

## Gotchas

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

## Interview questions

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

← Prev: [14 · The caught exception](14-the-caught-exception.md) · Index: [04 · Spring @Transactional](README.md) · Next → [14b2 · Its own transaction](14b2-its-own-transaction.md)
