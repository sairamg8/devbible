---
title: "The two machines: overload selection vs override selection"
sidebar_label: "1 · The two machines"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.12 (method invocation:
> compile-time step 2 chooses the method, run-time step 4 locates it), §8.4.8
> (inheritance, overriding, hiding), §8.4.8.3 and §8.4.5 (covariant return
> types), §12.5 (creation of new class instances — constructor execution
> order), and the JVMS SE 25 §5.4.3.3 (method resolution).

**Every method call in Java is decided twice. At compile time, the *static*
types of the receiver and the arguments pick a method *signature* — which
overload. At run time, the *dynamic* class of the receiver object picks the
*implementation* of that signature — which override. Most dispatch bugs are
one of the two machines being asked a question that belongs to the other.**

## The two-step resolution, precisely

```java
PaymentProcessor p = new StripeProcessor();   // static type: PaymentProcessor
p.charge(order);                              // which charge?
```

1. **Compile time — overload selection.** Using only *static* types
   (`p` is `PaymentProcessor`, `order` is its declared type), the compiler
   picks a method *signature* and burns it into the bytecode
   ([an `invokevirtual`/`invokeinterface` instruction naming it](../../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md)).
2. **Run time — override selection.** The JVM looks at the *actual class* of
   the receiver (`StripeProcessor`) and runs the most-derived override of
   that signature.

Only the **receiver** is dynamic. Argument types do *not* participate at run
time — Java has single dispatch, which is exactly why the visitor pattern
exists ([chunk 3](03-dispatch-in-the-wild.md) converts a second dispatch
into another virtual call).

The compile-time half has its own rulebook — applicability, most-specific
selection, and what `null` arguments match — covered from the caller's side
in [Phase 1's methods topic](../../phase-1-language-core/10-methods.md).
This page owns the run-time half and the seam between the two.

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

The [inheritance topic](../03-inheritance/README.md) covers hiding from the
author's side; this table is the caller's side. Two rows deserve expansion,
because each is a production bug shape.

**Fields are never polymorphic.** If `Child` declares a field with the same
name as one in `Parent`, both fields exist in every `Child` object, and the
*static* type of the expression decides which one a read sees. A
`Parent`-typed variable reads the parent's field while `child.method()`
dispatches to the child's override — the two channels disagree, and code
that mixes shadowed fields with overridden methods produces values that look
impossible in a debugger.

**`super.m()` is a static bypass, not a dispatch.** Inside an override,
`super.charge(order)` compiles to `invokespecial` — the parent's
implementation is selected at compile time, no table consulted. That is why
you can extend behaviour (`super.close(); extra();`) without recursing into
yourself, and why there is no way to call the *grandparent's* version:
`super.super` does not exist (JLS §15.11.2 allows exactly one level).

## Constructors and dispatch: the initialization-order bug

Constructors are never dispatched — `new StripeProcessor()` runs exactly the
chain [class anatomy](../01-class-anatomy/README.md) describes. But a constructor
*body* can make virtual calls, and those **do** dispatch, to the
most-derived override — on an object whose subclass fields are not yet
initialized (JLS §12.5: superclass constructors complete before subclass
field initializers run):

```java
class Parent {
    Parent() { render(); }              // virtual call in constructor
    void render() { }
}
class Child extends Parent {
    private final Config config = loadConfig();
    @Override void render() {
        config.apply();                 // NPE: config is still null here
    }
}
```

`new Child()` runs `Parent()` first, `Parent()` dispatches `render()` to
`Child.render()`, and `Child.render()` reads a `final` field that has not
been assigned yet. The rule that follows: **never call an overridable method
from a constructor** — call only `private`, `static`, or `final` methods.
The same leak shape (passing `this` out of a constructor) is treated in
[immutable design](../12-immutable-design.md).

## Covariant returns and bridge methods

An override may *narrow* the return type (JLS §8.4.5 — return-type
substitutability):

```java
interface Repository { Entity find(long id); }
class OrderRepository implements Repository {
    @Override public Order find(long id) { ... }   // Order extends Entity — legal
}
```

Callers through `OrderRepository` get an `Order` without casting; callers
through `Repository` still see `Entity`. At the bytecode level the JVM
matches methods by *exact* descriptor, so the compiler quietly generates a
**bridge method** — a synthetic `Entity find(long)` that delegates to your
`Order find(long)`. Bridges are invisible in source but visible to
reflection (`getMethods()` returns both; the bridge answers
`isBridge() == true`) — the classic surprise when annotation-scanning code
finds a method "twice" or reads annotations off the bridge, which does not
carry them. The same mechanism implements generic-interface overrides after
[erasure](../../phase-3-generics-collections/README.md).

## Gotchas

**Symptom:** `process(Object o)` runs instead of `process(Order o)` even though an `Order` was passed
**Cause:** overload selection is compile-time, by the *static* type of the argument expression — it was typed `Object` at the call site
**Fix:** expected behaviour; cast at the call site, or redesign to a single virtual method on the argument's own type (make the `Order` decide)

**Symptom:** a `Parent`-typed variable reads the "wrong" field value while method calls hit the right override
**Cause:** methods dispatch on runtime type; fields bind on static type — mixed shadowed fields with overridden methods
**Fix:** never shadow fields; expose state through (virtual) accessors so both channels agree

**Symptom:** "overriding" a static factory in a subclass changes nothing for `Parent.create()` call sites
**Cause:** statics bind by reference type — hiding, not overriding; there is no static polymorphism
**Fix:** model the variability with instances (factory object implementing an interface)

**Symptom:** `NullPointerException` from inside an override, during `new` — a `final` field is null even though it is "always" assigned
**Cause:** the parent constructor called an overridable method; the override ran before the subclass's field initializers (JLS §12.5 order)
**Fix:** constructors call only `private`/`static`/`final` methods; defer the virtual call to an explicit `init()` or a factory method that constructs first, then calls

**Symptom:** `HashSet.contains` never finds the object although `equals(MyType other)` "is overridden" and unit-tested
**Cause:** `equals(MyType)` is an *overload*; collections dispatch the virtual slot `equals(Object)`, which was never overridden
**Fix:** override `equals(Object)` exactly ([the contract](../06-equals-hashcode/README.md)); `@Override` on the intended signature turns this mistake into a compile error

**Symptom:** reflection or an annotation scanner reports the same method twice, one copy missing its annotations
**Cause:** covariant return or generic override — the compiler emitted a synthetic bridge method; annotations live on the declared method, not the bridge
**Fix:** filter with `Method::isBridge` (or `isSynthetic`) before processing; look up annotations on the non-bridge declaration

**Symptom:** trying to call the grandparent's implementation — `super.super.m()` — does not compile
**Cause:** JLS §15.11.2: `super` reaches exactly one level; skipping a level would let a subclass violate its direct parent's invariants
**Fix:** restructure — have the parent expose the behaviour it wants children to reuse as a `protected` (often `final`) method

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

**★ Why is calling an overridable method from a constructor dangerous?**
The call dispatches to the subclass override while the subclass's fields are
still unassigned — superclass constructors complete before subclass
initializers run. The override observes default values (`null`, `0`) and
typically throws or, worse, caches them. Constructors should call only
`private`/`static`/`final` methods.

**★ Why doesn't overriding apply to fields?**
Field access is resolved at compile time against the static type; a
subclass field with the same name *shadows*, it never replaces. Both fields
exist in the object. Polymorphic state is exposed through methods, which do
dispatch.

**What is a bridge method and when does the compiler generate one?**
A synthetic method the compiler emits when an override's descriptor differs
from the inherited signature at the bytecode level — covariant returns and
generic-interface implementations after erasure. It delegates to the real
override; reflection sees it (`isBridge()`), callers never do.

**What exactly does `super.m()` compile to, and what can't it do?**
`invokespecial` on the direct superclass's implementation — selected
statically, no dispatch. It cannot skip a level (`super.super` is illegal)
and cannot be used to reach a *sibling's* or grandparent's version.

**A `null` literal is passed to an overloaded method — which overload runs?**
The compile-time machine answers: the most specific applicable overload
(e.g. `String` beats `Object`); ambiguity between unrelated types is a
compile error. Run-time dispatch never sees the question — it is settled
before the program runs ([Phase 1's methods topic](../../phase-1-language-core/10-methods.md)
works the cases).

---

← Index: [Polymorphism and dispatch](README.md) · Next → [The machinery and the JIT](02-the-machinery-and-the-jit.md)
