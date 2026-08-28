---
title: "`match`, `case`, `type` and `_` are keywords only where the grammar needs them, and a REPL line is compiled by different rules from the same line in a file"
sidebar_label: "1h · Soft keywords and the REPL"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2.3.1 Keywords](https://docs.python.org/3.14/reference/lexical_analysis.html#keywords)
> and [§2.3.2 Soft keywords](https://docs.python.org/3.14/reference/lexical_analysis.html#soft-keywords),
> [§8.6 The match statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> [`compile()`](https://docs.python.org/3.14/library/functions.html#compile),
> [`sys.displayhook`](https://docs.python.org/3.14/library/sys.html#sys.displayhook),
> and CPython 3.14's
> [`Lib/keyword.py`](https://github.com/python/cpython/blob/3.14/Lib/keyword.py).
> Target: **CPython 3.14**.

**Adding `match` to Python could not reserve the word — too much existing code names
a variable after `re.match`'s result. The answer was a fourth category between
keyword and identifier, resolved by the backtracking PEG parser rather than by the
tokenizer, so the same name can be a statement keyword on one line and a variable on
the next. The REPL has a parallel special case: it compiles in a different mode from
a file, which is why an expression prints, why `_` exists, and why a blank line means
something at the prompt and nothing in a module.**

## Soft keywords: reserved only where the grammar needs them

Python 3.14 has 35 hard keywords — `False`, `None`, `True`, `and`, `as`, `assert`,
`async`, `await`, `break`, `class`, `continue`, `def`, `del`, `elif`, `else`,
`except`, `finally`, `for`, `from`, `global`, `if`, `import`, `in`, `is`, `lambda`,
`nonlocal`, `not`, `or`, `pass`, `raise`, `return`, `try`, `while`, `with`, `yield` —
and four soft ones:

> *"Some names are only reserved under specific contexts. These are known as soft
> keywords: `match`, `case`, and `_`, when used in the `match` statement; `type`,
> when used in the `type` statement. These syntactically act as keywords in their
> specific contexts, but this distinction is done at the parser level, not when
> tokenizing. As soft keywords, their use in the grammar is possible while still
> preserving compatibility with existing code that uses these names as identifier
> names."*

*"At the parser level, not when tokenizing"* is the mechanism. The tokenizer emits a
plain `NAME` token for `match`; the PEG parser, which can backtrack, tries the
`match_stmt` rule and falls back to treating the name as an identifier when the rest
of the line does not fit. A tokenizer alone could not do this — which is why soft
keywords arrived with the PEG parser and not before.

The compatibility this preserves is not hypothetical. `re.match`, `str.match` in
various libraries, `case` as a SQL-ish variable, and `type` as the builtin all
predate the `match` statement by decades:

```python
import re

match = re.match(r"\d+", value)     # still a perfectly ordinary name
if match:
    print(match.group())

type = "premium"                    # legal, and still a bad idea: shadows type()
```

You can ask the interpreter which is which:

```python
import keyword

keyword.kwlist          # the 35 reserved words
keyword.softkwlist      # ['_', 'case', 'match', 'type']
keyword.iskeyword("match")      # False
keyword.issoftkeyword("match")  # True
```

`_` is the subtlest of the four. The compound-statements reference:

> *"`_` is a soft keyword within any pattern, but only within patterns. It is an
> identifier, as usual, even within `match` subject expressions, `guard`s, and
> `case` blocks."*

So `case _:` is the wildcard and binds nothing, while `_` in a guard or in the body
of the case is the ordinary variable — including the one the REPL and gettext both
use.

## The REPL is compiled differently from a file

A module is compiled in `'exec'` mode; the interactive prompt compiles one statement
at a time in `'single'` mode. From `compile()`:

> *"`'exec'` if source consists of a sequence of statements, `'eval'` if it consists
> of a single expression, or `'single'` if it consists of a single interactive
> statement (in the latter case, expression statements that evaluate to something
> other than `None` will be printed)."*

Four practical differences follow:

**Expression statements print.** In `'single'` mode a non-`None` value is passed to
`sys.displayhook`, whose documented behaviour is: *"If value is not None, this
function prints `repr(value)` to `sys.stdout`, and saves value in `builtins._`."*
That is where the REPL's `_` comes from, and it is why `[1, 2].sort()` appears to do
nothing at the prompt while `sorted([2, 1])` prints — one returns `None`.

**A blank line ends a block.** The reference: *"In the standard interactive
interpreter, an entirely blank logical line (that is, one containing not even
whitespace or a comment) terminates a multi-line statement."* In a file the same
blank line is invisible. This is why pasting a function with a blank line in the
middle used to truncate it at the old prompt.

**Trailing newlines are required.** `compile()`: *"When compiling a string with
multi-line code in `'single'` or `'eval'` mode, input must be terminated by at least
one newline character. This is to facilitate detection of incomplete and complete
statements in the `code` module."* Since 3.2, `'exec'` mode has no such requirement —
a `.py` file need not end with a newline.

**One statement at a time.** A REPL session is a sequence of independent
compilations sharing one namespace, not one program. A `SyntaxError` at the prompt
costs you that line; the same error in a file costs you the module.

Where a file is genuinely simpler: it has one encoding declaration, one indentation
stack from column 0 to EOF, and no ambiguity about when a block ends — EOF closes
everything.

## Gotchas

### `match` as a variable name and `match` as a statement in the same file

**Symptom.** Confusing errors after adding a `match` statement to a module that
already used `match` as a name.
**Cause.** Both are legal — the parser decides per occurrence — but a reader cannot.
And `match = ...` on one line followed by `match x:` on another is a genuine
maintenance hazard even though it compiles.
**Fix.** Rename the variable. `m`, `found` or `result` costs nothing.

### Assigning to `type` shadows the builtin for the rest of the scope

**Symptom.** `TypeError: 'str' object is not callable` from a `type(x)` call far from
the assignment.
**Cause.** `type` is a soft keyword, so `type = "premium"` is legal and rebinds the
name in that scope, hiding the builtin.
**Fix.** Do not use builtin names as variables. `ruff`'s `A001`/`A002`
(flake8-builtins) rules catch this class of shadowing automatically.

### `_` at the prompt is not `_` in a file

**Symptom.** A snippet that worked interactively raises `NameError` when saved to a
script.
**Cause.** `builtins._` is set by `sys.displayhook`, which only runs for interactive
expression statements. A script never populates it.
**Fix.** Name the value. And keep in mind that `_` has three other conventional
lives: the throwaway loop variable, the `gettext` translation function, and the
`case _:` wildcard — the last of which binds nothing at all.

## Interview questions

**Why is `match` not a reserved word, when `if` and `for` are?**
Because making it reserved would have broken every program with a variable named
`match` — including `re.match` results, which is one of the most common names in
Python. PEP 634's design instead makes it a *soft* keyword, resolved by the PEG
parser at parse time rather than by the tokenizer: the tokenizer always emits a plain
`NAME`, and the parser tries the `match` statement rule and backtracks if the line
does not fit. `case` and `type` work the same way, and `_` is a soft keyword only
inside patterns.

**Is `_` a keyword?**
Only inside a pattern, where it is the wildcard that matches anything and binds
nothing. The compound-statements reference is explicit that everywhere else —
including in a `match` subject expression, in a guard, and in the body of a `case`
block — it is an ordinary identifier. Outside `match` entirely it is pure convention:
the throwaway name, the `gettext` alias, and the REPL's last-value variable that
`sys.displayhook` sets.

**Where does the REPL's `_` come from, and why is it not in a script?**
From `sys.displayhook`, whose documented behaviour is to print `repr(value)` and save
the value in `builtins._` — and it only runs for an interactive expression statement
whose value is not `None`. A script compiled in `'exec'` mode never calls it, so `_`
is unbound there. Note that `_` has three other conventional lives, none of which are
this one: the throwaway loop variable, `gettext`'s translation alias, and the
`case _:` wildcard.

**How does running a `.py` file differ from typing the same lines into the REPL?**
The file is compiled in `'exec'` mode as one unit; the REPL compiles each statement
in `'single'` mode. In `'single'` mode a non-`None` expression statement is printed
via `sys.displayhook` and stored in `builtins._`; a fully blank line terminates a
multi-line statement; and multi-line input must end with a newline (an `'exec'`-mode
file need not, since 3.2). And a syntax error at the prompt costs one line, whereas
in a file it costs the whole module.

---

← Prev: [Syntax errors and 3.14's messages](01g-syntax-errors-and-messages.md) · Index: [Syntax and indentation](README.md) · Next → [Numbers](../02-numbers/README.md)
