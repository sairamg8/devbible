---
title: "Excess property checks vs assignability"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own diagnostic table** in the
> **TypeScript 5.9.3** build — 🔴 **two** excess-property codes (`TS2353` and
> `TS2561`, the latter carrying *"Did you mean to write `'{2}'`?"*), plus
> `TS2559`, `TS2739` and `TS2741` — and the **option table** for
> `suppressExcessPropertyErrors` (`category: Backwards_Compatibility`). Weak type
> detection and its exact limit were **measured in phase 1** and are cited from
> [phase 1 · Object types](../../phase-1-type-vocabulary/04-object-types.md),
> which is sandbox-proven; **this topic runs no sandbox and carries no console
> block.**

Why an object literal errors where an identically-shaped variable does not — and
why that is the rule working rather than an inconsistency. Four chunks:

> **Excess property checking is not part of assignability.** It is a separate
> heuristic that fires only on a **fresh object literal**, because a literal
> written inline for this call was written *for* this call — so an unexpected key
> in it is almost certainly a typo. A variable might legitimately carry more.
>
> 🔴 **There are two codes, and the difference is diagnostic.** `TS2561` means the
> compiler ran a similarity check and **found the property you meant** — the most
> actionable error TypeScript produces. `TS2353` means your key resembles nothing
> in the target, which usually means the wrong interface, not a typo.
>
> **Freshness is spent exactly once**, and seven ordinary operations spend it —
> the most common being *extracting the literal into a variable*, a routine
> refactor that silently removes a typo guard.
>
> 🔴 **It is one of three overlapping rules — extra / nothing / missing** — and
> together they leave one reachable gap: **a typo in an optional property, on a
> target with one required property, passed through a variable, is caught by
> nothing.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Freshness](./01-freshness.md) | The behaviour and why the extra rule exists; `TS2353` vs `TS2561` and what each tells you about the mistake; the three things it is **not**; that freshness applies to **nested** literals and to **each array element**, which is where it earns most |
| 02 | [Where freshness is lost](./02-where-freshness-is-lost.md) | The **seven** ways to spend it — variable, `as`, wider annotation, inferred return type, spread, staged building, union target; ⚠️ why `as` is the most misleading of them; restoring the check with `satisfies` rather than an annotation, and why that difference matters |
| 03 | [The second and third rules](./03-the-second-and-third-rules.md) | Weak type detection (`TS2559`) and 🔴 **exactly where it stops** — one required property and it is gone; missing-required (`TS2739`/`TS2741`) which lists the names; **the extra / nothing / missing axis** for reading any of them from the code alone; the gap all three leave |
| 04 | [Designing for it](./04-designing-for-it.md) | Five rules for code you control — `satisfies` on config, annotated factory returns, keeping required fields out of options bags, discriminating before a union check, and 🔴 **never `suppressExcessPropertyErrors`**; the four honest ways to carry a genuinely extra property |

## Phase gate

You are done with this topic when you can **explain to someone why their literal
errors and their variable does not without calling it a quirk**, name three of
the seven ways freshness is lost, and state the one typo case that all three
rules miss.

The tell that it has not landed: reaching for `as` to silence `TS2353`. That is
the second entry on the list of ways to lose the check, applied to the error the
check exists to produce.

## Where this connects

- **← [Phase 1 · Object types](../../phase-1-type-vocabulary/04-object-types.md)**
  — where weak type detection and its limit were **measured**. That page owns the
  evidence; this topic owns its place among the three rules.
- **← [Phase 1 · Structural typing](../../phase-1-type-vocabulary/09-structural-typing.md)**
  — the property that makes extra keys legal in the first place, and therefore the
  reason this heuristic has to exist.
- **← [Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md)** —
  the tool that restores the check without widening the type.
- **← [04 · Reading a TypeScript error](../04-reading-a-typescript-error.md)** —
  which deferred *"why `TS2353` fires for object literals only"* to this topic.
- **← [07 · Where TypeScript is unsound by design](../07-unsound-by-design/03-the-holes-in-your-data.md)**
  — this heuristic is layered over the same structural-typing fact that forces
  `Object.keys` to return `string[]`.
- **← [08 · The suppression tiers](../08-suppression-directives/03-the-suppression-tiers.md)**
  — `suppressExcessPropertyErrors` as tier 6, and why the config audit comes
  first.
- **→ 10 · The error codes you will actually meet** *(not written yet)* — where
  `TS2353` sits among the rest of the daily set.
- **→ 12 · Assertion discipline** *(not written yet)* — the `as` that silences
  this check is the same `as` that silences everything else.

---

← [Phase 10 index](../README.md) · Start → [01 · Freshness](./01-freshness.md)
