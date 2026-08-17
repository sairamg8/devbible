---
title: "Declaration emit"
sidebar_label: "11 · Declaration emit"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`) — the 4xxx messages are quoted **verbatim**, and the family
> counts below are grep-measured from it — and the `tsconfig` reference.
> ⚠️ **The size of the 4xxx range belongs to
> [phase 10 · 10](../phase-10-strictness/10-the-error-codes/01-what-a-code-is.md)'s
> code-space census** and is linked rather than restated. **`isolatedDeclarations`
> is [phase 6 · 15](../phase-6-modules-build/15-isolateddeclarations/README.md)'s**,
> **publishing is [phase 6 · 11](../phase-6-modules-build/11-publishing-a-typed-package/README.md)'s**,
> and **why declaration emit cannot be fast is
> [topic 03 · chunk 01](./03-build-pipelines/01-four-jobs-not-one.md)'s.**
> **No timing figure is ours. No console block.**

Three other pages own most of what surrounds declaration emit. **What is left, and
what belongs in a phase about build systems, is this:**

> 🔴 **There is an entire class of error that `--noEmit` can never produce.** The
> 4xxx range exists only in the declaration-emit path — so **your gate can be green
> and your declaration build can fail**, on the same commit, with no contradiction.

## 🔴 They are all one problem: the compiler cannot write the type down

Grep the 4xxx range and the messages sort themselves into three phrasings —
**46** of them say *"private name"*, **15** say *"cannot be named"*, and the rest
say *"from private module"*:

> `TS4016` · *"Type parameter '{0}' of exported function has or is using private
> name '{1}'."*
> `TS4023` · *"Exported variable '{0}' has or is using name '{1}' from external
> module {2} but **cannot be named**."*
> `TS4024` · *"Exported variable '{0}' has or is using name '{1}' from **private
> module** '{2}'."*

**All three are the same complaint.** To write a `.d.ts`, the compiler must produce
a **name** for every type in your public surface. Inside your own source it never
needs one — an inferred type is just a type. **In a declaration file it has to be
written down, and if the thing it refers to is not exported, or has no expressible
name at that position, there is nothing to write.**

📌 **That is why the family is invisible to `--noEmit`:** the question *"can this be
named?"* is never asked when nothing is being emitted.

## The consequence for a pipeline

⚠️ **A library whose gate is `tsc --noEmit` is not checking the thing it ships.**
[Topic 03 · chunk 02](./03-build-pipelines/02-the-two-shapes.md) argued that a
library's declaration build already type-checks, so the separate `--noEmit` is
usually redundant. **This is the sharper version of the same point:** the two are
not merely overlapping, **the declaration build checks strictly more** — and the
extra part is exactly the part your consumers depend on.

> 🔴 **So for a library, the declaration build is the gate. Not an additional step
> after it.**

## The fixes, and they are all the same fix

**Export the thing, or name it.**

| The message says | What to do |
|---|---|
| *using private name `X`* | **export `X`** — it is part of your public surface whether you meant it or not |
| *from private module* | export it from a module consumers can reach |
| 🔴 *cannot be named* | **annotate explicitly** — give the compiler a name to write |

🔴 **The last row is the one worth internalising: an explicit annotation is not a
style choice there, it is the fix.** The compiler is telling you it inferred a type
it cannot express, and an annotation replaces inference with something writable.

📌 **This is the same lever as
[topic 06 · chunk 02](./06-diagnosing-a-slow-compile/02-the-shapes-that-are-slow.md)'s
performance advice** — annotate exported boundaries — arriving from a completely
different direction. **And it is the requirement `isolatedDeclarations` turns into a
rule**, which is why that flag makes declaration emit both cheaper and less
surprising ([phase 6 · 15](../phase-6-modules-build/15-isolateddeclarations/README.md)).

## Gotchas

**Symptom:** CI is green and the release build fails with a 4xxx error.
**Cause:** the gate runs `--noEmit`, and 4xxx exists only in the emit path.
**Fix:** 🔴 for a library, make the declaration build the gate. The check you were
running was a subset of the one that matters.

**Symptom:** a 4xxx error on code that compiles fine for a colleague.
**Cause:** you have `declaration: true` and they do not.
**Fix:** align the configs. ⚠️ It is not a difference of opinion about strictness —
it is a different *job* being run.

**Symptom:** *"has or is using private name"* on a type you consider internal.
**Cause:** it is reachable from your public surface, so it is not internal.
**Fix:** export it, or stop exposing it. 📌 The error is a **design finding**: your
public API is larger than you thought.

**Symptom:** *"cannot be named"* and nothing looks private.
**Cause:** the inferred type has no expressible name at that position — an anonymous
type from another module, or a construct with no writable form.
**Fix:** annotate explicitly. 🔴 This is the case where an annotation is the fix
rather than a preference.

**Symptom:** the errors appear in a wave after enabling `declaration` on an existing
project.
**Cause:** none of them were ever reachable before.
**Fix:** expected, and they are real. Treat it as the baseline problem from
[topic 01 · chunk 05](./01-type-checking-in-ci/05-when-the-gate-fails.md) rather
than as a reason to turn `declaration` back off.

**Symptom:** the same class of error keeps coming back on new code.
**Cause:** nothing enforces the annotations that prevent it.
**Fix:** `isolatedDeclarations` makes the requirement a rule instead of a
discovery — phase 6 · 15.

## Interview questions

**Can `tsc --noEmit` be green while the declaration build fails?**
Yes, and it is a whole class of error rather than an edge case. The 4xxx range
exists only in the declaration-emit path, because the question it asks — *can this
type be written down?* — is never asked when nothing is emitted.

**What do all the 4xxx errors have in common?**
They are one problem in three phrasings — *"private name"*, *"from private module"*,
*"cannot be named"*. To emit a `.d.ts` the compiler must produce a name for every
type in your public surface; inside your own source an inferred type never needs
one. If the referenced type is not exported, or has no expressible name at that
position, there is nothing to write.

**What does that mean for a library's CI?**
That the declaration build should be the gate, not a step after it. It checks
strictly more than `--noEmit` does, and the extra part is precisely what consumers
depend on — so a library gating on `--noEmit` is not checking the thing it ships.

**How do you fix "has or is using private name"?**
Export the referenced type. The error is really a design finding: the type is
reachable from your public surface, so it is part of your API whether you intended
it or not. The alternative is to stop exposing it.

**And "cannot be named"?**
Annotate explicitly. The compiler inferred a type it has no way to write at that
position, so an annotation replaces the inference with something expressible. It is
the case where an explicit type is the fix rather than a stylistic preference — and
it is the same advice the performance topic gives about annotating exported
boundaries, arriving from the opposite direction.

**Why does `isolatedDeclarations` help here as well as with speed?**
Because it turns the annotation requirement into a rule enforced as you write,
rather than something discovered when the declaration build runs. That removes both
the recurring surprise and the inference that made the emit expensive.

---

← [10 · Monorepo orchestration](./10-monorepo-orchestration.md) · [Phase 12 index](./README.md)
