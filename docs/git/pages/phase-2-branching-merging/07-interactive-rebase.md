---
title: "Interactive rebase"
sidebar_label: "07 · Interactive rebase"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-rebase` (INTERACTIVE MODE,
> SPLITTING COMMITS, `--autosquash`, `--autostash`), `man git-commit`
> (`--fixup`). **Documentation-validated, not sandbox-proven.**

**`git rebase -i` hands you the list of commits about to be replayed and lets you
edit that list first — reorder, drop, merge, split, reword. It turns "commit
messily while thinking, tidy before anyone sees it" from a wish into a two-minute
operation, and it is the reason messy local commits do not matter.**

## Starting it

```bash
git rebase -i HEAD~5          # the last five commits
git rebase -i main            # every commit on this branch not on main
```

The manual's framing: *"Start it with the last commit you want to retain
as-is"* — so `HEAD~5` edits the five commits **after** it. `git rebase -i main`
is usually what you want on a feature branch, because it selects exactly the
branch's own commits.

An editor opens with the todo list, **oldest first** — the opposite order from
`git log`, and the most common early confusion:

```text
pick deadbee Add pricing model
pick fa1afe1 wip
pick 5ca1ab1 fix typo
pick baaaaad Handle empty cart
```

Save and close, and Git executes the list top to bottom. An **empty** list aborts
the rebase, which is the way to change your mind.

## The commands

| Command | Short | What it does |
|---|---|---|
| `pick` | `p` | Use the commit as-is |
| `reword` | `r` | Use it, but open the editor to change the message |
| `edit` | `e` | Stop **after** applying it, so you can amend the content |
| `squash` | `s` | Merge into the previous commit; combine both messages in the editor |
| `fixup` | `f` | Merge into the previous commit; **discard** this message |
| `drop` | `d` | Remove the commit entirely |
| `break` | `b` | Stop here for no reason other than to look around |
| `exec` | `x` | Run a shell command at this point |
| `reset` / `label` / `merge` | | Rewrite branch topology — rarely needed by hand |

`fixup` is the workhorse: it is `squash` without being asked to write a combined
message, which is what you want for "fix typo" and "wip" commits.

**Reordering is just moving lines.** Deleting a line is the same as `drop`.

## `exec` — test every commit

```text
pick deadbee Add pricing model
exec npm test
pick baaaaad Handle empty cart
exec npm test
```

or in one go:

```bash
git rebase -i --exec 'npm test' main
```

This directly addresses the weakness in
[`git rebase`](05-git-rebase.md): replayed commits were never built in their new
form. `--exec` builds each one. If a command fails, the rebase stops there and you
fix that commit with `--continue`.

For a branch that will be bisected later, this is the difference between an honest
linear history and a plausible-looking one.

## `--autosquash`: the workflow that makes this painless

Instead of remembering to squash later, mark the fix when you make it:

```bash
git commit --fixup=<hash>      # message becomes "fixup! <that commit's title>"
git commit --squash=<hash>     # same, but you will be asked to combine messages
git rebase -i --autosquash main
```

`--autosquash` recognises messages starting with `fixup!`, `squash!` or `amend!`,
matches them to the commit named in the rest of the title, **moves them into
position** and pre-sets the right command. The todo list arrives already correct;
you just save it.

```bash
git config --global rebase.autosquash true    # make it the default for -i
```

`--fixup=amend:<hash>` and `--fixup=reword:<hash>` are the two extra forms:
`amend:` replaces both content and message, `reword:` replaces only the message.

This is the single most useful pairing in this phase. Review feedback on commit
three of six becomes `git commit --fixup=<hash>` now, one `rebase -i` later, and
no manual reordering ever.

## `edit` — changing a commit's content

```text
edit deadbee Add pricing model
```

The rebase stops **after** applying that commit, with it as HEAD:

```bash
# make your changes
git add -p
git commit --amend --no-edit
git rebase --continue
```

You can also add *extra* commits at that point — anything you commit before
`--continue` becomes part of the history there.

## Splitting a commit

The manual documents this as its own procedure, and it is `edit` plus a soft
reset:

```text
edit deadbee Two unrelated things
```

```bash
git reset HEAD^          # undo the commit, keep the changes unstaged
git add -p               # stage the first coherent piece
git commit -m "First thing"
git add -p               # stage the rest
git commit -m "Second thing"
git rebase --continue
```

That is the full loop, and it is the cleanest way to fix "I committed two things
at once" after the fact.

## `--autostash` — for a dirty working tree

```bash
git rebase -i --autostash main
git config --global rebase.autoStash true
```

Rebase normally refuses to start with uncommitted changes. `--autostash` stashes
them, rebases, and reapplies them afterwards. It is convenient and worth enabling;
be aware that reapplying can conflict, in which case the changes stay in the
stash.

## The rule this all lives under

Everything here **rewrites commits** — new hashes, every time. That is fine for a
branch nobody else has, and not fine otherwise. The precondition is the same one
as plain rebase, and it is the subject of
[the golden rule](08-the-golden-rule.md).

Undo is the same too:

```bash
git reset --hard ORIG_HEAD    # or find the pre-rebase tip in `git reflog`
```

## Trade-off

**Interactive rebase lets you present work as you wish you had done it, which is
genuinely valuable and genuinely a fabrication.**

The value is real and mostly lands on other people. Six commits of `wip`,
`fix typo`, `actually fix it` are hostile to a reviewer and useless to `git
bisect`; three coherent commits with real messages can be read in order and each
one means something. Nobody benefits from the archaeology of your afternoon.

What is lost is the record of how the change was actually reached — the wrong turn
you took, the approach you abandoned. Occasionally that is the most useful thing
in the history, and it is usually better captured in the commit *message* than in
the commit sequence anyway.

The sharper cost is the one `--exec` exists for: after a rebase, the intermediate
commits are combinations that were never built. A history that looks bisectable
but is not is worse than an obviously messy one, because it fails silently when
someone actually bisects it a year later.

The workable line: **tidy aggressively before review, run `--exec` on anything you
expect to bisect, and never rewrite what is already shared.**

## Gotchas

**Symptom:** the todo list is in the opposite order from `git log`
**Cause:** the todo list is oldest-first, so the rebase can apply it top to bottom
**Fix:** nothing to fix. Read it as chronological order and remember `squash`/`fixup` merge **upwards**, into the line above

**Symptom:** you saved an empty todo list and the rebase aborted
**Cause:** an empty list means "do nothing" — Git treats it as cancellation
**Fix:** that is the documented way to abort. Nothing was changed

**Symptom:** `squash` on the **first** line fails
**Cause:** `squash` and `fixup` merge into the previous commit, and the first line has none
**Fix:** start the rebase one commit earlier (`HEAD~6` instead of `HEAD~5`), so there is a `pick` above it

**Symptom:** the rebase stopped and you cannot remember what you were doing
**Cause:** an `edit` or a conflict
**Fix:** `git status` names the state and prints `Last commands done (N commands done)`. `git rebase --continue`, `--skip` or `--abort`

**Symptom:** `--autosquash` did not move your fixup commit
**Cause:** the message must begin exactly `fixup! ` or `squash! ` followed by the target's title or hash. A hand-typed message with different wording will not match
**Fix:** use `git commit --fixup=<hash>` rather than writing the message yourself

**Symptom:** after rebasing with `--exec`, some commits fail their tests
**Cause:** they genuinely do not build in their replayed form — this is the check working
**Fix:** `edit` the failing commit, fix it, `--continue`. It is exactly the problem the flag exists to expose

## Interview questions

**★ Why is the interactive-rebase todo list in the opposite order from `git log`?**
Because Git executes it top to bottom, and it has to apply the oldest commit first.
So the list is chronological, and `squash` and `fixup` merge **upwards**, into the
line above — which is also why `squash` on the very first line fails: there is no
previous commit to merge into. Start the rebase one commit earlier so there is a
`pick` above it. Saving an **empty** list aborts the whole rebase, which is the
documented way to change your mind.

**★ What is the difference between `squash` and `fixup`, and which do you reach for?**
Both merge the commit into the one above; `squash` opens an editor to combine the
two messages, `fixup` discards this commit's message entirely. `fixup` is the
workhorse, because the commits you are folding in are called "wip" and "fix typo"
and their messages are worth nothing. The other commands worth knowing are `reword`
for a message-only change, `edit` to stop *after* applying a commit so you can amend
its content, `drop` to remove one — deleting the line does the same — and `exec` to
run a command at that point.

**★ What is the `--fixup` / `--autosquash` workflow, and why is it the best pairing
in this phase?**
When you notice that commit three of six needs a fix, you commit it immediately as
`git commit --fixup=<hash>`, which writes the message `fixup! <that commit's title>`.
Later, `git rebase -i --autosquash main` recognises those messages, matches them to
their targets, **moves them into position** and pre-sets the command — the todo list
arrives already correct and you just save it. No manual reordering, ever. Set
`rebase.autosquash true` to make it the default. `--fixup=amend:<hash>` and
`--fixup=reword:<hash>` handle the content-and-message and message-only variants.

**★ How do you split one commit into two, after the fact?**
Mark it `edit` in the todo list. The rebase stops with that commit applied and as
`HEAD`, and then it is a soft reset plus two commits: `git reset HEAD^` to undo the
commit while keeping the changes unstaged, `git add -p` to stage the first coherent
piece, commit it, stage and commit the rest, then `git rebase --continue`. This is
the documented procedure, and it is the cleanest repair for "I committed two things
at once".

**★ What problem does `--exec` solve, and why does it matter more than it sounds?**
Replayed commits were never built in their new form — each one is your change
applied to a base it was not written against — so a rebased branch can look
bisectable while containing commits that do not compile. `git rebase -i --exec 'npm
test' main` runs the command after every commit and stops at the first failure, so
the history you present is one you have actually checked. A history that looks
bisectable and is not is worse than an obviously messy one, because it fails
silently for whoever bisects it a year later.

**Everything on this page rewrites commits. What is the precondition, and what is
the undo?**
The precondition is that nobody else has the commits — every command here produces
new hashes, exactly like a plain rebase, so it is safe on a private branch and not
otherwise. The undo is also the same: `git reset --hard ORIG_HEAD`, which Git sets
before the rebase starts, or the pre-rebase tip from `git reflog`. Both work because
the original commits remain in the object store until garbage collection.

---

← Prev: [Rebase versus merge](06-rebase-vs-merge.md) · Next → [The rule about rewriting shared history](08-the-golden-rule.md)
