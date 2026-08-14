---
title: "Ignoring does not untrack"
sidebar_label: "06 · Ignoring ≠ untracking"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man gitignore` (DESCRIPTION and
> NOTES), `man git-rm` (`--cached`), `man git-update-index`
> (`--assume-unchanged`, `--skip-worktree`). **Documentation-validated, not
> sandbox-proven** — no console blocks, because no run covers them.

**`.gitignore` is consulted only when Git is deciding whether to mention an
**untracked** file. Once a path is in the index, the ignore rules stop applying
to it, permanently. This is one sentence in the manual and the cause of most
committed `.env` files in the world.**

## The rule, and why it works that way

`man gitignore`, first paragraph:

> A gitignore file specifies intentionally **untracked** files that Git should
> ignore. **Files already tracked by Git are not affected.**

The design follows from what the index is. A tracked path has an entry in
`.git/index` pairing it with a blob hash; `git status` compares that entry to
HEAD and to the working tree and reports the difference. Nothing in that path
through the code consults the ignore rules — they exist for the *other* question,
"is this file on disk something I should tell the user about?", which only arises
for paths the index has never heard of.

So adding a rule for a tracked file changes nothing at all. No error, no warning,
no effect. That silence is why the misunderstanding survives: it looks like it
worked.

## Stopping tracking: `git rm --cached`

```bash
git rm --cached .env          # remove from the INDEX, keep the file on disk
git commit -m "Stop tracking .env"
```

`--cached` is what makes this safe: plain `git rm` deletes the file from the
working tree too. With `--cached`, the file stays on disk, and the index entry is
removed — which is what "untrack" means.

For a directory, add `-r`:

```bash
git rm -r --cached node_modules
```

After that commit, the file is untracked, so **now** `.gitignore` starts applying
to it and `git status` stops mentioning it. Confirm with:

```bash
git ls-files | grep .env      # tracked files only. Empty = untracked
```

`git ls-files` is the direct question — it lists what the index contains, with no
ignore logic involved.

### What this does to your colleagues

The commit **deletes the file** as far as everyone else is concerned. When they
pull, Git removes their copy from disk, because that is what the commit says.

For a build artefact, fine. For `.env`, it means every colleague loses their
local configuration on their next pull, with no warning and no obvious cause.
Say so before you push it — this is a one-line message in the team channel that
saves several people an hour.

## The part `rm --cached` does not fix

**The file is still in every earlier commit.** Removing it from the index removes
it going forward; history is immutable, and every clone still holds the blob.

For a build artefact this is only a size problem. For a credential it is the
whole problem, and the order of operations matters:

1. **Rotate the credential first.** Assume it is compromised — it has been in
   every clone, every CI cache, every fork, and possibly a public host. Rewriting
   history does not un-copy it.
2. **Stop tracking the file** — `git rm --cached`, add the ignore rule, commit.
3. **Only then** consider rewriting history, and understand that it invalidates
   everyone's clone and cannot recall what has already been fetched.

Step 1 is the one that actually resolves the incident. Steps 2 and 3 are hygiene.
Doing them in the other order is a common and expensive mistake: hours spent
rewriting history while the live key is still valid.

## The right shape for configuration

Do not commit `.env` and then ignore it. Set it up so it is never tracked:

```gitignore
.env
.env.local
.env.*.local
!.env.example
```

and commit **`.env.example`** — the same keys with placeholder values. New
developers copy it, and the file that documents what configuration exists is in
the repository while the values are not.

This is the whole practice. It costs nothing at project setup and is unpleasant
to retrofit.

## The two flags that look like the answer and are not

```bash
git update-index --assume-unchanged config.json    # DON'T
git update-index --skip-worktree config.json       # rarely
```

Both make Git stop noticing changes to a **tracked** file, which sounds exactly
like what you wanted. Neither is the right tool for "I have local edits to a
committed file".

- **`--assume-unchanged`** is a **performance** promise you make to Git: "this
  file will not change, do not bother checking". Git may still overwrite it, and
  the flag is silently dropped by some operations. Using it to hide edits is
  using a cache hint as an access control.
- **`--skip-worktree`** is the sturdier of the two and is meant for sparse
  checkouts. It survives more operations, but it still conflicts with anything
  that legitimately updates the file — merges and rebases fail in ways that are
  hard to read, and the flag is invisible unless you know to run
  `git ls-files -v` and look for lowercase status letters.

Both are per-clone and invisible to everyone else, so the next person to touch the
repository inherits a mystery. The maintainable answer is nearly always to stop
tracking the file and commit a template instead.

## Trade-off

**Untracking a file is a commit that deletes it, and there is no way to make that
gentle.**

The alternative — leaving the file tracked and everyone quietly working around it
— has an obvious cost that compounds: every pull threatens to overwrite someone's
local configuration, every commit risks sweeping in a machine-specific value, and
`git status` is permanently noisy in a way that trains people to ignore it.

Untracking pays that cost once, visibly, at a moment you choose. The one thing
worth spending effort on is the announcement: a short note saying *"your `.env`
will disappear on the next pull, here is the `.env.example` to copy"* converts a
confusing failure into a thirty-second task.

## Gotchas

**Symptom:** added the file to `.gitignore`, and it still shows as modified and still gets committed
**Cause:** it is tracked. Ignore rules apply only to untracked paths
**Fix:** `git rm --cached <file>` and commit. Verify with `git ls-files <file>` — empty output means untracked

**Symptom:** `git rm` deleted the file from your disk
**Cause:** `--cached` was omitted; plain `git rm` removes it from the index *and* the working tree
**Fix:** recover it — `git checkout HEAD -- <file>` before you commit, or `git restore --source=HEAD~1 -- <file>` afterwards. Then redo it with `--cached`

**Symptom:** colleagues' local `.env` files vanished after pulling your change
**Cause:** to them, the commit deletes the file. That is what an untracking commit is
**Fix:** expected. Tell them in advance and commit a `.env.example` they can copy

**Symptom:** you removed a secret from tracking, so the incident is closed
**Cause:** it is not. The blob is in every earlier commit, in every clone and in every CI cache
**Fix:** rotate the credential — first, before anything else. Untracking and history rewriting come after, and neither one recalls what was already fetched

**Symptom:** `--assume-unchanged` stopped hiding your local edits, or a merge failed strangely
**Cause:** it is a performance hint, not a suppression flag, and Git may drop or override it
**Fix:** `git update-index --no-assume-unchanged <file>`, then untrack properly. Audit with `git ls-files -v` — lowercase status letters mark the flagged paths

**Symptom:** a file keeps reappearing as untracked after you delete it
**Cause:** a tool regenerates it, and it is not ignored
**Fix:** add it to `.gitignore` — it is untracked, so the rule works immediately. Confirm with `git check-ignore -v`

---

← Prev: [`.gitignore`](05-gitignore.md) · Next → [Phase 1 index](README.md)
