---
title: "Three callback interfaces take a `ResultSet` and they are not interchangeable — one maps a row, one consumes the whole cursor, one has side effects"
sidebar_label: "3 · `RowMapper` and friends"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `RowMapper`, `ResultSetExtractor`,
> `RowCallbackHandler` and `RowMapperResultSetExtractor` source in
> spring-framework `main`
> ([github.com/spring-projects/spring-framework/tree/main/spring-jdbc](https://github.com/spring-projects/spring-framework/tree/main/spring-jdbc/src/main/java/org/springframework/jdbc/core))
> and the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**`RowMapper`, `ResultSetExtractor` and `RowCallbackHandler` all receive a
`ResultSet` from the same `query(...)` call, and choosing between them is not a
style preference — it decides what results you are *able* to produce. A
`RowMapper` produces exactly one object per row, which is the right answer most of
the time and structurally the wrong answer for a join that fans out. Getting this
choice wrong is the real reason people say "you cannot do joins with
`JdbcTemplate`".**

## The three contracts, side by side

Each is a `@FunctionalInterface` with one method, and the three signatures tell you
almost everything:

```java
@FunctionalInterface
public interface RowMapper<T> {
    T mapRow(ResultSet rs, int rowNum) throws SQLException;
}

@FunctionalInterface
public interface ResultSetExtractor<T> {
    T extractData(ResultSet rs) throws SQLException, DataAccessException;
}

@FunctionalInterface
public interface RowCallbackHandler {
    void processRow(ResultSet rs) throws SQLException;
}
```

Read them as three different questions.

| | `RowMapper<T>` | `ResultSetExtractor<T>` | `RowCallbackHandler` |
|---|---|---|---|
| Called | once **per row** | once **per query** | once **per row** |
| Returns | one `T` | one `T` for the whole result | nothing |
| Who calls `rs.next()` | Spring | **you** | Spring |
| `query(...)` gives you | `List<T>` | `T` | `void` |
| Typical state | stateless | stateless | **stateful** |
| Job | shape one row | assemble a structure | do something per row |

Those "who calls `next()`" and "typical state" rows are not incidental — they are
from the javadoc, and they are what people get wrong.

## `RowMapper`: one row in, one object out

The common case, and the one to reach for by default.

```java
private static final RowMapper<Actor> ACTOR_MAPPER = (rs, rowNum) ->
        new Actor(rs.getLong("id"),
                  rs.getString("first_name"),
                  rs.getString("last_name"));

public List<Actor> findAll() {
    return jdbcTemplate.query("select id, first_name, last_name from actor",
                              ACTOR_MAPPER);
}
```

The javadoc is explicit about the one rule:

> "This method should not call `next()` on the `ResultSet`; it is only supposed to
> map values of the current row."

Spring drives the cursor. Your job is to read columns from wherever it has already
positioned it. The `rowNum` argument is a counter Spring maintains — and it
**starts at 0**, which you can read directly in `RowMapperResultSetExtractor`:

```java
int rowNum = 0;
while (rs.next()) {
    results.add(this.rowMapper.mapRow(rs, rowNum++));
}
```

Two consequences of that three-line loop are worth having in your head. First,
`rowNum` is 0-based, so `rowNum + 1` is the human row number. Second, **whatever
your mapper returns goes into the list, including `null`** — there is no filtering.
A mapper that returns `null` for rows it does not like produces a `List` with holes
in it, not a shorter list.

A `RowMapper` should be stateless, and the reason is the same as for
`JdbcTemplate` itself: it is shared. Declare it as a `private static final` field
or a small named class. A lambda capturing a mutable accumulator is a
`RowCallbackHandler` wearing the wrong interface.

## `ResultSetExtractor`: the whole cursor is yours

`extractData` is called **once**, with the cursor positioned before the first row,
and it returns one object for the entire result. You drive the loop:

```java
public Optional<OrderSummary> loadSummary(long orderId) {
    return jdbcTemplate.query(SUMMARY_SQL, rs -> {
        if (!rs.next()) {
            return Optional.<OrderSummary>empty();
        }
        var summary = new OrderSummary(rs.getLong("id"), rs.getBigDecimal("total"));
        return Optional.of(summary);
    }, orderId);
}
```

Two rules from the javadoc, both easy to break:

> "Implementations should not close this: it will be closed by the calling
> `JdbcTemplate`."

and

> "In contrast to a `RowCallbackHandler`, a `ResultSetExtractor` object is
> typically stateless and thus reusable, as long as it doesn't access stateful
> resources … or keep result state within the object."

Note the shape of the second one. The *extractor object* is stateless and
reusable; the accumulation happens in **local variables inside `extractData`**,
which is a fresh scope on every call. That is the difference between a reusable
extractor and one that silently merges the results of two concurrent queries.

The reference documentation is candid about when to use it:

> "A `RowMapper` is usually a simpler choice for `ResultSet` processing, mapping
> one result object per row instead of one result object for the entire
> `ResultSet`."

Which leaves the question of when it is *not* simpler — and the answer is one
specific, extremely common shape. **[Chunk 3b](03b-the-fan-out-problem.md)** is
about that shape: a join that returns more rows than objects.

## `RowCallbackHandler`: for things that are not results

`processRow` returns `void`. It is called once per row and Spring drives the
cursor, exactly like a `RowMapper`, but there is nowhere for a value to go. So it
exists for one purpose: **rows you want to do something with rather than collect.**

```java
public void streamToCsv(Writer out) {
    jdbcTemplate.query("select id, first_name, last_name from actor", rs -> {
        out.write(rs.getLong("id") + "," +
                  rs.getString("first_name") + "," +
                  rs.getString("last_name") + "\n");
    });
}
```

The javadoc says plainly what the other two say the opposite of:

> "In contrast to a `ResultSetExtractor`, a `RowCallbackHandler` object is
> typically stateful: it keeps the result state within the object, to be available
> for later inspection."

So an instance of one is *not* reusable across queries unless you deliberately
made it so, and Spring ships `RowCountCallbackHandler` as the worked example of the
stateful kind.

⚠️ **`RowCallbackHandler` does not by itself make a query streaming.** Being called
per row does not mean the rows arrive one at a time. Whether the driver has already
pulled the entire result into your heap before the first `processRow` call is
decided by the fetch size and the transaction — see
**[Fetch size and streaming](../01-jdbc/15-fetch-size-and-streaming.md)**. Handing
rows to a writer one at a time while the driver holds all ten million in memory
achieves nothing. Set the fetch size, and be inside a transaction.

## Choosing, in one rule

> **Does one row of the result correspond to one object you want?**
> Yes, and you want them all → `RowMapper`.
> No — several rows make one object, or the result is a structure →
> `ResultSetExtractor`.
> There is no result, only an effect → `RowCallbackHandler`.

Everything else is detail.

## Gotchas

**Calling `rs.next()` inside a `RowMapper` silently drops rows.** It compiles, it
runs, and it produces half a list. Spring's loop already called `next()` to
position the cursor; calling it again advances past the row you were given, so the
loop's next call lands on the row after that. You lose every other row, and the
`rowNum` values look perfectly ordinary. The javadoc's "should not call `next()`"
is not a style note.

**A `RowMapper` that returns `null` puts `null` in your list.**
`RowMapperResultSetExtractor` does `results.add(mapRow(rs, rowNum++))` with no null
check. Filtering rows in the mapper is therefore not filtering — it is producing a
list whose size is the row count and whose contents include nulls that will
`NullPointerException` somewhere far away. Filter in the `WHERE` clause, where it
belongs and where an index can help.

**A stateful `RowMapper` shared as a field is a concurrency bug.** The moment a
mapper accumulates — a counter, a `Map` it dedupes into, a `StringBuilder` — two
threads running two queries share it. This is exactly the case the
`ResultSetExtractor` javadoc warns about ("keep result state within the object"),
and the fix is to move the accumulator into a local variable inside an extractor,
not to synchronise the mapper.

**Closing the `ResultSet` inside a `ResultSetExtractor` breaks the template.** The
javadoc says the calling `JdbcTemplate` closes it. If you close it yourself the
template's own close attempt operates on a closed object, and — worse — anything
you had planned to read afterwards is gone. The `ResultSet` is on loan, exactly
like the `Connection` in `execute(ConnectionCallback)`.

**`rowNum` is 0-based, and people write `rowNum` into a "row number" column.**
It comes straight from the counter in `RowMapperResultSetExtractor`, which starts
at zero. If you are producing a display index, add one. If you need a genuine
ordinal from the database — one that survives paging — use `row_number() over
(...)` in the SQL instead; `rowNum` counts rows in *this* result, not in the query.

**Exceptions: throw `SQLException`, do not catch it.** All three interfaces declare
`throws SQLException`, and all three javadocs say the same thing — "there's no need
to catch `SQLException`". The template catches it and runs it through the exception
translator, which is what gives you a `DataAccessException` with the SQL and the
task name attached. A `try`/`catch` in your mapper that wraps it in a
`RuntimeException` throws all of that away.

## Interview questions

**★ What is the difference between `RowMapper` and `ResultSetExtractor`?**
`RowMapper.mapRow` is called once per row and returns one object per row; Spring
drives the cursor and collects the results into a `List`. `ResultSetExtractor
.extractData` is called once for the whole query with the cursor positioned before
the first row, and it returns a single object for the entire result; you drive the
cursor yourself. The practical consequence is the number of objects you can
produce. A `RowMapper` is a function from row to object, so it can only ever
produce as many objects as there are rows — which makes it structurally incapable
of assembling a one-to-many, where a join returns several rows that belong to one
parent. That is the case a `ResultSetExtractor` exists for.

**★ When would you use a `RowCallbackHandler`?**
When you want to *do* something per row rather than collect the rows. It returns
`void`, so there is no result to accumulate unless you accumulate it yourself. The
honest use cases are side effects: writing rows to a CSV or an HTTP response as
they arrive, feeding a checksum, publishing each row to a queue. The javadoc notes
it is "typically stateful", which is the tell — a handler that keeps a count or a
document is normal, and that in turn means an instance is not safely reusable
across queries. One thing it does *not* do by itself is make the query stream;
whether rows arrive incrementally is a fetch-size and transaction question at the
driver level.

**★ Why must a `RowMapper` not call `next()`?**
Because Spring's loop already did. `RowMapperResultSetExtractor` runs
`while (rs.next()) { results.add(mapRow(rs, rowNum++)); }`, so your mapper is
handed a cursor that is already sitting on a row. Calling `next()` inside it
advances to the following row, you map that one instead, and then the loop's own
`next()` skips past it. The effect is that you silently process every second row.
Nothing throws, the list is simply half the size it should be, and `rowNum` looks
correct — which is what makes it a nasty bug rather than an obvious one.

**★ Is a `RowMapper` thread-safe?**
It is if you wrote it that way, and you should. Mappers are typically stored in
`static final` fields and shared across every call to a repository, so any mutable
state in one is shared between concurrent queries. A mapper should be a pure
function from the current row to a new object. If you find yourself wanting a field
— a counter, a dedupe map, a running total — you have discovered that you needed a
`ResultSetExtractor`, whose accumulation lives in a local variable inside
`extractData` and is therefore per-call by construction.

**★ Should a `RowMapper` catch `SQLException`?**
No. The interface declares it, the javadoc for all three callbacks says explicitly
that there is no need to catch it, and the calling template does something useful
with it: it runs it through the configured `SQLExceptionTranslator` and rethrows an
unchecked `DataAccessException` carrying the task description and the SQL. Catching
and wrapping in your own `RuntimeException` discards the translation, so what
reaches your `@ControllerAdvice` is an anonymous runtime exception instead of, say,
`DuplicateKeyException`.

**★ What happens if a `RowMapper` returns `null` for some rows?**
The `null` goes straight into the result list. `RowMapperResultSetExtractor` adds
the return value unconditionally, so you get a list of the same length as the
result set with nulls scattered through it. People do this intending to filter, and
it does the opposite of filtering — it defers a `NullPointerException` to whichever
piece of code consumes the list. Filtering belongs in the `WHERE` clause: it is
where an index can be used, and it is where the reader expects it.

---

← Prev: [2b · Wiring, settings, logging](02b-settings-and-logging.md) · Index: [05 · SQL-first access](README.md) · Next → [3b · The fan-out problem](03b-the-fan-out-problem.md)
