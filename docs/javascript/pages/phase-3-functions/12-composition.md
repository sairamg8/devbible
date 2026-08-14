---
title: "12 · Composition (pipe and compose)"
sidebar_label: "12 · Composition"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Array.prototype.reduceRight()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`Function: name`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name), [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length). Documentation-validated; **no timings**.

**Composition is one idea: the output of one function is the input of the next.** Everything
below is that sentence plus argument order and a debugging cost.

> **`compose(f, g, h)(x)`** is `f(g(h(x)))` — **right to left**, the way it is written in maths.
> **`pipe(f, g, h)(x)`** is `h(g(f(x)))` — **left to right**, the way it is read.

🔴 **They are the same function with the argument list reversed.** Nothing else separates them, and
being able to say that immediately is most of the interview question.

## Why `pipe` won

Both exist; `pipe` is what you see in modern code (RxJS's `.pipe()`, `pipe` in the fp libraries)
and `compose` survives mostly where it was already established — notably Redux's `compose`, which
applies store enhancers right to left.

The reason is reading order. Given a three-step transform, `compose` forces the reader to start at
the end of the line and work backwards:

```js
compose(formatMoney, applyTax, subtotal)(cart);  // ⚠️ read right to left
pipe(subtotal, applyTax, formatMoney)(cart);     // ✅ reads as the steps happen
```

**Prefer `pipe` in new code, and know `compose` exists because you will meet it.** When a codebase
already uses one, use that one — mixing both is worse than either.

## Two implementations, and the difference matters

The one to reach for:

```js
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
```

`reduce` walks left to right, `reduceRight` walks right to left, and the seed is the value being
threaded through — so `compose` is genuinely `pipe` with the traversal flipped
(**[05 · `reduce`](../phase-5-built-in-library/05-reduce/README.md)** is the mechanism itself).

The other form you will see:

```js
const pipe = (...fns) => fns.reduce((f, g) => (...args) => g(f(...args)));
```

This one reduces the *functions* into a single function rather than threading a value, which buys
one real thing: **the first function may take several arguments.** `pipe(add, double)(2, 3)` works
here and does not work in the first form.

⚠️ **It also has a trap the first form does not.** There is no initial value, and MDN specifies that
`reduce` on an empty array with no initial value **throws a `TypeError`** — so `pipe()` with zero
functions throws *when you build the pipeline*, not when you call it:

```js
pipe();   // ⚠️ TypeError: Reduce of empty array with no initial value
```

The seeded form returns the identity function instead, which is almost always what an empty
pipeline should do. 🔴 **Pick the seeded form unless you specifically need a variadic first
function** — and if you need both, seed it with an identity:

```js
const pipe = (...fns) =>
  fns.reduce((f, g) => (...args) => g(f(...args)), (...args) => args[0]);
```

## Everything after the first function is unary

This is the constraint that shapes all the surrounding code. A composed step receives exactly one
value — whatever the previous step returned — so **every function in the chain but the first must
take one argument.**

That is precisely why **[11 · Currying and partial application](./11-currying-and-partial-application.md)**
insists on configuration first, data last:

```js
const withTax = (rate) => (amount) => amount * (1 + rate);   // ✅ config first
pipe(subtotal, withTax(0.2), formatMoney)(cart);
```

`withTax(0.2)` is a *value* — a unary function ready to slot in. A data-first `applyTax(amount,
rate)` cannot go in a pipeline at all without a wrapper. 🔴 **Currying and composition are not two
techniques; currying is what makes composition possible.**

**To return more than one value, return an object** and let the next step destructure it. Resist
the urge to make steps variadic — the moment one step takes two arguments the pipeline stops being
a pipeline.

## Async composition

Real pipelines hit an `await` almost immediately, and the synchronous `pipe` above breaks the
moment a step returns a promise: the next step receives the *promise*, not the value.

The fix is one word — thread promises instead of values:

```js
const pipeAsync = (...fns) => (x) =>
  fns.reduce((p, fn) => p.then(fn), Promise.resolve(x));
```

This works because `then` unwraps: MDN specifies that when a handler returns a thenable, the
promise returned by `then` adopts its state, so a step may be sync or async and the chain does not
care. Mixed steps compose freely.

🔴 **It is `await` in a loop, written differently** — the steps run strictly in sequence, each
waiting for the one before. That is the point of a pipeline, but it means `pipeAsync` is the wrong
tool for independent work; that wants
**[10 · Combinators](../phase-7-async/10-combinators/README.md)**. Error handling is promise-chain
error handling, unchanged — a throw anywhere skips to the caller's `catch`
(**[06 · Chaining](../phase-7-async/06-chaining/README.md)**).

## Point-free style, and how far to take it

**Point-free** (or *tacit*) means defining a function without naming its argument. The "point" is
the argument:

```js
const slugify = (title) => toLowerCase(replaceSpaces(trim(title)));  // pointed
const slugify = pipe(trim, replaceSpaces, toLowerCase);              // point-free
```

The second is genuinely better: it says *what* the transformation is rather than plumbing a
variable through three calls, and there is no name to get wrong.

⚠️ **It stops paying almost immediately after that.** Point-free style rewards a straight line of
unary transformations and punishes everything else — a branch, a value needed by two steps, or an
argument used out of order all force helper combinators whose names (`converge`, `juxt`, `useWith`)
mean nothing to a reader who has not learned that library.

🔴 **The honest boundary: point-free for a straight chain of named, unary transforms; a plain
arrow the moment you need a conditional, a second use of a value, or an argument in a different
position.** A one-line arrow with a named argument is not a failure — it is usually the clearer
code, and "I would stop being point-free here" is a stronger answer than composing around it.

## What it costs: the stack trace

This is the part interviews probe, and it is a real cost.

**A composed pipeline collapses into anonymous frames.** Each stage in `(...fns) => (x) =>
fns.reduce((acc, fn) => fn(acc), x)` is the *same* anonymous arrow, so a throw in step four gives a
stack that cannot tell you it was step four. There is no line of source that corresponds to "after
`applyTax`, before `formatMoney`" — the pipeline is data, not code.

Three things genuinely help:

**Name every step.** MDN documents that a function gets its `name` from the variable it is assigned
to, so `const applyTax = (x) => …` produces a function named `applyTax` rather than an anonymous
one. Named steps are the difference between a readable stack and a wall of arrows — and it costs
nothing.

**Keep a `tap`.** A step that observes and passes the value through, so you can see between stages
without dismantling the pipeline:

```js
const tap = (label) => (x) => { console.log(label, x); return x; };

pipe(subtotal, tap("after subtotal"), withTax(0.2), formatMoney)(cart);
```

⚠️ `tap` must return `x`. A `tap` that forgets returns `undefined` into the next step and quietly
destroys the pipeline — this is the single most common bug when debugging composed code.

**Know when to stop composing.** Six steps deep with a bug you cannot place, rewrite it as six
named `const`s in sequence, fix it, and decide afterwards whether to put it back. Intermediate
values you can name are worth more than elegance while debugging.

Two smaller costs worth knowing: the composed function reports **`length` of `0`** and an empty
`name`, because it is built from a rest-parameter arrow — so anything introspecting arity (a
`curry`, a validation layer, a DI container) sees nothing useful. And each stage is a closure
allocation, which is irrelevant once and measurable in a hot loop.

## Where you already use it

**Method chaining is composition with a fixed vocabulary.** `arr.filter(…).map(…).reduce(…)` reads
top to bottom exactly like a pipe, and it is the better choice when the steps are all array
methods: no library, no arity rules, and the stack trace names the method.

Composition earns its place when the steps are **free functions of your own** — domain transforms
that no built-in owns. That is also the trade-off in one line: **method chaining is limited to
methods the type provides; composition works on anything, and gives up the stack trace to do it.**

Composed pipelines are also the shape behind middleware — Redux's `compose` for enhancers, and the
`(req, res, next)` chain in Express — which is why the pattern is worth recognising even in a
codebase that never writes `pipe` itself. Building the utilities from an empty file is
**Phase 17 topic 13 · `curry`, `pipe` and `compose`** *(not written yet)*.

## Gotchas

**Symptom:** `pipe()` throws before you ever call it
**Cause:** The function-reducing form uses `reduce` with no initial value, and MDN specifies that throws a `TypeError` on an empty array.
**Fix:** Seed the reduce — with the value in the threading form, or an identity function.

**Symptom:** A step receives a `Promise` instead of a value
**Cause:** A synchronous `pipe` does not await anything.
**Fix:** `pipeAsync`, threading `p.then(fn)` from `Promise.resolve(x)`.

**Symptom:** Everything after a `tap` receives `undefined`
**Cause:** The `tap` logged but did not return `x`.
**Fix:** `(x) => { console.log(x); return x; }` — the return is the whole contract.

**Symptom:** A function will not go into a pipeline without a wrapper
**Cause:** Data-first argument order; every step after the first must be unary.
**Fix:** Curry it — configuration first, data last.

**Symptom:** The steps run in the wrong order
**Cause:** `compose` is right to left, `pipe` is left to right.
**Fix:** Pick one per codebase and never mix them.

**Symptom:** A stack trace from a pipeline is a wall of anonymous arrows
**Cause:** Every stage is the same anonymous closure; the pipeline is data, not code.
**Fix:** Name every step, keep a `tap`, and unroll to named `const`s while debugging.

**Symptom:** Something introspecting the composed function sees arity `0`
**Cause:** It is a rest-parameter arrow, so `length` is `0` and `name` is empty.
**Fix:** Do not compose functions that are about to be curried or arity-checked.

**Symptom:** A point-free version is harder to read than the loop it replaced
**Cause:** Branching or reused values forced in combinators the reader does not know.
**Fix:** Write the arrow. Point-free is for straight chains of unary transforms.

## Interview questions

**★ `compose` versus `pipe`?**
Same function, reversed argument order. `compose(f, g, h)(x)` is `f(g(h(x)))` — right to left, the
maths convention. `pipe(f, g, h)(x)` is `h(g(f(x)))` — left to right, which is why it reads better
and why new code prefers it. Redux's `compose` is the well-known right-to-left one.

**★ Write `pipe`.**
`const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);` — seed the reduce with the
value and thread it through. `compose` is the same with `reduceRight`.

**★ What breaks if you drop the initial value?**
You get the function-reducing form, which lets the *first* function be variadic but throws a
`TypeError` on `pipe()` with no arguments, because MDN specifies `reduce` on an empty array with no
initial value throws. Seed it with an identity function if you want both.

**★ Why must the functions be unary?**
Each step receives exactly one value — the previous step's return. Only the first can take more.
That constraint is why composition and currying always turn up together: currying is what produces
the data-last unary functions a pipeline needs. To pass several values, return an object.

**★ How would you compose async steps?**
Thread promises instead of values: `fns.reduce((p, fn) => p.then(fn), Promise.resolve(x))`. `then`
adopts a returned thenable, so steps can be sync or async interchangeably. Note that it is strictly
sequential — independent work wants a combinator instead.

**★ What does composition cost?**
Debuggability, mainly. Every stage is the same anonymous closure, so a stack trace cannot tell you
which step threw, and there are no intermediate values to inspect. Name every step so `Function.name`
gives the frames something to show, keep a `tap` that returns its argument, and unroll to named
constants when you are actually debugging. Also: the composed function reports `length` `0` and an
empty `name`, and each stage is a closure allocation.

**★ When would you not compose?**
When the steps are array methods — chain them, the trace is better. When there is branching, a
value used twice, or an argument out of position — write the arrow. And in a hot loop, where the
closure per stage stops being free.

**What is point-free style?**
Defining a function without naming its argument — `pipe(trim, replaceSpaces, toLowerCase)` rather
than `(title) => toLowerCase(replaceSpaces(trim(title)))`. Good for a straight chain of unary
transforms, bad the moment you need a conditional or a second use of a value.

---

← [11 · Currying and partial application](./11-currying-and-partial-application.md) · [Phase index](./README.md) · **13 · Memoization** *(not written yet)* →
