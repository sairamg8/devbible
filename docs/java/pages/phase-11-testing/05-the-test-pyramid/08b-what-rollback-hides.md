---
title: "A rolled-back test never commits, so everything that happens at commit is untested — and Spring binds transaction state to a ThreadLocal, which means assertTimeoutPreemptively runs your test's work on another thread where the writes commit for real while the test transaction rolls back an empty transaction"
sidebar_label: "08b · What rollback hides"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Transaction Management*
> ([tx](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html))
> — the `TestTransaction` example and the preemptive-timeout warning are quoted from that page.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — no database was touched and no test was run.

**[08](08-transactions-in-tests.md) was the mechanism. This is the part that decides whether a
green transactional test means anything: rollback is not a neutral cleanup strategy. It removes an
entire phase of database behaviour from the test, and it interacts with threads in a way that can
commit the very data you thought was being discarded.**

## 🔴 The preemptive-timeout trap — the sharpest edge in this topic

The reference issues this as an explicit warning, and it is worth reading twice:

> *"Spring's testing support binds transaction state to the current thread via
> `java.lang.ThreadLocal` **before** the test method is invoked. If a testing framework invokes the
> test method in a new thread for preemptive timeout support, actions within the test will **not**
> be invoked within the test-managed transaction and changes **will be committed** even though the
> test-managed transaction is properly rolled back."*

Affected, by name: **JUnit Jupiter's `assertTimeoutPreemptively(…)`**, JUnit 4's
`@Test(timeout = …)` and `TimeOut` rule, and TestNG's `@Test(timeOut = …)`.

```java
@Test
@Transactional
void finishesQuickly() {
    assertTimeoutPreemptively(ofSeconds(2), () -> orderService.place(order));
    //                                      ^ runs on ANOTHER thread
}                                           // this transaction rolls back — but it is empty
```

The row is committed. The test is green. Nothing in the output suggests anything happened, and the
next test — or the next *run* — inherits a database that has quietly grown a row.

This is the same mechanism [topic 01 · 13b · Thread modes](../01-junit-5/13b-thread-modes.md)
describes from the JUnit side, where it explains why `@Timeout`'s `SAME_THREAD` mode exists at all:
so `ThreadLocal`-bound frameworks — Spring's transaction management being the example the JUnit
docs themselves name — keep working. **Two topics, one bug, approached from opposite ends.**

🔴 **The rule: never combine a preemptive timeout with a test-managed transaction.** Use
`@Timeout` with `SAME_THREAD` (its default), or `assertTimeout` rather than
`assertTimeoutPreemptively`, which runs the body on the calling thread.

The same reasoning covers the other thread boundary already met in
[04b · webEnvironment](04b-webenvironment.md): with `RANDOM_PORT`, the server handles the request
on its own thread, opens its own transaction and commits it. Anywhere a thread boundary sits
between your `@Transactional` and the work, the rollback guarantee is gone.

## `TestTransaction` — driving the transaction by hand

When a test genuinely needs to observe committed state, the programmatic API lets it:

```java
@Test
public void transactionalTest() {
    assertNumUsers(2);

    deleteFromTables("user");

    // Commit changes to the database
    TestTransaction.flagForCommit();
    TestTransaction.end();
    assertFalse(TestTransaction.isActive());
    assertNumUsers(0);

    // Start a new transaction
    TestTransaction.start();
    // perform other actions that will be automatically rolled back
}
```

The five static methods: `flagForCommit()`, `flagForRollback()`, `end()`, `start()`,
`isActive()`.

This is also the documented substitute for the two unsupported attributes from
[08](08-transactions-in-tests.md) — `rollbackFor` becomes `flagForRollback()`, `noRollbackFor`
becomes `flagForCommit()`.

**The pattern it enables** is the honest way to test post-commit behaviour: do the work, commit
deliberately, assert on what a *different* connection would see, then start a fresh transaction so
the rest of the test is still cleaned up. It is more code than `@Commit`, and unlike `@Commit` it
leaves you in control of what survives.

## What rollback actually removes from the test

A transaction that never commits never exercises the commit. So a rolled-back test cannot see:

- **Deferred constraints.** A `DEFERRABLE INITIALLY DEFERRED` foreign key or unique constraint is
  checked **at commit**. The test rolls back, the check never runs, the violation ships.
- **Commit-time triggers.** Anything on `AFTER` semantics that fires at commit.
- **What another connection sees.** Inside your uncommitted transaction, your writes are visible
  only to you. A test cannot observe the isolation behaviour that production depends on, because
  there is no second connection and nothing committed for it to read.
- **The `@TransactionalEventListener` default phase.** `AFTER_COMMIT` events do not fire when
  there is no commit. This is a common and genuinely confusing one: the listener works in
  production and appears broken in tests.
- **Anything downstream that reacts to committed data.** A message published after commit, an
  outbox row picked up by a poller, a replica read.
- **Connection-pool and long-transaction behaviour.** The test holds one connection for its whole
  life, which is nothing like production's pattern.

None of these are reasons to abandon rollback — it is the right default for the great majority of
tests, and it is why a `@DataJpaTest` suite can run at all. They are reasons to know **which**
tests it disqualifies, and to write those few differently.

## Choosing a cleanup strategy deliberately

| Strategy | Cleans up | Exercises commit? | Cost |
|---|---|---|---|
| `@Transactional` rollback | Automatically | ❌ | Free. The default for a reason |
| `TestTransaction` commit + explicit cleanup | You do | ✅ | Verbose, and precise |
| `@Commit` + `@Sql` teardown | You do | ✅ | Easy to forget; order dependence if you do |
| Truncate in `@AfterEach` | You do | ✅ | Honest, slow-ish, works with a real server |
| A fresh database per class | Container lifecycle | ✅ | Slowest, most isolated |

🔴 **A `RANDOM_PORT` or otherwise multi-threaded test has no rollback available**, so it must pick
one of the lower rows. Write the choice down in the test — the absence of `@Transactional` reads as
an oversight to whoever comes next.

## Gotchas and pitfalls

**★ `assertTimeoutPreemptively` inside a `@Transactional` test.**
Its body runs on another thread with no test-managed transaction, so its writes **commit**, while
your test's empty transaction rolls back cleanly. Green test, real data. Use `assertTimeout`, or
`@Timeout` in `SAME_THREAD` mode.

**★ Expecting `@TransactionalEventListener` to fire.**
Its default phase is `AFTER_COMMIT`, and a rolled-back test never commits. Nothing fires, and the
production behaviour looks broken. Either commit deliberately with `TestTransaction`, or use
`fallbackExecution` / a different phase for that test.

**★ Believing a rolled-back test proves your constraints work.**
Deferred constraints are validated at commit. Rollback skips the validation entirely.

**★ Asserting that a second connection sees your write.**
It cannot — you never committed. If concurrent visibility is the subject, the test cannot be
transactional.

**★ Using `@Commit` to fix a `@TransactionalEventListener` test, and leaving the data.**
`@Commit` commits and does not clean up. The row outlives the test and the suite gains an order
dependence.

**★ Forgetting `TestTransaction.start()` after `end()`.**
Everything after `end()` runs with no transaction until you start one, so subsequent writes are
auto-committed and will not be rolled back at the end of the test.

**★ Treating rollback as a substitute for test data isolation.**
It only undoes what the test transaction did on the test's thread. Anything committed by another
thread, or written in `@BeforeAll`, survives.

**★ Assuming the rollback also resets sequences or identity columns.**
It does not. Sequence values consumed inside a rolled-back transaction are gone, which is exactly
why asserting on a generated ID is unsafe — the same argument
[topic 01 · 14h](../01-junit-5/14h-ports-network-and-the-database.md) makes about never asserting
on a value the database chose.

## Interview questions

**★ Why must you never use `assertTimeoutPreemptively` in a `@Transactional` test?**
Because Spring binds transaction state to the current thread via a `ThreadLocal` before the test
method is invoked, and preemptive timeout support runs the body on a *new* thread. The work
therefore happens outside the test-managed transaction and **commits**, while the test's own
transaction rolls back — an empty one. The test is green and the data is real.

**★ What else creates the same thread boundary?**
`@SpringBootTest(webEnvironment = RANDOM_PORT)` or `DEFINED_PORT`, where the request is handled on
a server thread that opens and commits its own transaction. Also any test that hands work to an
executor or a `@Async` method. The general rule: a thread boundary between `@Transactional` and
the work removes the rollback guarantee.

**★ What can a rolled-back test never verify?**
Anything that happens at or after commit: deferred constraint checks, commit-time triggers,
`AFTER_COMMIT` transactional event listeners, what a second connection would see, and any
downstream reaction to committed data. It is still the right default — it just disqualifies a
specific set of tests.

**★ Why does a `@TransactionalEventListener` appear not to work in tests?**
Its default phase is `AFTER_COMMIT`, and a test that rolls back never commits, so the listener is
never invoked. The behaviour is correct; the test removed the trigger.

**★ What is `TestTransaction` for?**
Driving the test-managed transaction programmatically: `flagForCommit()`, `flagForRollback()`,
`end()`, `start()` and `isActive()`. It is the documented replacement for the unsupported
`rollbackFor` and `noRollbackFor` attributes, and it is how you commit deliberately mid-test,
assert on committed state, and then start a fresh transaction so the remainder is still cleaned up.

**★ How would you test that a unique constraint is enforced, if it is deferred?**
Not with a rolled-back transaction — a deferred constraint is checked at commit, which never
happens. Commit deliberately with `TestTransaction.flagForCommit()` and `end()`, or run the test
non-transactionally with explicit cleanup, so the commit actually occurs and the violation is
raised.

**★ Your integration test uses a real server and you cannot use `@Transactional`. What do you do?**
Choose a cleanup strategy explicitly: truncate the affected tables in `@AfterEach`, use a fresh
database per class, or have the test delete what it created. Whichever you choose, say so in the
test — the missing `@Transactional` otherwise reads as an oversight, and the next person will
"fix" it by adding one that silently does nothing.

{/* FOOTER */}
