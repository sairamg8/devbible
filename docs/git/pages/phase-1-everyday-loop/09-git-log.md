---
title: "`git log` for the everyday case"
sidebar_label: "09 · git log"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-log`, `man git-rev-list`
> (the commit-limiting options `git log` inherits), `man gitrevisions`.
> **Documentation-validated, not sandbox-proven.**

**`git log` walks the commit graph backwards from a starting point and prints
what it finds. It is not a list of "recent commits" — it is reachability from
HEAD, which is why a commit can vanish from `log` without being deleted, and why
`log` on a different branch shows a different history of the same repository.**

## The one incantation worth memorising

```bash
git log --oneline --graph --decorate
```

| Flag | What it adds |
|---|---|
| `--oneline` | One line per commit: short hash and title |
| `--graph` | An ASCII graph of the branch structure down the left |
| `--decorate` | Ref names — branches, tags, `HEAD` — beside the commits they point at |

`--decorate` has been on by default since Git 2.13 in terminals, but typing it
costs nothing and makes the command portable to scripts and older versions. Add
`--all` to see every branch rather than just the one you are on:

```bash
git log --oneline --graph --decorate --all
```

That is the "what is going on in this repository" command. It is worth an alias:

```bash
git config --global alias.lg "log --oneline --graph --decorate --all"
```

## Limiting the walk

The default walks all of history, which is rarely what you want:

| Command | Shows |
|---|---|
| `git log -10` | The last 10 commits |
| `git log --since="2 weeks ago"` | By date. `--until` bounds the other end |
| `git log --author="Sam"` | By author, matched as a pattern |
| `git log -- src/api/` | Only commits touching that path |
| `git log main..feature` | Commits on `feature` that are **not** on `main` |
| `git log feature..main` | The reverse — what you are missing |
| `git log main...feature` | The **symmetric difference** — commits on either but not both |
| `git log HEAD@{2}` | Where HEAD was two moves ago (the reflog syntax) |

Two of those repay attention.

**`git log main..feature`** is the "what does my branch add?" question, and it is
the right thing to read before opening a pull request. It is also what tells you
whether a branch is actually merged.

**Three dots means something different here than in `git diff`.** In `git log`,
`a...b` is the symmetric difference — commits reachable from either but not both.
In `git diff`, `a...b` is the diff from the merge base to `b`. Same punctuation,
two tools, two meanings; there is no mnemonic, only knowing which command you are
in.

### `--` before a path, always

```bash
git log -- config          # commits touching the file/dir "config"
git log config             # ambiguous if a branch named "config" exists
```

Without `--`, Git has to guess whether `config` is a revision or a path, and it
will tell you so with `ambiguous argument`. The habit of writing `--` costs two
characters and removes the class of error entirely.

## Seeing what actually changed

| Command | Output |
|---|---|
| `git log -p` | Full patch for each commit |
| `git log --stat` | Per-commit file list with change counts |
| `git log --name-only` | Just the filenames |
| `git log -p -- src/db.js` | The patch **for that file only**, across history |

`git log -p -- <file>` is the most useful of these by a distance. It answers "how
did this file get like this" in one command, and it is the fastest route to
understanding unfamiliar code — better than `blame` for most questions, because
it shows the change *and* the message explaining it.

## Formatting when you need something specific

```bash
git log --pretty=format:'%h %ad %an %s' --date=short
```

| Placeholder | Meaning |
|---|---|
| `%h` | Abbreviated commit hash |
| `%H` | Full hash |
| `%an` / `%ae` | Author name / email |
| `%ad` | Author date (formatted by `--date=`) |
| `%cd` | **Committer** date — differs after a rebase |
| `%s` | Subject (the title line) |
| `%d` | Ref decorations |

`--date=short`, `--date=relative` and `--date=iso` are the three worth knowing.
And remember there are two dates on every commit — a rebase preserves `%ad` and
updates `%cd`, which is why a rebased branch can look like it was written in the
wrong order until you check which date you are reading
([`git commit`](03-git-commit.md)).

## Why a commit "disappeared"

`git log` shows commits **reachable** from wherever you started. That has three
consequences people meet as bugs:

1. **After a rebase or amend, the old commits are unreachable** — they still exist
   in the object store, but nothing points at them, so they are not in `log`.
   `git reflog` finds them.
2. **`git log` on `main` does not show your feature branch's commits.** Nothing is
   missing; you are asking a different question. `--all` widens it.
3. **A commit with a future date still appears in ancestry order.** Phase 0
   measured this: *"a commit dated 2030 is still a child of its 2026 parent"*.
   `log` walks parents, not clocks. `--date-order` and `--author-date-order`
   change the sort, not the ancestry.

That third one is the reason the [commit graph is a DAG, not a
timeline](../phase-0-how-git-stores-things/07-commit-graph.md) — and the reason
"the last commit" means "the tip of this branch", not "the newest by date".

## The habit this topic is really about

**Read history before you change it.** Before a rebase, before a force-push,
before `reset --hard`, before merging someone's branch:

```bash
git log --oneline --graph --decorate --all -20
```

Twenty lines, two seconds, and it answers all the questions that make the next
command dangerous: where is HEAD, what has diverged, which branch has what, and
whether the thing you are about to rewrite has someone else's commits in it.

## Trade-off

**`git log` is infinitely configurable, and the configurability is what stops
people using it.**

Between commit limiting, path limiting, formatting, ordering, diff options and
`rev-list`'s full option set, `git log` has more flags than most complete command
line tools. There is a correct incantation for nearly any question about history,
and almost nobody can produce it from memory under pressure.

The practical resolution is to know **two commands cold** rather than twenty
approximately: `git log --oneline --graph --decorate --all` for orientation, and
`git log -p -- <file>` for "how did this happen". Put the first behind an alias.
Everything else is worth looking up on the rare occasion it matters, and that is
a reasonable place to leave it — this is the daily-driver set, and deep history
archaeology (`bisect`, `blame`, pickaxe search) is deliberately out of scope.

## Gotchas

**Symptom:** `git log` does not show a commit you know exists
**Cause:** it is not reachable from your current HEAD — it may be on another branch, or orphaned by a rebase or amend
**Fix:** `git log --all` for other branches, `git reflog` for orphaned commits

**Symptom:** `fatal: ambiguous argument 'config'`
**Cause:** Git cannot tell whether the argument is a revision or a path, because both could exist
**Fix:** `git log -- config`. Write `--` before paths as a habit

**Symptom:** commits appear out of chronological order
**Cause:** `log` walks parents, not timestamps, and commit dates can be anything — including the future
**Fix:** nothing to fix; ancestry is the truth. `--date-order` sorts differently if you need it for reading

**Symptom:** after rebasing, every commit looks like it was made today
**Cause:** you are reading `%cd`, the committer date, which the rebase updated. `%ad`, the author date, is preserved
**Fix:** `--pretty=format:'%h %ad %s' --date=short` to read author dates

**Symptom:** `git log main..feature` is empty although the branch clearly has commits
**Cause:** the branch is already merged into `main`, so it adds nothing that `main` lacks
**Fix:** that is the answer — the emptiness *is* the information. It is also how to check a branch is safe to delete

## Interview questions

**★ Is `git log` a list of recent commits?**
No — it is a walk of the commit graph backwards from a starting point, printing
what is *reachable*. That distinction explains most surprises: a commit orphaned
by a rebase or amend still exists in the object store but nothing points at it, so
it is absent from `log` while `git reflog` still finds it; `log` on `main` does
not show a feature branch's commits because you asked a different question, which
`--all` widens; and commits appear in ancestry order rather than by date, so a
commit dated 2030 is still a child of its 2026 parent. "The last commit" means the
tip of this branch, not the newest by clock.

**★ What is the one `git log` invocation worth memorising, and why that one?**
`git log --oneline --graph --decorate --all`. It answers the orientation questions
that make the *next* command dangerous: where `HEAD` is, what has diverged, which
branch holds what, and whether the history you are about to rewrite contains
someone else's commits. Twenty lines and two seconds before a rebase, a force-push
or a `reset --hard` is the cheapest safety habit in Git, and it is worth an alias
because nobody types four flags under pressure.

**★ `a...b` means one thing in `git log` and another in `git diff`. What are they?**
In `git log`, three dots is the **symmetric difference** — commits reachable from
either side but not both. In `git diff`, three dots is the diff from the **merge
base** to the right-hand side, which is what a pull request shows. Same
punctuation, two tools, two meanings, and no mnemonic connects them; you have to
know which command you are in. The two-dot form is more consistent: `main..feature`
in `log` is "commits on `feature` that `main` lacks", which is the right thing to
read before opening a pull request.

**★ `git log main..feature` prints nothing, but the branch obviously has commits.
What does that tell you?**
That the branch is already merged into `main` — it adds nothing `main` does not
already have. The emptiness *is* the information, and it is the reliable way to
check that a branch is safe to delete, rather than reading the graph and guessing.
The reverse form, `git log feature..main`, answers the complementary question of
what your branch is missing.

**★ Why does every commit look like it was made today after a rebase?**
Because you are reading the committer date. Every commit carries two: the author
date, preserved when a commit is replayed, and the committer date, updated by
whoever replayed it. `--oneline`-style output and the default format lean on the
one that changed. `--pretty=format:'%h %ad %s' --date=short` reads author dates
instead, and the same distinction explains why a rebased branch can look like it
was written out of order until you check which date is on screen.

**Why write `--` before a path?**
Because Git otherwise has to guess whether `config` is a revision or a path, and
if both could exist it refuses with `fatal: ambiguous argument`. Writing
`git log -- config` costs two characters and removes the entire class of error,
including the more dangerous version where the argument resolves as the *wrong*
one of the two and silently answers a different question.

**What is the fastest way to understand unfamiliar code with Git?**
`git log -p -- <file>`. It replays how the file got to its current state, showing
each change together with the message explaining it — which is usually more useful
than `blame`, because `blame` tells you who last touched a line while this tells
you why the line arrived. It is also the strongest practical argument for small
commits with real messages: the output is only an explanation if each step had one
intent.

---

← Prev: [Undo before you push](08-undo-before-you-push.md) · Next → [Commit messages](10-commit-messages.md)
