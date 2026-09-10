---
title: "`per-file-ignores` is how a rule set stays strict in application code and sane in tests, migrations and scripts — a glob to rule mapping matched against both the path and the file name, negatable with `!`, relative to the config that declares it, and far better than scattering `noqa` comments"
sidebar_label: "03c · per-file-ignores"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — settings reference for [`lint.per-file-ignores`](https://docs.astral.sh/ruff/settings/#lint_per-file-ignores),
> [`lint.extend-per-file-ignores`](https://docs.astral.sh/ruff/settings/#lint_extend-per-file-ignores), [`exclude`](https://docs.astral.sh/ruff/settings/#exclude)
> and [`lint.exclude`](https://docs.astral.sh/ruff/settings/#lint_exclude); *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/));
> glob matching read in `crates/ruff_linter/src/settings/types.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_linter/src/settings/types.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Most codebases need two rule sets: a strict one for the code that ships, and a looser one for
the code that tests it, migrates it or pokes at it from a script. `assert` is a bug in a
request handler and the whole point of a pytest test; `print` is a stray debug line in a
library and the user interface of a CLI. `per-file-ignores` expresses that difference once, in
configuration, as a mapping from file globs to rule selectors — instead of a `noqa` on every
`assert` in the test suite. Its patterns are matched against both the file's path and its bare
name, they can be negated, and they are relative to the configuration file that declares them,
which is exactly where monorepos trip.**

## The setting

> *"A list of mappings from file pattern to rule codes or prefixes to exclude, when considering any matching files. An initial '!' negates the file pattern."*
> — [settings: `lint.per-file-ignores`](https://docs.astral.sh/ruff/settings/#lint_per-file-ignores)

The settings reference's own example, which covers the three shapes you will write:

```toml
[tool.ruff.lint.per-file-ignores]
# Ignore `E402` (import violations) in all `__init__.py` files, and in `path/to/file.py`.
"__init__.py" = ["E402"]
"path/to/file.py" = ["E402"]
# Ignore `D` rules everywhere except for the `src/` directory.
"!src/**.py" = ["D"]
# Ignore check for packages that are missing an `__init__.py` file.
"{benchmark,scripts,.github/action-name/}/*.py" = ["INP001"]
```

- **A bare file name** (`"__init__.py"`) matches that name in any directory.
- **A path pattern** (`"path/to/file.py"`, `"tests/**/*.py"`) is relative to the project root —
  the directory holding the configuration file.
- **A leading `!`** inverts the match: the rules are ignored in every file the pattern does *not*
  match.

The mechanism behind the first two bullets is visible in the 0.16.6 source: each pattern is
compiled twice, once normalised against the project root and once as written, and a file
matches if either its full path or its base name matches. Brace sets like `{benchmark,scripts}`
come from the `globset` syntax the settings reference points to.

## A realistic service layout

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "B", "UP", "I", "S", "T20", "D"]

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
    "S101",   # assert is how pytest reports failures
    "D",      # test functions do not need docstrings
    "PLR2004" # magic numbers are expected values in tests
]
"src/billing_api/cli.py" = ["T201"]            # print is this module's user interface
"src/billing_api/migrations/*.py" = ["E501", "D"]
"__init__.py" = ["F401"]                         # re-exports; see the F401 note below
"!src/**/*.py" = ["D"]                           # docstrings required only in shipped code
```

Two notes on that example. First, `F401` in `__init__.py` is often better solved at the source
than silenced: the `F401` documentation recommends declaring re-exports explicitly — *"consider
using a "redundant" import alias"* (`from module import member as member`) or `__all__` — which
tells ruff *and* type checkers the import is intentional. Second, `PLR2004` is not in the
default set; listing an ignore for a rule you have not selected is harmless, but it is noise, so
keep ignore lists in step with `select`.

## `extend-per-file-ignores` and inheritance

> *"A list of mappings from file pattern to rule codes or prefixes to exclude, in addition to any rules excluded by `per-file-ignores`."*
> — [settings: `lint.extend-per-file-ignores`](https://docs.astral.sh/ruff/settings/#lint_extend-per-file-ignores)

It exists for the case where a child configuration inherits a parent's `per-file-ignores`
through `extend` ([02](02-configuration-discovery.md)) and wants to add a mapping without
restating the parent's. Setting `per-file-ignores` in the child replaces the inherited mapping —
*"Most settings follow simple override behavior where the child value replaces the parent
value"* — so a child that writes it must repeat everything it still needs.

```toml
# packages/worker/pyproject.toml
[tool.ruff]
extend = "../../pyproject.toml"

[tool.ruff.lint.extend-per-file-ignores]
"src/billing_worker/tasks/legacy_*.py" = ["B904"]   # added on top of the root's mapping
```

Both have command-line equivalents — `--per-file-ignores` and `--extend-per-file-ignores` —
which, like every CLI setting, override the files.

## Ignoring rules vs excluding files

`per-file-ignores` keeps a file in the lint run and switches specific rules off. Excluding a
file removes it from the run entirely. They are different tools:

| You want | Use |
|---|---|
| neither tool to look at generated or vendored code | top-level `extend-exclude` |
| the file formatted but not linted | `[tool.ruff.lint] exclude` |
| the file linted but not formatted | `[tool.ruff.format] exclude` |
| the file linted, minus certain rules | `per-file-ignores` |
| one line exempt | a suppression comment ([06](06-noqa.md)) |

## Gotchas

**★ Symptom: `"tests/*" = ["S101"]` works for `tests/test_api.py` but a colleague insists it
misses `tests/unit/test_invoices.py`.** Cause: whether a single `*` crosses a directory
separator depends on the glob engine's settings, and the documentation does not spell it out for
this setting — so the pattern's reach is not obvious to a reader. Fix: write the recursive form
explicitly; `**` says what you mean to both ruff and the next reviewer.

```toml
[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101"]
```

**★ Symptom: a child configuration adds one `per-file-ignores` entry and the root's test
ignores stop applying in that package.** Cause: setting `per-file-ignores` in a child replaces
the inherited table. Fix: use the `extend-` form in children.

```toml
[tool.ruff.lint.extend-per-file-ignores]
"tests/**/*.py" = ["PLR2004"]
```

**Symptom: per-file ignores declared in the root stop matching after a package gets its own
configuration.** Cause: patterns are relative to the config file that declares them, and a
package with its own configuration does not read the root's at all unless it `extend`s it. Fix:
inherit, or restate the mapping relative to the package's own file.

```toml
# packages/worker/pyproject.toml
[tool.ruff]
extend = "../../pyproject.toml"
```

**Symptom: `"!src/**.py" = ["D"]` seems to do the opposite of what someone intended.** Cause:
`!` negates the *file pattern* — rules are ignored in every file that does **not** match — it
does not re-enable rules inside `src`. Fix: read negated entries as "everywhere except", and
comment them.

```toml
[tool.ruff.lint.per-file-ignores]
"!src/**.py" = ["D"]   # docstrings required in src/, ignored everywhere else
```

**Symptom: a migrations directory is ignored for three rules but keeps producing the fourth, and
the list grows every sprint.** Cause: generated code is being linted rule by rule. Fix: exclude
generated code from linting entirely.

```toml
[tool.ruff.lint]
exclude = ["src/billing_api/migrations/*.py"]   # linted by nobody, still formatted
```

**Symptom: a blanket `"__init__.py" = ["F401"]` hid a genuinely unused import that broke a
refactor.** Cause: the ignore suppresses every unused import in every package init, including
accidental ones. Fix: mark intended re-exports explicitly so the rule can stay on.

```python
# src/billing_api/__init__.py
from billing_api.invoices import Invoice as Invoice   # redundant alias = deliberate re-export
from billing_api.payments import record_payment

__all__ = ["record_payment"]                          # or declare it in __all__
```

## Interview questions

**★ Why prefer `per-file-ignores` over `noqa` comments for tests?**
Because the exemption is a property of the file's role, not of individual lines. A test suite
can have thousands of `assert` statements; a `noqa: S101` on each is noise that hides real
suppressions, and every new test needs it. One mapping — `"tests/**/*.py" = ["S101"]` — states
the policy once, is reviewable in one place, and applies to tests that do not exist yet. Line
comments remain the right tool for the one-off exception inside otherwise strict code.

**What do patterns in `per-file-ignores` match against?**
Both the full path and the file's base name. Each pattern is normalised against the project
root (the directory of the configuration file) and also kept as written, and a file matches if
either form matches — which is why `"__init__.py"` works in every directory and
`"tests/**/*.py"` works from the root. A leading `!` inverts the match. Paths are resolved per
configuration file, so the same pattern means different things in a child config than in the
root.

**What is the difference between `per-file-ignores`, `lint.exclude` and `extend-exclude`?**
`per-file-ignores` keeps the file in the lint run and turns specific rules off for it.
`lint.exclude` removes the file from linting but still lets the formatter process it.
Top-level `exclude`/`extend-exclude` remove the file from both tools. Generated and vendored code
usually belongs in an exclusion; tests, scripts and CLIs usually want per-file ignores.

**Why does `extend-per-file-ignores` exist when `ignore` and `extend-ignore` were merged?**
Because `per-file-ignores` is a mapping, and mappings in a child configuration follow ruff's
simple override rule: a child's value replaces the parent's. `extend-per-file-ignores` is the
additive form for configurations that inherit through `extend` and want to add a pattern without
copying the parent's table. The `ignore` list got special merge behaviour; the per-file mapping
did not.

---

← Prev: [03b · The default rule set](03b-the-default-rule-set.md) · [Topic index](README.md) · Next → [04 · Preview mode](04-preview-mode.md)
