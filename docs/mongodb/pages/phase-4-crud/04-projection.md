---
title: "Projection"
sidebar_label: "04 · Projection"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Project Fields to Return from Query](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/):
> inclusion and exclusion projections, the rule that **you cannot mix inclusion and exclusion
> in a single query** with the one exception that `_id` may be suppressed in an inclusion
> projection, `{_id: 0}` to suppress the default `_id`, and dot notation for embedded fields —
> and
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/) for the
> `PROJECTION_COVERED` stage and `totalDocsExamined`.
> **Documentation-validated; no console blocks.**

```js
db.orders.find({ status: "open" }, { _id: 0, total: 1, createdAt: 1 });
```

**Projection is asking for less.** It looks like a formatting convenience and it is a
performance decision — the difference between a query that reads documents and one that never
touches them.

## The two modes, and the one rule

**Inclusion** — name what you want:

```js
{ total: 1, createdAt: 1 }        // total, createdAt, and _id
{ total: 1, createdAt: 1, _id: 0 }  // total and createdAt only
```

**Exclusion** — name what you do not want:

```js
{ internalNotes: 0, auditTrail: 0 }   // everything else, including _id
```

🔴 **You cannot mix them.** `{total: 1, internalNotes: 0}` is an error. The single documented
exception is **suppressing `_id` in an inclusion projection**, which is why `{_id: 0, …: 1}` is
legal and looks like a contradiction.

The reason is that the two modes answer different questions — *"only these"* versus *"all but
these"* — and a mixed projection has no coherent meaning for the fields you did not name.

⚠️ **`_id` is included by default.** Every inclusion projection returns it unless you say
`_id: 0`. Forgetting that is why an API response has an unexpected `_id` in it.

## Dot notation reaches into documents and arrays

```js
{ "customer.name": 1, _id: 0 }        // just the name from the embedded customer
{ "lines.sku": 1, _id: 0 }            // the sku of every line
```

Projecting a field inside an array yields the array with only that field in each element — the
shape is preserved, the contents trimmed.

Two array-specific projection operators are worth knowing:

```js
{ lines: { $slice: 3 } }                          // the first three elements
{ lines: { $slice: [10, 5] } }                    // skip 10, take 5
{ lines: { $elemMatch: { sku: "ABC-1" } } }       // only the first matching element
{ "lines.$": 1 }                                  // the first element matched by the filter
```

⚠️ **`$` and `$elemMatch` both return only the *first* match.** For "every matching element",
filter in an aggregation with `$filter` instead — the projection operators do not do it.

## Why it matters more than it looks

**1 · Less to read, send and parse.** A document with a large description or an embedded array
costs on every hop: disk, cache, network, and JSON parsing in your application. Projecting three
fields out of forty is often the cheapest optimisation available, and it needs no index.

**2 · It can make a query covered.** If every field the query needs — filter *and* projection —
is present in the index, MongoDB never reads the documents at all. In `explain()` that shows as
`totalDocsExamined: 0` with a `PROJECTION_COVERED` stage
([Phase 2](../phase-2-mongosh/04-explain.md)).

```js
db.orders.createIndex({ status: 1, createdAt: -1 });
db.orders.find({ status: "open" }, { _id: 0, status: 1, createdAt: 1 })
         .sort({ createdAt: -1 });                 // can be covered
```

🔴 **`_id: 0` is often what makes coverage possible**, because `_id` is not in the index unless
you put it there. That one character is the difference between reading the index and reading
every document.

⚠️ **Coverage is lost the moment you project a field the index lacks** — and, from
[Phase 1](../phase-1-documents-and-bson/06-arrays.md), a multikey index cannot cover a query
that returns the array field or uses `$elemMatch`.

**3 · It limits blast radius.** A projection is a contract: this endpoint returns these fields.
Adding an internal field to a document then cannot leak it into an API response, which is a
security property as much as a performance one.

## The habit worth forming

**Project explicitly on every query that feeds a response.** `find(filter)` with no projection
returns the whole document — fine in the shell, sloppy in an application, and the reason an
internal `passwordHash` or `auditTrail` eventually turns up in a client payload.

## Gotchas

**Symptom:** a projection errors out.
**Cause:** inclusion and exclusion mixed in one document.
**Fix:** choose one mode. `_id: 0` alongside inclusions is the only legal mix.

**Symptom:** an API response contains an unexpected `_id`.
**Cause:** `_id` is returned by default.
**Fix:** `_id: 0` in the projection.

**Symptom:** a query that should be covered still reads documents.
**Cause:** something outside the index is projected — often `_id`, sometimes one extra field.
**Fix:** `explain()` and compare the projected fields with the index keys. Add `_id: 0`, or
extend the index.

**Symptom:** projecting one field of an array returns all the elements.
**Cause:** that is the behaviour — the array shape is preserved, each element trimmed.
**Fix:** `$slice` for a window, `$elemMatch` or `.$` for the first match, `$filter` in an
aggregation for all matches.

**Symptom:** `"lines.$"` returns only one element when several match.
**Cause:** the positional operator returns the first match only.
**Fix:** aggregate with `$filter`.

**Symptom:** a large payload slows an endpoint down and no index helps.
**Cause:** the documents themselves are large and are being returned whole.
**Fix:** project. This is the case where no index can save you, because the cost is the data.

## Interview questions

**★ What is the rule about mixing inclusion and exclusion in a projection?**
You cannot, in a single query — the only documented exception is suppressing `_id` in an
otherwise-inclusion projection. That is why `{total: 1, _id: 0}` is legal while
`{total: 1, notes: 0}` is an error: the two modes answer different questions, and a mixed one
has no defined meaning for the unnamed fields.

**★ How does projection relate to covered queries?**
A query is covered when every field it needs — in the filter, the sort and the projection — is
in the index, so no documents are read; `explain()` shows `totalDocsExamined: 0` and a
`PROJECTION_COVERED` stage. Since `_id` is returned by default and is usually not in the index,
adding `_id: 0` is frequently what makes coverage possible at all.

**★ Why is projection more than a formatting convenience?**
Because it changes how much data is read, transferred and parsed — often the cheapest available
optimisation, and the only one that helps when the documents themselves are large. It can turn
a document-reading query into an index-only one. And it is a contract that stops internal fields
leaking into API responses when someone adds a field to the document.

**How do you return only the array elements that match a condition?**
Not with projection alone: `$elemMatch` and the positional `$` both return only the first match,
and `$slice` takes a positional window. For every matching element you need an aggregation with
`$filter`.

**What does `{ "customer.name": 1, _id: 0 }` return?**
Documents containing only a `customer` subdocument holding `name` — the structure is preserved
and everything else is trimmed away, including `_id` because it was explicitly suppressed.

---

← Prev: [`findOne`](./03-findone.md) ·
Index: [Phase 4](./README.md) ·
Next → [`updateOne` / `updateMany`](./05-update.md)
