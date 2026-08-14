---
title: "find and the query document"
sidebar_label: "02 · find and the filter"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Query Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/) — the
> `{ <field1>: <value1>, … }` filter shape, and *"to select all documents in the collection,
> pass an empty document as the query filter parameter"*;
> [Iterate a Cursor](https://www.mongodb.com/docs/manual/tutorial/iterate-a-cursor/) for
> `find()` returning a **cursor**;
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> for type-bracketed comparison; and
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
> for matching inside arrays.
> **Documentation-validated; no console blocks.**

```js
db.orders.find({ status: "open", total: { $gt: 100 } });
```

A **query document** is an ordinary BSON document whose fields are conditions. That is the
whole model, and three of its properties account for most of what surprises people.

## Property 1 — the fields are ANDed implicitly

```js
{ status: "open", total: { $gt: 100 } }
// means: status is "open" AND total > 100
```

There is no `$and` needed, and you rarely write one. **The exception is when you need the same
field twice with conditions a single object cannot express:**

```js
// ❌ duplicate key — the second silently wins in most drivers
{ $expr: "…", tags: "a", tags: "b" }

// ✅ explicit $and
{ $and: [{ tags: "a" }, { tags: "b" }] }
```

Because a query document is a document, **duplicate keys are a real hazard** — an object
literal cannot hold the same key twice, so the last one wins and the first condition vanishes
without an error.

## Property 2 — equality on an array matches any element

```js
// document: { tags: ["urgent", "billing"] }
{ tags: "urgent" }        // ✅ matches
{ tags: ["urgent", "billing"] }   // ✅ matches — but this is an exact array match
```

The first is "contains"; the second is "is exactly this array, in this order". The same syntax
means two different things depending on whether you pass a scalar or an array, which is worth
saying out loud because it is easy to write the second by accident.

For conditions that must all hold **on one element**, `$elemMatch`
([Phase 1](../phase-1-documents-and-bson/06-arrays.md)).

## Property 3 — comparison is bracketed by type

`{total: {$gt: 100}}` never matches `"150"`. Different BSON types occupy different positions in
the comparison order, so a range query only matches within the numeric bracket
([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)). **No error, just fewer
results** — the most consequential silent failure in MongoDB querying.

## Dot notation reaches inside

```js
{ "customer.name": "Ada" }                 // embedded document field
{ "lines.sku": "ABC-1" }                   // any element of an embedded array
{ "lines.0.sku": "ABC-1" }                 // the first element specifically
```

⚠️ **Never match a whole embedded document when you mean some of its fields.**
`{customer: {name: "Ada"}}` is an exact match on the entire subdocument — field order included,
and only if it has no other fields. Dot paths are almost always what was meant.

## The operators you will use constantly

| Operator | Meaning |
|---|---|
| `$eq`, `$ne` | equals, not equals |
| `$gt`, `$gte`, `$lt`, `$lte` | comparison, within the type bracket |
| `$in`, `$nin` | matches any / none of a list |
| `$exists` | the field is present — **not** the same as not-null |
| `$type` | the BSON type, for auditing drift |
| `$regex` | pattern match on strings |
| `$and`, `$or`, `$nor`, `$not` | logical composition |

🔴 **`$or` cannot always use indexes as well as you expect.** Each branch needs its own usable
index, or the whole query degrades toward a scan. When a query has an `$or` and is slow,
`explain()` the branches individually ([Phase 2](../phase-2-mongosh/04-explain.md)).

⚠️ **An unanchored `$regex` cannot use an index efficiently.** `/^abc/` can use one — it is a
prefix, so the index range is bounded; `/abc/` cannot, and scans. A case-insensitive regex
generally cannot use a plain index either, which is why case-insensitive search usually wants a
collation or a normalised lowercase field.

## An empty filter matches everything

```js
db.orders.find({});          // every document
db.orders.find();            // the same
```

Harmless for a read; the same shape is how a delete or an update removes or rewrites an entire
collection ([Phase 2](../phase-2-mongosh/05-shell-safety.md)). The dangerous version is a
filter built from a variable that turned out to be `undefined`.

## `find()` returns a cursor

Not a result set: a handle the server produces documents from
([Phase 2](../phase-2-mongosh/03-cursors.md)). So `sort`, `skip`, `limit` and `project` are
cursor methods sent as part of the query, and **there is no default ordering** — if order
matters, say so with `sort()`.

## Gotchas

**Symptom:** a range query silently returns too few documents.
**Cause:** some values are stored as strings; comparison is type-bracketed.
**Fix:** audit with `$type`, migrate, add schema validation.

**Symptom:** one condition in a filter appears to be ignored.
**Cause:** duplicate keys in the query document — the last occurrence wins.
**Fix:** `$and` with an array, which is exactly what it is for.

**Symptom:** `{customer: {name: "Ada"}}` matches nothing though the name is right.
**Cause:** whole-subdocument equality requires the same fields in the same order.
**Fix:** `{"customer.name": "Ada"}`.

**Symptom:** two conditions on an array field match documents where neither element satisfies
both.
**Cause:** array conditions are evaluated per element unless grouped.
**Fix:** `$elemMatch`.

**Symptom:** a query with `$or` is slow despite indexes existing.
**Cause:** one branch has no usable index, so the whole query degrades.
**Fix:** `explain()` each branch; index the weak one, or restructure the query.

**Symptom:** a `$regex` search is slow.
**Cause:** it is unanchored or case-insensitive, so it cannot use the index efficiently.
**Fix:** anchor with `^` where possible, or maintain a normalised lowercase field. For real
search, use a text or Atlas Search index.

## Interview questions

**★ How are multiple fields in a query document combined?**
Implicitly with AND. You only need `$and` explicitly when you must apply two conditions to the
same field in a way one object cannot express — and that case matters because a query document
is a document, so duplicate keys silently lose all but the last condition.

**★ What does `{tags: "urgent"}` match?**
Documents where `tags` equals `"urgent"`, *or* is an array containing `"urgent"`. The same
syntax covers scalars and arrays, which is what makes a field's becoming an array invisible to
existing queries. Passing an array instead — `{tags: ["urgent","billing"]}` — is an exact
whole-array match, order included, which is a different question entirely.

**★ Why does `{total: {$gt: 100}}` miss documents whose total looks bigger?**
Because the stored value is a string, and comparison is bracketed by BSON type, so strings and
numbers never satisfy each other's ranges. It fails silently — no error, just a smaller result —
which is why auditing with `$type` is part of owning a MongoDB collection.

**★ Why can `$or` be slow even when indexes exist?**
Because each branch needs its own usable index; a branch without one drags the whole query
toward a collection scan. The diagnosis is to explain the branches separately rather than the
combined query.

**What is the difference between `{field: null}` and `{field: {$exists: false}}`?**
The first matches both an explicit null and a missing field; the second matches only documents
where the field is absent. Choosing the wrong one is a common source of quietly incorrect
results ([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)).

**When can a regex use an index?**
When it is anchored at the start — `/^abc/` gives a bounded index range. Unanchored or
case-insensitive patterns generally cannot, so they scan; the usual fixes are a normalised
lowercase field, a collation, or a real text search index.

---

← Prev: [`insertOne` / `insertMany`](./01-insert.md) ·
Index: [Phase 4](./README.md) ·
Next → [`findOne`](./03-findone.md)
