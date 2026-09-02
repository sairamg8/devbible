---
title: "Every UNIQUE constraint became a unique index, and the one rule that breaks a careless port is that a missing field indexes as null"
sidebar_label: "4 · Unique indexes"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/)
> (*"If a document has a `null` or missing value for the indexed field in a
> unique single-field index, the index stores a `null` value for that document.
> Because of the unique constraint, a single-field unique index can only contain
> one document that contains a `null` value in its index entry"*; *"MongoDB cannot
> create a unique index on the specified index field(s) if the collection already
> contains data that would violate the unique constraint"*),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/)
> (the allowed operator list; *"To use the partial index, a query must contain the
> filter expression … as part of its query condition"*; *"You cannot specify both
> the `partialFilterExpression` option and the `sparse` option"*).
> Counterpart:
> [01·08 — constraints that vanish](../01-modeling-the-store/06-constraints-that-vanish.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's `UNIQUE` constraints all survive the port as unique indexes, and
[chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md) already
established that the enforcement is genuinely equivalent. What this chunk adds is
the *index* half of the story, and the one rule that breaks a careless port: in
SQL `UNIQUE` ignores nulls, and in MongoDB a missing field indexes **as** null and
collides with every other missing field. That rule is why two of this app's eight
unique indexes need a partial filter to be correct at all — and partial indexes as
a general tool are [the next chunk](03b-partial-indexes.md).**

## Unique is an index property, not a constraint object

> *"A unique index ensures that the indexed fields do not store duplicate values,
> and that a value appears at most once for a given field. A unique compound index
> ensures that any given combination of the index key values appears at most
> once."*
> — [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/)

That is the same guarantee `UNIQUE` gave, and it is enforced by the server on
every write, not by application code. The five straightforward ones port
one-for-one:

| Phase 1 | Phase 8 |
|---|---|
| `products.slug unique` | `createIndex({slug: 1}, {unique: true})` |
| `categories.slug unique` | `createIndex({slug: 1}, {unique: true})` |
| `orders.idempotency_key unique` | `createIndex({idempotencyKey: 1}, {unique: true})` |
| `sessions.token_hash unique` | `createIndex({tokenHash: 1}, {unique: true})` |
| `reviews unique (order_id, product_id)` | `createIndex({orderId: 1, productId: 1}, {unique: true})` |

The compound one is worth pausing on because it is the app's "one review per
product per order" rule, and MongoDB's compound uniqueness means the *combination*
— the same `orderId` may appear many times with different `productId` values, and
vice versa. Identical semantics to the SQL.

**A unique index is also an index.** That is not a tautology worth skipping: the
`orders.idempotencyKey` index exists to enforce the replay guarantee from
[chapter 03](../03-checkout-with-transactions/02-the-transaction.md), and the
checkout's replay *lookup* uses the same index for free. One structure, two jobs,
one write cost.

## Missing is a value, and there can only be one of it

This is the rule that turns a careless port into an outage:

> *"If a document has a `null` or missing value for the indexed field in a unique
> single-field index, the index stores a `null` value for that document. Because
> of the unique constraint, a single-field unique index can only contain one
> document that contains a `null` value in its index entry. If there is more than
> one document with a `null` value in its index entry, the index build fails with
> a duplicate key error."*

In SQL, `UNIQUE` ignores nulls: a nullable unique column can hold a thousand
rows with `NULL` and the constraint is satisfied, because `NULL = NULL` is
unknown. **MongoDB does the opposite.** A missing field indexes as `null`, `null`
indexes as `null`, and the unique constraint applies to that value like any
other — so the second document without the field is rejected.

That difference is the entire reason the `carts` indexes carry a partial filter.

## The two that needed a partial filter

`carts` has `userId` **or** `sessionId`, never both — a guest cart carries a
session and a logged-in cart carries a user. Phase 1 expressed this with two
partial unique indexes:

```sql
create unique index carts_one_per_user    on carts (user_id)    where user_id is not null;
create unique index carts_one_per_session on carts (session_id) where session_id is not null;
```

The naive MongoDB port drops the `where` and breaks immediately:

```js
// WRONG — the second guest cart fails with a duplicate key error
await db.collection('carts').createIndex({userId: 1}, {unique: true});
```

Every guest cart is missing `userId`, so every guest cart indexes as `null`, so
the second guest cart in the system is a duplicate. The correct port keeps the
predicate:

```js
await db.collection('carts').createIndex(
  {userId: 1},
  {unique: true, partialFilterExpression: {userId: {$type: 'objectId'}}});
await db.collection('carts').createIndex(
  {sessionId: 1},
  {unique: true, partialFilterExpression: {sessionId: {$type: 'objectId'}}});
```

The Manual states the interaction plainly: *"If you specify both the
`partialFilterExpression` and a unique constraint, the unique constraint only
applies to the documents that meet the filter expression."*

**`$type: 'objectId'` rather than `$exists: true`** is
[chapter 01·03's](../01-modeling-the-store/02b-the-cart-document.md) decision and
it is the sharper of the two spellings. `$exists: true` is on the Manual's allowed
operator list and does the job for a field that is either present-and-an-id or
absent — but it also indexes a document whose `userId` was explicitly written as
`null`, which is exactly the case the whole exercise is trying to exclude. A type
predicate cannot be satisfied by `null`.

## Gotchas

**★ A missing field indexes as `null`, so a unique index allows exactly one
document without the field.** This is the single biggest semantic difference from
SQL's `UNIQUE`, which ignores nulls entirely. Any nullable unique column ported
without a partial filter breaks on the second row.

**★ `$exists: true` in a partial filter still indexes an explicit `null`.** The
document `{userId: null}` satisfies `$exists: true` — the field is present, its
value is null — so it enters the index and collides with every other explicit
null. `$type: 'objectId'` excludes it, which is why this app uses the type
predicate.

**★ A unique index build fails if the data already violates it.** So a
drop-and-recreate on a live collection can leave you with no index and no way to
rebuild it until the duplicates are found and removed — during which time the
constraint is unenforced and more duplicates can arrive.

**★ The compound unique index on `reviews` constrains the pair, not the parts.**
`{orderId: 1, productId: 1}` unique permits many reviews per order and many per
product; it forbids only the same product reviewed twice from the same order.
Reading it as "one review per product" is the mistake, and it is the same mistake
the SQL invited.

## Interview questions

**★ What is the biggest semantic difference between SQL `UNIQUE` and a MongoDB
unique index?**
Null handling. SQL treats `NULL` as unknown, so a nullable unique column can hold
unlimited nulls without violating the constraint. MongoDB stores a `null` index
entry for a document whose field is null *or missing*, and the unique constraint
applies to that entry like any other value — so at most one such document can
exist. A nullable unique column ported literally therefore breaks on the second
row, and the fix is a `partialFilterExpression` that excludes the documents
without a real value.

**★ Why does this app use `$type: 'objectId'` rather than `$exists: true` in the
cart indexes?**
Because `$exists: true` is satisfied by an explicit `null`. A cart written with
`{userId: null}` has the field present, so it enters an `$exists`-filtered index
and collides with every other explicit null — reintroducing the exact bug the
partial filter was added to prevent. A type predicate cannot be satisfied by
null, so it excludes both the missing case and the explicitly-null case, and the
index holds only carts that genuinely belong to a user.

**★ How would you safely add `unique: true` to an existing non-unique index?**
Check the data first — an aggregation grouping by the key and matching groups with
a count above one — because a unique build fails on existing violations and you do
not want to discover that after dropping the working index. Then create the new
unique index under a different name so the collection is never without one, verify
it built, and only then drop the old. Doing it in the other order leaves a window
where the constraint is unenforced and the lookup is a scan, and a duplicate
arriving in that window blocks the rebuild.

---

← Prev: [What the list leaves out](02b-what-the-list-leaves-out.md) ·
Next → [Partial indexes](03b-partial-indexes.md)
