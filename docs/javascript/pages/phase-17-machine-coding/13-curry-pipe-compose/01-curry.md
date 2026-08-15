---
title: "13.1 · `curry`"
sidebar_label: "01 · `curry`"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length), [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`Function.prototype.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply) and [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters). Documentation-validated; **nothing was run**.

**Currying turns `f(a, b, c)` into a function you can call one argument at a time**, and
collect the result when enough have arrived:

```js
const add3 = (a, b, c) => a + b + c;
const curried = curry(add3);

curried(1)(2)(3);      // 6
curried(1, 2)(3);      // 6   — partial application at any split
curried(1)(2, 3);      // 6
curried(1, 2, 3);      // 6   — still works as the original
```

## The implementation

```js
function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);       // enough — call through
    return function (...rest) {                                   // not enough — collect more
      return curried.apply(this, [...args, ...rest]);
    };
  };
}
```

Four lines, and every one is a question:

- **`fn.length` is the arity**, and it is the whole mechanism. MDN's `length` is the number of
  parameters **before** the first default or rest parameter — so `(a, b = 1, c) => …` reports
  `1`, and `(...args) => …` reports `0`. **A variadic function cannot be curried by arity**,
  which is why the `arity` parameter is exposed for callers to state it.
- **`args.length >= arity`, not `===`**, so extra arguments pass through instead of being
  silently dropped.
- **`function`, not an arrow**, plus `fn.apply(this, args)` — a curried *method* still needs
  its receiver ([02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md)).
- **`curried.apply(this, [...])` recurses**, so any split of the arguments works. The
  accumulated `args` live in the closure of each partial
  ([Phase 3 · Closures](../../phase-3-functions/README.md)).

## Currying is not partial application

They are related and constantly conflated:

| | Currying | Partial application |
|---|---|---|
| What it is | a transform: n-ary → a chain of unary-ish calls | fixing some arguments **now** |
| Result | a function that keeps returning functions until satisfied | a function of the remaining arity |
| Built-in | none | **`bind`** |

```js
const add = (a, b, c) => a + b + c;

const partial = add.bind(null, 1, 2);   // partial application — one step
partial(3);                              // 6

const curried = curry(add);              // currying — every step
curried(1)(2)(3);
```

**`bind` is partial application with a `this` binding attached**, which is why it is the
answer to "how do you do this without a helper" — and why `bind(null, …)` is the idiom when
you only want the arguments.

## Where it earns its place

The honest answer: **argument order, and reuse of the partial**.

```js
const prop = curry((key, obj) => obj[key]);
const pluck = curry((key, list) => list.map(prop(key)));

const names = pluck("name");             // a reusable, named function
names(users);
names(admins);
```

The "data last" argument order is what makes currying useful — the configuration comes first
and the data comes last, so partials are meaningful operations with names. **Currying a
data-first function produces nothing worth having**, which is the real reason curried helper
libraries define their own argument orders.

It is also what makes point-free pipelines readable
([13.2](./02-pipe-and-compose.md)):

```js
const activeNames = pipe(filter(prop("active")), map(prop("name")));
```

## The costs, stated plainly

- **Arity detection is fragile.** Defaults, rest parameters and optional arguments all break
  `fn.length`; the caller has to supply the arity, which is the thing currying was meant to
  infer.
- **Stack traces get worse.** Several anonymous frames sit between the call and the work.
- **Zero-argument calls do nothing.** `curried()` with no arguments returns another collector —
  an easy infinite-loop-shaped bug in generated code.
- **TypeScript types for a general `curry` are notoriously involved**, which is why typed
  codebases usually write explicit closures instead.
- **Modern JavaScript already has a good enough version:** an arrow chain, written directly.

```js
const add3 = (a) => (b) => (c) => a + b + c;      // curried by construction
```

**Write the arrow chain when you control the function.** Reach for `curry` when you must
adapt an existing n-ary function you cannot change.

## Placeholders — know they exist, and skip them

Library curries let you supply arguments out of order:

```js
const _ = Symbol("placeholder");
const replaceAll = curry((find, replace, str) => str.replaceAll(find, replace));
replaceAll(_, "-", "a b c");           // fix only the middle argument
```

Implementing it means scanning accumulated arguments for the placeholder and filling gaps
rather than appending. **It roughly doubles the implementation and is rarely worth it** — a
plain arrow (`(find) => replaceAll(find, "-", str)`) is clearer at every call site. Mention it
in an interview as a known extension; do not write it unless asked.

## Gotchas

**Symptom:** `curry(fn)` never called through
**Cause:** `fn.length` is `0` — a rest parameter, or a default in the first position.
**Fix:** Pass the arity explicitly: `curry(fn, 3)`.

**Symptom:** Extra arguments were dropped
**Cause:** Comparing `args.length === arity`.
**Fix:** `>=`, and forward everything with `apply`.

**Symptom:** `this` was lost in a curried method
**Cause:** Arrow wrappers, or calling `fn(...args)`.
**Fix:** `function` wrappers and `fn.apply(this, args)` at each level.

**Symptom:** `curried()` returned a function forever
**Cause:** A call with no arguments adds nothing, so the arity is never reached.
**Fix:** Guard against empty calls, or do not generate them.

**Symptom:** The partial application was useless
**Cause:** The function takes its data first, so the fixed arguments are the data.
**Fix:** Order parameters configuration-first, data-last — or use `bind`.

**Symptom:** Debugging a curried pipeline was painful
**Cause:** Anonymous intermediate frames.
**Fix:** Name the partials (`const names = pluck("name")`), which also documents them.

## Interview questions

**★ Implement `curry`.**
Return a `curried` function that accumulates arguments: if it has at least `fn.length`, call
`fn.apply(this, args)`; otherwise return a collector that concatenates the next arguments and
recurses. Accept an explicit arity, because `fn.length` is unreliable.

**★ Why is `fn.length` unreliable?**
It counts parameters before the first default or rest parameter. `(a, b = 1, c) => …` reports
`1` and `(...args) => …` reports `0`, so variadic and defaulted functions cannot be curried by
arity alone.

**★ What is the difference between currying and partial application?**
Currying transforms an n-ary function into a chain that can be called one argument at a time.
Partial application fixes some arguments now and returns a function of the rest — which is
exactly what `bind` does.

**★ Why does argument order matter so much for currying?**
Because partials are only useful if the fixed arguments are the *configuration*. Data-last
ordering gives you named, reusable operations; data-first gives you nothing worth keeping.

**How would you curry without a helper?**
Write the arrow chain: `(a) => (b) => (c) => …`. It is clearer, keeps its types, and needs no
arity detection. `curry` is for adapting a function you cannot rewrite.

**What are placeholders and would you implement them?**
A sentinel that lets arguments be supplied out of order. It roughly doubles the implementation
and a plain arrow is clearer at the call site — worth naming as an extension, not worth
writing by default.

---

[Topic index](./README.md) · Next → [`pipe` and `compose`](./02-pipe-and-compose.md)
