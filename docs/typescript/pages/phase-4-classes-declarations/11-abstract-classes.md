---
title: "Abstract classes and abstract construct signatures"
sidebar_label: "11 · Abstract classes"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → Abstract
> Classes and Members*, *Abstract Construct Signatures*) — the `Base` class, both
> `greet` versions and the errors shown against them are **quoted verbatim**,
> including the handbook's explanation of why the first one is rejected. Error
> codes and their exact `{0}`-templated text are read out of the **compiler's own
> diagnostic table** (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2
> this corpus targets). **No console block** — no sandbox run covers this phase.

A **Know** topic with one genuinely non-obvious part: the difference between
*"the class"* and *"something you can call `new` on"*, which is where most people
lose half an hour.

## The basics

```ts
abstract class Base {
  abstract getName(): string;
  printName() {
    console.log("Hello, " + this.getName());
  }
}

const b = new Base();
// Cannot create an instance of an abstract class.
```

> **TS2511:** *"Cannot create an instance of an abstract class."*

An `abstract` member declares a signature with no implementation; the class
cannot be instantiated, and a concrete subclass must supply every abstract
member — otherwise:

> **TS2515:** *"Non-abstract class '{0}' does not implement inherited abstract
> member {1} from class '{2}'."*

(`TS2653` is the same rule for a class *expression*.)

Two smaller rules from the table:

> **TS1244:** *"Abstract methods can only appear within an abstract class."*
>
> **TS2513:** *"Abstract method '{0}' in class '{1}' cannot be accessed via super
> expression."*

TS2513 is the one worth remembering: `super.getName()` inside a subclass is a
call to nothing. There is no implementation to reach.

## 🔴 `typeof Base` is not "a constructor for a Base"

This is the part that earns the topic. Write a function taking a class and the
obvious thing fails:

```ts
function greet(ctor: typeof Base) {
  const instance = new ctor();
  // Cannot create an instance of an abstract class.
  instance.printName();
}
```

The handbook's explanation is the whole insight:

> TypeScript correctly prevents this because given the definition of `greet`,
> it's perfectly legal to write `greet(Base)`, which would end up constructing an
> abstract class—something that should never happen.

`typeof Base` is the **static side** of `Base`
([phase 3 · topic 07](../phase-3-generics/07-typeof-type-operator.md)), and
`Base` itself is assignable to it. So the parameter admits the abstract class,
and `new ctor()` would construct it. The error is at the `new`, not at the call
site, which is why it reads as the compiler being obtuse.

## The fix: a construct signature

Ask for **something you can `new`**, rather than for the class:

```ts
function greet(ctor: new () => Base) {
  const instance = new ctor();
  instance.printName();
}

greet(Derived);  // OK
greet(Base);     // Argument of type 'typeof Base' is not assignable to parameter of type 'new () => Base'.
                 // Cannot assign an abstract constructor type to a non-abstract constructor type.
```

`new () => Base` says "a constructor taking no arguments and producing a `Base`".
`Derived` satisfies it; `Base` does not, **and now the error is at the call
site**, naming the actual problem. That relocation is the real win — the same bug
reported where a reader can act on it.

The general form, when the arguments do not matter:

```ts
type Ctor<T> = new (...args: any[]) => T;
```

⚠️ **`any[]` rather than `never[]` here.** Unlike the "any function" bound from
[phase 3 · constraints](../phase-3-generics/02-constraints/README.md), a
construct signature you intend to *call* needs parameters you can actually pass.
`never[]` would accept every constructor and let you invoke none of them.

## `abstract new` — accepting abstract classes deliberately

Sometimes you *want* the abstract one — a registry, a `Map` keyed by class, a
mixin helper — because you will never call `new` on it:

```ts
type AbstractCtor<T> = abstract new (...args: any[]) => T;
```

`abstract new` accepts both abstract and concrete classes. Concrete constructors
are assignable to it; the reverse is not. **Pick it when you need to name the
class, and the plain `new` form when you need to construct one.**

The related rule from the diagnostic table, which is exactly the mixin case
(**topic 14** *(not written yet)*):

> *"A mixin class that extends from a type variable containing an abstract
> construct signature must also be declared 'abstract'."*

## Abstract class or interface?

Both express "you must provide these members". The difference is what else they
bring:

| | `abstract class` | `interface` |
|---|---|---|
| Shared implementation | **yes** — `printName` above | no |
| Constructor, fields, state | **yes** | no |
| How many can you have | one (`extends`) | any number (`implements`) |
| Exists at runtime | **yes** — a real value | no, erased |
| Members supplied to overrides | **yes**, types flow down | no — [topic 04](./04-implements-vs-extends.md) |

**Reach for `abstract class` when there is genuinely shared code** — the template
-method shape, where a base implements the algorithm and subclasses fill in
steps. **Reach for an interface when there is not**, because it costs nothing,
composes freely, and does not consume the single `extends` slot.

⚠️ And note the runtime consequence: an abstract class is a real value, so it
survives erasure and can be used as a `Map` key or in an `instanceof`. An
interface cannot.

## Trade-off

**Abstract classes** give you enforced contracts *and* shared implementation in
one declaration, with the base's types flowing into overrides — something
`implements` cannot do. They cost the inheritance slot, couple every subclass to
the base's changes, and pull real code into a hierarchy that may not want one.

**Interfaces plus composition** stay flexible and free, at the cost of writing
the shared behaviour somewhere else and wiring it in.

The line worth holding: **abstract class for shared code, interface for shape.**
And when a function takes a class, type it `new (...) => T` rather than
`typeof Base` — the error then lands where the mistake is.

## Gotchas

**Symptom:** `TS2511: Cannot create an instance of an abstract class.` inside a
function that takes a class
**Cause:** The parameter is `typeof Base`, which the abstract class itself
satisfies.
**Fix:** `ctor: new () => Base`. The error moves to the call site, where it
belongs.

**Symptom:** `Cannot assign an abstract constructor type to a non-abstract
constructor type.`
**Cause:** Passing an abstract class where a constructible one is required — the
check working.
**Fix:** Pass a concrete subclass, or take `abstract new (...) => T` if you never
construct it.

**Symptom:** `TS2515: Non-abstract class does not implement inherited abstract
member`
**Cause:** A subclass left an abstract member unimplemented.
**Fix:** Implement it, or mark the subclass `abstract` too.

**Symptom:** `TS2513: Abstract method 'x' in class 'Y' cannot be accessed via
super expression.`
**Cause:** `super.x()` on an abstract member — there is no implementation to
call.
**Fix:** Call the concrete implementation, or give the base a default one and
drop `abstract`.

**Symptom:** `TS1244: Abstract methods can only appear within an abstract class.`
**Cause:** `abstract` member in a concrete class.
**Fix:** Mark the class `abstract`, or implement the member.

**Symptom:** A `Ctor<T>` helper accepts constructors but will not let you call
them
**Cause:** `never[]` parameters — the "any function" bound copied from a context
where you never invoke the value.
**Fix:** `new (...args: any[]) => T` when you intend to construct.

## Interview questions

**★ Why can't you type a "class parameter" as `typeof Base`?**
Because the abstract class itself is assignable to its own static type, so
`greet(Base)` would be legal and `new ctor()` would construct an abstract class.
TypeScript rejects the `new`, which puts the error inside your function rather
than at the caller. Use a construct signature — `ctor: new () => Base` — and the
error moves to the call site and names the real problem.

**★ What is `abstract new (...args: any[]) => T` for?**
Accepting abstract classes deliberately — a registry, a `Map` keyed by class, a
mixin helper — where you need to *name* the class but will never construct it.
Concrete constructors are assignable to it; the plain `new` form is what you want
when you actually call `new`.

**Abstract class or interface?**
Abstract class when there is genuinely shared implementation and state — the
template-method shape — and when you need the base's types to flow into
overrides. Interface when there is only shape: it costs nothing, you can
implement any number of them, and it does not consume the single `extends` slot.
An abstract class also survives erasure as a real value; an interface does not.

**Can you call `super` on an abstract method?**
No — `TS2513`. There is no implementation to reach. If you want a default that
subclasses can extend, give the base a concrete method instead of an abstract
one.

---

← Prev: [10 · `this` types](./10-this-types.md) · Next → **12 · Static members and the static side** *(not written yet)*
