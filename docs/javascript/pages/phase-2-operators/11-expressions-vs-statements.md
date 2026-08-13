---
title: "11 · Expressions vs statements"
sidebar_label: "11 · Expressions vs statements"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex10-expr-stmt-asi.mjs`.

**An expression produces a value. A statement performs an action.** The
distinction is invisible until it isn't — and then it explains why an IIFE needs
parentheses, why `{}` means two different things, and why you cannot put an `if`
inside JSX.

## Measured

```
--- statement vs expression position ---
  {} + []  (statement)           -> 0
  ({}) + [] (expression)         -> "[object Object]"
  function(){}  (statement)      -> SyntaxError: Function statements require a function name
  (function(){ return 1 })()     -> 1
  !function(){ return 1 }()      -> false
```

## The dividing line

| Expressions | Statements |
|---|---|
| `2 + 2`, `fn()`, `a ? b : c` | `if`, `for`, `while`, `switch`, `try` |
| `x = 5` (assignment **is** an expression) | `const x = 5` (declaration is a statement) |
| `function () {}` in a value position | `function f() {}` as a declaration |
| `class {}` in a value position | `class F {}` as a declaration |
| `{ a: 1 }` object literal | `{ … }` block |
| `await p`, `yield v` | `return`, `throw`, `break` |

**Anywhere a value is expected, only an expression is legal.** That is the rule
that makes everything else follow.

## `{}` is ambiguous, and position decides

```
  {} + []  (statement)     -> 0
  ({}) + [] (expression)   -> "[object Object]"
```

At the start of a statement, `{` opens a **block**. So `{} + []` is an empty
block followed by `+[]` — unary plus on an empty array, which is `0`.

In expression position, `{` opens an **object literal**, and you get
concatenation. Same characters, two parses.

The practical consequence is the destructuring one:

```js
let x, y;
({ x, y } = getPoint());     // parens required
```

Without them the line starts with `{`, the parser sees a block, and it fails.
Same reason, different day.

## Why an IIFE needs parentheses

```
  function(){}  (statement)      -> SyntaxError: Function statements require a function name
  (function(){ return 1 })()     -> 1
  !function(){ return 1 }()      -> false
```

At the start of a statement, `function` begins a **declaration**, and declarations
require a name — hence the measured `SyntaxError`. Wrapping in parentheses forces
expression position, where an anonymous function expression is legal and can be
called immediately.

Any operator that forces expression position works:

```js
(function () { … })();     // conventional
(() => { … })();           // arrow IIFE — the modern form
!function () { … }();      // works, returns the negated result (measured: false)
void function () { … }();  // works, discards it
```

Use the parenthesised form. The `!`/`void` variants are minifier tricks that save
one character and cost clarity.

In modern code you rarely need an IIFE at all — modules already provide scope
([Phase 0 · 06](../phase-0-how-javascript-runs/hosts-and-globals)). The two
remaining uses are top-level `await` in a non-module context, and computing a
`const` that needs several statements:

```js
const config = (() => {
  const base = readBaseConfig();
  const overrides = readEnvOverrides();
  return { ...base, ...overrides };
})();
```

## Where it shows up in real code

**JSX takes expressions only.** This is the most common practical encounter:

```jsx
{/* ❌ if is a statement */}
{ if (loading) <Spinner /> }

{/* ✅ expressions */}
{ loading && <Spinner /> }
{ loading ? <Spinner /> : <List /> }
{ items.map(i => <Row key={i.id} item={i} />) }
```

The reason `&&` and the ternary dominate JSX is not style — statements are simply
not allowed there.

**Arrow function bodies** are the same rule from the other side:

```js
const double = n => n * 2;             // expression body — implicit return
const double2 = n => { return n * 2; };// block body — explicit return needed
const make = () => ({ id: 1 });        // parens: otherwise { is a block
```

That last line is the same `{` ambiguity again, and it is one of the most common
arrow-function mistakes — `() => { id: 1 }` returns `undefined`, having parsed
`id:` as a label.

**Declarations are hoisted; expressions are not.**

```js
hoisted();                  // works
function hoisted() {}

expressed();                // TypeError: expressed is not a function
var expressed = function () {};
```

Covered in [Phase 0 · 02](../phase-0-how-javascript-runs/parse-compile-execute)
and finished in Phase 3.

## Gotchas

**Symptom:** an arrow function returning an object literal returns `undefined`.
**Cause:** `() => { id: 1 }` parses `{` as a block body and `id:` as a label.
**Fix:** `() => ({ id: 1 })`.

**Symptom:** `SyntaxError: Function statements require a function name`.
**Cause:** an anonymous `function` at the start of a statement is read as a
declaration.
**Fix:** wrap it in parentheses to force expression position.

**Symptom:** `SyntaxError` on `{ a, b } = obj`.
**Cause:** the leading `{` opens a block.
**Fix:** `({ a, b } = obj)`.

**Symptom:** `if` inside JSX is a syntax error.
**Cause:** JSX interpolation accepts expressions only.
**Fix:** `&&`, a ternary, or lift the branch into a variable above the return.

**Symptom:** `{} + []` gives `0` in the console but `"[object Object]"` in your
code.
**Cause:** the console evaluates a statement; your code has it in expression
position.
**Fix:** none needed — but do not use console results to reason about
expression-position code.

## Interview questions

**★ What is the difference between an expression and a statement?**
An expression evaluates to a value; a statement performs an action. Only
expressions are legal where a value is expected — which is why JSX takes `&&` and
ternaries but not `if`, and why an arrow function's implicit-return body must be
an expression.

**★ Why does an IIFE need parentheses?**
Because `function` at the start of a statement begins a **declaration**, which
requires a name — measured as `SyntaxError: Function statements require a
function name`. Parentheses force expression position, where an anonymous
function expression is legal and immediately callable.

**★ Why does `() => { id: 1 }` return `undefined`?**
The `{` is parsed as a block body, not an object literal, and `id:` becomes a
label on the expression `1`. The function has no `return`, so it yields
`undefined`. Wrap the object in parentheses: `() => ({ id: 1 })`.

**Why does `{} + []` give different answers in different places?**
Position. As a statement, `{}` is an empty block and the rest is unary `+[]`,
which is `0`. In expression position it is an object literal, so the result is
`"[object Object]"` — both measured. The console evaluates statements, which is
why the trick "works" there.

**Why can't you use `if` inside JSX?**
JSX interpolation is an expression slot. `if` is a statement. Use `&&`, a
ternary, or compute the branch into a variable before the `return`.

---

← [10 · Precedence](./10-precedence.md) · [Phase index](./) · Next: [12 · ASI](./12-asi.md) →
