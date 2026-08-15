---
title: "`satisfies`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 4.9 release notes** (which
> introduced the operator) and the **handbook**. `TS1360`, `TS2353` and `TS9035`
> were read out of the compiler's own diagnostic table — ⚠️ TypeScript **6.0.3**,
> not the 7.0.2 this corpus targets. **No console block on either chunk**; no
> recorded run covers this topic.

An annotation checks a value and then **replaces** its type. That is usually
fine, and occasionally it destroys exactly the information you wanted:

```ts
const palette: Record<ColorName, string | [number, number, number]> = { … };
palette.red.toUpperCase();     // error — it is the whole union now
```

`satisfies` is the operator for "check this, but do not touch the type you
inferred". It is the only one of the three type-layer tools — annotation, `as`,
`satisfies` — that validates fully **and** leaves the expression's type alone.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [The problem it solves](./01-the-problem-it-solves.md) | Why an annotation discards detail, the three-way comparison table, where the operator may appear, and `as const satisfies` |
| 02 | [The patterns worth stealing](./02-patterns-and-limits.md) | The exhaustive record, deriving types from the value, heterogeneous config, `as const satisfies` for literal data, checked default exports — and the three places it does not help |

## Phase gate

You are done with this topic when you can state, without hesitating, what each
of `const x: T = v`, `v as T` and `v satisfies T` does to both the *checking* and
the *resulting type* — and when you can write a lookup table that fails the build
the day someone adds a new union member.

## Where this connects

- **← [08 · `as` assertions](../08-as-assertions/README.md)** — what most `as` on
  an object literal should have been. Before 4.9 there was no alternative.
- **← [06 · Exhaustiveness with `never`](../06-exhaustiveness.md)** —
  `assertNever` completes a `switch`; `satisfies Record<Union, T>` completes a
  **table**. Same guarantee, different shape.
- **→ [Phase 1 · Literal types and `as const`](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md)**
  — the widening rules that decide whether a `satisfies` check will pass.
- **→ Phase 3 (Generics)** — `keyof typeof value` is the entry point to deriving
  types from data, and it only works because `satisfies` kept the keys.
- **→ Phase 9 (Types at the boundary)** — `satisfies` is erased, so it validates
  nothing that arrives at runtime. That is a validator's job.

---

← Prev: [09 · Assertion functions](../09-assertion-functions/README.md) · Next → [11 · Narrowing you lose](../11-narrowing-lost/README.md)
