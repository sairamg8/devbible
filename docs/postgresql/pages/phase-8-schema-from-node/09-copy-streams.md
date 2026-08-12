---
title: "COPY FROM STDIN with pg-copy-streams"
sidebar_label: "09 · COPY streams"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, `pg-copy-streams` 7.0.0. Scripts:
> `sandbox/pg-api/ex8-bulk-and-seed.mjs`, `ex9-bulk-at-scale.mjs`.

**`COPY` is the bulk-load path whose memory does not grow with the row count.**
That, not raw speed, is the reason to reach for it from Node — and the measurement
below is the reason to be specific about that.

## The shape

`pg-copy-streams` turns `client.query()` into a writable stream. Pipe rows in and
`await` the pipeline.

```js
import pg from 'pg';
import {from as copyFrom} from 'pg-copy-streams';
import {pipeline} from 'node:stream/promises';

const client = await pool.connect();
try {
  const stream = client.query(copyFrom(
    `COPY bulk_users (email, name, score) FROM STDIN WITH (FORMAT csv)`));
  await pipeline(sourceStream, stream);
} finally {
  client.release();
}
```

Three details that are not optional:

- **A checked-out `client`, never `pool.query`.** `COPY` puts the connection into a
  distinct protocol mode for the duration; it is not a normal request/response
  query.
- **`pipeline`, not `.pipe()`.** `pipeline` propagates errors and destroys both ends
  on failure. A `.pipe()` chain leaves the connection stuck mid-`COPY` when the
  source errors, and that connection returns to the pool broken.
- **`client.release()` in `finally`**, for the same reason.

## The measurement that changes the advice

`COPY` is routinely described as the fastest way to load data. Compared with
`unnest` from Node, it was not:

```console
$ node ex9-bulk-at-scale.mjs
N= 10000  unnest     85 ms   COPY    258 ms   unnest wins by 3.0×   heap 8 MB
N=100000  unnest    753 ms   COPY   2107 ms   unnest wins by 2.8×   heap 39 MB
N=500000  unnest   3841 ms   COPY  10264 ms   unnest wins by 2.7×   heap 201 MB
```

`unnest` won at every size, by a consistent ~2.7–3×.

Be precise about what that shows. This compares **two Node client paths**, not
PostgreSQL's internals. The `COPY` side formats every row as CSV in JavaScript and
pushes it through a stream; that formatting is the cost. Server-side `COPY … FROM
'/path/file.csv'`, which is what the "COPY is fastest" advice refers to, reads the
file in the server process and never touches this path at all.

So the reason to use `COPY` from Node is **not** throughput:

| Reason | Why it matters |
|---|---|
| **Bounded memory** | `unnest` materialises every value in JS arrays *and* in the protocol message — 201 MB heap at 500k rows. `COPY` streams; memory is the high-water mark, not the row count |
| **No size ceiling** | `unnest` is limited by available memory; `COPY` will load a billion rows |
| **A natural transform point** | The source is already a stream — a file, an HTTP response, a paged API — and rows are formatted one at a time |

Choose `unnest` when the rows are already in memory and you need `ON CONFLICT` or
`RETURNING`. Choose `COPY` when the data is streaming or too large to hold. See
[Bulk insert that scales](04-bulk-insert.md) for the full comparison against the
per-row loop.

## Formats, and the one that bites

```sql
COPY t (a, b) FROM STDIN WITH (FORMAT csv)                        -- comma, quoted
COPY t (a, b) FROM STDIN WITH (FORMAT text)                       -- tab, backslash escapes
COPY t (a, b) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')  -- skip a header row
```

**`text` is the default, not `csv`.** In `text` format the delimiter is a tab and
`\N` means NULL — so feeding comma-separated data to a default `COPY` puts your
entire line into the first column, usually failing with a type error on a later
column that never received a value.

The NULL representation differs and is the most common data bug here:

- **`text` format:** `\N` is NULL; an empty field is an empty string.
- **`csv` format:** an unquoted empty field is NULL by default; `""` is an empty
  string.

So in CSV, `a,,c` gives NULL for the middle column while `a,"",c` gives `''`. If
your source cannot express that distinction, set it explicitly with `NULL ''` and be
deliberate about which one you want — `NOT NULL` violations on load are usually this.

Escape properly rather than by string concatenation. A value containing a comma,
quote or newline must be quoted with internal quotes doubled:

```js
const csv = (v) =>
  v == null ? '' : `"${String(v).replaceAll('"', '""')}"`;
const row = (r) => `${csv(r.email)},${csv(r.name)},${csv(r.score)}\n`;
```

## Errors arrive at the end

`COPY` is all-or-nothing within its transaction, and a bad row aborts the entire
load:

```
ERROR: invalid input syntax for type integer: "abc"
CONTEXT: COPY bulk_users, line 4823, column score: "abc"
```

The `CONTEXT` line is the useful part — it names the line and column. But you only
learn about row 4823 after streaming 4823 rows, and there is no "skip bad rows"
option.

The standard remedy is a **staging table with no constraints and every column
`text`**: `COPY` into it, which cannot fail on type errors, then move the rows
across with SQL that can report exactly which ones are bad.

```sql
CREATE UNLOGGED TABLE staging_users (email text, name text, score text);
-- COPY into staging_users, then:
INSERT INTO bulk_users (email, name, score)
SELECT email, name, score::int FROM staging_users
 WHERE score ~ '^\d+$'
ON CONFLICT (email) DO NOTHING;

SELECT * FROM staging_users WHERE score !~ '^\d+$';  -- the rejects, inspectable
```

`UNLOGGED` skips WAL for the staging table, which is a genuine speedup and safe
because the data is disposable — the table is emptied on crash recovery, which is
exactly what you want for a load buffer.

This staging pattern also restores what `COPY` cannot do natively: `ON CONFLICT`,
per-row validation, and transformation.

## Trade-off

`COPY` gives constant memory and unlimited size, and takes away everything that
makes `INSERT` convenient — no `ON CONFLICT`, no `RETURNING`, no per-row error
handling, and a format you must produce correctly by hand. It also monopolises a
connection in a special protocol mode, so it is not something to run per request.

Loading via a staging table gets all of it back at the cost of a second table and a
second statement. For any load where the input is not already trusted, that second
statement is the one doing the real work.

## Gotchas

**Symptom:** Every row lands in the first column
**Cause:** `FORMAT text` (the default) expects tabs; the data is comma-separated.
**Fix:** `WITH (FORMAT csv)` explicitly.

**Symptom:** `NOT NULL` violations on data that clearly has values
**Cause:** NULL representation — in CSV an unquoted empty field is NULL; in `text`
format NULL is `\N`.
**Fix:** Set `NULL` explicitly and quote empty strings as `""`.

**Symptom:** The load fails at row 4823 and nothing is inserted
**Cause:** `COPY` aborts the whole transaction on one bad row; there is no skip
option.
**Fix:** `COPY` into an all-`text` unlogged staging table, then `INSERT … SELECT`
with validation.

**Symptom:** A connection is unusable after a failed load
**Cause:** `.pipe()` instead of `pipeline`, leaving the connection mid-`COPY`, then
returned to the pool.
**Fix:** `pipeline` from `node:stream/promises`, and `release()` in `finally`.

**Symptom:** Values containing commas or quotes corrupt the load
**Cause:** Rows built by string concatenation with no CSV escaping.
**Fix:** Quote every field and double internal quotes.

**Symptom:** `COPY` is slower than the `INSERT` it replaced
**Cause:** From Node, CSV formatting in JavaScript dominates — measured 2.7–3×
slower than `unnest`.
**Fix:** If the rows fit in memory, use `unnest`. Use `COPY` for streaming sources
and unbounded size.

**Symptom:** `ON CONFLICT` is rejected on a `COPY`
**Cause:** `COPY` supports no conflict handling.
**Fix:** Staging table, then upsert.

## Interview questions

**★ Why use `COPY FROM STDIN` from Node?**
Bounded memory and unlimited size. `unnest` must materialise every value in JS
arrays and in the protocol message — 201 MB of heap at 500 000 rows — while `COPY`
streams, so its memory is the high-water mark rather than the row count.

**★ Is `COPY` the fastest way to load data from Node?**
No — measured, `unnest` beat `pg-copy-streams` by 2.7–3× at 10k, 100k and 500k
rows, because the `COPY` path formats every row as CSV in JavaScript. The "COPY is
fastest" advice refers to server-side `COPY` from a file, which is a different
operation.

**★ What happens when one row in a `COPY` is malformed?**
The whole load aborts — `COPY` is all-or-nothing and has no skip option. The error's
`CONTEXT` line names the line and column. The fix is to `COPY` into an all-`text`
unlogged staging table, then `INSERT … SELECT` with validation so bad rows can be
inspected instead of failing the load.

**★ Why `pipeline` rather than `.pipe()`?**
`pipeline` propagates errors and destroys both streams on failure. With `.pipe()`, a
source error leaves the connection stuck in `COPY` protocol mode, and releasing it
returns a broken connection to the pool.

**★ How is NULL represented, and why does that cause `NOT NULL` violations?**
In `text` format NULL is `\N` and an empty field is an empty string; in `csv` an
unquoted empty field is NULL while `""` is an empty string. Data that means "empty
string" but is written as an unquoted empty CSV field arrives as NULL and violates
`NOT NULL`.

**Why make the staging table `UNLOGGED`?**
It skips write-ahead logging, which is a real speedup, and the data is disposable —
an unlogged table is emptied on crash recovery, which is exactly the right semantics
for a load buffer.

---

← [Writing a minimal migration runner](08-minimal-runner.md) · Next → [A local development database](10-local-dev-db.md)
