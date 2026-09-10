---
title: "`target-version` is the oldest Python your code must still run on, and ruff uses it for far more than one rule — it decides which `UP` modernisations fire, whether a fix is safe, which syntax counts as an error and even how the formatter lays out an `except` — so a value that is too high ships syntax your production interpreter cannot parse, and a value that is too low silently switches modernisation off"
sidebar_label: "09 · target-version"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — settings reference for [`target-version`](https://docs.astral.sh/ruff/settings/#target-version),
> [`per-file-target-version`](https://docs.astral.sh/ruff/settings/#per-file-target-version) and
> [`lint.pyupgrade.keep-runtime-typing`](https://docs.astral.sh/ruff/settings/#lint_pyupgrade_keep-runtime-typing) (doc comments in `options.rs` at the `0.16.6` tag);
> rule pages for [`non-pep604-annotation-union` (UP007)](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/) and
> [`deprecated-import` (UP035)](https://docs.astral.sh/ruff/rules/deprecated-import/); *Configuring Ruff* default configuration
> ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)); the 0.8.0, 0.12.0, 0.13.0, 0.14.0 and 0.15.0 [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entries;
> `impl Default for PythonVersion` read at the `0.13.0` and `0.16.6` tags. PEP 758 for the `except` syntax.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Most lint rules are version-blind: an unused import is unused on every Python. The ones that
are not are among the most useful ruff has — the `UP` family that rewrites `Optional[Invoice]` as
`Invoice | None` and `typing.List` as `list` — and every one of them needs to know how old an
interpreter the code must still run on. That number is `target-version`. It is a *minimum*, not
the version on your laptop, and ruff reads it in four places: which modernisations to propose,
whether a fix is safe, which syntax to report as too new, and how the formatter prints
version-sensitive constructs. Get it wrong upwards and `ruff check --fix` writes code that raises
`SyntaxError` or `TypeError` on your oldest supported interpreter; get it wrong downwards and the
modernisation rules quietly never fire.**

## What the setting is

> *"The minimum Python version to target, e.g., when considering automatic code upgrades, like rewriting type annotations. Ruff will not propose changes using features that are not available in the given version."*
> — [settings: `target-version`](https://docs.astral.sh/ruff/settings/#target-version)

```toml
[tool.ruff]
target-version = "py312"
```

It is one value, a lower bound. The 0.16.6 CLI accepts `py37` through `py315` for
`--target-version`. When nothing configures it and nothing can be inferred, ruff assumes
**Python 3.10** — the configuration page's default block reads `target-version = "py310"` with
the comment *"Assume Python 3.10"*. That default has moved before: 0.8.0 changelog, *"Default to
Python 3.9"*; the 0.14.0 changelog, *"Update default and latest Python versions for 3.14"*, which
in the source is the step from `PY39` (0.13.0) to `PY310`. A project relying on the default gets
a different target when ruff's default moves.

The settings reference recommends not using it at all when you have a `pyproject.toml`:

> *"If you're already using a `pyproject.toml` file, we recommend `project.requires-python` instead, as it's based on Python packaging standards, and will be respected by other tools."*

> *"If both are specified, `target-version` takes precedence over `requires-python`."*

```toml
[project]
name = "billing"
version = "1.4.0"
requires-python = ">=3.12"      # ruff infers target-version = "py312" from this
```

How ruff finds that `requires-python` — and when it does not — is **09b** *(not written yet)*.

## What it drives

### 1. Which modernisation rules fire

The `UP` rules (pyupgrade) propose newer syntax only when the target has it. From the rule pages:

> *"This rule is enabled when targeting Python 3.10 or later (see: `target-version`)."* — `UP007`, `X | Y` unions

> *"Checks for uses of deprecated imports based on the minimum supported Python version."* — `UP035`

```python
from typing import Dict, List, Optional


def open_invoices(customer_id: int) -> Optional[List[Dict[str, int]]]:
    return None
```

With a 3.12 target, the `UP` rules in the default set propose `list`/`dict` builtins and
`X | None`, and flag the `typing` imports as deprecated. With a `py38` target they propose none
of that, because none of it runs on 3.8. Forty-two `UP` rules are in the 0.16.6 default set, so
this is not an opt-in corner — the default configuration's modernisation depends on this number.

### 2. Whether a fix is safe

> *"This rule's fix is marked as unsafe on Python versions prior to 3.10 because using the PEP-604 syntax may lead to runtime errors in libraries that rely on runtime type annotations, like Pydantic"*
> — [`UP007`](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/)

The same fix is safe or unsafe depending on the target ([05](05-fixes-and-fix-safety.md)). The
pyupgrade plugin also has a setting for exactly the Pydantic/FastAPI case:
`keep-runtime-typing`, which *"is only applicable when the target Python version is below 3.9 and
3.10 respectively, and is most commonly used when working with libraries like Pydantic and
FastAPI"*.

### 3. Which syntax is an error

The 0.12.0 changelog describes the split: *"Ruff will default to the latest supported Python
version (3.13) when checking for the version-related syntax errors … The default in all other
cases, like applying lint rules, is unchanged and remains at the minimum supported Python version
(3.9)."* (That lint default has since become 3.10.) In other words, with **no** target configured, ruff does not complain that a `match`
statement is too new; with one configured, it checks syntax against it. A `match` statement in a
project targeting 3.9, or a PEP 695 `type` alias in one targeting 3.11, is reported as a syntax
error for that target.

### 4. How the formatter prints some constructs

The formatter reads the same target ([07](07-the-formatter-and-black.md), [07d](07d-layout-deviations-from-black.md)):
parentheses around an `except` tuple are removed only for 3.14+ (PEP 758 syntax, and only without
`as`), multiple context managers are parenthesised only for 3.9+, and
`format.nested-string-quote-style` has no effect below 3.12.

## A subset of files with a different floor

> *"This may be useful for overriding the global Python version settings in `target-version` or `requires-python` for a subset of files."*
> — [settings: `per-file-target-version`](https://docs.astral.sh/ruff/settings/#per-file-target-version)

The typical case: the application runs on 3.14, but a deploy script runs on the build host's
system Python, which is older.

```toml
[project]
requires-python = ">=3.14"

[tool.ruff.per-file-target-version]
"scripts/deploy/*.py" = "py39"
```

## Gotchas

**★ Symptom: after `ruff check --fix`, the service fails to import on the production host with a
`TypeError` raised by the `|` operator inside an annotation.** Cause: the configured target (or
`requires-python`) says 3.10+, production runs 3.9, and the `UP` fixes rewrote `Optional[X]` as
`X | None` in annotations evaluated at import time. Fix: the target must be the oldest
interpreter the code actually runs on.

```toml
[project]
requires-python = ">=3.9"
```

**★ Symptom: a library declares `requires-python = ">=3.12"`, but someone also set
`target-version = "py314"`, and users on 3.12 get `SyntaxError` after a release.** Cause: when
both exist, `target-version` wins; ruff's fixes and the formatter's 3.14-only output (bare
`except A, B:` tuples) went into the release. Fix: delete `target-version` and let
`requires-python` drive ruff, so the two cannot disagree.

```toml
[project]
requires-python = ">=3.12"

[tool.ruff]
line-length = 88
```

**★ Symptom: no `UP` rule ever fires on a project that still writes `List[int]` everywhere.**
Cause: the effective target is lower than the code's real floor — typically a stale
`target-version = "py38"` left from years ago — and pyupgrade only proposes what the target
supports (builtin generics such as `list[int]` need 3.9). Fix: set the real minimum, then run the fixes as a reviewed commit.

```bash
uv run ruff check --select UP --fix .
```

**Symptom: a `match` statement is reported as a syntax error, though the code runs fine on the
developer's 3.14 interpreter.** Cause: the project targets a version below 3.10, and ruff checks
syntax against the target when one is configured. Fix: raise the floor if 3.9 is no longer
supported — or keep the floor and rewrite the `match`.

```toml
[project]
requires-python = ">=3.10"
```

**Symptom: after upgrading ruff across 0.14.0, `UP` rules started proposing 3.10 syntax in a
repository with no `requires-python` and no `target-version`.** Cause: the default target moved
from 3.9 to 3.10. Fix: never rely on the default; state the floor.

```toml
[project]
requires-python = ">=3.9"
```

**Symptom: a deployment script that runs on an old system interpreter was modernised by the fixer
and now fails on that host.** Cause: it shares the project's target. Fix: give that subset of
files its own floor with `per-file-target-version`, as shown above.

```toml
[tool.ruff.per-file-target-version]
"scripts/deploy/*.py" = "py39"
```

**Symptom: a Pydantic model breaks at runtime after `--unsafe-fixes` rewrote `Optional[int]` as
`int | None` on a 3.9 target.** Cause: `UP007`'s fix is unsafe below 3.10 precisely because
runtime-annotation libraries evaluate that syntax. Fix: do not apply unsafe fixes wholesale; for
Pydantic or FastAPI code below 3.10, keep runtime typing.

```toml
[tool.ruff.lint.pyupgrade]
keep-runtime-typing = true
```

## Interview questions

**★ What does ruff's `target-version` control?**
More than its name suggests. It decides which pyupgrade (`UP`) modernisations are proposed,
whether some fixes are safe or unsafe (`UP007` is unsafe below 3.10), which syntax is reported as
too new for the target, and parts of the formatter's output — `except` tuple parentheses on 3.14,
parenthesised context managers on 3.9+, nested f-string quotes from 3.12. It is the oldest Python
the code must run on.

**★ Why is `target-version` a minimum rather than the Python you develop on?**
Because every change ruff proposes must run everywhere the code is supported. If a library
supports 3.10 through 3.14 and ruff targeted 3.14, it would introduce 3.14-only syntax that
breaks the 3.10 users. The floor is the only safe reference point; developing on a newer
interpreter hides the problem until the code meets the oldest one.

**Should you set `target-version` or `requires-python`?**
`requires-python`, when there is a `pyproject.toml`: the settings reference recommends it
because it is the packaging standard and other tools (installers, uv, type checkers) respect it,
so one number drives everything. If both are set, `target-version` wins, which is how the two
drift apart — so keep only one.

**What is `per-file-target-version` for?**
Giving a subset of files a different floor from the rest of the project — for example scripts
that run on an older system interpreter, or a compatibility module that must still import on an
old version. It overrides `target-version` or `requires-python` for matching paths only.

**What goes wrong when the target is too high, and when it is too low?**
Too high: fixes and the formatter produce syntax or annotations the oldest supported interpreter
cannot run — a `SyntaxError` or import-time `TypeError` in production. Too low: modernisation
rules never fire and newer syntax may be flagged as errors, so the codebase keeps legacy forms
and developers are blocked from using features they actually have. Only the first breaks
production, which is why a conservative floor is the safer mistake.

---

← Prev: [08b · isort settings and the fix/format loop](08b-isort-settings-and-the-fix-format-loop.md) · [Topic index](README.md)
