---
title: "04.1 · Choosing a method"
sidebar_label: "01 · Choosing a method"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find), [`every`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every), [`map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [`filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter). Documentation-validated.

**Eight methods, one question: what do you want back?** Every one of them walks the
array and calls your function; they differ only in what they return and whether they
stop early.

| Method | Returns | Stops early? |
|---|---|---|
| `forEach` | **`undefined`** — always | ❌ never |
| `map` | a **new array**, same length | ❌ |
| `filter` | a **new array**, ≤ length | ❌ |
| `find` | the **first matching element**, or `undefined` | ✅ on match |
| `findIndex` | the **index** of the first match, or **`-1`** | ✅ on match |
| `findLast` / `findLastIndex` | same, searching **from the end** | ✅ |
| `some` | **`true`** if any element matches | ✅ on first `true` |
| `every` | **`true`** if all match | ✅ on first `false` |

Pick by the row that matches your sentence: *"I want each of these"* → `forEach`.
*"I want these transformed"* → `map`. *"I want the ones that…"* → `filter`. *"I want
the one that…"* → `find`. *"I want to know whether…"* → `some`/`every`.

## `forEach` returns `undefined` and cannot be stopped

MDN: *"`forEach()` always returns `undefined` and is not chainable."*

And the limitation that decides when not to use it:

> "There is **no way to stop or break a `forEach()` loop** other than by throwing an
> exception. If you need such behavior, the `forEach()` method is the wrong tool."

MDN names the alternatives itself: `for`, `for...of`, `for...in`, or
`every()`/`some()`/`find()`/`findIndex()`.

That is the practical decision. If you need to stop, `forEach` is out:

```js
// ❌ cannot stop
users.forEach((u) => { if (u.id === id) { found = u; /* still iterating */ } });

// ✅ stops at the match
const found = users.find((u) => u.id === id);

// ✅ when you genuinely need a loop body with break/continue/await
for (const u of users) {
  if (u.id === id) break;
}
```

**`for...of` is the underrated answer.** `break`, `continue`, `return` and `await` all
work inside it, and none of them work inside `forEach`. Reach for it whenever the body
is doing control flow rather than a transformation.

## `map` is not a loop

The most common misuse in real codebases:

```js
// ❌ map used for side effects — builds an array of undefined and throws it away
items.map((item) => console.log(item));

// ✅
items.forEach((item) => console.log(item));
for (const item of items) console.log(item);
```

`map` allocates a new array the same length as the input and fills it with your
callback's return values. If you ignore the result, you have allocated an array of
`undefined` for nothing — and, more importantly, you have written something that reads
as a transformation when it is not.

The reverse mistake is just as common:

```js
// ❌ forEach + push — a hand-rolled map
const names = [];
users.forEach((u) => names.push(u.name));

// ✅
const names = users.map((u) => u.name);
```

## `find` versus `filter`

```js
// ❌ builds a whole array to take one element
const user = users.filter((u) => u.id === id)[0];

// ✅ stops at the first match
const user = users.find((u) => u.id === id);
```

`filter` visits **every** element and allocates an array; `find` stops at the first
match. On a large array where the match is early, that is the difference between one
comparison and thousands. It also reads as what you meant.

**The distinction people trip on:** `find` returns `undefined` when nothing matches,
`findIndex` returns **`-1`**. So:

```js
const i = users.findIndex((u) => u.id === id);
if (i !== -1) { /* … */ }        // ✅
if (i) { /* … */ }               // ❌ index 0 is falsy, and -1 is truthy
```

Both mistakes in one line: a valid index of `0` fails the check, and a *missing*
result at `-1` passes it. Always compare against `-1` explicitly.

`findLast` and `findLastIndex` are the same searching backwards — useful for "the most
recent entry matching…" without reversing the array first.

## `some` and `every`, and the empty array

Both short-circuit. MDN on `every`: *"It calls a provided `callbackFn` function once
for each element in an array, until the `callbackFn` returns a falsy value. If such an
element is found, `every()` immediately returns `false` and stops iterating."* `some`
is the mirror image, stopping on the first truthy result.

🔴 **On an empty array, `every` returns `true`.** MDN:

> "`every` acts like the "for all" quantifier in mathematics. In particular, for an
> empty array, it returns `true`. (It is vacuously true that all elements of the empty
> set satisfy any given condition.)"

And `some` on an empty array returns `false`, for the mirror reason — there is no
element that satisfies the condition.

This is not a curiosity; it is a real validation bug:

```js
// ⚠️ an empty cart passes
const canCheckout = cart.every((item) => item.inStock);

// ✅ say what you mean
const canCheckout = cart.length > 0 && cart.every((item) => item.inStock);
```

Any `every` used as a gate needs a non-empty check beside it, unless "no items" really
should pass.

## `some` as a readable `break`

```js
// stop as soon as a condition is met, with a boolean answer
const hasAdmin = users.some((u) => u.role === "admin");

// and as an early-exit loop, when you do not need the boolean
users.some((u) => {
  process(u);
  return u.isLast;   // returning true stops the iteration
});
```

The second form works, and you will meet it — but it is a `for...of` with a `break`
written in disguise. Prefer the real loop when the intent is control flow; keep `some`
for when you want the boolean.

## Chaining, and its cost

```js
const names = users
  .filter((u) => u.active)
  .map((u) => u.name)
  .slice(0, 10);
```

Each step allocates a new array and walks it fully. For a hundred users this is
irrelevant and the readability wins outright. For a very large array in a hot path,
each `.filter().map()` pair is two passes and two allocations where one loop — or a
`reduce`, or a lazy iterator-helper pipeline — would do one.

**Write the chain first.** It is clearer, and clarity is worth more than a pass over an
array almost every time. Optimise only where a profile says so — this corpus builds no
benchmarks, so treat "chaining is slow" as a shape to be aware of, not a measured
claim.

## Gotchas

**Symptom:** `break` does not work inside `forEach`
**Cause:** MDN: *"There is no way to stop or break a `forEach()` loop other than by
throwing an exception."*
**Fix:** `for...of` with `break`, or `find`/`findIndex`/`some`/`every` if you want the
result those give.

**Symptom:** `const x = items.map(…)` where the result is never used
**Cause:** `map` allocates a new array of the callback's return values. Used for side
effects it builds an array of `undefined`.
**Fix:** `forEach` or `for...of`.

**Symptom:** An empty array passes a validation built on `every`
**Cause:** MDN: *"for an empty array, it returns `true`"* — vacuous truth.
**Fix:** `arr.length > 0 && arr.every(…)`.

**Symptom:** `if (findIndex(...))` behaves backwards
**Cause:** `findIndex` returns `-1` for no match, which is **truthy**, and `0` for a
match at the start, which is **falsy**.
**Fix:** `if (i !== -1)`, always.

**Symptom:** `filter(...)[0]` is slow on a large array
**Cause:** `filter` visits every element and allocates an array; you wanted the first
match.
**Fix:** `find`, which stops at the first match.

**Symptom:** `forEach` used to build an array with `push`
**Cause:** A hand-rolled `map`.
**Fix:** `map` — shorter, and it says what it does.

## Interview questions

**★ What does `forEach` return, and can you break out of it?**
It always returns `undefined` and is not chainable, and MDN is explicit that there is
**no way to break** other than throwing. If you need early exit, MDN names the
alternatives itself: `for`/`for...of`, or `every`/`some`/`find`/`findIndex`.

**★ Difference between `find` and `filter`?**
`find` returns the **first matching element** and **stops there**; `filter` returns a
**new array of all matches** after visiting every element. `filter(...)[0]` is the
common misuse — it allocates an array and does the full pass to get one item.

**★ What does `every` return for an empty array?**
**`true`** — MDN calls it vacuously true, the "for all" quantifier over an empty set.
`some` returns `false` for the mirror reason. This makes `cart.every(inStock)` pass for
an empty cart, so a gate built on `every` usually needs `length > 0 &&` beside it.

**★ Why is `if (arr.findIndex(f))` a bug?**
Because `findIndex` returns `-1` when nothing matches — which is **truthy** — and `0`
for a match at the first position — which is **falsy**. Both cases are inverted.
Compare against `-1` explicitly.

**When would you use `for...of` instead of an array method?**
When the body needs control flow the methods cannot express: `break`, `continue`,
`return` from the enclosing function, or `await` between iterations. `forEach` supports
none of those.

**Is `some` a reasonable way to break out of a loop?**
It works — returning `true` stops the iteration — but it is a `for...of` with `break`
in disguise. Use `some` when you want the **boolean**; use the loop when you want the
control flow.

---

[Topic index](./README.md) · Next → [Callbacks, holes and async](./02-callbacks-holes-and-async.md)
