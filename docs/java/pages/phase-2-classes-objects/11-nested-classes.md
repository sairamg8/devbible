---
title: "Nested classes"
sidebar_label: "11 · Nested classes"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §8.1.3 (inner classes and enclosing
> instances), §8.5 (member type declarations), §15.9.2 (qualified class
> instance creation), and the JDK 25 nested-classes tutorial pages on
> dev.java.

**A class declared inside another class comes in two fundamentally different
kinds, and the keyword `static` is what separates them. A *static nested*
class is just a namespaced top-level class. An *inner* class secretly holds a
reference to an instance of its enclosing class — which changes construction
syntax, serialization, and, most importantly, object lifetime. Most
"mysterious memory leak" stories involving nested classes are that hidden
reference doing exactly what it was designed to do.**

## The four kinds, precisely

| Kind | Declared | Holds outer instance? |
|---|---|---|
| **Static nested** | `static class Inside {}` as a member | No |
| **Inner (member)** | `class Inside {}` as a member, no `static` | **Yes** |
| **Local** | inside a method body | Yes, if the method is an instance method |
| **Anonymous** | at a `new` expression | Yes, if created in instance context |

Two more facts that answer most quiz questions:

- **Nested interfaces, records and enums are implicitly `static`.** You cannot
  make an inner (outer-referencing) record or enum; the JLS defines them as
  static members wherever they nest.
- Nesting affects *access*, not just naming: since nestmates (Java 11, JEP
  181), an outer class and all its nested classes can touch each other's
  `private` members directly — that is the point of nesting.

## The hidden outer reference

An inner class compiles to a class with a synthetic field (conventionally
`this$0`) holding the enclosing instance, assigned in its constructor. That
is what makes this legal:

```java
public class Order {
    private final List<Item> items = new ArrayList<>();

    class Auditor {                       // inner — no static
        int size() { return items.size(); }   // reads outer state directly
    }

    static class Line {                   // static nested — no outer access
        // items is not reachable from here
    }
}
```

`Auditor` can read `items` because every `Auditor` *is attached to* an
`Order`. The attachment is why construction needs an instance:

```java
Order order = new Order();
Order.Auditor a = order.new Auditor();   // the odd but real syntax
Order.Line line = new Order.Line();      // static nested: normal
```

Nobody writes `order.new` often — inner classes are almost always
instantiated from inside the outer class's own methods, where `new Auditor()`
implicitly uses `this`.

## Why the outer reference is a lifetime bug waiting to happen

The reference is invisible in source, but the GC sees it plainly: **as long
as the inner instance is reachable, the entire outer instance — and
everything *it* references — is reachable too**
([reachability](../phase-0-platform-jvm/08-garbage-collection.md) is
transitive).

The classic shapes:

- **The registered listener.** An inner (or anonymous) listener is handed to
  a long-lived registry — an event bus, a scheduler, a static cache. The
  outer object "finishes" its work, but the registry's reference to the
  listener pins the whole outer graph. In Android this was *the* canonical
  activity leak; on the server it is the session or request object that
  never dies.
- **The returned lambda-shaped object.** A method returns an anonymous-class
  instance built from instance context; the caller stores it somewhere
  long-lived. Same pinning, one step removed. (Lambdas are better here:
  a lambda that uses no instance state captures no `this`. An anonymous
  class in instance context captures `this` *whether it uses it or not*.)
- **Serialization drags the outer along.** Serializing an inner-class
  instance serializes its `this$0` field too — either failing (outer not
  serializable) or silently writing far more object graph than intended.
  The `Serializable` Javadoc explicitly warns against serializing inner
  classes.

The rule that prevents all three: **make every nested class `static` unless
it genuinely needs the outer instance** — and when it does need it, be able
to say for how long the inner instance will live. Effective Java (3rd ed.,
Item 24) states it exactly this way. IDE inspections and error-prone flag
inner classes with unused outer references for the same reason.

## Anonymous classes after lambdas

Before Java 8, anonymous classes were how you passed behaviour. Lambdas
replaced them **only for functional interfaces** (one abstract method).
Anonymous classes remain the tool when you need to:

- implement an interface with **several** abstract methods, or extend an
  abstract class inline;
- override *some* methods of a class for a one-off (a `TimerTask`, a test
  double without a framework);
- carry per-instance **state** (fields) in the one-off implementation.

Differences that bite when converting between the two: an anonymous class
gets its own `this` (so `this.x` means the anonymous instance), while inside
a lambda `this` is the *enclosing* instance; and a lambda only captures what
it uses, while an instance-context anonymous class always captures the outer
`this`.

## Local classes

A class declared inside a method body. Rare, but the right tool when a
one-off type needs a **name and fields** and must not escape the method —
a small comparator with state, a recursive helper. Like lambdas and
anonymous classes, they can read local variables of the method only if those
variables are **effectively final**.

## When static nested is exactly right

- **Builders**: `Order.Builder` — coupled to `Order` by name and access, no
  outer instance involved.
- **Return-value bundles / private value types**: a `record Result(...)`
  nested where it is used.
- **Implementation details**: `HashMap.Node` is a static nested class — the
  JDK itself uses the pattern everywhere.

The name signals ownership; `static` keeps the lifetime and serialization
story trivial.

## Gotchas

**Symptom:** heap dump shows thousands of "small" listener objects each retaining megabytes
**Cause:** the listeners are inner/anonymous classes; each pins its outer instance (and that instance's whole graph) via the hidden `this$0` reference, and a long-lived registry holds the listeners
**Fix:** deregister listeners deterministically; or make the listener a static nested class (or a lambda using no instance state) that receives only the data it needs

**Symptom:** `NotSerializableException` naming the *outer* class when serializing what looks like a tiny nested object
**Cause:** inner-class instances serialize their synthetic outer reference too
**Fix:** make the nested class `static` (add the fields it actually needs), or don't serialize it — the `Serializable` docs discourage serializing inner classes outright

**Symptom:** `new Auditor()` fails to compile in a static method: "an enclosing instance ... is required"
**Cause:** inner-class construction needs an outer instance; static context has none
**Fix:** `order.new Auditor()` with an explicit instance — or, usually better, make the class static nested and pass state through its constructor

**Symptom:** converted an anonymous class to a lambda and `this.something` now resolves to a different object
**Cause:** in an anonymous class `this` is the anonymous instance; in a lambda `this` is the enclosing instance — the conversion silently changed the meaning
**Fix:** name the outer explicitly (`Outer.this` beforehand to see what was meant) and rewrite the body against the right receiver

**Symptom:** tried to declare `class Cursor` inside an interface or to write an inner `enum`/`record` and got "illegal" or unexpectedly static behaviour
**Cause:** nested types in interfaces, and all nested enums, records and interfaces, are implicitly static — inner variants of them do not exist
**Fix:** expected; if outer state is needed, pass it in explicitly

**Symptom:** a local class or anonymous class "cannot refer to a non-final local variable"
**Cause:** captured locals must be effectively final — the class copies the value at construction; allowing reassignment would create two divergent copies
**Fix:** copy into a final local, use a one-element array/holder deliberately, or restructure so the mutation lives outside

**Symptom:** unit test can't instantiate `Outer.Inner` for testing
**Cause:** construction requires a real outer instance, dragging its dependencies into the test
**Fix:** the test friction is the design signal — static nested with explicit constructor parameters is the testable shape

## Interview questions

**★ What is the difference between a static nested class and an inner class?**
A static nested class is a namespaced top-level class — no relationship to
any outer *instance*. An inner class instance holds a hidden reference to an
enclosing instance, set at construction; it can read the outer's fields, must
be constructed via an outer instance, and keeps that outer reachable for as
long as it lives.

**★ How can a nested class cause a memory leak?**
An inner/anonymous instance pins its outer instance through the synthetic
outer reference. Hand such an object to something long-lived — an event bus,
scheduler, static cache — and the "finished" outer object plus its whole
graph stay reachable. Fix: deregister, or use `static` nested / stateless
lambdas so no outer reference exists.

**★ Which default should you reach for, and why?**
`static` nested, per Effective Java Item 24. It has trivial lifetime and
serialization behaviour and states its dependencies explicitly through its
constructor. Drop `static` only when the class genuinely needs live access
to the outer instance — and then own the lifetime question.

**★ When is an anonymous class still the right tool after lambdas?**
When the target type is not a functional interface (multiple abstract
methods, abstract classes), when the one-off needs fields, or when you need
to override selected methods inline. Lambdas only cover the one-method case
— and differ in `this` binding and capture behaviour.

**Why does serializing an inner class instance often fail or balloon?**
The synthetic outer-instance field serializes with it: if the outer is not
serializable it throws; if it is, the outer graph rides along. Static nested
classes have no such field.

**What are nestmates?**
Since Java 11 (JEP 181), a top-level class and all classes nested in it
compile as one "nest" whose members can access each other's `private`
members directly — formalizing at the JVM level what nesting always meant at
the language level.

**Can an enum or record be an inner class?**
No. Nested enums, records and interfaces are implicitly static — the
language forbids the outer-instance-holding variant for them, so they never
have the lifetime problem.

---

← Prev: [Enums](10-enums/README.md) · Index: [Phase 2 — Classes and objects](README.md) · Next → [Designing immutable classes](12-immutable-design/README.md)
