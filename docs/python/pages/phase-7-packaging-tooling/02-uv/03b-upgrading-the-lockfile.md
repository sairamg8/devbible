---
title: "Upgrading is a separate verb from installing: `uv sync` never moves a version, `uv lock --upgrade` moves all of them, and `--upgrade-package` is the one you actually want in a review"
sidebar_label: "03b · Upgrading the lockfile"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Project structure and files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *Caching*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/)) and the release list
> ([github.com](https://github.com/astral-sh/uv/releases)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Nothing in uv upgrades a dependency as a side effect. `uv sync` installs what the lockfile says;
if a newer version exists, sync does not care. Moving a version is always an explicit `uv lock`
invocation, and the choice between its two forms determines whether a reviewer can understand your
diff: `--upgrade` re-resolves everything, producing a change with no single cause, while
`--upgrade-package` moves one package and — per uv's own wording — retains the locked versions of
all the others. There are also two resolution strategies most people never touch that are exactly
what a library needs, because they answer the question a locked CI job cannot: does the *floor* of
my declared version ranges actually work?**

## The two upgrade commands

> *"To upgrade all packages: `$ uv lock --upgrade`"*

> *"To upgrade a single package to the latest version, while retaining the locked versions of all
> other packages: `$ uv lock --upgrade-package <package>`"*
> — both [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

```bash
uv lock --upgrade                    # everything moves — one enormous diff
uv lock --upgrade-package httpx      # one package moves, the rest are held
uv sync                              # then install the new resolution
```

The difference is about *reviewability*, not about safety. Both produce a valid resolution; only one
produces a diff a human can reason about. A weekly `uv lock --upgrade` that touches eighty packages
gets rubber-stamped, and when something breaks two days later there are eighty candidates. A
`--upgrade-package` commit has one cause and one line in the release notes to read.

⚠️ **What I could not confirm:** the docs say `--upgrade-package` retains *"the locked versions of
all other packages"*, but they do not say what happens when the new version of that package
*requires* a newer transitive dependency — something must move, and the documentation does not
state whether uv moves it, errors, or refuses the upgrade. Read the diff rather than assuming; that
is what the diff is for.

## `uv add` re-locks too

Adding a dependency is also an upgrade operation, because resolving a new requirement can shift the
tree around it ([04](04-add-and-remove.md)). What it is *not* is a licence to upgrade everything —
if a `uv add` produces a diff touching packages unrelated to what you added, that is worth
understanding before committing.

## The resolution strategies, and the one a library needs

> Default behaviour: *"uv tries to use the latest version of each package"*

> `--resolution lowest`: *"install the lowest possible version for all dependencies"*

> `--resolution lowest-direct`: *"use the lowest compatible versions for all direct dependencies,
> while using the latest compatible versions for all other dependencies"*
> — all [resolution](https://docs.astral.sh/uv/concepts/resolution/)

`lowest-direct` is the important one and it is under-used. If you publish
`dependencies = ["httpx>=0.27"]`, your CI has been testing whatever `httpx` the lockfile pinned —
probably the newest. Nobody has ever tested `httpx 0.27`, which is what a consumer with an older
constraint will get. `lowest-direct` tests exactly that floor, while leaving transitive dependencies
modern so you are not debugging a five-year-old `certifi` at the same time.

```yaml
# .github/workflows/ci.yml — a second job that tests the floor of your declared ranges
lowest-direct:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh
    - run: uv lock --resolution lowest-direct
    - run: uv sync --no-dev --group test
    - run: uv run pytest
```

Note that this job deliberately *does* re-lock — it is answering a different question from the main
job, which uses `--locked` ([02d](02d-frozen-and-locked-in-ci.md)) and must not re-lock. Two jobs,
two purposes; do not merge them.

`--resolution lowest` (everything at its floor, including transitives) is mostly a research tool. It
tells you whether your declared lower bounds are *internally* coherent, and it will find genuinely
ancient releases of things you have never heard of.

## `--exclude-newer` — reproducing a resolution from the past

> *"`--exclude-newer` option to limit resolution to distributions uploaded before a specific date,
> allowing reproduction of installations regardless of new package releases"*
> — [resolution](https://docs.astral.sh/uv/concepts/resolution/)

This is the tool for two specific jobs: bisecting "when did this break", and building an
environment that matches a release that happened last month. It is a resolver constraint by upload
date, not a version pin, so it is *coarser* than a lockfile and never a substitute for one.

⚠️ Related preview churn to be aware of on a pinned uv: **0.12.10** (2026-09-04) changed how
per-package exclusions are recorded — *"Omit `exclude-newer-package` settings for packages outside
the resolution from `uv.lock`"* ([releases](https://github.com/astral-sh/uv/releases)). Anything
under `--preview` here can move between patch releases.

## `--fork-strategy` and why an upgrade can add a fork

Universal resolution may fork ([03](03-the-lockfile.md)), and `--fork-strategy` *"controls this
tradeoff between consistency and selecting latest versions per Python version"*
([resolution](https://docs.astral.sh/uv/concepts/resolution/)). So an upgrade can legitimately turn
one lockfile entry into two: the newest release dropped an old Python that your `requires-python`
still allows, so uv keeps the old release for that branch. If you would rather have one version
everywhere, the lever is usually `requires-python`, not the fork strategy.

## Does a library commit `uv.lock`? — the argument, with the tool-level answer

uv's guidance is unconditional: the lockfile *"should be checked into version control"*
([project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)). It does not
carve out libraries. The reason the question keeps coming up is that a lockfile does not reach your
users: a published wheel carries the requirement *ranges* from `[project.dependencies]`, and each
consumer's installer resolves independently. So for a library, `uv.lock` pins your development and
CI environment and nobody else's.

That makes committing it correct *and* creates a specific blind spot: if CI only ever runs the
locked versions, you have never tested the range you published. The tool-level answer is the
`lowest-direct` job above. The declaration-level argument — how wide a range to publish, and why
applications and libraries differ — is topic **03 · Dependencies done right** *(not written yet)*.

## Upgrading is not refreshing

Two different staleness problems, two different flags:

| You think… | Flag | Because |
|---|---|---|
| "a newer version exists and I want it" | `uv lock --upgrade-package X` | the lockfile pins an old version |
| "uv cannot see the version I just published" | `uv lock --refresh-package X` | *"revalidate cached data"* — [01d](01d-the-cache-and-the-speed-claim.md) |
| "the installed files look wrong" | `uv sync --reinstall-package X` | the environment, not the lock |

Reaching for `--upgrade` when the problem was a cached index view is a common and confusing detour:
it produces a large diff that does not contain the version you were looking for.

## Gotchas

**★ Symptom: `uv sync` did not pick up a release you know exists.**
Cause: sync installs the lockfile; it is not an upgrade command. Fix: upgrade the lockfile, then
sync.

```bash
uv lock --upgrade-package httpx
uv sync
```

**★ Symptom: a routine dependency bump produced a diff touching sixty packages, and review stalled.**
Cause: `uv lock --upgrade` re-resolves everything. Fix: move one package at a time so each commit has
one cause.

```bash
uv lock --upgrade-package httpx
uv lock --upgrade-package pydantic
```

**★ Symptom: `uv lock --upgrade-package X` did not move X.**
Cause: the declared requirement in `pyproject.toml` forbids the newer version — an upgrade cannot
violate your own constraint. Fix: change the declaration, which is a decision, not a mechanical bump.

```bash
uv add 'httpx>=0.29'      # widen the requirement, then it can move
```

**★ Symptom: you published a package minutes ago and `uv lock --upgrade` still resolves the previous version.**
Cause: cached index metadata, not a resolution problem. Fix: refresh rather than upgrade harder.

```bash
uv lock --refresh-package my-internal-lib
```

**★ Symptom: after an upgrade, `uv.lock` lists one package twice where it listed it once.**
Cause: the new release dropped a Python version your `requires-python` still permits, so the
resolution forked. Fix: nothing is wrong — but if you want one version everywhere, narrow the Python
range.

```toml
[project]
requires-python = ">=3.13"
```

**★ Symptom: your published library breaks for a user whose constraint resolves to your declared floor.**
Cause: CI only ever tested the locked (newest) versions. Fix: add a job that resolves at the floor of
your direct dependencies.

```bash
uv lock --resolution lowest-direct
uv sync --no-dev --group test
uv run pytest
```

**★ Symptom: `--resolution lowest` produces an unusable environment full of ancient packages.**
Cause: it does what it says — *"install the lowest possible version for all dependencies"*, including
every transitive one. Fix: use the variant scoped to your own declarations.

```bash
uv lock --resolution lowest-direct
```

**★ Symptom: a CI job that upgrades keeps failing `--locked` in the same pipeline.**
Cause: two contradictory instructions in one job — you cannot both forbid re-locking and re-lock. Fix:
separate jobs with separate purposes.

```yaml
test:        { steps: [ { run: "uv sync --locked" }, { run: "uv run pytest" } ] }
lowest:      { steps: [ { run: "uv lock --resolution lowest-direct" }, { run: "uv run pytest" } ] }
```

**★ Symptom: `--exclude-newer` seemed to pin your dependencies and then a version changed anyway.**
Cause: it constrains resolution *by upload date*, not by version — anything published before that
date is still eligible, so a different resolution can still be produced. Fix: use it for
investigation, and keep the lockfile as the pin.

```bash
uv lock --exclude-newer 2026-08-01     # investigate
git diff uv.lock                       # then read what actually moved
```

## Interview questions

**★ Why does `uv sync` never upgrade anything?**
Because syncing and locking are separate operations with separate artefacts — uv's own definitions:
locking *"is the process of resolving your project's dependencies into a lockfile"*, syncing *"is the
process of installing a subset of packages from the lockfile into the project environment."* Sync's
input is the lockfile, so it has nothing to upgrade *from*; the newest available version is not part
of its world. This is exactly the property you want, because it means the same commit produces the
same environment next month as it did today. A tool that upgraded during install would make
reproducibility depend on the date, which is the failure `pip install -r requirements.in` workflows
have always had.

**★ `--upgrade` or `--upgrade-package`?**
`--upgrade-package`, nearly always, and the reason is review rather than safety. uv describes it as
upgrading *"a single package to the latest version, while retaining the locked versions of all other
packages"*, so the resulting diff has one cause and a reviewer can read the one changelog that
matters. `uv lock --upgrade` re-resolves everything, which produces a diff nobody reads properly and
a failure two days later with dozens of candidates. `--upgrade` has legitimate uses — a deliberate
quarterly refresh, or unpicking a resolution that has painted itself into a corner — but as a routine
habit it converts dependency management into a coin flip. One honest caveat: the docs do not state
what happens when the upgraded package needs a newer transitive dependency, so read the diff instead
of assuming nothing else moved.

**★ What is `--resolution lowest-direct` for, and why does a library specifically need it?**
It *"use[s] the lowest compatible versions for all direct dependencies, while using the latest
compatible versions for all other dependencies."* A library publishes *ranges* — `httpx>=0.27` — and
a consumer may resolve to any point in that range, most plausibly the bottom if they have other
constraints. But the library's own CI runs against `uv.lock`, which pins the top. So the floor of
every range you publish is untested by construction. `lowest-direct` tests precisely that floor,
without dragging every transitive dependency back to antiquity as `--resolution lowest` would. It is
the cheapest possible defence against the specific bug of using an API that only exists in a newer
release than your declared minimum.

**★ You need to reproduce what a build would have resolved six weeks ago. What do you reach for, and what is the caveat?**
`--exclude-newer`, which limits *"resolution to distributions uploaded before a specific date,
allowing reproduction of installations regardless of new package releases."* It is the right tool for
bisecting "when did this start failing" and for approximating a historical environment when the
lockfile from that commit is unavailable. The caveat is that it is a date filter over an index, not a
pin: any distribution uploaded before the cut-off remains eligible, so a different resolution can
still emerge, and the index's contents can change (a yanked release, a deleted file). If you need
*the* environment from six weeks ago, the answer is the `uv.lock` from that commit — which is the
argument for committing it in the first place.

**Someone reports that uv "will not upgrade" a package. What are the three possible causes and how do you distinguish them?**
First, they ran `uv sync` and expected it to upgrade — sync installs the lockfile and never moves a
version; `uv lock --upgrade-package X` is the command. Second, the declared requirement in
`pyproject.toml` forbids the newer version, so the resolver is correctly refusing; the fix is to
widen the declaration, which is a decision and belongs in the diff. Third, uv's cached view of the
index predates the release — that is a refresh problem (`uv lock --refresh-package X`), not an
upgrade problem, and reaching for `--upgrade` produces a large useless diff. Distinguish them in that
order: what command did they run, what does `pyproject.toml` say, and how fresh is the release.

**Should a library commit its lockfile?**
Yes — uv's guidance is unconditional, the lockfile *"should be checked into version control"* — with
one thing understood clearly. The lockfile is invisible to your users: your wheel carries the ranges
from `[project.dependencies]` and every consumer resolves independently. So the lockfile is buying you
reproducible CI, not shaping anyone's installation. The blind spot it creates is that your tests only
ever see the top of your declared ranges, which is why a library that commits a lockfile should also
run a `--resolution lowest-direct` job. The two together give you both properties: a stable CI signal
and evidence that the contract you published actually holds.

---

← Prev: [03 · uv.lock](03-the-lockfile.md) · [Topic index](README.md) · Next → [03c · Exporting the lockfile](03c-exporting-the-lockfile.md)
