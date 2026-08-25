---
title: "`JdbcClient` is one chain — SQL, then parameters, then a result shape — and the chain refuses to run until you say what you expect back"
sidebar_label: "4 · `JdbcClient`"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JdbcClient` and `JdbcClient.StatementSpec` javadoc
> ([docs.spring.io/.../simple/JdbcClient.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.html)),
> the `DefaultJdbcClient` source in spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/simple/DefaultJdbcClient.java)),
> the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html))
> and the Spring Boot 4.1 reference *Data → SQL Databases → Using `JdbcClient`*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**`JdbcClient` arrived in Spring Framework 6.1 and it is what a new service should
use. It is not a new way to talk to a database — it delegates to `JdbcTemplate` and
`NamedParameterJdbcTemplate` — it is a better way to *write down* the same call. The
improvement is structural: the old API encodes "how many rows do I expect" in the
name of the method you pick, so the decision is made before you have finished
writing the query. `JdbcClient` moves it to the end of the chain, where
`.single()`, `.optional()` and `.list()` sit next to each other and the difference
is visible.**

## The shape of every call

Three stages, and each returns a different type:

```java
jdbcClient
    .sql("select id, first_name from actor where id = :id")   // → StatementSpec
    .param("id", 1212L)                                       // → StatementSpec
    .query(ActorRow.class)                                    // → MappedQuerySpec<ActorRow>
    .optional();                                              // → Optional<ActorRow>
```

| Stage | Method | Returns |
|---|---|---|
| 1 · the statement | `sql(String)` | `JdbcClient.StatementSpec` |
| 2 · the parameters | `param(...)`, `params(...)`, `paramSource(...)` | the same `StatementSpec` |
| 3 · what you want back | `query(...)` / `update(...)` | a query spec, or an `int` |
| 4 · the result shape | `single()`, `optional()`, `list()`, … | your result |

Stage 4 is the interesting one and it gets [its own chunk](04b-the-result-specs.md).

## Getting one

In Spring Boot you inject it. The reference is explicit that it is auto-configured
"based on the presence of a `NamedParameterJdbcTemplate`", and that "any
customization using `spring.jdbc.template.*` properties is applied to the client as
well" — so the `fetch-size`, `max-rows` and `query-timeout` settings from
[chunk 2b](02b-settings-and-logging.md) reach `JdbcClient` too.

```java
@Repository
public class JdbcActorRepository {

    private final JdbcClient jdbcClient;

    JdbcActorRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }
}
```

Outside Boot there are four static factories:

| Factory | Use when |
|---|---|
| `JdbcClient.create(DataSource)` | the simple case |
| `JdbcClient.create(JdbcOperations)` | you already configured a `JdbcTemplate` and want its settings |
| `JdbcClient.create(NamedParameterJdbcOperations)` | same, for a `NamedParameterJdbcTemplate` |
| `JdbcClient.create(NamedParameterJdbcOperations, ConversionService)` | **@since 7.0** — plus a custom `ConversionService` for `query(Class)` |

The javadoc's reason for the middle two is worth quoting, because it is the answer
to "do I have to choose?":

> "Use this factory method to reuse existing `JdbcTemplate` configuration,
> including its `DataSource`."

You are never migrating *away* from `JdbcTemplate`. You are putting a better
front door on the one you have.

## Binding parameters

The `StatementSpec` javadoc gives eleven binding methods. They divide cleanly:

**Positional, for `?` placeholders:**

| Method | What it does |
|---|---|
| `param(Object)` | bind the next `?`, "by implicit order of parameter value registration" |
| `param(int jdbcIndex, Object)` | bind an explicit index — **1-based**, as JDBC always is |
| `param(int jdbcIndex, Object, int sqlType)` | the same, plus a `java.sql.Types` constant |
| `params(Object...)` / `params(List<?>)` | bind several, appended to any already registered |

**Named, for `:name` placeholders:**

| Method | What it does |
|---|---|
| `param(String name, Object)` | bind `:name` |
| `param(String name, Object, int sqlType)` | the same, plus a SQL type |
| `params(Map<String, ?>)` | "the given map will be merged into existing named parameters" |
| `paramSource(Object)` | derive every named parameter from an object's "JavaBean properties, record components, or raw fields" |
| `paramSource(SqlParameterSource)` | a `MapSqlParameterSource` or `BeanPropertySqlParameterSource` |

`paramSource(Object)` is the one that makes writes pleasant, because a record you
already have becomes the whole parameter set:

```java
record NewActor(String firstName, String lastName) {}

jdbcClient.sql("insert into actor (first_name, last_name) values (:firstName, :lastName)")
          .paramSource(new NewActor("Leonor", "Watling"))
          .update();
```

🔴 **You may not mix positional and named parameters in one statement.**
`DefaultJdbcClient` checks and throws, with these messages:

> `"Configure either named or indexed parameters, not both"`

> `"Configure either individual named parameters or a SqlParameterSource, not both"`

The second one catches a subtler mistake: calling `param("id", 1)` *and*
`paramSource(someRecord)` on the same spec. Pick one source of named values.

## Statement settings on the chain — new in 7.0

Spring Framework 7.0 added three methods to `StatementSpec`, all marked
`@since 7.0`:

```java
try (Stream<AuditRow> rows = jdbcClient
        .sql("select id, event, at from audit_log where at >= :from")
        .param("from", cutoff)
        .withFetchSize(1000)
        .withQueryTimeout(30)
        .query(AuditRow.class)
        .stream()) {
    rows.forEach(this::archive);
}
```

| Method | Javadoc |
|---|---|
| `withFetchSize(int)` | "Apply the given fetch size to any subsequent query statement" |
| `withMaxRows(int)` | "Apply the given maximum number of rows to any subsequent query statement" |
| `withQueryTimeout(int)` | "Apply the given query timeout **in seconds** to any subsequent query statement" |

Before 7.0 these were per-template settings only, which meant a single streaming
query forced you to either configure a second `JdbcTemplate` or set a global fetch
size for the whole application. This is a genuinely useful addition, and the reason
it matters is
**[Fetch size and streaming](../01-jdbc/15-fetch-size-and-streaming.md)** — a
streaming read on PostgreSQL needs a fetch size *and* a transaction, and now the
fetch size can live on the one query that needs it.

## What `JdbcClient` deliberately does not do

Its own javadoc draws the line:

> "For complex JDBC operations — for example, batch inserts and stored procedure
> calls — you may use those lower-level template classes directly, or alternatively
> `SimpleJdbcInsert` and `SimpleJdbcCall`."

and the reference repeats it:

> "`JdbcClient` is a flexible but simplified facade for JDBC query/update
> statements. Advanced capabilities such as batch inserts and stored procedure calls
> typically require extra customization."

So a repository that is 95% `JdbcClient` and drops to `JdbcTemplate.batchUpdate`
for one bulk import method is not inconsistent — it is following the documented
design. [Chunk 8b](08b-batches-and-bulk-writes.md) covers that case.

## Gotchas

**Forgetting the terminal call compiles and does nothing.**

```java
jdbcClient.sql("delete from session_token where expires_at < :now")
          .param("now", Instant.now());     // ← no .update(). Nothing happens.
```

That is a legal Java statement — a method invocation whose result is discarded — so
there is no compiler error and no warning by default. Nothing is sent to the
database. The tell is a repository method that returns `void` and has no assertion
in its test. Enable your IDE's or build's "result of method call ignored" inspection
for `org.springframework.jdbc`, and prefer returning the `int` from `update()` up
the stack so the value has somewhere to go.

**Mixing `?` and `:name` throws at runtime, not compile time.** Copying half a
query from an older `JdbcTemplate` method into a `JdbcClient` chain is exactly how
this happens: the SQL keeps a `?` and the new code binds by name. You get
`"Configure either named or indexed parameters, not both"` — a clear message, but
only once that code path executes. Convert the whole statement in one go.

**A `StatementSpec` is mutable and accumulates.** Every `param(...)` overload is
documented as returning "this statement specification (for chaining)" — it mutates
and hands itself back. So a spec stored in a field and reused across calls keeps the
previous call's parameters and, under concurrency, mixes two requests' values into
one statement. **Start from `jdbcClient.sql(...)` on every call.** The SQL string
itself is fine as a `static final` constant; the spec is not.

**`params(Object...)` appends, it does not replace.** The javadoc says the list
"will be added to existing positional parameters, if any". Building a spec
conditionally — `if (filter != null) spec.params(a, b);` — and then calling
`params(...)` again later gives you four parameters for two placeholders, and a
`SQLException` about the wrong parameter count rather than anything that names your
mistake.

**Positional `param(int, Object)` is 1-based.** The javadoc says "the JDBC-style
index (starting with 1)". Everything else in your Java code is 0-based, including
the `rowNum` handed to a `RowMapper`. Mixing the two conventions in one class is
worth a comment.

**The reflective mappers do not know about your `ConversionService` unless it is
theirs.** Each mapper holds a `ConversionService` — a `DefaultConversionService` by
default. A custom converter registered in your application context is not
automatically used by `query(Class)`.
`JdbcClient.create(NamedParameterJdbcOperations, ConversionService)` exists
precisely for that, and is **@since 7.0**.

**`JdbcClient` is not a query builder and will not help you build SQL.** There is
no `.where(...)`, no `.orderBy(...)`. Dynamic SQL is still string assembly, with
all the discipline that requires — see
**[Dynamic SQL without concatenation](../01-jdbc/07b-dynamic-sql-without-concatenation.md)**.
If you want typed SQL construction, that is jOOQ, and it is **Topic 13 · jOOQ**
*(not written yet)*.

## Interview questions

**★ What is `JdbcClient` and why was it added?**
A fluent facade over `JdbcTemplate` and `NamedParameterJdbcTemplate`, added in
Spring Framework 6.1. Its javadoc calls it "a convenient unified facade for JDBC
`PreparedStatement` execution" supporting both positional and named parameters. It
was added because the two older templates split along a line that is not a real
architectural distinction — parameter *style* — so application code had to choose a
class before it had written the query, and mixing styles meant two injected beans.
The second, subtler improvement is that the result cardinality moved from the method
name to the end of the chain: `queryForObject` versus `query` becomes `.single()`
versus `.list()`, which reads as an intention rather than as an API choice.

**★ Does `JdbcClient` replace `JdbcTemplate`?**
No, and it cannot — it runs on it. `JdbcClient.create(JdbcOperations)` exists
precisely so you can wrap an existing configured `JdbcTemplate`, and the javadoc
says the point is "to reuse existing `JdbcTemplate` configuration, including its
`DataSource`". `JdbcTemplate` is also still the answer for things `JdbcClient`
deliberately omits: its own javadoc points you at the template classes, or at
`SimpleJdbcInsert` and `SimpleJdbcCall`, for batch inserts and stored procedure
calls. The right way to describe it is that `JdbcClient` is the front door and
`JdbcTemplate` is the engine.

**★ Can you use `?` and `:name` in the same `JdbcClient` statement?**
No. `DefaultJdbcClient` checks and throws `IllegalStateException` with the message
"Configure either named or indexed parameters, not both". There is a second check
for a related mistake — supplying individual named parameters *and* a
`SqlParameterSource` — which reports "Configure either individual named parameters
or a SqlParameterSource, not both". Both are runtime failures, so they surface when
the path executes rather than when it compiles, which is why converting a query
from the old API should be done wholesale rather than a line at a time.

**★ What happens if you forget the terminal operation on the chain?**
Nothing at all, and that is the sharpest edge on the API.
`jdbcClient.sql(x).param("a", 1);` is a syntactically valid Java statement — a
method call whose return value is discarded — so it compiles cleanly and no
statement is ever sent to the database. It is most dangerous on writes, where a
`void` repository method that silently does nothing can survive a long time. The
defences are a returned row count that the caller checks, a test that asserts the
row actually changed, and switching on the "ignored method result" inspection.

**★ How would you stream a large result with `JdbcClient` on PostgreSQL?**
Set a fetch size on the chain with `withFetchSize(...)` — added in 7.0 — take the
result as a `Stream` via `query(Type.class).stream()`, and close the stream with
try-with-resources. All three parts are required. Without the fetch size, pgJDBC
materialises the whole result before the first element, so the stream is lazy over
data already in your heap. Without closing, the underlying result set and statement
stay open. And on PostgreSQL a cursor-based fetch only happens inside a
transaction, so the method needs to be `@Transactional`, ideally
`readOnly = true`.

**★ Should new code use `JdbcClient` or `NamedParameterJdbcTemplate`?**
`JdbcClient`, for new code, without much hesitation. It covers both parameter
styles, so you no longer have to inject two beans or convert a query when it grows
a second parameter; it makes the empty-result case explicit through `.optional()`;
and Boot auto-configures it from the `NamedParameterJdbcTemplate` that it was
already creating, so there is nothing to add. Keep `NamedParameterJdbcTemplate`
injected where you need something `JdbcClient` does not expose — most commonly
`batchUpdate` with a `SqlParameterSource[]`.

---

← Prev: [3d · The built-in mappers](03d-automatic-mappers.md) · Index: [SQL-first access](README.md) · Next → [4b · The result specs](04b-the-result-specs.md)
