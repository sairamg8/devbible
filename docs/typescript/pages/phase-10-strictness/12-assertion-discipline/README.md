---
title: "Assertion discipline"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`) for every code quoted, and against the **TypeScript handbook**
> for type assertions, `satisfies` and the non-null assertion operator. Lint-rule
> claims are attributed to **typescript-eslint's** rule pages — ⚠️ it is not
> installed here. **No sandbox run, no console block.**

:::info 🚧 This topic is mid-write — 3 chunks
Chunks **01–03 are written**. The rest are not, and references to them below are
deliberately **plain text rather than links** so the build stays green. Resume
point: `devbible/progress_typescript_part_b.md` in the memory store.
:::

The syllabus row asks for *"treating every `as` as a review comment, banning
`as any`, and the guard that should have been written instead."* The topic is
organised around one measured fact that reframes all three:

> 🔴 **The compiler checks `satisfies`, argues weakly about `as`, and says nothing
> whatsoever about `!`.** Searching the 5.9.3 diagnostic table for non-null
> assertions returns a single code — `TS8013`, *"Non-null assertions can only be
> used in TypeScript files"* — which is about file extensions, not about the
> assertion. **`!` is the strongest claim in the language and the only one with no
> oversight at all**, which is exactly backwards from how the two are treated in
> review.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Three ways to make a claim](./01-three-ways-to-make-a-claim.md) | `satisfies` / `as` / `!` ranked by how much each is checked, with the diagnostics quoted — 🔴 `TS2352`'s floor is **"sufficient overlap", not correctness**, and it **quotes its own escape hatch**, so `x as unknown as T` in a diff means someone was told the types are unrelated and proceeded |
| 02 | [What an `as` is standing in for](./02-what-an-as-is-standing-in-for.md) | 🔴 **Six substitutions, each needing a different fix** — and the review question that replaces "avoid `as`": *what would have to be true for this to be deleted?* Includes the one case where a claim became a check (**5.5's inferred type predicates**) and why `as const` must be excluded from any count |
| 03 | [The one-character claim nobody counts](./03-the-one-character-claim.md) | 🔴 Six reasons `!` goes uncounted — including that it **cannot be grepped for**, since `!` is also negation and `!=` — the two shapes that **contain their own refutation** (`a?.b!` and `a! ?? c`), and that every rule the compiler enforces around `!:` is about **form, not truth** |
| 04 | **`as any`, and why it is a different thing** *(not written yet)* | Not a stronger assertion but an exit from the type system — and what it does to the `no-unsafe-*` rules downstream |
| 05 | **A policy that works** *(not written yet)* | Count, do not ban; the legitimate uses; and the metric this phase has been building toward |

## 🔴 What this topic deliberately does not repeat

**Phase 2 already owns the mechanics, in four topics and considerable depth.** This
topic owns the **discipline** — how many assertions a codebase should have, what
each one is substituting for, and how to review them. Where you want the mechanism,
read there:

| Mechanism | Where it lives |
|---|---|
| what an assertion is, the angle-bracket form, `as unknown as T`, `as const` as a different feature, the excess-property escape | [Phase 2 · 08 · `as` assertions](../../phase-2-narrowing/08-as-assertions/README.md) |
| assertion functions, the explicit-annotation requirement, and that **the compiler does not check the body** | [Phase 2 · 09 · Assertion functions](../../phase-2-narrowing/09-assertion-functions/README.md) |
| `satisfies` in full, including `as const satisfies` and the `isolatedDeclarations` interaction | [Phase 2 · 10 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md) |
| the non-null assertion, the definite-assignment `!:`, and where `!` silently does nothing | [Phase 2 · 13 · The non-null assertion](../../phase-2-narrowing/13-non-null-assertion.md) |

⚠️ **If a chunk here starts explaining how an assertion works, it is in the wrong
phase.** The question this topic answers is not *what does `as` do* but *what is
this particular `as` standing in for, and what would have to be true for it to be
deleted.*

## Phase gate

You are done with this topic when you can look at an assertion and say **what it is
substituting for** — which guard, which validation, which type that should have been
written — and when your answer to a `!` is at least as demanding as your answer to
an `as`.

The tell that it has not landed: a codebase with a lint rule banning `as any` and an
uncounted population of `!`.

## Where this connects

- **← [07 · Unsound by design](../07-unsound-by-design/README.md)** — `any`, `as`
  and `!` are the three holes you **write**, and therefore the only ones that are
  greppable, countable and fixable by policy. That is why this phase's metric is
  built on them.
- **← [08 · Suppression directives](../08-suppression-directives/README.md)** —
  `as`/`!` are **tier 2** of the seven-tier ladder, below a real fix and above
  `@ts-expect-error`. ⚠️ And unlike `@ts-expect-error`, an assertion **never
  self-cleans**: there is no `TS2578` equivalent to tell you it became unnecessary.
- **← [09 · Excess property checks](../09-excess-property-checks/README.md)** — `as`
  is the most misleading of the seven ways freshness is lost, because it *looks
  like* added safety and is precisely what disables the check.
- **← [10 · The error codes](../10-the-error-codes/README.md)** — `TS2352` in its
  ladder context.
- **← [11 · typescript-eslint](../11-typescript-eslint/09-the-five-that-share-a-prefix.md)**
  — `no-unsafe-type-assertion` is named there and owned here; and
  [chunk 08](../11-typescript-eslint/08-the-rules-that-track-any.md) records the
  worst outcome of a `no-unsafe-*` report: silencing it with an `as`, which converts
  a **detected** unknown into an **undetected** wrong assumption.
- **← [Phase 4 · `readonly` and `!:`](../../phase-4-classes-declarations/08-readonly-and-definite-assignment.md)**
  — one is a guarantee the compiler enforces, the other a waiver that asserts
  nothing. Chunk 03 takes the general rule; that page owns the class-field case.

---

← [Phase 10 index](../README.md) · Start → [01 · Three ways to make a claim](./01-three-ways-to-make-a-claim.md)
