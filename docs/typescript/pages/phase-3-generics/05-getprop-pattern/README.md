---
title: "The `getProp` pattern"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, where this signature is
> the worked example for *Using Type Parameters in Generic Constraints*.
> `TS2345`, `TS7053` and `TS2536` were read out of the compiler's own diagnostic
> table, and `Pick`'s declaration directly from `lib.es5.d.ts` — ⚠️ TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets. **No console block on either
> chunk.**

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

The last Master topic of the phase, and the one everything before it was
building towards: a type parameter ([01](../01-generic-functions-and-inference/README.md)),
a constraint computed from another parameter ([02](../02-constraints/README.md)),
`keyof` ([04](../04-keyof/README.md)) and an indexed access, in eleven tokens.

The single sentence to take away:

> **The second type parameter exists only so the return type can be `T[K]`
> instead of `T[keyof T]`** — `key: keyof T` checks the key but forgets which one
> it was, and the widest return type it can then express is the union of every
> property type.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [The signature, piece by piece](./01-the-signature.md) | Building it up from the version that fails, why `K` is not `keyof T`, what `T[K]` is, why the body needs no assertion, and why the object must come first |
| 02 | [Variants, and where it breaks](./02-variants-and-limits.md) | `setProp`/`pluck`/`pick`/`groupBy`, constraining by value type, the four failure modes (`TS2345`, `TS7053`, `TS2536`, union `T`), `noUncheckedIndexedAccess`, and why deep paths are a different problem |

## Phase gate

This is the phase's gate. You are done when you can write `pick(obj, keys)` from
an empty file with the return type computed from the arguments, say which
argument each inference came from, and explain in one sentence why the second
type parameter is not optional.

## Where this connects

- **← [01 · Generic functions and inference](../01-generic-functions-and-inference/README.md)**
  — the argument ordering that makes `T` available before `K` is checked.
- **← [02 · Constraints](../02-constraints/README.md)** — a bound computed from
  another type parameter.
- **← [04 · `keyof`](../04-keyof/README.md)** — including why a union `T`
  collapses the constraint to the discriminant.
- **→ [06 · Indexed access types](../06-indexed-access-types.md)** — `T[K]`, `T[number]` and
  distribution over union keys.
- **→ Phase 5 (Type-level programming)** — `KeysOfType<T, V>` and typed deep
  paths, both of which start here and need mapped and template literal types.
- **→ Phase 8 (TypeScript in React)** — a form library's `register('email')` is
  this signature; so is a table's `sortBy` prop.

---

← Prev: [04 · `keyof`](../04-keyof/README.md) · Next → [06 · Indexed access types](../06-indexed-access-types.md)
