---
title: "13.2 · `pipe` and `compose`"
sidebar_label: "02 · `pipe` and `compose`"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Array.prototype.reduceRight()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight), [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters) and [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Documentation-validated; **nothing was run**.

Both take a list of functions and return one function that runs them in sequence. **They
differ only in direction**, and the direction is the whole of the interview question.

```js
const pipe = (...fns) => (...args) =>
  fns.reduce((acc, fn, i) => (i === 0 ? fn(...args) : fn(acc)), undefined);

const compose = (...fns) => (...args) => pipe(...fns.reverse())(...args);
```

Or, the versions worth writing under pressure:

```js
const pipe    = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
```

```js
pipe(double, increment)(5);      // increment(double(5))  = 11   — left to right
compose(double, increment)(5);   // double(increment(5))  = 12   — right to left
```

## Which direction, and why both exist

**`compose` matches the mathematics** — `compose(f, g)(x)` is `f(g(x))`, read the way it is
written on paper. **`pipe` matches reading order** — first step first, like a shell pipeline or
a method chain. For code that other people read, `pipe` is almost always the better default;
`compose` survives because it is the older convention and because higher-order wrappers
(middleware, decorators) compose naturally right-to-left.

The reduce direction is the only implementation difference: `reduce` for `pipe`,
`reduceRight` for `compose`.

## The details a good answer includes

**The first function may take several arguments; the rest take one.**

```js
const pipe = (...fns) => (...args) => {
  if (fns.length === 0) return args[0];                        // identity for an empty pipeline
  const [first, ...rest] = fns;
  return rest.reduce((acc, fn) => fn(acc), first(...args));
};
```

Each stage returns one value, so only the first can be n-ary. `pipe()` with no functions
returning its input is the sensible identity — and it makes `pipe(...maybeEmpty)` safe.

**Async pipelines are a different function.** Do not pretend one implementation covers both:

```js
const pipeAsync = (...fns) => (x) => fns.reduce((p, fn) => p.then(fn), Promise.resolve(x));
```

Every stage may return a promise, and `then` adopts it whether or not it does
([10 · A Promise from scratch](../10-promise-from-scratch/README.md)). Errors propagate to the
returned promise's `catch`, so the whole chain has one failure path — one of the genuinely
nice properties of this shape ([Phase 7 · 06 · Chaining](../../phase-7-async/06-chaining/README.md)).

**Errors in the sync version are just exceptions.** No stage is skipped or wrapped: the first
throw exits the pipeline. If you want per-stage handling, the pipeline is the wrong abstraction
— or the values need to carry their own success/failure, which is where a `Result` type comes
in and where most codebases stop.

## Point-free style, and its limit

Currying plus `pipe` is what "point-free" means — the data is never named:

```js
const activeNames = pipe(
  filter(prop("active")),
  map(prop("name")),
  join(", "),
);

activeNames(users);
```

Read forwards, each stage named, no intermediate variables. **The limit is the debugger**:
there is no line where you can inspect the value between stages, so a `tap` is standard:

```js
const tap = (fn) => (x) => { fn(x); return x; };

pipe(filter(isActive), tap(console.log), map(getName));
```

⚠️ **Point-free stops paying when a stage needs two inputs.** Threading a second value through
a pipeline produces contortions (`converge`, `fork`, tuples) that a two-line ordinary function
expresses directly. Use the pipeline where the data flows in one line, and a plain function
where it does not.

## When to use it — and the honest comparison

```js
const result = pipe(a, b, c)(input);          // point-free
const result = c(b(a(input)));                 // nested — right-to-left, hard to read at 4+
const result = input.map(a).filter(b);         // method chain — only for built-in types
let v = a(input); v = b(v); v = c(v);          // ⛔ reassignment, but honest and debuggable
```

`pipe` wins when there are several stages, the stages are reusable named functions, and you
want to define the composed operation once and apply it many times. **Nested calls are fine
for two.** A method chain is better when the type already has the methods — you cannot chain
your own functions onto an array without wrapping it.

Two more things worth saying:

- **Redux's `compose` is this exact function**, used to combine store enhancers, which is where
  most JavaScript developers first meet it.
- **Typing a general `pipe` requires per-arity overloads** in TypeScript, which is why library
  versions ship dozens of them and why a hand-written composed function is often easier to
  type.

## Gotchas

**Symptom:** The stages ran in the wrong order
**Cause:** `pipe` is left-to-right, `compose` is right-to-left.
**Fix:** Pick one convention per codebase — `pipe` reads better — and name it clearly.

**Symptom:** Only the first argument survived
**Cause:** Every stage returns one value; only the first function can be n-ary.
**Fix:** Expected. Pass an object if several values must flow through.

**Symptom:** `pipe()` with no functions threw
**Cause:** `reduce` on an empty array with no initial value.
**Fix:** Return the input — an empty pipeline is the identity.

**Symptom:** Promises came out where values were expected
**Cause:** An async stage in a synchronous pipeline.
**Fix:** `pipeAsync`, which chains with `then`.

**Symptom:** A stack trace showed nothing but anonymous frames
**Cause:** Composed anonymous functions.
**Fix:** Name each stage, and use `tap` to observe intermediate values.

**Symptom:** A stage needed a second input and the pipeline turned into knots
**Cause:** Point-free style only fits single-value flows.
**Fix:** Write an ordinary function; not everything should be a pipeline.

## Interview questions

**★ Implement `pipe` and `compose`.**
`pipe(...fns)` returns `(...args) => fns.reduce((acc, fn) => fn(acc), first(...args))`;
`compose` is the same with `reduceRight`. The first function may take several arguments,
every later stage takes one, and an empty pipeline returns its input.

**★ What is the difference between them?**
Direction only. `pipe(f, g)(x)` is `g(f(x))` — reading order; `compose(f, g)(x)` is `f(g(x))`
— mathematical order. `pipe` is usually the better default for readability.

**★ How do you compose async functions?**
`fns.reduce((p, fn) => p.then(fn), Promise.resolve(x))`. Each stage may return a value or a
promise — `then` adopts either — and one `catch` covers the whole chain.

**★ What is point-free style and where does it stop being useful?**
Composing named operations without naming the data. It stops paying when a stage needs more
than one input, or when you need to inspect an intermediate value — hence `tap`, and hence
plain functions for anything that branches.

**Why can only the first function be variadic?**
Because each stage receives exactly what the previous one returned, and a function returns one
value. Bundle multiple values into an object if they must all flow through.

**Where have you seen `compose` in the wild?**
Redux, for combining store enhancers and middleware — the canonical real-world use, and the
reason the right-to-left version is still common.

---

← Prev [`curry`](./01-curry.md) · [Topic index](./README.md)
