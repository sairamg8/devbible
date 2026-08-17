---
title: "Constrained mixins"
sidebar_label: "03 · Constrained mixins"
sidebar_position: 3
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins* — *Constrained
> mixins*), with `GConstructor`, `Positionable` and `Jumpable` **quoted
> verbatim**. `TS2339` and `TS2345` are read out of the compiler's message table
> and confirmed present in **TypeScript 7.0.2**. **No console block.**

[Chunk 01](./01-the-pattern.md) built a mixin that adds members and needs nothing
from its base. Most useful mixins are not like that — they *call into* the class
they wrap, and that means demanding something of it.

## Requiring capabilities of the base

The handbook's version, verbatim:

```ts
type GConstructor<T = {}> = new (...args: any[]) => T;
```

Same shape as `Constructor`, with the instance type opened up as a parameter. Now
a mixin can say what the base must already be able to do:

```ts
type Positionable = GConstructor<{ setPos: (x: number, y: number) => void }>;
type Spritable = GConstructor<Sprite>;
type Loggable = GConstructor<{ print: () => void }>;
```

```ts
function Jumpable<TBase extends Positionable>(Base: TBase) {
  return class Jumpable extends Base {
    jump() {
      // This mixin will only work if it is passed a base
      // class which has setPos defined because of the
      // Positionable constraint.
      this.setPos(0, 20);
    }
  };
}
```

The constraint does two jobs at once, and both matter:

- **Inside the mixin**, `this.setPos` type-checks. Without the constraint, `this`
  is only known to be the anonymous subclass of `{}`, and the call is `TS2339`
  — *"Property '{0}' does not exist on type '{1}'."*
- **At the call site**, passing a class that lacks `setPos` fails as an ordinary
  argument-assignability error — `TS2345`, *"Argument of type '{0}' is not
  assignable to parameter of type '{1}'."* The error lands on
  `Jumpable(WrongBase)`, which is where the mistake is.

That second half is the real payoff. An unconstrained mixin that happens to call
`this.setPos` would either not compile at all or, if written loosely enough,
would compile everywhere and fail at runtime on the one base class that lacks the
method.

`GConstructor<Sprite>` shows the other common form: constrain by a **named
class** rather than an inline shape. It reads better and gives better errors, at
the cost of coupling the mixin to a concrete class instead of a capability.

## Constraining the static side too

`GConstructor<T>` parameterises the *instance* type. The constraint is an
ordinary type, so you can intersect it to demand statics as well:

```ts
type WithCreate = GConstructor<object> & { create(): object };

function Cached<TBase extends WithCreate>(Base: TBase) {
  return class extends Base {
    static cache = new Map<string, object>();

    static getOrCreate(key: string) {
      let hit = this.cache.get(key);
      if (!hit) {
        hit = Base.create();          // the base's static, required by the constraint
        this.cache.set(key, hit);
      }
      return hit;
    }
  };
}
```

This is worth knowing precisely because the *other* direction — making a static's
**type** depend on a type parameter — is the one thing the pattern cannot do
([chunk 05](./05-the-cost-in-the-build.md)).

## Gotchas

**Symptom:** `TS2339` inside the mixin — `this.setPos` does not exist
**Cause:** The base was constrained with plain `Constructor`, whose instance type
is `{}`.
**Fix:** Constrain with `GConstructor<{ setPos: … }>` so the mixin can see what it
requires.

**Symptom:** `TS2345` at the call site, naming a type you did not write
**Cause:** The class passed in does not satisfy the mixin's constraint. The
"parameter type" in the message is the constraint.
**Fix:** Read the constraint, not the mixin body — the missing member is named in
the error.

**Symptom:** A constraint using a concrete class rejects a structurally identical
class
**Cause:** `GConstructor<Sprite>` compares the whole instance type, including any
`#private` fields, which are nominal.
**Fix:** Constrain by the capability you actually use — an inline shape — rather
than by the class.

## Interview questions

**★ How do you write a mixin that needs a method from its base?**
Constrain the type parameter with a generic constructor type:
`type GConstructor<T = {}> = new (...args: any[]) => T`, then
`function Jumpable<TBase extends GConstructor<{ setPos(x: number, y: number): void }>>`.
The constraint types `this` inside the mixin so `this.setPos(0, 20)` checks, and
it rejects unsuitable bases at the call site with `TS2345` rather than leaving a
runtime failure.

**When would you constrain with `GConstructor<SomeClass>` rather than an inline
shape?**
When the mixin genuinely depends on that class rather than on a capability — it
gives shorter errors and documents the coupling. The cost is that the constraint
becomes nominal wherever the class has `#private` members, so a structurally
identical class is rejected. Constrain by capability when you want reuse, by
class when you want coupling to be explicit.

**How do you require a *static* member of the base?**
Intersect it into the constraint: `GConstructor<object> & { create(): object }`.
The constraint describes the constructor, so anything you add to it is a demand
on the static side. Note this is the opposite of the thing mixins cannot do —
requiring an existing static is fine; making a static's type depend on a type
parameter is not.

---

← Prev: [01 · The pattern](./01-the-pattern.md) · Next → [03 · What it costs](./05-the-cost-in-the-build.md)

---

← Prev: [02 · Composing and naming](./02-composing-and-naming.md) · Next → [04 · Abstract bases and the two fences](./04-abstract-and-fences.md)
