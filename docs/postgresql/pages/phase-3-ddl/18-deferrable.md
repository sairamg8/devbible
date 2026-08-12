---
title: "Deferrable constraints and circular foreign keys"
sidebar_label: "18 · Deferrable constraints"
sidebar_position: 18
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex11-ddl-alter.mjs`,
> `ex12-ddl-rest.mjs`.

**A deferrable constraint is checked at `COMMIT` instead of at each statement. That
is the only way to write two rows that reference each other, and the only way to
reorder rows in a unique column without a temporary value.**

## The circular reference problem

Two tables that must point at each other cannot both be inserted first:

```sql
CREATE TABLE c_a (id int PRIMARY KEY, b_id int);
CREATE TABLE c_b (id int PRIMARY KEY, a_id int REFERENCES c_a(id));
ALTER TABLE c_a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES c_b(id);
```

```console
$ node ex11-ddl-alter.mjs
=== 7. circular foreign keys ===
deferred FK: both rows inserted inside one transaction — ok
immediate FK → 23503 insert or update on table "c_c" violates foreign key constraint "c_d_fk"
```

With the constraint declared `DEFERRABLE INITIALLY DEFERRED`, both inserts succeed
inside one transaction — the check runs at `COMMIT`, by which time both rows exist.
Immediate (the default) fails with `23503` on the first insert, because `c_d(1)`
does not exist yet.

```sql
ALTER TABLE c_a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES c_b(id)
  DEFERRABLE INITIALLY DEFERRED;
```

## Three settings, not two

| Declaration | Behaviour |
|---|---|
| `NOT DEFERRABLE` (default) | Checked per statement. Cannot be deferred at all |
| `DEFERRABLE INITIALLY IMMEDIATE` | Checked per statement **by default**, but a transaction may opt in with `SET CONSTRAINTS … DEFERRED` |
| `DEFERRABLE INITIALLY DEFERRED` | Checked at `COMMIT` |

`DEFERRABLE INITIALLY IMMEDIATE` is usually the right declaration: normal writes
fail fast, and the one transaction that needs the escape hatch asks for it.

```sql
BEGIN;
SET CONSTRAINTS a_b_fk DEFERRED;   -- or ALL DEFERRED
-- ... the writes that are transiently inconsistent ...
COMMIT;
```

## The other classic use: reordering a unique column

```sql
-- positions 1,2,3 → swap 1 and 2. With an immediate UNIQUE this fails midway.
BEGIN;
SET CONSTRAINTS items_position_key DEFERRED;
UPDATE items SET position = 2 WHERE id = 1;
UPDATE items SET position = 1 WHERE id = 2;
COMMIT;
```

Without deferral the first `UPDATE` collides with the existing row at position 2 and
raises `23505`, forcing the usual workaround of moving a row to a temporary
out-of-range value first. Deferred, the intermediate state is allowed and only the
final state is checked.

**This requires a deferrable *constraint*, not a unique index.** A bare
`CREATE UNIQUE INDEX` cannot be deferred — see
[Unique constraints vs unique indexes](08-unique-nulls.md). Declare it as
`ALTER TABLE items ADD CONSTRAINT items_position_key UNIQUE (list_id, position)
DEFERRABLE INITIALLY IMMEDIATE`.

## What cannot be deferred

- **`RESTRICT` foreign keys.** Measured in [Foreign keys](03-foreign-keys.md):
  deferred `NO ACTION` allowed a delete-then-fix inside one transaction, while
  `RESTRICT` still raised `23001`. That is the entire practical difference between
  the two actions — so if you may need deferral, use `NO ACTION`.
- **`NOT NULL`.** It is a column property, not a deferrable constraint. There is no
  way to allow a transient NULL.
- **`CHECK` constraints** in practice — they are per-row and evaluated as the row is
  written.

Deferrable applies to `UNIQUE`, `PRIMARY KEY`, `EXCLUDE` and foreign keys.

## The costs

**Errors arrive at `COMMIT`, far from the statement that caused them.** The stack
trace points at your `COMMIT` call, not at the offending `UPDATE`, which makes
debugging materially harder. Application error handling must cope with a constraint
violation thrown by commit — code that only wraps individual statements in
`try/catch` will miss it entirely.

**Violations are held in memory until commit.** A transaction that violates a
deferred constraint on a million rows accumulates a million pending checks, which
costs memory and makes the commit itself slow.

**A deferrable unique constraint cannot be used by `ON CONFLICT`.** Upserts need an
immediate arbiter, so declaring a constraint deferrable removes it as an upsert
target — a real and easily missed consequence for a table you also seed with
`ON CONFLICT DO NOTHING`
([Seeding](../phase-8-schema-from-node/03-seeding.md)).

## Trade-off

Deferral buys the ability to pass through a temporarily inconsistent state, which is
occasionally the only way to express an operation at all — circular references,
position swaps, bulk reorders.

It costs fail-fast behaviour, debuggability, memory on large transactions, and
`ON CONFLICT` compatibility. So the default posture is `DEFERRABLE INITIALLY
IMMEDIATE`: the capability is available, but nothing pays for it until a transaction
explicitly asks.

Circular foreign keys are worth one further thought before you reach for this: they
are often a modelling smell. "A company has a primary contact, a contact belongs to a
company" is frequently better as a nullable FK one way plus a
`is_primary` flag, or a separate join row — no cycle, no deferral, no commit-time
surprises.

## Gotchas

**Symptom:** `23503` inserting the first of two rows that reference each other
**Cause:** The constraint is immediate; the counterpart does not exist yet.
**Fix:** `DEFERRABLE INITIALLY DEFERRED`, or `SET CONSTRAINTS … DEFERRED` in the
transaction.

**Symptom:** `23001` on a delete inside a transaction that fixes it before commit
**Cause:** `ON DELETE RESTRICT` cannot be deferred, unlike `NO ACTION`.
**Fix:** Declare the FK `NO ACTION` (the default) if deferral may be needed.

**Symptom:** `23505` swapping two values in a unique column
**Cause:** The intermediate state collides, and the constraint is checked per
statement.
**Fix:** A deferrable unique *constraint* plus `SET CONSTRAINTS … DEFERRED`.

**Symptom:** `SET CONSTRAINTS` has no effect
**Cause:** The constraint is `NOT DEFERRABLE`, or it is a bare unique index rather
than a constraint.
**Fix:** Recreate it as `DEFERRABLE`; indexes cannot be deferred.

**Symptom:** An error is thrown by `COMMIT` and the stack points nowhere useful
**Cause:** Deferred checks run at commit, detached from the statement that caused
them.
**Fix:** Wrap `COMMIT` in the same error handling as statements; narrow the deferral
window.

**Symptom:** `ON CONFLICT` stopped working after making a constraint deferrable
**Cause:** Upsert requires an immediate arbiter.
**Fix:** Keep a separate immediate unique index for the upsert, or do not defer that
constraint.

**Symptom:** A large transaction is slow to commit and uses a lot of memory
**Cause:** Pending deferred checks accumulate until commit.
**Fix:** Smaller transactions, or defer only where required.

## Interview questions

**★ How do you insert two rows that reference each other?**
Declare at least one foreign key `DEFERRABLE INITIALLY DEFERRED` (or
`SET CONSTRAINTS … DEFERRED` in the transaction) and insert both inside one
transaction. The check runs at `COMMIT`, by which time both rows exist — measured;
the immediate version fails with `23503`.

**★ What is the difference between `INITIALLY IMMEDIATE` and `INITIALLY DEFERRED`?**
Both are deferrable; the difference is the default. `INITIALLY IMMEDIATE` checks per
statement unless a transaction opts in with `SET CONSTRAINTS … DEFERRED`, which is
usually the right declaration — fail fast normally, defer only where needed.
`NOT DEFERRABLE` cannot be deferred at all.

**★ What can't be deferred?**
`NOT NULL` (a column property), `CHECK` in practice, and foreign keys declared
`RESTRICT` — measured, deferred `NO ACTION` allowed a delete-then-fix while
`RESTRICT` raised `23001`. That is the real difference between those two actions.

**★ What does deferral cost?**
Errors surface at `COMMIT`, away from the statement that caused them, so debugging
and error handling get harder. Pending checks accumulate in memory on large
transactions. And a deferrable unique constraint cannot serve as an `ON CONFLICT`
arbiter.

**★ How do you swap two values in a unique column?**
A deferrable unique constraint and `SET CONSTRAINTS … DEFERRED`, so the intermediate
collision is tolerated and only the final state is checked. Without it you must move
one row to a temporary out-of-range value first. Note this needs a constraint — a
bare unique index cannot be deferred.

---

← [`COMMENT ON`](17-comments.md) · Next → [Table inheritance](19-inheritance.md)
