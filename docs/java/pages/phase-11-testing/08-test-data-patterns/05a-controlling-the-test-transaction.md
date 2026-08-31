---
title: "Most of @Transactional's attributes do nothing on a test and fail silently, @BeforeEach and @AfterEach run inside the transaction so cleanup written there is undone with everything else, and the only two hooks that can see the database as another connection sees it are the two nobody uses"
sidebar_label: "05a · Controlling the test transaction"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Transaction Management*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)) —
> the table of supported `@Transactional` attributes, `@Commit`/`@Rollback`,
> `@BeforeTransaction`/`@AfterTransaction` and `TestTransaction` are all quoted or
> reproduced from that page.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — Java source and documented behaviour
> only, never a test run.

**[05](05-cleanup.md) established that Spring's data slices run each test in a transaction
and roll it back. This chunk is the control surface: how to switch that off, how to commit
on purpose, which `@Transactional` attributes are honoured (fewer than you think, and the
rest fail silently), and the two lifecycle hooks that run outside the transaction — which
matter because everything you would normally reach for, including `@AfterEach`, runs
inside it.**

## Turning it off, and the attributes that do nothing

```java
@DataJpaTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)   // no test transaction at all
class CommittingRepositoryTest { }
```

`propagation` is one of the few `@Transactional` attributes the test framework honours, and
only for two values. The reference's table of what is supported for test-managed
transactions is worth having in front of you:

| Attribute | Supported |
|---|---|
| `value` / `transactionManager` | yes |
| `propagation` | only `NOT_SUPPORTED` and `NEVER` |
| `isolation` | no |
| `timeout` | no |
| `readOnly` | no |
| `rollbackFor` / `rollbackForClassName` | no — use `TestTransaction.flagForRollback()` |
| `noRollbackFor` / `noRollbackForClassName` | no — use `TestTransaction.flagForCommit()` |

That table answers a whole family of confused bug reports.
`@Transactional(isolation = SERIALIZABLE)` on a test does **not** give you a serializable
test transaction — so a test that claims to prove behaviour under serializable isolation
proves nothing of the sort. `@Transactional(timeout = 5)` does not time the test out.
`readOnly = true` does not make the test read-only. None of them are rejected; they are
ignored, and the test goes on claiming a property it does not have.

`NOT_SUPPORTED` and `NEVER` differ in what they do about an existing transaction —
`NOT_SUPPORTED` suspends one, `NEVER` throws if one exists — but for a test class the
practical effect of either is "do not give this test a transaction", and `NOT_SUPPORTED` is
the one to reach for because it does not depend on there being nothing to suspend.

A second way to turn it off is simply not to inherit it: if a base class is
`@Transactional`, a subclass cannot un-inherit the annotation, so
`@Transactional(propagation = NOT_SUPPORTED)` on the subclass is the mechanism, not a
workaround.

## Committing on purpose: `@Commit` and `@Rollback`

```java
@SpringJUnitConfig(TestConfig.class)
@Transactional
@Commit                                       // commit, for every method in the class
class MyTests {

    @Test
    @Rollback                                 // …except this one
    void modifyDatabaseWithinTransaction() { }
}
```

Both annotations work at class and method level, and the method-level one wins. `@Rollback`
also takes a boolean, so `@Rollback(false)` and `@Commit` are the same thing — which is
worth knowing when reading an old codebase, because both spellings are in circulation.

`@Commit` is a loaded gun. The moment one method commits, it becomes the source of every
later test's leftovers, and it does so from a class that looks exactly like every other
transactional test in the suite. Worse, at class level it converts a whole file from "no
trace left" to "everything left", and the tests that then start failing are in other
classes.

If you need a commit in one test, prefer `TestTransaction.flagForCommit()` inside that
test's body, where it is visible on the line that does it.

## The two hooks outside the transaction

```java
@BeforeTransaction
void verifyInitialDatabaseState() {
    // runs BEFORE the test transaction is started
}

@AfterTransaction
void verifyFinalDatabaseState(@Autowired DataSource dataSource) {
    // runs AFTER the transaction has rolled back
}
```

These are the only places in a transactional test where you can see the database as another
connection sees it. `@AfterTransaction` is the correct home for "assert nothing was
committed", and for cleanup that must survive the rollback. In JUnit Jupiter these methods
may take parameters resolved by registered `ParameterResolver` extensions, which is how the
`@Autowired DataSource` above works.

Note what is **not** outside the transaction. The reference is explicit that
`@Transactional` is not supported on test lifecycle methods such as `@BeforeAll`, while
method-level lifecycle methods — `@BeforeEach` and `@AfterEach` — **run within the
test-managed transaction**. That single sentence explains most "my `@AfterEach` cleanup
does nothing" reports: the deletes happen, and then they are rolled back with everything
else.

The ordering, therefore, is:

```text
@BeforeTransaction
  ── transaction starts ──
    @BeforeEach
      @Test
    @AfterEach
  ── transaction rolls back ──
@AfterTransaction
```

Compare that with the `@Sql` phase timeline in
[04b](04b-phases-and-the-lifecycle.md): a `BEFORE_TEST_METHOD` script with the inferred
transaction mode runs *inside* the same transaction, which is why an `AFTER_TEST_METHOD`
cleanup script is undone too unless it is marked `ISOLATED`.

## Taking control: `TestTransaction`

When you need a commit in the middle of a test — to prove that something is visible after
commit, or to set up committed state — the transaction is programmatically controllable:

```java
@Test
void transactionalTest() {
    assertNumUsers(2);
    deleteFromTables("user");

    // changes to the database will be committed!
    TestTransaction.flagForCommit();
    TestTransaction.end();
    assertFalse(TestTransaction.isActive());
    assertNumUsers(0);

    TestTransaction.start();
    // perform other actions that will be automatically rolled back
}
```

`flagForCommit()`, `flagForRollback()`, `start()`, `end()` and `isActive()` are the whole
API. Two things about it are easy to get wrong. First, `flagForCommit()` alone does
nothing — it sets the disposition of the *current* transaction, and `end()` is what applies
it. Second, anything committed before `end()` is now real data that the rollback of the
*next* transaction will not remove; a test that commits is a test that has to clean up
after itself.

It is the honest escape hatch, and it is also a signal: a test that needs three transaction
boundaries is usually testing something whose transaction boundaries are the subject, and
that test would be clearer with no test-managed transaction at all — `NOT_SUPPORTED`, plus
explicit cleanup.

## Where this connects

- What the rollback strategy is and why Boot switches it on: [05 · Cleanup](05-cleanup.md).
- What rollback actually breaks, case by case:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- Cleanup that survives a rollback, including `transactionMode = ISOLATED`:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Where `@Sql` scripts sit relative to these hooks:
  [04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md).
- `@Transactional` semantics outside tests — propagation, proxies, self-invocation:
  [Phase 10 → 04 Spring `@Transactional`](../../phase-10-data-access/04-spring-transactional/01-not-a-language-feature.md).

## Gotchas

**★ Most `@Transactional` attributes are silently ignored on a test.**
`isolation`, `timeout`, `readOnly`, `rollbackFor` and `noRollbackFor` are all unsupported
for test-managed transactions, and `propagation` is honoured only for `NOT_SUPPORTED` and
`NEVER`. Setting them does not fail; it does nothing, which is worse, because the test then
claims a property it does not have — most damagingly a test "at `SERIALIZABLE` isolation"
that is running at the database's default.

**★ `@BeforeEach` and `@AfterEach` run inside the test-managed transaction.**
So an `@AfterEach` that deletes the test's rows is rolled back along with everything else
and achieves precisely nothing. `@BeforeTransaction` and `@AfterTransaction` are the hooks
outside it, and they are the ones almost nobody knows about.

**★ `@Commit` on one method makes that method the source of every later test's leftovers.**
And it does so from a class that looks exactly like every other transactional test in the
suite. If you need a commit, prefer `TestTransaction.flagForCommit()` inside the one test
that needs it, where it is visible in the method body rather than in an annotation someone
has to notice.

**★ `@Rollback(false)` and `@Commit` are the same thing.**
Both spellings exist in the wild and a codebase often contains both. When auditing a suite
for tests that commit, grepping for `@Commit` alone misses half of them.

**★ `TestTransaction.flagForCommit()` on its own commits nothing.**
It sets the disposition; `end()` applies it. A test that calls `flagForCommit()` and then
returns has still rolled back, and the reader — and often the author — believes otherwise.

**★ Anything committed by `TestTransaction` is permanent as far as the suite is concerned.**
The transaction that started afterwards will be rolled back, but the committed part will
not. A test that uses `TestTransaction` to commit must clean up after itself, in
`@AfterTransaction` or with an isolated `@Sql` script.

**★ A subclass cannot un-inherit `@Transactional` from a base test class.**
`@Transactional` is inherited, and there is no "not transactional" annotation. The
mechanism is `@Transactional(propagation = NOT_SUPPORTED)` on the subclass, which reads
like a workaround and is in fact the documented way.

**★ `@Transactional` is not supported on `@BeforeAll`-style lifecycle methods.**
Which means class-level fixture setup written there is outside any test transaction and is
therefore committed. That is often what you want; it is a surprise when the class-level
setup was assumed to be cleaned up like everything else.

## Interview questions

**★ You added an `@AfterEach` that deletes the test's rows and the database is still dirty. Why?**
Because `@AfterEach` runs *inside* the test-managed transaction, so the deletes are rolled
back with everything else. If the rows are still there, they were committed by something
that escaped the test transaction — code that started its own, a `REQUIRES_NEW`, or a
`@Commit` somewhere in the hierarchy — and the `@AfterEach` never had a chance. Cleanup
that must survive belongs in `@AfterTransaction`, or in an `@Sql` script with
`transactionMode = ISOLATED`, or in a truncation step that runs *before* the next test.

**★ What are `@BeforeTransaction` and `@AfterTransaction` for?**
They are the only hooks that run outside the test-managed transaction: `@BeforeTransaction`
before it starts and `@AfterTransaction` after it has been rolled back or committed. They
are where you assert on the database as another connection sees it — "nothing was
committed", "the fixture is as expected before we start" — and where cleanup that must
survive the rollback belongs. In Jupiter they can take parameters resolved by registered
`ParameterResolver` extensions, so `@AfterTransaction void check(@Autowired DataSource ds)`
works.

**★ When would you use `TestTransaction`?**
When the test's subject is the transaction boundary itself: proving that something is only
visible after commit, that an `AFTER_COMMIT` listener fires, or that a second connection
can see the row. `flagForCommit()` then `end()` commits the current test transaction, and
`start()` opens a fresh one that will be rolled back as usual. I treat needing it as a
signal, though — a test that manages three transaction boundaries is usually a test that
should not have had a test-managed transaction at all, and would read better with
`propagation = NOT_SUPPORTED` and explicit cleanup.

**★ How do you write one non-transactional test in an otherwise transactional class?**
`@Transactional(propagation = Propagation.NOT_SUPPORTED)` on that method. Those two
propagation values are the only ones the test framework honours, and `NOT_SUPPORTED` is the
safer of the two because it suspends any existing transaction rather than throwing. The
same technique is how you opt a subclass out of a `@Transactional` base test class, since
the annotation is inherited and there is no negative form of it. Whatever that method
writes is then committed, so it has to clean up after itself.

**★ A colleague sets `@Transactional(isolation = SERIALIZABLE)` on a test to prove the code is safe under serializable isolation. What do you tell them?**
That the attribute is not supported for test-managed transactions and is silently ignored,
so the test is running at whatever the connection's default isolation is and proves nothing
about serializable behaviour. Isolation-level behaviour needs two real connections, which a
single test transaction cannot give you — so the test has to be non-transactional, opening
its own connections or using two threads, and the container has to be the real engine
because isolation semantics differ between engines even where the level names match.

**★ How would you audit an existing suite for tests that leave data behind?**
Grep for `@Commit` *and* `@Rollback(false)`, since they are the same thing with two
spellings, and for `TestTransaction` and `REQUIRES_NEW`. Then look for the subtler category:
tests that are not transactional at all because the class is `@SpringBootTest` without
`@Transactional`, which is the default and which no annotation announces. Finally, the
cheapest global check is to run the whole suite twice against the same database without
resetting it — anything that fails on the second run is leaving state behind, and that is
the subject of [05b](05b-tests-that-depend-on-each-other.md).

{/* FOOTER */}
