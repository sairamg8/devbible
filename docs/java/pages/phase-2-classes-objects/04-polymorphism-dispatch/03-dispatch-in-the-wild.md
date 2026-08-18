---
title: "Dispatch in the wild: frameworks, equals, and the visitor question"
sidebar_label: "3 · Dispatch in the wild"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 6.2 reference (proxying
> mechanisms, `@Transactional` self-invocation caveat), the JLS SE 25 §15.12,
> JEP 441 (pattern matching for `switch`, final in 21), and the JDK 25 API
> documentation.

**The reason this topic is Master tier is not the puzzle questions — it is
that "framework magic" stops being magic once you see the dispatch. Spring
injecting a bean, `@Transactional` opening a transaction, JUnit finding your
test, a servlet container calling `doGet`: every one is the same mechanism —
code written against a type you declared, behaviour supplied by whatever
object actually arrived. And every famous framework failure mode —
self-invocation, `final` methods, proxy identity — is a row of the
what-dispatches table predicting reality.**

## Frameworks are dispatch, industrialized

- **Spring DI**: your service depends on `PaymentProcessor`; the container
  injects *some* implementation. Every call is the two-step from
  [chunk 1](01-the-two-machines.md). Swapping implementations (test doubles
  included) is just a different table pointer.
- **Spring AOP / `@Transactional`**: the "proxy" is a generated subclass or
  interface implementation whose overrides wrap yours with
  transaction/security/metrics code. It works *because* callers dispatch
  dynamically — and it silently doesn't work on self-invocation
  (`this.method()` bypasses the proxy — **Phase 10's `@Transactional` trap**
  *(not written yet)*) or on `final`/`private`/`static` methods, which the
  table predicts: none of them dispatch.
- **Template method / callbacks / listeners**: parent or framework code calls
  an abstract or interface method; your override supplies the behaviour.
  `JpaRepository`, servlet `doGet`, JUnit lifecycle — all this shape.
  ([Topic 05](../05-abstract-vs-interfaces/README.md) covers when the
  skeleton should be an abstract class.)

The practical consequences run in both directions. Because interception *is*
overriding, a proxying framework can only intercept what can be overridden —
keep framework-managed seams on interfaces or open methods. And because the
proxy is a *different object* wrapping yours, identity-sensitive code
(`getClass()`, `==`, locking on `this`) can observe the wrapper where it
expected the target.

## The `equals` dispatch question

`equals` is where overloading-vs-overriding stops being trivia:
`equals(Object)` is the virtual slot everything calls — an `equals(MyType)`
overload never dispatches from collections
([inheritance](../03-inheritance/README.md) gotcha). And *inside* a correct
`equals`, the type check itself is a design decision: `instanceof` (allows
subclass equality, risks symmetry breaks) vs `getClass() == o.getClass()`
(strict, breaks proxy frameworks that generate subclasses). The
[`equals`/`hashCode` contract](../06-equals-hashcode/README.md) settles the
choice; the dispatch point here is *why* both appear in real codebases.

## Single dispatch, double dispatch, and the modern answer

Java dispatches on **one** runtime type: the receiver's. When behaviour
depends on *two* runtime types — a `Shape` intersecting a `Shape`, an
exporter rendering every node of a document tree — you have the
double-dispatch problem, and Java's classical answer is the **visitor
pattern**: the first virtual call (`node.accept(visitor)`) recovers the
node's runtime type, and the callback (`visitor.visit(this)`) uses overload
selection *on a now-precise static type* to reach the right handler. Two
single dispatches, composed.

```java
sealed interface PaymentResult permits Approved, Declined, Failed {}

// Classic OO: behaviour lives in the hierarchy — extending behaviour = new method everywhere
// Visitor: behaviour lives outside — extending the hierarchy = touch every visitor

// Modern Java, since 21 — the third option:
String message = switch (result) {
    case Approved a -> "Charged " + a.amount();
    case Declined d -> "Declined: " + d.reason();
    case Failed f   -> "Retry after " + f.backoff();
};   // exhaustive: adding a Refunded case breaks THIS switch at compile time
```

For **closed** hierarchies, [sealed types](../09-sealed-adts.md) +
pattern-matching `switch`
([Phase 1's switch topic](../../phase-1-language-core/08-control-flow-switch/README.md))
replace the visitor's ceremony with a compiler-checked expression — the
exhaustiveness the visitor only enforced by convention. The decision rule:

| Hierarchy is… | Behaviour set is… | Reach for |
|---|---|---|
| Open (plugins, unknown subclasses) | fixed | virtual methods on the hierarchy |
| Open | growing | visitor (accept/visit) |
| **Closed (sealed)** | growing | **pattern-matching `switch`** |
| Closed | fixed | either; prefer switch for locality |

## Gotchas

**Symptom:** `@Transactional`/`@Cacheable` has no effect on a method called from inside the same class
**Cause:** the framework wraps via a dispatching proxy; `this.method()` is a direct call on the raw object — no proxy, no dispatch interception
**Fix:** call through the injected bean (self-injection or restructure); or recognize this as the dispatch table predicting framework behaviour — phase 10 treats the Spring specifics

**Symptom:** mocking/proxying a class "randomly" stopped working after a method was made `final`
**Cause:** proxies override methods; `final` forbids overriding, so the proxy silently can't intercept (some tools warn, some don't)
**Fix:** keep frameworks on interface seams, or leave intercepted methods non-final — a documented convention in Spring codebases

**Symptom:** double dispatch needed — behaviour depends on *both* the receiver and the argument's runtime type
**Cause:** Java is single-dispatch; the argument's runtime type is invisible to overload selection
**Fix:** visitor pattern (second virtual call on the argument), or — modern Java — sealed hierarchy + pattern-matching `switch` ([topic 09](../09-sealed-adts.md) / [Phase 1 topic 08](../../phase-1-language-core/08-control-flow-switch/README.md)), which is usually clearer

**Symptom:** `getClass()` on an injected bean returns `OrderService$$SpringCGLIB$$0`, breaking a `getClass()`-based `equals` or a registry keyed by class
**Cause:** the container handed you a generated subclass (the proxy); `getClass()` sees the wrapper's class, not yours
**Fix:** key on interfaces or use framework utilities to unwrap; in `equals`, this is the argument for `instanceof` over `getClass()` in proxy-heavy codebases ([topic 06](../06-equals-hashcode/README.md))

**Symptom:** a listener registered in a constructor receives events before the object is fully built — intermittent NPEs under load
**Cause:** registering `this` in the constructor leaks a partially-constructed object into code that will make virtual calls on it ([chunk 1's](01-the-two-machines.md) constructor rule, distributed)
**Fix:** register after construction — factory method or lifecycle callback; [immutable design](../12-immutable-design/README.md) covers safe publication

**Symptom:** visitor implementation compiles but the wrong `visit` overload runs for a subtype added later
**Cause:** the `accept` methods weren't added to the new subtype, so it inherits a parent's `accept` — the callback's static type is the *parent*, and overload selection (compile-time) picks the parent handler
**Fix:** every concrete node overrides `accept(v) { v.visit(this); }` — the pattern only works when the `this` at each level has the precise static type; or migrate closed hierarchies to sealed + `switch`, where the compiler enforces the case list

## Interview questions

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

**★ `instanceof` vs `getClass()` in `equals` — what's the dispatch angle?**
`instanceof` admits subclasses (including framework-generated proxies) as
equal-capable; `getClass()` demands exact class identity and breaks under
proxying. Which is correct depends on whether the hierarchy adds state —
the `equals` contract topic decides; this page explains why proxies force
the question.

**★ When do you choose virtual methods vs visitor vs pattern-matching `switch`?**
By which axis grows. Open hierarchy + fixed behaviour: virtual methods.
Open hierarchy + growing behaviour: visitor. Closed (sealed) hierarchy:
pattern-matching `switch`, which gives compile-checked exhaustiveness the
others can't — a new case breaks every switch, loudly.

**Why do proxying frameworks prefer interface seams?**
An interface proxy (`invokeinterface` on a generated implementation)
intercepts every method by construction; a subclass proxy cannot intercept
`final`/`private`/`static` members and changes `getClass()` identity.
Interfaces keep the whole surface dispatchable and the identity honest.

**A callback registered in a constructor misbehaves — connect it to dispatch.**
Registration published `this` before subclass initializers ran; the
framework's later (or immediate) virtual calls dispatch into overrides that
read unset state. Same root cause as the constructor-calls-overridable bug:
dispatch reaches the most-derived code regardless of construction progress.

**How would you explain "program to an interface" in dispatch terms?**
Declare the static type as the contract (interface), so overload selection
binds only to contract signatures — leaving the run-time machine free to
substitute any implementation's table. Coupling to a concrete static type
narrows what the second machine is allowed to vary.

---

← Prev: [The machinery and the JIT](02-the-machinery-and-the-jit.md) · Index: [Polymorphism and dispatch](README.md)
