---
title: "Every run of a console script — --help, a typo, a shell completion — first imports the module the entry point names and everything that module imports at top level, so a CLI's start-up time is its import graph: measure it with -X importtime, keep __init__.py and the CLI module thin, import each subcommand's dependencies inside the subcommand, and guard the result with a test"
sidebar_label: "11 · The import-time cost of a CLI"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [command line → `-X importtime`, `PYTHONPROFILEIMPORTTIME`](https://docs.python.org/3.14/using/cmdline.html), [What's New in 3.14 → deferred annotations](https://docs.python.org/3.14/whatsnew/3.14.html), [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html) — [PEP 810](https://peps.python.org/pep-0810/) (Final, Python 3.15), and the wrapper templates of pip **26.2.1** and uv **0.12.12** ([01](01-what-the-installer-writes.md)).
> Target: **Python 3.14.7** · uv 0.12.12 · ruff 0.16.6 · pre-commit 4.6.2. Documentation-validated — **no timings were taken for this page; every number quoted is the cited source's own claim**.

**The wrapper's second line of real work is `from invoice_service.cli import main` ([01](01-what-the-installer-writes.md)). Before `main` runs, Python imports the `invoice_service` package — executing its `__init__.py` — then the `cli` module, then every module either of them imports at top level, recursively. That happens on every invocation: `invoice --help`, a mistyped flag that `argparse` rejects in a millisecond, a shell-completion call on every Tab. A CLI that imports pandas, an HTTP client, an ORM and every plugin at module level makes each of those pay for all of it. PEP 810 describes the pattern bluntly — *"even running the command with `--help` can load dozens of unnecessary modules and take several seconds"* — and its fix, explicit lazy imports, arrives in Python 3.15, not 3.14. On 3.14 the work is manual, measurable and testable.**

## What the wrapper makes you pay for

For a command `invoice = "invoice_service.cli:main"`, the import chain on every run is:

1. `invoice_service/__init__.py` — runs for *any* import of *any* `invoice_service.*` module.
2. `invoice_service/cli.py` — the module the entry point names.
3. Every top-level `import` in both, and in whatever those import.

Only then does `main()` parse `sys.argv`. PEP 810 describes why this is worse for command-line tools than for anything else:

> *"A major drawback with this approach is that importing the first module for an execution of Python (the "main" module) often triggers an immediate cascade of imports, and optimistically loads many dependencies that may never be used. The effect is especially costly for command-line tools with multiple subcommands, where even running the command with `--help` can load dozens of unnecessary modules and take several seconds."*

> *"Command-line tools are often invoked directly by a user, so latency – in particular startup latency – is quite noticeable. These programs are also typically short-lived processes (contrasted with, e.g., a web server)."*
> — both [PEP 810](https://peps.python.org/pep-0810/)

The installers already care about this at the scale of one module: pip's template exists to avoid importing `re` — *"allowing scripts to load faster"* — and uv removed `import re` from its template in 0.5.19 for the same reason ([01](01-what-the-installer-writes.md)). Your own imports are usually a great deal heavier than `re`.

## Measuring it

> *"`-X importtime` to show how long each import takes. It shows module name, cumulative time (including nested imports) and self time (excluding nested imports). Note that its output may be broken in multi-threaded application. Typical usage is `python -X importtime -c 'import asyncio'`."*

> *"`-X importtime=2` enables additional output that indicates when an imported module has already been loaded."* — *"Changed in version 3.14: Added `-X importtime=2`"*
> — [command line](https://docs.python.org/3.14/using/cmdline.html)

The environment variable form measures the real command, wrapper and all — *"If this environment variable is set to `1`, Python will show how long each import takes … This is equivalent to setting the `-X` `importtime` option."*:

```bash
# the CLI module's import graph, in the project environment
uv run python -X importtime -c "import invoice_service.cli" 2> import-times.log

# the installed command exactly as users run it
PYTHONPROFILEIMPORTTIME=1 .venv/bin/invoice --help 2> import-times.log
```

The report goes to standard error, one line per module; sort by the cumulative column to find the subtrees worth deferring. No figures are reproduced here — they depend entirely on the machine and the dependency set, which is the point of measuring your own.

## Making it cheap

### Keep `__init__.py` thin

Every `invoice_service.*` import, including the CLI module, runs the package's `__init__.py` first. A convenience re-export there is paid by every command:

```python
# src/invoice_service/__init__.py — before: the whole domain layer on every `invoice --help`
from invoice_service.db import Session          # imports the ORM
from invoice_service.export import to_xlsx      # imports the spreadsheet library
```

```python
# src/invoice_service/__init__.py — after: metadata only
__all__ = ["__version__"]
__version__ = "1.4.0"
```

### Import each subcommand's dependencies inside the subcommand

```python
# src/invoice_service/cli.py
import argparse
from collections.abc import Sequence


def _issue(args: argparse.Namespace) -> int:
    from invoice_service.issue import issue_invoice     # ORM, templates: only for `issue`
    issue_invoice(args.customer)
    return 0


def _export(args: argparse.Namespace) -> int:
    from invoice_service.export import export_all       # spreadsheet library: only for `export`
    export_all(args.format, args.output)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="invoice")
    sub = parser.add_subparsers(dest="command", required=True)

    issue = sub.add_parser("issue", help="issue one invoice")
    issue.add_argument("--customer", required=True)
    issue.set_defaults(handler=_issue)

    export = sub.add_parser("export", help="export invoices")
    export.add_argument("--format", default="csv")
    export.add_argument("--output", default="-")
    export.set_defaults(handler=_export)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.handler(args)
```

`invoice --help` and `invoice issue --bad-flag` now import `argparse` and nothing else from your project. PEP 810 names the weakness of this style honestly — inline imports *"can be subverted by a single inadvertent top-level import"* — which is why the guard test below matters more than the refactor.

### Keep type-only imports out of run time

Python 3.14 no longer evaluates annotations eagerly — *"annotations are stored in special-purpose annotate functions and evaluated only when necessary"* ([What's New 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)). So on 3.14 an import needed only for annotations can live under `TYPE_CHECKING` without quoting the annotation — though a project whose `requires-python` is `>=3.12`, like this one, still needs the quotes:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas


def summarise(frame: "pandas.DataFrame") -> int:   # quotes keep it valid on 3.12 and 3.13 too
    return len(frame)
```

If `requires-python` admits anything before 3.14, the annotation must still be quoted or the module needs `from __future__ import annotations`, because older versions evaluate it at definition time.

### Discover plugins lazily, and only when asked

`importlib.metadata.entry_points()` reads every installed distribution's `entry_points.txt` on each call, and `load()` imports the plugin ([05](05-reading-entry-points-at-runtime.md)). Neither belongs at module level in the CLI. Call `entry_points()` in the subcommands that use plugins, and `load()` only the plugin the arguments selected ([06](06-plugin-discovery-patterns.md)).

### Python 3.15: explicit lazy imports

PEP 810 is *Final* for Python 3.15 and adds syntax that defers a module's loading until first use, which the PEP expects to *"reduce startup time by 50-70% in practice"* — its claim, for its measured cases. It is not available in 3.14.7; the manual techniques above are what this track's target supports.

## Guard it with a test

Timing tests are noisy. Asserting *which modules were imported* is not:

```python
# tests/test_import_budget.py
import json
import subprocess
import sys

HEAVY = {"sqlalchemy", "openpyxl", "httpx", "pandas"}

IMPORT_ONLY = """
import json, sys
import invoice_service.cli
print(json.dumps(sorted(sys.modules)))
"""

HELP_RUN = """
import contextlib, io, json, sys
import invoice_service.cli as cli
with contextlib.redirect_stdout(io.StringIO()):
    try:
        cli.main(["--help"])
    except SystemExit:
        pass
print(json.dumps(sorted(sys.modules)))
"""


def top_level_modules(code: str) -> set[str]:
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
    return {name.split(".")[0] for name in json.loads(out.stdout)}


def test_cli_import_stays_light():
    assert not (top_level_modules(IMPORT_ONLY) & HEAVY)


def test_help_stays_light():
    assert not (top_level_modules(HELP_RUN) & HEAVY)
```

A fresh interpreter per check keeps modules imported by other tests out of the result.

## Gotchas

**★ Symptom: `invoice --help` takes seconds.** Cause: the entry point's module imports every subcommand's dependencies at top level, and the wrapper imports that module before `main` can print help. Fix: measure, then move each subcommand's imports into its handler.

```bash
uv run python -X importtime -c "import invoice_service.cli" 2> import-times.log
```

**★ Symptom: the CLI module is lean, yet start-up is still slow.** Cause: `invoice_service/__init__.py` re-exports heavy submodules, and it runs before *any* `invoice_service.*` import. Fix: empty the package `__init__.py` of convenience imports.

```python
__all__ = ["__version__"]
__version__ = "1.4.0"
```

**★ Symptom: start-up got slower with every plugin a user installed.** Cause: the CLI calls `load()` on every entry point in its group at import time. Fix: iterate names eagerly if you need them for help, load only the selected plugin.

```python
def _export(args):
    from invoice_service.exporters.registry import load
    return load(args.format).export(fetch_invoices(), args.output)
```

**★ Symptom: a refactor that made the CLI fast is quietly undone months later.** Cause: one new top-level import in any module on the chain restores the cascade — PEP 810's *"single inadvertent top-level import"*. Fix: the module-budget test above, run in CI.

**Symptom: moving an import under `TYPE_CHECKING` raises `NameError` at import time on 3.12 but not on 3.14.** Cause: 3.14 defers annotation evaluation; earlier versions evaluate an unquoted annotation when the function is defined. Fix: quote the annotation, or add `from __future__ import annotations`, while `requires-python` admits pre-3.14 versions.

```python
from __future__ import annotations
```

**Symptom: shell completion lags on every Tab.** Cause: completion runs the command, which imports the full graph before answering. Fix: the same lazy-import structure; completion should reach `argparse` and stop.

**Symptom: `-X importtime` output interleaves nonsensically.** Cause: the documentation warns *"its output may be broken in multi-threaded application"*. Fix: measure an import of the CLI module rather than a run that starts threads.

```bash
uv run python -X importtime -c "import invoice_service.cli" 2> import-times.log
```

## Interview questions

**★ Why is start-up time a bigger problem for a CLI than for a web service?**
Because a CLI pays it on every invocation and a person is waiting each time. The wrapper imports the entry point's module — and its whole top-level import graph — before `main` runs, including for `--help`, argument errors and shell completion. A web service pays the same import cost once per process and then serves for hours. PEP 810 makes the same distinction: command-line tools are *"short-lived processes"* where *"startup latency … is quite noticeable"*.

**★ How do you find out what a CLI imports at start-up, and how do you keep it from regressing?**
`python -X importtime -c "import pkg.cli"`, or `PYTHONPROFILEIMPORTTIME=1` on the real command, prints every import with self and cumulative time; sorting by cumulative time shows the subtrees worth deferring, and 3.14's `importtime=2` also marks already-loaded modules. To keep it, test the result rather than the timing: import the CLI module in a fresh interpreter and assert that known-heavy modules are absent from `sys.modules`. That fails deterministically on the one inadvertent top-level import that would undo the work.

**Why do inline imports in subcommand handlers work, and what is their weakness?**
Because an `import` statement inside a function runs only when the function runs, so dependencies of `export` load only for `invoice export`. The weakness, as PEP 810 puts it, is that the practice *"can be subverted by a single inadvertent top-level import"* anywhere on the chain — including in the package's `__init__.py`, which runs before the CLI module does. It needs a test to stay true.

**What changes in Python 3.14 and 3.15 for CLI start-up?**
3.14 defers the evaluation of annotations, so imports used only in type hints can move under `TYPE_CHECKING` without breaking unquoted annotations — though code that still supports older versions must keep quoting them. 3.15 adds explicit lazy imports through PEP 810, now Final, which defers loading a module until first use without restructuring code into functions. On 3.14.7, lazy loading is still done by hand.

**Why did pip and uv remove `import re` from their wrapper templates?**
Because the wrapper runs on every invocation of every console script, so even one unnecessary standard-library import is a cost paid by every command in every environment. pip's source says its template exists to be one that *"doesn't import `re` module, allowing scripts to load faster"*, and uv made the same change in 0.5.19. It is the same principle as the rest of this page, applied by the tool authors to the only part of the start-up path they control.

---

← Prev: [10 · Name collisions and `PATH` shadowing](10-name-collisions-and-path-shadowing.md) · [Topic index](README.md) · Next → **12 · When the command fails** *(not written yet)*
