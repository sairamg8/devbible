---
title: "Offset and its drift"
sidebar_label: "01 · Offset and its drift"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Offset pagination is not merely slow on deep pages — it is *incorrect* under
concurrent writes, silently, with no error the client can detect. That is the
argument that should decide it.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Pagination is
> **not an Express feature**: there is no helper and no convention in the
> framework. What the docs do supply is the warning this topic is built on —
> *"as `req.query`'s shape is based on user-controlled input, all properties and
> values should be validated before trusting"*
> ([request reference](https://expressjs.com/en/5x/api/request.html)) — which is
> why `limit` is a cap and not a suggestion. **The deep-offset cost argument is a
> database property**, covered with measured evidence in
> [PostgreSQL's keyset pagination pages](../../../../postgresql/pages/README.md);
> nothing on this page was measured here. The recommendations are this bible's.

## The two shapes

```http
GET /items?limit=20&offset=40
GET /items?limit=20&cursor=eyJpZCI6MTIzfQ
```

Offset is easy, slow on deep pages, and unstable if rows are inserted while
paging. Cursor is stable for infinite scroll and hides storage details behind an
opaque token.

## Why offset drifts — the concrete failure

This is the argument that actually convinces people, and it has nothing to do
with speed:

```text
page 1: OFFSET 0  LIMIT 20   → rows 1–20
        ← someone inserts a row that sorts at position 5
page 2: OFFSET 20 LIMIT 20   → the old row 20 is now row 21
```

The user sees **row 20 twice and never sees row 40**. Nothing errored, no log
line was written, and the client cannot detect it.

🔴 **On a newest-first feed — which is most feeds — every insert lands at
position 1**, so this happens on every page of every active list, continuously.
The reverse also holds: a **delete** shifts rows the other way, so a page skips
an item entirely.

Cursor pagination has no such window, because the cursor names a *position in the
data* (`id > 123`), not a count of rows to skip. Rows inserted before it are
simply not in the range.

The performance argument is real too — `OFFSET 100000` makes the database walk
and discard 100,000 rows before returning any — but the correctness argument is
the one that should decide it.

## Where offset is still fine

Being fair to it, because "always use cursors" is over-strong:

- **A stable dataset.** A reference table, a completed report, an export snapshot
  — nothing is being inserted, so there is no drift.
- **A UI with numbered pages.** If the product genuinely needs "jump to page 47",
  cursors cannot express it and offset is the honest choice.
- **Small totals.** A hundred rows, three pages. The drift window exists and
  nobody will ever hit it.
- **An admin tool** with one user and a page picker.

**Default to cursor for feeds and large lists; offset is defensible for a small
admin table with stable data and a page picker.** What is *not* defensible is
offset on a public, high-traffic, newest-first list, which is where it is most
often found.

## Total counts are the expensive part

`{"items": [...], "total": 48213}` looks free and is not. An exact total needs a
second query that counts every matching row, and **unlike the page query it
cannot stop early**. On a large filtered table that count often costs more than
the page it accompanies.

The options, in order of how often they are right:

1. **Do not send a total.** `hasMore: true` is enough for infinite scroll, which
   is most UIs.
2. **Send an estimate**, clearly named — `approximateTotal` — from database
   statistics.
3. **Send an exact total** only where a user genuinely reads it, and cache it.

**Numbered page controls are what force exact totals.** If the UI can use "load
more", you have avoided the whole problem — which makes this a product decision
with a database bill attached, and worth raising as one.

## Capping `limit`

```js
const limit = Math.min(Number(req.query.limit) || 20, 100);
```

Three failures that one line prevents, and one it does not:

- **`?limit=1000000`** — a valid integer with no upper bound is a
  denial-of-service that passes every type check
  ([Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)).
- **`?limit=abc`** — `Number('abc')` is `NaN`, `NaN` is falsy, so `|| 20` catches
  it. Without the `||`, `LIMIT NaN` is a query error at best.
- **`?limit=-5`** — 🔴 **`Math.min` does not catch this.** `Math.min(-5, 100)` is
  `-5`, and a negative limit is either an error or, in some drivers, "no limit".
  Clamp both ends: `Math.min(Math.max(n, 1), 100)`, or let a schema do it with
  `.int().min(1).max(100)`
  ([Phase 8 · 03](../../phase-8-validation-authz/03-coercion-traps.md)).
- **`?limit=&limit=50`** — a repeated key is an **array** on the default query
  parser, so `Number(['','50'])` is `NaN`. The `|| 20` saves you again, but only
  by accident; a schema that rejects arrays is the real answer
  ([Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md)).

**Treat the client's value as a request, not an instruction**, and put the cap in
the documented contract so a client asking for 500 knows it will get 100.

## Trade-off

Cursor pagination is correct under concurrent writes and stays fast at any depth.
It costs you the ability to jump to page 47, because a cursor only knows "after
this row" — there is no arithmetic that turns a page number into one. It also
constrains sorting: the cursor must encode every column you sort on, so
user-selectable sort orders mean a cursor per order and a tie-breaker on a unique
column ([chunk 02](02-cursors-that-work.md)).

Offset gives you random access and a one-line implementation, and pays with drift
and deep-page cost.

## Gotchas

**Symptom:** Users report items appearing twice or going missing while scrolling
**Cause:** Offset pagination with concurrent inserts — the classic drift
**Fix:** Cursor pagination keyed on a stable, unique, indexed column

**Symptom:** `?limit=1000000` takes the API down
**Cause:** The cap was documented but not enforced
**Fix:** Clamp server-side, and treat the client's value as a request

**Symptom:** `?limit=abc` returns everything
**Cause:** `Number('abc')` is `NaN`, and `NaN` fell through to "no limit"
**Fix:** Validate and default explicitly. `req.query` values are strings from
user-controlled input, always

**Symptom:** `?limit=-1` behaves strangely or errors deep in the driver
**Cause:** `Math.min(n, max)` clamps only the upper end
**Fix:** Clamp both, or use a schema with `.min(1).max(100)`

**Symptom:** The list endpoint's latency is dominated by a `COUNT(*)`
**Cause:** An exact total on a large filtered table, which cannot stop early
**Fix:** `hasMore`, or a labelled estimate. Exact totals are a product
requirement with a bill

**Symptom:** Page 3,000 times out while page 3 is fast
**Cause:** `OFFSET 60000` makes the database walk and discard those rows
**Fix:** Cursors. And note that nobody legitimately browses to page 3,000 — deep
offsets are usually a scraper

## Interview questions

**★ Beyond speed, what is actually wrong with offset pagination?**
It is incorrect under concurrent writes. A row inserted before your position
shifts everything down, so the next page repeats one row and skips another —
silently, with no error the client can detect. On newest-first feeds this happens
constantly, because every insert lands at position 1.

**★ Why cap `limit`?**
Because a valid integer with no upper bound is a denial-of-service that passes
every type check. It protects the database and the API from accidental and
malicious full-table pulls, and the cap belongs in the documented contract so a
client asking for 500 knows what it will get.

**★ What does `Math.min(Number(req.query.limit) || 20, 100)` miss?**
Negative values — `Math.min(-5, 100)` is `-5`. It also only survives
`?limit=abc` and a repeated `?limit=` by accident, via the `||`. A schema with
`.int().min(1).max(100)` handles all of them deliberately.

**★ Why is returning a total count more expensive than the page itself?**
The page query stops after `limit` rows; an exact count cannot stop at all. On a
large filtered table it often costs more than the page. Prefer `hasMore`, or a
clearly-labelled estimate, unless a user genuinely reads the number.

**When is offset pagination still the right choice?**
Stable data, small totals, or a UI that genuinely needs numbered pages — cursors
cannot express "jump to page 47". An admin table with a page picker is a
reasonable use; a public newest-first feed is not.

**What forces you into exact totals?**
Numbered page controls. If the product can use "load more" instead, the whole
problem disappears — which makes it a product decision with a database cost
attached.

---

Index: [Pagination](README.md) · Next → [Cursors that work](02-cursors-that-work.md)
