---
title: "The mapper belongs next to the query, not in a shared `mappers` package — because a mapper is a function of a select list, not of a table"
sidebar_label: "12b · Mappers and return types"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `RowMapper` and `SimplePropertyRowMapper` javadoc
> ([docs.spring.io/.../jdbc/core/RowMapper.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/RowMapper.html),
> [.../jdbc/core/SimplePropertyRowMapper.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/SimplePropertyRowMapper.html)),
> the `JdbcClient.MappedQuerySpec` javadoc
> ([.../jdbc/core/simple/JdbcClient.MappedQuerySpec.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.MappedQuerySpec.html))
> and the `JdbcOperations.queryForStream` javadoc
> ([.../jdbc/core/JdbcOperations.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/JdbcOperations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**Two decisions inside the class from [chunk 12](12-testing-and-the-shape-of-a-repository.md)
do more damage when they go wrong than the class layout ever could: where the row
mapper lives, and what a method hands back. The first one has a rule that sounds
fussy and is not — a mapper shared between queries drags both queries towards
`select *`. The second is four prohibitions, each of which a real codebase has
learned the hard way.**

## Where the row mapper goes

**Next to the query, in the same class.** Not in a shared `mapper` package, and not
one mapper per table.

The reason is that a mapper is a function of a **select list**, not of a table. These
two queries touch the same table and cannot share a mapper:

```sql
select id, title, author_name, updated_at from article where …   -- the list screen
select id, title, body, tags, updated_at   from article where …   -- the detail screen
```

A shared `ArticleMapper` can only serve both by forcing both queries to select every
column it reads — which is exactly the cost
[chunk 10](10-when-sql-first-beats-an-entity.md) argued the list screen exists to
avoid. The moment a mapper is shared, the queries start converging on the widest
select list any caller needs, and the wide `text` and `jsonb` columns come back fifty
times so that four can be rendered.

There is a second, quieter reason. A mapper in a shared package has no visible owner,
so nobody knows which queries break when a component is added to it. A mapper
declared six lines under the SQL it serves has exactly one caller, and changing them
together is the obvious move rather than a research task.

### The three forms, in order of preference

**1 · No mapper at all.** A record whose component names match the column names, via
`query(Class)` — which uses `SimplePropertyRowMapper`
([chunk 3d](03d-automatic-mappers.md)), matching `customer_id` to `customerId`
without configuration.

**2 · A `private static final RowMapper<T>`** in the same class, when the mapping
needs code — a `jsonb` column, an enum with a legacy encoding, a computed field:

```java
private static final RowMapper<OrderRow> ROW_MAPPER = (rs, rowNum) -> new OrderRow(
        rs.getLong("id"),
        rs.getLong("customer_id"),
        Status.fromColumn(rs.getString("status")),
        rs.getBigDecimal("total"),
        rs.getObject("placed_at", OffsetDateTime.class).toInstant());
```

`private static final` is right because a `RowMapper` is stateless and therefore
shareable — which is *not* true of a `RowCallbackHandler`, whose javadoc says it
"is typically stateful: it keeps the result state within the object"
([chunk 3](03-rowmapper.md)).

**3 · A named class**, when the mapper is genuinely long — a fan-out
`ResultSetExtractor` that assembles a parent and its children
([chunk 3b](03b-the-fan-out-problem.md)) can run to thirty lines and deserves a name.
Keep it a nested static class in the repository, not a file in a `mapper` package.

### The one case for sharing

A **fragment** that appears identically in several select lists — an embedded money
amount stored as `amount_minor` plus `currency`, say — can reasonably become a small
static helper taking the `ResultSet` and a column prefix. That is sharing a *field
group*, not a row shape, and it does not create pressure on any query's select list.

## What a repository method returns

| The question | The return type | The call |
|---|---|---|
| one row, absence is normal | `Optional<T>` | `.query(T.class).optional()` |
| one row, absence is a bug | `T` | `.query(T.class).single()` |
| many rows | `List<T>` | `.query(T.class).list()` |
| a distinct set | `Set<T>` | `.query(T.class).set()` |
| a count or single scalar | `long` / `BigDecimal` | `.query(Long.class).single()` |
| more rows than fit in memory | `Stream<T>` | `.query(T.class).stream()` |
| a write | `int` (rows affected) or `void` | `.update()` |

Four prohibitions follow, and they are worth writing down because they are the ones
teams argue about in review.

**Never return `null`.** `optional()` produces an `Optional` directly
([chunk 4b](04b-the-result-specs.md)), so returning `null` is a choice rather than a
consequence. A `null` from a repository propagates into caller code that has no
reason to expect it, and it makes the difference between "no such order" and "an
order with no rows" unrepresentable.

**Never return `Optional<List<T>>`.** The empty answer to "give me this customer's
orders" is an empty list. `Optional.empty()` and `List.of()` would mean the same
thing, so one of them is redundant — and it is the `Optional`, which forces every
caller through an unwrapping step that can never fail.

**Never return `List<Map<String, Object>>`.** It compiles, `listOfRows()` produces
it, and it exports your column names to every caller as untyped strings. A record
costs one line and gives the compiler something to check when the query changes.

**Return a `Stream<T>` only deliberately.** The `queryForStream` javadoc is explicit
that the result is "needing to be closed once fully processed (for example, through a
try-with-resources clause)", because the `ResultSet` and its connection stay open
until it is. Handing one across a package boundary transfers that obligation to code
that may not know it has it. Inside the repository, in a try-with-resources, it is
the right tool for a large export.

## Naming, since nothing enforces it

`find…` returns `Optional` or `List` and never throws on absence. `get…` returns `T`
and throws when there is nothing. `count…` returns a number. `insert…` / `update…` /
`delete…` return the affected row count when the caller can act on it and `void` when
it cannot. None of this is checked by anything, which is precisely why the convention
has to be written down somewhere and applied in review.

**Name the result type after the question, not after the table.** `OrderSummary`,
`OrderListRow`, `MonthlyRevenue` — not `OrderDto` and certainly not `Order`, which
invites a reader to think it is the same thing the write side deals in.

## Gotchas

**A record mirroring the table tempts callers to treat it as an entity.** Somebody
will change a field, hand it back, and expect a write. The type name is the main
defence: nothing called `OrderSummary` looks like a live object, whereas something
called `Order` does.

**`query(Class)` onto a record catches a missing column and cannot catch a swapped
one.** A record constructor must be fully supplied, so an absent column fails loudly.
Two `long` components in the wrong order, or `customer_id` landing where `id` should
be, are type-correct and silent. Only an assertion on values catches that
([chunk 12h](12h-what-to-assert.md)).

**`SimplePropertyRowMapper` on a record with a component the select list does not
provide fails at runtime, in the mapper, per row** — not at startup, and not on an
empty result set. A query that returns no rows will pass a test that a query
returning one row would fail.

**`single()` and `optional()` both throw when more than one row comes back, and that
throw is worth letting through.** They enforce the row count the return type claims,
which is a correctness check disguised as a signature — wrapping the call in a
`catch (IncorrectResultSizeDataAccessException ex)` to "make it robust" deletes the
only thing that would have told you the `where` clause stopped being unique
([chunk 7](07-queryforobject-and-empty.md)).

**A `Set<T>` return type deduplicates using the record's `equals`, not the
database's.** `set()` collects mapped objects into a `Set`, so two rows that differ
only in a column you did not select collapse into one and the count silently drops —
the row count and the collection size stop agreeing and nothing says so. If the
deduplication matters, do it in SQL with `distinct` or `group by`, where a reader can
see it and the planner can act on it.

**Returning `SqlRowSet` looks disconnected and safe, and leaks the query's shape.**
It is detached from the connection, so nothing stays open — but every caller now
navigates by column name and type, which is `List<Map<String, Object>>` with extra
steps.

**A mapper that calls `rs.next()` corrupts the iteration.** The `RowMapper` javadoc
says an implementation "should not call `next()` on the `ResultSet`" — the enclosing
`RowMapperResultSetExtractor` is doing that. A mapper that advances the cursor to
"peek at the next row" silently drops rows, and the loss is proportional to the
result size.

**Primitive components and SQL `NULL` do not mix.** A record component declared
`long` cannot hold a `NULL` from a `left join`, and the failure arrives as a type
mismatch inside the mapper rather than as anything mentioning nullability. An
outer-joined column is `Long`, or the SQL uses `coalesce` and says so.

**`BigDecimal` is not `double`, and a money column mapped to `double` passes every
test with round numbers.** `numeric` maps to `BigDecimal`; a component declared
`double` will be converted, and the error appears only once a value that is not
representable in binary floating point goes through — which in a test fixture of
`10.00` and `25.00` never happens.

## Interview questions

**★ Where do you put the `RowMapper`?**
In the same class as the query, as a `private static final` field, or not at all if
`query(Class)` onto a record does the job. Not in a shared `mapper` package, because
a mapper is a function of a select list rather than of a table. A list screen
selecting four columns and a detail screen selecting twelve cannot share one mapper
unless both queries select everything the mapper reads — and avoiding exactly that is
why the list screen was written in SQL in the first place. So the rule is one result
record per query, declared next to it, named after the question.

**★ What should a repository method return, and what should it never return?**
`Optional<T>` when a single row may legitimately be absent, `T` when absence is a bug
and an exception is correct, `List<T>` for many, a scalar for a count. Never `null` —
`optional()` gives you an `Optional` directly, so a `null` return is a decision
somebody made. Never `Optional<List<T>>`, because the empty list already is the empty
answer and the `Optional` adds an unwrap that can never fail. Never
`List<Map<String, Object>>`, because it exports column names as untyped strings to
every caller. And a `Stream<T>` only deliberately, because the result set and its
connection stay open until the caller closes the stream.

**★ Why is `private static final` the right modifier set for a `RowMapper`?**
Because a `RowMapper` is stateless — it takes a `ResultSet` and a row number and
returns an object, holding nothing between calls — so one instance can serve every
call on every thread, and `static final` says that in the type system. The contrast
is `RowCallbackHandler`, whose javadoc describes it as "typically stateful: it keeps
the result state within the object"; sharing one of those across threads is a bug. A
`ResultSetExtractor` sits in between: reusable "as long as it doesn't keep result
state within the object", which is a property of the one you wrote rather than of the
interface.

**★ A record component is `long` and the column comes from a `left join`. What
happens?**
It fails, at runtime, in the mapper, on the first row where the join misses — a
primitive cannot take SQL `NULL`. The message is about a type mismatch and does not
mention the join, so it reads as a mapping bug rather than a query one. Two fixes:
declare the component `Long` and let the absence be visible in the type, or write
`coalesce(x, 0)` in the SQL so the query itself states what a missing row means. I
prefer the second when zero is genuinely the right answer, because it puts the
decision where a reader of the SQL can see it.

**★ Why not one `OrderMapper` for the `orders` table, reused everywhere?**
Because that mapper defines a select list, and every query that uses it must supply
every column it reads. So the moment two screens share it, both queries select the
union of what both need — which is the wide-table cost the whole SQL-first argument
was about. It also removes the ownership signal: a mapper with an unknown number of
callers is one nobody dares change, so the next query writes its own anyway and you
end up with both. One record per query, next to the query, is more files and less
coupling.

**★ Is there anything wrong with returning `Stream<T>` from a repository?**
Not wrong, but it changes the contract in a way the signature does not communicate.
The stream is backed by an open `ResultSet` on an open connection, and the javadoc
for `queryForStream` says it needs "to be closed once fully processed"; a caller who
collects it into a list and moves on leaks a connection until something else closes
it. Inside the repository it is exactly right for a large export — open it in a
try-with-resources, write rows to the output as they arrive, never materialise the
result. Across a package boundary I would return `void` and take a consumer instead,
so the resource never escapes the class that owns it.

---

← Prev: [12 · The repository shape](12-testing-and-the-shape-of-a-repository.md) · Index: [05 · SQL-first access](README.md) · Next → [12c · Where the SQL lives](12c-where-the-sql-lives.md)
