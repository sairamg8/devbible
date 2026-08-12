---
title: "Generated columns"
sidebar_label: "15 · Generated columns"
sidebar_position: 15
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**A generated column is a column the database computes from other columns in the
same row. It cannot drift from its inputs, because nothing is allowed to write it.**

## The shape

```sql
CREATE TABLE gen_t (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  full_name  text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  price      numeric(12,2) NOT NULL,
  qty        int NOT NULL,
  total      numeric(14,2) GENERATED ALWAYS AS (price * qty) STORED
);
```

```console
$ node ex12-ddl-rest.mjs
=== 6. generated columns ===
┌─────────┬────────────────┬─────────┐
│ (index) │ full_name      │ total   │
├─────────┼────────────────┼─────────┤
│ 0       │ 'Ada Lovelace' │ '29.97' │
└─────────┴────────────────┴─────────┘
writing to a generated column → 428C9 cannot insert a non-DEFAULT value into column "full_name"
volatile expression → 42P17 generation expression is not immutable
catalog: {
  is_generated: 'ALWAYS',
  generation_expression: '(price * (qty)::numeric)'
}
```

Three properties, all measured:

- **It is computed on write and stored.** `total` is `29.97` without anyone
  supplying it.
- **You cannot write it** — `428C9`. Not on insert, not on update. That is what
  makes drift impossible, and it means every `INSERT` in your code must list columns
  explicitly rather than relying on positional values.
- **The expression must be `IMMUTABLE`** — `42P17` for anything volatile. No
  `random()`, no `now()`, and no reference to another table.

## `STORED` only

PostgreSQL 18 supports `STORED` (computed on write, occupies disk) but not `VIRTUAL`
(computed on read). If you want a computed value without the storage, use a **view**
or an **expression index**:

```sql
-- computed on read, no storage
CREATE VIEW gen_v AS SELECT *, price * qty AS total FROM line_items;

-- computed for lookup only, no column
CREATE INDEX gen_total_idx ON line_items ((price * qty));
```

## What the expression may reference

Only columns of **the same row**, through `IMMUTABLE` functions. That rules out:

- other tables (use a trigger, or accept a join)
- `now()`, `random()`, `nextval()` — `42P17`
- most text functions that depend on collation or locale settings, which are
  `STABLE` rather than `IMMUTABLE`

The last one catches people: `lower(x)` is `IMMUTABLE` and works, but a function
whose result depends on `search_path` or a runtime parameter is not, and PostgreSQL
will refuse it.

Marking your own function `IMMUTABLE` when it is not is a way to corrupt data
silently — the stored value is computed once and never revisited, so if the function
would now return something different, the column is simply wrong. Only mark
`IMMUTABLE` what genuinely is.

## Changing the expression

There is no `ALTER … SET EXPRESSION` for a generated column in a form you can rely
on across versions. The portable route is drop and re-add:

```sql
ALTER TABLE gen_t DROP COLUMN total;
ALTER TABLE gen_t ADD COLUMN total numeric(14,2) GENERATED ALWAYS AS (price * qty * 1.2) STORED;
```

`ADD COLUMN` with a generated expression **rewrites the table** — it must compute a
value for every row, which is the same rule as a volatile default in
[`ALTER TABLE`](05-alter-table.md). On a large table, treat it as a rewrite and plan
the lock accordingly.

## Generated column, trigger, or application code?

| | Generated column | `BEFORE` trigger | Application |
|---|---|---|---|
| Can drift from inputs | **no** | yes (bugs, disabled trigger) | yes |
| Same-row inputs only | yes | no | no |
| Can call volatile functions | no | yes | yes |
| Visible in the schema | **yes** | only by reading the trigger | no |
| Cost | on write | on write | on write |

**Prefer a generated column when it fits**, because the constraint is declarative and
enforced. Reach for a trigger when the value depends on another table or on
something volatile — for instance `updated_at`, which needs `now()` and therefore
cannot be generated ([`created_at`/`updated_at`](../phase-9-api-crud/17-timestamps-trigger.md)).

Compute in application code only for values that are genuinely presentation
concerns, and remember that anything computed there is invisible to reports, admin
tools and every other client of the database.

## Where they earn their place

- **A denormalised search column**: `search_tsv tsvector GENERATED ALWAYS AS
  (to_tsvector('english', title || ' ' || body)) STORED`, then index it. The
  index-maintenance cost is paid on write and the column can never be stale.
- **A case-insensitive key**: `email_lower text GENERATED ALWAYS AS (lower(email))
  STORED` with a unique index — an alternative to the expression index in
  [Unique constraints and NULLs](08-unique-nulls.md), and easier to query because
  the column is real.
- **Money totals**, as above, where a mismatch between `price * qty` and a stored
  `total` would be a reconciliation bug.

## Trade-off

Generated columns buy a guarantee: the value cannot disagree with its inputs,
because nothing can write it. They cost disk (it is `STORED`), write time on every
insert and update touching the inputs, and flexibility — changing the expression
means dropping the column and rewriting the table.

They are also a schema commitment to a piece of business logic. `total = price *
qty` is safe; anything involving tax rates or discounts will change, and changing it
is a rewrite. Put stable arithmetic in the schema and volatile policy in code.

## Gotchas

**Symptom:** `428C9 cannot insert a non-DEFAULT value into column`
**Cause:** An `INSERT` supplied a value for a generated column — often
`INSERT INTO t VALUES (...)` with no column list.
**Fix:** List columns explicitly and omit the generated ones.

**Symptom:** `42P17 generation expression is not immutable`
**Cause:** The expression uses `now()`, `random()`, or a `STABLE` function.
**Fix:** Use a `BEFORE` trigger for anything volatile.

**Symptom:** A generated value is wrong for old rows
**Cause:** A function marked `IMMUTABLE` that is not — stored values are computed
once and never revisited.
**Fix:** Only mark genuinely immutable functions; recompute by rewriting the column.

**Symptom:** Adding a generated column locked a large table
**Cause:** Every row must be computed, so the table is rewritten.
**Fix:** Plan it as a rewrite: `lock_timeout`, off-peak, or a nullable column plus a
batched backfill and a trigger instead.

**Symptom:** `VIRTUAL` generated columns are rejected
**Cause:** PostgreSQL 18 supports `STORED` only.
**Fix:** A view, or an expression index.

**Symptom:** An `ORM` or code generator writes the generated column
**Cause:** It builds `INSERT`s from the full column list.
**Fix:** Mark the field read-only in the model, or exclude it from inserts.

## Interview questions

**★ What is a generated column and what guarantee does it give?**
A column the database computes from other columns of the same row and stores. Its
guarantee is that it cannot drift: writing it raises `428C9`, so there is no path by
which it can disagree with its inputs.

**★ What can the expression not do?**
Reference other tables, or use anything non-`IMMUTABLE` — `now()`, `random()`,
`nextval()`, or a `STABLE` function all raise `42P17`. Same-row, immutable inputs
only.

**★ Generated column or trigger?**
Generated column when the value is a pure function of the same row — it is
declarative, visible in the schema, and cannot be bypassed. Trigger when the value
needs another table or something volatile, such as `updated_at`, which requires
`now()` and therefore cannot be generated.

**★ Does PostgreSQL support `VIRTUAL` generated columns?**
Not in 18 — `STORED` only, so the value occupies disk. For a computed value without
storage, use a view or an expression index.

**★ How do you change a generated column's expression?**
Drop the column and re-add it with the new expression. `ADD COLUMN` with a generated
expression rewrites the table, because a value must be computed for every row — so
on a large table plan it like any other rewrite.

**Why is marking a function `IMMUTABLE` when it is not dangerous here?**
The value is computed once at write time and stored forever. If the function would
now return something different, nothing recomputes it, so the column is silently
wrong — and no constraint or check will notice.

---

← [Sequences as real objects](14-sequences.md) · Next → [`TEMPORARY` and `UNLOGGED` tables](16-temp-unlogged.md)
