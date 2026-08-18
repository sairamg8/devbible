---
title: "Where it breaks in production"
sidebar_label: "3 · Where it breaks in production"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.util.HashMap` and `Object` Javadoc
> (JDK 25), and the Hibernate ORM 6.x user guide sections on identifier
> generation and equality (hibernate.org/orm/documentation/).

**Three shapes account for nearly every equals/hashCode incident: a key
mutated after insertion, a subclass that broke symmetry, and a JPA entity
whose identity changed mid-lifecycle. Each is legal-looking code; each turns
a collection into a liar. This chunk is the field guide.**

## Bug 1 — the mutated key: the disappearing entity

```java
Set<Order> pending = new HashSet<>();
Order o = new Order("A-1001", Status.NEW);
pending.add(o);            // hashed into bucket for ("A-1001", NEW)

o.setStatus(Status.PAID);  // a compared field changes...

pending.contains(o);       // false — looks in the ("A-1001", PAID) bucket
pending.remove(o);         // false — nothing removed
pending.size();            // still 1: present, unreachable, unremovable
```

The set stored the object in the bucket its *old* hash selected. After the
mutation, every lookup computes the *new* hash and searches the wrong bucket.
The entry is now a phantom: it holds memory, appears in iteration, and can
never be found or removed by value again. Nothing throws, because nothing in
the contract was violated at any single instant — the *combination* of
"mutable compared field" and "sitting in a hash collection" is the bug.

Three real fixes, strongest first:

1. **Immutable key state** — equality fields are `final` (or the whole class
   is a record). The bug becomes unrepresentable. This is Phase 2's
   **topic 12 · Designing immutable classes** *(not written yet)* earning its
   keep.
2. **Equality on identity fields only** — compare the immutable business key
   (`orderNumber`), never mutable state (`status`). Mutation then doesn't
   move the object between buckets.
3. **Discipline** (weakest): remove → mutate → re-add. Works until the one
   call site that forgets; treat as a code smell, not a policy.

The same failure wears other costumes: a `HashMap` key whose field is updated
"just for display", a cached object mutated by a caller that received the
live reference (defensive copies — topic 12), a `TreeSet` element mutated so
the tree's ordering invariant silently breaks (the comparator cousin of this
bug — [phase 3, topic 10](../../phase-3-generics-collections/README.md)).

## Bug 2 — the subclass that broke symmetry

The `instanceof` policy from chunk 2, failing on schedule:

```java
class Point {
    final int x, y;
    @Override public boolean equals(Object o) {
        return o instanceof Point p && x == p.x && y == p.y;
    }
}

class ColorPoint extends Point {
    final Color color;
    @Override public boolean equals(Object o) {
        return o instanceof ColorPoint cp
            && super.equals(cp) && color == cp.color;
    }
}
```

Now `point.equals(colorPoint)` is true (a `ColorPoint` *is a* `Point` with
matching coordinates) but `colorPoint.equals(point)` is false (a `Point` is
no `ColorPoint`). Symmetry is gone — and symmetry is not academic:
`list.contains(x)` calls `element.equals(x)` while your test calls
`x.equals(element)`, so **the same pair answers differently depending on who
asks**. `List.indexOf`, `remove(Object)`, assertion libraries and `HashSet`
membership all become order-of-comparison lotteries.

There is no repair that keeps both inheritance and the added field
(chunk 2's Liskov collision). The production-grade outcomes:

- **Value classes are `final`** — records enforce this for free. No
  subclass, no asymmetry.
- Variation via **composition**: `record ColorPoint(Point point, Color color)`
  — its generated equality is symmetric, and nobody ever compares it *as* a
  `Point` accidentally.

## Bug 3 — JPA entities: identity that arrives late

Entities break both naive strategies:

- **All-fields equality** (record-style) is wrong: two snapshots of the same
  row before and after an update compare unequal, and mutable fields recreate
  Bug 1 the moment an entity sits in a `Set` (which every `@OneToMany`
  collection is).
- **Database-id equality** hits the id lifecycle: with `GenerationType.IDENTITY`
  the id is null until `persist` flushes. Two new entities are "equal"
  (null == null under naive comparison), collapse to one entry in a `Set`,
  and then *change hash* when the id arrives — Bug 1 again, triggered by the
  framework.

The recipe Hibernate's own documentation converges on:

- **Best: a natural/business key** — immutable, assigned at construction
  (`orderNumber`, `sku`, an application-generated UUID). Ordinary id-based
  equality, no lifecycle problem, because the key never changes.
- **With DB-generated ids**: equals compares ids only when *both are
  non-null*; a transient (id-less) entity equals nothing but itself — and
  `hashCode` returns a **constant** (e.g. `getClass().hashCode()`), so the
  hash cannot change when the id arrives. All transient entities colliding
  into one bucket is a performance shrug, not a correctness bug.
- **Type check with `instanceof`**, never `getClass` — Hibernate hands you
  runtime-generated proxy subclasses, and `getClass`-equality declares a
  proxy unequal to its own entity.

## Gotchas

**Symptom:** an element is in the set (visible when iterating) but `contains` and `remove` return false
**Cause:** a compared field mutated after insertion — the entry sits in the bucket of its old hash
**Fix:** immutable equality fields, or equality restricted to an immutable business key; rebuild the collection to recover the current phantoms

**Symptom:** `a.equals(b)` and `b.equals(a)` disagree
**Cause:** subclass added a compared field under an `instanceof` policy — symmetry broken
**Fix:** make the value class final (or a record) and express variation by composition; there is no both-ways fix

**Symptom:** `assertThat(list).contains(x)` passes locally, the equivalent check fails in another codepath for the same data
**Cause:** asymmetric equals — collection methods fix which side calls `equals`, and different call sites pick different sides
**Fix:** same as above; asymmetry makes truth depend on argument order, so tests can't be trusted until it's gone

**Symptom:** a `Set` of new (unsaved) JPA entities collapses distinct entities into one
**Cause:** id-based equals while every id is still null
**Fix:** transient entities equal only themselves (null-id ⇒ not equal); or use an application-assigned key so ids never start null

**Symptom:** entities added to a `Set` before `persist` can't be found in it after the flush
**Cause:** `hashCode` derived from the id, which changed from null to a value — the framework performed Bug 1 for you
**Fix:** constant `hashCode` for id-equality entities, or application-assigned immutable keys

**Symptom:** entity equality randomly fails only when lazy loading is involved
**Cause:** `getClass()`-based equals meeting a Hibernate proxy (a runtime subclass)
**Fix:** `instanceof`-based type check in entity `equals`

**Symptom:** `HashSet` of orders "loses" entries after a bulk status-update routine
**Cause:** Bug 1 at scale — a batch job mutating compared fields of elements in a live set
**Fix:** collect ids to update, rebuild the set after mutation — or stop comparing mutable state

## Interview questions

**★ Walk through the "object disappears from a HashSet" bug.**
Insertion stores the entry in the bucket chosen by its hash at that moment.
Mutating an equality field changes the hash; lookups now search a different
bucket and miss. The entry still exists — iteration shows it — but
`contains`/`remove` fail. Prevention: immutable equality fields or
business-key-only equality.

**★ Why is `equals`/`hashCode` hard for JPA entities specifically?**
The natural candidates both fail: full-field equality breaks under mutation
and snapshots; DB-id equality breaks because the id is null until flush, then
changes — moving the entity between hash buckets mid-lifecycle. The working
recipe: immutable business key, or ids compared only when both non-null plus
a constant hashCode, with `instanceof` for proxy safety.

**★ A subclass adds a field and includes it in `equals`. What breaks, and what's the design answer?**
Symmetry: parent-vs-child comparisons answer differently by direction, so
`contains`/`indexOf`/assertions depend on who calls whom. No implementation
preserves both symmetry and subclass extension — so value classes should be
final (records), with variation via composition.

**Why must `hashCode` be constant for entities that compare by generated id?**
The id mutates once (null → assigned). A hash derived from it changes at that
moment, stranding the entity in its pre-persist bucket. A constant hash keeps
every lifecycle stage in one bucket; the collision cost is acceptable.

**A batch job updates statuses of orders held in a `HashSet`. What do you review for?**
Whether `Order.equals`/`hashCode` touch the mutated field. If yes: phantom
entries after the job. Demand business-key equality or a rebuild of the set
post-mutation.

**Is a mutable object ever safe as a `HashMap` key?**
Only if its equality fields are immutable (mutation touches non-compared
state). If equality state can change while keyed, the map *will* eventually
lie — the contract's consistency clause is per-instant, and collections have
memory.

---

← Prev: [Implementing it right](02-implementing-it-right.md) · Index: [equals and hashCode](README.md)
