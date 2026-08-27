---
title: "`DatabaseMetaData` exists so a tool can discover a database it has never seen — and your application is not that tool"
sidebar_label: "22g3 · DatabaseMetaData"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.DatabaseMetaData`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/DatabaseMetaData.html)
> and `java.sql.Connection`, and the pgjdbc source at tag `REL42.7.13` —
> `org/postgresql/jdbc/PgDatabaseMetaData.java`. JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**`Connection.getMetaData()` describes the database as a whole: product name and
version, which SQL features it supports, and — through methods returning
`ResultSet`s — its catalogs, schemas, tables, columns, keys and indexes. It is
essential to a *tool*: a database GUI, a schema differ, an ORM's reverse engineer.
The javadoc says as much: "A user for this interface is commonly a tool that needs to
discover how to deal with the underlying DBMS." Your application is not that tool — it
knows its schema at build time, and a migration tool owns how that schema changes. And
the hundred-odd `supportsXxx()` methods that promise portability through runtime
feature detection mostly report what the driver's author decided to say.**

## What it is for, in the specification's own words

The interface description is unusually candid about its audience:

> "This interface is implemented by driver vendors to let users know the capabilities
> of a Database Management System (DBMS) in combination with the driver based on JDBC
> technology ("JDBC driver") that is used with it… Information returned by methods in
> this interface applies to the capabilities of a particular driver and a particular
> DBMS working together."

> "A user for this interface is commonly a tool that needs to discover how to deal
> with the underlying DBMS. This is especially true for applications that are
> intended to be used with more than one DBMS. For example, a tool might use the
> method `getTypeInfo` to find out what data types can be used in a `CREATE TABLE`
> statement."

Four families of method live behind it:

| Family | Examples | Returns |
|---|---|---|
| Identity | `getDatabaseProductName`, `getDatabaseProductVersion`, `getDriverName`, `getJDBCMajorVersion` | `String` / `int` |
| Feature support | `supportsGetGeneratedKeys`, `supportsTransactionIsolationLevel`, `supportsBatchUpdates` | `boolean` |
| Limits and syntax | `getMaxConnections`, `getIdentifierQuoteString`, `getSQLKeywords`, `getSearchStringEscape` | `String` / `int` |
| Schema discovery | `getTables`, `getColumns`, `getPrimaryKeys`, `getImportedKeys`, `getIndexInfo`, `getTypeInfo` | **`ResultSet`** |

## The schema-discovery methods, and their pattern arguments

The last family is the useful one, and it has a calling convention worth learning
once:

```java
DatabaseMetaData md = conn.getMetaData();

try (ResultSet rs = md.getColumns(null, "public", "orders", null)) {
    while (rs.next()) {
        System.out.println(rs.getString("COLUMN_NAME") + " " + rs.getString("TYPE_NAME"));
    }
}
```

Five rules govern those calls, all of them from the javadoc:

- **`null` means "do not filter on this".** "If a search pattern argument is set to
  `null`, that argument's criterion will be dropped from the search." `null` for the
  catalog is normal on PostgreSQL, where the catalog is the database you are on.
- **Pattern arguments are SQL `LIKE` patterns, not literals.** "Within a pattern
  String, `%` means match any substring of 0 or more characters, and `_` means match
  any one character." Watch which parameters are named `…Pattern`: `getColumns` takes
  a `schemaPattern` and a `columnNamePattern`, so `order_items` also matches
  `orderXitems`.
- **Escape wildcards with `getSearchStringEscape()`**, which "retrieves the string
  that can be used to escape wildcard characters". pgJDBC returns `\`, with a source
  comment noting it deliberately no longer returns a doubled backslash because the
  value belongs in a `PreparedStatement` parameter or a `DatabaseMetaData` argument,
  not pasted into SQL.
- **Unavailable metadata is an empty `ResultSet`, never `null`** — "If a given form of
  metadata is not available, an empty `ResultSet` will be returned." Loop; do not
  null-check.
- **Vendor columns are addressed by label.** Extra driver-defined columns "must be
  accessed by their **column label**", which makes this the one place where
  [chunk 22g](22g-metadata.md)'s preference for labels is a requirement.

⚠️ **These are queries, and some are big ones.** `getColumns` on a database with
thousands of tables joins the catalog and returns a row per column, and
`getSQLKeywords` runs a `pg_get_keywords()` query carrying a several-kilobyte literal
exclusion list of SQL:2003 keywords — the source comment calls it "ugly but required
by jdbc spec" — caching the answer afterwards. Treat every `DatabaseMetaData` call as
a round trip until proven otherwise, and never put one on a request path.

## The feature-detection methods do not deliver portability

This is the claim worth arguing, because "write to `DatabaseMetaData` and your code
runs anywhere" is a promise the interface makes and does not keep.

Read what pgJDBC actually returns at `REL42.7.13`:

| Method | pgJDBC returns | Comment |
|---|---|---|
| `getIdentifierQuoteString()` | `"` | correct and useful |
| `getSearchStringEscape()` | `\` | correct and useful |
| `supportsTransactionIsolationLevel(int)` | `true` for all four JDBC levels | ⚠️ PostgreSQL accepts all four names but implements only three distinct behaviours — `READ UNCOMMITTED` behaves as `READ COMMITTED` |
| `supportsGetGeneratedKeys()` | `true`, with the source noting "We don't support returning generated keys by column index" | a `true` that is not the whole truth ([chunk 20](20-generated-keys.md)) |
| `getMaxConnections()` | **hardcoded `8192`** | not the server's `max_connections`, which the driver never asks about |
| `getSuperTypes(...)` | throws `notImplemented` | some methods are simply absent |

🔴 **`getMaxConnections()` is the clearest example.** The javadoc says it "retrieves
the maximum number of concurrent connections to this database that are possible".
pgJDBC returns `8192` whatever `max_connections` is set to — so any capacity planning
built on it is planning against a number nobody chose.

The pattern generalises. A `boolean` flattens a nuanced reality into yes or no, the
flattening is done by whoever wrote the driver, and even an accurate answer tells you
a feature *exists*, never that it behaves the way your code assumes.

⛔ **So "portable code" built on runtime feature detection usually is not portable.**
What works is unglamorous: pick your databases explicitly, write the dialect
differences by hand, and test against each. That is what every mature ORM does under
its `Dialect` abstraction — a hand-maintained class per database, not a runtime
interrogation.

⚠️ **The identity methods are the exception, and worth using.**
`getDatabaseProductName()` (pgJDBC hardcodes `"PostgreSQL"`) and
`getDatabaseProductVersion()` (the real server version) are ideal for a startup
assertion and for a log line that removes an entire class of "which database was it
actually talking to?" investigation.

## Where metadata belongs in an application

The rule that survives contact with real systems:

🔴 **Your schema is known at build time. Discovering it at runtime is almost always
the wrong answer.** You wrote the `CREATE TABLE`, it is in the repository, and a
migration tool — Flyway, Liquibase — owns how it changes. Introspecting it at startup
buys nothing the repository does not already tell you, while adding a round trip, a
new failure mode, and branches for shapes you hope never occur.

```java
// A reasonable use: a one-line startup assertion, not a schema discovery pass.
DatabaseMetaData md = conn.getMetaData();
log.info("db={} {} driver={} {}",
         md.getDatabaseProductName(), md.getDatabaseProductVersion(),
         md.getDriverName(),          md.getDriverVersion());
if (md.getDatabaseMajorVersion() < 14) {
    throw new IllegalStateException("PostgreSQL 14+ required");
}
```

Metadata genuinely *is* the right tool in three situations:

1. **Generic tooling.** A GUI, an export utility, a schema differ, an admin console —
   anything whose job is a database it has never seen.
2. **A query runner.** Where the user supplies the SQL you cannot know the result
   shape ([chunk 22g2](22g2-metadata-types-and-mappers.md)).
3. **A mapper facing a runtime-chosen projection.** A reporting layer that builds the
   `SELECT` list from user-chosen fields genuinely varies per call.

Everything else — mapping a query you wrote to a class you wrote — is
[chunk 16](16-mapping-rows-to-objects.md), hand-written and compile-time checked.

## Gotchas

**⚠️ Passing a table name containing `_` to `getTables` or `getColumns`**
**Symptom:** metadata for tables you did not ask about — `order_items` matching
`orderXitems` too.
**Cause:** arguments named `…Pattern` are `LIKE` patterns: `_` matches any one
character, `%` any substring.
**Fix:** escape with `getSearchStringEscape()` (pgJDBC returns `\`), or filter after.

**⚠️ Null-checking the `ResultSet` from a `DatabaseMetaData` method**
**Symptom:** a `null` branch that never executes, and a caller that never handles the
genuinely empty case.
**Cause:** the javadoc says "If a given form of metadata is not available, an empty
`ResultSet` will be returned."
**Fix:** always loop; treat zero rows as the "not available" signal.

**⚠️ Reading vendor-specific columns by index**
**Symptom:** an off-by-one that only appears against one driver, or breaks on a driver
upgrade.
**Cause:** drivers may add columns beyond the specified ones, and those "must be
accessed by their column label".
**Fix:** read every `DatabaseMetaData` result by label.

**⚠️ `getMaxConnections()` used for capacity planning**
**Symptom:** a pool sized from a number that has nothing to do with the server.
**Cause:** pgJDBC returns a hardcoded `8192` and never asks for `max_connections`.
**Fix:** `SHOW max_connections` if you need it, and size the pool from measurement
anyway ([chunk 4](04-connection-is-expensive.md)).

**⚠️ `supportsGetGeneratedKeys()` read as "every form works"**
**Symptom:** `getGeneratedKeys` by column *index* failing on a driver that reported
support.
**Cause:** one bit for a feature with several shapes. pgJDBC's source says outright
"We don't support returning generated keys by column index" and returns `true` anyway.
**Fix:** treat every `supportsXxx` as "some form exists" and verify the specific form
you use ([chunk 20](20-generated-keys.md)).

**⚠️ Calling `getColumns` or `getTables` on a request path**
**Symptom:** a request that is fast on a small test database and slow in production.
**Cause:** these are catalog queries whose cost scales with the number of objects.
**Fix:** call them at startup if at all, cache the result, and never let a user action
trigger one.

**⚠️ Runtime schema discovery instead of migrations**
**Symptom:** an application that inspects the catalog at startup and adapts, which
nobody can reason about because the code path depends on the database's state.
**Cause:** treating the schema as discovered rather than owned.
**Fix:** let Flyway or Liquibase own it, fail fast if the version is not what you
expect, and write code against the schema you shipped.

## Interview questions

**★ What is `DatabaseMetaData` for, and why is it usually the wrong thing to build an
application on?**
It describes the database and driver as a pair — product and version strings, feature
support flags, syntax and limit values, and methods returning `ResultSet`s over
catalogs, schemas, tables, columns, keys and indexes. The javadoc names its audience
precisely: "A user for this interface is commonly a tool that needs to discover how to
deal with the underlying DBMS. This is especially true for applications that are
intended to be used with more than one DBMS." That is a GUI, a schema differ, an ORM's
reverse engineer. An ordinary application is the opposite case: it knows its schema,
because it wrote the `CREATE TABLE` statements and checked them in, and a migration
tool owns how they change. Discovering that at runtime adds a round trip, a new
failure mode, and branches for shapes you hope never occur, in exchange for
information you already had. Worth keeping are the identity methods — logging the
product and version, and asserting a minimum version at startup.

**★ How do the search-string arguments to `getTables` and `getColumns` work?**
Three rules. `null` drops a criterion entirely — "If a search pattern argument is set
to `null`, that argument's criterion will be dropped from the search" — which is the
normal value for the catalog argument on PostgreSQL. Arguments whose names end in
`Pattern` are SQL `LIKE` patterns, not literals: "`%` means match any substring of 0 or
more characters, and `_` means match any one character", so a table named `order_items`
will also match `orderXitems` unless you escape it. And the escape string comes from
`getSearchStringEscape()`, which pgJDBC returns as a single backslash, with a source
comment explaining the value is intended for a `PreparedStatement` parameter or a
`DatabaseMetaData` argument rather than for pasting into SQL. Two contract details
round it out: a form of metadata that is unavailable yields an empty `ResultSet` rather
than `null`, and driver-specific extra columns "must be accessed by their column
label".

**★ Is `DatabaseMetaData` a route to database portability?**
Not in practice, and the reason is structural rather than a failing of any one driver.
Every `supportsXxx()` method compresses a nuanced behaviour into one bit, and who
decides the value is whoever wrote the driver — with no obligation to revisit it when
either the database or the specification moves. pgJDBC returns `true` from
`supportsTransactionIsolationLevel` for all four JDBC levels, although PostgreSQL
accepts `READ UNCOMMITTED` only by treating it as `READ COMMITTED`; it returns `true`
from `supportsGetGeneratedKeys` while the source comment beside it says "We don't
support returning generated keys by column index"; and `getMaxConnections()` is a
hardcoded `8192` that has nothing to do with the server's `max_connections`. Even a
correct answer only tells you a feature exists, never that it behaves the way your
code assumes. What actually delivers portability is the unglamorous approach every
mature ORM takes: a hand-written dialect per supported database, and a test suite that
runs against each of them.

**★ You need a report screen where the user picks which columns to show. Where does
metadata belong in that design?**
In exactly one place: reading the result. The `SELECT` list is assembled at runtime, so
the result shape genuinely varies per call, and `ResultSetMetaData` is the only thing
that can describe it — count the columns, resolve `getColumnLabel` once into an array,
and read values by index with `getObject`
([chunk 22g2](22g2-metadata-types-and-mappers.md)). Where metadata does *not* belong is
deciding what the user may pick. That list should come from an allow-list you control,
mapping a stable field id to a column expression and an alias, because it is also your
injection boundary — a user-chosen column name concatenated into SQL is the exact
problem [chunk 5](05-preparedstatement-and-injection.md) exists to prevent, and it
cannot be a bind parameter. So: a hand-maintained catalogue of permitted fields going
in, and `ResultSetMetaData` coming out.

**★ What would you actually call `DatabaseMetaData` for in a production service?**
Very little, and deliberately. One startup log line recording
`getDatabaseProductName()`, `getDatabaseProductVersion()`, `getDriverName()` and
`getDriverVersion()`, which removes a whole genre of "which database and driver was it
really talking to?" investigation during an incident. Possibly one assertion beside it
— refuse to start if `getDatabaseMajorVersion()` is below what your SQL requires —
turning a mysterious runtime syntax error into a clear startup failure. Beyond that,
nothing on a request path: `getTables` and `getColumns` are catalog queries whose cost
scales with the schema, and `getSQLKeywords` issues a query carrying a multi-kilobyte
list of keywords to exclude. If a feature genuinely needs schema information, fetch it
once at startup and cache it — and first ask why it is not in the repository beside
the migrations that created it.

**★ Both `getMetaData()` methods are called "metadata". What is the difference?**
`ResultSet.getMetaData()` describes one result — column count, labels, types. It is
scoped to a query you just ran, most of it is free because the server already sent a
row description, and it is what a generic mapper is built on
([chunk 22g](22g-metadata.md)). `Connection.getMetaData()` describes the database and
driver as a whole: version strings, feature flags, and catalog listings of tables,
columns, keys and indexes. It is scoped to the connection, its useful methods are
catalog queries, and its audience is tooling. The practical difference is how often
you should reach for each: `ResultSetMetaData` whenever the result shape is genuinely
unknown, which recurs; `DatabaseMetaData` in a tool, and in an application usually
only for a startup log line and a version assertion.

---
← Prev: [22g2 · Types and mappers](22g2-metadata-types-and-mappers.md) · Index: [JDBC](README.md) · Next → [Topic 02 · Connection pooling with HikariCP](../02-connection-pooling/README.md)
