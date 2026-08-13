---
title: "05 · Loops"
sidebar_label: "05 · Loops"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex3-control-flow.mjs`.

**Six looping constructs, and the choice is usually decided by two questions:
can you `break`, and can you `await`?** `forEach` answers no to both, which is
why it is the wrong default despite being the most typed.

## Measured

```
--- loops: which support break / await ---
  for..of break works: [ 1 ]
  forEach "return" only skips: [ 1, 3 ]

--- for..in walks the prototype chain ---
  for..in keys: [ 'own', 'inherited' ]
  Object.keys : [ 'own' ]
  for..in on array gives STRING indices: [ 'string:0', 'string:1' ]

--- labelled break ---
  visit 1,1
  visit 2,1
```

## The decision table

| Construct | Iterates | `break` | `await` | Index | Notes |
|---|---|---|---|---|---|
| `for (;;)` | anything | ✅ | ✅ | ✅ | full control; verbose |
| **`for…of`** | **iterables** | ✅ | ✅ | via `entries()` | **the default** |
| `for…in` | **enumerable string keys, inherited too** | ✅ | ✅ | key only | almost never what you want |
| `forEach` | arrays | ❌ | ❌ | ✅ | cannot exit early |
| `while` / `do…while` | condition | ✅ | ✅ | manual | unknown iteration count |
| `for await…of` | async iterables | ✅ | ✅ | — | Phase 6 |

**Default to `for…of`.** It reads well, works on every iterable (arrays, strings,
`Map`, `Set`, generators, `NodeList`), supports `break`/`continue`/`return`, and
`await` behaves correctly inside it.

## `forEach` cannot break, and cannot await

```
  for..of break works: [ 1 ]
  forEach "return" only skips: [ 1, 3 ]
```

`return` inside a `forEach` callback returns from **the callback**, not the loop.
Measured: it skipped `2` and kept going, producing `[1, 3]` where `break` gave
`[1]`.

There is no way to stop a `forEach` early. `some`/`every` are the escape hatches:

```js
items.some(item => {
  if (item.sku === target) { found = item; return true; }   // true stops it
  return false;
});
```

The `await` problem is worse because it is silent:

```js
// ❌ Does NOT wait. The loop finishes instantly; the promises float unhandled.
cart.items.forEach(async (item) => {
  await reserveStock(item);
});
console.log('done');   // prints BEFORE any reservation completes

// ✅ Sequential
for (const item of cart.items) {
  await reserveStock(item);
}

// ✅ Parallel, when order does not matter
await Promise.all(cart.items.map(item => reserveStock(item)));
```

`forEach` ignores the returned promise entirely. Nothing throws, nothing warns,
and the bug shows up as a race much later. This is the single most common async
mistake in application code, and Phase 7 returns to it.

Use `forEach` only for a genuinely fire-and-forget synchronous side effect over a
whole array. Otherwise `for…of` or `map`.

## `for…in` is not for arrays

```
  for..in keys: [ 'own', 'inherited' ]
  Object.keys : [ 'own' ]
  for..in on array gives STRING indices: [ 'string:0', 'string:1' ]
```

Two measured problems:

1. **It walks the prototype chain.** `for…in` returned an inherited key that
   `Object.keys` did not. Any object created with `Object.create(base)`, or any
   library that extends a prototype, leaks keys into your loop. The historic fix
   was an `Object.hasOwn` guard inside every loop body.
2. **Array indices arrive as strings.** `typeof i` is `'string'`, so `i + 1` is
   `'01'` rather than `1`.

It also gives no order guarantee for integer-like keys beyond the standard
property-order rules.

**Use `Object.keys`/`values`/`entries` for objects and `for…of` for arrays.**
`for…in` is a legacy construct; the only defensible modern use is deliberately
inspecting inherited properties.

## Getting the index in `for…of`

```js
for (const [i, item] of cart.items.entries()) {
  console.log(i, item.sku);
}
```

`entries()` is the idiomatic answer, and it works on `Map` and `Set` too.

## The classic `var` loop bug

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));   // 3 3 3
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i));   // 0 1 2
```

`var` is function-scoped, so all three closures capture the **same** binding,
which is `3` by the time the timers run. `let` creates a **fresh binding per
iteration**, which is what makes the second version work — a special rule the
spec added precisely for this.

`for…of` and `for…in` also create a new binding per iteration, which is why
`const` is legal and correct there.

Full treatment in Phase 3, but this is where you first meet it.

## `while` and `do…while`

```js
let cursor = null;
do {
  const page = await fetchPage(cursor);
  process(page.items);
  cursor = page.nextCursor;
} while (cursor);
```

`do…while` runs the body at least once — exactly right for cursor pagination,
where you must fetch before you know whether more exists. This is the
keyset-pagination loop Phase 18 uses.

## Performance, briefly

For a plain array the classic `for (let i = 0; …)` is marginally the fastest, and
in almost every real application the difference is irrelevant next to what is
inside the loop. Write for readability; measure before optimising, and remember
[Phase 0 · 11](../phase-0-how-javascript-runs/the-jit) on why loop
micro-benchmarks mislead.

The one case that is *not* micro: `arr.shift()` in a loop is O(n²) because every
element reindexes. Iterate forward, or use an index pointer.

## Gotchas

**Symptom:** `await` inside a loop did not wait.
**Cause:** it was a `forEach` callback; `forEach` discards the returned promise.
**Fix:** `for…of` for sequential, `Promise.all(map(...))` for parallel.

**Symptom:** `break` in a `forEach` is a `SyntaxError`, and `return` does not
stop it.
**Cause:** the callback is a function, not a loop body — measured `[1, 3]`.
**Fix:** `for…of`, or `some`/`every`.

**Symptom:** an extra key appeared while iterating an object.
**Cause:** `for…in` includes inherited enumerable properties — measured.
**Fix:** `Object.keys`, or guard with `Object.hasOwn`.

**Symptom:** array indices behave like strings.
**Cause:** `for…in` yields string keys — measured `typeof i === 'string'`.
**Fix:** `for…of`, with `.entries()` if you need the index.

**Symptom:** every timer in a loop logs the final value.
**Cause:** `var` gives one shared binding for all iterations.
**Fix:** `let`, which creates a fresh binding per iteration.

**Symptom:** processing a large array with `shift()` is quadratic.
**Cause:** `shift` reindexes the whole array each call.
**Fix:** iterate with an index, or `pop()` from a reversed copy.

## Interview questions

**★ Why can't you `break` out of `forEach`?**
Because the callback is an ordinary function, not a loop body — `return` exits
the callback and iteration continues. Measured, the callback's `return` produced
`[1, 3]` where a `for…of` `break` produced `[1]`. Use `for…of`, or `some`/`every`
where returning `true` stops iteration.

**★ What happens when you `await` inside `forEach`?**
Nothing waits. `forEach` ignores the promise the async callback returns, so the
loop completes immediately and the operations run unsupervised — no error, no
warning, just a race. Use `for…of` for sequential work or
`Promise.all(items.map(...))` for parallel.

**★ Why should you not use `for…in` on an array?**
Two measured reasons: it walks the prototype chain and yields inherited
enumerable keys, and array indices come out as **strings**, so arithmetic on the
index silently concatenates. Use `for…of`, with `.entries()` for the index.

**Why does `let` fix the classic loop-closure bug?**
`var` is function-scoped, so every closure captures one shared binding that holds
the final value. `let` creates a **fresh binding for each iteration** — a rule the
spec added specifically for `for` loops — so each closure captures its own value.

**When is `do…while` the right choice?**
When the body must run at least once before the condition can be evaluated —
cursor-based pagination is the canonical case: you have to fetch a page before
you know whether a next cursor exists.

---

← [04 · Optional chaining](./04-optional-chaining.md) · [Phase index](./) · Next: [06 · Spread and rest](./06-spread-and-rest.md) →
