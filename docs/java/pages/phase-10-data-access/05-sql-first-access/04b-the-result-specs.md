---
title: "The last call in the chain declares how many rows you expect — and eleven of them are not interchangeable"
sidebar_label: "4b · The result specs"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JdbcClient`, `JdbcClient.StatementSpec`,
> `JdbcClient.MappedQuerySpec` and `JdbcClient.ResultQuerySpec` javadoc and the
> `JdbcClient` / `DefaultJdbcClient` source in spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/simple/JdbcClient.java)),
> the `JdbcOperations.queryForStream` javadoc, and the Spring Framework 7.0
> reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**`JdbcTemplate` puts the expected result cardinality in the *method name* —
`queryForObject` means "exactly one" and `query` means "any number", and you commit
to that before the query is written. `JdbcClient` moves it to the end of the chain.
`.single()`, `.optional()` and `.list()` sit next to each other, differ by one word,
and their differences are exactly the ones that matter: what happens on zero rows,
and what happens on two.**

## Which spec you get depends on how you call `query`

```java
spec.query()                      // → ResultQuerySpec       — untyped rows
spec.query(SomeType.class)        // → MappedQuerySpec<T>    — mapped rows
spec.query(rowMapper)             // → MappedQuerySpec<T>    — mapped rows, your mapper
spec.query(rowCallbackHandler)    // → void                  — side effects only
spec.query(resultSetExtractor)    // → T                     — you drive the cursor
```

The last two are the callbacks of [chunk 3](03-rowmapper.md), reachable directly.
The first three continue into a spec whose terminal methods are the subject of this
chunk.

## `MappedQuerySpec<T>` — five ways to finish

| Terminal | Returns | Javadoc |
|---|---|---|
| `list()` | `List<T>` | "a pre-resolved list of mapped objects, retaining the order from the original database result" |
| `set()` | `Set<T>` | "an order-preserving set of mapped objects" |
| `stream()` | `Stream<T>` | "a lazily resolved stream of mapped objects, retaining the order" |
| `single()` | `T` | "a single result as a required object instance" — **enforces non-null as of 6.2** |
| `optional()` | `Optional<T>` | "a single result, if available, as an `Optional` handle" |

```java
Optional<ActorRow> maybe = jdbcClient.sql(BY_ID).param(id).query(ActorRow.class).optional();
ActorRow required        = jdbcClient.sql(BY_ID).param(id).query(ActorRow.class).single();
List<ActorRow> all       = jdbcClient.sql(ALL).query(ActorRow.class).list();
```

🔴 **`single()` and `optional()` behave identically on two rows and differently on
zero.** Both reject two rows — that is `IncorrectResultSizeDataAccessException`.
`single()` on zero rows throws `EmptyResultDataAccessException`; `optional()` on
zero rows returns `Optional.empty()`. This is *the* thing to know about the API and
it has [its own chunk](07-queryforobject-and-empty.md).

## `ResultQuerySpec` — when you do not want a type

Reached by calling `query()` with no argument. It hands back untyped rows, and it
exists for the cases where declaring a class would be ceremony: an ad-hoc admin
query, a `count(*)`, a CSV export.

| Terminal | Returns | Javadoc |
|---|---|---|
| `rowSet()` | `SqlRowSet` | "a detached representation of the original database result" |
| `listOfRows()` | `List<Map<String, Object>>` | rows as maps of "case-insensitive column names to values" |
| `singleRow()` | `Map<String, Object>` | one row, same map shape |
| `singleColumn()` | `List<Object>` | "a single column result, retaining the order" — possibly empty |
| `singleValue()` | `Object` | one value — **enforces non-null as of 6.2** |
| `optionalValue()` | `Optional<Object>` | **@since 6.2** |

```java
long total = (long) jdbcClient.sql("select count(*) from actor").query().singleValue();

List<Object> ids = jdbcClient
        .sql("select id from actor where last_name = :ln")
        .param("ln", "Watling")
        .query()
        .singleColumn();
```

Most of the time you want the typed form instead — `query(Long.class).single()` —
because it converts for you and does not require a cast.

## What `query(Class)` actually builds

`DefaultJdbcClient` branches on `BeanUtils.isSimpleProperty(mappedClass)`:

- a **simple value type** (`Long`, `String`, `UUID`, an enum, …) →
  `new SingleColumnRowMapper<>(mappedClass, conversionService)`
- **anything else** → `new SimplePropertyRowMapper<>(mappedClass, conversionService)`

which matches what the `StatementSpec.query(Class)` javadoc says the argument is
for: "either a simple value type for a single column mapping or a JavaBean / record
class / field holder for a multi-column mapping". The mappers themselves — and the
consequences of `SimplePropertyRowMapper` being the permissive one — are
[chunk 3d](03d-automatic-mappers.md).

## Streaming, and the two things that make it real

`stream()` delegates to `queryForStream` on the underlying template, whose javadoc
is unambiguous about the obligation it hands you:

> "the result `Stream`, containing mapped objects, **needing to be closed once fully
> processed** (for example, through a try-with-resources clause)"

```java
@Transactional(readOnly = true)
public void archiveOldEvents(Instant cutoff) {
    try (Stream<AuditRow> rows = jdbcClient
            .sql("select id, event, at from audit_log where at < :cutoff order by id")
            .param("cutoff", cutoff)
            .withFetchSize(1000)
            .query(AuditRow.class)
            .stream()) {
        rows.forEach(archiver::archive);
    }
}
```

Three things in that method are load-bearing and all three are easy to omit:
the **try-with-resources**, the **fetch size**, and the **transaction**. Without the
fetch size, pgJDBC reads the entire result into your heap before the first element
is produced — the stream is then lazy over data that is already resident, which
achieves nothing. Without the transaction, pgJDBC will not use a cursor at all.
Both facts are
**[Fetch size and streaming](../01-jdbc/15-fetch-size-and-streaming.md)**, and
neither is something `JdbcClient` can do for you.

## Coming from `JdbcTemplate`

| `JdbcTemplate` | `JdbcClient` |
|---|---|
| `queryForObject(sql, Long.class, id)` | `.sql(sql).param(id).query(Long.class).single()` |
| `queryForObject(sql, mapper, id)` — and catch `EmptyResultDataAccessException` | `.sql(sql).param(id).query(mapper).optional()` |
| `query(sql, mapper, args)` | `.sql(sql).params(args).query(mapper).list()` |
| `queryForList(sql, String.class)` | `.sql(sql).query(String.class).list()` |
| `queryForList(sql)` | `.sql(sql).query().listOfRows()` |
| `queryForMap(sql, id)` | `.sql(sql).param(id).query().singleRow()` |
| `queryForRowSet(sql)` | `.sql(sql).query().rowSet()` |
| `queryForStream(sql, mapper)` | `.sql(sql).query(mapper).stream()` |
| `update(sql, args)` | `.sql(sql).params(args).update()` |
| `batchUpdate(...)` | — use `JdbcTemplate` or `SimpleJdbcInsert` |

The second row is the one that changes code rather than spelling: a `try`/`catch`
around `queryForObject` becomes `.optional()`, and the catch block disappears.

## Gotchas

**`set()` silently collapses duplicate rows, and records make that likely.** A
`Set` deduplicates by `equals`, and a record's `equals` compares every component. So
two rows that happen to be identical in every selected column become one element,
with no error and no count anywhere to notice it by. That is fine when you asked for
distinct values and a disaster when you are counting. Prefer `list()` unless you
specifically want set semantics — and if you do, say so in SQL with `distinct` as
well, so the intent is in the query rather than only in the Java.

**A stream you do not close holds JDBC resources open.** The javadoc says the stream
needs "to be closed once fully processed". Returning a `Stream` from a repository
method makes closing somebody else's problem and they will not do it. Either consume
it inside the method with try-with-resources, or accept a `Consumer<T>` and drive
the loop yourself.

**`listOfRows()` gives you case-insensitive maps, which changes what serialising
them produces.** The javadoc describes the entries as "case-insensitive column
names to values". That is convenient for lookup and surprising when the map is
handed to a JSON serialiser or iterated for keys — the key you get back is whatever
the driver reported, and on PostgreSQL unquoted identifiers come back folded to
lower case. If the map's keys become an API contract, alias every column explicitly.

**`rowSet()` is detached, which is a memory decision, not a convenience.** A
`SqlRowSet` survives after the connection is returned to the pool because it holds
the data. For a small lookup that is exactly what you want. For a large result it
means you have chosen to hold the entire result in the heap, which is the opposite
of what `stream()` plus a fetch size does.

**`singleValue()` returns `Object` and the cast is yours.** `(long) …query()
.singleValue()` compiles and will `ClassCastException` if the driver hands back an
`Integer` or a `BigDecimal` — which for `count(*)` on PostgreSQL is a `Long`, but
for `sum(...)` over an `integer` column is not the type most people guess.
`query(Long.class).single()` goes through the conversion service and is the
version to write.

**`singleColumn()` on a multi-column select does not select the first column.**
It is the untyped counterpart of `SingleColumnRowMapper`, and that mapper "expects
to operate on a `ResultSet` that just contains a single column". More than one
column is `IncorrectResultSetColumnCountException`, not a silent choice of the
first. That is the right behaviour and it does surprise people who expect
`getObject(1)`.

**Mapping to a `Set` or a `Stream` does not change what the database sent.** All
five terminals run the same statement; `set()` deduplicates in Java after every row
has crossed the network, and `stream()` is lazy only to the extent the fetch size
lets it be. If the goal is to move less data, that belongs in the SQL.

## Interview questions

**★ What is the difference between `single()`, `optional()` and `list()`?**
They differ in the two cases that matter, zero rows and more than one.
`list()` accepts anything and returns a possibly empty list. `single()` requires
exactly one: zero rows is `EmptyResultDataAccessException`, more than one is
`IncorrectResultSizeDataAccessException`, and as of 6.2 it also enforces that the
mapped value is non-null. `optional()` requires *at most* one: zero rows gives
`Optional.empty()`, and more than one still throws. So `optional()` is the right
default for a `findById`, `single()` is for a lookup whose absence is genuinely a
programming error or a broken invariant, and `list()` is for everything else.

**★ How do you get a single scalar out of `JdbcClient`?**
Two ways, and the typed one is better. Typed: `.query(Long.class).single()`, which
builds a `SingleColumnRowMapper` and runs the value through the conversion service,
so you get a `Long` and no cast. Untyped: `.query().singleValue()`, which returns
`Object` and leaves the cast to you — fine for an ad-hoc query, risky in
application code because the driver's actual type for an aggregate is often not the
one you would guess. Both require the select to have exactly one column; more than
one is `IncorrectResultSetColumnCountException`.

**★ How does `stream()` differ from `list()`, and when is that difference real?**
`list()` resolves every row before returning; `stream()` is described as "lazily
resolved", pulling from the open result set as you consume. The difference is real
only when the driver is genuinely fetching incrementally, and on PostgreSQL that
requires two extra conditions: a fetch size, so the driver uses a cursor rather than
reading everything up front, and an open transaction, because pgJDBC will not use a
cursor outside one. Get either wrong and `stream()` has the same memory profile as
`list()` with an added obligation to close it. When all three are in place it is how
you process a result larger than your heap.

**★ Why does `set()` worry you more than `list()`?**
Because deduplication is silent. A `Set` drops elements that are `equals` to one
already present, and records — the natural row type here — have component-wise
equality, so two rows identical in every selected column become one. There is no
count, no warning, and the result still looks like a plausible answer. If distinct
rows are what you want, `select distinct` says so in the place a reviewer will read
and lets the database do it before the rows cross the network. I would treat
`set()` in application code as something to ask about in review.

**★ What is a `SqlRowSet` and when would you use one?**
A detached representation of a result — it holds the data rather than a cursor, so
it remains usable after the connection has gone back to the pool. That makes it
useful for small results you want to pass around or inspect outside the data access
layer without defining a type. The trade is explicit: detached means resident, so
for anything large it is the opposite of the streaming approach. In practice a
record plus `query(Class).list()` covers most of what people reach for `rowSet()`
for, with types.

**★ Coming from `JdbcTemplate`, which call changes the most when you migrate?**
`queryForObject` for a lookup that might miss. In the old API it throws on zero
rows, so the idiomatic `findById` is a `try`/`catch` around it returning `null` —
which also swallows the two-row case, a genuinely different bug. In `JdbcClient` it
becomes `.optional()`, the catch block disappears, and the multiple-row case still
throws as it should. Everything else is largely a spelling change; that one is a
correctness improvement.

---

← Prev: [4 · `JdbcClient`](04-jdbcclient.md) · Index: [05 · SQL-first access](README.md) · Next → [5 · Named parameters](05-named-parameters.md)
