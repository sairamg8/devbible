---
title: "06.2 · Static members and accessors"
sidebar_label: "02 · Static and accessors"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static), [Static initialization blocks](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Static_initialization_blocks). Documentation-validated.

`static` puts a member on the **class object itself** rather than on instances or on
the prototype. That is a third place things can live, and knowing which of the three
you are writing to is most of what goes wrong here.

## Static members belong to the class

```js
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  static displayName = "Point";
  static distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
}

const p1 = new Point(5, 5);
p1.displayName;         // undefined
Point.displayName;      // "Point"
Point.distance(p1, p2); // works
```

**`p1.displayName` is `undefined`, and that is the whole point.** A static member is
not on the instance and not on `Point.prototype`, so instance lookup never finds it —
the chain `p1 ---> Point.prototype ---> Object.prototype ---> null` does not pass
through `Point`.

So there are **three destinations** in one class body:

| Written as | Lives on | Reached by |
|---|---|---|
| `field = 1` | each instance | `instance.field` |
| `method() {}` | `Ctor.prototype` | `instance.method()` (one link) |
| `static x = 1` / `static m() {}` | **the class object** | `Ctor.x`, `Ctor.m()` |

Statics are what you use for anything that belongs to the *type* rather than to a
value of the type: factories (`User.fromJSON(…)`), constants, counters, registries,
and validation helpers that take an instance as an argument rather than being called
on one.

### `this` in a static method is the class

```js
class Model {
  static create(data) {
    return new this(data);   // `this` is the class — subclass-aware
  }
}
class User extends Model {}

User.create({}); // a User, not a Model
```

`new this(…)` rather than `new Model(…)` makes the factory inherit correctly:
`User.create` has `this === User`. This is the standard polymorphic-factory idiom,
and it works because **statics are inherited through the class objects' own chain** —
`Object.getPrototypeOf(User) === Model`, which is the second chain `extends` sets up.

The same rule bites in reverse: a static method detached from its class loses `this`
just like any other method, and `const create = Model.create; create({})` throws.

## Static initialization blocks

```js
class Config {
  static #cache;
  static defaults;

  static {
    // statements, not just an expression
    const raw = readSomeSource();
    Config.defaults = Object.freeze(parse(raw));
    Config.#cache = new Map();
  }
}
```

MDN: static blocks *"allow flexible initialization of static properties, including
the evaluation of statements during initialization, while granting access to the
private scope."*

Two capabilities a `static field = …` initialiser does not have:

- **Statements** — loops, `try`/`catch`, conditionals. A field initialiser is a
  single expression.
- **Access to the class's private scope**, including private statics and private
  instance names, which is what makes a static block the place to build a
  `WeakMap`-style registry or to expose a controlled accessor.

MDN adds that *"Multiple static blocks can be declared and are evaluated in
declaration order"*, interleaved with static field initialisers in source order. So
a static field declared *after* a block is not yet set inside it — the ordering is
plain top-to-bottom.

And when do they run? MDN: static fields and blocks *"are evaluated during class
evaluation with `this` set to the class itself."* That is at the `class` statement,
not at first construction — so a static block that throws prevents the class from
being defined at all, and one that does expensive work pays that cost at module load.

**Remember the const-like inner binding** from
[Phase 3 · 08](../../phase-3-functions/08-hoisting-and-tdz/06-classes-and-circular-imports.md):
assigning to the class's own name inside a static block is
`TypeError: Assignment to constant variable.` Use `Config.defaults = …` — a property
write — not `Config = …`.

## Getters and setters

```js
class Temperature {
  #celsius = 0;

  get fahrenheit() {
    return this.#celsius * 1.8 + 32;
  }
  set fahrenheit(v) {
    this.#celsius = (v - 32) / 1.8;
  }
}
```

Class accessors go on the **prototype**, like methods — so they are shared, and a
subclass can override them. They are the standard way to expose a computed or
validated view over private state, and the pairing above is the canonical shape:
a `#private` field plus a public accessor pair.

Three things to hold:

- **A getter makes reading arbitrary work**, invisibly. Everything from
  [01 · Methods, accessors and spread](../01-object-literals/02-methods-accessors-and-spread.md)
  applies: debuggers evaluate getters, and spread turns them into frozen snapshots.
- **The infinite-recursion trap.** `get name() { return this.name; }` calls itself
  until the stack blows. The backing store must be a *different* name — `#name`, or
  `_name` in older code. This is the single most common accessor bug.
- **A setter with no getter makes the property write-only** — assignment runs, reads
  give `undefined`. Almost always a mistake; declare both or neither.

`static get` / `static set` exist too, putting the accessor on the class object.

## Which of the three to use

- **Instance field** — per-instance state, and *always* for mutable defaults
  (`items = []`), since a prototype value would be shared.
- **Prototype method / accessor** — behaviour shared by all instances, overridable by
  subclasses, reachable with `super`.
- **Static** — anything belonging to the type: factories, constants, registries,
  helpers that take instances as arguments. If a method never touches `this`
  meaningfully, it probably wants to be static — or a plain exported function, which
  tree-shakes better and needs no class at all.

## Gotchas

**Symptom:** `instance.someStatic` is `undefined`
**Cause:** Statics live on the **class object**, which is not on the instance's
prototype chain. MDN's own example: `p1.displayName` is `undefined` while
`Point.displayName` is `"Point"`.
**Fix:** `Ctor.someStatic`, or `this.constructor.someStatic` from an instance method
— noting `constructor` is forgeable.

**Symptom:** A static factory returns the base class when called on a subclass
**Cause:** It used `new Model(…)` instead of `new this(…)`.
**Fix:** `new this(…)` — in a static method `this` is the class it was called on, so
`User.create()` builds a `User`.

**Symptom:** `TypeError: Assignment to constant variable.` inside a static block
**Cause:** Assigning to the **class's own name**, which is an immutable binding
inside the class body.
**Fix:** Assign to a property (`Config.defaults = …`), not to the binding.

**Symptom:** `RangeError: Maximum call stack size exceeded` from a getter
**Cause:** The getter reads the property it is defined for —
`get name() { return this.name; }` — recursing forever.
**Fix:** Back it with a different name: `#name`, or `_name`.

**Symptom:** A static field is `undefined` inside a static block above it
**Cause:** Static fields and blocks are evaluated in **declaration order**, top to
bottom.
**Fix:** Move the field above the block, or the logic below the field.

**Symptom:** A module is slow to load and the class is barely used
**Cause:** Static fields and blocks are evaluated *"during class evaluation"* — at
the `class` statement, not at first use.
**Fix:** Move expensive work into a lazily-called static method.

**Symptom:** Reading a property gives `undefined` although assignment appears to work
**Cause:** A setter was declared with no matching getter, making the property
write-only.
**Fix:** Declare both.

## Interview questions

**★ Where do `static` members live, and why is `instance.staticThing` undefined?**
On the **class object** itself — not on the instance and not on `Ctor.prototype`. An
instance's chain is `instance ---> Ctor.prototype ---> Object.prototype ---> null`,
which never passes through `Ctor`, so instance lookup cannot reach a static. MDN's
example: `p1.displayName` is `undefined`, `Point.displayName` is `"Point"`.

**★ What is `this` in a static method?**
The class it was called on — so `new this(…)` in a static factory returns the
**subclass** when called as `Sub.create()`. That works because `extends` also links
the class objects: `Object.getPrototypeOf(Sub) === Base`.

**★ What can a static initialization block do that a static field cannot?**
Run **statements** — loops, `try`/`catch`, conditionals — and MDN adds that it grants
*"access to the private scope"* of the class, so it can touch private statics and set
up private state. Multiple blocks run in declaration order, interleaved with static
fields.

**★ When are static fields and blocks evaluated?**
MDN: *"during class evaluation with `this` set to the class itself"* — at the `class`
statement, not on first construction. So a throwing static block prevents the class
from existing, and expensive work there is paid at module load.

**What is the infinite-recursion trap with accessors?**
`get name() { return this.name; }` — the getter reads the same property it defines,
so it calls itself until the stack overflows. The backing store must be a different
name, conventionally `#name`.

**When should a method be static rather than an instance method?**
When it belongs to the type rather than to a value of it — factories, constants,
registries, helpers that take instances as arguments. If it never meaningfully uses
`this`, consider a plain exported function instead: it tree-shakes better and needs
no class.

---

← [What `class` desugars to](./01-what-class-desugars-to.md) · [Topic index](./README.md) · Next → [Private elements](./03-private-elements.md)
