---
title: "The whole batch is resident in your heap before a single byte leaves the JVM, so the chunk size is a memory decision before it is a performance one"
sidebar_label: "19e · Sizing a batch"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the pgJDBC *Connection Parameters* documentation
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> the pgJDBC 42.7.x source for `PgStatement`, `PgPreparedStatement`,
> `QueryExecutorImpl` and `BatchResultHandler`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)), and the
> PostgreSQL 18 manual Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no
> console output.

**Nothing about batching forces you to pick a size, and that is exactly why
people do not — they batch "the input", and the input turns out to be a
forty-million-row file. Four independent costs scale with the number you did not
choose, and each of them fails differently. The batch accumulates entirely in
your heap before a single byte is sent, so a large one OOMs the client before the
database ever sees it — and if you asked for generated keys, the returned rows
accumulate in your heap too, in a `ResultSet` that cannot stream. A failure at
entry 39,999,999 discards all forty million. And the two costs that land on the
*server* — one shared timeout and a transaction holding every row lock until
commit — are [chunk 19f](19f-timeouts-and-cancellation.md)'s and
[chunk 19g](19g-locks-and-long-transactions.md)'s subject. There is no
formula for the right number, but there is a shape: a fixed size, a power of two,
committed per chunk, with an idempotent statement so a retry after a partial run
is safe.**

## The batch is in your heap before it is anywhere else

`addBatch()` does not send anything. pgJDBC appends a `ParameterList` to a
client-side `ArrayList` on the statement, and `internalExecuteBatch` only
converts those lists to arrays and hands them to the query executor when you call
`executeBatch()`. Until that moment the entire batch — every bound value, boxed
and encoded — is resident in your JVM.

That is the first size limit, and it is the one that bites in a data-loading job:
the OOM happens in the code that *builds* the batch, nowhere near any SQL, and it
looks like a memory leak rather than a design decision.

If you asked for generated keys, the same is true on the way back.

## The keys `ResultSet` is in your heap, and it is not streamable

The keys `ResultSet` is not a cursor over a server-side portal. It is a
`PgResultSet` the driver constructs and then appends tuples to, one entry's worth
at a time, as the batch's responses arrive. Two consequences follow directly, and
both surprise people who know [chunk 15](15-fetch-size-and-streaming.md):

- **`setFetchSize` does nothing to it.** There is no cursor to page. The four
  conditions for streaming are not merely unmet, they are inapplicable.
- **Its memory is proportional to the whole batch.** A hundred-thousand-row batch
  with `RETURNING *` materialises a hundred thousand full rows client-side, on top
  of the hundred thousand parameter lists you already accumulated to build the
  batch.

So [generated keys](19d-generated-keys-from-a-batch.md) are a multiplier on chunk
size, not a free extra: the same number of entries costs you the parameters on
the way out *and* the returned rows on the way back.

## The shape of a chunked load

```java
private static final int CHUNK = 1024;   // a power of two, on purpose

long load(Iterator<Entry> source) throws SQLException {
    long written = 0;
    try (Connection c = dataSource.getConnection();
         PreparedStatement ps = c.prepareStatement(SQL)) {
        c.setAutoCommit(false);
        int inChunk = 0;
        while (source.hasNext()) {
            Entry e = source.next();
            ps.setLong(1, e.accountId());
            ps.setLong(2, e.cents());
            ps.setObject(3, e.occurredAt());
            ps.addBatch();
            if (++inChunk == CHUNK) {
                ps.executeBatch();
                c.commit();               // the chunk is the unit of durability
                written += inChunk;
                inChunk = 0;
            }
        }
        if (inChunk > 0) {                // the ragged tail
            ps.executeBatch();
            c.commit();
            written += inChunk;
        }
    }
    return written;
}
```

Three things about that loop are deliberate. **The `PreparedStatement` is created
once, outside the loop**, so its SQL text keeps accumulating executions towards
`prepareThreshold` ([chunk 9](09-server-side-prepared-statements.md)) instead of
starting over. **The commit is inside**, so the chunk is the unit of durability
and a crash costs one chunk. And **the tail is handled separately**, because
`source` will not divide evenly and a forgotten tail silently drops rows — a bug
that only shows up on inputs whose size is not a multiple of `CHUNK`.

## Choosing the number

There is no universal answer, but there are constraints that narrow it a lot:

| Pressure | Pushes the size | Because |
|---|---|---|
| Client heap | **down** | every entry's parameters are resident until `executeBatch` |
| Round trips | **up** | the whole point of batching; the marginal saving flattens quickly |
| [Lock duration and deadlock risk](19g-locks-and-long-transactions.md) | **down** | a transaction holds every row lock until commit |
| [`setQueryTimeout`](19f-timeouts-and-cancellation.md) | **down** | one timeout covers the whole call |
| Retry cost on failure | **down** | a failure discards the chunk |
| [Insert rewriting](19c-insert-rewriting.md) | **up, and to a power of two** | `Integer.bitCount(chunkSize)` is the number of statements sent |

🔴 **Make it a power of two.** It costs nothing and, if `reWriteBatchedInserts`
is ever switched on, it is the difference between one statement per chunk and six.
🔴 **Make it fixed.** A size that varies with the input keeps generating new
derived SQL texts, none of which stays hot in the statement cache.
🔴 **Count parameters, not rows.** A thirty-column insert at 4096 rows is 122,880
bound values; the same chunk size means something very different for a
two-column table.

## Gotchas

**⚠️ Building an unbounded batch from a stream**
**Symptom:** an OOM in the job that reads a file and writes it to the database,
long before any SQL is slow.
**Cause:** every `addBatch()` appends a `ParameterList` to a client-side
`ArrayList` that is not submitted until `executeBatch()`. The whole batch lives
in your heap, in full, in parameter form.
**Fix:** a fixed chunk size, and a loop shaped like the one above.

**⚠️ Forgetting the ragged tail**
**Symptom:** a load that drops up to `CHUNK - 1` rows, only on inputs whose size
is not a multiple of the chunk.
**Cause:** the `executeBatch()` inside the loop only fires on the boundary.
**Fix:** the trailing `if (inChunk > 0)`. Assert the returned total against the
source count.

**⚠️ Recreating the `PreparedStatement` per chunk**
**Symptom:** server-side preparation never engages on a long-running load.
**Cause:** the execution counter lives on the connection keyed by SQL text, but
recreating the statement per chunk also throws away the driver-side cached query
and, on a pooled connection cycled by `maxLifetime`, the count restarts anyway.
**Fix:** hoist the statement out of the chunk loop, as above.

**⚠️ Holding a pooled connection for the length of a giant batch**
**Symptom:** connection-acquisition timeouts elsewhere in the service during a
nightly load.
**Cause:** a batch is bound to one `Connection`, and that connection is out of
the pool for the entire submit-and-drain.
**Fix:** chunk, and consider a dedicated `DataSource` with its own small pool for
bulk work so it cannot starve request-serving traffic.

**⚠️ Retrying a failed batch that is not idempotent**
**Symptom:** duplicated rows after a retry that "obviously" only re-ran failed
work.
**Cause:** under autocommit, completed Sync segments are committed; the driver's
watermark tells you where, and a naïve full retry re-applies them.
**Fix:** make the statement idempotent — `ON CONFLICT DO NOTHING`, or a natural
key — or retry only from the first `EXECUTE_FAILED` index.

**⚠️ Chunking in round decimal numbers**
**Symptom:** six or seven distinct statements per chunk where you expected one,
and a statement cache that never settles.
**Cause:** [the rewrite's decomposition](19c-insert-rewriting.md) is by powers of
two, so `Integer.bitCount(chunkSize)` is the statement count for a chunk below the
per-statement row ceiling.
**Fix:** chunk in powers of two — 512, 1024, 2048.

**⚠️ Varying the batch size run to run**
**Symptom:** server-side preparation never seems to engage for the rewritten
statements.
**Cause:** each block size is a distinct SQL text with its own execution counter,
and a varying tail keeps producing different combinations, none of which reaches
`prepareThreshold`.
**Fix:** fixed-size chunks with a single ragged remainder at the end.

**⚠️ Expecting `setFetchSize` to bound the keys `ResultSet`**
**Symptom:** heap pressure proportional to the batch, on a `ResultSet` you
carefully configured to stream.
**Cause:** it is a driver-built result set assembled in memory from the batch's
responses, not a cursor over a server portal.
**Fix:** bound it by bounding the batch.

**⚠️ Expecting the insert rewrite to change the transaction story**
**Symptom:** a belief that merging rows makes the batch "more atomic".
**Cause:** conflating statement count with transaction boundaries.
**Fix:** it changes neither. The Sync placement decides atomicity
([chunk 19](19-batch-updates.md)); merging only changes how many statements sit
between the Syncs. It does, however, make the forced Sync *less* likely, because
there are fewer response messages to estimate.

## Interview questions

**★ How do you choose a batch size?**
By working out which of the four costs binds first, because there is no universal
number. Client heap sets a hard upper bound: every entry's bound parameters are
resident until `executeBatch`, so the OOM lands in the code that builds the
batch. Lock duration and deadlock surface push down, because under a transaction
the batch holds every row lock until commit
([chunk 19g](19g-locks-and-long-transactions.md)). `setQueryTimeout` pushes down on
pgJDBC, because one timer covers the whole call. Retry cost pushes down, because
a failure discards the chunk. Only round-trip saving pushes up, and its marginal
value flattens fast — the jump from 1 to 100 is transformative and from 1000 to
10,000 usually is not. So: something in the low thousands, fixed rather than
input-dependent, and a power of two so that insert rewriting produces one derived
statement rather than six.

**★ How would you make a batch load resumable?**
Accept that partial progress will happen and design for it rather than trying to
prevent it. Chunk the input into fixed units and commit per chunk, so the failure
domain is one chunk rather than the whole load. Make the statement idempotent —
`INSERT ... ON CONFLICT DO NOTHING` against a natural key, or an upsert — so
re-running a chunk that half-committed is harmless. Record the last completed
chunk somewhere durable, ideally in the same transaction as the chunk itself, so
the bookmark cannot drift from the data. Then on failure, quarantine the single
offending row using the entry index from the exception, and reprocess the rest.
The thing to avoid is the design where correctness depends on reading the update
counts after a failure, because inside a transaction those counts are
deliberately uninformative.

**★ Is the generated-keys `ResultSet` streamable?**
No, and the reason is structural rather than a missing feature. Everything in
[chunk 15](15-fetch-size-and-streaming.md) about `setFetchSize` assumes a
server-side portal that the driver pages through. The keys result set is not
that: the driver builds a `PgResultSet` client-side and appends each entry's
tuples to it as the batch's responses arrive, so by the time you call
`getGeneratedKeys()` the whole thing is already in the heap. Its memory is
therefore proportional to the batch size multiplied by the width of the
`RETURNING` list, which is the main practical reason to name one column rather
than using `RETURNING *`, and a second independent reason to keep batches
chunked.

**★ You need the ids of ten million rows you are about to insert. What do you
do?**
Not this. At that scale the right answer is to avoid needing a round trip to
learn the identifier at all: generate the key client-side — a UUID, or a block of
values pulled from a sequence in advance — so the insert is fire-and-forget and
the load can use `COPY` ([chunk 19h](19h-copy-instead-of-batching.md)), which has no
`RETURNING` at all. If the key must be server-generated, then chunk hard, name
exactly one returned column, and accept that insert rewriting is off for the
whole load, which is a large fraction of the batching win. The general principle
is that `getGeneratedKeys` is a convenience for transactional writes of tens or
hundreds of rows, and turns into the dominant cost of a bulk load.

---

**Continue:** [19f · Timeouts and cancellation](19f-timeouts-and-cancellation.md), then
[19g · Locks and long transactions](19g-locks-and-long-transactions.md) and
[19h · When to use `COPY` instead](19h-copy-instead-of-batching.md).

---
← Prev: [19d · Generated keys from a batch](19d-generated-keys-from-a-batch.md) · Index: [JDBC](README.md) · Next → [19f · Timeouts and cancellation](19f-timeouts-and-cancellation.md)
