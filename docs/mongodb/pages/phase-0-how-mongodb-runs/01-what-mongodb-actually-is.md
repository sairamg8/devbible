---
title: "What MongoDB actually is"
sidebar_label: "01 · What MongoDB actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Documents](https://www.mongodb.com/docs/manual/core/document/),
> [Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/)
> and [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/).

**MongoDB is a document store that trades joins for locality.** That single
sentence predicts nearly every design decision the rest of this syllabus covers —
and it is a *trade*, not an upgrade.

## The trade, stated plainly

A relational database normalises: each fact lives in exactly one place, and a
query reassembles what it needs with joins. MongoDB denormalises: the data a
request needs is stored **together**, in one document, and read in one go.

```js
// One document, one read — no join
{
  _id: ObjectId("..."),
  orderNumber: "A-1042",
  customer: { name: "Priya", email: "priya@example.com" },
  items: [
    { sku: "SKU-1", qty: 2, price: 1299 },
    { sku: "SKU-2", qty: 1, price: 499 }
  ],
  total: 3097
}
```

What you gain: the whole order arrives in a single lookup, with no join planning
and no fan-out.

What you pay: the customer's name is now stored in every order they have ever
placed. Change it and you must find and update all of them — and *that* is a
multi-document operation, with none of the guarantees the single-document case
gives you (topic 02).

**Neither side is "modern".** The question is always whether your access pattern
reads things together more often than it updates them independently.

## "Schemaless" is wrong, and actively harmful

The word does real damage, so it is worth killing early.

**There is always a schema.** Every application that reads
`order.customer.email` is asserting a schema. The only question is *where it
lives*: enforced by the server, or assumed by the application.

MongoDB's default is the second — the server accepts any shape you insert:

```js
db.orders.insertOne({ orderNumber: "A-1043" })          // no items, no total
db.orders.insertOne({ order_number: "A-1044", tot: 5 }) // different field names
```

Both succeed. Nothing rejects them, and the bug surfaces later, in code that
expected a field to exist. **"Flexible" describes the server; it does not
describe your application**, which still has exactly one shape it can handle.

The consequence worth internalising: **the schema moved, it did not disappear**,
and an unenforced schema drifts. Two years of small inconsistencies — a field
that is sometimes a string and sometimes a number, a nested object that is
occasionally null — is the characteristic failure mode of a MongoDB codebase
that took "schemaless" literally.

## Schema validation exists, and is off by default

MongoDB can enforce a schema at the server:

```js
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["orderNumber", "items", "total"],
      properties: {
        orderNumber: { bsonType: "string" },
        total: { bsonType: "int", minimum: 0 },
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["sku", "qty"],
            properties: {
              sku: { bsonType: "string" },
              qty: { bsonType: "int", minimum: 1 }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

This is the answer to schema drift, and it is **opt-in**. A collection created
implicitly — by inserting into a name that does not exist yet — has no validator
at all, which is how most collections come into being.

`validationAction: "warn"` logs instead of rejecting, which is the safe way to
introduce validation to a collection that already has data.

## The three levels

| Level | What it is | What it enforces |
|---|---|---|
| **Document** | one BSON object, max **16 MiB** | nothing by default |
| **Collection** | a group of documents | nothing unless a validator is set |
| **Database** | a group of collections | nothing about shape |

Collections and databases are **created implicitly** on first write. There is no
`CREATE TABLE` step, which is convenient and is also how a typo produces a new
collection rather than an error:

```js
db.oders.insertOne({ ... })   // creates a collection called "oders"
```

## Where this leaves you

Three practical positions that follow directly:

1. **Model for the read.** The right shape is the one your most frequent query
   wants. This inverts the relational instinct of modelling the entities first.
2. **Treat the schema as real, and write it down.** In a validator, in Mongoose,
   or in TypeScript types at the boundary — but somewhere the machine checks.
3. **Expect drift in any collection older than the current code.** Data written
   by an earlier version of the application is still there, in the earlier shape.

## Trade-off

**Locality makes reads fast and writes ambiguous.** Embedding the customer in the
order means one read instead of two — and it means the customer's name now exists
in *n* places with no single source of truth. Every embed is a bet that you will
read the data together more often than you will need to change it independently,
and that bet is made at design time when the access patterns are least known.

The flexibility trade is sharper still. Not having to declare a schema genuinely
speeds up early development, and it removes the moment where you would have been
forced to think about what the data actually is. The cost arrives later, unevenly
distributed, and lands on whoever is reading the collection two years in.

The honest summary: **MongoDB moves work from the database into the
application** — schema enforcement, referential integrity, join logic. That is a
good trade when the application is the only writer and the access patterns are
stable. It is a bad one when several services write the same collection, which is
exactly when people reach for it.

## Gotchas

**A typo creates a new collection.**
*Symptom:* writes succeed and reads return nothing.
*Cause:* collections are created implicitly on first write.
*Fix:* check `db.getCollectionNames()`; consider creating collections explicitly
with a validator.

**A field is sometimes a string and sometimes a number.**
*Symptom:* comparisons and sorts behave inconsistently.
*Cause:* no validator, and the application's assumptions changed over time.
*Fix:* schema validation with `bsonType`, and a migration for existing documents.

**Denormalised data goes stale.**
*Symptom:* an old customer name appears on historical orders.
*Cause:* the value was embedded and never updated.
*Fix:* decide deliberately — for an order, the *historical* value is often
correct and should be frozen; for a profile display, it should be a reference.

**"We'll add validation later."**
*Symptom:* validation cannot be enabled because existing documents fail it.
*Cause:* drift accumulated before enforcement.
*Fix:* `validationAction: "warn"` first, fix the data, then switch to `error`.

## Interview questions

**★ What is the fundamental trade MongoDB makes?**
Joins for locality. Data that is read together is stored together in one
document, so a request is one read with no join. The cost is duplication: the
same fact lives in many documents, and updating it independently becomes a
multi-document operation with no atomicity guarantee.

**★ Why is "schemaless" a harmful description?**
Because there is always a schema — every line of application code that reads a
field asserts one. MongoDB only moves enforcement from the server to the
application. Calling it schemaless encourages skipping the design step, and the
result is drift: fields with inconsistent types and shapes that no code fully
handles.

**★ Does MongoDB support schema enforcement?**
Yes — JSON Schema validators on a collection, with `validationLevel` and
`validationAction` controlling strictness and whether violations error or warn.
It is opt-in, and collections created implicitly by a first write have none.

**How are collections and databases created?**
Implicitly, on first write. There is no `CREATE TABLE` equivalent, which is why a
misspelled collection name silently produces a new, empty collection instead of
an error.

**When is MongoDB's trade a bad one?**
When multiple services write the same collection. Moving schema enforcement and
referential integrity into "the application" only works when there is one
application; with several writers there is no longer a single place those rules
live.

---

Next: [02 · The single-document atomicity guarantee](./02-single-document-atomicity.md) →
