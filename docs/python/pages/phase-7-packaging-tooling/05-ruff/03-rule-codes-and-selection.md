---
title: "A rule selector is a prefix match over Flake8-style codes; `select` replaces the rule set while `extend-select` adds to it, specificity rather than order decides every clash between selecting and ignoring, and the command line outranks every file"
sidebar_label: "03 · Rule codes and selection"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Rule selection* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#rule-selection)),
> the settings reference for [`lint.select`](https://docs.astral.sh/ruff/settings/#lint_select),
> [`lint.extend-select`](https://docs.astral.sh/ruff/settings/#lint_extend-select), [`lint.ignore`](https://docs.astral.sh/ruff/settings/#lint_ignore)
> and [`lint.extend-ignore`](https://docs.astral.sh/ruff/settings/#lint_extend-ignore), the *FAQ*
> ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)); resolution order and warning templates read in
> `crates/ruff_workspace/src/configuration.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_workspace/src/configuration.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Every ruff rule has a code like `F401` — a prefix naming the tool it came from, then digits —
and every rule-selection setting takes prefixes of those codes: `F`, `F4`, `F401` all work.
Three settings do the work. `select` *replaces* the active set, `extend-select` *adds* to it,
`ignore` *removes* from it. When they disagree about a rule, ruff does not look at which line
came last; it looks at which selector was more specific, and on a tie `ignore` wins. And every
flag you pass on the command line overrides every file ruff found. Learn those four sentences
and every rule-selection surprise becomes predictable.**

## Anatomy of a code

> *"Ruff's linter mirrors Flake8's rule code system, in which each rule code consists of a one-to-three letter prefix, followed by three digits (e.g., `F401`). The prefix indicates that "source" of the rule (e.g., `F` for Pyflakes, `E` for pycodestyle, `ANN` for flake8-annotations)."*
> — [The Ruff Linter](https://docs.astral.sh/ruff/linter/)

> *"Rule selectors like `lint.select` and `lint.ignore` accept either a full rule code (e.g., `F401`) or any valid prefix (e.g., `F`)."*

| Selector | Matches |
|---|---|
| `F` | every pyflakes rule |
| `F4` | `F401`, `F402`, `F403`, … |
| `F401` | exactly `unused-import` |
| `B` | flake8-bugbear |
| `UP` | pyupgrade |
| `PL` / `PLE` / `PLR0913` | all Pylint ports / its error rules / one rule |
| `ALL` | every stable rule (not preview, not deprecated) — see [03b](03b-the-default-rule-set.md) before using it |

Two commands turn a code into an explanation without leaving the terminal: `ruff rule F401`
prints a rule's documentation, and `ruff linter` lists every re-implemented tool with its
prefix.

## `select` replaces, `extend-select` adds, `ignore` removes

The settings reference is blunt about the difference that causes most confusion:

> *"Unlike `select`, which replaces the default rule set when specified, `extend-select` adds to whatever rules are already active. This makes `extend-select` the preferred option when you want to enable additional rules on top of the defaults without having to enumerate them."*
> — [settings: `lint.extend-select`](https://docs.astral.sh/ruff/settings/#lint_extend-select)

> *"Using `select = ["B"]` instead would replace the defaults, enabling only flake8-bugbear."*

The linter page's own advice leans the other way for a project that wants to be deliberate:

> *"Prefer `lint.select` over `lint.extend-select` to make your rule set explicit."*

Both are right, for different projects. `extend-select` means "ruff's defaults plus these" —
and ruff's defaults change between minors ([03b](03b-the-default-rule-set.md)). `select` means
"exactly these", which is stable across upgrades and the only form a reviewer can read without
knowing which ruff version is installed.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "B", "UP", "I", "SIM"]   # explicit and upgrade-stable
ignore = ["E501"]                                          # the formatter owns line length
```

`extend-ignore` still parses, but is deprecated: *"This option is deprecated because it is now
interchangeable with `ignore`."* · *"Ruff now merges both `ignore` and `extend-ignore` into a
single set, so the distinction no longer applies."*

## Specificity decides, and `ignore` breaks ties

> *"When breaking ties between enabled and disabled rules (via `select` and `ignore`, respectively), more specific prefixes override less specific prefixes. `ignore` takes precedence over `select` if the same prefix appears in both."*
> — [settings: `lint.select`](https://docs.astral.sh/ruff/settings/#lint_select)

In the 0.16.6 source this is literal: within one configuration, ruff walks the selectors from
least to most specific, and at each level applies the selecting ones and then the ignoring
ones. Consequences, worked:

```toml
[tool.ruff.lint]
select = ["E", "F"]
ignore = ["E5"]            # drops E501 and the rest of E5…
extend-select = ["E501"]   # …but E501 is more specific than E5, so E501 is back on
```

```toml
[tool.ruff.lint]
select = ["UP"]
ignore = ["UP"]            # same specificity: ignore wins, no UP rule runs
```

The linter page places categories (preview only, below) in the same ladder:

> *"`ALL < category < linter group < linter prefix < rule`"*

## The command line outranks every file

> *"In those scenarios, Ruff uses the "highest-priority" `select` as the basis for the rule set, and then applies `extend-select` and `ignore` adjustments. CLI options are given higher priority than `pyproject.toml` options, and the current `pyproject.toml` file is given higher priority than any inherited `pyproject.toml` files."*

Given `select = ["E", "F"]` and `ignore = ["F401"]` in the file:

> *"Running `ruff check --select F401` would result in Ruff enforcing `F401`, and no other rules."*
> *"Running `ruff check --extend-select B` would result in Ruff enforcing the `E`, `F`, and `B` rules, with the exception of `F401`."*

That makes `--select` on the command line a scalpel for one-off work — run one rule across the
codebase, fix it, stop — and a trap in CI scripts, where it silently discards the project's
selection.

## Renamed, deprecated and removed codes

Codes move. When ruff remaps one, selecting the old code still works and warns; the 0.16.6
message template is ``` `{from}` has been remapped to `{prefix}{code}`. ``` — the flake8-type-
checking prefix changing from `TCH` to `TC` in 0.8.0 is the example you will meet in older
configurations. Deprecated rules warn (``Rule `{code}` is deprecated and will be removed in a
future release.``), and a rule that has been *removed* is an error when selected by its exact
code: ``Rule `{code}` was removed and cannot be selected.`` `E999` (`syntax-error`) is the
classic case — removed in 0.8.0 because *"Syntax errors will always be shown regardless of
whether this rule is selected or not."* Upgrading through these is **14** *(not written yet)*.

## Names and categories are preview-only in 0.16.6

Two newer ways of selecting exist but require preview ([04](04-preview-mode.md)):

- **Rule names.** *"When preview mode is enabled, rule selectors also accept the human-readable
  name of a rule (e.g., `unused-import`)."* (added in preview in 0.15.20).
- **Categories** — `correctness`, `suspicious`, `complexity`, `performance`, `style`,
  `security`, `formatting`, `pedantic`, `restriction` — introduced in preview in **0.16.5**. The
  docs add a forward-looking warning: *"Note that we plan to deprecate and eventually remove the
  linter groups in the future."* Nothing is deprecated in 0.16.6; treat it as a signal that
  selectors like `B` and `UP` may change shape in a later minor.

## Gotchas

**★ Symptom: after adding `select = ["B"]` to get bugbear, pyflakes stopped reporting unused
imports and undefined names.** Cause: `select` *"replaces the default rule set"* — the project
now runs bugbear and nothing else. Fix: add instead of replace, or list everything you want.

```toml
[tool.ruff.lint]
extend-select = ["B"]                          # defaults + bugbear
# or, explicitly: select = ["E4", "E7", "E9", "F", "B"]
```

**★ Symptom: a CI script runs `ruff check --select E501 .` to "also check line length" and the
job now passes code full of unused imports.** Cause: a command-line `--select` becomes the
highest-priority basis — *"enforcing `F401`, and no other rules"* in the docs' own example. Fix:
use `--extend-select` on the command line, or move the rule into the file.

```bash
uv run ruff check --extend-select E501 .
```

**Symptom: a rule you listed in `ignore` still fires.** Cause: a more specific selector enabled
it — `ignore = ["E5"]` loses to `extend-select = ["E501"]`, because *"more specific prefixes
override less specific prefixes."* Fix: ignore at the same or greater specificity as the
selector that enables it.

```toml
[tool.ruff.lint]
extend-select = ["E501"]
ignore = ["E501"]   # same specificity: ignore wins — or simply drop E501 from extend-select
```

**Symptom: `select = ["TCH"]` in an old configuration prints a remapping warning on every
run.** Cause: the prefix was renamed to `TC` in 0.8.0; the old spelling is redirected with a
warning. Fix: use the current code.

```toml
[tool.ruff.lint]
extend-select = ["TC"]
```

**Symptom: ruff exits with code `2` and ``Rule `E999` was removed and cannot be selected.``
after an upgrade.** Cause: the configuration selects a removed rule by its exact code, which is
an error, not a warning. Fix: delete the selector; for `E999`, syntax errors are reported
regardless.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F"]   # the E9 prefix is fine; the exact removed code is not
```

**Symptom: `select = ["unused-import"]` makes ruff refuse the configuration.** Cause: rule
names are accepted as selectors only in preview mode in 0.16.6. The error template in the
0.16.6 source reads ``Invalid selector `{selector}` … Selecting rules by name requires preview
mode`` — and the same shape, ending *"Selecting rules by category requires preview mode"*, greets
`select = ["correctness"]`. Fix: use the code, or enable lint preview if you want names.

```toml
[tool.ruff.lint]
select = ["F401"]
```

**Symptom: `ignore` and `extend-ignore` both appear in a config inherited through `extend`, and
someone is unsure which ignores survive.** Cause: historically `ignore` replaced the inherited
list while `extend-ignore` added to it; that distinction is gone. Fix: use `ignore` only — ruff
*"now merges both `ignore` and `extend-ignore` into a single set"*.

```toml
[tool.ruff.lint]
ignore = ["E501", "B008"]
```

## Interview questions

**★ What is the difference between `select` and `extend-select`, and which should a project
use?**
`select` replaces the active rule set with exactly what it lists; `extend-select` adds to
whatever is already active — ruff's defaults, or an inherited configuration. A project that
wants its rule set to be readable in one place and unchanged by upgrades should use `select`,
which is also what the linter documentation recommends. `extend-select` is the right tool in a
child configuration that inherits a parent's selection through `extend`, and for "defaults plus
one plugin" in a small project that accepts that the defaults move between ruff minors.

**★ `select = ["E"]`, `ignore = ["E5"]`, `extend-select = ["E501"]` — is `E501` on?**
Yes. ruff resolves clashes by specificity, not by the order of keys: `E501` is a full code,
more specific than the `E5` prefix, so its selection overrides the prefix's ignore. The tie rule
only applies at equal specificity — `ignore = ["E501"]` beside `extend-select = ["E501"]` would
turn it off, because `ignore` wins ties.

**What does `ruff check --select F401` do to the rules in `pyproject.toml`?**
It replaces them for that run. Command-line options have higher priority than configuration
files, and a CLI `select` becomes the basis of the rule set, so only `F401` is enforced. That is
useful for a focused clean-up — select one rule, fix it everywhere, done — and harmful in CI,
where it silently narrows the check. `--extend-select` is the additive form.

**How does ruff handle a rule code that was renamed or removed?**
A remapped code is redirected to its new name with a warning, so old configurations keep
working until someone updates them. A deprecated rule warns that it will be removed. A removed
rule selected by its exact code is a hard error that stops ruff, while a prefix that merely
covers a removed rule — `E9` covering the removed `E999` — is fine. Removals happen only in
minor releases under ruff's versioning policy, which is one reason to read a minor's changelog
before upgrading.

**What is the precedence ladder between `ALL`, categories, linter groups, prefixes and rules?**
From broadest to narrowest: `ALL`, then a category (preview only), then a linter group, then a
linter prefix, then a single rule. A narrower selector overrides a broader one, so you can
select broadly and carve out exceptions — `select = ["ALL"]` with `ignore = ["D"]`, or a preview
category with one rule re-enabled by code.

---

← Prev: [02b · Overrides and inspection](02b-config-overrides-and-inspection.md) · [Topic index](README.md) · Next → [03b · The default rule set](03b-the-default-rule-set.md)
