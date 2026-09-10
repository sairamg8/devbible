---
title: "When the file ruff found is not the file you meant, the command line decides — `--config` either replaces discovery or overrides one key, `--isolated` ignores every file, CLI settings beat every resolved configuration, unknown keys fail loudly, and `--show-settings` is the only reliable way to see which one won"
sidebar_label: "02b · Overrides and inspection"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/))
> including its auto-generated `ruff help` / `ruff help check` output, the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)),
> and `crates/ruff_workspace/src/{options,configuration,pyproject}.rs` at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/tree/0.16.6/crates/ruff_workspace/src)) for strict parsing and the deprecation warning text.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Discovery ([02](02-configuration-discovery.md)) is what ruff does when you let it. This page
is about overruling it, and about proving what happened. `--config` has two unrelated meanings
depending on what you pass it: a path replaces discovery for every file and quietly changes what
relative paths mean, while a `KEY = VALUE` string overrides one setting across every
configuration ruff found. `--isolated` throws all configuration away, which makes it the fastest
way to answer "is it my config or ruff?". And because ruff parses its own tables strictly, a
misspelt key is a hard error — the opposite of a misspelt table name, which is silence. When
two developers see different results, `--show-settings` on the same file ends the argument.**

## `--config` with a path: one file for everything

> *"If a configuration file is passed directly via `--config`, those settings are used for all analyzed files, and any relative paths in that configuration file (like `exclude` globs or `src` paths) are resolved relative to the current working directory."*
> — [Configuring Ruff](https://docs.astral.sh/ruff/configuration/)

Two consequences follow, both invisible until they bite. Every nested configuration in the tree
is ignored — a monorepo's per-package files stop mattering. And `exclude`, `per-file-ignores`
and `src` stop being relative to the file that contains them and start being relative to wherever
the command happened to run.

```bash
ruff check --config ci/ruff.toml .      # every file uses ci/ruff.toml; its globs are relative to $PWD
```

A passed file also changes Python-version inference: *"If a configuration file is passed
directly, Ruff does not attempt to infer a missing `target-version`."* In the 0.16.6 source a
`pyproject.toml` passed this way still has its *own* `[project] requires-python` read when
`[tool.ruff]` sets no `target-version`; what stops is the search of *other* files — which is what
a passed `ruff.toml` depends on ([09b](09b-requires-python-inference.md)).

## `--config` with `KEY = VALUE`: one setting, everywhere

> *"However, the `--config` flag can also be used to provide arbitrary overrides of configuration settings using TOML `<KEY> = <VALUE>` pairs. This is mostly useful in situations where you wish to override a configuration setting that does not have a dedicated command-line flag."*

> *"Configuration options passed to `--config` are parsed in the same way as configuration options in a `ruff.toml` file. As such, options specific to the Ruff linter need to be prefixed with `lint.`"* · *"and options specific to the Ruff formatter need to be prefixed with `format.`."*

> *"Specifying `--config "line-length=90"` will override the `line-length` setting from all configuration files detected by Ruff, including configuration files discovered in subdirectories."*

> *"If a specific configuration option is simultaneously overridden by a dedicated flag and by the `--config` flag, the dedicated flag takes priority."*

```bash
ruff check . --config "lint.dummy-variable-rgx = '^_$'"
ruff format . --config "format.quote-style = 'single'"
ruff check . --config "lint.per-file-ignores = {'scripts/*.py' = ['T201']}"
```

The general rule behind both uses is the fourth discovery exception:

> *"Any config-file-supported settings that are provided on the command-line (e.g., via `--select`) will override the settings in every resolved configuration file."*

## `--isolated`: no configuration at all

The global option is documented in `ruff help` as *"Ignore all configuration files"*. It is a
diagnostic tool more than a workflow: run the same file with and without it, and the difference
is your configuration.

```bash
ruff check --isolated src/billing_api/invoices.py     # ruff's defaults only
ruff check src/billing_api/invoices.py                # your configuration
ruff check --show-settings --isolated                 # the settings reference's own way to print the default rule set
```

## Proving what was resolved

| Question | Command |
|---|---|
| Which settings apply to this file? | `ruff check --show-settings path/to/file.py` — *"See the settings Ruff will use to lint a given Python file"* |
| Which files will ruff look at? | `ruff check --show-files` — *"See the files Ruff will be run against with the current settings"* |
| What does rule X do? | `ruff rule F401` — *"Explain a rule (or all rules)"* |
| What does option Y mean? | `ruff config lint.per-file-ignores` — *"List or describe the available configuration options"* |
| Which linters and prefixes exist? | `ruff linter` — *"List all supported upstream linters"* |

The FAQ answers the most common support question with the first row: *"Run `ruff check
/path/to/code.py --show-settings` to view the resolved settings for a given file."*

## Strict parsing: typo'd keys fail, typo'd tables do not

Every ruff option table is declared with `deny_unknown_fields` in the 0.16.6 source
(`crates/ruff_workspace/src/options.rs`). A key ruff does not know, anywhere under
`[tool.ruff]`, is a parse error and ruff stops. That is the opposite of a misspelt *table*:
`[tool.rufff]` belongs to nobody, so nobody complains
([the tool namespace](../01-pyproject-toml/12-the-tool-namespace.md) explains why that silence is
by design).

```toml
[tool.ruff.lint]
selct = ["E", "F"]          # unknown key: ruff refuses to parse the file

[tool.rufff.lint]
select = ["E", "F"]         # unknown table: silently ignored by every tool
```

The same strictness makes a *newer* key fatal to an *older* ruff. `format.nested-string-quote-style`
arrived in **0.15.9**; a configuration using it cannot be parsed by an earlier ruff — a stale
editor-bundled binary, say. [12](12-pinning-ruff.md) covers keeping every consumer on one
version; the 0.16.6 source checks `required-version` *before* strict parsing (*"Inspect
`required-version` without triggering strict deserialization errors"*), so a pinned project gets
a version-mismatch error instead of a confusing unknown-field one.

### The deprecated top-level lint settings

Older configurations put lint options straight under `[tool.ruff]`. They still load, but the
0.16.6 source prints a warning beginning *"The top-level linter settings are deprecated in
favour of their counterparts in the `lint` section. Please update the following options in …"*
followed by a mapping such as `'select' -> 'lint.select'`. The settings reference is explicit
about precedence when both exist: *"Options specified in the `lint` section take precedence over
the deprecated top-level settings."*

```toml
# before — deprecated
[tool.ruff]
select = ["E", "F"]
per-file-ignores = { "tests/*" = ["S101"] }

# after
[tool.ruff.lint]
select = ["E", "F"]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["S101"]
```

## Gotchas

**★ Symptom: switching CI to `ruff check --config ci/ruff.toml .` made `exclude` and
`per-file-ignores` stop matching.** Cause: with a passed file, relative paths *"are resolved
relative to the current working directory,"* not to `ci/`. The patterns now point at
`./migrations`, not `ci/migrations` or wherever you assumed. Fix: drop `--config` and let
discovery find the file; if you must pass it, run from the directory the patterns were written
for.

```bash
cd "$GITHUB_WORKSPACE" && ruff check .          # discovery: patterns relative to their own file
```

**★ Symptom: in a monorepo, CI reports different violations than developers see locally.**
Cause: CI passes `--config pyproject.toml`, which *"used for all analyzed files"* — every
per-package configuration is ignored in CI and honoured locally. Fix: make CI and developers run
the same command, without a path in `--config`.

```bash
uv run ruff check .      # identical locally and in CI
```

**Symptom: `ruff check --config "dummy-variable-rgx = '^_$'"` prints a deprecation warning
about top-level settings, or a formatter key passed the same way fails to parse.** Cause:
`--config` values are *"parsed in the same way as configuration options in a `ruff.toml` file"*,
so lint keys need `lint.` and formatter keys need `format.`. Fix: prefix them.

```bash
ruff check . --config "lint.dummy-variable-rgx = '^_$'"
ruff format . --config "format.quote-style = 'single'"
```

**Symptom: ruff exits with a parse error the day after someone added a formatter option — but
only on one developer's machine.** Cause: their ruff (often the editor's bundled copy) predates
the option, and ruff rejects unknown keys. `nested-string-quote-style`, added in 0.15.9, is a
recent example. Fix: pin the version in the repository so an old binary fails with a clear
message ([12](12-pinning-ruff.md)).

```toml
[tool.ruff]
required-version = ">=0.16.6"
```

**Symptom: ruff warns that "The top-level linter settings are deprecated" on every run.**
Cause: `select`, `ignore`, `per-file-ignores` or another lint key sits directly under
`[tool.ruff]`. Fix: move each one under `[tool.ruff.lint]` exactly as the warning's mapping
lists.

```toml
[tool.ruff.lint]
select = ["E", "F", "I"]
```

**Symptom: a standalone script outside any repository is linted with a strange rule set on one
laptop.** Cause: a user-level configuration (`~/.config/ruff/ruff.toml` on Linux and macOS)
applies wherever discovery finds nothing. Fix: compare against the defaults, then either delete
the user file or give the script a directory of its own with a `ruff.toml`.

```bash
ruff check --isolated ~/bin/rotate_logs.py     # defaults
ruff check ~/bin/rotate_logs.py                # defaults + the user-level file
```

**Symptom: `ruff format . --line-length 100 --config "line-length = 120"` still wraps at 100.**
Cause: *"the dedicated flag takes priority"* over a `--config` override of the same option — the
docs use exactly this pair as their example. Fix: pass one or the other, never both.

```bash
ruff format . --line-length 120
```

## Interview questions

**★ What are the two uses of `--config`, and how do they differ?**
Given a path, it replaces discovery: that file configures every analysed file, nested
configurations are ignored, relative paths inside it resolve against the current directory, and
ruff stops searching other files to infer a missing `target-version`. Given a `KEY = VALUE`
string in `ruff.toml` syntax, it overrides that one setting in every configuration ruff found,
nested ones included. Both forms can be combined, and the override wins over any file — but a
dedicated flag such as `ruff format --line-length` wins over both.

**★ Two developers get different lint results on the same commit. How do you find out why?**
Run `ruff --version` on both machines, then `ruff check --show-settings` on the same file on
both. The first catches the most common cause — different ruff versions, where a minor release
can change rules and defaults. The second prints the fully resolved settings, which exposes the
rest: a nested configuration one of them has, a user-level file, an editor passing its own
settings, or a different `target-version` inferred from a different working directory.

**What does `--isolated` do, and when do you reach for it?**
It ignores every configuration file, so ruff runs with built-in defaults. Its main use is
bisection: if a problem disappears under `--isolated`, it lives in configuration; if it remains,
it is ruff's default behaviour or a bug. It is also how the settings reference suggests printing
the default rule set — `ruff check --show-settings --isolated`.

**Why does an unknown key inside `[tool.ruff]` fail loudly while a misspelt `[tool.rufff]` is
silent?**
They are checked by different parties. Inside its own table, ruff deserialises strictly — every
options struct denies unknown fields — so a typo is caught immediately. A table that belongs to
nobody is never read by anyone: the `[tool]` namespace is designed so that each tool ignores
subtables it does not own, which means no tool can tell a typo from someone else's
configuration.

**What happens to the old top-level lint settings in a modern ruff?**
They still work but are deprecated: ruff warns and names each key's new location under `lint`.
If a key exists in both places, the one in `[tool.ruff.lint]` wins. They are worth moving now,
because removing a deprecated option is one of the things ruff's versioning policy allows in any
minor release.

---

← Prev: [02 · Configuration discovery](02-configuration-discovery.md) · [Topic index](README.md) · Next → [03 · Rule codes and selection](03-rule-codes-and-selection.md)
