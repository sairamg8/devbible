---
title: "One-to-few"
sidebar_label: "03 · One-to-few"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
> (embed for a *"'has-a' or 'contains' relationship"*, when *"your application queries pieces
> of information together"* and when data is *"often updated together"*; embedding *"allows
> atomic operations"*) and
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/) (*"data that's accessed
> together should be stored together"*) — with
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
> for indexing embedded arrays.
> **Documentation-validated; no console blocks.**

**One-to-few is the easy case, and it is most of them.** A handful of children, bounded by the
domain, always read with the parent: **embed**. No collection, no reference, no join.

Addresses on a customer. Variants on a product. Line items on an order. Phone numbers,
images, tags, permissions.

```js
{
  _id: ObjectId("..."),
  name: "Ada Lovelace",
  addresses: [
    { label: "home",    line1: "12 Analytical Way", city: "London",     postcode: "N1 7AB" },
    { label: "billing", line1: "1 Difference St",   city: "Manchester", postcode: "M1 2CD" },
  ],
}
```

## Why this is the default

**One read.** The customer and their addresses arrive together, because that is how they are
used.

**Atomic.** Adding an address, editing one and reordering them are all a single-document
update — atomic with no transaction
([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)). In a referenced
model, "replace this customer's addresses" spans documents and needs a transaction to be safe.

**Simpler code.** The Manual's first embed criterion is that *"keeping related data together
will lead to a simpler data model and code"*, and it is true in an unglamorous way: no join,
no id juggling, no orphan cleanup, no second round trip.

**Nothing is orphaned.** Delete the customer and the addresses go with them — the lifecycle is
shared because the ownership is real.

## "Few" means bounded by the domain, not small today

The test from [topic 02](./02-embed-vs-reference.md): *is there a number this can never
exceed?*

| Relationship | Bounded? |
|---|---|
| addresses per customer | ✅ a handful |
| variants per product | ✅ dozens |
| line items per order | ✅ tens |
| roles per user | ✅ a few |
| **reviews per product** | ❌ unbounded — [topic 05](./05-one-to-squillions.md) |
| **events per device** | ❌ unbounded |

🔴 **"Currently small" is not bounded.** Comments on a blog post are few for the first month
and unbounded thereafter. The question is about the domain, not the current data.

## Querying inside embedded documents

Dot notation reaches in, and it indexes:

```js
db.customers.find({ "addresses.city": "London" });
db.customers.createIndex({ "addresses.city": 1 });     // multikey, automatically
```

Two rules carried over from [Phase 1](../phase-1-documents-and-bson/06-arrays.md):

- **`$elemMatch` when several conditions must hold on the *same* element.**
  `{"addresses.city": "London", "addresses.label": "home"}` matches a customer with a London
  billing address and a home address in Leeds. Almost never what was meant.
- **Whole-subdocument equality is order- and completeness-sensitive.** Query by dot path, not
  by whole object.

Projecting just the matching element:

```js
db.customers.findOne(
  { _id: id, "addresses.label": "home" },
  { "addresses.$": 1, name: 1 },        // the first matching element only
);
```

## Updating one element

```js
// by matched element
db.customers.updateOne(
  { _id: id, "addresses.label": "home" },
  { $set: { "addresses.$.postcode": "N1 9ZZ" } },
);

// by condition, for all matching elements
db.customers.updateOne(
  { _id: id },
  { $set: { "addresses.$[a].country": "UK" } },
  { arrayFilters: [{ "a.country": { $exists: false } }] },
);
```

`$` updates the **first** match only; `$[<id>]` with `arrayFilters` updates every element that
matches the condition; `$[]` updates all of them unconditionally.

⚠️ **Give embedded elements a stable identifier** — a `label`, a `sku`, even an `_id` of their
own — when they are individually editable. Updating by array position is a bug waiting for the
first reorder, and updating by value breaks the moment the value changes.

## When one-to-few still wants a reference

Two cases, both from the procedure in [topic 02](./02-embed-vs-reference.md):

- **The child is queried on its own.** "Every customer with a London address" is fine —
  that returns customers. "A list of all addresses, deduplicated, for a mailing tool" is not:
  it wants an addresses collection.
- **The child is shared.** Two customers at the same office is fine to duplicate; a *supplier*
  shared by ten thousand products is not, because a change of address then means ten thousand
  writes.

## Gotchas

**Symptom:** a query matching two conditions on an embedded array returns the wrong documents.
**Cause:** the conditions were satisfied by different elements.
**Fix:** `$elemMatch`.

**Symptom:** an update wrote to the wrong array element.
**Cause:** a positional update by index, after a reorder — or `$` matching the first element
rather than the intended one.
**Fix:** identify elements by a stable field and use `arrayFilters`.

**Symptom:** a document that started with three embedded children now has thousands.
**Cause:** "few" was judged from the current data, not the domain.
**Fix:** move to a referenced model ([topic 05](./05-one-to-squillions.md)) — and treat this as
the reason to ask the boundedness question at design time.

**Symptom:** an index on `"addresses.city"` is larger than expected.
**Cause:** it is multikey: one entry per array element per document.
**Fix:** expected behaviour. Consider whether every element really needs indexing.

**Symptom:** a whole-object match on an embedded document returns nothing.
**Cause:** BSON preserves field order, and whole-subdocument equality is order- and
completeness-sensitive.
**Fix:** query by dot path.

## Interview questions

**★ What is one-to-few and what do you do with it?**
A relationship where the child count is bounded by the domain — addresses on a customer,
variants on a product, line items on an order — and the children are always read with the
parent. You embed. It gives a single read, atomic updates across parent and children with no
transaction, simpler code, and no orphans, which is why embedding is MongoDB's default rather
than its exception.

**★ How do you decide something is "few"?**
By asking whether the domain caps it, not by looking at current data. Addresses per customer
cannot realistically exceed a handful; comments per post can grow forever and merely happen to
be small today. If the honest answer is "it depends how popular it gets", it is not few.

**★ How do you update one element of an embedded array safely?**
Match the element in the filter and use the positional `$`, or use `arrayFilters` with
`$[<identifier>]` to update every element matching a condition. Give elements a stable
identifier so you are not addressing them by position — a reorder silently changes what a
positional update touches.

**Why does `{"addresses.city": "London", "addresses.label": "home"}` match the wrong customers?**
Because without `$elemMatch` the two conditions may be satisfied by different array elements —
a home address in Leeds and a billing address in London satisfies both. `$elemMatch` requires
one element to satisfy all of them.

**What does embedding buy you that referencing cannot?**
Atomicity across the parent and its children in a single write, with no transaction, and one
round trip instead of a join. The Manual names both: embedded models allow atomic operations
and avoid complex joins across collections.

**When would you still reference a small child collection?**
When it is queried on its own — a deduplicated list of addresses for a mailing tool — or when it
is shared by many parents, like a supplier referenced by thousands of products, where a change
would otherwise mean thousands of writes.

---

← Prev: [Embed vs reference — the decision procedure](./02-embed-vs-reference.md) ·
Index: [Phase 3](./README.md) ·
Next → [One-to-many](./04-one-to-many.md)
