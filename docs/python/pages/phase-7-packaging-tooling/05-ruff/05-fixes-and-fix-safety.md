---
title: "`ruff check --fix` applies only fixes ruff labels safe — ones meant to keep runtime behaviour and comments — while unsafe fixes, which can change what the program does, wait behind `--unsafe-fixes`; the label belongs to each rule, can move between releases, and is the whole reason `--fix` is safe to run in a hook"
sidebar_label: "05 · Fixes and fix safety"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Fixes* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#fixes)),
> *Versioning: Fix stabilization* ([docs.astral.sh](https://docs.astral.sh/ruff/versioning/)), the rule pages for
> [`RUF015`](https://docs.astral.sh/ruff/rules/unnecessary-iterable-allocation-for-first-element/), [`F841`](https://docs.astral.sh/ruff/rules/unused-variable/),
> [`B006`](https://docs.astral.sh/ruff/rules/mutable-argument-default/), [`UP007`](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/)
> and [`F401`](https://docs.astral.sh/ruff/rules/unused-import/), the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)), and summary-line
> templates in `crates/ruff/src/printer.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff/src/printer.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**A fix is an edit ruff can make for you, and every fix carries a label that says how much you
should trust it. Safe fixes are designed to keep the program's behaviour and its comments
intact; unsafe fixes might change behaviour, delete comments, or both; display-only fixes are
never applied. `ruff check --fix` applies safe fixes and nothing else, which is what makes it
reasonable to run in a pre-commit hook on every commit. The interesting cases are the unsafe
ones, because "unsafe" usually means "correct for most code and wrong for yours": an `IndexError`
that becomes a `StopIteration`, a mutable default that was a deliberate cache, a type annotation
that a runtime validator can no longer evaluate. This page shows each of those, in code.**

## The three labels

> *"Ruff labels fixes as "safe" and "unsafe". The meaning and intent of your code will be retained when applying safe fixes, but the meaning could change when applying unsafe fixes."*

> *"Specifically, an unsafe fix could lead to a change in runtime behavior, the removal of comments, or both, while safe fixes are intended to preserve runtime behavior and will only remove comments when deleting entire statements or expressions (e.g., removing unused imports)."*
> — [The Ruff Linter: Fix safety](https://docs.astral.sh/ruff/linter/#fix-safety)

The versioning page adds the third level and the fact that labels move:

> *"Fixes have three applicability levels: **Display**: Never applied, just displayed. **Unsafe**: Can be applied with explicit opt-in. **Safe**: Can be applied automatically."*

> *"Fixes for rules may be introduced at a lower applicability, then promoted to a higher applicability. Reducing the applicability of a fix is not a breaking change. The applicability of a given fix may change when the preview mode is enabled."*
> — [Versioning](https://docs.astral.sh/ruff/versioning/)

And the default:

> *"Ruff only enables safe fixes by default. Unsafe fixes can be enabled by settings `unsafe-fixes` in your configuration file or passing the `--unsafe-fixes` flag to `ruff check`"*

```bash
ruff check --fix                  # apply safe fixes
ruff check --unsafe-fixes         # show unsafe fixes as available, apply nothing
ruff check --fix --unsafe-fixes   # apply safe and unsafe fixes
```

When unsafe fixes exist but are not enabled, ruff says so in its summary. The 0.16.6 source
builds that line from templates such as ``No fixes available ({} hidden fix{es} can be
enabled with the `--unsafe-fixes` option).`` — "hidden" is the word to look for. Since
**0.16.0**, the default `full` output also renders each available fix as a diff *"below the
`help` subdiagnostic"*, so you can read a fix before applying it.

## Unsafe, case 1 — a different exception (`RUF015`)

`RUF015` rewrites `list(...)[0]` into `next(iter(...))`, which avoids building a list. The
documentation explains why the fix is unsafe:

> *"However, when the collection is empty, this raised exception changes from an `IndexError` to `StopIteration`"* · *"Since the change in exception type could break error handling upstream, this fix is categorized as unsafe."*

```python
def first_open_invoice(invoices: dict[str, str]) -> str | None:
    try:
        return list(invoices)[0]          # RUF015 flags this
    except IndexError:                    # the handler depends on the exception type
        return None

# The unsafe fix would produce:  return next(iter(invoices))
# On an empty dict that raises StopIteration — the except IndexError clause no longer catches it.
```

## Unsafe, case 2 — comments can vanish (`F841`)

> *"This rule's fix is marked as unsafe because removing an unused variable assignment may delete comments that are attached to the assignment."*
> — [`unused-variable` (F841)](https://docs.astral.sh/ruff/rules/unused-variable/)

```python
def reconcile(batch_id: int) -> None:
    # TODO(finance): this total must match the ledger export — see INC-2231
    total = compute_total(batch_id)   # F841: never used
    publish(batch_id)
```

Deleting the assignment may take the ticket reference with it. That is not a behaviour change,
and it is still exactly the kind of edit a person should look at.

## Unsafe, case 3 — the "bug" was intended (`B006`)

> *"This fix is marked as unsafe because it replaces the mutable default with `None` and initializes it in the function body, which may not be what the user intended"*
> — [`mutable-argument-default` (B006)](https://docs.astral.sh/ruff/rules/mutable-argument-default/)

The rule's own *Known problems* section names the case: *"Mutable argument defaults can be used
intentionally to cache computation results."*

```python
def exchange_rate(currency: str, _cache: dict[str, float] = {}) -> float:  # B006
    if currency not in _cache:
        _cache[currency] = fetch_rate(currency)   # the shared dict IS the cache
    return _cache[currency]
```

The fix would reset the cache on every call. The rule's recommended alternative — *"prefer the
`@functools.lru_cache` decorator from the standard library"* — removes the flagged pattern
without losing the intent:

```python
import functools


@functools.lru_cache(maxsize=None)
def exchange_rate(currency: str) -> float:
    return fetch_rate(currency)
```

## Unsafe, case 4 — annotations a runtime library evaluates (`UP007`)

> *"This rule's fix is marked as unsafe on Python versions prior to 3.10 because using the PEP-604 syntax may lead to runtime errors in libraries that rely on runtime type annotations, like Pydantic"*
> — [`non-pep604-annotation-union` (UP007)](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/)

Whether this fix is safe depends on `target-version` — below 3.10 it is unsafe, at 3.10 and
above the `X | Y` syntax exists at runtime. That coupling is why a wrong `target-version`
produces wrong fixes ([09b](09b-requires-python-inference.md)).

## Safe, with an exception — `F401`

> *"Fixes to remove unused imports are safe, except in `__init__.py` files."*

> *"Applying fixes to `__init__.py` files is currently in preview."*
> — [`unused-import` (F401)](https://docs.astral.sh/ruff/rules/unused-import/)

In a package `__init__.py` an "unused" import is often a re-export, and removing it changes the
package's public interface. The preview behaviour offers a safe fix that *marks* first-party
imports as re-exports (a redundant alias or an `__all__` entry) and an unsafe one that removes
third-party imports.

## "Safe" is a promise, not a proof

> *"Even still, given the dynamic nature of Python, it's difficult to have complete certainty when making changes to code, even for seemingly trivial fixes. If a "safe" fix breaks your code, please file an Issue."*
> — [FAQ](https://docs.astral.sh/ruff/faq/)

Run your tests after a large `--fix`, and land mechanical fixes as their own commits.

## Gotchas

**★ Symptom: after someone added `--unsafe-fixes` to the pre-commit hook, an empty-collection
code path started raising `StopIteration` instead of being handled.** Cause: `RUF015`'s fix is
unsafe precisely because it *"changes from an `IndexError` to `StopIteration`"*; the hook applied
it without review. Fix: keep hooks and CI on safe fixes, and review unsafe ones deliberately, one
rule at a time.

```bash
uv run ruff check --select RUF015 --unsafe-fixes --diff src/   # read first
uv run ruff check --select RUF015 --unsafe-fixes --fix src/billing_api/reports.py
```

**★ Symptom: the summary says a violation has a fix, yet `ruff check --fix` leaves it in
place.** Cause: the fix is unsafe — the summary counts it as a *"hidden fix"* that *"can be
enabled with the `--unsafe-fixes` option"*. Fix: look at the fix, then apply it to that rule
only if it is right for this code.

```bash
uv run ruff check --select F841 --unsafe-fixes --diff .
```

**Symptom: applying the `B006` fix broke a memoised lookup — every call now refetches.** Cause:
the mutable default was the cache, which the rule lists under *Known problems*. Fix: express the
cache explicitly, as the rule recommends, instead of accepting the fix.

```python
import functools


@functools.lru_cache(maxsize=None)
def exchange_rate(currency: str) -> float:
    return fetch_rate(currency)
```

**Symptom: after `ruff check --fix --unsafe-fixes` on a 3.9-targeted project that uses
`from __future__ import annotations`, a Pydantic model fails at import time.** Cause: `UP007`
rewrote `Union[str, int]` as `str | int`, which *"may lead to runtime errors in libraries that
rely on runtime type annotations, like Pydantic"* on Pythons before 3.10. Fix: tell pyupgrade to
keep runtime-evaluated annotations, or raise the target to a Python where the syntax exists.

```toml
[tool.ruff.lint.pyupgrade]
keep-runtime-typing = true
```

**Symptom: a fix that `--fix` used to apply automatically is now reported as needing
`--unsafe-fixes`, after a patch upgrade.** Cause: *"Reducing the applicability of a fix is not a
breaking change"* — demotion is allowed in patch releases (0.16.1 marked `PT022` and some
`FURB105` fixes unsafe, for example). Fix: read the rule's new fix-safety note; if you accept the
risk for your codebase, promote it back explicitly ([05b](05b-controlling-fixes.md)).

```toml
[tool.ruff.lint]
extend-safe-fixes = ["PT022"]
```

**Symptom: an unused import in `src/billing_api/__init__.py` is reported but never removed by
`--fix`.** Cause: `F401` fixes in `__init__.py` are preview-only, because removal changes the
package interface. Fix: decide whether it is a re-export; if it is, say so and the diagnostic
goes away; if not, delete it by hand.

```python
from billing_api.invoices import Invoice as Invoice   # explicit re-export
```

## Interview questions

**★ What is the difference between a safe and an unsafe fix in ruff?**
A safe fix is designed to preserve runtime behaviour and only removes comments when it deletes a
whole statement, such as an unused import; ruff applies it with `--fix`. An unsafe fix may change
behaviour, remove comments, or both, and is applied only with explicit opt-in — `--unsafe-fixes`
or `unsafe-fixes = true`. There is also a display-only level that is never applied. The label is
per rule and per situation: `UP007`'s fix is unsafe below Python 3.10 and not above it.

**★ Why is `RUF015`'s fix unsafe even though the rewrite is faster and "equivalent"?**
Because it is equivalent only when the collection is non-empty. `list(x)[0]` raises `IndexError`
on an empty collection, `next(iter(x))` raises `StopIteration`, and any `except IndexError`
upstream stops catching it. Since the change in exception type can break error handling
elsewhere, ruff labels it unsafe — the canonical example of a fix that is right for most code and
wrong for some.

**Why does ruff's "Fix all" in the editor not apply unsafe fixes?**
For the same reason `--fix` does not: bulk application is only reasonable for edits that do not
change meaning. The editor documentation says *"Fix all"* skips unsafe fixes, which can still be
applied one at a time with *"Quick fix"*, where a person sees each edit. Setting
`unsafe-fixes = true` in the configuration changes that for the editor too, which is a good
reason not to set it project-wide.

**Can a fix's safety change between ruff versions?**
Yes, in both directions. Fixes can be introduced at a lower applicability and promoted later —
promoting a safe fix to stable is a minor-version change — while demoting a fix's applicability
is explicitly allowed in a patch release. Preview can also change applicability. A pipeline that
relies on a particular fix being applied automatically should pin ruff exactly.

**How would you apply unsafe fixes on a large codebase responsibly?**
One rule at a time: run `--select <code> --unsafe-fixes --diff` to read what would change, apply
with `--fix --unsafe-fixes` limited to that rule, run the tests, and commit the result as a
mechanical change. Where a rule's unsafe fix is reliably right for this codebase — a pattern the
team has reviewed repeatedly — promote it with `extend-safe-fixes` so future runs apply it
automatically, and leave the rest opt-in.

---

← Prev: [04 · Preview mode](04-preview-mode.md) · [Topic index](README.md) · Next → [05b · Controlling fixes](05b-controlling-fixes.md)
