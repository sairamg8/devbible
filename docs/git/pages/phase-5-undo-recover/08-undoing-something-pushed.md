---
title: "Undoing something already pushed"
sidebar_label: "08 · Undoing something pushed"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-revert`, `man git-push`
> (`--force-with-lease`, `--force-if-includes`), `man git-rebase`
> §RECOVERING FROM UPSTREAM REBASE, `man gitignore` (NOTES).
> **Documentation-validated, not sandbox-proven.**

**Once a commit is on the remote, your local repository is no longer the only copy
and you have exactly two options: add a commit that undoes it, or rewrite and make
everyone else clean up. The first is nearly always right. The one case that looks
like an exception — a leaked secret — is the case where rewriting helps least.**

## The decision

```text
Is the branch protected, or does anyone else have it?

  YES → git revert. Full stop.
  NO  → rewrite + git push --force-with-lease --force-if-includes
```

"Anyone else" includes CI runners, forks and bots. When in doubt, assume yes —
the cost of an unnecessary revert is one extra commit in `git log`.

## The safe route: `revert`

```bash
git revert <commit>                 # a normal commit
git revert -m 1 <merge-commit>      # a merge — parent 1 is the mainline
git revert --no-commit <a> <b>      # several, combined into one commit
git commit -m "Revert the pricing experiment"
```

Nothing is rewritten, no force-push is needed, every clone stays valid. The
history records both the mistake and the correction, which is honest and
occasionally useful.

⚠️ Reverting a merge leaves the branch **still merged** in Git's model, so
re-merging it later brings in only post-revert commits. The fix is to revert the
revert — see [undoing a merge](07-undoing-a-merge.md).

## The rewrite route, when the branch is genuinely yours

```bash
git rebase -i <base>       # drop, squash, or edit the offending commit
git push --force-with-lease --force-if-includes
```

`--force-with-lease` refuses if the remote moved since your last fetch;
`--force-if-includes` additionally requires that those commits are reachable from
your branch, closing the hole a background `git fetch` opens
([force-pushing safely](../phase-4-remotes/06-force-pushing-safely.md)).

**Tell people before you do it.** Anyone holding the old commits will otherwise
`pull`, merge the old and new versions cleanly, and end up with duplicates of
every rewritten commit — silently. Their recovery:

```bash
git fetch
git reset --hard origin/<branch>                       # no unique local work
git rebase --onto origin/<branch> <old-tip> <branch>   # with local work
```

## The secret case, in order

This is the one people get wrong under pressure, and the order matters more than
the commands:

| # | Step | Why |
|---|---|---|
| 1 | **Rotate the credential.** | It has been in every clone, CI cache, fork and possibly a public host. This is the step that resolves the incident |
| 2 | Stop tracking the file — `git rm --cached`, add an ignore rule, commit | Stops it recurring ([ignoring does not untrack](../phase-1-everyday-loop/06-ignoring-does-not-untrack.md)) |
| 3 | *Optionally* rewrite history to remove the blob | Hygiene. It does not un-copy anything |
| 4 | Tell the host to purge caches, and check forks | The host may keep the commit reachable by URL even after a rewrite |

**Step 1 is the fix.** Steps 2–4 are cleanup. Hours spent rewriting history while
the key is still valid is the classic and expensive inversion.

Note also that a rewrite here is a rewrite of `main` — the thing this whole page
says not to do — so it costs every clone a recovery. It is sometimes justified;
it is never the first move, and it is never a substitute for rotation.

⚠️ **`git-filter-repo` and `git-lfs` are not installed on this machine** (recorded
by `sandbox/git-p0/ex1-version-facts.sh`), so no page in this corpus demonstrates
the rewrite tooling. `git filter-branch` is deprecated and slow;
`git-filter-repo` and BFG are the current answers, and both are outside the
daily-driver scope this corpus was cut to.

## Undoing specific things

| Pushed mistake | Do |
|---|---|
| A bad commit | `git revert <commit>` |
| A bad merge | `git revert -m 1 <merge>` |
| One bad commit inside a good merge | `git revert <that commit>` — not the merge |
| A wrong commit message | Leave it. A rewrite is not worth it on a shared branch |
| A large binary | `revert` removes it from the tip; the blob stays in history and in the pack |
| A secret | **Rotate first.** Then the steps above |
| A whole broken branch merged into `main` | `git revert -m 1`, then rebuild on a fresh branch |

The "wrong commit message" row is worth stating plainly: it is the most tempting
rewrite and the least valuable one. A message nobody will read again is not worth
a coordinated recovery.

## Trade-off

**Everything about undoing a pushed commit is a trade between your history and
other people's time, and the arithmetic almost never favours the history.**

A rewrite gives a clean result: the bad commit is gone, `git log` reads correctly,
nothing records the mistake. That is genuinely nicer, and on a branch nobody has,
it is free.

Once it is shared, the cost is invisible to you and lands on everyone else: a
recovery procedure each, a silent duplicate-commit failure mode for anyone who
does not know to run it, and a coordination problem that scales with the number of
clones — which is exactly the number you cannot see from your terminal.

`revert` costs one extra commit and nothing else. That is the trade, and it is why
the rule is stated as absolute rather than as a judgement call: the judgement
requires information Git cannot give you.

The one place the calculus genuinely changes is a leaked credential — and even
there it changes less than people think, because **rewriting does not recall
anything already fetched.** Rotation is what closes the exposure; the rewrite is
tidying afterwards.

## Gotchas

**Symptom:** you `reset --hard` and force-pushed to undo a pushed commit, and colleagues now have duplicates
**Cause:** their `pull` merged the old and new versions, which merge cleanly because the content is identical
**Fix:** they run `git reset --hard origin/<branch>`, or `git rebase --onto` if they have local work. Use `revert` on shared branches

**Symptom:** the host rejected your force-push
**Cause:** branch protection — a host feature, independent of Git
**Fix:** working as intended. `git revert`

**Symptom:** you rewrote history to remove a secret and it is still reachable
**Cause:** other clones, forks, CI caches, and the host's own reflog still have it
**Fix:** rotate the credential — that is the actual remediation. Then ask the host to purge caches

**Symptom:** reverting a merge, then re-merging the fixed branch, brought in almost nothing
**Cause:** the merge commit remains, so those commits are still ancestors
**Fix:** revert the revert first, or rebuild the work on a new branch from current `main`

**Symptom:** you reverted to remove a large file and the repository is still huge
**Cause:** `revert` removes it from the current tree; the blob remains in history and in the packfile
**Fix:** only a history rewrite shrinks it, and that requires everyone to re-clone. Usually not worth it — prevent it with ignore rules instead

**Symptom:** you cannot tell whether anyone has the branch
**Cause:** Git does not record who fetched, and cannot
**Fix:** assume they do. An unnecessary `revert` costs one commit; an unnecessary rewrite costs everyone an afternoon

## Interview questions

**★ Something is pushed and wrong. What are the only two options?**
Add a commit that undoes it, or rewrite and make everyone else clean up. The
selector is whether the branch is protected or anyone else has it — where "anyone
else" includes CI runners, forks and bots — and when in doubt the answer is yes,
because an unnecessary revert costs one extra commit in `git log` while an
unnecessary rewrite costs every clone a recovery procedure.

**★ Why is the arithmetic so lopsided?**
Because the benefit of a rewrite is visible to you and the cost is invisible. You get
a clean `git log` with no record of the mistake; everyone else gets a recovery
procedure each, a silent duplicate-commit failure mode if they do not know to run it,
and a coordination problem that scales with the number of clones — the number you
cannot see from your terminal. `revert` costs one commit. That is why the rule is
stated as absolute rather than as a judgement call: the judgement would require
information Git cannot give you.

**★ Give the order of operations for a leaked credential.**
Rotate the credential **first** — it has been in every clone, CI cache and fork, and
possibly a public host, and rotation is the step that actually resolves the incident.
Then stop tracking the file: `git rm --cached`, add an ignore rule, commit. Then
*optionally* rewrite history to remove the blob, which is hygiene rather than
remediation. Then ask the host to purge caches and check forks, because the commit may
stay reachable by URL even after a rewrite. Hours spent rewriting while the key is
still valid is the classic and expensive inversion.

**★ Why is "fix a wrong commit message" the most tempting rewrite and the least
valuable?**
Because the payoff is a message nobody will read again, and the price is a
coordinated recovery for everyone holding the branch. It is the clearest case where
the rewrite is about how the history *looks* to you rather than about what anything
does, and it is worth naming explicitly precisely because it feels harmless. Leave
it.

**★ You reverted a commit that added a huge binary and the repository is still huge.
Why?**
Because `revert` removes the file from the current tree by adding an inverse commit;
the blob is still in history and still in the packfile, so nothing about the
repository's size changes. Only a history rewrite shrinks it, and that requires
everyone to re-clone — usually not worth it. Prevention through ignore rules and
size limits is the real answer, which is the same conclusion as the secret case: the
cheap fix is upstream of the commit.

**What does telling people before a force-push actually save them?**
The silent failure. Without warning, anyone holding the old commits runs `pull`, Git
merges the old and new versions **cleanly** because the content is identical, and
they end up with duplicates of every rewritten commit that then get pushed back — no
error at any point. With warning, the repair is one command: `git reset --hard
origin/<branch>`, or `git rebase --onto origin/<branch> <old-tip> <branch>` if they
have unique local work. The knowledge that a rewrite happened is the entire
difference, and it can only come from you.

---

← Prev: [Undoing a merge](07-undoing-a-merge.md) · Next → [Phase 5 index](README.md)
