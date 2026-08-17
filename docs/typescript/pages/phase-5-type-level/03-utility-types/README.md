---
title: "The built-in utility types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types*, all
> twenty-two entries) with every description and example quoted verbatim, plus
> the **2.1, 2.8, 3.1, 3.3, 3.5, 4.5, 4.8 and 5.4 release notes** for the
> definitions and behaviours attributed to a version. Diagnostics are read out of
> the compiler's own message table and confirmed present in **TypeScript 7.0.2**.
> **No console block** — no sandbox run covers this phase.

Twenty-two utilities ship in `lib`. This topic is **not** a list to memorise —
it is a classification, because the family a utility belongs to predicts
everything about how it behaves.

Construction is not repeated here: `Pick` and `Record` are built in
[topic 01 · chunk 03](../01-mapped-types/03-writing-your-own.md), and `Exclude`,
`Extract` and `Omit` in
[topic 02 · chunk 03](../02-conditional-types/03-composing.md). **This topic is
what they do to real code, where each one lies to you, and how to write the one
that is missing.**

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The map](./01-the-map.md) | The four families, the full list with versions, and the two release notes worth reading once |
| 02 | [The object shapers](./02-object-shapers.md) | `Partial` · `Required` · `Readonly` · `Record` · `Pick` · `Omit` — the update-shaped hole, the shallow ones, the typo `Omit` will not catch, and the union it flattens |
| 03 | [The union filters](./03-union-filters.md) | `Exclude` · `Extract` · `NonNullable` — distribution, selecting one arm of a discriminated union, and why 4.8 rewrote one of them as an intersection |
| 04 | [The extractors](./04-extractors.md) | `ReturnType` · `Parameters` · `InstanceType` · `Awaited` and friends — the overload rule, co-variant vs contra-variant `infer`, and deriving a type from an implementation |
| 05 | [The oddities](./05-oddities.md) | `NoInfer`, `ThisType`, the string intrinsics — and the six utilities you end up writing yourself |

## The four families

| Family | Mechanism | Predicts |
|---|---|---|
| Object shapers | a mapped type | modifier preservation, array behaviour |
| Union filters | a distributing conditional | that they do nothing to a non-union |
| Extractors | a conditional with `infer` | that they defer inside generic code |
| Markers and intrinsics | neither | nothing — read the docs for each |

## The three sentences to keep

1. **`Pick` rejects a bad key; `Omit` does not.** `Pick<T, K extends keyof T>`
   versus `Omit<T, K extends keyof any>` — a typo in an `Omit` silently removes
   nothing, and on a union `Omit` also flattens the discriminant away.
2. **Every extractor sees only the last overload.** The 2.8 notes state it
   outright, so the last overload you declare is the one every derived type will
   report.
3. **`Record<string, T>` is an index signature.** It promises a value for every
   key in existence unless `noUncheckedIndexedAccess` is on.

## Phase gate contribution

The gate asks for `Pick`, `Omit` and `ReturnType` from an empty file. All three
are now covered: `Pick` in topic 01, `Omit` in topic 02, and `ReturnType`'s
`infer`-based definition in [chunk 04](./04-extractors.md) here. The second half
of the gate — *what error a caller gets when each is used wrongly* — is what the
Gotchas sections in chunks 02 to 04 are for.

## Where this connects

- **← [01 · Mapped types](../01-mapped-types/README.md)** — the object shapers,
  built from scratch.
- **← [02 · Conditional types](../02-conditional-types/README.md)** — the union
  filters and the extractors, built from scratch.
- **← [Phase 3 · Variance](../../phase-3-generics/14-variance.md)** — why two
  `infer` sites in parameter positions intersect rather than union.
- **→ [07 · Template literal types](../07-template-literal-types.md)** — where `Capitalize` and
  its siblings actually earn their place.
- **→ 12 · `DeepPartial` / `DeepReadonly`** *(not written yet)* — the recursive
  versions of the shallow shapers, and what they cost.
- **→ 14 · `NoInfer<T>`** *(not written yet)* — the fence from chunk 05, in full.

---

← [Phase 5 index](../README.md) · Next → [01 · The map](./01-the-map.md)
