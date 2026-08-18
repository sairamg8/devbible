---
title: "The decision line: state and skeletons vs contract and capability"
sidebar_label: "1 · The decision line"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.1.1.1 (abstract class
> semantics — no direct instantiation, constructors still run), §8.4.3.1
> (abstract methods), §9.1.1.1 (interfaces are implicitly abstract), and
> the JDK 25 API documentation for `Comparable`, `AutoCloseable` and
> `InputStream`.

**An abstract class and an interface answer different questions. The
abstract class answers "what do my subclasses *share*?" — fields,
constructors, protected helpers, a fixed skeleton. The interface answers
"what can callers *rely on*?" — a contract any class from any hierarchy
can sign. Most wrong choices come from asking one construct the other's
question.**

## What each construct actually provides

| | Abstract class | Interface |
|---|---|---|
| Instance state | ✅ fields, any access | ❌ — fields are implicitly `public static final` constants |
| Constructors | ✅ (run in every subclass construction) | ❌ |
| Method bodies | ✅ any | `default`, `static`, `private` methods only |
| Abstract methods | ✅ | ✅ (the norm) |
| Access levels on members | all four | `public` (or `private` for helper methods) |
| `final` methods | ✅ — enforceable skeletons | ❌ — a `default` is always overridable |
| How many can a type take | **one** (`extends`) | unlimited (`implements`) |
| Couples subtypes to | implementation + state | contract only |

An abstract class may be a complete implementation missing one decision
(template method: `final` skeleton calling one `protected abstract` hook).
An interface is a capability from any inheritance line: `Comparable`,
`AutoCloseable`, your `PaymentProcessor` — implemented by classes that
share no ancestry.

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

`OrderEntity extends BaseEntity implements Auditable, Comparable<OrderEntity>`
— one implementation parent, any number of capabilities. That asymmetry is
the whole design: implementation inheritance is expensive (you inherit
representation, bugs and fragility — see
[Inheritance](../03-inheritance/README.md)), so Java rations it to one; contract
inheritance is cheap, so it is unlimited.

## The three things only an abstract class gives

1. **Instance state.** Fields with any access level, initialized once in
   one place. An interface physically cannot hold per-instance data —
   anything field-shaped in an interface is a `public static final`
   constant, shared by everyone.
2. **Constructors.** Every concrete subclass construction chains through
   the abstract class's constructor
   ([class anatomy](../01-class-anatomy/README.md)), which makes it the one
   place to *enforce* an invariant on shared state:

   ```java
   public abstract class Repository<T> {
       protected final DataSource ds;
       protected Repository(DataSource ds) {
           this.ds = Objects.requireNonNull(ds);   // no subclass can skip this
       }
   }
   ```

3. **Enforced skeletons.** A `final` method calling `protected abstract`
   hooks fixes the algorithm while varying the steps — and *cannot be
   overridden away*. Interfaces have no `final default`; a default method
   is a suggestion, a `final` template method is a rule. Chunk 3 shows the
   pattern in full.

## The tests that decide

- **Do subtypes need shared mutable/protected state or a common
  constructor?** Abstract class — that is the one thing interfaces cannot
  give.
- **Will unrelated classes need this capability?** Interface, necessarily —
  they don't share your base class. `Comparable` works because a `Money`,
  a `Version` and a `LocalDate` need no common parent.
- **Is this a public API others implement?** Interface first; you can add
  `default` methods later without breaking implementors, and callers can
  test against it trivially. (Adding an *abstract* method later breaks
  every implementor — evolution pressure pushes contracts toward
  interfaces plus defaults; chunk 2 has the mechanics.)
- **Must the algorithm be fixed and only the steps vary?** Abstract class
  with a `final` template method — the only construct that *enforces*
  behaviour on subtypes.
- **Both?** The classic pairing: interface as the published contract, an
  abstract skeleton class as optional convenience (`AbstractList` under
  `List` is the JDK's own pattern — chunk 3).
- **When still in doubt: interface.** It spends none of the implementor's
  inheritance budget, couples to no representation, and every migration
  path stays open — an interface can gain a skeleton class later; an
  abstract class cannot retroactively free its subclasses' `extends` slot.

## The JDK's own answers, read as precedent

- `InputStream` is an **abstract class** — buffering state, shared
  plumbing, one representation. Written today it might not be; it predates
  default methods by two decades.
- `Comparable`, `Runnable`, `AutoCloseable` are **interfaces** — pure
  capability, implemented across every hierarchy.
- `List` is an interface, `AbstractList` its optional skeleton — the
  pairing, not a choice of one over the other.
- `Comparator` is an interface that grew `static` factories and `default`
  combinators (`comparing`, `thenComparing`) — the modern shape chunk 2
  dissects.

## Markers: interface with no methods, or annotation?

`Serializable`-style marker interfaces still work: they are
`instanceof`-checkable, usable as generic bounds (`<T extends
Serializable>`), and appear in type positions. Annotations are the modern
tool for pure metadata read reflectively. The line: **if the marker must
participate in the type system, interface; otherwise annotation.**

## Gotchas

**Symptom:** "constant" declared in an interface turns out to be `public static final` — and an implementor's attempt to assign it won't compile
**Cause:** interface fields are implicitly `public static final`; interfaces cannot hold instance state, and the modifiers apply whether written or not
**Fix:** constants in interfaces are fine sparingly; instance state belongs in an abstract class or the implementors

**Symptom:** abstract class marked with no abstract methods — reviewer asks why it exists
**Cause:** it's being used only to block instantiation or share constants
**Fix:** legal but usually wrong shape: a utility class wants a private constructor; shared behaviour with no state wants an interface with defaults

**Symptom:** abstract class constructor "runs" although the class can never be instantiated
**Cause:** every concrete subclass construction chains through it ([class anatomy](../01-class-anatomy/README.md)) — abstract only forbids *direct* `new`
**Fix:** expected; it is exactly where shared-state initialization belongs — and why abstract classes can enforce invariants interfaces cannot

**Symptom:** a published abstract base class can't be adopted — implementors already extend something else
**Cause:** the single-inheritance budget: your abstract class demands the one `extends` slot, and framework classes, mapped superclasses or in-house bases already hold it
**Fix:** publish an interface as the contract; if shared plumbing is worth offering, ship it as an *optional* skeleton class beside the interface, never as the contract itself

**Symptom:** an interface accumulated twelve methods and every implementor stubs half of them with `UnsupportedOperationException`
**Cause:** the interface models a *role* too broadly — it is an abstract class's "shared implementation surface" wearing an interface's name
**Fix:** split into smaller capability interfaces (interface segregation); a type composes the capabilities it really has

**Symptom:** protected helper wanted in an interface; `protected` refuses to compile
**Cause:** interface members are `public` (or `private` since Java 9) — there is no package/protected middle, because interfaces define contracts, not family toolkits
**Fix:** shared helpers for implementors go in the skeleton class, or as `private`/`static` interface methods if they serve the defaults themselves

## Interview questions

**★ When do you choose an abstract class over an interface?**
When subtypes need shared *state*, constructors, or enforced (`final`)
skeleton behaviour — the three things interfaces cannot provide. Everything
contract-shaped defaults to an interface: no inheritance budget spent,
unlimited implementors, testable seams, evolvable via defaults.

**★ Why does Java allow implementing many interfaces but extending only one class?**
Implementation inheritance carries representation: fields, constructor
chains, method bodies. Two parents could supply conflicting *state* and
initialization orders — the classic C++ diamond. Contract inheritance
carries only signatures (and since Java 8, stateless defaults with explicit
conflict rules), so multiplying it is safe. Java rations the expensive
kind to one and leaves the cheap kind unlimited.

**★ An abstract class has no abstract methods. Legal? Sensible?**
Legal — `abstract` only forbids direct instantiation. Sensible rarely: if
it exists to block `new`, a utility class with a private constructor says
that better; if it exists to share behaviour without state, an interface
with defaults does it without spending the subclass's `extends` slot. The
defensible case: a base with state and constructors where every *current*
method happens to have a body.

**★ Why do abstract classes have constructors if you can't instantiate them?**
Because their state must still be initialized: every concrete subclass's
constructor chains up through the abstract class's constructor before
running its own body. That chain is what lets an abstract class *guarantee*
its invariants to every subclass — the enforcement interfaces cannot do.

**Marker interface vs annotation?**
Marker interfaces participate in the type system (`instanceof`, generic
bounds, overload targets); annotations are metadata read reflectively.
Prefer annotations unless the marker must appear where a *type* goes.

**Your team's abstract base class demands `extends BaseService` and adoption is failing. Diagnose.**
The base is charging the highest price in the language — the single
inheritance slot — for what is probably plumbing. Invert it: extract the
contract into an interface, demote the base to an optional skeleton
implementing that interface, and let classes that can't extend it
implement the interface directly (composing a helper if they want the
plumbing).

---

← Index: [Abstract classes vs interfaces](README.md) · Next → [Default methods and the diamond](02-default-methods-and-the-diamond.md)
