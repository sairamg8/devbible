---
title: "The parts and the order"
sidebar_label: "1 · The parts and the order"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.3 (field declarations), §8.6
> (instance initializers), §12.4 (initialization of classes), and §12.5
> (creation of new class instances).

**An object is not "created" in one step. The JLS specifies a sequence —
class initialization, zeroed memory, superclass construction, field
initializers in textual order, constructor body — and every step is
observable if code runs at the wrong moment. This chunk is the sequence to
memorize; the bugs it explains keep the rest of the topic honest.**

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
constructor, is a hazard — [chunk 3](03-factories-builders-safety.md)).

A field's declaration position is meaningful only for *initializer order* —
declaring `customer` at the bottom of the class, as above, is legal and the
constructor may assign it; what a field initializer may not do is read a
field declared *after* it (illegal forward reference, JLS §8.3.3).

## Class initialization comes first — once, lazily

Before any instance exists, the *class* initializes (JLS §12.4): static
fields get their initializers and `static { }` blocks run, in textual order,
at **first active use** — first instantiation, first static-member access,
not at JVM startup ([the JVM at run
time](../../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)).
Superclass static init runs before subclass static init. Two facts worth
keeping:

- **It runs once per class per classloader, under a JVM-managed lock** —
  which is why the initialization-on-demand holder idiom is a correct lazy
  singleton with zero synchronization code of your own.
- **A cycle between two classes' static initializers doesn't deadlock — it
  reads half-initialized statics.** Class `A`'s static init touches `B`,
  whose static init touches `A`: the JVM lets the re-entrant reference
  through, and `B` observes `A`'s statics as they are *mid-initialization* —
  possibly `null`/`0`. The fix is structural: break the cycle.

## Instance initialization — the sequence to memorize

For `new Child()` where `Child extends Parent`, the JLS (§12.5) fixes this
order:

1. **`Parent`'s static initialization** — once per class, at first active use.
2. **`Child`'s static initialization** — same rule.
3. **All instance fields get default values** (`0`, `false`, `null`) — the
   object exists now, memory zeroed. This includes the `Parent` *and*
   `Child` halves at once.
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
  and zeros ([inheritance](../03-inheritance/README.md) owns that gotcha).

## Instance initializer blocks, precisely

A `{ ... }` block at class level runs *with* the field initializers, in
textual order — a block above a field initializer runs before it, one below
runs after. Every constructor that does not delegate with `this(...)`
effectively gets the compiled initializer code inlined ahead of its body.
Legitimate uses are thin: shared setup across many constructors before
records and chaining made that rare, and anonymous classes (which cannot
declare constructors at all — an initializer block is their only option).
Recognize them in generated and legacy code; rarely write them.

## Field shadowing — one name, two fields

A field declared in `Child` with the same name as a field in `Parent` does
not replace it — **both fields exist on every `Child` instance**, and which
one an expression reads is decided at *compile time* by the static type of
the reference:

```java
class Parent { protected int size = 10; }
class Child extends Parent { protected int size = 20; }   // shadows — both exist

Child  c = new Child();
Parent p = c;                 // same object
// c.size is 20, p.size is 10 — chosen by reference type, not object
```

Fields never dispatch dynamically ([inheritance's hiding
rules](../03-inheritance/README.md)). Shadowing is legal and almost always an
accident — a parent adding a field can silently shadow-collide with a
subclass written years earlier, and no warning is required. Keep parent
fields `private` and the collision cannot occur, because private fields are
invisible to subclasses.

The local flavour: a constructor parameter named like a field shadows it
inside the constructor body, which is exactly why the `this.customer =
customer` idiom exists rather than being a style choice.

## Gotchas

**Symptom:** a field is set in its initializer and again, differently, in the constructor — initializer value never observed
**Cause:** field initializers run before the constructor body; the body's assignment wins
**Fix:** initialize each field in exactly one place — initializer for constants-per-instance, constructor for parameter-derived values

**Symptom:** value computed in the parent constructor is `null`/`0` even though the child "already set it"
**Cause:** the child's field initializers run *after* the entire parent constructor — parent code observed the defaults from step 3
**Fix:** don't read subclass state from a superclass constructor (usually via an overridable call — see [inheritance](../03-inheritance/README.md)); pass values up as constructor arguments instead

**Symptom:** `illegal forward reference` compile error on a field initializer
**Cause:** an initializer reads, by simple name, a field declared textually below it (JLS §8.3.3)
**Fix:** reorder the declarations, or move the dependent computation into the constructor, where all initializers have already run

**Symptom:** a static field of another class reads as `null` during your class's static initializer, though it is "definitely assigned"
**Cause:** a static-initialization cycle — the other class's init re-entered yours mid-flight and saw pre-init values
**Fix:** break the cycle: move the shared value to a third class, or defer the read to first use instead of class-init time

**Symptom:** same expression reads different values for `obj.size` depending on the declared type of the variable holding `obj`
**Cause:** field shadowing — parent and child each declare `size`; fields bind by static type, both are alive on the object
**Fix:** never shadow a parent field; rename one. Parent fields kept `private` make the collision impossible

**Symptom:** code using `Map<String, String> config = new HashMap<>() {{ put("a", "1"); }};` leaks memory or fails `equals` checks
**Cause:** double-brace "initialization" creates an anonymous *subclass* with an instance initializer — it captures the enclosing instance and its class identity differs
**Fix:** `Map.of(...)` / `Map.copyOf` for literals; a builder or plain `put` calls otherwise

## Interview questions

**★ Narrate everything that happens during `new Child(x)` where `Child extends Parent`.**
Static init of `Parent` then `Child` (first use only); fields of the whole
object default-initialized; `Parent` field initializers + instance blocks in
textual order, then `Parent` constructor body; then the same pair for
`Child`. Superclass completes before subclass state exists — which is why
overridable calls from constructors are bugs.

**★ When does static initialization run, and what guarantees does it come with?**
At first active use of the class, once per classloader, superclass before
subclass, under a JVM lock — which makes the holder idiom a free
thread-safe lazy singleton. The guarantee has one hole: initialization
cycles are let through re-entrantly and observe half-initialized statics.

**★ What is field shadowing and why does keeping fields `private` prevent it?**
A subclass field with a parent field's name creates a second field; reads
bind to the reference's compile-time type, so the "same" field yields
different values through different reference types. `private` parent fields
are not inherited names, so no shadowing relationship can form.

**What is an instance initializer block and when does it run?**
A `{ ... }` block at class level; it runs with the field initializers, in
textual order, before the constructor body, once per construction — for every
constructor that doesn't delegate via `this(...)`. Rare in hand-written code;
know it to read generated classes, and it is the only initialization hook an
anonymous class has.

**Why is `this.field = field` needed in constructors at all?**
The parameter shadows the field inside the constructor body; the bare name
binds to the nearest declaration. `this.` re-qualifies the left side to the
instance field. It's the benign, idiomatic face of the same shadowing rule
that makes duplicate *inherited* fields a bug.

**In what order do a field initializer and an initializer block run?**
Textual order — they interleave. The compiler concatenates them top-to-bottom
into every non-delegating constructor ahead of its body.

---

← Index: [Class anatomy](README.md) · Next → [Constructors and chaining](02-constructors-and-chaining.md)
