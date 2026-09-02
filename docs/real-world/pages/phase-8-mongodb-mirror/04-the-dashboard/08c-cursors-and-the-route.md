---
title: "aggregate() hands back a cursor rather than a promise, and the route above it has exactly one job that keeps the whole chapter's costs bounded"
sidebar_label: "21 · Cursors and the route"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`aggregate` command](https://www.mongodb.com/docs/manual/reference/command/aggregate/)
> (*"To indicate a cursor with the default batch size, specify `cursor: {}`"*;
> the `batchSize` field of the `cursor` document; and the `{batchSize: 0}` note
> about *"quickly returning a cursor or failure message without doing significant
> server-side work"*),
> [`db.collection.aggregate()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.aggregate/).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim comes from the published driver docs and the driver source on GitHub, not
> from a local declaration file.
> Contract: [Phase 3](../../phase-3-express-api/README.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The last two decisions in this chapter are small and both have a failure mode
that produces a `200 OK`. `aggregate()` returns a **cursor**, not a promise, so
forgetting to drain it serialises an object with none of your data in it. And
every cost in the twenty chunks before this one is proportional to the number of
documents the leading `$match` selects — which is a request parameter, which
means the route's clamp is the only thing standing between an admin cookie and a
full collection scan.**

## Cursor or `toArray`

`aggregate()` returns a cursor. `.toArray()` drains it into an array.

For this chapter's pipelines, `toArray()` is right: thirty daily rows, twenty
products, one facet document. **The result is bounded by the request, so
materialising it is bounded too** — and that sentence is the whole decision
rule, not a preference about style.

Iterate the cursor instead when the result is *not* bounded by the request — an
export, a backfill, a migration reading every order:

```js
for await (const doc of orders.aggregate(pipeline, {
  batchSize: 1000,
  comment: 'job:export-orders',
})) {
  await handle(doc);
}
```

`batchSize` sets the **initial** batch — the Manual describes it as the field of
the command's `cursor` document that *"specifies the size of the initial batch
size"* — and subsequent batches are sized by the `getMore` that fetches them. So it is a memory knob, not
a throughput knob: it controls how many documents the driver holds at once. The
reason to touch it is a document size far from the default's assumptions — very
wide documents want a smaller batch, tiny ones a larger.

`{batchSize: 0}` is a documented trick worth knowing: it *"indicates an empty
first batch"*, which is *"useful for quickly returning a cursor or failure message
without doing significant server-side work"*. That is how you validate that a
pipeline parses and its stages are legal without paying to run it — a cheap
smoke test for generated pipelines.

One thing you cannot stream: a `$facet` result
([chunk 14](05b-facet-limits-and-shape.md)). It is one document, so the cursor
yields one element and the driver deserialises all of it. There is no incremental
fallback when a facet grows, which is why the 16 MiB ceiling is a design
constraint rather than a tuning problem.

## Where the route sits

```js
// routes/admin/stats.js
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const {from, to} = parseRange(req.query);        // validated + CLAMPED
  res.json(await req.repos.dashboard.overview({from, to}));
});
```

The route validates and clamps the range, calls one repository function, and
serialises. It does not know there is a pipeline, does not import `mongodb`, and
never sees an `ObjectId` — which is the Phase 3 contract boundary holding, and
the gate this whole phase is written toward.

## The clamp

**Clamping the range is the route's job and it is load-bearing.** Every cost in
this chapter scales with the number of documents the leading `$match` selects,
and that number is a request parameter. An unclamped `from` is a full collection
scan available to anyone with an admin cookie — no injection, no privilege
escalation, just a date field somebody typed `1970` into.

```js
// routes/admin/parse-range.js
const MAX_RANGE_DAYS = 92;

export function parseRange(q) {
  const to   = q.to   ? new Date(q.to)   : startOfTomorrow(TZ);
  const from = q.from ? new Date(q.from) : addDays(to, -30);
  if (Number.isNaN(+from) || Number.isNaN(+to)) throw new BadRequest('bad date');
  if (from >= to) throw new BadRequest('from must precede to');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw new BadRequest('range too long');
  return {from, to};
}
```

Rejecting rather than silently truncating is deliberate: a request for a year
that quietly returns ninety-two days is a report that is wrong without saying so,
which is the failure this whole chapter has been arguing against. A `400` with a
message is a report that did not happen.

The same reasoning applies to any `n` that reaches a `$topN`
([chunk 12](04b-top-n-accumulators.md)) and to any `limit`. **Every number that
crosses the wire and ends up in a pipeline is clamped or rejected before the
pipeline is built** — because a `$limit` is applied after the work, and `$topN`'s
`n` has to be known before the group is aggregated. Neither can be bounded from
inside the pipeline.

The range that survives the clamp is also what makes the `$densify` bounds safe
([chunk 3](01c-densify-and-fill.md)): ninety-two days of daily spine is ninety-two
generated documents, nowhere near the 500,000 ceiling. Remove the clamp and the
densification becomes the thing that errors first — which is, at least, a loud
failure rather than a quiet scan.

## Gotchas

**★ `aggregate()` returns a cursor, not a promise.** Forgetting `.toArray()` and
`await`-ing the cursor gives you the cursor object, and `res.json(cursor)`
serialises an object with none of the data in it — a `200` with a shape nobody
expected and no error anywhere.

**★ `batchSize` is a memory knob, not a throughput knob.** It controls the initial
batch size and how much the driver holds at once. Raising it to "make the export
faster" usually just raises peak memory; the throughput was bounded by something
else, normally the work done per document in JavaScript.

**★ A `$facet` result cannot be streamed.** One document, one cursor element, all
of it deserialised at once. A panel design that grows toward the 16 MiB ceiling
has no incremental fallback — it works until it errors.

**★ An unclamped date range is a full scan behind an admin cookie.** Every cost in
this chapter is proportional to the documents the leading `$match` selects, and
that is user input. Clamp it in the route, along with every `limit` and every `n`.

**★ Silently truncating an over-long range is worse than rejecting it.** A request
for a year that returns ninety-two days looks like a year of data and is not. The
whole chapter is about numbers that are wrong without saying so; do not add one
in the routing layer.

**★ A default range computed in the wrong timezone shifts every bucket.** The
route's `to` defaults to "start of tomorrow" — in the *store's* zone, matching
[chunk 2's](01b-dates-money-and-the-status-set.md) `$dateTrunc` timezone. Computed
in UTC on a server in another zone, the default range and the grouping disagree
about where a day starts, and the first and last bars are partial.

**★ A cursor left undrained holds server resources until it times out.** If a
handler throws between creating a cursor and iterating it, the cursor stays open
on the server until the cursor or session timeout collects it. `toArray()` avoids
this by construction; an explicit iteration should be wrapped so that `close()`
runs on the error path.

## Interview questions

**★ When would you iterate the cursor instead of calling `toArray()`?**
When the result size is not bounded by the request. The dashboard's pipelines all
return thirty rows, twenty rows, or one facet document, so materialising them is
bounded by construction. An export or a backfill reading every order is not, and
iterating with a `batchSize` keeps the driver's in-memory set bounded. The one
case where you have no choice is `$facet`, which produces a single document and
therefore cannot be streamed at all.

**★ Where do you clamp user input in this stack, and why not in the pipeline?**
In the route, or at the top of the repository function — before the pipeline is
constructed. Every cost in the chapter is proportional to the documents the
leading `$match` selects and to any `n` an accumulator retains, and both come from
the request. Clamping inside the pipeline is not really possible: a `$limit` is
applied after the work has been done, and `$topN`'s `n` must be known before the
group is aggregated. So the bound has to be applied to the *parameter*, in
JavaScript, at the edge.

**★ Reject an over-long range or truncate it?**
Reject, with a `400` and a message naming the maximum. Truncating returns data
that answers a different question from the one asked, with no indication that it
did — which is the exact class of failure this chapter spends twenty chunks
cataloguing. The one nuance is that the maximum should be generous enough that
legitimate use never hits it, and documented in the API contract, so a client can
paginate by range rather than discovering the limit in production.

**★ What is the failure mode of forgetting `.toArray()`?**
A `200` response containing a serialised cursor object — a handful of internal
fields and none of the data. Nothing throws, because a cursor is a perfectly
valid object to `JSON.stringify`, and the type system does not object either
unless the response type is checked at the boundary. It is the same class of
silent-success failure as an unawaited promise, and it is caught by the same
thing: a response schema, or a mapper that reads named fields and produces
`undefined` for all of them.

---

← Prev: [Driver options](08b-driver-options-and-the-route.md) ·
[Overview](README.md) ·
Next chapter → **Indexes for this app's queries** *(not written yet)*
