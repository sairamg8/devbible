---
title: "Phase 1 — The everyday loop"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** This phase is **documentation-validated**, not
> sandbox-proven: every claim is checked against `git help <cmd>` on 2.55.0,
> git-scm.com, and the message strings shipped in the `git` binary, and each page
> names its sources on its `> Verified:` line. Console blocks appear **only**
> where the output was actually recorded by `sandbox/git-p0/ex1-version-facts.sh`
> or `ex2-object-model.sh`, and each one says so underneath. Nothing here is a
> reconstructed terminal capture.

The commands you run every hour. The goal is not "knows what `git add` does" — it
is **never being unsure what state a file is in, and never committing something
you did not mean to.** Phase 0 established that Git is three trees and an object
store; this phase is the set of moves between them, and the reason each one is
the right tool for a particular sentence you can say out loud.

**12 topics**, after the 2026-08-14 re-scope to daily-driver Git.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[`git status` is the instrument panel](01-git-status/README.md)** | <span className="db-tier t-master">Master</span> | Three sections, two columns — each one a comparison between two trees |
| 02 | **[`git add` in full](02-git-add/README.md)** | <span className="db-tier t-master">Master</span> | Staging is a content copy; pathspecs; and the `-p` habit |
| 03 | **[`git commit`](03-git-commit.md)** | <span className="db-tier t-master">Master</span> | The index is committed, never the working tree; `--amend` makes a new hash |
| 04 | **[`git diff` and its three questions](04-git-diff.md)** | <span className="db-tier t-master">Master</span> | Bare, `--staged`, `HEAD` — picking wrong is why "my change disappeared" |
| 05 | **[`.gitignore`](05-gitignore.md)** | <span className="db-tier t-master">Master</span> | Pattern syntax, negation's one hard limit, and `check-ignore -v` |
| 06 | **[Ignoring does not untrack](06-ignoring-does-not-untrack.md)** | <span className="db-tier t-understand">Understand</span> | Why a committed `.env` keeps being committed |
| 07 | **[`git switch` and `git restore`](07-switch-and-restore.md)** | <span className="db-tier t-master">Master</span> | The two halves the old `checkout` was split into |
| 08 | **[Undo before you push](08-undo-before-you-push.md)** | <span className="db-tier t-master">Master</span> | `restore` vs `reset --soft/--mixed/--hard`, as an effect table |
| 09 | **[`git log` for the everyday case](09-git-log.md)** | <span className="db-tier t-understand">Understand</span> | `--oneline --graph --decorate`, and reading before changing |
| 10 | **[Commit messages, and what belongs in one commit](10-commit-messages.md)** | <span className="db-tier t-understand">Understand</span> | Imperative subject, a body that answers *why*, and the atomic test |
| 11 | **[`git stash`](11-git-stash.md)** | <span className="db-tier t-understand">Understand</span> | Apply versus pop, `-u`, and `--keep-index` for testing what you staged |
| 12 | **[Removing and moving files](12-removing-and-moving.md)** | <span className="db-tier t-understand">Understand</span> | `rm`, `mv`, `clean -n` first, and why Git records no renames |

## Coverage

✅ **PHASE COMPLETE — 12 of 12 topics, 19 files, 4,113 lines.** Every topic is written.

| Topic | Files | Lines | Status |
|---|---|---|---|
| 01 · `git status` | `README.md` + 4 chunks | 66 · 278 · 250 · 244 · 268 = **1,106** | ✅ Complete |
| 02 · `git add` | `README.md` + 3 chunks | 51 · 243 · 235 · 258 = **787** | ✅ Complete |
| 03 · `git commit` | one file | **227** | ✅ Complete |
| 04 · `git diff` | one file | **225** | ✅ Complete |
| 05 · `.gitignore` | one file | **238** | ✅ Complete |
| 06 · Ignoring ≠ untracking | one file | **179** | ✅ Complete |
| 07 · switch and restore | one file | **225** | ✅ Complete |
| 08 · Undo before you push | one file | **205** | ✅ Complete |
| 09 · `git log` | one file | **191** | ✅ Complete |
| 10 · Messages and scope | one file | **224** | ✅ Complete |
| 11 · `git stash` | one file | **199** | ✅ Complete |
| 12 · `rm`, `mv`, `clean` | one file | **213** | ✅ Complete |

## What changed on 2026-08-14

This phase was 16 topics. Two were dropped and two merged:

- **The file state machine** — its content is inside topic 01, which reads the
  same states off `git status` rather than as an abstract diagram.
- **Finding the documentation** — a Know-tier row about `git help`.
- **What belongs in one commit** is folded into topic 10, next to the message it
  produces.
- **`git rm` / `git mv`** and **`git clean`** are one topic, 12 — they are the
  three ways to make a file stop being there, and the differences between them
  are the point.

Topics 01 and 02 were written before the re-scope and carry **Interview
questions** sections. Topics 03 onward are written to the practical format the
user asked for: thesis, mechanism, gotchas, no interview block.

## Gate — move on when

You can stage half the changes in one file, commit them with a message that
explains why, and describe exactly what is still sitting in your working tree —
**without running `status` to check.**

## Where this phase connects

- **Back to [Phase 0](../phase-0-how-git-stores-things/README.md)** — every command
  here is a move between two of the three trees. If a command's behaviour ever
  looks arbitrary, the explanation is in Phase 0, not in this phase's flags.
- **Forward to Phase 2** — branching and merging add a second dimension to the
  same model; the conflict codes in `git status` are already a preview of it.
- **Forward to Phase 5** — `reset` and `restore` appear here as "undo before you
  push" and there as the full recovery toolkit, including `reflog`.

---

← [Phase 0 — How Git stores things](../phase-0-how-git-stores-things/README.md) ·
Start → [`git status` is the instrument panel](01-git-status/README.md)
