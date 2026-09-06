---
title: "Rewriting your own last few commits"
sidebar_label: "05 · Rewriting your own"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-commit` (`--amend`,
> `--fixup`, `--reset-author`), `man git-rebase` (`-i`, `--autosquash`,
> `--root`). **Documentation-validated, not sandbox-proven.**

**On a branch nobody else has, the last few commits are editable in every respect
— content, message, order, count, authorship. This is the tidying pass that makes
messy local work irrelevant, and it is bounded entirely by one condition: the
commits must still be yours alone.**

## Pick by how far back

| Situation | Command |
|---|---|
| The **last** commit, message only | `git commit --amend` |
| The last commit, forgot a file | `git add <f>` then `git commit --amend --no-edit` |
| **Several** commits — reorder, squash, drop, reword | `git rebase -i <base>` |
| A fix for a commit **buried** in the branch | `git commit --fixup=<hash>` then `git rebase -i --autosquash` |
| Undo commits, keep the work | `git reset --soft HEAD~n` |
| The **very first** commit | `git rebase -i --root` |

`--root` is the one people assume is impossible. It includes the initial commit in
the todo list, so even the first commit can be reworded or split.

## Amend, precisely

```bash
git commit --amend                  # edit the message
git commit --amend --no-edit        # keep the message, take the staged changes
git commit --amend --only --no-edit # ...WITHOUT sweeping in unrelated staged work
git commit --amend --reset-author   # make the author you, now
git commit --amend --author="Name <email>"
```

`--amend` replaces the tip with a **new commit**: same parents, same author and
author date, new committer and new hash
([`git commit`](../phase-1-everyday-loop/03-git-commit.md)).

`--amend --only` is the underused one. Plain `--amend` includes everything
currently staged, which is wrong if you have already staged part of the *next*
change.

## The `--fixup` workflow

The good habit, and the reason review feedback on commit three of six is not
annoying:

```bash
git commit --fixup=<hash>              # message becomes "fixup! <that subject>"
# ...more work, more fixups...
git rebase -i --autosquash main        # todo list arrives already correct
```

`--autosquash` matches `fixup!` / `squash!` / `amend!` messages to their target,
**moves them into position** and pre-sets the command. You save the todo list
unchanged.

```bash
git config --global rebase.autosquash true
```

Two extra forms: `--fixup=amend:<hash>` replaces content *and* message;
`--fixup=reword:<hash>` replaces only the message.

## Splitting a commit that did two things

```bash
git rebase -i <base>       # mark the commit `edit`
git reset HEAD^            # undo it, keep changes unstaged
git add -p                 # stage the first coherent piece
git commit -m "First thing"
git add -p
git commit -m "Second thing"
git rebase --continue
```

This is the documented procedure and the cleanest fix for "I committed two things
at once" — the counterpart to
[what belongs in one commit](../phase-1-everyday-loop/10-commit-messages.md).

## Fixing authorship across several commits

```bash
git rebase -i --root --exec 'git commit --amend --no-edit --reset-author'
```

Rewrites the author of every commit to your current identity — the fix for a
repository where commits went in under the wrong `user.email` before you noticed.
It rewrites **everything**, so it is only appropriate on a branch nobody else has.

Prevention is better: set `user.email` per repository
([identity and first-run setup](../phase-0-how-git-stores-things/10-identity-setup.md)).

## Testing what you rewrote

```bash
git rebase -i --exec 'npm test' main
```

Every replayed commit is a combination that was never built. `--exec` builds each
one and stops at the first failure. On a branch you expect anyone to bisect later,
this is the difference between an honest linear history and a plausible-looking
one.

## The boundary

Every command here creates new commits. That is fine while the branch is yours and
not otherwise:

| Branch state | Rewrite? |
|---|---|
| Never pushed | ✅ Freely |
| Pushed, yours alone | ✅ Then `git push --force-with-lease --force-if-includes` |
| Someone else has committed to it | ❌ Add a commit instead |
| Under review, others may have pulled | ⚠️ Only after telling them |
| `main` or protected | ❌ `git revert` |

Undo is always the same:

```bash
git reset --hard ORIG_HEAD
git reflog                     # for anything older
```

## Trade-off

**Local rewriting is free and safe, and the same commands become the most
disruptive thing in Git the moment the branch is shared — with no change in how
they look or behave.**

Nothing about `git rebase -i` warns you which side of the line you are on. The
command is identical, the output is identical, and the difference is a fact about
other people's repositories that Git cannot see. That is why "rebase is dangerous"
persists as folklore: the danger is real but conditional, and the condition is
invisible.

Treating the two cases as different activities is what makes this manageable.
Before the branch is shared, rewriting is a **drafting tool** — commit badly, fix
it later, and never think about it. After it is shared, the only additive tool is
`revert`, and the branch's history is finished whether you like it or not.

The practical line is the moment you open a pull request. Tidy before that
freely; afterwards, add commits and let the host's squash button — if your team
uses one — clean up at merge time.

## Gotchas

**Symptom:** `--amend` swept in changes you had staged for the next commit
**Cause:** plain `--amend` includes everything currently staged
**Fix:** `git commit --amend --only --no-edit` amends without taking staged work

**Symptom:** `--autosquash` did not move your fixup commit
**Cause:** the message must start exactly `fixup! ` or `squash! ` followed by the target's subject or hash
**Fix:** use `git commit --fixup=<hash>` rather than writing the message by hand

**Symptom:** you cannot include the first commit in an interactive rebase
**Cause:** `HEAD~n` cannot reach past the root
**Fix:** `git rebase -i --root`

**Symptom:** after rewriting, `git push` is rejected
**Cause:** new commits, so the push is not a fast-forward
**Fix:** `git push --force-with-lease --force-if-includes` if the branch is yours. If not, do not rewrite — see [the golden rule](../phase-2-branching-merging/08-the-golden-rule.md)

**Symptom:** the rebase stopped and you have lost track of where you are
**Cause:** an `edit` step or a conflict
**Fix:** `git status` names the state and prints `Last commands done (N commands done)`; `--continue`, `--skip` or `--abort`

**Symptom:** you rewrote authorship and the host still shows the old author
**Cause:** the host maps the commit **email** to an account; the name is cosmetic
**Fix:** ensure `user.email` matches an email registered on your host account, then rewrite again

## Interview questions

**★ How do you pick the right rewriting tool?**
By how far back the problem is. The last commit's message or a forgotten file is
`git commit --amend`. Several commits — reorder, squash, drop, reword — is
`git rebase -i <base>`. A fix for a commit buried in the branch is
`git commit --fixup=<hash>` now plus `git rebase -i --autosquash` later. Undoing
commits while keeping the work is `git reset --soft HEAD~n`. And the very first
commit, which people assume is untouchable, is `git rebase -i --root`.

**★ What does `--amend --only` do, and why is it underused?**
Plain `--amend` folds in **everything currently staged**, which is wrong the moment
you have started staging the *next* change — you meant to fix the last commit and you
have just absorbed unrelated work into it. `--amend --only --no-edit` amends without
taking staged content, so the previous commit is corrected and your in-progress
staging survives untouched. It is the difference between a targeted fix and a silent
merge of two changes.

**★ Describe the `--fixup` workflow and what `--autosquash` actually does.**
When review feedback lands on commit three of six, you commit the fix immediately as
`git commit --fixup=<hash>`, producing a message of the form `fixup! <target
subject>`. Later, `git rebase -i --autosquash main` recognises those markers, matches
each to its target, **moves it into position** and pre-sets the command — so the todo
list arrives already correct and you save it unchanged. `rebase.autosquash true`
makes it the default, and `--fixup=amend:` and `--fixup=reword:` cover the
content-and-message and message-only variants.

**★ Every commit went in under the wrong `user.email`. How do you fix a whole branch,
and what is the catch?**
`git rebase -i --root --exec 'git commit --amend --no-edit --reset-author'` rewrites
the author of every commit to your current identity. The catch is in the word
"every": it rewrites the entire history, so it is only appropriate on a branch nobody
else has. The other catch is that hosts map the commit **email** to an account and
treat the name as cosmetic, so the rewrite only helps if `user.email` matches an
address registered on your account. Setting `user.email` per repository is the
prevention.

**★ Why is `--exec` worth running on a branch you have rewritten?**
Because every replayed commit is a combination that was never built — your change
applied to a base it was not written against — and in practice only the tip gets
tested. `git rebase -i --exec 'npm test' main` runs the command after each commit and
stops at the first failure, so a history that *looks* bisectable actually is. A
plausible-looking linear history that fails when someone bisects it a year later is
worse than an obviously messy one.

**Why does "rebase is dangerous" persist as folklore?**
Because the danger is real but conditional, and the condition is invisible. Nothing
about `git rebase -i` indicates which side of the line you are on: the command, the
output and the behaviour are identical whether the branch is private or shared, and
the difference is a fact about other people's repositories that Git cannot see. The
way to make it manageable is to treat the two cases as different activities — before
the branch is shared, rewriting is a drafting tool you never think about; after it
is shared, the only additive tool is `revert`. The practical line is the moment you
open a pull request.

---

← Prev: [Recovery with `reflog`](04-reflog-recovery.md) · Next → [Recovering a deleted branch](06-recovering-a-branch.md)
