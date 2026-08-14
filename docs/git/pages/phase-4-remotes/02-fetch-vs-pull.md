---
title: "`fetch` versus `pull`"
sidebar_label: "02 · fetch vs pull"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-fetch` (DESCRIPTION,
> `--prune`, `FETCH_HEAD`), `man git-pull` (DESCRIPTION, `--rebase`, `--ff-only`).
> **Documentation-validated, not sandbox-proven.**

**`fetch` downloads. `pull` downloads and then changes your branch. That is the
entire difference, and it is why `fetch` is always safe to run and `pull` is the
command that surprises people.**

## What each one does

| | `git fetch` | `git pull` |
|---|---|---|
| Downloads objects | ✅ | ✅ |
| Updates `origin/*` refs | ✅ | ✅ |
| Touches your branch | ✖ **never** | ✅ |
| Touches your working tree | ✖ **never** | ✅ |
| Can conflict | ✖ | ✅ |
| Safe to run any time | ✅ | Depends on config |

`git pull` is literally `git fetch` followed by `git merge` (or `git rebase`, with
`pull.rebase`). Nothing more.

The manual notes `fetch` also writes the fetched refs and their object names to
**`.git/FETCH_HEAD`**, which is what `pull` then integrates.

## The habit worth adopting

```bash
git fetch                                  # safe, always
git log --oneline --graph --decorate --all -20   # look at what arrived
git merge origin/main       # or git rebase origin/main — deliberately
```

Three commands instead of one, and you see what you are integrating before it
changes your working tree. On a branch you have been working on for a day, this is
the difference between an informed merge and a surprise conflict.

`git fetch` is also the answer to "is my `git status` up to date?" — it is the
**only** everyday command that refreshes what `status` compares against.

## Fetching more, or less

```bash
git fetch                 # the current remote (usually origin)
git fetch --all           # every remote
git fetch origin main     # one branch
git fetch --prune         # ...and delete stale remote-tracking refs
git fetch --tags          # tags not reachable from fetched branches
```

**`--prune` matters more than it sounds.** When a branch is deleted on the server,
your `origin/<branch>` ref stays forever by default, so `git branch -r` slowly
fills with branches that no longer exist. Make it automatic:

```bash
git config --global fetch.prune true
```

By default Git fetches any tag that **points into the history being fetched**;
`--tags` gets tags that do not. `remote.<name>.tagOpt` or `--no-tags` changes the
default per remote.

## Configuring `pull` so it cannot surprise you

With nothing configured, a `pull` on diverged branches **fails** — `ex1` recorded
the exact message on 2.55.0:

```text
fatal: Need to specify how to reconcile divergent branches
```

That is Git refusing to guess. Answer it once, globally:

| Setting | Behaviour on divergence |
|---|---|
| `pull.ff = only` | **Fail.** You then merge or rebase deliberately. **Recommended** |
| `pull.rebase = true` | Rebase your local commits on top of the remote's |
| `pull.rebase = false` | Merge, creating a merge commit |

```bash
git config --global pull.ff only
```

`--ff-only` fast-forwards when it can — which covers the overwhelmingly common
case of "I have no local commits, just give me theirs" — and stops otherwise. Its
failure message is the prompt to think, which is exactly when you should.

`pull.rebase true` is defensible and popular; the caveat from
[rebase versus merge](../phase-2-branching-merging/06-rebase-vs-merge.md) applies —
it makes rewriting automatic rather than deliberate.

## `pull` with a dirty working tree

`pull` performs a merge, and the merge manual explicitly discourages merging with
non-trivial uncommitted changes, because `--abort` may not be able to reconstruct
them. `pull` refuses outright when the incoming changes would overwrite a file you
have modified:

```text
error: Your local changes to the following files would be overwritten by merge
```

Commit or stash first. `git pull --autostash` does it for you, and is reasonable
to enable:

```bash
git config --global rebase.autoStash true    # applies to pull --rebase too
```

## `git pull --rebase` on a shared branch

The one genuinely dangerous combination. If your local commits were already pushed
to a branch someone else has, `pull --rebase` rewrites them — and now your branch
disagrees with the remote in a way that needs a force-push to resolve.

The rule from [the golden rule](../phase-2-branching-merging/08-the-golden-rule.md)
covers it: rewriting is fine while the commits are yours alone. `pull --rebase` on
your own feature branch is fine; on a branch two people push to, it is how the
duplicate-commit mess starts.

## Trade-off

**`pull` is one command instead of three, and it hides the moment where a decision
gets made.**

For the common case — no local commits, just take what is upstream — `pull` is
exactly right, and insisting on `fetch` + `merge` is ceremony. That case is most
pulls.

The problem is that the same keystrokes behave completely differently when you *do*
have local commits: now it is an integration with a strategy, a possible conflict,
and a possible merge commit, chosen by config you may not have set. The command
does not distinguish, so people learn `pull` as "get latest" and then meet a
conflict in the middle of it with no idea what decision was made on their behalf.

The resolution is not to stop using `pull`. It is to make its failure mode
informative: **set `pull.ff = only`**, so the trivial case stays one command and
the non-trivial case stops and tells you. Then reach for `fetch` and look
whenever the answer matters.

## Gotchas

**Symptom:** `git status` shows stale ahead/behind counts
**Cause:** they compare against remote-tracking refs, updated only by `fetch`, `pull` or `push`
**Fix:** `git fetch`. No amount of `status`, `log` or `diff` will refresh them

**Symptom:** `git pull` produced a merge commit you did not want
**Cause:** branches had diverged and the configured strategy was merge
**Fix:** `git config --global pull.ff only`. Undo the merge with `git reset --hard ORIG_HEAD`

**Symptom:** `fatal: Need to specify how to reconcile divergent branches`
**Cause:** branches diverged and no `pull.ff` / `pull.rebase` is configured — Git refuses to guess
**Fix:** set `pull.ff only` globally, then choose `git merge origin/main` or `git rebase origin/main` deliberately

**Symptom:** deleted branches keep showing in `git branch -r`
**Cause:** remote-tracking refs are not removed automatically when the remote branch goes
**Fix:** `git fetch --prune`, and `git config --global fetch.prune true` to make it permanent

**Symptom:** `pull` refuses, saying local changes would be overwritten
**Cause:** you have uncommitted edits to a file the incoming commits also change
**Fix:** commit or stash. `--autostash` automates it; `rebase.autoStash true` makes that the default

**Symptom:** `git pull --rebase` rewrote commits you had already pushed to a shared branch
**Cause:** it rebases your local commits regardless of whether they were published
**Fix:** force-push only if the branch is genuinely yours; otherwise your colleagues need the recovery from the golden-rule topic. Prefer `pull.ff only` on shared branches

---

← Prev: [A remote is a named URL](01-a-remote-is-a-url.md) · Next → [Remote-tracking branches](03-remote-tracking-branches.md)
