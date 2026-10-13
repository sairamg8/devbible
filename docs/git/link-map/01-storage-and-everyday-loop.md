---
title: "Link map · Git · Part 1 (phases 0–1)"
sidebar_label: "01 · Storage & everyday loop"
sidebar_position: 1
---

# Link map · Git · Part 1 (phases 0–1)

Covers every topic row of `docs/git/syllabus/01-how-git-works.md` in phase 0 (T00-01 to T00-14, how Git stores things) and phase 1 (T01-01 to T01-16, the everyday loop). That is 30 rows. Phase 1 lists 16 rows, but only 12 have a page of their own (the 2026-08-14 re-scope): ✅ means a written page of ours carries the topic, including T01-11 (folded into the commit-messages page) and T01-15 (merged into the rm/mv page); 🔲 means no page carries it as a topic (T01-13 and T01-16), and the block says where related text sits.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **git 2.55.0** (`docs/git/README.md`). git-scm.com on 2026-10-12 shows the manual at **2.56.0** (the `gitdatamodel` page lists 2.56.0 dated 2026-09-28). git-scm.com/docs is the latest manual and the Pro Git book is at git-scm.com/book/en/v2. Pro Git text and examples are older than the manual: its object pages show SHA-1 only, and its undo chapter was updated for `git restore` (2.23). SHA-256: `git init --object-format=sha256` works but `sha1` is the default; the manual's BreakingChanges page says the default is planned to change for a later major version, not confirmed as shipped. GitHub Docs pages were fetched at 200.

---

## Phase 0 — How Git stores things

### T00-01 · Git is a content-addressed object store — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/01-what-git-is.md`
- **Read this:** [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) · Pro Git · calls Git a content-addressable filesystem with a key-value store at its core, then shows `hash-object` returning the key (*read*) · covers our angle: **partial** — SHA-1 only; branches, tags and HEAD as labels are on the References page · fetched 2026-10-12
- **Also good:** [gitdatamodel](https://git-scm.com/docs/gitdatamodel) · git-scm.com · short official page: objects never change, each ID is a hash of type and contents (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Git from the Bottom Up](https://jwiegley.github.io/git-from-the-bottom-up/) · John Wiegley · builds up from blob to tree to commit and branches, then the index and reset, so the object store comes first, the order our page uses; page shows no date · fetched 2026-10-13 (*headings only*)
- **Our delta:** the "labels pointing into it" half (branches, tags, HEAD) and why nothing else makes sense first.

### T00-02 · A commit is a snapshot, not a diff — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/02-commit-is-a-snapshot.md`
- **Read this:** [What is Git?](https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F) · Pro Git · "Snapshots, Not Differences": other systems store file-based changes, Git stores a series of snapshots (*read*) · covers our angle: **partial** — does not separate the model from packfile delta compression · fetched 2026-10-12
- **Also good:** [gitdatamodel](https://git-scm.com/docs/gitdatamodel) · git-scm.com · a commit names the tree of the whole directory; Git does not store the diff, `git show` computes it from the parent (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Commits are snapshots, not diffs](https://github.blog/open-source/git/commits-are-snapshots-not-diffs/) · Derrick Stolee, GitHub Blog, 2020-12-17 · shows why cherry-pick and rebase make new commits with new IDs, which the diff mental model hides · fetched 2026-10-13 (*read*)
- **Our delta:** delta compression is a packfile detail, not the model (see T00-11).

### T00-03 · The four object types — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/03-object-types.md`
- **Read this:** [gitdatamodel](https://git-scm.com/docs/gitdatamodel) · git-scm.com · blob, tree, commit and tag object, each with its fields and an example from `git cat-file -p`; tree entries carry the filename and mode (*read*) · covers our angle: **partial** — never says outright that a blob has no filename (the tree entry carries it); page first appears in the 2.53.0 changelog · fetched 2026-10-12
- **Also good:** [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) · Pro Git · hands-on: a blob stores content, not the filename; trees solve that (*read*) · fetched 2026-10-12
- **Beyond the docs:** [A Deep Dive into Git Internals: Blobs, Trees, and Commits](https://dev.to/__whyd_rf/a-deep-dive-into-git-internals-blobs-trees-and-commits-1doc) · Vahid Ghadiri, DEV Community, 2025-07-07 · runs `hash-object`, `cat-file` and `ls-tree` and states that a blob holds content only, with no name or permissions · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit "what each object does not contain" framing, a blob has no filename.

### T00-04 · The three trees — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/04-three-trees.md`
- **Read this:** [Reset Demystified](https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified) · Pro Git · HEAD, Index, Working Directory as three trees, with a role for each; a command-by-command table of what moves (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Beyond the docs:** [A Tale of Three Trees](https://www.infoq.com/presentations/A-Tale-of-Three-Trees/) · Scott Chacon (Pro Git author), InfoQ talk from Strange Loop, 2011-11-09 · the same HEAD, index, work tree model told as a talk, with `reset` as the worked example; 2011, so predates `git restore` · fetched 2026-10-13 (*headings only*)
- **Our delta:** choosing the command by naming the two trees it moves between.

### T00-05 · The index is a real file — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/05-the-index.md`
- **Read this:** [Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) · Pro Git · "Staging Modified Files": a file edited after `git add` shows as both staged and unstaged (*read*) · covers our angle: **partial** — does not show `.git/index` as a file or that `add` copies bytes in · fetched 2026-10-12
- **Also good:** [gitdatamodel](https://git-scm.com/docs/gitdatamodel) · git-scm.com · THE INDEX: a flat list of file type, blob ID, stage number and path; `git ls-files --stage` shows it (*read*) · [gitformat-index](https://git-scm.com/docs/gitformat-index) · git-scm.com · the binary layout of the index file (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Git Guts: The staging index](https://awasu.com/weblog/git-guts/staging-index/) · Taka, Awasu weblog, 2022-01-07 · the index holds the whole working tree with your changes applied, not only the changes, and walks the file header, sorted entries and checksum · fetched 2026-10-13 (*read*)
- **Our delta:** inspecting `.git/index` itself, and that `git add` copies the bytes in.

### T00-06 · Refs and HEAD — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/06-refs-and-head.md`
- **Read this:** [gitdatamodel](https://git-scm.com/docs/gitdatamodel) · git-scm.com · REFERENCES section: `refs/heads`, `refs/tags`, `refs/remotes`, HEAD as symbolic reference, "detached HEAD state" when it holds a commit ID (*read*) · covers our angle: **partial** — no "a branch is a file" on disk (that is the Git References page) and does not call detached HEAD normal · fetched 2026-10-12
- **Also good:** [Git References](https://git-scm.com/book/en/v2/Git-Internals-Git-References) · Pro Git · shows the files on disk, `cat .git/HEAD`, and when HEAD becomes a raw hash (*read*) · fetched 2026-10-12
- **Beyond the docs:** [git branches: intuition & reality](https://jvns.ca/blog/2023/11/23/branches-intuition-reality/) · Julia Evans, 2023-11-23 · a branch is a tiny text file holding a commit ID, and Git keeps no record of where a branch came from; does not cover detached HEAD · fetched 2026-10-13 (*read*)
- **Our delta:** detached HEAD framed as a normal state, not an error.

### T00-07 · The commit graph is a DAG, not a timeline — Master · ✅ written `docs/git/pages/phase-0-how-git-stores-things/07-commit-graph.md`
- **Read this:** [Git for Computer Scientists](https://eagain.net/articles/git-for-computer-scientists/) · Tommi Virtanen (eagain.net) · objects as a DAG, commits with 0..n parents, refs as movable post-it notes; page shows no date (*read*) · covers our angle: **partial** — no mention of commit dates lying or of reachability as "before/after" · fetched 2026-10-12
- **Also good:** [gitglossary](https://git-scm.com/docs/gitglossary) · git-scm.com · defines the commit graph as the DAG formed by commits and branch tips (*read* that entry) · fetched 2026-10-12
- **Our delta:** reachability not clock time; author dates can lie, ancestry cannot. Third-party page is old (SHA-1 only): not confirmed current in detail.

### T00-08 · Config layers and precedence — Understand · ✅ written `docs/git/pages/phase-0-how-git-stores-things/08-config-layers.md`
- **Read this:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · SCOPES section lists system, global, local, worktree and command (`-c`); `--show-origin` and `--show-scope` (*read*) · covers our angle: **full** (very large page, ~330k characters; the scope parts are what matter) · fetched 2026-10-12
- **Also good:** [First-Time Git Setup](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup) · Pro Git · gentler: `git config --list --show-origin` shows each setting and where it comes from (*read*) · fetched 2026-10-12

### T00-09 · A tour of `.git/` — Understand · ✅ written `docs/git/pages/phase-0-how-git-stores-things/09-git-directory-tour.md`
- **Read this:** [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout) · git-scm.com · entry per item: `objects`, `refs`, `HEAD`, `index`, `logs`, `hooks` (*read* objects and logs entries) · covers our angle: **partial** — a reference, not a guided tour; does not say which parts are safe to read while learning · fetched 2026-10-12
- **Also good:** [Plumbing and Porcelain](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain) · Pro Git · introduces the chapter that walks through `.git` contents (*read* the intro) · fetched 2026-10-12
- **Beyond the docs:** [Exploring the .git Directory](https://www.git-tower.com/blog/exploring-the-git-directory) · Bruno Brito, Tower blog, updated February 2026 · goes through `HEAD`, `config`, `index`, `objects`, `refs`, `hooks` and `logs` one by one in plain language · fetched 2026-10-13 (*read*)
- **Our delta:** the "safe to read / do not hand-edit" judgement.

### T00-10 · Identity and first-run setup — Understand · ✅ written `docs/git/pages/phase-0-how-git-stores-things/10-identity-setup.md`
- **Read this:** [First-Time Git Setup](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup) · Pro Git · `user.name` and `user.email`, that every commit bakes them in; `init.defaultBranch` since 2.28 (*read*) · covers our angle: **partial** — no `Author identity unknown` failure text, no per-repo identity for work and personal commits · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · the Includes section: `include` and `includeIf` pull in another file, conditionally for `includeIf` (*read* that passage) · fetched 2026-10-12
- **Beyond the docs:** [Automatically keeping Git identities distinct between accounts](https://sep.com/blog/automatically-keeping-git-identities-distinct-between-accounts/) · Aaron Alexander, SEP, 2019-01-03 (updated 2026-01-29) · a worked `includeIf "gitdir:..."` setup with one identity file per folder, which the Pro Git page lacks · fetched 2026-10-13 (*read*)
- **Our delta:** the exact failure message and a per-repo or conditional-include recipe.

### T00-11 · Loose objects, packfiles and delta compression — Understand · ✅ written `docs/git/pages/phase-0-how-git-stores-things/11-loose-objects-and-packfiles.md`
- **Read this:** [Packfiles](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) · Pro Git · loose format, then `git gc` packs them; also packing happens on push; a delta stores a second object against the first (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) · Pro Git · auto gc runs when there are too many loose objects or packfiles (*read* the Maintenance passage) · fetched 2026-10-12
- **Beyond the docs:** [Git's database internals I: packed object store](https://github.blog/open-source/git/gits-database-internals-i-packed-object-store/) · Derrick Stolee, GitHub Blog, 2022-08-29 · pack index, fanout table and offset deltas, with a 19KB tree stored as a 50-byte delta and the `pack.depth` limit · fetched 2026-10-13 (*read*)
- **Our delta:** why repo size is not the sum of file sizes.

### T00-12 · What Git is not — Understand · ✅ written `docs/git/pages/phase-0-how-git-stores-things/12-what-git-is-not.md`
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · first revoke or rotate a leaked secret; clones and forks keep the commits (*read*) · covers our angle: **partial** — secrets only; says nothing on backups or deployment · fetched 2026-10-12
- **Also good:** [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) · GitHub Docs · 50 MiB warning, 100 MiB block, Git LFS; says Git is not designed for large SQL files (*read*) · fetched 2026-10-12
- **Our delta:** no page found that states "Git is not a backup / not a deployment tool"; our page owns that argument and must not cite one for it.
- *Checked, not chosen:* web search for "git is not a backup" returned only forum posts and vendor blogs.

### T00-13 · Object format: SHA-1 today, SHA-256 available — Know · ✅ written `docs/git/pages/phase-0-how-git-stores-things/13-object-format.md`
- **Read this:** [git-init](https://git-scm.com/docs/git-init) · git-scm.com · `--object-format` takes `sha1` or (if enabled) `sha256`, `sha1` default; states no interoperability between SHA-256 and SHA-1 repositories at present (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [hash-function-transition](https://git-scm.com/docs/hash-function-transition) · git-scm.com · design document: SHA-256 picked as successor in late 2018; `extensions.objectFormat` and `compatObjectFormat` (*read* in part) · [BreakingChanges](https://git-scm.com/docs/BreakingChanges) · git-scm.com · under Git 3.0: default hash for new repositories planned to change from `sha1` to `sha256`; no release date planned (*read* that passage) · fetched 2026-10-12
- **Beyond the docs:** [Whatever happened to SHA-256 support in Git?](https://lwn.net/Articles/898522/) · Jonathan Corbet, LWN.net, 2022-06-23 · why the move stalled: no SHA-1 interoperability and no hosting support; written in 2022, so check the manual for today's state · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 the SHA-256 default is planned for Git 3.0, not shipped; the `sha1` default holds today.

### T00-14 · Plumbing versus porcelain — Know · ✅ written `docs/git/pages/phase-0-how-git-stores-things/14-plumbing-vs-porcelain.md`
- **Read this:** [Plumbing and Porcelain](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain) · Pro Git · plumbing commands are low-level and chainable in scripts, porcelain the friendlier ones (*read*) · covers our angle: **partial** — does not say why scripts should target plumbing or how to find the plumbing behind a porcelain command · fetched 2026-10-12
- **Also good:** [git](https://git-scm.com/docs/git) · git-scm.com · splits the commands into high-level (porcelain) and low-level (plumbing), with the full list of each (*read*) · [git-status](https://git-scm.com/docs/git-status) · git-scm.com · `--porcelain` output stays stable across versions and user config, for scripts (*read*) · fetched 2026-10-12
- **Beyond the docs:** [A Plumber's Guide to Git](https://alexwlchan.net/a-plumbers-guide-to-git/) · Alex Chan (alexwlchan), updated 2018-03-13 · a sink analogy for the split, then a workshop that uses plumbing commands to look inside `.git` · fetched 2026-10-13 (*read*)
- **Our delta:** the script-stability argument and how to find the plumbing behind a porcelain command.

---

## Phase 1 — The everyday loop

### T01-01 · `git status` is the instrument panel — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/01-git-status/README.md`
- **Read this:** [git-status](https://git-scm.com/docs/git-status) · git-scm.com · short format `XY` two-letter code, `--porcelain` versions, untracked files and performance (*read* those sections; rest *headings only*) · covers our angle: **partial** — a reference, not a guide to reading the three sections as the three trees · fetched 2026-10-12
- **Also good:** [Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) · Pro Git · "Checking the Status of Your Files" and "Short Status" with `-s` output (*read*) · fetched 2026-10-12
- **Our delta:** the three-trees reading; sub-pages cover porcelain output and untracked performance.

### T01-02 · `git add` in full — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/02-git-add/README.md`
- **Read this:** [git-add](https://git-scm.com/docs/git-add) · git-scm.com · synopsis shows `-A`, `-u`, `-p`, `-i`, `-N`, pathspec forms (*read* synopsis and description) · covers our angle: **partial** — options reference, little on why `-p` improves commit quality · fetched 2026-10-12
- **Also good:** [Interactive Staging](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging) · Pro Git · "Staging Patches": stage one of two changes in the same file (*read*) · fetched 2026-10-12

### T01-03 · `git commit` — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/03-git-commit.md`
- **Read this:** [git-commit](https://git-scm.com/docs/git-commit) · git-scm.com · creates a commit from the current contents of the index; new commit is a direct child of HEAD; `--amend`, `--trailer` (*read* description) · covers our angle: **partial** — does not stress that amend gives a new hash · fetched 2026-10-12
- **Also good:** [Undoing Things](https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things) · Pro Git · `git commit --amend` takes the staging area and replaces the last commit (*read*) · fetched 2026-10-12

### T01-04 · `git diff` and the three questions — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/04-git-diff.md`
- **Read this:** [Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) · Pro Git · "Viewing Your Staged and Unstaged Changes": unstaged against the index, then staged against the last commit (*read*) · covers our angle: **partial** — the working-tree-against-`HEAD` form not confirmed on this page · fetched 2026-10-12
- **Also good:** [git-diff](https://git-scm.com/docs/git-diff) · git-scm.com · synopsis lists bare, `--cached`, commit-versus-commit and `--no-index` forms (*read* synopsis) · fetched 2026-10-12

### T01-05 · `.gitignore` — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/05-gitignore.md`
- **Read this:** [gitignore](https://git-scm.com/docs/gitignore) · git-scm.com · precedence order across sources, negation with `!` and the rule that a file in an excluded directory cannot be re-included, `info/exclude`, global ignore file (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [git-check-ignore](https://git-scm.com/docs/git-check-ignore) · git-scm.com · `-v` prints the exclude pattern that matched each path, and notes a negated pattern means not excluded (*read*) · fetched 2026-10-12

### T01-06 · Ignoring does not untrack — Understand · ✅ written `docs/git/pages/phase-1-everyday-loop/06-ignoring-does-not-untrack.md`
- **Read this:** [gitignore](https://git-scm.com/docs/gitignore) · git-scm.com · NOTES: files already tracked are not affected; use `git rm --cached` then add to `.gitignore` (*read*) · covers our angle: **partial** — nothing on why the fix alone leaves the secret in history · fetched 2026-10-12
- **Also good:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · the "not enough on its own" half: rotate the secret first (*read*) · fetched 2026-10-12

### T01-07 · `git switch` and `git restore` — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/07-switch-and-restore.md`
- **Read this:** [Highlights from Git 2.23](https://github.blog/open-source/git/highlights-from-git-2-23/) · GitHub Blog, Taylor Blau, 2019-08-16 (updated 2021-03-12) · why `checkout` was split in two and what each new command does (*read* the first sections) · covers our angle: **partial** — written when both were experimental; the current manuals no longer say so · fetched 2026-10-12
- **Also good:** [git-restore](https://git-scm.com/docs/git-restore) · git-scm.com · `--staged`, `--worktree`, `--source` (*read*) · [git-switch](https://git-scm.com/docs/git-switch) · git-scm.com · the matching manual page: switch branches (*read* synopsis) · fetched 2026-10-12
- **Our delta:** reading tutorials that predate both.

### T01-08 · Undo before you push — Master · ✅ written `docs/git/pages/phase-1-everyday-loop/08-undo-before-you-push.md`
- **Read this:** [Reset Demystified](https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified) · Pro Git · table of `reset --soft/mixed/hard` and `checkout` with HEAD, Index, Workdir columns and a "WD Safe?" column (*read*) · covers our angle: **partial** — predates `git restore`, so no `restore --staged` row · fetched 2026-10-12
- **Also good:** [Undoing Things](https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things) · Pro Git · covers `git restore` for unstaging and discarding (*read*) · [git-reset](https://git-scm.com/docs/git-reset) · git-scm.com · the manual: `--soft`, `--mixed`, `--hard`, `--merge`, `--keep` (*read* synopsis) · fetched 2026-10-12
- **Beyond the docs:** [How to reset, revert, and return to previous states in Git](https://opensource.com/article/18/6/git-reset-revert-rebase-commands) · Brent Laster, Opensource.com, 2018-06-19 · frames `reset --soft`, `--mixed` and `--hard` by how far each reaches across the three areas, and recovery via `ORIG_HEAD` and the reflog; predates `git restore` · fetched 2026-10-13 (*read*)
- **Our delta:** our effect table adds the `restore` rows.

### T01-09 · `git log` for the everyday case — Understand · ✅ written `docs/git/pages/phase-1-everyday-loop/09-git-log.md`
- **Read this:** [Viewing the Commit History](https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History) · Pro Git · `--oneline`, graph output, and "Limiting Log Output" (*read* limiting section, which includes the path filter; rest *headings only*) · covers our angle: **partial** — no `--decorate` on this page · fetched 2026-10-12
- **Also good:** [git-log](https://git-scm.com/docs/git-log) · git-scm.com · full option reference (~109k characters, *headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Power 'git log' graphing](https://zwischenzugs.com/2016/06/04/power-git-log-graphing/) · Ian Miell, zwischenzugs, 2016-06-04 · builds up `--graph`, `--all`, `--decorate`, `--oneline` and `--topo-order` one flag at a time into a single alias · fetched 2026-10-13 (*read*)

### T01-10 · Commit message craft — Understand · ✅ written `docs/git/pages/phase-1-everyday-loop/10-commit-messages.md`
- **Read this:** [How to Write a Git Commit Message](https://cbea.ms/git-commit/) · Chris Beams, 2014-08-31 · seven rules: 50 characters, imperative mood, wrap body at 72, explain what and why (*read*) · covers our angle: **partial** — no trailer lines · fetched 2026-10-12
- **Also good:** [SubmittingPatches](https://git-scm.com/docs/SubmittingPatches) · git-scm.com · the Git project's own rule: describe changes in imperative mood (*read*) · [git-commit](https://git-scm.com/docs/git-commit) · git-scm.com · `--trailer <token>` is in the synopsis (*read* synopsis) · fetched 2026-10-12
- **Our delta:** trailers.

### T01-11 · What belongs in one commit — Understand · ✅ written (folded into `docs/git/pages/phase-1-everyday-loop/10-commit-messages.md`)
- **Read this:** [Contributing to a Project](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project) · Pro Git · "Commit Guidelines": make each commit a logically separate changeset; split a weekend's work with the staging area (*read*) · covers our angle: **partial** — nothing on bisect or revert-alone, the atomic test · fetched 2026-10-12
- **Also good:** [SubmittingPatches](https://git-scm.com/docs/SubmittingPatches) · git-scm.com · "Make separate commits for logically separate changes" (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Writing High Quality, Well Scoped, Commits](https://jeffreyfreeman.me/blog/writing-high-quality-well-scoped-commits/) · Jeffrey Phillips Freeman, 2025-04-28 · the one-sentence size test, why a commit mixing concerns is hard to revert alone, and why commits that break the build mislead `git bisect` · fetched 2026-10-13 (*read*)
- **Our delta:** the builds/passes/does-one-thing/revertable test and the bisect payoff.

### T01-12 · `git stash` — Understand · ✅ written `docs/git/pages/phase-1-everyday-loop/11-git-stash.md`
- **Read this:** [Stashing and Cleaning](https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning) · Pro Git · stash list, apply, `--include-untracked`, `--all`; notes `stash save` is deprecated for `stash push` (*read*) · covers our angle: **partial** — naming stashes is thin · fetched 2026-10-12
- **Also good:** [git-stash](https://git-scm.com/docs/git-stash) · git-scm.com · synopsis: `push -m`, `-u`, `-a`, `-S`, `branch`, `show` (*read* synopsis) · fetched 2026-10-12

### T01-13 · The file state machine — Understand · 🔲 not written (the status chunks `docs/git/pages/phase-1-everyday-loop/01-git-status/01-the-three-sections.md` cover related ground, but none lays out the state machine)
- **Read this:** [Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) · Pro Git · "The lifecycle of the status of your files" figure and the tracked/untracked/staged/modified walk-through (*read*) · covers our angle: **partial** — no ignored state · fetched 2026-10-12
- **Beyond the docs:** [Git, the many parts: five categories of files](https://jessitron.com/2012/12/09/git-the-many-parts-five-categories-of-files/) · Jessitron (Jessica Kerr), 2012-12-09 (updated 2019-05-26) · sorts files into five categories beyond the usual three places, with untracked and ignored status as the new ones; says a file ignored after commit ends up both modified and ignored · fetched 2026-10-13 (*read*)
- **Our delta:** the ignored state and the transitions with no obvious command.

### T01-14 · `git rm`, `git mv`, and rename detection — Understand · ✅ written `docs/git/pages/phase-1-everyday-loop/12-removing-and-moving.md`
- **Read this:** [Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository) · Pro Git · "Removing Files" (`rm --cached`) and "Moving Files": Git stores no rename metadata, works it out after the fact (*read*) · covers our angle: **partial** — no similarity threshold · fetched 2026-10-12
- **Also good:** [git-diff](https://git-scm.com/docs/git-diff) · git-scm.com · `-M` and `--find-renames=n`: a delete/add pair counts as a rename above a similarity threshold (*read*) · fetched 2026-10-12
- **Our delta:** why rename plus an edit can read as delete plus add. Manual pages `git-rm` and `git-mv` also exist at git-scm.com/docs; they are references, not chosen.

### T01-15 · `git clean` — Understand · ✅ written (merged into `docs/git/pages/phase-1-everyday-loop/12-removing-and-moving.md`)
- **Read this:** [Stashing and Cleaning](https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning) · Pro Git · "Cleaning your Working Directory": be careful, nothing is recoverable; run `-n` first (*read*) · covers our angle: **full** — `-n` first, `-d`, and `-x` also removing ignored files are all there; the `.env` example is ours · fetched 2026-10-12
- **Also good:** [git-clean](https://git-scm.com/docs/git-clean) · git-scm.com · `-x` also removes ignored files; `-n`, `-d`, `-f`, `-i` (*read*) · fetched 2026-10-12

### T01-16 · Finding the documentation — Know · 🔲 not written
- **Read this:** [Getting Help](https://git-scm.com/book/en/v2/Getting-Started-Getting-Help) · Pro Git · `git help <verb>`, `git <verb> --help`, `man git-<verb>`, works offline (*read*) · covers our angle: **partial** — no concept pages (`gitglossary`, `gitrevisions`, `githooks`) and no `-h` versus `help` contrast · fetched 2026-10-12
- **Also good:** [git-help](https://git-scm.com/docs/git-help) · git-scm.com · `git help -g` lists the guides (*read* synopsis) · [gitglossary](https://git-scm.com/docs/gitglossary) · git-scm.com · a concept page: defines the terms the manual uses (*headings only*) · fetched 2026-10-12
- **Our delta:** a short list of the concept pages and what each answers; `giteveryday` is another (fetched 200, *headings only*).
- *Not opened:* `gitrevisions`, `githooks` (fetched 200 on 2026-10-12, not read).
