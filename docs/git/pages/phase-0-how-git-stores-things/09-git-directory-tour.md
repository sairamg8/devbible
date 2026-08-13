---
title: "A tour of .git/"
sidebar_label: "09 · Inside .git/"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, section 10.

**The whole repository is one directory. Every fact Git knows lives in
`.git/` — delete it and you have an ordinary folder of files; copy it and you
have copied the entire history. Ten entries, and you have already met most of
them.**

## What a fresh repository contains

```console
$ ls -1 .git
COMMIT_EDITMSG
config
description
HEAD
hooks
index
info
logs
objects
refs
```

| Entry | What it is | Covered in |
|---|---|---|
| `objects/` | The content store — every blob, tree, commit and tag | [Page 01](01-what-git-is.md) |
| `refs/` | Branch, tag and remote-tracking pointers | [Page 06](06-refs-and-head.md) |
| `HEAD` | Which branch you are on | [Page 06](06-refs-and-head.md) |
| `index` | The staging area | [Page 05](05-the-index.md) |
| `config` | This repository's settings | [Page 08](08-config-layers.md) |
| `logs/` | The reflog — every ref movement, with timestamps | Phase 2 |
| `hooks/` | Executable scripts Git runs at lifecycle points | Phase 8 |
| `info/` | Repository-local extras, notably `info/exclude` | Phase 1 |
| `description` | Used only by the legacy GitWeb viewer. Ignore it | — |
| `COMMIT_EDITMSG` | A scratch file holding your last commit message | — |

Later you will also see `packed-refs`, `ORIG_HEAD`, `MERGE_HEAD`,
`REBASE_HEAD`, `index.lock` and directories such as `rebase-merge/` — all
transient state written by an operation in progress.

## `.git/config` is smaller than expected

```console
$ cat .git/config
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
```

Four keys. Everything else you experience comes from higher config layers or
Git's built-in defaults. `logallrefupdates = true` is the one worth noticing —
it is what enables the reflog, and therefore what makes most recovery possible.

## The three you should know by name

**`logs/`** — the reflog. Every time a ref moves, Git appends a line here
recording old hash, new hash, who, when, and which command did it. It is local,
it is not pushed, and it expires (90 days for reachable entries, 30 for
unreachable ones). Nearly every "I destroyed my work" recovery reads this file.

**`hooks/`** — sample scripts, all disabled by shipping with a `.sample`
suffix. Nothing here is version-controlled, which is the whole reason teams need
`core.hooksPath` or a tool like husky to share hooks (Phase 8).

**`info/exclude`** — ignore patterns that apply only to your clone and are never
committed. The right place for editor droppings that are your business alone,
rather than pushing personal entries into the team's `.gitignore`.

## Practical consequences

- **Backing up `.git/` backs up everything.** History, branches, tags, config
  and stashes. The working tree can be recreated from it with `git checkout`.
- **Deleting `.git/` is irreversible and instant.** No confirmation, no undo —
  the files on disk remain, and become untracked.
- **Copying a repository with `cp -r` copies the reflog, stashes and local
  config too** — including any credential embedded in a remote URL. `git clone`
  is the right way to hand a repository to somebody else.
- **A bare repository is this directory *as* the repository** — no working tree,
  contents at the top level. That is what a server hosts (Phase 4).

## Trade-off

**One self-contained directory is Git's best structural decision, and it removes
almost all safety rails.**

There is no server to consult, no central lock, no partial state — a repository
is portable, inspectable and works offline entirely, and you can fix one with
ordinary file tools. The cost is that a single `rm -rf .git` destroys everything
not pushed elsewhere, with no protocol to fall back on. The mitigations are
social and habitual rather than technical: push often, and treat a repository
that exists on exactly one machine as unbacked-up data.

## Gotchas

**Symptom:** `.git` is enormous while the checkout is small
**Cause:** history retains everything ever committed — most often a large binary added once and deleted later
**Fix:** `git count-objects -vH` to confirm, then audit history size (Phase 9). Removal requires a rewrite (Phase 11)

**Symptom:** every command fails with `index.lock` already exists
**Cause:** a Git process died mid-write, or an editor's Git integration is running concurrently
**Fix:** confirm no Git process is running, then delete `.git/index.lock`. Only the lock is stale; the index is fine

**Symptom:** you copied a project folder and both copies share weird state
**Cause:** `cp -r` duplicated `.git/` including reflog, stashes and local config
**Fix:** use `git clone <path> <dest>` for a clean copy with its own reflog

**Symptom:** a hook works for you and for nobody else
**Cause:** `.git/hooks/` is not tracked, so it never leaves your machine
**Fix:** commit hooks to a tracked directory and point `core.hooksPath` at it (Phase 8)

## Interview questions

**★ What would you lose by deleting `.git/`?**
All history, branches, tags, stashes, the reflog and repository config. The
working-tree files remain but become untracked. Nothing is recoverable locally —
only from a clone or remote.

**★ What is `.git/logs/` and why does it matter?**
The reflog: an append-only record of every ref movement, enabled by
`logallrefupdates = true`. It is what makes recovery from a bad reset, rebase or
branch deletion possible, and it is local-only — never pushed.

**★ Why can't hooks be shared by committing them?**
`.git/hooks/` is inside the repository directory but is not tracked content, so
clone does not carry it. Sharing requires a tracked directory plus
`core.hooksPath`, or a tool that installs them.

**What is the difference between a bare and a non-bare repository?**
A bare repository has no working tree — the contents of `.git/` sit at the top
level. It is what a server hosts, because nobody edits files there and a
checked-out branch would conflict with pushes.

**Is `.git/config` the only configuration that affects this repository?**
No. It is one layer among system, global, local, worktree and `-c`. The fresh
file has only four keys; everything else comes from higher layers or built-in
defaults.

---

← Prev: [Config layers and precedence](08-config-layers.md) · Next → [Identity and first-run setup](10-identity-setup.md)
