---
title: "Pathspecs, properly"
sidebar_label: "02 · Pathspecs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man gitglossary`, the *pathspec*
> entry, and `man git-add` (`--pathspec-from-file`, `--pathspec-file-nul`, `--`).
> **Documentation-validated, not sandbox-proven.**

**A pathspec is not a filename and it is not quite a shell glob. It is a small
pattern language shared by `add`, `diff`, `checkout`, `grep`, `log`, `restore`
and most other Git commands — so learning it once pays off across the whole tool,
and misunderstanding it produces "why did that match?" everywhere at once.**

## The three rules of the plain form

The glossary gives the syntax as three rules:

1. **Any path matches itself.**
2. **The pathspec up to the last slash is a directory prefix**, and the scope of
   the pathspec is limited to that subtree.
3. **The rest is a pattern** matched against the remainder of the pathname using
   `fnmatch(3)` — and, crucially, **`*` and `?` can match directory separators**.

That third point is the one that catches people. `Documentation/*.jpg` matches
`Documentation/chapter_1/figure_1.jpg`, because `*` is happy to cross a `/`. In a
shell glob it would not. Git's default pathspec matching is deliberately more
sweeping than the shell's, and if you want the shell's behaviour you have to ask
for it — that is what `:(glob)` below is for.

## Quote your globs

```bash
git add '*.js'     # Git expands the pattern
git add *.js       # the SHELL expands it, and Git never sees a pattern
```

These are different commands. Unquoted, the shell expands `*.js` against the
*current directory only*, and hands Git a list of literal filenames — so files in
subdirectories are silently missed, and a directory with no matching files
produces a "no such file" error from the shell rather than from Git.

Quoted, Git receives the pattern and applies pathspec rules to the whole tree
under the prefix. When a Git command with a glob behaves differently in a
subdirectory than at the root, unquoted globbing is nearly always the reason.

## Magic signatures

A pathspec beginning with `:` carries **magic** — modifiers that change how the
rest is interpreted. There are two spellings:

- **Short form:** `:` followed by magic signature symbols, optionally terminated
  by another `:` — `:!docs/`, `:/src`, `:^build/`.
- **Long form:** `:` followed by a parenthesised, comma-separated list of magic
  words — `:(exclude)docs/`, `:(top,icase)README*`.

The long form is the one to write in anything anybody else will read. The short
form is what you will find in other people's commands and need to recognise.

| Magic word | Short | What it does |
|---|---|---|
| `top` | `/` | Match from the **root of the working tree**, even when run inside a subdirectory |
| `literal` | — | Wildcards such as `*` and `?` are literal characters. The escape hatch for a filename that contains a glob character |
| `icase` | — | Case-insensitive match |
| `glob` | — | Treat the pattern as a shell glob with `FNM_PATHNAME`: **wildcards no longer match `/`**. Incompatible with `literal` |
| `attr` | — | Require gitattributes conditions, e.g. `:(attr:text)` — in addition to normal pattern matching |
| `exclude` | `!` or `^` | Remove matching paths from the result set |

A pathspec that is **only** a colon means "there is no pathspec", and the glossary
warns it should not be combined with other pathspecs.

### `:(exclude)` — the one worth learning today

Exclusion runs as a second pass: after a path matches any non-exclude pathspec, it
is run through all the exclude pathspecs, and a match removes it. If there is *no*
non-exclude pathspec, the exclusions are applied as if the command had been
invoked with no pathspec at all — which is why this works:

```bash
git add -A ':(exclude)*.log'          # everything except logs
git add -A ':!vendor/' ':!*.snap'     # short form, two exclusions
```

This is the flag that makes a large `git add -A` safe to type. It is also
available in `git diff`, `git log` and `git grep`, where excluding a generated
file from a review diff is the difference between reading the change and scrolling
past it.

### `:(glob)` versus the default

```bash
git add ':(glob)src/*.ts'       # only directly inside src/
git add 'src/*.ts'              # src/**/*.ts as well — * crosses /
```

Under `:(glob)`, `**` gains its familiar meanings: a leading `**/` matches in all
directories, a trailing `/**` matches everything inside, and `/**/` matches zero
or more directories. Other consecutive asterisks are invalid. Without `:(glob)`,
plain `*` already crosses directories, so `**` is rarely needed and often a sign
that the author expected shell semantics.

### `:(top)` — the one that fixes subdirectory confusion

```bash
cd src/components
git add ':(top)package.json'    # the repository's package.json, not src/components/
```

Without it, a relative pathspec resolves against your current directory. `:(top)`
(or its short form `:/`) anchors to the working tree root. This is the correct fix
for a shell alias or script that must behave identically wherever it is invoked
from — better than `cd`-ing to the root first, because it does not disturb the
rest of the command.

## `--` separates options from paths

```bash
git add -- -f            # stage a file literally named "-f"
git add -- "$path"       # $path can start with a dash and nothing breaks
```

Everything after `--` is a path, never an option. In a script that interpolates a
variable into a Git command, `--` is not optional politeness; it is the difference
between staging a file and silently enabling a flag someone chose as a filename.

## Pathspecs from a file

```bash
git add --pathspec-from-file=paths.txt
git ls-files -z -- '*.ts' | git add --pathspec-from-file=- --pathspec-file-nul
```

`--pathspec-from-file=<file>` reads the pathspecs from a file, or from standard
input when the file is `-`. Elements are separated by LF or CRLF, and may be
quoted as described for `core.quotePath`.

`--pathspec-file-nul` switches the separator to NUL and takes **all other
characters literally**, including newlines and quotes. It only has meaning
alongside `--pathspec-from-file`.

Together those two are how you stage a list produced by another command without
ever worrying about what is in the filenames — the same argument as `-z` in
[`git status`'s porcelain formats](../01-git-status/03-porcelain-for-scripts.md),
and for the same reason. Anything shorter is a bug waiting for a filename with a
space in it.

## Trade-off

**Pathspec magic is powerful, shared across commands, and almost invisible in a
code review.**

`git add -A ':!*.log'` is a genuinely good command: precise, portable across Git
versions, and it does the same thing in every command that takes a pathspec. But
`:!` in a shell script reads like line noise, `!` is history expansion in an
interactive bash session unless quoted, and a colleague who has not met the syntax
cannot guess it.

The mitigation is cheap and worth adopting as a rule: **use the long form in
anything durable** — `:(exclude)*.log` in a script, an alias or a documented
command — and reserve the short form for what you type once. The long form is
self-describing, and the person who has to change your script in a year does not
need to have read `gitglossary`.

The deeper trade-off is that pathspecs and `.gitignore` patterns are *different
languages that look identical*. `.gitignore` uses `FNM_PATHNAME`-style matching
where `*` does not cross `/`; a pathspec's `*` does, unless you say `:(glob)`. Two
patterns that look the same can match different sets of files depending on which
one you are writing. That is a real design wart, and knowing it exists is most of
the defence.

## Gotchas

**Symptom:** `git add '*.js'` matched files in subdirectories and you expected only the current one
**Cause:** in a plain pathspec `*` matches directory separators — that is documented `fnmatch(3)` behaviour without `FNM_PATHNAME`
**Fix:** `git add ':(glob)*.js'` for shell-glob semantics, where `*` stops at `/`

**Symptom:** the same Git command behaves differently in a subdirectory
**Cause:** either an unquoted glob (expanded by the shell against the current directory) or a relative pathspec resolving against the current directory
**Fix:** quote the pattern, and use `:(top)` / `:/` when the pathspec must anchor to the repository root

**Symptom:** `git add ':!build'` fails in an interactive bash session with an event-not-found error
**Cause:** `!` triggers history expansion when unquoted or inside double quotes
**Fix:** use single quotes, or write the long form `':(exclude)build'`

**Symptom:** a script staged the wrong thing when a filename began with a dash
**Cause:** Git parsed the filename as an option
**Fix:** put `--` before the paths, always, in anything scripted

**Symptom:** a `.gitignore` pattern and a pathspec that look identical match different files
**Cause:** they are different languages — ignore patterns use `FNM_PATHNAME` semantics, plain pathspecs do not
**Fix:** test with `git add -n` and `git check-ignore -v`; do not assume a pattern transfers between the two

## Interview questions

**★ Does `*` in a Git pathspec match a `/`?**
Yes, by default — the glossary says `*` and `?` can match directory separators, so
`Documentation/*.jpg` matches `Documentation/chapter_1/figure_1.jpg`. Use
`:(glob)` for `FNM_PATHNAME` semantics where wildcards stop at `/`.

**★ Why quote a glob passed to `git add`?**
Unquoted, the shell expands it against the current directory and Git receives a
list of literal filenames — so subdirectories are missed. Quoted, Git receives the
pattern and applies pathspec matching across the subtree.

**★ How do you stage everything except one directory?**
`git add -A ':(exclude)vendor/'`, or the short form `':!vendor/'`. Exclusion is a
second pass over the matched set, and with no non-exclude pathspec it applies as if
the command had been given none.

**★ What does `:(top)` do?**
Anchors the pattern to the root of the working tree, regardless of the current
directory. Its short form is `:/`. It is the right fix for a script or alias that
must behave the same wherever it runs.

**When would you use `--pathspec-from-file`?**
When the list of paths comes from another command or is too long for a command
line. With `--pathspec-file-nul` the separator becomes NUL and everything else is
literal, which is the only safe way to handle filenames containing spaces, quotes
or newlines.

**What is `--` for, and why does it matter in scripts?**
It separates options from paths. Without it, a path that begins with a dash is
parsed as an option — so an interpolated variable can silently turn into a flag.

**Name a pathspec magic word other than `exclude` and say when you would use it.**
`icase` for case-insensitive matching on a case-sensitive filesystem, `literal`
for a filename that genuinely contains `*` or `?`, or `attr` to restrict a
command to paths carrying a particular gitattribute.

---

← Prev: [What `add` does](01-what-add-does.md) · Next → [Patch mode](03-patch-mode.md)
