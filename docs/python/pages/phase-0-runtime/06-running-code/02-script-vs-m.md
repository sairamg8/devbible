---
title: "Most ModuleNotFoundError reports are one fact: python file.py puts the file's directory on sys.path, and python -m puts the current directory there"
sidebar_label: "2 · Script versus -m"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html),
> [the `sys.path` initialization page](https://docs.python.org/3.14/library/sys_path_init.html),
> the [import system reference](https://docs.python.org/3.14/reference/import.html),
> [`site`](https://docs.python.org/3.14/library/site.html) (`.pth` files) and the
> [Python Packaging User Guide on src layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/).
> Version spine: **Python 3.14.7**.

**A beginner meets `ModuleNotFoundError` and concludes Python cannot find their
file. Python found the file perfectly; what it could not find was a *package*,
because the launch mode decided that the search would start in the wrong
directory. This chunk is one worked project, run four ways, with the exact
mechanism for each — and then the argument for why `PYTHONPATH`, which fixes it
in ten seconds, is the answer that costs you the most later.**

## The project

```text
myproject/
├── pyproject.toml
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── config.py
│       ├── main.py
│       └── util/
│           ├── __init__.py
│           └── text.py
└── tests/
    └── test_main.py
```

```python
# src/myapp/main.py
from myapp.config import SETTINGS
from myapp.util.text import slugify

def main() -> None:
    print(slugify(SETTINGS["title"]))

if __name__ == "__main__":
    main()
```

## Run 1 — the one everybody tries first

```bash
cd myproject
python src/myapp/main.py
```

`sys.path[0]` becomes `src/myapp` — *"the directory containing that file"*. So the
search path starts inside the package. From there, `myapp` is not a name that can
be found: there is no `myapp` directory inside `src/myapp`. The import of
`myapp.config` fails, even though `config.py` is sitting right next to the file
being run.

This is the whole bug. The file is found; the *package* is not, because the
search started one level too deep.

Note the trap in the failure: `import config` **would** have worked, because
`config.py` is in `src/myapp` which is `sys.path[0]`. That is worse than failing.
It imports the same file under the top-level name `config`, so if any other part
of the program imports `myapp.config`, you now have two module objects from one
file with two separate copies of every global. See
[`../08-imports/05b-running-a-module.md`](../08-imports/05b-running-a-module.md).

## Run 2 — `-m` from the project root

```bash
cd myproject
python -m myapp.main
```

`sys.path[0]` becomes the current directory, `myproject`. Better — but with a
**src layout** this still fails, because `myapp` lives in `src/`, not in
`myproject/`. This is the point where people conclude that `-m` is unreliable. It
is not; the layout is telling you something true, which is that the package is
not importable until it is installed.

With a **flat layout** — `myproject/myapp/` rather than `myproject/src/myapp/` —
the same command works, because the project root really does contain the package.
That difference is the entire practical distinction between the two layouts: a
flat layout is importable by accident from the root, a src layout is importable
only when installed. The packaging guide's argument for src is precisely that
accident-avoidance: you always test the installed package rather than the
checkout.

## Run 3 — install the project, then run it

```bash
cd myproject
uv sync                        # or: python -m pip install -e .
uv run python -m myapp.main    # or: .venv/bin/python -m myapp.main
```

Now `myapp` is importable from anywhere, because the install put a pointer to
`src/` into the environment's `site-packages` — an editable install writes a
`.pth` file, and *"its contents are additional items (one per line) to be added
to `sys.path`"*. The import works from any working directory, in your editor, in
pytest, and in production, because it does not depend on where you were standing.

Better still, give the project a console entry point so the command has a name:

```toml
# pyproject.toml
[project.scripts]
myapp = "myapp.main:main"
```

```bash
uv run myapp
```

Now the entry point, `python -m myapp.main` and `import myapp` all resolve
identically. That is the destination.

## Run 4 — `python -m myapp` with a `__main__.py`

Add `src/myapp/__main__.py`:

```python
from myapp.main import main

if __name__ == "__main__":
    main()
```

and `python -m myapp` works, because *"when a package name is supplied instead of
a normal module, the interpreter will execute `<pkg>.__main__` as the main
module."* [Chunk 3](03-m-packages-and-main-py.md) covers this properly.

## Why `PYTHONPATH` is the fix that costs you

The fastest way to make run 2 work is:

```bash
PYTHONPATH=src python -m myapp.main
```

It works. It is also the answer that produces the most future pain, for six
reasons:

1. **It is invisible.** Nothing in the repository records it. A colleague clones
   the project, runs the documented command, and gets the error you already
   "fixed".
2. **It is global to the interpreter, not scoped to the project.** Exported in a
   shell profile, it applies to every Python process that shell starts —
   including unrelated projects and installed tools.
3. **It comes early in the search order.** `PYTHONPATH` is consumed before
   site-packages, so a directory added for one project can shadow an installed
   package for another. That is the shadowing failure in
   [`../08-imports/03-shadowing-the-stdlib.md`](../08-imports/03-shadowing-the-stdlib.md),
   self-inflicted.
4. **It does not survive to production.** Nothing sets it in your container, your
   systemd unit or your Lambda. The code works everywhere you tested and fails
   where it matters.
5. **It hides a packaging problem.** If the package is not importable when
   installed, that is a bug in `pyproject.toml` — one you now will not find until
   somebody tries to install it.
6. **It multiplies.** One project's `PYTHONPATH` habit becomes five entries in a
   shell profile, and then nobody can explain which copy of anything is being
   imported.

The legitimate uses are narrow: a one-off diagnostic in a shell you are about to
close, a legacy application whose layout you cannot change, and a build system
that sets it for a single child process. Even then, set it **per command**
(`PYTHONPATH=src python …`) rather than exporting it.

The full mechanics of `PYTHONPATH`, `site-packages` and `.pth` files are in
[`../08-imports/02b-pythonpath-and-site-packages.md`](../08-imports/02b-pythonpath-and-site-packages.md).

## And `sys.path.insert(0, ...)` is worse

```python
# The line that appears at the top of far too many scripts
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
```

It has every disadvantage of `PYTHONPATH` plus two more: it runs *after* the
interpreter has started, so it cannot fix an import that already happened at
module import time, and it is executed only when this particular file is the
entry point — so the project's importability depends on which file you started.
Delete it and install the package.

## The decision, in three lines

- **A single-file script with no package** → `python script.py`. Nothing else is
  needed and nothing will go wrong.
- **A module inside a package, during development** → `python -m pkg.module`, from
  a directory where `pkg` is importable, which usually means having installed the
  project.
- **Anything a user will run** → a `[project.scripts]` entry point, so nobody has
  to know either rule.

## Gotchas

**Symptom:** `python src/myapp/main.py` fails to import `myapp.anything`
**Cause:** `sys.path[0]` is `src/myapp`, so the package directory itself is the search root and the package is not visible from inside it
**Fix:** install the project (`uv sync` or `pip install -e .`) and run `python -m myapp.main`, or use a console entry point

**Symptom:** the same file imports fine as `import config` and fails as `import myapp.config`
**Cause:** the script's directory is on `sys.path`, so the sibling module is importable as a *top-level* module under a different name
**Fix:** never rely on it. Two names for one file means two module objects, two copies of module-level state, and `isinstance` checks that fail against classes from "the same" module

**Symptom:** `python -m myapp` works in one checkout and not another
**Cause:** one is a flat layout (package at the project root, importable from cwd) and the other is a src layout (importable only when installed)
**Fix:** install the project in both. Relying on cwd-importability is exactly what the src layout exists to prevent

**Symptom:** tests pass under `pytest` and the application fails to import the same module
**Cause:** pytest inserts directories on `sys.path` according to its own import mode and `rootdir` rules, which are not the interpreter's rules
**Fix:** install the project and use pytest's `importmode=importlib` with `testpaths`; do not let two different path-manipulation schemes disagree. See [`../08-imports/02-sys-path.md`](../08-imports/02-sys-path.md)

**Symptom:** a `PYTHONPATH` exported in `.bashrc` breaks an unrelated tool months later
**Cause:** it applies to every interpreter that shell starts, and its entries are searched before site-packages
**Fix:** unset it, install projects properly, and if you must use it, set it inline for one command

**Symptom:** the application works in development and the container fails at startup with an import error
**Cause:** development relied on cwd, `PYTHONPATH` or a `sys.path.insert` that the container does not reproduce
**Fix:** install the package into the image and run it by module or entry point. If `python -m myapp` works from an empty directory, it will work in the container

**Symptom:** a `sys.path.insert` at the top of a file does not fix an import that still fails
**Cause:** the failing import runs at the top of a module that was already imported before the insert executed — commonly an import at the top of the same file, above the insert
**Fix:** the insert cannot be made to work reliably. Install the package

**Symptom:** relative imports (`from . import x`) fail with a message about the parent package under `python file.py` but work under `-m`
**Cause:** the script form leaves `__main__.__spec__` as `None`, so there is no package to be relative to
**Fix:** `-m`, or convert to absolute imports and install the package. Detail in [`../08-imports/05-relative-imports.md`](../08-imports/05-relative-imports.md)

## Interview questions

**★ Why does running a file inside a package as a script break its imports?**
Because `sys.path[0]` is set to the directory containing the script — the
package's own directory — so the package is not on the search path. Its modules
are only reachable as top-level names, and any absolute import of
`package.module` fails. `-m` instead puts the *current* directory first and
performs a real import, so the package resolves as a package.

**★ Someone fixes that with `PYTHONPATH=src`. What do you say?**
That it works and that it is the wrong layer. It is invisible to the repository,
global to the shell, searched ahead of site-packages so it can shadow installed
packages, absent in production, and it conceals whether the project is actually
installable. Installing the project — editable during development — puts the same
directory on the path through a mechanism that travels with the project.

**★ What is the difference between a flat layout and a src layout, in terms of running code?**
A flat layout puts the package at the project root, so `python -m pkg` works from
the root without installing anything — which also means you may be testing the
checkout rather than the installed artifact. A src layout puts it under `src/`,
so the package is importable only after installation, which makes packaging
errors visible immediately.

**★ Why is `sys.path.insert(0, ...)` at the top of a file a bad fix?**
Because it executes after interpreter startup, so it cannot help imports that
already ran; because it only applies when that specific file is the entry point,
making importability depend on how the program was started; and because it hides
the same packaging problem `PYTHONPATH` hides, while additionally being code that
ships to production.

**★ What is the "right" way to run an application during development?**
Install it into the project's environment — `uv sync`, or `pip install -e .` —
and run it as `python -m mypackage` or through a `[project.scripts]` entry point.
Both resolve identically regardless of the working directory, match how the
application will be started in production, and fail loudly if the packaging
metadata is wrong.

---

← Prev: [The launch modes](01-the-launch-modes.md) · Index: [Running code](README.md) · Next → [Packages and `__main__.py`](03-m-packages-and-main-py.md)
