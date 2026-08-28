---
title: "Whitespace everywhere except the start of a line means nothing at all, which is why indentation style is a tooling problem and not a language one"
sidebar_label: "1c · Whitespace and tooling"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2.1.8 Indentation](https://docs.python.org/3.14/reference/lexical_analysis.html#indentation)
> and [§2.1.9 Whitespace between tokens](https://docs.python.org/3.14/reference/lexical_analysis.html#whitespace-between-tokens),
> [PEP 8](https://peps.python.org/pep-0008/), the
> [What's New in Python 3.12](https://docs.python.org/3.14/whatsnew/3.12.html)
> note on numeric literals followed by keywords, and CPython 3.14's
> [`Parser/lexer/lexer.c`](https://github.com/python/cpython/blob/3.14/Parser/lexer/lexer.c).
> Ruff rule codes checked against the
> [Ruff rules index](https://docs.astral.sh/ruff/rules/).
> Target: **CPython 3.14**.

**The previous chunk made whitespace sound dangerous. It is dangerous in exactly
one position — the leading whitespace of a logical line — and completely inert
everywhere else. Understanding where that boundary sits is what lets you stop
thinking about the problem: outside of indentation there is no whitespace rule the
interpreter enforces at all, so every remaining decision belongs to PEP 8 and to a
formatter, and the correct amount of human attention to spend on it is zero.**

## Away from the start of a line, whitespace is separation only

> *"Except at the beginning of a logical line or in string literals, the whitespace
> characters space, tab and formfeed can be used interchangeably to separate
> tokens."*

> *"Whitespace is needed between two tokens only if their concatenation could
> otherwise be interpreted as a different token. For example, `ab` is one token,
> but `a b` is two tokens. However, `+a` and `+ a` both produce two tokens, `+` and
> `a`, as `+a` is not a valid token."*

So `x=1`, `x = 1` and a tab-separated version of the same line compile to
identical bytecode.
Nothing in the language distinguishes them. The one place the "could be a different
token" clause bites is where a numeric literal runs straight into a keyword — and
since Python 3.12 that case, while still accepted, is warned about. From the 3.12
release notes:

> *"Currently Python accepts numeric literals immediately followed by keywords, for
> example `0in x`, `1or x`, `0if 1else 2`."*

> *"A syntax warning is raised if the numeric literal is immediately followed by one
> of keywords `and`, `else`, `for`, `if`, `in`, `is` and `or`."*

```python
values = [1, 2, 3]
print(0 in values)     # write this
print(0in values)      # accepted, but raises a SyntaxWarning since 3.12
```

Put spaces around keywords and the rule never comes up. It is worth knowing only
because the warning names a *syntax* problem in code that runs, which is a category
most people do not expect to exist.

## Formfeed, the character nobody types on purpose

> *"A formfeed character may be present at the start of the line; it will be
> ignored for the indentation calculations above. Formfeed characters occurring
> elsewhere in the leading whitespace have an undefined effect (for instance, they
> may reset the space count to zero)."*

CPython's lexer does exactly what the parenthetical warns about: on seeing `\014`
in leading whitespace it sets *both* column counters back to zero, with the source
comment `/* For Emacs users */`. Formfeeds arrive in real files from ancient
tooling and from copy-paste through some terminals; if a file's indentation is
behaving impossibly, `grep -P '\x0c' file.py` is worth one minute of your life.
"Undefined effect" in the reference means *do not rely on this*, not *it is
random* — but a construct the reference declines to define is one you must not put
in a file you expect other implementations to read.

## PEP 8, and the tooling that ends the argument

> *"Use 4 spaces per indentation level."*

> *"Spaces are the preferred indentation method. Tabs should be used solely to
> remain consistent with code that is already indented with tabs."*

> *"Python disallows mixing tabs and spaces for indentation."*

PEP 8 states a preference; CPython states a prohibition; they are different claims,
and only the second one stops your build. Keeping them straight matters when you
read a lint failure: `W191` (tab-indentation) is advice, `TabError` is a compile
failure, and they are not triggered by the same files.

In practice you never argue about this manually — the fix is tooling, applied once
per repository, in three layers so that a contributor without your editor config
still cannot land a violation:

```ini
# .editorconfig — makes every editor agree before the file is saved
root = true

[*.py]
indent_style = space
indent_size = 4
trim_trailing_whitespace = true
insert_final_newline = true
```

```toml
# pyproject.toml — ruff formats and lints the same rule
[tool.ruff]
line-length = 88
indent-width = 4

[tool.ruff.lint]
extend-select = ["W191", "E101"]   # tab-indentation; mixed spaces and tabs
```

```yaml
# .pre-commit-config.yaml — the check that runs whether or not the editor did
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff-format
      - id: ruff
```

Note the line-length choice above. PEP 8 says *"Limit all lines to a maximum of 79
characters"* and *"For flowing long blocks of text with fewer structural
restrictions (docstrings or comments), the line length should be limited to 72
characters"*; the 88 in that config is `ruff format`'s default, inherited from
`black`. Both are defensible, neither is the language's business, and the only
wrong answer is having no single answer per repository.

## Gotchas

### An editor "fixing" indentation on save makes the file worse

**Symptom.** The error moves to a different line each time you save.
**Cause.** An editor configured with a 4-column tabstop is rendering a tab as 4
while CPython counts it as 8, so your visual alignment and the interpreter's
disagree line by line.
**Fix.** Configure the editor to insert spaces, not to render tabs differently.
`.editorconfig` with `indent_style = space` is the version-controlled form of that
setting and is the only one a teammate inherits.

### `git diff -w` hides the cause of the error

**Symptom.** The review shows no meaningful change, but CI fails to compile.
**Cause.** `-w` / `--ignore-all-space` suppresses exactly the difference that broke
the file. The same applies to a review UI's "hide whitespace changes" toggle, which
is often on by default.
**Fix.** Review whitespace explicitly when indentation is the suspect.

```bash
git diff --check                 # flags whitespace errors including tab-in-indent
git config diff.wsErrorHighlight all
```

### Trailing whitespace after a backslash breaks a continuation, invisibly

**Symptom.** `SyntaxError: unexpected character after line continuation character`
on a line that looks perfectly fine.
**Cause.** The backslash must be the *last* character on the physical line. One
trailing space after it and it no longer joins anything. CPython raises this from
the `E_LINECONT` error code; the message text is in `Parser/pegen_errors.c`.
**Fix.** `trim_trailing_whitespace = true` in `.editorconfig`, and prefer bracket
continuation, which has no such failure mode. See
[1d](01d-statements-vs-expressions.md).

### Aligning with tabs aligns nothing

**Symptom.** A comment block or a table of constants lines up in your editor and
nowhere else — a terminal, a code review, a rendered docs page.
**Cause.** A tab is one character whose rendered width depends entirely on the
consumer's tabstop. It is not a width; it is a request.
**Fix.** Align with spaces, or better, do not hand-align at all — a formatter will
undo it on the next run. For runtime output, use format specifiers, which pad to a
known width:

```python
rows = [("alice", 3), ("bartholomew", 11)]
for name, count in rows:
    print(f"{name:<16}{count:>4}")   # deterministic; a \t is not
```

### Adding a formatter to an old repository buries the real history

**Symptom.** `git blame` on every line points at the reformat commit.
**Cause.** The reformat touched every line.
**Fix.** Land the reformat as its own commit that changes nothing else, record it,
and teach git to skip it.

```bash
git log -1 --format=%H > .git-blame-ignore-revs   # the reformat commit
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Interview questions

**Where in a file can you use a tab without any risk of `TabError`?**
Anywhere that is not the leading whitespace of a logical line: between tokens
(where the reference says space, tab and formfeed are interchangeable), inside
string literals (where it is data), inside comments, and on continuation lines
within brackets, whose indentation the reference explicitly calls unimportant.

**What does a formfeed character do to indentation?**
At the very start of a line it is ignored for the indentation calculation. Anywhere
else in the leading whitespace the reference calls the effect undefined and
mentions that it may reset the space count to zero — which is what CPython does,
zeroing both column counters. Treat any formfeed in leading whitespace as a bug in
whatever produced the file.

**Is `x=1` different from `x = 1` to the interpreter?**
Not at all — same tokens, same bytecode. Whitespace between tokens is required only
where its absence would make two tokens fuse into a different single token, which
is in practice a numeric-literal problem: `0in x` is accepted but has raised a
`SyntaxWarning` since Python 3.12, along with a literal followed by `and`, `else`,
`for`, `if`, `is` or `or`. Everything else about spacing is PEP 8 and formatter
territory.

**PEP 8 says 79 characters and your repo uses 88. Is the repo wrong?**
No. PEP 8 is a style guide, not a language rule, and it says so about itself; 88 is
`black`/`ruff format`'s default and is the de facto standard in a large part of the
ecosystem. What matters is that the number is configured once, enforced
automatically, and not re-litigated per pull request.

**Why put the indentation rule in three places — editorconfig, ruff, and
pre-commit?**
Because each covers a different failure. `.editorconfig` prevents the bad character
being typed, `ruff` catches it in the file, and the pre-commit hook (mirrored in
CI) catches the contributor who has neither installed. Any one alone leaks.

---

← Prev: [Tabs, spaces and `TabError`](01b-tabs-spaces-and-taberror.md) · Index: [Syntax and indentation](README.md) · Next → [Statements vs expressions](01d-statements-vs-expressions.md)
