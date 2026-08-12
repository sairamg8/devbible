---
title: "TRUNCATE vs DELETE"
sidebar_label: "14 · TRUNCATE vs DELETE"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `ex8-bulk-and-seed.mjs`; foreign-key and trigger behaviour run directly in `psql`.

**`DELETE` removes rows one at a time, honouring every trigger and `WHERE` clause.
`TRUNCATE` discards the whole table's storage in one operation. They are not the same
statement with different speeds — the semantics differ in ways that break things
quietly.**

## Speed, on 10 000 rows

```console
$ node ex8-bulk-and-seed.mjs
=== 4. reset strategies, 10 000 rows ===
DELETE FROM                           12.7 ms  rows left=0
TRUNCATE                               4.4 ms  rows left=0
TRUNCATE ... RESTART IDENTITY          4.7 ms  rows left=0
```

**2.9× faster**, and the gap widens with table size: `DELETE` is O(rows) because it
marks each one dead and writes WAL for each, while `TRUNCATE` is closer to O(1) — it
allocates new, empty files for the table and its indexes.

`DELETE` also leaves **dead tuples** behind. The space is not returned until
`VACUUM` runs, so a table repeatedly emptied with `DELETE` grows on disk even though
it is logically empty. `TRUNCATE` reclaims immediately.

## It is transactional — unlike most engines

```console
$ node ex14-crud.mjs
=== 14. TRUNCATE is transactional ===
inside tx after TRUNCATE: 0
after ROLLBACK: 100 ← TRUNCATE rolls back, unlike most engines
```

100 rows, `TRUNCATE` inside a transaction, `ROLLBACK` — **all 100 rows back**. In
MySQL and Oracle, `TRUNCATE` is DDL that commits implicitly and cannot be undone.

This follows from the same property as [transactional
DDL](../phase-3-ddl/07-transactional-ddl.md), and it makes `TRUNCATE` safe to use
inside a migration: if a later statement fails, the data is still there.

The cost is a lock. `TRUNCATE` takes `ACCESS EXCLUSIVE` and holds it until commit, so
it blocks every reader and writer of that table — while `DELETE` takes only
`ROW EXCLUSIVE` and lets concurrent reads continue.

## It does not reset identity by default

```console
id after plain TRUNCATE: 10001 ← identity NOT reset
id after RESTART IDENTITY: 1
```

The table is empty and the next id is 10001. Sequences are separate objects
([Sequences](../phase-3-ddl/14-sequences.md)); emptying the table says nothing about
them.

```sql
TRUNCATE t RESTART IDENTITY;
```

This matters for tests asserting on generated ids — such a test passes on a fresh
database and fails on the second run
([Resetting between test runs](../phase-8-schema-from-node/11-test-reset.md)).

## Foreign keys block it

```console
$ psql -c 'TRUNCATE t_parent;'
ERROR:  cannot truncate a table referenced in a foreign key constraint
DETAIL:  Table "t_child" references "t_parent".
HINT:  Truncate table "t_child" at the same time, or use TRUNCATE ... CASCADE.

$ psql -c 'TRUNCATE t_parent CASCADE;'
NOTICE:  truncate cascades to table "t_child"
TRUNCATE TABLE
```

`0A000` — refused, with a genuinely helpful `HINT`. Two ways through, and the
difference matters:

```sql
TRUNCATE t_parent, t_child;        -- ✓ explicit: you named what gets emptied
TRUNCATE t_parent CASCADE;         -- ⚠ empties every referencing table, transitively
```

**`TRUNCATE … CASCADE` empties tables you did not name**, following the foreign-key
graph as far as it goes. Unlike `DROP … CASCADE` — which removes *constraints* and
leaves child tables' data alone
([`DROP`, `CASCADE`, `RESTRICT`](../phase-3-ddl/13-drop-cascade.md)) — this one
deletes rows. Prefer naming every table explicitly; the `NOTICE` telling you what
else was emptied arrives after the fact.

Listing them in one statement is also what avoids deadlocks between parallel test
files, since all the locks are taken together.

## `TRUNCATE` does not fire row triggers

```console
$ psql   # AFTER DELETE FOR EACH ROW trigger logging to t_log
 after_delete
--------------
            2      ← DELETE of 2 rows fired the trigger twice

 after_truncate
----------------
              2    ← TRUNCATE of 1 row fired it zero more times
```

The log stayed at 2. **Row-level triggers do not fire**, because no rows are
individually deleted — there is nothing for a `FOR EACH ROW` trigger to see.

This is the quiet one. Audit logging, cache invalidation, denormalized counter
maintenance — anything implemented as an `AFTER DELETE FOR EACH ROW` trigger is
silently skipped, and the application's derived state is now wrong with no error
anywhere.

`TRUNCATE` has its own statement-level trigger event if you need one:

```sql
CREATE TRIGGER t_tr AFTER TRUNCATE ON t FOR EACH STATEMENT EXECUTE FUNCTION f();
```

## Other differences worth knowing

- **No `WHERE`.** `TRUNCATE` is all-or-nothing; any partial removal is a `DELETE`.
- **No `RETURNING`.** `DELETE … RETURNING` gives you the removed rows
  ([`DELETE`](11-delete.md)); `TRUNCATE` returns nothing.
- **Permissions differ.** `TRUNCATE` needs its own `TRUNCATE` privilege, not `DELETE`.
- **`ONLY`** restricts it to the parent, excluding inheritance children and
  partitions — the same keyword as
  [inheritance](../phase-3-ddl/19-inheritance.md).
- **Not MVCC-friendly for concurrent readers**: a transaction that started before the
  `TRUNCATE` will block rather than see the old snapshot.

## Choosing

| Need | Use |
|---|---|
| Remove some rows | `DELETE … WHERE` |
| Need the removed rows back | `DELETE … RETURNING` |
| Row triggers must fire | `DELETE` |
| Empty a whole table, fast, space reclaimed | `TRUNCATE` |
| Reset a test database | `TRUNCATE a, b, c RESTART IDENTITY` |
| Empty a table under live traffic | `DELETE` in batches — `TRUNCATE` blocks everything |

## Trade-off

`TRUNCATE` buys speed and immediate space reclamation, and unlike most engines it
stays transactional. It costs an `ACCESS EXCLUSIVE` lock for the duration, no
`WHERE`, no `RETURNING`, and — the one that actually causes incidents — **no row
triggers**, so any side effects your schema implements through them silently do not
happen.

`DELETE` is slower and leaves work for `VACUUM`, but it is precise, concurrent, and
preserves every behaviour attached to removing a row. Reach for `TRUNCATE` when the
table is genuinely disposable — test fixtures, staging tables, caches — and for
`DELETE` when the rows mean something to the rest of the system.

## Gotchas

**Symptom:** A test asserting `id === 1` fails on the second run
**Cause:** Plain `TRUNCATE` does not reset sequences — measured, the next id was
10001.
**Fix:** `TRUNCATE … RESTART IDENTITY`; better, do not assert on generated ids.

**Symptom:** `0A000 cannot truncate a table referenced in a foreign key constraint`
**Cause:** Another table references this one.
**Fix:** `TRUNCATE parent, child;` naming both, or `CASCADE` if you accept that it
empties tables you did not name.

**Symptom:** More tables were emptied than expected
**Cause:** `TRUNCATE … CASCADE` follows the whole foreign-key graph.
**Fix:** List every table explicitly. Note this differs from `DROP … CASCADE`, which
does not delete child *data*.

**Symptom:** Audit rows or counters are missing after a bulk cleanup
**Cause:** `TRUNCATE` fires no row-level triggers — measured, the trigger log did not
grow.
**Fix:** `DELETE` if triggers carry required behaviour, or add an
`AFTER TRUNCATE … FOR EACH STATEMENT` trigger.

**Symptom:** The application stalls while a table is emptied
**Cause:** `TRUNCATE` holds `ACCESS EXCLUSIVE` until commit.
**Fix:** Batched `DELETE` under live traffic.

**Symptom:** A table stays large on disk after repeated `DELETE`s
**Cause:** Dead tuples awaiting `VACUUM`.
**Fix:** `TRUNCATE` when emptying entirely; otherwise let autovacuum work, or
`VACUUM FULL` deliberately.

**Symptom:** Deadlocks between parallel test files
**Cause:** Separate `TRUNCATE` statements acquiring locks in different orders.
**Fix:** One `TRUNCATE a, b, c` so the locks are taken together.

**Symptom:** `TRUNCATE` denied for a role that can `DELETE`
**Cause:** It requires the separate `TRUNCATE` privilege.
**Fix:** `GRANT TRUNCATE ON t TO role`.

## Interview questions

**★ How do `TRUNCATE` and `DELETE` differ beyond speed?**
`TRUNCATE` has no `WHERE` and no `RETURNING`, takes `ACCESS EXCLUSIVE` rather than
`ROW EXCLUSIVE`, needs its own privilege, does not reset sequences unless told to,
is blocked by inbound foreign keys, reclaims space immediately, and **fires no
row-level triggers**. Measured 4.4 ms against 12.7 ms on 10 000 rows.

**★ Is `TRUNCATE` transactional in PostgreSQL?**
Yes — measured: 100 rows, `TRUNCATE` inside a transaction, `ROLLBACK`, and all 100
rows returned. This differs from MySQL and Oracle, where `TRUNCATE` is DDL that
commits implicitly. It makes `TRUNCATE` safe inside a migration.

**★ Why did audit rows stop appearing after switching to `TRUNCATE`?**
Row-level triggers do not fire — measured, an `AFTER DELETE FOR EACH ROW` trigger
logged 2 rows for a `DELETE` and nothing for a `TRUNCATE`. Anything implemented as a
row trigger is silently skipped. Use `DELETE`, or an
`AFTER TRUNCATE FOR EACH STATEMENT` trigger.

**★ Does `TRUNCATE` reset the primary key sequence?**
Not by default — measured, the next id after truncating 10 000 rows was 10001.
`RESTART IDENTITY` resets it. This is why tests asserting on generated ids pass once
and then fail.

**★ What is the difference between `TRUNCATE … CASCADE` and `DROP … CASCADE`?**
`TRUNCATE … CASCADE` **empties the data** of every referencing table, transitively.
`DROP … CASCADE` removes dependent *objects* — views, constraints — but leaves child
tables and their rows in place. Same keyword, opposite treatment of data.

**Which would you use to empty a large table in production?**
Batched `DELETE`, despite being slower. `TRUNCATE` holds `ACCESS EXCLUSIVE` until
commit and blocks every reader and writer of the table; batches keep the lock
footprint small and are interruptible.

---

← [`MERGE`](13-merge.md) · Next → [Expressions and operators](15-expressions.md)
