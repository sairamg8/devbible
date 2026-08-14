---
title: "Upstream tracking, and `@{u}`"
sidebar_label: "04 · Upstream tracking"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-branch`
> (`--set-upstream-to`, `--unset-upstream`), `man git-push` (`-u`,
> `push.autoSetupRemote`), `man gitrevisions` (`@{upstream}`, `@{push}`),
> `man git-config` (`branch.<name>.remote`, `branch.<name>.merge`).
> **Documentation-validated, not sandbox-proven.**

**An upstream is two config lines saying "this local branch corresponds to that
remote branch". Setting it is what makes bare `git push`, bare `git pull` and the
ahead/behind counts work. Not setting it is why a new branch demands the full
`git push -u origin <name>` incantation the first time.**

## What it is

```ini
[branch "feature/pricing"]
    remote = origin
    merge = refs/heads/feature/pricing
```

That is the whole feature. `remote` names which remote, `merge` names the branch
there. Together they define the branch's **upstream**, which Git uses for:

- bare `git push` and bare `git pull` — where to send and take from;
- the ahead/behind counts in `git status` and `git branch -vv`;
- the `@{u}` shorthand.

```bash
git branch -vv                                  # see every branch's upstream
git rev-parse --abbrev-ref '@{upstream}'        # the current branch's
```

## Setting it

```bash
git push -u origin feature/pricing        # push AND set upstream — the usual way
git branch -u origin/main                 # set it on the current branch
git branch --set-upstream-to=origin/main main
git branch --unset-upstream               # remove it
```

`-u` is `--set-upstream`, and it is why the first push of a branch takes an
argument and later ones do not.

You can skip that entirely:

```bash
git config --global push.autoSetupRemote true
```

With it on, a bare `git push` on a branch with no upstream pushes to a
same-named branch on the default remote and sets the upstream. It removes the most
common piece of Git friction there is, and there is no real downside for the
normal one-remote workflow.

## `@{u}` and `@{push}`

| Shorthand | Means |
|---|---|
| `@{u}` / `@{upstream}` | The upstream of the current branch |
| `@{push}` | Where a `git push` would send this branch |
| `main@{u}` | The upstream of `main` specifically |

```bash
git log --oneline '@{u}'..           # what I have that upstream does not
git log --oneline ..'@{u}'           # what upstream has that I do not
git diff '@{u}'                      # my working tree against upstream
```

Those first two are the precise definitions of "ahead" and "behind", written as
commands. Quote them — braces are special in some shells.

`@{push}` differs from `@{u}` only in **triangular** workflows, where you fetch
from one remote and push to another (a fork: fetch `upstream`, push `origin`).
`remote.pushDefault` sets that up, and in a normal one-remote setup the two are
identical.

## Where the counts come from

`git status` printing *"Your branch is ahead of 'origin/main' by 2 commits"* is
computed as:

```bash
git rev-list --count '@{u}'..HEAD     # ahead
git rev-list --count HEAD..'@{u}'     # behind
```

Entirely local, against the remote-tracking ref as of your last fetch
([remote-tracking branches](03-remote-tracking-branches.md)). No upstream set
means no counts at all — which is why a new branch's `git status` says nothing
about the remote.

## `push.default`

What bare `git push` sends when you have not said:

| Value | Behaviour |
|---|---|
| `simple` | Push the current branch to its upstream, **and refuse** if the upstream has a different name. **The default** |
| `current` | Push the current branch to a same-named branch on the remote, creating it if needed |
| `upstream` | Push to the upstream branch, whatever it is named |
| `nothing` | Refuse to push without an explicit refspec |
| `matching` | Push every local branch that has a same-named remote branch. **The old default — avoid** |

`simple` is the right default and the reason a mismatched branch name produces an
error rather than a surprise. `matching` was the pre-2.0 default and could push
half a dozen branches you had forgotten about; if you meet it in an old dotfiles
repo, remove it.

## The fork setup

```bash
git remote add upstream https://github.com/original/project.git
git fetch upstream
git branch -u upstream/main main          # main tracks the ORIGINAL
git config remote.pushDefault origin      # but pushes go to YOUR fork
```

Now `git pull` on `main` takes from the original project and `git push` sends to
your fork — which is exactly the fork workflow, expressed in two settings rather
than remembered as a pair of long commands. `@{u}` is `upstream/main`; `@{push}`
is `origin/main`.

## Trade-off

**Upstream tracking makes the common commands short by hiding which remote and
branch they mean.**

Once set, `git push` and `git pull` are unambiguous to Git and ambiguous to you.
That is fine for weeks at a time, and then you are on a branch whose upstream is
someone else's fork, or a release branch tracking a differently-named remote
branch, and a reflexive `git push` goes somewhere you did not intend. Git will not
ask; the config already answered.

The counts have the same shape of problem: they are helpful, they are prominent in
`git status`, and they carry no indication that they are computed from a possibly
stale cache.

Both cost little to defend against, and the defences are worth making habits:
**`git branch -vv` when you are unsure what tracks what**, and **`git push --dry-run`
when it matters**. `push.default = simple` — the default — is doing real work
here: it refuses when the branch names differ, which is precisely the situation
where a silent push would be wrong.

## Gotchas

**Symptom:** `git push` fails on a new branch, demanding `--set-upstream`
**Cause:** no upstream is configured, so bare `push` has no destination
**Fix:** `git push -u origin <branch>` once, or set `push.autoSetupRemote true` globally and stop meeting it

**Symptom:** `git status` says nothing about ahead/behind
**Cause:** the branch has no upstream, so there is nothing to compare against
**Fix:** `git branch -u origin/<branch>`, or push with `-u`

**Symptom:** `git pull` on a fork brought in your own fork's commits, not the original project's
**Cause:** the branch tracks `origin` (your fork) rather than `upstream`
**Fix:** `git branch -u upstream/main main`, and `git config remote.pushDefault origin` so pushes still go to the fork

**Symptom:** `git push` refused, saying the current branch has no upstream *matching* its name
**Cause:** `push.default = simple` refuses when the local and upstream names differ
**Fix:** that is the safety check. Push explicitly — `git push origin HEAD:<remote-branch>` — or fix the naming

**Symptom:** `git log '@{u}'..` fails with a shell error
**Cause:** unquoted braces
**Fix:** quote it, in every shell: `'@{u}'`

**Symptom:** an old machine pushes several branches at once
**Cause:** `push.default = matching`, the pre-2.0 default, left in a config file
**Fix:** `git config --global push.default simple`

---

← Prev: [Remote-tracking branches](03-remote-tracking-branches.md) · Next → [Divergent branches](05-divergent-branches.md)
