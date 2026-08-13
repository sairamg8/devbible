---
title: "Literal types and `as const`"
sidebar_label: "02 · Literal types and as const"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Inferred types below were emitted as
> declarations by `sandbox/ts-p1/ex1-inference-widening.sh`.

**A literal type is a type with exactly one value in it.** `'pending'` is a type;
so is `42` and `true`. They are what make a union like
`'pending' | 'shipped'` possible, and `as const` is how you stop the compiler
throwing them away.

## The type that holds one value

```ts
let status: 'pending' = 'pending';
status = 'shipped';   // error TS2322: Type '"shipped"' is not assignable to type '"pending"'
```

Useless alone — valuable in a union:

```ts
type Status = 'pending' | 'shipped' | 'cancelled';

function label(s: Status) {
  return s === 'pending' ? 'Awaiting dispatch' : 'On its way';
}

label('shipped');   // fine
label('shiped');    // error: not assignable to parameter of type 'Status'
```

This is the single most useful modelling tool in the language. A typo is a
compile error, the editor autocompletes the three valid values, and narrowing
works on them ([Phase 2](../../syllabus/01-type-system.md)).

## Widening, and why your literal disappears

```ts
const constCity = 'Hyderabad';   // "Hyderabad"
let mutableCity = 'Hyderabad';   // string
```

Measured from the emitted declarations:

```console
export declare let mutableCity: string;
export declare const constCity = "Hyderabad";
```

A `let` can be reassigned, so the literal widens to `string`. So does an object
property, because properties are mutable:

```console
export declare const rates: {
    standard: number;
    express: number;
};
```

`120` became `number`. That is what breaks this:

```ts
type Method = 'standard' | 'express';
const config = { method: 'standard' };
send(config.method);   // error: Argument of type 'string' is not assignable to parameter of type 'Method'
```

Nothing is wrong with the value. The *type* was widened on the way in.

## `as const`

```ts
const frozen = { standard: 120, express: 260 } as const;
```

```console
export declare const frozen: {
    readonly standard: 120;
    readonly express: 260;
};
```

Two effects, both from one keyword:

1. Every property becomes `readonly`.
2. Every literal keeps its literal type.

And on arrays:

```ts
const tupleish = [1, 'two'] as const;   // readonly [1, 'two']
const loose = [1, 'two'];               // (string | number)[]
```

`as const` turns an array literal into a **readonly tuple** — length and
positions preserved ([03 · Arrays and tuples](./03-arrays-and-tuples.md)).

## The pattern this unlocks: one source of truth

Instead of writing a union *and* a runtime list and keeping them in step:

```ts
const STATUSES = ['pending', 'shipped', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];   // 'pending' | 'shipped' | 'cancelled'

for (const s of STATUSES) { /* runtime iteration */ }
function set(s: Status) { /* compile-time checking */ }
```

`typeof STATUSES` lifts the value into the type world; `[number]` indexes the
tuple with every numeric index, producing the union of its elements. **Add a
status to the array and the type updates itself.**

The object form is the `enum` replacement
([Phase 0 · Strip-only mode](../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)):

```ts
const Status = { Pending: 'pending', Shipped: 'shipped' } as const;
type Status = (typeof Status)[keyof typeof Status];   // 'pending' | 'shipped'
```

Both erase completely, and both keep one list that the type is derived from
rather than duplicated from.

## `as const` is not `as`

They share a keyword and share nothing else.

| | What it does | Can it lie? |
|---|---|---|
| `x as T` | Asserts `x` is a `T`; silences the checker | **Yes** — that is its purpose |
| `x as const` | Asks for the narrowest inference of a literal expression | No — it only narrows what is already there |

`as const` is safe. `as T` is a claim you now own
([Phase 2](../../syllabus/01-type-system.md)).

## Where `as const` cannot go

```ts
const n = Math.random() as const;   // error: 'const' assertions can only be applied to
                                    // references to enum members, or string, number,
                                    // boolean, array, or object literals
```

It applies to **literal expressions only**. For a computed value that must match
a type without widening, the tool is `satisfies`:

```ts
const config = {
  retries: 3,
  mode: 'fast',
} satisfies { retries: number; mode: 'fast' | 'slow' };

config.mode;   // 'fast' — literal preserved AND the shape checked
```

`satisfies` checks against a type *without* replacing the inferred one — the
annotation form `const config: {…}` would widen `mode` back to
`'fast' | 'slow'`. Full treatment in Phase 2.

## Trade-off

**`as const` everywhere** gives maximum precision and immutable-by-default data.
It costs mutability you sometimes want — a `readonly` array cannot be `push`ed,
sorted in place, or passed where a mutable `T[]` is expected, and the resulting
error (`readonly number[]` is not assignable to `number[]`) confuses people.

**Skipping it** keeps things flexible and loses the literal types that make
unions work.

Rule of thumb: **`as const` on data that describes options, routes, statuses or
config; leave working data alone.**

## Gotchas

**Symptom:** `Type 'string' is not assignable to type '"a" | "b"'` from an object
property
**Cause:** Object properties widen; the literal type was lost at the declaration.
**Fix:** `as const` on the object literal, or `satisfies` the target type.

**Symptom:** `The type 'readonly [1, 2]' is 'readonly' and cannot be assigned to
the mutable type 'number[]'`
**Cause:** `as const` made it readonly; the consumer wants mutable.
**Fix:** Widen the *parameter* to `readonly number[]` — the better fix, since the
function probably does not mutate — or copy with `[...xs]`.

**Symptom:** `'const' assertions can only be applied to … literals`
**Cause:** Applied to a computed expression.
**Fix:** `satisfies`, or annotate the target type explicitly.

**Symptom:** A union type and a runtime array of the same values drift apart
**Cause:** They were written twice.
**Fix:** Derive one from the other: `type S = (typeof LIST)[number]`.

**Symptom:** `as const` did not narrow a nested property
**Cause:** It did — check whether something downstream (a `let`, a spread into a
mutable object, a function parameter) widened it again.
**Fix:** Keep the `as const` value flowing into `readonly` positions.

## Interview questions

**★ What is a literal type and why does it matter?**
A type inhabited by exactly one value — `'pending'`, `42`, `true`. On its own it
is a curiosity; in a union it is the main modelling tool in the language, giving
autocompletion, typo errors, and narrowing on the discriminant.

**★ What does `as const` do?**
Two things to a literal expression: makes every property `readonly`, and stops
literal widening so `120` stays `120` rather than becoming `number`. On an array
literal it produces a readonly tuple.

**★ How do you keep a runtime list and a union type in sync?**
Write the list once with `as const` and derive the type:
`const STATUSES = [...] as const; type Status = (typeof STATUSES)[number]`.
Adding an entry updates the type automatically — no second declaration to forget.

**What is the difference between `as const` and `as T`?**
`as const` asks for the narrowest inference of something already written and
cannot lie. `as T` asserts a type the compiler cannot verify and silences it —
the escape hatch, and a claim you become responsible for.

**When would you use `satisfies` instead of `as const`?**
When the value must be *checked against* a type but keep its precise inferred
type — a config object that has to match a schema while still remembering that
`mode` is exactly `'fast'`. An annotation would widen it; `as const` alone would
not check it.

---

← Prev: [Primitives and inference](./01-primitives-and-inference.md) · Next → [Arrays and tuples](./03-arrays-and-tuples.md)
