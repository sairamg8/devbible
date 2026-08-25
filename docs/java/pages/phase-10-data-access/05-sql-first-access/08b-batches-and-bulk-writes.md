---
title: "`JdbcClient` has no batch method on purpose, so bulk writes drop to `JdbcTemplate` — and the array it returns is not a list of row counts"
sidebar_label: "8b · Batches and bulk"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JdbcOperations.batchUpdate` javadoc and the
> `JdbcClient` javadoc
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/JdbcOperations.java)),
> the `SimpleJdbcInsert` javadoc
> ([docs.spring.io/.../simple/SimpleJdbcInsert.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/SimpleJdbcInsert.html)),
> the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*, and the JDK
> 25 `java.sql.Statement` API
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18, pgJDBC 42.7.x.

**`JdbcClient`'s javadoc says outright that batch inserts and stored procedure calls
"may use those lower-level template classes directly, or alternatively
`SimpleJdbcInsert` and `SimpleJdbcCall`". That is not an oversight — a batch has a
shape a single fluent chain cannot express, because the parameters vary per entry.
So bulk writing in a `JdbcClient` codebase means keeping a `JdbcTemplate` or a
`NamedParameterJdbcTemplate` injected alongside it, and knowing three things about
the array that comes back.**

## The four batch APIs

| Call | Parameters supplied by | Returns |
|---|---|---|
| `jdbcTemplate.batchUpdate(String, List<Object[]>)` | a list of argument arrays | `int[]` |
| `jdbcTemplate.batchUpdate(String, BatchPreparedStatementSetter)` | a callback per index | `int[]` |
| `jdbcTemplate.batchUpdate(String, Collection<T>, int batchSize, ParameterizedPreparedStatementSetter<T>)` | a callback per object, **chunked** | `int[][]` |
| `namedJdbcTemplate.batchUpdate(String, SqlParameterSource[])` | one parameter source per entry | `int[]` |

The named-parameter form is usually the nicest in a modern codebase, because
`SqlParameterSource` can come straight from your records:

```java
SqlParameterSource[] batch = actors.stream()
        .map(SimplePropertySqlParameterSource::new)
        .toArray(SqlParameterSource[]::new);

namedJdbcTemplate.batchUpdate(
        "insert into actor (first_name, last_name) values (:firstName, :lastName)",
        batch);
```

The **chunked** variant is the one to reach for on a large import. It takes a
`batchSize` and returns `int[][]` — one inner array per chunk — because the whole
batch is otherwise resident in your heap before anything leaves the JVM, which is
**[Sizing a batch](../01-jdbc/19e-sizing-a-batch.md)**.

## The return array is not a list of row counts

The javadoc is careful, and most code is not:

> "an array containing the numbers of rows affected by each update in the batch
> (may also contain special JDBC-defined negative values for affected rows such as
> `java.sql.Statement.SUCCESS_NO_INFO` / `java.sql.Statement.EXECUTE_FAILED`)"

`SUCCESS_NO_INFO` is `-2` and `EXECUTE_FAILED` is `-3`. So
`Arrays.stream(counts).sum()` is not the number of rows written, and
`counts[i] == 1` is not a reliable test that entry *i* landed.

🔴 **On pgJDBC inside a transaction, a failed batch reports `EXECUTE_FAILED` for
every entry — including the ones that succeeded** — and it is right to, because the
transaction is going to be rolled back anyway. That is
**[When a batch fails](../01-jdbc/19b-when-a-batch-fails.md)**, and it means the
array cannot be used to work out which entry was the bad one. If you need to know,
you need a different strategy: bisect the batch, or validate before sending.

🔴 **And if `reWriteBatchedInserts=true` is set, the counts are thrown away
entirely.** The driver collapses many single-row inserts into fewer multi-row ones,
so there is no longer a one-to-one correspondence between entries and statements —
**[Insert rewriting](../01-jdbc/19c-insert-rewriting.md)**. Turning on the single
highest-leverage performance flag and then reading the counts is a contradiction.

## `SimpleJdbcInsert`

The one place Spring does generate SQL for you. Its javadoc:

> "A `SimpleJdbcInsert` is a multi-threaded, reusable object providing easy (batch)
> insert capabilities for a table. It provides meta-data processing to simplify the
> code needed to construct a basic insert statement."

```java
private final SimpleJdbcInsert insertActor;

JdbcActorRepository(DataSource dataSource) {
    this.insertActor = new SimpleJdbcInsert(dataSource)
            .withTableName("actor")
            .usingGeneratedKeyColumns("id");
}

public long insert(NewActor actor) {
    return insertActor
            .executeAndReturnKey(new SimplePropertySqlParameterSource(actor))
            .longValue();
}
```

Two things to know before adopting it.

**It reads `DatabaseMetaData`.** The javadoc: "The meta-data processing is based on
the `DatabaseMetaData` provided by the JDBC driver. As long as the JDBC driver can
provide the names of the columns for a specified table then we can rely on this
auto-detection feature. If that is not the case, then the column names must be
specified explicitly." That is a real round trip to the database on first use, and
metadata calls are not always cheap or well-behaved —
**[`DatabaseMetaData`](../01-jdbc/22g3-databasemetadata.md)**.

**`usingGeneratedKeyColumns` is what makes `executeAndReturnKey` legal.** The
javadoc says the method "requires that the name of the columns with auto generated
keys have been specified" — and naming them is also what keeps you off the
`RETURNING *` path from [chunk 8](08-writes-and-generated-keys.md).

It is "multi-threaded, reusable", so build it once in the constructor, like a
`JdbcTemplate`.

## When a batch is still the wrong tool

For genuinely large loads, `COPY` beats a prepared, batched, single-transaction
`INSERT` — that is PostgreSQL's own claim, argued in
**[COPY instead of batching](../01-jdbc/19h-copy-instead-of-batching.md)**. Reaching
it from Spring is `jdbcTemplate.execute(ConnectionCallback)` and pgJDBC's
`CopyManager`, which keeps connection handling and exception translation while
giving you the driver-specific API. `JdbcClient` has no route to it, which is
another reason to keep a `JdbcTemplate` around.

## Gotchas

**Summing the returned `int[]` is not the number of rows written.** The array may
contain `-2` (`SUCCESS_NO_INFO`) and `-3` (`EXECUTE_FAILED`). Code that sums it to
report "imported N rows" will report a smaller number, or a negative one, and the
first time anybody notices is when a report is wrong.

**A batch is one transaction's worth of locks.** Every row a batch touches is locked
until the transaction ends, and the cost is the *length* of the transaction rather
than the size of any lock table —
**[Locks and long transactions](../01-jdbc/19g-locks-and-long-transactions.md)**.
A 100,000-row batch inside one transaction is a long time to hold them.

**`batchUpdate` does not start a transaction.** Like every other `JdbcTemplate`
call it joins one if there is one and runs under autocommit if there is not. Under
autocommit each *statement* commits, which for a batch means a partially applied
import that cannot be undone. Batches belong inside an explicit `@Transactional`
boundary essentially always.

**The chunked overload returns `int[][]`, and code copied from the two-argument form
will not compile — or worse, will.** `int[] counts = jdbcTemplate.batchUpdate(sql,
items, 500, setter);` is a compile error, which is fine. The trap is the reverse:
switching *from* the chunked form to the flat one to "simplify", and losing the
chunking that was keeping the heap bounded.

**`SimpleJdbcInsert` hides the SQL, which is the thing this whole topic said to
own.** It is genuinely convenient for a plain insert into a table with many columns.
It is also the one component here that generates SQL from metadata, so a column
added by a migration silently becomes part of every insert. Use it deliberately, not
as the default.

**`SimpleJdbcInsert` needs the table name in whatever case the metadata uses.**
Because the lookup goes through `DatabaseMetaData`, identifier folding matters:
PostgreSQL stores unquoted identifiers lower-cased, so `withTableName("Actor")` may
find nothing. Use the lower-case name, and do not quote identifiers in migrations.

**Batching and generated keys fight each other.** Asking for keys appends
`RETURNING`, which disables `reWriteBatchedInserts`; and even where keys do come
back, pgJDBC's batch key result set is "not guaranteed to line up with your batch" —
**[Generated keys from a batch](../01-jdbc/19d-generated-keys-from-a-batch.md)**. If
you are bulk inserting and need the ids, assign them in Java.

## Interview questions

**★ Why does `JdbcClient` have no `batchUpdate`?**
Because a batch is a different shape from the chain. `JdbcClient` binds one set of
parameters to one statement and then executes; a batch binds *N* sets to one
statement, which needs either a collection of parameter sources or a per-index
callback, and neither fits a single fluent chain naturally. The javadoc says so
directly, pointing at "those lower-level template classes directly, or
alternatively `SimpleJdbcInsert` and `SimpleJdbcCall`". In practice you inject both
a `JdbcClient` and a `NamedParameterJdbcTemplate` and use the second for bulk work.

**★ What does the `int[]` from `batchUpdate` actually contain?**
Row counts per entry, *or* one of two JDBC-defined negative sentinels: `-2`
`SUCCESS_NO_INFO`, meaning the statement succeeded but the driver cannot say how
many rows it affected, and `-3` `EXECUTE_FAILED`, meaning that entry failed. The
javadoc says so explicitly. On PostgreSQL there are two further complications: if
the batch fails inside a transaction, pgJDBC marks *every* entry `EXECUTE_FAILED`,
including ones that succeeded, because the whole transaction is doomed; and if
`reWriteBatchedInserts` is on, the counts are discarded because the driver has
merged statements. So the array is much less useful than it looks.

**★ How do you bulk insert a million rows from a Spring application?**
Not with a single `batchUpdate`. First, chunk: use the
`batchUpdate(sql, collection, batchSize, setter)` overload, because the entire batch
is resident in the JVM before anything is sent, so batch size is a memory decision
before it is a performance one. Second, keep each chunk in its own transaction if
partial progress is acceptable, because one long transaction holds locks and blocks
vacuum for its whole duration. Third, turn on `reWriteBatchedInserts` and accept
losing the row counts. And past a certain size, stop batching and use `COPY` through
pgJDBC's `CopyManager`, reached via `jdbcTemplate.execute(ConnectionCallback)` —
PostgreSQL's own documentation says it beats batched inserts.

**★ What is `SimpleJdbcInsert` and when would you use it?**
A metadata-driven insert helper: you give it a table name and a map or parameter
source of column values, and it builds the `INSERT` by reading column names from
`DatabaseMetaData`. It is reusable and thread-safe, so it is built once in the
constructor. It is genuinely nice for a wide table where writing out thirty column
names twice is pure noise, and `executeAndReturnKey` handles the generated key
provided you called `usingGeneratedKeyColumns`. The reservations are that it costs a
metadata round trip and that it generates SQL from the live schema, so a column
added by a migration quietly joins every insert.

**★ Does a batch run in a transaction?**
Only if one is already open. `batchUpdate` behaves like every other `JdbcTemplate`
call: it obtains its connection through `DataSourceUtils`, so it joins a Spring
transaction if there is one and otherwise runs on a pooled connection in autocommit
mode. Under autocommit each statement in the batch commits independently, so a
failure halfway through leaves the earlier rows written and unrecoverable. A batch
should essentially always be inside an explicit transaction boundary, and the size
of the batch then becomes a question about how long you are willing to hold the
locks.

**★ If a batch fails, how do you find out which entry was bad?**
Not from the return array, at least not on PostgreSQL inside a transaction — pgJDBC
reports `EXECUTE_FAILED` for every entry, so the array tells you nothing about
position. The `BatchUpdateException` carries update counts too, and Spring's
`SQLStateSQLExceptionTranslator` unwraps it to reach the nested SQLSTATE, so you
learn *what* went wrong. To learn *where*, the practical approaches are to validate
the input before sending, or to bisect: re-run the batch in halves until you isolate
the entry. That is slow, which is a good argument for validating up front.

---

← Prev: [8 · Writes and keys](08-writes-and-generated-keys.md) · Index: [SQL-first access](README.md) · Next → [9 · The connection](09-transactions-and-the-connection.md)
