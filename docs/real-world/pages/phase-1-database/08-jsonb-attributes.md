---
title: "JSONB for product attributes"
sidebar_label: "08 · JSONB attributes"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — JSON types,
> containment operators, GIN operator classes. Concept home:
> [PostgreSQL — beyond tables](../../../postgresql/pages/phase-12-beyond-tables/README.md).

## The problem

Keyboards have switch types and layouts; desks have widths and finishes; the
headphones added next quarter will have attributes nobody has named yet.
Modelling every attribute as a column means a migration per product category;
an EAV table (`attribute_name`, `attribute_value` rows) means five joins to
render one card. `products.attributes jsonb` is the middle path — this
chapter draws the line that keeps it from becoming a swamp.

## The line: what earns a column, what lives in jsonb

| Signal | Column | jsonb |
|---|---|---|
| The app **sorts or ranges** on it | `price_cents` | — |
| A **constraint** must hold it | `stock >= 0` | — |
| **Every** product has it | `name`, `slug` | — |
| Only **some category** has it | — | `switch_type`, `desk_width_cm` |
| It exists to be **displayed** | — | almost everything else |
| Users **filter** by it | either — read on | |

The first three rows are hard rules: sorting, constraining and universality
are what columns are *for* — jsonb has no cheap `check (stock >= 0)` and no
statistics for the planner to range-scan with. The display row is jsonb's
home ground: attributes that are rendered, never computed on, cost nothing
there. Filtering is the genuinely contested row.

## Filtering on jsonb, honestly

The catalog's "switch type: linear" filter works today with containment:

```sql
select id, name, price_cents
  from products
 where category_id = $1
   and attributes @> '{"switch_type": "linear"}'
   and deleted_at is null;
```

`@>` ("contains") is jsonb's indexable operator — chapter 10 adds
`create index … using gin (attributes jsonb_path_ops)`, and this predicate
uses it. What the GIN index does **not** help: ranges
(`(attributes->>'desk_width_cm')::int between 120 and 160` — a full-row
recheck), and negations. The rule this app runs on:

> **Equality filters on jsonb are fine and indexed. The day an attribute
> needs a *range* filter or an *aggregation*, it gets promoted to a column.**

Promotion is a mechanical migration, and jsonb makes it cheap to do late:

```sql
-- 016_promote_desk_width.sql — the attribute earned a range filter
alter table products add column desk_width_cm integer;
update products
   set desk_width_cm = (attributes->>'desk_width_cm')::integer
 where attributes ? 'desk_width_cm';
alter table products
  drop constraint if exists products_desk_width_check,
   add constraint products_desk_width_check
       check (desk_width_cm is null or desk_width_cm > 0);
```

The jsonb key stays for display; the column owns filtering. Late promotion
with evidence beats early columns by guess — the whole argument for the
hybrid.

## Keeping the swamp out

Three disciplines, each one sentence in code review:

1. **The API validates attributes per category.** zod schemas keyed by
   category (Phase 3) mean `switch_type` is one of four strings, not free
   text — the database stores what the boundary already checked. jsonb skips
   *database* validation, not validation.
2. **Keys are `snake_case`, values are scalars or string arrays.** No nested
   objects two levels deep — the moment structure nests, it is a table
   wearing a costume.
3. **`attributes` defaults to `'{}'`, never null.** One absent-value
   convention (`attributes ? 'key'` = has it), not two (`null` vs missing).

## Using it in the app

The seed writes `{colour: …}` attributes; the product page (Phase 4) renders
the object as a spec table with no schema knowledge; the admin form (Phase 3)
validates per category before writing; the catalog filter above is wired into
[chapter 04's dynamic where-builder](04-the-catalog-query.md) as one more
`add()` clause.

## Gotchas

- **Symptom:** `operator does not exist: jsonb ->> integer` or silent empty
  results after a filter tweak. **Cause:** `->` returns jsonb, `->>` returns
  text — and text comparison makes `"120" > "60"` false. **Fix:** every
  non-equality use casts explicitly: `(attributes->>'desk_width_cm')::int` —
  and per the promotion rule, that cast appearing in a `where` is the signal
  to promote.
- **Symptom:** the attributes filter ignores the GIN index in `EXPLAIN`.
  **Cause:** the query used `->>` equality (`attributes->>'switch_type' =
  'linear'`) instead of containment — `jsonb_path_ops` indexes `@>`, not
  extracted-text equality. **Fix:** the containment spelling above; one shape
  for all equality filters.
- **Symptom:** two products spell the same colour `"Black"` and `"black"`;
  filters split them. **Cause:** attributes bypassed per-category validation
  (an import script wrote raw). **Fix:** discipline 1 applies to *every*
  writer — imports go through the same zod schema; a cleanup
  `update … set attributes = jsonb_set(…)` repairs the stock.

## Interview questions

1. **★ When does an attribute move from jsonb to a column?** When it crosses
   from display/equality into sorting, ranging, aggregation or constraints —
   the operations that need planner statistics and typed comparison. The
   hybrid's strength is that promotion is a cheap, evidence-driven migration
   instead of an upfront guess.
2. **★ Why `jsonb` and not `json`?** `json` stores the text — whitespace,
   key order, duplicate keys and all — and re-parses on every operation.
   `jsonb` stores a decomposed binary form: indexable, containment-queryable,
   duplicate-keys-resolved. `json`'s only win is byte-exact round-tripping,
   which nothing here needs.
3. **Why not EAV (an `attributes(product_id, name, value)` table)?** EAV
   makes every attribute read a join and every product card N rows, types
   collapse to text, and constraints become unwritable. It solves the same
   flexibility problem jsonb solves, at relational prices without relational
   benefits. Its remaining niche — attribute *metadata* (which attributes
   exist per category, for admin forms) — is a real table in the admin
   chapters.
4. **What does `jsonb_path_ops` trade against the default GIN opclass?**
   Smaller, faster index supporting only `@>`/`@?` — not key-exists (`?`).
   This app filters by containment only, so the narrower opclass wins;
   the moment a query needs `attributes ? 'key'` indexed, that index (or the
   default opclass) is the migration.

---

← Prev: [Money and time](07-money-and-time.md) ·
Next → [Dashboard queries](09-dashboard-queries.md)
