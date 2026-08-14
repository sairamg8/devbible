---
title: "Pagination"
sidebar_label: "03 · Pagination"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Always cap `limit`. Prefer cursor pagination for large or volatile lists; offset is simpler and drifts.**

> Verified: 2026-08-14 — **no sandbox run**. Pagination is **not an Express feature**;
> there is no helper and no convention in the framework. What the docs do supply is the
> warning this page is built on: *"as `req.query`'s shape is based on user-controlled
> input, all properties and values should be validated before trusting"*
> ([request reference](https://expressjs.com/en/5x/api/request/)) — which is why `limit`
> is a cap and not a suggestion. The cost argument for deep offsets is a **database**
> property, covered with measured evidence in
> [PostgreSQL's keyset pagination pages](../../../postgresql/pages/README.md); nothing
> on this page was measured here.

## Offset

```http
GET /items?limit=20&offset=40
```

Easy, slow on deep pages, unstable if rows insert while paging.

## Cursor

```http
GET /items?limit=20&cursor=eyJpZCI6MTIzfQ
```

Stable for infinite scroll; opaque cursors hide storage details. Encode nothing
sensitive without signing/encrypting.

## Rules

1. Default `limit` (e.g. 20) and **max** (e.g. 100)  
2. Return `nextCursor` / `hasMore` consistently  
3. Never allow `limit=999999`

## Why offset drifts — the concrete failure

This is the argument that actually convinces people, and it has nothing to do with
speed:

```text
page 1: OFFSET 0  LIMIT 20   → rows 1–20
        ← someone inserts a row that sorts at position 5
page 2: OFFSET 20 LIMIT 20   → the old row 20 is now row 21
```

The user sees **row 20 twice and never sees row 40**. Nothing errored, no log line
was written, and the client cannot detect it. On a feed sorted by newest-first —
which is most feeds — inserts land at position 1, so this happens on every page
of every active list.

Cursor pagination has no such window, because the cursor names a *position in the
data* (`id > 123`), not a count of rows to skip. Rows inserted before it are
simply not in the range.

The performance argument is real too — `OFFSET 100000` makes the database walk and
discard 100 000 rows — but the correctness argument is the one that should decide
it.

## Total counts are the expensive part

`{"items": [...], "total": 48213}` looks free and is not. An exact total needs a
second query that counts every matching row, and unlike the page query it cannot
stop early. On a large filtered table that count often costs more than the page.

The options, in order of how often they are right:

1. **Don't send a total.** `hasMore: true` is enough for infinite scroll, which is
   most UIs.
2. **Send an estimate**, clearly named — `approximateTotal` — from database
   statistics.
3. **Send an exact total** only where a user genuinely reads it, and cache it.

Numbered page controls are what force exact totals. If the UI can use "load more",
you have avoided the whole problem.

## Trade-off

Cursor pagination is correct under concurrent writes and stays fast at any depth.
It costs you the ability to jump to page 47, because a cursor only knows "after
this row" — there is no arithmetic that turns a page number into one. It also
constrains sorting: the cursor must encode every column you sort on, so
user-selectable sort orders mean a cursor per order and a tie-breaker on a unique
column.

Offset gives you random access and one-line implementation, and pays with drift
and deep-page cost. **Default to cursor for feeds and large lists; offset is
defensible for a small admin table with stable data and a page picker.**

## Gotchas

**Symptom:** Users report items appearing twice or going missing while scrolling  
**Cause:** Offset pagination with concurrent inserts — the classic drift  
**Fix:** Cursor pagination keyed on a stable, unique, indexed column

**Symptom:** `?limit=1000000` takes the API down  
**Cause:** The cap was documented but not enforced  
**Fix:** Clamp server-side — `Math.min(Number(req.query.limit) || 20, 100)` — and treat
the client's value as a request, not an instruction

**Symptom:** `limit=abc` returns everything  
**Cause:** `Number('abc')` is `NaN`, and `NaN` fell through to "no limit"  
**Fix:** Validate and default explicitly. `req.query` values are strings from
user-controlled input, always

**Symptom:** Two rows with identical `createdAt` are skipped or repeated by cursor paging  
**Cause:** The cursor sorts on a non-unique column with no tie-breaker  
**Fix:** Always sort on `(sortColumn, id)` and encode both in the cursor

**Symptom:** Clients decode the cursor and start constructing their own  
**Cause:** A base64 cursor that is transparently `{"id":123}` — base64 is not opacity  
**Fix:** Sign it if forging matters, and document it as opaque. Anything a client can
build, a client will build, and then you can never change the format

## Interview questions

**★ Why cap limit?**  
Protects DB and API CPU from accidental or malicious full-table pulls.

**Offset vs cursor trade-off?**  
Offset: simple, deep-page pain. Cursor: stable, more implementation work.

**★ Beyond speed, what is actually wrong with offset pagination?**  
It is incorrect under concurrent writes. A row inserted before your position shifts
everything down, so the next page repeats one row and skips another — silently, with
no error the client can detect. On newest-first feeds this happens constantly.

**★ Why can cursor pagination not offer "jump to page 47"?**  
Because a cursor is a position in the data, not a count. There is no way to turn a
page number into "after row X" without counting rows — which is the operation cursors
exist to avoid.

**What must a cursor encode when the sort column is not unique?**  
The sort column *and* a unique tie-breaker, usually the primary key. Without it, rows
sharing a value straddle the boundary and get skipped or duplicated.

**Why is returning a total count more expensive than the page itself?**  
The page query stops after `limit` rows; an exact count cannot stop at all. Prefer
`hasMore`, or a clearly-labelled estimate, unless a user really reads the number.


---

← Prev: [Status mapping](02-status-mapping.md) · Next → [Filter sort search](04-filter-sort-search.md)
