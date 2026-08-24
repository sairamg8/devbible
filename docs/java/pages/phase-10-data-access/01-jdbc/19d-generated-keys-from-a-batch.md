---
title: "getGeneratedKeys after executeBatch works on pgJDBC, is not in the specification, and hands you a ResultSet that is not guaranteed to line up with your batch"
sidebar_label: "19d · Generated keys from a batch"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the PostgreSQL 18 manual *INSERT* — `RETURNING` and Outputs
> ([postgresql.org/docs/18/sql-insert.html](https://www.postgresql.org/docs/18/sql-insert.html)),
> and the pgJDBC 42.7.x source for `PgStatement.internalExecuteBatch`,
> `BatchResultHandler` and `Parser.addReturning`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no console
> output.

**Retrieving the identifiers a batched `INSERT` generated is one of those
features that sits entirely outside the specification and works anyway. The
`getGeneratedKeys` javadoc describes it against "executing this `Statement`
object" and never mentions batches at all — but pgJDBC accumulates the
`RETURNING` rows from every entry and hands you a single `ResultSet` covering the
whole batch. Which is genuinely useful, and comes with four things nobody tells
you. It disables [insert rewriting](19c-insert-rewriting.md) outright, because
the driver implements it by appending a `RETURNING` clause. It disables binary
transfer for every value in the batch. The `ResultSet` is built in your heap,
row by row, so it is not streamable and not bounded by `setFetchSize`. And
`RETURNING` returns "only rows that were successfully inserted or updated" — so
the moment your statement can decline to insert, the keys `ResultSet` is shorter
than your batch and every index you thought aligned quietly does not.**

## The specification says nothing; the driver says yes

`getGeneratedKeys` is defined as "Retrieves any auto-generated keys created as a
result of executing this `Statement` object. If this `Statement` object did not
generate any keys, an empty `ResultSet` object is returned." Batches are never
mentioned, in that method or in `executeBatch`. So a driver that returns keys
from only the last entry, or an empty set, is conforming.

pgJDBC does the useful thing. `internalExecuteBatch` sets
`QUERY_BOTH_ROWS_AND_STATUS` when the statement was created wanting keys,
`BatchResultHandler.handleResultRows` captures the tuples for each entry, and
`updateGeneratedKeys()` folds them all into one driver-built `PgResultSet`:

```java
for (List<Tuple> rows : allGeneratedRows) {
  generatedKeys.addRows(rows);
}
```

```java
private static final String SQL = """
        INSERT INTO ledger_entry (account_id, cents, occurred_at)
        VALUES (?, ?, ?)
        """;

List<Long> insertAndCollectIds(List<Entry> entries) throws SQLException {
    var ids = new ArrayList<Long>(entries.size());
    try (Connection c = dataSource.getConnection()) {
        c.setAutoCommit(false);
        //  name the column — do NOT use RETURN_GENERATED_KEYS
        try (PreparedStatement ps = c.prepareStatement(SQL, new String[] { "id" })) {
            for (Entry e : entries) {
                ps.setLong(1, e.accountId());
                ps.setLong(2, e.cents());
                ps.setObject(3, e.occurredAt());
                ps.addBatch();
            }
            ps.executeBatch();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                while (keys.next()) {
                    ids.add(keys.getLong(1));
                }
            }
        }
        c.commit();
    }
    return ids;
}
```

## Name the columns, always

`Statement.RETURN_GENERATED_KEYS` looks like the obvious constant and is the
wrong one here. pgJDBC implements generated keys by rewriting your SQL in
`Parser.addReturning`, which appends `"\nRETURNING "` and then, for the
`RETURN_GENERATED_KEYS` form, a bare `*`:

```java
nativeSql.append("\nRETURNING ");
if (returningColumnNames.length == 1 && returningColumnNames[0].charAt(0) == '*') {
  nativeSql.append('*');
  return true;
}
```

`RETURNING *` returns **every column of every inserted row**. On a single insert
that is a rounding error. On a ten-thousand-row batch it is your entire payload
coming back across the wire and into a client-side `ResultSet`, to be discarded
after you read one `long` from each row. `prepareStatement(sql, new String[]
{ "id" })` returns one column, and the identifiers are quoted safely by
`Utils.escapeIdentifier` when `quoteReturningIdentifiers` is on.

## What asking for keys costs

Three costs, all visible in `internalExecuteBatch`, and all of them arrive
together the moment you pass column names:

| Cost | Why | Source |
|---|---|---|
| **Insert rewriting is off** | `SqlCommand` marks any statement carrying a `RETURNING` keyword as not rewrite-compatible, and the driver just added one | [chunk 19c](19c-insert-rewriting.md) |
| **Binary transfer is off for the whole batch** | `QUERY_NO_BINARY_TRANSFER` is set, because "if the parameter type(s) change between batch entries and the default binary-mode changes we might get mixed binary and text in a single result set column, which we cannot handle" | `internalExecuteBatch` |
| **An extra Describe round trip, and earlier forced Syncs** | the driver describes the statement before batching "so `flushIfDeadlockRisk` can estimate response sizes accurately"; the per-entry estimate becomes the row size instead of 250 bytes | `internalExecuteBatch`, `estimateQueryResponseBytes` |

🔴 **The third one changes the transaction shape.** [Chunk 19](19-batch-updates.md)
explains that pgJDBC forces a Sync when its estimate of outstanding response bytes
approaches `MAX_BUFFERED_RECV_BYTES` (64000). With no result rows the estimate is
250 bytes an entry; with generated keys it is the described row size. A batch that
would have been one implicit transaction under autocommit becomes many, and the
boundaries move when you change the `RETURNING` list.

## The alignment trap

The natural thing to write is that `ids.get(i)` belongs to `entries.get(i)`. That
holds only while every entry inserts exactly one row — and the driver is where
you can see why it does not.

pgJDBC's `handleCommandStatus` collects an entry's generated rows **only when
`updateCount > 0`**. An entry that inserted nothing contributes nothing to the
`ResultSet`: there is no gap, no null, and no marker where its row would have
been. The result set is simply shorter than the batch, and every id after the
first missing row is attributed to the wrong entry.

🔴 **So `INSERT ... ON CONFLICT DO NOTHING` plus `getGeneratedKeys` over a batch
is a silent data-corruption pattern** — no exception, no warning, an off-by-N
that grows with each conflict and surfaces days later as objects pointing at each
other's rows.

The fix is to stop relying on position, and the two forms of it — returning a
correlating column, or making every row return with a real upsert — are worked in
full, with the manual's own wording on what `RETURNING` emits, in
[chunk 20d](20d-batches-and-on-conflict.md). This chunk does not repeat them.

⚠️ **Compare sizes as an assertion, never as a recovery strategy.** If the keys
result yielded fewer rows than the batch had entries, something declined to
insert; that tells you a problem exists, not which entry had it.

## On failure, the collected keys are thrown away

`BatchResultHandler.handleError` clears the accumulator:

```java
if (allGeneratedRows != null) {
  allGeneratedRows.clear();
}
```

and `handleCommandStatus` only collects at all when `getException() == null ||
isProgressDurable()`. So after a `BatchUpdateException` inside a transaction,
`getGeneratedKeys()` returns what was secured before the failure — under an
explicit transaction, nothing. That is the same watermark logic as the update
counts in [chunk 19b](19b-when-a-batch-fails.md), applied to rows instead of
counts, and for the same reason: those rows are about to be rolled back.

## Gotchas

**⚠️ Using `RETURN_GENERATED_KEYS` on a batch**
**Symptom:** far more data comes back than expected, and the batch is slower than
the same batch without keys.
**Cause:** the driver appends `RETURNING *`, so every column of every row
returns, and the rewrite and binary transfer are both off.
**Fix:** `prepareStatement(sql, new String[] { "id" })`.

**⚠️ Assuming the keys line up with the batch by index**
**Symptom:** ids attached to the wrong entities, discovered weeks later, with no
error anywhere in the logs.
**Cause:** `RETURNING` yields rows only for what was actually inserted, and
pgJDBC only collects an entry's rows when its update count was above zero. An
`ON CONFLICT DO NOTHING` skip leaves no placeholder.
**Fix:** return a business key alongside the id and build a map. Assert on the
row count rather than trusting it.

**⚠️ Asking for keys and then wondering where the rewrite went**
**Symptom:** `reWriteBatchedInserts=true` produces no improvement.
**Cause:** the appended `RETURNING` clause makes the statement
rewrite-incompatible. The two features cannot both apply.
**Fix:** decide which you need. For a pure load, skip the keys and read them back
with one query on a natural key; for a small batch where you need the ids, take
the un-merged inserts.

**⚠️ Reading `getGeneratedKeys()` after a failed batch and finding it empty**
**Symptom:** an empty `ResultSet` in the `catch` block.
**Cause:** `handleError` clears the accumulator, and rows are only ever secured
when the connection is in autocommit with no open transaction.
**Fix:** treat the failure as total inside a transaction. Under autocommit, the
secured rows are real — but you still cannot tell which entries they came from
without a returned business key.

**⚠️ Forgetting the keys `ResultSet` is a resource**
**Symptom:** a warning from `leakDetectionThreshold`, or a statement that will
not close.
**Cause:** it is an ordinary `ResultSet` and needs closing like any other, per
[chunk 17](17-resource-handling.md).
**Fix:** `try (ResultSet keys = ps.getGeneratedKeys())`.

**⚠️ Assuming generated-keys-from-a-batch is portable**
**Symptom:** code that works on PostgreSQL returns an empty `ResultSet`, or
throws, on another database.
**Cause:** the javadoc specifies `getGeneratedKeys` against a single execution
and says nothing about batches; accumulating them across a batch is a pgJDBC
behaviour, and `getGeneratedKeys` is allowed to throw
`SQLFeatureNotSupportedException` outright.
**Fix:** if portability matters, insert with a client-generated identifier — a
UUID, or a value from a sequence you fetched in advance — so no round trip is
needed to learn what you just wrote.

**⚠️ Returning a column that is not actually generated**
**Symptom:** the returned "key" is null, or is the value you sent.
**Cause:** `RETURNING` returns the row as it now exists, not only defaulted
columns. Naming a plain column returns your own input back to you.
**Fix:** name the identity, `serial`/`bigserial`, or defaulted column you
actually wanted — and remember that returning a business key deliberately, as
above, is a legitimate use of exactly this behaviour.

## Interview questions

**★ Can you get generated keys back from a batch?**
On pgJDBC, yes: it accumulates the `RETURNING` rows from every entry and
`getGeneratedKeys()` returns a single `ResultSet` covering the whole batch in
order. But the specification does not promise this — the javadoc defines
`getGeneratedKeys` against "executing this `Statement` object" and never mentions
batches — so it is a driver behaviour to depend on deliberately. And it is
expensive in three ways at once: it disables the insert rewrite entirely, it
disables binary transfer for the whole batch (the source cites mixed binary and
text in one result column as the reason), and it forces an extra Describe plus a
much larger per-entry response estimate, which makes the driver's
deadlock-avoidance Syncs fire far sooner. Always name the key columns rather than
using `RETURN_GENERATED_KEYS`, which appends `RETURNING *`.

**★ Why is `getGeneratedKeys` after a batch dangerous with `ON CONFLICT DO
NOTHING`?**
Because the result set shrinks silently. PostgreSQL's documentation is explicit
that `RETURNING` yields "only rows that were successfully inserted or updated",
and pgJDBC only collects an entry's rows when its update count was greater than
zero — so an entry that conflicted contributes no row, no null and no placeholder.
Code that zips the keys against the input list by index is then off by one from
the first conflict onward, attaching every subsequent id to the wrong entity.
There is no exception and nothing in a log to notice. The fix is to stop using
position as the join: return a business key in the `RETURNING` list alongside the
generated id and build a map, so a missing entry is a missing key rather than a
silent shift. Comparing the row count to the batch size is a useful assertion, but
it only tells you that something was skipped, not which.

**★ What happens to the generated keys when a batch fails halfway?**
They follow exactly the same watermark rule as the update counts.
`BatchResultHandler.handleError` clears the accumulated rows outright, and rows
are only added in the first place when there is no pending exception or when
progress is durable — which means autocommit with no open transaction. So inside
an explicit transaction, `getGeneratedKeys()` after a `BatchUpdateException`
gives you nothing, and that is correct, because those rows are about to be rolled
back. Under autocommit, you get the keys from Sync segments that genuinely
committed. Even then you cannot map them back to input entries by position, for
the alignment reason above — so if partial recovery matters, the returned
business key is not optional.

---

**Continue:** [19e · Sizing a batch](19e-sizing-a-batch.md)

---
← Prev: [19c · Insert rewriting](19c-insert-rewriting.md) · Index: [JDBC](README.md) · Next → [19e · Sizing a batch](19e-sizing-a-batch.md)
