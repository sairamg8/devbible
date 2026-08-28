---
title: "A virtual environment is a directory containing one config file, a link to an interpreter and an empty site-packages — and that is genuinely all it is"
sidebar_label: "1 · What a venv is on disk"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` — Creation of virtual environments](https://docs.python.org/3.14/library/venv.html),
> [PEP 405 – Python Virtual Environments](https://peps.python.org/pep-0405/),
> the [`site`](https://docs.python.org/3.14/library/site.html) module docs and
> [`sysconfig` installation paths](https://docs.python.org/3.14/library/sysconfig.html).
> Version spine: **Python 3.14.7**.

**A virtual environment is not a sandbox, not a container, not a chroot and not
a second copy of Python. It is a directory with a text file in it. The text file
says where the real interpreter lives; the directory has a `bin/` with a link to
that interpreter and a `site-packages/` that starts out empty. Every property
people attribute to venvs — isolation, activation, "the environment being
active" — is a consequence of those three facts plus one `PATH` change. Once you
see the directory for what it is, nothing a venv does is surprising, including
all the ways it breaks.**

## The tree

On POSIX, after `python3.14 -m venv .venv`:

```text
.venv/
├── pyvenv.cfg              ← the whole mechanism lives here
├── .gitignore              ← written by default since 3.13
├── bin/
│   ├── python              → symlink to python3.14
│   ├── python3             → symlink to python
│   ├── python3.14          → symlink to the base interpreter
│   ├── activate            ← bash/zsh; also activate.fish, activate.csh, Activate.ps1
│   ├── pip
│   └── pip3.14
├── include/                ← headers for building C extensions; often empty
└── lib/
    └── python3.14/
        └── site-packages/  ← where everything you install goes
```

On Windows the same environment is:

```text
.venv\
├── pyvenv.cfg
├── Scripts\
│   ├── python.exe
│   ├── pythonw.exe
│   ├── activate.bat
│   ├── Activate.ps1
│   └── pip.exe
├── Include\
└── Lib\
    └── site-packages\
```

The documentation states the layout directly:

> *"It also creates a `bin` (or `Scripts` on Windows) subdirectory containing a
> copy or symlink of the Python executable (as appropriate for the platform or
> arguments used at environment creation time). It also creates a
> `lib/pythonX.Y/site-packages` subdirectory (on Windows, this is
> `Lib\site-packages`)."*

Note what is **not** in that tree: there is no standard library. No `os.py`, no
`json/`, no `_socket` extension module. A venv shares the standard library with
the interpreter that created it. PEP 405:

> *"Each virtual environment has its own Python binary (allowing creation of
> environments with various Python versions) and can have its own independent set
> of installed Python packages in its site directories, but shares the standard
> library with the base installed Python."*

That single design decision is why a venv is cheap to create and why it is
fatally dependent on the base interpreter continuing to exist —
[chunk 6](06-when-the-base-interpreter-moves.md) is that failure in full.

## `pyvenv.cfg`, the entire mechanism

The file is a flat `key = value` list. A minimal one created by CPython looks
like this:

```ini
home = /usr/local/bin
include-system-site-packages = false
version = 3.14.7
executable = /usr/local/bin/python3.14
command = /usr/local/bin/python3.14 -m venv /home/me/proj/.venv
```

Two of those keys are documented and load-bearing:

- **`home`** — PEP 405: *"If a `home` key is found, this signifies that the
  Python binary belongs to a virtual environment, and the value of the `home` key
  is the directory containing the Python executable used to create this virtual
  environment."* This is the pointer back to the base installation, and it is an
  **absolute path**.
- **`include-system-site-packages`** — the venv docs: *"The created `pyvenv.cfg`
  file also includes the `include-system-site-packages` key, set to `true` if
  `venv` is run with the `--system-site-packages` option, `false` otherwise."*
  [Chunk 8](08-system-site-packages.md) covers what turning it on costs you.

`version`, `executable` and `command` are written by CPython's implementation but
are not part of the documented contract, so treat them as diagnostics rather than
an API — `command` in particular is a gift when you are staring at somebody
else's environment and want to know exactly how it was made.

There is no lockfile in here, no dependency list, no record of what you installed
beyond the packages themselves. A venv does not know what it contains. That is
what `requirements.txt`, `pyproject.toml` and `uv.lock` are for.

## What "isolated" actually means

The venv docs define the isolation narrowly:

> *"A virtual environment is created on top of an existing Python installation,
> known as the virtual environment's 'base' Python, and by default is isolated
> from the packages in the base environment, so that only those explicitly
> installed in the virtual environment are available."*

**Isolated from the base installation's packages.** Not from anything else. A
venv does not isolate you from:

- **Environment variables.** `PYTHONPATH` still prepends its directories ahead of
  the venv's `site-packages`, so a stale `PYTHONPATH` can shadow a package you
  just installed. See [`../08-imports/02b-pythonpath-and-site-packages.md`](../08-imports/02b-pythonpath-and-site-packages.md).
- **The filesystem.** Code in a venv reads and writes anything your user can.
- **The current directory.** `sys.path[0]` is still the script's directory or the
  cwd, and still wins over `site-packages` — the whole `random.py` shadowing
  problem is unaffected by venvs.
- **Other processes, other users, the network, or the OS.** It is not a security
  boundary. Never describe a venv as sandboxing untrusted code.
- **Non-Python shared libraries.** A wheel that links `libpq` still needs
  `libpq.so` on the system. This is precisely the gap conda fills
  ([chunk 10](10-venv-virtualenv-conda.md)).

## The disposability doctrine, straight from the docs

The `venv` page lists what a virtual environment is, and the list is normative
advice as much as description:

> *"Contained in a directory, conventionally named `.venv` or `venv` in the
> project directory, or under a container directory for lots of virtual
> environments, such as `~/.virtualenvs`."*
>
> *"Not checked into source control systems such as Git."*
>
> *"Considered as disposable – it should be simple to delete and recreate it from
> scratch. You don't place any project code in the environment."*
>
> *"Not considered as movable or copyable – you just recreate the same
> environment in the target location."*

Four sentences that pre-empt most venv incidents. Two of them get their own
chunks here: [chunk 5](05-not-relocatable.md) for movability and
[chunk 9](09-where-the-venv-lives.md) for location and source control.

## The interpreter in `bin/` is usually not a binary

On POSIX with the default settings, `.venv/bin/python` is a **symlink** to the
base interpreter, chained through `python3` and `python3.14`. There is no second
CPython on your disk. On Windows the default is a **copy** of `python.exe`,
because symlinks there require privileges and behave badly — the docs warn:

> *"While symlinks are supported on Windows, they are not recommended. Of
> particular note is that double-clicking `python.exe` in File Explorer will
> resolve the symlink eagerly and ignore the virtual environment."*

That warning tells you exactly how the mechanism works, and it is the subject of
[chunk 2](02-how-the-interpreter-finds-it.md): the interpreter decides it is in a
virtual environment by looking next to *the path it was invoked as*, not next to
the real binary. Resolve the symlink first and the environment vanishes.

## Gotchas

**Symptom:** you delete `.venv/pyvenv.cfg` "to clean up" and every installed package disappears from `import`
**Cause:** that file *is* the environment. Without it the interpreter in `bin/` is just the base interpreter under an alias, with the base `sys.prefix` and the base `site-packages`
**Fix:** delete the whole directory and recreate it — `rm -rf .venv && python3.14 -m venv .venv && pip install -r requirements.txt`. Never hand-repair a venv; it is cheaper to rebuild than to reason about

**Symptom:** a venv committed to git makes a colleague's checkout unusable
**Cause:** absolute paths in `pyvenv.cfg` and in every console script's shebang, plus platform-specific binaries in `site-packages`
**Fix:** commit `requirements.txt` or `uv.lock` and gitignore the environment. Since 3.13 `venv` writes a `.gitignore` inside the environment for you, so this only happens if you deliberately force-add it

**Symptom:** `import ssl` or `import sqlite3` fails inside a venv but you "installed" nothing wrong
**Cause:** the venv shares the base interpreter's standard library, and the base interpreter was built without those optional modules — typically a `pyenv install` on a machine missing OpenSSL or SQLite headers
**Fix:** fix the base interpreter, not the venv. Rebuild it with the development headers present, or use a prebuilt one (`uv python install 3.14`), then recreate the environment

**Symptom:** a package works from your shell but a C extension in it fails to build inside the venv with a missing `Python.h`
**Cause:** `include/` in a venv is a link/copy arrangement for headers; if the base installation is a distro package that split headers into `python3-dev`, they are not present at all
**Fix:** install the base interpreter's development package (`python3-dev` / `python3-devel`), or use an interpreter build that ships headers. The venv cannot supply what the base does not have

**Symptom:** someone puts project source code inside `.venv/` so "it is always importable"
**Cause:** confusing the environment with the project. The docs say the opposite: *"You don't place any project code in the environment."*
**Fix:** an editable install (`pip install -e .` or `uv sync`) puts a `.pth` pointer to your source tree into `site-packages` and leaves the code where it belongs

**Symptom:** two developers on the same repo have different behaviour and both `.venv` directories "look the same"
**Cause:** a venv records nothing about what should be in it. Identical directory listings say nothing about versions
**Fix:** compare `pip freeze` output, or stop relying on it entirely and adopt a lockfile — this is exactly the problem `uv.lock` and `pip-compile` exist to remove

## Interview questions

**★ What is a virtual environment, physically?**
A directory containing `pyvenv.cfg`, a `bin`/`Scripts` directory with a symlink
or copy of an existing Python interpreter and the scripts installed into the
environment, and a `lib/pythonX.Y/site-packages` (or `Lib\site-packages`) that
starts empty. `pyvenv.cfg` carries a `home` key pointing at the base
installation. The standard library is *not* copied — it is shared with the base
Python. Nothing else is required for the mechanism to work.

**★ Does creating a venv install a second copy of Python?**
No. On POSIX the environment's `python` is a symlink to the base interpreter and
the standard library is shared; on Windows the executable is copied but the
standard library is still the base installation's. What a venv gives you is a
separate `site-packages`, not a separate runtime.

**★ Is a virtual environment a security boundary?**
No, and this is worth being firm about in an interview. It isolates *installed
packages* from the base installation's packages and nothing else. Code in a venv
runs as your user, reads your files, opens sockets and can be affected by
`PYTHONPATH`. If you need to run untrusted code, you need a container, a VM or an
OS-level sandbox — the venv contributes nothing to that.

**★ Why can a venv break when nobody touched it?**
Because `pyvenv.cfg`'s `home` key is an absolute path to a base installation that
the venv does not own. Upgrade, move or remove that installation — a Homebrew
Python bump, a `pyenv uninstall`, a distro point release that changes the minor
version directory — and the environment is pointing at nothing. This is covered
in [chunk 6](06-when-the-base-interpreter-moves.md).

**★ Where do the packages you `pip install` inside an environment actually go?**
Into `<venv>/lib/pythonX.Y/site-packages` on POSIX or `<venv>\Lib\site-packages`
on Windows, because `pip` is running under an interpreter whose `sys.prefix`
points at the environment, and `site` builds the site-packages path from
`sys.prefix`. The environment being "active" has nothing to do with it — what
matters is which interpreter `pip` is running under.

---

← Index: [Virtual environments](README.md) · Next → [How the interpreter finds it](02-how-the-interpreter-finds-it.md)
