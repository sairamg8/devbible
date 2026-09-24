---
name: feedback-one-workflow-at-a-time
description: Standing order 2026-09-06 — dispatch ONE Workflow at a time, never two in parallel, and write the session's progress to the store the moment a workflow is dispatched rather than when it returns. Usage limits, not tidiness.
metadata:
  type: feedback
---

# One workflow at a time, and save the moment you dispatch

**2026-09-06**, mid-turn, during the *"ultra code complete angular"* run, in the user's own
words:

> *"Do not deploy more workflow only one at a time and mainly once deploy the work immediatly
> save the session progress to survive of the usage limits"*

Two instructions, and the second is the load-bearing one.

## 1. One `Workflow` in flight at a time

I had a 39-agent workflow running on Angular Phase 0 topics 01/02/03 and had **already written
the script** for a second covering topics 04–12, intending to launch it concurrently on the
reasoning that the topic directories are disjoint so the lanes cannot collide.

**That reasoning was about correctness and the objection is about budget.** Two workflows do
not collide in the filesystem, but they draw on the same usage allowance twice as fast, and
the run that gets killed at the ceiling is the one that had not finished banking. One at a
time is *slower in wall-clock and strictly better in what survives.*

## 2. Save progress at DISPATCH, not at completion

**Why:** a workflow is exactly the window in which a session is most likely to hit a usage
limit — it is spending tokens at 6–16× the rate of a normal turn, and the coordinator is
idle while it does. A coordinator that plans to write its memory *when the results come back*
writes nothing at all if the ceiling arrives first, and the successor inherits a repo with
half-written topics and no explanation of what dispatched them.

**How to apply:**

- The moment a workflow is launched: repoint the project's cursor with the run ID, the agent
  count, what each stage does, and 🔴 **what state the repo is left in if the run dies
  mid-stage.** Commit it. Only then go back to waiting.
- Anything the run depends on that lives in the **scratchpad — a generated script, a commit
  helper — gets copied into the store in the same breath.** The scratchpad does not survive
  the session; a workflow script that only exists there is a workflow a successor cannot
  re-run. See [[angular-phase-0-workflow-scripts]].
- Prefer a design where a kill loses **one file**, not one topic: per-file commits through a
  `flock`-serialised helper, never a batch commit at the end of a stage.

This sharpens [[feedback_memory_update_cadence]] (per file, not per phase) for the case where
the writing is being done by agents rather than by me: the cadence is now **per dispatch** as
well as per file, because between dispatch and return I may write nothing for a long time.

Related: [[feedback_parallel_sessions]], [[cursor-angular]], [[feedback_never_compress_to_fit_cap]].

## Measured 2026-09-14 — the rule held, and the ceiling is lower than it looks

Interview track, run `wf_d87317d9-63f`: **6 research agents at once hit the account session limit in
44 minutes** (23 started, 2 returned, 2.36M subagent tokens). Because the cursor was committed at
dispatch and every agent committed per file, **30 files survived and a cold session can resume from
[[cursor-interview]]** with no re-derivation. What changed after: re-dispatch in **batches of 3-5
research agents**, one workflow at a time, and push after each batch — see its batch table.
