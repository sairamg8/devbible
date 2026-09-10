---
title: "The formatter has about a dozen settings and each one is a policy decision for the whole repository — `line-length` and `indent-width` are shared with the linter at the top level, the `[tool.ruff.format]` table holds quotes, indentation, trailing commas and line endings, and every one of them changes thousands of lines the moment it changes"
sidebar_label: "07e · Formatter settings"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Configuration* (raw Markdown at the `0.16.6` tag,
> [docs.astral.sh](https://docs.astral.sh/ruff/formatter/#configuration)), *Configuring Ruff* default configuration block
> ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)), and the settings reference generated from `options.rs` at the tag —
> [`line-length`](https://docs.astral.sh/ruff/settings/#line-length), [`indent-width`](https://docs.astral.sh/ruff/settings/#indent-width),
> [`format.quote-style`](https://docs.astral.sh/ruff/settings/#format_quote-style), [`format.nested-string-quote-style`](https://docs.astral.sh/ruff/settings/#format_nested-string-quote-style),
> [`format.indent-style`](https://docs.astral.sh/ruff/settings/#format_indent-style), [`format.skip-magic-trailing-comma`](https://docs.astral.sh/ruff/settings/#format_skip-magic-trailing-comma),
> [`format.line-ending`](https://docs.astral.sh/ruff/settings/#format_line-ending), [`format.preview`](https://docs.astral.sh/ruff/settings/#format_preview).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Black's pitch was that you stop arguing about style because there is nothing to configure.
ruff keeps most of that and adds a small set of dials — quote style, indentation, line endings,
trailing-comma handling, docstring code. The trap is treating them like personal preferences.
Each is applied to every file on the next `ruff format`, so changing one is a repository-wide
reformat commit, and setting one in the wrong table, the wrong file, or the wrong direction
produces churn that looks like a formatter bug. This page maps the whole surface and covers the
numbers and the quotes; indentation, trailing commas, line endings and the format-only switches
are [07f](07f-indentation-commas-and-line-endings.md).**

## The whole surface

> *"The Ruff Formatter exposes a small set of configuration options, some of which are also supported by Black (like line width), some of which are unique to Ruff (like quote, indentation style and formatting code examples in docstrings)."*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/#configuration)

The defaults, with the values the configuration page lists for 0.16.6:

```toml
[tool.ruff]
line-length = 88                        # "Same as Black."
indent-width = 4

[tool.ruff.format]
quote-style = "double"                  # Black's style
indent-style = "space"
skip-magic-trailing-comma = false       # trailing commas are honoured, as in Black
line-ending = "auto"
docstring-code-format = false           # planned to become opt-out in a future release
docstring-code-line-length = "dynamic"
```

| Setting | Table | Values | Also read by |
|---|---|---|---|
| `line-length` | `[tool.ruff]` | integer, default 88 | `E501`, isort wrapping |
| `indent-width` | `[tool.ruff]` | integer, default 4 | `E111`/`E114` indentation rules |
| `quote-style` | `[tool.ruff.format]` | `double` · `single` · `preserve` | the `Q` rules, if enabled |
| `nested-string-quote-style` | `[tool.ruff.format]` | `alternating` · `preferred` (0.15.9+) | — |
| `indent-style` | `[tool.ruff.format]` | `space` · `tab` | `W191`, `D206` |
| `skip-magic-trailing-comma` | `[tool.ruff.format]` | boolean | isort `split-on-trailing-comma` |
| `line-ending` | `[tool.ruff.format]` | `auto` · `lf` · `cr-lf` · `native` | — |
| `docstring-code-format`, `docstring-code-line-length` | `[tool.ruff.format]` | boolean; `"dynamic"` or integer | — ([07g](07g-docstring-and-markdown-code.md)) |
| `exclude` | `[tool.ruff.format]` | glob list | — |
| `preview` | `[tool.ruff.format]` | boolean | — |

The last column is why several of these belong to [08 · formatter/lint conflicts](08-formatter-lint-conflicts.md)
as much as to this page: the formatter and some lint rules read the same setting and must agree.

## `line-length` and `indent-width` are shared

> *"The line length to use when enforcing long-lines violations (like `E501`) and at which `isort` and the formatter prefers to wrap lines."*
> — [settings: `line-length`](https://docs.astral.sh/ruff/settings/#line-length)

They sit in `[tool.ruff]`, not `[tool.ruff.format]`, because the linter uses the same numbers:
one `line-length` drives where the formatter wraps, where isort wraps a long `from` import, and
where `E501` reports. Keep them in one place. The formatter treats the number as a target, not a
bound — *"it isn't a hard upper bound, and formatted lines may exceed the `line-length`"* — and
a one-off run can override it with `ruff format --line-length 100`.

## `quote-style`

Three values. `double` is the default and Black's style; `single` flips it; `preserve` leaves
every string alone. Two documented exceptions apply to `double` and `single`:

> *"Ruff deviates from using the configured quotes if doing so prevents the need for escaping quote characters inside the string"*

> *"Ruff prefers double quotes for triple quoted strings and docstrings even when using `quote-style = "single"`."*
> — [settings: `format.quote-style`](https://docs.astral.sh/ruff/settings/#format_quote-style)

```python
# With quote-style = "single", per the rules above:
greeting = "hello"             # becomes single-quoted
reply = "It's overdue"         # keeps double quotes: single would need an escape
query = """SELECT id FROM invoice"""  # triple-quoted strings keep double quotes


def total(invoice):
    """Return the invoice total."""  # docstrings keep double quotes
    return sum(line.amount for line in invoice.lines)
```

`preserve` exists for codebases that were never normalised — typically a migration from Black
run with string normalisation turned off: *"The quote style `preserve` leaves the quotes of all
strings unchanged."*

### `nested-string-quote-style`

Added in 0.15.9, for string literals nested inside f-string replacement fields. The default,
`alternating`, gives a nested literal the opposite quote from its enclosing f-string — the
`f"test{inner + 'nested_string'}"` example in [07d](07d-layout-deviations-from-black.md). The
other value is `preferred`; the reference lists the two values, and the description here —
`preferred` applies the configured quote style to nested literals too — follows from the name and
from the version gate: *"Note: This setting has no effect when targeting Python versions below
3.12."* Reusing the enclosing quote inside an f-string only became legal syntax in 3.12.

## Gotchas

**★ Symptom: `quote-style = "single"` is set, yet some strings and every docstring stay
double-quoted.** Cause: two documented exceptions — ruff keeps the other quote when switching
would need an escape, and it prefers double quotes for triple-quoted strings and docstrings
regardless. Fix: nothing to fix in the formatter; if a lint rule demands single-quoted docstrings,
that rule conflicts with the formatter (`Q002`, `D300`) and should be ignored.

```toml
[tool.ruff.lint]
ignore = ["Q002"]
```

**Symptom: one subpackage formats with double quotes and 88 columns while the rest of the
repository uses single quotes and 100.** Cause: the subpackage has its own `ruff.toml` (or a
`pyproject.toml` with a `[tool.ruff]` table), and ruff uses the closest configuration without
merging parents ([02](02-configuration-discovery.md)) — so the formatter settings there are the
defaults. Fix: inherit the root.

```toml
# packages/reports/ruff.toml
extend = "../../pyproject.toml"
```

**Symptom: `quote-style = "preserve"` was adopted "temporarily" after a migration, and a year
later the codebase is still half single, half double.** Cause: `preserve` means the formatter
never normalises quotes again. Fix: when the team is ready, switch to `double` and land the
normalisation as a single reformat commit.

```toml
[tool.ruff.format]
quote-style = "double"
```

## Interview questions

**★ Why does ruff sometimes ignore the configured `quote-style`?**
Two documented cases. It will not switch quotes if that would require escaping a quote inside
the string, and it prefers double quotes for triple-quoted strings and docstrings even with
`quote-style = "single"`. `preserve` is the only value that never changes a quote.

**Why are `line-length` and `indent-width` top-level settings rather than formatter settings?**
Because the linter reads them too. `line-length` sets where the formatter and isort wrap and
where `E501` reports; `indent-width` is what the indentation rules check. Putting them in one
place stops the formatter and linter from disagreeing about the same number.

**When would you choose `quote-style = "preserve"`?**
When normalising quotes is not yet acceptable — most often a migration from Black that ran
without string normalisation, where switching to `double` would touch a large fraction of lines
at once. It should be a transition state, because under `preserve` quotes are never normalised
and new code keeps adding both styles.

**Why does the formatter expose so few options?**
Because its target is Black compatibility, and Black's value comes from having nearly no
choices. The documentation: *"Given the focus on Black compatibility (and unlike formatters like
YAPF), Ruff does not currently expose any other configuration options."* Every option multiplies
the styles the formatter must support and the arguments a team can have.

---

← Prev: [07d · Layout deviations from Black](07d-layout-deviations-from-black.md) · [Topic index](README.md) · Next → [07f · Indentation, commas and line endings](07f-indentation-commas-and-line-endings.md)
