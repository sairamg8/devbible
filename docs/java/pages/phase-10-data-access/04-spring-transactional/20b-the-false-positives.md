---
title: "The test passes because nothing was ever flushed — the same code throws in production, and Spring's own documentation warns about exactly this"
sidebar_label: "20b · The false positives"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `TestTransaction` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html)),
> the Jakarta Persistence 3.2 `FlushModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/.../flushmodetype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/flushmodetype))
> and the PostgreSQL 18 manual *SET CONSTRAINTS*
> ([postgresql.org/docs/18/sql-set-constraints.html](https://www.postgresql.org/docs/18/sql-set-constraints.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**A rolled-back test transaction never commits, so it often never flushes, so the
database never sees most of your statements. Everything the database would have
rejected — a not-null violation, a unique index, a foreign key — is never checked.
The test is green and the code is broken.**

## The warning, in the reference's own words

Under the heading *Avoid false positives when testing ORM code*:

> When you test application code that manipulates the state of a Hibernate session
> or JPA persistence context, make sure to flush the underlying unit of work within
> test methods that run that code. Failing to flush the underlying unit of work can
> produce false positives: Your test passes, but the same code throws an exception
> in a live, production environment. Note that this applies to any ORM framework
> that maintains an in-memory unit of work.

That is unusually direct for a reference manual, and it is direct because the
failure is common and expensive.

## Why it happens

JPA does not write when you call `save`. It puts the entity in the persistence
context and writes at **flush** time, which normally happens before the commit.
In a test that never commits, the flush that would have run at commit never runs
either — so the `INSERT` is never sent, and the database never gets the chance to
reject it.

Concretely, none of these are checked in a never-flushed test:

- `NOT NULL` on a column your mapping made optional
- a unique index the code violates
- a foreign key pointing at a row that was not created
- a `CHECK` constraint
- a column too short for the value
- a cascade that should have persisted a child and does not

All of them are database-side, and the database was never asked.

## Why some of these tests pass anyway, which is worse

The default flush mode is not "flush at commit". Jakarta Persistence defines
`FlushModeType.AUTO` as the default and describes it in four words:

> (Default) Flushing to occur at query execution.

So a pending `INSERT` **is** flushed the moment the test runs a JPQL or Criteria
query whose result it could affect. That is why the behaviour looks erratic: a
test that saves and then runs a repository *query* method usually flushes by
accident and catches the constraint; a test that saves and then asserts on the
returned object, or looks it up by id, does not. The same suite therefore contains
tests that are honest and tests that are lying, with nothing in the source to tell
them apart. `FlushModeType.COMMIT` — "Flushing to occur at transaction commit. The
provider may flush at other times, but is not required to." — removes even the
accidental protection.

The lesson is not "queries save you". It is that an implicit flush is not
something to rely on, because whether it happens depends on the shape of the
assertion rather than on the code under test.

## The fix

Force the flush inside the test, and clear the persistence context so that reads
go back to the database rather than to the in-memory copy:

```java
@Autowired EntityManager em;

@Test
@Transactional
void rejects_duplicate_sku() {
    products.create(new NewProduct("SKU-1"));
    em.flush();                      // ← statements actually reach the database

    assertThatThrownBy(() -> {
        products.create(new NewProduct("SKU-1"));
        em.flush();
    }).isInstanceOf(DataIntegrityViolationException.class);
}
```

```java
@Test
@Transactional
void persists_all_the_columns() {
    long id = products.create(new NewProduct("SKU-1"));
    em.flush();
    em.clear();                      // ← forget the in-memory instance

    Product reloaded = repository.findById(id).orElseThrow();
    assertThat(reloaded.getSku()).isEqualTo("SKU-1");
}
```

The `clear()` matters as much as the `flush()`, and for a different reason. Without
it, `findById` may be answered from the persistence context's first-level cache —
returning the very object you just saved, from memory, without touching the
database. A test that asserts on that object is asserting that Java assignment
works. `clear()` detaches everything, so the read is a real read.

`saveAndFlush(...)` on a Spring Data repository does the same job as
`save(...)` + `flush()` and is often more readable at a call site.

## What a flush still will not catch

A flush moves the statements to the database. It does not move the *commit*, and a
few checks only happen at commit:

- **Deferred constraints.** PostgreSQL lets a constraint be declared
  `DEFERRABLE INITIALLY DEFERRED`, and the manual's `SET CONSTRAINTS` page is
  blunt about it: "DEFERRED constraints are not checked until transaction commit."
  A flushed-but-uncommitted test never reaches that point, so the violation is
  never raised.
- **`AFTER_COMMIT` event listeners.** They are bound to a commit that never
  happens — see [19 · Transactional events](19-transactional-events.md).
- **Visibility to any other connection.** Uncommitted rows are invisible outside
  the transaction that wrote them, so any assertion that reaches the database on a
  second connection sees nothing.
- **Anything a database trigger defers**, and any constraint the schema arms with
  `SET CONSTRAINTS ALL DEFERRED` for the session.

For those, the test has to genuinely commit — `TestTransaction.flagForCommit()`
then `end()` — and then take responsibility for cleaning up, which is exactly the
cost the default rollback exists to avoid. Reserve it for the handful of tests
that need it.

## The trade-off

Adding flushes and clears to tests makes them longer, noisier and coupled to the
persistence mechanism — a test that calls `em.flush()` is admitting it knows JPA
is underneath. Purists dislike that, and they have a point.

The alternative is a suite that cannot detect any database-enforced constraint,
which is most of the invariants a real schema has. Between a test that is honest
about its mechanism and a test that is elegant and green while the code is broken,
the first is worth the noise. Keeping the flush at the boundaries — one after the
arrange step, one where the assertion needs it — limits how much it spreads.

## Gotchas

**⚠️ A test that never flushes**
**Symptom:** green tests, and a constraint violation on the first production
request.
**Cause:** the test transaction never commits, so the flush never happens and the
statements never reach the database.
**Fix:** `em.flush()` (or `saveAndFlush`) in tests that exercise persistence.

**⚠️ Reading back without clearing**
**Symptom:** an assertion that passes even when the mapping is wrong.
**Cause:** `findById` was answered from the first-level cache with the instance you
just saved — no `SELECT` was issued.
**Fix:** `em.clear()` after the flush, so the read is a real read.

**⚠️ One test in the file catches the constraint and its neighbour does not**
**Symptom:** apparently identical tests behave differently.
**Cause:** `FlushModeType.AUTO` flushes at query execution, so whichever test
happens to run a query flushes by accident. Nothing in the source says so.
**Fix:** flush explicitly in both. Never rely on the implicit flush.

**⚠️ Expecting a flush to be enough for deferred constraints**
**Symptom:** a constraint that still is not checked despite a flush.
**Cause:** "DEFERRED constraints are not checked until transaction commit", so a
test that never commits never triggers one.
**Fix:** for those specific constraints, the test must actually commit —
`TestTransaction.flagForCommit()` and `end()`, with cleanup.

**⚠️ `flush()` called on the repository instead of the entity manager, in a test
with no boundary**
**Symptom:** `saveAndFlush` throws about there being no transaction.
**Cause:** the test method is not `@Transactional`, so there is no persistence
context to flush into.
**Fix:** annotate the test (or the class), which is what makes the whole rollback
mechanism apply in the first place.

**⚠️ Cleaning up with `deleteAll()` instead of relying on rollback**
**Symptom:** slow suites, and occasional failures when a test's data was expected
by another.
**Cause:** manual cleanup reimplements what the rollback already does, badly.
**Fix:** keep the default rollback. Reach for explicit cleanup only where you
deliberately committed.

**⚠️ Switching the whole application to `FlushModeType.COMMIT` to "reduce flushes"**
**Symptom:** every one of these false positives gets worse, and queries start
returning stale results in production too.
**Cause:** `COMMIT` mode removes the accidental flush before a query, so unflushed
changes are invisible to your own queries.
**Fix:** leave the flush mode at `AUTO` and control flushing at the few call sites
that need it.

## Interview questions

**★ Why can a JPA test pass while the same code fails in production?**
Because the test's transaction is rolled back and therefore usually never flushed,
so the `INSERT` and `UPDATE` statements are never sent to the database and no
database-enforced constraint is ever evaluated. The Spring reference warns about
it explicitly: "Failing to flush the underlying unit of work can produce false
positives: Your test passes, but the same code throws an exception in a live,
production environment." Everything the schema enforces — not-null, unique, foreign
key, check — is invisible to such a test.

**★ Then why do some of those tests catch the constraint anyway?**
Because the default flush mode is `FlushModeType.AUTO`, defined by Jakarta
Persistence as "(Default) Flushing to occur at query execution". If the test runs a
query after the save — a derived repository finder that issues JPQL, for example —
the provider flushes first so the query sees the pending change, and the constraint
fires. A test that saves and then asserts on the returned object, or fetches by id
from the first-level cache, never triggers that. So whether a test is honest
depends on the shape of its assertion, not on the code under test, which is why the
behaviour looks random and why the implicit flush must never be relied on.

**★ What is the fix, and why is `clear()` part of it?**
`flush()` sends the pending statements so the database actually evaluates them.
`clear()` detaches everything from the persistence context, so a subsequent read
issues a real `SELECT` instead of being answered from the first-level cache with
the object you just saved. Without the flush the database is never consulted;
without the clear the read never leaves memory. Together they make the test
exercise the same path production does.

**★ Is there anything a flush still will not catch?**
Yes — anything checked at commit rather than at statement time. A constraint
declared `DEFERRABLE INITIALLY DEFERRED` in PostgreSQL is not checked until
transaction commit, so a test that flushes but never commits still will not see it.
The same is true of `AFTER_COMMIT` event listeners, which are bound to a commit
that never happens, and of visibility to any other connection, since uncommitted
rows are invisible outside their own transaction. For those, the test has to
genuinely commit: `TestTransaction.flagForCommit()` followed by `end()`, and taking
responsibility for cleaning up afterwards.

**★ Would `@Rollback(false)` be a simpler fix than sprinkling flushes?**
It removes this particular false positive, because a real commit forces a real
flush and evaluates the deferred constraints too. What it costs is the property the
default exists for: the database is no longer reset between tests, so the suite
becomes order-dependent, every test must clean up after itself, and a failing test
can leave the schema in a state that breaks the next twenty. It is the right choice
for a small number of tests that specifically need commit semantics, and the wrong
default for a suite.

**★ Does `saveAndFlush` remove the need for `em.clear()`?**
No, and conflating the two is the common mistake. `saveAndFlush` addresses the
write side: the statements reach the database. `clear()` addresses the read side:
without it, the next `findById` may be served from the persistence context. A test
that uses `saveAndFlush` and then asserts on a re-read entity can still be
asserting on the very instance it saved. They fix different halves of the same
problem.

**★ If the flush is what catches the constraint, why not flush after every write in
production too?**
Because flushing early gives up the batching and statement-ordering that the
persistence context exists to provide, and it takes the database locks earlier —
every flushed `INSERT` or `UPDATE` holds its row locks from that moment until the
commit, so an early flush lengthens the window in which other transactions block.
In a test the transaction is about to be discarded and nobody is contending, so the
cost is nil; in production it is a real throughput and contention cost. The
asymmetry is deliberate: flush eagerly in tests, flush at the boundary in
production.

**★ How does this interact with `spring.jpa.open-in-view`?**
Badly, and in a way that hides the bug further. With open-in-view enabled — Boot's
default in a web application — the persistence context stays open for the whole
request, so a lazy load or an implicit flush can happen *after* the service's
transaction has closed. A test that runs inside a single `@Transactional` method
never reproduces that timing at all, so the test and production disagree about when
the unit of work is flushed and about which reads hit the database. Turning
open-in-view off makes the two agree, which is a large part of why it is
recommended.

---

← Prev: [20 · Transactions in tests](20-transactions-in-tests.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20c · The other ways a test lies](20c-the-other-ways-a-test-lies.md)
