---
title: "Git — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **git 2.55.0** (`git --version`) on this machine.
> Every version fact in the table below was produced by
> `sandbox/git-p0/ex1-version-facts.sh`, which runs in a throwaway repository
> under `/tmp` with the machine's own config neutralised — not written from
> memory.

:::warning Re-scoped 2026-08-14 — daily-driver Git only

This syllabus was written as a **complete** inventory: 13 phases, 191 topics. On
**2026-08-14** it was cut to the commands you use to get work done:
*"I just need to know about the git to work daily tasks not more than that."*

**In scope — 5 phases, 52 topics:**

| Phase | Topics | Why it stays |
|---|---|---|
| **0 · How Git stores things** | 14 | Already written, and it is the reason every daily command behaves the way it does |
| **1 · The everyday loop** | 12 | `status`, `add`, `commit`, `diff`, ignore rules, undo, stash |
| **2 · Branching and merging** | 10 | Branches, merges, conflicts, rebase, cherry-pick, reflog |
| **4 · Remotes and syncing** | 8 | Clone, fetch, pull, push, upstreams, force-push safely |
| **5 · Undo and recover** | 8 | `reset`, `revert`, `amend`, reflog recovery |

**Parked — not being written:** phase 3 (reading history in depth), phase 6
(team workflow and code review), and Parts 3 and 4 entirely — the fullstack
repository, hooks and CI, speed and scale, plumbing, and history surgery. The
rows are left below as a record of the plan, not as work in flight.

Everything below this box describes the **original** 191-topic inventory unless
it says otherwise, including the tier distribution.

:::

The topic inventory for Git, tiered for **fullstack application development**,
split into 4 parts to stay under the 300-line file cap.

The original bar was **no knowledge gaps**: every Git operation you would meet
working on a real MERN/PERN application — a feature branch, a conflicted rebase,
a PR that needs three review rounds, a `.env` that must never be committed, a
lockfile conflict, a bisect through last month's commits, and the morning someone
force-pushes over your branch — had a row. The re-scope above narrows the written
corpus to the daily half of that.

Architectural role: **a content-addressed object store with pointers into it.**
Git is not a diff engine and not a timeline; it is a key-value database keyed by
content hash, plus refs that name entry points. That one fact is what this whole
syllabus is downstream of: it explains why commits are snapshots, why rebasing
must produce new hashes, why a deleted branch loses nothing, and why `reset`
takes three different flags for three different questions.

## Why Git is in scope

Git was **parked** in `instructions.md` §2 as "universal tooling rather than
part of the MERN/PERN stack itself". It was moved into scope on **2026-08-13**
as technology 12. The parked argument was about *layers*, not about need: no
part of building or shipping a fullstack application happens outside a
repository, and the failure modes here — a leaked secret in history, a
force-pushed branch, a hand-merged lockfile — are expensive and permanent in a
way most framework mistakes are not.

## Scope — what this syllabus owns

**Version control, and the repository as an artifact.** The rule is: *if it
still applies when you delete every framework from the repo, it is Git's.*

| Concern | Home |
|---|---|
| Objects, refs, branching, merging, rebasing, remotes, history | **Git** |
| What is tracked, ignored, or committed in a Node/React repo | **Git** (Phase 7) |
| Hooks as a Git mechanism, and their limits | **Git** (Phase 8) |
| CI pipeline design, deploy steps, release engineering | **Node** Phase 11 (Deployment) |
| npm/yarn workspace mechanics, package publishing | **Node** |
| `.dockerignore`, build context, image layers | **Docker & Podman** |
| Runtime secret management, rotation policy | **Node** Phase 8 (Security) |
| Host-specific settings — org policy, permissions, billing | Assumed, not taught here |

The Git/CI line is drawn at the push event: **this syllabus stops when the
commit leaves your machine.** What the pipeline then does with it is already
written in the Node syllabus, and neither side re-explains the other.

## Version facts

All measured on this machine, 2026-08-13, by `ex1-version-facts.sh`:

| | |
|---|---|
| Target version | **git 2.55.0** |
| Command surface | **46** main porcelain commands; **172** git commands on `PATH` |
| Default initial branch | **`master`** — still. `git init` prints a hint that this default *"will change to `main` in Git 3.0"*, and recommends setting `init.defaultBranch` |
| Default object format | **SHA-1.** SHA-256 works (`git init --object-format=sha256` reports `sha256`), but is opt-in per repository |
| Default ref backend | **`files`.** The **`reftable`** backend is supported (`git init --ref-format=reftable`) and writes `.git/reftable/tables.list` instead of `refs/` |
| Divergent-branch behaviour | With `pull.rebase`, `pull.ff` and `push.default` all **unset**, a bare `git pull` on diverged branches **fails**: `fatal: Need to specify how to reconcile divergent branches` |
| `switch` / `restore` | No longer advertised as experimental in their usage output |
| Newest commands present | `git backfill` (partial-clone object fetch); `git replay` and `git last-modified`, both self-labelled **EXPERIMENTAL** in `git help -a` |
| Bundled | **`scalar`** reports `git version 2.55.0` — it ships with Git, not separately |
| **Not installed here** | **`git-filter-repo`** and **`git-lfs`**. Phases 5, 7 and 11 name them; see the open questions below |

The default-branch row is why this syllabus does not take Git facts from memory.
"Git defaults to `main` now" is a widely repeated claim and it is **false on
2.55.0** — the change is scheduled for 3.0, and the hint text says so.

## Parts

| # | Part | Covers | Phases | Topics | Status |
|---|---|---|---|---|---|
| 1 | **[How Git works](syllabus/01-how-git-works.md)** | The object model, the everyday loop, branching and merging, reading history | 0–3 | 61 | 🔴 **In scope** — phases 0, 1, 2. Phase 3 parked |
| 2 | **[Working with other people](syllabus/02-collaboration.md)** | Remotes and syncing, undo and recovery, team workflow and review | 4–6 | 47 | 🔴 **In scope** — phases 4, 5. Phase 6 parked |
| 3 | **[Git in a real project](syllabus/03-in-a-real-project.md)** | The fullstack repository, hooks and CI, speed and ergonomics | 7–9 | 42 | ⏸ **Parked** — beyond daily use |
| 4 | **[Depth and repair](syllabus/04-depth-and-repair.md)** | Plumbing and internals, history surgery, the error catalogue | 10–12 | 41 | ⏸ **Parked** — beyond daily use |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="git" compact />

## Tier distribution

*Of the original 191-topic inventory. The in-scope 52 are drawn disproportionately
from the Master and Understand rows, because that is what "daily" selects for.*

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 55 | 29 % |
| <span className="db-tier t-understand">Understand</span> | 85 | 45 % |
| <span className="db-tier t-know">Know</span> | 46 | 24 % |
| <span className="db-tier t-when">When Needed</span> | 5 | 3 % |

Master sits inside the brief's 25–30 % band and concentrates in Parts 1 and 2 —
the object model, the daily loop, branching, and everything that happens when
two people push. Parts 3 and 4 are deliberately light on it: `reftable`,
`filter-repo` and `scalar` are things you look up on the rare day you need them,
and badging them Master would make the tier meaningless.

## Prerequisites

| | |
|---|---|
| Required | A terminal, and comfort with paths, redirection and an editor. Git is taught here at the command line, because that is where its error messages are |
| Required for Phase 7 | A **Node/React** repository to practise on — the ignore rules, lockfile and migration topics are about that repo specifically |
| Pairs with | **Node** Phase 11 (Deployment) — Git stops at the push, deployment starts there |
| Not required | Any database, CSS or React knowledge. Parts 1, 2 and 4 apply to any repository at all |

## Example policy

🔴 **Changed 2026-08-13 by the no-new-sandboxes rule.** **Phase 0 is
sandbox-proven** — every command block on those 14 pages came from
`sandbox/git-p0/ex1-version-facts.sh` or `ex2-object-model.sh`. **Phase 1 onward
is documentation-validated**: claims are checked against `git help <cmd>` on
2.55.0, git-scm.com, and the message strings shipped in the `git` binary itself,
with the source named on each page's `> Verified:` line. Those pages carry **no
console blocks** unless the output is reused from a recorded `ex1`/`ex2` run, and
each such block says so underneath. Nothing is reconstructed from memory.

The original policy, which still describes the Phase 0 pages:

Every command block on a Git page is a **real run on git 2.55.0**, captured from
a script in `sandbox/git-*/`. A page shows:

| | |
|---|---|
| The commands | Complete and runnable, in order, with the repository state they assume stated up front |
| The output | Real terminal output, including hint blocks and exact `fatal:` / `error:` wording — this is a corpus where the error string *is* the content |
| The hashes | Real, from the run. Abbreviated in prose, never invented |
| The version | Named. A measurement is labelled git 2.55.0 because that is what produced it |

**Every script runs in a throwaway repository under `/tmp`, never in this
project's own repository**, and neutralises the machine's global config
(`GIT_CONFIG_GLOBAL=/dev/null`) so a measured default is Git's default and not
this laptop's. Where a topic depends on a real remote or a host feature (branch
protection, merge queues, review UI), the page says what could not be measured
locally rather than inventing a transcript.

## Open questions — recorded, not silently decided

🔴 **All three are now moot under the 2026-08-14 re-scope.** They concern phases
5, 6, 7 and 11: `filter-repo` and `git-lfs` are named only by parked phases (the
one phase-5 topic that would have used them is not in the daily set), and the
review/merge-queue and team-workflow questions belong to the parked phase 6. They
are kept here in case the scope is ever widened again.

1. **`git-filter-repo` and `git-lfs` are not installed here.** Phases 5, 7 and
   11 need them for real output. Install both so those rows can be measured, or
   write them from upstream documentation and mark them explicitly unverified?
   The never-invent-output rule means this has to be settled before those pages,
   not during them.
2. **Which host is the concrete one?** The review, protection and merge-queue
   rows need a specific product to be worth anything. Proposal: **GitHub** as the
   worked example, with the host-neutral concept stated first each time, and
   GitLab/Bitbucket differences noted only where they change the decision.
3. **How much of the "team workflow" phase is opinion?** Phase 6 recommends
   trunk-based development with squash merges for a web app deployed daily. That
   is a defensible default, not a neutral one — say the word and it becomes a
   comparison with no recommendation.

## Explanations

The explanations live in **[`pages/`](pages/README.md)** — one page per topic, or
a `NN-topic/` directory of chunks when a topic runs past 300 lines.

**Written so far: Phase 0 complete (14 topics), Phase 1 in progress.** The
[pages overview](pages/README.md) carries the live phase table.

## Tier legend

| Badge | Bar to clear |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; looking up exact syntax is fine |
| <span className="db-tier t-know">Know</span> | Know what, why and when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

---

Start → [Part 1 — How Git works](syllabus/01-how-git-works.md)
