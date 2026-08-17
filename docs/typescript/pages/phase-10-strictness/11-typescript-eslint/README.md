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

:::note Ten chunks, and the plan said seven
Two of the topic's items turned out to be several arguments each.
`strict-boolean-expressions` became three chunks — the rule and its option matrix
(05), the bugs it exists to catch (06), and the migration (07), because half of the
fixes change runtime behaviour and that needed working out rather than listing. The
`no-unsafe-*` rules became two (08, 09) once the count turned out to be **ten
rather than nine** and 🔴 **the prefix turned out not to be a family** — five of
them track `any` and only work as a set; the other five are unrelated checks that
share a naming convention.

📌 **Chunk 06's draft reached 329 lines and was split rather than trimmed — the two
halves then came to 459 together.** The 130 lines the split *added* are why the
300-line limit is a file-size rule and never a limit on how much a topic is
explained.
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
| 05 | [`strict-boolean-expressions`](./05-strict-boolean-expressions.md) | The closed list of falsy values as the **whole** rule — 🔴 truthiness is safe exactly when the non-nullish part of the type has no falsy member, which explains the entire option matrix; and 🔴 that the **defaults draw the line at nullability, not falsiness**, so the famous bugs are permitted until you set two options yourself |
| 06 | [The conditions you get wrong](./06-the-conditions-you-get-wrong.md) | The six worked bugs — the empty username, the zero-valued option, `NaN`, the numeric enum's **first** member, and 🔴 `{count && …}` rendering a literal `0` in the DOM. The pattern that matters: four of the six land on the **most-travelled** path, which is why they reach production |
| 07 | [Fixing them without breaking them](./07-fixing-them-without-breaking-them.md) | 🔴 **Four of the eight fixes change runtime behaviour**, and one makes things *worse* — `n !== 0` admits the `NaN` that truthiness rejected. Why no fixer can choose for you, and the three-pass rollout |
| 08 | [The rules that track `any`](./08-the-rules-that-track-any.md) | Five rules, **one flow** — the five places an `any` can cross a boundary, so disabling one relocates the leak instead of removing it. Pays [topic 03](../03-containing-any.md)'s debt: 🔴 the compiler **cannot** report `any` usage, and the one source it did close (`catch`) needed a dedicated flag to do it |
| 09 | [The five that only share a prefix](./09-the-five-that-share-a-prefix.md) | 🔴 **The prefix is not a family** — enum comparison, class–interface merging, `Function`, unary minus, assertions. Two compiler-read diagnostics anchor it: `TS2395` checks merged declarations for *export consistency* and nothing else, and `TS2356` lists **`any` first** among the operands it accepts |
| 10 | [Adoption and the CI cost](./10-adoption-and-ci-cost.md) | 🔴 The two runs **cannot be merged**, so the levers are scope and parallelism — and *"lint only the changed files"* does not work, because the build is per **project**. Plus the ordering principle the whole topic converges on: **flags before rules**, since every compiler flag you enable first *reduces* the lint work |

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
  rather than written. Chunk 08 pays that debt.
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
  and the `as` count belong there; chunk 09 links rather than restates.

---

← [Phase 10 index](../README.md) · Start → [01 · What type-aware means](./01-what-type-aware-means.md)
