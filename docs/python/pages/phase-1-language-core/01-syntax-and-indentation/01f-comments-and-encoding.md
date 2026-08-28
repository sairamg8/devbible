---
title: "Comments vanish before the parser runs and take their whole line with them, and source is UTF-8 unless the first two lines say otherwise"
sidebar_label: "1f · Comments and encoding"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2 Lexical analysis](https://docs.python.org/3.14/reference/lexical_analysis.html)
> (comments, blank lines, encoding declarations),
> [PEP 8](https://peps.python.org/pep-0008/),
> [PEP 263](https://peps.python.org/pep-0263/), and CPython 3.14's
> [`Parser/lexer/lexer.c`](https://github.com/python/cpython/blob/3.14/Parser/lexer/lexer.c).
> Target: **CPython 3.14**.

**A comment is not "text the compiler skips" — it *ends the logical line*, unless
brackets are open, and a line that is nothing but a comment produces no token at all
and therefore takes no part in the indentation stack. That second fact is why a
column-0 comment inside a nested function closes nothing. The encoding declaration is
the other edge case that lives on these lines: in Python 3 it is dead weight you
should delete, except in the one file where a byte-order mark makes it load-bearing
and a mismatch is a compile error rather than a mojibake bug.**

## Comments, and the lines that produce no token at all

> *"A comment starts with a hash character (`#`) that is not part of a string
> literal, and ends at the end of the physical line. A comment signifies the end of
> the logical line unless the implicit line joining rules are invoked. Comments are
> ignored by the syntax."*

Two clauses in that sentence do work. *"Not part of a string literal"* means there
is no way to comment out something inside a string — `"a # b"` contains a hash.
*"Signifies the end of the logical line unless the implicit line joining rules are
invoked"* means a comment inside brackets does **not** end the statement, which is
precisely the property that makes bracket continuation usable:

```python
handlers = [
    parse_header,     # runs first
    # validate_body,  <- disabled for now
    write_result,
]
```

Lines with nothing but whitespace and a comment are removed from the structure
entirely:

> *"A logical line that contains only spaces, tabs, formfeeds and possibly a
> comment, is ignored (i.e., no `NEWLINE` token is generated)."*

This is why **the indentation of a comment is irrelevant to the block structure.** A
comment at column 0 in the middle of a deeply nested function closes nothing;
CPython's lexer sets a `blankline` flag on such a line and skips the entire indent
comparison. The `tokenize` module still reports these line breaks, as `NL` rather
than `NEWLINE`.

```python
def handler(event):
    if event.kind == "ping":
# this comment at column 0 closes nothing and is legal
        return "pong"
    return None
```

Legal, and unreadable — which is why linters flag it: `ruff` implements pycodestyle's
`E114` (indentation-with-invalid-multiple-comment) and `E116`
(unexpected-indentation-comment), both preview rules at the time of writing, so you
must opt in. The compiler never will.

At module level, blank lines are pure formatting, governed by PEP 8: *"Surround
top-level function and class definitions with two blank lines"* and *"Method
definitions inside a class are surrounded by a single blank line."* The one place a
blank line changes behaviour is the REPL, below.

## The encoding declaration, and why you no longer write one

> *"If a comment in the first or second line of the Python script matches the
> regular expression `coding[=:]\s*([-\w.]+)`, this comment is processed as an
> encoding declaration; the first group of this expression names the encoding of the
> source code file. The encoding declaration must appear on a line of its own. If it
> is the second line, the first line must also be a comment-only line."*

> *"If no encoding declaration is found, the default encoding is UTF-8. If the
> implicit or explicit encoding of a file is UTF-8, an initial UTF-8 byte-order mark
> (`b'\xef\xbb\xbf'`) is ignored rather than being a syntax error."*

That default is the whole story for modern code. `# -*- coding: utf-8 -*-` at the
top of a Python 3 file is a no-op inherited from Python 2, where the default was
ASCII and a non-ASCII byte in a string literal was a compile error. Delete it; if
you must keep it for a shared Python 2 file, know that it is documentation and
nothing more.

The rules that still matter:

- **First or second line only.** On the second line, the first must be a
  comment-only line — which is exactly the shebang case.
- **It must be alone on its line.** PEP 263: *"There must not be any Python
  statement on the line that contains the encoding declaration."*
- **A BOM constrains it.** PEP 263: if a UTF-8 BOM is present, *"the only allowed
  encoding for the comment is 'utf-8'"*. A file saved by a Windows editor as
  "UTF-8 with BOM" plus a `# coding: latin-1` line is a compile error, not a
  mojibake bug.
- **An unknown encoding name fails at compile time**, like any other lexical error.

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-      <- line 2, alone, after a comment-only line 1: valid
```

The reference notes the two recommended spellings — the Emacs `# -*- coding:
<encoding-name> -*-` form and the Vim `# vim:fileencoding=<encoding-name>` form.
Both merely have to match that regex.

One correction to a claim you will find repeated from PEP 263: the PEP says *"Python
identifiers are restricted to the ASCII subset of the encoding"*, which was true of
Python 2. Python 3 permits non-ASCII identifiers. What has not changed is that
keywords are ASCII, and that using non-ASCII identifiers is a portability and
review-legibility problem rather than a syntax one.

## Gotchas

### `# -*- coding: utf-8 -*-` on the wrong line does nothing, silently

**Symptom.** A file with a docstring first and the coding comment after it behaves
as though the declaration is absent.
**Cause.** The declaration is only honoured on line 1 or line 2, and on line 2 only
if line 1 is a comment-only line. A module docstring on line 1 disqualifies it.
**Fix.** Put it first, or (better, in Python 3) delete it and rely on the UTF-8
default. Nothing warns you about a misplaced one.

### A BOM plus a non-UTF-8 declaration is a compile error

**Symptom.** A file that opens fine in the editor refuses to import after being
saved on Windows.
**Cause.** PEP 263: with a UTF-8 BOM present, *"the only allowed encoding for the
comment is 'utf-8'"*. The BOM and the declaration disagree.
**Fix.** Save without a BOM, and remove the declaration.

```bash
grep -rlP '^\xef\xbb\xbf' --include='*.py' src/     # find BOM-prefixed files
```

### A `#` inside a string is not a comment, and a `#` inside an f-string field is a syntax error

**Symptom.** A URL fragment or a colour literal appears to truncate a line, or an
f-string will not compile.
**Cause.** The reference excludes hashes in string literals from comment scanning —
so `"#fff"` is fine. Inside an f-string *replacement field*, however, you are back in
expression territory.
**Fix.** Keep comments out of replacement fields.

```python
colour = "#ff8800"                   # a colour, not a comment
url = "https://example.com/#top"     # a fragment, not a comment
```

## Interview questions

**Does the indentation of a comment matter?**
Not to the compiler. A line containing only whitespace and a comment generates no
`NEWLINE` and takes part in no indentation comparison, so a comment at column 0
inside a nested block neither closes the block nor errors. It matters a great deal to
readers and to linters, which is why `ruff` flags it anyway.

**Where can a blank line change the meaning of Python code?**
In the standard interactive interpreter, where an entirely blank logical line
terminates a multi-line statement. In a `.py` file it cannot: blank lines are ignored
by the tokenizer, and their only significance is stylistic — PEP 8's two blank lines
around top-level definitions, one around methods.

**Should you still write `# -*- coding: utf-8 -*-`?**
No. Since Python 3 the default source encoding is UTF-8, and the reference says so
directly. The line is a Python 2 relic. It is not harmful, but it is noise, and a
misplaced one (after a docstring, or not alone on its line) is silently ignored,
which makes it worse than nothing when someone believes it is doing work.

---

← Prev: [Line joining and semicolons](01e-line-joining-and-semicolons.md) · Index: [Syntax and indentation](README.md) · Next → [Syntax errors and 3.14's messages](01g-syntax-errors-and-messages.md)
