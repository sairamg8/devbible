---
title: "One-to-many"
sidebar_label: "04 · One-to-many"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
> (reference when *"the child side of the relationship has high cardinality"*, when the
> combined size *"takes up too much memory or transfer bandwidth"*, when data *"is written at
> different times in a write-heavy workload"*, or when the child *"can exist by itself without
> a parent"*) and
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/) (relationship types, and
> that embedding *"allows you to avoid complex joins"*) — with
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
> for the array-of-ids shape.
> **Documentation-validated; no console blocks.**

One-to-many is the middle case — **more children than you want to embed whole, but a knowable
number** — and it is where the three real shapes have to be compared rather than assumed. A
product with a hundred variants. An author with fifty books. A project with two hundred tasks.

## The three shapes

### 1 · Embed the children

```js
{ _id: 1, name: "Project Apollo", tasks: [ { title: "…", done: false }, … ] }
```

**Read cost:** one read, everything present.
**Write cost:** every task update rewrites the whole document.
**Limit:** the document grows with the children; at some size, reads that only wanted the
project name are paying for every task.

Right when the children are small, read with the parent every time, and updated together.

### 2 · Embed an array of ids

```js
{ _id: 1, name: "Project Apollo", taskIds: [ ObjectId("…"), ObjectId("…"), … ] }
```

**Read cost:** two round trips — parent, then `find({_id: {$in: taskIds}})` — or one
`$lookup`.
**Write cost:** adding a task is a small `$push`; editing a task touches only that task
document.
**Limit:** the id array is still an array in the parent, so it is still bounded by 16 MiB and
still costs a multikey index if you index it.

Right when **the parent's ordering matters**. The array preserves order, which is genuinely
hard to reproduce from the child side without an explicit position field.

### 3 · Reference from the child

```js
// tasks
{ _id: ObjectId("…"), projectId: 1, title: "…", done: false }
```

**Read cost:** `find({projectId: 1})` — one query, one index, no array in the parent.
**Write cost:** adding a task writes only the task; **the parent is never touched.**
**Limit:** no natural ordering, and the parent has no idea how many children it has without
counting.

Right when children are numerous, edited independently, or queried on their own.

## Choosing between them

| Question | Embed | Ids in parent | Reference from child |
|---|---|---|---|
| Always read with the parent? | ✅ | ~ | ✗ |
| Queried on their own? | ✗ | ~ | ✅ |
| Edited independently and often? | ✗ | ✅ | ✅ |
| Order matters and is the parent's? | ✅ | ✅ | needs a position field |
| Count is large or unknown | ✗ | ✗ | ✅ |
| Parent must stay small | ✗ | ~ | ✅ |

**The default for a genuine one-to-many is shape 3 — reference from the child side.** It keeps
the parent stable, scales with the child count, and matches the Manual's referencing triggers:
high cardinality on the child side, different write times, children that can exist alone.

🔴 **Shape 2 is over-used.** An array of ids looks like a compromise and often gets the worst
of both: the parent still grows and still gets rewritten on every add, *and* you still pay a
second query to fetch the children. Reach for it when **order is a property of the parent** —
a playlist, a checklist, a curated list — and not merely because it feels tidier.

## Reading a referenced one-to-many

```js
// two queries — usually the right answer
const project = await db.collection("projects").findOne({ _id: id });
const tasks   = await db.collection("tasks").find({ projectId: id }).limit(50).toArray();

// one aggregation, when you want it server-side
db.projects.aggregate([
  { $match: { _id: id } },
  { $lookup: { from: "tasks", localField: "_id", foreignField: "projectId", as: "tasks" } },
]);
```

⚠️ **Two queries are frequently better than one `$lookup`.** They parallelise, they paginate
independently, and they let you cache the parent separately. `$lookup` earns its place when the
join result is being aggregated server-side, or when the round trip genuinely dominates.

🔴 **Index the foreign key.** `{projectId: 1}` on the child collection is the index that makes
this shape work; without it every child fetch is a collection scan. It is the single most
commonly missed index in a referenced model.

A compound index earns its keep when the child list is always ordered or filtered the same way:
`{projectId: 1, createdAt: -1}` serves "this project's tasks, newest first" from the index,
with no in-memory `SORT` stage ([Phase 2](../phase-2-mongosh/04-explain.md)).

## The count problem

A referenced parent does not know how many children it has. Three answers:

1. **Count on demand** — `countDocuments({projectId: id})`. Accurate, indexed, fine for one
   parent; a problem when rendering a list of two hundred parents.
2. **Maintain a counter on the parent** — `$inc` on add and remove. Cheap to read, and it can
   drift if a write path forgets. Best paired with a periodic reconciliation.
3. **Aggregate once** — `$group` over the children to count per parent, for a list view.

**Choose by read pattern**, and if you maintain a counter, write down that it is derived data
and can be recomputed.

## Gotchas

**Symptom:** fetching a project's tasks is slow.
**Cause:** no index on the child's `projectId`.
**Fix:** create it. This is the defining index of the referenced shape.

**Symptom:** a `$lookup` page is slower than expected.
**Cause:** the join runs per parent document and its result is materialised in memory.
**Fix:** two queries with a limit, or an index supporting the lookup's foreign field.

**Symptom:** the parent document grows and gets rewritten constantly.
**Cause:** children embedded, or an id array pushed to on every add.
**Fix:** reference from the child side; the parent then never changes when a child is added.

**Symptom:** ordering is lost after moving to the child-reference shape.
**Cause:** order lived implicitly in the parent's array.
**Fix:** add an explicit `position` field on the child, and index `{projectId: 1, position: 1}`.
Reordering then means updating the affected children.

**Symptom:** a cached child count disagrees with reality.
**Cause:** a write path that adds or deletes children without adjusting the counter.
**Fix:** funnel writes through one place, and reconcile periodically. Treat the counter as
derived.

**Symptom:** deleting a parent leaves children behind.
**Cause:** there are no foreign keys and no cascade.
**Fix:** delete children explicitly, and consider whether an orphaned child is actually harmful
— sometimes it is not, and a sweeper is enough.

## Interview questions

**★ What are the three ways to model one-to-many, and when do you use each?**
Embed the children — one read, but every child edit rewrites the parent and the parent grows.
Embed an array of ids — keeps children editable independently but the parent still grows and
you still fetch twice; worth it mainly when order is a property of the parent. Reference from
the child with a `projectId` field — the default: the parent stays stable, it scales with the
child count, and children can be queried and edited on their own.

**★ Why is the array-of-ids shape over-used?**
Because it looks like a compromise while often taking the costs of both: the parent still grows
and is rewritten on every add, and you still need a second query for the children. Its genuine
advantage is preserving an order that belongs to the parent — a playlist or checklist — which
is the case it should be reserved for.

**★ Which index makes the referenced shape work?**
An index on the child's foreign key, `{projectId: 1}` — without it, every "get this parent's
children" query is a collection scan. If the list is always sorted the same way, make it
compound, `{projectId: 1, createdAt: -1}`, so the sort is served by the index instead of an
in-memory `SORT` stage.

**★ Two queries or a `$lookup`?**
Usually two queries: they parallelise, paginate independently and cache separately. `$lookup`
is right when the join feeds further server-side aggregation, or when the extra round trip
genuinely dominates. It is not automatically better for being one call.

**How does a referenced parent know how many children it has?**
It does not. Count on demand with `countDocuments` for a single parent, maintain a counter on
the parent with `$inc` if it is read constantly, or aggregate a `$group` count for list views.
A maintained counter is derived data and needs reconciliation, because any write path that
forgets it causes drift.

**What happens to children when a parent is deleted?**
Nothing — there are no foreign keys and no cascade. Delete them explicitly, or decide
deliberately that orphans are harmless and sweep them periodically.

---

← Prev: [One-to-few](./03-one-to-few.md) ·
Index: [Phase 3](./README.md) ·
Next → [One-to-squillions](./05-one-to-squillions.md)
