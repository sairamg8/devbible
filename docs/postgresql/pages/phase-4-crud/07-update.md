---
title: "UPDATE"
sidebar_label: "07 · UPDATE"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex17-update.mjs`,
> `ex14-crud.mjs`, `ex16-returning.mjs`.

**`UPDATE … SET … WHERE` is three clauses and two ways to lose data: forget the `WHERE`
and you change every row, or read-modify-write in application code and concurrent
requests overwrite each other. Both were measured below.**

## The shape

```sql
UPDATE u_items
SET    price = $2, qty = qty + 1
WHERE  sku = $1
RETURNING id, sku, price, qty;
```

`SET` can reference the row's current values, so `qty = qty + 1` reads and writes in one
atomic step. That property is the whole of the concurrency section further down.

## No `WHERE` means every row

```console
$ node ex17-update.mjs
=== 1. UPDATE with no WHERE ===
UPDATE u_items SET qty = 0  → rowCount: 3 ← every row, no warning
```

There is no confirmation prompt and no safety net. In `psql`, protect yourself:

```sql
\set ON_ERROR_STOP on
BEGIN;
UPDATE u_items SET qty = 0 WHERE sku = 'a1';   -- check the rowCount
-- COMMIT;  or  ROLLBACK;
```

Run it inside a transaction, read the row count, and only then commit. In application
code the equivalent discipline is to make the `WHERE` clause impossible to omit — build
updates through a helper that requires a key.

## `rowCount` is the "did it exist" signal

```console
$ node ex14-crud.mjs
=== 3. RETURNING ===
UPDATE   → { id: '5', qty: 2 }
no match →  rowCount: 0 rows: []
```

An `UPDATE` that matches nothing is a success, not an error. `rowCount: 0` is how you
distinguish "not found" from "updated" — see [`RETURNING`](05-returning.md) for the 404
pattern that falls out of it.

## Updating from another table

`UPDATE … FROM` is PostgreSQL's join update: the `FROM` supplies rows, the `WHERE` joins
them, and `SET` reads the source's columns.

```console
=== 2. UPDATE ... FROM with a unique source ===
┌─────────┬──────┬─────────┐
│ (index) │ sku  │ price   │
├─────────┼──────┼─────────┤
│ 0       │ 'a1' │ '11.50' │
│ 1       │ 'a2' │ '21.50' │
└─────────┴──────┴─────────┘
rowCount: 2 ← a3 had no source row and was left alone
```

```sql
UPDATE u_items i SET price = p.new_price
FROM u_prices p WHERE p.sku = i.sku
RETURNING i.sku, i.price;
```

Rows with no match in the source are untouched — this is an inner join, not an outer
one. It is the efficient way to apply a batch of changes: one statement instead of one
`UPDATE` per row.

## The duplicate-source trap

If the source contains more than one row per target, PostgreSQL does not complain:

```console
=== 3. UPDATE ... FROM when the source has duplicates ===
3 candidate values for one row →  rowCount: 1 | result: [ { sku: 'a1', price: '100.00' } ]
  ↑ no error: one source row wins arbitrarily, the others are discarded
the same input through MERGE → 21000 MERGE command cannot affect row a second time
```

Three candidate prices, one row updated, **one value chosen arbitrarily** and the other
two silently dropped. Nothing in the result tells you this happened — `rowCount: 1` looks
exactly like a clean single-row update.

[`MERGE`](13-merge/README.md) rejects the same input outright with `21000`. That difference is
the strongest argument for `MERGE` when the source is data you did not generate: it
turns a silent wrong answer into an error.

If you must use `UPDATE … FROM`, deduplicate deliberately so the choice is yours:

```sql
UPDATE u_items i SET price = p.new_price
FROM (SELECT DISTINCT ON (sku) sku, new_price
      FROM u_prices ORDER BY sku, updated_at DESC) p
WHERE p.sku = i.sku;
```

[`DISTINCT ON`](12-distinct-on.md) makes "last write wins" explicit rather than
accidental.

## Setting several columns

```console
=== 4. setting several columns at once ===
SET (a,b) = (...)      → { sku: 'a3', name: 'Renamed', qty: 42 }
SET (a,b) = (SELECT …) → { sku: 'a1', name: 'WIDGET', qty: 10 }
```

```sql
UPDATE u_items SET (name, qty) = ('Renamed', 42) WHERE sku = 'a3';

UPDATE u_items i SET (name, qty) =
  (SELECT upper(name), qty * 2 FROM u_items WHERE id = i.id)
WHERE sku = 'a1';
```

The row-constructor form is handy when the values come from one subquery — it evaluates
that subquery once instead of once per column.

## Lost updates: the measurement that matters

Twenty concurrent requests, each incrementing the same counter. First, the shape most
application code accidentally takes — read the value, add one, write it back:

```console
=== 5. read-modify-write vs an in-place increment ===
20× SELECT-then-UPDATE → 2 ← expected 20
20× UPDATE SET qty = qty + 1 → 20 ← expected 20
```

**Eighteen of twenty increments vanished.** Every one of those requests succeeded. No
error was raised, no constraint was violated, and the final number is simply wrong.

The cause: each request read `qty` before any of the others wrote, so they all computed
the same new value and overwrote each other. The window is the gap between the `SELECT`
and the `UPDATE` — and it does not need to be a long one.

`SET qty = qty + 1` has no such window. The read and the write happen inside one
statement, and PostgreSQL takes a row lock for its duration, so concurrent updates queue
rather than collide. **Whenever the new value is a function of the old one, compute it in
SQL.**

When the new value genuinely depends on application logic — a state machine, a validation
rule, an external call — you cannot fold it into one statement, and you need one of:

- `SELECT … FOR UPDATE` to lock the row for the whole read-modify-write
  ([`SELECT … FOR UPDATE`](../phase-9-api-crud/14-for-update.md))
- an optimistic version column: `WHERE id = $1 AND version = $2`, and treat
  `rowCount: 0` as a conflict ([Optimistic concurrency](../phase-9-api-crud/13-optimistic.md))
- `SERIALIZABLE` isolation, and a retry loop for `40001`

## PATCH semantics

For a partial update, `COALESCE` keeps the columns that were not supplied:

```console
=== 6. PATCH semantics: only the fields that were sent ===
before      : { sku: 'a2', name: 'Gadget', qty: 3 }
patch {qty} : { sku: 'a2', name: 'Gadget', qty: 99 }
patch {name}: { sku: 'a2', name: 'Only the name', qty: 99 }
  ↑ COALESCE cannot express "set this column to NULL"
```

```sql
UPDATE u_items SET name = COALESCE($2, name), qty = COALESCE($3, qty)
WHERE sku = $1 RETURNING sku, name, qty;
```

One statement, any subset of fields, nothing clobbered. The limitation is in the output
above: since `null` means "leave it alone", this form can never *set* a column to null.
When that matters, build the `SET` list from the keys actually present in the request
body — [Partial updates](../phase-9-api-crud/08-update-partial.md), using the same
allowlist discipline as [Safe dynamic `WHERE`](../phase-9-api-crud/safe-dynamic-where/).

## What an `UPDATE` costs

PostgreSQL never modifies a row in place. An `UPDATE` writes a **new tuple version** and
marks the old one dead, which means:

- Every index on the table may need a new entry, even for columns you did not change —
  unless the update qualifies as HOT ([MVCC](../phase-11-mvcc/)).
- The dead version occupies space until `VACUUM` reclaims it.
- Updating a row a thousand times leaves a thousand dead versions and a bloated table.

This is why `UPDATE … SET x = x` is not free, and why wide tables updated frequently on
one small column are worth splitting.

## Trade-off

Expressing the change in SQL — `qty = qty + 1`, `UPDATE … FROM`, `COALESCE` for PATCH —
buys atomicity and one round trip, and measurably prevents lost updates. It costs
expressiveness: the logic is now in a string rather than in testable application code,
and anything needing branching, validation or an external call cannot be written that
way.

The fallback is explicit locking or version checks, which cost either concurrency (rows
queue behind a lock) or retries (`rowCount: 0` means someone else won). What is not on
the menu is unprotected read-modify-write, which costs correctness — measured, 18 of 20
updates lost.

## Gotchas

**Symptom:** Every row in the table changed
**Cause:** `UPDATE` with no `WHERE` — measured `rowCount: 3` on a 3-row table, silently.
**Fix:** `BEGIN`, check `rowCount`, then `COMMIT`. Require a key in whatever builds your
updates.

**Symptom:** A counter drifts below its true value under load
**Cause:** Read-modify-write in application code — measured, 20 concurrent increments
produced 2.
**Fix:** `SET qty = qty + 1`. If the new value needs application logic, use `FOR UPDATE`
or an optimistic version column.

**Symptom:** A batch price update applied the wrong value, with no error
**Cause:** Duplicate rows in the `UPDATE … FROM` source; one wins arbitrarily.
**Fix:** `DISTINCT ON` in a subquery to pick deliberately, or use `MERGE`, which raises
`21000` instead.

**Symptom:** `UPDATE` reports success but nothing changed
**Cause:** The `WHERE` matched no rows. `rowCount: 0`, not an error.
**Fix:** Check `rowCount` and return 404. Verify types — `WHERE id = '5'` against a
`bigint` behaves differently from what you may expect.

**Symptom:** A PATCH endpoint cannot clear a field
**Cause:** `COALESCE($2, name)` treats null as "unchanged".
**Fix:** Build the `SET` list from the keys present in the request, over an allowlist.

**Symptom:** A frequently updated table grows without bound
**Cause:** Each `UPDATE` writes a new tuple version; dead ones await `VACUUM`.
**Fix:** Let autovacuum work; reduce update frequency; split hot columns into their own
table.

**Symptom:** `40001 could not serialize access due to concurrent update`
**Cause:** `REPEATABLE READ` or `SERIALIZABLE` detected a conflict.
**Fix:** Retry the transaction. This is the isolation level working, not a failure.

## Interview questions

**★ Why is `UPDATE t SET n = n + 1` different from reading `n` and writing `n + 1`?**
The SQL form reads and writes inside one statement under a row lock, so concurrent
updates serialise. The application form has a window between the `SELECT` and the
`UPDATE` in which every request sees the same old value. Measured: 20 concurrent
read-modify-write cycles produced 2 instead of 20, with no errors raised.

**★ What happens if the source of an `UPDATE … FROM` has duplicate keys?**
One source row wins arbitrarily and the rest are discarded, silently — measured, three
candidate prices for one row gave `rowCount: 1` and no warning. `MERGE` rejects the same
input with `21000 MERGE command cannot affect row a second time`. Deduplicate with
`DISTINCT ON` if you stay with `UPDATE … FROM`.

**★ How do you handle a lost update when the new value needs application logic?**
`SELECT … FOR UPDATE` to hold the row across the read-modify-write, or an optimistic
version column where `WHERE id = $1 AND version = $2` and `rowCount: 0` signals a
conflict to retry. `SERIALIZABLE` with a retry loop on `40001` is the third option.

**★ How do you implement PATCH so unsent fields are not overwritten?**
`SET col = COALESCE($n, col)` for each column — one statement, any subset. The catch is
that it cannot set a column to null, since null already means "unchanged". For that,
build the `SET` list from the keys present in the request body, validated against an
allowlist.

**Why does an `UPDATE` make the table bigger?**
MVCC: PostgreSQL writes a new tuple version and marks the old dead rather than modifying
in place. The dead versions stay until `VACUUM` reclaims them, and non-HOT updates also
add index entries.

**An `UPDATE` returned `rowCount: 0`. Is that an error?**
No — it means the `WHERE` matched nothing. It is the normal way to detect "not found",
and with an optimistic version column it is also how you detect a concurrent write.

---

← [`ON CONFLICT`](06-on-conflict.md) · Next → [Parameterized queries](08-parameters.md)
