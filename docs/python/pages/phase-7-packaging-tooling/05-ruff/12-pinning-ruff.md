---
title: "Pin ruff to one exact version, because its minor releases are its breaking ones and even a patch may flag code the last one passed — and then find every other place a ruff version lives, the pre-commit `rev`, the CI action, the image tag, the editor, a global tool, since each resolves its own unless something ties it to the lock"
sidebar_label: "12 · Pinning ruff"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Versioning* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/versioning/)),
> *Installing Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/installation/)), *Integrations* ([docs.astral.sh](https://docs.astral.sh/ruff/integrations/));
> the ruff-pre-commit README and its `pyproject.toml` at `v0.16.6` ([github.com](https://github.com/astral-sh/ruff-pre-commit/tree/v0.16.6));
> the `astral-sh/ruff-action` README and version-resolution source at v4.1.0 ([github.com](https://github.com/astral-sh/ruff-action/tree/v4.1.0));
> the `astral-sh/ruff-vscode` `pyproject.toml` at 2026.78.0 (bundles `ruff==0.16.6`, [github.com](https://github.com/astral-sh/ruff-vscode/blob/2026.78.0/pyproject.toml));
> **pre-commit 4.6.2** documentation on `rev` ([pre-commit.com](https://pre-commit.com/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · **uv 0.12.12** · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Most dependencies are pinned for reproducibility; ruff is pinned because its output *is* the
thing under review. Two developers on two ruff versions do not get two slightly different
binaries — they get two different sets of violations and two different formattings of the same
file, and each commits the other's "fix". ruff's versioning makes this worse than a typical
library: there is no stable API yet, breaking changes ship in *minor* releases, and the patch
policy allows bug fixes that change behaviour. So the dev dependency gets an exact version, the
lock carries it, and then comes the part most projects miss — ruff runs in five or six places,
each of which picks its own version unless told otherwise. [12b](12b-required-version-and-keeping-pins-in-step.md)
is the mechanism that turns a disagreement between them into an error.**

## Why exact, not a range

> *"Ruff uses a custom versioning scheme that uses the **minor** version number for breaking changes and the **patch** version number for bug fixes. Ruff does not yet have a stable API; once Ruff's API is stable, the **major** version number and semantic versioning will be used."*
> — [Versioning](https://docs.astral.sh/ruff/versioning/)

The minor-bump list is what a range like `>=0.16` lets in. Among its items:

> *"A rule is promoted to stable"* · *"The behavior of a stable rule is changed"* · *"Stable rules are added to the default set"* · *"Stable rules are removed from the default set"* · *"A safe fix for a rule is promoted to stable"* · *"A rule is deprecated"* · *"The stable style changed"* · *"A deprecated option or feature is removed"* · *"Configuration changes in a backwards incompatible way"*

A compatible-release pin such as `~=0.16.6` — at least 0.16.6, and 0.16.* only
([`~=`](../03-dependencies/07-compatible-release-and-the-missing-caret.md)) — keeps out the next
minor, and that is the right *floor* of discipline. It still admits every patch, and the patch
list is not "nothing visible changes":

> *"Bugs are fixed, including behavior changes that fix bugs"* · *"An unsafe fix for a rule is added"* · *"A fix's applicability is demoted"* · *"A rule is added in preview"* · *"The behavior of a preview rule is changed"* · *"The stable style changed to prevent invalid syntax, changes to the program's semantics, or removal of comments"* · *"The preview style changed"*

A rule that had a false negative and gets fixed in a patch flags code the previous patch passed.
A project with `preview = true` is exposed to every item marked *preview* in that list, on any
patch — and the versioning page reserves the right to change preview behaviour freely. Pin the
exact version and upgrade on purpose (**14 · Upgrading ruff** *(not written yet)*).

```bash
uv add --dev 'ruff==0.16.6'
```

```toml
[dependency-groups]
dev = [
    "ruff==0.16.6",
]
```

`uv add --dev ruff` on its own writes a lower bound ([`uv add`](../02-uv/04-add-and-remove.md));
`--bounds exact` or the explicit `==` writes the pin. The lockfile would hold one version either
way, so why does the specifier matter?

- **`uv lock --upgrade` moves everything its range allows** ([upgrading the lock](../02-uv/03b-upgrading-the-lockfile.md)).
  With `ruff>=0.16.6`, a routine "refresh all dependencies" pull request carries a ruff minor —
  new default rules, a new formatter style — buried among fifty other bumps. With `==0.16.6`, ruff
  moves only when someone edits that line.
- **Tools that read `pyproject.toml` instead of the lock resolve the range themselves.**
  `ruff-action` does exactly that, to the highest matching release ([11c](11c-ruff-action.md)).
- **The specifier is documentation.** `ruff==0.16.6` tells the next reader which ruff the
  configuration was written against; `ruff>=0.16.6` tells them only which one it started with.

An exact pin in a **dependency group** costs a library's users nothing: groups *"will not be
included in the published metadata"* ([dependency groups](../03-dependencies/22-dependency-groups.md)),
so nobody installing the package ever resolves against it.

## Every place a ruff version lives

| Where ruff runs | Where its version comes from | Tied to the lock by |
|---|---|---|
| `uv run ruff` — developers and CI | `[dependency-groups]` → `uv.lock` | `uv sync --locked` ([11b](11b-the-ci-runner.md)) |
| the ruff-pre-commit hooks | `rev:` in `.pre-commit-config.yaml` | nothing — a second pin ([12b](12b-required-version-and-keeping-pins-in-step.md)) |
| `astral-sh/ruff-action` | `version` / `version-file` / nearest `pyproject.toml` | `version-file: uv.lock` ([11c](11c-ruff-action.md)) |
| GitLab or Docker jobs | the `ghcr.io/astral-sh/ruff` image tag | nothing — keep it `0.16.6-alpine` by hand ([11d](11d-ci-reports.md)) |
| an ad-hoc `uvx ruff` | the call site, else whatever uv cached first | `uvx ruff@0.16.6` ([`uvx` versions](../02-uv/07b-uvx-versions-sources-and-plugins.md)) |
| the VS Code extension | the environment's ruff, else the bundled one | a synced `.venv` the extension can find (**13 · Editor integration** *(not written yet)*) |
| PyCharm 2025.3+ | the interpreter's ruff, or one on `PATH` | *Interpreter* execution mode + a synced environment |
| `uv tool install ruff@latest`, Homebrew, standalone installer | the machine | nothing at all |

### The pre-commit `rev` is a ruff version

ruff-pre-commit exists *"to enable installing Ruff via prebuilt wheels from PyPI"*, and at `v0.16.6`
its own `pyproject.toml` depends on `ruff==0.16.6`: the tag you write in `rev` *is* the ruff version
the hooks run. pre-commit caches on it — *"`pre-commit` assumes that the value of `rev` is an
immutable ref (such as a tag or SHA) and will cache based on that"* — so it must be a tag, never a
branch.

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.6
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
```

That makes two files — `uv.lock` and `.pre-commit-config.yaml` — that both state the project's
ruff, and nothing in pre-commit or uv compares them.

### The editor's ruff

The VS Code extension ships a ruff binary of its own — release 2026.78.0 bundles `ruff==0.16.6`,
and the extension's `pyproject.toml` notes that its *"Release automation intentionally tracks the
latest Ruff"*. Its default `importStrategy` is
`fromEnvironment`, which *"finds Ruff in the environment, falling back to the bundled version"*.
With a synced `.venv` the editor runs the locked ruff; without one it silently runs whatever the
extension last shipped. Settings and failure modes are **13** *(not written yet)*.

### Global installs

The installation page offers `uv tool install ruff@latest` and standalone installers. Both put a
`ruff` on `PATH` that knows nothing about any project, and a developer who types `ruff format .`
instead of `uv run ruff format .` gets it. The project cannot stop that command from running — it
can only make it fail, which is `required-version` ([12b](12b-required-version-and-keeping-pins-in-step.md)).

## Gotchas

**★ Symptom: a "refresh dependencies" pull request changed the formatting of forty files and
added a page of new lint violations.** Cause: ruff was declared `ruff>=0.16.6`, so
`uv lock --upgrade` moved it to a new minor along with everything else. Fix: pin it exactly, so it
moves only on a deliberate edit.

```bash
uv add --dev 'ruff==0.16.6'
```

**★ Symptom: two developers keep reformatting each other's lines, and both swear they ran
`ruff format`.** Cause: one ran `uv run ruff format` (the lock's 0.16.6), the other a global ruff
from `uv tool install ruff@latest`. Fix: run the project's ruff — and make any other one refuse to
run ([12b](12b-required-version-and-keeping-pins-in-step.md)).

```bash
uv run ruff format .
```

**★ Symptom: with `preview = true`, a patch upgrade inside `~=0.16.6` made CI fail on code that
passed yesterday.** Cause: the patch policy includes *"The behavior of a preview rule is
changed"* and *"The preview style changed"*; `~=` admits every patch. Fix: pin exactly when
preview is on.

```toml
[dependency-groups]
dev = ["ruff==0.16.6"]
```

**Symptom: CI's ruff-action job flags rules nobody else sees.** Cause: the action resolved the
`pyproject.toml` range to the newest ruff. Fix: an exact specifier, or point the action at the
lock ([11c](11c-ruff-action.md)).

```yaml
      - uses: astral-sh/ruff-action@v4.1.0
        with:
          version-file: uv.lock
```

**Symptom: `pre-commit` keeps running an old ruff after the hook configuration was changed to
follow a branch.** Cause: `rev: main` is a moving ref, and pre-commit *"will cache based on"* the
`rev` value as though it were immutable. Fix: a tag, which for ruff-pre-commit is the ruff
version.

```yaml
    rev: v0.16.6
```

**Symptom: after a teammate opened the project without running `uv sync`, their editor flags
violations the CLI does not.** Cause: the VS Code extension found no ruff in the environment and
fell back to its bundled binary — the newest ruff release, not the locked one. Fix: create the
environment the extension looks in.

```bash
uv sync
```

## Interview questions

**★ Why pin ruff to an exact version rather than a compatible range?**
Because ruff's output is what gets reviewed, and its versioning lets that output change more often
than semantic versioning would suggest: minors carry the breaking changes — new default rules,
changed stable rules, a new formatter style — and patches may fix a rule so it flags code it used to
miss, demote a fix's safety, or change anything behind preview. `~=0.16.6` stops the next minor but
admits all of that. An exact pin makes every change in ruff's behaviour arrive as a reviewed commit.

**★ Where can a ruff version be specified in a typical project, and which of them follow the
lockfile?**
The dev dependency group and `uv.lock`, which `uv run` follows; the ruff-pre-commit `rev`; a CI
action's version input or the `pyproject.toml` it reads; a Docker image tag; `uvx` call sites; the
editor's environment or bundled binary; and whatever global ruff a developer installed. Only `uv run`
follows the lock by construction. The rest need an explicit tie — `version-file: uv.lock`, an exact
image tag, an editor pointed at the environment — or a check that fails when they drift.

**Does an exact ruff pin in a library's dev group constrain the library's users?**
No. Dependency groups are not part of the published metadata, so nobody who installs the library
resolves against them. The general advice to avoid exact pins in a library is about its runtime
dependencies, which every consumer's resolver has to satisfy; a linter in a dev group is an
application-style decision inside a library repository.

**Why is `uv tool install ruff` a poor way to run ruff on a project?**
It installs one ruff for the machine, chosen when the command ran, independent of every project's
pin. Running it on a project means running a version the project did not choose — usually a newer
one, with different default rules and possibly a different formatting style. It is fine for ad-hoc
use outside any project; inside one, `uv run ruff` runs the locked version.

---

← Prev: [11e · Changed files and pre-commit in CI](11e-changed-files-and-pre-commit-in-ci.md) · [Topic index](README.md) · Next → [12b · required-version and keeping pins in step](12b-required-version-and-keeping-pins-in-step.md)
