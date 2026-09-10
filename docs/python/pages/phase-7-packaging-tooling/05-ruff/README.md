---
title: "05 · `ruff`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against ruff **0.16.6** — docs.astral.sh/ruff, the ruff CHANGELOG, ruff-pre-commit and ruff-action — see each chunk's own `> Verified:` line.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**Linter + formatter in one, rule selection, `--fix`, CI and pre-commit.**

:::caution In progress — 35 chunks written
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
| 16 | **[07c · Known deviations from Black](07c-known-deviations-from-black.md)** | The deviations that protect meaning: end-of-line comments stay by their code, 🔴 pragma comments (`# noqa`, `# type:`) are ignored for line width so they never move off the line they suppress, width is Unicode columns |
| 17 | **[07d · Layout deviations from Black](07d-layout-deviations-from-black.md)** | `assert` breaks the message, tuples always parenthesised, call args expanded only when forced, older-Black choices, f-string formatting — and 🔴 layouts chosen by the target Python version |
| 18 | **[07e · Formatter settings](07e-formatter-settings.md)** | The whole formatter surface; `line-length`/`indent-width` are top-level because 🔴 the linter reads them too; `quote-style` and its two documented exceptions; `nested-string-quote-style` (no effect below 3.12) |
| 19 | **[07f · Indentation, commas and line endings](07f-indentation-commas-and-line-endings.md)** | `indent-style`, the magic trailing comma, `line-ending` (🔴 never `native` on a mixed team), format-only `exclude` — which a path passed explicitly ignores unless `force-exclude` is on |
| 20 | **[07g · Docstring and Markdown code](07g-docstring-and-markdown-code.md)** | Markdown Python fences formatted by default since 0.16.0 (only labelled ones); docstring examples opt-in — and 🔴 there unlabelled blocks are assumed Python, so `ls -la` becomes `ls - la`; `fmt:off` HTML comments |
| 21 | **[07h · Format suppression comments](07h-format-suppression-comments.md)** | `# fmt: off`/`on` and `# fmt: skip` work on statements only — 🔴 inside an expression they silently do nothing; formatting pragmas, `noqa` and isort action comments are three systems that never overlap |
| 22 | **[08 · Formatter/lint conflicts](08-formatter-lint-conflicts.md)** | The rules that fight the formatter (indentation, quotes, `COM812`/`COM819`, `D203`, `ISC002`) — none default, ignore them all; 🔴 the warning comes from `ruff format` only and is conditional; `E501` needs a policy; `ISC001` stopped conflicting in 0.9.0 |
| 23 | **[08b · isort settings and the fix/format loop](08b-isort-settings-and-the-fix-format-loop.md)** | `lines-after-imports` (only -1/1/2), `lines-between-types` (0/1), trailing-comma settings that must agree; Black + ruff lint need one `line-length`; 🔴 a settledness check — run fix+format twice, the second pass must change nothing |
| 24 | **[09 · target-version](09-target-version.md)** | The oldest Python the code must run on — drives `UP` rules, fix safety, version-related syntax errors and formatter layout; 🔴 too high ships syntax production cannot parse; `target-version` beats `requires-python` when both are set |
| 25 | **[09b · requires-python inference](09b-requires-python-inference.md)** | ruff reads `requires-python` beside the *found configuration*, not the linted file's package — 🔴 a monorepo sub-package without `[tool.ruff]` gets the root's version; no-config inference depends on the working directory; `--config` disables it |
| 26 | **[10 · Import sorting](10-import-sorting.md)** | Lint rule `I001` with a fix (default since 0.16.0), not the formatter; near-isort `profile = "black"`; 🔴 first-party is decided on disk under `src` — wrong sections almost always mean a missing `src` root; `# isort: split` for side-effect imports |
| 27 | **[10b · isort settings](10b-isort-settings.md)** | `[tool.ruff.lint.isort]`, kebab-case (🔴 underscore keys are a parse error, `[tool.isort]` is never read); `known-*` overrides vs fixing `src`; `required-imports` needs `I002` selected; the layout switches and which are formatter-safe |
| 28 | **[11 · ruff in CI](11-ruff-in-ci.md)** | CI checks, never fixes: `ruff check` + `ruff format --check` (🔴 `check --fix`, bare `format` and `check --diff` all pass a dirty tree); exit `2` = broken gate — `--exit-zero`, never `\|\| true`; let the format step report after a lint failure |
| 29 | **[11b · The CI runner](11b-the-ci-runner.md)** | Install the locked ruff (`uv sync --locked --only-dev` + `uv run`); a complete workflow; 🔴 `setup-uv@v10` does not exist (no major tags since v8); `RUFF_OUTPUT_FORMAT=github` for annotations — never auto-detected |
| 30 | **[11c · ruff-action](11c-ruff-action.md)** | Installs a ruff binary with no Python/uv; 🔴 version from `pyproject.toml` only, a range resolves to the *newest* release — `version-file: uv.lock` keeps it on the lock; no floating `v4` tag; the integrations page still shows `@v3` |
| 31 | **[11d · CI reports](11d-ci-reports.md)** | GitLab Code Quality (`--output-format=gitlab`, exact image tag), SARIF to code scanning (🔴 report job needs `--exit-zero` or it never uploads; `security-events: write`), the output-format list, nullable JSON locations since 0.16.0 |
| 32 | **[11e · Changed files and pre-commit in CI](11e-changed-files-and-pre-commit-in-ci.md)** | Changed-files runs are sound only while config, version and layout are unchanged — fall back to the full tree on `pyproject.toml`/`ruff.toml`/`uv.lock`; 🔴 explicit paths bypass `exclude` without `--force-exclude`; `fetch-depth: 0`; `pre-commit run --all-files` adds a second version pin (`rev`) |
| 33 | **[12 · Pinning ruff](12-pinning-ruff.md)** | Exact pin in the dev group (🔴 minors are ruff's breaking releases, patches may still change verdicts — `~=` admits them, and preview changes on any patch); why the specifier matters despite the lock; the inventory of every place a ruff version lives — `rev`, action, image tag, editor, global tools |
| 34 | **[12b · required-version and keeping pins in step](12b-required-version-and-keeping-pins-in-step.md)** | The one pin every ruff obeys — checked before strict parsing since 0.14.11, inherited only through `extend` (🔴 a sub-project `[tool.ruff]` without `extend` has no tripwire); `==` vs floor-and-ceiling vs floor; keeping the pre-commit `rev` in step — tripwire, a CI pin check, or a local `uv run --locked` hook with no `rev` at all |
| 35 | **[13 · Editor integration](13-editor-integration.md)** | `ruff server` is the editor backend; VS Code picks the environment's ruff, then `PATH`, then 🔴 a bundled binary that tracks the *latest* release — silently; untrusted workspaces always use it; a leftover `ruff.lint.args` swaps in deprecated `ruff-lsp`; editor settings beat `pyproject.toml` under the default `editorFirst` — commit `filesystemFirst` |

## Still to come

- **Editor integration, continued — 13b · On save, other tools and other editors** *(not written yet)*
- **Upgrading ruff safely** *(not written yet)*

---

← [Phase index](../README.md)
