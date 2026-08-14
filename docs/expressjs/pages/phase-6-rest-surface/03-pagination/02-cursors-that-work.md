---
title: "Cursors that work"
sidebar_label: "02 · Cursors that work"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**A cursor is a position in a total order. Every failure of cursor pagination
comes from the order not actually being total — a non-unique sort column, a
changed sort, or a cursor that outlived the row it named.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The `Link`
> header form is [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html), and
> `res.links` appends to an existing `Link` rather than replacing it — read from
> `express@5.2.1`'s `lib/response.js` in `sandbox/express-verify/node_modules/`
> ([Phase 4 · 02 · chunk 02](../../phase-4-responses/02-status-and-headers/02-headers-and-timing.md)).
> The keyset-query cost argument is a **database** property, with measured
> evidence in [PostgreSQL's pages](../../../../postgresql/pages/README.md); nothing
> here was measured. The cursor design is **this bible's guidance**.

## The invariant

A cursor works if and only if the sort defines a **total order** — no two rows
compare equal. Then "after this row" is unambiguous and the query is a range
scan:

```sql
SELECT * FROM orders
WHERE (created_at, id) < ($1, $2)     -- the cursor, as a tuple
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

🔴 **The tie-breaker is not optional.** Sorting on `created_at` alone, with two
rows sharing a timestamp, means the boundary between pages falls *inside* a group
of equal values — and which of them the database returns first is not defined. So
one row is skipped and another repeated, exactly as with offset drift, and it
happens only under the specific data that produces a tie. **Always sort on
`(sortColumn, id)` and encode both.**

Note the **tuple comparison** rather than `created_at < $1 OR (created_at = $1
AND id < $2)`. They are equivalent, and the tuple form is both shorter and more
likely to use a composite index — which is the other half of why cursors stay
fast at depth.

## What goes in a cursor

```js
const encode = (row) => Buffer.from(JSON.stringify({c: row.created_at, i: row.id})).toString('base64url');
```

| Include | Why |
|---|---|
| every sort column's value | that is what "after this row" means |
| the unique tie-breaker | the invariant above |
| the sort direction, or a sort id | so a cursor from one ordering cannot be used with another |
| a version tag | so you can change the cursor format later and reject old ones cleanly |

**Do not include** the offset, the page number, the total, or any filter values —
if filters are re-sent by the client on each request, a cursor that also encodes
them can disagree with them, and now you have two sources of truth.

🔴 **base64 is not opacity.** A client *will* decode `eyJpZCI6MTIzfQ`, discover
it is `{"id":123}`, and start constructing cursors. Then the format is a public
API you can never change.

Two defences, and they are for different problems:

- **Sign it** (an HMAC over the payload) if a forged cursor is a
  problem — which it is when the cursor encodes anything the client should not
  choose, such as a tenant scope.
- **Document it as opaque and version it**, so when you do change the format,
  old cursors get a clean `400 INVALID_CURSOR` rather than a confusing result.

**Never put a filter or a scope in a cursor without signing it.** A cursor
carrying `{"orgId": 42}` that the client can edit is an authorization bypass with
a friendly name.

## Where the cursor goes in the response

Two conventions, and they are not exclusive:

```json
{
  "data": [ … ],
  "page": {"next": "eyJjIjoi…", "hasMore": true, "limit": 20}
}
```

```http
Link: </orders?cursor=eyJjIjoi…&limit=20>; rel="next"
```

```js
res.links({next: `${req.baseUrl}?cursor=${next}&limit=${limit}`});
```

**The body is what most clients actually read**; the `Link` header is the
standard (RFC 8288) and what generic tooling understands. Sending both costs
almost nothing. Note `res.links` **appends**, so pagination links coexist with
any other relations — and `res.set('Link', …)` twice would silently discard the
first.

**Send the full URL, not just the token.** A client that has to assemble
`?cursor=` onto a base it remembers is a client that will get it wrong, and
handing over the URL is the one piece of hypermedia that always pays for itself
([Phase 6 · 11](../11-hypermedia.md)).

## `hasMore` without an extra query

Ask for one more row than you need and throw it away:

```js
const rows = await orders.page({cursor, limit: limit + 1});
const hasMore = rows.length > limit;
const data = hasMore ? rows.slice(0, limit) : rows;
```

That is one query, no count, and an exactly-correct `hasMore`. It is the standard
trick and it is worth knowing because the alternatives — a second `COUNT`, or
inferring from a short page — are respectively expensive and wrong (a full page
that happens to be the last one would report `hasMore: true`, which is merely
ugly, but a *filtered* query can return a short page with more rows behind it).

## The three failures that still happen

**1 · The row the cursor names was deleted.** With a tuple comparison this is
harmless — `(created_at, id) < ($1, $2)` does not require that row to exist, it
just needs a position. An implementation that looks the row up first breaks here.

**2 · The client changes the sort mid-scroll.** The cursor encodes a position in
the *old* order and is meaningless in the new one. Encode the sort in the cursor
and reject a mismatch with a `400`, rather than returning plausible nonsense.

**3 · Backwards pagination.** `prev` needs the comparison reversed *and* the
`ORDER BY` reversed, then the result reversed again in application code. It is
easy to get wrong and it is why many APIs are forward-only — which is a
legitimate choice to make explicitly rather than by omission.

## Trade-off

Cursor pagination is correct under concurrent writes and fast at any depth. The
costs are real and worth stating plainly:

- **No random access.** "Page 47" cannot be expressed. If the product needs it,
  cursors are the wrong tool.
- **Sorting is constrained.** Every user-selectable sort order needs its own
  cursor encoding and its own composite index, so "sort by any column" and
  "cursor pagination" pull against each other.
- **More implementation.** Encoding, decoding, versioning, the `+1` trick, and a
  tie-breaker on every query — against `OFFSET n`.
- **Harder to debug by hand.** An opaque token is opaque to you too, which is an
  argument for a small internal tool that decodes them.

**Default to cursor for feeds and large lists**, and be honest that a
numbered-page admin screen is a different requirement rather than a worse one.

## Gotchas

**Symptom:** Two rows with identical `createdAt` are skipped or repeated
**Cause:** The cursor sorts on a non-unique column with no tie-breaker, so the
page boundary falls inside a group of equal values
**Fix:** Sort on `(sortColumn, id)` and encode both

**Symptom:** Clients decode the cursor and start constructing their own
**Cause:** A base64 cursor that is transparently `{"id":123}` — base64 is not
opacity
**Fix:** Sign it if forging matters, and version it so the format can change.
Anything a client can build, a client will build

**Symptom:** A user paginates into another tenant's data
**Cause:** The cursor encoded a scope the client could edit
**Fix:** Never put a scope or filter in an unsigned cursor. Scope from the
authenticated principal on every query
([Phase 8 · 08](../../phase-8-validation-authz/08-tenant-and-logout.md))

**Symptom:** Changing the sort order mid-scroll returns nonsense
**Cause:** The cursor is a position in the previous ordering
**Fix:** Encode the sort in the cursor and reject a mismatch with 400

**Symptom:** Pagination breaks when the row a cursor names is deleted
**Cause:** The implementation looks the row up to build the comparison
**Fix:** Compare against the encoded values directly — a tuple comparison needs a
position, not a row

**Symptom:** The last page reports `hasMore: true`
**Cause:** `hasMore` inferred from `rows.length === limit`
**Fix:** Fetch `limit + 1` and discard the extra

**Symptom:** Only the `next` link survives when another middleware also sets
`Link`
**Cause:** `res.set('Link', …)` replaces
**Fix:** `res.links(...)`, which appends

## Interview questions

**★ Why can cursor pagination not offer "jump to page 47"?**
Because a cursor is a position in the data, not a count. There is no way to turn
a page number into "after row X" without counting rows — which is exactly the
operation cursors exist to avoid.

**★ What must a cursor encode when the sort column is not unique?**
The sort column **and** a unique tie-breaker, normally the primary key. Without
it the page boundary falls inside a group of equal values, and which of them the
database returns first is undefined — so rows are skipped or duplicated, exactly
as with offset drift.

**★ Why is base64 not enough to make a cursor opaque?**
Because it is trivially decoded, so clients will read it, then construct their
own, and the format becomes a public API you can never change. Sign it if forging
matters, version it so you can migrate, and document it as opaque.

**★ How do you compute `hasMore` without a second query?**
Request `limit + 1` rows and discard the extra. One query, no count, and exactly
correct — where inferring from a full page is wrong for filtered queries that can
return a short page with more behind it.

**What should never go in a cursor?**
Anything the client must not choose — a tenant id, a filter that grants scope.
An editable cursor carrying a scope is an authorization bypass. Scope always comes
from the authenticated principal.

**Where should the next-page link live?**
Both places: in the response body, which is what most clients read, and in an RFC
8288 `Link` header, which is the standard and what generic tooling understands.
Send the full URL rather than the bare token, and use `res.links` so it appends
rather than replacing.

---

← Prev: [Offset and its drift](01-offset-and-its-drift.md) · Index: [Pagination](README.md) · Next topic → [Filter, sort, search](../04-filter-sort-search.md)
