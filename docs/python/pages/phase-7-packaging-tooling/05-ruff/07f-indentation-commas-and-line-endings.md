---
title: "Three formatter switches decide layout for the whole repository — `indent-style` (spaces unless you need tabs for accessibility), `skip-magic-trailing-comma` (leave it off: the trailing comma is how authors ask for a vertical layout), `line-ending` (never `native` on a mixed team) — and the format table's own `exclude` and `preview` scope what the formatter touches"
sidebar_label: "07f · Indentation, commas, line endings"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — the settings reference generated from `options.rs` at the tag —
> [`indent-width`](https://docs.astral.sh/ruff/settings/#indent-width), [`format.indent-style`](https://docs.astral.sh/ruff/settings/#format_indent-style),
> [`format.skip-magic-trailing-comma`](https://docs.astral.sh/ruff/settings/#format_skip-magic-trailing-comma),
> [`format.line-ending`](https://docs.astral.sh/ruff/settings/#format_line-ending), [`format.preview`](https://docs.astral.sh/ruff/settings/#format_preview),
> [`force-exclude`](https://docs.astral.sh/ruff/settings/#force-exclude); *Configuring Ruff: Python file discovery*
> ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/#python-file-discovery)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> The reference lists `native` as a `line-ending` value; its per-platform meaning (`\r\n` on Windows, `\n` elsewhere) is the conventional one and was not quoted from the page.
> Documentation-validated — **no sandbox run, no program output**.

**[07e](07e-formatter-settings.md) mapped the formatter's settings and covered the shared numbers
and the quotes. The remaining switches are about layout and scope. Each has a default that is
right for almost everyone — spaces, honoured trailing commas, the file's own line ending — and
each has a non-default value that is occasionally necessary and frequently a source of
repository-wide churn. The format table's `exclude` and `preview` then decide which files the
formatter touches and which style it prints.**

## `indent-style` and indentation

`space` (default) or `tab`. The reference is unusually opinionated:

> *"We care about accessibility; if you do not need tabs for accessibility, we do not recommend you use them."*

`indent-width` (top-level, default 4) sets the width of one indentation level when indenting with
spaces. Choosing `tab` puts you in conflict with `W191` (`tab-indentation`) and `D206` if either
is selected — **08** *(not written yet)* has the list and the warning `ruff format`
prints.

## `skip-magic-trailing-comma`

> *"Ruff uses existing trailing commas as an indication that short lines should be left separate. If this option is set to `true`, the magic trailing comma is ignored."*

A trailing comma after the last element is an instruction: keep this exploded, one element per
line, even though it would fit on one line.

```python
PAYMENT_METHODS = [
    "card",
    "bank_transfer",
    "direct_debit",
]


def create_invoice(
    customer_id: int,
    amount_cents: int,
):
    return {"customer": customer_id, "amount": amount_cents}
```

With the default (`false`) both stay exactly as written. With `true`, the commas are no longer
instructions and the formatter is free to join both onto single lines. The comma is how a team
keeps diffs to one line per added element in lists that grow; turning the option on across a
repository removes that tool everywhere at once. To collapse *one* construct, delete its trailing
comma and format.

isort has the same idea for imports (`split-on-trailing-comma`, default `true`); setting
`skip-magic-trailing-comma = true` while isort still honours trailing commas is one of the
combinations `ruff format` warns about (**08** *(not written yet)*).

## `line-ending`

| Value | Behaviour |
|---|---|
| `auto` (default) | keep the file's own ending — *"Files with mixed line endings will be converted to the first detected line ending. Defaults to `\n` for files that contain no line endings."* |
| `lf` | always `\n` |
| `cr-lf` | always `\r\n` |
| `native` | the platform's ending — `\r\n` on Windows, `\n` elsewhere |

`auto` is the safe default when git normalises line endings on checkout. `native` is the
dangerous one on a mixed team: the same file is formatted to different bytes on different
operating systems.

## `exclude` and `preview` in the format table

A format-only exclusion keeps a file linted but never reformatted — generated code, vendored
stubs, fixtures whose layout is data:

```toml
[tool.ruff.format]
exclude = ["*.pyi", "src/billing/generated/*.py"]
```

`[tool.ruff.format] preview = true` enables the preview *style* only; top-level `preview` would
also enable preview lint rules ([04](04-preview-mode.md)). Both switches accept the same
command-line override as every other setting — `--preview`, or
`--config "format.quote-style = 'single'"` ([02b](02b-config-overrides-and-inspection.md)).

### An exclusion does not stop a file you name

Exclusions apply to *discovered* files. A path given on the command line is formatted anyway:

> *"Files that are passed to `ruff` directly are always analyzed, regardless of the above criteria, unless `force-exclude` is also enabled (via CLI or settings file)."*
> — [Configuring Ruff: Python file discovery](https://docs.astral.sh/ruff/configuration/#python-file-discovery)

Every tool that passes individual paths — pre-commit, a script over `git diff --name-only`, an
editor — therefore needs `force-exclude`, which the settings reference describes as *"useful for
`pre-commit`, which explicitly passes all changed files to the `ruff-pre-commit` plugin,
regardless of whether they're marked as excluded by Ruff's own settings."* The official hooks
already pass `--force-exclude` on their command line; your own scripts do not.

```toml
[tool.ruff]
force-exclude = true

[tool.ruff.format]
exclude = ["src/billing/generated/*.py"]
```

## Gotchas

**★ Symptom: a three-element list is short enough for one line, but `ruff format` keeps it
exploded.** Cause: the magic trailing comma after the last element tells the formatter to keep
it split. Fix: delete that comma and format again — do not flip the repository-wide switch for
one list.

```python
PAYMENT_METHODS = ["card", "bank_transfer", "direct_debit"]
```

**★ Symptom: every file changes on every commit between a Windows developer and the Linux CI
runner.** Cause: `line-ending = "native"` writes `\r\n` on one machine and `\n` on the other.
Fix: pin the ending and let git agree with it.

```toml
[tool.ruff.format]
line-ending = "lf"
```

```text
# .gitattributes
* text=auto eol=lf
```

**Symptom: after `skip-magic-trailing-comma = true`, hand-exploded lists and signatures all over
the codebase were joined onto one line.** Cause: the setting disables the trailing-comma
instruction everywhere, not just in new code. Fix: revert it if the exploded layouts were
intended — they usually are.

```toml
[tool.ruff.format]
skip-magic-trailing-comma = false
```

**Symptom: after `indent-style = "tab"`, `ruff format` prints a warning and the linter reports
`W191` on every indented line.** Cause: `W191` (`tab-indentation`) forbids exactly the
indentation the formatter now produces. Fix: ignore it — the formatter owns indentation.

```toml
[tool.ruff.lint]
ignore = ["W191"]
```

**★ Symptom: a generated `*_pb2.py` file listed in `[tool.ruff.format] exclude` was reformatted
by a script that runs `ruff format $(git diff --name-only)`.** Cause: paths passed explicitly are
always analysed unless `force-exclude` is on. Fix: enable it once, in the configuration, so
every path-passing caller respects the exclusions.

```toml
[tool.ruff]
force-exclude = true
```

**Symptom: a format-excluded directory still produces lint diagnostics.** Cause: that is what
`[tool.ruff.format] exclude` means — the exclusion is scoped to the formatter. Fix: if the files
should not be linted either, exclude them at the top level (or per-file-ignore specific rules,
[03c](03c-per-file-ignores.md)).

```toml
[tool.ruff]
extend-exclude = ["src/billing/generated"]
```

## Interview questions

**★ What is the magic trailing comma, and why keep it enabled?**
A trailing comma after the last element of a collection, argument list or signature tells the
formatter to keep that construct exploded one element per line, even if it would fit on one
line. It gives authors a way to choose a vertical layout for lists that grow, so each addition
is a one-line diff. `skip-magic-trailing-comma = true` turns that instruction off everywhere.
Keeping it enabled is Black's behaviour and ruff's default.

**What does `line-ending = "auto"` do with a file that mixes `\n` and `\r\n`?**
It converts the file to the first line ending it detects, and uses `\n` for a file that has no
line endings at all. For a mixed team, `lf` (with a matching `.gitattributes`) is more
predictable, and `native` should be avoided because it formats the same file differently per
operating system.

**What is the difference between `[tool.ruff] exclude` and `[tool.ruff.format] exclude`?**
The top-level exclusion removes files from discovery for both the linter and the formatter; the
format-table exclusion removes them from formatting only, so they are still linted. Neither
applies to a path passed explicitly on the command line unless `force-exclude` is enabled — which
is why that setting matters for pre-commit, editor integrations and scripts that pass file lists.

**Why does ruff's documentation discourage tab indentation?**
The reference says so directly: tabs are supported for accessibility, and *"if you do not need
tabs for accessibility, we do not recommend you use them."* Beyond the recommendation, tabs put
the formatter in conflict with lint rules such as `W191` and `D206`, which then have to be
disabled.

---

← Prev: [07e · Formatter settings](07e-formatter-settings.md) · [Topic index](README.md) · Next → [07g · Docstring and Markdown code](07g-docstring-and-markdown-code.md)
