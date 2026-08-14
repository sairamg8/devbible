---
title: "`keyof`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Keyof Type Operator*, *Typeof Type Operator*). That `keyof any` is
> `string | number | symbol` is corroborated by `lib.es5.d.ts`'s own use of it
> as `Omit`'s bound, read directly. ⚠️ Install inspected: TypeScript **6.0.3**,
> not the 7.0.2 this corpus targets. **No console block on either chunk.**

```ts
type UserKey = keyof { id: string; name: string };   // 'id' | 'name'
```

One line to define, and then it is underneath almost everything else in the type
language. `keyof` is what lets a generic talk about **another type's structure**
— and once you can say "one of that thing's keys", you can write typed
accessors, event maps, reducers, and every mapped type in Phase 5.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What `keyof` produces](./01-what-keyof-produces.md) | Literal-type keys, why modifiers do not matter, the `string \| number` index-signature surprise, arrays and tuples, classes, and the two edge values `keyof {}` and `keyof any` |
| 02 | [`keyof` in practice](./02-keyof-in-practice.md) | `keyof typeof`, the union/intersection duality, typing a registry from its own keys, narrowing a `string` into a key, and filtering keys by value type |

## Phase gate

You are done with this topic when you can say what `keyof (A | B)` is and *why*
it is that rather than the other way round — and when your reflex for turning a
query-string `string` into a key is a guard rather than an `as`.

## Where this connects

- **← [02 · Constraints](../02-constraints/README.md)** — `K extends keyof T` is
  the constraint whose bound is computed from another parameter.
- **← [Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md)** —
  what keeps the literal keys that `keyof typeof` then reads. An annotation
  destroys them.
- **← [Phase 2 · Type guards](../../phase-2-narrowing/07-type-guards.md)** —
  `isKeyOf`, the only honest way from a `string` to a `keyof T`.
- **→ 05 · The `getProp` pattern** *(not written yet)* — this operator plus an
  indexed access, which is the pattern behind every typed accessor.
- **→ 06 · Indexed access types** *(not written yet)* — `T[K]` and `T[number]`,
  used throughout both chunks.
- **→ 07 · The `typeof` type operator** *(not written yet)* — the other half of
  `keyof typeof`.
- **→ Phase 5 (Type-level programming)** — `[K in keyof T]` is where every mapped
  type starts.

---

← Prev: [03 · Generic interfaces and type aliases](../03-generic-interfaces-and-aliases/README.md) · Next → **05 · The `getProp` pattern** *(not written yet)*
