---
title: "The general answer to a shared container is one statement run before every test — TRUNCATE over a table list the database itself gives you, RESTART IDENTITY CASCADE, and never the migration-history table — and it works precisely because it lets the commit happen"
sidebar_label: "06e · Truncating between tests"
sidebar_position: 43
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against Spring Framework 7.0's **Executing SQL scripts** testing reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> the `@SqlConfig` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.html)),
> and PostgreSQL 18's `TRUNCATE` and `information_schema` documentation
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-truncate.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Testcontainers 2.0.5, JUnit Jupiter 6.0.3, Flyway 12.4.0.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[06d](06d-the-rollback-strategy.md) made the case against buying isolation by never committing.
This chunk is what you use instead. All three of these strategies let the transaction commit — so
`AFTER` triggers fire, deferred constraints are checked, `AFTER_COMMIT` listeners run and a second
connection can see the row — and they differ only in *how* the next test gets back to a known
state. **This chunk is truncation, the general answer.**
[06f](06f-sql-scripts-and-unique-data.md) is the other two — `@Sql`, the declarative one, and
unique-data-per-test, which needs no cleanup at all and is badly underrated.**


## B · Truncate between tests

One statement resets everything, and the two modifiers are the whole trick:

```sql
TRUNCATE TABLE orders, order_lines, customers RESTART IDENTITY CASCADE;
```

- **`RESTART IDENTITY`** resets the owned sequences too. Without it, the tables are empty but ids
  keep climbing — which is fine, and is in fact what you want if any test asserts on a specific id,
  because such a test is broken anyway ([06c](06c-keeping-tests-independent.md)). Use it when you
  want runs to be reproducible, leave it off when you want id assumptions to fail loudly.
- **`CASCADE`** truncates tables with foreign keys onto the ones you named. Without it, PostgreSQL
  refuses rather than leaving dangling references — which is a useful error the first time and an
  obstacle every time after.

`TRUNCATE` is not `DELETE FROM`. It does not scan the table, it does not fire row-level `DELETE`
triggers, and it takes an `ACCESS EXCLUSIVE` lock — all three of which are what you want between
tests and none of which are what you want in production code. It is also transactional in
PostgreSQL, so it can be rolled back, which matters if you put it somewhere unexpected.

### 🔴 Do it before the test, not after

```java
@BeforeEach
void reset() {
    jdbc.execute("TRUNCATE TABLE orders, order_lines, customers RESTART IDENTITY CASCADE");
}
```

Cleaning up *before* rather than *after* is worth arguing for explicitly. An `@AfterEach` cleanup
does not run when the JVM dies, does not run when a `@BeforeEach` threw, and — if the class is
`@Transactional` — does not run at all in any meaningful sense, because it happens inside the
transaction that is about to be discarded ([06d](06d-the-rollback-strategy.md)). Cleaning before
means a test always starts from a known state regardless of what the previous one did or how it
ended, and it leaves the last test's data on the container for you to inspect when something fails.

### Do not maintain the table list by hand

The list above is wrong the day somebody adds a table. Ask the database instead:

```java
private static final String TABLES = """
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type   = 'BASE TABLE'
       AND table_name  <> 'flyway_schema_history'
    """;

@BeforeEach
void reset() {
    List<String> tables = jdbc.queryForList(TABLES, String.class);
    if (tables.isEmpty()) return;
    jdbc.execute("TRUNCATE TABLE " + String.join(", ", tables) + " RESTART IDENTITY CASCADE");
}
```

🔴 **Excluding `flyway_schema_history` is not optional.** Truncate it and Flyway will re-run every
migration on the next context that touches this container, or — worse, under
`validate` — decide the schema is unmanaged. The same applies to Liquibase's `DATABASECHANGELOG`
and `DATABASECHANGELOGLOCK`, and to any table your application treats as reference data loaded by a
migration. **Anything a migration created and filled is schema, not test data.**

Cache the list in a `static` field if you like, but be aware you have then coupled it to the first
context that ran — a suite whose classes use different schemas will get the wrong list. Querying
per class is the safe default.

## Where this continues

[06f · `@Sql` scripts and unique data](06f-sql-scripts-and-unique-data.md) covers the declarative
alternative — `@Sql`'s four execution phases, the `transactionMode = ISOLATED` attribute that
decides whether a cleanup script survives at all, and `@SqlConfig`'s full surface — then the
strategy that needs no cleanup, and a decision rule across all four.

## Gotchas

**★ Truncating `flyway_schema_history` breaks every later context on that container.**
Flyway will either re-run every migration or refuse to validate. It is schema, not data — exclude
it, along with Liquibase's `DATABASECHANGELOG` and `DATABASECHANGELOGLOCK`, from any generated
table list.

**★ `TRUNCATE` without `CASCADE` fails on any table with an inbound foreign key.**
PostgreSQL refuses rather than leaving dangling references. `CASCADE` truncates the referencing
tables too — which is what you want between tests and is a genuinely dangerous habit to carry into
production code.

**★ `TRUNCATE` without `RESTART IDENTITY` empties the tables but keeps the sequences climbing.**
Usually harmless, and occasionally the point: a test that assumed `id == 1` will keep failing
instead of passing on a lucky run.

**★ Cleaning up in `@AfterEach` leaves the database dirty whenever anything goes wrong.**
It does not run if `@BeforeEach` threw, it does not run if the JVM died, and inside a transactional
class it does not survive at all. Clean before the test, not after — and you get the failing test's
data left on the container to inspect.

**★ A hardcoded table list is wrong from the next migration onwards.**
Query `information_schema.tables` for `table_schema = 'public'` and `table_type = 'BASE TABLE'`
instead. Caching that list in a `static` couples it to whichever context ran first.

**★ Truncation between every method is the strategy people abandon for the wrong reason.**
It commits, which is the point; the objection is usually a vague performance one. If a test class
genuinely does not need the commit path, the rollback strategy is the right optimisation — but say
that, rather than switching everything to `@Transactional` and quietly losing the commit-path
coverage described in [06d](06d-the-rollback-strategy.md).

## Interview questions

**★ How do you reset a shared Testcontainers database between tests without giving up the commit
path?**
Truncate before each test — `TRUNCATE TABLE … RESTART IDENTITY CASCADE` over a table list queried
from `information_schema`, excluding the migration-history tables — or declare the cleanup with
`@Sql(executionPhase = AFTER_TEST_METHOD, config = @SqlConfig(transactionMode = ISOLATED))`, or
avoid the problem by giving each test data nothing else can match.

**★ What do `RESTART IDENTITY` and `CASCADE` do on `TRUNCATE`?**
`RESTART IDENTITY` resets the sequences owned by the truncated tables, so ids start again.
`CASCADE` also truncates any table with a foreign key referencing the ones you named; without it,
PostgreSQL refuses rather than leaving dangling references.

**★ Why `TRUNCATE` rather than `DELETE FROM`?**
It does not scan the table, does not fire row-level `DELETE` triggers, resets sequences in the same
statement, and takes a single `ACCESS EXCLUSIVE` lock. It is still transactional in PostgreSQL, so
it can be rolled back — which matters if you put it inside a transactional test by accident.

**★ Which table must you never truncate, and why?**
`flyway_schema_history` — or Liquibase's `DATABASECHANGELOG` and `DATABASECHANGELOGLOCK`. It is part
of the schema's identity, not test data. Truncate it and the next context on that container either
re-runs every migration or fails validation.

**★ Why clean up before a test rather than after it?**
Because "after" does not run when the test process dies, does not run when setup threw, and in a
transactional class does not survive the rollback. Cleaning first makes every test start from a
known state whatever the previous one did, and leaves the failing test's data on the container for
you to look at.

**★ You inherit a suite where some classes are `@Transactional` and some truncate. What is the
problem?**
Whether a given test sees a clean database depends on which class ran before it, and JUnit is free
to change that order. The strategy has to be a per-class decision that is visible in the class, not
an accident of who wrote it.

{/* FOOTER */}

{/* FOOTER */}
