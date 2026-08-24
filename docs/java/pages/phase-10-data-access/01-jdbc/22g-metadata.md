---
title: "`getColumnLabel` is the alias and `getColumnName` is the real column — except on PostgreSQL, where they are the same method"
sidebar_label: "22g · ResultSetMetaData: names"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.ResultSetMetaData`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/ResultSetMetaData.html)
> and `java.sql.ResultSet`, and the pgjdbc source at tag `REL42.7.13` —
> `org/postgresql/jdbc/PgResultSetMetaData.java`,
> `org/postgresql/PGResultSetMetaData.java`. JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc
> 42.7.13.

**A `ResultSet` knows what its columns are called and what type they are, and
`ResultSetMetaData` is how you ask. That is the whole feature, and it is the
foundation every framework above JDBC is built on — an ORM, a `RowMapper`, a
`ResultSet`-to-JSON serialiser and a database GUI all start by counting columns and
asking for their names. The one thing everybody gets wrong is which name to ask for.
The specification says `getColumnLabel` gives you the `AS` alias and `getColumnName`
gives you the underlying column. On pgJDBC that distinction does not exist:
`getColumnName` is implemented as `return getColumnLabel(column);`. Portable code
should still call `getColumnLabel`, because on other drivers the difference is
real — and because it is the one you actually want. This chunk is names and
nullability; types and generic mappers are
[chunk 22g2](22g2-metadata-types-and-mappers.md), and the database-wide interface is
[chunk 22g3](22g3-databasemetadata.md).**

## What it is, and the shape of every use

`ResultSet.getMetaData()` returns a `ResultSetMetaData` describing the columns of
that result. The javadoc's own example is the whole idea:

```java
ResultSet rs = stmt.executeQuery("SELECT a, b, c FROM TABLE2");
ResultSetMetaData rsmd = rs.getMetaData();
int numberOfColumns = rsmd.getColumnCount();
boolean b = rsmd.isSearchable(1);
```

Two things to notice. `getColumnCount()` — "Returns the number of columns in this
`ResultSet` object" — is the only method that does not take a column, and **every
other method is 1-based**: "the first column is 1, the second is 2, ...". That
matches `ResultSet` itself ([chunk 12](12-resultset-the-cursor-model.md)) and it is
the single most common off-by-one in JDBC code.

The metadata is available **before you call `next()`**, because it describes the
shape of the result rather than any row. A query that returns zero rows still has a
full column description.

## `getColumnLabel` versus `getColumnName`

Here are both javadocs, side by side, because the difference is the reason people
reach for the wrong one:

> **`getColumnLabel`** — "Gets the designated column's suggested title for use in
> printouts and displays. The suggested title is usually specified by the SQL `AS`
> clause. If a SQL `AS` is not specified, the value returned from `getColumnLabel`
> will be the same as the value returned by the `getColumnName` method."

> **`getColumnName`** — "Get the designated column's name."

So for `SELECT price_cents AS price FROM items`:

| Method | Intended answer |
|---|---|
| `getColumnLabel(1)` | `price` — the alias, what the query said to call it |
| `getColumnName(1)` | `price_cents` — the underlying column in the table |

🔴 **`getColumnLabel` is almost always the one you want.** Your mapper is consuming
the query *you wrote*, and the query's own vocabulary is the alias. `getColumnName`
answers a different question — "where did this come from?" — which is a schema
question, and it is only meaningful for a column that is a plain reference to a
table column. Ask it about `count(*)`, `now()`, `a || b` or a subquery's output and
there is no underlying column for it to name.

### On pgJDBC they are the same method

```java
// org.postgresql.jdbc.PgResultSetMetaData, REL42.7.13
@Override
public String getColumnLabel(int column) throws SQLException {
  Field field = getField(column);
  return field.getColumnLabel();
}

@Override
public String getColumnName(int column) throws SQLException {
  return getColumnLabel(column);
}
```

**Both return the alias.** The reason is the wire protocol: PostgreSQL's
`RowDescription` message carries the *label* for each column, and the driver has
nothing else to hand back without asking the server a second question.

The real column name is available, but only through a pgJDBC extension:

```java
org.postgresql.PGResultSetMetaData pgMeta =
        rsmd.unwrap(org.postgresql.PGResultSetMetaData.class);
String realColumn = pgMeta.getBaseColumnName(1);   // "price_cents"
String realTable  = pgMeta.getBaseTableName(1);    // "items"
```

⚠️ **`getBaseColumnName` is not free and can return `""`.** Reading the source, it
first checks `field.getTableOid() == 0` and returns `""` if so — which is the case
for every computed column, because an expression belongs to no table. Otherwise it
calls `fetchFieldMetaData()`, and that is a round trip. Which brings us to the part
that surprises people most.

## Some of these methods run a query

`fetchFieldMetaData()` in `PgResultSetMetaData` builds a `pg_catalog` join —
`pg_class`, `pg_namespace`, `pg_attribute`, `pg_type` and `pg_attrdef` — for every
column whose source table is known, and caches the answers in the connection's
field-metadata cache. **Four methods trigger it:**

| Method | Round trip? | pgJDBC's answer |
|---|---|---|
| `getColumnLabel`, `getColumnCount`, `getColumnType` | no | straight from the `RowDescription` |
| `getPrecision`, `getScale`, `getColumnDisplaySize` | no | derived locally from the type OID and type modifier |
| **`isNullable`** | **yes** | from `attnotnull`, or a domain's `typnotnull` |
| **`isAutoIncrement`** | **yes** | true if `attidentity` is set or the default matches `nextval(` |
| **`getTableName`** (= `getBaseTableName`) | **yes** | the source table's `relname`, or `""` |
| **`getBaseColumnName`** | **yes** | the source column's `attname`, or `""` |

🔴 **So `isNullable()` inside a per-row loop is a latent performance bug.** Call it
once per result, before the loop, never per row. The cache makes the second call on
the same connection cheap; the first one is a real query.

⚠️ **And `isNullable` guesses.** The source is
`return metadata == null ? ResultSetMetaData.columnNullable : metadata.nullable;` —
when there is no metadata, pgJDBC answers `columnNullable` ("this column allows
NULLs") rather than `columnNullableUnknown`. The specification offers a three-valued
answer:

| Constant | Meaning |
|---|---|
| `columnNoNulls` | "a column does not allow `NULL` values" |
| `columnNullable` | "a column allows `NULL` values" |
| `columnNullableUnknown` | "the nullability of a column's values is unknown" |

but on this driver you will effectively see the first two, with "nullable" doing
double duty as "I don't know". **Treat `columnNullable` as "not proven non-null".**
It is a safe default and a poor fact.

⛔ **Do not use `isNullable` to decide whether to call `wasNull()`.** The reason
`wasNull()` exists is that `getInt` returns `0` for SQL `NULL`
([chunk 13](13-nulls-and-wasnull.md)), and that is true regardless of what the
metadata claims. An outer join makes a `NOT NULL` column produce `NULL` rows, and
the metadata still reports the base column as non-nullable.

## Gotchas

**⚠️ Calling `getColumnName` and expecting the underlying column**
**Symptom:** a mapper that works on one database and returns aliases on PostgreSQL,
or a "schema discovery" feature that reports every column as its alias.
**Cause:** `PgResultSetMetaData.getColumnName` is literally
`return getColumnLabel(column);`.
**Fix:** if you want the alias, call `getColumnLabel` — it is correct everywhere. If
you genuinely want the source column, unwrap to `PGResultSetMetaData` and call
`getBaseColumnName`, and handle `""` for computed columns.

**⚠️ Calling `isNullable` inside the row loop**
**Symptom:** a mapper that gets dramatically slower as the result grows, with the
extra time spent in the driver rather than in your code.
**Cause:** `isNullable` calls `fetchFieldMetaData()`, which issues a `pg_catalog`
join the first time. The connection's cache absorbs repeats, but you have still
turned metadata into per-row work.
**Fix:** hoist every metadata call above the loop. Metadata describes the result, not
the row.

**⚠️ Trusting `isNullable` for a column in an outer join**
**Symptom:** a mapper that reads a primitive without checking, and silently produces
`0` or `false` for a missing row.
**Cause:** the metadata describes the *base column's* constraint. `LEFT JOIN`
produces `NULL` for a `NOT NULL` column when there is no matching row.
**Fix:** use `wasNull()` or the boxed accessors ([chunk 13](13-nulls-and-wasnull.md)).
Nullability of a projection is a property of the query, not of the table.

**⚠️ Reading `columnNullable` as "the database says this is nullable"**
**Symptom:** a schema report that marks columns nullable when they are declared
`NOT NULL`.
**Cause:** pgJDBC returns `columnNullable` when it has no metadata at all, rather
than `columnNullableUnknown` — the safe answer standing in for the unknown one.
**Fix:** treat it as "not proven non-null". If you need the truth, read the catalog
yourself or query `information_schema.columns`.

**⚠️ Off-by-one on the column index**
**Symptom:** `SQLException` about a column index out of range on the last column, or
silently reading the wrong column.
**Cause:** every `ResultSetMetaData` accessor is 1-based — "the first column is 1" —
while the array you are filling is 0-based.
**Fix:** write the loop as `for (int i = 1; i <= n; i++)` and index arrays with
`i - 1`, consistently, as in the mapper above.

**⚠️ Calling `getMetaData()` once per row**
**Symptom:** avoidable allocation and, on some drivers, avoidable work.
**Cause:** the metadata is a property of the result, not of the cursor position, so
asking again inside the loop can only ever return the same thing.
**Fix:** fetch it once before the loop.

## Interview questions

**★ What is the difference between `getColumnLabel` and `getColumnName`, and which
should you use?**
By the specification, `getColumnLabel` is "the designated column's suggested title
for use in printouts and displays… usually specified by the SQL `AS` clause", and it
falls back to the column name when there is no alias; `getColumnName` is "the
designated column's name", meaning the underlying table column. So for
`SELECT price_cents AS price`, the label is `price` and the name should be
`price_cents`. Use `getColumnLabel` for essentially everything, because a mapper
consumes the query you wrote and the query's vocabulary is the alias — and because
`getColumnName` has no sensible answer for a computed column like `count(*)`. The
twist worth knowing is that on pgJDBC the distinction does not exist:
`PgResultSetMetaData.getColumnName` is implemented as `return getColumnLabel(column);`,
because PostgreSQL's `RowDescription` message carries the label and nothing else. The
underlying name is reachable only through the driver extension
`PGResultSetMetaData.getBaseColumnName`, which issues a catalog query and returns
`""` for expression columns.

**★ Which `ResultSetMetaData` calls are cheap and which are not?**
Anything that comes off the `RowDescription` the server already sent is free —
`getColumnCount`, `getColumnLabel`, `getColumnType`, and the size-related methods
that pgJDBC derives locally from the type OID and modifier. Four are not:
`isNullable`, `isAutoIncrement`, `getTableName` and the extension
`getBaseColumnName` all call `fetchFieldMetaData()`, which builds a join across
`pg_class`, `pg_namespace`, `pg_attribute`, `pg_type` and `pg_attrdef` for the
columns whose source table is known and caches the result on the connection. So the
first such call on a new query shape is a round trip. The practical rule is that
metadata describes the result rather than any row, so every metadata call belongs
above the loop, resolved once into arrays — which is what you should be doing for
correctness and readability anyway.

**★ Why does `isNullable` return three values, and what does pgJDBC actually give
you?**
The three constants are `columnNoNulls`, `columnNullable` and
`columnNullableUnknown`, because a driver may genuinely not know — the result column
might be an expression, or from a source the driver cannot introspect. pgJDBC does
try: `isNullable` fetches the catalog metadata and reports nullability from the
column's `attnotnull`, or from a domain's `typnotnull` for domain types. But when no
metadata is available its fallback is
`metadata == null ? columnNullable : metadata.nullable`, so it answers "nullable"
where the honest answer would be "unknown". That makes `columnNullable` mean "not
proven non-null" in practice, which is safe but weak. And there is a deeper problem
that no driver can fix: nullability of a *projection* is not nullability of a
*column*. A `LEFT JOIN` makes a `NOT NULL` column produce `NULL`, and the metadata
still reports the base constraint. So `isNullable` is a hint for tooling, never a
substitute for `wasNull()`.

**★ Why does pgJDBC collapse `getColumnName` into `getColumnLabel` — is that a bug?**
No, it is the protocol showing through. When PostgreSQL describes a result it sends a
`RowDescription` message carrying, for each column, the *label* the query produced —
the alias if there was one, otherwise the column's own name — along with the type OID,
the type modifier, and the source table OID and attribute number when the column is a
plain table reference. There is no separate "original name" field. So a driver that
wanted to answer `getColumnName` differently from `getColumnLabel` would have to go
back to the server and join the catalog, on every query, for a method most callers do
not want. pgJDBC's choice is to make the standard method cheap and correct-for-the-
common-case, and to expose the expensive truthful answer as a documented extension:
`PGResultSetMetaData.getBaseColumnName`, which does exactly that catalog lookup and
returns `""` when the column has no source table. Knowing this stops you writing
portable-looking code that quietly means something different on each driver.

**★ You need the real table and column behind a result column — say, to build an
editable grid. How do you get it, and what breaks?**
Unwrap the metadata to `org.postgresql.PGResultSetMetaData` and call
`getBaseTableName` and `getBaseColumnName`. Both go through `fetchFieldMetaData()`,
which joins `pg_class`, `pg_namespace`, `pg_attribute`, `pg_type` and `pg_attrdef` for
every column with a known source table and caches the answers on the connection — so
budget one round trip per new query shape, not per row. What breaks: any column that
is not a direct table reference has a source table OID of zero, and the driver returns
`""` for it, which covers `count(*)`, `a || b`, `now()`, a `CASE` expression and
anything from a subquery or a `UNION`. You also lose portability, since this is a
pgJDBC interface rather than JDBC. And the answer still does not tell you whether a
write would be *allowed* — `isReadOnly` is a hardcoded `false` on this driver — so the
grid needs its own model of what is editable.

---
← Prev: [22f4 · The operator's tools](22f4-the-operators-tools.md) · Index: [JDBC](README.md) · Next → [22g2 · Types and mappers](22g2-metadata-types-and-mappers.md)
