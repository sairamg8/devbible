---
title: "There is no per-script atomicity: statements go to the driver one at a time, so a fixture that dies at statement seven has already applied six, and whether those six survive is decided by a transaction setting most people never touch"
sidebar_label: "04c2 · Error modes and half-failed scripts"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the javadoc for
> [`SqlConfig.ErrorMode`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.ErrorMode.html)
> and
> [`SqlConfig.TransactionMode`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.TransactionMode.html),
> and the **Spring Framework 7.0.x** testing reference, *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8.
> ⚠️ **No database and no sandbox on this machine** — Java source, SQL and documented
> behaviour only, never the output of a run. One claim on this page is explicitly marked
> as unconfirmed.

**[04c](04c-sqlconfig-and-the-parser.md) established that Spring splits your script and
sends the pieces individually. That fact has a consequence worth its own page: there is no
such thing as a script that half-ran and was undone. Six of ten statements executed is a
real database state, and it will be inherited by the next test unless something rolls it
back. This chunk covers the four error modes, what each leaves behind, and how to find out
what actually ran.**

## The four error modes, verbatim

> **`DEFAULT`** — *"Indicates that the default error mode should be used. … If `@SqlConfig`
> is declared only locally, the default error mode is `FAIL_ON_ERROR`. If `@SqlConfig` is
> declared globally, the default error mode is `FAIL_ON_ERROR`. If `@SqlConfig` is declared
> globally and locally, the default error mode for the local declaration is inherited from
> the global declaration."*

> **`FAIL_ON_ERROR`** — *"Indicates that script execution will fail if an error is
> encountered. In other words, no errors should be ignored. This is effectively the default
> error mode so that if a script is accidentally executed, it will fail fast if any SQL
> statement in the script results in an error."*

> **`CONTINUE_ON_ERROR`** — *"Indicates that all errors in SQL scripts should be logged but
> not propagated as exceptions. `CONTINUE_ON_ERROR` is the logical opposite of
> `FAIL_ON_ERROR` and a superset of `IGNORE_FAILED_DROPS`."*

> **`IGNORE_FAILED_DROPS`** — *"Indicates that failed SQL `DROP` statements can be ignored.
> This is useful for a non-embedded database whose SQL dialect does not support an
> `IF EXISTS` clause in a `DROP` statement."*

Note the phrasing of `DEFAULT`: it is a sentinel, not a mode. Its meaning depends on where
`@SqlConfig` is declared, and in the global-plus-local case it means *inherit*, which is
how one class-level `errorMode` reaches every script in the hierarchy.

## What is left behind, worked through

Statements are executed individually. So if statement seven of ten raises an error under
`FAIL_ON_ERROR`, statements one to six have already been executed by the driver. Whether
that survives is not an error-mode question at all — it is a transaction question, and
`transactionMode` decides it:

| The script is running… | After a failure at statement seven |
|---|---|
| inside the test's existing transaction (the usual case in a `@Transactional` test) | statements 1–6 are rolled back with the test; damage contained |
| in an isolated transaction that commits immediately (`transactionMode = ISOLATED`) | 1–6 are committed by that transaction's commit, or lost if the failure aborts it — either way the outcome is decided before the test runs |
| with no transaction at all — no transaction manager is available | 1–6 are committed. The database is now in a state no file in your repository describes |

The third row is the one to design against. It is also the **default in a plain `@JdbcTest`
against a real database** whenever no transaction manager is in play, and it is what makes
a broken fixture script poison the rest of the class rather than just failing its own test.
The full inference rules for `transactionMode` — including what "available" means and why
a missing transaction manager silently changes the semantics — are in
[05a3 · Truncating and deleting](05a3-truncating-and-deleting.md), because they matter most
for cleanup.

`CONTINUE_ON_ERROR` makes all of this strictly worse. It converts a loud failure into a
partially applied fixture and a log line nobody reads, so the test fails later on an
assertion about a row that was never inserted, three steps away from the actual problem.
The only defensible use is a teardown script whose statements are independent and whose
failures are genuinely uninteresting — and even there, `IGNORE_FAILED_DROPS` is the
narrower, better-targeted version of the same idea, because it relaxes exactly one
statement type instead of all of them.

```java
// Defensible: a teardown that drops objects which may or may not exist,
// on an engine without DROP ... IF EXISTS.
@Sql(scripts        = "/db/drop-temp-objects.sql",
     executionPhase = AFTER_TEST_CLASS,
     config         = @SqlConfig(errorMode = IGNORE_FAILED_DROPS))
```

```java
// Not defensible: silencing a fixture because it "sometimes fails".
@Sql(scripts = "/db/seed.sql",
     config  = @SqlConfig(errorMode = CONTINUE_ON_ERROR))   // 🔴
```

If a fixture script sometimes fails, the fixture depends on state left by something else,
and that is the bug — see [05b](05b-tests-that-depend-on-each-other.md).

⚠️ **What I could not confirm from the documentation:** exactly how a failure in an
`AFTER_TEST_METHOD` script is attributed in the test report — whether a test whose
assertions already passed is re-reported as failed, or the failure surfaces separately. The
mechanism is that the exception propagates out of the listener's after-test callback, so
expect it to appear against that test, but do not build a workflow on the distinction, and
do not put assertions you care about in a teardown script.

## Seeing what actually ran

The reference gives two logger names, and they answer different questions:

> *"Set `org.springframework.test.context.jdbc` to `DEBUG` to see which SQL scripts are
> being executed."*

> *"Set `org.springframework.jdbc.datasource.init` to `DEBUG` to see which SQL statements
> are being executed."*

The first settles *declaration* arguments: did the class-level script run for this method,
or did merge mode drop it; did the listener run at all. The second settles *parser*
arguments, because it shows the statements after splitting — which is the only way to see
that Spring cut your function body in half.

```properties
# src/test/resources/logback-test.xml equivalent, as properties
logging.level.org.springframework.test.context.jdbc=DEBUG
logging.level.org.springframework.jdbc.datasource.init=DEBUG
```

Turn the first on when the data is missing. Turn the second on when the data is missing
*and* the first says the script ran.

## The programmatic escape hatch

When the declarative form runs out — the script path is computed, the fixture depends on
something only known at runtime, or you want the population inside a method rather than
around it — the same machinery is directly available. From the reference:

```java
@Test
void databaseTest() {
    ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
    populator.addScripts(
            new ClassPathResource("test-schema.sql"),
            new ClassPathResource("test-data.sql"));
    populator.setSeparator("@@");
    populator.execute(this.dataSource);
    // run code that uses the test schema and data
}
```

> *"`ResourceDatabasePopulator` provides an object-based API for programmatically
> populating, initializing, or cleaning up a database by using SQL scripts defined in
> external resources. `ResourceDatabasePopulator` provides options for configuring the
> character encoding, statement separator, comment delimiters, and error handling flags
> used when parsing and running the scripts. Each of the configuration options has a
> reasonable default value."*

> *"To run the scripts configured in a `ResourceDatabasePopulator`, you can invoke either
> the `populate(Connection)` method to run the populator against a `java.sql.Connection` or
> the `execute(DataSource)` method to run the populator against a `javax.sql.DataSource`."*

`ScriptUtils` sits below it and the reference is clear about the intended audience —
*"mainly intended for internal use within the framework"* — so reach for the populator, not
for `ScriptUtils`, unless you genuinely need *"full control over how SQL scripts are parsed
and run"*.

Note what the populator does **not** give you: it runs on whatever connection and
transaction you call it from, so `execute(dataSource)` inside a `@Transactional` test opens
its own connection from the pool and does **not** join the test's transaction. That is
sometimes exactly what you want — it is the manual equivalent of
`transactionMode = ISOLATED` — and it is a surprise if you assumed otherwise.

## Where this connects

- The parser and the `@SqlConfig` attributes:
  [04c · `@SqlConfig` and the parser](04c-sqlconfig-and-the-parser.md).
- `transactionMode` in full, and cleanup scripts that vanish:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Fixture scripts that "sometimes fail" because a previous test left state:
  [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).
- Execution phases, including where a teardown script sits:
  [04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md).

## Gotchas

**★ Under `FAIL_ON_ERROR`, the statements before the failure have already been executed.**
There is no per-script atomicity — Spring sends statements individually. Whether the
earlier statements survive depends entirely on the transaction the script is running in,
and in the no-transaction-manager case they are committed. A fixture that fails halfway can
leave a database state that no file in the repository describes.

**★ `CONTINUE_ON_ERROR` converts a broken fixture into a silently partial one.**
Errors are logged and not propagated, so a script that inserted three rows out of ten
reports success and the test fails later on an assertion with no visible connection to the
real problem. If you must tolerate failures, tolerate only the ones you mean:
`IGNORE_FAILED_DROPS`, and only in teardown.

**★ `errorMode = DEFAULT` is not a mode, it is "inherit".**
When `@SqlConfig` is declared globally and locally, `DEFAULT` on the local declaration
means the global one's value. So a class-level `CONTINUE_ON_ERROR` — added once, for one
script — silently becomes the error mode for every script in the class hierarchy, including
the ones whose failures you very much want to see.

**★ `IGNORE_FAILED_DROPS` is a subset of `CONTINUE_ON_ERROR`, not a different axis.**
The javadoc says `CONTINUE_ON_ERROR` is *"a superset of `IGNORE_FAILED_DROPS`"*. There is
no combination to reason about, and no mode that ignores drops *and* fails on everything
else more strictly than `IGNORE_FAILED_DROPS` already does.

**★ A cleanup script that fails is easy not to notice.**
It runs after the test, when everyone's attention is on the assertion result. Under
`CONTINUE_ON_ERROR` it produces nothing at all; under `FAIL_ON_ERROR` it produces a failure
whose attribution I could not confirm from the documentation. Either way, the next test
inherits the state that was supposed to be cleaned — so cleanup failures show up as a
different test failing, in a different class.

**★ `ResourceDatabasePopulator.execute(dataSource)` does not join the test's transaction.**
It takes its own connection from the pool. Inside a `@Transactional` test that means the
data it inserts is committed independently and survives the test's rollback — useful when
that is what you want, and a leak when it is not.

**★ Two loggers, two different questions, and reaching for the wrong one wastes an hour.**
`org.springframework.test.context.jdbc` tells you which *scripts* ran, which is the
merge-mode and listener question. `org.springframework.jdbc.datasource.init` tells you which
*statements* ran, which is the parser question. "The script ran and the data is missing"
needs the second one.

## Interview questions

**★ What are the error modes and which would you actually use?**
`FAIL_ON_ERROR` is the effective default and is what you want for fixtures — a partially
applied script is worse than one that failed loudly. `CONTINUE_ON_ERROR` logs everything
and propagates nothing, which is how you end up debugging an assertion three steps
downstream of the real problem. `IGNORE_FAILED_DROPS` relaxes exactly one statement type,
for engines without `DROP … IF EXISTS`, and is the only relaxation I would put in a
codebase. `DEFAULT` is the sentinel meaning "inherit from the global declaration if there
is one, otherwise `FAIL_ON_ERROR`".

**★ A script fails at statement seven of ten. What is the state of the database?**
Statements one to six have executed; there is no per-script atomicity because Spring sends
them individually over JDBC. Whether the effect survives depends on the transaction the
script is running in: inside the test's transaction they are rolled back with the test; in
an isolated transaction that commits immediately, or with no transaction at all because no
transaction manager was available, they are committed and the next test inherits them. The
third case is the one to design against, because the leftover state is not described by any
file in the repository and the failure it causes appears in a different test.

**★ Someone silences a flaky fixture with `CONTINUE_ON_ERROR`. What do you say?**
That the flakiness is the finding, not the noise. A fixture script that "sometimes fails"
is almost always inserting a row that a previous test already inserted, or dropping
something that a previous run left behind — in other words, the suite has order dependence
or incomplete cleanup, and the script is the only thing currently reporting it. Silencing
it turns a visible failure into an invisible one: the script now half-applies, and the test
fails somewhere else on an assertion about missing data. The fix is upstream, in cleanup or
in giving each test its own data.

**★ How do you find out which scripts and which statements actually ran?**
Two loggers, both named in the reference. `org.springframework.test.context.jdbc` at DEBUG
shows which scripts were executed — that is how you catch a merge-mode surprise, or a
custom `@TestExecutionListeners` that dropped the listener entirely.
`org.springframework.jdbc.datasource.init` at DEBUG shows the individual statements after
splitting, which is how you catch a parser problem such as a function body cut at an
internal semicolon. They answer different questions and picking the wrong one costs time.

**★ When would you use `ResourceDatabasePopulator` instead of `@Sql`?**
When the fixture cannot be expressed declaratively: the script path is computed at runtime,
the population has to happen part-way through a test method rather than around it, or you
need to populate a second `DataSource` that the annotation's discovery convention would not
select. It is the same underlying machinery with the same options — encoding, separator,
comment delimiters, error handling — exposed as an object. One behavioural difference worth
knowing: `execute(dataSource)` takes its own connection, so it does not join the test's
transaction and its writes are not rolled back with the test.

{/* FOOTER */}
