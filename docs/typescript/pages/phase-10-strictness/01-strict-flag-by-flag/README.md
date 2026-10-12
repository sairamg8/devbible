---
title: "strict flag by flag"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 by **enumerating the compiler's own option table** — every
> option carrying `strictFlag: true`, with each flag's **verbatim `description`
> string** — from the **TypeScript 5.9.3** build, cross-checked against the
> **7.0.2** native binary. Diagnostic codes and their exact `{0}` text come from
> the same numbered table. `strict`'s default of `true` is
> [phase 0's sandbox-proven measurement](../../phase-0-how-typescript-runs/05-strict.md),
> cited rather than re-derived. **No sandbox, no console block on any chunk.**

The phase's first topic, and the one the other twelve assume. Three chunks, three
claims:

> **`strict` is a meta-flag over nine options — not seven.** The list has grown
> (`useUnknownInCatchVariables` in 4.4, `strictBuiltinIteratorReturn` in 5.6),
> so it is worth *deriving* from the compiler rather than remembering.
>
> **`strictNullChecks` is different in kind from the other eight.** They add
> checks; it changes what every existing type *means*. Without it `string`
> includes `null`, and every narrowing page in phase 2 is theatre.
>
> **Seven of the nine are effectively free.** Which is the argument for turning
> `strict: true` on and overriding the one or two you cannot yet afford, rather
> than enabling flags one at a time from zero.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What it actually is](./01-what-strict-actually-is.md) | The nine flags and their verbatim descriptions; why the count is nine and not seven; the default of `true` and what that makes worth grepping for; the three that are not about types; and why "turn it all on" is right for new code and not always possible for old |
| 02 | [`strictNullChecks`](./02-strictnullchecks.md) | Why it changes the language rather than adding a check; the two diagnostic families and what the difference tells you; narrow / default / assert in order of preference; the `!` that is a promise; and the dependency problem no flag can fix |
| 03 | [The other eight](./03-the-other-eight.md) | Each flag with the specific hole it closes — including `strictFunctionTypes`' deliberate method-bivariance exception — and an adoption-order table costed by how much code each one touches |

## Phase gate

You are done with this topic when you can **name the nine flags without looking**,
say which two are expensive and why, and explain what a codebase with
`strict: true` and a thousand `!` operators has actually achieved.

The tell that it has not landed: treating `strict` as a single switch, or
reaching for `strictNullChecks: false` to quiet a migration.

## Where this connects

- **← [Phase 0 · `strict`](../../phase-0-how-typescript-runs/05-strict.md)** —
  the sandbox-proven default. ⚠️ That page opens with *"a switch over seven"*;
  against the 5.9.3 and 7.0.2 option tables the count is **nine**. Its
  measurement stands, its count is stale.
- **← [Phase 2 · Narrowing](../../phase-2-narrowing/README.md)** — what
  `strictNullChecks` gives control-flow analysis something to subtract *from*.
- **← [Phase 2 · `unknown` in `catch`](../../phase-2-narrowing/12-unknown-in-catch.md)**
  and [phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)
  — `useUnknownInCatchVariables`, owned there and not repeated here.
- **← [Phase 7 · The annotated configs](../../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md)**
  — the same flags argued on a real server, with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` alongside them.
- **→ 02 · `noUncheckedIndexedAccess`** *(not written yet)* — the most valuable
  flag `strict` does **not** include.
- **→ [07 · Where TypeScript is unsound by design](../07-unsound-by-design/README.md)** — method
  bivariance, introduced in chunk 03, listed there as one of six deliberate holes.
- **→ 12 · Assertion discipline** *(not written yet)* — the `!` count as the real
  measure of a strictness migration.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [TSConfig Option: strict](https://www.typescriptlang.org/tsconfig/strict.html) — typescriptlang.org: `strict` enables the whole strict family; future versions may add checks under it (*read*)
- **Also good:** [How to Incrementally Migrate an Angular Project to TypeScript Strict Mode](https://www.bitovi.com/blog/how-to-incrementally-migrate-an-angular-project-to-typescript-strict-mode) — Bitovi, 2022-06-22: explains each flag in the TS 4.7.3 strict set with code (*read*; Angular examples, flag list predates `strictBuiltinIteratorReturn`)

{/* LINKMAP:END */}

---

← [Phase 10 index](../README.md) · Start → [01 · What `strict` actually is](./01-what-strict-actually-is.md)
