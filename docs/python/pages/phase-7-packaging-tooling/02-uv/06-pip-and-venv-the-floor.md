---
title: "`python -m venv` plus `pip install -r` is the floor that exists on every machine with Python, and knowing exactly what it cannot do is what makes uv's design legible rather than magical"
sidebar_label: "06 · pip + venv, the floor"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **Python 3.14.7** — the `venv` module documentation
> ([docs.python.org](https://docs.python.org/3.14/library/venv.html)) and *Installing packages using
> pip and virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)),
> cross-read against **uv 0.12.12** — *pip compatibility*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Every machine with Python has `venv` and `pip`, and that is not a small thing: it is the one
workflow that needs no network to bootstrap, no new binary, no approval from anybody. Learn it
properly for three reasons. You will be handed repositories that use it. You will meet locked-down
environments where installing uv is not an option. And most usefully, every design decision uv made
is a response to a specific limitation of this floor — external binary because pip lives inside the
environment, exact syncing because `pip install` only ever adds, a universal lockfile because
`pip freeze` reports one machine. Knowing the floor turns uv from a set of conventions into a set of
consequences.**

## Creating an environment, and what is inside it

```bash
python3 -m venv .venv
```

> *"This will create a new virtual environment in a local folder named `.venv`"*
> — [packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

> *"It also creates a `bin` (or `Scripts` on Windows) subdirectory containing a copy or symlink of the
> Python executable (as appropriate for the platform or arguments used at environment creation time).
> It also creates a `lib/pythonX.Y/site-packages` subdirectory (on Windows, this is
> `Lib\site-packages`)."*

> *"This creates the target directory (including parent directories as needed) and places a
> `pyvenv.cfg` file in it with a `home` key pointing to the Python installation from which the command
> was run."*
> — both [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

Three things are worth noticing in those sentences, because each has a consequence you will meet:

- **`lib/pythonX.Y/site-packages`** is *version-specific*, which is why a minor Python upgrade
  invalidates the whole environment ([05c](05c-interpreter-upgrades-and-ci-matrices.md)).
- **`pyvenv.cfg` holds an absolute `home` path**, which is why environments are not movable.
- **`bin/` holds a copy or symlink of the interpreter**, not a fresh build — a virtual environment is a
  redirection layer over an existing Python, not a Python.

The flags that matter:

| Flag | Documentation |
|---|---|
| `--system-site-packages` | *"Give the virtual environment access to the system site-packages directory."* |
| `--without-pip` | *"Skips installing or upgrading pip in the virtual environment (pip is bootstrapped by default)."* |
| `--upgrade-deps` | *"Upgrade core dependencies (pip) to the latest version in PyPI."* |

🔴 Note the parenthesis in the second row: **pip is bootstrapped by default here**, which is the exact
inverse of `uv venv` ([02](02-the-environment-uv-expects.md)). That single difference accounts for most
of the friction when someone moves between the two tools.

And the historical footnote, worth knowing when reading old code:

> *"Changed in version 3.5: The use of `venv` is now recommended for creating virtual environments."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

So `virtualenv` (the third-party package) and the removed `pyvenv` script both predate the standard
answer. A repository still using `virtualenv` is usually doing so for a reason — Python 2 history, or
one of `virtualenv`'s extra features — and not because it is the current recommendation.

## Activation, and what it does not do

> *"Activating a virtual environment will put the virtual environment-specific `python` and `pip`
> executables into your shell's `PATH`."*
> — [packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

> *"You don't specifically need to activate a virtual environment, as you can just specify the full
> path to that environment's Python interpreter when invoking Python. Furthermore, all scripts
> installed in the environment should be runnable without activating it."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

Both sentences are from the primary sources and together they say something people find surprising:
**activation is optional even in the pip workflow.** `.venv/bin/pip install requests` works exactly as
well as activating first, because of the shebang mechanism
([02b](02b-activation-and-discovery.md)). Activation is ergonomics, and the habit of treating it as
required is what makes uv's *"no activation"* workflow feel exotic when it is merely explicit.

## Installing, and the reason `python -m pip` is the safer form

> *"When your virtual environment is activated, you can install packages. Use the `pip install` command
> to install packages."*
> — [packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

```bash
.venv/bin/python -m pip install requests        # no activation needed
.venv/bin/python -m pip install -r requirements.txt
```

`python -m pip` is preferable to bare `pip` for a mechanical reason: it installs into *the interpreter
you just named*, whereas bare `pip` installs into whichever interpreter the `pip` executable on `PATH`
belongs to. When several environments and a system Python are in play, those are different answers, and
the failure is silent — the install succeeds, into the wrong place. This is the class of problem uv
removes by making the interpreter an argument rather than an ambient fact.

## Where the floor continues

Requirements files, what `pip freeze` actually records, the table of limitations uv was designed
against, and the complete floor recipe are [06b](06b-requirements-files-and-the-floors-limits.md).

## Gotchas

**★ Symptom: `pip install` succeeded and the package is not importable in the program you ran.**
Cause: bare `pip` belongs to whichever interpreter's `bin` directory came first on `PATH`, which may
not be the interpreter you are running. Fix: name the interpreter and let it find its own pip.

```bash
.venv/bin/python -m pip install requests
python3 -m pip --version        # prints which interpreter's pip this is
```

**★ Symptom: your program imports something that is not in `requirements.txt` and works anyway.**
Cause: the environment was created with `--system-site-packages`, so distro packages are visible. Fix:
recreate without it, and declare what you use.

```bash
rm -rf .venv && python3 -m venv .venv
```

**★ Symptom: you moved the project directory and every script in `.venv/bin` fails.**
Cause: `pyvenv.cfg`'s absolute `home` key and the shebangs. CPython: *"if you move an environment
because you moved a parent directory of it, you should recreate the environment in its new location."*
Fix: recreate it.

```bash
rm -rf .venv && python3 -m venv .venv
```

**★ Symptom: after a system Python upgrade from 3.14 to 3.15, the environment is unusable.**
Cause: `site-packages` lives under `lib/pythonX.Y/`, so the old path is neither found nor valid, and
`pyvenv.cfg` names an interpreter that has moved. Fix: recreate.

```bash
rm -rf .venv && python3 -m venv .venv
```

**★ Symptom: `pip install` refuses to run against the system Python with a message about an externally managed environment.**
Cause: modern distributions mark the system interpreter so that installing into it is blocked — the
protection exists precisely because "pip installs globally when nothing is active" broke systems. Fix:
create an environment. Do not reach for a flag that overrides the protection.

```bash
python3 -m venv .venv && .venv/bin/python -m pip install requests
```

**Symptom: a Makefile or CI step that calls `.venv/bin/python` works on Linux and macOS and fails on the Windows runner.**
Cause: CPython documents the layout as *"a `bin` (or `Scripts` on Windows) subdirectory"*, so the path
itself is platform-specific. Fix: branch on the platform, or let a tool that knows the layout name the
interpreter for you.

```bash
.venv/bin/python -m pytest                 # POSIX
uv run pytest                              # or let uv resolve the interpreter on every platform
```

```powershell
.venv\Scripts\python.exe -m pytest         # Windows
```

## Interview questions

**★ What is a virtual environment, mechanically?**
A directory containing a `pyvenv.cfg`, a `bin` (or `Scripts`) directory with a copy or symlink of an
existing interpreter, and a version-specific `site-packages`. CPython documents exactly that: the
creation step *"places a `pyvenv.cfg` file in it with a `home` key pointing to the Python installation
from which the command was run"*, alongside *"a `lib/pythonX.Y/site-packages` subdirectory"*. So it is
a *redirection layer over an existing Python*, not a new Python — which explains almost every property
people find surprising. It is not portable, because `home` is an absolute path. It breaks on a minor
interpreter upgrade, because `site-packages` is under `lib/pythonX.Y/`. And it needs no activation,
because installed scripts carry the interpreter path in their shebang.

**★ Why is `python -m pip install` preferable to `pip install`?**
Because it removes an ambiguity that fails silently. `python -m pip` installs into the interpreter you
just named on the command line. Bare `pip` installs into whichever interpreter owns the first `pip`
executable on `PATH`, which on a machine with a system Python and two environments is a genuinely open
question — and if it picks the wrong one, the install *succeeds* and the import fails later, in a
different program, with no connection to the command you ran. This is the same problem uv solves
structurally by making the interpreter an argument rather than an ambient property of your shell, and
it is a good example of why "just use the tool" is worse advice than "understand what the tool
removed".

**★ Activation is optional even with pip. Why does everyone treat it as mandatory?**
Because it is the first thing every tutorial shows, and because it makes an interactive session
comfortable — after activation, `python` and `pip` mean what you want without typing a path. But the
primary source is explicit that it is not required: *"You don't specifically need to activate a virtual
environment, as you can just specify the full path to that environment's Python interpreter when
invoking Python. Furthermore, all scripts installed in the environment should be runnable without
activating it."* The cost of treating it as mandatory is that it becomes the mental model, and then
`PATH` state becomes the answer to "which environment am I in" — which is unanswerable in a Makefile, a
CI step, or a Dockerfile's `ENTRYPOINT`, all of which are not interactive shells. Both the pip workflow
and uv work fine without it; only one of them tells you so up front.

**A machine refuses `pip install` with a message about an externally managed environment. What is going on, and what do you do?**
The distribution has marked its system interpreter as managed by the OS package manager, so pip will not
write into it. This is protection rather than obstruction: pip's historical default of installing
globally when no environment is active is how system tooling written in Python gets broken by a user
installing a library — uv notes the same contrast from its side, that pip *"will install packages into
a global environment if no virtual environment is active"*, and that uv's own default is not to. The
correct response is to create a virtual environment and install there, or to use a tool-installation
mechanism designed for the purpose (`uv tool install` / `pipx` — [07](07-uvx-and-tools.md)). The
incorrect response is a flag that overrides the protection; the protection is not the problem.

---

← Prev: [05c · Upgrades and CI matrices](05c-interpreter-upgrades-and-ci-matrices.md) · [Topic index](README.md) · Next → [06b · Requirements files and the floor's limits](06b-requirements-files-and-the-floors-limits.md)
