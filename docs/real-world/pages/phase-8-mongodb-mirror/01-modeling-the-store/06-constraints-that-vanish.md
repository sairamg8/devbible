---
title: "Unique indexes, collations and $jsonSchema: the constraints that survive, and what enforcement now means"
sidebar_label: "8 · Constraints that vanish"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/),
> [Specify Validation Level](https://www.mongodb.com/docs/manual/core/schema-validation/specify-validation-level/),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/),
> [Case Insensitive Indexes](https://www.mongodb.com/docs/manual/core/index-case-insensitive/),
> [`$jsonSchema`](https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The Postgres schema is two chapters of DDL and almost all of it is
constraints. Enumerated honestly, they fall into three piles: things that port
exactly, things that port with a change of shape and a change of what
"enforced" means, and things with no equivalent at all. This chunk covers the
first two piles. The third — every foreign key in the schema — is
[chunk 9](06b-no-equivalent.md), because it is the price of the
rewrite and deserves to be read as an invoice rather than a footnote.**

## The accounting

| Postgres | MongoDB | Pile |
|---|---|---|
| `unique (slug)`, `unique (idempotency_key)` | `createIndex({slug: 1}, {unique: true})` | **Exact** |
| `unique (order_id, product_id)` on reviews | compound unique index | **Exact** |
| `carts_one_per_user` partial unique index | `unique` + `partialFilterExpression` | **Exact** |
| `email citext` + `unique` | unique index with `collation {locale:'en', strength: 2}` | **Exact, with a catch** |
| `not null` | `required` in `$jsonSchema` | **Shape change** |
| `check (price_cents >= 0)` | `minimum: 0` in `$jsonSchema` | **Shape change** |
| `check (rating between 1 and 5)` | `minimum: 1, maximum: 5` | **Shape change** |
| `check (position between 0 and 2)` | `maxItems: 3` on the array | **Shape change** |
| `check (num_nonnulls(session_id, user_id) = 1)` | `oneOf` over two shapes | **Shape change, badly** |
| `create type order_status as enum (…)` | `enum: [...]` in `$jsonSchema` | **Shape change** |
| `check (stock >= 0)` | `minimum: 0` — **and the update filter** | **Shape change, load-bearing** |
| `search tsvector generated always as (…) stored` | nothing; a text index over the source fields | **Gone** — [chunk 9](06b-no-equivalent.md) |
| `references … on delete cascade / restrict` | **nothing** | **Gone** — [chunk 9](06b-no-equivalent.md) |

## Pile one: the exact ports

Unique indexes behave the way the relational ones did, *including under
concurrency*, which is the property that matters — checkout's replay guard is a
unique index and nothing else
(**chapter 03** *(not written yet)*).

```js
// migrations/mongo/002-indexes.js — the uniqueness half of the schema
await db.collection('products').createIndex({slug: 1}, {unique: true});
await db.collection('categories').createIndex({slug: 1}, {unique: true});
await db.collection('orders').createIndex({idempotencyKey: 1}, {unique: true});
await db.collection('reviews').createIndex({orderId: 1, productId: 1}, {unique: true});
await db.collection('sessions').createIndex({tokenHash: 1}, {unique: true});
await db.collection('users').createIndex(
  {email: 1}, {unique: true, collation: {locale: 'en', strength: 2}},
);
```

The Manual's definition is the one to hold onto: a unique index ensures *"the
indexed fields do not store duplicate values, and that a value appears at most
once for a given field"*, and for a compound index *"any given combination of the
index key values appears at most once"*.

**The catch on `email`.** `citext` made case-insensitivity a property of the
*type*, so every comparison anywhere was case-insensitive and forgetting was
impossible. A collated index is a property of the *index*, and the Manual is
explicit about what that costs:

> *"To use an index that specifies a collation, query and sort operations must
> specify the same collation as the index."*
> — [Case Insensitive Indexes](https://www.mongodb.com/docs/manual/core/index-case-insensitive/)

A login that forgets `.collation({locale: 'en', strength: 2})` does *not* error —
it does an exact-case match, misses the index, and tells the user their password
is wrong. This is the closest thing in the port to a genuine regression, and the
only real defence is that exactly one function reads users by email:

```js
// db/mongo/users.js — the ONLY place email is matched
const EMAIL_COLLATION = {locale: 'en', strength: 2};

export const findByEmail = (db, email) =>
  db.collection('users').findOne({email}, {collation: EMAIL_COLLATION});

export const createUser = (db, doc) =>
  db.collection('users').insertOne(doc);   // the index does the rest
```

The alternative — store a normalised `emailLower` field and index that plainly —
trades a forgettable collation for a forgettable normalisation, and wins the
moment more than one code path needs to match an email. The Manual also notes
that collated indexes *"do not improve performance for `$regex` queries"*, so an
admin "search users by email fragment" feature gets nothing from it either way.

## Pile two: `$jsonSchema`, and what "enforced" now means

The `NOT NULL`s, `CHECK`s and enums become one validator per collection.

```js
// migrations/mongo/001-collections.js
await db.createCollection('products', {
  validator: {$jsonSchema: {
    bsonType: 'object',
    required: ['slug', 'name', 'priceCents', 'stock', 'category', 'createdAt'],
    properties: {
      slug:       {bsonType: 'string', pattern: '^[a-z0-9-]+$'},
      name:       {bsonType: 'string', minLength: 1},
      priceCents: {bsonType: ['int', 'long'], minimum: 0},
      stock:      {bsonType: ['int', 'long'], minimum: 0},
      attributes: {bsonType: 'object'},          // deliberately unconstrained
      category:   {bsonType: 'object', required: ['_id', 'slug', 'name']},
      images:     {bsonType: 'array', items: {
                     bsonType: 'object', required: ['objectKey'],
                     properties: {objectKey: {bsonType: 'string'}}}},
      deletedAt:  {bsonType: ['date', 'null']},
    },
  }},
  validationLevel: 'strict',
  validationAction: 'error',
});

await db.createCollection('orders', {
  validator: {$jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'status', 'idempotencyKey', 'items', 'totalCents'],
    properties: {
      status: {enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled']},
      totalCents: {bsonType: ['int', 'long'], minimum: 0},
      items: {bsonType: 'array', minItems: 1, items: {
        bsonType: 'object',
        required: ['productId', 'name', 'qty', 'unitPriceCents'],
        properties: {
          qty:            {bsonType: ['int', 'long'], minimum: 1},
          unitPriceCents: {bsonType: ['int', 'long'], minimum: 0},
        }}},
    },
  }},
  validationLevel: 'strict', validationAction: 'error',
});
```

Four things in there are decisions, not boilerplate.

**`bsonType: ['int', 'long']`, never `'int'` alone.** A JavaScript number written
by the driver becomes a BSON `double` unless explicitly wrapped —
[MongoDB 1·04](../../../../mongodb/pages/phase-1-documents-and-bson/04-numbers.md)
is unambiguous — so a validator demanding `'int'` rejects every ordinary write.
The two coherent positions are to widen the validator and lean on
`minimum`/`maximum`, or to wrap at the boundary:

```js
import {Int32} from 'mongodb';
const cents = (n) => new Int32(n);       // one helper, used by every writer
```

The second is chosen here, because the app's money model is *integer cents* and
a validator that would accept `1999.5` in a cents field is not enforcing the
thing it was written to enforce.

**`validationLevel: 'strict'` and `validationAction: 'error'` are the defaults
and are written out anyway.** The Manual defines strict as *"MongoDB applies the
same validation rules to all document inserts and updates"*, against moderate,
where *"updates to existing documents in the collection that don't match the
validation rules aren't required to pass validation"*. Moderate is a *migration*
tool: it lets a validator be added to a collection full of legacy documents
without breaking every update to them. A collection left on moderate afterwards
has permanently exempted its invalid documents from the rules — so the level is
stated in the migration, and changing it has to be a deliberate act someone can
find in a diff.

**`attributes: {bsonType: 'object'}` is deliberately loose.** This is the `jsonb`
column's freedom, preserved on purpose, and it is the direct answer to the
complaint in [chunk 2](02-what-embeds.md) that MongoDB makes rigidity a
whole-document decision: it does not have to be, it just has to be written down.

**`deletedAt: {bsonType: ['date', 'null']}` keeps
[soft delete](../../phase-1-database/11-soft-delete-and-audit.md) working.** The
field is required to be present-and-null rather than absent, because a partial
index on it needs a predicate that can distinguish the two, and because
`{deletedAt: null}` as a query matches both — so an inconsistent representation
produces an index that is used for some documents and not others.

## Gotchas

**★ A unique index on an optional field rejects the second document that lacks
it.** The Manual: *"a single-field unique index can only contain one document
that contains a `null` value in its index entry"* — and a missing field indexes
as null. `UNIQUE` in Postgres permits unlimited NULLs, so **every nullable unique
column in the original schema is a landmine on the port**. The fix is
`partialFilterExpression: {field: {$exists: true}}`, and the way you discover you
needed it is the second document.

**★ `partialFilterExpression: {field: {$exists: true}}` still indexes explicit
nulls.** A document with `userId: null` *has* the field. For nullable-owner
patterns like `carts`, the predicate must be `{$type: 'objectId'}` — see
[chunk 3](02b-the-cart-document.md), where this is the difference between a
working guest cart and an outage that begins with the second anonymous visitor.

**★ A validator added to a non-empty collection does not check what is already
there.** It applies to inserts, and to updates according to the validation level.
Adding `required: ['category']` to a collection holding 40,000 legacy products
succeeds instantly, reports nothing, and leaves every legacy document invalid
until something updates it — at which point, on `strict`, that update fails, in
whatever unrelated feature happened to touch it. Validate the existing data
explicitly as part of the migration:

```js
// the validator, run as a query — every document that does not match it
const bad = await db.collection('products')
  .find({$nor: [{$jsonSchema: PRODUCT_SCHEMA}]}).limit(50).toArray();
```

**★ `validationAction: 'warn'` writes the document.** It logs and proceeds. That
is the right setting for a week while you learn what your data actually looks
like, and it is not a constraint: a collection left on `warn` has documentation,
not enforcement, and nobody is alerting on the log.

**★ `$jsonSchema` cannot express a rule that references another field.** No
`check (total_cents = sum of items)`, no `check (expires_at > created_at)`. JSON
Schema validates a document against a shape, not against itself. MongoDB permits
`$expr` in a validator for exactly this — `{$expr: {$gt: ['$expiresAt',
'$createdAt']}}`, combined with the schema under `$and` — which is worth knowing
before declaring the rule unenforceable.

**★ Losing `NOT NULL` on a field the code reads is a runtime `undefined`, not a
constraint error.** Postgres refused the write; MongoDB accepts it and the
failure surfaces three layers up as a property access on `undefined`. The
`required` array is therefore not polish — it is the only thing between a
malformed write and a 500 in an unrelated endpoint a week later.

**★ Validator errors are not field-level messages you can show a user.** A failed
write raises a document-validation failure describing the schema rule that was
violated, not "price must be at least 0" in your product's voice. The user-facing
validation therefore still lives at
[the Phase 3 boundary](../../phase-3-express-api/02-the-validation-boundary.md) —
the validator is the backstop that catches what bypasses the API, exactly as the
Postgres `CHECK` constraints were.

## Interview questions

**★ Which Postgres constraints ported exactly, and what does "exactly" mean
here?** Unique, compound unique and partial unique indexes — and "exactly" means
they hold *under concurrency*, enforced by the storage engine, raising a
catchable duplicate-key error rather than depending on a read-then-write in
application code. That is the property application code cannot reproduce: two
concurrent replays of a checkout both read "no such key" and both insert, and
only an index makes one of them lose atomically.

**★ `citext` became a collated unique index. What got worse?** Enforcement moved
from the type to the index, so it is now opt-in per query — the Manual requires
that query and sort operations specify the same collation as the index. A login
path that forgets it does an exact-case match, misses the index, and returns "no
such user", which presents as a wrong password and passes any test written with
lowercase fixtures. `citext` made forgetting impossible; a collation makes
forgetting silent. Funnel every email match through one function, or store a
normalised lowercase field and index that.

**★ Why does the validator say `bsonType: ['int','long']` and not `'int'`?**
Because the Node driver serialises a plain JavaScript number as a BSON `double`,
so a validator demanding `int` rejects every ordinary write. Widen the validator
and rely on `minimum`/`maximum`, or wrap every monetary and count value in
`Int32` at the data layer so the stored type matches the declared one. This app
does the second, because a validator that would accept `1999.5` in a cents field
is not enforcing the invariant it exists for.

**★ What can `$jsonSchema` not express that `CHECK` could, and what do you do
about it?** Anything relating one field to another — totals matching line sums,
an expiry after a creation time, the cart's "exactly one owner" rule. JSON Schema
describes a shape, not a relation. `$expr` inside the validator brings the
aggregation expression language into validation and covers field-to-field
comparisons. Where even that is impractical, the fallback is a `oneOf` over two
required-field shapes, which works, is unreadable, and illustrates the general
pattern: the invariant survives, its legibility does not.

**★ You inherit a collection set to `validationAction: 'warn'`. What do you
assume?** That the collection has no constraints. `warn` writes the document and
logs, so every rule is advisory and the log is the only record — which nobody is
alerting on, or the setting would have been changed already. The correct move is
to run the schema *as a query* to find out how much invalid data is there, fix or
quarantine it, then switch to `error`. Flipping to `error` first turns every
write against a legacy document into a production failure in whichever feature
happens to touch it.

**★ Why write out `validationLevel: 'strict'` when it is the default?** Because
the interesting value is `moderate`, and `moderate` is what a careful migration
sets temporarily. If the level is never written down, nobody can tell from the
migration whether a collection is on strict by intention or on moderate by an
abandoned migration — and a collection quietly left on moderate has permanently
exempted its invalid documents. Defaults that have a meaningful alternative are
worth stating; defaults that do not are noise.

{/* FOOTER */}
