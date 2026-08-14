---
title: "Array matching — exact vs containment"
sidebar_label: "06 · Array matching"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`$elemMatch`](https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/): it
> *"matches documents that contain an array field with at least one element that matches all the
> specified query criteria"*; without it, multiple conditions in array queries *"can be satisfied
> by different elements"*, and the documented example returns `{_id: 1}` from
> `results: [82, 85, 88]` for `{$elemMatch: {$gte: 80, $lt: 85}}` because 82 satisfies both; with
> a **single** condition it *"explicitly restricts matching to array elements only, excluding
> non-array fields"*, unlike a dot-path query which also matches a plain embedded document; and
> `$where` and `$text` **cannot** be used inside `$elemMatch` — with
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
> for the indexing consequences.
> **Documentation-validated; no console blocks.**

**This is the single most common query bug in MongoDB**, and it produces confident wrong
answers rather than errors.

## The two meanings of `{tags: …}`

```js
// document: { _id: 1, tags: ["urgent", "billing"] }

{ tags: "urgent" }                    // ✅ CONTAINMENT — an element equals "urgent"
{ tags: ["urgent", "billing"] }       // ✅ EXACT — the array is exactly this, in this order
{ tags: ["billing", "urgent"] }       // ✗ no match — same elements, wrong order
{ tags: ["urgent"] }                  // ✗ no match — the array has two elements
```

**A scalar on the right means "contains". An array on the right means "is exactly".** Same
syntax, entirely different question, and nothing warns you which one you asked.

The exact form is rarely what anyone wants, because it is order-sensitive *and*
completeness-sensitive. When you meant "has both tags", the operator is `$all`:

```js
{ tags: { $all: ["urgent", "billing"] } }     // contains both, any order, extras allowed
```

## The phase gate: two conditions, one element

Given orders with line items:

```js
{
  _id: 1,
  lines: [
    { sku: "X", qty: 1 },
    { sku: "Y", qty: 5 },
  ],
}
```

**"Orders containing a line that is product X *and* quantity > 2."** The obvious query:

```js
// ❌ WRONG — matches the document above
db.orders.find({ "lines.sku": "X", "lines.qty": { $gt: 2 } });
```

It matches, because the conditions are evaluated **per element independently**: line one
satisfies `sku: "X"`, line two satisfies `qty > 2`. No single line satisfies both, and the
document is returned anyway. The Manual states the rule directly — without `$elemMatch`,
multiple conditions *"can be satisfied by different elements"*.

**The correct query:**

```js
// ✅ one element must satisfy all the conditions
db.orders.find({ lines: { $elemMatch: { sku: "X", qty: { $gt: 2 } } } });
```

🔴 **The wrong version returns a superset**, so it looks fine on small test data and on any
order with a single line. It fails exactly where the data is interesting — which is why this bug
reaches production.

The Manual's own numeric example is the same shape: `results: [82, 85, 88]` matches
`{$elemMatch: {$gte: 80, $lt: 85}}` because **82** satisfies both conditions; without
`$elemMatch`, an array containing 88 and 75 would satisfy the pair across two elements.

## `$elemMatch` with a single condition

Worth knowing because it is a genuine difference, not a stylistic one:

```js
{ "results.product": "xyz" }                      // matches arrays AND a plain subdocument
{ results: { $elemMatch: { product: "xyz" } } }   // arrays only
```

The documented behaviour: a single-condition `$elemMatch` *"explicitly restricts matching to
array elements only, excluding non-array fields"*. In a collection where a field is sometimes an
array and sometimes an embedded document — which happens more often than anyone plans for —
that difference decides which documents come back.

## The array operators, in one place

| Need | Query |
|---|---|
| contains a value | `{tags: "urgent"}` |
| contains **all** of several | `{tags: {$all: ["a", "b"]}}` |
| one element satisfies several conditions | `{lines: {$elemMatch: {…}}}` |
| exactly this array, in order | `{tags: ["a", "b"]}` |
| a specific position | `{"tags.0": "urgent"}` |
| exact length | `{tags: {$size: 3}}` — **no ranges** |
| empty array | `{tags: {$size: 0}}` or `{tags: []}` |

⚠️ **`$size` takes an exact number only.** "More than three tags" needs a maintained count field,
or `$expr` with `$size` — which cannot use an index
([topic 05](./05-expr.md)).

## Indexing and the cost side

An index on an array field is **multikey**, created automatically, with one entry per element
([Phase 1](../phase-1-documents-and-bson/06-arrays.md)). Two consequences for this topic:

- **`$elemMatch` can use a multikey index** to find candidate documents, but the elements'
  conditions are then checked per document — so `totalDocsExamined` above `nReturned` is normal
  here, and not automatically a defect.
- **A multikey index cannot cover a query** that uses `$elemMatch` or returns the array field,
  which is documented, so do not expect `totalDocsExamined: 0`
  ([Phase 2](../phase-2-mongosh/04-explain.md)).

Also documented: **`$where` and `$text` cannot be used inside `$elemMatch`.**

## Gotchas

**Symptom:** a query on two array conditions returns documents that plainly should not match.
**Cause:** the conditions were satisfied by different elements.
**Fix:** `$elemMatch`. Treat any multi-condition array query without it as a bug.

**Symptom:** `{tags: ["a", "b"]}` matches nothing though both tags are present.
**Cause:** that is an exact-array match — order and completeness both matter.
**Fix:** `$all` for "contains both", or a plain scalar for "contains one".

**Symptom:** a query that used to work stops matching after a field became an array.
**Cause:** it did not stop — containment means a scalar query keeps working. The reverse case,
an exact-array query, breaks when an element is added.
**Fix:** decide which semantics you want and write it explicitly.

**Symptom:** a dot-path query returns documents whose field is an embedded document, not an
array.
**Cause:** dot paths match both; `$elemMatch` restricts to arrays.
**Fix:** `$elemMatch` when array-only is the requirement.

**Symptom:** `{tags: {$size: {$gt: 3}}}` errors.
**Cause:** `$size` takes an exact number.
**Fix:** maintain a count field, or use `$expr` and accept the loss of index use.

**Symptom:** an `$elemMatch` query examines many more documents than it returns.
**Cause:** the multikey index finds candidates and the element conditions are then checked per
document.
**Fix:** expected. Narrow with an additional indexed predicate if it matters.

## Interview questions

**★ What is the difference between `{tags: "a"}` and `{tags: ["a"]}`?**
The first is containment — it matches any document whose `tags` equals `"a"` or is an array
containing `"a"`. The second is an exact array match: the array must be exactly `["a"]`, so both
order and completeness matter. Passing an array where you meant containment is one of the most
common MongoDB query bugs, and it fails silently by matching nothing.

**★ Write "orders containing a line item that is product X and quantity greater than 2", and
explain why the obvious version is wrong.**
`db.orders.find({lines: {$elemMatch: {sku: "X", qty: {$gt: 2}}}})`. The obvious version,
`{"lines.sku": "X", "lines.qty": {$gt: 2}}`, evaluates each condition independently across the
array, so an order with a line for X quantity 1 and a line for Y quantity 5 satisfies both and
is returned. `$elemMatch` requires a single element to satisfy every condition. The wrong version
returns a superset, which is why it survives testing on single-line orders.

**★ Does `$elemMatch` change anything with only one condition?**
Yes — documented: it restricts matching to array elements only, excluding non-array fields,
whereas a dot-path query also matches a plain embedded document. In a collection where a field is
sometimes an array and sometimes a subdocument, the two queries return different documents.

**How do you match "has all of these tags"?**
`{tags: {$all: ["a", "b"]}}` — contains both, in any order, extras allowed. Writing it as two
conditions on the same field in one filter document does not work, because duplicate keys mean
only the last survives ([topic 02](./02-logical-operators.md)).

**Why does an `$elemMatch` query examine more documents than it returns?**
Because the multikey index identifies candidate documents by element, and the combination of
conditions is then verified per document. It is also why a multikey index cannot cover a query
using `$elemMatch` — so a high `totalDocsExamined` here is normal rather than a sign of a missing
index.

**How do you query for "more than three tags"?**
Not with `$size`, which takes an exact number. Either maintain a count field alongside the array
and index it, or use `$expr` with `$size` and accept that it cannot use an index.

---

← Prev: [`$expr`](./05-expr.md) ·
Index: [Phase 5](./README.md) ·
Next → **Phase 6 · The aggregation pipeline** *(not written yet)*
