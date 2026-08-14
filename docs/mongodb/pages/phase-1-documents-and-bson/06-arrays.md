---
title: "Arrays as a first-class type"
sidebar_label: "06 · Arrays"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/):
> MongoDB creates a multikey index **automatically** when a field holds array values, with an
> index entry per element (*"if an array contains multiple instances of the same value, the
> index only includes one entry for the value"*); in a compound multikey index *"each indexed
> document can have at most one indexed field whose value is an array"*, and an insert
> violating that is rejected; multikey indexes can cover a query only when the array field is
> not projected and `$elemMatch` is not used; and sorting on a multikey-indexed array field
> adds an in-memory sort stage except in the stated cases — plus
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> (an empty array sorts before null or a missing field).
> **Documentation-validated; no console blocks.**

An array is a real BSON type, not a serialised blob. MongoDB indexes into it, queries inside
it, and updates elements of it. **That is the feature that makes embedding work** — and it
brings rules that surprise people coming from SQL.

## Querying an array matches *any* element

```js
// document: { _id: 1, tags: ["urgent", "billing"] }
db.tickets.find({ tags: "urgent" });        // ✅ matches
```

There is no `IN` and no join. `{tags: "urgent"}` means *"the field equals `urgent`, or is an
array containing `urgent`"* — the same query form works for a scalar field and an array field,
which is why a field can quietly become an array without any query changing.

Three operators do the rest:

| Need | Query |
|---|---|
| contains all of several values | `{tags: {$all: ["urgent", "billing"]}}` |
| **one element** satisfies several conditions together | `{scores: {$elemMatch: {$gte: 8, $lt: 10}}}` |
| array length | `{tags: {$size: 3}}` |

🔴 **`$elemMatch` is the one that matters.** Without it, multiple conditions on an array field
may be satisfied by *different* elements:

```js
// document: { scores: [5, 12] }
db.students.find({ scores: { $gte: 8, $lt: 10 } });               // ✅ matches — 12 ≥ 8, 5 < 10
db.students.find({ scores: { $elemMatch: { $gte: 8, $lt: 10 } } }); // ❌ no match — correct
```

The first query almost never expresses what anyone means, and it fails only on data where the
distinction shows — so it passes review and ships.

⚠️ **`$size` takes an exact number only** — no `$gt`, no ranges. For "more than three tags",
either store a count field alongside, or use an aggregation with `$expr`/`$size`, which cannot
use an index.

## Indexing: multikey, automatically

Index an array field and you get a **multikey index** — no declaration needed, MongoDB decides
from the data:

```js
db.tickets.createIndex({ tags: 1 });     // multikey the moment any tags value is an array
```

**One index entry per array element.** A document with five tags contributes five entries; a
million documents averaging five tags produce a five-million-entry index. That is the cost of
querying inside arrays, and it is why an unbounded array is an index problem as well as a
document-size problem.

Duplicates inside one array cost nothing extra: *"if an array contains multiple instances of
the same value, the index only includes one entry for the value."*

**Three limits worth knowing before you design:**

1. **At most one array field per compound index.** `{tags: 1, categories: 1}` cannot exist as
   a compound multikey index if a document has arrays in both — and once such an index exists,
   an insert that would violate the rule is **rejected**. So a schema decision can be blocked
   later by an index created earlier.
2. **Covered queries are restricted.** A multikey index can cover a query only if the array
   field is not in the projection and `$elemMatch` is not used. Asking for the array back means
   fetching the document.
3. **Sorting on the array field adds an in-memory sort stage**, except in the narrow cases the
   Manual specifies. "Find by tag, sort by tag" is not the free operation it looks like.

## Updating elements

```js
$push / $addToSet     // append; $addToSet only if not present
$pull / $pop          // remove by criteria / from an end
$each, $slice, $sort  // modifiers on $push — the bounded-array pattern
```

The **bounded array** is the pattern worth memorising, because it is the fix for the failure
mode below:

```js
// keep only the 20 most recent events, in one atomic update
db.devices.updateOne(
  { _id },
  { $push: { events: { $each: [newEvent], $sort: { at: -1 }, $slice: 20 } } },
);
```

Positional operators reach a matched element: `$` for the first match, `$[]` for all elements,
and `$[<identifier>]` with `arrayFilters` for elements matching a condition — the last being
the one to reach for, since `$` only ever updates one.

## 🔴 An array field is not a join table

The temptation is to model many-to-many as an array of ids and treat it as a join table. The
differences that decide it:

- **Growth is bounded by the 16 MiB document limit.** An array that grows per event or per
  member eventually makes **every write to that document fail** — the single most common way
  to hit the document cap ([Phase 0](../phase-0-how-mongodb-runs/03-bson.md)).
- **The whole document is rewritten** as it grows, so writes get steadily more expensive, and
  a large document moves more data over the network on every read that does not project.
- **Atomicity is per document.** An array is atomic with its parent — genuinely useful — but
  two documents' arrays are not, so a bidirectional relationship maintained on both sides can
  half-succeed.

**The rule of thumb:** embed an array when it is **bounded, owned by the document, and read
with it** — order line items, a handful of tags, a set of role names. Use a separate
collection when it is unbounded, shared, or has its own lifecycle — events, messages,
memberships that grow without limit.

## Empty, missing, and null

Three states again, and they differ:

| Value | `{tags: "x"}` | `{tags: {$size: 0}}` | `{tags: {$exists: true}}` | sorts |
|---|---|---|---|---|
| `["x"]` | ✅ | ✗ | ✅ | with its smallest element |
| `[]` | ✗ | ✅ | ✅ | **before null and before missing** |
| missing | ✗ | ✗ | ✗ | as null |
| `null` | ✗ | ✗ | ✅ | as null |

Pick one representation for "no tags" — an empty array is usually the kindest, because it
keeps the field's type stable and `$push` works without an upsert dance — and enforce it with
schema validation.

## Gotchas

**Symptom:** a range query on an array matches documents where no single element is in range.
**Cause:** without `$elemMatch`, separate conditions may be satisfied by different elements.
**Fix:** `$elemMatch`. Treat any multi-condition query on an array field as a bug until it has
one.

**Symptom:** writes to one document start failing after months in production.
**Cause:** an unbounded array pushed the document toward the 16 MiB limit.
**Fix:** bound it with `$push` + `$slice`, or move the growing data to its own collection. The
fix is a migration, so decide at design time.

**Symptom:** `createIndex` succeeds, then an insert is rejected with a multikey error.
**Cause:** a compound index may cover at most one array field per document, and this document
has arrays in two.
**Fix:** separate indexes, or restructure. Note the ordering — the index created earlier
constrains the documents allowed later.

**Symptom:** a query that should be covered still fetches documents.
**Cause:** the array field is in the projection, or `$elemMatch` is used — both documented
exclusions.
**Fix:** drop the array from the projection if you can; otherwise accept the fetch.

**Symptom:** `{tags: {$size: {$gt: 3}}}` errors.
**Cause:** `$size` takes an exact number.
**Fix:** maintain a count field, or use `$expr` with `$size` and accept that it cannot use an
index.

**Symptom:** `$` updates only the first matching element.
**Cause:** that is what `$` means.
**Fix:** `$[]` for every element, or `$[id]` with `arrayFilters` for the ones matching a
condition.

## Interview questions

**★ What is a multikey index and when do you get one?**
An index over an array field, created automatically the moment a value in that field is an
array — you never declare it. It stores one entry per array element, so a document with five
tags contributes five entries, which is what makes querying inside arrays possible and what
makes an unbounded array an index problem too. Duplicate values within one array are stored
once.

**★ Why does `{scores: {$gte: 8, $lt: 10}}` match a document with `[5, 12]`?**
Because without `$elemMatch` each condition may be satisfied by a different element: 12 is ≥ 8
and 5 is &lt; 10, so the document matches even though no single score is in the range.
`$elemMatch` requires one element to satisfy all the conditions, which is nearly always what
was meant.

**★ When should a relationship be an embedded array rather than its own collection?**
When it is bounded, owned by the parent, and read with it — line items, a few tags, role
names. Move it out when it is unbounded, shared with other documents, or has its own
lifecycle. The forcing constraint is the 16 MiB document limit: an array that grows per event
eventually makes every write to that document fail, and by then the fix is a migration.

**★ What are the limits on compound indexes over arrays?**
At most one indexed field per document may be an array, so a compound index over two array
fields cannot exist — and once such an index is in place, an insert that would violate the
rule is rejected. Compound multikey indexes also cover a query only when the array field is not
projected and `$elemMatch` is not used, and sorting on the array field generally adds an
in-memory sort.

**How do you keep an array bounded?**
`$push` with `$each`, `$sort` and `$slice` in a single atomic update, which appends and trims
in one operation. That keeps the document small, the index bounded, and the write cost flat.

**What is the difference between an empty array, a missing field and null here?**
`[]` matches `$size: 0` and `$exists: true` and sorts before both null and a missing field; a
missing field fails `$exists` and sorts as null; explicit null passes `$exists` and sorts as
null. Choose one representation for "none" and enforce it, because queries written for one do
not work for the others.

---

← Prev: [Dates vs Timestamps](./05-dates-vs-timestamps.md) ·
Index: [Phase 1](./README.md) ·
Next → **Phase 2 · `mongosh`, mastered** *(not written yet)*
