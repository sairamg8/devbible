---
title: "Circular dependencies"
sidebar_label: "06 · Circular dependencies"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A requires B, B requires A. Both module systems resolve it without hanging —
CommonJS by handing over a half-built object, ESM by throwing. Neither outcome is
one you want to design around.**

## CommonJS: a partial object, quietly

When B requires A while A is still executing, the cache already holds A's
`module.exports` — populated with whatever A has assigned *so far*.

```js
// a.js
console.log('a: start');
exports.aReady = true;
const b = require('./b.js');
console.log('a: b.bReady =', b.bReady);
exports.aDone = true;
console.log('a: done');
```

```js
// b.js
console.log('b: start');
const a = require('./a.js');
console.log('b: a.aReady =', a.aReady, '| a.aDone =', a.aDone);
exports.bReady = true;
console.log('b: done');
```

```console
$ node a.js
a: start
b: start
b: a.aReady = true | a.aDone = undefined
b: done
a: b.bReady = true
a: done
(node:231944) Warning: Accessing non-existent property 'aDone' of module exports
inside circular dependency
```

`aReady` was assigned before the `require`, so B sees it. `aDone` was assigned
after, so B sees `undefined`. **The behaviour depends on statement order inside
`a.js`** — move the `require` up two lines and a different set of properties
exists.

Node emits a warning, but only when you touch a missing property, and only at the
moment you touch it. A cycle that reads a property which happens to be defined
warns about nothing and works until someone reorders a file.

## ESM: a loud failure instead

ESM links the graph before evaluating any of it, so the *bindings* all exist
up front. What does not exist yet is their **values** — a `const` before its
initialiser has run is in the temporal dead zone:

```js
// a.js
console.log('a: start');
import { bValue } from './b.js';
export const aValue = 'A';
console.log('a: bValue =', bValue);
```

```js
// b.js
console.log('b: start');
import { aValue } from './a.js';
console.log('b: aValue =', aValue);   // a.js has not run yet
export const bValue = 'B';
```

```console
$ node a.js
b: start
file:///home/you/circ-esm/b.js:3
console.log('b: aValue =', aValue);
                           ^
ReferenceError: Cannot access 'aValue' before initialization
```

Note the order: `b: start` prints first. Because imports are hoisted, Node walks
to the deepest dependency and evaluates from there — `a.js` asked for `b.js`, so
`b.js` runs first, and it immediately reaches for something in `a.js` that has not
been initialised.

A crash at startup beats a silent `undefined` at 3am. This is one of the places
ESM is straightforwardly better.

### Why function declarations survive the cycle

Swap `const` for `function` and the same cycle works:

```js
// a.js
import { bFn } from './b.js';
export function aFn() { return 'A'; }
console.log('a says:', bFn());
```

```js
// b.js
import { aFn } from './a.js';
export function bFn() { return 'B via ' + aFn(); }
```

```console
$ node a.js
a says: B via A
```

Function declarations are hoisted and initialised when the module is linked, before
any body runs. `bFn` is also only *called* later, by which time everything is
ready. That is the whole trick — and it is why a cycle can sit in a codebase for
years and then break the day someone converts a function to a `const` arrow.

**Do not treat this as a supported pattern.** It is a property of hoisting you
should recognise when reading code, not a licence to keep the cycle.

## Finding and fixing them

A cycle is a design signal: two modules that each need the other are usually one
concept that got split, or two concepts that need a third.

Three fixes, in order of preference:

1. **Extract the shared piece.** `user.js` and `order.js` both need `formatMoney`
   → it belongs in `money.js`. This is the right answer most of the time.
2. **Invert the dependency.** If A needs a *behaviour* from B, have B register it
   with A, or pass it in as an argument. The concrete version: stop importing the
   database client into the model and pass the client to the model's constructor.
3. **Move the import inside the function.** `await import()` at call time defers
   the cycle past module evaluation. It works, and it hides the problem — reach
   for it only when the cycle is in code you cannot change.

Node has no built-in cycle report. For CommonJS you can inspect what got loaded
via `require.cache`; for a real answer across both systems, use a dedicated
analyser — `madge --circular src/` is the common choice, and most teams run it in
CI so a new cycle fails the build rather than arriving silently.

## Gotchas

**Symptom:** `Warning: Accessing non-existent property 'x' of module exports inside
circular dependency`
**Cause:** CommonJS cycle — you read a property the other module had not assigned
yet.
**Fix:** Extract the shared code into a third module. As a stopgap, move the
assignment above the `require` in the exporting file.

**Symptom:** `ReferenceError: Cannot access 'x' before initialization` in ESM
**Cause:** Cycle plus a `const`/`let` export read during module evaluation.
**Fix:** Break the cycle. If you must not, read the binding lazily inside a
function rather than at module scope.

**Symptom:** A module exports `{}` for no apparent reason
**Cause:** A CommonJS cycle where the module was required before it assigned
`module.exports = …` — the wholesale assignment replaced the object the other
module had already captured.
**Fix:** Attach properties (`module.exports.x = …`) instead of replacing the
object, or break the cycle.

**Symptom:** Reordering imports changes behaviour
**Cause:** There is a cycle, and evaluation order is load-bearing.
**Fix:** Treat it as a bug, not a formatting preference. Find it with `madge`.

**Symptom:** The cycle broke when a function became an arrow constant
**Cause:** `function` declarations are hoisted; `const fn = () => {}` is not.
**Fix:** Break the cycle rather than reverting the style change.

## Interview questions

**★ What happens in a CommonJS circular dependency?**
Node returns the partially-populated `module.exports` of the module that is still
executing. Anything assigned before the `require` is visible; anything after is
`undefined`. It does not hang and it does not throw — you get a half-built object
and a warning only if you touch a missing property.

**★ How does ESM handle a cycle differently?**
ESM links all bindings before evaluating any module, so the names exist but their
values may be in the temporal dead zone. Reading a `const` export during the
cycle throws `ReferenceError: Cannot access 'x' before initialization` — a loud
failure instead of a silent `undefined`.

**★ Why does a cycle sometimes work with functions but not with constants?**
Function declarations are hoisted and initialised at link time, so the binding is
usable before the module body runs. `const` and `let` are not initialised until
their statement executes, so reading them earlier hits the TDZ.

**★ How do you fix a circular dependency properly?**
Extract the shared code into a third module, or invert the dependency so one side
receives what it needs rather than importing it. Deferring with `await import()`
works but hides the design problem.

**Why is a cycle considered a design smell rather than just a technical detail?**
Because behaviour becomes dependent on evaluation order — which file was entered
first, and where the `require` sits inside it. That makes the code fragile to
reordering, hard to test in isolation, and impossible to reason about locally.

---

← Prev: [Module resolution](05-module-resolution.md) · Next → [package.json essentials](07-package-json.md)
