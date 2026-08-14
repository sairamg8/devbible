---
title: "What `add` actually does, and the four ways to select"
sidebar_label: "01 · What add does"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-add` (DESCRIPTION,
> OPTIONS). **Documentation-validated, not sandbox-proven**; the one console
> block is recorded output from `sandbox/git-p0/ex2-object-model.sh`.

**`git add` is not a marker. It reads the file, writes its content into the
object store as a blob, and records that blob's hash in the index. Everything
surprising about staging follows from that one sentence — including the fact that
editing the file afterwards changes nothing about what is staged.**

## The mechanism, in one paragraph

Running `git add file.js` does three things: it hashes the file's content, writes
a blob object into `.git/objects` if one with that hash is not already there, and
writes an index entry pairing the path with that hash. The manual states the
consequence directly:

> It only adds the content of the specified file(s) **at the time the add command
> is run**; if you want subsequent changes included in the next commit, then you
> must run `git add` again to add the new content to the index.

Phase 0 measured the middle step — the blob really is in the object store the
moment you stage, before any commit exists:

```console
$ git ls-files --stage        # the index is a real file with real blobs
100644 ce013625030ba8dba906f756967f9e9ca394464a 0	greeting.txt
100644 d0f87bf2ef282c7a997d8c88e5d2539bbfe562db 0	src/math.js
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §3, kept in
`sandbox/git-p0/ex2-output.txt`.</small>

Two useful things fall out of this immediately.

**Staged work is safer than unstaged work.** The blob exists in the object store
even if no commit ever references it, which is why `git fsck --lost-found` can
recover staged content after an accident and cannot recover content that only ever
lived on disk.

**Staging the same content twice is free.** Content addressing means an identical
file produces an identical hash, so the second `git add` writes no new object. Two
files with the same bytes are one blob, regardless of their names — the filename
lives in the tree, not in the blob.

## The four ways to say which files

| Form | What it covers | Does it stage deletions? |
|---|---|---|
| `git add <path>` | Exactly that path | Yes — staging a deleted path records the deletion |
| `git add <dir>` | That directory as a whole, recursively | **Yes** — including files removed from it |
| `git add -u` | Paths the index **already** has an entry for | Yes. Adds no new files |
| `git add -A` | Everything: new, modified and removed | Yes |

The one that surprises people is the second row, so the manual spells it out: given
`dir`, Git records not just `dir/file1` modified and `dir/file2` added, but also
`dir/file3` **removed** from the working tree.

That behaviour is not old. Older versions of Git ignored removals, which is why
`--no-all` (synonym `--ignore-removal`) still exists — it restores the pre-2.0
behaviour of adding new and modified files while ignoring deletions. Its own
documentation says it is *"primarily to help users who are used to older versions
of Git"*. If you learned Git before 2014 and still believe `git add .` misses
deletions, that belief is now a decade out of date; if you learned after, the
existence of `--no-all` is the archaeology explaining why so much old advice says
`git add -A`.

### `git add .` versus `git add -A`

The difference today is **scope, not behaviour**:

- `git add .` is a pathspec — the current directory and below. Run from
  `src/`, it will not stage a change in `docs/`.
- `git add -A` with **no** pathspec covers the entire working tree, wherever you
  are standing. (Old versions limited it to the current directory; current ones do
  not.)

The same correction applies to `-u`: with no pathspec, it updates **all tracked
files in the entire working tree**, not just your current directory.

So `git add .` from the repository root and `git add -A` are the same thing, and
from a subdirectory they are not. That is the whole distinction, and it is worth
knowing which one your muscle memory types.

### `-u` is the underrated one

`git add -u` updates the index only where it already has an entry. In other words:
**stage all my edits and deletions, and nothing new.** That is exactly the right
verb for the common case of "I have been editing existing files, and there is
build output lying around that I have not got round to ignoring yet."

It is also the safe habit in an unfamiliar repository, where `-A` can quietly
stage a directory of artefacts that nobody thought to add to `.gitignore`.

## What `add` refuses to do

**Ignored files.** `git add` will not stage an ignored file by default, and the
way it declines depends on how you asked:

- name the **exact filename** of an ignored file, and Git **fails** with a list of
  the ignored files;
- match it by a **glob or directory**, and Git **silently skips** it.

That asymmetry is deliberate and helpful. Naming a file exactly is an explicit
request, so Git tells you the request cannot be honoured; sweeping a directory is
not, so Git quietly does the sensible thing. `-f` / `--force` overrides both.

**Embedded repositories.** Adding a directory that contains its own `.git` — a
cloned repository sitting inside yours — makes Git warn, because the result is
neither a submodule nor the files themselves; it is a gitlink to a commit nobody
else can fetch. `--no-warn-embedded-repo` silences the warning, and `git submodule
add` is what you actually wanted. This is the mechanism behind the classic *"I
committed my dependency folder and the files aren't there"*.

**Empty directories.** Git cannot stage one, ever. A tree object lists blobs and
other trees; there is no representation for an empty directory, so there is
nothing to record. The conventional workaround is a placeholder file — commonly
`.gitkeep`, which is a convention with no special meaning to Git whatsoever.

**Paths outside a sparse-checkout cone.** `git add` refuses these, because such
files can be removed from the working tree without warning. `--sparse` overrides
it if you know what you are doing.

## `--dry-run`: ask before you stage

```bash
git add -n .                      # what would be staged?
git add -n --ignore-missing docs/ # would any of these be ignored?
```

`-n` / `--dry-run` shows what would happen without touching the index. Its
companion `--ignore-missing` **only works with `--dry-run`**, and answers a
narrower question: would these paths be ignored — whether or not they currently
exist in the working tree? That is the flag for testing an ignore rule before the
files it concerns have been created.

`-v` / `--verbose` prints each path as it is added, which is worth pairing with
`-A` in a script whose output someone will read later.

## Errors, and choosing not to stop

By default a file that cannot be indexed aborts the whole operation. `--ignore-errors`
continues with the rest — and, importantly, **still exits non-zero**, so a script
using it does not accidentally report success. `add.ignoreErrors` makes it the
default. (`add.ignore-errors` is the deprecated spelling; it does not follow the
usual config naming convention and should not be used in new config.)

## Trade-off

**`git add -A` optimises for never forgetting a file. `git add -p` optimises for
never committing something you did not mean to. They are opposite bets, and most
people should be making the second one more often than they do.**

`-A` is one keystroke and stages everything, which is exactly right when you know
the working tree contains one coherent change and nothing else. Its failure mode is
silent and expensive: a stray `.env`, a debug `console.log`, a 40 MB fixture, a
half-finished refactor of an unrelated file — each gets committed with the same
confidence as the intended change, and the reviewer inherits the problem.

Patch mode costs perhaps thirty seconds per commit and makes the commit
self-describing, because you had to look at every hunk to accept it. The manual is
quietly on this side too: `-p` is documented as giving *"the user a chance to
review the difference before adding modified contents to the index."*

The reasonable settlement is not purity. It is: `-u` or a named path by default,
`-p` whenever the change is bigger than you can hold in your head, `-A` only when
you have just read `git status` and it says what you expect.

## Gotchas

**Symptom:** you edited a file after `git add` and the commit has the old content
**Cause:** `add` recorded the blob hash at the time it ran; later edits are a different blob
**Fix:** `git add` again, then `git commit --amend`. Read `git diff --staged` before committing, every time

**Symptom:** `git add .` from a subdirectory missed changes elsewhere in the repo
**Cause:** `.` is a pathspec — the current directory and below. `-A` with no pathspec covers the whole tree
**Fix:** `git add -A` from anywhere, or `git add .` only from the root. Know which one you type by habit

**Symptom:** `git add` fails with a list of ignored files
**Cause:** you named an ignored file by its exact path, which Git treats as an explicit request it cannot honour
**Fix:** `git check-ignore -v <path>` to see the rule; then either fix the rule or `git add -f` if the file genuinely belongs in the repository

**Symptom:** a directory of files was added but only an odd 160000-mode entry appears
**Cause:** the directory contains its own `.git` — Git recorded a gitlink to a commit, not the files. The warning was printed and scrolled past
**Fix:** remove the embedded repo's `.git`, or convert it properly with `git submodule add`. Do not commit a gitlink nobody can resolve

**Symptom:** an empty directory refuses to be committed
**Cause:** Git has no representation for one; trees list blobs and trees only
**Fix:** put a file in it. `.gitkeep` is a naming convention, not a Git feature — any file works

**Symptom:** deletions are not being staged, on a colleague's machine only
**Cause:** an old habit or an alias using `--no-all` / `--ignore-removal`, which restores pre-2.0 behaviour
**Fix:** drop the flag. Modern `git add <pathspec>` stages removals, and that is the documented behaviour

## Interview questions

**★ What does `git add` actually do to the repository?**
It hashes the file's content, writes it into the object store as a blob (if not
already present), and records the path-to-hash mapping in the index. Staging is a
copy of content, not a flag on a file — which is why editing after `add` leaves
the old version staged.

**★ Difference between `git add .`, `git add -A` and `git add -u`?**
`.` is a pathspec covering the current directory and below. `-A` with no pathspec
covers the entire working tree — new, modified and removed. `-u` covers only paths
already in the index, so it stages edits and deletions but never new files. All
three stage deletions on modern Git.

**★ Does `git add .` stage file deletions?**
Yes, on any Git since 2.0. Older versions ignored removals, and `--no-all` /
`--ignore-removal` still exists to restore that behaviour for people used to it.

**★ Why can't you commit an empty directory?**
Because a tree object lists blobs and subtrees, and there is no entry type for an
empty directory. Git has nothing to record. A placeholder file such as `.gitkeep`
is a convention, not a feature.

**Why does `git add` sometimes fail on an ignored file and sometimes ignore it silently?**
Naming the exact filename is an explicit request, so Git fails and lists the
ignored files. Matching it via a glob or a directory is not explicit, so Git
silently skips it. `-f` overrides both.

**What is `--dry-run` good for, and what does `--ignore-missing` add?**
`-n` shows what would be staged without touching the index. `--ignore-missing`
only works alongside it and answers whether given paths *would* be ignored, even
if they do not yet exist — useful for testing an ignore rule before creating the
files.

**Why is staged content safer than unstaged content?**
Because staging writes a real blob into `.git/objects`. Even with no ref pointing
at it, `git fsck --lost-found` can recover it. Content that was never staged exists
only in the working tree and is gone when the working tree is overwritten.

---

← Prev: [Topic index](README.md) · Next → [Pathspecs, properly](02-pathspecs.md)
