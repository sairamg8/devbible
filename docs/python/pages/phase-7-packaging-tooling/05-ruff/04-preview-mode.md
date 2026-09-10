---
title: "Preview is ruff's staging area — new rules, fixes, formatter styles and selectors ship there first, can change or disappear in any patch release, and cannot be selected at all until preview is on, which is why selecting a preview rule without it produces a warning and nothing else"
sidebar_label: "04 · Preview mode"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Preview* ([docs.astral.sh](https://docs.astral.sh/ruff/preview/)),
> *Versioning* ([docs.astral.sh](https://docs.astral.sh/ruff/versioning/)), settings reference for [`preview`](https://docs.astral.sh/ruff/settings/#preview),
> [`lint.preview`](https://docs.astral.sh/ruff/settings/#lint_preview), [`format.preview`](https://docs.astral.sh/ruff/settings/#format_preview)
> and [`lint.explicit-preview-rules`](https://docs.astral.sh/ruff/settings/#lint_explicit-preview-rules); warning templates read in
> `crates/ruff_workspace/src/configuration.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_workspace/src/configuration.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**ruff has two tiers of behaviour. Stable behaviour changes only in minor releases and only in
the ways the versioning policy lists. Preview behaviour is everything that has not earned that
promise yet — new rules, new fixes, formatter style experiments, new selector syntax — and it
can change in any release, including a patch. The mechanism that keeps the two apart is strict:
a preview rule cannot be selected unless preview is on, not by its exact code, not by its
prefix, not by `ALL`. Preview is also split in two, one switch for the linter and one for the
formatter, and turning on the wrong one is the usual way people get formatting changes they did
not ask for.**

## What preview is, in the project's words

> *"Ruff includes an opt-in preview mode to provide an opportunity for community feedback and increase confidence that changes are a net-benefit before enabling them for everyone."*

> *"Preview mode enables a collection of unstable features such as new lint rules and fixes, formatter style changes, interface updates, and more. Warnings about deprecated features may turn into errors when using preview mode."*
> — [Preview](https://docs.astral.sh/ruff/preview/)

And the clause from the versioning page that decides whether you should build CI on it:

> *"The preview mode is not intended to gate access to work that is incomplete or features that we are likely to remove. However, **we reserve the right to make changes to any behavior gated by the mode** including the removal of preview features or rules."*
> — [Versioning](https://docs.astral.sh/ruff/versioning/)

The same page lists what may change in a **patch** release: *"A rule is added in preview"*,
*"The behavior of a preview rule is changed"*, *"The scope of a rule is increased in preview"*,
*"A safe fix for a rule is added in preview"*, and for the formatter *"The preview style
changed"*. A build that enables preview and floats even the patch version can change without
anyone touching the repository.

## Two switches

> *"Preview mode can be enabled with the `--preview` flag on the CLI or by setting `preview = true` in your Ruff configuration file."*

> *"Preview mode can be configured separately for linting and formatting."*

```toml
[tool.ruff]
preview = true            # both tools — rarely what you want

[tool.ruff.lint]
preview = true            # unstable rules and fixes only

[tool.ruff.format]
preview = true            # unstable formatting style only
```

The settings reference words them differently for a reason: top-level preview makes ruff
*"use unstable rules, fixes, and formatting"*; `lint.preview` uses *"unstable rules and fixes"*;
`format.preview` enables *"the unstable preview style formatting"*.

## A preview rule is invisible until preview is on

> *"If a rule is marked as preview, it can only be selected if preview mode is enabled."*

The page walks a hypothetical rule `HYP001` through every way of selecting it — by exact code,
by the `HYP` prefix, by `ALL` — and each time: it *"would not be enabled"*. Then:

> *"However, it would be enabled in any of the above cases if you enabled preview mode"*

Without preview, ruff does not error on the selection. The 0.16.6 source records it and prints
a warning from this template: ``Selection `{code}` has no effect because preview is not
enabled.`` A warning is easy to miss in CI logs, which is how a team ends up believing a rule
is enforced when it has never run.

```toml
[tool.ruff.lint]
preview = true
extend-select = ["E203"]   # whitespace-before-punctuation: "Preview (since v0.0.269)" in the rule docs
```

## Opting in one rule at a time

With preview on, prefixes pull in *every* matching preview rule:

> *"When preview mode is enabled, selecting rule categories or prefixes will include all preview rules that match. If you'd prefer to opt in to each preview rule individually, you can toggle the `explicit-preview-rules` setting in your configuration file"*

```toml
[tool.ruff.lint]
preview = true
explicit-preview-rules = true
select = ["E", "F", "B", "E203"]   # E and B stay stable-only; E203 opted in by exact code
```

> *"In our previous example, `--select` with `ALL` `HYP`, `HYP0`, or `HYP00` would not enable `HYP001`. Each preview rule will need to be selected with its exact code"* · *"If preview mode is not enabled, this setting has no effect."*

## Preview is stricter about deprecated rules

> *"When preview mode is enabled, deprecated rules will be disabled. If a deprecated rule is selected explicitly, an error will be raised. Deprecated rules will not be included if selected via a rule category or prefix."*

In the 0.16.6 source the two behaviours are literally side by side: without preview, a
deprecated selection warns (``Rule `{code}` is deprecated and will be removed in a future
release.``); with preview, it is an error (``Selection of deprecated rule `{code}` is not
allowed when preview is enabled.``). Turning preview on is therefore a good way to find out what
your configuration will break on in the next minor.

## What sits behind preview in 0.16.6

Not exhaustive — check a rule's page for its 🧪 marker — but the items this topic touches:

| Behind preview | Where it is covered |
|---|---|
| Rule names as selectors (`unused-import`) and in suppression comments | [03](03-rule-codes-and-selection.md), [06b](06b-ruff-ignore-and-range-suppressions.md) |
| Rule categories (`correctness`, `suspicious`, …) — new in 0.16.5 | [03](03-rule-codes-and-selection.md) |
| `F401` fixes in `__init__.py` files | [05](05-fixes-and-fix-safety.md) |
| The fluent method-chain layout in the formatter | [07d](07d-layout-deviations-from-black.md) |
| Discovery of `*.pyw` files | [02](02-configuration-discovery.md) |
| New rules added in 0.16.x, e.g. `UP048` (0.16.3) | the rules index |

## Gotchas

**★ Symptom: a rule is in `extend-select`, nobody has ever seen it fire, and the log shows
``Selection `…` has no effect because preview is not enabled.``** Cause: it is a preview rule,
and preview rules *"can only be selected if preview mode is enabled"*. Fix: enable lint preview —
and opt in explicitly so nothing else sneaks in — or wait for the rule to stabilise.

```toml
[tool.ruff.lint]
preview = true
explicit-preview-rules = true
extend-select = ["E203"]
```

**★ Symptom: enabling preview to try one lint rule reformatted method chains across the
codebase.** Cause: `preview = true` was set in the top-level `[tool.ruff]` table, which covers
the formatter's preview style too. Fix: scope it to the linter.

```toml
[tool.ruff.lint]
preview = true
```

**★ Symptom: CI broke after a *patch* upgrade even though your configuration did not change.**
Cause: preview behaviour can change in patch releases — *"The behavior of a preview rule is
changed"* and *"The preview style changed"* are both patch-level. Fix: pin ruff exactly whenever
preview is on, and treat a patch bump as a change to review.

```toml
[dependency-groups]
dev = ["ruff==0.16.6"]
```

**Symptom: `select = ["B"]` with preview on suddenly reports rules nobody chose.** Cause:
*"selecting rule categories or prefixes will include all preview rules that match"*. Fix:
require exact codes for preview rules.

```toml
[tool.ruff.lint]
preview = true
explicit-preview-rules = true
```

**Symptom: turning preview on makes ruff refuse to start, naming a deprecated rule.** Cause: in
preview, explicitly selecting a deprecated rule *"will raise an error"*, where stable mode only
warns. Fix: remove the deprecated selector — the error is telling you what the next minor may
remove.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "B"]   # deprecated code deleted
```

**Symptom: a pull request adds `--preview` to the CI command "to get the new rule", and local
runs disagree with CI.** Cause: preview on the command line applies only where that command
runs; editors and pre-commit read the configuration file. Fix: put preview in the committed
configuration so every consumer sees it.

```toml
[tool.ruff.lint]
preview = true
```

## Interview questions

**★ What is preview mode, and would you enable it in CI?**
It is the opt-in tier for unstable ruff behaviour: new rules, new fixes, formatter style
changes and new interfaces, released for feedback before they are promoted. Its contract is
weaker than stable — ruff reserves the right to change any preview behaviour, including removing
it, and several kinds of preview change are allowed in patch releases. I would enable lint
preview in CI only with an exact version pin and explicit preview-rule selection, so every
change is a reviewed version bump and only chosen rules run; I would rarely enable formatter
preview, because its whole output can change between patches.

**★ Why does selecting a preview rule without preview only warn instead of failing?**
Because selection is resolved against the running version's rule table: a preview rule simply
contributes nothing when preview is off, and ruff records that the selector matched nothing and
warns ``Selection `…` has no effect because preview is not enabled.`` The practical danger is
that a warning in a busy CI log is easy to miss, so a team can believe a rule is enforced when
it has never run. Checking `ruff check --show-settings` for the enabled rule list is the way to
be sure.

**What does `explicit-preview-rules` change?**
With preview on, prefixes and categories normally include every matching preview rule. With
`explicit-preview-rules = true`, preview rules are enabled only by their exact code, so
`select = ["B"]` keeps bugbear to its stable rules and you opt in to each preview rule by its
exact code. It has no effect when preview is off.

**How do preview and deprecation interact?**
Preview is stricter. In stable mode, selecting a deprecated rule warns that it will be removed.
In preview, deprecated rules are disabled, selecting one explicitly is an error, and prefixes and
categories skip them. That makes a preview run a cheap way to see what your configuration will
fail on once the deprecations become removals in a later minor.

---

← Prev: [03c · per-file-ignores](03c-per-file-ignores.md) · [Topic index](README.md) · Next → [05 · Fixes and fix safety](05-fixes-and-fix-safety.md)
