---
title: "`git push` in full"
sidebar_label: "07 · git push"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-push` (DESCRIPTION,
> refspecs, `--tags`, `--follow-tags`, `--dry-run`, `--atomic`,
> `push.default`, `push.autoSetupRemote`). **Documentation-validated, not
> sandbox-proven.**

**`git push` sends objects and asks the remote to move a ref. It only ever
succeeds if the move is a fast-forward, unless forced. Everything else — refspecs,
tags, `push.default` — is detail about *which* ref moves where.**

## The shape of the command

```bash
git push                                # current branch to its upstream
git push origin main                    # explicit remote and branch
git push origin HEAD                    # whatever branch I am on, same name there
git push origin local-name:remote-name  # a refspec: source:destination
git push origin --delete old-branch     # delete a remote branch
git push origin :old-branch             # the same, older syntax
```

The `src:dst` refspec is the general form; everything else is shorthand. Reading
`:old-branch` as "push **nothing** to `old-branch`" is what makes the deletion
syntax make sense.

`git push origin HEAD` is a genuinely useful habit: it means "push the branch I am
actually on", with no chance of typing yesterday's branch name.

## `push.default`

What bare `git push` does when you have not specified:

| Value | Behaviour |
|---|---|
| `simple` | Push the current branch to its upstream, refusing if the names differ. **The default since 2.0** |
| `current` | Push to a same-named branch on the remote, creating it if needed |
| `upstream` | Push to the upstream branch whatever it is named |
| `nothing` | Refuse without an explicit refspec |
| `matching` | Push **every** local branch that has a same-named remote branch. The pre-2.0 default — avoid |

`simple` is right. Its refusal on a name mismatch is a real safety property: the
one case where a silent push would go somewhere unintended is exactly the case it
stops.

## First push of a new branch

```bash
git push -u origin feature/pricing      # push and set the upstream
```

Or stop meeting it entirely:

```bash
git config --global push.autoSetupRemote true
```

Then a bare `git push` on a new branch pushes to a same-named branch on the
default remote and sets the upstream. It removes the most-encountered piece of
Git friction there is ([upstream tracking](04-upstream-tracking.md)).

## Tags are not pushed by default

```bash
git push origin v1.4.0        # one tag
git push --tags               # all tags
git push --follow-tags        # commits + annotated tags reachable from them
```

An ordinary `git push` sends **no tags**. This surprises people at release time,
when the tag exists locally and nowhere else.

`--follow-tags` is the balanced option: it pushes annotated tags that are
reachable from the commits being pushed, so release tags travel with their commits
while local scratch tags stay local.

⚠️ **Deleting or moving a published tag is a rewrite.** Anyone who already fetched
it keeps the old one, and Git will not update it automatically. Treat a pushed tag
as immutable; if a release is wrong, publish a new tag.

## Checking before you push

```bash
git push --dry-run              # what would happen
git log --oneline '@{u}'..      # exactly which commits would go
git diff --stat '@{u}'          # what changes they contain
```

`--dry-run` is worth using on any push you are unsure of, and always on a forced
one.

## `--atomic`

```bash
git push --atomic origin main release-notes
```

Pushing several refs at once normally updates each independently, so a partial
failure leaves some updated and some not. `--atomic` makes the whole push succeed
or fail together — worth it when two refs must move as a unit, such as a branch
plus its release tag.

Support depends on the remote, but the major hosts have it.

## Why a push is rejected

| Message | Meaning |
|---|---|
| `non-fast-forward` | The remote has commits you do not — fetch and integrate, or force if the history is yours |
| `stale info` | `--force-with-lease` refused: the remote moved since your last fetch |
| `protected branch` | The host's rule, not Git's |
| `pre-receive hook declined` | A server-side hook rejected it — read the message it printed |

Only the first is really Git's own model at work: **a push must be a fast-forward
unless forced.** That single rule is what stops a push from silently deleting
commits, and it is covered in
[force-pushing safely](06-force-pushing-safely.md).

## What actually travels

A push sends the **objects** the remote lacks, then asks it to move a ref. It does
**not** send:

- your **reflog** — it is local, always
  ([`git reflog`](../phase-2-branching-merging/09-reflog.md));
- your **stashes** — also a local reflog;
- your **config**, hooks or ignore rules in `.git/info/exclude`;
- any **branch you did not name** (under `push.default = simple`).

That list is worth knowing because it defines what a push does *not* back up.
Pushing a branch protects its commits and nothing else about your working state.

## Trade-off

**Push is the moment local becomes public, and Git provides exactly one check on
it: the fast-forward rule.**

That rule is strong where it applies — you cannot accidentally delete history
someone else pushed — and silent everywhere else. Push a secret, a 200 MB binary,
a broken build, an unfinished refactor: all fine, all instant, all now in
everyone's clone the moment they fetch. There is no local review step, and
`--dry-run` reports refs rather than content.

Nothing in Git fills that gap, which is why the surrounding machinery exists:
pre-push hooks locally, protected branches and required reviews on the host, and
secret scanning in CI. Those are all outside Git's model, and the parked hooks/CI
and team-workflow phases are where they would live.

What is inside your control today is small and worth doing: **read
`git log '@{u}'..` before pushing** — it is the exact list of what you are about to
make everyone else's problem, and it takes two seconds.

## Gotchas

**Symptom:** your tag is not on the remote after pushing
**Cause:** `git push` sends no tags by default
**Fix:** `git push origin <tag>`, or `--follow-tags` to send annotated tags along with their commits

**Symptom:** `git push` says everything is up to date, but your commits are missing on the host
**Cause:** you pushed a different branch than the one you are on, or `push.default` sent it elsewhere
**Fix:** `git push origin HEAD`, and check `git branch -vv` for what tracks what

**Symptom:** pushing several branches at once and only some arrived
**Cause:** refs are updated independently unless the push is atomic
**Fix:** `git push --atomic` when the refs must move together

**Symptom:** a colleague still sees the old tag after you moved it
**Cause:** Git does not update an existing tag on fetch — a moved tag is a rewrite
**Fix:** they need `git fetch --tags --force`. Better: never move a published tag; publish a new one

**Symptom:** `pre-receive hook declined`
**Cause:** a server-side hook rejected the push — a lint rule, a commit-message policy, a file-size limit
**Fix:** read the message the hook printed; it is the only source of the reason

**Symptom:** you pushed a secret
**Cause:** it was committed and nothing checked
**Fix:** **rotate the credential first.** Removing it from history afterwards does not un-copy it — see [ignoring does not untrack](../phase-1-everyday-loop/06-ignoring-does-not-untrack.md)

---

← Prev: [Force-pushing safely](06-force-pushing-safely.md) · Next → [Transports and credentials](08-transports-and-credentials.md)
