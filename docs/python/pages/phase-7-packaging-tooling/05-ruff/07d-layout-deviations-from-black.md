---
title: "The rest of ruff's Black deviations are layout decisions — break the `assert` message not the condition, always parenthesise expanded and single-element tuples, expand call arguments only when forced — plus the places ruff kept an older Black style, formats what Black skips, or lets the target Python version choose the layout"
sidebar_label: "07d · Layout deviations from Black"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Known deviations from Black*, read as raw Markdown at the `0.16.6` tag
> ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/black/), [source](https://github.com/astral-sh/ruff/blob/0.16.6/docs/formatter/black.md)),
> *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)), the settings reference for
> [`format.nested-string-quote-style`](https://docs.astral.sh/ruff/settings/#format_nested-string-quote-style) and
> [`format.preview`](https://docs.astral.sh/ruff/settings/#format_preview), and the 0.9.0 and 0.15.0 entries of the
> [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Every "Black / Ruff" code pair and quote from the deviations page was taken from one fetch of the raw page at the tag — the page's own examples, not a run.
> Documentation-validated — **no sandbox run, no program output**.

**[07c](07c-known-deviations-from-black.md) covered the deviations that protect meaning — comments
and pragmas staying on their lines, width in terminal columns. What remains is layout: where to
break an `assert`, when a tuple gets parentheses, how eagerly to explode a call's arguments. None
of these change what the code does; all of them show up in a migration diff, and a few depend on
the Python version you target, which makes that version an input to the formatter and not only
to the linter.**

## Layout choices

### `assert`: break the message, not the condition

> *"Ruff prefers breaking the message over breaking the assertion, similar to how both Ruff and Black prefer breaking the assignment value over breaking the assignment target."*

```python
# Black
assert (
    len(policy_types) >= priority + num_duplicates
), f"This tests needs at least {priority+num_duplicates} many types."

# Ruff
assert len(policy_types) >= priority + num_duplicates, (
    f"This tests needs at least {priority + num_duplicates} many types."
)
```

The condition — the part a reader scans — stays on the `assert` line. Note the second
difference inside the f-string: ruff formatted the expression `priority + num_duplicates`.

### Tuples: always parenthesised when expanded or single-element

> *"Ruff will always insert parentheses around tuples that expand over multiple lines."*

> *"Ruff always inserts parentheses around single-element tuples, while Black will omit them in some cases."*

```python
# Black
(a, b),

# Ruff
((a, b),)
```

The single-element rule has a practical upside: the stray-trailing-comma bug —
`timeout = 30,` making `timeout` a tuple — is printed as an explicit `(30,)` under an "always"
rule, which is much harder to miss in review than a comma at the end of a line.

### Call chains and context managers

> *"Ruff will only expand the arguments if doing so is necessary to fit within the configured line width"* — Black may expand the last call of a chain more readily.

```python
# Black
).to_csv(
    path / "aaaaaa.csv", index=False
)

# Ruff
).to_csv(path / "aaaaaa.csv", index=False)
```

For `with` statements with several unparenthesised context managers, *"Ruff may collapse the
last context manager onto a single line"* — and the result depends on the target Python. The page
shows the same statement formatted for Python 3.8 (continuations inside the calls) and 3.9+:

```python
# Ruff (Python 3.9+)
with (
    tempfile.TemporaryDirectory(dir=d1) as d2,
    tempfile.TemporaryDirectory(dir=d1) as d4,
    tempfile.TemporaryDirectory(dir=d2) as d3,
    tempfile.NamedTemporaryFile(dir=d4) as source_file,
    tempfile.NamedTemporaryFile(dir=d3) as lock_file,
):
    pass
```

### Where ruff stayed with an older Black

- **Long conditional expressions and annotations.** Black 24+ wraps a long conditional
  expression in parentheses; ruff does not, matching Black 23, *pending exploration of alternative
  formatting approaches*, per the page.
- **Blank lines at the start of a block.** *"Black 24 and newer allows blank lines at the start of
  a block, where Ruff always removes them."* ⚠️ The 0.15.0 changelog's 2026 style adds *"A single
  empty line is now permitted at the beginning of function bodies"*. The two statements are
  scoped differently — "a block" versus "function bodies" — and I could not confirm from the docs
  read how the deviations page's sentence applies to function bodies after 0.15.0. The reading
  consistent with both — unverified — is that one leading blank line in a function body
  survives and blank lines at the start of other blocks (`if`, `for`, `with`) are removed.
- **Parentheses around a single list element.** *"Ruff preserves at least one set of parentheses
  around list elements, even if the list only contains a single element"*; the Black 2025 style
  removes them.

### Where ruff formats what Black leaves alone

- **f-strings.** *"Ruff formats expression parts in f-strings whereas Black does not."*

  ```python
  # Black
  f'test{inner   + "nested_string"} including math {5 ** 3 + 10}'

  # Ruff
  f"test{inner + 'nested_string'} including math {5**3 + 10}"
  ```

  Three changes in one line: the outer quotes normalised to double, the nested literal flipped to
  single quotes so it does not clash, and the expression spacing normalised. The nested-quote
  choice is the `format.nested-string-quote-style` setting (added 0.15.9, default `alternating`),
  which *"has no effect when targeting Python versions below 3.12"* — before 3.12 a nested literal
  could not reuse the outer quote at all.
- **Implicitly concatenated strings** are merged when the whole string fits on one line:

  ```python
  # Black
  raise argparse.ArgumentTypeError(
      f"The value of `--max-history {max_history}` " f"is not a positive integer."
  )

  # Ruff
  raise argparse.ArgumentTypeError(
      f"The value of `--max-history {max_history}` is not a positive integer."
  )
  ```

- **A single multiline-string argument.** *"Unlike Black, Ruff preserves the indentation of a
  single multiline-string argument in a call expression."*
- **Long lambdas.** If the body exceeds the line length, ruff *"will additionally add parentheses
  around the lambda body and break it over multiple lines"*; the 2026 style (0.15.0) also keeps
  lambda parameters on one line.
- **`global` / `nonlocal`** statements with many names are broken with backslash continuations,
  and **parentheses around awaited collections** are removed for consistency with other awaited
  expressions.

The page lists further cases this chunk does not reproduce — own-line comments on expressions,
call-chain assignment values, implicit concatenations in attribute accesses, blank lines between
a function and a decorated class in stub files, and an escaped quote in a triple-quoted
docstring. Read the page itself when a migration diff shows something the list above does not
explain.

### Preview: the fluent layout

Behind `[tool.ruff.format] preview = true` sits a *fluent* layout for method chains, which breaks
before the first attribute access so a long `query.filter(...).order_by(...).limit(...)` chain
reads one call per line. It is a preview style: it may change or be withdrawn between releases,
and a repository that enables it signs up to review a reformat on upgrades
([04](04-preview-mode.md)).

## Gotchas

**Symptom: `items = [(True)]` keeps its redundant parentheses after formatting.** Cause: ruff
deliberately preserves at least one set of parentheses around a list element; the Black 2025
style removes them. Fix: remove them by hand — the formatter will not.

```python
items = [True]
```

**Symptom: enabling `format.preview` rewrote every long pandas/SQLAlchemy method chain, and the
next ruff release rewrote some of them again.** Cause: the fluent layout is preview style, and
preview behaviour may change in any release. Fix: turn preview off for shared codebases, or pin
ruff exactly and accept a reformat commit on each upgrade.

```toml
[tool.ruff.format]
preview = false
```

**★ Symptom: the same `with` statement is formatted with one context manager per line on one
project and with continuations inside the calls on another.** Cause: the layout depends on the
target Python — parenthesised context managers are used for 3.9+ targets only. Fix: make the
target version explicit ([09](09-target-version.md)).

```toml
[project]
requires-python = ">=3.12"
```

**★ Symptom: after formatting, `timeout = 30,` became `timeout = (30,)` and a reviewer asked
why a timeout is a tuple.** Cause: it always was — the trailing comma made a one-element tuple,
and ruff *"always inserts parentheses around single-element tuples"*, which made the bug visible.
Fix: remove the comma; the value was meant to be an `int`.

```python
timeout = 30
```

**Symptom: `nested-string-quote-style = "preferred"` was set and nested f-string literals still
use the opposite quote.** Cause: the setting *"has no effect when targeting Python versions below
3.12"*, and the project's target is 3.11 — before 3.12 an f-string could not contain its own
quote character at all. Fix: none until the project's minimum Python reaches 3.12; then it takes
effect.

```toml
[project]
requires-python = ">=3.12"

[tool.ruff.format]
nested-string-quote-style = "preferred"
```

**Symptom: two string fragments deliberately written as separate literals — a SQL clause per
piece — were merged into one.** Cause: ruff merges implicitly concatenated strings whenever the
whole string fits on one line. Fix: if the split carries meaning, exempt the statement with a
trailing `# fmt: skip`, which suppresses formatting for the statement on that logical line.

```python
query = "SELECT id, total " "FROM invoice "  # fmt: skip
```

## Interview questions

**★ Give two formatter decisions that depend on the target Python version.**
Multiple context managers in a `with` are wrapped in parentheses only for 3.9+ targets; below
that, ruff falls back to continuations inside the calls. The 2026 style removes parentheses
around an `except` tuple only for 3.14+, where the bare form is valid. And the nested f-string
quote style only applies from 3.12, when a nested literal may reuse the outer quote character.
All three mean the target version is part of the formatter's input, not just the linter's.

**How does ruff choose quotes inside an f-string?**
It normalises the outer quotes to the configured `quote-style` and, by default
(`nested-string-quote-style = "alternating"`), uses the other quote character for string literals
nested inside replacement fields — so `f'a{b + "c"}'` becomes `f"a{b + 'c'}"`. The option was
added in 0.15.9 and has no effect below Python 3.12, where reusing the outer quote inside an
f-string is a syntax error anyway.

**Why does ruff break an `assert` message instead of the condition?**
It applies the same rule both formatters use for assignments — break the value, not the target.
In an `assert`, the condition is what a reader scans, so ruff keeps it on the `assert` line and
parenthesises the message on the next line. In the deviations page's example Black breaks the
condition instead; ruff adopted message-breaking in its 2025 style (0.9.0: *"Prefer
parenthesizing the `assert` message over breaking the assertion expression"*).

**Why does ruff always parenthesise single-element and expanded tuples?**
Because in Python it is the comma, not the parentheses, that makes a tuple — so a bare trailing
comma silently changes a value's type, and a tuple spread across lines without enclosing
parentheses is hard to read as one value. Always printing `(x,)` and wrapping expanded tuples
makes the tuple explicit wherever it occurs; Black omits the parentheses in some cases, which is
the documented deviation.

---

← Prev: [07c · Known deviations from Black](07c-known-deviations-from-black.md) · [Topic index](README.md) · Next → [07e · Formatter settings](07e-formatter-settings.md)
