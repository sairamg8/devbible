---
title: "1 · Factory, constructor, class"
sidebar_label: "1 · Factory, constructor, class"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`new`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain). Documentation-validated; **no timings**.

There are three ways to produce objects of the same shape, and the choice between them is one of
the few genuinely opinionated decisions in day-to-day JavaScript.

```js
// 1 · factory — a function that returns an object
function createUser(name) {
  return {
    name,
    greet() { return `Hi, ${name}`; },
  };
}

// 2 · constructor function — the pre-class idiom, still everywhere in older code
function User(name) {
  this.name = name;
}
User.prototype.greet = function () { return `Hi, ${this.name}`; };

// 3 · class — the same thing as 2, with syntax that says so
class UserClass {
  constructor(name) { this.name = name; }
  greet() { return `Hi, ${this.name}`; }
}
```

**2 and 3 are the same mechanism.** `class` desugars to a constructor function with methods on
`.prototype` — [06 · `class`](../06-class/README.md) covers exactly what it desugars to, and there
is no reason to write 2 in new code. The real decision is **1 versus 3**.

## The difference that decides everything else: where the methods live

```js
const a = createUser("Ada");
const b = createUser("Bob");
a.greet === b.greet;      // 🔴 false — each object got its own function

const c = new UserClass("Ada");
const d = new UserClass("Bob");
c.greet === d.greet;      // ✅ true — one function on the shared prototype
```

Everything below follows from those two lines.

| | Factory | Class |
|---|---|---|
| methods | one copy **per instance** | one copy on the **prototype** |
| `this` | not needed at all | needed, and losable |
| forgetting `new` | impossible — there is no `new` | `TypeError` (see below) |
| privacy | closure variables, genuinely private | `#private` fields, genuinely private |
| `instanceof` | ❌ no meaningful answer | ✅ works |
| inheritance | composition — merge objects, wrap functions | `extends`, `super`, a real chain |
| returning a different shape | trivial — just return something else | awkward; the constructor's return value is mostly ignored |
| method patching after the fact | per instance only | one prototype edit hits every instance, past and future |

⚠️ **"A function per instance" is a memory statement, not a performance verdict.** For a few
hundred objects it is irrelevant; for hundreds of thousands of small objects it is the reason the
prototype exists. **No timings appear here** — measure your own case if it is ever close.

## Privacy: the argument that used to settle it, and no longer does

The historical case for factories was that closures gave real privacy while classes had none:

```js
function createCounter() {
  let count = 0;                                  // unreachable from outside
  return {
    increment() { return ++count; },
    get value() { return count; },
  };
}
```

`#private` fields closed that gap — they are genuinely inaccessible, not a convention, and
`Object.keys`, `JSON.stringify` and `Object.freeze` all miss them alike
([12 · `Object.freeze` and `seal`](../12-freeze-and-seal/README.md) covers that last one):

```js
class Counter {
  #count = 0;
  increment() { return ++this.#count; }
  get value() { return this.#count; }
}
```

🔴 **So "I need privacy" is no longer a reason to pick a factory.** The remaining reasons are the
ones about shape and `this`, not about hiding.

## Forgetting `new`

```js
const u = UserClass("Ada");   // 🔴 TypeError: Class constructor UserClass cannot be invoked without 'new'
```

Classes protect themselves. **Constructor functions do not**, and that is the single strongest
argument against writing new code in style 2:

```js
"use strict";
const bad = User("Ada");   // 🔴 TypeError: Cannot set properties of undefined
// …and in sloppy mode: no error at all, and `name` is now a global
```

If you must expose a constructor function, guard it with `new.target` —
[Phase 3 · 20 · `new.target` and constructor guards](../../phase-3-functions/20-new-target-and-constructor-guards.md)
covers why the guard should **throw** rather than quietly call `new` for the caller.

**A factory has no such failure mode**, because there is nothing to forget. That is a real
ergonomic win, and it is why factories dominate in code that is handed to other people.

## Static factory methods — the pattern that ends most of these arguments

You rarely have to choose. A class with a named static method gets the prototype's method sharing
*and* the factory's ergonomics:

```js
class Money {
  #cents;
  constructor(cents) { this.#cents = cents; }

  static fromCents(cents) { return new Money(cents); }
  static fromString(s)    { return new Money(Math.round(parseFloat(s) * 100)); }
  static zero()           { return new Money(0); }
}

Money.fromString("12.50");
```

Three things this buys, and they are why it is the dominant shape in library code:

- **The name says what the input is.** `fromCents` and `fromString` cannot be confused; two
  constructor overloads could be — and JavaScript has no overloading, which is
  [Phase 3 · 16 · There is no function overloading](../../phase-3-functions/16-no-function-overloading.md).
- **A factory can fail cleanly.** `Money.parse(s)` can return `null`; a constructor cannot decline
  to construct without throwing.
- **A factory can return a cached or shared instance.** `Money.zero()` may hand back one frozen
  object every time. A constructor invoked with `new` always allocates.

## Composition, and why deep hierarchies fail here specifically

The factory's other advantage is that behaviour merges instead of nesting:

```js
const canFly   = (state) => ({ fly:   () => `${state.name} flies` });
const canSwim  = (state) => ({ swim:  () => `${state.name} swims` });

function createDuck(name) {
  const state = { name };
  return { ...state, ...canFly(state), ...canSwim(state) };
}
```

With classes the same thing needs mixins, because **`extends` takes exactly one parent**. A deep
chain then couples every level to every level below it, and JavaScript gives you no interfaces to
soften it — the argument in full is **18 · Mixins and composition over inheritance**
*(not written yet)*.

**Two levels of `extends` is usually fine. Four is a smell.** Composition scales where inheritance
does not, and the language's own libraries reflect that.

## How to choose, in practice

- **Data with behaviour, created in bulk, with a hierarchy** — a class. Errors, domain models,
  anything you will `instanceof` or subclass.
- **A thing you hand to callers, or one that must not break when someone forgets `new`** — a
  factory, or a class with static factory methods.
- **A one-off object** — an object literal. Do not build a class for a single instance; a module
  with exported functions is the JavaScript singleton, and it is simpler than any of this.
- **A plain bag of data** — an object literal or a `Map`. Nothing here applies.

⚠️ **Do not mix the styles within one module.** The cost of the choice is small; the cost of a
codebase where half the types are factories and half are classes is not, because every caller has
to remember which is which and whether `new` is required.

## Gotchas

**Symptom:** `TypeError: Class constructor X cannot be invoked without 'new'`
**Cause:** A class was called as a plain function — often a callback that receives a constructor.
**Fix:** Wrap it: `(...args) => new X(...args)`, or expose a static factory method.

**Symptom:** A constructor function called without `new` created globals, silently
**Cause:** Sloppy mode — `this` was `globalThis` and every assignment landed there.
**Fix:** Use a class, or guard with `new.target` and throw. Modules are strict, which turns it into a `TypeError` at least.

**Symptom:** Two objects from the same factory have non-identical methods
**Cause:** Each call creates new function objects. That is how factories work.
**Fix:** Nothing, unless it matters — and then it is a class, or hoist the functions and pass state explicitly.

**Symptom:** A memoisation or dependency check keeps seeing "changed" for a factory's method
**Cause:** Same reason — the identity is new every call, so any `===` comparison fails.
**Fix:** A class puts the method on the prototype, so its identity is stable across instances.

**Symptom:** `instanceof` does not work for objects from a factory
**Cause:** There is no constructor in the chain to name.
**Fix:** Expected. Use a branded `isFoo()` — [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/02-where-it-fails.md).

**Symptom:** Adding a method to a prototype changed behaviour for objects created earlier
**Cause:** Prototype methods are looked up live, not copied at construction.
**Fix:** That is the feature. It is also why monkey-patching a prototype is a global change — **16 · Prototype patterns to avoid** *(not written yet)*.

**Symptom:** A class hierarchy needs behaviour from two parents
**Cause:** `extends` takes one parent.
**Fix:** Compose — merge behaviour objects, or use mixin functions. Do not deepen the chain.

## Interview questions

**★ What is the difference between a factory function and a class?**
Where the methods live. A factory returns a fresh object with its own copies of every method; a
class puts one copy on the prototype and every instance shares it. From that follow all the other
differences — `instanceof`, `this`, inheritance versus composition, and whether forgetting `new` is
possible at all.

**★ Is closure privacy still a reason to prefer factories?**
No longer. `#private` fields give classes genuine privacy — not a convention — and they are
invisible to `Object.keys`, `JSON.stringify` and `Object.freeze` just as closure variables are. The
remaining reasons to pick a factory are about shape and ergonomics.

**★ What happens if you call a class without `new`? A constructor function?**
The class throws `TypeError: Class constructor cannot be invoked without 'new'`. The constructor
function does not protect itself: in strict mode `this` is `undefined` and the first assignment
throws; in sloppy mode `this` is `globalThis` and it silently creates globals. Guard with
`new.target` if you must ship one.

**★ Why do library APIs so often expose static factory methods instead of constructors?**
They name their input (`Money.fromCents` vs `Money.fromString` — JavaScript has no overloading),
they can fail by returning `null` instead of throwing, and they can return a cached or shared
instance where `new` must always allocate. You still get prototype method sharing.

**★ When would you choose composition over `extends`?**
Whenever behaviour comes from more than one source, or the hierarchy would go past two levels.
`extends` takes exactly one parent and couples every level to the ones below it. Merging behaviour
objects or applying mixin functions scales; a four-level chain does not.

**Do factory objects cost more memory?**
Each instance holds its own function objects rather than sharing one prototype copy. For a few
hundred objects that is irrelevant; for hundreds of thousands of small ones it is exactly what the
prototype exists to avoid. Measure before treating it as a problem.

**What is the JavaScript equivalent of a singleton?**
A module. Module bodies execute once and the exports are shared by every importer, so an exported
object *is* a singleton with no pattern required — and no class needed for a single instance.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · `Object.create` and null-prototype dictionaries](./02-object-create-and-dictionaries.md) →
