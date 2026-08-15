---
title: "Comparison operators"
sidebar_label: "01 · Comparison"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/):
> the type ordering MinKey → Null → Numbers → Symbol/String → Object → Array → BinData →
> ObjectId → Boolean → Date → Timestamp → Regex → JavaScript → MaxKey, that *"MongoDB treats
> all numeric types as equivalent for comparison purposes"*, that *"non-existent fields are
> treated as if they were null"*, and that an empty array sorts before null or a missing field
> — and
> [`$exists`](https://www.mongodb.com/docs/manual/reference/operator/query/exists/) for the
> documented recommendation to use **`$ne: null`** when you want fields with a non-null value.
> **Documentation-validated; no console blocks.**

| Operator | Matches |
|---|---|
| `$eq` | equal to the value (the default when you write `{field: value}`) |
| `$ne` | **not** equal — including documents where the field is missing |
| `$gt`, `$gte`, `$lt`, `$lte` | ordered comparison, **within the type bracket** |
| `$in` | equal to any value in the array |
| `$nin` | equal to none of them — including documents where the field is missing |

The operators are unremarkable. Their behaviour **across types and across missing fields** is
where the bugs live.

## Type bracketing, restated because it matters

`{price: {$gt: 100}}` compares only within the numeric bracket. A document with
`price: "150"` is not matched — strings sort above all numbers, so a string can never satisfy a
numeric range ([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)).

**No error. Fewer results.** A revenue report built on that filter is silently wrong, and stays
wrong until someone counts by hand.

⚠️ **The mercy:** all numeric types compare as equivalent, so a range spans `int`, `long`,
`double` and `Decimal128` without enumerating them.

## `$ne` and `$nin` match missing fields

This is the second big one.

```js
// documents: { _id: 1, status: "open" }, { _id: 2, status: "closed" }, { _id: 3 }
db.orders.find({ status: { $ne: "open" } });     // matches 2 AND 3
```

Document 3 has no `status` at all, and "not equal to open" is true of a field that is not
there. The same applies to `$nin`.

**Whether that is right depends on your intent**, which is exactly why it must be deliberate:

```js
{ status: { $ne: "open" } }                      // "not open", including unset
{ status: { $ne: "open", $exists: true } }       // "has a status, and it is not open"
```

🔴 **Negation also costs you the index.** `$ne` and `$nin` cannot use an index to *seek* — they
describe everything except a value, so the server must examine broadly. Prefer a positive
predicate when you can: `{status: {$in: ["closed", "cancelled"]}}` uses the index that
`{status: {$ne: "open"}}` cannot.

## `$in` is the workhorse

```js
db.orders.find({ status: { $in: ["open", "pending"] } });
db.orders.find({ _id: { $in: idsFromTheOtherQuery } });      // the "join" you do in the app
```

`$in` uses indexes well and is the standard way to fetch many documents by key — the second
half of a two-query read in a referenced model
([Phase 3](../phase-3-schema-design/04-one-to-many.md)).

⚠️ **Keep the list bounded.** A `$in` with a hundred thousand ids is a very large query
document and a lot of index seeks; page the ids, or reconsider the access pattern.

⚠️ **`$in` with regexes is allowed**, and each pattern carries its own index behaviour
([topic 04](./04-regex.md)) — a list of unanchored patterns is a scan wearing a list's clothing.

## Null, missing, and the recommended alternative

```js
{ price: null }                    // explicit null OR missing
{ price: { $exists: false } }      // missing only
{ price: { $ne: null } }           // has a real, non-null value
```

The Manual recommends **`$ne: null`** as the way to find documents whose field has a non-null
value — it needs no sparse index and expresses the intent directly. It is the positive form of
the question people usually mean when they reach for `$exists`
([topic 03](./03-element-operators.md)).

## Sorting a mixed field

Because comparison is type-ordered, sorting a field with several types groups by type. Two
documented details worth carrying:

- **Missing fields sort as null** — `{}` and `{price: null}` are equivalent to a sort.
- **An empty array sorts before null and before a missing field.**

If a "cheapest first" listing shows odd values at the top, that is the type ordering, not a bug
in the sort.

## Gotchas

**Symptom:** a range query returns fewer documents than a manual count.
**Cause:** some values are strings; comparison is bracketed by type.
**Fix:** audit with `$type`, migrate, add schema validation. Do not add a string branch to the
query.

**Symptom:** `{status: {$ne: "open"}}` returns documents with no status.
**Cause:** a missing field satisfies "not equal".
**Fix:** add `$exists: true`, or invert to a positive `$in` — which also restores index use.

**Symptom:** a query with `$ne` is slow despite an index.
**Cause:** negation cannot seek in an index.
**Fix:** rewrite as `$in` over the values you do want.

**Symptom:** a large `$in` query is slow or rejected.
**Cause:** the list is enormous — a big query document and many seeks.
**Fix:** page the ids, or reshape the access pattern so the list stays bounded.

**Symptom:** an ascending sort shows empty arrays and nulls above real values.
**Cause:** documented ordering — `[]` sorts before null and missing, and both sort below
numbers.
**Fix:** none; know it. Filter them out explicitly if the listing should not show them.

**Symptom:** `{price: {$exists: true}}` includes documents whose price is null.
**Cause:** `$exists: true` matches a present field, null included.
**Fix:** `$ne: null` when you mean "has a real value" — the Manual's own recommendation.

## Interview questions

**★ Why does `{price: {$gt: 100}}` miss documents whose price is `"150"`?**
Because comparison is bracketed by BSON type and strings sort above all numbers, so a string can
never satisfy a numeric range. Nothing errors — the result is just quietly smaller, which is why
type audits with `$type` matter. Within the numeric types there is no such problem: the Manual
says int, long, double and decimal are treated as equivalent for comparison.

**★ What does `{status: {$ne: "open"}}` match?**
Every document whose `status` is not `"open"`, **including documents with no `status` field at
all** — absence satisfies "not equal". If you mean "has a status and it is not open", add
`$exists: true`. And note that `$ne` cannot seek in an index, so the positive form
`{status: {$in: [...]}}` is usually both clearer and faster.

**★ Why prefer `$in` over `$ne` where you can?**
Because a positive predicate can use an index to seek directly to the matching values, while a
negation describes everything except a value and forces a broad examination. Rewriting
"not open" as "closed or cancelled" often turns a scan into an index lookup.

**How do you find documents where a field has a real value?**
`{field: {$ne: null}}` — the Manual's recommendation. `$exists: true` also matches fields
explicitly set to null, and `{field: null}` matches both null and missing, so neither expresses
"has a value".

**Why do empty arrays appear at the top of an ascending sort?**
Because an empty array sorts before null and before a missing field, and missing fields sort as
null. It is documented ordering rather than a defect, and it usually means the listing needs an
explicit filter.

---

← Index: [Phase 5](./README.md) ·
Next → [Logical operators](./02-logical-operators.md)
