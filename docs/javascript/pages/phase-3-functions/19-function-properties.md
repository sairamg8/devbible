---
title: "19 · Function properties"
sidebar_label: "19 · Function properties"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length), [`Function.prototype.name`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name), [`Function.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString), [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`Function.prototype.caller`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/caller), [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), [`Function()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function). Documentation-validated; **no timings**.

**Functions are objects, so they carry properties**, and three of them are read by real libraries
to make real decisions about your code. That is the whole reason this topic exists: you will
rarely read `fn.name` yourself, but something in your dependency tree does — and when the build
changes it, the failure looks like anything but a function property.

All three share an unusual descriptor: **`writable: false, enumerable: false, configurable: true`**.
You cannot assign to them, they never show up in a `for...in` or `Object.keys`, and you *can*
redefine them with `Object.defineProperty`. That last part is how libraries preserve them across
a wrapper.

## `length` — declared arity, not parameter count

```js
((a, b) => 0).length          // 2
((a, b = 1) => 0).length      // 1  ← counts up to the FIRST default
((a = 1, b) => 0).length      // 0  ← two parameters, reports zero
((a, ...r) => 0).length       // 1  ← rest is never counted
((a, {b}) => 0).length        // 2  ← a destructuring pattern is one parameter
```

🔴 **`length` is the number of parameters before the first default or rest parameter** — not the
number of parameters. The measured table and the Express middleware bug this causes are in
[02.1 · Defaults and the parameter scope](./02-parameters/01-defaults-and-scope.md); the short
version is that adding a default to a function whose arity a framework reads **silently changes
its contract**.

**Who reads it, and why it matters to you:**

- **Express** decides a middleware is an error handler by `fn.length === 4`. Add a default to
  `next` and errors stop reaching it — no throw, it just never runs.
- **Mocha** treats a test as callback-style when `fn.length > 0`, then waits for a `done` that
  a promise-returning test will never call.
- **`curry` implementations** use it to know when enough arguments have arrived — which is exactly
  why a curried function must have a simple parameter list. See
  [11 · Currying and partial application](./11-currying-and-partial-application.md).

⚠️ **A wrapper destroys it.** `(...args) => fn(...args)` reports `0` regardless of what `fn`
declared, so wrapping a 4-argument error handler in a logger turns it into ordinary middleware.
Libraries that wrap carefully restore it:

```js
Object.defineProperty(wrapped, "length", { value: fn.length });   // ✅ configurable, so allowed
```

## `name` — inferred far more often than declared

`name` is not just for named declarations. The language **infers** it from the binding in most
positions:

```js
function greet() {}                 // "greet"
const greet2 = function () {};      // "greet2"  ← inferred from the variable
const greet3 = () => {};            // "greet3"  ← arrows get one too
const obj = { method() {} };        // "method"
class Cart {}                       // "Cart"
export default function () {}       // "default"
```

And several forms give it a **prefix**, which is the part that surprises people:

```js
greet.bind(null).name               // "bound greet"
Object.getOwnPropertyDescriptor(o, "x").get.name    // "get x"
new Function("").name               // "anonymous"
(function () {}).name               // ""  ← genuinely anonymous, no binding to infer from
```

**Who reads it:** stack traces and error messages, devtools (a React component's displayed name
is its function's `name`), test reporters, DI containers, and any library logging "which handler
threw".

### 🔴 Minification is the reason this is a Know topic

**A minifier renames your functions.** `handleCheckoutSubmit` becomes `n`, and every consumer of
`fn.name` now sees `"n"`:

```js
const registry = new Map();
function register(fn) { registry.set(fn.name, fn); }   // 🔴 works in dev, collides in prod
```

In development every name is distinct and the code looks correct. In production several functions
minify to the same short name and the registry silently loses entries. **The tell is a bug that
only exists in the production bundle** and disappears the moment you disable minification to
investigate it.

**The rule: never make `fn.name` load-bearing.** Pass an explicit string. Frameworks that
historically depended on it ship an escape hatch for exactly this reason — React's `displayName`
is the canonical example — and build tools offer a "keep function names" flag as a last resort,
at a cost in bundle size.

⚠️ **`name` is not unique and never was.** Two functions can share one, and an anonymous function
expression has `""`. It is a debugging aid, not an identity.

## `toString()` — the source text

```js
function add(a, b) { return a + b; }
add.toString();
// "function add(a, b) { return a + b; }"

Math.max.toString();
// "function max() { [native code] }"
```

The spec requires that a function defined in ECMAScript source returns **the source text that
defined it**, character for character — comments and whitespace included. Anything else — a
built-in, a bound function, a `Proxy` — returns the *NativeFunction* form with `[native code]` in
the body.

**Three things that actually use it:**

- **Detecting a native implementation.** `String(fn).includes("[native code]")` is how polyfill
  libraries decide whether an environment's built-in is genuine or already patched.
- **Parameter-name parsing.** AngularJS's dependency injection read parameter names out of the
  source text to decide what to inject — which is precisely why it broke under minification and
  needed the explicit array annotation.
- **Shipping a function elsewhere.** Serialising a function to a Worker or a `new Function` call
  starts with `toString`.

🔴 **Every one of those is fragile, and two are actively discouraged.** Source text changes when
the code is minified, transpiled or instrumented — parameter names disappear, arrow bodies get
rewritten, coverage tooling injects counters. **Never parse a function's source to decide
behaviour.** If you need to know something about a function, ask for it as an argument.

⚠️ `toString` throws a `TypeError` if called on a non-function `this` — it is one of the few
methods that checks.

## The rest of the surface, briefly

**`prototype`** — present on normal functions and classes, **absent on arrow functions, methods
and bound functions**. Its absence is a large part of why those cannot be called with `new`; see
[04 · Arrow functions and `this`](./04-arrow-functions-and-this/README.md).

**`constructor`** — inherited, not own. `fn.constructor === Function`, which is only interesting as
the route to `new Function`.

**`caller` and `arguments`** — legacy own properties of non-strict functions, and **restricted
properties** otherwise: accessing `fn.caller` or `fn.arguments` on a strict-mode function, an
arrow, a class method or a bound function throws a `TypeError`. Since modules are always strict,
in modern code these are effectively gone. **Recognise them in old source; do not reach for
them.**

## Gotchas

**Symptom:** An Express error handler stopped receiving errors after a refactor
**Cause:** A default parameter was added, so `fn.length` dropped below 4 and Express classified it as ordinary middleware.
**Fix:** No defaults on a function whose arity a framework reads — default inside the body.

**Symptom:** A Mocha test times out waiting for `done`
**Cause:** `fn.length > 0` made it callback-style, but the test returns a promise.
**Fix:** Remove the unused parameter.

**Symptom:** A wrapped function's arity became 0
**Cause:** `(...args) => fn(...args)` declares no parameters.
**Fix:** `Object.defineProperty(wrapped, "length", { value: fn.length })` — the property is configurable.

**Symptom:** A registry keyed by `fn.name` loses entries in production only
**Cause:** Minification renamed the functions, and several collapsed to the same short name.
**Fix:** Pass an explicit identifier. Never make `fn.name` load-bearing.

**Symptom:** Components all show as `n` or `t` in devtools
**Cause:** Same minification, seen through the name-inference path.
**Fix:** An explicit `displayName`, or the bundler's keep-names option if the size cost is acceptable.

**Symptom:** `fn.name` is `""`
**Cause:** A genuinely anonymous function expression with no binding to infer from — for example one passed straight as an argument.
**Fix:** Name it, or do not depend on the name.

**Symptom:** A bound function's name reads `"bound handleClick"`
**Cause:** `bind` prefixes the target's name.
**Fix:** Expected — strip the prefix if you are matching on it, or better, stop matching on names.

**Symptom:** Dependency injection broke after enabling minification
**Cause:** Something parsed parameter names out of `toString()`, and minifiers rename parameters.
**Fix:** Explicit annotations. Source text is not a stable interface.

**Symptom:** `TypeError` when reading `fn.caller`
**Cause:** Restricted property — strict-mode functions, arrows, class methods and bound functions all throw.
**Fix:** Nothing to fix; the feature is gone from modern code.

## Interview questions

**★ What does `fn.length` return?**
The number of parameters **before the first one with a default or the rest parameter** — not the
parameter count. `(a, b = 1, c) => …` reports 1 and `(...args) => …` reports 0. A destructuring
pattern counts as one parameter.

**★ Why does that matter in practice?**
Because frameworks branch on it. Express identifies error middleware by `fn.length === 4` and
Mocha identifies callback-style tests by `fn.length > 0`, so adding a default parameter silently
changes what your function *is* to the framework. Currying implementations depend on it too.

**★ Where does `fn.name` come from for an arrow function?**
It is inferred from the binding it is assigned to — `const greet = () => {}` gives `"greet"`.
Object methods take the key, `bind` prefixes `"bound "`, getters get `"get "`, `new Function` gives
`"anonymous"`, and a function expression with nothing to infer from gets `""`.

**★ Why should `fn.name` never be load-bearing?**
Minification renames functions, so names collide or become meaningless in production while working
perfectly in development. It is also not unique and can be empty. Pass an explicit identifier
instead.

**★ What does `Function.prototype.toString()` return, and what is it used for?**
The exact source text for a function defined in ECMAScript source; the `[native code]` form for
built-ins, bound functions and proxies. It is used to detect native implementations, historically
to parse parameter names for dependency injection, and to serialise a function to a Worker.

**★ Why is parsing `toString()` a bad idea?**
Because source text is not a stable interface — minifiers rename parameters, transpilers rewrite
bodies, and instrumentation injects code. AngularJS's DI is the standing example of exactly that
breaking under minification.

**★ Can you change `length` or `name`?**
Not by assignment — both are non-writable. But both are **configurable**, so
`Object.defineProperty` can redefine them, which is how careful wrappers preserve a function's
arity and name.

**Why does `fn.caller` throw in modern code?**
Because `caller` and `arguments` are restricted properties on strict-mode functions, arrows, class
methods and bound functions — and modules are always strict, so effectively everything you write
today throws on access.

---

← [18 · IIFE and the module pattern](./18-iife-and-the-module-pattern.md) · [Phase index](./README.md) · Next: **20 · `new.target` and constructor guards** *(not written yet)* →
