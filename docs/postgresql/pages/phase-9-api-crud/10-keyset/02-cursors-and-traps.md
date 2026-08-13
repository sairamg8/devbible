---
title: "Cursors and the traps"
sidebar_label: "02 · Cursors and traps"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex43-keyset-patch.mjs`.

**The tuple comparison is the easy half.** What breaks keyset pagination in
production is the cursor's encoding, a sort order the tuple form cannot express,
and a nullable column that silently ends the walk early.

## Encoding the cursor

The cursor is the last row's sort key. Clients should not be able to read or
construct one, because it is an internal detail you will want to change:

```js
const encode = (row) =>
  Buffer.from(JSON.stringify([row.created_at.toISOString(), String(row.id)]))
    .toString('base64url');

const decode = (cursor) => {
  const [createdAt, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  return {createdAt: new Date(createdAt), id};
};
```

Three requirements that are easy to miss:

- **`base64url`, not `base64`.** A cursor goes in a query string, and `+` and `/`
  are not URL-safe. `base64url` uses `-` and `_`.
- **The timestamp must round-trip exactly.** `toISOString()` keeps milliseconds;
  a format that truncates them makes the cursor land in the wrong place among rows
  that share a second. PostgreSQL's `timestamptz` holds microseconds, so if your
  timestamps have sub-millisecond precision, send the value back as the string
  PostgreSQL gave you rather than through a JavaScript `Date`.
- **`id` as a string.** It is a `bigint`, and `JSON.parse` on a large id loses
  precision — [Rows to domain objects](../01-repository/02-rows-to-domain.md).

Base64 is encoding, not security. Anyone can decode it. If a cursor must not be
forgeable — because it encodes a tenant or a filter — sign it.

## The response shape

```js
const rows = await repo.page(db, {cursor, limit});
const hasMore = rows.length > limit;              // fetched limit + 1
const items = hasMore ? rows.slice(0, limit) : rows;

res.json({
  items: items.map(toDomain),
  nextCursor: hasMore ? encode(items.at(-1)) : null,
});
```

**Fetch `limit + 1` rows and return `limit`.** That extra row is how you know
whether another page exists, and it costs one row instead of the `count(*)` that
the [list endpoint](../02-list-endpoint.md) shows is often slower than the page
query itself. `nextCursor: null` is the end of the collection.

## Mixed sort directions

The row constructor encodes **one direction for the whole tuple**. `(a, b) < (x, y)`
means "descending on both". A sort that mixes directions cannot use it:

```console
$ node ex43-keyset-patch.mjs
=== 9. the traps: mixed directions and a nullable sort column ===
ORDER BY created_at DESC, id ASC with the tuple form:
  ids: 4998,9998,14998,19998,24998
  hand-written comparison for the same order:
  ids: 4997,9997,14997,19997,24997
  same? false
↑ (a,b) < (x,y) means "DESC on both"; a mixed sort needs the expanded form
```

Different rows. The tuple form produced *plausible* output — twenty rows, correctly
ordered, no error — and it is the wrong page. This is the worst kind of bug in this
area: nothing fails, the page just quietly skips and repeats rows.

For `ORDER BY created_at DESC, id ASC` the comparison has to be written out:

```sql
WHERE created_at < $1 OR (created_at = $1 AND id > $2)
ORDER BY created_at DESC, id ASC
```

which, from [the previous chunk](01-the-tuple-comparison.md), is the form that
becomes a `Filter` rather than an `Index Cond` — so it is correct and slow.

The way out is an index that makes the mixed order into a consistent one:

```sql
CREATE INDEX ON k_events (created_at DESC, id ASC);
```

With that index the planner has a contiguous range for the mixed sort and can seek.
**The rule: if you need a mixed-direction keyset, build the index to match it.**
Better still, avoid mixed directions — the tiebreaker column exists to make the
sort total, and it can point the same way as the leading column without changing
what users see.

## Nullable sort columns

```console
nullable sort column: comparison matched 250000 of 500000 rows
↑ every row with a NULL key is silently excluded — the page walk stops early
```

Half the table was invisible. Any comparison against `NULL` is `NULL`, which is
not true, so rows with a `NULL` sort key never satisfy the `WHERE` and can never
appear on a page after the first.

Worse, the first page *does* include them, because it has no `WHERE` clause at all —
so the bug looks like "rows disappear after page 1".

There are three fixes and only one of them is good:

1. **Make the column `NOT NULL`.** A pagination key that can be missing is not a
   pagination key. This is nearly always available: `created_at` should have
   `DEFAULT now() NOT NULL`.
2. **Sort on a coalesced expression** — `coalesce(archived_at, 'infinity')` — and
   build the index on that same expression. Correct, and it costs an expression
   index.
3. **Add `NULLS LAST` and handle the null group separately** with a second
   predicate. Correct, and it makes every query harder to read.

`ORDER BY ... NULLS LAST` on its own does *not* fix it. It changes where the nulls
sort, not whether the comparison matches them.

## When `OFFSET` is still right

Keyset is not free, and it is not always faster:

```console
=== 8. paging right through, keyset vs OFFSET ===
  50 pages of 20 (deepest offset    980):  keyset    62 ms   OFFSET    55 ms   0.9x
 500 pages of 20 (deepest offset   9980):  keyset   382 ms   OFFSET  2430 ms   6.4x
2000 pages of 20 (deepest offset  39980):  keyset  1779 ms   OFFSET 10524 ms   5.9x
```

**At 50 pages `OFFSET` was slightly faster.** Its query is simpler, there is no
cursor to decode, and at an offset of 980 the rows it discards are almost free. The
crossover here is a few hundred pages; past that keyset wins by 6× and the gap
keeps growing with depth while keyset stays flat.

So the decision is about how deep users actually go:

| Use | Because |
|---|---|
| Admin table with page numbers, 20 pages | `OFFSET` — shallow, and the UI needs page numbers |
| Infinite scroll / feed | keyset — no page numbers needed, depth unbounded |
| Public API listing a collection | keyset — consumers walk the whole thing |
| Export or sync job | keyset — deepest access pattern there is |
| Anything a crawler can reach | keyset — crawlers page deeply and in parallel |

## Stability, and what keyset does *not* fix

Keyset is stable against inserts and deletes elsewhere in the collection: the
cursor names a *position in the sort order*, so a row inserted before it does not
shift the window. `OFFSET` cannot do this — a row inserted before the user's
position shifts everything by one and they see a row twice.

What keyset does not fix is a row whose **sort key changes** while a client is
paging. Ordering by `updated_at` and then updating a row moves it in the sequence,
so it can be seen twice or missed. Order by something immutable — `created_at`, or
the primary key — when the collection is paged over time.

## Trade-off

The cursor becomes part of your API contract. Clients store it, some persist it,
and it encodes the sort key — so changing the default sort order invalidates every
cursor in the wild. Versioning the cursor payload (a leading version byte) costs
nothing now and is the only thing that makes that change survivable later.

Against that, keyset removes an entire class of production incident: the endpoint
that is fine until a crawler walks it to page 20 000. The cost is paid once at
implementation; the `OFFSET` cost is paid on every deep request forever.

## Gotchas

**Symptom:** Rows disappear after the first page
**Cause:** The sort column is nullable; comparisons against `NULL` are never true,
so those rows can only appear on page 1. Measured: 250 000 of 500 000 rows
excluded.
**Fix:** Make the key `NOT NULL`, or sort and index on a coalesced expression.

**Symptom:** Pages skip and repeat rows with no error, on a mixed sort
**Cause:** `(a, b) < ($1, $2)` means descending on both, so it does not match
`ORDER BY a DESC, b ASC`. Measured: different ids from the correct query.
**Fix:** Write the comparison out and index `(a DESC, b ASC)` to match — or avoid
mixing directions.

**Symptom:** `NULLS LAST` did not fix the missing rows
**Cause:** It changes where nulls sort, not whether the `WHERE` comparison matches
them.
**Fix:** As above — the predicate is the problem, not the ordering.

**Symptom:** Cursors break in a query string
**Cause:** Plain `base64` contains `+` and `/`.
**Fix:** `base64url`.

**Symptom:** The page starts one row off, occasionally
**Cause:** The timestamp lost precision round-tripping through the cursor.
**Fix:** Preserve full precision, or send back the exact string PostgreSQL
returned.

**Symptom:** A client's saved cursor returns nonsense after a deploy
**Cause:** The default sort order changed, so the cursor describes a position in a
sequence that no longer exists.
**Fix:** Version the cursor payload and reject old versions explicitly.

**Symptom:** Rows are seen twice while paging a feed
**Cause:** Ordering by `updated_at`, which changes under the client.
**Fix:** Order by an immutable key.

## Interview questions

**★ What goes in a cursor, and how do you encode it?**
The sort key of the last row returned — here `created_at` and `id`. Encode as
`base64url` because it travels in a query string, keep full timestamp precision so
it lands in the right place, and keep the `bigint` id as a string. Base64 is not
security; sign the cursor if it must not be forgeable.

**★ How does the client know there is another page?**
Fetch `limit + 1` rows and return `limit`. The presence of the extra row is
`hasMore`, and it costs one row rather than a `count(*)` over the whole predicate.

**★ Why can't the tuple form express `ORDER BY a DESC, b ASC`?**
Because `(a, b) < ($1, $2)` is a single lexicographic comparison — one direction
for the whole tuple. Against a mixed sort it silently returns the wrong page:
measured, plausible-looking rows that differed from the correct query. You need
the written-out comparison, plus an index on `(a DESC, b ASC)` to keep it fast.

**★ What happens if the sort column is nullable?**
Rows with a `NULL` key vanish after page 1 — the first page has no `WHERE` clause
so it includes them, and every later page's comparison against `NULL` is never
true. Measured: 250 000 of 500 000 rows excluded. `NULLS LAST` does not help; make
the column `NOT NULL` or sort on a coalesced expression.

**★ Is keyset always faster than `OFFSET`?**
No. Measured over a 500 000-row table: at 50 pages `OFFSET` was marginally faster
(0.9×) because its query is simpler and shallow offsets discard almost nothing. At
500 pages keyset was 6.4× faster, and the gap grows with depth while keyset stays
flat. Choose by how deep users actually page.

**What does keyset not protect against?**
A row whose sort key changes while a client pages — ordering by `updated_at` lets
a row move and be seen twice or missed. Order by something immutable.

---

← [The tuple comparison](01-the-tuple-comparison.md) · Next → [Idempotent writes](../11-idempotent-writes.md)
