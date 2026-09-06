---
title: "Remote-tracking branches, and pruning"
sidebar_label: "03 · Remote-tracking branches"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-fetch` (refspecs,
> `--prune`), `man git-branch` (`-r`, `-a`, `--merged`), `man git-remote`
> (`prune`, `show`), `man git-config` (`fetch.prune`).
> **Documentation-validated, not sandbox-proven.**

**`origin/main` is a local file containing a hash, exactly like a branch — the
only difference is that only `fetch` and `push` are allowed to move it. It is a
cache of where the remote was, and treating it as live is the single most common
source of confusion about remotes.**

## Three kinds of ref

| Ref | Path under `.git/` | Who moves it |
|---|---|---|
| `main` | `refs/heads/main` | You — commit, merge, reset |
| `origin/main` | `refs/remotes/origin/main` | `fetch`, `pull`, `push` |
| `v1.4.0` | `refs/tags/v1.4.0` | Nobody, once created |

All three are the same thing on disk: a file with a hash in it
([refs and HEAD](../phase-0-how-git-stores-things/06-refs-and-head.md)). The
namespace is the whole distinction.

```bash
git branch            # local
git branch -r         # remote-tracking
git branch -a         # both
git branch -vv        # local, with tracking info and ahead/behind
```

`git branch -vv` is the most useful of these: it shows each local branch, its
upstream, and how far ahead or behind — the same numbers `git status` prints, for
every branch at once.

## Where "ahead 2, behind 3" comes from

Git compares your branch to its **upstream** — a remote-tracking ref — and counts
commits each side has that the other lacks:

- **ahead** = commits you have that `origin/main` does not;
- **behind** = commits `origin/main` has that you do not.

Both are computed **entirely locally**, against a ref last updated by your most
recent fetch. No network call happens. A branch that says "up to date" may be
hours behind reality.

```bash
git fetch                                # the only way to refresh the comparison
git log --oneline main..origin/main      # what is coming
git log --oneline origin/main..main      # what you have not pushed
```

Those two commands are the exact contents of "behind" and "ahead", and reading
them beats trusting the counts.

## Checking out a remote branch

```bash
git switch feature/pricing        # DWIM: creates a local branch tracking origin's
git switch -c local-name origin/feature/pricing   # explicit
git switch --detach origin/main   # look at it without creating a branch
```

The first form works because of `--guess` (on by default): if no local
`feature/pricing` exists but exactly one remote has it, Git creates the local
branch and sets it to track. With **several** remotes carrying the same name it is
ambiguous and Git will say so — then you name it explicitly.

You cannot commit onto `origin/main` itself. Checking it out directly gives a
detached HEAD, which Git warns about.

## Pruning: stale refs stay forever by default

When a branch is deleted on the server, your `origin/<branch>` remains until you
prune it:

```bash
git fetch --prune                  # this fetch only
git remote prune origin            # prune without fetching
git config --global fetch.prune true    # always
```

Set the config. Without it, `git branch -r` accumulates every branch anyone ever
merged, and the list becomes useless — which is how repositories end up with
people grepping `git branch -r` and finding branches that were deleted last year.

⚠️ **Pruning removes remote-tracking refs, never your local branches.** A local
branch whose upstream disappeared stays put, still pointing at your commits.
`git branch -vv` marks it as `[origin/x: gone]`, which is the signal that the
branch was merged and cleaned up on the server:

```bash
git branch -vv | grep ': gone]'    # local branches whose upstream is gone
```

That is the honest list of local branches worth deleting after a round of merged
PRs.

## Deleting a branch on the remote

```bash
git push origin --delete feature/pricing
git push origin :feature/pricing        # older syntax: push "nothing" to that ref
```

Both push a deletion. Deleting your local branch does **not** delete the remote
one, and vice versa — three separate things exist (your branch, your
remote-tracking ref, the remote's branch) and each is removed separately. This is
why "I deleted the branch" is an ambiguous sentence.

## Trade-off

**Caching the remote's state locally makes Git fast and offline-capable, and makes
every number it prints about the remote potentially wrong.**

The benefit is structural, not incidental. `git log`, `git diff`, `git status`,
`git branch -vv` and ahead/behind counts all work with no network, instantly, on a
plane. Git can do this because it never pretends to consult the remote: it
consults a local ref that a fetch updated.

The cost is that the interface does not distinguish "true now" from "true as of
your last fetch". `git status` says *"Your branch is up to date with
'origin/main'"* in exactly the same wording whether you fetched two seconds or two
weeks ago. There is no staleness indicator, no timestamp, and no warning.

The mitigation is one habit: **`git fetch` before you conclude anything about
what other people have done** — before starting a branch, before opening a PR,
before deciding you are up to date. It is safe, fast, and changes nothing you are
working on.

## Gotchas

**Symptom:** `git status` says up to date, but the remote has new commits
**Cause:** the comparison is against a remote-tracking ref last refreshed by your previous fetch
**Fix:** `git fetch`. Nothing else refreshes it, and there is no staleness warning

**Symptom:** `git branch -r` lists branches that were deleted months ago
**Cause:** remote-tracking refs are not pruned automatically
**Fix:** `git config --global fetch.prune true`, and `git remote prune origin` once now

**Symptom:** a local branch survived pruning and now tracks nothing
**Cause:** pruning removes remote-tracking refs, never local branches
**Fix:** expected, and useful — `git branch -vv | grep ': gone]'` is the list of merged branches safe to delete locally

**Symptom:** `git switch <branch>` did not create a local branch from the remote
**Cause:** more than one remote has that branch name, so the DWIM guess is ambiguous
**Fix:** `git switch -c <branch> origin/<branch>` explicitly

**Symptom:** you deleted a branch locally and it is still on the server
**Cause:** they are separate refs in separate repositories
**Fix:** `git push origin --delete <branch>`

**Symptom:** ahead/behind counts look impossible — ahead 12, behind 12
**Cause:** someone rewrote the branch upstream; your commits and theirs are the same changes with different hashes
**Fix:** [the golden rule](../phase-2-branching-merging/08-the-golden-rule.md)'s recovery — `git reset --hard origin/<branch>` if you have nothing unique, otherwise `rebase --onto`

## Interview questions

**★ How does `origin/main` differ from `main`?**
Only in who is allowed to move it. Both are files under `.git/refs/` containing a
hash — `refs/heads/main` and `refs/remotes/origin/main` — and the namespace is the
entire distinction. You move `main` by committing, merging or resetting; only
`fetch`, `pull` and `push` move `origin/main`. That is why you cannot commit onto a
remote-tracking ref, and why checking one out gives a detached `HEAD` rather than a
branch.

**★ Where do "ahead 2, behind 3" actually come from?**
From counting commits between your branch and its upstream, entirely locally:
ahead is what you have that `origin/main` lacks, behind is the reverse, and the
comparison uses the remote-tracking ref as of your **last fetch**. No network call
is involved, so a branch reporting "up to date" may be hours behind reality, and
the wording is identical whether you fetched two seconds or two weeks ago. Reading
`git log --oneline main..origin/main` and its reverse gives you the actual commits
rather than the counts.

**★ What does pruning remove, and what does it deliberately leave alone?**
It removes **remote-tracking refs** whose branches no longer exist on the server,
and it never touches local branches. That asymmetry is useful rather than annoying:
after a round of merged pull requests, `git branch -vv | grep ': gone]'` lists
exactly the local branches whose upstream has been deleted — the honest candidate
list for cleanup. Without `fetch.prune true`, `git branch -r` slowly fills with
branches deleted last year and stops being informative.

**★ Why is "I deleted the branch" an ambiguous sentence?**
Because three separate things exist: your local branch, your remote-tracking ref,
and the branch in the remote repository. Deleting the local one leaves the remote
untouched; pruning removes only the tracking ref; and removing the remote branch
takes `git push origin --delete <branch>` (or the older `git push origin :<branch>`,
which pushes "nothing" to that ref). Each is a separate operation on a separate ref,
in a separate repository in one case.

**★ `git switch feature/pricing` created a tracking branch on one machine and failed
on another. Why?**
The DWIM guess. With `--guess` on by default, if no local branch of that name exists
and **exactly one** remote has it, Git creates the local branch and sets it to
track. If two remotes carry the same branch name — the usual fork setup with
`origin` and `upstream` — the guess is ambiguous and Git says so. The explicit form
is `git switch -c feature/pricing origin/feature/pricing`.

**Ahead 12, behind 12 on a branch you have been working on alone. What happened?**
Someone rewrote the branch upstream. Your twelve commits and their twelve are the
same changes with different hashes, so neither side is an ancestor of the other and
Git counts both. If you have nothing unique locally, `git reset --hard
origin/<branch>` is the clean repair; if you do, `git rebase --onto` replays only
your own work onto the new upstream. It is the receiving end of the rule against
rewriting shared history.

---

← Prev: [`fetch` versus `pull`](02-fetch-vs-pull.md) · Next → [Upstream tracking](04-upstream-tracking.md)
