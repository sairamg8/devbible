---
title: "`ruff check` and `ruff format` share a binary and a config file and very little else — separate commands, separate config tables, separate exclusions, separate preview switches and different exit codes, and the formatter still does not sort your imports"
sidebar_label: "01b · check and format are two tools"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/)),
> *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)), *Configuring Ruff*
> ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)), *Preview* ([docs.astral.sh](https://docs.astral.sh/ruff/preview/)),
> *Integrations* ([docs.astral.sh](https://docs.astral.sh/ruff/integrations/)) and the *FAQ*
> ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)); CLI help as published for 0.16.6.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**It is easy to talk about "running ruff" as if it were one thing. It is two. `ruff check` is a
linter: it reports rule violations and, with `--fix`, rewrites code to remove some of them.
`ruff format` is a formatter: it reprints every file in one canonical layout and has no notion
of a violation at all. They ship in one binary and read one configuration file, but each reads
its own table in that file, honours its own exclusions, has its own preview switch, and exits
with different codes for what looks like the same situation. The formatter does not sort
imports and the linter does not reformat, so a project that wants both runs both — in a
specific order, for a reason.**

## Two entry points, two jobs

> *"`ruff check` is the primary entrypoint to the Ruff linter. It accepts a list of files or directories, and lints all discovered Python files, optionally fixing any fixable errors."*
> — [The Ruff Linter](https://docs.astral.sh/ruff/linter/)

> *"Similar to Black, running `ruff format /path/to/file.py` will format the given file or directory in-place, while `ruff format --check /path/to/file.py` will avoid writing any formatted files back, and instead exit with a non-zero status code upon detecting any unformatted files."*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

They are independent by design:

> *"Nope! Ruff's linter and formatter can be used independently of one another -- you can use Ruff as a formatter, but not a linter, or vice versa."*
> — [FAQ: Do I have to use Ruff's linter and formatter together?](https://docs.astral.sh/ruff/faq/)

| | `ruff check` | `ruff format` |
|---|---|---|
| Job | report rule violations; `--fix` rewrites some | reprint every file canonically |
| Config table | `[tool.ruff.lint]` | `[tool.ruff.format]` |
| Per-tool exclusion | `lint.exclude` | `format.exclude` |
| Preview switch | `lint.preview` | `format.preview` |
| "Don't write, just tell me" | no flag needed — it reports by default; `--diff` previews fixes | `--check` (or `--diff`) |
| Exit 1 means | violations remain | only with `--check` / `--diff` / `--exit-non-zero-on-format` |
| Sorts imports | yes — rule `I001` with `--fix` | **no** |

## One file, three tables

The top level of `[tool.ruff]` is shared: both tools read `line-length`, `indent-width`,
`target-version`, `exclude`, `extend-exclude`, `src`, and the top-level `preview`. Everything
lint-specific lives under `lint`, everything formatter-specific under `format`:

```toml
[tool.ruff]                      # shared by both tools
line-length = 100
target-version = "py312"
extend-exclude = ["migrations"]  # neither tool touches these

[tool.ruff.lint]                 # ruff check only
extend-select = ["B", "SIM"]
preview = false

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101"]

[tool.ruff.format]               # ruff format only
quote-style = "double"
exclude = ["src/invoice_service/_generated/*.py"]   # lint it, but never reformat it
```

Scoped exclusion is documented for exactly this purpose:

> *"Files can also be selectively excluded from linting or formatting by scoping the `exclude` setting to the tool-specific configuration tables. For example, the following would prevent `ruff` from formatting `.pyi` files, but would continue to include them in linting"*
> — [Configuring Ruff](https://docs.astral.sh/ruff/configuration/)

Preview is split the same way:

> *"Preview mode can be configured separately for linting and formatting."*
> — [Preview](https://docs.astral.sh/ruff/preview/)

## The formatter does not sort imports

> *"Currently, the Ruff formatter does not sort imports. In order to both sort imports and format, call the Ruff linter and then the formatter:"*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

```bash
ruff check --select I --fix
ruff format
```

Import sorting is lint rule `I001` with an automatic fix. Since **0.16.0** `I001` is in ruff's
default rule set ([03b](03b-the-default-rule-set.md)), so on a project with no `select` of its
own a plain `ruff check --fix` already sorts imports; the `--select I` form above is how you
sort *only* imports. A single command that lints and formats is on the roadmap — the formatter
page links it as *"planned"* (issue #8232) — but it is not in 0.16.6.

## The order is check-then-format, and the reason is fixes

A fix is an edit, and an edit can leave code that is no longer formatted — a `SIM` fix that
merges two nested `if` statements, or a `UP` fix that rewrites `Optional[Invoice]` as
`Invoice | None`, changes the length of a line the formatter had already wrapped. The
documentation states the consequence for hook order, and the same logic applies to any script:

> *"When running with `--fix`, Ruff's lint hook should be placed before Ruff's formatter hook, and before Black, isort, and other formatting tools, as Ruff's fix behavior can output code changes that require reformatting."*
> — [Integrations: pre-commit](https://docs.astral.sh/ruff/integrations/)

> *"(As long as your Ruff configuration avoids any linter-formatter incompatibilities, `ruff format` should never introduce new lint errors, so it's safe to run Ruff's format hook after `ruff check --fix`.)"*

The parenthetical is load-bearing. It holds only if you avoid the rules that fight the
formatter — **08** *(not written yet)* has the list.

A local "fix everything" script, in the right order:

```bash
#!/usr/bin/env bash
set -euo pipefail
uv run ruff check --fix .   # 1. lint fixes, including import sorting (I001)
uv run ruff format .        # 2. reprint what the fixes left behind
uv run ruff check .         # 3. report what no fix could solve
```

## Exit codes are not symmetrical

`ruff check` exits `1` when violations remain, `0` when none were found *"or if all present
violations were fixed automatically"*. `ruff format` exits `0` *"regardless of whether any files
were formatted"* — only `--check`, `--diff`, or `--exit-non-zero-on-format` make reformatting a
failure. The full table and the CI consequences are in **11** *(not written yet)*.

## Gotchas

**★ Symptom: `ruff format` ran and the imports are still in the wrong order.** Cause: the
formatter never sorts imports; ordering is lint rule `I001`. Fix: run the linter's import fix
first, then format.

```bash
uv run ruff check --select I --fix . && uv run ruff format .
```

**★ Symptom: the CI step "ruff format" is always green, even on a branch with badly formatted
files.** Cause: without `--check`, `ruff format` reformats the CI runner's copy in place and
exits `0` *"regardless of whether any files were formatted."* The job passed and threw the
result away. Fix: check, do not format, in CI.

```bash
uv run ruff format --check .
```

**★ Symptom: CI fails on `ruff format --check` right after a developer ran `ruff check --fix`
and pushed.** Cause: the fix edited code and nobody reformatted afterwards — *"Ruff's fix
behavior can output code changes that require reformatting."* Fix: always format after fixing,
never before.

```bash
uv run ruff check --fix . && uv run ruff format .
```

**Symptom: formatting a file makes `ruff check` report a new violation.** Cause: an enabled
lint rule contradicts the formatter — `COM812` and the `Q` quote rules are the usual ones — or
`E501` is enabled and the formatter's wrapping is *"best-effort"*. Fix: drop the conflicting
rules (**08** *(not written yet)*).

```toml
[tool.ruff.lint]
ignore = ["COM812", "Q000"]
```

**Symptom: a generated module is excluded from formatting but still produces hundreds of lint
violations (or the reverse).** Cause: the exclusion was scoped to one tool — `format.exclude`
or `lint.exclude` — so the other tool still sees the file. Fix: exclude it at the top level when
neither tool should touch it.

```toml
[tool.ruff]
extend-exclude = ["src/invoice_service/_generated"]
```

**Symptom: turning on preview to try one new lint rule also changed how `ruff format` lays out
method chains.** Cause: `preview = true` in the top-level `[tool.ruff]` table applies to both
tools, and the formatter's preview style (the fluent method-chain layout, for one) came with it.
Fix: scope preview to the tool you meant ([04](04-preview-mode.md)).

```toml
[tool.ruff.lint]
preview = true      # unstable rules and fixes only; the formatter stays on the stable style
```

**Symptom: after dropping isort from the toolchain, imports are no longer sorted on a project
that has its own `select`.** Cause: that `select` replaces ruff's default set, so `I001` is off
unless it is listed. Fix: select it explicitly.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "I"]
```

## Interview questions

**★ Why does `ruff format` not sort imports, and how do you get both?**
The documentation states the fact — *"Currently, the Ruff formatter does not sort imports"* — not
the rationale. What the design gives you is control: sorting is lint rule `I001`, a fix you opt
into through rule selection, configure through `lint.isort`, and suppress per import block with a
`noqa`, which matters because reordering imports reorders module-level side effects and a
formatter that did it unconditionally could change behaviour. To get both you run
`ruff check --select I --fix` (or just `ruff check --fix` when `I001` is selected, as it is by
default since 0.16.0) and then `ruff format`. A combined command is planned but not shipped in
0.16.6.

**★ In what order do you run `ruff check --fix` and `ruff format`, and why that order?**
Fix first, format second. Fixes are edits and can leave code the formatter would lay out
differently — the docs say ruff's fix behaviour *"can output code changes that require
reformatting."* Formatting afterwards makes the result canonical. The reverse order is safe only
if you also re-run the formatter at the end, which is the same thing done twice. The guarantee
that formatting never introduces new lint errors holds only when the configuration avoids the
lint rules that conflict with the formatter.

**Can you use ruff only as a formatter and keep another linter, or the reverse?**
Yes. The FAQ says the two can be used independently. A project migrating gradually often adopts
`ruff format` in place of Black first, because it is intended to be near-identical, and swaps
the linter later; or keeps flake8 because a plugin it depends on has no ruff equivalent. The only
constraint is the usual one for any linter-plus-formatter pairing: keep `line-length` consistent
and avoid lint rules that fight the formatter.

**What does `ruff format` exit with after reformatting ten files, and why does that matter?**
`0`. Reformatting is success for the formatter, not failure — it exits non-zero only for invalid
configuration or an internal error, unless you ask for `--check`, `--diff` or
`--exit-non-zero-on-format`. In CI that means `ruff format` without `--check` can never fail a
build on formatting, which is the most common reason a "format" job is green on unformatted
code.

**Which settings are shared between the linter and the formatter?**
The top-level ones in `[tool.ruff]`: `line-length` (the formatter's wrap target and the linter's
`E501` threshold unless `lint.pycodestyle.max-line-length` overrides it), `indent-width`,
`target-version`, file selection (`exclude`, `extend-exclude`, `include`), `src`, and the
top-level `preview`. Rule selection, fixability and plugin settings are `lint.*`; quote style,
indent style, line endings and docstring code formatting are `format.*`.

---

← Prev: [01 · What ruff replaces](01-what-ruff-replaces.md) · [Topic index](README.md) · Next → [02 · Configuration discovery](02-configuration-discovery.md)
