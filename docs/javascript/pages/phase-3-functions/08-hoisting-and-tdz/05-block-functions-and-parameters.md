---
title: "08.5 · Block functions and the parameter list"
sidebar_label: "05 · Block functions and parameters"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters). Documentation-validated.

The first two places where hoisting produces an error that **does not look like a
hoisting error** — and where knowing the mechanism is the difference between a
five-minute fix and an hour.

## Function declarations inside blocks

A function declaration at the top level of a function or module is simple: value
hoisting, covered in
[chunk 2](./02-var-and-function-declarations.md). A function declaration **inside a
block** is not simple, and the answer depends on strict mode.

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

Two facts in that output:

- **Inside the block**, `foo` is hoisted normally — the call above the declaration
  works.
- **Outside the block**, `foo` does not exist at all. It behaved like a `let`: block
  scoped, and gone when the block ended.

So in strict mode a block-level function declaration is well-behaved and
predictable. It is simply **narrower** than people expect.

### In sloppy mode — do not

MDN is unusually blunt here, as a **warning** rather than a note:

> *"In non-strict mode, function declarations inside blocks behave strangely. Only
> declare functions in blocks if you are in strict mode."*

MDN documents that the results vary across Chrome, Firefox and Safari. This is the
Annex B / legacy-web-compatibility corner of the language: block-level function
declarations were never legal in sloppy ES5, engines each invented something, and
the standard later had to *describe* the mess rather than fix it.

MDN adds one detail that catches people even when they think they know the rule:

> *"The scoping and hoisting effect won't change regardless of whether the `if` body
> is actually executed."*

That is, a function declaration inside `if (false) { … }` still affects the
enclosing scope. **Scope setup happens before the branch is evaluated**; the branch
never running does not undo it.

### The rule to actually follow

**Never write a function *declaration* inside a block.** If you want a function that
only exists conditionally, assign a function expression to a `let` or `const`:

```js
let handler;
if (mode === "fast") {
  handler = () => { /* … */ };
} else {
  handler = () => { /* … */ };
}
```

This has one behaviour in every engine and every mode, and the binding is exactly
where you wrote it. In practice modules are strict, so most modern code lands in the
well-defined case anyway — but the moment you touch a `<script>` without
`type="module"`, a bundler's CommonJS output, or a legacy file, sloppy mode is back.

## The parameter list has its own TDZ

The parameter list is a scope of its own, and it initialises **left to right**. So a
default that reads a parameter declared *later* hits an uninitialised binding — a
TDZ error, in a place nobody thinks of as having a dead zone.

MDN: *"The default parameter initializers live in their own scope, which is a parent
of the scope created for the function body. This means that earlier parameters can
be referred to in the initializers of later parameters."*

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
which owns that console output.

### The body is a *child* scope, not the same scope

The second half of MDN's sentence produces genuinely confusing bugs:

> *"functions and variables declared in the function body cannot be referred to from
> default value parameter initializers; attempting to do so throws a run-time
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
**parameter scope, which is the body's parent**. Parents cannot see into children.

Note the error here is `go is not defined`, **not** `Cannot access 'go' before
initialization`. There is no binding named `go` in the parameter scope at all, so
this is a plain lookup failure, not a dead-zone access — exactly the distinction
drawn in [chunk 4](./04-typeof-and-why-its-a-feature.md).

### The shadowing consequence

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
`var a = 1` in the body never touches what `b` sees.

This is the clearest possible demonstration that the two scopes are genuinely
distinct, and it is why `var`-shadowing a parameter is worth banning outright.

## Gotchas

**Symptom:** A function declared inside an `if` block is visible (or invisible)
outside it, differently across browsers
**Cause:** Sloppy-mode block-level function declarations — MDN warns they *"behave
strangely"* and that results vary across Chrome, Firefox and Safari.
**Fix:** Use strict mode (any module already is), where the declaration is block
scoped and hoisted to the top of that block. Better: assign a function expression to
a `const`.

**Symptom:** A function declared inside `if (false) { … }` still affects the outer
scope
**Cause:** MDN: *"The scoping and hoisting effect won't change regardless of whether
the `if` body is actually executed."* Scope setup precedes branch evaluation.
**Fix:** Do not declare functions in blocks.

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
**Fix:** Move the logic into the body (`if (a === undefined) a = go();`), or hoist
the helper out of the function entirely.

**Symptom:** A closure created in a default parameter ignores a `var` of the same
name in the body
**Cause:** They are two distinct bindings in two distinct scopes.
**Fix:** Do not shadow a parameter with a `var`. MDN's example logs `undefined` for
`f()` and `5` for `f(5)` — the parameter, never the body's `a`.

## Interview questions

**★ Do function declarations inside blocks hoist?**
In strict mode yes, but only to the top of **that block** — they are block scoped and
do not exist outside it (MDN). In sloppy mode the behaviour is Annex B legacy and
MDN warns it differs across Chrome, Firefox and Safari. The declaration also takes
effect **even if the block never executes**. Use a `const`-assigned function
expression instead.

**★ Why does `function f(a = b, b = 2)` throw?**
The parameter list is its own scope and initialises **left to right**, so `b` is
still uninitialised when `a`'s default runs — the same TDZ rule as `let`, applied to
parameters. Left-to-right references are fine; right-to-left are not.

**★ Why can a default parameter not see a `var` or function declared in the body?**
Because defaults evaluate in the parameter scope, which MDN describes as *"a parent
of the scope created for the function body"*. A parent scope cannot see its child's
bindings. The error is `X is not defined` — a lookup failure, **not** a TDZ access.

**What happens to a closure created in a default parameter when the body declares
the same name with `var`?**
Nothing — they are separate bindings in separate scopes. MDN's example
(`function f(a, b = () => console.log(a)) { var a = 1; b(); }`) logs `undefined` for
`f()` and `5` for `f(5)`: the closure always sees the parameter, never the body's
`var`.

**Is it safe to declare a function inside an `if` block?**
Only in strict mode, and only if you want it scoped to that block. In sloppy mode
MDN explicitly warns against it. The portable answer is a function expression
assigned to `let`/`const`, which behaves identically everywhere.

---

← [`typeof`, error messages and why the TDZ is a feature](./04-typeof-and-why-its-a-feature.md) · [Topic index](./README.md) · Next → [Classes and circular imports](./06-classes-and-circular-imports.md)
