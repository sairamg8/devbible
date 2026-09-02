---
title: "The cursor decoder, and the boundary rules that let every other route survive untouched"
sidebar_label: "7 · The cursor & the boundary"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/),
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) — the
> **`bson` package's** `ObjectId` constructor behaviour on invalid input, and the
> published contract in
> [Phase 3·05](../../phase-3-express-api/05-catalog-endpoints.md) and
> [3·09](../../phase-3-express-api/09-the-error-contract.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The second place the swap presses on Phase 3 is the pagination cursor — and it
is the more interesting of the two, because the contract was already right and
the *implementation* leaked. Phase 3 declared the cursor opaque, base64-encoded
it, and then decoded it in the route file with an assertion that the id inside is
a JavaScript number. Opacity enforced against clients but not against the server
is not opacity. This chunk fixes it by moving the codec one layer down, then
states the four boundary rules that keep every other route in the API completely
untouched.**

## The break

```js
// Phase 3, src/routes/catalog.js — as published
export const decodeCursor = (s) => {
  if (!s) return undefined;
  try {
    const {value, id} = JSON.parse(Buffer.from(s, 'base64url').toString());
    if (typeof id !== 'number') throw new Error();          // ← this line
    return {value, id};
  } catch { throw new ApiError(400, 'BAD_CURSOR', 'invalid cursor'); }
};
```

The wire format is unchanged by the mirror — still base64url, still opaque to
clients, still a clean 400 on garbage. But `typeof id !== 'number'` is a
server-side assertion **about the database's key type**, sitting in the HTTP
layer, and on MongoDB every cursor fails it.

The resulting bug is a nasty shape: page one is served correctly, `next_cursor`
comes back populated, and page two returns `400 BAD_CURSOR`. Health checks pass,
the product grid loads, and only infinite scroll is broken — so it reaches
production through any test suite that checks the first page of a list.

## The fix: the codec belongs to whoever mints the cursor

```js
// db/mongo/cursor.js — the data layer mints and parses its own cursors
import {ObjectId} from 'mongodb';

export class BadCursorError extends Error {
  constructor() { super('invalid cursor'); this.code = 'BAD_CURSOR'; }
}

export const encodeCursor = (c) =>
  c ? Buffer.from(JSON.stringify({v: c.value, i: c.id.toHexString()}))
        .toString('base64url')
    : null;

export function decodeCursor(s) {
  if (!s) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(s, 'base64url').toString());
  } catch { throw new BadCursorError(); }

  if (typeof parsed.i !== 'string' || typeof parsed.v === 'undefined') {
    throw new BadCursorError();
  }
  try {
    return {value: parsed.v, id: new ObjectId(parsed.i)};    // throws on bad hex
  } catch { throw new BadCursorError(); }
}
```

```js
// Phase 3, src/routes/catalog.js — the amendment: pass the string through
router.get('/', validate({query: ListProductsQuery}), async (req, res) => {
  const q = req.valid.query;
  const page = await catalog.list({
    categorySlug: q.category, minCents: q.min_cents, maxCents: q.max_cents,
    sort: q.sort, cursor: q.cursor, limit: q.limit,      // opaque, unopened
  });
  res.set('cache-control', 'public, max-age=30');
  res.json({
    items: page.items.map(productSummary),
    next_cursor: page.nextCursor,                        // already a string
  });
});
```

`BadCursorError` maps to `400 BAD_CURSOR` through
[the error contract](../../phase-3-express-api/09-the-error-contract.md) exactly
as `ApiError` did, so the wire behaviour on a tampered cursor is identical. **The
published contract is byte-identical; the seam moved one layer down, where it
always belonged.**

Like the `order_id` change, this is an amendment the PERN implementation benefits
from independently: a cursor's structure is the data layer's business, and the
HTTP layer knowing that ids are numbers is precisely the leak that "opaque
cursor" existed to prevent. Phase 1's rule was **cursor = order by = index**;
this adds the corollary that *the layer that owns the index owns the cursor.*

⚠️ Reported, not made — Phase 8 does not own that file.

## The four boundary rules

Everything else in the API survived, and it survived because of four rules that
are worth stating as rules rather than as observations.

**1 · ObjectIds become strings at the edge, and only at the edge.** One
conversion point in each direction, in the data layer:

```js
const toId = (s) => {                        // request → database
  try { return new ObjectId(s); }
  catch { throw new NotFoundError(); }        // malformed id is a 404, not a 500
};
const fromId = (o) => o.toHexString();        // database → response
```

`new ObjectId(badString)` throws. Unhandled, `/orders/banana` is a 500 with a
stack trace instead of a 404. This is the direct analogue of Postgres answering
`invalid input syntax for type bigint`, and it needs the same treatment: convert
at the boundary, and map the failure to the status the *resource* deserves rather
than the status the parser deserves.

**2 · Ownership lives in the query filter.** `findOne({_id, userId})`, never
`findOne({_id})` followed by a comparison. Guessable keys make this
non-negotiable, and an unmatched filter returning `null` routes naturally into
the 404 the contract already specifies — no extra branch, no extra error type,
and no early `return` that can skip the check.

**3 · One mapper per response shape, and the mapper reads domain field names.**
`productSummary` reads `p.slug`, `p.name`, `p.price_cents`, `p.stock`, `p.cover`.
The Mongo repository renames `priceCents` to `price_cents` in its projection,
exactly as the SQL version renamed columns in its select list, and the mapper
cannot tell the difference. This is the single design decision that let a storage
swap touch two files instead of twenty.

**4 · The repository returns domain objects, never driver objects.** No
`Cursor`, no `WithId`, no `ObjectId` above the data layer. The rule is inherited
from [Phase 2's data layer](../../phase-2-node-services/02-the-data-layer.md),
where it was written as "no `pg.Result` escapes" — the same rule, and the reason
it was worth writing down then is that it is what is being cashed in now.

## Gotchas

**★ `new ObjectId(str)` throws, and what it throws is not an `ApiError`.** Every
path that accepts an id from a URL, a body or a cursor needs the wrapper above.
Beyond the 500, the operational symptom is that any scanner probing your URLs
generates error-log noise indistinguishable from a real fault, which is how a
genuine incident gets missed.

**★ `new ObjectId(12)` does not throw.** The constructor accepts several input
forms, so a numeric or 12-byte-string input produces *an* ObjectId rather than an
error — which means a validation layer that only catches the throw will pass
values it should have rejected. Validate the input as a 24-character hex string
in the request schema ([Phase 3·02](../../phase-3-express-api/02-the-validation-boundary.md))
and let the constructor be the second line of defence, not the first.

**★ Do not "helpfully" widen the cursor decoder to accept both numbers and
strings.** A decoder that accepts either will happily consume a cursor minted by
the other stack and return an empty page or a wrong one. Cursors are valid only
for the exact query that minted them — Phase 1's rule — and a strict decoder is
what turns a mismatch into a clean 400 rather than a silently wrong result set.

**★ Encoding `value` without normalising it re-creates the same class of bug.**
The cursor's `value` is a price (a number) for price sorts and a date for recency
sorts. `JSON.stringify` turns a `Date` into an ISO string, and `JSON.parse` does
not turn it back — so the resumed query compares a string against a BSON date and
matches nothing. [Chapter 02](../02-the-catalog/README.md) handles this by
re-hydrating `value` according to the sort key the cursor was minted for, and the
general rule is that *a cursor must carry enough to be decoded unambiguously*.

**★ A base64 cursor is not signed, and this chunk does not make it one.** A
client can decode, alter and re-encode it. That is acceptable here — the worst
outcome is a page of products the user could have reached anyway — and it is
*not* acceptable the day a cursor encodes anything the user should not choose,
such as a tenant id or a filter the server was supposed to impose. If that day
comes, the cursor gains an HMAC, and the place to add it is this codec, which is
another argument for it living in one file.

**★ `next_cursor` is `null` when the page is the last one, and `null` is not the
same as absent.** The contract publishes the field on every response; a mapper
that omits it when null changes the shape and breaks a strict client. The Mongo
repository returns `null`, the route passes it through, and nothing conditionally
deletes it.

## Interview questions

**★ Phase 3 declared the cursor opaque. Why did it break anyway?** Because
"opaque" was enforced against clients and not against the server. The base64
envelope stopped clients from constructing cursors, but the *decoder* lived in
the route file and asserted `typeof id === 'number'` — an assumption about the
database's key type, embedded in the HTTP layer. Opacity has to run in both
directions: the layer that mints a cursor is the only layer entitled to know
what is inside it. Moving the codec into the data layer keeps the wire format
identical while making the internals genuinely private, which is what the design
claimed all along.

**★ What is the general rule this chapter extracts about API contracts and
storage swaps?** Every layer that knows the shape of a key is a layer the swap
has to touch. Phase 3 survived almost intact because it made three portable
decisions — slugs in public URLs, ownership in the filter, one mapper per
response — and it needed amending in exactly the two places where key knowledge
had leaked upward. The generalisation is that portability is not an abstraction
layer you add; it is the *absence of type knowledge above the data layer*, and
the only reliable way to find out where it leaked is to attempt the swap.

**★ Why is a malformed id a 404 rather than a 400?** Because the client asked for
a resource and no such resource exists — which is what 404 means — and because
the alternative leaks information. Distinguishing "that id is malformed" (400)
from "that id is well-formed but not yours" (404) tells an attacker which of
their guesses are structurally valid. Collapsing both to 404 costs a little
debuggability and removes an oracle. The exception is the cursor, which is 400
because it is a *parameter* the client controls and got wrong, not a resource it
asked for.

**★ The cursor is unsigned base64. When does that become a security problem, and
what changes?** The moment the cursor encodes something the user is not entitled
to choose. Today it holds a sort value and an id, both of which the user could
reach by paging normally, so tampering buys nothing. If a future cursor carried a
tenant id, a permission scope, or a filter the server imposes rather than
accepts, a forged cursor would be privilege escalation. The change is an HMAC
over the payload, verified in `decodeCursor` before parsing — one function, which
is the strongest practical argument for keeping the codec in exactly one file
rather than inline in a route.

**★ Someone suggests replacing the cursor with `skip`/`limit` because "MongoDB
has skip and it is simpler". What do you say?** The same thing Phase 1 said about
`OFFSET`: `skip(n)` must produce and discard `n` documents, so cost grows
linearly with depth and concurrent inserts make pages repeat or drop items. The
document model changes nothing about that argument. What *does* change is the
implementation of the alternative — MongoDB has no row-value comparison, so the
keyset predicate has to be written out by hand as an `$or`, which
[chapter 02](../02-the-catalog/README.md) does. Harder to write is not a reason
to accept a worse algorithm.

---

← Prev: [Ids and the contract](05-ids-and-the-api-contract.md) ·
[Overview](README.md) ·
Next → [Constraints that vanish](06-constraints-that-vanish.md)
