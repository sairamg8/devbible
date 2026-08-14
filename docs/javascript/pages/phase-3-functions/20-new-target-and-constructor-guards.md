---
title: "20 · `new.target` and constructor guards"
sidebar_label: "20 · new.target and guards"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`new`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new), [`class`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class), [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor), [`Reflect.construct()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode). Documentation-validated; **no timings**.

**A function does not know how it was called — except for this one thing.** `new.target` is a
meta-property, available in every function body, that answers exactly one question: *was I invoked
with `new`?*

```js
function Person(name) {
  console.log(new.target);
  this.name = name;
}

new Person("Ada");     // [Function: Person]  ← the constructor that was invoked
Person("Ada");         // undefined
```

That is the whole feature. Everything below is what it is *for*.

## The bug it exists to catch

Before `class`, a constructor was an ordinary function called with `new`, and **forgetting the
`new` was a silent disaster**:

```js
function Person(name) { this.name = name; }

const p = Person("Ada");     // 🔴 no `new`
p;                           // undefined — the function returned nothing
```

What `this` was depends on the mode, and both outcomes are bad:

- **Sloppy mode:** `this` is the global object, so `this.name = name` **writes a global**
  `name` and returns `undefined`. The failure surfaces somewhere else entirely, later.
- **Strict mode (so: any module):** `this` is `undefined`, and you get
  `TypeError: Cannot set properties of undefined (setting 'name')` — bad, but at least at the
  scene of the crime.

🔴 **This is the one bug `class` genuinely fixed.** A class constructor invoked without `new`
throws immediately:

```js
class Person { constructor(name) { this.name = name; } }
Person("Ada");     // TypeError: Class constructor Person cannot be invoked without 'new'
```

**So if you write classes, you do not need a guard.** The guard patterns below are for
constructor *functions* — which you will meet in existing code, in libraries that predate
classes, and anywhere a factory must work both ways.

## The two guards, and why the older one is worse

### The `instanceof` guard — the ES5 way

```js
function Person(name) {
  if (!(this instanceof Person)) return new Person(name);   // ⚠️ auto-new
  this.name = name;
}
```

It works for the common case and is still all over older source. **Two things are wrong with it:**

- **It cannot distinguish a missing `new` from a borrowed call.** `Person.call(someObj)` where
  `someObj` happens to inherit from `Person.prototype` passes the check, and
  `Person.call(unrelated)` silently constructs a fresh object instead of doing what the caller
  asked.
- **It breaks under subclassing.** In a subclass constructor `this` is a `Child`, which *is* an
  instance of `Person`, so the check passes — but the same test written in a helper that expects
  the exact type will not do what it looks like it does.

### The `new.target` guard — direct and honest

```js
function Person(name) {
  if (new.target === undefined) throw new TypeError("Person must be called with new");
  this.name = name;
}
```

It asks the actual question rather than inferring the answer from the prototype chain. Two
variants, and the choice between them is a design decision:

```js
if (!new.target) return new Person(name);        // forgiving — works either way
if (!new.target) throw new TypeError("…");       // strict — matches class behaviour
```

🔴 **Prefer throwing.** A function that silently works both ways has two call signatures forever,
and callers will use both. Matching what `class` does keeps one contract. Use the forgiving form
only for a deliberate dual-purpose factory — `jQuery`-style APIs where `Thing(x)` and
`new Thing(x)` are both documented.

## The genuinely modern use: an abstract base class

`new.target` is not only "was I called with `new`" — **it is *which constructor* was invoked**, and
that distinction is what makes abstract classes expressible:

```js
class Shape {
  constructor() {
    if (new.target === Shape) {
      throw new TypeError("Shape is abstract and cannot be instantiated directly");
    }
  }
}

class Circle extends Shape {}

new Circle();     // ✅ new.target is Circle
new Shape();      // 🔴 TypeError
```

**Why the equality check rather than a truthiness check:** in `new Circle()`, `Shape`'s constructor
still runs via `super()`, and `new.target` there is **`Circle`** — the constructor the `new` was
originally applied to, not the one currently executing. Testing `=== Shape` therefore means
"instantiated directly", which is exactly the abstract-class rule.

⚠️ **JavaScript has no `abstract` keyword.** This is the idiom that replaces it, and it is worth
recognising on sight.

The same property gives a constructor its subclass's identity:

```js
class Base {
  constructor() { this.kind = new.target.name; }    // "Circle" for new Circle()
}
```

## The corners

**Arrow functions inherit it.** An arrow has no `new.target` of its own, so it sees the enclosing
function's — the same rule as `this`:

```js
function Person() {
  const check = () => new.target;      // the enclosing Person's new.target
  console.log(check());                // [Function: Person] under `new Person()`
}
```

**`Reflect.construct` sets it explicitly.** The third argument *is* `new.target`, which is how
frameworks construct an instance of one class while reporting another — and how manual subclassing
of built-ins like `Error` and `Array` was done before `class` handled it:

```js
Reflect.construct(Base, [], Derived);   // runs Base, but new.target is Derived
```

See [08 · Errors and subclasses](../phase-8-modules-errors/03-error-and-subclasses/README.md).

**Methods get `undefined`.** A method is a function body, so `new.target` is legal there and always
`undefined` — methods are not constructable at all.

⚠️ **Outside a function body it is a `SyntaxError`**, not `undefined`. `new.target` at the top
level of a script or module does not compile.

## Gotchas

**Symptom:** A constructor function returned `undefined` and set global variables
**Cause:** Called without `new` in sloppy mode, so `this` was the global object.
**Fix:** A `new.target` guard, or a `class`, which throws on its own.

**Symptom:** `TypeError: Cannot set properties of undefined (setting 'x')`
**Cause:** The same missing `new`, in strict mode, where `this` is `undefined`.
**Fix:** Same — and note this is the *better* failure, because it points at the call.

**Symptom:** `TypeError: Class constructor X cannot be invoked without 'new'`
**Cause:** A class was called as a function — often by code that treats it as a factory, or by a transpiled call site.
**Fix:** Add `new`. Classes are never callable.

**Symptom:** An `instanceof`-based guard let a borrowed call through
**Cause:** `Fn.call(obj)` passes `this instanceof Fn` whenever `obj` inherits from `Fn.prototype`.
**Fix:** `new.target`, which reports the invocation rather than the prototype chain.

**Symptom:** An abstract-class guard rejected a subclass
**Cause:** The guard tested `!new.target` or `new.target !== undefined` instead of `new.target === Base`. During `super()`, `new.target` is the *subclass*.
**Fix:** Compare against the base class itself.

**Symptom:** `new.target` is `undefined` inside an arrow function that is inside a constructor
**Cause:** Arrows inherit it from the enclosing scope — so this means the enclosing function was itself called without `new`.
**Fix:** Check the outer call, not the arrow.

**Symptom:** `SyntaxError` on a line containing `new.target`
**Cause:** It appears outside any function body.
**Fix:** It is only meaningful inside a function; there is nothing to test at the top level.

**Symptom:** A dual-mode factory is called both ways in the codebase and behaves inconsistently
**Cause:** The forgiving `if (!new.target) return new Thing(…)` guard makes both call forms valid, so both get used.
**Fix:** Throw instead, unless dual use is a documented part of the API.

## Interview questions

**★ What is `new.target`?**
A meta-property available in any function body that reports how the function was invoked:
`undefined` for an ordinary call, and the constructor reference when called with `new`. In a class
constructor reached through `super()`, it is the constructor the `new` was originally applied to —
the subclass.

**★ What problem does it solve?**
Forgetting `new` on a constructor function. Without a guard, sloppy mode makes `this` the global
object and silently writes globals; strict mode throws a confusing `TypeError` about `undefined`.
`new.target` lets the function detect that directly.

**★ Do you need it with classes?**
No. A class constructor invoked without `new` throws `TypeError: Class constructor X cannot be
invoked without 'new'` on its own. Guards are for constructor functions in older code, or for
deliberately dual-purpose factories.

**★ Why is `new.target` better than `this instanceof Fn`?**
Because it asks the real question. The `instanceof` check infers the answer from the prototype
chain, so a borrowed call — `Fn.call(obj)` where `obj` inherits from `Fn.prototype` — passes it,
and an unrelated `this` silently gets auto-constructed instead of failing.

**★ How do you write an abstract class in JavaScript?**
Throw in the base constructor when `new.target === Base`. During `new Subclass()` the base
constructor still runs via `super()`, but `new.target` is the subclass, so only direct
instantiation is rejected. There is no `abstract` keyword; this is the idiom.

**★ What is `new.target` inside an arrow function?**
Inherited from the enclosing function, exactly like `this`. Arrows have none of their own, and are
not constructable.

**★ What does `Reflect.construct`'s third argument do?**
It sets `new.target` for the construction, so you can run one constructor while reporting another
as the target. That is how built-ins like `Error` and `Array` were subclassed before `class`
supported it properly.

**Should a guard throw or auto-`new`?**
Throw, in almost all cases — it matches class semantics and keeps one contract. Auto-`new` gives
the function two permanent call signatures, and once both appear in a codebase you can never
remove either.

---

← [19 · Function properties](./19-function-properties.md) · [Phase index](./README.md) · **Phase 3 complete** ✅
