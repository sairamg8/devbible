---
title: "Emptying the tables between tests is the strategy that lets a test commit, and it costs three things nobody budgets for: foreign-key ordering, a table list that goes stale on the next migration, and the fact that RESTART IDENTITY CASCADE will happily reach tables you never named"
sidebar_label: "05a3 · Truncating and deleting"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html))
> and the javadoc for
> [`SqlConfig.TransactionMode`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.TransactionMode.html)
> — the transaction-mode inference rules below are quoted from it. `TRUNCATE` semantics are
> PostgreSQL's, not Spring's.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No database, no Docker and no sandbox on this machine** — SQL, Java source and
> documented behaviour only, never a test run or a timing.

**If the rollback strategy's problem is that nothing commits, the fix is to let the test
commit and empty the tables instead. That buys back everything on the list in
[05a2](05a2-what-rollback-breaks.md) — commit-time constraints, `AFTER_COMMIT` listeners,
visibility from another connection — and it introduces three costs that are easy to
underestimate: foreign keys make deletion order matter, the list of tables goes stale
silently, and the `@Sql` script you write to do the cleaning is, by default, rolled back
along with the test it was supposed to clean up after.**

## The clean-up script that does nothing: `transactionMode`

Start here, because it is the trap that wastes the most time. Write this:

```java
@DataJpaTest
@Sql(scripts = "/db/clean.sql", executionPhase = AFTER_TEST_METHOD)   // 🔴 does nothing
class LedgerTest { }
```

and the script runs, the deletes execute, and the whole thing is rolled back with the
test's transaction. The database is exactly as dirty as before — except it was never dirty,
because the test was rolled back too, so the script was pointless in both directions.

The mechanism is `transactionMode`, which defaults to `DEFAULT`, which means `INFERRED`.
The inference rules, verbatim:

> 1. *"If neither a transaction manager nor a data source is available, an exception will be
>    thrown."*
> 2. *"If a transaction manager is not available but a data source is available, SQL scripts
>    will be executed directly against the data source without a transaction."*
> 3. *"If a transaction manager is available: … Using the resolved transaction manager and
>    data source, SQL scripts will be executed within an existing transaction if present;
>    otherwise, scripts will be executed in a new transaction that will be immediately
>    committed. An existing transaction will typically be managed by the
>    `TransactionalTestExecutionListener`."*

Rule 3 is the one that bites: in a `@DataJpaTest` there **is** an existing transaction, so
the script joins it and dies with it. `ISOLATED` is the opt-out:

> **`ISOLATED`** — *"Indicates that SQL scripts should always be executed in a new, isolated
> transaction that will be immediately committed. In contrast to `INFERRED`, this mode
> requires the presence of a transaction manager **and** a data source."*

```java
@Sql(scripts        = "/db/clean.sql",
     executionPhase = AFTER_TEST_METHOD,
     config         = @SqlConfig(transactionMode = ISOLATED))   // ✅ survives the rollback
```

Read rule 2 as well, because it is the other half of the surprise: **with no transaction
manager available, scripts run with no transaction and everything they do is committed.**
So the same annotation behaves completely differently in a `@JdbcTest` with a transaction
manager and in a bare context without one, and neither says so.

## Truncate before, not after

Cleanup written as teardown does not run when the process dies, when a test is killed by a
timeout, or when someone stops the run in an IDE. Cleanup written as *setup* always runs,
because the next test cannot start without it.

```java
@BeforeEach
void clean() {
    JdbcTestUtils.deleteFromTables(jdbcTemplate, "posting", "account");
}
```

There is a second, better reason: after a failure you want the database as the failing test
left it, so you can look at it. Teardown-based cleanup destroys the evidence at exactly the
moment it becomes valuable.

The cost is that the last test of the run leaves data behind. That is the right trade — it
is one dirty database at the end, not a broken premise in the middle.

## `TRUNCATE` versus `DELETE`, and what `CASCADE` really does

`TRUNCATE` is not "a fast `DELETE`"; it is a different statement with different semantics:

- it does not fire row-level triggers that `DELETE` fires;
- it does not produce per-row work, so it is dramatically cheaper on a large table and
  roughly comparable on an empty one;
- it takes an `ACCESS EXCLUSIVE` lock on each table, which matters if tests run in parallel
  against the same database;
- it **fails** on any table referenced by a foreign key from a table not in the same
  statement, unless you say `CASCADE`.

That last point is the one to internalise:

```sql
TRUNCATE account;                        -- ERROR if posting references account
TRUNCATE account, posting;               -- fine: both named in one statement
TRUNCATE account CASCADE;                -- 🔴 also truncates posting — and anything
                                         --    referencing posting, transitively
```

`CASCADE` on `TRUNCATE` does not mean "delete the child rows" the way `ON DELETE CASCADE`
does on a foreign key. It means **"also truncate every table that references this one,
recursively"**. It will happily empty a reference table you never intended to touch, and it
will do so silently. Naming every table in one `TRUNCATE` is the version you can review;
`CASCADE` is the version that surprises you a year later when someone adds a foreign key.

`RESTART IDENTITY` is the other half:

```sql
TRUNCATE account, posting RESTART IDENTITY;
```

Without it the tables are empty and the sequences keep climbing. With it, ids restart —
which makes `assertThat(id).isEqualTo(1L)` pass, and thereby encourages exactly the
assertion that [04d2](04d2-the-columns-sql-has-to-fill.md) argues against. Use
`RESTART IDENTITY` because you want a deterministic starting point, not because you want to
assert on ids.

`DELETE FROM` remains the right choice in two cases: when you need row triggers to fire,
and when you can only delete part of a table — a shared reference dataset that must survive
while transactional data is cleared.

## Do not maintain the table list by hand

A hardcoded list of tables is wrong from the next migration onwards, and the failure is
silent: the new table is simply never cleaned, and the tests that depend on it become
order-dependent. Ask the database instead:

```java
List<String> tables = jdbcTemplate.queryForList("""
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename <> 'flyway_schema_history'
        """, String.class);

jdbcTemplate.execute("TRUNCATE TABLE " + String.join(", ", tables) + " RESTART IDENTITY");
```

🔴 **Never truncate the migration history table.** `flyway_schema_history` (or
`DATABASECHANGELOG` for Liquibase) is how the tool knows the schema is already at version N.
Empty it and the next context that starts will try to re-apply every migration against a
database that already has the objects, and the failure — a duplicate object error during
context startup — looks nothing like a cleanup bug. Exclude it explicitly, by name, in the
query.

The same exclusion list usually needs any reference table that migrations seed and nothing
writes to: currencies, country codes, permission types. Truncating those means every test
after the first runs against an empty reference table.

## Where this connects

- Why you would give up the rollback strategy in the first place:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- The strategy above this one in cost, and the decision rule:
  [05a4 · A fresh schema per class](05a4-a-fresh-schema-per-class.md).
- `@Sql` execution phases, which decide when a cleanup script runs:
  [04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md).
- The rest of `@SqlConfig`: [04c · `@SqlConfig` and the parser](04c-sqlconfig-and-the-parser.md).
- The container-specific version of this argument, including reuse and the history table:
  [07 · Testcontainers → 06e](../07-testcontainers/06e-truncating-between-tests.md).

## Gotchas

**★ A cleanup `@Sql` script inside a transactional test class is rolled back with the test.**
`transactionMode` defaults to `INFERRED`, and the inference joins an existing test-managed
transaction. The script runs, the deletes happen, and the transaction takes them back.
`config = @SqlConfig(transactionMode = ISOLATED)` is the fix, and it requires both a
transaction manager and a data source to be available.

**★ With no transaction manager available, `@Sql` scripts run with no transaction at all and
everything they do is committed.**
That is inference rule 2, and it means the same annotation has opposite persistence
behaviour in two contexts that look identical from the test class. Adding or removing a
transaction manager from a test context silently changes what your fixtures leave behind.

**★ `TRUNCATE` without `CASCADE` fails on any table with an inbound foreign key.**
The error names a constraint rather than the missing table, so the fix is not obvious. Name
every table in one `TRUNCATE` statement instead — PostgreSQL truncates them together and
the ordering problem disappears.

**★ `TRUNCATE … CASCADE` truncates tables you did not name, transitively.**
It is not the foreign key's `ON DELETE CASCADE`. It empties every table referencing the one
you named, and every table referencing those. A reference table that acquires an inbound
foreign key in a later migration gets silently wiped from then on.

**★ `TRUNCATE` without `RESTART IDENTITY` empties the tables and leaves the sequences
climbing.**
Which is usually fine, and is a surprise for anyone who assumed "clean" means "as if
new". If a test asserts anything about generated ids, it will pass on the first run only.

**★ Cleaning up in `@AfterEach` leaves the database dirty whenever anything goes wrong.**
A crash, a preemptive timeout, or stopping the run in the IDE all skip teardown. Cleaning in
`@BeforeEach` always runs, and has the extra benefit of preserving the failing test's data
for inspection.

**★ A hardcoded table list is wrong from the next migration onwards, silently.**
The new table is never cleaned, so the tests that use it start depending on order. Query
`pg_tables` — or the equivalent — and exclude by name the few tables that must survive.

**★ Truncating the migration history table breaks every later context on that database.**
Flyway or Liquibase will attempt to re-apply every migration against a schema that already
has the objects, and the failure appears during context startup, far away from the cleanup
code that caused it.

**★ Truncating migration-seeded reference data leaves every test after the first with an
empty lookup table.**
The first test in the run passes and the rest fail on missing currencies or missing
permission types, which reads like a fixture bug in the second test.

**★ `TRUNCATE` takes an exclusive lock, so it does not coexist with parallel tests on one
database.**
Two classes truncating the same tables concurrently will serialise at best and destroy each
other's fixtures at worst. Parallelism plus a shared database means schema-per-thread, not
truncation — see [05a4](05a4-a-fresh-schema-per-class.md).

## Interview questions

**★ Your `@Sql` cleanup script runs and the data is still there. What did you miss?**
That the script joined the test's transaction and was rolled back with it. `@Sql`'s
`transactionMode` defaults to `INFERRED`, and the documented inference is that when a
transaction manager is available the script runs *within an existing transaction if
present* — which in any `@DataJpaTest`, `@JdbcTest` or `@Transactional` class it is. The fix
is `config = @SqlConfig(transactionMode = ISOLATED)`, which runs the script in a new
transaction that commits immediately. The same rules explain the opposite surprise: with no
transaction manager at all, scripts run outside any transaction and everything they do is
committed.

**★ Why `TRUNCATE` rather than `DELETE FROM`?**
Because it does not do per-row work, so it stays fast as tables grow, and because it can
reset identity columns with `RESTART IDENTITY`. The trade-offs are that it does not fire
row-level triggers, it takes an exclusive lock on each table, and it refuses to run on a
table with an inbound foreign key unless every referencing table is named in the same
statement or you use `CASCADE`. `DELETE FROM` is still right when triggers matter, or when
you need to clear transactional data while leaving seeded reference rows in place.

**★ What do `RESTART IDENTITY` and `CASCADE` do on `TRUNCATE`, and which one would you avoid?**
`RESTART IDENTITY` resets the sequences backing identity columns, so ids start from the
beginning again — without it the tables are empty and the counters keep climbing. `CASCADE`
means "also truncate every table that has a foreign key referencing this one, recursively",
which is not the same as `ON DELETE CASCADE` and is far broader than most people expect. I
avoid `CASCADE`: naming every table in a single `TRUNCATE` statement achieves the same
result, is reviewable, and cannot silently start emptying a reference table when a later
migration adds a foreign key.

**★ Why clean up before a test rather than after it?**
Because teardown does not run when things go wrong — a crash, a preemptive timeout, or
someone stopping the run — while setup always runs, since the next test cannot start
otherwise. And after a failure you want the database in the state the failing test left it,
so you can inspect it; teardown-based cleanup destroys exactly the evidence you need. The
price is that the last test of a run leaves its data behind, which is a much smaller problem
than a broken premise in the middle of a suite.

**★ Which table must you never truncate, and why?**
The migration tool's history table — `flyway_schema_history` or `DATABASECHANGELOG`. It is
how the tool knows the schema is already at a given version. Emptying it makes the next
context that boots attempt every migration again against a database that already has the
objects, and the resulting duplicate-object failure happens during context startup, nowhere
near the cleanup code. The same caution applies to any reference data the migrations seed
and no test writes: truncating it makes every test after the first fail on missing lookups.

**★ How would you build the table list for truncation?**
From the database, not from a constant. A query against `pg_tables` filtered to the schema
under test, with an explicit exclusion list for the migration history table and any seeded
reference tables. A hardcoded list is correct on the day it is written and silently wrong
from the next migration onwards — the new table simply never gets cleaned, and the tests
that use it quietly become order-dependent, which is the hardest class of failure to
diagnose.

{/* FOOTER */}
