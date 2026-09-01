---
title: "$project vs $addFields / $set"
sidebar_label: "03 · $project vs $addFields / $set"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [`$project`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/): the four
> specification forms (`<field>: 1|true` inclusion, `_id: 0|false` suppression, `<field>: <expression>`
> add-or-reset, `<field>: 0|false` exclusion); `_id` is **included by default**; 🔴 *"if you specify
> the exclusion of a field other than `_id`, you cannot employ any other `$project` specification
> form"*; the **path collision** error for `{contact: 1, "contact.address.country": 1}`; `$literal`
> for numeric and boolean literals; a new array field substitutes **`null`** for a non-existent
> field; `$$REMOVE` for conditional exclusion, which is **exempt** from the mixing rule; an **empty
> specification is an error**; array indices are not supported; `$unset` as the exclusion
> alternative —
> [`$set`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/set/): `$set` is an
> **alias for `$addFields`**, and both are *"equivalent to a `$project` stage that explicitly
> specifies all existing fields in the input documents and adds the new fields"*; *"if the name of the
> new field is the same as an existing field name (including `_id`), `$set` overwrites the existing
> value"*; dot notation adds into embedded documents; `$concatArrays` appends to an array —
> [Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
> for automatic projection pruning and the fact that a hand-written early `$project` is *"unlikely to
> improve performance"*.
> **Documentation-validated; no console blocks.**

These three stages all put a computed value on a document. Choosing between them is not style — it
decides whether the fields you did not mention still exist.

| Stage | Output |
|---|---|
| `$project` | **only** what you name (plus `_id` unless suppressed) — a reshape |
| `$addFields` | everything that came in, **plus** what you name |
| `$set` | identical to `$addFields` — it is an alias |

The Manual defines the relationship precisely: `$addFields`/`$set` are *"equivalent to a `$project`
stage that explicitly specifies all existing fields in the input documents and adds the new fields."*
`$addFields` is `$project` with an implicit "and keep the rest".

## `$set` and `$addFields` are the same stage

Not similar — **the same stage under two names.** `$set` was added as an alias so the aggregation
stage reads like the update operator of the same name, which people already knew. There is no
behavioural difference and no performance difference.

```js
{ $addFields: { revenue: { $multiply: ["$qty", "$price"] } } }
{ $set:       { revenue: { $multiply: ["$qty", "$price"] } } }   // identical
```

Pick one and use it consistently in a codebase. `$set` reads better next to update syntax; `$addFields`
is more literal about what it does and is unambiguous in a file that also contains `$set` *update*
operators. Either is fine; mixing them in one pipeline is just noise.

## The rule that catches everyone: no mixing inclusion and exclusion

This is the `$project` rule to memorise, and the Manual states it as a hard restriction: **if you
specify exclusion of a field other than `_id`, you cannot employ any other specification form.**

```js
{ $project: { rated: 0, title: 1 } }        // ❌ error — exclusion of a non-_id field, plus inclusion
{ $project: { _id: 0, title: 1, rated: 1 } } // ✅ suppressing _id is the one allowed mix
{ $project: { rated: 0, type: 0 } }          // ✅ pure exclusion — everything else survives
{ $project: { title: 1, year: 1 } }          // ✅ pure inclusion — _id comes along uninvited
```

So a `$project` is one of exactly two things: **an allowlist** or a **denylist**. `_id` is the sole
exception, because it is included by default and suppressing it is the most common thing anyone
wants.

The practical read: the moment you find yourself wanting "everything except `password`, but also add
`fullName`", `$project` is the wrong stage. Use `$unset` to drop, or `$addFields` to add — or both,
in that order.

```js
{ $addFields: { fullName: { $concat: ["$first", " ", "$last"] } } },
{ $unset: ["password", "resetToken"] }
```

**`$$REMOVE` is exempt** from the restriction, and is the escape hatch when the exclusion must be
conditional:

```js
{ $project: {
    title: 1,
    "imdb.votes": {
      $cond: { if: { $in: ["$imdb.votes", [null, ""]] }, then: "$$REMOVE", else: "$imdb.votes" },
    },
} }
```

That is an *expression* form, not an exclusion form, which is why it composes with inclusions.

## `$project` is destructive, and that is the whole risk

A `$project` deletes every field you did not name. That is the intent — it is a reshaping stage — but
it is also how a pipeline silently stops working three stages later.

```js
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $project: { customerId: 1, total: 1 } },   // placedAt is gone from here on
  { $sort: { placedAt: -1 } },                 // sorts on null for every document
]);
```

No error. `placedAt` does not exist, a missing field is `null`, every document ties, and the order
is arbitrary. The same failure hits `$group` (one bucket keyed `null`), `$match` (zero results) and
`$lookup` (`localField` resolves to nothing, so every document joins to whatever has a null key).

**The default choice is `$addFields`/`$set`.** Reach for `$project` when you are deliberately shaping
the *final* output, and put it last. The Manual's own note agrees on both halves: `$project` *"should
typically be the last stage"*, and using it mid-pipeline to reduce fields *"is unlikely to improve
performance"* because the optimizer already prunes fields nobody downstream reads.

That last point is worth stating flatly, because it is the most common piece of folklore in
aggregation: **a `$project` early in a pipeline does not make it faster.** The projection optimization
is automatic. The stage you want early is `$match`.

## What both stages can do

**Compute a new field** from others:

```js
{ $set: { lineTotal: { $multiply: ["$qty", "$unitPrice"] } } }
```

**Overwrite an existing one.** The Manual is explicit that a new field with an existing name —
**including `_id`** — overwrites it. That is useful (`{$set: {status: {$toLower: "$status"}}}`) and
dangerous (`{$set: {_id: "$sku"}}` is legal, and now your `_id` is a SKU).

**Reach into embedded documents with dot notation**, adding rather than replacing the parent:

```js
{ $set: { "imdb.normalizedRating": { $multiply: ["$imdb.rating", 10] } } }
```

Compare that with `{$set: {imdb: {normalizedRating: …}}}`, which **replaces the whole `imdb`
subdocument** with one containing a single field. The dot is not cosmetic.

**Append to an array**, which needs `$concatArrays` because there is no `$push` outside `$group`:

```js
{ $set: { genres: { $concatArrays: ["$genres", ["Classic"]] } } }
```

**Rename**, in `$project`, by assigning the old path to a new name — `{$project: {movieTitle:
"$title"}}`. Note the original does not survive unless you also include it, which is what "rename"
means here.

## The sharp edges of `$project` syntax

**A literal `1`, `0` or `true` is a flag, not a value.** To set a field *to* the boolean `true` you
need `$literal`:

```js
{ $project: { title: 1, isFeatured: { $literal: true } } }   // without $literal this reads as inclusion
```

**Path collisions are an error.** You cannot specify both a subdocument and a field inside it:

```js
{ $project: { contact: 1, "contact.address.country": 1 } }   // ❌ path collision
```

**A non-existent field in an inclusion is ignored** — `$project` does not add it. But a non-existent
field inside a **new array** becomes `null`, per the Manual's example: `{myArray: ["$year",
"$runtime", "$someField"]}` yields `[1903, 11, null]`. Same absence, two different results, depending
on the form.

**An empty specification is an error.** `{$project: {}}` does not mean "keep everything".

**Array indices are not supported.** `{$project: {"cast.0": 1}}` does not do what it looks like — use
`$arrayElemAt`:

```js
{ $project: { leadActor: { $arrayElemAt: ["$cast", 0] } } }
```

## Choosing, in one paragraph

Use **`$set`/`$addFields`** for everything computed mid-pipeline — it is non-destructive, so nothing
downstream breaks when someone adds a stage. Use **`$unset`** to drop fields, because it says only
that and carries none of the mixing restrictions. Use **`$project`** once, at the end, to shape the
document the client actually receives — an allowlist, `_id: 0` if the client does not need it, and
computed presentation fields alongside. Three stages, three jobs.

## Gotchas

**Symptom:** `$project` errors with a message about inclusion and exclusion.
**Cause:** you excluded a field other than `_id` and also named something else. The Manual bars every
other specification form once a non-`_id` exclusion is present.
**Fix:** make it a pure allowlist or a pure denylist. To drop *and* add, use `$unset` plus `$addFields`.

**Symptom:** a `$sort`, `$group` or `$match` further down the pipeline silently produces nothing, or
one `null` bucket.
**Cause:** an earlier `$project` removed the field it keys on. Missing is `null`, not an error.
**Fix:** use `$addFields`/`$set` mid-pipeline and keep `$project` for the last stage.

**Symptom:** `{$set: {imdb: {rating10: …}}}` wiped out the rest of `imdb`.
**Cause:** assigning to the parent replaces the whole subdocument.
**Fix:** dot notation — `{$set: {"imdb.rating10": …}}` — which adds into the existing document.

**Symptom:** a field was set to `true` and came back as an inclusion projection instead.
**Cause:** in `$project`, `1`/`0`/`true`/`false` are specification flags.
**Fix:** wrap the literal: `{$literal: true}`.

**Symptom:** `{$project: {contact: 1, "contact.phone": 1}}` errors.
**Cause:** path collision — a subdocument and a field within it cannot both be specified.
**Fix:** pick one level. `contact: 1` already includes `contact.phone`.

**Symptom:** an early `$project` was added to "reduce the data" and nothing improved.
**Cause:** the optimizer already prunes unread fields; the Manual says the manual version is *"unlikely
to improve performance"*.
**Fix:** delete it. Optimise the `$match` and its index instead.

**Symptom:** `_id` keeps appearing in an API response.
**Cause:** it is included by default in `$project`, and `$addFields` never removes anything.
**Fix:** `{$project: {_id: 0, …}}` — the one exclusion that may sit alongside inclusions — or
`{$unset: "_id"}`.

**Symptom:** `{$project: {"items.0.sku": 1}}` returns nothing useful.
**Cause:** array indices are not supported in a projection path.
**Fix:** `{$arrayElemAt: ["$items", 0]}`, then reach into the result.

**Symptom:** `$set` on a field name that already exists destroyed the original value, and it was
needed later.
**Cause:** documented behaviour — a matching name overwrites, `_id` included.
**Fix:** write to a new name, or capture the original first with another `$set`.

**Symptom:** a codebase has both `$set` and `$addFields` and a reviewer asks which is faster.
**Cause:** they are the same stage; `$set` is an alias.
**Fix:** pick one for consistency. There is nothing to measure.

**Symptom:** `{$project: {}}` was used to mean "no change".
**Cause:** an empty specification is an error.
**Fix:** remove the stage.

## Interview questions

**★ What is the difference between `$project`, `$addFields` and `$set`?**
`$set` is an alias for `$addFields` — the same stage. Both output every incoming field plus the ones
you name; the Manual defines them as equivalent to a `$project` that explicitly lists all existing
fields and adds the new ones. `$project` is a reshaping stage: it outputs **only** what you name,
plus `_id` unless suppressed. So the difference that matters is destructiveness — `$project` deletes
everything unmentioned, and the other two delete nothing.

**★ Why can't you write `{$project: {password: 0, fullName: {$concat: [...]}}}`?**
Because excluding a field other than `_id` bars every other specification form in the same `$project`
— it must be a pure denylist or a pure allowlist. Suppressing `_id` is the single documented
exception. The conditional-exclusion form `$$REMOVE` is also exempt, since it is an expression rather
than an exclusion flag. For "drop this and add that", use `$unset` followed by `$addFields`.

**★ Where should `$project` go in a pipeline, and why not early?**
Last. The Manual says it *"should typically be the last stage"* and that placing it early to reduce
fields *"is unlikely to improve performance"*, because the optimizer already determines which fields
are needed and prunes the rest automatically. Placing it early buys nothing and costs a real risk:
any field it drops is `null` for every stage below, which turns a later `$sort`, `$group` or `$match`
into a silent no-op.

**★ What happens if a `$set` names a field that already exists?**
It overwrites it — the Manual states this explicitly, and notes it applies to `_id` too. That is the
mechanism behind normalising a field in place (`{$set: {status: {$toLower: "$status"}}}`), and also
the reason a careless `$set` can replace a primary key or wipe an embedded document when you assign to
the parent instead of using dot notation.

**How do you add a field inside an embedded document without destroying its siblings?**
Dot notation: `{$set: {"imdb.normalizedRating": {$multiply: ["$imdb.rating", 10]}}}`. Assigning to
`imdb` directly replaces the whole subdocument with the one you supplied.

**How do you set a field to the literal value `1` or `true` in a `$project`?**
`$literal` — `{$project: {isFeatured: {$literal: true}}}`. Bare `1`, `0`, `true` and `false` are read
as inclusion and exclusion flags.

**Why does `{$project: {contact: 1, "contact.address.country": 1}}` fail?**
Path collision: a `$project` cannot specify both an embedded document and a field within it.
`contact: 1` already includes everything beneath it.

**How would you exclude a field only when it is empty?**
`$$REMOVE` inside a `$cond`, as the Manual's `imdb.votes` example does. It removes the field for that
document only, and because it is an expression it can sit alongside ordinary inclusions.

**Can you project an array element by index?**
Not with a path — array indices are unsupported in `$project` specifications. Use `$arrayElemAt`, or
`$slice`, or `$unwind` if the pipeline should operate on the elements themselves.

---

← Prev: [`$match` first, always](./02-match-first.md) ·
Index: [Phase 6](./README.md) ·
Next → [`$group` and the accumulators](./04-group-and-accumulators.md)
