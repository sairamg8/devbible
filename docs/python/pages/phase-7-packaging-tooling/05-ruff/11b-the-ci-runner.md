---
title: "The runner must install the ruff the lockfile names — `uv sync --locked` plus `uv run`, not an unpinned `pip install` — and the workflow around it has two traps of its own: `setup-uv` publishes no major tag since v8, and ruff never switches to GitHub annotations unless you ask"
sidebar_label: "11b · The CI runner"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Integrations* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/integrations/)),
> the settings reference for [`cache-dir`](https://docs.astral.sh/ruff/settings/#cache-dir), the CLI argument definitions in `crates/ruff/src/args.rs`
> at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff/src/args.rs)) (`RUFF_OUTPUT_FORMAT` bound on both `check` and `format`;
> `RUFF_NO_CACHE`), the 0.16.0 entry of `BREAKING_CHANGES.md` ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md)) and a code search of the
> ruff repository for `GITHUB_ACTIONS` (no match, 2026-09-10); `astral-sh/setup-uv` README at v10.0.1 and the v8.0.0 and v10.0.0 release notes
> ([github.com](https://github.com/astral-sh/setup-uv/releases)); `actions/checkout` `action.yml` at v7.0.1 and the v7.0.0 release notes ([github.com](https://github.com/actions/checkout/releases/tag/v7.0.0)).
> Action versions checked on each repository's releases page and tag list on **2026-09-10**: `actions/checkout` **v7.0.1** (floating `v7` tag exists),
> `astral-sh/setup-uv` **v10.0.1** (no floating major tag).
> Version spine: **ruff 0.16.6** (2026-09-03) · **uv 0.12.12** · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**[11](11-ruff-in-ci.md) settled what the gate runs. This page is where it runs: a CI runner that
starts empty and has to be given a ruff. The only installation that keeps CI honest is the one
the developers already use — ruff as a locked dev dependency, installed with `uv sync --locked`
and run with `uv run` — because ruff's breaking changes ship in minor releases and anything that
resolves its own version can run a different minor from everyone's laptop. Around that one
decision sit the details that break real workflows: an action tag that does not exist, a lint job
that installs the whole application, annotations that never appear, and a cache directory nobody
asked for.**

## Which ruff the runner gets

| How it is installed | Version comes from | Same as the developers'? |
|---|---|---|
| `uv sync --locked --only-dev`, then `uv run --no-sync ruff` | `uv.lock` | yes — the reviewed lock, and `--locked` fails if `pyproject.toml` and the lock disagree ([`--locked` in CI](../03-dependencies/20-the-ci-flags-that-refuse-to-re-resolve.md)) |
| `astral-sh/ruff-action` | its `version` input, else the nearest `pyproject.toml`, else latest | only with an exact pin or `version-file: uv.lock` (**11c · CI variants** *(not written yet)*) |
| `uvx ruff@0.16.6`, `pip install ruff==0.16.6` | the literal at the call site | only while someone keeps the literal in step with the lock (**12 · Pinning ruff** *(not written yet)*) |
| `pip install ruff` | whatever PyPI has at job time | no — the next minor reaches CI before anyone chose it |

The last row is the integrations page's own GitHub Actions example (`pip install ruff`, then
`ruff check --output-format=github .`). It is a demonstration of the output format, not a
recommendation for a gate: ruff ships breaking changes in *minor* releases, and an unpinned install
means a new minor can turn every open pull request red at once.

`--only-dev` is enough because ruff never imports the code it checks; the project and its runtime
dependencies do not need to be installed for a lint job ([`uv sync` flags](../02-uv/02c-uv-sync-makes-the-environment-match.md)).
A project that keeps ruff in a dedicated group installs that group instead: `uv sync --locked --only-group lint`.

## A complete workflow

```yaml
# .github/workflows/lint.yml
name: lint

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  ruff:
    runs-on: ubuntu-latest
    env:
      RUFF_OUTPUT_FORMAT: github        # inline annotations from both commands
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10.0.1
      - name: Install the locked dev group
        id: sync
        run: uv sync --locked --only-dev
      - name: ruff check
        run: uv run --no-sync ruff check .
      - name: ruff format --check
        if: ${{ !cancelled() && steps.sync.outcome == 'success' }}
        run: uv run --no-sync ruff format --check .
```

Line by line:

- **`actions/checkout@v7`** — v7 is the current major (v7.0.1, checked 2026-09-10), and the
  repository still publishes a floating `v7` tag. It must come first: setup-uv's README says
  *"Running `actions/checkout` after `setup-uv` **is not supported**."*
- **`astral-sh/setup-uv@v10.0.1`** — the full version, because 🔴 **there is no `v10` tag.**
  Since v8.0.0 the action publishes only immutable full-version tags:

  > *"To increase **security** even more we will **stop publishing minor tags**. You won't be able to use `@v8` or `@v8.0` any longer."*
  > — [setup-uv v8.0.0 release notes](https://github.com/astral-sh/setup-uv/releases/tag/v8.0.0)

  The README's own examples go further and pin a commit SHA with the version in a comment; that
  is the stricter form of the same idea.
- **`uv sync --locked --only-dev`** — installs exactly the locked ruff; setup-uv *"only sets up
  `uv`"* and installs nothing from `pyproject.toml` by itself.
- **`RUFF_OUTPUT_FORMAT: github`** — in the 0.16.6 source both `check` and `format` bind their
  `--output-format` option to this environment variable, and since 0.16.0 `format --check`
  *"supports the same output formats as the linter, including the `github` and `gitlab` outputs
  for rendering annotations in CI"*. ruff does not detect that it is running on GitHub Actions — a
  search of the ruff repository for `GITHUB_ACTIONS` on 2026-09-10 found nothing — so without the
  variable (or `--output-format=github`) the job prints the default `full` format and the pull
  request gets no annotations.

## The cache on a runner

ruff writes its cache to `.ruff_cache` — *"By default, Ruff stores cache results in a
`.ruff_cache` directory in the current project root"* — and on a fresh runner that directory
starts empty. It does no harm there; the cache directory carries its own `.gitignore`. If the
checkout is read-only, or the job should not write into the workspace at all, turn it off with
`--no-cache` or `RUFF_NO_CACHE`, both bound in the 0.16.6 CLI source. The documentation does not
discuss persisting `.ruff_cache` between CI runs, and nothing was measured for this page.

## Gotchas

**★ Symptom: the workflow fails before any step runs, on the `astral-sh/setup-uv@v10` line.**
Cause: setup-uv stopped publishing major and minor tags at v8.0.0, so `v10` is not a ref that
exists. Fix: the full version, or a commit SHA.

```yaml
      - uses: astral-sh/setup-uv@v10.0.1
```

**★ Symptom: CI reports violations nobody can reproduce locally — or misses ones everyone sees.**
Cause: the runner installs ruff independently of the lock (`pip install ruff`, an unpinned
`uvx ruff`), so it runs a different ruff than the developers do. Fix: run the locked ruff.

```yaml
      - run: uv sync --locked --only-dev
      - run: uv run --no-sync ruff check .
```

**Symptom: the job fails, but the pull request shows no annotations — the reason is buried in the
log.** Cause: the output format is the default `full`; ruff does not switch to `github` on a
runner. Fix: set it for the job, which covers both commands.

```yaml
    env:
      RUFF_OUTPUT_FORMAT: github
```

**Symptom: CI passes, yet `uv.lock` no longer matches `pyproject.toml` — someone bumped ruff in
one and not the other.** Cause: the job ran `uv sync` without `--locked`, which re-locks on the
runner and carries on. Fix: `--locked`, so the mismatch is a failure
([`--locked` in CI](../03-dependencies/20-the-ci-flags-that-refuse-to-re-resolve.md)).

```yaml
      - run: uv sync --locked --only-dev
```

**Symptom: `uv sync` in the lint job spends its time installing the web framework, the database
driver and the test stack.** Cause: a plain `uv sync` installs the project and every default
group, and ruff needs none of them. Fix: install only the group that holds ruff.

```yaml
      - run: uv sync --locked --only-dev
```

**Symptom: a lint workflow triggered on `pull_request_target` stops checking out fork pull requests
after the bump to `actions/checkout@v7`.** Cause: the v7.0.0 release notes list *"block checking
out fork pr for pull_request_target and workflow_run"* — the event runs with the base repository's
privileges, and checking out untrusted fork code under it is what the change forbids. setup-uv
v10.0.0 likewise turns its default cache off for *"`pull_request_target` `workflow_run` `release`"*
to prevent cache poisoning. Fix: lint on `pull_request`. ruff needs no secrets, and `github`
annotations are workflow commands printed to the log, not API calls made with the job's token.

```yaml
on:
  pull_request:
```

## Interview questions

**★ How do you guarantee CI runs the same ruff as the developers?**
Install it from the same place they do: ruff as a dev dependency with an exact version, locked in
`uv.lock`, installed in CI with `uv sync --locked` and run with `uv run`. `--locked` turns a lock
that disagrees with `pyproject.toml` into a failure rather than a silent re-lock. Anything that
installs ruff separately — an unpinned `pip install`, a `uvx` without a version, an action that
resolves its own version — can run a different minor, and ruff's minors are its breaking releases.

**How do you get ruff's findings onto the pull request on GitHub?**
Use the `github` output format, which emits workflow annotations. ruff does not choose it
automatically on a runner, so pass `--output-format=github` or set `RUFF_OUTPUT_FORMAT=github` for
the job; both `ruff check` and, since 0.16.0, `ruff format --check` honour it.

**★ Why pin `astral-sh/setup-uv` to `v10.0.1` rather than `v10`?**
Partly because `v10` does not exist: since v8.0.0 the action publishes only immutable
full-version tags, and its release notes give the reason — a movable major tag lets whoever can
move it change the code every workflow runs, the supply-chain attack the notes cite by name.
The README's own examples pin a commit SHA with the version in a comment, which is stronger
still. `actions/checkout` still publishes a floating `v7`; each action's tag policy has to be
checked on its own releases page rather than assumed.

---

← Prev: [11 · ruff in CI](11-ruff-in-ci.md) · [Topic index](README.md) · Next → **11c · CI variants** *(not written yet)*
