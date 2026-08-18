---
title: "The recipe and defensive copies"
sidebar_label: "1 · The recipe"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `List.copyOf`,
> `Map.copyOf`, `Set.copyOf` and `Collections.unmodifiableList`, the JLS
> SE 25 §8.1.1.2 and §8.3.1.2 (`final` classes and fields), and Effective
> Java 3rd ed. Items 17 and 50 where cited.

**Five parts, and every one of them is load-bearing. `final` fields alone
give you a class whose *references* are frozen while the objects behind
them stay as mutable as ever; a missing defensive copy gives every caller
a mutation handle into "your" state. The recipe is short enough to
memorize and mechanical enough to review for — which is the point: a class
is immutable by checklist, not by vibes.**

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
   The static-factory variant additionally enables instance caching
   (`valueOf`-style) precisely *because* instances are shareable.
2. **All fields `private final`.** `final` gives single assignment *and*
   the memory-model guarantee chunk 2 explains.
3. **No mutators** — no setters, and no methods that change state in
   place.
4. **Exclusive access to mutable components** — the defensive-copy rules
   below. This is the part everyone forgets.
5. **Functional updates**: `withStatus(...)`, `plus(...)` return new
   instances. Immutable does not mean unchangeable *data* — it means
   change produces a new value.

## Part 4 in full: defensive copies, in and out

`final` protects the *reference*. If the referenced object is mutable — a
`List`, an array, a `Date` — the class is only immutable if no outsider
can reach that mutable object.

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
  Two edges worth knowing: they reject `null` elements
  (`NullPointerException`), and `Set.copyOf`/`Map.copyOf` make no ordering
  promise — a `LinkedHashSet`'s order is not preserved.
- Arrays must be cloned (`values.clone()`) — there is no immutable array
  type in Java, full stop.
- Legacy `Date`/`Calendar` fields: convert to `Instant`/`LocalDate` at the
  boundary instead of cloning forever.
- Copy **before** validating, and validate the copy — otherwise a racing
  caller can mutate between your check and your store (TOCTOU: a
  time-of-check-to-time-of-use hole inside your own constructor).

**Copy OUT (accessors).** Returning the internal mutable object hands
every caller a mutation handle:

```java
public List<Item> items() { return items; }          // safe ONLY because items is List.copyOf'd
public int[] histogram() { return counts.clone(); }  // arrays: clone on the way out
```

If the field was stored via `copyOf`, returning it directly is safe — it
is already unmodifiable. `Collections.unmodifiableList(list)` is the
*view* alternative: no copy, but it reflects later changes to the backing
list, so it only makes an immutable class if the backing list itself never
escapes or changes. Prefer the `copyOf` store; it makes every accessor
trivially safe and every later reviewer's job trivial.

The deep-vs-shallow question stops at the element type: `List.copyOf`
copies the *list*, not the items. If `Item` is itself mutable, callers can
still mutate items in place. Immutability composes downward — an
immutable class wants immutable components, recursively, until it bottoms
out in primitives, `String`, and value-like types.

## Don't leak `this` during construction

Registering `this` with a listener registry, starting a thread from the
constructor, or calling an overridable method before the constructor
finishes publishes a half-initialized object — and forfeits the
final-field guarantee (chunk 2). The rule: constructors assign and
validate, nothing else; registration and thread-starting live in a static
factory that completes construction first:

```java
public static Watcher start(Registry r) {
    Watcher w = new Watcher();     // fully constructed…
    r.register(w);                 // …then published
    return w;
}
```

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

**Symptom:** `List.copyOf` throws `NullPointerException` on data that "worked before"
**Cause:** the immutable collection factories reject `null` elements, unlike `ArrayList`
**Fix:** decide what `null` meant — usually a modelling gap; filter it, replace it with a sentinel/`Optional` at the source, or keep an explicit `Collections.unmodifiableList(new ArrayList<>(src))` if nulls are genuinely part of the contract

**Symptom:** subclass of an "immutable" class introduced setters and broke callers' assumptions
**Cause:** the class was left open — immutability is only guaranteed if the type can't be extended into mutability
**Fix:** `final` class, or private constructors + static factories (which also enable instance caching)

**Symptom:** object is "immutable" but its `Item` elements keep changing
**Cause:** shallow copy — `copyOf` froze the list, not the elements; immutability wasn't composed downward
**Fix:** make the component types immutable too (records help), or deep-copy at the boundary; document exactly how deep the guarantee goes

**Symptom:** occasionally another thread sees a half-built object (null field that "cannot" be null)
**Cause:** `this` leaked during construction — listener registration, thread start, or an overridable call from the constructor — voiding the final-field guarantee
**Fix:** constructors only assign and validate; registration and thread-starting happen after construction (factory method wraps the two steps)

## Interview questions

**★ What are the rules for writing an immutable class?**
Final class (no subclassing), private final fields, no mutators, exclusive
access to mutable components — defensive copies in the constructor and in
accessors (`List.copyOf` in, copies or already-unmodifiable references
out) — and no `this` leak during construction. Updates return new
instances.

**★ Does `final` make an object immutable?**
No. `final` on a field prevents reassignment only; the referenced object
remains as mutable as it ever was. A `final List` can be cleared by anyone
holding it. Immutability = `final` fields *plus* immutable or defensively
copied components *plus* a closed class.

**★ `List.copyOf` vs `Collections.unmodifiableList` — when does the difference matter?**
`copyOf` makes an independent unmodifiable copy (and cheaply returns
already-immutable inputs unchanged). `unmodifiableList` wraps a *view*
over the original: mutations through the view throw, but the backing
list's changes show through. For immutable-class fields, `copyOf`; the
view is for deliberately-live read-only exposure.

**★ Why must you copy before validating in a constructor?**
The caller still holds the mutable argument. Validate-then-copy leaves a
window where a racing thread mutates *after* the check and *before* the
store — storing state that was never validated. Copy first; validate your
private copy.

**How deep does `List.copyOf` make you immutable?**
One level: the list structure is frozen, the elements are whatever they
are. Real immutability composes downward — immutable elements (records,
`String`, value types) or deep copies at the boundary, with the depth of
the guarantee documented either way.

**Why do the `copyOf` factories reject `null`, and what do you do about it?**
The immutable collections were specified null-hostile deliberately —
`null` elements are almost always modelling errors, and rejecting them at
the copy boundary surfaces the bug at construction instead of at some
later lookup. Fix the source; treat a genuine need for nulls as a signal
the field wants a richer type.

---

← Index: [Designing immutable classes](README.md) · Next → [What it buys — threads, keys, records](02-what-it-buys-threads-keys-records.md)
