---
title: "01 · Declarations, expressions and arrow functions"
sidebar_label: "01 · Declarations vs arrows"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex1-declarations.mjs`.

**Three ways to write a function, and the differences are not stylistic.** They
hoist differently, they name themselves differently in stack traces, and one of
them is missing half the machinery of a function.

## Measured

```
--- hoisting: a declaration is usable before its line ---
  declared() before the declaration: works
  expressed() before the const                 ReferenceError: Cannot access 'expressed' before initialization
  expressed() after the const                  works
  arrowed() before the const                   ReferenceError: Cannot access 'arrowed' before initialization

--- var-assigned function expression: hoisted, but as undefined ---
  varFn() before the assignment                TypeError: varFn is not a function

--- arrow functions: what they do NOT have ---
  A.prototype                                  undefined
  new A()                                      TypeError: A is not a constructor
  F.prototype (a declaration)                  object
  new F() works                                true
```

## Hoisting: three behaviours, three error messages

The error you get tells you which form you used, which makes this the fastest
thing to recognise in a stack trace:

| Form | Called before its line | Message |
|---|---|---|
| `function f() {}` | **works** | — |
| `const f = function () {}` | throws | `ReferenceError: Cannot access 'f' before initialization` |
| `const f = () => {}` | throws | `ReferenceError: Cannot access 'f' before initialization` |
| `var f = function () {}` | throws | **`TypeError: f is not a function`** |

A **declaration** is hoisted complete — the name and the body both exist from the
top of the scope. That is why this works, and it is the only form for which it
works:

```js
console.log(add(1, 2));            // 3
function add(a, b) { return a + b; }
```

A `const`/`let` function expression is hoisted **into the temporal dead zone** —
the binding exists but cannot be touched, hence *Cannot access before
initialization*. Covered fully in
[Hoisting and the TDZ](./08-hoisting-and-tdz.md).

The `var` row is the one worth memorising, because it is the only one whose error
does not mention hoisting at all. `var f` is initialised to `undefined`, so the
name resolves fine and the *call* is what fails — **`TypeError: f is not a
function`**. If you see that message for something you can see defined further
down the file, `var` is the reason.

A declaration is hoisted even out of unreachable code:

```
  function declared after return                reached
```

```js
function afterReturn() {
  return hoisted();                 // reached
  function hoisted() { return 'reached'; }
}
```

## `.name`, and why it is not always empty

Anonymous functions are not really anonymous any more. The engine infers a name
from the assignment target:

```
  const anon = function(){}                    "anon"
  const named = function theRealName(){}       "theRealName"
  const arrow = () => {}                       "arrow"
  { method(){} }                               "method"
  { prop: function(){} }                       "prop"
  { arrowProp: () => {} }                      "arrowProp"
  (function(){}).name  (never assigned)        ""
  new Function().name                          "anonymous"
  anon.bind(null).name                         "bound anon"
```

Every form that is *assigned to something* picks up that something's name. Only a
function expression that is never bound — passed straight as an argument, for
example — ends up with `""`.

That matters for stack traces:

```
  anonymous expression       at file:///…/declarations.mjs:44:56
  named expression           at myNamedFn (file:///…/declarations.mjs:45:61)
  arrow assigned to a const  at file:///…/declarations.mjs:46:55
```

The named function expression is the only one that puts a **name** in the trace.
An arrow assigned to a `const` has `.name === 'arrow'` but still shows only a
file and offset here, because it was passed directly as an argument at the call
site rather than called through its binding.

The practical rule: **name the callbacks you pass to things you will have to
debug** — `setTimeout(function retryFetch() {…})` costs nine characters and
turns an anonymous frame into a labelled one.

## A named function expression binds its name inside only

```
  inner(5) called through the const            120
  inner(3) from outside                        ReferenceError: inner is not defined
```

```js
const fact = function inner(n) { return n <= 1 ? 1 : n * inner(n - 1); };
```

`inner` is visible **inside its own body** and nowhere else. That gives you a
stable recursion handle that no reassignment of `fact` can break — which is the
one genuinely useful reason to name a function expression beyond stack traces.

## Arrow functions are missing machinery

```
  A.prototype                                  undefined
  new A()                                      TypeError: A is not a constructor
  F.prototype (a declaration)                  object
  new F() works                                true
```

An arrow function has **no `prototype` property** and cannot be called with
`new`. It is a callable object and nothing more.

Precisely: an arrow has no **own binding** for `this`, `arguments`, `super` or
`new.target` — it inherits all four from the enclosing scope — and it genuinely
has no `prototype` at all.

1. **`this`** of its own — it uses the enclosing scope's. This is the big one, and
   it has [its own page](./04-arrow-functions-and-this/README.md).
2. **`arguments`** — measured below.
3. **`prototype`** — so `new` throws `TypeError: A is not a constructor`.
4. **`super`** and **`new.target`** — inherited, not absent. `super.greet()`
   inside an arrow in a class method works; `new.target` in an arrow with no
   enclosing function is a `SyntaxError`. Both measured on
   [the arrow page](./04-arrow-functions-and-this/README.md).

## `arguments`

```
  function declaration: arguments.length       3
  arrow at module scope: arguments             ReferenceError: arguments is not defined
  arrow inside a function: arguments.length    2
    ↑ it saw the OUTER call args (2), not its own  (4 args passed to inner)
```

The third line is the trap. An arrow inside a regular function does not fail on
`arguments` — it **closes over the enclosing function's `arguments`**, so it
silently reports the outer call's arguments. `inner(9, 9, 9, 9)` returned `2`,
the number of arguments passed to `outerHasArgs(1, 2)`.

That is a wrong answer rather than an error, which makes it worse than the
module-scope `ReferenceError`. Use rest parameters and the question disappears:

```js
const inner = (...args) => args.length;   // always its own arguments
```

## Which to use

A short and genuinely defensible default:

- **`const fn = () => …` for callbacks and anything nested**, because lexical
  `this` is what you want inside `map`, `then`, event handlers and class fields.
- **`function` declarations for top-level, exported, recursive or
  reference-before-use functions** — hoisting is a feature there, and the name is
  free.
- **Never an arrow as an object method** if the method needs `this` — see
  [Arrow functions and `this`](./04-arrow-functions-and-this/README.md).
- **Never `var fn = function () {}`.** It combines the worst hoisting behaviour
  with the least informative error.

## `toString` round trip

```
  arrow.toString()                             () => 1
  method shorthand toString()                  m() { return 1; }
  eval of the shorthand source                 SyntaxError: Unexpected token '{'
  eval of a function-expression source         parsed
```

`Function.prototype.toString` returns the exact source text — which is why method
shorthand round-trips to something that is **not a valid standalone expression**:
`m() { return 1; }` only parses inside an object literal, so evaluating it
directly is a `SyntaxError` while a function expression's source parses fine.

Libraries that read function source (dependency injectors reading parameter
names, some test frameworks, older DI containers in Angular) break on exactly
this, and on minified parameter names. It is a fragile technique and worth
recognising when you see it.

## Gotchas

**Symptom:** `TypeError: f is not a function` for something you can see defined
below
**Cause:** `var f = function () {}` — the name is hoisted as `undefined`, so the
call fails, not the lookup.
**Fix:** Use a `function` declaration if you need to call it earlier, or `const`
to get an honest `ReferenceError` instead of a misleading `TypeError`.

**Symptom:** `ReferenceError: Cannot access 'f' before initialization`
**Cause:** A `const`/`let` function expression called before its line — the TDZ.
**Fix:** Move the call after the definition, or convert to a declaration.

**Symptom:** `TypeError: X is not a constructor`
**Cause:** `new` on an arrow function. Measured: arrows have no `prototype`.
**Fix:** A `function` declaration or a `class`.

**Symptom:** `arguments.length` inside an arrow returns the wrong number
**Cause:** The arrow closed over the enclosing function's `arguments`. Measured:
an arrow called with 4 arguments reported 2 — its parent's count.
**Fix:** Rest parameters, `(...args) =>`.

**Symptom:** Stack traces full of anonymous frames
**Cause:** Callbacks passed inline are never bound to a name, so `.name` is `""`.
**Fix:** Name the function expression: `function retryFetch() {…}`.

**Symptom:** A DI/annotation library breaks after adding a shorthand method or
minifying
**Cause:** It reads `Function.prototype.toString`. Measured: shorthand source is
not independently parseable.
**Fix:** Explicit registration instead of source introspection.

## Interview questions

**★ What is the difference between a function declaration and a function
expression?**
Hoisting. A declaration is fully hoisted and callable before its line; an
expression is not — `const`/`let` give `ReferenceError: Cannot access … before
initialization`, and `var` gives `TypeError: … is not a function` because the
name exists as `undefined`. All three measured.

**★ Name three things an arrow function does not have.**
Its own `this`, `arguments`, and a `prototype` — so `new` on it throws
`TypeError: X is not a constructor` (measured). Also no `super` and no
`new.target`.

**★ An arrow inside a function reads `arguments`. What happens?**
It reads the *enclosing function's* `arguments`, silently. Measured: an arrow
called with four arguments reported `2`, the outer call's count. At module scope
it is a `ReferenceError` instead. Use rest parameters.

**★ Is `const f = () => {}` anonymous?**
No — `f.name` is `"f"`; the engine infers names from the assignment target, and
the same applies to object properties and methods. Only a function expression
that is never bound to anything has `name === ""`.

**Why name a function expression when the variable already names it?**
Two reasons, both measured: the name appears in stack traces (`at myNamedFn …`
rather than a bare file offset), and it binds inside the body only, giving a
recursion handle that survives reassignment of the outer variable.

**When would you still reach for a `function` declaration in 2026?**
Top-level and exported functions, recursion, and anywhere call-before-definition
reads better — mutual recursion, or helpers defined below their use. Hoisting is
a feature there, not a hazard.

---

← [Phase index](./README.md) · Next → [Parameters](./02-parameters/README.md)
