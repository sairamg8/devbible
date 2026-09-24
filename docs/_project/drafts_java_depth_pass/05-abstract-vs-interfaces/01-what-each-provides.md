---
title: "What each construct actually provides"
sidebar_label: "1 · What each provides"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.1.1.1 (abstract classes), §8.8
> (constructors), §9.1–§9.3 (interface declarations and members, implicit
> modifiers), §9.4.1.1 (no `default` for `Object` methods), and the JDK 25
> API documentation.

**An abstract class is a class missing decisions; an interface is a
capability missing a home. The one can hold state, constructors and enforced
skeleton behaviour down a single inheritance channel; the other can attach
to any class from any hierarchy, at the price of holding no instance state
at all. Everything else about the choice follows from this table.**

## The capability table

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

## What only an abstract class can do

**Hold and initialize state.** Fields with any access level, assigned in a
constructor that *every* concrete subclass construction chains through
([class anatomy](../01-class-anatomy.md)). `abstract` forbids only direct
`new` — the constructor still runs, which is exactly where shared invariants
belong: validate once in `BaseEntity(EntityId id)` and no subclass can skip
it.

**Enforce a skeleton.** The template method pattern is an abstract class's
signature move — a `final` public method fixing the algorithm, calling
`protected abstract` hooks the subclass must fill:

```java
public abstract class ReportJob {
    public final void run() {              // final: the sequence is not negotiable
        var data = fetch();                // hook
        var doc  = render(data);           // hook
        store(doc);                        // shared implementation
    }
    protected abstract Data fetch();
    protected abstract Document render(Data data);
    private void store(Document d) { /* shared */ }
}
```

Interfaces cannot express "you may replace this step but not the sequence" —
a `default` method is always overridable, `final default` does not exist
(chunk 2 returns to this).

**Restrict who participates.** An abstract class can have package-private
constructors — only same-package classes can subclass it. Before `sealed`
(chunk 3), that was *the* way to close a hierarchy.

## What only an interface can do

**Attach to any class.** A capability as an interface costs an implementor
nothing structural: `class Invoice extends Document implements Auditable,
Comparable<Invoice>` — the single `extends` slot stays free. Model
capabilities as interfaces *because* you cannot know who will need them.

**Multiply.** A type can take unlimited interfaces; the diamond rules
(chunk 2) exist precisely because that is allowed.

**Stay representation-free.** Implementors owe signatures, nothing else — no
inherited fields, no constructor chain, no fragile-base-class coupling
([inheritance's](../03-inheritance/README.md) rot problem is a class
phenomenon).

## The members interfaces actually have

Every interface field is implicitly `public static final` — a constant,
whether you write the modifiers or not (JLS §9.3). There is no such thing as
interface instance state, and an implementor cannot "assign" one. Constants
in an interface are fine sparingly (`Comparator`-style bound values); the
old *constant interface* antipattern — `implements Constants` just to
inherit unqualified names — pollutes the implementor's public type surface
forever and died with `static import`.

Abstract methods are the norm. `default`/`static`/`private` bodies are
chunk 2's subject. And one hard boundary (JLS §9.4.1.1): **`Object`'s
methods cannot be defaulted** — `default boolean equals(Object o)` refuses
to compile. Identity semantics depend on representation, which interfaces do
not have; allowing it would also put the diamond rules in charge of object
equality ([the contract](../06-equals-hashcode/README.md) belongs to
classes).

**Marker interfaces** — no members at all — work because they participate in
the *type system*: `Serializable`-style markers are `instanceof`-checkable,
usable as generic bounds and overload targets. Chunk 3 weighs them against
annotations.

## Gotchas

**Symptom:** "constant" declared in an interface turns out to be `public static final` — and an implementor's attempt to assign it won't compile
**Cause:** interface fields are implicitly `public static final`; interfaces cannot hold instance state, and the modifiers apply whether written or not
**Fix:** constants in interfaces are fine sparingly; instance state belongs in an abstract class or the implementors

**Symptom:** `default boolean equals(Object o)` in an interface refuses to compile
**Cause:** JLS §9.4.1.1 — methods of `Object` cannot be defaulted; identity semantics are class business
**Fix:** put `equals`/`hashCode` in the implementing classes (or make them records)

**Symptom:** abstract class marked with no abstract methods — reviewer asks why it exists
**Cause:** it's being used only to block instantiation or share constants
**Fix:** legal but usually wrong shape: a utility class wants a private constructor; shared behaviour with no state wants an interface with defaults

**Symptom:** abstract class constructor "runs" although the class can never be instantiated
**Cause:** every concrete subclass construction chains through it ([class anatomy](../01-class-anatomy.md)) — abstract only forbids *direct* `new`
**Fix:** expected; it is exactly where shared-state initialization belongs — and why abstract classes can enforce invariants interfaces cannot

**Symptom:** a class `implements Constants` and its public API is littered with inherited constant names
**Cause:** the constant-interface antipattern — interfaces put their fields on every implementor's type surface, permanently (removing the interface later breaks binary compatibility)
**Fix:** `static import` the constants from a `final` utility class, or keep them on the interface *without* implementing it just for the names

**Symptom:** `protected` fields in an abstract base class mutated freely by subclasses; invariants hold in tests, break in production
**Cause:** `protected` state is a contract with every subclass ever written — the base class can no longer defend its own invariants
**Fix:** keep base-class fields `private`; expose `protected final` accessors or narrow mutators that validate ([encapsulation](../02-encapsulation-access.md))

**Symptom:** an abstract method is `private` — compile error; or `static abstract` — also refused
**Cause:** `abstract` means "dispatched and supplied elsewhere"; `private` members don't dispatch and `static` members bind statically ([dispatch, chunk 1](../04-polymorphism-dispatch/01-the-two-machines.md)) — the combinations are contradictions
**Fix:** an overridable hook must be at least package-private; a static "hook" wants an instance (strategy object) instead

## Interview questions

**★ What are the three things an interface can never give you?**
Instance state (fields are implicitly constants), constructors (no way to
enforce initialization), and mandatory behaviour (`final default` does not
exist — every default is overridable). Needing any of the three is the
signal for an abstract class.

**★ Why does an abstract class's constructor run if the class can't be instantiated?**
`abstract` only forbids direct `new`. Every concrete subclass construction
chains through the abstract constructor — which is precisely where shared
invariants are enforced, once, for the whole hierarchy.

**★ What is the template method pattern and why can't interfaces express it?**
A `final` skeleton method fixes the algorithm and calls `protected abstract`
hooks that subclasses fill. Interfaces can't: defaults are always
overridable and interfaces hold no state for the skeleton to manage —
"replaceable step, fixed sequence" needs a class.

**★ Why can't `Object`'s methods be defaulted in an interface?**
The JLS forbids it: equality/identity semantics depend on class
representation and state, which interfaces don't have. Allowing it would
also make the diamond rules decide object equality — a correctness disaster
by construction.

**Why are interface fields implicitly `public static final`?**
Interfaces define contracts, not representation; the only field that can't
create per-instance state is a constant. The implicit modifiers make that
impossible to get wrong — and are why the constant-interface antipattern
leaks names onto implementors.

**When is a marker interface still the right tool?**
When the marker must participate where a *type* goes: `instanceof` checks,
generic bounds (`<T extends Cacheable>`), overload selection. If it's pure
metadata read reflectively, an annotation is the modern answer (chunk 3).

**What did closing a hierarchy look like before `sealed`?**
An abstract class with a package-private constructor — nothing outside the
package can call `super()`, so nothing outside can subclass. It worked, but
tied the closed set to a package; `sealed` (chunk 3) names the set
explicitly and works for interfaces too.

---

← Index: [Abstract vs interfaces](README.md) · Next → [Evolution and the diamond](02-evolution-and-the-diamond.md)
