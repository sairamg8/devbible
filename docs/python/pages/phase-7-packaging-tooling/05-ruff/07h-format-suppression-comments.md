---
title: "`# fmt: off`/`# fmt: on` and `# fmt: skip` exempt code from the formatter at statement granularity only — inside an expression they silently do nothing — and they are a different system from `noqa`: a formatting pragma never silences a lint rule, a `noqa` never stops the formatter, and neither stops import sorting"
sidebar_label: "07h · Format suppression comments"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Format suppression* and *Markdown code formatting*,
> read as raw Markdown at the `0.16.6` tag ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/#format-suppression),
> [source](https://github.com/astral-sh/ruff/blob/0.16.6/docs/formatter.md)); *The Ruff Linter: Error suppression* and the isort
> action comments ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#error-suppression)); *Known deviations from Black: pragma comments*
> ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/black/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Sometimes the formatter's layout is wrong for a specific piece of code — a matrix whose rows
should line up, a routing table read as a grid, a long literal whose line breaks carry meaning.
ruff keeps Black's escape hatches: `# fmt: off` / `# fmt: on` around a region, `# fmt: skip` at
the end of a statement. Both work on *statements*. Put one inside a list literal or on one argument
of a multi-line call and it is silently ignored, and the code is reformatted anyway. And because
ruff is two tools in one binary, it has two suppression systems that do not overlap: formatting
pragmas are invisible to the linter, `noqa` is invisible to the formatter, and import order is a
lint fix governed by isort's own action comments.**

## The three pragmas

> *"Like Black, Ruff supports `# fmt: on`, `# fmt: off`, and `# fmt: skip` pragma comments, which can be used to temporarily disable formatting for a given code block."*
> — [The Ruff Formatter: Format suppression](https://docs.astral.sh/ruff/formatter/#format-suppression)

### `# fmt: off` / `# fmt: on` — a region of statements

> *"`# fmt: on` and `# fmt: off` comments are enforced at the statement level"*

```python
# fmt: off
IDENTITY = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
]
ROTATE_90 = [
    0, -1, 0,
    1,  0, 0,
    0,  0, 1,
]
# fmt: on


def transform(point: list[int], matrix: list[int]) -> list[int]:
    return [sum(matrix[row * 3 + col] * point[col] for col in range(3)) for row in range(3)]
```

The region contains two whole assignment statements, so both are left exactly as written.
The consequence of "statement level" is spelled out in the next sentence:

> *"As such, adding `# fmt: on` and `# fmt: off` comments within expressions will have no effect."*

```python
# No effect: the pragmas are inside the list expression.
PRICES = [
    # fmt: off
    100,   250,   400,
    # fmt: on
    1200,
]
```

### `# fmt: skip` — one statement or header

> *"`# fmt: skip` comments suppress formatting for a case header, decorator, function definition, class definition, or the preceding statements on the same logical line."*

```python
from functools import lru_cache

ROUTES = {"/invoices": "list_invoices", "/health": "health"}  # fmt: skip


@lru_cache( maxsize = 32 )  # fmt: skip
def fetch_rates(currency: str) -> dict[str, float]:
    return {"EUR": 1.0, currency: 1.08}


def describe(command: tuple[str, int]) -> str:
    match command:
        case ("refund",amount):  # fmt: skip
            return f"refund {amount}"
        case _:
            return "unknown"
```

*"The preceding statements on the same logical line"* includes several statements joined with
`;` — `width=3; height=4  # fmt: skip` covers both. The limit is the same as for `off`/`on`:

> *"Adding a `# fmt: skip` comment at the end of an expression will have no effect."*

```python
# No effect: the comment ends an argument expression, not a statement.
invoice = build_invoice(
    customer_id ,  # fmt: skip
    amount_cents=1200,
)
```

For a multi-line statement the reliable tool is a `# fmt: off` / `# fmt: on` pair around the
whole statement.

### YAPF's pragmas

> *"Like Black, Ruff will _also_ recognize YAPF's `# yapf: disable` and `# yapf: enable` pragma comments, which are treated equivalently to `# fmt: off` and `# fmt: on`, respectively."*

### Inside Markdown and docstrings

In Markdown files, *"formatting suppression comments will be handled as usual within code
blocks"*, and whole blocks can additionally be fenced off with `<!-- fmt:off -->` /
`<!-- fmt:on -->` HTML comments ([07g](07g-docstring-and-markdown-code.md)).

## Two suppression systems that do not overlap

| You want to stop… | Use | Does not affect |
|---|---|---|
| the formatter changing layout | `# fmt: off`/`on`, `# fmt: skip` | lint diagnostics |
| a lint diagnostic | `# noqa: CODE`, `ruff: ignore[...]` ([06](06-noqa.md), [06b](06b-ruff-ignore-and-range-suppressions.md)) | the formatter |
| import sorting (`I001`) | `# isort: off`/`on`, `# isort: skip`, `# isort: skip_file`, `# isort: split` | the formatter |

The isort action comments are linter features: *"Ruff respects isort's action comments
(`# isort: skip_file`, `# isort: on`, `# isort: off`, `# isort: skip`, and `# isort: split`)"* —
with the caveat that *"Unlike isort, Ruff does not respect action comments within docstrings."*
Import sorting in full is **10** *(not written yet)*.

The two systems do cooperate in one place: the formatter never moves a pragma comment, because
pragma comments (`# noqa`, `# type:` and others) *"are ignored when computing the width of a
line"* ([07c](07c-known-deviations-from-black.md)). So a `noqa` stays on its line through every
reformat — but it does not stop that line from being reformatted.

A region that must survive both tools needs both kinds of comment:

```python
# fmt: off
PERMISSION_MATRIX = {
    "admin":   {"read": True,  "write": True,  "refund": True,  "export_all_customer_records": True},  # noqa: E501
    "support": {"read": True,  "write": False, "refund": True,  "export_all_customer_records": False},  # noqa: E501
}
# fmt: on
```

## Gotchas

**★ Symptom: a `# fmt: off` / `# fmt: on` pair inside a list literal is ignored and the list is
reformatted.** Cause: the pragmas are *"enforced at the statement level"*; inside an expression
they have no effect. Fix: move the pair outside the statement.

```python
# fmt: off
PRICES = [
    100,   250,   400,
    1200,
]
# fmt: on
```

**★ Symptom: `# fmt: skip` on one line of a multi-line call does nothing.** Cause: the comment
ends an expression (one argument), not a statement or header; that placement *"will have no
effect."* Fix: wrap the whole statement in an `off`/`on` region.

```python
# fmt: off
invoice = build_invoice(
    customer_id ,
    amount_cents=1200,
)
# fmt: on
```

**★ Symptom: a block wrapped in `# fmt: off` still produces `E501` diagnostics in CI.** Cause:
formatting pragmas mean nothing to the linter. Fix: suppress the lint rule separately — on the
line, or for the file if the whole file is a data table.

```python
LONG_HEADER = "Invoice, Customer, Amount, Currency, Region, Status, Created, Updated, Paid"  # noqa: E501
```

**Symptom: a line carrying `# noqa: E501` was still wrapped by `ruff format`.** Cause: `noqa`
suppresses a lint diagnostic; it is not a formatting instruction. Fix: add a formatting
suppression if the layout must stay.

```python
LEGACY_QUERY = "SELECT id, customer_id, amount_cents, currency FROM invoice WHERE status = 'open'"  # noqa: E501  # fmt: skip
```

I could not confirm from the documentation read whether `# fmt: skip` is honoured when it follows
another comment on the same line, as above; if it is not, the fallback is an `off`/`on` pair
around the statement.

**Symptom: imports inside a `# fmt: off` region were still reordered by `ruff check --fix`.**
Cause: import order is lint rule `I001`, which follows isort's action comments, not formatting
pragmas. Fix: use the isort comments.

```python
# isort: off
import billing.patches  # must run before the ORM loads
import billing.orm
# isort: on
```

**Symptom: after migrating from YAPF, one module is never formatted, no matter what.** Cause: a
leftover `# yapf: disable` with no matching `# yapf: enable`; ruff treats YAPF pragmas as
`# fmt: off` / `# fmt: on`. Fix: remove the stale pragma, or close the region where it was meant
to end.

```bash
git grep -n "yapf: disable"
```

**Symptom: a `# fmt: skip` comment was added to "protect" a docstring's example code, and the
example is formatted anyway.** Cause: the pragma is not in the docstring's code — it sits on a
statement, which the docstring is part of only as a string. Docstring code formatting follows the
docstring settings. Fix: turn off `docstring-code-format`, or take the example out of the formatter's recognition
by labelling it with a non-Python language ([07g](07g-docstring-and-markdown-code.md)).

```toml
[tool.ruff.format]
docstring-code-format = false
```

## Interview questions

**★ What is the difference between `# fmt: off`/`# fmt: on` and `# fmt: skip`, and where does
each work?**
`# fmt: off` and `# fmt: on` bracket a region of whole statements, leaving them exactly as
written. `# fmt: skip` goes at the end of a line and covers the statements on that logical line,
or a decorator, function definition, class definition or `case` header. Both are statement-level:
inside an expression — within a list literal, at the end of one argument — they have no effect,
so a multi-line statement must be wrapped in an `off`/`on` pair instead.

**★ Does `# fmt: off` stop lint rules, and does `# noqa` stop the formatter?**
Neither. They belong to two separate tools that share a binary. Formatting pragmas only affect
`ruff format`; `noqa` and `ruff: ignore` only affect `ruff check`. A region that must survive both
needs both kinds of comment. The one interaction is that the formatter ignores pragma comments
when measuring width, so it never moves a `noqa` off its line.

**How do you stop both the formatter and the import sorter from touching a block of imports?**
Use isort's action comments for the ordering — `# isort: off` / `# isort: on` or `# isort: skip`
— because import sorting is lint rule `I001`, and wrap the block in `# fmt: off` / `# fmt: on` if
its layout must also be preserved. Formatting pragmas alone do not stop `I001`'s fix.

**Why would a codebase that never used YAPF still need to know about `# yapf: disable`?**
Because ruff honours it: `# yapf: disable` and `# yapf: enable` are treated as `# fmt: off` and
`# fmt: on`. Code inherited from a YAPF-formatted project can carry these pragmas, and a stray
`disable` silently exempts code from the formatter until someone finds it.

**When is a formatting suppression the right tool, and when is it a smell?**
It is right when layout carries meaning the formatter cannot know — aligned matrices, tables of
constants read as a grid, test vectors. It is a smell when it papers over code that is hard to
format because it is hard to read, or when it becomes the team's way to keep a personal style;
every region is code that never gets the formatter's consistency again.

---

← Prev: [07g · Docstring and Markdown code](07g-docstring-and-markdown-code.md) · [Topic index](README.md) · Next → [08 · Formatter/lint conflicts](08-formatter-lint-conflicts.md)
