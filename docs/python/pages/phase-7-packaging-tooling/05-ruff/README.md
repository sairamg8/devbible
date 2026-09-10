---
title: "05 · `ruff`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against ruff **0.16.6** — docs.astral.sh/ruff, the ruff CHANGELOG, ruff-pre-commit and ruff-action — see each chunk's own `> Verified:` line.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**Linter + formatter in one, rule selection, `--fix`, CI and pre-commit.**

:::caution In progress — 15 chunks written
This topic is being written. The chunks below are complete and verified; the rest of the plan,
listed under *Still to come*, is not written yet and will be linked here as each chunk lands.
:::

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · What ruff replaces](01-what-ruff-replaces.md)** | ruff is one Rust binary that re-implements flake8 and its plugins, isort, pyupgrade, autoflake, pydocstyle and Black… |
| 2 | **[01b · check and format are two tools](01b-check-and-format-are-two-tools.md)** | `ruff check` and `ruff format` share a binary and a config file and very little else — separate commands, separate… |
| 3 | **[02 · Configuration discovery](02-configuration-discovery.md)** | ruff picks one configuration file per source file — the closest one — and never merges its parents, so a nested… |
| 4 | **[02b · Overrides and inspection](02b-config-overrides-and-inspection.md)** | When the file ruff found is not the file you meant, the command line decides — `--config` either replaces discovery… |
| 5 | **[03 · Rule codes and selection](03-rule-codes-and-selection.md)** | A rule selector is a prefix match over Flake8-style codes; `select` replaces the rule set while `extend-select` adds… |
| 6 | **[03b · The default rule set](03b-the-default-rule-set.md)** | ruff 0.16.0 grew the default rule set from 59 rules to 413 and dropped 18 old ones, so "no `select` in the config"… |
| 7 | **[03c · per-file-ignores](03c-per-file-ignores.md)** | `per-file-ignores` is how a rule set stays strict in application code and sane in tests, migrations and scripts — a… |
| 8 | **[04 · Preview mode](04-preview-mode.md)** | Preview is ruff's staging area — new rules, fixes, formatter styles and selectors ship there first, can change or… |
| 9 | **[05 · Fixes and fix safety](05-fixes-and-fix-safety.md)** | `ruff check --fix` applies only fixes ruff labels safe — ones meant to keep runtime behaviour and comments — while… |
| 10 | **[05b · Controlling fixes](05b-controlling-fixes.md)** | Which fixes run is configurable on two independent axes — `fixable`/`unfixable` decide whether a rule may be fixed at… |
| 11 | **[06 · noqa comments](06-noqa.md)** | `# noqa: CODE` suppresses one rule on one physical line, a bare `# noqa` suppresses every rule on it, and the… |
| 12 | **[06b · ruff: ignore and ranges](06b-ruff-ignore-and-range-suppressions.md)** | ruff's own suppression comments fix what `noqa` cannot express — `ruff: ignore[...]` on the line above covers a whole… |
| 13 | **[06c · Unused suppressions and adoption](06c-unused-suppressions-and-adoption.md)** | Suppressions rot, so ruff audits them — `RUF100` reports any `noqa` that no longer suppresses something (and, since… |
| 14 | **[07 · The formatter and Black](07-the-formatter-and-black.md)** | `ruff format` is a Black replacement, not a clone — >99.9% identical lines on Black-formatted code, deliberate deviations, and 🔴 a stable style that changes in *minor* releases (2025 style in 0.9.0, 2026 in 0.15.0) |
| 15 | **[07b · Migrating from Black](07b-migrating-from-black.md)** | One reviewed reformat commit: translate Black's settings (🔴 its `exclude` is a regex, ruff's a glob list; its `target-version` a list), `--diff` first, `.git-blame-ignore-revs`, remove Black from every consumer at once |

## Still to come

- **Formatter settings** *(not written yet)*
- **Formatter and lint-rule conflicts** *(not written yet)*
- **`target-version` and `requires-python`** *(not written yet)*
- **Import sorting** *(not written yet)*
- **`ruff` in CI** *(not written yet)*
- **Pinning ruff** *(not written yet)*
- **Editor integration** *(not written yet)*
- **Upgrading ruff safely** *(not written yet)*

---

← [Phase index](../README.md)
