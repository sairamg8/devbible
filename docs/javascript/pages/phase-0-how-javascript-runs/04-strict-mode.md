---
title: "04 · Strict mode"
sidebar_label: "04 · Strict mode"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p0/ex2-strict.mjs`,
> `ex2b-sloppy.cjs`, `ex8-strict-more.cjs`, `ex8b-strict.cjs`.

**You are almost certainly already in strict mode and did not choose it.** ES
modules and class bodies are strict *always*, with no directive. That covers
essentially all modern application code — so the reason to know this is not to
opt in, it is to understand why some code behaves differently, and to recognise
sloppy mode when you meet it in an old file or a `<script>` tag.

## What turns it on

| Context | Strict? |
|---|---|
| **ES module** (`.mjs`, `type="module"`, `"type": "module"`) | **Always** — cannot be disabled |
| **Class body** (including methods and fields) | **Always** |
| File starting with `'use strict';` | Yes |
| Function starting with `'use strict';` | Yes, that function and everything inside it |
| CommonJS file with no directive | **No** — sloppy |
| Inline `<script>` with no directive | **No** — sloppy |
| `eval` in sloppy code | No, unless the string itself starts with the directive |

The directive must be the **first statement**. A comment above it is fine; a
single statement above it silently disables it, with no warning at all.

## Strict mode turns silent failures into errors

```js
// sandbox/js-p0/ex2-strict.mjs — an ES module, so strict with no directive
console.log('module this:', typeof this, this);
try { undeclared = 1; } catch (e) { console.log('1 assign undeclared:', e.constructor.name + ':', e.message); }
try { Object.freeze({}).x = 1; } catch (e) { console.log('2 write frozen:', e.constructor.name + ':', e.message); }
try { delete Object.prototype; } catch (e) { console.log('3 delete non-configurable:', e.constructor.name + ':', e.message); }
function f() { return this; }
console.log('4 this in plain call:', f());
class C { m() { return this; } }
console.log('5 detached class method this:', (0, new C().m)());
```

```
module this: undefined undefined
1 assign undeclared: ReferenceError: undeclared is not defined
2 write frozen: TypeError: Cannot add property x, object is not extensible
3 delete non-configurable: TypeError: Cannot delete property 'prototype' of function Object() { [native code] }
4 this in plain call: undefined
5 detached class method this: undefined
```

The same operations in sloppy mode:

```js
// sandbox/js-p0/ex2b-sloppy.cjs — CommonJS, no directive
console.log('cjs this === module.exports:', this === module.exports);
undeclared = 1;
console.log('assign undeclared succeeded:', globalThis.undeclared);
Object.freeze({}).x = 1;
console.log('write to frozen: silently ignored, no throw');
function f() { return this === globalThis; }
console.log('this in plain call is globalThis:', f());
```

```
cjs this === module.exports: true
assign undeclared succeeded: 1
write to frozen: silently ignored, no throw
this in plain call is globalThis: true
```

**Every one of those sloppy behaviours is a bug that does not announce itself.**
A typo'd variable name creates a global. A write to a frozen object vanishes.
A method that lost its receiver silently operates on the global object instead
of throwing.

## The rest of the differences, measured

```
                          sloppy                    strict
1 duplicate params        allowed, returns 2        SyntaxError: Duplicate parameter name not allowed in this context
2 arguments linkage       stays linked, returns 99  decoupled, returns 1
3 legacy octal 0755       493                       SyntaxError: Octal literals are not allowed in strict mode.
4 this in a plain call    globalThis                undefined
5 `with` statement        works                     SyntaxError: Strict mode code may not include a with statement
6 delete a variable       returns true              SyntaxError: Delete of an unqualified identifier in strict mode.
```

Three of the six are **`SyntaxError`s**, which means they are caught at parse
time — the file will not run at all ([02 · Parse, compile,
execute](./02-parse-compile-execute.md)). You find them the moment you load the
file, not when the line is reached.

Rows 1 and 3 are the ones that bite in old code: a duplicated parameter name is
almost always a copy-paste mistake, and `0755` looks like a Unix file mode but
is parsed as octal `493`.

## The one that changes how you write code: `this`

```
4 this in plain call:  undefined   (strict)
4 this in plain call:  globalThis  (sloppy)
```

This single difference is why the "lost `this`" bug behaves so differently in
modern code:

```js
class Cart {
  constructor() { this.items = []; }
  add(item) { this.items.push(item); }
}

const cart = new Cart();
const addItem = cart.add;      // detached from its receiver
addItem({ sku: 'A1' });
```

In **strict** mode (which a class body always is): `this` is `undefined`, so you
get `TypeError: Cannot read properties of undefined (reading 'items')` — on the
exact line, immediately.

In **sloppy** mode: `this` would be `globalThis`, so `globalThis.items` is
`undefined`, and you get a confusing error later — or worse, `globalThis.items`
gets created and the bug becomes a slow leak of cart data into a global.

**Strict mode's `undefined` is the good outcome.** The full binding rules are in
Phase 3.

## `this` at the top level

```
module this: undefined
cjs this === module.exports: true
```

Three different answers for "what is `this` at the top of a file", and they are
all correct in context:

| Context | Top-level `this` |
|---|---|
| ES module | `undefined` |
| CommonJS module | `module.exports` |
| Browser `<script>` (non-module) | `window` |

Do not use top-level `this` for anything. Use `globalThis` when you genuinely
mean the global object.

## Gotchas

**Symptom:** `'use strict'` in a file appears to do nothing.
**Cause:** it is not the first statement — a `const` or `import` above it
demotes it to an ordinary string expression.
**Fix:** move it to line 1. Better: use an ES module and delete the directive.

**Symptom:** a typo'd variable silently creates a global instead of throwing.
**Cause:** sloppy mode. `cartTotl = 100` is a legal implicit global.
**Fix:** ES modules, or `'use strict'`. `no-undef` in ESLint catches it before
runtime either way.

**Symptom:** `TypeError: Cannot read properties of undefined` when passing a
method as a callback — `onClick={cart.add}`, `arr.map(obj.method)`.
**Cause:** the method was detached, so `this` is `undefined` in a strict class
body.
**Fix:** `cart.add.bind(cart)`, an arrow wrapper `(x) => cart.add(x)`, or a class
field `add = (item) => {...}`. Phase 3 and Phase 4 cover the trade-offs.

**Symptom:** legacy code broke after converting the file to an ES module.
**Cause:** the conversion made it strict, and something in it depended on sloppy
behaviour — usually implicit globals, `arguments` linkage or octal literals.
**Fix:** read the error; strict-mode failures are precise. Fix the cause rather
than reverting the module conversion.

**Symptom:** a bundler output behaves differently from the source file.
**Cause:** the bundler may concatenate a sloppy file into a strict module scope,
or the reverse.
**Fix:** keep every source file an ES module so the mode never changes under you.

## Interview questions

**★ Do you need `'use strict'` in modern code?**
No. ES modules and class bodies are strict unconditionally, and that covers
essentially all application code. It still matters in a plain `<script>` tag, in
CommonJS, and when reading old files — which is why you need to recognise sloppy
behaviour even though you never opt into it.

**★ What does strict mode actually change?**
It converts silent failures into errors and removes error-prone legacy
behaviour. Measured: assigning an undeclared variable throws `ReferenceError`
instead of creating a global; writing to a frozen object throws `TypeError`
instead of being ignored; `this` in a plain call is `undefined` instead of
`globalThis`; `arguments` stops aliasing parameters; and duplicate parameter
names, octal literals, `with`, and deleting a variable all become `SyntaxError`s.

**★ Why is `this === undefined` an improvement over `this === globalThis`?**
Because it fails at the point of the mistake. A detached method with
`this === undefined` throws immediately on the property access. With
`globalThis`, the same call silently reads or *creates* global properties, and
the failure surfaces somewhere unrelated — or never, while quietly corrupting
global state.

**What is `this` at the top level of a module?**
`undefined` in an ES module, `module.exports` in CommonJS, and `window` in a
classic browser script. Use `globalThis` if you actually want the global object.

**Why are some strict-mode violations `SyntaxError` and others `TypeError`?**
The `SyntaxError` cases — duplicate parameters, octal literals, `with`,
`delete x` — are detectable while parsing, so the file never runs. The
`TypeError` and `ReferenceError` cases depend on runtime values and can only be
caught when the line executes.

---

← [03 · The call stack](./03-call-stack.md) · [Phase index](./) · Next: [05 · What "JavaScript" means today](./05-ecmascript-and-tc39.md) →
