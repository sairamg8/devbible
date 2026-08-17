---
title: "The alternatives"
sidebar_label: "07 · The alternatives"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins* — *Alternative
> pattern*), whose `Jumpable`/`Duckable`/`Sprite` classes, the `interface Sprite
> extends …` declaration and the `applyMixins` helper are **quoted verbatim**,
> and the handbook's *Declaration Merging* rules already covered in
> [topic 05](../05-interface-declaration-merging/README.md). **No console block.**

Everything so far has been the cost of the class-expression pattern. This chunk
is the other side: what you use instead, and when the mixin is genuinely the
right call after all.

## The handbook's alternative pattern

The idea is to stop asking the compiler to derive the composition, and instead
**declare the runtime and the type separately** — the runtime by copying
prototype members, the type by merging interfaces:

```ts
// Each mixin is a traditional ES class
class Jumpable {
  jump() {}
}

class Duckable {
  duck() {}
}

// Including the base
class Sprite {
  x = 0;
  y = 0;
}

// Then you create an interface which merges
// the expected mixins with the same name as your base
interface Sprite extends Jumpable, Duckable {}
// Apply the mixins into the base class via
// the JS at runtime
applyMixins(Sprite, [Jumpable, Duckable]);

let player = new Sprite();
player.jump();
player.x = 10;
player.y = 20;
```

And the helper, also verbatim:

```ts
// This can live anywhere in your codebase:
function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
          Object.create(null),
      );
    });
  });
}
```

Two mechanisms, deliberately separated:

- **`interface Sprite extends Jumpable, Duckable {}`** merges with the *class*
  `Sprite`, because a class puts its name in the type slot and an interface is
  open — the declaration table from
  [topic 05](../05-interface-declaration-merging/README.md) is doing all the work.
  This is the type half, and it is entirely static.
- **`applyMixins`** copies property descriptors from each mixin's prototype onto
  the base's prototype. This is the runtime half, and the compiler has no
  knowledge of it at all.

### What this buys

- **`Sprite` stays a named class declaration.** No anonymous class expression, so
  declaration emit is ordinary, `isolatedDeclarations` has nothing to object to,
  errors say `Sprite`, and go-to-definition works.
- **One class object, forever.** No per-call class identity problem — `instanceof
  Sprite` is simply true.
- **The composition is visible where the class is defined**, rather than at every
  call site of a factory.

### What it costs, and this is the important half

- 🔴 **The two halves can disagree, and nothing checks them.** The interface says
  `duck()` exists; `applyMixins` is what actually makes it exist. Forget the
  `applyMixins` call and you have a type-clean program that throws
  `TypeError: player.duck is not a function`. This is the pattern's defining
  hazard, and it is strictly worse than anything in the factory pattern, where the
  type is *derived* from the code that runs.
- **Constructor logic is not copied.** `applyMixins` walks
  `Object.getOwnPropertyNames(baseCtor.prototype)` — methods and accessors live
  there, but **instance fields initialised in a constructor or as class fields do
  not**. A mixin with state has to initialise it some other way. (Accessors do
  survive: the helper copies property *descriptors*, not values, which is why it
  uses `getOwnPropertyDescriptor` rather than assignment.)
- **`any` in the helper.** Both parameters are `any`; there is no checking that
  the constructors passed match the interfaces merged.
- **No constraints.** There is no equivalent of `GConstructor<{ setPos … }>`. A
  mixin that depends on the base's members is expressed only by hope.
- **Order and collisions are silent.** Later constructors in the array overwrite
  earlier ones, with no diagnostic.

## Plain composition — the answer most of the time

Before either mixin pattern, the boring option deserves a fair hearing, because
in application code it usually wins:

```ts
class Scaler {
  #scale = 1;
  set(scale: number) { this.#scale = scale; }
  get value() { return this.#scale; }
}

class Sprite {
  readonly scale = new Scaler();       // has-a, not is-a
  constructor(public name: string) {}
}

const s = new Sprite("Bird");
s.scale.set(0.8);
```

Everything in [chunk 05](./05-the-cost-in-the-build.md) and
[chunk 06](./06-identity-and-statics.md) disappears: the types are nameable,
declaration emit is ordinary, `isolatedDeclarations` is satisfied, `instanceof`
works, statics are unremarkable, errors are short, and `#private` is safe. The
price is one level of indirection at the call site — `s.scale.set(…)` rather than
`s.setScale(…)` — and that is usually a fair trade, sometimes an improvement,
because it says where the behaviour lives.

If flattening the surface matters, delegate explicitly:

```ts
class Sprite {
  #scaler = new Scaler();
  setScale(scale: number) { this.#scaler.set(scale); }
  get scale() { return this.#scaler.value; }
}
```

Three lines of forwarding, and nothing in this topic applies to you.

## Choosing

| You want | Reach for |
|---|---|
| To add behaviour to **your own** classes | **Composition.** Start here; leave only for a reason you can name |
| To add behaviour to a class **the caller supplies** | **A mixin factory** — the only option that types the result |
| A **framework base class** assembled from capabilities | A mixin factory, constrained with `AbstractConstructor` |
| A named class with **a fixed set** of capabilities | The `applyMixins` pattern, or just write the class |
| To ship this in a package with **`isolatedDeclarations`** | Composition. The factory pattern is not available |
| To add members from a **decorator** | Nothing does this. Decorators cannot contribute types |

The dividing line is the second row, and it is worth stating on its own: **a
mixin factory is the only construct that adds members to a class you did not
write and gives back a type that knows about them.** That is a real capability,
it is why libraries use the pattern, and it is the only reason to accept the
costs. Application code rarely has that problem — the classes are yours, so
composition is available.

## Trade-off

**The mixin factory** composes capabilities onto an unknown base, keeps the base's
type, supports constraints so the mixin can require what it uses, and produces a
type derived from the code that actually runs. It costs declaration emit
(`TS4060`), rules out `isolatedDeclarations`, produces unreadable errors and
`.d.ts` files, has a class-identity trap around `instanceof`, and cannot make a
static generic.

**The `applyMixins` pattern** keeps a named class and clean emit, at the price of a
type that is *asserted* rather than derived — the interface and the runtime call
can drift apart silently, and there are no constraints and no constructor logic.

**Composition** has none of these problems and none of the reach: it cannot extend
a class it was not given.

The line worth holding: **prefer composition; use a mixin factory when the base
class is a parameter; use `applyMixins` when you want a named class and can
tolerate hand-maintained truth.** And whichever you pick, apply it once and export
the result.

## Gotchas

**Symptom:** `TypeError: x.duck is not a function`, but the types were fine
**Cause:** The `applyMixins` pattern's two halves disagree — the interface was
merged, the runtime call was forgotten or missed a constructor.
**Fix:** Keep the `interface … extends …` line and the `applyMixins(…)` call
adjacent, always. This is why the factory pattern is safer despite everything else.

**Symptom:** Methods copied by `applyMixins` work, but a field is `undefined`
**Cause:** The helper copies prototype members only. Class fields and constructor
assignments are per-instance and never touched.
**Fix:** Initialise the state in the base class, or give the mixin an `init()` the
base's constructor calls.

**Symptom:** A getter copied by `applyMixins` behaves like a plain value
**Cause:** It does not, if the helper is the handbook's — but a hand-rolled
`derived.prototype[name] = base.prototype[name]` *does* flatten accessors by
invoking the getter once.
**Fix:** Copy descriptors with `getOwnPropertyDescriptor`/`defineProperty`, as the
handbook's version does.

**Symptom:** Two mixins in the array define the same method and the wrong one wins
**Cause:** `applyMixins` overwrites in array order, last write wins, with no
warning.
**Fix:** Order the array deliberately, or rename the collision away.

**Symptom:** Composition "feels verbose" so a mixin is proposed
**Cause:** Usually the forwarding methods, not a real limitation.
**Fix:** Three lines of delegation against every cost in chunks 03 and 04 is
normally the better trade. Reach for the factory when the base is genuinely a
parameter.

## Interview questions

**★ What is the alternative to the class-expression mixin, and what is its
weakness?**
Declare the mixins as ordinary classes, merge them into the base's type with
`interface Sprite extends Jumpable, Duckable {}`, and copy their prototype
members at runtime with an `applyMixins` helper. It keeps a named class, so
declaration emit and errors are ordinary. Its weakness is that the type is
**asserted, not derived** — nothing checks the interface against the runtime copy,
so forgetting the `applyMixins` call gives a clean compile and a runtime
`TypeError`.

**★ When is a mixin factory genuinely the right tool?**
When the base class is a **parameter** — the caller supplies the class and you
must return one that keeps their type *and* has your members. That is the one
thing composition cannot do and decorators cannot type. Library and framework
code has this problem; application code almost never does, because it owns its
classes.

**★ Why does `interface Sprite extends Jumpable, Duckable {}` work next to
`class Sprite`?**
Declaration merging. A class contributes its name to both the type slot and the
value slot; an interface contributes only to the type slot and is open, so the
two type-side declarations combine instead of colliding. The interface adds the
members to `Sprite`'s type without touching the class's implementation — the
runtime half is entirely `applyMixins`'s job.

**Why does `applyMixins` copy property descriptors rather than assigning?**
So that accessors stay accessors. `Object.getOwnPropertyDescriptor` plus
`Object.defineProperty` moves the getter/setter pair itself; a plain assignment
would evaluate the getter once and copy the resulting value, silently turning a
computed property into a stale constant.

**Your team wants to add `withLogging` to twenty of its own service classes.
Mixin or composition?**
Composition, or a plain base class. The classes are yours, so nothing needs a
class-shaped parameter — a `Logger` field, or one shared base, gives the same
result with nameable types, clean declaration emit and short errors. Reach for a
mixin only if those services come from somewhere you do not control.

**Does any alternative solve the `isolatedDeclarations` problem?**
Composition and the `applyMixins` pattern both do, because neither infers a type
from a class expression or puts an expression in an extends clause. That is
frequently the deciding argument for a library that has adopted the flag.

---

← Prev: [04 · Identity, statics and privacy](./06-identity-and-statics.md) · [Topic index](./README.md) · [Phase 4 index](../README.md)
