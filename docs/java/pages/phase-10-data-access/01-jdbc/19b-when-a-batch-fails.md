---
title: "Inside a transaction pgJDBC reports every entry as EXECUTE_FAILED, including the ones that worked — and it is right to"
sidebar_label: "19b · When a batch fails"
sidebar_position: 19.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement` and
> `java.sql.BatchUpdateException`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the PostgreSQL 18 manual §55.2.3 *Extended Query*
> ([postgresql.org/docs/18/protocol-flow.html](https://www.postgresql.org/docs/18/protocol-flow.html))
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> and the pgJDBC 42.7.x source for `BatchResultHandler`, `PgStatement`,
> `QueryExecutorImpl` and `PGProperty`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no console
> output.

**A batch that succeeds returns a simple array. A batch that fails returns an
array that is mostly a statement about your transaction, an exception whose
message is a summary rather than the error, and a real cause hidden one link down
a chain that the standard logging idiom throws away. Three specific things are
worth knowing before you write the `catch`. PostgreSQL never continues after a
failure — it reads and discards every pipelined message until the next Sync, so
nothing after the failing entry ran. pgJDBC only records earlier entries as
succeeded when the connection is in autocommit mode with no open transaction, so
inside `setAutoCommit(false)` the array is `EXECUTE_FAILED` from index zero, for
the 499 rows the server accepted as much as for the one that broke. And the
driver's message ends with the words "Call getNextException to see other errors
in the batch", which is unusually direct advice and is routinely ignored, which
is why batch failures have a reputation for being undiagnosable when they are in
fact over-documented.**

## The return array says three different things

`executeBatch` returns counts "ordered to correspond to the commands in the
batch, which are ordered according to the order in which they were added". Each
element is one of:

| Value | Javadoc meaning | When PostgreSQL gives it |
|---|---|---|
| `>= 0` | "an update count giving the number of rows in the database that were affected by the command's execution" | the normal case, one entry per command |
| `Statement.SUCCESS_NO_INFO` | "the command was processed successfully but that the number of rows affected is unknown" | after `reWriteBatchedInserts` merges rows ([chunk 19c](19c-insert-rewriting.md)), and when an `int[]` count would overflow |
| `Statement.EXECUTE_FAILED` | "the command failed to execute successfully and occurs only if a driver continues to process commands after a command fails" | pgJDBC fills every unsecured entry with it — see below |

⚠️ **`SUCCESS_NO_INFO` and `EXECUTE_FAILED` are negative numbers**, so code that
does `if (counts[i] == 0) throw new StaleRowException()` is fine, but code that
does `total += counts[i]` is quietly subtracting. Filter before you aggregate, or
do not aggregate at all.

⚠️ **`getUpdateCounts()` can hide a real number.** pgJDBC keeps `long` counts
internally and narrows them for the `int[]` API, substituting `SUCCESS_NO_INFO`
for anything above `Integer.MAX_VALUE`. That is a correct reading of the spec and
a silent loss of information; `executeLargeBatch()` returning `long[]`, and
`BatchUpdateException.getLargeUpdateCounts()`, are how you see it. The
`BatchUpdateException` javadoc says so outright: "If `Statement.executeLargeBatch`
method is invoked it is recommended that `getLargeUpdateCounts` be called instead
of `getUpdateCounts` in order to avoid a possible overflow of the integer update
count."

## The spec leaves it open; PostgreSQL closes it

The `executeBatch` javadoc is unusually explicit about the ambiguity it is
creating:

> "If one of the commands in a batch update fails to execute properly, this
> method throws a `BatchUpdateException`, and a JDBC driver may or may not
> continue to process the remaining commands in the batch. However, the driver's
> behavior must be consistent with a particular DBMS, either always continuing to
> process commands or never continuing to process commands."

**PostgreSQL never continues**, and that is a server property rather than a driver
choice. From the protocol documentation:

> "When an error is detected while processing any extended-query message, the
> backend issues ErrorResponse, then reads and discards messages until a Sync is
> reached, then issues ReadyForQuery and returns to normal message processing."

Every Bind and Execute you already pipelined behind the failing one is *read and
thrown away*. So the array is never a report of "which individual rows were bad".
There was exactly one bad entry per Sync segment, and it is the first one marked
failed; everything after it is **untried**, not failed. The distinction matters
when you are deciding what to retry.

`BatchUpdateException` gives you the counts for what preceded it:

> "a `BatchUpdateException` provides the update counts for all commands that were
> executed successfully during the batch update, that is, all commands that were
> executed before the error occurred."

## Inside a transaction, every count is `EXECUTE_FAILED` — and that is correct

Here is the behaviour that reads like a bug and is not. pgJDBC only "secures"
progress — records entries as genuinely committed — when this holds:

```java
private boolean isProgressDurable() {
  BaseConnection connection = pgStatement.getPGConnection();
  return connection.getAutoCommit()
      && connection.getTransactionState() == TransactionState.IDLE;
}
```

`secureProgress()` advances a `committedRows` watermark, and it is called from
`flushIfDeadlockRisk` — that is, at each forced Sync. On error the handler fills
from the watermark to the end:

```java
Arrays.fill(longUpdateCounts, committedRows, longUpdateCounts.length,
            Statement.EXECUTE_FAILED);
```

Inside an explicit transaction `committedRows` is still `0`, so **the array is
`EXECUTE_FAILED` from index zero** — for entry 1 and entry 499 alike. The driver
is not confused about which rows the server accepted. It is refusing to tell you
an entry succeeded when the transaction it lives in is doomed, and it is right:
after the first error PostgreSQL puts the session in the aborted state
(`SQLSTATE 25P02`, `in_failed_sql_transaction`) and every further command fails
until you roll back.

🔴 **The corollary is the useful part. `getUpdateCounts()` is only worth reading
under autocommit**, where partial progress is real and the watermark is
meaningful. Under an explicit transaction the only two facts are "it threw" and
"the chained exception says why". Anything else you think you learned from the
array is an artefact of how the driver had to fill it.

The two-sided summary:

| | autocommit | `setAutoCommit(false)` |
|---|---|---|
| Progress secured at each forced Sync | yes | no — `committedRows` stays 0 |
| Counts before the failure | real | all `EXECUTE_FAILED` |
| Rows before the failure survive | yes, for completed Sync segments | no, the rollback erases them |
| What to retry | from the first `EXECUTE_FAILED` | the whole unit of work |

## The message is a summary; the error is on the chain

pgJDBC builds the exception message from a template in `BatchResultHandler`:

```java
GT.tr("Batch entry {0} {1} was aborted: {2}  Call getNextException to see other "
    + "errors in the batch.", resultIndex, queryString, newError.getMessage())
```

`{0}` is the index of the failing entry, `{1}` is the rendered statement, `{2}`
is the server's message. The underlying `PSQLException` is passed as the
exception's **cause** and also chained as its **next exception** — that is what
the sentence is telling you to go and read. It carries the `SQLSTATE`, the
constraint name, and the detail line, none of which are in the summary.

```java
} catch (BatchUpdateException e) {
    log.error("batch failed at entry index derivable from message; counts={}",
              Arrays.toString(e.getUpdateCounts()));
    for (Throwable t : e) {          // SQLException implements Iterable<Throwable>
        log.error("  chained", t);
    }
    throw e;
}
```

`SQLException` implements `Iterable<Throwable>`, so the enhanced `for` walks the
`getNextException` chain for you. Prefer it to a hand-written
`while (e.getNextException() != null)` loop — that is where people forget to
advance the variable and hang the thread.

⚠️ **`logServerErrorDetail` decides whether the statement and its bound values
appear in `{1}`.** It defaults to `true`, and `BatchResultHandler` consults it
before rendering the query. Its own description is "Include full server error
detail in exception messages. If disabled then only the error itself will be
included." That is excellent for debugging and a data-protection problem if your
batch carries personal data into an aggregated log. Turning it off is a real
trade, not a tidy-up.

## Gotchas

**⚠️ Reading `getUpdateCounts()` inside a transaction and believing it**
**Symptom:** an exception handler that "recovers" the first 499 rows, and a
database that has none of them.
**Cause:** pgJDBC only secures progress under autocommit with no open
transaction, so inside `setAutoCommit(false)` the whole array is `EXECUTE_FAILED`
by design — because the whole batch is about to roll back.
**Fix:** under a transaction, use the array for nothing. Roll back and retry the
unit of work.

**⚠️ Logging `e.getMessage()` and nothing else**
**Symptom:** "Batch entry 47 ... was aborted" in the log, and no constraint name,
no value, no `SQLSTATE`.
**Cause:** the real server error is the chained exception; the driver's message
literally tells you to call `getNextException`.
**Fix:** iterate the exception — `for (Throwable t : e)` — or at minimum log
`e.getNextException()` and `e.getCause()`.

**⚠️ Assuming the entries after the failure ran and failed**
**Symptom:** defensive code that scans the array looking for several distinct
failures, and a retry that skips rows it never tried.
**Cause:** PostgreSQL discards every pipelined message until the next Sync, so
there is exactly one real failure per segment; the rest never executed.
**Fix:** treat the first `EXECUTE_FAILED` as the boundary. Everything after it is
untried and must be retried, not written off.

**⚠️ Summing the update counts**
**Symptom:** a "rows written" metric that is negative, or smaller than the batch.
**Cause:** `SUCCESS_NO_INFO` and `EXECUTE_FAILED` are negative constants sitting
in the same `int[]` as the real counts.
**Fix:** treat the two constants explicitly rather than arithmetically.

**⚠️ Assuming the update counts survived an `int`**
**Symptom:** `SUCCESS_NO_INFO` on an entry that clearly affected rows, in a bulk
`UPDATE ... WHERE` that touches enormous partitions.
**Cause:** the `int[]` API cannot represent a count above `Integer.MAX_VALUE`,
and pgJDBC substitutes the constant rather than overflowing.
**Fix:** `executeLargeBatch()` and `getLargeUpdateCounts()`.

**⚠️ Catching `SQLException` and never testing for `BatchUpdateException`**
**Symptom:** a generic handler that logs and retries the batch unchanged,
forever, because one row will never be acceptable.
**Cause:** the subclass carries the only information that distinguishes "retry
this" from "this input is poison" — the entry index and the `SQLSTATE`.
**Fix:** catch `BatchUpdateException` specifically; branch on `SQLSTATE` —
`40001` serialization failure is retryable, `23505` unique violation is not — and
quarantine the offending input row.

**⚠️ Sensitive values in the exception message**
**Symptom:** bound parameters — emails, card fragments — in an aggregated log,
from a batch failure.
**Cause:** `logServerErrorDetail` defaults to `true` and `BatchResultHandler`
renders the failing query with its parameters into the message.
**Fix:** decide it deliberately. `logServerErrorDetail=false` costs you the most
useful debugging signal you have, so scrub at the log sink instead if you can.

## Interview questions

**★ A batch of 1000 fails at entry 500 inside a transaction. What do the update
counts tell you?**
Nothing useful, and that is deliberate. pgJDBC only records progress as secure
when the connection is in autocommit mode with no open transaction — the
`isProgressDurable` check is exactly that — so inside an explicit transaction the
watermark stays at zero and `Arrays.fill` marks every one of the thousand entries
`EXECUTE_FAILED`, including the 499 the server accepted. That is correct rather
than lazy: those rows are inside a transaction now in the aborted state
(`SQLSTATE 25P02`), every subsequent command in it will fail, and the rollback
will erase them. The information you want is not in the array at all: it is the
entry index in the exception message, and the chained exception carrying the
constraint name and `SQLSTATE`. Under autocommit the array does become
meaningful, because the forced Syncs have committed earlier segments for real.

**★ How do you find out why a batch failed?**
Catch `BatchUpdateException` and walk the chain — do not stop at `getMessage()`.
The driver's own message is a template that ends "Call getNextException to see
other errors in the batch", which is unusually direct advice and is routinely
ignored, because the standard logging idiom formats only the message. The
underlying `PSQLException` is attached both as the cause and as the next
exception, and it carries the `SQLSTATE`, the constraint name and the detail
line. Since `SQLException` implements `Iterable<Throwable>`, an enhanced `for`
over the exception walks the whole chain, which is safer than a hand-written
`getNextException` loop. The entry index in the message tells you which input row
it was, so keep the batch's input list addressable by index for exactly that
reason. And if the message is missing the query text and values, someone has set
`logServerErrorDetail=false`, possibly for good privacy reasons.

**★ What does the array returned by `executeBatch` actually contain?**
One element per command, in the order the commands were added, and each element
is one of three things: a non-negative update count, `SUCCESS_NO_INFO` meaning
the command succeeded but the row count is unknown, or `EXECUTE_FAILED`. The trap
is that the two constants are negative, so any code that sums the array is wrong.
`SUCCESS_NO_INFO` shows up on PostgreSQL in two situations worth knowing: when
`reWriteBatchedInserts` has merged several rows into one multi-values `INSERT`,
so the driver genuinely cannot attribute the server's single count to individual
entries, and when pgJDBC narrows an internal `long` count that exceeds
`Integer.MAX_VALUE` for the `int[]` API. `executeLargeBatch` returns `long[]` and
avoids the second case.

**★ Does a JDBC driver keep going after a failed batch entry, and does it matter
which?**
The spec allows either, and requires only consistency: "a JDBC driver may or may
not continue to process the remaining commands in the batch. However, the
driver's behavior must be consistent with a particular DBMS." It matters a great
deal, because it changes what the returned array means. A driver that continues
returns an array with one element per command and `EXECUTE_FAILED` in each failed
slot — so you can find several genuine failures. PostgreSQL never continues: on
an error the backend discards pipelined messages until it reaches a Sync, so
after the failing entry nothing was attempted. The array on PostgreSQL therefore
has at most one real failure per Sync segment, and the entries after it are
untried. Writing recovery code that assumes the "continues" model against
PostgreSQL means silently skipping rows that were never sent.

---

**Continue:** [19c · Insert rewriting](19c-insert-rewriting.md),
[19d · Generated keys from a batch](19d-generated-keys-from-a-batch.md), then
[19e · Sizing a batch](19e-sizing-a-batch.md).

---
<!--FOOTER-->
