---
title: "DROP, CASCADE, RESTRICT"
sidebar_label: "13 · DROP and CASCADE"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**`DROP` refuses by default when anything depends on the object. `CASCADE` removes
the dependents instead — and it does not tell you what it removed until afterwards,
if at all.**

## The default is `RESTRICT`

```sql
CREATE TABLE dc_parent (id int PRIMARY KEY);
CREATE TABLE dc_child (id int, p int REFERENCES dc_parent(id));
CREATE VIEW dc_view AS SELECT * FROM dc_parent;

DROP TABLE dc_parent;
```

```console
$ node ex12-ddl-rest.mjs
=== 4. DROP TABLE with dependents ===
plain DROP  → 2BP01 cannot drop table dc_parent because other objects depend on it
DROP CASCADE → succeeded; view still there? GONE
child table still there? dc_child ← CASCADE drops the constraint, not the child table
```

`2BP01` is `dependent_objects_still_exist`. Writing no keyword means `RESTRICT`,
which is the safe default.

**Read the last line carefully, because it is the part people get wrong:**

- The **view** was dropped. It depended on the table's columns and cannot exist
  without them.
- The **child table survived**. Only its *foreign key constraint* was dropped.

So `DROP TABLE … CASCADE` does **not** delete related data. It deletes the things
that cannot exist without the dropped object — views, constraints, triggers,
dependent functions in some cases — and leaves everything else standing, now
unconstrained. A child table whose FK silently vanished will happily accumulate rows
pointing at nothing.

This is the opposite of `ON DELETE CASCADE`, which *does* delete child rows
([Foreign keys](03-foreign-keys.md)). Same word, different mechanism, different blast
radius. `DROP … CASCADE` acts on schema dependencies; `ON DELETE CASCADE` acts on
row references.

## See what will go, before it goes

There is no dry-run flag. The error message from a plain `DROP` is itself the
inventory, and it is the cheapest way to find out:

```
NOTICE:  drop cascades to view dc_view
NOTICE:  drop cascades to constraint dc_child_p_fkey on table dc_child
```

Run the plain `DROP` first and read the detail, or query the catalog:

```sql
SELECT dependent_ns.nspname || '.' || dependent_view.relname AS dependent
  FROM pg_depend
  JOIN pg_rewrite     ON pg_depend.objid = pg_rewrite.oid
  JOIN pg_class       AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
  JOIN pg_class       AS source_table   ON pg_depend.refobjid = source_table.oid
  JOIN pg_namespace   AS dependent_ns   ON dependent_view.relnamespace = dependent_ns.oid
 WHERE source_table.relname = 'dc_parent';
```

Best practice in a migration: **run the plain `DROP` and let it fail** in review,
inspect the list, then write `CASCADE` deliberately — or better, drop the named
dependents explicitly so the migration file records what was removed.

## `DROP` is transactional — which is the safety net

```sql
BEGIN;
DROP TABLE dc_parent CASCADE;
-- look around: is anything broken?
ROLLBACK;
```

Because DDL participates in transactions
([Transactional DDL](07-transactional-ddl.md)), you can drop, inspect, and roll
back. That is the closest thing to a dry run, and it works in `psql` against a copy
of production.

The limit is that a `DROP` inside a transaction still takes `ACCESS EXCLUSIVE` and
holds it until you decide — so do this on a clone, not on the live database.

## `IF EXISTS`, and where it is honest

```sql
DROP TABLE IF EXISTS dc_parent CASCADE;
```

Right for teardown scripts and test fixtures, where absence genuinely is fine. Wrong
in a migration meant to drop a specific table: if the table is not there, something
has gone wrong and you want to know, not to succeed silently. Same reasoning as
[`CREATE TABLE IF NOT EXISTS`](../phase-8-schema-from-node/07-if-not-exists.md) — the clause suppresses the error
you wanted along with the one you did not.

## Prefer not dropping at all

For a column or table that application code has stopped using, the safer sequence is
two deploys:

1. **Deploy the code that no longer references it.** Confirm nothing errors.
2. **Rename it** — `ALTER TABLE t RENAME COLUMN old TO old_deprecated_20260812` —
   which is instant and immediately reveals any straggler as a clear
   `42703 column does not exist`.
3. **Drop it later**, once you are confident.

Renaming first turns an irreversible data loss into a reversible mistake. Dropping a
column is a catalog change (3 ms, no rewrite — see [`ALTER TABLE`](05-alter-table.md)),
but the data becomes unreachable immediately, and recovering it means a restore.

## Trade-off

`CASCADE` turns a blocked migration into a working one in a single keyword, which is
exactly why it gets typed at the end of a long day. Its cost is that the set of
things it removes is computed by the database and not shown to you in advance —
so the migration file records the *intent* to drop one table and silently performs an
unknown number of other drops.

`RESTRICT` (the default) is slower and makes you enumerate the dependents. That
enumeration is the value: it is a written record of everything the change touched,
reviewable by someone else.

## Gotchas

**Symptom:** `2BP01 cannot drop table … because other objects depend on it`
**Cause:** A view, foreign key, trigger or function depends on it — the default is
`RESTRICT`.
**Fix:** Read the `NOTICE` list, then drop the named dependents explicitly, or use
`CASCADE` deliberately.

**Symptom:** `DROP TABLE … CASCADE` did not delete related rows
**Cause:** It drops schema *dependencies*, not data. The child table survives; only
its FK constraint is dropped — measured.
**Fix:** Delete the data explicitly if that was the intent.

**Symptom:** Orphan rows appear after a table was dropped with `CASCADE`
**Cause:** The child's foreign key was silently removed, so nothing enforces the
reference any more.
**Fix:** Recreate the constraint, clean the orphans, and enumerate dependents before
dropping in future.

**Symptom:** A view disappeared and nobody knows when
**Cause:** It depended on a dropped table and went with the `CASCADE`.
**Fix:** Capture the `NOTICE` output in migration logs; review the dependency list
first.

**Symptom:** A migration succeeded but dropped nothing
**Cause:** `IF EXISTS` on a table that was already gone — or misnamed.
**Fix:** Use `IF EXISTS` only in teardown, not in migrations that must do something.

**Symptom:** A dropped column is needed again
**Cause:** `DROP COLUMN` makes the data unreachable immediately.
**Fix:** Rename first, drop a deploy or two later; recovery otherwise means a
restore.

## Interview questions

**★ What is the default when you `DROP` an object with dependents?**
`RESTRICT` — it fails with `2BP01 dependent_objects_still_exist` and lists what
depends on it. Writing no keyword gives you the safe behaviour.

**★ Does `DROP TABLE … CASCADE` delete rows in related tables?**
No. It drops objects that cannot exist without the table — measured, the dependent
*view* was dropped while the child *table* survived with only its foreign key
constraint removed. That leaves the child unconstrained and able to accumulate
orphan rows. `ON DELETE CASCADE` is the row-level mechanism and is unrelated.

**★ How do you find out what a `CASCADE` will remove?**
Run the plain `DROP` and read the `NOTICE`/error detail, which enumerates the
dependents. Or wrap it in `BEGIN … ROLLBACK` on a clone and inspect — DDL is
transactional, so that is a workable dry run.

**★ Why rename a column before dropping it?**
Renaming is instant and reversible; any code still referencing it fails immediately
with a clear `42703`. Dropping makes the data unreachable at once, and undoing it
means restoring from backup.

**★ When is `DROP … IF EXISTS` appropriate?**
Teardown scripts and test fixtures. Not in a migration that is supposed to drop a
specific object — there, a missing table means something is wrong and the error is
the information you want.

---

← [Normalization to 3NF](12-normalization.md) · Next → [Sequences as real objects](14-sequences.md)
