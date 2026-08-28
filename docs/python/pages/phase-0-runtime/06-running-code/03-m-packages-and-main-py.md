---
title: "python -m pkg runs pkg/__main__.py after importing the package, and the same rule makes a directory, a zipfile and an installed package all executable"
sidebar_label: "3 · Packages and __main__.py"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-m`, the script argument), [`runpy`](https://docs.python.org/3.14/library/runpy.html),
> [`zipapp`](https://docs.python.org/3.14/library/zipapp.html),
> the [import system reference](https://docs.python.org/3.14/reference/import.html)
> and [PEP 441](https://peps.python.org/pep-0441/).
> Version spine: **Python 3.14.7**.

**One rule generalises to three shapes. Point the interpreter at a package name
with `-m`, at a directory, or at a zipfile, and in each case it looks for a
`__main__.py` and executes it as the main module. That is why `python -m
http.server` works, why a zipped application is a single runnable file, and why
`python -m pip` is the spelling to prefer over `pip`. It is also where two
genuinely confusing behaviours live: a package's `__init__.py` runs first, and
the module you execute can end up in `sys.modules` twice.**

## `-m` with a package

> *"Package names (including namespace packages) are also permitted. When a
> package name is supplied instead of a normal module, the interpreter will
> execute `<pkg>.__main__` as the main module. This behaviour is deliberately
> similar to the handling of directories and zipfiles that are passed to the
> interpreter as the script argument."*

So `python -m myapp` does two things in order:

1. **Imports `myapp`** — running `myapp/__init__.py` in full, with all its side
   effects.
2. **Executes `myapp/__main__.py`** as `__main__`.

Step 1 is the part people forget. If `__init__.py` builds a database connection
pool at import time, `python -m myapp --help` builds one too.

A good `__main__.py` is thin — it exists to be an entry point, not to hold logic:

```python
# src/myapp/__main__.py
import sys

from myapp.cli import main

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

Keeping the real work in an importable module means it can be tested without
launching a process, and `sys.exit(main(...))` gives you a real exit code
instead of always returning zero.

The `if __name__ == "__main__":` guard is still worth writing in `__main__.py`
even though the file is by definition the main module: it costs nothing and it
keeps the file importable by tools that inspect it. The reasons this guard exists
at all — including the multiprocessing failure it prevents — are in
**`../09-name-main.md`** *(not written yet)*.

## Why `python -m pip`, not `pip`

`pip` on your `PATH` is resolved by the shell, and which one it finds depends on
`PATH` order, shell hashing, aliases and whether an environment is activated.
`python -m pip` resolves in the opposite direction: **you name the interpreter,
and the interpreter finds its own pip**. The package it installs therefore lands
in the `site-packages` belonging to that interpreter, by construction.

The same argument applies to every tool that ships as a module:

```bash
python -m pip install httpx        # the pip belonging to *this* interpreter
python -m venv .venv               # the venv module of this interpreter
python -m pytest                   # also adds the cwd to sys.path, unlike `pytest`
python -m http.server 8000         # a static file server, no dependencies
python -m json.tool < data.json    # pretty-print JSON
python -m timeit -s "x=1" "x+1"    # microbenchmark
python -m pdb script.py            # run under the debugger
python -m unittest discover        # the stdlib test runner
python -m site                     # print the site-packages configuration
python -m zipapp myapp -m myapp.cli:main -o app.pyz
python -m compileall src/          # pre-compile bytecode
```

Note the `pytest` line: `python -m pytest` and `pytest` are *not* equivalent —
the `-m` form adds the current directory to `sys.path` and the bare command does
not, which changes what is importable during collection.

## Directories and zipfiles

> *"Execute the Python code contained in `script`, which must be a filesystem
> path (absolute or relative) referring to either a Python file, a directory
> containing a `__main__.py` file, or a zipfile containing a `__main__.py` file."*
>
> *"If the script name refers to a directory or zipfile, the script name is added
> to the start of `sys.path` and the `__main__.py` file in that location is
> executed as the `__main__` module."*

```bash
python myapp/            # runs myapp/__main__.py, with myapp/ on sys.path
python app.pyz           # runs __main__.py inside the archive
```

For the zipfile form, `zipapp` builds the archive:

```bash
python -m zipapp src/myapp -m "myapp.cli:main" -o app.pyz
python -m zipapp src/myapp -m "myapp.cli:main" -p "/usr/bin/env python3" -o app
```

The docs are precise about the two constraints. The archive must contain the
entry point at the top level — *"The zipfile content must include a file called
`__main__.py` (which must be in the 'root' of the zipfile - i.e., it cannot be in
a subdirectory)"* — and there is a hard limit on what you can bundle:

> *"If your application depends on a package that includes a C extension, that
> package cannot be run from a zip file (this is an OS limitation, as executable
> code must be present in the filesystem for the OS loader to load it)."*

That single sentence decides whether zipapp is usable for your project. Pure
Python dependencies: yes. Anything with a compiled extension — `numpy`,
`pydantic-core`, `cryptography`, most database drivers: no. The `-p` option *"add[s]
a `#!` line to the archive specifying interpreter as the command to run. Also, on
POSIX, make[s] the archive executable"*, which turns `app.pyz` into something you
can put on `PATH`.

## `runpy` — the same machinery, callable

`-m` is `runpy` semantics exposed on the command line, and the module is
available directly when a program needs to run another program's entry point in
its own process:

```python
import runpy

runpy.run_module("myapp.cli", run_name="__main__")   # like python -m myapp.cli
runpy.run_path("scripts/migrate.py", run_name="__main__")
```

Both return the resulting globals dictionary. `run_name="__main__"` is what makes
a `if __name__ == "__main__":` block fire; leave it out and the module runs under
its own name, with the guard skipped. This is how test harnesses and wrappers
invoke scripts without spawning a subprocess — at the cost of running that code in
*your* interpreter, with your `sys.modules` and your global state.

## The double-import trap

Executing `python -m myapp.cli` imports `myapp` (as a package), then executes
`myapp.cli` under the name `__main__`. If `myapp/__init__.py` — or anything it
imports — also imports `myapp.cli`, that module now exists **twice**: once as
`myapp.cli` in `sys.modules`, once as `__main__`. Two module objects, two sets of
module-level variables, two distinct class objects with the same name, and
`isinstance` checks that fail across the boundary.

The interpreter warns about this case at runtime rather than failing, so it is
easy to skim past. The reference's discussion of `__main__` states plainly that
the two are *"still considered distinct modules"*. The cure is structural: keep
`__main__.py` and the module you run with `-m` free of anything the package
itself imports. That is another argument for a thin `__main__.py` whose only job
is to call into the package.

The full treatment, including what the warning is telling you, is in
[`../08-imports/05b-running-a-module.md`](../08-imports/05b-running-a-module.md).

## Gotchas

**Symptom:** `python -m myapp` is slow or has side effects even for `--help`
**Cause:** `-m` on a package imports the package first, so everything in `__init__.py` runs before your entry point does
**Fix:** keep `__init__.py` empty or nearly so. Import heavy dependencies inside functions, not at package import time — the startup-cost argument in **Phase 0 topic 11** *(not written yet)*

**Symptom:** `python -m myapp` reports that the module cannot be found although `myapp/` is right there
**Cause:** either `myapp` is not on `sys.path` (a src layout that has not been installed — [chunk 2](02-script-vs-m.md)), or the package has no `__main__.py`
**Fix:** install the project, and add a `__main__.py` if you want the package itself to be executable

**Symptom:** the same class appears not to be itself — `isinstance(obj, MyClass)` is false for an object that obviously is one
**Cause:** the module was loaded twice, once as `__main__` and once under its real name, so there are two distinct class objects
**Fix:** do not put importable logic in the module you execute. `__main__.py` should import and call, nothing more

**Symptom:** `python -m zipapp` produces an archive that fails at runtime with a missing shared object or an import error for a compiled package
**Cause:** the documented OS limitation — C extensions cannot be loaded from inside a zip
**Fix:** ship a wheel and a virtual environment, or a single-file bundler that unpacks to disk. zipapp is for pure-Python applications

**Symptom:** `pytest` and `python -m pytest` behave differently on the same project
**Cause:** the `-m` form adds the current directory to `sys.path` and the console script does not
**Fix:** pick one and use it everywhere, ideally with the project installed so neither form depends on the cwd

**Symptom:** `runpy.run_module("x")` does not execute the `if __name__ == "__main__":` block
**Cause:** without `run_name="__main__"` the module runs under its own name
**Fix:** pass `run_name="__main__"` — and be aware that the code then runs inside your interpreter, sharing `sys.modules`, `sys.argv` and every global

**Symptom:** `python -m my-tool` fails
**Cause:** the argument is a module name, not a distribution name. The docs note that *"the module name should be a valid absolute Python module name"* even though the implementation may not always enforce it — and hyphens are not valid in identifiers
**Fix:** use the import name (`my_tool`), which is often different from the name on PyPI

**Symptom:** `python dir/` fails though `dir/` contains Python files
**Cause:** directory execution requires a `__main__.py` at the top level of that directory
**Fix:** add one, or name a file explicitly

## Interview questions

**★ What does `python -m package` do that `python -m package.module` does not?**
It imports the package — running `__init__.py` — and then executes
`package/__main__.py` as `__main__`. The module form imports the package as well
(it must, to reach the submodule) but executes the named module instead. Both
place the current directory at the front of `sys.path`; both give `__main__` a
real module spec.

**★ Why prefer `python -m pip install` over `pip install`?**
Because it inverts the resolution order. `pip` is found by the shell through
`PATH`, subject to hashing, aliases and activation state; `python -m pip` is found
by the interpreter you explicitly named, and installs into that interpreter's
`site-packages` by construction. When you are unsure which environment a package
landed in, `python -m pip` is the form that has no ambiguity to explain.

**★ How do you make a directory or a zip file executable by Python?**
Put a `__main__.py` at its top level. `python dir/` and `python app.pyz` both add
that path to the front of `sys.path` and execute the `__main__.py` inside it.
`python -m zipapp` builds the archive and `-p` writes a shebang so the archive
can be executed directly on POSIX.

**★ What is the main limitation of zipapp?**
Packages containing C extensions cannot be run from inside a zip file, because
the OS loader needs the shared object present on the filesystem. That rules out
most of the scientific and database ecosystem. zipapp is a good fit for
pure-Python tools and a poor fit for applications with compiled dependencies.

**★ What is the double-import problem with `-m`?**
When you execute `python -m pkg.mod`, `pkg.mod` runs as `__main__`. If anything
in the package also imports `pkg.mod` normally, the file is executed a second
time under its real name, producing two module objects with separate state and
separate class objects. Keeping the executed module trivial — import and call —
avoids it entirely.

---

← Prev: [Script versus -m](02-script-vs-m.md) · Index: [Running code](README.md) · Next → [-c, stdin and pipes](04-c-and-stdin.md)
