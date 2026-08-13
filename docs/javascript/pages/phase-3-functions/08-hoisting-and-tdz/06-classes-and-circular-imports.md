---
title: "08.6 · Classes and circular imports"
sidebar_label: "06 · Classes and circular imports"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`class`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class), [JavaScript modules guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). Documentation-validated.

The last two places the dead zone bites — and the second one is the most confusing
TDZ error you will ever get, because its two halves are in different files.

## Classes are lexical declarations, all the way down

MDN: *"`class` declarations can only be accessed after the place of declaration is
reached (see temporal dead zone). For this reason, `class` declarations are commonly
regarded as non-hoisted (unlike function declarations)."*

So the intuition "classes are just functions under the hood, and functions hoist" is
**wrong in the one way that matters**:

```js
new Foo();          // ReferenceError: Cannot access 'Foo' before initialization
class Foo {}
```

Whereas the `function Foo() {}` equivalent would have worked. This is the single
most common surprise when a codebase migrates constructor functions to `class`, and
the fix is ordering: **define classes before you use them.**

MDN notes two further ways `class` behaves lexically rather than like `function`:

- *"`class` declarations are scoped to blocks as well as functions."*
- *"`class` declarations do not create properties on `globalThis` when declared at
  the top level of a script (unlike function declarations)."*

Together with the TDZ, that is three separate ways a `class` behaves like `let` and
not like `function`. The `class` keyword is sugar over prototypes, but its
*declaration* semantics are lexical throughout.

### The class binding is const-like inside the body

```js
class Foo {
  static {
    Foo = 1; // TypeError: Assignment to constant variable.
  }
}

class Foo2 {
  bar = (Foo2 = 1); // TypeError: Assignment to constant variable.
}

class Foo3 {}
Foo3 = 1;
console.log(Foo3); // 1
```

Inside the class body — static blocks, field initialisers, methods — the class name
is an **immutable binding**. Outside, it is an ordinary `let`-like binding you can
reassign.

That inner binding is what lets a method safely refer to its own class by name
without the risk of someone reassigning the outer name out from under it. It is the
same guarantee a named function expression gets for its own name.

MDN also confirms *"The class body of a class declaration is executed in strict
mode"* — which loops back to
[chunk 5](./05-block-functions-and-parameters.md): any function declaration you write
inside a class body's block is in the well-defined strict-mode case.

### `extends` is evaluated at the declaration, not at `new`

```js
class Child extends Parent {}   // ReferenceError if Parent is still in its TDZ
class Parent {}
```

The `extends` clause is an **expression**, evaluated when the `class` statement
executes. If `Parent` is a class declared below, it is still uninitialised at that
moment.

Two classes that reference each other in their `extends` clauses therefore cannot
both be satisfied — a genuine ordering constraint, not a style preference. Inside
method *bodies* there is no such problem, because those do not run until called.

## Circular ES module imports

MDN, on import hoisting:

> *"Import declarations are hoisted. In this case, it means that the imported values
> are available in the module's code even before the place that declares them, and
> that the imported module's side effects are produced before the rest of the
> module's code starts running."*

That is the *value plus side-effect* hoisting row from
[chunk 1](./01-the-two-step-scope-entry.md)'s table, and it is why `import`
statements at the bottom of a file still work. It is also why imports being **live,
read-only views** matters:

> *"The imported values are read-only views of the features that were exported.
> Similar to `const` variables, you cannot re-assign the variable that was imported,
> but you can still modify properties of object values. The value can only be
> re-assigned by the module exporting it."*

Now the circular case:

```js
// -- b.js --
import { a } from "./a.js";
console.log(a); // ReferenceError: Cannot access 'a' before initialization
```

MDN's framing:

> *"Cyclic imports don't always fail. The imported variable's value is only
> retrieved when the variable is actually used (hence allowing live bindings), and
> only if the variable remains uninitialized at that time will a `ReferenceError` be
> thrown."*

**Why this happens:** module evaluation is depth-first. `a.js` starts, hits its
import of `b.js`, so `b.js` is evaluated *first* — and `b.js` immediately reads `a`,
which `a.js` has declared (the binding exists, hoisted) but not yet initialised,
because `a.js` never got past its own import statement. A dead zone, across a file
boundary.

**Three things follow, and they are the practical payoff of this whole topic:**

- **It is the same error string** you get from a local `let` used too early —
  `Cannot access 'X' before initialization`. If you see it and cannot find any local
  declaration to blame, **look for an import cycle.**
- **Deferring the read fixes it.** MDN notes asynchronous access succeeds, because by
  the time the callback or awaited continuation runs, the exporting module has
  finished evaluating. Reading the import *inside a function you export*, rather than
  at module top level, is the standard fix — the function is not called until
  everything has loaded.
- **A cycle is not automatically a bug.** Only a top-level *read* of a
  not-yet-initialised binding is. Plenty of cyclic graphs work fine, which is exactly
  why the ones that break are so surprising.

### Contrast with CommonJS

Worth holding, since bundled code mixes both. `require` has **no dead zone**: a
circular `require` gives you a **partially populated `module.exports` object** —
typically `undefined` properties — with no error at all.

ESM turns that silent half-initialised value into a loud `ReferenceError`, which is
the same trade the TDZ makes everywhere else: fail at the mistake rather than
produce a wrong value that fails later.

## The practical summary

| Situation | What to do |
|---|---|
| Function declaration inside a block | Only in strict mode; prefer a `const`-assigned function expression |
| Default parameter referencing another parameter | Only left to right; never reference the body from a default |
| `var` shadowing a parameter name | Don't — the body binding is separate from the parameter one |
| Class used above its declaration | Reorder; classes do not value-hoist |
| Two classes in each other's `extends` | Impossible; break the cycle |
| `Cannot access 'X'` with no local `X` | Look for a circular import |
| Circular import that must stay | Move the read inside an exported function |

## Gotchas

**Symptom:** `Cannot access 'Foo' before initialization` for a class that is plainly
defined in the file
**Cause:** Class declarations are lexical — TDZ, not value hoisting. The
constructor-function version of the same code would have worked.
**Fix:** Move the class above its first use. For an `extends` cycle, break the cycle;
`extends` is evaluated when the declaration runs.

**Symptom:** `TypeError: Assignment to constant variable.` when assigning to a
class's own name inside a static block or field initialiser
**Cause:** Inside the class body the class name is an immutable binding (MDN).
Outside it is reassignable.
**Fix:** Use a different variable for whatever you were storing.

**Symptom:** A class is not on `globalThis` at script top level, but a function is
**Cause:** MDN: *"`class` declarations do not create properties on `globalThis`
… (unlike function declarations)."*
**Fix:** Expected. Export it, or attach it explicitly if a global is genuinely
required.

**Symptom:** `Cannot access 'X' before initialization` and there is no local `X`
anywhere
**Cause:** A circular ES module import — the exporting module has not finished
evaluating, so the imported binding is still uninitialised.
**Fix:** Move the read inside an exported function so it happens after load, or break
the cycle by extracting the shared piece into a third module. MDN notes asynchronous
access succeeds for the same reason.

**Symptom:** A circular import gives `undefined` properties instead of throwing
**Cause:** That is CommonJS, not ESM. `require` returns a partially populated
`module.exports` with no error.
**Fix:** The silent version is worse. Prefer ESM, and treat the `undefined` as the
same cycle problem.

**Symptom:** An `import` statement at the bottom of a file works fine
**Cause:** Import declarations are hoisted, and the imported module's side effects
run before the rest of your code (MDN).
**Fix:** Nothing to fix — but conventionally imports go at the top, because their
position does not reflect when they run.

## Interview questions

**★ Are classes hoisted?**
The binding is created, but left **uninitialised** — classes are in the TDZ, so
using one above its declaration throws `ReferenceError: Cannot access 'X' before
initialization`. MDN describes them as *"commonly regarded as non-hoisted (unlike
function declarations)"*. They are also block scoped and never create `globalThis`
properties.

**★ You get `Cannot access 'X' before initialization` but there is no `let X`
anywhere in the file. What is it?**
Almost certainly a **circular ES module import**: the module exporting `X` has not
finished evaluating, so the hoisted import binding is still uninitialised. Fix by
reading `X` inside an exported function instead of at module top level, or by
breaking the cycle.

**★ How does a circular import fail differently in CommonJS?**
CommonJS has no dead zone: a circular `require` returns a **partially populated**
`module.exports`, usually with `undefined` properties and no error. ESM throws
`ReferenceError` instead — the same trade the TDZ makes everywhere, a loud failure in
place of a silent wrong value.

**Why can't two classes extend each other?**
Because `extends` is an expression evaluated **when the class declaration executes**,
not when you call `new`. Whichever class is declared first will find the other still
in its TDZ. Method bodies have no such constraint, since they do not run until
called.

**Are imports mutable?**
No — MDN describes them as *"read-only views"*, like `const`: you cannot reassign the
imported binding, though you can mutate properties of an imported object. Only the
exporting module can change the value, and the change is visible to importers because
the binding is live.

**Why does an `import` at the bottom of a file still work?**
Because import declarations are hoisted, and their side effects are produced before
the rest of the module's code runs. Position in the file has no bearing on when the
imported module is evaluated.

---

← [Block functions and the parameter list](./05-block-functions-and-parameters.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
