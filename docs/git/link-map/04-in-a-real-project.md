---
title: "Link map · Git · Part 3 (phases 7–9)"
sidebar_label: "04 · Git · In a real project (7–9)"
sidebar_position: 4
---

# Link map · Git · Part 3 — Git in a real project (phases 7–9)

Covers every topic row of `docs/git/syllabus/03-in-a-real-project.md`: T07-01 to T07-15 phase 7 (the repository in a fullstack project), T08-01 to T08-14 phase 8 (hooks, CI and automation), T09-01 to T09-13 phase 9 (speed, scale and daily ergonomics). That is 42 rows. All 42 are 🔲: this whole part was parked in the 2026-08-14 re-scope, and `docs/git/pages` holds no phase 7, 8 or 9 folder. Where a written page of ours already holds related text, the block names it under *Our delta* (T07-01, T07-02, T08-06, T09-07, T09-09); that text is not the row's own page.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus is verified against git 2.55.0. git-scm.com showed 2.56.0 as the newest manual on 2026-10-12 (the `git-commit-graph` page lists "2.56.0 no changes"). The manual pages and Pro Git (2nd edition) show no page date, so only the fetch date is given. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies. Hosting rows (merge queue, protected branches, Dependabot, push protection) are GitHub docs; GitLab equivalents were not checked.

---

## Phase 7 — The repository in a fullstack project

### T07-01 · `.gitignore` for a Node/React repository — Master · 🔲 not written
- **Read this:** [gitignore](https://git-scm.com/docs/gitignore) · git-scm.com · pattern format, and that files already tracked are not affected (*read* the description) · covers our angle: **partial** — no Node or React rules and no reason per rule · fetched 2026-10-12
- **Also good:** [Node.gitignore](https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore) · GitHub's template (raw) · logs, coverage, `.nyc_output`, build and dependency entries, each under a comment (*read*) · fetched 2026-10-12
- **Also good:** [Ignoring files](https://docs.github.com/en/get-started/git-basics/ignoring-files) · GitHub Docs · `git rm --cached` to untrack, global ignore file, `.git/info/exclude` (*read*) · fetched 2026-10-12
- **Our delta:** the reason for every line, and "ignore the output, track the config that generates it". Related text: `docs/git/pages/phase-1-everyday-loop/05-gitignore.md` has a table of what belongs in a project `.gitignore` (`node_modules/`, `dist/`, `.env`).

### T07-02 · Secrets never enter the repository — Master · 🔲 not written
- **Read this:** [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) · GitHub Docs · for a secret, the first step is to revoke or rotate it; rewriting history has side effects (*read*) · covers our angle: **partial** — no `.env` / `.env.example` pattern and no "private repo is not a vault" argument · fetched 2026-10-12
- **Also good:** [Config (twelve-factor)](https://12factor.net/config) · 12factor.net · config files checked into a repo are easy to commit by mistake (*read*) · fetched 2026-10-12
- **Also good:** [About push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) · GitHub Docs · blocks pushes containing secrets (*headings only*) · fetched 2026-10-12
- **Our delta:** rotate first, then the Phase 5 removal; the `.env.example` convention. Related text: `docs/git/pages/phase-1-everyday-loop/06-ignoring-does-not-untrack.md` (`git rm --cached .env`).

### T07-03 · Lockfiles are committed, always — Master · 🔲 not written
- **Read this:** [package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/) · docs.npmjs.com · the file is meant to be committed so teammates, deployments and CI install identical trees (*read*) · covers our angle: **partial** — npm only, no "works on my machine" diagnosis · fetched 2026-10-12
- **Also good:** [yarn.lock](https://classic.yarnpkg.com/en/docs/yarn-lock) · classic.yarnpkg.com · "Check into source control", same exact tree on every machine (*read*; Yarn 1 docs) · fetched 2026-10-12
- **Our delta:** the uncommitted-lockfile story behind most "works on my machine" reports.

### T07-04 · Resolving a lockfile conflict — Understand · 🔲 not written
- **Read this:** [Solving conflicts in package-lock.json](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json) · TkDodo · 2020-09-02 · argues against deleting the lockfile and reinstalling (*read* the opening) · covers our angle: **partial** — npm only; I did not read to the end for the exact recipe · fetched 2026-10-12
- **Also good:** [Git + NPM: Resolving Lockfile Conflicts](https://til.hashrocket.com/posts/p1qugz14bc-git-npm-resolving-lockfile-conflicts-) · Hashrocket TIL · 2020-07-31 (modified 2021-07-20) · `npm install --package-lock-only` at the conflicting commit regenerates the file (*read*) · fetched 2026-10-12
- **Our delta:** the "never hand-merge" rule and why; Yarn behaviour is not covered by either page.

### T07-05 · Generated versus authored files — Understand · 🔲 not written
- **Read this:** [Customizing how changed files appear on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) · GitHub Docs · `linguist-generated` in `.gitattributes` keeps files out of default diffs and language stats (*read* the opening) · covers our angle: **partial** — an attribute, not the test for whether a generated file belongs in the repo · fetched 2026-10-12
- **Checked, not chosen:** a web search found no general page on that test; one project's guideline (Gobo Eiffel) came up and was *not opened*.
- **Our delta:** the belongs-in-the-repo test and the review cost of tracking output.

### T07-06 · Database migrations under version control — Understand · 🔲 not written
- **Read this:** [Troubleshooting (Prisma Migrate)](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/troubleshooting) · prisma.io · switching feature branches can cause a migration history conflict (*read* that passage) · covers our angle: **partial** — Prisma only; filename collision and timestamp naming are not stated in what I read · fetched 2026-10-12
- **Not opened:** Knex, Sequelize and node-pg-migrate docs.
- **Our delta:** append-only history, why renumbering after merge is wrong, timestamp names; the page must pin one tool.

### T07-07 · `.gitattributes` — Understand · 🔲 not written
- **Read this:** [gitattributes](https://git-scm.com/docs/gitattributes) · git-scm.com · `text`, `text=auto`, `eol`, per-path merge attributes (*read* the text and eol sections) · covers our angle: **partial** — `linguist-*` is a GitHub feature, not in this manual · fetched 2026-10-12
- **Also good:** [Git Attributes](https://git-scm.com/book/en/v2/Customizing-Git-Git-Attributes) · Pro Git · marking binary files, per-path merge strategies, `export-ignore` (*read*) · fetched 2026-10-12
- **Also good:** [Customizing how changed files appear on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) · GitHub Docs · the `linguist-*` attributes (*read* the opening) · fetched 2026-10-12

### T07-08 · Line endings — Understand · 🔲 not written
- **Read this:** [Configuring Git to handle line endings](https://docs.github.com/en/get-started/git-basics/configuring-git-to-handle-line-endings) · GitHub Docs · `core.autocrlf` per OS; a committed `.gitattributes` overrides it for all contributors; a `* text=auto` template (*read*) · covers our angle: **partial** — no account of the "every line changed" diff · fetched 2026-10-12
- **Also good:** [gitattributes](https://git-scm.com/docs/gitattributes) · git-scm.com · `text=auto` and `eol` semantics (*read*) · fetched 2026-10-12

### T07-09 · `git worktree` — Understand · 🔲 not written
- **Read this:** [git-worktree](https://git-scm.com/docs/git-worktree) · git-scm.com · main versus linked worktrees; a branch checked out elsewhere is refused unless `--force`; `list`, `remove`, `prune` (*read*) · covers our angle: **partial** — reference style, no PR-review walk-through · fetched 2026-10-12
- **Our delta:** reviewing a PR while your own work stays untouched.

### T07-10 · Monorepo layout — Understand · 🔲 not written
- **Read this:** [Monorepos in Git](https://www.atlassian.com/git/tutorials/monorepos) · Atlassian · published 2025-12-15, modified 2026-01-14 · what a monorepo costs Git at scale and what to do about it (*read* parts) · covers our angle: **partial** — generic, nothing on ignore rules, hooks or CI paths for `web/` and `api/` · fetched 2026-10-12
- **Also good:** [monorepo.tools](https://monorepo.tools/) · Nrwl/Nx-maintained · what a monorepo is and what tooling should provide (*headings only*) · fetched 2026-10-12
- **Also good:** [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) · docs.npmjs.com · the tooling half of the decision (*not opened*, fetch only returned 200) · fetched 2026-10-12

### T07-11 · Sparse checkout — Understand · 🔲 not written
- **Read this:** [git-sparse-checkout](https://git-scm.com/docs/git-sparse-checkout) · git-scm.com · cone mode, `--sparse-index`, and why non-cone patterns are not recommended (*read*) · covers our angle: **partial** — nothing on tooling that expects the whole tree · fetched 2026-10-12
- **Also good:** [Bring your monorepo down to size with sparse-checkout](https://github.blog/open-source/git/bring-your-monorepo-down-to-size-with-sparse-checkout/) · GitHub Blog · 2020-01-17 (modified 2022-05-16) · `init --cone`, `set <dirs>`, `disable` (*read*); note the current manual marks `init` as deprecated, so use `set` · fetched 2026-10-12

### T07-12 · Large files and Git LFS — Know · 🔲 not written
- **Read this:** [Git LFS](https://git-lfs.com/) · git-lfs.com · text pointers in Git, contents on a server; `git lfs track`; tracking does not convert existing files (*read*) · covers our angle: **partial** — no history-bloat or migration-cost discussion · fetched 2026-10-12
- **Also good:** [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) · GitHub Docs · GitHub blocks files over 100 MiB; use LFS beyond that (*read*) · fetched 2026-10-12
- **Also good:** [About Git Large File Storage](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage) · GitHub Docs · stores references, not the file; pointer file format (*read*) · fetched 2026-10-12
- **Our delta:** the syllabus row says `git-lfs` is not installed on the machine the pages are built on, so a page must name what produced any output; the migration is Phase 11.

### T07-13 · Submodules — Know · 🔲 not written
- **Read this:** [Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) · Pro Git · a submodule is a recorded commit (mode 160000, "Subproject commit"); updates leave a detached HEAD (*read*) · covers our angle: **partial** — little on when submodules are justified · fetched 2026-10-12
- **Also good:** [gitsubmodules](https://git-scm.com/docs/gitsubmodules) · git-scm.com · concept page (*headings only*) · fetched 2026-10-12

### T07-14 · `git subtree` — Know · 🔲 not written
- **Read this:** [Git Subtree: Alternative to Git Submodule](https://www.atlassian.com/git/tutorials/git-subtree) · Atlassian · published 2025-12-15, modified 2026-01-14 (*read*, about 1,600 words) · lists what subtree gives (no `.gitmodule` metadata, sub-project code present after clone) and its drawbacks (a new merge strategy to learn, harder to contribute upstream, mixing super and sub-project commits is on you) · covers our angle: **partial** — the text dates subtree to Git v1.7.11 (May 2012), so it reads as an old tutorial under new page dates; no weighing of when subtree beats submodules in a MERN repo · fetched 2026-10-12
- **Checked, not chosen:** `git-scm.com/docs/git-subtree` returns 404; the DataCamp tutorial returns 403.
- **Our delta:** the page must run `git subtree` itself; no official manual page was found.

### T07-15 · Repository documentation — Know · 🔲 not written
- **Read this:** [Setting guidelines for repository contributors](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) · GitHub Docs · adding a `CONTRIBUTING` file (*read* the opening) · covers our angle: **partial** — one file of four · fetched 2026-10-12
- **Also good:** [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) · GitHub Docs · a `CODEOWNERS` file names people or teams responsible for code (*read*) · fetched 2026-10-12
- **Also good:** [EditorConfig](https://editorconfig.org/) · editorconfig.org · example `.editorconfig` with `root = true` and per-glob indent and end-of-line (*read*) · fetched 2026-10-12
- **Checked, not chosen:** [About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) (*headings only*).

---

## Phase 8 — Hooks, CI and automation

### T08-01 · Hooks are a convenience, never a control — Master · 🔲 not written
- **Read this:** [githooks](https://git-scm.com/docs/githooks) · git-scm.com · `pre-commit` "can be bypassed with the `--no-verify` option"; hooks live in `$GIT_DIR/hooks` or `core.hooksPath` (*read*) · covers our angle: **partial** — does not say anything must be re-checked server-side · fetched 2026-10-12
- **Also good:** [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) · Pro Git · client-side hooks versus server-side hooks; client-side hooks are not copied on clone, so enforce policy on the server (*read* the opening) · fetched 2026-10-12
- **Our delta:** the enforcement argument; the blog posts found by search were not opened.

### T08-02 · `pre-commit` with lint-staged — Master · 🔲 not written
- **Read this:** [lint-staged README](https://raw.githubusercontent.com/lint-staged/lint-staged/main/README.md) · github (raw) · runs linters on staged files; set up a `pre-commit` hook, with Husky as a popular choice (*read*) · covers our angle: **partial** — no argument about full-suite hooks training people to bypass · fetched 2026-10-12
- **Also good:** [Husky: Get started](https://typicode.github.io/husky/get-started.html) · typicode.github.io · `husky init` creates a `pre-commit` script and updates the `prepare` script (*read*) · fetched 2026-10-12

### T08-03 · What CI must re-check regardless — Master · 🔲 not written
- **Read this:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · GitHub Docs · required status checks must pass before merging into a protected branch (*read* that passage) · covers our angle: **partial** — GitHub mechanism only, not the list of tests, lint, build, secret scan · fetched 2026-10-12
- **Also good:** [About push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) · GitHub Docs · the secret-scan layer (*headings only*) · fetched 2026-10-12
- **Our delta:** the pipeline as the enforcement boundary; the hook as fast feedback.

### T08-04 · The client hook set — Understand · 🔲 not written
- **Read this:** [githooks](https://git-scm.com/docs/githooks) · git-scm.com · each hook with its trigger, parameters and exit-code effect: `pre-commit`, `prepare-commit-msg`, `commit-msg`, `post-commit`, `pre-push`, `post-checkout`, `post-merge` (*read*) · covers our angle: **partial** — a reference, so no judgement on which hooks are worth using · fetched 2026-10-12
- **Also good:** [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) · Pro Git · "Committing-Workflow Hooks" (*read*) · fetched 2026-10-12

### T08-05 · Sharing hooks with a team — Understand · 🔲 not written
- **Read this:** [Husky: Get started](https://typicode.github.io/husky/get-started.html) · typicode.github.io · `husky init` creates a `pre-commit` script in `.husky/` and updates the `prepare` script (*read*) · covers our angle: **partial** — no side-by-side with a plain `core.hooksPath` directory · fetched 2026-10-12
- **Also good:** [githooks](https://git-scm.com/docs/githooks) · git-scm.com · `core.hooksPath` in the synopsis (*read*) · fetched 2026-10-12
- **Also good:** [Husky: How To](https://typicode.github.io/husky/how-to.html) · typicode.github.io · `HUSKY=0` disables hooks, including for CI (*read*) · fetched 2026-10-12

### T08-06 · `commit-msg` and commitlint — Understand · 🔲 not written
- **Read this:** [commitlint: Getting started](https://commitlint.js.org/guides/getting-started.html) · commitlint.js.org · install `@commitlint/cli` and `@commitlint/config-conventional` (*read*) · covers our angle: **partial** — wiring to a `commit-msg` hook and the emergency escape hatch are **not confirmed** in what I read · fetched 2026-10-12
- **Also good:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) · conventionalcommits.org · the `type[optional scope]: description` format, tied to SemVer (*read*) · fetched 2026-10-12
- **Our delta:** related text: `docs/git/pages/phase-1-everyday-loop/10-commit-messages.md` says a `commit-msg` hook can enforce a format.

### T08-07 · `pre-push` as the last cheap gate — Understand · 🔲 not written
- **Read this:** [githooks](https://git-scm.com/docs/githooks) · git-scm.com · `pre-push` is called by `git push` and can prevent the push; receives remote name and location (*read*) · covers our angle: **partial** — no advice on keeping it fast · fetched 2026-10-12
- **Our delta:** the speed threshold; no page found that states it.

### T08-08 · What a push triggers — Understand · 🔲 not written
- **Read this:** [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) · GitHub Docs · lists `push`, `pull_request`, `create` (branch or tag) and the other events (*read*) · covers our angle: **partial** — GitHub Actions only; GitLab not checked · fetched 2026-10-12
- **Our delta:** stops at the event; the pipeline is Node Phase 11.

### T08-09 · Checkout depth in CI — Understand · 🔲 not written
- **Read this:** [actions/checkout README](https://raw.githubusercontent.com/actions/checkout/main/README.md) · github (raw) · only a single commit is fetched by default; `fetch-depth: 0` fetches all history for all branches and tags (*read*) · covers our angle: **partial** — breakage of `describe`, `blame` and merge-base is **not confirmed** on this page · fetched 2026-10-12
- **Our delta:** the failure list and the cost of full depth.

### T08-10 · Automated formatting and `.git-blame-ignore-revs` — Understand · 🔲 not written
- **Read this:** [Viewing and understanding files](https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files) · GitHub Docs · sections "Ignore commits in the blame view" and "Bypassing `.git-blame-ignore-revs`" (*headings only*) · covers our angle: **partial** — host side only · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · `blame.ignoreRevsFile`: ignore revisions listed in the file, one unabbreviated object name per line (*read*) · fetched 2026-10-12
- **Also good:** [git-blame](https://git-scm.com/docs/git-blame) · git-scm.com · `--ignore-rev` and `--ignore-revs-file` options (*headings only*) · fetched 2026-10-12

### T08-11 · Server-side hooks — Know · 🔲 not written
- **Read this:** [An Example Git-Enforced Policy](https://git-scm.com/book/en/v2/Customizing-Git-An-Example-Git-Enforced-Policy) · Pro Git · a server-side `update` hook that runs once per pushed branch (*read* that passage) · covers our angle: **partial** — Ruby example, no `pre-receive` walk-through · fetched 2026-10-12
- **Also good:** [githooks](https://git-scm.com/docs/githooks) · git-scm.com · push-triggered hooks (`pre-receive`, `update`, `post-receive`) always run in `$GIT_DIR` (*read*) · fetched 2026-10-12

### T08-12 · Merge queues — Know · 🔲 not written
- **Read this:** [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) · GitHub Docs · required checks run against the latest target branch plus the pull requests already queued (*read*) · covers our angle: **partial** — GitHub only; GitLab merge trains not checked · fetched 2026-10-12

### T08-13 · Release automation — Know · 🔲 not written
- **Read this:** [semantic-release README](https://raw.githubusercontent.com/semantic-release/semantic-release/master/README.md) · github (raw) · derives the next version from commit messages, generates a changelog, publishes (*read*) · covers our angle: **partial** — no tag-creation detail read; `release-please` was 403 (github.com), so not used · fetched 2026-10-12
- **Also good:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) · conventionalcommits.org · the convention these tools parse (*read*) · fetched 2026-10-12

### T08-14 · Dependency bots — Know · 🔲 not written
- **Read this:** [Optimizing PR creation for version updates](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/optimizing-pr-creation-version-updates) · GitHub Docs · control frequency with `schedule`, prioritise updates with `groups` (*read* the opening) · covers our angle: **partial** — nothing on reviewing a lockfile-only change · fetched 2026-10-12
- **Also good:** [Renovate docs](https://docs.renovatebot.com/) · docs.renovatebot.com · PRs that update dependencies and lock files; scheduling to reduce noise (*read*) · fetched 2026-10-12

---

## Phase 9 — Speed, scale and daily ergonomics

### T09-01 · The clone strategy for CI — Understand · 🔲 not written
- **Read this:** [Get up to speed with partial clone and shallow clone](https://github.blog/open-source/git/get-up-to-speed-with-partial-clone-and-shallow-clone/) · GitHub Blog · 2020-12-21 (modified 2021-04-28) · blobless (`--filter=blob:none`) versus treeless (`--filter=tree:0`) and which fits builds that are deleted after one run (*read*) · covers our angle: **partial** — no cached-checkout option · fetched 2026-10-12
- **Also good:** [git-clone](https://git-scm.com/docs/git-clone) · git-scm.com · `--depth`, `--filter` (*headings only*) · fetched 2026-10-12

### T09-02 · Config that earns its place — Master · 🔲 not written
- **Read this:** [How Core Git Developers Configure Git](https://blog.gitbutler.com/how-git-core-devs-configure-git) · GitButler · 2025-02-22 · a copy-paste config with `init.defaultBranch`, `diff.algorithm = histogram`, `push.autoSetupRemote`, `fetch.prune`, `rerere.enabled` (*read* the config block) · covers our angle: **partial** — `rebase.autoStash = true` is in the block and `pull.rebase true` is discussed in prose as a personal choice (its `[pull]` entry is commented out); the page justifies some settings in prose, not each line, and covers more settings than our seven · fetched 2026-10-12
- **Also good:** [git-config](https://git-scm.com/docs/git-config) · git-scm.com · the authoritative definition of each key, for example `fetch.prune`, `push.autoSetupRemote`, `init.defaultBranch` (*read*) · fetched 2026-10-12
- **Our delta:** one justification per line, tied to our seven settings.

### T09-03 · What makes a repository slow — Understand · 🔲 not written
- **Read this:** [Monorepos in Git](https://www.atlassian.com/git/tutorials/monorepos) · Atlassian · published 2025-12-15, modified 2026-01-14 · a deep commit graph slows `git log` and `git blame` (*read*) · covers our angle: **partial** — no way to tell object count from ref count from working-tree size · fetched 2026-10-12
- **Also good:** [git-sizer README](https://raw.githubusercontent.com/github/git-sizer/master/README.md) · github (raw) · size metrics for a repository; ideally under 1 GiB, unwieldy above 5 GiB (*read*) · fetched 2026-10-12
- **Our delta:** the diagnosis step before changing anything.

### T09-04 · `git maintenance` and `gc` — Understand · 🔲 not written
- **Read this:** [git-maintenance](https://git-scm.com/docs/git-maintenance) · git-scm.com · the incremental schedule: commit-graph and prefetch hourly, loose-objects and incremental-repack daily, gc disabled (*read*) · covers our angle: **partial** — `gc --aggressive` is not weighed here · fetched 2026-10-12
- **Also good:** [git-gc](https://git-scm.com/docs/git-gc) · git-scm.com · has an AGGRESSIVE section; auto gc after porcelain operations (*read* the notes) · fetched 2026-10-12

### T09-05 · Auditing repository size — Understand · 🔲 not written
- **Read this:** [git-sizer README](https://raw.githubusercontent.com/github/git-sizer/master/README.md) · github (raw) · diagnoses overall size and oversized objects (*read* the opening) · covers our angle: **partial** — flags problems; it is not a "largest objects in history" listing · fetched 2026-10-12
- **Also good:** [git-count-objects](https://git-scm.com/docs/git-count-objects) · git-scm.com · `-v` and `-H` for object counts and disk use (*headings only*) · fetched 2026-10-12
- **Checked, not chosen:** [git-filter-repo README](https://raw.githubusercontent.com/newren/git-filter-repo/main/README.md) · the word "analyze" appears only in a design wishlist, so its analysis mode is not confirmed from this page.

### T09-06 · Aliases — Understand · 🔲 not written
- **Read this:** [Git Aliases](https://git-scm.com/book/en/v2/Git-Basics-Git-Aliases) · Pro Git · `git config --global alias.co checkout` and similar (*read*) · and `!` prefix to run an external command, e.g. `alias.visual '!gitk'` (*read*) · covers our angle: **partial** — no advice on which handful are worth defining and no shell-alias versus Git-alias comparison · fetched 2026-10-12

### T09-07 · Credential caching — Understand · 🔲 not written
- **Read this:** [Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage) · Pro Git · default is no caching; `cache` keeps credentials in memory (default 900 seconds); `store` writes plain text to `~/.git-credentials` (*read*) · also covers the macOS `osxkeychain` helper and the Windows Credential Manager · covers our angle: **partial** — the shell-history point is not covered · fetched 2026-10-12
- **Also good:** [gitcredentials](https://git-scm.com/docs/gitcredentials) · git-scm.com · helper reference (*headings only*) · fetched 2026-10-12
- **Our delta:** related text: `docs/git/pages/phase-4-remotes/08-transports-and-credentials.md` covers `credential.helper` store, cache and keychain options.

### T09-08 · The commit-graph file — Know · 🔲 not written
- **Read this:** [Supercharging the Git Commit Graph](https://devblogs.microsoft.com/devops/supercharging-the-git-commit-graph/) · Microsoft DevBlogs (Derrick Stolee) · 2018-06-25 · why `git log --graph` is slow on many commits and what the file precomputes (*read* the opening) · covers our angle: **partial** — written for Git 2.18; later changes are in the manual · fetched 2026-10-12
- **Also good:** [git-commit-graph](https://git-scm.com/docs/git-commit-graph) · git-scm.com · `write` and `verify`, `--split`, `--changed-paths` (*read* the synopsis and `write`) · fetched 2026-10-12

### T09-09 · `fsmonitor` and untracked-cache — Know · 🔲 not written
- **Read this:** [Improve Git monorepo performance with a file system monitor](https://github.blog/engineering/infrastructure/improve-git-monorepo-performance-with-a-file-system-monitor/) · GitHub Blog · 2022-06-29 (modified 2022-06-30) · set `core.fsmonitor` to true; works with `core.untrackedcache` (*read*) · covers our angle: **partial** — the post says the built-in monitor is available on macOS and Windows only, which is dated; the current `git-fsmonitor--daemon` manual describes Linux (inotify) support · fetched 2026-10-12
- **Also good:** [git-fsmonitor--daemon](https://git-scm.com/docs/git-fsmonitor--daemon) · git-scm.com · the built-in daemon (*headings only*) · fetched 2026-10-12
- **Also good:** [git-update-index](https://git-scm.com/docs/git-update-index) · git-scm.com · has UNTRACKED CACHE and FILE SYSTEM MONITOR sections (*headings only*) · fetched 2026-10-12
- **Our delta:** related text: `docs/git/pages/phase-1-everyday-loop/01-git-status/04-untracked-and-performance.md` already covers `core.untrackedCache` and `core.fsmonitor` as `status` levers.

### T09-10 · `scalar` — Know · 🔲 not written
- **Read this:** [scalar](https://git-scm.com/docs/scalar) · git-scm.com · `scalar clone`, `register`, `run`, `reconfigure`; a RECOMMENDED CONFIG VALUES section (*headings only*, synopsis read) · covers our angle: **partial** — the config values and the "do you need it" judgement were not read · fetched 2026-10-12
- **Our delta:** which of its settings a normal-size repository can skip.

### T09-11 · Better diffs at the terminal — Know · 🔲 not written
- **Read this:** [delta user manual](https://dandavison.github.io/delta/) · dandavison.github.io · no page date · side-by-side view, line numbers, themes, `diff-so-fancy` emulation (*headings only*) · covers our angle: **partial** — `difftool` and `mergetool` are separate · fetched 2026-10-12
- **Also good:** [git-difftool](https://git-scm.com/docs/git-difftool) · git-scm.com · (*headings only*) · fetched 2026-10-12
- **Also good:** [Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) · Pro Git · "Checking Out Conflicts" and manual file merging (*read* that passage) · fetched 2026-10-12

### T09-12 · Measuring instead of guessing — Know · 🔲 not written
- **Read this:** [Environment Variables (Git Internals)](https://git-scm.com/book/en/v2/Git-Internals-Environment-Variables) · Pro Git · `GIT_TRACE` and `GIT_TRACE_PERFORMANCE` with sample output (*read*) · covers our angle: **partial** — `--no-optional-locks` is not on this page · fetched 2026-10-12
- **Also good:** [Trace2 API](https://git-scm.com/docs/api-trace2) · git-scm.com · `GIT_TRACE2_PERF`, the format meant to replace `GIT_TRACE_PERFORMANCE` (*read*) · fetched 2026-10-12
- **Also good:** [git](https://git-scm.com/docs/git) · git-scm.com · `--no-optional-locks`: do not perform optional operations that require locks, same as `GIT_OPTIONAL_LOCKS=0` (*read* the option) · fetched 2026-10-12

### T09-13 · When to split a repository — Know · 🔲 not written
- **Read this:** [Monorepos in Git](https://www.atlassian.com/git/tutorials/monorepos) · Atlassian · published 2025-12-15, modified 2026-01-14 · section "Identify boundaries and split your repository" calls it the most radical workaround (*read* that passage) · covers our angle: **partial** — the "usually tooling, not surgery" argument is ours · fetched 2026-10-12
- **Checked, not chosen:** blog comparisons of monorepo and many repos came up in search (itnext, kodus, last9); none was opened.
