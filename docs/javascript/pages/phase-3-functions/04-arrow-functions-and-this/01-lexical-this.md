---
title: "04.1 · Lexical `this` and the missing bindings"
sidebar_label: "01 · Lexical this"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex4-arrows.mjs`.

**An arrow does not have a `this` that is "the outer one". It has no `this` at
all.** `this` inside an arrow is an ordinary free variable, resolved through the
scope chain exactly like any other — which is why every rule on
[the `this` page](../03-this/README.md) simply does not apply to it.

Once you hold that framing, every arrow behaviour follows from it rather than
needing to be memorised separately.

## `this` resolves through the scope chain

```
--- an arrow has no this — it resolves through the scope chain ---
  method containing an arrow                       obj
  arrow used AS the method                         undefined (module this)
  arrows nested two deep                           obj
```

```js
const obj = {
  label: 'obj',
  good() { const inner = () => this.label; return inner(); },
  bad: () => (typeof this === 'undefined' ? 'undefined (module this)' : String(this)),
  nestedTwice() { return (() => (() => this.label)())(); },
};
```

Three rows, one rule:

- **`good`** is a normal method, so *it* has a `this` (the object). The arrow
  inside finds no `this` of its own and looks outward — landing on the method's.
- **`bad`** is an arrow *as* the method. There is no method to inherit from, so
  the lookup continues past the object literal — **an object literal is not a
  scope** — to module top level, where `this` is `undefined`.
- **`nestedTwice`** shows that nesting depth is irrelevant. Arrows are transparent
  to `this`; the lookup passes straight through any number of them to the
  nearest ordinary function.

**An object literal does not create a scope.** That single fact is what makes
`bad` fail, and it is the point most explanations skip.

## `call`, `apply` and `bind` cannot change it

```
--- this in an arrow is FIXED at creation — call/apply/bind cannot change it ---
  arrow()                                          creator
  arrow.call({tag:"other"})                        creator  ← call ignored
  arrow.apply({tag:"other"})                       creator  ← apply ignored
  arrow.bind({tag:"other"})()                      creator  ← bind ignored
  but bind still returns a function                function
```

```js
function makeArrow() { return () => (this === undefined ? 'undefined' : this.tag); }
const arrow = makeArrow.call({tag: 'creator'});
arrow.call({tag: 'other'});     // 'creator'
```

The arrow captured the scope it was created in — `makeArrow` was invoked with
`this` as `{tag: 'creator'}`, so that is what the arrow's scope chain contains
forever.

**These calls do not throw. They silently do nothing** to `this`, which is the
dangerous part: a `bind` that appears to work but has no effect. Note the last
row — `bind` still returns a perfectly good function, so nothing signals failure.

Arguments are unaffected: `call`, `apply` and `bind` still pass arguments to an
arrow normally. Only the `this` half is ignored.

## The four missing bindings, and the one missing property

```
--- the four missing pieces ---
  A.prototype                                      undefined
  new A()                                          TypeError: A is not a constructor
  A.hasOwnProperty("prototype")                    false
  a declaration: typeof F.prototype                object
  arguments at module scope inside an arrow        ReferenceError: arguments is not defined
  arrow inside a function reading arguments        2  ← the OUTER call count, not its own
  the fix: (...args) => args.length, called with 4 4
```

There is a real distinction here that most summaries flatten:

| | Arrow behaviour |
|---|---|
| `this` | no own binding — **inherited** lexically |
| `arguments` | no own binding — **inherited** lexically |
| `super` | no own binding — **inherited** lexically |
| `new.target` | no own binding — **inherited** lexically |
| `prototype` | **genuinely absent** — not inherited, not present |

The first four are *inherited*, not missing. Only `prototype` is truly absent —
measured `A.hasOwnProperty('prototype') === false` against `typeof F.prototype
=== 'object'` for a declaration — and that absence is precisely why `new A()`
throws `TypeError: A is not a constructor`.

### `arguments` is the one that fails quietly

At module scope there is nothing to inherit, so you get a clean
`ReferenceError: arguments is not defined`. **Inside a function it is worse**: the
arrow inherits the enclosing function's `arguments`, so it returns a wrong number
rather than an error.

```js
function outer() { const inner = () => arguments.length; return inner(9, 9, 9, 9); }
outer(1, 2);      // 2  ← inner was called with four arguments
```

`inner` was called with four arguments and reported `2` — `outer`'s count. No
error, no warning, just a wrong answer. Rest parameters make the question
disappear:

```js
const withRest = (...args) => args.length;
withRest(1, 2, 3, 4);     // 4
```

### `super` and `new.target` are inherited, not banned

```
--- no super, no new.target ---
  super inside an arrow class FIELD                base via arrow field
  super inside an arrow in a method                base via arrow in method
  new.target in a function, called plainly         undefined
  new.target in a function, called with new        T
  eval("const a = () => new.target")               SyntaxError: new.target expression is not allowed here
```

```js
class Child extends Base {
  viaArrow = () => super.greet() + ' via arrow field';
  viaMethod() { const a = () => super.greet(); return a() + ' via arrow in method'; }
}
```

**`super` works inside an arrow.** Both rows returned `'base …'`. This contradicts
the common summary that arrows "have no `super`" — they have no *own* `super`, so
they use the enclosing method's, which is usually exactly what you want. An arrow
callback inside a method can call `super.render()` and it resolves correctly.

`new.target` follows the same pattern, and its failure mode shows the rule
cleanly: inside a function there is one to inherit, so an arrow reads it fine. At
top level there is nothing to inherit and it is a **`SyntaxError` at parse time** —
`new.target expression is not allowed here` — not a runtime `undefined`.

## An arrow is still a function

```
--- arrows are still functions in every other respect ---
  typeof                                           function
  named.name                                       "named"
  named.length                                     2
  instanceof Function                              true
  Object.getPrototypeOf(arrow) === Function.prototype true
  named.call(null, 1, 2) still passes ARGS         3
```

Nothing exotic: `typeof` is `'function'`, it inherits from `Function.prototype`,
it has `.name` (inferred from the assignment target) and `.length`, and it is
`instanceof Function`. The last row is the one to hold on to — **`call` still
passes arguments**, it just cannot set `this`.

So there is no reliable runtime test that distinguishes an arrow from an ordinary
function except the absence of `prototype`:

```js
const isArrow = (fn) => typeof fn === 'function' && !Object.hasOwn(fn, 'prototype');
```

That is a heuristic, not a guarantee — `class` methods and `async` functions also
lack `prototype`. There is no correct general test, which is worth knowing before
you try to write one.

## Gotchas

**Symptom:** `this` is `undefined` in an object method
**Cause:** The method is an arrow. An object literal is not a scope, so the
lookup passes through it to module scope. Measured: `undefined (module this)`.
**Fix:** Method shorthand — `read() { … }`. Keep arrows for callbacks inside it.

**Symptom:** `bind` on a callback appears to do nothing
**Cause:** The callback is an arrow; `bind` cannot change its `this`, and it
returns a function so nothing signals the failure. Measured: `creator` after
`bind({tag: 'other'})`.
**Fix:** Bind the underlying ordinary function, or wrap the call rather than the
function.

**Symptom:** `TypeError: X is not a constructor`
**Cause:** `new` on an arrow. Measured: arrows have no own `prototype` at all.
**Fix:** A `function` declaration or a `class`.

**Symptom:** `arguments.length` inside an arrow returns the wrong number
**Cause:** It inherited the enclosing function's `arguments`. Measured: an arrow
called with 4 arguments reported `2`.
**Fix:** `(...args) =>`.

**Symptom:** `ReferenceError: arguments is not defined`
**Cause:** An arrow at module or top level — there is nothing to inherit.
**Fix:** Rest parameters.

**Symptom:** `SyntaxError: new.target expression is not allowed here`
**Cause:** `new.target` in an arrow with no enclosing ordinary function. It is a
parse-time error, so the whole module fails to load.
**Fix:** Move it into a function, or drop it — `new.target` only makes sense
inside something callable with `new`.

## Interview questions

**★ How does `this` work in an arrow function?**
It does not have one. `this` is resolved as an ordinary free variable through the
scope chain, so it finds the nearest enclosing ordinary function's `this`.
Measured: an arrow inside a method saw the object; an arrow *as* the method saw
module-level `undefined`, because an object literal is not a scope.

**★ Can you change an arrow's `this` with `call` or `bind`?**
No — and it fails silently rather than throwing. Measured: `call`, `apply` and
`bind` all returned the creation-time value. Arguments are still passed
normally; only the `this` half is ignored.

**★ Do arrow functions have `super`?**
No *own* binding, but they inherit it — so `super.greet()` inside an arrow in a
class method works (measured). The common claim that arrows "have no `super`" is
wrong; the accurate statement is that they have no *own* `super`, `this`,
`arguments` or `new.target`, and inherit all four.

**★ Why can't you call an arrow with `new`?**
It has no `prototype` property at all — measured `hasOwnProperty('prototype')
=== false` — so there is nothing to link a new instance to. The error is
`TypeError: A is not a constructor`.

**What happens if an arrow inside a function reads `arguments`?**
It reads the enclosing function's. Measured: called with four arguments, it
reported `2`. This is worse than the module-scope `ReferenceError` because it is a
wrong answer rather than a failure.

**How would you detect an arrow function at runtime?**
Only heuristically — the absence of an own `prototype`. That also matches class
methods and `async` functions, so there is no correct general test.

---

← [Topic index](./README.md) · Next → [Syntax, and when not to use one](./02-syntax-and-when-not-to.md)
