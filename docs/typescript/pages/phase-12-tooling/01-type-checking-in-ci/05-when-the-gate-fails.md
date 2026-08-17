---
title: "When the gate fails"
sidebar_label: "05 · When the gate fails"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** and the **TypeScript
> handbook**. The suppression ladder and the *count, do not ban* argument are
> [phase 10 · 08](../../phase-10-strictness/08-suppression-directives/README.md)'s
> and [phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)'s,
> **linked rather than restated**. ⚠️ **No timing figure here is ours. No console
> block.**

Two situations, and they are not the same problem:

1. **The gate is red on a pull request.** Normal. It worked.
2. 🔴 **You want to *introduce* the gate on a codebase that has never had one, and
   the first run reports four hundred errors.** This is the situation that decides
   whether the gate ever becomes required — and getting it wrong is how a team ends
   up with a permanently advisory check.

## 🔴 Advisory is not a halfway house — it is the failure mode

The reasonable-sounding plan: *turn it on non-blocking, fix errors as we go, make it
required later.* It reliably does not happen, for a mechanical reason:

> **A non-blocking red is indistinguishable from a green after about two weeks.**

The signal degrades to noise, nobody is accountable for the number, new errors are
added at the same rate they are fixed, and the promised flip to required never has a
good week to happen in. ⚠️ **The plan also has no failure indicator** — the check is
still there, still running, still producing output, so nothing announces that it
stopped working as a control.

📌 **The general shape is [phase 10 · 08](../../phase-10-strictness/08-suppression-directives/README.md)'s
finding about bans and suppressions arriving in a different place: a rule that is
honoured only voluntarily is not a rule.** The same reasoning applies to a check
that cannot fail anything.

## The two approaches that do work

### 1 · Block on a baseline

Make the check required **immediately**, comparing against a recorded count or an
error allowlist rather than against zero.

- ✅ **New errors fail the build from day one** — the population is frozen.
- ✅ The number only moves down, so it is a **ratchet** — the same mechanism
  [phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)
  argues for assertions, and for the same reason: **without one, the count only
  grows.**
- ⚠️ **Baselines rot.** A file-and-line allowlist goes stale on any refactor, so
  prefer a *count* per directory, and re-generate deliberately rather than
  automatically. 🔴 **A baseline that regenerates on every run is not a baseline, it
  is a record of defeat.**

### 2 · Split the config

Enable the gate at full strength over the part of the codebase that is clean, and
expand the boundary.

- ✅ The gate is **genuinely required**, with no allowlist machinery.
- ✅ The scope is **visible in the config**, which is where a coverage decision
  belongs — [chunk 02](./02-what-the-gate-guarantees.md).
- ⚠️ It is the honest version of the "narrow the `include`" lever from
  [chunk 04](./04-making-it-fast-enough.md): **the same change, made deliberately
  and with a plan to reverse it**, rather than in a pull request about CI speed.

🔴 **Both work because both make the check able to fail *something* on day one.**
That is the property that matters, not the size of what it covers.

## What a red gate should and should not do

| | |
|---|---|
| ✅ **Block the merge** | that is the whole job |
| ✅ Report the first errors clearly | truncated output that hides the count is a real cost |
| ⛔ **Be bypassable by a label** | ⚠️ if it exists it will be used, and the uses will not be reviewed |
| ⛔ Auto-suppress | a bot that adds `@ts-expect-error` to make CI green is a machine for accumulating debt |

⚠️ **The emergency case is real and deserves a real answer**, not a permanent
bypass: the way to ship during an incident is to revert the change, not to disable
the check that noticed it. **If a bypass mechanism must exist, make it loud** —
required approval, an issue opened automatically, and a count somebody reads.

## 🔴 The failure this topic exists to prevent

Bring the five chunks together, because they describe one failure with five places
to stop it:

| The gate is… | Reference |
|---|---|
| **absent** — a transpiler is doing the build and nothing checks | [chunk 01](./01-the-green-build-that-proves-nothing.md) |
| **present but empty** — checking a program that excludes the interesting files | [chunk 02](./02-what-the-gate-guarantees.md) |
| **in the wrong place** — a skippable hook, or nothing checking the merged result | [chunk 03](./03-where-the-gate-goes.md) |
| **too slow** — so it gets narrowed, in a PR about CI time | [chunk 04](./04-making-it-fast-enough.md) |
| **advisory** — red for months, and it may as well be green | this chunk |

📌 **All five produce the same observable state: a green pipeline and types that are
not enforced.** That is why "do you type-check in CI?" is a much weaker question
than **"show me the step, and tell me what it covers."**

## Gotchas

**Symptom:** the check has been non-blocking "temporarily" for six months.
**Cause:** advisory checks do not become required on their own — there is never a
good week, and nobody owns the number.
**Fix:** 🔴 baseline it and make it required now. A frozen population with a real
gate beats a shrinking-in-principle one with none.

**Symptom:** the baseline file is regenerated as part of the build.
**Cause:** somebody automated away the friction.
**Fix:** the friction *is* the mechanism. A baseline that regenerates on every run
records defeat rather than preventing it.

**Symptom:** the baseline allowlist breaks on every refactor.
**Cause:** it is keyed on file and line.
**Fix:** a count per directory survives moves and renames. ⚠️ It is coarser, and
coarser is what makes it durable.

**Symptom:** a bypass label exists "for emergencies" and appears weekly.
**Cause:** it exists.
**Fix:** remove it, and handle incidents by reverting the change rather than
disabling the check that caught it. If it must stay, make using it loud and counted.

**Symptom:** a bot opens pull requests adding `@ts-expect-error` to clear the
backlog.
**Cause:** the errors were treated as noise to silence rather than findings.
**Fix:** ⛔ this converts a measured problem into an unmeasured one. Phase 10 · 08's
ladder applies: **count suppressions, do not manufacture them.**

**Symptom:** the error count is falling and the suppression count is rising by the
same amount.
**Cause:** the backlog is being moved, not fixed.
**Fix:** report both numbers together. 📌 Exactly the gaming
[phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)
warns about — a metric that only counts one tier gets satisfied by moving to
another.

**Symptom:** enabling the gate on a clean subdirectory feels like giving up.
**Cause:** it looks smaller than "turn it on everywhere, non-blocking".
**Fix:** it is strictly stronger. A required check over 40% of the codebase enforces
something; an advisory check over 100% enforces nothing.

## Interview questions

**You want to introduce type checking to a codebase with 400 errors. What do you
do?**
Make it required immediately against a baseline, or make it required at full
strength over the part of the codebase that is already clean and expand from there.
What I would not do is turn it on non-blocking with a promise to flip it later: a
non-blocking red is indistinguishable from a green within a couple of weeks, nobody
owns the number, and new errors arrive as fast as old ones leave.

**Why is an advisory check worse than it looks?**
Because it has no failure indicator. It still runs, still produces output, still
appears in the pipeline — so nothing announces the moment it stopped functioning as
a control. It is a rule honoured voluntarily, which is the same reason bans on
suppression comments do not work.

**What makes a baseline work or fail?**
It works if it freezes the population and only moves down — a ratchet. It fails if
it is regenerated automatically, which turns it into a record of defeat, or if it is
keyed on file and line, which makes it rot on the first refactor. A count per
directory is coarser and survives.

**Should there be a way to bypass the gate?**
Preferably not, because if it exists it gets used and the uses are not reviewed. The
emergency case is real, and the answer to it is to revert the change rather than
disable the check that caught it. If a bypass must exist, make it loud — approval,
an automatic issue, and a number somebody reads.

**The error count is dropping steadily. Is that good?**
Only if the suppression count is not rising to match. That is the same gaming as an
assertion metric that counts one spelling: the population moves to whatever tier is
not being measured. Report the errors and the suppressions together, or you are
measuring effort rather than progress.

**Someone proposes enabling the gate on only one directory. Is that too weak?**
No — it is stronger than the usual alternative. A required check over part of the
codebase enforces something and its scope is visible in the config, where a coverage
decision belongs. An advisory check over all of it enforces nothing. The property
that matters is whether the check can fail something on day one.

**Summarise how a pipeline ends up with unenforced types.**
Five ways, all producing the same green pipeline: there is no check because a
transpiler is doing the build; there is a check but the program excludes the
interesting files; the check is in a skippable hook or never runs against the merged
result; the check was narrowed to make CI faster; or the check is advisory. Which is
why the useful question is never "do you type-check in CI" but "show me the step,
and tell me what it covers".

---

← [04 · Making it fast enough to be required](./04-making-it-fast-enough.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
