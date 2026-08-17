---
title: "Identity, statics and privacy"
sidebar_label: "06 · Identity, statics and privacy"
sidebar_position: 6
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins* —
> *Constraints*: *Decorators and Mixins*, *Static Property Mixins*), whose
> `base<T>()` / `derived<T>()` example is **quoted verbatim**, plus the compiler's
> message table for `TS2417` and `TS18032`, both confirmed present in
> **TypeScript 7.0.2**. **No console block** — no sandbox run covers this phase.

[Chunk 05](./05-the-cost-in-the-build.md) was about writing the type down. This one is
about three things the pattern does at *runtime and at the nominal level*, which
surprise people because nothing in the syntax hints at them.

## Every call to the factory makes a different class

This is the single most consequential fact about mixins, and it follows directly
from the definition. `Scale` is a function; calling it evaluates a class
expression; a class expression evaluates to a **new class object** each time.

```ts
const A = Scale(Sprite);
const B = Scale(Sprite);

A === B;                       // false — two distinct classes

const a = new A("Bird");
a instanceof A;                // true
a instanceof B;                // false  ← the trap
a instanceof Sprite;           // true  — both extend the same base
```

`a instanceof B` being `false` is correct and almost never what the person
writing it expects. Two "identical" applications share a base but are siblings,
not the same class.

**The fix is to apply each mixin exactly once, at module scope, and export the
result:**

```ts
// sprites.ts
export const EightBitSprite = Scale(Sprite);
export type EightBitSprite = InstanceType<typeof EightBitSprite>;
```

Every consumer imports the same class object, so `instanceof` behaves. Applying a
mixin inside a function, a loop, a factory or a React component body is the bug —
it silently creates a fresh class per call, which also defeats every prototype
cache the engine had built.

**The type system does not warn you about any of this**, because structurally `A`
and `B` are identical: values of one are assignable to the other. The divergence
is purely nominal, and `instanceof` is the only thing that sees it.

Except when it is not — which is the next section.

## `#private` fields make composition nominal

[Topic 02](../02-access-modifiers/README.md) made the case that `#private` is the
real one and `private` is a compile-time convention. Mixins are where that choice
has a visible consequence.

A `#private` field is keyed to the class body that declared it, so a type
containing one is only assignable to itself. Two separate applications of a mixin
that declares `#scale` are therefore **not** interchangeable, and intersecting
types that each carry a private member of the same name collapses:

> **`TS18032`: The intersection `'{0}'` was reduced to `'never'` because property
> `'{1}'` exists in multiple constituents and is private in some.**

That message is worth recognising on sight, because "my composed type became
`never`" is otherwise a baffling place to end up. Its sibling is the same idea
for conflicting types rather than privacy:

> **`TS18031`: The intersection `'{0}'` was reduced to `'never'` because property
> `'{1}'` has conflicting types in some constituents.**

**The rule of thumb:** use `#private` inside a mixin when the mixin will be
applied once and the field is genuinely internal; avoid it when consumers will
intersect or interchange several applications. The handbook's own example
deliberately uses a public `_scale` with a naming convention rather than either
form of privacy, and that is not an accident.

`protected` has its own wrinkle here: a mixin cannot declare one ([chunk 01](./01-the-pattern.md)), but
it *can* access a `protected` member of a constrained base, because the mixin
class is a subclass. What it cannot do is promise anything about that member to
its own subclasses in a way that survives the anonymous class.

## Statics come through — but their types cannot be generic

At runtime, `class Scaling extends Base` inherits `Base`'s static members through
the constructor's own prototype chain, exactly as any subclass does. In the type
system they come through as well, because the return type includes `TBase` and
`TBase` is the base's static side.

What you cannot do is make a static's **type** depend on a type parameter. The
handbook is explicit about why:

> "More of a gotcha than a constraint. The class expression pattern creates
> singletons, so they can't be mapped at the type system to support different
> variable types."

Each call to the factory produces one class object with one set of static
properties; there is no per-instantiation static storage for a type parameter to
vary over. The documented workaround is to move the generic onto a *function*
that produces the base class, so each call site gets its own class:

```ts
function base<T>() {
  class Base {
    static prop: T;
  }
  return Base;
}

function derived<T>() {
  class Derived extends base<T>() {
    static anotherProp: T;
  }
  return Derived;
}

class Spec extends derived<string>() {}

Spec.prop; // string
```

Read that carefully: `derived<string>()` is a **call**, and `class Spec extends
derived<string>()` is a class extending its result. It works because the type
argument is supplied at the *call*, not at the class declaration — which is the
same reason `TS2562` ([chunk 04](./04-abstract-and-fences.md)) forbids the reverse.

### `TS2417` — when a mixin's static collides

If a mixin declares a static that the base already has with a different type, the
static sides no longer line up:

> **`TS2417`: Class static side `'{0}'` incorrectly extends base class static side
> `'{1}'`.**

This is the static-side counterpart of ordinary member-override checking, and it
is easy to hit with generic-looking helpers — a mixin adding `static create()`
over a base that already has a differently-shaped `create`. The fix is to rename,
or to constrain the base so the collision is impossible
([chunk 03](./03-constrained-mixins.md) shows the intersection form).

## Decorators cannot do this

People reach for a decorator to add members to a class, and it does not work.
The handbook's *Constraints* section states the limitation directly:

> "You cannot use decorators to provide mixins via code flow analysis:"

The runtime effect happens — a decorator can absolutely assign to the prototype —
but **the type does not change**, so every use of the added member is `TS2339`.
A decorator's declared signature says what it returns for the class as a whole;
it has no mechanism for saying "and also these members now exist".

This is worth knowing as more than trivia, because it is the reason mixins still
exist as a pattern in a language that has decorators
([topic 13](../13-decorators.md)). If you want members added *and* seen, the
factory function is the only construct that does both.

## `this` inside a mixin

Two facts, both inherited from elsewhere in the phase rather than special to
mixins:

- `this` is typed as the anonymous subclass, so it sees the mixin's members **and**
  everything the constraint promised. Anything outside the constraint is invisible
  — that is the constraint doing its job.
- **Polymorphic `this`** ([topic 10](../10-this-types.md)) works here and is often
  what you want for a fluent mixin: returning `this` from a method keeps the
  concrete composed type through a chain, where returning the mixin's own
  interface would flatten it back to just the mixin's members.

```ts
function Chainable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    tap(fn: (self: this) => void): this {
      fn(this);
      return this;                       // keeps the fully composed type
    }
  };
}
```

## Gotchas

**Symptom:** `instanceof` returns `false` for an object that is obviously of that
class
**Cause:** The mixin was applied twice, producing two distinct class objects.
**Fix:** Apply mixins once at module scope and export the result. Never call a
mixin factory inside a function, a loop or a component body.

**Symptom:** A composed class is created afresh on every render or every request
**Cause:** Same root cause — the factory call sits inside a function.
**Fix:** Hoist it. Besides `instanceof`, every per-call class defeats the engine's
inline caches and grows the heap.

**Symptom:** A composed type is `never`, with no obvious null in sight
**Cause:** `TS18032` — an intersection of two types each carrying a `#private`
member of the same name.
**Fix:** Do not intersect separate applications of a mixin that declares
`#private` fields; or drop to a public field with a naming convention, as the
handbook's own example does.

**Symptom:** Two applications of the same mixin are not assignable to each other
**Cause:** A `#private` field makes the type nominal.
**Fix:** Expected. Share one application, or remove the hard-private field.

**Symptom:** A static declared in the mixin is missing at the call site
**Cause:** The explicit return type from
[chunk 05](./05-the-cost-in-the-build.md) describes only the *instance* side. Statics
have to be included in the annotation too.
**Fix:** Intersect them in — `TBase & GConstructor<Inst> & { theStatic(): void }`.

**Symptom:** `TS2417` after adding a static to a mixin
**Cause:** The base already declares that static with an incompatible type; the
static sides do not line up.
**Fix:** Rename, or constrain the base to require the compatible shape.

**Symptom:** A static that "should be generic" reports the wrong type
**Cause:** Class expressions are singletons — a static cannot vary with a type
parameter.
**Fix:** The handbook's `base<T>()` / `derived<T>()` pattern: put the generic on a
function that returns the class.

**Symptom:** A decorator adds a method at runtime, but every call site errors with
`TS2339`
**Cause:** TypeScript cannot merge a type contributed by a decorator.
**Fix:** Use a mixin factory, which changes the type, or declare the addition
separately via declaration merging.

## Interview questions

**★ What is wrong with calling a mixin factory more than once for the same base?**
Each call evaluates a class expression, so each produces a **different class
object**. Instances of one are not `instanceof` the other, and any prototype-level
caching is duplicated. The types are structurally identical, so the compiler
never warns. Apply mixins once at module scope and export the result.

**★ Why can a mixin's static property not be generic?**
Because, in the handbook's words, "the class expression pattern creates
singletons, so they can't be mapped at the type system to support different
variable types" — one call, one class object, one set of statics, and nothing for
a type parameter to vary over. The handbook's
workaround moves the generic onto a function returning the class
(`function base<T>() { class Base { static prop: T } return Base }`), so each
call site gets its own class with its own static type.

**★ Why can't a decorator be used as a mixin?**
It can add members at runtime, but TypeScript cannot merge the resulting type —
the handbook states this in its *Constraints* section. So the members exist and
every use of them is `TS2339`. A mixin factory changes the type because it
returns a new class whose type the compiler infers.

**What does it mean when a composed type becomes `never`?**
`TS18032`: an intersection was reduced because a property exists in several
constituents and is `#private` in at least one. Private names are nominal, so the
constituents can never be satisfied simultaneously. It shows up when two separate
applications of a mixin with `#private` state are intersected.

**Do statics survive a mixin?**
Yes at runtime — constructors inherit through their own prototype chain — and yes
in the type, because the inferred return type includes `TBase`, which is the base's
static side. The two things that do not survive are a static whose type depends on
a type parameter, and any static you forgot to include when you wrote an explicit
return type by hand.

**Should a mixin use `#private` for internal state?**
Only if it will be applied once and never intersected. `#private` is nominal, so
it makes two applications non-interchangeable and can reduce intersections to
`never`. The handbook's example uses a public `_scale` with a leading-underscore
convention for exactly this reason, and notes that mixins may not declare
`private` at all.

---

← Prev: [03 · The cost in the build](./05-the-cost-in-the-build.md) · Next → [05 · The alternatives](./07-the-alternatives.md)
