---
title: "Designing immutable classes"
sidebar_label: "12 · Immutable design"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §17.5 (final field semantics), the
> JDK 25 Javadoc for `List.copyOf`/`Map.copyOf` and
> `Collections.unmodifiableList`, JEP 395 (records), and Effective Java
> 3rd ed. Items 17 and 50 where cited.

**An immutable object cannot change after construction — which means it can
be shared between threads, used as a map key, cached, and aliased freely,
with an entire class of bugs gone by construction. But immutability is a
*whole-object property that must be engineered*, not a keyword: `final` on a
field stops reassignment, not mutation of what it points to. The recipe has
five parts, and skipping any one of them silently produces a mutable class
that everyone treats as immutable — the worst of both worlds.**

## The recipe, all five parts

```java
public final class Money {                       // 1. no subclasses
    private final BigDecimal amount;             // 2. all fields private final
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = Objects.requireNonNull(amount).setScale(2, RoundingMode.HALF_EVEN);
        this.currency = Objects.requireNonNull(currency);
    }                                            // 3. no setters, no mutators

    public BigDecimal amount()   { return amount; }     // BigDecimal is itself immutable —
    public Currency currency()   { return currency; }   // safe to hand out directly

    public Money plus(Money other) {             // 5. updates return new objects
        requireSameCurrency(other);
        return new Money(amount.add(other.amount), currency);
    }
    // equals/hashCode/toString elided
}
```

1. **Close the class to subclassing** — `final` class (or all constructors
   private with static factories). A mutable subclass would be usable
   anywhere the "immutable" type is expected, breaking every guarantee.
2. **All fields `private final`.** `final` gives single assignment *and* the
   memory-model guarantee below.
3. **No mutators** — no setters, and no methods that change state in place.
4. **Exclusive access to mutable components** — the defensive-copy rules in
   the next section. This is the part everyone forgets.
5. **Functional updates**: `withStatus(...)`, `plus(...)` return new
   instances. Immutable does not mean unchangeable *data* — it means change
   produces a new value.

## Part 4 in full: defensive copies, in and out

`final` protects the *reference*. If the referenced object is mutable — a
`List`, an array, a `Date` — the class is only immutable if no outsider can
reach that mutable object.

**Copy IN (constructor).** Never store a caller's mutable object directly;
the caller still holds a reference and can mutate "your" state later:

```java
public Order(List<Item> items) {
    this.items = List.copyOf(items);    // copies AND is unmodifiable
}
```

- `List.copyOf`/`Map.copyOf`/`Set.copyOf` are the modern one-liners — and
  they are smart: **if the argument is already an unmodifiable copy, they
  return it as-is** (no re-copy cost on the immutable-to-immutable path).
- Arrays must be cloned (`values.clone()`) — there is no immutable array.
- Legacy `Date`/`Calendar` fields: convert to `Instant`/`LocalDate` at the
  boundary instead of cloning forever.
- Copy **before** validating, and validate the copy — otherwise a racing
  caller can mutate between your check and your store (TOCTOU).

**Copy OUT (accessors).** Returning the internal mutable object hands every
caller a mutation handle:

```java
public List<Item> items() { return items; }          // safe ONLY because items is List.copyOf'd
public int[] histogram() { return counts.clone(); }  // arrays: clone on the way out
```

If the field was stored via `copyOf`, returning it directly is safe — it is
already unmodifiable. `Collections.unmodifiableList(list)` is the *view*
alternative: no copy, but it reflects later changes to the backing list, so
it only makes an immutable class if the backing list itself never escapes or
changes. Prefer the `copyOf` store; it makes every accessor trivially safe.

**Don't leak `this` during construction.** Registering `this` with a
listener registry, starting a thread from the constructor, or calling an
overridable method before the constructor finishes publishes a
half-initialized object — and forfeits the final-field guarantee below.

## What immutability buys

- **Free thread-safety.** No state changes → no races, no locks, no
  `synchronized`, no visibility puzzles. *"Immutable objects are always
  thread-safe"* — Effective Java Item 17. Phase 6 builds its whole first
  strategy on this.
- **The JMM final-field guarantee** (JLS §17.5): if the object is not leaked
  during construction, *any* thread that later obtains a reference sees the
  final fields fully initialized — even without synchronization on the
  hand-off. Mutable objects get no such promise. **Phase 6 — Concurrency**
  *(not written yet)* owns the deep version.
- **Safe hash keys.** `HashMap`/`HashSet` file entries by hash at insertion;
  mutate a key afterwards and the entry is still filed under the old hash —
  present but unfindable. Immutable keys make the bug impossible — see
  **topic 06 · `equals`/`hashCode`** *(not written yet)* for the mutated-key
  walkthrough.
- **Free sharing and caching.** No aliasing bugs: any number of owners can
  hold the same instance; "who else has a reference?" stops being a
  question. Copies are never needed, which claws back much of the
  allocation cost.

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

**Records are *shallowly* immutable.** The component references are final;
whatever they point to is whatever it is. A `record Holder(List<String> xs)`
without the compact-constructor `copyOf` is a mutable-in-practice object
with an immutable badge. The defensive-copy discipline transfers unchanged.

## Many fields: the builder

Immutables with many optional fields get unreadable constructors. The
standard answer is a builder — mutable while assembling, immutable at
`build()`:

```java
Order order = Order.builder()
    .id(id)
    .item(item1).item(item2)
    .note("gift wrap")
    .build();
```

The builder is the *only* mutable actor, confined to one thread and one
stack frame; `build()` runs validation once and hands out the frozen result.
(Records reduced how often you need this; Lombok's `@Builder` and manual
static nested builders are the common implementations.)

## Cost honesty

Updates allocate: a `withX` per change, a new list per addition. Three
things keep this from being the problem it sounds like:

- Short-lived objects are what the JVM's
  [generational GC](../phase-0-platform-jvm/08-garbage-collection.md) is
  optimized for — allocation is a pointer bump, and young garbage is cheap.
- Sharing without copying is a *saving* mutable designs don't get: mutable
  objects get defensively copied at every trust boundary "just in case".
- Where a hot loop genuinely needs in-place mutation (building a large
  string, accumulating a big collection), confine a mutable accumulator
  locally and expose the immutable result — mutability as an
  implementation detail, not an API property.

The honest limit: enormous frequently-"modified" structures (a million-entry
map updated per event) need persistent data structures Java's stdlib doesn't
provide — that is where the pattern stops without third-party help.

## Gotchas

**Symptom:** a `final List<Item> items` field changed contents anyway
**Cause:** `final` prevents *reassignment of the reference*, not mutation of the list — anyone with the reference can `add`/`clear`
**Fix:** store `List.copyOf(items)`; `final` + unmodifiable copy together give real immutability

**Symptom:** class stores the constructor's list without copying; a "constant" object's state changed weeks later in production
**Cause:** the caller kept its reference and mutated it — the object and the caller share one list
**Fix:** copy IN: `this.items = List.copyOf(items)` — and validate after copying, not before (TOCTOU)

**Symptom:** accessor returns the internal collection; a caller sorts or clears it and corrupts the object
**Cause:** copy OUT was skipped — the getter handed out the mutation handle
**Fix:** store via `copyOf` (then returning it is safe), or return a copy/unmodifiable view; for arrays, `clone()` on the way out — an immutable array type does not exist

**Symptom:** `Collections.unmodifiableList` was used, but the "immutable" view's contents still changed
**Cause:** it is a *view*: it blocks mutation *through itself* while reflecting every change to the backing list someone else still holds
**Fix:** `List.copyOf` for an independent unmodifiable copy; reserve the view for intentionally-live read-only windows

**Symptom:** a record's "value" changed after construction
**Cause:** records are shallowly immutable — a mutable component (list, array, `Date`) was stored raw
**Fix:** compact constructor: `items = List.copyOf(items)`; arrays and legacy date types converted or cloned

**Symptom:** occasionally another thread sees a half-built object (null field that "cannot" be null)
**Cause:** `this` leaked during construction — listener registration, thread start, or an overridable call from the constructor — voiding the JLS §17.5 final-field guarantee
**Fix:** constructors only assign and validate; registration and thread-starting happen after construction (factory method wraps the two steps)

**Symptom:** an immutable used as a `HashMap` key still "disappeared"
**Cause:** the class was only *believed* immutable — a mutable component leaked in or out and a mutation changed `hashCode` after insertion
**Fix:** apply the full recipe; the mutated-key mechanics live in **topic 06 · `equals`/`hashCode`** *(not written yet)*

**Symptom:** "we made everything immutable and now a hot path is allocation-heavy"
**Cause:** a large structure is being rebuilt wholesale on every small update
**Fix:** confine a mutable accumulator locally (builder, `StringBuilder`, plain `ArrayList`) and freeze at the boundary — immutability is an API property, not a rule against local mutation

**Symptom:** subclass of an "immutable" class introduced setters and broke callers' assumptions
**Cause:** the class was left open — immutability is only guaranteed if the type can't be extended into mutability
**Fix:** `final` class, or private constructors + static factories (which also enable instance caching)

## Interview questions

**★ What are the rules for writing an immutable class?**
Final class (no subclassing), private final fields, no mutators, exclusive
access to mutable components — defensive copies in the constructor and in
accessors (`List.copyOf` in, copies or already-unmodifiable references out)
— and no `this` leak during construction. Updates return new instances.

**★ Does `final` make an object immutable?**
No. `final` on a field prevents reassignment only; the referenced object
remains as mutable as it ever was. A `final List` can be cleared by anyone
holding it. Immutability = `final` fields *plus* immutable or defensively
copied components *plus* a closed class.

**★ `List.copyOf` vs `Collections.unmodifiableList` — when does the difference matter?**
`copyOf` makes an independent unmodifiable copy (and cheaply returns
already-immutable inputs unchanged). `unmodifiableList` wraps a *view* over
the original: mutations through the view throw, but the backing list's
changes show through. For immutable-class fields, `copyOf`; the view is for
deliberately-live read-only exposure.

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

**How do you "modify" an immutable object, and what does it cost?**
Functional updates: `withX`/`plus` methods returning new instances (records
pair naturally with this). Cost is young-generation allocation — cheap under
generational GC — offset by never needing defensive copies at trust
boundaries and never taking locks. Hot loops confine a local mutable
accumulator and publish the frozen result.

**Why must you copy before validating in a constructor?**
The caller still holds the mutable argument. Validate-then-copy leaves a
window where a racing thread mutates *after* the check and *before* the
store — storing state that was never validated. Copy first; validate your
private copy.

**When is immutability the wrong choice?**
Large structures with high-frequency small updates where rebuilds dominate
(absent persistent collections), and identity-centric stateful things
(entities mid-transaction, builders, accumulators). The pattern there:
mutable core, immutable snapshots at the boundary.

---

← Prev: [Nested classes](11-nested-classes.md) · Next → [Composition over inheritance](13-composition-over-inheritance.md)
