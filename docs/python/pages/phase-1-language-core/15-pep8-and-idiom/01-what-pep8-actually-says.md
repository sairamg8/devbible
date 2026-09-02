---
title: "PEP 8: what it actually says, and the half a formatter already handles"
sidebar_label: "1 · What PEP 8 says"
sidebar_position: 150
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/),
> [PEP 257 — Docstring Conventions](https://peps.python.org/pep-0257/),
> [PEP 20 — The Zen of Python](https://peps.python.org/pep-0020/),
> and the Python 3.14 Library Reference
> [`this`](https://docs.python.org/3.14/library/this.html).
> Target: **CPython 3.14**.

**PEP 8 is a style guide, and most of what it covers is now decided by a
formatter before anyone reads the diff. That is the useful frame: **the
whitespace half is settled by tooling and not worth a review comment; the
naming and semantics half is where PEP 8 still has something to say.** The
document itself opens with the reason — code is read far more than it is
written — and closes the argument against pedantry in its own words, in a
section titled *"A Foolish Consistency is the Hobgoblin of Little Minds"*.**

## The framing sentence

> *"A style guide is about consistency. Consistency with this style guide is
> important. Consistency within a project is more important."*

Read that ordering carefully: your project's existing convention outranks PEP 8.
A codebase that has used `camelCase` for ten years should not be half-converted
because someone read the PEP. And the document adds:

> *"know when to be inconsistent – sometimes style guide recommendations just
> aren't applicable."*

The named reasons to ignore a guideline are worth having in mind, because they
come up: when applying it would make the code *less* readable, when surrounding
code already breaks it (though that may be a chance to clean up), when the code
predates the guideline and there is no other reason to touch it, and when
compatibility with an older Python or an existing library requires it.

## The formatting rules a formatter owns

These are real rules, and they are also the ones you should stop having opinions
about:

| Rule | PEP 8 |
|---|---|
| Indentation | 4 spaces per level, never tabs in new code |
| Line length | **79** for code, **72** for docstrings and comments |
| Team override | *"Teams may extend code to 99 characters by mutual agreement"* |
| Line breaks | Break **before** a binary operator — the mathematical convention, and the current recommendation |
| Blank lines | Two between top-level definitions, one between methods |

The line-length row is the one people argue about, and PEP 8 has already
conceded the argument: 99 by team agreement is explicitly sanctioned. In
practice most modern projects settle at **88** (Black's default) or **100**, and
the number matters far less than it being set once in `pyproject.toml` and never
discussed again.

**The practical position: configure `ruff format` or Black, run it in CI, and
treat every whitespace question as answered.** A review comment about a blank
line is a review comment that did not look at the logic.

## Naming — the half that still matters

A formatter cannot rename anything, so this is where PEP 8 earns its keep:

| Thing | Convention | Example |
|---|---|---|
| Modules, packages | short, all-lowercase, underscores if it helps | `json`, `http_client` |
| Classes | CapWords | `HTTPResponse`, `UserAccount` |
| Exceptions | CapWords, usually ending `Error` | `ConfigError` |
| Functions, methods, variables | lowercase with underscores | `parse_row`, `retry_count` |
| Constants | ALL_CAPS with underscores | `MAX_RETRIES` |
| Type variables | CapWords, short | `T`, `KT`, `VT_co` |

And the underscore conventions, which encode real semantics rather than taste:

| Spelling | Meaning |
|---|---|
| `_name` | *"weak 'internal use' indicator"* — a convention, not enforcement. `from x import *` skips it; nothing else does |
| `__name` (in a class body) | **name mangling** — the attribute becomes `_ClassName__name`, to avoid clashes in subclasses |
| `__name__` | reserved dunder; do not invent your own |
| `name_` | *"avoids keyword conflicts"* — `class_`, `id_`, `type_` |

The double-underscore row is the one that is misunderstood most often. `__name`
is **not** "private" in any enforced sense — the attribute is trivially
reachable as `obj._ClassName__name`. Its actual purpose is to stop a subclass
accidentally overwriting a base class's attribute of the same name. Use it when
you are writing a base class meant to be subclassed by people you will never
meet; use a single underscore otherwise.

The `name_` row is small and genuinely useful: when a parameter must be called
`class` or `from` or `id`, the trailing underscore is the sanctioned spelling —
better than `klass` or `cls` (which means something else) or `_id`.

## Imports

> *"Place imports at file top after docstrings. Group in order: standard
> library, third-party, local application (with blank lines between groups).
> Prefer absolute imports over relative imports. Avoid wildcard imports, as they
> obscure namespace contents."*

```python
"""Module docstring first."""

import os                       # 1. standard library
import sys

import httpx                    # 2. third party
from sqlalchemy import select

from myapp.models import User   # 3. local application
```

Three of those rules have teeth:

**Absolute over relative.** `from myapp.models import User` keeps working when
the module moves; `from ..models import User` does not, and it is why a
refactored package suddenly cannot import itself. Explicit relative imports are
acceptable for intra-package references in a deep tree — implicit relative
imports do not exist in Python 3 at all.

**No wildcard.** `from x import *` makes it impossible to tell where a name came
from, defeats every linter's undefined-name check, and silently shadows
builtins. The one sanctioned use is re-exporting in a package's `__init__.py`,
and even there `__all__` is the better tool.

**Imports at the top.** The exception that is genuinely fine: a deliberately
deferred import inside a function, to break a circular dependency or to avoid
paying an expensive import at startup. Comment it, because otherwise someone
will "fix" it back to the top.

`ruff`'s `I` rules (or `isort`) sort and group imports automatically, so this
category also moves into the "settled by tooling" bucket.

## PEP 257, in one paragraph

Docstrings are their own PEP. The parts worth knowing: every public module,
class and function should have one; it goes immediately after the `def` line as
a **string literal**, not a comment; one-liners fit on one line with the closing
quotes on that line; multi-line docstrings put a summary line first, then a blank
line, then the detail. The *format* of the detail — Google, NumPy, reST — is a
project decision that PEP 257 does not make for you.

## Gotchas

**Symptom — a review argues about line length or blank lines.** Cause: no
formatter is configured, so style is a matter of opinion on every diff. Fix:
adopt `ruff format` or Black, set the line length in `pyproject.toml`, run it in
CI. PEP 8 itself sanctions 99 by team agreement, so the number is not worth
defending.

**Symptom — a subclass silently breaks its base class's internal state.**
Cause: both use the same single-underscore attribute name, and the subclass's
assignment overwrote the base's. Fix: this is exactly what `__name` mangling is
for — the base class's `__cache` becomes `_Base__cache` and cannot collide.

**Symptom — someone treats `__name` as access control and is surprised it can be
read.** Cause: it is name mangling, not privacy — `obj._Class__name` reaches it.
Fix: understand it as collision avoidance. Python has no private attributes, and
`_name` is a convention that documents intent rather than enforcing it.

**Symptom — a package stops importing after files are moved.** Cause: relative
imports encode the module's position in the tree. Fix: prefer absolute imports;
they survive a move. Implicit relative imports do not exist in Python 3, so the
only options are absolute and explicit-relative.

**Symptom — a linter reports an undefined name that plainly exists.** Cause: it
arrived via `from x import *`, which the linter cannot resolve. Fix: import
names explicitly. Wildcard imports also shadow builtins silently — a module
exporting `list` or `id` will quietly replace them.

**Symptom — a function-level import gets "cleaned up" to the top and creates a
circular import.** Cause: the deferred import was load-bearing and unexplained.
Fix: comment every deferred import with the reason — circular dependency or
startup cost — so the next person leaves it alone.

**Symptom — a parameter is named `klass` or `type_` inconsistently across a
codebase.** Cause: no convention for the keyword-collision case. Fix: PEP 8's
answer is a single trailing underscore — `class_`, `type_`, `id_`. `klass` is a
Ruby import and `cls` already means the class in a `classmethod`.

**Symptom — CI style checks and the formatter disagree and fight each other.**
Cause: a linter configured with rules the formatter overrides, most often
line-length and quote style. Fix: let the formatter own formatting and disable
the overlapping lint rules; `ruff`'s recommended configuration does this for
you.

## Interview questions

**★ Q: How strictly should PEP 8 be followed?**
It says so itself: consistency with the guide matters, but *"consistency within
a project is more important"*, and it names the cases where a guideline should
be ignored — when it hurts readability, when surrounding code already differs,
when the code predates it, when compatibility demands it. In practice, let a
formatter settle the whitespace half and spend review attention on naming and
semantics.

**★ Q: What does a leading double underscore do?**
Name mangling: inside a class body, `__x` becomes `_ClassName__x`. It is not
access control — `obj._ClassName__x` reads it fine. Its real purpose is to stop
a subclass accidentally colliding with a base class's attribute, so it belongs
in base classes designed for inheritance and nowhere else. A single underscore
is the "internal use" convention, and only `import *` honours it.

**★ Q: Why avoid `from module import *`?**
It makes the origin of every name unknowable, defeats linters' undefined-name
analysis, and silently shadows builtins — a module exporting `id` or `list`
replaces them for the rest of your file. The only defensible use is re-exporting
in a package `__init__.py`, and `__all__` with explicit imports is better even
there.

**Q: What is PEP 8's line length, really?**
79 for code and 72 for docstrings and comments, with an explicit escape hatch:
teams may extend code to 99 by mutual agreement. Most modern projects use 88
(Black's default) or 100. The value matters much less than fixing it once in
`pyproject.toml`.

**Q: What is the trailing underscore convention for?**
Avoiding a collision with a keyword or a builtin — `class_`, `from_`, `id_`,
`type_`. It is PEP 8's sanctioned answer, and it is better than `klass` or a
leading underscore, which already means something else.

**Q: Absolute or relative imports?**
PEP 8 prefers absolute, because they keep working when a module moves and they
say plainly where a name comes from. Explicit relative imports are acceptable
for intra-package references in a deep tree. Implicit relative imports were
removed in Python 3 and are not an option.

**Q: Which PEP 8 rules are still worth a code review comment?**
The ones a formatter cannot fix: naming, the underscore conventions, import
hygiene, and the semantic recommendations — `is None` rather than `== None`, not
comparing booleans to `True`, and the mutable-default rule. Anything about
whitespace should have been handled before the diff existed.

---

← Prev: [`None` and the "no result" contract](../14-none-and-no-result/README.md) · Index: [PEP 8 and idiom](README.md) · Next → [What "pythonic" actually means](02-what-pythonic-means.md)
