---
title: "A @Transactional test rolls back by default, and most of @Transactional's attributes do nothing there — isolation, timeout, readOnly, rollbackFor and noRollbackFor are all documented as unsupported for test-managed transactions, so the annotation you copied from production is mostly decoration"
sidebar_label: "08 · Transactions in tests"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Transaction Management*
> ([tx](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html))
> — the attribute-support table, the lifecycle-method rules and the `@BeforeTransaction` example
> are read from that page.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> **No sandbox** — no database was touched.

**`@Transactional` on a test is not the same annotation as `@Transactional` on a service, even
though it is literally the same annotation. On a service it configures a transaction. On a test
it starts one and then **throws it away**, and most of the attributes you would reach for are
explicitly unsupported. This chunk is what it actually does; [08b](08b-what-rollback-hides.md) is
what that costs you in test fidelity.**

## The default

> *"Annotating a test method with `@Transactional` causes the test to be run within a transaction
> that is, by default, automatically rolled back after completion of the test."*

Class-level works too: *"If a test class is annotated with `@Transactional`, each test method
within that class hierarchy runs within a transaction."* And the converse is worth stating because
people assume otherwise: *"Test methods that are not annotated with `@Transactional` (at the class
or method level) are not run within a transaction."*

🔴 **Remember that `@DataJpaTest` and `@JdbcTest` carry `@Transactional`** ([03](03-the-slices.md)),
so those slices roll back whether or not you asked.

## 🔴 The attribute table — most of it does nothing

This is the part almost nobody knows, and it is a plain table in the reference:

| Attribute | Supported for test-managed transactions? |
|---|---|
| `value` / `transactionManager` | **yes** |
| `propagation` | **only `NOT_SUPPORTED` and `NEVER`** |
| `isolation` | **no** |
| `timeout` | **no** |
| `readOnly` | **no** |
| `rollbackFor` / `rollbackForClassName` | **no** — use `TestTransaction.flagForRollback()` |
| `noRollbackFor` / `noRollbackForClassName` | **no** — use `TestTransaction.flagForCommit()` |

So:

```java
@Test
@Transactional(isolation = SERIALIZABLE, timeout = 5, readOnly = true)   // ← all three ignored
void readsConsistently() { }
```

That test does not run at `SERIALIZABLE`, has no timeout, and is not read-only. It reads like a
carefully configured test and is a plain rolled-back transaction. **If your test's subject is
isolation-level behaviour, a test-managed transaction cannot express it** — you need the real
service's own `@Transactional` to be doing the work, which means not putting `@Transactional` on
the test at all.

The two supported `propagation` values are the useful escape hatches: `NOT_SUPPORTED` suspends the
test transaction for that method, and `NEVER` makes it an error for one to exist.

## Which lifecycle methods are inside the transaction

The rule is not intuitive and it decides whether your setup data is visible:

**Run *inside* the test-managed transaction:**
- `@BeforeEach` and `@AfterEach`
- the `@Test` method itself

**Run *outside* it:**
- `@BeforeAll` and `@AfterAll`

So data inserted in `@BeforeEach` is rolled back with the test — usually what you want. Data
inserted in `@BeforeAll` is **not**, because there was no transaction; it persists for the whole
class and beyond, and is a genuine source of cross-class pollution.

🔴 **And separately: `@Transactional` is not supported *on* any lifecycle method.** Not on
`@BeforeAll`, `@BeforeEach`, `@AfterEach` or `@AfterAll`. Annotating one does not extend or create
a test-managed transaction.

## `@BeforeTransaction` and `@AfterTransaction`

When you need code to run around a transactional test but *outside* the transaction:

```java
@BeforeTransaction
void verifyInitialDatabaseState() {
    // logic to verify the initial state before a transaction is started
}

@AfterTransaction
void verifyFinalDatabaseState() {
    // logic to verify the final state after transaction has rolled back
}
```

`@AfterTransaction` is the more interesting of the two: it is where you can assert **that the
rollback actually happened**, because you are looking at the database after the transaction ended.

With `SpringExtension` these methods may take injected arguments:

```java
@BeforeTransaction
void verifyInitialDatabaseState(@Autowired DataSource dataSource) {
    // Use the DataSource to verify the initial state
}
```

## `@Commit` and `@Rollback`

`@Commit` commits instead of rolling back; `@Rollback` marks a test for rollback and overrides a
class-level `@Commit`:

```java
@SpringJUnitConfig
@Transactional
@Commit
class FictitiousTransactionalTest {

    @Test
    @Rollback
    void modifyDatabaseWithinTransaction() {
        // rolled back, despite the class-level @Commit
    }
}
```

**`@Commit` deserves suspicion.** A committing test leaves rows behind, which means the next test
sees them, which means the suite has an order dependence — the exact failure
[topic 01 · 11d](../01-junit-5/11d-when-order-is-a-smell.md) argues against. It is occasionally
right (you genuinely need to observe post-commit behaviour), and when it is, the test owns the
cleanup.

## Where this topic stops

The ORM-level consequences of a rolled-back test transaction — flush timing, the first-level cache
hiding a broken mapping, a constraint violation that never fires — are argued exhaustively in
**Phase 10 topic 04**'s `20`-series and are not repeated here. This topic owns the *test-level*
decision: whether the test should be transactional at all, and what that choice hides. That is
[08b · What rollback hides](08b-what-rollback-hides.md).

## Gotchas and pitfalls

**★ Copying `@Transactional(isolation = …, timeout = …, readOnly = true)` onto a test.**
All three are unsupported for test-managed transactions and silently do nothing. The test looks
configured and is not.

**★ Using `rollbackFor` / `noRollbackFor` on a test.**
Also unsupported. The programmatic equivalents are `TestTransaction.flagForRollback()` and
`flagForCommit()` — [08b](08b-what-rollback-hides.md).

**★ Inserting fixture data in `@BeforeAll`.**
It runs outside the test-managed transaction, so it is never rolled back. It survives the class and
pollutes everything after it. `@BeforeEach` runs inside and is cleaned up.

**★ Putting `@Transactional` on `@BeforeEach` to "make setup transactional".**
Unsupported on lifecycle methods. `@BeforeEach` is already inside the test's transaction when the
test is transactional; when it is not, the annotation does not create one.

**★ Assuming a slice is not transactional because you did not say so.**
`@DataJpaTest` and `@JdbcTest` are meta-annotated `@Transactional`. Rollback is on by default and
frequently surprises people debugging "why is my row not there".

**★ `@Commit` for convenience.**
It leaves data behind and creates an order dependence in the suite. If you need it, own the
cleanup explicitly.

**★ Expecting `@Transactional` to roll back a `RANDOM_PORT` test.**
It cannot — the server handles the request on a different thread with its own transaction, which
commits. [04b · webEnvironment](04b-webenvironment.md).

**★ Testing isolation-level behaviour with a test-managed transaction.**
`isolation` is unsupported, and the test transaction wraps everything anyway, so a second
concurrent reader does not exist. That test needs two real connections and no test transaction.

## Interview questions

**★ What does `@Transactional` on a test method do?**
It runs the test inside a transaction that is automatically rolled back at the end by default. A
class-level `@Transactional` applies to every test method in the class hierarchy, and methods
without it — at either level — do not run in a transaction at all.

**★ Which `@Transactional` attributes actually work on a test?**
Only `value`/`transactionManager`, and `propagation` restricted to `NOT_SUPPORTED` and `NEVER`.
`isolation`, `timeout`, `readOnly`, `rollbackFor` and `noRollbackFor` are all documented as
unsupported for test-managed transactions — they are silently ignored, so the annotation reads as
configured while doing none of it.

**★ Which lifecycle methods run inside the test transaction?**
`@BeforeEach` and `@AfterEach` run inside it; `@BeforeAll` and `@AfterAll` run outside. That is
why fixture data inserted in `@BeforeAll` is never rolled back and leaks across classes, while the
same insert in `@BeforeEach` is cleaned up.

**★ Can you put `@Transactional` on `@BeforeEach`?**
You can write it, and it is not supported — the reference states `@Transactional` is not supported
on test lifecycle methods. It neither creates nor extends a test-managed transaction.

**★ How do you assert that a rollback actually happened?**
`@AfterTransaction`. It runs after the transactional test method but outside the transaction, so
the database you observe is the post-rollback state. Its counterpart `@BeforeTransaction` verifies
the initial state before the transaction starts, and with `SpringExtension` both can take injected
arguments such as a `DataSource`.

**★ What is wrong with `@Commit` on a test?**
It leaves rows behind, so the next test sees them and the suite acquires an order dependence that
shows up only in certain sequences. It is sometimes correct — when post-commit behaviour is the
subject — and when it is, the test must own its cleanup explicitly.

**★ Your `@DataJpaTest` inserts a row and a later assertion cannot find it in the database. Why?**
Two candidates, both from the slice being meta-annotated `@Transactional`: the transaction is
rolled back at the end so nothing persists beyond the test, and within the test the persistence
context may not have been flushed, so the row is not in the database yet even though the entity
exists. Neither is a bug.

**★ Can you test `SERIALIZABLE` isolation with a `@Transactional` test?**
No. `isolation` is unsupported on test-managed transactions, and the test transaction wraps
everything so there is no concurrent reader to conflict with. Testing isolation requires two real
connections doing real work, which means not annotating the test.

{/* FOOTER */}
