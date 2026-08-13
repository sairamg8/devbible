---
title: "07.1 · The scope chain"
sidebar_label: "01 · The scope chain"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex7-scope.mjs`, `sandbox/js-p3/ex7b-scope-sloppy.cjs`.

**Lexical scope means a function's scope is fixed by where it appears in the
source**, before anything runs. The alternative — dynamic scope, where a function
sees its *caller's* variables — is what most people accidentally assume, and it
is worth seeing the difference measured once.

## Lexical, not dynamic

```
--- scope is decided by WHERE code is written, not where it is called ---
  callsIt() — dynamic scope would say "inside callsIt" module
    lexical scope says                               module
```

```js
const scopeVar = 'module';
function definedHere() { return scopeVar; }
function callsIt() { const scopeVar = 'inside callsIt'; return definedHere(); }
callsIt();      // 'module'
```

`definedHere` is *called from* a scope containing its own `scopeVar`, and ignores
it entirely. It resolves `scopeVar` against the scopes it was **written** inside.

This is why you can read a function and know what its free variables refer to
without finding every call site — and it is the property that makes closures
work at all. A closure is just a function that outlived its enclosing scope while
still holding that lexical chain.

## Lookup walks outward, never inward

```
--- the scope chain: inner sees outer, never the reverse ---
  inner() reaching three levels up                   L0 < L1 < L2
  outer trying to read an inner variable             ReferenceError: hidden is not defined
```

```js
const level0 = 'L0';
function outer() {
  const level1 = 'L1';
  function middle() {
    const level2 = 'L2';
    function inner() { return [level0, level1, level2].join(' < '); }
    return inner();
  }
  return middle();
}
```

Resolving a name walks the chain from the innermost scope outward, stopping at
the first match. `inner` reaches three levels up with no ceremony. The reverse
never works: an outer scope has no access to an inner one, measured as
`ReferenceError: hidden is not defined`.

If nothing in the chain has the name, you get a `ReferenceError` — which is why
that error almost always means one of: a typo, a missing import, or a variable
declared in a narrower scope than where you used it.

## What creates a scope

```
--- blocks are scopes; objects are NOT ---
  inside the block                                   in a block
  outside the block                                  ReferenceError: blockOnly is not defined
  an object literal does not create a scope          ReferenceError: inside is not defined
```

| Creates a scope | Does **not** |
|---|---|
| A function body | An object literal |
| A block `{ … }` — for `let`/`const`/`class` | An `if` condition's parentheses |
| A module | A string template |
| `for`/`for-of`/`for-in` heads with `let`/`const` | A `var` inside a block |
| `catch (e)` — binds `e` | A comment or a label |

**The object-literal row is the one that catches people**, and it is the same
fact behind arrow-functions-as-methods failing: `{ inside: 'a property' }` does
not put `inside` in scope, so the name is unresolvable. Properties are reached
through the object, never as bare identifiers.

A bare block is a real scope:

```js
{ const blockOnly = 'in a block'; }
blockOnly;        // ReferenceError
```

That is what makes `let`/`const` inside `if`, `for` and `try` bodies invisible
outside them — covered in [the next chunk](./02-var-let-const.md).

## Shadowing

```
--- shadowing: an inner binding hides an outer one ---
  inner value                                        inner
  outer value is untouched                           outer
  entering and leaving a shadowing block             fn-level → block-level → fn-level
```

```js
function partial() {
  const stages = [];
  const name = 'fn-level';
  stages.push(name);
  { const name = 'block-level'; stages.push(name); }
  stages.push(name);
  return stages.join(' → ');
}
// 'fn-level → block-level → fn-level'
```

An inner declaration **hides** the outer one for the duration of its scope; it
does not overwrite it. Leaving the block restores visibility of the outer
binding, because it was never touched.

Shadowing is legal and often good — a parameter named `user` inside a function
that also has an outer `user` is usually clearer than inventing `user2`. It turns
bad when the two hold *different kinds* of thing under one name, because a reader
tracking the outer meaning silently gets the inner one.

### Shadowing a parameter

```
--- shadowing a PARAMETER ---
  shadowParam("arg")                                 arg
  let x in the same scope as parameter x             SyntaxError: Identifier 'x' has already been declared
  var x in the same scope as parameter x             parsed (var is allowed)
```

```js
function shadowParam(x) { { const x = 'shadowed'; } return x; }
shadowParam('arg');       // 'arg' — the block's x was a different binding
```

A parameter can be shadowed by an inner **block**, but not redeclared with `let`
in the function's own top-level scope — that is a `SyntaxError` at parse time.
`var x` in the same position is permitted, because `var` merges with the
parameter rather than declaring a second binding. That asymmetry is one more
reason `var` reads confusingly.

## Why lexical scope is fast

Because the chain is fixed at parse time, an engine can resolve most variable
references to a **slot index** — "two scopes up, third slot" — rather than doing
a name lookup at runtime. That is why closures are cheap in modern JavaScript.

Two things defeat it, and both are consequently discouraged:

```
--- with() — why it is banned in strict mode ---
  sloppy: inside with(obj), a is                     1
  strict: with (obj) { … }                           SyntaxError: Strict mode code may not include a with statement
  why it is banned                                   the scope chain becomes unknowable until runtime
```

- **`with (obj) { … }`** injects an object's properties into the scope chain, so
  no name inside the block can be resolved statically. It is a `SyntaxError` in
  strict mode — which means in every module and class.
- **Direct `eval`** can introduce new bindings into the surrounding scope, so the
  engine must keep that scope inspectable. Indirect `eval` — `(0, eval)(…)` —
  runs in global scope instead and does not have this effect.

Neither belongs in application code. Recognise them; do not reach for them.

## Gotchas

**Symptom:** `ReferenceError: x is not defined` for something you can see nearby
**Cause:** It is declared in a narrower scope — inside a block, an `if`, or a
different function. Lookup goes outward only. Measured: an outer function reading
an inner variable throws.
**Fix:** Declare it in the innermost scope that encloses every use.

**Symptom:** A property name is unresolvable as a bare identifier
**Cause:** Object literals do not create a scope. Measured:
`ReferenceError: inside is not defined` for `{inside: 'a property'}`.
**Fix:** Access it through the object, or destructure it into a binding.

**Symptom:** A function reads an old value you thought you had changed
**Cause:** Lexical scope — it resolves against where it was written, not where it
is called. Measured: a function ignored the caller's identically-named variable.
**Fix:** Pass the value as an argument instead of relying on scope.

**Symptom:** `SyntaxError: Identifier 'x' has already been declared` on a
parameter name
**Cause:** A `let`/`const` in the function's own top-level scope collides with the
parameter. Measured; `var` is allowed there instead.
**Fix:** Rename, or shadow inside a nested block, which is legal.

**Symptom:** `SyntaxError: Strict mode code may not include a with statement`
**Cause:** `with` in a module, class or `'use strict'` code — measured.
**Fix:** Destructure the object's properties into bindings instead.

## Interview questions

**★ What is lexical scope?**
Scope determined by where code is written, resolved at parse time, rather than by
where it is called. Measured: a function called from a scope containing its own
`scopeVar` still returned the module-level one. This is what makes closures
possible and what lets engines resolve variables to slot indices.

**★ How does the engine resolve a variable?**
It walks the scope chain from the innermost scope outward and stops at the first
match; if nothing matches it throws `ReferenceError`. Measured: a function
reached three levels up, and the reverse direction failed.

**★ What creates a new scope?**
Functions, modules, blocks (for `let`/`const`/`class`), `for` heads declared with
`let`/`const`, and `catch` bindings. **Object literals do not** — measured as a
`ReferenceError` — which is also why an arrow used as an object method does not
see the object as `this`.

**★ What is shadowing, and is it bad?**
An inner binding hiding an outer one of the same name for the duration of its
scope. The outer is untouched — measured `fn-level → block-level → fn-level`. It
is fine when both names mean the same kind of thing, and confusing when they do
not.

**Why is `with` banned in strict mode?**
It splices an object into the scope chain, so names inside cannot be resolved
until runtime — defeating the static resolution that makes scope lookups cheap.
Measured: `SyntaxError` in strict mode, works in sloppy.

**Can an outer scope see an inner variable?**
No. The chain is one-directional, outward only. Measured:
`ReferenceError: hidden is not defined`.

---

← [Topic index](./README.md) · Next → [`var`, `let` and `const`](./02-var-let-const.md)
