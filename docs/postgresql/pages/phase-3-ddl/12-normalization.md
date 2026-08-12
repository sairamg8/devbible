---
title: "Normalization to 3NF, and when to denormalize on purpose"
sidebar_label: "12 · Normalization"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Constraint behaviour cited here is measured in
> `sandbox/pg-api/ex13-constraints-rel.mjs` and `ex12-ddl-rest.mjs`.

**Normalization is one idea repeated: store every fact exactly once. The normal
forms are a checklist for finding places you have stored it twice — and duplication
is what lets a database hold two contradictory answers to the same question.**

## The three forms, on one example

Start with the shape that arrives from a spreadsheet:

```sql
CREATE TABLE orders_bad (
  id            bigint PRIMARY KEY,
  customer_name text,
  customer_email text,
  customer_city text,
  product_names text,          -- 'Widget, Gadget, Doohickey'
  total         numeric(12,2)
);
```

**1NF — one value per column.** `product_names` holds a comma-separated list, so
you cannot join it, index it, or count products without parsing strings. Fix by
giving each value its own row:

```sql
CREATE TABLE order_items (
  order_id   bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id),
  quantity   int NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_id, product_id)
);
```

**2NF — no partial dependency on part of a composite key.** If `order_items` also
stored `product_name`, that depends only on `product_id`, not on the whole key
`(order_id, product_id)`. Rename the product in one row and the others disagree.
Move it to `products`.

**3NF — no dependency between non-key columns.** `customer_city` depends on the
customer, not on the order. Store `customer_id` and let `customers` own the city;
otherwise a customer who moves has a different city on every historical order,
and no row is authoritative.

The result:

```sql
CREATE TABLE customers (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        email text NOT NULL UNIQUE, name text NOT NULL, city text);
CREATE TABLE products  (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        name text NOT NULL, price_cents bigint NOT NULL);
CREATE TABLE orders    (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        customer_id bigint NOT NULL REFERENCES customers(id),
                        created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

**The plain-language test that replaces the formal definitions:** *every non-key
column must depend on the key, the whole key, and nothing but the key.* If a column
would be wrong after updating something elsewhere, it is in the wrong table.

## Normalization is a correctness property, not a tidiness one

Duplication does not merely waste space — it permits **contradiction**. Two rows
claiming different cities for one customer is a state the database cannot resolve,
and no amount of application care prevents it, because two concurrent writers can
update different copies.

This is the same argument as [Foreign keys](03-foreign-keys.md) and
[Constraints](04-constraints.md): a normalised schema makes the bad state
*unrepresentable* rather than unlikely.

## When to denormalize on purpose

Denormalization is a deliberate trade of write complexity for read speed. Legitimate
cases:

**Historical snapshots — the one that is not really denormalization.** An order line
must record the price *at the time of sale*:

```sql
CREATE TABLE order_items (
  order_id     bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   bigint NOT NULL REFERENCES products(id),
  quantity     int NOT NULL CHECK (quantity > 0),
  unit_cents   bigint NOT NULL,        -- price when ordered, NOT products.price_cents
  PRIMARY KEY (order_id, product_id)
);
```

This looks like duplication and is not: `unit_cents` is a different fact from
`products.price_cents`. Copying the current price into the order is *required* —
otherwise raising a product's price silently rewrites every past invoice. Most
"denormalization" arguments in e-commerce are actually this, and are not a trade-off
at all.

**Counters and aggregates.** `posts.comment_count` avoids a `count(*)` on every
page. The cost is keeping it correct under concurrency — a trigger or the same
transaction as the insert, never a separate application write.

**Generated columns**, which are denormalization the database maintains for you.
Since nothing can write them, they cannot drift
([Generated columns](15-generated-columns.md)):

```sql
total_cents bigint GENERATED ALWAYS AS (unit_cents * quantity) STORED
```

Prefer this form whenever the value is a pure function of the same row — it is the
only denormalization with no consistency risk.

**Materialized views** for expensive reporting aggregates, refreshed on a schedule.
Explicitly stale, which is honest, and Phase 12's subject.

## The rule for when to denormalize

**Measure first.** Normalised schemas with indexed foreign keys join efficiently;
PostgreSQL is very good at this. "Joins are slow" is usually a missing index —
measured in [Foreign keys](03-foreign-keys.md) as a 4× difference on one index — or
an N+1 query pattern in the application, which is a code problem that denormalization
merely hides.

Before adding a redundant column, answer:

1. Is there an `EXPLAIN (ANALYZE, BUFFERS)` showing the join is the cost?
2. Is the referencing column indexed?
3. Is the application issuing one query per row (N+1)?
4. Can a generated column, materialized view, or covering index solve it instead?

If a redundant column is still the answer, **write down what keeps it correct** — a
trigger, a same-transaction write, a scheduled reconciliation job — in a
`COMMENT ON COLUMN` ([`COMMENT ON`](17-comments.md)). A denormalized column with no
documented maintenance mechanism will be wrong within months, and nobody will know
when it started.

## Trade-off

Normalised: every fact once, contradiction impossible, writes cheap and touching one
place, reads pay for joins. Denormalized: reads are cheaper, writes must update
several places atomically, and *every* copy is an opportunity for divergence.

The asymmetry that decides most cases: **a slow read is a performance problem, and
inconsistent data is a correctness problem.** The first is measurable, localised and
fixable later; the second is discovered by a customer, is often unfixable
retroactively because you cannot tell which copy was right, and erodes trust in the
whole dataset.

So: normalise by default, denormalize against a measurement, and prefer the forms
the database maintains for you.

## Gotchas

**Symptom:** A customer's city differs between their profile and their old orders
**Cause:** The city was copied into `orders` — a 3NF violation.
**Fix:** Store `customer_id` and join. If the historical value genuinely matters, it
is a snapshot and needs a name that says so.

**Symptom:** Filtering on a comma-separated column requires `LIKE '%x%'`
**Cause:** 1NF violation — multiple values in one column.
**Fix:** A child table with one row per value; it can then be indexed and joined.

**Symptom:** Renaming a product changed the text on historical invoices
**Cause:** The invoice joins `products` instead of snapshotting the name and price.
**Fix:** Copy name and price onto the order line at write time — a required
snapshot, not denormalization.

**Symptom:** A cached `comment_count` drifts from the real count
**Cause:** It is updated by application code outside the transaction that inserts
the comment.
**Fix:** A trigger, or the same transaction. Add a reconciliation job and document
it.

**Symptom:** Joins are blamed for a slow endpoint
**Cause:** Usually a missing index on the foreign key, or N+1 queries — measured, an
unindexed FK was 4× slower.
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` before changing the schema.

**Symptom:** A denormalized column is wrong and nobody knows since when
**Cause:** No documented mechanism keeping it correct.
**Fix:** `COMMENT ON COLUMN` naming the trigger or job responsible; add a
reconciliation check.

## Interview questions

**★ Explain 1NF, 2NF and 3NF without the formal definitions.**
1NF: one value per column — no comma-separated lists. 2NF: no column depends on only
*part* of a composite key. 3NF: no non-key column depends on another non-key column.
The single test that covers all three: every non-key column must depend on the key,
the whole key, and nothing but the key.

**★ Why does normalization matter beyond saving space?**
Because duplication permits contradiction. Two rows holding different cities for one
customer is a state the database cannot resolve, and application code cannot prevent
it — two concurrent writers can update different copies. Normalization makes the bad
state unrepresentable rather than unlikely.

**★ Is copying a product's price onto an order line denormalization?**
No — it is a required snapshot. `unit_cents` on the order and `price_cents` on the
product are different facts. Joining instead would mean a price change silently
rewrites every historical invoice. Most e-commerce "denormalization" is actually
this, and carries no consistency risk.

**★ When would you actually denormalize?**
Against a measurement: an `EXPLAIN (ANALYZE, BUFFERS)` showing the join is the cost,
with the foreign key already indexed and no N+1 pattern in the application. Then
prefer the forms the database maintains — a generated column, a materialized view —
over a redundant column your code must keep correct.

**★ Why prefer a generated column to a hand-maintained redundant one?**
Because nothing can write it — attempting to raises `428C9` — so it cannot drift
from its inputs. A hand-maintained copy depends on every future code path
remembering to update it.

**How do you decide between a slow read and a possible inconsistency?**
A slow read is measurable, localised and fixable later. Inconsistent data is
discovered by a customer, often cannot be repaired because you cannot tell which copy
was right, and undermines trust in everything else in the database. Normalise by
default.

---

← [Naming conventions](11-naming.md) · Next → [`DROP`, `CASCADE`, `RESTRICT`](13-drop-cascade.md)
