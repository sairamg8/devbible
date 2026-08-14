---
title: "updateOne and updateMany"
sidebar_label: "05 · update"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`db.collection.updateMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/):
> the update must be **update-operator expressions** or an **aggregation pipeline** (limited to
> `$addFields`/`$set`, `$project`/`$unset`, `$replaceRoot`/`$replaceWith`), a plain replacement
> document is **not permitted** (*"to update with a replacement document, see
> `db.collection.replaceOne()`"*), *"specify an empty document `{ }` to update all documents in
> the collection"*, and with `upsert: true` a non-matching update *"creates a new document based
> on the filter and update parameters"* with a generated `_id` — plus, on a sharded collection,
> an upsert *"must include the full shard key in the filter"* — and
> [Field update operators](https://www.mongodb.com/docs/manual/reference/operator/update-field/)
> for `$setOnInsert`.
> **Documentation-validated; no console blocks.**

```js
db.orders.updateOne({ _id: id }, { $set: { status: "shipped" } });
db.orders.updateMany({ status: "pending" }, { $set: { status: "expired" } });
```

Two methods, one filter, one update document. Three things about them are worth knowing before
you write to production data.

## 1 · An update must use operators — or it is a replacement

```js
{ $set: { status: "shipped" } }     // ✅ modifies one field
{ status: "shipped" }               // ⚠️ a replacement — every other field is gone
```

The second is not an error in `updateOne`/`replaceOne`: it **replaces the whole matched
document** with what you supplied. Name, email, timestamps, everything unmentioned — gone, with
only `_id` preserved.

🔴 **`updateMany` refuses it outright.** Its update parameter must be operator expressions or an
aggregation pipeline, and the docs redirect you to `replaceOne` for replacement. So the
worst-case version — replacing every matched document — is prevented by the API.

**The habit: type the operator first.** Write `{ $set: {} }` and then fill it in, so a forgotten
`$set` cannot happen.

## 2 · The filter is everything

`updateOne` modifies **the first matching document** — chosen by the plan, exactly as in
[`findOne`](./03-findone.md), so with several matches it is not deterministic without a sort.
`updateMany` modifies all of them.

⚠️ **An empty filter matches everything.** The Manual says so plainly for `updateMany`. The
realistic accident is not typing `{}` but building a filter from a variable that came back
undefined ([Phase 2](../phase-2-mongosh/05-shell-safety.md)).

**Count first, with the same filter.** It is the cheapest check available and it is exact.

## 3 · `upsert` — the idempotency tool

```js
db.carts.updateOne(
  { userId, "items.sku": { $ne: sku } },
  { $push: { items: { sku, qty: 1 } } },
  { upsert: true },
);
```

With `upsert: true`, a filter that matches nothing **creates a document** built from the filter
and the update, with a generated `_id`. That is what makes "create it if it does not exist"
a single atomic statement rather than a read-then-write race.

`$setOnInsert` applies **only** when the upsert inserts:

```js
db.users.updateOne(
  { email },
  {
    $set: { lastSeenAt: new Date() },
    $setOnInsert: { createdAt: new Date(), plan: "free" },
  },
  { upsert: true },
);
```

`lastSeenAt` is written every time; `createdAt` and `plan` only on creation. **That pair is the
canonical upsert**, and it is worth memorising.

⚠️ **On a sharded collection an upsert must include the full shard key in the filter.**

## The phase gate: add-to-cart, atomically

*"Add this item to the cart, or increment its quantity if it is already there"* — as one
statement, with no transaction:

```js
// 1. increment if the line exists
const res = await carts.updateOne(
  { userId, "items.sku": sku },
  { $inc: { "items.$.qty": 1 } },
);

// 2. otherwise add the line — the filter guarantees it is not already there
if (res.matchedCount === 0) {
  await carts.updateOne(
    { userId, "items.sku": { $ne: sku } },
    { $push: { items: { sku, qty: 1 } }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}
```

**Why no transaction:** a cart is one document, and writes to a single document are atomic
([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)). Two concurrent
requests cannot interleave inside one update. The second statement's `$ne` filter is what makes
it safe to run after a lost race — if another request added the line in between, the filter no
longer matches and the `$push` does not happen, so the item cannot be duplicated.

🔴 **This is the shape to remember:** the schema decision (the cart is one document) is what
removes the need for a transaction. Modelling and concurrency are the same subject
([Phase 3](../phase-3-schema-design/README.md)).

## Reading the result

```js
{ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedId: null }
```

- **`matchedCount`** — how many documents the filter found.
- **`modifiedCount`** — how many actually changed. **It can be 0 with `matchedCount: 1`** when
  the value was already what you set, which is not a failure and is a useful signal for "did
  anything really change?".
- **`upsertedId`** — set when an upsert inserted, so you can tell creation from update.

**Check `matchedCount` when you care whether the target existed** — a 404 versus a no-op
distinction that `modifiedCount` alone cannot make.

## Gotchas

**Symptom:** a document lost most of its fields.
**Cause:** `updateOne` with a plain document — a replacement, not a modification.
**Fix:** always start with an operator. `updateMany` rejects this; single-document writes do not.

**Symptom:** an update touched the whole collection.
**Cause:** an empty filter, usually from an undefined variable.
**Fix:** count with the exact filter first, and assert the count before writing.

**Symptom:** a typo'd filter created a strange new document.
**Cause:** `upsert: true` with a filter that matched nothing.
**Fix:** verify matches before enabling upsert; treat upsert as a write mode, not a convenience.

**Symptom:** `modifiedCount: 0` and the code treats it as failure.
**Cause:** the document already had that value, so nothing changed.
**Fix:** branch on `matchedCount` for existence; `modifiedCount` answers a different question.

**Symptom:** `updateOne` keeps updating a different document than expected.
**Cause:** several documents match and the first is plan-dependent.
**Fix:** filter on something unique, or use `findOneAndUpdate` with a sort.

**Symptom:** an upsert fails on a sharded collection.
**Cause:** the filter does not contain the full shard key, which is required.
**Fix:** include it.

## Interview questions

**★ What happens if you pass a document without update operators?**
For `updateOne` and `replaceOne` it is a **replacement**: the matched document is replaced
wholesale and every field you did not mention disappears, keeping only `_id`. `updateMany`
refuses it — its update must be operator expressions or an aggregation pipeline, and the docs
point you at `replaceOne` — so the most destructive version is blocked by the API rather than by
your care.

**★ Write an idempotent "add to cart or increment quantity" as a single atomic operation.**
First `updateOne({userId, "items.sku": sku}, {$inc: {"items.$.qty": 1}})`. If `matchedCount` is
0, `updateOne({userId, "items.sku": {$ne: sku}}, {$push: {items: {sku, qty: 1}}}, {upsert:
true})`. It needs no transaction because a cart is a single document and single-document writes
are atomic; the `$ne` in the second filter means a concurrent request that added the line first
causes this one to match nothing rather than duplicating it.

**★ What does `upsert` do, and what is `$setOnInsert` for?**
`upsert: true` turns a no-match into an insert, building the new document from the filter and
the update with a generated `_id` — which makes "create if absent" one atomic statement instead
of a read-then-write race. `$setOnInsert` marks the fields that should be written only when that
insert happens, such as `createdAt` and a default plan, while `$set` fields are applied on every
run.

**★ What is the difference between `matchedCount` and `modifiedCount`?**
`matchedCount` is how many documents the filter found; `modifiedCount` is how many actually
changed. They differ when the document already held the value you set — a no-op, not a failure.
Existence checks belong on `matchedCount`; "did anything really change" belongs on
`modifiedCount`.

**Why is `updateOne` non-deterministic with multiple matches?**
Because it updates the first document the plan returns, exactly like `findOne`, and the plan can
change. If which document matters, make the filter unique or use `findOneAndUpdate` with an
explicit sort.

**What is required for an upsert on a sharded collection?**
The full shard key must appear in the filter; otherwise the operation is rejected, because the
server cannot decide which shard the new document belongs to.

---

← Prev: [Projection](./04-projection.md) ·
Index: [Phase 4](./README.md) ·
Next → [Field update operators](./06-field-update-operators.md)
