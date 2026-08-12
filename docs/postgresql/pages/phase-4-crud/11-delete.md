---
title: "DELETE"
sidebar_label: "11 · DELETE"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex18-delete.mjs`,
> `ex4-soft-delete.mjs`, `ex14-crud.mjs`.

**`DELETE` removes rows, fires foreign-key actions and triggers, and leaves the space
behind for `VACUUM`. It takes no `LIMIT`, so batching a large delete needs a trick — and
on a big table you almost always want to batch.**

## The shape

```sql
DELETE FROM d_items WHERE sku = $1 RETURNING id, sku;
```

`WHERE` is optional, which is the problem:

```console
$ node ex18-delete.mjs
=== 1. DELETE with no WHERE ===
DELETE FROM d_all → rowCount: 10 ← every row
```

Same discipline as [`UPDATE`](07-update.md): in `psql`, wrap it in `BEGIN`, check the
count, then commit. To empty a table deliberately, [`TRUNCATE`](14-truncate.md) is the
right statement and is far faster.

## `rowCount` and `RETURNING`

```console
$ node ex4-soft-delete.mjs
=== 1. hard delete with RETURNING ===
rowCount: 1 | returned: { id: '1', email: 'hard@x.com', name: 'Hard' }
deleting a row that is not there → rowCount: 0 | rows: []
```

Deleting a row that does not exist is a success with `rowCount: 0`, not an error — the
404 signal for a delete endpoint. `RETURNING` is the last chance to see the row's
contents, which is why archive-then-delete is written as a single CTE
([`RETURNING`](05-returning.md)).

## Deleting from a join

`DELETE … USING` is the counterpart to `UPDATE … FROM`:

```console
=== 2. DELETE ... USING ===
rowCount: 2 | removed: a2, a3
left: a1
subquery form → removed a4
```

```sql
DELETE FROM d_items i USING d_banned b WHERE b.sku = i.sku RETURNING i.id, i.sku;

-- equivalent, and usually clearer for a single condition
DELETE FROM d_items WHERE sku IN (SELECT sku FROM d_banned);
```

`USING` does not have the duplicate-source hazard that `UPDATE … FROM` has — a row either
matches and is deleted or does not, so extra matching source rows change nothing.

## What foreign keys do to a delete

The referencing table's `ON DELETE` action decides, and the four options behave
distinctly:

```console
=== 3. foreign-key actions ===
ON DELETE RESTRICT  → 23001 update or delete on table "d_parent" violates RESTRICT setting of foreign key constraint "d_child_parent_id_fkey" on table "d_child"
ON DELETE NO ACTION → 23503 update or delete on table "d_parent" violates foreign key constraint "d_child_parent_id_fkey" on table "d_child"
ON DELETE CASCADE   → deleted 1, child rows now: []
ON DELETE SET NULL  → deleted 1, child rows now: [{"id":10,"parent_id":null}]
```

Note the two different SQLSTATEs. `RESTRICT` raises **`23001`** and `NO ACTION` raises
**`23503`** — the same refusal from a user's point of view, but they are not the same
mechanism: `NO ACTION` is deferrable, so the check can be postponed to commit time with
`DEFERRABLE INITIALLY DEFERRED`, letting you delete parent and child in either order
within one transaction. `RESTRICT` checks immediately and cannot be deferred. `NO ACTION`
is the default.

`CASCADE` is convenient and dangerous: deleting one row can silently remove rows in
tables you were not thinking about, transitively. Full treatment in
[Foreign keys](../phase-3-ddl/03-foreign-keys.md) and
[`DROP`, `CASCADE`, `RESTRICT`](../phase-3-ddl/13-drop-cascade.md).

**An unindexed foreign key makes every parent delete scan the child table** — one of the
most common causes of a delete that mysteriously takes seconds
([Foreign keys need indexes](../phase-10-indexes/18-fk-indexes.md)).

## `DELETE` takes no `LIMIT`

```console
=== 4. DELETE does not take LIMIT ===
DELETE ... LIMIT 100 → 42601 syntax error at or near "LIMIT"
```

Not supported, unlike MySQL. To delete in batches, select the rows you want in a
subquery — `ctid` (the physical row locator) is the cheapest key for this:

```sql
DELETE FROM d_big WHERE ctid IN (
  SELECT ctid FROM d_big ORDER BY id LIMIT 10000);
```

```js
for (;;) {
  const {rowCount} = await pool.query(
    `DELETE FROM d_big WHERE ctid IN (SELECT ctid FROM d_big ORDER BY id LIMIT $1)`,
    [10_000]);
  if (rowCount === 0) break;
}
```

Add `AND` conditions inside the subquery, not outside it. Never store a `ctid` — it
changes whenever the row is updated.

## Batching is slower, and you should still do it

```console
one DELETE of 100000 rows      115 ms (one transaction, one lock window)
10 batched deletes of 100000 rows 484 ms (each commits separately)
```

**Batching took 4.2× longer in total.** The point is not throughput:

- Each batch commits, so row locks are released ten times instead of held throughout. On
  a live table, other transactions get in between batches instead of queueing.
- A single huge `DELETE` is one long transaction, which holds back `VACUUM` across the
  whole database and can bloat far more than the table you are deleting from.
- It is interruptible. Killing a batched job loses the current batch; killing a
  100-million-row `DELETE` rolls back everything and the time was wasted.
- Replication lag stays bounded, because each batch is a smaller WAL burst.

On a table nobody is reading, take the 115 ms. On a production table, take the 484 ms.

## `DELETE` does not shrink the table

Deleting half the rows from a 47 MB table:

```console
=== 5. what DELETE leaves behind (deleting HALF the rows) ===
after insert 200k     : 47 MB
after DELETE of 100000: 47 MB | stats: {"n_dead_tup":"100000","n_live_tup":"100000"}
after VACUUM          : 47 MB ← unchanged: space is marked reusable in place, not returned to the OS
after VACUUM FULL     : 24 MB ← rewritten and shrunk, but takes ACCESS EXCLUSIVE
```

`DELETE` only marks tuples dead. `VACUUM` makes that space **reusable by future inserts
into the same table**, but the file stays 47 MB — which is the right default, since
re-growing a file is expensive. Only `VACUUM FULL` rewrites the table and returns space to
the operating system, and it takes `ACCESS EXCLUSIVE` for the duration, blocking
everything.

There is one case where plain `VACUUM` does shrink the file — when the empty pages are at
the *end*:

```console
contrast — delete ALL rows, then VACUUM:
  after insert 200k   : 47 MB
  after DELETE+VACUUM : 24 kB ← here VACUUM *can* truncate, because every trailing page became empty
```

47 MB to 24 kB, because every page became empty and `VACUUM` truncated the trailing ones.
This is why a full-table delete appears to reclaim space while a partial one does not —
the difference is where the dead tuples sit, not how many there are. Background:
[MVCC](../phase-11-mvcc/) and [Bloat and REINDEX](../phase-10-indexes/17-bloat-reindex.md).

## Soft delete is an `UPDATE`

```console
$ node ex4-soft-delete.mjs
=== 2. soft delete ===
rowCount: 1 | deleted_at set: true
deleting the same row twice → rowCount: 0 (idempotent)
orphaned orders still visible: 1 — no cascade fires on an UPDATE
```

Setting `deleted_at` is not a `DELETE` and behaves differently in every way that matters:
no cascade fires, `ON DELETE` actions are irrelevant, unique constraints still see the
row, and every existing query now needs `WHERE deleted_at IS NULL`. It is a schema-wide
commitment — the design decision, the partial unique index and the index that keeps the
filter cheap are all in
[Hard vs soft delete](../phase-9-api-crud/09-delete-soft-hard.md).

## Trade-off

`DELETE` is precise, transactional, and preserves every behaviour attached to removing a
row — triggers, cascades, `RETURNING`. It costs O(rows) work, leaves dead tuples for
`VACUUM`, and does not return disk space without a blocking rewrite.

`TRUNCATE` is dramatically faster and reclaims space immediately, but takes
`ACCESS EXCLUSIVE`, ignores `WHERE`, and fires no row triggers
([`TRUNCATE` vs `DELETE`](14-truncate.md)). Soft delete keeps the data and the audit
trail, and costs a predicate on every query in the codebase forever.

## Gotchas

**Symptom:** Every row disappeared
**Cause:** `DELETE` with no `WHERE` — measured, `rowCount: 10` with no warning.
**Fix:** `BEGIN`, check the count, then commit.

**Symptom:** `42601 syntax error at or near "LIMIT"`
**Cause:** `DELETE … LIMIT n` is not PostgreSQL syntax.
**Fix:** `WHERE ctid IN (SELECT ctid FROM t … LIMIT n)`.

**Symptom:** `23503` or `23001` on a delete
**Cause:** A child row still references it. `23503` is `NO ACTION`, `23001` is
`RESTRICT`.
**Fix:** Delete children first, use `ON DELETE CASCADE` deliberately, or make the
constraint `DEFERRABLE INITIALLY DEFERRED` — possible with `NO ACTION`, not with
`RESTRICT`.

**Symptom:** Deleting one row removed rows from several tables
**Cause:** `ON DELETE CASCADE`, applied transitively.
**Fix:** Know your constraint graph. `RESTRICT` where a delete should be refused rather
than propagated.

**Symptom:** A delete of a few rows takes seconds
**Cause:** An unindexed foreign key forces a scan of the child table per parent row.
**Fix:** Index every foreign key column.

**Symptom:** The table is the same size after deleting most of it
**Cause:** `DELETE` marks tuples dead; `VACUUM` makes the space reusable but does not
truncate unless the empty pages are at the end. Measured 47 MB before and after.
**Fix:** Accept it if the table will refill. `VACUUM FULL` (blocking) or `pg_repack`
(online) to reclaim.

**Symptom:** A long-running bulk delete bloats unrelated tables
**Cause:** One long transaction holds back `VACUUM` database-wide.
**Fix:** Batch it — measured 4.2× slower in total, and worth it.

**Symptom:** Soft-deleted rows still show up
**Cause:** A query without `WHERE deleted_at IS NULL` — measured, `count(*)` returned 3
against 1 live row.
**Fix:** Filter in a view or a repository layer so it cannot be forgotten.

## Interview questions

**★ How do you delete ten million rows from a live table?**
In batches, not one statement. `DELETE FROM t WHERE ctid IN (SELECT ctid FROM t WHERE …
LIMIT 10000)` in a loop, since `DELETE` takes no `LIMIT`. Measured, batching 100 000 rows
took 484 ms against 115 ms for a single statement — slower in total, but each batch
commits, so locks are released, the job is interruptible, `VACUUM` is not held back by
one long transaction, and replication lag stays bounded.

**★ Why doesn't the table shrink after a `DELETE`?**
Because MVCC marks tuples dead rather than removing them, and `VACUUM` only makes that
space reusable in place. Measured: 47 MB before and after deleting half the rows, still
47 MB after `VACUUM`, and 24 MB only after `VACUUM FULL`, which rewrites the table under
`ACCESS EXCLUSIVE`. `VACUUM` can truncate when the empty pages are trailing — deleting
*every* row took the same table to 24 kB.

**★ What is the difference between `ON DELETE RESTRICT` and `ON DELETE NO ACTION`?**
Both refuse the delete, with different SQLSTATEs — measured `23001` for `RESTRICT` and
`23503` for `NO ACTION`. The real difference is deferrability: `NO ACTION` can be
`DEFERRABLE INITIALLY DEFERRED`, so the check happens at commit and you may delete parent
and child in any order inside one transaction. `RESTRICT` always checks immediately.
`NO ACTION` is the default.

**★ Why might deleting a single row take seconds?**
Most often an unindexed foreign key: PostgreSQL must scan the referencing table to check
whether any child rows exist. Also possible are cascades reaching far more rows than
expected, or row triggers doing work per row.

**When should you use `TRUNCATE` instead?**
When emptying the whole table and no row triggers need to fire. It is far faster and
reclaims space immediately, but it takes `ACCESS EXCLUSIVE`, has no `WHERE` and no
`RETURNING`, and is blocked by inbound foreign keys.

**Is a soft delete a `DELETE`?**
No — it is an `UPDATE` setting `deleted_at`. No cascades fire, unique constraints still
count the row, and every query needs `WHERE deleted_at IS NULL` from then on. Measured,
orders belonging to a soft-deleted user remained visible.

---

← [`ORDER BY`](10-order-by.md) · Next → [`DISTINCT` and `DISTINCT ON`](12-distinct-on.md)
