---
title: "ruff picks one configuration file per source file — the closest one — and never merges its parents, so a nested `pyproject.toml` with any `[tool.ruff]` table silently replaces the root configuration for everything under it unless it says `extend`, and `extend` has its own rule for `select` and `ignore`"
sidebar_label: "02 · Configuration discovery"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)),
> the settings reference for [`extend`](https://docs.astral.sh/ruff/settings/#extend) and [`src`](https://docs.astral.sh/ruff/settings/#src),
> the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)); discovery and `extend`-chain behaviour read in
> `crates/ruff_workspace/src/{pyproject,resolver}.rs` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/tree/0.16.6/crates/ruff_workspace/src)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**ruff does not have "the project configuration". It has a configuration per file, found by
walking up from that file to the nearest directory containing a `.ruff.toml`, a `ruff.toml`, or
a `pyproject.toml` that has a `[tool.ruff]` table — and the search stops there. Parents are not
merged in, unlike ESLint's cascade. That is simple until a monorepo grows a second
`pyproject.toml`: the moment someone adds even a single `[tool.ruff.lint.isort]` line to a
package's file, every file in that package loses the root's rule selection, per-file ignores and
exclusions, and nothing warns. `extend` is the explicit inheritance that fixes it, with one
merge rule for `select` and `ignore` that surprises almost everyone the first time.**

## The three files, and which one a directory offers

`pyproject.toml` (under `[tool.ruff]`), `ruff.toml` and `.ruff.toml` share one schema; the two
dedicated files simply drop the `tool.ruff` prefix. When a directory has more than one, the
dedicated file wins — the full precedence rule, and why the losing file is ignored silently, is
covered in [pyproject.toml · the tool namespace](../01-pyproject-toml/12-the-tool-namespace.md).
In the 0.16.6 source the per-directory check is literally ordered: `.ruff.toml`, then
`ruff.toml`, then `pyproject.toml` — and the `pyproject.toml` only counts if its `tool.ruff`
table exists.

## Closest file wins, per file

> *"Similar to ESLint, Ruff supports hierarchical configuration, such that the "closest" config file in the directory hierarchy is used for every individual file, with all paths in the config file (e.g., `exclude` globs, `src` paths) being resolved relative to the directory containing that config file."*
> — [Configuring Ruff](https://docs.astral.sh/ruff/configuration/)

> *"In locating the "closest" `pyproject.toml` file for a given path, Ruff ignores any `pyproject.toml` files that lack a `[tool.ruff]` section."*

> *"Unlike ESLint, Ruff does not merge settings across configuration files; instead, the "closest" configuration file is used, and any parent configuration files are ignored."*

Put the three sentences together on a small monorepo:

```text
billing/                      ← repository root
├── pyproject.toml            [tool.ruff] line-length = 100, select, per-file-ignores
├── packages/
│   ├── api/
│   │   ├── pyproject.toml    [project] only — no [tool.ruff]  → skipped, root applies
│   │   └── src/billing_api/
│   └── worker/
│       ├── pyproject.toml    [tool.ruff.lint.isort] known-first-party = ["billing_worker"]
│       └── src/billing_worker/
└── scripts/
    └── ruff.toml             (empty file)
```

- A file under `packages/api/` walks up past `api/pyproject.toml` (no `tool.ruff` table) and
  lands on the root: root settings apply.
- A file under `packages/worker/` stops at `worker/pyproject.toml`, because
  `[tool.ruff.lint.isort]` creates the `tool.ruff` table as a side effect of TOML's dotted
  headers. That file is now the *whole* configuration for the worker: line length 88, ruff's
  default rule set, no per-file ignores. The root file is not consulted.
- A file under `scripts/` stops at the empty `ruff.toml`. A `ruff.toml` counts whatever it
  contains, so `scripts/` is linted with pure defaults.

Paths inside each file are relative to that file's directory, so the root's
`extend-exclude = ["packages/worker/migrations"]` means nothing to a file configured by
`worker/pyproject.toml` — that file never read it.

## `extend`: inheritance you have to ask for

> *"In lieu of this implicit cascade, Ruff supports an `extend` field, which allows you to inherit the settings from another config file"*

```toml
# packages/worker/pyproject.toml
[tool.ruff]
extend = "../../pyproject.toml"      # resolved relative to THIS file

[tool.ruff.lint.isort]
known-first-party = ["billing_worker"]
```

Now the worker gets the root's settings plus its own isort addition. The settings reference
describes the merge:

> *"To resolve the current configuration file, Ruff will first load this base configuration file, then merge in properties defined in the current configuration file. Most settings follow simple override behavior where the child value replaces the parent value. However, rule selection (`lint.select` and `lint.ignore`) has special merging behavior: if the child configuration specifies `lint.select`, it establishes a new baseline rule set and the parent's `lint.ignore` rules are discarded; if the child configuration omits `lint.select`, the parent's rule selection is inherited and both parent and child `lint.ignore` rules are accumulated together."*
> — [settings: `extend`](https://docs.astral.sh/ruff/settings/#extend)

Worked through:

```toml
# root pyproject.toml
[tool.ruff.lint]
select = ["E", "F", "B", "I"]
ignore = ["E501", "B008"]            # B008: FastAPI's Depends() in defaults is intended here
```

| Child writes | Effective rules for the child |
|---|---|
| `extend` + `ignore = ["B904"]` | `E F B I` minus `E501 B008 B904` — ignores accumulate |
| `extend` + `extend-select = ["UP"]` | `E F B I UP` minus `E501 B008` |
| `extend` + `select = ["E", "F", "B", "I", "UP"]` | all five groups, **`E501` and `B008` back on** — the parent's `ignore` was discarded |

Three mechanics from the 0.16.6 resolver worth knowing when a chain misbehaves: each file in an
`extend` chain resolves its own relative paths against its own directory; the `extend` path
itself is resolved relative to the file that contains it; and a loop is an error reported as
``Circular configuration detected: `a` extends `b` extends `a` `` (template from the source).

## When nothing is found

> *"If no config file is found in the filesystem hierarchy, Ruff will fall back to using a default configuration. If a user-specific configuration file exists at `${config_dir}/ruff/pyproject.toml`, that file will be used instead of the default configuration"*

The FAQ names the file `~/.config/ruff/ruff.toml` on macOS and Linux (respecting
`XDG_CONFIG_HOME`) and `~\AppData\Roaming\ruff\ruff.toml` on Windows; the 0.16.6 source looks
for `.ruff.toml`, then `ruff.toml`, then `pyproject.toml` in that directory, so both pages are
describing the same fallback. A user file never overrides a project that has its own
configuration — it fills in only where discovery found nothing. The command-line side of this —
`--config`, `--isolated`, and how to print what was resolved — is [02b](02b-config-overrides-and-inspection.md).

## Gotchas

**★ Symptom: after a colleague added two lines to `packages/worker/pyproject.toml`, the worker
package suddenly passes lint with far fewer rules and its per-file ignores stopped working.**
Cause: any `[tool.ruff…]` header creates the `tool.ruff` table, which makes that file the closest
configuration; parents are *"ignored"*, not merged. Fix: inherit explicitly.

```toml
[tool.ruff]
extend = "../../pyproject.toml"

[tool.ruff.lint.isort]
known-first-party = ["billing_worker"]
```

**★ Symptom: a child config that `extend`s the root and sets its own `select` brings back rules
the root had deliberately ignored.** Cause: *"if the child configuration specifies
`lint.select`, it establishes a new baseline rule set and the parent's `lint.ignore` rules are
discarded."* Fix: add to the parent's selection instead of restating it, so the ignores carry
over.

```toml
[tool.ruff]
extend = "../../pyproject.toml"

[tool.ruff.lint]
extend-select = ["UP"]     # not select = [...]: keeps the root's ignore list
```

**★ Symptom: one directory of scripts is linted with ruff's defaults and nobody knows why.**
Cause: an empty or forgotten `ruff.toml` (or `.ruff.toml`) sits in it — the dedicated files
count as configuration whatever they contain. Fix: delete it, or make it inherit.

```toml
# scripts/ruff.toml
extend = "../pyproject.toml"
```

**Symptom: the root's `extend-exclude = ["packages/worker/migrations"]` does not exclude the
migrations once the worker has its own configuration.** Cause: that pattern lives in a file the
worker's files no longer read, and paths are *"resolved relative to the directory containing
that config file."* Fix: declare the exclusion in the file that governs those files, relative
to it.

```toml
# packages/worker/pyproject.toml
[tool.ruff]
extend = "../../pyproject.toml"
extend-exclude = ["migrations"]
```

**Symptom: `tests/` has a `ruff.toml` extending the root, and imports of your own package there
are now sorted as third-party.** Cause: the project root for first-party detection is the
directory of the *extending* file — *"as opposed to the directory of the file pointed to via the
`extends` option"* — so the default `src` of `[".", "src"]` now means `tests/` and `tests/src`.
Fix: point `src` back at the real code (the FAQ's own example).

```toml
# tests/ruff.toml
extend = "../pyproject.toml"
src = ["../src"]
```

**Symptom: ruff refuses to start with a "Circular configuration detected" error after a
refactor.** Cause: two files `extend` each other, directly or through a third. Fix: make the
chain a tree with one root that extends nothing.

```toml
# pyproject.toml at the repository root: no `extend` key at all
[tool.ruff]
line-length = 100
```

**Symptom: you added `[tool.ruff]` to a subpackage's `pyproject.toml` only to set
`target-version`, and its lint results changed completely.** Cause: that file is now the whole
configuration, defaults included, and ruff's default rule set is not your root's rule set. Fix:
either `extend` the root, or — if the only goal was the interpreter version — set
`requires-python` in that package's `[project]` table and leave `[tool.ruff]` out, so discovery
still reaches the root (**09b** *(not written yet)* covers how a
`requires-python` is found).

```toml
[project]
name = "billing-worker"
requires-python = ">=3.13"
# no [tool.ruff] here
```

## Interview questions

**★ How does ruff decide which configuration applies to a given file?**
It walks up from the file's directory and stops at the first directory offering a `.ruff.toml`,
a `ruff.toml`, or a `pyproject.toml` that contains a `[tool.ruff]` table, in that order of
preference within one directory. That file — plus whatever it `extend`s — is the entire
configuration for the file. Anything given on the command line then overrides every resolved
configuration. If nothing is found, a user-level config is used if one exists, otherwise the
built-in defaults.

**★ How is ruff's hierarchy different from ESLint's cascade, and why does it matter in a
monorepo?**
ESLint-style cascading merges every configuration on the way up; ruff uses the closest one and
ignores the rest. In a monorepo that turns an innocent-looking local tweak into a total reset:
a package-level `[tool.ruff]` section, however small, becomes that package's entire
configuration. The fix is explicit — `extend = "../../pyproject.toml"` — and the benefit of the
design is that you can read one file (and its `extend` chain) and know exactly what applies,
with no invisible ancestors.

**What happens to `lint.ignore` when a child configuration sets `lint.select` under `extend`?**
It is discarded. A child `select` establishes a new baseline rule set, and the parent's ignore
list goes with the parent's selection. If the child omits `select`, the parent's selection is
inherited and both ignore lists accumulate. That is why child configurations should prefer
`extend-select` — it adds to the inherited set and keeps the inherited ignores.

**Why does a `pyproject.toml` without `[tool.ruff]` not stop the search?**
Because almost every Python package has a `pyproject.toml` for packaging reasons, and treating
all of them as ruff configuration would make every package in a monorepo reset to defaults. ruff
therefore only treats a `pyproject.toml` as its configuration if it has a `tool.ruff` table. The
trap is the inverse: any dotted header beginning `[tool.ruff.`, even a single isort option,
creates that table.

**Relative paths in an `extend`ed file — relative to what?**
Each file in an `extend` chain resolves its own paths against its own directory, and the
`extend` value is resolved relative to the file that contains it. The one documented exception
is first-party detection: the "project root" used for the default `src` is the directory of the
file ruff discovered, not of the file it extended, which is why a `tests/ruff.toml` usually needs
`src = ["../src"]`.

---

← Prev: [01b · check and format are two tools](01b-check-and-format-are-two-tools.md) · [Topic index](README.md) · Next → [02b · Overrides and inspection](02b-config-overrides-and-inspection.md)
