---
title: "The cures: confinement, immutability, synchronization"
sidebar_label: "3 · The cures"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the Oracle Java Tutorials concurrency
> lesson (Synchronization, Immutable Objects, Thread-Local), the JDK 25
> Javadoc for `ThreadLocal`, `ConcurrentHashMap`, `AtomicLong`,
> `LongAdder` and `java.util.concurrent.atomic`, and JLS SE 25 §17.4.

**A race needs three ingredients: state that is *shared*, state that is
*mutable*, and access that is *unsynchronized*. Remove any one and the
race is gone. That gives exactly three cure families — confinement (stop
sharing), immutability (stop mutating), synchronization (stop accessing
concurrently) — and they are listed in that order on purpose: the ones
that *remove* an ingredient beat the one that *manages* it, because there
is nothing left to get wrong.**

## Cure 1 — confinement: stop sharing

State only one thread can reach cannot race. Three practical forms:

- **Stack confinement.** Locals and parameters live on one thread's stack
  ([the two-worlds model](../../phase-1-language-core/01-primitives-vs-references/01-the-eight-primitives.md)).
  A pipeline that reads shared input, computes with locals, and publishes
  one result at the end confines everything in the middle for free. This
  is why pure functions parallelize trivially.
- **Thread confinement by design.** The object crosses no thread
  boundary: one worker owns the connection; each request thread builds
  its own `SimpleDateFormat` instead of sharing a static one (the classic
  corruption bug — its modern fix is `DateTimeFormatter`, which is
  immutable, cure 2). With virtual threads, one-object-per-task is cheap
  enough to be the default posture.
- **`ThreadLocal`.** Per-thread storage behind a shared name — each
  thread sees its own instance. Legitimate for request context and
  per-thread scratch buffers, with two documented traps: on *pooled*
  threads a value outlives the request unless `remove()` is called
  (leak + cross-request bleed), and with *millions* of virtual threads
  per-thread copies multiply. [topic 12 · `ThreadLocal` and `ScopedValue`](../12-threadlocal-scopedvalue/README.md) covers the JDK 25-era replacement.

Confinement's weakness: nothing enforces it. One leaked reference — a
field assignment, a listener registration, a stream captured into a
lambda that runs elsewhere — and the "confined" object is shared. It is
a discipline, so document it (`// confined to the event loop thread`)
and keep the confined type package-private where possible.

## Cure 2 — immutability: stop mutating

Shared reading is harmless; it is shared *writing* that races. An object
that cannot change after construction is thread-safe with no locks, no
matter how many threads hold it — and the JMM backs this with a special
guarantee for `final` fields (JLS §17.5): a properly constructed
immutable object is seen fully initialized by every thread, even when
the *reference* was passed around without synchronization.

The design recipe is [phase 2's immutable-design
topic](../../phase-2-classes-objects/12-immutable-design/README.md);
records make it the path of least resistance. The concurrency payoff:

```java
record PricingRules(Map<String, BigDecimal> rates) {
    PricingRules { rates = Map.copyOf(rates); }   // defensive, unmodifiable
}

// mutable *reference*, immutable *value* — swapped atomically
private volatile PricingRules current;

void reload(PricingRules fresh) { current = fresh; }   // writer
BigDecimal rate(String code) {
    return current.rates().get(code);                  // readers: no lock
}
```

Readers never see a half-updated rules table — there is no such state to
see. Change becomes *replacement*, and the only synchronization point is
one reference (`volatile` here; why that suffices is **topic 05** *(not
written yet)*). This copy-on-write shape scales to whole configuration
trees; the compound-invariant `Range` of [chunk 2](02-the-shapes.md)
dissolves the same way (`record Range(int lo, int hi)`, validated once).

Cost, stated honestly: replacement allocates. For a config reloaded per
minute, irrelevant. For a million-entry structure updated per request,
the copy dominates and you are back to cure 3 — or to persistent data
structures, which Java's standard library does not provide.

## Cure 3 — synchronization: manage the sharing

When state must be shared *and* mutable, arrange that conflicting
accesses cannot interleave:

- **Atomic compound operations first.** The library has already solved
  the common shapes, and its versions are both correct and contended-path
  optimized: `computeIfAbsent`/`putIfAbsent`/`merge` on
  `ConcurrentHashMap` for check-then-act on maps;
  `incrementAndGet`/`addAndGet`/`compareAndSet` on the atomic classes and
  `LongAdder` for hot counters ([topic 10](../10-atomics.md) and [topic 11](../11-concurrent-collections.md)).
  One method call, no lock to forget.
- **Locks for everything else.** `synchronized`
  ([topic 04](../04-synchronized-intrinsic-locks/README.md)) or
  `ReentrantLock` ([topic 09](../09-explicit-locks.md)) around the *entire*
  compound step — check and act together, every access path, including
  the reads. Locks are the general tool and the error-prone one: too
  little scope re-opens the gap, too much creates contention and
  deadlock ([topic 13](../13-deadlock-livelock-starvation/README.md)).
- **The store for cross-process races.** Chunk 2's double-charge showed
  it: JVM-level cures have JVM scope. Two service instances need the
  atomic step in the database (conditional update, version column) or an
  idempotency key under a unique constraint. Choosing the *level* is part
  of the cure.

## Choosing

| Situation | Cure |
|---|---|
| Value computed per task, published once | stack confinement — do nothing |
| Read-mostly config/rules/routing table | immutable value, `volatile` swap |
| Per-request context on a known thread model | `ThreadLocal` (with `remove`), or `ScopedValue` in 25 |
| Shared cache with per-key loading | `ConcurrentHashMap.computeIfAbsent` |
| Hot shared counter | `LongAdder` |
| Multi-field invariant, in-process | one lock spanning the invariant |
| Invariant across service instances | database constraint / conditional update / idempotency key |

The order of preference inside the table is the chapter's thesis in
miniature: *don't share; failing that, don't mutate; failing that,
synchronize — as locally and as declaratively as the library allows.*

## Gotchas

**Symptom:** dates parse garbage under load; fine single-threaded
**Cause:** a `static SimpleDateFormat` — mutable parse state shared across threads
**Fix:** `DateTimeFormatter` (immutable, documented thread-safe); the general move is *replace shared-mutable helpers with immutable ones*, not lock the old one

**Symptom:** user B's request shows user A's tenant context, intermittently
**Cause:** `ThreadLocal` context set per request, never removed, on a pooled thread — the next request inherited it
**Fix:** `try { ... } finally { context.remove(); }` per task, or migrate to `ScopedValue`, whose binding is scoped to the task by construction

**Symptom:** config reload made readers throw `ConcurrentModificationException`
**Cause:** reload *mutated* the shared map in place while readers iterated
**Fix:** build the new map completely, then swap one `volatile` reference — mutation becomes replacement, readers see old-or-new, never mid-edit

**Symptom:** "immutable" object's contents change anyway
**Cause:** shallow immutability — `final` reference to a mutable `List`/`Date`/array that the constructor stored without copying
**Fix:** deep immutability at the boundary: `List.copyOf`/`Map.copyOf` in, unmodifiable views or copies out — the [phase-2 recipe](../../phase-2-classes-objects/12-immutable-design/README.md)

**Symptom:** replacing `HashMap` with `ConcurrentHashMap` didn't fix the race
**Cause:** the compound was still two calls — `get` then `put`; a thread-safe map makes each call atomic, not the pair
**Fix:** use the map's own compound primitives (`computeIfAbsent`, `merge`, `compute`) so the whole shape is one atomic operation

**Symptom:** `AtomicLong` counter became the hottest cache line in the service
**Cause:** every thread CAS-ing one variable — correct, but a contention point by design
**Fix:** `LongAdder` — sharded cells summed on read; the Javadoc positions it exactly for high-contention statistics

**Symptom:** lock added, race gone, throughput gone too
**Cause:** cure 3 chosen where cure 1/2 was available — the lock serializes work that never needed sharing
**Fix:** re-ask the ingredient question: can this be per-task (confine)? can change become replacement (immutable)? synchronize only what is left

## Interview questions

**★ What are the three ways to make code thread-safe, and in what order do you reach for them?**
Remove an ingredient of the race: don't share (confinement — stack,
thread-owned objects, `ThreadLocal`), don't mutate (immutable values,
change-as-replacement), or synchronize the access that remains (atomic
compound operations first, locks second, store-level guards for
cross-process). In that order — cures that eliminate the hazard beat
cures that manage it.

**★ How can an immutable object be safely published without locks?**
The JMM's `final`-field guarantee (JLS §17.5): if all state is in `final`
fields and `this` doesn't escape construction, any thread that later
obtains the reference sees the fields fully initialized. Pair that with
atomic replacement of one `volatile` reference and you get lock-free
readers with consistent snapshots — the copy-on-write config pattern.

**★ When is `ThreadLocal` the right tool, and what are its two classic failure modes?**
Right for per-thread state behind a shared API — request context,
per-thread buffers — when passing a parameter through every signature is
impractical. Failures: on pooled threads, stale values leak into the next
task unless `remove()` runs (memory leak + data bleed); with virtual
threads, per-thread copies multiply by the million. `ScopedValue`
(topic 12) exists to fix both.

**★ Why doesn't switching to a thread-safe collection fix a check-then-act?**
Thread safety is per-operation; the race spans two operations. `get`
followed by `put` on a `ConcurrentHashMap` still has the gap — another
thread's `put` lands between them. The fix is the collection's atomic
compound (`computeIfAbsent`, `putIfAbsent`, `merge`), which performs
check and act under the map's own guard.

**★ What does confinement cost, compared to locking?**
Nothing at runtime — that's its appeal; no contention, no deadlock
surface. Its cost is fragility: the compiler doesn't check it, so one
escaped reference silently converts "confined" to "shared-unsynchronized".
Mitigations: minimize the confined object's visibility, document the
owning thread, and prefer immutability where the object must travel.

**★ Your in-process fix is correct. Why might the race still occur in production?**
Because the race is cross-process: multiple instances, or an external
actor (another service, a human retry) hitting the same store. JVM
cures scope to the JVM. The atomic step must live where the shared truth
lives — a conditional update, a unique constraint, an idempotency key —
as in the double-charge layering of [chunk 2](02-the-shapes.md).

---

← Prev: [The shapes](02-the-shapes.md) · Index: [Race conditions](README.md) · Next → [`synchronized` and intrinsic locks](../04-synchronized-intrinsic-locks/README.md)
