---
title: "Indexing foreign key columns"
sidebar_label: "18 · FK indexes"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

**PostgreSQL indexes the referenced PK/unique side automatically; it does not auto-index the referencing FK column.** Missing FK indexes make `DELETE`/`UPDATE` on the parent and joins on the child unnecessarily slow.

## Why it matters

Foreign keys enforce correctness. Without an index on `child.parent_id`, the database may seq-scan the child table to find rows that reference a parent being deleted or updated. Your API feels “randomly slow” on deletes of popular parents.

## In SQL

```sql
-- Parent
CREATE TABLE parents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

-- Child FK — constraint only
CREATE TABLE children (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id bigint NOT NULL REFERENCES parents(id) ON DELETE CASCADE
);

-- You must add this yourself:
CREATE INDEX children_parent_id_idx ON children (parent_id);
```

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c '\d measure_orders'
-- look for: "measure_orders_user_id_idx" btree (user_id)
```

> Verified: 2026-08 on **PostgreSQL 18.4** — `measure_orders` has an explicit index on `user_id` for the FK.

## From Node

Migrations that add `REFERENCES` should add the supporting index in the same migration (or the next, before production traffic):

```js
await client.query(`
  alter table orders
    add constraint orders_user_id_fkey
    foreign key (user_id) references users(id);
`);
await client.query(`
  create index orders_user_id_idx on orders (user_id);
`);
```

## Gotchas

**Symptom:** Deleting a user locks or scans forever  
**Cause:** FK to `users` without index on the child column  
**Fix:** `CREATE INDEX` on every FK column you join/filter/delete against  

**Symptom:** Joins on `user_id` always seq-scan  
**Cause:** Same missing index  
**Fix:** Index + `EXPLAIN (ANALYZE, BUFFERS)`

## Interview questions

**★ Does PostgreSQL automatically index foreign keys?**  
It indexes the **referenced** unique/PK side. The **referencing** column is not auto-indexed.

**★ Why index FK columns?**  
Joins, `ON DELETE`/`UPDATE` checks, and filters on the FK become index lookups instead of sequential scans.

**How do you find missing FK indexes?**  
Catalog queries comparing `pg_constraint` FK columns to `pg_index`, or review every `REFERENCES` in migrations.

---

← [Index bloat REINDEX](17-bloat-reindex.md) · [Phase 10 index](README.md)
