---
title: "Logical operators"
sidebar_label: "02 · Logical"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Query Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/) for the
> `{ <field1>: <value1>, … }` filter shape, and
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/) for reading
> the plan of a multi-branch query (`winningPlan` as a tree of stages, `rejectedPlans`,
> `totalKeysExamined` / `totalDocsExamined`).
> **Documentation-validated; no console blocks.**

| Operator | Meaning |
|---|---|
| implicit AND | several fields in one filter document |
| `$and` | explicit AND over an array of filters |
| `$or` | any branch matches |
| `$nor` | **no** branch matches |
| `$not` | inverts a single operator expression on one field |

## AND is implicit — until it cannot be

```js
{ status: "open", total: { $gt: 100 } }        // AND, no operator needed
```

**`$and` is only required when a single document cannot express the conditions**, and there are
exactly two such cases:

**1 · The same field twice.**

```js
// ❌ an object cannot hold the same key twice — the last one silently wins
{ tags: "a", tags: "b" }

// ✅
{ $and: [{ tags: "a" }, { tags: "b" }] }
```

This matters most on arrays, where "has tag a **and** tag b" is a real requirement.
`{tags: {$all: ["a", "b"]}}` says the same thing more directly
([topic 06](./06-array-matching.md)).

**2 · The same operator twice on one field.**

```js
// ❌ duplicate key again
{ $expr: …, $expr: … }

// ✅
{ $and: [{ $expr: … }, { $expr: … }] }
```

🔴 **The duplicate-key hazard is the reason to know this.** A query document is a document, so
a repeated key is not an error — the earlier condition simply disappears, and the query returns
too many documents.

## `$or` and its index problem

```js
db.orders.find({ $or: [{ status: "open" }, { total: { $gt: 1000 } }] });
```

MongoDB evaluates each branch separately and unions the results. So **each branch needs its own
usable index** — one branch without one drags the whole query toward a collection scan, no
matter how well-indexed the others are.

**Diagnosis:** `explain()` the branches individually
([Phase 2](../phase-2-mongosh/04-explain.md)). A combined explain tells you the query is slow; a
per-branch explain tells you which branch is the problem.

**Two rewrites that often help:**

```js
// same field, many values → $in, one index seek per value
{ $or: [{ status: "open" }, { status: "pending" }] }
{ status: { $in: ["open", "pending"] } }                    // ✅ better

// genuinely different fields → index both, or split into two queries and merge
```

⚠️ **`$or` at the top level is not the same as `$or` nested inside another field's condition.**
Keep `$or` at the top of the filter where possible; a deeply nested one is harder for the
planner and harder for the reader.

## `$nor` — rarely needed, occasionally exact

```js
{ $nor: [{ status: "open" }, { archived: true }] }    // neither open nor archived
```

`$nor` matches documents where **no** branch is true — including documents **missing the fields
entirely**, for the same reason `$ne` matches missing fields
([topic 01](./01-comparison-operators.md)). That is usually what makes it surprising rather than
wrong.

Like all negations it cannot use an index to seek, so it reads broadly. Reach for it when the
positive form is genuinely unwriteable.

## `$not` — one field, one operator expression

```js
{ price: { $not: { $gt: 100 } } }        // NOT (price > 100)
```

Two things to know:

- **`$not` takes an operator expression, not a value.** `{price: {$not: 100}}` is invalid;
  `{price: {$ne: 100}}` is what you meant.
- **It matches documents where the field is missing**, because "not greater than 100" is
  vacuously true of a field that is not there. `{price: {$lte: 100}}` does **not** match those
  — which is the practical difference between the two ways of writing the same idea.

## Negation and indexes, in one line

**Positive predicates seek; negative predicates scan.** `$ne`, `$nin`, `$not` and `$nor` all
describe "everything except", which an index cannot jump to. When a negated query is slow, the
fix is nearly always to express the positive set instead.

## Gotchas

**Symptom:** a filter appears to ignore one of its conditions.
**Cause:** duplicate keys in the query document — the later one wins.
**Fix:** `$and` with an array, or `$all` for the array case.

**Symptom:** an `$or` query is slow although "everything is indexed".
**Cause:** one branch has no usable index and drags the whole query down.
**Fix:** explain each branch separately; index the weak branch or rewrite it.

**Symptom:** `$or` over one field is slower than expected.
**Cause:** it is `$in` written the long way.
**Fix:** use `$in`.

**Symptom:** `$nor` or `$ne` returns documents that do not have the field at all.
**Cause:** absence satisfies negation.
**Fix:** add `$exists: true` if you meant "has the field, and…".

**Symptom:** `{price: {$not: 100}}` errors.
**Cause:** `$not` needs an operator expression, not a bare value.
**Fix:** `{price: {$ne: 100}}`.

**Symptom:** two ways of writing the same negative give different results.
**Cause:** `$not: {$gt: 100}` includes missing fields; `$lte: 100` does not.
**Fix:** decide whether missing counts, and write the one that says so.

## Interview questions

**★ When do you need an explicit `$and`?**
Only when one filter document cannot express the conditions — two conditions on the same field,
or the same operator twice. Because a filter is a BSON document, a repeated key is not an error:
the last occurrence silently wins and the earlier condition disappears, which returns too many
documents with nothing to show that anything went wrong.

**★ Why can an `$or` query be slow even when indexes exist?**
Because each branch is evaluated separately and needs its own usable index. A single
unindexed branch pulls the whole query toward a collection scan. The diagnosis is to explain the
branches individually; the common fixes are to collapse a same-field `$or` into `$in`, or to
index the weak branch.

**★ Why do negations perform badly?**
Because an index lets you seek to values, and a negation describes everything except a value, so
there is nothing to seek to. `$ne`, `$nin`, `$not` and `$nor` therefore examine broadly.
Rewriting to the positive set — the values you do want — usually restores index use.

**What is the difference between `{price: {$not: {$gt: 100}}}` and `{price: {$lte: 100}}`?**
The first also matches documents with no `price` field, since "not greater than 100" is vacuously
true when there is no value; the second matches only documents that have a price of 100 or less.
Choosing between them is really deciding whether absence counts.

**What does `$nor` match?**
Documents where none of its branches is true, including documents missing the fields entirely.
It is exact for "neither of these", and like other negations it cannot use an index to seek.

---

← Prev: [Comparison operators](./01-comparison-operators.md) ·
Index: [Phase 5](./README.md) ·
Next → [Element operators — `$exists` and `$type`](./03-element-operators.md)
