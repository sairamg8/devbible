---
title: "05.1 · Pause and resume"
sidebar_label: "01 · Pause and resume"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*), [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**A generator is a function that can stop in the middle and be resumed later with its
local variables intact.** Every other function in JavaScript runs to completion once
called; a generator runs until the next `yield`, hands a value out, and freezes exactly
where it stood — line, loop counter, closure variables and all.

That single capability is what makes the protocol work in
[04 · The iteration protocols](../04-iteration-protocols/README.md) cheap to implement.
Everything you wrote by hand there — the cursor object, the index variable, the
`{ value, done }` bookkeeping — a generator produces for you.

```js
function* ids() {
  let n = 1;
  while (true) yield n++;      // never "finishes", and that is fine
}

const it = ids();
it.next();   // { value: 1, done: false }
it.next();   // { value: 2, done: false }
```

## Calling it runs nothing

The first surprise, and MDN states it plainly:

> "Each time a generator function is called, it returns a new `Generator` object, which
> conforms to the iterator protocol. The generator function's execution is *suspended* at
> some place, which is initially at the very beginning of the function body."

```js
function* noisy() {
  console.log("started");
  yield 1;
}

const g = noisy();   // NOTHING is logged — no body has run
g.next();            // "started" is logged now, and { value: 1, done: false } comes back
```

**Calling a generator function is a constructor-like act, not a call in the ordinary
sense** — you get a paused machine, not a result. Any argument validation you put at the
top of a generator therefore does not run until the first `next()`, which is why input
checking sometimes belongs in a plain wrapper function around the generator.

## What `next()` does

MDN: when `next()` is called, the body executes until one of:

- **a `yield` expression** — *"the `next()` method returns an object with a `value`
  property containing the yielded value and a `done` property that is always `false`"*;
- **a `return` statement, or the end of the body** (implicitly `return undefined`) — *"the
  generator is finished, and the `next()` method returns an object with a `value` property
  containing the returned value and a `done` property that is always `true`"*;
- **a `throw`**, which propagates out to the caller of `next()` and leaves the generator
  finished.

```js
function* two() {
  yield "a";
  yield "b";
  return "done";
}

const g = two();
g.next();  // { value: "a",    done: false }
g.next();  // { value: "b",    done: false }
g.next();  // { value: "done", done: true  }   ← the RETURN value
g.next();  // { value: undefined, done: true }
```

**`for...of` never sees `"done"`.** The value that arrives alongside `done: true` is the
iteration's *return* value, and every built-in consumer discards it — `for...of`, spread,
`Array.from`, destructuring. If it matters, drive `next()` yourself
(**13 · Driving an iterator by hand** *(not written yet)*).

## Generator objects are one-shot, and are their own iterator

A generator object has `[Symbol.iterator]()` returning `this` — the *iterable iterator*
shape from [04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md). So it
drops straight into `for...of` and spread, and it is **exhausted afterwards, permanently**:

```js
const g = two();
[...g];   // ["a", "b"]
[...g];   // []          — same object, already finished
```

**The fix is almost always to keep the generator *function* around instead of the
generator object**, and call it again per consumer:

```js
const seq = () => two();       // a factory
[...seq()]; [...seq()];        // ["a", "b"] twice

const collection = { *[Symbol.iterator]() { yield "a"; yield "b"; } };
[...collection]; [...collection];   // also fine — the METHOD makes a new generator each call
```

That second form is the one to reach for on an object or a class: the method is a
generator function, so every `[Symbol.iterator]()` call produces a fresh, independent
cursor.

## Every place `function*` can be written

```js
function* declaration() {}                     // declaration — hoisted like any function declaration
const expr = function* () {};                  // expression
const obj = { *method() { yield 1; } };        // object method
class C {
  *rows() { yield 1; }                         // class method
  *[Symbol.iterator]() { yield* this.items; }  // computed key — makes instances iterable
  static *of(xs) { yield* xs; }                // static method
}
```

Two hard limits, both from MDN:

- **No arrow generators.** *"Generator functions do not have arrow function
  counterparts."* There is no `*() => {}`. If you need `this` from the surrounding scope
  inside a generator, capture it (`const self = this`) or use a generator **method**,
  which gets `this` from the receiver anyway.
- **Not constructible.** `new f()` on a generator function throws
  `TypeError: f is not a constructor`.

## `yield` only works directly inside the generator body

MDN: **"`yield` can only be used directly within the generator function that contains it.
It cannot be used within nested functions."**

This is the trap that catches everyone exactly once:

```js
function* broken(items) {
  items.forEach((x) => {
    yield x;          // SyntaxError — the arrow function is not a generator
  });
}

function* fixed(items) {
  for (const x of items) yield x;   // a LOOP, not a callback
}
```

**Generators and callback-taking array methods do not mix.** `forEach`, `map` and
`filter` all invoke an ordinary function, and `yield` inside an ordinary function is a
syntax error. Write the loop, or delegate with `yield*` (**10 · `yield*` delegation**
*(not written yet)*).

`yield` with no operand yields `undefined`. And because it is an operator with very low
precedence, it needs parentheses whenever the yielded value is used in a larger
expression — `const x = (yield a) + 1;` is not the same as `const x = yield (a + 1);`.

## `next(value)` sends a value back in

`yield` is an *expression*, and its result is whatever the next `next()` passes:

```js
function* counter(value) {
  while (true) {
    const step = yield value++;
    if (step) value += step;
  }
}

const g = counter(0);
g.next().value;    // 0
g.next().value;    // 1
g.next(10).value;  // 14
```

MDN's warning about the asymmetry is worth reading twice: *"`next()` is asymmetric: it
always sends a value to the currently suspended `yield`, but returns the operand of the
next `yield`. The argument passed to the first `next()` call cannot be retrieved because
there's no currently suspended `yield`."*

**The first `next()` argument is silently thrown away** — there is nothing suspended yet
to receive it. Pass initial data as a function argument instead. Two-way communication is
its own topic (**09 · Two-way generators** *(not written yet)*); for iteration purposes,
`next()` with no argument is all you need.

## Ending it early — `return()` and `throw()`

MDN: *"when the generator's `throw()` method is called, it acts as if a `throw` statement
is inserted in the generator's body at the current suspended position. Similarly, when the
generator's `return()` method is called, it acts as if a `return` statement is inserted in
the generator's body at the current suspended position."*

Inserted **at the suspended position** is the important part, because it means `finally`
runs:

```js
function* withCleanup() {
  try {
    yield 1;
    yield 2;
  } finally {
    release();      // runs on break, on return(), on throw()
  }
}

for (const x of withCleanup()) break;   // release() is called
```

`for...of` calls `return()` on early exit ([04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md)),
`return()` behaves like a `return` at the pause point, and a `return` runs `finally`
blocks on the way out. **That chain is why `try/finally` inside a generator is a reliable
place to put cleanup** — and it is the one thing a hand-written iterator object makes you
implement yourself.

## Gotchas

**Symptom:** Code at the top of the generator did not run when it was called
**Cause:** Calling a generator function returns a suspended `Generator` object; MDN:
execution is *"initially at the very beginning of the function body."*
**Fix:** Expected. Put eager validation in a plain wrapper function that then returns the
generator.

**Symptom:** `SyntaxError` on `yield` inside a `forEach`/`map` callback
**Cause:** *"`yield` can only be used directly within the generator function that contains
it. It cannot be used within nested functions."*
**Fix:** Use a `for...of` loop, or `yield*` to delegate to another iterable.

**Symptom:** The generator produced values once and nothing afterwards
**Cause:** A generator object is its own iterator and is one-shot.
**Fix:** Call the generator function again per consumer, or expose it as
`*[Symbol.iterator]()` so each iteration makes a new one.

**Symptom:** The `return` value never showed up in the `for...of` loop
**Cause:** It arrives with `done: true`, and built-in consumers discard that `value`.
**Fix:** Call `next()` manually and read the final result object.

**Symptom:** `TypeError: f is not a constructor` from `new f()`
**Cause:** Generator functions are not constructible.
**Fix:** Call it — `f()` already returns a new object each time.

**Symptom:** There is no way to write `*() => {}`
**Cause:** *"Generator functions do not have arrow function counterparts."*
**Fix:** Use `function*`, or a generator method — and capture `this` explicitly if you
need the enclosing one.

**Symptom:** The value passed to the first `next()` disappeared
**Cause:** There is no suspended `yield` yet to receive it.
**Fix:** Pass it as an argument to the generator function.

**Symptom:** Cleanup after a `break` never happened
**Cause:** The cleanup is after the `yield` in normal flow, and the loop stopped pulling.
**Fix:** Wrap the yields in `try { … } finally { cleanup(); }` — `return()` is inserted at
the pause point and runs it.

## Interview questions

**★ What happens when you call a generator function?**
Nothing in the body runs. You get a new `Generator` object, suspended at the very
beginning, that conforms to the iterator protocol. The body advances only when `next()` is
called.

**★ What does `next()` return, and when is `done` true?**
`{ value, done }`. Hitting a `yield` gives the yielded value with `done: false`; hitting a
`return` or the end of the body gives the returned value (or `undefined`) with
`done: true`. `for...of` uses the values from the `done: false` results and discards the
final one.

**★ Why can't you `yield` inside a `forEach` callback?**
Because `yield` may only appear directly inside the generator function's own body — the
callback is a separate, ordinary function, so it is a `SyntaxError`. Use a `for...of`
loop instead.

**★ Why does spreading the same generator object twice give values then nothing?**
A generator object is an *iterable iterator*: its `[Symbol.iterator]()` returns `this`, so
both spreads share one cursor. The first drains it; the second finds it already
`done: true`. Keep the generator *function* and call it per consumer.

**How do generators relate to the iteration protocols?**
A generator object implements the iterator protocol (`next`, plus `return` and `throw`)
*and* the iterable protocol (`[Symbol.iterator]()` returning itself). Writing
`*[Symbol.iterator]() { … }` is therefore the shortest correct way to make any object
iterable.

**Where does cleanup go in a generator?**
In a `finally` block around the yields. `break`ing out of a `for...of` calls the
generator's `return()`, which behaves as if a `return` were inserted at the suspended
position — so `finally` runs.

**Can a generator be an arrow function, or be used with `new`?**
Neither. MDN: *"Generator functions do not have arrow function counterparts"*, and
`new f()` on one throws `TypeError: f is not a constructor`.

---

[Topic index](./README.md) · Next → [Lazy sequences, and what they are for](./02-lazy-sequences.md)
