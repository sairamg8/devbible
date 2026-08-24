---
title: "Asking the database which id it just assigned has three APIs, and on PostgreSQL the convenient one answers a much bigger question than you asked"
sidebar_label: "20 · Generated keys"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement` and
> `java.sql.Connection`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html,
> .../Connection.html); the pgJDBC source at github.com/pgjdbc/pgjdbc —
> `jdbc/PgConnection.java`, `core/Parser.java`, `core/SqlCommand.java`,
> `core/QueryWithReturningColumnsKey.java`; the pgJDBC *Connection Parameters*
> page (jdbc.postgresql.org/documentation/use/); and the PostgreSQL 18 manual —
> *Sequence Manipulation Functions* (postgresql.org/docs/18/functions-sequence.html)
> and *Numeric Types → Serial Types* (postgresql.org/docs/18/datatype-numeric.html).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Every insert into a table with a server-assigned key ends with the same
question: what id did I just get? The wrong answer — a follow-up `SELECT
max(id)` — is wrong for a reason worth internalising, because it is wrong even
when it looks right in every test you write. The JDBC answer is
`getGeneratedKeys()`, reached through three different `prepareStatement`
overloads, and on PostgreSQL exactly one of the three is what you want, one is
convenient and expensive, and one throws outright. The surprise is what the
convenient one actually does: pgJDBC implements generated keys by rewriting your
statement with a `RETURNING` clause, and `Statement.RETURN_GENERATED_KEYS`
becomes `RETURNING *` — so you get every column of the inserted row, not the key.
That is more data than you asked for, over the wire, on every insert, in a shape
that changes when someone adds a column. It also silently disables the driver's
best batch-insert optimisation.**

## Why the follow-up `SELECT` is not a slow answer but a wrong one

The instinct is to insert, then ask:

```sql
-- ⛔ wrong, and not because it is a second round trip
INSERT INTO orders (customer_id, total_cents) VALUES (?, ?);
SELECT max(id) FROM orders;
```

Two concurrent sessions inserting at the same time both run that `SELECT`, and
nothing ties either answer to either insert. Under PostgreSQL's default `READ
COMMITTED` the second statement sees every row committed before it started, so it
can perfectly well hand session A the id session B just created. It is not a race
you can close by raising the isolation level either: that makes the read *stable*,
not *yours*. And sequences make it worse rather than better, because — as the
manual says of `serial` — "there may be 'holes' or gaps in the sequence of values
which appears in the column, even if no rows are ever deleted. A value allocated
from the sequence is still 'used up' even if a row containing that value is never
successfully inserted into the table column." So `max(id)` is not merely a value
someone else might have taken; it is not even guaranteed to be the largest value
that has been handed out.

The version that *is* correct is `currval`:

> "Returns the value most recently obtained by `nextval` for this sequence in the
> current session. (An error is reported if `nextval` has never been called for
> this sequence in this session.) Because this is returning a session-local
> value, it gives a predictable answer whether or not other sessions have
> executed `nextval` since the current session did."

Session-local, therefore correct. It is still the wrong thing to write. It costs a
second round trip; it makes you name the sequence (`orders_id_seq`, a name you now
depend on and which `serial` chose for you); its no-argument sibling `lastval()`
refers to "whichever sequence `nextval` was most recently applied to in the
current session", which a trigger can redirect under you; and both raise an error
rather than returning nothing if `nextval` has not been called in this session.
Everything that follows gets the value **in the same statement**, which removes
the question instead of answering it.

## The three APIs, and what PostgreSQL does with each

JDBC gives you three overloads on `Connection`, and three matching ones on
`Statement.executeUpdate` for the no-parameter case
([chunk 11](11-statement-types.md) on why you should rarely be there). The javadoc
for all of them carries the same caveat: the flag or array "is ignored if the SQL
statement is not an `INSERT` statement, or an SQL statement able to return
auto-generated keys (the list of such statements is vendor-specific)." Which
statements those are on PostgreSQL is
[chunk 20b's](20b-reading-and-writing-returning.md) subject, and the answer is
wider than `INSERT`.

| API | JDBC intent | What pgjdbc 42.7 actually does |
|---|---|---|
| `prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)` | "make generated keys available" | delegates to the `String[]` form with `null`, which becomes `{"*"}` — appends `\nRETURNING *` |
| `prepareStatement(sql, new String[]{"id"})` | return these named columns | appends `\nRETURNING "id"` — quoted, by default |
| `prepareStatement(sql, new int[]{1})` | return the columns at these ordinals | ⛔ throws `PSQLException`: *"Returning autogenerated keys is not supported."* |
| `prepareStatement(sql, Statement.NO_GENERATED_KEYS)` | do not | delegates to plain `prepareStatement(sql)` |

The middle column is the specification; the right-hand one is the implementation,
read out of `PgConnection`:

```java
public PreparedStatement prepareStatement(String sql, int autoGeneratedKeys) throws SQLException {
  if (autoGeneratedKeys != Statement.RETURN_GENERATED_KEYS) {
    return prepareStatement(sql);
  }
  return prepareStatement(sql, (String[]) null);
}
```

That `null` reaches `QueryWithReturningColumnsKey`, whose constructor does
`if (columnNames == null) { columnNames = new String[]{"*"}; }`. The parser then
appends the clause:

```java
nativeSql.append("\nRETURNING ");
if (returningColumnNames.length == 1 && returningColumnNames[0].charAt(0) == '*') {
  nativeSql.append('*');
  return true;
}
```

🔴 **So `RETURN_GENERATED_KEYS` on PostgreSQL means `RETURNING *`.** Not "the key".
Not "the primary key". Every column of the row as it exists after the insert. The
javadoc even warns you this is permitted — "If the columns which represent the
auto-generated keys were not specified, the JDBC driver implementation will
determine the columns which best represent the auto-generated keys" — and pgJDBC's
answer to "which columns best represent them" is *all of them*, because from the
driver's side there is no way to know which column is the key without fetching
metadata it would rather not fetch on every prepare.

⚠️ **The `int[]` overload is not "unsupported in a harmless way".** It throws. The
driver tolerates only a **zero-length** array, which it reads as "no keys wanted"
and routes to the plain single-argument `prepareStatement`; a `null` or a
populated array raises `PSQLException` with `PSQLState.NOT_IMPLEMENTED`. The
`Statement` path has its own wording — *"Returning autogenerated keys by column
index is not supported."* Column ordinals are a relic of databases that number
table columns; do not reach for them.

## What the extra columns actually cost

Three separate costs, and the third is the one nobody sees coming.

**Bytes.** A row with a `text` description, a `jsonb` payload or a `bytea`
thumbnail is now transferred back on every single insert, for a value you are
going to discard. For a wide row that is not a rounding error, and in a batch it
multiplies by the batch size.

**Ambiguity.** `RETURNING *` produces whatever columns the table has *now*. Code
that reads position 1 is reading whatever column is physically first today. Add a
column, drop a column, or rebuild the table in a way that changes the attribute
order, and positional reads move silently.

**A disabled optimisation.** pgJDBC's `reWriteBatchedInserts` — which the driver
documentation describes as changing "batch inserts from insert into foo (col1,
col2, col3) values (1, 2, 3) into insert into foo (col1, col2, col3) values (1, 2,
3), (4, 5, 6)", claiming a "2-3x performance improvement" — is disabled by any
`RETURNING` clause. `SqlCommand`'s constructor is explicit:

```java
boolean batchedReWriteCompatible = (type == INSERT) && isBatchedReWriteConfigured
    && valuesBraceOpenPosition >= 0 && valuesBraceClosePosition > valuesBraceOpenPosition
    && !isPresent && priorQueryCount == 0;
```

`!isPresent` is "no `RETURNING`". So asking for generated keys and enabling insert
rewriting are mutually exclusive — and the clause that disqualifies your statement
may be one the driver wrote on your behalf. This is the strongest practical
argument for splitting "bulk load" and "insert and read back" into two code paths
rather than one parameterised helper.

## The judgement in one line

`RETURN_GENERATED_KEYS` is one constant and no thought, and it costs you the whole
row, a shape tied to the table, and insert rewriting. The `String[]` overload
costs one array literal and gives all of that back while keeping
`getGeneratedKeys()` as the reading idiom and the code portable to any driver.
Prefer it by default; reach for the flag only on a narrow table where you
genuinely want every column back, and then do it deliberately.
[Chunk 20b](20b-reading-and-writing-returning.md) covers reading the result and
writing the clause yourself.

## Gotchas

**⚠️ `SELECT max(id)` after the insert**
**Symptom:** occasional wrong ids under load; never reproducible in a test with
one thread.
**Cause:** nothing connects the read to your write. `READ COMMITTED` shows you
every committed row, including another session's.
**Fix:** `RETURNING`, or `getGeneratedKeys()`. There is no correct variant of the
follow-up `SELECT`.

**⚠️ Reaching for `currval` or `lastval` instead**
**Symptom:** works, until a trigger is added to the table and `lastval()` starts
returning the id of an audit row.
**Cause:** `lastval()` refers to whichever sequence `nextval` last touched in the
session, and a trigger touches sequences you did not write.
**Fix:** get the value in the inserting statement. If you must use a sequence
function, use `currval('the_sequence')` by name, never `lastval()`.

**⚠️ Assuming `max(id)` is at least the highest id ever allocated**
**Symptom:** a "next id" calculation that collides.
**Cause:** a rolled-back transaction still consumes its sequence value, so the
sequence is ahead of the table and gaps are normal.
**Fix:** never compute keys from table contents. That is what the sequence is for.

**⚠️ `RETURN_GENERATED_KEYS` on a wide table**
**Symptom:** inserts measurably slower than the same inserts without key
retrieval, by more than one round trip's worth.
**Cause:** the driver appended `RETURNING *`; every `text`, `jsonb` and `bytea`
column comes back on every insert.
**Fix:** `prepareStatement(sql, new String[]{"id"})`.

**⚠️ Passing `new int[]{1}` because the javadoc offers it**
**Symptom:** `PSQLException: Returning autogenerated keys is not supported.`
**Cause:** pgJDBC implements only the name-based overload; the index-based one
throws unless the array is zero-length.
**Fix:** use column names. Never ordinals.

**⚠️ Enabling `reWriteBatchedInserts` and generated keys together**
**Symptom:** the documented 2–3× batch-insert improvement never materialises, and
nothing in the logs explains why.
**Cause:** `SqlCommand` requires `!isReturningPresent` for rewrite compatibility,
and any `RETURNING` clause — including the driver's own — disqualifies the
statement.
**Fix:** choose one. A bulk load that does not need the keys must not ask for them.

**⚠️ Assuming the flag means "the primary key"**
**Symptom:** a helper that reads column 1 and calls it the id, then breaks on a
table whose first column is not the key.
**Cause:** the javadoc explicitly delegates the choice — "the JDBC driver
implementation will determine the columns which best represent the auto-generated
keys" — and pgJDBC's determination is `*`.
**Fix:** state the key column. The driver cannot know it and is not claiming to.

**⚠️ Treating `NO_GENERATED_KEYS` as meaningful on a `PreparedStatement`**
**Symptom:** a config flag that toggles the constant and changes nothing.
**Cause:** anything that is not `RETURN_GENERATED_KEYS` routes straight to plain
`prepareStatement(sql)` — the constant carries no other behaviour.
**Fix:** if the choice is dynamic, choose between two prepared statements, not
between two constants.

## Interview questions

**★ Why can you not just run `SELECT max(id)` after an insert?**
Because nothing ties that read to your write. Under `READ COMMITTED` the second
statement sees every row committed at the moment it starts, so a concurrent
session's insert is perfectly visible and you can be handed its id instead of
yours. Raising the isolation level does not help: it makes the read stable, not
attributable. Sequences make it worse still, because a value allocated by
`nextval` is used up even if the inserting transaction rolls back, so `max(id)` is
not even reliably the largest value that has been handed out. The session-local
`currval` *is* correct — it returns the value most recently obtained by `nextval`
in this session, and the manual is explicit that this is predictable regardless of
other sessions — but it costs an extra round trip, ties you to the sequence's
name, and its sibling `lastval()` can be redirected by a trigger touching another
sequence. The right answer gets the value in the same statement, which is what
`RETURNING` and `getGeneratedKeys()` both do.

**★ What are the three ways to ask JDBC for generated keys, and which work on
PostgreSQL?**
`prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)`,
`prepareStatement(sql, String[] columnNames)` and
`prepareStatement(sql, int[] columnIndexes)`. On pgJDBC the first two work and the
third throws `PSQLException` with `PSQLState.NOT_IMPLEMENTED` — it tolerates only
a zero-length array, which it treats as "no keys wanted". The important detail is
what the first one compiles to: the driver delegates it to the `String[]` form
with `null`, `null` is turned into `{"*"}`, and the parser appends `RETURNING *`.
So the convenient flag returns every column of the inserted row, not the key. The
javadoc allows this — it says that if the key columns were not specified, the
driver decides which ones "best represent" them — and pgJDBC's decision is all of
them, because it has no cheap way to know which column is the key.

**★ What does `RETURN_GENERATED_KEYS` cost on PostgreSQL, concretely?**
Three things. Bandwidth, because a wide row's `text`, `jsonb` or `bytea` columns
are transferred back on every insert and multiplied by the batch size. Stability,
because the result's shape is the table's shape, so positional reads move when a
column is added or dropped. And a lost optimisation: `reWriteBatchedInserts`,
which the driver documents as a 2–3× improvement for batched inserts by merging
`VALUES` tuples, is disabled by any `RETURNING` clause — `SqlCommand` requires
`!isReturningPresent` for rewrite compatibility, and it does not care that the
clause was the driver's own doing. Naming the columns removes the first two costs;
the third is inherent to wanting keys back at all, and is a good reason to keep
bulk loading and read-back inserts as separate code paths.

**★ Why does the JDBC specification leave so much of this to the driver?**
Because "the auto-generated key" is not a concept the SQL standard defines
uniformly. Different engines return the value through different mechanisms —
identity columns, sequences, triggers, a session function, an output clause — and
some can return several keys per row while others can return only the last one
inserted. The specification therefore names the *goal* and delegates the
*columns*: the flag is "ignored if the SQL statement is not an `INSERT` statement,
or an SQL statement able to return auto-generated keys (the list of such
statements is vendor-specific)", and when you do not name the columns "the JDBC
driver implementation will determine the columns which best represent" them. That
is honest about the portability limit rather than pretending it away, and it is
exactly why the portable-looking flag has a very unportable meaning. Naming the
columns is how you take that decision back.

---
<!--FOOTER-->
