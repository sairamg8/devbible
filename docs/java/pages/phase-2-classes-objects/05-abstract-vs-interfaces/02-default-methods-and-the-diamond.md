---
title: "Default methods and the diamond"
sidebar_label: "2 · Defaults and the diamond"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §9.4 (method declarations in
> interfaces — `default`, `static`, `private`), §9.4.1.1 (methods of
> `Object` cannot be defaulted), §8.4.8.4 (inheriting methods with
> override-equivalent signatures — the diamond rules), §15.12.1
> (`InterfaceName.super` qualification), and the JDK 25 Javadoc for
> `Collection.stream()` and `Comparator`.

**`default` methods were added (Java 8) for one reason: API evolution.
`Collection` had to gain `stream()` without breaking every implementation
on Earth. That origin sets the discipline — a default derives behaviour
from the interface's own abstract methods, holds no state, and is always
replaceable — and it forced the language to answer the multiple-inheritance
question it had dodged since 1995: what happens when the same method body
arrives from two directions? Three rules, no silent case.**

## Why defaults exist — the evolution problem

Before Java 8, an interface was frozen the day someone else implemented
it: adding any method broke every implementor with a compile error
("class does not implement abstract method"). The streams library needed
`stream()`, `forEach`, `removeIf`, `sort` on collection types that had
thousands of third-party implementations. The choice was: break the
ecosystem, ship parallel `Collection2` types (the .NET route), or let
interfaces carry *overridable fallback bodies*. Defaults are the third
option:

```java
public interface Collection<E> extends Iterable<E> {
    // Java 8 added this WITHOUT breaking a single implementor:
    default Stream<E> stream() {
        return StreamSupport.stream(spliterator(), false);
    }
}
```

Every pre-2014 `Collection` implementation gained `stream()` for free,
expressed purely in terms of other interface methods. That is the shape of
a good default: **behaviour derivable from the contract itself**.

## The discipline — what a default may and may not do

- **Derive from the interface's own methods.** `wasTouchedSince(t)` calling
  `trail()` — yes. Reaching for state it hopes implementors have — no.
  Interfaces have no fields, so a default that "needs state" is a design
  error, not a missing feature.
- **Never mandatory.** A `default` method cannot be `final`; implementors
  may always replace it. Mandatory logic belongs in an abstract class's
  `final` method or a wrapper the caller controls (chunk 3).
- **Document self-use.** `Collection.stream()`'s Javadoc says it is built
  on `spliterator()` — implementors overriding one must know how the other
  behaves. A default's dependence on the interface's other methods is API.

`static` interface methods hold factories and helpers —
`Comparator.comparing(...)`, `List.of(...)` — namespaced on the type they
serve, killing the old `Comparators`-style companion classes. `private`
interface methods (Java 9) share plumbing *between* defaults without
publishing it:

```java
public interface Retryable {
    int maxAttempts();
    default void runWithRetry(Runnable task) { attempt(task, maxAttempts()); }
    default void runOnce(Runnable task)      { attempt(task, 1); }
    private void attempt(Runnable task, int budget) { /* shared, unpublished */ }
}
```

What interfaces still cannot do: declare instance fields, define
constructors, or default `Object`'s methods — `equals`/`hashCode`/
`toString` cannot be defaulted (JLS §9.4.1.1), because identity semantics
belong to classes and their state
([`equals` and `hashCode`](../06-equals-hashcode/README.md) is the class-side
story). Allowing it would also put object equality at the mercy of the
diamond rules below — a correctness disaster by construction.

## The constant-interface antipattern

Interface fields are implicitly `public static final` whether you write
the modifiers or not. That invited a 1990s abuse: an interface holding
only constants, `implements`-ed to "import" them.

```java
public interface PhysicalConstants {          // the antipattern
    double AVOGADRO = 6.022_140_76e23;
}
class Reactor implements PhysicalConstants { ... }   // leaks into Reactor's API
```

The `implements` clause is *public API*: `Reactor`'s published type now
advertises a constants bag forever, and every subclass inherits the
namespace pollution. The fixes have existed for two decades: a
`final` class with a private constructor holding the constants, plus
`import static` at use sites — or an `enum` when the constants are a
closed set of *things* rather than numbers
([Enums](../10-enums/README.md)).

## The diamond, resolved by rule

With multiple interfaces, the same `default` signature can arrive twice.
The resolution rules are short and total:

1. **Classes win.** A method inherited from a class (or declared in the
   class itself) beats any interface default. Class hierarchy is always
   more specific than interface hierarchy.
2. **The most specific interface wins.** If `TrackedShipment extends
   Shipment` and both declare a default `eta()`, `TrackedShipment`'s wins —
   subinterface beats superinterface.
3. **Otherwise: compile error.** Two unrelated interfaces supply the same
   default — `class DroneDelivery inherits unrelated defaults for plan()
   from types Ground and Air`. The class must override it itself, and may
   delegate explicitly:

```java
class DroneDelivery implements Ground, Air {
    @Override public Route plan() {
        return Air.super.plan();          // the disambiguation syntax
    }
}
```

`X.super.m()` is legal only for a *direct* superinterface `X` (named in
this class's own `implements` clause), and only when `X`'s `m()` is not
already overridden by a more specific interface in between. Diamonds are
therefore never silent in Java — the ambiguous case refuses to compile,
which is the whole design. Contrast rule 1's corollary: an *abstract*
method inherited from a class also beats an interface default, so a
default cannot even "fill in" a class-side abstract slot silently.

## Evolution and binary compatibility

- **Adding an abstract method** to an interface: source- and
  binary-incompatible for implementors. Every implementing class must
  change. In a published library this is the sin defaults exist to avoid.
- **Adding a default method**: compatible — existing classes inherit the
  body. Two honest edges: a class that already had a method with that
  signature now silently *overrides* the new default (fine unless the
  contracts differ), and a class implementing two independently-evolved
  interfaces can wake up to a rule-3 conflict at its next recompile —
  already-compiled binaries keep running (the JVM picks the class's
  existing resolution), the error appears at source level.
- **Removing or re-abstracting a default**: breaks every implementor that
  relied on inheriting the body. Evolution is a one-way door: defaults can
  be added freely, hardened never.

This asymmetry is why modern APIs are interfaces: the evolution story —
add defaults, add static factories, never add bare abstract methods — is
survivable. An abstract class evolves more freely internally (new
protected members, new fields) but demands the `extends` slot up front.

## Gotchas

**Symptom:** compile error `inherits unrelated defaults for m() from types A and B`
**Cause:** the true diamond — two unrelated superinterfaces each supply a default for the same signature
**Fix:** override `m()` in the class; delegate with `A.super.m()` if one side's behaviour is wanted

**Symptom:** `default boolean equals(Object o)` in an interface refuses to compile
**Cause:** JLS §9.4.1.1 — methods of `Object` cannot be defaulted; identity semantics are class business
**Fix:** put `equals`/`hashCode` in the implementing classes (or make them records)

**Symptom:** a library minor-version bump breaks your build: "class must implement abstract method"
**Cause:** the library added an *abstract* method to an interface you implement — a source- and binary-incompatible interface change
**Fix:** implement it; as an API author, learn the lesson — evolve interfaces with `default` methods, never bare abstract additions

**Symptom:** a `default` method was meant to be the mandatory behaviour, but an implementor overrode it away
**Cause:** defaults are always overridable — `final default` does not exist
**Fix:** mandatory logic belongs in an abstract class's `final` method (template method), or in a wrapper the caller controls — interfaces cannot enforce behaviour

**Symptom:** `X.super.plan()` fails to compile from a class that transitively implements `X`
**Cause:** the syntax requires `X` to be a *direct* superinterface of the calling class
**Fix:** add `X` to the `implements` clause, or restructure — you cannot reach past your direct supertypes

**Symptom:** upgrading one dependency made an unrelated class stop compiling with a diamond error it never had
**Cause:** two interfaces the class implements evolved independently; the new release added a default whose signature collides with the other interface's existing default (rule 3 arrives late)
**Fix:** add the override with explicit delegation; this is the known cost of defaults in independently-versioned APIs — pin it with a test on the chosen behaviour

**Symptom:** overriding one interface method mysteriously changed another's behaviour
**Cause:** a default was built on the method you overrode (self-use) — `stream()` on `spliterator()`, `runWithRetry` on `maxAttempts()`
**Fix:** read the default's documented self-use before overriding; override the pair together if their contracts are coupled

**Symptom:** team "imports" constants by implementing a constants-only interface
**Cause:** the constant-interface antipattern — `implements` is API, not an import statement
**Fix:** `final` class + private constructor + `import static`, or an enum for closed sets

## Interview questions

**★ Why were default methods added, and what discipline keeps them sane?**
API evolution — `Collection.stream()` had to arrive without breaking every
implementation. Discipline: a default derives behaviour from the
interface's own abstract methods; no pseudo-state, nothing mandatory (it
can always be overridden), `private` interface methods for shared plumbing,
documented self-use.

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

**★ What breaks binary compatibility: adding a default method or an abstract one?**
Abstract additions break every implementor (must-implement). Default
additions are compatible — existing classes inherit the default — with the
rare edge that an unrelated diamond conflict can newly arise at recompile,
and that an existing same-signature method silently becomes an override.

**What are `static` and `private` interface methods for?**
`static`: factories and helpers namespaced on the type they serve
(`Comparator.comparing`) — no more companion classes. `private` (Java 9):
shared plumbing between defaults without publishing it — the two together
let an interface organize its own default implementations properly.

**What is the constant-interface antipattern?**
An interface used as a constants bag and `implements`-ed as a pseudo-import.
It pollutes the implementor's *published type* forever. Use a
non-instantiable class with `import static`, or an enum for closed sets.

**When is `InterfaceName.super.method()` illegal?**
When `InterfaceName` is not a *direct* superinterface of the current class,
or when a more specific interface between you and it has already overridden
the method. You can only reach one level up, and only along declared edges.

---

← Prev: [The decision line](01-the-decision-line.md) · Index: [Abstract classes vs interfaces](README.md) · Next → [Skeletons, sealed types and API design](03-skeletons-sealed-and-api-design.md)
