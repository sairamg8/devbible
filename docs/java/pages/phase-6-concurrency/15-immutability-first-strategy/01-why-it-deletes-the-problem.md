---
title: "Why immutability deletes the problem"
sidebar_label: "1 · Why it deletes the problem"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §17.5 (final field semantics),
> §17.5.1 (semantics of final fields), §17.5.3 (later modification of
> final fields), the JDK 25 Javadoc for `java.lang.Record` and `String`,
> and the Oracle Java Tutorials (Immutable Objects).

**A race needs shared, mutable, unsynchronized state — remove any one
ingredient and the race cannot form ([the cures](../03-race-conditions/03-the-cures.md)).
Confinement removes *shared* but nothing enforces it; locks manage
*unsynchronized* but must guard every access path forever. Immutability
removes *mutable*, and it is the only removal the type system helps you
keep: `final` fields, no setters, defensive copies — violations become
compile errors or visible API decisions, not timing accidents. And the
JMM rewards it with a guarantee no other technique gets: properly
constructed immutable objects can be passed between threads with **no
synchronization at all** and still be seen fully built.**

## What "thread-safe by construction" actually means

Concurrency bugs are bugs in *transitions*: one thread observes another
thread's write mid-flight. An immutable object has no transitions after
construction — its entire life is one state. Consequences, each of which
is a whole problem class gone:

- **No lost updates** — there are no updates.
- **No check-then-act window** — what you checked cannot have changed by
  the time you act on *that object* (the reference you re-read may point
  elsewhere — that is chunk 3's subject, and it is a smaller problem).
- **No visibility staleness on fields** — a thread that reaches the
  object sees the only state it ever had.
- **No lock ordering, no deadlock** — nothing to lock.
- **Reads scale for free** — a million virtual threads can read the same
  snapshot with zero coordination; contention needs a *write* to exist.

`String` is the existence proof: the most-shared object type in every
JVM, handed between threads billions of times a day, and no code ever
locks one to read it.

## The JMM's reward: JLS §17.5

The guarantee, precisely: **if an object's fields are `final`, and the
object is *properly constructed* (the reference does not escape during
construction), then every thread that sees a reference to it sees the
final fields correctly initialized — including everything reachable
through them — even if the reference was published with a data race.**

That last clause is the remarkable part. Publication through a plain,
non-volatile field — a data race by [topic 05's definition](../05-java-memory-model/01-reordering-and-visibility.md) —
normally promises nothing: the reader might see a reference to an object
whose fields still hold their zero values. Final fields are the
exception the JLS carves out: the writes to them (and to objects they
point to, made before construction ends) act as if "frozen" at the end
of the constructor, and any thread that later reads the reference is
guaranteed to see at least that frozen state.

```java
record Endpoint(String host, int port) {}          // all fields final

class Registry {
    static Endpoint current;                       // NOT volatile — a race!

    static void init() { current = new Endpoint("api.internal", 443); }
}
```

A racy reader of `Registry.current` may see `null` (the write may not
have reached it) — but it can **never** see an `Endpoint` with
`host == null` or `port == 0`. Half-built is off the menu; absent is
not. Compare the mutable equivalent, where a racy reader can observe any
subset of the constructor's writes.

The condition — *properly constructed* — has teeth. If `this` escapes
before the constructor returns (registered as a listener, stored in a
static, captured by a thread started in the constructor), the freeze has
not happened yet and the guarantee is void. Escape analysis is not done
for you: it is a code-review discipline.

## Records: the guarantee as the default

Phase 2's [immutable-design recipe](../../phase-2-classes-objects/12-immutable-design/README.md)
builds this by hand: `final` class, `final` fields, no setters,
defensive copies in and out. Records compile that recipe into a
declaration: every component field is implicitly `final`, there are no
setters to write, and the canonical constructor is the single choke
point where invariants and defensive copies live.

```java
record PricingRules(Map<String, BigDecimal> rates) {
    PricingRules {
        rates = Map.copyOf(rates);   // deep enough: String and BigDecimal are immutable
    }
}
```

Under threads this is not just less typing. The `final`-ness of record
fields means **every record whose components are themselves immutable
gets the §17.5 guarantee automatically** — a record of strings, numbers
and other such records is safely publishable through a data race, by
construction, forever. The one hole records leave open: a component
whose *type* is mutable (`Date`, arrays, `List` from a caller). The
compact constructor must copy those, or the record is a mutable object
wearing an immutable interface — chunk 2 dissects exactly this.

## The trade, stated honestly

Immutability moves cost from *coordination* to *allocation*: change
means a new object. Three facts keep that honest:

- Most objects in a request-shaped workload are short-lived, and
  generational GC is designed around exactly that population
  ([object lifecycle](../../phase-2-classes-objects/14-object-lifecycle.md)).
- The alternative has costs too — lock acquisition on every read path,
  and the engineering cost of proving every access path is guarded.
- Where a hot loop genuinely cannot afford allocation, that is a
  *measured, local* decision to fence in mutation (chunk 3), not a
  reason to default to shared mutability everywhere.

## Gotchas

**Symptom:** an object with all-final fields is still observed half-initialized by another thread
**Cause:** `this` escaped during construction — a listener registration or thread start inside the constructor published the reference before the §17.5 freeze
**Fix:** constructors construct, nothing else; publish after the constructor returns (static factory that registers the fully built instance)

**Symptom:** team believes "final fields → safely publishable" and applies it to a class holding an `ArrayList` that gets `add()`ed later
**Cause:** §17.5 freezes the state reachable *at end of construction*; later writes through the final reference are ordinary racy writes
**Fix:** the guarantee covers immutable *objects*, not final *references* to mutable ones — copy into an unmodifiable collection at construction

**Symptom:** `record` used as a map key corrupts lookups after a component is "changed"
**Cause:** the component was a mutable type (array, `List`) mutated after insertion — `hashCode` moved
**Fix:** records are only as immutable as their components; copy mutable inputs in the compact constructor ([phase 2, records](../../phase-2-classes-objects/08-records/README.md))

**Symptom:** deserialized objects break an invariant that the constructor enforces
**Cause:** serialization frameworks bypass constructors (and can even write final fields reflectively — JLS §17.5.3 permits it with defined limits)
**Fix:** validate in `readObject`/a builder the framework calls, or use records — their canonical constructor **is** invoked by Java serialization

**Symptom:** performance review rejects immutability "because allocation"
**Cause:** coordination costs (locks on read paths, cache-line contention) were never priced into the comparison
**Fix:** compare designs, not instincts — and remember reads dominate writes in most services; immutable snapshots make the dominant operation free

## Interview questions

**★ Why is an immutable object thread-safe without synchronization?**
Thread-safety failures are observations of partial or interleaved
writes. After construction an immutable object has no writes, so every
read — from any thread, at any time — sees the one state that exists.
The JMM adds §17.5: even *publication* of the reference needs no
synchronization if fields are final and construction didn't leak `this`.

**★ What exactly does the final-field guarantee promise, and what is the condition?**
Threads that see a reference to the object see its final fields as
frozen at constructor end — including objects reachable through them —
even if the reference itself was published via a data race. Condition:
proper construction; `this` must not escape before the constructor
returns. Non-final fields of the same object get no such promise.

**★ A record holds a `List` component. Is it immutable?**
Only if the list can't change: the record's *field* is final (the
reference can't be reassigned) but the list's *contents* are whatever
the list allows. `Map.copyOf`/`List.copyOf` in the compact constructor
closes it. Shallow immutability is the default; deep is a decision.

**★ Why does `String` need no locks?**
No mutating methods, `final` fields internally, and every "modification"
(`concat`, `replace`) returns a new instance. It is the JDK's proof that
share-everything works when nothing mutates — and why string-heavy code
parallelizes without thought.

**★ Where does immutability *not* remove the concurrency problem?**
The problem moves to the *reference*: deciding which immutable snapshot
is current is still a shared-mutable decision (one variable wide).
Check-then-act across *two reads of the reference* can still race. The
snapshot-swap and CAS patterns exist exactly for that residue — it is a
one-variable problem instead of an every-field problem.

**★ Does immutability cost too much GC?**
Short-lived immutable objects are the population generational collectors
are optimized for; most die in the young generation at near-zero cost.
The honest comparison includes the mutable design's lock traffic and the
defect cost of a missed guard. Where allocation genuinely dominates a
measured hot path, confine mutation locally — don't abandon the strategy
globally.

---

← Prev: [Topic index](README.md) · Index: [Immutability as the first strategy](README.md) · Next → [Boundaries, copies and "effectively immutable"](02-boundaries-and-effective-immutability.md)
