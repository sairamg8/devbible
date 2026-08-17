---
title: "Where the gate goes"
sidebar_label: "03 · Where the gate goes"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** and the **TypeScript
> handbook**. ⚠️ **The CI cost of type-aware linting is not re-argued here** — it is
> settled in
> [phase 10 · 11 · chunk 10](../../phase-10-strictness/11-typescript-eslint/10-adoption-and-ci-cost.md)
> and linked. **No timing figure here is ours. No console block.**

The check exists ([chunk 01](./01-the-green-build-that-proves-nothing.md)) and you
know what it covers ([chunk 02](./02-what-the-gate-guarantees.md)). **Where it runs
decides whether it is a gate or a notification.**

## The four positions, and what each is good for

| Position | Catches | Cost | Verdict |
|---|---|---|---|
| **pre-commit hook** | your own errors, before they leave the machine | ⚠️ a **whole-program** run on every commit | 🔴 **wrong place** — see below |
| **pull request check** | everything on the branch | one run per push | ✅ **the default, and it must block** |
| 🔴 **merge queue / up-to-date branch** | **semantic conflicts between two green PRs** | another run per merge | ✅ the one people skip and then need |
| nightly / scheduled | expensive extra configs, the slow whole-monorepo pass | off the critical path | useful supplement, never the gate |

## 🔴 Why pre-commit is the wrong place

The instinct is right — catch it early — and the mechanism does not cooperate:

- **It cannot be scoped to the staged files.** Type checking is whole-program, so
  "check only what changed" does not reduce the work. This is the same limitation
  [phase 10 · 11 · chunk 10](../../phase-10-strictness/11-typescript-eslint/10-adoption-and-ci-cost.md)
  documents for type-aware lint, and for the same reason: the program has to be
  built before any of it can be checked.
- **It runs on every commit**, including the six small ones on a work-in-progress
  branch, and a check that makes committing unpleasant gets bypassed.
- ⚠️ **It is skippable.** `--no-verify` exists, and a check that can be skipped by
  the person it is checking is not a gate.

📌 **Put the seconds-long checks in the hook** — formatting, the syntactic lint
config — and the whole-program check in CI. **The hook's job is to stop noise from
entering review; the gate's job is to stop errors from entering the branch.**

## 🔴 The merge queue catches what the PR check cannot

Two pull requests, each green on its own:

```
PR #1  renames  User.name  →  User.fullName
PR #2  adds     user.name  in a new file
```

**Git merges both without a conflict** — they touch different files. **The types
break on `main`, and neither PR was ever wrong.**

🔴 **A type error is the classic semantic merge conflict**, and it is precisely the
class that textual merging cannot see. The PR check ran against a base commit that
no longer exists once the other branch lands.

**The fix is one of two settings, both cheap:** require branches to be up to date
before merging, or use a merge queue that re-runs the check against the merged
result. ⚠️ **The first is simpler and gets disabled on busy repositories** because
it forces serial merges; the second is what busy repositories end up needing.

📌 **Symptom that this is missing: `main` breaks a few times a week and no
individual pull request was at fault.** Teams tend to read that as flakiness. It is
not — it is a missing check on the merged state.

## The order inside the job

**Fail fast, but on the most interpretable failure:**

1. **Format and syntactic lint** — seconds, and their failures are unambiguous.
2. 🔴 **`tsc --noEmit`** — before the tests.
3. **Tests.**
4. Build.

⚠️ **Step 2 goes before step 3 deliberately.** A type error makes test failures
*uninterpretable* — you get a wall of red that is one cause wearing many costumes,
and someone spends twenty minutes reading assertion diffs before noticing the
compile error above them.

📌 **Parallel jobs are the alternative and they trade differently:** all failures
reported at once (better feedback) against paying for every job even when the first
would have failed (more machine time). It is the same trade
[phase 10 · 11 · chunk 10](../../phase-10-strictness/11-typescript-eslint/10-adoption-and-ci-cost.md)
draws for lint and `tsc` — **and if you are running type-aware lint as well, note
that you are already paying for two whole-program builds**, which is the first thing
to look at before adding a third.

## What the gate blocks, and what it does not

> **It blocks the merge. It does not block the deploy — because by deploy time the
> check has already happened.**

⚠️ **A deploy pipeline that re-checks is doing the work twice.** Build the artefact
once, check it once, and promote the artefact. Re-running `tsc` against a
release tag proves the same thing again, more slowly, at the worst moment to
discover anything.

📌 **The exception worth allowing: a release build from a long-lived branch** that
has not seen the gate, where re-checking is not duplication but the first check.

## 🔴 It must be one command, runnable locally

```json
{ "scripts": { "typecheck": "tsc --noEmit" } }
```

**CI runs `npm run typecheck` and so does a developer.** A gate that only exists as
five lines of YAML has three failure modes: nobody can reproduce a failure without
pushing, the local and CI invocations drift apart, and the flags that matter are
invisible to everyone who does not read the workflow file.

⚠️ **And this is where the editor–CI disagreements bite**
([phase 0 · 09](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)) —
a shared script at least makes the *command* identical, leaving only the compiler
version and the file set to differ.

## Gotchas

**Symptom:** the pre-commit hook takes 40 seconds and people use `--no-verify`.
**Cause:** a whole-program check on every commit.
**Fix:** move it to CI and leave the fast checks in the hook. 🔴 A check people
route around is worse than none, because it looks like coverage.

**Symptom:** `main` breaks a few times a week and no individual PR was wrong.
**Cause:** semantic merge conflicts — each PR was green against a base that no
longer exists.
**Fix:** require up-to-date branches or use a merge queue. ⚠️ This gets diagnosed as
CI flakiness more often than as the missing check it is.

**Symptom:** a wall of failing tests that turn out to have one cause.
**Cause:** the type check ran after the tests, or not in that job at all.
**Fix:** type-check first. The failure you want reported is the one that explains
the others.

**Symptom:** CI time doubled after adding type-aware lint, and adding `tsc` made it
worse again.
**Cause:** you are now building the program two or three times.
**Fix:** phase 10 · 11 · chunk 10 has the arithmetic and the levers. ⚠️ The answer is
not to drop `tsc` — lint reports rule violations, not type errors.

**Symptom:** a developer cannot reproduce the CI type failure locally.
**Cause:** the CI invocation differs from whatever they ran — different flags,
different config, different compiler version.
**Fix:** one `typecheck` script used by both. It removes one of the three variables
immediately.

**Symptom:** the deploy pipeline re-runs `tsc` and occasionally fails there.
**Cause:** it is checking again, at the worst possible moment.
**Fix:** check once, promote the artefact. ⚠️ If the deploy check *does* find
something, that is a signal your merge gate is not covering the branch being
released — fix that, rather than keeping the late check.

**Symptom:** the gate is a required status check and errors still reach `main`.
**Cause:** it passed against a stale base, or it was not marked required, or it
exited zero without running ([chunk 02](./02-what-the-gate-guarantees.md)).
**Fix:** in that order — the first is the most common and the least suspected.

## Interview questions

**Where should the type check run?**
As a required pull request check, and again against the merged state — either by
requiring up-to-date branches or through a merge queue. Not in a pre-commit hook: it
is a whole-program check, so it cannot be scoped to the staged files, it runs on
every work-in-progress commit, and `--no-verify` makes it optional for exactly the
person it is meant to check.

**Why is a merge queue relevant to type checking specifically?**
Because a type error is the classic semantic merge conflict. One PR renames a field
and another adds a use of the old name; the files do not overlap, git merges
cleanly, and the types break on `main` with neither branch having been wrong. The
PR check validated a base commit that no longer exists.

**Where in the job does it belong relative to the tests?**
Before them. A type error makes test failures uninterpretable — one cause produces a
wall of unrelated-looking assertion failures, and people read the diffs for twenty
minutes before scrolling up. Format and syntactic lint go first because they take
seconds and their failures are unambiguous.

**Should the deploy pipeline type-check?**
No, if the merge gate covered the commit being deployed — it is the same check,
slower, at the worst moment to discover anything. Build once, check once, promote
the artefact. The exception is a release from a long-lived branch the gate never
saw, where it is not a duplicate but the first check.

**Why does it matter that the check is a package script?**
Because a gate that exists only in a workflow file cannot be reproduced locally, and
its flags are invisible to anyone who does not read the YAML. One `typecheck`
script means CI and the developer run the same command, which removes one of the
three variables when the editor, the developer and CI disagree.

**Your CI already runs type-aware lint. Do you still need `tsc --noEmit`?**
Yes. They report different things — the linter reports rule violations, and a type
error surfaces there as noise or as a cascade rather than as a diagnostic on the
right line. What you *should* do is notice that you are now paying for two
whole-program builds and decide about that deliberately, which is the arithmetic
phase 10 · 11 · chunk 10 sets out.

---

← [02 · What the gate guarantees](./02-what-the-gate-guarantees.md) · [Topic index](./README.md) · Next → **04 · Making it fast enough to be required** *(not written yet)*
