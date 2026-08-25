---
title: "NESTED does the job REQUIRES_NEW is usually hired for, at one connection instead of two — unless you are on JPA, where it throws"
sidebar_label: "11b · Choosing NESTED"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)),
> the `DataSourceTransactionManager` javadoc
> ([.../org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html))
> the Spring Framework 7.0 reference *Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html))
> and the `JpaTransactionManager`, `AbstractPlatformTransactionManager` and
> `JdbcTransactionObjectSupport` sources
> ([github.com/spring-projects/spring-framework/.../orm/jpa/JpaTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-orm/src/main/java/org/springframework/orm/jpa/JpaTransactionManager.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 11](11-nested-and-savepoints.md) established what `NESTED` is: one
physical transaction with savepoints. This chunk is the decision. The short
version is that `NESTED` does most of what `REQUIRES_NEW` is actually hired for —
partial rollback — at one connection instead of two and with no pool arithmetic,
and that the reason it is used so rarely is that fewer people know it exists. The
long version includes the one stack where it simply does not work.**

## Where `NESTED` is the right answer

The shape is: **a unit of work that is genuinely one transaction, containing
optional steps whose individual failure should not abort the whole.**

- A batch import where a bad row is skipped, but the whole import is still one
  atomic unit that must succeed or fail together at the end.
- A multi-step process with a "best effort" step — enriching a record from a
  secondary table that may be missing.
- Anywhere you would reach for `REQUIRES_NEW` purely to get partial rollback, and
  do **not** need independent durability.

**That last one is the practical value of knowing `NESTED` exists.** It does the
same job with one connection instead of two and no pool arithmetic — see
[chunk 10b](10b-when-requires-new-is-right.md) for how often `REQUIRES_NEW` is
chosen for exactly this.

## What JPA does with it

Be precise here, because the usual summary — "JPA does not support savepoints" —
is not what Spring says. `JpaTransactionManager`'s own javadoc:

> *"This transaction manager supports nested transactions via JDBC Savepoints.
> The `nestedTransactionAllowed` flag defaults to `false`, though, since nested
> transactions will just apply to the JDBC Connection, not to the JPA
> EntityManager and its cached entity objects and related context. … do not
> expect JPA access code to semantically participate in a nested transaction."*

So the capability exists and is switched off, and the reason it is switched off
is not a missing feature — it is that **a savepoint rollback is invisible to the
persistence context.** With the flag left alone, a `NESTED` request fails with
`NestedTransactionNotSupportedException`.

⚠️ **This is one of the few settings in this topic that fails loudly**, which is
a mercy. Turning the flag on removes the exception and not the underlying
mismatch: `ROLLBACK TO SAVEPOINT` undoes the *database* statements, and it does
not un-manage, un-dirty or evict anything the `EntityManager` is tracking. The
in-memory state and the database then disagree, and the next flush can reapply
changes that were meant to be undone. **On JPA, prefer `REQUIRES_NEW` or a
restructured boundary.**

## `nestedTransactionAllowed`

`DataSourceTransactionManager` exposes a flag, and its default is the helpful
one:

| Manager | `nestedTransactionAllowed` default |
|---|---|
| `DataSourceTransactionManager` / `JdbcTransactionManager` | **`true`** |
| `JpaTransactionManager` | `false` |

So on a plain JDBC stack `NESTED` works with no configuration. If it throws
`NestedTransactionNotSupportedException` on such a stack, somebody set the flag
to `false` deliberately — check the manager's configuration before blaming the
propagation.

## The decision

**"If the outer transaction fails later, should this inner work survive?"**

| Answer | Propagation | Cost |
|---|---|---|
| no — I only need a failed step not to kill the batch | **`NESTED`** | two round trips per call; JDBC managers only |
| yes — this must be committed independently | `REQUIRES_NEW` | a second connection per thread, plus pool sizing |
| the inner step's failure should kill the batch | plain `REQUIRED`, no `catch` | nothing |

🔴 **Most uses of `REQUIRES_NEW` answer "no" to that question.** They were chosen
for partial rollback, and paid for independence they did not need.

## The trade-off

`NESTED` is cheap and narrow. Cheap: no extra connection, no suspension support
required, no pool arithmetic, and the round-trip cost is two statements per call.
Narrow: JDBC managers only out of the box, no independent durability, no own
isolation or timeout, no early lock release. That combination makes it a good
default for the specific job of *skipping a failed step inside one atomic unit of
work* and useless for anything else. The reason to know it exists is not that it
is often the answer — it is that when it *is* the answer, the alternative people
reach for costs a connection per thread and a deadlock risk, for a capability
they were not using.

## Gotchas

**⚠️ `NestedTransactionNotSupportedException` on JPA**
**Symptom:** the annotation compiles and fails at runtime.
**Cause:** `JpaTransactionManager` has `nestedTransactionAllowed` false by
default and savepoints are not supported out of the box.
**Fix:** `REQUIRES_NEW`, or restructure. This is the rare loud failure — take the
hint.

**⚠️ The same exception on a JDBC stack**
**Symptom:** `NESTED` fails where the documentation says it should work.
**Cause:** somebody set `nestedTransactionAllowed` to `false` on the manager.
**Fix:** check the manager bean before assuming the propagation is unsupported.

**⚠️ Forcing savepoint support on a JPA provider and trusting it**
**Symptom:** the database is rolled back to the savepoint and the persistence
context still holds the entities as if the changes had happened.
**Cause:** `ROLLBACK TO SAVEPOINT` undoes SQL; it does not un-manage or un-dirty
entities the `EntityManager` is tracking.
**Fix:** on JPA, prefer `REQUIRES_NEW` or a restructured boundary. This
disagreement between the persistence context and the database is not something
the savepoint model helps with.

**⚠️ Using `NESTED` in a large loop and being surprised by the round trips**
**Symptom:** measurable slowdown proportional to the item count.
**Cause:** `SAVEPOINT` and `RELEASE SAVEPOINT` per call, whether or not a
rollback happens.
**Fix:** if failures are rare and a bad item should abort, plain `REQUIRED`
without a `catch` is cheaper. `NESTED` buys skipping, and skipping costs round
trips.

**⚠️ Choosing `NESTED` for the pool saving without checking the manager**
**Symptom:** a change made to relieve pool pressure fails at startup or on the
first call.
**Cause:** the saving is real and it is only available on a JDBC manager.
**Fix:** confirm the manager type first — [chunk 6c](06c-what-boot-picked-for-you.md).

**⚠️ Assuming `nestedTransactionAllowed` is a global setting**
**Symptom:** `NESTED` working against one data source and not another.
**Cause:** the flag is per manager bean, and an application with two data sources
has two managers.
**Fix:** set it on each manager you mean it for.

**⚠️ Treating `NESTED` as a general replacement for `REQUIRES_NEW`**
**Symptom:** an audit or progress row that was surviving failures stops
surviving them after a "cheaper" refactor.
**Cause:** the two are not interchangeable in the direction that matters —
`NESTED` has no independent durability.
**Fix:** the decision question above, asked per call site rather than per
codebase.

## Interview questions

**★ When would you choose `NESTED` over `REQUIRES_NEW`?**
Whenever what you actually need is partial rollback rather than independent
durability — which, in my experience, is most of the time somebody reaches for
`REQUIRES_NEW`. The shape is a real unit of work containing optional steps: a
batch import that must be atomic overall but should skip a malformed row, or a
multi-step process with a best-effort enrichment step. `NESTED` gives that for two
extra round trips per call and one connection, where `REQUIRES_NEW` gives it for
a second connection per thread and a pool-sizing constraint whose violation is a
deadlock. The question that separates them is simply "if the outer transaction
fails later, should this inner work survive?" — yes means `REQUIRES_NEW`, no
means `NESTED`, and the answer is no more often than the usage suggests.

**★ What does `NESTED` cost, given it needs no extra connection?**
Two round trips per invocation: a `SAVEPOINT` on entry and a `RELEASE SAVEPOINT`
on clean exit, plus a `ROLLBACK TO SAVEPOINT` when something fails. Crucially the
savepoint is created on *entry*, not lazily on failure, so a loop of ten thousand
`NESTED` calls pays twenty thousand extra round trips even if nothing ever fails.
There is also a smaller cost on the database side, since maintaining savepoints
inside a long transaction is not free. None of that matters for a handful of
calls; it matters a great deal in a tight loop, and it is the reason that if
failures are rare and a bad item *should* abort the batch, plain `REQUIRED` with
no `catch` is both simpler and faster. `NESTED` buys the ability to skip, and
skipping has a per-item price.

**★ Why is `NESTED` a poor fit for JPA specifically?**
Two reasons, and the second is the deeper one. Mechanically,
`JpaTransactionManager` defaults `nestedTransactionAllowed` to false and the
`Propagation` javadoc says nested transactions apply "out of the box" only to
`DataSourceTransactionManager`, so a `NESTED` request throws
`NestedTransactionNotSupportedException`. That much is a configuration question
and can sometimes be worked around. The real problem is that a savepoint rollback
operates on the *database*, and JPA maintains a persistence context in memory that
knows nothing about it: entities loaded, dirtied or flushed before the savepoint
rollback remain managed and remain dirty afterwards, so the in-memory state and
the database state disagree, and the next flush can reapply changes that were
supposed to be undone. Spring cannot reconcile that, so on JPA the honest options
are `REQUIRES_NEW` or a restructured boundary.

**★ Someone proposes replacing every `REQUIRES_NEW` in a codebase with `NESTED`
to relieve pool pressure. What do you say?**
That the instinct is good and the blanket application is wrong. The pool saving is
real — one connection per thread instead of two, and the deadlock rule stops
applying — and for every call site that was using `REQUIRES_NEW` purely to skip a
failed step, the swap is a straight improvement. But `NESTED` has no independent
durability, so any call site that exists because its work must survive the outer
transaction's rollback would break silently: the audit row that documented the
failure would now be rolled back with it, which is exactly the bug
`REQUIRES_NEW` was preventing. So it is a per-call-site decision, driven by the
one question about whether the inner work must survive. And it needs the manager
checked first, because on JPA the swap does not work at all.

**★ How would you audit a codebase to find `REQUIRES_NEW` that should be
`NESTED`?**
Find every `REQUIRES_NEW` and, for each, ask what happens to that work if the
outer transaction fails afterwards. If nothing downstream depends on the inner
work having survived — no audit trail, no idempotency marker, no external
notification keyed off it — then the independence is unused and `NESTED` does the
same job for one connection. Two signals speed the triage up. A `REQUIRES_NEW`
inside a loop is almost always about skipping failures, not durability. And a
commit message or comment mentioning `UnexpectedRollbackException` is a strong
indicator that the propagation was chosen to silence a symptom, in which case the
right answer may be neither propagation but a moved boundary. Check the manager
type before proposing any of it.

**★ Is `NESTED` worth using if there is no outer transaction?**
There is nothing to gain. The javadoc says it will "behave like `REQUIRED`
otherwise", so with no current transaction it simply starts one and no savepoint
is involved. Writing `NESTED` on a method that is always the outermost boundary is
therefore just a confusing way to write `REQUIRED`. Where it does say something
useful is on a method that is *sometimes* called from inside a transaction and
sometimes not: it declares "when I am inside a transaction, my failure should not
kill it", which is a real statement of intent that `REQUIRED` cannot make. The
cost of that declaration is the savepoint round trips on the calls where an outer
transaction exists, and the constraint that the application must be on a JDBC
manager.

**★ Can you turn `NESTED` on for JPA, and what exactly do you get if you do?**
You can, and what you get is savepoints on the JDBC `Connection` and nothing
else. `JpaTransactionManager` inherits `setNestedTransactionAllowed` and its own
javadoc says it "supports nested transactions via JDBC Savepoints", with the flag
defaulting to `false` "since nested transactions will just apply to the JDBC
Connection, not to the JPA EntityManager and its cached entity objects and related
context" — and it finishes with the instruction "do not expect JPA access code to
semantically participate in a nested transaction". Two things follow. You also
need a `DataSource` on the manager, because the savepoint is taken on a JDBC
connection Spring must be able to reach; without one the failure is a
`TransactionUsageException`, not a missing feature. And even fully wired, the
persistence context is not part of the unwind: an entity you loaded and dirtied
before the savepoint is still managed and still dirty after the rollback to it, so
the next flush can re-issue the statements the savepoint rollback just removed.
That is not a bug Spring can fix — the savepoint lives in the database and the
first-level cache lives in the `EntityManager`, and nothing connects them.

**★ You get an exception on a `NESTED` call. How do you tell the three causes
apart?**
By reading the message, because Spring uses a different one for each. *"Transaction
manager does not allow nested transactions by default - specify
'nestedTransactionAllowed' property with value 'true'"* comes from
`AbstractPlatformTransactionManager` and means the flag is off — the default on
`JpaTransactionManager`, and on a JDBC manager it means somebody turned it off
deliberately. *"Cannot create a nested transaction because savepoints are not
supported by your JDBC driver"* comes from `JdbcTransactionObjectSupport` after it
asked `DatabaseMetaData.supportsSavepoints()`, and means the flag is on but the
driver cannot do it. *"Cannot create nested transaction when not exposing a JDBC
transaction"* — a `TransactionUsageException` rather than a
`NestedTransactionNotSupportedException` — means the manager allows nesting but
there is no JDBC connection bound for it to take a savepoint on, which is what a
`JpaTransactionManager` with the flag flipped and no `DataSource` configured
produces. Three configuration mistakes, three distinct sentences, and each names
the thing to change.

---

← Prev: [11 · NESTED and savepoints](11-nested-and-savepoints.md) · Index: [Spring @Transactional](README.md) · Next → [12 · The other propagations](12-the-other-propagations.md)
