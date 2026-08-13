---
title: "Arrays and tuples"
sidebar_label: "03 · Arrays and tuples"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Inferred types emitted as
> declarations by `sandbox/ts-p1/ex1-inference-widening.sh`.

**An array type says what is in it. A tuple type says what is in it, in what
order, and how many.** Reaching for the second when you meant the first is what
makes destructured returns and fixed-shape records readable.

## Arrays

```ts
const skus: string[] = ['sku-1', 'sku-2'];
const counts: Array<number> = [1, 2, 3];      // identical meaning
const matrix: number[][] = [[1, 2], [3, 4]];
```

`T[]` and `Array<T>` are the same type. Prefer `T[]` for simple element types and
`Array<T>` when `T` is itself long (`Array<{ id: string; total: number }>` reads
better than the postfix form).

Inference unions the elements and forgets everything else:

```ts
const mixed = [1, 'two', true];
```

```console
export declare const mixed: (string | number | boolean)[];
```

**Length is not part of an array type.** `mixed[99]` type-checks and returns
`string | number | boolean` — the reason `noUncheckedIndexedAccess` exists
([01 · Primitives and inference](./01-primitives-and-inference.md)).

## Tuples

```ts
type Coord = [number, number];
type Entry = [key: string, value: number];      // named members, labels only
type Result = [ok: true, data: string] | [ok: false, error: Error];

const c: Coord = [12.9, 77.6];
const bad: Coord = [12.9];        // error: Source has 1 element(s) but target requires 2
```

Named members are documentation — they appear in tooltips and error messages and
change nothing at runtime.

Optional and rest elements:

```ts
type Range = [start: number, end?: number];
type Command = [name: string, ...args: string[]];

const r1: Range = [1];
const r2: Range = [1, 10];
const cmd: Command = ['copy', 'a.txt', 'b.txt'];
```

## Where tuples actually earn their place

**A returned pair whose members are different types** — the React `useState`
shape:

```ts
function useCounter(initial: number) {
  let value = initial;
  const inc = () => { value += 1; };
  return [value, inc] as const;      // readonly [number, () => void]
}

const [count, increment] = useCounter(0);
```

Without `as const`, the inferred type is `(number | (() => void))[]` and both
destructured names become that union — nothing usable. **This is the most common
real bug in custom hooks**, and the fix is one keyword
([Phase 8](../../syllabus/03-in-the-stack.md)).

`Object.entries` returns tuples for the same reason:

```ts
for (const [key, value] of Object.entries({ a: 1, b: 2 })) {
  key;    // string
  value;  // number
}
```

## `as const` produces a readonly tuple

```ts
const tupleish = [1, 'two'] as const;
```

```console
export declare const tupleish: readonly [1, 'two'];
```

Three things at once: positions preserved, literal types preserved, and the whole
thing `readonly`. That last part is what people trip over:

```ts
function sum(xs: number[]) { return xs.reduce((a, b) => a + b, 0); }
const nums = [1, 2, 3] as const;
sum(nums);   // error: The type 'readonly [1, 2, 3]' is 'readonly' and cannot be
             // assigned to the mutable type 'number[]'
```

**The right fix is to widen the parameter, not to strip the `readonly`:**

```ts
function sum(xs: readonly number[]) { … }
```

A function that does not mutate should say so. `readonly T[]` accepts both
mutable and readonly arrays, so the signature becomes strictly more useful.

## Readonly arrays

```ts
const frozen: readonly string[] = ['a', 'b'];
frozen.push('c');    // error: Property 'push' does not exist on type 'readonly string[]'
frozen[0] = 'z';     // error: Index signature in type 'readonly string[]' only permits reading
```

`readonly T[]` and `ReadonlyArray<T>` are the same type. It removes the mutating
methods from the type — it does **not** freeze anything at runtime. `Object.freeze`
is the runtime tool; these are erased like everything else.

Assignability runs one way: `T[]` → `readonly T[]` is fine, the reverse is not.

## Array vs tuple: choosing

| Use | When |
|---|---|
| `T[]` | A collection — unknown length, homogeneous, order is data not structure |
| `[A, B]` | A fixed structure whose positions mean different things |
| `readonly T[]` | A parameter you do not mutate, or shared constant data |
| An object | **Whenever there are more than two or three members** |

The last row matters. `[string, number, boolean, string]` is a struct wearing a
disguise; `{ id, total, paid, currency }` is readable at every call site. Tuples
pay off for pairs and for destructuring, and stop paying quickly after that.

## Trade-off

**Tuples** give precise positional types and clean destructuring, at the cost of
meaning encoded in position — a reader must know that index 1 is the setter.

**Objects** are self-describing and survive reordering and additions, at the cost
of verbosity at construction.

## Gotchas

**Symptom:** Destructured values from a returned array are a union of both types
**Cause:** The array literal inferred `(A | B)[]`, not a tuple.
**Fix:** `return [a, b] as const`, or annotate the return type as a tuple.

**Symptom:** `The type 'readonly [...]' is 'readonly' and cannot be assigned to
the mutable type 'T[]'`
**Cause:** `as const` made it readonly; the callee asks for mutable.
**Fix:** Change the parameter to `readonly T[]`. Copy with `[...xs]` only if the
callee genuinely mutates.

**Symptom:** `arr[10]` type-checks on a three-element array
**Cause:** Array types do not track length.
**Fix:** `noUncheckedIndexedAccess` to make indexing return `T | undefined`, or a
tuple type when the length is genuinely fixed.

**Symptom:** `Property 'push' does not exist on type 'readonly string[]'`
**Cause:** Mutating methods are absent from the readonly type.
**Fix:** Build a new array (`[...xs, item]`) or use a mutable type where mutation
is intended.

**Symptom:** `Source has 1 element(s) but target requires 2`
**Cause:** Tuple arity is checked.
**Fix:** Supply every element, or make the trailing ones optional (`[a, b?]`).

## Interview questions

**★ What is the difference between `string[]` and `[string, string]`?**
The first is a collection of unknown length; the second is a tuple of exactly two
strings, where position is part of the type. Arrays do not track length, so
`arr[99]` type-checks; tuple arity is enforced.

**★ Why does a custom hook returning `[value, setValue]` produce a useless type?**
The array literal infers `(T | ((v: T) => void))[]`, so both destructured names
get that union. `return [value, setValue] as const` makes it a
`readonly [T, (v: T) => void]` and destructuring works.

**★ What does `readonly T[]` prevent, and when should a parameter use it?**
It removes mutating methods and index assignment from the type — with no runtime
effect. Use it for any parameter you do not mutate: it accepts both mutable and
readonly arrays, so it is strictly more permissive while documenting intent.

**Why can't you pass an `as const` array to a function taking `number[]`?**
`as const` makes it `readonly`, and `readonly T[]` is not assignable to `T[]` —
that would let the callee mutate shared constant data. Widen the parameter to
`readonly number[]`.

**When would you choose an object over a tuple?**
Almost always past two or three members. Position-encoded meaning stops being
readable, and adding a field to a tuple silently changes what every index means,
while adding a property to an object breaks nothing.

---

← Prev: [Literal types and `as const`](./02-literal-types-and-as-const.md) · Next → [Object types](./04-object-types.md)
