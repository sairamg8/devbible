---
title: "What \"total: N\" costs"
sidebar_label: "01 · What \"total\" costs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37d-pagination-counts.mjs`.

**Returning a page of 20 rows costs 2 ms. Adding `total: 125000` to the response costs
between 23× and 73× that, depending on how you ask for it. The page itself is almost never
the slow part of a list endpoint — the count is.**

## The four ways, measured

All against the same filter over 500 000 rows, 125 000 of which match:

```console
=== A. the four ways to answer "is there a next page?" ===
exact count             : 48.83 ms
page only, limit 20     : 2.11 ms
limit+1 has-more        : 2.10 ms
count(*) OVER () + page : 152.77 ms
```

| Approach | Time | Answers |
|---|---|---|
| `LIMIT 20` — no count at all | **2.11 ms** | nothing about totals |
| `LIMIT 21` — fetch one extra | **2.10 ms** | *"is there a next page?"* |
| `count(*)` as a second query | **48.83 ms** | the exact total |
| `count(*) OVER ()` in the same query | **152.77 ms** | the exact total |

**`limit + 1` is free.** Fetching 21 rows instead of 20 measured 2.10 ms against 2.11 ms —
inside the noise, because the work is dominated by finding the first 20 in order, not by
the 21st. And it answers the question a UI usually actually asks: should the *Next* button
be enabled?

## Why `count(*) OVER ()` is the worst option

It is the tempting one — one query, one round trip, total included — and it is three times
slower than running a separate `count(*)`:

```console
=== B. why count(*) OVER () is the expensive one ===
  Limit (actual rows=20.00 loops=1)
  ->  Sort (actual rows=20.00 loops=1)
  Sort Key: id
  Sort Method: top-N heapsort  Memory: 25kB
  ->  WindowAgg (actual rows=125000.00 loops=1)
  ->  Seq Scan on agg_events (actual rows=125000.00 loops=1)
  ^ the WindowAgg must see every matching row before it can emit the first one
```

Read the row counts up the plan. The `WindowAgg` processes **125 000 rows** so that it can
put the same total on each one, and only then does `Limit` throw away all but 20. The
window function defeats the entire point of `LIMIT`: the executor cannot stop early,
because `count(*) OVER ()` is not known until the last matching row has been seen.

**So you pay for a full scan *and* carry the total on every one of the 20 returned rows**,
where a separate `count(*)` at least does one clean aggregate pass. The one-round-trip
saving is real but it is buying a 3× worse query.

## The `limit + 1` pattern

Fetch one more row than you intend to return. If you get it, there is another page; drop it
before responding.

```sql
SELECT id FROM agg_events
WHERE kind = 'purchase'
ORDER BY id
LIMIT 21;              -- pageSize + 1
```

```console
=== E. what the client is told ===
a page payload built from limit+1: [{"has_more":true,"rows_present":true}]
```

This is the right default for infinite scroll, "load more" buttons, and any API whose
consumer needs to know whether to keep going rather than how many items exist. It costs
nothing measurable and it is exact — unlike the estimates in
[the next chunk](02-estimates-and-caps.md), `has_more` is never wrong.

What it cannot do is render *"Page 1 of 6 250"* or a numbered pager. If the product needs
that, you are buying an exact count and the question becomes how to make it cheap.

## Do not count on every request

Three things worth separating, because they are usually conflated into one `total` field:

1. **"Is there more?"** — `limit + 1`, free, exact.
2. **"Roughly how many?"** — the planner already knows, for free. Next chunk.
3. **"Exactly how many?"** — 48.83 ms here, and it grows with the table.

Most list endpoints ask for (3) and only need (1). The count is also the part that degrades
worst as data grows, because the page query is bounded by `LIMIT` while the count is
bounded by the number of matching rows.

If an exact count is genuinely required, at least avoid recomputing it on every page of the
same result set: count once when the filter changes, then pass it back with the cursor.

## In Node

```js
const PAGE = 20;

const {rows} = await pool.query(
  `SELECT id, kind, amount
   FROM agg_events
   WHERE kind = $1
   ORDER BY id
   LIMIT $2`,
  [kind, PAGE + 1],           // ask for one extra
);

const hasMore = rows.length > PAGE;
res.json({
  items: hasMore ? rows.slice(0, PAGE) : rows,
  hasMore,
});
```

- **`PAGE + 1` as a parameter, not string concatenation.** `LIMIT $2` is parameterised like
  any other value.
- **Slice before responding.** Forgetting is the classic bug: the last page silently
  returns 21 items instead of 20, and nothing errors.
- **Pair it with keyset pagination, not `OFFSET`.** Deep `OFFSET` degrades badly — 1.22 ms
  at offset 0 versus 105.85 ms at 499 980, because the rows are produced and then discarded
  ([measured in phase 4](../../phase-4-crud/03-limit-offset.md)). `limit + 1` on top of
  keyset gives a cheap page *and* a cheap has-more.
- **`count()` returns `bigint`**, which arrives as a string; `::int` it when you know the
  value fits ([phase 7](../../phase-7-pg-driver/09-pg-types.md)).

## Trade-off

`limit + 1` gives an exact, free answer to the only pagination question most UIs ask, at
the cost of never being able to render a total. An exact count is honest and precise and
costs a full pass over every matching row on every request — 23× the page itself here, and
worse as the table grows. `count(*) OVER ()` looks like it splits the difference and
actually takes the worst of both: full-scan cost *and* the total repeated on every returned
row. Decide which question the product is really asking before paying for the expensive
one.

## Gotchas

**Symptom:** a list endpoint is slow and the page query looks fine in isolation
**Cause:** the `total` count is the expensive half. Measured: 2.11 ms for the page, 48.83 ms
for the count
**Fix:** drop to `limit + 1` if the UI only needs a *Next* button, or use an estimate

**Symptom:** adding `count(*) OVER ()` made the query dramatically slower, not faster
**Cause:** the `WindowAgg` must see every matching row before emitting the first, so `LIMIT`
cannot stop the scan early. Measured: 152.77 ms versus 48.83 ms for a separate count, with
the plan showing `WindowAgg (actual rows=125000.00)` feeding a `Limit` of 20
**Fix:** run the count as its own statement, or stop returning an exact total

**Symptom:** the last page returns 21 items instead of 20
**Cause:** the extra `limit + 1` row was never sliced off
**Fix:** slice to the page size after computing `hasMore`

**Symptom:** the total is recomputed on every page of the same result set
**Cause:** the count is issued alongside each page request
**Fix:** compute it when the filter changes and carry it with the cursor

**Symptom:** pagination is fast on page 1 and slow on page 500
**Cause:** `OFFSET` produces and discards every skipped row
**Fix:** keyset pagination; `limit + 1` composes with it directly

## Interview questions

**★ Why is `count(*) OVER ()` slower than a separate `count(*)`?**
Because the window function must see every matching row before it can emit the first one,
so `LIMIT` cannot terminate the scan early — and the total is then carried on every returned
row. Measured: 152.77 ms versus 48.83 ms, with the plan showing the `WindowAgg` processing
125 000 rows to return 20.

**★ How do you tell the client there is a next page without counting?**
Request `pageSize + 1` rows. If you get the extra one, there is more; drop it before
responding. Measured at 2.10 ms against 2.11 ms for the plain page — free, and exact.

**★ How much does an exact total actually cost on a list endpoint?**
Here, 48.83 ms against 2.11 ms for the page itself — about 23×. And it scales with the
number of matching rows, while the page query stays bounded by `LIMIT`.

**★ What is the bug people introduce with `limit + 1`?**
Forgetting to slice the extra row off, so the response contains one item too many. Nothing
errors; the client just renders 21 items.

**When is an exact count actually required?**
When the UI renders a numbered pager or "Page 1 of N". For infinite scroll, "load more", or
a *Next* button, `has_more` is sufficient and far cheaper.

---

← [Topic index](README.md) · Next → [Estimates and capped counts](02-estimates-and-caps.md)
