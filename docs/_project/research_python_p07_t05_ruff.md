---
name: research-python-p07-t05-ruff
description: Banked primary-source research for devbible Python Phase 7 topic 05 (ruff — linter + formatter, rule selection, fixes and fix safety, suppression comments, formatter vs Black, formatter/lint conflicts, isort, CI, pre-commit, editors, upgrading). Every load-bearing sentence quoted verbatim with its URL. DO NOT RE-DERIVE.
metadata:
  type: research
  track: python
  topic: phase-7 / 05-ruff
  banked: 2026-09-10
---

# 🔴 DO NOT RE-DERIVE — research bank, Python Phase 7 topic 05 · ruff

Fetched **2026-09-10** in one pass, for the whole topic. Every chunk of
`docs/python/pages/phase-7-packaging-tooling/05-ruff/` was written from this file.
**No sandbox, nothing run, no locally installed ruff probed** (installed-version trap).

**How it was fetched — and why that matters for a re-check.** The hand-written docs pages
(`linter.md`, `configuration.md`, `formatter.md`, `formatter/black.md`, `preview.md`,
`versioning.md`, `faq.md`, `integrations.md`, `installation.md`, `tutorial.md`,
`editors/*.md`) were read as **raw Markdown from the git tag `0.16.6`**
(`https://raw.githubusercontent.com/astral-sh/ruff/0.16.6/docs/<page>.md`) — i.e. the exact
text that shipped with the pinned version, not whatever is on `main`. The settings
reference (`/settings/`) is generated from doc comments in
`crates/ruff_workspace/src/options.rs`, so those were read from the same tag. Generated
pages that do not exist in the repo (`/default-rules/`, `/rules/<name>/`, `/rules/`) were
read from the live site on 2026-09-10, when **PyPI's latest ruff was 0.16.6** (released
2026-09-03T16:56:40Z), so they reflect 0.16.6. Source-code facts (message templates,
merge semantics) were read from the tag `0.16.6` and are marked **[source]**.

Page URLs for citation: `https://docs.astral.sh/ruff/<page>/` (all returned HTTP 200 on
2026-09-10).

## Version spine (given as fact by the coordinator; not re-derived)

- **ruff 0.16.6** (2026-09-03) ← this topic's pin
- **Python 3.14.7** · **uv 0.12.12** · **pre-commit 4.6.2**

ruff 0.16.x releases (PyPI upload times): 0.16.0 2026-07-23 · 0.16.1 2026-07-30 ·
0.16.2 2026-08-07 · 0.16.3 2026-08-13 · 0.16.4 2026-08-20 · 0.16.5 2026-08-27 ·
**0.16.6 2026-09-03**. Weekly cadence.

---

## §1 · The linter — https://docs.astral.sh/ruff/linter/

> *"The Ruff Linter is an extremely fast Python linter designed as a drop-in replacement for Flake8 (plus dozens of plugins), isort, pydocstyle, pyupgrade, autoflake, and more."*

> *"`ruff check` is the primary entrypoint to the Ruff linter. It accepts a list of files or directories, and lints all discovered Python files, optionally fixing any fixable errors. When linting a directory, Ruff searches for Python files recursively in that directory and all its subdirectories"*

Commands shown: `ruff check`, `ruff check --fix`, `ruff check --watch`, `ruff check path/to/code/`.

### Rule selection

> *"The set of enabled rules is controlled via the `lint.select`, `lint.extend-select`, and `lint.ignore` settings."*

> *"Ruff's linter mirrors Flake8's rule code system, in which each rule code consists of a one-to-three letter prefix, followed by three digits (e.g., `F401`). The prefix indicates that "source" of the rule (e.g., `F` for Pyflakes, `E` for pycodestyle, `ANN` for flake8-annotations)."*

> *"Rule selectors like `lint.select` and `lint.ignore` accept either a full rule code (e.g., `F401`) or any valid prefix (e.g., `F`)."*

> *"As a special-case, Ruff also supports the `ALL` code, which enables all rules. Note that some pydocstyle rules conflict (e.g., `D203` and `D211`) as they represent alternative docstring formats. Ruff will automatically disable any conflicting rules when `ALL` is enabled."*

Recommended guidelines (verbatim bullets):
> *"Prefer `lint.select` over `lint.extend-select` to make your rule set explicit."*
> *"Use `ALL` with discretion. Enabling `ALL` will implicitly enable new rules whenever you upgrade."*
> *"Start with a small set of rules (`select = ["E", "F"]`) and add a group at-a-time. For example, you might consider expanding to `select = ["E", "F", "B"]` to enable the popular flake8-bugbear extension."*

Popular config shown: `select = ["E", "F", "UP", "B", "SIM", "I"]`.

> *"To resolve the enabled rule set, Ruff may need to reconcile `lint.select` and `lint.ignore` from a variety of sources, including the current `pyproject.toml`, any inherited `pyproject.toml` files, and the CLI (e.g., `--select`)."*

> *"In those scenarios, Ruff uses the "highest-priority" `select` as the basis for the rule set, and then applies `extend-select` and `ignore` adjustments. CLI options are given higher priority than `pyproject.toml` options, and the current `pyproject.toml` file is given higher priority than any inherited `pyproject.toml` files."*

> *"Running `ruff check --select F401` would result in Ruff enforcing `F401`, and no other rules."*
> *"Running `ruff check --extend-select B` would result in Ruff enforcing the `E`, `F`, and `B` rules, with the exception of `F401`."* (given `select = ["E","F"]`, `ignore = ["F401"]`)

> *"When preview mode is enabled, rule selectors also accept the human-readable name of a rule (e.g., `unused-import`)."*

### Rule categories (PREVIEW — introduced 0.16.5)

> *"In preview, Ruff supports rule categories in addition to the Flake8-style linter groups described above. These categories organize rules by the types of issues they detect and determine whether rules are enabled by default."*

Categories in decreasing severity: Correctness, Suspicious, Complexity, Performance, Style,
Security, Formatting, Pedantic, Restriction. *"The first five categories compose the default rule set"* (shown with `preview = true`), *"while the remaining four (`security`, `formatting`, `pedantic`, and `restriction`) are off by default."*

> *"`ALL < category < linter group < linter prefix < rule`"* (precedence, broadest → narrowest)

> *"Note that we plan to deprecate and eventually remove the linter groups in the future. If you give the new categories a try and run into situations where you need to fall back on linter groups, please let us know on the tracking issue."* (issue #27959)

---

## §2 · Fixes and fix safety — https://docs.astral.sh/ruff/linter/#fixes

> *"By default, Ruff will fix all violations for which safe fixes are available; to determine whether a rule supports fixing, see Rules."*

> *"Ruff labels fixes as "safe" and "unsafe". The meaning and intent of your code will be retained when applying safe fixes, but the meaning could change when applying unsafe fixes."*

> *"Specifically, an unsafe fix could lead to a change in runtime behavior, the removal of comments, or both, while safe fixes are intended to preserve runtime behavior and will only remove comments when deleting entire statements or expressions (e.g., removing unused imports)."*

RUF015 example: `list(...)[0]` → `next(iter(...))`: *"However, when the collection is empty, this raised exception changes from an `IndexError` to `StopIteration`"* · *"Since the change in exception type could break error handling upstream, this fix is categorized as unsafe."* (The docs page also shows timeit console output — **not** reproduced on our pages.)

> *"Ruff only enables safe fixes by default. Unsafe fixes can be enabled by settings `unsafe-fixes` in your configuration file or passing the `--unsafe-fixes` flag to `ruff check`"*
Commands: `ruff check --unsafe-fixes` (show) · `ruff check --fix --unsafe-fixes` (apply).

> *"By default, Ruff will display a hint when unsafe fixes are available but not enabled. The suggestion can be silenced by setting the `unsafe-fixes` setting to `false` or using the `--no-unsafe-fixes` flag."*

> *"The safety of fixes can be adjusted per rule using the `lint.extend-safe-fixes` and `lint.extend-unsafe-fixes` settings."* Example: `extend-safe-fixes = ["F601"]`, `extend-unsafe-fixes = ["UP034"]`. *"You may use prefixes to select rules as well, e.g., `F` can be used to promote fixes for all rules in Pyflakes to safe."*

> *"All fixes will always be displayed by Ruff when using the `json` output format. The safety of each fix is available under the `applicability` field."*

### Disabling fixes
> *"To limit the set of rules that Ruff should fix, use the `lint.fixable` or `lint.extend-fixable`, and `lint.unfixable` settings."* Examples: `fixable = ["ALL"]` + `unfixable = ["F401"]`; `fixable = ["F401"]` only.

### Versioning page — fix applicability (https://docs.astral.sh/ruff/versioning/)
> *"Fixes have three applicability levels: **Display**: Never applied, just displayed. **Unsafe**: Can be applied with explicit opt-in. **Safe**: Can be applied automatically."*
> *"Fixes for rules may be introduced at a lower applicability, then promoted to a higher applicability. Reducing the applicability of a fix is not a breaking change. The applicability of a given fix may change when the preview mode is enabled."*

### Editors (https://docs.astral.sh/ruff/editors/features/)
> *"By default, the "Fix all" action will not apply unsafe fixes. However, unsafe fixes can be applied manually with the "Quick fix" action. Application of unsafe fixes when using "Fix all" can be enabled by setting `unsafe-fixes = true` in your Ruff configuration file."*

### FAQ
> *"Even still, given the dynamic nature of Python, it's difficult to have complete certainty when making changes to code, even for seemingly trivial fixes. If a "safe" fix breaks your code, please file an Issue."*

---

## §3 · Suppression comments — https://docs.astral.sh/ruff/linter/#error-suppression

> *"To omit a lint rule everywhere, add it to the "ignore" list via the `lint.ignore` setting"* · per-file: `lint.per-file-ignores`.

> *"Ruff supports multiple forms of suppression comments, including inline and file-level `noqa` and `ruff: ignore` comments, and range suppressions."*

> *"In preview mode, rule names (e.g. `unused-import`) can be used in `ruff: ignore`, `ruff: file-ignore`, `ruff: disable`, and `ruff: enable` comments instead of rule codes (e.g. `F401`)."*

### Line-level noqa
> *"To ignore an individual violation, add `# noqa: {code}` to the end of the line"* — examples `x = 1  # noqa: F841`, `i = 1  # noqa: E741, F841`, `x = 1  # noqa` (all).
> *"For multi-line strings (like docstrings), the `noqa` directive should come at the end of the string (after the closing triple quote), and will apply to the entire string"*
> *"For import sorting, the `noqa` should come at the end of the first line in the import block, and will apply to all imports in the block"* (`import os  # noqa: I001`)

Spec (verbatim):
> *"An inline blanket `noqa` comment is given by a case-insensitive match for `#noqa` with optional whitespace after the `#` symbol, followed by either: the end of the comment, the beginning of a new comment (`#`), or whitespace followed by any character other than `:`."*
> *"An inline `noqa` suppression is given by first finding a case-insensitive match for `#noqa` with optional whitespace after the `#` symbol, optional whitespace after `noqa`, and followed by the symbol `:`. After this we are expected to have a list of rule codes which is given by sequences of uppercase ASCII characters followed by ASCII digits, separated by whitespace or commas. The list ends at the last valid code. We will attempt to interpret rules with a missing delimiter (e.g. `F401F841`), though a warning will be emitted in this case."*
⇒ `# noqa E501` (no colon) is a **blanket** noqa. PGH004 docs: *"given `# noqa F401`, the rule will suggest inserting a colon, as in `# noqa: F401`."*

### `ruff: ignore` (logical line) — STABLE since 0.16.0
> *"To cover an entire "logical" line (a multi-line statement or suite header), an "ignore" comment may be placed above the first line"* (examples `# ruff: ignore[ARG001]` above a `def` covering the whole signature; `# ruff: ignore[E501]` above a list literal)
> *"Alternately, placing the "ignore" comment inside of a multi-line statement, or at the end of a line, will cover only a single "physical" line, leaving the rest of the multi-line statement or header uncovered"*
> *"Ignore comments can also be "stacked" with other comments or pragmas, and will still cover the next logical line"*
Spec: *"An own-line or trailing comment starting with case sensitive `#ruff:`, with optional whitespace after the `#` symbol and `:` symbol, followed by `ignore[`, any rules to be suppressed, and ending with `]`."* · *"Rules to be suppressed must be separated by commas, with optional whitespace before or after each rule name, and may be followed by an optional trailing comma after the last rule name."*

### Block-level `ruff: disable[...]` / `ruff: enable[...]` — STABLE since 0.15.0
> *"To define a range, both the "disable" and "enable" comments must have matching codes, in the same order, as well as matching indentation levels within a logical block of code"*
> *"If no matching "enable" comment is found, Ruff will also treat this as an "implicit" range. The implicit range is defined from the starting "disable" comment, until reaching a logical scope indented less than the starting comment"*
> *"It is strongly suggested to use explicit range suppressions, in order to prevent accidental suppressions of violations, especially at global module scope. For this reason, a `RUF104` diagnostic will also be produced for any implicit range."*
> *"Range suppressions cannot be used to enable or select rules that aren't already selected by the project configuration or runtime flags. An "enable" comment can only be used to terminate a preceding "disable" comment with identical codes."*
> *"Unlike `noqa` suppressions, range suppressions do not support "blanket" suppression of all violations. At least one violation code must be listed."*

### File-level
> *"To ignore all violations across an entire file, add the line `# ruff: noqa` anywhere in the file, preferably towards the top"* · *"To ignore a specific rule across an entire file, add the line `# ruff: noqa: {code}`"*
> *"Global `noqa` comments must be on their own line to disambiguate from comments which ignore violations on a single line."*
> *"Note that Ruff will also respect Flake8's `# flake8: noqa` directive, and will treat it as equivalent to `# ruff: noqa`."*
File-level spec: *"A file-level exemption comment is given by a case-sensitive match for `#ruff:` or `#flake8:`, with optional whitespace after `#` and before `:`, followed by optional whitespace and a case-insensitive match for `noqa`."*
`file-ignore` (STABLE since 0.16.0): *"One or more rules can also be ignored across an entire file with a `file-ignore` comment on its own line, at global module scope, and preferably near the top of the file"* — `# ruff: file-ignore[F401, ARG001]`.
Blog 0.16: comments can carry a reason — `# ruff: file-ignore[F401] Allow unused imports in this file`.

### Unused suppressions — RUF100
> *"Ruff implements a special rule, `unused-noqa`, under the `RUF100` code, to enforce that your suppressions are "valid", in that the violations they say they ignore are actually being triggered and suppressed."*
Commands: `ruff check /path/to/file.py --extend-select RUF100` · `... --extend-select RUF100 --fix` (removes).

### Adding suppressions
> *"Ruff can automatically add suppression comments to all lines that contain violations, which is useful when migrating a new codebase to Ruff. To add the appropriate comments to all relevant lines, run Ruff with `--add-noqa` to add `noqa` comments or with `--add-ignore` to add `ruff: ignore` comments"*
> *"Both of these flags use rule codes on stable. To add `ruff: ignore` comments with human-readable rule names instead, use `--add-ignore` with preview mode enabled."*
CLI help: `--add-noqa[=<REASON>]` *"Enable automatic additions of `noqa` directives to failing lines. Optionally provide a reason to append after the codes"*; `--add-ignore[=<REASON>]` *"... In preview, add suppression comments with rule names instead"*.
Tutorial: `uv run ruff check --select UP035 --add-noqa .` (doc shows the resulting diff `from typing import Iterable  # noqa: UP035`).

### isort action comments
> *"Ruff respects isort's action comments (`# isort: skip_file`, `# isort: on`, `# isort: off`, `# isort: skip`, and `# isort: split`)"* · also `# ruff: isort: ...` variants · *"Unlike isort, Ruff does not respect action comments within docstrings."*

---

## §4 · Exit codes

`ruff check` — https://docs.astral.sh/ruff/linter/#exit-codes
> *"`0` if no violations were found, or if all present violations were fixed automatically."* · *"`1` if violations were found."* · *"`2` if Ruff terminates abnormally due to invalid configuration, invalid CLI options, or an internal error."*
> *"`--exit-zero` will cause Ruff to exit with a status code of `0` even if violations were found. Note that Ruff will still exit with a status code of `2` if it terminates abnormally."*
> *"`--exit-non-zero-on-fix` will cause Ruff to exit with a status code of `1` if violations were found, even if all such violations were fixed automatically. Note that the use of `--exit-non-zero-on-fix` can result in a non-zero exit code even if no violations remain after fixing."*

`ruff format` — https://docs.astral.sh/ruff/formatter/#exit-codes
> *"`0` if Ruff terminates successfully, regardless of whether any files were formatted."* · *"`1` if Ruff terminates successfully, one or more files were formatted, and `--exit-non-zero-on-format` was specified."* · *"`2` if Ruff terminates abnormally due to invalid configuration, invalid CLI options, or an internal error."*
`ruff format --check`: *"`0` if Ruff terminates successfully, and no files would be formatted if `--check` were not specified."* · *"`1` if Ruff terminates successfully, and one or more files would be formatted if `--check` were not specified."* · `2` abnormal.

---

## §5 · Configuration — https://docs.astral.sh/ruff/configuration/

> *"Ruff can be configured through a `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file."* · *"Whether you're using Ruff as a linter, formatter, or both, the underlying configuration strategy and semantics are the same."*

Default config block (0.16.6 doc): `exclude` list (`.bzr .direnv .eggs .git .git-rewrite .hg .ipynb_checkpoints .mypy_cache .nox .pants.d .pyenv .pytest_cache .pytype .ruff_cache .svn .tox .venv .vscode __pypackages__ _build buck-out build dist node_modules site-packages venv`), `line-length = 88` ("Same as Black."), `indent-width = 4`, `target-version = "py310"` ("Assume Python 3.10"), `[lint] ignore = []`, `fixable = ["ALL"]`, `unfixable = []`, `dummy-variable-rgx = "^(_+|(_+[a-zA-Z0-9_]*[a-zA-Z0-9]+?))$"`, `[format] quote-style = "double"`, `indent-style = "space"`, `skip-magic-trailing-comma = false`, `line-ending = "auto"`, `docstring-code-format = false` (*"This is currently disabled by default, but it is planned for this to be opt-out in the future."*), `docstring-code-line-length = "dynamic"`.
⚠️ The settings reference's `exclude` default string (options.rs) is a SHORTER list (no `.ipynb_checkpoints`, `.pyenv`, `.pytest_cache`, `.vscode`, `build`, `site-packages`) — docs inconsistency, noted in §23.

> *"Ruff respects `pyproject.toml`, `ruff.toml`, and `.ruff.toml` files. All three implement an equivalent schema (though in the `ruff.toml` and `.ruff.toml` versions, the `[tool.ruff]` header and `tool.ruff` section prefix is omitted)."*

### Config file discovery
> *"Similar to ESLint, Ruff supports hierarchical configuration, such that the "closest" config file in the directory hierarchy is used for every individual file, with all paths in the config file (e.g., `exclude` globs, `src` paths) being resolved relative to the directory containing that config file."*
Exceptions (verbatim):
1. *"In locating the "closest" `pyproject.toml` file for a given path, Ruff ignores any `pyproject.toml` files that lack a `[tool.ruff]` section."*
2. *"If a configuration file is passed directly via `--config`, those settings are used for all analyzed files, and any relative paths in that configuration file (like `exclude` globs or `src` paths) are resolved relative to the current working directory."*
3. *"If no config file is found in the filesystem hierarchy, Ruff will fall back to using a default configuration. If a user-specific configuration file exists at `${config_dir}/ruff/pyproject.toml`, that file will be used instead of the default configuration, with `${config_dir}` being determined via `etcetera`'s base strategy, and all relative paths being again resolved relative to the current working directory."*
4. *"Any config-file-supported settings that are provided on the command-line (e.g., via `--select`) will override the settings in every resolved configuration file."*

> *"Unlike ESLint, Ruff does not merge settings across configuration files; instead, the "closest" configuration file is used, and any parent configuration files are ignored. In lieu of this implicit cascade, Ruff supports an `extend` field, which allows you to inherit the settings from another config file"* (example `extend = "../pyproject.toml"` + `line-length = 100`)

> *"If Ruff detects multiple configuration files in the same directory, the `.ruff.toml` file will take precedence over the `ruff.toml` file, and the `ruff.toml` file will take precedence over the `pyproject.toml` file."* (already taught in topic 01 chunk 12 — link, do not repeat)

### Inferring the Python version
> *"When no discovered configuration specifies a `target-version`, Ruff will attempt to fall back to the minimum version compatible with the `requires-python` field in a nearby `pyproject.toml`."*
1. *"If a configuration file is passed directly, Ruff does not attempt to infer a missing `target-version`."*
2. *"If a configuration file is found in the filesystem hierarchy, Ruff will infer a missing `target-version` from the `requires-python` field in a `pyproject.toml` file in the same directory as the found configuration."*
3. *"If we are using a user-level configuration from `${config_dir}/ruff/pyproject.toml`, the `requires-python` field in the first `pyproject.toml` file found in an ancestor of the current working directory takes precedence over the `target-version` in the user-level configuration."*
4. *"If no configuration files are found, Ruff will infer the `target-version` from the `requires-python` field in the first `pyproject.toml` file found in an ancestor of the current working directory."*
> *"Note that in these last two cases, the behavior of Ruff may differ depending on the working directory from which it is invoked."*

### Python file discovery
> *"When passed a path on the command-line, Ruff will automatically discover all Python files in that path, taking into account the `exclude` and `extend-exclude` settings in each directory's configuration file."*
> *"Files can also be selectively excluded from linting or formatting by scoping the `exclude` setting to the tool-specific configuration tables."* (`[tool.ruff.format] exclude = ["*.pyi"]`)
> *"By default, Ruff will also skip any files that are omitted via `.ignore`, `.gitignore`, `.git/info/exclude`, and global `gitignore` files"*
> *"Files that are passed to `ruff` directly are always analyzed, regardless of the above criteria, unless `force-exclude` is also enabled (via CLI or settings file). For example, without `force-exclude` enabled, `ruff check /path/to/excluded/file.py` will always lint `file.py`."*
> *"By default, Ruff will discover files matching `*.py`, `*.pyi`, `*.ipynb`, or `pyproject.toml`. In preview mode, Ruff will also discover `*.pyw` by default."*
> *"Paths provided to `include` must match files. For example, `include = ["src"]` will fail since it matches a directory."*
⚠️ options.rs `include` default string at 0.16.6 is `["*.py", "*.pyi", "*.pyw", "*.ipynb", "*.md", "**/pyproject.toml", "**/ruff.toml", "**/.ruff.toml"]` — lists `*.md` (0.16.0 Markdown) and `*.pyw`; the prose above predates it. Inconsistency noted §23.
Notebooks: *"linted and formatted by default on version `0.6.0` and higher."*

### `--config`
> *"The `--config` flag has two uses. It is most often used to point to the configuration file that you would like Ruff to use"* · *"However, the `--config` flag can also be used to provide arbitrary overrides of configuration settings using TOML `<KEY> = <VALUE>` pairs."*
> *"Configuration options passed to `--config` are parsed in the same way as configuration options in a `ruff.toml` file. As such, options specific to the Ruff linter need to be prefixed with `lint.`"* · *"and options specific to the Ruff formatter need to be prefixed with `format.`."*
> *"If a specific configuration option is simultaneously overridden by a dedicated flag and by the `--config` flag, the dedicated flag takes priority."*
> *"Specifying `--config "line-length=90"` will override the `line-length` setting from all configuration files detected by Ruff, including configuration files discovered in subdirectories."*
Global options help: `--isolated` *"Ignore all configuration files"*.
Argfiles: `ruff check @path/to/args.txt`.

### CLI help excerpts (0.16.6, auto-generated in configuration.md)
Top-level commands: `check`, `rule` ("Explain a rule (or all rules)"), `config` ("List or describe the available configuration options"), `linter` ("List all supported upstream linters"), `clean` ("Clear any caches in the current directory and any subdirectories"), `format`, `server` ("Run the language server"), `analyze`, `version`.
`ruff check` options: `--fix` (*"Apply fixes to resolve lint violations. Use `--no-fix` to disable or `--unsafe-fixes` to include unsafe fixes"*), `--unsafe-fixes` (*"Include fixes that may not retain the original intent of the code."*), `--show-fixes`, `--diff` (*"Avoid writing any fixed files back; instead, output a diff for each changed file to stdout, and exit 0 if there are no diffs. Implies `--fix-only`"*), `--watch`, `--fix-only` (*"Apply fixes to resolve lint violations, but don't report on, or exit non-zero for, leftover violations. Implies `--fix`."*), `--ignore-noqa`, `--output-format` (*"[env: RUFF_OUTPUT_FORMAT=] [possible values: concise, full, json, json-lines, junit, grouped, github, gitlab, pylint, rdjson, azure, sarif]"*), `-o/--output-file`, `--target-version` (py37…py315), `--preview`, `--extension`, `--statistics` (*"Show counts for every rule with at least one violation"*), `--add-noqa`, `--add-ignore`, `--show-files`, `--show-settings` (*"See the settings Ruff will use to lint a given Python file"*), `--select`, `--ignore`, `--extend-select`, `--per-file-ignores`, `--extend-per-file-ignores`, `--fixable`, `--unfixable`, `--extend-fixable`, `--exclude`, `--extend-exclude`, `--respect-gitignore`, `--force-exclude`, `-n/--no-cache [env: RUFF_NO_CACHE=]`, `--cache-dir [env: RUFF_CACHE_DIR=]`, `--stdin-filename`, `-e/--exit-zero`, `--exit-non-zero-on-fix`.
`ruff format` options: `--check` (*"Avoid writing any formatted files back; instead, exit with a non-zero status code if any files would have been modified, and zero otherwise"*), `--diff` (*"Avoid writing any formatted files back; instead, exit with a non-zero status code and the difference between the current file and how the formatted file would look like"*), `--output-format` (*"when used with `--check`"*), `--exit-non-zero-on-format`, `--line-length`, `--range`, `--preview`, file selection flags.

---

## §6 · Settings reference (doc comments in `crates/ruff_workspace/src/options.rs` @ 0.16.6) — https://docs.astral.sh/ruff/settings/

- **`line-length`** (default 88): *"The line length to use when enforcing long-lines violations (like `E501`) and at which `isort` and the formatter prefers to wrap lines."* · *"Note: While the formatter will attempt to format lines such that they remain within the `line-length`, it isn't a hard upper bound, and formatted lines may exceed the `line-length`."* · *"The length is determined by the number of characters per line, except for lines containing East Asian characters or emojis."*
- **`target-version`** (default `"py310"`): *"The minimum Python version to target, e.g., when considering automatic code upgrades, like rewriting type annotations. Ruff will not propose changes using features that are not available in the given version."* · *"If you're already using a `pyproject.toml` file, we recommend `project.requires-python` instead, as it's based on Python packaging standards, and will be respected by other tools."* · *"If both are specified, `target-version` takes precedence over `requires-python`."*
- **`extend`**: *"To resolve the current configuration file, Ruff will first load this base configuration file, then merge in properties defined in the current configuration file. Most settings follow simple override behavior where the child value replaces the parent value. However, rule selection (`lint.select` and `lint.ignore`) has special merging behavior: if the child configuration specifies `lint.select`, it establishes a new baseline rule set and the parent's `lint.ignore` rules are discarded; if the child configuration omits `lint.select`, the parent's rule selection is inherited and both parent and child `lint.ignore` rules are accumulated together."*
- **`required-version`**: *"Enforce a requirement on the version of Ruff, to enforce at runtime. If the version of Ruff does not meet the requirement, Ruff will exit with an error."* · *"Accepts a PEP 440 specifier, like `==0.3.1` or `>=0.3.1`."*
- **`src`** (default `[".", "src"]`): *"When omitted, the `src` directory will typically default to including both: 1. The directory containing the nearest `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file (the "project root"). 2. The `"src"` subdirectory of the project root."* · *"These defaults ensure that Ruff supports both flat layouts and `src` layouts out-of-the-box."* · *"This field supports globs."*
- **`exclude`**: *"Note that you'll typically want to use `extend-exclude` to modify the excluded paths."* · relative patterns *"relative to the project root"*.
- **`force-exclude`**: *"Whether to enforce `exclude` and `extend-exclude` patterns, even for paths that are passed to Ruff explicitly."* · *"This is useful for `pre-commit`, which explicitly passes all changed files to the `ruff-pre-commit` plugin, regardless of whether they're marked as excluded by Ruff's own settings."*
- **`respect-gitignore`** default true.
- **`output-format`** default `"full"`.
- **`preview`** (top-level): *"When preview mode is enabled, Ruff will use unstable rules, fixes, and formatting."*
- **`fix`**: *"Enable fix behavior by-default when running `ruff` (overridden by the `--fix` and `--no-fix` command-line flags). Only includes automatic fixes unless `--unsafe-fixes` is provided."*
- **`unsafe-fixes`** (default null): *"Enable application of unsafe fixes. If excluded, a hint will be displayed when unsafe fixes are available. If set to false, the hint will be hidden."*
- **`per-file-target-version`**: *"This may be useful for overriding the global Python version settings in `target-version` or `requires-python` for a subset of files."*
- **`cache-dir`**: *"By default, Ruff stores cache results in a `.ruff_cache` directory in the current project root."* · respects `RUFF_CACHE_DIR`.
- **`include`**: *"`pyproject.toml`, `ruff.toml`, and `.ruff.toml` are included here not for configuration but because we lint whether e.g. the `[project]` matches the schema in `pyproject.toml` or that rule names are used as selectors."*
- **`namespace-packages`**: *"For the purpose of module resolution, Ruff will treat those directories and all their subdirectories as if they contained an `__init__.py` file."*
- **`lint.select`** default: *"See https://docs.astral.sh/ruff/default-rules/ or run `ruff check --show-settings --isolated`"* · *"When breaking ties between enabled and disabled rules (via `select` and `ignore`, respectively), more specific prefixes override less specific prefixes. `ignore` takes precedence over `select` if the same prefix appears in both."*
- **`lint.extend-select`**: *"Unlike `select`, which replaces the default rule set when specified, `extend-select` adds to whatever rules are already active."* · *"Using `select = ["B"]` instead would replace the defaults, enabling only flake8-bugbear."*
- **`lint.extend-ignore`** DEPRECATED: *"This option is deprecated because it is now interchangeable with `ignore`."* · *"Ruff now merges both `ignore` and `extend-ignore` into a single set, so the distinction no longer applies."*
- **`lint.per-file-ignores`**: *"A list of mappings from file pattern to rule codes or prefixes to exclude, when considering any matching files. An initial '!' negates the file pattern."* Example: `"__init__.py" = ["E402"]`, `"!src/**.py" = ["D"]`, `"{benchmark,scripts,.github/action-name/}/*.py" = ["INP001"]`.
- **`lint.fixable`** default `["ALL"]`; **`lint.unfixable`**; **`lint.extend-fixable`**.
- **`lint.extend-safe-fixes`**: *"A list of rule codes or prefixes for which unsafe fixes should be considered safe."* / **`extend-unsafe-fixes`** the reverse.
- **`lint.external`**: *"A list of rule codes or prefixes that are unsupported by Ruff, but should be preserved when (e.g.) validating `# noqa` directives. Useful for retaining `# noqa` directives that cover plugins not yet implemented by Ruff."* (example `external = ["V"]`)
- **`lint.explicit-preview-rules`**: *"When enabled, preview rules will not be selected by prefixes — the full code of each preview rule will be required to enable the rule."*
- **`lint.ignore-init-module-imports`** DEPRECATED since 0.4.4.
- **`lint.dummy-variable-rgx`**: *"The default expression matches `_`, `__`, and `_var`, but not `_var_`."*
- **`lint.task-tags`** default `["TODO", "FIXME", "XXX"]`.
- **`lint.preview`**: *"When preview mode is enabled, Ruff will use unstable rules and fixes."*
- **`lint.future-annotations`** (default false; added 0.13.0).
- `LintOptions` doc: *"Options specified in the `lint` section take precedence over the deprecated top-level settings."*
- **`format.quote-style`**: `double` (default) | `single` | `preserve`; *"Ruff prefers double quotes for triple quoted strings and docstrings even when using `quote-style = "single"`."* · *"Ruff deviates from using the configured quotes if doing so prevents the need for escaping quote characters inside the string"* · *"The quote style `preserve` leaves the quotes of all strings unchanged."*
- **`format.nested-string-quote-style`** (added 0.15.9): `alternating` (default) | `preferred`; *"Note: This setting has no effect when targeting Python versions below 3.12."*
- **`format.skip-magic-trailing-comma`**: *"Ruff uses existing trailing commas as an indication that short lines should be left separate. If this option is set to `true`, the magic trailing comma is ignored."*
- **`format.line-ending`**: `auto` (*"Files with mixed line endings will be converted to the first detected line ending. Defaults to `\n` for files that contain no line endings."*) | `lf` | `cr-lf` | `native`.
- **`format.indent-style`**: *"We care about accessibility; if you do not need tabs for accessibility, we do not recommend you use them."*
- **`format.docstring-code-format`** (default false); **`docstring-code-line-length`** default `"dynamic"`.
- **`format.preview`**: *"Whether to enable the unstable preview style formatting."*
- **`lint.pycodestyle.max-line-length`**: *"By default, this is set to the value of the `line-length` option."* · *"Use this option when you want to detect extra-long lines that the formatter can't automatically split by setting `pycodestyle.line-length` to a value larger than `line-length`."*
- **`lint.pycodestyle.ignore-overlong-task-comments`** default false.
- **`lint.flake8-implicit-str-concat.allow-multiline`** default true: *"Setting `allow-multiline = false` will automatically disable the `explicit-string-concatenation` (`ISC003`) rule."*
- **`lint.pyupgrade.keep-runtime-typing`**: *"This setting is only applicable when the target Python version is below 3.9 and 3.10 respectively, and is most commonly used when working with libraries like Pydantic and FastAPI"*.
- **isort**: `known-first-party` (*"A list of modules to consider first-party, regardless of whether they can be identified as such via introspection of the local filesystem."* supports globs), `known-third-party`, `known-local-folder`, `section-order` default `["future", "standard-library", "third-party", "first-party", "local-folder"]`, `required-imports` (*"Add the specified import line to all files."*), `lines-after-imports` (*"When using the formatter, only the values `-1`, `1`, and `2` are compatible"*), `lines-between-types` (*"only the values `0` and `1` are compatible"*), `detect-same-package` default true, `split-on-trailing-comma` default true, `force-sort-within-sections`, `combine-as-imports`, `force-wrap-aliases`, `force-single-line`.

---

## §7 · The formatter — https://docs.astral.sh/ruff/formatter/

> *"The Ruff formatter is an extremely fast Python code formatter designed as a drop-in replacement for Black, available as part of the `ruff` CLI via `ruff format`."*
> *"Similar to Black, running `ruff format /path/to/file.py` will format the given file or directory in-place, while `ruff format --check /path/to/file.py` will avoid writing any formatted files back, and instead exit with a non-zero status code upon detecting any unformatted files."*
> *"The initial goal of the Ruff formatter is not to innovate on code style, but rather, to innovate on performance, and provide a unified toolchain across Ruff's linter, formatter, and any and all future tools."*
> *"Specifically, the formatter is intended to emit near-identical output when run over existing Black-formatted code. When run over extensive Black-formatted projects like Django and Zulip, > 99.9% of lines are formatted identically."*
> *"Like Black, the Ruff formatter does not support extensive code style configuration; however, unlike Black, it does support configuring the desired quote style, indent style, line endings, and more."*
> *"While the formatter is designed to be a drop-in replacement for Black, it is not intended to be used interchangeably with Black on an ongoing basis, as the formatter does differ from Black in a few conscious ways"*
> *"Going forward, the Ruff Formatter will support Black's preview style under Ruff's own preview mode."*
> *"Given the focus on Black compatibility (and unlike formatters like YAPF), Ruff does not currently expose any other configuration options."*
Docstring code: recognises doctest, CommonMark fences (`python`, `py`, `python3`, `py3`; unlabelled assumed Python), rST literal blocks, `code-block`/`sourcecode`. *"If a code example is recognized and treated as Python, the Ruff formatter will automatically skip it if the code does not parse as valid Python or if the reformatted code would produce an invalid Python program."*

### Markdown code formatting (STABLE + ON BY DEFAULT since 0.16.0; preview since 0.15.0)
> *"The Ruff formatter can also format Python code blocks in Markdown files. In these files, Ruff will format any CommonMark fenced code blocks with the following info strings: `python`, `py`, `python3`, `py3`, `pyi`, or `pycon`."*
Suppression: `<!-- fmt:off -->` / `<!-- fmt:on -->` HTML comments; *"any `off` comment without a matching `on` comment will implicitly cover the remaining portion of the document"*; blacken-docs comments also recognised. Disable: `extend-exclude = ["*.md"]`.
> *"If you run Ruff via `ruff-pre-commit`, Markdown support needs to be explicitly included by adding it to `types_or`"* (the ruff-pre-commit v0.16.6 hook manifest already lists `markdown` for `ruff-format` — see §20; the formatter page's sentence is about overriding `types_or`).

### Format suppression
> *"Like Black, Ruff supports `# fmt: on`, `# fmt: off`, and `# fmt: skip` pragma comments"* · *"`# fmt: on` and `# fmt: off` comments are enforced at the statement level"* · *"As such, adding `# fmt: on` and `# fmt: off` comments within expressions will have no effect."*
> *"Like Black, Ruff will also recognize YAPF's `# yapf: disable` and `# yapf: enable` pragma comments"*
> *"`# fmt: skip` comments suppress formatting for a case header, decorator, function definition, class definition, or the preceding statements on the same logical line."*
> *"Adding a `# fmt: skip` comment at the end of an expression will have no effect."*

### Conflicting lint rules (the list, verbatim, 0.16.6)
> *"Ruff's formatter is designed to be used alongside the linter. However, the linter includes some rules that, when enabled, can cause conflicts with the formatter, leading to unexpected behavior. When configured appropriately, the goal of Ruff's formatter-linter compatibility is such that running the formatter should never introduce new lint errors."*
> *"When using Ruff as a formatter, we recommend avoiding the following lint rules:"* `tab-indentation` (`W191`) · `indentation-with-invalid-multiple` (`E111`) · `indentation-with-invalid-multiple-comment` (`E114`) · `over-indented` (`E117`) · `incorrect-blank-line-before-class` (`D203`) · `docstring-tab-indentation` (`D206`) · `triple-single-quotes` (`D300`) · `bad-quotes-inline-string` (`Q000`) · `bad-quotes-multiline-string` (`Q001`) · `bad-quotes-docstring` (`Q002`) · `avoidable-escaped-quote` (`Q003`) · `unnecessary-escaped-quote` (`Q004`) · `missing-trailing-comma` (`COM812`) · `prohibited-trailing-comma` (`COM819`) · `multi-line-implicit-string-concatenation` (`ISC002`) *"if used without `ISC001` and `flake8-implicit-str-concat.allow-multiline = false`"*
> *"While the `line-too-long` (`E501`) rule can be used alongside the formatter, the formatter only makes a best-effort attempt to wrap lines at the configured `line-length`. As such, formatted code may exceed the line length, leading to `line-too-long` (`E501`) errors."*
> *"None of the above are included in Ruff's default configuration. However, if you've enabled any of these rules or their parent categories (like `Q`), we recommend disabling them via the linter's `lint.ignore` setting."*
isort settings to avoid: `force-single-line`, `force-wrap-aliases`, `lines-after-imports`, `lines-between-types`, `split-on-trailing-comma` (when non-default).
> *"When an incompatible lint rule or setting is enabled, `ruff format` will emit a warning. If your `ruff format` is free of warnings, you're good to go!"*
🔴 ISC001 is **not** in the 0.16.6 list. History: 0.9.0 (2025 style) *"Remove the `ISC001` incompatibility warning"* — formatter now joins implicit concatenations that fit, and *"This ensures compatibility with `ISC001`"* (black.md).

### Style guide, f-strings, fluent layout
> *"Similar to Black, Ruff implements formatting changes under the `preview` flag, promoting them to stable through minor releases, in accordance with our versioning policy."*
F-string formatting *"Stabilized in Ruff 0.9.0"* — *"Unlike Black, Ruff formats the expression parts of f-strings which are the parts inside the curly braces `{...}`."* · line breaks: *"it will only split the expression parts of an f-string across multiple lines if there was already a line break within any of the expression parts."*
Fluent layout for method chains = **preview** style (breaks before the first attribute).

### Sorting imports
> *"Currently, the Ruff formatter does not sort imports. In order to both sort imports and format, call the Ruff linter and then the formatter:"* `ruff check --select I --fix` then `ruff format`. *"A unified command for both linting and formatting is planned."* (issue #8232)

---

## §8 · Known deviations from Black — https://docs.astral.sh/ruff/formatter/black/

Headings (each with code): Trailing end-of-line comments (*"Ruff, like Prettier, expands any statement that contains trailing end-of-line comments."* · *"This deviation only impacts unformatted code, in that Ruff's output should not deviate for code that has already been formatted by Black."*) · Pragma comments are ignored when computing line width (*"Pragma comments (`# type`, `# noqa`, `# pyright`, `# pylint`, etc.) are ignored when computing the width of a line. This prevents Ruff from moving pragma comments around, thereby modifying their meaning and behavior"*; example `[first(),  # noqa / second()]` — Black collapses to `[first(), second()]  # noqa`) · Line width vs. line length (Unicode width) · Parenthesizing long nested-expressions (Black 24+ parenthesizes conditional expressions / annotations; Ruff does not yet) · Call expressions with a single multiline string argument · Blank lines at the start of a block (*"Black 24 and newer allows blank lines at the start of a block, where Ruff always removes them"* — NB 0.15.0 changelog: *"A single empty line is now permitted at the beginning of function bodies"*) · F-strings · Implicit concatenated strings (*"Ruff merges implicitly concatenated strings if the entire string fits on a single line"*) · `assert` statements (*"Ruff prefers breaking the message over breaking the assertion"*) · `global`/`nonlocal` continuations · Trailing own-line comments on imports · Parentheses around awaited collections · Implicit string concatenations in attribute accesses · Own-line comments on expressions · Tuples are parenthesized when expanded · Single-element tuples always parenthesized · Call-chain assignment values · Call chain calls break differently · Single `with` item targeting 3.8 or older · Last context manager collapsed · Preserving parentheses around single-element lists (*"The Black 2025 style or newer, on the other hand, removes the parentheses"*) · Long lambda expressions · Blank line between function and decorated class in stubs · Escaped quote in triple-quoted docstring.

FAQ: *"When migrating an existing project from Black to Ruff, you should expect to see a few differences on the margins, but the vast majority of your code should be unchanged."* · *"When run over non-Black-formatted code, the formatter makes some different decisions than Black, and so more deviations should be expected, especially around the treatment of end-of-line comments."*

---

## §9 · Preview — https://docs.astral.sh/ruff/preview/

> *"Preview mode enables a collection of unstable features such as new lint rules and fixes, formatter style changes, interface updates, and more. Warnings about deprecated features may turn into errors when using preview mode."*
> *"Enabling preview mode does not on its own enable all preview rules."*
> *"Preview mode can be enabled with the `--preview` flag on the CLI or by setting `preview = true` in your Ruff configuration file."*
> *"Preview mode can be configured separately for linting and formatting."* (`[tool.ruff.lint] preview = true` / `[tool.ruff.format] preview = true`)
> *"If a rule is marked as preview, it can only be selected if preview mode is enabled."* — not by exact code, not by prefix, not by `ALL`.
> *"When preview mode is enabled, selecting rule categories or prefixes will include all preview rules that match."*
> *"In our previous example, `--select` with `ALL` `HYP`, `HYP0`, or `HYP00` would not enable `HYP001`. Each preview rule will need to be selected with its exact code"* (with `explicit-preview-rules = true`) · *"If preview mode is not enabled, this setting has no effect."*
> *"When preview mode is enabled, deprecated rules will be disabled. If a deprecated rule is selected explicitly, an error will be raised. Deprecated rules will not be included if selected via a rule category or prefix."*

---

## §10 · Versioning — https://docs.astral.sh/ruff/versioning/

> *"Ruff uses a custom versioning scheme that uses the **minor** version number for breaking changes and the **patch** version number for bug fixes. Ruff does not yet have a stable API; once Ruff's API is stable, the **major** version number and semantic versioning will be used."*
Minor bumps when (verbatim items): *"A deprecated option or feature is removed"* · *"Configuration changes in a backwards incompatible way"* (*"This may occur in minor version changes until `1.0.0`, however, it should generally be avoided."*) · *"Support for a new file type is promoted to stable"* · *"Support for an end-of-life Python version is dropped"* · Linter: *"A rule is promoted to stable"*, *"The behavior of a stable rule is changed"*, *"Stable rules are added to the default set"*, *"Stable rules are removed from the default set"*, *"A safe fix for a rule is promoted to stable"*, *"A rule is deprecated"* · Formatter: *"The stable style changed"* · LSP: capability removed / deprecated setting removed.
Patch bumps when: *"Bugs are fixed, including behavior changes that fix bugs"* · *"A new configuration option is added in a backwards compatible way (no formatting changes or new lint errors)"* · *"Support for a new Python version is added"* · *"An option or feature is deprecated"* · Linter: *"An unsafe fix for a rule is added"*, *"A safe fix for a rule is added in preview"*, *"A fix's applicability is demoted"*, *"A rule is added in preview"*, *"The behavior of a preview rule is changed"* · Formatter: *"The stable style changed to prevent invalid syntax, changes to the program's semantics, or removal of comments"*, *"The preview style changed"*.
> *"The preview mode is not intended to gate access to work that is incomplete or features that we are likely to remove. However, **we reserve the right to make changes to any behavior gated by the mode** including the removal of preview features or rules."*
Rule stabilisation: *"New rules should always be added in preview mode"* · *"New rules will remain in preview mode for at least one minor release before being promoted to stable"* (*"If added in a patch release i.e. `0.6.1` then a rule will not be eligible for stability until `0.8.0`"*) · *"Stable rule behaviors are not changed significantly in patch versions"*.
VS Code extension: stable = even minor (`2024.30.0`), preview = odd minor.

---

## §11 · FAQ — https://docs.astral.sh/ruff/faq/

> *"Yes. The Ruff linter is compatible with Black out-of-the-box, as long as the `line-length` setting is consistent between the two."*
> *"Ruff is designed to be used alongside a formatter (like Ruff's own formatter, or Black) and, as such, will defer implementing stylistic rules that are obviated by automated formatting."*
> *"Ruff, on the other hand, will flag `line-too-long` (`E501`) for any line that exceeds the `line-length` setting. As such, if `line-too-long` (`E501`) is enabled, Ruff can still trigger line-length violations even when Black or `ruff format` is enabled."*
> *"Ruff can be used as a drop-in replacement for Flake8 when used (1) without or with a small number of plugins, (2) alongside Black, and (3) on Python 3 code."*
> *"Under those conditions, Ruff implements every rule in Flake8. In practice, that means Ruff implements all of the `F` rules (which originate from Pyflakes), along with a subset of the `E` and `W` rules (which originate from pycodestyle)."*
> *"Note that, in some cases, Ruff uses different rule codes and prefixes than would be found in the originating Flake8 plugins. For example, Ruff uses `TID252` to represent the `I252` rule from flake8-tidy-imports."*
> *"Beyond the rule set, Ruff's primary limitation vis-à-vis Flake8 is that it does not support custom lint rules. (Instead, popular Flake8 plugins are re-implemented in Rust as part of Ruff itself.) One minor difference is that Ruff doesn't include all the 'opinionated' rules from flake8-bugbear."*
Pylint: *"At time of writing, Pylint implements ~409 total rules, while Ruff implements over 900, of which at least 209 overlap"* · *"Ruff is not a "pure" drop-in replacement for Pylint (and vice versa), as they enforce different sets of rules."* · *"Ruff implements all rules natively and does not support custom or third-party rules. Unlike Pylint, Ruff is capable of automatically fixing its own lint violations."*
Type checkers: *"Ruff is a linter, not a type checker. It can detect some of the same problems that a type checker can, but a type checker will catch certain errors that Ruff would miss. The opposite is also true: Ruff will catch certain errors that a type checker would typically ignore."* · *"a type checker could flag that you passed an integer argument to a function that expects a string, which Ruff would miss. The tools are complementary."* · *"It's recommended that you use Ruff in conjunction with a type checker, like Mypy, Pyright, or Pyre"*.
Replaces: *"Ruff can also replace Black, isort, yesqa, eradicate, and most of the rules implemented in pyupgrade."*
> *"Nope! Ruff's linter and formatter can be used independently of one another -- you can use Ruff as a formatter, but not a linter, or vice versa."*
> *"Ruff can lint code for any Python version from 3.7 onwards, including Python 3.13."* (FAQ text is dated; the 0.16.6 CLI accepts `py37`…`py315`.)
> *"Ruff does not yet support third-party plugins, though a plugin system is within-scope for the project."*
isort: *"Ruff's import sorting is intended to be near-equivalent to isort's when using isort's `profile = "black"`."* · aliased-import grouping difference example (`from numpy import cos, int8, ...` vs isort splitting at alias boundaries) · *"Ruff also correctly classifies some modules as standard-library that aren't recognized by isort, like `_string` and `idlelib`."*
First-party detection: *"Ruff accepts a `src` option that ... specifies the directories that Ruff should consider when determining whether an import is first-party."* · *"For module paths with multiple components like `import foo.bar`, Ruff will require that the full relative path `foo/bar` exists as a directory, or that `foo/bar.py` or `foo/bar.pyi` exist as files."* · *"If there is a directory whose name matches a third-party package, but does not contain Python code, it could happen that the above algorithm incorrectly infers an import to be first-party. To prevent this, you can modify the `known-third-party` setting."* (example `known-third-party = ["wandb"]`) · *"If the `src` field is omitted, Ruff will default to using the "project root", along with a `"src"` subdirectory, as the first-party sources, to support both flat and nested project layouts."* · *"If your `pyproject.toml`, `ruff.toml`, or `.ruff.toml` extends another configuration file, Ruff will still use the directory containing your `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file as the project root (as opposed to the directory of the file pointed to via the `extends` option)."* (example in `tests/`: `extend = "../pyproject.toml"`, `src = ["../src"]`) · same-package heuristic via `__init__.py`.
Docstrings: *"Enabling a `convention` will disable any rules that are not included in the specified convention."* · *"By default, no `convention` is set"*.
> *"Run `ruff check /path/to/code.py --show-settings` to view the resolved settings for a given file."*
> *"Ruff doesn't currently support INI files, like `setup.cfg` or `tox.ini`."*
User config: *"When no configuration file is found, Ruff will look for a user-specific `ruff.toml` file as a last resort."* · *"On macOS and Linux, Ruff expects that file to be located at `~/.config/ruff/ruff.toml`, and respects the `XDG_CONFIG_HOME` specification."* · Windows `~\AppData\Roaming\ruff\ruff.toml`. **[source]** `find_user_settings_toml()` searches `.ruff.toml`, then `ruff.toml`, then `pyproject.toml` in that directory — so configuration.md (`pyproject.toml`) and the FAQ (`ruff.toml`) are both partial.
Notebooks in editors: *"Ruff does not support `source.organizeImports` and `source.fixAll` code actions in Jupyter Notebooks"* — use `notebook.source.*`.
Colour: `NO_COLOR`, `FORCE_COLOR`.

---

## §12 · Integrations / installation / tutorial

https://docs.astral.sh/ruff/integrations/
GitHub Actions snippet: `pip install ruff` then `ruff check --output-format=github .` with comment *"Update output format to enable automatic inline annotations."*
`ruff-action`: *"By default, `ruff-action` runs as a pass-fail test to ensure that a given repository doesn't contain any lint rule violations as per its configuration."* (the 0.16.6 docs page still shows `astral-sh/ruff-action@v3` and *"`version`: The Ruff version to install (default: latest)."* — superseded by the action's own README, §21).
GitLab: image `ghcr.io/astral-sh/ruff:0.16.6-alpine`; `ruff check --output-format=gitlab --output-file=code-quality-report.json`; `ruff format --diff`.
pre-commit: `rev: v0.16.6`, hooks `ruff-check` + `ruff-format`; *"When running with `--fix`, Ruff's lint hook should be placed before Ruff's formatter hook, and before Black, isort, and other formatting tools, as Ruff's fix behavior can output code changes that require reformatting."* · *"When running without `--fix`, Ruff's formatter hook can be placed before or after Ruff's lint hook."* · *"(As long as your Ruff configuration avoids any linter-formatter incompatibilities, `ruff format` should never introduce new lint errors, so it's safe to run Ruff's format hook after `ruff check --fix`.)"*
Docker tags: `ruff:latest`, `ruff:{major}.{minor}.{patch}`, `ruff:{major}.{minor}` (*"the latest patch version"*), alpine / debian-slim / debian variants.

https://docs.astral.sh/ruff/installation/ — `uvx ruff@0.16.6 check`, `uvx ruff@0.16.6 format`; *"Or installed with `uv` (recommended), `pip`, or `pipx`"*: `uv tool install ruff@latest`, `uv add --dev ruff`, `pip install ruff`, `pipx install ruff`; standalone installers since 0.5.0; brew/conda/pkgx/pacman/apk/zypper; `ghcr.io/astral-sh/ruff`.
FAQ: *"Ruff ships with wheels for all major platforms, which enables `uv`, `pip`, and other tools to install Ruff without relying on a Rust toolchain at all."*

https://docs.astral.sh/ruff/tutorial/ — `uv init --lib numbers`; `uv add --dev ruff`; `uv run ruff check`; `uv run ruff check --fix`; `uv run ruff format`; *"To determine the appropriate settings for each Python file, Ruff looks for the first `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file in the file's directory or any parent directory."* · E501 comment: *"By default, Ruff omits rules that overlap with the use of a formatter, like Black, but we can override this behavior by explicitly adding the rule."* · *"Ruff supports over 900 lint rules split across over 50 built-in plugins"* · *"By default, Ruff enables rules from the `F`, `E`, `B`, `UP`, and `RUF` categories, as well as many more, omitting any stylistic rules that overlap with the use of a formatter, like `ruff format` or Black."* · *"If you're introducing a linter for the first time, the default rule set is a great place to start"* · Adding rules: *"When enabling a new rule on an existing codebase, you may want to ignore all existing violations of that rule and instead focus on enforcing it going forward."*

---

## §13 · Editors — https://docs.astral.sh/ruff/editors/ (+ /settings/, /features/)

> *"The editor integration is mainly powered by the Ruff Language Server which implements the Language Server Protocol. The server is written in Rust and is available as part of the `ruff` CLI via `ruff server`. It is a single, common backend built directly into Ruff, and a direct replacement for `ruff-lsp`, our previous language server."*
> *"Currently, the server is intended to be used alongside another Python Language Server in order to support features like navigation and autocompletion."*
> *"The Ruff Language Server was available first in Ruff v0.4.5 in beta and stabilized in Ruff v0.5.3."*
Resolution order in an editor (highest first): *"Specific settings: Individual settings like `lineLength` or `lint.select` defined in the editor"* · *"`ruff.configuration`"* · *"Configuration file: Settings defined in a `ruff.toml` or `pyproject.toml` file in the project's directory (if present)"*.
`configurationPreference`: *"By default, editor configuration is prioritized over `ruff.toml` and `pyproject.toml` files."* values `editorFirst` (default) | `filesystemFirst` | `editorOnly`.
`importStrategy` (VS Code): *"`fromEnvironment` finds Ruff in the environment, falling back to the bundled version"* · *"`useBundled` uses the version bundled with the extension"* · default `fromEnvironment`.
`path`: *"A list of path to `ruff` executables. The first executable in the list which is exists is used. This setting takes precedence over the `ruff.importStrategy` setting."*
`nativeServer` default `"auto"` (native if ruff ≥ 0.5.3 unless deprecated settings).
Features: *"The server dynamically refreshes the diagnostics when a configuration file is changed in the workspace"* (needs editor file-watching) · code actions incl. *"Ignore a diagnostic with a `# noqa` comment."*, fix all, organize imports · on-save: `"source.fixAll.ruff": "explicit"`, `"source.organizeImports.ruff": "explicit"`.

---

## §14 · CHANGELOG facts by version (https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md + /changelogs/*.md)

- **0.16.6** (2026-09-03): preview: `pytest-fixture-autouse` to `restriction`; PT020 autofix; TID254/TID255 loop fix; I001 excludes pragma comments from line length (preview). Bugs: RUF102 hint; PTH208 display-only fix.
- **0.16.5** (2026-08-27): preview: *"Allow rules without codes"*, *"Introduce category selectors"*, *"Update preview default rules and categories"*; docs for category selectors.
- **0.16.4** (2026-08-20): server *"Offer display-only fixes and mark safe fixes preferred"*; docs *"Add default indicator to rules table"*.
- **0.16.3** (2026-08-13): PGO builds; `--statistics` hyperlinks.
- **0.16.2** (2026-08-06): server excludes TOML from formatting capabilities.
- **0.16.1** (2026-07-30): *"Lint TOML files in the LSP"*; `PT022` and `FURB105` fixes marked unsafe; preview: *"Add an option to opt out of human-readable names"*.
- **0.16.0** (2026-07-23) BREAKING (verbatim): *"Ruff now enables a much larger set of rules by default (413, up from 59)."* · *"Note that this is primarily an expansion, but 18 of the more opinionated pycodestyle (`E`) and pyflakes (`F`) rules have been removed from the default set: `E401`, `E402`, `E701`, `E702`, `E703`, `E711`, `E712`, `E713`, `E714`, `E721`, `E731`, `E741`, `E742`, `E743`, `F403`, `F405`, `F406`, and `F722`."* · *"Ruff can now format Python code blocks in Markdown files and will do this by default."* · *"Ruff now supports `ruff: ignore` comments at the ends of lines, like `noqa` comments, or on the line preceding a diagnostic."* · *"Fixes are now shown in `check` and `format --check` output"* · *"`format --check` now supports the same output formats as the linter, including the `github` and `gitlab` outputs for rendering annotations in CI"* · JSON `filename`/`location`/… *"may now be `null`"*. Stabilised rules incl. CPY001, FURB164, FURB192, ISC004, LOG004, PLE0304, PLR0917, PLR1708, RUF036, RUF063, RUF068. Rule change: *"Insert a space after the colon in Ruff suppression comments"*.
- **0.15.22** (2026-07-16) preview: RUF105 (replace `noqa` with `ruff:ignore`), RUF106, RUF201; E402 autofix (preview).
- **0.15.21** (2026-07-09) preview: *"Add `--add-ignore` for adding `ruff:ignore` comments"*.
- **0.15.20** (2026-06-25) preview: *"Allow human-readable names in rule selectors"*; *"Emit a warning instead of an error for unknown rule selectors"* (preview).
- **0.15.17** (2026-06-11) preview: *"Allow human-readable names in suppression comments"*; *"Prioritize human-readable names in CLI output"*.
- **0.15.12** (2026-04-24) preview: *"Implement `#ruff:file-ignore` file-level suppressions"*, *"Implement `#ruff:ignore` logical-line suppressions"*.
- **0.15.9** (2026-04-02): *"Add `nested-string-quote-style` formatting option"*.
- **0.15.2** (2026-02-19) preview: *"In preview, Ruff now enables a significantly expanded default rule set of 412 rules, up from the stable default set of 59 rules."*
- **0.15.0** (2026-02-03) BREAKING: *"Ruff now formats your code according to the 2026 style guide."* · *"The linter now supports block suppression comments."* (`ruff: disable[N803]` … `ruff: enable[N803]`) · *"Ruff now resolves all `extend`ed configuration files before falling back on a default Python version."* · Alpine 3.23 / Debian 13 images; no ppc64 binaries. 2026 style: lambda parameters kept on one line + body parenthesised; *"Parentheses around tuples of exceptions in `except` clauses will now be removed on Python 3.14 and later"*; *"A single empty line is now permitted at the beginning of function bodies"*; match `as` captures; escaped-quote spacing; blank lines before decorated classes in stubs. Stabilised: RUF102 (`invalid-rule-code`), RUF103 (`invalid-suppression-comment`), RUF104 (`unmatched-suppression-comment`) and others. *"the `full` output format is now used by default"* in `--watch`. Preview: Markdown code-block formatting.
- **0.14.0** (2025-10-07) BREAKING: *"Update default and latest Python versions for 3.14"* — **[source]** `impl Default for PythonVersion` is `PY39` at tag 0.13.0 and `PY310` at 0.14.0, 0.15.0, 0.16.0, 0.16.6.
- **0.13.0**: *"Several rules can now add `from __future__ import annotations` automatically"* (with `lint.future-annotations`) · *"Full module paths are now used to verify first-party modules"* · *"Deprecated rules must now be selected by exact rule code"*.
- **0.12.0**: *"Ruff will default to the latest supported Python version (3.13) when checking for the version-related syntax errors ... The default in all other cases, like applying lint rules, is unchanged and remains at the minimum supported Python version (3.9)."*
- **0.11.0** (0.10 follow-up): requires-python inference changes — *"`pyproject.toml` files without a `[tool.ruff]` section would be ignored, including the `requires-python` setting."* → now: ruff.toml without target-version checks the sibling pyproject.toml's requires-python, etc.
- **0.9.0** BREAKING: *"Ruff now formats your code according to the 2025 style guide."* incl. *"Format expressions in f-string elements"*, *"Automatically join an implicitly concatenated string into a single string literal if it fits on a single line"*, *"Remove the `ISC001` incompatibility warning"*, *"Prefer parenthesizing the `assert` message over breaking the assertion expression"*.
- **0.8.0**: *"Default to Python 3.9"*; remapped `TCH` → `TC` (flake8-type-checking); E999 removed (*"Removed (since 0.8.0)"* — *"Syntax errors will always be shown regardless of whether this rule is selected or not."*).
- **0.6.0**: notebooks linted/formatted by default. **0.5.0**: standalone installers; user config path change on macOS. **0.4.5/0.5.3**: `ruff server` beta / stable.

## §15 · 0.16.0 blog — https://astral.sh/blog/ruff-v0.16.0

> *"Ruff now enables 413 rules by default, up from 59 in previous versions."*
> *"Since Ruff's default rule set was last modified in v0.1.0, the number of rules in Ruff has grown from 708 to 968."*
> *"Even if you're already using `select` or `extend-select`, we hope that this will draw your attention to helpful rules that you previously hadn't discovered."*
> *"If you want to revert to the old default set, you can easily `select` the old rules with this configuration:"* → `select = ["E4", "E7", "E9", "F"]`
> *"`ruff: ignore` can be used to suppress a diagnostic on the same line, like `noqa`, or on the following logical line"*
> *"`ruff: file-ignore` comments can be used to suppress diagnostics for the entire file, just like `ruff: noqa` comments"*
> *"each of these comment kinds can have an associated "reason" explaining why they were added"*
> *"`ruff: ignore` comments can be added automatically with the new `--add-ignore` CLI flag, and in preview, all of these `ruff` suppression comments support rule names instead of codes"*
> *"In v0.16, available fixes are now shown as part of the default `full` output format, rendered below the `help` subdiagnostic"*
> *"This should affect very few of Ruff's existing diagnostics but better reflects the internal diagnostic representation and may become more common in future rules."* (JSON nulls)

## §16 · Default Rules page @ 0.16.6 — https://docs.astral.sh/ruff/default-rules/

413 codes. Per prefix: YTT 10 · ASYNC 10 · S 3 (S102 S110 S112) · BLE 1 · B 29 · C 17 (C4xx) · DTZ 10 · T 1 (T100) · EXE 4 · FA 2 · INT 3 · ISC 1 (ISC004) · LOG 5 · G 4 · PIE 8 · PYI 47 · PT 6 · RET 1 · SIM 21 · TC 4 · PTH 2 · FLY 1 · **I 1 (I001)** · N 1 (N999) · PERF 3 · **E 2 (E722, E902)** · W 1 (W605) · D 1 (D419) · F 39 · PGH 1 (PGH005) · PLC 8 · PLE 33 · PLR 13 · PLW 20 · **UP 42** (incl. UP006, UP007, UP035, UP045) · FURB 17 · **RUF 36** (incl. **RUF100**, RUF101, RUF200, RUF012, RUF015) · TRY 5.
NOT in the default: E501, E4xx, E7xx except E722, D1xx, S101, T201, COM812, ISC001, ERA001, ANN, ARG, N8xx, B904.
Rules index intro (live): *"By default, Ruff enables rules from the `F`, `E`, `B`, `UP`, and `RUF` categories, as well as many more, omitting any stylistic rules that overlap with the use of a formatter, like `ruff format` or Black."* Legend: 🧪 preview · ⚠️ deprecated · ❌ removed · 🛠️ fixable · ✅ enabled by default. *"All rules not marked as preview, deprecated or removed are stable."*

## §17 · Rule pages (live, 0.16.6)

- **RUF100 unused-noqa**: *"Checks for `noqa` directives that are no longer applicable."* · *"When using `RUF100` with the `--fix` option, Ruff may remove trailing comments that follow a `# noqa` directive on the same line, as it interprets the remainder of the line as a description for the suppression."* · *"To prevent Ruff from removing suppressions for other tools (like `pylint` or `mypy`), separate them with a second `#` character"* (`# noqa: N802 # pylint: disable=invalid-name`) · *"This rule ignores any codes that are unknown to Ruff, as it can't determine if the codes are valid or used by other tools. Enable `invalid-rule-code` to flag any unknown rule codes."* **[source]** message template `Unused {kind} ({unused: …; non-enabled: …; duplicated: …})`, kind = "`noqa` directive" or "suppression"; blanket: `Unused blanket {kind}`.
- **F401 unused-import**: redundant alias `from module import member as member` or `__all__` to re-export · *"Fixes to remove unused imports are safe, except in `__init__.py` files."* · *"Applying fixes to `__init__.py` files is currently in preview."*
- **E501 line-too-long**: exemptions — single "word" lines; lines ending with a URL starting before the limit; lines ending with a pragma comment (`# type: ignore`, `# noqa`) starting before the limit; SPDX/copyright lines · *"By default, this rule enforces a limit of 88 characters for compatibility with Black and the Ruff formatter"*.
- **COM812 missing-trailing-comma**: *"We recommend against using this rule alongside the formatter. The formatter enforces consistent use of trailing commas, making the rule redundant."*
- **ISC001**: *"code formatters are capable of introducing single-line implicit concatenations when collapsing long lines."*
- **I001 unsorted-imports**: *"De-duplicates, groups, and sorts imports based on the provided `isort` settings."* Fix sometimes available.
- **F841 unused-variable**: *"This rule's fix is marked as unsafe because removing an unused variable assignment may delete comments that are attached to the assignment."*
- **B006 mutable-argument-default**: *"This fix is marked as unsafe because it replaces the mutable default with `None` and initializes it in the function body, which may not be what the user intended"*.
- **PGH004 blanket-noqa**: *"Check for `noqa` annotations that suppress all diagnostics, as opposed to targeting specific diagnostics."* · missing-colon repair.
- **RUF102 invalid-rule-code** (added 0.15.0): *"Checks for `noqa` codes that are invalid."* · *"This rule will flag rule codes that are unknown to Ruff, even if they are valid for other tools."* → `lint.external`.
- **UP007**: *"This rule is enabled when targeting Python 3.10 or later (see: `target-version`)."* · *"This rule's fix is marked as unsafe on Python versions prior to 3.10 because using the PEP-604 syntax may lead to runtime errors in libraries that rely on runtime type annotations, like Pydantic"*.
- **UP035 deprecated-import**: *"Checks for uses of deprecated imports based on the minimum supported Python version."*
- **E203** whitespace-before-punctuation: *"Preview (since v0.0.269)"*.
- **E999** syntax-error: *"Removed (since 0.8.0)"*.
- **RUF200** invalid-pyproject-toml: *"Checks for any pyproject.toml that does not conform to the schema from the relevant PEPs."* (in the default set)

## §18 · Source facts @ tag 0.16.6 [source]

- `crates/ruff_workspace/src/options.rs`: `#[serde(deny_unknown_fields, rename_all = "kebab-case")]` on `Options`, `LintOptions`, `LintCommonOptions`, plugin option structs ⇒ an unknown key inside `[tool.ruff…]` is a parse error. `validate_required_version` error: ``Required version `{required_version}` does not match the running version `{RUFF_PKG_VERSION}` ``.
- `pyproject.rs::parse_toml`: *"Inspect `required-version` without triggering strict deserialization errors."* (required-version checked before strict parsing). `load_options`: for a `pyproject.toml`, if `[tool.ruff]` has no `target-version`, `project.requires-python`'s minimum (`==`, `==*`, `===`, `~=`, `>`, `>=` specifiers, major.minor) becomes `target-version` — applies to a `pyproject.toml` passed with `--config` too. `find_user_settings_toml`: `.ruff.toml` → `ruff.toml` → `pyproject.toml` under `<config_dir>/ruff/`.
- `configuration.rs` warnings/errors (templates): ``Selection `{code}` has no effect because preview is not enabled.`` · ``Rule `{code}` is deprecated and will be removed in a future release.`` · ``Selection of deprecated rule `{code}` is not allowed when preview is enabled.`` · ``Rule `{code}` was removed and cannot be selected.`` · `The following rules have been removed and ignoring them has no effect:` · ``` `{from}` has been remapped to `{prefix}{code}`. ``` · `The top-level linter settings are deprecated in favour of their counterparts in the `lint` section. Please update the following options in {file}:` with lines `- 'select' -> 'lint.select'`.
- `registry.rs` INCOMPATIBLE_CODES: D203 vs D211 → *"Ignoring `incorrect-blank-line-before-class`."*; D212 vs D213 → *"Ignoring `multi-line-summary-second-line`."*
- `resolver.rs`: each file in an `extend` chain is loaded with its own directory as project root; `extend` path resolved relative to the extending file; cycle error ``Circular configuration detected: `a` extends `b` extends `a` ``; load failure ``Failed to load extended configuration `{path}` ({chain})``.
- `ruff/src/commands/format.rs::warn_incompatible_formatter_settings` — emitted by **`ruff format`**: unconditionally for COM812 and D203 when enabled (*"The following rule may cause conflicts when used with the formatter: {rule}. To avoid unexpected behavior, we recommend disabling this rule, either by removing it from the `lint.select` or `lint.extend-select` configuration, or adding it to the `lint.ignore` configuration."*); conditionally for W191+tab indent, D206+tab, E111/E114+indent-width≠4, Q000/Q003 vs quote-style mismatch, Q001, Q002, ISC `allow-multiline=false` without ISC001, isort `lines-after-imports` ∉ {-1,1,2}, `lines-between-types` > 1, `force-wrap-aliases`/`split-on-trailing-comma` with `skip-magic-trailing-comma=true`.
- `ruff/src/printer.rs` summary templates: `Found {total} error{s} ({fixed} fixed, {remaining} remaining).` · ``{fix_prefix} {n} fixable with the `--fix` option ({m} hidden fix{es} can be enabled with the `--unsafe-fixes` option).`` · ``No fixes available ({m} hidden fix{es} can be enabled with the `--unsafe-fixes` option).``
- `ruff_linter/src/noqa.rs`: ``Unexpected `# ruff: noqa` directive at {path}:{line}. File-level suppression comments must appear on their own line. For line-level suppression, omit the `ruff:` prefix.`` · ``Invalid `# ruff: noqa` directive at {path}:{line}: {err}`` · `Missing or joined rule code(s) at {path}:{line}: expected comma or space delimiter between codes`.
- `ruff/src/cache.rs`: cache dir gets `CACHEDIR.TAG` and a `.gitignore` containing `# Automatically created by ruff.` + `*`.
- per-file-ignores: each pattern compiled into an absolute matcher (normalised to the project root) and a basename matcher; leading `!` negates.

## §19 · ruff-pre-commit @ v0.16.6 — https://github.com/astral-sh/ruff-pre-commit

> *"Distributed as a standalone repository to enable installing Ruff via prebuilt wheels from PyPI."*
Hooks manifest (`.pre-commit-hooks.yaml`): `ruff-check` — `entry: ruff check --force-exclude`, `types_or: [python, pyi, jupyter]`, `require_serial: true`, `minimum_pre_commit_version: "2.9.2"`; `ruff-format` — `entry: ruff format --force-exclude`, `types_or: [python, pyi, jupyter, markdown]`; `ruff` — *"ruff (legacy alias)"*, same as `ruff-check`. The repo's own `pyproject.toml` depends on `ruff==0.16.6` (the `rev` IS the ruff version).
> *"By default, the format hook also formats Python code blocks in Markdown files."*
> *"To select or ignore specific rules, pass the relevant Ruff arguments through `args`. When using inline YAML lists, quote arguments that contain commas"* (`args: [ --fix, "--extend-select=I,E", "--ignore=F401" ]`)
> *"To lint `pyproject.toml`, add `pyproject` to the list of allowed filetypes (requires `identify>=2.6.18`)"*
Ordering text identical to §12. prek `prek.toml` example also given.

## §20 · pre-commit.com (pre-commit 4.6.2 docs)

> *"The hook must exit nonzero on failure or modify files."* (Creating new hooks)
> `unsupported`: *"new in 4.4.0: previously `language: system`. the alias will be removed in a future version"* — *"This hook type will not be given a virtual environment to work with"*.
> *"When creating local hooks, there's no reason to put command arguments into args as there is nothing which can override them -- instead put your arguments directly in the hook entry."*
> *"A local hook must define `id`, `name`, `language`, `entry`, and `files` / `types`"*.

## §21 · ruff-action — https://github.com/astral-sh/ruff-action (README on main; latest release v4.1.0, 2026-07-05)

Inputs: `version` — *"discovered from `pyproject.toml`, else `latest`"*; `version-file`; `args` default `check`; `src` default `[github.workspace]`; `checksum`.
> *"By default this action searches upward from `src` until the workspace root to find the nearest `pyproject.toml` and determine the Ruff version to install. If no `pyproject.toml` file is found, or no Ruff version is defined in `project.dependencies`, `project.optional-dependencies`, `dependency-groups`, or supported Poetry dependency tables, the latest version is installed."*
> *"Currently `pyproject.toml`, `requirements.txt` and `uv.lock` are supported. If the file cannot be parsed or does not contain a Ruff version, the action warns and falls back to `latest`."*
Precedence: `version` → `version-file` → nearest `pyproject.toml` → `latest`. `args: "format --check --diff"` example.

---

## §22 · Could NOT confirm — and what the pages say instead

1. **`ruff: file-ignore` and `--add-ignore` stability.** The 0.16.0 changelog's breaking list names only `ruff: ignore`; the 0.16.0 **blog** presents `file-ignore` and `--add-ignore` as part of v0.16 ("newly stabilized features" section). linter.md @0.16.6 documents both without a preview marker and says `--add-ignore` uses codes "on stable". Pages say: available in 0.16 (blog), rule *names* in them are preview-only.
2. **Exact text an OLDER ruff prints on an unknown config key** (e.g. `nested-string-quote-style` read by a pre-0.15.9 ruff). Only the 0.16.6 source (`deny_unknown_fields`) was read. Pages say it is a parse error and do not quote older wording.
3. **Whether `--output-format=github` is auto-selected on GitHub Actions.** Not documented; pages pass it explicitly.
4. **`exclude` and `include` defaults** — configuration.md prose and the options.rs default strings disagree (see §5). Pages quote configuration.md's list for `exclude` and the changelog for Markdown discovery, and flag the inconsistency instead of asserting one list.
5. **Whether `ruff format` fails (exit 2) or skips a file with a syntax error.** Not settled by the docs read; pages do not claim either.
6. **Glob semantics of `*` across `/` in per-file-ignores.** globset's default was not re-read; pages avoid claiming `*` does or does not cross directories and recommend `**` explicitly.
7. **The full list of Black-compatible behaviours changed by the 2026 style guide beyond the 0.15.0 changelog bullets.** Pages cite only the changelog bullets.
8. **Blank lines at block start**: known-deviations says Ruff removes them; 0.15.0 says one empty line is now permitted at the start of *function bodies*. Pages state both, scoped exactly as written.
9. **FAQ "3.7 onwards, including Python 3.13"** is stale prose; the CLI enumerates py37…py315 (py315 appears in CLI help; the settings `value_type` string lists up to py314). Pages cite the CLI help and do not claim a support policy.

---

## 2026-09-10 additions (chunks 11–14: CI, pinning, editors, upgrading)

Fetched 2026-09-10 by the closing session. Raw docs at tag `0.16.6` unless noted.

### GitHub Action versions — checked 2026-09-10 on each repo's releases + tag list (`gh release list`, `gh api …/git/matching-refs/tags/v`)
- `actions/checkout` latest **v7.0.1** (2026-07-20), floating `v7` tag EXISTS. SHA `3d3c42e5aac5ba805825da76410c181273ba90b1`. v7.0.0 notes: *"block checking out fork pr for pull_request_target and workflow_run"*. `action.yml` @v7.0.1: `fetch-depth` *"Number of commits to fetch. 0 indicates all history for all branches and tags."* default `1`; `persist-credentials` default `true`.
- `astral-sh/setup-uv` latest **v10.0.1** (2026-08-14). 🔴 **NO floating `v8`/`v9`/`v10` tag exists** — last floating major is `v7`. v8.0.0 notes (verbatim): *"To increase **security** even more we will **stop publishing minor tags**. You won't be able to use `@v8` or `@v8.0` any longer."* · *"Use the immutable tag as a version `astral-sh/setup-uv@v8.0.0` Or even better the githash"*. So `setup-uv@v10` does not resolve. SHA of v10.0.1 `20cfd1bf945f4377ade1205e4dbc17946fc9a30d`. v10.0.0: *"If you use the default `enable-cache: auto` this will now **DISABLE THE CACHE** to protect against cache poisoning for the following events: `pull_request_target` `workflow_run` `release`"*. README inputs: `version` (*"e.g., "0.5.0", "latest", or "latest-known" (default: searches for version in config files, then latest)"*), `version-file`, `enable-cache: "auto"` (*"enabled on GitHub-hosted runners except for release, tag push, pull_request_target, and workflow_run events; disabled on self-hosted runners"*), `python-version`, `activate-environment`, `working-directory`. *"If you do not specify a version, this action will look for a required-version in a `uv.toml` or `pyproject.toml` file in the repository root. If none is found, the latest version will be installed."* · *"Running `actions/checkout` after `setup-uv` **is not supported**."* · *"No, `setup-uv` alone won't install any libraries from your `pyproject.toml` or `requirements.txt`, it only sets up `uv`."*
- `astral-sh/ruff-action` latest **v4.1.0** (2026-07-05). 🔴 **NO floating `v4` tag** (tags `v1` `v2` `v3` float; `v4.0.0`, `v4.1.0` only). v4.0.0: *"This is the first immutable release of `ruff-action`"* · node24 *"might be a breaking change on very old self-hosted runners"*. SHA v4.1.0 `278981a28ce3188b1e39527901f38254bf3aac89`. README @v4.1.0 inputs table: `version` default *"discovered from `pyproject.toml`, else `latest`"*, `version-file`, `manifest-file`, `download-from-astral-mirror` (default `true`), `args` default `check`, `src` default `[github.workspace]`, `checksum`, `github-token`. Output `ruff-version`. *"This action adds ruff to the PATH, so you can use it in subsequent steps."* · `args: "format --check --diff"` · *"When using multiple patterns, only the first is used to search for `pyproject.toml` to determine the Ruff version."*
  **[source @v4.1.0]** `src/version/version-request-resolver.ts`: resolvers in order explicit `version` → `version-file` → `WorkspaceVersionResolver` (nearest **pyproject.toml only**, searched upward from `src` to `GITHUB_WORKSPACE`) → `latest`; both `version` and `version-file` → error *"It is not allowed to specify both version and version-file"*. `src/version/resolve.ts`: a range specifier resolves with `maxSatisfying` over all versions ⇒ **`ruff>=0.16.6` in pyproject installs the newest ruff, not the locked one**. `uv.lock` is parsed only when passed as `version-file` (release note says *"This works automatically if you haven't overridden the version discovery"* — the source's automatic path reads only pyproject.toml; pages say pass `version-file: uv.lock`).
- `github/codeql-action` latest **v4.38.0** (2026-09-09), floating `v4` exists. `upload-sarif/action.yml`: token *"the workflow must have the `security-events: write` permission"*.
- `astral-sh/ruff-vscode` latest **2026.78.0** (2026-09-03); its `pyproject.toml` pins `ruff==0.16.6` (bundled binary tracks the ruff release).

### ruff integrations.md @0.16.6 (stale bits)
Still shows `actions/checkout@v4`, `astral-sh/ruff-action@v3`, and *"`src`: The source paths to pass to Ruff (default: `[".", "src"]`)"* and *"`version`: The Ruff version to install (default: latest)."* — both superseded by the action README. Docker list still says `alpine:3.20`/bookworm while BREAKING_CHANGES 0.15.0 says Alpine 3.23 / Debian 13.

### CLI source `crates/ruff/src/args.rs` @0.16.6 [source]
- `check`: `output_format` `env = "RUFF_OUTPUT_FORMAT"` (*"Output serialization format for violations. The default serialization format is "full"."*); `output_file` `env = "RUFF_OUTPUT_FILE"`; `RUFF_NO_CACHE`, `RUFF_CACHE_DIR`.
- `format`: `output_format` `env = "RUFF_OUTPUT_FORMAT"` (*"Output serialization format for violations, when used with `--check`."*); `exit_non_zero_on_format` has `alias = "exit-non-zero-on-fix"` (*"Exit with a non-zero status code if any files were modified via format, even if all files were formatted successfully."*).
- `gh search code GITHUB_ACTIONS --repo astral-sh/ruff` (default branch, 2026-09-10): **no match** ⇒ ruff does not auto-select the `github` format on a runner.

### BREAKING_CHANGES.md @0.16.6 — https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md
One `##` section per breaking minor (0.16.0, 0.15.0, 0.14.0, …). 0.16.0 items: New default rules · Markdown code block formatting · `ruff: ignore` · Fix diffs in output · *"`format --check` now supports the same output formats as the linter, including the `github` and `gitlab` outputs for rendering annotations in CI"* (example line quoted: `::error title=ruff (unformatted),file=try.md,line=2,col=8,endLine=2,endColumn=10::try.md:2:8: unformatted: File would be reformatted`) · JSON fields may be `null`. 0.15.0: 2026 style · block suppressions · Alpine 3.23 / Debian 13 images · no ppc64 · *"Ruff now resolves all `extend`ed configuration files before falling back on a default Python version."* 0.14.0: *"Ruff now defaults to Python 3.10 instead of 3.9 if no explicit Python version is configured"*.

### Editors @0.16.6 — https://docs.astral.sh/ruff/editors/setup/ · /settings/ · /features/
- setup: *"Regardless of the editor, it is recommended to disable the older language server (`ruff-lsp`) to prevent any conflicts."* · VS Code: *"It is recommended to have the Ruff extension version `2024.32.0` or later"* · Neovim 0.11+: `nvim/lsp/ruff.lua` returning `{ cmd = { 'ruff', 'server' }, filetypes = { 'python' }, root_markers = { 'pyproject.toml', 'ruff.toml', '.ruff.toml', '.git' }, init_options = { settings = {} } }` + `vim.lsp.enable('ruff')`; hover-disable autocmd (`client.server_capabilities.hoverProvider = false`); pyright `disableOrganizeImports = true`, `python.analysis.ignore = { '*' }`. Helix `[language-server.ruff] command = "ruff" args = ["server"]`; *"Support for multiple language servers for a language is only available in Helix version `23.10` and later."* PyCharm: *"Starting with version 2025.3, PyCharm supports Ruff out of the box"* — Execution mode **Interpreter** / **Path**. Zed: *"Ruff support is now built into Zed (no separate extension required)."* · *"By default, Zed uses Ruff for formatting and linting."* · `format_on_save` *"is enabled by default"*. Kate: *"Kate's LSP Client plugin does not support multiple servers for the same language."*
- settings: `configuration` — *"The default behavior, if `configuration` is unset, is to load the settings from the project's configuration (a `ruff.toml` or `pyproject.toml` in the project's directory), consistent with when running Ruff on the command-line."* Inline JSON *"introduced in Ruff `0.9.8`"*. Resolution order (quoted in §13). `configurationPreference` default `"editorFirst"` — *"`"filesystemFirst"`: Configuration files present in the workspace takes priority over editor settings."* · *"`"editorOnly"`: Ignore configuration files entirely"*. `lineLength` *"The line length to use for the linter and formatter."* default null. `fixAll`/`organizeImports` default `true` (register code-action capability). `showSyntaxErrors` default `true`. `lint.enable` default `true`. `format.backend` `"internal"` | `"uv"` (*"requires uv >= 0.8.13"*; *"for `uv`, the formatter version may differ"*). VS Code-only: `importStrategy` (*"`fromEnvironment` finds Ruff in the environment, falling back to the bundled version"*), `interpreter` (*"only the first interpreter is used"*; with native server *"used to find the `ruff` executable when `ruff.importStrategy` is set to `fromEnvironment`"*), `path` (*"takes precedence over the `ruff.importStrategy` setting"*), `lint.args`/`format.args`/`lint.run` — *"This setting is not used by the native language server."* `nativeServer` `"auto"` rules (quoted in §13).
- features: *"The server relies on the file watching capabilities of the editor to detect changes to these files. If an editor does not support file watching, the server will not be able to detect changes to the configuration file and thus will not refresh the diagnostics."* · Markdown: *"Note that Ruff does not support range formatting for Markdown files"* (→ `"editor.formatOnSaveMode": "file"`).
- ruff-vscode README @2026.78.0: *"When either of these is available, the Ruff extension uses it to locate the Ruff binary in the active environment. If no binary is found there, or both extensions are unavailable, Ruff falls back to the Ruff binary found on the `PATH` or bundled with the extension."* · Untrusted workspace: *"the extension will always use the bundled executable of the `ruff` binary regardless of any other settings"*; unsupported there: `ruff.configuration`, `ruff.importStrategy`, `ruff.interpreter`, `ruff.path`. · *"In general, we recommend configuring Ruff via `pyproject.toml` or `ruff.toml` so that your configuration is shared between the VS Code extension and the command-line tool, and between all contributors to the project."* · Black-extension combo and `"ruff.organizeImports": false` isort combo; `source.fixAll.ruff` scoped actions; `"editor.defaultFormatter": null` to disable formatting. Notebook: `notebook.codeActionsOnSave` with `notebook.source.fixAll` / `notebook.source.organizeImports`; *"will run the action for each cell individually."*

### pre-commit.com (4.6.2)
`autoupdate`: *"Auto-update pre-commit config to the latest repos' versions."* · `--freeze` *"Store 'frozen' hashes in `rev` instead of tag names."* · `--repo REPO` *"Only update this repository. This option may be specified multiple times."* · *"`pre-commit` assumes that the value of `rev` is an immutable ref (such as a tag or SHA) and will cache based on that."* · `run --all-files` *"This is a useful invocation if you are using pre-commit in CI."* · `--show-diff-on-failure` *"when hooks fail, run `git diff` directly afterward."* · pre-commit.ci *"will periodically autoupdate your configuration."*

### Dependabot (docs.github.com, 2026-09-10)
Options reference lists `uv` (e.g. under `dependency-type` support) and `pre-commit` (supported-ecosystems table: version updates yes, security updates no). *"By default, Dependabot opens a new pull request to update each dependency."* Multi-ecosystem grouping: NOT confirmed — pages make no claim.

### Further source facts used by chunks 12b and 14 (2026-09-10) [source @0.16.6]
- `pyproject.rs`: `check_required_version(root.get_ref(), table_path)?` runs on the loosely parsed TOML before `T::deserialize` (comment: *"Inspect `required-version` without triggering strict deserialization errors."*); an unparseable specifier falls through to normal parsing. Added by PR #22410, released **0.14.11** (0.14.x changelog: *"Check `required-version` before parsing rules"*). Binaries older than 0.14.11 may report an unknown-field error instead of the version mismatch.
- `options.rs::validate_required_version` → ``Required version `{required_version}` does not match the running version `{RUFF_PKG_VERSION}` ``. Exit code for this case is not documented separately; pages say "configuration failure → abnormal termination (2)" as an inference.
- `configuration.rs` combine: `required_version: self.required_version.or(config.required_version)` ⇒ inherited through `extend` (child wins). Discovery never merges ⇒ a nested `[tool.ruff]` without `extend` has no `required-version`.
- `configuration.rs` rule-selection merge: a later selection (e.g. the CLI) with `fixable` set **replaces** the fixable set; `unfixable` alone is applied **on top of** the existing set. ⇒ `--extend-select RUF100 --fixable RUF100 --fix` fixes only RUF100 while evaluating the real rule set; `--select RUF100` alone makes every other `noqa` code "non-enabled" → RUF100 flags (and `--fix` removes) them all.
- ruff-vscode README @2026.78.0 Commands table: *Ruff: Fix all auto-fixable problems*, *Ruff: Format Imports*, *Ruff: Format Document*, *Ruff: Restart Server* (*"Force restart the linter server"*), *Ruff: Print debug information (native server only)*, *Ruff: Show client logs*, *Ruff: Show server logs*. Deprecated settings (not used by native server): `format.args`, `ignoreStandardLibrary`, `lint.args`, `lint.run`. ruff-vscode `pyproject.toml` comment: *"Release automation intentionally tracks the latest Ruff and ruff-lsp."*
- Pyright `configuration.md` (main): `ignore` — *"Paths of directories or files whose diagnostic output (errors and warnings) should be suppressed even if they are an included file or within the transitive closure of an included file."* ⇒ the ruff docs' Neovim `python.analysis.ignore = { '*' }` silences Pyright's type errors too.
