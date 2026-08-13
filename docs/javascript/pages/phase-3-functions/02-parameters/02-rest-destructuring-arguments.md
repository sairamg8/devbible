---
title: "02.2 · Rest, destructuring and `arguments`"
sidebar_label: "02 · Rest, destructuring, arguments"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts:
> `sandbox/js-p3/ex2-parameters.mjs`, `sandbox/js-p3/ex2b-arguments-sloppy.cjs`.

**JavaScript never checks how many arguments you passed.** Extra ones are
collected or discarded; missing ones become `undefined`. Everything on this page
is about controlling that deliberately instead of discovering it in production.

## Arity is never enforced

```
--- argument count is never enforced ---
  two(1)                                         { a: 1, b: undefined, argumentsLength: 1 }
  two(1, 2, 3, 4)                                { a: 1, b: 2, argumentsLength: 4 }
    ↑ no error either way                        JavaScript has no arity checking
```

```js
function two(a, b) { return {a, b, argumentsLength: arguments.length}; }
```

No error in either direction. Too few gives `undefined`; too many are ignored by
the parameter list but still counted by `arguments`.

This is why a wrong-argument-count bug surfaces as `Cannot read properties of
undefined` somewhere *downstream*, several frames from the actual mistake. There
is no engine-level fix — TypeScript exists substantially for this.

## Rest parameters

```
--- rest parameters ---
  { first: 1, others: [ 2, 3 ], isArray: true }
  { first: 1, others: [], isArray: true }
  function bad(...a, b) {}                       SyntaxError: Rest parameter must be last formal parameter
  function bad2(...a = []) {}                    SyntaxError: Rest parameter may not have a default initializer
```

```js
function rest(first, ...others) { return {first, others, isArray: Array.isArray(others)}; }
rest(1, 2, 3);    // { first: 1, others: [2, 3], isArray: true }
rest(1);          // { first: 1, others: [],     isArray: true }
```

Rest gives you **a real array** — measured `isArray: true` — and it is an empty
array, never `undefined`, when nothing extra was passed. That means `.map`,
`.filter` and `for…of` work with no conversion step, and you never need a
null check before iterating.

Two hard syntax rules, both measured as `SyntaxError` at parse time:

- **Rest must be last.** `(...a, b)` cannot parse — there would be no way to know
  where `a` stops.
- **Rest cannot have a default.** `(...a = [])` is rejected because it already
  defaults to `[]`.

Being parse-time errors, these fail the whole module immediately rather than at
call time. That is the good kind of failure.

## `arguments` is not an array

```
--- arguments is not an array ---
  {
  isArray: false,
  type: '[object Arguments]',
  hasMap: 'undefined',
  viaFrom: [ 2, 4, 6 ],
  viaSpread: 3
}
```

`arguments` is an array-*like*: indices and `length`, no array methods. Calling
`arguments.map(…)` throws `TypeError: arguments.map is not a function` — measured
here as `hasMap: 'undefined'`.

Both conversions work if you are stuck with it — `Array.from(arguments)` and
`[...arguments]` — but in new code there is no reason to be stuck with it:

| | `arguments` | `...rest` |
|---|---|---|
| Real array | no | yes |
| Works in arrow functions | no | yes |
| Visible in the signature | no | yes |
| Survives minification/tooling | yes | yes |
| Reflects later reassignment of a parameter | in sloppy mode only | no |

**Use rest. `arguments` is for reading old code.** The one thing it still does
that rest cannot is tell you how many arguments were *actually passed* to a
function whose parameters have defaults — and `.length` on a rest array after a
bare signature gives you the same answer.

## Sloppy-mode aliasing — the one behaviour rest does not have

In a non-strict function with a **simple** parameter list, `arguments[i]` and the
parameter are two views of one storage slot. ES modules and class bodies are
always strict, so this now takes a `.cjs` file to observe at all:

```
--- sloppy mode (.cjs, no "use strict") ---
  simple(1): a = 99 then arguments[0]            99  ← ALIASED
  writeThrough(1): arguments[0] = 42 then a      42  ← aliasing goes both ways
  withDefault(1): a = 99 then arguments[0]       1  ← NOT aliased: has a default
  withRest(1): a = 99 then arguments[0]          1  ← NOT aliased: has rest
  withDestructuring({v:1}, 1): b = 99            1  ← NOT aliased: destructured param
  strictFn(1): a = 99 then arguments[0]          1  ← NOT aliased: strict
```

```js
// sandbox/js-p3/ex2b-arguments-sloppy.cjs — no 'use strict'
function simple(a) { a = 99; return arguments[0]; }        // 99
function writeThrough(a) { arguments[0] = 42; return a; }  // 42
```

Assigning to the parameter changes `arguments[0]`, and assigning to
`arguments[0]` changes the parameter. Four things switch it off, and the last
four rows measure each one:

1. `'use strict'` — or being in a module or class, which is most code now.
2. Any **default** parameter.
3. Any **rest** parameter.
4. Any **destructured** parameter.

Items 2–4 are the same rule stated three ways: **any of them makes the whole
parameter list "non-simple", and a non-simple list is never aliased** — even in
sloppy mode, even for the parameters that are themselves plain.

The practical read: this is a legacy behaviour you need to *recognise* in an old
CommonJS file, not one to use. It is also why the aliasing question is still
asked in interviews while being nearly unobservable in modern code.

## Destructured parameters

```
--- destructured parameters, and the missing-argument crash ---
  draw()                                         [0,0]
  draw({x: 5})                                   [5,0]
  drawNoDefault() with no = {}                   TypeError: Cannot read properties of undefined (reading 'x')
```

```js
function draw({x = 0, y = 0} = {}) { return [x, y]; }         // draw() → [0, 0]
function drawNoDefault({x = 0, y = 0}) { return [x, y]; }     // drawNoDefault() throws
```

**The `= {}` at the end is not optional decoration.** Without it, calling with no
argument means destructuring `undefined`, which throws
`TypeError: Cannot read properties of undefined (reading 'x')`.

Two defaults are doing two different jobs here, and conflating them is the usual
mistake:

- `x = 0` — a default for a **missing property** of an object that exists.
- `= {}` — a default for the **missing object itself**.

You need both to make every argument optional. The rule that always holds:
**every destructured parameter you want to be optional needs its own `= {}` (or
`= []`) at its own level.** That applies to nested levels too:

```
--- renaming and nesting while destructuring ---
  { userName: 'ada', auth: 'token' }
  { userName: 'anon', auth: undefined }
  { userName: 'anon', auth: undefined }
```

```js
function req({body: {name: userName = 'anon'} = {}, headers: {auth} = {}} = {}) {
  return {userName, auth};
}
req({body: {name: 'ada'}, headers: {auth: 'token'}});   // { userName: 'ada',  auth: 'token' }
req({});                                                 // { userName: 'anon', auth: undefined }
req();                                                   // { userName: 'anon', auth: undefined }
```

Three `= {}` defaults, one per level, are what make `req()` and `req({})` behave
identically. Drop the innermost one and `req({})` throws while
`req({body: {}})` works — a failure that depends on how deep the caller's object
happens to go.

Note `name: userName` is **renaming**, not a nested pattern: `name` is the key
read from the object, `userName` is the local binding. Reading it backwards is a
common misparse — the key is always on the left.

**The trade-off:** deep destructuring in a signature documents the shape at the
top of the function, but it also makes the signature long and pushes the
failure message away from the caller. Past two levels, destructure in the body
where you can throw your own error.

## Designing a signature that ages well

Since arity is unchecked and there is no overloading, the signature is a
contract you enforce yourself. What holds up:

- **Two or three positional parameters, then an options object.** Positional
  arguments past the third stop being readable at the call site — nobody knows
  what the `true` in `send(msg, false, true)` means.
- **Options object destructured with defaults**, so the accepted keys are visible
  in the signature.
- **Required things stay positional.** A required key inside an options object
  can be omitted silently; a missing positional argument at least reads as
  missing.
- **No defaults on functions whose `.length` a framework reads** — see
  [Defaults and the parameter scope](./01-defaults-and-scope.md).

```js
function createOrder(customerId, items, {currency = 'USD', notes = '', dryRun = false} = {}) {
  if (!customerId) throw new TypeError('createOrder: customerId is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('createOrder: items must be a non-empty array');
  }
  return {customerId, items, currency, notes, dryRun};
}
```

The explicit guards are the arity checking JavaScript will not do. They cost
four lines and turn a downstream `undefined` into a message naming the function
and the parameter.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'x')`
pointing at a function signature
**Cause:** A destructured parameter with no `= {}`, called with no argument.
Measured: `drawNoDefault()` throws where `draw()` returns `[0, 0]`.
**Fix:** `function draw({x = 0, y = 0} = {})` — one default per nesting level.

**Symptom:** `TypeError: arguments.map is not a function`
**Cause:** `arguments` is array-like, not an array. Measured:
`isArray: false`, `type: '[object Arguments]'`.
**Fix:** Rest parameters. Failing that, `Array.from(arguments)`.

**Symptom:** `ReferenceError: arguments is not defined` inside an arrow function
**Cause:** Arrows have no `arguments` binding — at module scope there is nothing
to close over.
**Fix:** Rest parameters, which arrows do support.

**Symptom:** `SyntaxError: Rest parameter must be last formal parameter`
**Cause:** `(...a, b)`. Rest has to be final; there is no way to bound it
otherwise.
**Fix:** Move it last, or take an options object.

**Symptom:** Changing a parameter mysteriously changes `arguments[0]` too
**Cause:** Sloppy-mode aliasing on a simple parameter list. Measured in `.cjs`:
`99` where a strict function gives `1`.
**Fix:** Use a module (strict by default), or add any default/rest/destructured
parameter — each one makes the list non-simple and breaks the alias.

**Symptom:** A function silently ignores an argument you added at a call site
**Cause:** Extra arguments are discarded — arity is never checked. Measured:
`two(1, 2, 3, 4)` binds two and reports `arguments.length === 4`.
**Fix:** Explicit guards, or TypeScript.

## Interview questions

**★ Difference between `arguments` and rest parameters?**
Rest is a real array (measured `isArray: true`), works in arrow functions, is
visible in the signature, and can be positioned after named parameters.
`arguments` is array-like (`[object Arguments]`, no `.map`), exists only in
non-arrow functions, and covers every argument. Use rest.

**★ Why does `function f({x}) {}` throw when called as `f()`?**
It destructures `undefined`, giving
`TypeError: Cannot read properties of undefined (reading 'x')`. Adding `= {}` —
`function f({x} = {})` — fixes it. The property default `x = 0` does *not*, since
it only covers a missing property, not a missing object.

**★ What makes a parameter list "non-simple", and why does it matter?**
Any default, rest, or destructured parameter. A non-simple list turns off
sloppy-mode `arguments` aliasing (measured: `1` instead of `99`), forbids a
`'use strict'` directive in the body, and changes `.length`.

**★ Does JavaScript check the number of arguments?**
Never. Missing become `undefined`, extra are discarded but still counted by
`arguments.length` — measured `4` for a two-parameter function. Guard explicitly
or use TypeScript.

**How would you design a function that takes many optional settings?**
Two or three positional parameters for the required values, then a single
options object destructured with defaults and `= {}` so it can be omitted. The
accepted keys stay visible in the signature and call sites stay readable — no
bare `true, false, null` sequences.

**Can a rest parameter have a default?**
No — `SyntaxError: Rest parameter may not have a default initializer`, measured
at parse time. It already defaults to an empty array, so there is nothing for a
default to add.

---

← [Defaults and the parameter scope](./01-defaults-and-scope.md) · [Topic index](./README.md) · Next → [`this`](../03-this/README.md)
