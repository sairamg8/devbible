---
title: "Polymorphism and dynamic dispatch"
sidebar_label: "04 · Polymorphism and dispatch"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.12 (method invocation
> expressions, compile-time and run-time steps), the JVMS SE 25
> (`invokevirtual`/`invokeinterface`), and the HotSpot inlining notes in the
> JDK documentation.

**One line — `repository.save(order)` — and two different machines decide what
runs. At compile time, the *static* types pick which method signature (which
overload). At run time, the *dynamic* type of the receiver picks which
implementation (which override). Every framework you will use — Spring
proxies, servlet containers, JDBC drivers, listeners — is an industrial
application of that second step: code written against an interface, behaviour
supplied by whatever object actually arrives.**

## The two-step resolution, precisely

```java
PaymentProcessor p = new StripeProcessor();   // static type: PaymentProcessor
p.charge(order);                              // which charge?
```

1. **Compile time — overload selection.** Using only *static* types
   (`p` is `PaymentProcessor`, `order` is its declared type), the compiler
   picks a method *signature* and burns it into the bytecode
   ([an `invokevirtual`/`invokeinterface` instruction naming it](../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md)).
2. **Run time — override selection.** The JVM looks at the *actual class* of
   the receiver (`StripeProcessor`) and runs the most-derived override of
   that signature.

Only the **receiver** is dynamic. Argument types do *not* participate at run
time — Java has single dispatch, which is exactly why the visitor pattern
exists (it converts a second dispatch into another virtual call).

## What is dynamic, and what is not

| Construct | Bound by | Meaning |
|---|---|---|
| Instance method | **Runtime** receiver class | True overriding — polymorphism |
| `static` method | Compile-time reference type | Hiding, not overriding |
| Field access | Compile-time reference type | Hiding — both fields exist |
| `private` method | Compile time (not inherited) | Internal calls stay internal |
| `final` method | Compile time in effect | No override can exist |
| Constructor | Exact class named by `new` | Never dispatched |
| `super.m()` | Parent implementation, statically | Deliberate dispatch bypass |

The [inheritance page](03-inheritance.md) covers hiding from the
author's side; this table is the caller's side.

## The mental model: one slot table per class

Conceptually every class carries a table: one slot per virtual method
signature, each slot holding the most-derived implementation for that class
(HotSpot calls these vtables/itables). `new StripeProcessor()` stamps the
object with a pointer to `StripeProcessor`'s table; `invokevirtual charge`
means "call slot N of whatever table this object carries". That is why
dispatch cost is a pointer hop, not a search — and why the JIT, once it
observes that a call site only ever meets one class (*monomorphic*), can
devirtualize and inline it, speculatively, with a
[deoptimization](../phase-0-platform-jvm/13-hotspot-internals.md) if a new
class shows up later. Polymorphism is essentially free in warmed-up Java —
paying for it is the JIT's job, not yours.

## Frameworks are dispatch, industrialized

The reason this page is Master tier is not the puzzle questions — it is that
"framework magic" stops being magic once you see the dispatch:

- **Spring DI**: your service depends on `PaymentProcessor`; the container
  injects *some* implementation. Every call is the two-step above. Swapping
  implementations (test doubles included) is just a different table pointer.
- **Spring AOP / `@Transactional`**: the "proxy" is a generated subclass or
  interface implementation whose overrides wrap yours with
  transaction/security/metrics code. It works *because* callers dispatch
  dynamically — and it silently doesn't work on self-invocation
  (`this.method()` bypasses the proxy — phase 10's `@Transactional` trap) or
  on `final`/`private`/`static` methods, which the table above predicts: none
  of them dispatch.
- **Template method / callbacks / listeners**: parent or framework code calls
  an abstract or interface method; your override supplies the behaviour.
  `JpaRepository`, servlet `doGet`, JUnit lifecycle — all this shape.

## The `equals` dispatch question

`equals` is where overloading-vs-overriding stops being trivia:
`equals(Object)` is the virtual slot everything calls — an `equals(MyType)`
overload never dispatches from collections ([inheritance](03-inheritance.md)
gotcha). And *inside* a correct `equals`, the type check itself is a design
decision: `instanceof` (allows subclass equality, risks symmetry breaks) vs
`getClass() == o.getClass()` (strict, breaks proxy frameworks that generate
subclasses). The `equals`/`hashCode` contract page (topic 06 *(not written
yet)*) settles the choice; the dispatch point here is *why* both appear in
real codebases.

## Gotchas

**Symptom:** `process(Object o)` runs instead of `process(Order o)` even though an `Order` was passed
**Cause:** overload selection is compile-time, by the *static* type of the argument expression — it was typed `Object` at the call site
**Fix:** expected behaviour; cast at the call site, or redesign to a single virtual method on the argument's own type (make the `Order` decide)

**Symptom:** `@Transactional`/`@Cacheable` has no effect on a method called from inside the same class
**Cause:** the framework wraps via a dispatching proxy; `this.method()` is a direct call on the raw object — no proxy, no dispatch interception
**Fix:** call through the injected bean (self-injection or restructure); or recognize this as the dispatch table predicting framework behaviour — phase 10 treats the Spring specifics

**Symptom:** mocking/proxying a class "randomly" stopped working after a method was made `final`
**Cause:** proxies override methods; `final` forbids overriding, so the proxy silently can't intercept (some tools warn, some don't)
**Fix:** keep frameworks on interface seams, or leave intercepted methods non-final — a documented convention in Spring codebases

**Symptom:** a `Parent`-typed variable reads the "wrong" field value while method calls hit the right override
**Cause:** methods dispatch on runtime type; fields bind on static type — mixed shadowed fields with overridden methods
**Fix:** never shadow fields; expose state through (virtual) accessors so both channels agree

**Symptom:** "overriding" a static factory in a subclass changes nothing for `Parent.create()` call sites
**Cause:** statics bind by reference type — hiding, not overriding; there is no static polymorphism
**Fix:** model the variability with instances (factory object implementing an interface)

**Symptom:** double dispatch needed — behaviour depends on *both* the receiver and the argument's runtime type
**Cause:** Java is single-dispatch; the argument's runtime type is invisible to overload selection
**Fix:** visitor pattern (second virtual call on the argument), or — modern Java — sealed hierarchy + pattern-matching `switch` (phase 2 topic 09 / phase 1 topic 08), which is usually clearer

**Symptom:** performance review claims virtual calls are slow, demands `final` everywhere
**Cause:** stale intuition — HotSpot profiles call sites and inlines monomorphic/bimorphic ones, deoptimizing if the assumption breaks
**Fix:** write the natural design; let [the JIT](../phase-0-platform-jvm/07-jit-compilation.md) devirtualize. Reserve `final` for *semantic* sealing, not micro-optimization

## Interview questions

**★ Walk through exactly how Java decides what `p.charge(order)` runs.**
Compile time: overload selection using static types of `p` and `order` — a
signature is fixed into the bytecode. Run time: the JVM takes the *actual*
class of the object in `p` and invokes the most-derived override of that
signature. Receiver dynamic, arguments static, single dispatch.

**★ Which members never participate in dynamic dispatch?**
Fields, `static` methods, `private` methods, constructors, and effectively
`final` methods — all bound at compile time. Instance methods alone
dispatch. This one table explains field-hiding surprises, "static
overriding", and why proxies can't intercept final/private methods.

**★ How does Spring's `@Transactional` rely on dispatch — and when does that fail?**
The container hands callers a proxy whose overrides wrap yours with
transaction logic; interception *is* dynamic dispatch. It fails exactly
where dispatch is absent: self-invocation via `this`, and
`final`/`private`/`static` methods.

**★ Why does the visitor pattern exist in Java?**
Single dispatch: only the receiver's runtime type selects behaviour. When
the argument's runtime type must also matter, visitor turns it into a second
virtual call (`element.accept(this)`); sealed types + pattern-matching
`switch` are the modern alternative.

**Is virtual dispatch a performance problem?**
Not in warmed-up code: HotSpot inlines monomorphic and bimorphic call sites
after profiling, guarded by deoptimization. Megamorphic sites (3+ observed
classes) stay as table calls — a JIT-forensics concern, not a design driver.

**`instanceof` vs `getClass()` in `equals` — what's the dispatch angle?**
`instanceof` admits subclasses (including framework-generated proxies) as
equal-capable; `getClass()` demands exact class identity and breaks under
proxying. Which is correct depends on whether the hierarchy adds state —
the `equals` contract topic decides; this page explains why proxies force
the question.

**What is devirtualization?**
The JIT observing that a virtual call site only ever sees one (or two)
receiver classes, replacing the table lookup with a guarded direct call and
inlining it — undone via deoptimization if a new class arrives later.

---

← Prev: [Inheritance](03-inheritance.md) · Next → [Abstract classes vs interfaces](05-abstract-vs-interfaces.md)
