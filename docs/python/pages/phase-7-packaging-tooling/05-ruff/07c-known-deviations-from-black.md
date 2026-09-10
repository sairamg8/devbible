---
title: "Ruff's deviations from Black are deliberate and documented, and the ones that matter most protect meaning rather than taste — end-of-line comments stay next to the code they describe, pragma comments never move off the line they suppress, and width is measured the way a terminal draws it"
sidebar_label: "07c · Known deviations from Black"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Known deviations from Black*, read as raw Markdown at the `0.16.6` tag
> ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/black/), [source](https://github.com/astral-sh/ruff/blob/0.16.6/docs/formatter/black.md)),
> *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)), the settings reference for
> [`line-length`](https://docs.astral.sh/ruff/settings/#line-length) and [`format.nested-string-quote-style`](https://docs.astral.sh/ruff/settings/#format_nested-string-quote-style),
> the rule page for [`line-too-long` (E501)](https://docs.astral.sh/ruff/rules/line-too-long/), and the 0.15.0 [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entry.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Every "Black / Ruff" code pair and quote from the deviations page was taken from one fetch of the raw page at the tag — the page's own examples, not a run.
> Documentation-validated — **no sandbox run, no program output**.

**When `ruff format` and Black disagree, it is rarely an accident. The deviations page lists each
case with an example, and the pattern is worth learning, because it tells you how the formatter
thinks: Black's priority is to fit a statement on one line; ruff's is to never change what a
comment refers to. So ruff expands a statement rather than slide an end-of-line comment away from
its code, ignores `# noqa` and `# type:` comments when measuring width so it never has to move
them, and measures width in terminal columns. The rest of the list is smaller: places ruff chose
the older Black behaviour, places it formats what Black skips, and layouts that depend on which
Python you target — those are [07d](07d-layout-deviations-from-black.md). Knowing the list is how
you read a migration diff — and how you explain why a line is "longer than 88" on purpose.**

## Comments keep their meaning

### Trailing end-of-line comments

> *"Black's priority is to fit an entire statement on a line, even if it contains end-of-line comments."*

```python
# Black
while cond1 and cond2:  # almost always true  # almost never true
    print("Do something")

# Ruff
while (
    cond1  # almost always true
    and cond2  # almost never true
):
    print("Do something")
```

Ruff expands the statement so each comment stays next to the operand it was written about. On
code Black already formatted this rarely fires — the deviations page notes it *"only
impacts unformatted code, in that Ruff's output should not deviate for code that has already been
formatted by Black"* — but on a codebase that never saw Black it is the single largest source of
difference.

### Pragma comments are ignored when computing line width

> *"Pragma comments (`# type`, `# noqa`, `# pyright`, `# pylint`, etc.) are ignored when computing the width of a line. This prevents Ruff from moving pragma comments around, thereby modifying their meaning and behavior"*

```python
# Black
[first(), second()]  # noqa

# Ruff
[
    first(),  # noqa
    second(),
]
```

In Black's output the `# noqa` now covers the whole collapsed line — both calls. In ruff's
output it still covers exactly the element it was written for. Since a `noqa` suppresses one
*physical* line ([06](06-noqa.md)), moving it silently widens or narrows what it suppresses.

The linter agrees with the formatter here: among `E501`'s documented exemptions (see its
[rule page](https://docs.astral.sh/ruff/rules/line-too-long/)) are lines that end with a pragma
comment such as `# type: ignore` or `# noqa`, provided the pragma starts before the limit. A line
whose code fits and whose pragma pushes it past 88 is neither re-wrapped nor reported.

### Trailing own-line comments on imports stay put

> *"Black enforces a single empty line between an import and a trailing own-line comment. Ruff leaves such comments in-place."*

```python
# Black
import os

# comment

import sys

# Ruff
import os
# comment

import sys
```

## Width is measured in columns

> *"Black uses Unicode width for strings, and character width for all other tokens."*

Ruff uses Unicode width for all tokens, including identifiers and comments.

Unicode width is how many terminal columns a character occupies: most CJK characters and many
emoji take two. For the linter, the `line-length` reference says the same: *"The length is
determined by the number of characters per line, except for lines containing East Asian
characters or emojis."* A line of Japanese in a comment can therefore be wrapped by ruff while it
still looks short in a character count, and the formatter and `E501` agree on it.

## Gotchas

**★ Symptom: after switching to ruff, a one-line `while`/`if` condition was exploded into
several lines "for no reason".** Cause: the line had more than one end-of-line comment, and ruff
expands the statement to keep each comment next to its operand where Black would keep the
statement whole. Fix: accept it, or move the commentary to its own line above so the statement
fits again.

```python
# cond1 is almost always true; cond2 is almost never true
while cond1 and cond2:
    print("Do something")
```

**★ Symptom: a line visibly longer than 88 characters survives `ruff format`, and `E501` does not
report it.** Cause: the overflow is a pragma comment. Pragma comments are ignored when computing
width, and `E501` exempts lines ending with one when the code before it fits. Fix: nothing — this
is intended; it keeps `# type: ignore[arg-type]` on the line it silences.

```python
invoice_total = compute_total(line_items, tax_region, currency)  # type: ignore[arg-type]
```

**Symptom: in a Black-formatted codebase a `# noqa` covered two calls; after ruff it only covers
one, and a violation appeared on the other.** Cause: Black had collapsed a multi-line collection
and carried the comment onto the joined line; ruff keeps the original physical lines. Fix:
suppress each line that needs it, with the specific code.

```python
handlers = [
    legacy_handler(),  # noqa: B008
    audited_handler(),  # noqa: B008
]
```

**Symptom: a comment line containing Japanese text was wrapped by ruff although it has fewer than
88 characters.** Cause: ruff measures Unicode width; most CJK characters are two columns wide.
Fix: none needed — the line genuinely exceeds 88 columns on screen. If such lines should not
fail `E501`, raise the linter's limit on its own; `lint.pycodestyle.max-line-length` affects only
the rule, not where the formatter wraps.

```toml
[tool.ruff.lint.pycodestyle]
max-line-length = 100
```

## Interview questions

**★ Why does ruff expand a statement that has trailing comments, when Black keeps it on one
line?**
Because the two formatters optimise for different things. Black's stated priority is to fit an
entire statement on one line even if it carries end-of-line comments, which can leave a comment
far from the code it describes. Ruff instead expands the statement so each comment stays next to
its original operand. The deviation mostly affects code that was never Black-formatted; ruff's
output should not differ on code Black already produced.

**★ Why are pragma comments excluded from the line-width calculation?**
A pragma's meaning is tied to the physical line it sits on — `# noqa` suppresses one physical
line, `# type: ignore` one line of type errors. If the pragma counted towards width, a formatter
would sometimes have to move it to make the line fit, silently changing what it suppresses.
Excluding pragmas means ruff never needs to move them; `E501` has the matching exemption, so the
linter does not report the long line either.

**What is the difference between line width and line length, and why does ruff care?**
Length counts characters; width counts terminal columns, where East Asian characters and many
emoji take two. Black uses Unicode width only for strings; ruff uses it for all tokens, including
identifiers and comments. The effect is that ruff wraps lines by how they actually display, and
the formatter and `E501` agree about which lines are too long.

---

← Prev: [07b · Migrating from Black](07b-migrating-from-black.md) · [Topic index](README.md) · Next → [07d · Layout deviations from Black](07d-layout-deviations-from-black.md)
