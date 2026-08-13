---
title: "ON vs USING vs NATURAL"
sidebar_label: "08 · ON vs USING"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**`ON` states the condition explicitly. `USING` shortens the equality case and collapses
the join column to one. `NATURAL` infers the condition from every same-named column pair —
including the `created_at` you forgot about, which is why it silently returned one row here
instead of two.**

## The three forms

```sql
CREATE TABLE j_u1 (id int, name  text, created_at date);
CREATE TABLE j_u2 (id int, label text, created_at date);
INSERT INTO j_u1 VALUES (1,'one','2026-01-01'),(2,'two','2026-01-02');
INSERT INTO j_u2 VALUES (1,'ONE','2026-06-01'),(2,'TWO','2026-01-02');
```

Note the shape: the two tables share **two** column names, `id` and `created_at`, and
their `created_at` values agree only for row 2.

```sql
SELECT c.id AS c_id, o.id AS o_id
FROM j_customers c JOIN j_orders o ON o.customer_id = c.id
ORDER BY o.id LIMIT 2;
```

```console
$ node ex35-joins.mjs
=== 8. ON vs USING vs NATURAL ===
ON      : [{"c_id":1,"o_id":10},{"c_id":1,"o_id":11}]
```

`ON` takes any boolean expression: equality, inequality, function calls, multiple `AND`ed
conditions, a range containment test ([page 13](13-join-expressions.md)). It is also the
only form that works when the columns are named differently — which, for a foreign key
called `customer_id` pointing at a primary key called `id`, is the normal case.

## USING collapses the join column

```sql
SELECT * FROM j_u1 JOIN j_u2 USING (id) ORDER BY id;
```

```console
USING (id) collapses the join column: [{"id":1,"name":"one","created_at":"2026-05-31T18:30:00.000Z","label":"ONE"},
                                       {"id":2,"name":"two","created_at":"2026-01-01T18:30:00.000Z","label":"TWO"}]
```

Two rows — `USING (id)` joined on `id` alone and ignored `created_at`. It requires the
column to be named identically on both sides, and in exchange:

- The condition is `j_u1.id = j_u2.id`, written once.
- `SELECT *` emits **one** `id` column instead of two.
- That merged column is referenced unqualified as `id`; `j_u1.id` still works, but the
  output column belongs to neither table.
- Multiple columns are allowed: `USING (tenant_id, id)`.

`USING` is a genuine improvement over `ON a.id = b.id` when the names match — shorter, and
it removes the duplicate column that otherwise confuses `SELECT *`.

**`created_at` is still duplicated**, and that is visible in the output above: row 1 shows
`2026-05-31T18:30:00.000Z`, which is `j_u2`'s `2026-06-01` at local midnight, not `j_u1`'s
`2026-01-01`. The server returned both columns; `pg` builds the row object keyed by column
name, so the **last one wins and the first is lost**. Same trap as `SELECT *` across any
join — alias the columns you want, or use `rowMode: 'array'`
([Phase 7](../phase-7-pg-driver/)). The `18:30` offset is the `date`-to-local-midnight
conversion from [page 07](07-cross-join.md).

## NATURAL infers — and gets it wrong

```sql
SELECT * FROM j_u1 NATURAL JOIN j_u2;
```

```console
NATURAL JOIN silently also joins on created_at: [{"id":2,"created_at":"2026-01-01T18:30:00.000Z","name":"two","label":"TWO"}]
  ^ one row instead of two - NATURAL matched every same-named column
```

**One row, where `USING (id)` gave two.** `NATURAL` built the condition
`j_u1.id = j_u2.id AND j_u1.created_at = j_u2.created_at`, and only row 2 satisfies both.

Nothing in the query text mentions `created_at`. The join condition is a function of the
*schema*, so it changes whenever the schema does:

- Add a `created_at`, `updated_at`, `status`, or `tenant_id` to one table that the other
  already has, and every `NATURAL JOIN` involving it silently starts filtering harder —
  usually to zero rows.
- Rename a column so the names no longer coincide and the condition silently *weakens*,
  eventually to no shared columns at all, at which point PostgreSQL treats it as a
  **cross join**.

Both failures are silent, both are triggered by a migration far from the query, and
neither shows up in a test that fixtures only matching rows. **Do not write `NATURAL
JOIN`.** Recognise it in inherited code and replace it with the explicit `USING` or `ON`
it was meant to be.

## SELECT * keeps both columns — the driver does not

```sql
SELECT * FROM j_u1 a JOIN j_u2 b ON a.id = b.id ORDER BY a.id LIMIT 1;
```

```console
SELECT * with ON keeps BOTH id columns: [{"id":1,"name":"one","created_at":"2026-05-31T18:30:00.000Z","label":"ONE"}]
```

The server sent six columns: `id, name, created_at, id, label, created_at`. The JS object
has **four keys**. Every duplicated name collapsed, keeping the rightmost value — `id`
happened to be equal on both sides so nothing was lost there, but `created_at` silently
became `j_u2`'s.

This is why `SELECT *` across a join is a bug waiting for a schema change, whichever join
syntax you use. Name your columns:

```sql
SELECT a.id, a.name, a.created_at AS u1_created_at,
       b.label, b.created_at AS u2_created_at
FROM j_u1 a JOIN j_u2 b ON a.id = b.id;
```

## `USING` with outer joins: the merged column is coalesced

The one case where `USING` is not merely shorter but genuinely better. In an outer join the
merged column holds `coalesce(left.col, right.col)`:

```sql
SELECT id, a.val, b.val
FROM snapshot_a a FULL OUTER JOIN snapshot_b b USING (id);
```

`id` is non-NULL for any row present on either side. With `ON a.id = b.id` you would get
two `id` columns, each NULL on one side, and would have to write the `coalesce` yourself —
and `SELECT *` would then hand the JS side a single collapsed `id` taken from whichever
column came last, which is NULL for every left-only row.

For a reconciliation or diff query ([RIGHT and FULL OUTER](06-outer-joins.md)) that
difference is the difference between a usable key and a broken one.

## Column resolution, precisely

Worth knowing exactly what each form puts in `SELECT *`, because that is where the
surprises land:

| Form | Join columns in `*` | Referenced as |
|---|---|---|
| `ON a.id = b.id` | **both** `a.id` and `b.id` | `a.id` / `b.id`; bare `id` is `42702` |
| `USING (id)` | **one** merged column | `id`, or still `a.id` / `b.id` |
| `NATURAL` | one merged column **per shared name** | same as `USING` |

With `USING`, the merged output column belongs to neither table — but the underlying
qualified names remain available, which is how you recover the individual values when they
differ (as `a.created_at` and `b.created_at` above).

## Choosing

| Situation | Form |
|---|---|
| FK column name differs from PK (`customer_id` = `id`) | `ON` |
| Anything other than plain equality | `ON` |
| Composite key with identical names on both sides | `USING (a, b)` |
| Identical column name, and you want one output column | `USING` |
| Ever | not `NATURAL` |

## Trade-off

`USING` buys brevity and a single merged join column, at the price of coupling the query
to matching column names — a rename on either side breaks it loudly, which is acceptable.
`NATURAL` extends that coupling to *every* shared column and makes the breakage silent,
which is not. `ON` is the most verbose and the only one whose meaning is fully contained
in the query text; for a join that lives in application code and outlives several
migrations, that is worth the extra characters.

## Gotchas

**Symptom:** A `NATURAL JOIN` starts returning zero rows after an unrelated migration
**Cause:** A newly shared column name was added to the inferred condition
**Fix:** Replace with `USING (…)` or `ON`; measured — one shared `created_at` cut two rows
to one

**Symptom:** A `NATURAL JOIN` returns the product of both tables
**Cause:** No column names in common, so the condition is empty and it degenerates to a
cross join
**Fix:** Explicit `ON`

**Symptom:** A column has the wrong table's value in the JS row object
**Cause:** `SELECT *` with a duplicated column name; `pg` keys rows by name and the last
wins
**Fix:** Alias explicitly, or `rowMode: 'array'`

**Symptom:** `ERROR: 42702 column reference "id" is ambiguous` after switching `USING` to
`ON`
**Cause:** `USING` merged the column; `ON` leaves two of them
**Fix:** Qualify it — `a.id` ([alias discipline](12-alias-discipline.md))

## Interview questions

**★ What is the difference between `ON`, `USING`, and `NATURAL JOIN`?**
`ON` is an explicit boolean condition and handles any shape. `USING (col)` is shorthand for
equality on identically-named columns and merges them into one output column. `NATURAL`
infers equality across *all* same-named columns and writes nothing down.

**★ Why is `NATURAL JOIN` considered unsafe?**
Its condition comes from the schema, not the query, so a migration elsewhere changes what
it means with no edit and no error. Measured: a shared `created_at` silently turned a
two-row result into one. With no shared names at all it becomes a cross join.

**★ When is `USING` better than `ON`?**
When the join columns have the same name and you want the merged single output column —
composite tenant keys are the common case. It fails loudly on a rename, which is the
behaviour you want.

**What does `SELECT *` do with duplicate column names across a join?**
The server returns every column, duplicates included. `pg` maps rows to objects by column
name, so duplicates collapse to the rightmost value — four keys from six columns in the
measurement. Alias the columns or use `rowMode: 'array'`.

**Can you use `USING` with an outer join?**
Yes, and the merged column then holds `coalesce(left.col, right.col)` — worth knowing for
`FULL OUTER JOIN … USING`, where it gives the non-NULL side automatically.

---

← [CROSS JOIN](07-cross-join.md) · Next → [Self joins](09-self-join.md)
