---
title: "Constructors and chaining"
sidebar_label: "2 · Constructors and chaining"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.8 (constructor declarations),
> §8.8.7 (constructor bodies), §8.8.9 (default constructor), and JEP 513
> (Flexible Constructor Bodies, finalized in 25).

**One constructor should hold the real initialization logic; every other
entry point delegates to it. That single decision — the canonical
constructor — is what keeps invariants in one place as overloads accumulate,
and it is the shape records later made mandatory. This chunk is the
delegation machinery: `this(...)`, the Java 25 prologue rules, and the
default constructor's disappearing act.**

## Constructor chaining with `this(...)`

```java
public Money(BigDecimal amount, Currency currency) {   // the canonical one
    this.amount = amount.setScale(currency.getDefaultFractionDigits());
    this.currency = Objects.requireNonNull(currency);
}

public Money(String amount, Currency currency) {
    this(new BigDecimal(amount), currency);            // delegate, don't copy
}
```

Rules: a constructor invokes at most one of `this(...)`/`super(...)`, as its
explicit constructor invocation; chains must not be circular (compile
error); and the *chained-to* constructor runs the field initializers — they
execute exactly once per object, with the constructor that does not
delegate. Copy-pasting initialization across overloads instead of chaining
is how two of them drift apart over the years; the canonical-constructor
funnel is the defense.

Why one canonical constructor matters beyond tidiness: invariants
(`requireNonNull`, scale normalization, range checks) are established in
exactly one place, so no overload — present or future — can construct an
object that skipped them. [Records](../08-records/README.md) hard-wire this:
every record constructor must ultimately delegate to the canonical one.

## Prologues — what Java 25 changed

**Since Java 25 (JEP 513), statements may appear *before* the `this(...)` or
`super(...)` call** — validating arguments or computing values first, which
previously forced awkward static helper methods:

```java
public Order(String rawCustomerId) {
    if (rawCustomerId == null || rawCustomerId.isBlank())
        throw new IllegalArgumentException("customerId required");   // legal in 25
    this(new CustomerId(rawCustomerId.trim()));
}
```

The restriction that remains: the pre-`this()` code cannot *use* `this` —
no reading fields, no instance method calls. The object is not initialized
yet, and the compiler enforces it. (One carve-out the JEP allows: the
prologue may *assign* fields of the class being constructed before an
explicit `super(...)`, which lets a field be definitely set before any
superclass code could observe it — a direct patch over the
constructor-calls-overridable-method hazard in
[inheritance](../03-inheritance/README.md).)

The other half of the fail-fast idiom predates 25 and still matters:
`Objects.requireNonNull(x, "x")` in the constructor body converts a far-away
`NullPointerException` at first use into an immediate one at construction,
with a message naming the argument ([null and
NPE](../../phase-1-language-core/13-null-and-npe/README.md)).

## The default constructor, precisely

A class with **no declared constructor** gets a no-arg default constructor
with the class's access level (JLS §8.8.9 — `public` class, `public`
default constructor; package-private class, package-private one). Declare
*any* constructor and the default disappears — the classic "adding a
convenience constructor broke Jackson / JPA, which needed the no-arg one"
incident. Frameworks that instantiate reflectively document which
constructor they call; when you add one, check what you removed. JPA
explicitly permits the required no-arg constructor to be `protected`, so
you can satisfy the framework without publishing a way to build an invalid
object.

## Overloading constructors — and its ceiling

Constructor overloads resolve like method overloads — by parameter types at
compile time ([overload
resolution](../../phase-1-language-core/10-methods.md)). Two ceilings force
an idiom change:

- **Same-signature alternatives can't exist.** `Money(BigDecimal)` "of
  units" vs `Money(BigDecimal)` "of cents" is unexpressible — the fix is
  named static factories (`Money.ofUnits`, `Money.ofCents` —
  [chunk 3](03-factories-builders-safety.md)).
- **The telescoping-constructor problem.** Optional parameters breed a
  ladder — `(a)`, `(a, b)`, `(a, b, c)`, `(a, b, c, d)` — where call sites
  degenerate into positional soup (`new Pizza(12, true, false, null,
  true)`), same-typed arguments transpose silently, and every new optional
  doubles the ladder. Chaining keeps the ladder *correct* but not
  *readable*. Past two or three optionals, the cure is a
  [builder](03-factories-builders-safety.md), which trades the ladder for
  named, order-free assembly.

## Constructors and failure

A constructor that cannot establish its invariants must throw — an object
that exists is presumed valid everywhere after. Throwing from a constructor
is routine (`IllegalArgumentException`, `NullPointerException` via
`requireNonNull`), and the abandoned half-built object is unreachable and
collected normally. Two things not to do: catch-and-continue into a "mostly
valid" object, and try to compensate in a `finalize`-like hook — resource
cleanup around failed construction belongs to try-with-resources and
factory methods (phase 5 owns the pattern).

## Gotchas

**Symptom:** added a constructor with arguments; Jackson/JPA/`newInstance()` reflection now fails at run time
**Cause:** declaring any constructor removes the implicit default constructor those frameworks were calling
**Fix:** declare the no-arg constructor explicitly (JPA allows it `protected`) alongside your own

**Symptom:** `recursive constructor invocation` compile error
**Cause:** `this(...)` chain forms a cycle
**Fix:** chain strictly toward one canonical constructor that delegates to no one

**Symptom:** on an old JDK, argument validation had to live in an ugly `private static` helper to run before `super(...)`
**Cause:** pre-25, no statements were allowed before an explicit constructor invocation
**Fix:** on 25+, validate directly before `this(...)`/`super(...)` (JEP 513) — remembering the prologue still cannot *read* `this`

**Symptom:** two constructors differing only in parameter *names* won't compile as intended API
**Cause:** overloading is by parameter types; same-type alternatives cannot coexist as constructors
**Fix:** static factory methods with distinct names — the standard idiom for same-signature alternatives

**Symptom:** call site like `new Pizza(12, true, false, null, true)` shipped with two booleans swapped; compiles, wrong pizza
**Cause:** telescoping constructors — positional same-typed optionals carry no names for the compiler to check
**Fix:** a builder with named methods (`.thickCrust().extraCheese()`), or split the type; past 2–3 optionals positional constructors stop being reviewable

**Symptom:** invariant enforced in three of four constructors; the fourth, added later, skips it
**Cause:** initialization copy-pasted across overloads instead of funneled
**Fix:** one canonical constructor owns all invariants; every other constructor (and factory) delegates via `this(...)`

**Symptom:** object constructed despite invalid arguments "so we can log and keep going"
**Cause:** constructor caught its own validation exception and continued
**Fix:** constructors either fully establish invariants or throw; a half-valid object poisons every later use — validate, throw, let the caller decide

## Interview questions

**★ When do you get a default constructor, and how do you lose it?**
Only when the class declares no constructor at all; it takes the class's
access level. Declaring any constructor removes it — the common way to break
reflective frameworks that require no-arg construction.

**★ What changed about constructors in Java 25?**
JEP 513: statements may precede `this(...)`/`super(...)` — argument
validation and computation in place of the old static-helper workaround, and
early field assignment before `super(...)`. The prologue still cannot read
`this` or call instance methods, enforced at compile time.

**★ Why must `this(...)` concerns funnel to one canonical constructor?**
So invariants are established in exactly one place. Copy-pasted
initialization across overloaded constructors is how two of them drift — the
canonical-constructor idiom is also what [records](../08-records/README.md)
made mandatory.

**★ What is the telescoping-constructor problem and what replaces it?**
Optional parameters expressed as an overload ladder: unreadable positional
call sites, silently transposable same-typed arguments, combinatorial
growth. The builder pattern replaces it with named, order-independent
assembly ending in one validated construction.

**Which constructor runs the field initializers when constructors chain?**
The one that does not delegate — the end of the `this(...)` chain.
Initializers run exactly once per object, immediately before that
constructor's body.

**Is throwing from a constructor safe? What happens to the object?**
Yes — it is the correct way to refuse invalid construction. The
partially-initialized object never becomes reachable (unless `this` was
leaked first) and is garbage collected; no special cleanup runs.

**Can a constructor be `final`, `static`, or inherited?**
None of the three. Constructors are not members: not inherited (each class
declares its own), not overridable (so `final` is meaningless), and
inherently per-instance (so `static` is contradictory). A subclass reaches
parent construction only through `super(...)`.

---

← Prev: [The parts and the order](01-the-parts-and-the-order.md) · Next → [Factories, builders and safe construction](03-factories-builders-safety.md)
