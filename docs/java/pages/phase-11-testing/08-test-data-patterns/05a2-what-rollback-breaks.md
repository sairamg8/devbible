---
title: "The rollback strategy is free because it never commits, and everything it breaks is a consequence of that single fact: no commit means no commit-time constraint check, no AFTER_COMMIT listener, nothing visible on a second connection, and — Spring's own manual says so — a test that passes while production throws"
sidebar_label: "05a2 · What rollback breaks"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Transaction Management*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)) —
> the "Avoid False Positives When Testing ORM Code" warning and the preemptive-timeout
> caution are quoted verbatim from that page.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — Java source and documented behaviour
> only, never a test run or an exception transcript.

**Rolling back is not a cheaper way of getting the same test. It is a different test. Nine
distinct things stop working, and they have one root: the transaction never commits, so
everything the database or the framework does *at* commit does not happen, and everything
outside that transaction cannot see what the test wrote. Spring's own manual documents the
worst case in the bluntest terms available — your test passes and the same code throws in
production.**

## 1 · The false positive Spring documents itself

Quoted in full, because a paraphrase of this loses the point:

> *"When you test application code that manipulates the state of a Hibernate session or JPA
> persistence context, make sure to flush the underlying unit of work within test methods
> that run that code. Failing to flush the underlying unit of work can produce false
> positives: Your test passes, but the same code throws an exception in a live, production
> environment. Note that this applies to any ORM framework that maintains an in-memory unit
> of work."*

The mechanism: JPA batches changes in the persistence context and writes them at flush.
Without a commit there is often no flush, so the `INSERT` or `UPDATE` is never sent, so the
`NOT NULL` violation, the unique-index collision and the check constraint never fire. The
reference's own remedy is a manual flush:

```java
@PersistenceContext
EntityManager entityManager;

@Transactional
@Test
void updateWithEntityManagerFlush() {
    updateEntityInJpaPersistenceContext();
    // Manual flush is required to avoid false positive in test
    entityManager.flush();
}
```

The rule that follows: **in a transactional ORM test, any assertion that a write fails is
worthless without an explicit flush.** `assertThatThrownBy(() -> repository.save(bad))` on
its own asserts nothing; `repository.saveAndFlush(bad)` or an explicit `em.flush()` is the
version that means something.

## 2 · Constraints the database only checks at commit

A `DEFERRABLE INITIALLY DEFERRED` foreign key is checked at commit, not at statement time.
A rolled-back test never reaches that point, so a fixture or a piece of code that leaves a
dangling reference passes. Flushing does not help here; only a commit does. If your schema
uses deferred constraints — and they are common for circular references and for bulk
loading — then the tests that matter for them cannot be transactional.

## 3 · `@TransactionalEventListener(phase = AFTER_COMMIT)` never fires

This is the most common silent one, because `AFTER_COMMIT` is the default phase. A service
publishes an event, a listener sends an email or writes an outbox row, and in a rolled-back
test the listener is simply never invoked. The test asserting "the outbox row exists" fails
in a way that sends you looking at the listener; the test asserting nothing passes and the
feature ships broken.

`AFTER_ROLLBACK` and `AFTER_COMPLETION` listeners *do* fire in a rolled-back test, which is
its own kind of confusing: half your listeners run and the other half do not.

## 4 · Anything on a second connection sees nothing

An uncommitted transaction is invisible outside itself at any isolation level below read
uncommitted, which is every level you will meet in practice. So:

- a `JdbcTemplate` you built from the `DataSource` yourself, which takes a different
  connection from the pool, sees an empty table;
- a background thread the code under test started sees nothing;
- `@SpringBootTest(webEnvironment = RANDOM_PORT)` runs a real servlet container whose
  request threads take their own connections, so a `TestRestTemplate` call sees none of the
  fixture the test transaction inserted — and anything the request writes is in *its* own
  transaction, which commits and is not rolled back by the test.

That last one is worth stating as a rule: **`RANDOM_PORT` and `@Transactional` do not fit
together.** The test transaction and the server's transaction are different transactions on
different connections, so the fixture is invisible to the server and the server's writes
survive the test.

## 5 · Code that manages its own transaction escapes the rollback

`@Transactional(propagation = REQUIRES_NEW)` suspends the test's transaction and commits
independently. So does anything using a `TransactionTemplate` with `REQUIRES_NEW`, and so
does any component that opens its own connection. Those writes are committed and the test's
rollback does not touch them — which means a suite using the rollback strategy can still
accumulate data, from exactly the code paths whose transactional behaviour is most
interesting.

## 6 · Lazy loading works in the test and fails in production

The test transaction stays open for the whole method, so the persistence context stays
open, so every lazy association initialises on access. In production the same code runs
with a transaction that ends at the service boundary, and touching that association after
it throws `LazyInitializationException`. The test cannot see the difference because the
thing it changed — the lifetime of the persistence context — is the very thing that decides
the outcome. This is the single strongest argument for testing service-layer behaviour
without a test-managed transaction, and it is covered in depth by
[Phase 10 → 10 Lazy loading](../../phase-10-data-access/10-lazy-loading/README.md).

## 7 · A preemptive timeout takes the test out of the transaction

Quoted, because the mechanism is not guessable:

> *"Caution must be taken when using any form of preemptive timeouts from a testing
> framework in conjunction with Spring's test-managed transactions. Specifically, Spring's
> testing support binds transaction state to the current thread (via a
> `java.lang.ThreadLocal` variable) before the current test method is invoked. If a testing
> framework invokes the current test method in a new thread in order to support a preemptive
> timeout, any actions performed within the current test method will not be invoked within
> the test-managed transaction."*

The reference names JUnit Jupiter's `assertTimeoutPreemptively(…)` among the affected
mechanisms. The consequence for cleanup: work done in the new thread is outside the test
transaction, so it is **committed** and the rollback does not remove it. A single
`assertTimeoutPreemptively` in one test can be the source of leftover rows that break a
different class.

## 8 · Sequences are consumed anyway

Rollback returns rows, not sequence values — sequences are deliberately non-transactional
so that concurrent sessions do not block on them. So the rollback strategy gives you a
clean table with an identity counter that keeps climbing for the life of the database. Any
assertion of the form "the new id is 1" passes exactly once. See
[04d2](04d2-the-columns-sql-has-to-fill.md).

## 9 · You cannot test that a rollback happened

If the test itself is a transaction that will be rolled back, an assertion that the code
under test rolled back on error is indistinguishable from the test's own rollback. To test
rollback behaviour you need the code's transaction to be a real one that really ends —
which means no test-managed transaction, and cleanup by some other strategy.

## Where this connects

- The mechanism and Boot's defaults: [05 · Cleanup](05-cleanup.md).
- Switching the transaction off, and the hooks outside it:
  [05a · Controlling the test transaction](05a-controlling-the-test-transaction.md).
- The strategy to use instead when these matter:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- The same argument made specifically about Testcontainers, where rolling back cancels much
  of the reason for the container:
  [07 · Testcontainers → 06d](../07-testcontainers/06d-the-rollback-strategy.md).
- Lazy loading and the open-session question:
  [Phase 10 · Data access](../../phase-10-data-access/README.md).

## Gotchas

**★ A passing transactional ORM test can hide an exception production will throw.**
Spring's manual says so directly: without flushing the unit of work, the statement is never
sent and the constraint never fires. Any test whose subject is a failed write must call
`flush()` — via `saveAndFlush`, `TestEntityManager.persistAndFlush`, or `em.flush()` —
or it asserts nothing.

**★ `@TransactionalEventListener` defaults to `AFTER_COMMIT`, so it never fires in a
rolled-back test.**
The listener is not broken and nothing logs a warning; the phase simply never arrives.
`AFTER_ROLLBACK` and `AFTER_COMPLETION` listeners do fire, so you can end up with half the
event handling running.

**★ Deferred constraints are only checked at commit, which a rolled-back test never
reaches.**
Flushing is not enough — `DEFERRABLE INITIALLY DEFERRED` means "at commit", full stop. A
schema that uses them cannot have its integrity tested transactionally.

**★ `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `@Transactional` are incompatible in
both directions.**
The server's request threads cannot see the test's uncommitted fixture, and whatever the
request writes commits in its own transaction and survives the test's rollback. The test is
simultaneously starved of data and leaking it.

**★ `REQUIRES_NEW` escapes the rollback and is invisible in the test class.**
The annotation is on a service method three layers down. A suite that believes it never
commits still accumulates rows from every path that suspends the test transaction, and the
resulting leftovers look like somebody else's bug.

**★ Lazy loading that works in the test works *because* of the test.**
The test-managed transaction keeps the persistence context open for the whole method, which
is not how production runs. A test that passes proves the mapping loads, not that the code
touches the association while it can.

**★ A preemptive timeout moves the test body to another thread, and the transaction does not
follow it.**
Transaction state is bound to the thread with a `ThreadLocal` before the method is invoked.
Work done in the new thread commits, so the leftovers appear in a completely different test
class and the connection to `assertTimeoutPreemptively` is not obvious.

**★ Sequence values are consumed even by a rolled-back transaction.**
Nothing about rollback makes generated ids deterministic. "Assert the id is 1" passes on a
fresh database and fails on every subsequent run against the same one, which is why it
reproduces in CI and not locally — or the other way round.

**★ You cannot distinguish "the code rolled back" from "the test rolled back".**
An assertion that an error left no trace is trivially satisfied by the test's own rollback.
Testing transactional behaviour requires giving up the test-managed transaction.

**★ An `@AfterEach` cleanup in a transactional test does nothing, and its presence makes the
suite look safer than it is.**
The deletes are rolled back with the rest. Worse, the next person sees explicit cleanup
code and assumes the class handles its own state — so nobody investigates when a later test
fails.

## Interview questions

**★ Spring's own manual warns about false positives in transactional tests. What is the mechanism?**
ORM frameworks keep an in-memory unit of work and write it at flush. In a transactional
test that never commits, there is often no flush, so the `INSERT` or `UPDATE` is never sent
and the database-level failure — a `NOT NULL` violation, a unique-index collision, a check
constraint — never happens. The manual's own wording is that the test passes and the same
code throws in production, and its remedy is to flush the unit of work explicitly inside
the test method. Practically: any test asserting that a write fails is meaningless without
`saveAndFlush` or an explicit `em.flush()`.

**★ Why is `@Transactional` on a test a questionable default for an integration test against a real engine?**
Because it removes the commit, and a large part of what a real engine gives you happens at
commit: deferred constraint checks, `AFTER_COMMIT` transactional event listeners, and
visibility to any other connection. It also keeps the persistence context open for the
whole method, so lazy loading succeeds in a way it will not in production. You get speed
and automatic cleanup, and you pay by narrowing the set of bugs the test is capable of
finding — which is the opposite of why you paid for the real engine.

**★ Why do `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `@Transactional` fit badly together?**
Because they involve two different transactions on two different connections. The test's
transaction holds the fixture uncommitted, so the servlet container's request threads
cannot see it and the endpoint behaves as though the database is empty. And whatever the
request writes is committed by the server's own transaction, which the test's rollback does
not touch — so the test leaks data while being starved of it. The fix is to make the test
non-transactional and clean up explicitly, usually by truncating before each test.

**★ Why can a `@Timeout` or `assertTimeoutPreemptively` break transaction rollback?**
Because Spring binds transaction state to the current thread with a `ThreadLocal` before
the test method is invoked, and a preemptive timeout runs the method body in a *different*
thread. Work done there is not inside the test-managed transaction, so it is committed and
survives the rollback. The reference calls this out explicitly for
`assertTimeoutPreemptively`. The leftovers then surface as a failure in some other class,
with nothing pointing back at the timeout.

**★ A test asserts that saving an invalid entity throws, and it passes. Would you trust it?**
Not without checking for a flush. In a transactional test the `save` may only put the
entity in the persistence context, so the constraint is never evaluated and the exception
would have come — if at all — at commit, which never happens. If the test passes, it may be
passing because some other code path triggered a flush incidentally, which makes it a test
that will start failing when an unrelated line changes. I would rewrite it with
`saveAndFlush` so the assertion is about the database rather than about flush timing.

**★ Your suite uses the rollback strategy and the database is still filling up. Where do you look?**
At the paths that escape the test transaction: `REQUIRES_NEW` anywhere in the code under
test, components that take their own connection, `@Commit` or `@Rollback(false)` in the
test hierarchy, `TestTransaction.flagForCommit()`, `assertTimeoutPreemptively`, and any
`@SpringBootTest` with a real web environment. All of them commit, none of them are visible
in the test class that causes them, and the rows they leave are attributed to whichever
test fails first afterwards.

{/* FOOTER */}
