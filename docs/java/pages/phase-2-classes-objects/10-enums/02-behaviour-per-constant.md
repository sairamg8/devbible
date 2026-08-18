---
title: "Behaviour per constant"
sidebar_label: "2 · Behaviour per constant"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JLS §8.9.1–§8.9.3 (enum constants, enum bodies,
> enum members) and the `java.lang.Enum` Javadoc (JDK 25). The state-machine
> and strategy shapes are the standard forms from Effective Java's enum
> items, checked against the JLS rules they rely on.

**The moment an enum gets a field, a constructor, or a per-constant method
body, it stops being a constants file and becomes what it really is: a
class with a fixed instance population. That fixed population is the
superpower — behaviour that varies by constant can live *on* the constant,
so the "which case am I in?" dispatch that would otherwise be a `switch`
scattered across five call sites becomes a single method call that cannot
miss a case.**

## Fields and constructors

Constants may carry data. The constructor runs once per constant, at class
initialization, in declaration order:

```java
public enum Currency {
    USD("US Dollar", 2),
    JPY("Japanese Yen", 0),
    BHD("Bahraini Dinar", 3);

    private final String displayName;
    private final int defaultScale;

    Currency(String displayName, int defaultScale) {
        this.displayName = displayName;
        this.defaultScale = defaultScale;
    }

    public String displayName() { return displayName; }
    public int defaultScale()   { return defaultScale; }
}
```

Rules worth knowing:

- The constructor is **implicitly private** — writing `public` or
  `protected` on it is a compile error.
- **Make the fields `final`.** The language does not force it, but a
  mutable field on an enum is *global mutable state with a constant's
  respectability* — visible to every thread, cached in every map. Phase 1's
  `static` topic explains why that ruins tests; enums make it worse by
  looking innocent.
- Arguments are evaluated per constant at class init — keep constructors
  cheap and side-effect-free; they run even if only one constant is ever
  touched.

## Per-constant method bodies

A constant can override methods in a body of its own:

```java
public enum Operation {
    PLUS("+") {
        public BigDecimal apply(BigDecimal a, BigDecimal b) { return a.add(b); }
    },
    MINUS("-") {
        public BigDecimal apply(BigDecimal a, BigDecimal b) { return a.subtract(b); }
    },
    TIMES("*") {
        public BigDecimal apply(BigDecimal a, BigDecimal b) { return a.multiply(b); }
    };

    private final String symbol;
    Operation(String symbol) { this.symbol = symbol; }
    public String symbol() { return symbol; }

    public abstract BigDecimal apply(BigDecimal a, BigDecimal b);
}
```

Mechanically, each braced constant compiles to an **anonymous subclass** of
the enum — the one exception to "enums are final". Two consequences:

- An `abstract` method in the enum **forces every constant to implement
  it** — add a constant, forget the body, and it's a compile error. This is
  exhaustiveness at the definition site, the mirror image of `switch`
  exhaustiveness at the use site. Prefer whichever puts the behaviour where
  it is most readable: bodies when behaviour belongs to the concept,
  `switch` when the enum shouldn't know about the caller's domain.
- `getClass()` on such a constant returns the anonymous subclass, **not**
  the enum class. Use `getDeclaringClass()` (or `instanceof Operation`)
  when you need "which enum type is this" — a real bug in reflection-based
  code and hand-rolled `getClass()` equality checks.

## Enums implementing interfaces — the strategy table

An enum can implement any interface, which makes it a closed, named,
iterable set of strategies:

```java
public interface FeeCalculator {
    BigDecimal feeFor(BigDecimal amount);
}

public enum PaymentMethod implements FeeCalculator {
    CARD {
        public BigDecimal feeFor(BigDecimal amount) {
            return amount.multiply(new BigDecimal("0.029")).add(new BigDecimal("0.30"));
        }
    },
    BANK_TRANSFER {
        public BigDecimal feeFor(BigDecimal amount) { return new BigDecimal("0.50"); }
    },
    STORE_CREDIT {
        public BigDecimal feeFor(BigDecimal amount) { return BigDecimal.ZERO; }
    };
}
```

Call sites hold a `FeeCalculator` and never switch:
`method.feeFor(order.total())`. Compared to a `Map<PaymentMethod,
FeeCalculator>` wired up in a config class, the enum-as-strategy keeps the
pairing compiler-checked — a new method *cannot* forget its fee logic.
When the strategies need dependencies (a repository, a clock), the enum
form stops fitting: constants are constructed at class init with no access
to your DI container. That is the honest boundary — behaviour that needs
injected collaborators belongs in real classes keyed *by* the enum
(`EnumMap<PaymentMethod, FeeCalculator>` built in a Spring config — chunk 3).

## The worked example: an order-status state machine

The phase gate's shape. Transitions live on the enum, so "what is legal" is
one readable declaration instead of `if`-chains in every handler:

```java
public enum OrderStatus {
    NEW       { Set<OrderStatus> next() { return EnumSet.of(PAID, CANCELLED); } },
    PAID      { Set<OrderStatus> next() { return EnumSet.of(SHIPPED, REFUNDED); } },
    SHIPPED   { Set<OrderStatus> next() { return EnumSet.of(DELIVERED); } },
    DELIVERED { Set<OrderStatus> next() { return EnumSet.noneOf(OrderStatus.class); } },
    CANCELLED { Set<OrderStatus> next() { return EnumSet.noneOf(OrderStatus.class); } },
    REFUNDED  { Set<OrderStatus> next() { return EnumSet.noneOf(OrderStatus.class); } };

    abstract Set<OrderStatus> next();

    public boolean canTransitionTo(OrderStatus target) {
        return next().contains(target);
    }

    public OrderStatus transitionTo(OrderStatus target) {
        if (!canTransitionTo(target)) {
            throw new IllegalStateException(
                "Illegal order transition " + this + " -> " + target);
        }
        return target;
    }
}
```

Notes that make this production-grade rather than a demo:

- **Terminal states return an empty set explicitly** — absence of a case is
  a decision you can see, not a `default` swallowing new constants.
- The transition sets are built per call here for clarity; a constructor
  taking the set is tempting but hits the *illegal forward reference*
  rule — `NEW`'s constructor cannot mention `PAID`, which doesn't exist
  yet. Method bodies (evaluated lazily, after class init) are the standard
  workaround; a static `Map<OrderStatus, Set<OrderStatus>>` built in a
  static initializer is the other.
- The exception names both ends of the transition — the log line from
  production is diagnosable without a debugger.

## Gotchas

**Symptom:** `IllegalStateException`-free code review, but a new `ON_HOLD` status ships and three handlers silently ignore it
**Cause:** behaviour was dispatched with `switch` + `default` instead of an abstract method
**Fix:** abstract method per constant (definition-site exhaustiveness) or `default`-free switch expressions (use-site — chunk 3); either turns the missed case into a compile error

**Symptom:** `op.getClass() == Operation.class` is false for some constants
**Cause:** constants with bodies are anonymous subclasses
**Fix:** `getDeclaringClass()` — it exists precisely for this

**Symptom:** enum constructor referencing another constant fails with "illegal forward reference" (or a null field at runtime via a static map)
**Cause:** constants initialize strictly in declaration order; earlier ones cannot see later ones during construction
**Fix:** defer the cross-references — lazy method bodies, or a static initializer that runs after all constants exist

**Symptom:** unit tests pass individually, fail as a suite, with an enum's field carrying a value from a previous test
**Cause:** a non-final field on an enum constant is JVM-global mutable state
**Fix:** make enum fields final; state that varies at runtime belongs on objects with a lifecycle, keyed by the enum if needed

**Symptom:** enum-as-strategy needs a repository and someone reaches for a static setter to inject it
**Cause:** constants are constructed at class init, outside any DI container
**Fix:** invert it — strategies become Spring beans, wired into an `EnumMap<Method, Strategy>`; the enum stays pure data + pure logic

**Symptom:** class initialization of the enum is mysteriously slow or throws `ExceptionInInitializerError`
**Cause:** heavy or failing work in constructors, which all run eagerly at first touch of the class
**Fix:** constructors assign fields only; anything that can fail or block moves to lazy methods or an external service

**Symptom:** two constants need the same method body and it's copy-pasted into both braces
**Cause:** per-constant bodies can't share code between themselves directly
**Fix:** put the shared logic in a private instance method on the enum and have both bodies delegate — or collapse to a field + one method if the "behaviour" is really data

## Interview questions

**★ How do you attach different behaviour to each enum constant, and why prefer it over `switch`?**
Declare an abstract method and give each constant a body — each compiles to
an anonymous subclass overriding it. Adding a constant without the body is
a compile error, so behaviour can never silently miss a case; a `switch`
with `default` fails only at runtime, if at all.

**★ When is a `switch` over the enum better than a per-constant body?**
When the behaviour belongs to the *caller's* domain, not the concept — an
enum in a domain module shouldn't carry rendering logic for one UI. Use a
`default`-free `switch` expression so exhaustiveness is still checked, just
at the use site.

**★ Why can't `NEW`'s constructor reference `PAID`?**
Constants construct in declaration order during class initialization;
`PAID` doesn't exist while `NEW` is being built, so the JLS makes it an
illegal forward reference. Defer the reference: lazy method bodies or a
static initializer after all constants.

**★ Enum-as-strategy vs a `Map<Enum, Strategy>` — trade-offs?**
On-enum strategies are compiler-checked complete and self-documenting, but
can't take injected dependencies (constants build at class init). Map-based
strategies integrate with DI and can vary by environment, but completeness
is your job — an `EnumMap` plus a startup assertion that every constant has
an entry recovers most of the safety.

**★ Design an order-status machine where illegal transitions can't happen silently.**
Transitions declared on the enum (abstract `next()` per constant returning
an `EnumSet`), a `transitionTo` that throws a named exception, terminal
states returning the empty set explicitly, and a test that walks
`values()` asserting each constant's transition set — so a new status
forces both a body (compile error) and a test update.

**Why must enum fields be final when the language doesn't require it?**
Each constant is a process-wide singleton; a mutable field on it is global
mutable state shared by every thread and every test. Finality restores the
"constants are constant" assumption everyone reading the code already has.

**What does `getDeclaringClass()` do that `getClass()` doesn't?**
For a constant with a body, `getClass()` is the anonymous subclass;
`getDeclaringClass()` returns the enum type itself. Reflection, persistence
mappers and hand-written type checks need the latter.

---

← Prev: [The machinery](01-the-machinery.md) · Index: [Enums](README.md) · Next → [Collections, boundaries, persistence](03-collections-boundaries-persistence.md)
