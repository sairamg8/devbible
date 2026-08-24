---
title: "By default the driver reads every row into your heap before you see the first one"
sidebar_label: "15 · Fetch size and streaming"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the pgJDBC documentation *Issuing a Query and
> Processing the Result → Getting results based on a cursor* and *Connection
> Parameters* (jdbc.postgresql.org/documentation/query/,
> jdbc.postgresql.org/documentation/use/), and the JDK 25 API for
> `java.sql.Statement.setFetchSize` and `java.sql.ResultSet`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**`SELECT * FROM events` against a table with fifty million rows does not stream.
On pgJDBC, by default, the driver collects the **entire** result set into the JVM
heap before `executeQuery()` returns — before your `while (rs.next())` loop has run
once. The `ResultSet` you then iterate is an in-memory list wearing a cursor's
interface. And the obvious fix, `setFetchSize(1000)`, silently does nothing unless
three other conditions are met, the most surprising of which is that **autocommit
must be off**. This is the highest-value gotcha in the entire topic: it is easy to
hit, it produces an `OutOfMemoryError` rather than a slow query, it never
reproduces against the small table in your test database, and the fix is four lines
that almost nobody writes correctly the first time.**

## The default

pgJDBC's own documentation states it: setting fetch size to 0 causes **"all rows to
be cached (the default behaviour)"**, and by default **"the driver collects all the
results for the query at once."** The connection property `defaultRowFetchSize` is
documented with a default of **0**, described as determining **"the number of rows
fetched in `ResultSet` by one fetch with trip to the database"**.

🔴 **So the default is: one fetch, all rows.** For a hundred-row query that is
exactly right — one round trip, no cursor bookkeeping. For a fifty-million-row
report it is an `OutOfMemoryError` in the driver, before any of your code has run,
with a stack trace pointing at `executeQuery` and no mention of your query.

⚠️ **And the JDBC contract does not save you.** `Statement.setFetchSize`'s javadoc
says it *"Gives the JDBC driver a **hint** as to the number of rows that should be
fetched... If the value specified is zero, then the hint is ignored. The default
value is zero."* A hint. What a driver does with it is entirely the driver's
business, which is [chunk 1](01-what-jdbc-actually-is.md)'s point about interfaces
versus implementations, in its most expensive form.

## The four conditions, all of them required

pgJDBC lists the preconditions for cursor-based fetching, and every one must hold
or the driver silently reverts to buffering everything:

1. **"The connection to the server must be using the V3 protocol."** — true for any
   modern server; not something you need to think about.
2. 🔴 **"The `Connection` must not be in autocommit mode. The backend closes cursors
   at the end of transactions, so in autocommit mode the backend will have closed
   the cursor before anything can be fetched from it."**
3. **"The `Statement` must be created with a `ResultSet` type of
   `ResultSet.TYPE_FORWARD_ONLY`."** — the default, so you get this for free unless
   you asked for scrollability ([chunk 12](12-resultset-the-cursor-model.md)).
4. **"The query given must be a single statement, not multiple statements strung
   together with semicolons."**

**Condition 2 is the one that catches everyone**, and the documentation gives the
reason plainly: a PostgreSQL cursor is transaction-scoped, and in autocommit mode
the transaction ends when the statement completes, so there is nothing left to
fetch from. It is not a driver quirk — it is what a cursor *is* in PostgreSQL.

The documentation's own example:

```java
conn.setAutoCommit(false);
Statement st = conn.createStatement();
st.setFetchSize(50);
ResultSet rs = st.executeQuery("SELECT * FROM mytable");
while (rs.next()) {
    System.out.print("a row was returned.");
}
rs.close();
st.setFetchSize(0);  // Turn cursor off
```

## The shape to actually write

```java
try (Connection c = ds.getConnection()) {
    boolean previousAutoCommit = c.getAutoCommit();
    c.setAutoCommit(false);                       // ✅ REQUIRED for streaming
    try (PreparedStatement ps = c.prepareStatement(
                 "SELECT id, occurred_at, payload FROM events WHERE occurred_at >= ?",
                 ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
        ps.setFetchSize(2_000);
        ps.setObject(1, since);
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                handle(rs.getLong(1), rs.getObject(2, OffsetDateTime.class));
            }
        }
    }
    c.commit();                                   // a read transaction still ends
    c.setAutoCommit(previousAutoCommit);          // restore before returning to the pool
}
```

Four things in that block are load-bearing and each is skipped by somebody:

- `setAutoCommit(false)` — without it, nothing streams.
- `setFetchSize(n)` — without it, `defaultRowFetchSize` (0) applies.
- `commit()` — the transaction must end, and a long read transaction has real
  costs (**Topic 03 — long transactions** *(not written yet)*).
- **restoring autocommit** — otherwise the connection goes back to the pool with
  autocommit off, which is
  **Topic 03's killer bug** *(not written yet)*.

⚠️ **Alternatively set `defaultRowFetchSize` on the connection URL** so every
statement on that connection fetches in batches. That is a reasonable default for a
dedicated reporting `DataSource` and a bad idea for a general one, because a small
fetch size adds a round trip per batch to every short query.

## Choosing a fetch size

There is a real curve here and no universal number:

| Fetch size | Round trips | Heap per batch | Suits |
|---|---|---|---|
| 0 (default) | 1 | **everything** | small, bounded results |
| 10–100 | many | tiny | rows that are individually huge |
| 1,000–10,000 | few | moderate | the usual answer for a scan |
| very large | approaching 1 | approaching everything | nothing in particular |

⛔ I am deliberately not quoting a throughput number for any of these; there is no
database here to measure on and an invented figure would be worse than none. The
reasoning is what transfers: fetch size trades **round trips against heap**, and
the right value depends on row width, not row count. A batch of 10,000 rows each
carrying a megabyte of JSONB is 10 GB.

## The trade-off, and the alternative you should consider first

Streaming holds a transaction open for the whole scan. In PostgreSQL that means the
snapshot is held, which means vacuum cannot reclaim tuples deleted since it started
— so an hour-long streaming report contributes to table bloat on a busy table. That
is a genuine cost and it is why "just stream it" is not always the right answer.

The alternative is **keyset pagination**: bounded queries, each its own short
transaction.

```sql
SELECT id, occurred_at, payload
FROM events
WHERE (occurred_at, id) > (?, ?)
ORDER BY occurred_at, id
LIMIT 5000
```

| | Streaming cursor | Keyset pagination |
|---|---|---|
| Transaction length | the whole scan | one page |
| Snapshot consistency | ✅ a single consistent snapshot | ⚠️ rows may change between pages |
| Vacuum impact | ⚠️ holds the snapshot | none |
| Resumable after a crash | ❌ | ✅ — you hold the key |
| Needs an index | no | ✅ on the ordering columns |

🔴 **`OFFSET` is not the alternative.** `LIMIT 5000 OFFSET 500000` makes the server
produce and discard 500,000 rows, so the cost of page N grows with N and a full
walk is quadratic. Keyset pagination is `WHERE (col, id) > (?, ?)`, which an index
satisfies in constant time per page.

## Gotchas

**⚠️ `setFetchSize` with autocommit left on**
**Symptom:** `OutOfMemoryError`, or a query that appears to hang before returning
any rows, on a statement whose fetch size is visibly set.
**Cause:** pgJDBC requires autocommit off for cursor-based fetching, because a
PostgreSQL cursor is closed at transaction end.
**Fix:** `setAutoCommit(false)` around the scan, and commit afterwards.

**⚠️ An `OutOfMemoryError` whose stack trace is all driver frames**
**Symptom:** the trace points at `executeQuery` or into pgJDBC's result handling,
with none of your code visible.
**Cause:** the driver buffered the whole result before returning.
**Fix:** read it as "the result set was too big", not as a driver bug.

**⚠️ Not restoring autocommit before returning the connection**
**Symptom:** later, unrelated requests behaving as though they are inside a
transaction, or work silently not being committed.
**Cause:** autocommit is connection state and survives return to the pool.
**Fix:** restore it in a `finally`, or use a dedicated `DataSource` for scans.

**⚠️ Asking for a scrollable result set and expecting streaming**
**Symptom:** streaming silently not happening despite correct autocommit and fetch
size.
**Cause:** `TYPE_FORWARD_ONLY` is a documented precondition.
**Fix:** do not request scrollability. It was never the right feature —
[chunk 12](12-resultset-the-cursor-model.md).

**⚠️ Multiple statements separated by semicolons**
**Symptom:** the same silent fallback to buffering.
**Cause:** the documented precondition that the query be a single statement.
**Fix:** one statement per `executeQuery`.

**⚠️ A tiny `defaultRowFetchSize` set globally on the URL**
**Symptom:** every short query is measurably slower after a "streaming fix".
**Cause:** a fetch size of, say, 10 adds a round trip per ten rows to *everything*
on that connection.
**Fix:** set fetch size per statement, or use a separate `DataSource` for reporting.

**⚠️ Streaming for an hour on a busy table**
**Symptom:** table bloat and rising vacuum lag correlated with a nightly report.
**Cause:** the read transaction holds a snapshot for its whole duration.
**Fix:** keyset pagination, so each page is a short transaction.

**⚠️ `LIMIT ... OFFSET ...` for a full walk**
**Symptom:** a job whose per-page latency grows steadily until the last pages
dominate the runtime.
**Cause:** `OFFSET n` produces and discards n rows.
**Fix:** keyset pagination on an indexed ordering.

## Interview questions

**★ What does pgJDBC do by default with a query that returns ten million rows?**
It reads all ten million into the JVM heap before `executeQuery` returns. The
driver's documentation says the default behaviour is to cache all rows and that it
collects all results for the query at once, and the `defaultRowFetchSize` property
is documented with a default of 0, which means exactly that. So the `ResultSet` you
iterate is an in-memory structure with a cursor's interface, and the failure mode is
an `OutOfMemoryError` inside the driver before your loop body has executed once —
which is why the stack trace contains none of your code and why nobody suspects the
query.

**★ Why does `setFetchSize` sometimes appear to do nothing?**
Because JDBC specifies it as a *hint* — the javadoc's word — and pgJDBC only honours
it when four documented preconditions hold: the V3 protocol, autocommit off, a
`TYPE_FORWARD_ONLY` result set, and a single statement rather than several joined by
semicolons. The one that catches people is autocommit, and the reason is not a
quirk: a PostgreSQL cursor is closed at the end of the transaction, so in autocommit
mode the transaction ends when the statement completes and the cursor is gone before
anything can be fetched from it. When a precondition fails the driver does not warn;
it silently buffers everything, so the code looks right and behaves as though the
fetch size were never set.

**★ Write the correct streaming block.**
Get a connection, record and clear autocommit, create a forward-only statement, set
a fetch size in the low thousands, execute, iterate, then commit and restore
autocommit before the connection returns to the pool. Four things are load-bearing
and each gets skipped: without `setAutoCommit(false)` nothing streams; without
`setFetchSize` the default of 0 applies; without a `commit` you leave a transaction
open; and without restoring autocommit you hand the pool a connection in a
non-default state, which is the classic pooled-transaction bug. The restore is the
one that turns a local performance fix into a fleet-wide correctness problem when it
is forgotten.

**★ How would you choose a fetch size?**
By row width rather than row count, because the quantity that matters is bytes per
batch. A fetch size trades round trips against heap: 0 means one round trip and
unbounded memory, a very small value means a round trip per handful of rows, and
the useful range for an ordinary scan is roughly one to ten thousand. If each row
carries a large `bytea` or a megabyte of JSONB, ten thousand rows is gigabytes and
the right number is in the tens. I would set it per statement rather than as a
connection default, because a small `defaultRowFetchSize` on a shared connection
makes every short query pay an extra round trip.

**★ When would you use keyset pagination instead of a streaming cursor?**
When the scan is long enough that holding a transaction open is itself a problem,
or when the job needs to be resumable. A streaming cursor holds a snapshot for its
entire duration, which in PostgreSQL prevents vacuum from reclaiming tuples that
died after it started, so an hour-long report on a busy table causes bloat — and if
the job crashes at 90% you start again. Keyset pagination — `WHERE (occurred_at, id)
> (?, ?) ORDER BY occurred_at, id LIMIT n` — makes each page a short transaction and
leaves you holding a resume key. What you give up is a single consistent snapshot,
since rows can change between pages. And `OFFSET` is not a substitute for either:
the server produces and discards the skipped rows, so a full walk is quadratic.

**★ You see an `OutOfMemoryError` whose stack is entirely pgJDBC frames. What is
your first hypothesis?**
That a query returned far more data than the developer expected and the driver
buffered all of it, which is the documented default. The first thing I would look
for is a `SELECT` without a `LIMIT` over a table that has grown, or a join whose
cardinality blew up — a fan-out that turns ten thousand parents into ten million
rows. It is specifically *not* a driver bug, and it will not reproduce in a test
environment whose tables have a thousand rows. The fix is either to bound the result
in SQL or to stream it properly with autocommit off and a fetch size, and the
diagnosis is worth internalising because the stack trace deliberately points
nowhere useful.

---

← Prev: [14 · Dates, times and `timestamptz`](14-dates-times-and-timestamptz.md) · Index: [JDBC](README.md) · Next → [16 · Mapping rows to objects](16-mapping-rows-to-objects.md)
