---
title: "08.3 · Where hoisting and the TDZ actually bite"
sidebar_label: "03 · Where it actually bites"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function), [`class`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [JavaScript modules guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). Documentation-validated.

The first two chunks covered the mechanism. This one covers the four places where
it produces an error that **does not look like a hoisting error**, and where
knowing the mechanism is the difference between a five-minute fix and an hour.

## 1. Function declarations inside blocks

A function declaration at the top level of a function or module is simple: value
hoisting, covered in [chunk 1](./01-what-hoisting-actually-is.md). A function
declaration **inside a block** is not simple, and the answer depends on strict
mode.

### In strict mode — which is every module and every class body

MDN: *"In strict mode, block-level function declarations are scoped to that block
and are hoisted to the top of the block."*

```js
"use strict";

{
  foo(); // Logs "foo"
  function foo() {
    console.log("foo");
  }
}

console.log(
  `'foo' name ${
    "foo" in globalThis ? "is" : "is not"
  } global. typeof foo is ${typeof foo}`,
);
// 'foo' name is not global. typeof foo is undefined
```

Two facts in that output, both worth holding:

- **Inside the block**, `foo` is hoisted normally — the call above the declaration
  works.
- **Outside the block**, `foo` does not exist at all. It behaved like a `let`: block
  scoped, and gone when the block ended.

So in strict mode a block-level function declaration is well-behaved and
predictable. It is simply narrower than people expect.

### In sloppy mode — do not

MDN is unusually blunt here, as a **warning** rather than a note:

> *"In non-strict mode, function declarations inside blocks behave strangely. Only
> declare functions in blocks if you are in strict mode."*

MDN documents that the results vary across Chrome, Firefox and Safari. This is the
Annex B / legacy-web-compatibility corner of the language: block-level function
declarations were never legal in sloppy ES5, engines each invented something, and
the standard later had to describe the mess rather than fix it.

MDN adds one detail that catches people even when they think they know the rule:

> *"The scoping and hoisting effect won't change regardless of whether the `if`
> body is actually executed."*

That is, a function declaration inside an `if (false) { … }` block still affects
the enclosing scope. The declaration is processed when the scope is set up; the
branch never running does not undo it.

**The rule to actually follow:** never write a function *declaration* inside a
block. If you want a function that only exists conditionally, assign a function
expression to a `let` or `const`:

```js
let handler;
if (mode === "fast") {
  handler = () => { /* … */ };
} else {
  handler = () => { /* … */ };
}
```

This has one behaviour in every engine and every mode, and the binding is exactly
where you wrote it. In practice, modules are strict, so most modern code lands in
the well-defined case anyway — but the moment you touch a `<script>` without
`type="module"`, a bundler's CommonJS output, or a legacy file, sloppy mode is
back.

## 2. The parameter list has its own TDZ

The parameter list is a scope of its own, and it initialises **left to right**. So
a default that reads a parameter declared *later* hits an uninitialised binding —
a TDZ error, in a place nobody thinks of as having a dead zone.

MDN: *"The default parameter initializers live in their own scope, which is a
parent of the scope created for the function body. This means that earlier
parameters can be referred to in the initializers of later parameters."*

Earlier → later is fine:

```js
function greet(name, greeting, message = `${greeting} ${name}`) {
  return [name, greeting, message];
}

greet("David", "Hi"); // ["David", "Hi", "Hi David"]
```

Later → earlier throws. `function broken(a = b, b = 2)` called as `broken()` fails
with `ReferenceError: Cannot access 'b' before initialization`, and so does the
self-referencing `(function (a = a) {})()` — both **measured** in
[02 · Defaults and the parameter scope](../02-parameters/01-defaults-and-scope.md),
where the console output lives.

### The body is a *child* scope, not the same scope

The second half of MDN's sentence is the part that produces genuinely confusing
bugs:

> *"functions and variables declared in the function body cannot be referred to
> from default value parameter initializers; attempting to do so throws a run-time
> `ReferenceError`."* — and *"This also includes `var`-declared variables in the
> function body."*

```js
function f(a = go()) {
  function go() {
    return ":P";
  }
}

f(); // ReferenceError: go is not defined
```

`go` is a hoisted function declaration — it would be callable from anywhere in the
*body*. But the default initialiser does not run in the body scope; it runs in the
parameter scope, which is the body's **parent**. Parents cannot see into children.

Note the error here is `go is not defined`, not `Cannot access 'go' before
initialization`. There is no binding named `go` in the parameter scope at all, so
this is a plain lookup failure, not a dead-zone access. **Two different errors,
two different causes** — exactly the distinction drawn in
[chunk 2](./02-the-temporal-dead-zone.md).

And the shadowing consequence:

```js
function f(a, b = () => console.log(a)) {
  var a = 1;
  b();
}

f();  // undefined
f(5); // 5
```

The `var a` in the body is a **separate binding** from the parameter `a`. The
closure `b` was created in the parameter scope and captured the *parameter*, so
`var a = 1` in the body never touches what `b` sees. This is the clearest possible
demonstration that the two scopes are genuinely distinct, and it is why
`var`-shadowing a parameter is worth banning outright.

## 3. Classes are lexical declarations, all the way down

MDN: *"`class` declarations can only be accessed after the place of declaration is
reached (see temporal dead zone). For this reason, `class` declarations are
commonly regarded as non-hoisted (unlike function declarations)."*

So the intuition "classes are just functions under the hood, and functions hoist"
is **wrong in the one way that matters**:

```js
new Foo();          // ReferenceError: Cannot access 'Foo' before initialization
class Foo {}
```

Whereas the `function Foo() {}` equivalent would have worked. This is the single
most common surprise when a codebase migrates constructor functions to `class`,
and the fix is ordering: define classes before you use them.

MDN also notes two further ways `class` behaves lexically rather than like
`function`:

- *"`class` declarations are scoped to blocks as well as functions."*
- *"`class` declarations do not create properties on `globalThis` when declared at
  the top level of a script (unlike function declarations)."*

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

Inside the class body — static blocks, field initialisers, methods — the class
name is an **immutable binding**. Outside, it is an ordinary `let`-like binding you
can reassign. That inner binding is what lets a method safely refer to its own
class by name without the risk of someone reassigning the outer name out from
under it.

MDN also confirms *"The class body of a class declaration is executed in strict
mode"* — which loops back to §1: any function declaration you write inside a class
body's block is in the well-defined strict-mode case.

### `extends` is evaluated at the declaration, not at `new`

```js
class Child extends Parent {}   // ReferenceError if Parent is still in its TDZ
class Parent {}
```

The `extends` clause is an *expression*, evaluated when the `class` statement
executes. If `Parent` is a class declared below, it is still uninitialised at that
moment. Two classes that reference each other in their `extends` clauses cannot
both be satisfied — a genuine ordering constraint, not a style preference. Inside
method *bodies* there is no such problem, because those do not run until called.

## 4. Circular ES module imports

The most confusing TDZ error you will ever get, because the two halves of it are
in different files.

MDN, on import hoisting:

> *"Import declarations are hoisted. In this case, it means that the imported
> values are available in the module's code even before the place that declares
> them, and that the imported module's side effects are produced before the rest
> of the module's code starts running."*

That is the *value plus side-effect* hoisting row from
[chunk 1](./01-what-hoisting-actually-is.md)'s table, and it is why `import`
statements at the bottom of a file still work. It is also why imports being live
read-only views matters:

> *"The imported values are read-only views of the features that were exported.
> Similar to `const` variables, you cannot re-assign the variable that was
> imported, but you can still modify properties of object values. The value can
> only be re-assigned by the module exporting it."*

Now the circular case:

```js
// -- b.js --
import { a } from "./a.js";
console.log(a); // ReferenceError: Cannot access 'a' before initialization
```

MDN's framing:

> *"Cyclic imports don't always fail. The imported variable's value is only
> retrieved when the variable is actually used (hence allowing live bindings), and
> only if the variable remains uninitialized at that time will a `ReferenceError`
> be thrown."*

Unpack why this happens. Module evaluation is depth-first: `a.js` starts, hits its
import of `b.js`, so `b.js` is evaluated *first* — and `b.js` immediately reads `a`,
which `a.js` has declared (the binding exists, hoisted) but not yet initialised,
because `a.js` never got past its own import statement. Dead zone, across a file
boundary.

**Three things follow, and they are the practical payoff of this whole topic:**

- **It is the same error string** you get from a local `let` used too early —
  `Cannot access 'X' before initialization`. If you see it and cannot find any
  local declaration to blame, look for an import cycle.
- **Deferring the read fixes it.** MDN notes asynchronous access succeeds, because
  by the time the callback or awaited continuation runs, the exporting module has
  finished evaluating. Reading the import *inside a function you export* rather
  than at module top level is the standard fix — the function is not called until
  everything has loaded.
- **A cycle is not automatically a bug.** Only a top-level *read* of a
  not-yet-initialised binding is. Plenty of cyclic graphs work fine, which is
  exactly why the ones that break are so surprising.

Worth contrasting with CommonJS, since bundled code mixes both: `require` has no
dead zone. A circular `require` gives you a **partially populated `module.exports`
object** — typically `undefined` properties — with no error at all. ESM turns that
silent half-initialised value into a loud `ReferenceError`, which is the same
trade the TDZ makes everywhere else.

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

**Symptom:** A function declared inside an `if` block is visible (or invisible)
outside it, differently across browsers
**Cause:** Sloppy-mode block-level function declarations — MDN warns they *"behave
strangely"* and that results vary across Chrome, Firefox and Safari.
**Fix:** Use strict mode (any module already is), where the declaration is block
scoped and hoisted to the top of that block. Better: assign a function expression
to a `const`.

**Symptom:** A function declared inside `if (false) { … }` still affects the outer
scope
**Cause:** MDN: *"The scoping and hoisting effect won't change regardless of
whether the `if` body is actually executed."* Scope setup happens before the branch
is evaluated.
**Fix:** Same as above — do not declare functions in blocks.

**Symptom:** `ReferenceError: Cannot access 'b' before initialization` pointing at a
parameter default
**Cause:** The parameter list initialises left to right and has its own TDZ; the
default read a parameter declared to its right. Measured in
[02 · Defaults and the parameter scope](../02-parameters/01-defaults-and-scope.md).
**Fix:** Reorder the parameters so dependencies come first.

**Symptom:** `ReferenceError: go is not defined` when `go` is a hoisted function
right there in the body
**Cause:** Defaults evaluate in the parameter scope, which is the body scope's
**parent** — MDN states body functions and variables, *"including `var`-declared
variables"*, are unreachable from a default.
**Fix:** Move the default's logic into the body (`if (a === undefined) a = go();`),
or hoist the helper out of the function entirely.

**Symptom:** A closure created in a default parameter ignores a `var` of the same
name in the body
**Cause:** They are two distinct bindings in two distinct scopes.
**Fix:** Do not shadow a parameter with a `var`. MDN's example logs `undefined` for
`f()` and `5` for `f(5)` — the parameter, never the body's `a`.

**Symptom:** `Cannot access 'Foo' before initialization` for a class that is
plainly defined in the file
**Cause:** Class declarations are lexical — TDZ, not value hoisting. The
constructor-function version of the same code would have worked.
**Fix:** Move the class above its first use. For an `extends` cycle, break the
cycle; `extends` is evaluated when the declaration runs.

**Symptom:** `TypeError: Assignment to constant variable.` when assigning to a
class's own name inside a static block or field initialiser
**Cause:** Inside the class body the class name is an immutable binding (MDN).
Outside it is reassignable.
**Fix:** Use a different variable for whatever you were storing.

**Symptom:** `Cannot access 'X' before initialization` and there is no local `X`
anywhere
**Cause:** A circular ES module import — the exporting module has not finished
evaluating, so the imported binding is still uninitialised.
**Fix:** Move the read inside an exported function so it happens after load, or
break the cycle by extracting the shared piece into a third module. MDN notes
asynchronous access succeeds for the same reason.

## Interview questions

**★ Do function declarations inside blocks hoist?**
In strict mode yes, but only to the top of **that block** — they are block scoped
and do not exist outside it (MDN). In sloppy mode the behaviour is Annex B legacy
and MDN warns it differs across Chrome, Firefox and Safari. The declaration also
takes effect even if the block never executes. Use a `const`-assigned function
expression instead.

**★ Are classes hoisted?**
The binding is created, but left uninitialised — classes are in the TDZ, so using
one above its declaration throws `ReferenceError: Cannot access 'X' before
initialization`. MDN describes them as *"commonly regarded as non-hoisted (unlike
function declarations)"*. They are also block scoped and never create
`globalThis` properties.

**★ Why does `function f(a = b, b = 2)` throw?**
The parameter list is its own scope and initialises left to right, so `b` is still
uninitialised when `a`'s default runs — the same TDZ rule as `let`, applied to
parameters. Left-to-right references are fine; right-to-left are not.

**★ You get `Cannot access 'X' before initialization` but there is no `let X`
anywhere in the file. What is it?**
Almost certainly a circular ES module import: the module exporting `X` has not
finished evaluating, so the hoisted import binding is still uninitialised. Fix by
reading `X` inside an exported function instead of at module top level, or by
breaking the cycle.

**Why can a default parameter not see a `var` or function declared in the body?**
Because defaults evaluate in the parameter scope, which MDN describes as *"a parent
of the scope created for the function body"*. A parent scope cannot see its
child's bindings. The error is `X is not defined` — a lookup failure, not a TDZ
access.

**How does a circular import fail differently in CommonJS?**
CommonJS has no dead zone: a circular `require` returns a partially populated
`module.exports`, usually with `undefined` properties and no error. ESM throws
`ReferenceError` instead — the same trade the TDZ makes everywhere, a loud failure
in place of a silent wrong value.

---

← [The temporal dead zone](./02-the-temporal-dead-zone.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
