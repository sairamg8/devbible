---
title: "Bulk insert that scales"
sidebar_label: "04 · Bulk insert"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, `pg-copy-streams` 7.0.0. Scripts:
> `sandbox/pg-api/ex8-bulk-and-seed.mjs`, `ex9-bulk-at-scale.mjs`.

**The loop that inserts one row per query is the single most common performance
bug in a Node data layer, and it is 80× slower than the alternatives.** The fix is
not a faster driver — it is sending fewer statements.

## The same 10 000 rows, five ways

```console
$ node ex8-bulk-and-seed.mjs
=== 1. loading 10000 rows, four ways ===
per-row INSERT (autocommit)          20165 ms   rows=10000
per-row INSERT (one transaction)      2559 ms   rows=10000
multi-row VALUES (batch 1000)          148 ms   rows=10000
INSERT ... SELECT unnest (1 stmt)       84 ms   rows=10000
COPY FROM STDIN                        244 ms   rows=10000

relative to COPY:
  per-row autocommit     82.6×
  per-row in tx          10.5×
  multi-row VALUES       0.6×
  unnest                 0.3×
  COPY                   1.0×
```

**20 seconds against 84 milliseconds — a 240× spread** between the obvious code and
the good code, on identical data and an identical table.

Two separate costs are visible here, and they are worth separating because the
fixes are different:

- **Autocommit → one transaction: 20165 → 2559 ms (7.9×).** Each standalone
  `INSERT` is its own transaction, and each commit must flush WAL to disk. Wrapping
  the loop in `BEGIN`/`COMMIT` pays that cost once. This alone is the cheapest fix
  available if you cannot restructure the loop.
- **One transaction → one statement: 2559 → 84 ms (30×).** What is left after
  batching commits is 10 000 network round trips and 10 000 parse/plan/execute
  cycles. Only sending fewer statements removes that.

## The two good options

### `unnest` — one statement, any number of rows

Pass one array per column. The statement text is constant regardless of row count,
so it prepares once and there is no placeholder arithmetic.

```js
await pool.query(
  `INSERT INTO bulk_users (email, name, score)
   SELECT * FROM unnest($1::text[], $2::text[], $3::int[])`,
  [rows.map((r) => r.email), rows.map((r) => r.name), rows.map((r) => r.score)],
);
```

The casts are not optional. Without `::text[]` PostgreSQL cannot infer the element
type of a parameter it has never seen, and you get
`could not determine polymorphic type because input has type unknown`.

### `COPY FROM STDIN` — streaming, bounded memory

```js
import {from as copyFrom} from 'pg-copy-streams';
import {pipeline} from 'node:stream/promises';

const client = await pool.connect();
const stream = client.query(copyFrom(
  `COPY bulk_users (email, name, score) FROM STDIN WITH (FORMAT csv)`));
await pipeline(sourceStream, stream);
client.release();
```

## Which one — and a result that contradicts the usual advice

`COPY` is universally described as the fast path. In this harness it was not:

```console
$ node ex9-bulk-at-scale.mjs
N= 10000  unnest     85 ms   COPY    258 ms   unnest wins by 3.0×   heap 8 MB
N=100000  unnest    753 ms   COPY   2107 ms   unnest wins by 2.8×   heap 39 MB
N=500000  unnest   3841 ms   COPY  10264 ms   unnest wins by 2.7×   heap 201 MB
```

`unnest` won at every size tested, by a consistent ~2.7–3×, up to half a million
rows. Be precise about what that does and does not show: this compares **two Node
client paths**, not PostgreSQL's internals. The `COPY` side pays for formatting
each row as CSV in JavaScript and pushing it through a stream, and that formatting
is what costs — server-side `COPY` from a file is a different operation.

So the honest rule is **not** "COPY is slow". It is:

| Situation | Use |
|---|---|
| Rows already in memory as arrays, up to ~100k | **`unnest`** — fewer moving parts, and measurably faster here |
| Rows arriving from a stream, a file, or an API you are paging | **`COPY`** — bounded memory, no need to materialise everything |
| Rows must be transformed or validated per row first | **`COPY`** — the transform lives in the stream |
| You need `ON CONFLICT`, `RETURNING`, or per-row error handling | **`unnest`** — `COPY` supports none of these |

That last row is often decisive regardless of timing. `COPY` is all-or-nothing: no
upsert, no `RETURNING`, and one bad row aborts the whole load.

The memory column is the other half. `unnest` requires every value materialised in
JavaScript arrays *and* serialised into the protocol message — 201 MB of heap at
500 000 rows. `COPY` streams, so its memory is a function of the high-water mark,
not the row count. At a few million rows `unnest` stops being an option long before
it stops being fast.

## The hard ceiling: 65535 parameters

Multi-row `VALUES` is the middle option, and it has an exact limit — the wire
protocol encodes the parameter count as a 16-bit integer.

```console
=== 2. how many parameters can one statement take? ===
21845 rows → ok (65535 params)
21846 rows → 08P01 bind message has 2 parameter formats but 0 parameters
```

**65535 parameters, exactly.** With three columns that is 21 845 rows and not one
more. Note the error you actually get: `08P01 bind message has 2 parameter formats
but 0 parameters` — a protocol-level message that says nothing about limits and
does not name the real problem. If you have seen that error and been baffled, this
is what it means.

This ceiling is why batching by *row count* is fragile: a table with 3 columns
batches at 21 845, one with 30 columns at 2 184. Batch by parameter count
(`Math.floor(65535 / columns)`) or sidestep it entirely with `unnest`, whose
parameter count is the number of *columns*, not rows.

## What the loop costs in context

```js
// ✗ 20 seconds for 10 000 rows
for (const r of rows) {
  await pool.query(`INSERT INTO t (a,b,c) VALUES ($1,$2,$3)`, [r.a, r.b, r.c]);
}

// ✓ 84 ms
await pool.query(
  `INSERT INTO t (a,b,c) SELECT * FROM unnest($1::text[],$2::text[],$3::int[])`,
  [rows.map(r => r.a), rows.map(r => r.b), rows.map(r => r.c)],
);
```

The loop version also holds a pool connection for the whole 20 seconds — under
concurrency it is not merely slow, it exhausts the pool and takes unrelated
requests down with it. See Node
[Phase 6 · Connection pooling](/docs/nodejs/pages/phase-6-data-access/connection-pooling).

## Trade-off

Bulk methods trade per-row control for throughput. The loop gives you a `RETURNING`
id per row, a natural place to catch one row's unique violation, and code that
reads like the domain. `unnest` and `COPY` give you speed and take that away:
errors arrive per *statement*, so one bad row fails the batch and you must find it
yourself.

The usual resolution is to validate before the load rather than during it, and to
insert into a staging table with no constraints, then move rows across with SQL
that can report which ones failed. That is more machinery than a loop and it is
what makes a 20-second import a sub-second one.

## Gotchas

**Symptom:** An import takes minutes and the CPU is idle
**Cause:** One `INSERT` per row, each its own transaction — the time is round trips
and WAL flushes, not work.
**Fix:** One statement (`unnest`) or a stream (`COPY`). A single `BEGIN`/`COMMIT`
around the loop is the one-line stopgap: measured 20165 → 2559 ms.

**Symptom:** `08P01 bind message has 2 parameter formats but 0 parameters`
**Cause:** More than 65535 parameters in one statement. The message does not say so.
**Fix:** Batch by `Math.floor(65535 / columns)` rows, or use `unnest`.

**Symptom:** `could not determine polymorphic type because input has type unknown`
**Cause:** `unnest($1, $2)` with no casts — PostgreSQL cannot infer array element
types.
**Fix:** Cast every array: `unnest($1::text[], $2::int[])`.

**Symptom:** The process runs out of memory on a large import
**Cause:** `unnest` materialises every value in JavaScript arrays and in the
protocol message — 201 MB of heap at 500 000 rows.
**Fix:** `COPY FROM STDIN` with a stream source, which is bounded by the high-water
mark.

**Symptom:** A bulk load fails and you cannot tell which row was bad
**Cause:** `unnest` and `COPY` report errors per statement, not per row.
**Fix:** Load into a constraint-free staging table, then `INSERT … SELECT` with the
constraints, reporting the rows that fail.

**Symptom:** `ON CONFLICT` does not work with the fast import
**Cause:** `COPY` supports no conflict handling at all.
**Fix:** `unnest` with `ON CONFLICT`, or `COPY` into staging and upsert from there.

**Symptom:** The whole API stalls during a nightly import
**Cause:** The per-row loop held a pool connection for the entire run.
**Fix:** Bulk methods finish in milliseconds; also run imports on a separate pool
or a worker so they cannot starve request traffic.

## Interview questions

**★ Why is inserting 10 000 rows in a loop so slow, and how much slower is it?**
Measured, 20 165 ms against 84 ms for one statement — 240×. Two distinct costs:
each autocommitted `INSERT` forces a WAL flush (fixing that alone gives 20 165 →
2 559 ms), and 10 000 round trips plus 10 000 parse/plan cycles remain after that
(fixing that gives 2 559 → 84 ms).

**★ How do you insert a variable number of rows in one statement?**
`INSERT … SELECT * FROM unnest($1::text[], $2::int[])` — one array parameter per
column. The statement text never changes with row count, so there is no placeholder
arithmetic and no parameter-limit problem: the parameter count equals the number of
columns.

**★ What is the limit on multi-row `VALUES`?**
65535 parameters, because the protocol encodes the count in 16 bits — measured
exactly: 21 845 rows × 3 columns succeeds, 21 846 fails. The error is
`08P01 bind message has 2 parameter formats but 0 parameters`, which does not
mention the limit.

**★ When is `COPY` the right choice rather than `unnest`?**
When the rows are streaming rather than in memory — a file, an API you are paging,
a transform pipeline — because `COPY`'s memory is bounded while `unnest` needs
everything materialised (201 MB heap at 500 000 rows). Also when the volume is
large enough that arrays are impractical. Choose `unnest` when you need
`ON CONFLICT`, `RETURNING`, or the rows are already in memory.

**★ Is `COPY` always the fastest way to load data from Node?**
No — measured, `unnest` beat `pg-copy-streams` by 2.7–3× at 10k, 100k and 500k
rows. The `COPY` path pays to format each row as CSV in JavaScript. The claim
"`COPY` is fastest" is about server-side `COPY` from a file, which is a different
operation. Its real advantages from Node are streaming memory and unlimited size.

**Why does wrapping the loop in a transaction help so much on its own?**
Because each autocommitted statement commits, and every commit must flush the
write-ahead log to durable storage. One transaction pays that latency once instead
of 10 000 times — measured as a 7.9× improvement with no other change.

---

← [Seeding](03-seeding.md) · Next → [SQL in `.sql` files](05-sql-files.md)
