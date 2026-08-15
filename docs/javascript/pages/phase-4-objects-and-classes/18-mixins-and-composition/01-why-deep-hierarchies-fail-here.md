---
title: "1 · Why deep hierarchies fail in JavaScript specifically"
sidebar_label: "1 · Why they fail here"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [Public class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain). Documentation-validated; **no timings**.

"Prefer composition over inheritance" is advice every language gives. **JavaScript has four
specific reasons it matters more here**, and knowing them is the difference between repeating a
slogan and making a decision.

## 1 · `extends` takes exactly one parent, and there are no interfaces

```js
class Duck extends Bird {}      // ✅
class Duck extends Bird, Swimmer {}   // 🔴 SyntaxError
```

In a language with interfaces you would declare `Duck implements Swimmer` and supply the behaviour
separately. JavaScript has no interfaces at all — **TypeScript's are erased at build time**, so at
runtime there is nothing to declare a contract with. The only two ways to say "this thing can swim"
are to inherit an implementation or to hold one.

That is why the pressure to deepen the chain is stronger here: `extends` is the only *language*
mechanism for shared behaviour, so it gets used for things that are not really "is-a".

## 2 · Nothing enforces an abstract method

```js
class Repository {
  save() { throw new Error("save() must be implemented"); }   // the only enforcement available
}
```

There is no `abstract` keyword. A subclass that forgets `save()` fails **at the moment it is
called**, in production, rather than at definition time. The nearest thing to a real guard is a
`new.target` check that stops the base class being instantiated directly —
[Phase 3 · 20 · `new.target` and constructor guards](../../phase-3-functions/20-new-target-and-constructor-guards.md)
— and that still says nothing about whether the methods exist.

**Deep hierarchies rely on abstract contracts. JavaScript cannot check them.** Every level added is
another set of unenforced assumptions.

## 3 · The fragile base class problem is worse, because fields initialise late

```js
class Base {
  constructor() { this.setup(); }        // calls an overridable method
  setup() {}
}

class Derived extends Base {
  items = [];                            // 🔴 initialised AFTER super() returns
  setup() { this.items.push("ready"); }  // 🔴 TypeError: Cannot read properties of undefined
}

new Derived();
```

The base constructor runs first, `setup()` dispatches dynamically to the subclass override, and the
subclass's field does not exist yet — derived fields are initialised only once `super()` returns.
With `#private` fields it is a `TypeError` rather than `undefined`. The full ordering is in
[09 · `extends` and `super`](../09-extends-and-super/01-the-two-chains-and-construction.md).

🔴 **The general shape:** because every method call is a *dynamic lookup* through the prototype
chain, a base class cannot call any of its own methods without possibly calling a subclass's
version. A change in the base that looks internal — "I'll factor this into a helper method" —
becomes a change in the subclass's contract. **The deeper the chain, the more of these there are,
and none of them are visible from either file alone.**

## 4 · The type buys you nothing, because everything is duck-typed

The payoff for a hierarchy in a static language is dispatch and type safety. In JavaScript, code
that consumes your object almost never asks what class it is — it asks whether it has a `then`, a
`length`, a `pipe`. `await` does not check `instanceof Promise`
([13 · Where `instanceof` fails](../13-instanceof-and-hasinstance/02-where-it-fails.md)), and
`instanceof` is unreliable across realms and duplicate package copies anyway.

**So the hierarchy costs coupling and returns very little.** Composition returns the same
capability with none of it.

## What the depth actually costs

```
Component → BaseWidget → InteractiveWidget → FormControl → TextInput → EmailInput
```

- **To read `EmailInput` you must read six files**, because any method may be defined or overridden
  at any level, and `super.x` resolves at whichever level the method's home object sits.
- **A change at level 2 can break level 6** in a way no test at level 2 covers.
- **The wrong axis gets frozen early.** The first classification you pick becomes structural, and
  the second axis you discover — "some of these are async, some are not" — has nowhere to go.
- 🔴 **The "gorilla/banana" problem:** you wanted one method and inherited the whole tree above it,
  including its constructor requirements, its fields, and its assumptions.

**Two levels is usually fine. Four is a smell. Six is a rewrite.**

## When inheritance is still right

This is not an argument for never using `extends`:

- **Extending a built-in with real semantics** — `class NotFoundError extends Error` is correct,
  idiomatic and necessary for `instanceof Error` to work
  ([Phase 8 · 03](../../phase-8-modules-errors/03-error-and-subclasses/README.md)).
- **A framework base class you do not control** — if the framework's contract is `extends
  Controller`, that is the API.
- **One genuine "is-a" level**, where every subclass really is a specialisation and the base has no
  behaviour that subclasses need to override for correctness.

⚠️ **The test that works in practice:** if you find yourself overriding a method *to disable it* —
`throw new Error("not supported here")` — the hierarchy is wrong. That is inheritance being used to
share code between things that are not the same kind of thing.

## The arc the JavaScript ecosystem already went through

Worth knowing because it is the industry's own answer to this question:

**React mixins → higher-order components → hooks.** `React.createClass` supported mixins; they were
deprecated because of exactly the problems above — implicit dependencies between mixins, silent name
collisions, and no way to tell where a property came from. HOCs replaced them with wrapping
(composition), and hooks replaced *those* with plain function calls. **Each step moved further from
inheritance and closer to "just call a function"**, and each was driven by the same failure: shared
behaviour that is not a hierarchy.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined` in a method called from the base constructor
**Cause:** Derived fields initialise after `super()` returns, so the subclass state does not exist yet.
**Fix:** Do not call overridable methods from a constructor. Use an explicit `init()` the caller invokes, or a factory.

**Symptom:** A subclass forgot to implement a method and nothing complained until production
**Cause:** JavaScript has no abstract methods; the base's `throw` only fires when called.
**Fix:** Throw in the base as a floor, guard the base with `new.target`, and cover it with a test — the language will not.

**Symptom:** Refactoring a base-class method into two broke a subclass
**Cause:** Method calls are dynamic lookups, so an "internal" call can land on an override.
**Fix:** Treat every method a base class calls on `this` as public API. Or stop inheriting.

**Symptom:** A subclass overrides a method purely to disable it
**Cause:** The hierarchy is sharing code between things that are not the same kind of thing.
**Fix:** Extract the shared code into a function or a collaborator and compose.

**Symptom:** The class hierarchy cannot express a second dimension
**Cause:** Single inheritance froze the first axis you picked.
**Fix:** Compose the second axis. This is the point at which mixins earn their place — [chunk 2](./02-the-three-patterns.md).

**Symptom:** `SyntaxError` on `class X extends A, B`
**Cause:** `extends` takes one parent.
**Fix:** A subclass-factory mixin, or composition.

## Interview questions

**★ Why does "prefer composition over inheritance" apply especially to JavaScript?**
Four reasons specific to the language: `extends` takes one parent and there are no runtime
interfaces to declare a contract with; nothing enforces abstract methods, so a missing
implementation fails when called; derived fields initialise after `super()` returns, so a base
constructor calling an overridable method sees subclass state that does not exist; and consumers
duck-type anyway, so the hierarchy buys almost no dispatch benefit.

**★ What is the fragile base class problem, and what makes it worse here?**
A change inside a base class breaking subclasses that did nothing wrong. It is worse in JavaScript
because every method call is a dynamic prototype lookup, so a base class factoring work into a
helper method may now be calling a subclass override — and because field-initialisation order means
that override can run before the subclass's own fields exist.

**★ When is `extends` the right tool?**
Extending built-ins with real semantics (`class NotFoundError extends Error` — required for
`instanceof Error`), conforming to a framework base class you do not control, and one genuine
"is-a" level where no subclass needs to override behaviour for correctness.

**★ What is the practical test for a hierarchy that has gone wrong?**
A subclass overriding a method to disable it — `throw new Error("not supported")`. That means code
is being shared between things that are not the same kind of thing, and the shared part belongs in a
function or a collaborator.

**★ What does React's mixins → HOCs → hooks history tell you?**
That the ecosystem hit these exact problems and moved away from inheritance-shaped sharing in
stages. Mixins failed on implicit inter-dependencies and silent name collisions; HOCs replaced them
with composition; hooks replaced those with plain function calls. The direction of travel is always
toward "just call a function".

**Why can a base class not safely call its own methods?**
Because `this.method()` is a dynamic lookup, so it resolves to the subclass's override whenever one
exists. Every method a base class calls on `this` is effectively public API, whether or not it was
meant to be.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · The three patterns, and choosing](./02-the-three-patterns.md) →
