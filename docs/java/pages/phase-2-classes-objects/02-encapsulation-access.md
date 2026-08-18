---
title: "Encapsulation and access modifiers"
sidebar_label: "02 · Encapsulation and access"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §6.6 (access control), §8.4.8.3
> (requirements in overriding), and the JDK 25 API documentation.

**Access modifiers are not politeness — they are the compiler enforcing which
code is allowed to depend on which. Every member you expose is an API you now
maintain forever; every member you hide is refactoring freedom you kept. The
four levels are learnable in a minute; the craft is that most codebases use
exactly two of them well (`private`, `public`) and waste the two in the
middle — `protected` misunderstood, package-private forgotten.**

## The four levels, precisely

| Modifier | Same class | Same package | Subclass (other package) | Everywhere |
|---|---|---|---|---|
| `private` | ✅ | — | — | — |
| *(none)* — package-private | ✅ | ✅ | — | — |
| `protected` | ✅ | ✅ | ✅ | — |
| `public` | ✅ | ✅ | ✅ | ✅ |

Two rows are routinely misread:

- **`protected` includes the whole package.** It is package-private *plus*
  subclasses elsewhere — strictly wider than the default, not an alternative
  to it. A same-package class that is not a subclass can touch your
  `protected` members freely (JLS §6.6.2 adds one nuance: from *outside* the
  package, a subclass may access a protected instance member only through a
  reference of its own type or a subtype).
- **Package-private is a real design tool, not an omission.** No keyword
  means "internal to this package" — which, combined with "one package per
  feature", gives you module-like encapsulation with zero machinery: public
  interface, package-private implementations, and the compiler stops outside
  callers from reaching the internals.

Top-level classes take only `public` or package-private. Members take all
four. `private` members of *nested* classes are accessible across the whole
top-level file (they compile into one nest — **nested classes**, topic 11
*(not written yet)*, covers the mechanics).

## `private` is class-level, not instance-level

`private` protects the *class*, not the *object*: code in `Money` can read
`other.amount` for any other `Money`. That is deliberate, and the standard
`equals` idiom depends on it:

```java
@Override public boolean equals(Object o) {
    return o instanceof Money m
        && amount.equals(m.amount)          // touching m's private field: legal
        && currency.equals(m.currency);
}
```

## Encapsulation is about behaviour, not getters

Wrapping every field in `getX`/`setX` is not encapsulation — it is `public`
fields with extra steps. The object still cannot defend an invariant, and
callers still implement the logic that belongs inside:

```java
// Ask for data, decide outside — invariant lives in every caller
if (order.getStatus() == SHIPPED || order.getStatus() == DELIVERED) { ... }

// Tell the object — invariant lives in one place
if (order.isClosed()) { ... }

// The full version: no setter at all; the transition guards itself
public void ship() {
    if (status != PAID) throw new IllegalStateException("unpaid order: " + id);
    this.status = SHIPPED;
}
```

"Tell, don't ask" is the habit: push decisions toward the data. The practical
payoffs are concrete — invariants enforceable in one place, a seam for
logging/metrics, and the freedom to change representation (store cents, split
a field) without touching callers.

**Records are not a counterexample.** A record exposes its *components* —
that is its contract as a transparent data carrier — but the representation
is still `private final` fields, validation still guards construction in the
compact constructor, and there are no setters. Data carriers expose data;
domain objects expose behaviour. Knowing which one you are writing is the
actual skill (**records**, topic 08 *(not written yet)*).

## Why `public` fields lock your API

A `public` field is a commitment to a *storage layout*: no validation on
write, no interception (logging, lazy init, metrics), no thread-safety
hook, no representation change — ever — without breaking or recompiling
callers (remember that `static final` constants get *inlined* into consumers:
[source to bytecode](../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md)).
The exceptions the ecosystem accepts: `public static final` constants of
immutable types, and `public final` fields on small package-internal value
types. Everything else earns a method.

## Access in inheritance: widen, never narrow

An override may make a member **more** accessible, never less
(JLS §8.4.8.3): `protected` → `public` is legal, `public` → `protected` is a
compile error. The reason is substitutability — code holding a supertype
reference was promised `public` access, and a subclass cannot revoke a
promise the supertype made. Interfaces are the boundary case: their methods
are implicitly `public`, so every implementation must declare its overrides
`public`.

## Gotchas

**Symptom:** a teammate "protected" a helper and same-package test/production code still calls it freely
**Cause:** `protected` includes the entire package — it is wider than package-private, not stricter
**Fix:** if the goal was "subclasses only", Java has no such level; package-private plus package discipline, or redesign so the hook isn't needed

**Symptom:** compile error `attempting to assign weaker access privileges` on an interface implementation
**Cause:** interface methods are implicitly `public`; the implementing class omitted the modifier, defaulting to package-private — a narrowing
**Fix:** declare the implementation `public`

**Symptom:** `equals` implementation reads another instance's private field and a reviewer flags it as a violation
**Cause:** misunderstanding — `private` is class-scoped; any `Money` code may access any `Money` instance's privates
**Fix:** nothing to fix; it is the standard idiom and the JLS-specified meaning

**Symptom:** changed a `public static final int` "constant" and consumers still see the old value after redeploy
**Cause:** compile-time constants are inlined into consuming class files at their compile time
**Fix:** recompile consumers, or expose values that may change via a method instead of a constant

**Symptom:** a field on an interface turned out to be globally mutable state — except it wouldn't compile as mutable
**Cause:** interface fields are implicitly `public static final` — constants only; there is no instance state in interfaces
**Fix:** state belongs in classes; interfaces carry contract plus constants

**Symptom:** the "internal" class in another package is public and now external teams import it
**Cause:** cross-package visibility in Java has only one lever, `public` — package layout *is* the encapsulation boundary
**Fix:** co-locate the feature in one package and make internals package-private; at scale, JPMS `exports` is the stronger wall ([the module system](../phase-0-platform-jvm/11-module-system.md))

**Symptom:** widening an override to `public` worked, but callers using the subclass type now bypass the "protected" design
**Cause:** widening is legal and one-way — once published `public` on the subtype, that accessibility is part of its API forever
**Fix:** widen deliberately; it is an API commitment, not a local convenience

## Interview questions

**★ List the four access levels and what each admits.**
`private` — same top-level class; package-private (no keyword) — same
package; `protected` — same package *plus* subclasses anywhere (with the
outside-package "through your own type" rule for instance members); `public`
— everywhere. The commonly missed fact: `protected` ⊇ package-private.

**★ Is `private` per-instance or per-class, and what relies on the answer?**
Per-class: any instance's code may access another instance's private
members of the same class. The standard `equals`/`compareTo`/copy-constructor
idioms all read the other object's fields directly.

**★ Why is a getter-and-setter pair for every field not encapsulation?**
Because encapsulation means hiding *decisions*, not adding indirection to
data. Invariants still leak to every caller; representation still can't
change (the getter's return type pins it). Encapsulation shows up as
behaviour methods (`ship()`, `isClosed()`) and constructors that refuse
invalid states.

**★ Can an override reduce visibility? Why not?**
No — compile error. Substitutability: through a supertype reference the
member was promised at the supertype's access level; a subtype narrowing it
would break code that never mentions the subtype.

**When is package-private the right choice?**
For everything inside a feature package that isn't the feature's public
surface: implementations behind an interface, helpers, internal DTOs. It is
Java's zero-cost module system — and the discipline JPMS later formalized.

**Why do records expose all their state — isn't that anti-encapsulation?**
A record's contract *is* its data (a transparent carrier); construction
still validates, fields are still `private final`, and there are no setters.
The design question is upstream: whether the type should be a data carrier
or a behaviour-owning domain object.

---

← Prev: [Class anatomy and construction](01-class-anatomy.md) · Next → [Inheritance](03-inheritance.md)
