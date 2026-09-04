---
title: "`PREPARE` parses, analyzes and rewrites without executing — so preparing every statement against the migrated schema is a rename check for the whole repository layer"
sidebar_label: "12i · The parse test"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual — *PREPARE*, *Additional `jsonb`
> Operators* and *PostgreSQL Error Codes*
> ([sql-prepare](https://www.postgresql.org/docs/18/sql-prepare.html),
> [functions-json](https://www.postgresql.org/docs/18/functions-json.html),
> [errcodes-appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html))
> and the `NamedParameterUtils` javadoc
> ([.../jdbc/core/namedparam/NamedParameterUtils.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/namedparam/NamedParameterUtils.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18.

**Two tests are still missing after [chunk 12h](12h-what-to-assert.md), and both are
cheap. One asks whether the queries nobody called still parse against today's schema —
which is where migrations and tests finally meet. The other asks whether the exception
hierarchy you catch by type really produces that type. Neither is written in most
codebases, and the first one has no equivalent anywhere else in this style.**

## The verification test nobody writes

Every query in the repository layer is a string that names tables and columns, and
nothing checks those names until the query runs. A test suite covers the queries it
calls; the rest are checked by production traffic.

PostgreSQL will check all of them, for free, in one statement each. From the `PREPARE`
documentation:

> "When the `PREPARE` statement is executed, the specified statement is parsed,
> analyzed, and rewritten. When an `EXECUTE` command is subsequently issued, the
> prepared statement is planned and executed."

**Parsed, analyzed and rewritten** — that includes resolving every table and column
against the catalog. Preparing without executing therefore validates a query's names
and types against the live schema and touches no data.

```java
@JdbcTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
class EveryStatementParsesTests {

    @Autowired JdbcClient db;

    @ParameterizedTest(name = "{0}")
    @MethodSource("everyStatement")
    void parsesAgainstTheCurrentSchema(String name, String namedSql) {
        db.sql("prepare parse_check as " + toPositional(namedSql)).update();
        db.sql("deallocate parse_check").update();
    }

    static Stream<Arguments> everyStatement() throws IOException {
        // walk src/main/resources/sql/**.sql, or read the static String
        // fields of each repository class reflectively — see chunk 12c
        …
    }

    private static String toPositional(String namedSql) {
        ParsedSql parsed = NamedParameterUtils.parseSqlStatement(namedSql);
        var nulls = new MapSqlParameterSource();
        parsed.getParameterNames().forEach(n -> nulls.addValue(n, null));
        String jdbcSql = NamedParameterUtils.substituteNamedParameters(parsed, nulls);

        var out = new StringBuilder(jdbcSql.length() + 8);
        int index = 1;
        for (int i = 0; i < jdbcSql.length(); i++) {
            char c = jdbcSql.charAt(i);
            if (c == '?') out.append('$').append(index++);
            else out.append(c);
        }
        return out.toString();
    }
}
```

`NamedParameterUtils` is public API — `parseSqlStatement(String)` "parse[s] the SQL
statement and locate[s] any placeholders or named parameters", and
`substituteNamedParameters` produces the JDBC `?` form. The second loop converts those
to PostgreSQL's `$1`, `$2` form, which is what `PREPARE` requires.

**This is where migrations meet tests.** The schema the statements are prepared against
is the one the migrations just built, so a migration that renames a column and a query
that still uses the old name fail in the same test run, in the same build, before
either reaches an environment. That link does not exist any other way in a SQL-first
codebase — and it only works because the SQL is reachable as data
([chunk 12c](12c-where-the-sql-lives.md)).

### What `PREPARE` does not check

Be precise about the guarantee, because it is easy to oversell.

- **It does not plan the query.** Planning happens at `EXECUTE`, so nothing here says
  the query is fast, or that an index is used.
- **Parameter types are inferred, and inference can fail.** The manual: "When a
  parameter's data type is not specified or is declared as `unknown`, the type is
  inferred from the context in which the parameter is first referenced (if possible)."
  `where id = :id` against a `bigint` column infers cleanly; `coalesce(:a, :b)` may not,
  and the statement fails with a could-not-determine-data-type error that is about the
  test rather than about the query. The fix is the typed form —
  `prepare parse_check (bigint, text) as …` — which means those few statements need a
  declared type list or an exclusion.
- **It does not check the results map.** A column that exists but is now `text` where
  the record component is `long` prepares fine and fails at runtime.
- **It runs no rows through anything**, so nothing about the data is asserted.

It catches missing tables, missing columns, misspelt names, arity errors and type
errors in expressions — which is the entire class of failure that a rename introduces,
and the class that has no compile-time check at all in this style.

## Testing the exception translation

[Chunk 6](06-the-exception-hierarchy.md) argued that the hierarchy is the real product
of Spring's JDBC support and that the *shape* of the tree is the retry decision.
[Chunk 6c](06c-what-to-catch-on-postgresql.md) then showed which PostgreSQL SQLSTATEs
land where — and that some land nowhere. A `catch` block written against that
reasoning is an assumption, and it is trivially testable:

```java
@Test
void aDuplicateEmailArrivesAsDuplicateKeyException() {
    customers.insert(new NewCustomer("a@example.com"));

    assertThatThrownBy(() -> customers.insert(new NewCustomer("a@example.com")))
            .isInstanceOf(DuplicateKeyException.class);
}
```

That test is worth more than it looks. It asserts three separate things at once: that
the unique constraint exists in the migrated schema, that PostgreSQL raises `23505`
for it, and that Spring's translator chain maps `23505` to `DuplicateKeyException`
rather than to the generic `DataIntegrityViolationException`. Change any one — drop the
constraint, add a `sql-error-codes.xml` that switches the whole application's
translator ([chunk 6b](06b-the-translator-chain.md)) — and this test is what tells you.

The same shape pins the uncategorised cases. If you added a custom translator so that
`55P03` from a `for update nowait` arrives as `CannotAcquireLockException` instead of
`UncategorizedSQLException`, a test asserting that is the only evidence the translator
is wired at all.

⚠️ **After the violation, the transaction is aborted.** On PostgreSQL a failed
statement puts the transaction into the state where every subsequent statement gets
`25P02`, so a test cannot assert the exception and then query the table on the same
connection. Assert the exception and stop; put the "and the row was not inserted"
check in its own test.
## Gotchas

**A parse test that runs against a hand-written `test-schema.sql` proves the wrong
thing.** It proves the statements match the schema in the test resources, which is the
schema that was already drifting. The parse test earns its keep only when the schema
comes from the migrations ([chunk 12d](12d-the-jdbctest-slice.md)).

**`PREPARE` needs a unique name, or `DEALLOCATE`.** Prepared statements "only last for
the duration of the current database session", and a session here is a pooled
connection that outlives the test. Reusing one name across a parameterised run either
collides or silently checks the first statement several times, depending on ordering.
Deallocate after each, or generate the name from the statement.

**PostgreSQL's `jsonb` existence operators are spelled with question marks.** `?`,
`?|` and `?&` — "Does the text string exist as a top-level key or array element within
the JSON value?" — collide with the JDBC placeholder character, so any helper that
rewrites `?` positionally will corrupt a query using them. ⚠️ I have not found a note
in the PostgreSQL manual about this clash; it is a consequence of the two syntaxes
meeting, and it is worth knowing before you write a `?`-substituting loop. The
`jsonb_exists(jsonb, text)` function form avoids it entirely.

**Asserting on a translated exception is an assertion about the engine.** It passes or
fails based on the SQLSTATE the engine raised and the translator's mapping for it, so
running one against an embedded database asserts a mapping you do not deploy
([chunk 12f](12f-the-real-database.md)). It will usually pass — most engines use
`23505` for a unique violation — which is exactly what makes it misleading.

**A parse test is not a substitute for a value test, and the reverse.** The parse test
covers every statement shallowly; the value tests cover a few statements deeply. A
suite with only the first has never checked a mapping; a suite with only the second
ships renames in the queries nobody exercised. They cost different things and catch
different things.

**A statement the parse test cannot type is not a statement to delete from the list.**
The temptation, when `coalesce(:a, :b)` fails to infer, is to exclude that query and
move on — at which point it is the one query with no coverage at all. Give it a
declared type list in the `PREPARE`, or keep an explicit, named exclusion set so the
gap is visible in the source rather than implied by an empty result.

**The parse test finds nothing until it is wired to the real query source.** A
`@MethodSource` that walks a directory which does not exist, or reflects over fields
that are all `private` in a class the test cannot see, yields zero cases and a green
run. A parameterised test with no arguments should fail, not pass — assert the case
count as its own test.

**After a constraint violation the transaction is unusable, and that includes the
cleanup.** On PostgreSQL the failed statement aborts the transaction, so every
subsequent statement gets `25P02` — including a `delete` in the test body meant to tidy
up. Cleanup belongs in an `AFTER_TEST_METHOD` script or in the rollback, not after the
assertion.

**Testing that an uncategorised SQLSTATE stays uncategorised is worth writing once.**
`55P03` from `for update nowait` lands nowhere in Spring's sets
([chunk 6c](06c-what-to-catch-on-postgresql.md)). If you have added a custom translator
to fix that, the test asserting `CannotAcquireLockException` is the only evidence it is
wired; if you have not, a test asserting `UncategorizedSQLException` documents the gap
where the next person will look for it.

## Interview questions

**★ How would you check that every query still matches the schema?**
Prepare each one against the migrated database. PostgreSQL's `PREPARE` documentation
says the statement is "parsed, analyzed, and rewritten" at `PREPARE` time and only
planned and executed at `EXECUTE`, so preparing resolves every table and column
against the catalog without touching a row. So: run the migrations, enumerate every
statement — a `.sql` directory or the `static final String` fields of each repository —
convert `:name` to `$1`-style placeholders with `NamedParameterUtils`, and `prepare`
each in a parameterised test. It catches renames, arity errors and type errors in
expressions across the whole layer, including the queries no test calls. Two caveats I
would state up front: it says nothing about the plan, and parameter type inference can
fail on expressions like `coalesce(:a, :b)`, which need a declared type list.

**★ What does `PREPARE` not tell you?**
Anything about the plan, because planning happens at `EXECUTE` — so a prepared query
can still be a sequential scan over ten million rows. Anything about the data, since
no rows go through it. And anything about the mapping: a column that exists but has
changed type from `bigint` to `text` prepares perfectly and fails at runtime in the row
mapper. It is a check on names, arity and expression types, which happens to be exactly
the class of failure a schema rename introduces and the class that has no compile-time
check in a SQL-first codebase.

**★ How do you test that a unique violation arrives as `DuplicateKeyException`?**
Insert the row twice inside a repository test against a real PostgreSQL and assert the
type of the thrown exception. It is a small test that pins three things at once: the
constraint exists in the migrated schema, PostgreSQL raises `23505` for it, and
Spring's translator maps that to `DuplicateKeyException` rather than the generic
integrity-violation class. One caveat: after the failure the transaction is aborted, so
every further statement on that connection gets `25P02`. Assert the exception and end
the test; a "and the row was not inserted" check belongs in a separate one.

**★ Why does the parse test only work in some codebases?**
Because it needs the SQL to be reachable at runtime. A `.sql` file on the classpath is
enumerable, and so is a `static final String` field read reflectively. A text block
inside a method body is not reachable at all — it exists only in the compiled method —
so those queries can only be covered by tests that call them. That is the argument
[chunk 12c](12c-where-the-sql-lives.md) makes for moving at least the important queries
into constants or files: not tidiness, but the difference between "covered by the tests
we wrote" and "covered".

**★ Where exactly do migrations meet tests?**
Here. The parse test runs after the migrations have built the schema, so its subject is
the relationship between the two artefacts — a migration that renames a column and a
query that still uses the old name fail in the same build, before either reaches an
environment. The second meeting point is the migrations themselves: running them in the
test is what proves they *apply*, and a migration that cannot apply to a database with
data in it — a `not null` on a column with nulls, a unique index on duplicated values —
fails in CI rather than in a deployment window.

**★ You inherit a repository with no tests. What do you write first?**
The parse test, because it is one test and it covers every statement in the layer
shallowly — and in a codebase with no tests, the highest-probability defect is a query
that no longer matches the schema. Then a value test for the two or three queries the
business cares most about, asserting every mapped component, since the mapping is the
part with no compile-time check. Then the exception-translation test for each
constraint the code catches by type. That is maybe a day's work and it converts the
layer from unverified to something a rename cannot silently break.

---

← Prev: [12h · What to assert](12h-what-to-assert.md) · Index: [05 · SQL-first access](README.md) · Next → [12j · The review checklist](12j-the-review-checklist.md)
