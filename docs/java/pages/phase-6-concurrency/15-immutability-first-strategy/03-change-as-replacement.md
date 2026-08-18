---
title: "Change as replacement"
sidebar_label: "3 · Change as replacement"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `AtomicReference`
> (`compareAndSet`, `updateAndGet`, `getAndUpdate`), `LongAdder`,
> `CopyOnWriteArrayList`, and JLS SE 25 §17.4 (volatile semantics); the
> wither/builder patterns validated against the `java.time` API design
> (`LocalDate.withDayOfMonth` et al.).

**Immutable data still has to change — prices reload, flags flip,
routes update. The move is to stop mutating the *object* and start
replacing the *reference*: build a complete new snapshot, then swap one
pointer. The concurrency problem shrinks from "every field of every
shared object" to "one reference", and one reference is exactly what
`volatile` and `AtomicReference` are built to handle. Every pattern in
this chunk is that one idea at a different write-concurrency level.**

## Level 1 — one writer: the volatile snapshot swap

The read-mostly workhorse — config, pricing, feature flags, routing
tables — with a single writer (a reload thread, an admin endpoint):

```java
record Config(Map<String, String> values) {
    Config { values = Map.copyOf(values); }
}

class ConfigHolder {
    private volatile Config current;              // ONE mutable place

    Config get() { return current; }              // readers: no lock, no copy
    void reload(Config fresh) { current = fresh; }// single writer
}
```

Readers pay one volatile read; the `volatile` write→read edge
([topic 05](../05-java-memory-model/03-volatile-and-safe-publication.md))
publishes the snapshot safely, and §17.5 backs the record's innards.
Torn state is unrepresentable: a reader holds either the old snapshot or
the new one, both complete.

**The discipline the pattern demands:** read the reference **once** per
operation. Two reads can straddle a swap:

```java
// BROKEN: current may change between the two reads
if (holder.get().values().containsKey(k)) {
    return holder.get().values().get(k);          // different snapshot!
}
// RIGHT: snapshot once, then operate on the local
Config c = holder.get();
return c.values().getOrDefault(k, fallback);
```

This is check-then-act ([the shapes](../03-race-conditions/02-the-shapes.md))
resurfacing at the reference level — the one residue immutability leaves.

## Level 2 — many writers: CAS retry on `AtomicReference`

Concurrent writers can't just assign; last-write-wins destroys updates.
`AtomicReference.compareAndSet` makes replacement conditional on "still
the version I started from":

```java
private final AtomicReference<PricingRules> rules = new AtomicReference<>(initial);

void addRate(String code, BigDecimal rate) {
    rules.updateAndGet(old -> {
        var m = new HashMap<>(old.rates());       // private working copy
        m.put(code, rate);
        return new PricingRules(m);               // ctor Map.copyOf-freezes
    });
}
```

`updateAndGet` runs the lambda, CASes, and **retries on interference** —
so the function must be pure (no side effects, no I/O): it may run more
than once. Losers redo a copy instead of blocking; readers never wait at
all. Under heavy write contention the copies get expensive — that is the
signal you've left read-mostly territory and a lock or a concurrent
collection fits better. The CAS machinery itself is **topic 10 ·
Atomics** *(not written yet)*; here it is the writer's tool for the
snapshot swap.

`CopyOnWriteArrayList` is this exact pattern productized — every mutator
copies the backing array under an internal lock, readers and iterators
see immutable snapshots (iterators never throw
`ConcurrentModificationException`, and never see later writes). Same
economics: listener lists and other tiny, read-dominated collections
only.

## Building the next snapshot: builders and withers

- **Builder → freeze**: accumulate mutably in *confined* scope, publish
  immutable. `StringBuilder` → `String` is the JDK's archetype;
  `Stream.toList()` likewise — a mutable accumulation inside the
  terminal op, an unmodifiable list out. The mutable phase never crosses
  a thread; only the frozen result is shared. This is confinement and
  immutability composed, and it is how "immutable" stays ergonomic.
- **Withers**: small derived changes as copy-with-one-difference —
  `LocalDate.withDayOfMonth(1)`, or on your own records:

```java
record Order(String id, Status status, List<Line> lines) {
    Order withStatus(Status s) { return new Order(id, s, lines); }
}
```

Until record derivation syntax ships in a future JDK (in-progress
Project Amber work, not in 25 — verify before citing a version), withers
are written by hand and keep call sites honest: change produces a new
value, visibly.

## Where mutation genuinely belongs

The strategy is "immutability *first*", not "immutability *only*". The
honest exceptions, each with its fence:

| Need | Fence |
|---|---|
| Hot shared counters/metrics | `LongAdder` — designed for contended accumulation (**topic 10** *(not written yet)*); the total is read rarely, written constantly |
| Accumulation during a computation | confine the mutable structure to one thread (or one stream terminal op), publish the frozen result |
| Large state with tiny frequent updates | a concurrent collection (**topic 11** *(not written yet)*) — full-snapshot copies would dominate; you are no longer read-mostly |
| Caches | `ConcurrentHashMap` with immutable *values* — mutability confined to the map's own thread-safe machinery |

The pattern across all four: mutation is allowed **inside a boundary
something enforces** — a thread, a lock, a class built for it — and
immutable values flow across the boundary.

## Gotchas

**Symptom:** feature behaves as if half the new config applied
**Cause:** code read `holder.get()` several times across one operation, straddling a reload
**Fix:** one snapshot read per unit of work, passed down as a parameter — never re-fetch mid-operation

**Symptom:** updates vanish under concurrent writers despite `volatile`
**Cause:** read-copy-write on a plain volatile reference — two writers copied the same old snapshot; last CAS-less write wins
**Fix:** `AtomicReference.updateAndGet` (retry loop), or serialize writers behind one lock/queue — `volatile` alone is a single-writer tool

**Symptom:** side effect (audit log line, counter) fires twice per update
**Cause:** the `updateAndGet` function has side effects and was retried on contention
**Fix:** keep the function pure; perform side effects after the update returns, using the returned value

**Symptom:** p99 latency spikes and allocation churn after moving a large, write-heavy structure to snapshot-swap
**Cause:** every write copies the world; the workload was never read-mostly
**Fix:** match pattern to write rate — concurrent collections or locking for write-heavy state; snapshot-swap is for read-dominated data

**Symptom:** `CopyOnWriteArrayList` iterator never sees elements added moments ago
**Cause:** by design — iterators walk the array snapshot taken at creation
**Fix:** that is the contract you chose for tear-free iteration; re-iterate for fresh state, or use a concurrent collection when growth must be visible mid-walk

**Symptom:** two related holders (`rules` and `discounts`) observed mid-swap: new rules with old discounts
**Cause:** two independent references cannot swap atomically together
**Fix:** one snapshot object holding both (`record Pricing(Rules r, Discounts d)`) — widen the snapshot until every invariant lives inside one reference

## Interview questions

**★ Walk me through a config hot-reload design with zero reader locking.**
Immutable `Config` (record, `Map.copyOf` in the ctor) behind one
`volatile` reference. Readers snapshot once per operation and work from
the local. The reload thread builds a complete new `Config` and assigns.
Volatile write→read publishes; §17.5 covers the object; readers see old
or new, never a mixture — and never block.

**★ Why must the function passed to `AtomicReference.updateAndGet` be pure?**
On CAS failure the whole function re-runs against the fresh value —
that's the retry loop. Side effects would replay once per interference.
Pure transform in the lambda; effects after, on the returned result.

**★ When does copy-on-write stop being the right answer?**
When writes stop being rare or the structure stops being small: each
mutation copies everything, so cost scales with size × write rate. The
crossover signal is allocation/latency attributable to copying — then
move to a concurrent collection or a lock, keeping *values* immutable.

**★ Reader code holds `config.get()` twice in one request and the values disagree. Bug or expected?**
Expected under snapshot-swap — a reload landed between reads. The bug is
in the reader: one snapshot per unit of work is the pattern's contract.
If a *single* consistent view across the whole request is required,
capture the snapshot at request entry and thread it through.

**★ How do you atomically update two pieces of related immutable state?**
You don't — two references can't swap as one. Merge them into one
snapshot type and swap the single reference; the invariant "these two
match" becomes unrepresentable to violate. (The general form: widen the
atom until the invariant is inside it.)

**★ Is `StringBuilder` → `String` a concurrency pattern?**
Yes — it's builder-then-freeze: unsynchronized mutable accumulation
confined to one thread, then an immutable result that may be shared
freely. Recognizing it as such tells you what's safe: the builder must
never escape; the string always is.

---

← Prev: [Boundaries, copies and "effectively immutable"](02-boundaries-and-effective-immutability.md) · Index: [Immutability as the first strategy](README.md) · Next → [Coordination primitives](../16-coordination-primitives.md)
