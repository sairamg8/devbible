---
title: "Embed vs reference — the decision procedure"
sidebar_label: "02 · Embed vs reference"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/):
> **embed** when *"keeping related data together will lead to a simpler data model and code"*,
> there is a *"'has-a' or 'contains' relationship"*, *"your application queries pieces of
> information together"*, the data is *"often updated together"*, or *"should be archived at
> the same time"*; **reference** when *"the child side of the relationship has high
> cardinality"*, *"data duplication is too complicated to manage"*, the combined size *"takes
> up too much memory or transfer bandwidth"*, **"your embedded data grows without bounds"**,
> *"your data is written at different times in a write-heavy workload"*, or the child *"can
> exist by itself without a parent"*; that embedding *"allows atomic operations"*; and the
> staleness distinction — data *"sensitive to staleness"* needing transactions or triggers
> versus data that *"can tolerate staleness"* and can be updated by a background job.
> **Documentation-validated; no console blocks.**

The Manual gives two lists. This page turns them into **an ordered procedure**, because in
practice the questions are not equal — one of them ends the discussion, and the rest are
trade-offs.

## The procedure

Ask these in order. **The first "yes" decides.**

### 1 · Is it unbounded? → reference

*"Your embedded data grows without bounds"* is the Manual's own trigger for referencing, and
it is first here because it is the only question with a hard limit behind it: **16 MiB per
document** ([Phase 0](../phase-0-how-mongodb-runs/03-bson.md)). An array that grows per event,
per message, per view will eventually make **every write to that document fail** — and by then
the fix is a migration under load.

**The test:** *is there a number this can never exceed?* Order lines — yes, a few dozen.
Product images — yes. Comments on a post, events on a device, messages in a conversation — no.
If the honest answer is "it depends how popular it gets", treat that as unbounded
([topic 05](./05-one-to-squillions.md)).

### 2 · Is it queried on its own? → reference

If the application ever asks for the child **without** the parent — "all reviews awaiting
moderation", "every order line containing this SKU" — then embedding buries it. You can query
inside arrays, but the results come back as parent documents you must then unwind, and indexes
on embedded arrays are multikey with the costs that carry
([Phase 1](../phase-1-documents-and-bson/06-arrays.md)).

The Manual's version: reference when the child *"can exist by itself without a parent"*.

### 3 · Does it change independently, and often? → reference

The Manual lists write patterns twice — embed when data is *"often updated together"*,
reference when *"your data is written at different times in a write-heavy workload"*.

The reason is mechanical: **updating one field rewrites the document**. A `viewCount`
incremented on every page view, embedded in a document holding the product description, means
rewriting the description on every view.

### 4 · Is it shared by many parents? → reference (usually)

A supplier referenced by ten thousand products should be one document. Embedding it copies the
supplier ten thousand times, and a change of address becomes ten thousand writes. The Manual's
phrasing is *"data duplication is too complicated to manage and not preferred"*.

⚠️ **Unless it is point-in-time.** The product name on an order line is shared in the sense
that a product has one name — but the order records what was bought *then*, and must not
change ([topic 01](./01-schema-design-is-a-query-exercise.md)).

### 5 · Otherwise → embed

If it is bounded, always read with its parent, updated with its parent, and owned by it —
**embed**. This is the common case, which is why embedding is the default rather than the
exception. The Manual's list is exactly this: a "has-a" or "contains" relationship, queried
together, updated together, archived together.

## The two rewards for embedding

**One read.** No join, no second round trip, no `$lookup`. The Manual: embedding *"allows you
to avoid complex joins across multiple collections, while improving performance and reducing
your deployment's workload"*.

**Atomicity.** A denormalised model that keeps related data in one document *"allows atomic
operations"* — so updating a parent and its children together is a single atomic write, with
no transaction needed. That is not a small thing: it removes a whole class of partial-update
bug that a referenced model has to handle explicitly.

## When you duplicate anyway: the staleness question

Sometimes the answer is "reference, but copy a couple of fields for display"
([topic 06](./06-extended-reference.md)). The Manual splits the maintenance by tolerance:

| Duplicated data | Documented handling |
|---|---|
| **Sensitive to staleness** — must stay consistent | *"applications can use transactions or triggers to update all occurrences"* |
| **Not sensitive to staleness** — can lag | *"applications can use a background job to periodically update all occurrences"* |

And the summary judgement: if the duplicated data is not updated often, keeping the copies
consistent is *"minimal additional work"*; if it is updated often, **a reference is probably
the better approach**.

🔴 **So the deciding question is not "will this ever change?" — everything changes. It is "how
often, and how bad is a stale copy for a moment?"** A product name changing twice a year with a
tolerant display is a background job. A price that must never display stale is a reference.

## A summary table

| Signal | Embed | Reference |
|---|---|---|
| Bounded size | ✅ | grows without bounds |
| Read together | ✅ | queried on its own |
| Updated together | ✅ | different write cadence |
| Owned by the parent | ✅ | exists independently |
| Shared by many parents | ✗ | ✅ |
| Point-in-time snapshot | ✅ **required** | ✗ wrong |
| Needs atomic update with parent | ✅ | transaction required |

## Gotchas

**Symptom:** writes to a document begin failing after months of growth.
**Cause:** an unbounded embedded array approaching 16 MiB.
**Fix:** reference from the many side. Question 1 exists to prevent this, because the cure is a
migration.

**Symptom:** a "list all X" query is slow and awkward.
**Cause:** X is embedded, so the query must scan parents and unwind.
**Fix:** if X is queried on its own, it belongs in its own collection.

**Symptom:** a hot counter makes a large document a write hotspot.
**Cause:** the counter is embedded with rarely-changing data, so every increment rewrites all
of it.
**Fix:** move the counter out, or into a small companion document.

**Symptom:** a supplier's details are stale in half the products.
**Cause:** the supplier was embedded and copies drifted.
**Fix:** reference the supplier; keep only the display fields as an extended reference, with a
job or trigger to refresh them.

**Symptom:** an order shows today's price rather than the price paid.
**Cause:** the opposite mistake — referencing what should have been captured.
**Fix:** copy price and name onto the line at purchase. Not all duplication is denormalisation.

## Interview questions

**★ Walk me through deciding whether to embed or reference.**
In order: is it unbounded — if so, reference, because 16 MiB is a hard limit and the cure later
is a migration. Is it queried on its own — if so, reference, since embedding buries it. Does it
change on a different cadence, especially in a write-heavy workload — if so, reference, because
updating one field rewrites the whole document. Is it shared by many parents — usually
reference, unless the copy is point-in-time data. Otherwise embed: bounded, read together,
updated together, owned by the parent.

**★ Why is boundedness the first question?**
Because it is the only one with a hard failure behind it. Everything else is a performance or
consistency trade you can revisit; an array that grows without bound eventually makes every
write to that document fail, and fixing it means migrating live data. The Manual lists
"embedded data grows without bounds" as a referencing trigger for exactly this reason.

**★ What do you gain by embedding, in the Manual's terms?**
Avoiding complex joins across collections, with better performance and less workload on the
deployment — and atomic operations, because a document holding all its related data is updated
atomically. The second is easy to undervalue: it removes the partial-update failure mode that a
referenced model must handle explicitly.

**★ You need to reference, but the UI always shows the child's name. What do you do?**
Reference and duplicate just the display fields — the extended reference pattern. Then decide
by staleness tolerance: data that must stay consistent gets transactions or triggers; data that
can lag gets a background job. If the field changes often and cannot tolerate lag, that is the
Manual's own signal that a plain reference is the better approach.

**Is duplicated data always a problem?**
No. Point-in-time data — the price paid, the name at the time of purchase — must be copied, and
referencing it would be the bug. The problem case is duplicating a *live shared fact* without
deciding how the copies get updated.

**What is the cost of embedding a frequently-updated counter in a large document?**
Every increment rewrites the whole document, so a hot counter turns a large, otherwise static
document into a write hotspot, with more I/O and more contention. The Manual's "written at
different times in a write-heavy workload" is exactly this case.

---

← Prev: [Schema design is a query exercise](./01-schema-design-is-a-query-exercise.md) ·
Index: [Phase 3](./README.md) ·
Next → [One-to-few](./03-one-to-few.md)
