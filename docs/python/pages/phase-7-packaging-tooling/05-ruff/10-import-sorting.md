---
title: "Import sorting in ruff is lint rule `I001` with a fix, not part of the formatter — it is in the default rule set since 0.16.0, it follows isort's `profile = \"black\"` closely, and nearly every surprise traces back to one question it answers from the filesystem alone: is this import first-party?"
sidebar_label: "10 · Import sorting"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Sorting imports* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/#sorting-imports)),
> the rule page for [`unsorted-imports` (I001)](https://docs.astral.sh/ruff/rules/unsorted-imports/), the *FAQ* sections on isort and first-party detection
> ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)), *The Ruff Linter: Error suppression* and isort action comments
> ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#error-suppression)), settings reference for [`src`](https://docs.astral.sh/ruff/settings/#src) and
> [`lint.isort.section-order`](https://docs.astral.sh/ruff/settings/#lint_isort_section-order); the *Default Rules* page
> ([docs.astral.sh](https://docs.astral.sh/ruff/default-rules/)); the 0.13.0 [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entry.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**isort was always a separate tool with its own config and its own pre-commit hook; ruff folds it
into the linter as rule `I001`, whose fix rewrites the import block. Three consequences follow.
The formatter does not sort — you run `ruff check --select I --fix` (or just `--fix`, since
`I001` is a default rule from 0.16.0) before `ruff format`. The output is designed to match
isort's Black profile, with a couple of documented differences. And the grouping hinges on
classifying each import as standard library, third-party or first-party, which ruff decides
without importing anything: it looks for the module on disk under your `src` directories. When
imports land in the wrong section, that lookup is almost always why.**

## The rule and the command

> *"De-duplicates, groups, and sorts imports based on the provided `isort` settings."*
> — [`unsorted-imports` (I001)](https://docs.astral.sh/ruff/rules/unsorted-imports/)

`I001` is on the 0.16.6 Default Rules page — the only `I` rule there. Before 0.16.0 the default
set was `E4`, `E7`, `E9` and `F`, so a project with no `select` of its own starts seeing `I001`
the day it upgrades ([03b](03b-the-default-rule-set.md)). A project with its own `select` gets it
only if the list includes `I`.

The formatter does not do this job:

> *"Currently, the Ruff formatter does not sort imports. In order to both sort imports and format, call the Ruff linter and then the formatter:"*

```bash
uv run ruff check --select I --fix .
uv run ruff format .
```

> *"A unified command for both linting and formatting is planned."*
> — [The Ruff Formatter: Sorting imports](https://docs.astral.sh/ruff/formatter/#sorting-imports)

The order matters for the reason [01b](01b-check-and-format-are-two-tools.md) gives: the sort fix
changes lines, and the formatter must see the result.

## What the fix produces

The default `section-order` is `["future", "standard-library", "third-party", "first-party",
"local-folder"]`. Given this block:

```python
from __future__ import annotations
from billing.models import Invoice
import os
import httpx
from .pricing import apply_discount
from typing import TYPE_CHECKING
import sys
```

The fix regroups that block into the five sections in that order, one blank line between
sections, sorted within each: the `__future__` import stays first (Python requires it); `os`, `sys` and `typing` as the
standard library; `httpx` as third-party; `billing` as first-party (if ruff can find it — below);
`.pricing` as local-folder, because relative imports always are:

```python
from __future__ import annotations

import os
import sys
from typing import TYPE_CHECKING

import httpx

from billing.models import Invoice

from .pricing import apply_discount
```

Within a section, isort's default — which ruff follows — puts plain `import x` lines before
`from x import y` lines; `force-sort-within-sections` sorts them together by module name instead
([10b](10b-isort-settings.md)).

## How close to isort it is

> *"Ruff's import sorting is intended to be near-equivalent to isort's when using isort's `profile = "black"`."*
> — [FAQ](https://docs.astral.sh/ruff/faq/)

The FAQ names the differences: ruff groups aliased imports differently — isort splits a
`from numpy import ...` at alias boundaries, ruff keeps names together — and *"Ruff also correctly
classifies some modules as standard-library that aren't recognized by isort, like `_string` and
`idlelib`."* A migration from isort with `profile = "black"` should produce a small diff; a
migration from isort with a custom profile needs its settings translated ([10b](10b-isort-settings.md)).

## First-party: decided on disk

ruff never imports your code to classify it. It asks whether the module exists under one of the
`src` roots:

> *"Ruff accepts a `src` option that ... specifies the directories that Ruff should consider when determining whether an import is first-party."*

> *"For module paths with multiple components like `import foo.bar`, Ruff will require that the full relative path `foo/bar` exists as a directory, or that `foo/bar.py` or `foo/bar.pyi` exist as files."*

The full-path check is recent — the 0.13.0 changelog: *"Full module paths are now used to verify
first-party modules"*. The default `src` covers both common layouts:

> *"When omitted, the `src` directory will typically default to including both: 1. The directory containing the nearest `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file (the "project root"). 2. The `"src"` subdirectory of the project root."*
> — [settings: `src`](https://docs.astral.sh/ruff/settings/#src)

So `billing/` at the root (flat layout) and `src/billing/` (src layout) are both found with no
configuration ([04 · Project layout](../04-project-layout/README.md) covers the layouts).
Anything else — a monorepo with `packages/*/src`, a service in `services/api/app` — must be
listed. `src` accepts globs:

```toml
[tool.ruff]
src = ["packages/*/src", "services/*"]
```

Two traps are documented. A directory that shadows a third-party name:

> *"If there is a directory whose name matches a third-party package, but does not contain Python code, it could happen that the above algorithm incorrectly infers an import to be first-party. To prevent this, you can modify the `known-third-party` setting."*

```toml
[tool.ruff.lint.isort]
known-third-party = ["wandb"]      # a local wandb/ run-output directory is not the package
```

And a configuration that `extend`s another keeps *its own* directory as the project root:

> *"If your `pyproject.toml`, `ruff.toml`, or `.ruff.toml` extends another configuration file, Ruff will still use the directory containing your `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file as the project root (as opposed to the directory of the file pointed to via the `extends` option)."*

```toml
# tests/pyproject.toml — the FAQ's example values
[tool.ruff]
extend = "../pyproject.toml"
src = ["../src"]
```

## Suppressing, splitting and skipping

A `noqa` for `I001` goes on the **first line** of the import block and covers the whole block
([06](06-noqa.md)):

```python
import os  # noqa: I001
import billing.patches
import billing.orm
```

For finer control ruff honours isort's action comments — *"`# isort: skip_file`,
`# isort: on`, `# isort: off`, `# isort: skip`, and `# isort: split`"* — with one difference:
*"Unlike isort, Ruff does not respect action comments within docstrings."* `# isort: split` is the
tool for an import that must run before another, because it ends one block and starts the next:

```python
import billing.patches  # installs the ORM hooks
# isort: split
import billing.orm
import billing.models
```

## Gotchas

**★ Symptom: `ruff format` ran, and the imports are still unsorted.** Cause: the formatter does
not sort imports; sorting is lint rule `I001`'s fix. Fix: run the linter's fix first.

```bash
uv run ruff check --select I --fix . && uv run ruff format .
```

**★ Symptom: the project's own package is sorted into the third-party section.** Cause: ruff
could not find it under any `src` root — the code lives somewhere other than the project root or
its `src/` directory. Fix: list the real source roots.

```toml
[tool.ruff]
src = ["services/billing"]
```

**★ Symptom: after upgrading to ruff 0.16, hundreds of `I001` violations appeared in a project
that never enabled import sorting.** Cause: `I001` joined the default rule set in 0.16.0. Fix:
accept it and run the fix as one mechanical commit — or, if another tool owns import order,
ignore the rule.

```bash
uv run ruff check --select I --fix . && git commit -am "ruff 0.16: sort imports (I001)"
```

**Symptom: `import wandb` is grouped with first-party imports.** Cause: a local directory named
`wandb/` — experiment output with no Python in it — matches the import name, and the filesystem
check treats it as first-party. Fix: declare the package third-party.

```toml
[tool.ruff.lint.isort]
known-third-party = ["wandb"]
```

**Symptom: in the `tests/` configuration that extends the root, the application package is
suddenly third-party.** Cause: an extending configuration keeps its own directory as the project
root, so `src` defaults resolve under `tests/`. Fix: point `src` back at the real source.

```toml
[tool.ruff]
extend = "../pyproject.toml"
src = ["../src"]
```

**Symptom: an import with side effects (monkey-patching, plugin registration) was moved below the
imports that depend on it, and the application breaks at start-up.** Cause: `I001` sorts
alphabetically within a section; it cannot know about import-time side effects. Fix: split the
block so the order is enforced.

```python
import billing.patches
# isort: split
import billing.orm
```

**Symptom: an `# isort: off` placed inside a module docstring has no effect.** Cause: *"Unlike
isort, Ruff does not respect action comments within docstrings."* Fix: put the action comment on
its own line in code.

```python
"""Billing service entry point."""

# isort: off
import billing.patches
import billing.app
# isort: on
```

**Symptom: a `# noqa: I001` on the third import of a block does nothing.** Cause: for import
sorting the `noqa` must be on the first line of the block. Fix: move it.

```python
import os  # noqa: I001
import sys
import billing
```

## Interview questions

**★ Why does `ruff format` not sort imports, and how do you get both?**
Import sorting is implemented as a lint rule, `I001`, whose fix rewrites the import block; the
formatter is a separate tool that only changes layout. The documentation's recommendation is to
run `ruff check --select I --fix` (or `ruff check --fix` with `I001` enabled) and then
`ruff format`. A single combined command is planned but does not exist in 0.16.6.

**★ How does ruff decide that an import is first-party?**
From the filesystem, without importing anything. It checks whether the module's full relative
path exists — as a directory, or as a `.py`/`.pyi` file — under one of the `src` roots, which
default to the project root and its `src` subdirectory. Relative imports are always local-folder.
`known-first-party` and `known-third-party` override the lookup when it gets the answer wrong,
for example when a data directory shares a third-party package's name.

**How close is ruff's import sorting to isort?**
It is designed to be near-equivalent to isort with `profile = "black"`. Documented differences
include how aliased imports are grouped and ruff's more complete standard-library list (it knows
`_string` and `idlelib`). Projects on isort's Black profile see a small diff when migrating;
custom profiles need their settings translated.

**How do you protect an import that must run before others?**
With `# isort: split` between them, which ends one import block and starts another so the sort
cannot move imports across it — or with `# isort: off`/`# isort: on` around the region. A `noqa:
I001` on the first line of the block also works but suppresses sorting of the entire block,
which hides future disorder too.

**What changed for import sorting in ruff 0.16.0?**
`I001` joined the default rule set. Projects that relied on the defaults — no `select` of their
own — started receiving import-order diagnostics and fixes after the upgrade, which usually
means one mechanical "sort imports" commit when adopting 0.16.

---

← Prev: [09b · requires-python inference](09b-requires-python-inference.md) · [Topic index](README.md) · Next → [10b · isort settings](10b-isort-settings.md)
