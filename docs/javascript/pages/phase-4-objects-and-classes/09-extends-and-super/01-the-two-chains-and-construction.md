---
title: "09.1 · The two chains, and constructing a derived instance"
sidebar_label: "1 · Two chains and construction"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor), [Classes guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_classes), [Public class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields), [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`Object.getPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf). Documentation-validated; **no timings**.

**`extends` does two things, and almost everyone knows only one of them.**

```js
class Animal { }
class Dog extends Animal { }

Object.getPrototypeOf(Dog.prototype) === Animal.prototype;   // ✅ the instance chain
Object.getPrototypeOf(Dog)           === Animal;             // ✅ the STATIC chain
```

The first line is the familiar one: an instance of `Dog` finds `Animal`'s methods by walking the
prototype chain. The second is the one that surprises people — **the constructor functions are
linked too**, which is why `static` members are inherited:

```js
class Animal { static create() { return new this(); } }
class Dog extends Animal { }

Dog.create();     // ✅ works — `create` is found on Animal, and `this` is Dog
```

🔴 **`static` methods are inherited, and `this` inside one is the class it was called on.** That is
what makes `new this()` in a static factory produce a `Dog` rather than an `Animal`. The mechanism
is the same prototype lookup described in
[05 · The prototype chain](../05-the-prototype-chain/README.md) — applied to the constructors
themselves.

⚠️ **`extends` takes an expression, not just a name.** `class X extends mixin(Base) {}` is legal
and evaluated once at class-definition time, which is the whole basis of the mixin pattern —
**18 · Mixins and composition over inheritance** *(not written yet)*.

## A derived constructor does not create `this`

This is the rule everything else in this chunk follows from:

> **In a derived class, `super()` is what creates `this`.** The derived constructor does not
> allocate the object; the base constructor does, and `super()` is the call that runs it.

```js
class Dog extends Animal {
  constructor(name) {
    this.name = name;      // 🔴 ReferenceError: Must call super constructor ...
    super();               //    ... before accessing 'this'
  }
}
```

**The error is precise and worth reading**: *Must call super constructor in derived class before
accessing 'this' or returning from derived constructor.* Until `super()` returns, `this` is in a
temporal dead zone — exactly like a `let` before its declaration, and for the same reason: the
binding exists but is uninitialised. See
[03 · Hoisting and the temporal dead zone](../../phase-3-functions/08-hoisting-and-tdz/README.md).

```js
class Dog extends Animal {
  constructor(name) {
    super();               // ✅ creates and initialises `this`
    this.name = name;
  }
}
```

Three consequences that follow directly:

- **You cannot read `this` before `super()`** — not to compute an argument, not to log.
  Argument expressions *for* `super()` are fine, as long as they do not touch `this`.
- **You cannot return from a derived constructor before `super()`**, unless you return an object.
  A bare `return;` in a derived constructor before `super()` throws the same error.
- **Calling `super()` twice throws** `ReferenceError: Super constructor may only be called once`.

### The implicit constructor

Omit the constructor and you get one for free, which forwards everything:

```js
class Dog extends Animal { }
// behaves as if: constructor(...args) { super(...args); }
```

🔴 **This is why adding a constructor is a breaking change if you forget `super(...args)`.** A
class that worked fine with the implicit constructor stops passing its arguments up the moment
someone writes `constructor() { super(); }` to add one line of setup.

## Field initialisation order — the trap worth knowing

Instance fields do not all initialise at the same moment. **A derived class's fields are
initialised immediately after `super()` returns** — which means the base constructor runs *before*
they exist:

```js
class Base {
  constructor() { this.describe(); }        // ⚠️ calls an overridable method
  describe() { console.log("base"); }
}

class Child extends Base {
  label = "child";                          // initialised AFTER super() returns
  describe() { console.log(this.label); }   // 🔴 logs undefined
}

new Child();
```

Read it as a sequence:

1. `new Child()` → the implicit constructor calls `super()`.
2. `Base`'s constructor runs and calls `this.describe()`. **Method dispatch is dynamic**, so it
   finds `Child`'s override.
3. `Child.describe` reads `this.label` — but `Child`'s field initialisers have not run yet,
   because `super()` has not returned.
4. `undefined`.

🔴 **The rule that avoids it: never call an overridable method from a constructor.** The base class
cannot know what a subclass will override, and at that point in construction the subclass is only
half-built. If the base genuinely needs subclass input, take it as a **constructor parameter**
instead:

```js
class Base {
  constructor(label) { this.label = label; }
}
class Child extends Base {
  constructor() { super("child"); }         // ✅ the base gets what it needs, in order
}
```

⚠️ **Private fields make the same problem throw rather than log `undefined`.** Reading a `#field`
before its initialiser has run is a `TypeError`, not a quiet undefined — louder, and easier to
diagnose.

## `new.target` travels down the chain

```js
class Base { constructor() { console.log(new.target.name); } }
class Child extends Base { }

new Child();      // "Child"  ← not "Base"
```

**`new.target` is the constructor the `new` was originally applied to**, and `super()` passes it
along unchanged. That is what makes the abstract-base-class guard work — testing
`new.target === Base` rejects only direct instantiation. Full treatment in
[20 · `new.target` and constructor guards](../../phase-3-functions/20-new-target-and-constructor-guards.md).

## Gotchas

**Symptom:** `ReferenceError: Must call super constructor in derived class before accessing 'this'`
**Cause:** The derived constructor touched `this` before `super()` — `super()` is what creates it.
**Fix:** Move `super()` to the top. Argument expressions for it are fine as long as they do not read `this`.

**Symptom:** The same error on a line with no `this` on it
**Cause:** A `return;` before `super()` triggers it too, as does any implicit completion of the constructor body.
**Fix:** Call `super()` unconditionally, before any branch that could return.

**Symptom:** `ReferenceError: Super constructor may only be called once`
**Cause:** `super()` in two branches that both run, or in a loop.
**Fix:** Compute the arguments first, then call `super()` exactly once.

**Symptom:** Arguments stopped reaching the base class after adding a constructor
**Cause:** The implicit constructor forwarded `...args`; a hand-written `constructor() { super(); }` does not.
**Fix:** `constructor(...args) { super(...args); … }`.

**Symptom:** A field read as `undefined` inside a method called from the base constructor
**Cause:** Derived-class fields initialise only after `super()` returns, so they do not exist while the base constructor runs.
**Fix:** Do not call overridable methods from a constructor; pass what the base needs as a parameter.

**Symptom:** `TypeError` reading a `#private` field during construction
**Cause:** Same ordering, but private fields throw instead of yielding `undefined`.
**Fix:** Same fix — and treat the louder error as the better one.

**Symptom:** A static method inherited by a subclass constructed the wrong type
**Cause:** It used `new Base()` instead of `new this()`.
**Fix:** `new this()` — `this` in a static method is the class it was called on.

**Symptom:** `Object.getPrototypeOf(Sub) === Object.prototype`, and statics are missing
**Cause:** The class was not created with `extends` — assigning `Sub.prototype = Object.create(Base.prototype)` by hand wires only the instance chain.
**Fix:** Use `extends`, which wires both.

## Interview questions

**★ What does `extends` actually set up?**
Two links, not one. `Sub.prototype`'s prototype becomes `Base.prototype` — the instance chain — and
`Sub`'s own prototype becomes `Base`, the static chain. The second is why `static` members are
inherited, and why `new this()` in an inherited static factory builds the subclass.

**★ Why must `super()` be called before `this`?**
Because in a derived class the base constructor is what creates the instance. Until `super()`
returns, `this` is uninitialised — a temporal dead zone — so any access throws
`ReferenceError: Must call super constructor …`.

**★ What happens if you omit the constructor in a subclass?**
You get an implicit `constructor(...args) { super(...args); }`. Which means writing a constructor
by hand and forgetting to forward the arguments is a silent breaking change.

**★ Walk through why a field can be `undefined` inside a method called from the base constructor.**
`super()` runs the base constructor, which calls `this.someMethod()`. Dispatch is dynamic so the
subclass's override runs — but the subclass's field initialisers only run *after* `super()`
returns, so its fields do not exist yet. The method sees `undefined`, or a `TypeError` for a
private field.

**★ What is the rule that avoids it?**
Never call an overridable method from a constructor. If the base needs something the subclass
decides, take it as a constructor parameter and let the subclass pass it to `super()`.

**★ What is `new.target` inside a base constructor reached via `super()`?**
The class the `new` was applied to — the subclass. It is forwarded unchanged down the chain, which
is exactly what makes an abstract-base guard (`new.target === Base`) reject only direct
instantiation.

**Can `extends` take something other than a class name?**
Yes — any expression that evaluates to a constructor or `null`, evaluated once when the class is
defined. That is what makes `class X extends mixin(Base) {}` work.

---

← [Topic index](./README.md) · [Next → 09.2 · `super.method()` and overriding safely](./02-super-method-and-overriding.md)
