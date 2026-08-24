---
title: "One exception class covers every database failure, and the only reliable way to ask it what went wrong is a five-character string"
sidebar_label: "21 · `SQLException`"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for `java.sql.SQLException`,
> `java.sql.DatabaseMetaData` and `java.sql.SQLTimeoutException`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/); the PostgreSQL 18 manual
> *Appendix A. PostgreSQL Error Codes*
> (postgresql.org/docs/18/errcodes-appendix.html) and *Serialization Failure
> Handling* (postgresql.org/docs/18/mvcc-serialization-failure-handling.html); and the
> pgJDBC source for `org.postgresql.util.PSQLException`
> (github.com/pgjdbc/pgjdbc). JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**A duplicate email, a deadlock, a syntax error, a dropped TCP connection, a
statement timeout and a full disk all arrive in your `catch` block as the same Java
type. JDBC deliberately does not give you one exception class per failure, because it
cannot: the set of things a database can refuse to do is open-ended and
vendor-specific. Instead every `SQLException` carries a **five-character SQLState
string** that is standardised, a **vendor error code** that is not, and a **message**
that is human prose and may be localised. Almost every piece of bad database error
handling in the wild comes from reaching for the third of those. The message is the
one field guaranteed to change — it is translated, it is reworded between releases,
and it contains your data. SQLState exists precisely so that you never have to read
English to make a decision. This chunk is about reading it correctly. The typed
hierarchy that sits on top of it is
[chunk 21b](21b-the-subclass-hierarchy.md); what pgJDBC actually hands you instead is
[chunk 21c](21c-what-pgjdbc-throws.md); and the chain, the cause, and what you finally
*do* with an exception are [chunk 21d](21d-the-chain-and-what-to-do.md).**

## JDBC gives you one class because a portable API cannot enumerate the failures

The JDK 25 javadoc for `java.sql.SQLException` is unusually explicit about what an
instance carries. Quoting it, each `SQLException` provides:

- **"a string describing the error"** — the Java exception message, via `getMessage`.
- **"a 'SQLstate' string, which follows either the XOPEN SQLstate conventions or the
  SQL:2003 conventions. The values of the SQLState string are described in the
  appropriate spec. The `DatabaseMetaData` method `getSQLStateType` can be used to
  discover whether the driver returns the XOPEN type or the SQL:2003 type."**
- **"an integer error code that is specific to each vendor. Normally this will be the
  actual error code returned by the underlying database."**
- **"a chain to a next Exception. This can be used to provide additional error
  information."**
- **"the causal relationship, if any for this `SQLException`."**

Five kinds of information, and they are not equally useful. Read them in this order
and you will never write a fragile handler:

| Rank | Field | Accessor | Portable? | Stable? |
|---|---|---|---|---|
| 1 | SQLState | `getSQLState()` | across vendors, by class | yes — codes outlive releases |
| 2 | Subclass type | `instanceof` | yes, when the driver bothers | yes |
| 3 | Vendor code | `getErrorCode()` | no | per-vendor |
| ⛔ | Message | `getMessage()` | no | **no** — localised, reworded, contains data |

🔴 **The message is for a human reading a log, never for code deciding what to do.**
Appendix A of the PostgreSQL manual makes the argument for you: *"Applications that
need to know which error condition has occurred should usually test the error code,
rather than looking at the textual error message. The error codes are less likely to
change across PostgreSQL releases, and also are not subject to change due to
localization of error messages."*

## SQLState has two standards, and that ambiguity is real

`getSQLState()` returns five characters, but which dictionary they belong to depends
on the driver. JDBC exposes the ambiguity rather than hiding it: `DatabaseMetaData`
has `getSQLStateType()`, documented as *"Indicates whether the SQLSTATE returned by
`SQLException.getSQLState` is X/Open (now known as Open Group) SQL CLI or
SQL:2003."* The return values are the constants `DatabaseMetaData.sqlStateXOpen`,
`DatabaseMetaData.sqlStateSQL`, and `sqlStateSQL99` — the last of which the javadoc
says *"remains only for compatibility reasons. Developers should use the constant
`sqlStateSQL` instead."*

The history is why this exists. X/Open SQL CLI and the SQL standard both define
SQLSTATE, they overlap heavily but not perfectly, and JDBC — designed to sit over
drivers written against both — could not pick one. So the API asks the driver. In
application code you rarely call `getSQLStateType()`, because you already know your
driver; you call it in a library that must behave sanely on drivers it has never seen.

**For PostgreSQL the answer is simple.** Appendix A says the codes *"follow the SQL
standard's conventions for 'SQLSTATE' codes"*, with the caveat that *"some, but not
all, of the error codes produced by PostgreSQL are defined by the SQL standard; some
additional error codes for conditions not defined by the standard have been invented
or borrowed from other databases."* PostgreSQL's own inventions are the ones with a
`P` in them — `40P01`, `55P03`, `22P02`, `42P01`.

## Read the class before you read the code

Appendix A again, verbatim: *"According to the standard, the first two characters of
an error code denote a class of errors, while the last three characters indicate a
specific condition within that class. Thus, an application that does not recognize the
specific error code might still be able to infer what to do from the error class."*

That last sentence is the whole design. `substring(0, 2)` is a decision you can make
against a database you have never seen; the full five characters are a decision you
make against one you have. The classes worth knowing on PostgreSQL 18:

| Class | Meaning | Your move |
|---|---|---|
| `08` | Connection Exception | retry — on a **new** connection |
| `22` | Data Exception | fix the data or the cast; never retry |
| `23` | Integrity Constraint Violation | a business conflict; map it, do not retry blindly |
| `28` | Invalid Authorization Specification | config; fail fast and loudly |
| `40` | Transaction Rollback | **retry the whole transaction** |
| `42` | Syntax Error or Access Rule Violation | a bug or a permission; fail fast |
| `53` | Insufficient Resources | back off, alert |
| `55` | Object Not In Prerequisite State | usually a lock; retry with judgement |
| `57` | Operator Intervention | cancelled, shutting down, cannot connect now |

And the individual codes you will actually meet, each taken from Appendix A with its
official condition name:

| Code | Condition name | Where it comes from |
|---|---|---|
| `23505` | `unique_violation` | a duplicate key — the most common one in an application |
| `23503` | `foreign_key_violation` | inserting a child whose parent is gone |
| `23502` | `not_null_violation` | a missing required column |
| `23514` | `check_violation` | a `CHECK` constraint refused the row |
| `40001` | `serialization_failure` | Repeatable Read / Serializable conflict |
| `40P01` | `deadlock_detected` | two transactions waiting on each other |
| `55P03` | `lock_not_available` | `SELECT … FOR UPDATE NOWAIT` found the row locked |
| `57014` | `query_canceled` | statement timeout, or `Statement.cancel()` |
| `08006` | `connection_failure` | the socket died mid-statement |
| `08003` | `connection_does_not_exist` | used after close |
| `08001` | `sqlclient_unable_to_establish_sqlconnection` | the client could not connect at all |
| `08004` | `sqlserver_rejected_establishment_of_sqlconnection` | the server refused you |
| `53300` | `too_many_connections` | the server's `max_connections` is exhausted |
| `53200` | `out_of_memory` | the backend could not allocate |
| `25P02` | `in_failed_sql_transaction` | you kept issuing statements after an error |
| `22P02` | `invalid_text_representation` | a string that will not cast to the target type |
| `22001` | `string_data_right_truncation` | a value too long for the column |
| `42601` | `syntax_error` | a bug in your SQL |
| `42501` | `insufficient_privilege` | the role cannot do that |
| `42P01` | `undefined_table` | a migration did not run |
| `42703` | `undefined_column` | the code and the schema disagree |

⚠️ **`25P02` is the one people misread.** After any error inside a transaction,
PostgreSQL puts the transaction into an aborted state, and *every subsequent
statement* fails with `in_failed_sql_transaction` — including the one you added to
"clean up". The first exception is the real one; everything after it is noise until
you roll back. That is also why swallowing an exception inside a transaction and
carrying on produces a cascade of identical, useless errors.

## The vendor code is real elsewhere, and on PostgreSQL it is not there at all

`getErrorCode()` is documented as *"Retrieves the vendor-specific exception code for
this `SQLException` object"*, and on Oracle or DB2 it is the number people quote to
each other — `ORA-00001`, `ORA-01555`.

🔴 **On pgJDBC it is zero.** Every `PSQLException` constructor in the driver's source
calls a `SQLException` super-constructor that takes no vendor code:
`super(msg, state == null ? null : state.getState(), cause)` for the message/state
form, and `super(detail ? serverError.toString() :
serverError.getNonSensitiveErrorMessage(), serverError.getSQLState())` for the form
built from a server error message. There is no `int` anywhere in the chain.
PostgreSQL does not have a separate numeric error space to report — SQLSTATE **is**
its error identity — so `getErrorCode()` keeps the default `0`.

⚠️ **A handler branching on `getErrorCode()` therefore does nothing on PostgreSQL and
silently falls through to its default.** This is a real portability trap when code
written against Oracle is pointed at PostgreSQL: it compiles, it runs, and every error
takes the "unknown" path. It is also why an abstraction layer that translates by
vendor code — Spring's `SQLErrorCodeSQLExceptionTranslator` is the well-known one —
needs a SQLState-based fallback for exactly this driver. That two-tier strategy is
[chunk 21d](21d-the-chain-and-what-to-do.md)'s subject.

## Gotchas

**⚠️ Branching on `getMessage()` with `contains(...)`**
**Symptom:** error handling that works in development, then silently stops matching —
after a PostgreSQL upgrade, after a locale change on the server, or after someone sets
`lc_messages`.
**Cause:** the message is human prose. Appendix A says outright the codes *"are not
subject to change due to localization of error messages"*, which is the polite way of
saying the message is.
**Fix:** `"23505".equals(e.getSQLState())`. If you need to know *which* constraint,
there is a structured field for that — see
[chunk 21c](21c-what-pgjdbc-throws.md).

**⚠️ `getErrorCode()` on PostgreSQL always returns 0**
**Symptom:** a `switch (e.getErrorCode())` ported from an Oracle codebase in which
every case is dead and the default branch handles everything.
**Cause:** pgJDBC never passes a vendor code to the `SQLException` constructor —
PostgreSQL's error identity is SQLSTATE.
**Fix:** switch on `getSQLState()`, and where you need vendor granularity unwrap to
the driver's own structured error object.

**⚠️ Comparing the full five characters when you meant the class**
**Symptom:** a deadlock handler that catches `40P01` and misses `40001`, so
serialization failures escape the retry loop and reach users as 500s.
**Cause:** the condition is specific; the *decision* is class-wide.
**Fix:** `state != null && state.startsWith("40")` — or better, the
`SQLTransientException` branch — and reserve the exact code for the cases where you
genuinely act differently.

**⚠️ Assuming SQLState is never null**
**Symptom:** a `NullPointerException` thrown from inside the exception handler, which
then hides the original database error completely.
**Cause:** the SQLState is a plain string field on `SQLException` and nothing forces a
driver to set it; a client-side failure inside the driver can produce an exception
with none. `SQLTimeoutException`'s javadoc even states *"This exception does not
correspond to a standard SQLState."*
**Fix:** always `"23505".equals(e.getSQLState())`, never
`e.getSQLState().equals("23505")`, and give the handler a null-safe default path.

**⚠️ Treating a five-character code as a number**
**Symptom:** `Integer.parseInt(e.getSQLState())` throwing on `40P01`, or a comparison
that silently stops matching the moment a PostgreSQL-specific code appears.
**Cause:** SQLState is a **string**. PostgreSQL's non-standard codes deliberately
contain a letter, and standard ones like `0A000` have a leading zero that a numeric
parse destroys.
**Fix:** string comparison, always. Keep the codes as `String` constants.

**⚠️ Continuing to issue statements after an error inside a transaction**
**Symptom:** a log full of `in_failed_sql_transaction`, with the actual failure buried
hundreds of lines above it.
**Cause:** `25P02` — PostgreSQL aborts the transaction on the first error and refuses
everything until rollback.
**Fix:** on any `SQLException` inside a transaction, roll back (or to a savepoint) and
stop. The first exception is the diagnosis; the rest are consequences.

## Interview questions

**★ You catch a `SQLException`. How do you decide what actually went wrong?**
In a fixed order: SQLState first, subclass type second, vendor code third where the
vendor has one, and the message never. `getSQLState()` returns five characters whose
first two are the error *class* and whose last three are the specific condition, and
the class alone is usually enough to decide — `40` means retry the transaction, `23`
means a constraint conflict to surface as a business error, `42` means a bug, `08`
means a connection problem. The reason to prefer it is stability: PostgreSQL's own
documentation says applications should test the error code rather than the text
because codes are less likely to change across releases and are not subject to
localisation. The message, by contrast, is prose that gets translated, reworded, and
filled with your data — which makes it both fragile to match on and dangerous to
return to a caller.

**★ What are the two SQLState conventions and why does JDBC expose the difference?**
A SQLState follows either the X/Open (Open Group) SQL CLI conventions or the SQL:2003
conventions. They overlap substantially but not entirely, and because JDBC is a
portable API sitting over drivers written against both, it cannot silently pick one.
So it exposes the question: `DatabaseMetaData.getSQLStateType()` returns
`sqlStateXOpen` or `sqlStateSQL` — with the older `sqlStateSQL99` kept only for
compatibility — to tell you which dictionary applies. In application code you almost
never call it, because you know your driver; in a library that must behave on drivers
it has not seen, you do. For PostgreSQL the codes follow the SQL standard's
conventions, with a set of PostgreSQL-invented ones — the codes containing a `P`, like
`40P01` and `55P03` — covering conditions the standard does not define.

**★ Why does `getErrorCode()` return 0 on PostgreSQL, and what should you use
instead?**
Because pgJDBC never supplies one. Every `PSQLException` constructor in the driver
calls a `SQLException` super-constructor taking a message and a SQLState — and, in one
overload, a cause — but no vendor code, so the field keeps its default of zero. That
is not an oversight: PostgreSQL's error identity *is* SQLSTATE, and there is no
parallel numeric space like Oracle's `ORA-` numbers to report. The practical
consequence is that a handler ported from an Oracle codebase which switches on
`getErrorCode()` will compile, run, and silently route every error to its default
branch — a bug that no test catches unless the test asserts on the branch taken. Use
`getSQLState()`, and where you need more granularity than the five characters give,
unwrap to the driver's structured error object.

**★ What is `25P02` and why does it usually appear many times in a log?**
`25P02` is `in_failed_sql_transaction`. PostgreSQL aborts a transaction on the first
error and from that point refuses every statement in it — including the ones you issue
trying to recover — until a rollback, or a rollback to a savepoint. So a handler that
catches an exception, logs it, and continues issuing statements produces one real
error followed by a run of identical `25P02`s, and in a long method the real diagnosis
ends up hundreds of lines above the noise. The fix is structural: on any
`SQLException` inside a transaction, stop and roll back. If you genuinely need to
continue past a failing statement — a bulk import where one bad row should not kill
the run — use an explicit `SAVEPOINT` and roll back to it, which is also what pgJDBC's
`autosave=always` connection parameter does automatically by setting a savepoint
before every query.

**★ Why is `substring(0, 2)` on a SQLState a legitimate thing to write, when it looks
like exactly the kind of string manipulation you have just argued against?**
Because the two-character prefix is a defined part of the standard, not an accident of
formatting. The SQL standard specifies that the first two characters denote the error
*class* and the last three a condition within it, and PostgreSQL's Appendix A states
the design intent explicitly: an application that does not recognise the specific code
should still be able to infer what to do from the class. So reading the prefix is
reading a documented field, in the same way that reading the whole five characters is
— it is matching on prose that is illegitimate, not matching on structure. The
practical rule is to decide at the class level wherever the action is the same for the
whole class (`40` → retry, `42` → fail fast) and reach for the specific code only when
you genuinely branch on it, such as distinguishing `23505` from `23503` to produce two
different user-facing messages.

---
<!--FOOTER-->
