---
title: "`ruff-action` installs a ruff binary without Python or uv on the runner — and picks the version itself: the nearest `pyproject.toml`, resolved to the newest release a range allows, never `uv.lock` unless you pass it — so the one line that keeps it honest is `version-file: uv.lock`"
sidebar_label: "11c · ruff-action"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the `astral-sh/ruff-action` README at **v4.1.0** and the v4.0.0/v4.1.0 release notes
> ([github.com](https://github.com/astral-sh/ruff-action/releases)), and its version-resolution source at v4.1.0 — `src/version/version-request-resolver.ts`,
> `src/version/resolve.ts`, `src/version/file-parser.ts` ([github.com](https://github.com/astral-sh/ruff-action/tree/v4.1.0/src/version));
> ruff 0.16.6 *Integrations* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/integrations/)).
> Action versions checked on each repository's releases page and tag list on **2026-09-10**: `astral-sh/ruff-action` **v4.1.0** (no floating `v4` tag),
> `actions/checkout` **v7.0.1**.
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**The workflow in [11b](11b-the-ci-runner.md) makes every decision in plain sight: the lockfile
names the ruff, `uv run` runs it, the exit code gates the merge. `ruff-action` trades some of that
visibility for convenience — it installs a ruff binary with no Python or uv on the runner — and in
exchange it resolves the version itself. Left to its defaults it reads `pyproject.toml`, not the
lock, and turns a range into the *newest* matching release, so a project whose `pyproject.toml`
says `ruff>=0.16.6` runs whatever ruff shipped last week. The action is fine; it needs one line you
would not think to write, and a tag that actually exists.**

## `astral-sh/ruff-action`

The action downloads a ruff binary, puts it on `PATH`, and runs `ruff <args> <src>`:

| Input | Default (README at v4.1.0) |
|---|---|
| `version` | *"discovered from `pyproject.toml`, else `latest`"* |
| `version-file` | none — `pyproject.toml`, `requirements.txt` or `uv.lock` |
| `args` | `check` |
| `src` | `[github.workspace]` — the repository root; glob patterns allowed |
| `checksum`, `github-token`, `manifest-file`, `download-from-astral-mirror` | download controls |

It exposes the installed version as the output `ruff-version`, and — per its README — *"This action
adds ruff to the PATH, so you can use it in subsequent steps."* One installation can serve both
halves of the gate:

```yaml
jobs:
  ruff:
    runs-on: ubuntu-latest
    env:
      RUFF_OUTPUT_FORMAT: github
    steps:
      - uses: actions/checkout@v7
        id: checkout
      - name: ruff check
        uses: astral-sh/ruff-action@v4.1.0
        with:
          version-file: uv.lock
      - name: ruff format --check
        if: ${{ !cancelled() && steps.checkout.outcome == 'success' }}
        run: ruff format --check .
```

⚠️ The second step assumes the first one got as far as installing ruff; if the download itself
failed, `ruff` is not on `PATH` and the step fails with a missing command — which is still a red
job, just a less readable one.

### Which ruff it installs

The README states the order:

> *"Version resolution precedence is: 1. `version` 2. `version-file` 3. nearest discoverable `pyproject.toml` found by searching upward from `src` 4. `latest`"*
> — [ruff-action README](https://github.com/astral-sh/ruff-action/blob/v4.1.0/README.md)

Two consequences are visible only in the v4.1.0 source:

- **Automatic discovery reads `pyproject.toml` only.** The resolver that runs when neither input
  is given looks for the nearest `pyproject.toml` and nothing else; `uv.lock` is parsed only when
  you pass it as `version-file`. (The v4.1.0 release note says the `uv.lock` support *"works
  automatically if you haven't overridden the version discovery"*; the resolver chain in the same
  release does not do that on its own, so pass it explicitly and the question disappears.)
- **A range resolves to the highest match.** A specifier that is not an exact version goes through
  a `maxSatisfying` over every published ruff. `uv add --dev ruff` writes a lower bound —
  `ruff>=0.16.6` ([`uv add`](../02-uv/04-add-and-remove.md)) — so the action installs the newest
  ruff there is, while `uv.lock` and every developer are on 0.16.6.

```yaml
      - uses: astral-sh/ruff-action@v4.1.0
        with:
          version-file: uv.lock      # the locked version, not the newest one the range allows
```

Passing both `version` and `version-file` is an error in the source (*"It is not allowed to specify
both version and version-file"*).

### Tags and the stale integration page

🔴 **There is no `v4` tag.** v4.0.0 was *"the first immutable release of `ruff-action`"*, and the
repository's tag list on 2026-09-10 had floating `v1`, `v2` and `v3` tags but only `v4.0.0` and
`v4.1.0` for the current major. Reference `@v4.1.0` or its commit SHA.

The ruff 0.16.6 integrations page still shows `astral-sh/ruff-action@v3` and describes `version`
as *"default: latest"* and `src` as *"default: `[".", "src"]`"*. `@v3` still resolves — to the last
v3 release — but the action's own README is the authority for its inputs, and `uv.lock` as a
`version-file` arrived in v4.1.0.

## Gotchas

**★ Symptom: CI fails with violations from a ruff minor the team has not adopted, while `uv.lock`
still says 0.16.6.** Cause: `ruff-action` found `ruff>=0.16.6` in `pyproject.toml` and installed
the highest version the range allows. Fix: point it at the lock.

```yaml
      - uses: astral-sh/ruff-action@v4.1.0
        with:
          version-file: uv.lock
```

**★ Symptom: the workflow fails before any step runs, on `astral-sh/ruff-action@v4`.** Cause: the
action publishes immutable full-version tags from v4.0.0; there is no floating `v4`. Fix: the full
version, or its commit SHA.

```yaml
      - uses: astral-sh/ruff-action@v4.1.0
```

**Symptom: the action step errors out before installing anything, after `version-file` was added
to a step that already had `version`.** Cause: the v4.1.0 resolver refuses both inputs at once.
Fix: keep one.

```yaml
        with:
          version-file: uv.lock
```

**Symptom: with `src` set to several glob patterns, the action installs a different ruff from the
one pinned in a sub-project's `pyproject.toml`.** Cause: *"When using multiple patterns, only the
first is used to search for `pyproject.toml` to determine the Ruff version."* Fix: name the version
source explicitly.

```yaml
        with:
          src: "services/**/*.py libs/**/*.py"
          version-file: uv.lock
```

## Interview questions

**★ How does `ruff-action` decide which ruff to install, and how can that differ from your
lockfile?**
Explicit `version` first, then `version-file`, then the nearest `pyproject.toml` above `src`, then
latest. From `pyproject.toml` it takes the ruff requirement as a specifier and, if it is a range,
installs the highest release that satisfies it. A project that ran `uv add --dev ruff` has a lower
bound in `pyproject.toml` and an exact version in `uv.lock`, so the action runs the newest ruff while
everyone else runs the locked one. `version-file: uv.lock` makes the action install exactly what the
lock says.

**When would you choose `ruff-action` over `uv run ruff` in CI?**
When the job has no other reason to set up Python or uv: the action downloads a ruff binary and
nothing else. The price is that it resolves the version itself, so it needs `version-file: uv.lock`
(or an exact `version`) to stay in step with the lock. A job that already syncs a uv environment
gains nothing from the action, and running the locked ruff with `uv run` removes the question.

---

← Prev: [11b · The CI runner](11b-the-ci-runner.md) · [Topic index](README.md) · Next → [11d · CI reports](11d-ci-reports.md)
