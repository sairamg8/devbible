---
title: "A requirements file is a list, `pip freeze` is a photograph of one machine, and `pip install` only ever adds — the three limits of the floor that every uv design decision answers"
sidebar_label: "06b · Requirements files and the floor's limits"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **Python 3.14.7** — *Installing packages using pip and virtual
> environments* ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/))
> and the `venv` module documentation ([docs.python.org](https://docs.python.org/3.14/library/venv.html)),
> cross-read against **uv 0.12.12** — *pip compatibility*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[06](06-pip-and-venv-the-floor.md) covered the environment itself — what `python -m venv` creates,
why activation is optional, and why `python -m pip` is the safe invocation. This page covers what the
floor does with *dependencies*, which is where its limits are. A requirements file has no notion of
which lines you chose and which merely followed; `pip freeze` reports one environment on one
platform, including whatever anybody installed by hand; and `pip install -r` adds without ever
removing. None of this is a defect in pip — each is a precise consequence of what the tools are
documented to do. Read them precisely and uv's exact syncing, universal lockfile and
declared-versus-resolved split stop looking like conventions and start looking like answers.**


## Requirements files, and what they are not

> *"Instead of installing packages individually, pip allows you to declare all dependencies in a
> Requirements File."*

> *"`pip freeze` command is useful for creating Requirements Files that can re-create the exact
> versions of all packages installed in an environment."*
> — both [packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

Read that second sentence with care, because it is precise and it is the whole argument for lockfiles.
`pip freeze` re-creates *"all packages installed in an environment"* — **an environment**, singular,
the one in front of you. It therefore includes:

- every transitive dependency, indistinguishable from the ones you chose;
- every package anyone installed by hand and forgot;
- whatever a platform-conditional dependency happened to resolve to *here*;
- nothing about which entries were intentional.

⚠️ The packaging guide does **not** say `pip freeze` output is unsuitable for cross-platform use, and
this page will not attribute that stronger claim to it. What the guide says is what it does — describe
one environment — and the cross-platform limitation follows from that rather than from a warning
anybody wrote.

There is also a real distinction between a hand-written `requirements.in` of intentions and a generated
`requirements.txt` of resolved versions; the tool that formalised it is `pip-tools`, and uv's
equivalent is `uv pip compile` ([06e](06e-uv-pip-install-sync-and-compile.md)) or, better, `uv.lock`
([03](03-the-lockfile.md)).

## What the floor genuinely cannot do

Not criticism — these are the boundaries that explain uv's design:

| Limitation of the floor | uv's response |
|---|---|
| `pip install` only ever *adds*; nothing removes undeclared packages | exact syncing removes them ([02c](02c-uv-sync-makes-the-environment-match.md)) |
| `pip freeze` describes one machine | a universal lockfile ([03](03-the-lockfile.md)) |
| no distinction between declared and resolved | `pyproject.toml` + `uv.lock` |
| pip lives *inside* the environment it modifies | uv is an external binary ([01](01-what-uv-is.md)) |
| `venv` cannot obtain an interpreter it does not have | `uv python install` ([05](05-uv-python.md)) |
| no dependency groups without abusing extras | PEP 735 `[dependency-groups]` ([04](04-add-and-remove.md)) |

## The floor, as a complete working recipe

Worth keeping, because one day you will be on a machine where it is all you have:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pytest
```

That runs on any machine with a Python 3 and network access to an index, needs no new tool, and needs
no approval. It is also exactly what to fall back to when uv is unavailable and something must ship.

## Gotchas

**★ Symptom: `pip install -r requirements.txt` produced an environment that still has extra packages.**
Cause: `pip install` is additive — it never removes anything. Fix: at the floor, the reliable answer is
to rebuild the environment rather than to converge it.

```bash
rm -rf .venv && python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

**★ Symptom: a `requirements.txt` from `pip freeze` fails to install on a colleague's different OS.**
Cause: it records *"all packages installed in an environment"* — that environment, with the
platform-conditional resolutions that applied there. Fix: at the floor, keep a hand-written list of
intentions separate from any frozen output; with uv, use the lockfile.

```bash
# requirements.in  — intentions, hand-written
# requirements.txt — generated; never edited
```

**★ Symptom: production images contain pytest, black and a debugger.**
Cause: `requirements.txt` was produced by `pip freeze` in a development environment, and freeze
records *"all packages installed in an environment"* — tools included. Fix: keep the intentions
separate per purpose, and never freeze a development environment into a production file.

```text
# requirements.in       — what the service imports
# requirements-dev.in   — -r requirements.in, plus the tools
```

**Symptom: you bumped one pinned version in a frozen `requirements.txt` and the install now reports a conflict.**
Cause: a frozen file pins every transitive dependency too, and those pins were chosen for the *old*
version of the package you bumped. Editing one line of a resolution does not re-resolve the rest. Fix:
change the intention and regenerate the resolution.

```bash
# requirements.in:  httpx>=0.28    (was >=0.27)
uv pip compile --universal requirements.in -o requirements.txt
```

**★ Symptom: a CI job cannot install uv, and the pipeline is blocked.**
Cause: an image with no egress to the installer, or a policy that forbids unvetted binaries. Fix: the
floor still works, and it is the honest fallback rather than a defeat.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

## Interview questions

**★ Why is `pip freeze` output not a lockfile?**
Because it is a report on one environment rather than a resolution. The packaging guide's own wording is
the tell: it is useful for files *"that can re-create the exact versions of all packages installed in
an environment."* That environment includes every transitive dependency indistinguishable from your
intentional ones, anything installed by hand and forgotten, and whatever platform-conditional
dependencies happened to be selected on that machine — with no record of which entries were chosen and
which merely followed. It contains no environment markers, so it cannot describe a second platform; and
it is a fixed point rather than a solution, so it cannot be selectively upgraded or re-derived. It is
genuinely useful as an emergency reproduction of one machine, and it is not a substitute for a
resolution.

**★ Given uv exists, why learn the pip and venv workflow at all?**
Three reasons, in increasing order of importance. You will be handed repositories built on it, and
"first, install a new tool and restructure your project" is not always an available answer. You will
meet machines where installing uv is genuinely not an option — an air-gapped runner, a locked base
image, a client's laptop — and `python3 -m venv` plus `pip install -r` is the one workflow guaranteed to
be present. And most valuably: every one of uv's design decisions is a response to a specific
limitation here. Exact syncing exists because `pip install` only adds. The universal lockfile exists
because `pip freeze` describes one machine. The external binary exists because pip lives inside the
environment it modifies. Learn the floor and uv stops being a set of conventions to memorise.

**★ What is the difference between `requirements.in` and `requirements.txt` in a pip-tools-style repository?**
Intent versus resolution. `requirements.in` is hand-written and lists what the project directly uses,
with ranges where a range is acceptable; nobody but a human edits it. `requirements.txt` is generated
from it by a resolver and lists every package, transitive ones included, at an exact version; nobody
but the resolver edits it. The split exists because a single file cannot be both a statement of
intent and a reproducible record: if you edit the resolved file, you have a version nobody resolved,
and if you install from the intent file, you re-resolve on every install and get whatever the index
holds that day. The floor has no tool that enforces the split — pip reads either file happily — which
is why `pip-tools` existed, and why `pyproject.toml` plus `uv.lock` is the same idea with the tool
enforcing it ([03](03-the-lockfile.md)).

**Map each limitation of the floor to the uv feature that answers it.**
`pip install` only adds, so undeclared packages accumulate: uv's `uv sync` is exact and removes them.
`pip freeze` describes one machine: `uv.lock` is a universal resolution over every platform at once.
There is no distinction between declared and resolved: `pyproject.toml` holds intent and `uv.lock`
holds the resolution, and the tool keeps them consistent. pip lives inside the environment it
modifies: uv is an external binary. `venv` cannot obtain an interpreter it does not have: `uv python
install` can. And development tools had no home except abused extras or a second requirements file:
PEP 735 dependency groups give them one. The table on this page is the short form, and it is a better
answer to *"why uv"* than any speed figure, because every row is a class of bug rather than a number.

---

← Prev: [06 · pip + venv, the floor](06-pip-and-venv-the-floor.md) · [Topic index](README.md) · Next → [06c · uv pip vs pip](06c-uv-pip.md)
