---
title: "`:name` is not a JDBC feature — Spring parses your SQL and rewrites it into `?` before the driver ever sees it"
sidebar_label: "5 · Named parameters"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access → JDBC
> Core Classes* and *Common Problems with Parameter and Data Value Handling*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html),
> [.../jdbc/parameter-handling.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/parameter-handling.html)),
> and the `NamedParameterUtils` source in spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/namedparam/NamedParameterUtils.java)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18, pgJDBC 42.7.x.

**No JDBC driver supports `:name`. PostgreSQL does not support it either. It is a
Spring-level feature implemented by *parsing your SQL string* and rewriting every
`:name` into a positional `?` before handing the result to `JdbcTemplate`. Once you
know that, three otherwise-mysterious behaviours become obvious: why a name used
twice only needs its value supplied once, why an `IN` list can expand from one
parameter into fifteen, and why the parser has to know about PostgreSQL's `::`
cast operator.**

## What actually happens to your string

The reference states the delegation plainly:

> "The `NamedParameterJdbcTemplate` class wraps a `JdbcTemplate` and delegates to
> the wrapped `JdbcTemplate` to do much of its work."

The work it does *not* delegate is the rewrite. You write:

```sql
select id, first_name, last_name
from actor
where last_name = :lastName and first_name = :firstName
```

`NamedParameterUtils.parseSqlStatement` walks the string, records the parameter
names in order, and `substituteNamedParameters` produces the statement the driver
receives:

```sql
select id, first_name, last_name
from actor
where last_name = ? and first_name = ?
```

Then values are bound positionally, exactly as in
**[The `PreparedStatement` API](../01-jdbc/06-the-preparedstatement-api.md)**.
Everything about server-side prepared statements, plan caching and the generic-plan
behaviour applies unchanged — the database has no idea Spring was involved.

## The parser has to be a small SQL lexer, and it is

Rewriting a colon into a placeholder is only safe if you can tell a parameter from a
colon that means something else. The source keeps two parallel arrays:

| | Contents |
|---|---|
| `START_SKIP` | `'` · `"` · `--` · `/*` · `` ` `` |
| `STOP_SKIP` | `'` · `"` · newline · `*/` · `` ` `` |

So a colon inside a single-quoted literal, a double-quoted identifier, a line
comment or a block comment is left alone. There is also an explicit special case
for PostgreSQL, in a comment in the source:

```java
if (c == ':' && j < statement.length && statement[j] == ':') {
    // Postgres-style "::" casting operator should be skipped
    i = i + 2;
    continue;
}
```

which is why `where created_at > :from::timestamptz` works: the first colon starts a
parameter, the `::` is recognised as a cast and skipped.

Parameter names end at a **separator**, and the set is
`"':&,;()|=+-*%/\<>^` plus any whitespace. That is what lets
`:prefix || '%'` and `(:a, :b)` parse the way you expect.

## A name used twice is bound once

This is the ergonomic win over `?`, and it falls out of the parser keeping a `Set`
of names it has already seen:

```sql
select *
from booking
where start_at <= :at and end_at > :at
```

`:at` appears twice, so the rewritten SQL has two `?` placeholders — but you supply
the value **once**:

```java
jdbcClient.sql(OVERLAPS).param("at", when).query(BookingRow.class).list();
```

With positional `?` you would bind the same value twice, and the day somebody adds a
third condition, the binding count has to change in a different place from the SQL.
That class of bug does not exist with named parameters. It is a better reason to
prefer them than "they are more readable", although they are that too.

## Where the values come from

`SqlParameterSource` is the abstraction, and there are four implementations you
will meet:

| Implementation | Source of values | Note |
|---|---|---|
| `MapSqlParameterSource` | a `Map` you build | "an adapter around a `java.util.Map`, where the keys are the parameter names" |
| `BeanPropertySqlParameterSource` | a JavaBean's getters | needs classic bean properties |
| `SimplePropertySqlParameterSource` | bean properties, **record components**, or fields | @since 6.1 — what `JdbcClient.paramSource(Object)` uses |
| `EmptySqlParameterSource` | nothing | a shared no-parameters instance |

```java
var params = new MapSqlParameterSource()
        .addValue("lastName", "Watling")
        .addValue("firstName", "Leonor");

namedJdbcTemplate.query(SQL, params, ACTOR_MAPPER);
```

and the `JdbcClient` equivalents:

```java
jdbcClient.sql(SQL).param("lastName", "Watling").param("firstName", "Leonor")…
jdbcClient.sql(SQL).params(Map.of("lastName", "Watling", "firstName", "Leonor"))…
jdbcClient.sql(SQL).paramSource(new ActorFilter("Leonor", "Watling"))…
```

`paramSource` with a record is the shape to reach for on a write, because the
parameter names and the record component names are then checked against each other
by nothing at all — which is why you should keep the record next to the SQL that
uses it.

## Telling Spring the SQL type

Usually unnecessary: "Spring determines the SQL type of the parameters based on the
type of parameter passed in". It becomes necessary when the value is `null`, because
`null` has no type to inspect. The reference gives three routes:

```java
// 1 · on the binding call
jdbcClient.sql(SQL).param("note", null, Types.VARCHAR).update();

// 2 · on a MapSqlParameterSource
new MapSqlParameterSource().addValue("note", null, Types.VARCHAR);

// 3 · wrapping the value
jdbcTemplate.update(SQL, new SqlParameterValue(Types.VARCHAR, null));
```

The underlying reason is the JDBC-level one from
**[The `PreparedStatement` API](../01-jdbc/06-the-preparedstatement-api.md)**:
`setObject(i, null)` cannot always work out what type the server should expect, so
the driver needs to be told.

## Gotchas

**The skip list does not include PostgreSQL dollar-quoting.** `START_SKIP` is
`'`, `"`, `--`, `/*` and a backtick. A dollar-quoted string — `$$ … $$` or
`$tag$ … $tag$`, which is how you write a function body or a literal containing
quotes — is **not** skipped, so a `:word` inside one is parsed as a named
parameter and rewritten into a `?`. If you are sending anything containing a
dollar-quoted body through `NamedParameterJdbcTemplate` or `JdbcClient` with named
parameters, use positional `?` for that statement instead, or run it through
`JdbcTemplate` directly.

**A single `:` that is not a parameter and not a cast is still a parameter.** The
parser has no knowledge of your dialect beyond the special cases above. `select
array[1:2]` is fine because `1` is a separator boundary, but constructs that place
a bare colon before an identifier-like token will be read as a parameter, and the
failure is a complaint about a missing parameter value rather than about the SQL.

**`::` works, but `: :` does not, and neither does a cast written with whitespace.**
The check is literally "the next character is also a colon". Formatting a query
across lines so that a cast's two colons are separated changes the meaning. This
never happens deliberately and occasionally happens to an auto-formatter.

**`BeanPropertySqlParameterSource` cannot read a record.** It wraps "an arbitrary
JavaBean … and uses the properties of the wrapped JavaBean". A record has no
`getX()` accessors, so every parameter resolves to nothing. The fix is
`SimplePropertySqlParameterSource`, or simply `JdbcClient.paramSource(Object)`,
which uses it and is documented to accept "JavaBean properties, record components,
or raw fields".

**Binding a parameter the SQL does not contain is silently ignored; the reverse
throws.** Supplying `:middleName` when the statement has no such placeholder does
nothing — a `MapSqlParameterSource` is a lookup, not a checklist. Renaming a
placeholder in the SQL and forgetting one of the bindings therefore fails on the
placeholder that lost its value, not on the stale binding, and the error names the
wrong end of the problem.

**Named parameters do not make dynamic SQL safe.** `:name` is a placeholder for a
*value*. A column name, a table name or a sort direction cannot be a parameter,
here or in JDBC — that is
**[`ORDER BY ?` does not work](../01-jdbc/07-what-a-parameter-can-be.md)**, and it
is where the remaining injection vulnerabilities live. Named parameters change the
spelling of the safe part, not the boundary of it.

**The SQL in the log is not the SQL you wrote.** `JdbcTemplate` logs the statement
it executes, which is the rewritten one with `?`. If you are searching your
application log for `:customerId` you will never find it. Search for the
surrounding SQL text instead.

**A parameter inside a comment is skipped — including a commented-out line you
meant to restore.** Commenting out `-- and status = :status` leaves the binding in
your Java code with no placeholder to fill, which is the silently-ignored case
above. The query then returns more rows than intended and nothing fails.

## Interview questions

**★ Does JDBC support named parameters?**
No. `PreparedStatement` has positional `?` placeholders only, and PostgreSQL's own
protocol uses `$1`, `$2` — neither has any notion of `:name`. Named parameters are
implemented entirely inside Spring: `NamedParameterUtils` parses the SQL string,
records the parameter names in order of appearance, and rewrites each occurrence
into a `?`. `NamedParameterJdbcTemplate` then hands the rewritten SQL and the
positionally-ordered values to a wrapped `JdbcTemplate`. Everything downstream —
the driver, the server-side prepared statement, the plan cache — sees ordinary
positional SQL.

**★ Why does a named parameter used twice only need to be supplied once?**
Because the parser separates *occurrences* from *names*. It appends a `?` for every
occurrence, so the rewritten SQL has as many placeholders as there were colons, but
it tracks distinct names in a `Set` and only asks the parameter source for each name
once, reusing the value for each occurrence. That is a real advantage over
positional binding, where a value used in two conditions must be bound twice and the
binding count changes whenever the SQL does — which is exactly the kind of edit
where an off-by-one creeps in.

**★ How does the parser avoid treating a colon inside a string literal as a
parameter?**
It is a small lexer. It keeps `START_SKIP` and `STOP_SKIP` arrays — single quote,
double quote, `--`, `/*` and backtick — and when it encounters a start delimiter it
scans forward to the matching stop delimiter and skips the whole region. It also has
an explicit special case for PostgreSQL: if a colon is immediately followed by
another colon, it treats it as the `::` cast operator and skips both. Worth knowing
what is *not* in that list — dollar-quoted strings are not, so a `:word` inside
`$$ … $$` will be rewritten.

**★ Which parameter source works with a Java record?**
`SimplePropertySqlParameterSource`, added in 6.1, which resolves values from bean
properties, record components or raw fields.
`BeanPropertySqlParameterSource` does not: it is documented as wrapping "an
arbitrary JavaBean" and reads `getX()` accessors, which a record does not have. In
practice you rarely name either class, because
`JdbcClient.paramSource(Object)` uses the simple one and its javadoc describes the
argument as "a JavaBean, record class, or field holder".

**★ When do you need to tell Spring the SQL type of a parameter?**
Almost never for a non-null value — the reference says Spring "determines the SQL
type of the parameters based on the type of parameter passed in". It matters when
the value is `null`, because there is no object to inspect and the driver may not be
able to infer what the server expects. The three documented ways are the extra
`int sqlType` argument on the binding call, `MapSqlParameterSource.addValue(name,
value, type)`, and wrapping the value in a `SqlParameterValue`. This is the Spring
surface of a JDBC-level problem — `setObject(i, null)` has the same ambiguity.

**★ If you search the logs for `:customerId`, why do you not find it?**
Because by the time anything is logged the parameter is gone. `JdbcTemplate` logs
the statement it actually executes, and that is the rewritten form with `?`
placeholders — the named form only ever existed in your source string. To correlate
a log line with a query in the code you have to match on the surrounding SQL text.
It is a small thing that costs people ten minutes the first time.

**★ Can you use a named parameter for a column name or a sort direction?**
No, and this is the same boundary as in plain JDBC. A placeholder — `?` or `:name` —
stands for a *value* in the parsed statement; the structure of the statement is
fixed before any value is bound. So `order by :column` sends a statement that sorts
by a constant, and `from :table` is a syntax error. Anything structural has to be
assembled in Java, which means validating it against an allow-list of known column
names rather than interpolating user input.

---

← Prev: [4b · The result specs](04b-the-result-specs.md) · Index: [05 · SQL-first access](README.md) · Next → [5b · `IN` lists and the cache](05b-in-lists-and-the-statement-cache.md)
