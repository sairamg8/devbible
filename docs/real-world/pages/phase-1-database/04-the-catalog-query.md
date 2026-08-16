---
title: "The catalog query"
sidebar_label: "04 · The catalog query"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (row comparison,
> `EXPLAIN`, collations) and the
> [PostgreSQL joins and aggregation phases](../../../postgresql/pages/phase-5-joins/README.md).

## The problem

The busiest query in the app: the product list, filtered by category and price,
sorted by price or recency, paginated — and the spec says it stays fast at
100k products. One query shape serves the storefront grid, the category pages
and the admin table, so this chapter designs it once, properly.

## The design choices

**Keyset pagination, not `OFFSET`.** `OFFSET 9800 LIMIT 24` *reads and
discards* 9,800 rows every time — page depth costs linearly, and rows shifting
underneath (a product deleted mid-browse) makes pages skip or repeat items.
Keyset ("give me products after this one") reads only the 24 rows it returns,
at any depth, stably. The cost is honest and worth naming: **no "jump to page
17"** — only next/previous. The storefront's infinite scroll (Phase 4) never
wanted page numbers anyway; the admin table (which does) gets a bounded
`OFFSET` because admins never paginate past a search.

**The cursor is the full sort key plus the id.** Sorting by price alone cannot
resume unambiguously — fifty products cost 19.99. The keyset must be
`(sort_column, id)`: the id breaks ties, and the same pair is the `ORDER BY`.
This is the invariant everything below maintains: **cursor = order by = index**
(chapter 10 builds the matching indexes).

**Filters compose in SQL, dynamically but parameterized.** The query is built
from the filters actually present — never by string-interpolating values
([the injection rule](../../../nodejs/pages/phase-6-data-access/02-parameterized-queries.md)),
only by assembling *clauses* from a fixed set with `$n` placeholders.

## The implementation

```js
// db/products.js — the catalog read used by Phase 3's GET /products
const SORTS = {
  newest: {column: 'created_at', dir: 'desc'},
  price_asc: {column: 'price_cents', dir: 'asc'},
  price_desc: {column: 'price_cents', dir: 'desc'},
};

export async function listProducts(pool, {
  categorySlug, minCents, maxCents, sort = 'newest', cursor, limit = 24,
} = {}) {
  const s = SORTS[sort];
  if (!s) throw new RangeError(`unknown sort: ${sort}`);

  const where = ['p.deleted_at is null'];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (categorySlug) add('c.slug = ?', categorySlug);
  if (minCents != null) add('p.price_cents >= ?', minCents);
  if (maxCents != null) add('p.price_cents <= ?', maxCents);

  if (cursor) {
    // resume strictly after (sort value, id) — row comparison does both at once
    const op = s.dir === 'asc' ? '>' : '<';
    params.push(cursor.value, cursor.id);
    where.push(
      `(p.${s.column}, p.id) ${op} ($${params.length - 1}, $${params.length})`,
    );
  }

  params.push(limit + 1); // one extra row = "has next page"
  const {rows} = await pool.query(
    `select p.id, p.name, p.slug, p.price_cents, p.stock,
            p.${s.column} as sort_value,
            (select object_key from product_images i
              where i.product_id = p.id order by i.position limit 1) as cover
       from products p
       join categories c on c.id = p.category_id
      where ${where.join(' and ')}
      order by p.${s.column} ${s.dir}, p.id ${s.dir}
      limit $${params.length}`,
    params,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: hasMore ? {value: last.sort_value, id: last.id} : null,
  };
}
```

What to notice, in the order it bites:

- **`sort` indexes into a fixed table.** The column and direction come from
  `SORTS`, never from the request — the one part of a query you cannot
  parameterize is an identifier, so identifiers never come from users.
- **Row comparison `(a, b) > ($1, $2)`** is the standard-SQL spelling of
  "after this keyset" and Postgres evaluates it index-compatibly. The
  hand-expanded `a > $1 or (a = $1 and b > $2)` is equivalent but easier to
  get subtly wrong per direction.
- **`limit + 1`** answers "is there a next page" without a second `count(*)`
  query — the count would cost more than the page.
- **The cover image is a correlated subquery**, not a join — a join would
  multiply product rows by their images and force a `distinct on`. One image
  per product is the shape the page needs, so the query says exactly that.
- **`deleted_at is null`** anticipates chapter 11's soft delete; the filter
  is in the base `where` from day one so no caller can forget it.

The `cursor` travels to the client base64-encoded (Phase 3 encodes it); the
database layer deals only in `{value, id}`.

## Using it in the app

`GET /products` (Phase 3) validates query params with zod and passes them
straight in; the React infinite list (Phase 4) feeds `nextCursor` back as the
observer fires. `EXPLAIN ANALYZE` on every variant of this query, with the
indexes that serve them, is chapter 10's opening exercise.

## Gotchas

- **Symptom:** pages repeat or skip items when sorting by price. **Cause:**
  the cursor carried only the price — ties are unresumable. **Fix:** the
  invariant above: the id is part of the sort, the cursor and (chapter 10)
  the index. All three or none.
- **Symptom:** `invalid input syntax` or worse when a new sort option was
  added by interpolating `req.query.sort`. **Cause:** identifier from user
  input. **Fix:** the `SORTS` allow-list is the only path from request to
  column name — extending sorts means extending the table, nowhere else.
- **Symptom:** the query is fast on page one and slow deep in — with keyset
  pagination, which was supposed to fix that. **Cause:** the `order by`
  doesn't match an index (mixed directions, or a filter forcing a re-sort),
  so Postgres sorts the whole result before applying the limit. **Fix:**
  chapter 10 — the index must match `(filter, sort_column, id)` in the same
  direction pattern; `EXPLAIN` shows `Index Scan` vs `Sort` immediately.
- **Symptom:** `nextCursor` is `null` but the client shows a "load more" that
  fetches an empty page. **Cause:** client cached a stale cursor across a
  filter change — cursors are only valid for the exact filter+sort they came
  from. **Fix:** Phase 4's hook resets the cursor whenever any filter changes;
  the cursor object deliberately doesn't encode filters, so reuse across
  filters is a client bug by contract.

## Interview questions

1. **★ Why is `OFFSET` pagination slow and unstable, and what does keyset
   change?** `OFFSET n` must produce and throw away `n` rows — the database
   does the work of every earlier page again. And because it counts *current*
   rows, any insert or delete shifts the boundary: users see repeats or
   holes. Keyset resumes from a value, not a position: cost is one index
   descent regardless of depth, and concurrent writes can't shift what
   "after product 4291 at 19.99" means.
2. **★ Why must the pagination cursor include the id?** Sort columns have
   ties. Resuming "after price 1999" either re-reads every 1999 row or skips
   them all, depending on the comparison — both wrong. `(price, id)` is
   totally ordered, so "after (1999, 4291)" is exactly one boundary.
3. **Why `limit + 1` instead of `select count(*)`?** The count scans
   everything the filters match — potentially the whole catalog — to answer a
   boolean. One extra fetched row answers the same question for the price of
   one row. When the UI genuinely needs a total (the admin table), that is a
   separate, deliberately budgeted query.
4. **How do you add a "relevance" sort for search results to this shape?**
   Search ranking (`ts_rank`) is computed, not stored, so the keyset value is
   the computed rank — which is not stable across data changes. Chapter 05's
   answer: search results paginate by `(rank, id)` accepting slight drift, or
   cap search at N pages — and the honest trade-off is stated there.
5. **Why does the function take a `pool`, not create its own client?** Query
   functions are the composition unit — the checkout transaction (chapter 06)
   passes a *transaction client* into the same-shaped functions. Owning the
   connection would make them untransactable. The
   [data-layer chapter](../README.md) makes this the phase-wide rule.

---

← Prev: [Seed data and fixtures](03-seeds-and-fixtures.md) ·
Next → [Full-text product search](05-full-text-search.md)
