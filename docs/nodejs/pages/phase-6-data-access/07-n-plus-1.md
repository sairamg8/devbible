---
title: "N+1 queries"
sidebar_label: "07 · N+1 queries"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**, `pg` 8.23.0 / PostgreSQL 17.10 and
> `mongodb` 7.5.0 / MongoDB 8.2.12, both on localhost.

**One query for the list, then one more per item.** It is the most common
performance bug in application code, it never looks wrong, and it gets worse
exactly when your product succeeds.

```js
// 1 query …
const orders = (await pool.query('select id, user_id, total_cents from orders limit 100')).rows;
// … + 100
for (const order of orders) {
  order.items = (await pool.query('select sku, qty from order_items where order_id = $1', [order.id])).rows;
}
```

## What it costs

The same 100 orders with their items, four ways:

```console
$ node ex5-nplus1.mjs
N+1 sequential:       101 queries, 111 ms
N+1 parallel:         101 queries, 49 ms
batched (= any):      2 queries, 7 ms
one query (json_agg): 1 query,  6 ms
```

**111 ms to 7 ms**, doing identical work and returning identical data. Mongo is the
same shape:

```console
mongo N+1:           101 queries, 158 ms
mongo batched ($in): 2 queries, 6 ms
mongo $lookup:       1 query,  10 ms
```

And this is the *flattering* measurement — a database on localhost:

```console
100 round trips to localhost: 58 ms (~0.58 ms each)
   at a 2 ms network RTT the same 101 queries cost ~202 ms of pure waiting
```

Move the database to another host in the same region and the N+1 costs seconds
while the batched version barely moves. **The cost is round trips, not query
work**, which is why it never shows up in slow-query logs: each individual query is
fast.

## Firing them in parallel is not the fix

```console
N+1 parallel: 101 queries, 49 ms
```

Twice as fast, and still wrong. You have replaced 100 sequential round trips with
100 *simultaneous* ones, which means 100 connections wanted at once from a pool of
10 — the other 90 queue ([page 01](./01-connection-pooling.md)). Under real traffic
this converts one slow endpoint into pool exhaustion for the whole process, which
is the [Phase 2 `Promise.all`
outage](../phase-2-async/14-concurrency-control.md) with a database attached.

## Fix 1: batch the second query

Collect the ids, fetch the children in one query, group in memory.

```js
const orders = (await pool.query('select id, user_id, total_cents from orders limit 100')).rows;

const items = (await pool.query(
  'select order_id, sku, qty from order_items where order_id = any($1::int[])',
  [orders.map((o) => o.id)])).rows;

const byOrder = Map.groupBy(items, (i) => i.order_id);
for (const o of orders) o.items = byOrder.get(o.id) ?? [];
```

Two queries, whatever the page size. `Map.groupBy` is built in since Node 21 — no
lodash. In Mongo the same shape is `find({userId: {$in: ids}})`.

**This is the fix that always applies**, including across services, where the
"join" would otherwise be an HTTP call per row. It is also what a DataLoader does:
collect ids within a tick, issue one batched query, hand each caller its slice.

## Fix 2: let the database do the join

```sql
select o.id, o.user_id, o.total_cents,
       coalesce(json_agg(json_build_object('sku', i.sku, 'qty', i.qty))
                filter (where i.id is not null), '[]') as items
from orders o
left join order_items i on i.order_id = o.id
where o.id in (select id from orders order by id limit 100)
group by o.id
order by o.id;
```

One query, one round trip, JSON arrays already shaped for the response — 6 ms.
`json_agg` with `filter` is what keeps orders that have no items (a plain join
would drop them, and `json_agg` without the filter gives you `[null]`).

The trade-off is real: the SQL is harder to read, the shaping lives in the
database, and a wide join multiplies rows before aggregating. Use it for a hot
endpoint; use batching for everything else.

Mongo's `$lookup` does the same job at 10 ms, and comes with the same warning — it
is a per-document lookup on the server, so it needs an index on the foreign field.

## Spotting it before it ships

An N+1 is invisible in a code review of one function, because the query is in the
repository and the loop is in the service. Three things that make it visible:

**Count queries per request.** Ten lines in your pool wrapper:

```js
let count = 0;
export const db = {
  query(text, values) {
    count++;
    return pool.query(text, values);
  },
};
// in a request-scoped store (Phase 2, page 20), log the count when the response finishes
```

An endpoint whose query count grows with the size of its response is an N+1, full
stop. That check belongs in a test:

```js
assert.ok(queriesFor('/orders?limit=100') < 5, 'orders endpoint should not be N+1');
```

**Log the SQL in development** with a per-request tag. A hundred near-identical
lines is unmistakable, and it is how you catch the ORM ones you did not write.

**Watch for the shape.** `await` inside a `for`/`map` over rows, a getter that
loads a relation, a `toJSON` that fetches, an `if (!obj.author) await load()`. Lazy
loading is an N+1 generator by design: the query is *invisible at the call site*,
which is exactly what makes it dangerous.

## ORMs make it easier to write and harder to see

Every ORM ships a batching mechanism because every ORM makes N+1 the default. Ask
your ORM to print its SQL and count the statements — Prisma's `include` is **two
queries, not a join**:

```console
$ node ex12-prisma.mjs
include: {order_items: true} -> 2 queries:
  SELECT "public"."orders"."id", …
  SELECT "public"."order_items"."id", … WHERE "order_id" IN ($1,$2,$3,$4,$5)
```

That is the batched fix, applied for you. What you must not do is loop and call
`findMany` per row — the ORM will do exactly what you asked.

| Layer | The batching escape |
|---|---|
| `pg` / `mongodb` | `= any($1)` / `$in`, or a join / `$lookup` |
| Mongoose | `.populate()` (one extra query per path, not per document) |
| Prisma | `include` / `select` on the relation |
| Drizzle | `with:` in the relational API, or an explicit join |
| GraphQL | DataLoader — the resolver-per-field shape makes N+1 structural |

## Gotchas

**Symptom:** An endpoint is fine with 10 items and times out with 500
**Cause:** Query count scales with result size.
**Fix:** Batch with `= any($1)` / `$in`, or join.

**Symptom:** Slow-query logs are clean but latency is bad
**Cause:** Hundreds of individually-fast queries.
**Fix:** Count queries per request, not just their durations.

**Symptom:** Pool exhaustion whenever one endpoint is called
**Cause:** The N+1 was "fixed" with `Promise.all`, so it now demands N connections
at once.
**Fix:** Batch it properly; if you must fan out, bound the concurrency.

**Symptom:** It got much worse after moving to a managed database
**Cause:** RTT went from 0.5 ms to 2–5 ms and you make 101 of them.
**Fix:** Same fix — the batched version is barely affected.

**Symptom:** A join returns fewer parents than expected
**Cause:** An inner join drops parents with no children.
**Fix:** `left join`, with `filter (where …)` on the aggregate.

**Symptom:** `json_agg` returns `[null]` for a childless parent
**Cause:** The `filter` clause is missing.
**Fix:** `coalesce(json_agg(…) filter (where i.id is not null), '[]')`.

## Interview questions

**★ What is an N+1 query and why is it slow?**
One query to fetch a list, then one per item to fetch its relation. It is slow
because of round trips, not query cost — measured, 101 queries took 111 ms against
7 ms for the batched equivalent on localhost, and the gap widens with network
latency because every round trip pays it.

**★ Doesn't `Promise.all` fix it?**
It reduces wall time — 111 ms to 49 ms here — but it makes resource usage worse: N
simultaneous queries need N pool connections, so one endpoint can exhaust the pool
for the entire process. The number of queries has to come down, not just their
arrangement in time.

**★ How do you fix an N+1 without a join?**
Collect the parent ids, issue one query with `where id = any($1)` (or `$in`), group
the children by their foreign key in memory, and attach. Two queries regardless of
page size, and it works across service boundaries where a join is impossible.

**★ How do you detect one?**
Count queries per request and log the count with the response; an endpoint whose
count grows with its result size is an N+1. Assert on it in a test for hot
endpoints, and log SQL in development.

**★ Why are ORMs associated with N+1?**
Because lazy relation access hides the query at the call site — `order.items` looks
like a property read. The fix is the ORM's own batching (`include`, `populate`,
`with`), and the discipline of reading the SQL it emits.

**When is a join the wrong answer?**
When the data lives in different databases or services, when the join multiplies
rows badly (several one-to-many relations at once), or when the aggregation shape
makes the query unreadable for a marginal gain. Batching is the general fix; joins
are the optimisation.

---

← Prev: [Transactions](./06-transactions.md) · Next → [Drivers, query builders and ORMs](./08-drivers-builders-orms.md)
