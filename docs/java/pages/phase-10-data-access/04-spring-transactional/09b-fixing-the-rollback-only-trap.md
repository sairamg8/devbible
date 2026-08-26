---
title: "Three ways out of the rollback-only trap, and choosing between them is a business decision about whether one failed item is fatal to the whole"
sidebar_label: "9b · Fixing the rollback-only trap"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> *Rolling back a declarative transaction*
> ([.../declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html))
> the `Propagation` javadoc
> ([.../transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> and the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 9](09-marked-rollback-only.md) ended with the diagnosis: the exception is
not the bug, the `catch` is. This chunk is what to do about it. There are three
fixes, none of them is universally right, and choosing is not a technical
decision — it is the question *"is one failed item fatal to this whole
operation?"*, which only the domain can answer.**

## Three fixes, and which one you want

There is no single correct answer, because the question the code is really
asking is *"is a failed row fatal to this import?"* — and that is a business
decision, not a technical one.

### Fix 1 — do not swallow it

If a failed row *should* abort the whole import, delete the `catch`. The
exception propagates, the interceptor rolls back at the outermost boundary, and
the caller gets the original `DataAccessException` — which is far more useful
than `UnexpectedRollbackException`, because it says what actually went wrong.

**This is the right answer more often than people expect.** A `catch` that
converts a failure into a counter is usually a decision nobody made deliberately.

### Fix 2 — give the inner work its own transaction

If a failed row genuinely should not abort the others, the inner work must be a
separate physical transaction:

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void importOne(Row row) { ... }
```

Now `importOne` gets its own transaction on its own connection. Its failure rolls
back only its own row, marks nothing on the outer transaction, and the `catch` is
honest. ⚠️ **This costs a second connection per inner call and brings the
pool-sizing constraint** — [chunk 10](10-requires-new.md).

### Fix 3 — move the boundary

Often the real problem is that the boundary is in the wrong place. If each row is
independently a unit of work, then `importAll` should not be transactional at all
— it should be a loop over a transactional per-row method:

```java
public ImportReport importAll(List<Row> rows) {     // ← NOT transactional
    int failed = 0;
    for (Row row : rows) {
        try {
            importer.importOne(row);                 // its own transaction each time
        } catch (DataAccessException ex) {
            failed++;
        }
    }
    return new ImportReport(rows.size() - failed, failed);
}
```

**This is usually the cleanest of the three.** There is no outer transaction to
mark, no `REQUIRES_NEW`, no second connection held while a first is open, and the
boundary now says exactly what the business rule is: one row, one transaction.

## Seeing it coming

Two checks catch this before production:

```java
// inside the catch, before deciding to continue
if (TransactionAspectSupport.currentTransactionStatus().isRollbackOnly()) {
    throw ex;    // the transaction is already doomed; pretending otherwise is a lie
}
```

and, more generally, **treat any `catch` inside a `@Transactional` method as a
design decision that needs justifying**. The question to ask at every one is: *if
this exception came from a nested transactional call, is the transaction already
rollback-only?* If the answer is yes or "I do not know", the `catch` is wrong.

⚠️ **The guard above is a stopgap, not a design.** It makes an existing `catch`
honest, which is worth doing in code you are not restructuring today. It does not
answer the question the three fixes answer, and a codebase full of these guards
is a codebase whose boundaries are in the wrong place.

## Choosing

| The question | The answer | The fix |
|---|---|---|
| Should one failed item abort everything? | yes | **1 · do not swallow** |
| Must each item commit independently, inside one outer unit of work? | yes | 2 · `REQUIRES_NEW` |
| Is each item its own unit of work, with no outer transaction needed? | yes | **3 · move the boundary** |
| Is the exception not really a failure? | yes | `noRollbackFor`, and mean it |

🔴 **Fixes 1 and 3 are the ones to reach for.** Fix 2 is correct but costs a
second connection per inner call, and it is chosen far more often than it is
needed — usually because it is the change that makes the exception go away
without anybody having to answer the question.

## The trade-off

Every fix here moves a cost somewhere. Not swallowing gives up partial progress:
one bad row loses the whole import. `REQUIRES_NEW` buys partial progress with a
second connection per item and a pool-sizing constraint that can deadlock an
application under load. Moving the boundary buys partial progress cheaply but
gives up atomicity across items entirely — there is no longer any point at which
the import is all-or-nothing, so a crash halfway through leaves half the rows
committed with no record of where it stopped. **There is no arrangement that has
partial progress, atomicity and one connection.** Which two you want is the
decision the code has to make explicitly.

## Gotchas

**⚠️ Catching an exception from a nested `@Transactional` call and continuing**
**Symptom:** `UnexpectedRollbackException` at the commit, after a method that
returned a normal result.
**Cause:** the inner scope marked the physical transaction rollback-only before
throwing; your `catch` hid that.
**Fix:** one of the three above. Which one is a business decision.

**⚠️ Catching `Exception` around a whole method body "for logging"**
**Symptom:** the same failure, arrived at by a logging concern rather than a
control-flow one.
**Cause:** a log-and-continue `catch` is still a swallow.
**Fix:** log and rethrow. Logging is not a reason to change control flow.

**⚠️ Adding `REQUIRES_NEW` to the inner method without thinking about the pool**
**Symptom:** the exception goes away and the application deadlocks under load.
**Cause:** each concurrent thread now holds two connections.
**Fix:** [chunk 10](10-requires-new.md) — the pool must exceed the number of
concurrent threads by at least one.

**⚠️ Choosing `REQUIRES_NEW` because it is the smallest diff**
**Symptom:** a one-word change that silences the exception and nobody asked what
the transaction was supposed to guarantee.
**Cause:** it is the only fix that requires no restructuring, so it is the path of
least resistance.
**Fix:** answer the question in the choosing table first. If the answer is "each
item is its own unit of work", fix 3 is both cheaper and clearer.

**⚠️ Assuming `noRollbackFor` on the inner method solves it**
**Symptom:** it sometimes does, and for a reason that will not survive a refactor.
**Cause:** `noRollbackFor` stops the inner scope marking the transaction for
*that* exception type. It is a real fix only when you genuinely mean "this
exception is not a failure of the transaction".
**Fix:** if the exception is not a failure, say so with `noRollbackFor` and mean
it. If it is, one of the three fixes above.

**⚠️ `noRollbackFor` on a statement that the database already aborted**
**Symptom:** every subsequent statement in the transaction fails, whatever Spring
thinks.
**Cause:** on PostgreSQL a failed statement aborts the transaction at the server;
Spring not marking it does not un-abort it.
**Fix:** `noRollbackFor` is for exceptions raised by your code or by a check that
left the database intact — not for failed SQL.

**⚠️ Writing the failure record inside the doomed transaction**
**Symptom:** the error row is missing along with everything else.
**Cause:** the log table write is part of the transaction being rolled back.
**Fix:** `REQUIRES_NEW` for the audit write specifically — the one place it is
unambiguously the right tool — or write it after the boundary.

**⚠️ Moving the boundary out and forgetting the loop is no longer atomic**
**Symptom:** a crash halfway through an import leaves half the rows committed and
no record of where it stopped.
**Cause:** fix 3 removes the outer transaction entirely, on purpose.
**Fix:** that is the trade. If restartability matters, the loop needs its own
progress marker, committed with each item.

**⚠️ Applying fix 3 and leaving `@Transactional` on the loop method**
**Symptom:** exactly the original bug, unchanged.
**Cause:** the outer annotation is what makes the inner call a participant. Fix 3
is *removing* it.
**Fix:** the loop method must not be transactional for fix 3 to be fix 3.

## Interview questions

**★ How do you fix `UnexpectedRollbackException`?**
By deciding what you actually meant, because there are three fixes and the choice
is a business decision. If a failed inner operation should abort the whole unit
of work, stop swallowing the exception — let it propagate, the boundary rolls
back, and the caller gets the original error, which is far more informative than
`UnexpectedRollbackException`. If the inner operation should be independently
committable, give it `propagation = REQUIRES_NEW` so it runs in its own physical
transaction on its own connection, at the cost of a second connection per call
and the pool-sizing constraint that comes with it. And often the best fix is
neither: move the boundary. If each item is genuinely its own unit of work, the
loop should not be transactional at all, and the per-item method should be — then
there is no outer transaction to mark and no `REQUIRES_NEW` needed.

**★ Why is "just add `REQUIRES_NEW`" the wrong instinct even though it works?**
Because it is the only fix that requires no thought, so it gets chosen for that
reason rather than on its merits, and it is the most expensive of the three. Each
inner call takes a second connection from the pool while the outer transaction
holds its own — the reference warns that this "may lead to exhaustion of the
connection pool and potentially to a deadlock" and states a hard rule: do not use
it "unless your connection pool is appropriately sized, exceeding the number of
concurrent threads by at least 1". In a loop over a thousand rows it also means a
thousand begin/commit round trips. If the honest answer is "each row is its own
unit of work", moving the boundary out of the loop gives the same behaviour with
one connection and no round-trip multiplication. `REQUIRES_NEW` earns its cost
when the inner work must commit *while an outer transaction genuinely needs to
remain open* — an audit row that must survive the rollback is the archetype.

**★ Would `noRollbackFor` on the inner method solve this?**
Sometimes, and only when it is honest. `noRollbackFor` tells the inner scope's
interceptor not to mark the transaction for that exception type, so the outer
transaction stays committable and the `catch` becomes truthful. That is the right
tool when the exception genuinely does not mean the transaction failed — a
domain-level "this item was a duplicate, skip it" that leaves the database in a
valid state. It is the wrong tool when a *statement* failed, because PostgreSQL
aborts the transaction at the server when a statement errors, and Spring
declining to mark it does not change that: every subsequent statement fails
regardless. The test is whether you would be happy committing the work done so
far. If not, `noRollbackFor` is hiding the problem rather than solving it.

**★ You choose fix 3 and move the boundary out of the loop. What have you given
up?**
Atomicity across items. There is no longer any moment at which the whole import
is all-or-nothing: each row commits as it succeeds, so a crash or a shutdown
halfway through leaves the earlier rows permanently committed. That is often
exactly what you want for an import — partial progress is better than none, and
retrying from scratch is wasteful. But it changes the failure story, and the
change needs a matching design: if the operation must be restartable, something
has to record how far it got, and that marker has to be committed in the same
transaction as each item so it can never disagree with the data. Choosing fix 3
without adding that marker is how an import ends up being re-run from the start
and producing duplicates.

**★ Where would you put an audit row that must survive a rollback?**
In its own transaction, which is `REQUIRES_NEW` used for the reason it exists.
Writing it inside the failing transaction is the common mistake: the audit row is
part of the work being rolled back, so the one record of what went wrong
disappears with the failure it was documenting. `REQUIRES_NEW` on the audit
method gives it a separate physical transaction on a separate connection that
commits independently of the outer one's fate. The costs are the usual ones — a
second connection held while the first is open, and the pool arithmetic — and
they are acceptable here precisely because the audit write is short and the
requirement is genuine. The alternative that avoids the pool cost is to collect
the failure in memory and write it after the boundary has ended, which works when
losing the record on a process crash is tolerable.

**★ Is the `isRollbackOnly()` guard inside a `catch` a good pattern?**
It is a good stopgap and a bad destination. What it does is make an existing
`catch` stop lying: if the transaction is already doomed, continuing to compute a
result is waste and returning one is a false promise, so rethrowing is the only
honest option. Adding it to legacy code you are not restructuring today is
worthwhile. What it does not do is answer the question the three fixes answer —
whether a failed item should abort the operation — so a codebase where these
guards proliferate is one whose boundaries are in the wrong places and which is
paying for it with a runtime check at every `catch`. It also couples business
code to `TransactionAspectSupport`, which is Spring's AOP internals, and that is
a coupling worth avoiding wherever restructuring is possible.

**★ The choosing table has four rows and no `NESTED`. Is a savepoint not a fourth fix?**
It is, in principle, and it is worth being able to say why it is not in the table.
`PROPAGATION_NESTED` gives the inner call a savepoint inside the *same* physical
transaction, so a failed item can be rolled back to the savepoint while the outer
transaction survives and commits — partial progress, atomicity across the whole
operation, and **one** connection, which is precisely the combination the trade-off
section says you cannot have. The catch is availability and cost. The `Propagation`
javadoc is explicit that "out of the box, this only applies to the JDBC
`DataSourceTransactionManager`", so a JPA application usually cannot have it at all, and
where it exists each item costs a `SAVEPOINT` and either a `RELEASE` or a `ROLLBACK TO`,
which on a large loop is not free. It also does not remove the thinking: you still have
to decide whether a failed item is fatal, and a savepoint only helps when the answer is
no. Treat it as fix 2's cheaper cousin where the manager supports it —
[chunk 11](11-nested-and-savepoints.md) — not as a way of avoiding the question.

---

← Prev: [9 · Marked rollback-only](09-marked-rollback-only.md) · Index: [04 · Spring @Transactional](README.md) · Next → [10 · REQUIRES_NEW](10-requires-new.md)
