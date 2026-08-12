---
title: "COMMENT ON"
sidebar_label: "17 · COMMENT ON"
sidebar_position: 17
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**Schema documentation stored in the schema. It travels with the database, survives
every restore, and is visible to anyone with `psql` — which is more than can be said
for the wiki page.**

## Writing and reading it back

```sql
COMMENT ON TABLE gen_t IS 'demo of generated columns';
COMMENT ON COLUMN gen_t.total IS 'price * qty, maintained by the database';
```

```console
$ node ex12-ddl-rest.mjs
=== 7. COMMENT ON ===
┌─────────┬─────────┬─────────────────────────────┬─────────┬───────────────────────────────────────────┐
│ (index) │ obj     │ table_comment               │ col     │ column_comment                            │
├─────────┼─────────┼─────────────────────────────┼─────────┼───────────────────────────────────────────┤
│ 0       │ 'gen_t' │ 'demo of generated columns' │ 'total' │ 'price * qty, maintained by the database' │
└─────────┴─────────┴─────────────────────────────┴─────────┴───────────────────────────────────────────┘
```

The two functions that read them:

```sql
SELECT obj_description('gen_t'::regclass);                    -- table, view, index…
SELECT col_description('gen_t'::regclass, attnum);            -- a column
```

In `psql`, `\d+ gen_t` shows column comments and `\dt+` shows table comments. The
`+` is the whole difference — plain `\d` hides them, which is why many people have
used PostgreSQL for years without noticing the feature.

## Everything can be commented

```sql
COMMENT ON TABLE      orders           IS 'Customer orders. One row per checkout.';
COMMENT ON COLUMN     orders.status    IS 'pending|paid|shipped|cancelled. See CHECK constraint.';
COMMENT ON CONSTRAINT orders_total_chk ON orders IS 'Total must match sum of line items.';
COMMENT ON INDEX      orders_user_idx  IS 'Supports the account order history endpoint.';
COMMENT ON SCHEMA     staging          IS 'Load buffer. Contents are disposable.';
COMMENT ON FUNCTION   calc_total(bigint) IS 'Excludes cancelled line items.';
```

`COMMENT ON INDEX` is underrated: it answers "can I drop this?" — the question that
comes up whenever someone audits unused indexes and finds one with no obvious owner.

## Deleting and updating

There is no `DROP COMMENT`. Setting `NULL` removes it, and a second `COMMENT ON`
replaces rather than appends:

```sql
COMMENT ON COLUMN orders.status IS NULL;   -- removes it
```

Comments are **not inherited** by partitions or child tables, and are lost when an
object is dropped and recreated — which is exactly what a column type change does in
some migration paths. Re-apply them in the migration that recreated the object.

## Making them survive: put them in the migration

A comment written once by hand in `psql` is gone at the next restore into a fresh
database. Put them in the migration file that creates the object:

```sql
-- 003-create-orders.sql
CREATE TABLE orders (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pending','paid','shipped','cancelled'))
);
COMMENT ON TABLE  orders        IS 'Customer orders. One row per checkout.';
COMMENT ON COLUMN orders.status IS 'Lifecycle state; see the CHECK for valid values.';
```

`pg_dump` includes comments, so from then on they follow every dump, restore and
clone.

## What to write, and what not to

**Worth a comment:**

- **Why**, not what. `status text` needs no comment saying "the status"; it needs one
  saying what the states mean and who transitions them.
- **Units and precision.** `amount numeric(12,2)` — minor units or major? Which
  currency? This is the single highest-value comment in most schemas.
- **Non-obvious invariants** the constraint name alone does not convey.
- **Deprecations.** `'DEPRECATED 2026-08: use orders.total_cents. Remove after
  2026-11.'` — this is the one that saves a colleague a wasted afternoon.
- **Why an index exists**, so a future audit can decide safely.

**Not worth it:** restating the column name, restating the type, or anything that
will silently rot. A wrong comment is worse than none, because it is believed.

## Reading them programmatically

Useful for generating documentation, or for a schema-drift report that includes
intent:

```sql
SELECT c.relname AS table_name,
       a.attname AS column_name,
       col_description(c.oid, a.attnum) AS comment
  FROM pg_class c
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY c.relname, a.attnum;
```

`information_schema` does **not** expose comments — this needs `pg_catalog`. That is
one of the few places the standard view is insufficient, and it catches people
extending the drift check from
[Schema drift](../phase-8-schema-from-node/13-schema-drift.md).

## Trade-off

Comments live with the object, survive restores, need no separate tool, and are
visible to anyone connected. They cost the same thing all documentation costs:
they go stale, and nothing enforces accuracy. A comment describing a constraint that
was later relaxed is now a lie stored in the database.

The mitigation is to comment only what is expensive to rediscover — units, state
machines, deprecations, index rationale — and to treat comment changes as part of the
migration that changes the thing, not as a separate tidy-up nobody schedules.

## Gotchas

**Symptom:** Comments do not appear in `psql`
**Cause:** `\d` hides them.
**Fix:** `\d+` and `\dt+`.

**Symptom:** Comments vanished after restoring into a new database
**Cause:** They were added by hand and never put in a migration.
**Fix:** `COMMENT ON` in the migration file; `pg_dump` then carries them.

**Symptom:** A comment disappeared after a migration
**Cause:** The object was dropped and recreated — comments do not survive that, and
are not inherited by partitions.
**Fix:** Re-apply in the same migration.

**Symptom:** A query against `information_schema` returns no comments
**Cause:** `information_schema` does not expose them.
**Fix:** `obj_description` / `col_description` over `pg_catalog`.

**Symptom:** A comment contradicts the constraint
**Cause:** The constraint changed and the comment did not.
**Fix:** Update comments in the migration that changes behaviour; delete comments
you cannot keep true.

**Symptom:** `COMMENT ON` appended nothing / duplicated
**Cause:** It replaces rather than appends; `NULL` deletes.
**Fix:** Write the full replacement text.

## Interview questions

**★ Where does `COMMENT ON` store documentation, and how do you read it back?**
In the catalog, alongside the object. Read it with `obj_description(oid)` and
`col_description(oid, attnum)`, or `\d+` in `psql`. It is included by `pg_dump`, so
it survives dumps, restores and clones.

**★ Why doesn't `information_schema` show comments?**
Comments are a PostgreSQL extension rather than part of the SQL standard that
`information_schema` models, so they are only in `pg_catalog`. Anything reading
schema metadata programmatically has to use `pg_catalog` for them.

**★ What is actually worth commenting?**
Units and precision (is `amount numeric(12,2)` minor units? which currency?), state
machines, non-obvious invariants, deprecations with a removal date, and why an index
exists. Not the column name or type restated — a stale comment is worse than none
because it is believed.

**★ Why put comments in migrations rather than adding them ad hoc?**
A comment typed once into `psql` is lost the next time the database is rebuilt from
migrations. In the migration it is reproducible everywhere, and it is reviewed
alongside the change it describes.

**Do comments survive a column type change?**
Not if the migration drops and recreates the object — and they are not inherited by
partitions or child tables. Re-apply them in the same migration.

---

← [`TEMPORARY` and `UNLOGGED` tables](16-temp-unlogged.md) · Next → [Deferrable constraints](18-deferrable.md)
