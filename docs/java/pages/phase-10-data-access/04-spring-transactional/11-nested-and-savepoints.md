---
title: "NESTED is not a second transaction — it is one physical transaction with a savepoint, and that single fact decides everything it can and cannot do"
sidebar_label: "11 · NESTED and savepoints"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> the `DataSourceTransactionManager` javadoc
> ([.../org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html))
> and the `JdbcTransactionObjectSupport` and `ConnectionHolder` sources
> ([github.com/spring-projects/spring-framework/.../jdbc/datasource/JdbcTransactionObjectSupport.java](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/datasource/JdbcTransactionObjectSupport.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**`NESTED` sits between `REQUIRED` and `REQUIRES_NEW` and is almost always
described wrongly, as "a transaction inside a transaction". It is not. The
reference says exactly what it is: one physical transaction with savepoints. Once
you hold that, every difference from `REQUIRES_NEW` follows without being
memorised — same connection, no pool pressure, partial rollback, and no immunity
from the outer transaction's failure. This chunk is the mechanism and the
comparison; [chunk 11b](11b-choosing-nested.md) is where to use it, what JPA does
with it, and what it costs.**

## What the reference says

> *"`PROPAGATION_NESTED` uses a single physical transaction with multiple
> savepoints that it can roll back to. Such partial rollbacks let an inner
> transaction scope trigger a rollback for its scope, with the outer transaction
> being able to continue the physical transaction despite some operations having
> been rolled back. This setting is typically mapped onto JDBC savepoints, so it
> works only with JDBC resource transactions."*

And the `Propagation` javadoc, tighter still:

> *"Execute within a nested transaction if a current transaction exists, behave
> like `REQUIRED` otherwise. There is no analogous feature in EJB."*
>
> *"Note: Actual creation of a nested transaction will only work on specific
> transaction managers. **Out of the box, this only applies to the JDBC
> `DataSourceTransactionManager`.** Some JTA providers might support nested
> transactions as well."*

🔴 **"There is no analogous feature in EJB"** is a useful signal on its own:
`NESTED` is not a standard transaction concept. It is Spring exposing a JDBC
capability.

## What actually happens

```java
@Transactional                                              // outer — BEGIN
public void importBatch(List<Row> rows) {
    header.write(rows.size());
    for (Row row : rows) {
        try {
            importer.importOne(row);                        // NESTED
        } catch (DataAccessException ex) {
            skipped++;                                      // honest here
        }
    }
    summary.write(skipped);
}

@Transactional(propagation = Propagation.NESTED)
public void importOne(Row row) { ... }
```

The shape of what reaches the database, per iteration — this is the sequence the
savepoint model implies, not a captured log:

```
BEGIN                                    ← the outer method
INSERT header …
  SAVEPOINT <sp>                         ← entering importOne
  INSERT imported …                      ← fails
  ROLLBACK TO SAVEPOINT <sp>             ← only this row is undone
  RELEASE SAVEPOINT <sp>
  SAVEPOINT <sp>                         ← next iteration
  …
INSERT summary …
COMMIT                                   ← everything not rolled back
```

⚠️ **The savepoint names are Spring's to generate and are not part of any
contract** — do not write code that depends on them.

**One `BEGIN`. One `COMMIT`. One connection.** The inner failure undoes only the
statements after its savepoint, and the outer transaction carries on.

⚠️ **The savepoint is created on entry, not on failure.** Every `NESTED` call
costs a `SAVEPOINT` round trip whether or not anything goes wrong, and a
`RELEASE` on the way out.

## `NESTED` against `REQUIRES_NEW`, difference by difference

This table is the chunk. Every row follows from "one physical transaction with a
savepoint" versus "two physical transactions".

| | `NESTED` | `REQUIRES_NEW` |
|---|---|---|
| physical transactions | **one** | two |
| connections | **one** | **two** |
| pool pressure | **none** | one extra per thread — [chunk 10](10-requires-new.md) |
| inner failure rolls back | only to the savepoint | its whole transaction |
| **outer failure rolls back the inner work** | **YES** | **no** |
| inner commit is durable independently | **no** | yes |
| inner isolation / timeout / read-only | **ignored** (one transaction) | honoured |
| inner locks released early | **no** — held to the outer commit | yes |
| works on | **JDBC managers only, out of the box** | any manager that supports suspension |

🔴 **The bold row is the one that decides most designs.** `NESTED` gives you
partial rollback *within* a transaction; it does **not** give you work that
survives the outer transaction failing. If the outer method throws after the
inner one succeeded, the inner work is rolled back with everything else — because
it was never a separate transaction. An audit row that must survive a failure
needs `REQUIRES_NEW`, and `NESTED` will not do.

## The trade-off

`NESTED` gives you partial rollback for the price of two extra round trips per
call and nothing else — no second connection, no pool arithmetic, no suspension
support required. That is a genuinely cheap way to buy something useful. What you
give up is every form of independence: the inner scope cannot have its own
isolation, timeout or read-only flag, its locks are held until the outer commit,
and its work dies with the outer transaction. **`NESTED` is partial rollback
without independence; `REQUIRES_NEW` is independence at the price of a
connection.** Choosing between them is choosing which of those two you actually
needed — [chunk 11b](11b-choosing-nested.md).

## Gotchas

**⚠️ Expecting `NESTED` work to survive the outer transaction's rollback**
**Symptom:** an audit or progress row disappears when the outer method fails,
despite the `NESTED` annotation.
**Cause:** there is only one physical transaction; the outer rollback undoes
everything.
**Fix:** that requirement needs `REQUIRES_NEW` — [chunk 10b](10b-when-requires-new-is-right.md).

**⚠️ Setting `isolation` or `timeout` on a `NESTED` method**
**Symptom:** silently ignored, exactly as with `REQUIRED`.
**Cause:** there is one physical transaction, and those settings belong to it.
**Fix:** they belong on the outermost boundary — [chunk 8b](08b-whose-settings-win.md).

**⚠️ Expecting locks taken inside the `NESTED` scope to be released on rollback
to savepoint**
**Symptom:** contention that persists after a partial rollback.
**Cause:** rolling back to a savepoint on PostgreSQL undoes the statements but
the transaction retains locks it acquired; they are released at the end of the
physical transaction.
**Fix:** the lock lifetime is the outer transaction's, as it is for every
`REQUIRED` scope.

**⚠️ Assuming `NESTED` avoids `UnexpectedRollbackException`**
**Symptom:** the commit still throws.
**Cause:** it avoids it only where the `NESTED` scope's failure is genuinely
rolled back to the savepoint and the outer scope continues cleanly. If something
else marks the physical transaction rollback-only, nothing changes.
**Fix:** [chunk 9](09-marked-rollback-only.md) — `NESTED` is a fix for that trap,
not an immunity from it.

**⚠️ `NESTED` with no outer transaction**
**Symptom:** nothing nested happens; a plain transaction starts.
**Cause:** the javadoc — "behave like `REQUIRED` otherwise".
**Fix:** expected. The savepoint behaviour only exists relative to an outer
transaction.

**⚠️ Reading "nested transaction" in a blog post and assuming isolation**
**Symptom:** a design that assumes the inner scope cannot see, or be affected by,
the outer one.
**Cause:** the name suggests two transactions; the reference says one physical
transaction with savepoints.
**Fix:** the inner scope shares the connection, the snapshot and the locks. It is
the same transaction.

## Interview questions

**★ What is `PROPAGATION_NESTED`, precisely?**
One physical transaction with savepoints. The reference's words are that it "uses
a single physical transaction with multiple savepoints that it can roll back to",
so that "an inner transaction scope [can] trigger a rollback for its scope, with
the outer transaction being able to continue the physical transaction despite
some operations having been rolled back". Mechanically, entering a `NESTED` scope
issues a `SAVEPOINT`; a failure inside it issues `ROLLBACK TO SAVEPOINT`, undoing
only the statements since that point; a clean exit releases the savepoint. There
is one `BEGIN`, one `COMMIT` and one connection for the whole thing. The name is
misleading — nothing is nested in the sense of a second transaction, which is why
the javadoc notes there is "no analogous feature in EJB".

**★ How does `NESTED` differ from `REQUIRES_NEW`?**
In every way that follows from one physical transaction versus two. `NESTED` uses
one connection, so it adds no pool pressure; `REQUIRES_NEW` takes a second
connection while the outer one is still held, which is where the deadlock rule
comes from. `NESTED`'s inner scope cannot have its own isolation, timeout or
read-only setting because there is only one transaction to carry them;
`REQUIRES_NEW`'s can. `NESTED` releases no locks early; `REQUIRES_NEW` releases
the inner transaction's locks immediately on its completion. And the decisive
difference: if the outer transaction later fails, `NESTED` work is rolled back
with it, because it was never separate, whereas `REQUIRES_NEW` work has already
been committed independently and survives. Partial rollback without independence,
versus independence at the price of a connection.

**★ Why does `NESTED` work only with JDBC transaction managers?**
Because it is implemented with JDBC savepoints. The reference says the setting is
"typically mapped onto JDBC savepoints, so it works only with JDBC resource
transactions", and the `Propagation` javadoc is more specific: "out of the box,
this only applies to the JDBC `DataSourceTransactionManager`", with some JTA
providers possibly supporting it too. So the capability is the database's,
exposed by the driver through `Connection.setSavepoint` and `rollback(Savepoint)`,
and a manager that does not speak JDBC directly has nothing to map it onto.
`JpaTransactionManager` has `nestedTransactionAllowed` false by default and throws
`NestedTransactionNotSupportedException` — which is one of the few settings in
this whole topic that fails loudly rather than silently, and is worth treating as
a clear signal to use a different design.

**★ You want an audit row that survives a failure. Is `NESTED` an option?**
No, and this is the most common misunderstanding of it. `NESTED` work lives in
the same physical transaction as everything else, so when the outer transaction
rolls back, the audit row goes with it — the savepoint protects the outer
transaction from the *inner* failure, not the inner work from the *outer*
failure. The protection runs one way only. Work that must survive the outer
transaction's rollback needs a genuinely separate physical transaction, which is
`REQUIRES_NEW`, with the second connection and the pool arithmetic that come with
it. If the pool cost is unacceptable, the other honest option is to collect the
record in memory and write it after the boundary has ended, accepting that a
process crash loses it.

**★ Does rolling back to a savepoint release the locks taken since it?**
Not in general, and this catches people who expect a savepoint rollback to be a
complete undo. Rolling back to a savepoint undoes the *data changes* made after
it, but the transaction as a whole retains locks it acquired, and those are
released when the physical transaction ends — which under `NESTED` is the outer
boundary's commit or rollback. So a `NESTED` scope that updated a hot row and then
rolled back to its savepoint has undone the update and is still, from the point of
view of other transactions, holding the row. That is another consequence of there
being one physical transaction: lock lifetime is a property of the transaction, and
`NESTED` does not create a new one. `REQUIRES_NEW` is the propagation that
genuinely releases locks early, because its inner transaction really does end.

**★ What happens if the physical transaction is already marked rollback-only when
a `NESTED` scope is entered?**
It fails immediately, before any savepoint exists.
`JdbcTransactionObjectSupport.createSavepoint` checks the flag and throws
`CannotCreateTransactionException` with the message *"Cannot create savepoint for
transaction which is already marked as rollback-only"*. The reasoning is sound: a
savepoint is a promise that the work after it can be discarded while the work
before it survives, and on a transaction already doomed to roll back there is no
"survives" to offer. Practically this means `NESTED` is not a retrofit for a
transaction that something else has already poisoned — if an earlier `REQUIRED`
scope failed and marked the shared transaction rollback-only
([chunk 9](09-marked-rollback-only.md)), a later `NESTED` call does not rescue it
and does not fail quietly either. The exception names the real problem, which is
the earlier failure, not the propagation.

**★ Rolling back to a savepoint undoes statements. Does it undo the rollback-only
flag?**
Yes, and that is the mechanism behind `NESTED` actually curing the trap that
`REQUIRED` plus a `catch` cannot. Spring's `rollbackToSavepoint` does two things:
it calls `connection.rollback(savepoint)` and then calls
`conHolder.resetRollbackOnly()`. So a `NESTED` scope whose failure marked the
shared transaction rollback-only has that mark cleared as part of being rolled
back to its savepoint, and the outer transaction really can carry on and commit.
Under plain `REQUIRED` there is no savepoint and nothing to reset, so the flag
survives the `catch` and surfaces as `UnexpectedRollbackException` at the outer
commit. This is the concrete difference between "I caught the exception and hoped"
and "the inner scope had a boundary the framework could unwind to".

**★ How does Spring know the database supports savepoints, and what happens if it
does not?**
It asks the driver, once per connection, and caches the answer.
`ConnectionHolder.supportsSavepoints()` calls
`getConnection().getMetaData().supportsSavepoints()` the first time and stores the
result; `createSavepoint` then either proceeds or throws
`NestedTransactionNotSupportedException` with the message *"Cannot create a nested
transaction because savepoints are not supported by your JDBC driver"*. The
savepoints Spring creates are named — `ConnectionHolder` increments a counter and
calls `setSavepoint("SAVEPOINT_" + n)` — which is worth knowing only so that a
`SAVEPOINT_3` appearing in a database log is recognised as Spring's and not
somebody's hand-written SQL. Release is deliberately forgiving: Spring's
`releaseSavepoint` swallows `SQLFeatureNotSupportedException`, which its own
comment attributes to Oracle, and ignores SQLSTATE `3B001` — *"savepoint already
released"* on HSQLDB, PostgreSQL and DB2 — rather than failing a transaction that
otherwise succeeded. So the "two round trips per call" cost is an upper bound; on
some stacks the release is a no-op.

---

← Prev: [10c · What suspension costs](10c-what-suspension-costs.md) · Index: [Spring @Transactional](README.md) · Next → [11b · Choosing NESTED](11b-choosing-nested.md)
