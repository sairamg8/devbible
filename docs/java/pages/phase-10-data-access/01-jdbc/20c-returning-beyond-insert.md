---
title: "RETURNING is not an insert feature and is not about keys: it is how you read the row the database actually stored"
sidebar_label: "20c · Beyond INSERT and beyond keys"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html);
> the pgJDBC source at github.com/pgjdbc/pgjdbc — `core/Parser.java`; and the
> PostgreSQL 18 manual — *Returning Data from Modified Rows*
> (postgresql.org/docs/18/dml-returning.html), *INSERT*
> (postgresql.org/docs/18/sql-insert.html), *Identity Columns*
> (postgresql.org/docs/18/ddl-identity-columns.html) and *Numeric Types → Serial
> Types* (postgresql.org/docs/18/datatype-numeric.html).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**The API is called `getGeneratedKeys` and the mental model that produces — "this
is how I learn my new id" — is too small in two directions. Sideways: pgJDBC
appends `RETURNING` to `UPDATE`, `DELETE` and `WITH` as well as `INSERT`, so the
same call hands back updated rows and deleted rows, and PostgreSQL 18 will return
the *old* row alongside the new one. Downwards: the id is rarely the only thing
the server decided. A `DEFAULT now()`, a generated column, a `BEFORE INSERT`
trigger that normalises an email or fills a tenant id — every one of those means
the object you constructed in Java and the row that now exists are different
objects, and the difference is invisible until something downstream reads the
database instead of your variable. The manual is explicit that the data available
to `RETURNING` is "the row as modified by the triggers". That is the one honest
argument for wanting more columns back than the key, and it is a much better
reason than the driver's default happening to give them to you.**

## `RETURNING` is appended for four command types, not one

The javadoc leaves the set of key-returning statements "vendor-specific", and
pgJDBC's list is wider than most people assume. `Parser.addReturning` bails out
for anything outside four command types:

```java
if (currentCommandType != SqlCommandType.INSERT
    && currentCommandType != SqlCommandType.UPDATE
    && currentCommandType != SqlCommandType.DELETE
    && currentCommandType != SqlCommandType.WITH) {
  return false;
}
```

So `RETURN_GENERATED_KEYS` on an `UPDATE` gives you the updated rows, and on a
`DELETE` the deleted ones. That is genuinely useful: an optimistic-locking update
can return its bumped version number in the same round trip, a delete-and-report
can return what it removed, and a status transition can return the row the
application should now cache. `WITH` is in the list because a data-modifying CTE
is still a modifying statement.

⚠️ **`MERGE` is not in that list**, even though PostgreSQL supports `MERGE ...
RETURNING` — the manual's own summary is that "the `INSERT`, `UPDATE`, `DELETE`,
and `MERGE` commands all have an optional `RETURNING` clause". The driver will not
append one to a `MERGE` for you, so if you want rows back from a merge you write
the clause yourself and read it through the hybrid form from
[chunk 20b](20b-reading-and-writing-returning.md). A `SELECT` likewise gets
nothing appended, and `getGeneratedKeys()` then returns the documented empty
result set, silently and without error.

## PostgreSQL 18 returns the old row as well as the new one

The clause itself grew in PostgreSQL 18: "In each of these commands, it is also
possible to explicitly return the old and new content of the modified row", with
the caveat that "typically old values will be `NULL` for an `INSERT`, and new
values will be `NULL` for a `DELETE`."

```sql
-- PostgreSQL 18: what it was and what it became, in one statement
UPDATE orders SET status = 'shipped'
WHERE id = ?
RETURNING id, OLD.status AS was, NEW.status AS now;
```

The manual documents an aliasing form for when `OLD` and `NEW` collide with
something of yours: "By default, old values from the target table can be returned
by writing `OLD.column_name` or `OLD.*`, and new values can be returned by writing
`NEW.column_name` or `NEW.*`. When an alias is provided, these names are hidden
and the old or new rows must be referred to using the alias. For example
`RETURNING WITH (OLD AS o, NEW AS n) o.*, n.*`."

⚠️ **This is reachable only by writing the clause yourself.** The generated-keys
API requests column *names*; `OLD.status` is an expression, and no overload
accepts one. It is the clearest single example of the ceiling the portable API
has. It also collapses the read-modify-write audit pattern into one atomic
statement, removing a race that would otherwise need a lock or a repeatable-read
snapshot to close.

## Defaults, generated columns and triggers: the row is not what you sent

Two sentences from the manual carry the whole argument. On defaults:

> "The optional `RETURNING` clause causes `INSERT` to compute and return value(s)
> based on each row actually inserted... This is primarily useful for obtaining
> values that were supplied by defaults, such as a serial sequence number."

And on triggers:

> "If there are triggers on the target table, the data available to `RETURNING` is
> the row as modified by the triggers. Thus, inspecting columns computed by
> triggers is another common use-case for `RETURNING`."

So the row you can read back is the *post-trigger, post-default* row — which is
the only version that matches what the next reader will see. Consider a perfectly
ordinary table:

```sql
CREATE TABLE orders (
    id           bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    customer_id  bigint      NOT NULL,
    status       text        NOT NULL DEFAULT 'pending',
    total_cents  integer     NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    search_key   text        GENERATED ALWAYS AS (lower(status)) STORED
);
```

An insert that supplies `customer_id` and `total_cents` leaves *four* columns for
the server to decide. Building an `Order` object from your own inputs plus a
`LocalDateTime.now()` guess gives you a value that is wrong in at least two ways —
the timestamp is the client's clock rather than the server's
([chunk 14](14-dates-times-and-timestamptz.md) on why that matters), and any
`BEFORE INSERT` trigger's work is missing entirely. Reading them back is one
clause:

```sql
INSERT INTO orders (customer_id, total_cents) VALUES (?, ?)
RETURNING id, status, created_at, search_key;
```

✅ **This is the case where wanting the whole row is legitimate.** If the object
you return to the caller must equal the row in the database, `RETURNING *` is
defensible — you are not being lazy, you genuinely want every column. The
distinction that matters is whether you *chose* it. `RETURN_GENERATED_KEYS`
gives you the same bytes by accident, with no statement of intent and a shape
nobody controls; writing `RETURNING *` in the SQL says "I want the stored row" to
every future reader.

## Identity columns, and the one that refuses your value

PostgreSQL has two spellings for a server-assigned key and they behave differently
under an explicit insert. The manual describes identity columns as "a special
column that is generated automatically from an implicit sequence", and the two
forms as:

> "If `ALWAYS` is selected, a user-specified value is only accepted if the
> `INSERT` statement specifies `OVERRIDING SYSTEM VALUE`."

> "If `BY DEFAULT` is selected, then the user-specified value takes precedence.
> Thus, using `BY DEFAULT` results in a behavior more similar to default values,
> where the default value can be overridden by an explicit value, whereas `ALWAYS`
> provides some more protection against accidentally inserting an explicit value."

`serial`, by contrast, is "not [a] true type, but merely a notational convenience
for creating unique identifier columns", expanding to a `nextval()` default — so
it always behaves like `BY DEFAULT`, and the manual notes that the standard
alternative is the identity feature.

⚠️ **Neither guarantees uniqueness on its own.** The manual is blunt: "An identity
column, however, does not guarantee uniqueness. (A sequence normally returns
unique values, but a sequence could be reset, or values could be inserted manually
into the identity column...)" — "Uniqueness would need to be enforced using a
`PRIMARY KEY` or `UNIQUE` constraint." The same is true of `serial`: "in most
cases you would also want to attach a `UNIQUE` or `PRIMARY KEY` constraint to
prevent duplicate values from being inserted by accident, but this is not
automatic."

None of this changes how you read the key back — `RETURNING id` works identically
for both — but it changes what happens when a data-migration script, a test
fixture or an ORM decides to supply its own id.

## Gotchas

**⚠️ Expecting `getGeneratedKeys()` to do something after a `SELECT`**
**Symptom:** an empty result set and a confusing debugging session.
**Cause:** the driver only appends `RETURNING` for `INSERT`, `UPDATE`, `DELETE`
and `WITH`; for anything else the flag is a no-op, exactly as the javadoc says.
**Fix:** none needed — but never write logic whose correctness depends on the flag
having had an effect.

**⚠️ Expecting the driver to add `RETURNING` to a `MERGE`**
**Symptom:** an empty keys result from a merge that definitely changed rows.
**Cause:** `MERGE` is not one of the four command types `addReturning` handles,
even though PostgreSQL supports `MERGE ... RETURNING`.
**Fix:** write the clause in the SQL. The hybrid form — your clause, read through
`getGeneratedKeys()` — works, because the driver detects an existing `RETURNING`
and stops appending.

**⚠️ Forgetting that `UPDATE` and `DELETE` also return rows**
**Symptom:** a hand-rolled "read the row back after updating it" that costs an
extra round trip and can read a version someone else has since changed.
**Cause:** the assumption that `RETURNING` is an insert feature.
**Fix:** `UPDATE ... RETURNING`, which gives you the post-update row atomically —
and on PostgreSQL 18, the pre-update one alongside it.

**⚠️ Assuming `OLD`/`NEW` can be requested through the API**
**Symptom:** a search for the overload that takes expressions.
**Cause:** there is none; `prepareStatement` takes names or ordinals only.
**Fix:** write the clause. This is one of the cases where the portable API simply
cannot express the query you want.

**⚠️ Returning an object built from your inputs rather than from the row**
**Symptom:** a `created_at` that disagrees with the database by the clock skew
between app server and database, or a status that ignores a trigger's
normalisation.
**Cause:** the object was assembled from what you sent, not from what was stored.
**Fix:** `RETURNING` the defaulted and computed columns and map the result. It is
one clause and it removes an entire class of "the API said X, the report says Y".

**⚠️ Trusting a `BEFORE INSERT` trigger not to change your row**
**Symptom:** an inserted value that differs from the one you supplied, discovered
weeks later by a support ticket.
**Cause:** triggers are invisible from the Java side, and the manual is explicit
that `RETURNING` sees "the row as modified by the triggers".
**Fix:** read back any column a trigger can touch. If you do not know which those
are, that is itself worth finding out before shipping.

**⚠️ Inserting an explicit id into a `GENERATED ALWAYS` column**
**Symptom:** an error on a data-migration script or test fixture that works fine
against a `serial` column.
**Cause:** `ALWAYS` accepts a user-specified value "only if the `INSERT` statement
specifies `OVERRIDING SYSTEM VALUE`".
**Fix:** either add that clause deliberately in the migration, or use
`GENERATED BY DEFAULT AS IDENTITY` if explicit ids are a normal part of the
workflow. The strictness is the point of `ALWAYS`, so do not weaken it casually.

**⚠️ Assuming an identity or `serial` column is unique**
**Symptom:** duplicate ids after a restore, a sequence reset, or a manual insert.
**Cause:** the manual says an identity column "does not guarantee uniqueness" and
that a `serial` column's `UNIQUE`/`PRIMARY KEY` constraint "is not automatic".
**Fix:** declare the constraint. A generated default is a convenience, not an
integrity rule.

## Interview questions

**★ Is `getGeneratedKeys()` restricted to `INSERT`?**
The javadoc says the flag is ignored unless the statement is an `INSERT` "or an
SQL statement able to return auto-generated keys", and leaves that list
vendor-specific. pgJDBC's list is `INSERT`, `UPDATE`, `DELETE` and `WITH`, which is
directly readable in `Parser.addReturning`. So the same API gives you the updated
rows from an `UPDATE` and the deleted rows from a `DELETE` — useful for returning a
bumped version number for optimistic locking, or for reporting what a delete
actually removed — and `WITH` is included because a data-modifying CTE is still a
modifying statement. Notably `MERGE` is *not* in the list even though PostgreSQL
supports `MERGE ... RETURNING`, so there you must write the clause yourself.
Anything else, a `SELECT` included, gets nothing appended and yields the empty
result set with no error, which is a good reason not to write logic that depends
on the flag having had an effect.

**★ Why does PostgreSQL 18's `OLD`/`NEW` support matter, and why can the JDBC API
not reach it?**
It lets one statement return both what a row was and what it became —
`RETURNING id, OLD.status, NEW.status` — with an aliasing form,
`RETURNING WITH (OLD AS o, NEW AS n) o.*, n.*`, for when those names collide with
your own; old values are typically `NULL` for an `INSERT` and new values `NULL`
for a `DELETE`. That collapses the read-modify-write audit pattern into a single
atomic statement, removing a race that would otherwise need a lock or a
repeatable-read snapshot to close. The JDBC API cannot ask for it because its
overloads take column *names* and column *ordinals*: `OLD.status` is an
expression, and there is no third form. It is a clean illustration of the general
principle that the portable API expresses the common case and nothing past it.

**★ When is returning the whole row actually the right thing to do?**
When the object you hand back to the caller has to equal the row that now exists.
That is more often than people think: a `DEFAULT now()` timestamp is the server's
clock and not yours, a stored generated column is computed by the server, and the
manual is explicit that "if there are triggers on the target table, the data
available to `RETURNING` is the row as modified by the triggers" — so anything a
`BEFORE INSERT` trigger normalises or fills in exists only in the database until
you read it. The important distinction is not whole-row versus one column, it is
deliberate versus accidental: writing `RETURNING *` in your SQL states an
intention that a future reader can evaluate, whereas
`Statement.RETURN_GENERATED_KEYS` produces exactly the same bytes as a side effect
of a portability flag, with a shape nobody chose and a cost nobody measured.

**★ What is the difference between `serial` and an identity column, and does it
affect how you read the key back?**
`serial` is, in the manual's words, "not [a] true type, but merely a notational
convenience": it creates an integer column with a `nextval()` default and an owned
sequence. An identity column is the SQL-standard feature — "a special column that
is generated automatically from an implicit sequence" — and comes in two forms.
`GENERATED BY DEFAULT AS IDENTITY` behaves like `serial`: an explicit value wins.
`GENERATED ALWAYS AS IDENTITY` refuses an explicit value unless the statement says
`OVERRIDING SYSTEM VALUE`, which is deliberate protection against a migration or a
test fixture inserting its own ids. Neither guarantees uniqueness — that still
needs a `PRIMARY KEY` or `UNIQUE` constraint, which the manual says explicitly for
both. Reading the key back is identical for all of them: `RETURNING id`, or a
`String[]` of column names. The choice matters for writes, not for reads.

---
← Prev: [20b · Reading keys, writing RETURNING](20b-reading-and-writing-returning.md) · Index: [JDBC](README.md) · Next → [20d · Batches and ON CONFLICT](20d-batches-and-on-conflict.md)
