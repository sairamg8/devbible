---
title: "Part 3 — Git in a real project"
sidebar_label: "3 · Git in a real project"
sidebar_position: 3
---

> **Phases 7–9 · 42 topics · 7 Master**
> What actually goes in a MERN/PERN repository, the automation hanging off it,
> and keeping the whole thing fast.


:::warning Parked — 2026-08-14 re-scope

This whole part is **out of scope**. Git was cut to daily-driver use on the
user's instruction (*"I just need to know about the git to work daily tasks not
more than that"*), leaving phases 0, 1, 2, 4 and 5 — 52 topics. The rows below
are kept as a record of the original plan; **no pages are being written for
them**. See the [syllabus overview](../README.md) for what is in scope.

:::

This is the part that is specific to *this* bible. Everything so far applies to
any repository; these phases assume the repo contains `node_modules`, a lockfile,
a `.env` that must never be committed, database migrations that collide by
filename, and a front end and an API that may or may not share a repo.

---

## Phase 7 — The repository in a fullstack project

*15 topics.* What is tracked, what is ignored, and what the answer costs you
later. Two of these rows — secrets and lockfiles — cause more real incidents
than the whole of Part 1.

| Topic | Tier |
|---|---|
| **`.gitignore` for a Node/React repository** — `node_modules`, build output, coverage, editor and OS files, and the fact that a generated directory is ignored while the *config that generates it* is tracked. Built up rule by rule with the reason for each | <span className="db-tier t-master">Master</span> |
| **Secrets never enter the repository** — `.env` ignored and `.env.example` tracked; that Git history is permanent and a private repo is not a vault; what to do the moment one is committed (rotate first — the removal procedure is Phase 5) | <span className="db-tier t-master">Master</span> |
| **Lockfiles are committed, always** — `package-lock.json` / `yarn.lock` as the record of what actually installed; the reproducibility argument, and why "it works on my machine" is usually an uncommitted lockfile | <span className="db-tier t-master">Master</span> |
| **Resolving a lockfile conflict** — never hand-merge it: take one side, re-run the package manager, commit the result. Why a hand-merged lockfile can install a dependency set that never existed | <span className="db-tier t-understand">Understand</span> |
| **Generated versus authored files** — build output, compiled TypeScript, generated clients and types; the test for whether a generated file belongs in the repo, and what tracking one costs at review time | <span className="db-tier t-understand">Understand</span> |
| **Database migrations under version control** — migrations are append-only history; the filename collision two branches produce, why renumbering after merge is wrong, and timestamp-based names as the fix | <span className="db-tier t-understand">Understand</span> |
| **`.gitattributes`** — marking files binary, `-diff` for generated blobs, `linguist-*` for language stats, and per-path merge drivers | <span className="db-tier t-understand">Understand</span> |
| **Line endings** — `core.autocrlf` versus `text=auto` in `.gitattributes`, the mixed-OS team, and the diff that claims every line changed | <span className="db-tier t-understand">Understand</span> |
| **`git worktree`** — a second checkout of the same repository on a different branch, without stashing or cloning; reviewing a PR while your own work stays untouched | <span className="db-tier t-understand">Understand</span> |
| **Monorepo layout** — `web/`, `api/`, `packages/`; what changes in ignore rules, hooks, CI paths and review; and where npm/yarn workspaces are the tooling half of the same decision | <span className="db-tier t-understand">Understand</span> |
| **Sparse checkout** — working with part of a large monorepo, cone mode, and the interaction with tooling that expects the whole tree | <span className="db-tier t-understand">Understand</span> |
| **Large files and Git LFS** — why binaries wreck a repository permanently, what LFS changes, and the migration cost. **`git-lfs` is not installed on this machine**, so its pages will name what produced any output they show | <span className="db-tier t-know">Know</span> |
| **Submodules** — how they actually work (a recorded commit hash, not a branch), the everyday failure modes, and the narrow cases that justify them | <span className="db-tier t-know">Know</span> |
| **`git subtree`** — vendoring another repository's content with history, as the alternative to submodules, and its own trade-off | <span className="db-tier t-know">Know</span> |
| Repository documentation — `README`, `CONTRIBUTING`, `CODEOWNERS`, `.editorconfig`, and treating the repo's own conventions as tracked artifacts | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can initialise a fullstack repository from scratch
whose first commit contains no secrets, no build output and no `node_modules` —
and defend every line of its `.gitignore`.

---

## Phase 8 — Hooks, CI and automation

*14 topics.* Git's extension points, and the line between what a hook may
enforce and what CI must. The security row is the one people get wrong.

| Topic | Tier |
|---|---|
| **Hooks are a convenience, never a control** — every client hook is skippable with `--no-verify` and lives outside the repository's tracked content, so anything that *must* hold has to be re-checked server-side | <span className="db-tier t-master">Master</span> |
| **`pre-commit` with lint-staged** — formatting and linting only the staged files, and why running the whole suite on commit trains people to bypass hooks | <span className="db-tier t-master">Master</span> |
| **What CI must re-check regardless** — the full test suite, the lint pass, the build, and the secret scan; the pipeline is the enforcement boundary and the hook is the fast feedback | <span className="db-tier t-master">Master</span> |
| **The client hook set** — `pre-commit`, `prepare-commit-msg`, `commit-msg`, `post-commit`, `pre-push`, `post-checkout`, `post-merge`; when each fires, its exit-code contract, and which are worth using | <span className="db-tier t-understand">Understand</span> |
| **Sharing hooks with a team** — `.git/hooks` is not tracked; `core.hooksPath` pointing at a committed directory, versus husky, and the install step either way | <span className="db-tier t-understand">Understand</span> |
| **`commit-msg` and commitlint** — enforcing Conventional Commits at the point of writing, and the escape hatch that must exist for emergencies | <span className="db-tier t-understand">Understand</span> |
| **`pre-push` as the last cheap gate** — running the fast tests before the network round trip, and keeping it under the threshold where people disable it | <span className="db-tier t-understand">Understand</span> |
| **What a push triggers** — the events a host emits (push, pull request, tag) and how a workflow subscribes; the git-side of CI, with pipeline design itself deferred to deployment | <span className="db-tier t-understand">Understand</span> |
| **Checkout depth in CI** — the default shallow clone breaking `describe`, `blame`, tag lookups and merge-base comparisons; when `fetch-depth: 0` is required and what it costs | <span className="db-tier t-understand">Understand</span> |
| **Automated formatting and `.git-blame-ignore-revs`** — introducing a formatter without destroying `blame`, and configuring the file so the host and local Git both honour it | <span className="db-tier t-understand">Understand</span> |
| **Server-side hooks** — `pre-receive` and `update` on a self-hosted remote; the only place a rule genuinely cannot be bypassed | <span className="db-tier t-know">Know</span> |
| **Merge queues** — why "green on my PR" does not mean green after merge, and what a queue serialises | <span className="db-tier t-know">Know</span> |
| **Release automation** — deriving the version and changelog from commit messages, and the tag it produces | <span className="db-tier t-know">Know</span> |
| Dependency bots — the PR volume they generate, grouping updates, and reviewing a lockfile-only change | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** a bad commit message and an unformatted file are both
rejected locally in under two seconds, and you can explain what still stops them
if the author uses `--no-verify`.

---

## Phase 9 — Speed, scale and daily ergonomics

*13 topics.* Making Git fast on a real repository, and configuring it so the
commands you run fifty times a day are short and safe.

| Topic | Tier |
|---|---|
| **The clone strategy for CI** — full, shallow, partial or cached; matching it to what the job actually needs, since most pipelines pay for history they never read | <span className="db-tier t-understand">Understand</span> |
| **Config that earns its place** — `pull.rebase`, `fetch.prune`, `rebase.autostash`, `rerere.enabled`, `diff.algorithm`, `init.defaultBranch`, `push.autoSetupRemote`; a recommended global config with a justification per line | <span className="db-tier t-master">Master</span> |
| **What makes a repository slow** — object count, giant files, huge working trees, and thousands of refs; how to tell which one you have before changing anything | <span className="db-tier t-understand">Understand</span> |
| **`git maintenance` and `gc`** — the scheduled tasks, what each one does, and the difference between background maintenance and a manual `gc --aggressive` | <span className="db-tier t-understand">Understand</span> |
| **Auditing repository size** — finding the largest objects in history, distinguishing working-tree size from history size, and deciding whether a rewrite is warranted | <span className="db-tier t-understand">Understand</span> |
| **Aliases** — the handful worth defining, shell aliases versus Git aliases, and aliases that shell out to a script | <span className="db-tier t-understand">Understand</span> |
| **Credential caching** — helpers, timeouts, and why a token typed fifty times a day ends up in a shell history file | <span className="db-tier t-understand">Understand</span> |
| **The commit-graph file** — what it precomputes, why `log --graph` and merge-base queries get faster, and when it is written | <span className="db-tier t-know">Know</span> |
| **`fsmonitor` and untracked-cache** — making `status` fast on a large working tree, and what each one caches | <span className="db-tier t-know">Know</span> |
| **`scalar`** — bundled with Git on this build; the opinionated large-repo configuration it applies, and whether you need it | <span className="db-tier t-know">Know</span> |
| **Better diffs at the terminal** — pagers, colour settings, `diff-so-fancy`/`delta`, and `difftool`/`mergetool` for the conflicts a terminal handles badly | <span className="db-tier t-know">Know</span> |
| **Measuring instead of guessing** — `GIT_TRACE`, `GIT_TRACE_PERFORMANCE`, and `--no-optional-locks` when a background editor process fights your shell | <span className="db-tier t-know">Know</span> |
| When to split a repository — the honest signals, and why the answer is usually tooling rather than surgery | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** your global config is deliberate — every setting in it
you can justify — and you can say which part of a slow `git status` is the
working tree, the object store or the refs.

---

## Where this connects

- **Phase 7 → Phase 5** — the `.gitignore` rules here are what stop you ever
  needing the secret-removal procedure there.
- **Phase 7 → Phase 11** — a large file committed once is a history-rewrite
  problem forever; Part 4 has the surgery.
- **Phase 8 → Phase 6** — hooks enforce locally what the branch protections
  agreed there enforce centrally.
- **Phase 8 → Node Phase 11 (Deployment)** — this phase stops at the push event;
  the pipeline that runs afterwards is written in the Node syllabus.
- **Phase 9 → Phase 4** — shallow and partial clone appear there as transport
  features and here as a CI cost decision.
- **Phase 9 → Phase 10** — the packfile and commit-graph internals behind these
  settings are explained in Part 4.
- **Deliberately not here:** Docker build context and `.dockerignore` (Docker
  syllabus), npm/yarn workspace mechanics (Node), and runtime secret management
  (Node Phase 8 — Security). Git owns *what is tracked*, not what consumes it.

---

← Prev: [Part 2 — Working with other people](./02-collaboration.md) · Next: [Part 4 — Depth and repair](./04-depth-and-repair.md) →
