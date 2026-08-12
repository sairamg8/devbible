---
title: "pg-cursor streaming"
sidebar_label: "15 · Cursors"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, `pg-cursor` 2.22.0. Script:
> `sandbox/pg-api/ex22-notify-cursor-pgjs.mjs`.

**`pool.query` reads every row into memory before it resolves. On a result big enough,
that is the whole result in your heap at once. A cursor fetches in batches, so memory
stops depending on how many rows there are.**

> The full treatment — the stream API, backpressure, MongoDB's equivalent, and the
> batching pattern that beats both — is
> [Cursors](/docs/nodejs/pages/phase-6-data-access/cursors) in the Node syllabus. This
> page is the PostgreSQL-side mechanics.

## What buffering costs

```console
$ node --expose-gc ex22-notify-cursor-pgjs.mjs
=== 2. streaming a large result ===
baseline heap 7 MB
pool.query  → 300000 rows buffered, heap 7 → 108 MB (+101)
  after releasing it and collecting: 7 MB
pg-cursor   → 300000 rows in 300 batches of 1000, heap 7 → peak 59 MB (+52)
```

`pool.query` grew the heap by **101 MB** for 300 000 rows, and that growth is
proportional to the result: ten times the rows is ten times the memory, until the process
dies. The `Result` is not returned until the last row has arrived, so the latency is the
full query too.

The cursor's peak of 59 MB is **not** its live set — it is one batch of 1000 rows plus
garbage from the previous 299 that the collector had not yet reclaimed. The number that
matters is that it does not depend on the result size: the same loop over 3 million rows
peaks in the same place, while `pool.query` would not survive it.

## Using it

```js
import Cursor from 'pg-cursor';

const client = await pool.connect();
try {
  const cursor = client.query(new Cursor('SELECT * FROM big_table ORDER BY id'));
  for (;;) {
    const rows = await cursor.read(1000);
    if (rows.length === 0) break;
    await handleBatch(rows);
  }
  await cursor.close();
} finally {
  client.release();
}
```

Three requirements:

- **A checked-out client.** A cursor is session state, so `pool.query` cannot carry one
  ([`Pool` vs `Client`](02-pool-vs-client.md)).
- **`read(n)` until it returns an empty array.** That is the termination condition.
- **`close()` then `release()`.** Releasing a client with an open cursor returns a
  connection in an unknown state.

Batch size trades round trips against memory. 100–1000 covers most cases; 1 is a round
trip per row and pointless.

## Server-side cursors need a transaction

```console
DECLARE/FETCH → 1,2,3
FETCH after COMMIT → 34000 cursor "srv_cur" does not exist
```

```sql
BEGIN;
DECLARE srv_cur CURSOR FOR SELECT id FROM cur_t;
FETCH 3 FROM srv_cur;
COMMIT;                 -- the cursor is gone
```

A `DECLARE`d cursor lives until the transaction ends — measured, `34000` immediately
after `COMMIT`. `WITH HOLD` makes one outlive its transaction, at the price of the server
materialising the entire result at commit time, which gives back most of what you came
for.

`pg-cursor` uses the protocol-level portal rather than `DECLARE`, so you do not manage
this yourself — but the same rule applies: the cursor is bound to the connection and does
not survive it.

## The transaction that comes with it

Streaming 300 000 rows takes as long as it takes, and the cursor holds a snapshot for the
whole time. A long-running read transaction pins the xmin horizon and stops `VACUUM`
reclaiming dead tuples **database-wide**
([MVCC](../phase-11-mvcc/), [Timeouts](11-timeouts.md)).

So an hourly export that streams for twenty minutes is also twenty minutes during which
nothing gets vacuumed. That is the hidden cost, and it is why keyset batching is often the
better answer:

```js
let after = 0;
for (;;) {
  const {rows} = await pool.query(
    `SELECT * FROM big_table WHERE id > $1 ORDER BY id LIMIT 1000`, [after]);
  if (!rows.length) break;
  await handleBatch(rows);
  after = rows.at(-1).id;
}
```

Each iteration is its own short transaction on a pooled connection — no long snapshot, no
held client, interruptible and resumable. It costs an index lookup per batch and it sees
rows committed *during* the run, which a cursor's stable snapshot does not
([Row constructors and keyset](../phase-4-crud/20-tuple-comparison.md)).

Choose by whether you need a consistent snapshot: a financial export, yes — a cursor. A
re-processing job, no — keyset.

## `COPY` for pure export

If the destination is a file or an HTTP response and no per-row JavaScript is involved,
neither of these is right — `COPY … TO STDOUT` streams formatted bytes with no row
objects at all
([`COPY` from streams](../phase-8-schema-from-node/09-copy-streams.md)).

## Trade-off

A cursor bounds memory regardless of result size and starts delivering rows immediately,
at the cost of a checked-out connection, an open transaction with a long-lived snapshot,
and a round trip per batch.

`pool.query` is simpler and faster for results that fit comfortably — which is nearly all
of them. Reach for a cursor when the row count is unbounded or driven by user input, not
because a table is "big".

## Gotchas

**Symptom:** The process is OOM-killed on a report endpoint
**Cause:** `pool.query` buffering the whole result — measured, +101 MB for 300 000 rows,
scaling linearly.
**Fix:** A cursor, keyset batching, or `LIMIT`.

**Symptom:** `34000 cursor "…" does not exist`
**Cause:** The transaction that declared it ended.
**Fix:** Keep the transaction open, or use `WITH HOLD` and accept the materialisation.

**Symptom:** The pool is exhausted during a long export
**Cause:** A cursor holds its client for the entire run.
**Fix:** Size for it, or use keyset batching on pooled connections.

**Symptom:** Table bloat grows during nightly exports
**Cause:** A long read transaction blocking `VACUUM` database-wide.
**Fix:** Keyset batching in short transactions.

**Symptom:** `cursor.read()` never returns an empty array
**Cause:** The loop's exit condition tests `rows` rather than `rows.length`.
**Fix:** An empty array is truthy — test the length.

**Symptom:** Streaming is slower than a plain query
**Cause:** A batch size that is too small — one round trip per batch.
**Fix:** Raise it to 500–1000.

## Interview questions

**★ What happens to memory when you `pool.query` a very large result?**
The whole result is buffered before the promise resolves — measured, the heap grew by
101 MB for 300 000 rows, proportional to the row count, and the first row is not available
until the last has arrived. A cursor reading 1000 at a time keeps the live set to one
batch regardless of total size.

**★ What does a cursor require that `pool.query` does not?**
A checked-out client, because the cursor is session state, and an open transaction for a
server-side `DECLARE`d cursor — measured, `FETCH` after `COMMIT` fails with `34000`. You
must `close()` the cursor before releasing the client.

**★ What is the hidden cost of streaming a large result?**
The transaction stays open for the whole stream, holding a snapshot that pins the xmin
horizon and prevents `VACUUM` reclaiming dead tuples across the database. A twenty-minute
export is twenty minutes of no vacuuming.

**★ When would you batch with keyset pagination instead of using a cursor?**
When you do not need a consistent snapshot. Keyset batching runs each chunk as its own
short transaction on a pooled connection, so nothing is held open, and the job is
interruptible and resumable. A cursor is right when the export must reflect one point in
time.

**How do you export a large table to a file?**
`COPY … TO STDOUT` with `pg-copy-streams` — no row objects are constructed at all, so it
is faster and lighter than either approach here.

---

← [LISTEN/NOTIFY from Node](14-listen-notify.md) · Next → [pg vs postgres.js](16-postgres-js.md)
