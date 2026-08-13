---
title: "Primitives and inference"
sidebar_label: "01 · Primitives and inference"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Every inferred type below was read
> out of an emitted `.d.ts` (`tsc --declaration --emitDeclarationOnly`), not from
> an editor tooltip — `sandbox/ts-p1/ex1-inference-widening.sh`.

**Most types in a TypeScript codebase are written by nobody. The compiler infers
them, and it infers *differently* depending on whether you wrote `let` or
`const`.** Knowing what it produces is what lets you annotate the few places that
need it and leave the rest alone.

## Reading an inferred type honestly

A hover tooltip is easy to misread. Emitting declarations is not:

```ts
// src-ex1/infer.ts
export let mutableCity = 'Hyderabad';
export const constCity = 'Hyderabad';

export const rates = { standard: 120, express: 260 };
export const frozen = { standard: 120, express: 260 } as const;

export const mixed = [1, 'two', true];
export const tupleish = [1, 'two'] as const;

export const nested = { a: { b: [1, 2] } };

export function quote(weight: number, express = false) {
  return express ? weight * 260 : weight * 120;
}

export const maybe = Math.random() > 0.5 ? 'yes' : null;

export function first<T>(items: T[]) {
  return items[0];
}
```

```console
$ tsc --declaration --emitDeclarationOnly --strict --outDir out-ex1 src-ex1/infer.ts
$ cat out-ex1/infer.d.ts
export declare let mutableCity: string;
export declare const constCity = "Hyderabad";
export declare const rates: {
    standard: number;
    express: number;
};
export declare const frozen: {
    readonly standard: 120;
    readonly express: 260;
};
export declare const mixed: (string | number | boolean)[];
export declare const tupleish: readonly [1, 'two'];
export declare const nested: {
    a: {
        b: number[];
    };
};
export declare function quote(weight: number, express?: boolean): number;
export declare const maybe: string | null;
export declare function first<T>(items: T[]): T;
```

Everything worth knowing about inference is in that output.

## Widening: `let` vs `const`

```ts
let mutableCity = 'Hyderabad';    // string
const constCity = 'Hyderabad';    // "Hyderabad"
```

A `let` can be reassigned, so the compiler **widens** the literal `"Hyderabad"`
to `string`. A `const` cannot, so the literal type survives. This is not a
stylistic difference — it decides whether a value can be a member of a union:

```ts
type City = 'Hyderabad' | 'Chennai';

const ok: City = constCity;      // fine — the type is "Hyderabad"
const no: City = mutableCity;    // error: Type 'string' is not assignable to type 'City'
```

**The most common consequence:** a config object built with `let`, or an object
property (which is mutable by default), loses its literal type and stops fitting
the union it was written for. `as const` is the fix
([02 · Literal types](./02-literal-types-and-as-const.md)).

## Objects widen their properties too

```ts
const rates = { standard: 120, express: 260 };
//    { standard: number; express: number }
```

`rates.standard` is mutable, so `120` widens to `number` even though the whole
thing is `const`. `const` protects the *binding*, never the contents.

With `as const`, every property becomes `readonly` and keeps its literal type:

```ts
const frozen = { standard: 120, express: 260 } as const;
//    { readonly standard: 120; readonly express: 260 }
```

## Arrays widen to unions, not tuples

```ts
const mixed = [1, 'two', true];      // (string | number | boolean)[]
const tupleish = [1, 'two'] as const; // readonly [1, 'two']
```

An array literal infers **an array of the union of its elements** — length is not
tracked and positions are not remembered. If position matters, you need a tuple,
and `as const` is the cheapest way to get one
([03 · Arrays and tuples](./03-arrays-and-tuples.md)).

## Functions: parameters are not inferred, returns are

```ts
export function quote(weight: number, express = false) { … }
// quote(weight: number, express?: boolean): number
```

Three things happened:

1. **`weight` had to be annotated.** Nothing tells the compiler what a caller
   will pass, and with `noImplicitAny` an unannotated parameter is `TS7006`.
2. **`express` was inferred `boolean` from its default** — and became **optional**
   (`express?`) because a default exists.
3. **The return type was inferred `number`** from the body.

That asymmetry is the rule of thumb for the whole language: **annotate the
inputs, let the compiler compute the outputs.**

Annotating the return type anyway is a defensible discipline — it pins the
contract so an accidental change inside the body errors at the function rather
than at some distant caller. The cost is a little duplication.

## Unions appear on their own

```ts
const maybe = Math.random() > 0.5 ? 'yes' : null;   // string | null
```

The compiler unions the branches. Note `'yes'` widened to `string` here, because
the value is being inferred for a `const` *whose initialiser is not a literal
expression* — the conditional produces a widened type.

## Generic inference flows through

```ts
export function first<T>(items: T[]) { return items[0]; }
// first<T>(items: T[]): T
```

And it responds to your flags. With `noUncheckedIndexedAccess` on:

```console
$ tsc --declaration --emitDeclarationOnly --strict --noUncheckedIndexedAccess …
export declare function first<T>(items: T[]): T | undefined;
```

**The same source, a different signature**, because indexing an array might miss.
That is the flag doing exactly its job — an empty array really does return
`undefined` — and it is why the flag is worth arguing for
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## When to annotate

| Situation | Annotate? |
|---|---|
| Function parameters | **Always** — nothing else can infer them |
| Exported function return types | Usually — pins the public contract |
| Local variables with an initialiser | **No** — inference is more precise than you |
| A `const` that must match a union | Prefer `as const` or `satisfies` over an annotation |
| Empty containers (`const xs = []`) | **Yes** — otherwise `any[]`, or an evolving type |
| A value crossing a module or network edge | Yes, and validate it too (Phase 9) |

The annotation that quietly costs you precision:

```ts
const rates: Record<string, number> = { standard: 120, express: 260 };
rates.expres;   // no error — Record<string, number> allows any key
```

Writing the type threw away the compiler's knowledge that exactly `standard` and
`express` exist. Inference (or `satisfies`) keeps it.

## Trade-off

**Leaning on inference** gives shorter code that stays correct as the
implementation changes, and error messages that point at the real mismatch. It
costs explicitness — a reader must follow the initialiser to know the type.

**Annotating everything** documents intent locally and makes errors surface at
the declaration. It costs precision (as above) and creates a second thing to keep
in step with the code.

## Gotchas

**Symptom:** `Type 'string' is not assignable to type '"a" | "b"'`
**Cause:** The value came from a `let`, or from an object property, so its literal
type widened.
**Fix:** `as const` on the literal, or `satisfies` at the declaration
([02](./02-literal-types-and-as-const.md)).

**Symptom:** `Parameter 'x' implicitly has an 'any' type` (`TS7006`)
**Cause:** An unannotated parameter under `noImplicitAny`.
**Fix:** Annotate it. Contextual typing only covers callbacks passed to a typed
function.

**Symptom:** `const xs = []` then `xs.push(1)` behaves oddly
**Cause:** The empty array starts as `any[]` (an evolving array outside `strict`).
**Fix:** `const xs: number[] = []`.

**Symptom:** An object literal's property type is `number` when you wanted `120`
**Cause:** Object properties are mutable, so they widen.
**Fix:** `as const`, or annotate the property with the literal type.

**Symptom:** Return type changed after an unrelated edit inside the function
**Cause:** It was inferred from the body.
**Fix:** Annotate the return type of exported functions to pin the contract.

## Interview questions

**★ Why does `let x = 'a'` infer `string` but `const x = 'a'` infer `"a"`?**
A `let` binding can be reassigned, so the compiler widens the literal to the type
of all values it could hold. A `const` cannot be reassigned, so the literal type
is kept. It matters because only the narrow version is assignable to a
string-literal union.

**★ Does `const` make an object immutable?**
No — it fixes the binding, not the contents. `const rates = { standard: 120 }`
infers `{ standard: number }` and `rates.standard = 130` is legal. `as const`
makes the properties `readonly` and keeps their literal types.

**★ Where should you annotate rather than rely on inference?**
Function parameters (nothing can infer them), exported return types (to pin the
contract), and empty containers. Inside a function, inference is usually more
precise — annotating `Record<string, number>` over an object literal actively
discards the knowledge of which keys exist.

**How can you see what the compiler actually inferred, without trusting a tooltip?**
Emit declarations: `tsc --declaration --emitDeclarationOnly` writes the inferred
types into a `.d.ts` you can read. It is also how you check that a public API's
inferred types are what you intended.

**Why did `first<T>(items: T[])` return `T` in one build and `T | undefined` in
another?**
`noUncheckedIndexedAccess`. Indexing an array can miss, so the flag makes
`items[0]` include `undefined` — the honest signature, and the one that forces
callers to handle an empty array.

---

← [Phase 1 index](./README.md) · Next → [Literal types and `as const`](./02-literal-types-and-as-const.md)
