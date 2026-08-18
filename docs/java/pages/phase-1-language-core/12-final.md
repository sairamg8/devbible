---
title: "final: what it prevents, and what it doesn't"
sidebar_label: "12 · final"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §4.12.4 (final variables), §8.3.1.2
> (final fields), §8.4.3.3 (final methods), §8.1.1.2 (final classes), and
> §17.5 (final field semantics in the memory model).

**`final` means "assigned exactly once" — and that is *all* it means. On a
local it forbids reassignment; on a field it demands assignment by the end of
construction; on a method it forbids overriding; on a class it forbids
subclassing. What it never does is make the referenced *object* immutable: a
`final List` can still be added to all day. Knowing precisely which promise
each placement makes — and which promise people wrongly assume — is the whole
topic.**

## The four placements

| Placement | Prevents | Does **not** prevent |
|---|---|---|
| local / parameter | reassigning the variable | mutating the object it points to |
| field | reassignment after construction | mutating the object it points to |
| method | overriding in subclasses | overloading, hiding by statics |
| class | subclassing entirely | anything about instances' mutability |

## Final variables and parameters

A `final` local must be assigned exactly once on every path; the compiler
enforces *definite assignment*:

```java
final int limit;
if (premium) limit = 100;
else         limit = 10;      // both branches assign → compiles
// limit = 5;                 // second assignment → compile error
```

Final parameters (`void process(final Order order)`) prevent only reassigning
the parameter *variable inside the method* — the caller is unaffected either
way, because Java passes copies of references. Most teams skip
`final` on parameters as noise and let a linter ban parameter reassignment
instead; the value is real but the keyword-per-parameter cost is high.

## Final fields — the strongest of the four

An instance field marked `final` must be assigned by the time every
constructor finishes (a *blank final* assigned in the constructor is the
normal shape). Beyond compiler enforcement, final fields carry a **memory
model guarantee** (JLS §17.5): if the object is not leaked during
construction, any thread that later sees the object sees its final fields
fully initialized — no synchronization needed. This "safe publication for
free" is the mechanical reason immutable objects (Phase 2's design topic, and
the payoff in Phase 6) are trivially thread-safe, and it is a promise plain
mutable fields do not make.

```java
public class Money {
    private final BigDecimal amount;   // assigned once, visible safely everywhere
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = Objects.requireNonNull(amount);
        this.currency = Objects.requireNonNull(currency);
    }
}
```

## Final methods and final classes

- A **final method** cannot be overridden. Use it when a superclass method is
  part of an invariant subclasses must not break. In practice it is rare in
  application code — composition (Phase 2) usually beats a hierarchy
  policed with `final`.
- A **final class** cannot be extended at all. `String`, `Integer` and every
  **record** are final; the platform uses it to make immutability and
  security reasoning airtight — nobody can subclass `String` and slip a
  mutable impostor into your `Map` keys. For your own code, a class not
  *designed* for extension is honest to mark final: "design and document for
  inheritance, or prohibit it."

## Effectively final — lambdas and inner classes

A lambda or anonymous class may capture a local variable only if it is final
or *effectively final* (never reassigned after initialization). The rule
exists because the lambda may run later, on another thread, after the
enclosing frame is gone — Java copies the value, and forbidding reassignment
keeps the copy honest:

```java
int count = 0;
orders.forEach(o -> count++);   // compile error: count must be effectively final
```

The error is guiding you somewhere better: a stream with a collector, an
`AtomicInteger` if shared mutation is genuinely the point, or a plain loop.

## What final is not

- **Not deep immutability.** `final List<Item> items` forbids `items = other`
  and permits `items.add(...)`. Immutability is a *design* property — final
  fields **plus** immutable/defensively-copied contents (Phase 2's immutable
  classes topic owns the recipe).
- **Not a performance switch.** The JIT devirtualizes and inlines based on
  what is *actually loaded*, not on the keyword; adding `final` "for speed"
  is folklore. The exception is `static final` compile-time constants of
  primitives and strings, which `javac` inlines — with the stale-constant
  consequence covered in
  [source to bytecode](../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md).
- **Not visibility.** Writes to a non-final field of a final-field-holding
  object still need synchronization; §17.5 covers only the final fields
  themselves as of construction's end.

## Gotchas

**Symptom:** a `final` collection field changed contents in production
**Cause:** final fixes the reference, not the object — `add`/`put`/`remove` were never forbidden
**Fix:** store an immutable copy (`List.copyOf(input)`) in the final field; then both the reference *and* the contents are fixed

**Symptom:** "local variables referenced from a lambda expression must be final or effectively final"
**Cause:** the lambda captures a local that is reassigned somewhere in the method
**Fix:** restructure — collector/reduction for accumulation, a new final local per value, or an explicit loop. Reaching for a one-element array to smuggle mutation in is defeating the safety, not using it

**Symptom:** blank final field — "variable might not have been initialized" on one constructor only
**Cause:** definite assignment is per-path: a constructor (or a branch inside one) misses the assignment
**Fix:** assign in every constructor, or chain constructors with `this(...)` so one canonical constructor does all final-field assignment

**Symptom:** marked a method's parameters final expecting callers to be constrained
**Cause:** pass-by-value — the parameter is the method's own copy of the reference; finality of the copy is invisible to callers
**Fix:** nothing to fix externally; use final params (or a linter rule) purely as internal discipline

**Symptom:** changed a `static final int` in a library; consumers still see the old value after redeploy
**Cause:** compile-time constants are inlined into consumers' bytecode by `javac`
**Fix:** recompile consumers, or don't expose values that may change as compile-time constants — a static method breaks the inlining

**Symptom:** a class needs mocking in tests but Mockito refuses
**Cause:** the class (or method) is final — and standard proxy-based mocking subclasses
**Fix:** Mockito's inline mock maker handles finals now, but the friction is feedback: depend on an interface at that boundary, or don't mock a value type at all — construct the real thing

## Interview questions

**★ What does `final` guarantee on a field — and what does it not?**
Assigned exactly once, by the end of construction, plus the §17.5 memory-model
guarantee: threads that see the object see its final fields initialized,
without synchronization, provided `this` didn't escape the constructor. It
does *not* make the referenced object immutable.

**★ Why must lambda-captured locals be effectively final?**
The lambda may outlive the stack frame, so Java captures a *copy* of the
value. Allowing reassignment would let the variable and its captured copy
silently diverge; the rule keeps them provably identical.

**★ Is `final` a performance optimization?**
Effectively no. The JIT makes inlining/devirtualization decisions from
observed class hierarchies at run time, keyword or not. Only `static final`
compile-time constants change generated code — via `javac` inlining, which is
about semantics (and the stale-constant trap), not speed.

**★ Why are `String` and records final classes?**
So their immutability cannot be subverted by a subclass. A mutable
`String` subclass would break hash-based collections, security checks and
interning; finality makes "a `String` is immutable" a theorem instead of a
convention.

**How do `final`, immutability and thread safety relate?**
`final` on every field is the *mechanism*; immutability adds immutable or
defensively-copied contents and no leaked `this`; thread safety then follows
for free — an object no thread can mutate needs no synchronization. That
chain is Phase 2 design paying Phase 6 rent.

**When would you mark a method final?**
When it encodes an invariant that overriding would break — template-method
steps, security checks. Sparingly: if you find yourself policing subclasses
with `final`, composition usually models the constraint better.

---

← Prev: [`static`](11-static/README.md) · Next → [`null` and `NullPointerException`](13-null-and-npe/README.md)
