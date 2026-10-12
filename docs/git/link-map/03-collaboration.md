---
title: "Link map · Git · Part 2"
sidebar_label: "03 · Git · Collaboration (4–6)"
sidebar_position: 3
---

# Link map · Git · Part 2 — Working with other people (phases 4–6)

Covers every topic row of `docs/git/syllabus/02-collaboration.md`: T04-01 to T04-16 (remotes and syncing), T05-01 to T05-16 (undo, recover, rewrite) and T06-01 to T06-15 (team workflow, parked). That is 47 rows. Phase 4 rows 1–7 and 10 have a page of ours (✅, row 9 folded into row 3); phase 5 rows 1–8 have one (✅, rows 10 folded in row 4); every other row is 🔲.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus is verified against git 2.55.0; the git-scm.com docs pages showed changes up to **2.56.0** on 2026-10-12. Manual pages and Pro Git (2nd edition) show no page date, so only the fetch date is given. Pro Git predates `--force-with-lease` and `git backfill`, so those are cited from the manual. `github.com` returns 403 to our fetcher, so the filter-repo README is cited as a `raw.githubusercontent.com` copy. The `git pull` manual says `--ff-only` is the default when no reconciling method is set; our syllabus row says a bare pull fails. Check that on the page before quoting either.

---

## Phase 4 — Remotes and syncing

### T04-01 · A remote is a named URL, nothing more — Master · ✅ written `docs/git/pages/phase-4-remotes/01-a-remote-is-a-url.md`
- **Read this:** [Working with Remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes) · git-scm.com (Pro Git) · `git remote -v`, adding, `git remote rename`, more than one remote (*read*) · covers our angle: **partial** — `upstream` as a convention is not spelled out · fetched 2026-10-12
- **Also good:** [git-remote](https://git-scm.com/docs/git-remote) · git-scm.com · full synopsis: add, rename, remove, set-url, prune (*headings only*) · fetched 2026-10-12
- **Our delta:** `origin` and `upstream` are names, not keywords.

### T04-02 · `fetch` versus `pull` — Master · ✅ written `docs/git/pages/phase-4-remotes/02-fetch-vs-pull.md`
- **Read this:** [git-pull](https://git-scm.com/docs/git-pull) · git-scm.com · pull = fetch plus integrate; four integration options (`--ff-only`, `--rebase`, `--no-rebase`, `--squash`) (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [Working with Remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes) · Pro Git · fetch only downloads, does not merge (*read*) · fetched 2026-10-12
- **Our delta:** the fetch-then-look habit as a rule.

### T04-03 · Remote-tracking branches — Master · ✅ written `docs/git/pages/phase-4-remotes/03-remote-tracking-branches.md`
- **Read this:** [Remote Branches](https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches) · git-scm.com (Pro Git) · "local references that you can't move"; Git moves them on network communication (*read*) · covers our angle: **partial** — staleness is shown by diagram rather than stated; no pruning · fetched 2026-10-12
- **Also good:** [git-fetch](https://git-scm.com/docs/git-fetch) · git-scm.com · `-p --prune` removes remote-tracking refs gone from the remote (*read*) · fetched 2026-10-12
- **Our delta:** why it can be stale without warning.

### T04-04 · Upstream tracking — Master · ✅ written `docs/git/pages/phase-4-remotes/04-upstream-tracking.md`
- **Read this:** [gitrevisions](https://git-scm.com/docs/gitrevisions) · git-scm.com · defines `@{upstream}` / `@{u}` and `@{push}` (*read* both entries) · covers our angle: **partial** — no "ahead 2, behind 3" derivation · fetched 2026-10-12
- **Also good:** [Remote Branches](https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches) · Pro Git · tracking branches and `git pull` knowing what to fetch (*read*) · fetched 2026-10-12
- **Our delta:** how `git status` computes ahead and behind.

### T04-05 · Divergent branches — Master · ✅ written `docs/git/pages/phase-4-remotes/05-divergent-branches.md`
- **Read this:** [git-pull](https://git-scm.com/docs/git-pull) · git-scm.com · options for reconciling divergent histories and `pull.rebase` / `pull.ff` configuration (*read*) · covers our angle: **partial** — the exact `fatal:` text is not on the page · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · `pull.ff` entry (*read*; very large page) · fetched 2026-10-12
- **Our delta:** the error text and which default to set; the `--ff-only` default wording above is not confirmed to match.

### T04-06 · Force-pushing safely — Master · ✅ written `docs/git/pages/phase-4-remotes/06-force-pushing-safely.md`
- **Read this:** [git-push](https://git-scm.com/docs/git-push) · git-scm.com · `--force-with-lease`, `--force-if-includes` in the synopsis and the lease text (*read* the lease passage) · covers our angle: **partial** — why lease alone is not enough is only partly argued · fetched 2026-10-12
- **Our delta:** the fetched-but-never-integrated case.

### T04-07 · `git push` in full — Understand · ✅ written `docs/git/pages/phase-4-remotes/07-git-push.md`
- **Read this:** [git-push](https://git-scm.com/docs/git-push) · git-scm.com · default `push.default=simple`, `--delete`, `--tags`, `-u` (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [Remote Branches](https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches) · Pro Git · `git push origin --delete serverfix` (*read*) · fetched 2026-10-12

### T04-08 · Refspecs — Understand · 🔲 not written
- **Read this:** [The Refspec](https://git-scm.com/book/en/v2/Git-Internals-The-Refspec) · git-scm.com (Pro Git) · `fetch = +refs/heads/*:refs/remotes/origin/*`, the `+`, `src:dst` (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [git-fetch](https://git-scm.com/docs/git-fetch) · git-scm.com · refspec in the synopsis (*headings only*) · fetched 2026-10-12

### T04-09 · Pruning — Understand · ✅ written (folded into T04-03) `docs/git/pages/phase-4-remotes/03-remote-tracking-branches.md`
- **Read this:** [git-fetch](https://git-scm.com/docs/git-fetch) · git-scm.com · `-p --prune`, tags exception (*read*) · covers our angle: **partial** — `fetch.prune` is on git-config, not here · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · `fetch.prune` entry (*read*) · fetched 2026-10-12

### T04-10 · Transports and credentials — Understand · ✅ written `docs/git/pages/phase-4-remotes/08-transports-and-credentials.md`
- **Read this:** [Generating a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent) · GitHub Docs · `ssh-keygen -t ed25519`, agent setup (*read* the key command) · covers our angle: **partial** — SSH only; no tokens or helpers · fetched 2026-10-12
- **Also good:** [Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage) · Pro Git · default no caching; `cache` in memory 15 minutes; `store` plain text on disk (*read*) · fetched 2026-10-12
- **Also good:** [The Protocols](https://git-scm.com/book/en/v2/Git-on-the-Server-The-Protocols) · Pro Git · SSH versus HTTP (*headings only*) · fetched 2026-10-12
- **Our delta:** personal access tokens and where each helper stores the secret; the manual page [gitcredentials](https://git-scm.com/docs/gitcredentials) is the reference.

### T04-11 · Fork-and-upstream flow — Understand · 🔲 not written
- **Read this:** [Syncing a fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork) · GitHub Docs · keeping a fork current (*headings only*) · covers our angle: **partial** — GitHub-specific · fetched 2026-10-12
- **Also good:** [Fork a repository](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) · GitHub Docs · adding an `upstream` remote (*read*) · fetched 2026-10-12
- **Also good:** [Contributing to a Project](https://git-scm.com/book/en/v2/GitHub-Contributing-to-a-Project) · Pro Git · forking a project you cannot push to (*read*) · fetched 2026-10-12

### T04-12 · Shallow clones — Understand · 🔲 not written
- **Read this:** [git-clone](https://git-scm.com/docs/git-clone) · git-scm.com · `--depth` in the synopsis (*read* synopsis only) · covers our angle: **partial** — what breaks (blame, describe) is not stated by what I opened · fetched 2026-10-12
- **Also good:** [Get up to speed with partial clone and shallow clone](https://github.blog/open-source/git/get-up-to-speed-with-partial-clone-and-shallow-clone/) · GitHub Blog · Derrick Stolee, 2020-12-21, updated 2021-04-28 (*read* the blobless passage) · fetched 2026-10-12
- **Also good:** [git-fetch](https://git-scm.com/docs/git-fetch) · git-scm.com · `--unshallow` (*read*) · fetched 2026-10-12

### T04-13 · Partial clone — Know · 🔲 not written
- **Read this:** [git-backfill](https://git-scm.com/docs/git-backfill) · git-scm.com · blobless clone via `--filter=blob:none`; blame becomes slow; backfill downloads missing objects (*read* the description) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [Get up to speed with partial clone and shallow clone](https://github.blog/open-source/git/get-up-to-speed-with-partial-clone-and-shallow-clone/) · GitHub Blog · 2020-12-21 · blobless versus treeless (*read*) · fetched 2026-10-12
- *Checked, not chosen:* [partial-clone](https://git-scm.com/docs/partial-clone) · design notes, not a how-to.

### T04-14 · Signing — Know · 🔲 not written
- **Read this:** [About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) · GitHub Docs · GPG, SSH or S/MIME signed commits are marked verified; vigilant mode off by default (*read*) · covers our angle: **partial** — what "Verified" does not prove is not argued · fetched 2026-10-12
- **Also good:** [Signing Your Work](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work) · Pro Git · GPG signing and verifying (*headings only*) · fetched 2026-10-12
- **Our delta:** SSH signing via `gpg.format` is on the git-tag and git-config pages, not in Pro Git; `commit.gpgsign` not checked.

### T04-15 · Bare and mirror repositories — Know · 🔲 not written
- **Read this:** [git-clone](https://git-scm.com/docs/git-clone) · git-scm.com · `--bare` has no working tree; `--mirror` maps all refs and sets a refspec for `git remote update` (*read*) · covers our angle: **partial** — hosting your own is not covered · fetched 2026-10-12
- **Also good:** [Getting Git on a Server](https://git-scm.com/book/en/v2/Git-on-the-Server-Getting-Git-on-a-Server) · Pro Git · exporting a repo into a bare repository (*read*) · fetched 2026-10-12

### T04-16 · `git bundle` — Know · 🔲 not written
- **Read this:** [Bundling](https://git-scm.com/book/en/v2/Git-Tools-Bundling) · git-scm.com (Pro Git) · transferring Git data without a network (*read* the opening) · covers our angle: **partial** — no review-by-email case · fetched 2026-10-12
- **Also good:** [git-bundle](https://git-scm.com/docs/git-bundle) · git-scm.com · bundle format and examples (*headings only*) · fetched 2026-10-12

---

## Phase 5 — Undo, recover and rewrite

### T05-01 · The undo decision table — Master · ✅ written `docs/git/pages/phase-5-undo-recover/01-the-undo-decision-table.md`
- **Read this:** [Undoing Things](https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things) · git-scm.com (Pro Git) · amend, unstaging, discarding changes (*read*) · covers our angle: **partial** — no pushed-commit or merge rows; its unstage advice uses `git reset HEAD` · fetched 2026-10-12
- **Also good:** [git-reset](https://git-scm.com/docs/git-reset) · git-scm.com · "Undo a commit and redo" and other recipes (*read*) · fetched 2026-10-12
- **Our delta:** the single table, trouble to command.

### T05-02 · `reset` in terms of the three trees — Master · ✅ written `docs/git/pages/phase-5-undo-recover/02-reset-in-depth.md`
- **Read this:** [Reset Demystified](https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified) · git-scm.com (Pro Git) · HEAD, index, working directory as three trees; `--soft` stops after moving the branch (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [git-reset](https://git-scm.com/docs/git-reset) · git-scm.com · `--soft | --mixed | --hard | --merge | --keep` (*read*) · fetched 2026-10-12

### T05-03 · `revert` is the undo for shared history — Master · ✅ written `docs/git/pages/phase-5-undo-recover/03-revert.md`
- **Read this:** [git-revert](https://git-scm.com/docs/git-revert) · git-scm.com · records a new commit that reverses an earlier one; `-m` mainline (*read*) · covers our angle: **partial** — no rewrite-versus-revert guidance · fetched 2026-10-12
- **Our delta:** when to prefer it even on your own branch.

### T05-04 · Recovery with `reflog` — Master · ✅ written `docs/git/pages/phase-5-undo-recover/04-reflog-recovery.md`
- **Read this:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · git-scm.com (Pro Git) · recovery by adding a branch that points to a SHA-1 (*read*) · covers our angle: **partial** — expiry windows are on other pages · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · `gc.reflogExpire` defaults to 90 days, `gc.reflogExpireUnreachable` to 30 days (*read*) · fetched 2026-10-12
- **Also good:** [git-reflog](https://git-scm.com/docs/git-reflog) · git-scm.com · `expire` subcommand (*headings only*) · fetched 2026-10-12

### T05-05 · Rewriting your own last few commits — Master · ✅ written `docs/git/pages/phase-5-undo-recover/05-rewriting-your-own-commits.md`
- **Read this:** [Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) · git-scm.com (Pro Git) · amend, interactive rebase, fixup/squash in the todo list (*read*) · covers our angle: **partial** — `commit --fixup` with `--autosquash` is only in the manuals · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · `--autosquash`, `--update-refs` (*read* autosquash passage) · fetched 2026-10-12
- **Also good:** [git-commit](https://git-scm.com/docs/git-commit) · git-scm.com · `--fixup` and `--amend` in the synopsis (*headings only*) · fetched 2026-10-12

### T05-06 · Recovering a deleted branch — Understand · ✅ written `docs/git/pages/phase-5-undo-recover/06-recovering-a-branch.md`
- **Read this:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git · find the lost commit, then add a branch at its SHA-1 (*read*) · covers our angle: **partial** — `fsck` side is thin · fetched 2026-10-12
- **Also good:** [git-fsck](https://git-scm.com/docs/git-fsck) · git-scm.com · `--lost-found`, `--dangling` (*headings only*) · fetched 2026-10-12

### T05-07 · Undoing a merge — Understand · ✅ written `docs/git/pages/phase-5-undo-recover/07-undoing-a-merge.md`
- **Read this:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · git-scm.com (Pro Git) · "Undoing Merges": fix the references or reverse the commit (*read* the opening) · covers our angle: **partial** — the re-merge trap is only on the revert page · fetched 2026-10-12
- **Also good:** [git-revert](https://git-scm.com/docs/git-revert) · git-scm.com · `-m` names the mainline; reverting a merge declares you never want its tree changes, so later merges bring in less (*read*) · fetched 2026-10-12

### T05-08 · Undoing something already pushed — Understand · ✅ written `docs/git/pages/phase-5-undo-recover/08-undoing-something-pushed.md`
- **Read this:** [git-revert](https://git-scm.com/docs/git-revert) · git-scm.com · the shared-history undo (*read*) · covers our angle: **partial** — nothing on protected branches or telling the team · fetched 2026-10-12
- **Also good:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · GitHub Docs · settings list including require linear history and lock branch (*read*) · fetched 2026-10-12
- **Our delta:** communicating a rewrite; no page found that states it.

### T05-09 · Dangling objects and `git fsck` — Understand · 🔲 not written
- **Read this:** [git-fsck](https://git-scm.com/docs/git-fsck) · git-scm.com · checks connectivity; `--lost-found`, `--unreachable`, `--no-reflogs` (*read* options) · covers our angle: **partial** — reference, no walkthrough · fetched 2026-10-12
- **Also good:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git (*headings only*) · fetched 2026-10-12

### T05-10 · `gc`, `prune` and expiry windows — Understand · ✅ written (folded into T05-04) `docs/git/pages/phase-5-undo-recover/04-reflog-recovery.md`
- **Read this:** [git-gc](https://git-scm.com/docs/git-gc) · git-scm.com · `--prune` default 2 weeks via `gc.pruneExpire`; `gc.reflogExpire` 90 days (*read*) · covers our angle: **partial** — `--aggressive` effects not read · fetched 2026-10-12
- **Also good:** [git-prune](https://git-scm.com/docs/git-prune) · git-scm.com (*headings only*) · fetched 2026-10-12

### T05-11 · Stash recovery and stash conflicts — Understand · 🔲 not written (moved to `docs/git/pages/phase-1-everyday-loop/11-git-stash.md`)
- **Read this:** [git-stash](https://git-scm.com/docs/git-stash) · git-scm.com · a conflicted apply is not removed from the stash list; resolve, then `git stash drop` (*read*) · covers our angle: **partial** — finding a dropped stash is not covered by what I read · fetched 2026-10-12
- **Also good:** [Stashing and Cleaning](https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning) · Pro Git · applying on a different branch (*headings only*) · fetched 2026-10-12

### T05-12 · Removing a secret from history — Understand · 🔲 not written
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · the hosting side of cleanup (*headings only*) · covers our angle: **partial** — credential rotation order not confirmed · fetched 2026-10-12
- **Also good:** [git-filter-repo README (raw)](https://raw.githubusercontent.com/newren/git-filter-repo/main/README.md) · github (raw) · the tool the procedure uses (*headings only*) · fetched 2026-10-12

### T05-13 · The rewrite tools — Know · 🔲 not written
- **Read this:** [git-filter-branch](https://git-scm.com/docs/git-filter-branch) · git-scm.com · says filter-branch is not recommended and points to `git filter-repo` (*read*) · covers our angle: **partial** — filter-repo itself is not on git-scm.com · fetched 2026-10-12
- **Also good:** [git-filter-repo README (raw)](https://raw.githubusercontent.com/newren/git-filter-repo/main/README.md) · github (raw) (*headings only*) · fetched 2026-10-12
- **Also good:** [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) · rtyley.github.io · strips big blobs and replaces text, "faster" than filter-branch (*read*) · fetched 2026-10-12

### T05-14 · Squashing a branch before merge — Know · 🔲 not written
- **Read this:** [About pull request merges](https://docs.github.com/en/pull-requests/reference/pull-request-merges) · GitHub Docs · merge, squash and rebase options compared (*read* the intro) · covers our angle: **partial** — the local routes are elsewhere · fetched 2026-10-12
- **Also good:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · `--squash` in the synopsis (*headings only*) · fetched 2026-10-12
- **Also good:** [Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) · Pro Git · squashing in interactive rebase (*read*) · fetched 2026-10-12

### T05-15 · `ORIG_HEAD`, `MERGE_HEAD`, `CHERRY_PICK_HEAD` — Know · 🔲 not written
- **Read this:** none found — tried: "ORIG_HEAD MERGE_HEAD CHERRY_PICK_HEAD" against git-scm.com manuals. gitrevisions only lists these names among pseudo-refs; git-reset and git-update-ref mention `ORIG_HEAD` in passing; gitrepository-layout gave no match.
- *Checked, not chosen:* [gitrevisions](https://git-scm.com/docs/gitrevisions) · lists the names, no explanation.
- *Not opened:* the `git-cherry-pick` body for `CHERRY_PICK_HEAD` use.

### T05-16 · Recovering from a bad `rebase --onto` — Know · 🔲 not written
- **Read this:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · `--onto` and `ORIG_HEAD`-style recovery (*headings only*) · covers our angle: **partial** — reflog reading is on the reflog pages · fetched 2026-10-12
- **Also good:** [git-reflog](https://git-scm.com/docs/git-reflog) · git-scm.com (*headings only*) · fetched 2026-10-12

---

## Phase 6 — Team workflow and code review (parked 2026-08-14; all 🔲)

### T06-01 · The workflow families — Master · 🔲 not written
- **Read this:** [Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html) · martinfowler.com · mainline, feature branching, release and hotfix branches; 28 May 2020 (*headings only*; very long) · covers our angle: **partial** — no GitHub flow section confirmed · fetched 2026-10-12
- **Also good:** [Trunk Based Development](https://trunkbaseddevelopment.com/) · trunkbaseddevelopment.com · overview of the trunk model (*headings only*) · fetched 2026-10-12
- **Also good:** [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/) · nvie.com · git-flow origin, 2010, with a "Note of reflection" dated 2020-03-05 (*read*) · fetched 2026-10-12

### T06-02 · The pull request as the unit of work — Master · 🔲 not written
- **Read this:** [Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) · Google eng-practices · small changes reviewed faster (*read*) · covers our angle: **partial** — PR description and draft PRs are not covered · fetched 2026-10-12
- **Also good:** [Creating a pull request](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request) · GitHub Docs (*headings only*) · fetched 2026-10-12

### T06-03 · Merge, squash or rebase-merge — Master · 🔲 not written
- **Read this:** [About pull request merges](https://docs.github.com/en/pull-requests/reference/pull-request-merges) · GitHub Docs · merge commits, squash merges, rebases (*read* the intro) · covers our angle: **partial** — effect on bisect and revert not confirmed · fetched 2026-10-12
- **Also good:** [Merge methods](https://docs.gitlab.com/user/project/merge_requests/methods/) · GitLab Docs (*headings only*) · fetched 2026-10-12

### T06-04 · Tags and releases — Master · 🔲 not written
- **Read this:** [Tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging) · git-scm.com (Pro Git) · lightweight versus annotated; `git push` does not send tags by default (*read*) · covers our angle: **partial** — SemVer for apps is separate · fetched 2026-10-12
- **Also good:** [Semantic Versioning 2.0.0](https://semver.org/) · semver.org · MAJOR.MINOR.PATCH rules (*read* the summary) · fetched 2026-10-12
- **Also good:** [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) · GitHub Docs (*headings only*) · fetched 2026-10-12

### T06-05 · Keeping a branch reviewable — Understand · 🔲 not written
- **Read this:** none found — tried: "rebase vs merge main into feature branch review" on git-scm.com, GitHub Docs, Google eng-practices. Closest: [Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html) (28 May 2020, *headings only*), which covers integration frequency, not the reviewer's changes-since-last-review view.

### T06-06 · Branch naming and lifetime — Understand · 🔲 not written
- **Read this:** [Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html) · martinfowler.com · 28 May 2020 · "Healthy Branch" and integration frequency (*headings only*) · covers our angle: **partial** — no naming convention · fetched 2026-10-12
- **Our delta:** naming convention: no page found that states it.

### T06-07 · Reviewing a diff well — Understand · 🔲 not written
- **Read this:** [What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) · Google eng-practices · design first, then functionality (*read*) · covers our angle: **partial** — not GitHub-specific · fetched 2026-10-12
- **Also good:** [Reviewing proposed changes in a pull request](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request) · GitHub Docs (*headings only*) · fetched 2026-10-12

### T06-08 · Conventional Commits — Understand · 🔲 not written
- **Read this:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) · conventionalcommits.org · `type[optional scope]: description`, ties to SemVer (*read*) · covers our angle: **partial** — the cost of enforcing it is not argued · fetched 2026-10-12

### T06-09 · Protected branches and required checks — Understand · 🔲 not written
- **Read this:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · GitHub Docs · required reviews, status checks, linear history (*read* the settings list) · covers our angle: **partial** — `CODEOWNERS` is a separate page · fetched 2026-10-12
- **Also good:** [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) · GitHub Docs (*read* the intro) · fetched 2026-10-12

### T06-10 · Resolving a conflict-heavy PR — Understand · 🔲 not written
- **Read this:** [Resolving a merge conflict using the command line](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/resolving-a-merge-conflict-using-the-command-line) · GitHub Docs (*headings only*) · covers our angle: **partial** — no two-step approach · fetched 2026-10-12
- **Also good:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · Pro Git (*read* the opening) · fetched 2026-10-12

### T06-11 · Forks versus branches — Understand · 🔲 not written
- **Read this:** [What Is a Git Fork?](https://www.atlassian.com/git/tutorials/comparing-workflows/forking-workflow) · Atlassian · forking workflow (*headings only*) · covers our angle: **partial** — no trust-boundary argument · fetched 2026-10-12
- **Also good:** [Syncing a fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork) · GitHub Docs (*headings only*) · fetched 2026-10-12

### T06-12 · Monorepo versus polyrepo for a MERN/PERN app — Understand · 🔲 not written
- **Read this:** [Monorepo Explained](https://monorepo.tools/) · monorepo.tools (by Nx, a tool vendor; no page date) · defines a monorepo and discusses a "polyrepo tax" (*headings only*) · covers our angle: **partial** — vendor-written, nothing MERN-specific · fetched 2026-10-12
- **Our delta:** the CI, versioning and release costs for `web/`, `api/` and `db/`.

### T06-13 · Hotfixes — Know · 🔲 not written
- **Read this:** [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/) · nvie.com · hotfix branches with strict origin and merge targets, 2010 (*read*) · covers our angle: **partial** — cherry-pick not the mechanism there · fetched 2026-10-12
- **Also good:** [git-cherry-pick](https://git-scm.com/docs/git-cherry-pick) · git-scm.com (*headings only*) · fetched 2026-10-12

### T06-14 · Changelogs — Know · 🔲 not written
- **Read this:** [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) · keepachangelog.com (*headings only*) · covers our angle: **partial** — hand-written side only · fetched 2026-10-12

### T06-15 · The working agreement — Know · 🔲 not written
- **Read this:** none found — tried: "git team working agreement merge style branch naming" against Pro Git, GitHub Docs, Google eng-practices. Closest: [gitworkflows](https://git-scm.com/docs/gitworkflows) (git.git's own integration branches, *headings only*), which describes one project's rules, not a checklist.
