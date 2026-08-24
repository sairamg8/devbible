---
title: "The generated-keys result set is an ordinary cursor, and the clause underneath it is one you are allowed to write yourself"
sidebar_label: "20b · Reading keys, writing RETURNING"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html);
> the pgJDBC source at github.com/pgjdbc/pgjdbc — `jdbc/PgStatement.java`,
> `jdbc/PgConnection.java`, `core/Parser.java`, `core/SqlCommand.java`; the
> pgJDBC *Connection Parameters* page (jdbc.postgresql.org/documentation/use/);
> and the PostgreSQL 18 manual — *Returning Data from Modified Rows*
> (postgresql.org/docs/18/dml-returning.html) and *INSERT*
> (postgresql.org/docs/18/sql-insert.html).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 20](20-generated-keys.md) established that on PostgreSQL the
generated-keys API is a thin, slightly lossy wrapper over a `RETURNING` clause the
driver writes for you. This chunk is the other half: how to read what comes back,
and what happens when you stop letting the driver write the clause and write it
yourself. Two things are worth knowing before the code. First, the returned object
is an entirely ordinary `ResultSet` — same cursor rules, same close discipline,
same null handling — and it is documented never to be null but very much allowed
to be empty. Second, the clause the driver writes is one you are
allowed to write yourself, and doing so buys precision at the cost of
portability — including the ability to return computed columns and arbitrary
expressions, which the keys API has no way to request. Mixing the two styles is
where the surprising errors live, and the mechanism that explains those errors is
also the mechanism that makes `executeUpdate()` plus `getGeneratedKeys()` work at
all. [Chunk 20c](20c-returning-beyond-insert.md) takes it further, to `UPDATE`,
`DELETE` and batches.**

## Name the columns, and mind the quoting

The recommended shape, carried over from the previous chunk:

```java
try (PreparedStatement ps = c.prepareStatement(
        "INSERT INTO orders (customer_id, total_cents) VALUES (?, ?)",
        new String[] { "id" })) {
    ps.setLong(1, customerId);
    ps.setInt(2, totalCents);
    ps.executeUpdate();
    try (ResultSet keys = ps.getGeneratedKeys()) {
        if (!keys.next()) throw new IllegalStateException("insert produced no key");
        return keys.getLong(1);
    }
}
```

⚠️ **The column name is quoted by default.** `quoteReturningIdentifiers` defaults
to `true` and the parser calls `Utils.escapeIdentifier`, so `{"id"}` is emitted as
`RETURNING "id"`. Quoted identifiers in PostgreSQL are case-**sensitive** while
unquoted ones fold to lower case — so a column created as `id` is `"id"`, and
passing `{"ID"}` produces `RETURNING "ID"`, which does not exist. The parameter
exists because, as the driver documentation puts it, "There are some ORM's that
quote everything, including returning columns If we quote them, then we end up
sending `""colname""` to the backend instead of `"colname"` which will not be
found." Pass the name exactly as the column is stored — normally lower case.

## Reading the keys: an ordinary `ResultSet`, with ordinary rules

Everything from [chunk 12](12-resultset-the-cursor-model.md) applies — the cursor
starts *before* the first row so you must call `next()`, it is forward-only, and it
belongs to its statement, so [chunk 17](17-resource-handling.md)'s
try-with-resources applies too. Three properties are specific to it.

**It is never null.** The javadoc says "If this `Statement` object did not generate
any keys, an empty `ResultSet` object is returned", and pgJDBC implements that
literally:

```java
if (generatedKeys == null || generatedKeys.getResultSet() == null) {
  return createDriverResultSet(new Field[0], new ArrayList<>());
}
```

An empty result set over an empty field array — zero rows *and* zero columns. Do
not null-check it; call `next()` and treat `false` as a real outcome, because
[chunk 20c](20c-returning-beyond-insert.md) shows an everyday
statement that produces exactly that.

**It has one row per row the statement actually affected.** A single-row insert
gives one row; a multi-row `VALUES` list gives one each; a batch gives one per
batch entry that inserted something. Note the wording — *affected*, not
*attempted*.

**Label lookup is only as reliable as what you asked for.** With named columns,
`keys.getLong("id")` is safe and self-documenting. With `RETURN_GENERATED_KEYS`
you are reading `RETURNING *`, whose column order is the table's, so `getLong(1)`
is a bet on a migration never happening. Use positional access only when you named
exactly one column, and labels everywhere else. The nullability discipline from
[chunk 13](13-nulls-and-wasnull.md) applies unchanged — a generated key should
never be null, but the other columns of a `RETURNING *` certainly can be, so
`getObject(col, Integer.class)` rather than `getInt` for those.

## Writing `RETURNING` yourself is usually the better answer

Everything above is JDBC's portable façade over a PostgreSQL feature. You can use
the feature directly:

```java
static final String SQL = """
        INSERT INTO orders (customer_id, total_cents)
        VALUES (?, ?)
        RETURNING id, created_at, status
        """;

try (PreparedStatement ps = c.prepareStatement(SQL)) {
    ps.setLong(1, customerId);
    ps.setInt(2, totalCents);
    try (ResultSet rs = ps.executeQuery()) {
        if (!rs.next()) throw new IllegalStateException("insert produced no row");
        return ORDER_STUB.map(rs);          // an ordinary RowMapper, chunk 16
    }
}
```

That is `executeQuery` on a plain `prepareStatement`, and the result is an ordinary
result set consumed by an ordinary mapper
([chunk 16](16-mapping-rows-to-objects.md)). Compared with the generated-keys API
it wins on four counts: the SQL says what comes back, so nobody has to know what
the driver appends; you can return computed and defaulted columns, not just keys;
you can return *expressions*, which the keys API has no way to request; and there
is no second API in the codebase. The manual makes the general case — "Use of
`RETURNING` avoids performing an extra database query to collect the data, and is
especially valuable when it would otherwise be difficult to identify the modified
rows reliably" — and the specific one: "when using a `serial` column to provide
unique identifiers, `RETURNING` can return the ID assigned to a new row."

What you give up is portability. `RETURNING` is PostgreSQL (and a handful of
others); `getGeneratedKeys()` is the standard. If the code must run on more than
one database, use the API. If it will only ever run on PostgreSQL, the honest
position is that the API is a worse spelling of the same thing.

## The two styles do not mix silently

If you write your own `RETURNING` clause and then call `executeUpdate()` on a
statement prepared *without* the keys flag, pgJDBC's `checkNoResultUpdate` walks
the result chain and throws:

```java
throw new PSQLException(GT.tr("A result was returned when none was expected."),
    PSQLState.TOO_MANY_RESULTS);
```

Conversely, if you *do* pass the flag, the driver notices your existing clause —
`addReturning` returns early on `if (isReturningPresent || ...)`, so it does not
append a second one — and sets `wantsGeneratedKeysAlways`, which lifts the
returned rows out of the result chain into the `generatedKeys` slot before that
check runs:

```java
if (wantsGeneratedKeysOnce || wantsGeneratedKeysAlways) {
  generatedKeys = currentResult;
  result = castNonNull(currentResult, "handler.getResults()").getNext();
  ...
}
```

That lifting *is* the mechanism by which `executeUpdate()` followed by
`getGeneratedKeys()` works at all: the rows are moved aside, the update count
behind them stays in the chain, and the no-result check finds nothing to complain
about. It also means `prepareStatement(sqlWithReturning, RETURN_GENERATED_KEYS)`
is a legitimate hybrid — your clause, read through the standard API — and it is the
least confusing way to migrate a codebase in either direction.

⚠️ **The detection is textual, and historically imperfect.** The driver decides
"is a `RETURNING` keyword already present?" by parsing your SQL, and pgJDBC has
had to fix that parse more than once — early versions appended `RETURNING *`
unconditionally, producing a statement with two clauses, and a later version could
be confused by a *column name* containing the word. It is correct in current
releases, but it is worth knowing that this is pattern matching over your SQL text
rather than a protocol-level flag.

## Gotchas

**⚠️ Passing an upper-case or mixed-case column name**
**Symptom:** `ERROR: column "ID" does not exist`, from a statement you never wrote.
**Cause:** `quoteReturningIdentifiers` defaults to `true`, so the name is emitted
quoted, and quoted identifiers are case-sensitive while unquoted ones fold to
lower case.
**Fix:** pass the name exactly as stored. Only set `quoteReturningIdentifiers=false`
if some other layer is already quoting.

**⚠️ Reading `getGeneratedKeys()` without calling `next()`**
**Symptom:** `SQLException` complaining the result set is not positioned on a row.
**Cause:** it is an ordinary `ResultSet`; the cursor starts before the first row.
**Fix:** `if (!keys.next()) throw ...` — and mean it, because `false` happens.

**⚠️ Null-checking the returned `ResultSet`**
**Symptom:** dead code, and a missing branch for the case that actually occurs.
**Cause:** the contract is "an empty `ResultSet` object is returned", never null,
and pgJDBC builds one over `new Field[0]`.
**Fix:** check `next()`, not `!= null`.

**⚠️ Reading position 1 from a `RETURNING *` result**
**Symptom:** a key that is suddenly a timestamp, weeks after a migration.
**Cause:** positional access into a result whose shape is the table's shape.
**Fix:** name the columns you want. That also removes the transfer cost, which is
why it is the fix worth remembering.

**⚠️ Letting the keys `ResultSet` escape the statement's scope**
**Symptom:** "This ResultSet is closed" in a caller that received it from a
repository method.
**Cause:** the keys result set is owned by the statement, exactly like a query's,
so closing the statement closes it.
**Fix:** read the value inside the try-with-resources and return the value, not the
cursor — the same rule as [chunk 16](16-mapping-rows-to-objects.md)'s helpers.

**⚠️ Calling `getGeneratedKeys()` on a statement prepared without the flag**
**Symptom:** an empty result set from an insert that definitely inserted a row.
**Cause:** the flag is what causes the clause to be appended and the rows to be
captured; a plain `prepareStatement(sql)` captures nothing.
**Fix:** prepare with the `String[]` overload. This is a compile-clean, run-quiet
mistake, which is why the empty-not-null contract matters.

**⚠️ Hand-written `RETURNING` plus `executeUpdate()`**
**Symptom:** `PSQLException: A result was returned when none was expected.`
**Cause:** the statement was prepared without the keys flag, so the returned rows
stay in the result chain and `checkNoResultUpdate` finds them.
**Fix:** either `executeQuery()`, or prepare with `RETURN_GENERATED_KEYS` so the
driver moves the rows into the generated-keys slot.

## Interview questions

**★ What exactly does `getGeneratedKeys()` return, and how do you read it safely?**
An ordinary `ResultSet`, never null — the contract is that "if this `Statement`
object did not generate any keys, an empty `ResultSet` object is returned", and
pgJDBC implements that by constructing a result set over an empty field array,
zero rows and zero columns. So the cursor starts before the first row and you must
call `next()`, treating `false` as a real outcome rather than an impossibility; it
is forward-only; and it is owned by its statement, so it must be closed with the
statement and must not outlive it. It carries one row per row the statement
actually affected — affected, not attempted, which is the distinction that bites
with upserts. Read it by label when you named the columns, and be suspicious of
positional reads against `RETURNING *`, because those positions are the table's
column order and that is a thing migrations change.

**★ When would you write `INSERT ... RETURNING` by hand instead of using the API?**
Whenever the code is PostgreSQL-only, which in practice is most services. The
hand-written clause states in the SQL exactly what comes back, so nobody has to
know what the driver appends; it can return defaulted and trigger-computed columns
and arbitrary expressions, which the keys API cannot request at all; and it is
consumed by `executeQuery` and an ordinary `RowMapper`, so there is no second API
in the codebase. PostgreSQL 18 widens the gap further by allowing `OLD.col` and
`NEW.col` in the returning list, unreachable through an API that only takes column
names. What you give up is portability — `getGeneratedKeys()` is the standard and
`RETURNING` is not — so the API earns its place in code that must run on more than
one database. The middle position, passing a `String[]` of names, is a reasonable
default: standard API, stated columns.

**★ What happens if you mix the two — a hand-written `RETURNING` and
`executeUpdate()`?**
It depends entirely on whether the statement was prepared with the keys flag. If
it was not, the returned rows stay in the driver's result chain and
`checkNoResultUpdate` throws `A result was returned when none was expected.` with
`PSQLState.TOO_MANY_RESULTS`. If it was, the driver detects your existing clause
and does not append a second one — `addReturning` returns early when a `RETURNING`
keyword is already present — and sets `wantsGeneratedKeysAlways`, which causes the
first result to be lifted out of the chain into the `generatedKeys` field before
that check runs. That lifting is the whole mechanism by which `executeUpdate()`
followed by `getGeneratedKeys()` works, and knowing it explains both the error and
the two fixes: use `executeQuery`, or prepare with the flag.

**★ How does the driver know your SQL already has a `RETURNING` clause?**
By parsing the statement text. `Parser.addReturning` is handed an
`isReturningPresent` flag derived from that parse and returns immediately without
appending anything when it is set, which is what makes the hybrid form safe. The
thing worth saying in an interview is that this is *textual* analysis, not a
protocol feature — pgJDBC has had to correct it more than once, first because
early versions appended `RETURNING *` unconditionally and produced statements with
two clauses, and later because a column name containing the word could fool the
detection. Current releases handle both, but it explains why the driver's
behaviour here is a matter of implementation history rather than specification,
and it is another small argument for writing the clause explicitly where you can.

**★ Why is the empty-not-null contract of `getGeneratedKeys()` load-bearing?**
Because "no keys" is a completely ordinary outcome and the API had to make it
cheap to express. The javadoc's promise that "if this `Statement` object did not
generate any keys, an empty `ResultSet` object is returned" — implemented in
pgJDBC by building a result set over an empty field array, zero rows and zero
columns — means the caller always has an object to iterate and never has to
distinguish "no keys" from "keys not requested" by a null check. That matters
most with upserts, where a successful statement legitimately produces zero rows,
and it is why [chunk 20d](20d-batches-and-on-conflict.md) can treat an absent row
as information rather than an error. Code written as `if (keys.next())` or
`while (keys.next())` handles every case; code written as
`keys.next(); keys.getLong(1)` is a latent failure that only fires the second
time the same input is processed, which is precisely when nobody is watching.

---
← Prev: [20 · Generated keys](20-generated-keys.md) · Index: [JDBC](README.md) · Next → [20c · Beyond INSERT and beyond keys](20c-returning-beyond-insert.md)
