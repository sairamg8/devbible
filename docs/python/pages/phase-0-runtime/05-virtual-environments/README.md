---
title: "Virtual environments: a config file, a directory of links and one PATH change — and every venv problem you will ever have is a consequence of exactly that"
sidebar_label: "05 · Virtual environments"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` — Creation of virtual environments](https://docs.python.org/3.14/library/venv.html),
> [PEP 405 – Python Virtual Environments](https://peps.python.org/pep-0405/),
> [`site`](https://docs.python.org/3.14/library/site.html),
> [`sysconfig`](https://docs.python.org/3.14/library/sysconfig.html),
> [PEP 668](https://peps.python.org/pep-0668/),
> the [uv documentation](https://docs.astral.sh/uv/pip/environments/),
> [virtualenv's comparison with venv](https://virtualenv.pypa.io/en/latest/explanation.html),
> the [conda user guide](https://docs.conda.io/projects/conda/en/stable/user-guide/concepts/environments.html),
> the [wheel specification](https://packaging.python.org/en/latest/specifications/binary-distribution-format/)
> and the [Linux `execve(2)` manual page](https://man7.org/linux/man-pages/man2/execve.2.html).
> Version spine: **Python 3.14.7**.

**A virtual environment is a directory containing a text file called
`pyvenv.cfg`, a `bin/` with a symlink to an interpreter you already had, and an
empty `site-packages`. It has no standard library of its own, no isolation beyond
package visibility, and no knowledge of what should be installed in it.
"Activating" it prepends one directory to `PATH`. Every confusing thing a venv
ever does — surviving a rename halfway, losing all its packages after an OS
upgrade, working in your terminal and not in your editor, breaking when a
colleague checks it into git — falls out of those four facts, and this topic
derives each one of them from the documentation rather than asking you to
memorise a rule.**

Topic [04](../04-installing-and-versions/README.md) drew the distinction between an
*installation*, a *version manager* and an *environment*. This topic is the third
layer, in full. It assumes you have an interpreter you own and are not fighting
PEP 668 — if you are, read
[`../04-installing-and-versions/02-responding-to-pep-668.md`](../04-installing-and-versions/02-responding-to-pep-668.md)
first; venvs are the first of the four correct answers there.

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What a venv is on disk](01-what-a-venv-is-on-disk.md)** | The tree, `pyvenv.cfg`'s keys, why there is no standard library in it, exactly what "isolated" covers and what it does not |
| 2 | **[How the interpreter finds it](02-how-the-interpreter-finds-it.md)** | The `pyvenv.cfg` landmark search and why symlinks are not resolved; `sys.prefix` vs `sys.base_prefix` as the only honest test; why `VIRTUAL_ENV` lies in both directions; the 3.14 `-S` change |
| 3 | **[Creating one with `venv`](03-creating-with-python-m-venv.md)** | Why there is no `--python` flag; every option and the failure it exists for; `--upgrade` vs `--clear`; the `ensurepip` bootstrap; `EnvBuilder` |
| 4 | **[Activation is only PATH](04-activation-is-only-path.md)** | What `activate` does in four steps; the per-shell table; why `deactivate` is a function; the activation-free playbook; why installed scripts work without it |
| 5 | **[Venvs are not relocatable](05-not-relocatable.md)** | The four absolute paths and which survive a move; why `python` keeps working while tools break; editable installs; the shebang length limit; how to repair and when to recreate |
| 6 | **[When the base moves](06-when-the-base-interpreter-moves.md)** | Deleted, moved, patched and minor-upgraded base interpreters — four failures, four symptoms, and the one that silently empties `sys.path` |
| 7 | **[`uv venv` and `uv run`](07-uv-venv-and-uv-run.md)** | The same PEP 405 environment without pip in it; upward `.venv` discovery; `uv run`'s sync guarantee; `--with`, `--isolated`, `--active`, `UV_PROJECT_ENVIRONMENT` |
| 8 | **[`--system-site-packages`](08-system-site-packages.md)** | The one documented key, the four legitimate uses, and six ways it leaks — including the two that corrupt your requirements file instead of crashing |
| 9 | **[Where the venv lives](09-where-the-venv-lives.md)** | `.venv` in the project and when not; git, `.dockerignore`, synced folders, network mounts; keeping it out of pytest and linters; names to avoid |
| 10 | **[venv, virtualenv, conda](10-venv-virtualenv-conda.md)** | Three tools, three scopes; virtualenv's own comparison; what conda manages that neither of the others can; where poetry, pdm, hatch and pipenv fit |
| 11 | **[Editors, CI and Docker](11-editors-ci-and-docker.md)** | Interpreter selection and the four symptoms of getting it wrong; Jupyter kernels; why CI never activates and what to cache; the multi-stage Docker venv pattern |

## The short version

```bash
# create — the interpreter you run is the version you get
python3.14 -m venv .venv

# use it without activating anything
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pytest

# or activate, for an interactive shell only
source .venv/bin/activate      # Windows: .venv\Scripts\activate
deactivate

# or skip the whole question
uv venv --python 3.14
uv run pytest
```

And the one check that settles every "which Python am I in?" argument:

```python
import sys
print(sys.executable)
print(sys.prefix, sys.base_prefix, sep="\n")
print("venv:", sys.prefix != sys.base_prefix)
```

## Phase gate contribution

After this topic you can state what a virtual environment consists of without
using the word "isolated" as an explanation; say what activation does and name
three contexts where you should not use it; explain why a moved environment
half-works; predict what an OS Python upgrade does to every environment on the
machine; and decide between venv, virtualenv and conda with a reason attached.

## Where this connects

- **[04 · Installing and versions](../04-installing-and-versions/README.md)** is
  the layer below: this topic assumes an interpreter you own.
- **[06 · Running code](../06-running-code/README.md)** is the layer above:
  once you have the right interpreter, `python file.py` and `python -m pkg` are
  not the same command.
- **[08 · Imports](../08-imports/README.md)** explains the `sys.path` machinery
  that `site` populates from `sys.prefix` — the mechanism a venv redirects.
- **Phase 7 — Packaging** turns the environment into `requires-python`, a
  lockfile and a reproducible build, which is what makes "recreate, do not move"
  a cheap instruction to follow.

---

← Prev: [Installing and versions](../04-installing-and-versions/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Running code](../06-running-code/README.md)
