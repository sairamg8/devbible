---
title: "Part 2 — Working with other people"
sidebar_label: "2 · Working with other people"
sidebar_position: 2
---

> **Phases 4–6 · 47 topics · 15 Master**
> The second machine. Remotes and syncing, getting out of trouble, and the team
> conventions that decide what your history looks like in a year.

Part 1 works entirely offline. Everything here exists because someone else has
commits you do not. That single fact produces remote-tracking branches,
divergence, force-push safety, review workflow, and most of the errors people
actually hit — so the phases are ordered to build up to those errors rather than
apologise for them.

---

## Phase 4 — Remotes and syncing

*16 topics.* What "origin" is, what `pull` really runs, and how to push without
destroying a colleague's work. The divergence topic is the one that ends most
daily confusion.

| Topic | Tier |
|---|---|
| **A remote is a named URL, nothing more** — `origin` and `upstream` as conventions rather than keywords; `git remote -v`, adding, renaming, and having more than one | <span className="db-tier t-master">Master</span> |
| **`fetch` versus `pull`** — fetch updates remote-tracking refs and touches nothing you are working on; pull is fetch plus an integration step. Defaulting to fetch-then-look is the habit that prevents surprises | <span className="db-tier t-master">Master</span> |
| **Remote-tracking branches** — `origin/main` is a local cache of where the remote was at last fetch, not a live view; why it is read-only, and why it can be stale without warning | <span className="db-tier t-master">Master</span> |
| **Upstream tracking** — what `--set-upstream` records, `@{u}` and `@{push}`, and how status derives "ahead 2, behind 3" from it | <span className="db-tier t-master">Master</span> |
| **Divergent branches** — Git refuses to guess: a bare `pull` with no `pull.rebase` or `pull.ff` set **fails** with `Need to specify how to reconcile divergent branches`. What each of the three answers does to your history, and which to set as a default | <span className="db-tier t-master">Master</span> |
| **Force-pushing safely** — plain `--force` overwrites whatever is there; `--force-with-lease` checks the remote ref still matches what you last saw; **`--force-if-includes`** additionally guards the case where you fetched but never integrated. Why lease alone is not sufficient | <span className="db-tier t-master">Master</span> |
| **`git push` in full** — the default refspec, `push.default` values, pushing a new branch, pushing tags explicitly, and deleting a remote branch | <span className="db-tier t-understand">Understand</span> |
| **Refspecs** — the `+src:dst` syntax that fetch and push both use, what `fetch = +refs/heads/*:refs/remotes/origin/*` in your config actually says, and fetching one branch by hand | <span className="db-tier t-understand">Understand</span> |
| **Pruning** — remote branches deleted on the server linger locally forever; `fetch --prune`, `fetch.prune`, and `remote prune origin` | <span className="db-tier t-understand">Understand</span> |
| **Transports and credentials** — SSH versus HTTPS, generating and registering an SSH key, personal access tokens, credential helpers and where each stores the secret on disk | <span className="db-tier t-understand">Understand</span> |
| **Fork-and-upstream flow** — two remotes on one clone, keeping a fork current, and the direction each command runs in | <span className="db-tier t-understand">Understand</span> |
| **Shallow clones** — `--depth`, what breaks with truncated history (blame, describe, merge bases), and `--unshallow` when it bites | <span className="db-tier t-understand">Understand</span> |
| **Partial clone** — `--filter=blob:none` fetching commits and trees but downloading file contents on demand, what goes slow afterwards, and `git backfill` to fill objects in later | <span className="db-tier t-know">Know</span> |
| **Signing** — GPG versus SSH signing, `commit.gpgsign`, verifying signatures, and being precise about what a green "Verified" badge does and does not prove | <span className="db-tier t-know">Know</span> |
| **Bare and mirror repositories** — what a bare repo is for, `clone --bare` versus `--mirror`, and hosting a repo yourself | <span className="db-tier t-know">Know</span> |
| `git bundle` — moving commits as a single file across an air gap or into a review that has no network | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** your branch and `origin/main` have diverged and you can
state, before typing anything, which of merge, rebase or fast-forward-only you
want, what the resulting graph looks like, and whether the push after it needs a
lease.

---

## Phase 5 — Undo, recover and rewrite

*16 topics.* Every command that gets you out of trouble, organised by the
trouble rather than by the command. The framing question is always the same: has
anyone else seen these commits?

| Topic | Tier |
|---|---|
| **The undo decision table** — a single table from *what went wrong* to the right command: unstaged edit, staged edit, last commit's message, last commit's content, a commit three back, a pushed commit, a bad merge, a lost branch | <span className="db-tier t-master">Master</span> |
| **`reset` in terms of the three trees** — `--soft` moves HEAD, `--mixed` also resets the index (the default), `--hard` also overwrites the working tree and is the only one that can lose uncommitted work | <span className="db-tier t-master">Master</span> |
| **`revert` is the undo for shared history** — it adds a commit that reverses an earlier one, so nobody has to recover; when to prefer it over a rewrite even on your own branch | <span className="db-tier t-master">Master</span> |
| **Recovery with `reflog`** — the procedure: find the pre-disaster HEAD, verify it with `show`, then `reset --hard` or branch from it. Covers hard resets, bad rebases, and amended commits | <span className="db-tier t-master">Master</span> |
| **Rewriting your own last few commits** — amend, interactive rebase, `commit --fixup` plus `--autosquash`, and the force-push discipline that has to follow | <span className="db-tier t-master">Master</span> |
| **Recovering a deleted branch** — the branch is a pointer; deleting it does not delete commits. Finding the hash by reflog or `fsck`, and re-pointing a branch at it | <span className="db-tier t-understand">Understand</span> |
| **Undoing a merge** — `revert -m 1` to name the mainline parent, and the trap that follows: the reverted branch will not re-merge cleanly later, and what to do about it | <span className="db-tier t-understand">Understand</span> |
| **Undoing something already pushed** — the decision between revert and rewrite, what a protected branch allows, and how to communicate a rewrite so the team does not re-push the old commits | <span className="db-tier t-understand">Understand</span> |
| **Dangling objects and `git fsck`** — what "dangling" means, `--lost-found`, and reading commits that no ref points to any more | <span className="db-tier t-understand">Understand</span> |
| **`gc`, `prune` and expiry windows** — recovery is only possible until garbage collection runs; the reflog expiry defaults, and what an aggressive `gc` permanently removes | <span className="db-tier t-understand">Understand</span> |
| **Stash recovery and stash conflicts** — `pop` failing mid-apply and leaving the stash in place, applying to a different branch, and finding a dropped stash by reflog | <span className="db-tier t-understand">Understand</span> |
| **Removing a secret from history** — the full procedure in the right order: **rotate the credential first**, then rewrite, then force-push, then have everyone re-clone. Why deleting the file in a new commit fixes nothing | <span className="db-tier t-understand">Understand</span> |
| **The rewrite tools** — `filter-branch` is deprecated and slow; `git-filter-repo` and BFG are the current answers. **Neither is installed on this machine** — the pages will state which tool produced each result | <span className="db-tier t-know">Know</span> |
| **Squashing a branch before merge** — `merge --squash` versus an interactive rebase versus the host's squash button; three routes to the same commit, with different authorship and history | <span className="db-tier t-know">Know</span> |
| **`ORIG_HEAD`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`** — the refs Git leaves behind mid-operation, and using them to inspect or abort by hand | <span className="db-tier t-know">Know</span> |
| Recovering from a bad `rebase --onto` — reading the reflog entries a rebase writes, and returning to the pre-rebase state exactly | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can hard-reset away three commits on purpose, then
restore them from the reflog, and explain how long that would have stayed
possible.

---

## Phase 6 — Team workflow and code review

*15 topics.* The conventions. None of this is enforced by Git itself, which is
exactly why it has to be decided rather than absorbed — and why two teams using
identical commands end up with unrecognisably different histories.

| Topic | Tier |
|---|---|
| **The workflow families** — trunk-based development, GitHub flow, git-flow, release branches. What each optimises for, the team size and release cadence each assumes, and why git-flow is usually over-specified for a web app deployed daily | <span className="db-tier t-master">Master</span> |
| **The pull request as the unit of work** — sizing a PR so it can actually be reviewed, the description that saves a reviewer ten minutes, and draft PRs for early feedback | <span className="db-tier t-master">Master</span> |
| **Merge, squash or rebase-merge** — the three host buttons, the history shape each produces, what each does to bisect and revert, and the fact that this is a one-time team decision rather than a per-PR mood | <span className="db-tier t-master">Master</span> |
| **Tags and releases** — lightweight versus annotated tags, SemVer applied to an application rather than a library, pushing tags, and tagging as the thing a deploy pipeline keys off | <span className="db-tier t-master">Master</span> |
| **Keeping a branch reviewable** — rebasing onto main versus merging main in, and what each does to the reviewer's "changes since last review" view | <span className="db-tier t-understand">Understand</span> |
| **Branch naming and lifetime** — a convention that survives fifty branches, and why a branch older than a week is a process problem rather than a Git problem | <span className="db-tier t-understand">Understand</span> |
| **Reviewing a diff well** — reading for correctness rather than style, review comments versus suggested changes, approving with comments, and the review the CI cannot do for you | <span className="db-tier t-understand">Understand</span> |
| **Conventional Commits** — the format, what tooling derives from it (changelogs, version bumps), and the honest cost of enforcing it | <span className="db-tier t-understand">Understand</span> |
| **Protected branches and required checks** — what the host enforces that Git cannot, `CODEOWNERS`, required reviewers, and linear-history enforcement | <span className="db-tier t-understand">Understand</span> |
| **Resolving a conflict-heavy PR** — who resolves, on which side, and the two-step approach that keeps the diff reviewable afterwards | <span className="db-tier t-understand">Understand</span> |
| **Forks versus branches** — the trust boundary each assumes, contributing to a repository you cannot push to, and keeping a fork in sync over months | <span className="db-tier t-understand">Understand</span> |
| **Monorepo versus polyrepo for a MERN/PERN app** — one repo for `web/`, `api/` and `db/` against three; what each costs in CI, review, versioning and release coordination | <span className="db-tier t-understand">Understand</span> |
| **Hotfixes** — the path from an urgent production fix to both the release branch and main, and cherry-pick as the mechanism | <span className="db-tier t-know">Know</span> |
| **Changelogs** — hand-written against generated, and what a changelog is for that a commit log is not | <span className="db-tier t-know">Know</span> |
| The working agreement — the short list a team must actually decide: merge style, branch naming, who reviews, when to force-push, what blocks a merge | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can state your team's merge strategy, why it was
chosen, and what it costs — and take a PR from branch to merged main including
a conflict and a review round, without asking anyone what to do next.

---

## Where this connects

- **Phase 4 → Phase 12** — divergence, rejected pushes and stale tracking
  branches are the errors catalogued there; this phase is the mechanism behind
  each message.
- **Phase 4 → Phase 9** — shallow and partial clones are a bandwidth topic here
  and a CI-time decision there.
- **Phase 5 → Phase 11** — small rewrites live here; rewriting *all* of history
  with `filter-repo` is Part 4.
- **Phase 5 → Phase 7** — the secret-removal procedure only exists because a
  `.env` was committed; Phase 7 is how it never gets committed again.
- **Phase 6 → Phase 8** — the branch protections agreed here are enforced by the
  hooks and CI checks configured there.
- **Phase 6 → Node Phase 11 (Deployment)** — tags and release branches feed a
  deploy pipeline; the pipeline itself is already written there.
- **Deliberately not here:** CI provider syntax, and anything about the shape of
  the repository's contents. Both are Part 3.

---

← Prev: [Part 1 — How Git works](./01-how-git-works.md) · Next: [Part 3 — Git in a real project](./03-in-a-real-project.md) →
