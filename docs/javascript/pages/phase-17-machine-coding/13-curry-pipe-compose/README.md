---
title: "13 · curry, pipe, compose"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length), [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Array.prototype.reduceRight()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight). Documentation-validated; **nothing was run**.

**Three small functions that only make sense together.** `curry` produces the reusable
one-argument stages; `pipe` and `compose` string them into an operation you define once and
apply many times.

```js
const curry   = (fn, arity = fn.length) => function curried(...args) {
  return args.length >= arity ? fn.apply(this, args)
                              : (...rest) => curried.apply(this, [...args, ...rest]);
};
const pipe    = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);        // left to right
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);   // right to left

const activeNames = pipe(filter(prop("active")), map(prop("name")));
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`curry`](./01-curry.md)** | The implementation and its four decisions, **why `fn.length` is unreliable** (defaults and rest parameters), currying versus **partial application and `bind`**, why **data-last argument order** is what makes partials worth having, the five costs, and placeholders — what they are and why to skip them |
| 2 | **[`pipe` and `compose`](./02-pipe-and-compose.md)** | `reduce` versus `reduceRight` and **which direction to standardise on**, the variadic first stage and the empty-pipeline identity, **`pipeAsync` with one failure path**, point-free style with `tap` — and **where it stops paying**, plus the honest comparison against nested calls and method chains |

## The three that catch people

```js
curry((...args) => …);          // ⛔ fn.length is 0 — it never calls through
pipe(a, b) vs compose(a, b);     // ⛔ opposite orders; pick one per codebase
pipe(fetchUser, getName);        // ⛔ a promise flows into a sync stage — use pipeAsync
```

## Phase gate

You are done with this topic when you can write all three from an empty file, say why
`fn.length` cannot be trusted, explain the difference between currying and partial
application, and name the point at which a pipeline should become an ordinary function.

## Where this connects

- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — `bind` is partial application, and `apply` is how the receiver survives currying
- [Phase 3 · Functions, scope and closures](../../phase-3-functions/README.md) — the closures holding accumulated arguments
- [Phase 5 · 05 · `reduce`](../../phase-5-built-in-library/05-reduce/README.md) — the fold both compositions are built on
- [10 · A Promise from scratch](../10-promise-from-scratch/README.md) — why `then` chaining makes `pipeAsync` three lines
- [11 · `memoize`](../11-memoize/README.md) — the other wrap-a-function helper, with the same `this` and identity questions

---

Start → [`curry`](./01-curry.md)
