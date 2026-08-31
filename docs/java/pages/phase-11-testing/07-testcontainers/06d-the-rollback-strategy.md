---
title: "Wrapping a Testcontainers test in @Transactional buys isolation by never committing, and the commit is where deferred constraints, AFTER triggers, AFTER_COMMIT listeners and every other connection's view of the world actually happen — so the cheapest isolation strategy is also the one that cancels most of the reason you started a container"
sidebar_label: "06d · The rollback strategy"
sidebar_position: 67
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against Spring Framework 7.0's **Transaction Management** testing reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> from which every quoted sentence and the false-positive example are taken verbatim.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[06c](06c-keeping-tests-independent.md) laid out four ways to give each test a known starting
state. This is the first of them in full, because it is the one almost every codebase picks, the
one that takes a single annotation, and the one with enough failure modes to deserve its own page.
Spring itself documents two of those failure modes under the heading *false positives* — a test
that passes while the same code throws in production — and there are more that follow from the same
mechanism.**

## A · `@Transactional` on the test — the one everybody reaches for

Spring's rule is one sentence:

> *"By default, test transactions will be automatically rolled back after completion of the test"*

```java
@SpringBootTest
@Transactional                              // ← every test method rolls back
class OrderRepositoryTest {

    @Container @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Autowired OrderRepository orders;

    @Test
    void savesAnOrder() {
        orders.save(new Order("alice", 2));
        assertThat(orders.findByCustomer("alice")).hasSize(1);
    }   // rolled back — the next test sees an empty table
}
```

It is one annotation, it is fast, and it leaves nothing behind. It is also the strategy that most
often produces a green suite over broken code, for a reason worth stating precisely: **you have
bought isolation by never running the commit, and the commit is where a large class of database
behaviour actually happens.**

### 🔴 The false positives, in Spring's own words

The reference manual names two, and they are not edge cases:

> *"When you test application code that manipulates the state of a Hibernate session or JPA
> persistence context, make sure to flush the underlying unit of work within test methods that run
> that code. Failing to flush the underlying unit of work can produce false positives: Your test
> passes, but the same code throws an exception in a live, production environment."*

The manual's own illustration, modernised to Jupiter:

```java
@Transactional
@Test   // no expected exception!
void falsePositive() {
    updateEntityInHibernateSession();
    // False positive: an exception will be thrown once the Hibernate
    // Session is finally flushed (i.e. in production code)
}
```

```java
@Transactional
@Test
void updateWithSessionFlush() {
    updateEntityInHibernateSession();
    entityManager.flush();          // manual flush required to avoid the false positive
    // now the constraint violation surfaces here, in the test, as it would in production
}
```

And the second:

> *"if your application makes use of entity lifecycle callbacks (also known as entity listeners),
> make sure to flush the underlying unit of work within test methods that run that code. Failing to
> flush or clear the underlying unit of work can result in certain lifecycle callbacks not being
> invoked."*

Both have the same shape: the persistence context is a write-behind buffer, the test ends before it
drains, and everything that would have happened on the way out — constraint checks, `@PrePersist`,
`@PreUpdate`, the generated SQL itself — never happens.

### What else the rollback hides

Beyond the two Spring names, the same mechanism conceals:

- **Deferred constraints** (`DEFERRABLE INITIALLY DEFERRED`) — checked at commit, so never checked.
- **`AFTER` triggers and rules** that fire on commit.
- **`@TransactionalEventListener`** with the default `AFTER_COMMIT` phase — the listener simply
  never runs, so a test asserting a side effect of it can only pass by accident.
- **Any second connection.** The test's uncommitted rows are invisible to anything outside its
  transaction, so a `@Async` method, a scheduler, another pool connection or a `@WebMvcTest`-style
  HTTP round trip sees an empty database.
- **Isolation and locking behaviour** — the thing [01b](01b-where-the-line-is.md) argued you needed
  a real engine for in the first place. A single never-committing transaction cannot exhibit a
  serialization failure, a deadlock, or `SELECT … FOR UPDATE SKIP LOCKED` semantics.

🔴 **The last two are the reason this strategy is a poor default on a Testcontainers test
specifically.** You went to the trouble of running the real engine to test real behaviour, and then
wrapped the test in something that prevents most of that behaviour from occurring.

### The escape hatches

```java
@Test
@Commit                       // this one method commits
void publishesTheEventOnCommit() { ... }

@Test
@Rollback(false)              // the same thing, spelled the older way
void alsoCommits() { ... }
```

> *"transactional commit and rollback behavior can be configured declaratively via the `@Commit` and
> `@Rollback` annotations"*

Once a method commits, **it owns its own cleanup** — you have opted out of the strategy for that
method and the next test will see its rows.

For assertions that must happen outside the transaction:

> *"Occasionally, you may need to run certain code before or after a transactional test method but
> outside the transactional context — for example, to verify the initial database state prior to
> running your test or to verify expected transactional commit behavior after your test runs (if the
> test was configured to commit the transaction). `TransactionalTestExecutionListener` supports the
> `@BeforeTransaction` and `@AfterTransaction` annotations for exactly such scenarios."*

```java
@Commit
@Test
void writesThrough() { orders.save(new Order("alice", 2)); }

@AfterTransaction               // runs after the commit, outside the transaction
void assertItReallyLanded() {
    assertThat(jdbc.queryForObject("select count(*) from orders", Integer.class)).isEqualTo(1);
}
```

⚠️ And a rule people trip over immediately:

> *"Any before methods (such as methods annotated with JUnit Jupiter's `@BeforeEach`) and any after
> methods (such as methods annotated with JUnit Jupiter's `@AfterEach`) are run within the
> test-managed transaction for a transactional test method."*

So a `@BeforeEach` that seeds data is rolled back with everything else — which is usually what you
want — and an `@AfterEach` that tries to clean up is doing nothing at all, because it is inside the
transaction that is about to be discarded. **That is the single most common reason a hand-rolled
cleanup silently does not run.** Cleanup that must survive belongs in `@AfterTransaction`, in an
`@Sql` script with `executionPhase = AFTER_TEST_METHOD`, or in a truncation step — the last two are
[06e · Truncating between tests](06e-truncating-between-tests.md) and
[06f · `@Sql` scripts and unique data](06f-sql-scripts-and-unique-data.md).

For finer control there is a programmatic API:

> *"You can interact with test-managed transactions programmatically by using the static methods in
> `TestTransaction`. For example, you can use `TestTransaction` within test methods, before methods,
> and after methods to start or end the current test-managed transaction or to configure the current
> test-managed transaction for rollback or commit."*

```java
@Test
void seesItsOwnCommit() {
    orders.save(new Order("alice", 2));
    TestTransaction.flagForCommit();
    TestTransaction.end();          // commits here
    TestTransaction.start();        // a fresh transaction, which will roll back
    assertThat(orders.count()).isEqualTo(1);   // reading committed state
}
```

### 🔴 The preemptive-timeout trap

> *"Caution must be taken when using any form of preemptive timeouts from a testing framework in
> conjunction with Spring's test-managed transactions. Specifically, Spring's testing support binds
> transaction state to the current thread (via a `java.lang.ThreadLocal` variable) before the
> current test method is invoked. If a testing framework invokes the current test method in a new
> thread in order to support a preemptive timeout, any actions performed within the current test
> method will not be invoked within the test-managed transaction."*

In practice that means `@Timeout(value = …, threadMode = SEPARATE_THREAD)` and
`assertTimeoutPreemptively` silently take your test *out* of the managed transaction — so nothing
rolls back, and the leftovers land in the shared container for every later test to trip over. The
failure appears in a different test class from the one that caused it, which is about the worst
diagnostic shape a suite can have.


## Where this continues

The strategies that let the commit actually happen — truncation, `@Sql` scripts, and unique data
per test — are [06e · Truncating between tests](06e-truncating-between-tests.md) and
[06f · `@Sql` scripts and unique data](06f-sql-scripts-and-unique-data.md).
[06c](06c-keeping-tests-independent.md) has the comparison table and the shared-state problem all
four of them exist to solve.

## Gotchas

**★ `@Transactional` on a Testcontainers test cancels most of the reason you started a container.**
Isolation, locking, deferred constraints, `AFTER` triggers and commit-time behaviour are exactly
what a real engine gives you over H2, and none of them occur in a transaction that is never
committed. If the test is about SQL semantics, let it commit and clean up another way.

**★ An `@AfterEach` cleanup inside a `@Transactional` test does nothing.**
*"Any before methods… and any after methods… are run within the test-managed transaction."* Your
`DELETE FROM` is rolled back with everything else. Use `@AfterTransaction`, `@Sql` with
`executionPhase = AFTER_TEST_METHOD`, or truncation.

**★ A passing `@Transactional` test can hide an exception production will throw.**
*"Failing to flush the underlying unit of work can produce false positives: Your test passes, but
the same code throws an exception in a live, production environment."* Flush explicitly in any test
that manipulates the persistence context and expects a database-level failure.

**★ Entity lifecycle callbacks may not fire at all.**
Same cause: *"Failing to flush or clear the underlying unit of work can result in certain lifecycle
callbacks not being invoked."* A test asserting on `@PrePersist` behaviour without a flush is
asserting on nothing.

**★ `@TransactionalEventListener` never fires in a rolled-back test.**
Its default phase is `AFTER_COMMIT`, and there is no commit. The test can only pass if it is
asserting something the listener did not cause.

**★ A preemptive timeout takes the test out of the transaction, and the leftovers surface elsewhere.**
`threadMode = SEPARATE_THREAD` or `assertTimeoutPreemptively` runs the body on another thread, and
the transaction state is bound to the original one via a `ThreadLocal`. Nothing rolls back, and the
test that fails is some later one in a different class.

**★ A rolled-back test's rows are invisible to anything on another connection.**
An `@Async` handler, a scheduler, a second pool connection or a real HTTP round trip all see an
empty database. This is why `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `@Transactional` are
a bad pairing: the server thread has its own transaction and cannot see the test's uncommitted data.

**★ `@Commit` on one method silently makes that method the source of every later test's leftovers.**
Opting one test out of rollback is legitimate, but that test now owns its cleanup. Nothing warns
you; the cost lands on whichever test runs next.

## Interview questions

**★ Why is `@Transactional` on the test a questionable default for a Testcontainers test in
particular?**
Because it achieves isolation by never committing, and the commit is where much of the behaviour
you switched to a real engine to observe actually happens — deferred constraints, `AFTER` triggers,
`AFTER_COMMIT` event listeners, and anything visible only to another connection. You end up running
PostgreSQL to test a code path that never reaches it.

**★ Spring's own manual warns about false positives in transactional tests. What is the mechanism?**
The persistence context is a write-behind buffer. The test method ends and the transaction is
rolled back before that buffer drains, so the SQL is never sent and the constraint violation never
happens — *"Your test passes, but the same code throws an exception in a live, production
environment."* Flushing inside the test forces the write to happen where you can see it.

**★ You added an `@AfterEach` that deletes the test's rows and the database is still dirty. Why?**
Because in a transactional test the after methods run *inside* the test-managed transaction, so the
delete is rolled back along with everything else. Cleanup has to run outside it —
`@AfterTransaction`, `@Sql(executionPhase = AFTER_TEST_METHOD)`, or truncation.

**★ What do `@Commit` and `@Rollback` do, and what do you take on by using `@Commit`?**
They override the default rollback declaratively for a method or a class. `@Commit` makes the test
transaction commit, which is how you test commit-time behaviour — and from that point the test owns
its own cleanup, because the next test will see whatever it wrote.

**★ What are `@BeforeTransaction` and `@AfterTransaction` for?**
Running code outside the test-managed transaction — *"to verify the initial database state prior to
running your test or to verify expected transactional commit behavior after your test runs"*. They
are the correct place for an assertion that must see committed state, and for cleanup that must
survive.

**★ Why can a `@Timeout` break transaction rollback?**
Because a preemptive timeout runs the test body on a different thread, and Spring binds transaction
state to the calling thread through a `ThreadLocal` before the method is invoked. Work done on the
new thread is outside the test-managed transaction, so nothing rolls back — and the resulting dirty
data fails some later test in another class.

**★ Why do `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `@Transactional` fit badly together?**
The request is handled on a server thread with its own transaction, which cannot see the test
thread's uncommitted rows. The fixture appears to be missing, and any write the endpoint makes is
committed for real and outlives the test.

{/* FOOTER */}
