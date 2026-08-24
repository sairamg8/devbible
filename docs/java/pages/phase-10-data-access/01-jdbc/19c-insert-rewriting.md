---
title: "reWriteBatchedInserts turns one SQL text into up to fifteen, throws your update counts away, and silently does nothing if the insert has a RETURNING clause"
sidebar_label: "19c · Insert rewriting"
sidebar_position: 19.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the pgJDBC *Connection Parameters* documentation
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> the pgJDBC 42.7.x source for `PGProperty`, `BatchedQuery`,
> `PgPreparedStatement.transformQueriesAndParameters`, `SqlCommand`, `Parser` and
> `BatchResultHandler`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)), the JDK 25 API
> for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> and the PostgreSQL 18 manual §55.7 *Message Formats*
> ([postgresql.org/docs/18/protocol-message-formats.html](https://www.postgresql.org/docs/18/protocol-message-formats.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no
> console output.

**`reWriteBatchedInserts=true` is the highest-leverage single character of
configuration in pgJDBC and the one with the most surprising side effects. It
takes a batch of `INSERT ... VALUES (?, ?, ?)` and merges the rows into
multi-values statements, which the driver's own documentation says "provides 2-3x
performance improvement". What the documentation does not say, and what you
discover in production, is the rest: the merge happens in *powers of two*, so one
SQL text becomes several derived texts all competing for the same
[per-connection statement cache](09-server-side-prepared-statements.md); your
update counts become `SUCCESS_NO_INFO` because the server returns one count for a
group and the driver refuses to guess how it split; and the whole optimisation
turns itself off — silently, with no warning and no log line at default levels —
the moment the statement has a `RETURNING` clause, which is exactly what asking
for generated keys adds. So the two features people most want together are
mutually exclusive on this driver, and nothing tells you.**

## What the rewrite actually does

The parameter's documented behaviour, verbatim:

> "This will change batch inserts from insert into foo (col1, col2, col3) values
> (1, 2, 3) into insert into foo (col1, col2, col3) values (1, 2, 3), (4, 5, 6)
> this provides 2-3x performance improvement"

Default is **`false`**. That is worth pausing on: the biggest batch-insert win
pgJDBC has is off unless you ask for it, and it is off for the reasons this chunk
is about.

Why it helps *on top of* batching is a different mechanism from the round-trip
saving in [chunk 19](19-batch-updates.md). Batching already removed the waiting.
Rewriting removes *statement executions*: a thousand Bind/Execute pairs become a
handful of Bind/Execute pairs, so the server does per-statement work a handful of
times instead of a thousand, and the parameters travel in far fewer messages.

## The merge is a power-of-two decomposition

This is the part that has no documentation outside the source, and it explains
several otherwise baffling observations. `PgPreparedStatement.transformQueriesAndParameters`
computes a per-statement row ceiling and then peels the batch apart into
power-of-two blocks:

```java
final int rowCeiling = configuredSize > 0
    ? Math.min(configuredSize, BatchedQuery.MAX_VALUE_BLOCK)
    : BatchedQuery.MAX_VALUE_BLOCK;
...
maxValueBlocks = Integer.highestOneBit(
    Math.max(1, Math.min(maximumNumberOfParameters() / bindCount, rowCeiling)));
```

and then, per iteration, `valueBlock = Integer.highestOneBit(unprocessedBatchCount)`
whenever fewer than `maxValueBlocks` rows remain. The number of derived
statements is `fullValueBlocksCount + Integer.bitCount(remainder)` — the
population count of the leftover.

Work it through for `INSERT INTO ledger_entry (account_id, cents, occurred_at)
VALUES (?, ?, ?)`, three bind parameters per row:

| Batch size | Blocks the driver builds | Statements sent |
|---|---|---|
| 1024 | 1024 | **1** |
| 1000 | 512 + 256 + 128 + 64 + 32 + 8 | **6** |
| 1001 | 512 + 256 + 128 + 64 + 32 + 8 + 1 | **7** |
| 100000 | 6 × 16384, then 1024 + 512 + 128 + 32 | **10** |

🔴 **So a batch size that is a power of two produces exactly one statement, and a
round decimal number produces six or seven.** `Integer.bitCount(1000)` is 6;
`Integer.bitCount(1024)` is 1. If you are going to chunk anyway — and
[chunk 19e](19e-sizing-a-batch.md) argues you must — chunk in powers of two. It
is free.

⚠️ **Each distinct block size is a distinct SQL text**, because the `VALUES`
list is literally longer. `BatchedQuery` caches them: `blocks = new
BatchedQuery[Integer.numberOfTrailingZeros(MAX_VALUE_BLOCK)]`, so **at most 15
derived statements** exist per original. Fifteen texts is fifteen entries in the
connection's prepared-statement cache, which defaults to
`preparedStatementCacheQueries=256`, and fifteen independent execution counters
each needing to reach `prepareThreshold` before it is server-prepared. A batch
size that varies run to run keeps generating new block combinations and keeps
none of them hot.

## The ceilings, and where 32768 comes from

```java
public static final int MAX_VALUE_BLOCK = 1 << 15;
```

The source comment gives the derivation, and it is a protocol fact rather than an
arbitrary choice:

> "A single `Bind` message can carry at most `65535` parameters, so a
> one-parameter row reaches `65535 / 1` rows, which rounds down to `2^15`."

That 65535 is the `Int16` parameter count in the Bind message — PostgreSQL's
message-format documentation defines the field as "**Int16** — The number of
parameter values that follow (possibly zero)."

So the effective row cap is `min(65535 / parametersPerRow, 32768)`, rounded down
to a power of two. Three parameters per row gives `min(21845, 32768)` → 16384.
Ten parameters per row gives `min(6553, 32768)` → 4096. `reWriteBatchedInsertsSize`
lowers it and never raises it — its own description says the value is "Rounded
down to a power of two and capped at 32768 rows; with the extended protocol also
capped at 65535/parametersPerRow. A value of `0`, the default, uses that maximum."

⚠️ **Wide rows shrink the block hard.** A thirty-column insert gets
`65535 / 30 = 2184` → 2048 rows per statement. That is still an enormous win over
one statement per row, but it means the "one statement per chunk" arithmetic above
depends on your column count, not just your chunk size.

## What you give up: the update counts

`BatchResultHandler.uncompressLongUpdateCount` has to map the server's per-
*statement* counts back onto your per-*entry* array, and it cannot:

```java
if (superBatchResult > 0) {
  // If some rows inserted, we do not really know how did they spread over individual
  // statements
  superBatchResult = Statement.SUCCESS_NO_INFO;
}
Arrays.fill(newUpdateCounts, offset, offset + batchSize, superBatchResult);
```

**Every entry in a merged block comes back as `SUCCESS_NO_INFO`.** That is the
javadoc's "the command was processed successfully but that the number of rows
affected is unknown", and here it is literally true — the server said "1000" for
one statement and the driver will not invent a distribution.

For an `INSERT` this usually costs nothing, because you already know how many
rows you added. It costs a great deal if any code downstream was reading the
counts to detect a no-op. Note the interaction with
[chunk 19b](19b-when-a-batch-fails.md): entries that were not part of a merged
block keep their real counts, so a single array can contain both real numbers and
`SUCCESS_NO_INFO`.

## The silent no-op: `RETURNING` disables it

`SqlCommand` decides compatibility, and the conditions are all-or-nothing:

```java
public boolean isBatchedReWriteCompatible() {
  return valuesBraceOpenPosition >= 0;
}
```

`valuesBraceOpenPosition` is only set when **all** of these hold: the command is
an `INSERT`, the rewrite property is enabled, the parser found the `VALUES (`
… `)` braces, **no `RETURNING` keyword is present**, and it is the only statement
in the string.

That last-but-one condition is the trap, because you can add a `RETURNING` clause
without typing one. pgJDBC implements `getGeneratedKeys` by rewriting your SQL —
`Parser.addReturning` appends `"\nRETURNING "` followed by `*` or your named
columns. So:

```java
// rewrite applies
c.prepareStatement("INSERT INTO ledger_entry (account_id, cents) VALUES (?, ?)");

// rewrite silently does NOT apply — the driver appended RETURNING id
c.prepareStatement("INSERT INTO ledger_entry (account_id, cents) VALUES (?, ?)",
                   new String[] { "id" });
```

🔴 **There is no warning.** The batch runs, correctly, at un-rewritten speed. The
only way to notice is that the improvement you configured did not appear. Other
shapes that quietly fail the same test: `INSERT ... SELECT` (no `VALUES` braces),
a multi-statement string, and — obviously — anything that is not an `INSERT`.

## Gotchas

**⚠️ Turning on `reWriteBatchedInserts` and then reading the update counts**
**Symptom:** a validation step that counted affected rows starts failing, or a
metric goes negative, right after a config change nobody connected to it.
**Cause:** merged entries all report `SUCCESS_NO_INFO`, a negative constant,
because the server returns one count per merged statement.
**Fix:** stop deriving row counts from the array on inserts. If you truly need
them, you cannot have the rewrite.

**⚠️ Enabling the rewrite and seeing no improvement at all**
**Symptom:** the parameter is set, the batch is `INSERT`, nothing changes.
**Cause:** almost always a `RETURNING` clause — usually one the driver added
because you asked for generated keys. Other causes: `INSERT ... SELECT`, a
multi-statement string, or a `VALUES` list the parser could not brace-match.
**Fix:** check whether the `prepareStatement` call passes column names or
`RETURN_GENERATED_KEYS`. Choose one of the two features.

**⚠️ Forgetting the parameter ceiling on wide rows**
**Symptom:** a thirty-column insert merges far fewer rows per statement than a
three-column one, and the win is smaller than advertised.
**Cause:** the cap is `min(65535 / parametersPerRow, 32768)` because a Bind
message's parameter count is an `Int16`.
**Fix:** none needed — but size expectations by parameters, not by rows, and
consider whether that many columns need to be in the hot path.

**⚠️ Setting `reWriteBatchedInsertsSize` expecting it to raise the cap**
**Symptom:** `reWriteBatchedInsertsSize=100000` and blocks still capped at 32768
or lower.
**Cause:** the value is a `Math.min` against the ceiling and is then rounded down
to a power of two. It can only lower.
**Fix:** use it to *reduce* per-statement size — for example to keep a single
statement's memory footprint down — not to grow it.

## Interview questions

**★ What does `reWriteBatchedInserts` do, and why is it off by default?**
It merges consecutive batched `INSERT ... VALUES (...)` entries into multi-values
statements — the driver's documentation shows `values (1, 2, 3)` becoming
`values (1, 2, 3), (4, 5, 6)` and claims "2-3x performance improvement". It is a
different saving from batching itself: batching removed the round trips, this
removes statement executions, so the server does per-statement work a handful of
times rather than once per row. It is off by default because it changes
observable behaviour, not just speed. Merged entries report `SUCCESS_NO_INFO`
instead of real update counts, one SQL text becomes up to fifteen derived texts
competing for the statement cache, and it is incompatible with `RETURNING`. A
driver cannot turn that on for you without breaking somebody's row-count check,
so it asks.

**★ Why does the driver merge in powers of two rather than just filling to the
cap?**
Because each distinct block size is a distinct SQL string that must be parsed,
cached and — ideally — server-prepared, and powers of two bound how many such
strings can ever exist. `BatchedQuery` allocates its cache as
`Integer.numberOfTrailingZeros(MAX_VALUE_BLOCK)` slots, so at most fifteen
derived statements per original, no matter what batch sizes the application
uses. Filling greedily to an arbitrary remainder would generate a new SQL text
for every distinct batch size the application ever produces, and none of them
would ever get hot. The visible consequence is that the number of statements sent
for a chunk below the ceiling is `Integer.bitCount(chunkSize)` — so 1024 rows go
in one statement and 1000 rows go in six. Chunking in powers of two is a free win
that most people never learn about.

**★ Where does the 32768 row limit come from?**
From the wire protocol, not from a tuning decision. A Bind message's parameter
count field is an `Int16`, so a single statement can carry at most 65535 bound
parameters. The driver's cap is `min(65535 / parametersPerRow, 32768)` rounded
down to a power of two, and 32768 is `2^15` — the largest power of two a
one-parameter row can reach under the 65535 limit. The practical reading is that
the cap is really about *parameters*, not rows: a three-column insert can merge
16384 rows, a thirty-column insert only 2048. It also explains why
`preferQueryMode=simple` is not subject to the same arithmetic — it inlines
parameters into the query text, so there is no Bind parameter count at all, and
only the 32768 ceiling applies.

**★ You enabled the rewrite and nothing changed. What do you check?**
Whether the statement has a `RETURNING` clause — and specifically whether *you*
added one, because the most common cause is that the code asks for generated
keys. pgJDBC implements `getGeneratedKeys` by appending `RETURNING` to your SQL
in `Parser.addReturning`, and `SqlCommand` marks any statement with a `RETURNING`
keyword as rewrite-incompatible. The two features are mutually exclusive on this
driver and nothing warns you: the batch runs correctly, just un-merged. After
that, check the other compatibility conditions — the command must be an `INSERT`
with a parseable `VALUES (...)` list and must be the only statement in the
string, so `INSERT ... SELECT` and multi-statement strings are out. If all of
those pass, check the batch size: a chunk of one entry has nothing to merge.

**★ How does insert rewriting interact with server-side prepared statements?**
It multiplies the cache pressure and dilutes the execution counters. Preparation
in pgJDBC is keyed by SQL text on a physical connection, and the counter has to
reach `prepareThreshold` — default 5 — before the driver creates a named
statement. Rewriting turns one text into as many as fifteen, each with its own
counter, so a workload that would have prepared one statement now needs five
executions of *each block size* it happens to produce. With a fixed power-of-two
chunk size that is fine: you generate one or two texts and they go hot quickly.
With a batch size that varies with input, you generate a shifting set of block
combinations, none of which accumulates executions, and you can end up paying
parse cost forever while also filling the 256-entry statement cache. That is a
concrete argument for fixed chunk sizes that has nothing to do with memory.

---

**Continue:** [19d · Generated keys from a batch](19d-generated-keys-from-a-batch.md),
then [19e · Sizing a batch](19e-sizing-a-batch.md).

---
<!--FOOTER-->
