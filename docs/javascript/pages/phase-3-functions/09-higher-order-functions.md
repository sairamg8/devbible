---
title: "09 · Higher-order functions"
sidebar_label: "09 · Higher-order functions"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions), [First-class Function (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function), [`Array.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind). Documentation-validated; **no timings**.

**A higher-order function takes a function, returns a function, or both.** That is the whole
definition — and it is unremarkable in JavaScript because functions are ordinary values, which MDN
calls *first-class*: they can be assigned to variables, passed as arguments and returned like any
other value.

## Taking a function

```js
[1, 2, 3].map((n) => n * 2);
button.addEventListener("click", handleClick);
promise.then(onFulfilled, onRejected);
items.sort((a, b) => a.price - b.price);
```

You have been writing these since phase 0. The only thing worth adding is **what the caller
controls and what the callee controls**:

- **The higher-order function decides when, how often, and with what arguments** the callback runs.
- **The callback decides only what to do with them.**

🔴 **That inversion is why callback contracts matter.** `map` calls yours once per element with
`(value, index, array)`; `reduce` with `(acc, value, index, array)`; `sort` with two elements and
expects a **number** back, not a boolean
([Phase 5 · 06 · `sort`](../phase-5-built-in-library/06-sort/README.md)). Getting the contract
wrong produces a plausible wrong answer, not an error.

## Returning a function

This is where higher-order functions stop being ordinary array work.

```js
function multiplier(factor) {
  return (n) => n * factor;             // the returned function closes over `factor`
}

const double = multiplier(2);
double(21);                              // 42
```

**The returned function keeps `factor` alive** — that is a closure
([06 · Closures](./06-closures/README.md)), and it is the mechanism behind every wrapper in the
language: `debounce`, `throttle`, `memoize`, `once`, `bind`, and every middleware signature you
will meet.

**A configuration-first shape reads well:**

```js
const withRetry = (attempts) => (fn) => async (...args) => {
  for (let i = 0; ; i++) {
    try { return await fn(...args); }
    catch (err) { if (i >= attempts) throw err; }
  }
};

const fetchWithRetry = withRetry(3)(fetch);
```

⚠️ **Each arrow layer costs readability.** Three levels is the point at which most readers stop
tracking which arguments belong where — which is the same warning that applies to currying
(**11 · Currying and partial application**, *not written yet*).

## The wrapper pattern

The most useful shape in practice: take a function, return a function that does something extra.

```js
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (called) return result;
    called = true;
    result = fn.apply(this, args);       // 🔴 forward `this` and the arguments
    return result;
  };
}

function withLogging(fn, name = fn.name) {
  return function (...args) {
    console.log(`→ ${name}`, args);
    try {
      const out = fn.apply(this, args);
      console.log(`← ${name}`, out);
      return out;
    } catch (err) {
      console.log(`✗ ${name}`, err);
      throw err;                          // 🔴 re-throw — a wrapper must not swallow
    }
  };
}
```

🔴 **Three rules every wrapper must follow**, and each is a real bug when broken:

- **Forward `this`.** A regular `function` wrapper with `fn.apply(this, args)` — an arrow wrapper
  captures the *defining* scope's `this` and breaks `obj.method()`
  ([05 · `call`, `apply`, `bind`](./05-call-apply-bind/README.md)).
- **Forward all arguments** with rest and spread, not a fixed arity.
- **Re-throw.** A logging or timing wrapper that swallows the error changes the program's
  behaviour, which a wrapper is not supposed to do.

⚠️ **And a wrapper loses `name`, `length` and any properties on the original.** Libraries read
those — `fn.length` is how some frameworks detect whether a callback wants a `next` argument. If
that matters, copy them across with `Object.defineProperty`; if it does not, say so rather than
leaving it unconsidered.

## Where it earns its place

**Not everywhere.** A higher-order function is worth it when the *behaviour* varies and the
*structure* does not:

```js
// ✅ structure fixed (iterate, accumulate), behaviour varies
const totals = orders.map(orderTotal);

// ❌ a "generic" abstraction with one call site and three flags
const process = (items, { sort, filter, transform, group }) => …;
```

🔴 **An abstraction with one caller is a rename, not an abstraction**, and one with four boolean
options is usually two functions wearing a trench coat. Wait for the second call site.

## Gotchas

**Symptom:** `this` is `undefined` inside a wrapped method
**Cause:** The wrapper is an arrow, or calls `fn(...)` instead of `fn.apply(this, args)`.
**Fix:** A regular function wrapper that forwards `this`.

**Symptom:** A wrapped function loses arguments
**Cause:** The wrapper declared a fixed arity.
**Fix:** `(...args)` and `apply`/spread.

**Symptom:** Errors disappear after adding logging
**Cause:** The wrapper caught and did not re-throw.
**Fix:** Re-throw; a wrapper must not change behaviour.

**Symptom:** A framework stops passing `next` to a wrapped middleware
**Cause:** The wrapper's `length` is `0`, and the framework reads arity.
**Fix:** Copy `length`/`name` with `defineProperty`, or do not wrap that function.

**Symptom:** `sort` produces a wrong order
**Cause:** The comparator returned a boolean instead of a number.
**Fix:** Return a negative number, zero, or a positive number.

**Symptom:** Three-level arrow chains are unreadable
**Cause:** Configuration-first currying taken too far.
**Fix:** Two levels, or an options object.

**Symptom:** A "reusable" helper has one caller and four flags
**Cause:** Abstracting before the second use case existed.
**Fix:** Inline it; wait for the second call site.

## Interview questions

**★ What makes a function "higher-order"?**
It takes a function as an argument, returns a function, or both. It is unremarkable in JavaScript
because functions are **first-class values** — assignable, passable and returnable like any other
value.

**★ What does the higher-order function control, and what does the callback control?**
The higher-order function decides **when, how often and with what arguments** the callback runs;
the callback decides only what to do with them. That inversion is why the callback contract —
`map`'s `(value, index, array)`, `sort`'s numeric return — matters, and why getting it wrong yields
a plausible wrong answer rather than an error.

**★ Name the three rules for writing a wrapper.**
Forward `this` (a regular function plus `fn.apply(this, args)`, never an arrow); forward **all**
arguments with rest/spread; and **re-throw** — a wrapper that swallows errors changes the
program's behaviour.

**★ What does a wrapper silently lose?**
`name`, `length` and any properties on the original function. `length` matters because some
frameworks read arity to decide what to pass — copy them with `Object.defineProperty` if it does.

**★ When is a higher-order function *not* the right answer?**
When the structure varies as much as the behaviour, or when there is one call site. An abstraction
with a single caller is a rename, and one with four boolean flags is usually two functions in
disguise. Wait for the second use.

**Why does returning a function require closures?**
Because the returned function keeps referencing the outer call's variables after that call has
returned. That is the closure, and it is the mechanism behind `debounce`, `memoize`, `once` and
every middleware signature.

---

← [08 · Hoisting and the TDZ](./08-hoisting-and-tdz/README.md) · [Phase index](./README.md)
