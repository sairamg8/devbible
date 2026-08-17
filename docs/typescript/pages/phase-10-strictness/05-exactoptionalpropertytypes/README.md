---
title: "exactOptionalPropertyTypes"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by reading the **compiler's own option table** from the
> **TypeScript 5.9.3** build — `exactOptionalPropertyTypes` carries
> `defaultValueDescription: false` and **no `strictFlag`**, described as
> *"Interpret optional property types as written, rather than adding
> `'undefined'`."* — and its **three** diagnostics `TS2375` / `TS2379` /
> `TS2412` from the numbered table, all present verbatim in the **7.0.2** native
> binary. `Partial` / `Required` / `Pick` read from `lib.es5.d.ts`.
> **No sandbox, no console block on any chunk.**

The one flag in this phase that does not add a check — it changes what a piece
of syntax you write every day actually means. Four chunks, four claims:

> **`name?: string` has always been a lie by one bit.** Without this flag it
> means "absent **or** present and `undefined`" — two different runtime objects
> collapsed into one type, distinguishable by `in`, by `Object.keys`, and by the
> object spread that silently overwrites your defaults.
>
> **It constrains writes, not reads.** `u.name` is `string | undefined` either
> way, because an absent property reads as `undefined` at runtime. This is why
> the errors cluster at object *construction* rather than spreading across all
> consuming code — and why it is tractable to adopt.
>
> **It is the flag that makes object spread's type honest.** Without it,
> `{ ...defaults, ...opts }` is typed `number` while the runtime value is
> `undefined`, and nothing else in the language can detect that.
>
> **Most of its errors are imprecise types, not bugs.** A minority are genuine
> data bugs and they are the ones worth the migration. Counting which is which
> on your codebase is the decision.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Absent vs undefined](./01-absent-versus-undefined.md) | The ten runtime operations that distinguish the two states; what the flag changes and the reads it deliberately does not; the three diagnostics and what their singular/plural wording tells you; `?: T \| undefined` as the honest escape hatch; the four places the flag does nothing; why it is not in `strict` |
| 02 | [The JSON boundary](./02-the-json-boundary.md) | Why `JSON.stringify` cannot carry the distinction and `JSON.parse` cannot produce it; the three-state `?: T \| null` payload model; detecting supplied-ness with `in` rather than `!== undefined`; the response side, where nothing errors; `null` vs `undefined` as an enforceable policy |
| 03 | [Spread, defaults and construction](./03-spread-defaults-and-construction.md) | The defaults bug in full, and why it is a soundness argument rather than a style one; the four patterns that error and their fixes; the conditional-spread idiom; why `Partial<T>` is the biggest bucket; the `if (x)` regression a migration invites; why destructuring defaults never had the problem |
| 04 | [Living with it](./04-living-with-it.md) | What it does to `Partial` / `Required` / `Pick`; `delete` and `TS2790`; third-party `.d.ts` you cannot fix and why `skipLibCheck` is not the answer; where it fights hardest; an adoption order; when **not** to enable it; the one number that says whether the migration went well |

## Phase gate

You are done with this topic when you can **name three runtime operations that
distinguish `{}` from `{ k: undefined }`**, explain why the flag changes nothing
about reading an optional property, and write the type for a `PATCH` payload
field that must express *leave it*, *clear it* and *set it* as three distinct
states.

The tell that it has not landed: fixing every error by appending `| undefined`.
That is the compiler's own suggestion, and applied mechanically it restores the
pre-flag meaning with more characters — the most common way a team enables this
flag and gains nothing from it.

## Where this connects

- **← [01 · `strict` flag by flag](../01-strict-flag-by-flag/README.md)** — the
  nine flags this one is **not** among, and `strictNullChecks`, without which
  this flag does nothing at all.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** —
  the sibling flag `strict` also omits. They are complementary, not overlapping:
  that one covers index signatures, this one covers optional properties.
- **← [04 · Reading a TypeScript error](../04-reading-a-typescript-error.md)** —
  `TS2375` and `TS2379` produce large object-to-object errors where the property
  path at the end is the only part that matters.
- **← [Phase 7 · The annotated configs](../../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md)**
  — the applied case on a real server, including the `PATCH`-clears-a-field
  data-loss bug. That page owns the applied argument; this topic owns the
  general rule.
- **← [Phase 2 · Narrowing](../../phase-2-narrowing/README.md)** — the
  control-flow analysis that reading an optional property still requires,
  unchanged by this flag.
- **→ [07 · Where TypeScript is unsound by design](../07-unsound-by-design/README.md)** — object
  spread's incorrect result type is one of the holes this flag closes; the rest
  stay open.
- **→ 12 · Assertion discipline** *(not written yet)* — the `as` count as the
  measure of whether this migration was done or merely declared.

---

← [Phase 10 index](../README.md) · Start → [01 · Absent vs undefined](./01-absent-versus-undefined.md)
