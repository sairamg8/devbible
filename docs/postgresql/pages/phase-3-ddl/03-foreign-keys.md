---
title: "Foreign keys"
sidebar_label: "03 · Foreign keys"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**A foreign key is the database refusing to hold a row that points at nothing. It
is the one invariant application code cannot enforce correctly, because two
concurrent requests can both check and both be wrong.** The cost is one index you
must remember to create yourself.

## Every `ON DELETE` action, measured

```sql
CREATE TABLE fk_child (
  id        int PRIMARY KEY,
  parent_id int REFERENCES fk_parent(id) ON DELETE <action>
);
```

Delete the parent of an existing child:

```console
$ node ex12-ddl-rest.mjs
=== 1. ON DELETE actions ===
ON DELETE NO ACTION    → 23503 update or delete on table "fk_parent" violates foreign key constraint "fk_child_parent_id_fkey" on table "fk_child"
ON DELETE RESTRICT     → 23001 update or delete on table "fk_parent" violates RESTRICT setting of foreign key constraint "fk_child_parent_id_fkey" on table "fk_child"
ON DELETE CASCADE      → child row deleted
ON DELETE SET NULL     → child.parent_id = null
ON DELETE SET DEFAULT  → child.parent_id = 0
```

Note the two error codes are **different**: `23503` (`foreign_key_violation`) for
`NO ACTION`, `23001` (`restrict_violation`) for `RESTRICT`. Map both to a 409 in an
API; code that only handles `23503` will let a `RESTRICT` violation become a 500.

`NO ACTION` is the default when you write no action at all.

### `NO ACTION` vs `RESTRICT` — the difference only appears when deferred

They look identical above. The distinction is *when* the check runs:

```console
=== 2. RESTRICT vs NO ACTION — the difference only shows when deferred ===
NO ACTION  deferred → allowed — checked at COMMIT
RESTRICT   deferred → 23001 update or delete on table "d_parent" violates RESTRICT setting
```

Both statements deleted the parent and then deleted the child before committing.
`NO ACTION` deferred its check to `COMMIT`, by which time the child was gone, so it
succeeded. **`RESTRICT` cannot be deferred** — it fires immediately, at statement
time.

Use `NO ACTION` (the default) when you may need `DEFERRABLE`; use `RESTRICT` when
you want the failure as early as possible and will never defer.

### Choosing an action

- **`CASCADE`** for rows that have no meaning without the parent — order lines with
  their order, tags on a deleted post. Be careful: cascades chain, so deleting one
  user can delete a subtree you did not picture. There is no dry run.
- **`RESTRICT`/`NO ACTION`** for anything a human should confirm — deleting a
  customer who has invoices should fail, not silently erase the invoices.
- **`SET NULL`** for optional relationships: an employee's `manager_id` when the
  manager leaves. The column must be nullable.
- **`SET DEFAULT`** for a sentinel row, such as reassigning to an "unassigned"
  record. The default value must itself exist in the parent, or the delete fails
  with a fresh FK violation.

`ON UPDATE` takes the same actions and matters far less, because a well-chosen
primary key never changes. If you find yourself needing `ON UPDATE CASCADE`, that is
a signal the key is natural and mutable — see
[Primary keys](02-primary-keys.md).

## PostgreSQL does not index the referencing column

The parent side is indexed automatically, because it must be a primary key or unique
constraint. **The child side is not**, and every parent delete or key update then
scans the child table.

```console
=== 3. deleting a parent when the child FK column is unindexed ===
DELETE parent, child FK unindexed: 33.6 ms
DELETE parent, child FK indexed:   8.7 ms  (4× faster)
```

300 000 child rows, 1 000 parents. The gap widens with the child table: this is a
sequential scan per deleted parent row, so deleting 1 000 parents scans the child
table 1 000 times.

```sql
CREATE TABLE fk_child (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id int NOT NULL REFERENCES fk_parent(id) ON DELETE CASCADE
);
CREATE INDEX fk_child_parent_id_idx ON fk_child (parent_id);   -- always
```

**Index the referencing column of every foreign key.** The exceptions are rare
enough not to be worth remembering. The same index almost always serves the query
you write anyway — "all children of this parent" — so it is rarely wasted. Phase 10
covers when it is not.

## Where the constraint has to live

The alternative is checking in application code:

```js
// ✗ two concurrent requests can both pass this
const parent = await findParent(id);
if (!parent) throw new NotFound();
await insertChild({parent_id: id});
```

Between the check and the insert, another transaction can delete the parent. The
row is written and points at nothing. No amount of application care closes that
window — only the database, which evaluates the constraint as part of the write, can.

This is the same argument as [Seeding](../phase-8-schema-from-node/03-seeding.md)'s
unique constraint: correctness under concurrency belongs where the writes are
serialised.

## Handling the errors in an API

```js
try {
  await repo.create(client, {parentId, ...});
} catch (err) {
  if (err.code === '23503') return res.status(409).json({error: 'related record missing or in use'});
  if (err.code === '23001') return res.status(409).json({error: 'record is still referenced'});
  throw err;
}
```

`err.constraint` names the specific constraint, which is why naming them explicitly
([Naming conventions](11-naming.md)) pays off — `fk_child_parent_id_fkey` is
PostgreSQL's generated name and it is at least parseable; a hand-named
`orders_customer_fk` is better.

## Trade-off

Foreign keys guarantee referential integrity and give cascade behaviour for free.
They cost write throughput — every insert into the child checks the parent, and
every parent delete checks the children — and they constrain the order of bulk
operations, which is why large loads often drop and recreate them.

They also make sharding hard: a foreign key cannot span database servers, so a
schema built on them has a natural size limit. That is the real argument the
"foreign keys don't scale" camp is making, and it applies at a scale most
applications never reach. Until then the integrity is worth more than the writes.

## Gotchas

**Symptom:** Deleting a parent is slow, and gets slower as the app grows
**Cause:** The child's FK column is unindexed, so each delete scans the child table.
Measured 33.6 ms vs 8.7 ms.
**Fix:** `CREATE INDEX` on every referencing column.

**Symptom:** A `RESTRICT` violation returns 500 while `NO ACTION` returns 409
**Cause:** They raise different SQLSTATEs — `23001` and `23503`.
**Fix:** Handle both.

**Symptom:** Deleting one row deleted far more than expected
**Cause:** `ON DELETE CASCADE` chains through several levels.
**Fix:** Map the cascade graph before using it; prefer `RESTRICT` for anything a
human should confirm.

**Symptom:** `ON DELETE SET NULL` fails
**Cause:** The referencing column is `NOT NULL`.
**Fix:** Make it nullable, or choose a different action.

**Symptom:** `ON DELETE SET DEFAULT` fails with a foreign key violation
**Cause:** The default value does not exist in the parent table.
**Fix:** Ensure the sentinel row exists — and that nothing deletes it.

**Symptom:** Rows exist that reference missing parents
**Cause:** The check was in application code, and two transactions interleaved.
**Fix:** A real foreign key; the window cannot be closed from the application.

**Symptom:** A bulk load is extremely slow
**Cause:** Per-row FK checks.
**Fix:** Load into a staging table, or drop and recreate the constraint around the
load — and remember `VALIDATE` costs a scan.

## Interview questions

**★ What are the `ON DELETE` actions and what does each do?**
`NO ACTION` (default) and `RESTRICT` both block the delete — measured as `23503`
and `23001` respectively. `CASCADE` deletes the children. `SET NULL` nulls the
referencing column. `SET DEFAULT` sets it to the column default, which must itself
exist in the parent.

**★ What is the actual difference between `NO ACTION` and `RESTRICT`?**
Timing. `NO ACTION` can be deferred to commit; `RESTRICT` always fires immediately.
Measured: inside one transaction, deleting the parent then the child succeeded under
deferred `NO ACTION` and failed under `RESTRICT`.

**★ Does PostgreSQL index foreign keys?**
It indexes the *referenced* side, because that must be a primary key or unique
constraint. The *referencing* column is not indexed, so parent deletes and key
updates scan the child table — measured 4× slower at 300k child rows, and the gap
grows with the table. Index every referencing column.

**★ Why can't application code enforce referential integrity?**
Between checking the parent exists and inserting the child, another transaction can
delete the parent. The check and the write are not atomic. Only the database, which
evaluates the constraint as part of the write, can close that window.

**★ When would you deliberately not use a foreign key?**
When the relationship spans databases or services (a constraint cannot cross
servers), during bulk loads where per-row checks dominate, or in a data warehouse
where the ETL guarantees integrity and write throughput matters more. Each trades a
guarantee for throughput — say which you are trading.

**Why does `ON UPDATE CASCADE` rarely matter?**
Because a well-chosen primary key never changes. Needing it is a sign the key is
natural and mutable, which is an argument for a surrogate key instead.

---

← [Primary keys](02-primary-keys.md) · Next → [`NOT NULL`, `DEFAULT`, `UNIQUE`, `CHECK`](04-constraints.md)
