---
title: "What it buys: threads, keys and records"
sidebar_label: "2 · What it buys · records"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §17.5 (final field
> semantics — the freeze at end of construction), JEP 395 (records), the
> JDK 25 Javadoc for `java.lang.Record`, and Effective Java 3rd ed.
> Item 17 where cited.

**The payoff for the recipe's discipline is that whole categories of
questions stop existing. "Is this thread-safe?" — nothing changes, so yes.
"Can I use it as a map key?" — its hash can never drift, so yes. "Who else
holds a reference?" — doesn't matter. And since Java 16, `record` writes
most of the recipe for you — while quietly leaving the two hardest parts
on your desk.**

## Free thread-safety

No state changes → no races, no locks, no `synchronized`, no visibility
puzzles. *"Immutable objects are always thread-safe"* — Effective Java
Item 17. This is not an optimization of locking; it is the *absence of the
problem* locking solves. Phase 6 builds its whole first strategy on this:
before `synchronized`, before `ConcurrentHashMap`, the first question is
"can this simply not mutate?"

## The final-field guarantee (JLS §17.5)

The Java Memory Model gives `final` fields a promise plain fields never
get: **if the object is not leaked during construction, any thread that
later obtains a reference sees the final fields fully initialized — even
when the object was handed over without any synchronization.**
Conceptually, a *freeze* happens at the end of the constructor; a reader
that got the reference after the freeze cannot observe the pre-freeze
state.

```java
// Thread A                            // Thread B
shared = new Money(amount, EUR);       Money m = shared;      // no lock, no volatile
                                       m.amount();            // GUARANTEED initialized
```

With non-final fields that hand-off is a data race: B could legally see
`shared` non-null but `amount` still null. With final fields it is safe —
*provided* `this` never escaped the constructor, which is why chunk 1's
leaked-`this` rule is part of the recipe and not a style preference.
[Phase 6 — Concurrency](../../phase-6-concurrency/README.md) owns the deep version (safe
publication, happens-before, and what "leaked" means precisely).

## Safe hash keys

`HashMap`/`HashSet` file entries by hash at insertion; mutate a key
afterwards and the entry is still filed under the old hash — present but
unfindable, no exception, no warning. Immutable keys make the bug
impossible by construction — see
[`equals` and `hashCode`](../06-equals-hashcode/README.md) for the
mutated-key walkthrough. The same argument covers caches keyed on request
objects and sets used for dedup: any key type that can mutate is a
corruption waiting for a code path that mutates it.

## Free sharing and caching

No aliasing bugs: any number of owners can hold the same instance; "who
else has a reference?" stops being a question. Consequences that
compound:

- **No defensive copies at trust boundaries.** Mutable designs pay a copy
  at every API edge "just in case"; immutable values cross for free. This
  claws back much of the allocation cost chunk 3 accounts for.
- **Instance caching becomes legal.** `Integer.valueOf`'s cache,
  `Boolean.TRUE`, your own interned `Currency` table — only possible
  because sharing an instance can never leak state changes between
  holders.
- **Snapshots are references.** "The config as of this request" is just —
  the reference you already have. Nobody can change it under you.

## Records: the recipe as a language feature

A `record` gives you parts 2, 3 and 5's foundations in one line — final
class, private final fields, accessors, `equals`/`hashCode`/`toString`:

```java
public record Order(OrderId id, List<Item> items) {
    public Order {                              // compact constructor
        Objects.requireNonNull(id);
        items = List.copyOf(items);             // STILL your job — part 4!
    }
    public Order withItems(List<Item> newItems) { return new Order(id, newItems); }
}
```

Scorecard against the recipe:

| Recipe part | Record gives it? |
|---|---|
| 1 · closed class | ✅ records are implicitly `final` |
| 2 · private final fields | ✅ |
| 3 · no mutators | ✅ (accessors only) |
| 4 · defensive copies | ❌ **yours** — compact constructor `copyOf`, accessor overrides for arrays |
| 5 · functional updates | ❌ **yours** — write `withX` methods (no built-in wither syntax in JDK 25) |

**Records are *shallowly* immutable.** The component references are final;
whatever they point to is whatever it is. A `record Holder(List<String> xs)`
without the compact-constructor `copyOf` is a mutable-in-practice object
with an immutable badge — worse than an honest mutable class, because
readers trust the badge. The defensive-copy discipline transfers
unchanged; [Records](../08-records/README.md) covers the rest of the
feature.

Records also inherit the §17.5 guarantee the same way any final-field
class does — a record safely published without synchronization reads
correctly — with the same leaked-`this` caveat in the compact constructor.

## Gotchas

**Symptom:** a record's "value" changed after construction
**Cause:** records are shallowly immutable — a mutable component (list, array, `Date`) was stored raw
**Fix:** compact constructor: `items = List.copyOf(items)`; arrays and legacy date types converted or cloned

**Symptom:** an immutable used as a `HashMap` key still "disappeared"
**Cause:** the class was only *believed* immutable — a mutable component leaked in or out and a mutation changed `hashCode` after insertion
**Fix:** apply the full recipe; the mutated-key mechanics live in [`equals`/`hashCode`](../06-equals-hashcode/README.md)

**Symptom:** another thread occasionally reads a default/zero field from an object that was "definitely constructed"
**Cause:** the fields aren't `final` and publication wasn't synchronized — the §17.5 guarantee only covers final fields
**Fix:** make the fields final (usually free in an immutable design); where a field genuinely can't be, publish via a proper hand-off (volatile, lock, queue — Phase 6 territory)

**Symptom:** final fields, but a reader still saw a half-built object
**Cause:** `this` escaped during construction (listener, thread start, overridable call) — escape voids the freeze guarantee for that publication
**Fix:** construct fully, then publish from a factory method; nothing with side effects inside the constructor

**Symptom:** record with an array component — `equals` is broken and the array mutates
**Cause:** records compare components with `equals`, which for arrays is identity; and the accessor hands out the raw array
**Fix:** arrays don't belong in records — use `List.copyOf` and a `List` component; if the array must stay, override `equals`/`hashCode` and clone in both the compact constructor and the accessor

**Symptom:** two "identical" records aren't equal
**Cause:** a component type with identity `equals` (an array, or a class that never overrode `equals`) — record equality is only as good as its components'
**Fix:** components should be values: records, `String`, boxed primitives, immutable collections

## Interview questions

**★ Why are immutable objects automatically thread-safe, and what extra guarantee do final fields give?**
No thread can observe or cause a state change, so there is nothing to race
on and nothing to lock. Additionally JLS §17.5: if `this` doesn't escape
construction, every thread that gets a reference later sees final fields
correctly initialized even when the object was published without
synchronization — a guarantee plain fields do not have.

**★ Are records immutable?**
Shallowly, by construction: final class, final fields, no setters. Deep
immutability is still your job — mutable components must be defensively
copied in the compact constructor, or the record is mutable in practice.
Functional updates (`withX`) are also still hand-written in JDK 25.

**★ Why must map keys be immutable?**
Hash containers file the entry under the key's hash *at insertion*.
Mutating the key afterwards changes its hash but not its filing — the
entry is still in the old bucket, unreachable by lookup, invisible to
`contains`. Immutability removes the failure mode rather than mitigating
it.

**★ What exactly does the JMM freeze at the end of a constructor?**
The values of `final` fields (and, transitively, the state reachable
through them at freeze time). A thread that obtains the reference after
construction — through any channel, synchronized or not — is guaranteed to
see those final fields initialized. The guarantee is conditional on `this`
not escaping before the constructor returns.

**How do you "modify" an immutable object, and what does it cost?**
Functional updates: `withX`/`plus` methods returning new instances
(records pair naturally with this). Cost is young-generation allocation —
cheap under generational GC — offset by never needing defensive copies at
trust boundaries and never taking locks. Chunk 3 does the full accounting.

**Why is a record holding a bare `List` "worse than an honest mutable class"?**
Because the type communicates a guarantee it doesn't keep. Readers skip
the defensive copies, share it across threads, and key maps on it — all
justified by the record badge — and each of those is now a latent bug. An
honest mutable class at least announces the danger.

---

← Prev: [The recipe and defensive copies](01-the-recipe-and-defensive-copies.md) · Index: [Designing immutable classes](README.md) · Next → [Builders, laziness and cost honesty](03-builders-laziness-and-cost.md)
