---
title: "Abstract bases and the two fences"
sidebar_label: "04 · Abstract bases and fences"
sidebar_position: 4
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript 4.2 release notes** (*Abstract
> construct signatures*), whose `AbstractConstructor` / `withStyles` example and
> its explanatory note are **quoted verbatim**, and the compiler's own message
> table for `TS2797`, `TS2511`, `TS2510` and `TS2562` — all four confirmed
> present in **TypeScript 7.0.2**. **No console block.**

## Mixing over an abstract class

Before TypeScript 4.2 this was simply impossible: `new (...args: any[]) => T`
does not describe an abstract class, because you cannot `new` one (`TS2511`,
*"Cannot create an instance of an abstract class."*). Passing `abstract class
Base` to a mixin factory was therefore an assignability error, and the standard
workaround was a cast.

4.2 added the `abstract new` construct signature. From the release notes,
verbatim:

```ts
abstract class SuperClass {
    abstract someMethod(): void;
    badda() {}
}

type AbstractConstructor<T> = abstract new (...args: any[]) => T

function withStyles<T extends AbstractConstructor<object>>(Ctor: T) {
    abstract class StyledClass extends Ctor {
        getStyles() {
            // ...
        }
    }
    return StyledClass;
}

class SubClass extends withStyles(SuperClass) {
    someMethod() {
        this.someMethod()
    }
}
```

> "This feature allows us to write *mixin factories* in a way that supports
> abstract classes."

And the rule that catches people, also verbatim:

> "Note that `withStyles` is demonstrating a specific rule, where a class (like
> `StyledClass`) that extends a value that's generic and bounded by an abstract
> constructor (like `Ctor`) has to also be declared `abstract`. This is because
> there's no way to know if a class with *more* abstract members was passed in,
> and so it's impossible to know whether the subclass implements all the abstract
> members."

Miss the `abstract` keyword on the returned class and the compiler says so
directly:

> **`TS2797`: A mixin class that extends from a type variable containing an
> abstract construct signature must also be declared `'abstract'`.**

The practical consequence is that **an abstract-capable mixin returns something
you cannot instantiate.** `withStyles(SuperClass)` is not a class you can `new` —
it is a base for `class SubClass extends withStyles(SuperClass)`, which is
exactly how the release-notes example uses it. If your mixin must return
something instantiable, constrain with `GConstructor`, not
`AbstractConstructor`, and accept that abstract bases are then out of scope.

**Which to reach for:** `abstract new` if the mixin exists to build base classes
in a framework; plain `new` if callers are meant to `new` the result. A mixin
constrained by `AbstractConstructor` accepts concrete classes too — every
concrete constructor is assignable to an abstract construct signature — so the
abstract form is the more permissive constraint, paid for by an uninstantiable
result.

## The two fences you will hit next

### `TS2510` — Base constructors must all have the same return type

A union of constructor types is a legal thing to have, and an illegal thing to
extend:

```ts
declare const Either: typeof Cat | typeof Dog;

class Hybrid extends Either {}    // ❌ TS2510
```

> **`TS2510`: Base constructors must all have the same return type.**

It shows up in mixin code when a factory is called with a value whose type is a
union — a class picked out of a config map, or a ternary. TypeScript will not
form a class whose instance type depends on a runtime choice.

**Fix:** narrow before composing, or give the map an explicit
`GConstructor<Common>` element type so every entry has one instance type:

```ts
const registry: Record<string, GConstructor<Animal>> = { cat: Cat, dog: Dog };

const Mixed = Trackable(registry[kind]);   // one instance type: Animal
```

### `TS2562` — Base class expressions cannot reference class type parameters

This is the hard limit of the pattern, and it is worth knowing before you design
around it:

```ts
function Timestamped<TBase extends Constructor>(Base: TBase) { /* … */ }

class Repository<T> extends Timestamped(BaseRepo)<T> {}   // ❌ nonsense
class Store<T> extends Timestamped(BaseStore<T>) {}        // ❌ TS2562
```

> **`TS2562`: Base class expressions cannot reference class type parameters.**

**A generic class cannot pass its own type parameter into the expression it
extends.** The base is evaluated once, when the class is declared, and `T` does
not exist yet. So mixins compose over *concrete* classes cleanly and over
*generic* ones only if you fix the parameter first:

```ts
class UserStore extends Timestamped(BaseStore<User>) {}    // ✅ T pinned
```

If you need the generic to survive, the mixin is the wrong tool — a generic
class that *contains* the capability (composition) or a generic interface plus
declaration merging will both express it, and neither fights the compiler.

## Gotchas

**Symptom:** `TS2797` on a mixin that worked before an `abstract` base was passed
**Cause:** The bound is an abstract construct signature, so the returned class
might inherit unimplemented abstract members.
**Fix:** Declare the returned class `abstract`, and instantiate a concrete
subclass of it instead.

**Symptom:** `TS2511` — cannot create an instance of an abstract class — from a
mixin's *result*
**Cause:** Correct behaviour of the fix above. An abstract-capable mixin returns
an abstract class.
**Fix:** `class Concrete extends withStyles(Base) { … }`, then `new Concrete()`.
If you need to `new` the mixin's result directly, use `GConstructor`.

**Symptom:** `TS2510` from a factory call that "obviously" gets one class
**Cause:** The argument's *type* is a union — a ternary, or a lookup in a
heterogeneous object literal — even though only one class arrives at runtime.
**Fix:** Narrow first, or type the map's values as one `GConstructor<Common>`.

**Symptom:** `TS2562` when adding a mixin to an existing generic class
**Cause:** The extends clause cannot reference the class's own type parameters.
**Fix:** Pin the parameter at the extends site, or switch to composition. There is
no flag for this.

## Interview questions

**★ What did TypeScript 4.2's abstract construct signatures change for mixins?**
Before 4.2, `new (...args: any[]) => T` could not describe an abstract class, so
an abstract base could not be passed to a mixin factory without a cast. `abstract
new (...args: any[]) => T` describes one. The rule attached to it is that a class
extending a type variable bounded by an abstract constructor **must itself be
declared `abstract`** (`TS2797`) — there is no way to know whether the class
passed in had more abstract members left unimplemented.

**★ Why can't a generic class extend a mixin applied to its own type parameter?**
`TS2562` — base class expressions cannot reference class type parameters. The
extends clause is evaluated once at declaration time, before any `T` exists.
Fix it by pinning the parameter (`extends Timestamped(BaseStore<User>)`) or by
using composition, which has no such restriction.

**Is `AbstractConstructor` a strictly better constraint than `Constructor`?**
It is the more permissive one — concrete constructors are assignable to abstract
construct signatures, so it accepts strictly more bases. The price is that the
returned class must be declared `abstract`, so callers cannot `new` it. Use it
for framework base classes; use `GConstructor` when the result is meant to be
instantiated.

---

← Prev: [03 · Constrained mixins](./03-constrained-mixins.md) · Next → [05 · The cost in the build](./05-the-cost-in-the-build.md)
