---
title: "A committed lockfile does nothing in CI unless a flag forbids the resolver from running — uv locks and syncs automatically by default, so every CI command must either assert the lock (--locked) or trust it (--frozen), and each choice fails differently"
sidebar_label: "20 · CI flags that refuse to re-resolve"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Locking and syncing**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/), **uv 0.12.12**), uv's **CLI
> reference** for `uv sync`, `uv lock`, `uv run`, `uv export` and `uv tree`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)), pip's **Repeatable Installs** and
> **Dependency resolution** topics ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/repeatable-installs/),
> pip docs v26.2.1) and the **pip-tools** documentation
> ([pip-tools.readthedocs.io](https://pip-tools.readthedocs.io/en/stable/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**The lockfile's one guarantee — no resolution at install time ([17](17-what-a-lockfile-guarantees.md)) —
is only delivered if nothing resolves. uv's defaults are built for the developer at a keyboard: `uv run`,
`uv sync`, `uv tree` and `uv export` all quietly bring the lock up to date before doing their job. That is
convenient on a laptop and exactly wrong in CI, where a silently refreshed lock means the pipeline tested a
dependency set that is not the one committed. Two flags stop it, and they are opposites: `--locked` checks
the lock against the declaration and fails if they disagree; `--frozen` does not check at all and installs
whatever the lock says. CI gates want the first. The second belongs only where the check has already
happened.**

## What runs a resolution without being asked

uv states the default plainly:

> *"Locking and syncing are automatic in uv. For example, when `uv run` is used, the project is locked and
> synced before invoking the requested command. This ensures the project environment is always up-to-date.
> Similarly, commands which read the lockfile, such as `uv tree`, will automatically update it before
> running."*

and repeats it in each command's reference:

| Command | Default, quoted |
|---|---|
| `uv sync` | *"The project is re-locked before syncing unless the --locked or --frozen flag is provided."* |
| `uv export` | *"The project is re-locked before exporting unless the --locked or --frozen flag is provided."* |
| `uv run` | locked and synced *"before invoking the requested command"*; inexact sync by default |
| `uv tree` | *"will automatically update it before running"* |

Re-locking prefers the committed versions, so on most runs nothing visibly changes. It changes when the
declaration and the lock disagree — someone edited `pyproject.toml` and did not commit a new lock — and that
is precisely the run where you needed CI to fail rather than to repair the lock in a throwaway workspace.

## The two flags, and the two checks

| Flag / command | Behaviour, quoted from the CLI reference | Env form |
|---|---|---|
| `--locked` | *"Assert that the `uv.lock` will remain unchanged … If the lockfile is missing or needs to be updated, uv will exit with an error."* | `UV_LOCKED` |
| `--frozen` | *"Instead of checking if the lockfile is up-to-date, uses the versions in the lockfile as the source of truth. If the lockfile is missing, uv will exit with an error. If the `pyproject.toml` includes changes to dependencies that have not been included in the lockfile yet, they will not be present in the environment."* | `UV_FROZEN` |
| `uv lock --check` | *"Asserts that the `uv.lock` would remain unchanged after a resolution."* — *"Equivalent to --locked."* | |
| `uv lock --check-exists` | *"Assert that a uv.lock exists without checking if it is up-to-date"* — *"Equivalent to --frozen."* | |
| `uv sync --check` | *"Check if the Python environment is synchronized with the project. If the environment is not up to date, uv will exit with an error."* | |
| `uv run --no-sync` | run *"without checking if the environment is up-to-date"* | |

What "up to date" means is narrower than it sounds — it is consistency with the declaration, not
currency against the index:

> *"When considering if the lockfile is up-to-date, uv will check if it matches the project metadata. For
> example, if you add a dependency to your `pyproject.toml`, the lockfile will be considered outdated.
> Similarly, if you change the version constraints for a dependency such that the locked version is excluded,
> the lockfile will be considered outdated. However, if you change the version constraints such that the
> existing locked version is still included, the lockfile will still be considered up-to-date."*

So `--locked` catches the forgotten re-lock; it never catches a new upstream release, and was never meant to.

## The pipeline, flag by flag

```yaml
# .github/workflows/ci.yml
env:
  UV_LOCKED: "1"                       # every uv command in every job asserts the lock

jobs:
  lock-is-current:                     # the cheapest possible gate, and it runs first
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv lock --check

  test:
    needs: lock-is-current
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync                   # exact sync, asserted by UV_LOCKED
      - run: uv run pytest -q          # uv run is asserted too — no silent re-lock here
```

Setting the environment variable rather than sprinkling flags is the robust choice: the second command in a
job is the one people forget, and `uv run` is a resolving command in its own right.

The deployment side, where the check has already been made and the goal is only to install:

```dockerfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev     # dependencies only: a cacheable layer
COPY . .
RUN uv sync --frozen --no-dev                          # then the project itself
```

`--no-install-project` exists for exactly this: *"This is particularly useful in situations like building
Docker images where installing the project separately from its dependencies allows optimal layer caching."*
`--frozen` is defensible here only because the `lock-is-current` job already proved the lock matches; the image
build itself would not notice a drift. The Docker and cache mechanics belong to **02 · uv** *(not written
yet)*; the dependency rule is simply that a trusting flag must sit downstream of an asserting one.

## The pip-world equivalents

There is no `--locked` in pip, because pip has no declaration-to-lock comparison. What it has is refusal to
resolve:

```bash
python -m pip install --no-deps --require-hashes -r requirements.txt   # install the list, resolve nothing
python -m pip check                                                    # verify the list was complete
pip-sync requirements.txt                                              # pip-tools: make the env match exactly
```

`--no-deps` is pip's own suggestion — *"Performing the installation using `--no-deps` would provide an extra
dose of insurance against installing anything not explicitly listed"* — and hash-checking mode fails on any
dependency *"not spelled out and hashed"* ([19](19-hashes-and-hash-checking-mode.md)). `pip-sync` is the
closest thing to `uv sync`'s exact mode: it *"will install/upgrade/uninstall everything necessary to match the
`requirements.txt` contents."* pip frames the payoff the same way uv does — with a lock, *"the "work" is done
once during development process, and thus will avoid performing dependency resolution during deployment."*

## Gotchas

**★ Symptom: CI is green, and the first developer to pull `main` gets a modified `uv.lock` from `uv run`.**
Cause: someone changed `pyproject.toml` without committing a new lock; CI's plain `uv sync` re-locked in the
runner — *"The project is re-locked before syncing unless the --locked or --frozen flag is provided"* — so CI
tested a lock that exists nowhere. Fix: make CI assert:

```bash
- uv sync
+ uv sync --locked
```

**★ Symptom: `uv sync --locked` passes, and the next step still changes the lock.** Cause: the next step was
`uv run …` without a flag, and `uv run` locks and syncs *"before invoking the requested command"*. Fix: assert
job-wide rather than per command:

```yaml
env:
  UV_LOCKED: "1"
```

**★ Symptom: CI passes on a branch that removed a dependency, and production — built from a fresh
environment — fails with `ModuleNotFoundError`.** Cause: CI used `--frozen`, which *"uses the versions in the
lockfile as the source of truth"*: the stale lock still listed the removed package, so CI installed it. Fix:
`--frozen` only after a `--locked` gate; in the test job, assert:

```bash
uv lock --check && uv sync --locked
```

**★ Symptom: a developer adds a dependency, CI fails with an `ImportError` for it, and the lock looks fine.**
Cause: the same `--frozen` in reverse — *"If the `pyproject.toml` includes changes to dependencies that have not
been included in the lockfile yet, they will not be present in the environment."* Fix: `--locked`, which turns
the confusing import failure into a clear "the lockfile needs to be updated" failure at install time.

**Symptom: a "read-only" CI step — a dependency report, a licence scan — leaves `uv.lock` modified.** Cause:
*"commands which read the lockfile, such as `uv tree`, will automatically update it before running"*, and
`uv export` re-locks too. Fix: the same flag on every read:

```bash
uv tree --locked
uv export --locked --format cyclonedx1.5 -o sbom.json
```

**★ Symptom: every CI run resolves from scratch and two runs of one commit install different versions.**
Cause: `uv.lock` is not committed — often it is in `.gitignore` from a template — so plain `uv sync` creates a
new one per run. Fix: commit it, and make its absence an error:

```bash
sed -i '/^uv\.lock$/d' .gitignore     # stop ignoring it
git add .gitignore uv.lock
uv lock --check-exists                 # fails if the lock is missing; put it in the first CI job
```

**Symptom: tests pass in CI from a restored cached `.venv` and fail from a clean one.** Cause: the cached
environment still holds a package the lock no longer lists, and the job ran `uv run`, which syncs *inexactly*
— *"ensuring that all required packages are installed but not removing extraneous packages."* Fix: sync exactly
before testing, or assert the environment matches:

```bash
uv sync --locked          # exact by default: removes extraneous packages
uv sync --check           # or fail if the environment differs from the project
```

**Symptom: a pip-based deploy installs a transitive package at a version the compiled file never mentioned.**
Cause: the file was incomplete — hand-edited, or frozen on another Python — and pip resolved the gap at deploy
time. Fix: forbid resolution, then verify:

```bash
python -m pip install --no-deps -r requirements.txt && python -m pip check
```

**Symptom: an air-gapped or rate-limited deploy fails intermittently while contacting the index, even with
`--frozen`.** Cause: `--frozen` stops *resolution*, not *downloads* — the locked files still have to come from
somewhere. Fix: pre-populate the cache in a connected stage and forbid the network where it must not be used:

```bash
uv sync --frozen --offline     # "uv will only use locally cached data and locally available files"
```

## Interview questions

**★ The lockfile is committed. Why does CI still need a flag?**
Because uv's defaults repair a stale lock instead of rejecting it. `uv sync`, `uv run`, `uv tree` and
`uv export` all re-lock *"unless the --locked or --frozen flag is provided"*, and re-locking in a CI runner
produces a lock that exists only in that runner. The case that matters — a `pyproject.toml` change without a
matching lock — is exactly the one where the default silently succeeds. `--locked` converts it into a failure:
*"If the lockfile is missing or needs to be updated, uv will exit with an error."* Without the flag, the
committed lock is advisory.

**★ A pipeline has a test job and a Docker build job. Which flag goes where, and why?**
The test job uses `--locked` — ideally via `UV_LOCKED=1` for the whole job — because its purpose is to prove
that the committed lock is consistent with the declaration and that the code passes against it. The image build
can use `--frozen`, because it runs after that proof and only needs to install what the lock says without
consulting the resolver; `--frozen` never checks, so on its own it would happily build an image from a stale
lock. The rule is structural: every trusting flag must be downstream of an asserting one in the same pipeline.

**What does `uv sync --check` tell you that `uv lock --check` does not?**
They compare different pairs. `uv lock --check` compares the lock with the declaration: *"Asserts that the
`uv.lock` would remain unchanged after a resolution."* `uv sync --check` compares the *environment* with the
project: *"If the environment is not up to date, uv will exit with an error."* A cached or long-lived
environment can be out of step with a perfectly current lock — an extraneous package left by `uv run`'s inexact
sync, a missing one after a branch switch — and only the second check sees that.

**What is the pip equivalent of `uv sync --locked`?**
There is no exact one, because pip has no declaration to compare a requirements file against — the file *is*
the input. The closest guarantees come from refusing resolution: `pip install --no-deps -r requirements.txt`
installs exactly the list, `--require-hashes` fails on anything *"not spelled out and hashed"*, `pip check`
verifies the list was complete, and pip-tools' `pip-sync` makes the environment match exactly by uninstalling
what is not listed. Detecting a `requirements.in` edit without a recompile needs a CI step that recompiles and
runs `git diff --exit-code`.

**Why set `UV_LOCKED` as an environment variable rather than adding `--locked` to each command?**
Because the failure mode is the command you forgot. The CLI documents the variable as the environment form of
the flag (`[env: UV_LOCKED=]`), so one line at the top of the workflow covers `uv sync`, `uv run`, `uv tree` and
`uv export` in every step, including ones added later by someone who has never read this page. It is also the
cheapest way to give contributors CI's behaviour locally when a team wants that.

---

← [19b · Producing hashed files](19b-producing-hashed-files-and-your-own-project.md) · [Topic index](README.md) · Next → [21 · Extras](21-extras.md)
