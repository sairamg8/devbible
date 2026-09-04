---
title: "@Sql scripts do not run where you think they do relative to @BeforeEach and @AfterEach, there are four phases rather than the two most tutorials know about, and the two class-level phases pull the whole ApplicationContext forward in a way that breaks container startup"
sidebar_label: "04b · Phases and the lifecycle"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the javadoc for
> [`Sql.ExecutionPhase`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/Sql.ExecutionPhase.html).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No database, no Docker and no sandbox on this machine** — Java source, SQL and
> documented behaviour only, never the output of a run.

**[04](04-fixtures-in-the-database.md) established where a script comes from. This chunk is
about *when* it runs. There are four execution phases, two of which only exist from
Framework 6.1; the before-script runs before `@BeforeEach` and the after-script runs after
`@AfterEach`, which is the reverse of what most people assume and quietly invalidates the
common "assert the database is clean in `@AfterEach`" habit; and the class-level phases
carry a documented side effect that breaks Testcontainers suites which start their
container in `@BeforeAll`.**

## The four phases

`executionPhase` defaults to `BEFORE_TEST_METHOD`. The four constants, quoted from the
javadoc:

> **`BEFORE_TEST_METHOD`** — *"The configured SQL scripts and statements will be executed
> before the corresponding test method. Specifically, the configured SQL scripts and
> statements will be executed prior to any before test lifecycle methods of a particular
> testing framework — for example, methods annotated with JUnit Jupiter's `@BeforeEach`
> annotation."*

> **`AFTER_TEST_METHOD`** — *"… will be executed after the corresponding test method.
> Specifically, … after any after test lifecycle methods … for example, methods annotated
> with JUnit Jupiter's `@AfterEach` annotation."*

> **`BEFORE_TEST_CLASS`** *(since 6.1)* — *"The configured SQL scripts and statements will
> be executed once per test class before any test method is run. Specifically, … prior to
> any before class lifecycle methods … for example, methods annotated with JUnit Jupiter's
> `@BeforeAll` annotation."*

> **`AFTER_TEST_CLASS`** *(since 6.1)* — *"… once per test class after all test methods
> have run. Specifically, … after any after class lifecycle methods … for example, methods
> annotated with JUnit Jupiter's `@AfterAll` annotation."*

The full timeline for one method, with everything present:

```text
BEFORE_TEST_CLASS script
  @BeforeAll
    BEFORE_TEST_METHOD script
      @BeforeEach
        @Test
      @AfterEach
    AFTER_TEST_METHOD script
  @AfterAll
AFTER_TEST_CLASS script
```

Read that ordering carefully, because it is the opposite of what people assume. The
scripts are on the **outside** of JUnit's lifecycle methods, not the inside. Three
practical consequences:

- A `@BeforeEach` can read and mutate the rows the script just inserted. That is a useful
  hook — read the generated key into a field, adjust one column — and it is also how a
  fixture ends up being modified in a place nobody thinks to look when the data is wrong.
- An `@AfterEach` that asserts on the database still sees the test's own writes, because
  the cleanup script has not run yet. "Assert the table is empty in `@AfterEach`" fails,
  and it fails in a way that looks like the cleanup script is broken when it has simply not
  been given its turn.
- If you write cleanup in both `@AfterEach` and an `AFTER_TEST_METHOD` script, the
  `@AfterEach` runs first. Two cleanup mechanisms in one class is already a smell; knowing
  the order stops you from debugging the wrong one.

## The class-level phases, and the warning attached to them

`BEFORE_TEST_CLASS` carries a note that is easy to trip over in a Testcontainers suite:

> *"NOTE: Configuring `BEFORE_TEST_CLASS` as the execution phase causes the test's
> `ApplicationContext` to be eagerly loaded during test class initialization which can
> potentially result in undesired side effects. For example, `@DynamicPropertySource`
> methods will be invoked before `@BeforeAll` methods when using `BEFORE_TEST_CLASS`."*

The mechanism is straightforward once stated: to run a script the listener needs a
`DataSource`, to get a `DataSource` it needs the context, and to have the context before
any `@BeforeAll` runs it must build the context during class initialization. Anything that
was relying on `@BeforeAll` having already happened is now wrong.

The concrete failure: a container started in `@BeforeAll`, with its JDBC URL published from
a `@DynamicPropertySource`. Add a class-level `BEFORE_TEST_CLASS` script and the property
source is invoked against a container that has not started — so it either throws while
asking for the mapped port, or publishes a URL for a port that is not listening. The stack
trace names the property source, not the annotation you added.

The fix is not to abandon the phase. It is to take container startup out of JUnit's class
lifecycle: start it from a `static` initializer, which is the
[singleton pattern](../07-testcontainers/05-the-singleton-pattern.md), or use
[`@ServiceConnection`](../07-testcontainers/04-serviceconnection.md) so the connection
details are contributed by a bean rather than by a lifecycle callback.

## What each phase is actually good for

```java
@JdbcTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Sql(scripts = "/db/schema.sql",   executionPhase = BEFORE_TEST_CLASS)
@Sql(scripts = "/db/drop-all.sql", executionPhase = AFTER_TEST_CLASS)
class LedgerQueryTest {

    @Test
    @Sql("/db/three-postings.sql")
    void sumsPostingsByAccount() { }
}
```

- **`BEFORE_TEST_CLASS` — structure that every method in the class shares and no method
  changes.** Schema, reference tables, an extension, a role. It runs once, so it is the
  only phase where an expensive script is affordable. It is also, per
  [04b2](04b2-groups-and-merge-mode.md), the one kind of class-level declaration a
  method-level `@Sql` cannot override.
- **`BEFORE_TEST_METHOD` — the rows this test is about.** The default, and the right
  default.
- **`AFTER_TEST_METHOD` — cleanup, with a caveat that fills half of
  [05a3](05a3-truncating-and-deleting.md).** Inside a `@Transactional` test the cleanup
  script participates in the test's transaction and is rolled back with it, so it does
  nothing at all unless you set `transactionMode = ISOLATED`.
- **`AFTER_TEST_CLASS` — dropping what `BEFORE_TEST_CLASS` created.** Useful when several
  classes share one database and each owns its own tables; useless as a between-method
  reset, because every method in the class runs before it.

There is a general principle underneath: **a phase is a statement about scope, and the
scope you choose is also a statement about what tests may share.** Anything created in
`BEFORE_TEST_CLASS` is shared by every method in the class, and the moment one method
writes to it you have manufactured the order dependence that
[05b](05b-tests-that-depend-on-each-other.md) is about. Class-phase scripts should create
things that are read and not written.

## Where this connects

- Where the script comes from and how the path is resolved:
  [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- Repeatable `@Sql`, `@SqlGroup`, and why a method-level declaration cancels the
  class-level one: [04b2 · Groups and merge mode](04b2-groups-and-merge-mode.md).
- How a script is parsed and what happens when it fails halfway:
  [04c · `@SqlConfig` and the parser](04c-sqlconfig-and-the-parser.md).
- Why an `AFTER_TEST_METHOD` cleanup script disappears inside a transactional test:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- JUnit's own lifecycle ordering, which these phases interleave with:
  [01 · JUnit 5 → 03 The lifecycle](../01-junit-5/03-the-lifecycle.md).

## Gotchas

**★ `BEFORE_TEST_CLASS` forces the `ApplicationContext` to load during test class
initialization, ahead of `@BeforeAll`.**
The javadoc calls this out because it reorders `@DynamicPropertySource` relative to
`@BeforeAll`. In a suite that starts a container in `@BeforeAll`, adding a class-phase
script breaks property resolution and the failure surfaces as a connection error pointing
at the property source. Start containers from a `static` block or via `@ServiceConnection`.

**★ A cleanup script in `AFTER_TEST_METHOD` runs *after* `@AfterEach`, not before it.**
So an `@AfterEach` that asserts the database is empty will fail, because at that moment it
is not. If you want to verify cleanup, verify it from `@AfterTransaction` or at the start
of the next test — never from `@AfterEach`.

**★ A `BEFORE_TEST_METHOD` script runs *before* `@BeforeEach`, so a `@BeforeEach` that
inserts data is layering on top of the fixture, not replacing it.**
Teams that migrate half a class from `@BeforeEach` inserts to `@Sql` and stop halfway end
up with both running, in that order, and duplicate-key violations that appear only in the
methods that were migrated. Pick one mechanism per class.

**★ Class-phase scripts run once per class, so they are not a cleanup mechanism between
methods.**
`AFTER_TEST_CLASS` is the right place to drop a schema and the wrong place to delete rows:
every method in the class has already run against whatever its predecessors left. Between
methods you need `AFTER_TEST_METHOD`, rollback, or truncation — see
[05 · Cleanup](05-cleanup.md).

**★ Anything a class-phase script creates is shared mutable state for the whole class.**
That is fine for a schema and for read-only reference data. It is exactly the shared-row
bug the moment one method updates a row the class-phase script inserted, and it will
reproduce only when the methods run in a particular order. Class-phase scripts should
create things nothing writes to.

**★ `BEFORE_TEST_CLASS` and `AFTER_TEST_CLASS` do not exist before Spring Framework 6.1.**
On an older Framework the constants are simply not there, so a sample copied from current
documentation fails to compile rather than misbehaving — which is the merciful failure.
Worth knowing when reading answers online: anything that says "`@Sql` has two phases" was
written against 6.0 or earlier.

**★ The class-level phases fire per test class, including for each `@Nested` class that
inherits them.**
A `@Nested` class is a test class for these purposes, so an inherited `BEFORE_TEST_CLASS`
script runs again for every nested class. A `CREATE TABLE` without `IF NOT EXISTS` in that
script will fail the second time.

## Interview questions

**★ Name the execution phases and say exactly where they sit relative to JUnit's lifecycle methods.**
`BEFORE_TEST_METHOD` (the default) runs before any `@BeforeEach`; `AFTER_TEST_METHOD` runs
after any `@AfterEach`; `BEFORE_TEST_CLASS` and `AFTER_TEST_CLASS`, added in Framework 6.1,
run once per class before any `@BeforeAll` and after any `@AfterAll` respectively. The
scripts sit outside JUnit's callbacks in both directions. The practical consequences are
that a `@BeforeEach` can read and mutate the rows a script just inserted, and that an
`@AfterEach` still sees the test's own writes because the cleanup script has not run yet —
which is why asserting a clean database in `@AfterEach` never works.

**★ A colleague adds `@Sql(executionPhase = BEFORE_TEST_CLASS)` to a Testcontainers test class and property resolution breaks. Why?**
Because that phase causes the test's `ApplicationContext` to be loaded eagerly during test
class initialization, which the javadoc explicitly warns about: `@DynamicPropertySource`
methods are then invoked before `@BeforeAll` methods. If the container is started inside
`@BeforeAll`, the dynamic property source now reads a mapped port from a container that has
not started. The fix is to start the container from a `static` initializer — the singleton
pattern — or to use `@ServiceConnection`, so container startup no longer depends on JUnit's
class lifecycle at all.

**★ When would you put a script in `BEFORE_TEST_CLASS` rather than the default phase?**
When it creates structure that every method in the class needs and no method changes:
schema, an extension, reference data that is only read. It runs once per class instead of
once per method, so it is the only phase where an expensive script is affordable, and
class-level declarations in that phase cannot be overridden by a method-level `@Sql`, which
removes a whole class of merge-mode surprises. The line I hold is that a class-phase script
must not create anything a test writes to — the moment it does, the class has shared
mutable state and the tests become order-dependent.

**★ Why does `AFTER_TEST_METHOD` cleanup so often appear to do nothing?**
Almost always because the test class is `@Transactional`. The script is executed within the
test's existing transaction — that is what the inferred transaction mode does — and that
transaction is rolled back after the test, taking the cleanup with it. It is not that the
script failed; it ran and was undone. Setting `transactionMode = ISOLATED` in `@SqlConfig`
makes the script run in its own transaction that commits immediately, which is the only way
a cleanup script survives a rolled-back test.

**★ You need a table created once for the class and rows inserted per method. How do you express that, and what could go wrong?**
Class-level `@Sql` with `executionPhase = BEFORE_TEST_CLASS` for the DDL, method-level
`@Sql` in the default phase for the rows. What goes wrong: if a `@Nested` class inherits
the class-level declaration, the DDL script runs again for the nested class and a plain
`CREATE TABLE` fails the second time — so write it with `IF NOT EXISTS` or scope it
deliberately. And if the class-phase script also seeds rows that some method updates, the
class is now order-dependent, because those rows are shared for the whole class.

{/* FOOTER */}
