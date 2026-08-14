---
title: "Part 1 — How Git works"
sidebar_label: "1 · How Git works"
sidebar_position: 1
---

> **Phases 0–3 · 61 topics · 27 Master**
> The storage model, the daily loop, branching and merging, and how to read a
> history you did not write.

Almost every "Git is confusing" moment is the same misunderstanding wearing a
different hat: people learn Git as a list of commands instead of as a small data
structure with commands that move pointers around it. Learn the object model
first and `reset --soft` versus `reset --hard` stops being trivia — it becomes
obvious which one you want, because you know which of three things each moves.

---

## Phase 0 — How Git stores things

*14 topics.* No workflow yet. What is on disk, what a commit physically is, and
why every later command behaves the way it does. This is the phase that makes
the rest cheap to learn.

| Topic | Tier |
|---|---|
| **Git is a content-addressed object store** — the repository is a key-value database where the key is the hash of the content; branches, tags and HEAD are just labels pointing into it. Nothing else in Git makes sense before this | <span className="db-tier t-master">Master</span> |
| **A commit is a snapshot, not a diff** — every commit names a complete tree; the diffs you read are computed on demand between two snapshots. Delta compression exists, but it is a packfile detail, not the model | <span className="db-tier t-master">Master</span> |
| **The four object types** — blob (bytes), tree (a directory listing), commit (snapshot + parents + author/committer + message), annotated tag. What each one contains and what it does *not* contain — a blob has no filename | <span className="db-tier t-master">Master</span> |
| **The three trees** — HEAD, the index, the working tree. Every core command is a move between two of them, and naming which two is how you pick the right command instead of guessing | <span className="db-tier t-master">Master</span> |
| **The index is a real file, not a mood** — `.git/index` holds a staged copy of content; `git add` copies bytes in, which is why editing a file after `add` leaves the old version staged | <span className="db-tier t-master">Master</span> |
| **Refs and HEAD** — `refs/heads/*`, `refs/tags/*`, `refs/remotes/*`; a branch is a file containing one hash; HEAD is a symbolic ref, and detached HEAD is a normal state rather than an error | <span className="db-tier t-master">Master</span> |
| **The commit graph is a DAG, not a timeline** — parents point backwards, a merge commit has two, and "before/after" in Git means reachability, not clock time. Commit dates can lie; ancestry cannot | <span className="db-tier t-master">Master</span> |
| **Config layers and precedence** — system, global, local, worktree, and `-c` for one command; reading the truth with `git config --list --show-origin --show-scope` instead of guessing which file won | <span className="db-tier t-understand">Understand</span> |
| **A tour of `.git/`** — `objects/`, `refs/`, `HEAD`, `index`, `config`, `hooks/`, `logs/`; what each holds, and which of them you may safely read while learning | <span className="db-tier t-understand">Understand</span> |
| **Identity, and the first-run setup** — `user.name` / `user.email`, the exact `Author identity unknown` failure a fresh machine gives you, and per-repo identity when work and personal commits share a laptop | <span className="db-tier t-understand">Understand</span> |
| **Loose objects, packfiles and delta compression** — why a fresh repo has thousands of small files, what `git gc` does to them, and why repo size on disk is not the sum of your file sizes | <span className="db-tier t-understand">Understand</span> |
| **What Git is not** — not a backup, not a deployment tool, not a place for secrets, not a large-binary store. Each of these has a phase later that shows the specific damage | <span className="db-tier t-understand">Understand</span> |
| **Object format: SHA-1 today, SHA-256 available** — `--object-format=sha256` works on this build; SHA-1 remains the default, and mixed-format interop is the reason why | <span className="db-tier t-know">Know</span> |
| Plumbing versus porcelain — the two documented API layers, why scripts target plumbing, and how to find the plumbing command behind a porcelain one | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can point at a file, and say which object type
holds its bytes, which holds its name, and what would change in `.git/` if you
staged it — before running anything.

---

## Phase 1 — The everyday loop

*16 topics.* The commands you run every hour. The goal is not "knows what `git
add` does" — it is never being unsure what state a file is in, and never
committing something you did not mean to.

| Topic | Tier |
|---|---|
| **`git status` is the instrument panel** — reading the three sections (staged, unstaged, untracked) as the three trees; the short format `-sb` and its two-column code; why the hints it prints are the correct next command surprisingly often | <span className="db-tier t-master">Master</span> |
| **`git add` in full** — paths, `.`, `-A`, `-u`, and **`-p` for hunk-by-hunk staging**, which is the single habit that most improves commit quality | <span className="db-tier t-master">Master</span> |
| **`git commit`** — what gets committed (the index, never the working tree), `-m` versus the editor, `--amend` and the fact that amending makes a *new* commit with a new hash | <span className="db-tier t-master">Master</span> |
| **`git diff`, and the three questions it answers** — working tree vs index (bare), index vs HEAD (`--staged`), working tree vs HEAD (`HEAD`); picking the wrong one is why "my change disappeared" | <span className="db-tier t-master">Master</span> |
| **`.gitignore`** — pattern syntax, directory vs file rules, negation and its one hard limitation, precedence across nested files, `.git/info/exclude` and a global ignore file, plus `git check-ignore -v` to find the rule that matched | <span className="db-tier t-master">Master</span> |
| **Ignoring does not untrack** — the trap that `.gitignore` only affects untracked files, so a committed `.env` keeps being committed; `git rm --cached` and why that fix is not enough on its own | <span className="db-tier t-understand">Understand</span> |
| **`git switch` and `git restore`** — the two commands that split the old `git checkout` in half, which one to reach for, and reading old tutorials that predate them | <span className="db-tier t-master">Master</span> |
| **Undo before you push, decided properly** — `restore` (working tree), `restore --staged` (unstage), `reset --soft/--mixed/--hard` (move HEAD ± index ± tree); a table with the exact effect on each of the three trees | <span className="db-tier t-master">Master</span> |
| **`git log` for the everyday case** — `--oneline --graph --decorate`, limiting by count and path, and the habit of reading history before changing it | <span className="db-tier t-understand">Understand</span> |
| **Commit message craft** — imperative subject, the 50/72 convention and where it came from, the body answering *why* rather than *what*, and the trailer lines tools read | <span className="db-tier t-understand">Understand</span> |
| **What belongs in one commit** — the atomic-commit test: it builds, it passes, it does one thing, and it can be reverted alone. Why this pays off in `bisect` and review, not in tidiness | <span className="db-tier t-understand">Understand</span> |
| **`git stash`** — save, list, apply versus pop, `-u` for untracked, and naming stashes so you can still identify them in a week | <span className="db-tier t-understand">Understand</span> |
| **The file state machine** — untracked → tracked → staged → committed → ignored, and the transitions between them, including the ones with no obvious command | <span className="db-tier t-understand">Understand</span> |
| **`git rm`, `git mv`, and rename detection** — that Git does not record renames at all; it detects them at diff time by similarity, which is why a rename plus an edit sometimes reads as delete-plus-add | <span className="db-tier t-understand">Understand</span> |
| **`git clean`** — `-n` first, always; `-fd` and the `-x` that also removes ignored files (which is how people delete their own `.env`) | <span className="db-tier t-understand">Understand</span> |
| Finding the documentation — `git help <cmd>` versus `-h`, and the concept man pages (`gitglossary`, `gitrevisions`, `githooks`) that answer questions the command pages do not | <span className="db-tier t-know">Know</span> |


:::info In scope — 12 of these topics

The 2026-08-14 re-scope keeps the daily-driver subset of this phase. **Twelve topics, in this order.**

| # | Topic written |
|---|---|
| 1 | `git status` is the instrument panel |
| 2 | `git add` in full — paths, `-A`, `-u`, `-p` |
| 3 | `git commit` — the index is what gets committed |
| 4 | `git diff` and the three questions it answers |
| 5 | `.gitignore` — patterns, precedence, `check-ignore -v` |
| 6 | Ignoring does not untrack |
| 7 | `git switch` and `git restore` |
| 8 | Undo before you push — `restore` and `reset` as an effect table |
| 9 | `git log` for the everyday case |
| 10 | Commit messages, and what belongs in one commit |
| 11 | `git stash` |
| 12 | Removing and moving files — `rm`, `mv`, `clean`, and rename detection |

**Not written:** *The file state machine* (its content is inside the `git status` topic) and *Finding the documentation*. *What belongs in one commit* is folded into the commit-message topic; *`git rm` / `git mv`* and *`git clean`* are merged into one topic.

:::

**Gate — move on when:** you can stage half the changes in one file, commit
them with a message that explains why, and describe exactly what is still
sitting in your working tree — without running `status` to check.

---

## Phase 2 — Branching, merging and rebasing

*17 topics.* The part people are most afraid of, entirely because the model is
usually taught last. A branch is a file with a hash in it; merging is a
three-input operation; rebasing is replaying patches to make new commits. That
is the whole thing.

| Topic | Tier |
|---|---|
| **A branch is a moving pointer** — creating, switching, deleting; `-d` versus `-D` and what "not fully merged" actually checks; why branching is O(1) and cheap by design | <span className="db-tier t-master">Master</span> |
| **Fast-forward versus a real merge** — when Git can just slide the pointer forward, when it must build a merge commit, and what `--no-ff` buys you in a team history | <span className="db-tier t-master">Master</span> |
| **The three-way merge and the merge base** — the common ancestor is the third input; `git merge-base` to see it, and why a bad base is the reason some merges conflict absurdly | <span className="db-tier t-master">Master</span> |
| **Resolving a conflict, properly** — reading the markers, `zdiff3` conflict style showing the original alongside both sides, resolving in the editor versus `--ours` / `--theirs`, and re-running the tests before you continue | <span className="db-tier t-master">Master</span> |
| **`git rebase`** — replaying commits onto a new base, that every replayed commit gets a **new hash**, and what that implies for anyone who already has the old ones | <span className="db-tier t-master">Master</span> |
| **Rebase versus merge, decided on purpose** — the honest trade-off: linear readable history and clean bisects, against rewritten hashes, harder shared branches and conflicts resolved repeatedly. When each is right, per branch type | <span className="db-tier t-master">Master</span> |
| **Interactive rebase** — `pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, `break`; cleaning a messy branch into reviewable commits, and `--autosquash` with `commit --fixup` | <span className="db-tier t-master">Master</span> |
| **The rule about rewriting shared history** — what "shared" means precisely (someone else has the commits), why rewriting it forces everyone else to recover, and the narrow cases where it is still correct | <span className="db-tier t-master">Master</span> |
| **`git reflog` as the safety net** — that HEAD movements are logged locally, so nearly every "I destroyed my work" is recoverable; reading it, and its expiry window | <span className="db-tier t-master">Master</span> |
| **Aborting cleanly** — `merge --abort`, `rebase --abort`, `--continue`, `--skip`, and `cherry-pick --abort`; knowing you can always get back to where you started is what makes the rest usable | <span className="db-tier t-understand">Understand</span> |
| **`git cherry-pick`** — copying one commit somewhere else, the duplicate-commit problem it creates, and its legitimate uses (hotfix to a release branch) | <span className="db-tier t-understand">Understand</span> |
| **Merge strategies and options** — the default `ort` strategy, `-X ours` / `-X theirs` as *conflict* preferences rather than whole-side choices, `--squash`, and when a strategy option is the wrong tool | <span className="db-tier t-understand">Understand</span> |
| **Detached HEAD** — the three normal ways you end up there (checking out a tag, a hash, a remote-tracking ref), what happens to commits made there, and how to keep them | <span className="db-tier t-understand">Understand</span> |
| **Long-lived branch maintenance** — keeping a feature branch current, why the choice between merging main in and rebasing onto main changes what reviewers see | <span className="db-tier t-understand">Understand</span> |
| **`git rerere`** — recording conflict resolutions so a repeated rebase does not re-ask; the setting, and why it is the standard answer to "I resolve the same conflict every day" | <span className="db-tier t-know">Know</span> |
| **Stacked branches and `rebase.updateRefs`** — rebasing a chain of dependent branches without leaving the lower ones pointing at abandoned commits | <span className="db-tier t-know">Know</span> |
| `git replay` — marked **EXPERIMENTAL** on this build; rebasing without a working tree, aimed at server-side and automation use | <span className="db-tier t-when">When Needed</span> |


:::info In scope — 10 of these topics

The 2026-08-14 re-scope keeps the daily-driver subset of this phase. **Ten topics, in this order.**

| # | Topic written |
|---|---|
| 1 | A branch is a moving pointer |
| 2 | Fast-forward versus a real merge |
| 3 | The three-way merge and the merge base |
| 4 | Resolving a conflict, properly |
| 5 | `git rebase` — replaying commits, and why every hash changes |
| 6 | Rebase versus merge, decided on purpose |
| 7 | Interactive rebase — `pick`, `reword`, `squash`, `fixup`, `drop` |
| 8 | The rule about rewriting shared history |
| 9 | `git reflog` as the safety net |
| 10 | Aborting cleanly — `--abort`, `--continue`, `--skip` |

**Not written:** cherry-pick, merge strategies and `-X` options, detached HEAD (covered in phase 0 and in `git status`), long-lived branch maintenance, `rerere`, stacked branches with `rebase.updateRefs`, and the experimental `git replay`.

:::

**Gate — move on when:** you can take a six-commit branch with two "wip"
commits and a typo fix, turn it into three coherent commits rebased onto current
main, resolve the conflicts that causes, and explain why every hash changed.

---

## Phase 3 — Reading history
:::warning Phase parked — 2026-08-14 re-scope

**Phase 3 is out of scope.** Reading history in depth — `bisect`, `blame`, pickaxe searching, `log` formatting — sits past what daily work needs; the everyday `git log` incantations are in phase 1 instead. The rows below are the original plan, kept for
the record; no pages are being written for them.

:::


*14 topics.* History is only worth keeping if you can interrogate it. This phase
is what turns "who broke this and when" from an afternoon into two commands.

| Topic | Tier |
|---|---|
| **Revision syntax** — `HEAD~3` versus `HEAD^2` and why they differ on merge commits, `@` as shorthand for HEAD, `@{u}` for upstream, `branch@{2}` for reflog positions, and `:/text` to search by message | <span className="db-tier t-master">Master</span> |
| **Commit ranges** — `A..B` (in B, not in A) versus `A...B` (in either, not both), which one `git log` and `git diff` each interpret differently, and `--left-right` to see which side a commit came from | <span className="db-tier t-master">Master</span> |
| **`git log` beyond `--oneline`** — `--stat`, `-p`, `--format` with placeholders, `--graph` on real merges, `--first-parent` for reading a trunk history without every feature branch's noise | <span className="db-tier t-master">Master</span> |
| **`git bisect`** — binary search for the commit that introduced a bug; the manual loop, and **`bisect run`** with a script or test command so it finishes unattended | <span className="db-tier t-master">Master</span> |
| **Searching history by content** — `-S` (pickaxe: when did this string's count change) versus `-G` (when did a diff match this regex) versus `--grep` (message), and why grepping the working tree cannot answer any of them | <span className="db-tier t-understand">Understand</span> |
| **`git blame` used fairly** — `-w` to ignore whitespace, `-C` to follow copied code, `-L` for a line range, and `.git-blame-ignore-revs` so a formatting commit does not become the author of the whole file | <span className="db-tier t-understand">Understand</span> |
| **Following a file through time** — `git log -- path`, `--follow` across renames, and the limits of similarity-based rename detection | <span className="db-tier t-understand">Understand</span> |
| **`git show`** — inspecting a commit, a tree, a blob, or a file *as it was* at any revision (`git show HEAD~3:src/app.js`) | <span className="db-tier t-understand">Understand</span> |
| **Diff options that change the answer** — `-w`, `--word-diff`, `-M` rename detection, `--stat`, and the histogram/patience algorithms that produce a readable diff where the default produces noise | <span className="db-tier t-understand">Understand</span> |
| **`git range-diff`** — comparing two versions of the same branch, which is how you review what changed between force-pushes instead of re-reading the whole PR | <span className="db-tier t-understand">Understand</span> |
| **Filtering by author, date and path** — `--author`, `--since` / `--until`, path limiting, and combining them to answer a real audit question | <span className="db-tier t-understand">Understand</span> |
| **`git describe`** — naming a commit relative to the nearest tag, and why build pipelines put its output in a version string | <span className="db-tier t-know">Know</span> |
| `git shortlog -sn` — contribution summaries, release notes drafts, and what these numbers do and do not measure | <span className="db-tier t-know">Know</span> |
| `git last-modified` — marked **EXPERIMENTAL** on this build; when each path in a tree last changed, in one pass instead of a `log` per file | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** given a bug that appeared "sometime last month", you
can name the introducing commit with `bisect run`, and show the exact line
change with `blame` plus `show` — without opening a web UI.

---

## Where this connects

- **Phase 0 → everything.** The three trees explain `reset`, the object model
  explains why rebasing changes hashes, and refs explain what a remote-tracking
  branch is. Every later phase leans on this one.
- **Phase 1 → Phase 7** — `.gitignore` is a syntax topic here and a
  *what-belongs-in-a-Node-repo* decision there.
- **Phase 2 → Phase 6** — rebase versus merge is a mechanism here and a team
  policy there; the PR merge button is the same decision, made once for
  everybody.
- **Phase 2 → Phase 5** — `reflog` appears here as a safety net and there as a
  recovery procedure with the exact commands.
- **Phase 3 → Phase 8** — `bisect run` is only cheap if the test suite is fast
  and hooks kept history clean.
- **Deliberately not here:** anything involving a second machine. Remotes,
  pushing, pulling and review all live in Part 2 — everything above works with
  no network at all.

---

← [Overview](../README.md) · Next: [Part 2 — Working with other people](./02-collaboration.md) →
