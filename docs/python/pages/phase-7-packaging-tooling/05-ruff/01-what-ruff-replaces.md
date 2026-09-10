---
title: "ruff is one Rust binary that re-implements flake8 and its plugins, isort, pyupgrade, autoflake, pydocstyle and Black — and it is still a linter with no type inference and no plugin system, so what it does not replace matters as much as the list of what it does"
sidebar_label: "01 · What ruff replaces"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/)),
> *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)), the *FAQ*
> ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)), the *Rules* index ([docs.astral.sh](https://docs.astral.sh/ruff/rules/))
> and the v0.16.0 release post ([astral.sh](https://astral.sh/blog/ruff-v0.16.0)). Docs read at the `0.16.6` git tag.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no timings, no program output**.

**Before ruff, a well-kept Python repository ran five or six tools over the same files: flake8
with a handful of plugins, isort, pyupgrade, autoflake, pydocstyle and Black, each with its own
config file, its own version pin and its own pre-commit hook. ruff collapses that into one
executable that re-implements the rules — it does not wrap or call the originals — and adds a
Black-compatible formatter beside the linter. The replacement is real but bounded. ruff reads
source text and a syntax tree; it does not infer types across calls, so it does not replace
mypy or pyright, and it has no plugin system, so a flake8 plugin nobody re-implemented simply
stops running when you migrate. Knowing both lists is the whole job of this page.**

## One binary, re-implemented rather than wrapped

The two halves are described by the project in its own words:

> *"The Ruff Linter is an extremely fast Python linter designed as a drop-in replacement for Flake8 (plus dozens of plugins), isort, pydocstyle, pyupgrade, autoflake, and more."*
> — [The Ruff Linter](https://docs.astral.sh/ruff/linter/)

> *"The Ruff formatter is an extremely fast Python code formatter designed as a drop-in replacement for Black, available as part of the `ruff` CLI via `ruff format`."*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

The mechanism that makes "drop-in" possible is stated on the rules index:

> *"Regardless of the rule's origin, Ruff re-implements every rule in Rust as a first-party feature."*
> — [Rules](https://docs.astral.sh/ruff/rules/)

That sentence has consequences you will meet later. Because the rules are ported, not
delegated, a rule's behaviour can drift from the original plugin's, its code can be renamed,
and ruff's release cadence — not the original project's — decides when a rule changes. The
speed claim is Astral's: the 0.16.0 post says ruff replaces those tools *"all while executing
tens or hundreds of times faster than any individual tool."* This page makes no timing claim
of its own.

ruff installs as a prebuilt wheel, so no Rust toolchain is involved:

> *"Ruff ships with wheels for all major platforms, which enables `uv`, `pip`, and other tools to install Ruff without relying on a Rust toolchain at all."*
> — [FAQ](https://docs.astral.sh/ruff/faq/)

## The replacement map

| You used to run | ruff equivalent | Where it is covered |
|---|---|---|
| flake8 core (pyflakes `F`, pycodestyle `E`/`W`) | `ruff check`, selectors `F`, `E`, `W` | [03](03-rule-codes-and-selection.md) |
| flake8-bugbear, -comprehensions, -simplify, … | selectors `B`, `C4`, `SIM`, … | [03](03-rule-codes-and-selection.md) |
| isort | rule `I001` + `ruff check --select I --fix` | [10](10-import-sorting.md) |
| pyupgrade | selector `UP`, driven by `target-version` | [09b](09b-requires-python-inference.md) |
| autoflake | the fixes for `F401` (unused import) and `F841` (unused variable) | [05](05-fixes-and-fix-safety.md) |
| pydocstyle | selector `D` plus `lint.pydocstyle.convention` | [03](03-rule-codes-and-selection.md) |
| yesqa | `RUF100` (unused `noqa`) | [06c](06c-unused-suppressions-and-adoption.md) |
| Black | `ruff format` | [07](07-the-formatter-and-black.md) |
| Pylint | partial — the `PL` selectors overlap, no more | below |

The FAQ states the formatter-and-friends half of the list directly:

> *"Ruff can also replace Black, isort, yesqa, eradicate, and most of the rules implemented in pyupgrade."*

and the flake8 half with its conditions attached:

> *"Ruff can be used as a drop-in replacement for Flake8 when used (1) without or with a small number of plugins, (2) alongside Black, and (3) on Python 3 code."*

> *"Under those conditions, Ruff implements every rule in Flake8. In practice, that means Ruff implements all of the `F` rules (which originate from Pyflakes), along with a subset of the `E` and `W` rules (which originate from pycodestyle)."*

"A subset of `E` and `W`" is deliberate: ruff is designed to sit beside a formatter, and it
*"will defer implementing stylistic rules that are obviated by automated formatting."*

### Codes do not always survive the move

> *"Note that, in some cases, Ruff uses different rule codes and prefixes than would be found in the originating Flake8 plugins. For example, Ruff uses `TID252` to represent the `I252` rule from flake8-tidy-imports. This helps minimize conflicts across plugins and allows any individual plugin to be toggled on or off with a single (e.g.) `--select TID`, as opposed to `--select I2` (to avoid conflicts with the isort rules, like `I001`)."*

So a migration is not only a config translation. Every `# noqa: I252` in the codebase is now a
suppression for a code ruff does not have — see gotcha 3.

## What ruff does not replace

**A type checker.** The FAQ is unambiguous:

> *"Ruff is a linter, not a type checker. It can detect some of the same problems that a type checker can, but a type checker will catch certain errors that Ruff would miss. The opposite is also true: Ruff will catch certain errors that a type checker would typically ignore."*

> *"For example, unlike a type checker, Ruff will notify you if an import is unused, by looking for references to that import in the source code; on the other hand, a type checker could flag that you passed an integer argument to a function that expects a string, which Ruff would miss. The tools are complementary."*

```python
import os  # F401: ruff flags this — the name is never referenced


def total(prices: list[float]) -> float:
    return sum(prices)


total("12.50")  # ruff has no rule for this: argument types are a type checker's job
```

**Your own rules.** There is no plugin API:

> *"Beyond the rule set, Ruff's primary limitation vis-à-vis Flake8 is that it does not support custom lint rules. (Instead, popular Flake8 plugins are re-implemented in Rust as part of Ruff itself.)"*

> *"Ruff does not yet support third-party plugins, though a plugin system is within-scope for the project."*

**Pylint, fully.** Ruff overlaps with it heavily but not completely:

> *"Pylint implements many rules that Ruff does not, and vice versa. For example, Pylint does more type inference than Ruff (e.g., Pylint can validate the number of arguments in a function call). As such, Ruff is not a "pure" drop-in replacement for Pylint (and vice versa), as they enforce different sets of rules."*

**INI configuration.** `setup.cfg` and `tox.ini` are not read — *"Ruff doesn't currently
support INI files, like `setup.cfg` or `tox.ini`."* Configuration lives in `pyproject.toml`,
`ruff.toml` or `.ruff.toml` ([02](02-configuration-discovery.md)).

## The CI stack after the migration

What ruff leaves behind is short: ruff for lint and format, a type checker for types, a test
runner for behaviour. The FAQ's recommendation is exactly that pairing — *"It's recommended
that you use Ruff in conjunction with a type checker, like Mypy, Pyright, or Pyre, with Ruff
providing faster feedback on lint violations and the type checker providing more detailed
feedback on type errors."*

```bash
uv run ruff check .           # lint: exits 1 on any violation
uv run ruff format --check .  # format: exits 1 if any file would change
uv run mypy src               # types: the part ruff cannot see
uv run pytest                 # behaviour
```

Pinning ruff so that those commands mean the same thing everywhere is
**11b** *(not written yet)*; installing it as a dev dependency is
[uv add and uv remove](../02-uv/04-add-and-remove.md).

## Gotchas

**★ Symptom: CI is green, and production raises `TypeError` from a call that passed the wrong
type.** Cause: ruff was treated as the whole static-analysis layer. It resolves names and
patterns in the syntax tree; it does not check argument types against annotations — *"a type
checker could flag that you passed an integer argument to a function that expects a string,
which Ruff would miss."* Fix: keep a type checker in the pipeline beside ruff.

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

**★ Symptom: after replacing flake8 with ruff, a check your team relied on silently stopped
running.** Cause: it came from a flake8 plugin ruff has not re-implemented, and ruff *"does not
support custom lint rules."* Nothing errors — the plugin is simply absent. Fix: before
migrating, list what ruff ships and compare it with your flake8 plugin list; if a plugin is
missing, keep flake8 for that plugin alone and tell ruff its codes are external.

```bash
ruff linter                 # every upstream linter ruff re-implements, with its prefix
flake8 --select=XYZ src     # XYZ = the unported plugin's code prefix: run only that plugin
```

```toml
[tool.ruff.lint]
external = ["XYZ"]   # keep `# noqa: XYZ101` comments; ruff will not report them as unknown or unused
```

**Symptom: `# noqa: I252` comments stopped suppressing anything after the migration.** Cause:
ruff renamed the code — *"Ruff uses `TID252` to represent the `I252` rule from
flake8-tidy-imports."* The old code now names nothing in ruff. Fix: rewrite the suppressions to
the ruff code, then let `RUF100` find the ones that were never needed
([06c](06c-unused-suppressions-and-adoption.md)).

```python
from ..models import Invoice  # noqa: TID252
```

**Symptom: the `[flake8]` section in `setup.cfg` is ignored — line length, excludes, per-file
ignores all back to defaults.** Cause: ruff reads no INI files. Fix: translate the section into
`[tool.ruff]`.

```toml
# was: [flake8] max-line-length = 100 / extend-exclude = migrations / per-file-ignores = tests/*:S101
[tool.ruff]
line-length = 100
extend-exclude = ["migrations"]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101"]
```

**Symptom: a call with the wrong number of arguments used to fail Pylint and now passes.** Cause:
*"Pylint can validate the number of arguments in a function call"* by inference; ruff's `PL`
rules do not. Fix: that check belongs to the type checker, which reports an arity mismatch
against the function's signature.

```python
def send_invoice(invoice_id: int, email: str) -> None: ...


send_invoice(42)  # missing `email`: a type checker reports it; ruff does not
```

**Symptom: someone proposes writing "a quick custom ruff rule" for a house convention.** Cause:
there is no plugin API to write it against. Fix: express the convention with a configurable
built-in if one exists — banned imports are the common case — and leave anything else to a
separate tool.

```toml
[tool.ruff.lint]
extend-select = ["TID251"]

[tool.ruff.lint.flake8-tidy-imports.banned-api]
"requests".msg = "Use the shared httpx client in invoice_service.http instead."
```

## Interview questions

**★ What does ruff replace, and what does it deliberately not replace?**
It replaces flake8 and dozens of its plugins, isort, pyupgrade, autoflake, pydocstyle, yesqa,
eradicate and, through `ruff format`, Black — by re-implementing their rules in Rust, not by
calling them. It does not replace a type checker, because it does no type inference across
calls; it does not replace Pylint completely, because Pylint's inference catches things like
wrong argument counts; and it does not replace any flake8 plugin it has not ported, because it
has no plugin system. A correct migration therefore ends with ruff plus a type checker, and
with an explicit decision about every flake8 plugin that ruff does not list.

**★ Why is "ruff plus a type checker" the recommended pairing instead of ruff alone?**
Because they look at different things. ruff works from the source and its syntax tree: unused
imports, undefined names, risky patterns, outdated syntax, import order. A type checker models
the types flowing through the program and catches the class of bug where a value of the wrong
type reaches a function. The FAQ gives both directions — ruff notices an unused import a type
checker ignores; a type checker notices an integer passed where a string is expected, which
ruff would miss — and calls the tools complementary.

**Why can you not write a custom ruff rule, and what do you do when you need one?**
ruff has no third-party plugin interface: every rule is compiled into the binary, which is part
of why it is fast and why a single version pin pins the whole rule set. A plugin system is
described as in scope but not available. In practice you look for a configurable built-in first
(banned APIs, import conventions, naming patterns), and if nothing fits you keep a separate tool
for that one check and mark its codes in `lint.external` so ruff's own suppression checks leave
them alone.

**ruff renamed flake8-tidy-imports' `I252` to `TID252`. Why rename codes at all?**
Because ruff hosts dozens of plugins in one namespace, and their original codes collide. `I2xx`
from flake8-tidy-imports would overlap the isort rules under `I`. Giving each plugin its own
prefix lets one selector — `--select TID` — switch a whole plugin on or off. The cost lands on
migrations: old `noqa` codes must be rewritten, or they suppress nothing.

**Is ruff a drop-in replacement for flake8?**
Under stated conditions, yes: with no or few plugins, alongside Black, on Python 3 code, ruff
implements every flake8 rule — all of pyflakes' `F` codes and the subset of pycodestyle's `E`
and `W` codes that a formatter does not make redundant. Outside those conditions the answer
depends on whether each plugin you use has been re-implemented, and on whether you relied on
flake8's INI configuration, which ruff does not read.

---

← Prev: [Topic index](README.md) · Next → [01b · check and format are two tools](01b-check-and-format-are-two-tools.md)
