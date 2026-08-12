---
title: "RETURNING"
sidebar_label: "05 · RETURNING"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex16-returning.mjs`,
> `ex14-crud.mjs`, `ex4-soft-delete.mjs`.

**Every `INSERT`, `UPDATE`, `DELETE` and `MERGE` can hand back the rows it touched.
This is not a convenience — it is the only way to read what a write did without a
second query that can see a different transaction's data.**

## It works on all four write statements

```console
$ node ex16-returning.mjs
=== 2. INSERT / UPDATE / DELETE return which version of the row ===
INSERT → the new row     : { id: '4', sku: 'b1', qty: 1, updated_at: 2026-08-12T06:54:50.205Z }
UPDATE → the updated row : { id: '4', qty: 99 }
DELETE → the removed row : { id: '4', sku: 'b1', qty: 99 }
```

`INSERT` and `UPDATE` return the row **after** the change; `DELETE` returns it as it was
just before disappearing — the last chance to see that data. Defaults, generated columns
and identity values are all populated, because `RETURNING` is evaluated after they are
computed.

`RETURNING *` gives every column:

```console
=== 5. expressions in RETURNING ===
RETURNING * → id, sku, qty, price, updated_at
```

## Why not just `SELECT` afterwards

```sql
INSERT INTO c_items (sku, name) VALUES ('b1', 'New');
SELECT id FROM c_items WHERE sku = 'b1';   -- ✗ race
```

Between the two statements another transaction can insert, update or delete. Under
`READ COMMITTED` — the default — the `SELECT` takes a fresh snapshot, so it may return a
row that is not the one you wrote. `RETURNING` is part of the same statement and cannot
be raced. It is also one round trip instead of two.

## Expressions, not just columns

The `RETURNING` list is a full select list — anything valid in `SELECT` works:

```console
{ id: '3', price: '33.00', rounded: 33, label: 'sku:a3' }
```

```sql
UPDATE r_items SET price = price * 1.1 WHERE sku = 'a3'
RETURNING id, price, round(price)::int AS rounded, 'sku:' || sku AS label;
```

Useful for returning exactly the API shape, so nothing needs recomputing in JavaScript.

## PostgreSQL 18: `old.` and `new.`

New in 18 — `RETURNING` can reference both versions of an updated row:

```console
=== 1. RETURNING old.* / new.* — new in PostgreSQL 18 ===
UPDATE ... RETURNING old/new → { was: 5, now: 15, delta: 10 }
```

```sql
UPDATE r_items SET qty = qty + 10 WHERE sku = 'a1'
RETURNING old.qty AS was, new.qty AS now, new.qty - old.qty AS delta;
```

Before 18 the previous value required a self-join, which works but reads badly and
doubles the tuple lookups:

```console
pre-18 self-join equivalent  → { was: 3, now: 13 }
```

```sql
UPDATE r_items i SET qty = i.qty + 10
FROM r_items o WHERE o.id = i.id AND i.sku = 'a2'
RETURNING o.qty AS was, i.qty AS now;
```

`old`/`new` make audit rows, change events and optimistic-concurrency responses far
easier to express. Check your server version before relying on them — on 17 and below
this is a syntax error. In `INSERT` all `old` columns are null; in `DELETE` all `new`
columns are null.

## No match means no rows — not an error

```console
=== 3. when nothing matched ===
rowCount: 0 | rows: [] | command: UPDATE
```

An `UPDATE` whose `WHERE` matched nothing is a success with zero rows. Nothing raises.
This is the shape of the "row not found" check in an API handler:

```js
const {rows: [item]} = await pool.query(
  `UPDATE c_items SET qty = $2 WHERE id = $1 RETURNING id, sku, qty`, [id, qty]);
if (!item) return res.status(404).json({error: 'not found'});
res.json(item);
```

One statement decides both the outcome and the response, with no prior `SELECT` to
check existence — which would be a race anyway.

## The `ON CONFLICT DO NOTHING` trap

This one costs people real time:

```console
=== 4. the ON CONFLICT DO NOTHING trap ===
first insert  → rowCount: 1 rows: [ { id: '5' } ]
same row again→ rowCount: 0 rows: [] ← the row exists, but you get no id
DO UPDATE instead → { id: '5', was_insert: false } ← always returns a row
```

`DO NOTHING` skips the row, and a skipped row is not a returned row — so on the second
call you get nothing back even though the row is sitting there. Code that reads
`rows[0].id` crashes on exactly the retry path it was written to support.

The fix is a `DO UPDATE` that writes something harmless, so there is always a returned
row:

```sql
INSERT INTO r_items (sku, qty) VALUES ($1, $2)
ON CONFLICT (sku) DO UPDATE SET sku = EXCLUDED.sku
RETURNING id, (xmax = 0) AS was_insert;
```

`xmax = 0` tells you which branch ran — `true` for a genuine insert, `false` for a
conflict ([`ON CONFLICT`](06-on-conflict.md)).

## Feeding another statement with a CTE

`RETURNING` inside a CTE lets one statement move rows between tables:

```console
=== 7. RETURNING feeding another statement (CTE) ===
deleted and audited in one statement → { item_id: '8', sku: 'd1' }
```

```sql
WITH removed AS (
  DELETE FROM r_items WHERE sku = 'd1' RETURNING id, sku
)
INSERT INTO r_audit (item_id, sku) SELECT id, sku FROM removed RETURNING item_id, sku;
```

Archive-then-delete, move-between-tables and outbox writes all collapse into one atomic
statement this way. The caveat: all sub-statements see the *same* snapshot, so a CTE
cannot read another CTE's changes — only its `RETURNING` output.

## Multi-row `RETURNING` has no defined order

```console
=== 6. RETURNING over many rows ===
rowCount: 5
│ 0       │ '1' │ 'a1' │ 16  │
│ 1       │ '2' │ 'a2' │ 14  │
│ 2       │ '5' │ 'c1' │ 2   │
│ 3       │ '3' │ 'a3' │ 1   │
│ 4       │ '8' │ 'd1' │ 8   │
```

Ids came back `1, 2, 5, 3, 8` — the order rows happened to be updated in, not id order.
`RETURNING` takes no `ORDER BY`. If you need sorted output, wrap it:

```sql
WITH updated AS (UPDATE … RETURNING id, sku)
SELECT * FROM updated ORDER BY id;
```

## Trade-off

`RETURNING` costs almost nothing — the rows are already in hand — and removes a round
trip plus a class of race conditions. The only real cost is on large writes: `RETURNING`
on an `UPDATE` touching a million rows sends all million back. Add a column list, or omit
`RETURNING` entirely on bulk statements and use `rowCount`.

It is also not standard SQL. It exists in PostgreSQL, SQLite and MariaDB; SQL Server
spells it `OUTPUT`; Oracle uses `RETURNING INTO`. Portable code cannot assume it — which
in practice means portable code makes an extra query and accepts the race.

## Gotchas

**Symptom:** `rows[0]` is undefined after an idempotent insert
**Cause:** `ON CONFLICT DO NOTHING` returns no row when it skips — measured, `rowCount:
0` on the second call.
**Fix:** `DO UPDATE SET <col> = EXCLUDED.<col>` so a row always comes back, with
`(xmax = 0)` to tell insert from update.

**Symptom:** An API returns 404 for a row that exists
**Cause:** `RETURNING` gave nothing because the `WHERE` did not match — often a type
mismatch, a soft-delete predicate, or a tenant filter.
**Fix:** Check the `WHERE`, not the `RETURNING`. `rowCount: 0` is the signal.

**Symptom:** Rows come back in an unexpected order
**Cause:** `RETURNING` has no `ORDER BY` and no defined order — measured `1, 2, 5, 3, 8`.
**Fix:** Wrap in a CTE and sort the outer `SELECT`.

**Symptom:** `syntax error at or near "old"`
**Cause:** `RETURNING old.x` on PostgreSQL 17 or earlier.
**Fix:** Upgrade to 18, or use the self-join form.

**Symptom:** A bulk `UPDATE` uses far more memory than expected
**Cause:** `RETURNING *` on a statement touching very many rows.
**Fix:** Drop `RETURNING`, or narrow it to the columns you need.

**Symptom:** `id` arrives as a string
**Cause:** `bigint` is returned as text to preserve precision.
**Fix:** Expected — see [The `SELECT` shape](01-select-shape.md).

## Interview questions

**★ Why use `RETURNING` instead of a `SELECT` after the write?**
Correctness before convenience. A separate `SELECT` runs in its own snapshot under
`READ COMMITTED`, so it can return a row written by a different transaction.
`RETURNING` is part of the same statement, so it reports exactly what that statement
did — and saves a round trip.

**★ What does `RETURNING` give you on a `DELETE`?**
The row as it was immediately before deletion — measured, `{ id: '4', sku: 'b1', qty: 99 }`.
That is the last opportunity to capture it, which is why archive-and-delete is written as
a CTE with `DELETE … RETURNING` feeding an `INSERT`.

**★ Why might `INSERT … ON CONFLICT DO NOTHING … RETURNING id` return nothing?**
Because the row already existed, so it was skipped, and skipped rows are not returned —
measured `rowCount: 0`. The row is there; you just have no id. Use `DO UPDATE SET sku =
EXCLUDED.sku` to force a returned row.

**★ How do you get an updated row's previous value?**
On PostgreSQL 18, `RETURNING old.qty, new.qty` — measured `{ was: 5, now: 15, delta: 10 }`.
Before 18, self-join the table in a `FROM` clause and return the old alias's column.

**Can you `ORDER BY` the output of `RETURNING`?**
No. Wrap the statement in a CTE and order the outer `SELECT`. Measured, the natural order
was neither insertion nor id order.

**Is `RETURNING` standard SQL?**
No. PostgreSQL, SQLite and MariaDB have it; SQL Server uses `OUTPUT`, Oracle
`RETURNING INTO`. Code that must be portable across engines cannot rely on it.

---

← [`INSERT`](04-insert.md) · Next → [`ON CONFLICT`](06-on-conflict.md)
