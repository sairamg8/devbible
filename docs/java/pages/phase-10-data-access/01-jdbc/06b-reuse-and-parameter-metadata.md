---
title: "Bound values outlive the execution, and that is a data-corruption bug waiting for a branch"
sidebar_label: "6b · Reuse and parameter metadata"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.PreparedStatement`
> (`clearParameters`, `getParameterMetaData`) and `java.sql.ParameterMetaData`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**A `PreparedStatement` is built to be executed more than once, and the state it
carries between executions is the part nobody reads about until it bites.
Parameter values persist: the javadoc says they *"remain in force for repeated
use of a statement"*, and setting one clears only that one. A loop with a branch
that skips a setter therefore writes the previous iteration's value, silently and
without an error — one of the very few JDBC mistakes that corrupts data instead
of failing. This chunk is that mechanism, what `clearParameters` actually does
about it, and the parameter-side metadata API that exists for frameworks rather
than for you.**

## Reuse: what survives an execution, and what `clearParameters` is for

A `PreparedStatement` is designed to be executed more than once, and the javadoc
is precise about what carries over:

> *In general, parameter values remain in force for repeated use of a statement.
> Setting a parameter value automatically clears its previous value.*

So reuse is a loop of "set the parameters that change, execute" — and the values
you *do not* set again are still bound from last time. That is the mechanism, and
it is a footgun in exactly one shape: a loop where a branch skips a setter, so
the previous row's value silently applies to this one. No error, wrong data.

```java
try (var ps = c.prepareStatement("INSERT INTO audit(actor, action, note) VALUES (?,?,?)")) {
    for (var e : events) {
        ps.setString(1, e.actor());
        ps.setString(2, e.action());
        if (e.note() != null) ps.setString(3, e.note());   // ← bug: else-branch missing
        ps.executeUpdate();                                //   a null note reuses the last one
    }
}
```

The fix is to set every parameter on every iteration — `ps.setString(3,
e.note())` handles null perfectly well through the driver's null mapping, or
`setNull` when the type needs stating. `clearParameters()` is the blunt version:

> *Clears the current parameter values immediately... in some cases it is useful
> to immediately release the resources used by the current parameter values.*

⚠️ **Read what it does and does not do.** It clears *values*; it does not reset
the statement, close the result set, or make an unset parameter legal. Its
documented purpose is releasing resources — which matters when a parameter was a
large `byte[]` or a stream you no longer want held. Calling it defensively at the
top of every loop iteration does not protect you: every parameter must still be
set before execution, so the effect is to convert a silent wrong-value bug into a
loud missing-parameter error. That is an improvement, and it is worth doing
deliberately rather than as ritual.

## `ParameterMetaData`, and why you probably will not use it

`getParameterMetaData()` *"Retrieves the number, types and properties of this
`PreparedStatement` object's parameters"*. It is the mirror of
`ResultSetMetaData` and it exists for the same audience: generic tooling that
must bind values without knowing the statement in advance.

For application code it is rarely useful and occasionally expensive — on
PostgreSQL, obtaining parameter types can require the server to describe the
statement, which is a round trip you did not ask for. If you are writing a
framework, it is the correct way to discover that parameter 3 is `bigint`; if you
are writing a repository, you already know.

## The trade-off

Reuse is worth having and it is not free of obligation: the object that saves you
allocations is the same object that remembers last time. The discipline that
makes it safe is small — set every parameter on every execution — and the
alternative, a fresh statement per iteration, gives up batching
([chunk 19](19-batch-updates.md)) and the execution counter that server-side
preparation depends on ([chunk 9](09-server-side-prepared-statements.md)) for a
safety property you can get by writing the setter.

## Gotchas

**⚠️ A conditional that leaves a parameter unset**
**Symptom:** an exception naming a parameter index, on a path that only runs when
an optional field is absent.
**Cause:** a branch that skips a setter.
**Fix:** set every parameter on every path — including `setNull` — or build a
different statement for the different shape.

**⚠️ Reusing a `PreparedStatement` whose `ResultSet` is still open**
**Symptom:** "This ResultSet is closed" from code that never closed it.
**Cause:** re-executing a statement closes its previous result.
**Fix:** finish reading before re-executing, or use a second statement.

**⚠️ `clearParameters()` called as a ritual**
**Symptom:** a loud "no value specified for parameter 3" replacing a quiet wrong
value — an improvement, but not the fix anyone intended.
**Cause:** clearing values does not set them; every parameter must still be bound
before execution.
**Fix:** treat it as a resource-release call, which is what the javadoc describes
it as, and bind every parameter explicitly.

**⚠️ `getParameterMetaData()` on a hot path**
**Symptom:** an unexplained extra round trip per call in a repository method.
**Cause:** describing a statement to learn its parameter types is work the server
may have to do.
**Fix:** you wrote the SQL — you know the types. Leave the metadata API to
frameworks.

**⚠️ Holding one `PreparedStatement` in a field for reuse across requests**
**Symptom:** interleaved parameter values under concurrency; rows written with
another request's data.
**Cause:** a statement belongs to a connection, and neither is thread-safe;
persisted parameter state makes the race produce plausible-looking wrong rows
rather than an exception.
**Fix:** statement per unit of work, from the connection you borrowed for it
([chunk 18](18-ownership-and-leaks.md)).

## Interview questions

**★ You reuse a `PreparedStatement` in a loop. What can go wrong?**
Parameter values persist between executions — the javadoc says they *"remain in
force for repeated use of a statement"* and that setting one clears only its own
previous value. So a loop that skips a setter on some branch silently reuses the
previous iteration's value for that position: no exception, no warning, wrong
data written. It is one of the few JDBC bugs that produces corrupted rows rather
than an error, which is why it survives testing on inputs where the branch never
fires. The discipline is to set every parameter on every iteration; `setNull` or a
plain `setString(i, null)` covers the absent case, and reaching for
`clearParameters()` at the top of the loop converts the silent bug into a loud
missing-parameter failure, which is better but is not the same as setting them.

**★ Is reusing a `PreparedStatement` object what makes it fast?**
No, and this is the most common misunderstanding of the class. The speed, where
there is any, comes from the *server-side* statement — and pgJDBC keys that on
the SQL text on the connection, not on your Java object, switching to a named
statement only after `prepareThreshold` executions
([chunk 9](09-server-side-prepared-statements.md)). Reusing the object saves you
re-creating a fairly cheap client-side wrapper. What reuse genuinely buys is in a
loop: fewer allocations, and the natural structure for `addBatch`
([chunk 19](19-batch-updates.md)), which is where the real win is. The reason to
use `PreparedStatement` for a single execution is not performance at all — it is
that parameters travel separately from the statement, which is what makes
injection structurally impossible ([chunk 5](05-preparedstatement-and-injection.md)).

**★ What is `ParameterMetaData` for?**
Discovering the number and SQL types of a statement's parameter markers at
runtime — the parameter-side mirror of `ResultSetMetaData`. Its real audience is
generic code: an ORM, a query runner, a tool binding values from a map without
knowing the statement in advance. In ordinary repository code you wrote the SQL,
so you already know what parameter 3 is, and asking the driver costs something —
on PostgreSQL, describing a statement to learn its parameter types can mean a
round trip. So it is a framework-author's tool, and its appearance in application
code usually signals a design that is more dynamic than it needs to be.

**★ Besides parameter values, what other state does a `PreparedStatement` carry
between executions?**
More than people expect, and all of it persists in the same way. The fetch size
set with `setFetchSize`, the `setMaxRows` cap, the query timeout from
`setQueryTimeout`, the generated-keys mode chosen when the statement was created,
the batch accumulated by `addBatch`, and the warning chain from
`getWarnings`. None of them reset themselves on execution. The batch is the one
that surprises people most: `executeBatch` clears it, but an exception partway
through leaves you unsure of the state, which is why `clearBatch` exists. The
general rule is the same as for parameters — a reused statement remembers, so
either set what matters on every execution or do not reuse the object across
contexts that disagree about those settings.

**★ Write the loop that inserts ten thousand rows. What does it look like?**
One connection, one `PreparedStatement`, autocommit off, every parameter set on
every iteration, `addBatch` per row, `executeBatch` every few hundred or few
thousand rows so neither side buffers the whole set, one `commit` at the end, and
the whole thing in `try`-with-resources so a failure closes the statement and the
connection. The details that matter beyond the shape: the SQL text is constant,
so the statement crosses the prepare threshold and stays prepared for the whole
job; `reWriteBatchedInserts=true` on the connection lets pgJDBC collapse the
inserts into multi-row `VALUES` statements; and if the volume is genuinely large,
`COPY` through pgJDBC's `CopyManager` beats any batch. The mistake to avoid is
opening a connection per row, which turns a bulk load into ten thousand pool
borrows. Detail in [chunk 19](19-batch-updates.md).

---
← Prev: [6 · The `PreparedStatement` API](06-the-preparedstatement-api.md) · Index: [JDBC](README.md) · Next → [7 · What a parameter can be](07-what-a-parameter-can-be.md)
