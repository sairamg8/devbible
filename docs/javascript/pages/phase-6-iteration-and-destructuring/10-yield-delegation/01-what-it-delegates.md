---
title: "10.1 · What `yield*` delegates"
sidebar_label: "01 · What `yield*` delegates"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`yield*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield*), [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**`yield*` is not "yield with a star" — it is a different operator.** `yield x` emits `x`
as one value. `yield* xs` hands control of the generator to `xs` and emits **each** of its
values, then resumes. MDN: it *"delegates iteration of the current generator to an
underlying iterator… forwarding the generator's control flow to another iterable object."*

```js
function* g1() { yield 2; yield 3; yield 4; }

function* g2() {
  yield 1;
  yield* g1();     // 2, 3, 4 come out here
  yield 5;
}

[...g2()];         // [1, 2, 3, 4, 5]   — flat, not [1, g1object, 5]
```

Written with a plain `yield`, `yield g1()` would emit the generator *object* itself — one
value, and almost certainly a bug.

## It takes any iterable, not just a generator

MDN lists the operands: *"another `Generator`, arrays, strings, `arguments` objects"*, and
in an async generator, *"another `AsyncGenerator` or async iterable"*. Its example:

```js
function* g3(...args) {
  yield* [1, 2];
  yield* "34";
  yield* args;
}

[...g3(5, 6)];     // [1, 2, "3", "4", 5, 6]
```

Note `yield* "34"` yielding `"3"` and `"4"` — strings iterate by code point, exactly as in
[03 · Spread with iterables](../03-spread-with-iterables/README.md). **Anything with
`Symbol.iterator` can be delegated to**, which is what makes the one-liner in
[04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md) work:

```js
const bag = { items: [1, 2, 3], *[Symbol.iterator]() { yield* this.items; } };
```

## `yield*` evaluates to the delegate's completion value

This is the half people do not know. MDN: *"`yield*` evaluates to a value: the return value
returned by the delegated iterator when it closes (when `done` is `true`)."*

```js
function* g4() {
  yield* [1, 2, 3];
  return "foo";
}

function* g5() {
  const g4ReturnValue = yield* g4();
  console.log(g4ReturnValue);   // 'foo'
  return g4ReturnValue;
}
```

So a delegated generator can hand a **result** back to its caller, separately from the
values it yielded. `[...g5()]` is still `[1, 2, 3]` — the consumer sees the values; the
delegating generator sees the return. That is the difference between the *stream* and the
*answer*, and `yield*` is the only place a generator's `return` value is easy to read
(built-in consumers discard it, [05.1](../05-generators/01-pause-and-resume.md)).

```js
function* parseHeader(tokens) { /* … */ return { version, length }; }

function* parseMessage(tokens) {
  const header = yield* parseHeader(tokens);   // consumes tokens, yields nothing useful
  yield* parseBody(tokens, header.length);     // uses the result
}
```

## Every channel is forwarded

`yield*` does not merely relay values outward. MDN: *"The `next()`, `throw()`, and
`return()` methods of the current generator are all forwarded to the underlying iterator"*
— each `next()` calls the delegate's `next()`, `throw()` calls the delegate's `throw()`
*"with the same argument"*, and `return()` calls the delegate's `return()`.

Three things follow, and all three matter:

- **`next(value)` reaches the delegate's suspended `yield`** — the two-way channel from
  [09 · Two-way generators](../09-two-way-generators/README.md) passes straight through.
- **`throw(err)` is handled by the delegate's `try/catch`** if it has one, not the outer
  generator's. The inner generator gets first refusal.
- **`return()` closes the delegate**, so its `finally` runs — which means a `break` in a
  `for...of` over the outer generator releases resources held by the *inner* one.

```js
function* inner() {
  try { yield 1; yield 2; } finally { release(); }
}
function* outer() { yield* inner(); }

for (const x of outer()) break;    // release() runs — return() forwarded down the chain
```

**Delegation is transparent in both directions.** That is the property that makes composing
generators safe rather than merely convenient.

## `yield*` versus the alternatives

```js
for (const x of xs) yield x;   // equivalent for VALUES only
yield* xs;                     // also forwards next/throw/return and yields the completion value
```

The loop is not a drop-in replacement: it drops the delegate's return value and, more
importantly, does not forward `throw()`/`return()` to the inner iterator, so its cleanup can
be missed. **Prefer `yield*` whenever the operand is an iterable you did not create inline.**

And do not confuse either with spread:

```js
yield* xs;        // yields each value, lazily, as the consumer pulls
yield [...xs];    // yields ONE array, built eagerly, right now
```

## In async generators

`yield*` works the same way in an `async function*`, and MDN notes it accepts both async and
sync iterables there:

```js
async function* g1() { await Promise.resolve(0); yield "foo"; }
async function* g3() { yield* g1(); }
```

This is what makes the paging generator in
[07 · Paginating an API](../07-paginating-an-api/README.md) short: `yield* page.items`
delegates to a plain array while the surrounding generator does the awaiting.

## Gotchas

**Symptom:** The generator yielded a generator object instead of its values
**Cause:** `yield gen()` instead of `yield* gen()`.
**Fix:** Add the `*`.

**Symptom:** `yield* someObject` threw `TypeError: … is not iterable`
**Cause:** `yield*` needs an **iterable** — a plain object has no `Symbol.iterator`.
**Fix:** `yield* Object.values(obj)` / `Object.entries(obj)`, or make the object iterable.

**Symptom:** The delegated generator's `return` value was `undefined`
**Cause:** Reading it from the consumer instead of from the delegating generator — built-in
consumers discard the value that arrives with `done: true`.
**Fix:** `const result = yield* inner();` inside the outer generator.

**Symptom:** An error thrown into the outer generator was not caught by its `try/catch`
**Cause:** While delegating, `throw()` is forwarded to the **inner** iterator, which gets
first refusal.
**Fix:** Put the `try/catch` where you want the error handled — or around the `yield*`
itself, which catches what the delegate re-throws.

**Symptom:** Replacing `yield* inner()` with `for (const x of inner()) yield x;` broke
cleanup
**Cause:** The loop forwards values only; `throw()`/`return()` no longer reach the inner
iterator directly.
**Fix:** Use `yield*`.

**Symptom:** Delegating to the same generator object twice produced nothing the second time
**Cause:** Generator objects are one-shot ([05.1](../05-generators/01-pause-and-resume.md)).
**Fix:** Delegate to a **call** — `yield* makeGen()` — not to a stored object.

## Interview questions

**★ What is the difference between `yield` and `yield*`?**
`yield x` emits `x` as a single value. `yield* xs` delegates to an iterable: it emits each
of its values, forwards `next`, `throw` and `return` to it, and evaluates to the delegate's
completion value.

**★ What does a `yield*` expression evaluate to?**
The return value of the delegated iterator — MDN: *"the return value returned by the
delegated iterator when it closes (when `done` is `true`)"*. The consumer never sees it;
the delegating generator does.

**★ Is `yield* xs` the same as `for (const x of xs) yield x;`?**
Not quite. The loop relays values but discards the completion value and does not forward
`throw()`/`return()` to the inner iterator, so the delegate's cleanup can be skipped.

**★ What can you delegate to?**
Any iterable — another generator, an array, a string, `arguments`, a `Set`, a `Map`. In an
async generator, also async iterables.

**If you `break` out of a loop over a generator that is delegating, does the inner
generator's `finally` run?**
Yes. `return()` is forwarded down the delegation chain, so each delegate is closed and its
`finally` runs.

---

[Topic index](./README.md) · Next → [Composing generators](./02-composing-generators.md)
