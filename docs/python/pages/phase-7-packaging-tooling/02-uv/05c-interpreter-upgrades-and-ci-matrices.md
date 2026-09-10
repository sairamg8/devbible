---
title: "`uv python upgrade` moves patch releases only, and a Python test matrix belongs in the CI file rather than in either of the project's version declarations"
sidebar_label: "05c · Upgrades and CI matrices"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Python versions*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/python-versions/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)) and CPython's `venv`
> documentation ([docs.python.org](https://docs.python.org/3.14/library/venv.html)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Two things about Python versions play out over time rather than at a single moment, and uv separates
them deliberately. Patch upgrades are maintenance: `uv python upgrade` moves managed interpreters to
the latest supported *patch* release and nothing further, which keeps a security fix from looking like
a project decision. Minor upgrades are decisions, expressed in `.python-version` and
`requires-python`, and they change what every dependency must support. And testing several Python
versions at once is neither — it is a set of CI jobs, so the version belongs on the command line, not
in a file that describes the project. Getting these three separated is what stops a Python bump from
becoming an afternoon.**

## `uv python upgrade` moves patches, not minors

> *"uv-managed Python versions can be upgraded to the latest supported patch release with the `python
> upgrade` command"*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

**Latest supported patch** — so `3.14.6 → 3.14.7`, never `3.14 → 3.15`. That scoping is right, because
the two operations differ in kind:

| | Patch upgrade | Minor upgrade |
|---|---|---|
| what it is | a security and bug-fix refresh | a change to what the project supports |
| how you do it | `uv python upgrade` | edit `.python-version` (and maybe `requires-python`) |
| touches the lockfile? | no | possibly — `requires-python` is a resolver input |
| compiled wheels | ABI-compatible within a minor | may need different wheels |
| belongs in a PR? | as housekeeping | as a reviewed decision |

The lockfile column is the one that matters. Because *"all required packages must be compatible with
the entire range of `requires-python`"* ([resolution](https://docs.astral.sh/uv/concepts/resolution/)),
changing the supported *span* changes which dependency releases are eligible
([05b](05b-python-version-vs-requires-python.md)). A patch upgrade does not touch that span, which is
exactly why it can be a single command.

## Any interpreter change invalidates existing environments

CPython bakes the interpreter path into every environment it creates:

> *"This creates the target directory (including parent directories as needed) and places a
> `pyvenv.cfg` file in it with a `home` key pointing to the Python installation from which the command
> was run."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

So after any interpreter move — patch or minor — the environment refers to a build that is no longer
there, and console-script shebangs do too ([02b](02b-activation-and-discovery.md)). The follow-up is
always the same, because the environment is derived state:

```bash
uv python upgrade
rm -rf .venv && uv sync
```

For a minor move, the same command sequence plus the two declarations:

```bash
uv python pin 3.15                    # the request
# edit requires-python in pyproject.toml if your support commitment changed
uv lock                               # re-resolve under the new constraint
rm -rf .venv && uv sync
uv run pytest
```

## A CI matrix does not live in either version file

Testing several Python versions is a job parameter, not a project declaration. Keep the files
describing the project and pass the interpreter per job:

```yaml
# .github/workflows/ci.yml — fragment
strategy:
  matrix:
    python: ["3.13", "3.14"]
steps:
  - uses: actions/checkout@v4
  - run: curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh
  - run: echo "$HOME/.local/bin" >> "$GITHUB_PATH"
  - run: uv python install ${{ matrix.python }}
  - run: uv sync --locked --python ${{ matrix.python }}
  - run: uv run --no-sync pytest
```

Three details in that fragment are deliberate:

- **`uv python install` first**, so the interpreter is present rather than pulled in implicitly by the
  sync. It makes the download an explicit, attributable step
  ([05](05-uv-python.md)).
- **`--locked`**, so each entry installs the *reviewed* resolution rather than re-resolving per job.
  Without it the matrix becomes a test of the resolver instead of your code
  ([02d](02d-frozen-and-locked-in-ci.md)).
- **`--no-sync` on the run**, because the sync already happened in the previous step.

🔴 And the precondition: every matrix entry must lie **inside** `requires-python`. A matrix entry
outside it is asking uv to satisfy a resolution the project has declared impossible, and the failure
is correct behaviour, not a CI problem.

## The universal lockfile is what makes a matrix cheap

A `uv.lock` *"captures the packages that would be installed across all possible Python markers such as
operating system, architecture, and Python version"*
([project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)). So one committed
lockfile serves every entry of the matrix: uv installs the subset appropriate to that interpreter.
With a per-platform `requirements.txt` you would need one file per matrix cell, kept in step by hand —
which is the situation universal locking exists to remove.

This is also why a *forked* entry in the lockfile ([03](03-the-lockfile.md)) is a normal thing to see
in a project with a Python matrix: two interpreters, two eligible versions of some package, both
recorded under markers.

## Caching interpreters between CI runs

Managed interpreters live outside the workspace, in the directory `UV_PYTHON_INSTALL_DIR` names —
*"Specifies the directory for storing managed Python installations"*
([environment variables](https://docs.astral.sh/uv/reference/environment/)) — so a cache step scoped to
the checkout does not include them. Set the location explicitly rather than guessing at a default, and
the cache key becomes obvious:

```yaml
env:
  UV_PYTHON_INSTALL_DIR: ${{ github.workspace }}/.uv-python
steps:
  - uses: actions/cache@v4
    with:
      path: .uv-python
      key: uv-python-${{ matrix.python }}-${{ runner.os }}
```

⚠️ Confirm the effective path with `uv python dir` rather than trusting a documented default; uv's docs
describe the variable, not a guaranteed location.

## Gotchas

**★ Symptom: after `uv python upgrade`, the project environment is broken.**
Cause: `pyvenv.cfg` and console-script shebangs point at the interpreter build that was replaced. Fix:
recreate the environment.

```bash
rm -rf .venv && uv sync
```

**★ Symptom: `uv python upgrade` did not move you from 3.14 to 3.15.**
Cause: it upgrades *"to the latest supported patch release"* only. A minor move is a project decision.
Fix: make the decision explicitly, in the two files that carry it.

```bash
uv python pin 3.15
uv lock                     # after adjusting requires-python if needed
```

**★ Symptom: `uv sync` fails on a CI matrix entry that works locally.**
Cause: the matrix is testing a Python version `requires-python` does not permit, so no resolution
exists for it. Fix: make the matrix and the constraint agree — and decide which of the two is wrong,
because that is a product question.

```toml
[project]
requires-python = ">=3.13"     # if you really do support and test 3.13, declare it
```

**★ Symptom: every matrix job produces a slightly different resolution.**
Cause: the jobs are re-locking instead of installing the committed lockfile. Fix: pass `--locked` so
each entry uses the reviewed resolution for its interpreter.

```bash
uv sync --locked --python 3.13
```

**★ Symptom: CI re-downloads an interpreter on every run despite a cache step.**
Cause: managed interpreters live in `UV_PYTHON_INSTALL_DIR`, which is outside the cached workspace.
Fix: point the variable inside the workspace and cache that path.

```yaml
env:
  UV_PYTHON_INSTALL_DIR: ${{ github.workspace }}/.uv-python
```

**★ Symptom: a compiled dependency stops importing after a minor Python upgrade.**
Cause: extension modules are built against a specific CPython ABI, and `site-packages` lives under
`lib/pythonX.Y/`, so the old wheels are neither found nor valid. Fix: this is a rebuild, not a repair.

```bash
rm -rf .venv && uv sync --reinstall
```

**★ Symptom: the matrix passes but production runs a version nothing tested.**
Cause: the deployment's interpreter is chosen by the base image or the platform, and nothing ties it to
the matrix. Fix: pin the deployment interpreter to a matrix entry, and make the pin visible.

```dockerfile
FROM python:3.14-slim
ENV UV_PYTHON_DOWNLOADS=never       # fail if the image's Python is not what the project asked for
```

**★ Symptom: a security advisory names a CPython patch release and you cannot tell whether you are on it.**
Cause: you are looking at `.python-version`, which usually pins a minor version, not the build actually
installed. Fix: ask about the running interpreter, not the request.

```bash
uv run python -VV
uv python list
```

## Interview questions

**★ Why does `uv python upgrade` deliberately not move minor versions?**
Because a patch upgrade is maintenance and a minor upgrade is a decision; conflating them makes a
project-shaping change look like housekeeping. uv's wording is precise — managed versions are upgraded
*"to the latest supported patch release"* — so `3.14.6 → 3.14.7` is one command while `3.14 → 3.15` is
not. A minor move changes what every dependency must support (uv: *"all required packages must be
compatible with the entire range of `requires-python`"*), can invalidate compiled wheels built against
the old ABI, and should produce a lockfile diff someone reviews. Even a patch upgrade has a follow-up:
existing environments name the replaced build in `pyvenv.cfg`, so recreate them.

**★ Where does a Python test matrix belong, and what two things make it meaningful?**
In the CI configuration, not in `.python-version` or `requires-python` — those files describe the
project (one interpreter request, one support commitment) while a matrix is a set of jobs. Each job
passes its interpreter explicitly: `uv python install 3.13` then `uv sync --locked --python 3.13`. Two
conditions make it meaningful. Every entry must lie inside `requires-python`, otherwise you are asking
for a resolution the project has declared impossible and the failure is correct. And every job must use
`--locked`, so it installs the reviewed resolution for that interpreter rather than resolving afresh —
without that, a green matrix tells you the resolver found *something* for each version, not that your
reviewed dependency set works on each version.

**★ Why is a Python matrix cheap with `uv.lock` and expensive with `requirements.txt`?**
Because `uv.lock` is universal: it *"captures the packages that would be installed across all possible
Python markers such as operating system, architecture, and Python version"*, so one committed file
serves every cell of the matrix and uv installs the appropriate subset per interpreter. A
`requirements.txt` produced by a platform-specific resolution describes exactly one configuration — uv
says of `uv pip compile` that it *"produces a resolution that is platform-specific, like `pip-tools`"* —
so a matrix needs one file per cell, each generated separately and kept in step by hand. That
bookkeeping is precisely what universal locking removes, and it is also why seeing a forked entry in
the lockfile is normal for a project that supports several Pythons.

**★ What breaks when you move a project from Python 3.14 to 3.15, in the order you will encounter it?**
First the environment: `pyvenv.cfg` points at the old interpreter and `site-packages` sits under
`lib/python3.14/`, so nothing in it is valid — recreate rather than repair. Then compiled
dependencies: extension modules are built against a specific ABI, so wheels must be re-fetched for the
new version, and any dependency without a 3.15 wheel will be built from source or fail. Then the
resolution, if you also widened or moved `requires-python`, because that changes which releases are
eligible and may fork the lockfile. And last, your own code, where a removed or changed standard-library
API bites. The sequence matters because the first two look like the third: a mismatched-ABI import error
reads like a dependency problem and is actually a stale environment.

**A colleague wants to pin the exact CPython patch release in CI so builds are byte-identical. What do you tell them?**
That it is achievable and usually not what they want. Pinning `3.14.7` rather than `3.14` means any
runner holding `3.14.6` must download the exact build — or fail, if `UV_PYTHON_DOWNLOADS=never` — which
turns a security patch into a pipeline change. Since CPython patch releases are bug and security fixes,
the normal goal is to be *on the latest* rather than *held at one*, which is exactly what a minor pin
plus `uv python upgrade` gives. The legitimate reasons to pin a patch are chasing an interpreter-level
bug and a compliance process that requires the exact build be recorded — and in both cases the pin
should carry a comment saying why, because otherwise the next person will widen it and be right to.

**How would you verify, at 2am, which interpreter a deployed container is actually running?**
Not by reading `.python-version`, which records a *request* and is usually a minor version. Ask the
running process: `python -VV` prints the full version and build information, and inside a uv project
`uv run python -VV` guarantees you are asking the project's interpreter rather than whatever `PATH`
resolves. `uv python find` answers the selection question — which interpreter uv would use here — and
`uv python list` shows what is installed and available. The distinction to keep straight under pressure
is between what was requested, what was selected, and what is executing; the three are usually the same
and the incident is always in the case where they are not.

---

← Prev: [05b · .python-version vs requires-python](05b-python-version-vs-requires-python.md) · [Topic index](README.md) · Next → [06 · pip + venv, the floor](06-pip-and-venv-the-floor.md)
