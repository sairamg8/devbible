---
title: "volatile and safe publication"
sidebar_label: "3 · volatile and safe publication"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JLS SE 25 §8.3.1.4 (volatile Fields),
> §17.4.5 (Happens-before Order), §17.5 (final Field Semantics), §12.4.2
> (class initialization procedure — the holder idiom's guarantee), and
> §17.7 (atomic volatile long/double).

**`volatile` buys exactly two things: every read sees the most recent
write (visibility), and the volatile access acts as the ordering point
that plain reads and writes cannot be reordered across in the ways that
would break publication. It buys *no* mutual exclusion and *no* atomicity
for compound actions. Safe publication is the discipline built on top:
constructing an object and handing its reference to other threads such
that they can never observe it half-built.**

## What `volatile` guarantees

- **Visibility** — a read of a volatile field returns the value of the
  most recent write in the synchronization order; no register caching, no
  hoisting the read out of a loop. The stop-flag from
  [chunk 1](01-reordering-and-visibility.md) is fixed by this alone.
- **Ordering** — volatile write *hb* subsequent volatile read of the same
  field, and via piggybacking ([chunk 2](02-happens-before.md)) that edge
  publishes every plain write made before it.
- **64-bit atomicity** — `volatile long`/`double` reads and writes are
  atomic (JLS §17.7); no word tearing.

## What it doesn't

- **No atomic read-modify-write.** `volatile int counter; counter++` is
  still read-add-write; concurrent increments still lose updates. That
  needs `AtomicInteger.incrementAndGet` — **topic 10 · Atomics** *(not
  written yet)* — or a lock.
- **No compound invariants.** `volatile` can't keep `min <= max` true
  across two fields; any multi-field invariant needs exclusion ([topic 04](../04-synchronized-intrinsic-locks/README.md)) or an immutable snapshot object swapped atomically.
- **No waiting.** A volatile flag can't block a consumer until data is
  ready; that's what latches, queues and `wait`/`notify` are for.

The decision rule: `volatile` is right for **one-writer flags** and for
**publishing immutable snapshots**; the moment two threads both *modify*
based on what they read, you've outgrown it.

## Safe publication — the problem

Construction is plain writes. Publishing the reference is another plain
write. Nothing orders them for other threads:

```java
// Thread A
config = new Config("prod", 30);   // field writes + reference write race
// Thread B
Config c = config;                  // may see non-null c...
c.timeout();                        // ...with default-valued fields
```

The JMM permits B to see the reference *before* the constructor's writes.
An object must therefore be published through an edge — or be immune by
construction.

**The safe publication idioms** (each rides an edge from chunk 2):

1. **Static initializer / holder** — class initialization is performed
   under the JVM's own locking (JLS §12.4.2); anything published from a
   static initializer is safe.
2. **`volatile` field** — write the reference last; readers' volatile read
   gives them the constructor's writes by piggybacking.
3. **A lock** — writer stores under `synchronized`, readers read under the
   same monitor.
4. **A concurrent structure** — `ConcurrentHashMap.put`, a
   `BlockingQueue.put`, an executor task handoff: their documented edges
   do the publishing.
5. **`final` fields** — the special one, below.

## `final` fields: safety without an edge

JLS §17.5 gives `final` fields a guarantee the others don't have: if the
constructor **does not leak `this`** before returning, then any thread
that sees the object's reference sees the final fields' values (and
everything reachable through them at freeze time) — *even if the reference
itself was published through a data race*. This is why
[immutable objects](../../phase-2-classes-objects/12-immutable-design/README.md)
are the first concurrency strategy: make every field `final` and even
sloppy publication can't show anyone a half-built instance. Two fine
points:

- The guarantee covers what the final field *referenced at construction
  end* — mutating a `final ArrayList`'s contents afterwards is back to
  ordinary racing.
- Leaking `this` from the constructor (registering a listener, starting a
  thread in it) voids the freeze for that observer.

## Double-checked locking — the historical exhibit

The idiom everyone wrote, broken for a decade, fixed by one keyword:

```java
class Holder {
    private static volatile Expensive instance;   // volatile is the fix

    static Expensive get() {
        Expensive local = instance;               // 1st check, no lock
        if (local == null) {
            synchronized (Holder.class) {
                local = instance;                 // 2nd check, locked
                if (local == null) {
                    instance = local = new Expensive();
                }
            }
        }
        return local;
    }
}
```

Without `volatile`, the unlocked first read may observe a reference
written before the `Expensive` constructor's field writes are visible —
a half-built singleton escaping through the fast path. (Pre-JSR-133 JVMs
made this unfixable, which is why the idiom's reputation is "broken";
since Java 5 the volatile version is correct.) The cleaner modern answer
avoids the ceremony entirely:

```java
class Holder {
    private static class Lazy {
        static final Expensive INSTANCE = new Expensive();   // JLS §12.4.2
    }
    static Expensive get() { return Lazy.INSTANCE; }         // lazy + safe
}
```

Class initialization runs at most once, under JVM locking, on first use —
lazy, thread-safe, no `volatile`, no measurable fast-path cost.

## Gotchas

**Symptom:** `volatile int hits; hits++` under load reports fewer hits than requests
**Cause:** volatile gives visibility, not atomicity — concurrent read-add-write interleavings lose updates exactly as with a plain field
**Fix:** `AtomicInteger`/`LongAdder` ([topic 10](../10-atomics.md)), or count under the lock that already guards the operation

**Symptom:** singleton via double-checked locking intermittently returns an object whose fields are default values
**Cause:** the `instance` field isn't volatile — the unlocked read can see the reference before the constructor's writes
**Fix:** declare it `volatile`, or replace the idiom with the holder class / an enum singleton

**Symptom:** an immutable-looking object still shows stale contents to readers
**Cause:** fields are not `final` (freeze semantics don't apply), or a `final` collection's *contents* are mutated after construction
**Fix:** every field `final`, defensive copies in, unmodifiable views out — the full recipe in [immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)

**Symptom:** listener callbacks arrive on a half-initialized object
**Cause:** the constructor registered `this` with the listener source before returning — `this` escaped, voiding the final-field guarantee for that path
**Fix:** construct fully, then register in a factory method after the constructor returns

**Symptom:** replacing `synchronized` getters/setters with `volatile` "for performance" introduces rare corruption
**Cause:** the setters did read-modify-write or maintained multi-field invariants; volatile removed the exclusion that made those compound actions safe
**Fix:** volatile only replaces locks for single independent values written blind; anything compute-then-store keeps the lock or moves to atomics

**Symptom:** config hot-reload: readers see a mix of old and new settings
**Cause:** individual mutable fields updated one by one; readers interleave between the writes
**Fix:** immutable `Config` object, one `volatile Config current` reference, swap wholesale — readers get old *or* new, never a blend

**Symptom:** `Map` used as a cache, wrapped in `volatile` reference, still misbehaves under concurrent put
**Cause:** volatile orders the *reference*; two threads mutating the same `HashMap` instance underneath is a data race on its internals
**Fix:** `ConcurrentHashMap` (its own edges), or copy-on-write swap of an immutable map if writes are rare

## Interview questions

**★ What does `volatile` guarantee, and what is the classic thing it doesn't?**
Guarantees: reads see the latest write (visibility), volatile write→read
is a happens-before edge (ordering, incl. piggybacked plain writes), and
64-bit accesses are atomic. Doesn't: atomicity of compound actions —
`counter++` still loses updates; no mutual exclusion, no multi-field
invariants.

**★ When is `volatile` the *right* tool, not just a working one?**
One writer publishing to many readers: shutdown flags, "current
configuration" references to immutable snapshots, one-shot state
transitions. Multiple writers or check-then-act logic → atomics or locks.

**★ Why was double-checked locking broken, and what fixed it?**
The unlocked fast-path read could observe the reference before the
constructor's writes — permitted reordering under the pre-Java-5 model
and still permitted today without volatile. JSR-133 (Java 5) gave
`volatile` its current edge semantics, making the volatile version
correct. The holder idiom sidesteps it via class-init locking (JLS
§12.4.2).

**★ How can an object be safely visible even when published via a data race?**
Only through final-field semantics (JLS §17.5): if every field is `final`
and `this` didn't escape construction, any thread that gets the reference
sees the frozen field values. This is unique — no other mechanism survives
racy publication.

**★ Name the safe-publication idioms.**
Static/holder initialization; volatile reference; lock-guarded read and
write; handoff through a concurrent collection, queue or executor; and
immutability via final fields. Each is just a named happens-before edge —
except the last, which is the freeze rule.

**★ Hot-reloadable config: how do you structure it and why?**
Immutable `Config` (all-final), a single `volatile Config current`,
writers build a complete new instance and assign once, readers read the
reference once per operation and use that snapshot throughout. Guarantees
each operation sees one coherent config; no torn mixes, no locks on the
read path.

**★ Is `volatile` free?**
No — it forbids the caching and reordering that make plain accesses fast:
reads can't be hoisted, writes can't be deferred, and on most hardware the
write path includes fencing. Cheaper than an uncontended lock, far
costlier than a plain field — which is why you don't sprinkle it "for
safety", you place it on the specific shared fields that need the edge.

---

← Prev: [Happens-before](02-happens-before.md) · Next → [ExecutorService and pools](../06-executorservice-pools/README.md)
