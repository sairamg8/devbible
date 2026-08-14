---
title: "11 · Currying and partial application"
sidebar_label: "11 · Currying and partial application"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length), [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters). Documentation-validated; **no timings**.

**They are not the same thing**, and the difference is the first question asked.

> **Currying** turns `f(a, b, c)` into `f(a)(b)(c)` — a chain of one-argument functions.
> **Partial application** fixes *some* arguments and returns a function taking the rest —
> `f(a, b, c)` → `g(b, c)`.

`bind` does partial application, not currying: `f.bind(null, 1)` returns a function still taking
two arguments, not a chain.

## A `curry` you can write under pressure

```js
function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);      // 🔴 enough — call it
    return (...more) => curried.apply(this, [...args, ...more]); // else collect more
  };
}

const add = curry((a, b, c) => a + b + c);
add(1)(2)(3);      // 6
add(1, 2)(3);      // 6   — variadic collection, not strict currying
add(1)(2, 3);      // 6
```

🔴 **`fn.length` is how it knows when to stop**, and that is also its main fragility. MDN defines
`length` as the number of parameters **before** the first one with a default or a rest parameter —
so:

```js
((a, b = 1, c) => 0).length;      // 1  ⚠️ not 3
((...args) => 0).length;          // 0  ⚠️ curry can never satisfy it
```

⚠️ **So a curried function with defaults or rest parameters fires too early or never.** Pass the
arity explicitly — `curry(fn, 3)` — whenever the signature is not plain positional parameters. It
is the flaw in every three-line `curry`, and naming it is the difference between reciting the
snippet and understanding it.

**Placeholders** (`curry(f)(_, 2)` to skip an argument) are how libraries handle out-of-order
application: a sentinel object, and the collector splices real arguments into the placeholder
positions. ⚠️ **They roughly double the implementation and are rarely worth it** — say they exist,
and that you would reach for a small named wrapper instead.

## What it is actually for

**Configuration first, data last.** The point is not elegance — it is that a partially applied
function is a *value you can pass around*:

```js
const log = curry((level, module, message) => console[level](`[${module}] ${message}`));

const warn = log("warn");
const cartWarn = warn("cart");

cartWarn("Quantity clamped to stock");
```

Each stage is a reusable value. The same shape is why middleware and dependency injection read the
way they do:

```js
const withAuth = (getToken) => (fn) => async (...args) => fn(await getToken(), ...args);
```

🔴 **Data last is what makes it compose.** `map(double)` is a function from array to array, which
can be dropped into a `pipe` — `map(arr, double)` cannot
([12 · Composition](./12-composition.md)).

## Where it stops being worth it

⚠️ **Currying is not free**, and JavaScript is not a language where it is idiomatic by default:

- **Debugging** — a stack full of anonymous `curried` frames tells you nothing about which
  application failed.
- **Arity errors move.** Calling a curried function with too few arguments returns *another
  function* instead of throwing, so a mistake surfaces later as "x is not a function" somewhere
  else entirely.
- **Allocation** — each stage creates a closure. Irrelevant once; measurable in a hot loop.
- **Readability** — `f(1)(2)(3)` requires the reader to know the arity to know what it does.

🔴 **The honest position: use partial application freely, and reach for full currying only where a
pipeline genuinely wants data-last unary functions.** `bind`, a default parameter, or a two-line
arrow covers most cases:

```js
const cartWarn = (message) => log("warn", "cart", message);     // ✅ clear, one line, named
```

**That is the answer an interviewer is looking for after the implementation** — that you can write
it *and* know when not to.

## Gotchas

**Symptom:** A curried function fires before all arguments arrive
**Cause:** `fn.length` stops at the first default or rest parameter.
**Fix:** Pass the arity explicitly.

**Symptom:** A curried variadic function never fires
**Cause:** `((...args) => …).length` is `0`, so it can never be satisfied.
**Fix:** Explicit arity, or do not curry it.

**Symptom:** `x is not a function` far from the real mistake
**Cause:** Too few arguments returned another function instead of throwing.
**Fix:** Fixed-arity wrappers where the error should be immediate.

**Symptom:** `bind` is described as currying
**Cause:** They are different — `bind` fixes some arguments and returns a function taking the rest.
**Fix:** Say partial application.

**Symptom:** A stack trace is a wall of anonymous frames
**Cause:** Every curry stage is an anonymous closure.
**Fix:** Name the intermediate functions, or do not curry hot paths.

**Symptom:** A curried function cannot be dropped into a pipeline
**Cause:** Data-first argument order.
**Fix:** Configuration first, data last.

**Symptom:** Placeholders behave unexpectedly
**Cause:** A hand-rolled sentinel with no splice logic for the remaining positions.
**Fix:** A named wrapper is almost always simpler.

## Interview questions

**★ Currying versus partial application?**
Currying turns `f(a, b, c)` into a chain of unary calls `f(a)(b)(c)`. Partial application fixes
*some* arguments and returns a function taking the rest. **`bind` does partial application, not
currying.**

**★ Write `curry`.**
Collect arguments until `args.length >= fn.length`, then apply; otherwise return a collector that
concatenates. Forward `this` with `apply` so it still works on methods.

**★ What is the flaw in that implementation?**
It relies on `fn.length`, which MDN defines as the count of parameters **before** the first default
or rest parameter — so `(a, b = 1, c) => …` reports `1` and `(...args) => …` reports `0`. A curried
function with defaults fires early; a variadic one never fires. Pass the arity explicitly.

**★ Why configuration first and data last?**
Because a partially applied function is then a value that takes only the data — which is what lets
it drop into a pipeline. `map(double)` composes; `map(arr, double)` does not.

**★ What does currying cost?**
Debuggability (a stack of anonymous frames), **error locality** — too few arguments returns another
function rather than throwing, so the mistake surfaces elsewhere as "x is not a function" — one
closure allocation per stage, and a reader who must know the arity to know what a call does.

**★ Would you use it in production JavaScript?**
Partial application freely; full currying only where a pipeline genuinely wants data-last unary
functions. `bind`, a default parameter, or a named two-line arrow covers most cases and reads
better.

**What about placeholders?**
A sentinel that lets you skip an argument and fill it later. It roughly doubles the implementation,
and a small named wrapper is usually the better answer — worth knowing they exist, rarely worth
writing.

---

← [10 · Debounce and throttle](./10-debounce-and-throttle.md) · [Phase index](./README.md) · [12 · Composition](./12-composition.md) →
