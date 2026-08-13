---
title: "02 · Assignment and compound assignment"
sidebar_label: "02 · Assignment"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p2/ex1-arithmetic.mjs`,
> `ex5-assign-contrast.mjs`.

**The three logical assignment operators do not just skip the value — they skip
the *write*.** That difference is invisible on a plain object and load-bearing
on anything with a setter, a proxy, or a framework watching for mutations.

## The forms

| Operator | Equivalent to | Assigns when |
|---|---|---|
| `=` | — | always |
| `+= -= *= /= %= **=` | `a = a + b` | always |
| `&&=` | `a && (a = b)` | `a` is **truthy** |
| `\|\|=` | `a \|\| (a = b)` | `a` is **falsy** |
| `??=` | `a ?? (a = b)` | `a` is **null or undefined** |
| `&= \|= ^= <<= >>= >>>=` | bitwise | always |

Note the expansion in the right-hand column: the assignment is *inside* the
short-circuit. That is the whole point.

## Measured: the write is skipped, not just the value

```js
// sandbox/js-p2/ex1-arithmetic.mjs
let writes = 0;
const tracked = { get b() { return 1; }, set b(v) { writes++; } };

tracked.b ||= 2;   // b is 1 (truthy) → no write
console.log('  ||= on truthy getter, writes =', writes);
tracked.b ??= 2;   // b is 1 (not nullish) → no write
console.log('  ??= on non-nullish, writes  =', writes);
```

```
  ||= on truthy getter, writes = 0
  ??= on non-nullish, writes  = 0
```

And the direct contrast, same object, same setter:

```
naive  obj.b = obj.b || 2  -> writes = 1
short  obj.b ||= 2          -> writes = 0
short  obj.b ??= 2          -> writes = 0
short  obj.b &&= 5 (truthy) -> writes = 1 | b = 5
frozen x||=1 (x falsy)      -> TypeError
frozen x||=1 (x truthy)     -> no throw
```

**One write versus zero.** Note the `&&=` row writes, correctly — its condition
*was* met. And the two frozen rows show the short-circuit is not a general
guard: it only avoids the throw when it actually short-circuits.

Compare the naive rewrite people reach for:

```js
obj.b = obj.b || 2;      // ALWAYS writes — the setter fires every time
obj.b ||= 2;             // writes only when obj.b is falsy
```

Where this matters concretely:

- **A setter with side effects** — validation, logging, a dirty flag. The naive
  form fires it on every call.
- **Vue/MobX-style reactivity** — a write triggers re-render even when the value
  is unchanged.
- **A `Proxy`** whose `set` trap does real work.
- **A frozen object in strict mode** — `obj.b = obj.b || 2` throws; `obj.b ||= 2`
  does not, when `b` is truthy.

## `??=` is the one you will use most

```js
function createCart(options = {}) {
  options.currency ??= 'INR';
  options.taxPct   ??= 18;
  options.discount ??= 0;      // ||= would overwrite a deliberate 0
  return options;
}
```

`??=` fills in only genuinely absent values. `||=` would replace `0`, `''` and
`false` — the same trap as `||` versus `??`
([Phase 1 · 05](../phase-1-values-and-coercion/05-null-vs-undefined.md)).

A common idiom for grouping — building a `Map` of arrays:

```js
const byCategory = {};
for (const product of products) {
  (byCategory[product.category] ??= []).push(product);
}
```

The `??=` returns the array whether it just created it or not, so the `.push`
chains directly. Before `??=` this needed three lines.

## Chained and destructuring assignment

```js
let a, b;
a = b = 5;              // right to left: b = 5, then a = (b = 5)
```

Assignment is an **expression** that evaluates to the assigned value, which is
why chaining works. It is also why `if (x = 5)` is a bug that assigns and then
tests truthiness — ESLint's `no-cond-assign` exists for exactly this.

```js
// destructuring assignment to existing bindings needs parens
let x, y;
({ x, y } = { x: 1, y: 2 });     // parens required — a bare { starts a block
[x, y] = [y, x];                  // swap, no parens needed
```

The parentheses requirement is the same statement-versus-expression rule as
`{} + []` ([Phase 1 · 08](../phase-1-values-and-coercion/08-type-coercion.md)):
a `{` at the start of a statement is a block.

## `+=` on mixed types

```js
let total = 0;
total += '5';        // '05' — a string, silently
```

`+=` inherits `+`'s overloading. One string operand turns an accumulator into a
string and every subsequent `+=` concatenates. This is the classic
`reduce` bug when the seed is `''` instead of `0`.

## Gotchas

**Symptom:** a setter or reactive watcher fires even when nothing changed.
**Cause:** `obj.x = obj.x || v` always assigns.
**Fix:** `obj.x ||= v`, which skips the write — measured as zero setter calls.

**Symptom:** a deliberate `0` or `''` in an options object was overwritten.
**Cause:** `||=` treats them as falsy.
**Fix:** `??=`.

**Symptom:** `SyntaxError` on `{ a, b } = obj`.
**Cause:** the leading `{` is parsed as a block.
**Fix:** wrap in parentheses: `({ a, b } = obj)`.

**Symptom:** an `if` condition always passes.
**Cause:** `=` instead of `==`/`===` — assignment returns the assigned value.
**Fix:** enable `no-cond-assign`. Use `===`.

**Symptom:** a running total became a string.
**Cause:** `+=` with a string operand, often a `''` reduce seed.
**Fix:** seed with `0` and convert inputs with `Number()`.

**Symptom:** `obj.x ||= v` threw on a frozen object.
**Cause:** `x` was falsy, so the write was attempted and strict mode threw.
**Fix:** the short-circuit only avoids the write when it short-circuits — it is
not a general guard against writing to a frozen object.

## Interview questions

**★ What is the difference between `a ||= b` and `a = a || b`?**
`a ||= b` performs the assignment **only** when `a` is falsy; `a = a || b`
always assigns. Measured with a tracking setter, `||=` produced zero writes on a
truthy value. It matters for setters with side effects, reactive systems, proxies
and frozen objects.

**★ When would you use `??=` over `||=`?**
Whenever `0`, `''` or `false` is a legitimate value — filling in default options,
for instance. `||=` would overwrite a deliberate `0` discount; `??=` only fills
`null` and `undefined`.

**Why does `({ x } = obj)` need parentheses?**
A statement starting with `{` is parsed as a block, not an object literal. The
parentheses force expression position. Array destructuring needs no parentheses
because `[` is unambiguous there.

**Why is `a = b = 5` legal?**
Assignment is an expression that evaluates to the assigned value, and it
associates right to left. The same property is why `if (x = 5)` silently assigns
instead of comparing.

**What is a common `+=` bug?**
Accumulating with a string. `reduce((a, b) => a + b, '')` concatenates instead of
summing, and one string field in a numeric accumulator turns the whole total into
text — `+=` inherits `+`'s overloading.

---

← [01 · Arithmetic](./01-arithmetic.md) · [Phase index](./) · Next: [03 · Logical operators](./03-logical-operators.md) →
