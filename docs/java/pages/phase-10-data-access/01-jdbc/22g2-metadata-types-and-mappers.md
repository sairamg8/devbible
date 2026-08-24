---
title: "The type methods answer three different questions, and the ones pgJDBC hardcodes tell you about the driver, not the database"
sidebar_label: "22g2 · Types and mappers"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.ResultSetMetaData` and
> `java.sql.ResultSet`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/ResultSetMetaData.html),
> and the pgjdbc source at tag `REL42.7.13` —
> `org/postgresql/jdbc/PgResultSetMetaData.java`,
> `org/postgresql/jdbc/TypeInfoCache.java`. JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**[Chunk 22g](22g-metadata.md) covered what a column is called. This one covers what
it *is*, and what `ResultSetMetaData` is actually indispensable for. Three separate
methods answer three separate type questions, and picking the wrong one is how a
generic mapper ends up with a `switch` it does not need. Then there is a group of
methods — `isReadOnly`, `isWritable`, `getSchemaName`, `isSearchable` — that pgJDBC
answers with a constant, because answering honestly would cost a catalog lookup on
every query. Those constants are worth knowing individually, and worth generalising
from: **JDBC metadata describes what the driver decided to say.** The payoff at the
end is the twenty-line generic row mapper that every framework above JDBC contains.**

## Types: three questions, three methods

```java
int    sqlType   = rsmd.getColumnType(i);        // java.sql.Types.NUMERIC
String dbType    = rsmd.getColumnTypeName(i);    // "numeric"
String javaClass = rsmd.getColumnClassName(i);   // "java.math.BigDecimal"
```

- **`getColumnType`** — "Retrieves the designated column's SQL type", returning an
  `int` "from `java.sql.Types`". This is the portable, lossy answer: every
  PostgreSQL `int4` is `Types.INTEGER`, and so is every other database's 32-bit
  integer.
- **`getColumnTypeName`** — "Retrieves the designated column's database-specific
  type name… If the column type is a user-defined type, then a fully-qualified type
  name is returned." Not portable, and precise. This is where `jsonb`, `inet`,
  `tsvector` and your own enum types actually appear.
- **`getColumnClassName`** — "the fully-qualified name of the Java class whose
  instances are manufactured if the method `ResultSet.getObject` is called". This
  is the one a generic mapper wants, because it answers "what will I get back?"
  rather than "what is it called?".

⚠️ **pgJDBC's `getColumnTypeName` reports `serial`, and no such type exists.**
Reading the source, when the column is auto-increment it returns `serial` for
`int4`, `bigserial` for `int8` and `smallserial` for `int2`. Those are `CREATE TABLE`
conveniences, not real PostgreSQL types — the column really is an `int4` with a
sequence default. Convenient for a schema-dumping tool, wrong if you feed the string
back into a `CAST`.

### The mapping table is in the driver, and it has surprises

pgJDBC keeps a static table in `TypeInfoCache.java` mapping each built-in PostgreSQL
type to a `java.sql.Types` constant and a Java class name. Reading it at `REL42.7.13`:

| PostgreSQL type | `getColumnType` | `getColumnClassName` |
|---|---|---|
| `int4` | `Types.INTEGER` | `java.lang.Integer` |
| `text`, `varchar` | `Types.VARCHAR` | `java.lang.String` |
| `numeric` | `Types.NUMERIC` | `java.math.BigDecimal` |
| **`bool`** | **`Types.BIT`** — not `Types.BOOLEAN` | `java.lang.Boolean` |
| **`money`** | **`Types.DOUBLE`** | `java.lang.Double` |
| **`bytea`** | `Types.BINARY` | **`[B`** — the JVM name for `byte[]` |
| `timestamptz` | `Types.TIMESTAMP` | `java.sql.Timestamp` |
| **`json`, `jsonb`** | **`Types.OTHER`** | `org.postgresql.util.PGobject` |
| `point`, `box` | `Types.OTHER` | `org.postgresql.geometric.PGpoint` / `PGBox` |

Anything not in that table — `uuid`, `inet`, `tsvector`, your own enums and composite
types — is resolved through the catalog and lands on `Types.OTHER` as well.

🔴 **So `getColumnType` cannot distinguish `jsonb` from `inet` from a custom enum.**
They are all `OTHER`. If a feature needs to know, it has to read `getColumnTypeName`,
which returns the real PostgreSQL name. And `timestamptz` mapping to
`Types.TIMESTAMP` erases exactly the distinction [chunk 14](14-dates-times-and-timestamptz.md)
spends a whole page on.

## The methods pgJDBC simply makes up

Several `ResultSetMetaData` methods are unanswerable without work no driver wants to
do on every query, and the honest way to read pgJDBC is that it returns a plausible
constant:

| Method | pgJDBC 42.7.13 returns | Reality |
|---|---|---|
| `getSchemaName` | `""` always | the schema *is* knowable via `getBaseSchemaName`, but the JDBC method does not do the lookup |
| `getCatalogName` | `""` always | PostgreSQL's catalog is the database; the driver declines |
| `isReadOnly` | `false` always | it would have to check `GRANT`s |
| `isWritable` | `!isReadOnly(column)` — so `true` always | follows from the above |
| `isDefinitelyWritable` | follows `isWritable` | the source comment says "I cannot tell is the short answer" |
| `isSearchable` | `true` always | almost true in PostgreSQL, and not checked |
| `isCurrency` | type name is `cash` or `money` | genuinely computed |

🔴 **This is the concrete evidence for a claim
[chunk 22g3](22g3-databasemetadata.md) makes in general**: runtime feature detection
through JDBC metadata mostly does not tell you about the database. It tells you what
the driver's author decided to return.

## What it is genuinely for: the generic mapper

Everything above is prologue to the one thing `ResultSetMetaData` is indispensable
for — handling a result whose shape you do not know at compile time.

```java
/** Turns any ResultSet into a list of maps. This is what a query runner does. */
static List<Map<String, Object>> toMaps(ResultSet rs) throws SQLException {
    ResultSetMetaData md = rs.getMetaData();
    int n = md.getColumnCount();

    String[] labels = new String[n];               // resolve labels ONCE
    for (int i = 1; i <= n; i++) {
        labels[i - 1] = md.getColumnLabel(i);      // label, not name
    }

    List<Map<String, Object>> rows = new ArrayList<>();
    while (rs.next()) {
        Map<String, Object> row = new LinkedHashMap<>(n);
        for (int i = 1; i <= n; i++) {
            row.put(labels[i - 1], rs.getObject(i));   // by index inside the loop
        }
        rows.add(row);
    }
    return rows;
}
```

Three deliberate choices, and they are the whole pattern. **Labels are resolved once,
outside the loop**, because doing it per row multiplies the work by the row count.
**Values are read by index inside the loop**, which the `ResultSet` javadoc notes is
more efficient than by label ([chunk 12](12-resultset-the-cursor-model.md)).
**`getObject(int)` does the type dispatch**, so the mapper never needs a `switch` on
`getColumnType` — the driver already knows what class to manufacture.

This is, in outline, what Spring's `ColumnMapRowMapper`, every `ResultSet`-to-JSON
helper, and the guts of a database GUI all do. What it is *not* is how you map rows
to a domain object you already have a class for — that is hand-written and explicit
([chunk 16](16-mapping-rows-to-objects.md)), because a known shape does not need
discovering.

## Gotchas

**⚠️ Feeding `getColumnTypeName` back into SQL**
**Symptom:** a generated `CAST(… AS serial)` that fails.
**Cause:** pgJDBC returns `serial`, `bigserial` or `smallserial` for auto-increment
integer columns. Those are `CREATE TABLE` shorthands, not types.
**Fix:** map them back (`serial` → `int4`) before generating SQL, or use
`getColumnType` and `java.sql.Types` for anything portable.

**⚠️ Using `isWritable` or `isDefinitelyWritable` to decide anything**
**Symptom:** an editable grid that lets the user type into a computed column.
**Cause:** pgJDBC returns `true` for both, unconditionally, because `isReadOnly`
returns `false` unconditionally. The source comment on `isDefinitelyWritable` says
"I cannot tell is the short answer".
**Fix:** decide writability from your own schema knowledge, not from the driver.

**⚠️ Expecting `getSchemaName` or `getCatalogName` to be populated**
**Symptom:** qualified names that come out as `..items`.
**Cause:** both return `""` in pgJDBC, and the javadoc explicitly permits "schema
name or `""` if not applicable".
**Fix:** unwrap to `PGResultSetMetaData.getBaseSchemaName` if you must have it, and
accept the catalog query that costs.

**⚠️ Using `getColumnType` to detect a PostgreSQL-specific type**
**Symptom:** a serialiser that treats `jsonb`, `inet`, `tsvector` and a custom enum
identically, usually as an opaque string.
**Cause:** `java.sql.Types` has no member for any of them, so pgJDBC maps all of them
to `Types.OTHER`.
**Fix:** branch on `getColumnTypeName`, which returns the database's own name, and
keep `getColumnType` for the portable cases only.

**⚠️ Switching on `Types.BOOLEAN` for a PostgreSQL `bool` column**
**Symptom:** a branch that never fires, with boolean columns falling into a default
case.
**Cause:** the driver's static table maps `bool` to `Types.BIT`, not `Types.BOOLEAN`.
`getColumnClassName` still correctly says `java.lang.Boolean`.
**Fix:** prefer `getColumnClassName` — or just `getObject`, which returns the right
object without any switch at all.

**⚠️ Duplicate labels collapsing in a map-based mapper**
**Symptom:** `SELECT c.id, o.id FROM customers c JOIN orders o …` produces a map with
one `id` key and the second value silently overwriting the first.
**Cause:** `Map.put` replaces; the metadata reports two columns both labelled `id`,
and nothing warns you. This is the same trap [chunk 12](12-resultset-the-cursor-model.md)
describes for `getLong("id")`, arriving from the other direction.
**Fix:** alias every column in a join, and — if the mapper must survive careless SQL —
detect a duplicate label while building the label array and fail loudly rather than
losing a column.

**⚠️ Passing `getColumnClassName` to `Class.forName` and expecting a source-level name**
**Symptom:** confusion when a `bytea` column reports `[B`.
**Cause:** the method returns the fully-qualified JVM class name, and for a byte array
that is `[B`. `Class.forName("[B")` works; printing it in a report does not read well.
**Fix:** it is a machine-readable name — use it for lookups, translate it for display.

## Interview questions

**★ Write a method that turns any `ResultSet` into a list of maps, and justify each
choice.**
Get the metadata once before the loop, read `getColumnCount()`, and resolve every
`getColumnLabel(i)` into an array — labels, not names, and once rather than per row,
because per-row resolution multiplies a fixed cost by the row count. Then loop with
`rs.next()`, and inside it read values by **index** with `rs.getObject(i)`, because
the `ResultSet` javadoc notes index access is more efficient than label access and
because `getObject` performs the type dispatch for you, so you never need a `switch`
on `getColumnType`. Use a `LinkedHashMap` sized to the column count so column order
is preserved, which matters the moment anyone renders it. Every index runs from 1 to
n inclusive, with `i - 1` into your own arrays. That method is, in outline, what a
query runner, a `ResultSet`-to-JSON serialiser and a database GUI all contain — and
it is deliberately not how you map to a known domain class, which should be
hand-written and explicit.

**★ Why do so many `ResultSetMetaData` methods return constants in pgJDBC, and what
should you conclude?**
Because answering them honestly would cost more than the answers are worth. `isReadOnly`
would mean checking `GRANT`s for the current role on every query; `getSchemaName` and
`getCatalogName` would mean a catalog lookup for information the query already told
you; `isSearchable` is nearly always true in PostgreSQL. So the driver returns
`false`, `""`, `""` and `true` respectively, and `isWritable` is defined as
`!isReadOnly`, which makes it unconditionally true. The source comment on
`isDefinitelyWritable` is refreshingly direct: "I cannot tell is the short answer."
The conclusion is not that pgJDBC is sloppy — these are reasonable choices — but that
JDBC metadata is a description of what the driver chose to say, not an oracle about
the database. Any feature built on runtime introspection needs to know which calls
are real, which are derived, and which are constants, and that is a per-driver fact
you have to look up rather than assume.

**★ You are told to add a feature that discovers a result's columns and types at
runtime. When is that the right design?**
When the shape genuinely is not known until runtime: a query runner or admin console
where the user types the SQL, an export tool that must serialise any result, a
reporting layer where the projection is assembled from user-chosen fields, or a
generic diagnostic that dumps a result set. In all of those the metadata is the only
source of truth available, and `getColumnLabel` plus `getObject` handles it in a
dozen lines. When it is *not* right is the far more common case — mapping a query
you wrote to a class you wrote. There the shape is known at compile time, the
compiler can check it, and introspecting it at runtime buys nothing while adding a
catalog round trip and a class of silent failures where a renamed alias stops
matching. The rule of thumb: metadata is for code that does not know the query, and
almost all application code does know its queries.

**★ Which of the three type methods would you use to build a `ResultSet`-to-JSON
serialiser, and why?**
Mostly none of them, and that is the point. `getObject(i)` already returns the object
the driver decided to manufacture, so the serialiser can hand that to a JSON library
and be done — `getColumnClassName` merely tells you in advance what that object's
class will be, which is useful for validating assumptions rather than for dispatch.
Where you do need a type method is the awkward PostgreSQL types: `getColumnType`
collapses `json`, `jsonb`, `point`, `box`, `uuid`, `inet` and every custom enum into
`Types.OTHER`, so it cannot tell them apart, while `getColumnTypeName` returns the
database's own name and can. A practical serialiser therefore uses `getObject` for
everything, checks `getColumnTypeName` for the handful of cases it wants to treat
specially — emitting `jsonb` as embedded JSON rather than a quoted string, for
instance — and never writes a `switch` over `java.sql.Types`.

**★ `getColumnClassName` says `java.math.BigDecimal`. Can you rely on getting exactly
that class?**
Not exactly, and the javadoc says so: it returns "the fully-qualified name of the Java
class whose instances are manufactured if the method `ResultSet.getObject` is called",
and adds that "`ResultSet.getObject` may return a subclass of the class returned by
this method". So it is an upper bound on the type, suitable for an `instanceof` check
or a `Class.isAssignableFrom`, not for an equality comparison on class names. Two
related wrinkles on pgJDBC: the name is a JVM binary name, so a `bytea` column reports
`[B` rather than anything you would write in source; and the class named is the one
`getObject` with no type argument produces, which is not necessarily the class you
would get from the JDBC 4.2 `getObject(int, Class<T>)` overload, where you are the one
naming the target type ([chunk 12](12-resultset-the-cursor-model.md)).

---
← Prev: [22g · ResultSetMetaData: names](22g-metadata.md) · Index: [JDBC](README.md) · Next → [22g3 · DatabaseMetaData](22g3-databasemetadata.md)
