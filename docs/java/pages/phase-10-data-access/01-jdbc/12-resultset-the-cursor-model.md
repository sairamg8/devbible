---
title: "A `ResultSet` is a cursor over rows you have not necessarily received yet"
sidebar_label: "12 · `ResultSet`: the cursor model"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.ResultSet` and
> `java.sql.ResultSetMetaData`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Issuing a Query and Processing the Result*
> (jdbc.postgresql.org/documentation/query/). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**A `ResultSet` is not a collection. It is a *cursor* — a pointer that starts
positioned before the first row and moves forward one row at a time, exposing
exactly one row at any instant. That single design decision explains nearly
everything that surprises people about it: why you must call `next()` before
reading anything, why you can only iterate once, why the object stops working the
moment its statement or connection closes, and why the rows it hands you may still
be arriving from the server while you read them — or, on PostgreSQL by default,
may all already be sitting in your heap. The gap between "cursor" as a mental
model and "list" as the mental model people actually use is where the
`OutOfMemoryError` on a large table comes from, and that gap gets its own chunk at
[fetch size and streaming](15-fetch-size-and-streaming.md).**

## The cursor

The javadoc states the model in two sentences worth quoting because everything
follows from them:

> A `ResultSet` object maintains a cursor pointing to its current row of data.
> Initially the cursor is positioned before the first row. The `next` method moves
> the cursor to the next row, and because it returns `false` when there are no
> more rows in the `ResultSet` object, it can be used in a `while` loop to iterate
> through the result set.

and

> A default `ResultSet` object is not updatable and has a cursor that moves forward
> only. Thus, you can iterate through it only once and only from the first row to
> the last row.

```java
try (ResultSet rs = ps.executeQuery()) {
    while (rs.next()) {
        long id = rs.getLong("id");
        String email = rs.getString("email");
    }
}
```

🔴 **The cursor starts *before* the first row, not on it.** So a
single-row query still needs `next()`:

```java
try (ResultSet rs = ps.executeQuery()) {
    if (!rs.next()) throw new CustomerNotFound(id);     // ✅
    return new Customer(rs.getLong("id"), rs.getString("email"));
}
```

Calling a getter without `next()` throws. Forgetting the `if (!rs.next())` guard
and calling `rs.next()` inside a `return` expression is the shape that produces a
"not positioned on a row" error in one branch and works in the other.

⚠️ **`rs.next()` returning false is the only "no rows" signal.** There is no
`isEmpty()`, no `getRowCount()` that works forward-only, and no exception. A count
query is a separate query.

## Columns are numbered from 1, and labels are not free

The javadoc: **"Columns are numbered from 1."** Both index and label forms exist,
and the guidance is more nuanced than "always use labels":

> In general, using the column index will be more efficient.

> For columns that are NOT explicitly named in the query, it is best to use column
> numbers. If column names are used, the programmer should take care to guarantee
> that they uniquely refer to the intended columns, which can be assured with the
> SQL *AS* clause.

| | Index — `rs.getLong(1)` | Label — `rs.getLong("id")` |
|---|---|---|
| Robust to `SELECT` list reordering | ❌ | ✅ |
| Unambiguous with joined tables sharing column names | ✅ | ⚠️ **only with `AS` aliases** |
| Works for computed columns | ✅ | only if aliased |
| Readable in a mapper | ❌ | ✅ |

🔴 **The label trap on a join is real and silent.** `SELECT c.id, o.id FROM
customers c JOIN orders o ...` gives two columns labelled `id`, and the javadoc is
explicit that **"the value of the first matching column will be returned"** — so
`rs.getLong("id")` quietly returns the customer id where you wanted the order id.
No exception, no warning, wrong data. Alias every column in a join:

```sql
SELECT c.id AS customer_id, c.email, o.id AS order_id, o.placed_at
FROM customers c JOIN orders o ON o.customer_id = c.id
```

⚠️ **Column labels are case-insensitive** per the javadoc, which is convenient and
occasionally hides a mismatch between your Java constant and the actual alias.

⛔ **`SELECT *` makes both forms fragile.** Indexes shift when a column is added
to the table; labels become ambiguous the moment the query grows a join; and the
result set carries columns you did not want across the network. Name your columns.
It is the single highest-value habit in this whole topic.

## Read each column once, left to right

The javadoc's portability advice:

> For maximum portability, result set columns within each row should be read in
> left-to-right order, and each column should be read only once.

That reads like folklore and has a real basis: a driver streaming a row from the
network need not buffer columns it has already handed you, and for large values
(`TEXT`, `BYTEA`, a stream) re-reading may not be possible. pgJDBC is more
forgiving than the contract requires, but writing mappers in column order costs
nothing and keeps you inside the specification.

## Getting by label, index, and the JDBC 4.2 typed accessor

```java
long   id      = rs.getLong("id");
String email   = rs.getString("email");
int    col     = rs.findColumn("email");            // label → index, once
UUID   ref     = rs.getObject("reference", UUID.class);   // JDBC 4.2
```

`getObject(int, Class<T>)` — the javadoc: *"Retrieves the value of the designated
column in the current row of this `ResultSet` object and will convert from the SQL
type of the column to the requested Java data type, if the conversion is
supported"* — is the modern accessor and the one to prefer for anything that is
not a primitive or a `String`. It is how you read `java.time` values
([chunk 14](14-dates-times-and-timestamptz.md)), `UUID`s, and PostgreSQL types
with a sensible Java counterpart, and it fails loudly with an unsupported
conversion instead of silently coercing.

⚠️ **`findColumn` is the optimisation for a hot mapper**: resolve labels to indexes
once before the loop, then use indexes inside it. Worth doing when you are mapping
hundreds of thousands of rows; not worth doing otherwise.

## The lifetime: it dies with its statement

A `ResultSet` is only valid while its `Statement` and `Connection` are open. Three
things close it, two of them non-obviously:

1. `rs.close()`, or leaving its try-with-resources block.
2. **Re-executing the owning `Statement`** — a statement holds one open result at
   a time.
3. **Closing the `Statement` or the `Connection`.**

🔴 **This is the reason a `ResultSet` must never escape the method that made it.**
Returning one to a caller, or storing it, produces the classic bug: the connection
goes back to the pool, the result set is closed, and the caller gets "This
ResultSet is closed" from a line that never touched a connection. Map to your own
objects *inside* the block — [chunk 16](16-mapping-rows-to-objects.md) — and return
those. The same applies to `Stream`s built lazily over a result set: the stream
must be consumed before the block exits, or it must carry the closing with it.

⚠️ **`closeOnCompletion()`** tells a `Statement` to close itself when its dependent
result sets close. It is occasionally useful in a helper that returns a result set
it does not own, but it is a weaker discipline than try-with-resources and should
not be the primary mechanism.

## Scrollability and updatability: two features to know about and not use

`createStatement(int resultSetType, int resultSetConcurrency)` lets you ask for
`TYPE_SCROLL_INSENSITIVE` or `TYPE_SCROLL_SENSITIVE` and `CONCUR_UPDATABLE`,
giving you `previous()`, `absolute(n)`, `updateRow()` and friends.

Three reasons they are not the answer:

- **The driver usually implements scrolling by materialising the whole result in
  memory**, which is the failure mode of [chunk 15](15-fetch-size-and-streaming.md)
  turned on deliberately.
- **A forward-only result set is what enables server-side cursors and streaming**;
  asking for scrollability opts out of them. pgJDBC's cursor documentation lists
  `TYPE_FORWARD_ONLY` as a precondition explicitly.
- **`updateRow()` writes SQL you cannot see or review.** An `UPDATE` statement
  with a `WHERE` clause the driver derived is not something to have in a codebase.

Pagination is `LIMIT` and `OFFSET`, or better a keyset (`WHERE (created_at, id) <
(?, ?) ORDER BY created_at DESC, id DESC LIMIT ?`). Updates are `UPDATE`
statements. Both are visible, reviewable and indexable.

## Gotchas

**⚠️ Reading a column without calling `next()`**
**Symptom:** an exception saying the result set is not positioned on a row, on a
single-row query.
**Cause:** the cursor starts *before* the first row.
**Fix:** `if (!rs.next()) { ...not found... }` for single-row queries; a `while`
loop otherwise.

**⚠️ Two columns with the same label after a join**
**Symptom:** wrong values, silently — the customer's id where the order's id
belongs.
**Cause:** the javadoc specifies that the first matching column wins.
**Fix:** alias every column in a join with `AS`. This is not style; it is
correctness.

**⚠️ `SELECT *` with positional access**
**Symptom:** a mapper that breaks when someone adds a column to the table, in a
service nobody changed.
**Cause:** indexes shift.
**Fix:** name the columns in the `SELECT` list. You get a stable contract and less
data on the wire.

**⚠️ Returning a `ResultSet` from a method**
**Symptom:** "This ResultSet is closed" from a caller that never closed anything.
**Cause:** the statement or connection closed when the producing method's
try-with-resources block exited.
**Fix:** map inside the block and return your own objects.

**⚠️ A lazily-built `Stream` over a `ResultSet`, returned to a caller**
**Symptom:** the same closed-result-set failure, one abstraction layer further
away.
**Cause:** `Stream` is lazy; the terminal operation runs after the block exits.
**Fix:** consume it inside, or build the stream with `onClose` closing the
resources and require the caller to use it in try-with-resources.

**⚠️ Asking for a scrollable result set to "go back one row"**
**Symptom:** memory use proportional to the whole result, and streaming silently
disabled.
**Cause:** scrollability generally means materialisation, and it fails pgJDBC's
documented `TYPE_FORWARD_ONLY` precondition for cursors.
**Fix:** keep the row you need in a local variable, or re-query. One `Customer`
object is cheaper than a scrollable cursor.

## Interview questions

**★ Why does a single-row query still need `rs.next()`?**
Because a `ResultSet` is a cursor and the javadoc specifies that it starts
positioned *before* the first row; `next()` is what moves it onto a row and, at the
same time, reports whether a row exists. So `next()` does double duty — it is both
the iteration step and the emptiness check, which is why the correct single-row
idiom is `if (!rs.next()) throw new NotFound(...)` rather than reading first and
checking afterwards. There is no separate `isEmpty()` and no exception on an empty
result; the boolean is the only signal you get.

**★ Column index or column label?**
Labels, for readability and for resilience against changes in the `SELECT` list —
but only with two disciplines attached. Never `SELECT *`, because labels become
ambiguous the moment a join is added; and alias every column in a join with `AS`,
because the javadoc specifies that when several columns share a label the first
matching one wins, which turns a join between two tables that both have an `id`
into silently wrong data with no error. The javadoc does note that indexes are more
efficient, and for a mapper running over hundreds of thousands of rows the
compromise is `findColumn` once before the loop and indexes inside it.

**★ Why must a `ResultSet` never leave the method that created it?**
Because its lifetime is bounded by its `Statement` and `Connection`, and in a
pooled application the connection returns to the pool when the try-with-resources
block exits — at which point the result set is closed and every getter throws. The
caller then sees "This ResultSet is closed" from a line that never touched a
connection, which is a genuinely confusing stack trace. The same trap catches lazy
`Stream`s built over a result set, because the terminal operation runs after the
block has exited. Map to your own objects inside the block and return those, or
build the stream with an `onClose` that carries the resource closing with it.

**★ What is wrong with scrollable, updatable result sets?**
Three things. Drivers typically implement scrolling by materialising the entire
result in memory, so you have opted into the out-of-memory failure mode
deliberately. Asking for scrollability disables server-side cursors — pgJDBC's
documentation lists `TYPE_FORWARD_ONLY` as a precondition for cursor-based
fetching — so you also lose streaming. And `updateRow()` issues an `UPDATE`
statement that the driver composed and nobody reviewed, which is not a thing to
have in a codebase where SQL is expected to be readable. The alternatives are
better in every dimension: keyset pagination for navigation, explicit `UPDATE`
statements for writes.

**★ Why does the javadoc say to read columns left to right, once each?**
Because the contract is written for drivers that stream a row off the network and
need not retain columns they have already delivered — particularly for large
values like `TEXT` or `BYTEA` where the value may be consumed as a stream. Reading
out of order, or twice, is therefore not guaranteed to work even where a
particular driver tolerates it. pgJDBC is more forgiving than the contract
requires, but writing mappers in column order costs nothing and keeps the code
inside the specification, which matters the day something is run against a
different driver.

---

← Prev: [The three statement types](11-statement-types.md) · Index: [JDBC](README.md) · Next → [Nulls, primitives and `wasNull`](13-nulls-and-wasnull.md)
