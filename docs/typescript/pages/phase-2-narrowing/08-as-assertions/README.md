---
title: "`as` assertions"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Everyday Types → Type
> Assertions*, *Objects → `const` assertions* — and the TS 4.9 release notes for
> the `satisfies` comparison. **No sandbox run covers this topic**, so error
> texts are quoted from the handbook rather than from a compile, and there is no
> console block.

Every narrowing on pages 01–07 was something the compiler **worked out**. `as` is
the opposite: it is you telling the compiler something it could not work out, and
being believed without evidence.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What an assertion actually is](./01-what-an-assertion-is.md) | Erasure, annotation vs assertion, the overlap rule and `TS2352`, the `as unknown as T` escape |
| 02 | [Living with assertions](./02-living-with-assertions.md) | The legitimate uses, `as const` (a different feature), the excess-property escape, the angle-bracket form, and how `as` compares to the other three escapes |

## Phase gate

You are done with this topic when you can say, without hedging, what
`value as number` does to a string at runtime — and name the two places in your
own codebase where an assertion is load-bearing.

## Where this connects

- **← [07 · Type guards](../07-type-guards.md)** — a guard is a runtime check
  plus a claim; an assertion is the claim alone.
- **→ [09 · Assertion functions](../09-assertion-functions/README.md)** — the version
  that actually throws.
- **→ [10 · `satisfies`](../10-satisfies.md)** — what most `as` on an object
  literal should have been.
- **→ [13 · The non-null assertion `!`](../13-non-null-assertion.md)** — `as`
  narrowed to nullability, with the same trade-off.
- **→ Phase 9 (Types at the boundary)** — where an assertion is at its most
  expensive, because the wrongness arrives from outside your codebase.

---

← Prev: [Type guards](../07-type-guards.md) · Next → [01 · What an assertion actually is](./01-what-an-assertion-is.md)
