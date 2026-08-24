---
title: "A `SQLException` has a chain as well as a cause, and nothing in the JDK prints the chain"
sidebar_label: "21d · The chain and the cause"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for `java.sql.SQLException`,
> `java.sql.BatchUpdateException`, `java.sql.SQLWarning`, `java.sql.Statement` and
> `java.lang.Throwable`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC source for
> `BatchResultHandler` (github.com/pgjdbc/pgjdbc). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**Every Java exception has a cause. `SQLException` is one of the very few that also has
a *chain* — a second, independent linked list threaded through `setNextException` — and
the two are not the same structure, are not printed by the same code, and do not mean
the same thing. The cause answers "what underlying failure produced this?". The chain
answers "what *other* errors happened alongside this one?". Nothing in the JDK prints
the chain: `printStackTrace` walks causes and suppressed exceptions and stops. So the
most common way to lose a database error is entirely ordinary code —
`log.error("failed", e)` on a `BatchUpdateException` whose real diagnosis is the second
link of a list nobody walked, in a message that literally instructs you to call
`getNextException` and is then thrown away. This chunk covers both structures, the
`iterator()` that finally walks them together, and `SQLWarning` — a third chain that
nobody reads at all. What you then *do* with the exception — retry it, translate it, or
never swallow it — is [chunk 21e](21e-retrying-and-translating.md).**

## Two links, two meanings

| | The chain | The cause |
|---|---|---|
| Set by | `setNextException(SQLException)` | a constructor argument, or `initCause` |
| Read by | `getNextException()` | `getCause()` |
| Means | *another error, alongside this one* | *the underlying failure that produced this one* |
| Printed by `printStackTrace`? | ⛔ **no** | ✅ yes, as `Caused by:` |
| Type | `SQLException` only | any `Throwable` |

The javadoc is precise about both. `setNextException` *"Adds an `SQLException` object
to the end of the chain"*; `getNextException` *"Retrieves the exception chained to this
`SQLException` object by setNextException"*, returning *"the next `SQLException` object
in the chain; `null` if there are none"*. The cause is ordinary `Throwable` machinery —
`SQLException` has constructors taking `(String reason, Throwable cause)`,
`(String reason, String sqlState, Throwable cause)` and
`(String reason, String sqlState, int vendorCode, Throwable cause)`.

🔴 **The chain exists because a single database operation can produce several distinct
errors, and none of them is the "cause" of the others.** A batch of 500 inserts where
rows 7 and 312 both violate a constraint has two errors of equal standing. Java's cause
chain cannot express that — a cause is a vertical relationship — so JDBC added a
horizontal one.

## `printStackTrace` hides the chain, and `BatchUpdateException` is where it hurts

`BatchUpdateException`'s javadoc describes what the batch API guarantees: it *"provides
the update counts for all commands that were executed successfully during the batch
update, that is, all commands that were executed before the error occurred"*, and *"The
order of elements in an array of update counts corresponds to the order in which
commands were added to the batch."* It also spells out that *"the driver may or may not
continue to process the remaining commands in the batch"*, and that if it does continue,
`getUpdateCounts` *"will have an element for every command in the batch rather than only
elements for the commands that executed successfully"*, with *"the array element for
any command that failed"* being `Statement.EXECUTE_FAILED`.

What the javadoc does **not** say, because it is a JDK document rather than a driver
one, is where the interesting error lives. pgJDBC's `BatchResultHandler` constructs the
exception with a message built from this template in the driver's source:

> `"Batch entry {0} {1} was aborted: {2}  Call getNextException to see other errors in the batch."`

🔴 **The driver is telling you, in the message itself, that the message is not the whole
story.** `BatchResultHandler` chains subsequent failures on with `setNextException` —
the source explicitly moves an existing chain onto a new exception with
`newException.setNextException(next)` — and none of that is reachable through
`getCause()`.

So this, which is what almost everyone writes, discards the diagnosis:

```java
// ❌ prints the first error and the words "Call getNextException", and nothing else
catch (BatchUpdateException e) {
    log.error("batch failed", e);
}
```

And this recovers it:

```java
// ✅ walk the chain
catch (BatchUpdateException e) {
    log.error("batch failed after {} commands", e.getUpdateCounts().length, e);
    for (SQLException next = e.getNextException(); next != null; next = next.getNextException()) {
        log.error("  chained: state={} message={}", next.getSQLState(), next.getMessage());
    }
}
```

⚠️ **`getUpdateCounts()` can be shorter than the batch, or exactly as long — and the
difference is not a bug.** Per the javadoc it has *"as many elements as there are
commands in the batch"* only if the driver kept going after the failure; otherwise it
holds only the commands that succeeded first. So `counts.length` is not a reliable
index into your input list unless you have checked which behaviour you got. Read
`Statement.SUCCESS_NO_INFO` and `Statement.EXECUTE_FAILED` explicitly rather than
assuming every element is a row count. (`getLargeUpdateCounts()` is the `long[]`
version, with identical semantics.) The batch API itself, and what partial failure means
for your data, is [chunk 19b](19b-when-a-batch-fails.md).

## `iterator()` is the modern way, and it walks both structures

Since Java 6, `SQLException implements Iterable<Throwable>`, and the javadoc for
`iterator()` says it *"Returns an iterator over the chained SQLExceptions. The iterator
will be used to iterate over each SQLException and its underlying cause (if any)"*,
returning *"an iterator over the chained SQLExceptions and causes in the proper
order"*.

🔴 **Both. Chain and causes, in one loop.** That makes the hand-rolled `for` above
mostly obsolete:

```java
catch (SQLException e) {
    for (Throwable t : e) {                       // chain AND causes
        if (t instanceof SQLException se) {
            log.error("state={} code={} msg={}",
                      se.getSQLState(), se.getErrorCode(), se.getMessage());
        } else {
            log.error("cause: {}", t.toString());
        }
    }
}
```

⚠️ **The iterator yields `Throwable`, not `SQLException`**, precisely because causes can
be anything — an `IOException` under a connection failure, for instance. Pattern-match
rather than casting.

⚠️ **A chained `SQLException` can itself have a chain**, and there is nothing stopping a
badly-behaved driver from producing a cycle. If you are writing a generic logging
utility rather than application code, cap the walk.

## `SQLWarning` is a chain nobody reads

`SQLWarning` is the same mechanism used for non-fatal information, and its javadoc is
almost apologetic about it: *"An exception that provides information on database access
warnings. Warnings are silently chained to the object whose method caused it to be
reported."* Retrieval is explicit and manual — *"Warnings may be retrieved from
`Connection`, `Statement`, and `ResultSet` objects"* — via `getWarnings()`, walked with
`getNextWarning()`, and cleared with `clearWarnings()`.

⚠️ **"Silently chained" is the operative phrase.** Nothing throws. Nothing logs.
A `RAISE NOTICE` in a PL/pgSQL function, a deprecation notice, a truncation warning —
all of it accumulates on the object and is discarded when you close it.

⚠️ **There is a lifetime trap:** the javadoc states that trying to retrieve a warning on
a connection, statement or result set *after it has been closed* will cause an exception
to be thrown, and notes that *"closing a statement also closes a result set that it
might have produced"*. So the warnings must be read **before** the try-with-resources
block exits — which is exactly the block that
[chunk 17 · resource handling](17-resource-handling.md) tells you to close promptly.

```java
try (PreparedStatement ps = c.prepareStatement(sql)) {
    ps.execute();
    for (SQLWarning w = ps.getWarnings(); w != null; w = w.getNextWarning()) {
        log.warn("db warning: state={} msg={}", w.getSQLState(), w.getMessage());
    }
}   // too late after this brace
```

Read them during development and in integration tests, where they surface real problems
cheaply. In a hot production path, polling `getWarnings()` on every statement is
overhead for information almost nobody acts on — which is the honest reason the feature
is unused.

## Gotchas

**⚠️ `printStackTrace` / `log.error(msg, e)` on a `BatchUpdateException`**
**Symptom:** a log entry that says a batch entry was aborted and literally instructs you
to call `getNextException`, with no further detail — and no way to tell which of 500
rows was bad.
**Cause:** the chain is not the cause chain; nothing in the JDK prints it.
**Fix:** iterate — `for (Throwable t : e)` — or walk `getNextException()` explicitly.
Put it in the shared logging helper so nobody has to remember.

**⚠️ Confusing `getNextException()` with `getCause()`**
**Symptom:** a handler that calls `getCause()` on a batch failure, gets `null`, and
concludes there is nothing more to see.
**Cause:** they are different structures with different meanings — vertical versus
horizontal.
**Fix:** `iterator()` walks both. If you need one specifically, name which and say why
in a comment, because the next reader will assume the other.

**⚠️ Indexing your input list with `getUpdateCounts().length`**
**Symptom:** an off-by-many error report blaming the wrong row, on some drivers and not
others.
**Cause:** the array is full-length only when the driver continued past the failure;
otherwise it stops at the last success.
**Fix:** scan for `Statement.EXECUTE_FAILED` rather than assuming a length, and treat
`Statement.SUCCESS_NO_INFO` as "succeeded, count unknown".

**⚠️ Reading warnings after the try-with-resources block**
**Symptom:** an exception thrown from the warning-logging code itself.
**Cause:** the javadoc states that retrieving a warning after the connection, statement
or result set is closed causes an exception — and closing a statement also closes its
result set.
**Fix:** read and log warnings inside the block, immediately after execution.

## Interview questions

**★ What is the difference between `getNextException()` and `getCause()`?**
They are two independent structures on the same object. `getCause()` is ordinary
`Throwable` machinery — the underlying failure that produced this exception, a vertical
relationship, and the thing `printStackTrace` renders as `Caused by:`.
`getNextException()` walks a chain built by `setNextException`, documented as adding an
exception "to the end of the chain", and it is horizontal: other errors of equal
standing that happened during the same operation. The chain exists because a single JDBC
call can genuinely produce several errors — a batch where three rows violate constraints
— and none of them causes the others, so the cause mechanism cannot express it. The
practical consequence is severe: nothing in the JDK prints the chain, so a
`log.error("failed", e)` shows the first error and silently discards the rest. Since
Java 6 `SQLException implements Iterable<Throwable>` and `iterator()` walks the chained
exceptions *and* their causes in order, which is the one call that covers both.

**★ Why can `printStackTrace` on a `BatchUpdateException` hide the real error?**
Because the useful information is on the chain, not the cause. pgJDBC's batch handler
builds the exception with a message from the template *"Batch entry {0} {1} was aborted:
{2}  Call getNextException to see other errors in the batch."* and attaches subsequent
failures with `setNextException`. `printStackTrace` walks causes and suppressed
exceptions; it does not know the chain exists. So you get the first failure and an
instruction, and everything after it is invisible unless you iterate. In a 500-row batch
where the first failure is a `23502 not_null_violation` on a nullable-looking column and
the *interesting* one is a `23503 foreign_key_violation` further down, the second never
reaches the log. The fix is to iterate the exception — `for (Throwable t : e)` — and it
belongs in a shared helper, because relying on every developer to remember a
non-obvious API is how the bug comes back.

**★ What does `BatchUpdateException` carry besides the error, and how do you read it
safely?**
It carries the update counts for the commands that ran, and the javadoc is careful about
what that means: it provides the counts "for all commands that were executed
successfully during the batch update, that is, all commands that were executed before
the error occurred", and the order of the array matches the order commands were added to
the batch. The trap is the length. A driver "may or may not continue to process the
remaining commands" after one fails; if it continues, the array has an element for every
command in the batch, with `Statement.EXECUTE_FAILED` in the slots that failed, and if
it stops, the array holds only the commands that succeeded first. So indexing your input
list by `getUpdateCounts().length` is portable-looking code that reports the wrong row on
half the drivers. Read the array by scanning for `Statement.EXECUTE_FAILED` and treat
`Statement.SUCCESS_NO_INFO` as "succeeded, count unknown" rather than assuming every
element is a row count. `getLargeUpdateCounts()` is the `long[]` form with identical
semantics, for batches whose counts can exceed `Integer.MAX_VALUE`.

**★ Why does `SQLWarning` exist, why does nobody read it, and when should you?**
It is the same chaining mechanism used for information that is not fatal — its javadoc
says warnings are "silently chained to the object whose method caused it to be
reported", and they are retrieved manually from `Connection`, `Statement` or `ResultSet`
with `getWarnings()`, walked with `getNextWarning()`, and dropped with
`clearWarnings()`. Nobody reads them because nothing forces you to: no throw, no log,
and the accumulated warnings vanish when the object closes. There is also a real trap —
the javadoc says retrieving a warning after the connection, statement or result set has
been closed throws, and closing a statement also closes its result set, so the read has
to happen *inside* the try-with-resources block. When to read them: in development and
in integration tests, where they surface `RAISE NOTICE` output, truncations and
deprecations for free. In a hot production path, polling every statement is real
overhead for information almost nobody acts on, which is the honest reason the API is
largely dead.

---
← Prev: [21c · What pgJDBC actually throws](21c-what-pgjdbc-throws.md) · Index: [JDBC](README.md) · Next → [21e · Retrying and translating](21e-retrying-and-translating.md)
