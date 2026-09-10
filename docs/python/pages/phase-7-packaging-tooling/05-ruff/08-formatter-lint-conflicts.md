---
title: "A handful of lint rules enforce a style the formatter already owns — indentation, quotes, trailing commas — and with them selected the formatter and the fixer undo each other forever; none is in the default set, `ruff format` warns about the ones it can detect, and `E501` is the special case that is compatible but not guaranteed"
sidebar_label: "08 · Formatter/lint conflicts"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Conflicting lint rules* (raw Markdown at the `0.16.6` tag,
> [docs.astral.sh](https://docs.astral.sh/ruff/formatter/#conflicting-lint-rules)), the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)),
> rule pages for [`missing-trailing-comma` (COM812)](https://docs.astral.sh/ruff/rules/missing-trailing-comma/),
> [`line-too-long` (E501)](https://docs.astral.sh/ruff/rules/line-too-long/) and
> [`single-line-implicit-string-concatenation` (ISC001)](https://docs.astral.sh/ruff/rules/single-line-implicit-string-concatenation/),
> settings reference for [`lint.pycodestyle.max-line-length`](https://docs.astral.sh/ruff/settings/#lint_pycodestyle_max-line-length);
> the warning logic in `crates/ruff/src/commands/format.rs` (`warn_incompatible_formatter_settings`) at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff/src/commands/format.rs)); the 0.9.0 [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entry.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**The linter and the formatter share a binary and a config file, and the documentation states
the contract between them: correctly configured, *formatting never introduces a lint error*. The
contract has a precondition. Some lint rules predate formatters and enforce a layout of their own
— an indentation width, a quote character, a trailing comma — and where that layout differs from
the formatter's, one tool's output is the other tool's violation: the fixer inserts what the
formatter would not have written, the formatter re-lays-out what the fixer produced, and a
pre-commit run keeps modifying files. None of these rules is in the
default set; they arrive with `select = ["ALL"]`, with whole prefixes like `Q`, `COM`, `W` or `D`,
or with a configuration copied from a flake8 setup. The fix is always the same — the formatter
owns layout, so the rule goes in `ignore` — and `E501` is the one rule that needs a decision
instead.**

## The contract

> *"Ruff's formatter is designed to be used alongside the linter. However, the linter includes some rules that, when enabled, can cause conflicts with the formatter, leading to unexpected behavior. When configured appropriately, the goal of Ruff's formatter-linter compatibility is such that running the formatter should never introduce new lint errors."*
> — [The Ruff Formatter: Conflicting lint rules](https://docs.astral.sh/ruff/formatter/#conflicting-lint-rules)

That sentence is what makes the recommended order safe — `ruff check --fix`, then `ruff format`,
then a final `ruff check` that should find nothing the formatter caused ([01b](01b-check-and-format-are-two-tools.md)).
It is also why the default rule set leaves these rules out. The FAQ:

> *"Ruff is designed to be used alongside a formatter (like Ruff's own formatter, or Black) and, as such, will defer implementing stylistic rules that are obviated by automated formatting."*

## The list, grouped by what the formatter owns

The formatter page's list for 0.16.6, verbatim codes and names, grouped by the thing both tools
try to control:

| Owned by the formatter | Conflicting rules |
|---|---|
| **Indentation** | `tab-indentation` (`W191`) · `indentation-with-invalid-multiple` (`E111`) · `indentation-with-invalid-multiple-comment` (`E114`) · `over-indented` (`E117`) · `docstring-tab-indentation` (`D206`) |
| **Quotes** | `bad-quotes-inline-string` (`Q000`) · `bad-quotes-multiline-string` (`Q001`) · `bad-quotes-docstring` (`Q002`) · `avoidable-escaped-quote` (`Q003`) · `unnecessary-escaped-quote` (`Q004`) · `triple-single-quotes` (`D300`) |
| **Trailing commas** | `missing-trailing-comma` (`COM812`) · `prohibited-trailing-comma` (`COM819`) |
| **Blank lines** | `incorrect-blank-line-before-class` (`D203`) |
| **String concatenation** | `multi-line-implicit-string-concatenation` (`ISC002`) — *"if used without `ISC001` and `flake8-implicit-str-concat.allow-multiline = false`"* |

> *"None of the above are included in Ruff's default configuration. However, if you've enabled any of these rules or their parent categories (like `Q`), we recommend disabling them via the linter's `lint.ignore` setting."*

The trailing-comma pair is the one most projects meet, because `select = ["ALL"]` brings
`COM812` in. Its rule page is blunt:

> *"We recommend against using this rule alongside the formatter. The formatter enforces consistent use of trailing commas, making the rule redundant."*
> — [`missing-trailing-comma` (COM812)](https://docs.astral.sh/ruff/rules/missing-trailing-comma/)

The configuration that follows from the list, for a project that selects broadly:

```toml
[tool.ruff.lint]
select = ["ALL"]
ignore = [
    # indentation — the formatter owns it
    "W191", "E111", "E114", "E117", "D206",
    # quotes — the formatter owns them
    "Q000", "Q001", "Q002", "Q003", "Q004", "D300",
    # trailing commas — the formatter owns them
    "COM812", "COM819",
    # blank line before a class docstring — conflicts with the formatter (and with D211)
    "D203",
    # multi-line implicit concatenation, when combined with allow-multiline = false
    "ISC002",
]
```

Listing all of them is harmless: a rule that the rest of the configuration would not have
selected is simply not enabled twice. What matters is that every code you *do* select from this
list ends up ignored.

## How ruff tells you: the format-time warning

> *"When an incompatible lint rule or setting is enabled, `ruff format` will emit a warning. If your `ruff format` is free of warnings, you're good to go!"*

The warning comes from **`ruff format`**, not `ruff check` — a project that only lints in CI never
sees it. In the 0.16.6 source the message for a conflicting rule reads:

> *"The following rule may cause conflicts when used with the formatter: \{rule\}. To avoid unexpected behavior, we recommend disabling this rule, either by removing it from the `lint.select` or `lint.extend-select` configuration, or adding it to the `lint.ignore` configuration."*

The same source shows that most warnings are *conditional* — they fire only when the rule and
the formatter settings actually disagree:

| Rule | Warned when (0.16.6 source) |
|---|---|
| `COM812`, `D203` | always, whenever enabled |
| `W191`, `D206` | the formatter indents with tabs |
| `E111`, `E114` | `indent-width` is not 4 |
| `Q000`, `Q003` | the flake8-quotes preference differs from `format.quote-style` |
| `Q001`, `Q002` | conditionally, on their multiline-string and docstring quote settings — the exact condition was not settled by the source read for this page |
| `ISC002` | `allow-multiline = false` without `ISC001` |

⚠️ So "no warning" means "no conflict ruff detected with your *current* settings" — not that the
rule is harmless. `W191` is silent while you indent with spaces and starts warning the day
someone sets `indent-style = "tab"`. The documentation's recommendation is broader than the
warnings: ignore the rules on the list whether or not they currently warn.

## `E501`: compatible, not guaranteed

`E501` is not on the list — it can be used with the formatter — but the page qualifies it:

> *"While the `line-too-long` (`E501`) rule can be used alongside the formatter, the formatter only makes a best-effort attempt to wrap lines at the configured `line-length`. As such, formatted code may exceed the line length, leading to `line-too-long` (`E501`) errors."*

The formatter cannot split a long string literal, a long URL in a comment, or a long identifier;
those lines stay long, and `E501` reports them. It is not in the 0.16.6 default set. The three
reasonable positions:

**1. Leave it off.** The formatter handles everything it can; what remains is usually a long
string, and a reviewer judges it. This is what the default rule set does.

**2. Enable it at the same number**, and treat each report as a line to rewrite by hand — split
the string, shorten the name — or suppress with a `noqa: E501`. Strict, and noisy on URLs and
messages.

**3. Enable it at a higher number** to catch only the lines that are *badly* too long — the ones
the formatter could not split and a human should:

> *"Use this option when you want to detect extra-long lines that the formatter can't automatically split by setting `pycodestyle.line-length` to a value larger than `line-length`."*
> — [settings: `lint.pycodestyle.max-line-length`](https://docs.astral.sh/ruff/settings/#lint_pycodestyle_max-line-length)

```toml
[tool.ruff]
line-length = 88                  # where the formatter wraps

[tool.ruff.lint]
extend-select = ["E501"]

[tool.ruff.lint.pycodestyle]
max-line-length = 120             # what the linter refuses
```

`E501` measures consistently with the formatter — width, not characters, for East Asian
characters and emoji, and it exempts lines whose overflow is a trailing pragma comment
([07c](07c-known-deviations-from-black.md)).

## `ISC001` is no longer a conflict

Older guides — and many configurations copied from them — say to ignore `ISC001`
(`single-line-implicit-string-concatenation`) when using the formatter. That was true until
ruff's 2025 style. The 0.9.0 changelog lists *"Automatically join an implicitly concatenated
string into a single string literal if it fits on a single line"* and *"Remove the `ISC001`
incompatibility warning"*: the formatter now merges `"a" "b"` into `"ab"` when it fits, which is
exactly what `ISC001` asks for. `ISC001` is absent from the 0.16.6 list. A `"ISC001"` in an
`ignore` list with a "conflicts with formatter" comment is stale; re-enable it if you want it.

Continues in [08b · isort settings and the fix/format loop](08b-isort-settings-and-the-fix-format-loop.md).

## Gotchas

**★ Symptom: `ruff format` prints *"The following rule may cause conflicts when used with the
formatter: `COM812`"*.** Cause: `COM812` is selected — usually through `select = ["ALL"]` or a
`COM` prefix — and the formatter already manages trailing commas. Fix: ignore it, as the rule's
own page recommends.

```toml
[tool.ruff.lint]
ignore = ["COM812"]
```

**★ Symptom: `E501` fires on code that `ruff format` just formatted.** Cause: the formatter's
line length is a best-effort target; long strings, URLs and names cannot be split. Fix: choose a
policy — leave `E501` off, suppress individual lines, or set the lint limit above the formatter's
so it catches only what a human must fix.

```toml
[tool.ruff.lint.pycodestyle]
max-line-length = 120
```

**★ Symptom: CI only runs `ruff check`, a conflicting rule is selected, and nobody ever sees a
warning.** Cause: the conflict warning is emitted by `ruff format`, not by `ruff check`. Fix: run
`ruff format --check` in CI too — it is also the gate that proves the code is formatted.

```bash
uv run ruff check . && uv run ruff format --check .
```

**Symptom: the configuration has quoted `Q000` for years without a warning; after someone set
`quote-style = "single"`, `ruff format` starts warning and every string is a `Q000` violation.**
Cause: the `Q000`/`Q003` warning is conditional on the flake8-quotes preference disagreeing with
the formatter's quote style — the conflict existed in principle all along. Fix: ignore the quote
rules and let the formatter own quotes.

```toml
[tool.ruff.lint]
ignore = ["Q000", "Q001", "Q002", "Q003", "Q004"]
```

**Symptom: setting `indent-width = 2` made `E111` and `E114` report every indented line.**
Cause: those rules expect indentation in multiples of four; the formatter now produces two.
Fix: ignore them — indentation is the formatter's job.

```toml
[tool.ruff.lint]
ignore = ["E111", "E114", "E117"]
```

**Symptom: a configuration copied from an old blog post ignores `ISC001` "because it conflicts
with the formatter".** Cause: that conflict was removed in ruff 0.9.0, when the formatter began
joining implicit concatenations that fit on one line. Fix: delete the stale ignore if the rule is
wanted.

```toml
[tool.ruff.lint]
extend-select = ["ISC001"]
```

**Symptom: `D203` and `D211` are both selected, and ruff disables one of them.** Cause: they are
alternative docstring conventions (blank line before a class docstring, or none); ruff's
incompatible-pairs table resolves the pair by *"Ignoring `incorrect-blank-line-before-class`"* —
`D203`. And `D203` is on the formatter conflict list anyway. Fix: select only `D211`, or pick a
pydocstyle `convention` — *"Enabling a `convention` will disable any rules that are not included
in the specified convention"*, so you still select `D` and the convention prunes it.

```toml
[tool.ruff.lint]
extend-select = ["D"]

[tool.ruff.lint.pydocstyle]
convention = "google"
```

## Interview questions

**★ Which lint rules conflict with ruff's formatter, and why do they exist at all?**
Rules that enforce a layout the formatter also controls: indentation (`W191`, `E111`, `E114`,
`E117`, `D206`), quotes (`Q000`–`Q004`, `D300`), trailing commas (`COM812`, `COM819`), the blank
line before a class docstring (`D203`) and, in one configuration, multi-line implicit string
concatenation (`ISC002`). They come from flake8 plugins and pycodestyle, written for codebases
without an automatic formatter. With a formatter, they are at best redundant and at worst demand
a different layout, so the formatter's output becomes a violation.

**★ How should `E501` be handled when you use the formatter?**
Decide a policy rather than enabling it by habit. The formatter treats `line-length` as a target
and cannot split long strings, URLs or names, so `E501` at the same number reports lines the
formatter left long on purpose. The options are to leave it off (the default), enable it and
suppress or rewrite each report, or set `lint.pycodestyle.max-line-length` higher than
`line-length` so the linter only reports lines that are egregiously long.

**How does ruff tell you that a lint rule conflicts with the formatter?**
`ruff format` prints a warning naming the rule and recommending it be removed from `select` or
added to `ignore`. The warning comes only from the formatter command, and most of the checks are
conditional — `W191` only warns with tab indentation, the quote rules only when their preference
disagrees with `quote-style`. So a clean run proves there is no conflict with today's settings,
not that every listed rule is safe to keep.

**Why is `ISC001` no longer on the conflict list?**
It flags implicit string concatenation on a single line. Formatters used to create exactly that
when they collapsed a multi-line concatenation onto one line. Since ruff's 2025 style (0.9.0),
the formatter merges implicitly concatenated strings into one literal when the result fits on a
line, so formatting no longer produces `ISC001` violations, and the incompatibility warning was
removed.

**Why does ruff's default rule set not include these rules?**
Because ruff is designed to run alongside a formatter and, in the FAQ's words, *"will defer
implementing stylistic rules that are obviated by automated formatting."* The rules index
describes the 0.16 default set the same way: *"By default, Ruff enables rules from the `F`, `E`,
`B`, `UP`, and `RUF` categories, as well as many more, omitting any stylistic rules that overlap
with the use of a formatter, like `ruff format` or Black."* You only meet the conflicts by
selecting broadly.

---

← Prev: [07h · Format suppression comments](07h-format-suppression-comments.md) · [Topic index](README.md) · Next → [08b · isort settings and the fix/format loop](08b-isort-settings-and-the-fix-format-loop.md)
