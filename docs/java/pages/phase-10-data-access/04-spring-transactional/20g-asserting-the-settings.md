---
title: "A boundary that exists can still have the wrong settings — and the manager reports what the actual transaction got, not what your annotation asked for"
sidebar_label: "20g · Asserting the settings"
sidebar_position: 59
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionSynchronizationManager` javadoc
> ([.../transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html))
> and the `TransactionAspectSupport` javadoc
> ([.../transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**[20f](20f-asserting-the-boundary-exists.md) proved a transaction exists. This chunk
reads its settings back — and the reason that is a separate skill is that there are
two different things to read. One holder tells you what the annotation on this method
declared; the other tells you what the actual resource transaction got. When a
`REQUIRED` call joins an outer boundary, those two disagree, and the disagreement is
the bug you are hunting.**

## Reading the settings back

The same holder answers the other declarative questions, which is how you test that
`readOnly` and `isolation` were actually applied rather than merely written down:

| Method | Javadoc | Catches |
|---|---|---|
| `isActualTransactionActive()` | "whether the current thread is associated with an actual transaction" | a dead annotation, a self-invocation |
| `getCurrentTransactionName()` | "Return the name of the current transaction, or `null` if none set." | *which* method opened the boundary |
| `isCurrentTransactionReadOnly()` | "Return whether the current transaction is marked as read-only." | a `readOnly = true` a participating call silently lost — [15 · Read-only](15-read-only.md) |
| `getCurrentTransactionIsolationLevel()` | "Return the isolation level for the current transaction, if any… or `null` if none" | an `isolation` attribute that lost to an outer boundary — [16 · Isolation](16-isolation.md) |
| `isSynchronizationActive()` | "Return if transaction synchronization is active for the current thread." | ⚠️ **not** a boundary check — true under `SUPPORTS` with no transaction |

Both of the middle two report the state of the *actual* resource transaction, which is
precisely why they catch inheritance bugs: under `PROPAGATION_REQUIRED` an inner
method does not start a new transaction, so an inner `readOnly = true` inside a
read-write outer boundary reports `false`. The assertion fails, and it is right to
fail — see [8b · Whose settings win](08b-whose-settings-win.md).

⚠️ `getCurrentTransactionIsolationLevel()` returns `null` when the boundary did not
override the default, and the javadoc says the value is "according to the JDBC
`Connection` constants (equivalent to the corresponding Spring `TransactionDefinition`
constants)". So an assertion of "isolation is `READ_COMMITTED`" against a default
PostgreSQL setup fails against `null`, not against `2` — the manager exposes what was
*asked for*, not what the database happens to be doing.

## A worked read-only assertion

`@Transactional(readOnly = true)` is the setting most often written and least often
verified, because in the common case nothing observable changes — the reads work
either way. The probe makes it verifiable:

```java
@SpringBootTest                                   // no class-level @Transactional
class CatalogReadOnlyTests {

    @MockitoBean  SearchIndex index;              // a collaborator the query already calls
    @Autowired    CatalogService catalog;

    @Test
    void the_report_query_runs_read_only() {
        AtomicReference<Boolean> readOnly = new AtomicReference<>();
        doAnswer(inv -> {
            readOnly.set(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            return null;
        }).when(index).touch(any());

        catalog.monthlyReport();

        assertThat(readOnly).isTrue();
    }
}
```

There is a second, independent way to read the same flag, and it is worth knowing
because it fires at a different moment. `TransactionSynchronization.beforeCommit` is
handed it as an argument:

> **Parameters:** `readOnly` — whether the transaction is defined as read-only
> transaction

```java
TransactionSynchronizationManager.registerSynchronization(
    new TransactionSynchronization() {
        @Override public void beforeCommit(boolean readOnly) {
            observed.set(readOnly);
        }
    });
```

The difference matters. `isCurrentTransactionReadOnly()` reads the flag *now*, at
whatever depth the call stack happens to be; the callback reads it once, at the
boundary's commit, which is the value that actually governed the unit of work. Where
the two disagree you have a propagation problem, not a read-only problem.

## The one setting the manager will not tell you

There is no `getCurrentTransactionTimeout()`. The remaining deadline is not held on
the synchronization manager at all — it lives on the **resource holder** bound to the
thread, which for a JDBC boundary is the `ConnectionHolder` for the `DataSource`:

```java
ConnectionHolder holder = (ConnectionHolder)
        TransactionSynchronizationManager.getResource(dataSource);

assertThat(holder.hasTimeout()).isTrue();
assertThat(holder.getTimeToLiveInSeconds()).isLessThanOrEqualTo(5);
```

`ResourceHolderSupport`, the base class, is described as being able to "expire after a
certain number of seconds or milliseconds in order to determine a transactional
timeout", and the two accessors are documented as:

> **`hasTimeout()`** — Return whether this object has an associated timeout.
>
> **`getTimeToLiveInSeconds()`** — Return the time to live for this object in seconds.
> Rounds up eagerly, for example, 9.00001 still to 10. **Throws:**
> `TransactionTimedOutException` if the deadline has already been reached.

⚠️ Read that `Throws` clause before writing the assertion. `getTimeToLiveInSeconds()`
does **not** return zero or a negative number once the deadline passes — it throws.
A probe that reads it late in a slow test fails with a `TransactionTimedOutException`
rather than an assertion error, which is a confusing way to learn that the timeout
worked. Assert on `hasTimeout()` when the question is "was a timeout applied at all",
which is the question that catches a `timeout` attribute lost to a participating call
— see [17 · Timeouts](17-timeouts.md).

## The other holder, and when it is the right one

`TransactionAspectSupport.currentTransactionStatus()` looks like an alternative and is
a genuinely different thing. Its javadoc draws the line itself:

> This exposes the locally declared transaction boundary with its declared name and
> characteristics, as managed by the aspect. At runtime, the local boundary may
> participate in an outer transaction: If you need transaction metadata from such an
> outer transaction (the actual resource transaction) instead, consider using
> `TransactionSynchronizationManager`.

So: **`currentTransactionStatus()` answers "what did the annotation on *this* method
declare", `TransactionSynchronizationManager` answers "what is the database actually
doing".** For asserting a boundary exists you want the second. For asserting the
rollback-only flag you want the first, because
`currentTransactionStatus().isRollbackOnly()` is the flag itself — see
[9 · Marked rollback-only](09-marked-rollback-only.md).

And it has a failure mode the other does not. The javadoc: it throws
`NoTransactionException` "if the transaction info cannot be found, because the method
was invoked outside an AOP invocation context". That makes it useless as a boolean
probe — the case you are testing for is the case that throws.

## Gotchas

**⚠️ `currentTransactionStatus()` used as a probe**
**Symptom:** `NoTransactionException` instead of a clean assertion failure.
**Cause:** it throws when invoked outside an AOP invocation context rather than
returning a falsy value.
**Fix:** probe with `TransactionSynchronizationManager`; keep
`currentTransactionStatus()` for the declared boundary — the rollback-only flag, most
often.

**⚠️ Asserting an inner method's `readOnly` or `isolation` under `REQUIRED`**
**Symptom:** the assertion fails on correct code.
**Cause:** a participating call does not start a transaction, so those attributes come
from the outer boundary — the manager reports the *actual* transaction's state.
**Fix:** either assert at the outer boundary, or change the propagation, which is a
production decision and not a test one.

**⚠️ `getTimeToLiveInSeconds()` in a probe that might run late**
**Symptom:** `TransactionTimedOutException` from the assertion itself.
**Cause:** the javadoc: it throws "if the deadline has already been reached" instead
of returning a non-positive number.
**Fix:** assert on `hasTimeout()` for existence; guard the remaining-time assertion, or
do not make one.

**⚠️ `getResource(dataSource)` assumed non-null**
**Symptom:** a `NullPointerException` in the probe on exactly the code path you were
testing for.
**Cause:** with no transaction there is no bound holder, so the lookup returns `null` —
and "no transaction" is the failure you were hunting.
**Fix:** assert `isActualTransactionActive()` first, so the failure message says what
is actually wrong.

**⚠️ Asserting inside a `TransactionSynchronization.beforeCommit`**
**Symptom:** the test reports a rollback or a strange commit-time exception instead of
a clean assertion failure.
**Cause:** the javadoc for `beforeCommit`: exceptions "will get propagated to the
commit caller and cause a rollback of the transaction". An `AssertionError` thrown
there is a rollback trigger.
**Fix:** capture the value in the callback and assert after the boundary closes, in
the test method.

## Interview questions

**★ What is the difference between `TransactionAspectSupport.currentTransactionStatus()`
and `TransactionSynchronizationManager`?**
Declared boundary versus actual transaction. `currentTransactionStatus()` "exposes the
locally declared transaction boundary with its declared name and characteristics, as
managed by the aspect", and the javadoc goes on to say that if you need metadata from
an outer transaction — "the actual resource transaction" — you should use
`TransactionSynchronizationManager` instead. In practice: use the status object when
you care about *this* method's declaration, most often to read or set the
rollback-only flag; use the synchronization manager when you care what the database is
actually doing. The status object also throws `NoTransactionException` outside an AOP
invocation context, so it cannot serve as a boolean probe — the case you are testing
for is the case that throws.

**★ Can this class of assertion catch a wrong propagation setting?**
Partly, and it is worth being precise about which part. `isActualTransactionActive()`
distinguishes "some transaction" from "none", so it catches `NOT_SUPPORTED` and a
`SUPPORTS` with no caller. `getCurrentTransactionName()` distinguishes a new boundary
from a participating call, so it catches a `REQUIRES_NEW` that did not happen,
including one lost to self-invocation. What none of them shows you directly is whether
two calls shared one physical transaction or ran in two, because the manager reports
the current state and not a history. For that you need an assertion from a *separate*
transaction that one half survived and the other did not, which is
[20h](20h-asserting-the-commit.md).

**★ How would you prove that a `@Transactional(readOnly = true)` is actually in
effect?**
Two independent ways, and they answer slightly different questions. From inside the
call stack, `TransactionSynchronizationManager.isCurrentTransactionReadOnly()` —
"Return whether the current transaction is marked as read-only" — read from a
collaborator the method already calls, with the test itself not `@Transactional`. Or
register a `TransactionSynchronization` and capture the `readOnly` argument that
`beforeCommit(boolean readOnly)` is handed, documented as "whether the transaction is
defined as read-only transaction". The first reads the flag at an arbitrary depth of
the stack; the second reads the value that governed the boundary at its commit. If the
two disagree, you have a propagation problem — an inner `readOnly = true` that joined
a read-write outer transaction — not a read-only problem.

**★ How do you assert that a `timeout` attribute was applied? There is no accessor for
it on the synchronization manager.**
Because the deadline is not held there. It is on the resource holder bound to the
thread — the `ConnectionHolder` for the `DataSource` in a JDBC boundary — reachable
via `TransactionSynchronizationManager.getResource(dataSource)`. Its base class
`ResourceHolderSupport` "can expire after a certain number of seconds or milliseconds
in order to determine a transactional timeout", and exposes `hasTimeout()` and
`getTimeToLiveInSeconds()`. Assert on `hasTimeout()`: it answers "was a timeout
applied at all", which is the question that catches a `timeout` silently dropped by a
participating call. Be careful with the time-to-live accessor — it throws
`TransactionTimedOutException` once the deadline has passed rather than returning a
non-positive value.

**★ Why is throwing an assertion inside a transaction synchronization a bad idea?**
Because the callbacks have documented exception contracts and two of them propagate.
`beforeCommit`'s exceptions "will get propagated to the commit caller and cause a
rollback of the transaction", and `afterCommit`'s are propagated too; `beforeCompletion`
and `afterCompletion` have theirs "logged but not propagated", which is worse for a
test — the assertion failure vanishes into a log line and the test passes. So an
assertion inside a synchronization either turns into a rollback or disappears
entirely. The reliable shape is to capture the value in the callback and assert in the
test method after the boundary has closed.

---

← Prev: [20f · Asserting the boundary exists](20f-asserting-the-boundary-exists.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20h · Asserting the commit](20h-asserting-the-commit.md)
