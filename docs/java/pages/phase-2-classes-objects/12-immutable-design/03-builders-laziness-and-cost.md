---
title: "Builders, laziness and cost honesty"
sidebar_label: "3 · Builders · laziness · cost"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `StringBuilder` and
> `String.hashCode`, the JLS SE 25 §17.5 (benign-race reasoning on
> non-final fields), and Effective Java 3rd ed. Items 2 and 83 where
> cited.

**Three practical problems arrive the week a team commits to immutability:
constructors with nine parameters, a derived value too expensive to
compute eagerly, and someone's benchmark of a hot loop. Each has a
standard answer — the builder, the racy single-check idiom, and confined
local mutability — and each answer works by the same trick: mutability
kept *private and temporary*, immutability kept as the public contract.**

## Many fields: the builder, in full

Immutables with many optional fields get unreadable constructors
(`new Order(id, null, null, items, false, null, "gift wrap")`). The
builder is mutable while assembling, immutable at `build()`:

```java
public final class Order {
    private final OrderId id;                 // required
    private final List<Item> items;           // required
    private final String note;                // optional
    private final boolean giftWrap;           // optional

    private Order(Builder b) {                // private: Builder is the only door
        this.id = b.id;
        this.items = List.copyOf(b.items);    // defensive copy still happens HERE
        this.note = b.note;
        this.giftWrap = b.giftWrap;
    }

    public static Builder builder(OrderId id) {         // required fields up front
        return new Builder(id);
    }

    public static final class Builder {
        private final OrderId id;
        private final List<Item> items = new ArrayList<>();
        private String note = "";
        private boolean giftWrap = false;

        private Builder(OrderId id) { this.id = Objects.requireNonNull(id); }

        public Builder item(Item i)      { items.add(Objects.requireNonNull(i)); return this; }
        public Builder note(String n)    { this.note = Objects.requireNonNull(n); return this; }
        public Builder giftWrap()        { this.giftWrap = true; return this; }

        public Order build() {
            if (items.isEmpty()) throw new IllegalStateException("order needs items");
            return new Order(this);           // validation once, then frozen
        }
    }
}

Order order = Order.builder(id)
    .item(item1).item(item2)
    .note("gift wrap")
    .build();
```

The load-bearing details: the target's constructor is `private` (the
builder is the only construction path), required fields ride the
`builder(...)` factory so they can't be forgotten, cross-field validation
runs once in `build()`, and the defensive copy still happens in the
*target's* constructor — the builder is caller-side mutable state like any
other. The builder itself is the *only* mutable actor, confined to one
thread and one stack frame. (Records reduced how often you need this;
Lombok's `@Builder` generates the same shape.)

A builder is **not** thread-safe and is not meant to be: one builder, one
thread, one `build()`. Reusing a builder after `build()` is legal in this
shape (the copy in the constructor protects the built object) but usually
a smell — each assembly wants its own builder.

## Lazy fields inside immutable classes

A derived value too expensive to compute in the constructor can be
computed on first use — *without* locks — via the **racy single-check
idiom**, and the honesty about why it works matters:

```java
public final class Manifest {
    private final List<Entry> entries;        // the real state: final, frozen
    private int hash;                         // NOT final — lazily derived, 0 = "not yet"

    @Override public int hashCode() {
        int h = hash;
        if (h == 0) {                         // maybe recompute
            h = entries.hashCode();
            hash = h;                         // benign race: any writer writes the same value
        }
        return h;
    }
}
```

Why this is correct despite the data race: the computation is
**deterministic from final state**, so every thread that races computes
the *same* value; the field is a single 32-bit write (atomic); and readers
either see 0 (recompute, same answer) or the cached value. The cost of
the race is occasional duplicated work, never a wrong answer.
`String.hashCode` uses exactly this idiom. The honest caveats:

- It only works for **idempotent, side-effect-free** derivations from
  final fields. A lazily-created mutable object (a `List`, a connection)
  needs real synchronization — that is Phase 6's `volatile` double-check
  territory, not this idiom.
- The sentinel must be unreachable or harmless. `String` accepts
  recomputing for the rare value that genuinely hashes to 0; if that
  bothers you, add a `boolean hashComputed` — but then *two* fields race
  and the idiom needs the boolean written last… at which point use the
  Phase 6 tools. Keep this idiom to the single-word case.
- The object is still observably immutable — laziness is an internal
  performance detail, invisible in the API.

## Cost honesty

Updates allocate: a `withX` per change, a new list per addition. Three
things keep this from being the problem it sounds like:

- Short-lived objects are what the JVM's
  [generational GC](../../phase-0-platform-jvm/08-garbage-collection.md) is
  optimized for — allocation is a pointer bump, and young garbage is
  cheap to collect.
- Sharing without copying is a *saving* mutable designs don't get:
  mutable objects get defensively copied at every trust boundary "just in
  case", often more copies than the immutable design's updates.
- Where a hot loop genuinely needs in-place mutation (building a large
  string, accumulating a big collection), confine a mutable accumulator
  locally and expose the immutable result — mutability as an
  implementation detail, not an API property:

```java
public static Report summarize(List<Event> events) {
    StringBuilder sb = new StringBuilder();       // mutable, local, invisible
    Map<String, Integer> counts = new HashMap<>();
    for (Event e : events) { /* accumulate */ }
    return new Report(sb.toString(), Map.copyOf(counts));   // frozen at the boundary
}
```

The honest limit: enormous frequently-"modified" structures (a
million-entry map updated per event) need persistent data structures —
tries with structural sharing — which Java's standard library does not
provide. That is where the pattern stops without third-party help, and
where the design answer becomes "mutable core, immutable snapshots at the
boundary".

## When immutability is the wrong choice

- **Identity-centric stateful things**: entities mid-transaction,
  builders, accumulators, connections — objects whose *point* is a
  lifecycle.
- **High-frequency small updates to large structures** where rebuilds
  dominate and structural sharing isn't available.
- **Frameworks that demand no-arg constructors and setters** (older JPA,
  some serializers): fighting the framework costs more than the
  guarantee is worth at that boundary — keep the domain core immutable
  and let the mapping layer be the compromise.

## Gotchas

**Symptom:** "we made everything immutable and now a hot path is allocation-heavy"
**Cause:** a large structure is being rebuilt wholesale on every small update
**Fix:** confine a mutable accumulator locally (builder, `StringBuilder`, plain `ArrayList`) and freeze at the boundary — immutability is an API property, not a rule against local mutation

**Symptom:** builder shared between threads produces interleaved, corrupt objects
**Cause:** builders are deliberately mutable and unsynchronized — one builder per assembly, per thread
**Fix:** never share a builder; the immutable *product* is what crosses threads

**Symptom:** required field missing at runtime although "the builder validates"
**Cause:** required fields were settable methods like the optional ones, and a call path skipped one
**Fix:** required fields ride the `builder(...)` factory's parameters; `build()` cross-validates the rest — make illegal states unrepresentable in the builder's own API

**Symptom:** lazily-cached field occasionally computed twice under load
**Cause:** the racy single-check idiom permits duplicated work by design
**Fix:** expected and harmless for cheap idempotent derivations; if the computation is expensive enough to protect, that's Phase 6's double-checked locking with `volatile`, not this idiom

**Symptom:** racy single-check used for a lazily-built `List` — a reader saw a half-filled list
**Cause:** the idiom is only safe for single-word writes of values derived from final state; a mutable object under construction is neither
**Fix:** either build eagerly in the constructor, or use proper safe publication (`volatile` double-check) — the benign race is benign only for immutable results

**Symptom:** two structurally-equal instances, but a `withX` chain produced surprising extra allocations in a profile
**Cause:** each `withX` copies the whole object; chains of five updates copy five times
**Fix:** for multi-field updates provide a `toBuilder()` (one builder, one final copy), or accept it — measure before optimizing; young-gen allocation is rarely the real bottleneck

**Symptom:** JPA entity made immutable; the framework fails to hydrate it
**Cause:** the mapping layer requires no-arg construction and field/setter injection
**Fix:** keep the persistence model as the framework wants it, map to an immutable domain type at the repository boundary — don't contort the domain to the ORM or the ORM to the domain

## Interview questions

**★ Show the builder pattern for an immutable class and name the load-bearing details.**
Static nested `Builder`, target constructor private and taking the
builder, required fields on the `builder(...)` factory, fluent setters
returning `this`, cross-field validation once in `build()`, defensive
copies in the target's constructor. The builder is the only mutable
actor, confined to one thread and one stack frame.

**★ How can an immutable class have a lazily computed field?**
The racy single-check idiom: a non-final cache field with a sentinel,
recomputed by any thread that sees the sentinel. Correct because the
derivation is deterministic from final state (every racer writes the same
value) and the write is a single atomic word — `String.hashCode` is the
canonical user. Only for idempotent single-word results; anything else
needs real safe publication.

**★ When is immutability the wrong choice?**
Large structures with high-frequency small updates where rebuilds
dominate (absent persistent collections), identity-centric stateful
things (entities mid-transaction, builders, accumulators), and boundaries
where a framework demands mutability — there, keep a mutable core or
mapping layer and expose immutable snapshots.

**★ "Immutability is slow because of all the copies." Give the honest three-part answer.**
(1) The copies are young-generation allocations — pointer-bump cheap and
collected cheaply. (2) Mutable designs pay their own copy tax: defensive
copies at every trust boundary, often exceeding the update copies.
(3) Where a hot path really is allocation-bound, confine local mutation
and freeze at the boundary — the API stays immutable, the loop doesn't.
What this answer does *not* include: invented benchmark numbers.

**Why does a `withX` chain want a `toBuilder()`?**
Each `withX` rebuilds the whole object, so N chained updates copy N
times. `toBuilder()` reopens a builder seeded with current state: N
mutations on the builder, one final immutable copy. Same contract, one
allocation.

**Your team wants lazy init of a database connection inside an "immutable" service object. What do you say?**
That's not the racy single-check case: a connection is mutable, stateful
and side-effecting, so the benign-race argument collapses. Either the
field isn't part of the immutable value (hold a supplier/pool reference —
itself immutable — and fetch per use), or the object isn't immutable and
should say so. Don't launder stateful laziness through the idiom.

---

← Prev: [What it buys — threads, keys, records](02-what-it-buys-threads-keys-records.md) · Index: [Designing immutable classes](README.md)
