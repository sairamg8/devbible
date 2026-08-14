---
title: "`git commit` — the index is what gets committed"
sidebar_label: "03 · git commit"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-commit` (DESCRIPTION,
> OPTIONS, COMMIT INFORMATION, DISCUSSION). **Documentation-validated, not
> sandbox-proven**; the one console block is recorded output from
> `sandbox/git-p0/ex2-object-model.sh`.

**`git commit` writes a tree from the index and nothing else. Not your working
tree, not "the files you changed" — the index. Every "my change isn't in the
commit" traces back to that one sentence, and so does every flag on this page.**

## What actually gets written

A commit records a complete tree, its parents, an author, a committer and a
message. Phase 0 read one straight out of the object store:

```console
$ git cat-file -p HEAD
tree 867606d725142c531644a7572a2b400a9160e51e
author dev <dev@example.com> 1786615200 +0000
committer dev <dev@example.com> 1786615200 +0000

Add greeting and math helper
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §5, kept in
`sandbox/git-p0/ex2-output.txt`. The first commit in a repository has no `parent`
line; every later one has at least one.</small>

The `tree` line is the whole point: it names a **complete snapshot**, built from
the index at the moment you committed. See
[a commit is a snapshot](../phase-0-how-git-stores-things/02-commit-is-a-snapshot.md).

## The message

```bash
git commit -m "Fix rounding on invoice totals"
git commit                     # opens $GIT_EDITOR
git commit -v                  # editor, with the staged diff shown below
```

Three things worth knowing:

- **An empty message aborts the commit.** Delete everything in the editor, save,
  and nothing is created. That is the standard way to change your mind.
- **`-v` puts the staged diff in the editor**, below the message, as a comment.
  It is the commit preview and the message prompt in one screen. `commit.verbose
  = true` makes it the default, and it is the single best `commit` setting.
- **The first line is the title.** Everything up to the first blank line is
  treated as the title and used throughout Git — `format-patch` puts it on the
  Subject line, `log --oneline` shows it, hosts use it as the PR title. The manual
  recommends **no more than 50 characters**, then a blank line, then the body.
  Message craft is [topic 10](../README.md).

## `-a`: the flag with a hole in it

```bash
git commit -a -m "..."     # stage tracked modifications and deletions, then commit
```

The manual's wording is exact and worth quoting:

> Automatically stage files that have been **modified and deleted**, but **new
> files you have not told Git about are not affected**.

So `-am` is a two-thirds shortcut. It picks up edits and deletions to files Git
already tracks, and silently skips everything untracked. The failure mode is
specific and common: you create a new file, edit three existing ones, run
`git commit -am "add feature"`, and the commit contains the edits but not the new
file. Tests pass locally — the file is on your disk — and fail for everyone else.

Two habits defuse it. Run `git status` before `-a`, or do not use `-a` at all and
let [`git add`](02-git-add/README.md) be the deliberate step it was designed to be.

`git commit -p` also exists, and runs the same patch interface as `git add -p`
before committing what you selected.

## Committing specific paths

```bash
git commit -m "..." src/invoice.js     # commit ONLY this path
```

Naming paths on the command line switches Git into `--only` mode automatically:
it takes the **working tree** contents of those paths and **disregards anything
staged for other paths**. Your carefully staged index is not part of that commit,
and it is still staged afterwards.

`-i` / `--include` is the opposite: commit the named paths *plus* what is already
staged.

`--only` also combines with `--amend` — and there, no paths are required. That
combination is how you amend the previous commit **without** sweeping in whatever
you have staged since:

```bash
git commit --amend --only --no-edit
```

## `--amend`: a new commit, always

`--amend` does not edit the last commit. It **replaces the tip of the branch with
a new commit**, and the manual gives the rough equivalence:

```bash
git reset --soft HEAD^
# ... build the right tree ...
git commit -c ORIG_HEAD
```

Consequences, all of them from that:

| Fact | Why |
|---|---|
| **The hash changes** | A different tree, message or timestamp is a different object. There is no in-place edit in Git |
| **The parents stay the same** | So the branch's shape is unchanged — it can even amend a merge commit |
| **The author stays the same** | Including the original author date. `--reset-author` is what changes it |
| **The committer becomes you, now** | Author and committer are separate fields, and amending updates the second |
| **The old commit still exists** | Unreferenced, reachable via `git reflog` until garbage collection |

`--no-edit` amends without opening the editor — the usual form when you are only
fixing the content:

```bash
git add forgotten-file.js
git commit --amend --no-edit
```

**Do not amend a commit you have already pushed** unless you know exactly who has
it. Everyone else's branch now points at a commit that no longer exists on the
remote, and their next pull will look like a divergence. That is the rewriting-
shared-history rule, and it is Phase 2's topic.

## Author versus committer

Every commit carries both. They differ whenever a commit is moved or rewritten —
`--amend`, `rebase`, `cherry-pick` — where the **author** stays the person who
wrote the change and the **committer** becomes the person who replayed it.

Identity is resolved in this order:

1. `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` / `GIT_COMMITTER_NAME` /
   `GIT_COMMITTER_EMAIL` environment variables (and their `_DATE` counterparts);
2. `author.name` / `committer.name` and their email options, if set;
3. `user.name` and `user.email` — **the normal case**;
4. the `EMAIL` environment variable;
5. the system username and the mail hostname, guessed.

That last fallback is why a machine with no configured identity can still produce
commits attributed to `you@some-container-hostname` rather than failing. Set
`user.email` per repository when work and personal commits share a laptop — see
[identity and first-run setup](../phase-0-how-git-stores-things/10-identity-setup.md).

## The flags worth knowing about

| Flag | What it does | When |
|---|---|---|
| `-v` | Show the staged diff in the editor | Always. Set `commit.verbose=true` |
| `--amend --no-edit` | Fold staged changes into the last commit, keeping its message | The forgotten file, before pushing |
| `--no-verify` | Skip the `pre-commit` and `commit-msg` hooks | A genuine emergency, not a slow linter. CI will still run |
| `--allow-empty` | Create a commit with no changes | Triggering a pipeline; almost never otherwise |
| `-C <commit>` / `-c <commit>` | Reuse another commit's message and authorship (`-c` opens the editor first) | Re-applying work you had to reconstruct |
| `--fixup=<commit>` | Create a `fixup!` commit that `rebase --autosquash` folds into `<commit>` | Review feedback on a branch you will rebase — Phase 2 |
| `--date=<date>` | Override the author date | Rare, and it makes history lie. Prefer not to |

`--no-verify` deserves the warning it gets. Hooks are the last check that runs
before a bad commit exists; skipping them because a hook is slow means fixing the
hook is never anyone's problem.

## Trade-off

**`git commit -a` optimises for speed and quietly changes what "commit" means.**

Typed as `git commit -am "..."`, the whole staging area disappears from your
workflow: no `add`, no review step, no chance to split a change. That is
genuinely fine for a one-line fix, and it is why the flag exists.

The cost is that you have removed the only checkpoint between "what I have been
doing" and "what is now permanent", and the flag does not even do the whole job —
new files are excluded, so the commit can be incomplete in a way that builds on
your machine and nowhere else. The staging area is the thing that makes
`git add -p`, `git diff --staged` and "commit the fix, not the debug logging"
possible, and `-a` opts out of all three at once.

A workable settlement: `-a` for trivia you have just read in `git status`, `add`
plus `commit -v` for everything else, and `--amend --no-edit` for the correction
you will inevitably need thirty seconds later.

## Gotchas

**Symptom:** you committed and your change is missing
**Cause:** it was never staged. `commit` builds a tree from the index only
**Fix:** `git add` it and `git commit --amend --no-edit`. Turn on `commit.verbose` so the staged diff is in front of you next time

**Symptom:** `git commit -am` did not include a file you just created
**Cause:** `-a` stages modified and deleted **tracked** files; untracked files are never picked up
**Fix:** `git add <file>` first. Read `git status` before reaching for `-a`

**Symptom:** you amended and now `git push` is rejected as non-fast-forward
**Cause:** amending created a **new commit**; the remote still has the old one, and your branch no longer contains it
**Fix:** if nobody else has pulled, `git push --force-with-lease`. If they have, do not rewrite — commit the correction on top instead

**Symptom:** `git commit -m "..." src/file.js` did not include your carefully staged changes
**Cause:** naming paths switches on `--only`, which takes the working-tree contents of those paths and disregards everything staged for other paths
**Fix:** use `-i` to include the staged content too, or commit the index normally and then commit the path separately

**Symptom:** your commits show someone else's name, or a hostname-based email
**Cause:** identity fell through to `EMAIL` or to the system username and mail hostname because `user.email` was unset in this repository
**Fix:** `git config user.email you@example.com` in the repository. Check with `git config --show-origin --show-scope user.email`

**Symptom:** an amended commit lost the original author
**Cause:** `--reset-author` was passed, or the amend was made by a different person from the original author
**Fix:** `git commit --amend --author="Name <email>"` to restore it. Plain `--amend` preserves author and author date by design

**Symptom:** the editor opened, you closed it, and nothing was committed
**Cause:** the message was empty — Git aborts rather than creating a commit with no message
**Fix:** intended behaviour. It is the reliable way to back out of a commit you started by accident

---

← Prev: [`git add` in full](02-git-add/README.md) · Next → [Phase 1 index](README.md)
