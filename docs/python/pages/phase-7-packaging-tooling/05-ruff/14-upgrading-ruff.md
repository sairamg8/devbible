---
title: "Upgrading ruff is a pull request, not a version bump — read the breaking changes of every minor you cross, move every pin at once, measure with `--statistics` before touching code, and land the consequences as separate commits: configuration, the mechanical reformat, the safe fixes, the dead suppressions, and only then a baseline of what is left"
sidebar_label: "14 · Upgrading ruff safely"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Versioning* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/versioning/)),
> `BREAKING_CHANGES.md` and `CHANGELOG.md` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md),
> [github.com](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md)), the `--statistics` help text in *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)),
> the configuration warning and error templates in `crates/ruff_workspace/src/configuration.rs` at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_workspace/src/configuration.rs)), the `unused-noqa` (`RUF100`) rule page
> ([docs.astral.sh](https://docs.astral.sh/ruff/rules/unused-noqa/)); *Integrations: pre-commit* ([docs.astral.sh](https://docs.astral.sh/ruff/integrations/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2. The worked example upgrades from ruff 0.15.22 (2026-07-16).
> Documentation-validated — **no sandbox run, no program output**.

**With an exact pin ([12](12-pinning-ruff.md)), a ruff upgrade happens only when someone makes it
happen — which is the point, and also the obligation. A minor release can change the formatting of
untouched files, run hundreds of new rules, remove rules your configuration names, and leave
suppressions pointing at rules that no longer run. None of that is a reason to stay behind; all of
it is a reason to do the upgrade as its own pull request, with its own reading, and with the
consequences split into commits a reviewer can actually check. The hard part is not the command
that changes the version. It is keeping a mechanical reformat, a batch of automatic fixes and a
policy decision about new rules from arriving as one unreviewable diff.**

## What an upgrade can change

ruff's versioning page lists what may change in a minor and what in a patch ([12](12-pinning-ruff.md)
quotes both lists). Mapped to what you actually see:

| What changed | What you see | Handled in |
|---|---|---|
| the stable formatter style (2025 style in 0.9.0, 2026 style in 0.15.0) | `ruff format --check` fails on files nobody touched | the reformat commit below; [07](07-the-formatter-and-black.md) |
| stable rules added to the default set (413 rules from 0.16.0) | new violations everywhere, if the configuration has no `select` | [03b](03b-the-default-rule-set.md) |
| a rule promoted from preview, or a stable rule's behaviour changed | new violations under prefixes you already select, or under `ALL` | fix, ignore, or baseline |
| a rule removed | ``Rule `{code}` was removed and cannot be selected.`` — the configuration no longer loads | delete it from `select`/`ignore` |
| a rule code remapped | ``` `{from}` has been remapped to `{prefix}{code}`. ``` — for example `TCH` → `TC` in 0.8.0 | rename it |
| rules removed from the default set | `RUF100` reports every `noqa` for them as unused | the suppression cleanup below; [06c](06c-unused-suppressions-and-adoption.md) |
| a new file type on by default (Markdown in 0.16.0) | `ruff format --check` now covers `.md` files | [07g](07g-docstring-and-markdown-code.md) |
| the default Python version (3.9 → 3.10 in 0.14.0) | different `UP` suggestions in a project that declares no version | declare it ([09](09-target-version.md)) |
| an output format (nullable JSON locations in 0.16.0) | scripts reading `--output-format=json` break | [11d](11d-ci-reports.md) |

The templates in the table are from `configuration.rs` at the `0.16.6` tag; the numbers and version
boundaries are from the changelog and `BREAKING_CHANGES.md`.

## Where to read what changed

`BREAKING_CHANGES.md` in the ruff repository has one section per breaking minor — `## 0.16.0`,
`## 0.15.0`, `## 0.14.0` and so on — and nothing else. It is the page to read for **every** minor
between the pinned version and the target, not just the last one. Two entries show why a single
line can matter:

> *"Ruff now defaults to Python 3.10 instead of 3.9 if no explicit Python version is configured"* — 0.14.0
>
> *"Ruff now resolves all `extend`ed configuration files before falling back on a default Python version."* — 0.15.0
> — [BREAKING_CHANGES.md](https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md)

The CHANGELOG adds what `BREAKING_CHANGES.md` leaves out — the rules stabilised in each minor,
preview changes in every patch, bug fixes that change a rule's verdict — and for large minors it
points to a release post: the 0.16.0 entry opens with *"Check out the blog post for a migration guide
and overview of the changes!"*

## The procedure — worked from 0.15.22 to 0.16.6

### 1 · One branch, every pin

```bash
git switch -c upgrade-ruff-0.16.6

uv add --dev 'ruff==0.16.6'
sed -i 's/^required-version = .*/required-version = "==0.16.6"/' pyproject.toml
sed -i 's/rev: v0\.15\.22$/rev: v0.16.6/' .pre-commit-config.yaml

git grep -n '0\.15\.22'        # any pin left behind: an image tag, an action's version input, a script
```

The last line is the check that matters. [12](12-pinning-ruff.md) listed the places a ruff version
lives; anything still naming the old version after the edits is a consumer that will disagree with
the rest.

### 2 · Make the configuration load

```bash
uv run ruff check --exit-zero --statistics .
```

`--exit-zero` turns violations into exit `0` but not a configuration failure, so this command exits
non-zero only for the problems that must be fixed first: removed rules, renamed options, a
`required-version` that no longer matches ([11](11-ruff-in-ci.md)). Fix those in the configuration
and nothing else.

### 3 · Measure before changing code

`--statistics` — *"Show counts for every rule with at least one violation"* — turns step 2's output
into the upgrade's to-do list: which rules fire and how often. The formatter's share:

```bash
uv run ruff format --check .     # lists the files the new style would change
```

Now decide, per rule, whether to fix, ignore, or baseline — before the diff exists.

### 4 · The commits

```bash
# 1 — pins and configuration only
git commit -am "ruff 0.16.6: pins and configuration"

# 2 — the mechanical reformat, alone, then hidden from blame
uv run ruff format .
git commit -am "ruff 0.16.6: reformat"
git rev-parse HEAD >> .git-blame-ignore-revs
git add .git-blame-ignore-revs
git commit -m "Ignore the ruff 0.16.6 reformat in git blame"

# 3 — safe fixes, reformatted, reviewed (RUF100's fixes held back for commit 4)
uv run ruff check --fix --unfixable RUF100 --exit-zero .
uv run ruff format .
git commit -am "ruff 0.16.6: safe fixes"

# 4 — suppressions that no longer suppress anything: every rule evaluated, only RUF100 fixed
uv run ruff check --extend-select RUF100 --fixable RUF100 --fix --exit-zero .
git commit -am "ruff 0.16.6: remove unused suppressions"

# 5 — record what is left as explicit, removable debt
uv run ruff check --add-noqa="ruff 0.16.6 upgrade baseline" .
git commit -am "ruff 0.16.6: baseline remaining violations"
```

Why this order:

- **Configuration first**, so every later commit is produced by the final configuration.
- **The reformat alone**, because it is the one commit nobody reviews line by line — and it can be
  trusted only if it contains nothing else. Listing it in `.git-blame-ignore-revs` keeps `git blame`
  pointing at the real authors ([07b](07b-migrating-from-black.md) has the `blame.ignoreRevsFile`
  setup).
- **Fixes, then format again.** The integrations page's ordering applies here too: *"Ruff's fix
  behavior can output code changes that require reformatting."* Safe fixes are meant to preserve
  behaviour, and still deserve a read; on a large codebase apply them per prefix
  (`--select UP --fix`), one commit each.
- **`RUF100` is held out of commit 3** because since 0.16.0 it is in the default set, so a plain
  `--fix` would mix suppression removals into the fixes. On the command line `--unfixable` is
  applied on top of the configuration's own `unfixable` list, while `--fixable` replaces the fixable
  set outright — which is exactly what commit 4 wants (the merge logic in `configuration.rs` at the
  `0.16.6` tag). Commit 4 runs it with `--extend-select`,
  never `--select`: `RUF100` reports a code as unused when its rule is *not enabled*, and with
  `--select RUF100` no other rule is.
- **Dead suppressions before the baseline**, so the baseline records only live violations. After
  0.16.0 dropped 18 rules from the defaults, every `# noqa: E402` in a project without an explicit
  `select` became an unused suppression ([03b](03b-the-default-rule-set.md)).
- **The baseline last**, and with a reason string, so the comments can be found and removed later
  ([06c](06c-unused-suppressions-and-adoption.md)). A project that would rather keep the old rule set
  for now pins it instead — `select = ["E4", "E7", "E9", "F"]` is the pre-0.16 default.

CI has to pass at the head of the pull request, not at every commit in it.

## Gotchas

**★ Symptom: the upgrade pull request is four thousand changed lines, and review stalls.** Cause:
the bump, the reformat, the automatic fixes and the new violations' fixes landed as one commit.
Fix: rebuild it as the commit sequence above, with the reformat alone and listed in
`.git-blame-ignore-revs`.

```bash
git rev-parse HEAD >> .git-blame-ignore-revs
```

**★ Symptom: right after the bump, every ruff invocation exits `2` and no file is checked.** Cause:
the configuration names something the new version removed — for a rule, ruff says
``Rule `{code}` was removed and cannot be selected.`` Fix: delete it from the configuration; the
rule's job either moved elsewhere or ended.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "F", "B", "UP", "I"]   # E999 removed in 0.8.0: syntax errors always show
```

**★ Symptom: after the upgrade merged, commits fail in pre-commit with a required-version
error.** Cause: one pin was left on the old version — here the hook's `rev`. Fix: find every
occurrence of the old version before merging.

```bash
git grep -n '0\.15\.22'
```

**★ Symptom: the `RUF100 --fix` commit deleted a `# pylint: disable=…` that shared a line with a
`noqa`.** Cause: *"Ruff may remove trailing comments that follow a `# noqa` directive on the same
line, as it interprets the remainder of the line as a description for the suppression."* Fix:
separate the other tool's pragma with its own `#`, as the rule page recommends.

```python
def ParseInvoice(raw):  # noqa: N802 # pylint: disable=invalid-name
    return raw.strip()
```

**★ Symptom: the "remove unused suppressions" step deleted every `noqa` in the codebase, including
ones that were still needed.** Cause: it ran `ruff check --select RUF100 --fix`. With only `RUF100`
selected, every other code in every `noqa` names a rule that is not enabled, which `RUF100` reports
as unused ([06c](06c-unused-suppressions-and-adoption.md)) — and `--fix` removes them. Fix: evaluate
the real rule set and restrict only which fixes apply.

```bash
uv run ruff check --extend-select RUF100 --fixable RUF100 --fix --exit-zero .
```

**Symptom: a warning about a remapped code appears on every run after the upgrade.** Cause: the
configuration uses an old prefix — ``` `{from}` has been remapped to `{prefix}{code}`. ``` Fix:
use the new code; `TCH` became `TC` in 0.8.0.

```toml
[tool.ruff.lint]
extend-select = ["TC"]
```

**Symptom: `ruff format --check` starts failing on `README.md` and `docs/` after moving to 0.16.**
Cause: 0.16.0 formats Python code blocks in Markdown by default. Fix: include them in the reformat
commit, or exclude Markdown deliberately ([07g](07g-docstring-and-markdown-code.md)).

```toml
[tool.ruff]
extend-exclude = ["*.md"]
```

**Symptom: after crossing 0.14.0, `UP` rules propose different rewrites though nobody changed the
configuration.** Cause: the project declares no Python version, and 0.14.0 moved the default from
3.9 to 3.10. Fix: declare the oldest Python the code supports, so the default never matters
([09](09-target-version.md)).

```toml
[project]
requires-python = ">=3.12"
```

## Interview questions

**★ Walk through upgrading ruff across a minor release on a large codebase.**
Read `BREAKING_CHANGES.md` and the changelog for every minor crossed. On a branch, move every pin
together — the dev group and lock, `required-version`, the pre-commit `rev`, CI image tags — and
`git grep` for the old version. Get the configuration loading again (`--exit-zero --statistics`
exits non-zero only for configuration failures), then measure: violation counts per rule and the
files the formatter would change. Commit in layers: configuration; the reformat alone, added to
`.git-blame-ignore-revs`; safe fixes, reformatted; removal of dead suppressions; a reasoned baseline
for the rest — or pin the old rule set and adopt new rules later.

**★ Why must the reformat be its own commit?**
Because it is the one change reviewers approve without reading every line, and that is only safe if
it contains nothing but formatting. Mixed with fixes or rule changes, a behaviour change hides
inside thousands of whitespace edits. Alone, it can be regenerated and compared, and listed in
`.git-blame-ignore-revs` so that blame skips it.

**What does exit code `2` right after an upgrade usually mean?**
That ruff could not load the configuration, so it checked nothing: a rule the configuration selects
or ignores was removed, an option was removed or renamed, or `required-version` excludes the new
binary. It is a configuration fix, not a code fix, and it has to come before any count of
violations means anything.

**Why remove unused suppressions before baselining the remaining violations?**
A baseline written by `--add-noqa` should record only violations that exist. Upgrades turn existing
suppressions into dead ones — a rule leaves the defaults or changes what it flags — and `RUF100`
finds them. Cleaning those first keeps the baseline honest; doing it after mixes dead and live
suppressions in the comments you will later work through.

---

← Prev: [13c · Pyright and other editors](13c-pyright-and-other-editors.md) · [Topic index](README.md) · Next → **14b · Trial runs, preview and upgrade bots** *(not written yet)*
