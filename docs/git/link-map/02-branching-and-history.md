---
title: "Link map · Git · Part 1b (phases 2–3)"
sidebar_label: "02 · Git · Branching, History (2–3)"
sidebar_position: 2
---

# Link map · Git · Part 1b — Branching and Reading history (phases 2–3)

Covers every topic row of phases 2 and 3 in `docs/git/syllabus/01-how-git-works.md`: T02-01 to T02-17 (Branching, merging and rebasing) and T03-01 to T03-14 (Reading history). That is 31 rows. Phase 2 rows 1–10 have a page of ours (✅); rows 11–17 and all of phase 3 (parked in the 2026-08-14 re-scope) are 🔲.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one (none here: every link is git-scm.com). No `#anchors` are given.

🔴 **Version note.** Our syllabus is verified against git 2.55.0. The git-scm.com home page showed **2.56.0** as the latest source release on 2026-10-12. The reference pages at git-scm.com/docs and the Pro Git pages show no page date, so only the fetch date is given. Pro Git is the 2nd edition and predates some newer options (for example `zdiff3`, `--update-refs`), so those are cited from the manual pages.

---

## Phase 2 — Branching, merging and rebasing

### T02-01 · A branch is a moving pointer — Master · ✅ written `docs/git/pages/phase-2-branching-merging/01-a-branch-is-a-pointer.md`
- **Read this:** [Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell) · git-scm.com (Pro Git) · a new branch is as cheap as writing 41 bytes to a file; HEAD is the pointer to the current branch (*read*) · covers our angle: **partial** — no `-d` versus `-D` · fetched 2026-10-12
- **Also good:** [git-branch](https://git-scm.com/docs/git-branch) · git-scm.com · `-d` refuses unless the branch is fully merged in its upstream, or in HEAD when none is set; `-D` is shorthand for `--delete --force` (*read*) · fetched 2026-10-12
- **Our delta:** a worked failing `-d` example; the Pro Git page has no `-d` / `-D` text and git-branch gives the rule without one.

### T02-02 · Fast-forward versus a real merge — Master · ✅ written `docs/git/pages/phase-2-branching-merging/02-fast-forward-vs-merge.md`
- **Read this:** [Basic Branching and Merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) · git-scm.com (Pro Git) · the "Fast-forward" output, then a three-way merge with a new snapshot and commit (*read*) · covers our angle: **partial** — nothing on `--no-ff` · fetched 2026-10-12
- **Also good:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · `--ff`, `--no-ff`, `--ff-only` described together (*read*) · fetched 2026-10-12
- **Our delta:** what `--no-ff` buys in a team history.

### T02-03 · The three-way merge and the merge base — Master · ✅ written `docs/git/pages/phase-2-branching-merging/03-three-way-merge.md`
- **Read this:** [git-merge-base](https://git-scm.com/docs/git-merge-base) · git-scm.com · finds the best common ancestor(s) for a three-way merge; defines "better" ancestor; `--is-ancestor`, `--fork-point` modes (*read* the opening) · covers our angle: **partial** — reference, no worked bad-base example · fetched 2026-10-12
- **Also good:** [Basic Branching and Merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) · Pro Git · "three snapshots used in a typical merge" (*read*) · fetched 2026-10-12
- **Our delta:** why a bad base makes absurd conflicts.

### T02-04 · Resolving a conflict, properly — Master · ✅ written `docs/git/pages/phase-2-branching-merging/04-resolving-conflicts.md`
- **Read this:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · section "How conflicts are presented": `merge.conflictStyle` set to `diff3` or `zdiff3` adds the common-ancestor text (*read*) · covers our angle: **partial** — no `--ours` / `--theirs` guidance, not confirmed · fetched 2026-10-12
- **Also good:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · Pro Git · `git merge --abort`, `git diff --ours`, `diff3` markers (*read*) · fetched 2026-10-12
- **Our delta:** re-running the tests before `--continue`; `zdiff3` is documented only in the manual.

### T02-05 · `git rebase` — Master · ✅ written `docs/git/pages/phase-2-branching-merging/05-git-rebase.md`
- **Read this:** [Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) · git-scm.com (Pro Git) · replays each commit's diff onto the new base, `--onto`, abandoned commits become new ones (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · full option reference, "Transplant a series of commits onto a different starting point" (*read* the synopsis) · fetched 2026-10-12

### T02-06 · Rebase versus merge, decided on purpose — Master · ✅ written `docs/git/pages/phase-2-branching-merging/06-rebase-vs-merge.md`
- **Read this:** [Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) · git-scm.com (Pro Git) · section "Rebase vs. Merge": history as record versus history as story, no single winner (*read*) · covers our angle: **partial** — no per-branch-type rules, no bisect argument · fetched 2026-10-12
- **Our delta:** the per-branch-type table; this is a policy topic and the Pro Git text is deliberately neutral.

### T02-07 · Interactive rebase — Master · ✅ written `docs/git/pages/phase-2-branching-merging/07-interactive-rebase.md`
- **Read this:** [Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) · git-scm.com (Pro Git) · the todo list legend: `pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, `break` (*read*) · covers our angle: **partial** — no `--autosquash` (the word does not appear on the page) · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · `--autosquash` with `fixup!` / `squash!` / `amend!` messages; the `break` command (*read*) · fetched 2026-10-12
- **Our delta:** `commit --fixup` plus `--autosquash` as one workflow.

### T02-08 · The rule about rewriting shared history — Master · ✅ written `docs/git/pages/phase-2-branching-merging/08-the-golden-rule.md`
- **Read this:** [Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) · git-scm.com (Pro Git) · section "The Perils of Rebasing": do not rebase commits that exist outside your repository and that people may have based work on (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · section "Recovering from upstream rebase" (*headings only*) · fetched 2026-10-12

### T02-09 · `git reflog` as the safety net — Master · ✅ written `docs/git/pages/phase-2-branching-merging/09-reflog.md`
- **Read this:** [git-reflog](https://git-scm.com/docs/git-reflog) · git-scm.com · `HEAD@{2}` means where HEAD was two moves ago; expiry defaults to 90 days via `gc.reflogExpire` (*read*) · covers our angle: **partial** — reference, no recovery walkthrough · fetched 2026-10-12
- **Also good:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git · using `git reflog` to find a lost commit (*read* the opening of the recovery section) · fetched 2026-10-12
- **Our delta:** the unreachable-entry expiry window is separate from the 90-day default; see the manual's `--expire-unreachable`.

### T02-10 · Aborting cleanly — Understand · ✅ written `docs/git/pages/phase-2-branching-merging/10-aborting-cleanly.md`
- **Read this:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · `git merge --abort` tries to reconstruct the pre-merge state, with a caveat when uncommitted changes existed (*read*) · covers our angle: **partial** — merge only · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · synopsis `--continue | --skip | --abort | --quit` (*read*) · [git-cherry-pick](https://git-scm.com/docs/git-cherry-pick) · same set for cherry-pick (*read* the synopsis) · fetched 2026-10-12
- **Our delta:** one table across the three commands.

### T02-11 · `git cherry-pick` — Understand · 🔲 not written
- **Read this:** [git-cherry-pick](https://git-scm.com/docs/git-cherry-pick) · git-scm.com · applies the change each commit introduces and records a new commit; needs a clean working tree; `-x`, `--abort` (*read* the opening) · covers our angle: **partial** — duplicate-commit problem not confirmed · fetched 2026-10-12
- **Also good:** [Maintaining a Project](https://git-scm.com/book/en/v2/Distributed-Git-Maintaining-a-Project) · Pro Git · section "Rebasing and Cherry-Picking Workflows", with a worked example; says the copy gets a new SHA-1 (*read*) · fetched 2026-10-12
- **Our delta:** hotfix to a release branch, and the duplicate that appears when both branches later merge.

### T02-12 · Merge strategies and options — Understand · 🔲 not written
- **Read this:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · section "Merge strategies": `-s` and `-X`; `ort` is the default; `--squash` described in options; `ort` is used for a single head; the `ort` option `ours` is stated to differ from the `ours` strategy, and `theirs` has no strategy twin (*read*) · covers our angle: **partial** — no guidance on when a strategy option is the wrong tool · fetched 2026-10-12
- **Also good:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · Pro Git · `-Xignore-all-space` and `-Xignore-space-change` re-merge examples (*read*) · fetched 2026-10-12
- **Our delta:** when `-X ours` is the wrong tool; the manual states the option-versus-strategy difference but not the decision.

### T02-13 · Detached HEAD — Understand · 🔲 not written
- **Read this:** [git-checkout](https://git-scm.com/docs/git-checkout) · git-scm.com · section "Detached HEAD": HEAD normally names a branch; commits made detached become unreferenced after you leave, kept by `git switch -c`, `git branch` or `git tag`, or found again via the reflog (*read*) · covers our angle: **partial** — ways of ending up detached other than checking out a tag or commit (remote-tracking ref) not confirmed · fetched 2026-10-12
- **Also good:** [git-switch](https://git-scm.com/docs/git-switch) · git-scm.com · `git switch --detach [<start-point>]` (*read* the synopsis) · fetched 2026-10-12

### T02-14 · Long-lived branch maintenance — Understand · 🔲 not written
- **Read this:** [Branching Workflows](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows) · git-scm.com (Pro Git) · "Long-Running Branches" and "Topic Branches"; merging repeatedly is easy with a simple three-way merge (*read*) · covers our angle: **partial** — nothing on merging main in versus rebasing, not confirmed · fetched 2026-10-12
- **Our delta:** what reviewers see under each choice; link to T02-06.

### T02-15 · `git rerere` — Know · 🔲 not written
- **Read this:** [Rerere](https://git-scm.com/book/en/v2/Git-Tools-Rerere) · git-scm.com (Pro Git) · `git config --global rerere.enabled true`; use with long-lived topic branches (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [git-rerere](https://git-scm.com/docs/git-rerere) · git-scm.com · "Reuse recorded resolution of conflicted merges", subcommands `clear`, `forget`, `diff`, `status`, `gc` (*read* the opening) · fetched 2026-10-12

### T02-16 · Stacked branches and `rebase.updateRefs` — Know · 🔲 not written
- **Read this:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · `--update-refs` force-updates branches pointing at rebased commits, skips branches checked out in a worktree; `rebase.updateRefs` sets it by default (*read*) · covers our angle: **partial** — option text only, no stacked-branch walkthrough · fetched 2026-10-12
- **Checked, not chosen:** [Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) (Pro Git; covers a branch off a branch with `--onto`, but not `--update-refs`).
- **Our delta:** a worked chain of three dependent branches.

### T02-17 · `git replay` — When Needed · 🔲 not written
- **Read this:** [git-replay](https://git-scm.com/docs/git-replay) · git-scm.com · still titled "EXPERIMENTAL" on 2026-10-12; `--onto`, `--advance`, `--revert`, `--contained`; leaves working tree and index untouched, works on bare repos (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** none beyond the experimental warning; recheck the label each release.

---

## Phase 3 — Reading history

Phase 3 is parked in the 2026-08-14 re-scope, so every row below is 🔲. The links are for a future author.

### T03-01 · Revision syntax — Master · 🔲 not written
- **Read this:** [gitrevisions](https://git-scm.com/docs/gitrevisions) · git-scm.com · `@{-<n>}`, `<branch>@{upstream}` and `@{u}`, `<rev>^<n>` parent selection, `<rev>~<n>`, `@` alone as HEAD, `<refname>@{<n>}`, `:/<text>` message search (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Revision Selection](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection) · Pro Git · `HEAD~` versus `^2` on merge commits, reflog `@{n}` (*read*) · fetched 2026-10-12

### T03-02 · Commit ranges — Master · 🔲 not written
- **Read this:** [Revision Selection](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection) · git-scm.com (Pro Git) · sections "Double Dot" and "Triple Dot", with `--left-right` showing which side each commit is on (*read*) · covers our angle: **partial** — how `git diff` reads the same syntax differently not confirmed · fetched 2026-10-12
- **Also good:** [gitrevisions](https://git-scm.com/docs/gitrevisions) · git-scm.com · the formal range rules (*headings only*) · fetched 2026-10-12

### T03-03 · `git log` beyond `--oneline` — Master · 🔲 not written
- **Read this:** [Viewing the Commit History](https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History) · git-scm.com (Pro Git) · `--stat`, `--pretty=format:`, `--graph` (*read*) · covers our angle: **partial** — no `--first-parent` · fetched 2026-10-12
- **Also good:** [git-log](https://git-scm.com/docs/git-log) · git-scm.com · `--first-parent` follows only the first parent at a merge; best for topic-branch overview (*read*; ≈18k words) · fetched 2026-10-12

### T03-04 · `git bisect` — Master · 🔲 not written
- **Read this:** [git-bisect](https://git-scm.com/docs/git-bisect) · git-scm.com · `start` / `bad` / `good`, `skip`, `git bisect run <cmd>` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Debugging with Git](https://git-scm.com/book/en/v2/Git-Tools-Debugging-with-Git) · Pro Git · `git bisect start HEAD v1.0` then `git bisect run test-error.sh` (*read*) · fetched 2026-10-12
- **Checked, not chosen:** [git-bisect-lk2009](https://git-scm.com/docs/git-bisect-lk2009) (a long bisect overview article, *headings only*; background, not a how-to).

### T03-05 · Searching history by content — Understand · 🔲 not written
- **Read this:** [Searching](https://git-scm.com/book/en/v2/Git-Tools-Searching) · git-scm.com (Pro Git) · `git log -S` pickaxe, `-G` for a regex, `-L` line history (*read*) · covers our angle: **partial** — `--grep` for messages is not on this page · fetched 2026-10-12
- **Also good:** [git-log](https://git-scm.com/docs/git-log) · git-scm.com · `-S` counts occurrences, `-G` matches patch text; a worked contrast (*read*) · fetched 2026-10-12

### T03-06 · `git blame` used fairly — Understand · 🔲 not written
- **Read this:** [Debugging with Git](https://git-scm.com/book/en/v2/Git-Tools-Debugging-with-Git) · git-scm.com (Pro Git) · `git blame -L 69,82`, and `-C` to find copied code (*read*) · covers our angle: **partial** — no `-w` or ignore-revs file · fetched 2026-10-12
- **Also good:** [git-blame](https://git-scm.com/docs/git-blame) · git-scm.com · synopsis lists `-w`, `-L`, `-C`, `--ignore-rev`, `--ignore-revs-file` (*headings only*; the `.git-blame-ignore-revs` file name not confirmed) · fetched 2026-10-12

### T03-07 · Following a file through time — Understand · 🔲 not written
- **Read this:** [git-log](https://git-scm.com/docs/git-log) · git-scm.com · `--follow` continues past renames and works only for a single file (*read*) · covers our angle: **partial** — rename-detection limits not covered · fetched 2026-10-12
- **Our delta:** the similarity limits; point at T01 rename detection.

### T03-08 · `git show` — Understand · 🔲 not written
- **Read this:** [git-show](https://git-scm.com/docs/git-show) · git-scm.com · shows blobs, trees, tags and commits (*headings only*; read the description) · covers our angle: **partial** — the `rev:path` form is not confirmed on this page · fetched 2026-10-12
- **Our delta:** `git show HEAD~3:src/app.js`; the colon syntax belongs to gitrevisions.

### T03-09 · Diff options that change the answer — Understand · 🔲 not written
- **Read this:** [Diff options](https://git-scm.com/docs/diff-options) · git-scm.com · `--patience`, `--histogram`, `--word-diff`, `-M`, `-w` (*read*) · covers our angle: full · fetched 2026-10-12

### T03-10 · `git range-diff` — Understand · 🔲 not written
- **Read this:** [git-range-diff](https://git-scm.com/docs/git-range-diff) · git-scm.com · "Compare two commit ranges (e.g. two versions of a branch)" (*read*) · covers our angle: **partial** — no force-push review walkthrough · fetched 2026-10-12
- **Our delta:** reviewing a force-pushed PR.

### T03-11 · Filtering by author, date and path — Understand · 🔲 not written
- **Read this:** [Viewing the Commit History](https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History) · git-scm.com (Pro Git) · `--since`, `--until`, `--author`, `--grep`, that several `--author` / `--grep` criteria can be given, path limiting with `--`, and a combined author, date, path example (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [git-log](https://git-scm.com/docs/git-log) · git-scm.com · `--author=<pattern>`, `--until=<date>` (*read*) · fetched 2026-10-12

### T03-12 · `git describe` — Know · 🔲 not written
- **Read this:** [git-describe](https://git-scm.com/docs/git-describe) · git-scm.com · finds the most recent reachable tag; output like `v1.0.4-14-g2414721`; `--dirty`, `--always` (*read*) · covers our angle: **partial** — build-pipeline use not discussed · fetched 2026-10-12

### T03-13 · `git shortlog -sn` — Know · 🔲 not written
- **Read this:** [git-shortlog](https://git-scm.com/docs/git-shortlog) · git-scm.com · `-n` sorts by commit count, `-s` gives a count only (*read*) · covers our angle: **partial** — what the numbers do not measure is our job · fetched 2026-10-12

### T03-14 · `git last-modified` — When Needed · 🔲 not written
- **Read this:** [git-last-modified](https://git-scm.com/docs/git-last-modified) · git-scm.com · titled "EXPERIMENTAL" on 2026-10-12; shows the last commit for each path, `--recursive`, `--max-depth` (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** none; recheck the label each release.
