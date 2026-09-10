---
title: "Moving a codebase from Black to `ruff format` is one reviewed reformat commit — copy the handful of Black settings that have ruff equivalents (and translate the ones that only look equivalent), preview with `--diff`, hide the commit from `git blame`, and remove Black from every place it runs in the same change"
sidebar_label: "07b · Migrating from Black"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)),
> the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)), the settings reference for
> [`line-length`](https://docs.astral.sh/ruff/settings/#line-length), [`format.quote-style`](https://docs.astral.sh/ruff/settings/#format_quote-style),
> [`format.skip-magic-trailing-comma`](https://docs.astral.sh/ruff/settings/#format_skip-magic-trailing-comma),
> [`required-version`](https://docs.astral.sh/ruff/settings/#required-version) and [`target-version`](https://docs.astral.sh/ruff/settings/#target-version),
> *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Black's own option names (`[tool.black]`, `skip-string-normalization`, its regex `exclude`, its list-valued
> `target-version`) and git's `blame.ignoreRevsFile` are cited from those tools' interfaces, not re-read for this page.
> Documentation-validated — **no sandbox run, no program output**.

**The formatter is compatible enough that the migration is mechanical ([07](07-the-formatter-and-black.md)
has why), and different enough that it must happen exactly once. That makes it a small project
with a fixed shape: translate the configuration first so the reformat diff is as small as it can
be, look at that diff before writing it, land it as a commit containing nothing else, make
`git blame` skip over it, and in the same change remove Black from the dependency list, the
pre-commit file, the CI job and every editor — because a single leftover consumer turns the
migration into a formatting war.**

## Translating Black's configuration

ruff never reads `[tool.black]`. Every Black setting that mattered has to be restated in ruff's
tables, and three of them only *look* like they have a same-named equivalent.

| In `[tool.black]` | In ruff | Note |
|---|---|---|
| `line-length = 100` | `[tool.ruff] line-length = 100` | ruff's default is 88 — *"Same as Black."* — so only a non-default value needs copying |
| `skip-string-normalization = true` | `[tool.ruff.format] quote-style = "preserve"` | *"The quote style `preserve` leaves the quotes of all strings unchanged."* |
| `skip-magic-trailing-comma = true` | `[tool.ruff.format] skip-magic-trailing-comma = true` | same name, same meaning |
| `target-version = ["py312", "py313"]` (a list) | `requires-python = ">=3.12"`, or `[tool.ruff] target-version = "py312"` (one value, the minimum) | ruff's is *"The minimum Python version to target"* |
| `exclude` / `extend-exclude` (a regular expression) | `[tool.ruff] extend-exclude = ["migrations", "*_pb2.py"]` (a list of globs) | a regex pasted into a glob list silently matches nothing |
| `required-version` | `[tool.ruff] required-version = "==0.16.6"` | a PEP 440 specifier; ruff *"will exit with an error"* on mismatch |
| `preview = true` | `[tool.ruff.format] preview = true` | not top-level: that also turns on lint preview |

The settings reference recommends the packaging-standard field over ruff's own:

> *"If you're already using a `pyproject.toml` file, we recommend `project.requires-python` instead, as it's based on Python packaging standards, and will be respected by other tools."*
> — [settings: `target-version`](https://docs.astral.sh/ruff/settings/#target-version)

## Migrating a repository from Black

The goal is one reformat commit that reviewers can skim, then no formatting diffs ever again.

```toml
# pyproject.toml — carry Black's settings across before running anything
[project]
name = "billing"
version = "1.4.0"
requires-python = ">=3.12"

[dependency-groups]
dev = ["ruff==0.16.6"]            # Black removed from this list

[tool.ruff]
line-length = 100                 # was [tool.black] line-length = 100; ruff's default is 88

[tool.ruff.format]
quote-style = "double"            # the default; use "preserve" if Black ran with skip-string-normalization
skip-magic-trailing-comma = false # same name and meaning as Black's option
```

```bash
# 1. Install the pinned ruff and see the size of the change without writing anything.
uv sync
uv run ruff format --diff .

# 2. Apply it as one mechanical commit, nothing else in it.
uv run ruff format .
git commit -am "Reformat with ruff format 0.16.6 (replaces Black)"

# 3. Tell git blame to look through that commit.
git rev-parse HEAD >> .git-blame-ignore-revs
git config blame.ignoreRevsFile .git-blame-ignore-revs
git add .git-blame-ignore-revs
git commit -m "Ignore the ruff reformat commit in git blame"

# 4. CI now enforces the new formatter.
uv run ruff format --check .
```

Then remove Black from everywhere it runs: the dev dependency group, the `[tool.black]` table,
the pre-commit hook (**12** *(not written yet)*), the CI job, and every editor's
"format on save" provider (**13** *(not written yet)*). A `[tool.black]` table nobody reads
is harmless to ruff but actively misleading to the next reader, who will edit it and wonder why
nothing changes.

`ruff format --diff` is a preview, not a pass/fail check on your intent: per its help text it
exits *"with a non-zero status code and the difference between the current file and how the
formatted file would look like"*. Run it locally; do not leave it as a CI step you expect to be
green before step 2 has landed.

## What to read in the reformat diff

The diff will be large and almost entirely boring. Skim for the four things that are not:

- **Files Black never formatted.** Notebooks (*"linted and formatted by default on version
  `0.6.0` and higher"*) and, from 0.16.0, Python code fences in Markdown files. Decide whether
  you want them in this commit; the documented opt-out for Markdown is an exclusion:

  ```toml
  [tool.ruff]
  extend-exclude = ["*.md"]
  ```

- **Comments that moved.** Ruff treats trailing end-of-line comments differently from Black on
  unformatted code — the FAQ singles this out as where *"more deviations should be expected"*.
  A comment that moved lines may now describe the wrong statement.
- **Pragma comments.** `# noqa`, `# type: ignore` and friends are ignored when ruff computes
  line width, so ruff does not move them ([07c](07c-known-deviations-from-black.md)); confirm none of your suppressions ended up on a
  different physical line ([06](06-noqa.md) — a `noqa` covers one physical line).
- **`except` tuples and other version-gated style.** If the target version resolved to 3.14+,
  the 2026 style drops parentheses around exception tuples; confirm that is the version you
  deploy on.

Black's pragma comments carry over unchanged: *"Like Black, Ruff supports `# fmt: on`,
`# fmt: off`, and `# fmt: skip` pragma comments"*.

## Coming from YAPF, autopep8, or no formatter

The >99.9% figure is for code Black already formatted. A codebase that was never through Black
gets a genuinely large diff — the FAQ: *"When run over non-Black-formatted code, the formatter
makes some different decisions than Black, and so more deviations should be expected"*. The
procedure is the same; the review is longer. YAPF's region pragmas keep working: *"Like Black,
Ruff will also recognize YAPF's `# yapf: disable` and `# yapf: enable` pragma comments"*. YAPF's
style knobs do not carry over at all — ruff *"does not currently expose any other configuration
options"* beyond the small set in [07e](07e-formatter-settings.md).

## Gotchas

**★ Symptom: every commit touches the same handful of lines, flipping back and forth.** Cause:
Black and `ruff format` both run — in pre-commit, CI, or one developer's editor — and they
disagree on those lines; each rewrites the other's output. The docs rule it out: *"not intended
to be used interchangeably with Black on an ongoing basis"*. Fix: one formatter, removed from
every consumer at once.

```yaml
# .pre-commit-config.yaml — the black repo entry is deleted, not left beside ruff
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.6
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
```

**★ Symptom: after switching from Black, the diff reformats nearly every long line.** Cause:
Black was configured with `line-length = 100` in `[tool.black]`; ruff does not read that table,
so it formats at its default of 88. Fix: set `line-length` in ruff's own table.

```toml
[tool.ruff]
line-length = 100
```

**Symptom: migrating to ruff 0.16 rewrote Python code fences in `README.md` and the docs
directory.** Cause: Markdown code-block formatting became stable and on by default in 0.16.0;
Black never touched Markdown. Fix: accept it (it is the same style as your code), or exclude
Markdown from formatting.

```toml
[tool.ruff.format]
exclude = ["*.md"]
```

**Symptom: the migration diff turned every single-quoted string into a double-quoted one.**
Cause: Black was run with string normalisation off, so the codebase kept its single quotes;
ruff's default `quote-style` is `"double"`. Fix: keep the codebase's quotes.

```toml
[tool.ruff.format]
quote-style = "preserve"
```

**Symptom: after copying `preview = true` from `[tool.black]` into `[tool.ruff]`, new lint
diagnostics appeared from rules nobody selected.** Cause: top-level `preview` turns on preview
for the linter *and* the formatter, and with preview on, prefix selectors match preview rules
too ([04](04-preview-mode.md)). Fix: scope it to the formatter.

```toml
[tool.ruff.format]
preview = true
```

**Symptom: `git blame` now attributes every line of the project to "Reformat with ruff".**
Cause: the reformat commit touched every line whose layout changed. Fix: record the commit in
`.git-blame-ignore-revs` and point `blame.ignoreRevsFile` at it, as in step 3 above.

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

**★ Symptom: the migrated configuration excludes nothing — `migrations/` and generated
`*_pb2.py` files are reformatted.** Cause: Black's `exclude`/`extend-exclude` take a regular
expression, and it was pasted into ruff's `extend-exclude`, which takes a list of glob patterns;
a string like `/(migrations|build)/` matches no path. Fix: rewrite it as globs.

```toml
[tool.ruff]
extend-exclude = ["migrations", "*_pb2.py", "*_pb2.pyi"]
```

**Symptom: ruff rejects the configuration with a parse error after `target-version` was copied
from `[tool.black]`.** Cause: Black takes a list of versions (`["py312", "py313"]`); ruff takes a
single string, the minimum. Fix: use the lowest version from Black's list — or, better, delete it
and let `requires-python` drive both.

```toml
[project]
requires-python = ">=3.12"
```

**Symptom: the migration branch's CI fails on a `ruff format --diff .` step before any
reformatting was committed.** Cause: `--diff` exits non-zero whenever there is a difference to
show; it is not an informational command. Fix: keep `--diff` for local review and gate CI on
`--check` once the reformat commit has landed.

```bash
uv run ruff format --check .
```

**Symptom: two weeks after the migration, one developer's commits keep re-wrapping lines.**
Cause: their editor still formats on save with Black. The repository no longer lists Black, but
an editor extension brings its own copy. Fix: set the editor's Python formatter to ruff
(**13** *(not written yet)*), and make CI the arbiter so drift is caught at review time.

```bash
uv run ruff format --check .
```

## Interview questions

**★ How would you migrate a large repository from Black to `ruff format` without damaging
history?**
Pin ruff, copy Black's `line-length` and any string-normalisation or trailing-comma settings into
ruff's configuration, preview the change with `ruff format --diff`, apply it as one commit that
contains nothing else, add that commit to `.git-blame-ignore-revs`, then remove Black from
dependencies, configuration, pre-commit, CI and editors in the same change so nothing runs it
again. Finally, enforce with `ruff format --check` in CI.

**★ Which Black settings carry over to ruff, and which only look like they do?**
`line-length` and `skip-magic-trailing-comma` carry over directly (the first only if you changed
Black's default of 88, which ruff shares). String normalisation maps to `quote-style =
"preserve"`. Three are traps: Black's `target-version` is a list while ruff's is one minimum
version (and `requires-python` is preferred over either); Black's `exclude` is a regex while
ruff's is a glob list; and Black's `preview` must go in `[tool.ruff.format]`, because top-level
`preview` also enables preview lint rules.

**Why remove Black from every consumer in the same change, rather than gradually?**
Because a formatter's output is only stable if it is the only formatter. Any leftover consumer —
a pre-commit hook, a CI job, one developer's editor — reformats the lines where the two tools
disagree, and ruff reformats them back, producing churn in unrelated commits and failing
`--check`. A gradual rollout is exactly the "used interchangeably on an ongoing basis" the ruff
documentation says the formatter is not intended for.

**What would you look for when reviewing the reformat commit?**
Not the bulk re-wraps, which are mechanical. Look for files Black never touched (notebooks,
Markdown code fences since 0.16.0), comments that moved to a different line — especially
end-of-line comments on previously unformatted code, where the FAQ says deviations concentrate —
suppression pragmas that no longer sit on the line they suppress, and version-gated style such as
the removal of parentheses around `except` tuples, which is only correct if the resolved target
version matches the interpreter you deploy on.

**How does migrating from YAPF differ from migrating from Black?**
The procedure is identical; the diff is much larger, because the >99.9% figure only applies to
code already formatted by Black. YAPF's `# yapf: disable` / `# yapf: enable` regions are
respected, but none of YAPF's style options have an equivalent — ruff deliberately exposes only
quote style, indent style, line endings and a few related options, so the team adopts ruff's
style rather than configuring it to match the old one.

---

← Prev: [07 · The formatter and Black](07-the-formatter-and-black.md) · [Topic index](README.md) · Next → [07c · Known deviations from Black](07c-known-deviations-from-black.md)
