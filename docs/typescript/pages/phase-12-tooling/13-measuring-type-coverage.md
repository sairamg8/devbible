---
title: "Measuring type coverage"
sidebar_label: "13 · Measuring type coverage"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **`type-coverage`** tool documentation for what the
> number counts, and the **TypeScript handbook** for `any` and `unknown`.
> ⚠️ **The tool is not installed in this repository**, so its behaviour is
> documentation-attributed. The assertion-counting policy is
> [phase 10 · 12 · chunk 05](../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)'s
> and the `no-unsafe-*` argument is
> [phase 10 · 11 · chunk 08](../phase-10-strictness/11-typescript-eslint/08-the-rules-that-track-any.md)'s.
> **No sandbox run, no console block.**

The syllabus row is *"what the number means and what it does not"*, and the second
half is the larger one.

## What it counts

**The proportion of expressions in your program whose type is not `any`.** That is
the whole definition, and two consequences follow immediately:

- 🔴 **It counts expressions, not files or lines.** So one `any` at a busy boundary
  moves the number more than a hundred in a leaf module — which is *correct*, and
  is the property that makes it better than counting `any` declarations
  ([phase 10 · 11 · chunk 08](../phase-10-strictness/11-typescript-eslint/08-the-rules-that-track-any.md)
  makes the same argument about contagion).
- ⚠️ **`unknown` counts as covered**, because it is not `any`. **Which is right** —
  `unknown` is a type that forces a question rather than one that suppresses it —
  **but it means the metric rewards a migration to `unknown` that has not yet done
  the narrowing.** That is still progress; it is just not finished.

## 🔴 What the number does not mean

| It does not mean | Because |
|---|---|
| your types are **correct** | a wrong type is fully covered |
| your types are **precise** | `string` where you meant a union is covered |
| the code is **safe** | 🔴 **an `as` produces a covered expression** |
| your **boundaries** are validated | asserted external data is covered |

🔴 **The third row is the one that makes an unexamined coverage target actively
harmful.** The cheapest way to raise the number is to replace `any` with an
assertion — and that is precisely the move
[phase 10 · 12 · chunk 04](../phase-10-strictness/12-assertion-discipline/04-as-any-is-an-exit.md)
calls the worst available outcome: **it converts a *detected* unknown into an
*undetected* wrong assumption.**

> ⚠️ **So a coverage target, set alone, pays people to make the codebase worse in a
> way the metric cannot see.**

## The pairing that fixes it

**Never report coverage without the assertion count beside it.**

| Coverage ↑, assertions → | ✅ real improvement |
|---|---|
| Coverage ↑, **assertions ↑** | 🔴 **the number was bought, not earned** |
| Coverage →, assertions ↓ | ✅ also real — the same knowledge, less unchecked |

📌 **This is [phase 10 · 12 · chunk 05](../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)'s
gaming argument in a second place**, and the repetition is the point: **any single
metric over a type system is satisfiable by moving the problem to whatever is not
being counted.** Two numbers that move in opposite directions under gaming are much
harder to fake than either alone.

## Where it is genuinely useful

- 🔴 **As a direction, not a target.** *"It went down this quarter"* is a real
  finding; *"we must reach 95%"* is an invitation to assert.
- **On a migration**, where the absolute number is meaningless and the slope is
  exactly what you want to know.
- 🔴 **Per directory**, which is where it stops being a vanity figure: a boundary
  module at 70% is a finding, while a repository at 94% is a number.
- **As a ratchet** — it does not decrease — which is the same shape that works for
  assertions and for the error baseline
  ([topic 01 · chunk 05](./01-type-checking-in-ci/05-when-the-gate-fails.md)).

⚠️ **And the honest caveat: the number is largely a function of your dependencies**,
like [`skipLibCheck`'s saving](./08-skiplibcheck-as-a-performance-lever.md). A
project consuming untyped packages starts lower through no fault of its own, so
**comparing two projects' coverage figures tells you almost nothing.**

## Gotchas

**Symptom:** coverage rose sharply in one sprint.
**Cause:** most often assertions, not typing.
**Fix:** 🔴 look at the assertion count for the same period. A number that improved
while `as` grew was bought.

**Symptom:** a team set a coverage target and the codebase feels worse.
**Cause:** the cheapest way to hit the target is `as`, which converts a detected
unknown into an undetected assumption.
**Fix:** pair the metric, or drop the target and watch the direction instead.

**Symptom:** coverage looks fine and a boundary keeps producing runtime errors.
**Cause:** asserted external data is fully covered.
**Fix:** ⚠️ coverage says nothing about whether anything was *validated* — that is
[phase 10 · 13](../phase-10-strictness/13-unknown-first-apis.md)'s question.

**Symptom:** the number is lower than a comparable project's.
**Cause:** largely your dependencies.
**Fix:** compare against your own past, not another repository. 📌 Cross-project
comparison is the least meaningful use of this metric.

**Symptom:** migrating to `unknown` raised coverage and nothing else changed.
**Cause:** `unknown` is not `any`, so it counts as covered.
**Fix:** that is correct and it is real progress — but the narrowing is still owed,
and the metric will not remind you.

**Symptom:** a repository-wide figure that nobody acts on.
**Cause:** it is an average over things with very different importance.
**Fix:** report per directory. 🔴 A boundary module's figure is actionable in a way
the repository's average never is.

## Interview questions

**What does type coverage measure?**
The proportion of expressions whose type is not `any`. Expressions rather than files
is the important part: one `any` at a busy boundary moves the number more than many
in a leaf module, which is the right weighting and the reason it beats counting
`any` declarations.

**What does a high number not tell you?**
That the types are correct, precise, or validated. A wrong type is fully covered, so
is a type that is too wide, and so is anything produced by an assertion — which is
why the metric is blind to the single most common way of raising it.

**Why is a coverage target dangerous on its own?**
Because the cheapest way to hit it is to replace `any` with an assertion, which
converts a detected unknown into an undetected wrong assumption. The target then
pays people to make the codebase worse in a way the metric cannot see.

**How do you make it trustworthy?**
Report it beside the assertion count. Coverage up with assertions flat is real;
coverage up with assertions up was bought. It is the same gaming argument as
assertion policy, and the repetition is the lesson: any single metric over a type
system is satisfiable by moving the problem to whatever is not counted.

**Is `unknown` covered?**
Yes, because it is not `any` — and that is correct, since `unknown` forces a
question rather than suppressing one. But it does mean the metric rewards a
migration to `unknown` before the narrowing is done. Real progress, not finished
work.

**How would you actually use it?**
As a direction rather than a target, per directory rather than per repository, and
as a ratchet that does not decrease. A boundary module at 70% is a finding; a
repository at 94% is a number. And never compare against another project — the
figure is largely a function of your dependencies.

---

← [12 · Validating published types](./12-validating-published-types.md) · [Phase 12 index](./README.md)
