---
title: "The one-character claim nobody counts"
sidebar_label: "03 · The one-character claim"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`) — `TS1255`, `TS1263`, `TS1264` and `TS8013` are quoted
> **verbatim** — and against **typescript-eslint's** rule pages for
> `no-non-null-assertion`, `no-non-null-asserted-optional-chain`,
> `no-extra-non-null-assertion`, `no-non-null-asserted-nullish-coalescing` and
> `no-unnecessary-type-assertion`. ⚠️ typescript-eslint is not installed here, so
> those are documentation-attributed. Mechanism lives in
> [Phase 2 · 13](../../phase-2-narrowing/13-non-null-assertion.md); this page is
> about counting and reviewing. **No sandbox run, no console block.**

[Chunk 01](./01-three-ways-to-make-a-claim.md) established the measurement: the
compiler has **no diagnostic that questions a `!`**. This chunk is the consequence —
**`!` is the assertion a policy has to count first, and the one every team
undercounts.**

## 🔴 Why it goes uncounted

Six reasons, and they compound:

1. **It is one character**, so it does not read as a construct.
2. **It does not appear in an `as` audit.** Every "count the assertions" script
   greps for ` as `, and `!` is invisible to all of them.
3. ⚠️ **It cannot be grepped for directly** — `!` is also logical negation, `!=`,
   `!==` and part of `!!`. There is no regular expression that finds non-null
   assertions and nothing else. **It needs a type-aware tool or it does not get
   counted at all.**
4. **It hides inside expressions.** `a!.b.c!.d` carries two claims and reads as one
   line of property access.
5. **It arrives by quick-fix.** An editor offers it as the shortest resolution to
   `TS18048`, so it is often accepted rather than chosen.
6. **It never expires.** There is no `TS2578` equivalent
   ([topic 08](../08-suppression-directives/README.md)) — an assertion that has
   become unnecessary stays until someone removes it deliberately.

📌 **So the population grows monotonically and invisibly**, which is the exact
profile of a metric worth having.

## 🔴 Two shapes that contain their own refutation

The most valuable `!` reports are the ones where a single expression says both
things at once:

```ts
user?.profile!.email        // "might be absent" then "definitely present"
config.timeout! ?? 5000     // "definitely present" then "here is the fallback"
```

**Neither can be right.** In the first, `?.` exists precisely because `user` may be
nullish, and the `!` then asserts the result is not — so either the chain is
unnecessary or the assertion is a lie, and typescript-eslint has a dedicated rule
for exactly this (`no-non-null-asserted-optional-chain`). The second says a value is
definitely present and then supplies a default for its absence
(`no-non-null-asserted-nullish-coalescing`).

🔴 **These are worth more than an ordinary `!` report because they need no
judgement.** Most assertion reviews turn on whether the author knew something the
compiler did not; these two are self-contradictory on their face, and there are two
more of the same kind — `a!!` is `no-extra-non-null-assertion`, and an assertion
that does not change the type at all is `no-unnecessary-type-assertion`.

## The tool that actually counts them

Since grep cannot, the lint rules are the inventory:

| Rule | What it finds |
|---|---|
| `no-non-null-assertion` | **every** `!` — the raw count |
| `no-non-null-asserted-optional-chain` | `a?.b!` — the contradiction above |
| `no-non-null-asserted-nullish-coalescing` | `a! ?? b` — the other one |
| `no-extra-non-null-assertion` | `a!!` |
| 🔴 `no-unnecessary-type-assertion` | an assertion — `as` **or** `!` — that **does not change the type** |

🔴 **That last rule is the closest thing to the `TS2578` the compiler does not
have.** [Topic 08](../08-suppression-directives/README.md) established that
`@ts-expect-error` is the only construct in TypeScript that reports a problem which
has *stopped* existing, and that assertions have no equivalent. **They have no
*compiler* equivalent** — `no-unnecessary-type-assertion` fills the gap from the
lint side, and it is type-aware, so it costs what
[topic 11](../11-typescript-eslint/10-adoption-and-ci-cost.md) says type-aware rules
cost.

⚠️ **It is not a full replacement.** It reports an assertion that is *provably*
redundant against the current types; it cannot report one that is merely *wrong*.
An assertion that lies about data is invisible to it, exactly as it is to the
compiler.

## The `!:` sibling, and 🔴 what the compiler does police

The definite-assignment assertion is a different operator that shares the character
([phase 2 · 13](../../phase-2-narrowing/13-non-null-assertion.md) and
[phase 4 · 08](../../phase-4-classes-declarations/08-readonly-and-definite-assignment.md)
own it). What is worth adding here is the shape of the rules the compiler *does*
enforce around it, read from the table:

> `TS1255` · *"A definite assignment assertion '!' is not permitted in this
> context."*
> `TS1263` · *"Declarations with initializers cannot also have definite assignment
> assertions."*
> `TS1264` · *"Declarations with definite assignment assertions must also have type
> annotations."*

🔴 **Every one of those is about *form*, not about *truth*.** Where the operator may
appear, that it cannot be combined with an initialiser, that it requires an
annotation — the compiler is meticulous about the syntax of the claim and silent on
whether the claim holds. **That asymmetry is the whole topic in three diagnostics**,
and it is why the discipline has to come from outside the compiler.

📌 `TS1264` is the one with a practical consequence: **a `!:` declaration cannot be
inferred**, so writing one always costs you an explicit type. That is a small
friction pushing toward the alternatives, and it is the only pressure the language
applies.

## What to do instead, in one line each

Phase 2 gives the full argument; this is the review shorthand:

| Instead of | Write |
|---|---|
| `x!.y` after a check the compiler lost | restructure so the narrowing survives ([phase 2 · 11](../../phase-2-narrowing/11-narrowing-lost/README.md)) |
| `x!` because the value is set up elsewhere | pass it in, or make the type say so |
| `arr.find(...)!` | handle the `undefined` — this is the single most common `!` in any codebase |
| `!:` on a class field | constructor assignment, or a throwing getter that fails loudly |
| `x!` on a config value | validate at startup, once, and type the result |

## Gotchas

**Symptom:** the assertion count looks healthy and the codebase still feels
untyped.
**Cause:** the count came from a grep for ` as `, which cannot see `!`.
**Fix:** count with `no-non-null-assertion`. 🔴 The `!` population is usually the
larger of the two and is always the one nobody has measured.

**Symptom:** `user?.profile!.email` passes review.
**Cause:** it reads as ordinary defensive code.
**Fix:** it is self-contradictory — the `?.` says the value may be absent and the
`!` says it is not. Whichever half is wrong, delete that half.

**Symptom:** a `!` is added by accepting an editor quick-fix for `TS18048`.
**Cause:** it is offered as the shortest resolution.
**Fix:** treat quick-fix assertions as the least considered kind. The fix that
resolves an error in one keystroke is rarely the one that answers *why the value
could be undefined*.

**Symptom:** `arr.find(x => …)!` everywhere.
**Cause:** `find` returns `T | undefined` and the author is sure it will match.
**Fix:** ⚠️ this is the assertion most likely to be true today and false after a
data change, because "it is always in the list" is a fact about data, not about
types. Handle the miss, or use a lookup that cannot fail.

**Symptom:** removing a `!` produces no error, so it was pointless.
**Cause:** the value stopped being nullable at some point and nothing said so.
**Fix:** `no-unnecessary-type-assertion` finds these mechanically. 📌 Same shape as
topic 11's argument about `?.` outliving its nullability, and the same fix: delete
it, because it now *hides* the guarantee.

**Symptom:** `!:` on a field, and the field is sometimes genuinely unset.
**Cause:** the assertion asserts nothing — it only silences the initialisation
check.
**Fix:** phase 4's alternatives. And note `TS1264` forced you to write the type
annotation, which means the declaration *looks* more deliberate than it is.

**Symptom:** a policy bans `as any` and the team migrates to `!`.
**Cause:** the ban named one construct.
**Fix:** 🔴 the predictable outcome of banning a single spelling
([topic 08](../08-suppression-directives/README.md) documents the same escalation
for suppression comments). Count the family, not the keyword.

## Interview questions

**Why is `!` the assertion to count first?**
Because it has no compiler oversight at all — the diagnostic table contains nothing
that questions whether a `!` is justified — and because it is systematically
undercounted. It is one character, it does not show up in an `as` audit, and it
cannot be grepped for reliably since `!` is also negation and part of `!=` and
`!==`. A type-aware lint rule is the only way to get the number.

**What is wrong with `user?.profile!.email`?**
It contains its own refutation. The optional chain exists because `user` may be
nullish; the assertion then claims the result is not. One of the two is wrong, and
the expression does not say which. typescript-eslint has a dedicated rule for it,
which is a good indication of how often it appears.

**Is there anything like `TS2578` for assertions?**
Not in the compiler — that is the asymmetry topic 08 identifies, and it is why
`@ts-expect-error` is preferable to a suppression that never expires. From the lint
side, `no-unnecessary-type-assertion` reports an `as` or a `!` that does not change
the type, which covers the *provably redundant* case. It cannot report an assertion
that is simply wrong; nothing can.

**What does the compiler enforce about the definite-assignment `!:`?**
Only its form. `TS1255` restricts where it may appear, `TS1263` forbids combining it
with an initialiser, and `TS1264` requires a type annotation. All three are about
the syntax of the claim and none is about whether the claim is true — which is the
whole topic compressed into three diagnostics.

**Which single `!` is most likely to be wrong eventually?**
`arr.find(…)!`. It is usually true when written, because the author knows the value
is in the list — but that is a fact about the current data, not about the types, and
data changes. It is also the case where handling the `undefined` is cheapest, since
you are already in the code that will use the result.

**A team bans `as any`. What happens?**
They get more `!`, more `as unknown as T`, and more `@ts-ignore` — the same
escalation this phase documents for suppression comments. Banning one spelling
moves the population to the next tier rather than reducing it, which is why the
advice throughout is to count the whole family and review the count, rather than to
prohibit a keyword.

---

← [02 · What an `as` is standing in for](./02-what-an-as-is-standing-in-for.md) · [Topic index](./README.md) · Next → **04 · `as any`, and why it is a different thing** *(not written yet)*
