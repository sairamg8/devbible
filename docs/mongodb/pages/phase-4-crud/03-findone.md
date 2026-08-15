---
title: "findOne"
sidebar_label: "03 · findOne"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`db.collection.findOne()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/):
> it *"returns one document that satisfies the specified query criteria"*, returns **`null`**
> when nothing matches, and *"although similar to the `find()` method, `findOne()` returns a
> document rather than a cursor"*, so *"you cannot apply cursor methods to the result"*; with
> two or more matches it returns *"first document in natural order"* under a collection scan or
> *"first document retrieved from index"* under an index scan; and 🔴 *"if the query plan
> changes to use a different index, the method may return a different document. If your use
> case requires that a particular record is chosen consistently, you must use the `options`
> document to specify a sort."*
> **Documentation-validated; no console blocks.**

```js
const order = db.orders.findOne({ _id: id });    // a document, or null
```

`findOne` is `find` for the case where you want one thing. The difference that matters is
**what you get back**: a document rather than a cursor, so there is nothing to iterate and no
cursor method to call.

## `findOne()` vs `find().limit(1)`

| | `findOne(filter)` | `find(filter).limit(1)` |
|---|---|---|
| Returns | **a document, or `null`** | **a cursor** yielding 0 or 1 documents |
| Consuming it | use it directly | `.toArray()`, `.next()`, iterate |
| Chaining `sort`/`skip` | via the options argument | cursor methods |
| Reads best as | "get me this thing" | "get me a list, capped at one" |

Both ask the server for at most one document, so the choice is about the shape of your code —
and about a null check versus an empty-array check. **`findOne` is the honest expression of
"fetch this one record"**, and the reason it appears in nearly every application's data layer.

## 🔴 With multiple matches, which one do you get?

This is the part worth remembering, because it has a documented failure mode.

- **Under a collection scan** — the *first document in natural order*.
- **Under an index scan** — the *first document retrieved from the index*.

And the consequence the Manual states plainly: **if the query plan changes to use a different
index, the method may return a different document.** A new index, changed data distribution, a
different plan chosen after a restart — any of these can change which document a non-unique
`findOne` returns, with no code change at all.

**So: if which document matters, sort.**

```js
// "the newest matching order", deterministically
db.orders.findOne({ customerId: 42 }, { sort: { createdAt: -1 } });
```

Without a sort, "get the user's order" is only well-defined when the filter can match one
document — by `_id`, or on a uniquely indexed field. **That is the honest rule: filter to
exactly one, or sort.**

## Options go in the second argument

Unlike `find`, there is no cursor to chain onto — `findOne` takes an options document:

```js
db.orders.findOne(
  { customerId: 42 },
  { sort: { createdAt: -1 }, projection: { _id: 0, total: 1, createdAt: 1 } },
);
```

⚠️ **In `mongosh` the second argument is the projection**, while the Node driver takes an
options object containing `projection`. The same call written for one and pasted into the other
is a common source of confusion — check which surface you are on
([topic 04](./04-projection.md)).

## Null is the answer, not an error

`findOne` returns `null` for no match. Three habits follow:

- **Check for null before using the result.** `order.total` on a null is the most common crash
  in a MongoDB data layer.
- **Do not translate null straight to 404 without thinking.** A string `_id` that was never
  converted to an `ObjectId` also returns null
  ([Phase 1](../phase-1-documents-and-bson/03-objectid.md)) — a bug that looks exactly like a
  missing document.
- **`findOne()` with no filter returns some document**, which is the fastest way to learn a
  collection's real shape ([Phase 2](../phase-2-mongosh/02-navigating.md)).

## Existence checks

```js
// ❌ fetches the whole document to answer a yes/no question
const exists = (await db.collection("users").findOne({ email })) !== null;

// ✅ fetch only what proves it
const exists = (await db.collection("users").findOne({ email }, { projection: { _id: 1 } })) !== null;
```

Better still, if the field is uniquely indexed, the `_id`-only projection can be answered from
the index alone — a covered query, with no document read at all
([Phase 2](../phase-2-mongosh/04-explain.md)).

## Gotchas

**Symptom:** the same `findOne` starts returning a different document after an index was added.
**Cause:** with multiple matches the result depends on the plan, and the Manual says a plan
change can change the document.
**Fix:** add a sort, or filter to something unique. Do not rely on natural order.

**Symptom:** `Cannot read properties of null`.
**Cause:** no match, and the result was used without a null check.
**Fix:** check for null. And confirm the filter is right before treating it as "not found".

**Symptom:** a lookup by id always returns null in the application and works in the shell.
**Cause:** the application passed a string where an `ObjectId` was needed.
**Fix:** convert with `ObjectId.createFromHexString`.

**Symptom:** a projection passed to `findOne` is ignored, or throws.
**Cause:** the driver expects `{ projection: {...} }` in an options object; `mongosh` takes the
projection directly.
**Fix:** match the surface you are calling.

**Symptom:** an existence check is slow on a large collection.
**Cause:** the whole document is being fetched to answer yes or no.
**Fix:** project `_id` only, and let the index cover the query.

## Interview questions

**★ How does `findOne` differ from `find().limit(1)`?**
`findOne` returns a document or `null`; `find().limit(1)` returns a cursor you must consume.
Both ask the server for at most one document, so the difference is the shape of your code — a
null check rather than an empty-array check, and no cursor methods on the result, since as the
docs say you cannot apply them to a single returned document.

**★ If several documents match, which one does `findOne` return?**
Whichever the plan produces first — the first in natural order under a collection scan, or the
first from the index under an index scan. The Manual warns explicitly that a change of plan can
change the document returned, so if a particular record must be chosen consistently you have to
specify a sort. In practice: filter to something unique, or sort.

**★ `findOne` returns null in production and the document clearly exists. What do you check?**
Whether the id is a string rather than an `ObjectId` — a type mismatch matches nothing and
returns null, which looks exactly like "not found". Then whether the filter names the right
database and collection. Null is an answer, not an error, so nothing in the stack complains.

**How would you write an existence check efficiently?**
`findOne(filter, { projection: { _id: 1 } })` — fetch only the id, so the check does not drag a
whole document across. On an indexed field that can be answered from the index alone as a
covered query, which makes it about as cheap as the question deserves.

**Why is `findOne()` with no filter useful?**
Because MongoDB has no schema to read. One real document shows the field names and the actual
BSON types, which is the fastest orientation available on an unfamiliar collection.

---

← Prev: [`find` and the query document](./02-find-and-the-query-document.md) ·
Index: [Phase 4](./README.md) ·
Next → [Projection](./04-projection.md)
