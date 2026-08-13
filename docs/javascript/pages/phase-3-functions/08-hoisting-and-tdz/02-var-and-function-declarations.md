---
title: "08.2 · `var` and function declarations"
sidebar_label: "02 · var and function declarations"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`var`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var), [`function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function). Documentation-validated.

The two forms whose slots get filled at scope entry — one with `undefined`, one
with a working function. Between them they produce every classic hoisting puzzle.

## `var` — the slot exists, the value does not

```js
function doSomething() {
  console.log(bar); // undefined — not a ReferenceError
  var bar = 111;
  console.log(bar); // 111
}
```

MDN describes it precisely: *"Only a variable's declaration is hoisted, not its
initialization. The initialization happens only when the assignment statement is
reached. Until then the variable remains `undefined` (but declared)."*

The equivalent code, written the way the engine effectively behaves:

```js
function doSomething() {
  var bar;           // ← the slot, created at scope entry, holding undefined
  console.log(bar);  // undefined
  bar = 111;         // ← the assignment, where you wrote it
  console.log(bar);  // 111
}
```

**`var x = 1` is two operations that hoist separately.** The declaration goes to the
top of the *function*; the assignment stays exactly where it is. Splitting that one
line in half is the whole mental model, and it explains every `var` surprise you
will meet.

Note the scope in that sentence: **function**, not block. `var` ignores `if`, `for`,
`while` and bare blocks entirely — covered in
[07 · `var`, `let` and `const`](../07-lexical-scope/02-var-let-const.md). The
combination is what makes `var` genuinely dangerous: the slot is created earlier
than you expect **and** it lives in a wider scope than you wrote it in.

### Redeclaration does not reset the value

```js
var a = 1;
var a = 2;
console.log(a); // 2
var a;
console.log(a); // 2 — not undefined
```

MDN: *"Duplicate variable declarations using `var` will not trigger an error, even
in strict mode, and the variable will not lose its value, unless the declaration
has an initializer."*

The bare `var a;` on line 4 does **nothing at all**. There is already a slot named
`a`; re-declaring it is a no-op, and only the *initialiser* on a redeclaration has
any effect. That is why `var` in a long function is a merge hazard — two developers
can each add `var total` and the code keeps running, with the second initialiser
silently winning.

## Function declarations — the slot holds the function

```js
hoisted(); // logs "foo"

function hoisted() {
  console.log("foo");
}
```

This is the only form that is genuinely, usefully hoisted: the binding exists *and*
holds the finished function object before the first line of the scope runs. The
function is fully constructed at scope entry — parameters, body, and its closure
over the enclosing scope, all of it.

That is why *"declare helpers below the code that uses them"* is a legitimate
style. A file that reads top-down as its narrative, with the small helpers
underneath, works because of value hoisting. It is not a hack, and it is the one
place where relying on hoisting is good practice rather than a puzzle.

### Function expressions are not hoisted — and fail differently

```js
notHoisted(); // TypeError: notHoisted is not a function

var notHoisted = function () {
  console.log("bar");
};
```

Nothing about the right-hand side is hoisted. `var notHoisted` creates the slot
holding `undefined`; the call then tries to invoke `undefined`. Hence a
**`TypeError`** rather than a `ReferenceError` — the name resolved fine, the value
just was not callable.

The same applies to arrow functions, which are always expressions. `const f = () => {}`
gives a `const` binding, so calling `f` above its line produces the *third* error —
`Cannot access 'f' before initialization` — not `TypeError`. Three declaration
styles, three different failure messages for the same mistake.

## When a `var` and a function share a name

This is the corner that decides interview questions, and the one place where the
"declarations move to the top" story actively misleads you.

```js
console.log(typeof a); // "function"
function a() {}
var a;
console.log(typeof a); // "function"
```

MDN: *"Both the function declaration and the `var` declaration are hoisted to the
top, so the function value is only accessible from the start of its scope until the
variable's initializer or first assignment, **regardless of the two declarations'
relative positions in the source code**."*

Unpack that emphasised clause, because it is the entire rule:

- **At scope entry, the function wins.** The slot holds the function, not
  `undefined` — a bare `var a` cannot overwrite an existing binding, exactly as in
  the redeclaration case above.
- **The source order of the two declarations is irrelevant.** Putting `var a` first
  changes nothing.
- **An *initialiser* is what changes the value**, and it does so when execution
  reaches it — not at scope entry:

```js
var a = 1;
function a() {}
console.log(a); // 1
```

Here the function still won at scope entry, so `a` was the function for the instant
before line 1 executed. Then `a = 1` ran and replaced it. Move the `console.log`
above line 1 and it prints `"function"`.

**The general shape:** function declarations fill the slot at scope entry;
assignments overwrite it in execution order. Both statements are about *time*, and
once you hold them separately, no ordering puzzle in this family is hard.

## Script top level versus module top level

One visible consequence, at the top level of a **classic browser script**:

```js
"use strict";
var x = 1;
Object.hasOwn(globalThis, "x"); // true
delete globalThis.x;            // TypeError in strict mode
```

MDN: *"In a script, a variable declared using `var` is added as a
**non-configurable** property of the global object."* Non-configurable is the part
people miss — the property cannot be deleted afterwards. Function declarations at
script top level do the same.

**In modules this does not happen.** MDN is explicit that in both ES modules and
CommonJS, top-level `var` declarations are *not* added to the global object. A
module's top-level scope is a module scope, not the global scope. `let`, `const` and
`class` never create global properties in any of the three contexts.

So "`var` pollutes the global namespace" is true of a classic `<script>` and false
of every module you are likely to write today. It is still a reason to avoid `var`
— just not the reason that matters most.

## What to actually do

- **`const` by default, `let` when you reassign, `var` never.** Under `let`/`const`
  this entire page becomes irrelevant: use-before-declaration throws instead of
  silently producing `undefined`.
- **Function declarations below their callers are fine.** Value hoisting is the one
  form of hoisting that is a feature rather than a hazard.
- **Do not write code that depends on the `var`/function precedence rule.** Knowing
  it is for reading other people's code and for interviews. Relying on it is
  writing a puzzle.

## Gotchas

**Symptom:** A variable is `undefined` rather than throwing, on a line above its
declaration
**Cause:** `var` declaration hoisting — the slot was created at function entry and
initialised to `undefined`; only the assignment stayed put.
**Fix:** `let`/`const`, which throw instead. Per MDN the variable is *"declared but
`undefined`"* until the assignment is reached.

**Symptom:** `TypeError: x is not a function` when `x` is clearly defined further
down
**Cause:** It is a function *expression* assigned to `var`. The binding hoisted, the
function did not, so you called `undefined`.
**Fix:** Move the call below the assignment, or use a function declaration if you
genuinely want it callable from above.

**Symptom:** Two `var`s of the same name in one function and no error anywhere
**Cause:** `var` redeclaration is legal even in strict mode; only an initialiser has
an effect.
**Fix:** `let`/`const` make it a parse-time `SyntaxError`. Treat the silence as a
reason to stop using `var`, not as permission.

**Symptom:** A name resolves to a function when you expected the `var` value
**Cause:** At scope entry a function declaration fills the slot, and a bare `var` of
the same name cannot overwrite it — *regardless of source order* (MDN).
**Fix:** Do not reuse the name. When debugging someone else's code, look for the
first *assignment* to that name, since only that changes the value.

**Symptom:** `delete globalThis.x` throws for a top-level `var` in a script
**Cause:** Script top-level `var` creates a **non-configurable** global property
(MDN).
**Fix:** Nothing to fix at runtime — it cannot be deleted. Use a module, where
top-level `var` is not a global property at all.

## Interview questions

**★ Why does calling a function expression before its line give `TypeError` and not
`ReferenceError`?**
Because the binding does exist — `var f` hoisted and holds `undefined`. You are
calling `undefined`, which is a type error, not a lookup failure. With a function
*declaration* the binding would already hold the function and the call would work.
With `const f = () => {}` you would get the third error, `Cannot access 'f' before
initialization`.

**★ Given `var a = 1; function a() {}`, what does `console.log(a)` print?**
`1`. Both declarations are hoisted, the function fills the slot at scope entry, and
then the assignment `a = 1` overwrites it when line 1 runs — regardless of the
declarations' relative source order. Logging *before* line 1 would print
`"function"`.

**★ Does a top-level `var` create a global variable?**
Only in a classic browser `<script>`, where it becomes a **non-configurable**
property of the global object — so it cannot even be deleted afterwards. In an ES
module or CommonJS it does not (MDN). `let`, `const` and `class` never create global
properties anywhere.

**Why is `var x = 1` described as two operations?**
Because the declaration and the initialisation hoist separately: the declaration
creates a slot at the top of the enclosing **function**, initialised to `undefined`,
while the assignment happens where you wrote it. Every `var` surprise follows from
that split.

**Does re-declaring a `var` reset its value?**
No. Per MDN the variable *"will not lose its value, unless the declaration has an
initializer"* — a bare `var a;` when `a` already exists is a complete no-op.

---

← [The two-step scope entry](./01-the-two-step-scope-entry.md) · [Topic index](./README.md) · Next → [The temporal dead zone](./03-the-temporal-dead-zone.md)
