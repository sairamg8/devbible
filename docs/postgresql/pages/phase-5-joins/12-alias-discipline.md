---
title: "Alias discipline"
sidebar_label: "12 · Aliases"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**Aliasing a table *replaces* its name for the rest of the statement, and an unqualified
column that exists in two joined tables is an error rather than a guess. Output aliases
follow a different rule again: usable in `ORDER BY` and `GROUP BY`, not in `WHERE` — which
is a consequence of the order clauses are evaluated, not an arbitrary restriction.**

## Ambiguity is an error, not a guess

```sql
SELECT id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id;
SELECT c.id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id LIMIT 1;
```

```console
$ node ex35-joins.mjs
=== 12. aliases and ambiguous columns ===
unqualified column present in both tables      ->  42702 column reference "id" is ambiguous
qualified, unambiguous                         ok  rows=1 [{"id":1}]
```

**`42702`.** PostgreSQL will not pick a side, which is the good outcome — the failure mode
worth fearing is the *unambiguous* one. A column that exists in only one of the joined
tables resolves silently today, and starts resolving to the other table the day someone
adds a same-named column to it. The query does not error; it returns different data.

The defence costs nothing: **alias every table and qualify every column**, including in
single-table queries that might later gain a join.

## The alias replaces the name

```sql
SELECT j_customers.id FROM j_customers c LIMIT 1;
```

```console
referring to the old table name after aliasing ->  42P01 invalid reference to FROM-clause entry for table "j_customers"
```

Once aliased, the original name is gone for the rest of the statement — this is not a
convenience alternative. The error text is worth recognising because it is the same
`42P01` you get for a genuinely missing table and for a `LATERAL` reference without the
keyword ([page 10](10-lateral.md)); the message body distinguishes them.

Aliases also make a self join possible at all, since the same table needs two distinct
names ([page 09](09-self-join.md)).

## Where an output alias may be used

```sql
SELECT total * 2 AS doubled FROM j_orders WHERE doubled > 100;        -- ✗
SELECT total * 2 AS doubled FROM j_orders ORDER BY doubled DESC LIMIT 1;  -- ✓
SELECT status AS s, count(*) FROM j_orders GROUP BY s;                -- ✓
```

```console
alias used in WHERE (not allowed)              ->  42703 column "doubled" does not exist
alias used in ORDER BY (allowed)               ok  rows=1 [{"doubled":400}]
alias used in GROUP BY (allowed)               ok  rows=3 [{"s":"open","count":"2"},{"s":"cancelled","count":"1"}]
```

The pattern follows the logical evaluation order — `FROM` → `WHERE` → `GROUP BY` →
`HAVING` → `SELECT` → `ORDER BY`:

| Clause | Output alias usable? | Why |
|---|---|---|
| `WHERE` | **no** — `42703` | Runs before `SELECT`, so the alias does not exist yet |
| `GROUP BY` | yes | PostgreSQL extension; grouping is resolved against the select list too |
| `HAVING` | no | Same stage as `WHERE`, relative to `SELECT` |
| `ORDER BY` | yes | Runs after `SELECT`, so the output columns exist |

`GROUP BY s` working is a PostgreSQL convenience beyond the standard; `GROUP BY 1` by
position works as well. Neither is portable, so a codebase that also targets other engines
should repeat the expression.

To filter on a computed value, repeat the expression, or name it once in a subquery or
lateral binding:

```sql
SELECT * FROM (SELECT total * 2 AS doubled FROM j_orders) s WHERE s.doubled > 100;
```

Note `count(*)` arriving as **`"2"`, a string** — `bigint` exceeds JS's safe integer range,
so `pg` returns it as text unless you cast (`count(*)::int`) or register a type parser
([type parsing](../phase-7-pg-driver/08-type-parsing.md)).

## Name resolution order

When PostgreSQL resolves a bare identifier in a `SELECT` list, it looks for a column of any
table in the `FROM` clause first. If exactly one matches, it wins silently; if several
match, `42702`; if none match, it then considers output aliases (in `GROUP BY` and
`ORDER BY` only) and finally raises `42703`.

Two consequences worth holding on to:

- **A column always beats an output alias.** `SELECT total * 2 AS total FROM j_orders
  ORDER BY total` sorts by the *stored* `total`, not the doubled one, because the table
  column is found first. Nothing errors. Give computed columns names that do not collide
  with real ones.
- **`ORDER BY 1` beats both**, since a bare integer is a positional reference. That makes
  it unambiguous but fragile — inserting a column into the select list silently changes the
  sort.

## Conventions worth enforcing

- **Short, mnemonic aliases**: `c` for customers, `o` for orders, `oi` for order items.
  Single letters stop scaling past about four tables — `pt` beats `t2`.
- **Never `t1`, `t2`, `a`, `b`** in code that ships. They carry no meaning and make a
  mis-typed `ON` invisible on review.
- **Alias every derived table.** A subquery in `FROM` without one is `42601`; PostgreSQL
  requires the name even when nothing references it.
- **Qualify columns in `ON` on both sides** — `ON o.customer_id = c.id` reads as a
  direction; `ON customer_id = id` is a bug waiting for a schema change.
- **Alias output columns that collide**, or `SELECT *` will collapse them in the driver
  ([page 08](08-on-using-natural.md)).
- **Do not alias a table to another table's name.** `FROM j_orders c` is legal and will
  cost someone an afternoon.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id       AS customer_id,
          c.name     AS customer_name,
          o.id       AS order_id,
          o.total    AS order_total,
          count(oi.id)::int AS item_count
   FROM j_customers c
   JOIN j_orders      o  ON o.customer_id = c.id
   LEFT JOIN j_order_items oi ON oi.order_id = o.id
   WHERE c.country = $1
   GROUP BY c.id, c.name, o.id, o.total
   ORDER BY o.id`,
  [country],
);
```

Every column aliased to the key the JS side actually wants. That is not cosmetic: two
tables here have `id` and two have `total`-ish columns, and without the aliases the row
object would silently keep only the last of each.

## Trade-off

Full qualification is more to type and makes long statements longer. It buys immunity to
the failure mode that has no symptom — a column silently binding to a different table after
an unrelated migration — and it is what makes a join reviewable at a glance. There is no
performance dimension to this; the parser resolves names before planning. The only real
cost is discipline, and the only real alternative is `SELECT *`, which trades the same
typing for a result shape that changes under you.

## Gotchas

**Symptom:** `ERROR: 42702 column reference "id" is ambiguous`
**Cause:** An unqualified column present in more than one joined table
**Fix:** Qualify it. Treat this error as a reminder to qualify *every* column in the
statement, not just the one that failed

**Symptom:** A query silently returns different data after a migration
**Cause:** An unqualified column that used to resolve to one table now matches a new
same-named column in another
**Fix:** Qualify everything — this is the failure `42702` protects you from only by luck

**Symptom:** `ERROR: 42P01 invalid reference to FROM-clause entry for table "x"`
**Cause:** Using the table's real name after aliasing it
**Fix:** Use the alias; the original name is out of scope

**Symptom:** `ERROR: 42703 column "doubled" does not exist` in `WHERE`
**Cause:** `WHERE` is evaluated before `SELECT`, so output aliases do not exist there
**Fix:** Repeat the expression, or wrap in a subquery and filter outside

**Symptom:** `ERROR: 42601 subquery in FROM must have an alias`
**Cause:** A derived table without a name
**Fix:** Add one — `) AS s`

**Symptom:** A count arrives in JS as `"2"` instead of `2`
**Cause:** `count()` returns `bigint`, delivered as a string
**Fix:** `count(*)::int`, or a type parser

## Interview questions

**★ What happens if you reference an unqualified column present in two joined tables?**
`42702 column reference "id" is ambiguous` — PostgreSQL refuses rather than choosing. The
dangerous case is the opposite: a column present in only one table resolves silently and
can be re-bound by a later migration.

**★ Why can you use an output alias in `ORDER BY` but not in `WHERE`?**
Logical evaluation order. `WHERE` is processed before the select list exists, so the alias
is unknown (`42703`); `ORDER BY` runs after it, so the alias is available. `GROUP BY`
accepts it as a PostgreSQL extension.

**★ Can you still use the table's original name after aliasing it?**
No — `42P01`. The alias replaces the name for the whole statement, which is precisely what
makes self joins expressible.

**How would you filter on a computed column without repeating the expression?**
Wrap it in a subquery or CTE and filter outside, or bind it with `LATERAL (SELECT … ) x`.
Repeating the expression is also fine — the planner evaluates it once either way.

**Why does `count(*)` come back as a string from `pg`?**
It is `bigint`, whose range exceeds JS's safe integers, so the driver preserves precision
by returning text. Cast to `int` when the value is known to be small.

---

← [UNION INTERSECT EXCEPT](11-set-ops.md) · Next → [Joining on expressions](13-join-expressions.md)
