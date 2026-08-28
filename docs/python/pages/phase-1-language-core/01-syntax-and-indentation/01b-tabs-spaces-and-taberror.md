---
title: "Tabs, spaces and TabError: CPython measures every indent twice and refuses the file when the two answers disagree"
sidebar_label: "1b · Tabs, spaces and TabError"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2.1.8 Indentation](https://docs.python.org/3.14/reference/lexical_analysis.html#indentation),
> the [built-in exceptions](https://docs.python.org/3.14/library/exceptions.html)
> reference, [PEP 8](https://peps.python.org/pep-0008/), and CPython 3.14's
> [`Parser/lexer/lexer.c`](https://github.com/python/cpython/blob/3.14/Parser/lexer/lexer.c),
> [`Parser/lexer/state.h`](https://github.com/python/cpython/blob/3.14/Parser/lexer/state.h),
> [`Parser/lexer/state.c`](https://github.com/python/cpython/blob/3.14/Parser/lexer/state.c)
> and [`Parser/pegen_errors.c`](https://github.com/python/cpython/blob/3.14/Parser/pegen_errors.c).
> Target: **CPython 3.14**.

**A `TabError` is not "you used tabs". Tab-indented Python is perfectly legal, and
so is space-indented Python. What is illegal is a file whose block structure would
*change* if a tab were worth a different number of spaces. CPython detects that by
computing every line's indentation twice — once with a tab worth 8 columns, once
with a tab worth 1 — and rejecting the file the moment the two computations
disagree about which block a line belongs to. Because this happens in the
tokenizer, the whole module fails to compile: a `TabError` on line 400 of a file
you import for one constant on line 3 is fatal, and no `try`/`except` around the
import site in the same file can help.**

## The rule as the reference states it

> *"Tabs are replaced (from left to right) by one to eight spaces such that the
> total number of characters up to and including the replacement is a multiple of
> eight (this is intended to be the same rule as used by Unix). The total number of
> spaces preceding the first non-blank character then determines the line's
> indentation. Indentation cannot be split over multiple physical lines using
> backslashes; the whitespace up to the first backslash determines the
> indentation."*

> *"Indentation is rejected as inconsistent if a source file mixes tabs and spaces
> in a way that makes the meaning dependent on the worth of a tab in spaces; a
> `TabError` is raised in that case."*

That second sentence is the whole rule, and it says something narrower than most
people remember. It is not "do not mix tabs and spaces". It is "do not mix them in
a way that makes the meaning depend on tab width". A file can contain both and
still compile, if every comparison comes out the same either way.

## The mechanism: two tab sizes, two stacks

CPython's lexer keeps *two* indentation stacks. `Parser/lexer/state.h` declares
them side by side:

```c
int indstack[MAXINDENT];            /* Stack of indents */
int altindstack[MAXINDENT];         /* Stack of alternate indents */
```

and two tab widths, `#define TABSIZE 8` in `Parser/lexer/state.c` (assigned to
`tok->tabsize`) against `#define ALTTABSIZE 1` in the lexer header. While scanning
leading whitespace it advances both counters, `col` with the real 8-column
tabstop and `altcol` with a 1-column one:

```c
else if (c == '\t') {
    col = (col / tok->tabsize + 1) * tok->tabsize;
    altcol = (altcol / ALTTABSIZE + 1) * ALTTABSIZE;
}
```

Then it makes the *same* three-way decision described in
[the indentation stack section](README.md) on `col`, and after each branch checks
that `altcol` agrees with the alternate stack in the same direction:

- columns equal → `altcol` must also be **equal** to `altindstack[indent]`;
- column greater (an `INDENT`) → `altcol` must also be **strictly greater**;
- column smaller (a `DEDENT`) → `altcol` must also be **equal** after popping.

Any disagreement calls `_PyTokenizer_indenterror`, which sets the `E_TABSPACE`
code. `Parser/pegen_errors.c` maps that code to the exception and message:

```c
case E_TABSPACE:
    errtype = PyExc_TabError;
    msg = "inconsistent use of tabs and spaces in indentation";
    break;
```

So `TabError: inconsistent use of tabs and spaces in indentation` means precisely:
*with tab=8 this line is at one relative position, with tab=1 it is at another, and
therefore the block it belongs to is not determined by the text alone.*

Work the canonical case through the two counters. A function body indented with
one tab, and a nested body indented with eight spaces:

```python
def f(x):
	if x:          # one TAB: col = 8, altcol = 1
        return 1   # eight SPACES: col = 8, altcol = 8
```

Real tab size: both lines land on column 8 — "equal", so no `INDENT` and the
`return` becomes a *sibling* of the `if`, not its body. Alternate tab size: 1
versus 8 — "greater", so the `return` would be the `if`'s body. The two readings
disagree about the program's meaning, which is exactly what the reference says is
rejected, and CPython raises `TabError`.

That is the point worth carrying: the error is not pedantry about whitespace
hygiene. The interpreter has genuinely found two valid readings of your program
and is refusing to guess.

## Why it fires at tokenize time, and what that costs you

An `IndentationError`, `TabError` or plain `SyntaxError` is produced while the
source is being turned into tokens and an AST — before a single bytecode of the
module runs. Three practical consequences:

**One bad line kills the whole module.** There is no partial import. A tab/space
mix inside a function that nothing ever calls, inside a branch that is dead, in a
docstring-only helper at the bottom of the file — all equally fatal, because the
failure precedes execution entirely.

**You cannot catch it in the file that has it.** By the time a `try` would run,
the compile has already failed. You can only catch it from *outside*: the importer,
`compile()`, `exec()`, or a plugin loader.

```python
# Catching it is only possible across a compilation boundary.
import importlib

try:
    mod = importlib.import_module("plugins.legacy_report")
except TabError as exc:
    log.error("plugin %s has inconsistent indentation on line %s",
              exc.filename, exc.lineno)
    mod = None
except SyntaxError as exc:          # TabError is a subclass; order matters
    log.error("plugin failed to compile: %s", exc)
    mod = None
```

**It survives into deployment in exactly one way:** a `.py` file that is never
imported by your test run — a management command, a rarely-hit branch of a plugin
loader, a `conftest`-excluded script. Compile everything you ship rather than
trusting import coverage:

```bash
python -m compileall -q src/          # non-zero exit if any file fails to compile
```

## Python 3 removed the escape hatch

Python 2 had `-t` and `-tt` flags to warn about, then error on, inconsistent tabs;
the default was to guess. Python 3.14's
[command-line reference](https://docs.python.org/3.14/using/cmdline.html) lists no
`-t` or `-tt` option — the behaviour is unconditional, and there is no flag,
environment variable or `__future__` import that restores the old leniency. This
is a deliberate one-way door: the ambiguity is now always fatal.

## Gotchas

### `TabError` in a file you did not touch, after a merge

**Symptom.** A file that compiled yesterday now raises `TabError`, and the diff
shows only one changed line.
**Cause.** Your change added a space-indented line into an otherwise tab-indented
block (or the reverse). The pre-existing tabs were consistent and therefore legal;
your line is the one that made the meaning tab-width-dependent.
**Fix.** Convert the *whole file* in one commit rather than patching the line —
mixed-history files re-break on every subsequent edit.

```bash
# expand tabs to 4-column stops for one file, in place
expandtabs -t4 < mod.py > mod.py.tmp && mv mod.py.tmp mod.py
# or, repo-wide and idempotent:
ruff format src/
```

### A tab inside a bracketed continuation is not an error

**Symptom.** Confusion about why one file with tabs raises and another does not.
**Cause.** Indentation is only computed at the *beginning of a logical line*.
Continuation lines inside `()`, `[]` or `{}` are not the beginning of a logical
line — the reference states *"The indentation of the continuation lines is not
important"* — so no `INDENT`/`DEDENT` comparison happens and no `TabError` can
arise from them.
**Fix.** Nothing to fix in the interpreter's eyes; `ruff`'s `W191` still flags it
if you want consistency.

### A tab inside a string literal is content, not structure

**Symptom.** A search-and-replace of tabs corrupts test fixtures or TSV data.
**Cause.** The reference excludes string literals from the whitespace-equivalence
rule, and a tab inside quotes is simply the character U+0009 in the value.
**Fix.** Never run a blind repo-wide tab replacement. Use a formatter that parses
Python (`ruff format`), which only touches indentation. Write literal tabs in data
as `\t` so they cannot be swept up by a text tool:

```python
HEADER = "id\tname\temail"      # explicit, survives any whitespace cleanup
```

### A fully tab-indented file is legal, and converting it half-way is what breaks it

**Symptom.** "We're migrating off tabs" produces a week of `TabError`s.
**Cause.** Consistency, not tabs, is the requirement. A file entirely indented
with tabs never raises. The transitional state — some blocks converted, some not —
is the only state that fails.
**Fix.** Convert per file, atomically, and gate it so it cannot regress. Do the
whole tree in one commit with `ruff format` and add the pre-commit hook in the
same change.

## Interview questions

**Why is mixing tabs and spaces an error in Python 3, when Python 2 only warned?**
Because the block structure is the indentation, and a tab's width is not a
property of the file — it is a property of whoever renders it. If a file mixes
tabs and spaces such that two different tab widths would put a line in two
different blocks, the source text does not determine the program. Python 2 guessed
(with `-t`/`-tt` to opt into warnings and errors); Python 3 removed the guess and
the flags, and raises `TabError` unconditionally.

**How does CPython actually detect the ambiguity?**
It computes each line's indentation column twice as it scans the leading
whitespace: once with a tab advancing to the next multiple of 8, once with a tab
advancing by 1. It maintains a parallel `altindstack` alongside the real
`indstack`, and after deciding equal/indent/dedent on the real column it requires
the alternate column to support the same conclusion — equal for equal, strictly
greater for an indent, equal for a dedent. Any mismatch is `E_TABSPACE`, which
becomes `TabError: inconsistent use of tabs and spaces in indentation`.

**Is a file indented entirely with tabs valid Python?**
Yes. It violates PEP 8's preference for spaces but nothing in the language. The
error is about ambiguity, not about tabs.

**Can you `try`/`except` a `TabError`?**
Only across a compilation boundary. The error is raised while the source is being
tokenized, before any of that module's code runs, so a handler inside the same
file never executes. You can catch it around `import`, `importlib.import_module`,
`compile()` or `exec()` — which is why plugin loaders and template engines catch
`SyntaxError` (of which `TabError` is a subclass, via `IndentationError`) rather
than assuming the source is good.

**A `TabError` is reported on line 380 of a module you import for one constant on
line 3. Does the constant still import?**
No. Compilation is all-or-nothing per module; there is no partial import and no
lazy per-function parse. This is also why `python -m compileall` on your whole
source tree is a genuinely useful CI step: it catches syntax and indentation
errors in files your tests never import.

---

← Prev: [Syntax and indentation](README.md) · Index: [Syntax and indentation](README.md) · Next → [Whitespace and tooling](01c-whitespace-and-tooling.md)
