---
title: "05.2 · `prototype` vs `[[Prototype]]`"
sidebar_label: "02 · prototype vs [[Prototype]]"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [`Object.create`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create). Documentation-validated.

**Two different things share almost the same name, and confusing them is the single
biggest source of prototype confusion.** One is an internal slot on every object;
the other is an ordinary property that only functions have.

| | `obj.[[Prototype]]` | `Constructor.prototype` |
|---|---|---|
| What it is | an **internal slot** on every object | an ordinary **property**, only on functions |
| How to read it | `Object.getPrototypeOf(obj)` | `Fn.prototype` — plain property access |
| What it does | **where lookup goes next** for this object | the `[[Prototype]]` **to give** to instances made with `new` |
| Objects have one | yes, all of them | no — only functions |

MDN's framing: `obj.[[Prototype]]` *"determines where JavaScript looks for
properties on the object"*, while `Constructor.prototype` *"specifies the
`[[Prototype]]` to be assigned to all instances created by the constructor using
`new`."*

**A function's `prototype` property is not that function's own prototype.** It is a
template it hands out. `Box.prototype` is *not* where `Box` looks up its own
properties — that would be `Object.getPrototypeOf(Box)`, which is
`Function.prototype`.

## The picture

```js
function Box(value) {
  this.value = value;
}

// Box.prototype is a plain object
Box.prototype.getValue = function () {
  return this.value;
};

const boxes = [new Box(1), new Box(2), new Box(3)];

// Every instance's [[Prototype]] is Box.prototype
Object.getPrototypeOf(new Box()) === Box.prototype; // true

// Box.prototype has a constructor property that references Box
Box.prototype.constructor === Box; // true

// The prototype chain looks like:
// new Box() ---> Box.prototype ---> Object.prototype ---> null
```

Note what `new Box(1)` actually did: it created a fresh object whose
`[[Prototype]]` is `Box.prototype`, ran the function body with `this` bound to it,
and returned it. **`getValue` was never copied onto any instance.** All three boxes
share one function object, found by walking one link.

That sharing is the point. A thousand instances cost one copy of each method, and
adding a method to `Box.prototype` makes it instantly available on every instance
that already exists — because lookup is dynamic, not a snapshot taken at
construction.

## `class` is the same machinery

```js
class Box {
  constructor(value) { this.value = value; }
  getValue() { return this.value; }
}

Object.getPrototypeOf(new Box(1)) === Box.prototype; // true
Object.hasOwn(Box.prototype, "getValue");            // true
```

Methods declared in a class body go on `Box.prototype`, exactly as if you had
assigned them. The chain is identical. `class` adds real things —
`#private` fields, `extends` wiring, strict-mode bodies, non-enumerable methods, a
constructor that throws without `new` — but the **lookup mechanism is unchanged**.
That is what "class is syntactic sugar over prototypes" means, and it is why this
topic comes before topic 06.

One difference worth knowing: class methods are **non-enumerable**, while
`Box.prototype.getValue = …` creates an enumerable one. So a `for...in` over an
instance sees the hand-assigned method and not the class one.

## The `constructor` property

```js
Box.prototype.constructor === Box; // true

const box = new Box(1);
box.constructor === Box;           // true (via prototype chain lookup)
```

`constructor` is an own property **of `Box.prototype`**, not of the instance — the
instance finds it by walking one link. It is a back-reference, and it is only as
reliable as the objects it sits on.

**The classic way to break it**, which MDN flags:

```js
// ❌ DON'T DO THIS:
Box.prototype = Object.create(null);
// This breaks the constructor reference for new instances
// Unless you manually re-set it:
Box.prototype.constructor = Box;
```

Replacing `prototype` wholesale discards the default object that carried
`constructor`. This is why the old pre-`class` inheritance recipe always ended with
a manual `Child.prototype.constructor = Child` — and why forgetting it left
instances claiming to be constructed by `Parent`.

MDN notes it is not merely cosmetic: *"Some built-in operations read the
`constructor` property — if missing, they may not work as expected."* `Array.prototype.map`
and friends consult `Symbol.species` via `constructor` to decide what to return, and
promise chaining does something similar.

**Do not use `constructor` for type checks.** It is a writable, forgeable ordinary
property. For "did this come from my class?", use the brand check from
[03 · brand checks](../03-existence-checks-and-delete/02-undefined-holes-and-brand-checks.md).

## `Object.create` — set the chain directly

```js
const proto = { greet() { return "hi"; } };

const obj = Object.create(proto);
Object.getPrototypeOf(obj) === proto; // true
obj.greet();                          // "hi"

const dict = Object.create(null);      // no chain at all
```

`Object.create(proto)` makes a new object with `proto` as its `[[Prototype]]` and
**no own properties**. No constructor is involved, nothing runs, nothing is copied.
It is the most direct expression of what this topic is about: an object *is* some
own properties plus a link.

The second argument takes property descriptors, which is the way to set the
prototype and define properties in one step:

```js
const obj = Object.create(anotherObj, {
  a: { value: 1, enumerable: true },
});
```

Note the descriptor defaults: anything you do not state is `false`, so that `a` is
**non-writable and non-configurable**. That surprises people who expect `{ a: 1 }`
semantics — a plain assignment creates a writable, enumerable, configurable
property, while `defineProperty`-style descriptors default the opposite way.

## Three ways to make an object with a given prototype

```js
Object.create(proto)                  // explicit, no constructor
({ __proto__: proto, a: 1 })          // literal — the one good use of the magic form
new Ctor()                            // uses Ctor.prototype
```

All three set the slot at **creation time**, which is what you want — see
[chunk 3](./03-writing-and-mutation.md) on why changing it afterwards is a different
matter entirely.

## Gotchas

**Symptom:** `Object.getPrototypeOf(Box) !== Box.prototype`
**Cause:** They are different things. `Box.prototype` is the object given to
*instances*; `Object.getPrototypeOf(Box)` is where `Box` **itself** looks things up,
which is `Function.prototype`.
**Fix:** Nothing to fix — but the naming is genuinely bad and this is worth checking
whenever prototype code confuses you.

**Symptom:** `instance.constructor` is the wrong constructor
**Cause:** Someone replaced `Fn.prototype` with a fresh object, discarding the
default `constructor` back-reference (MDN flags this).
**Fix:** `Fn.prototype.constructor = Fn` after replacing, or assign onto the
existing prototype rather than replacing it.

**Symptom:** A method added to the prototype after instances were created is visible
on them
**Cause:** Lookup is **dynamic** — instances hold a link, not a copy.
**Fix:** Expected, and usually useful. It is also why monkey-patching a built-in
prototype affects every existing object of that type.

**Symptom:** A `for...in` over an instance shows methods you did not expect
**Cause:** Methods assigned as `Fn.prototype.m = …` are **enumerable**; `class`
methods are not. `for...in` walks the chain and includes enumerable inherited
properties.
**Fix:** `Object.keys` / `Object.entries`, which are own-and-enumerable only.

**Symptom:** A property defined via `Object.create`'s second argument is silently
read-only
**Cause:** Descriptor flags default to `false`, so it is non-writable and
non-configurable unless you say otherwise.
**Fix:** State them: `{ value: 1, writable: true, enumerable: true, configurable: true }`.

## Interview questions

**★ What is the difference between `Fn.prototype` and an object's `[[Prototype]]`?**
`[[Prototype]]` is an **internal slot on every object**, saying where lookup goes
next; read it with `Object.getPrototypeOf`. `Fn.prototype` is an ordinary
**property that only functions have**, holding the object that `new Fn()` will
install as the new instance's `[[Prototype]]`. A function's own `[[Prototype]]` is
`Function.prototype`, which is a different object entirely.

**★ What does `new Fn()` actually do?**
Creates a fresh object whose `[[Prototype]]` is `Fn.prototype`, calls `Fn` with
`this` bound to it, and returns that object (unless the body returns an object of its
own). **No methods are copied** — instances share the one function object on the
prototype, found by walking one link.

**★ Is `class` different machinery from prototypes?**
No. Class methods are installed on `Ctor.prototype` and the chain is identical.
`class` adds `#private` fields, `extends` wiring, a strict-mode body, a constructor
that throws without `new`, and **non-enumerable** methods — but property lookup is
unchanged.

**★ What is the `constructor` property and how does it break?**
An own property of `Fn.prototype` pointing back at `Fn`; instances find it by
walking the chain. It breaks when someone **replaces** `Fn.prototype` wholesale,
discarding the default object that carried it — hence the traditional
`Child.prototype.constructor = Child`. It is writable and forgeable, so never use it
for type checks.

**What does `Object.create(proto)` do that `new` does not?**
It sets the prototype directly with **no constructor call** — no function body runs,
no arguments, no own properties. It is the purest statement of the model: an object
is own properties plus a link. `Object.create(null)` additionally gives you an object
with no chain at all.

**Why are methods on the prototype rather than on each instance?**
So a thousand instances share one function object instead of a thousand copies, and
so adding a method later is immediately visible on instances that already exist —
lookup is dynamic rather than a snapshot taken at construction.

---

← [How lookup walks the chain](./01-how-lookup-walks.md) · [Topic index](./README.md) · Next → [Writing, shadowing and mutating the chain](./03-writing-and-mutation.md)
