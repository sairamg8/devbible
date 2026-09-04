---
title: "Writes are where jOOQ's SQL-first stance pays off most bluntly, because an upsert, a returning clause and an insert-select are all one statement each rather than a load-mutate-flush cycle"
sidebar_label: "05 · Writes"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *INSERT .. ON DUPLICATE KEY*
> ([insert-on-duplicate-key](https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/insert-statement/insert-on-duplicate-key/)),
> *Batch execution*
> ([sql-execution/batch-execution](https://www.jooq.org/doc/latest/manual/sql-execution/batch-execution/))
> and *Transaction management*
> ([sql-execution/transaction-management](https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**An ORM writes by loading an object graph, mutating it, and letting a flush work out the
statements. jOOQ writes by issuing the statement. That sounds like a downgrade until you count the
things it makes trivial: an upsert without a read, an update over a million rows without loading
one, an insert-select that never leaves the database, and a `RETURNING` clause that hands you the
generated row in the same round trip.**

## `INSERT`

```java
create.insertInto(ORDER, ORDER.CUSTOMER_ID, ORDER.STATUS, ORDER.TOTAL)
      .values(customerId, "PENDING", total)
      .execute();
```

`execute()` returns the affected row count. **Multiple rows are one statement**, not a loop:

```java
create.insertInto(ORDER_LINE, ORDER_LINE.ORDER_ID, ORDER_LINE.SKU, ORDER_LINE.QUANTITY)
      .values(orderId, "SKU-1", 2)
      .values(orderId, "SKU-2", 1)
      .execute();
```

And **insert-select never brings the data to Java at all**:

```java
create.insertInto(ORDER_ARCHIVE)
      .select(select(ORDER.fields()).from(ORDER).where(ORDER.PLACED_AT.lt(cutoff)))
      .execute();
```

That last one is the shape an ORM cannot express without loading every row it is about to write
back, and it is one of the strongest single arguments for having SQL available.

## `RETURNING` — the generated row, in the same round trip

```java
OrderRecord created =
    create.insertInto(ORDER, ORDER.CUSTOMER_ID, ORDER.STATUS)
          .values(customerId, "PENDING")
          .returning()
          .fetchOne();
```

PostgreSQL supports `RETURNING` natively, so this is one statement — no `getGeneratedKeys`
dance, no follow-up `SELECT`, and you can return any expression, not just the key. `returning()`
with no arguments returns the whole row; `returning(ORDER.ID)` returns just that column.

⚠️ **The `fetchOne()` cautions from [03e · Fetching](03e-fetching.md) apply here too** — a
returning insert that inserted several rows and is fetched with `fetchOne()` throws.

## Upsert: `onDuplicateKeyUpdate`

```java
create.insertInto(INVENTORY, INVENTORY.SKU, INVENTORY.QUANTITY)
      .values(sku, quantity)
      .onDuplicateKeyUpdate()
      .set(INVENTORY.QUANTITY, quantity)
      .execute();
```

**On PostgreSQL — and Aurora PostgreSQL, CockroachDB and YugabyteDB — jOOQ renders this as
`ON CONFLICT … DO UPDATE`.** Elsewhere it is emulated with `MERGE`: DB2, Exasol, Firebird, H2,
HANA, HSQLDB, Oracle, Redshift, Snowflake, SQL Server, Sybase and Teradata.

🔴 **It is unsupported** on ASE, Access, BigQuery, ClickHouse, Databricks, Informix,
SQLDataWarehouse, Spanner, Trino and Vertica. If cross-dialect portability is a goal, that list is
the constraint.

`onDuplicateKeyIgnore()` is the `DO NOTHING` counterpart, and `mergeInto(...)` is available where
you want to write the `MERGE` yourself.

**The reason this matters beyond convenience:** an upsert done as "select, then insert or update"
is a race in every isolation level below serializable, and the fix is a single atomic statement.
That is a correctness argument, not a performance one — the conversation
**[Topic 03 · JDBC transactions](../03-jdbc-transactions/README.md)** sets up.

## `UPDATE` and `DELETE`

```java
create.update(ORDER)
      .set(ORDER.STATUS, "CANCELLED")
      .set(ORDER.CANCELLED_AT, OffsetDateTime.now())
      .where(ORDER.ID.eq(orderId))
      .and(ORDER.STATUS.eq("PENDING"))
      .execute();

create.deleteFrom(SESSION)
      .where(SESSION.EXPIRES_AT.lt(OffsetDateTime.now()))
      .execute();
```

**Two things worth naming.** The extra `and(ORDER.STATUS.eq("PENDING"))` is a conditional update:
the row count tells you whether the transition was legal, with no read and no race. And the
`DELETE` above removes an unbounded number of rows in one statement — a set operation an
entity-per-row model has to express as a query plus a loop.

`update(...).set(...).from(...)` and correlated subqueries in `set(...)` are both available, which
is how "set each order's total from its lines" stays one statement.

## Batching

Two documented modes:

- **Several distinct statements in one batch** — `create.batch(q1, q2, q3).execute()`.
- **One statement with many bind value sets** — `create.batch(query).bind(...).bind(...)`.

🔴 **The second mode has a documented sharp edge**, and it is worth quoting: *"When creating a
batch execution with a single query and multiple bind values, you will still have to provide jOOQ
with dummy bind values for the original query… For subsequent calls to `bind()`, there will be no
type safety provided by jOOQ."*

**So batching is the one place in jOOQ where the compile-time guarantee is explicitly off.** The
template query is type-checked; the bind sets that follow are `Object...`. That is a real trade,
and it is the reason to keep batch code short and close to its query.

`batchStore()`, `batchInsert()`, `batchUpdate()` and `batchDelete()` are the record-oriented
equivalents — **[05b · UpdatableRecords](05b-updatable-records.md)**.

## Gotchas

**★ Forgetting `execute()` writes nothing.** The statement is a value until it is executed, exactly
as a `SELECT` is a value until it is fetched. A built-and-discarded `UPDATE` compiles, passes
review and silently does nothing — the single most common jOOQ write bug.

**★ An `UPDATE` or `DELETE` with no `where(...)` is legal and hits every row.** Nothing in the API
objects. jOOQ can be configured to require a `WHERE` clause on these statements; on a codebase
where anyone runs ad-hoc code, turning that on is cheap insurance.

**★ `onDuplicateKeyUpdate` is unsupported on ten dialects.** Not emulated — unsupported. Building
on it commits you to the PostgreSQL/MySQL/MERGE-capable family.

**★ `ON CONFLICT` needs a conflict target the database can identify.** It resolves against a unique
constraint or index; without one, the statement fails at runtime. jOOQ cannot check that for you
because the constraint is a database object, not a column type.

**★ `returning()` on a multi-row insert returns multiple rows.** `fetchOne()` then throws
`TooManyRowsException`. Use `fetch()` and take the result you meant.

**★ Batch bind values are untyped.** The manual says it outright. A `Long` where an `Integer` was
expected becomes a runtime failure, in a code path that is typically exercised only under load.

**★ A batch that fails part-way leaves a partial result unless it is in a transaction.** Batching
is a round-trip optimisation, not an atomicity mechanism —
**[07 · Transactions and Spring](07-transactions-and-spring.md)** is where atomicity comes from.

**★ Multi-row `values(...)` is one statement, and there is a practical ceiling.** Bind parameter
limits and statement size are real; ten rows is fine, a hundred thousand in one statement is not.
Batch, or use a `COPY`-style bulk path.

**★ `execute()` returns a row count that people do not check.** For a conditional update it is the
*result* — zero means the precondition failed. Ignoring it turns a detectable failure into a
silent one.

**★ Writes bypass every cache in front of the database.** There is no persistence context to
invalidate and none to help you. Anything cached above jOOQ is now stale, which is
[Topic 12 · Caching](../12-caching/README.md)'s problem and worth knowing exists.

**★ An insert-select that archives rows does not delete them.** Obvious written down, and the
usual source of a duplicate-archive incident when the follow-up `DELETE` is in a separate
transaction from the `INSERT`.

**★ `now()` in Java and `now()` in SQL are different clocks.** `OffsetDateTime.now()` binds the
application server's time; `DSL.currentTimestamp()` renders the database's. Mixing them across a
codebase produces timestamps that do not order correctly.

## Interview questions

**★ How does writing with jOOQ differ from writing with an ORM?** jOOQ issues the statement; an ORM
mutates objects and lets a flush derive statements. So jOOQ can express set-based writes — mass
updates, insert-selects, upserts — without loading rows, and it gives you no dirty checking in
exchange.

**★ How do you get a generated key back?** `returning()` on the insert, then a fetch.
PostgreSQL supports `RETURNING` natively, so it is the same round trip and can return any
expression, not just the key.

**★ How do you write an upsert, and what does it render on PostgreSQL?**
`insertInto(...).values(...).onDuplicateKeyUpdate().set(...)`, which renders `ON CONFLICT … DO
UPDATE` on PostgreSQL, Aurora PostgreSQL, CockroachDB and YugabyteDB, and is emulated with `MERGE`
on about a dozen others.

**★ Why is an upsert better than "select, then insert or update"?** Because the read-then-write
version is a race below serializable isolation — two requests both see no row and both insert. A
single atomic statement removes the window entirely.

**★ Where is `onDuplicateKeyUpdate` unsupported?** ASE, Access, BigQuery, ClickHouse, Databricks,
Informix, SQLDataWarehouse, Spanner, Trino and Vertica. Not emulated on those — unsupported.

**★ What are jOOQ's two batching modes?** Several distinct queries batched together, and one query
template executed with many sets of bind values.

**★ What guarantee do you lose when batching?** Type safety on the bind values. The manual is
explicit: after the template query, *"there will be no type safety provided by jOOQ"* for
subsequent `bind()` calls, and you must supply dummy bind values for the template.

**★ Does batching make the writes atomic?** No. It reduces round trips. Atomicity comes from the
transaction the batch runs in, and a batch outside one can fail half-way.

**★ You wrote an update and nothing changed. Two things to check.** Whether `execute()` was called
at all, and what row count it returned — a conditional update whose predicate no longer matches
returns zero, which is information rather than an error.

**★ What stops an accidental `UPDATE` with no `WHERE` clause?** Nothing in the API by default;
jOOQ has a setting that requires a `WHERE` clause on `UPDATE` and `DELETE`, and enabling it is
worth the small friction on any codebase where ad-hoc statements get written.

**★ How would you set every order's total from its lines, in one statement?** An `UPDATE` with a
correlated subquery in `set(...)`, or `update(...).set(...).from(...)`. No rows come to Java, and
the whole thing is one round trip.

**★ Why is `DSL.currentTimestamp()` sometimes the right choice over `OffsetDateTime.now()`?**
Because it is the database's clock rather than the application server's. When several services
write timestamps that must be comparable, one clock is a design decision and two is a bug waiting
for a clock skew.

{/* FOOTER */}
