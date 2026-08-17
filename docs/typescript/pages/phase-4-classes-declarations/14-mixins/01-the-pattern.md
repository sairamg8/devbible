---
title: "The pattern"
sidebar_label: "01 · The pattern"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins* — *Setup*, *The
> `Constructor` type*) with the `Sprite`, `Constructor` and `Scale` examples
> **quoted verbatim**. `TS2545`'s text is read out of the compiler's own message
> table and confirmed present in **TypeScript 7.0.2**. **No console block.**

## What a mixin is

> "Along with traditional OO hierarchies, another popular way of building up
> classes from reusable components is to build them by combining simpler partial
> classes." — the handbook's opening

Concretely: **a mixin is a function that takes a class and returns a subclass of
it.** Not a keyword, not a language feature — a function. Everything TypeScript
does here is making that function's *type* work.

Start with an ordinary class. This is the handbook's `Sprite`, unchanged:

```ts
class Sprite {
  name = "";
  x = 0;
  y = 0;

  constructor(name: string) {
    this.name = name;
  }
}
```

Now the piece that makes the pattern typeable:

```ts
type Constructor = new (...args: any[]) => {};
```

Read that as **"anything you can call `new` on"**. It is a *static side* — the
type of the class object itself, not of its instances, which is the distinction
[topic 12](../12-static-members-and-the-static-side.md) exists to make. A mixin
takes one of these and returns another.

## The factory

```ts
// This mixin adds a scale property, with getters and setters
// for changing it with an encapsulated private property:

function Scale<TBase extends Constructor>(Base: TBase) {
  return class Scaling extends Base {
    // Mixins may not declare private/protected properties
    // however, you can use ES2020 private fields
    _scale = 1;

    setScale(scale: number) {
      this._scale = scale;
    }

    get scale(): number {
      return this._scale;
    }
  };
}
```

Three things are doing the work, and each is load-bearing:

1. **`TBase extends Constructor` is a type parameter, not a type.** This is the
   single most important line in the pattern. A generic parameter *remembers*
   which class was passed; a plain `Base: Constructor` parameter would forget it,
   and the returned class would have `setScale` and nothing else.
2. **`return class … extends Base`** — a **class expression**, extending a value
   whose type is a type variable. That is legal TypeScript specifically to make
   this pattern work.
3. **The return type is inferred.** Nobody wrote it down. That single fact is
   responsible for most of [chunk 05](./05-the-cost-in-the-build.md).

Using it, again verbatim from the handbook:

```ts
// Compose a new class from the Sprite class,
// with the Mixin Scale applier:
const EightBitSprite = Scale(Sprite);

const flappySprite = new EightBitSprite("Bird");
flappySprite.setScale(0.8);
console.log(flappySprite.scale);
```

`new EightBitSprite("Bird")` still takes `Sprite`'s constructor argument — the
subclass has no constructor of its own, so JavaScript's implicit
`constructor(...args) { super(...args) }` forwards everything. The instance has
`name`, `x`, `y` **and** `setScale`, `scale`.

## Why the constructor has to be `(...args: any[])`

This is the part everyone tries to "clean up", and the compiler stops you:

> **`TS2545`: A mixin class must have a constructor with a single rest parameter
> of type `'any[]'`.**

The reason is structural, not stylistic. Inside `Scale`, the compiler does not
know what `Base`'s constructor takes — `TBase` is a type variable, and every
class passed in will have a different signature. The only constructor the
subclass can honestly declare is one that accepts everything and forwards it.
Narrow it and you have promised something about a class you have never seen:

```ts
function Scale<TBase extends Constructor>(Base: TBase) {
  return class Scaling extends Base {
    // ❌ TS2545 — this constructor cannot forward an unknown base's arguments
    constructor(scale: number) {
      super();
      this._scale = scale;
    }
    _scale = 1;
  };
}
```

The fix is to **not write a constructor at all** and let the implicit one
forward, then configure through a method or an accessor — which is exactly what
the handbook's `setScale` is for. If a mixin genuinely needs its own construction
parameters, they belong on the *factory*, not the class:

```ts
function Scale<TBase extends Constructor>(Base: TBase, initial = 1) {
  return class Scaling extends Base {
    _scale = initial;          // captured from the factory's closure
    setScale(scale: number) {
      this._scale = scale;
    }
    get scale(): number {
      return this._scale;
    }
  };
}

const BigSprite = Scale(Sprite, 4);
```

That is the idiomatic escape hatch: **the factory takes the configuration, the
class takes whatever the base took.**

## The comment in the handbook that is easy to skim past

> "Mixins may not declare private/protected properties — however, you can use
> ES2020 private fields"

`private _scale` inside a mixin class is not an option, because `private` is
checked *nominally* against a declaring class and the declaring class here is an
anonymous expression regenerated per call. The handbook's own code uses a
`_scale` naming convention with a public field; `#scale` works and is genuinely
private. The consequences of choosing `#scale` show up in
[chunk 05](./05-the-cost-in-the-build.md) — it changes whether two mixed classes can be
assigned to one another.

## Gotchas

**Symptom:** The composed class has the mixin's members but none of the base's
**Cause:** The base was annotated as `Base: Constructor` instead of being a
generic parameter `TBase extends Constructor`. A concrete annotation erases which
class was passed.
**Fix:** Make it generic — `function M<TBase extends Constructor>(Base: TBase)`.
This is the single most common mixin bug.

**Symptom:** `TS2545` on a mixin that wants its own constructor arguments
**Cause:** The subclass must be able to forward an unknown base's constructor
arguments, so its own constructor may only be `(...args: any[])`.
**Fix:** Move the parameters onto the factory and capture them in the closure, or
set them through a method after construction.

**Symptom:** `new Mixed()` compiles but throws at runtime, or a field is
`undefined`
**Cause:** The implicit constructor forwarded no arguments because the call site
passed none — the composed class still requires whatever the *base* required.
**Fix:** Pass the base's arguments. Composing does not change the constructor
signature; `Scale(Sprite)` still needs `"Bird"`.

**Symptom:** A field initialised in the mixin is overwritten by the base
**Cause:** Field initialisers run in construction order — base fields first, then
the subclass's. A mixin field always wins over the base's field of the same name.
**Fix:** Intended, but do not rely on it silently. Prefer distinct names, or
`#private` fields, which cannot collide across classes at all.

**Symptom:** `private` inside the mixin class is rejected or behaves oddly
**Cause:** The handbook states plainly that mixins may not declare
`private`/`protected` properties.
**Fix:** Use a `#private` field, or a naming convention with a public field, as
the handbook's own `_scale` does.

## Interview questions

**★ What is a mixin in TypeScript, and what language feature makes it possible?**
A function that takes a class and returns a subclass of it. Two features make it
typeable: **class expressions** (so a class can be created and returned inline)
and **extending a value whose type is a type parameter** (`class extends Base`
where `Base: TBase`). Neither is mixin-specific syntax — there is no `mixin`
keyword. The type flows through because the factory is generic and its return
type is inferred.


**★ Why must the mixin class's constructor be `(...args: any[])`?**
Because the mixin does not know what its base's constructor takes — `TBase` is a
type variable. The subclass's only honest constructor is one that accepts
anything and forwards it with `super(...args)`. Declaring anything narrower is
`TS2545`: *"A mixin class must have a constructor with a single rest parameter of
type 'any[]'."* If the mixin needs configuration, it goes on the factory, not the
constructor.


**★ What breaks if you write `function Scale(Base: Constructor)` instead of
`function Scale<TBase extends Constructor>(Base: TBase)`?**
Everything the pattern exists for. `Constructor` is `new (...args: any[]) => {}` —
its instance type is `{}`. Annotating the parameter with it throws away the
identity of the class that was passed, so the returned class has only the mixin's
own members; `Scale(Sprite)` would have `setScale` but not `name`. The generic
parameter is what remembers.


**Why can't a mixin declare a `private` member?**
`private` is checked nominally — against the class that declared it — and the
declaring class here is an anonymous class expression produced afresh on every
call to the factory. The handbook states the restriction directly and points at
ES2020 `#private` fields instead, which are keyed to the class body rather than
to a nominal type.

---

← [Topic index](./README.md) · Next → [02 · Constrained and abstract mixins](./03-constrained-mixins.md)

---

← [Topic index](./README.md) · Next → [02 · Composing and naming](./02-composing-and-naming.md)
