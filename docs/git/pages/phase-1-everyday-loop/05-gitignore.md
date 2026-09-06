---
title: "`.gitignore` — patterns, precedence, and the one hard limit"
sidebar_label: "05 · .gitignore"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man gitignore` (DESCRIPTION's
> precedence list, PATTERN FORMAT, NOTES) and `man git-check-ignore`.
> **Documentation-validated, not sandbox-proven** — no console blocks, because
> no run covers them.

**`.gitignore` decides which *untracked* files Git pretends not to see. It has no
power over anything already tracked, patterns come from four sources with a
defined precedence, and there is exactly one thing it cannot express. Knowing
which of those three you have hit is the whole skill.**

## Four sources, in precedence order

From highest to lowest — and **within one level, the last matching pattern
wins**:

| Precedence | Source | Use it for |
|---|---|---|
| 1 (highest) | Command-line patterns, for commands that accept them | One-off |
| 2 | **`.gitignore` files** in the path's own directory or any parent, up to the working-tree root | Rules everyone on the project needs — this file is committed |
| 3 | **`.git/info/exclude`** | Rules for *this clone only*, that nobody else wants. Not committed |
| 4 (lowest) | The file named by **`core.excludesFile`** | Your personal, every-repository rules |

Two details in that table do a lot of work.

**Nested `.gitignore` files override their parents.** Patterns in a higher-level
file are overridden by those in lower-level files, down to the directory
containing the file. So a `.gitignore` inside `src/generated/` can re-include
something the root file excluded — as long as no *directory* was excluded on the
way, which is the limit described below.

**The global ignore file has a real default.** `core.excludesFile` defaults to
`$XDG_CONFIG_HOME/git/ignore`, falling back to `$HOME/.config/git/ignore` when
`XDG_CONFIG_HOME` is unset or empty. That is where `.DS_Store`, editor swap files
and your own scratch directory belong — **not** in the project's `.gitignore`.
Adding your editor's droppings to a shared file is asking every colleague to
carry your tooling choice.

One subtlety: patterns from sources **outside** the working tree —
`info/exclude` and `core.excludesFile` — are treated as if written at the root of
the working tree, so a leading `/` in them anchors at the repository root.

## The pattern rules that matter

| Rule | Effect |
|---|---|
| `#` at line start | A comment. Escape it as `\#` for a pattern that really starts with `#` |
| Blank line | Matches nothing — a separator for readability |
| Trailing spaces | **Ignored**, unless escaped with a backslash |
| `!` prefix | Negation — re-include a file a previous pattern excluded |
| `/` at the **end** | Match **directories only**. Without it, the pattern matches files and directories alike |
| `/` at the **start or middle** | The pattern is **relative to that `.gitignore`'s own directory** |
| No `/` at all | The pattern may match **at any level below** the `.gitignore` |
| `*` | Anything **except a slash** |
| `?` | Any one character except `/` |
| `[a-z]` | One character from the range |
| `\` | Escapes any character. A trailing backslash is an invalid pattern that never matches |

The slash rules are where most confusion lives, and the manual's own example is
the clearest statement of it:

- **`doc/frotz/`** matches `doc/frotz` but **not** `a/doc/frotz` — the middle
  slash anchors it.
- **`frotz/`** matches `frotz` **and** `a/frotz` — no anchor, so it applies at
  every level.

So `build/` ignores every `build` directory anywhere in the tree, while `/build/`
ignores only the one at the root. Pick deliberately: in a monorepo the difference
is between ignoring twelve build directories and ignoring one.

### The `**` forms

| Pattern | Meaning |
|---|---|
| `**/foo` | `foo` anywhere — identical to plain `foo` |
| `**/foo/bar` | `bar` anywhere that is directly inside a `foo` |
| `abc/**` | Everything inside `abc`, at infinite depth |
| `a/**/b` | `a/b`, `a/x/b`, `a/x/y/b`, … — zero or more directories between |

Other runs of asterisks are just regular asterisks. Note that `**/foo` being the
same as `foo` is worth remembering — a lot of `.gitignore` files are full of
`**/` prefixes that change nothing.

## The one hard limit on negation

This is the rule that costs people an afternoon, and it is stated plainly in the
manual:

> **It is not possible to re-include a file if a parent directory of that file is
> excluded.** Git doesn't list excluded directories for performance reasons, so
> any patterns on contained files have no effect, no matter where they are
> defined.

So this **does not work**:

```gitignore
logs/
!logs/keep.md          # never re-included — logs/ was excluded as a directory
```

Git never descends into `logs/` at all, so it never evaluates a pattern about
what is inside it. The fix is to exclude the *contents* rather than the
directory, leaving Git free to walk in:

```gitignore
logs/*
!logs/keep.md          # works — logs/ itself was never excluded
```

The same shape appears whenever you want "ignore everything except a few things":

```gitignore
/config/*
!/config/default.yml
!/config/schema/
/config/schema/*
!/config/schema/*.json
```

Each level must be re-opened before the next negation inside it can be seen. It
is fiddly, and it is the reason `git check-ignore` exists.

## Finding out *why* a file is ignored

```bash
git check-ignore -v path/to/file
```

`-v` prints the **source file, line number and pattern** that decided the
outcome. With four precedence levels, nested `.gitignore` files and last-match-
wins inside each level, this is the only reliable answer — reading the files
yourself and reasoning about it is how the afternoon gets lost.

Two companions:

```bash
git status --ignored              # list what is being ignored
git add -n --ignore-missing f.txt # would this path be ignored? (works before it exists)
```

That last one is the way to test a new rule against files that do not exist yet.

## What `.gitignore` cannot do

**It does not untrack anything.** The manual's first paragraph: *"Files already
tracked by Git are not affected."* Add `.env` to `.gitignore` after committing it
once, and it keeps being committed forever, because the ignore rules are only
consulted for **untracked** files. That trap is big enough to have its own page —
[topic 06](06-ignoring-does-not-untrack.md).

**It does not hide anything already in history.** A secret committed last month is
still in every clone, whatever you add to `.gitignore` today. Rotating the
credential is the fix; the ignore rule only stops it happening again.

**It does not track empty directories.** Ignoring a directory's contents but
wanting the directory itself to exist requires a committed placeholder file — the
`.gitkeep` convention, which is a convention and nothing more.

## What actually belongs in the project's `.gitignore`

| Category | Examples | Why |
|---|---|---|
| Dependencies | `node_modules/` | Reproducible from the lockfile, and enormous |
| Build output | `dist/`, `build/`, `.next/`, `coverage/` | Derived — regenerating is the point |
| Local environment | `.env`, `.env.local` | Secrets. Commit `.env.example` instead |
| Local databases and caches | `*.sqlite`, `.cache/`, `.turbo/` | Machine-specific |
| Logs and crash dumps | `*.log`, `npm-debug.log*` | Noise, and occasionally leaky |
| OS and editor files | `.DS_Store`, `.idea/`, `*.swp` | **Belongs in your global ignore, not here** |

The last row is the one people get wrong in the other direction. A project's
`.gitignore` is a statement about the project; your editor is not part of the
project.

And the inverse, worth stating: **lockfiles are not ignored.** `package-lock.json`
and `yarn.lock` are committed on purpose — they are the reason a build is
reproducible.

## Trade-off

**Ignore rules are cheap to add and almost never reviewed again, which makes
`.gitignore` a quiet place for real problems to accumulate.**

A broad rule like `*.json` or `config/` is one line and instantly effective. It
also silently stops `git status` from ever mentioning a genuinely new file that
matches — no warning, no output, nothing. New team members hit it as "the file I
created is not showing up in `git status`", and the only route to an answer is
`git check-ignore -v`.

The narrower alternative — `dist/*.json` rather than `*.json` — is more work up
front and costs an occasional update, but it fails loudly instead of silently: an
unexpected file shows up as untracked, which is a thing you can see.

There is also a security-shaped version of the same trade-off. Relying on
`.gitignore` to keep secrets out is relying on a rule that does nothing for
already-tracked files and nothing at all for history. It is a convenience, not a
control. The control is not having the secret in the working tree, or scanning
for it before the commit exists.

## Gotchas

**Symptom:** `!logs/keep.md` does not re-include the file
**Cause:** the parent directory was excluded with `logs/`, and Git never descends into an excluded directory
**Fix:** exclude the contents instead — `logs/*` — then negate. Every level must be re-opened before a negation inside it is seen

**Symptom:** a file is ignored and no `.gitignore` in the project mentions it
**Cause:** the rule is in `.git/info/exclude` or in your global `core.excludesFile`
**Fix:** `git check-ignore -v <path>` names the file, line and pattern. Nothing else is worth trying first

**Symptom:** you added `.env` to `.gitignore` and it is still being committed
**Cause:** it is already tracked, and ignore rules apply only to untracked files
**Fix:** `git rm --cached .env`, commit that — then rotate the credential, because it is still in every clone's history. Full story in topic 06

**Symptom:** `build/` also ignored `packages/api/build/`, which you wanted committed
**Cause:** a pattern with no slash at the start or middle matches at every level below the `.gitignore`
**Fix:** anchor it — `/build/` matches only the root one

**Symptom:** a pattern with a trailing space silently does nothing
**Cause:** trailing spaces are stripped unless escaped with a backslash
**Fix:** remove the space, or escape it deliberately if the filename really ends in one

**Symptom:** a newly created file never appears in `git status`
**Cause:** a broad ignore rule matches it — often `*.json`, `config/` or a `tmp/` added years ago
**Fix:** `git check-ignore -v`, then narrow the rule. `git status --ignored` shows the whole picture

**Symptom:** `git add <ignored-file>` fails with a list of ignored files
**Cause:** naming an ignored file exactly is an explicit request Git will not silently drop
**Fix:** `git add -f` if it genuinely belongs, or fix the rule. See [`git add`](02-git-add/01-what-add-does.md)

## Interview questions

**★ Why does `!logs/keep.md` fail to re-include the file?**
Because a parent directory was excluded. The manual is explicit that it is not
possible to re-include a file if a parent directory of that file is excluded —
Git does not list excluded directories at all, for performance, so patterns about
their contents are never evaluated. The fix is to exclude the *contents* rather
than the directory: `logs/*` followed by `!logs/keep.md`. Every level has to be
re-opened before a negation inside it can be seen, which is why nested
allow-lists get fiddly and why `git check-ignore` exists.

**★ A file is ignored and nothing in the project's `.gitignore` mentions it. Where
do you look?**
Not at the files — at `git check-ignore -v <path>`, which prints the source file,
line number and pattern that decided it. There are four precedence levels
(command-line patterns, `.gitignore` files up the tree, `.git/info/exclude`, and
`core.excludesFile`), nested `.gitignore` files override their parents, and within
one level the *last* matching pattern wins. Reasoning about that by reading is how
an afternoon disappears; the command answers it in one line.

**★ What is the difference between `build/` and `/build/`, and when does it matter?**
A pattern with no slash at its start or middle matches at every level below the
`.gitignore`, so `build/` ignores every `build` directory anywhere in the tree.
A leading slash anchors the pattern to that `.gitignore`'s own directory, so
`/build/` ignores only the one at the root. In a single-package repository the
difference is invisible; in a monorepo it is the difference between ignoring twelve
build directories and ignoring one, and the mistake surfaces as "why is
`packages/api/build/` not being committed?"

**★ Which ignore rules belong in the project's `.gitignore` and which do not?**
The project's file is a statement about the project: dependencies, build output,
local environment files, caches, logs. Your editor's droppings and OS files —
`.DS_Store`, `.idea/`, `*.swp` — belong in your global ignore file, which
`core.excludesFile` points at and which defaults to `$XDG_CONFIG_HOME/git/ignore`,
falling back to `$HOME/.config/git/ignore`. Putting them in the shared file asks
every colleague to carry your tooling choice. Rules that are specific to one clone
but not to you personally go in `.git/info/exclude`, which is not committed.

**Is `.gitignore` a reasonable way to keep secrets out of a repository?**
It is a convenience, not a control. It does nothing for a file that is already
tracked — ignore rules are consulted only for untracked paths — and nothing at all
for history, so a credential committed last month is in every clone whatever you
add today. It also fails silently: a broad rule stops `git status` from ever
mentioning a genuinely new file, with no warning. The actual controls are not
having the secret in the working tree, scanning before the commit exists, and
rotating anything that did get committed.

---

← Prev: [`git diff`](04-git-diff.md) · Next → [Ignoring does not untrack](06-ignoring-does-not-untrack.md)
