---
title: "pgJDBC ignores the subclass hierarchy and hands you something better instead — a structured error object with the constraint name in it"
sidebar_label: "21c · What pgJDBC actually throws"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the pgJDBC source for `org.postgresql.util.PSQLException`
> (github.com/pgjdbc/pgjdbc) and the pgJDBC public API for
> `org.postgresql.util.ServerErrorMessage`
> (jdbc.postgresql.org/documentation/publicapi/); the PostgreSQL 18 manual *Error and
> Notice Message Fields* (postgresql.org/docs/18/protocol-error-fields.html) and
> *Appendix A. PostgreSQL Error Codes*
> (postgresql.org/docs/18/errcodes-appendix.html); and the JDK 25 API documentation
> for `java.sql.SQLException` and its subclasses
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 21b](21b-the-subclass-hierarchy.md) described a hierarchy that lets you write
`catch (SQLIntegrityConstraintViolationException e)` and have the duplicate-email case
land in exactly the right place. Point that code at PostgreSQL and it never fires.
pgJDBC throws `org.postgresql.util.PSQLException`, and that class extends
`SQLException` **directly** — not the transient branch, not the non-transient branch,
not any leaf. The catch compiles, passes review, looks like textbook JDBC, and is
dead. This is the single most consequential portability fact in the whole area, and it
has a compensation: in place of the portable hierarchy pgJDBC exposes PostgreSQL's
ErrorResponse as a structured object, with the schema, the table, the column, the data
type and — most usefully — the **constraint name** as first-class fields. That is
strictly more information than the JDBC hierarchy can carry. The correct posture is
therefore two-tier: a portable check that works where drivers cooperate, a
SQLState-class fallback that always works, and driver-specific enrichment inside the
data-access layer where it cannot leak.**

## `PSQLException extends SQLException`, and that is the whole problem

The driver's source settles it. `PSQLException` declares
`extends SQLException`, and every constructor delegates to a plain `SQLException`
super-constructor:

```java
// org.postgresql.util.PSQLException — the shapes, from the driver source
super(msg, state == null ? null : state.getState(), cause);
super(msg, state == null ? null : state.getState());
super(detail ? serverError.toString() : serverError.getNonSensitiveErrorMessage(),
      serverError.getSQLState());
```

Three consequences follow immediately, and they are all invisible at compile time:

| You wrote | On a cooperating driver | On pgJDBC |
|---|---|---|
| `catch (SQLIntegrityConstraintViolationException e)` | fires on class `23` | **never fires** |
| `catch (SQLTransientException e)` | fires on `40001`, `40P01` | **never fires** |
| `e instanceof SQLRecoverableException` | true on connection loss | **false** |
| `e.getErrorCode()` | a vendor number | `0` — no `int` is ever passed |
| `e.getSQLState()` | the five characters | the five characters ✅ |

🔴 **Only the last row survives.** Everything the JDBC hierarchy promised is a no-op
here, which is why [chunk 21](21-sqlexception.md) put SQLState first rather than
treating it as the fallback. On PostgreSQL it is not the fallback; it is the mechanism.

⚠️ **This is a silent failure, and unit tests usually miss it** because a test that
mocks JDBC constructs whatever exception type the test author had in mind — very often
the "correct" subclass — and so the dead branch passes. A test that exercises the real
driver, or that constructs a `PSQLException`, is the only one that catches it.

## Write both mechanisms, and know which one runs

```java
static boolean isRetryable(SQLException e) {
    if (e instanceof SQLTransientException) return true;      // drivers that populate it
    if (e instanceof SQLRecoverableException) return true;    // sibling, not subclass
    String state = e.getSQLState();                           // pgJDBC path, null-safe
    return state != null && (state.startsWith("40") || state.startsWith("08"));
}
```

The `instanceof` arms are not dead weight even on PostgreSQL. They cost nothing, they
document the intent in the vocabulary every reader of JDBC knows, and they are what
makes the same helper correct when the same code runs against a driver that *does*
populate the hierarchy — H2 in tests, for example, or a different production database
later. But be honest in code review about which arm is load-bearing: on PostgreSQL it
is the string comparison, so that is the one the tests must cover.

⚠️ **`state.startsWith("08")` above is deliberately coarse.** Class `08` mixes
retryable and non-retryable conditions — `08006 connection_failure` versus
`08004 sqlserver_rejected_establishment_of_sqlconnection` — which is exactly the
distinction the JDBC hierarchy encodes and pgJDBC does not give you. If that matters,
enumerate the specific codes rather than the class, and accept that you now own a
per-vendor table.

## What you get instead: the server's error, as an object

`PSQLException` carries one extra accessor, `getServerErrorMessage()`, returning an
`org.postgresql.util.ServerErrorMessage`. That object is a typed view of PostgreSQL's
ErrorResponse message, whose fields the manual documents individually:

| Field | The manual's words | Java accessor |
|---|---|---|
| `S` | *"Severity: … `ERROR`, `FATAL`, or `PANIC` … Always present."* | `getSeverity()` |
| `C` | *"Code: the SQLSTATE code for the error (see Appendix A). Not localizable. Always present."* | `getSQLState()` |
| `M` | *"Message: the primary human-readable error message. This should be accurate but terse (typically one line). Always present."* | `getMessage()` |
| `D` | *"Detail: an optional secondary error message carrying more detail about the problem."* | `getDetail()` |
| `H` | *"Hint: an optional suggestion what to do about the problem."* | `getHint()` |
| `P` | *"Position: … an error cursor position as an index into the original query string. The first character has index 1, and positions are measured in characters not bytes."* | `getPosition()` |
| `W` | *"Where: an indication of the context in which the error occurred … a call stack traceback of active procedural language functions"* | `getWhere()` |
| `s` | *"Schema name: if the error was associated with a specific database object, the name of the schema containing that object"* | `getSchema()` |
| `t` | *"Table name: if the error was associated with a specific table, the name of the table."* | `getTable()` |
| `c` | *"Column name: if the error was associated with a specific table column, the name of the column."* | `getColumn()` |
| `d` | *"Data type name: if the error was associated with a specific data type, the name of the data type."* | `getDatatype()` |
| `n` | *"Constraint name: if the error was associated with a specific constraint, the name of the constraint."* | `getConstraint()` |
| `F` `L` `R` | the server's own source file, line and routine | `getFile()`, `getLine()`, `getRoutine()` |

🔴 **Read that table as an argument.** Every one of those is a field people routinely
try to recover by parsing the message string. The column name in a
`23502 not_null_violation`. The table in a `23503 foreign_key_violation`. The character
offset of a `42601 syntax_error`. They are all structured, all non-localised in the
sense that matters (the *values* are your identifiers, not translated prose), and all
one accessor away.

⚠️ **`P` counts characters, not bytes.** If you are highlighting a syntax error in a
query containing non-ASCII text, indexing a `byte[]` with `getPosition()` puts the
caret in the wrong place. It is also 1-based, not 0-based.

## `getConstraint()` is the one that changes how you write applications

The usual reason people parse a `23505` message is to discover *which* unique index was
violated, so the API can say "that email is already registered" instead of "conflict".
There is a field for it:

```java
catch (SQLException e) {
    if ("23505".equals(e.getSQLState())
            && e instanceof org.postgresql.util.PSQLException pge) {
        var serverError = pge.getServerErrorMessage();
        String constraint = serverError == null ? null : serverError.getConstraint();
        if ("customers_email_key".equals(constraint)) {
            throw new EmailAlreadyRegisteredException();
        }
        if ("customers_phone_key".equals(constraint)) {
            throw new PhoneAlreadyRegisteredException();
        }
    }
    throw translate(e);
}
```

Note the shape: **SQLState is the outer decision, the driver type is an enrichment.**
If `getServerErrorMessage()` returns null, or the constraint is one you do not know,
the code still falls through to a correct generic translation. Nothing depends on the
enrichment succeeding.

⚠️ **This couples the application to a constraint name**, and it is worth saying so
out loud rather than discovering it during a migration. Rename `customers_email_key`
and the branch stops firing *silently*, because the fallback still produces a valid —
just vaguer — error. Treat constraint names as part of the schema's public API and pin
them explicitly:

```sql
ALTER TABLE customers
  ADD CONSTRAINT customers_email_key UNIQUE (email);   -- named on purpose
```

rather than accepting whatever PostgreSQL generates from the column list, which is the
name that changes when someone reorders a composite key.

⚠️ **`getServerErrorMessage()` is `@Nullable`, and legitimately so.** A `PSQLException`
raised by the driver itself — a protocol error, a bad parameter index, a conversion
failure on the client side — never came from a server ErrorResponse and has nothing to
report. Every access must be null-checked, as the snippet above does.

🔴 **All of this stays inside the data-access layer.** `org.postgresql` must not appear
in an import above your DAO — unwrapping, translating and the boundary that enforces it
are [chunk 21d](21d-the-chain-and-what-to-do.md).

## Gotchas

**⚠️ Relying on the JDBC subclass hierarchy with pgJDBC**
**Symptom:** `catch (SQLIntegrityConstraintViolationException e)` never fires; the
duplicate-key case reaches users as a 500 with a correlation id and no explanation.
**Cause:** `PSQLException extends SQLException` directly; the JDBC 4 leaf types are
never instantiated.
**Fix:** write both checks, and make sure the SQLState arm is the one under test —
because it is the one that runs.

**⚠️ A unit test that proves the dead branch works**
**Symptom:** green tests, broken production, and a reviewer who cannot see the bug.
**Cause:** the test constructs `new SQLIntegrityConstraintViolationException(...)` by
hand, so the branch it exercises is one the driver will never produce.
**Fix:** build the fixture as a `PSQLException` with the real SQLState, or run the test
against a real PostgreSQL.

**⚠️ Assuming `getServerErrorMessage()` is non-null**
**Symptom:** a `NullPointerException` thrown from inside the exception handler, which
then hides the driver error it was trying to describe.
**Cause:** the field is populated only for exceptions built from a server
ErrorResponse; driver-raised ones have none.
**Fix:** null-check it, and keep SQLState as the outer decision so the structured
fields are only ever an enrichment.

**⚠️ Using the constraint name as the user-facing message**
**Symptom:** an API response body containing `customers_email_key`.
**Cause:** the structured field is right there and reads almost like a description.
**Fix:** map it. The constraint name is a lookup key into your own message catalogue,
never copy — and never something to expose, since it leaks schema detail.

**⚠️ Letting a generated constraint name become load-bearing**
**Symptom:** a branch that stops firing after a migration that "only" reordered a
composite unique key, with no test failure because the fallback still returns an error.
**Cause:** PostgreSQL's default constraint names are derived from the table and column
list, so they change when the columns do.
**Fix:** name every constraint you match on explicitly in the migration, and add a test
asserting the name exists.

**⚠️ Indexing a byte array with `getPosition()`**
**Symptom:** a syntax-error caret that lands in the wrong place, and only for queries
containing non-ASCII characters.
**Cause:** the manual specifies the position is measured in characters, not bytes, and
the first character has index 1.
**Fix:** index the `String`, and subtract one.

## Interview questions

**★ pgJDBC throws `PSQLException` for nearly everything. What does that mean for code
written against the subclass hierarchy?**
It means the hierarchy cannot be your only mechanism. `PSQLException` extends
`SQLException` directly, so a `catch (SQLIntegrityConstraintViolationException e)` that
works against a driver populating the JDBC 4 leaf types will simply not fire against
stock pgJDBC — the duplicate-key case falls through to the generic handler and users
see "internal error". The robust shape is to write both: an `instanceof` or multi-catch
on the subclasses, which is the portable and expressive form and works where the driver
cooperates, plus a SQLState-class fallback that always works. It is worth being explicit
in review about which arm is load-bearing, because the tests need to cover the one that
actually runs. This is also exactly why abstraction layers exist for the problem —
Spring's `SQLExceptionSubclassTranslator` uses the hierarchy where available and falls
back to SQLState-based translation otherwise, which is the same two-tier strategy you
would write by hand.

**★ How would you turn a duplicate-key error into "that email is already registered"
without parsing the message?**
Check `getSQLState()` for `23505`, then unwrap to pgJDBC's `PSQLException` and call
`getServerErrorMessage().getConstraint()`. PostgreSQL sends the constraint name as a
dedicated field in its ErrorResponse — the protocol documentation defines field `n` as
the name of the constraint the error was associated with — so the driver exposes it as
a structured value and there is nothing to parse and nothing that changes with the
server's locale. Match it against a known constraint name and throw your own domain
exception. Two things to say out loud: the structured object is nullable, because
driver-raised exceptions never came from a server error message, so the SQLState check
must be the outer decision and the enrichment must be allowed to fail; and this couples
the application to a constraint name, which therefore has to be pinned explicitly in
the migration rather than left to PostgreSQL's generated default and treated as part of
the schema's public surface.

**★ What else is in `ServerErrorMessage`, and why does it matter more than it sounds?**
It is a typed view of every field PostgreSQL puts in an ErrorResponse: severity, the
SQLSTATE code, the primary message, the detail and hint texts, the character position
of a syntax error in the original query, the "where" traceback through procedural
functions, and the schema, table, column, data type and constraint the error was
associated with — plus the server's own source file, line and routine. It matters
because every one of those is something developers routinely try to recover by
substring-matching the message: which column was null, which table's foreign key
failed, where the syntax error is. Having them as fields removes the entire class of
fragile parsing code, and it does so without leaving the driver — no extra query, no
catalogue lookup. The two traps are that the whole object is nullable for exceptions
the driver raised itself, and that the position is 1-based and counted in characters
rather than bytes.

**★ Why is `getErrorCode()` useless on PostgreSQL, and what breaks because of it?**
Because pgJDBC never supplies a vendor code. Every `PSQLException` constructor calls a
`SQLException` super-constructor taking a message and a SQLState — and in one overload
a cause — with no `int` anywhere, so the field keeps its default of zero. PostgreSQL's
error identity *is* SQLSTATE; there is no parallel numeric space like Oracle's `ORA-`
numbers. What breaks is anything ported from a vendor that does have one: a
`switch (e.getErrorCode())` compiles, runs, and routes every single error to its
default branch, which is usually the "unknown, rethrow" arm. It is a particularly nasty
bug because nothing fails loudly — the application still handles errors, just always
generically. It is also why an error-code-based translation layer like Spring's
`SQLErrorCodeSQLExceptionTranslator` needs a SQLState-based fallback to be useful here
at all.

**★ You need to distinguish a retryable connection failure from a permanent one, on
PostgreSQL. How?**
By enumerating codes, and accepting the cost. JDBC's answer is the type split between
`SQLTransientConnectionException` and `SQLNonTransientConnectionException`, both
covering SQLState class `08` — but pgJDBC produces neither, so the type carries nothing
and the class `08` alone lumps together `08006 connection_failure`, which is often a
network blip worth retrying on a fresh connection, and
`08004 sqlserver_rejected_establishment_of_sqlconnection`, which will not fix itself.
So you write a per-vendor table of the specific five-character codes you treat as
retryable and default the rest to non-retryable. The honest framing in an interview is
that this is exactly the portability cost of the driver skipping the hierarchy: you
have re-implemented, badly and for one vendor, a classification JDBC already specified.
It is also a good argument for putting that table in one place behind a single
predicate rather than scattering `startsWith("08")` through the codebase.

---
← Prev: [21b · The `SQLException` hierarchy](21b-the-subclass-hierarchy.md) · Index: [JDBC](README.md) · Next → [21d · The chain and the cause](21d-the-chain-and-what-to-do.md)
