---
title: "You caught the exception, you handled it, your method returned normally — and the commit threw UnexpectedRollbackException anyway"
sidebar_label: "9 · Marked rollback-only"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `UnexpectedRollbackException` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/UnexpectedRollbackException.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/UnexpectedRollbackException.html))
> and the `TransactionStatus` interface as documented in *Understanding the
> Spring Framework transaction abstraction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html)),
> the `AbstractPlatformTransactionManager` javadoc
> ([.../transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html))
> and the Spring Data JPA 4.1 reference *Transactionality*
> ([docs.spring.io/spring-data/jpa/reference/jpa/transactions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**This is the code, and it looks defensive and correct.**

```java
@Service
class ImportService {

    private final RowImporter importer;
    private final ReportWriter reports;

    @Transactional                                     // ← outer scope
    public ImportReport importAll(List<Row> rows) {
        int failed = 0;
        for (Row row : rows) {
            try {
                importer.importOne(row);               // ← inner scope
            } catch (DataAccessException ex) {
                failed++;                              // "handled"
            }
        }
        reports.record(rows.size() - failed, failed);
        return new ImportReport(rows.size() - failed, failed);
    }
}

@Component
class RowImporter {
    @Transactional                                     // ← REQUIRED, joins the outer
    public void importOne(Row row) {
        db.sql("INSERT INTO imported (sku, qty) VALUES (?, ?)")
          .params(row.sku(), row.qty())
          .update();                                   // row 3 violates a constraint
    }
}
```

**`importAll` returns a report saying "47 imported, 3 failed". Then the commit
throws:**

`org.springframework.transaction.UnexpectedRollbackException: Transaction rolled
back because it has been marked as rollback-only`

Nothing was imported. The report row was not written either. The caller receives
an exception from a method that had already computed a successful-looking result.

## Why

Recall from [chunk 8](08-propagation-required.md) that `importOne` creates a
*logical* scope inside the same *physical* transaction. The reference:

> *"Each such logical transaction scope can determine rollback-only status
> individually, with an outer transaction scope being logically independent from
> the inner transaction scope. In the case of standard `PROPAGATION_REQUIRED`
> behavior, all these scopes are mapped to the same physical transaction. So a
> rollback-only marker set in the inner transaction scope does affect the outer
> transaction's chance to actually commit."*

Step by step:

1. `importOne` throws a `DataAccessException` — a `RuntimeException`, so the
   rollback rules say roll back.
2. The interceptor around `importOne` cannot roll back: it does not own the
   physical transaction. What it *can* do is **mark it rollback-only**, then
   rethrow.
3. Your `catch` swallows the exception. You never learn that step 2 happened.
4. `importAll` returns normally, so its interceptor calls `commit`.
5. The transaction is marked rollback-only. The commit performs a rollback and
   throws `UnexpectedRollbackException`.

```
importAll        BEGIN ─────────────────────────────────── commit → ROLLBACK + throw
  └── importOne                 throws → mark rollbackOnly
      catch                     swallowed ✗
```

## Why this is correct, not a bug

The reference argues it explicitly, and the argument is worth reading in full
because it is the answer to every "why does Spring do this to me":

> *"However, in the case where an inner transaction scope sets the rollback-only
> marker, the outer transaction has not decided on the rollback itself, so the
> rollback (silently triggered by the inner transaction scope) is unexpected. A
> corresponding `UnexpectedRollbackException` is thrown at that point. This is
> expected behavior so that the caller of a transaction can never be misled to
> assume that a commit was performed when it really was not. So, if an inner
> transaction (of which the outer caller is not aware) silently marks a
> transaction as rollback-only, the outer caller still calls commit. The outer
> caller needs to receive an `UnexpectedRollbackException` to indicate clearly
> that a rollback was performed instead."*

**"The caller of a transaction can never be misled to assume that a commit was
performed when it really was not."** That is the whole design. The alternative —
returning normally from a method whose work was discarded — is a far worse
failure, and it is silent.

The exception's own javadoc says the same thing in one line: *"Thrown when an
attempt to commit a transaction resulted in an unexpected rollback."*

🔴 **So the exception is not the bug. The bug is the `catch`.** Spring is telling
you that your error handling made a promise the transaction could not keep.
[Chunk 9b](09b-fixing-the-rollback-only-trap.md) is the three ways out and how to
choose between them.

## The trade-off

Spring could have let the commit silently become a rollback and returned
normally. That would make this page unnecessary and would be much worse: a method
that returns a result its work did not produce is undetectable, and the failure
surfaces later as missing data with no exception anywhere to trace. The chosen
design pays for that safety with an exception that arrives at a confusing place —
at the commit, after every method has returned, naming no cause. The right way to
hold it is: **`UnexpectedRollbackException` is a report about your error
handling, delivered at the only moment Spring can be sure it is true.** What to
do about that report is [chunk 9b](09b-fixing-the-rollback-only-trap.md).

## Gotchas

**⚠️ Reading the exception as "Spring lost my transaction"**
**Symptom:** time spent looking at connection pools and managers.
**Cause:** the message names the mechanism ("marked as rollback-only") and not
the culprit.
**Fix:** find the `catch` inside the outermost transactional method. That is
always where it is.

**⚠️ Two annotated methods where you only expected one**
**Symptom:** an inner method you did not think was transactional marks the
transaction.
**Cause:** a class-level `@Transactional`, or a Spring Data repository method —
Spring Data's repositories are transactional by default.
**Fix:** the marking comes from any participating scope, including ones the
framework created.

**⚠️ A retry around the inner call, inside the same transaction**
**Symptom:** every retry attempt fails identically, then the commit throws.
**Cause:** the transaction was marked rollback-only on the first attempt; nothing
in it can succeed afterwards.
**Fix:** retry the whole transaction from outside the boundary, never a statement
inside it.

**⚠️ Trying to "unmark" a rollback-only transaction**
**Symptom:** searching for a `setRollbackOnly(false)` that does not exist.
**Cause:** the flag is deliberately one-way. Once a scope has said this
transaction must not commit, nothing may overrule it.
**Fix:** there is no unmark. Restructure the boundary.

**⚠️ Catching `UnexpectedRollbackException` itself and continuing**
**Symptom:** the error disappears from logs and data quietly goes missing.
**Cause:** the exception exists specifically to stop this.
**Fix:** it is the last line of defence. Catching it removes the only signal that
a rollback happened.

**⚠️ A test that passes because the test's own transaction rolled back**
**Symptom:** the swallow-and-continue behaviour looks correct under test.
**Cause:** Spring's TestContext framework rolls back annotated test methods by
default, so nothing distinguishes a marked transaction from an ordinary one.
**Fix:** the same trap as [chunk 5c](05c-proving-it-and-preventing-it.md) — use
`@Commit`, or do not make the test transactional.

## Interview questions

**★ What is `UnexpectedRollbackException` and when do you get it?**
It is thrown when a commit is attempted on a transaction that has been marked
rollback-only — the javadoc's phrasing is "thrown when an attempt to commit a
transaction resulted in an unexpected rollback". The classic path is an inner
`@Transactional` method that throws, whose interceptor cannot roll back because
it does not own the physical transaction, so it marks the transaction
rollback-only and rethrows; the outer method catches that exception, handles it,
and returns normally; its interceptor then calls commit, and the commit performs
a rollback and throws. The exception arrives at a confusing moment — after every
method returned successfully — which is why it is so often misread as a framework
fault rather than as a report about the outer method's error handling.

**★ Why does Spring throw instead of quietly rolling back?**
Because the alternative misleads the caller. The reference states the reasoning
directly: this is "expected behavior so that the caller of a transaction can
never be misled to assume that a commit was performed when it really was not". If
the commit silently became a rollback and the method returned its computed
result, you would have a method that reports success while its work was
discarded — no exception anywhere, no log line, and the failure surfacing much
later as missing data with nothing to trace it to. Throwing converts a silent
data-loss bug into a loud one at the moment Spring can be certain about it. It is
the same design principle as the rest of the topic inverted: almost everything
else here fails silently, and this is the one place Spring insists on being
heard.

**★ An inner method threw and you caught it. Is the transaction still usable?**
No, and this is the part people miss. Once any participating scope has marked the
transaction rollback-only, the physical transaction is doomed: nothing you do
afterwards will be committed, and the flag cannot be cleared — there is
deliberately no `setRollbackOnly(false)`. So continuing to work inside that
transaction is pure waste, including any retry, any compensating write, and any
attempt to record the failure in the database. That last one is a particularly
common trap: writing an error row to a log table inside the doomed transaction
means the error record is rolled back too. You can check the state with
`TransactionAspectSupport.currentTransactionStatus().isRollbackOnly()`, and if it
is true the only honest thing to do is rethrow.

**★ You see `UnexpectedRollbackException` in production logs. What do you look
for first?**
The outermost `@Transactional` method in the stack, and then every `catch` inside
it. The exception is thrown at the commit, so its stack trace points at the
boundary and tells you nothing about the cause — the actual failure happened
earlier, in a nested call, and was swallowed. So the investigation is: find the
boundary, find the `catch` blocks under it, and work out which nested
transactional call could have thrown. Two things widen the search usefully.
Spring Data repository methods are transactional by default, so a scope can exist
where you did not write an annotation. And a `catch (Exception e) { log.warn(…) }`
counts as a swallow even though it was written as a logging concern. The fix
almost always turns out to be one of the three above.

**★ Why is the rollback-only flag one-way?**
Because the meaning of setting it is "this transaction must not be committed",
and that is not a claim any other scope is in a position to overrule. The scope
that set it observed a failure; a different scope, further out, has strictly less
information — it did not see the failure and, in the swallowing case, has
actively decided to ignore it. If unmarking were possible, an outer `catch` could
convert a genuine failure into a commit, which is exactly the misleading outcome
the design exists to prevent. The one-way flag also makes the semantics simple to
reason about: once true, the transaction has exactly one possible ending, and any
work done after that point is known to be wasted. The way to get a second chance
is a second transaction, which is what `REQUIRES_NEW` and a restructured boundary
provide.

**★ The exception arrives at the commit and names no cause. Can you make it fail where
the marking happened instead?**
Yes, and it is one of the more useful diagnostic settings in this area:
`failEarlyOnGlobalRollbackOnly` on the transaction manager. Its javadoc gives both the
default and what changing it does — "Default is `false`, only causing an
`UnexpectedRollbackException` at the outermost transaction boundary. Switch this flag on
to cause an `UnexpectedRollbackException` as early as the global rollback-only marker
has been first detected, even from within an inner transaction boundary." With it on,
the exception surfaces at the inner scope that did the marking, so the stack trace
points at the actual failure instead of at a commit that happens after every method has
returned.

The javadoc also explains why it is off by default, and the reason is a testing one:
the lenient default "allows, for example, to continue unit tests even after an operation
failed and the transaction will never be completed". That is a reasonable production
default and a poor debugging one, which makes this a natural thing to switch on in a
test or staging profile — via a `TransactionManagerCustomizer`, as in
[chunk 8c](08c-making-the-mismatch-loud.md) — and leave off in production.

**★ You get this exception and there is only one `@Transactional` in your code. Where
did the second scope come from?**
Almost certainly a Spring Data repository, because those are transactional whether or
not you annotated anything. The Spring Data JPA reference states it: "methods inherited
from `CrudRepository` inherit the transactional configuration from
`SimpleJpaRepository`. For read operations, the transaction configuration `readOnly`
flag is set to `true`. All others are configured with a plain `@Transactional` so that
default transaction configuration applies." So every `save`, `delete` and `saveAll` call
is a participating logical scope with its own rollback-only marker, and a
`DataIntegrityViolationException` from one of them marks your physical transaction
before you ever see the exception in your `catch`.

Two follow-ons worth knowing. The same mechanism means a repository call made with no
service boundary above it runs in its own transaction, which is why single-repository
operations are atomic even in code that annotates nothing. And you can override the
inherited configuration by redeclaring the method on your own repository interface with
the annotation you want — the reference's example redeclares `findAll()` with
`@Transactional(timeout = 10)`, which "causes the `findAll()` method to run with a
timeout of 10 seconds and without the `readOnly` flag."

---

← Prev: [8c · Making the mismatch loud](08c-making-the-mismatch-loud.md) · Index: [Spring @Transactional](README.md) · Next → [9b · Fixing the rollback-only trap](09b-fixing-the-rollback-only-trap.md)
