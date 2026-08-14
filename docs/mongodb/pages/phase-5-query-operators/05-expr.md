---
title: "$expr"
sidebar_label: "05 · $expr"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`$expr`](https://www.mongodb.com/docs/manual/reference/operator/query/expr/): it *"allows the
> use of aggregation expressions within a query predicate"*, with the syntax
> `{ $expr: { <expression> } }` taking any valid aggregation expression; the documented example
> comparing two fields of the same document
> (`{ $expr: { $gt: [ "$tomatoes.viewer.rating", "$tomatoes.critic.rating" ] } }`); conditional
> logic with `$cond`; and the index limitations in a `$lookup` subpipeline — comparison
> operators can use indexes on the `from` collection, but only for comparisons against
> **constants**, not when the `let` operand resolves to empty or missing, and **multikey,
> partial and sparse indexes are not used** — and
> [`$exists`](https://www.mongodb.com/docs/manual/reference/operator/query/exists/) for the note
> that expressions do not support `$exists` and the `$type` aggregation operator checks for
> `"missing"`.
> **Documentation-validated; no console blocks.**

**The plain query language cannot compare two fields of the same document.** There is no way to
express "orders where `paid` is less than `total`" with `$lt`, because the right-hand side of a
query operator is a value, not a field reference.

`$expr` is the door between the two languages:

```js
db.orders.find({ $expr: { $lt: ["$paid", "$total"] } });    // underpaid orders
```

Inside `$expr` you are writing **aggregation expressions**, where `"$field"` means *the value of
that field in this document*. That one change of meaning is the whole feature.

## What it makes possible

**Field-to-field comparison** — the documented example compares a viewer rating with a critic
rating in the same document:

```js
db.movies.find({ $expr: { $gt: ["$tomatoes.viewer.rating", "$tomatoes.critic.rating"] } });
```

**Arithmetic in a predicate:**

```js
// line items where the extended price disagrees with qty × unitPrice
db.orders.find({
  $expr: { $ne: ["$lineTotal", { $multiply: ["$qty", "$unitPrice"] }] },
});
```

**Conditional logic**, with `$cond` — the Manual's own example scales a rating by whether the
vote count clears a threshold, then compares the result. That is a computation per document,
expressed in the filter.

**A guard against data you cannot trust:** the Manual's `$cond` example pairs `$expr` with
`{"imdb.rating": {$type: "number"}}` — an ordinary query condition alongside the expression,
because **arithmetic on a string is not an error in an expression; it is a wrong answer.**
Filter to the right types first ([topic 03](./03-element-operators.md)).

## What it costs

🔴 **`$expr` is evaluated per document.** A plain query predicate describes a set of values an
index can seek to; an expression is a computation, and a computation has to be run against
something. In the ordinary `find` case, that means **the expression itself does not drive an
index** — the query needs another indexed condition to narrow the candidates first.

```js
// ⚠️ the whole collection is a candidate
db.orders.find({ $expr: { $lt: ["$paid", "$total"] } });

// ✅ the index narrows first, the expression filters what survives
db.orders.find({
  status: "open",                                    // indexed
  $expr: { $lt: ["$paid", "$total"] },
});
```

**Always pair an `$expr` with an indexed predicate** unless the collection is small or the query
is a batch job. `explain()` will show the difference immediately in `totalDocsExamined`
([Phase 2](../phase-2-mongosh/04-explain.md)).

### The documented `$lookup` exception

Inside a `$match` in a `$lookup` subpipeline, comparison operators (`$eq`, `$lt`, `$lte`, `$gt`,
`$gte`) **can** use indexes on the `from` collection — with three documented restrictions:

- only for comparisons between a field and a **constant**, where the `let` operand resolves to a
  constant;
- **not** when the `let` operand resolves to an empty or missing value;
- **multikey, partial and sparse indexes are not used.**

Worth knowing before designing a joined pipeline around it, because the restrictions are exactly
the cases people assume will be fine.

## The other gap it fills

Expressions do **not** support `$exists`. The documented substitute is the `$type` aggregation
operator, testing for `"missing"`:

```js
db.orders.find({ $expr: { $eq: [{ $type: "$archivedAt" }, "missing"] } });
```

Useful when the existence test has to live inside a larger expression. For a plain "is this field
absent" query, `{archivedAt: {$exists: false}}` remains the right tool — and the more efficient
one ([topic 03](./03-element-operators.md)).

## When *not* to reach for it

- **When a plain operator will do.** `{$expr: {$eq: ["$status", "open"]}}` is a slower way to
  write `{status: "open"}` — it gives up the index for nothing.
- **When the comparison is against a constant.** Same reason.
- **When the real job is a pipeline.** If you need `$group`, `$lookup` or a projection of
  computed values, write an aggregation; `$expr` is for filtering in `find`, not for building a
  pipeline inside a query.

**The test: does the predicate need to look at more than one field of the document?** If not,
`$expr` is the wrong tool.

## Gotchas

**Symptom:** an `$expr` query scans the whole collection.
**Cause:** the expression cannot drive an index in a plain `find`.
**Fix:** add an indexed predicate to narrow the candidates first.

**Symptom:** an arithmetic comparison silently returns wrong documents.
**Cause:** some values are strings, and expression arithmetic does not error the way you expect.
**Fix:** add a `$type` condition alongside the `$expr`, as the Manual's own example does.

**Symptom:** `$exists` inside `$expr` does not work.
**Cause:** expressions do not support it.
**Fix:** `{$eq: [{$type: "$field"}, "missing"]}`.

**Symptom:** a `$lookup` subpipeline is slower than expected despite an index.
**Cause:** one of the documented restrictions — a non-constant `let` operand, an empty or missing
one, or a multikey, partial or sparse index.
**Fix:** check which of the three applies; restructure the join or the index.

**Symptom:** `$expr` returns documents where the field is missing.
**Cause:** a missing field is `null` in an expression, and `null` compares as less than numbers.
**Fix:** add an explicit type or existence condition rather than relying on the comparison.

**Symptom:** a simple equality was written with `$expr` and the query got slower.
**Cause:** the plain form is indexable; the expression form is not.
**Fix:** use the plain operator.

## Interview questions

**★ What does `$expr` let you do that the query language cannot?**
Compare two fields of the same document — "orders where `paid` is less than `total`" — because
the right-hand side of a normal query operator is a value, not a field reference. `$expr` admits
aggregation expressions into a query predicate, so `"$field"` means that document's value, and
arithmetic and `$cond` become available inside a filter.

**★ What does `$expr` cost?**
Index use, in the ordinary `find` case: the expression is evaluated per document, so it cannot
be used to seek. Every `$expr` query should be paired with an indexed predicate that narrows the
candidate set first, or accepted as a batch operation. There is a documented exception inside a
`$lookup` subpipeline, where comparison operators can use indexes on the `from` collection — but
only against constants, not when the `let` operand is empty or missing, and never with multikey,
partial or sparse indexes.

**★ Why does the Manual's `$cond` example include a `$type` check?**
Because expressions compute rather than validate: arithmetic on a value that turns out to be a
string does not fail in the way a strict language would, it produces a wrong answer. Filtering to
numeric types with an ordinary query condition alongside the expression is what keeps the result
meaningful.

**How do you test for a missing field inside an expression?**
`{$eq: [{$type: "$field"}, "missing"]}`, because expressions do not support `$exists`. For a
plain query, `$exists: false` is still both correct and more efficient.

**When is `$expr` the wrong tool?**
When the predicate only involves one field and a constant — `{$expr: {$eq: ["$status",
"open"]}}` is a slower, unindexable way of writing `{status: "open"}`. And when the real job
needs grouping, joining or computed output, in which case you want an aggregation pipeline rather
than an expression inside a find.

---

← Prev: [`$regex`](./04-regex.md) ·
Index: [Phase 5](./README.md) ·
Next → [Array matching — exact vs containment](./06-array-matching.md)
