---
title: "@ts-expect-error vs @ts-ignore vs @ts-nocheck"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own diagnostic table** in the
> **TypeScript 5.9.3** build for `TS2578` — *"Unused `'@ts-expect-error'`
> directive."* — and its **option table** for `checkJs`, `allowJs`, and 🔴 the two
> `suppress*` options, both of which sit in **`category: Backwards_Compatibility`**.
> Lint behaviour is from the **typescript-eslint** `ban-ts-comment` rule
> documentation. **No sandbox, no console block on any chunk.**

Four chunks on the comments that turn the compiler off, and the config options
that do it at a scale comments cannot.

> **`@ts-ignore` and `@ts-expect-error` do the same thing today and opposite
> things in six months.** One stays silent forever; the other fails the build the
> moment it becomes unnecessary. That is the only property that matters, and it
> makes `TS2578` **the one diagnostic in TypeScript that gets you closer to
> correct without anyone deciding to work on it.**
>
> **The objection is the feature.** "It will break the build later" is what you
> are buying — a suppression that cannot break the build later is one that will
> still be there in five years.
>
> 🔴 **The directives are the middle of a seven-tier ladder, not the whole of
> it.** Two compiler options do project-wide what `@ts-ignore` does per line, and
> the compiler files them under **`Backwards_Compatibility`** — which is the
> option table's way of saying what it thinks of them.
>
> **Count, do not ban.** An absolute rule gets suspended under pressure and never
> reinstated; a tracked number permits the legitimate case and still catches the
> trend.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [The three directives](./01-the-three-directives.md) | What each does and its scope; `TS2578` and the inversion behind it; `@ts-expect-error` as a **type-level testing tool**; ⚠️ the "absorbs a *different* error" weakness; the one legitimate `@ts-ignore`; why `@ts-nocheck` in a `.ts` file is almost always wrong and `@ts-check` in a `.js` file is genuinely useful; the four places directives do not work |
| 02 | [Why expect-error wins](./02-why-expect-error-wins.md) | The **ratchet property** stated precisely, and why the usual objection is the feature; why a description bounds the weakness rather than merely documenting it; the `ban-ts-comment` config that is the whole policy in five lines; the four-step `@ts-ignore` migration where step 2 deletes a meaningful fraction for free; 🔴 the one place a directive is never justified |
| 03 | [The suppression tiers](./03-the-suppression-tiers.md) | All **seven** tiers ordered by blast radius; 🔴 `suppressExcessPropertyErrors` and `suppressImplicitAnyIndexErrors`, the project-wide `@ts-ignore` most people have never heard of; why turning a flag off is arguably *more* honest than `@ts-nocheck`; where `skipLibCheck` sits (nowhere) and why it keeps being proposed; the four-command audit |
| 04 | [A policy that works](./04-a-policy-that-works.md) | The four rules; why counting beats banning and how the count is gamed; **the review question** — *what has to become true for this line to be deleted?* — and why the common answer means it is not a suppression at all; how this joins the phase's other two metrics |

## Phase gate

You are done with this topic when you can **say what `TS2578` is and why it is
the most valuable diagnostic in the phase**, name a suppression tier that no
directive grep will ever find, and answer the review question for a real
suppression in your own codebase.

The tell that it has not landed: treating `@ts-expect-error` as the good outcome.
It is the fourth choice — after fixing, narrowing and guarding — and its only
virtue is that it expires.

## Where this connects

- **← [06 · The other correctness flags](../06-the-other-correctness-flags/README.md)**
  — the group where a suppression is **never** justified, because every fix in it
  is mechanical.
- **← [07 · Where TypeScript is unsound by design](../07-unsound-by-design/02-the-holes-you-opt-into.md)**
  — `as` and `!` are tier 2 of the same ladder, and the ranking never changes.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** and
  [05 · `exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/README.md)
  — the phase's other two "count something" metrics, measuring the same thing
  from different directions.
- **← [Phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)**
  — `skipLibCheck`'s real trade, which is not suppression.
- **→ 09 · Excess property checks vs assignability** *(not written yet)* — the
  check that `suppressExcessPropertyErrors` turns off project-wide.
- **→ 12 · Assertion discipline** *(not written yet)* — where these three metrics
  become one practice.

---

← [Phase 10 index](../README.md) · Start → [01 · The three directives](./01-the-three-directives.md)
