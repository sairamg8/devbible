---
title: "Streaming large result sets (cursors)"
sidebar_label: "16 · Cursors and streaming"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0, `pg-cursor` 2.22.0,
> `pg-query-stream` 4.17.0 against PostgreSQL 17.10; `mongodb` 7.5.0 against
> MongoDB 8.2.12. Each figure from a separate process, baseline RSS **78 MB**.

**`pool.query` buffers every row into memory before your code sees any of them.**
For 50 rows that is invisible. For 500 000 it is the report endpoint that kills the
container at 3 a.m. every month-end.

## What `pool.query` does

```js
const {rows} = await pool.query('select id, payload from events');
```

The driver reads every row off the socket, builds every JavaScript object, and
resolves the promise once. Peak memory is the whole result set — plus the row objects,
which are considerably larger than the wire format.

500 000 rows, each with a 200-byte text column:

```console
pool.query           300 MB RSS   1026 ms
```

**222 MB above baseline** for about 100 MB of data. A `--max-old-space-size=256`
container is already dead, and the failure is `JavaScript heap out of memory` with
nothing pointing at the query that caused it.

## A cursor

A cursor asks the server for a batch at a time. The rows stay on the server; you hold
one batch.

```js
import pg from 'pg';
import Cursor from 'pg-cursor';

const client = await pool.connect();
try {
  const cursor = client.query(new Cursor('select id, payload from events'));
  let batch;
  let total = 0;
  while ((batch = await cursor.read(1000)).length > 0) {
    for (const row of batch) total += row.payload.length;
  }
  await cursor.close();
  console.log('total', total);
} finally {
  client.release();
}
```

```console
Cursor.read(1000)    111 MB RSS   1110 ms
```

**33 MB above baseline instead of 222 MB — and it took 8% longer.** That is the whole
trade: essentially the same wall-clock time for a memory profile that does not grow
with the result set.

`cursor.read(n)` returns fewer than `n` rows only at the end, and `[]` when done.
`await cursor.close()` matters — the connection is not reusable until the cursor is
finished or closed.

**It needs a dedicated `client`**, not `pool.query`. A cursor is server-side state
attached to one connection, so it must be checked out and released explicitly
([page 01](./01-connection-pooling.md)). This is the same rule as transactions
([page 06](./06-transactions.md)), for the same reason.

## The stream, and its real cost

`pg-query-stream` wraps the same cursor in a Readable, so it composes with pipelines
and `for await`:

```js
import QueryStream from 'pg-query-stream';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';

const client = await pool.connect();
try {
  const stream = client.query(new QueryStream('select id, payload from events'));
  await pipeline(
    stream,
    new Transform({
      objectMode: true,
      transform(row, _enc, cb) { cb(null, JSON.stringify(row) + '\n'); },
    }),
    res,                                   // straight to the HTTP response
  );
} finally {
  client.release();
}
```

```console
QueryStream          110 MB RSS   6353 ms
```

Same memory as the raw cursor. **5.7× slower.** Object-mode streams pay per-object
backpressure accounting on every one of 500 000 rows, and that dominates when the
work per row is trivial.

That is not an argument against streams — it is an argument for knowing which problem
you have:

- **Piping to an HTTP response, a file, or a compressor?** Use the stream.
  Backpressure is the entire point: if the client reads slowly, the query slows down
  instead of filling memory. The 5 seconds are irrelevant next to a download.
- **Looping to compute something?** Use `Cursor.read(1000)`. You get batch-sized
  memory without the per-row stream machinery.

Breaking out early is safe. `for await` over a `QueryStream`, `break` after 10 rows,
and the connection was usable immediately afterwards — the stream destroys the cursor
on the way out. The `finally { client.release() }` is still yours.

## MongoDB — the same shape, one bad default

The driver's `find()` already returns a cursor. `toArray()` is the thing that
buffers.

```js
// buffers everything
const docs = await db.collection('events').find(q).toArray();

// streams
for await (const doc of db.collection('events').find(q)) {
  process(doc);
}
```

200 000 documents:

```console
toArray()            486 MB RSS   1739 ms
for await cursor     143 MB RSS   4522 ms
```

**3.4× the memory for 2.6× less time.** Same trade as PostgreSQL, more extreme in
both directions. `batchSize` moves the dial: a larger batch trades memory back for
fewer round trips.

The Mongo-specific trap is that a cursor left idle is **closed by the server after 10
minutes** (`cursorTimeoutMillis`) — a slow consumer gets `CursorNotFound` halfway
through. If per-document work is slow, either raise `batchSize` so fewer round trips
are needed, or read into pages with a range query on `_id` instead of holding one
cursor open.

## The pattern that beats both

Streaming is the fix for "I must process every row". It is not the fix for "the API
returns 500 000 rows" — that is a pagination problem wearing a memory-usage costume.

```js
// keyset pagination — no cursor, no server-side state, no connection held
const {rows} = await pool.query(
  `select id, payload from events
   where id > $1
   order by id
   limit 1000`, [lastSeenId]);
```

Each page is an ordinary pooled query. Nothing is held open, any instance can serve
the next page, and a client that disappears costs nothing. Reach for a cursor when
the work genuinely is one long pass — an export, a backfill, a migration of data — and
for a paginated API use keyset pagination instead. (Not `offset`: `offset 500000`
makes the server walk and discard 500 000 rows on every page.)

## Gotchas

**Symptom:** `JavaScript heap out of memory` on a report or export
**Cause:** `pool.query` buffering the whole result set — measured 300 MB for 500 000
rows.
**Fix:** A cursor or a query stream; or paginate.

**Symptom:** Memory is fine until a customer's data grows
**Cause:** The query has no `limit`; the row count is the customer's, not yours.
**Fix:** Stream, or bound the query.

**Symptom:** `Cannot use a pool after calling end` / the pool exhausts during an export
**Cause:** A cursor holds a checked-out connection for the whole pass.
**Fix:** `client.release()` in `finally`; keep long exports off the request pool, or
give them their own small pool.

**Symptom:** Streaming is far slower than expected
**Cause:** Object-mode stream overhead per row — 5.7× here.
**Fix:** `Cursor.read(1000)` when you are not piping to a sink.

**Symptom:** `CursorNotFound` partway through a long Mongo iteration
**Cause:** The server closed an idle cursor after ~10 minutes.
**Fix:** Larger `batchSize`, faster per-document work, or paginate on `_id`.

**Symptom:** The response is fully buffered even though the query is streamed
**Cause:** `JSON.stringify` on a collected array at the end, or a framework that
buffers.
**Fix:** Write NDJSON, or a JSON array assembled as you go, and `pipeline` into
`res`.

**Symptom:** Pagination gets slower on later pages
**Cause:** `offset` — the server walks and discards every skipped row.
**Fix:** Keyset pagination: `where id > $1 order by id limit $2`.

## Interview questions

**★ What is wrong with `pool.query` for a large result set?**
It buffers: every row is read off the socket and materialised as a JavaScript object
before the promise resolves, so peak memory scales with the result. Measured 300 MB
RSS for 500 000 rows against a 78 MB baseline — enough to OOM a small container.

**★ What does a cursor change?**
The rows stay on the server and you fetch a batch at a time, so memory tracks the
batch size, not the result size. Measured 111 MB versus 300 MB for the same 500 000
rows, at 8% more wall-clock time. It requires a dedicated checked-out connection,
because the cursor is server-side state on that connection.

**★ Cursor or query stream?**
Stream when you are piping into something with backpressure — an HTTP response, a
file, a compressor — because a slow consumer then slows the query instead of filling
memory. Use `Cursor.read(n)` when you are just looping: object-mode stream overhead
measured 5.7× slower (6353 ms versus 1110 ms) with identical memory.

**★ Should a paginated API use a cursor?**
No. A database cursor holds a connection and server state, which does not survive
across requests or instances. Use keyset pagination — `where id > $1 order by id limit
$2` — and keep cursors for single long passes like exports and backfills. Avoid
`offset`, which makes the server walk the skipped rows every time.

**What is the MongoDB equivalent?**
`find()` already returns a cursor; `toArray()` is what buffers. Measured on 200 000
documents: `toArray()` 486 MB / 1739 ms, `for await` 143 MB / 4522 ms. Tune
`batchSize`, and watch for `CursorNotFound` if a cursor sits idle past the server's
~10-minute timeout.

**What happens if you break out of a stream early?**
The stream destroys the underlying cursor and the connection is usable again —
verified after breaking out at 10 rows of 500 000. You still have to
`client.release()` yourself, in a `finally`.

---

← Prev: [Read replicas](./15-read-replicas.md) · Phase index: [Data access](./README.md) · Next phase → Background work and resilience *(not yet written)*
