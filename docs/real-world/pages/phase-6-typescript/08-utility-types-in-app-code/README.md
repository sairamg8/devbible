---
title: "Utility types in app code"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the TypeScript handbook's
> [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
> reference and the declarations in `lib.es5.d.ts`, read from
> `typescript@6.0.3` — the newest TypeScript on this machine; **TypeScript is
> not installed in this checkout**, so every declaration quoted here is from
> that copy and not from a compiler this repo runs. Also the **zod 4.4.3**
> declarations in this repo (`ZodObject.pick`/`omit`, `ZodType.brand`), and the
> [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)
> and [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes)
> compiler options.
> Target: **TypeScript 7.0.2** (the phase spine), zod **4.4.3**, PostgreSQL
> **17**. Documentation-validated; **no console blocks, no timings**.

**A utility type is not a trick; it is a way of saying that one type is derived
from another and must move when it moves.** This chapter takes the ones this
app actually uses — over row types, DTOs, repository functions, the order-status
union, the sort table and the route map — and is equally interested in where
each is the *wrong* tool. Three earlier chunks made promises that land here:
`ReturnType<typeof repo>` as the repository's interface, `Omit`'s missing
constraint compared against zod's checked mask, and the argument that
`satisfies` earns its keep on tables rather than on mappers.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Derive, never re-declare](01-derive-never-redeclare.md)** | The general argument, and `ReturnType` / `Parameters` / `Awaited` over the repository functions — chapter 03's promise; where deriving is the wrong answer |
| 2 | **[`Pick`, `Omit`, `Partial`, `Required`, `Readonly`](02-pick-omit-partial-required.md)** | The five declarations verbatim; each one's job on this app's row and DTO types; the table of where each is the wrong tool |
| 3 | **[`Omit` accepts keys that do not exist](03-omit-accepts-keys-that-do-not-exist.md)** | 🔴 `K extends keyof any`, the silent no-op that re-publishes an internal column, `StrictOmit`, and zod's checked mask — chapter 02's promise in full |
| 4 | **[`Record`, index signatures and `Map`](04-record-index-signatures-and-map.md)** | A closed key set versus an open one; `noUncheckedIndexedAccess`; `Partial<Record<K, V>>`; the four reasons a `Map` is sometimes the honest answer |
| 5 | **[`Exclude`, `Extract` and distributivity](05-exclude-extract-and-distributivity.md)** | The status union filtered both ways; `Extract` by discriminant; distribution and 🔴 `[T] extends [never]`; `NonNullable` as `T & {}` |
| 6 | **[`satisfies` versus annotation versus `as`](06-satisfies-versus-annotation.md)** | The three tables — sort, error codes, route registry — and what an annotation destroys; why a mapper takes the annotation instead; chapter 02's promise |
| 7 | **[Template literal types](07-template-literal-types.md)** | Event names and CSS variables; patterns versus finite unions and where the cross product stops being free; key remapping and the intrinsics |
| 8 | **[`keyof` and indexed access](08-keyof-and-indexed-access.md)** | `(typeof ARR)[number]`; the map-then-index idiom the corpus has used three times; deriving a DTO without `Omit`; homomorphic mapped types |
| 9 | **[Branded types in app code](09-branded-types-in-app-code.md)** | `unique symbol` brands without zod; what a brand survives; 🔴 arithmetic strips it; the four ids this app brands and the three values it declines |

## The four sentences to keep

1. **Two declarations of one shape will disagree.** A derived type moves when
   its source moves; a hand-written parallel type moves when someone
   remembers.
2. **`Omit<T, K>` does not check `K`.** Its declaration is
   `K extends keyof any`, so a typo omits nothing and compiles.
3. **`satisfies` keeps the specific type and an annotation replaces it.**
   That difference decides whether a table's keys stay literal.
4. **Deriving is not free.** A derived type couples two things on purpose; the
   question is always whether they *should* move together.

## Phase gate

You are done with this topic when you can say why `ReturnType<typeof
productsRepo>` beats a hand-written interface and when it does not; write
`Omit`'s declaration from memory and explain why a typo compiles; choose
between `Record`, an index signature and a `Map` for three different key sets;
filter the order-status union with `Extract` and explain what distributes;
justify `as const satisfies` on the sort table; and say what a branded id
survives.

## Where this connects

Backwards to
[chapter 03·02b](../03-typing-raw-pg-results/02b-the-query-module-typed.md),
which asked for the `ReturnType` argument;
[chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md),
which asked for the `Omit`-versus-mask comparison; and
[chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md),
which asked for the `satisfies`-on-tables argument. Sideways to
[chapter 06](../06-typing-the-custom-hooks/README.md) and
[chapter 07](../07-the-typed-api-client/README.md), which use `Extract`,
`Record`, template literals and the map-then-index idiom without stopping to
explain them.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [The typed API client](../07-the-typed-api-client/README.md)
