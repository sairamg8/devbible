---
title: "The extended reference pattern"
sidebar_label: "06 · Extended reference"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/):
> the staleness split for duplicated data — data *"sensitive to staleness"* is *"data that
> requires frequent updates to ensure that all occurrences of the data are consistent"* and
> *"applications can use transactions or triggers to update all occurrences"*, while data *"not
> sensitive to staleness"* *"can tolerate staleness for a longer period of time"* and
> *"applications can use a background job to periodically update all occurrences"*; and the
> judgement that if duplicated data is not updated often, consistency is *"minimal additional
> work"*, but *"if the duplicated data is updated often, using a reference to link related data
> may be a better approach"* — with
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/) (*"data that's accessed
> together should be stored together"*).
> **Documentation-validated; no console blocks.**

**An extended reference is a reference plus the two or three fields you always display.** It is
the pattern that resolves the most common tension in MongoDB modelling: the relationship must
be a reference ([topic 04](./04-one-to-many.md)), but every screen showing the parent also shows
the child's name — so a plain reference means a join on every page.

```js
// a plain reference — correct, and one join away from being useful
{ _id: 1, customerId: ObjectId("…"), total: Decimal128("79.98") }

// an extended reference — the id, plus what the UI always needs
{
  _id: 1,
  customer: { _id: ObjectId("…"), name: "Ada Lovelace", email: "ada@example.com" },
  total: Decimal128("79.98"),
}
```

The id is still there, so the full customer is one lookup away when you need the rest. The
list view needs no lookup at all.

## Choosing which fields to copy

**Copy the smallest set that removes the join from the hot query — and nothing else.**

| Copy | Leave behind |
|---|---|
| name, title, SKU — what is displayed | the full description |
| a status or type used for filtering | anything large |
| a thumbnail URL | fields that change constantly |
| the id, always | anything you would have to keep exactly consistent |

Two failure modes sit either side of that line. Copy too little and the join comes back, so the
pattern bought nothing. Copy too much and the extended reference becomes an embedded copy of
the child, with all of the update cost and none of the boundedness that made embedding safe.

🔴 **Never copy a field whose staleness is unacceptable.** A live price, a current balance, a
permission flag — these must be read from the source. The Manual's own judgement applies: if
the duplicated data is updated often, *"using a reference to link related data may be a better
approach"*.

## The write cost, stated before you accept it

Every copy is a write you owe when the source changes. The Manual splits the handling by
tolerance:

| Class | Documented handling | Example |
|---|---|---|
| **Sensitive to staleness** — must stay consistent | *"transactions or triggers to update all occurrences"* | a display name shown in a legal document |
| **Not sensitive** — can lag | *"a background job to periodically update all occurrences"* | a customer name on an order list |

**So the design question is not "will it change?" but "how bad is it if a copy is stale for an
hour?"** — and the answer determines the machinery you sign up for. Write it down next to the
schema; it is the part that gets forgotten and then discovered as a bug.

### Making the update cheap

If a field is copied into many documents, keep the update targeted:

```js
db.orders.updateMany(
  { "customer._id": customerId },              // indexed
  { $set: { "customer.name": newName } },
);
db.orders.createIndex({ "customer._id": 1 });   // the index that makes it targeted
```

Without that index the update is a collection scan. **Index the copied id**, always — it is
what turns a fan-out update from an outage into a routine write.

⚠️ **Fan-out has a shape you should estimate.** A customer with a million orders means a
million-document update on a name change. If that is unacceptable, either do not copy the name,
or accept staleness and refresh lazily.

## The case where staleness is correct

🔴 **Sometimes the copy must *not* be updated — and that is the point.** An order line records
the product name and price *at the time of purchase*
([topic 01](./01-schema-design-is-a-query-exercise.md)). If the product is renamed or repriced,
the order must not change; propagating the update would be the bug.

This is not the extended reference pattern at all — it is point-in-time data — but it looks
identical on disk, which is why it must be labelled in the schema documentation. **The same
shape with the opposite maintenance rule.** A future maintainer writing a "fix stale copies"
job needs to know which fields are which, and the only place that lives is your documentation.

## When not to use it

- **The child is read rarely with the parent.** One join on an occasional page is cheaper than
  duplication maintained forever.
- **The copied field changes constantly.** The Manual's guidance points at a plain reference.
- **Consistency must be immediate and the fan-out is large.** Transactions across a million
  documents are not a design; they are an incident.
- **You have not decided who maintains the copies.** An undocumented duplicate is a bug with a
  delay on it.

## Gotchas

**Symptom:** an order list shows an old customer name.
**Cause:** the copy was never refreshed after a rename.
**Fix:** decide which class it is — background job for tolerant data, transaction or trigger for
sensitive data — and implement that. "It will be fine" is not one of the two.

**Symptom:** a name change takes minutes and locks up the collection.
**Cause:** the fan-out update is scanning because the copied id is not indexed.
**Fix:** index `"customer._id"`. Estimate the fan-out before designing the copy.

**Symptom:** the extended reference has grown to a dozen fields.
**Cause:** fields added one at a time, each individually reasonable.
**Fix:** re-ask what the hot query needs. A dozen fields is an embedded child with a reference
attached, and it should be one or the other.

**Symptom:** an old order changed when a product was renamed.
**Cause:** point-in-time data treated as a stale copy by a well-meaning refresh job.
**Fix:** document which copied fields are snapshots. This is a documentation failure before it
is a code failure.

**Symptom:** the copy and the source disagree and nobody can say which is right.
**Cause:** two write paths, no single owner.
**Fix:** one place that writes the source and the copies, plus a reconciliation job that reports
differences rather than silently fixing them.

## Interview questions

**★ What is the extended reference pattern?**
A reference plus a small number of the child's fields — usually the ones every screen displays.
The parent keeps the child's `_id`, so the full document is one lookup away, but the common
read needs no join at all. It is the standard resolution when the relationship must be a
reference and the UI always shows the child's name.

**★ Which fields do you copy, and which do you refuse to copy?**
The smallest set that removes the join from the hot query: a name, a SKU, a status, a
thumbnail. Never a field whose staleness is unacceptable — a live price, a balance, a
permission — because those must be read from the source. Copying too little leaves the join in
place; copying too much recreates an embedded child with all of its update cost.

**★ What is the maintenance cost, and how do you decide how to pay it?**
Every copy is a write owed when the source changes. The Manual splits it by tolerance: data
sensitive to staleness gets transactions or triggers to update all occurrences; data that can
lag gets a background job. And if the field is updated often, that is the Manual's own signal
that a plain reference is the better design. Whichever you choose, index the copied `_id` so the
fan-out update is targeted rather than a collection scan.

**★ How is an extended reference different from point-in-time data?**
They look identical on disk and have opposite maintenance rules. An extended reference is a
cache of a live fact and should be refreshed when the source changes; the product name and
price on an order line are a record of what was bought and must never be refreshed. Only your
schema documentation distinguishes them, which is why writing it down matters — a "fix stale
copies" job that touches order lines corrupts history.

**When would you not use it?**
When the child is rarely read with the parent, when the copied field changes constantly, when
consistency must be immediate across a large fan-out, or when nobody has decided who maintains
the copies. The last is the most common and the least visible.

**How do you keep a fan-out update from becoming an incident?**
Index the copied id so the update is targeted, estimate the fan-out at design time — a customer
with a million orders means a million-document update — and if the number is unacceptable,
either do not copy the field or accept staleness and refresh lazily.

---

← Prev: [One-to-squillions](./05-one-to-squillions.md) ·
Index: [Phase 3](./README.md) ·
Next → **Phase 4 · CRUD and DML** *(not written yet)*
