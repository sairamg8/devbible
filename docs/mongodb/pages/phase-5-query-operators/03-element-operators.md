---
title: "Element operators — $exists and $type"
sidebar_label: "03 · Element operators"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`$exists`](https://www.mongodb.com/docs/manual/reference/operator/query/exists/): it
> *"matches documents that contain or do not contain a specified field, **including documents
> where the field value is `null`**"*; the documented performance table — `{$exists: true}` is
> most efficient on a **sparse index** (exact match, no `FETCH`), while **`{$exists: false}`
> cannot use an index and requires a `COLLSCAN`**, and on a non-sparse index both require a
> `FETCH`; the recommendation to use **`$ne: null`** when you only need non-null values, which
> *"doesn't require a sparse index"*; and that *"expressions do not support the `$exists`
> operator"*, where you use the `$type` aggregation operator to check for type `missing` —
> and [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) for `$type`
> aliases and the **`"number"`** alias matching int, decimal, double and long.
> **Documentation-validated; no console blocks.**

Two operators, one job: **asking about the field rather than the value.** In a database with no
schema, that is a question you will ask often.

## `$exists`

```js
{ deletedAt: { $exists: true } }     // the field is present — null included
{ deletedAt: { $exists: false } }    // the field is absent
```

🔴 **`$exists: true` matches a field set to `null`.** The Manual says so explicitly. So it
answers *"is this field present?"*, not *"does this field have a value?"* — and the second is
usually the question people mean.

The three states, and the query for each:

| You want | Query |
|---|---|
| the field is present, value or null | `{f: {$exists: true}}` |
| the field is absent | `{f: {$exists: false}}` |
| **the field has a real value** | **`{f: {$ne: null}}`** ← the Manual's recommendation |
| the field is absent **or** null | `{f: null}` |

### The performance table, which decides how you use it

| Query | Sparse index | Non-sparse index |
|---|---|---|
| `{$exists: true}` | **most efficient** — exact match, no `FETCH` | better than nothing, but needs a `FETCH` |
| `{$exists: false}` | **cannot use the index — `COLLSCAN`** | needs a `FETCH` |

Two consequences worth acting on:

- **`{$exists: false}` is expensive.** It is a scan on a sparse index and a fetch otherwise, so
  a "find the documents missing this field" job on a large collection is a full pass. Fine as a
  one-off migration query; not fine on a request path.
- **If you filter on presence often, a sparse index is the documented answer** — and
  `{$ne: null}` avoids needing one at all when non-null is what you mean.

⚠️ **`$exists` is not available inside aggregation expressions.** The Manual points at the
`$type` aggregation operator, checking for type `"missing"`, when you need the same test inside
`$expr` or a pipeline ([topic 05](./05-expr.md)).

## `$type`

```js
{ price: { $type: "string" } }                       // by alias
{ price: { $type: 2 } }                              // by type number
{ price: { $type: ["double", "int", "long", "decimal"] } }   // any of several
{ price: { $type: "number" } }                       // the alias for all four
```

`$type` matches on the **BSON type of the stored value**, which makes it the audit tool for a
schemaless collection ([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)).

**The `"number"` alias** — documented as matching int, decimal, double and long — is the one to
remember, because writing the four out by hand is exactly where people forget `decimal`.

### The audit query worth keeping

```js
// how many documents have a price that is not a number?
db.orders.countDocuments({ price: { $not: { $type: "number" } } });

// what types are actually in there?
db.orders.aggregate([{ $group: { _id: { $type: "$price" }, n: { $sum: 1 } } }]);
```

The second is the one to run on any collection you inherit. It answers "what am I dealing
with?" in a single pass, and it routinely finds a handful of strings in a numeric field — the
cause of the silently-short range queries in [topic 01](./01-comparison-operators.md).

⚠️ **`$type: "array"` matches a field whose value *is* an array.** Testing the *elements'* type
is a different question — `{"tags": {$type: "string"}}` matches if any element is a string,
because array conditions apply per element ([topic 06](./06-array-matching.md)).

## Using them together

```js
// documents where the field exists but holds the wrong type — the interesting ones
db.orders.find({ price: { $exists: true, $not: { $type: "number" } } });
```

This is the shape of a data-quality check: *present but wrong*, as opposed to *missing*, which
is usually a separate and more benign problem.

## Gotchas

**Symptom:** `{f: {$exists: true}}` returns documents where `f` is null.
**Cause:** documented behaviour — presence includes null.
**Fix:** `{f: {$ne: null}}` for "has a real value".

**Symptom:** a "find documents missing this field" query takes minutes.
**Cause:** `{$exists: false}` cannot use a sparse index and requires a collection scan; on a
non-sparse index it still fetches.
**Fix:** accept it as a batch operation, or maintain a marker field you can query positively.

**Symptom:** `$type: "int"` matches nothing on numeric-looking data.
**Cause:** values written from JavaScript are `double`
([Phase 1](../phase-1-documents-and-bson/04-numbers.md)).
**Fix:** query `"number"`, or write with `Int32`/`Long` if the width is part of the contract.

**Symptom:** `$exists` inside `$expr` does not work.
**Cause:** expressions do not support `$exists`.
**Fix:** the `$type` aggregation operator, checking for `"missing"`.

**Symptom:** a type audit misses `Decimal128` values.
**Cause:** the type list was written by hand and omitted `"decimal"`.
**Fix:** use the `"number"` alias.

**Symptom:** `{tags: {$type: "string"}}` matches documents where `tags` is an array.
**Cause:** conditions on an array field are evaluated per element.
**Fix:** `{tags: {$type: "array"}}` to test the field itself; `$elemMatch` to be precise about
elements.

## Interview questions

**★ What is the difference between `$exists: true` and `$ne: null`?**
`$exists: true` matches documents that *contain* the field, explicitly including ones where its
value is null. `$ne: null` matches documents where the field has a real, non-null value — which
is what people usually mean, and it is the Manual's own recommendation because it needs no
sparse index.

**★ Why is `{$exists: false}` slow?**
Because it cannot use a sparse index at all — the documented behaviour is a collection scan —
and on a non-sparse index it still requires a fetch. Asking "which documents lack this field" is
therefore a batch-shaped question, not a request-path one. `{$exists: true}` is the efficient
direction, and most efficient of all on a sparse index.

**★ How would you audit a collection for type drift?**
`db.coll.aggregate([{$group: {_id: {$type: "$price"}, n: {$sum: 1}}}])` — one pass, and it tells
you exactly which BSON types are present and in what proportion. Then `$type` filters to find
the offenders. Use the `"number"` alias rather than listing int, long, double and decimal by
hand, because the hand-written list is where `decimal` gets forgotten.

**Why does `$type: "int"` match nothing in data written from Node?**
Because a JavaScript number becomes a BSON `double`. Either query `"number"`, or write the
values with `Int32`/`Long` when the integer type is genuinely part of the contract.

**How do you test for a missing field inside an aggregation expression?**
Not with `$exists`, which expressions do not support — with the `$type` aggregation operator,
checking whether the field's type is `"missing"`.

---

← Prev: [Logical operators](./02-logical-operators.md) ·
Index: [Phase 5](./README.md) ·
Next → [`$regex`](./04-regex.md)
