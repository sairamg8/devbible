---
title: "Class anatomy and construction"
sidebar_label: "01 · Class anatomy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8 (classes), §8.8.7 (constructor
> bodies), §12.5 (creation of new class instances), and JEP 513 (Flexible
> Constructor Bodies, finalized in 25).

**Construction of a Java object is a fully specified sequence — superclass
first, then field initializers and instance blocks in textual order, then the
constructor body — and half of the "impossible" bugs in object setup are code
observing that sequence mid-flight. Learn the order once and constructor bugs
stop being mysteries; learn the idioms (chaining, static factories) and your
constructors stop being the bug.**

## The parts, and what each is for

```java
public class Order {
    // fields — state; initializers run BEFORE any constructor body
    private final List<OrderLine> lines = new ArrayList<>();
    private OrderStatus status = OrderStatus.NEW;

    // instance initializer block — rare; runs with the field initializers,
    // in textual order. Mostly seen in generated or legacy code
    { audit("order instance created"); }

    // constructors — how callers obtain a valid instance
    public Order(CustomerId customer) {
        this(customer, Instant.now());          // chaining: delegate up front
    }

    public Order(CustomerId customer, Instant placedAt) {
        this.customer = Objects.requireNonNull(customer, "customer");
        this.placedAt = placedAt;
    }

    private final CustomerId customer;
    private final Instant placedAt;
}
```

`this` is the reference to the instance under construction or invocation —
needed to disambiguate (`this.customer = customer`), to chain constructors
(`this(...)`), and to hand the object to someone else (which, from inside a
constructor, is a hazard — below).

## Initialization order — the sequence to memorize

For `new Child()` where `Child extends Parent`, the JLS (§12.5) fixes this
order:

1. **`Parent`'s static initialization** — once per class, at first active use
   ([the JVM at run time](../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)).
2. **`Child`'s static initialization** — same rule.
3. **All instance fields get default values** (`0`, `false`, `null`) — the
   object exists now, memory zeroed.
4. **`Parent`'s field initializers and instance blocks**, in textual order,
   then **`Parent`'s constructor body**.
5. **`Child`'s field initializers and instance blocks**, in textual order,
   then **`Child`'s constructor body**.

Two consequences carry most of the bug weight:

- **A field initializer runs *before* the constructor body.** Assigning the
  field again in the constructor silently discards the initializer's value —
  usually harmless, occasionally a double-allocation, sometimes a real bug
  when the initializer had side effects.
- **During step 4, the `Child` half of the object is still all defaults.**
  Any path that lets `Parent` code observe `Child` state during its
  constructor — most famously calling an overridable method — reads `null`s
  and zeros ([inheritance](03-inheritance.md) owns that gotcha).

## Constructor chaining with `this(...)`

One constructor should hold the real initialization logic; the others
delegate to it with `this(...)`. That keeps invariants in one place:

```java
public Money(BigDecimal amount, Currency currency) {   // the canonical one
    this.amount = amount.setScale(currency.getDefaultFractionDigits());
    this.currency = Objects.requireNonNull(currency);
}

public Money(String amount, Currency currency) {
    this(new BigDecimal(amount), currency);            // delegate, don't copy
}
```

Rules: a constructor invokes at most one of `this(...)`/`super(...)`; chains
must not be circular (compile error); and the *chained-to* constructor runs
the field initializers — they execute exactly once per object, with the
constructor that does not delegate.

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
yet, and the compiler enforces it.

## The default constructor, precisely

A class with **no declared constructor** gets a public no-arg default
constructor (same access as the class, strictly: the default constructor has
the class's access level). Declare *any* constructor and the default
disappears — the classic "adding a convenience constructor broke Jackson /
JPA, which needed the no-arg one" incident. Frameworks that instantiate
reflectively document which constructor they call; when you add one, check
what you removed.

## Static factory methods — the constructor idiom that scales

Constructors have fixed names and always allocate. A `static` factory method
can do better on all axes:

```java
public static Money zero(Currency c)          { return new Money(BigDecimal.ZERO, c); }
public static Money of(String amt, Currency c) { return new Money(amt, c); }
```

- **A name** — `Money.zero(EUR)` reads; `new Money(BigDecimal.ZERO, EUR)`
  doesn't. Two factories can take identical parameter types where two
  constructors could not overload.
- **Caching** — `Integer.valueOf` returns pooled instances (**phase 1's
  autoboxing topic** *(not written yet)*); `List.of()` returns a shared empty
  list.
- **Subtype returns** — the declared return type can hide the concrete class
  (`Collections.unmodifiableList` returns an unnamed implementation).

The cost: not visible in "constructors" documentation sections, and a class
with only private constructors cannot be extended. The convention names —
`of`, `from`, `valueOf`, `getInstance`, `create` — are worth using because
the ecosystem reads them.

## Don't let `this` escape the constructor

Passing `this` out of a constructor — registering with a listener, storing
into a static map, starting a thread with it — publishes a **partially
constructed object**. Another thread (or the callee) can observe default
field values, and `final` fields lose their safe-publication guarantee.
**Designing immutable classes** *(topic 12, not written yet)* treats this
fully; the rule at this page's level: a constructor initializes, and nothing
else.

## Gotchas

**Symptom:** added a constructor with arguments; Jackson/JPA/`newInstance()` reflection now fails at run time
**Cause:** declaring any constructor removes the implicit default constructor those frameworks were calling
**Fix:** declare the no-arg constructor explicitly (JPA allows it `protected`) alongside your own

**Symptom:** a field is set in its initializer and again, differently, in the constructor — initializer value never observed
**Cause:** field initializers run before the constructor body; the body's assignment wins
**Fix:** initialize each field in exactly one place — initializer for constants-per-instance, constructor for parameter-derived values

**Symptom:** value computed in the parent constructor is `null`/`0` even though the child "already set it"
**Cause:** the child's field initializers run *after* the entire parent constructor — parent code observed the defaults from step 3
**Fix:** don't read subclass state from a superclass constructor (usually via an overridable call — see [inheritance](03-inheritance.md)); pass values up as constructor arguments instead

**Symptom:** `recursive constructor invocation` compile error
**Cause:** `this(...)` chain forms a cycle
**Fix:** chain strictly toward one canonical constructor that delegates to no one

**Symptom:** code using `Map<String, String> config = new HashMap<>() {{ put("a", "1"); }};` leaks memory or fails `equals` checks
**Cause:** double-brace "initialization" creates an anonymous *subclass* with an instance initializer — it captures the enclosing instance and its class identity differs
**Fix:** `Map.of(...)` / `Map.copyOf` for literals; a builder or plain `put` calls otherwise

**Symptom:** on an old JDK, argument validation had to live in an ugly `private static` helper to run before `super(...)`
**Cause:** pre-25, no statements were allowed before an explicit constructor invocation
**Fix:** on 25+, validate directly before `this(...)`/`super(...)` (JEP 513) — remembering the prologue still cannot touch `this`

**Symptom:** two constructors differing only in parameter *names* won't compile as intended API
**Cause:** overloading is by parameter types; same-type alternatives cannot coexist as constructors
**Fix:** static factory methods with distinct names — the standard idiom for same-signature alternatives

## Interview questions

**★ Narrate everything that happens during `new Child(x)` where `Child extends Parent`.**
Static init of `Parent` then `Child` (first use only); fields of the whole
object default-initialized; `Parent` field initializers + instance blocks in
textual order, then `Parent` constructor body; then the same pair for
`Child`. Superclass completes before subclass state exists — which is why
overridable calls from constructors are bugs.

**★ When do you get a default constructor, and how do you lose it?**
Only when the class declares no constructor at all; it matches the class's
access level. Declaring any constructor removes it — the common way to break
reflective frameworks that require no-arg construction.

**★ Why prefer a static factory method over a constructor?**
Names that document intent, the ability to offer same-signature alternatives,
instance caching (`valueOf`), returning subtypes or interfaces, and a
placement for preprocessing before delegation. Constructors win where
subclassing or framework conventions require them.

**★ What changed about constructors in Java 25?**
JEP 513: statements may precede `this(...)`/`super(...)` — argument
validation and computation in place of the old static-helper workaround. The
prologue still cannot access `this`, enforced at compile time.

**What is an instance initializer block and when does it run?**
A `{ ... }` block at class level; it runs with the field initializers, in
textual order, before the constructor body, once per construction — for every
constructor that doesn't delegate via `this(...)`. Rare in hand-written code;
know it to read generated and legacy classes.

**Why must `this(...)` concerns funnel to one canonical constructor?**
So invariants are established in exactly one place. Copy-pasted
initialization across overloaded constructors is how two of them drift — the
canonical-constructor idiom is also what records made mandatory (**records**,
topic 08 *(not written yet)*).

**Can a constructor call a `final` or `private` method safely?**
Yes — neither can be overridden, so the call cannot land in an uninitialized
subclass. That is the standard escape when a constructor genuinely needs a
helper method.

---

← Index: [Phase 2 — Classes and objects](README.md) · Next → [Encapsulation and access modifiers](02-encapsulation-access.md)
