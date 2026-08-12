---
title: "list with filtering, sorting and pagination"
sidebar_label: "02 · list endpoint"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**Every resource has this endpoint, and it is where three separately-safe
mechanisms have to coexist: filters are parameters, sort is an allowlist, and
pagination is two more parameters plus a tiebreaker you will forget.** Get the
combination wrong and the failure is not an error — it is rows appearing twice.

## The assembled query

Each piece is covered in full elsewhere; this is how they compose.

```js
import {buildWhere} from './filters.js';     // → 03 · Safe dynamic WHERE
import {orderClause} from './sorting.js';    // → 04 · Allowlists

export async function listItems(client, {filters = {}, sort, dir, limit = 20, offset = 0}) {
  const {where, params} = buildWhere(filters);

  const text =
    `SELECT id, name, status, price, owner FROM fs_items` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ${orderClause(sort, dir)}` +
    ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const {rows} = await client.query(text, [...params, limit, offset]);
  return rows;
}
```

Three different safety mechanisms, one query:

| Part | Comes from the client as | Reaches SQL as |
|---|---|---|
| Filter **values** | arbitrary strings | `$1, $2 …` parameters |
| Filter **fields**, sort column, direction | arbitrary strings | keys into an allowlist; never interpolated |
| `limit` / `offset` | numbers | parameters, appended last |

`limit` and `offset` are *values*, so they are parameters like any other. Appending
them last keeps the `$n` numbering rule from
[Safe dynamic `WHERE`](./safe-dynamic-where/) intact — the placeholder number is
always `params.length` after the push.

**Clamp `limit` before it reaches the query.** It is a parameter, so it cannot
inject, but `?limit=1000000` is still a denial of service:

```js
const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
const offset = Math.max(Number(req.query.offset) || 0, 0);
```

`Number('abc')` is `NaN` and `NaN || 20` is `20`, so this also handles junk input.
Without the `Number()` coercion, `pg` sends the string `'abc'` and PostgreSQL
raises `22P02 invalid input syntax for type bigint`.

## The bug: `ORDER BY` on a non-unique column

This is the part that looks fine in every test with ten rows. 30 000 rows, sorted
by a column with three distinct values, paged five at a time:

```js
const page = async (offset) => {
  const {rows} = await pool.query(
    `SELECT id FROM fs_tie ORDER BY grp LIMIT 5 OFFSET $1`, [offset],
  );
  return rows.map((r) => r.id);
};
```

```console
$ node ex5-filter-sort.mjs
=== 10. ties + LIMIT/OFFSET without a tiebreaker ===
page 1, run A: 12,3,6,9,15
page 1, run B: 12,3,6,9,15
paging 0→100 by 5 without a tiebreaker: 54 distinct ids, 46 repeats
same, with ", id" as tiebreaker:        100 distinct ids, 0 repeats
```

Paging through what should be 100 rows returned **54 distinct rows and 46
duplicates**. Nearly half the result set was wrong: some rows appeared on several
pages, and — necessarily — others never appeared at all.

The cause is that `ORDER BY grp` is an *underspecified* sort. With only three
distinct `grp` values, thousands of rows tie, and SQL does not promise any
particular order among tied rows. PostgreSQL is free to return them differently for
each query, and with `LIMIT`/`OFFSET` it often does — the planner can use a
different strategy (top-N heapsort vs full sort) depending on the offset, and the
row order changes with it.

Note the first two lines: **page 1 was identical across two runs.** The instability
is not random per-query jitter you could catch by repeating one request; it appears
*between different offsets*. That is exactly why this survives testing and fails in
production, where users page and the rows are not the twenty you seeded.

The fix is one clause — append a unique column to every sort:

```sql
ORDER BY grp, id          -- id is the primary key: unique, so the order is total
```

This is why [`orderClause`](./allowlists/) appends `, id ASC` unconditionally
rather than leaving it to the caller. A sort that is not total is a bug waiting for
enough rows.

## `OFFSET` is the wrong default

Even correct, `OFFSET n` makes the database produce and discard `n` rows. Page 1
is fast; page 500 reads 10 000 rows to return 20. The cost grows linearly with page
number, so the slowest requests are the deepest ones — usually crawlers and export
scripts, hitting you hardest at the worst moment.

`OFFSET` also cannot be made correct under concurrent writes. If a row is inserted
before the user's current position between two requests, everything shifts by one
and they see a row twice; a delete makes them miss one. The tiebreaker fixes the
*unstable sort*, not the *shifting window*.

Keyset pagination — remembering the last row's sort key instead of counting rows —
fixes both, and is covered in [Keyset pagination](10-keyset.md). Use `OFFSET` for
an admin screen with a page-number UI; use keyset for infinite scroll, public APIs,
and anything crawlable.

## The total count, and why it is expensive

Clients want `{items, total}`. `total` is a second query over the same predicate,
without `LIMIT`:

```js
const [items, count] = await Promise.all([
  client.query(text, [...params, limit, offset]),
  client.query(
    `SELECT count(*)::int AS total FROM fs_items` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : ''),
    params,
  ),
]);
```

Run both on **the same client inside one transaction** if the numbers must agree —
on separate pool connections they see different snapshots, so `total` can disagree
with what the page actually returned.

`count(*)` with a filter has no shortcut: PostgreSQL counts matching rows, which
means scanning them. On a large table it is often slower than the page query it
accompanies. The options, in order of how often they are right:

1. **Do not return a total.** "Next page" needs to know only whether another row
   exists — fetch `limit + 1` rows and report `hasMore` from whether you got it.
2. **An approximate count** from `pg_class.reltuples` for the unfiltered case,
   which is free but only as fresh as the last `ANALYZE`.
3. **The real count**, accepting the scan, when the UI genuinely needs page numbers.

## Trade-off

This endpoint is where generality is most tempting and most expensive. Every
filter you expose is a predicate the planner must handle and, if it is to be fast,
an index you must maintain; every sortable column is another index. A truly generic
list endpoint is a promise to index every column, or a promise to sequentially scan.

The narrow version — a fixed set of filters, two or three sortable columns, keyset
pagination — is less flexible and stays fast at every page depth. Widen it
deliberately, one column at a time, with the index in the same commit.

## Gotchas

**Symptom:** The same row appears on two different pages
**Cause:** `ORDER BY` on a non-unique column; tied rows have no guaranteed order and
the plan can differ per offset.
**Fix:** Append a unique column: `ORDER BY grp, id`. Measured: 46 duplicates across
100 rows without it, 0 with it.

**Symptom:** Rows are missing from the results entirely, with no error
**Cause:** The same unstable sort — if rows repeat on some pages, others are never
returned.
**Fix:** Same tiebreaker.

**Symptom:** Deep pages get progressively slower
**Cause:** `OFFSET n` produces and discards `n` rows before returning any.
**Fix:** Keyset pagination for anything users or crawlers page deeply.

**Symptom:** `22P02 invalid input syntax for type bigint`
**Cause:** `?limit=abc` passed straight through as a string parameter.
**Fix:** `Number()` and clamp before the query.

**Symptom:** One request pins a connection for minutes
**Cause:** Unclamped `?limit=1000000`. It cannot inject, but it can exhaust the
pool.
**Fix:** Clamp to a maximum, typically 100.

**Symptom:** `total` disagrees with the number of items returned
**Cause:** The count and page queries ran on different pool connections, so
different snapshots.
**Fix:** Same client, one transaction — or drop `total` for `hasMore`.

**Symptom:** The list endpoint is fast in staging, slow in production
**Cause:** Sorting or filtering on a column with no index; the difference only
shows past a few thousand rows.
**Fix:** Index every column in the sort and filter allowlists, and check with
`EXPLAIN (ANALYZE, BUFFERS)` on production-sized data.

## Interview questions

**★ Walk through a list endpoint with filtering, sorting and pagination. Where is
each part unsafe?**
Filter *values* are parameters and always safe. Filter *fields*, the sort column
and the direction are identifiers and keywords — they cannot be parameters, so they
come from an allowlist and are never interpolated from input. `limit`/`offset` are
values, so they are parameters, but they must still be coerced and clamped because
a huge limit is a denial of service rather than an injection.

**★ Why would a row appear on two pages?**
Because the sort is not total. `ORDER BY` on a non-unique column leaves ties in an
unspecified order, and PostgreSQL may order them differently at different offsets.
Measured: paging 100 rows five at a time returned 54 distinct rows and 46
duplicates. Appending the primary key made it 100 and 0.

**★ Why doesn't repeating the same request reveal that bug?**
It is not per-query randomness. The measurement showed page 1 identical across two
runs; the divergence is *between offsets*, because the planner can choose a
different strategy as the offset grows. Testing one page repeatedly, or testing
with twenty rows, will not surface it.

**★ What is wrong with `LIMIT`/`OFFSET` even when the sort is total?**
Two things. Cost: `OFFSET n` generates and throws away `n` rows, so deep pages get
linearly slower. Correctness under concurrency: inserts and deletes before the
user's position shift the whole window, so they see rows twice or skip them. Keyset
pagination addresses both by remembering the last row's key.

**★ Why is returning a total count expensive, and what do you do instead?**
A filtered `count(*)` has to scan the matching rows — there is no index shortcut —
so it is frequently slower than the page query. Prefer fetching `limit + 1` rows
and returning `hasMore`; use `pg_class.reltuples` for an approximate unfiltered
count; pay for the real count only when the UI needs page numbers.

**Why must the count and page queries share a connection?**
Separate pool connections are separate sessions with separate snapshots, so a
concurrent write can make `total` inconsistent with the page returned. Running both
on one checked-out client inside a transaction gives them the same snapshot.

---

← [A repository module per resource](01-repository.md) · Next → [Safe dynamic `WHERE`](./safe-dynamic-where/)
