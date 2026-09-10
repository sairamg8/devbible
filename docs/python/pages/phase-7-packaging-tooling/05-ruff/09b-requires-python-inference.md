---
title: "When no configuration sets `target-version`, ruff reads `requires-python` — but only from the `pyproject.toml` beside the configuration file it found, never from the package the linted file belongs to, and in the no-config cases from wherever you happened to run it; in a monorepo that is how a 3.9 package gets 3.12 fixes"
sidebar_label: "09b · requires-python inference"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Configuring Ruff: Inferring the Python version* and *Config file discovery*
> ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/#inferring-the-python-version)); settings reference for
> [`target-version`](https://docs.astral.sh/ruff/settings/#target-version) and [`per-file-target-version`](https://docs.astral.sh/ruff/settings/#per-file-target-version);
> `crates/ruff_workspace/src/pyproject.rs` (`load_options`) at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_workspace/src/pyproject.rs)); the 0.11.0 and 0.15.0
> [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entries.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**[09](09-target-version.md) argued that `requires-python` should drive ruff's target version.
This page is about the fine print of *which* `requires-python`. ruff does not look for the
nearest `[project]` table to the file it is linting. It finds a configuration file first, by the
closest-file rule ([02](02-configuration-discovery.md)), and then reads `requires-python` from the
`pyproject.toml` that sits next to *that* configuration. In a single-package repository the two
are the same file and nothing can go wrong. In a monorepo, a sub-package with its own
`requires-python` but no ruff table of its own is linted — and fixed — against the root's Python
version. And when there is no configuration at all, the answer depends on the directory you ran
ruff from.**

## The rule, and its four cases

> *"When no discovered configuration specifies a `target-version`, Ruff will attempt to fall back to the minimum version compatible with the `requires-python` field in a nearby `pyproject.toml`."*
> — [Configuring Ruff: Inferring the Python version](https://docs.astral.sh/ruff/configuration/#inferring-the-python-version)

"Nearby" is defined by four cases, verbatim:

1. *"If a configuration file is passed directly, Ruff does not attempt to infer a missing `target-version`."*
2. *"If a configuration file is found in the filesystem hierarchy, Ruff will infer a missing `target-version` from the `requires-python` field in a `pyproject.toml` file in the same directory as the found configuration."*
3. *"If we are using a user-level configuration from `${config_dir}/ruff/pyproject.toml`, the `requires-python` field in the first `pyproject.toml` file found in an ancestor of the current working directory takes precedence over the `target-version` in the user-level configuration."*
4. *"If no configuration files are found, Ruff will infer the `target-version` from the `requires-python` field in the first `pyproject.toml` file found in an ancestor of the current working directory."*

> *"Note that in these last two cases, the behavior of Ruff may differ depending on the working directory from which it is invoked."*

Case 2 is the one every project lives in. Its key phrase is *the same directory as the found
configuration*. If the found configuration is a `pyproject.toml`, its own `[project]
requires-python` is used. If it is a `ruff.toml` or `.ruff.toml`, ruff reads the
`pyproject.toml` beside it — a behaviour that arrived with the 0.11.0 changes, before which a
`pyproject.toml` without a `[tool.ruff]` section was ignored *"including the `requires-python`
setting"*.

Case 1 has a nuance the prose does not state: in the 0.16.6 source, a `pyproject.toml` passed
with `--config` still has its *own* `requires-python` read when its `[tool.ruff]` sets no
`target-version`; what stops is looking beside a passed `ruff.toml` ([02b](02b-config-overrides-and-inspection.md)).

### How the minimum is computed

The source turns the specifier's lower bound into a major.minor version: `>=`, `>`, `~=`, `==`,
`==*` and `===` clauses contribute a minimum. So `">=3.12"`, `">=3.12,<4"` and `"~=3.12"` all
become `py312`. A specifier with no lower bound — only `<3.15`, say — gives ruff nothing to infer
from; I could not confirm from the source summary whether that falls through to the default or
is reported, so do not write one.

## Where it goes wrong: the monorepo

```text
repo/
  pyproject.toml                    # [project] requires-python = ">=3.12"
                                    # [tool.ruff] select = [...], line-length = 100
  packages/
    legacy_client/
      pyproject.toml                # [project] requires-python = ">=3.9"   (no [tool.ruff])
      src/legacy_client/api.py
```

For `api.py`, discovery skips `legacy_client/pyproject.toml` — *"Ruff ignores any
`pyproject.toml` files that lack a `[tool.ruff]` section"* — and finds the root file. Case 2 then
reads `requires-python` from the root: **3.12**. `ruff check --fix` rewrites `legacy_client`'s
annotations with 3.10+ syntax, and the package's 3.9 users get a `TypeError` at import.

Two correct fixes. The first keeps one configuration and states the exception in it:

```toml
# repo/pyproject.toml
[project]
name = "platform"
version = "0.1.0"
requires-python = ">=3.12"

[tool.ruff]
line-length = 100

[tool.ruff.per-file-target-version]
"packages/legacy_client/**/*.py" = "py39"
```

The second gives the package its own configuration that inherits the root's rules, so its own
`requires-python` becomes the found configuration's neighbour:

```toml
# repo/packages/legacy_client/pyproject.toml
[project]
name = "legacy-client"
version = "2.3.0"
requires-python = ">=3.9"

[tool.ruff]
extend = "../../pyproject.toml"
```

Here the found configuration is `legacy_client/pyproject.toml`, so case 2 reads *its*
`requires-python`. In the 0.16.6 source each `pyproject.toml` has its own `requires-python`
turned into its `target-version` as it is loaded, and a child's value overrides the parent's in
an `extend` chain — so the child's `py39` wins over the root's `py312`. The 0.15.0 changelog adds
that *"Ruff now resolves all `extend`ed configuration files before falling back on a default
Python version"*, so a base file's version reaches a child that has none of its own.

⚠️ With a **`ruff.toml`** child that extends a root `pyproject.toml`, two sources compete — the
`requires-python` beside the child, and the version inherited from the root. I could not confirm
from the documents read which one wins. Set `target-version` explicitly in that `ruff.toml`
rather than rely on either.

## Where it goes wrong: no configuration at all

With no ruff configuration anywhere (cases 3 and 4), inference walks up from the **current
working directory**, not from the file. Run `ruff check packages/legacy_client` from the
repository root and the root's `requires-python` applies; `cd packages/legacy_client && ruff
check .` and the package's applies. An editor whose workspace is the repository root and a
developer's shell inside the package disagree about the same file. The cure is to have a
configuration, so case 2 applies and the answer no longer depends on where ruff was started.

## Proving what was resolved

Do not reason about it — ask ruff:

```bash
uv run ruff check --show-settings packages/legacy_client/src/legacy_client/api.py
```

`--show-settings` — *"See the settings Ruff will use to lint a given Python file"* — prints the
resolved settings for that one file. Search its output for the target version rather than
trusting the file you *think* was found ([02b](02b-config-overrides-and-inspection.md)).

## Gotchas

**★ Symptom: a sub-package declares `requires-python = ">=3.9"`, yet ruff proposes 3.10+ syntax in
it and the fixes break its users.** Cause: the sub-package's `pyproject.toml` has no `[tool.ruff]`
table, so discovery skips it, the root configuration is found, and case 2 reads the *root's*
`requires-python`. Fix: `per-file-target-version` at the root, or a `[tool.ruff]` with `extend`
in the sub-package, as shown above.

```toml
[tool.ruff.per-file-target-version]
"packages/legacy_client/**/*.py" = "py39"
```

**★ Symptom: the same file gets different `UP` diagnostics in the editor and in the terminal.**
Cause: no ruff configuration exists, so the target is inferred from the first `pyproject.toml`
above the *working directory*, and the editor and the shell start in different directories. Fix:
add a configuration at the repository root so inference follows the found file, not the
working directory.

```toml
[tool.ruff]
line-length = 88
```

**Symptom: CI runs `ruff check --config ci/ruff.toml .` and suddenly `UP` proposes nothing newer
than 3.10.** Cause: a configuration passed directly disables inference (case 1), so the
`requires-python` beside the project is not consulted and the default target applies. Fix: put
`target-version` in the passed file.

```toml
# ci/ruff.toml
target-version = "py312"
```

**Symptom: a user-level `~/.config/ruff/ruff.toml` sets `target-version = "py313"`, but in one
project ruff behaves as 3.10.** Cause: in the user-level case the `requires-python` of the first
`pyproject.toml` above the working directory *takes precedence* over the user-level
`target-version` (case 3). Fix: rely on project configuration, not user configuration — the
project's `requires-python` is the intended source.

```toml
[project]
requires-python = ">=3.13"
```

**Symptom: `requires-python = "<3.15"` was written to express "supports up to 3.14", and the
target version is not what anyone expected.** Cause: that specifier has no lower bound, and ruff
infers the *minimum*. Fix: always state the floor; add an upper bound only if you mean it.

```toml
[project]
requires-python = ">=3.11"
```

**Symptom: a `ruff.toml` in a sub-directory makes ruff ignore the `requires-python` in the root
`pyproject.toml`.** Cause: that `ruff.toml` is now the found configuration for its subtree, and
case 2 reads the `pyproject.toml` beside *it* — there may be none. Fix: set `target-version` in
that `ruff.toml`, or delete it and let the root configuration apply.

```toml
# services/worker/ruff.toml
extend = "../../pyproject.toml"
target-version = "py312"
```

## Interview questions

**★ How does ruff decide which `requires-python` to use for a file?**
It first finds the configuration file for that file by the closest-file rule, ignoring any
`pyproject.toml` without a `[tool.ruff]` table. If that configuration sets no `target-version`,
it reads `requires-python` from the `pyproject.toml` in the same directory as the found
configuration and uses the specifier's minimum. The file's own package `pyproject.toml` is only
used if it is the found configuration. With no configuration at all, it uses the first
`pyproject.toml` above the working directory.

**★ Why can a monorepo sub-package be linted against the wrong Python version, and how do you
fix it?**
Because a sub-package whose `pyproject.toml` has no `[tool.ruff]` table is skipped by discovery,
so the root configuration is found and the root's `requires-python` is used. The fixes are to
add `per-file-target-version` for that package's paths in the root configuration, or to give the
package a `[tool.ruff]` table that `extend`s the root so the package's own `requires-python`
becomes the found configuration's neighbour. `ruff check --show-settings` on a file in the
package confirms which one applies.

**Why does ruff's behaviour in the no-configuration case depend on the working directory?**
Because there is no found configuration to anchor the search, so the documented rule walks up
from the current working directory to the first `pyproject.toml`. Two invocations from different
directories — an editor at the repository root and a shell in a package — can find different
files. Having a configuration makes the search file-relative again.

**What does passing `--config` do to Python-version inference?**
The documentation says a directly passed configuration disables inference of a missing
`target-version`. In the 0.16.6 source, a passed `pyproject.toml` still has its own
`requires-python` read; a passed `ruff.toml` gets nothing from neighbouring files, so it should
carry `target-version` itself.

---

← Prev: [09 · target-version](09-target-version.md) · [Topic index](README.md) · Next → [10 · Import sorting](10-import-sorting.md)
