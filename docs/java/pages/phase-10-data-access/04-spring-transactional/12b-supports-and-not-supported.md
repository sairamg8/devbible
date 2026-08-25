---
title: "SUPPORTS and NOT_SUPPORTED adapt to whatever they find, and both cost something their one-line definitions never mention"
sidebar_label: "12b · SUPPORTS and NOT_SUPPORTED"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)),
> the `TransactionSynchronizationManager` javadoc
> ([.../org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html))
> the Spring Framework 7.0 reference *Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html))
> and the `AbstractPlatformTransactionManager` javadoc and source
> ([github.com/spring-projects/spring-framework/.../transaction/support/AbstractPlatformTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/support/AbstractPlatformTransactionManager.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 12](12-the-other-propagations.md) covered the two assertions. These two
adapt instead of refusing, which is what makes them look like the safe choices
and is exactly why they are worth reading carefully. `NOT_SUPPORTED` carries the
same connection-pool arithmetic as `REQUIRES_NEW` and the same suspension caveat,
neither of which is in its one-line definition. And `SUPPORTS` with no
transaction is **not** the same as no annotation — it opens a synchronization
scope, and that has a visible effect on connections.**

## `NOT_SUPPORTED` — the same intent, but it copes

Where `NEVER` refuses, `NOT_SUPPORTED` suspends:

```java
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public Report generateHeavyReport(ReportSpec spec) { ... }
```

Called inside a transaction, the outer transaction is suspended, this method runs
with no transaction, and the outer one resumes afterwards.

⚠️ **Suspension does not release the outer connection** — the same fact that makes
`REQUIRES_NEW` dangerous ([chunk 10](10-requires-new.md)). The outer connection
stays bound while this method runs, and this method's own queries take a *second*
connection from the pool. **`NOT_SUPPORTED` has the same pool arithmetic as
`REQUIRES_NEW`**, which is almost never mentioned alongside it.

🔴 **And it needs a manager that can suspend.** The javadoc's note applies to
`NOT_SUPPORTED` exactly as it does to `REQUIRES_NEW`: suspension "will not work
out-of-the-box on all transaction managers", in particular `JtaTransactionManager`
without a `jakarta.transaction.TransactionManager` made available to it.

## `SUPPORTS` — and the subtlety that makes it non-obvious

"Join a transaction if there is one, otherwise run without" sounds like the safest
possible setting, which is why it gets used as a default by people who want to
avoid thinking. The javadoc's note is the reason it is not:

> *"For transaction managers with transaction synchronization, `SUPPORTS` is
> slightly different from no transaction at all, as it defines a transaction
> scope that synchronization will apply for. As a consequence, the same resources
> (JDBC Connection, Hibernate Session, etc) will be shared for the entire
> specified scope."*

So `SUPPORTS` with no existing transaction is **not** the same as no annotation:

| | No annotation | `SUPPORTS`, no outer transaction |
|---|---|---|
| physical transaction | none | none |
| synchronization scope | none | **yes** |
| connection | one per operation, released each time | **one, shared across the scope** |
| `isActualTransactionActive()` | false | **false** |
| `isSynchronizationActive()` | false | **true** |

**The connection sharing is the real effect.** Three `JdbcTemplate` calls in an
unannotated method may use three different pooled connections; inside a
`SUPPORTS` scope they share one. That is sometimes what you want — consistent
reads across several queries without paying for a transaction — and it is a
subtle thing to have happen by accident.

🔴 **This is also why `isSynchronizationActive()` is the wrong check for "am I in
a transaction"** — [chunk 5b](05b-detecting-a-dead-annotation.md). Under
`SUPPORTS` it is true and there is no transaction at all. What Spring actually
builds in that case has a name and a set of consequences of its own:
[chunk 12c](12c-the-empty-transaction.md).

⚠️ **The javadoc's last sentence is a real caveat**: "this depends on the actual
synchronization configuration of the transaction manager". The behaviour is not
guaranteed by the propagation alone.

## The decision table

| You want | Propagation |
|---|---|
| the ordinary case: join or start | `REQUIRED` |
| independent commit, must survive an outer rollback | `REQUIRES_NEW` |
| partial rollback inside one atomic unit | `NESTED` |
| **this must never run without a boundary — fail if it does** | **`MANDATORY`** |
| this must never run inside one — fail if it does | `NEVER` |
| this must not be in a transaction, and cope if there is one | `NOT_SUPPORTED` |
| join if there is one, otherwise just share a connection | `SUPPORTS` |

## The trade-off

Both of these buy flexibility — a method carrying either can be called from
anywhere and will do something sensible. That is genuinely useful and it is also
the reason they hide problems: a method that adapts never tells you it was called
from somewhere it should not have been. `NOT_SUPPORTED` additionally buys its
flexibility with a second connection while the outer one is held, which makes it
the most expensive way to express "keep this out of the transaction" —
restructuring so the call is outside the boundary costs nothing and achieves
more. And `SUPPORTS` buys its flexibility by declining to decide, which is fine
when the decision genuinely does not matter and is otherwise a decision deferred
to whoever calls the method next.

## Gotchas

**⚠️ Using `SUPPORTS` as a "safe default"**
**Symptom:** methods that are transactional when called one way and not another,
with nothing marking the difference.
**Cause:** `SUPPORTS` deliberately declines to have an opinion.
**Fix:** decide. `REQUIRED` if the work needs atomicity; `MANDATORY` if the
caller owns the boundary; no annotation if it genuinely does not matter.

**⚠️ Assuming `SUPPORTS` with no transaction is the same as no annotation**
**Symptom:** a connection held across several operations where you expected one
per statement.
**Cause:** `SUPPORTS` opens a synchronization scope, and the javadoc says "the
same resources (JDBC Connection, Hibernate Session, etc) will be shared for the
entire specified scope".
**Fix:** know that this is the actual effect of `SUPPORTS` outside a transaction,
and use it deliberately or not at all.

**⚠️ Checking `isSynchronizationActive()` to detect a transaction**
**Symptom:** a false positive under `SUPPORTS`.
**Cause:** synchronization is active and there is no physical transaction.
**Fix:** `isActualTransactionActive()` —
[chunk 5b](05b-detecting-a-dead-annotation.md).

**⚠️ Relying on the `SUPPORTS` connection sharing as a guarantee**
**Symptom:** the shared-connection behaviour differs between environments or
after a manager change.
**Cause:** the javadoc's final sentence — "this depends on the actual
synchronization configuration of the transaction manager".
**Fix:** if consistent reads across several queries matter, use a real read-only
transaction rather than depending on synchronization configuration.

**⚠️ `NOT_SUPPORTED` used to relieve connection pressure**
**Symptom:** pressure gets worse.
**Cause:** the outer connection stays bound while the suspended-from method takes
a second one. Same arithmetic as `REQUIRES_NEW`.
**Fix:** move the work outside the boundary entirely rather than suspending
inside it.

**⚠️ `NOT_SUPPORTED` or `REQUIRES_NEW` on a manager that cannot suspend**
**Symptom:** an exception, or behaviour that does not match the annotation.
**Cause:** the javadoc's note — suspension is not universal, notably for
`JtaTransactionManager` without a `jakarta.transaction.TransactionManager`.
**Fix:** confirm suspension support before relying on either.

**⚠️ Expecting `NOT_SUPPORTED` work to be rolled back with the outer
transaction**
**Symptom:** writes made inside a `NOT_SUPPORTED` method survive an outer
rollback.
**Cause:** it runs with no transaction at all, so its statements are in
autocommit.
**Fix:** that is what "execute non-transactionally" means. It is `REQUIRES_NEW`
without even the courtesy of a commit boundary.

**⚠️ Reading data in a `NOT_SUPPORTED` method and expecting to see the outer
transaction's writes**
**Symptom:** a query cannot find rows the caller just inserted.
**Cause:** a different connection and no transaction, so the outer transaction's
uncommitted work is invisible.
**Fix:** pass the data in, or do not suspend.

**⚠️ `SUPPORTS` on a write method**
**Symptom:** writes that are atomic when called one way and individually
committed when called another.
**Cause:** the propagation makes atomicity a property of the caller.
**Fix:** a write that needs atomicity should be `REQUIRED` or `MANDATORY`.
`SUPPORTS` on a write is almost always a mistake.

## Interview questions

**★ Is `SUPPORTS` with no transaction the same as having no annotation at all?**
No, and the javadoc calls this out explicitly: `SUPPORTS` is "slightly different
from no transaction at all, as it defines a transaction scope that
synchronization will apply for. As a consequence, the same resources (JDBC
Connection, Hibernate Session, etc) will be shared for the entire specified
scope." So there is still no physical transaction and nothing is committed, but a
synchronization scope exists, and the practical effect is that several operations
inside the method share one connection instead of borrowing and returning one
each. That can be desirable — consistent reads across several queries without
paying for a transaction — but it is a subtle thing to acquire accidentally. It
is also why `isSynchronizationActive()` is the wrong check for "am I in a
transaction": under `SUPPORTS` it is true and `isActualTransactionActive()` is
false.

**★ What is the difference between `NEVER` and `NOT_SUPPORTED`?**
Both express "this work should not be in a transaction", and they differ in what
they do when it is. `NEVER` throws — it is an assertion that the caller has made
a mistake. `NOT_SUPPORTED` copes: it suspends the existing transaction, runs the
method non-transactionally, and resumes the outer transaction afterwards. So
`NEVER` is the right choice when a transactional caller genuinely indicates a bug
you want to find, and `NOT_SUPPORTED` when the call is legitimate and the work
simply must not participate. The catch that is rarely mentioned is that
`NOT_SUPPORTED` carries the same costs as `REQUIRES_NEW`: suspension does not
release the outer connection, so the thread holds two, and the javadoc's note
about suspension not working out of the box on all transaction managers applies
to it as well.

**★ Would `NOT_SUPPORTED` be a good way to keep a long report query out of a
transaction?**
Only as a defensive measure, not as the primary design. It does prevent the
report from running inside the transaction, which is genuinely valuable — a long
analytical read inside a write transaction holds a snapshot and a connection for
its whole duration and can block vacuum or bloat the database's view of active
transactions. But suspension keeps the outer connection checked out while the
report runs on a second one, so the thread now holds two connections for the
length of the report, which is the worst version of the pool arithmetic. The
better design is not to call the report from inside a transactional method at all
— move it out of the boundary — with `NEVER` on the report method to make sure
nobody puts it back in.

**★ Which propagations depend on the transaction manager, and how?**
Three. `NESTED` needs savepoints, and the javadoc says nested transactions apply
"out of the box" only to the JDBC `DataSourceTransactionManager`, with some JTA
providers possibly supporting them. `REQUIRES_NEW` and `NOT_SUPPORTED` both need
suspension, and both carry the same note: "actual transaction suspension will not
work out-of-the-box on all transaction managers. This in particular applies to
`JtaTransactionManager`, which requires the
`jakarta.transaction.TransactionManager` to be made available to it." The other
four — `REQUIRED`, `SUPPORTS`, `MANDATORY`, `NEVER` — need nothing beyond the
ability to start a transaction and inspect whether one exists, so they work on
every manager. Knowing which is which matters because a propagation that is
unsupported is one of the few things in this topic that fails loudly rather than
silently, and recognising the exception saves looking for the wrong bug.

**★ Is there any good use of `SUPPORTS`?**
A narrow one: a read-only helper that is genuinely correct either way, where you
want several queries to share a connection when it is called standalone and to
join the caller's transaction when it is not. A lookup that resolves a few
reference tables fits — the reads are consistent enough inside one connection,
and inside a transaction they see the caller's snapshot, which is what you want.
What makes it defensible there is that both outcomes are acceptable. The reason
it is a bad general default is that for most methods both outcomes are not
acceptable: a write either needs atomicity or does not, and `SUPPORTS` makes that
a property of whoever calls it. And because it is silent, the day somebody calls
the method from a new place, the change in behaviour arrives with no signal at
all.

**★ While a `NOT_SUPPORTED` method runs, how many connections does the thread
hold?**
Two, and the second one is held for the whole scope rather than borrowed per
statement — which is the part people miss. The outer transaction is suspended, so
its connection stays checked out with its transaction, its locks and its snapshot
intact. The `NOT_SUPPORTED` scope itself is created by `prepareTransactionStatus`
with `newSynchronization = (getTransactionSynchronization() ==
SYNCHRONIZATION_ALWAYS)`, and `SYNCHRONIZATION_ALWAYS` is the documented default —
"Set when this transaction manager should activate the thread-bound transaction
synchronization support. Default is 'always'." So synchronization is active for
the scope, and the javadoc's consequence applies: "the same resources (JDBC
Connection, Hibernate Session, etc) will be shared for the entire specified
scope". One connection is bound for the duration, in autocommit, alongside the
suspended one. That is the same peak as `REQUIRES_NEW`, held for the same reason,
and it is why `NOT_SUPPORTED` is the wrong tool for relieving pool pressure.
Setting the manager to `SYNCHRONIZATION_ON_ACTUAL_TRANSACTION` would stop the
empty scope from binding a connection, at the price of changing the behaviour of
every `SUPPORTS` scope in the application.

---

← Prev: [12 · The other propagations](12-the-other-propagations.md) · Index: [Spring @Transactional](README.md) · Next → [12c · The empty transaction](12c-the-empty-transaction.md)
