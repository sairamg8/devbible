---
title: "2 · The three patterns, and choosing"
sidebar_label: "2 · The three patterns"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors), [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in). Documentation-validated; **no timings**.

Three ways to share behaviour without deepening a chain. They are not equivalent, and the middle
one is the one most people mean by "mixin" today.

## Pattern 1 · Copy onto the prototype

```js
const Serializable = {
  serialize() { return JSON.stringify(this); },
};

Object.assign(User.prototype, Serializable);
```

Simple, and it has three problems worth knowing before you use it:

⚠️ **The copied methods are enumerable**, because object-literal methods are — while real class
methods are non-enumerable ([11 · Property descriptors](../11-property-descriptors.md)). So
`for...in` over a `User` now lists `serialize`. `Object.defineProperties` with
`Object.getOwnPropertyDescriptors(Serializable)` avoids that only if the source descriptors are
already right.

🔴 **Name collisions are silent.** Two mixins with a `render` method resolve by whichever
`Object.assign` ran last. Nothing warns.

🔴 **`super` does not work.** The copied function's home object is the literal it was written in, so
`super.serialize()` is a `SyntaxError` there — the same home-object rule as in
[09 · `super.method()`](../09-extends-and-super/02-super-method-and-overriding.md). A mixin cannot
extend what it is mixed into.

**Use it for** small, independent, additive behaviour where none of the above applies.

## Pattern 2 · Subclass factory — the modern mixin

A function that takes a base class and returns a subclass of it:

```js
const Serializable = (Base) => class extends Base {
  serialize() { return JSON.stringify(this); }
};

const Timestamped = (Base) => class extends Base {
  constructor(...args) {
    super(...args);
    this.createdAt = new Date();
  }
};

class User extends Serializable(Timestamped(Object)) {
  constructor(name) { super(); this.name = name; }
}
```

This fixes what pattern 1 cannot:

- **`super` works**, because each mixin creates a real link in the prototype chain. A mixin can
  override a method and call through to the one below it.
- **Order is explicit and meaningful.** `Serializable(Timestamped(Object))` reads outward-in, and
  each layer is visible at the definition site.
- **Constructors compose** through `super(...args)`.
- **`instanceof` still works for the base**, because the chain is real.

⚠️ **What it does not give you is `x instanceof Serializable`** — a mixin is a function, not a class,
so there is no prototype to test against. If a check is needed, add a brand and a
`static [Symbol.hasInstance]`
([13 · `Symbol.hasInstance`](../13-instanceof-and-hasinstance/01-what-it-really-asks.md)):

```js
const BRAND = Symbol.for("app.serializable");
const Serializable = (Base) => class extends Base {
  static [Symbol.hasInstance](x) { return Boolean(x?.[BRAND]); }
  [BRAND] = true;
  serialize() { return JSON.stringify(this); }
};
```

⚠️ **Collisions are still silent**, just resolved by chain order rather than assignment order. Keep
mixin method names specific, and keep any internal state on a `Symbol` key so two mixins cannot
share a field by accident.

## Pattern 3 · Composition — hold a collaborator

```js
class User {
  #logger;
  #store;
  constructor({ logger, store }) { this.#logger = logger; this.#store = store; }

  async save() {
    this.#logger.info("saving");
    await this.#store.put(this);
  }
}
```

No chain, no copying. **The dependency is visible in the constructor**, which is the whole
advantage: a reader knows exactly what a `User` needs, and a test can pass a fake without touching
prototypes.

The cost is delegation — `user.save()` has to exist to call `store.put()`; nothing is inherited for
free. In exchange you get no collisions, no ordering questions, and no fragile base class.

🔴 **This is the default.** The other two are for when you genuinely want the behaviour to *be* on
the object.

## Choosing

| | Prototype copy | Subclass factory | Composition |
|---|---|---|---|
| `super` from the mixin | ❌ | ✅ | n/a |
| constructor participation | ❌ | ✅ | ✅ |
| collisions | silent, last write wins | silent, chain order | impossible |
| dependencies visible | ❌ | partly, at the class declaration | ✅ in the constructor |
| testable in isolation | hard | hard | ✅ inject a fake |
| adds a chain link | no | one per mixin | no |

- **Composition** unless you have a reason not to.
- **Subclass factory** when the behaviour must appear as methods on the instance, when it needs
  constructor participation, or when a mixin must call through to what it wraps.
- **Prototype copy** for a small, additive, collision-free helper — or when you are reading older
  code and need to recognise it.
- **`extends`** for one genuine "is-a" level, built-ins, and framework contracts
  ([chunk 1](./01-why-deep-hierarchies-fail-here.md)).

## Reading code that already uses these

Two things to check when a class's behaviour comes from somewhere you cannot see:

```js
Object.getOwnPropertyNames(User.prototype);   // what is actually on this prototype
let p = User; while ((p = Object.getPrototypeOf(p)) && p.name) console.log(p.name);
```

The second walks the **static** chain, which is where subclass-factory mixins show up — often as
anonymous classes, which is exactly why they are hard to debug. ⚠️ **Name the returned class** when
you write one:

```js
const Serializable = (Base) => class Serializable extends Base { /* … */ };
```

A named class expression makes the chain readable in devtools and in stack traces, and it costs one
word.

## Gotchas

**Symptom:** `for...in` over an instance lists methods that used to be hidden
**Cause:** `Object.assign` onto a prototype copies enumerable properties; class methods are non-enumerable.
**Fix:** `Object.defineProperties(C.prototype, Object.getOwnPropertyDescriptors(mixin))`, with the source flags set correctly.

**Symptom:** `SyntaxError: 'super' keyword unexpected here` inside a mixin
**Cause:** A method copied from an object literal has that literal as its home object.
**Fix:** Use a subclass-factory mixin, which creates a real chain link.

**Symptom:** One mixin's method silently disappeared
**Cause:** Two mixins define the same name; last assignment or chain order wins, with no warning.
**Fix:** Specific names, `Symbol` keys for internal state, and check `Object.getOwnPropertyNames` when debugging.

**Symptom:** `x instanceof MyMixin` throws or is always false
**Cause:** A mixin is a function that returns a class, not a class.
**Fix:** Brand the instances and add `static [Symbol.hasInstance]`, or test for the capability instead.

**Symptom:** Stack traces and devtools show anonymous classes
**Cause:** `(Base) => class extends Base {}` produces an unnamed class expression.
**Fix:** Name it: `class Serializable extends Base`.

**Symptom:** A mixin's constructor never ran
**Cause:** The subclass constructor did not call `super(...args)`, or the mixins were applied in the wrong order.
**Fix:** Always forward `super(...args)` in a mixin constructor, and read the application outward-in.

**Symptom:** Two mixins fight over the same instance field
**Cause:** Both wrote a plainly-named property.
**Fix:** Keep mixin state on a `Symbol` key.

## Interview questions

**★ What is a mixin in modern JavaScript?**
A function that takes a base class and returns a subclass of it —
`const M = (Base) => class extends Base { … }` — applied as `class C extends M(N(Base)) {}`. Unlike
copying methods onto a prototype, it creates real chain links, so `super` works and the mixin can
participate in construction.

**★ Why can't a mixin copied with `Object.assign` use `super`?**
`super` resolves through the method's **home object**, which for a function written in an object
literal is that literal. There is no prototype above it to look through, so `super.x` is a
`SyntaxError` there. A subclass factory has a real chain, so `super` works.

**★ What are the downsides of the subclass-factory pattern?**
Name collisions are still silent, just resolved by chain order; `x instanceof MyMixin` does not work
because a mixin is a function, not a class; and the classes it returns are anonymous unless you name
them, which makes stack traces and devtools harder to read.

**★ How do you make `instanceof` work for a mixin?**
Brand the instances with a `Symbol.for` key and give the mixin a `static [Symbol.hasInstance]` that
checks the brand. The registered symbol also survives duplicate copies of the package, which
`instanceof` would not.

**★ When would you choose composition over either mixin pattern?**
By default. Composition makes the dependency visible in the constructor, makes collisions
impossible, and lets a test inject a fake without touching prototypes. Reach for a mixin only when
the behaviour genuinely needs to *be* a method on the instance, or when it must participate in
construction.

**How do you find out where a class's methods came from?**
`Object.getOwnPropertyNames(C.prototype)` for what is on this level, and walk `Object.getPrototypeOf`
up the static chain to see the mixin layers. Naming your mixin classes makes that walk readable.

**Why keep mixin state on a `Symbol` key?**
So two independently-written mixins cannot collide on a field name, and so the state does not show
up in `Object.keys` or `JSON.stringify` as if it were part of the object's data.

---

← [1 · Why they fail here](./01-why-deep-hierarchies-fail-here.md) · [Topic index](./README.md) · [Phase index](../README.md) →
