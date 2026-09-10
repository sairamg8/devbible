---
title: "Import sorting is a lint fix that also lays out code, so five isort settings can fight the formatter just like the conflicting rules do — and the symptom of any conflict is the same: a fix/format pipeline that never settles, which you detect by running it twice and demanding the second pass change nothing"
sidebar_label: "08b · isort settings and the fix/format loop"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Conflicting lint rules* (raw Markdown at the `0.16.6` tag,
> [docs.astral.sh](https://docs.astral.sh/ruff/formatter/#conflicting-lint-rules)); settings reference for
> [`lint.isort.lines-after-imports`](https://docs.astral.sh/ruff/settings/#lint_isort_lines-after-imports),
> [`lint.isort.lines-between-types`](https://docs.astral.sh/ruff/settings/#lint_isort_lines-between-types),
> [`lint.isort.split-on-trailing-comma`](https://docs.astral.sh/ruff/settings/#lint_isort_split-on-trailing-comma) and
> [`line-length`](https://docs.astral.sh/ruff/settings/#line-length); the warning logic in `crates/ruff/src/commands/format.rs` at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff/src/commands/format.rs)); *Integrations: pre-commit*
> ([docs.astral.sh](https://docs.astral.sh/ruff/integrations/)); the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/));
> pre-commit 4.6.2 *Creating new hooks* ([pre-commit.com](https://pre-commit.com/#creating-new-hooks)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · **pre-commit 4.6.2**.
> Documentation-validated — **no sandbox run, no program output**.

**[08](08-formatter-lint-conflicts.md) covered the lint rules that fight the formatter. The other
source of conflict is import sorting. `I001` is a lint rule, but its fix rewrites layout — it
wraps long `from` imports, inserts blank lines after the import block, splits or joins names —
and five isort settings let it produce a layout the formatter will not keep. Whatever the cause,
a conflict always shows up the same way: `ruff check --fix` and `ruff format` take turns changing
the same lines, and a pre-commit hook fails on every run because it keeps modifying files. The
test for a healthy configuration is simple and worth scripting: run the pipeline twice; the
second pass must change nothing.**

## The isort settings the formatter cares about

The formatter page lists `force-single-line`, `force-wrap-aliases`, `lines-after-imports`,
`lines-between-types` and `split-on-trailing-comma` as isort settings to be careful with. The
settings reference is precise about the two numeric ones:

> `lines-after-imports`: *"When using the formatter, only the values `-1`, `1`, and `2` are compatible"*
> — [settings: `lint.isort.lines-after-imports`](https://docs.astral.sh/ruff/settings/#lint_isort_lines-after-imports)

> `lines-between-types`: *"only the values `0` and `1` are compatible"*
> — [settings: `lint.isort.lines-between-types`](https://docs.astral.sh/ruff/settings/#lint_isort_lines-between-types)

Only the compatible values were confirmed for this page, not the formatter-side reason for each
limit. The practical reading does not depend on it: outside those values, `I001` asks for blank
lines the formatter will not keep.

In the 0.16.6 source, `ruff format` warns when:

| Setting | Warned when |
|---|---|
| `lines-after-imports` | its value is not `-1`, `1` or `2` |
| `lines-between-types` | its value is greater than `1` |
| `force-wrap-aliases` | enabled while `format.skip-magic-trailing-comma = true` |
| `split-on-trailing-comma` | enabled (its default) while `format.skip-magic-trailing-comma = true` |

`force-single-line` is on the documentation's list but did not appear among the warning
conditions in the source summary read for this page; treat the absence of a warning as no
guarantee.

### Why trailing commas are the subtle pair

isort and the formatter both read a trailing comma as "keep this exploded". With the defaults
they agree. Turn off the formatter's reading (`skip-magic-trailing-comma = true`) while isort
keeps its own (`split-on-trailing-comma = true`, the default), and they disagree about the same
import:

```python
from billing.models import (
    Invoice,
    LineItem,
)
```

isort honours the trailing comma and keeps one name per line; a formatter that ignores trailing
commas is free to join the import onto one line, and the next `I001` fix explodes it again. Make
the two settings agree:

```toml
[tool.ruff.format]
skip-magic-trailing-comma = true

[tool.ruff.lint.isort]
split-on-trailing-comma = false
```

## `line-length` must be the same number everywhere

`I001` wraps long `from` imports at the top-level `line-length` — *"at which `isort` and the
formatter prefers to wrap lines"*. When the formatter is `ruff format`, both read the same
setting and cannot disagree. When a team keeps **Black** as its formatter and uses ruff only to
lint, the FAQ states the single precondition:

> *"Yes. The Ruff linter is compatible with Black out-of-the-box, as long as the `line-length` setting is consistent between the two."*

```toml
[tool.black]
line-length = 100

[tool.ruff]
line-length = 100
```

Two numbers in two tables is exactly the kind of setting that drifts; one of them gets edited in
a later change and the other does not.

## The loop, and how pre-commit turns it into a blocked commit

pre-commit's contract for a hook is that it *"must exit nonzero on failure or modify files."* A
hook that rewrites a file fails that run, and the developer re-runs the commit expecting it to
pass. With a conflict in the configuration, the second run rewrites the same lines back, fails
again, and so on. The ruff documentation's ordering advice assumes no conflict exists:

> *"When running with `--fix`, Ruff's lint hook should be placed before Ruff's formatter hook, and before Black, isort, and other formatting tools, as Ruff's fix behavior can output code changes that require reformatting."*

> *"(As long as your Ruff configuration avoids any linter-formatter incompatibilities, `ruff format` should never introduce new lint errors, so it's safe to run Ruff's format hook after `ruff check --fix`.)"*
> — [Integrations: pre-commit](https://docs.astral.sh/ruff/integrations/)

### A settledness check

Run the pipeline once to converge, then verify that a second pass would change nothing. `ruff
check --diff` shows what `--fix` would still change and exits `0` when there is nothing; `ruff
format --check` exits `1` if any file would be reformatted.

```bash
#!/usr/bin/env bash
# scripts/ruff-settles.sh — fails if lint fixes and formatting disagree
set -euo pipefail

uv run ruff check --fix --exit-zero .   # pass 1: apply fixes; leftover violations are not this script's job
uv run ruff format .                    # pass 1: format what the fixes left

uv run ruff check --diff .              # pass 2: any remaining fix means the formatter undid one
uv run ruff format --check .            # pass 2: any reformat means a fix undid the formatter
```

If pass 2 fails, the diff it prints names the lines both tools keep changing — and therefore the
rule or setting to change. Run `ruff format` once more by hand and read its warnings; most
conflicts are named there.

## Gotchas

**★ Symptom: the pre-commit `ruff-check --fix` and `ruff-format` hooks modify files on every
single run, so no commit ever passes.** Cause: a lint fix and the formatter disagree — a
conflicting rule from [08](08-formatter-lint-conflicts.md) or one of the isort settings above.
Fix: run the settledness check to find the lines, read `ruff format`'s warnings, and ignore the
rule or correct the setting.

```bash
uv run ruff format . 2>&1 | grep -i "conflict"
```

**★ Symptom: after setting `lines-after-imports = 3`, the blank lines after the imports change on
every run.** Cause: `3` is outside the values the reference lists as compatible with the
formatter (`-1`, `1`, `2`), so `I001` and the formatter disagree about those blank lines. Fix:
use a compatible value.

```toml
[tool.ruff.lint.isort]
lines-after-imports = 2
```

**★ Symptom: Black is the formatter, ruff only lints, and long `from` imports flip between two
wrappings.** Cause: `[tool.black] line-length` and `[tool.ruff] line-length` differ, so `I001`
wraps at one width and Black at another. Fix: make them equal — or switch the formatter to
`ruff format` and delete the second number ([07b](07b-migrating-from-black.md)).

```toml
[tool.ruff]
line-length = 100
```

**Symptom: with `skip-magic-trailing-comma = true`, parenthesised imports keep being exploded by
the fixer and joined by the formatter.** Cause: isort's `split-on-trailing-comma` (default
`true`) still treats the trailing comma as an instruction the formatter now ignores. Fix: turn it
off to match.

```toml
[tool.ruff.lint.isort]
split-on-trailing-comma = false
```

**Symptom: `lines-between-types = 2` separates `import x` from `from x import y` with two blank
lines in one run and fewer in the next.** Cause: the reference lists only `0` and `1` as
compatible with the formatter. Fix: use one.

```toml
[tool.ruff.lint.isort]
lines-between-types = 1
```

**Symptom: the hooks were reordered so formatting runs first, and now every commit leaves a
file unformatted.** Cause: the lint fix ran after the formatter and changed layout the formatter
never saw — a `UP` rewrite, a sorted import block. Fix: restore the documented order, lint fix
first.

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.6
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
```

## Interview questions

**★ What does it mean for a lint-fix-then-format pipeline to "settle", and how would you test
it?**
It settles when running it a second time changes nothing: every fix the linter applies is
already formatted, and the formatter produces nothing the linter wants to fix. Test it by
running `ruff check --fix` and `ruff format` once, then `ruff check --diff` and
`ruff format --check` — the first shows fixes still pending, the second reformatting still
pending. Either one reporting a change means the two tools disagree, and the lines it shows
point to the conflicting rule or setting.

**★ Why can isort settings conflict with a formatter when import sorting is "only" a lint rule?**
Because `I001`'s fix does not only reorder names — it wraps long imports, splits or joins
parenthesised names, and sets the blank lines around the import block. Those are layout
decisions the formatter also makes. Values such as `lines-after-imports = 3`, `lines-between-types`
above 1, or honouring trailing commas when the formatter ignores them produce a layout the
formatter will not keep, and the two rewrite each other.

**If a team keeps Black and uses ruff only as a linter, what has to match?**
`line-length`, at minimum — the FAQ states the linter is compatible with Black *"as long as the
`line-length` setting is consistent between the two."* `I001` wraps imports at ruff's number and
Black wraps at its own, so different values produce alternating layouts. The conflicting-rule
list also applies, since Black enforces the same indentation, quotes and trailing commas as
ruff's formatter.

**Why does a formatter conflict show up as a blocked commit rather than a failing test?**
pre-commit treats a hook that modifies files as a failure — its hook contract is *"exit nonzero
on failure or modify files"* — so the developer re-runs the commit. With two tools that
disagree, each run modifies files again, and the commit can never pass. The bug is in the
configuration, but it is felt as a broken commit workflow.

---

← Prev: [08 · Formatter/lint conflicts](08-formatter-lint-conflicts.md) · [Topic index](README.md) · Next → [09 · target-version](09-target-version.md)
