---
title: "A fixture that lives in a .sql file is a claim about rows rather than about objects, and @Sql is how Spring makes that claim declaratively — but the string you put in the annotation has four different meanings depending on how it starts, and the empty annotation is the one that binds hardest"
sidebar_label: "04 · Fixtures in the database"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the javadoc for
> [`org.springframework.test.context.jdbc.Sql`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/Sql.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No database, no Docker and no sandbox on this machine** — this page carries Java
> source, SQL and documented behaviour, never the output of a test run.

**Everything so far in this topic has been about objects a test constructs in memory. A
repository test does not get to work that way: the thing under test reads rows, so the
fixture has to be rows. `@Sql` is Spring's declarative answer, and it is a bigger
annotation than it looks. This chunk covers the machinery that runs it, the three ways to
say what to run, and — the part that causes most of the lost afternoons — how the path
string is resolved and what happens when you supply no path at all.
[04b](04b-phases-and-the-lifecycle.md) covers when scripts run;
[04b2](04b2-groups-and-merge-mode.md) covers how class-level and method-level declarations
combine; [04c](04c-sqlconfig-and-the-parser.md) covers how the script is parsed and what
happens when it fails halfway.**

## What actually runs the script

`@Sql` is not magic on the annotation; it is a `TestExecutionListener`. The reference is
explicit:

> *"Support for `@Sql` is provided by the `SqlScriptsTestExecutionListener`, which is
> enabled by default."*

Two consequences follow immediately. First, `@Sql` works in **any** TestContext-based
test — `@SpringBootTest`, `@DataJpaTest`, `@JdbcTest`, a plain `@SpringJUnitConfig` — with
no extra registration, because the listener is in the default set. It is not a JPA feature
and it is not a Boot feature. Second, if you declare `@TestExecutionListeners` yourself
without `mergeMode = MERGE_WITH_DEFAULTS`, you replace the default set and `@Sql` stops
doing anything at all. Nothing fails; the scripts simply never run, and every test that
depended on the fixture fails on an empty table.

The minimum the listener needs is stated in the reference:

> *"As a bare minimum, however, a `javax.sql.DataSource` must be present in the test's
> `ApplicationContext`."*

`spring-jdbc` and `spring-tx` must be on the classpath. In a Boot application they always
are the moment you have a `DataSource`.

## Three ways to say what to run, and the ordering rule between them

```java
@Sql("/db/test-schema.sql")                    // value(), alias for scripts()
@Sql(scripts = "/db/test-schema.sql")          // identical
@Sql(statements = "INSERT INTO account(id, balance) VALUES (1, 100)")
```

`value()` and `scripts()` are `@AliasFor` each other, so you may use one or the other and
**never both** — doing so is an annotation-configuration error, not a subtle bug, and it
fails at context bootstrap. `statements()` is orthogonal and may be combined:

```java
@Sql(
    scripts    = "/db/accounts.sql",
    statements = "UPDATE account SET balance = 0 WHERE id = 1")
void overdraftTest() { }
```

The order is fixed and documented on `statements()`:

> *"Statements declared via this attribute will be executed after statements loaded from
> resource `scripts()`. If you wish to have inlined statements executed before scripts,
> simply declare multiple instances of `@Sql` on the same class or method."*

So inlined statements always run **last within one `@Sql`**. To get the other order you
need two annotations, which is what [04b2](04b2-groups-and-merge-mode.md) is about.

`statements` earns its place in exactly one situation: the single line that makes *this*
test's row different from the shared fixture's, where extracting a whole file for one
`UPDATE` would hide the interesting value from the reader. It is a bad place for ten
inserts, because it is a `String[]` inside an annotation — no syntax highlighting, no
formatting, no way to paste it into a SQL client, and a compile error if you forget that
the closing quote and the comma are Java syntax rather than SQL.

## How a path is resolved — four different meanings for one string

This is where most "script not found" incidents start. The javadoc:

> *"Each path will be interpreted as a Spring `Resource`. A plain path — for example,
> `"schema.sql"` — will be treated as a classpath resource that is relative to the package
> in which the test class is defined. A path starting with a slash will be treated as an
> absolute classpath resource, for example: `"/org/example/schema.sql"`. A path which
> references a URL (for example, a path prefixed with `classpath:`, `file:`, `http:`,
> etc.) will be loaded using the specified resource protocol."*

| You write | It means |
|---|---|
| `"accounts.sql"` | `classpath:com/example/billing/accounts.sql` if the test class is in `com.example.billing` |
| `"/db/accounts.sql"` | `classpath:/db/accounts.sql` — absolute on the classpath |
| `"classpath:db/accounts.sql"` | absolute on the classpath, explicitly |
| `"file:src/test/resources/db/accounts.sql"` | a filesystem path, **relative to the JVM's working directory** |

The relative-to-the-package form is the one that surprises people, because it means
**moving a test class to a different package breaks its fixture**, and the compiler is
perfectly happy about it. The absolute form (`/db/…`) is the one to standardise on; the
relative form is worth it only when the script genuinely belongs to that one test class,
and then the default-detection convention below is usually better still.

Since Framework 6.2 there is a fifth meaning:

> *"As of Spring Framework 6.2, paths may contain property placeholders (`${…}`) that will
> be replaced by properties stored in the `Environment` of the test's `ApplicationContext`."*

That lets one annotation pick a dialect-specific script per profile —
`"/db/${db.vendor}/seed.sql"` — without a second test class. Note the qualifier: the
placeholder is resolved from the **test context's** `Environment`, so a value set only as a
raw JVM system property late in a `@BeforeAll` will not be seen; it has to be somewhere the
context's property sources reach, such as `@SpringBootTest(properties = …)`,
`@TestPropertySource`, or a `@DynamicPropertySource`.

## The default script nobody remembers exists

If you give `@Sql` no `scripts` and no `statements`, it does not do nothing. It looks for a
file named after the test:

> *"If no SQL scripts or `statements()` are specified, an attempt will be made to detect a
> default script depending on where this annotation is declared. If a default cannot be
> detected, an `IllegalStateException` will be thrown."*

> *"class-level declaration: if the annotated test class is `com.example.MyTest`, the
> corresponding default script is `"classpath:com/example/MyTest.sql"`."*

> *"method-level declaration: if the annotated test method is named `testMethod()` and is
> defined in the class `com.example.MyTest`, the corresponding default script is
> `"classpath:com/example/MyTest.testMethod.sql"`."*

```java
package com.example.billing;

@JdbcTest
@Sql                                    // → classpath:com/example/billing/AccountQueryTest.sql
class AccountQueryTest {

    @Test
    @Sql                                // → …/AccountQueryTest.overdrawnAccountsAreListed.sql
    void overdrawnAccountsAreListed() { }
}
```

with the files under `src/test/resources/com/example/billing/`. It is a tidy convention —
one fixture per test, named so that you cannot fail to find it — and it has a single sharp
edge: **the binding is by string, made at runtime.** Rename the method with the IDE's
refactor and the annotation still compiles, the file keeps its old name, and the next run
throws `IllegalStateException` because the default could not be detected. That is the good
case. The bad case is a *class* rename where a stale `MyTest.sql` from a previous name
still exists on the classpath: it does not fail, it just sits there until someone adds a
test class that happens to match the old name and inherits a fixture nobody knows about.

## Where this connects

- Execution phases and how they interleave with JUnit's lifecycle:
  [04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md).
- Repeatable `@Sql`, `@SqlGroup` and the merge-mode default:
  [04b2 · Groups and merge mode](04b2-groups-and-merge-mode.md).
- How the script is split into statements, comment and separator handling, and what happens
  when a script fails halfway: [04c · `@SqlConfig` and the parser](04c-sqlconfig-and-the-parser.md).
- Whether to write the fixture as SQL at all, versus inserting through the repository:
  [04d · SQL versus repository fixtures](04d-sql-versus-repository-fixtures.md).
- Which transaction a script runs in, and why an `AFTER_TEST_METHOD` cleanup script can
  vanish: [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- The same annotation seen from the container side, where the question is how to keep one
  shared PostgreSQL clean:
  [07 · Testcontainers → 06f](../07-testcontainers/06f-sql-scripts-and-unique-data.md).
- Migrations (Flyway/Liquibase) as the schema source rather than a hand-written
  `schema.sql`: [Phase 10 · Data access](../../phase-10-data-access/README.md).

## Gotchas

**★ A plain path is relative to the test class's package, not to `src/test/resources`.**
`@Sql("seed.sql")` on `com.example.billing.AccountTest` resolves to
`classpath:com/example/billing/seed.sql`. Everyone reads it as `/seed.sql`. Move a test
class between packages and its fixture disappears with no compiler error. Standardise on
leading-slash absolute paths, and reserve the relative form for the default-detection
convention where the coupling is the point.

**★ `@Sql` with no arguments is not a no-op — it binds to a filename derived from the
method name.**
Rename the method and the annotation still compiles while the file no longer matches; you
get an `IllegalStateException` about a default script that could not be detected, at
runtime, from a test whose new name appears nowhere in the error message. The convention is
good; just know that it makes the method name part of the build, and that no IDE refactor
follows it.

**★ Declaring `@TestExecutionListeners` without `MERGE_WITH_DEFAULTS` disables `@Sql`
entirely.**
`SqlScriptsTestExecutionListener` is in the default set, and an explicit
`@TestExecutionListeners` **replaces** the set rather than adding to it. Nothing warns you;
the scripts just never execute and the tests fail as if the data were never inserted.
Always write
`@TestExecutionListeners(value = MyListener.class, mergeMode = MERGE_WITH_DEFAULTS)`.

**★ `value` and `scripts` cannot both be set.**
They are `@AliasFor` aliases of one another. Setting both fails during annotation
resolution, not during the test — the failure arrives as a context bootstrap error naming
`AnnotationConfigurationException`, which does not obviously point at your `@Sql`. Pick one
form and use it consistently across the codebase.

**★ Inlined `statements` always run after the scripts in the same `@Sql`, never before.**
`@Sql(statements = "TRUNCATE account", scripts = "load.sql")` reads as "truncate, then
load" and does the opposite. The attribute order in the source is irrelevant; the
documented order is scripts first. Use two `@Sql` declarations when the order matters.

**★ A `file:` path is relative to the JVM's working directory, which is not the same in the
IDE, in Maven and in CI.**
IntelliJ commonly runs tests with the module directory as the working directory while
Maven uses the project basedir, so `file:src/test/resources/db/seed.sql` can work in one and
not the other in a multi-module build. There is no reason to use `file:` for a fixture that
lives in the project — use a classpath path and let the build put it on the classpath.

**★ The script Spring reads is the copy in `target/test-classes`, not the file you are
editing.**
Editing `src/test/resources/db/seed.sql` and re-running from an IDE that does not copy
resources on the fly gives you the old script with no indication that anything is stale.
If a fixture change appears to have had no effect, rebuild before you start debugging the
SQL.

**★ `${…}` in a path resolves from the test context's `Environment`, not from anything you
set later.**
The placeholder is expanded when the listener resolves the resource, using the
`ApplicationContext` of the test. A property set in a `@BeforeAll` via `System.setProperty`
after the context was built will not be visible, and the failure is an unresolvable
placeholder rather than a missing file. Set it through `@TestPropertySource`,
`@SpringBootTest(properties = …)` or `@DynamicPropertySource`.

## Interview questions

**★ What does `@Sql` actually do, and what is the minimum a context must contain for it to work?**
It is implemented by `SqlScriptsTestExecutionListener`, one of the TestContext framework's
default listeners, which executes SQL scripts or inlined statements around a test method or
test class. The minimum requirement is a `DataSource` bean in the test's
`ApplicationContext`, with `spring-jdbc` and `spring-tx` on the classpath. Notably it is
not tied to JPA or to any particular slice — it behaves the same in `@JdbcTest`,
`@DataJpaTest` and `@SpringBootTest`. Because it is a default listener, declaring your own
`@TestExecutionListeners` without `MERGE_WITH_DEFAULTS` silently switches it off, which is
worth knowing because the symptom is "my fixture data is missing", not "my annotation is
misconfigured".

**★ Where does Spring look for `@Sql("seed.sql")`?**
On the classpath, relative to the package of the test class. If the test is
`com.example.billing.AccountTest`, that is `classpath:com/example/billing/seed.sql`. A
leading slash makes it absolute on the classpath, and a `classpath:`, `file:` or `http:`
prefix selects the resource protocol explicitly. Since Framework 6.2 the path may also
contain `${…}` placeholders resolved from the test context's `Environment`. In practice I
use absolute classpath paths so that moving a test class cannot break its fixture.

**★ What happens if you put `@Sql` on a method and give it no arguments?**
Spring falls back to the default-script convention: for method `testMethod()` on
`com.example.MyTest` it looks for `classpath:com/example/MyTest.testMethod.sql`, and for a
class-level declaration `classpath:com/example/MyTest.sql`. If it cannot detect one it
throws `IllegalStateException`. It is a neat one-fixture-per-test convention, but it makes
the method name a build-time dependency — an IDE rename refactor updates the code and not
the file, and the failure surfaces at runtime.

**★ What is the difference between `scripts` and `statements`, and when would you use `statements`?**
`scripts` names external resources; `statements` holds inlined SQL strings in the
annotation itself. They can be combined, and within a single `@Sql` the scripts always run
first. I use `statements` for the one line that makes this test's data different from the
shared fixture — an `UPDATE` that sets the balance the assertion is about — because
extracting a whole file for one statement hides the interesting value from the reader.
Anything longer goes in a file, where it can be formatted, highlighted and run in a client.

**★ Would you use `@Sql` or Flyway/Liquibase to create the schema for a repository test?**
Migrations, for the schema. The whole point of a repository test on a real engine is that
it exercises the schema you deploy, and a hand-maintained `schema.sql` in the test tree
diverges from the migrations the moment someone adds a column — after which the test suite
is validating a schema that does not exist anywhere else. `@Sql` is for the *data*: the
rows this test needs, on top of a schema that came from the same migrations production
uses. The exception is a deliberately narrow `@JdbcTest` over two tables where running the
full migration set costs more than it is worth, and then the divergence risk is a conscious
trade rather than an accident.

**★ Your fixture script edits appear to have no effect and the old data keeps coming back. What do you check?**
First, whether the script on the classpath is stale — Spring reads the copy in
`target/test-classes`, so an IDE run configuration that does not rebuild resources serves
the previous version. Second, whether a method-level `@Sql` is overriding the class-level
declaration you edited, which is the default merge behaviour. Third, whether a custom
`@TestExecutionListeners` declaration has removed `SqlScriptsTestExecutionListener` from
the set. Fourth, whether the data you are seeing is left over from an earlier test rather
than inserted by the script at all, which turns it into a cleanup problem rather than a
fixture problem.

{/* FOOTER */}
