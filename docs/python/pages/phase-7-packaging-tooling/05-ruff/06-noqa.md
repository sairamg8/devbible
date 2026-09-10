---
title: "`# noqa: CODE` suppresses one rule on one physical line, a bare `# noqa` suppresses every rule on it, and the difference between the two is a single colon — which is why `# noqa E501` silently silences everything, and why the file-level `# ruff: noqa` must sit on a line of its own"
sidebar_label: "06 · noqa comments"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Error suppression* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#error-suppression))
> including the inline and file-level comment specifications, the rule page for [`blanket-noqa` (PGH004)](https://docs.astral.sh/ruff/rules/blanket-noqa/),
> the *Known deviations from Black* page ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/black/)); file-level warning templates read in
> `crates/ruff_linter/src/noqa.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_linter/src/noqa.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**ruff inherited flake8's `noqa` comment and kept its grammar, including its sharpest edge. A
trailing `# noqa: F841` suppresses one rule on one line. A trailing `# noqa` with nothing after
it suppresses *every* rule on that line — and so does `# noqa F841`, because without the colon
the codes are not parsed as codes at all. The file-level form, `# ruff: noqa`, only counts on a
line by itself; written at the end of a code line it is ignored with a warning. Multi-line strings
take the comment after the closing quotes; import blocks take it on the first import. Every one
of these rules is written down in a precise specification, and every one of them has bitten
someone who guessed.**

## Line level

> *"Ruff supports a `noqa` system similar to Flake8. To ignore an individual violation, add `# noqa: {code}` to the end of the line"*
> — [The Ruff Linter: Line-level](https://docs.astral.sh/ruff/linter/#line-level)

```python
# Ignore F841.
x = 1  # noqa: F841

# Ignore E741 and F841.
i = 1  # noqa: E741, F841

# Ignore _all_ violations.
x = 1  # noqa
```

The specification, verbatim, is the part worth memorising:

> *"An inline blanket `noqa` comment is given by a case-insensitive match for `#noqa` with optional whitespace after the `#` symbol, followed by either: the end of the comment, the beginning of a new comment (`#`), or whitespace followed by any character other than `:`."*

> *"An inline `noqa` suppression is given by first finding a case-insensitive match for `#noqa` with optional whitespace after the `#` symbol, optional whitespace after `noqa`, and followed by the symbol `:`. After this we are expected to have a list of rule codes which is given by sequences of uppercase ASCII characters followed by ASCII digits, separated by whitespace or commas. The list ends at the last valid code. We will attempt to interpret rules with a missing delimiter (e.g. `F401F841`), though a warning will be emitted in this case."*

Read the first paragraph against `# noqa E501`: `#noqa`, then *"whitespace followed by any
character other than `:`"*. That is the definition of a **blanket** suppression. The code is
decoration.

| Comment | What ruff reads |
|---|---|
| `# noqa: E501` | suppress `E501` |
| `#noqa:E501,W605` | suppress `E501` and `W605` (whitespace optional) |
| `# NOQA: E501` | suppress `E501` (case-insensitive `noqa`) |
| `# noqa E501` | **suppress everything** — no colon |
| `# noqa` | suppress everything |
| `# noqa: E501 because the URL cannot wrap` | suppress `E501`; the list ends at the last valid code |
| `# noqa: F401F841` | both codes, with a warning about the missing delimiter |

The rule that catches the missing colon is `PGH004` (`blanket-noqa`), and its fix does exactly
this repair: *"given `# noqa F401`, the rule will suggest inserting a colon, as in
`# noqa: F401`."* It is not in the default rule set; select it.

### Multi-line strings and import blocks

> *"For multi-line strings (like docstrings), the `noqa` directive should come at the end of the string (after the closing triple quote), and will apply to the entire string"*

```python
"""Lorem ipsum dolor sit amet.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.
"""  # noqa: E501
```

> *"For import sorting, the `noqa` should come at the end of the first line in the import block, and will apply to all imports in the block"*

```python
import os  # noqa: I001
import abc
```

### A `noqa` suppresses a physical line, not a statement

A trailing `noqa` covers the line it is on. For a diagnostic reported on the first line of a
multi-line statement — a function signature, a long call — the comment has to be on that line.
ruff 0.16 added a comment that covers a whole *logical* line; that is `ruff: ignore`
([06b](06b-ruff-ignore-and-range-suppressions.md)).

The formatter cooperates with this: pragma comments such as `# noqa` *"are ignored when
computing the width of a line. This prevents Ruff from moving pragma comments around, thereby
modifying their meaning and behavior"* — the known-deviations page shows Black collapsing
`[first(),  # noqa` / `second()]` onto one line, which would stretch the suppression over
`second()` too, and ruff refusing to.

## File level

> *"To ignore all violations across an entire file, add the line `# ruff: noqa` anywhere in the file, preferably towards the top"*

> *"To ignore a specific rule across an entire file, add the line `# ruff: noqa: {code}` anywhere in the file, preferably towards the top"*

> *"Global `noqa` comments must be on their own line to disambiguate from comments which ignore violations on a single line."*

> *"Note that Ruff will also respect Flake8's `# flake8: noqa` directive, and will treat it as equivalent to `# ruff: noqa`."*

```python
# ruff: noqa: F841
"""Fixtures module: intentionally assigns values the tests read by name."""
```

The own-line requirement is enforced. The 0.16.6 source warns and skips a file-level directive
found at the end of a code line, with this template: ``Unexpected `# ruff: noqa` directive at
{path}:{line}. File-level suppression comments must appear on their own line. For line-level
suppression, omit the `ruff:` prefix.`` A malformed one gets ``Invalid `# ruff: noqa` directive
at {path}:{line}: {err}``.

## Turning suppressions off

`ruff check --ignore-noqa` — *"Ignore any `# noqa` comments"* — runs as if none existed. It is
the fastest way to measure how much a codebase hides.

```bash
uv run ruff check --ignore-noqa --statistics .
```

## Gotchas

**★ Symptom: a line marked `# noqa E501` hides an undefined-name error on the same line.**
Cause: without the colon the comment is a blanket `noqa` — *"whitespace followed by any character
other than `:`"* — so it suppresses every rule on that line. Fix: add the colon, and select
`PGH004` so the mistake cannot recur.

```python
# `reigon` is a typo: with the colon in place, F821 (undefined name) is reported again
report_url = build_report_url(invoice_id, reigon, "https://billing.example.com/api/v2/reports/overdue")  # noqa: E501
```

```toml
[tool.ruff.lint]
extend-select = ["PGH004"]
```

**★ Symptom: `# ruff: noqa: F401` at the end of an import line does nothing, and ruff prints
"Unexpected `# ruff: noqa` directive".** Cause: file-level directives *"must be on their own
line"*; at the end of a code line ruff skips it with that warning. Fix: choose what you meant —
line-level without the prefix, or file-level on its own line.

```python
import billing_api.signals  # noqa: F401   (this line only)
```

```python
# ruff: noqa: F401
```

**★ Symptom: a `# noqa: E501` inside a long docstring does not suppress the long line.** Cause:
for multi-line strings the directive *"should come at the end of the string (after the closing
triple quote)"*. Fix: move it after the closing quotes.

```python
def export_invoices() -> None:
    """Export every invoice in the legacy fixed-width format described in the vendor spec, section 4.

    The format is documented at length in the spec.
    """  # noqa: E501
```

**Symptom: `# noqa: I001` on the third import in a block does not stop ruff re-sorting the
block.** Cause: an import-sorting suppression belongs *"at the end of the first line in the
import block"*. Fix: move it to the first import.

```python
import sys  # noqa: I001  — the block's order is load-bearing (path set-up)
import local_path_setup
import billing_api
```

**Symptom: a `# noqa` at the end of the last line of a multi-line call does not suppress a
diagnostic reported for the call.** Cause: a `noqa` covers the physical line it is written on,
and the diagnostic is reported against another line of the statement — for a call, the line
where the reported expression starts. Fix: put the comment on the reported line, or use a
logical-line `ruff: ignore` above the statement (0.16.0+).

```python
pairs = zip(  # noqa: B905
    invoice_ids,
    amounts,
)

# ruff: ignore[B905]
pairs = zip(
    invoice_ids,
    amounts,
)
```

**Symptom: after enabling ruff, a file with `# flake8: noqa` at the top is not linted at all.**
Cause: ruff treats it *"as equivalent to `# ruff: noqa`"* — every rule, whole file. Fix: replace
it with the specific codes the file needs.

```python
# ruff: noqa: E501, E402
```

## Interview questions

**★ What is the difference between `# noqa`, `# noqa: E501` and `# noqa E501`?**
`# noqa: E501` suppresses `E501` on that line. `# noqa` suppresses every rule on that line.
`# noqa E501` — no colon — is also a blanket suppression, because ruff's specification defines a
blanket `noqa` as `#noqa` followed by whitespace and anything other than a colon. The missing
colon is the common bug; `PGH004` flags it and its fix inserts the colon.

**★ Why must `# ruff: noqa` be on its own line?**
To keep the file-level and line-level forms unambiguous: a trailing comment at the end of a code
line reads naturally as "this line", so ruff only honours the file-level directive when it is a
line by itself, and warns — ``Unexpected `# ruff: noqa` directive`` — when it is not. The
message even tells you the fix: for line-level suppression, drop the `ruff:` prefix.

**Why prefer a specific `noqa` code to a blanket one?**
A specific code suppresses exactly the diagnostic you reviewed; a blanket `noqa` also suppresses
every future diagnostic on that line, including real bugs introduced later. Specific codes are
also checkable: `RUF100` can tell you when one no longer suppresses anything, while a blanket
comment can only be reported as unused when the line is entirely clean.

**How does ruff's formatter avoid breaking `noqa` comments?**
By not moving them. Pragma comments are ignored when computing line width, and ruff expands a
statement that has trailing end-of-line comments rather than collapsing it, so a `# noqa` stays
on the element it was written for. Black, in the documented example, collapses a list with a
trailing `# noqa` onto one line, which moves the suppression onto everything else in the list.

---

← Prev: [05b · Controlling fixes](05b-controlling-fixes.md) · [Topic index](README.md) · Next → [06b · ruff: ignore and range suppressions](06b-ruff-ignore-and-range-suppressions.md)
