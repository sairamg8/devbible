---
title: "Factories, builders and safe construction"
sidebar_label: "3 · Factories, builders, safety"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation
> (`Integer.valueOf`, `List.of`, `HttpRequest.newBuilder`), *Effective Java*
> 3rd ed. items 1–2, and the JLS SE 25 §17.5 (final field semantics) for the
> safe-publication claim.

**Constructors are the mechanism; they are not always the API. A `static`
factory gives the entry point a name, a cache, and the right to return a
subtype; a builder gives many-optional construction named parameters and a
single validated finish. And whatever the entry point, one rule guards them
all: the object must not become visible to anyone before its constructor
returns.**

## Static factory methods — the constructor idiom that scales

Constructors have fixed names and always allocate. A `static` factory method
can do better on all axes:

```java
public static Money zero(Currency c)           { return new Money(BigDecimal.ZERO, c); }
public static Money ofUnits(String amt, Currency c) { return new Money(amt, c); }
public static Money ofMinor(long cents, Currency c) {
    return new Money(BigDecimal.valueOf(cents, c.getDefaultFractionDigits()), c);
}
```

- **A name** — `Money.zero(EUR)` reads; `new Money(BigDecimal.ZERO, EUR)`
  doesn't. Two factories can take identical parameter types where two
  constructors could not overload — `ofUnits` vs `ofMinor` above is exactly
  the case constructors cannot express.
- **Caching** — `Integer.valueOf` returns pooled instances
  ([autoboxing](../../phase-1-language-core/02-autoboxing-integer-cache/README.md));
  `List.of()` returns a shared empty list. A constructor *must* allocate;
  a factory may not.
- **Subtype returns** — the declared return type can hide the concrete class
  (`Collections.unmodifiableList` returns an unnamed implementation;
  `List.of` picks a different class by arity). Callers couple to the
  interface, leaving the implementation free to change.
- **A place for logic before delegation** — parsing, normalization, choosing
  which canonical constructor to call.

The costs: factories don't appear in "constructors" documentation sections
(mitigated by the convention names — `of`, `from`, `valueOf`, `getInstance`,
`create`, `newBuilder` — use them because the ecosystem reads them), and a
class exposing only factories with private constructors cannot be
subclassed — often the point, occasionally the obstacle.

## The builder — many optionals, named and validated

Where [chunk 2's telescoping ladder](02-constructors-and-chaining.md) ends,
the builder starts: a mutable staging object with named setters, finished by
one `build()` that funnels into the canonical constructor:

```java
Order order = Order.builder()
    .customer(customerId)           // required — build() enforces it
    .placedAt(clock.instant())
    .note("gift wrap")              // optional, named, any order
    .build();                       // validation + construction, once

public static final class Builder {
    private CustomerId customer;
    private Instant placedAt;
    private String note;

    public Builder customer(CustomerId c) { this.customer = c; return this; }
    public Builder placedAt(Instant t)    { this.placedAt = t; return this; }
    public Builder note(String n)         { this.note = n; return this; }

    public Order build() {                // all invariants, one gate
        return new Order(
            Objects.requireNonNull(customer, "customer"),
            placedAt != null ? placedAt : Instant.now(),
            note);
    }
}
```

The trade is explicit: ~1 line of builder plumbing per field (or a Lombok
`@Builder` / IDE generation) buys named arguments, order independence,
defaults in one place, and an immutable product. The builder itself is
mutable and **not** thread-safe — it is scaffolding, used once, on one
thread, then dropped. The pattern is everywhere in the platform:
`HttpRequest.newBuilder()...build()`, `Stream.Builder`,
`ProcessBuilder`. For pure data carriers, weigh a
[record](../08-records/README.md) with a compact constructor first — a
builder earns its plumbing when optionals outnumber required fields, not
before.

## Don't let `this` escape the constructor

Passing `this` out of a constructor — registering with a listener, storing
into a static map, starting a thread from the constructor body — publishes a
**partially constructed object**:

```java
class Auditor {
    Auditor(EventBus bus) {
        bus.register(this);        // BUG: bus may invoke callbacks NOW,
        this.filter = loadFilter(); // before filter is assigned
    }
}
```

Two distinct hazards stack:

- **Sequencing** — the callee (or any thread the bus hands `this` to) can
  invoke methods that read fields still at their defaults. Same class of
  bug as the parent-constructor-calls-override problem in
  [inheritance](../03-inheritance/README.md), self-inflicted.
- **Memory model** — `final` fields carry a safe-publication guarantee
  (JLS §17.5): any thread that sees the object *after construction
  completes* sees the final fields' values with no synchronization. Leak
  `this` early and that guarantee is void — another thread can observe
  `null` in a `final` field, permanently confusing.

Hidden leaks count: an inner-class listener created in the constructor
captures the enclosing `this`
([nested classes](../11-nested-classes.md)); so does calling an overridable
method that a subclass uses to stash `this` somewhere. The rule: **a
constructor initializes, and nothing else.** Registration, thread starts,
and callbacks belong in a factory method that completes construction first:

```java
static Auditor create(EventBus bus) {
    Auditor a = new Auditor(bus);   // fully constructed
    bus.register(a);                // then published
    return a;
}
```

— which is one more argument for factories: they give "construct, then
publish" a place to live.

## Gotchas

**Symptom:** two factory methods with the same parameter types compile fine, though the "same" constructors would not
**Cause:** nothing wrong — factories are ordinary methods distinguished by name; this is the feature
**Fix:** use it deliberately: `ofUnits`/`ofMinor`, `parse`/`of` — names carry the semantic the type system can't

**Symptom:** `assertSame` fails across `Integer.valueOf(1000)` calls but passes at 100
**Cause:** factory caching is an implementation policy, not a contract — `valueOf` pools only a small range
**Fix:** never rely on factory-returned identity; compare with `equals` ([autoboxing](../../phase-1-language-core/02-autoboxing-integer-cache/README.md))

**Symptom:** class with only static factories can't be extended by a test double
**Cause:** private constructors block subclassing — the flip side of controlling construction
**Fix:** extract an interface for the contract and let the factory return it; test doubles implement the interface

**Symptom:** builder reused for a second object carries the first object's optional values
**Cause:** builders are mutable staging state; nothing resets them after `build()`
**Fix:** one builder per object built — fresh `builder()` call each time; don't cache builders

**Symptom:** listener callback observes a half-initialized object; a `final` field reads `null` on another thread
**Cause:** `this` escaped during construction (direct registration, thread start, or inner-class capture) — sequencing and the JLS §17.5 final-field guarantee both broken
**Fix:** constructors only initialize; publish from a static factory after the constructor returns

**Symptom:** `build()` succeeds but the object fails later with a missing required field
**Cause:** builder validated nothing — every field defaulted silently
**Fix:** `build()` (or the canonical constructor it calls) enforces required fields with `requireNonNull` and messages naming the field

**Symptom:** simple 3-field DTO grew 40 lines of builder plumbing
**Cause:** builder applied by habit where a record's canonical constructor already fit
**Fix:** records with compact constructors for small carriers; builders where optionals dominate

## Interview questions

**★ Why prefer a static factory method over a constructor?**
Names that document intent, same-signature alternatives, instance caching
(`valueOf`), returning subtypes or interfaces, and a natural place for
construct-then-publish. Constructors win where subclassing or framework
conventions require them.

**★ What problem does the builder pattern solve, and what does it cost?**
Many-optional construction without telescoping overloads: named,
order-independent setters, defaults centralized, one validated `build()`.
Cost: per-field plumbing and a mutable, non-thread-safe staging object —
overkill for small all-required carriers, where records fit better.

**★ Why is letting `this` escape a constructor a memory-model bug and not just a sequencing bug?**
Beyond callbacks reading default values, `final` fields' safe-publication
guarantee (JLS §17.5) only covers objects published *after* construction
completes. Early publication lets other threads see `final` fields
unset — breaking the one guarantee immutable objects rely on for free
thread-safety ([immutable design](../12-immutable-design/README.md)).

**★ Where does construct-then-publish belong if not in the constructor?**
In a static factory: construct fully, then register/start/publish the
completed instance. It keeps the constructor side-effect-free and gives the
publication a single audited location.

**Name the factory-method naming conventions and what each signals.**
`of` (aggregation of arguments), `from`/`valueOf` (conversion), `parse`
(from text), `getInstance` (possibly shared), `create`/`newInstance`
(always fresh), `newBuilder`/`builder` (starts a builder). Following them is
API documentation for free.

**Why can `List.of` return different classes for different arities without breaking callers?**
Callers hold the `List` interface; the factory's right to choose the
concrete type is exactly the flexibility constructors lack. Optimized
small-arity implementations are an invisible implementation detail.

**A constructor starts a background thread with a method reference to an instance method. Safe?**
No — the thread captures `this` before construction finishes: it can run
against default-valued fields and voids the final-field guarantee. Start
threads from a factory or lifecycle hook after construction.

---

← Prev: [Constructors and chaining](02-constructors-and-chaining.md) · Index: [Class anatomy](README.md) · Next → [Encapsulation and access modifiers](../02-encapsulation-access/README.md)
