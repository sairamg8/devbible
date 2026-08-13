---
title: "`readonly` and immutability"
sidebar_label: "14 · readonly and immutability"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Inferred readonly types emitted by
> `sandbox/ts-p1/ex1-inference-widening.sh`.

**`readonly` is a compile-time promise and nothing else.** It stops *you* writing
an assignment; it does not freeze anything, and any JavaScript that reaches the
object can still change it.

## Where it applies

```ts
type Order = {
  readonly id: string;
  total: number;
  readonly items: readonly string[];
};

const o: Order = { id: 'O-1', total: 4800, items: ['sku-1'] };

o.total = 5000;          // fine
o.id = 'O-2';            // error: Cannot assign to 'id' because it is a read-only property
o.items.push('sku-2');   // error: Property 'push' does not exist on type 'readonly string[]'
o.items = [];            // error: Cannot assign to 'items' because it is a read-only property
```

Note the two independent decisions on `items`: `readonly items` stops *replacing*
the array, and `readonly string[]` stops *mutating* it. You need both.

## Readonly arrays

```ts
const frozen: readonly string[] = ['a', 'b'];
```

`readonly T[]` and `ReadonlyArray<T>` are identical. The type simply lacks the
mutating methods — `push`, `pop`, `splice`, `sort`, `reverse` — and index
assignment. Non-mutating methods (`map`, `filter`, `slice`, `concat`) are all
present and return ordinary mutable arrays.

Assignability runs one way:

```ts
declare function sum(xs: readonly number[]): number;
declare function sortInPlace(xs: number[]): void;

const mutable = [3, 1, 2];
const ro: readonly number[] = mutable;

sum(mutable);     // fine — mutable is assignable to readonly
sum(ro);          // fine
sortInPlace(ro);  // error: 'readonly number[]' is not assignable to 'number[]'
```

**So `readonly T[]` is the better parameter type for anything that does not
mutate** — it accepts both kinds, and documents the contract. Requiring `T[]`
when you only read is an unnecessary restriction on callers.

## `as const` produces readonly

```ts
const frozen = { standard: 120, express: 260 } as const;
const tupleish = [1, 'two'] as const;
```

```console
export declare const frozen: {
    readonly standard: 120;
    readonly express: 260;
};
export declare const tupleish: readonly [1, 'two'];
```

Which is why `as const` data cannot be passed to functions taking mutable arrays
— the most common friction it causes, and the fix is to widen the parameter
([03 · Arrays and tuples](./03-arrays-and-tuples.md)).

## It is shallow

```ts
type Config = {
  readonly db: { host: string };
};

const c: Config = { db: { host: 'localhost' } };
c.db = { host: 'other' };   // error
c.db.host = 'other';        // FINE — one level down, no protection
```

`Readonly<T>` (the built-in utility) is shallow for the same reason: it maps the
top-level properties only. Deep immutability needs a recursive type, which is
possible and expensive in error messages and compile time
([Phase 5](../../syllabus/02-types-at-scale.md)).

## It disappears at runtime

```ts
const o: Order = { id: 'O-1', total: 4800, items: [] };
(o as { id: string }).id = 'O-2';       // compiles, and mutates
JSON.parse(text) as Order;              // nothing was checked or frozen
```

`readonly` is erased like every other type feature. If you need a runtime
guarantee:

```ts
const frozen = Object.freeze({ id: 'O-1' });   // throws in strict mode on write
```

`Object.freeze` is shallow too, and costs a little performance. In practice most
codebases rely on `readonly` for intent and discipline rather than freezing —
the type error catches the mistakes that actually happen, which are your own.

## `ReadonlyMap`, `ReadonlySet`

```ts
declare const cache: ReadonlyMap<string, Order>;
cache.get('O-1');      // fine
cache.set('O-2', o);   // error: Property 'set' does not exist
```

Same idea for the collection types — useful for exposing internal state from a
class without handing out mutation rights.

## Where to use it

| Use `readonly` on | Why |
|---|---|
| Parameters you do not mutate | Accepts more callers, documents intent |
| Identity fields (`id`, `createdAt`) | They should never change after construction |
| Exported constants and config | Prevents accidental edits at a distance |
| Class fields set once in the constructor | The compiler enforces "set once" |
| Everything, reflexively | **No** — it fights with builders, sorting, and ordinary local work |

## Trade-off

**`readonly` everywhere** documents intent and catches accidental mutation at
compile time, with zero runtime cost. It costs friction: `readonly` values do not
flow into APIs expecting mutable ones, and a deep-readonly type hurts error
messages and compile speed.

**`Object.freeze`** is the only real runtime guarantee, at a small performance
cost and still only one level deep.

## Gotchas

**Symptom:** `The type 'readonly T[]' is 'readonly' and cannot be assigned to the
mutable type 'T[]'`
**Cause:** An `as const` or `readonly` value passed to a mutating signature.
**Fix:** Widen the parameter to `readonly T[]` if it does not mutate; copy with
`[...xs]` if it does.

**Symptom:** A nested property changed despite `readonly`
**Cause:** It is shallow.
**Fix:** Make the inner type readonly too, or use a recursive readonly type.

**Symptom:** `readonly` was bypassed by a cast
**Cause:** It is compile-time only and `as` silences it.
**Fix:** `Object.freeze` for a runtime guarantee; ban casual `as` in review.

**Symptom:** `sort()` mutated shared data
**Cause:** `Array.prototype.sort` sorts in place, and the parameter was `T[]`.
**Fix:** `[...xs].sort()`, and type the parameter `readonly T[]` so the mistake
cannot recur.

**Symptom:** `Readonly<T>` did not protect an array property
**Cause:** It maps top-level properties; an array property becomes `readonly
items: T[]` — replacement blocked, mutation allowed.
**Fix:** Declare the property as `readonly T[]` explicitly.

## Interview questions

**★ Does `readonly` prevent mutation at runtime?**
No. It is erased with every other type feature — it only stops assignments the
compiler can see, and an `as` cast bypasses it. `Object.freeze` is the runtime
mechanism, and it is also shallow.

**★ Why should a parameter be `readonly T[]` rather than `T[]`?**
Because `T[]` is assignable to `readonly T[]` but not the reverse. Declaring
`readonly` accepts both mutable and readonly arrays, so it is strictly more
permissive for callers while documenting that the function does not mutate.

**★ What is the difference between `readonly items: T[]` and `items: readonly T[]`?**
The first stops replacing the array (`o.items = []`) but allows `o.items.push()`.
The second stops mutation but allows replacement. Both together give you neither.

**Is `Readonly<T>` deep?**
No — it maps the top-level properties only. Deep immutability requires a
recursive mapped type, which costs compile time and produces much worse error
messages, so it is worth reaching for deliberately rather than by default.

**Why can't you pass an `as const` array to a function taking `number[]`?**
`as const` makes it `readonly`, and allowing that assignment would let the callee
mutate data declared immutable. Widen the parameter, or copy the array if the
function genuinely mutates.

---

← Prev: [`enum` vs union](./13-enum-vs-union.md) · Next → [Recursive type aliases](./15-recursive-types.md)
