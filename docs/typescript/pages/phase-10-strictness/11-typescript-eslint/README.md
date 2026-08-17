---
title: "typescript-eslint type-aware rules"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own documentation** —
> *Getting Started → Typed Linting*, *Troubleshooting → Typed Linting →
> Performance*, *Users → Configs*, and each rule's own page, from which preset
> membership and every option default is quoted. Compiler-side claims are read from
> the **TypeScript 5.9.3** diagnostic table and confirmed in the **7.0.2** binary.
> ⚠️ **typescript-eslint is not installed in this repo**, so unlike the rest of this
> phase nothing here is read from its source; every rule claim is attributed to a
> documentation page. **No sandbox, no console block, no timings of our own.**

:::info 🚧 This topic is mid-write — 4 chunks of 7
Chunks **01–04 are written**. Chunks **05 (`strict-boolean-expressions`), 06 (the
`no-unsafe-*` family) and 07 (adoption and the CI cost)** are not written yet, and
references to them in the pages below are deliberately **plain text rather than
links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

The syllabus row asks for *"the checks the compiler will not do, and their CI
cost."* One half of that framing turned out to be wrong, and correcting it is what
this topic is organised around.

> 🔴 **"The compiler will not do this" is true of some of these rules and false of
> others, and the difference decides whether each one is worth its cost.**
>
> - **`no-floating-promises` — the compiler has *nothing*.** Not a weaker check,
>   not one behind a flag. An expression statement that discards its value is legal,
>   so there is no diagnostic to attach.
> - **`no-misused-promises` — one of its three checks is largely redundant** with
>   `TS2801`/`TS2367`; the other two find a bug class `tsc` will never report.
> - **`no-unnecessary-condition` — the compiler already does a real slice of it**,
>   under **seven** codes. What is left is narrowing-awareness, and that is where
>   the value is.
>
> 🔴 **And the cost is not a guess.** typescript-eslint states that *"running typed
> linting on a project is generally as slow as type checking that same project"*,
> and that lint times *"should be roughly the same as your build times"*. **The
> budget is one `tsc` run.**

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What type-aware means](./01-what-type-aware-means.md) | Why these rules need a built program, the **three verbatim cost quotes**, the wide-`include` misconfiguration that dominates, and 🔴 that `strict`/`strict-type-checked` are **not semver-stable** — a patch update can fail your build |
| 02 | [`no-floating-promises`](./02-no-floating-promises.md) | The one rule with **zero** compiler overlap, and why that is structural; `void` as the sanctioned fire-and-forget spelling; and 🔴 the asymmetry that ESLint has no `TS2578`, so disable comments rot in a way `@ts-expect-error` cannot |
| 03 | [`no-misused-promises`](./03-no-misused-promises.md) | Which of the three checks duplicates the compiler and which does not; and why `forEach(async …)` type-checks — `void` is a **deliberately permissive** return position that ordinary code depends on, so no flag will change it |
| 04 | [`no-unnecessary-condition`](./04-no-unnecessary-condition.md) | 🔴 The seven codes the compiler already has, and the exact leftover; plus the best result in the topic — the rule's **false positives are a detector for unsound types**, each traceable to a specific hole from [topic 07](../07-unsound-by-design/README.md) |
| 05 | **`strict-boolean-expressions`** *(not written yet)* | The `allow*` matrix and why this one is opt-in rather than in any preset |
| 06 | **The `no-unsafe-*` family** *(not written yet)* | The nine rules, and 🔴 the debt from [topic 03](../03-containing-any.md): they are the only way to catch **inherited** `any` |
| 07 | **Adoption and the CI cost** *(not written yet)* | The order to turn things on, the `-only` configs, and the arithmetic of not running two type-checks per job |

## Phase gate

You are done with this topic when you can say, for any one of these rules,
**whether the compiler already covers it and what specifically is left over** — and
when you would defend paying a second type-check in CI for
`no-floating-promises` alone.

The tell that it has not landed: adopting `strict-type-checked` wholesale and then
suppressing `no-unnecessary-condition` across the codebase. Those reports are
findings about your types
([chunk 04](./04-no-unnecessary-condition.md)), and the flags that remove most of
them — `strictNullChecks`, then `noUncheckedIndexedAccess` — are ones this phase has
already argued for on their own merits.

## Where this connects

- **← [01 · `strict` flag by flag](../01-strict-flag-by-flag/README.md)** —
  `strictNullChecks` is a **prerequisite**, not a companion:
  `no-unnecessary-condition` is non-functional without it, and its escape hatch is
  named `allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing` and is being
  removed.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** — the
  single flag that removes the largest class of `no-unnecessary-condition` false
  positives.
- **← [03 · Containing `any`](../03-containing-any.md)** — which names the
  `no-unsafe-*` family as the only way to catch `any` that arrives **inherited**
  rather than written. Chunk 06 owes that debt.
- **← [07 · Unsound by design](../07-unsound-by-design/README.md)** — the holes that
  become this topic's false positives, one for one.
- **← [08 · Suppression directives](../08-suppression-directives/README.md)** — the
  ladder applies to `eslint-disable` too, ⚠️ **minus the self-cleaning property**:
  there is no ESLint equivalent of `TS2578`.
- **← [10 · The error codes](../10-the-error-codes/11-the-condition-is-decided.md)**
  — the seven always-decided-condition codes, read from the compiler, that make
  chunk 04's boundary claim checkable rather than rhetorical.
- **← [Phase 7 · Typed Express handlers](../../phase-7-server/05-typed-express-handlers/02-a-promise-the-compiler-cannot-keep.md)**
  — the same promise-in-a-`void`-position mechanism, argued in the framework where
  it bites hardest.
- **→ 12 · Assertion discipline** *(not written yet)* — `no-unsafe-type-assertion`
  and the `as` count belong there; chunk 06 will link rather than restate.

---

← [Phase 10 index](../README.md) · Start → [01 · What type-aware means](./01-what-type-aware-means.md)
