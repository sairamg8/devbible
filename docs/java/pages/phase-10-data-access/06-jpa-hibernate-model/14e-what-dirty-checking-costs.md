---
title: "The comparison is proportional to what is in the persistence context, not to what you changed — and it runs on every flush, which is not once per transaction"
sidebar_label: "14e · What dirty checking costs"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.2 *Bytecode Enhancement*,
> §6.2.2 *In-line dirty tracking*, §9.5.4, §13.3 *Session batching* and Appendix A
> *Bytecode enhancement settings*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.1, §5.10 and §6.3
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Every flush walks every managed entity and compares every mapped attribute. Nothing
about that is proportional to the number of things you changed. And because an
auto-flush happens before any query whose results your pending changes could affect, a
method that loads a lot and then runs several queries pays for the walk several times.
This is the cost that makes "just load it and modify it" stop scaling.**

## The shape of the cost

Per flush, the work is roughly **entities in the context × mapped attributes each**, plus
a deep copy for every mutable attribute value. The User Guide says it in plain terms:

> Then, as part of flushing the persistence context, Hibernate would walk every entity
> associated with the persistence context and check its current state against that "last
> known database state". […] However, in a persistence context with a large number of
> associated entities, it can also be a performance-inhibiting approach.

The *Introduction* attaches the same warning to the flush itself — "the session must
dirty-check every entity in the persistence context" — and to auto-flush specifically:

> By default, Hibernate dirty checks entities in the persistence context before executing
> a query […] But if there are many entities associated with the persistence context, then
> this can be an expensive operation.

Three separate multipliers, then:

1. **How many entities are in the context.** Everything you have loaded, not everything
   you have touched. A `findAll()` of ten thousand rows puts ten thousand entities in the
   context and they are all walked at every subsequent flush.
2. **How wide each entity is.** An entity with sixty columns costs sixty comparisons.
   `@Transient` fields cost nothing, which is one more reason not to map what you do not
   need.
3. **How many flushes happen.** Which is the multiplier people forget.

## Flushes are not once per transaction

A flush happens before commit, and before any JPQL/HQL query that overlaps with pending
changes, and whenever you call `flush()`. So this method flushes at least four times:

```java
@Transactional
public Report build(long accountId) {
    List<Order> orders = orderRepository.findAllByAccountId(accountId);   // N entities in the context
    orders.forEach(this::normalise);                                       // now they are dirty

    var a = orderRepository.countOpen(accountId);      // overlapping query → flush #1
    var b = orderRepository.sumTotals(accountId);      // overlapping query → flush #2
    var c = orderRepository.latest(accountId);         // overlapping query → flush #3
    return new Report(a, b, c);                        // commit          → flush #4
}
```

Only the first of those flushes has any writing to do. The other three still walk all *N*
entities, compare every attribute, find nothing, and issue nothing. The exact rules for
which queries force a flush are
[15b · What triggers a flush](15b-what-triggers-a-flush.md); what matters here is that the
count is not one.

## The memory half

The snapshot roughly doubles the memory footprint of a managed entity, and the context
holds it all. The User Guide's warning about long-lived sessions puts the two halves
together:

> The `Session` caches every object that is in a persistent state (watched and checked for
> dirty state by Hibernate). If you keep it open for a long time or simply load too much
> data, it will grow endlessly until you get an `OutOfMemoryException`.

The *Introduction* is equally direct: a persistence context "holds a hard reference to all
its entities, preventing them from being garbage collected. Thus, the session must be
discarded once a unit of work is complete."

## The three ways to make it smaller

**Load less.** The cheapest entity to dirty-check is one that was never loaded. A
projection or DTO query returns no entities at all, so it puts nothing in the context and
adds nothing to any subsequent flush. This is the same tool that solves other problems in
this phase and it is argued where it belongs, in
[topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

**Flush and clear in batches.** The User Guide's batching chapter recommends exactly this
for both writes — "When you make new objects persistent, employ methods `flush()` and
`clear()` to the session regularly, to control the size of the first-level cache" — and
reads: "When you retrieve and update data, `flush()` and `clear()` the session regularly."
`clear()` detaches everything, which drops both the entities and their snapshots.

```java
int i = 0;
for (Row row : rows) {
    entityManager.persist(toEntity(row));
    if (++i % 50 == 0) {
        entityManager.flush();
        entityManager.clear();      // ← the snapshots go too
    }
}
```

⚠️ After `clear()`, every previously managed instance is detached. Holding a reference to
one and continuing to modify it does nothing —
[12 · The four entity states](12-the-four-states.md).

**Load read-only.** If you are not going to modify what you loaded, the snapshot is pure
overhead, and Hibernate has several ways to skip it. That is
[14f · Turning it off](14f-turning-dirty-checking-off.md).

## Bytecode enhancement — and why the 7.4 answer is not the 5.x answer

The alternative to comparing is having the entity report on itself. Hibernate can rewrite
your entity classes so each one tracks which of its attributes have been assigned:

> In this approach Hibernate will manipulate the bytecode of your classes to add "dirty
> tracking" directly to the entity, allowing the entity itself to keep track of which of
> its attributes have changed. During the flush time, Hibernate asks your entity what has
> changed rather than having to perform the state-diff calculations.

The User Guide is careful to name what you give up, and it is not nothing:

> This [diff-based calculation] is by far the most thorough approach to dirty checking
> because it accounts for data-types that can change their internal state (`java.util.Date`
> is the prime example of this). If your application does not need to care about "internal
> state changing data-type" use cases, bytecode-enhanced dirty tracking might be a
> worthwhile alternative to consider, especially in terms of performance.

So in-line tracking sees assignments, not mutations. Everything in
[14c · What counts as a change](14c-what-counts-as-a-change.md) about mutating a `Date` or
a mutable converted value in place stops being detected.

🔴 **The setting the internet tells you to enable is deprecated in 7.4.** Appendix A's
entry for `hibernate.enhancer.enableDirtyTracking` reads:

> Whether to enhance the model for dirty-tracking. **This setting is deprecated for removal
> without a replacement.**

and the Gradle and Maven plugin parameters of the same name carry the same sentence,
noting they default to `true`. The related *extended* enhancement is deprecated outright:

> Hibernate's extended bytecode enhancement feature has been deprecated, primarily because
> it relies on assumptions and behaviors that often require a broader runtime scope than
> what Hibernate alone can reliably provide […] Applications which make use of this feature
> should instead use proper object-oriented encapsulation, exposing managed state via
> getters and setters.

⚠️ **What I could not confirm** from the 7.4 documentation is what the post-removal
behaviour will be — whether in-line dirty tracking becomes unconditional, or goes away.
The setting is documented as deprecated for removal "without a replacement" and no
migration note in the 7.4 user guide says which. Treat enhancement-based dirty tracking as
*not a supported tuning knob on this baseline*, and do not copy a Hibernate 5 blog post
that tells you to switch it on.

## Measuring it rather than guessing

Two instruments, both covered in [18 · Seeing what Hibernate does](18-seeing-what-hibernate-does.md):

- `hibernate.generate_statistics` gives you `getFlushCount()` — how many times the walk
  actually ran — alongside `getEntityUpdateCount()`. A flush count far larger than the
  update count is the signature of this problem.
- The `hibernate-jfr` integration emits `org.hibernate.orm.DirtyCalculationEvent`,
  `FlushEvent` and `PartialFlushEvent`, which is the only way to see the cost of the walk
  itself rather than its outcome.

## Gotchas

**★ The cost scales with what you loaded, not with what you changed.** A read-mostly
method that loads ten thousand rows and modifies one pays the same per-flush walk as one
that modifies all ten thousand.

**★ Queries in a loop multiply the walk.** Each overlapping query forces a flush, and each
flush walks everything. A loop that queries per iteration over a large loaded context is
quadratic in a way nothing in the code makes visible.

**★ `flush()` in a loop without `clear()` fixes nothing.** Flushing writes the pending
statements but leaves every entity managed and snapshotted. Only `clear()` reduces the
size of the walk.

**★ Wide entities cost on every read transaction, not only on writes.** The snapshot is
taken whether or not you intend to modify anything. Mapping forty columns you never read
is a per-flush tax on every method that loads the entity.

**★ `@Transient` is a performance decision as well as a mapping one.** Fields excluded
from mapping are excluded from the snapshot, the deep copy and the comparison.

**★ Mutable attribute types cost a deep copy per entity per load.** The snapshot cannot
alias the entity's own instance or the mutation would be invisible, so every mutable value
is copied. Immutable types skip that entirely and compare with `==`.

**★ Enabling `hibernate.generate_statistics` is itself not free.** The User Guide's own
words: "By default, the statistics are not collected because this incurs an additional
processing and memory overhead." Turn it on to diagnose, decide, then turn it off — or
leave it on knowingly.

**★ The advice "enable bytecode dirty tracking" is stale on 7.4.** The setting is
deprecated for removal without a replacement, and the extended variant is deprecated
outright with an explicit instruction to use encapsulation instead.

**★ A long-lived or request-scoped-extended persistence context makes all of this worse
at once.** More entities, more flushes, more memory, and a longer window for staleness.
[18c · `open-in-view`](18c-open-in-view.md) is the version of this that most Spring Boot
applications have switched on without deciding to.

## Interview questions

**★ What is the cost of dirty checking, in terms of what?**
Entities in the persistence context multiplied by mapped attributes each, plus a deep copy
per mutable value, per flush. It is independent of how many entities you actually
modified, and independent of how many statements come out.

**★ Why can one transaction pay for that walk several times?**
Because auto-flush runs before any query whose results the pending changes could affect,
in addition to the flush at commit. A method that loads a lot and then runs several
repository queries flushes several times.

**★ How would you find out whether dirty checking is actually your bottleneck rather than
assuming it?**
Turn on `hibernate.generate_statistics` and compare `getFlushCount()` with
`getEntityUpdateCount()`; a high flush count with few updates means repeated no-op walks.
For the cost of the walk itself, the `hibernate-jfr` integration emits
`DirtyCalculationEvent` and `FlushEvent`.

**★ What does `flush()` plus `clear()` in a batching loop actually save?**
`flush()` writes and lets the driver batch; `clear()` detaches everything, which discards
both the entities and their snapshots so the next flush has less to walk and the heap does
not grow. Flushing alone does not reduce the walk.

**★ What is bytecode-enhanced dirty tracking, and what does it give up?**
The entity tracks its own attribute assignments, so flush asks it what changed instead of
comparing against a snapshot. It gives up detection of internal-state mutation — the
`java.util.Date` case — which the User Guide names as the reason diff-based calculation is
"by far the most thorough approach".

**★ Should you enable it on Hibernate 7.4?**
No. `hibernate.enhancer.enableDirtyTracking` is documented as deprecated for removal
without a replacement, and the extended enhancement feature is deprecated with an explicit
recommendation to use ordinary encapsulation instead. Advice to enable it dates from
Hibernate 5.

**★ Why does a persistence context hold hard references to its entities, given the memory
cost?**
Because it has to guarantee one instance per row for its whole lifetime, and it has to
hold the snapshot to detect changes. Both are correctness requirements, which is why the
documentation's answer to the memory problem is to shorten the context's life rather than
weaken the references.

**★ Does an entity that was loaded and never modified cost anything at flush?**
Yes — it is walked and compared like every other one. It produces no statement, which is
the only part that is free.

---

← Prev: [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14f · Turning it off](14f-turning-dirty-checking-off.md)
