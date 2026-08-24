---
title: "A batch removes round trips, not work — and under autocommit it is still a transaction, just not the one you think"
sidebar_label: "19 · Batch updates"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the PostgreSQL 18 manual §55.2.3 *Extended Query* and §55.2.4 *Pipelining*
> ([postgresql.org/docs/18/protocol-flow.html](https://www.postgresql.org/docs/18/protocol-flow.html))
> and §14.4 *Populating a Database*
> ([postgresql.org/docs/18/populate.html](https://www.postgresql.org/docs/18/populate.html)),
> and the pgJDBC 42.7.x source for `PgStatement`, `BatchResultHandler` and
> `QueryExecutorImpl` ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no
> console output.

**Batching is the one JDBC optimisation whose benefit is entirely about the
network. It does not make PostgreSQL insert a row faster, it does not save
parsing — [preparation](09-server-side-prepared-statements.md) already did that —
and it does not reduce the per-row work by one instruction. What it removes is
the *stop-and-wait*: without a batch the driver sends one statement, flushes, and
blocks until the server answers before it can send the next, so a thousand
inserts is a thousand sequential round trips. With a batch it writes all thousand
Bind/Execute pairs and waits once. That is the whole win, and across a network it
is enormous. The cost is that everything downstream changes shape — the return
value becomes an array whose elements mean three different things
([chunk 19b](19b-when-a-batch-fails.md)), and the transaction semantics stop
being what "autocommit" led you to expect, because
pgJDBC sends no `BEGIN` and PostgreSQL opens an implicit transaction block
anyway.**

## What batching removes is round trips, and nothing else

The single-statement path in pgJDBC's `QueryExecutorImpl` is literally
`sendQuery(...)` → `sendSync()` → `pgStream.flush()` → `processResults(...)`. The
flush is the point of no return: the driver cannot write the next statement until
it has read this one's reply, because it must know whether an error arrived. One
statement, one round trip, and on anything but a loopback connection that round
trip dominates everything else.

The batch path is the same method with the loop moved inside. Every entry gets
its `sendQuery`, and only after the loop does the driver call `sendSync()`, flush
and process results. Between those two points there is no waiting.

That is exactly the mechanism PostgreSQL's protocol documentation calls
pipelining:

> "Use of the extended query protocol allows *pipelining*, which means sending a
> series of queries without waiting for earlier ones to complete. This reduces
> the number of network round trips needed to complete a given series of
> operations. However, the user must carefully consider the required behavior if
> one of the steps fails, since later queries will already be in flight to the
> server."

Two consequences fall straight out of that sentence. **The win scales with
latency**, so a batch across a VPC boundary is transformative and a batch against
a database on localhost is worth much less — and batching never fixes a slow
statement, it just pipelines the slowness. And **"later queries will already be
in flight"** is why batch error handling is genuinely different from ordinary
error handling; that is the subject of
[chunk 19b](19b-when-a-batch-fails.md).

## The four methods, and the overload that is a trap

| Method | What it does | Watch out |
|---|---|---|
| `addBatch()` | adds the currently-bound parameter values as one entry | the `PreparedStatement` form; takes no argument |
| `addBatch(String sql)` | "Adds the given SQL command to the current list of commands for this `Statement` object." | ⛔ **"This method cannot be called on a `PreparedStatement` or `CallableStatement`."** |
| `clearBatch()` | "Empties this `Statement` object's current list of SQL commands." | needed less often than people think — see the gotchas |
| `executeBatch()` | submits the list, returns `int[]` of update counts | throws `BatchUpdateException` on failure |
| `executeLargeBatch()` | the same, returning `long[]`; "should be used when the returned row count may exceed `Integer.MAX_VALUE`" | a `default` method that may throw `UnsupportedOperationException`; pgJDBC implements it |

The `addBatch(String)` overload exists for `Statement`, where each entry is a
different SQL string. On a `PreparedStatement` the SQL is fixed and each entry is
a different set of *bindings*, which is why the no-arg form exists and why the
javadoc bans the other one outright. Calling it is a compile-time-legal,
runtime-`SQLException` mistake, and it happens because IDE completion offers both.

```java
private static final String SQL = """
        INSERT INTO ledger_entry (account_id, cents, occurred_at)
        VALUES (?, ?, ?)
        """;

int[] insertAll(List<Entry> entries) throws SQLException {
    try (Connection c = dataSource.getConnection()) {
        c.setAutoCommit(false);
        try (PreparedStatement ps = c.prepareStatement(SQL)) {
            for (Entry e : entries) {
                ps.setLong(1, e.accountId());
                ps.setLong(2, e.cents());
                ps.setObject(3, e.occurredAt());
                ps.addBatch();          // no argument: this is the PreparedStatement form
            }
            int[] counts = ps.executeBatch();
            c.commit();
            return counts;
        } catch (SQLException ex) {
            c.rollback();
            throw ex;
        }
    }
}
```

⚠️ **An empty batch is free.** pgJDBC's `executeBatch` returns `new int[0]`
before touching the network when nothing was added, so the familiar guard
`if (!entries.isEmpty())` buys nothing on this driver. Write the loop plainly.

⚠️ **A batch is per `Statement`, so it is per `Connection`.** The parameter lists
accumulate in a client-side `ArrayList` on the statement object, and the whole
batch is submitted to the one backend the connection is attached to — see
[chunk 4](04-connection-is-expensive.md). You cannot spread one batch across a
pool, and holding a connection for the duration of a huge batch is a real cost
against the pool's ceiling.

## Autocommit does not turn a batch into a row-per-transaction

This is the claim most often stated backwards, so here is what pgJDBC does, from
the source. In `PgStatement.internalExecuteBatch`:

```java
if (connection.getAutoCommit()) {
  flags |= QueryExecutor.QUERY_SUPPRESS_BEGIN;
}
```

So under autocommit the driver sends **no `BEGIN`**. But it also sends no `Sync`
until the loop ends — and PostgreSQL's protocol documentation says what that
means:

> "If the client has not issued an explicit `BEGIN`, then an implicit transaction
> block is started and each Sync ordinarily causes an implicit `COMMIT` if the
> preceding step(s) succeeded, or an implicit `ROLLBACK` if they failed."

**So a pgJDBC batch under autocommit is still atomic — per Sync segment.** Not
because the driver wrapped it, but because the server started an implicit
transaction block the moment a command ended without a Sync. Autocommit's
per-statement commit is a property of the *one statement per Sync* rhythm, and
batching deliberately breaks that rhythm.

⚠️ **"Per Sync segment" is the caveat that matters**, because pgJDBC sometimes
inserts a Sync you did not ask for. Its `flushIfDeadlockRisk` tracks an estimate
of how many response bytes are outstanding, and when adding the next entry would
cross `MAX_BUFFERED_RECV_BYTES` — `64000` in the source — it forces a Sync,
flushes and drains results before continuing. The source comment explains why:

> "If the server → driver stream has a full buffer, the write will block. If the
> driver is still writing when this happens, and the driver → server stream also
> fills up, we deadlock."

For a batch that returns nothing, the per-entry estimate is
`NODATA_QUERY_RESPONSE_SIZE_BYTES`, `250` in the source, so a forced Sync lands
roughly every `64000 / 250 ≈ 256` entries. That is arithmetic on two constants,
not a measurement, and the driver's own comment calls the estimate "coarse" — but
the shape is the point: **a five-thousand-entry batch under autocommit is not one
implicit transaction, it is about twenty of them, and a failure in the middle
leaves the earlier ones committed.**

🔴 **If you want all-or-nothing, say so.** `setAutoCommit(false)` and an explicit
`commit()` is the only form that means what you want across drivers, and on
pgJDBC it is the only form that survives the forced Sync. PostgreSQL's own
loading advice agrees, for a second reason: *"If you allow each insertion to be
committed separately, PostgreSQL is doing a lot of work for each row that is
added."*

## Gotchas

**⚠️ `addBatch(String)` on a `PreparedStatement`**
**Symptom:** an `SQLException` from a line the compiler accepted; IDE completion
offered the overload.
**Cause:** the javadoc bans it — "This method cannot be called on a
`PreparedStatement` or `CallableStatement`." The `String` form is for `Statement`,
where entries are different SQL; the no-arg form is for bound parameter sets.
**Fix:** `ps.addBatch()` with no argument, after the `setXxx` calls.

**⚠️ Putting a `SELECT` in a batch**
**Symptom:** `BatchUpdateException` on a statement that is syntactically perfect.
**Cause:** `executeBatch` throws "if one of the commands sent to the database
fails to execute properly **or attempts to return a result set**". pgJDBC makes
this concrete by setting `QUERY_NO_RESULTS` for any batch that did not ask for
generated keys — the source comment is "disallow any result set".
**Fix:** batches are for DML. To read many rows in one trip, use one query with
`= ANY(?)`, as in [chunk 8](08-in-lists-and-like-patterns.md).

**⚠️ A zero count treated as success**
**Symptom:** an `UPDATE ... WHERE id = ?` batch that reports no error and changes
nothing, because the ids were stale.
**Cause:** zero rows affected is a perfectly successful command, and batching
removes the per-statement `executeUpdate()` return value people habitually check.
**Fix:** inspect the array for zeros under autocommit, or make the intent
explicit with `RETURNING` and generated-keys retrieval
([chunk 19d](19d-generated-keys-from-a-batch.md)).

**⚠️ Expecting autocommit to commit row by row**
**Symptom:** a batch that was supposed to be "best effort per row" rolls back
several hundred rows at a time.
**Cause:** with no Sync between entries, PostgreSQL opens an implicit transaction
block; the driver only Syncs at the end, or when the receive-buffer estimate
forces one.
**Fix:** if you genuinely want per-row independence, do not batch — or accept the
segment granularity and make the operation idempotent so a retry is safe.

**⚠️ Reusing the statement after a failed batch without clearing**
**Symptom:** uncertainty about whether the failed entries are still queued.
**Cause:** the spec does not say. pgJDBC happens to clear `batchStatements` and
`batchParameters` at the *start* of `internalExecuteBatch`, so the queue is empty
even after a throw — but that is driver behaviour, not a guarantee.
**Fix:** call `clearBatch()` in your own recovery path if you intend to reuse the
statement. It is cheap and it makes the intent portable.

## Interview questions

**★ Why is batching faster, given the database does the same work per row?**
Because it removes the stop-and-wait. Without a batch, the driver sends one
statement, flushes, and blocks reading the reply before it can send the next — so
N inserts is N sequential network round trips, and on anything but a loopback
connection that latency dwarfs the server-side cost of an insert. A batch writes
every Bind and Execute message back to back and issues one Sync at the end, which
is precisely what PostgreSQL's protocol documentation calls pipelining. Note what
that does *not* include: it does not save parsing or planning — server-side
preparation does that, and independently — and it does not make the insert itself
cheaper. So batching helps enormously across a network and much less against a
local database, and it never fixes a slow statement. If each row's `UPDATE` is
doing a sequential scan, batching a thousand of them just pipelines a thousand
sequential scans.

**★ Is a batch a transaction?**
Not by specification, and the honest answer starts there: JDBC says nothing about
batch atomicity, so portable code must not rely on it. On PostgreSQL it is
subtler and more interesting. pgJDBC does not send a `BEGIN` under autocommit —
you can see the `QUERY_SUPPRESS_BEGIN` flag being set in `internalExecuteBatch` —
but it also does not Sync between entries, and the server's rule is that a
command ending without a Sync opens an implicit transaction block that commits or
rolls back at the next Sync. So an autocommit batch on pgJDBC *is* atomic, per
Sync segment. And the driver can insert a segment boundary you did not ask for:
`flushIfDeadlockRisk` forces a Sync when its estimate of outstanding response
bytes approaches 64000, to avoid a TCP deadlock between the two write buffers. If
you need all-or-nothing, `setAutoCommit(false)` and commit explicitly — that is
the only form that says so.

**★ Why does `addBatch` have two forms, and why is one of them forbidden here?**
`Statement` batching and `PreparedStatement` batching are different features that
share a name. A `Statement` batch is a list of complete SQL strings, so
`addBatch(String)` is the only way to express it. A `PreparedStatement` batch is
one SQL string with many *parameter sets*, so the entry is defined by whatever is
currently bound and the method takes no argument. Allowing `addBatch(String)` on
a `PreparedStatement` would mean two conflicting notions of what an entry is, so
the javadoc forbids it and drivers throw. It also matters for performance:
`Statement` batching sends N distinct SQL texts, none of which can reach the
server-side preparation threshold, whereas `PreparedStatement` batching sends one
text and N bind sets — which is the only form the insert-rewrite optimisation can
work with at all.

**★ Does batching interact with server-side prepared statements?**
Yes, and favourably in the ordinary case. A batch is by definition the same SQL
text executed many times on one connection, which is exactly the condition
[chunk 9](09-server-side-prepared-statements.md) describes for pgJDBC's execution
counter to reach `prepareThreshold` and switch to a named statement. So batch
workloads are among the few where preparation reliably pays for itself. The
interaction turns hostile only when the SQL text stops being constant — a
generated `IN` list per entry, or the derived multi-values statements that
`reWriteBatchedInserts` produces, each of which is a separate text competing for
the same per-connection statement cache. And the plan risk from
[chunk 10](10-the-generic-plan-cliff.md) applies unchanged: a batch is the fastest
way to reach the sixth execution.

**★ When should you not batch at all?**
When the round trip is not the bottleneck, and when a better primitive exists.
Against a local database with a genuinely slow statement, batching pipelines the
slowness and changes nothing. For a bulk load, PostgreSQL's own documentation is
unambiguous that batching is the wrong tool: "loading a large number of rows
using `COPY` is almost always faster than using `INSERT`, even if `PREPARE` is
used and multiple insertions are batched into a single transaction". And for
reads, batching is not available at all — a batch may not return a result set —
so the equivalent optimisation is one query with an array parameter rather than
many queries pipelined. The decision procedure is short: reading many rows, use
one query; loading many rows into a table, use `COPY`; applying many different
DML statements, batch them.

---

**Continue:** [19b · When a batch fails](19b-when-a-batch-fails.md) — what the
three update-count values really mean, the exception chain, why every count reads
`EXECUTE_FAILED` inside a transaction, and the exception chain. Then
[19c · Insert rewriting](19c-insert-rewriting.md),
[19d · Generated keys from a batch](19d-generated-keys-from-a-batch.md) and
[19e · Sizing a batch](19e-sizing-a-batch.md).

---
← Prev: [18 · Ownership and leaks](18-ownership-and-leaks.md) · Index: [JDBC](README.md) · Next → [19b · When a batch fails](19b-when-a-batch-fails.md)
