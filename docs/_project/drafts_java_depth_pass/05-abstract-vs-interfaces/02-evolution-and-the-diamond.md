---
title: "Default methods, API evolution, and the diamond"
sidebar_label: "2 · Evolution and the diamond"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §9.4 (method declarations,
> `default`, `static`, `private` interface methods), §9.4.1 and §8.4.8
> (inheritance and the most-specific rules), §13 (binary compatibility —
> §13.5.3 on adding interface methods), and the JDK 25 API documentation
> (`Collection.stream`, `Comparator.comparing`, `Iterable.forEach`).

**`default` methods were not added to make interfaces "more powerful" — they
were added so `Collection.stream()` could arrive in Java 8 without breaking
every implementation on Earth. That origin fixes their discipline: a default
derives behaviour from the interface's own methods, never fakes state, and
is always replaceable. The price of behaviour in interfaces is the diamond —
and Java's answer is three short rules that end in a compile error, never a
silent guess.**

## Why `default` exists, and its discipline

Adding an *abstract* method to a published interface is a source- and
binary-incompatible change — every implementor breaks (at compile time if
recompiled; with `AbstractMethodError` at dispatch if not —
[the machinery chunk](../04-polymorphism-dispatch/02-the-machinery-and-the-jit.md)).
Java 8 needed `stream()`, `forEach()`, `spliterator()` on interfaces with
thousands of external implementations. `default` is the escape hatch:
existing implementors inherit a working body and compile untouched.

That origin sets their proper use — behaviour *derivable from the
interface's own methods*, never pseudo-state, and always overridable (a
`default` method cannot be `final`; implementors may replace it):

```java
public interface Auditable {
    AuditTrail trail();                               // the primitive
    default boolean wasTouchedSince(Instant t) {      // derived, replaceable
        return trail().lastModified().isAfter(t);
    }
}
```

`static` interface methods hold factories and helpers
(`Comparator.comparing`); `private` interface methods (Java 9) share code
between defaults without publishing it. What interfaces still cannot do:
declare instance fields, define constructors, or provide `default`
implementations for `Object`'s methods
([chunk 1](01-what-each-provides.md)).

Three more evolution moves worth knowing by name:

- **Re-abstraction.** A sub-interface may redeclare an inherited `default`
  as abstract, cancelling the body for its own subtree — `interface Strict
  extends Lenient { @Override Result validate(Input in); }` forces
  implementors of `Strict` to decide, even though `Lenient` had a default.
- **Defaults don't beat classes.** If an implementor already inherits a
  concrete method from a *class*, a newly-added interface default with the
  same signature is simply ignored for it (rule 1 below) — which is what
  makes retrofitting interfaces onto old hierarchies safe, and occasionally
  surprising.
- **Binary compatibility table:** adding a `default` or `static` method —
  compatible; adding an abstract method — breaks implementors; removing any
  method — breaks callers. This asymmetry is the whole API-evolution game.

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
which is the whole design. (Contrast fields: two interfaces contributing a
same-named *constant* make any ambiguous unqualified use a compile error
too — qualify with the interface name.)

One subtlety worth pinning down: rule 2 compares *interfaces to
interfaces*; rule 1 compares *class channel to interface channel*. A
concrete method inherited from a superclass beats even a more-specific
interface default — the class channel always outranks the contract channel,
because a class body was written for a representation and a default was
not.

## Gotchas

**Symptom:** compile error `inherits unrelated defaults for m() from types A and B`
**Cause:** the true diamond — two unrelated superinterfaces each supply a default for the same signature
**Fix:** override `m()` in the class; delegate with `A.super.m()` if one side's behaviour is wanted

**Symptom:** a library minor-version bump breaks your build: "class must implement abstract method"
**Cause:** the library added an *abstract* method to an interface you implement — a source- and binary-incompatible interface change
**Fix:** implement it; as an API author, learn the lesson — evolve interfaces with `default` methods, never bare abstract additions

**Symptom:** a `default` method was meant to be the mandatory behaviour, but an implementor overrode it away
**Cause:** defaults are always overridable — `final default` does not exist
**Fix:** mandatory logic belongs in an abstract class's `final` method (template method), or in a wrapper the caller controls — interfaces cannot enforce behaviour

**Symptom:** `X.super.plan()` fails to compile from a class that transitively implements `X`
**Cause:** the syntax requires `X` to be a *direct* superinterface of the calling class
**Fix:** add `X` to the `implements` clause, or restructure — you cannot reach past your direct supertypes

**Symptom:** a newly-added interface default never runs for one implementor — its "old" behaviour persists
**Cause:** rule 1 — that implementor inherits a same-signature concrete method from a superclass, which beats any default
**Fix:** expected; if the default must apply, the class hierarchy has to stop supplying the method, or the implementor overrides explicitly and delegates with `Iface.super.m()`

**Symptom:** implementing a sub-interface suddenly demands a method the parent interface provided a default for
**Cause:** re-abstraction — the sub-interface redeclared the default as abstract, cancelling the body for its subtree
**Fix:** implement it (that was the sub-interface author's intent); when *you* author one, document that the redeclaration is deliberate

**Symptom:** two constants with the same name from two implemented interfaces — every unqualified use is a compile error
**Cause:** ambiguous inherited fields are never resolved by "most specific"; the JLS makes the *use* an error, not the inheritance
**Fix:** qualify: `Ground.MAX_LOAD` vs `Air.MAX_LOAD` — or stop putting constants on interfaces (chunk 1's antipattern)

**Symptom:** an `AbstractMethodError` in production from an interface whose method "has a default"
**Cause:** version skew — the *runtime* interface jar is older than the one compiled against; the default doesn't exist where the dispatch resolves
**Fix:** align the dependency graph ([the build phase](../../phase-8-build-dependencies/README.md)); the compile-time and run-time interface must be the same version

## Interview questions

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

**★ What breaks binary compatibility: adding a default method or an abstract one?**
Abstract additions break every implementor (must-implement). Default
additions are compatible — existing classes inherit the default — with the
rare edge that an unrelated diamond conflict can newly arise at recompile.

**★ Why does a superclass method beat a more specific interface default?**
The class channel always outranks the contract channel: a class body was
written against a representation; a default is representation-free
convenience. This rule is also what made retrofitting defaults onto
25-year-old hierarchies safe — existing class behaviour never silently
changed.

**What are `private` interface methods for?**
Sharing implementation between two or more `default`/`static` methods
without publishing the helper into the contract (Java 9). They cannot be
abstract and don't participate in inheritance — pure internal plumbing.

**What is re-abstraction?**
A sub-interface redeclaring an inherited default as abstract, cancelling
the inherited body for its subtree — used to tighten a contract that a
parent deliberately left lenient.

**Why is `X.super.m()` restricted to direct superinterfaces?**
Same reason `super.super` is illegal in classes: reaching past your direct
supertypes would let you bypass an intermediate type's deliberate override —
its invariants — from below.

---

← Prev: [What each provides](01-what-each-provides.md) · Next → [Choosing, and designing APIs](03-choosing-and-designing.md)
