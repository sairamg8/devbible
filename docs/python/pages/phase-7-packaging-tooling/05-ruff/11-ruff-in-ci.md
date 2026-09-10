---
title: "In CI ruff is a gate, not a tool — `ruff check` and `ruff format --check`, never `--fix` or a bare `ruff format`, both allowed to report even when the first one fails, and an exit code read as three answers, because `2` means the gate itself is broken"
sidebar_label: "11 · ruff in CI"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Exit codes* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#exit-codes)),
> *The Ruff Formatter: Exit codes* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/#exit-codes)), the `ruff check`/`ruff format` help text in
> *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)) and the CLI argument definitions in `crates/ruff/src/args.rs`
> at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff/src/args.rs)) (the `--exit-non-zero-on-fix` alias on `format`).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**A developer runs ruff to change code; CI runs it to refuse code. Everything about the CI
invocation follows from that. It must not write — a fix applied on a runner is thrown away with
the runner, and the job reports success for a tree nobody committed. It must check both halves,
because `ruff check` and `ruff format` are two tools with two exit contracts
([01b](01b-check-and-format-are-two-tools.md)), and it must let both report in the same run. And
its exit code carries three answers, not two: clean, dirty, or *the gate itself is broken*. This
page is the gate — the commands and what their exit codes mean. [11b](11b-the-ci-runner.md) is
the runner that executes it: which ruff gets installed and one complete workflow;
[11c](11c-ruff-action.md) covers `ruff-action`, [11d](11d-ci-reports.md) GitLab, code-scanning
and JSON reports, and [11e](11e-changed-files-and-pre-commit-in-ci.md) changed-files-only runs and pre-commit as the CI
step.**

## The two commands

```bash
uv run --no-sync ruff check .            # exit 1 if any violation remains
uv run --no-sync ruff format --check .   # exit 1 if any file would be reformatted
```

Neither writes a file. Both of the obvious alternatives do, and both exit `0` while doing it:

| Command | Why it cannot be a gate |
|---|---|
| `ruff check --fix` | exits `0` *"if all present violations were fixed automatically"* — fixed on the runner's copy, which is discarded |
| `ruff format` | exits `0` *"regardless of whether any files were formatted"* ([01b](01b-check-and-format-are-two-tools.md)) |
| `ruff check --diff` | the help text says it *"Implies `--fix-only`"*, and `--fix-only` does not *"report on, or exit non-zero for, leftover violations"* — a violation with no fix passes |

`ruff format --diff` is the one `--diff` that is a gate: it exits non-zero when a file would
change *and* prints the change, which is what an author reading the CI log wants.

```bash
uv run --no-sync ruff format --diff .    # a gate that also shows the fix in the log
```

## Exit codes — three answers

| Exit | `ruff check` | `ruff format --check` | What CI should conclude |
|---:|---|---|---|
| `0` | *"no violations were found, or … all present violations were fixed automatically"* | *"no files would be formatted if `--check` were not specified"* | pass |
| `1` | *"violations were found"* | *"one or more files would be formatted"* | the tree needs work — the author's problem |
| `2` | *"Ruff terminates abnormally due to invalid configuration, invalid CLI options, or an internal error"* | the same wording | 🔴 **the gate is broken** — the project's problem, and nobody's tree was checked |

`2` is the code a CI script must never swallow. It is what an upgrade produces when a
configuration key was removed or renamed, what a typo in `pyproject.toml` produces, and what
`required-version` produces on the wrong ruff (**12 · Pinning ruff** *(not written yet)*). A job that turns `2`
into green has stopped checking anything and will say so to nobody.

The flags that move these codes:

| Flag | Command | Effect |
|---|---|---|
| `--exit-zero` | `check` | *"exit with a status code of `0` even if violations were found. Note that Ruff will still exit with a status code of `2` if it terminates abnormally."* |
| `--exit-non-zero-on-fix` | `check` | exit `1` if violations were found *"even if all such violations were fixed automatically"* — for jobs that fix and must still fail |
| `--exit-non-zero-on-format` | `format` | exit `1` when files were reformatted; the 0.16.6 source also accepts `--exit-non-zero-on-fix` as an alias on `format` |

So a report-only job — one that exists to upload results, not to fail the build — uses
`--exit-zero`, never `|| true`:

```bash
uv run --no-sync ruff check --exit-zero --output-format=sarif --output-file=ruff.sarif .
```

`--exit-zero` still fails on `2`; `|| true` turns a broken configuration into a passing job.

## Let both halves report

In GitHub Actions a step runs only when every earlier step succeeded, so with `ruff check` first,
one lint violation hides the formatter's verdict. The author fixes the violation, pushes, waits for
CI, and only then learns the file was also unformatted — two round trips for one push's worth of
work. Let the second step run whenever the environment was set up, regardless of the first
step's result:

```yaml
      - name: ruff format --check
        if: ${{ !cancelled() && steps.sync.outcome == 'success' }}
        run: uv run --no-sync ruff format --check .
```

`!cancelled()` overrides the implicit "previous steps succeeded" condition; the `steps.sync`
test — `sync` being the id of the step that installs the environment, shown in the complete
workflow in [11b](11b-the-ci-runner.md) — keeps the step from running when there is no
environment to run it in. In a plain shell
script the same thing is an accumulated status:

```bash
#!/usr/bin/env bash
# scripts/ruff-gate.sh — run both halves, fail if either failed, keep the worst exit code
set -uo pipefail

status=0
uv run --no-sync ruff check . || status=$?
format_status=0
uv run --no-sync ruff format --check . || format_status=$?
if [ "$format_status" -gt "$status" ]; then status=$format_status; fi
exit "$status"
```

Keeping the *worst* code, not the last one, preserves a `2` from either command.

## Gotchas

**★ Symptom: CI is green, but the next developer who runs ruff locally gets a pile of fixes on
files they never touched.** Cause: the CI step is `ruff check --fix`. It fixed the runner's copy,
exited `0` because *"all present violations were fixed automatically"*, and the runner was
discarded. Fix: CI checks, it never fixes.

```yaml
      - run: uv run --no-sync ruff check .
```

**★ Symptom: after a ruff upgrade the lint job has been green for weeks, and it turns out it has
not checked anything.** Cause: the step is `ruff check . || true` (added once to "make lint
non-blocking"), and the upgrade made the configuration invalid — exit `2`, masked. Fix: use
`--exit-zero` for a non-blocking job; it still exits `2` on a broken configuration.

```bash
uv run --no-sync ruff check --exit-zero .
```

**★ Symptom: every push fails on lint, then — after the fix — on formatting.** Cause: the format
step never ran, because a failed step skips the ones after it. Fix: let the format step run
unless the job was cancelled or the environment was never set up.

```yaml
        if: ${{ !cancelled() && steps.sync.outcome == 'success' }}
```

**Symptom: a violation with no available fix — an `F821` undefined name — passed CI.** Cause: the
gate was `ruff check --diff`, which *"Implies `--fix-only`"*, and `--fix-only` does not report or
fail on leftover violations. Fix: `--diff` belongs to the formatter's gate, not the linter's.

```bash
uv run --no-sync ruff check .
uv run --no-sync ruff format --diff .
```

## Interview questions

**★ Why should CI never run `ruff check --fix` or a bare `ruff format`?**
Because CI's job is to refuse a tree that is not clean, and both commands make the runner's copy
clean and then exit `0` — `check --fix` when every violation was fixable, `format` whenever it
succeeds at all. The runner's copy is thrown away, so the job has certified a tree that nobody
committed. A gate uses the non-writing forms: `ruff check` (exit `1` on any violation) and
`ruff format --check` or `--diff` (exit `1` if any file would change).

**★ What do ruff's exit codes mean, and why must a CI script tell `1` from `2`?**
`0` is clean, `1` is "the tree has problems" — violations remain, or a file would be reformatted —
and `2` is "ruff terminated abnormally": invalid configuration, invalid options, or an internal
error. `1` is the author's problem; `2` means no file was checked at all. A script that collapses
them — `|| true`, or retrying on any non-zero — hides a broken configuration behind a green job.
`--exit-zero` is the safe way to make a job non-blocking because it still exits `2`.

**Why run the format check even when the lint step has already failed?**
Because the two are independent verdicts about the same push, and a failed step skips the rest by
default. Without an override the author sees only the first failure, fixes it, pushes, and waits
for CI to reveal the second. `if: ${{ !cancelled() && … }}` on the format step — or an accumulated
exit status in a script — reports both in one run, while still keeping the job red.

**Why is `ruff check --diff` not a substitute for `ruff check` in CI?**
Its help text says it implies `--fix-only`, and `--fix-only` does not report or exit non-zero for
leftover violations. So it shows the fixes ruff could make and ignores every violation without a
fix — undefined names, bare `except` clauses, most of what matters. `ruff format --diff` is a
proper gate because formatting has no "unfixable" category.

**What is the difference between `--exit-zero` and `|| true`?**
`--exit-zero` changes only the meaning of "violations found": ruff exits `0` instead of `1`, but
still exits `2` when it terminates abnormally. `|| true` discards every non-zero code, including
`2`. For a report-only job — one that uploads SARIF, say — `--exit-zero` keeps the job honest about
the one failure that means the report is empty because nothing ran.

---

← Prev: [10b · isort settings](10b-isort-settings.md) · [Topic index](README.md) · Next → [11b · The CI runner](11b-the-ci-runner.md)
