---
title: "@Sql runs fixture and cleanup scripts around a test without any plumbing, and exactly one of its ten configuration attributes decides whether the cleanup survives the test's own transaction — and the fourth strategy, giving every test data nothing else can match, needs no cleanup at all"
sidebar_label: "06f · @Sql scripts and unique data"
sidebar_position: 44
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against Spring Framework 7.0's **Executing SQL scripts** testing reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html))
> and the `@SqlConfig` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.html)),
> from which the attribute table and the `ISOLATED` sentence are taken verbatim.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[06e](06e-truncating-between-tests.md) covered truncation, the general answer. These are the
other two strategies that let the commit happen: `@Sql`, which declares the fixture and the cleanup
next to the test, and unique-data-per-test, which sidesteps cleanup entirely. The page closes with
a decision rule across all four — because the real failure is not picking the wrong strategy, it is
picking different ones inside one test class and making execution order matter.**

## C · `@Sql` — the declarative option

Spring runs SQL scripts around test methods and classes without any of the above plumbing:

```java
@Test
@Sql("/test-schema.sql")
void userTest() {
    // run code that uses the test schema
}
```

### The four execution phases

`executionPhase` decides when the script runs:

| Constant | When |
|---|---|
| `BEFORE_TEST_METHOD` | before the test method — **the default** |
| `AFTER_TEST_METHOD` | after the test method |
| `BEFORE_TEST_CLASS` | once, before the class — **Spring 6.1+** |
| `AFTER_TEST_CLASS` | once, after the class — **Spring 6.1+** |

```java
@Sql(scripts = "delete-test-data.sql", executionPhase = AFTER_TEST_METHOD)
```

The two class-level phases are the ones worth knowing about on a Testcontainers test, because they
give you "seed this once for the class, tear it down once at the end" without a static field and
without `@BeforeAll` ordering questions. They are recent enough that plenty of material predates
them.

### 🔴 `transactionMode = ISOLATED` — the attribute that decides whether cleanup survives

`@SqlConfig` carries ten attributes:

| Attribute | Type | Default |
|---|---|---|
| `dataSource` | `String` | `""` |
| `transactionManager` | `String` | `""` |
| `transactionMode` | `TransactionMode` | `DEFAULT` |
| `encoding` | `String` | `""` |
| `separator` | `String` | `""` |
| `commentPrefix` | `String` | `""` |
| `commentPrefixes` | `String[]` | `{}` |
| `blockCommentStartDelimiter` | `String` | `""` |
| `blockCommentEndDelimiter` | `String` | `""` |
| `errorMode` | `ErrorMode` | `DEFAULT` |

By default the listener *infers* transaction semantics from the `transactionMode` attribute and
whether a `PlatformTransactionManager` is present — which, in a `@Transactional` test class, means
your script joins the test's transaction and is **rolled back with it**. That is the correct
behaviour for a seeding script and completely wrong for a cleanup one. `ISOLATED` is the fix:

> *"ensure that the SQL scripts are executed in a new, isolated transaction that will be immediately
> committed"*

```java
@Sql(scripts = "/cleanup.sql",
     executionPhase = AFTER_TEST_METHOD,
     config = @SqlConfig(transactionMode = ISOLATED))
```

`errorMode` takes `DEFAULT`, `CONTINUE_ON_ERROR`, `IGNORE_FAILED_DROPS` and `FAIL_ON_ERROR` — the
third is the one that makes a `DROP TABLE IF NOT EXISTS`-style teardown script tolerable on engines
that lack the syntax.

`commentPrefix`, `commentPrefixes`, `separator` and the block-comment delimiters exist because
Spring parses the script itself rather than handing it to the engine. That is why a script with
`$$ … $$` function bodies, a `DELIMITER` directive, or `#` comments can fail here while running
fine in `psql` — the parser is not the database's.

```java
@Sql(scripts = "/test-schema.sql", config = @SqlConfig(commentPrefix = "`"))
```

### Grouping and merging

`@SqlGroup` exists to declare several `@Sql` blocks where the language will not allow repeated
annotations:

```java
@SqlGroup({
    @Sql(scripts = "/test-schema.sql", config = @SqlConfig(commentPrefix = "`")),
    @Sql("/test-user-data.sql")
})
```

`@SqlMergeMode` decides what happens when a method-level `@Sql` meets a class-level one —
`@SqlMergeMode(MERGE)` runs both, `@SqlMergeMode(OVERRIDE)` runs only the method's. ⚠️ **Override is
the historical default**, which is the trap: adding one method-level `@Sql` to a class that already
had a class-level one silently stops the class-level script from running for that method, and the
symptom is a missing fixture in exactly one test.

### The convention nobody remembers

`@Sql` with no scripts named falls back to a naming convention:

- class level, for `com.example.MyTest` → `classpath:com/example/MyTest.sql`
- method level, for `testMethod()` in `com.example.MyTest` →
  `classpath:com/example/MyTest.testMethod.sql`

Convenient, and a good way to be confused when a rename quietly detaches a test from its fixture.

### When you need it programmatically

```java
ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
populator.addScripts(
    new ClassPathResource("test-schema.sql"),
    new ClassPathResource("test-data.sql"));
populator.setSeparator("@@");
populator.execute(this.dataSource);
```

`ScriptUtils` is the static equivalent. Both are the right answer inside a `@BeforeAll`, inside a
custom extension, or anywhere the annotation cannot reach.

### Seeing what actually ran

Two logging categories, and they answer different questions:

- `org.springframework.test.context.jdbc` at `DEBUG` — **which scripts** were executed
- `org.springframework.jdbc.datasource.init` at `DEBUG` — **which statements** within them

The first is what you turn on when a fixture is missing; the second when a script half-applied.

## D · Unique data per test — no cleanup at all

The cheapest correct strategy, and the one most teams never consider: if every test writes rows
nothing else can match, it does not matter what is left behind.

```java
private String uniqueEmail() {
    return "u-" + UUID.randomUUID() + "@example.test";
}

@Test
void registersACustomer() {
    String email = uniqueEmail();
    customers.register(email, "Alice");
    assertThat(customers.findByEmail(email)).isPresent();     // scoped to this test's own data
}
```

It commits, so the real code path runs. It needs no truncation, no scripts and no shared fixture.
It parallelises trivially, because two tests cannot collide on data neither can generate.

**It fails on exactly one shape of assertion: a global one.** `count()`, "the newest order",
"the only pending invoice", `findAll()` — all of these depend on the table containing nothing else,
and none of them can be made unique. When you find yourself asserting on a total, either scope the
query (count *this customer's* orders) or accept that this test class needs truncation. Mixing is
fine at the class level; it is mixing *within* a class that produces order-dependent tests.

## Choosing

- The test asserts on **commit-time behaviour** — triggers, deferred constraints, `AFTER_COMMIT`
  listeners, another connection's view: **you cannot roll back.** B, C or D.
- The test asserts on a **total, a count or a sort over the whole table**: **B**, [truncation](06e-truncating-between-tests.md).
- The class needs **one elaborate fixture** and every test reads it: **C**, `@Sql` at
  `BEFORE_TEST_CLASS`, with truncation at `AFTER_TEST_CLASS`.
- The test writes its own data and asserts on **its own data**: **D**, and write nothing else.
- The test is a **pure repository query test** that does not care about the commit path at all: the
  rollback strategy in [06d](06d-the-rollback-strategy.md) is legitimate and is the fastest.

🔴 Choose per test class, and make the choice visible. A suite where the strategy varies invisibly
by class is a suite where test order silently matters.


## Gotchas

**★ A cleanup `@Sql` script inside a `@Transactional` test class is rolled back with the test.**
By default the script joins the test's transaction. `@SqlConfig(transactionMode = ISOLATED)` runs it
*"in a new, isolated transaction that will be immediately committed"*, which is the only way a
cleanup script survives.

**★ `@SqlMergeMode` defaults to override, so one method-level `@Sql` silently disables the
class-level one.**
The fixture goes missing in exactly one test and nothing explains why. Declare
`@SqlMergeMode(MERGE)` on the class if you intend both to run.

**★ Spring parses the SQL script itself, so valid SQL can still fail.**
`$$ … $$` bodies, `DELIMITER` directives and non-standard comment markers are parser problems, not
database problems — which is why `separator`, `commentPrefix`, `commentPrefixes` and the block
comment delimiters exist on `@SqlConfig`.

**★ `@Sql`'s default-script convention detaches silently on a rename.**
`MyTest.sql` and `MyTest.testMethod.sql` are matched by name. Rename the class or the method and the
fixture is simply not found; nothing reports that a convention stopped matching.

**★ `BEFORE_TEST_CLASS` and `AFTER_TEST_CLASS` only exist from Spring 6.1.**
Any pattern you find that works around their absence with static state and `@BeforeAll` is solving
a problem that no longer exists on this stack.

**★ Unique-data-per-test breaks the moment somebody asserts on a count.**
`findAll()`, `count()` and "the most recent row" all assume the table holds only what this test put
there. Scope the query or move that class to truncation — do not mix the two inside one class.

## Interview questions

**★ Your `@Sql` cleanup script runs and the data is still there. What did you miss?**
`transactionMode`. By default the script joins the test's transaction and is rolled back with it.
`ISOLATED` runs it *"in a new, isolated transaction that will be immediately committed"*.

**★ What are `@Sql`'s execution phases?**
`BEFORE_TEST_METHOD` (the default), `AFTER_TEST_METHOD`, and — from Spring 6.1 —
`BEFORE_TEST_CLASS` and `AFTER_TEST_CLASS`, which give you class-scoped seeding and teardown without
static fields.

**★ What is `@SqlMergeMode` for and what is the trap?**
It controls whether a method-level `@Sql` merges with a class-level one. Override is the historical
default, so adding a method-level script silently disables the class-level one for that method —
and the only symptom is one test missing its fixture.

**★ A script runs fine in `psql` and fails under `@Sql`. Why?**
Because Spring parses the script itself rather than handing it to the engine, so statement
separators, comment markers and `$$`-quoted bodies are its problem to get right. `separator`,
`commentPrefix`, `commentPrefixes` and the block-comment delimiters on `@SqlConfig` exist for
exactly this.

**★ When is "give every test unique data" the best strategy?**
When each test asserts only on the rows it created. It commits, so the real path runs; it needs no
cleanup; and it parallelises trivially. It fails only on global assertions — counts, `findAll()`,
"the newest row" — where the table's total contents are the thing under test.

**★ How would you find out which fixture scripts actually ran?**
Set `org.springframework.test.context.jdbc` to `DEBUG` to see which scripts were executed, and
`org.springframework.jdbc.datasource.init` to `DEBUG` to see the individual statements.

{/* FOOTER */}
