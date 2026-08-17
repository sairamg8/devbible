---
title: "Contributing to DefinitelyTyped"
sidebar_label: "15 · Contributing to DefinitelyTyped"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against **DefinitelyTyped's** contribution documentation and the
> **`@types` publishing model**, and the **TypeScript handbook** for declaration
> files. ⚠️ **Nothing here is installed or run** — this is a process topic, and
> every claim about the repository's workflow is documentation-attributed.
> **Authoring `.d.ts` is
> [phase 6 · 07](../phase-6-modules-build/07-authoring-d-ts-files/README.md)'s** and
> **typing an untyped dependency is
> [phase 6 · 08](../phase-6-modules-build/08-typing-an-untyped-dependency/README.md)'s**
> — this page owns only **when to go upstream, and what that costs.**
> **No console block.**

You have a dependency whose types are missing or wrong. **Phase 6 · 08 covers the
local fix.** This topic is the other branch: **when is it worth going upstream, and
which upstream?**

## 🔴 First: there are two upstreams, and they are not the same

| Where the types live | Fix it by |
|---|---|
| **In the package itself** (it ships its own `.d.ts`) | a PR to **that project** |
| **In `@types/x`** on DefinitelyTyped | a PR to **DefinitelyTyped** |

⚠️ **Check which before writing anything.** A fix sent to DefinitelyTyped for a
package that ships its own types will be closed — and the reverse wastes longer,
because a `@types` package can exist for a library that *also* now ships types, with
the `@types` copy stale and still being installed by someone's lockfile.

📌 **The version-matching rule follows from the model:** `@types/x` versions track
the library's major and minor, so a fix has to be made against the version line your
change applies to. **That is the part that most often needs redoing**, and it is
worth reading before starting rather than after review.

## When upstream is worth it

**The local shim in phase 6 · 08 is not a lesser option — for a lot of cases it is
the right one**, and going upstream is a decision with a cost:

| Go upstream when | Stay local when |
|---|---|
| the types are **wrong**, not just incomplete for you | you need **one member** of a large surface |
| others will hit it — a **popular** package | the package is internal or niche |
| you can express the fix **generally** | your fix encodes *your* usage |
| 🔴 you can accept **latency** — review takes as long as it takes | 🔴 **you need it today** |

🔴 **The honest sequencing, and it is not either/or: ship the local shim, then send
the PR.** The shim unblocks you now; the PR removes the shim later. **Treating them
as alternatives is what makes people skip the PR** — they are already unblocked and
the incentive evaporates.

📌 **Which is the argument for opening it the same day**, while the fix and the
reasoning are still in your head.

## What a good contribution looks like

- 🔴 **A test that fails before your change.** DefinitelyTyped keeps type tests
  beside declarations, and this is
  [topic 04](./04-testing-types/README.md)'s rejection argument applied upstream:
  **a declaration change with no test can be undone by the next contributor with no
  signal.**
- **A minimal diff.** Reviewers are volunteers, and a fix that also reformats or
  restructures is a fix that waits longer.
- **The version line stated**, per the matching rule above.
- ⚠️ **Nothing invented.** If the library's runtime behaviour is unclear, say so in
  the PR rather than declaring a type that reads plausibly. **A wrong declaration is
  worse than a missing one**, because it is trusted — the same argument
  [phase 10 · 12](../phase-10-strictness/12-assertion-discipline/README.md) makes
  about assertions, at ecosystem scale.

## 🔴 The thing worth internalising

> **`@types` packages are a community-maintained layer over libraries that did not
> ship types. Everything you have learned about assertion discipline applies to
> them — with the difference that you are asserting on everyone else's behalf.**

⚠️ **So an `any` you leave in a declaration file is an `any` in every consumer's
program**, and it arrives as *inherited* `any`, the kind
[phase 10 · 11 · chunk 08](../phase-10-strictness/11-typescript-eslint/08-the-rules-that-track-any.md)
identifies as the only kind the compiler cannot report. **That is the strongest
reason to be careful in a `.d.ts` you contribute** and the least obvious one.

📌 **And it is the reason a package shipping its own types is better than a `@types`
package**: the declarations live with the implementation, so they change together.
**Where you can, the best contribution is helping a library ship its own.**

## Gotchas

**Symptom:** a DefinitelyTyped PR is closed as out of scope.
**Cause:** the package ships its own types.
**Fix:** 🔴 check which upstream owns the declarations before writing anything. It
is one look at the package and it saves the whole round trip.

**Symptom:** the fix is correct and review asks for a different version line.
**Cause:** `@types` versions track the library's major and minor.
**Fix:** read the version-matching rule first. 📌 This is the most common cause of
rework on an otherwise good contribution.

**Symptom:** a shim was written locally and the upstream PR never happened.
**Cause:** the shim removed the incentive.
**Fix:** open the PR the same day, while the reasoning is still in your head. ⚠️ They
are sequential, not alternatives.

**Symptom:** a declaration change was reverted by a later contributor.
**Cause:** there was no test expressing what it fixed.
**Fix:** 🔴 add a type test. A declaration with no test can be undone with no signal
— topic 04's argument, upstream.

**Symptom:** a contributed declaration uses `any` for a parameter that was hard to
type.
**Cause:** it was the quickest way to make it compile.
**Fix:** ⚠️ that `any` is now in every consumer's program as **inherited** `any` —
the kind nothing in the compiler reports. `unknown` with a documented gap is more
honest than a plausible lie.

**Symptom:** the PR sat unreviewed for weeks.
**Cause:** volunteer review, plus possibly a large diff.
**Fix:** minimal diffs, and plan around the latency. If you needed it this week, the
local shim was always the right first move.

## Interview questions

**A dependency's types are wrong. What do you do?**
Fix it locally first so you are unblocked — that is phase 6 · 08 — and then send the
fix upstream the same day, while the reasoning is fresh. They are sequential rather
than alternatives, and the common failure is that the shim removes the incentive to
do the second half.

**Which upstream?**
Depends on where the declarations live: a package that ships its own types takes a
PR to that project, and only a package typed through `@types` takes one to
DefinitelyTyped. Checking first costs one look and saves a round trip, and it is a
real ambiguity because a stale `@types` package can coexist with a library that has
since started shipping its own.

**What makes a contribution likely to land?**
A test that fails before the change, a minimal diff, and the right version line —
`@types` versions track the library's major and minor. The test matters most, and
for the same reason type tests matter anywhere: a declaration change with no test
can be silently undone by the next contributor.

**Why be especially careful with `any` in a contributed declaration?**
Because it becomes inherited `any` in every consumer's program — the kind the
compiler structurally cannot report, since using an `any` is not an error. You are
making an assertion on everyone else's behalf, so `unknown` with a documented gap is
more honest than a type that merely reads plausibly.

**When is going upstream not worth it?**
When you need one member of a large surface, when the package is internal or niche,
when your fix encodes your own usage rather than a general truth, or when you need
it today — review latency is real and unpredictable. A local shim is a legitimate
end state, not a failure to contribute.

**What is better than a good `@types` contribution?**
Helping the library ship its own types, so the declarations live beside the
implementation and change with it. A `@types` package is a community layer over a
gap; closing the gap is worth more than maintaining the layer.

---

← [14 · AST tooling after TS 7](./14-ast-tooling-after-ts7.md) · [Phase 12 index](./README.md)
