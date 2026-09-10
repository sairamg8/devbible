---
title: "`uv sync` does not install packages — it makes the environment *equal* the lockfile, which means it removes things, and that one word `exact` is the difference between uv and every `pip install -r` you have run"
sidebar_label: "02c · uv sync"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)) and *Locking an
> environment* ([docs.astral.sh](https://docs.astral.sh/uv/pip/compile/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`pip install -r requirements.txt` is an *additive* operation: it puts things in and never takes
anything out, which is why a long-lived environment slowly accumulates packages nobody declared
and why "works on my machine" survives as an idiom. `uv sync` is a *convergent* operation — it
makes the environment equal the lockfile, and uv's documentation calls this "exact" syncing in as
many words: it *"will remove any packages that are not present in the lockfile."* Everything
surprising about `uv sync` follows from that. It deletes the package you installed by hand. It
installs your dev dependencies by default, in production, unless you say `--no-dev`. It installs
your own project as editable. And it never upgrades anything — moving a version is a different
command, on a different file.**

## What syncing is, precisely

> *"Locking is the process of resolving your project's dependencies into a lockfile. Syncing is
> the process of installing a subset of packages from the lockfile into the project environment."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

Two words in there carry weight. **From the lockfile** — sync never resolves anything on its own;
if the lockfile is out of date, uv's automatic locking updates it *first*, as a separate phase you
can forbid ([02d](02d-frozen-and-locked-in-ci.md)). **A subset** — which subset is chosen by the
group and extra flags below, and choosing wrong is how dev dependencies reach production.

`uv sync` will also create the environment if it is missing and obtain an interpreter if one is
needed, so on a clean checkout it is the only command you have to run.

## 🔴 "Exact" means it removes things

> *"`uv sync` performs 'exact' syncing by default, which means it will remove any packages that
> are not present in the lockfile."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

This is the single most important behavioural difference from pip, and it is a feature. An exact
sync means the environment is a *pure function* of the lockfile: two machines that sync the same
lock have the same environment, with no history-dependence. A `pip install -r` environment is
path-dependent — it is the lockfile *plus everything anyone ever installed into it*.

The opt-out exists and is narrow:

> `--inexact`: *"retain extraneous packages"*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

And there is an asymmetry that catches everybody, so read it twice:

> *"`uv run` uses 'inexact' syncing by default... To enable exact syncing with `uv run`, use the
> `--exact` flag."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

| Command | Default | Makes it the other way |
|---|---|---|
| `uv sync` | **exact** — removes undeclared packages | `--inexact` |
| `uv run` | **inexact** — leaves them alone | `--exact` |

So a package you installed by hand survives every `uv run` and disappears at the next `uv sync`.
That is why the removal always seems to happen at the worst moment: it happens when you finally
run the command that converges the environment.

## Groups and extras: which subset gets installed

> *"The `dev` group is special-cased and synced by default."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

🔴 Read that as: **a bare `uv sync` in a production image installs pytest.** The dev group is
dependencies declared under PEP 735's `[dependency-groups]` ([04](04-add-and-remove.md)), and uv
installs it unless told otherwise.

| Flag | Effect |
|---|---|
| *(none)* | project + `[project.dependencies]` + the `dev` group |
| `--no-dev` | excludes the dev group — **the production flag** |
| `--only-dev` | installs the dev group *"without the project and its dependencies"* |
| `--group <name>` | adds a named group |
| `--only-group <name>` | that group only, *"also excludes default groups"* |
| `--all-groups` | *"Additional groups can be included with `--all-groups`"* |
| `--extra <name>` | adds one extra (an optional-dependency set) |
| `--all-extras` | *"To quickly enable all extras, use the `--all-extras` option."* |

The two axes are genuinely different things and topic **03 · Dependencies done right** *(not
written yet)* argues the distinction: **extras** are optional features your *consumers* can ask
for (`pip install myapp[postgres]`), **groups** are sets your *developers* need and consumers
never see. Sync flags exist for both because both end up in the lockfile.

```bash
uv sync --no-dev                        # production
uv sync --all-extras                    # everything a consumer could ask for
uv sync --only-group docs               # a doc build, with nothing else
```

## Your own project is installed editable

> *"When the environment is synced, uv will install the project (and other workspace members) as
> editable packages, such that re-syncing is not necessary for changes to be reflected in the
> environment."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

That is what makes a `src/` layout painless: your package is importable because it is installed,
and edits take effect immediately because the install points at your source tree rather than
copying it.

⚠️ **What I could not confirm:** the documentation says *"changes"* without distinguishing source
edits from *metadata* changes. An editable install records entry points and dependencies at
install time, so it is reasonable to expect a newly-added `[project.scripts]` entry or dependency
to need a re-sync — but uv's docs do not say so, and this page will not assert it. If a new
console script does not appear, re-install the project and move on rather than theorising:

```bash
uv sync --reinstall-package my-project
```

Remember also that this whole section is conditional on `[build-system]`
([01b](01b-the-project-uv-sees.md)): *"if a build system is not defined, uv will not attempt to
build or install the project itself, just its dependencies."*

Sync has one more flag whose whole purpose is Docker layer caching —
`--no-install-project`, which installs dependencies *without* your project — and it is documented
with the rest of the container recipes in [02e](02e-uv-inside-a-container-image.md).

## What `uv sync` does *not* do

- **It does not upgrade.** Sync installs what the lockfile says. Moving versions is `uv lock
  --upgrade` — [03b](03b-upgrading-the-lockfile.md).
- **It does not read `requirements.txt`.** That is the pip interface: *"To sync an environment
  with a `requirements.txt` file: `$ uv pip sync requirements.txt`"*
  ([locking an environment](https://docs.astral.sh/uv/pip/compile/)) — a different command with a
  similar name, covered in [06e](06e-uv-pip-install-sync-and-compile.md).
- **It does not guarantee the lockfile was untouched.** Automatic locking may update `uv.lock`
  first. Forbidding that is [02d](02d-frozen-and-locked-in-ci.md), and it is the flag CI needs.

## Gotchas

**★ Symptom: a package you installed an hour ago has vanished, and nothing in git changed.**
Cause: you installed it with `uv pip install`, then ran `uv sync`, which *"will remove any
packages that are not present in the lockfile."* Fix: declare it, or explicitly ask sync to leave
strays alone (rarely the right answer).

```bash
uv add httpx            # ✅ the fix — now it is in the lockfile
uv sync --inexact       # ⚠️ keeps extraneous packages; hides the problem
```

**★ Symptom: your production image contains pytest, ruff and mypy.**
Cause: *"The `dev` group is special-cased and synced by default."* A bare `uv sync` in a
Dockerfile installs it. Fix: exclude it in every non-development sync.

```dockerfile
RUN uv sync --locked --no-dev
```

**★ Symptom: `uv sync --only-dev` produced an environment where your own package will not import.**
Cause: `--only-dev` installs the dev group *"without the project and its dependencies"* — that is
its documented purpose, not a bug. Fix: if you wanted dev tooling *plus* the project, ask for both
rather than for "only".

```bash
uv sync                       # project + deps + dev group
uv sync --group lint          # project + deps + a named group
```

**★ Symptom: you added a console script to `[project.scripts]` and the command is not found.**
Cause: entry points are written when the project is installed; the docs promise only that
*"changes"* are reflected without re-syncing and do not say metadata is included. Fix: reinstall
the project rather than guessing.

```bash
uv sync --reinstall-package my-project
```

**★ Symptom: after switching branches, imports fail for packages the other branch had.**
Cause: nothing — this is exact syncing working. The other branch's lockfile declared packages this
one does not. Fix: sync, which is convergent, so it both installs what is missing and removes what
is extra.

```bash
git switch feature/x && uv sync
```

**★ Symptom: `uv sync` in CI quietly wrote a new `uv.lock` and the job passed.**
Cause: locking is automatic; sync re-locked first because `pyproject.toml` had drifted. Fix: make
CI refuse — this is exactly what `--locked` is for ([02d](02d-frozen-and-locked-in-ci.md)).

```bash
uv sync --locked
```

**★ Symptom: an optional feature's dependency is missing in the deployed image but present locally.**
Cause: extras are opt-in per sync. You have been running a bare `uv sync` locally and the extra
was never requested in either place — or it was requested locally by a habit you have forgotten.
Fix: name the extras explicitly in the deployment command, so the image's contents are stated in
the Dockerfile rather than inherited from a shell.

```dockerfile
RUN uv sync --locked --no-dev --extra postgres
```

## Interview questions

**★ What does "exact" syncing mean, and why is removing packages the correct default?**
uv's definition: *"`uv sync` performs 'exact' syncing by default, which means it will remove any
packages that are not present in the lockfile."* It is correct because it makes the environment a
pure function of the lockfile rather than a function of the lockfile *and* the machine's history.
With an additive installer, two developers on the same commit can have different environments —
one of them once installed something, tried it, and forgot — and the difference is invisible until
production disagrees. Convergent syncing eliminates that whole class: if it is not declared, it is
not there, on every machine, always. The cost is that undeclared experiments get deleted, which
feels destructive the first time and is the same property that makes the environment trustworthy.

**★ Why does `uv run` sync inexactly while `uv sync` syncs exactly?**
Because they are optimising for different things. `uv sync` is the command that says "make this
environment correct", so it converges. `uv run` is the command that says "run this now", and its
job is to make sure everything *required* is present before executing — deleting unrelated
packages mid-invocation would be a surprising side effect of running a test. uv states both
defaults explicitly and gives each the other's behaviour on request (`--inexact` and `--exact`).
The practical consequence is worth knowing at 2am: an undeclared package can survive weeks of
`uv run` and vanish on the first `uv sync`, so the failure appears far from its cause.

**★ Why does uv install dev dependencies by default, and where does that bite?**
Because the default is optimised for the common case — a developer on a checkout, for whom the dev
group is exactly what they want — and uv is explicit that *"the `dev` group is special-cased and
synced by default."* It bites in every non-development context: a Dockerfile, a deployment script,
a lambda bundle. The symptom is a production image containing pytest and a linter, which is
harmless in the small and not harmless in aggregate: larger images, more packages to audit for
CVEs, and test-only libraries present at runtime where a stray import will find them. The fix is
one flag, `--no-dev`, and the discipline is to treat it as mandatory in anything that is not a
developer's machine.

**★ What is the difference between `uv sync` and `uv pip sync`, given the names?**
`uv sync` is a project command: it reads `uv.lock`, it may re-lock first, it installs your own
project as an editable package if a build system is declared, and it understands groups and
extras. `uv pip sync` is the pip interface's equivalent of `pip-sync`: it takes a
`requirements.txt` and makes the environment match it — *"To ensure the environment exactly matches
the lockfile, use `uv pip sync` instead"* — with no project, no `uv.lock`, and no concept of
groups. They share the convergent behaviour and nothing else. Reaching for `uv pip sync` inside a
project managed by `uv.lock` is how people end up with an environment that no longer corresponds
to their lockfile.

**Does `uv sync` ever modify `uv.lock`?**
Yes, and this surprises people. Locking and syncing are separate operations, but uv runs them
together by default: *"locking and syncing are automatic in uv."* So if `pyproject.toml` has
changed since the lockfile was written, `uv sync` will re-lock first and then install. Locally that
is what you want. In CI it is precisely what you do not want, because the job then tests a
resolution that nobody reviewed and — if the working tree is not inspected — silently discards it.
`--locked` makes uv assert that the lockfile is already up to date and error otherwise, which is
[02d](02d-frozen-and-locked-in-ci.md)'s subject.

---

← Prev: [02b · Activation and discovery](02b-activation-and-discovery.md) · [Topic index](README.md) · Next → [02d · --frozen and --locked in CI](02d-frozen-and-locked-in-ci.md)
