---
title: "Row constructors and tuple comparison"
sidebar_label: "20 · Tuple comparison"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**`(a, b) > ($1, $2)` compares two rows lexicographically, like comparing words. It
is the primitive that makes keyset pagination both correct and index-friendly, and
it replaces a three-way `OR` that no index can serve well.**

## How it compares

```console
$ node ex14-crud.mjs
=== 13. row constructors / tuple comparison ===
(1,'b') < (1,'c') → true | (2,'a') < (1,'z') → false
```

Left to right, stopping at the first difference — dictionary order. `(2,'a')` is not
less than `(1,'z')` because the first element already decides it, exactly as
"ba" > "az".

The expansion you would otherwise write by hand:

```sql
-- these are equivalent
WHERE (created_at, id) > ($1, $2)

WHERE created_at > $1
   OR (created_at = $1 AND id > $2)
```

Two columns need one `OR`; three need three; four need six. The tuple form stays one
expression regardless, and it is the form the planner understands best.

## Why keyset pagination needs it

`OFFSET` degrades linearly and shifts under concurrent writes
([`LIMIT`/`OFFSET`](03-limit-offset.md)). Keyset pagination remembers the last row's
sort key instead of counting rows:

```sql
SELECT user_id, at FROM c_events
 WHERE (at, user_id) > ($1, $2)
 ORDER BY at, user_id
 LIMIT 20;
```

```console
keyset predicate plan: Limit  (cost=1.11..1.12 rows=2 width=18)
┌─────────┬─────────┬──────────────────────────┐
│ (index) │ user_id │ at                       │
├─────────┼─────────┼──────────────────────────┤
│ 0       │ 1       │ 2026-01-03T00:00:00.000Z │
│ 1       │ 2       │ 2026-01-04T00:00:00.000Z │
│ 2       │ 2       │ 2026-01-05T00:00:00.000Z │
└─────────┴─────────┴──────────────────────────┘
```

The cursor is the last row's `(at, id)`, passed back as `$1, $2` on the next request.
The database seeks straight to that position in the index rather than counting past
rows, so **page 500 costs the same as page 1**.

Three requirements, all of which must line up:

1. **The tuple, the `ORDER BY` and the index must use the same columns in the same
   order.** `(at, user_id)` in all three. Any mismatch and the planner falls back to
   a sort.
2. **The last column must be unique**, or the sort is not total and rows can repeat
   across pages — measured in
   [`list` with filtering, sorting and pagination](../phase-9-api-crud/02-list-endpoint.md)
   as 46 duplicates in 100 rows.
3. **Direction must be consistent.** `>` with `ORDER BY … ASC`, `<` with `DESC`.

## The NULL trap

```console
(1,NULL) < (1,2) → null ← NULL in a row constructor gives NULL
```

A NULL anywhere in the tuple makes the comparison unknown, and `WHERE` discards
unknown — so **pagination silently stops** at the first row whose cursor column is
NULL, or skips rows entirely.

Only paginate on `NOT NULL` columns. If the sort column is genuinely nullable, either
sort on a `COALESCE` expression with a matching expression index, or add a
`NOT NULL` sentinel column for ordering.

## Mixed directions do not work

The tuple operator applies one direction to the whole row. This is *not* expressible
as a tuple:

```sql
ORDER BY created_at DESC, id ASC
```

There is no `(a, b)` comparison matching mixed directions, so you must write the
expanded `OR` form — or, more usefully, avoid the situation. Since `id` is only a
tiebreaker, `ORDER BY created_at DESC, id DESC` is equally correct for pagination and
*is* expressible:

```sql
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Match the index: `CREATE INDEX ON events (created_at DESC, id DESC)`. A btree can be
scanned backwards, so a plain `(created_at, id)` index also serves this — but the
explicit form makes the intent obvious and matters when the directions genuinely
differ.

## Other uses for row constructors

```sql
-- multi-column IN
WHERE (user_id, tag_id) IN ((1, 5), (2, 7));

-- multi-column upsert target, and joins on composite keys
WHERE (a.order_id, a.product_id) = (b.order_id, b.product_id);

-- did anything actually change? (null-safe, whole row at once)
WHERE (new.name, new.email) IS DISTINCT FROM (old.name, old.email);
```

That last form is genuinely useful in triggers and `DO UPDATE … WHERE` clauses:
`IS DISTINCT FROM` on a row constructor is null-safe across every column at once,
which is far shorter than pairing each column with `IS DISTINCT FROM` by hand.

`ROW(a, b)` is the explicit spelling; `(a, b)` is shorthand and identical, except
that a single-element row needs `ROW(a)` because `(a)` is just parentheses.

## Encoding the cursor

The client must round-trip both values. Do not send them as separate query
parameters that a caller can mix and match — pass one opaque token:

```js
const encode = (row) => Buffer.from(JSON.stringify([row.created_at, row.id])).toString('base64url');
const decode = (cur) => JSON.parse(Buffer.from(cur, 'base64url').toString());
```

Opaque because the pair is an implementation detail: changing the sort order changes
the cursor's meaning, and a client that constructed its own would break. It is *not*
a security boundary — base64 is not encryption — so never put anything sensitive in
it, and validate the decoded types before binding them as parameters.

## Trade-off

Keyset pagination is constant-cost at any depth and stable under concurrent inserts.
It costs the ability to jump to an arbitrary page: there is no "page 47" because the
database never counted. You get next/previous, and that is all.

So: `OFFSET` for admin screens with numbered pages over modest data, keyset for
infinite scroll, public APIs, exports and anything a crawler will walk to the end of.
The choice is about the UI you are building, not about which is "better".

## Gotchas

**Symptom:** Keyset pagination stops early or skips rows
**Cause:** A NULL in the cursor tuple makes the comparison unknown — measured,
`(1,NULL) < (1,2)` is `null`.
**Fix:** Only paginate on `NOT NULL` columns, or sort on a `COALESCE` expression with
a matching index.

**Symptom:** The keyset query is slow despite an index
**Cause:** The tuple columns, the `ORDER BY` and the index do not match in order or
direction.
**Fix:** Make all three identical.

**Symptom:** Rows appear on two pages
**Cause:** The last tuple column is not unique, so the sort is not total.
**Fix:** End the tuple with the primary key.

**Symptom:** Mixed `DESC`/`ASC` cannot be expressed as a tuple
**Cause:** The row operator applies one direction to the whole row.
**Fix:** Use the same direction for the tiebreaker, or write the expanded `OR` form.

**Symptom:** A hand-expanded `OR` form is slower than expected
**Cause:** The planner handles the tuple form better than an equivalent `OR` chain.
**Fix:** Use the tuple form where directions allow.

**Symptom:** A client-built cursor breaks after a sort-order change
**Cause:** The cursor's meaning is tied to the sort.
**Fix:** Treat it as an opaque token the server issues and parses.

**Symptom:** `(a)` does not build a one-column row
**Cause:** `(a)` is grouping parentheses.
**Fix:** `ROW(a)`.

## Interview questions

**★ What does `(a, b) > ($1, $2)` mean?**
Lexicographic comparison — left to right, stopping at the first difference, like
comparing words. Measured: `(1,'b') < (1,'c')` is true, `(2,'a') < (1,'z')` is false.
It is equivalent to `a > $1 OR (a = $1 AND b > $2)` but stays one expression as
columns are added, and the planner handles it better.

**★ Why is it the basis of keyset pagination?**
Because the database can seek directly to that position in a matching index instead
of counting and discarding rows the way `OFFSET` does — so page 500 costs the same as
page 1, and concurrent inserts cannot shift the window.

**★ What must line up for it to be fast?**
The tuple columns, the `ORDER BY` and the index must use the same columns in the same
order and direction, and the final column must be unique so the sort is total.
Otherwise you get a sort, or rows repeating across pages.

**★ What happens if a cursor column is NULL?**
The whole comparison is unknown, and `WHERE` discards unknown — measured,
`(1,NULL) < (1,2)` returns `null`. Pagination silently stops or skips. Only paginate
on `NOT NULL` columns.

**★ What does keyset pagination give up?**
Arbitrary page numbers. Nothing counted the rows, so there is no "jump to page 47" —
only next and previous. Use `OFFSET` when the UI needs numbered pages over modest
data, keyset for infinite scroll and public APIs.

**Why should the cursor be opaque?**
Its meaning is tied to the current sort order, so a client that builds its own breaks
when that changes. Encode it server-side. Note base64 is encoding, not encryption —
never put anything sensitive in it, and validate the decoded values before binding
them.

---

← [`VALUES` and `unnest`](19-values-unnest.md) · Next → [Phase 5 · Joins and set operations](../phase-5-joins/)
