---
name: devbible-memory-update-cadence
description: Update the memory store after every completed file and every completed phase — not once at the end of a session
metadata:
  type: feedback
---

# Update memory as you go, not at the end

User instruction, **2026-08-13**, mid-session while the Git syllabus was being
written: *"Can you update your memory every time you complete file ? and after
phase ?"* — and again, verbatim, mid-way through the autonomous TypeScript run,
which also carried *"do not wait for me till the typescript finishes"* /
*"i am stepping outside"*. **Two sessions recorded this separately and the store
carried it twice until 2026-08-13; the duplicate was folded in here.**

**Why:** a session can end — context exhaustion, an interrupt, a crash — with
hours of work recorded nowhere. The store is the only thing that survives, and
memory written at the end of a session is memory that frequently never gets
written at all. The devbible corpus has already lost work once to a rollback
with no git history ([[devbible-progress]], Phase 10).

## How to apply

1. **After each completed content file** — append or update the running progress
   entry for that unit: which file landed, its line count, and any measured fact
   or trap the file produced. One or two lines is enough; this is a checkpoint,
   not a report.
2. **After each completed phase** — a fuller update: the per-phase table, the
   build result, what is outstanding, and the resume point. This is the entry a
   cold session reads first.
3. **Keep it in the store**, `/mnt/Storage/my-learning/claude/<project>/`, never
   under `~/.claude/`. Add the one-line pointer to that project's `INDEX.md` the
   first time a file is created, not on every update.
4. **Respect the 300-line memory cap** ([[devbible-memory-file-cap]]) — when a
   progress file outgrows it, split it and index the child from the parent.
5. **Commit the store as you go.** It is the one repository that may be
   committed without asking ([[feedback-scope-of-changes]]), and frequent small
   commits keep the conflict window small while other sessions write to it too
   ([[devbible-parallel-sessions]]).

## Which file gets which update

| When | Where | What |
|---|---|---|
| **After each page file** | the running progress file for that language — e.g. [[devbible-typescript-build-progress]], [[devbible-javascript-build-progress]] | one line: page number, title, line count, whether it needed chunking |
| **After each phase** | `reference_<lang>_phaseN.md` | the full measured dataset, the findings that contradicted expectations, the page-shape notes |
| **After each phase** | `INDEX.md` + `git commit` in the store | so a cold session can find it |

**Keep the running file terse** — it is a checklist, not a second copy of the
work. Numbers, findings and console output belong in the per-phase reference
file; the running file answers only *"where did I get to, and what is next?"*.
When a language finishes, fold its checklist into one summary line and start the
next language clean, so the running file never approaches the cap.

Related: [[devbible-progress]] · [[devbible-memory-file-cap]] ·
[[devbible-git-syllabus]] · [[devbible-typescript-build-progress]] ·
[[devbible-incremental-scope]]
