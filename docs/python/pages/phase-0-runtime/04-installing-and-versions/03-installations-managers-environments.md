---
title: "Installations, version managers and environments: three different things that all get called 'installing Python', and the boundary each one fails at"
sidebar_label: "3 · The three layers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`sys`](https://docs.python.org/3.14/library/sys.html) and
> [`sysconfig`](https://docs.python.org/3.14/library/sysconfig.html) module docs,
> [`venv`](https://docs.python.org/3.14/library/venv.html),
> [Using Python on Unix platforms](https://docs.python.org/3.14/using/unix.html),
> the [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/)
> documentation and the [pyenv README](https://github.com/pyenv/pyenv).
> Version spine: **Python 3.14.7**.

**"I installed Python" is three unrelated statements wearing the same sentence.
You can install an *interpreter*; you can install a *version manager* that
fetches and selects between interpreters; and you can create an *environment*
that pins one interpreter and its own private package directory to one project.
They stack, they each have a different failure mode, and almost every "which
Python is this?" confusion is somebody debugging one layer while the fault is in
another.**

## Layer 1 — an installation

An installation is a compiled `python` binary plus the standard library that
belongs to it, plus a `site-packages` directory. It is inert: nothing about it
selects or manages anything.

The Unix documentation gives the canonical layout, where `prefix` is
installation-dependent and *"on most Linux systems, the default for both is
`/usr`"*:

| Path | What it is |
|---|---|
| `exec_prefix/bin/python3` | *"Recommended location of the interpreter."* |
| `prefix/lib/pythonversion` | *"Recommended locations of the directories containing the standard modules."* |
| `prefix/include/pythonversion` | headers for building extension modules and embedding |

At runtime, the installation identifies itself:

```python
import sys, sysconfig

sys.executable      # the binary that is running right now
sys.prefix          # the environment's prefix
sys.base_prefix     # the INSTALLATION's prefix — differs inside a venv
sys.version_info    # which version this installation is
sysconfig.get_paths()   # where this installation puts stdlib, headers, scripts, site-packages
```

`sys.prefix` versus `sys.base_prefix` is the single most useful diagnostic on
this page: if they differ you are in a virtual environment, and `sys.base_prefix`
names the installation underneath it. That is the same comparison PEP 668 uses,
covered in [chunk 1](01-never-the-system-python.md).

**Where installations come from**, and who owns each:

| Source | Owned by | Notes |
|---|---|---|
| Distro package (`/usr/bin/python3`) | `apt` / `dnf` | a dependency of the OS; marked externally managed |
| Apple's `/usr/bin/python3` | Apple | exists for Xcode; the docs say *"You should never modify or attempt to delete this installation"* |
| python.org installer | you | macOS `.pkg` and the Windows install manager |
| Homebrew / MacPorts | the package manager | can be upgraded out from under you |
| `uv python install` | uv | standalone builds under uv's data directory |
| `pyenv install` | pyenv | compiled from source under `$(pyenv root)/versions` |
| `./configure && make altinstall` | you | note `altinstall`, not `install` — see below |

The Unix docs carry a warning worth quoting because it is the one people ignore
when building from source:

> *"make install can overwrite or masquerade the python3 binary. make altinstall
> is therefore recommended instead of make install since it only installs
> exec_prefix/bin/pythonversion."*

`make install` will happily overwrite `/usr/local/bin/python3` — creating
exactly the ambiguity this whole topic is about. `make altinstall` installs only
`python3.14`, leaving `python3` alone.

**The failure mode of this layer:** *ambiguity*. Several installations, all
called `python3`, resolved by `PATH` order, and nothing announces which one
won. The diagnostic is always the same two commands:

```bash
which -a python3          # every python3 on PATH, in order
python3 -c "import sys; print(sys.executable, sys.version)"
```

## Layer 2 — a version manager

A version manager installs, tracks and *selects between* installations. It does
not run your code and it does not hold your packages. Its entire job is to
answer "when someone types `python`, which installation should that be?".

Two answers to that question are in common use, and the difference matters:

- **`uv` resolves per invocation.** It reads a request — a `--python` flag, a
  `.python-version` file, `requires-python` in `pyproject.toml` — and picks an
  interpreter for that command, downloading one if needed. Nothing is
  permanently rewired.
- **`pyenv` intercepts the command name.** It puts a directory of *shims* at the
  front of `PATH`; the shim named `python` is a small executable that asks pyenv
  which version to use and re-dispatches. The interception is global and
  persistent.

Both read a `.python-version` file, which is the one piece of interoperable
state between them — the uv docs recommend a plain version number in it *"for
interoperability with other tools"*.

**The failure mode of this layer:** *invisible indirection*. `which python`
returns a shim or a wrapper, not the interpreter, so the answer to "where is
this Python?" is a program rather than a path. The diagnostic is to ask the
interpreter itself rather than the shell:

```bash
which python                 # may be a shim
python -c "import sys; print(sys.executable)"   # the real binary
pyenv which python           # pyenv's own answer
uv python find               # uv's own answer
```

[Chunk 4](04-uv.md) and [chunk 6](06-pyenv.md) cover each in
detail.

## Layer 3 — an environment

A virtual environment is a directory containing a `pyvenv.cfg` file, a `bin/`
(or `Scripts\`) directory with a `python` that points back at an installation,
and its own `site-packages`. It does not contain a Python. It *redirects* to
one, and it changes `sys.prefix` so that `site-packages` resolution lands inside
the environment.

That single redirection is what makes everything else on this page work:

- It is why PEP 668 does not block installs inside it.
- It is why two projects can depend on incompatible versions of the same
  library.
- It is why deleting `.venv` and recreating it is a safe, cheap operation, while
  "reinstalling Python" is not.

The full mechanism — `pyvenv.cfg`, what activation actually changes, why
activation is optional, and what `--system-site-packages` does — is
**05 · Virtual environments** *(not written yet)*.

**The failure mode of this layer:** *the environment you think you are in is not
the one you are in*. A shell where activation was never run, a new terminal tab,
an IDE that spawns a subprocess with a scrubbed environment, a `sudo` that reset
`PATH`. The diagnostic:

```bash
python -c "import sys; print(sys.prefix); print(sys.base_prefix)"
# equal  → not in a virtual environment
# differ → in one, and base_prefix names the installation underneath
```

## How the layers stack

Reading top to bottom, a working setup is:

```text
project/.venv/                      ← layer 3: environment (this project's packages)
   └─ pyvenv.cfg  home = ~/.local/share/uv/python/cpython-3.14.7-.../bin
        └─ ~/.local/share/uv/python/cpython-3.14.7-…/   ← layer 1: installation
             ↑ selected by
        uv, reading .python-version                     ← layer 2: version manager
```

Each arrow is a place a question can be asked and answered precisely:

| Question | Layer | Command |
|---|---|---|
| Which binary is running? | 1 | `python -c "import sys; print(sys.executable)"` |
| Which installations exist? | 2 | `uv python list` / `pyenv versions` |
| Why *that* one? | 2 | `cat .python-version`; `uv python find` |
| Am I in an environment? | 3 | `sys.prefix != sys.base_prefix` |
| Where will `pip` write? | 3 | `python -m pip -V` (it prints its own site directory) |

## What `which python` is actually answering

`which python` answers *"what would the shell execute for the word `python`?"*
It does not answer "what interpreter will run", and on a machine with a version
manager it usually cannot. Three ways it misleads:

1. **It may name a shim.** pyenv's `python` is a shell script that dispatches.
2. **It may name a symlink chain** — `/usr/local/bin/python3` → Homebrew's
   Cellar → the actual binary.
3. **It reflects the shell's hash table, not the filesystem**, if a binary moved
   during the session. `hash -r` clears it in bash and zsh.

The reliable question is always asked of the interpreter, not of the shell:

```bash
python -c "import sys; print(sys.executable); print(sys.prefix); print(sys.base_prefix)"
```

Three lines that identify the installation, the environment, and the
relationship between them — in one command, on every platform.

## Gotchas

**Symptom:** `pip install` succeeds and `import` fails in the very next command
**Cause:** `pip` and `python` resolved to different layers — typically a `pip` from the system installation and a `python` from an environment, or vice versa
**Fix:** never invoke bare `pip`. Use `python -m pip`, which is guaranteed to install into the interpreter you just named, or `uv pip install`, which resolves the environment explicitly

**Symptom:** `which python` prints a path that does not exist, or one that is not a Python
**Cause:** a shim, a wrapper script, or a stale shell hash table
**Fix:** ask the interpreter — `python -c "import sys; print(sys.executable)"` — and run `hash -r` if the shell is caching a moved binary

**Symptom:** a version manager is installed and `python` still resolves to the system one
**Cause:** the manager's shim or bin directory is not on `PATH`, or is on it *after* `/usr/bin`. `PATH` is searched left to right
**Fix:** print `PATH` and check the order. pyenv requires its shims directory at the front; uv-installed executables land in a directory the docs expect you to add (`uv python update-shell` does it)

**Symptom:** deleting and recreating `.venv` did not fix the problem
**Cause:** the fault is in layer 1 or 2 — a missing installation, a wrong `.python-version`, a shim pointing at a version that was uninstalled
**Fix:** work down the layers rather than repeating the cheapest fix. `sys.base_prefix` tells you which installation the environment is built on; check that it still exists

**Symptom:** the IDE runs a different Python from the terminal
**Cause:** IDEs usually resolve an interpreter path once, at configuration time, and store it. They do not re-read your shell's `PATH` or your `.python-version`
**Fix:** point the IDE at `.venv/bin/python` explicitly, and re-point it when you recreate the environment. This is a layer-3 configuration, not a shell problem

**Symptom:** you built Python from source and now `python3` is the wrong one
**Cause:** `make install` overwrites or masquerades the `python3` binary; the Unix docs warn about exactly this
**Fix:** use `make altinstall`, which installs only the versioned `python3.X` name. If it is already done, restore the previous `python3` symlink and never use `make install` on a shared machine

**Symptom:** an environment stops working after the version manager upgrades a patch release
**Cause:** the venv's `pyvenv.cfg` points at a specific installation directory. If that directory is replaced or removed, the environment is orphaned
**Fix:** recreate the environment after an interpreter change. uv mitigates this with a minor-version symlink directory so patch upgrades flow through — but it notes that a venv created from an explicitly requested patch version *"will not be transparently upgraded"*

**Symptom:** `sudo python script.py` behaves completely differently
**Cause:** `sudo` resets the environment, so both the version manager's `PATH` entry and any `VIRTUAL_ENV` are gone. You are running the system installation with no environment
**Fix:** invoke the environment's interpreter by absolute path — `sudo /path/to/.venv/bin/python script.py` — and ask why root is needed at all

## Interview questions

**★ Someone says "I installed Python". What are the three different things they might mean?**
An interpreter installation — a binary plus its standard library and
`site-packages`, sitting in a directory. A version manager — `uv` or `pyenv` —
which fetches and selects between several installations but is not itself a
Python. Or a virtual environment, which contains no interpreter at all, just a
`pyvenv.cfg` pointing at one and its own package directory. They stack, and
diagnosing the wrong layer is the most common way to spend an afternoon on a
five-minute problem.

**★ How do you determine, definitively, which interpreter is running and whether you are in a virtual environment?**
Ask the interpreter, never the shell:
`python -c "import sys; print(sys.executable, sys.prefix, sys.base_prefix)"`.
`sys.executable` is the actual binary, which cuts through shims and symlinks.
`sys.prefix != sys.base_prefix` means you are inside a virtual environment, and
`sys.base_prefix` names the installation it was built from. `which python` only
tells you what the shell would execute, which on a machine with a version
manager is usually a dispatcher rather than an interpreter.

**★ Why is `python -m pip install` safer than `pip install`?**
Because `python -m pip` runs pip *inside the interpreter you just named*, so it
cannot install into a different one. Bare `pip` is resolved by `PATH`, and on a
machine with several installations and an environment that may or may not be
activated, the `pip` that wins is frequently not the one belonging to the
`python` that wins. Every "I installed it and it still says ModuleNotFoundError"
is this.

**What is the difference between how `uv` and `pyenv` select a version?**
`uv` resolves per invocation: it reads the request from a flag, a
`.python-version` file, or `requires-python`, and uses an appropriate
interpreter for that command, downloading one if necessary. Nothing global
changes. `pyenv` inserts a directory of shims at the front of `PATH`, so the
name `python` itself is intercepted and re-dispatched for every command in every
shell. One is explicit and scoped; the other is global and persistent.

**Why is `make altinstall` recommended over `make install` when building from source?**
Because `make install` can overwrite or masquerade the `python3` binary — the
Unix setup docs say so directly — which changes what `python3` means for
everything else on the machine, including OS tooling. `make altinstall` installs
only the versioned name, `python3.14`, leaving the unversioned command alone.

**What is actually inside a virtual environment directory?**
A `pyvenv.cfg` file recording which installation it points at, a `bin/` or
`Scripts\` directory containing a `python` that redirects to that installation,
and its own `site-packages`. There is no interpreter and no standard library
copy. That is why creating one is nearly free and deleting one is safe, and why
"reinstall the venv" is a reasonable first move while "reinstall Python" is not.

**Your colleague's environment stopped working after they upgraded their Python patch version. Why?**
Because the environment records the path of the installation it was built from,
and that path changed or disappeared. uv softens this by resolving through a
directory named for the minor version, so patch upgrades flow through
transparently — except when the environment was created from an explicitly
requested patch version, which the uv docs say is deliberately not upgraded.
With pyenv, uninstalling a version orphans every venv built on it. The fix is
always to recreate the environment; the lesson is that layer 3 depends on layer
1 by path.

---

← Prev: [Responding to PEP 668](02-responding-to-pep-668.md) · Index: [Installing and versions](README.md) · Next → [`uv`](04-uv.md)
