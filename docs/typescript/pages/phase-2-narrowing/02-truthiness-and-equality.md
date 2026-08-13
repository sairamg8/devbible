---
title: "Truthiness and equality narrowing"
sidebar_label: "02 · Truthiness and equality"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Narrowed types revealed by
> assignment to `1`; `sandbox/ts-p2/ex1-narrowing-basics.sh`.

**The most-used narrowing in any codebase, and the one that hides a bug the
compiler is structurally unable to report.**

## Equality narrowing

Comparing against a literal removes everything else:

```ts
declare const s: string | undefined;
declare const n: number | undefined;

if (n !== undefined) { const r: 1 = n; }   // number
```

```console
src-ex1/falsy.ts(5,30): error TS2322: Type 'number' is not assignable to type '1'.
```

It works with any literal, which is what makes discriminated unions work
([05](./05-discriminated-unions.md)):

```ts
if (status === 'pending') { … }    // narrows a literal union
if (result.ok === true)   { … }    // narrows by discriminant
```

And it narrows **both** operands when they are both unions:

```ts
function f(a: string | number, b: string | boolean) {
  if (a === b) {
    a;   // string — the only type both could be
    b;   // string
  }
}
```

## `!= null` catches both nullish values

```ts
if (v != null) { … }   // removes null AND undefined
```

Loose `!=` is normally avoided, and this is the one place it is exactly right:
`!= null` is true for everything except `null` and `undefined`. Writing
`!== null && !== undefined` is the same check, spelled longer.

## Truthiness, and the bug it hides

```ts
if (v) { const r: 1 = v; }        // string | number | string[]
if (v != null) { const r: 1 = v; } // string | number | string[]
```

```console
src-ex1/reveal.ts(6,37): error TS2322: Type 'string | number | string[]' is not assignable to type '1'.
src-ex1/reveal.ts(7,37): error TS2322: Type 'string | number | string[]' is not assignable to type '1'.
```

**Identical types.** Both remove `null` and `undefined` from the union, and
neither can express "and also not `''`, and also not `0`" — because `''` is still
a `string` and `0` is still a `number`.

At runtime they differ badly:

```ts
function greet(name: string | undefined) {
  if (name) return `Hi ${name}`;
  return 'Hi stranger';
}
greet('');        // "Hi stranger"

function retry(count: number | undefined) {
  if (count) return count;
  return 3;                        // a deliberate 0 becomes 3
}
retry(0);         // 3
```

Both compile clean under `strict`. **The type system cannot help here**, which is
why the rule has to be a habit:

| Value type | Use |
|---|---|
| `string`, `number`, `boolean` (possibly nullish) | `!= null` |
| Object, array, function (possibly nullish) | `if (v)` is fine |
| Optional boolean | `if (flag === true)` or `flag ?? false` |

The `??` operator is the expression-level version of the same distinction —
`??` falls back only on nullish, `||` on every falsy value
([Phase 1 · null and undefined](../phase-1-type-vocabulary/10-null-and-undefined.md)).

## The falsy list

Eight values are falsy in JavaScript: `false`, `0`, `-0`, `0n`, `''`, `null`,
`undefined`, `NaN`. **Everything else is truthy** — including `[]`, `{}`, `'0'`
and `'false'`, which is a second common bug:

```ts
if (items) { … }           // an empty array takes this branch
if (items.length) { … }    // what you meant — but 0 is falsy, so this reads oddly
if (items.length > 0) { … } // what you should write
```

## Narrowing a discriminant with `===`

```ts
type State =
  | { status: 'loading' }
  | { status: 'ready'; data: string[] }
  | { status: 'error'; message: string };

function render(s: State) {
  if (s.status === 'ready') return s.data.join(', ');
  if (s.status === 'error') return s.message;
  return 'Loading…';
}
```

Equality on a literal-typed property is the whole mechanism behind discriminated
unions — no type guard function, no `in`, no `instanceof`.

## `switch` narrows too

```ts
switch (s.status) {
  case 'ready':   return s.data.join(', ');
  case 'error':   return s.message;
  case 'loading': return 'Loading…';
}
```

Each `case` narrows within its block, and with every case handled the value after
the switch is `never` — the basis of exhaustiveness checking
([06](./06-exhaustiveness.md)).

## Trade-off

**Truthiness** is short, idiomatic JavaScript and correct for objects. For
primitives it silently conflates "absent" with "empty" or "zero", and no
compiler flag can catch it because the resulting types are the same.

**`!= null`** is two characters longer and always means what it says. The cost is
that it looks like the loose-equality bug everyone is trained to flag in review.

## Gotchas

**Symptom:** An empty string was treated as missing
**Cause:** `if (value)` excludes `''`.
**Fix:** `value != null`. Turn on `strict-boolean-expressions` so it is not a
matter of memory.

**Symptom:** A legitimate `0` was replaced by a default
**Cause:** Truthiness, or `||` instead of `??`.
**Fix:** `!= null` and `??`.

**Symptom:** `if (arr)` was true for an empty array
**Cause:** `[]` is truthy — only the eight falsy values are not.
**Fix:** `arr.length > 0`.

**Symptom:** A `boolean | undefined` behaves oddly in a condition
**Cause:** `if (flag)` cannot distinguish `false` from `undefined`.
**Fix:** `flag === true`, or default it with `flag ?? false`.

**Symptom:** `NaN` passed a truthiness check you expected it to fail
**Cause:** It does fail — but `NaN !== NaN`, so equality checks against it never
work.
**Fix:** `Number.isNaN(x)`.

## Interview questions

**★ Why is `if (value)` unsafe for a `string | undefined`?**
It excludes every falsy value, so `''` takes the else branch and is treated as
missing. The narrowed type is `string` either way — measured as identical to
`!= null` — so the compiler has nothing to report. Use `!= null` for primitives.

**★ When is loose `!=` the right operator?**
`x != null` is the idiomatic check for "neither `null` nor `undefined`". It is
the one legitimate use of loose equality, and it is exactly equivalent to
`x !== null && x !== undefined`.

**★ How does equality narrowing power discriminated unions?**
Comparing a literal-typed property with `===` (or `switch`) removes every union
member whose literal does not match, leaving one branch fully typed. No guard
function or `instanceof` is involved — it is the same equality narrowing applied
to a property.

**Which values are falsy, and which surprise people?**
`false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`. The surprises are the
other way round: `[]`, `{}`, `'0'` and `'false'` are all truthy, so `if (arr)` is
true for an empty array.

**What is the expression-level version of this distinction?**
`??` versus `||`. `??` falls back only on `null`/`undefined`; `||` falls back on
every falsy value, which is the same bug in a different syntax.

---

← Prev: [`typeof` narrowing](./01-typeof-narrowing.md) · Next → [The `in` operator](./03-in-operator-narrowing.md)
