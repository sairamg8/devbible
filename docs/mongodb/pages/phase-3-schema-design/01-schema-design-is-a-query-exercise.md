---
title: "Schema design is a query exercise"
sidebar_label: "01 · A query exercise"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/): *"A core principle of
> data modeling in MongoDB is that data that's accessed together should be stored together.
> You should structure your data model based on your application's data access patterns to
> optimize performance"*, and that *"embedding data allows you to avoid complex joins across
> multiple collections, while improving performance and reducing your deployment's
> workload"*.
> **Documentation-validated; no console blocks.**

**In PostgreSQL you model the data. In MongoDB you model the queries.** That is the whole
reversal, and everything else in this phase is a consequence of it.

## The two starting questions

| | Relational | MongoDB |
|---|---|---|
| First question | *what are the entities and their relationships?* | *what will the application ask for, and how often?* |
| Guiding principle | normalise until no fact is stored twice | **data accessed together is stored together** |
| Duplication | a defect to be eliminated | a **trade** to be made deliberately |
| Joins | free-ish, the planner's job, everywhere | expensive, explicit, avoided by design |
| Schema changes | a migration, all-or-nothing | often none — documents differ |

The relational instinct — *find the entities, remove the duplication, join at read time* —
produces a MongoDB schema that needs three `$lookup`s to render one screen. It is not that the
design is wrong in the abstract; it is that MongoDB charges for exactly the thing relational
design optimises for, and pays for exactly what relational design avoids.

## The method

**1 · Write down the application's queries first.** Not the entities. The screens, the
endpoints, the reports. For a shop:

- *Product page* — one product with its variants, price, images and a few recent reviews.
- *Order confirmation* — one order with line items, each showing product name and price.
- *Seller dashboard* — a page of orders, with customer name and total.
- *Review moderation* — recent reviews across all products, newest first.

**2 · Note frequency and latency for each.** The product page runs constantly and must be
fast; review moderation runs rarely and can afford work. **Frequency decides which query gets
to shape the schema** — you cannot optimise for all of them, so optimise for the hot one.

**3 · For each query, ask: could this be one document read?** That is the target. A single
document fetched by `_id`, with everything the screen needs already in it, is the cheapest
operation the database offers.

**4 · Where it cannot, decide what to duplicate** — and write down the update cost of that
duplication before you accept it ([topic 06](./06-extended-reference.md)).

## Worked: the order confirmation

The relational shape, transliterated:

```js
// orders
{ _id: 1, customerId: 42, createdAt: ISODate(), lines: [ { productId: 7, qty: 2 } ] }
// products
{ _id: 7, name: "Kettle", price: Decimal128("39.99") }
```

Rendering the confirmation needs the order, then every referenced product — a `$lookup` or an
N+1 in application code, on a page that is hit on every purchase.

The document-shaped version:

```js
{
  _id: 1,
  customer: { _id: 42, name: "Ada Lovelace" },
  createdAt: ISODate(),
  lines: [
    { productId: 7, name: "Kettle", unitPrice: Decimal128("39.99"), qty: 2 },
  ],
  total: Decimal128("79.98"),
}
```

One read, and no join. 🔴 **And here the duplication is not even a trade — it is required.**
An order line must record the price *at the time of purchase*. If the product's price changes
tomorrow, the order must not change with it. The "denormalised" copy is the correct model of
the domain, and the normalised version is the one that is wrong.

That pattern recurs: **a large share of MongoDB "duplication" is really point-in-time data**,
which was always a modelling mistake to store by reference.

## What you give up, honestly

- **Facts can drift.** A customer renames themselves and old orders keep the old name —
  correct here, wrong if you had copied their current shipping address.
- **Updates can touch many documents.** Change a product name that is embedded in a million
  order lines and you have a million-document write, if you decide it should propagate at all.
- **Atomicity is per document** ([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)).
  Data spread across documents cannot be updated atomically without a transaction.
- **There is no schema keeping you honest.** Two code paths can write the same field
  differently ([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)); validation is
  opt-in and worth turning on.

**Name the cost when you make the choice.** A denormalisation you chose knowingly is a design;
one you drifted into is a bug you have not met yet.

## When the relational instinct is right

Not a licence to embed everything:

- **The child is queried on its own** — "all reviews awaiting moderation" across products.
- **The child is shared** — one supplier referenced by ten thousand products.
- **The child grows without bound** — events, messages, audit entries
  ([topic 05](./05-one-to-squillions.md)).
- **Write patterns differ sharply** — a document rewritten on every page view alongside data
  that never changes.

The Manual's own list of when to reference says the same thing in different words, and
[topic 02](./02-embed-vs-reference.md) turns it into an ordered procedure.

## Gotchas

**Symptom:** rendering one screen requires three `$lookup` stages.
**Cause:** the schema was designed from entities, not from queries.
**Fix:** ask what the screen needs and store that together. Usually the fix is embedding a
handful of fields, not merging whole collections.

**Symptom:** old orders change when a product is renamed.
**Cause:** the order references the product instead of recording what was bought.
**Fix:** copy name and price onto the line at purchase time — point-in-time data, not
duplication.

**Symptom:** every schema decision feels like a coin flip.
**Cause:** the queries have not been written down, so there is nothing to decide against.
**Fix:** list the screens with their frequencies first. The decisions become obvious, and the
disagreements become about facts.

**Symptom:** a document that was small in development is huge in production.
**Cause:** an embedded array that grows with usage.
**Fix:** the boundedness question in [topic 02](./02-embed-vs-reference.md), before the data
is written rather than after.

**Symptom:** the schema is beautiful and the application is slow.
**Cause:** it was optimised for the rare report rather than the constant page.
**Fix:** optimise for the hot query; let the rare one do work — that is what it can afford.

## Interview questions

**★ How does MongoDB schema design differ from relational design?**
Relational design starts from entities and normalises until no fact is stored twice, then joins
at read time. MongoDB design starts from the application's queries and stores together what is
read together — the Manual's core principle. Duplication stops being a defect and becomes a
trade you make deliberately, because the database charges for joins and rewards single-document
reads.

**★ What is the first thing you do when designing a MongoDB schema?**
Write down the queries — the screens, endpoints and reports — with their frequency and latency
needs. Only then look at the data. Without that list there is nothing to design against, and
every embed-versus-reference decision becomes a matter of taste.

**★ Is denormalisation in MongoDB just a performance hack?**
Often it is the correct model. An order line must record the name and price at the time of
purchase, so copying them is not duplication of a shared fact — it is point-in-time data, and
storing it by reference would be the actual bug. Genuine duplication of a live shared fact is a
separate decision, made with its update cost in view.

**What do you give up by embedding?**
Facts can drift out of step, an update to duplicated data can touch many documents, atomicity
is only guaranteed per document, and nothing enforces consistency of shape unless you enable
schema validation. Each is acceptable when chosen deliberately and expensive when discovered
later.

**When is a reference the better answer?**
When the child is queried on its own, is shared by many parents, grows without bound, or has a
very different write pattern from the parent. Those are the cases where embedding either
duplicates too much or makes the parent document grow unboundedly.

**Which query should shape the schema when they conflict?**
The frequent one. A schema optimised for a nightly report at the expense of a page served
thousands of times a minute is optimising the cheap case; the rare query can afford to do work
that the hot path cannot.

---

← Index: [Phase 3](./README.md) ·
Next → [Embed vs reference — the decision procedure](./02-embed-vs-reference.md)
