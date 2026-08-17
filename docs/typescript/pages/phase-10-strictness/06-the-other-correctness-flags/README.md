---
title: "The other correctness flags"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **enumerating these options in the compiler's own option
> table** from the **TypeScript 5.9.3** build — each record's `description`
> string, its `defaultValueDescription`, and the **absence of `strictFlag` on
> every one of them**, which is what settles their exclusion from `strict`. Their
> diagnostics — `TS4111`–`TS4116`, `TS7027`–`TS7030`, and the seven unused-code
> codes — come from the numbered diagnostic table, read rather than recalled.
> **No sandbox, no console block on any chunk.**

The flags that are not `strict`, not `noUncheckedIndexedAccess`, and not
`exactOptionalPropertyTypes` — the remainder, which is where most of the cheap
wins are. Five chunks:

> **`noImplicitOverride` is the best value in the phase and almost nobody enables
> it.** Without `override`, "I am replacing the base implementation" and "I am
> adding a new method" are written identically — so renaming a base member turns
> one into the other, in a different file, with no error anywhere.
>
> **One of these flags changes syntax and no types at all.**
> `noPropertyAccessFromIndexSignature` exists because an index signature makes
> *every* misspelling legal, and it is the one flag here you can reasonably
> decline.
>
> **`noFallthroughCasesInSwitch` is a *binder* diagnostic, not a checker one** —
> the only flag in the group whose record says `affectsBindDiagnostics`. It is
> purely syntactic, so it works on files the checker has given up on, and it
> cannot recognise an intentional fallthrough.
>
> **Two neighbours default to `undefined`, not `false`** — a real third state
> meaning *suggestion*. Unreachable code is already being reported to you in the
> editor today, invisibly to CI, and the `allow*` naming inverts the polarity.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [`noImplicitOverride`](./01-noimplicitoverride.md) | The rename-in-the-base bug and why nothing else catches it; the **five** `override` diagnostics and which is the cost vs the payoff; `override` is erased, so it is strip-safe and gives no runtime guarantee; the four things it does **not** cover, `super` calls included |
| 02 | [Index-signature access](./02-index-signature-access.md) | `TS4111`, whose message contains its own fix; the typo that falls through an index signature; how it pairs with `noUncheckedIndexedAccess` (syntax vs type, same construct); `process.env` as the canonical case and why parsing is the real answer; 🔴 the `showInSimplifiedHelpView: false` observation; the honest case for declining it |
| 03 | [The control-flow flags](./03-control-flow-flags.md) | `noFallthroughCasesInSwitch` — what counts, why stacked empty cases are exempt, and the **binder-diagnostic** consequence; `noImplicitReturns` — 🔴 why `strictNullChecks` misses the *unannotated* function, where a missing return becomes a wider inferred type instead of an error; why a bare `return;` is not a fix; the `void`/`any` escape |
| 04 | [The unused-code flags](./04-unused-code-flags.md) | The **seven** unused-code diagnostics and why four of them read like UI messages; `TS6133` vs `TS6196` as the value/type-side split; the `_` prefix as a **compiler rule** for parameters only; 🔴 `allowUnreachableCode`'s three-state `undefined` default and inverted polarity; the honest "this belongs in the linter" argument and its rebuttal |
| 05 | [Choosing and adopting](./05-choosing-and-adopting.md) | All eight flags in one costed table; why `strict` omits them for **two different reasons**, only one of which is principled; a one-flag-per-commit adoption order; the two numbers to measure; 🔴 why an `@ts-ignore` over any error in this group is always pure suppression |

## Phase gate

You are done with this topic when you can **say which of these eight flags catches
a behavioural bug and which merely catches surplus code**, explain why a missing
`return` in an unannotated function is not an error without `noImplicitReturns`,
and name the flag you would enable first on a legacy codebase with a reason that
is not "it is the easiest".

The tell that it has not landed: dismissing the group as linting. One of them
catches a subclass that silently stopped overriding, which is a production
behaviour change with no compile-time signal at all — and it costs a keyword.

## Where this connects

- **← [01 · `strict` flag by flag](../01-strict-flag-by-flag/README.md)** — the
  nine flags `strict` *does* enable, and the two additions (4.4, 5.6) that show
  how rarely the list grows.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** —
  pairs directly with `noPropertyAccessFromIndexSignature`: one fixes the type of
  an index access, the other its syntax.
- **← [05 · `exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/README.md)**
  — the third flag outside `strict`, and the one with a real migration cost;
  everything here is cheaper.
- **← [03 · Containing `any`](../03-containing-any.md)** — `noImplicitReturns` is
  disabled by an `any` or `void` return type, one more check that `any` quietly
  switches off.
- **← [Phase 4 · Abstract classes](../../phase-4-classes-declarations/11-abstract-classes.md)**
  and [Parameter properties](../../phase-4-classes-declarations/03-parameter-properties.md)
  — the class machinery `TS4115` and `TS4116` sit on top of.
- **← [Phase 2 · Exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md)** —
  the `switch` shape that makes `noFallthroughCasesInSwitch` quiet and buys
  exhaustiveness checking at the same time.
- **← [Phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/README.md)**
  — the applied answer to the flag that `process.env` triggers everywhere.
- **→ [08 · `@ts-expect-error` vs `@ts-ignore`](../08-suppression-directives/README.md)** — why a
  suppression over any error in *this* group is never justified.
- **→ 11 · typescript-eslint type-aware rules** *(not written yet)* — where the
  unused-code pair arguably belongs, and the rules that go further than `TS6205`.

---

← [Phase 10 index](../README.md) · Start → [01 · `noImplicitOverride`](./01-noimplicitoverride.md)
