---
title: "Catching an exception inside a transactional method rolls back nothing — the interceptor never sees a failure, so it commits"
sidebar_label: "14 · The caught exception"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Rolling back a declarative transaction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> *Transaction propagation*
> ([.../declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `TransactionAspectSupport` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> and the `UnexpectedRollbackException` javadoc
> ([.../transaction/UnexpectedRollbackException.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/UnexpectedRollbackException.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, PostgreSQL 18.

**The rollback rules in [13 · Rollback rules](13-rollback-rules.md) are evaluated
on the exception that *escapes* your method. If you catch it, nothing escapes.
The interceptor sees a method that returned normally, and a method that returned
normally gets committed — including everything you wrote before the thing that
failed.**

## The method that logs and lies

```java
@Transactional
public void importBatch(List<Row> rows) {
    for (Row row : rows) {
        try {
            productRepository.save(Product.from(row));
            auditRepository.save(AuditEntry.imported(row.id()));
        } catch (DataAccessException ex) {
            log.warn("skipping row {}", row.id(), ex);   // and carry on
        }
    }
}
```

This looks careful. It is the opposite. The `catch` swallows the failure, the
loop continues, the method returns normally, and the interceptor commits whatever
survived. What lands in the database is the rows that happened to work, in
whatever order they happened to be processed, with audit entries for some and not
others. There is a warning in the log and no error anywhere else — the caller
believes the import succeeded, because as far as Java is concerned it did.

The pathological version is one line shorter and appears in real code more often
than it should:

```java
} catch (Exception ex) {
    log.error("import failed", ex);
}
```

Nothing above this line is undone. The exception type does not matter here; it is
not consulted, because no rule is ever evaluated. `rollbackFor`, `noRollbackFor`
and `rollbackOn = ALL_EXCEPTIONS` are all irrelevant to a method that does not
throw.

## Why the type of the exception stops mattering

The interceptor wraps your method like this, in effect:

```java
Object retVal;
try {
    retVal = invokeYourMethod();
} catch (Throwable ex) {
    // consult the rollback rules for ex, then roll back or commit
    throw ex;
}
// no exception reached here: commit
return retVal;
```

There is exactly one place the rules are consulted, and it is the `catch` in the
*interceptor*. Your own `catch` runs strictly inside `invokeYourMethod()`. By the
time control returns to the interceptor, the failure has been converted into a
normal return, which is indistinguishable from success.

This is worth stating as a rule of its own: **`@Transactional` reacts to control
flow, not to logs, not to error counts, not to a boolean you set.** If you want a
rollback, an exception has to leave the method, or you have to say so explicitly.

## Saying so explicitly

There is a documented way to demand a rollback without throwing:

```java
import org.springframework.transaction.interceptor.TransactionAspectSupport;

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
    return report;                      // returns, but nothing is committed
}
```

The reference names this as the way to do it:

> you can also indicate a required rollback programmatically… the
> `TransactionAspectSupport` class… `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();`

and the javadoc explains what `currentTransactionStatus()` is for:

> Return the transaction status of the current method invocation. Mainly intended
> for code that wants to set the current transaction rollback-only but not throw
> an application exception.

That is exactly the shape above: return a report to the caller *and* undo the
writes. It is legitimate, and it is the right answer when the caller genuinely
needs a value back rather than an exception.

Two things the javadoc adds that you need to know before using it:

> This exposes the locally declared transaction boundary with its declared name
> and characteristics, as managed by the aspect. At runtime, the local boundary
> may participate in an outer transaction: If you need transaction metadata from
> such an outer transaction (the actual resource transaction) instead, consider
> using `TransactionSynchronizationManager`.

and it throws:

> `NoTransactionException` — if the transaction info cannot be found, because the
> method was invoked outside an AOP invocation context

So calling it from a method that was not actually proxied — a self-invocation, a
`new`-ed object, a plain thread — does not quietly do nothing. It throws. That is
a rare piece of good fortune in this topic: this is one of the few
transaction mistakes that is loud.

## What `setRollbackOnly` does to your caller

`setRollbackOnly()` does not roll back. It sets a flag saying *this transaction
must not commit*. If your method started the transaction, the interceptor sees
the flag on the way out and rolls back — end of story.

If your method was **participating** in a caller's transaction, the flag is set
on the shared physical transaction, and now the caller is in trouble. The caller
does not know. It carries on, finishes its own work, and when its boundary tries
to commit, the commit is refused and it gets an
`org.springframework.transaction.UnexpectedRollbackException`, described in its
javadoc as

> Thrown when an attempt to commit a transaction resulted in an unexpected
> rollback.

That is the whole mechanism behind the most confusing failure in Spring
transactions — see **[09 · Marked rollback-only](09-marked-rollback-only.md)** for the full
walkthrough and the propagation reference's paragraph on it.

The practical consequence for this page: **swallowing an exception in an inner
transactional method does not protect the caller.** If the inner method's
boundary marked the transaction rollback-only before you caught anything, your
`catch` has hidden the cause and left the doom in place. You get a caller that
fails at commit time with an exception naming nothing useful, and a log line
several methods earlier that nobody connects to it.

## The trade-off

`setRollbackOnly()` buys you the ability to return a value and still undo the
work. What it costs is that the failure has become invisible to anything that
only watches exceptions: metrics, `@ControllerAdvice`, retry advice, the caller's
own `try`/`catch`. Nothing throws. The caller has to read your return value and
act on it, and if it forgets, the operation silently did nothing at all — which
is a different bug from the one you fixed, but still a bug.

Throwing has the opposite profile: loud, hard to ignore, and it costs you the
ability to hand back structured information about a partial failure.

What to do instead of swallowing, in all three legitimate shapes, is
[14b · Three honest options](14b-three-honest-options.md). And the database had a
reaction of its own to the failure you caught, which decides whether this page's
scenario is silent or noisy —
[14c · What the database did](14c-what-the-database-did.md).

## Gotchas

**⚠️ `catch (Exception ex) { log.error(...); }` around database work**
**Symptom:** an operation reported as failed in the log, with data committed.
**Cause:** no exception escaped, so no rule was consulted and the interceptor
committed.
**Fix:** rethrow, or `setRollbackOnly()`. "Log and continue" is a decision to
commit partial work; if that is what you want, say so in a comment, because the
next reader will assume it is a bug.

**⚠️ A `try`/`catch` around a single repository call inside a larger method**
**Symptom:** the method appears to work; a foreign key violation or a null column
shows up much later, in an unrelated request.
**Cause:** the same thing at smaller scale — one write failed, the rest
committed, and the aggregate is inconsistent.
**Fix:** decide whether that write is genuinely optional. If it is optional, it
probably does not belong in this transaction at all.

**⚠️ Catching an exception that already marked the transaction rollback-only**
**Symptom:** your code recovers cleanly and the caller still fails at commit with
`UnexpectedRollbackException`.
**Cause:** an inner `@Transactional` boundary participating in the same physical
transaction set the flag before throwing. Catching the exception does not clear
it — nothing clears it.
**Fix:** if the inner operation must be allowed to fail independently, it needs a
genuinely separate transaction. Catching is not enough, and no amount of
defensive `catch` will make it enough.

**⚠️ `currentTransactionStatus()` throwing `NoTransactionException`**
**Symptom:** a `NoTransactionException` from a method that plainly carries
`@Transactional`.
**Cause:** the method was invoked outside an AOP invocation context — a
self-invocation, a `new`-ed instance, or a call from a thread that is not on the
proxied call stack.
**Fix:** treat it as a genuine diagnostic rather than a nuisance. It is telling
you the annotation was not in effect at all, which was equally true before you
added the call and will be true after you remove it.

**⚠️ Using `setRollbackOnly()` and then returning success to the caller**
**Symptom:** an API that answers `200 OK` for an operation that wrote nothing.
**Cause:** the flag undoes the writes; it does not touch your return value.
**Fix:** return something the caller is forced to inspect, and make the caller
inspect it. If the caller cannot act on partial failure, throw instead.

## Interview questions

**★ A method is annotated `@Transactional`, it catches its own exception and logs
it, and the data is committed. Why?**
Because rollback rules are evaluated by the interceptor on the exception that
escapes the method, and no exception escaped. From the interceptor's point of
view the method returned normally, which is the commit path. The exception's type
never enters into it — `rollbackFor`, `noRollbackFor` and the global `rollbackOn`
setting are all irrelevant, because none of them is consulted when there is
nothing to consult them about.

**★ How do you roll back without throwing?**
`TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`, which the
javadoc describes as "mainly intended for code that wants to set the current
transaction rollback-only but not throw an application exception". It marks the
transaction so that the eventual commit becomes a rollback, while letting the
method return a value. It throws `NoTransactionException` if called from a method
that was not invoked through the proxy, which incidentally makes it a useful
probe for whether your annotation is in effect at all.

**★ What is the difference between throwing and calling `setRollbackOnly()`?**
The database outcome is identical: the work is undone. Everything else differs.
Throwing propagates, so every layer above — retry advice, exception handlers,
metrics, the caller's own `catch` — gets a chance to react, and the caller cannot
ignore it. `setRollbackOnly()` is invisible outside the transaction machinery:
the method returns normally, so the caller must inspect the returned value to
learn anything went wrong, and if it does not, the operation silently accomplished
nothing. Choose throwing unless the caller genuinely needs structured detail about
a partial failure.

**★ Your service catches the exception from an inner `@Transactional` method,
handles it, and returns successfully — but the request fails at the end with
`UnexpectedRollbackException`. Explain.**
The inner method was participating in the same physical transaction, not running
its own. When its exception escaped its boundary, its interceptor could not roll
back a transaction it had not started, so it marked the shared transaction
rollback-only and rethrew. You caught the rethrown exception, but the flag stays
set — nothing clears it. When your outer boundary tried to commit, the commit was
refused and translated into `UnexpectedRollbackException`, described in its
javadoc as "thrown when an attempt to commit a transaction resulted in an
unexpected rollback". The fix is not a better `catch`: the inner operation has to
run in a genuinely separate transaction if it is allowed to fail on its own.

**★ Is it ever correct to catch an exception inside a transactional method?**
Yes, in two cases. One: you catch it, translate it into a domain exception, and
rethrow — the exception still escapes, so the rules still apply, and you have
improved the message rather than changed the outcome. Two: you catch it, call
`setRollbackOnly()`, and return a result object describing the failure — the
writes are still undone, and the caller gets structure instead of a stack trace.
What is never correct is catching, logging, and continuing as though the failure
did not happen, because that is a silent decision to commit partial work, and the
code does not say that it is a decision.

**★ Why does `currentTransactionStatus()` throw rather than return `null` when
there is no transaction?**
Because there is no sensible thing to do with a `null` there — the caller is
about to ask for a rollback that cannot happen. Throwing `NoTransactionException`
turns a would-be silent no-op into a loud failure at the exact call site, and in
this topic that is unusually valuable: almost every other way of losing your
transaction (self-invocation, an unproxied bean, the wrong thread) fails silently
and shows up as wrong data much later. This one tells you immediately.

---

← Prev: [13e · When rules collide](13e-when-rules-collide.md) · Index: [Spring @Transactional](README.md) · Next → [14b · Three honest options](14b-three-honest-options.md)
