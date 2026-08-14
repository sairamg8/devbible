---
title: "18 · IIFE and the module pattern"
sidebar_label: "18 · IIFE and the module pattern"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE), [Functions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions), [`function` expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/function), [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), [`var`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated; **no timings**.

**This is a Know topic, and the reason is worth stating up front: you will not write an IIFE this
year, and you will read one this week.** Bundler output, older libraries, `<script>` tags and
every Stack Overflow answer written before 2016 are full of them. The job is recognising the shape
and knowing what replaced it.

## The problem it solved

Before modules, **a browser had exactly one scope for every script on the page**. Two `<script>`
tags shared it, and `var` at the top level of a classic script becomes a property of the global
object:

```html
<script>var config = { api: "/v1" };</script>   <!-- window.config -->
<script>var config = "widget";</script>          <!-- 🔴 silently replaced -->
```

Three consequences, and they were the daily experience of front-end work:

- **Name collisions across files nobody could see.** Two libraries both defining `$` or `util`,
  and the loser is whichever loaded first.
- **No privacy.** Every helper, every counter, every "internal" variable was reachable and
  writable by any other script on the page — including third-party ones.
- **Order dependence.** Because everything was one namespace filled in top to bottom, the
  `<script>` order *was* the dependency graph, maintained by hand.

**There was exactly one tool in the language for creating a new scope: a function.** So the fix was
to make a function and call it immediately.

## The shape

```js
(function () {
  var config = { api: "/v1" };     // ✅ private — not on window
  init(config);
})();
```

An **Immediately Invoked Function Expression**: a function expression, created and called in one
step, whose only purpose is the scope it brings with it. Nothing it declares escapes.

🔴 **The wrapping parentheses are the load-bearing part.** A `function` keyword at the start of a
statement is parsed as a *declaration*, which must have a name and is not called. Wrapping it makes
the parser treat it as an **expression**, which can then be invoked. Any operator that forces
expression position works, which is why the shape has so many variants:

```js
(function () { … })();      // the classic — invocation outside the parens
(function () { … }());      // Crockford's preference — invocation inside
(() => { … })();            // the modern spelling
!function () { … }();       // seen in minified output
void function () { … }();   // same idea, no return value
```

⚠️ **All of them mean the same thing.** In minified bundles you will mostly see `!function` and
`void function`, because they save a byte over a leading `(`.

### The leading semicolon

```js
;(function () { … })();
```

That semicolon is not a style tic. **Concatenating two files where the first ends in an expression
without a trailing semicolon** makes the next line's `(` read as a function call on it:

```js
var a = b       // file one, no semicolon
(function () { … })()   // file two → parsed as b(function(){…})()
```

The result is a `TypeError` at runtime, in a file that is fine on its own. Build tools that
concatenate raw scripts made this common enough that the defensive `;` became convention. **A
bundler that understands modules removes the need entirely.**

## The revealing module pattern

The IIFE gives privacy; **returning an object gives a public interface**:

```js
const Counter = (function () {
  let count = 0;                                  // private — no outside access

  function increment() { count += 1; }
  function reset()     { count = 0; }
  function value()     { return count; }

  return { increment, reset, value };             // the "revealed" surface
})();

Counter.increment();
Counter.value();      // 1
Counter.count;        // undefined — genuinely inaccessible
```

**This is just a closure with a nicer name.** `count` survives because the returned functions
close over it — the counter factory from
[06.2 · Private state and memory](./06-closures/02-state-and-memory.md), used once instead of
called repeatedly.

Two variants you will meet:

**The namespace pattern**, extending one global across many files:

```js
var App = App || {};                              // create or reuse
App.cart = (function () { … })();
```

**Dependency injection through parameters**, which is what the trailing arguments in old library
source are for:

```js
(function (global, $) {
  // $ is guaranteed to be jQuery here regardless of what the page did to it
})(window, jQuery);
```

⚠️ **That injection is not decoration.** It pins the identity of each global at load time, gives
the minifier short local names to mangle, and makes the file's dependencies visible in one line —
three jobs that `import` now does properly.

## What modules replaced it with

ES modules make **every one of the IIFE's benefits the default**, and add what an IIFE never
could:

| | IIFE | ES module |
|---|---|---|
| Privacy | by wrapping, manually | **by default** — module scope, nothing leaks |
| Public surface | whatever you `return` | `export` |
| Dependencies | globals, or injected arguments | `import`, resolved by the runtime |
| Strict mode | opt in with `"use strict"` | **always on** |
| Top-level `this` | the global object (sloppy) | `undefined` |
| Order | hand-maintained `<script>` order | the import graph, resolved for you |
| Dead-code removal | impossible | **tree-shaking**, from static structure |
| Executed | when the script runs | deferred; each module evaluated **once** |

🔴 **The deep change is that `import`/`export` are static.** They are declarations, hoisted and
resolved before any code runs, so a tool can know the whole dependency graph without executing
anything. An IIFE's dependencies are ordinary runtime values, so nothing can be proven about them
— which is exactly why tree-shaking did not exist before modules.

⚠️ **Imported bindings are live, and a returned object's are not.** A module that exports a `let`
and reassigns it later shows the new value at every import site; the object a module-pattern IIFE
returned captured whatever the property held when it was built. Detail:
[08 · ES modules](../phase-8-modules-errors/01-es-modules/README.md) and
[08 · Module semantics](../phase-8-modules-errors/02-module-semantics/README.md).

**Block scope closed the other half.** `let` and `const` mean a bare block already creates a scope,
so the IIFE's second job — a scratch scope inside a function — is now `{ … }`:

```js
{
  const temp = expensive();     // ✅ scoped to the block, no function needed
  use(temp);
}
```

## Where an IIFE is still the right answer

Not many places, but the ones that remain are real:

**A classic script that needs privacy.** A `<script>` without `type="module"` still shares the
global scope, so an analytics snippet or a bookmarklet still wraps itself.

**An async entry point in a non-module context.** `await` at the top level is a module feature; in
a classic script or a CommonJS file the wrapper is still how you get one:

```js
(async () => {
  const data = await load();
  start(data);
})();
```

⚠️ **Inside an ES module this is unnecessary** — top-level `await` is available there, and the
wrapper only makes rejections harder to see, since nothing awaits the returned promise.

**Bundler output.** Bundles targeting the `iife` format wrap everything in one, which is why the
shape survives in production even in codebases with no hand-written IIFE.

**Historically, the `var`-in-a-loop fix** — the third fix listed in
[06.1 · What is captured](./06-closures/01-what-is-captured.md), where an IIFE per iteration
created the per-iteration binding that `let` now gives for free. **Recognise it; do not write it.**

## Gotchas

**Symptom:** `SyntaxError: Function statements require a function name`
**Cause:** `function () { … }()` at statement position is parsed as a declaration, not an expression.
**Fix:** Wrap it — `(function () { … })()` — or use any operator that forces expression position.

**Symptom:** `TypeError: b is not a function`, only after concatenating files
**Cause:** A previous file ended without a semicolon, so the IIFE's leading `(` read as a call on that expression.
**Fix:** The defensive leading `;`, or a bundler that does not concatenate raw scripts.

**Symptom:** `this` inside an IIFE is the global object, or `undefined`
**Cause:** A plain call has no receiver — sloppy mode substitutes the global, strict mode leaves `undefined`.
**Fix:** Do not rely on `this` there; pass what you need in as a parameter.

**Symptom:** An arrow IIFE cannot see `arguments`
**Cause:** Arrow functions have neither their own `this` nor `arguments`.
**Fix:** Use a `function` expression if you need either — see [04 · Arrow functions and `this`](./04-arrow-functions-and-this/README.md).

**Symptom:** A value returned by a module-pattern IIFE never reflects later changes
**Cause:** The returned object captured values at build time; unlike an `export`, it is not a live binding.
**Fix:** Return a getter, or use a real module.

**Symptom:** An async IIFE swallows errors
**Cause:** Nothing awaits the promise it returns, so a rejection becomes an unhandled rejection.
**Fix:** `.catch()` on it explicitly, or use top-level `await` in a module.

**Symptom:** A bundle will not tree-shake
**Cause:** Something in the graph is IIFE- or CommonJS-shaped, so the dependencies are runtime values rather than static declarations.
**Fix:** ES module syntax — that static structure is the precondition for the analysis.

**Symptom:** `var App = App || {}` overwrote another file's namespace
**Cause:** Load-order dependence — the pattern only merges if the earlier file really did run first.
**Fix:** Modules, where the runtime resolves the order.

## Interview questions

**★ What is an IIFE and what problem did it solve?**
A function expression created and called immediately, used purely for the scope it introduces.
Before modules every classic script shared one global scope, so top-level `var`s collided across
files and nothing could be private. A function was the only scope-creating construct in the
language, so wrapping code in one and invoking it was the fix.

**★ Why are the parentheses needed?**
Because `function` at the start of a statement is parsed as a declaration, which must be named and
is not invoked. The parentheses put it in expression position so it can be called. Any operator
that does the same works — `!function(){}()` and `void function(){}()` are the same trick,
preferred by minifiers because they are shorter.

**★ What is the leading semicolon for?**
Concatenation safety. If the preceding file ends in an expression without a semicolon, the IIFE's
`(` is parsed as a call on it and throws at runtime. The `;` terminates the previous statement. A
module bundler makes it unnecessary.

**★ What is the revealing module pattern?**
An IIFE that keeps state in its scope and returns an object of the functions that should be
public. It is a closure used once: the private variables survive because the returned functions
close over them, and nothing else can reach them.

**★ What did ES modules give you that an IIFE could not?**
Privacy by default rather than by wrapping, a declared public surface, dependencies resolved by
the runtime instead of by `<script>` order, always-on strict mode, single evaluation, live
bindings — and, because `import`/`export` are static and hoisted, tree-shaking. That last one is
impossible over IIFEs, whose dependencies are ordinary runtime values.

**★ Are there still reasons to write one?**
A classic non-module script that wants privacy; an async entry point where top-level `await` is
not available; and bundler output targeting the `iife` format. Inside an ES module an async IIFE
is redundant and slightly harmful, because nothing handles the promise it returns.

**★ How do you get a scratch scope today?**
A block. `let` and `const` are block-scoped, so `{ const temp = …; }` does what an IIFE used to do
for temporary variables, without a function call or a return value.

**Why is the `(function(global, $) { … })(window, jQuery)` form written that way?**
To pin each global's identity at load time regardless of what else on the page reassigns it, to
give the minifier short local names, and to state the file's dependencies in one visible line —
the three things `import` now does properly.

---

← [17 · Closure and default-parameter gotchas](./17-closure-and-default-gotchas/README.md) · [Phase index](./README.md) · Next: **19 · Function properties** *(not written yet)* →
