---
title: "The cursor round trip: hydrating the value, carrying the sort, and making a mismatched cursor fail loudly"
sidebar_label: "3 · The cursor round trip"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/),
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/),
> [ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/),
> [`$sort`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/) —
> and the published cursor contract in
> [Phase 3·05](../../phase-3-express-api/05-catalog-endpoints.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The keyset predicate in [chunk 2](02-keyset-pagination.md) compares a stored
value against a value that arrived as base64 from the client — which means the
cursor's payload has to come back out of JSON as the same BSON type it went in
as, and JSON cannot do that on its own. A number survives; a `Date` becomes a
string and the resumed query matches nothing, silently ending the list. The fix
is to hydrate on decode according to the sort the cursor was minted for, which
forces the sort's name into the cursor — and that turns "a cursor is only valid
for the query that minted it" from a rule the client is asked to honour into one
the server can enforce.**

## The failure the round trip causes

`encodeCursor` JSON-stringifies the pair. For `priceCents` that is a number and
survives cleanly. For a **date** sort key it does not:

```js
JSON.stringify({v: someDate});     // → {"v":"2026-08-14T09:12:00.000Z"}
JSON.parse(that).v;                // → a string, not a Date
```

The resumed query then compares a *string* against a BSON *date*, and because
BSON compares across types by
[a documented type ordering](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
rather than by coercion, the predicate matches nothing. There is no error. The
list simply stops, one page early, and looks like the end of the catalog.

The catalog's current sorts are `_id` and `priceCents`, so this is latent rather
than live — which is exactly why it is worth writing down now, because the first
person to add a `created_desc` sort will not be looking for it.

## The codec

```js
// db/mongo/cursor.js — the whole round trip, in one file
import {ObjectId} from 'mongodb';

export class BadCursorError extends Error {
  constructor() { super('invalid cursor'); this.code = 'BAD_CURSOR'; }
}

export const encodeCursor = ({value, id, sort}) =>
  Buffer.from(JSON.stringify({v: value, i: id.toHexString(), s: sort}))
    .toString('base64url');

// one entry per sort in SORTS — adding a sort without adding a row here
// is a 400 on page two, which is the failure you want
const HYDRATE = {
  newest:     () => null,                 // the id IS the value
  price_asc:  (v) => typeof v === 'number' ? v : (() => {throw new BadCursorError();})(),
  price_desc: (v) => typeof v === 'number' ? v : (() => {throw new BadCursorError();})(),
  // created_desc: (v) => new Date(v),    ← the shape a date sort would need
};

export function decodeCursor(str) {
  if (!str) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(str, 'base64url').toString());
  } catch { throw new BadCursorError(); }

  if (typeof parsed.i !== 'string' || typeof parsed.s !== 'string') {
    throw new BadCursorError();
  }
  const hydrate = HYDRATE[parsed.s];
  if (!hydrate) throw new BadCursorError();

  try {
    return {value: hydrate(parsed.v), id: new ObjectId(parsed.i), sort: parsed.s};
  } catch { throw new BadCursorError(); }
}
```

Three decisions in there.

**`HYDRATE` is keyed by the same names as `SORTS`.** That is deliberate coupling:
a new sort that forgets its hydrator produces `BadCursorError` on page two rather
than a subtly wrong page, and the developer meets the requirement immediately.
Two parallel maps that must stay in step is a smell, and the honest alternative
is one map with both the sort spec and the hydrator on each entry — worth doing
if a third parallel map ever appears.

**The hydrators validate as well as convert.** `price_asc` refuses a non-number
rather than coercing it, because a coercion turns a tampered cursor into a valid
query over a range the user chose. This is [chunk 1's](01-the-filter-document.md)
type rule applied to the one input that does not pass through the request schema.

**Everything failed is `BadCursorError`.** The route maps it to
`400 BAD_CURSOR`, the code the contract already publishes, and the client's
recovery is the same in every case: drop the cursor and restart the list.
Distinguishing "bad base64" from "unknown sort" would only give a tamperer a
progress meter.

## The sort in the cursor makes the rule enforceable

Phase 1 stated that cursors are valid only for the exact filter and sort that
minted them, and left it to the client:

> *"the cursor object deliberately doesn't encode filters, so reuse across
> filters is a client bug by contract."*
> — [Phase 1·04](../../phase-1-database/04-the-catalog-query.md)

Encoding the sort makes half of that a server check. A cursor minted under
`price_asc` and replayed under `price_desc` now fails with a clean 400 instead of
returning a page that is plausible and wrong:

```js
// in listProducts, after decoding
if (cursor && cursor.sort !== sort) throw new BadCursorError();
```

The other half — the *filters* — stays a client obligation, and deliberately.
Encoding the filter set would make the cursor large, would leak the filter
vocabulary to anyone who base64-decodes it, and would have to be kept in step
with every new facet. The sort is a closed set of three names; the filter space
is open. **Enforce what is cheap to enforce and document the rest** — and the 400
on a sort mismatch is what makes the client bug visible the first time it
happens, which is the actual value.

## What a deleted anchor does — and why it is fine

A reasonable worry: the cursor names a specific document, so what happens when
that document is deleted between pages?

Nothing bad, and the reason is worth internalising because it is the whole
advantage of keyset over `skip`. The predicate is not "resume at document X"; it
is `(priceCents, _id) > (1999, ObjectId(…))` — a comparison against *values*. If
the anchor document is gone, the comparison still describes exactly the same
point in the ordering, and the next page begins with whatever now sits after it.
No repeats, no holes.

`skip(n)` cannot say that. It counts documents, so a delete anywhere earlier in
the ordering shifts every subsequent page by one and the user loses an item they
never saw. The soft-delete policy makes this rarer in practice — soft-deleted
products stay in the collection and are filtered out by
`{deletedAt: null}` — but the guarantee does not depend on it.

## Gotchas

**★ A `Date` in the cursor becomes a string and the list silently ends.** The
list stops one page early and looks like the end of the catalog, so it is
reported as "we only have 24 products" rather than as a pagination bug. Every
non-primitive sort key needs an explicit hydrator, and the way to guarantee that
is for a missing hydrator to be a hard 400.

**★ Coercing rather than validating in a hydrator hands the user a range
filter.** `Number(v)` on a tampered cursor silently accepts `"9e99"`, and the
page resumes from a boundary the client chose. It is not a serious exploit here —
the products are public — but it is the same reflex that becomes one on any
cursor over private data. Hydrators refuse; they do not repair.

**★ Encoding the sort but forgetting to compare it is worse than not encoding
it.** The cursor now carries a field that looks like a safety mechanism and is
not checked, which is exactly the sort of thing a later reader trusts. The
one-line comparison and the hydrator lookup are two separate checks and both are
needed: the hydrator catches an *unknown* sort, the comparison catches a *valid
but different* one.

**★ `next_cursor` is `null` on the last page, and `null` must be published.** The
contract has the field on every response. A mapper that omits it when null
changes the response shape and breaks a strict client — and the JavaScript that
does this is `if (c) obj.next_cursor = c`, which reads like defensive
programming.

**★ `encodeCursor` on a document missing the sort key produces `{v: undefined}`,
which `JSON.stringify` drops.** The decoded cursor then has no `v` at all, and
`hydrate(undefined)` either throws or returns something wrong depending on the
hydrator. This cannot happen while the validator requires `priceCents`, and it is
the failure mode waiting for the first optional sort key — so the decoder checks
for the field's presence, not merely its type.

**★ Base64url, not base64.** A `+` or `/` in a standard-base64 cursor has to be
percent-encoded in a query string, and something in the chain will eventually
fail to do it — a hand-written client, a log-replay tool, a copy-pasted URL.
`base64url` produces no characters that need escaping, which is why both Phase 3
and this codec specify it.

## Interview questions

**★ Why does the cursor carry the name of the sort?** Because the cursor's
`value` has to come back out of JSON as the BSON type the query will compare
against, and JSON does not carry types — a number survives, a `Date` does not.
The decoder therefore needs to know which sort minted the cursor in order to
hydrate the value correctly. Once the sort is in there, a second property falls
out for free: a cursor minted under one sort and submitted under another can be
rejected with a clean 400 instead of returning a plausible wrong page, which
turns a client obligation into a server check.

**★ Why encode the sort but not the filters?** Cost and closure. The sort is a
closed set of three names, one short string, and comparing it is one line. The
filter space is open — every new facet adds to it — so encoding it would make the
cursor grow, would have to be maintained forever, and would leak the filter
vocabulary to anyone who decodes the payload. The general rule: enforce the part
that is cheap and closed, document the part that is not, and make sure the
documented part fails visibly (a wrong page after a filter change is visible;
the Phase 4 hook resets the cursor precisely because of it).

**★ The document a cursor points at is deleted. What happens on the next page?**
Nothing goes wrong, because the cursor is a *value comparison*, not a position.
`(priceCents, _id) > (1999, …)` describes a point in the ordering that continues
to exist whether or not any document sits exactly on it, so the next page begins
with whatever now follows that point — no repeats, no holes. This is precisely
what `skip(n)` cannot do: it counts documents, so any delete earlier in the
ordering shifts every later page and the user silently loses an item.

**★ A tester reports that the catalog "only has 24 products" after a new
`created_desc` sort shipped. Where do you look?** At the cursor's hydration. A
date sort key JSON-stringifies to an ISO string and comes back as a string, so
the resumed predicate compares a string against a BSON date, matches nothing, and
the second page is empty — which the UI renders as the end of the list. The
diagnostic is to decode the cursor by hand and check the type of `v`; the fix is
a hydrator entry, and the structural fix is that a missing hydrator should have
been a 400 rather than a silent pass.

**★ Would you sign the cursor?** Not for this data — the products are public and
a forged cursor can only reach a page the user could have paged to. The moment a
cursor encodes anything the server imposes rather than accepts — a tenant, a
permission scope, an admin-only filter — a forged cursor becomes privilege
escalation, and the change is an HMAC verified in `decodeCursor` before parsing.
That it would be a change to one function, in one file, is the strongest
practical argument for having put the codec here rather than inline in a route.

---

← Prev: [Keyset pagination](02-keyset-pagination.md) ·
[Overview](README.md) ·
Next → [Search](03-search.md)
