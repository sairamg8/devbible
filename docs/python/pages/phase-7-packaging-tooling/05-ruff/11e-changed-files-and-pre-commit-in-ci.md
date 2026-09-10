---
title: "Linting only the files a pull request touched is sound exactly as long as the configuration, the ruff version and the package layout did not change — and it needs `--force-exclude`, a checkout deep enough to have a merge base, and a full run whenever those three move; running pre-commit as the CI step removes the path handling and adds a second version pin"
sidebar_label: "11e · Changed files and pre-commit in CI"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Configuring Ruff: Python file discovery* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/#python-file-discovery)),
> the settings reference for [`force-exclude`](https://docs.astral.sh/ruff/settings/#force-exclude), the ruff-pre-commit hook manifest at `v0.16.6`
> ([github.com](https://github.com/astral-sh/ruff-pre-commit/blob/v0.16.6/.pre-commit-hooks.yaml)); `actions/checkout` `action.yml` at v7.0.1
> ([github.com](https://github.com/actions/checkout/blob/v7.0.1/action.yml)); the `astral-sh/ruff-action` README at v4.1.0 (missing-path behaviour,
> [github.com](https://github.com/astral-sh/ruff-action/blob/v4.1.0/README.md)); **pre-commit 4.6.2** documentation — `run`, `autoupdate`, `rev` and pre-commit.ci
> ([pre-commit.com](https://pre-commit.com/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · **pre-commit 4.6.2** · `actions/checkout` v7.0.1 · `astral-sh/setup-uv` v10.0.1.
> Documentation-validated — **no sandbox run, no program output**.

**Almost every ruff rule looks at one file at a time, so a file's verdict depends on three things:
its own contents, the configuration that applies to it, and the ruff that ran. A pull request that
changes neither the configuration nor the version cannot change the verdict on a file it did not
touch — which is why linting only the changed files is tempting on a large repository. It is sound
under exactly that condition and wrong the moment the condition breaks: a new rule in `select`, a
ruff bump in `uv.lock`, or a new top-level package that changes which imports count as first-party.
The mechanics add three traps of their own. The alternative — running pre-commit as the CI step —
gets the path handling right for free and makes the hook's `rev` a second place ruff's version
lives.**

## Explicit paths bypass `exclude`

When ruff discovers files itself, `exclude` and `extend-exclude` apply. A changed-files script does
not let it discover anything — it passes paths — and passed paths are treated differently:

> *"Files that are passed to `ruff` directly are always analyzed, regardless of the above criteria, unless `force-exclude` is also enabled (via CLI or settings file). For example, without `force-exclude` enabled, `ruff check /path/to/excluded/file.py` will always lint `file.py`."*
> — [Configuring Ruff: Python file discovery](https://docs.astral.sh/ruff/configuration/#python-file-discovery)

The settings reference names the situation directly: `force-exclude` is *"useful for `pre-commit`,
which explicitly passes all changed files to the `ruff-pre-commit` plugin, regardless of whether
they're marked as excluded by Ruff's own settings."* A CI script that passes changed files is in the
same position. Either pass the flag, or set it once in the configuration so every caller that
passes paths — scripts, editors, hooks — gets it:

```toml
[tool.ruff]
extend-exclude = ["migrations", "src/billing/_generated"]
force-exclude = true
```

## A merge base needs history

The changed files are the diff between the pull request and its base — `git diff base...HEAD`,
where the three dots mean "since the merge base". `actions/checkout` fetches one commit by
default: `fetch-depth` is *"Number of commits to fetch. 0 indicates all history for all branches
and tags."*, default `1`. With one commit and no base branch there is no merge base to diff against.

```yaml
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
```

## A changed-files script that knows when to give up

```bash
#!/usr/bin/env bash
# scripts/ruff-changed.sh — check what this pull request changed; fall back to the whole tree
# when the verdict on unchanged files could have moved. Exit code: the worst one seen.
set -uo pipefail

base="origin/${GITHUB_BASE_REF:-main}"
changed="$(git -c core.quotePath=false diff --name-only --diff-filter=d "$base"...HEAD)" || exit 2

status=0
run() {                                   # run one command, keep the worst exit code
  "$@"
  local code=$?
  if [ "$code" -gt "$status" ]; then status=$code; fi
}

# The configuration or the ruff version changed: every file's verdict may have changed.
if grep -qE '(^|/)(pyproject\.toml|ruff\.toml|\.ruff\.toml|uv\.lock)$' <<<"$changed"; then
  run uv run --no-sync ruff check .
  run uv run --no-sync ruff format --check .
  exit "$status"
fi

mapfile -t lint_files < <(grep -E '\.(py|pyi|ipynb)$' <<<"$changed")
mapfile -t format_files < <(grep -E '\.(py|pyi|ipynb|md)$' <<<"$changed")

if [ "${#lint_files[@]}" -gt 0 ]; then
  run uv run --no-sync ruff check --force-exclude "${lint_files[@]}"
fi
if [ "${#format_files[@]}" -gt 0 ]; then
  run uv run --no-sync ruff format --check --force-exclude "${format_files[@]}"
fi
exit "$status"
```

What each line is defending against:

- **`--diff-filter=d`** drops deleted files. A deleted path passed to ruff is a path that does not
  exist, which ruff reports rather than skipping — the `ruff-action` README relies on exactly that
  when it passes an unmatched pattern through *"so Ruff can report the missing path."*
- **`core.quotePath=false`** stops git from quoting paths that contain non-ASCII bytes, which
  would otherwise reach ruff as literal quoted strings that name no file.
- **`grep … <<<"$changed"`, not `git diff | grep -q`.** Under `pipefail`, `grep -q` exits at the
  first match; if `git diff` is still writing, it is killed by `SIGPIPE`, the pipeline reports that
  failure, and the `if` sees "no match" — an intermittent skip of the full run on large diffs.
  Capturing the output first removes the pipe.
- **The fallback list** — the three configuration files and `uv.lock` — is the "configuration or
  version changed" condition. It cannot see a change in *layout*: a new top-level package
  directory changes which imports are first-party ([10](10-import-sorting.md)) and so the `I001`
  verdict on files that were not touched. That is one reason the full gate still runs on every push
  to the main branch.
- **Separate lists** — `.md` goes to the formatter only, because the formatter is what handles
  Markdown code blocks ([07g](07g-docstring-and-markdown-code.md)).

The workflow runs the script on pull requests and keeps the full gate from [11b](11b-the-ci-runner.md)
on `push`:

```yaml
on:
  pull_request:
jobs:
  ruff-changed:
    runs-on: ubuntu-latest
    env:
      RUFF_OUTPUT_FORMAT: github
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: astral-sh/setup-uv@v10.0.1
      - run: uv sync --locked --only-dev
      - run: scripts/ruff-changed.sh
```

## pre-commit as the CI step

The other way to avoid writing any of that is to let pre-commit decide which files to pass. Its
own documentation recommends the CI form:

> *"`pre-commit` can also be used as a tool for continuous integration. For instance, adding `pre-commit run --all-files` as a CI step will ensure everything stays in tip-top shape."*
> — [pre-commit.com](https://pre-commit.com/)

```yaml
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10.0.1
      - run: uvx pre-commit@4.6.2 run --all-files --show-diff-on-failure
```

What it buys: the hook list and every hook's arguments are defined once, in
`.pre-commit-config.yaml`, and CI runs exactly what developers run on commit. The ruff hooks
already carry the path handling — the 0.16.6 manifest's entries are `ruff check --force-exclude`
and `ruff format --force-exclude` — and a hook that modifies files fails the run, which in CI is the
right outcome; `--show-diff-on-failure` then prints *"`git diff` directly afterward"*, so the log
shows the fix.

What it costs: the ruff that runs is the hook's `rev`, not `uv.lock`. pre-commit *"assumes that the
value of `rev` is an immutable ref (such as a tag or SHA) and will cache based on that"*, and the
ruff-pre-commit `rev` *is* the ruff version, so the project now states its ruff in two files that
nothing forces to agree. pre-commit.ci makes this worse by design — it *"will periodically
autoupdate your configuration"*, moving `rev` on its own schedule. Keeping the two in step is
**12 · Pinning ruff** *(not written yet)*; the hook configuration itself is topic
**11 · pre-commit** *(not written yet)*.

## Gotchas

**★ Symptom: the changed-files job reports violations in a generated file the configuration
excludes.** Cause: the script passes paths explicitly, and explicit paths are *"always analyzed …
unless `force-exclude` is also enabled."* Fix: set it in the configuration, so every caller that
passes paths gets it.

```toml
[tool.ruff]
force-exclude = true
```

**★ Symptom: the job fails at the `git diff origin/main...HEAD` line — git cannot find the base.**
Cause: `actions/checkout` fetched one commit (`fetch-depth` default `1`), so there is no base
branch and no merge base. Fix: fetch history.

```yaml
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
```

**★ Symptom: a pull request that added `"B"` to `select` passed CI, and `main` went red on the
next push.** Cause: the changed-files job checked only the files the pull request touched, but the
configuration change altered the verdict on every file. Fix: fall back to the full run when
`pyproject.toml`, `ruff.toml`, `.ruff.toml` or `uv.lock` changed — the first branch of the script.

```bash
if grep -qE '(^|/)(pyproject\.toml|ruff\.toml|\.ruff\.toml|uv\.lock)$' <<<"$changed"; then
  run uv run --no-sync ruff check .
fi
```

**Symptom: the changed-files job fails on a pull request that only deleted a module.** Cause: the
deleted path was passed to ruff, which reports a path that does not exist. Fix: drop deletions from
the list.

```bash
git diff --name-only --diff-filter=d "$base"...HEAD
```

**Symptom: the full-run fallback fires on some large pull requests and not others that change the
same `pyproject.toml`.** Cause: the check was `git diff … | grep -q …` under `set -o pipefail`;
when `grep -q` exits early, `git diff` dies of `SIGPIPE` and the pipeline counts as failed. Fix:
capture the diff, then search the variable.

```bash
changed="$(git diff --name-only --diff-filter=d "$base"...HEAD)"
grep -qE '(^|/)pyproject\.toml$' <<<"$changed"
```

**Symptom: a file with a non-ASCII name is never checked — ruff is handed a path wrapped in quotes
with octal escapes.** Cause: git quotes such paths in `--name-only` output by default. Fix: turn
the quoting off for that command.

```bash
git -c core.quotePath=false diff --name-only --diff-filter=d "$base"...HEAD
```

**Symptom: after a new top-level package was added, `I001` fails on `main` in files no pull
request touched.** Cause: first-party detection looks at the filesystem, so a new package
directory reclassified imports everywhere — a change the configuration-file fallback cannot see.
Fix: keep the full gate on pushes to the main branch; the changed-files job is a fast path, not
the only check.

```yaml
on:
  push:
    branches: [main]
```

**Symptom: CI's pre-commit run and a developer's `uv run ruff check` disagree about the same
file.** Cause: pre-commit runs the ruff of the hook's `rev`; `uv run` runs the one in `uv.lock`;
someone — or pre-commit.ci's autoupdate — moved one of them. Fix: make ruff refuse to run at any
other version, so the drift fails loudly (**12** *(not written yet)*).

```toml
[tool.ruff]
required-version = "==0.16.6"
```

## Interview questions

**★ When is it safe to lint only the files a pull request changed?**
When nothing that affects other files' verdicts changed: not the ruff configuration, not the ruff
version, and not the package layout that decides first-party imports. Most rules are per-file, so
under those conditions an untouched file's result cannot move. A sound changed-files job therefore
falls back to the whole tree when configuration files or the lockfile change, and the full gate
still runs on the main branch to catch what no file list can detect.

**★ Why does a changed-files ruff run need `--force-exclude`?**
Because passing a path explicitly overrides exclusion: ruff's documentation says directly passed
files are always analysed unless `force-exclude` is enabled. A script that lists changed files
therefore lints generated code, migrations and vendored files the configuration meant to skip.
Setting `force-exclude = true` in the configuration fixes it for every caller that passes paths —
pre-commit hooks, editors and scripts alike.

**What does `pre-commit run --all-files` in CI give you over calling ruff directly, and what does it
cost?**
It gives one definition of the checks: CI runs the same hooks with the same arguments developers
run on commit, with the path handling (`--force-exclude`) built into the ruff hooks, and a hook
that modifies files fails the run. It costs a second version pin — the ruff-pre-commit `rev` is
the ruff version and is independent of `uv.lock` — plus a pre-commit installation on the runner.
Tools that bump `rev` automatically, such as pre-commit.ci's autoupdate, make the two drift unless
something like `required-version` forces them to agree.

**Why does a shallow checkout break a changed-files job, and what does `...` mean in the diff?**
`base...HEAD` diffs `HEAD` against the merge base of the two branches — the changes the pull request
introduced, ignoring what landed on the base branch since. Computing a merge base needs both
histories, and `actions/checkout` fetches a single commit by default. `fetch-depth: 0` fetches the
history, including the base branch the script diffs against.

---

← Prev: [11d · CI reports](11d-ci-reports.md) · [Topic index](README.md) · Next → **12 · Pinning ruff** *(not written yet)*
