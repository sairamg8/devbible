---
title: "Every panel in a $facet shares one 16 MiB document, and every branch comes back as an array even when it holds exactly one row"
sidebar_label: "14 · $facet limits and shape"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)
> (*"The maximum BSON document size is 16 mebibytes"*; *"Starting in MongoDB 6.0,
> the `allowDiskUseByDefault` parameter controls whether pipeline stages that
> require more than 100 megabytes of memory to execute write temporary files to
> disk by default"*),
> [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/),
> [`$count`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/count/).
> `mongodb` is **not** installed in this repo's `node_modules`, so the driver
> claims come from the published driver docs and the driver source on GitHub, not
> from a local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 13](05-facet-and-one-round-trip.md) built the four-panel dashboard in one
stage and dealt with the two structural costs — no index if the stage is first,
and a list of stages that cannot appear inside it. This chunk is the third cost
and the one that reaches the API layer: `$facet` emits exactly one document
containing every panel, so the 16 MiB document ceiling applies to their *sum*,
and every branch is an array regardless of how many rows it holds. The first fact
decides which panels may share a facet; the second decides what the unwrapping
code in the repository has to look like.**

## The 16 MiB ceiling applies to the whole result

> *"The maximum BSON document size is 16 mebibytes."*
> — [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)

`$facet` emits **one document** containing every sub-pipeline's array. So the
limit is not per panel; it is on the sum. Four panels of thirty rows each is
nothing. One panel that forgot its `$limit` and returns every product is what
takes the whole response over the edge — and it takes the other three panels down
with it, because they are in the same document.

Every sub-pipeline that can return an unbounded number of rows needs a `$limit`
**inside the branch**, and "it only returns twenty today" is a property of the
data, not of the query. The branches in
[chunk 13](05-facet-and-one-round-trip.md) all end in either a `$group` on a
bounded key — a day within the requested range, a fixed five-element status set —
or an explicit `$limit`.

The rule that falls out: **`$facet` is for panels, not for pages.** A paginated
list of orders does not belong in a facet with the summary, because its row count
is a request parameter and the ceiling is not.

Note this is a different limit from the per-stage one, and they fail differently:

| Limit | Applies to | On exceeding |
|---|---|---|
| **16 MiB** | the one document `$facet` emits | the aggregation errors |
| **100 MB** | each stage's working memory | spills to disk, or errors, per `allowDiskUseByDefault` |

So a facet can be well under the memory threshold and still fail on output size,
and it can be well under 16 MiB of output and still exhaust a stage. Neither
number protects against the other.

## The page-and-count idiom, and its one caveat

The other classic `$facet` use is getting a page of results and the total count
in one pass:

```js
{$facet: {
  rows:  [{$sort: {createdAt: -1}}, {$skip: skip}, {$limit: 20}],
  total: [{$count: 'n'}],
}},
```

One round trip, and the count is over exactly the documents the page was drawn
from — which is the property the two-query version cannot guarantee, because
between the two queries an order can be written.

Two caveats for this app.

**The `total` branch counts the documents that reached the `$facet`.** So the
`$match` above it must be exactly the list's filter. That is true when the facet
has one purpose; it stops being true the moment somebody adds a fifth branch that
needs a wider `$match` and widens the shared one to accommodate it. The count is
then silently a count of something else, and there is nothing in the code that
says so.

**The catalog deliberately does not use this.**
[02·02](../02-the-catalog/02-keyset-pagination.md) paginates by keyset and answers
"is there a next page" with `limit + 1`, because a `$count` over the filtered set
costs more than the page it describes and grows with the collection while the
page does not. The `$facet` page-and-count idiom is for admin screens where a
total row count is a stated requirement — and it is worth being explicit that
the requirement is what justifies the cost, not the elegance of the one-stage
spelling.

`{$count: 'n'}` is a stage that emits a single document `{n: <number>}`, or —
and this is the part that catches people — **no document at all when the input is
empty**. So `total` is `[]`, not `[{n: 0}]`, on an empty result set.

## What the driver hands back

```js
const [dashboard] = await orders.aggregate(pipeline).toArray();
// dashboard.statusCounts is an array of 0 or 1 documents
// dashboard.overview     is an array of 0 or 1 documents
```

`$facet` always emits exactly one document, so `.toArray()` returns a one-element
array — but each *branch* is an array, including the branches that group to a
single document. `overview` is `[{orders: 12, revenueCents: 4599}]`, not
`{orders: 12, revenueCents: 4599}`, and on a range with no matching orders it is
`[]` — because `{$group: {_id: null, …}}` over an empty stream emits nothing.

So the API layer has to unwrap, and it has to unwrap defensively:

```js
// db/mongo/dashboard.js
export async function dashboard(db, {from, to}) {
  const [f] = await db.collection('orders')
    .aggregate(dashboardPipeline({from, to})).toArray();
  return {
    statusCounts: f.statusCounts[0]
      ?? Object.fromEntries(STATUSES.map(s => [s, 0])),
    overview:     f.overview[0] ?? {orders: 0, revenueCents: 0},
    revenueByDay: f.revenueByDay,          // densified: always full length
    topProducts:  f.topProducts,           // may legitimately be []
  };
}
```

`f.overview[0].revenueCents` without the guard is the crash that happens on the
first quiet night after launch — and it happens in the *admin* dashboard, which
is the screen nobody has an alert on.

Note the asymmetry between the four branches, because it is the useful part:
`revenueByDay` needs no default because
[the densification](01c-densify-and-fill.md) guarantees its length; `topProducts`
needs no default because an empty list is a valid empty list; the two
single-document branches need defaults because "no rows" and "zeroes" are
different things and only the API knows which one the panel wants.

## Gotchas

**★ The 16 MiB limit is on the whole facet document, not per branch.** One
unbounded branch breaks every panel in the same response. Give every branch that
can grow an explicit `$limit`, and treat "it is small today" as an observation
rather than a guarantee.

**★ 16 MiB and 100 MB are different limits with different failure modes.** The
output-size limit errors; the per-stage memory threshold spills to disk or errors
depending on `allowDiskUseByDefault`. Staying under one says nothing about the
other, and `allowDiskUse: true` does not raise the document ceiling.

**★ A branch that returns one document still returns an array.**
`overview[0]` on an empty range is `undefined`. Every single-document branch
needs a default in the unwrapping code, and the default has to be the same shape
the panel renders — an object of zeroes, not `null`.

**★ Branch results are arrays even when empty, but the facet document itself is
never absent.** `aggregate(...).toArray()` returns exactly one element, always —
so `if (!rows.length)` never fires and cannot be used as an "empty result" check.
The emptiness lives one level down, per branch, and has to be tested there.

**★ `{$count: 'n'}` emits nothing on an empty input.** Not `{n: 0}` — no
document. So the `total` branch of a page-and-count facet is `[]` on an empty
result set, and `total[0].n` is the same crash in a different costume. The guard
is `total[0]?.n ?? 0`.

**★ The count branch counts what reached the `$facet`, not what the page
filtered.** If any branch needs a wider shared `$match`, the count silently
becomes a count of the wider set. The safe form is to keep the shared `$match`
identical to the list's filter and give the divergent branch its own inner
`$match` — accepting that the inner one is not index-served.

**★ `$skip` inside a facet branch has all of offset pagination's problems and
one extra.** It re-walks the skipped documents like any `$skip`, and it does so
over an in-memory stream that was already materialised by the shared `$match` —
so deep pages are expensive twice. This is the reason the storefront catalog uses
keyset pagination and the admin list can afford not to.

**★ A facet result is one BSON document, so the driver deserialises all of it at
once.** There is no streaming a facet: `.toArray()` on a facet cursor is one
document, and cursor iteration gives you that same one document. A panel design
that grows toward the ceiling has no incremental fallback — it works until it
errors.

## Interview questions

**★ Where does the 16 MiB limit apply in a `$facet`, and how do you design against
it?**
To the single output document, which contains every branch's result array — so
the ceiling is on the sum of all panels, not on any one. Design against it by
giving every branch a bound: a `$group` on a key whose cardinality is bounded by
the request, such as a day within a thirty-day range, or an explicit `$limit`.
And keep paginated lists out of facets entirely, because their row count is a
request parameter rather than a property of the query.

**★ Why does `overview[0]` need a default but `revenueByDay` does not?**
Because they become empty for different reasons and only one of those reasons is
prevented. `overview` is a `$group` on `_id: null`, which emits no document when
its input stream is empty — a range with no revenue orders produces `[]`.
`revenueByDay` runs through `$densify` with explicit bounds, so it emits one
document per requested day regardless of the data; its length is a property of
the request. The general form of the question is "can this branch's output be
empty for a reason the client would misread as an error", and the answer differs
per branch.

**★ The page-and-count facet returns a total that is too large. What is the most
likely cause?**
The shared `$match` above the `$facet` is wider than the list's filter — usually
because another branch needed more documents and someone widened the shared stage
rather than adding an inner `$match` to that branch. The `total` branch counts
everything that reached the facet, so it now counts the wider set while the rows
branch shows the narrower one. The fix is an inner `$match` on the branch that
diverged, accepting that it is not index-served.

**★ Is a `$facet` ever the wrong way to get a page and a count?**
Yes, whenever the count is not actually required. It costs a full traversal of
the filtered set to produce a number that most UIs use only to render "of 1,247"
— and that traversal grows with the collection while the page does not. The
storefront answers "is there more" with `limit + 1`, which costs one extra
document. Use the facet where a true total is a stated requirement, and be able
to say who requires it.

**★ How would you stream a large faceted result?**
You cannot. `$facet` produces one BSON document, so there is nothing to stream —
the cursor yields a single element and the driver deserialises the whole thing.
That is the structural reason the ceiling is a hard design constraint rather than
a tuning knob: there is no incremental fallback when a panel grows. A result that
needs streaming needs to be its own pipeline, without the facet, returning many
documents.

---

← Prev: [`$facet`](05-facet-and-one-round-trip.md) ·
[Overview](README.md) ·
Next → [`$lookup`, and why mostly you don't](06-lookup-and-why-mostly-you-dont.md)
