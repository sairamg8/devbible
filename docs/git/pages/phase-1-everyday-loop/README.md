---
title: "Phase 1 — The everyday loop"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** This phase is **documentation-validated**, not
> sandbox-proven: every claim is checked against `git help <cmd>` on 2.55.0 and
> git-scm.com, and each page names its sources on its `> Verified:` line. Console
> blocks appear **only** where the output was actually recorded by
> `sandbox/git-p0/ex1-version-facts.sh` or `ex2-object-model.sh`, and each one
> says so underneath. Nothing here is a reconstructed terminal capture.

The commands you run every hour. The goal is not "knows what `git add` does" — it
is **never being unsure what state a file is in, and never committing something
you did not mean to.** Phase 0 established that Git is three trees and an object
store; this phase is the set of moves between them, and the reason each one is
the right tool for a particular sentence you can say out loud.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[`git status` is the instrument panel](01-git-status/README.md)** | <span className="db-tier t-master">Master</span> | Three sections, two columns — each one a comparison between two trees |
| 02 | `git add` in full | <span className="db-tier t-master">Master</span> | Paths, `-A`, `-u`, and the `-p` habit that improves every commit |
| 03 | `git commit` | <span className="db-tier t-master">Master</span> | The index is committed, never the working tree; `--amend` makes a new hash |
| 04 | `git diff` and its three questions | <span className="db-tier t-master">Master</span> | Bare, `--staged`, `HEAD` — picking wrong is why "my change disappeared" |
| 05 | `.gitignore` | <span className="db-tier t-master">Master</span> | Pattern syntax, negation's one hard limit, and `check-ignore -v` |
| 06 | Ignoring does not untrack | <span className="db-tier t-understand">Understand</span> | Why a committed `.env` keeps being committed |
| 07 | `git switch` and `git restore` | <span className="db-tier t-master">Master</span> | The two halves the old `checkout` was split into |
| 08 | Undo before you push, decided properly | <span className="db-tier t-master">Master</span> | `restore` vs `reset --soft/--mixed/--hard`, as an effect table |
| 09 | `git log` for the everyday case | <span className="db-tier t-understand">Understand</span> | `--oneline --graph --decorate`, and reading before changing |
| 10 | Commit message craft | <span className="db-tier t-understand">Understand</span> | Imperative subject, 50/72, and a body that answers *why* |
| 11 | What belongs in one commit | <span className="db-tier t-understand">Understand</span> | The atomic test — builds, passes, does one thing, reverts alone |
| 12 | `git stash` | <span className="db-tier t-understand">Understand</span> | Apply versus pop, `-u`, and naming them so they stay identifiable |
| 13 | The file state machine | <span className="db-tier t-understand">Understand</span> | Untracked → tracked → staged → committed → ignored |
| 14 | `git rm`, `git mv` and rename detection | <span className="db-tier t-understand">Understand</span> | Git records no renames; it detects them by similarity |
| 15 | `git clean` | <span className="db-tier t-understand">Understand</span> | `-n` first, always — and the `-x` that deletes your `.env` |
| 16 | Finding the documentation | <span className="db-tier t-know">Know</span> | `git help` versus `-h`, and the concept man pages |

## Coverage

**1 of 16 topics written, as 5 files.** Topics 02–16 are not started. Rows above
without a link have no page yet — they are the syllabus inventory, kept here so
the gap is visible rather than implied.

| Topic | Files | Lines | Status |
|---|---|---|---|
| 01 · `git status` | `README.md` + 4 chunks | 278 · 250 · 244 · 268 | ✅ Complete |
| 02–16 | — | — | Not started |

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
- **Forward to Phase 7** — `.gitignore` is syntax here and a repository-design
  decision there, once a monorepo has several ecosystems' worth of build output.

---

← [Phase 0 — How Git stores things](../phase-0-how-git-stores-things/README.md) ·
Start → [`git status` is the instrument panel](01-git-status/README.md)
