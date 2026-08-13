---
title: "The empty-array trap"
sidebar_label: "03 · The empty-array trap"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36e-shaping.mjs`.

**A parent with no children should return `[]`. Written the obvious way it returns
`[null]`, and written the obvious *fix* it returns `null`. Getting to `[]` takes both a
`FILTER` and a `coalesce`, and knowing why is the difference between a payload that a
client can iterate and one that crashes it.**

## Three wrong answers in a row

The query: orders with their line items, where order 10 has two items and order 13 has
none.

### Attempt 1 — the naked aggregate

```sql
SELECT o.id, array_agg(i.sku) AS skus
FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id;
```

```console
naked array_agg : [{"id":10,"skus":["A","B"]},{"id":13,"skus":[null]}]
```

**`[null]` — an array of length one containing nothing.** The `LEFT JOIN` invented a row
for order 13 with every `agg_items` column `NULL`, that row is a genuine member of the
group, and `array_agg` keeps `NULL`s. A client doing `skus.length` gets `1`, and
`skus.map(s => s.toUpperCase())` throws.

The same thing with `jsonb_agg` is worse, because the naked form also leaks the entire
child row:

```console
naked jsonb_agg : [{"id":10,"items":[{"id":100,"qty":1,"sku":"A","unit":100,"order_id":10},
                                     {"id":101,"qty":2,"sku":"B","unit":50,"order_id":10}]},
                   {"id":13,"items":[null]}]
```

`jsonb_agg(i.*)` emitted `order_id` and `unit` — internal columns nobody asked for — and
still produced `[null]` for order 13. Both problems, one expression.

### Attempt 2 — add a `FILTER`

```sql
SELECT o.id, jsonb_agg(i.*) FILTER (WHERE i.id IS NOT NULL) AS items
FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id;
```

```console
FILTER alone : [{"id":10,"items":[…]},{"id":13,"items":null}]
```

**`null`, not `[]`.** Progress — the fake row is gone — but the fix created the *next*
problem. `FILTER` removed the only row order 13 had, so `jsonb_agg` aggregated over an
**empty group**, and every aggregate over an empty input returns `NULL`. It is the same
rule as `sum` over no rows from
[empty groups](../01-group-by/02-empty-groups-and-keys.md), arriving in a new costume.

A client now gets `items: null` instead of `items: []`, which is exactly the shape that
produces "Cannot read properties of null (reading 'length')" in production and never in
a test where every order has items.

### Attempt 3 — `FILTER` *and* `coalesce`

```sql
SELECT o.id,
       coalesce(
         jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty) ORDER BY i.sku)
           FILTER (WHERE i.id IS NOT NULL),
         '[]'::jsonb
       ) AS items
FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id;
```

```console
FILTER + coalesce : [{"id":10,"items":[{"qty":1,"sku":"A"},{"qty":2,"sku":"B"}]},
                     {"id":13,"items":[]}]
```

**`[]`.** Four things are doing work in that expression and all four are required:

| Part | Without it |
|---|---|
| `jsonb_build_object(...)` | the whole child row leaks, `order_id` and all |
| `ORDER BY i.sku` | element order can change when the query around it changes |
| `FILTER (WHERE i.id IS NOT NULL)` | `[null]` for childless parents |
| `coalesce(…, '[]'::jsonb)` | `null` instead of `[]` for childless parents |

Learn it as one idiom rather than four rules. Write it out once per project as the
canonical child-collection expression and copy it.

For arrays the shape is the same with a different empty literal:

```sql
coalesce(array_agg(i.sku ORDER BY i.sku) FILTER (WHERE i.id IS NOT NULL), '{}') AS skus
```

`'{}'` is the empty array literal; `'[]'::jsonb` is the empty JSON array. Using `'{}'` for
`jsonb` gives you an empty **object**, which is a different bug and a quiet one.

## The whole payload, two levels deep

Once the idiom is established, nesting is mechanical — the inner aggregate runs inside a
`LATERAL` so that each order collects its own items before the outer aggregate collects
orders:

```sql
SELECT jsonb_build_object(
  'id', c.id, 'name', c.name,
  'orders', coalesce(jsonb_agg(o.payload ORDER BY o.id)
                     FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb)
) AS customer
FROM agg_customers c
LEFT JOIN LATERAL (
  SELECT o.id, jsonb_build_object(
    'id', o.id, 'status', o.status, 'total', o.total,
    'items', coalesce(jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty)
                                ORDER BY i.sku)
                      FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb)
  ) AS payload
  FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
  WHERE o.customer_id = c.id
  GROUP BY o.id
) o ON true
WHERE c.id IN (1, 5)
GROUP BY c.id, c.name ORDER BY c.id;
```

```console
=== E7. a whole API payload in one query, two levels deep ===
[{"customer":{"id":1,"name":"Ann","orders":[
    {"id":10,"items":[{"qty":1,"sku":"A"},{"qty":2,"sku":"B"}],"total":100,"status":"paid"},
    {"id":11,"items":[{"qty":5,"sku":"A"}],"total":50,"status":"open"}]}},
 {"customer":{"id":5,"name":"Eve","orders":[]}}]
```

**Ann comes back complete; Eve comes back with `orders: []`.** One query, one round trip,
no stitching, and the empty case is correct at both levels.

Two structural points about that query:

**`LEFT JOIN LATERAL … ON true` and not a plain subquery**, because the inner query
references `c.id`. That is what `LATERAL` is for — see
[LATERAL](../../phase-5-joins/10-lateral.md). `ON true` keeps customers with no orders.

**The inner `GROUP BY o.id` is what stops fan-out compounding.** Each order aggregates its
own items in isolation, so the outer level sees one row per order regardless of how many
items each has. Without the nesting — both joins flat, one `GROUP BY c.id` — an order with
two items would be counted twice by anything at the customer level, which is
[fan-out](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md) exactly.

## Is shaping in SQL worth it?

```console
=== E8. one shaped query vs three flat ones — bytes on the wire ===
shaped   rows: 5   JSON bytes: 292
flat     rows: 11  JSON bytes: 580
```

On this fixture the shaped form is about half the bytes, and the ratio is not the
interesting part — the fixture is six rows. What the numbers do show is that **shaping
does not cost bandwidth**, which is the objection people expect. It repeats no parent
data, whereas the flat forms send the parent columns and then a separate result set the
client must index and join.

The real comparison is against the alternative shapes:

| Approach | Round trips | Client work | Risk |
|---|---|---|---|
| Shaped query (this page) | **1** | none | shape lives in SQL, untyped |
| Parent query + child query per parent | **1 + N** | stitching | classic N+1 |
| Parent query + one child query, join in JS | 2 | build a `Map`, group | duplicated grouping logic |
| One flat join | 1 | de-duplicate parents | fan-out, repeated parent data |

The one to actively avoid is the second — see
[N+1 queries](/docs/nodejs/pages/phase-6-data-access/n-plus-1). Between the first and
the third, it is a genuine judgement call: the shaped query is faster and atomic; the
two-query version keeps the response shape in TypeScript where a compiler can check it.

**A rule that has held up:** shape in SQL when the nesting is fixed and the child sets are
small and bounded. Stitch in JS when the client needs the pieces separately anyway, or
when the child set needs its own pagination — because there is no good way to paginate
inside a `jsonb_agg`.

## Trade-off

One query returning a complete response is the fastest and most atomic option, and it
puts the response schema in a string. No type checker validates `'stauts', o.status`, and
a renamed key ships silently. Against that, the stitching version spreads grouping logic
across the client and reintroduces the possibility that two endpoints assemble the same
resource differently. Both are defensible; what is not defensible is the N+1, and either
of these beats it.

## Gotchas

**Symptom:** `items` is `[null]` and the client crashes iterating it
**Cause:** `LEFT JOIN` invented a `NULL` row, and `array_agg`/`jsonb_agg` keep `NULL`s
**Fix:** `FILTER (WHERE child.id IS NOT NULL)` — and then `coalesce`, because the `FILTER`
creates the next problem

**Symptom:** `items` is `null` after adding the `FILTER`
**Cause:** `FILTER` emptied the group, and an aggregate over an empty group is `NULL`
**Fix:** `coalesce(… , '[]'::jsonb)` — or `'{}'` for an array column

**Symptom:** an empty `jsonb` field comes back as `{}` where the client expects `[]`
**Cause:** `coalesce(jsonb_agg(…), '{}')` — `'{}'` is the empty *object* in JSON
**Fix:** `'[]'::jsonb`. The `'{}'` literal is for PostgreSQL arrays, not JSON arrays

**Symptom:** internal columns appear inside a nested JSON array
**Cause:** `jsonb_agg(child.*)` emits every column of the child row
**Fix:** `jsonb_agg(jsonb_build_object('sku', …, 'qty', …))` — name the fields

**Symptom:** the nested payload double-counts a parent-level `sum`
**Cause:** two child tables joined flat at the same level, so their fan-outs multiply
**Fix:** aggregate each child inside its own `LATERAL` subquery, as in the two-level
example, so the outer level sees one row per parent

**Symptom:** the response for a parent with thousands of children is enormous and slow
**Cause:** `jsonb_agg` materialises the whole collection per group before returning
**Fix:** paginate the children in a separate query. There is no `LIMIT` inside an
aggregate; the nearest thing is `LIMIT` inside the `LATERAL` subquery

## Interview questions

**★ Why does a `jsonb_agg` over a `LEFT JOIN` return `[null]` for a parent with no
children?**
Because `LEFT JOIN` emits the parent row extended with `NULL`s in the child columns, that
row is a real member of the group, and `jsonb_agg` keeps `NULL`s. The array has one
element and that element is `null`.

**★ You add `FILTER (WHERE child.id IS NOT NULL)` and now it returns `null`. Why?**
Because the `FILTER` removed the group's only row, so the aggregate ran over an empty
input — and every aggregate over an empty input is `NULL`. Both `FILTER` and
`coalesce(…, '[]'::jsonb)` are required to reach `[]`.

**★ Write the canonical expression for a child collection.**
`coalesce(jsonb_agg(jsonb_build_object('k', c.k, …) ORDER BY c.k) FILTER (WHERE c.id IS
NOT NULL), '[]'::jsonb)`. Four parts: `build_object` to avoid leaking columns, `ORDER BY`
for a stable order, `FILTER` for `[null]`, `coalesce` for `null`.

**★ How do you nest two levels without fan-out?**
Aggregate the innermost level inside a `LEFT JOIN LATERAL … ON true` subquery with its
own `GROUP BY`, so the outer level sees exactly one row per intermediate entity. Joining
both children flat at one level multiplies their row counts together.

**Should the API response be shaped in SQL or assembled in JavaScript?**
Shape in SQL when the nesting is fixed and child sets are small and bounded — one round
trip, atomic, no stitching. Assemble in JS when the client needs the pieces separately or
the children need their own pagination, since there is no way to paginate inside an
aggregate. Either beats a query per parent.

**Does returning a nested payload send more data than flat result sets?**
No — measured 292 bytes against 580 for the same content, because the shaped form does not
repeat parent columns for each child. Bandwidth is not the argument against it; the loss
of compile-time typing on the response shape is.

---

← [JSON shapes](02-json-shapes.md) · Next topic → [Window functions](../windows-intro/)
