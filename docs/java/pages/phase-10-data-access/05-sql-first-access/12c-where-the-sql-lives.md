---
title: "Inline text block, constants class or external `.sql` file — the decision that matters is whether your SQL is reachable as data, because that is what makes it testable"
sidebar_label: "12c · Where the SQL lives"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 *Programmer's Guide to Text Blocks*
> ([docs.oracle.com/en/java/javase/25/text-blocks/](https://docs.oracle.com/en/java/javase/25/text-blocks/index.html)),
> the `Resource.getContentAsString(Charset)` javadoc — **@since 6.0.5**
> ([docs.spring.io/.../core/io/Resource.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/io/Resource.html)),
> the Spring Framework 7.0 reference *Data Access → JDBC → Parameter handling*
> ([docs.spring.io/.../jdbc/parameter-handling.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/parameter-handling.html))
> and the PostgreSQL 18 manual *Lexical Structure*
> ([postgresql.org/docs/18/sql-syntax-lexical.html](https://www.postgresql.org/docs/18/sql-syntax-lexical.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18.

**Three places a query can live, and the argument between them is usually conducted
on taste. There is a better criterion. Two of the three make your SQL reachable as
data — something a program can enumerate, hand to a database and ask "does this still
parse?" — and one of them does not. Everything else about the choice is preference;
that part is a capability.**

## The three forms

### 1 · Inline, at the call site

```java
public Optional<OrderRow> findById(long id) {
    return db.sql("""
              select id, customer_id, status, total, placed_at
              from orders
              where id = :id
              """)
             .param("id", id)
             .query(OrderRow.class)
             .optional();
}
```

Nothing to look up: the query and its parameters are in one place, and a reader sees
both without moving. This is the right form for a short query with one caller, and it
is what most SQL-first code should look like most of the time.

### 2 · A constant, in the same class

```java
private static final String FIND_BY_ID = """
        select id, customer_id, status, total, placed_at
        from orders
        where id = :id
        """;
```

One indirection, and two things in return. The method body becomes three lines that
are all about *binding and shape*, which is easier to scan when a class has fifteen
methods. And the SQL is now a field — something a test can read by reflection, which
is the point [chunk 12i](12i-the-parse-test.md) is built on.

### 3 · An external `.sql` file on the classpath

```
src/main/resources/sql/orders/find-by-id.sql
src/main/resources/sql/orders/summaries-for-customer.sql
```

```java
private static final String FIND_BY_ID = Sql.of("orders/find-by-id.sql");
```

with a loader that reads once and fails loudly:

```java
final class Sql {

    private static final String ROOT = "sql/";

    static String of(String name) {
        var resource = new ClassPathResource(ROOT + name);
        try {
            return resource.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot read " + ROOT + name, ex);
        }
    }
}
```

`Resource.getContentAsString(Charset)` is **@since 6.0.5** and is the whole loader —
no stream handling, no manual buffer. Because the constant is `static final`, the read
happens at class initialisation, so a missing or unreadable file fails when the
repository class is first loaded rather than on a user's request.

## What each form actually gives you

| | Inline | Constant | `.sql` file |
|---|---|---|---|
| Query and parameters read together | ✔ | partly | ✘ |
| Method bodies stay short | ✘ | ✔ | ✔ |
| Enumerable as data (for the parse test) | ✘ | ✔ | ✔ |
| IDE treats it as SQL by default | ✘ | ✘ | ✔ |
| Paste straight into a `psql` session | with edits | with edits | ✔ |
| Formatter / linter for SQL applies | ✘ | ✘ | ✔ |
| A `git diff` shows a SQL change as a SQL change | ✘ | ✘ | ✔ |
| Reviewable next to the migration that changed the schema | ✘ | ✘ | ✔ |
| Change requires a recompile | ✔ | ✔ | ✔ |
| Number of files to open to understand one method | 1 | 1 | 2 |

Two rows in that table deserve unpacking, because they are the ones people
underweight.

**"IDE treats it as SQL by default."** A `.sql` file gets syntax highlighting,
keyword completion and — if the IDE is connected to a database — schema-aware column
completion and a red underline on a misspelt column, with no configuration. A Java
string gets none of that unless you tell the IDE the string is SQL, which is possible
in most IDEs and is a per-project setup step that a new contributor will not have
done. Given that "nothing checks your column names" is the standing cost of SQL-first
([chunk 10b](10b-what-you-give-up.md)), an editor that does check them is worth more
here than it would be elsewhere.

**"Reviewable next to the migration."** A pull request that adds a column and changes
four queries is, with `.sql` files, five files in the same diff, all of them SQL. With
inline strings it is one `.sql` migration and four Java files whose diffs are string
literals. Nothing stops a reviewer reading either, but only one of them makes the
relationship obvious.

## The criterion that is not taste

A test can only check SQL it can get hold of. `PREPARE` every statement against the
real schema and you have a compile-time-ish check for the whole repository layer
([chunk 12i](12i-the-parse-test.md)) — but only if the statements
can be collected without parsing Java source.

- **A `.sql` directory** is trivially enumerable: walk the classpath resource tree.
- **`public static final String` fields**, or `private` ones read reflectively in a
  test, are enumerable per class.
- **A text block inside a method body** is not reachable at all at runtime. It exists
  only inside the compiled method.

That is the argument. It does not say every query must move out of its method — it
says that the queries you want covered by a parse test have to be somewhere a program
can find them.

## A rule that survives contact with a real codebase

- **Short and single-caller → inline.** Under about ten lines with one call site,
  the indirection costs more than it returns.
- **Anything a second method uses, or anything over ten lines → a constant** in the
  same class, named for the question.
- **Long, hand-tuned, or performance-critical → a `.sql` file.** A recursive CTE, a
  window-function report, anything with a `/*+ */`-style comment explaining an index
  choice: these are read and edited as SQL, so store them as SQL.
- **One statement per file.** `JdbcClient` sends one statement per call, and a file
  containing two separated by `;` will fail or silently run only the first depending
  on the driver. Split them.
- **Never mix query files with migration files.** Flyway runs everything matching its
  naming convention under its configured locations, so a query stored under
  `db/migration/` will be *executed as a migration* — see
  [Flyway and schema migrations](../11-flyway-migrations/README.md). Keep queries under `sql/` and migrations under
  `db/migration/`, and never let one directory serve both.

## Gotchas

**A text block's indentation is decided by the closing delimiter, and this changes
the string you send.** The compiler strips the common leading whitespace across all
lines *including the line holding the closing `"""`*. Put that delimiter at the left
margin and every line keeps its source indentation; put it level with the content and
the indentation disappears. Either compiles and runs. But the SQL *text* differs
between the two, and the prepared-statement cache is keyed on text
([chunk 5b](05b-in-lists-and-the-statement-cache.md)) — so a purely cosmetic
re-indent is a new cache entry on the server.

**Reformatting a `.sql` file is not a no-op for the same reason.** A tool that
uppercases keywords or realigns a `join` produces a different string, a different
statement in the driver's cache and a different entry in `pg_stat_statements`. It is
still the right thing to do occasionally; it is not the free change it looks like.

**Concatenating onto a string whose last line is a `--` comment comments out the
concatenation.** `"select * from t -- all of them" + " where id = ?"` sends a query
with no `where` clause and no error. Text blocks make this rarer, because they end
with a newline, but string-plus-string SQL assembly still exists in real code and
this is its quietest failure.

**Dollar-quoted bodies are not skipped by the named-parameter parser.**
`NamedParameterUtils` skips single quotes, double quotes, backticks, `--` comments and
`/* */` blocks — `$$ … $$` is not in that list, so a `:` inside a dollar-quoted
function body is read as a named parameter and the statement fails with a missing
parameter. DDL and function bodies belong in migrations, executed by a migration tool,
not passed through `JdbcClient`.

**An external `.sql` under `src/main/java` is not on the classpath.** Maven and
Gradle copy `src/main/resources`, not arbitrary files next to the `.java` they belong
to. The failure is a `FileNotFoundException` at runtime with a path that looks
correct, and it appears only after a clean build — so it typically survives local
development and fails in CI.

**A lazily-loaded `.sql` fails on the first request, not at startup.** A loader built
around `computeIfAbsent` on a `ConcurrentHashMap` looks tidier and defers every
failure to production traffic. Assign to `static final` fields — class initialisation
happens once, early, and a broken path takes the application down at boot where you
want it.

**The `sql/` directory drifts out of the jar's reproducibility story.** A query that
lives in a resource can, in principle, be edited in an unpacked deployment without a
rebuild. Treat that as a bug rather than a feature: the parse test and the review
trail both assume the file in the jar is the file in the repository.

**Splitting SQL out does not make it less injectable.** A `.sql` file with
`where status = '${status}'` and a `String.replace` at load time is exactly the
injection you were avoiding, with an extra file. External storage is for the *static*
text; every value is still a bound parameter ([chunk 5](05-named-parameters.md)).

**A shared `sql/common/` directory recreates the shared-mapper problem.** Fragments
factored out "because two queries have the same `where` clause" tie the two queries
together, so tuning one changes both. Duplicate the fragment; SQL is not code you
refactor for reuse, it is code you tune per call site.

## Interview questions

**★ Where do you keep the SQL in a SQL-first codebase?**
Short, single-caller queries inline in the method, because query and parameters read
better together. Anything longer or reused becomes a `static final` constant in the
same class. Long, tuned queries — recursive CTEs, window-function reports — go in
`.sql` files under `src/main/resources/sql/`, loaded once into `static final` fields
with `Resource.getContentAsString`. The reason I do not treat this as pure taste is
that a `.sql` file and a constant are both *enumerable at runtime*, which means a test
can collect every statement and `PREPARE` it against the real schema. A text block
inside a method body cannot be collected at all, so those queries are only ever
covered by tests that happen to call them.

**★ What does an external `.sql` file buy you that a text block does not?**
Four things. The IDE treats it as SQL with no setup, so misspelt columns get flagged
against a connected schema — which matters because nothing else in a SQL-first stack
checks column names. It can be pasted into a database console and run as-is, which is
how you actually tune a query. SQL formatters and linters apply to it. And a diff that
changes a query shows up as a SQL diff, in the same review as the migration that
prompted it. What it costs is one more file to open per method and a loader, which is
about eight lines.

**★ Is there a downside to moving SQL out of Java?**
Yes, and it is the obvious one: you now read two files to understand one method, and
the parameter names in the SQL are no longer next to the `param()` calls that supply
them — a mismatch is a runtime failure with nothing to warn you at the call site. The
loader adds a failure mode too, and the way to keep it harmless is to assign to
`static final` fields so a missing resource kills the application at startup rather
than failing the first request. My rule is that a query earns its own file when it is
long enough that you would want to open it in a SQL editor to change it.

**★ Why does re-indenting a text block matter at all?**
Because a text block's indentation is computed relative to the closing delimiter, so
moving that delimiter changes the actual characters in the string. And the string is
the statement-cache key: the driver caches prepared statements by SQL text, and
PostgreSQL aggregates `pg_stat_statements` the same way. A cosmetic re-indent produces
a new cache entry and a new statistics row, so a query you had been tracking appears
to vanish and a new one appears with zero history. Nothing breaks, but the continuity
of your performance data does.

**★ Can you put queries in the same directory as migrations?**
No, and it is worth being blunt about it. A migration tool runs every file it finds in
its configured locations that matches its naming convention. A query file dropped
there will either be executed against the database as a schema change or will break
the migration checksum, depending on the tool and the name. Queries live under `sql/`,
migrations live under `db/migration/`, and nothing serves both roles. The connection
between them is a review habit and a test, not a shared directory.

**★ Should common SQL fragments be factored out and shared?**
Almost never. Two queries that today share a `where` clause do not necessarily share
one tomorrow, and the moment a fragment is shared, tuning one query — adding a
predicate that lets the planner use a different index — changes the other. That is the
same failure as the shared row mapper in
[chunk 12b](12b-the-mapper-and-the-return-type.md): reuse pulls independent queries
into a shape that suits neither. SQL is written per call site and tuned per call site,
so duplication is the cheaper mistake.

---

← Prev: [12b · Mappers and return types](12b-the-mapper-and-the-return-type.md) · Index: [05 · SQL-first access](README.md) · Next → [12d · The `@JdbcTest` slice](12d-the-jdbctest-slice.md)
