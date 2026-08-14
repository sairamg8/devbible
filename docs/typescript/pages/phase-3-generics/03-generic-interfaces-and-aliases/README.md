---
title: "Generic interfaces and type aliases"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generic Types*,
> *Declaration Merging*). **Utility-type declarations are read verbatim from
> `lib.es5.d.ts`**; `TS2314`, `TS2428` and `TS2589` from the compiler's own
> diagnostic table — ⚠️ TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> The recursion-depth figure is **sandbox-measured** in `sandbox/ts-p1/` and
> quoted in prose. **No console block on either chunk.**

Topics 01 and 02 parameterised *functions*. This one parameterises **types** —
and that is the step where generics stop being a convenience and become how a
domain gets modelled.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Six lines carrying the whole phase: a parameter for the payload, a default for
the common error, a discriminant so both branches narrow, and callers who get
back *their* error union rather than a flattened `Error`.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Parameterising a type](./01-parameterising-a-type.md) | Type constructors and `TS2314`, what an alias can express that an interface cannot, the lib's own utility declarations (including why `Omit` does not catch typos), the result type, and generic interfaces for behaviour |
| 02 | [Parameter placement and merging](./02-parameter-placement-and-merging.md) | Interface-level vs method-level parameters, `type F<T> = (x: T) => T` vs `type F = <T>(x: T) => T`, declaration merging and `TS2428`, defaults, recursion and the measured `TS2589` threshold |

## Phase gate

You are done with this topic when you can say, without hesitating, how
`type F<T> = (x: T) => T` differs from `type F = <T>(x: T) => T` — and when you
can explain from its declaration why `Omit<User, 'nmae'>` compiles.

## Where this connects

- **← [02 · Constraints](../02-constraints/README.md)** — `Pick<T, K extends
  keyof T>` is that pattern applied inside a type rather than a signature.
- **← [Phase 1 · `type` vs `interface`](../../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — the general choice; this topic covers only where generics change it.
- **← [Phase 2 · Discriminated unions](../../phase-2-narrowing/05-discriminated-unions.md)**
  — a parameterised discriminated union is the most valuable shape here.
- **→ 06 · Indexed access types** *(not written yet)* — `Row[Key]`, used in
  passing on chunk 01.
- **→ 08 · Default type parameters** *(not written yet)* — the `E = Error` half
  of the result type.
- **→ 09 · Generic classes** *(not written yet)* — what `implements
  Repository<User>` actually requires.
- **→ Phase 5 (Type-level programming)** — where the alias-only forms
  (conditional, mapped, template literal) become the whole subject.

---

← Prev: [02 · Constraints](../02-constraints/README.md) · Next → [04 · `keyof`](../04-keyof/README.md)
