---
title: "Indexing foreign key columns"
sidebar_label: "18 · FK indexes"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex26-index-ops.mjs`,
> `ex12-ddl-rest.mjs`.

**PostgreSQL indexes the *referenced* side of a foreign key automatically, because that
side must already be `PRIMARY KEY` or `UNIQUE`. It never indexes the *referencing*
column. That index is yours to create, and without it every parent `DELETE` scans the
child table.**

## The cost of the missing index

1000 parents, 300 000 children, `ON DELETE CASCADE`, deleting one parent:

```console
$ node ex26-index-ops.mjs
DELETE parent, child FK unindexed: 33.2 ms
DELETE parent, child FK indexed:   6.2 ms  (5x faster)
```

**5× on a table of only 300 000 rows.** The work is not the deletion — it is finding the
children. Without an index PostgreSQL must scan the whole child table to answer "does
anything reference this row", and it must do that for *every* parent row deleted or
key-updated.

Scale that up: a 50-million-row child table means a full scan per parent delete. This is
the classic "deleting one user takes four minutes" incident.

The same scan happens for `ON DELETE RESTRICT`, `SET NULL` and `NO ACTION` — see
[DELETE](../phase-4-crud/11-delete.md) for how those differ otherwise. And the same index
serves the join you write in every query that walks from parent to child.

## Finding every one you are missing

```console
=== 8. foreign keys whose referencing column is not indexed ===
fk_child has no index on parent_id; fk_ok has one:
┌─────────┬─────────────┬───────────────────────────┬─────────────┐
│ (index) │ child_table │ constraint_name           │ fk_columns  │
├─────────┼─────────────┼───────────────────────────┼─────────────┤
│ 0       │ 'fk_child'  │ 'fk_child_parent_id_fkey' │ 'parent_id' │
└─────────┴─────────────┴───────────────────────────┴─────────────┘
```

```sql
SELECT c.conrelid::regclass AS child_table, c.conname AS constraint_name,
       (SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS fk_columns
FROM pg_constraint c
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indisvalid
      AND (string_to_array(i.indkey::text, ' ')::smallint[])[1:array_length(c.conkey,1)]
          = c.conkey::smallint[])
ORDER BY 1;
```

Two details make it correct rather than approximately correct:

- It compares the FK columns to the index's **leading** columns, so a composite index
  `(parent_id, created_at)` correctly counts as covering `parent_id` — the
  [leftmost-prefix rule](06-multicolumn.md).
- It requires `indisvalid`, so a failed
  [`CREATE INDEX CONCURRENTLY`](12-concurrently.md) does not read as coverage.

Run it against production. On a schema nobody has audited it almost always returns rows.

## In SQL

```sql
CREATE TABLE children (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id bigint NOT NULL REFERENCES parents(id) ON DELETE CASCADE
);

-- the line the constraint does NOT give you
CREATE INDEX children_parent_id_idx ON children (parent_id);
```

Often the right index is a composite that starts with the FK column and also serves your
list query:

```sql
CREATE INDEX ON orders (user_id, created_at DESC);   -- covers the FK and the listing
```

That single index does both jobs. Adding a separate `(user_id)` index alongside it is
[duplication](13-unused-indexes.md).

## From Node

Add the index in the **same migration** as the constraint. A migration that adds a
`REFERENCES` and leaves the index for later is a latent incident:

```js
await client.query(`
  ALTER TABLE orders
    ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);

await client.query(`CREATE INDEX orders_user_id_idx ON orders (user_id)`);
```

On a live table, use [`CREATE INDEX CONCURRENTLY`](12-concurrently.md) in a
non-transactional migration step.

Ship the audit as a test so the next schema change cannot regress it:

```js
test('every foreign key has a supporting index', async () => {
  const {rows} = await pool.query(FK_WITHOUT_INDEX_SQL);
  expect(rows).toEqual([]);
});
```

That is a genuinely useful test — it fails on the pull request rather than during the
incident. See [testing against real PostgreSQL](../phase-9-api-crud/16-testing-real-pg.md).

## Trade-off

**This is one of the few indexes that is nearly always worth it**, because the FK column
is by definition the one you join on and the one referential integrity checks scan. But it
is still an index: write cost on every insert into the child table, and disk.

The genuine exception is a child table that is only ever inserted into and read by its own
primary key, whose parent rows are never deleted or key-updated. That is rarer than it
sounds — `ON DELETE CASCADE` alone makes the index necessary.

Where the choice is real: prefer a composite index starting with the FK column when a
listing query needs one anyway, rather than one index for the constraint and another for
the query.

## Gotchas

**Symptom:** Deleting one parent row takes seconds or minutes
**Cause:** No index on the child's FK column, so the check scans the child table
**Fix:** `CREATE INDEX` on it — measured 33.2 ms → 6.2 ms on only 300 000 child rows

**Symptom:** "PostgreSQL creates indexes for foreign keys"
**Cause:** Confusing the two sides — the *referenced* side is indexed because it must be
`PRIMARY KEY` or `UNIQUE`
**Fix:** Index the referencing column yourself

**Symptom:** Joins from parent to child always sequential-scan
**Cause:** The same missing index
**Fix:** Same index; confirm with `EXPLAIN (ANALYZE, BUFFERS)`

**Symptom:** The audit query reports an FK you know is indexed
**Cause:** The index does not start with the FK column, or it is `indisvalid = false`
**Fix:** Check `indexdef` — leading columns are what count

**Symptom:** A composite FK `(a, b)` reported as unindexed despite an index on `(b, a)`
**Cause:** Column order must match the constraint's order
**Fix:** Create the index in the constraint's column order

## Interview questions

**★ Does PostgreSQL automatically index foreign keys?**
It indexes the **referenced** side, because that must be `PRIMARY KEY` or `UNIQUE`. The
**referencing** column is never auto-indexed.

**★ What breaks without that index?**
Every parent `DELETE` or key `UPDATE` scans the child table to check references, and every
parent-to-child join does the same. Measured: 33.2 ms versus 6.2 ms — 5× — on a 300 000-row
child table, and it scales with the child's size.

**★ How do you find missing FK indexes across a schema?**
Query `pg_constraint` for `contype = 'f'` and check no valid index has the constraint's
columns as its leading columns. Measured against a pair of tables, it reported exactly the
unindexed one.

**Does a composite index count?**
Yes, if the FK columns are the *leading* columns, in the constraint's order — the
leftmost-prefix rule.

**Is there ever a reason not to add it?**
A child table never joined from the parent and whose parents are never deleted or
key-updated. `ON DELETE CASCADE` alone removes that exception.

---

← [Index bloat and REINDEX](17-bloat-reindex.md) · [Phase 10 index](README.md)
