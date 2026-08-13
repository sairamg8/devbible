---
title: "`typeof` narrowing"
sidebar_label: "01 · typeof narrowing"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Narrowed types below were revealed
> by assigning the value to `1` and reading the compiler's error — the exact type
> the checker holds at that point. `sandbox/ts-p2/ex1-narrowing-basics.sh`.

**The compiler reads your `if` statements.** A `typeof` check does not just guard
at runtime — it changes the type inside the branch, which is what makes a union
usable at all.

## Reading the narrowed type

There is no way to print a type at runtime, so this phase uses a deliberate
error to reveal it:

```ts
declare const v: string | number | null | undefined | string[];

if (typeof v === 'string')  { const r: 1 = v; }
if (typeof v === 'number')  { const r: 1 = v; }
if (typeof v === 'object')  { const r: 1 = v; }
if (v)                      { const r: 1 = v; }
if (v != null)              { const r: 1 = v; }
if (Array.isArray(v))       { const r: 1 = v; }
```

```console
$ tsc --noEmit --strict src-ex1/reveal.ts
src-ex1/reveal.ts(3,37): error TS2322: Type 'string' is not assignable to type '1'.
src-ex1/reveal.ts(4,37): error TS2322: Type 'number' is not assignable to type '1'.
src-ex1/reveal.ts(5,37): error TS2322: Type 'string[] | null' is not assignable to type '1'.
src-ex1/reveal.ts(6,37): error TS2322: Type 'string | number | string[]' is not assignable to type '1'.
src-ex1/reveal.ts(7,37): error TS2322: Type 'string | number | string[]' is not assignable to type '1'.
src-ex1/reveal.ts(8,37): error TS2322: Type 'string[]' is not assignable to type '1'.
```

Each error names exactly what the value is inside that branch. Keep this trick —
it settles arguments about narrowing in seconds.

## The results, line by line

| Check | Narrowed to |
|---|---|
| `typeof v === 'string'` | `string` |
| `typeof v === 'number'` | `number` |
| `typeof v === 'object'` | **`string[] \| null`** |
| `if (v)` | `string \| number \| string[]` |
| `v != null` | `string \| number \| string[]` |
| `Array.isArray(v)` | `string[]` |

**Line 5 is the one to remember.** `typeof null === 'object'` is a JavaScript bug
from 1995, and TypeScript models it faithfully: an `object` check leaves `null`
in the type. The compiler is right and the code is wrong:

```ts
if (typeof v === 'object') {
  v.length;   // error: 'v' is possibly 'null'
}

if (typeof v === 'object' && v !== null) {
  v.length;   // string[]
}
```

## What `typeof` can distinguish

```ts
typeof x === 'string'     // string
typeof x === 'number'     // number
typeof x === 'bigint'     // bigint
typeof x === 'boolean'    // boolean
typeof x === 'symbol'     // symbol
typeof x === 'undefined'  // undefined
typeof x === 'function'   // any function type
typeof x === 'object'     // everything else — INCLUDING null
```

Eight results, and the last one is a bucket. It cannot tell an array from a
`Date` from a plain object from `null` — so for those you need
`Array.isArray`, `instanceof`, or a discriminant field
([05 · Discriminated unions](./05-discriminated-unions.md)).

`Array.isArray` is worth singling out: it is a **type guard built into the
standard library**, narrowing to `string[]` cleanly in the measurement above.

## The falsy trap the type system cannot show you

Compare the last two lines of the table. `if (v)` and `v != null` produced
**identical types** — `string | number | string[]`.

They are not identical at runtime. `if (v)` also skips `''` and `0`:

```ts
function greet(name: string | undefined) {
  if (name) return `Hi ${name}`;     // '' takes the else branch
  return 'Hi stranger';
}

greet('');   // "Hi stranger" — the empty string was treated as missing
```

The type inside the branch is `string` either way, so **the compiler cannot warn
you**: the type is correct and the logic is wrong. This is the single most common
narrowing bug in application code.

**The rule:** use `!= null` (or `!== undefined`) when the value is a `string`,
`number` or `boolean`; truthiness is only safe for objects and functions.

```ts
if (name != null) return `Hi ${name}`;   // '' now takes the happy path
```

`strict-boolean-expressions` in typescript-eslint enforces exactly this
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## Narrowing in the `else`

Every check narrows both ways:

```ts
function format(v: string | number) {
  if (typeof v === 'string') {
    return v.toUpperCase();   // string
  }
  return v.toFixed(2);        // number — narrowed by elimination
}
```

Early returns are the cleanest way to use this — each guard removes a member and
the remainder is narrower, without nesting.

## Where `typeof` is the wrong tool

```ts
declare const value: Date | string[];

if (typeof value === 'object') { … }   // both branches are objects — narrows nothing
```

When every member is an object, `typeof` has nothing to work with. Use
`instanceof` for classes ([04](./04-instanceof-narrowing.md)), `in` for
structural differences ([03](./03-in-operator-narrowing.md)), or add a
discriminant.

## Trade-off

**`typeof`** is free, needs no types imported, and works on the primitives that
make up most unions. Its resolution stops at `object`, and its close relative —
truthiness — silently mishandles `''`, `0` and `false`.

## Gotchas

**Symptom:** `'v' is possibly 'null'` inside a `typeof v === 'object'` check
**Cause:** `typeof null === 'object'` in JavaScript, and TypeScript models it.
**Fix:** `typeof v === 'object' && v !== null`.

**Symptom:** An empty string or `0` took the "missing" branch
**Cause:** Truthiness excludes all falsy values, and the narrowed *type* looks
identical, so no error is possible.
**Fix:** `!= null`. Enable `strict-boolean-expressions` to make it mechanical.

**Symptom:** `typeof x === 'object'` did not distinguish an array
**Cause:** Arrays, dates, plain objects and `null` all report `'object'`.
**Fix:** `Array.isArray`, `instanceof`, or a discriminant field.

**Symptom:** Narrowing works in one branch but not after the `if`
**Cause:** After the block, the type is the union again unless every other path
returned.
**Fix:** Early return, so the remainder of the function keeps the narrowed type.

**Symptom:** `typeof x === 'function'` narrowed to something unusable
**Cause:** It narrows to *a* function type, but not to a specific signature.
**Fix:** A type predicate that asserts the signature you need
([07](./07-type-guards.md)).

## Interview questions

**★ What does `typeof x === 'object'` narrow to, and why is that a problem?**
Every non-primitive **plus `null`**, because `typeof null === 'object'` in
JavaScript. Measured, a `string | number | null | undefined | string[]` narrowed
to `string[] | null`, so the next property access reports "possibly null". Always
pair it with `!== null`.

**★ Why is `if (value)` dangerous for a `string | undefined`?**
It excludes every falsy value, so `''` takes the else branch. The narrowed type
is `string` in both the truthy and the `!= null` version — measured as identical
— so the compiler cannot warn you. Use `!= null` for primitives.

**★ How can you see what a value is narrowed to?**
Assign it to an impossible type and read the error: `const r: 1 = v` reports
`Type 'string[] | null' is not assignable to type '1'`, naming the exact narrowed
type. It is the fastest way to settle a narrowing question.

**What can `typeof` not distinguish?**
Anything in the `'object'` bucket — arrays, dates, class instances, plain objects
and `null`. Use `Array.isArray`, `instanceof`, the `in` operator, or a
discriminated union.

**Does narrowing apply to the `else` branch?**
Yes — the check removes the member from the type in the negative branch too, so a
`string | number` becomes `number` in the `else` of a `typeof v === 'string'`
check. Early returns exploit this without nesting.

---

← [Phase 2 index](./README.md) · Next → [Truthiness and equality narrowing](./02-truthiness-and-equality.md)
