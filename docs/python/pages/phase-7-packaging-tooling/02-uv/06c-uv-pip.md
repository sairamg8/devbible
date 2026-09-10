---
title: "`uv pip` is a drop-in replacement for pip workflows and explicitly not a clone of pip — and the differences that are deliberate are the ones that will surprise you in a corporate network"
sidebar_label: "06c · uv pip vs pip"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *pip compatibility*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)), *Locking an environment*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compile/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Using Python environments*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/environments/)) and the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**uv's pip interface is the compatibility surface: the same command names, the same
`requirements.txt`, none of the project machinery. It exists so that a repository with no
`pyproject.toml` can get uv's resolver and cache without restructuring anything, and it is genuinely a
drop-in for the common workflows. It is also, in uv's own words, *not* an exact clone — and the
deviations are deliberate, documented, and each one bites in a specific situation. The one that costs
people an afternoon is that uv reads none of pip's configuration: `pip.conf` and `PIP_INDEX_URL` are
ignored, so a corporate private index silently disappears and every install fails against PyPI.**

## The stated position

> *"uv is designed as a drop-in replacement for common `pip` and `pip-tools` workflows"*

> *"uv is not intended to be an exact clone of `pip`."*
> — both [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

Both sentences are on the same page, and holding both is the right posture: expect your commands to
work, and expect a handful of documented behavioural differences that you should know before you meet
them.

## 🔴 Deviation 1 — uv reads none of pip's configuration

> *"uv does not read configuration files or environment variables that are specific to `pip`, like
> `pip.conf` or `PIP_INDEX_URL`."*
> — [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

This is the highest-cost difference in practice, because it fails in the most confusing way: in an
organisation with an internal index, `pip install` works and `uv pip install` cannot find your
packages — so uv looks broken rather than differently-configured. The equivalents:

> `UV_DEFAULT_INDEX`: *"Equivalent to the `--default-index` command-line argument. If set, uv will use
> this index as the default index when searching for packages."*

> `UV_INDEX_URL`: *"Equivalent to the `--index-url` command-line argument. … (Deprecated: use
> `UV_DEFAULT_INDEX` instead.)"*
> — both [environment variables](https://docs.astral.sh/uv/reference/environment/)

```bash
export UV_DEFAULT_INDEX=https://pypi.internal.example.com/simple
uv pip install our-internal-lib
```

```toml
# or in the project, where it is committed and visible to everyone
[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
default = true
```

⚠️ Related version boundary: uv **0.12.5** (2026-08-14) added, in preview, *"Allow `--index` and
`--default-index` to select configured package indexes by name"*
([releases](https://github.com/astral-sh/uv/releases)). Index configuration is an area that has moved
recently, so check the settings reference for the uv you are pinning rather than copying a snippet
from an older post.

The mirror image of this deviation is uv's own pip-only configuration: a `[tool.uv.pip]` table exists,
and *"Settings in this section will not apply to `uv` commands outside the `uv pip` namespace"*
([configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)). So there are three
places an index can be configured — pip's files (ignored by uv), `[tool.uv.pip]` (read by `uv pip`
only), and the top level of `[tool.uv]` (read by both interfaces). Only the last one does what a team
usually means. Where each layer of uv configuration is discovered and how they merge is
[08](08-configuration-files.md).

## 🔴 Deviation 2 — a virtual environment is required by default

> *"`uv pip install` and `uv pip sync` are designed to work with virtual environments by default.
> Specifically, uv will always install packages into the currently active virtual environment, or search
> for a virtual environment named `.venv` in the current directory or any parent directory (even if it
> is not activated)."*

> *"differs from `pip`, which will install packages into a global environment if no virtual environment
> is active."*

> *"`--system` flag, which installs into the first Python interpreter found on the `PATH`, like
> `pip`."*
> — all three [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

uv's default is the safer inversion of pip's, and pip's historical default is the direct cause of the
broken-system-Python class of bug ([06](06-pip-and-venv-the-floor.md)). The environment variable form
is `UV_SYSTEM_PYTHON` — *"Equivalent to the `--system` command-line argument. If set to `true`, uv will
use the first Python interpreter found in the system `PATH`."*
([environment variables](https://docs.astral.sh/uv/reference/environment/)).

`--system` is legitimate in a container whose entire filesystem is the environment, and a foot-gun in a
shell profile, where it silently converts every later `uv pip install` on that machine into a system
modification.

🔴 Read the first quote's order of preference carefully: the **currently active** environment wins over
the `.venv` in the directory you are standing in. An environment left activated from another project
therefore captures every `uv pip install` you run here. The documented way to name a target without
activation is the variable itself — *"setting `VIRTUAL_ENV=/path/to/venv` will cause uv to install into
`/path/to/venv`, regardless of where uv is installed"*
([using Python environments](https://docs.astral.sh/uv/pip/environments/)).

```bash
deactivate                                           # drop the stale activation, then
uv pip install requests                              # .venv in this directory or a parent
VIRTUAL_ENV="$PWD/.venv" uv pip install requests     # or name the target explicitly
```

## What this page does not cover

This page covers the two deviations that decide *where* `uv pip` installs and *from which index*.
The two that decide *what* it installs — a different resolver with different priorities, and PEP 517
build isolation on by default — are [06d](06d-uv-pip-resolver-and-build-isolation.md). How the pip
interface's own verbs differ from each other is [06e](06e-uv-pip-install-sync-and-compile.md), and
leaving the pip interface for a uv project is [06f](06f-migrating-from-requirements-to-a-project.md).

## Gotchas

**★ Symptom: `pip install` finds your company's internal packages and `uv pip install` cannot.**
Cause: *"uv does not read configuration files or environment variables that are specific to `pip`, like
`pip.conf` or `PIP_INDEX_URL`."* Fix: configure uv's own index, preferably in the project so it is
committed and shared.

```bash
export UV_DEFAULT_INDEX=https://pypi.internal.example.com/simple
```

```toml
[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
default = true
```

**★ Symptom: `uv pip install` errors because it cannot find an environment, where `pip` would have installed globally.**
Cause: the deliberate deviation — uv targets a virtual environment by default, which *"differs from
`pip`, which will install packages into a global environment if no virtual environment is active."*
Fix: create an environment; use `--system` only where a global install is genuinely intended.

```bash
uv venv && uv pip install requests
uv pip install --system requests        # containers only, deliberately
```

**★ Symptom: a CI job installed packages into the runner's system Python and a later job saw them.**
Cause: `--system` or `UV_SYSTEM_PYTHON` — *"installs into the first Python interpreter found on the
`PATH`, like `pip`."* Fix: unset it and use a per-job environment, which is isolated by construction.

```bash
unset UV_SYSTEM_PYTHON
uv venv && uv pip sync requirements.txt
```

**★ Symptom: `uv pip install` put the package into a different project's environment.**
Cause: an environment from that other project is still activated, and the pip interface prefers
*"the currently active virtual environment"* over the `.venv` in your directory. Fix: deactivate, or
name the target.

```bash
deactivate
VIRTUAL_ENV="$PWD/.venv" uv pip install requests
```

**Symptom: `UV_INDEX_URL` works, and a reviewer flags it as deprecated.**
Cause: the environment reference marks it *"(Deprecated: use `UV_DEFAULT_INDEX` instead.)"*. Fix: rename
it now, while it still works, rather than when a release removes it — uv is pre-1.0.

```bash
export UV_DEFAULT_INDEX=https://pypi.internal.example.com/simple    # was UV_INDEX_URL
```

**Symptom: a base image sets `PIP_INDEX_URL`, the Dockerfile moves from `pip install` to `uv pip install`, and the build fails to find internal packages.**
Cause: the setting is still there and still correct — for pip. uv reads none of it. Fix: translate it
to uv's variable in the same image layer that set the pip one.

```dockerfile
ENV PIP_INDEX_URL=https://pypi.internal.example.com/simple \
    UV_DEFAULT_INDEX=https://pypi.internal.example.com/simple
```

## Interview questions

**★ uv calls its pip interface a "drop-in replacement" and also says it is "not an exact clone". How do you hold both?**
By expecting the *commands* to be compatible and the *behaviour* to differ in documented, deliberate
places. The command surface really is drop-in for common workflows: `uv pip install`,
`uv pip install -r`, `uv pip compile`, `uv pip sync` all take what you would expect. The deviations are
enumerated on one page and each is a considered choice: uv targets a virtual environment rather than a
global interpreter, uses PEP 517 build isolation by default, prefers stable over pre-release versions
with a specific fallback rule, has a resolver with *"a different set of package priorities"*, and
crucially reads none of pip's configuration. The right posture is to read that page once before
adopting uv in an organisation, because the surprises are finite and knowable.

**★ What is the single most expensive difference in a corporate environment, and why?**
That *"uv does not read configuration files or environment variables that are specific to `pip`, like
`pip.conf` or `PIP_INDEX_URL`."* In an organisation with an internal index, that configuration is often
set once in a base image or a shell profile years ago and nobody remembers it exists — so `pip install`
works, `uv pip install` cannot find internal packages, and uv appears broken rather than
differently-configured. The fix is `UV_DEFAULT_INDEX` or an index entry under `[tool.uv]`, and the
better fix is the project-level configuration rather than an environment variable, because it is
committed, reviewed, and works for a new colleague on their first day instead of after a
troubleshooting session.

**★ Why does uv refuse to install into a global interpreter by default when pip does not?**
Because pip's default predates the ubiquity of virtual environments and is the direct cause of the
broken-system-Python class of failure — a user installs a library, a system tool written in Python
stops working. uv documents the contrast itself: its pip interface targets a virtual environment,
which *"differs from `pip`, which will install packages into a global environment if no virtual
environment is active."* The same reasoning is why modern distributions now mark the system interpreter
as externally managed and block pip outright. uv's escape hatch is `--system`, *"which installs into the
first Python interpreter found on the `PATH`, like `pip`"* — legitimate in a container whose whole
filesystem is the environment, and dangerous in a shell profile, because it makes every later install on
that machine a system modification without any per-command signal.

**An activated virtual environment and a `.venv` in the current directory both exist. Where does `uv pip install` go, and why does it matter?**
Into the activated one. uv's documented order is *"the currently active virtual environment, or search
for a virtual environment named `.venv` in the current directory or any parent directory"* — activation
is checked first. That is the right default for someone who activated deliberately, and a trap for
anyone who activated something an hour ago in a different project and forgot: the install succeeds,
into the wrong place, with no signal. The project interface does not have this seam in the same way,
because project commands use the project's own environment; that asymmetry is
[02b](02b-activation-and-discovery.md). For the pip interface, the defensive habits are to stop
activating at all, or to name the target explicitly with `VIRTUAL_ENV`.

**Why doesn't uv simply honour `pip.conf` for compatibility, given it calls itself a drop-in?**
The compatibility page states the fact — *"uv does not read configuration files or environment
variables that are specific to `pip`"* — and does not give a rationale on the page as I read it, so any
answer is an argument rather than a quotation. The defensible argument is that pip's configuration
names pip's own options with pip's semantics, and uv's options do not map one-to-one (its index model
is richer than a single index URL), so reading pip's files would mean silently reinterpreting settings
that were written for a different tool. What matters in practice is not the reason but the audit: before
adopting uv anywhere with an internal index, find where pip's index configuration lives — base image,
CI variables, a user's `pip.conf` — and restate it for uv, preferably in `[tool.uv]`, where it is
committed.

---

← Prev: [06b · Requirements files and the floor's limits](06b-requirements-files-and-the-floors-limits.md) · [Topic index](README.md) · Next → [06d · uv pip: resolver and builds](06d-uv-pip-resolver-and-build-isolation.md)
