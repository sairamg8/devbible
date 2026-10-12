---
title: "Link map · Git · Part 4 (phases 10–12)"
sidebar_label: "05 · Git · Depth & repair (10–12)"
sidebar_position: 5
---

# Link map · Git · Part 4 — Depth and repair (phases 10–12)

Covers every topic row of `docs/git/syllabus/04-depth-and-repair.md`: T10-01 to T10-14 (plumbing and internals), T11-01 to T11-13 (history surgery and migration), T12-01 to T12-14 (when Git goes wrong). That is 41 rows. The whole part is parked (re-scope of 2026-08-14), so every row is 🔲.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets git 2.55.0. git-scm.com showed **2.56.0** (2026-09-28) as the latest source release on 2026-10-12. The manual pages and Pro Git (2nd edition) show no page date, so only the fetch date is given. The `git pull` manual now says `--ff-only` is the default when nothing is configured, which differs from the row in phase 12 that says a bare pull stops with "Need to specify how to reconcile". Check that before writing. The `git-filter-repo` manual is not on git-scm.com (that URL returns 404); it is cited from `raw.githubusercontent.com`, because `github.com` returns 403 to our fetcher. `docs.gitlab.com` pages for repo size and numerous conflicts returned 403, so none is cited.

---

## Phase 10 — Plumbing and internals

### T10-01 · `hash-object` and `cat-file` — Understand · 🔲 not written
- **Read this:** [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) · git-scm.com (Pro Git) · writes a blob with `hash-object -w`, shows the stored text is a header plus content (`blob 16`, a NUL, then the content) hashed with SHA-1, and reads it back with `cat-file -t` and `-p` (*read*) · covers our angle: **partial** — `-s` is not demonstrated (not confirmed); it is in the manual · fetched 2026-10-12
- **Also good:** [git-cat-file](https://git-scm.com/docs/git-cat-file) · git-scm.com · `-t`, `-s`, `-p` and the `objectsize` format atoms (*read*) · fetched 2026-10-12
- **Our delta:** do the check ourselves: hash the file, then hash `"blob <size>\0<content>"`, and show the two differ.

### T10-02 · Inspecting trees and the index — Understand · 🔲 not written
- **Read this:** [git-ls-tree](https://git-scm.com/docs/git-ls-tree) · git-scm.com · lists a tree like `ls -a`; output has mode, type, object, path (*read* description) · covers our angle: **partial** — the index side is in another page · fetched 2026-10-12
- **Also good:** [git-ls-files](https://git-scm.com/docs/git-ls-files) · git-scm.com · `-s`/`--stage` shows what the index holds (*headings only* plus options read) · fetched 2026-10-12
- **Also good:** [git-rev-parse](https://git-scm.com/docs/git-rev-parse) · git-scm.com · turns names into object ids (*headings only*) · fetched 2026-10-12
- **Our delta:** compare `ls-files -s` with `status` for the same state.

### T10-03 · Building a commit by hand — Understand · 🔲 not written
- **Read this:** [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) · git-scm.com (Pro Git) · `update-index --cacheinfo`, `write-tree`, and `commit-tree` with `-p` for parents, ending with a log of hand-made commits (*read*) · covers our angle: **partial** — it stops before moving a branch; `update-ref` is on the References page · fetched 2026-10-12
- **Also good:** [git-update-ref](https://git-scm.com/docs/git-update-ref) · git-scm.com · stores a new object id in a ref, dereferencing symbolic refs (*read* description) · fetched 2026-10-12
- **Our delta:** the four commands in order, then `git log` and `fsck` to show nothing else was needed.

### T10-04 · `rev-list` and reachability — Understand · 🔲 not written
- **Read this:** [git-rev-list](https://git-scm.com/docs/git-rev-list) · git-scm.com · the walker behind `log`; `--objects`, `--count`, and a worked `--disk-usage` example for finding bloat (*read* passages) · covers our angle: **partial** — no gc or fetch-negotiation story · fetched 2026-10-12
- **Also good:** [git-merge-base](https://git-scm.com/docs/git-merge-base) · git-scm.com · includes the `--is-ancestor` idiom for "is A reachable from B" (*read*) · fetched 2026-10-12
- **Our delta:** tie reachability to what `gc` may delete (T10-10).

### T10-05 · Merge base computation — Understand · 🔲 not written
- **Read this:** [git-merge-base](https://git-scm.com/docs/git-merge-base) · git-scm.com · criss-cross merges can give more than one best common ancestor, with a diagram; `--all`; fork-point mode (*read*) · covers our angle: **partial** — nothing on `ort` · fetched 2026-10-12
- **Also good:** [Merge strategies](https://git-scm.com/docs/merge-strategies) · git-scm.com · `ort` is the default; `recursive` was the default from v0.99.9k until v2.33.0 and was redirected to mean `ort` in v2.50.0 (*read*) · fetched 2026-10-12
- **Our delta:** why `ort` replaced `recursive` is not stated by either page (not confirmed).

### T10-06 · Reflog storage and expiry — Understand · 🔲 not written
- **Read this:** [git-gc](https://git-scm.com/docs/git-gc) · git-scm.com · `gc.reflogExpire` defaults to 90 days, `gc.reflogExpireUnreachable` to 30 days (*read* config section) · covers our angle: **partial** — nothing on the `logs/` files being plain text · fetched 2026-10-12
- **Also good:** [git-reflog](https://git-scm.com/docs/git-reflog) · git-scm.com · `expire` options such as `--expire`, `--updateref`, `--stale-fix` (*read*) · fetched 2026-10-12
- **Also good:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git · recovering a lost commit after `reset --hard` (*read*) · fetched 2026-10-12
- **Our delta:** `ls .git/logs` and `cat .git/logs/HEAD` on a scratch repo.

### T10-07 · Packfiles in detail — Know · 🔲 not written
- **Read this:** [Packfiles](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) · git-scm.com (Pro Git) · loose objects versus a pack, delta storage with the newest version kept whole, `verify-pack -v` output, manual `git gc` (*read*) · covers our angle: **partial** — no delta-chain depth or base-object detail · fetched 2026-10-12
- **Also good:** [Pack format](https://git-scm.com/docs/gitformat-pack) · git-scm.com · the byte-level `.pack`/`.idx` spec (*headings only*) · fetched 2026-10-12
- **Also good:** [git-verify-pack](https://git-scm.com/docs/git-verify-pack) · git-scm.com · `-v` lists objects plus a histogram (*read* description) · fetched 2026-10-12
- **Our delta:** what `repack` rewrites; link to T10-10.

### T10-08 · Ref storage backends — Know · 🔲 not written
- **Read this:** [reftable](https://git-scm.com/docs/reftable) · git-scm.com · the format spec: motivation, comparison with JGit RefTree, stacked tables updated by atomic rename of `tables.list` (*read* passages) · covers our angle: **partial** — a format spec, not a how-to · fetched 2026-10-12
- **Also good:** [git-init](https://git-scm.com/docs/git-init) · git-scm.com · `--ref-format` and `init.defaultRefFormat` choose the backend at init (*read*) · fetched 2026-10-12
- **Also good:** [git-refs](https://git-scm.com/docs/git-refs) · git-scm.com · `migrate` between backends, `verify` (*read*) · fetched 2026-10-12
- **Also good:** [git-pack-refs](https://git-scm.com/docs/git-pack-refs) · git-scm.com · why one file per ref hurts with hundreds of refs (*read* description) · fetched 2026-10-12
- **Our delta:** the loose and `packed-refs` baseline, then what reftable changes.

### T10-09 · The index file format — Know · 🔲 not written
- **Read this:** [racy-git](https://git-scm.com/docs/racy-git) · git-scm.com · defines "racily clean" entries and how Git compares file mtime with the index timestamp (*read*) · covers our angle: **partial** — the entry layout is in the format page · fetched 2026-10-12
- **Also good:** [Index file format](https://git-scm.com/docs/gitformat-index) · git-scm.com · entry fields and extensions, including the sparse index (*headings only*) · fetched 2026-10-12
- **Our delta:** why `status` rehashes a file it did not need to.

### T10-10 · What `gc` does — Know · 🔲 not written
- **Read this:** [git-gc](https://git-scm.com/docs/git-gc) · git-scm.com · compresses, removes unreachable objects, packs refs, prunes reflog; `gc.pruneExpire` runs `prune --expire 2.weeks.ago` (*read*) · covers our angle: **full** — apart from the repack and prune contrast · fetched 2026-10-12
- **Also good:** [git-repack](https://git-scm.com/docs/git-repack) · git-scm.com · combines loose objects into a pack, or reorganises packs (*read* description) · fetched 2026-10-12
- **Also good:** [git-prune](https://git-scm.com/docs/git-prune) · git-scm.com · removes unreachable objects; usually run by `gc` (*read*) · fetched 2026-10-12
- **Our delta:** one table: `gc` versus `repack` versus `prune`, with the expiry arguments.

### T10-11 · Transfer and negotiation — Know · 🔲 not written
- **Read this:** [Transfer Protocols](https://git-scm.com/book/en/v2/Git-Internals-Transfer-Protocols) · git-scm.com (Pro Git) · `want`/`have` lines, `git-upload-pack`, response with a packfile (*read* passages) · covers our angle: **partial** — thin packs and server-side cost are not covered (not confirmed) · fetched 2026-10-12
- **Also good:** [Pack protocol](https://git-scm.com/docs/gitprotocol-pack) · git-scm.com · capability list includes `thin-pack` (*headings only*) · fetched 2026-10-12
- **Also good:** [Protocol v2](https://git-scm.com/docs/gitprotocol-v2) · git-scm.com · the `fetch` command (*headings only*) · fetched 2026-10-12
- **Our delta:** "slow on the server, not the network" has no source here yet.

### T10-12 · `replace` refs and grafts — Know · 🔲 not written
- **Read this:** [Replace](https://git-scm.com/book/en/v2/Git-Tools-Replace) · git-scm.com (Pro Git) · a worked history-grafting case, and sharing a replacement by pushing the ref (*read* passages) · covers our angle: **partial** — "grafts" as a legacy mechanism is not explained · fetched 2026-10-12
- **Also good:** [git-replace](https://git-scm.com/docs/git-replace) · git-scm.com · caveat: replace objects or grafts turn off the commit-graph (*read*) · fetched 2026-10-12
- **Our delta:** the one modern use, stitching two histories, and the commit-graph cost.

### T10-13 · Object stores shared between clones — When Needed · 🔲 not written
- **Read this:** [git-worktree](https://git-scm.com/docs/git-worktree) · git-scm.com · several working trees attached to one repository, so one object store (*read* description) · covers our angle: **partial** — no `alternates` · fetched 2026-10-12
- **Also good:** [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout) · git-scm.com · documents `objects/info/alternates` and `http-alternates` (*read*) · fetched 2026-10-12
- **Also good:** [git-clone](https://git-scm.com/docs/git-clone) · git-scm.com · `--reference` example for borrowing objects from a local directory (*read*) · fetched 2026-10-12
- **Our delta:** why a worktree is cheap and a clone is not.

### T10-14 · Reading Git's own documentation — Understand · 🔲 not written
- **Read this:** [gitglossary](https://git-scm.com/docs/gitglossary) · git-scm.com · every term, for example "alternate object database" (*headings only*, opening read) · covers our angle: **partial** — one of five concept pages · fetched 2026-10-12
- **Also good:** [gitrevisions](https://git-scm.com/docs/gitrevisions) · git-scm.com · how to specify revisions and ranges (*read* description) · fetched 2026-10-12
- **Also good:** [git-scm.com/docs](https://git-scm.com/docs) · git-scm.com · the reference index (*headings only*; the page is script-driven) · fetched 2026-10-12
- **Our delta:** `gitattributes`, `githooks` and `gitignore` also resolve (200) and are cited in phases 1–3.

---

## Phase 11 — History surgery and migration

### T11-01 · When a rewrite is justified, and when it is not — Understand · 🔲 not written
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · rewriting needs coordination with everyone who cloned it; if the data is a secret, revoke or rotate first, which may be enough (*read*) · covers our angle: **partial** — only the secret case of the four reasons · fetched 2026-10-12
- **Also good:** [git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt) · filter-repo author · has a sensitive-data section and examples for other reasons (*read* passages) · fetched 2026-10-12
- **Our delta:** wrong author, huge blob and repository split need their own justification.

### T11-02 · Coordinating a rewrite with the team — Understand · 🔲 not written
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · "high risk of recontamination": a stale clone doing `git pull` then `git push` brings the data back; discard and re-clone (*read*) · covers our angle: **full** for the push-back case · fetched 2026-10-12
- **Also good:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · has a recovering-from-upstream-rebase section (*headings only*; the text was not read) · fetched 2026-10-12
- **Our delta:** the announcement template and re-clone instruction.

### T11-03 · `git-filter-repo` — Know · 🔲 not written
- **Read this:** [git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt) · filter-repo author · options, examples, and why it wants a fresh clone (*read* passages) · covers our angle: **full** — except installation · fetched 2026-10-12
- **Also good:** [git-filter-branch](https://git-scm.com/docs/git-filter-branch) · git-scm.com · the warnings section: poor performance leads to safety issues (*read*) · fetched 2026-10-12
- **Also good:** [Converting from filter-branch](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/converting-from-filter-branch.md) · filter-repo author · command-by-command translation (*read* opening) · fetched 2026-10-12
- **Our delta:** filter-repo is not installed on this machine, so the page must say what produced its output. That `filter-branch` is formally deprecated is not confirmed.

### T11-04 · Removing a path or a large file from all history — Know · 🔲 not written
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · purge with git-filter-repo, then fully remove the data from GitHub (*read* headings) · covers our angle: **partial** — no size verification · fetched 2026-10-12
- **Also good:** [git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt) · filter-repo author · `--invert-paths --path`, `--strip-blobs-bigger-than`, and `--analyze` reports (*read*) · fetched 2026-10-12
- **Also good:** [git-rev-list](https://git-scm.com/docs/git-rev-list) · git-scm.com · `--disk-usage` for before and after sizes (*read*) · fetched 2026-10-12
- **Our delta:** measure size before and after.

### T11-05 · Rewriting author and committer identity — Know · 🔲 not written
- **Read this:** [Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) · git-scm.com (Pro Git) · changing an email across history with `filter-branch --commit-filter`, and that every hash changes (*read*) · covers our angle: **partial** — uses the old tool, not filter-repo · fetched 2026-10-12
- **Also good:** [git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt) · filter-repo author · `--mailmap` rewrites names and emails (*read*) · fetched 2026-10-12
- **Also good:** [gitmailmap](https://git-scm.com/docs/gitmailmap) · git-scm.com · the non-destructive alternative (*read* description) · fetched 2026-10-12
- **Our delta:** when the mailmap is enough and when a rewrite is the only fix.

### T11-06 · Merging two repositories with history intact — Know · 🔲 not written
- **Read this:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · git-scm.com (Pro Git) · the subtree-merge section, with its drawbacks (*read* passage) · covers our angle: **partial** — `--allow-unrelated-histories` and the merge-base outcome are elsewhere · fetched 2026-10-12
- **Also good:** [About Git subtree merges](https://docs.github.com/en/get-started/using-git/about-git-subtree-merges) · GitHub Docs · the subtree strategy steps (*read*) · fetched 2026-10-12
- **Also good:** [git-read-tree](https://git-scm.com/docs/git-read-tree) · git-scm.com · `--prefix` reads a tree under a directory (*read*) · fetched 2026-10-12
- **Our delta:** where the merge base ends up.

### T11-07 · Splitting a directory into its own repository — Know · 🔲 not written
- **Read this:** [Splitting a subfolder out into a new repository](https://docs.github.com/en/get-started/using-git/splitting-a-subfolder-out-into-a-new-repository) · GitHub Docs · clone, `git filter-repo --subdirectory-filter`, push to a new remote (*read*) · covers our angle: **partial** — re-pointing the original repo is not covered · fetched 2026-10-12
- **Also good:** [git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt) · filter-repo author · path-based filtering examples (*read*) · fetched 2026-10-12
- **Our delta:** removing the directory from the original.

### T11-08 · Renaming the default branch — Understand · 🔲 not written
- **Read this:** [Renaming a branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch) · GitHub Docs · rename in settings, then per clone `git branch -m`, `git fetch origin`, `git branch -u`, `git remote set-head origin -a` (*read*) · covers our angle: **partial** — CI and open-PR ordering is thin (not confirmed) · fetched 2026-10-12
- **Also good:** [Branches](https://docs.gitlab.com/user/project/repository/branches/) · GitLab Docs · GitLab's branch management (*headings only*) · fetched 2026-10-12
- **Our delta:** an order that does not break CI.

### T11-09 · Moving a repository between hosts — Understand · 🔲 not written
- **Read this:** [Duplicating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository) · GitHub Docs · `git clone --mirror`, push to the new location, and mirroring with `git push --mirror` (*read*) · covers our angle: **partial** — what is lost (issues, PRs, protections) is not listed (not confirmed) · fetched 2026-10-12
- **Also good:** [Manage projects](https://docs.gitlab.com/user/project/working_with_projects/) · GitLab Docs · transfer a project, with a "what data gets transferred" section (*headings only*) · fetched 2026-10-12
- **Also good:** [git-clone](https://git-scm.com/docs/git-clone) · git-scm.com · `--mirror` and `--bare` (*read*) · fetched 2026-10-12
- **Our delta:** mirror versus normal clone refs.

### T11-10 · `.mailmap` — Know · 🔲 not written
- **Read this:** [gitmailmap](https://git-scm.com/docs/gitmailmap) · git-scm.com · the file format and the mapping rules (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [git-shortlog](https://git-scm.com/docs/git-shortlog) · git-scm.com · reads `.mailmap` from the current directory (*read*) · fetched 2026-10-12
- **Also good:** [git-check-mailmap](https://git-scm.com/docs/git-check-mailmap) · git-scm.com · look up a canonical name and email (*read*) · fetched 2026-10-12
- **Our delta:** `blame` use is not checked here.

### T11-11 · Archiving — Know · 🔲 not written
- **Read this:** [git-archive](https://git-scm.com/docs/git-archive) · git-scm.com · tree to tarball or zip on stdout, `--prefix`; behaviour differs for a tree id versus a commit id (*read* description) · covers our angle: **partial** — not the lifecycle sense · fetched 2026-10-12
- **Also good:** [Archiving repositories](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories) · GitHub Docs · archived means issues, PRs, code and more are read-only; unarchive to change (*read*) · fetched 2026-10-12
- **Our delta:** none beyond joining the two meanings.

### T11-12 · Migrating a repository to SHA-256 — When Needed · 🔲 not written
- **Read this:** [git-init](https://git-scm.com/docs/git-init) · git-scm.com · `--object-format` takes `sha1` (default) or `sha256`; no interoperability between SHA-256 and SHA-1 repositories at present (*read*) · covers our angle: **partial** — no migration procedure · fetched 2026-10-12
- **Also good:** [hash-function-transition](https://git-scm.com/docs/hash-function-transition) · git-scm.com · the design document, ending in a document history from 2017 (*headings only*) · fetched 2026-10-12
- **Our delta:** the manual's own "no interoperability" wording is the limit to quote.

### T11-13 · Importing from another version-control system — When Needed · 🔲 not written
- **Read this:** [Migrating to Git](https://git-scm.com/book/en/v2/Git-and-Other-Systems-Migrating-to-Git) · git-scm.com (Pro Git) · per-system import (Perforce shown) and a custom importer using `fast-import` (*read* passages) · covers our angle: **partial** — what does not survive is not listed · fetched 2026-10-12
- **Also good:** [git-fast-import](https://git-scm.com/docs/git-fast-import) · git-scm.com · the stream format (*headings only*) · fetched 2026-10-12
- **Also good:** [Importing a repository with GitHub Importer](https://docs.github.com/en/migrations/importing-source-code/using-github-importer/importing-a-repository-with-github-importer) · GitHub Docs · host-side import (*headings only*) · fetched 2026-10-12
- **Our delta:** none found for the loss list.

---

## Phase 12 — When Git goes wrong

### T12-01 · "Your branch and 'origin/main' have diverged" — Master · 🔲 not written
- **Read this:** [git-pull](https://git-scm.com/docs/git-pull) · git-scm.com · quotes the message ("have 2 and 3 different commits each") and explains upstream tracking; four integration options (*read*) · covers our angle: **partial** — no picking a reconciliation by situation · fetched 2026-10-12
- **Also good:** [Remote Branches](https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches) · Pro Git · how remote-tracking refs move (*headings only*) · fetched 2026-10-12
- **Our delta:** read ahead and behind counts, then choose merge or rebase on purpose.

### T12-02 · "Updates were rejected because the remote contains work that you do not have" — Master · 🔲 not written
- **Read this:** [Dealing with non-fast-forward errors](https://docs.github.com/en/get-started/using-git/dealing-with-non-fast-forward-errors) · GitHub Docs · fetch then merge, or `git pull` (*read*) · covers our angle: **partial** — does not say why `--force` is almost never right · fetched 2026-10-12
- **Also good:** [git-push](https://git-scm.com/docs/git-push) · git-scm.com · `--force-with-lease` and non-fast-forward behaviour (*read*) · fetched 2026-10-12
- **Our delta:** when a force is genuinely right, with lease.

### T12-03 · "Your local changes to the following files would be overwritten" — Master · 🔲 not written
- **Read this:** [Stashing and Cleaning](https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning) · Pro Git · stash, then branch from a stash (*read*) · covers our angle: **partial** — the message itself is not quoted (not confirmed) · fetched 2026-10-12
- **Also good:** [git-restore](https://git-scm.com/docs/git-restore) · git-scm.com · discard working-tree edits (*headings only*) · fetched 2026-10-12
- **Our delta:** commit, stash or restore: how to choose.

### T12-04 · "Need to specify how to reconcile divergent branches" — Master · 🔲 not written
- **Read this:** [git-pull](https://git-scm.com/docs/git-pull) · git-scm.com · four options and `pull.rebase`, `pull.squash`, `pull.ff`; says `--ff-only` is the default and fails when diverged (*read*) · covers our angle: **partial** — conflicts with the syllabus wording; the "fatal" message is not on the page · fetched 2026-10-12
- **Our delta:** 🔴 reconcile the page with the manual, then show each setting's result.

### T12-05 · Detached HEAD, and the commits made in it — Master · 🔲 not written
- **Read this:** [git-checkout](https://git-scm.com/docs/git-checkout) · git-scm.com · the "detached HEAD" section: create a branch at the commit, or recover its name via `git reflog` if you moved away (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [git-switch](https://git-scm.com/docs/git-switch) · git-scm.com · `--detach`, and `git switch -c` to keep the work (*read*) · fetched 2026-10-12
- **Our delta:** recognise it from `status`.

### T12-06 · A conflict in a lockfile or a generated file — Master · 🔲 not written
- **Read this:** [Solving conflicts in package-lock.json](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json) · TkDodo's blog · dated Sep 2, 2020; fix `package.json`, then let npm rebuild the lock with `--package-lock-only`; do not delete the lock (*read*) · covers our angle: **partial** — npm only, from 2020; yarn (our tool) not covered · fetched 2026-10-12
- **Also good:** [gitattributes](https://git-scm.com/docs/gitattributes) · git-scm.com · custom merge drivers (*headings only*) · fetched 2026-10-12
- **Our delta:** the yarn lockfile procedure has no source here yet.

### T12-07 · "I committed to the wrong branch" — Understand · 🔲 not written
- **Read this:** [Oh Shit, Git!?!](https://ohshitgit.com/) · Katie Sylor-Miller · footer shows 2016-2025; `reset --soft`, stash, `checkout`, or cherry-pick (*read*) · covers our angle: **partial** — no pushed case, no `rebase --onto` · fetched 2026-10-12
- **Also good:** [git-cherry-pick](https://git-scm.com/docs/git-cherry-pick) · git-scm.com · copy commits across branches (*headings only*) · fetched 2026-10-12
- **Our delta:** the pushed versus unpushed split.

### T12-08 · "I committed with the wrong author" — Understand · 🔲 not written
- **Read this:** [Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) · git-scm.com (Pro Git) · amending the last commit, rewording a range, and changing an email across history (*read*) · covers our angle: **partial** — `--reset-author` is not checked · fetched 2026-10-12
- **Also good:** [gitmailmap](https://git-scm.com/docs/gitmailmap) · git-scm.com · the alternative that touches nothing (*read*) · fetched 2026-10-12
- **Our delta:** fix last, fix a range, or map.

### T12-09 · "refusing to merge unrelated histories" — Understand · 🔲 not written
- **Read this:** [git-merge](https://git-scm.com/docs/git-merge) · git-scm.com · `--allow-unrelated-histories` overrides the refusal for histories with no common ancestor (*read*) · covers our angle: **partial** — "when to say do not" is ours · fetched 2026-10-12
- **Our delta:** the honest answer is often "do not".

### T12-10 · "I ran `reset --hard` and lost work" — Understand · 🔲 not written
- **Read this:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git · does `reset --hard` to lose two commits, then recovers via the reflog (*read*) · covers our angle: **partial** — never-staged edits are not discussed · fetched 2026-10-12
- **Also good:** [Reset Demystified](https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified) · Pro Git · the table of what `--hard` touches (*read*) · fetched 2026-10-12
- **Our delta:** expiry (90 and 30 days, T10-06) bounds recovery; never-staged edits are not recoverable (a search result says so; not confirmed on a primary page).

### T12-11 · "I pushed a secret" — Understand · 🔲 not written
- **Read this:** [Remediating a leaked secret in your repository](https://docs.github.com/en/code-security/tutorials/remediate-leaked-secrets/remediating-a-leaked-secret) · GitHub Docs · nine ordered steps; revoke before cleaning; pushing a new commit does not stop exploitation (*read*) · covers our angle: **full** — GitHub-specific in parts · fetched 2026-10-12
- **Also good:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · rotate first (*read*) · fetched 2026-10-12
- **Our delta:** none; keep Git-only steps separate from host features.

### T12-12 · A stash that seems to have vanished — Understand · 🔲 not written
- **Read this:** [git-stash](https://git-scm.com/docs/git-stash) · git-scm.com · finding unreachable stash commits with `git fsck --unreachable` piped to `git log --grep=WIP`; failed apply leaves the entry on conflict (*read*) · covers our angle: **partial** — no reflog route · fetched 2026-10-12
- **Also good:** [git-fsck](https://git-scm.com/docs/git-fsck) · git-scm.com · dangling commit definition (*read*) · fetched 2026-10-12
- **Our delta:** finding the commit by reflog is not sourced.

### T12-13 · A rebase that has gone wrong midway — Understand · 🔲 not written
- **Read this:** [git-rebase](https://git-scm.com/docs/git-rebase) · git-scm.com · `--abort`, `--skip`, `--continue` and recovering from upstream rebase (*headings only*; long page) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Resolving merge conflicts after a Git rebase](https://docs.github.com/en/get-started/using-git/resolving-merge-conflicts-after-a-git-rebase) · GitHub Docs · stepwise conflict handling (*headings only*) · fetched 2026-10-12
- **Our delta:** returning to the exact pre-rebase commit (`ORIG_HEAD` and a recovering-from-upstream-rebase section appear on the page; the text around them was not read).

### T12-14 · Repository corruption and broken index — Know · 🔲 not written
- **Read this:** [git-fsck](https://git-scm.com/docs/git-fsck) · git-scm.com · what it checks; "hash mismatch" means serious data integrity problems (*read*) · covers our angle: **partial** — no index rebuild or fresh-clone advice · fetched 2026-10-12
- **Also good:** [Troubleshooting Git](https://docs.gitlab.com/topics/git/troubleshooting_git/) · GitLab Docs · host-side troubleshooting (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [Revert and undo changes](https://docs.gitlab.com/topics/git/undo/) · GitLab Docs · fine overview but mostly phase 5 ground · fetched 2026-10-12
- **Our delta:** delete and rebuild `.git/index` has no source.
