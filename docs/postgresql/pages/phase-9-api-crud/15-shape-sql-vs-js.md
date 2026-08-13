---
title: "Shaping the response in SQL vs in JavaScript"
sidebar_label: "15 · Shape in SQL vs JS"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex41-shaping-mapping.mjs`.

**`jsonb_agg` builds the nested response in one query, and it was the slowest
option measured.** The usual advice — push the work into the database — is wrong
here, and the plans say why.

## The four ways

Building `{order, items[]}` for 5000 orders with 5 items each (25 000 item rows):

```sql
-- (a) shaped entirely in SQL
SELECT o.id, o.customer_name, o.order_total,
       coalesce(jsonb_agg(jsonb_build_object(
         'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price)
         ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
  FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
 GROUP BY o.id
```

```js
// (b) one flat join, grouped in JS
const out = new Map();
for (const r of rows) {
  let o = out.get(r.id);
  if (!o) out.set(r.id, o = {id: r.id, ..., items: []});
  if (r.sku !== null) o.items.push({sku: r.sku, qty: r.qty, unitPrice: r.unit_price});
}
```

```js
// (c) two queries, joined in JS
const orders = (await q(`SELECT id, ... FROM s_orders`)).rows;
const items  = (await q(`SELECT ... FROM s_items WHERE order_id = ANY($1)`,
                        [orders.map(o => o.id)])).rows;
```

```js
// (d) N+1 — one query per order
for (const o of orders) o.items = (await q(`... WHERE order_id = $1`, [o.id])).rows;
```

## The measurement

```console
$ node ex41-shaping-mapping.mjs
median of 5 runs:
  (a) jsonb_agg in SQL          284.8 ms
  (a2) same, no ORDER BY        249.5 ms
  (a3) json_agg not jsonb       131.2 ms
  (b) flat join + JS             90.7 ms
  (c) two queries + JS          103.3 ms
  (d) N+1, 500 orders           298.6 ms  (2986 ms extrapolated to 5000)
```

**Shaping in SQL was 3× slower than grouping in JavaScript.** That is the opposite
of the usual expectation, so it is worth establishing where the time actually goes
before believing it.

**It is not the sort inside the aggregate.** Removing `ORDER BY i.id` saved 35 ms
of 285 — real, but not the story.

**It is `jsonb` specifically.** The identical query with `json_agg` instead of
`jsonb_agg` ran in 131.2 ms against 284.8 ms. `json` stores the text as given;
`jsonb` parses it into a binary form, deduplicates and reorders keys, and that
parse is over half the total cost.

**It is server-side CPU, not transfer.** Asking the server what it spent:

```console
server-side time only (EXPLAIN ANALYZE execution time):
  (a) jsonb_agg    Execution Time: 232.397 ms
  (b) flat join    Execution Time:  36.156 ms
```

232 ms of the 285 was the server. The database is doing the work, and it is doing
it on the resource you have least of.

**And the payload is bigger, not smaller:**

```console
approximate payload size:
  (a) jsonb rows : 2000000 bytes
  (b) flat rows  : 1225000 bytes
```

2.0 MB against 1.2 MB — despite returning 5000 rows instead of 25 000. The
repeated parent columns that the flat join duplicates cost less than the JSON keys
repeated on every element.

## What that does and does not mean

It does **not** mean "never shape in SQL". It means the reason to do it is not
performance.

- **(d) N+1 is still the one to avoid** — 2986 ms extrapolated, an order of
  magnitude worse than anything else. The choice is between (a), (b) and (c).
- **(b) and (c) are close** (90.7 ms vs 103.3 ms). Two queries avoid transferring
  duplicated parent columns; one join avoids a round trip. At this shape they are
  a wash — pick on clarity.
- **The gap narrows as the payload shrinks.** These numbers are 5000 parents in one
  response. A single order with five items is a few hundred microseconds either
  way, and none of this matters.

Where `jsonb_agg` genuinely wins is when the shape cannot be produced any other
way: several independent child collections in one round trip, or a payload
assembled inside a CTE that later steps depend on — see
[Phase 6 · json aggregates](../phase-6-aggregation/json-agg/).

## The empty-children trap

`jsonb_agg` over a `LEFT JOIN` does not produce an empty array for a parent with no
children:

```console
=== 2. jsonb_agg over a LEFT JOIN with no children ===
plain jsonb_agg      : [{"sku":null}]
with FILTER+coalesce : []
```

The `LEFT JOIN` produces one row with all-null child columns, and `jsonb_agg`
faithfully aggregates it into a one-element array containing a null object. Clients
iterating `items` get a phantom entry.

```sql
coalesce(
  jsonb_agg(jsonb_build_object('sku', i.sku, ...))
    FILTER (WHERE i.id IS NOT NULL),
  '[]'::jsonb)
```

Both halves are needed: `FILTER` removes the null row, and once every row is
filtered out `jsonb_agg` returns `NULL` rather than an empty array, so `coalesce`
supplies `'[]'`. Getting one and not the other gives you `null` instead of `[]`.

## Types change on the way through jsonb

```console
=== 3. types coming back from jsonb vs from columns ===
through jsonb : { total: 11, placed: '2026-08-13T08:03:06.359569+00:00' } → number / string
as columns    : { order_total: '11.00', placed_at: 2026-08-13T08:03:06.359Z } → string / Date
```

A `numeric` selected as a column arrives as the **string** `'11.00'`, preserving
exact decimal precision. Through `jsonb` it becomes the JavaScript **number** `11`
— trailing zeros gone, and now subject to floating-point representation. For money
that is a real problem, and it appears only in the JSON path.

`timestamptz` goes the other way: a `Date` object as a column, a string through
jsonb.

**jsonb also reorders keys.** The measured output showed `{"qty":1,"sku":...}`
where the query said `'sku', ..., 'qty', ...` — jsonb stores keys in its own order.
If key order matters to a consumer, `json_agg` preserves it and is faster anyway.

## Trade-off

Shaping in SQL puts the response structure in the query, where it is one artifact
and cannot drift from what the API returns. Shaping in JS keeps the query simple
and the structure in code that is easy to test, refactor and reuse across
endpoints — and, measured here, is faster.

The deciding question is usually not performance but **who owns the response
shape**. A query that emits the API payload directly couples the schema to the
contract: adding a column to the payload is a query change, and the same query
cannot serve two endpoints that need different shapes. Grouping in JavaScript
keeps one query serving several shapes.

Default to (b) — one join, grouped in JS, behind the repository's mapper. Reach for
`jsonb_agg` when the shape is genuinely awkward to assemble otherwise, and use
`json_agg` rather than `jsonb_agg` when you do, unless you need jsonb's operators.

## Gotchas

**Symptom:** A parent with no children has `[{"sku":null}]` instead of `[]`
**Cause:** `jsonb_agg` over a `LEFT JOIN` aggregates the all-null row.
**Fix:** `FILTER (WHERE child.id IS NOT NULL)` plus `coalesce(..., '[]'::jsonb)` —
both, or you get `null`.

**Symptom:** Monetary values lose trailing zeros or drift
**Cause:** `numeric` through `jsonb` becomes a JSON number. Measured: `'11.00'` as
a column, `11` through jsonb.
**Fix:** Cast to text inside the JSON object, or select money as a column.

**Symptom:** Moving aggregation into SQL made the endpoint slower
**Cause:** `jsonb` parsing is server-side CPU. Measured: 284.8 ms vs 90.7 ms, with
232 ms of it server-side.
**Fix:** Group in JS, or use `json_agg` — measured at 131.2 ms for the same query.

**Symptom:** JSON keys come back in a different order than written
**Cause:** `jsonb` stores keys in its own order.
**Fix:** `json_agg` preserves the order as written.

**Symptom:** The list endpoint takes seconds and the plan looks fine
**Cause:** N+1 — one query per parent. Measured: 2986 ms extrapolated for 5000
parents.
**Fix:** One join, or two queries with `= ANY($1)`.

**Symptom:** Aggregation returns one row when the parent has no children
**Cause:** `GROUP BY` on an inner join drops childless parents entirely.
**Fix:** `LEFT JOIN`, then the `FILTER`/`coalesce` pair above.

## Interview questions

**★ Is it faster to build a nested response with `jsonb_agg` or to group rows in
JavaScript?**
Measured, grouping in JavaScript was about 3× faster — 90.7 ms against 284.8 ms for
5000 orders with 25 000 items. The cost is server-side CPU parsing into jsonb's
binary form: `EXPLAIN` showed 232 ms of server execution against 36 ms for the flat
join, and the jsonb payload was larger (2.0 MB vs 1.2 MB) despite five times fewer
rows.

**★ How did you establish that it was jsonb rather than the join or the sort?**
By changing one thing at a time. Removing the `ORDER BY` inside the aggregate saved
35 ms of 285. Swapping `jsonb_agg` for `json_agg` — same join, same grouping —
dropped it to 131.2 ms. And `EXPLAIN ANALYZE` attributed most of the remaining time
to the server rather than transfer.

**★ Why does a parent with no children come back as `[{"sku":null}]`?**
The `LEFT JOIN` yields one row with null child columns and `jsonb_agg` aggregates
it. `FILTER (WHERE i.id IS NOT NULL)` removes it, and `coalesce(..., '[]')` is then
needed because an aggregate over zero rows returns `NULL`, not an empty array.

**★ What happens to a `numeric` column selected through `jsonb`?**
It becomes a JSON number, so `'11.00'` arrives as `11` — trailing zeros lost and
floating-point representation in play. Selected as a column it stays the exact
string `'11.00'`. For money, keep it out of the JSON path or cast it to text.

**When is `jsonb_agg` the right choice despite being slower?**
When the shape cannot reasonably be assembled otherwise — several independent child
collections in one round trip, or a payload consumed by later steps of the same
query. Prefer `json_agg` unless you need jsonb's operators or storage.

**What is the real argument against shaping the response in SQL?**
Ownership. A query that emits the API payload couples the schema to the contract,
so the query changes whenever the response does and cannot serve two endpoints with
different shapes.

---

← [`SELECT ... FOR UPDATE`](14-for-update.md) · Next → [Testing against a real PostgreSQL](16-testing-real-pg.md)
