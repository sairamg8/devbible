---
title: "Static members, static blocks and the static side"
sidebar_label: "12 · Static members"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.4 release notes** (*Static Blocks
> in Classes*) — the `Foo` examples, the note about access to private fields and
> the execution-order statement are **quoted verbatim** — and the **handbook**
> (*Classes → Static Members*). Error codes and their exact `{0}`-templated text
> are read out of the **compiler's own diagnostic table** (⚠️ install inspected:
> TypeScript **6.0.3**, not the 7.0.2 this corpus targets). **No console block** —
> no sandbox run covers this phase.

A **Know** topic built on one idea already met twice in this corpus: **a class
declaration creates two types, not one.**

- The **instance type** — what `new C()` produces, and what `C` means in a type
  position.
- The **static side** — the constructor function itself, and what
  [`typeof C`](../phase-3-generics/07-typeof-type-operator.md) means.

Statics live on the second. Every rule below follows from that split.

## Why statics cannot see the class's type parameters

```ts
class Box<T> {
  static empty: T;      // ❌
}
```

> **TS2302:** *"Static members cannot reference class type parameters."*

The reason is arithmetic, and it is worth being able to state:
**`T` is per-instantiation; the constructor is ONE object shared by every
instantiation.** `Box<string>` and `Box<number>` are the same runtime value, so
there is no single `T` for `empty` to have.

This is the same finding banked in
[phase 3 · generic classes](../phase-3-generics/09-generic-classes.md), and the
consequence is the same: give the *method* its own parameter.

```ts
class Box<T> {
  static of<U>(value: U): Box<U> { /* … */ }
}
```

`static of<U>` is why every real library has that shape.

## The static side is inherited, and checked

`extends` copies statics onto the subclass — they are properties of a
constructor, and constructors have prototype chains too. Which means the static
side is checked as well:

> **TS2417:** *"Class static side '{0}' incorrectly extends base class static side
> '{1}'."*

A subclass redeclaring a static with an incompatible type gets that, not the
ordinary instance-member error. **The message naming "static side" is the tell**
that you are looking at the constructor, not the instance.

One narrower rule, worth recognising because the cause is invisible:

> **TS2699:** *"Static property '{0}' conflicts with built-in property
> 'Function.{0}' of constructor function '{1}'."*

A constructor **is a function**, so `static name`, `static length` and
`static caller` collide with what every function already has. `static name` is
the one people actually hit.

## Static blocks (TypeScript 4.4)

For initialisation too complex for an initialiser expression:

```ts
class Foo {
    static count = 0;
    // This is a static block:
    static {
        if (someCondition()) {
            Foo.count++;
        }
    }
}
```

The release notes' summary of what they buy:

> These static blocks allow you to write a sequence of statements with their own
> scope that can access private fields within the containing class. That means
> that we can write initialization code with all the capabilities of writing
> statements, no leakage of variables, and full access to our class's internals.

**"Full access to our class's internals" is the point** — a static block can
reach `#private` members, which nothing outside the class body can:

```ts
class Foo {
    static #count = 0;
    get count() {
        return Foo.#count;
    }
    static {
        try {
            const lastInstances = loadLastInstances();
            Foo.#count += lastInstances.length;
        }
        catch {}
    }
}
```

Before static blocks this needed an exported helper plus a public setter, which
widened the API purely to satisfy initialisation.

**Ordering:** *"A class can have multiple `static` blocks, and they're run in the
same order in which they're written"* — interleaved with static field
initialisers, in source order. They run **once**, when the class is defined.

⚠️ **Constraints from the diagnostic table**, all of which follow from "this is
an initialiser, not a function body":

- *"A 'return' statement cannot be used inside a class static block."*
- *"'await' expression cannot be used inside a class static block."*
- *"'for await' loops cannot be used inside a class static block."*

**No `await` is the one that matters.** Class definition is synchronous, so a
static block cannot do async setup. If initialisation needs I/O, you want an
async factory or a lazily-awaited promise — not a static block.

## Typing "the class itself"

Two related tools, both already met:

```ts
declare function register(ctor: typeof Service): void;      // the static side
type Instance = InstanceType<typeof Service>;               // back to the instance
```

⚠️ **`typeof C` is the right type for "the class as a value" but the wrong one for
"something I can `new`"** — that distinction is
[topic 11](./11-abstract-classes.md)'s subject, and it is where `typeof Base`
lets an abstract class through. Use `typeof C` to *name* a class; use
`new (...args) => T` to *construct* one.

## Static members or module-level values?

Worth asking, because statics are often reflex rather than choice.

A `static` member is a property of a constructor function. A module-level `const`
or exported function is a binding. For a helper that never touches instance
state, the module-level version is:

- **tree-shakeable** — an unused export can be dropped; an unused static on a
  used class cannot;
- **simpler to test and mock** — no class to instantiate or stub around;
- **free of the `Function` collisions** above.

**Statics earn their place when the name matters** — `Color.fromHex`,
`Duration.zero`, `Box.of` — because the class name is doing documentation work at
every call site, and when a static factory needs `#private` access that a free
function cannot have.

## Trade-off

**Statics** keep construction helpers and constants attached to the type they
belong to, can reach the class's private internals, and read well at the call
site. They cost tree-shaking, add a little test friction, and inherit the
`Function` property collisions.

**Module-level values** are simpler, shakeable and trivially mockable, at the
cost of losing the namespacing that made `Color.fromHex` readable.

The line worth holding: **statics for factories and constants that belong to the
type; module functions for everything else.** Static blocks only when
initialisation genuinely needs statements and internals.

## Gotchas

**Symptom:** `TS2302: Static members cannot reference class type parameters.`
**Cause:** `T` is per-instance; the constructor is one shared object.
**Fix:** Give the static method its own parameter — `static of<U>(v: U): Box<U>`.

**Symptom:** `TS2699: Static property 'name' conflicts with built-in property
'Function.name'…`
**Cause:** A constructor is a function, and functions already have `name`,
`length` and `caller`.
**Fix:** Rename the static.

**Symptom:** `TS2417: Class static side … incorrectly extends base class static
side …`
**Cause:** A subclass redeclared a static incompatibly. Statics are inherited and
checked.
**Fix:** Match the base's type, or rename.

**Symptom:** `await` is rejected in a static block
**Cause:** Class definition is synchronous; a static block is an initialiser.
**Fix:** An async factory, or a lazily-awaited promise held in a static field.

**Symptom:** A static block ran before a static field it depends on was set
**Cause:** Blocks and field initialisers run in **source order**.
**Fix:** Move the declaration above the block.

**Symptom:** Bundle size did not drop after removing calls to a static helper
**Cause:** An unused static on a used class cannot be tree-shaken.
**Fix:** A module-level exported function.

## Interview questions

**★ Why can't a static member use the class's type parameter?**
Because `T` is per-instantiation while the constructor is a single runtime object
shared by every instantiation — `Box<string>` and `Box<number>` are the same
value, so there is no one `T` for the static to have. `TS2302`. The fix is a
method-level parameter: `static of<U>(v: U): Box<U>`, which is why every library
has that shape.

**★ What is a static block for?**
Initialisation that needs statements rather than a single expression — and,
critically, **access to the class's `#private` members**, which nothing outside
the class body has. Multiple blocks run in source order, once, at class
definition. `await` is not allowed, because defining a class is synchronous.

**What is the "static side" of a class?**
The constructor function itself — what `typeof C` refers to — as opposed to the
instance type that `new C()` produces. It is inherited by subclasses and checked
(`TS2417`), and because a constructor is a function it already has `name`,
`length` and `caller`, which is where `TS2699` comes from.

**When would you prefer a module-level function to a static?**
When it does not touch instance state or private internals. A module export is
tree-shakeable, easier to mock and free of the `Function` collisions; an unused
static on a used class stays in the bundle. Keep statics for factories and
constants where the class name is doing real work at the call site.

---

← Prev: [11 · Abstract classes](./11-abstract-classes.md) · Next → **13 · Decorators** *(not written yet)*
