---
title: "The error codes you will actually meet"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the compiler's own diagnostic table and the
> checker functions that choose between its messages** — the **TypeScript 5.9.3**
> build in `sandbox/ts-p0/node_modules/typescript5/`, cross-checked against the
> string table in the **7.0.2** native binary. Named functions read rather than
> inferred: `reportNonexistentProperty`, `getCannotFindNameDiagnosticForName`,
> `checkAndReportErrorForMissingPrefix`, `checkNonNullTypeWithReporter`,
> `reportObjectPossiblyNullOrUndefinedError`, `tryGiveBetterPrimaryError`,
> `errorAndMaybeSuggestAwait`, `getSpellingSuggestion`, `levenshteinWithMax`,
> `checkDeprecations`, and the element-access branch of `getIndexedAccessType`.
> **No sandbox, no console block** — every claim here comes from files on disk.

The syllabus names nine codes — `2322`, `2345`, `2339`, `2367`, `2551`, `7053`,
`18046`, `18048`, `2589` — and asks what each one really means. It turns out that
several of them do not mean what they say.

> 🔴 **The four claims this topic is built on:**
>
> **1. The generic message is always the last rung of a ladder.** Three
> independent ladders in the checker — property lookup, name lookup, element
> access — try five or six *specific* diagnoses first. So a bare `TS2339` is a
> stronger statement than a specific one: it means a static member, a missing
> `await`, a `lib` gap, a typo and a missing DOM library have all been ruled out.
>
> **2. Several pairs of codes are one check reported twice.** `TS18048` and
> `TS2532` differ only in whether the compiler could print the expression's name —
> and the anonymous form is a diagnosis in itself, because a nameless expression
> cannot be narrowed in place.
>
> **3. Three of the nine are not type errors at all.** `TS7053` is
> `noImplicitAny` refusing to insert an implicit `any`. `TS2589` is a resource
> limit. `TS2367` is a rewording of `TS2365` for four operators, and its most
> common cause is a forgotten `await`.
>
> **4. The number is stable and the sentence is not.** Search by code. This corpus
> has already caught `TS5096` being reworded between two releases.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What a code is](./01-what-a-code-is.md) | The whole code space **counted** — 2,073 diagnostics in 13 ranges, of which **242 are quick-fix menu labels**; what each range tells you before you read a word; 🔴 TypeScript has **no warning level**; and the **Suggestion twins** at 7043–7050 that mean `noImplicitAny: false` *demotes* a finding rather than removing it |
| 02 | [The shape is wrong](./02-the-shape-is-wrong.md) | `TS2322` and `TS2345` as one check in two positions, and the **15 elaboration codes** beneath them — which to skim for, and why `TS2328` is the only place the compiler states contravariance out loud |
| 03 | [One name, two types](./03-two-types-with-one-name.md) | 🔴 `TS2719`, the second line that makes *"Type 'X' is not assignable to type 'X'"* readable — **a lockfile problem, not a type problem**; the missing-property **count as the diagnosis**; and `TS2352` quoting its own workaround |
| 04 | [Arity and overloads](./04-the-call-site-family.md) | The related line that **names the missing argument** and why it gets skimmed past; `TS2772` making "match on arity first" mechanical; and 🔴 `TS2793`, which means the **overload list** is wrong, not your call |
| 05 | [Callable or not](./05-callable-or-not.md) | **Seven** dedicated codes for parentheses; `TS2774` as a real bug class (a method in an `if` is always truthy); `TS2347` as one of the few places `any` errors instead of spreading |
| 06 | [The name is wrong](./06-the-name-is-wrong.md) | 🔴 **The seven-step property ladder**, read from the checker — and therefore what a bare `TS2339` actually asserts |
| 07 | [Cannot find name](./07-cannot-find-name.md) | 🔴 The hardcoded list of globals the compiler prints **install commands** for — and why every one exists twice, which is the most misunderstood thing about `types` |
| 08 | [The spelling budget](./08-the-spelling-budget.md) | 🔴 The exact **weighted** edit distance — substitution costs **2**, a case change **0.1** — so the cliff is at **five characters**: `obj.nmae` gets no suggestion and `lenght` does |
| 09 | [The index codes](./09-the-index-codes.md) | `TS7053` as a **wrapper** whose inner code is the fork in the fix, and the whole ladder gated inside `if (noImplicitAny)` |
| 10 | [You have not proved it](./10-you-have-not-proved-it.md) | 🔴 The named-versus-anonymous selector, exactly — and the one place the extract-to-a-`const` trick provably cannot help |
| 11 | [The condition is decided](./11-the-condition-is-decided.md) | `TS2367` plus **six siblings**, including one that explains reference equality; and why a `TS2367` after an `as` is the **assertion** being wrong |
| 12 | [Out of room](./12-out-of-room.md) | 🔴 The limits as constants — depth **100**, count **5,000,000**, **reset per expression** — which is why "the project got too big" is never the cause |
| 13 | [The suppress codes are gone](./13-the-suppress-codes-are-gone.md) | 🔴 **A correction to three pages in this phase**, plus the methodological limit it exposed: the option table is not authoritative about whether a flag still works |
| 14 | [A lookup routine](./14-a-lookup-routine.md) | The four questions for a code you have never seen, and the five sight-reads that need no lookup |

## What this topic deliberately does not repeat

- **How to read a long error** — bottom-up, property path first — belongs to
  [topic 04](../04-reading-a-typescript-error.md). This topic assumes it and owns
  what the codes *mean*.
- **Why excess-property checking applies to literals only** is
  [topic 09](../09-excess-property-checks/README.md)'s subject; `TS2353` and
  `TS2561` are named here only in passing.
- **The suppression ladder** is [topic 08](../08-suppression-directives/README.md).
  Chunk 13 corrects one rung of it rather than restating it.
- **`Object.keys` returning `string[]`**, method bivariance and the other
  deliberate soundness holes are [topic 07](../07-unsound-by-design/README.md)'s.

## Phase gate

You are done with this topic when, shown an error code you have never seen, you
can **place it from its range and the specificity of its message** without looking
it up — and when the five sight-reads in
[chunk 14](./14-a-lookup-routine.md) are automatic.

The tell that it has not landed: reaching for `as` on a `TS2367`, or for
`@ts-ignore` on a `TS2589`. The first compounds an earlier wrong assertion; the
second keeps paying the compile cost while removing the only signal explaining it.

## Where this connects

- **← [04 · Reading a TypeScript error](../04-reading-a-typescript-error.md)** —
  the reading method these codes are read with, and the page that deferred
  *"why `TS2353` fires for object literals only"*.
- **← [01 · `strict` flag by flag](../01-strict-flag-by-flag/README.md)** —
  `strictNullChecks` produces the 18046–18049 family and `noImplicitAny` produces
  every 7xxx code, so most of this topic is downstream of two of those nine flags.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** —
  the flag that adds `| undefined` to the index accesses
  [chunk 09](./09-the-index-codes.md) teaches you to type properly.
- **← [03 · Containing `any`](../03-containing-any.md)** — corrected here about
  `suppressImplicitAnyIndexErrors`; `TS7053` and `TS2347` are the two codes that
  make an incoming `any` visible.
- **← [06 · The other correctness flags](../06-the-other-correctness-flags/03-control-flow-flags.md)**
  — which found the same three-state error/suggestion/silent mechanism that
  [chunk 01](./01-what-a-code-is.md) explains the machinery for.
- **← [07 · Unsound by design](../07-unsound-by-design/01-what-unsound-means.md)** —
  [chunk 11](./11-the-condition-is-decided.md) is its most concrete consequence: an
  unsound assertion producing a confusing error somewhere else entirely.
- **← [08 · Suppression directives](../08-suppression-directives/03-the-suppression-tiers.md)**
  — corrected here about the two `suppress*` options.
- **← [09 · Excess property checks](../09-excess-property-checks/README.md)** —
  `TS2561`'s suggestion runs on the same budget
  [chunk 08](./08-the-spelling-budget.md) measures.
- **← [Phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)**
  — the `Error.isError` case, which is `TS2550`'s ladder rung failing to fire.
- **→ 11 · typescript-eslint type-aware rules** *(not written yet)* — ⚠️ constrained
  by [chunk 11](./11-the-condition-is-decided.md): `TS2872`/`TS2873` mean the
  compiler already does a slice of `no-unnecessary-condition`, so that page must
  claim only the leftover.
- **→ 12 · Assertion discipline** *(not written yet)* — where "which of the two
  types is wrong?" becomes a policy. Chunks 03, 11 and 12 each end by pointing
  here.

---

← [Phase 10 index](../README.md) · Start → [01 · What a code is](./01-what-a-code-is.md)
