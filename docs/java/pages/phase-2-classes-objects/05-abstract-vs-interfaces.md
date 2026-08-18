---
title: "Abstract classes vs interfaces"
sidebar_label: "05 · Abstract vs interfaces"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §9 (interfaces), §9.4.1 and
> §8.4.8 (inheritance of default methods and the diamond rules), §8.1.1.1
> (abstract classes), and the JDK 25 API documentation (`Collection`,
> `Comparator` — default-method evolution examples).

**The choice is not stylistic. An abstract class shares *implementation and
state* down one single-inheritance channel; an interface shares *contract*
across unlimited implementors — and, since default methods, a limited slice
of behaviour too. The decision rule that survives contact with real code:
model "is-a with shared state" as an abstract class, "can-do capability" as
an interface — and when in doubt, interface, because it spends no
inheritance budget and couples to no representation.**

## What each construct actually provides

| | Abstract class | Interface |
|---|---|---|
| Instance state | ✅ fields, any access | ❌ — fields are implicitly `public static final` constants |
| Constructors | ✅ (run in every subclass construction) | ❌ |
| Method bodies | ✅ any | `default`, `static`, `private` methods only |
| Abstract methods | ✅ | ✅ (the norm) |
| Access levels on members | all four | `public` (or `private` for helper methods) |
| How many can a type take | **one** (`extends`) | unlimited (`implements`) |
| Couples subtypes to | implementation + state | contract only |

An abstract class may be a complete implementation missing one decision
(template method: `final` skeleton calling one `protected abstract` hook).
An interface is a capability from any inheritance line: `Comparable`,
`AutoCloseable`, your `PaymentProcessor` — implemented by classes that share
no ancestry.

```java
public abstract class BaseEntity {                    // is-a, shared state
    protected final Instant createdAt = Instant.now();
    public abstract EntityId id();
}

public interface Auditable {                          // can-do, any class
    AuditTrail trail();
    default boolean wasTouchedSince(Instant t) {      // behaviour on the contract
        return trail().lastModified().isAfter(t);
    }
}
```

## Default methods — why they exist, what they may do

`default` methods were added (Java 8) for **API evolution**: adding
`stream()` to `Collection` without breaking every implementation on Earth.
That origin sets their proper use — behaviour *derivable from the
interface's own methods*, never pseudo-state, and always overridable (a
`default` method cannot be `final`; implementors may replace it).

`static` interface methods hold factories and helpers
(`Comparator.comparing`); `private` interface methods (Java 9) share code
between defaults without publishing it. What interfaces still cannot do:
declare instance fields, define constructors, or provide `default`
implementations for `Object`'s methods — `equals`/`hashCode`/`toString`
cannot be defaulted (JLS §9.4.1.1), because identity semantics belong to
classes.

## The diamond, resolved by rule

With multiple interfaces, the same `default` signature can arrive twice. The
resolution rules are short and total:

1. **Classes win.** A method inherited from a class (or declared in the
   class) beats any interface default.
2. **The most specific interface wins.** If `TrackedShipment extends
   Shipment` and both declare a default `eta()`, `TrackedShipment`'s wins.
3. **Otherwise: compile error.** Two unrelated interfaces supply the same
   default — the class must override it itself, and may delegate explicitly:

```java
class DroneDelivery implements Ground, Air {
    @Override public Route plan() {
        return Air.super.plan();          // the disambiguation syntax
    }
}
```

`X.super.m()` is legal only for a *direct* superinterface `X`. Diamonds are
therefore never silent in Java — the ambiguous case refuses to compile,
which is the whole design.

## Choosing, with the tests that decide

- **Do subtypes need shared mutable/protected state or a common
  constructor?** Abstract class — that is the one thing interfaces cannot
  give.
- **Will unrelated classes need this capability?** Interface, necessarily —
  they don't share your base class.
- **Is this a public API others implement?** Interface first; you can add
  `default` methods later without breaking implementors, and callers can
  test against it trivially. (Adding an *abstract* method later breaks every
  implementor — evolution pressure pushes contracts toward interfaces plus
  defaults.)
- **Both?** The classic pairing: interface as the published contract, an
  abstract skeleton class as optional convenience
  (`AbstractList` under `List` is the JDK's own pattern).
- **Marker with no methods?** `Serializable`-style markers work
  (`instanceof`-checkable, participates in generics), but annotations are
  the modern tool unless the marker must appear in a type position.

**Sealed types changed the second half of this choice** (topic 09 *(not
written yet)*): `sealed interface PaymentResult permits Approved, Declined,
Failed` gives interfaces the closed-hierarchy control that used to require
abstract classes plus package tricks — and makes exhaustive
pattern-matching `switch` possible over pure contracts.

## Gotchas

**Symptom:** "constant" declared in an interface turns out to be `public static final` — and an implementor's attempt to assign it won't compile
**Cause:** interface fields are implicitly `public static final`; interfaces cannot hold instance state, and the modifiers apply whether written or not
**Fix:** constants in interfaces are fine sparingly; instance state belongs in an abstract class or the implementors

**Symptom:** compile error `inherits unrelated defaults for m() from types A and B`
**Cause:** the true diamond — two unrelated superinterfaces each supply a default for the same signature
**Fix:** override `m()` in the class; delegate with `A.super.m()` if one side's behaviour is wanted

**Symptom:** `default boolean equals(Object o)` in an interface refuses to compile
**Cause:** JLS §9.4.1.1 — methods of `Object` cannot be defaulted; identity semantics are class business
**Fix:** put `equals`/`hashCode` in the implementing classes (or make them records)

**Symptom:** a library minor-version bump breaks your build: "class must implement abstract method"
**Cause:** the library added an *abstract* method to an interface you implement — a source- and binary-incompatible interface change
**Fix:** implement it; as an API author, learn the lesson — evolve interfaces with `default` methods, never bare abstract additions

**Symptom:** abstract class marked with no abstract methods — reviewer asks why it exists
**Cause:** it's being used only to block instantiation or share constants
**Fix:** legal but usually wrong shape: a utility class wants a private constructor; shared behaviour with no state wants an interface with defaults

**Symptom:** a `default` method was meant to be the mandatory behaviour, but an implementor overrode it away
**Cause:** defaults are always overridable — `final default` does not exist
**Fix:** mandatory logic belongs in an abstract class's `final` method (template method), or in a wrapper the caller controls — interfaces cannot enforce behaviour

**Symptom:** abstract class constructor "runs" although the class can never be instantiated
**Cause:** every concrete subclass construction chains through it ([class anatomy](01-class-anatomy/README.md)) — abstract only forbids *direct* `new`
**Fix:** expected; it is exactly where shared-state initialization belongs — and why abstract classes can enforce invariants interfaces cannot

**Symptom:** `X.super.plan()` fails to compile from a class that transitively implements `X`
**Cause:** the syntax requires `X` to be a *direct* superinterface of the calling class
**Fix:** add `X` to the `implements` clause, or restructure — you cannot reach past your direct supertypes

## Interview questions

**★ When do you choose an abstract class over an interface?**
When subtypes need shared *state*, constructors, or enforced (`final`)
skeleton behaviour — the three things interfaces cannot provide. Everything
contract-shaped defaults to an interface: no inheritance budget spent,
unlimited implementors, testable seams, evolvable via defaults.

**★ Why were default methods added, and what discipline keeps them sane?**
API evolution — `Collection.stream()` had to arrive without breaking every
implementation. Discipline: a default derives behaviour from the
interface's own abstract methods; no pseudo-state, nothing mandatory (it
can always be overridden), `private` interface methods for shared plumbing.

**★ Two interfaces provide the same default method. What happens?**
Rule 1: a class implementation wins over any default. Rule 2: the more
specific interface wins if one extends the other. Rule 3: otherwise it's a
compile error and the class must override — optionally delegating with
`InterfaceName.super.method()`. Diamonds never resolve silently.

**★ Why can't interfaces default `equals`/`hashCode`?**
The JLS forbids defaulting `Object`'s methods: identity and equality
semantics depend on class representation and state, which interfaces don't
have. Allowing it would also make the diamond rules decide object equality —
a correctness disaster by construction.

**How do sealed interfaces change this decision?**
They give interfaces the one control that used to force abstract classes —
a closed set of subtypes (`permits`) — enabling exhaustive `switch` over
contracts. "Closed hierarchy" stopped implying "class hierarchy".

**What breaks binary compatibility: adding a default method or an abstract one?**
Abstract additions break every implementor (must-implement). Default
additions are compatible — existing classes inherit the default — with the
rare edge that an unrelated diamond conflict can newly arise at recompile.

**Marker interface vs annotation?**
Marker interfaces participate in the type system (`instanceof`, generic
bounds, overload targets); annotations are metadata read reflectively.
Prefer annotations unless the marker must appear where a *type* goes.

---

← Prev: [Polymorphism and dynamic dispatch](04-polymorphism-dispatch/README.md) · Index: [Phase 2 — Classes and objects](README.md)
