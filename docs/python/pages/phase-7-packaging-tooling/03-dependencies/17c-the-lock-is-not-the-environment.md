---
title: "The lock is not the environment and not portable — declaration, lock and installed environment are three states with a separate check for each pairing, one universal lock yields a different environment per platform, and only pylock.toml or an export crosses a tool boundary"
sidebar_label: "17c · Lock vs environment"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Locking and syncing**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/), **uv 0.12.12**), uv's
> **Project structure and files** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)),
> uv's **Resolution** concepts ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), uv's
> **CLI reference** ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and **PEP 751**
> ([peps.python.org](https://peps.python.org/pep-0751/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**The last two gaps. A lockfile sitting in the repository proves nothing about the environment on the
machine in front of you: the declaration, the lock and the installed packages are three separate states, uv
has a separate check for each pairing, and the default command for running code is the one that does not
remove what the lock does not list. A universal lock is not one environment either — it is a family of them,
one per platform and Python version, selected by markers at install time. And a lock only travels to
another tool if it is in the standardised format; `uv.lock` is uv's alone.**

## Gap 3 — the lock is not the environment

Three distinct states can disagree: the declaration, the lock, and the installed environment. uv has a
separate check for each pairing.

| Question | Command | Behaviour, quoted |
|---|---|---|
| Does the lock match the declaration? | `uv lock --check` | *"Asserts that the `uv.lock` would remain unchanged after a resolution. If the lockfile is missing or needs to be updated, uv will exit with an error."* |
| Same, as a flag on other commands | `--locked` | *"Requires that the lockfile is up-to-date. If the lockfile is missing or needs to be updated, uv will exit with an error."* |
| Use the lock without checking it | `--frozen` | *"Instead of checking if the lockfile is up-to-date, uses the versions in the lockfile as the source of truth. If the lockfile is missing, uv will exit with an error."* |
| Does the environment match the lock? | `uv sync --check` | *"Check if the Python environment is synchronized with the project. If the environment is not up to date, uv will exit with an error."* |

And a fourth state people forget — extraneous packages:

> *"`uv sync` performs "exact" syncing by default, which means it will remove any packages that are not
> present in the lockfile. To retain extraneous packages, use the `--inexact` flag"*

> *"In contrast, `uv run` uses "inexact" syncing by default, ensuring that all required packages are
> installed but not removing extraneous packages."*

So an environment built with `uv run` can contain a package nobody declared — installed by hand months
ago — and remain "in sync" by that command's standard. `uv sync` removes it. The full CI treatment is
[20](20-the-ci-flags-that-refuse-to-re-resolve.md).

## One universal lock, several environments

The lock that CI installs and the lock production installs can be the same file and still produce different
package sets, because a universal lock is resolved for every environment at once:

> *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would be installed
> across all possible Python markers such as operating system, architecture, and Python version."*

> *"During universal resolution, a package may be listed multiple times with different versions or URLs if
> different versions are needed for different platforms — the markers determine which version will be
> used."*

PEP 751 states the install-time consequence as a rule — *"Packages MAY be listed multiple times with varying
data, but all packages to be installed MUST narrow down to a single entry at install time."* The narrowing is
done by the installing machine's markers. So a CI job on Python 3.12 and a production image on 3.14 read one
lock and can legitimately install different versions of the same package, which is correct behaviour and a
reliable source of "passes in CI, fails in prod". Make the interpreter part of what you pin:

```bash
uv python pin 3.14          # writes .python-version, which uv sync then honours
```

```yaml
# CI runs the same minor as production, from the same pin
- uses: astral-sh/setup-uv@v5
- run: uv sync --locked
- run: uv run pytest -q
```

## The lock format itself is versioned

`uv.lock` carries a schema version, and uv's compatibility promise is per *minor* release:

> *"Any given version of uv can read and write lockfiles with the same schema version, but will reject
> lockfiles with a greater schema version."*

> *"The schema version is considered part of the public API, and so is only bumped in minor releases, as a
> breaking change (see Versioning). As such, all uv patch versions within a given minor uv release are
> guaranteed to have full lockfile compatibility. In other words, lockfiles may only be rejected across minor
> releases."*

So the uv version is part of the environment contract too: a developer on a newer minor can write a lock the
CI runner's older uv refuses. Pin the tool the same way you pin the packages.

## Gap 4 — a lock is not portable unless it is standardised

> *"`uv.lock` is a human-readable TOML file but is managed by uv and should not be edited manually. The
> `uv.lock` format is specific to uv and not usable by other tools."*

PEP 751 exists to close exactly that:

> *"In PEP 751, Python standardized a new resolution file format, `pylock.toml`."*

> *"`pylock.toml` is standardized and tool-agnostic, such that in the future, `pylock.toml` files generated
> by uv could be installed by other tools, and vice versa."*

> *"Some of uv's functionality cannot be expressed in the `pylock.toml` format; as such, uv will continue to
> use the `uv.lock` format within the project interface."*

The PEP's own motivation names the cost of the pre-standard world:

> *"any tooling that wants to work with lock files must choose which format to support, potentially leaving
> users unsupported (e.g. Dependabot only supporting select tools, same for cloud providers who can do
> dependency installations on your behalf, etc.). It also impacts portability between tools, which causes
> vendor lock-in."*

Naming rules, worth knowing because tools look for them:

> *"A lock file MUST be named `pylock.toml` or match the regular expression `r"^pylock\.([^.]+)\.toml$"` if a
> name for the lock file is desired or if multiple lock files exist."*

and the single-use versus multi-use distinction that explains why `requirements.txt` files multiply:

> *"Lock files can be single-use and multi-use. Single-use lock files are things like `requirements.txt`
> files, which serve a single use-case/purpose (hence why it isn't uncommon for a project to have multiple
> requirements files, each for a different use-case). Multi-use lock files represent multiple use-cases
> within a single file, often expressed through extras and Dependency Groups."*

Exporting, when something else must consume it:

```bash
uv export --format requirements.txt -o requirements.txt   # for pip, Docker, a legacy tool
uv export --format pylock.toml -o pylock.toml             # PEP 751, tool-agnostic
uv export --format cyclonedx1.5 -o sbom.json              # an SBOM for compliance
```

> *"The project is re-locked before exporting unless the `--locked` or `--frozen` flag is provided."*

🔴 That sentence is a trap in CI: an export step without `--locked` can *change* the lock as a side
effect of producing an artifact.

## Gotchas

**★ Symptom: `uv sync --locked` passes and the running environment still has a package the lock does not
list.** Cause: the environment was last built by `uv run`, which *"uses "inexact" syncing by default …
not removing extraneous packages."* Fix: sync exactly, or check:

```bash
uv sync              # exact by default: removes extraneous packages
uv sync --check      # or just assert, without changing anything
```

**★ Symptom: a CI job that only *exports* the lock produced a modified `uv.lock`.** Cause: *"The project is
re-locked before exporting unless the `--locked` or `--frozen` flag is provided."* Fix: always constrain an
export:

```bash
- uv export --format requirements.txt -o requirements.txt
+ uv export --locked --format requirements.txt -o requirements.txt
```

**★ Symptom: a teammate hand-edits `uv.lock` to change one version and everything breaks subtly.** Cause:
the file is generated and internally consistent — *"managed by uv and should not be edited manually"* —
so an edited version can disagree with recorded metadata elsewhere in the file. Fix: express the intent in
`pyproject.toml`, or pin the single package deliberately:

```bash
uv lock --upgrade-package httpx==0.27.2
```

**★ Symptom: a cloud build service or a dependency bot cannot read your lock.** Cause: *"The `uv.lock`
format is specific to uv and not usable by other tools."* Fix: publish a standardised export alongside it,
regenerated in CI so it cannot drift:

```bash
uv export --locked --format pylock.toml -o pylock.toml
```

**★ Symptom: two `requirements.txt` files (`requirements.txt`, `requirements-dev.txt`) drift apart.**
Cause: single-use lock files, which is what they are — *"hence why it isn't uncommon for a project to have
multiple requirements files, each for a different use-case."* Fix: keep one multi-use source of truth (the
lock) and generate each file from it, per group ([22](22-dependency-groups.md)).

**★ Symptom: a lockfile in the repository and a `pip install -r requirements.txt` in the Dockerfile.**
Cause: two mechanisms, one of them unlocked. Whichever the container uses is the real deployment contract;
the other is decoration. Fix: make the container install from the lock, or generate its requirements file
from the lock in the same CI step that builds it — never maintain both by hand.

**★ Symptom: CI is green, production crashes on an import from the same commit and the same lock.** Cause: the
two ran different Python minors, and the universal lock forks by marker — *"the markers determine which version
will be used"*, and every install *"MUST narrow down to a single entry at install time"* for *its own*
environment. Fix: pin the interpreter in the repository and run CI on it:

```bash
uv python pin 3.14
git add .python-version
```

**★ Symptom: CI fails reading `uv.lock` right after a teammate upgraded uv locally.** Cause: their newer uv wrote
a greater schema version, and *"lockfiles may only be rejected across minor releases"* — the runner's older minor
refuses it. Fix: pin uv itself in CI to the version the team uses:

```yaml
- uses: astral-sh/setup-uv@v5
  with:
    version: "0.12.12"
```

**Symptom: `uv sync --locked` fails on a clean checkout with a message that the lock needs updating, and nobody
changed `pyproject.toml`.** Cause: something the lock depends on did change — a workspace member's
`pyproject.toml`, a `[tool.uv]` setting such as `exclude-newer` or `environments`, or the declared
`requires-python` — and the lock is compared against the project as a whole, not one file. Fix: re-lock
locally, commit the lock with the change that caused it, and let the CI gate do its job:

```bash
uv lock
git add uv.lock
```

## Interview questions

**★ What is the difference between `--locked` and `--frozen`?**
`--locked` *checks*: *"Requires that the lockfile is up-to-date. If the lockfile is missing or needs to be
updated, uv will exit with an error."* `--frozen` *trusts*: *"Instead of checking if the lockfile is
up-to-date, uses the versions in the lockfile as the source of truth. If the lockfile is missing, uv will
exit with an error. If the `pyproject.toml` includes changes to dependencies that have not been included in
the lockfile yet, they will not be present in the environment."* So `--locked` is the CI gate that catches a
`pyproject.toml` edit without a re-lock; `--frozen` is for environments where you deliberately do not want
the resolver consulted at all, at the cost of silently ignoring declaration drift.

**★ Why did PEP 751 standardise a lockfile format when every tool already had one?**
Because a per-tool format forces every *consumer* of lock data to pick winners: *"any tooling that wants to
work with lock files must choose which format to support, potentially leaving users unsupported (e.g.
Dependabot only supporting select tools, same for cloud providers who can do dependency installations on
your behalf, etc.). It also impacts portability between tools, which causes vendor lock-in."* The PEP also
fixes two properties `requirements.txt` never had: it is *"not secure by default"* there because hashes are
opt-in, and it is *"a bespoke file format"* tied to pip's options rather than a standard.

**★ What is a multi-use lock file and why does it matter?**
One file covering several use-cases, expressed with the extras and dependency-group marker fields:
*"Multi-use lock files represent multiple use-cases within a single file, often expressed through extras and
Dependency Groups."* It matters because the alternative — a `requirements.txt` per purpose — is where drift
comes from: *"it isn't uncommon for a project to have multiple requirements files, each for a different
use-case"*, and nothing keeps a shared package consistent across them. A multi-use lock resolves everything
together, so `pytest`'s transitive dependencies cannot disagree with production's.

**★ Someone hand-edits `uv.lock` in a hotfix. What do you tell them, and what do you do instead?**
That the file is *"managed by uv and should not be edited manually"* — it is internally consistent, and an
edited version can contradict metadata recorded elsewhere in the same file, producing failures that look
like resolver bugs. The equivalent deliberate action is `uv lock --upgrade-package <name>==<version>`, which
changes one package and leaves the rest at their previously locked versions, because uv *"will prefer the
previously locked versions of packages"*. If the fix needs a version your declaration forbids, the honest
change is to `pyproject.toml`, in the same commit.

**★ A lock lists `numpy` twice and CI and production install different ones. Is the lock broken?**
No — that is a universal lock doing its job. It *"captures the packages that would be installed across all
possible Python markers"*, and PEP 751 requires only that each install *"narrow down to a single entry at install
time"* for its own environment. Two environments that differ in Python version or platform select different
entries. The defect, if there is one, is that CI and production are different environments; the fix is to make
them the same — pin the interpreter with `.python-version`, run CI on that minor — not to fight the lock.

**Why might a lockfile written on one developer's machine be unreadable on another's?**
Because the lock format is versioned and the tools are not always the same version. uv *"will reject lockfiles with
a greater schema version"*, and the schema is bumped only in minor releases, so *"lockfiles may only be rejected
across minor releases"*. A developer on uv 0.13 writing a lock that a CI runner on 0.12 must read is exactly that
case. The tool that writes the lock is part of the reproducibility contract, which is why teams pin uv in CI and
agree on an upgrade moment for it the same way they do for Python.

---

← [17b · A lock never expires](17b-a-lock-never-expires.md) · [Topic index](README.md) · Next → [18 · `uv.lock` vs `pip freeze` vs `pip-compile`](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)
