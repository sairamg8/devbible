---
title: "06.1 · What `class` desugars to"
sidebar_label: "01 · What it desugars to"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). Documentation-validated.

**"`class` is just syntactic sugar over prototypes" is half true, and the half that
is false matters.** The lookup machinery is identical — methods go on
`Ctor.prototype` exactly as in
[05 · `prototype` vs `[[Prototype]]`](../05-the-prototype-chain/02-prototype-vs-the-slot.md).
But `class` also adds behaviour that no amount of assigning to `.prototype`
reproduces.

## The part that is genuinely sugar

```js
class Rectangle {
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }

  calcArea() {
    return this.height * this.width;
  }
}
```

MDN: methods *"are defined on the prototype of each class instance and shared by all
instances, while fields are instance-specific."*

So `calcArea` lives on `Rectangle.prototype`, one function object shared by every
instance, found by walking one link. The chain is
`instance ---> Rectangle.prototype ---> Object.prototype ---> null`, which is exactly
what the constructor-function form produced.

## The five parts that are not sugar

**1. The body is always strict.** MDN: *"The body of a class is executed in strict
mode even without the `"use strict"` directive."*

Everything strict mode implies applies inside a class with no opt-in: no implicit
globals from a typo'd assignment, `this` is `undefined` rather than `globalThis` in
an unbound call, duplicate parameter names are errors, and `delete` on a
non-configurable property throws instead of returning `false`. You cannot turn it
off.

**2. Calling without `new` throws.**

```js
class Animal {
  speak() {
    return this;
  }
}

const obj = new Animal(); // ✓ works
Animal(); // ✗ TypeError: class constructors must be invoked with 'new'
```

A constructor *function* called without `new` runs happily with `this` as
`undefined` (strict) or `globalThis` (sloppy), quietly assigning properties to the
wrong object. `class` makes that impossible — which is most of the value of
`new.target` guards, obtained for free.

**3. Methods are non-enumerable.** Assigning `Rectangle.prototype.calcArea = …`
creates an enumerable property that shows up in `for...in` over an instance. Class
methods do not. This is why `for...in` behaves differently between the two forms,
and it is the better default.

**4. Class declarations are in the TDZ, and block-scoped.** Covered in
[Phase 3 · 08 · Classes and circular imports](../../phase-3-functions/08-hoisting-and-tdz/06-classes-and-circular-imports.md):
`new Foo()` above `class Foo {}` throws `ReferenceError: Cannot access 'Foo' before
initialization`, while the `function Foo() {}` version would have worked. Classes
also never create `globalThis` properties.

**5. Private elements exist at all.** `#field` has no desugaring — no
`WeakMap`-and-closure trick reproduces its syntax, its `SyntaxError`s, or the brand
check. That is [chunk 3](./03-private-elements.md).

**The summary worth remembering:** `class` is sugar for the *prototype wiring* and a
genuine language feature for everything else.

## Fields versus methods

The distinction that decides where things live:

```js
class Rectangle {
  height = 0;   // instance field — an OWN property of every instance
  width;        // declared, initialised to undefined
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }
  calcArea() {} // prototype method — ONE function, shared
}
```

| | Instance field | Prototype method |
|---|---|---|
| Lives on | **each instance** (own property) | `Ctor.prototype` |
| Copies | one per instance | one, shared |
| Enumerable | **yes** | no |
| Visible to `Object.keys(instance)` | yes | no |
| `this` | the instance | the receiver at the call site |

This is not a style choice. Recall the trap from
[05 · Writing and mutation](../05-the-prototype-chain/03-writing-and-mutation.md):
a mutable value on the prototype is **shared by every instance**, because mutation is
not assignment. A field is an own property, created fresh per instance:

```js
class Basket {
  items = [];   // ✅ each basket gets its own array
}
```

That is the primary reason class fields exist, and the reason `items = []` is right
where `Basket.prototype.items = []` is a bug.

### The arrow-function-field idiom

```js
class Button {
  handleClick = () => {
    this.count++;   // `this` is permanently the instance
  };
}
```

A field holding an arrow function is an **own property per instance**, and the arrow
captures `this` lexically from the constructor's scope — so the method survives
being detached and passed as a callback. That is the standard fix for the
lost-`this` problem, and topic 07's subject.

The cost is real: one function object per instance rather than one shared, and it is
not on the prototype so a subclass cannot `super`-call it. For a component with
thousands of instances that matters; for most code it does not.

## Field initialisation order

MDN, and the derived-class rule is the surprising one:

> For **base classes**: Instance field initializers are evaluated at the start of the
> constructor.
> For **derived classes**: Instance field initializers are evaluated immediately
> before the `super()` call returns.

So in a base class, fields are set up **before** your constructor body runs — which
is why the constructor can rely on them, and why a field initialiser cannot read a
constructor parameter.

In a derived class the ordering is the one that bites:

```js
class Parent {
  constructor() {
    this.setup();     // calls the OVERRIDE
  }
  setup() {}
}

class Child extends Parent {
  value = 42;
  setup() {
    console.log(this.value); // undefined — not initialised yet
  }
}

new Child();
```

`super()` runs `Parent`'s constructor, which calls the overridden `setup()`, and
`Child`'s field initialisers have not run yet — they run *as `super()` returns*.
This is the JavaScript form of the "calling a virtual method from a constructor"
hazard, and the fix is the same: do not call overridable methods from a constructor.

MDN also notes static fields and static blocks *"are evaluated during class
evaluation with `this` set to the class itself"* — that is
[chunk 2](./02-static-and-accessors.md).

## Gotchas

**Symptom:** `TypeError: class constructors must be invoked with 'new'`
**Cause:** A class was called as a function. Unlike a constructor function, this is
an error rather than a silent misbehaviour.
**Fix:** Use `new`. If something else is calling it — a framework, a factory — that
code expects a plain function; wrap it.

**Symptom:** A `for...in` over an instance shows methods in one codebase and not
another
**Cause:** `class` methods are **non-enumerable**; `Ctor.prototype.m = …` methods are
enumerable.
**Fix:** Use `Object.keys` / `Object.entries`, which are own-and-enumerable only.

**Symptom:** Every instance shares one array or object
**Cause:** It is on the **prototype**, not a field. Mutation does not shadow.
**Fix:** Declare it as an instance field (`items = []`) or assign it in the
constructor.

**Symptom:** A field is `undefined` inside a method called from the parent
constructor
**Cause:** MDN: in a derived class, field initialisers run *"immediately before the
`super()` call returns"* — so an overridden method invoked by the parent constructor
sees uninitialised fields.
**Fix:** Do not call overridable methods from a constructor. Use an explicit `init()`
after construction.

**Symptom:** Code that worked as a constructor function breaks when converted to
`class`
**Cause:** Most likely the strict-mode body, the TDZ (used above its declaration), or
a call without `new`.
**Fix:** Check those three first — they are the usual three.

**Symptom:** An arrow-function field cannot be overridden or `super`-called
**Cause:** It is an own property of the instance, not a prototype method, so it is
outside the prototype chain that `super` walks.
**Fix:** Use a normal method plus `bind` in the constructor if you need both the
`this` binding and prototype semantics.

## Interview questions

**★ Is `class` just syntactic sugar over prototypes?**
Half. The **wiring** is identical — methods go on `Ctor.prototype` and lookup is
unchanged. But `class` adds five things you cannot reproduce: a body that is always
strict, a `TypeError` when called without `new`, **non-enumerable** methods,
TDZ/block-scoped declaration semantics, and private elements, which have no
desugaring at all.

**★ Difference between an instance field and a prototype method?**
A field is an **own property of each instance**, created fresh per construction and
enumerable. A method is **one shared function** on `Ctor.prototype`, non-enumerable.
That is why a mutable default (`items = []`) must be a field — on the prototype it
would be shared by every instance, since mutation does not shadow.

**★ What happens if you call a class without `new`?**
`TypeError: class constructors must be invoked with 'new'`. A constructor function in
the same position would run with `this` as `undefined` or `globalThis` and silently
assign properties to the wrong object — so this is the `new.target` guard obtained
for free.

**★ When do class fields get initialised?**
In a **base** class, at the start of the constructor, before your body runs. In a
**derived** class, MDN: *"immediately before the `super()` call returns"* — so an
overridden method called from the parent's constructor sees them still `undefined`.
That is the JavaScript version of calling a virtual method from a constructor.

**Why use an arrow function as a class field?**
Because it becomes an own property per instance whose `this` is lexically the
instance, so it survives being detached and passed as a callback. The cost is one
function object per instance rather than one shared, and it cannot be overridden or
reached with `super`.

**Why is the class body always strict?**
Because it is specified that way — MDN: *"executed in strict mode even without the
`"use strict"` directive"* — and it cannot be opted out of. It removes implicit
globals, makes unbound `this` `undefined`, and turns several silent failures into
errors inside every class you write.

---

[Topic index](./README.md) · Next → [Static members and accessors](./02-static-and-accessors.md)
